import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

globalThis.__UPS_DISABLE_AUTO_BOOT__ = true;

import {
  PALETTE_OPTIONS,
  COLOR_MODE_OPTIONS,
  SHADOW_CSS,
  parseColorRgb,
  toOpaqueColor,
  mixOpaqueColors,
  inferThemeFromTextColor,
  resolveThemeTokens,
  applyThemeToRoot,
} from '../src/styles.js';
import {
  clampModalSize,
  clampModalRect,
  computeDraggedModalPosition,
  computeResizedModalRect,
  computeMiniWindowRect,
  computeRestorePillPosition,
  createDraftHistory,
  createStudioUI,
} from '../src/ui.js';
import { createStudioController, mountStudioForTest, refreshExtensionStylesheet } from '../index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// ============================================================================
// Lightweight Mock DOM + ShadowRoot + EventTarget (Zero External Dependencies)
// ============================================================================

class MockClassList {
  constructor(el) {
    this.el = el;
    this.set = new Set();
  }
  _syncFromAttr(val) {
    this.set = new Set(String(val || '').split(/\s+/).filter(Boolean));
  }
  add(...names) {
    for (const n of names) if (n) this.set.add(n);
    this.el._className = Array.from(this.set).join(' ');
  }
  remove(...names) {
    for (const n of names) this.set.delete(n);
    this.el._className = Array.from(this.set).join(' ');
  }
  toggle(name, force) {
    if (force === true) {
      this.add(name);
      return true;
    }
    if (force === false) {
      this.remove(name);
      return false;
    }
    if (this.set.has(name)) {
      this.remove(name);
      return false;
    }
    this.add(name);
    return true;
  }
  contains(name) {
    return this.set.has(name);
  }
}

class MockStyle {
  constructor() {
    this._props = new Map();
  }
  setProperty(k, v) {
    this._props.set(k, String(v));
  }
  getPropertyValue(k) {
    return this._props.get(k) || '';
  }
  removeProperty(k) {
    this._props.delete(k);
  }
  set left(v) { this._props.set('left', v); }
  get left() { return this._props.get('left') || ''; }
  set top(v) { this._props.set('top', v); }
  get top() { return this._props.get('top') || ''; }
  set width(v) { this._props.set('width', v); }
  get width() { return this._props.get('width') || ''; }
  set height(v) { this._props.set('height', v); }
  get height() { return this._props.get('height') || ''; }
  set display(v) { this._props.set('display', v); }
  get display() { return this._props.get('display') || ''; }
}

function parseSimpleSelectorParts(sel) {
  return sel.split(',').map((s) => s.trim()).filter(Boolean);
}

function matchSingleSelector(el, sel) {
  if (!el || el.nodeType !== 1) return false;
  if (sel === '*') return true;
  let rest = sel.trim();
  const tagMatch = /^([a-zA-Z0-9_-]+)/.exec(rest);
  if (tagMatch) {
    if (el.tagName !== tagMatch[1].toUpperCase()) return false;
    rest = rest.slice(tagMatch[0].length);
  }
  while (rest.length > 0) {
    if (rest.startsWith('#')) {
      const m = /^#([a-zA-Z0-9_-]+)/.exec(rest);
      if (!m || el.id !== m[1]) return false;
      rest = rest.slice(m[0].length);
    } else if (rest.startsWith('.')) {
      const m = /^\.([a-zA-Z0-9_-]+)/.exec(rest);
      if (!m || !el.classList.contains(m[1])) return false;
      rest = rest.slice(m[0].length);
    } else if (rest.startsWith('[')) {
      const m = /^\[([^\]=]+)(?:=["']?([^\]"']+)["']?)?\]/.exec(rest);
      if (!m) return false;
      const attrVal = el.getAttribute(m[1]);
      if (m[2] !== undefined) {
        if (attrVal !== m[2]) return false;
      } else if (attrVal === null) {
        return false;
      }
      rest = rest.slice(m[0].length);
    } else {
      return false;
    }
  }
  return true;
}

class MockNode {
  constructor(ownerDocument, nodeType, tagName = '') {
    this.ownerDocument = ownerDocument;
    this.nodeType = nodeType;
    this.tagName = tagName ? tagName.toUpperCase() : '';
    this.childNodes = [];
    this.parentNode = null;
    this._listeners = new Map();
    this._attrs = new Map();
    this.style = new MockStyle();
    this.classList = new MockClassList(this);
    this._className = '';
    this.dataset = {};
    this._textContent = '';
    this.hidden = false;
    this.disabled = false;
    this.checked = false;
    this.value = '';
    this.type = '';
    this.scrollTop = 0;
    this.offsetWidth = 160;
    this.offsetHeight = 120;
    this.focusCalls = 0;
  }

  get parentElement() {
    return this.parentNode && this.parentNode.nodeType === 1 ? this.parentNode : null;
  }

  get children() {
    return this.childNodes.filter((n) => n.nodeType === 1);
  }

  set id(v) {
    this.setAttribute('id', v);
  }
  get id() {
    return this.getAttribute('id') || '';
  }

  set className(v) {
    this._className = String(v || '');
    this.classList._syncFromAttr(this._className);
    this._attrs.set('class', this._className);
  }
  get className() {
    return this._className;
  }

  set textContent(v) {
    this._textContent = String(v ?? '');
    this.childNodes = [];
  }
  get textContent() {
    if (this.nodeType === 3) return this._textContent;
    if (this.childNodes.length === 0) return this._textContent;
    return this.childNodes.map((c) => c.textContent).join('');
  }

  setAttribute(name, value) {
    const str = String(value);
    this._attrs.set(name, str);
    if (name === 'class') {
      this._className = str;
      this.classList._syncFromAttr(str);
    } else if (name === 'hidden') {
      this.hidden = true;
    } else if (name === 'type') {
      this.type = str;
    } else if (name === 'value') {
      this.value = str;
    } else if (name.startsWith('data-')) {
      const camel = name.slice(5).replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
      this.dataset[camel] = str;
    }
  }

  getAttribute(name) {
    if (name === 'class') return this._className || null;
    if (name === 'hidden') return this.hidden ? '' : null;
    if (this._attrs.has(name)) return this._attrs.get(name);
    if (name.startsWith('data-')) {
      const camel = name.slice(5).replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
      if (Object.hasOwn(this.dataset, camel)) return this.dataset[camel];
    }
    return null;
  }

  removeAttribute(name) {
    this._attrs.delete(name);
    if (name === 'hidden') this.hidden = false;
    if (name.startsWith('data-')) {
      const camel = name.slice(5).replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
      delete this.dataset[camel];
    }
  }

  appendChild(child) {
    if (child.parentNode) child.remove();
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  replaceChildren(...nodes) {
    for (const c of this.childNodes) c.parentNode = null;
    this.childNodes = [];
    this._textContent = '';
    for (const n of nodes) this.appendChild(n);
  }

  remove() {
    if (!this.parentNode) return;
    this.parentNode.childNodes = this.parentNode.childNodes.filter((c) => c !== this);
    this.parentNode = null;
  }

  contains(other) {
    if (!other) return false;
    let cur = other;
    while (cur) {
      if (cur === this) return true;
      cur = cur.parentNode;
    }
    return false;
  }

  closest(selector) {
    const parts = parseSimpleSelectorParts(selector);
    let cur = this;
    while (cur && cur.nodeType === 1) {
      if (parts.some((p) => matchSingleSelector(cur, p))) return cur;
      cur = cur.parentNode;
    }
    return null;
  }

  querySelectorAll(selector) {
    const parts = parseSimpleSelectorParts(selector);
    const out = [];
    const walk = (node) => {
      for (const child of node.childNodes) {
        if (child.nodeType === 1) {
          if (parts.some((p) => matchSingleSelector(child, p))) out.push(child);
          walk(child);
          if (child.shadowRoot) walk(child.shadowRoot);
        }
      }
    };
    walk(this);
    return out;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  get options() {
    return this.children.filter((c) => c.tagName === 'OPTION');
  }

  attachShadow({ mode }) {
    const sr = new MockNode(this.ownerDocument, 11, '#shadow-root');
    sr.mode = mode;
    sr.host = this;
    sr.activeElement = null;
    this.shadowRoot = sr;
    return sr;
  }

  getBoundingClientRect() {
    return {
      left: parseFloat(this.style.left) || 100,
      top: parseFloat(this.style.top) || 80,
      width: parseFloat(this.style.width) || 820,
      height: parseFloat(this.style.height) || 620,
      right: (parseFloat(this.style.left) || 100) + (parseFloat(this.style.width) || 820),
      bottom: (parseFloat(this.style.top) || 80) + (parseFloat(this.style.height) || 620),
    };
  }

  focus() {
    this.focusCalls += 1;
    if (this.ownerDocument) this.ownerDocument.activeElement = this;
  }

  click() {
    if (this.disabled) return;
    if (this.type === 'checkbox') this.checked = !this.checked;
    this.dispatchEvent({ type: 'click', bubbles: true });
    if (this.type === 'checkbox') this.dispatchEvent({ type: 'change', bubbles: true });
  }

  addEventListener(type, fn, opts = {}) {
    if (opts?.signal?.aborted) return;
    if (!this._listeners.has(type)) this._listeners.set(type, []);
    const list = this._listeners.get(type);
    const entry = { fn, once: Boolean(opts?.once) };
    list.push(entry);
    if (opts?.signal) {
      opts.signal.addEventListener('abort', () => {
        const cur = this._listeners.get(type) || [];
        this._listeners.set(type, cur.filter((e) => e !== entry));
      }, { once: true });
    }
  }

  removeEventListener(type, fn) {
    const cur = this._listeners.get(type) || [];
    this._listeners.set(type, cur.filter((e) => e.fn !== fn));
  }

  dispatchEvent(ev) {
    const eventObj = {
      ...ev,
      target: ev.target || this,
      currentTarget: this,
      defaultPrevented: false,
      _stopped: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      stopPropagation() {
        this._stopped = true;
      },
    };
    const pathNodes = [];
    let cur = this;
    while (cur) {
      pathNodes.push(cur);
      cur = cur.parentNode || cur.host || null;
    }
    for (const node of pathNodes) {
      if (eventObj._stopped) break;
      eventObj.currentTarget = node;
      const list = [...(node._listeners.get(eventObj.type) || [])];
      for (const entry of list) {
        entry.fn.call(node, eventObj);
        if (entry.once) node.removeEventListener(eventObj.type, entry.fn);
      }
      if (!eventObj.bubbles) break;
    }
    return !eventObj.defaultPrevented;
  }
}

function createMockEnvironment({ innerWidth = 1280, innerHeight = 800, coarse = false } = {}) {
  const doc = new MockNode(null, 9, '#document');
  doc.ownerDocument = doc;
  doc.readyState = 'complete';
  doc.documentElement = new MockNode(doc, 1, 'html');
  doc.head = new MockNode(doc, 1, 'head');
  doc.body = new MockNode(doc, 1, 'body');
  doc.documentElement.appendChild(doc.head);
  doc.documentElement.appendChild(doc.body);
  doc.appendChild(doc.documentElement);
  doc.activeElement = doc.body;

  doc.createElement = (tag) => new MockNode(doc, 1, tag);
  doc.createElementNS = (_ns, tag) => new MockNode(doc, 1, tag);
  doc.createTextNode = (text) => {
    const t = new MockNode(doc, 3, '#text');
    t._textContent = String(text ?? '');
    return t;
  };
  doc.getElementById = (id) => doc.documentElement.querySelector(`#${id}`);
  doc.querySelector = (sel) => doc.documentElement.querySelector(sel);
  doc.querySelectorAll = (sel) => doc.documentElement.querySelectorAll(sel);

  // Build standard SillyTavern mount points
  const extMenu = doc.createElement('div');
  extMenu.id = 'extensionsMenu';
  doc.body.appendChild(extMenu);

  const extSettings2 = doc.createElement('div');
  extSettings2.id = 'extensions_settings2';
  doc.body.appendChild(extSettings2);

  const personaMgmt = doc.createElement('div');
  personaMgmt.id = 'PersonaManagement';
  personaMgmt.className = 'openDrawer';
  const btnBlock = doc.createElement('div');
  btnBlock.className = 'persona_controls_buttons_block buttons_block';
  personaMgmt.appendChild(btnBlock);
  doc.body.appendChild(personaMgmt);

  const winListeners = new Map();
  const dispatchedCustomEvents = [];
  const win = {
    innerWidth,
    innerHeight,
    matchMedia: (q) => ({
      matches: q.includes('coarse') ? coarse : false,
    }),
    getComputedStyle: () => ({
      color: 'rgb(34, 36, 40)',
      backgroundColor: 'rgba(245, 245, 243, 0.72)',
      getPropertyValue: (name) => {
        if (name === '--SmartThemeBlurTintColor') return 'rgba(245, 245, 243, 0.72)';
        if (name === '--SmartThemeBodyColor') return 'rgb(34, 36, 40)';
        return '';
      },
    }),
    addEventListener(type, fn, opts = {}) {
      if (opts?.signal?.aborted) return;
      if (!winListeners.has(type)) winListeners.set(type, []);
      const entry = { fn, once: Boolean(opts?.once) };
      winListeners.get(type).push(entry);
      if (opts?.signal) {
        opts.signal.addEventListener('abort', () => {
          const cur = winListeners.get(type) || [];
          winListeners.set(type, cur.filter((e) => e !== entry));
        }, { once: true });
      }
    },
    removeEventListener(type, fn) {
      const cur = winListeners.get(type) || [];
      winListeners.set(type, cur.filter((e) => e.fn !== fn));
    },
    dispatchEvent(ev) {
      dispatchedCustomEvents.push(ev);
      const list = [...(winListeners.get(ev.type) || [])];
      for (const entry of list) {
        entry.fn(ev);
        if (entry.once) win.removeEventListener(ev.type, entry.fn);
      }
      return true;
    },
    navigator: {
      clipboard: {
        copied: '',
        async writeText(txt) {
          this.copied = txt;
        },
      },
    },
  };
  doc.defaultView = win;
  return { doc, win, extMenu, extSettings2, personaMgmt, btnBlock, dispatchedCustomEvents };
}

// ============================================================================
// 1. Styles & Opaque Theme Tests
// ============================================================================

test('styles.js: color parsing, opaque compositing, theme inference & host palette', () => {
  assert.deepEqual(parseColorRgb('#191a1d'), { r: 25, g: 26, b: 29, a: 1 });
  assert.deepEqual(parseColorRgb('rgb(20 30 40 / 0.5)'), { r: 20, g: 30, b: 40, a: 0.5 });

  const solid1 = toOpaqueColor('rgba(255, 255, 255, 0.5)', '#000000');
  assert.equal(solid1, 'rgb(128, 128, 128)');
  const solid2 = toOpaqueColor('rgb(20 22 28 / 0.55)', '#191a1d');
  assert.match(solid2, /^rgb\(\d+, \d+, \d+\)$/);
  assert.equal(mixOpaqueColors('#000000', '#ffffff', 0.5), 'rgb(128, 128, 128)');

  assert.equal(inferThemeFromTextColor('rgb(240,240,240)', 'rgba(20,22,28,0.8)'), 'dark');
  assert.equal(inferThemeFromTextColor('rgb(30,30,30)', 'rgba(245,245,245,0.8)'), 'light');

  assert.equal(PALETTE_OPTIONS.length, 6);
  assert.equal(COLOR_MODE_OPTIONS.length, 3);

  const glass = resolveThemeTokens({ palette: 'glass-dark', colorMode: 'light' });
  assert.equal(glass.mode, 'dark');
  assert.equal(glass.vars['--modal-blur'], '0px');

  const hostTokens = resolveThemeTokens({
    palette: 'host',
    colorMode: 'auto',
    hostVars: {
      bodyColor: 'rgb(240, 240, 240)',
      blurBg: 'rgba(20, 22, 28, 0.45)',
    },
  });
  assert.equal(hostTokens.mode, 'dark');
  assert.match(hostTokens.vars['--ups-bg'], /^rgb\(/);
  assert.equal(hostTokens.vars['--modal-blur'], '0px');

  const { doc } = createMockEnvironment();
  const root = doc.createElement('div');
  applyThemeToRoot(root, { palette: 'host', colorMode: 'light' }, { blurBg: 'rgba(255,255,255,0.5)', bodyColor: '#222222' });
  assert.equal(root.dataset.upsThemePalette, 'host');
  assert.equal(root.classList.contains('ups-theme-light'), true);
});

test('styles.js: SHADOW_CSS contains isolation, non-blocking backdrop, 6 palettes, and 4-state rules', () => {
  assert.match(SHADOW_CSS, /:host\s*\{\s*all:\s*initial;/);
  assert.match(SHADOW_CSS, /pointer-events:\s*none;/);
  assert.match(SHADOW_CSS, /container-type:\s*inline-size;\s*container-name:\s*plugin-win;/);
  assert.match(SHADOW_CSS, /@container plugin-win \(max-width:\s*560px\)/);
  assert.match(SHADOW_CSS, /@container plugin-win \(max-width:\s*420px\)/);
  assert.match(SHADOW_CSS, /@container plugin-win \(max-width:\s*355px\)/);
  assert.match(SHADOW_CSS, /@media \(max-width:\s*640px\)/);
  assert.match(SHADOW_CSS, /env\(safe-area-inset-top/);
  assert.match(SHADOW_CSS, /env\(safe-area-inset-bottom/);
  assert.match(SHADOW_CSS, /\.ups-modal\.is-mini/);
  assert.match(SHADOW_CSS, /\.ups-modal\.is-compact-h/);
  assert.equal(/backdrop-filter:\s*blur/i.test(SHADOW_CSS), false);
  for (const p of PALETTE_OPTIONS) {
    assert.ok(SHADOW_CSS.includes(`data-ups-theme-palette="${p.id}"`), `Missing palette CSS for ${p.id}`);
  }
});

// ============================================================================
// 2. Pure Geometry & History Tests
// ============================================================================

test('ui.js: geometry clamping, drag, resize, mini-window, pill, and draft history', () => {
  const sized = clampModalSize({ width: 2000, height: 2000, viewportWidth: 1000, viewportHeight: 700 });
  assert.equal(sized.width, 960);
  assert.equal(sized.height, 644);

  const dragged = computeDraggedModalPosition({
    origLeft: 100,
    origTop: 80,
    dx: 2000,
    dy: -500,
    width: 600,
    height: 500,
    viewportWidth: 1280,
    viewportHeight: 800,
  });
  assert.equal(dragged.left, 1280 - 600 - 8);
  assert.equal(dragged.top, 8);

  const resized = computeResizedModalRect({
    origLeft: 100,
    origTop: 80,
    origWidth: 600,
    origHeight: 500,
    dx: 120,
    dy: 80,
    handle: 'se',
    viewportWidth: 1280,
    viewportHeight: 800,
  });
  assert.equal(resized.width, 720);
  assert.equal(resized.height, 580);

  const mobileMini = computeMiniWindowRect({ viewportWidth: 390, viewportHeight: 844 });
  assert.equal(mobileMini.width, 374);
  assert.ok(mobileMini.height <= 460);
  assert.ok(mobileMini.top > 300);

  const pill = computeRestorePillPosition({ pillWidth: 170, pillHeight: 36, viewportWidth: 390, viewportHeight: 844 });
  assert.ok(pill.left >= 10 && pill.left + 170 <= 390);
  assert.ok(pill.top >= 10 && pill.top + 36 <= 844);

  const hist = createDraftHistory('', 5);
  assert.equal(hist.canUndo(), false);
  hist.push('A');
  hist.push('A'); // dedup
  hist.push('B');
  assert.equal(hist.canUndo(), true);
  assert.equal(hist.undo(), 'A');
  assert.equal(hist.redo(), 'B');
  hist.reset('C');
  assert.equal(hist.getValue(), 'C');
  assert.equal(hist.canUndo(), false);
});

// ============================================================================
// 3. UI Component Integration, Event Isolation, Mobile No-Focus & Flows
// ============================================================================

test('ui.js: Shadow DOM structure, bubble stopPropagation, spellcheck, mobile no-focus, and full flows', async () => {
  const env = createMockEnvironment({ innerWidth: 390, innerHeight: 844, coarse: true });
  const savedSettingsCalls = [];
  const savedPersonas = [];
  const downloads = [];
  env.doc.createElement_orig = env.doc.createElement;
  env.win.Blob = class MockBlob {
    constructor(parts) {
      this.text = parts.join('');
    }
  };
  env.win.URL = {
    createObjectURL: (blob) => {
      downloads.push(blob.text);
      return 'blob:mock-1';
    },
    revokeObjectURL: () => {},
  };

  let activePersonaDesc = '## 人物本体核\n[外显可感知] 语速平稳，袖口有轻微粉笔灰。\n\n## 当前剧场壳\n[既有共识 / 开场起点] 在图书室值晚班。';
  const ui = createStudioUI({
    doc: env.doc,
    win: env.win,
    mountTarget: env.doc.body,
    onSaveSettings: async (s) => {
      savedSettingsCalls.push(s);
    },
    hostApi: {
      getActivePersona: async () => ({ avatarId: 'u1.png', name: '林清', description: activePersonaDesc, lorebook: '' }),
      listPersonas: async () => [{ avatarId: 'u1.png', name: '林清', description: activePersonaDesc, isActive: true }],
      getActiveCharacterContext: async () => ({ name: '沈听澜', worldName: '海站设定集', description: '观测站同伴' }),
      savePersonaToHost: async (payload) => {
        savedPersonas.push(payload);
        return { avatarId: 'u2.png', name: payload.name, mode: payload.mode };
      },
      saveSupplementaryWorldbook: async (wb) => ({ worldName: wb.worldName, entryCount: wb.entries.length }),
      runStudioGeneration: async ({ messages }) => {
        const promptJoined = messages.map((m) => m.content).join('\n');
        if (promptJoined.includes('重生成')) {
          return { text: '## 当前剧场壳\n[外显可感知] 随身带着旧铜笔和防风记录册。', source: 'mock' };
        }
        return {
          text: '## 人物本体核\n[外显可感知] 声线平稳，习惯先看门窗气压表。\n\n## 当前剧场壳\n[既有共识 / 开场起点] 今夜与同伴值守。',
          source: 'mock',
        };
      },
      fetchCustomModels: async () => ['mock-model-a', 'mock-model-b'],
      testCustomConnection: async () => ({ ok: true, latencyMs: 12, modelCount: 2, message: 'OK' }),
    },
  });

  // Track if any mousedown/touchstart/click reaches <html> when interacting inside Shadow DOM
  let htmlTriggered = 0;
  env.doc.documentElement.addEventListener('mousedown', () => { htmlTriggered += 1; });
  env.doc.documentElement.addEventListener('touchstart', () => { htmlTriggered += 1; });
  env.doc.documentElement.addEventListener('click', () => { htmlTriggered += 1; });

  ui.open();
  assert.equal(ui.getState().isOpen, true);

  const sr = ui.shadow;
  // Mobile open must NOT auto-focus any input/textarea
  const inputs = sr.querySelectorAll('input, textarea');
  for (const inp of inputs) {
    assert.equal(inp.getAttribute('spellcheck'), 'false');
    assert.equal(inp.focusCalls, 0);
  }

  // Bubble isolation check on window, popover, pill
  const winEl = sr.querySelector('[data-ups-window]');
  winEl.dispatchEvent({ type: 'mousedown', bubbles: true });
  winEl.dispatchEvent({ type: 'touchstart', bubbles: true });
  winEl.dispatchEvent({ type: 'click', bubbles: true });
  assert.equal(htmlTriggered, 0);

  // Minimize -> capsule pill -> restore preserves draft
  const draftEl = sr.querySelector('[data-ups-draft]');
  draftEl.value = '保留草稿内容';
  draftEl.dispatchEvent({ type: 'input', bubbles: true });
  sr.querySelector('[data-ups-minimize]').click();
  assert.equal(ui.getState().minimized, true);
  const pillEl = sr.querySelector('[data-ups-pill]');
  pillEl.dispatchEvent({ type: 'mousedown', bubbles: true });
  pillEl.click();
  assert.equal(htmlTriggered, 0);
  assert.equal(ui.getState().minimized, false);
  assert.equal(draftEl.value, '保留草稿内容');

  // Mini-window toggle does not overwrite normal geometry
  const prevGeo = { ...ui.getState().settings.ui.geometry };
  ui.toggleMini();
  assert.equal(ui.getState().miniMode, true);
  assert.deepEqual(ui.getState().settings.ui.geometry, prevGeo);
  ui.toggleMini();
  assert.equal(ui.getState().miniMode, false);

  // Mode A generation
  sr.querySelector('[data-ups-inspiration]').value = '夜班气象记录员';
  sr.querySelector('[data-ups-generate]').click();
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(draftEl.value.includes('人物本体核'));

  // Mode B load + refactor + taste extraction
  sr.querySelector('[data-ups-mode="B"]').click();
  sr.querySelector('[data-ups-load-persona]').click();
  await new Promise((r) => setTimeout(r, 20));
  sr.querySelector('[data-ups-generate-b]').click();
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(sr.querySelector('[data-ups-diff-view]').hidden === false);

  // Modify draft & extract taste candidates
  draftEl.value = `${draftEl.value}\n习惯在值班表背面记下风速`;
  draftEl.dispatchEvent({ type: 'input', bubbles: true });
  sr.querySelector('[data-ups-extract-taste]').click();
  sr.querySelector('[data-ups-confirm-taste]').click();
  assert.ok(ui.getState().settings.tasteProfile.anchors.some((a) => a.text.includes('值班表背面')));

  // Export ST native preset JSON
  sr.querySelector('[data-ups-export-preset]').click();
  assert.equal(downloads.length, 1);
  const exported = JSON.parse(downloads[0]);
  assert.ok(exported.prompts.some((p) => p.identifier === 'personaDescription'));

  // Tab 4 Custom API profile create, mask, fetch models auto-select, 2-step delete
  sr.querySelector('[data-ups-tab="settings"]').click();
  const prov = sr.querySelector('[data-ups-provider]');
  prov.value = 'custom';
  prov.dispatchEvent({ type: 'change', bubbles: true });
  sr.querySelector('[data-ups-profile-name]').value = '测试通道';
  sr.querySelector('[data-ups-profile-create]').click();
  const urlEl = sr.querySelector('[data-ups-api-url]');
  urlEl.value = 'https://api.example.com/v1';
  urlEl.dispatchEvent({ type: 'input', bubbles: true });
  const keyEl = sr.querySelector('[data-ups-api-key]');
  assert.equal(keyEl.type, 'password');
  keyEl.value = 'sk-mock-00001234';
  keyEl.dispatchEvent({ type: 'input', bubbles: true });
  assert.match(sr.querySelector('[data-ups-api-key-mask]').textContent, /••••.*1234/);
  sr.querySelector('[data-ups-fetch-models]').click();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(ui.getState().settings.api.profiles[0].model, 'mock-model-a');

  // First click on delete arms inline confirmation without immediately deleting
  sr.querySelector('[data-ups-profile-delete]').click();
  assert.equal(ui.getState().settings.api.profiles.length, 1);

  ui.destroy();
  assert.equal(env.doc.getElementById('user-persona-studio-host'), null);
});

// ============================================================================
// 4. Entry Lifecycle, ST EventEmitter removeListener & Pagehide Cleanup Tests
// ============================================================================

test('index.js: mounts host anchors, stops drawer collapse, refreshes on CHAT_CHANGED, cleans up via removeListener on pagehide', async () => {
  const env = createMockEnvironment();
  const removedListeners = [];
  const listeners = new Map();
  const mockEventSource = {
    on(ev, fn) {
      if (!listeners.has(ev)) listeners.set(ev, new Set());
      listeners.get(ev).add(fn);
    },
    emit(ev, ...args) {
      for (const fn of listeners.get(ev) || []) fn(...args);
    },
    // Deliberately omit .off() to match SillyTavern public/lib/eventemitter.js
    removeListener(ev, fn) {
      removedListeners.push(ev);
      listeners.get(ev)?.delete(fn);
    },
  };

  const slashCommands = {};
  let personaRefreshCount = 0;
  const mockCtx = {
    extensionSettings: {},
    powerUser: { personas: { 'u1.png': '林清' }, persona_descriptions: { 'u1.png': { description: '旧描述' } } },
    eventSource: mockEventSource,
    eventTypes: { APP_READY: 'app_ready', CHAT_CHANGED: 'chat_changed' },
    SlashCommandParser: {
      commands: slashCommands,
      addCommandObject(cmd) {
        slashCommands[cmd.name] = cmd;
      },
    },
    SlashCommand: { fromProps: (p) => p },
  };

  let drawerDismissed = false;
  env.doc.documentElement.addEventListener('mousedown', () => { drawerDismissed = true; });
  env.doc.documentElement.addEventListener('touchstart', () => { drawerDismissed = true; });

  const ctrl = await mountStudioForTest({
    doc: env.doc,
    win: env.win,
    skipCssRefresh: true,
    hostDeps: { context: mockCtx },
    hostApi: {
      getActivePersona: async () => {
        personaRefreshCount += 1;
        return { avatarId: 'u1.png', name: '林清', description: '旧描述' };
      },
      listPersonas: async () => [],
      getActiveCharacterContext: async () => null,
    },
  });

  assert.ok(env.doc.getElementById('ups-wand-entry'));
  assert.ok(env.doc.getElementById('ups-ext-settings'));
  const personaBtn = env.doc.querySelector('[data-ups-persona-btn]');
  assert.ok(personaBtn);
  assert.ok(slashCommands.ups);

  // Clicking persona launch button must NOT bubble to html to collapse .openDrawer
  personaBtn.dispatchEvent({ type: 'mousedown', bubbles: true });
  personaBtn.dispatchEvent({ type: 'touchstart', bubbles: true });
  personaBtn.click();
  assert.equal(drawerDismissed, false);
  assert.equal(ctrl.getState().isOpen, true);

  // CHAT_CHANGED triggers refreshContext
  const beforeRefresh = personaRefreshCount;
  mockEventSource.emit('chat_changed');
  await new Promise((r) => setTimeout(r, 15));
  assert.ok(personaRefreshCount > beforeRefresh);

  // pagehide triggers full teardown
  env.win.dispatchEvent({ type: 'pagehide' });
  assert.equal(env.doc.getElementById('ups-wand-entry'), null);
  assert.equal(env.doc.getElementById('ups-ext-settings'), null);
  assert.equal(env.doc.querySelector('[data-ups-persona-btn]'), null);
  assert.equal(env.doc.getElementById('user-persona-studio-host'), null);
  assert.equal(slashCommands.ups, undefined);
  assert.deepEqual(removedListeners.sort(), ['app_ready', 'chat_changed']);
});

test('index.js: refreshExtensionStylesheet updates versioned link without duplicating', () => {
  const env = createMockEnvironment();
  const link = env.doc.createElement('link');
  link.setAttribute('rel', 'stylesheet');
  link.setAttribute('href', '/scripts/extensions/third-party/user-persona-studio/style.css');
  env.doc.head.appendChild(link);

  const swapped = refreshExtensionStylesheet(env.doc, '1.0.0');
  assert.equal(swapped, true);
  const links = env.doc.head.querySelectorAll('link[rel="stylesheet"]');
  assert.equal(links.length, 2);
  assert.match(links[1].getAttribute('href'), /\?v=1\.0\.0$/);

  const secondCall = refreshExtensionStylesheet(env.doc, '1.0.0');
  assert.equal(secondCall, false);
});

// ============================================================================
// 5. M3 Iter 2 Regression Tests (Tab 2 Menu, Section Regen, Custom API, Edge Cases)
// ============================================================================

test('ui.js regression: Tab 2 ··· floating menu stays open and executes move/expand/delete + ups-hide-xs', () => {
  const env = createMockEnvironment({ innerWidth: 390, innerHeight: 844, coarse: true });
  const ui = createStudioUI({ doc: env.doc, win: env.win, mountTarget: env.doc.body });
  ui.open();
  ui.switchTab('presets');

  const sr = ui.shadow;
  const expandBtns = sr.querySelectorAll('[data-ups-expand-btn]');
  assert.ok(expandBtns.length >= 2);
  assert.equal(expandBtns[0].classList.contains('ups-hide-xs'), true);

  const schemeId = ui.getState().settings.activeSchemeId;
  const getEntryIds = () => ui.getState().settings.schemes.find((s) => s.id === schemeId).entries.map((e) => e.id);
  const initialIds = getEntryIds();

  // Clicking second entry's ··· button keeps floatingMenuEl open and allows moving up
  const moreBtns = sr.querySelectorAll('.ups-more-btn');
  moreBtns[1].click();
  const menuEl = sr.querySelector('[data-ups-floating-menu]');
  assert.equal(menuEl.hidden, false);
  const items = menuEl.querySelectorAll('.ups-menu-item');
  assert.equal(items.length, 4);
  const moveUpBtn = items.find((b) => b.textContent === '上移一位');
  assert.ok(moveUpBtn && !moveUpBtn.disabled);
  moveUpBtn.click();
  assert.equal(menuEl.hidden, true);
  assert.equal(getEntryIds()[0], initialIds[1]);
  assert.equal(getEntryIds()[1], initialIds[0]);

  // Move back down via first entry's ··· menu
  sr.querySelectorAll('.ups-more-btn')[0].click();
  assert.equal(menuEl.hidden, false);
  menuEl.querySelectorAll('.ups-menu-item').find((b) => b.textContent === '下移一位').click();
  assert.deepEqual(getEntryIds(), initialIds);

  // Expand details via ··· menu
  sr.querySelectorAll('.ups-more-btn')[0].click();
  menuEl.querySelectorAll('.ups-menu-item').find((b) => b.textContent === '展开详情').click();
  assert.ok(sr.querySelector('.ups-entry-editor'));

  // Add a custom entry and delete it via ··· menu
  const addBtn = sr.querySelector('[data-ups-tab-panel="presets"]').querySelectorAll('button').find((b) => b.textContent === '+ 新增条目');
  addBtn.click();
  const afterAddIds = getEntryIds();
  assert.equal(afterAddIds.length, initialIds.length + 1);
  const lastMoreBtn = sr.querySelectorAll('.ups-more-btn').at(-1);
  lastMoreBtn.click();
  assert.equal(menuEl.hidden, false);
  const delBtn = menuEl.querySelectorAll('.ups-menu-item').find((b) => b.textContent === '删除条目');
  assert.ok(delBtn && !delBtn.disabled);
  delBtn.click();
  assert.deepEqual(getEntryIds(), initialIds);

  ui.destroy();
});

test('ui.js regression: Mode A & Mode B local section regeneration sends targetSection and live draft', async () => {
  const env = createMockEnvironment({ innerWidth: 1280, innerHeight: 800 });
  const capturedPrompts = [];
  const ui = createStudioUI({
    doc: env.doc,
    win: env.win,
    mountTarget: env.doc.body,
    hostApi: {
      getActivePersona: async () => ({ avatarId: 'u1.png', name: '测试角色', description: '旧原稿' }),
      listPersonas: async () => [],
      getActiveCharacterContext: async () => null,
      runStudioGeneration: async ({ messages }) => {
        capturedPrompts.push(messages.map((m) => m.content).join('\n'));
        return { text: '## 当前剧场壳\n重生成后的剧场壳内容。', source: 'mock' };
      },
    },
  });

  ui.open();
  const sr = ui.shadow;
  const draftEl = sr.querySelector('[data-ups-draft]');
  const regenBtn = sr.querySelector('[data-ups-regen-section]');
  const sectionSel = sr.querySelector('[aria-label="选择重生成分段"]');

  // Mode A section regeneration
  draftEl.value = '## 人物本体核\nModeA本体核内容\n\n## 当前剧场壳\nModeA旧剧场壳';
  draftEl.dispatchEvent({ type: 'input', bubbles: true });
  sectionSel.value = '当前剧场壳';
  regenBtn.click();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(capturedPrompts.length, 1);
  assert.match(capturedPrompts[0], /局部重生成目标小节/);
  assert.match(capturedPrompts[0], /当前剧场壳/);
  assert.match(capturedPrompts[0], /ModeA本体核内容/);
  assert.match(draftEl.value, /ModeA本体核内容/);
  assert.match(draftEl.value, /重生成后的剧场壳内容/);

  // Mode B section regeneration must read live draftTextarea rather than stale existingDraftInput
  sr.querySelector('[data-ups-mode="B"]').click();
  const existingEl = sr.querySelector('[data-ups-existing-draft]');
  existingEl.value = '## 人物本体核\n陈旧未改原稿\n\n## 当前剧场壳\n陈旧剧场壳';
  draftEl.value = '## 人物本体核\n实时编辑新本体核\n\n## 当前剧场壳\n实时编辑旧剧场壳';
  draftEl.dispatchEvent({ type: 'input', bubbles: true });
  sectionSel.value = '当前剧场壳';
  regenBtn.click();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(capturedPrompts.length, 2);
  assert.match(capturedPrompts[1], /局部重生成目标小节/);
  assert.match(capturedPrompts[1], /实时编辑新本体核/);
  assert.equal(capturedPrompts[1].includes('陈旧未改原稿'), false);

  ui.destroy();
});

test('ui.js regression: empty profiles preserves Custom API inputs, clears stale fetchedModels/name, scrubs error, and keeps blank temp/topP as null', async () => {
  const env = createMockEnvironment({ innerWidth: 1280, innerHeight: 800 });
  const ui = createStudioUI({
    doc: env.doc,
    win: env.win,
    mountTarget: env.doc.body,
    hostApi: {
      getActivePersona: async () => null,
      listPersonas: async () => [],
      getActiveCharacterContext: async () => null,
      fetchCustomModels: async () => ['model-alpha', 'model-beta'],
      testCustomConnection: async (profile) => ({
        ok: false,
        latencyMs: 10,
        modelCount: 0,
        message: `Unauthorized key ${profile.apiKey}`,
      }),
    },
  });

  ui.open();
  ui.switchTab('settings');
  const sr = ui.shadow;
  const prov = sr.querySelector('[data-ups-provider]');
  prov.value = 'custom';
  prov.dispatchEvent({ type: 'change', bubbles: true });

  // Typing directly into empty-profiles inputs must NOT wipe typed values
  const urlIn = sr.querySelector('[data-ups-api-url]');
  urlIn.value = 'https://api.example.com/v1';
  urlIn.dispatchEvent({ type: 'input', bubbles: true });
  assert.equal(urlIn.value, 'https://api.example.com/v1');
  assert.equal(ui.getState().settings.api.profiles[0]?.baseUrl, 'https://api.example.com/v1');

  const keyIn = sr.querySelector('[data-ups-api-key]');
  keyIn.value = 'sk-mock-secret-9999';
  keyIn.dispatchEvent({ type: 'input', bubbles: true });
  assert.equal(keyIn.value, 'sk-mock-secret-9999');

  const modelIn = sr.querySelector('[data-ups-api-model]');
  modelIn.value = 'custom-model-1';
  modelIn.dispatchEvent({ type: 'input', bubbles: true });
  assert.equal(modelIn.value, 'custom-model-1');

  // Blank apiTempInput / apiTopPInput -> null (not 0), while explicit '0' -> 0
  const settingsNums = sr.querySelector('[data-ups-tab-panel="settings"]').querySelectorAll('input[type="number"]');
  const tempIn = settingsNums[0];
  const topPIn = settingsNums[2];
  tempIn.value = '0.7';
  tempIn.dispatchEvent({ type: 'change', bubbles: true });
  assert.equal(ui.getState().settings.api.profiles[0].temperature, 0.7);
  tempIn.value = '';
  tempIn.dispatchEvent({ type: 'change', bubbles: true });
  assert.equal(ui.getState().settings.api.profiles[0].temperature, null);
  tempIn.value = '0';
  tempIn.dispatchEvent({ type: 'change', bubbles: true });
  assert.equal(ui.getState().settings.api.profiles[0].temperature, 0);

  topPIn.value = '0.9';
  topPIn.dispatchEvent({ type: 'change', bubbles: true });
  assert.equal(ui.getState().settings.api.profiles[0].topP, 0.9);
  topPIn.value = '';
  topPIn.dispatchEvent({ type: 'change', bubbles: true });
  assert.equal(ui.getState().settings.api.profiles[0].topP, null);

  // Defensive scrubbing of testCustomConnection message
  sr.querySelector('[data-ups-test-conn]').click();
  await new Promise((r) => setTimeout(r, 20));
  const connStatus = sr.querySelector('[data-ups-conn-status]');
  assert.equal(connStatus.textContent.includes('sk-mock-secret-9999'), false);
  assert.match(connStatus.textContent, /\[已脱敏\]/);

  // Fetch models -> visible dropdown -> create new profile clears fetchedModels
  sr.querySelector('[data-ups-fetch-models]').click();
  await new Promise((r) => setTimeout(r, 20));
  const modelSel = sr.querySelector('[aria-label="已拉取模型列表"]');
  assert.equal(modelSel.hidden, false);

  const profileNameIn = sr.querySelector('[data-ups-profile-name]');
  profileNameIn.value = '新方案B';
  sr.querySelector('[data-ups-profile-create]').click();
  assert.equal(modelSel.hidden, true);

  // Fetch again on B, then delete both profiles -> fetchedModels & profileNameInput cleared
  sr.querySelector('[data-ups-fetch-models]').click();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(modelSel.hidden, false);

  const delBtn = sr.querySelector('[data-ups-profile-delete]');
  const confirmDelBtn = sr.querySelector('[data-ups-tab-panel="settings"]').querySelectorAll('button').find((b) => b.textContent === '确认删除');
  delBtn.click();
  confirmDelBtn.click();
  assert.equal(modelSel.hidden, true);
  delBtn.click();
  confirmDelBtn.click();
  assert.equal(ui.getState().settings.api.profiles.length, 0);
  assert.equal(modelSel.hidden, true);
  assert.equal(profileNameIn.value, '');

  ui.destroy();
});

test('ui.js regression: miniBtn label syncs on setSettings and open', () => {
  const env = createMockEnvironment({ innerWidth: 1280, innerHeight: 800 });
  const ui = createStudioUI({ doc: env.doc, win: env.win, mountTarget: env.doc.body });
  const miniBtn = ui.shadow.querySelector('[data-ups-mini]');
  const modalEl = ui.shadow.querySelector('[data-ups-window]');

  ui.setSettings({ ui: { miniMode: true } });
  assert.equal(ui.getState().miniMode, true);
  assert.equal(miniBtn.textContent, '还原');
  ui.open();
  assert.equal(miniBtn.textContent, '还原');
  assert.equal(modalEl.classList.contains('is-mini'), true);

  ui.setSettings({ ui: { miniMode: false } });
  assert.equal(ui.getState().miniMode, false);
  assert.equal(miniBtn.textContent, '小窗');
  assert.equal(modalEl.classList.contains('is-mini'), false);

  ui.destroy();
});

test('ui.js & styles.js regression: tiny viewport mini rect, zero-size clampModalSize, and CSS4 percentage RGB', () => {
  const tinyMini = computeMiniWindowRect({ viewportWidth: 240, viewportHeight: 300 });
  assert.ok(tinyMini.left >= 0);
  assert.ok(tinyMini.width <= 240 - 16);
  assert.ok(tinyMini.left + tinyMini.width <= 240);

  const zeroSized = clampModalSize({ width: 0, height: 0, viewportWidth: 1280, viewportHeight: 800 });
  assert.equal(zeroSized.width, 320);
  assert.equal(zeroSized.height, 280);

  assert.deepEqual(parseColorRgb('rgb(100% 50% 0% / 0.5)'), { r: 255, g: 128, b: 0, a: 0.5 });
});

test('ui.js regression: Mode B preserves original-vs-optimized diff while tasteBaselineDraft tracks AI draft & section regen', async () => {
  const env = createMockEnvironment({ innerWidth: 1280, innerHeight: 800 });
  const originalPersona = '## 人物本体核\n旧人设：习惯早起散步。\n\n## 当前剧场壳\n旧剧场：城南旧书店学徒。';
  const ui = createStudioUI({
    doc: env.doc,
    win: env.win,
    mountTarget: env.doc.body,
    hostApi: {
      getActivePersona: async () => ({ avatarId: 'u1.png', name: '林清', description: originalPersona }),
      listPersonas: async () => [{ avatarId: 'u1.png', name: '林清', description: originalPersona, isActive: true }],
      getActiveCharacterContext: async () => null,
      runStudioGeneration: async ({ messages }) => {
        const joined = messages.map((m) => m.content).join('\n');
        if (joined.includes('局部重生成目标小节')) {
          return { text: '## 当前剧场壳\n新剧场：在气象站值夜班。\n习惯用红笔标注气压突变。', source: 'mock' };
        }
        return {
          text: '## 人物本体核\n声线平稳，习惯先看门窗气压表。\n\n## 当前剧场壳\n新剧场：在气象站值白班。',
          source: 'mock',
        };
      },
    },
  });

  ui.open();
  const sr = ui.shadow;
  sr.querySelector('[data-ups-mode="B"]').click();
  sr.querySelector('[data-ups-load-persona]').click();
  await new Promise((r) => setTimeout(r, 20));
  sr.querySelector('[data-ups-generate-b]').click();
  await new Promise((r) => setTimeout(r, 20));

  // Original-vs-optimized diff still compares against pre-AI originalPersona
  const diffView = sr.querySelector('[data-ups-diff-view]');
  assert.equal(diffView.hidden, false);
  assert.ok(diffView.textContent.includes('旧人设：习惯早起散步'));

  // Run local section regeneration on 当前剧场壳
  const sectionSel = sr.querySelector('[aria-label="选择重生成分段"]');
  sectionSel.value = '当前剧场壳';
  sr.querySelector('[data-ups-regen-section]').click();
  await new Promise((r) => setTimeout(r, 20));

  // User deletes AI-generated phrase from section regen and adds a new anchor
  const draftEl = sr.querySelector('[data-ups-draft]');
  assert.ok(draftEl.value.includes('习惯用红笔标注气压突变'));
  draftEl.value = draftEl.value.replace('习惯用红笔标注气压突变。', '随身带一只旧黄铜怀表。');
  draftEl.dispatchEvent({ type: 'input', bubbles: true });

  sr.querySelector('[data-ups-extract-taste]').click();
  sr.querySelector('[data-ups-confirm-taste]').click();

  const taste = ui.getState().settings.tasteProfile;
  assert.ok(taste.banned.some((b) => b.text.includes('习惯用红笔标注气压突变')));
  assert.ok(taste.anchors.some((a) => a.text.includes('随身带一只旧黄铜怀表')));
  // Original-vs-optimized diff remains intact
  assert.ok(diffView.textContent.includes('旧人设：习惯早起散步'));

  ui.destroy();
});

test('ui.js regression: fetchModels and testConn use independent AbortControllers and both abort on destroy', async () => {
  const env = createMockEnvironment({ innerWidth: 1280, innerHeight: 800 });
  const signals = { fetch: null, test: null };
  let resolveFetch = null;
  let resolveTest = null;

  const ui = createStudioUI({
    doc: env.doc,
    win: env.win,
    mountTarget: env.doc.body,
    hostApi: {
      getActivePersona: async () => null,
      listPersonas: async () => [],
      getActiveCharacterContext: async () => null,
      fetchCustomModels: (_profile, sig) => {
        signals.fetch = sig;
        return new Promise((resolve) => {
          resolveFetch = resolve;
        });
      },
      testCustomConnection: (_profile, sig) => {
        signals.test = sig;
        return new Promise((resolve) => {
          resolveTest = resolve;
        });
      },
    },
  });

  ui.open();
  ui.switchTab('settings');
  const sr = ui.shadow;
  const prov = sr.querySelector('[data-ups-provider]');
  prov.value = 'custom';
  prov.dispatchEvent({ type: 'change', bubbles: true });
  const urlIn = sr.querySelector('[data-ups-api-url]');
  urlIn.value = 'https://api.example.com/v1';
  urlIn.dispatchEvent({ type: 'input', bubbles: true });

  sr.querySelector('[data-ups-fetch-models]').click();
  sr.querySelector('[data-ups-test-conn]').click();
  assert.ok(signals.fetch && signals.test);
  assert.equal(signals.fetch.aborted, false);
  assert.equal(signals.test.aborted, false);

  resolveFetch(['mock-model-z']);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(ui.getState().settings.api.profiles[0].model, 'mock-model-z');
  assert.equal(signals.test.aborted, false);

  ui.destroy();
  assert.equal(signals.test.aborted, true);
  resolveTest({ ok: false, latencyMs: 0, modelCount: 0, message: '已取消生成' });
});

test('ui.js regression: re-clicking fetchModels aborts prior pending call without clobbering in-flight status', async () => {
  const env = createMockEnvironment({ innerWidth: 1280, innerHeight: 800 });
  const calls = [];
  let resolveSecond = null;

  const ui = createStudioUI({
    doc: env.doc,
    win: env.win,
    mountTarget: env.doc.body,
    hostApi: {
      getActivePersona: async () => null,
      listPersonas: async () => [],
      getActiveCharacterContext: async () => null,
      fetchCustomModels: (_profile, sig) => {
        const idx = calls.length;
        calls.push({ sig });
        if (idx === 0) {
          return new Promise((_resolve, reject) => {
            sig.addEventListener(
              'abort',
              () => {
                const err = new Error('已取消生成');
                err.name = 'AbortError';
                err.code = 'ABORTED';
                reject(err);
              },
              { once: true }
            );
          });
        }
        return new Promise((resolve) => {
          resolveSecond = resolve;
        });
      },
    },
  });

  ui.open();
  ui.switchTab('settings');
  const sr = ui.shadow;
  const prov = sr.querySelector('[data-ups-provider]');
  prov.value = 'custom';
  prov.dispatchEvent({ type: 'change', bubbles: true });
  const urlIn = sr.querySelector('[data-ups-api-url]');
  urlIn.value = 'https://api.example.com/v1';
  urlIn.dispatchEvent({ type: 'input', bubbles: true });

  const fetchBtn = sr.querySelector('[data-ups-fetch-models]');
  const connStatus = sr.querySelector('[data-ups-conn-status]');

  fetchBtn.click();
  assert.equal(calls.length, 1);
  assert.equal(connStatus.textContent, '正在拉取模型…');

  // Re-click while first request is still pending -> aborts first, keeps status as '正在拉取模型…'
  fetchBtn.click();
  assert.equal(calls.length, 2);
  assert.equal(calls[0].sig.aborted, true);
  assert.equal(calls[1].sig.aborted, false);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(connStatus.textContent, '正在拉取模型…');

  // Complete second request
  resolveSecond(['model-fresh']);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(connStatus.textContent, '已拉取 1 个模型');
  assert.equal(ui.getState().settings.api.profiles[0].model, 'model-fresh');

  ui.destroy();
});

// ============================================================================
// 6. Static Security & Hygiene Self-Check on M3 Files
// ============================================================================

test('M3 files contain zero unsafe DOM/XSS sinks', () => {
  const jsFiles = ['src/styles.js', 'src/ui.js', 'index.js'];
  for (const rel of jsFiles) {
    const src = fs.readFileSync(path.join(ROOT_DIR, rel), 'utf8');
    assert.equal(/\.innerHTML\s*=/.test(src), false, `${rel} must not use innerHTML`);
    assert.equal(/\.outerHTML\s*=/.test(src), false, `${rel} must not use outerHTML`);
    assert.equal(/\.insertAdjacentHTML\s*\(/.test(src), false, `${rel} must not use insertAdjacentHTML`);
    assert.equal(/\bdocument\.write\s*\(/.test(src), false, `${rel} must not use document.write`);
    assert.equal(/\beval\s*\(/.test(src), false, `${rel} must not use eval`);
    assert.equal(/\bnew\s+Function\s*\(/.test(src), false, `${rel} must not use new Function`);
  }
});

// ============================================================================
// 7. Tier 5 Adversarial Hardening Tests (Gaps 1–4, 6–8, 11–12)
// ============================================================================

test('Tier 5 | Gap 1: testConnBtn handles rejected testCustomConnection without unhandledRejection and scrubs API key', async () => {
  const env = createMockEnvironment({ innerWidth: 1280, innerHeight: 800 });
  const unhandled = [];
  const onUnhandled = (reason) => unhandled.push(reason);
  process.on('unhandledRejection', onUnhandled);

  try {
    const ui = createStudioUI({
      doc: env.doc,
      win: env.win,
      mountTarget: env.doc.body,
      hostApi: {
        getActivePersona: async () => null,
        listPersonas: async () => [],
        getActiveCharacterContext: async () => null,
        testCustomConnection: async (profile) => {
          throw new Error(`Network boom with key ${profile.apiKey}`);
        },
      },
    });

    ui.open();
    ui.switchTab('settings');
    const sr = ui.shadow;
    const prov = sr.querySelector('[data-ups-provider]');
    prov.value = 'custom';
    prov.dispatchEvent({ type: 'change', bubbles: true });

    const keyIn = sr.querySelector('[data-ups-api-key]');
    keyIn.value = 'sk-mock-reject-leak-4321';
    keyIn.dispatchEvent({ type: 'input', bubbles: true });

    sr.querySelector('[data-ups-test-conn]').click();
    await new Promise((r) => setTimeout(r, 30));

    const connStatus = sr.querySelector('[data-ups-conn-status]');
    assert.match(connStatus.textContent, /^连接异常：/);
    assert.equal(connStatus.textContent.includes('sk-mock-reject-leak-4321'), false);
    assert.match(connStatus.textContent, /\[已脱敏\]/);
    assert.deepEqual(unhandled, []);
    ui.destroy();
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
});

test('Tier 5 | Gap 2 & Gap 12: drawer .inline-drawer-content has no display:flex override; drawer checkboxes route via onSaveSettings; slash teardown', async () => {
  const env = createMockEnvironment();
  const saveCalls = [];
  let unregistered = '';
  const mockCtx = {
    extensionSettings: {},
    powerUser: { personas: {}, persona_descriptions: {} },
    registerSlashCommand: () => {},
    unregisterSlashCommand: (name) => {
      unregistered = name;
    },
  };

  const ctrl = await mountStudioForTest({
    doc: env.doc,
    win: env.win,
    skipCssRefresh: true,
    hostDeps: { context: mockCtx },
    onSaveSettings: async (next) => {
      saveCalls.push({
        showPersonaBtn: next.ui.showPersonaBtn,
        showWandMenu: next.ui.showWandMenu,
      });
    },
    hostApi: {
      getActivePersona: async () => null,
      listPersonas: async () => [],
      getActiveCharacterContext: async () => null,
    },
  });

  const drawerContent = env.doc.getElementById('ups-ext-settings').querySelector('.inline-drawer-content');
  assert.ok(drawerContent);
  assert.equal(drawerContent.classList.contains('ups-ext-drawer-body'), false);
  const innerBody = drawerContent.querySelector('.ups-ext-drawer-body');
  assert.ok(innerBody);

  const styleCss = fs.readFileSync(path.join(ROOT_DIR, 'style.css'), 'utf8');
  assert.equal(/\.inline-drawer-content\s*\{[^}]*display\s*:\s*flex/.test(styleCss), false);

  const checkboxes = innerBody.querySelectorAll('input[type="checkbox"]');
  assert.equal(checkboxes.length, 2);
  checkboxes[0].click();
  checkboxes[1].click();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(saveCalls.length, 2);
  assert.equal(saveCalls[0].showPersonaBtn, false);
  assert.equal(saveCalls[1].showWandMenu, false);

  ctrl.destroy();
  assert.equal(unregistered, 'ups');
});

test('Tier 5 | Gap 3: saveCurrentPersona preserves lorebook before refresh, avoids inheriting on create, and binds dual-layer worldbook before ups:persona-saved', async () => {
  // (a) Overwrite before refreshContext resolves must NOT wipe existing lorebook
  const envA = createMockEnvironment({ innerWidth: 1280, innerHeight: 800 });
  const callsA = [];
  let resolveSlowPersona;
  const uiA = createStudioUI({
    doc: envA.doc,
    win: envA.win,
    mountTarget: envA.doc.body,
    hostApi: {
      getActivePersona: () =>
        new Promise((resolve) => {
          resolveSlowPersona = resolve;
        }),
      listPersonas: async () => [],
      getActiveCharacterContext: async () => null,
      savePersonaToHost: async (payload) => {
        callsA.push(payload);
        return { avatarId: 'u1.png', name: payload.name, lorebook: payload.lorebook ?? 'existing_wb' };
      },
      saveSupplementaryWorldbook: async () => ({ worldName: 'wb', entryCount: 0 }),
    },
  });

  uiA.open();
  const draftA = uiA.shadow.querySelector('[data-ups-draft]');
  draftA.value = '新写正文';
  uiA.shadow.querySelector('[data-ups-save-overwrite]').click();
  // Resolve getActivePersona returning null (simulating unavailable cache) -> lorebook must be undefined, NOT ''
  resolveSlowPersona(null);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(callsA.length, 1);
  assert.equal(callsA[0].mode, 'overwrite');
  assert.equal(callsA[0].lorebook, undefined);
  uiA.destroy();

  // (b) Create with dualLayer=false does NOT inherit old lorebook; create with dualLayer=true saves worldbook BEFORE savePersonaToHost
  const envB = createMockEnvironment({ innerWidth: 1280, innerHeight: 800 });
  const opLog = [];
  const uiB = createStudioUI({
    doc: envB.doc,
    win: envB.win,
    mountTarget: envB.doc.body,
    hostApi: {
      getActivePersona: async () => ({
        avatarId: 'u1.png',
        name: '林清',
        description: '旧人设',
        lorebook: 'old_person_wb',
      }),
      listPersonas: async () => [],
      getActiveCharacterContext: async () => null,
      saveSupplementaryWorldbook: async (wb) => {
        opLog.push({ op: 'wb', worldName: wb.worldName });
        return { worldName: wb.worldName, entryCount: wb.entries.length };
      },
      savePersonaToHost: async (payload) => {
        opLog.push({ op: 'persona', mode: payload.mode, lorebook: payload.lorebook });
        return { avatarId: 'u2.png', name: payload.name, lorebook: payload.lorebook };
      },
    },
  });

  uiB.open();
  await new Promise((r) => setTimeout(r, 20));
  const srB = uiB.shadow;
  srB.querySelector('[data-ups-draft]').value = [
    '## 人物本体核',
    '新角色正文。',
    '',
    '【补充世界书条目】',
    '### 补充背景A',
    '关键词：港口',
    '内容：北港灯塔旧事。',
  ].join('\n');
  srB.querySelector('[data-ups-draft]').dispatchEvent({ type: 'input', bubbles: true });
  srB.querySelector('[data-ups-save-name]').value = '沈渡';

  // First create with dualLayer=false -> lorebook must be '' (not 'old_person_wb')
  srB.querySelector('[data-ups-save-new]').click();
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(opLog, [{ op: 'persona', mode: 'create', lorebook: '' }]);

  // Enable dualLayer -> worldbook saved FIRST, then persona saved with final lorebook name
  opLog.length = 0;
  srB.querySelector('[data-ups-popover]').querySelectorAll('input[type="checkbox"]')[1].click();
  srB.querySelector('[data-ups-save-new]').click();
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(opLog, [
    { op: 'wb', worldName: '沈渡_补充设定' },
    { op: 'persona', mode: 'create', lorebook: '沈渡_补充设定' },
  ]);
  uiB.destroy();
});

test('Tier 5 | Gap 4: Mode B double-click during pending getActivePersona launches at most 1 generation', async () => {
  const env = createMockEnvironment({ innerWidth: 1280, innerHeight: 800 });
  let resolvePersona;
  let genCalls = 0;
  const ui = createStudioUI({
    doc: env.doc,
    win: env.win,
    mountTarget: env.doc.body,
    hostApi: {
      getActivePersona: () =>
        new Promise((resolve) => {
          resolvePersona = resolve;
        }),
      listPersonas: async () => [],
      getActiveCharacterContext: async () => null,
      runStudioGeneration: async () => {
        genCalls += 1;
        return { text: '优化结果', source: 'mock' };
      },
    },
  });

  ui.open();
  const sr = ui.shadow;
  sr.querySelector('[data-ups-mode="B"]').click();
  const genB = sr.querySelector('[data-ups-generate-b]');
  // Double-click while getActivePersona is pending
  genB.click();
  genB.click();
  resolvePersona({ avatarId: 'u1.png', name: '林清', description: '待优化旧稿' });
  await new Promise((r) => setTimeout(r, 30));
  assert.ok(genCalls <= 1, `Expected at most 1 generation, got ${genCalls}`);
  assert.equal(genB.textContent, '生成优化稿');
  ui.destroy();
});

test('Tier 5 | Gap 6: popoverEl and floatingMenuEl dismiss on switchTab, drag, resize, and window resize', () => {
  const env = createMockEnvironment({ innerWidth: 1280, innerHeight: 800 });
  const ui = createStudioUI({ doc: env.doc, win: env.win, mountTarget: env.doc.body });
  ui.open();
  const sr = ui.shadow;
  const popoverBtn = sr.querySelector('[data-ups-popover-btn]');
  const popoverEl = sr.querySelector('[data-ups-popover]');
  const topbarEl = sr.querySelector('.ups-header');
  const resizeEl = sr.querySelector('[data-ups-resize]');

  // 1. switchTab hides popoverEl
  popoverBtn.click();
  assert.equal(popoverEl.hidden, false);
  ui.switchTab('presets');
  assert.equal(popoverEl.hidden, true);

  // 2. drag pointerdown hides both popoverEl and floatingMenuEl
  sr.querySelectorAll('.ups-more-btn')[0].click();
  const menuEl = sr.querySelector('[data-ups-floating-menu]');
  assert.equal(menuEl.hidden, false);
  popoverBtn.click();
  assert.equal(popoverEl.hidden, false);
  topbarEl.dispatchEvent({ type: 'pointerdown', button: 0, pointerId: 1, clientX: 200, clientY: 90, target: topbarEl });
  assert.equal(popoverEl.hidden, true);
  assert.equal(menuEl.hidden, true);

  // 3. resize pointerdown hides popoverEl & floatingMenuEl
  popoverBtn.click();
  sr.querySelectorAll('.ups-more-btn')[0].click();
  resizeEl.dispatchEvent({ type: 'pointerdown', button: 0, pointerId: 2, clientX: 900, clientY: 600, target: resizeEl });
  assert.equal(popoverEl.hidden, true);
  assert.equal(menuEl.hidden, true);

  // 4. window resize hides popoverEl & floatingMenuEl
  popoverBtn.click();
  sr.querySelectorAll('.ups-more-btn')[0].click();
  env.win.innerWidth = 1024;
  env.win.dispatchEvent({ type: 'resize' });
  assert.equal(popoverEl.hidden, true);
  assert.equal(menuEl.hidden, true);

  ui.destroy();
});

test('Tier 5 | Gap 7 & Gap 11: prefillInput is multi-line textarea, numeric clamps match core.js, and restore() clamps to shrunken viewport', () => {
  const env = createMockEnvironment({ innerWidth: 1280, innerHeight: 800 });
  const ui = createStudioUI({ doc: env.doc, win: env.win, mountTarget: env.doc.body });
  ui.open();
  ui.switchTab('presets');
  const sr = ui.shadow;

  // Gap 7: prefillInput is <textarea class="ups-textarea" rows="2"> preserving newlines
  const presetsPanel = sr.querySelector('[data-ups-tab-panel="presets"]');
  const prefillEl = presetsPanel.querySelector('textarea');
  assert.ok(prefillEl);
  assert.equal(prefillEl.tagName, 'TEXTAREA');
  assert.equal(prefillEl.getAttribute('spellcheck'), 'false');
  prefillEl.value = '第一行引导\n第二行续写';
  prefillEl.dispatchEvent({ type: 'change', bubbles: true });
  const activeScheme = ui.getState().settings.schemes.find((s) => s.id === ui.getState().settings.activeSchemeId);
  assert.equal(activeScheme.prefillText, '第一行引导\n第二行续写');

  // Gap 11a: schemeMaxTokensInput clamps to [256, 32768]
  const schemeNums = presetsPanel.querySelectorAll('input[type="number"]');
  const schemeMaxIn = schemeNums[1];
  schemeMaxIn.value = '999999';
  schemeMaxIn.dispatchEvent({ type: 'change', bubbles: true });
  assert.equal(activeScheme.maxTokens, 32768);
  schemeMaxIn.value = '50';
  schemeMaxIn.dispatchEvent({ type: 'change', bubbles: true });
  assert.equal(activeScheme.maxTokens, 256);

  // Gap 11b: apiMaxTokensInput [256, 32768] & apiTimeoutInput [10, 300]
  ui.switchTab('settings');
  const prov = sr.querySelector('[data-ups-provider]');
  prov.value = 'custom';
  prov.dispatchEvent({ type: 'change', bubbles: true });
  const settingsNums = sr.querySelector('[data-ups-tab-panel="settings"]').querySelectorAll('input[type="number"]');
  const apiMaxIn = settingsNums[1];
  const apiTimeoutIn = settingsNums[3];
  apiMaxIn.value = '100';
  apiMaxIn.dispatchEvent({ type: 'change', bubbles: true });
  assert.equal(ui.getState().settings.api.profiles[0].maxTokens, 256);
  apiTimeoutIn.value = '500';
  apiTimeoutIn.dispatchEvent({ type: 'change', bubbles: true });
  assert.equal(ui.getState().settings.api.profiles[0].timeoutSeconds, 300);

  // Gap 11c: restore() re-clamps floating modal after viewport shrinks while minimized
  const modalEl = sr.querySelector('[data-ups-window]');
  modalEl.classList.add('is-floating');
  modalEl.style.left = '420px';
  modalEl.style.top = '140px';
  modalEl.style.width = '820px';
  modalEl.style.height = '620px';
  ui.minimize();
  env.win.innerWidth = 760;
  env.win.innerHeight = 520;
  ui.restore();
  assert.ok(parseFloat(modalEl.style.left) + parseFloat(modalEl.style.width) <= 760);
  assert.ok(parseFloat(modalEl.style.top) + parseFloat(modalEl.style.height) <= 520);

  ui.destroy();
});

test('Tier 5 | Gap 8: zero non-sk-mock- tokens across entire repository', () => {
  const tokenRe = /\bsk-(?!mock-)[A-Za-z0-9_+/=-]{4,}/g;
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ent.name === 'node_modules' || ent.name === '.git') continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(full);
      } else if (/\.(js|mjs|cjs|ts|json|md|css|html)$/i.test(ent.name)) {
        const text = fs.readFileSync(full, 'utf8');
        const matches = text.match(tokenRe);
        assert.equal(matches, null, `Found non-sk-mock- token in ${path.relative(ROOT_DIR, full)}: ${matches}`);
      }
    }
  };
  walk(ROOT_DIR);
});

test('Tier 5 | R1: saveCurrentPersona acquires concurrency lock, disables save buttons while in-flight, and resets on failure', async () => {
  const env = createMockEnvironment({ innerWidth: 1280, innerHeight: 800 });
  let saveCalls = 0;
  let resolveSave;
  let shouldReject = false;

  const ui = createStudioUI({
    doc: env.doc,
    win: env.win,
    mountTarget: env.doc.body,
    hostApi: {
      getActivePersona: async () => ({ avatarId: 'u1.png', name: '林清', description: '旧稿', lorebook: '' }),
      listPersonas: async () => [],
      getActiveCharacterContext: async () => null,
      savePersonaToHost: (payload) => {
        saveCalls += 1;
        if (shouldReject) return Promise.reject(new Error('模拟保存失败'));
        return new Promise((resolve) => {
          resolveSave = () => resolve({ avatarId: 'u2.png', name: payload.name, lorebook: '' });
        });
      },
    },
  });

  ui.open();
  await new Promise((r) => setTimeout(r, 20));
  const sr = ui.shadow;
  const draft = sr.querySelector('[data-ups-draft]');
  draft.value = '完整人设正文';
  const saveNewBtn = sr.querySelector('[data-ups-save-new]');
  const saveOverwriteBtn = sr.querySelector('[data-ups-save-overwrite]');
  const footerSaveBtn = sr.querySelector('[data-ups-footer-save]');

  // Double-click while in-flight -> only 1 save call, buttons disabled
  saveNewBtn.click();
  saveNewBtn.click();
  saveOverwriteBtn.click();
  assert.equal(saveNewBtn.disabled, true);
  assert.equal(saveOverwriteBtn.disabled, true);
  assert.equal(footerSaveBtn.disabled, true);
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(saveCalls, 1);

  resolveSave();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(saveNewBtn.disabled, false);
  assert.equal(saveOverwriteBtn.disabled, false);
  assert.equal(footerSaveBtn.disabled, false);

  // Subsequent rejection still releases lock & buttons in finally
  shouldReject = true;
  saveOverwriteBtn.click();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(saveCalls, 2);
  assert.equal(saveNewBtn.disabled, false);
  assert.equal(saveOverwriteBtn.disabled, false);
  assert.equal(footerSaveBtn.disabled, false);

  ui.destroy();
});

test('Tier 5 | R3: profile switch/create/delete aborts in-flight model fetch and connection test', async () => {
  const env = createMockEnvironment({ innerWidth: 1280, innerHeight: 800 });
  const abortedSignals = [];
  let resolveFetch;
  let resolveConn;

  const ui = createStudioUI({
    doc: env.doc,
    win: env.win,
    mountTarget: env.doc.body,
    initialSettings: {
      api: {
        provider: 'custom',
        activeProfileId: 'p1',
        profiles: [
          { id: 'p1', name: '方案A', baseUrl: 'https://a.example/v1', apiKey: 'sk-mock-a1234', model: 'm-a' },
          { id: 'p2', name: '方案B', baseUrl: 'https://b.example/v1', apiKey: 'sk-mock-b5678', model: 'm-b' },
        ],
      },
    },
    hostApi: {
      getActivePersona: async () => null,
      listPersonas: async () => [],
      getActiveCharacterContext: async () => null,
      fetchCustomModels: (_profile, signal) => {
        signal.addEventListener('abort', () => abortedSignals.push('fetch'), { once: true });
        return new Promise((resolve) => {
          resolveFetch = resolve;
        });
      },
      testCustomConnection: (_profile, signal) => {
        signal.addEventListener('abort', () => abortedSignals.push('conn'), { once: true });
        return new Promise((resolve) => {
          resolveConn = resolve;
        });
      },
    },
  });

  ui.open();
  ui.switchTab('settings');
  const sr = ui.shadow;
  const profileSel = sr.querySelector('[data-ups-api-profile]');
  const modelSel = sr.querySelector('[aria-label="已拉取模型列表"]');
  const connStatus = sr.querySelector('[data-ups-conn-status]');

  // 1. Start fetch & conn test on p1, then switch to p2
  sr.querySelector('[data-ups-fetch-models]').click();
  sr.querySelector('[data-ups-test-conn]').click();
  profileSel.value = 'p2';
  profileSel.dispatchEvent({ type: 'change', bubbles: true });
  assert.deepEqual(abortedSignals, ['fetch', 'conn']);
  assert.equal(connStatus.textContent, '尚未测试');

  // Even if late callbacks resolve for p1, p2's UI must remain clean
  resolveFetch(['model-from-A']);
  resolveConn({ ok: true, latencyMs: 5, modelCount: 1, message: 'ok' });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(modelSel.hidden, true);
  assert.equal(connStatus.textContent, '尚未测试');

  // 2. Start fetch on p2, then create a new profile -> aborts fetch
  abortedSignals.length = 0;
  sr.querySelector('[data-ups-fetch-models]').click();
  sr.querySelector('[data-ups-profile-name]').value = '方案C';
  sr.querySelector('[data-ups-profile-create]').click();
  assert.deepEqual(abortedSignals, ['fetch']);

  // 3. Start testConn on 方案C, then delete 方案C -> aborts testConn
  abortedSignals.length = 0;
  sr.querySelector('[data-ups-test-conn]').click();
  sr.querySelector('[data-ups-profile-delete]').click();
  const confirmDelBtn = sr
    .querySelector('[data-ups-tab-panel="settings"]')
    .querySelectorAll('button')
    .find((b) => b.textContent === '确认删除');
  confirmDelBtn.click();
  assert.deepEqual(abortedSignals, ['conn']);

  ui.destroy();
});

test('Tier 5 | R4: blank or non-finite schemeTempInput & schemeMaxTokensInput preserve scheme values and sync clamped temperature', () => {
  const env = createMockEnvironment({ innerWidth: 1280, innerHeight: 800 });
  const ui = createStudioUI({ doc: env.doc, win: env.win, mountTarget: env.doc.body });
  ui.open();
  ui.switchTab('presets');
  const sr = ui.shadow;
  const presetsPanel = sr.querySelector('[data-ups-tab-panel="presets"]');
  const nums = presetsPanel.querySelectorAll('input[type="number"]');
  const tempIn = nums[0];
  const maxIn = nums[1];

  const getActive = () => ui.getState().settings.schemes.find((s) => s.id === ui.getState().settings.activeSchemeId);
  const origTemp = getActive().temperature;
  const origMax = getActive().maxTokens;

  tempIn.value = '   ';
  tempIn.dispatchEvent({ type: 'change', bubbles: true });
  maxIn.value = '';
  maxIn.dispatchEvent({ type: 'change', bubbles: true });
  assert.equal(getActive().temperature, origTemp);
  assert.equal(getActive().maxTokens, origMax);
  assert.equal(tempIn.value, String(origTemp));
  assert.equal(maxIn.value, String(origMax));

  tempIn.value = '5';
  tempIn.dispatchEvent({ type: 'change', bubbles: true });
  assert.equal(getActive().temperature, 2);
  assert.equal(tempIn.value, '2');

  ui.destroy();
});

test('Tier 5 | R5: slash command registration respects persona-studio ownership and destroy cleans owned alias', async () => {
  // Case A: Fresh session registers both ups and persona-studio, destroy deletes both
  const envA = createMockEnvironment();
  const commandsA = {};
  const mockCtxA = {
    extensionSettings: {},
    powerUser: { personas: {}, persona_descriptions: {} },
    SlashCommand: { fromProps: (props) => ({ ...props }) },
    SlashCommandParser: {
      commands: commandsA,
      addCommandObject: (cmd) => {
        commandsA[cmd.name] = cmd;
        for (const a of cmd.aliases || []) commandsA[a] = cmd;
      },
    },
  };
  const ctrlA = await mountStudioForTest({
    doc: envA.doc,
    win: envA.win,
    skipCssRefresh: true,
    hostDeps: { context: mockCtxA },
    hostApi: {
      getActivePersona: async () => null,
      listPersonas: async () => [],
      getActiveCharacterContext: async () => null,
    },
  });
  assert.ok(Object.hasOwn(commandsA, 'ups'));
  assert.ok(Object.hasOwn(commandsA, 'persona-studio'));
  ctrlA.destroy();
  assert.equal(Object.hasOwn(commandsA, 'ups'), false);
  assert.equal(Object.hasOwn(commandsA, 'persona-studio'), false);

  // Case B: Pre-existing third-party persona-studio is preserved when ups mounts and destroys
  const envB = createMockEnvironment();
  const thirdPartyCmd = { name: 'persona-studio', external: true };
  const commandsB = { 'persona-studio': thirdPartyCmd };
  const mockCtxB = {
    extensionSettings: {},
    powerUser: { personas: {}, persona_descriptions: {} },
    SlashCommand: { fromProps: (props) => ({ ...props }) },
    SlashCommandParser: {
      commands: commandsB,
      addCommandObject: (cmd) => {
        commandsB[cmd.name] = cmd;
        for (const a of cmd.aliases || []) commandsB[a] = cmd;
      },
    },
  };
  const ctrlB = await mountStudioForTest({
    doc: envB.doc,
    win: envB.win,
    skipCssRefresh: true,
    hostDeps: { context: mockCtxB },
    hostApi: {
      getActivePersona: async () => null,
      listPersonas: async () => [],
      getActiveCharacterContext: async () => null,
    },
  });
  assert.ok(Object.hasOwn(commandsB, 'ups'));
  assert.deepEqual(commandsB.ups.aliases, []);
  assert.equal(commandsB['persona-studio'], thirdPartyCmd);
  ctrlB.destroy();
  assert.equal(Object.hasOwn(commandsB, 'ups'), false);
  assert.equal(commandsB['persona-studio'], thirdPartyCmd);
});

test('UX v1.1: two-pane workbench, word-count sync, persona point checklist, uncluttered footer & add-entry auto-scroll feedback', async () => {
  const env = createMockEnvironment({ innerWidth: 1280, innerHeight: 800, coarse: false });
  const capturedMessages = [];
  const sampleOldPersona = [
    '【基础人设】',
    '- 黑发微卷，常戴细框眼镜。',
    '- 偏爱安静环境与温热乌龙茶。',
    '【当前背景与关系】',
    '- 现担任档案馆见习整理员。',
  ].join('\n');

  const ui = createStudioUI({
    doc: env.doc,
    win: env.win,
    mountTarget: env.doc.body,
    hostApi: {
      getActivePersona: async () => ({ avatarId: 'u1.png', name: '苏砚', description: sampleOldPersona }),
      listPersonas: async () => [{ avatarId: 'u1.png', name: '苏砚', description: sampleOldPersona, isActive: true }],
      getActiveCharacterContext: async () => null,
      runStudioGeneration: async ({ messages }) => {
        capturedMessages.push(messages);
        return { text: '【基础人设】\n## 外貌\n黑发微卷。', source: 'mock' };
      },
    },
  });

  ui.open();
  await new Promise((r) => setTimeout(r, 15));
  const sr = ui.shadow;

  // 1. Two-pane workbench exists & popover has NO manual prefill dropdown
  assert.ok(sr.querySelector('.ups-workbench'));
  assert.ok(sr.querySelector('[data-ups-pane="left"]'));
  assert.ok(sr.querySelector('[data-ups-pane="right"]'));
  assert.equal(sr.querySelector('[data-ups-popover-tail]'), null);

  // 2. Footer uncluttered: exportPresetBtn moved out of footer into Tab 2 (presets)
  const footer = sr.querySelector('[data-ups-footer]');
  assert.equal(footer.querySelector('[data-ups-export-preset]'), null);
  assert.ok(sr.querySelector('[data-ups-tab-panel="presets"]').querySelector('[data-ups-export-preset]'));

  // 3. Word count selector updates active scheme & dual char/token badge
  const wcSel = sr.querySelector('[data-ups-word-count]');
  wcSel.value = '1000';
  wcSel.dispatchEvent({ type: 'change', bubbles: true });
  const activeScheme = ui.getState().settings.schemes.find((s) => s.id === ui.getState().settings.activeSchemeId);
  assert.equal(activeScheme.targetChars, 1000);
  assert.match(sr.querySelector('[data-ups-status]').textContent, /约 1000 字/);

  // 4. Mode B loadPersona populates selectable points checklist without manual copy-paste
  sr.querySelector('[data-ups-mode="B"]').click();
  sr.querySelector('[data-ups-load-persona]').click();
  const pointsBox = sr.querySelector('[data-ups-points-box]');
  assert.equal(pointsBox.hidden, false);
  const pointCbs = pointsBox.querySelectorAll('input[type="checkbox"]');
  assert.equal(pointCbs.length, 3);
  // First two (appearance/habit) checked by default, 3rd (current role) unchecked by default
  assert.equal(pointCbs[0].checked, true);
  assert.equal(pointCbs[1].checked, true);
  assert.equal(pointCbs[2].checked, false);

  sr.querySelector('[data-ups-generate-b]').click();
  await new Promise((r) => setTimeout(r, 20));
  const sentText = capturedMessages[0].map((m) => m.content).join('\n');
  assert.ok(sentText.includes('黑发微卷，常戴细框眼镜'));
  assert.ok(sentText.includes('约 1000 字'));

  // 5. Tab 2 + 新增条目 clears filter, expands, highlights (.ups-just-added), scrolls into view & updates status
  ui.switchTab('presets');
  const searchIn = sr.querySelector('[data-ups-stack-search]');
  searchIn.value = '不存在的筛选词';
  searchIn.dispatchEvent({ type: 'input', bubbles: true });

  let scrolledCount = 0;
  env.doc.createElement_orig = env.doc.createElement;
  const origCreate = env.doc.createElement.bind(env.doc);
  env.doc.createElement = (tag) => {
    const el = origCreate(tag);
    el.scrollIntoView = () => {
      scrolledCount += 1;
    };
    return el;
  };

  sr.querySelector('[data-ups-add-entry]').click();
  assert.equal(searchIn.value, '');
  assert.ok(scrolledCount >= 1);
  const addedCard = sr.querySelector('[data-ups-tab-panel="presets"]').querySelectorAll('.ups-entry-card').at(-1);
  assert.equal(addedCard.classList.contains('ups-just-added'), true);
  assert.ok(addedCard.querySelector('.ups-entry-editor'));
  assert.match(sr.querySelector('[data-ups-status]').textContent, /新增规则条目并自动跳转展开/);

  ui.destroy();
});
