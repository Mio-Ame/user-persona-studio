import {
  CORE_SECTION_HEADER,
  SHELL_SECTION_HEADER,
  DEFAULT_BANNED_PHRASES,
  QUALITATIVE_LABEL_PATTERNS,
  DEFAULT_PREFILL,
  DEFAULT_TRIGGER,
  createDefaultSettings,
  sanitizeSettingsForExport,
  toggleStackEntry,
  moveStackEntry,
  updateStackEntry,
  addCustomStackEntry,
  removeStackEntry,
  saveSchemeAs,
  renameScheme,
  deleteScheme,
  buildGenerationMessages,
  exportSillyTavernPreset,
  estimateTokens,
  normalizeFlatLayout,
  lintPersonaText,
  splitCoreAndShell,
  splitDualLayerOutput,
  parsePersonaSections,
  computeLineDiff,
  mergeSectionUpdate,
  extractTasteCandidates,
  mergeTasteEntries,
  normalizeBaseUrl,
  maskApiKey,
  createApiProfile,
} from './core.js';
import {
  getActivePersona,
  listPersonas,
  getActiveCharacterContext,
  savePersonaToHost,
  saveSupplementaryWorldbook,
  saveSettings,
} from './host.js';
import {
  runStudioGeneration,
  fetchCustomModels,
  testCustomConnection,
  scrubApiKeyFromText,
} from './api.js';
import {
  PALETTE_OPTIONS,
  COLOR_MODE_OPTIONS,
  SHADOW_CSS,
  readHostThemeVars,
  applyThemeToRoot,
} from './styles.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const INTERACTIVE_DRAG_IGNORE = 'button, select, input, textarea, a, label, [role="button"], [role="switch"], option';

// ============================================================================
// Pure Geometry & Draft History Helpers (Node-testable)
// ============================================================================

export function clampModalSize({ width, height, viewportWidth, viewportHeight } = {}) {
  const vw = Math.max(1, Number(viewportWidth) || 1280);
  const vh = Math.max(1, Number(viewportHeight) || 800);
  const maxWidth = Math.max(1, Math.floor(vw * 0.96));
  const maxHeight = Math.max(1, Math.floor(vh * 0.92));
  const minWidth = Math.min(vw <= 640 ? Math.min(310, Math.max(1, vw - 16)) : 320, maxWidth);
  const minHeight = Math.min(vw <= 640 ? 240 : 280, maxHeight);
  const hasWidth = width !== null && width !== undefined && String(width).trim() !== '' && typeof width !== 'boolean' && Number.isFinite(Number(width));
  const hasHeight = height !== null && height !== undefined && String(height).trim() !== '' && typeof height !== 'boolean' && Number.isFinite(Number(height));
  const rawW = hasWidth ? Number(width) : 820;
  const rawH = hasHeight ? Number(height) : 620;
  const w = Math.max(minWidth, Math.min(maxWidth, Math.round(rawW)));
  const h = Math.max(minHeight, Math.min(maxHeight, Math.round(rawH)));
  return { width: w, height: h, minWidth, maxWidth, minHeight, maxHeight };
}

export function clampModalRect({
  left,
  top,
  width,
  height,
  viewportWidth,
  viewportHeight,
  marginX = 8,
  marginTop = 8,
  marginBottom = 8,
} = {}) {
  const vw = Math.max(1, Number(viewportWidth) || 1280);
  const vh = Math.max(1, Number(viewportHeight) || 800);
  const sized = clampModalSize({ width, height, viewportWidth: vw, viewportHeight: vh });
  const safeW = Math.min(sized.width, Math.max(1, vw - marginX * 2));
  const safeH = Math.min(sized.height, Math.max(1, vh - marginTop - marginBottom));
  const maxLeft = Math.max(marginX, vw - safeW - marginX);
  const maxTop = Math.max(marginTop, vh - safeH - marginBottom);
  const rawLeft = Number.isFinite(Number(left)) ? Number(left) : Math.round((vw - safeW) / 2);
  const rawTop = Number.isFinite(Number(top)) ? Number(top) : Math.round((vh - safeH) / 2);
  return {
    left: Math.round(Math.max(marginX, Math.min(maxLeft, rawLeft))),
    top: Math.round(Math.max(marginTop, Math.min(maxTop, rawTop))),
    width: Math.round(safeW),
    height: Math.round(safeH),
  };
}

export function computeDraggedModalPosition({
  origLeft,
  origTop,
  dx = 0,
  dy = 0,
  width,
  height,
  viewportWidth,
  viewportHeight,
} = {}) {
  const clamped = clampModalRect({
    left: (Number(origLeft) || 0) + (Number(dx) || 0),
    top: (Number(origTop) || 0) + (Number(dy) || 0),
    width,
    height,
    viewportWidth,
    viewportHeight,
  });
  return { left: clamped.left, top: clamped.top };
}

export function computeResizedModalRect({
  origLeft,
  origTop,
  origWidth,
  origHeight,
  dx = 0,
  dy = 0,
  handle = 'se',
  viewportWidth,
  viewportHeight,
} = {}) {
  const vw = Math.max(1, Number(viewportWidth) || 1280);
  const vh = Math.max(1, Number(viewportHeight) || 800);
  const left = Math.max(8, Math.round(Number(origLeft) || 0));
  const top = Math.max(8, Math.round(Number(origTop) || 0));
  const dX = Number(dx) || 0;
  const dY = Number(dy) || 0;

  let nextWidth = Number(origWidth) || 820;
  let nextHeight = Number(origHeight) || 620;
  let nextLeft = left;
  let nextTop = top;

  if (handle.includes('e')) nextWidth += dX;
  if (handle.includes('s')) nextHeight += dY;
  if (handle.includes('w')) {
    nextWidth -= dX;
    nextLeft += dX;
  }
  if (handle.includes('n')) {
    nextHeight -= dY;
    nextTop += dY;
  }

  const maxAvailW = Math.max(1, vw - nextLeft - 8);
  const maxAvailH = Math.max(1, vh - nextTop - 8);
  const sized = clampModalSize({
    width: Math.min(nextWidth, maxAvailW),
    height: Math.min(nextHeight, maxAvailH),
    viewportWidth: vw,
    viewportHeight: vh,
  });

  return clampModalRect({
    left: nextLeft,
    top: nextTop,
    width: sized.width,
    height: sized.height,
    viewportWidth: vw,
    viewportHeight: vh,
  });
}

export function computeMiniWindowRect({ viewportWidth, viewportHeight, heightRatio } = {}) {
  const vw = Math.max(1, Number(viewportWidth) || 1280);
  const vh = Math.max(1, Number(viewportHeight) || 800);
  const isMobile = vw <= 640;
  const ratio = Number.isFinite(Number(heightRatio))
    ? Math.max(0.25, Math.min(0.65, Number(heightRatio)))
    : isMobile
      ? 0.46
      : 0.49;

  if (isMobile) {
    const width = Math.max(1, vw - 16);
    const height = Math.max(Math.min(240, Math.max(1, vh - 16)), Math.min(440, Math.round(vh * ratio)));
    const left = Math.max(0, Math.round((vw - width) / 2));
    const top = Math.max(8, vh - height - 10);
    return { left, top, width, height };
  }

  const width = Math.min(640, Math.max(320, Math.floor(vw * 0.92)));
  const height = Math.max(280, Math.min(430, Math.round(vh * ratio)));
  const left = Math.round((vw - width) / 2);
  const top = Math.max(8, vh - height - 12);
  return { left, top, width, height };
}

export function computeRestorePillPosition({
  pillWidth = 176,
  pillHeight = 36,
  viewportWidth = 1280,
  viewportHeight = 800,
  safeBottom = 0,
} = {}) {
  const vw = Math.max(1, Number(viewportWidth) || 1280);
  const vh = Math.max(1, Number(viewportHeight) || 800);
  const w = Math.max(80, Math.min(vw - 20, Math.round(Number(pillWidth) || 176)));
  const h = Math.max(28, Math.round(Number(pillHeight) || 36));
  const left = Math.max(10, vw - w - 14);
  const top = Math.max(10, vh - h - 14 - Math.max(0, Number(safeBottom) || 0));
  return { left, top };
}

export function createDraftHistory(initialValue = '', maxDepth = 50) {
  const limit = Math.max(2, Math.round(Number(maxDepth) || 50));
  let entries = [String(initialValue ?? '')];
  let cursor = 0;

  return {
    getValue() {
      return entries[cursor];
    },
    push(nextValue) {
      const val = String(nextValue ?? '');
      if (val === entries[cursor]) return false;
      entries = entries.slice(0, cursor + 1);
      entries.push(val);
      if (entries.length > limit) {
        const drop = entries.length - limit;
        entries = entries.slice(drop);
      }
      cursor = entries.length - 1;
      return true;
    },
    undo() {
      if (cursor <= 0) return entries[cursor];
      cursor -= 1;
      return entries[cursor];
    },
    redo() {
      if (cursor >= entries.length - 1) return entries[cursor];
      cursor += 1;
      return entries[cursor];
    },
    canUndo() {
      return cursor > 0;
    },
    canRedo() {
      return cursor < entries.length - 1;
    },
    reset(nextValue = '') {
      entries = [String(nextValue ?? '')];
      cursor = 0;
    },
    size() {
      return entries.length;
    },
  };
}

// ============================================================================
// Strict XSS-Safe DOM & SVG Helpers
// ============================================================================

function createEl(doc, tag, props = {}, children = []) {
  const node = doc.createElement(tag);
  const lowerTag = String(tag).toLowerCase();
  if (lowerTag === 'input' || lowerTag === 'textarea') {
    node.spellcheck = false;
    node.setAttribute('spellcheck', 'false');
  }
  for (const [key, val] of Object.entries(props || {})) {
    if (val === undefined || val === null) continue;
    if (key === 'className') {
      node.className = val;
    } else if (key === 'text') {
      node.textContent = String(val);
    } else if (key === 'dataset' && typeof val === 'object') {
      for (const [dk, dv] of Object.entries(val)) {
        if (dv !== undefined && dv !== null) {
          if (node.dataset) node.dataset[dk] = String(dv);
          else node.setAttribute(`data-${dk.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`, String(dv));
        }
      }
    } else if (key === 'attrs' && typeof val === 'object') {
      for (const [ak, av] of Object.entries(val)) {
        if (av !== undefined && av !== null) {
          node.setAttribute(ak, String(av));
        }
      }
    } else if (key === 'style' && typeof val === 'object') {
      for (const [sk, sv] of Object.entries(val)) {
        if (sv !== undefined && sv !== null) node.style[sk] = String(sv);
      }
    } else if (key === 'disabled' || key === 'checked' || key === 'hidden' || key === 'readOnly' || key === 'selected') {
      node[key] = Boolean(val);
      if (key === 'hidden' && val) node.setAttribute('hidden', '');
    } else if (key === 'type' || key === 'value' || key === 'placeholder' || key === 'title' || key === 'id' || key === 'rows' || key === 'autocomplete') {
      node[key] = val;
      if (key === 'placeholder' || key === 'title' || key === 'type' || key === 'id') {
        node.setAttribute(key, String(val));
      }
    } else {
      node.setAttribute(key, String(val));
    }
  }
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child === null || child === undefined || child === false) continue;
    if (typeof child === 'string' || typeof child === 'number') {
      node.appendChild(doc.createTextNode(String(child)));
    } else {
      node.appendChild(child);
    }
  }
  return node;
}

function createSvgIcon(doc, pathDefs = [], size = 15) {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of pathDefs) {
    const p = doc.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', d);
    svg.appendChild(p);
  }
  return svg;
}

function canAutoFocusDesktop(win) {
  const w = Number(win?.innerWidth || 0);
  const coarse = Boolean(win?.matchMedia?.('(pointer: coarse)')?.matches);
  return w > 640 && !coarse;
}

function stopHostDrawerCollapse(node, signal) {
  if (!node || typeof node.addEventListener !== 'function') return;
  const stop = (ev) => {
    ev.stopPropagation();
  };
  const opts = signal ? { signal } : undefined;
  const touchOpts = signal ? { passive: true, signal } : { passive: true };
  node.addEventListener('mousedown', stop, opts);
  node.addEventListener('touchstart', stop, touchOpts);
  node.addEventListener('click', stop, opts);
}

function getActiveScheme(settings) {
  const list = Array.isArray(settings?.schemes) ? settings.schemes : [];
  return list.find((s) => s.id === settings.activeSchemeId) || list[0] || null;
}

function getActiveCustomProfile(settings) {
  const list = Array.isArray(settings?.api?.profiles) ? settings.api.profiles : [];
  return list.find((p) => p.id === settings.api?.activeProfileId) || list[0] || null;
}

function getTextareaCurrentLine(textarea) {
  if (!textarea) return '';
  const value = String(textarea.value ?? '');
  const start = Number(textarea.selectionStart || 0);
  const end = Number(textarea.selectionEnd || 0);
  if (end > start) {
    return value.slice(start, end).trim();
  }
  const before = value.slice(0, start);
  const lineStart = before.lastIndexOf('\n') + 1;
  const afterIdx = value.indexOf('\n', start);
  const lineEnd = afterIdx === -1 ? value.length : afterIdx;
  return value.slice(lineStart, lineEnd).trim();
}

function triggerJsonDownload(doc, win, filename, payloadObj) {
  const jsonText = JSON.stringify(payloadObj, null, 2);
  const BlobCtor = win?.Blob || globalThis.Blob;
  const urlApi = win?.URL || globalThis.URL;
  if (BlobCtor && urlApi && typeof urlApi.createObjectURL === 'function') {
    const blob = new BlobCtor([jsonText], { type: 'application/json;charset=utf-8' });
    const url = urlApi.createObjectURL(blob);
    const a = doc.createElement('a');
    a.href = url;
    a.setAttribute('href', url);
    a.download = filename;
    a.setAttribute('download', filename);
    a.style.display = 'none';
    doc.body?.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => {
      try {
        urlApi.revokeObjectURL(url);
      } catch {
        // ignore
      }
    }, 1000);
  }
  return jsonText;
}

// ============================================================================
// Studio UI Factory
// ============================================================================

export function createStudioUI(options = {}) {
  const doc = options.doc || (typeof document !== 'undefined' ? document : null);
  const win = options.win || (typeof window !== 'undefined' ? window : null);
  const mountTarget = options.mountTarget || doc?.body || null;
  if (!doc || !mountTarget) {
    throw new Error('createStudioUI requires a valid DOM document and mountTarget');
  }

  const hostApi = {
    getActivePersona: options.hostApi?.getActivePersona || getActivePersona,
    listPersonas: options.hostApi?.listPersonas || listPersonas,
    getActiveCharacterContext: options.hostApi?.getActiveCharacterContext || getActiveCharacterContext,
    savePersonaToHost: options.hostApi?.savePersonaToHost || savePersonaToHost,
    saveSupplementaryWorldbook: options.hostApi?.saveSupplementaryWorldbook || saveSupplementaryWorldbook,
    runStudioGeneration: options.hostApi?.runStudioGeneration || runStudioGeneration,
    fetchCustomModels: options.hostApi?.fetchCustomModels || fetchCustomModels,
    testCustomConnection: options.hostApi?.testCustomConnection || testCustomConnection,
    saveSettings: options.onSaveSettings || ((s) => saveSettings(s)),
  };

  const lifecycleAc = new AbortController();
  const { signal } = lifecycleAc;

  let settings = createDefaultSettings(options.initialSettings);
  const draftHistory = createDraftHistory('', 60);

  const state = {
    isOpen: false,
    minimized: false,
    miniMode: Boolean(settings.ui.miniMode),
    activeTab: 'studio', // studio | presets | taste | settings
    mode: 'A', // A | B
    subMode: 'de_label_reformat',
    injectChar: true,
    dualLayer: false,
    isGenerating: false,
    isSaving: false,
    genAbort: null,
    fetchModelsAbort: null,
    testConnAbort: null,
    baselineDraft: '',
    tasteBaselineDraft: '',
    lastCandidates: { bannedCandidates: [], anchorCandidates: [] },
    cachedActivePersona: null,
    cachedPersonas: [],
    cachedCharContext: null,
    expandedEntryIds: new Set(),
    stackSearchQuery: '',
    stackSearchComposing: false,
    tasteSearchQuery: '',
    tasteSearchComposing: false,
    fetchedModels: [],
    revealApiKey: false,
    pendingDeleteProfileId: '',
    normalRect: null,
    savedBodyScrollTop: 0,
    statusText: '就绪',
    statusTone: 'muted',
  };

  // Root Shadow Host
  const host = createEl(doc, 'div', {
    id: 'user-persona-studio-host',
    attrs: { 'data-ups-host': 'true' },
  });
  const shadow = host.attachShadow({ mode: 'open' });
  const styleEl = createEl(doc, 'style', { text: SHADOW_CSS });
  shadow.appendChild(styleEl);

  const backdropEl = createEl(doc, 'div', {
    className: 'ups-backdrop ups-theme-root',
    hidden: true,
    attrs: { 'data-ups-backdrop': 'true' },
  });

  const modalEl = createEl(doc, 'section', {
    className: 'ups-modal is-resizable',
    attrs: {
      'data-ups-window': 'true',
      role: 'dialog',
      'aria-modal': 'false',
      'aria-label': '客制化成长型 User 人设工坊',
    },
  });

  // Topbar
  const ctxChip = createEl(doc, 'span', {
    className: 'ups-ctx-chip',
    text: '未关联角色',
    hidden: true,
  });

  const paletteSelect = createEl(
    doc,
    'select',
    {
      className: 'ups-palette-select',
      title: '切换面板配色',
      attrs: { 'data-ups-palette': 'true', 'aria-label': '面板配色' },
    },
    PALETTE_OPTIONS.map((p) => createEl(doc, 'option', { value: p.id, text: p.label }))
  );
  paletteSelect.value = settings.palette;

  const minimizeBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-icon-btn',
    text: '—',
    title: '最小化为挂起胶囊',
    attrs: { 'data-ups-minimize': 'true', 'aria-label': '最小化' },
  });

  const miniBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-icon-btn',
    text: '小窗',
    title: '切换对照小窗',
    attrs: { 'data-ups-mini': 'true', 'aria-label': '切换对照小窗' },
  });

  const closeBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-icon-btn',
    text: '×',
    title: '关闭工坊',
    attrs: { 'data-ups-close': 'true', 'aria-label': '关闭' },
  });

  const topbarEl = createEl(
    doc,
    'header',
    { className: 'ups-header', attrs: { 'data-ups-topbar': 'true' } },
    [
      createEl(doc, 'div', { className: 'ups-header-title-wrap' }, [
        createEl(doc, 'span', { className: 'ups-title-icon' }, [
          createSvgIcon(doc, ['M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3z', 'M5 18h14'], 16),
        ]),
        createEl(doc, 'span', { className: 'ups-header-title', text: 'User 人设工坊' }),
        ctxChip,
      ]),
      createEl(doc, 'div', { className: 'ups-header-actions' }, [
        paletteSelect,
        minimizeBtn,
        miniBtn,
        closeBtn,
      ]),
    ]
  );

  // Constant 4-Tab Bar
  const TAB_DEFS = [
    { id: 'studio', label: '工坊主页' },
    { id: 'presets', label: '预设条目栈' },
    { id: 'taste', label: '审美成长库' },
    { id: 'settings', label: '连接与设置' },
  ];
  const tabButtons = new Map();
  const tabsBarEl = createEl(
    doc,
    'nav',
    {
      className: 'ups-tabs',
      attrs: { 'data-ups-tabs': 'true', role: 'tablist', 'aria-label': '工坊功能页签' },
    },
    TAB_DEFS.map((t) => {
      const btn = createEl(doc, 'button', {
        type: 'button',
        className: `ups-tab${t.id === state.activeTab ? ' is-active' : ''}`,
        text: t.label,
        attrs: {
          role: 'tab',
          'data-ups-tab': t.id,
          'aria-selected': t.id === state.activeTab ? 'true' : 'false',
        },
      });
      tabButtons.set(t.id, btn);
      return btn;
    })
  );

  const bodyEl = createEl(doc, 'main', {
    className: 'ups-body',
    attrs: { 'data-ups-body': 'true' },
  });

  // Footer
  const statusEl = createEl(doc, 'span', {
    className: 'ups-footer-status',
    text: '就绪',
    attrs: { 'data-ups-status': 'true' },
  });
  const undoBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-ghost',
    text: '撤销',
    disabled: true,
    attrs: { 'data-ups-undo': 'true' },
  });
  const redoBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-ghost',
    text: '重做',
    disabled: true,
    attrs: { 'data-ups-redo': 'true' },
  });
  const copyBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-ghost',
    text: '复制',
    attrs: { 'data-ups-copy': 'true' },
  });
  const exportPresetBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn',
    text: '导出预设',
    title: '导出酒馆原生预设 JSON',
    attrs: { 'data-ups-export-preset': 'true' },
  });
  const footerSaveBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn ups-btn-primary',
    text: '保存',
    title: '保存至当前酒馆 User 人设',
    attrs: { 'data-ups-footer-save': 'true' },
  });

  const footerEl = createEl(
    doc,
    'footer',
    { className: 'ups-footer', attrs: { 'data-ups-footer': 'true' } },
    [
      statusEl,
      createEl(doc, 'div', { className: 'ups-footer-actions' }, [
        undoBtn,
        redoBtn,
        copyBtn,
        exportPresetBtn,
        footerSaveBtn,
      ]),
    ]
  );

  const resizeHandleEl = createEl(
    doc,
    'div',
    {
      className: 'ups-resize-handle',
      title: '拖拽调整窗口大小',
      attrs: { 'data-ups-resize': 'true', 'aria-label': '调整窗口大小' },
    },
    [createSvgIcon(doc, ['M16 20l4-4', 'M10 20l10-10'], 13)]
  );

  modalEl.appendChild(topbarEl);
  modalEl.appendChild(tabsBarEl);
  modalEl.appendChild(bodyEl);
  modalEl.appendChild(footerEl);
  modalEl.appendChild(resizeHandleEl);
  backdropEl.appendChild(modalEl);

  // Minimized Capsule Pill
  const pillEl = createEl(
    doc,
    'button',
    {
      type: 'button',
      className: 'ups-minimized-pill ups-theme-root',
      hidden: true,
      attrs: { 'data-ups-pill': 'true', 'aria-label': '恢复 User 人设工坊' },
    },
    [
      createSvgIcon(doc, ['M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3z'], 14),
      createEl(doc, 'span', { text: '人设工坊 · 点击恢复' }),
    ]
  );

  // Strategy Popover
  const injectCharCheckbox = createEl(doc, 'input', { type: 'checkbox', checked: state.injectChar });
  const dualLayerCheckbox = createEl(doc, 'input', { type: 'checkbox', checked: state.dualLayer });
  const popoverTailSelect = createEl(
    doc,
    'select',
    { className: 'ups-select', attrs: { 'data-ups-popover-tail': 'true' } },
    [
      createEl(doc, 'option', { value: 'user', text: '末尾为 user（通用兼容）' }),
      createEl(doc, 'option', { value: 'assistant_prefill', text: '末尾为 assistant 预填充' }),
      createEl(doc, 'option', { value: 'prefill_plus_user', text: '预填充 + 末尾 user 触发' }),
    ]
  );
  const charContextHint = createEl(doc, 'div', { className: 'ups-muted', text: '当前角色：检测中…' });

  const popoverEl = createEl(
    doc,
    'div',
    {
      className: 'ups-popover ups-theme-root',
      hidden: true,
      attrs: { 'data-ups-popover': 'true' },
    },
    [
      createEl(doc, 'div', { className: 'ups-card-title', text: '生成与末尾角色策略' }),
      createEl(doc, 'label', { className: 'ups-check-row' }, [
        injectCharCheckbox,
        createEl(doc, 'span', { text: '注入当前角色卡公开背景' }),
      ]),
      charContextHint,
      createEl(doc, 'label', { className: 'ups-check-row' }, [
        dualLayerCheckbox,
        createEl(doc, 'span', { text: '双层输出（常驻核心 + 补充世界书）' }),
      ]),
      createEl(doc, 'div', { className: 'ups-field' }, [
        createEl(doc, 'label', { className: 'ups-label', text: '末尾消息角色 / 预填充' }),
        popoverTailSelect,
      ]),
    ]
  );

  // Anchored floating menu for row actions
  const floatingMenuEl = createEl(doc, 'div', {
    className: 'ups-floating-menu ups-theme-root',
    hidden: true,
    attrs: { 'data-ups-floating-menu': 'true' },
  });

  // Sub-modal (Prompt Preview / Custom Export)
  const submodalTitleEl = createEl(doc, 'span', { text: '' });
  const submodalCloseBtn = createEl(doc, 'button', { type: 'button', className: 'ups-icon-btn', text: '×' });
  const submodalBodyEl = createEl(doc, 'div', { className: 'ups-submodal-body' });
  const submodalFooterEl = createEl(doc, 'div', { className: 'ups-submodal-footer' });
  const submodalMaskEl = createEl(
    doc,
    'div',
    { className: 'ups-submodal-mask ups-theme-root', hidden: true },
    [
      createEl(doc, 'div', { className: 'ups-submodal-card' }, [
        createEl(doc, 'div', { className: 'ups-submodal-header' }, [submodalTitleEl, submodalCloseBtn]),
        submodalBodyEl,
        submodalFooterEl,
      ]),
    ]
  );

  shadow.appendChild(backdropEl);
  shadow.appendChild(pillEl);
  shadow.appendChild(popoverEl);
  shadow.appendChild(floatingMenuEl);
  shadow.appendChild(submodalMaskEl);
  mountTarget.appendChild(host);

  // Stop host .openDrawer collapse on EVERY floating root
  stopHostDrawerCollapse(host, signal);
  stopHostDrawerCollapse(modalEl, signal);
  stopHostDrawerCollapse(pillEl, signal);
  stopHostDrawerCollapse(popoverEl, signal);
  stopHostDrawerCollapse(floatingMenuEl, signal);
  stopHostDrawerCollapse(submodalMaskEl, signal);

  // ==========================================================================
  // Tab 1: 工坊主页 (Studio)
  // ==========================================================================

  const modeABtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-seg-btn is-active',
    text: '模式 A · 新建直出',
    attrs: { 'data-ups-mode': 'A' },
  });
  const modeBBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-seg-btn',
    text: '模式 B · 优化重构',
    attrs: { 'data-ups-mode': 'B' },
  });
  const schemeSelect = createEl(doc, 'select', {
    className: 'ups-select',
    style: { width: 'auto', flex: '1 1 160px' },
    attrs: { 'data-ups-scheme': 'true', 'aria-label': '人设预设方案' },
  });
  const popoverBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-ghost',
    text: '策略选项',
    attrs: { 'data-ups-popover-btn': 'true' },
  });

  // Mode A inputs
  const inspirationInput = createEl(doc, 'textarea', {
    className: 'ups-textarea',
    rows: 3,
    placeholder: '用一两句话描述你想塑造的 User 身份、性格底色或开场处境……',
    attrs: { 'data-ups-inspiration': 'true' },
  });
  const mustHavesAInput = createEl(doc, 'input', {
    type: 'text',
    className: 'ups-input',
    placeholder: '可选：个人必带细节或核心偏爱（逗号分隔）',
    attrs: { 'data-ups-must-haves': 'true' },
  });
  const generateABtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn ups-btn-primary',
    text: '生成人设',
    attrs: { 'data-ups-generate': 'true' },
  });
  const previewPromptABtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-ghost',
    text: '预览提示词',
  });
  const modeAPanel = createEl(
    doc,
    'div',
    { className: 'ups-card', attrs: { 'data-ups-panel-mode': 'A' } },
    [
      createEl(doc, 'div', { className: 'ups-field' }, [
        createEl(doc, 'label', { className: 'ups-label', text: '一句话灵感 / 角色定位' }),
        inspirationInput,
      ]),
      createEl(doc, 'div', { className: 'ups-field' }, [
        createEl(doc, 'label', { className: 'ups-label', text: '必带偏好槽（可选）' }),
        mustHavesAInput,
      ]),
      createEl(doc, 'div', { className: 'ups-btn-row' }, [generateABtn, previewPromptABtn]),
    ]
  );

  // Mode B inputs
  const subModeSelect = createEl(
    doc,
    'select',
    { className: 'ups-select', attrs: { 'data-ups-submode': 'true', 'aria-label': '优化重构档位' } },
    [
      createEl(doc, 'option', { value: 'de_label_reformat', text: '无损去标签与排版重整' }),
      createEl(doc, 'option', { value: 'core_expand', text: '保核扩写丰满（支撑长文）' }),
      createEl(doc, 'option', { value: 'cross_card_adapt', text: '旧人设跨卡合理化改编' }),
    ]
  );
  const loadPersonaBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn',
    text: '载入当前人设',
    attrs: { 'data-ups-load-persona': 'true' },
  });
  const personaPickerSelect = createEl(doc, 'select', {
    className: 'ups-select',
    style: { flex: '1 1 140px' },
    attrs: { 'aria-label': '选择已有人设' },
  });
  const lockCoreBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-ghost',
    text: '提取并锁定本体核',
  });
  const existingDraftInput = createEl(doc, 'textarea', {
    className: 'ups-textarea',
    rows: 4,
    placeholder: '点击“载入当前人设”或直接粘贴旧人设 / 碎稿……',
    attrs: { 'data-ups-existing-draft': 'true' },
  });
  const lockedCoreInput = createEl(doc, 'textarea', {
    className: 'ups-textarea',
    rows: 2,
    placeholder: '可选：跨卡改编时锁定的【人物本体核】内容',
    attrs: { 'data-ups-locked-core': 'true' },
  });
  const mustHavesBInput = createEl(doc, 'input', {
    type: 'text',
    className: 'ups-input',
    placeholder: '可选：本次重构补充说明',
  });
  const generateBBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn ups-btn-primary',
    text: '生成优化稿',
    attrs: { 'data-ups-generate-b': 'true' },
  });
  const previewPromptBBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-ghost',
    text: '预览提示词',
  });

  const modeBPanel = createEl(
    doc,
    'div',
    { className: 'ups-card', hidden: true, attrs: { 'data-ups-panel-mode': 'B' } },
    [
      createEl(doc, 'div', { className: 'ups-field' }, [
        createEl(doc, 'label', { className: 'ups-label', text: '重构档位' }),
        subModeSelect,
      ]),
      createEl(doc, 'div', { className: 'ups-row' }, [loadPersonaBtn, personaPickerSelect, lockCoreBtn]),
      createEl(doc, 'div', { className: 'ups-field' }, [
        createEl(doc, 'label', { className: 'ups-label', text: '原有人设底稿' }),
        existingDraftInput,
      ]),
      createEl(doc, 'div', { className: 'ups-field' }, [
        createEl(doc, 'label', { className: 'ups-label', text: '锁定本体核（可选）' }),
        lockedCoreInput,
      ]),
      createEl(doc, 'div', { className: 'ups-field' }, [
        createEl(doc, 'label', { className: 'ups-label', text: '额外优化要求（可选）' }),
        mustHavesBInput,
      ]),
      createEl(doc, 'div', { className: 'ups-btn-row' }, [generateBBtn, previewPromptBBtn]),
    ]
  );

  // Draft workspace
  const tokenBadgeEl = createEl(doc, 'span', { className: 'ups-badge', text: '0 tokens' });
  const flattenBtn = createEl(doc, 'button', { type: 'button', className: 'ups-btn-ghost', text: '扁平整理' });
  const sectionSelect = createEl(doc, 'select', {
    className: 'ups-select',
    style: { width: 'auto', maxWidth: '160px' },
    attrs: { 'aria-label': '选择重生成分段' },
  });
  const regenSectionBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-ghost',
    text: '局部重生成',
    attrs: { 'data-ups-regen-section': 'true' },
  });
  const draftTextarea = createEl(doc, 'textarea', {
    className: 'ups-textarea',
    rows: 8,
    placeholder: '生成的 User 人设正文将显示在此，可直接编辑、撤销/重做或分段重写……',
    attrs: { 'data-ups-draft': 'true' },
  });

  // Diff & Taste Induction
  const diffViewEl = createEl(doc, 'div', {
    className: 'ups-diff-box',
    hidden: true,
    attrs: { 'data-ups-diff-view': 'true' },
  });
  const extractTasteBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-ghost',
    text: '归纳审美候选',
    attrs: { 'data-ups-extract-taste': 'true' },
  });
  const quickBanLineBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-ghost',
    text: '拉黑此句写法',
  });
  const quickAnchorLineBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-ghost',
    text: '收藏偏爱锚点',
  });
  const confirmTasteBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn ups-btn-primary',
    text: '确认沉淀入库',
    attrs: { 'data-ups-confirm-taste': 'true' },
  });
  const tasteCandidatesListEl = createEl(doc, 'div', { style: { display: 'flex', flexDirection: 'column', gap: '5px' } });
  const tasteCandidatesBox = createEl(
    doc,
    'div',
    {
      className: 'ups-taste-candidates',
      hidden: true,
      attrs: { 'data-ups-taste-candidates': 'true' },
    },
    [
      createEl(doc, 'div', { className: 'ups-card-title', text: '从改稿差异中归纳的审美候选' }),
      tasteCandidatesListEl,
      createEl(doc, 'div', { className: 'ups-btn-row' }, [confirmTasteBtn]),
    ]
  );

  // Lint & Dual Layer Worldbook
  const lintSummaryBadge = createEl(doc, 'span', { className: 'ups-badge', text: '质量检测：待检测' });
  const lintIssuesListEl = createEl(doc, 'div', { style: { display: 'flex', flexDirection: 'column', gap: '5px' } });

  const wbNameInput = createEl(doc, 'input', {
    type: 'text',
    className: 'ups-input',
    placeholder: '补充世界书名称（留空则自动生成）',
  });
  const saveWbBtn = createEl(doc, 'button', { type: 'button', className: 'ups-btn', text: '保存补充世界书' });
  const wbPreviewText = createEl(doc, 'div', { className: 'ups-muted', text: '' });
  const wbBox = createEl(
    doc,
    'div',
    { className: 'ups-card', hidden: true },
    [
      createEl(doc, 'div', { className: 'ups-card-title', text: '双层输出 · 补充世界书条目' }),
      wbPreviewText,
      createEl(doc, 'div', { className: 'ups-row' }, [
        createEl(doc, 'div', { style: { flex: '1 1 160px' } }, [wbNameInput]),
        saveWbBtn,
      ]),
    ]
  );

  // Write-Back to ST Persona
  const saveNameInput = createEl(doc, 'input', {
    type: 'text',
    className: 'ups-input',
    placeholder: '人设名称（用于覆盖或另存新建）',
    attrs: { 'data-ups-save-name': 'true' },
  });
  const saveOverwriteBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn',
    text: '覆盖当前人设',
    attrs: { 'data-ups-save-overwrite': 'true' },
  });
  const saveNewBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn ups-btn-primary',
    text: '另存为新人设',
    attrs: { 'data-ups-save-new': 'true' },
  });

  const studioTabPanel = createEl(
    doc,
    'section',
    { className: 'ups-tab-panel', attrs: { 'data-ups-tab-panel': 'studio' } },
    [
      createEl(doc, 'div', { className: 'ups-card' }, [
        createEl(doc, 'div', { className: 'ups-row-between' }, [
          createEl(doc, 'div', { className: 'ups-segmented' }, [modeABtn, modeBBtn]),
          popoverBtn,
        ]),
        createEl(doc, 'div', { className: 'ups-row' }, [
          createEl(doc, 'span', { className: 'ups-label', text: '写作流派' }),
          schemeSelect,
        ]),
      ]),
      modeAPanel,
      modeBPanel,
      createEl(doc, 'div', { className: 'ups-card' }, [
        createEl(doc, 'div', { className: 'ups-row-between' }, [
          createEl(doc, 'div', { className: 'ups-row' }, [
            createEl(doc, 'span', { className: 'ups-card-title', text: '人设文稿工作区' }),
            tokenBadgeEl,
          ]),
          createEl(doc, 'div', { className: 'ups-btn-row' }, [
            flattenBtn,
            sectionSelect,
            regenSectionBtn,
          ]),
        ]),
        draftTextarea,
        createEl(doc, 'div', { className: 'ups-btn-row' }, [
          extractTasteBtn,
          quickBanLineBtn,
          quickAnchorLineBtn,
          lintSummaryBadge,
        ]),
        diffViewEl,
        tasteCandidatesBox,
        lintIssuesListEl,
      ]),
      wbBox,
      createEl(doc, 'div', { className: 'ups-card' }, [
        createEl(doc, 'div', { className: 'ups-card-title', text: '写入酒馆原生人设' }),
        createEl(doc, 'div', { className: 'ups-row' }, [
          createEl(doc, 'div', { style: { flex: '1 1 180px' } }, [saveNameInput]),
          saveOverwriteBtn,
          saveNewBtn,
        ]),
      ]),
    ]
  );

  // ==========================================================================
  // Tab 2: 预设条目栈 (Presets)
  // ==========================================================================

  const stackSchemeSelect = createEl(doc, 'select', {
    className: 'ups-select',
    style: { flex: '1 1 160px' },
    attrs: { 'aria-label': '选择编辑方案' },
  });
  const schemeNameInput = createEl(doc, 'input', {
    type: 'text',
    className: 'ups-input',
    placeholder: '输入方案名称（用于另存或重命名）',
  });
  const schemeSaveAsBtn = createEl(doc, 'button', { type: 'button', className: 'ups-btn', text: '另存方案' });
  const schemeRenameBtn = createEl(doc, 'button', { type: 'button', className: 'ups-btn-ghost', text: '重命名' });
  const schemeDeleteBtn = createEl(doc, 'button', { type: 'button', className: 'ups-btn-danger', text: '删除方案' });

  const tailModeSelect = createEl(
    doc,
    'select',
    { className: 'ups-select', attrs: { 'aria-label': '末尾消息角色策略' } },
    [
      createEl(doc, 'option', { value: 'user', text: '末尾为 user（通用兼容）' }),
      createEl(doc, 'option', { value: 'assistant_prefill', text: '末尾为 assistant 预填充' }),
      createEl(doc, 'option', { value: 'prefill_plus_user', text: '预填充 + 末尾 user 触发' }),
    ]
  );
  const prefillInput = createEl(doc, 'textarea', { className: 'ups-textarea', rows: 2, placeholder: '输入预填充引导语' });
  const triggerInput = createEl(doc, 'input', { type: 'text', className: 'ups-input', placeholder: '输入末尾触发语' });
  const schemeTempInput = createEl(doc, 'input', { type: 'number', className: 'ups-input', step: '0.05', min: '0', max: '2' });
  const schemeMaxTokensInput = createEl(doc, 'input', { type: 'number', className: 'ups-input', step: '100', min: '256', max: '32768' });

  const stackSearchInput = createEl(doc, 'input', {
    type: 'search',
    className: 'ups-input',
    style: { flex: '1 1 160px' },
    placeholder: '搜索预设条目名称或正文……',
    attrs: { 'data-ups-stack-search': 'true' },
  });
  const addStackEntryBtn = createEl(doc, 'button', { type: 'button', className: 'ups-btn', text: '+ 新增条目' });
  const exportPresetModalBtn = createEl(doc, 'button', { type: 'button', className: 'ups-btn-ghost', text: '自定义导出' });
  const stackListEl = createEl(doc, 'div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } });

  const presetsTabPanel = createEl(
    doc,
    'section',
    { className: 'ups-tab-panel', hidden: true, attrs: { 'data-ups-tab-panel': 'presets' } },
    [
      createEl(doc, 'div', { className: 'ups-card' }, [
        createEl(doc, 'div', { className: 'ups-card-title', text: '方案管理与末尾预填充策略' }),
        createEl(doc, 'div', { className: 'ups-row' }, [stackSchemeSelect]),
        createEl(doc, 'div', { className: 'ups-row' }, [
          createEl(doc, 'div', { style: { flex: '1 1 150px' } }, [schemeNameInput]),
          schemeSaveAsBtn,
          schemeRenameBtn,
          schemeDeleteBtn,
        ]),
        createEl(doc, 'div', { className: 'ups-grid-2' }, [
          createEl(doc, 'div', { className: 'ups-field' }, [
            createEl(doc, 'label', { className: 'ups-label', text: '末尾消息角色' }),
            tailModeSelect,
          ]),
          createEl(doc, 'div', { className: 'ups-field' }, [
            createEl(doc, 'label', { className: 'ups-label', text: '生成温度 / 最大 Token' }),
            createEl(doc, 'div', { className: 'ups-row' }, [
              createEl(doc, 'div', { style: { flex: '1 1 60px' } }, [schemeTempInput]),
              createEl(doc, 'div', { style: { flex: '1 1 70px' } }, [schemeMaxTokensInput]),
            ]),
          ]),
        ]),
        createEl(doc, 'div', { className: 'ups-grid-2' }, [
          createEl(doc, 'div', { className: 'ups-field' }, [
            createEl(doc, 'label', { className: 'ups-label', text: 'Assistant 预填充引导语' }),
            prefillInput,
          ]),
          createEl(doc, 'div', { className: 'ups-field' }, [
            createEl(doc, 'label', { className: 'ups-label', text: '末尾 User 触发语' }),
            triggerInput,
          ]),
        ]),
      ]),
      createEl(doc, 'div', { className: 'ups-card' }, [
        createEl(doc, 'div', { className: 'ups-row' }, [
          stackSearchInput,
          addStackEntryBtn,
          exportPresetModalBtn,
        ]),
        stackListEl,
      ]),
    ]
  );

  // ==========================================================================
  // Tab 3: 审美成长库 (Taste Profile)
  // ==========================================================================

  const useBuiltinBannedBtn = createEl(
    doc,
    'button',
    {
      type: 'button',
      className: 'ups-switch is-on',
      attrs: { role: 'switch', 'aria-checked': 'true', 'aria-label': '启用内置人设腔禁词底座' },
    },
    [createEl(doc, 'span', { className: 'ups-switch-thumb' })]
  );
  const toggleBuiltinViewerBtn = createEl(doc, 'button', { type: 'button', className: 'ups-btn-ghost', text: '查看内置底座' });
  const dedupTasteBtn = createEl(doc, 'button', { type: 'button', className: 'ups-btn-ghost', text: '去重合并' });
  const builtinViewerEl = createEl(doc, 'div', { className: 'ups-card', hidden: true }, [
    createEl(doc, 'div', { className: 'ups-label', text: `内置高频套话禁词（${DEFAULT_BANNED_PHRASES.length} 条）` }),
    createEl(doc, 'div', { className: 'ups-muted', text: DEFAULT_BANNED_PHRASES.join('、') }),
    createEl(doc, 'div', { className: 'ups-label', text: `内置定性标签拦截（${QUALITATIVE_LABEL_PATTERNS.length} 类）` }),
    createEl(doc, 'div', { className: 'ups-muted', text: QUALITATIVE_LABEL_PATTERNS.map((p) => p.label).join('、') }),
  ]);

  const tasteSearchInput = createEl(doc, 'input', {
    type: 'search',
    className: 'ups-input',
    placeholder: '搜索偏爱锚点或个人禁写规则……',
    attrs: { 'data-ups-taste-search': 'true' },
  });
  const addAnchorInput = createEl(doc, 'input', {
    type: 'text',
    className: 'ups-input',
    placeholder: '新增偏爱特质锚点，如：低压力环境下有轻微生活笨拙感',
  });
  const addAnchorBtn = createEl(doc, 'button', { type: 'button', className: 'ups-btn', text: '添加锚点' });
  const addBannedInput = createEl(doc, 'input', {
    type: 'text',
    className: 'ups-input',
    placeholder: '新增个人禁写写法，如：冷冽如刀的目光',
  });
  const addBannedBtn = createEl(doc, 'button', { type: 'button', className: 'ups-btn', text: '添加禁写' });
  const tasteListContainer = createEl(doc, 'div', {
    style: { display: 'flex', flexDirection: 'column', gap: '10px' },
    attrs: { 'data-ups-taste-list': 'true' },
  });

  const tasteTabPanel = createEl(
    doc,
    'section',
    { className: 'ups-tab-panel', hidden: true, attrs: { 'data-ups-tab-panel': 'taste' } },
    [
      createEl(doc, 'div', { className: 'ups-card' }, [
        createEl(doc, 'div', { className: 'ups-setting-row' }, [
          createEl(doc, 'div', { className: 'ups-setting-meta' }, [
            createEl(doc, 'div', { className: 'ups-card-title', text: '启用内置人设腔禁词底座' }),
            createEl(doc, 'div', { className: 'ups-muted', text: '自动避开常见套话与直接定性标签词' }),
          ]),
          useBuiltinBannedBtn,
        ]),
        createEl(doc, 'div', { className: 'ups-btn-row' }, [toggleBuiltinViewerBtn, dedupTasteBtn]),
      ]),
      builtinViewerEl,
      createEl(doc, 'div', { className: 'ups-card' }, [
        tasteSearchInput,
        createEl(doc, 'div', { className: 'ups-row' }, [
          createEl(doc, 'div', { style: { flex: '1 1 160px' } }, [addAnchorInput]),
          addAnchorBtn,
        ]),
        createEl(doc, 'div', { className: 'ups-row' }, [
          createEl(doc, 'div', { style: { flex: '1 1 160px' } }, [addBannedInput]),
          addBannedBtn,
        ]),
        tasteListContainer,
      ]),
    ]
  );

  // ==========================================================================
  // Tab 4: 连接与设置 (API & Appearance)
  // ==========================================================================

  const providerSelect = createEl(
    doc,
    'select',
    { className: 'ups-select ups-setting-control', attrs: { 'data-ups-provider': 'true', 'aria-label': 'AI 连接来源' } },
    [
      createEl(doc, 'option', { value: 'host', text: '跟随酒馆当前连接' }),
      createEl(doc, 'option', { value: 'custom', text: '自定义独立 API' }),
    ]
  );

  const apiProfileSelect = createEl(doc, 'select', {
    className: 'ups-select',
    style: { flex: '1 1 150px' },
    attrs: { 'data-ups-api-profile': 'true', 'aria-label': '选择自定义 API 方案' },
  });
  const profileNameInput = createEl(doc, 'input', {
    type: 'text',
    className: 'ups-input',
    placeholder: '配置方案名称',
    attrs: { 'data-ups-profile-name': 'true' },
  });
  const profileCreateBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn',
    text: '新建方案',
    attrs: { 'data-ups-profile-create': 'true' },
  });
  const profileRenameBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-ghost',
    text: '重命名',
    attrs: { 'data-ups-profile-rename': 'true' },
  });
  const profileDeleteBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-danger',
    text: '删除',
    attrs: { 'data-ups-profile-delete': 'true' },
  });
  const profileDeleteConfirmBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-danger',
    text: '确认删除',
    hidden: true,
  });
  const profileDeleteCancelBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-ghost',
    text: '取消',
    hidden: true,
  });

  const apiUrlInput = createEl(doc, 'input', {
    type: 'url',
    className: 'ups-input',
    placeholder: 'https://api.example.com/v1',
    attrs: { 'data-ups-api-url': 'true' },
  });
  const apiKeyInput = createEl(doc, 'input', {
    type: 'password',
    className: 'ups-input',
    autocomplete: 'new-password',
    placeholder: '填写 API Key（仅本地保存，不随预设导出）',
    attrs: { 'data-ups-api-key': 'true' },
  });
  const toggleKeyVisBtn = createEl(doc, 'button', { type: 'button', className: 'ups-btn-ghost', text: '显示' });
  const apiKeyMaskEl = createEl(doc, 'span', {
    className: 'ups-badge',
    text: '未填写',
    attrs: { 'data-ups-api-key-mask': 'true' },
  });
  const apiModelInput = createEl(doc, 'input', {
    type: 'text',
    className: 'ups-input',
    placeholder: '模型名称（手填或点击拉取模型）',
    attrs: { 'data-ups-api-model': 'true' },
  });
  const apiModelSelect = createEl(doc, 'select', {
    className: 'ups-select',
    hidden: true,
    attrs: { 'aria-label': '已拉取模型列表' },
  });
  const fetchModelsBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn',
    text: '拉取模型',
    attrs: { 'data-ups-fetch-models': 'true' },
  });
  const apiTempInput = createEl(doc, 'input', { type: 'number', className: 'ups-input', step: '0.05', min: '0', max: '2' });
  const apiMaxTokensInput = createEl(doc, 'input', { type: 'number', className: 'ups-input', step: '100', min: '256', max: '32768' });
  const apiTopPInput = createEl(doc, 'input', { type: 'number', className: 'ups-input', step: '0.05', min: '0', max: '1' });
  const apiTimeoutInput = createEl(doc, 'input', { type: 'number', className: 'ups-input', step: '10', min: '10', max: '300' });
  const apiStreamSwitch = createEl(
    doc,
    'button',
    {
      type: 'button',
      className: 'ups-switch is-on',
      attrs: { role: 'switch', 'aria-checked': 'true', 'aria-label': '流式输出' },
    },
    [createEl(doc, 'span', { className: 'ups-switch-thumb' })]
  );
  const testConnBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn ups-btn-primary',
    text: '测试连接',
    attrs: { 'data-ups-test-conn': 'true' },
  });
  const connStatusEl = createEl(doc, 'span', {
    className: 'ups-muted',
    text: '尚未测试',
    attrs: { 'data-ups-conn-status': 'true' },
  });

  const customApiCard = createEl(
    doc,
    'div',
    { className: 'ups-card', hidden: settings.api.provider !== 'custom' },
    [
      createEl(doc, 'div', { className: 'ups-card-title', text: '自定义 API 配置方案' }),
      createEl(doc, 'div', { className: 'ups-row' }, [apiProfileSelect]),
      createEl(doc, 'div', { className: 'ups-row' }, [
        createEl(doc, 'div', { style: { flex: '1 1 140px' } }, [profileNameInput]),
        profileCreateBtn,
        profileRenameBtn,
        profileDeleteBtn,
        profileDeleteConfirmBtn,
        profileDeleteCancelBtn,
      ]),
      createEl(doc, 'div', { className: 'ups-field' }, [
        createEl(doc, 'label', { className: 'ups-label', text: 'Base URL（OpenAI 兼容端点）' }),
        apiUrlInput,
      ]),
      createEl(doc, 'div', { className: 'ups-field' }, [
        createEl(doc, 'div', { className: 'ups-row-between' }, [
          createEl(doc, 'label', { className: 'ups-label', text: 'API Key（本地安全存储）' }),
          apiKeyMaskEl,
        ]),
        createEl(doc, 'div', { className: 'ups-row' }, [
          createEl(doc, 'div', { style: { flex: '1 1 160px' } }, [apiKeyInput]),
          toggleKeyVisBtn,
        ]),
      ]),
      createEl(doc, 'div', { className: 'ups-field' }, [
        createEl(doc, 'label', { className: 'ups-label', text: '模型 ID' }),
        createEl(doc, 'div', { className: 'ups-row' }, [
          createEl(doc, 'div', { style: { flex: '1 1 160px' } }, [apiModelInput]),
          fetchModelsBtn,
        ]),
        apiModelSelect,
      ]),
      createEl(doc, 'div', { className: 'ups-grid-2' }, [
        createEl(doc, 'div', { className: 'ups-field' }, [
          createEl(doc, 'label', { className: 'ups-label', text: 'Temperature' }),
          apiTempInput,
        ]),
        createEl(doc, 'div', { className: 'ups-field' }, [
          createEl(doc, 'label', { className: 'ups-label', text: 'Max Tokens' }),
          apiMaxTokensInput,
        ]),
        createEl(doc, 'div', { className: 'ups-field' }, [
          createEl(doc, 'label', { className: 'ups-label', text: 'Top P' }),
          apiTopPInput,
        ]),
        createEl(doc, 'div', { className: 'ups-field' }, [
          createEl(doc, 'label', { className: 'ups-label', text: '超时秒数' }),
          apiTimeoutInput,
        ]),
      ]),
      createEl(doc, 'div', { className: 'ups-setting-row' }, [
        createEl(doc, 'div', { className: 'ups-setting-meta' }, [
          createEl(doc, 'div', { className: 'ups-label', text: '启用流式输出（SSE）' }),
        ]),
        apiStreamSwitch,
      ]),
      createEl(doc, 'div', { className: 'ups-row' }, [testConnBtn, connStatusEl]),
    ]
  );

  // Appearance & Host Entry Settings
  const colorModeSelect = createEl(
    doc,
    'select',
    { className: 'ups-select ups-setting-control', attrs: { 'aria-label': '明暗模式' } },
    COLOR_MODE_OPTIONS.map((m) => createEl(doc, 'option', { value: m.id, text: m.label }))
  );
  const showPersonaBtnSwitch = createEl(
    doc,
    'button',
    {
      type: 'button',
      className: `ups-switch${settings.ui.showPersonaBtn ? ' is-on' : ''}`,
      attrs: { role: 'switch', 'aria-checked': String(settings.ui.showPersonaBtn), 'aria-label': '显示人设面板快捷按钮' },
    },
    [createEl(doc, 'span', { className: 'ups-switch-thumb' })]
  );
  const showWandMenuSwitch = createEl(
    doc,
    'button',
    {
      type: 'button',
      className: `ups-switch${settings.ui.showWandMenu ? ' is-on' : ''}`,
      attrs: { role: 'switch', 'aria-checked': String(settings.ui.showWandMenu), 'aria-label': '显示扩展菜单入口' },
    },
    [createEl(doc, 'span', { className: 'ups-switch-thumb' })]
  );
  const exportSafeBackupBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn ups-setting-control',
    text: '导出安全配置',
  });

  const settingsTabPanel = createEl(
    doc,
    'section',
    { className: 'ups-tab-panel', hidden: true, attrs: { 'data-ups-tab-panel': 'settings' } },
    [
      createEl(doc, 'div', { className: 'ups-card' }, [
        createEl(doc, 'div', { className: 'ups-setting-row' }, [
          createEl(doc, 'div', { className: 'ups-setting-meta' }, [
            createEl(doc, 'div', { className: 'ups-card-title', text: 'AI 生成连接方式' }),
            createEl(doc, 'div', { className: 'ups-muted', text: '可跟随酒馆当前连接，或使用独立兼容接口' }),
          ]),
          providerSelect,
        ]),
      ]),
      customApiCard,
      createEl(doc, 'div', { className: 'ups-card' }, [
        createEl(doc, 'div', { className: 'ups-card-title', text: '外观与入口设置' }),
        createEl(doc, 'div', { className: 'ups-setting-row' }, [
          createEl(doc, 'div', { className: 'ups-setting-meta' }, [
            createEl(doc, 'div', { className: 'ups-label', text: '明暗显示模式' }),
          ]),
          colorModeSelect,
        ]),
        createEl(doc, 'div', { className: 'ups-setting-row' }, [
          createEl(doc, 'div', { className: 'ups-setting-meta' }, [
            createEl(doc, 'div', { className: 'ups-label', text: '显示人设管理面板快捷按钮' }),
          ]),
          showPersonaBtnSwitch,
        ]),
        createEl(doc, 'div', { className: 'ups-setting-row' }, [
          createEl(doc, 'div', { className: 'ups-setting-meta' }, [
            createEl(doc, 'div', { className: 'ups-label', text: '显示扩展菜单（魔棒）入口' }),
          ]),
          showWandMenuSwitch,
        ]),
        createEl(doc, 'div', { className: 'ups-setting-row' }, [
          createEl(doc, 'div', { className: 'ups-setting-meta' }, [
            createEl(doc, 'div', { className: 'ups-label', text: '导出脱敏配置备份（自动移除全部密钥）' }),
          ]),
          exportSafeBackupBtn,
        ]),
      ]),
    ]
  );

  bodyEl.appendChild(studioTabPanel);
  bodyEl.appendChild(presetsTabPanel);
  bodyEl.appendChild(tasteTabPanel);
  bodyEl.appendChild(settingsTabPanel);

  // ==========================================================================
  // Internal State & Render Helpers
  // ==========================================================================

  function setStatus(text, tone = 'muted') {
    state.statusText = String(text || '就绪');
    state.statusTone = tone;
    statusEl.textContent = state.statusText;
  }

  function persistSettings() {
    Promise.resolve(hostApi.saveSettings(settings)).catch((err) => {
      setStatus(`配置保存提示：${err?.message || '已暂存内存'}`, 'warn');
    });
  }

  function applyTheme() {
    const hostVars = readHostThemeVars(doc, win);
    const themeOpts = { palette: settings.palette, colorMode: settings.colorMode };
    applyThemeToRoot(backdropEl, themeOpts, hostVars);
    applyThemeToRoot(pillEl, themeOpts, hostVars);
    applyThemeToRoot(popoverEl, themeOpts, hostVars);
    applyThemeToRoot(floatingMenuEl, themeOpts, hostVars);
    applyThemeToRoot(submodalMaskEl, themeOpts, hostVars);
  }

  function updateCompactHeightClass(heightPx) {
    const h = Number(heightPx) || modalEl.getBoundingClientRect?.().height || 620;
    modalEl.classList.toggle('is-compact-h', h > 0 && h <= 430);
  }

  function applyRectToModal(rect) {
    if (!rect) return;
    modalEl.classList.add('is-floating');
    modalEl.style.left = `${rect.left}px`;
    modalEl.style.top = `${rect.top}px`;
    modalEl.style.width = `${rect.width}px`;
    modalEl.style.height = `${rect.height}px`;
    updateCompactHeightClass(rect.height);
  }

  function clearFloatingRectOnModal() {
    modalEl.classList.remove('is-floating');
    modalEl.style.left = '';
    modalEl.style.top = '';
    modalEl.style.width = '';
    modalEl.style.height = '';
    const vw = Number(win?.innerWidth || 1280);
    const vh = Number(win?.innerHeight || 800);
    updateCompactHeightClass(vw <= 640 ? vh : Math.min(620, Math.round(vh * 0.88)));
  }

  function syncUndoRedoButtons() {
    undoBtn.disabled = !draftHistory.canUndo();
    redoBtn.disabled = !draftHistory.canRedo();
  }

  function updateSchemeSelects() {
    const schemes = settings.schemes || [];
    const active = getActiveScheme(settings);
    const makeOpts = (sel) => {
      sel.replaceChildren(
        ...schemes.map((s) =>
          createEl(doc, 'option', { value: s.id, text: s.builtin ? `${s.name}（内置）` : s.name })
        )
      );
      if (active) sel.value = active.id;
    };
    makeOpts(schemeSelect);
    makeOpts(stackSchemeSelect);
    if (active) {
      popoverTailSelect.value = active.tailMode || 'user';
      tailModeSelect.value = active.tailMode || 'user';
      prefillInput.value = active.prefillText || '';
      triggerInput.value = active.triggerText || '';
      schemeTempInput.value = String(active.temperature ?? 0.85);
      schemeMaxTokensInput.value = String(active.maxTokens ?? 4096);
      schemeDeleteBtn.disabled = Boolean(active.builtin) || schemes.length <= 1;
    }
  }

  function syncDraftRelatedViews() {
    const text = draftTextarea.value || '';
    const tokens = estimateTokens(text);
    const active = getActiveScheme(settings);
    const rangeHint = active?.targetTokens ? ` / 目标 ${active.targetTokens.min}~${active.targetTokens.max}` : '';
    tokenBadgeEl.textContent = `${tokens} tokens${rangeHint}`;

    // Sections
    const sections = parsePersonaSections(text);
    const prevSec = sectionSelect.value;
    if (sections.length === 0) {
      sectionSelect.replaceChildren(createEl(doc, 'option', { value: '', text: '无分段标题' }));
      sectionSelect.disabled = true;
      regenSectionBtn.disabled = true;
    } else {
      sectionSelect.disabled = false;
      regenSectionBtn.disabled = false;
      sectionSelect.replaceChildren(
        ...sections.map((s) => createEl(doc, 'option', { value: s.title || '', text: s.title || '正文开篇' }))
      );
      if (prevSec && sections.some((s) => s.title === prevSec)) {
        sectionSelect.value = prevSec;
      } else {
        const shellSec = sections.find((s) => /剧场壳/.test(s.title));
        sectionSelect.value = shellSec ? shellSec.title : sections[0].title;
      }
    }

    // Lint
    const lint = lintPersonaText(text, settings.tasteProfile);
    lintSummaryBadge.textContent = text.trim()
      ? `质量检测：${lint.score} 分（${lint.issues.length} 项提示）`
      : '质量检测：待检测';
    lintSummaryBadge.className = `ups-badge ${lint.issues.length === 0 && text.trim() ? 'ups-badge-ok' : lint.issues.length > 0 ? 'ups-badge-warn' : ''}`;

    const issueNodes = lint.issues.slice(0, 8).map((issue) => {
      const children = [createEl(doc, 'span', { text: issue.message || issue.code })];
      if (issue.match) {
        const banBtn = createEl(doc, 'button', {
          type: 'button',
          className: 'ups-btn-ghost',
          text: '加入禁写',
        });
        banBtn.addEventListener('click', () => {
          settings.tasteProfile.banned = mergeTasteEntries(settings.tasteProfile.banned, [
            { text: issue.match, note: '质检一键拉黑' },
          ]);
          persistSettings();
          renderTasteTab();
          syncDraftRelatedViews();
          setStatus(`已加入禁写：${issue.match}`);
        });
        children.push(banBtn);
      }
      return createEl(doc, 'div', { className: 'ups-issue-item' }, children);
    });
    lintIssuesListEl.replaceChildren(...issueNodes);

    // Diff View
    if (state.baselineDraft && text && state.baselineDraft.trim() !== text.trim()) {
      const diff = computeLineDiff(state.baselineDraft, text);
      diffViewEl.hidden = false;
      diffViewEl.replaceChildren(
        ...diff.lines.map((line) => {
          const prefix = line.type === 'add' ? '+ ' : line.type === 'remove' ? '- ' : '  ';
          const cls =
            line.type === 'add'
              ? 'ups-diff-line ups-diff-add'
              : line.type === 'remove'
                ? 'ups-diff-line ups-diff-del'
                : 'ups-diff-line ups-diff-eq';
          return createEl(doc, 'div', { className: cls, text: `${prefix}${line.text}` });
        })
      );
    } else {
      diffViewEl.hidden = true;
      diffViewEl.replaceChildren();
    }

    // Dual-layer worldbook preview
    if (state.dualLayer && text.trim()) {
      const split = splitDualLayerOutput(text);
      if (split.worldbookEntries.length > 0) {
        wbBox.hidden = false;
        wbPreviewText.textContent = `已解析 ${split.worldbookEntries.length} 条补充设定：${split.worldbookEntries.map((e) => e.comment).join('、')}`;
      } else {
        wbBox.hidden = true;
      }
    } else {
      wbBox.hidden = true;
    }
  }

  function setDraftValue(nextText, { recordHistory = true } = {}) {
    const val = String(nextText ?? '');
    draftTextarea.value = val;
    if (recordHistory) {
      draftHistory.push(val);
    }
    syncUndoRedoButtons();
    syncDraftRelatedViews();
  }

  function closeFloatingMenu() {
    floatingMenuEl.hidden = true;
    floatingMenuEl.replaceChildren();
  }

  function openFloatingMenu(anchorBtn, items) {
    closeFloatingMenu();
    const btns = items.map((item) => {
      const b = createEl(doc, 'button', {
        type: 'button',
        className: 'ups-menu-item',
        text: item.label,
        disabled: Boolean(item.disabled),
      });
      b.addEventListener('click', () => {
        closeFloatingMenu();
        item.onSelect?.();
      });
      return b;
    });
    floatingMenuEl.replaceChildren(...btns);
    floatingMenuEl.hidden = false;

    const r = anchorBtn.getBoundingClientRect?.() || { left: 20, top: 20, right: 48, bottom: 48 };
    const vw = Number(win?.innerWidth || 1280);
    const vh = Number(win?.innerHeight || 800);
    const mw = floatingMenuEl.offsetWidth || 160;
    const mh = floatingMenuEl.offsetHeight || items.length * 32 + 10;
    const left = Math.max(8, Math.min(vw - mw - 8, r.right - mw));
    const top = r.bottom + mh + 8 > vh ? Math.max(8, r.top - mh - 4) : Math.max(8, r.bottom + 4);
    floatingMenuEl.style.left = `${Math.round(left)}px`;
    floatingMenuEl.style.top = `${Math.round(top)}px`;
  }

  function renderStackTab() {
    const active = getActiveScheme(settings);
    if (!active) return;
    updateSchemeSelects();
    const q = state.stackSearchQuery.trim().toLowerCase();
    const entries = active.entries || [];
    const filtered = entries.filter((entry) => {
      if (!q) return true;
      return (
        String(entry.name || '').toLowerCase().includes(q) ||
        String(entry.content || '').toLowerCase().includes(q) ||
        String(entry.slotType || '').toLowerCase().includes(q)
      );
    });

    if (filtered.length === 0) {
      stackListEl.replaceChildren(
        createEl(doc, 'div', {
          className: 'ups-muted',
          style: { padding: '14px 4px', textAlign: 'center' },
          text: '未找到匹配的预设条目，请清空搜索词或新增自定义条目。',
        })
      );
      return;
    }

    const cards = filtered.map((entry) => {
      const idx = entries.findIndex((e) => e.id === entry.id);
      const isExpanded = state.expandedEntryIds.has(entry.id);

      const expandBtn = createEl(doc, 'button', {
        type: 'button',
        className: 'ups-btn-ghost ups-hide-xs',
        text: isExpanded ? '收起' : '展开',
        attrs: { 'data-ups-expand-btn': 'true' },
      });
      expandBtn.addEventListener('click', () => {
        if (state.expandedEntryIds.has(entry.id)) state.expandedEntryIds.delete(entry.id);
        else state.expandedEntryIds.add(entry.id);
        renderStackTab();
      });

      const switchBtn = createEl(
        doc,
        'button',
        {
          type: 'button',
          className: `ups-switch${entry.enabled ? ' is-on' : ''}`,
          attrs: { role: 'switch', 'aria-checked': String(Boolean(entry.enabled)), 'aria-label': `开关 ${entry.name}` },
        },
        [createEl(doc, 'span', { className: 'ups-switch-thumb' })]
      );
      switchBtn.addEventListener('click', () => {
        const nextScheme = toggleStackEntry(active, entry.id);
        settings.schemes = settings.schemes.map((s) => (s.id === active.id ? nextScheme : s));
        renderStackTab();
        persistSettings();
      });

      const moreBtn = createEl(doc, 'button', {
        type: 'button',
        className: 'ups-more-btn',
        text: '···',
        title: '更多操作',
      });
      moreBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        openFloatingMenu(moreBtn, [
          {
            label: '上移一位',
            disabled: idx <= 0,
            onSelect: () => {
              const nextScheme = moveStackEntry(active, entry.id, 'up');
              settings.schemes = settings.schemes.map((s) => (s.id === active.id ? nextScheme : s));
              renderStackTab();
              persistSettings();
            },
          },
          {
            label: '下移一位',
            disabled: idx >= entries.length - 1,
            onSelect: () => {
              const nextScheme = moveStackEntry(active, entry.id, 'down');
              settings.schemes = settings.schemes.map((s) => (s.id === active.id ? nextScheme : s));
              renderStackTab();
              persistSettings();
            },
          },
          {
            label: isExpanded ? '收起详情' : '展开详情',
            onSelect: () => {
              if (state.expandedEntryIds.has(entry.id)) state.expandedEntryIds.delete(entry.id);
              else state.expandedEntryIds.add(entry.id);
              renderStackTab();
            },
          },
          {
            label: entry.locked ? '核心条目不可删' : '删除条目',
            disabled: Boolean(entry.locked),
            onSelect: () => {
              const nextScheme = removeStackEntry(active, entry.id);
              settings.schemes = settings.schemes.map((s) => (s.id === active.id ? nextScheme : s));
              state.expandedEntryIds.delete(entry.id);
              renderStackTab();
              persistSettings();
            },
          },
        ]);
      });

      const row = createEl(doc, 'div', { className: 'ups-entry-row' }, [
        createEl(doc, 'div', { className: 'ups-entry-main' }, [
          createEl(doc, 'span', { className: 'ups-badge', text: entry.role }),
          createEl(doc, 'span', { className: 'ups-entry-title', text: entry.name }),
        ]),
        createEl(doc, 'div', { className: 'ups-row-controls' }, [expandBtn, switchBtn, moreBtn]),
      ]);

      const cardChildren = [row];
      if (isExpanded) {
        const nameEd = createEl(doc, 'input', { type: 'text', className: 'ups-input', value: entry.name || '' });
        const roleEd = createEl(
          doc,
          'select',
          { className: 'ups-select' },
          ['system', 'user', 'assistant'].map((r) => createEl(doc, 'option', { value: r, text: r }))
        );
        roleEd.value = entry.role || 'system';
        const contentEd = createEl(doc, 'textarea', {
          className: 'ups-textarea',
          rows: 4,
          value: entry.content || '',
        });
        const applyBtn = createEl(doc, 'button', { type: 'button', className: 'ups-btn ups-btn-primary', text: '保存条目修改' });
        applyBtn.addEventListener('click', () => {
          const nextScheme = updateStackEntry(active, entry.id, {
            name: nameEd.value,
            role: roleEd.value,
            content: contentEd.value,
          });
          settings.schemes = settings.schemes.map((s) => (s.id === active.id ? nextScheme : s));
          renderStackTab();
          persistSettings();
          setStatus(`已更新条目：${nameEd.value || entry.name}`);
        });
        cardChildren.push(
          createEl(doc, 'div', { className: 'ups-entry-editor' }, [
            createEl(doc, 'div', { className: 'ups-grid-2' }, [
              createEl(doc, 'div', { className: 'ups-field' }, [
                createEl(doc, 'label', { className: 'ups-label', text: '条目名称' }),
                nameEd,
              ]),
              createEl(doc, 'div', { className: 'ups-field' }, [
                createEl(doc, 'label', { className: 'ups-label', text: '消息角色' }),
                roleEd,
              ]),
            ]),
            createEl(doc, 'div', { className: 'ups-field' }, [
              createEl(doc, 'label', { className: 'ups-label', text: '提示词正文' }),
              contentEd,
            ]),
            createEl(doc, 'div', { className: 'ups-btn-row' }, [applyBtn]),
          ])
        );
      }

      return createEl(doc, 'div', { className: 'ups-entry-card' }, cardChildren);
    });

    stackListEl.replaceChildren(...cards);
  }

  function renderTasteTab() {
    const useBuiltin = settings.tasteProfile.useBuiltinBanned !== false;
    useBuiltinBannedBtn.classList.toggle('is-on', useBuiltin);
    useBuiltinBannedBtn.setAttribute('aria-checked', String(useBuiltin));

    const q = state.tasteSearchQuery.trim().toLowerCase();
    const filterList = (items) =>
      (items || []).filter((item) => {
        if (!q) return true;
        return (
          String(item.text || '').toLowerCase().includes(q) ||
          String(item.note || '').toLowerCase().includes(q)
        );
      });

    const renderGroup = (title, items, kind) => {
      const rows = filterList(items).map((item) => {
        const delBtn = createEl(doc, 'button', { type: 'button', className: 'ups-btn-ghost', text: '移除' });
        delBtn.addEventListener('click', () => {
          settings.tasteProfile[kind] = (settings.tasteProfile[kind] || []).filter((x) => x.id !== item.id);
          renderTasteTab();
          persistSettings();
          syncDraftRelatedViews();
        });
        const metaChildren = [createEl(doc, 'div', { className: 'ups-entry-title', text: item.text })];
        if (item.note) {
          metaChildren.push(createEl(doc, 'div', { className: 'ups-muted', text: item.note }));
        }
        return createEl(doc, 'div', { className: 'ups-entry-row' }, [
          createEl(doc, 'div', { style: { minWidth: '0', flex: '1 1 auto' } }, metaChildren),
          delBtn,
        ]);
      });

      return createEl(doc, 'div', { className: 'ups-entry-card' }, [
        createEl(doc, 'div', { className: 'ups-entry-row' }, [
          createEl(doc, 'span', { className: 'ups-card-title', text: `${title}（${items.length}）` }),
        ]),
        ...(rows.length
          ? rows
          : [createEl(doc, 'div', { className: 'ups-muted', style: { padding: '8px 10px' }, text: '暂无匹配记录' })]),
      ]);
    };

    tasteListContainer.replaceChildren(
      renderGroup('偏爱特质锚点', settings.tasteProfile.anchors || [], 'anchors'),
      renderGroup('个人拉黑 / 禁写规则', settings.tasteProfile.banned || [], 'banned')
    );
  }

  function renderSettingsTab({ syncInputs = true } = {}) {
    providerSelect.value = settings.api.provider === 'custom' ? 'custom' : 'host';
    customApiCard.hidden = settings.api.provider !== 'custom';
    colorModeSelect.value = settings.colorMode || 'auto';

    showPersonaBtnSwitch.classList.toggle('is-on', Boolean(settings.ui.showPersonaBtn));
    showPersonaBtnSwitch.setAttribute('aria-checked', String(Boolean(settings.ui.showPersonaBtn)));
    showWandMenuSwitch.classList.toggle('is-on', Boolean(settings.ui.showWandMenu));
    showWandMenuSwitch.setAttribute('aria-checked', String(Boolean(settings.ui.showWandMenu)));

    const profiles = settings.api.profiles || [];
    const activeProfile = getActiveCustomProfile(settings);
    if (profiles.length === 0) {
      apiProfileSelect.replaceChildren(createEl(doc, 'option', { value: '', text: '暂无保存方案（可点新建）' }));
      apiProfileSelect.value = '';
    } else {
      apiProfileSelect.replaceChildren(
        ...profiles.map((p) => createEl(doc, 'option', { value: p.id, text: p.name }))
      );
      if (activeProfile) apiProfileSelect.value = activeProfile.id;
    }

    const hasProfile = Boolean(activeProfile);
    profileRenameBtn.disabled = !hasProfile;
    profileDeleteBtn.disabled = !hasProfile;
    if (state.pendingDeleteProfileId && activeProfile && state.pendingDeleteProfileId === activeProfile.id) {
      profileDeleteBtn.hidden = true;
      profileDeleteConfirmBtn.hidden = false;
      profileDeleteCancelBtn.hidden = false;
    } else {
      state.pendingDeleteProfileId = '';
      profileDeleteBtn.hidden = false;
      profileDeleteConfirmBtn.hidden = true;
      profileDeleteCancelBtn.hidden = true;
    }

    if (syncInputs) {
      if (activeProfile) {
        if (doc.activeElement !== profileNameInput && shadow.activeElement !== profileNameInput) {
          profileNameInput.value = activeProfile.name || '';
        }
        apiUrlInput.value = activeProfile.baseUrl || '';
        apiKeyInput.value = activeProfile.apiKey || '';
        apiKeyInput.type = state.revealApiKey ? 'text' : 'password';
        toggleKeyVisBtn.textContent = state.revealApiKey ? '隐藏' : '显示';
        apiKeyMaskEl.textContent = activeProfile.apiKey ? maskApiKey(activeProfile.apiKey) : '未填写';
        apiModelInput.value = activeProfile.model || '';
        apiTempInput.value =
          activeProfile.temperature === null || activeProfile.temperature === undefined
            ? ''
            : String(activeProfile.temperature);
        apiMaxTokensInput.value = String(activeProfile.maxTokens ?? 4096);
        apiTopPInput.value =
          activeProfile.topP === null || activeProfile.topP === undefined
            ? ''
            : String(activeProfile.topP);
        apiTimeoutInput.value = String(activeProfile.timeoutSeconds ?? 120);
        const streamOn = activeProfile.stream !== false;
        apiStreamSwitch.classList.toggle('is-on', streamOn);
        apiStreamSwitch.setAttribute('aria-checked', String(streamOn));
      } else {
        profileNameInput.value = '';
        apiUrlInput.value = '';
        apiKeyInput.value = '';
        apiKeyMaskEl.textContent = '未填写';
        apiModelInput.value = '';
        apiTempInput.value = '';
        apiMaxTokensInput.value = '';
        apiTopPInput.value = '';
        apiTimeoutInput.value = '';
        apiStreamSwitch.classList.add('is-on');
        apiStreamSwitch.setAttribute('aria-checked', 'true');
      }
    }

    if (state.fetchedModels.length > 0) {
      apiModelSelect.hidden = false;
      apiModelSelect.replaceChildren(
        ...state.fetchedModels.map((m) => createEl(doc, 'option', { value: m, text: m }))
      );
      if (activeProfile?.model && state.fetchedModels.includes(activeProfile.model)) {
        apiModelSelect.value = activeProfile.model;
      }
    } else {
      apiModelSelect.hidden = true;
      apiModelSelect.replaceChildren();
    }
  }

  function ensureActiveProfileForEdits({ syncInputs = false } = {}) {
    let active = getActiveCustomProfile(settings);
    if (!active) {
      const created = createApiProfile({ name: profileNameInput.value.trim() || '自定义方案 1' }, settings.api.profiles);
      settings.api.profiles.push(created);
      settings.api.activeProfileId = created.id;
      active = created;
      renderSettingsTab({ syncInputs });
    }
    return active;
  }

  function switchTab(tabId) {
    if (!tabButtons.has(tabId)) return;
    state.activeTab = tabId;
    popoverEl.hidden = true;
    closeFloatingMenu();
    for (const [id, btn] of tabButtons.entries()) {
      const active = id === tabId;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', String(active));
    }
    studioTabPanel.hidden = tabId !== 'studio';
    presetsTabPanel.hidden = tabId !== 'presets';
    tasteTabPanel.hidden = tabId !== 'taste';
    settingsTabPanel.hidden = tabId !== 'settings';

    if (tabId === 'presets') renderStackTab();
    if (tabId === 'taste') renderTasteTab();
    if (tabId === 'settings') renderSettingsTab();
  }

  function setMode(nextMode) {
    state.mode = nextMode === 'B' ? 'B' : 'A';
    modeABtn.classList.toggle('is-active', state.mode === 'A');
    modeBBtn.classList.toggle('is-active', state.mode === 'B');
    modeAPanel.hidden = state.mode !== 'A';
    modeBPanel.hidden = state.mode !== 'B';
  }

  function openSubmodal({ title, bodyNodes = [], footerNodes = [] }) {
    popoverEl.hidden = true;
    closeFloatingMenu();
    submodalTitleEl.textContent = title || '';
    submodalBodyEl.replaceChildren(...bodyNodes);
    submodalFooterEl.replaceChildren(...footerNodes);
    submodalMaskEl.hidden = false;
  }

  function closeSubmodal() {
    submodalMaskEl.hidden = true;
    submodalBodyEl.replaceChildren();
    submodalFooterEl.replaceChildren();
  }

  submodalCloseBtn.addEventListener('click', closeSubmodal, { signal });

  // ==========================================================================
  // Context Refresh & Host Persistence
  // ==========================================================================

  async function refreshContext() {
    try {
      const [activeP, allP, charCtx] = await Promise.all([
        hostApi.getActivePersona().catch(() => null),
        hostApi.listPersonas().catch(() => []),
        hostApi.getActiveCharacterContext({ includeWorldSummary: true }).catch(() => null),
      ]);
      state.cachedActivePersona = activeP;
      state.cachedPersonas = Array.isArray(allP) ? allP : [];
      state.cachedCharContext = charCtx;

      if (charCtx?.name) {
        ctxChip.textContent = charCtx.name;
        ctxChip.hidden = false;
        charContextHint.textContent = `当前角色：${charCtx.name}${charCtx.worldName ? `（绑定世界书：${charCtx.worldName}）` : ''}`;
      } else {
        ctxChip.hidden = true;
        charContextHint.textContent = '当前未打开角色卡，将仅依据灵感与方案生成。';
      }

      if (state.cachedPersonas.length > 0) {
        personaPickerSelect.replaceChildren(
          ...state.cachedPersonas.map((p) =>
            createEl(doc, 'option', { value: p.avatarId, text: p.isActive ? `${p.name}（当前）` : p.name })
          )
        );
        if (activeP?.avatarId) personaPickerSelect.value = activeP.avatarId;
      } else {
        personaPickerSelect.replaceChildren(createEl(doc, 'option', { value: '', text: '暂无可选人设' }));
      }

      if (activeP?.name && !saveNameInput.value.trim()) {
        saveNameInput.value = activeP.name;
      }
    } catch {
      // ignore non-fatal context refresh failure
    }
  }

  // ==========================================================================
  // Generation, Diff, Export & Write-Back Actions
  // ==========================================================================

  function buildCurrentPrompt({ targetSection = '' } = {}) {
    const scheme = getActiveScheme(settings);
    const mustRaw = state.mode === 'A' ? mustHavesAInput.value : mustHavesBInput.value;
    const userMustHaves = mustRaw.trim();
    const targetSec = String(targetSection || '').trim();
    const isSectionRegen = Boolean(targetSec);

    const existingDraft = isSectionRegen
      ? draftTextarea.value.trim() || existingDraftInput.value.trim() || state.cachedActivePersona?.description || ''
      : state.mode === 'B'
        ? existingDraftInput.value.trim() || draftTextarea.value.trim() || state.cachedActivePersona?.description || ''
        : draftTextarea.value.trim();

    return buildGenerationMessages({
      mode: isSectionRegen ? 'optimize' : state.mode === 'A' ? 'create' : 'optimize',
      subMode: isSectionRegen
        ? state.mode === 'B'
          ? subModeSelect.value
          : 'de_label_reformat'
        : state.mode === 'B'
          ? subModeSelect.value
          : '',
      scheme,
      inspiration: inspirationInput.value,
      charContext: state.injectChar ? state.cachedCharContext : null,
      existingDraft,
      lockedCore: lockedCoreInput.value,
      userMustHaves,
      tasteProfile: settings.tasteProfile,
      dualLayer: state.dualLayer,
      targetSection: targetSec,
    });
  }

  function showPromptPreview() {
    try {
      const built = buildCurrentPrompt();
      const pre = createEl(doc, 'textarea', {
        className: 'ups-textarea',
        rows: 12,
        readOnly: true,
        value: built.assembledPromptText,
      });
      const copyPromptBtn = createEl(doc, 'button', { type: 'button', className: 'ups-btn ups-btn-primary', text: '复制完整提示词' });
      copyPromptBtn.addEventListener('click', () => {
        win?.navigator?.clipboard?.writeText?.(built.assembledPromptText).catch(() => {});
        setStatus('已复制组装提示词');
        closeSubmodal();
      });
      const closePreviewBtn = createEl(doc, 'button', { type: 'button', className: 'ups-btn-ghost', text: '关闭' });
      closePreviewBtn.addEventListener('click', closeSubmodal);
      openSubmodal({
        title: `提示词预览（约 ${built.estimatedTokens} tokens · ${built.messages.length} 条消息）`,
        bodyNodes: [pre],
        footerNodes: [closePreviewBtn, copyPromptBtn],
      });
    } catch (err) {
      setStatus(`提示词组装提示：${err.message}`, 'warn');
    }
  }

  async function executeGeneration({ targetSection = '' } = {}) {
    if (state.isGenerating) {
      state.genAbort?.abort();
      return;
    }

    const ac = new AbortController();
    state.isGenerating = true;
    state.genAbort = ac;
    generateABtn.textContent = '停止生成';
    generateBBtn.textContent = '停止生成';
    regenSectionBtn.disabled = true;

    const prevDraftBeforeGen = draftTextarea.value;
    try {
      if (state.mode === 'B' && !existingDraftInput.value.trim()) {
        const fallbackExisting = draftTextarea.value.trim() || state.cachedActivePersona?.description || '';
        if (fallbackExisting) {
          existingDraftInput.value = fallbackExisting;
        } else {
          setStatus('正在读取当前人设…');
          const fresh = await hostApi.getActivePersona().catch(() => null);
          if (ac.signal.aborted) {
            setStatus('已停止生成');
            return;
          }
          if (fresh?.description) {
            state.cachedActivePersona = fresh;
            existingDraftInput.value = fresh.description;
          }
        }
      }

      let built;
      try {
        built = buildCurrentPrompt({ targetSection });
      } catch (err) {
        setStatus(`无法生成：${err.message}`, 'warn');
        return;
      }

      if (state.mode === 'B' && !targetSection) {
        state.baselineDraft = existingDraftInput.value.trim() || draftTextarea.value.trim();
      }

      setStatus(targetSection ? `正在局部重生成【${targetSection}】…` : '正在生成人设…');

      const res = await hostApi.runStudioGeneration({
        settings,
        messages: built.messages,
        signal: ac.signal,
        onChunk: (_delta, fullText) => {
          if (!targetSection) {
            draftTextarea.value = fullText;
          }
        },
      });

      const cleaned = normalizeFlatLayout(res.text || '');
      let finalDraft = cleaned;
      if (targetSection) {
        const returnedSecs = parsePersonaSections(cleaned);
        let sectionBody = cleaned;
        if (returnedSecs.length > 1) {
          const matched = returnedSecs.find(
            (s) => s.title === targetSection || s.title.toLowerCase() === targetSection.toLowerCase()
          );
          if (matched) sectionBody = matched.content;
        }
        finalDraft = mergeSectionUpdate(prevDraftBeforeGen, targetSection, sectionBody);
      } else if (state.mode === 'A') {
        state.baselineDraft = finalDraft;
      }
      state.tasteBaselineDraft = finalDraft;

      setDraftValue(finalDraft, { recordHistory: true });
      setStatus(targetSection ? `已完成【${targetSection}】重生成` : `生成完成（来源：${res.source || 'host'}）`);
    } catch (err) {
      if (ac.signal.aborted || err?.code === 'ABORTED' || err?.name === 'AbortError') {
        setStatus('已停止生成');
      } else {
        setStatus(`生成失败：${err?.message || '请检查连接或复制提示词外部生成'}`, 'warn');
      }
    } finally {
      if (state.genAbort === ac) {
        state.isGenerating = false;
        state.genAbort = null;
        generateABtn.textContent = '生成人设';
        generateBBtn.textContent = '生成优化稿';
        syncDraftRelatedViews();
      }
    }
  }

  function runTasteCandidateExtraction() {
    const draft = draftTextarea.value || '';
    const baseline = state.tasteBaselineDraft || state.baselineDraft || existingDraftInput.value || '';
    if (!draft.trim()) {
      setStatus('文稿为空，无法归纳审美候选', 'warn');
      return;
    }
    const candidates = extractTasteCandidates(baseline, draft, settings.tasteProfile);
    state.lastCandidates = candidates;
    const items = [];

    for (const cand of candidates.bannedCandidates) {
      const cb = createEl(doc, 'input', { type: 'checkbox', checked: true });
      cb._candKind = 'banned';
      cb._candItem = cand;
      items.push(
        createEl(doc, 'label', { className: 'ups-check-row' }, [
          cb,
          createEl(doc, 'span', { className: 'ups-badge ups-badge-warn', text: '禁写候选' }),
          createEl(doc, 'span', { text: `${cand.text}（${cand.reason}）` }),
        ])
      );
    }
    for (const cand of candidates.anchorCandidates) {
      const cb = createEl(doc, 'input', { type: 'checkbox', checked: true });
      cb._candKind = 'anchors';
      cb._candItem = cand;
      items.push(
        createEl(doc, 'label', { className: 'ups-check-row' }, [
          cb,
          createEl(doc, 'span', { className: 'ups-badge ups-badge-ok', text: '偏爱锚点' }),
          createEl(doc, 'span', { text: `${cand.text}（${cand.reason}）` }),
        ])
      );
    }

    if (items.length === 0) {
      tasteCandidatesListEl.replaceChildren(
        createEl(doc, 'div', { className: 'ups-muted', text: '暂未检测到新的删改偏好差异。' })
      );
    } else {
      tasteCandidatesListEl.replaceChildren(...items);
    }
    tasteCandidatesBox.hidden = false;
    setStatus(`已归纳 ${items.length} 条审美候选`);
  }

  function confirmTasteCandidates() {
    const checkboxes = Array.from(tasteCandidatesListEl.querySelectorAll('input[type="checkbox"]'));
    const nextBanned = [];
    const nextAnchors = [];
    for (const cb of checkboxes) {
      if (!cb.checked || !cb._candItem) continue;
      const entry = {
        text: cb._candItem.text,
        note: cb._candItem.sourceLine ? `${cb._candItem.reason} · ${cb._candItem.sourceLine}` : cb._candItem.reason,
      };
      if (cb._candKind === 'banned') nextBanned.push(entry);
      else nextAnchors.push(entry);
    }
    settings.tasteProfile.banned = mergeTasteEntries(settings.tasteProfile.banned, nextBanned);
    settings.tasteProfile.anchors = mergeTasteEntries(settings.tasteProfile.anchors, nextAnchors);
    tasteCandidatesBox.hidden = true;
    renderTasteTab();
    syncDraftRelatedViews();
    persistSettings();
    setStatus(`已沉淀 ${nextAnchors.length} 条偏爱锚点、${nextBanned.length} 条禁写规则`);
  }

  async function saveCurrentPersona(mode) {
    if (state.isSaving) return;
    const rawDraft = draftTextarea.value.trim();
    if (!rawDraft) {
      setStatus('请先生成或输入人设正文再保存', 'warn');
      return;
    }
    const split = state.dualLayer ? splitDualLayerOutput(rawDraft) : { coreDescription: rawDraft, worldbookEntries: [] };
    const description = split.coreDescription || rawDraft;
    const nameInputVal = saveNameInput.value.trim();

    state.isSaving = true;
    saveOverwriteBtn.disabled = true;
    saveNewBtn.disabled = true;
    footerSaveBtn.disabled = true;
    try {
      if (!state.cachedActivePersona) {
        const fresh = await hostApi.getActivePersona?.().catch(() => null);
        if (fresh) state.cachedActivePersona = fresh;
      }

      const targetName = mode === 'create'
        ? nameInputVal || `${state.cachedActivePersona?.name || '新人设'}_工坊版`
        : nameInputVal || state.cachedActivePersona?.name || 'User';

      const hasDualEntries = state.dualLayer && split.worldbookEntries.length > 0;
      let finalLorebook = mode === 'create' ? '' : state.cachedActivePersona?.lorebook;

      if (hasDualEntries) {
        const wbName = wbNameInput.value.trim() || `${targetName}_补充设定`;
        await hostApi.saveSupplementaryWorldbook({
          worldName: wbName,
          entries: split.worldbookEntries,
        });
        finalLorebook = wbName;
      }

      const saved = await hostApi.savePersonaToHost({
        mode,
        avatarId: mode === 'overwrite' ? state.cachedActivePersona?.avatarId : undefined,
        name: targetName,
        description,
        lorebook: finalLorebook,
        setAsActive: true,
      });
      await refreshContext();
      setStatus(`已${mode === 'create' ? '新建并切换' : '更新'}人设：${saved.name}`);
    } catch (err) {
      setStatus(`保存人设失败：${err?.message || '宿主接口异常'}`, 'warn');
    } finally {
      state.isSaving = false;
      saveOverwriteBtn.disabled = false;
      saveNewBtn.disabled = false;
      footerSaveBtn.disabled = false;
    }
  }

  function exportNativePresetNow({ includeTaste = true, includeUsageGuide = true, presetName = '' } = {}) {
    const scheme = getActiveScheme(settings);
    const name = (presetName || `${scheme?.name || 'User人设工坊'}_ST原生预设`).trim();
    const presetObj = exportSillyTavernPreset({
      scheme,
      tasteProfile: settings.tasteProfile,
      presetName: name,
      includeTaste,
      includeUsageGuide,
    });
    const safeFileName = `${name.replace(/[\\/:*?"<>|]/g, '_')}.json`;
    const jsonText = triggerJsonDownload(doc, win, safeFileName, presetObj);
    win?.navigator?.clipboard?.writeText?.(jsonText).catch(() => {});
    setStatus(`已导出酒馆原生预设 JSON：${safeFileName}`);
    return presetObj;
  }

  // ==========================================================================
  // Event Wiring
  // ==========================================================================

  // Topbar controls
  paletteSelect.addEventListener('change', () => {
    settings.palette = paletteSelect.value;
    applyTheme();
    persistSettings();
  }, { signal });

  minimizeBtn.addEventListener('click', () => minimize(), { signal });
  miniBtn.addEventListener('click', () => toggleMini(), { signal });
  closeBtn.addEventListener('click', () => close(), { signal });

  // Tabs
  for (const [id, btn] of tabButtons.entries()) {
    btn.addEventListener('click', () => switchTab(id), { signal });
  }

  // Popover
  popoverBtn.addEventListener('click', () => {
    const willOpen = popoverEl.hidden;
    popoverEl.hidden = !willOpen;
    if (willOpen) {
      const r = popoverBtn.getBoundingClientRect?.() || { left: 20, right: 120, bottom: 120, top: 80 };
      const vw = Number(win?.innerWidth || 1280);
      const vh = Number(win?.innerHeight || 800);
      const pw = Math.min(300, vw - 20);
      const ph = popoverEl.offsetHeight || 190;
      const left = Math.max(10, Math.min(vw - pw - 10, r.right - pw));
      const top = r.bottom + ph + 10 > vh ? Math.max(10, r.top - ph - 6) : Math.max(10, r.bottom + 6);
      popoverEl.style.left = `${Math.round(left)}px`;
      popoverEl.style.top = `${Math.round(top)}px`;
    }
  }, { signal });

  injectCharCheckbox.addEventListener('change', () => {
    state.injectChar = injectCharCheckbox.checked;
  }, { signal });

  dualLayerCheckbox.addEventListener('change', () => {
    state.dualLayer = dualLayerCheckbox.checked;
    syncDraftRelatedViews();
  }, { signal });

  popoverTailSelect.addEventListener('change', () => {
    const active = getActiveScheme(settings);
    if (!active) return;
    active.tailMode = popoverTailSelect.value;
    tailModeSelect.value = active.tailMode;
    persistSettings();
  }, { signal });

  // Tab 1 controls
  modeABtn.addEventListener('click', () => setMode('A'), { signal });
  modeBBtn.addEventListener('click', () => setMode('B'), { signal });

  schemeSelect.addEventListener('change', () => {
    settings.activeSchemeId = schemeSelect.value;
    updateSchemeSelects();
    syncDraftRelatedViews();
    persistSettings();
  }, { signal });

  generateABtn.addEventListener('click', () => executeGeneration(), { signal });
  generateBBtn.addEventListener('click', () => executeGeneration(), { signal });
  previewPromptABtn.addEventListener('click', showPromptPreview, { signal });
  previewPromptBBtn.addEventListener('click', showPromptPreview, { signal });
  regenSectionBtn.addEventListener('click', () => {
    const sec = sectionSelect.value || SHELL_SECTION_HEADER;
    executeGeneration({ targetSection: sec });
  }, { signal });

  loadPersonaBtn.addEventListener('click', () => {
    const chosenId = personaPickerSelect.value;
    const picked =
      state.cachedPersonas.find((p) => p.avatarId === chosenId) ||
      state.cachedActivePersona;

    if (picked?.description !== undefined) {
      existingDraftInput.value = picked.description || '';
      state.baselineDraft = picked.description || '';
      state.tasteBaselineDraft = picked.description || '';
      setDraftValue(picked.description || '', { recordHistory: true });
      if (picked.name) saveNameInput.value = picked.name;
      setStatus(`已载入人设：${picked.name || '当前人设'}`);
      return;
    }

    hostApi.getActivePersona().then((fresh) => {
      if (!fresh || state.isGenerating) return;
      state.cachedActivePersona = fresh;
      existingDraftInput.value = fresh.description || '';
      state.baselineDraft = fresh.description || '';
      state.tasteBaselineDraft = fresh.description || '';
      setDraftValue(fresh.description || '', { recordHistory: true });
      if (fresh.name) saveNameInput.value = fresh.name;
      setStatus(`已载入人设：${fresh.name}`);
    }).catch(() => {});
  }, { signal });

  lockCoreBtn.addEventListener('click', () => {
    const src = existingDraftInput.value.trim() || draftTextarea.value.trim();
    const { core } = splitCoreAndShell(src);
    lockedCoreInput.value = core || src;
    setStatus(core ? '已提取并锁定人物本体核' : '未检测到本体核标题，已填入全文供参考');
  }, { signal });

  flattenBtn.addEventListener('click', () => {
    const flattened = normalizeFlatLayout(draftTextarea.value);
    setDraftValue(flattened, { recordHistory: true });
    setStatus('已完成扁平化排版整理');
  }, { signal });

  draftTextarea.addEventListener('input', () => {
    draftHistory.push(draftTextarea.value);
    syncUndoRedoButtons();
    syncDraftRelatedViews();
  }, { signal });

  draftTextarea.addEventListener('keydown', (ev) => {
    const mod = ev.ctrlKey || ev.metaKey;
    if (!mod) return;
    if (ev.key.toLowerCase() === 'z' && !ev.shiftKey) {
      ev.preventDefault();
      setDraftValue(draftHistory.undo(), { recordHistory: false });
    } else if ((ev.key.toLowerCase() === 'z' && ev.shiftKey) || ev.key.toLowerCase() === 'y') {
      ev.preventDefault();
      setDraftValue(draftHistory.redo(), { recordHistory: false });
    }
  }, { signal });

  extractTasteBtn.addEventListener('click', runTasteCandidateExtraction, { signal });
  confirmTasteBtn.addEventListener('click', confirmTasteCandidates, { signal });

  quickBanLineBtn.addEventListener('click', () => {
    const line = getTextareaCurrentLine(draftTextarea).replace(/^\[[^\]]+\]\s*/, '').trim();
    if (!line) {
      setStatus('请先将光标定位到或选中要拉黑的句子', 'warn');
      return;
    }
    settings.tasteProfile.banned = mergeTasteEntries(settings.tasteProfile.banned, [
      { text: line, note: '单句一键拉黑' },
    ]);
    renderTasteTab();
    syncDraftRelatedViews();
    persistSettings();
    setStatus(`已拉黑写法：${line.slice(0, 24)}`);
  }, { signal });

  quickAnchorLineBtn.addEventListener('click', () => {
    const line = getTextareaCurrentLine(draftTextarea).replace(/^\[[^\]]+\]\s*/, '').trim();
    if (!line) {
      setStatus('请先将光标定位到或选中要收藏的句子', 'warn');
      return;
    }
    settings.tasteProfile.anchors = mergeTasteEntries(settings.tasteProfile.anchors, [
      { text: line, note: '单句收藏锚点' },
    ]);
    renderTasteTab();
    persistSettings();
    setStatus(`已收藏偏爱锚点：${line.slice(0, 24)}`);
  }, { signal });

  saveWbBtn.addEventListener('click', async () => {
    const split = splitDualLayerOutput(draftTextarea.value);
    if (!split.worldbookEntries.length) {
      setStatus('未解析到补充世界书条目', 'warn');
      return;
    }
    const worldName = wbNameInput.value.trim() || `${saveNameInput.value.trim() || 'User人设'}_补充设定`;
    try {
      const res = await hostApi.saveSupplementaryWorldbook({
        worldName,
        entries: split.worldbookEntries,
        avatarId: state.cachedActivePersona?.avatarId,
      });
      setStatus(`已保存 ${res.entryCount} 条补充世界书到「${res.worldName}」`);
    } catch (err) {
      setStatus(`保存世界书失败：${err?.message || '宿主接口异常'}`, 'warn');
    }
  }, { signal });

  saveOverwriteBtn.addEventListener('click', () => saveCurrentPersona('overwrite'), { signal });
  saveNewBtn.addEventListener('click', () => saveCurrentPersona('create'), { signal });

  // Footer controls
  undoBtn.addEventListener('click', () => {
    setDraftValue(draftHistory.undo(), { recordHistory: false });
  }, { signal });
  redoBtn.addEventListener('click', () => {
    setDraftValue(draftHistory.redo(), { recordHistory: false });
  }, { signal });
  copyBtn.addEventListener('click', () => {
    win?.navigator?.clipboard?.writeText?.(draftTextarea.value || '').catch(() => {});
    setStatus('已复制当前人设正文');
  }, { signal });
  exportPresetBtn.addEventListener('click', () => exportNativePresetNow(), { signal });
  footerSaveBtn.addEventListener('click', () => saveCurrentPersona('overwrite'), { signal });

  // Tab 2 controls
  stackSchemeSelect.addEventListener('change', () => {
    settings.activeSchemeId = stackSchemeSelect.value;
    renderStackTab();
    persistSettings();
  }, { signal });

  schemeSaveAsBtn.addEventListener('click', () => {
    try {
      const name = schemeNameInput.value.trim() || `${getActiveScheme(settings)?.name || '方案'} 副本`;
      settings = saveSchemeAs(settings, settings.activeSchemeId, name, { autoSuffix: true });
      schemeNameInput.value = '';
      renderStackTab();
      persistSettings();
      setStatus(`已另存方案：${getActiveScheme(settings)?.name}`);
    } catch (err) {
      setStatus(err.message, 'warn');
    }
  }, { signal });

  schemeRenameBtn.addEventListener('click', () => {
    try {
      const name = schemeNameInput.value.trim();
      if (!name) {
        setStatus('请先输入新方案名称', 'warn');
        return;
      }
      settings = renameScheme(settings, settings.activeSchemeId, name);
      schemeNameInput.value = '';
      renderStackTab();
      persistSettings();
      setStatus(`已重命名为：${name}`);
    } catch (err) {
      setStatus(err.message, 'warn');
    }
  }, { signal });

  schemeDeleteBtn.addEventListener('click', () => {
    settings = deleteScheme(settings, settings.activeSchemeId);
    renderStackTab();
    persistSettings();
    setStatus('已删除方案');
  }, { signal });

  tailModeSelect.addEventListener('change', () => {
    const active = getActiveScheme(settings);
    if (!active) return;
    active.tailMode = tailModeSelect.value;
    popoverTailSelect.value = active.tailMode;
    persistSettings();
  }, { signal });

  prefillInput.addEventListener('change', () => {
    const active = getActiveScheme(settings);
    if (!active) return;
    active.prefillText = prefillInput.value;
    persistSettings();
  }, { signal });

  triggerInput.addEventListener('change', () => {
    const active = getActiveScheme(settings);
    if (!active) return;
    active.triggerText = triggerInput.value;
    persistSettings();
  }, { signal });

  schemeTempInput.addEventListener('change', () => {
    const active = getActiveScheme(settings);
    if (!active) return;
    const raw = schemeTempInput.value.trim();
    if (raw === '') {
      schemeTempInput.value = String(active.temperature ?? 0.85);
      return;
    }
    const v = Number(raw);
    if (Number.isFinite(v)) {
      const clamped = Math.max(0, Math.min(2, v));
      active.temperature = clamped;
      schemeTempInput.value = String(clamped);
    } else {
      schemeTempInput.value = String(active.temperature ?? 0.85);
      return;
    }
    persistSettings();
  }, { signal });

  schemeMaxTokensInput.addEventListener('change', () => {
    const active = getActiveScheme(settings);
    if (!active) return;
    const raw = schemeMaxTokensInput.value.trim();
    if (raw === '') {
      schemeMaxTokensInput.value = String(active.maxTokens ?? 4096);
      return;
    }
    const v = Math.round(Number(raw));
    if (Number.isFinite(v)) {
      const clamped = Math.max(256, Math.min(32768, v));
      active.maxTokens = clamped;
      schemeMaxTokensInput.value = String(clamped);
    } else {
      schemeMaxTokensInput.value = String(active.maxTokens ?? 4096);
      return;
    }
    persistSettings();
  }, { signal });

  stackSearchInput.addEventListener('compositionstart', () => {
    state.stackSearchComposing = true;
  }, { signal });
  stackSearchInput.addEventListener('compositionend', () => {
    state.stackSearchComposing = false;
    state.stackSearchQuery = stackSearchInput.value;
    renderStackTab();
  }, { signal });
  stackSearchInput.addEventListener('input', () => {
    if (state.stackSearchComposing) return;
    state.stackSearchQuery = stackSearchInput.value;
    renderStackTab();
  }, { signal });

  addStackEntryBtn.addEventListener('click', () => {
    const active = getActiveScheme(settings);
    if (!active) return;
    const nextScheme = addCustomStackEntry(active, {
      name: '自定义补充规则',
      role: 'system',
      slotType: 'custom',
      content: '在此填写补充写作要求或人物细节规则。',
    });
    settings.schemes = settings.schemes.map((s) => (s.id === active.id ? nextScheme : s));
    const added = nextScheme.entries[nextScheme.entries.length - 1];
    if (added) state.expandedEntryIds.add(added.id);
    renderStackTab();
    persistSettings();
  }, { signal });

  exportPresetModalBtn.addEventListener('click', () => {
    const active = getActiveScheme(settings);
    const nameIn = createEl(doc, 'input', {
      type: 'text',
      className: 'ups-input',
      value: `${active?.name || 'User人设工坊'}_ST原生预设`,
    });
    const incTasteCb = createEl(doc, 'input', { type: 'checkbox', checked: true });
    const incGuideCb = createEl(doc, 'input', { type: 'checkbox', checked: true });
    const confirmExpBtn = createEl(doc, 'button', { type: 'button', className: 'ups-btn ups-btn-primary', text: '下载原生预设 JSON' });
    confirmExpBtn.addEventListener('click', () => {
      exportNativePresetNow({
        presetName: nameIn.value.trim(),
        includeTaste: incTasteCb.checked,
        includeUsageGuide: incGuideCb.checked,
      });
      closeSubmodal();
    });
    const cancelExpBtn = createEl(doc, 'button', { type: 'button', className: 'ups-btn-ghost', text: '取消' });
    cancelExpBtn.addEventListener('click', closeSubmodal);
    openSubmodal({
      title: '导出酒馆原生预设（OpenAI Chat Completion）',
      bodyNodes: [
        createEl(doc, 'div', { className: 'ups-field' }, [
          createEl(doc, 'label', { className: 'ups-label', text: '预设名称' }),
          nameIn,
        ]),
        createEl(doc, 'label', { className: 'ups-check-row' }, [
          incTasteCb,
          createEl(doc, 'span', { text: '注入个人审美锚点与禁写词库' }),
        ]),
        createEl(doc, 'label', { className: 'ups-check-row' }, [
          incGuideCb,
          createEl(doc, 'span', { text: '附带说明与聊天框使用指引条目' }),
        ]),
      ],
      footerNodes: [cancelExpBtn, confirmExpBtn],
    });
  }, { signal });

  // Tab 3 controls
  useBuiltinBannedBtn.addEventListener('click', () => {
    settings.tasteProfile.useBuiltinBanned = settings.tasteProfile.useBuiltinBanned === false;
    renderTasteTab();
    syncDraftRelatedViews();
    persistSettings();
  }, { signal });

  toggleBuiltinViewerBtn.addEventListener('click', () => {
    builtinViewerEl.hidden = !builtinViewerEl.hidden;
    toggleBuiltinViewerBtn.textContent = builtinViewerEl.hidden ? '查看内置底座' : '收起内置底座';
  }, { signal });

  dedupTasteBtn.addEventListener('click', () => {
    settings.tasteProfile.anchors = mergeTasteEntries(settings.tasteProfile.anchors, []);
    settings.tasteProfile.banned = mergeTasteEntries(settings.tasteProfile.banned, []);
    renderTasteTab();
    persistSettings();
    setStatus('已完成审美库去重合并');
  }, { signal });

  tasteSearchInput.addEventListener('compositionstart', () => {
    state.tasteSearchComposing = true;
  }, { signal });
  tasteSearchInput.addEventListener('compositionend', () => {
    state.tasteSearchComposing = false;
    state.tasteSearchQuery = tasteSearchInput.value;
    renderTasteTab();
  }, { signal });
  tasteSearchInput.addEventListener('input', () => {
    if (state.tasteSearchComposing) return;
    state.tasteSearchQuery = tasteSearchInput.value;
    renderTasteTab();
  }, { signal });

  addAnchorBtn.addEventListener('click', () => {
    const val = addAnchorInput.value.trim();
    if (!val) return;
    settings.tasteProfile.anchors = mergeTasteEntries(settings.tasteProfile.anchors, [
      { text: val, note: '手动添加' },
    ]);
    addAnchorInput.value = '';
    renderTasteTab();
    persistSettings();
  }, { signal });

  addBannedBtn.addEventListener('click', () => {
    const val = addBannedInput.value.trim();
    if (!val) return;
    settings.tasteProfile.banned = mergeTasteEntries(settings.tasteProfile.banned, [
      { text: val, note: '手动添加' },
    ]);
    addBannedInput.value = '';
    renderTasteTab();
    syncDraftRelatedViews();
    persistSettings();
  }, { signal });

  function abortPendingApiRequests() {
    const hadPending = Boolean(state.fetchModelsAbort || state.testConnAbort);
    state.fetchModelsAbort?.abort();
    state.fetchModelsAbort = null;
    state.testConnAbort?.abort();
    state.testConnAbort = null;
    if (hadPending) {
      connStatusEl.textContent = '尚未测试';
    }
  }

  // Tab 4 controls
  providerSelect.addEventListener('change', () => {
    settings.api.provider = providerSelect.value === 'custom' ? 'custom' : 'host';
    renderSettingsTab();
    persistSettings();
  }, { signal });

  apiProfileSelect.addEventListener('change', () => {
    abortPendingApiRequests();
    settings.api.activeProfileId = apiProfileSelect.value;
    state.pendingDeleteProfileId = '';
    state.fetchedModels = [];
    renderSettingsTab();
    persistSettings();
  }, { signal });

  profileCreateBtn.addEventListener('click', () => {
    const rawName = profileNameInput.value.trim() || `自定义方案 ${settings.api.profiles.length + 1}`;
    try {
      const created = createApiProfile({ name: rawName }, settings.api.profiles);
      abortPendingApiRequests();
      settings.api.profiles.push(created);
      settings.api.activeProfileId = created.id;
      state.pendingDeleteProfileId = '';
      state.fetchedModels = [];
      renderSettingsTab();
      persistSettings();
      setStatus(`已新建 API 方案：${created.name}`);
    } catch (err) {
      setStatus(err.message, 'warn');
    }
  }, { signal });

  profileRenameBtn.addEventListener('click', () => {
    const active = getActiveCustomProfile(settings);
    const nextName = profileNameInput.value.trim();
    if (!active || !nextName) {
      setStatus('请先填写新方案名称', 'warn');
      return;
    }
    active.name = nextName;
    state.pendingDeleteProfileId = '';
    renderSettingsTab();
    persistSettings();
    setStatus(`已重命名方案为：${nextName}`);
  }, { signal });

  profileDeleteBtn.addEventListener('click', () => {
    const active = getActiveCustomProfile(settings);
    if (!active) return;
    state.pendingDeleteProfileId = active.id;
    renderSettingsTab();
    setStatus(`请再次点击“确认删除”以移除方案「${active.name}」`, 'warn');
  }, { signal });

  profileDeleteCancelBtn.addEventListener('click', () => {
    state.pendingDeleteProfileId = '';
    renderSettingsTab();
    setStatus('已取消删除方案');
  }, { signal });

  profileDeleteConfirmBtn.addEventListener('click', () => {
    const active = getActiveCustomProfile(settings);
    if (!active) return;
    abortPendingApiRequests();
    settings.api.profiles = settings.api.profiles.filter((p) => p.id !== active.id);
    settings.api.activeProfileId = settings.api.profiles[0]?.id || '';
    state.pendingDeleteProfileId = '';
    state.fetchedModels = [];
    renderSettingsTab();
    persistSettings();
    setStatus(`已删除方案：${active.name}`);
  }, { signal });

  apiUrlInput.addEventListener('input', () => {
    const typedUrl = apiUrlInput.value.trim();
    const active = ensureActiveProfileForEdits({ syncInputs: false });
    active.baseUrl = typedUrl;
    persistSettings();
  }, { signal });

  apiUrlInput.addEventListener('blur', () => {
    const active = getActiveCustomProfile(settings);
    if (!active || !apiUrlInput.value.trim()) return;
    try {
      const normalized = normalizeBaseUrl(apiUrlInput.value);
      active.baseUrl = normalized;
      apiUrlInput.value = normalized;
      persistSettings();
    } catch (err) {
      setStatus(`Base URL 格式提醒：${err.message}`, 'warn');
    }
  }, { signal });

  apiKeyInput.addEventListener('input', () => {
    const typedKey = apiKeyInput.value;
    const active = ensureActiveProfileForEdits({ syncInputs: false });
    active.apiKey = typedKey;
    apiKeyMaskEl.textContent = active.apiKey ? maskApiKey(active.apiKey) : '未填写';
    persistSettings();
  }, { signal });

  toggleKeyVisBtn.addEventListener('click', () => {
    state.revealApiKey = !state.revealApiKey;
    apiKeyInput.type = state.revealApiKey ? 'text' : 'password';
    toggleKeyVisBtn.textContent = state.revealApiKey ? '隐藏' : '显示';
  }, { signal });

  apiModelInput.addEventListener('input', () => {
    const typedModel = apiModelInput.value.trim();
    const active = ensureActiveProfileForEdits({ syncInputs: false });
    active.model = typedModel;
    persistSettings();
  }, { signal });

  apiModelSelect.addEventListener('change', () => {
    const pickedModel = apiModelSelect.value;
    const active = ensureActiveProfileForEdits({ syncInputs: false });
    active.model = pickedModel;
    apiModelInput.value = pickedModel;
    persistSettings();
  }, { signal });

  apiTempInput.addEventListener('change', () => {
    const raw = apiTempInput.value.trim();
    const active = ensureActiveProfileForEdits({ syncInputs: false });
    if (raw === '') {
      active.temperature = null;
    } else {
      const v = Number(raw);
      if (Number.isFinite(v)) active.temperature = Math.max(0, Math.min(2, v));
    }
    persistSettings();
  }, { signal });

  apiMaxTokensInput.addEventListener('change', () => {
    const raw = apiMaxTokensInput.value.trim();
    const active = ensureActiveProfileForEdits({ syncInputs: false });
    if (raw !== '') {
      const v = Math.round(Number(raw));
      if (Number.isFinite(v)) {
        const clamped = Math.max(256, Math.min(32768, v));
        active.maxTokens = clamped;
        apiMaxTokensInput.value = String(clamped);
      }
    }
    persistSettings();
  }, { signal });

  apiTopPInput.addEventListener('change', () => {
    const raw = apiTopPInput.value.trim();
    const active = ensureActiveProfileForEdits({ syncInputs: false });
    if (raw === '') {
      active.topP = null;
    } else {
      const v = Number(raw);
      if (Number.isFinite(v)) active.topP = Math.max(0, Math.min(1, v));
    }
    persistSettings();
  }, { signal });

  apiTimeoutInput.addEventListener('change', () => {
    const raw = apiTimeoutInput.value.trim();
    const active = ensureActiveProfileForEdits({ syncInputs: false });
    if (raw !== '') {
      const v = Math.round(Number(raw));
      if (Number.isFinite(v)) {
        const clamped = Math.max(10, Math.min(300, v));
        active.timeoutSeconds = clamped;
        apiTimeoutInput.value = String(clamped);
      }
    }
    persistSettings();
  }, { signal });

  apiStreamSwitch.addEventListener('click', () => {
    const active = ensureActiveProfileForEdits({ syncInputs: false });
    active.stream = active.stream === false;
    const streamOn = active.stream !== false;
    apiStreamSwitch.classList.toggle('is-on', streamOn);
    apiStreamSwitch.setAttribute('aria-checked', String(streamOn));
    persistSettings();
  }, { signal });

  fetchModelsBtn.addEventListener('click', async () => {
    const active = getActiveCustomProfile(settings);
    if (!active) {
      setStatus('请先新建并填写自定义 API 方案', 'warn');
      return;
    }
    const targetId = active.id;
    state.fetchModelsAbort?.abort();
    const ac = new AbortController();
    state.fetchModelsAbort = ac;
    connStatusEl.textContent = '正在拉取模型…';
    try {
      const models = await hostApi.fetchCustomModels(active, ac.signal);
      if (ac.signal.aborted || state.fetchModelsAbort !== ac || getActiveCustomProfile(settings)?.id !== targetId) return;
      state.fetchedModels = models;
      const target = settings.api.profiles.find((p) => p.id === targetId);
      if (target && models.length > 0 && (!target.model || !models.includes(target.model))) {
        target.model = models[0];
      }
      renderSettingsTab();
      persistSettings();
      connStatusEl.textContent = `已拉取 ${models.length} 个模型`;
      setStatus(`已拉取 ${models.length} 个模型`);
    } catch (err) {
      if (ac.signal.aborted || state.fetchModelsAbort !== ac || err?.code === 'ABORTED' || err?.name === 'AbortError') return;
      const rawErr = err?.message || '请求失败';
      const safeErr = active.apiKey ? scrubApiKeyFromText(rawErr, active.apiKey) : rawErr;
      connStatusEl.textContent = `拉取失败：${safeErr}`;
      setStatus(connStatusEl.textContent, 'warn');
    } finally {
      if (state.fetchModelsAbort === ac) state.fetchModelsAbort = null;
    }
  }, { signal });

  testConnBtn.addEventListener('click', async () => {
    const active = getActiveCustomProfile(settings);
    if (!active) {
      connStatusEl.textContent = '请先新建并填写自定义 API 方案';
      return;
    }
    const targetId = active.id;
    state.testConnAbort?.abort();
    const ac = new AbortController();
    state.testConnAbort = ac;
    connStatusEl.textContent = '测试连接中…';
    try {
      const res = await hostApi.testCustomConnection(active, ac.signal);
      if (ac.signal.aborted || state.testConnAbort !== ac || getActiveCustomProfile(settings)?.id !== targetId) return;
      if (!res || typeof res !== 'object') {
        connStatusEl.textContent = '连接异常：未收到有效响应';
        setStatus(connStatusEl.textContent, 'warn');
        return;
      }
      const safeMsg = scrubApiKeyFromText(res.message || '', active.apiKey || '');
      connStatusEl.textContent = res.ok
        ? `连接正常（${res.latencyMs ?? 0}ms · ${res.modelCount ?? 0} 个模型）`
        : `连接异常：${safeMsg}`;
      setStatus(connStatusEl.textContent, res.ok ? 'muted' : 'warn');
    } catch (err) {
      if (ac.signal.aborted || state.testConnAbort !== ac || err?.code === 'ABORTED' || err?.name === 'AbortError') return;
      const rawErr = err?.message || '请求失败';
      const safeErr = scrubApiKeyFromText(rawErr, active.apiKey || '');
      connStatusEl.textContent = `连接异常：${safeErr}`;
      setStatus(connStatusEl.textContent, 'warn');
    } finally {
      if (state.testConnAbort === ac) state.testConnAbort = null;
    }
  }, { signal });

  colorModeSelect.addEventListener('change', () => {
    settings.colorMode = colorModeSelect.value;
    applyTheme();
    persistSettings();
  }, { signal });

  showPersonaBtnSwitch.addEventListener('click', () => {
    settings.ui.showPersonaBtn = !settings.ui.showPersonaBtn;
    renderSettingsTab();
    options.onEntryVisibilityChange?.(settings.ui);
    persistSettings();
  }, { signal });

  showWandMenuSwitch.addEventListener('click', () => {
    settings.ui.showWandMenu = !settings.ui.showWandMenu;
    renderSettingsTab();
    options.onEntryVisibilityChange?.(settings.ui);
    persistSettings();
  }, { signal });

  exportSafeBackupBtn.addEventListener('click', () => {
    const safeCfg = sanitizeSettingsForExport(settings);
    triggerJsonDownload(doc, win, 'user-persona-studio-config-backup.json', safeCfg);
    setStatus('已导出脱敏配置备份');
  }, { signal });

  // ==========================================================================
  // Unified PointerEvent Drag & SE Resize
  // ==========================================================================

  let dragSession = null;
  topbarEl.addEventListener('pointerdown', (ev) => {
    if (ev.button !== undefined && ev.button !== 0) return;
    if (ev.target?.closest?.(INTERACTIVE_DRAG_IGNORE)) return;
    const vw = Number(win?.innerWidth || 1280);
    if (vw <= 640 && !state.miniMode && !modalEl.classList.contains('is-floating')) return;

    popoverEl.hidden = true;
    closeFloatingMenu();

    const r = modalEl.getBoundingClientRect();
    dragSession = {
      pointerId: ev.pointerId,
      startX: ev.clientX,
      startY: ev.clientY,
      origLeft: r.left,
      origTop: r.top,
      width: r.width,
      height: r.height,
      moved: false,
    };
    try {
      topbarEl.setPointerCapture?.(ev.pointerId);
    } catch {
      // ignore mock without pointer capture
    }
  }, { signal });

  topbarEl.addEventListener('pointermove', (ev) => {
    if (!dragSession || ev.pointerId !== dragSession.pointerId) return;
    const dx = ev.clientX - dragSession.startX;
    const dy = ev.clientY - dragSession.startY;
    if (!dragSession.moved && Math.hypot(dx, dy) < 3) return;
    dragSession.moved = true;
    modalEl.classList.add('is-dragging');
    const pos = computeDraggedModalPosition({
      origLeft: dragSession.origLeft,
      origTop: dragSession.origTop,
      dx,
      dy,
      width: dragSession.width,
      height: dragSession.height,
      viewportWidth: win?.innerWidth || 1280,
      viewportHeight: win?.innerHeight || 800,
    });
    applyRectToModal({
      left: pos.left,
      top: pos.top,
      width: dragSession.width,
      height: dragSession.height,
    });
  }, { signal });

  const endDrag = (ev) => {
    if (!dragSession || ev.pointerId !== dragSession.pointerId) return;
    const wasMoved = dragSession.moved;
    try {
      topbarEl.releasePointerCapture?.(ev.pointerId);
    } catch {
      // ignore
    }
    dragSession = null;
    modalEl.classList.remove('is-dragging');
    if (wasMoved && !state.miniMode) {
      const r = modalEl.getBoundingClientRect();
      settings.ui.geometry = {
        x: Math.round(r.left),
        y: Math.round(r.top),
        width: Math.round(r.width),
        height: Math.round(r.height),
      };
      persistSettings();
    }
  };
  topbarEl.addEventListener('pointerup', endDrag, { signal });
  topbarEl.addEventListener('pointercancel', endDrag, { signal });

  let resizeSession = null;
  resizeHandleEl.addEventListener('pointerdown', (ev) => {
    if (ev.button !== undefined && ev.button !== 0) return;
    ev.preventDefault();
    ev.stopPropagation();
    popoverEl.hidden = true;
    closeFloatingMenu();
    const r = modalEl.getBoundingClientRect();
    resizeSession = {
      pointerId: ev.pointerId,
      startX: ev.clientX,
      startY: ev.clientY,
      origLeft: r.left,
      origTop: r.top,
      origWidth: r.width,
      origHeight: r.height,
    };
    modalEl.classList.add('is-resizing');
    try {
      resizeHandleEl.setPointerCapture?.(ev.pointerId);
    } catch {
      // ignore
    }
  }, { signal });

  resizeHandleEl.addEventListener('pointermove', (ev) => {
    if (!resizeSession || ev.pointerId !== resizeSession.pointerId) return;
    const nextRect = computeResizedModalRect({
      origLeft: resizeSession.origLeft,
      origTop: resizeSession.origTop,
      origWidth: resizeSession.origWidth,
      origHeight: resizeSession.origHeight,
      dx: ev.clientX - resizeSession.startX,
      dy: ev.clientY - resizeSession.startY,
      handle: 'se',
      viewportWidth: win?.innerWidth || 1280,
      viewportHeight: win?.innerHeight || 800,
    });
    applyRectToModal(nextRect);
  }, { signal });

  const endResize = (ev) => {
    if (!resizeSession || ev.pointerId !== resizeSession.pointerId) return;
    try {
      resizeHandleEl.releasePointerCapture?.(ev.pointerId);
    } catch {
      // ignore
    }
    resizeSession = null;
    modalEl.classList.remove('is-resizing');
    if (!state.miniMode) {
      const r = modalEl.getBoundingClientRect();
      settings.ui.geometry = {
        x: Math.round(r.left),
        y: Math.round(r.top),
        width: Math.round(r.width),
        height: Math.round(r.height),
      };
      persistSettings();
    }
  };
  resizeHandleEl.addEventListener('pointerup', endResize, { signal });
  resizeHandleEl.addEventListener('pointercancel', endResize, { signal });

  // Minimized pill restore
  pillEl.addEventListener('click', () => restore(), { signal });

  // Close popover / floating menu when clicking inside modal outside them
  modalEl.addEventListener('click', (ev) => {
    const t = ev.target;
    if (!popoverEl.hidden && !popoverEl.contains(t) && t !== popoverBtn && !popoverBtn.contains(t)) {
      popoverEl.hidden = true;
    }
    if (!floatingMenuEl.hidden && !floatingMenuEl.contains(t) && !t?.closest?.('.ups-more-btn')) {
      closeFloatingMenu();
    }
  }, { signal });

  // Viewport resize clamping
  if (win && typeof win.addEventListener === 'function') {
    win.addEventListener('resize', () => {
      if (!state.isOpen) return;
      popoverEl.hidden = true;
      closeFloatingMenu();
      const vw = Number(win.innerWidth || 1280);
      const vh = Number(win.innerHeight || 800);
      if (state.minimized) {
        const pos = computeRestorePillPosition({
          pillWidth: pillEl.offsetWidth || 176,
          pillHeight: pillEl.offsetHeight || 36,
          viewportWidth: vw,
          viewportHeight: vh,
        });
        pillEl.style.left = `${pos.left}px`;
        pillEl.style.top = `${pos.top}px`;
        return;
      }
      if (state.miniMode) {
        applyRectToModal(computeMiniWindowRect({ viewportWidth: vw, viewportHeight: vh }));
        return;
      }
      if (vw <= 640) {
        clearFloatingRectOnModal();
      } else if (modalEl.classList.contains('is-floating')) {
        const r = modalEl.getBoundingClientRect();
        applyRectToModal(
          clampModalRect({
            left: r.left,
            top: r.top,
            width: r.width,
            height: r.height,
            viewportWidth: vw,
            viewportHeight: vh,
          })
        );
      }
    }, { signal });
  }

  // ==========================================================================
  // Public Lifecycle API
  // ==========================================================================

  function open() {
    applyTheme();
    updateSchemeSelects();
    syncDraftRelatedViews();
    state.isOpen = true;
    backdropEl.hidden = false;
    if (state.minimized) {
      restore();
    } else {
      pillEl.hidden = true;
      backdropEl.classList.remove('is-minimized');
      backdropEl.removeAttribute('aria-hidden');
      const vw = Number(win?.innerWidth || 1280);
      const vh = Number(win?.innerHeight || 800);
      if (state.miniMode) {
        modalEl.classList.add('is-mini');
        miniBtn.classList.add('is-active');
        miniBtn.textContent = '还原';
        applyRectToModal(computeMiniWindowRect({ viewportWidth: vw, viewportHeight: vh }));
      } else if (vw <= 640) {
        modalEl.classList.remove('is-mini');
        miniBtn.classList.remove('is-active');
        miniBtn.textContent = '小窗';
        clearFloatingRectOnModal();
      } else if (settings.ui.geometry?.x !== null && settings.ui.geometry?.y !== null) {
        modalEl.classList.remove('is-mini');
        miniBtn.classList.remove('is-active');
        miniBtn.textContent = '小窗';
        applyRectToModal(
          clampModalRect({
            left: settings.ui.geometry.x,
            top: settings.ui.geometry.y,
            width: settings.ui.geometry.width,
            height: settings.ui.geometry.height,
            viewportWidth: vw,
            viewportHeight: vh,
          })
        );
      } else {
        modalEl.classList.remove('is-mini');
        miniBtn.classList.remove('is-active');
        miniBtn.textContent = '小窗';
        clearFloatingRectOnModal();
      }
    }

    // Explicitly avoid .focus() on mobile/coarse-pointer devices
    if (canAutoFocusDesktop(win)) {
      // No forced input focus needed; keep focus safe inside dialog if appropriate
    }

    refreshContext();
    options.onOpenChange?.(true);
  }

  function close() {
    state.isOpen = false;
    state.minimized = false;
    popoverEl.hidden = true;
    closeFloatingMenu();
    closeSubmodal();
    backdropEl.classList.remove('is-minimized');
    backdropEl.removeAttribute('aria-hidden');
    backdropEl.hidden = true;
    pillEl.hidden = true;
    options.onOpenChange?.(false);
    options.onClose?.();
  }

  function toggle() {
    if (state.isOpen && !state.minimized) close();
    else if (state.isOpen && state.minimized) restore();
    else open();
  }

  function minimize() {
    if (!state.isOpen) return;
    state.savedBodyScrollTop = bodyEl.scrollTop || 0;
    state.minimized = true;
    popoverEl.hidden = true;
    closeFloatingMenu();
    backdropEl.classList.add('is-minimized');
    backdropEl.setAttribute('aria-hidden', 'true');
    pillEl.hidden = false;
    const vw = Number(win?.innerWidth || 1280);
    const vh = Number(win?.innerHeight || 800);
    const pos = computeRestorePillPosition({
      pillWidth: pillEl.offsetWidth || 176,
      pillHeight: pillEl.offsetHeight || 36,
      viewportWidth: vw,
      viewportHeight: vh,
    });
    pillEl.style.left = `${pos.left}px`;
    pillEl.style.top = `${pos.top}px`;
  }

  function restore() {
    state.minimized = false;
    backdropEl.hidden = false;
    backdropEl.classList.remove('is-minimized');
    backdropEl.removeAttribute('aria-hidden');
    pillEl.hidden = true;
    const vw = Number(win?.innerWidth || 1280);
    const vh = Number(win?.innerHeight || 800);
    if (state.miniMode) {
      applyRectToModal(computeMiniWindowRect({ viewportWidth: vw, viewportHeight: vh }));
    } else if (vw <= 640) {
      clearFloatingRectOnModal();
    } else if (modalEl.classList.contains('is-floating')) {
      const r = modalEl.getBoundingClientRect();
      const hasRect = r && Number.isFinite(r.width) && r.width > 0 && Number.isFinite(r.height) && r.height > 0;
      const geo = settings.ui?.geometry;
      applyRectToModal(
        clampModalRect({
          left: hasRect ? r.left : geo?.x,
          top: hasRect ? r.top : geo?.y,
          width: hasRect ? r.width : geo?.width,
          height: hasRect ? r.height : geo?.height,
          viewportWidth: vw,
          viewportHeight: vh,
        })
      );
    }
    bodyEl.scrollTop = state.savedBodyScrollTop || 0;
  }

  function toggleMini() {
    popoverEl.hidden = true;
    closeFloatingMenu();
    const vw = Number(win?.innerWidth || 1280);
    const vh = Number(win?.innerHeight || 800);
    if (!state.miniMode) {
      if (modalEl.classList.contains('is-floating')) {
        const r = modalEl.getBoundingClientRect();
        state.normalRect = { left: r.left, top: r.top, width: r.width, height: r.height };
      } else {
        state.normalRect = null;
      }
      state.miniMode = true;
      settings.ui.miniMode = true;
      modalEl.classList.add('is-mini');
      miniBtn.classList.add('is-active');
      miniBtn.textContent = '还原';
      applyRectToModal(computeMiniWindowRect({ viewportWidth: vw, viewportHeight: vh }));
    } else {
      state.miniMode = false;
      settings.ui.miniMode = false;
      modalEl.classList.remove('is-mini');
      miniBtn.classList.remove('is-active');
      miniBtn.textContent = '小窗';
      if (vw > 640 && state.normalRect) {
        applyRectToModal(clampModalRect({ ...state.normalRect, viewportWidth: vw, viewportHeight: vh }));
      } else {
        clearFloatingRectOnModal();
      }
    }
    persistSettings();
  }

  function setSettings(nextSettings) {
    settings = createDefaultSettings(nextSettings);
    state.miniMode = Boolean(settings.ui?.miniMode);
    miniBtn.classList.toggle('is-active', state.miniMode);
    miniBtn.textContent = state.miniMode ? '还原' : '小窗';
    modalEl.classList.toggle('is-mini', state.miniMode);
    paletteSelect.value = settings.palette;
    applyTheme();
    updateSchemeSelects();
    if (state.activeTab === 'presets') renderStackTab();
    if (state.activeTab === 'taste') renderTasteTab();
    if (state.activeTab === 'settings') renderSettingsTab();
    if (state.isOpen && !state.minimized) {
      const vw = Number(win?.innerWidth || 1280);
      const vh = Number(win?.innerHeight || 800);
      if (state.miniMode) {
        applyRectToModal(computeMiniWindowRect({ viewportWidth: vw, viewportHeight: vh }));
      } else if (vw <= 640) {
        clearFloatingRectOnModal();
      } else if (settings.ui.geometry?.x !== null && settings.ui.geometry?.y !== null) {
        applyRectToModal(
          clampModalRect({
            left: settings.ui.geometry.x,
            top: settings.ui.geometry.y,
            width: settings.ui.geometry.width,
            height: settings.ui.geometry.height,
            viewportWidth: vw,
            viewportHeight: vh,
          })
        );
      } else {
        clearFloatingRectOnModal();
      }
    }
  }

  function getState() {
    return {
      isOpen: state.isOpen,
      minimized: state.minimized,
      miniMode: state.miniMode,
      activeTab: state.activeTab,
      mode: state.mode,
      settings,
      draft: draftTextarea.value,
    };
  }

  function destroy() {
    state.isSaving = false;
    state.genAbort?.abort();
    state.fetchModelsAbort?.abort();
    state.fetchModelsAbort = null;
    state.testConnAbort?.abort();
    state.testConnAbort = null;
    lifecycleAc.abort();
    host.remove();
  }

  // Initial sync
  applyTheme();
  updateSchemeSelects();
  renderStackTab();
  renderTasteTab();
  renderSettingsTab();
  syncUndoRedoButtons();
  syncDraftRelatedViews();

  return {
    host,
    shadow,
    open,
    close,
    toggle,
    minimize,
    restore,
    toggleMini,
    switchTab,
    setMode,
    setSettings,
    refreshContext,
    getState,
    destroy,
  };
}

export const mountStudioUI = createStudioUI;
