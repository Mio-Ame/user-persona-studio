// Strengthened E2E Fake DOM + Stateful SillyTavern Host + Mock LLM Harness
// Zero external dependencies; guards index.js auto-boot and cleans globals after each test.

globalThis.__UPS_DISABLE_AUTO_BOOT__ = true;

import fs from 'node:fs';
import path from 'node:path';
import util from 'node:util';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const REPO_ROOT = path.resolve(__dirname, '..', '..');

let _cachedMods = null;

export async function loadStudioModules() {
  globalThis.__UPS_DISABLE_AUTO_BOOT__ = true;
  if (_cachedMods) return _cachedMods;
  const [presets, core, host, api, styles, ui, entry] = await Promise.all([
    import('../../src/presets.js'),
    import('../../src/core.js'),
    import('../../src/host.js'),
    import('../../src/api.js'),
    import('../../src/styles.js'),
    import('../../src/ui.js'),
    import('../../index.js'),
  ]);
  _cachedMods = { presets, core, host, api, styles, ui, entry };
  return _cachedMods;
}

export class MockStorage {
  constructor(initial = {}) {
    this._map = new Map(Object.entries(initial).map(([k, v]) => [String(k), String(v)]));
    this.throwOnSet = false;
    this.throwOnGet = false;
  }
  get length() {
    return this._map.size;
  }
  key(index) {
    const keys = Array.from(this._map.keys());
    return keys[index] ?? null;
  }
  getItem(key) {
    if (this.throwOnGet) throw new Error('MockStorage getItem failure');
    const k = String(key);
    return this._map.has(k) ? this._map.get(k) : null;
  }
  setItem(key, value) {
    if (this.throwOnSet) throw new Error('MockStorage QuotaExceededError');
    this._map.set(String(key), String(value));
  }
  removeItem(key) {
    this._map.delete(String(key));
  }
  clear() {
    this._map.clear();
  }
  snapshot() {
    return Object.fromEntries(this._map.entries());
  }
}

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
  set left(v) { this._props.set('left', String(v ?? '')); }
  get left() { return this._props.get('left') || ''; }
  set top(v) { this._props.set('top', String(v ?? '')); }
  get top() { return this._props.get('top') || ''; }
  set width(v) { this._props.set('width', String(v ?? '')); }
  get width() { return this._props.get('width') || ''; }
  set height(v) { this._props.set('height', String(v ?? '')); }
  get height() { return this._props.get('height') || ''; }
  set maxHeight(v) { this._props.set('maxHeight', String(v ?? '')); }
  get maxHeight() { return this._props.get('maxHeight') || ''; }
  set minHeight(v) { this._props.set('minHeight', String(v ?? '')); }
  get minHeight() { return this._props.get('minHeight') || ''; }
  set display(v) { this._props.set('display', String(v ?? '')); }
  get display() { return this._props.get('display') || ''; }
  set fontSize(v) { this._props.set('fontSize', String(v ?? '')); }
  get fontSize() { return this._props.get('fontSize') || ''; }
}

function splitTopLevelCommas(sel) {
  const parts = [];
  let cur = '';
  let parenDepth = 0;
  let bracketDepth = 0;
  let quote = '';
  for (let i = 0; i < sel.length; i += 1) {
    const ch = sel[i];
    if (quote) {
      cur += ch;
      if (ch === quote && sel[i - 1] !== '\\') quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
    } else if (ch === '(') {
      parenDepth += 1;
      cur += ch;
    } else if (ch === ')') {
      parenDepth = Math.max(0, parenDepth - 1);
      cur += ch;
    } else if (ch === '[') {
      bracketDepth += 1;
      cur += ch;
    } else if (ch === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1);
      cur += ch;
    } else if (ch === ',' && parenDepth === 0 && bracketDepth === 0) {
      if (cur.trim()) parts.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

function readBalancedGroup(str, openCh, closeCh, startIdx = 0) {
  let depth = 0;
  let quote = '';
  for (let i = startIdx; i < str.length; i += 1) {
    const ch = str[i];
    if (quote) {
      if (ch === quote && str[i - 1] !== '\\') quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === openCh) {
      depth += 1;
    } else if (ch === closeCh) {
      depth -= 1;
      if (depth === 0) {
        return { inner: str.slice(startIdx + 1, i), nextIndex: i + 1 };
      }
    }
  }
  return null;
}

function matchSingleCompoundSelector(el, sel) {
  if (!el || el.nodeType !== 1) return false;
  let rest = sel.trim();
  if (!rest) return false;
  if (rest === '*') return true;

  if (rest.startsWith('*')) {
    rest = rest.slice(1);
  } else {
    const tagMatch = /^([a-zA-Z0-9_-]+)/.exec(rest);
    if (tagMatch) {
      if (el.tagName !== tagMatch[1].toUpperCase()) return false;
      rest = rest.slice(tagMatch[0].length);
    }
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
      const grp = readBalancedGroup(rest, '[', ']', 0);
      if (!grp) return false;
      const body = grp.inner.trim();
      const opMatch = /^([^\s~|^$*=]+)\s*([~|^$*]?=)\s*(.+)$/.exec(body);
      if (opMatch) {
        const attrName = opMatch[1].trim();
        const op = opMatch[2];
        let expected = opMatch[3].trim();
        if (
          (expected.startsWith('"') && expected.endsWith('"')) ||
          (expected.startsWith("'") && expected.endsWith("'"))
        ) {
          expected = expected.slice(1, -1);
        }
        const actual = el.getAttribute(attrName);
        if (actual === null) return false;
        if (op === '=' && actual !== expected) return false;
        if (op === '^=' && !actual.startsWith(expected)) return false;
        if (op === '$=' && !actual.endsWith(expected)) return false;
        if (op === '*=' && !actual.includes(expected)) return false;
        if (op === '~=' && !actual.split(/\s+/).includes(expected)) return false;
        if (op === '|=' && actual !== expected && !actual.startsWith(`${expected}-`)) return false;
      } else {
        if (el.getAttribute(body) === null) return false;
      }
      rest = rest.slice(grp.nextIndex);
    } else if (rest.startsWith(':not(')) {
      const grp = readBalancedGroup(rest, '(', ')', 4);
      if (!grp) return false;
      const negatedParts = splitTopLevelCommas(grp.inner);
      if (negatedParts.some((p) => matchSingleSelector(el, p))) return false;
      rest = rest.slice(grp.nextIndex);
    } else if (rest.startsWith(':checked')) {
      if (!el.checked) return false;
      rest = rest.slice(':checked'.length);
    } else if (rest.startsWith(':disabled')) {
      if (!el.disabled) return false;
      rest = rest.slice(':disabled'.length);
    } else if (rest.startsWith(':enabled')) {
      if (el.disabled) return false;
      rest = rest.slice(':enabled'.length);
    } else {
      return false;
    }
  }
  return true;
}

function tokenizeComplexSelector(sel) {
  const tokens = [];
  const raw = sel.trim();
  let cur = '';
  let parenDepth = 0;
  let bracketDepth = 0;
  let quote = '';
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (quote) {
      cur += ch;
      if (ch === quote && raw[i - 1] !== '\\') quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
    } else if (ch === '(') {
      parenDepth += 1;
      cur += ch;
    } else if (ch === ')') {
      parenDepth = Math.max(0, parenDepth - 1);
      cur += ch;
    } else if (ch === '[') {
      bracketDepth += 1;
      cur += ch;
    } else if (ch === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1);
      cur += ch;
    } else if (parenDepth === 0 && bracketDepth === 0 && ch === '>') {
      if (cur.trim()) tokens.push(cur.trim());
      tokens.push('>');
      cur = '';
    } else if (parenDepth === 0 && bracketDepth === 0 && /\s/.test(ch)) {
      if (cur.trim()) {
        tokens.push(cur.trim());
        cur = '';
      }
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) tokens.push(cur.trim());
  return tokens;
}

function matchSingleSelector(el, sel) {
  if (!el || el.nodeType !== 1) return false;
  const tokens = tokenizeComplexSelector(sel);
  if (tokens.length === 0) return false;
  if (tokens.length === 1) return matchSingleCompoundSelector(el, tokens[0]);

  const last = tokens[tokens.length - 1];
  if (last === '>' || !matchSingleCompoundSelector(el, last)) return false;

  let curEl = el;
  let i = tokens.length - 2;
  while (i >= 0) {
    if (tokens[i] === '>') {
      const targetSel = tokens[i - 1];
      if (!targetSel || !curEl.parentNode || curEl.parentNode.nodeType !== 1) return false;
      if (!matchSingleCompoundSelector(curEl.parentNode, targetSel)) return false;
      curEl = curEl.parentNode;
      i -= 2;
    } else {
      const targetSel = tokens[i];
      let anc = curEl.parentNode;
      let matched = null;
      while (anc && anc.nodeType === 1) {
        if (matchSingleCompoundSelector(anc, targetSel)) {
          matched = anc;
          break;
        }
        anc = anc.parentNode;
      }
      if (!matched) return false;
      curEl = matched;
      i -= 1;
    }
  }
  return true;
}

class MockNode {
  constructor(ownerDocument, nodeType, tagName = '', envRef = null) {
    Object.defineProperties(this, {
      ownerDocument: { value: ownerDocument, writable: true, configurable: true, enumerable: false },
      _env: { value: envRef || ownerDocument?._env || null, writable: true, configurable: true, enumerable: false },
      parentNode: { value: null, writable: true, configurable: true, enumerable: false },
      childNodes: { value: [], writable: true, configurable: true, enumerable: false },
      _listeners: { value: new Map(), writable: true, configurable: true, enumerable: false },
      _attrs: { value: new Map(), writable: true, configurable: true, enumerable: false },
      style: { value: new MockStyle(), writable: true, configurable: true, enumerable: false },
      classList: { value: new MockClassList(this), writable: true, configurable: true, enumerable: false },
      shadowRoot: { value: null, writable: true, configurable: true, enumerable: false },
      host: { value: null, writable: true, configurable: true, enumerable: false },
      defaultView: { value: null, writable: true, configurable: true, enumerable: false },
      documentElement: { value: null, writable: true, configurable: true, enumerable: false },
      head: { value: null, writable: true, configurable: true, enumerable: false },
      body: { value: null, writable: true, configurable: true, enumerable: false },
      activeElement: { value: null, writable: true, configurable: true, enumerable: false },
    });
    this.nodeType = nodeType;
    this.tagName = tagName ? tagName.toUpperCase() : '';
    this._className = '';
    this.dataset = {};
    this._textContent = '';
    this.hidden = false;
    this.disabled = false;
    this.checked = false;
    this._value = '';
    this.type = '';
    this.open = false;
    this.scrollTop = 0;
    this.offsetWidth = 160;
    this.offsetHeight = 120;
    this.clientWidth = 160;
    this.scrollWidth = 160;
    this.focusCalls = 0;
    this.selectionStart = 0;
    this.selectionEnd = 0;
  }

  [util.inspect.custom]() {
    const idPart = this.id ? `#${this.id}` : '';
    const clsPart = this._className ? `.${this._className.trim().replace(/\s+/g, '.')}` : '';
    return `<MockNode ${this.tagName || '#node'}${idPart}${clsPart}>`;
  }

  toJSON() {
    return `<MockNode ${this.tagName || '#node'}>`;
  }

  get value() {
    if (this.tagName === 'SELECT') {
      const opts = this.options;
      if (this._value && opts.some((o) => o.value === this._value)) {
        return this._value;
      }
      const selOpt = opts.find((o) => o.selected);
      if (selOpt) return selOpt.value;
      if (opts.length > 0) return opts[0].value;
      return this._value;
    }
    return this._value;
  }

  set value(v) {
    const str = String(v ?? '');
    this._value = str;
    if (this.tagName === 'SELECT') {
      for (const opt of this.options) {
        opt.selected = opt.value === str;
      }
    }
  }

  get parentElement() {
    return this.parentNode && this.parentNode.nodeType === 1 ? this.parentNode : null;
  }

  get children() {
    return this.childNodes.filter((n) => n.nodeType === 1);
  }

  get options() {
    return this.querySelectorAll('option');
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

  setSelectionRange(start, end) {
    const len = String(this.value ?? '').length;
    this.selectionStart = Math.max(0, Math.min(len, Number(start) || 0));
    this.selectionEnd = Math.max(this.selectionStart, Math.min(len, Number(end) || 0));
  }

  scrollIntoView(opts = {}) {
    if (this._env) {
      this._env.scrollIntoViewCalls.push({ node: this, opts });
    }
  }

  setAttribute(name, value) {
    const str = String(value);
    this._attrs.set(name, str);
    if (name === 'class') {
      this._className = str;
      this.classList._syncFromAttr(str);
    } else if (name === 'hidden') {
      this.hidden = true;
    } else if (name === 'open') {
      this.open = str !== 'false';
    } else if (name === 'type') {
      this.type = str;
    } else if (name === 'value') {
      this.value = str;
    } else if (name === 'disabled') {
      this.disabled = str !== 'false';
    } else if (name.startsWith('data-')) {
      const camel = name.slice(5).replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
      this.dataset[camel] = str;
    }
  }

  getAttribute(name) {
    if (name === 'class') return this._className || null;
    if (name === 'hidden') return this.hidden ? '' : null;
    if (name === 'open') return this.open ? '' : null;
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
    if (name === 'open') this.open = false;
    if (name === 'disabled') this.disabled = false;
    if (name.startsWith('data-')) {
      const camel = name.slice(5).replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
      delete this.dataset[camel];
    }
  }

  _notifyMutations(type, added = [], removed = []) {
    const observers = this._env?._mutationObservers;
    if (!observers || observers.size === 0) return;
    const rec = { type, target: this, addedNodes: added, removedNodes: removed };
    for (const obs of observers) {
      obs._enqueue(this, rec);
    }
  }

  appendChild(child) {
    if (child.parentNode) child.remove();
    child.parentNode = this;
    this.childNodes.push(child);
    if (this.tagName === 'SELECT' && child.tagName === 'OPTION' && !this._value) {
      this._value = child.value;
    }
    this._notifyMutations('childList', [child], []);
    return child;
  }

  replaceChildren(...nodes) {
    const removed = [...this.childNodes];
    for (const c of this.childNodes) c.parentNode = null;
    this.childNodes = [];
    this._textContent = '';
    if (this.tagName === 'SELECT') this._value = '';
    for (const n of nodes) {
      if (n.parentNode) n.remove();
      n.parentNode = this;
      this.childNodes.push(n);
    }
    if (this.tagName === 'SELECT' && this.options.length > 0 && !this._value) {
      this._value = this.options[0].value;
    }
    this._notifyMutations('childList', nodes, removed);
  }

  remove() {
    if (!this.parentNode) return;
    const prevParent = this.parentNode;
    prevParent.childNodes = prevParent.childNodes.filter((c) => c !== this);
    this.parentNode = null;
    const sr = this._findContainingShadowRoot();
    if (sr && (sr.activeElement === this || this.contains(sr.activeElement))) {
      sr.activeElement = null;
    }
    if (this.ownerDocument && (this.ownerDocument.activeElement === this || this.contains(this.ownerDocument.activeElement))) {
      this.ownerDocument.activeElement = this.ownerDocument.body || null;
    }
    prevParent._notifyMutations('childList', [], [this]);
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
    const parts = splitTopLevelCommas(selector);
    let cur = this;
    while (cur && cur.nodeType === 1) {
      if (parts.some((p) => matchSingleSelector(cur, p))) return cur;
      cur = cur.parentNode;
    }
    return null;
  }

  querySelectorAll(selector) {
    const parts = splitTopLevelCommas(selector);
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

  attachShadow({ mode }) {
    const sr = new MockNode(this.ownerDocument, 11, '#shadow-root', this._env);
    sr.mode = mode;
    sr.host = this;
    sr.activeElement = null;
    this.shadowRoot = sr;
    return sr;
  }

  _isVisible() {
    let cur = this;
    while (cur) {
      if (cur.hidden || cur.style?.display === 'none') return false;
      cur = cur.parentNode || cur.host || null;
    }
    return true;
  }

  getBoundingClientRect() {
    if (!this._isVisible()) {
      return { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 };
    }
    const vw = Number(this.ownerDocument?.defaultView?.innerWidth || 1280);
    const vh = Number(this.ownerDocument?.defaultView?.innerHeight || 800);

    if (this.classList.contains('ups-modal')) {
      const explicitW = parseFloat(this.style.width);
      const explicitH = parseFloat(this.style.height);
      const explicitL = parseFloat(this.style.left);
      const explicitT = parseFloat(this.style.top);
      const isMobile = vw <= 640 && !this.classList.contains('is-floating') && !this.classList.contains('is-mini');
      const w = Number.isFinite(explicitW)
        ? explicitW
        : isMobile
          ? vw
          : Math.min(1080, Math.max(320, vw - 16));
      const h = Number.isFinite(explicitH)
        ? explicitH
        : isMobile
          ? vh
          : Math.min(700, Math.max(240, vh - 16));
      const l = Number.isFinite(explicitL) ? explicitL : Math.max(0, Math.round((vw - w) / 2));
      const t = Number.isFinite(explicitT) ? explicitT : Math.max(0, Math.round((vh - h) / 2));
      return { left: l, top: t, width: w, height: h, right: l + w, bottom: t + h };
    }

    const defaultW = this.tagName === 'INPUT' || this.tagName === 'SELECT' || this.tagName === 'BUTTON' ? 140 : 280;
    const defaultH =
      this.classList.contains('ups-points-list')
        ? 300
        : this.tagName === 'INPUT' || this.tagName === 'SELECT' || this.tagName === 'BUTTON'
          ? 32
          : 44;
    const l = Number.isFinite(parseFloat(this.style.left)) ? parseFloat(this.style.left) : 24;
    const t = Number.isFinite(parseFloat(this.style.top)) ? parseFloat(this.style.top) : 24;
    const w = Number.isFinite(parseFloat(this.style.width)) ? parseFloat(this.style.width) : defaultW;
    const h = Number.isFinite(parseFloat(this.style.height)) ? parseFloat(this.style.height) : defaultH;
    return { left: l, top: t, width: w, height: h, right: l + w, bottom: t + h };
  }

  _findContainingShadowRoot() {
    let cur = this;
    while (cur) {
      if (cur.nodeType === 11 && cur.host) return cur;
      cur = cur.parentNode;
    }
    return null;
  }

  focus() {
    this.focusCalls += 1;
    if (this._env) {
      this._env.focusCalls.push({
        node: this,
        tagName: this.tagName,
        attrs: Object.fromEntries(this._attrs.entries()),
        viewportWidth: Number(this.ownerDocument?.defaultView?.innerWidth || 1280),
      });
    }
    const sr = this._findContainingShadowRoot();
    if (sr) {
      sr.activeElement = this;
      if (this.ownerDocument) this.ownerDocument.activeElement = sr.host;
    } else if (this.ownerDocument) {
      this.ownerDocument.activeElement = this;
    }
    this.dispatchEvent({ type: 'focus', bubbles: false });
    this.dispatchEvent({ type: 'focusin', bubbles: true });
  }

  blur() {
    const sr = this._findContainingShadowRoot();
    if (sr && sr.activeElement === this) {
      sr.activeElement = null;
    }
    if (this.ownerDocument && this.ownerDocument.activeElement === this) {
      this.ownerDocument.activeElement = this.ownerDocument.body || null;
    }
    this.dispatchEvent({ type: 'blur', bubbles: false });
    this.dispatchEvent({ type: 'focusout', bubbles: true });
  }

  click() {
    if (this.disabled) return;
    if (this.type === 'checkbox') {
      this.checked = !this.checked;
    } else if (this.type === 'radio') {
      this.checked = true;
    }
    if (this.tagName === 'SUMMARY' && this.parentNode?.tagName === 'DETAILS') {
      this.parentNode.open = !this.parentNode.open;
      this.parentNode.dispatchEvent({ type: 'toggle', bubbles: false });
    }
    this.dispatchEvent({ type: 'click', bubbles: true });
    if (this.type === 'checkbox' || this.type === 'radio') {
      this.dispatchEvent({ type: 'change', bubbles: true });
    }
  }

  addEventListener(type, fn, opts = {}) {
    const optObj = typeof opts === 'boolean' ? { capture: opts } : (opts || {});
    if (optObj?.signal?.aborted) return;
    if (!this._listeners.has(type)) this._listeners.set(type, []);
    const list = this._listeners.get(type);
    const entry = {
      fn,
      capture: Boolean(optObj.capture),
      once: Boolean(optObj.once),
    };
    list.push(entry);
    if (optObj?.signal) {
      optObj.signal.addEventListener('abort', () => {
        const cur = this._listeners.get(type) || [];
        this._listeners.set(type, cur.filter((e) => e !== entry));
      }, { once: true });
    }
  }

  removeEventListener(type, fn, opts = {}) {
    const optObj = typeof opts === 'boolean' ? { capture: opts } : (opts || {});
    const hasCaptureSpec = typeof opts === 'boolean' || Object.hasOwn(optObj, 'capture');
    const capture = Boolean(optObj.capture);
    const cur = this._listeners.get(type) || [];
    this._listeners.set(
      type,
      cur.filter((e) => !(e.fn === fn && (!hasCaptureSpec || e.capture === capture)))
    );
  }

  dispatchEvent(ev) {
    const pathNodes = [];
    let cur = this;
    while (cur) {
      pathNodes.push(cur);
      cur = cur.parentNode || cur.host || null;
    }

    const eventObj = {
      bubbles: Boolean(ev?.bubbles),
      cancelable: Boolean(ev?.cancelable),
      ...ev,
      type: ev?.type || '',
      target: ev?.target || this,
      currentTarget: this,
      defaultPrevented: false,
      eventPhase: 0,
      _stopped: false,
      _immediateStopped: false,
      composedPath() {
        return [...pathNodes];
      },
      preventDefault() {
        this.defaultPrevented = true;
      },
      stopPropagation() {
        this._stopped = true;
      },
      stopImmediatePropagation() {
        this._stopped = true;
        this._immediateStopped = true;
      },
    };

    const invokeList = (node, wantCapture) => {
      const list = [...(node._listeners.get(eventObj.type) || [])].filter((e) => e.capture === wantCapture);
      for (const entry of list) {
        if (eventObj._immediateStopped) break;
        entry.fn.call(node, eventObj);
        if (entry.once) {
          node.removeEventListener(eventObj.type, entry.fn, { capture: entry.capture });
        }
      }
      eventObj._immediateStopped = false;
    };

    for (let i = pathNodes.length - 1; i >= 0; i -= 1) {
      if (eventObj._stopped) break;
      const node = pathNodes[i];
      eventObj.currentTarget = node;
      eventObj.eventPhase = i === 0 ? 2 : 1;
      invokeList(node, true);
    }

    if (!eventObj._stopped) {
      for (let i = 0; i < pathNodes.length; i += 1) {
        if (eventObj._stopped) break;
        if (i > 0 && !eventObj.bubbles) break;
        const node = pathNodes[i];
        eventObj.currentTarget = node;
        eventObj.eventPhase = i === 0 ? 2 : 3;
        invokeList(node, false);
      }
    }

    return !eventObj.defaultPrevented;
  }
}

class MockCustomEvent {
  constructor(type, init = {}) {
    this.type = String(type || '');
    this.detail = init?.detail;
    this.bubbles = Boolean(init?.bubbles);
    this.cancelable = Boolean(init?.cancelable);
  }
}

export function createE2EEnvironment({ innerWidth = 1280, innerHeight = 800, coarse = false, storage = null } = {}) {
  const scrollIntoViewCalls = [];
  const focusCalls = [];
  const mutationObservers = new Set();
  const activeStorage = storage || new MockStorage();

  const env = {
    scrollIntoViewCalls,
    focusCalls,
    _mutationObservers: mutationObservers,
    storage: activeStorage,
  };

  class MockMutationObserver {
    constructor(cb) {
      this._cb = cb;
      this._targets = [];
      this._records = [];
    }
    observe(target) {
      if (target && !this._targets.includes(target)) this._targets.push(target);
      mutationObservers.add(this);
    }
    disconnect() {
      this._targets = [];
      this._records = [];
      mutationObservers.delete(this);
    }
    takeRecords() {
      const out = [...this._records];
      this._records = [];
      return out;
    }
    _enqueue(node, rec) {
      const matches = this._targets.some((t) => t === node || t.contains(node));
      if (!matches) return;
      if (typeof this._cb === 'function') {
        this._cb([rec], this);
      } else {
        if (this._records.length >= 64) this._records.shift();
        this._records.push(rec);
      }
    }
  }

  const doc = new MockNode(null, 9, '#document', env);
  doc.ownerDocument = doc;
  doc._env = env;
  doc.readyState = 'complete';
  doc.documentElement = new MockNode(doc, 1, 'html', env);
  doc.documentElement.clientWidth = innerWidth;
  doc.documentElement.clientHeight = innerHeight;
  doc.head = new MockNode(doc, 1, 'head', env);
  doc.body = new MockNode(doc, 1, 'body', env);
  doc.documentElement.appendChild(doc.head);
  doc.documentElement.appendChild(doc.body);
  doc.appendChild(doc.documentElement);
  doc.activeElement = doc.body;

  doc.createElement = (tag) => new MockNode(doc, 1, tag, env);
  doc.createElementNS = (_ns, tag) => new MockNode(doc, 1, tag, env);
  doc.createTextNode = (text) => {
    const t = new MockNode(doc, 3, '#text', env);
    t._textContent = String(text ?? '');
    return t;
  };
  doc.getElementById = (id) => doc.documentElement.querySelector(`#${id}`);
  doc.querySelector = (sel) => doc.documentElement.querySelector(sel);
  doc.querySelectorAll = (sel) => doc.documentElement.querySelectorAll(sel);

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

  const worldInfoSelect = doc.createElement('select');
  worldInfoSelect.id = 'world_info';
  doc.body.appendChild(worldInfoSelect);

  const charListBlock = doc.createElement('div');
  charListBlock.id = 'rm_print_characters_block';
  doc.body.appendChild(charListBlock);

  const winListeners = new Map();
  const vvListeners = new Map();
  const dispatchedCustomEvents = [];

  const visualViewport = {
    width: innerWidth,
    height: innerHeight,
    offsetLeft: 0,
    offsetTop: 0,
    pageLeft: 0,
    pageTop: 0,
    scale: 1,
    addEventListener(type, fn, opts = {}) {
      const optObj = typeof opts === 'boolean' ? { capture: opts } : (opts || {});
      if (optObj?.signal?.aborted) return;
      if (!vvListeners.has(type)) vvListeners.set(type, []);
      const entry = { fn, once: Boolean(optObj.once) };
      vvListeners.get(type).push(entry);
      if (optObj?.signal) {
        optObj.signal.addEventListener('abort', () => {
          const cur = vvListeners.get(type) || [];
          vvListeners.set(type, cur.filter((e) => e !== entry));
        }, { once: true });
      }
    },
    removeEventListener(type, fn) {
      const cur = vvListeners.get(type) || [];
      vvListeners.set(type, cur.filter((e) => e.fn !== fn));
    },
    dispatchEvent(ev) {
      const list = [...(vvListeners.get(ev.type) || [])];
      for (const entry of list) {
        entry.fn(ev);
        if (entry.once) visualViewport.removeEventListener(ev.type, entry.fn);
      }
      return true;
    },
  };

  const win = {
    innerWidth,
    innerHeight,
    visualViewport,
    localStorage: activeStorage,
    CustomEvent: MockCustomEvent,
    MutationObserver: MockMutationObserver,
    matchMedia: (q) => ({
      matches: q.includes('coarse') ? coarse : q.includes('max-width: 680px') ? win.innerWidth <= 680 : false,
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
      const optObj = typeof opts === 'boolean' ? { capture: opts } : (opts || {});
      if (optObj?.signal?.aborted) return;
      if (!winListeners.has(type)) winListeners.set(type, []);
      const entry = { fn, once: Boolean(optObj.once) };
      winListeners.get(type).push(entry);
      if (optObj?.signal) {
        optObj.signal.addEventListener('abort', () => {
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
          this.copied = String(txt ?? '');
        },
      },
    },
  };
  doc.defaultView = win;

  doc.addEventListener('click', () => {
    personaMgmt.classList.remove('openDrawer');
  });

  const baseHeight = innerHeight;

  function simulateSoftKeyboard(kbHeight = 360) {
    const nextH = Math.max(220, baseHeight - Number(kbHeight || 0));
    win.innerHeight = nextH;
    win.visualViewport.height = nextH;
    doc.documentElement.clientHeight = nextH;
    win.visualViewport.dispatchEvent({ type: 'resize' });
    win.dispatchEvent({ type: 'resize' });
    return { width: win.innerWidth, height: win.innerHeight };
  }

  function resizeViewport(nextW, nextH) {
    win.innerWidth = nextW;
    win.innerHeight = nextH;
    win.visualViewport.width = nextW;
    win.visualViewport.height = nextH;
    doc.documentElement.clientWidth = nextW;
    doc.documentElement.clientHeight = nextH;
    win.visualViewport.dispatchEvent({ type: 'resize' });
    win.dispatchEvent({ type: 'resize' });
  }

  function typeWithIME(el, finalText, intermediateText = 'pinyin') {
    el.dispatchEvent({ type: 'compositionstart', bubbles: true, data: '' });
    el.value = intermediateText;
    el.dispatchEvent({ type: 'input', bubbles: true, isComposing: true });
    el.value = finalText;
    el.dispatchEvent({ type: 'compositionend', bubbles: true, data: finalText });
    el.dispatchEvent({ type: 'input', bubbles: true, isComposing: false });
  }

  function setInputValue(el, val) {
    el.value = String(val ?? '');
    el.dispatchEvent({ type: 'input', bubbles: true });
    el.dispatchEvent({ type: 'change', bubbles: true });
  }

  function selectOption(sel, val) {
    sel.value = String(val ?? '');
    sel.dispatchEvent({ type: 'change', bubbles: true });
  }

  async function waitTicks(ms = 0) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  return {
    ...env,
    doc,
    win,
    extMenu,
    extSettings2,
    personaMgmt,
    btnBlock,
    worldInfoSelect,
    charListBlock,
    dispatchedCustomEvents,
    simulateSoftKeyboard,
    resizeViewport,
    typeWithIME,
    setInputValue,
    selectOption,
    waitTicks,
  };
}

export function createRichHostFixture() {
  const worldbooks = new Map([
    [
      '主线背景书',
      {
        entries: {
          '0': {
            uid: 0,
            key: ['青岚港', '潮汐区'],
            comment: '城市地标与港口规则',
            content: '青岚港是靠海的旧城区，夜里雾重，老街书店九点打烊。',
            constant: false,
            selective: true,
            disable: false,
            order: 100,
            position: 0,
          },
        },
      },
    ],
    [
      '城市群像录',
      {
        entries: {
          '10': {
            uid: 10,
            key: ['地铁', '环线'],
            comment: '城市地铁线',
            content: '城市三号环线贯穿南区与旧书店街。',
            constant: false,
            selective: true,
            disable: false,
            order: 90,
            position: 0,
          },
        },
      },
    ],
    [
      '顾寒专属设定',
      {
        entries: {
          '20': {
            uid: 20,
            key: ['顾寒', '修表铺'],
            comment: '顾寒日常落脚点',
            content: '顾寒在巷口开了家修表铺，柜台抽屉常备薄荷糖和急救绷带。',
            constant: false,
            selective: true,
            disable: false,
            order: 100,
            position: 0,
          },
          '21': {
            uid: 21,
            key: ['旧案', '雨夜'],
            comment: '顾寒旧伤口由来',
            content: '顾寒左腕有一道三年前留下的淡疤，阴雨天偶尔发酸。',
            constant: false,
            selective: true,
            disable: false,
            order: 95,
            position: 0,
          },
          '22': {
            uid: 22,
            key: ['暗线', '密信'],
            comment: '顾寒隐藏线人网',
            content: '顾寒私下保留着港口旧同事的联络暗号。',
            constant: false,
            selective: true,
            disable: true,
            order: 80,
            position: 0,
          },
          '23': {
            uid: 23,
            key: ['机械表'],
            comment: '顾寒随身物品',
            content: '顾寒总戴着一只走了十五年的银壳机械表。',
            constant: false,
            selective: true,
            disable: false,
            order: 85,
            position: 0,
          },
        },
      },
    ],
  ]);

  const characters = [
    {
      name: '沈砚',
      avatar: 'shenyan.png',
      description: '沈砚二十六岁，城南旧书店店主，眉眼清俊，说话温吞却记性极好。',
      personality: '温和克制，遇事不慌，对熟人极有耐心。',
      scenario: '秋雨连绵的旧书店二楼茶室，两人正核对一批新收的旧书。',
      first_mes: '“雨这么大，先喝杯热茶再看书单吧。”沈砚把茶杯推到桌沿。',
      mes_examples: '<START>\n{{char}}: “别急，这页我替你夹好书签了。”',
      extensions: { world: '主线背景书' },
      shallow: false,
    },
    {
      name: '顾寒',
      avatar: 'guhan.png',
      description: '顾寒二十八岁，黑发微乱，常穿深灰工装外套，左腕戴银壳机械表。说话简短利落，习惯先动手把事办妥再开口。',
      personality: '外冷内热，护短且分寸感极强，不爱说多余的客套话。',
      scenario: '我是{{user}}的未婚夫，今晚我们被困在暴雪山庄的阁楼里等待救援。',
      first_mes: '“炉子生起来了，别站在窗边吹风。”顾寒把厚毯子丢过来。\n<status>好感度: 50 | 时间: 23:00</status>',
      mes_examples: '<START>\n{{char}}: “有事直接叫我，别自己硬扛。”\n{{char}}: “表修好了，走时分秒不差。”',
      extensions: { world: '顾寒专属设定' },
      character_book: {
        name: '顾寒内置书',
        entries: [
          {
            uid: 1,
            key: ['顾寒', '口癖'],
            comment: '顾寒说话语气',
            content: '顾寒习惯用短句陈述结论，很少反问。',
            disable: false,
          },
        ],
      },
      shallow: false,
    },
    {
      name: '苏晚',
      avatar: 'suwan.png',
      description: '苏晚二十五岁，社区甜品工作室主理人，笑眼弯弯，扎低丸子头，围裙口袋里总揣着记事小本子。',
      personality: '直爽热情又细心，最懂给朋友留面子。',
      scenario: '周末市集摊位前，刚出炉的可露丽散发黄油焦香。',
      first_mes: '“留了两盒原味的在柜台后面，专门给你带的。”',
      mes_examples: '<START>\n{{char}}: “先尝一口，不够我再烤一盘。”',
      extensions: { world: '' },
      shallow: false,
    },
    {
      name: '周牧',
      avatar: 'zhoumu.png',
      description: '周牧三十五岁，社区医院内科医生，戴细框眼镜，白大褂口袋别着银色钢笔。',
      personality: '沉稳温和，看病耐心细致，偶尔调侃熟人作息太差。',
      scenario: '夜间门诊值班室。',
      first_mes: '“又熬夜了？先把这杯温水喝了。”',
      mes_examples: '<START>\n{{char}}: “按时吃药，下周再来复查。”',
      extensions: { world: '' },
      shallow: false,
    },
  ];

  const powerUser = {
    personas: {
      'linqi.png': '林栖',
      'jiangcheng.png': '江澄',
      'baishu.png': '白术',
    },
    persona_descriptions: {
      'linqi.png': {
        description: [
          '【基础人设】',
          '姓名：林栖',
          '年龄：24 岁',
          '外貌：黑发及肩，左耳戴一枚素银小耳钉，常穿浅米色针织衫。',
          '性格：平时说话轻声细气，熟络后很会护短。',
          '生活习惯：睡前一定要喝半杯温牛奶，讨厌熬夜被催。',
          '技能：擅长修旧书和泡乌龙茶。',
          '【当前背景与关系】',
          '当前身份：旧书店兼职装帧师。',
          '与{{char}}关系：沈砚的合租室友兼店里帮手。',
        ].join('\n'),
        position: 0,
        depth: 2,
        role: 0,
        lorebook: '',
        title: '',
        connections: [],
      },
      'jiangcheng.png': {
        description: '【基础人设】\n姓名：江澄\n性格：直率果断。',
        position: 0,
        depth: 2,
        role: 0,
        lorebook: '',
        title: '',
        connections: [],
      },
      'baishu.png': {
        description: '【基础人设】\n姓名：白术\n性格：温和细心。',
        position: 0,
        depth: 2,
        role: 0,
        lorebook: '',
        title: '',
        connections: [],
      },
    },
    default_persona: 'linqi.png',
    persona_description: '',
    persona_description_lorebook: '',
    persona_description_position: 0,
    persona_description_depth: 2,
    persona_description_role: 0,
  };
  powerUser.persona_description = powerUser.persona_descriptions['linqi.png'].description;

  return { worldbooks, characters, powerUser };
}

export function createMockSTHost(env, config = {}) {
  const fixture = createRichHostFixture();
  const worldbooks = config.worldbooks || fixture.worldbooks;
  const characters = config.characters || fixture.characters;
  const powerUser = config.powerUser || fixture.powerUser;
  const extensionSettings = config.extensionSettings || {};
  const charLore = config.charLore || [];
  let userAvatar = config.userAvatar ?? 'linqi.png';
  let activeCharacterId = config.characterId ?? '0';
  let activeChatId = config.chatId ?? 'chat-active-001';
  const activeChatMessages = config.chatMessages || [{ mes: '开场聊天记录不可被改动' }];
  const capturedGenerations = [];
  const emittedEvents = [];
  const listeners = new Map();
  let nextUidCounter = 500;
  let avatarUploadCounter = 1;

  const eventSource = {
    on(evt, fn) {
      if (!listeners.has(evt)) listeners.set(evt, []);
      listeners.get(evt).push(fn);
    },
    off(evt, fn) {
      const cur = listeners.get(evt) || [];
      listeners.set(evt, cur.filter((f) => f !== fn));
    },
    removeListener(evt, fn) {
      this.off(evt, fn);
    },
    async emit(evt, payload) {
      emittedEvents.push({ evt, payload });
      const cur = [...(listeners.get(evt) || [])];
      for (const fn of cur) await fn(payload);
    },
  };

  const SlashCommandParser = {
    commands: {},
    addCommandObject(cmd) {
      if (cmd?.name) this.commands[cmd.name] = cmd;
    },
  };

  function syncWorldInfoSelectDom() {
    if (!env?.worldInfoSelect) return;
    const opts = Array.from(worldbooks.keys()).map((name) => {
      const opt = env.doc.createElement('option');
      opt.value = name;
      opt.textContent = name;
      return opt;
    });
    env.worldInfoSelect.replaceChildren(...opts);
  }

  function syncCharacterCardsDom() {
    if (!env?.charListBlock) return;
    const cards = characters.map((ch, idx) => {
      const card = env.doc.createElement('div');
      card.className = 'character_select';
      card.setAttribute('data-chid', String(idx));
      card.setAttribute('data-avatar', ch.avatar || '');
      const nameBlock = env.doc.createElement('div');
      nameBlock.className = 'character_name_block';
      nameBlock.textContent = ch.name || '';
      card.appendChild(nameBlock);
      return card;
    });
    env.charListBlock.replaceChildren(...cards);
  }

  const defaultLlmResponder = (messages) => {
    const joined = messages.map((m) => m.content).join('\n');
    const isStructured = /结构化|键值|清单/.test(joined);
    const hasSplit = /【补充世界书条目】/.test(joined);
    const baseBody = isStructured
      ? [
          '【基础人设】',
          '姓名：林栖',
          '年龄：24 岁',
          '外貌与穿搭：黑发齐肩，常穿浅灰针织衫与牛仔裤，左腕戴旧款银表。',
          '性格与行为逻辑：说话直接却分寸得当，高兴时眉眼微弯，生气时语速变慢并先收拾桌面。',
          '生活与做事习惯：每天早起泡一壶清茶，出门前必检查钥匙和手机电量。',
          '【当前背景与关系】',
          '当前处境：住在青岚港老城区二楼，白天在街角打理旧物铺。',
          '与{{char}}关系：平时各自忙碌，碰面时会自然搭话照应。',
        ].join('\n')
      : [
          '【基础人设】',
          '## 外貌与气质',
          '林栖二十四岁，黑发齐肩，日常穿宽松浅色针织衫，整个人看着干净利落。',
          '## 性格与习惯',
          '待人平和有边界，遇到急事能先稳住节奏再逐项处理，习惯睡前整理第二天要用的物品。',
          '【当前背景与关系】',
          '## 身份与关系',
          '在青岚港经营小型修补铺子，与{{char}}是同一条老街上的熟识邻居。',
        ].join('\n');

    if (hasSplit) {
      return [
        baseBody,
        '',
        '【补充世界书条目】',
        '[条目：老街修补铺日常]',
        '关键词：修补铺, 青岚港',
        '内容：林栖在街角租了半间门面修补旧物件，柜台抽屉常备针线包和创可贴。',
      ].join('\n');
    }
    return baseBody;
  };

  let llmResponder = config.llmResponder || defaultLlmResponder;

  const ctx = {
    get name1() {
      return powerUser.personas[userAvatar] || '林栖';
    },
    get name2() {
      return characters[Number(activeCharacterId)]?.name || '沈砚';
    },
    get userAvatar() {
      return userAvatar;
    },
    get characterId() {
      return activeCharacterId;
    },
    set characterId(v) {
      activeCharacterId = String(v);
    },
    get chatId() {
      return activeChatId;
    },
    getCurrentChatId: () => activeChatId,
    chat: activeChatMessages,
    characters,
    powerUserSettings: powerUser,
    extensionSettings,
    worldNames: Array.from(worldbooks.keys()),
    get worldInfo() {
      return {
        charLore,
        world_names: Array.from(worldbooks.keys()),
      };
    },
    eventSource,
    eventTypes: {
      APP_READY: 'app_ready',
      CHAT_CHANGED: 'chat_changed',
      CHARACTER_EDITED: 'character_edited',
      CHARACTER_DELETED: 'character_deleted',
      PERSONA_UPDATED: 'persona_updated',
      PERSONA_CREATED: 'persona_created',
      PERSONA_RENAMED: 'persona_renamed',
    },
    SlashCommandParser,
    SlashCommand: { fromProps: (p) => p },
    mainApi: 'openai',
    chatCompletionSettings: {
      chat_completion_source: 'openai',
      openai_model: 'mock-gpt-4o',
      stream_openai: false,
    },
    ChatCompletionService: {
      presetToGeneratePayload: async (_p, _o, override) => override,
      sendRequest: async (requestData) => {
        const meta = { source: 'host:chat-completion', model: requestData.model || '' };
        capturedGenerations.push({ messages: requestData.messages, meta });
        const content = await llmResponder(requestData.messages, meta);
        return { content };
      },
    },
    saveSettingsDebounced: async () => {},
  };

  const loadWorldInfo = async (name) => {
    const clean = String(name ?? '').trim();
    const wb = worldbooks.get(clean);
    return wb ? JSON.parse(JSON.stringify(wb)) : { entries: {} };
  };

  const saveWorldInfo = async (name, data) => {
    const clean = String(name ?? '').trim();
    if (!clean) throw new Error('worldName required');
    worldbooks.set(clean, JSON.parse(JSON.stringify(data || { entries: {} })));
    ctx.worldNames = Array.from(worldbooks.keys());
    syncWorldInfoSelectDom();
  };

  const createWorldInfoEntry = (_name, data) => {
    if (!data.entries || typeof data.entries !== 'object') data.entries = {};
    let uid = nextUidCounter;
    while (Object.hasOwn(data.entries, uid) || Object.hasOwn(data.entries, String(uid))) {
      uid += 1;
    }
    nextUidCounter = uid + 1;
    const entry = {
      uid,
      key: [],
      keysecondary: [],
      comment: '',
      content: '',
      constant: false,
      selective: true,
      selectiveLogic: 0,
      addMemo: true,
      order: 100,
      position: 0,
      disable: false,
    };
    data.entries[uid] = entry;
    return entry;
  };

  const fetchImpl = async (url, init = {}) => {
    const urlStr = String(url || '');
    if (urlStr.includes('/api/worldinfo/get')) {
      const body = init.body ? JSON.parse(init.body) : {};
      const wb = await loadWorldInfo(body.name);
      return { ok: true, status: 200, json: async () => wb };
    }
    if (urlStr.includes('/api/worldinfo/list') || urlStr.includes('/api/worldinfo/all')) {
      return { ok: true, status: 200, json: async () => Array.from(worldbooks.keys()) };
    }
    if (urlStr.includes('/api/avatars/upload')) {
      const fileId = `mock-persona-${avatarUploadCounter++}.png`;
      return { ok: true, status: 200, json: async () => ({ path: `User Avatars/${fileId}` }) };
    }
    if (urlStr.includes('img/user-default.png')) {
      return {
        ok: true,
        status: 200,
        blob: async () => new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' }),
      };
    }
    if (urlStr.includes('/api/characters/get')) {
      const body = init.body ? JSON.parse(init.body) : {};
      const found = characters.find((c) => c.avatar === body.avatar_url) || null;
      return { ok: Boolean(found), status: found ? 200 : 404, json: async () => found || {} };
    }
    if (urlStr.includes('/chat/completions')) {
      const body = init.body ? JSON.parse(init.body) : {};
      const meta = { source: 'custom', url: urlStr, model: body.model || '' };
      capturedGenerations.push({ messages: body.messages || [], meta });
      const content = await llmResponder(body.messages || [], meta);
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ choices: [{ message: { content } }] }),
        json: async () => ({ choices: [{ message: { content } }] }),
      };
    }
    return { ok: false, status: 404, text: async () => 'Not Found' };
  };

  let prevGlobals = null;

  const bridge = {
    context: ctx,
    powerUser,
    extensionSettings,
    charLore,
    getUserAvatar: () => userAvatar,
    setUserAvatar: async (avatarId) => {
      userAvatar = avatarId;
      if (powerUser.persona_descriptions[avatarId]) {
        powerUser.persona_description = powerUser.persona_descriptions[avatarId].description || '';
        powerUser.persona_description_lorebook = powerUser.persona_descriptions[avatarId].lorebook || '';
      }
    },
    setUserName: (nextName) => {
      if (userAvatar && Object.hasOwn(powerUser.personas, userAvatar)) {
        powerUser.personas[userAvatar] = nextName;
      }
    },
    setPersonaDescription: () => {},
    getUserAvatars: async () => Object.keys(powerUser.personas),
    initPersona: async (avatarId, name, desc, title = '', opts = {}) => {
      powerUser.personas[avatarId] = name;
      powerUser.persona_descriptions[avatarId] = {
        description: desc,
        position: opts.position ?? 0,
        depth: opts.depth ?? 2,
        role: opts.role ?? 0,
        lorebook: opts.lorebook ?? '',
        title,
        connections: [],
      };
    },
    loadWorldInfo,
    saveWorldInfo,
    createWorldInfoEntry,
    updateWorldInfoList: async () => {
      ctx.worldNames = Array.from(worldbooks.keys());
      syncWorldInfoSelectDom();
    },
    saveSettingsDebounced: async () => {},
    fetch: fetchImpl,
    getRequestHeaders: async () => ({ 'Content-Type': 'application/json' }),
    eventSource,
    eventTypes: ctx.eventTypes,
    window: env.win,
    CustomEvent: env.win.CustomEvent,
    get worldNames() {
      return Array.from(worldbooks.keys());
    },
    getWorldInfoNames: async () => Array.from(worldbooks.keys()),
  };

  function install() {
    prevGlobals = {
      bridge: globalThis.__UPS_HOST_BRIDGE__,
      localStorage: globalThis.localStorage,
      fetch: globalThis.fetch,
      SillyTavern: globalThis.SillyTavern,
      CustomEvent: globalThis.CustomEvent,
      MutationObserver: globalThis.MutationObserver,
    };
    globalThis.__UPS_HOST_BRIDGE__ = bridge;
    globalThis.localStorage = env.storage;
    globalThis.fetch = fetchImpl;
    globalThis.SillyTavern = { getContext: () => ctx };
    globalThis.CustomEvent = env.win.CustomEvent;
    globalThis.MutationObserver = env.win.MutationObserver;
    syncWorldInfoSelectDom();
    syncCharacterCardsDom();
    return bridge;
  }

  function cleanup(resetHostCacheFn = null) {
    if (prevGlobals) {
      if (prevGlobals.bridge === undefined) delete globalThis.__UPS_HOST_BRIDGE__;
      else globalThis.__UPS_HOST_BRIDGE__ = prevGlobals.bridge;
      if (prevGlobals.localStorage === undefined) delete globalThis.localStorage;
      else globalThis.localStorage = prevGlobals.localStorage;
      if (prevGlobals.fetch === undefined) delete globalThis.fetch;
      else globalThis.fetch = prevGlobals.fetch;
      if (prevGlobals.SillyTavern === undefined) delete globalThis.SillyTavern;
      else globalThis.SillyTavern = prevGlobals.SillyTavern;
      if (prevGlobals.CustomEvent === undefined) delete globalThis.CustomEvent;
      else globalThis.CustomEvent = prevGlobals.CustomEvent;
      if (prevGlobals.MutationObserver === undefined) delete globalThis.MutationObserver;
      else globalThis.MutationObserver = prevGlobals.MutationObserver;
      prevGlobals = null;
    }
    if (typeof resetHostCacheFn === 'function') {
      resetHostCacheFn();
    }
  }

  return {
    ctx,
    bridge,
    worldbooks,
    characters,
    powerUser,
    extensionSettings,
    charLore,
    eventSource,
    emittedEvents,
    capturedGenerations,
    getUserAvatar: () => userAvatar,
    setUserAvatar: (id) => {
      userAvatar = id;
    },
    getActiveChatId: () => activeChatId,
    getActiveCharacterId: () => activeCharacterId,
    getActiveChatMessages: () => activeChatMessages,
    setLlmResponder: (fn) => {
      llmResponder = fn;
    },
    install,
    cleanup,
  };
}

export function extractCssRuleBlocks(cssText, matcher) {
  const src = String(cssText || '');
  const blocks = [];
  let i = 0;
  while (i < src.length) {
    const openIdx = src.indexOf('{', i);
    if (openIdx === -1) break;
    const header = src.slice(i, openIdx).trim();
    let depth = 1;
    let j = openIdx + 1;
    while (j < src.length && depth > 0) {
      if (src[j] === '{') depth += 1;
      else if (src[j] === '}') depth -= 1;
      j += 1;
    }
    const body = src.slice(openIdx + 1, j - 1);
    const matched = typeof matcher === 'function' ? matcher(header) : header.includes(matcher);
    if (matched) {
      blocks.push({ header, body });
    }
    i = j;
  }
  return blocks;
}

export function listRepoTextFiles() {
  const results = [];
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ent.name === '.git' || ent.name === 'node_modules') continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(full);
      } else if (/\.(js|mjs|css|json|md)$/i.test(ent.name)) {
        results.push({
          rel: path.relative(REPO_ROOT, full).replace(/\\/g, '/'),
          full,
          text: fs.readFileSync(full, 'utf8'),
        });
      }
    }
  };
  walk(REPO_ROOT);
  return results;
}

export function decodeBase64List(encodedList) {
  return encodedList.map((b) => Buffer.from(b, 'base64').toString('utf8'));
}
