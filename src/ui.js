import {
  CORE_SECTION_HEADER,
  SHELL_SECTION_HEADER,
  WORD_COUNT_PRESETS,
  SPOTLIGHT_MODES,
  BACKSTORY_MODES,
  VIBE_ANCHOR_EXAMPLES,
  LIKE_REASON_PRESETS,
  DISLIKE_REASON_PRESETS,
  BUILTIN_BANNED_CATEGORIES,
  DEFAULT_BANNED_PHRASES,
  QUALITATIVE_LABEL_PATTERNS,
  DEFAULT_PREFILL,
  DEFAULT_TRIGGER,
  createDefaultSettings,
  sanitizeSettingsForExport,
  isBuiltinSchemeModified,
  resetBuiltinScheme,
  toggleFavoriteScheme,
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
  exportDraftStripRegexScript,
  stripDraftAuditBlocks,
  appendAntiParrotClause,
  replaceEmDashes,
  estimateTokens,
  countReadableChars,
  computeLengthBudget,
  applyTargetCharsToScheme,
  normalizeFlatLayout,
  lintPersonaText,
  extractPersonaPoints,
  splitDualLayerOutput,
  parsePersonaSections,
  computeLineDiff,
  mergeSectionUpdate,
  extractTasteCandidates,
  mergeTasteEntries,
  buildTasteSummaryMessages,
  parseTasteSummaryOutput,
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
const INTERACTIVE_DRAG_IGNORE =
  'button, select, input, textarea, a, label, [role="button"], [role="switch"], option';
const RESIZE_DIRECTIONS = ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'];

// ============================================================================
// Pure Geometry & Draft History Helpers (Node-testable)
// ============================================================================

export function clampModalSize({
  width,
  height,
  viewportWidth,
  viewportHeight,
  allowFullViewport = false,
} = {}) {
  const vw = Math.max(1, Number(viewportWidth) || 1280);
  const vh = Math.max(1, Number(viewportHeight) || 800);
  const maxWidth = allowFullViewport ? vw : Math.max(1, Math.floor(vw * 0.96));
  const maxHeight = allowFullViewport ? vh : Math.max(1, Math.floor(vh * 0.92));
  const minWidth = Math.min(vw <= 640 ? Math.min(310, Math.max(1, vw - 16)) : 320, maxWidth);
  const minHeight = Math.min(vw <= 640 ? 240 : 280, maxHeight);
  const hasWidth =
    width !== null &&
    width !== undefined &&
    String(width).trim() !== '' &&
    typeof width !== 'boolean' &&
    Number.isFinite(Number(width));
  const hasHeight =
    height !== null &&
    height !== undefined &&
    String(height).trim() !== '' &&
    typeof height !== 'boolean' &&
    Number.isFinite(Number(height));
  const rawW = hasWidth ? Number(width) : 1080;
  const rawH = hasHeight ? Number(height) : 700;
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
  allowFullViewport = false,
} = {}) {
  const vw = Math.max(1, Number(viewportWidth) || 1280);
  const vh = Math.max(1, Number(viewportHeight) || 800);
  const sized = clampModalSize({
    width,
    height,
    viewportWidth: vw,
    viewportHeight: vh,
    allowFullViewport,
  });
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
  const vw = Math.max(1, Number(viewportWidth) || 1280);
  const vh = Math.max(1, Number(viewportHeight) || 800);
  const w = Math.max(1, Math.min(vw, Math.round(Number(width) || 820)));
  const h = Math.max(1, Math.min(vh, Math.round(Number(height) || 620)));
  const marginX = w > vw - 16 ? 0 : 8;
  const marginY = h > vh - 16 ? 0 : 8;
  const maxLeft = Math.max(marginX, vw - w - marginX);
  const maxTop = Math.max(marginY, vh - h - marginY);
  const rawLeft = (Number(origLeft) || 0) + (Number(dx) || 0);
  const rawTop = (Number(origTop) || 0) + (Number(dy) || 0);
  return {
    left: Math.round(Math.max(marginX, Math.min(maxLeft, rawLeft))),
    top: Math.round(Math.max(marginY, Math.min(maxTop, rawTop))),
  };
}

// Explicitly locks top/left when dragging right/bottom/bottom-right and allows full 100dvh height!
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
  const minW = Math.min(vw <= 640 ? Math.min(310, Math.max(1, vw - 16)) : 320, vw);
  const minH = Math.min(vw <= 640 ? 240 : 280, vh);

  const startLeft = Math.max(0, Math.min(vw - minW, Math.round(Number(origLeft) || 0)));
  const startTop = Math.max(0, Math.min(vh - minH, Math.round(Number(origTop) || 0)));
  const startW = Math.max(minW, Math.min(vw - startLeft, Math.round(Number(origWidth) || 820)));
  const startH = Math.max(minH, Math.min(vh - startTop, Math.round(Number(origHeight) || 620)));
  const rightEdge = startLeft + startW;
  const bottomEdge = startTop + startH;
  const dX = Number(dx) || 0;
  const dY = Number(dy) || 0;

  let nextLeft = startLeft;
  let nextTop = startTop;
  let nextWidth = startW;
  let nextHeight = startH;

  if (handle.includes('e')) {
    nextWidth = Math.max(minW, Math.min(vw - startLeft, Math.round(startW + dX)));
  }
  if (handle.includes('s')) {
    nextHeight = Math.max(minH, Math.min(vh - startTop, Math.round(startH + dY)));
  }
  if (handle.includes('w')) {
    nextWidth = Math.max(minW, Math.min(rightEdge, Math.round(startW - dX)));
    nextLeft = rightEdge - nextWidth;
  }
  if (handle.includes('n')) {
    nextHeight = Math.max(minH, Math.min(bottomEdge, Math.round(startH - dY)));
    nextTop = bottomEdge - nextHeight;
  }

  return {
    left: Math.round(nextLeft),
    top: Math.round(nextTop),
    width: Math.round(nextWidth),
    height: Math.round(nextHeight),
  };
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
    } else if (
      key === 'disabled' ||
      key === 'checked' ||
      key === 'hidden' ||
      key === 'readOnly' ||
      key === 'selected' ||
      key === 'open' ||
      key === 'draggable'
    ) {
      node[key] = Boolean(val);
      if (key === 'hidden' && val) node.setAttribute('hidden', '');
      if (key === 'open' && val) node.setAttribute('open', '');
      if (key === 'draggable') node.setAttribute('draggable', String(Boolean(val)));
    } else if (
      key === 'type' ||
      key === 'value' ||
      key === 'placeholder' ||
      key === 'title' ||
      key === 'id' ||
      key === 'rows' ||
      key === 'autocomplete'
    ) {
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

// Mandatory Gate 10: zero auto .focus() when <= 680px or pointer: coarse
function canAutoFocusDesktop(win) {
  const w = Number(win?.innerWidth || 0);
  const coarse = Boolean(win?.matchMedia?.('(pointer: coarse)')?.matches);
  return w > 680 && !coarse;
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

function flashButtonFeedback(btn, feedbackText, durationMs = 1200) {
  if (!btn) return;
  if (!btn._upsBaseText) {
    btn._upsBaseText = btn.textContent || '';
  }
  if (btn._upsFlashTimer) {
    clearTimeout(btn._upsFlashTimer);
    btn._upsFlashTimer = null;
  }
  btn.textContent = feedbackText;
  btn._upsFlashTimer = setTimeout(() => {
    btn._upsFlashTimer = null;
    if (!btn.disabled && btn._upsBaseText) {
      btn.textContent = btn._upsBaseText;
    }
  }, durationMs);
  btn._upsFlashTimer?.unref?.();
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
    const timer = setTimeout(() => {
      try {
        urlApi.revokeObjectURL(url);
      } catch {
        // ignore
      }
    }, 1000);
    timer?.unref?.();
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
    activeTab: settings.ui.activeTab || 'studio',
    mode: settings.ui.mode === 'B' ? 'B' : 'A',
    lastCreateSchemeId:
      settings.activeSchemeId === 'persona_refactor' ? 'longform_coact' : settings.activeSchemeId,
    narrowPane: 'both',
    subMode: settings.ui.subMode || 'de_label_reformat',
    spotlightMode: settings.ui.spotlightMode || 'balanced',
    backstoryMode: settings.ui.backstoryMode || 'light_vibe',
    injectChar: settings.ui.injectChar !== false,
    dualLayer: Boolean(settings.ui.dualLayer),
    draftAudit: settings.ui.draftAudit !== false,
    antiParrot: settings.ui.antiParrot !== false,
    visibilityTags: Boolean(settings.ui.visibilityTags),
    isGenerating: false,
    isSaving: false,
    isDistillingTaste: false,
    genAbort: null,
    distillAbort: null,
    fetchModelsAbort: null,
    testConnAbort: null,
    toastTimer: null,
    baselineDraft: '',
    tasteBaselineDraft: '',
    lastDraftLog: '',
    lastCandidates: { bannedCandidates: [], anchorCandidates: [] },
    extractedPoints: [],
    selectedPointIds: new Set(),
    draftSelection: null,
    pinSelectionDrawer: false,
    showCustomReasonRow: false,
    draggingEntryId: '',
    justAddedEntryId: '',
    justAddedTasteId: '',
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
    hasUserPlacedWindow: Boolean(options.initialSettings?.ui?.geometry),
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
    className: 'ups-modal',
    attrs: {
      'data-ups-window': 'true',
      role: 'dialog',
      'aria-modal': 'false',
      'aria-label': '客制化成长型 User 人设工坊',
    },
  });

  // Prominent Top Toast Banner (solves silent/unnoticeable feedback across the plugin!)
  const toastTextEl = createEl(doc, 'span', { text: '' });
  const toastEl = createEl(
    doc,
    'div',
    {
      className: 'ups-toast',
      hidden: true,
      title: '点击关闭提示',
      attrs: { 'data-ups-toast': 'true', role: 'status', 'aria-live': 'polite' },
    },
    [toastTextEl]
  );
  toastEl.addEventListener('click', () => {
    toastEl.hidden = true;
  }, { signal });

  // Topbar (No redundant 小窗 button; clean sync + minimize + close)
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

  const syncHostBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-icon-btn',
    text: '↻ 刷新',
    title: '重新读取酒馆当前人设与角色卡状态',
    attrs: { 'data-ups-sync-host': 'true', 'aria-label': '同步酒馆状态' },
  });

  const minimizeBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-icon-btn',
    text: '—',
    title: '最小化为挂起胶囊',
    attrs: { 'data-ups-minimize': 'true', 'aria-label': '最小化' },
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
        syncHostBtn,
        minimizeBtn,
        closeBtn,
      ]),
    ]
  );

  // Constant 4-Tab Bar
  const TAB_DEFS = [
    { id: 'studio', label: '工坊主页' },
    { id: 'presets', label: '生成规则' },
    { id: 'taste', label: '偏好词库' },
    { id: 'settings', label: '接口与设置' },
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
    className: `ups-body${state.activeTab === 'studio' ? ' is-studio-tab' : ''}`,
    attrs: { 'data-ups-body': 'true' },
  });

  // Unified Constant Footer (eliminates duplicate save card in right pane!)
  const statusEl = createEl(doc, 'span', {
    className: 'ups-footer-status',
    text: '就绪',
    attrs: { 'data-ups-status': 'true', 'data-tone': 'muted' },
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
  const saveNameInput = createEl(doc, 'input', {
    type: 'text',
    className: 'ups-input ups-footer-name-input',
    placeholder: '人设名称（留空用当前名）',
    attrs: { 'data-ups-save-name': 'true', 'aria-label': '保存人设名称' },
  });
  const saveOverwriteBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn',
    text: '覆盖当前人设',
    title: '覆盖保存到酒馆当前正在使用的 User 人设',
    attrs: { 'data-ups-save-overwrite': 'true', 'data-ups-footer-save': 'true' },
  });
  const saveNewBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn ups-btn-primary',
    text: '另存为新人设',
    title: '在酒馆新建一个独立 User 人设并切换过去',
    attrs: { 'data-ups-save-new': 'true' },
  });

  const footerEl = createEl(
    doc,
    'footer',
    { className: 'ups-footer', attrs: { 'data-ups-footer': 'true' } },
    [
      createEl(doc, 'div', { className: 'ups-footer-left' }, [statusEl]),
      createEl(doc, 'div', { className: 'ups-footer-actions' }, [
        undoBtn,
        redoBtn,
        copyBtn,
        saveNameInput,
        saveOverwriteBtn,
        saveNewBtn,
      ]),
    ]
  );

  // 8 Invisible Edge + Corner Resize Hit-Zones (Zero visible corner badge/icon!)
  const resizeZones = RESIZE_DIRECTIONS.map((dir) =>
    createEl(doc, 'div', {
      className: `ups-rz ups-rz-${dir}`,
      attrs: {
        'data-ups-resize-dir': dir,
        ...(dir === 'se' ? { 'data-ups-resize': 'true' } : {}),
        'aria-hidden': 'true',
      },
    })
  );

  modalEl.appendChild(topbarEl);
  modalEl.appendChild(tabsBarEl);
  modalEl.appendChild(toastEl);
  modalEl.appendChild(bodyEl);
  modalEl.appendChild(footerEl);
  for (const rz of resizeZones) modalEl.appendChild(rz);
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

  // Context Options Popover (indices [0]=injectChar, [1]=dualLayer preserved!)
  const injectCharCheckbox = createEl(doc, 'input', { type: 'checkbox', checked: state.injectChar });
  const dualLayerCheckbox = createEl(doc, 'input', { type: 'checkbox', checked: state.dualLayer });
  const draftAuditCheckbox = createEl(doc, 'input', { type: 'checkbox', checked: state.draftAudit });
  const antiParrotCheckbox = createEl(doc, 'input', { type: 'checkbox', checked: state.antiParrot });
  const visibilityTagsCheckbox = createEl(doc, 'input', { type: 'checkbox', checked: state.visibilityTags });
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
      createEl(doc, 'div', { className: 'ups-mod-title', text: '生成附加选项' }),
      createEl(doc, 'label', { className: 'ups-check-row' }, [
        injectCharCheckbox,
        createEl(doc, 'span', { text: '结合当前角色卡公开背景生成' }),
      ]),
      charContextHint,
      createEl(doc, 'label', { className: 'ups-check-row' }, [
        dualLayerCheckbox,
        createEl(doc, 'span', { text: '长设定自动拆出世界书（省常驻字数）' }),
      ]),
      createEl(doc, 'label', { className: 'ups-check-row' }, [
        draftAuditCheckbox,
        createEl(doc, 'span', { text: '启用构思自检草稿（先排雷防打卡再出稿）' }),
      ]),
      createEl(doc, 'label', { className: 'ups-check-row' }, [
        antiParrotCheckbox,
        createEl(doc, 'span', { text: '含“例如/比如”示例时自动附防照抄说明' }),
      ]),
      createEl(doc, 'label', { className: 'ups-check-row' }, [
        visibilityTagsCheckbox,
        createEl(doc, 'span', { text: '标注公开/私密标签（仅悬疑或马甲局需开）' }),
      ]),
    ]
  );

  // Anchored floating menu for compact row actions
  const floatingMenuEl = createEl(doc, 'div', {
    className: 'ups-floating-menu ups-theme-root',
    hidden: true,
    attrs: { 'data-ups-floating-menu': 'true' },
  });

  // Non-Blocking Draggable Auxiliary Floating Card (Gate 2: never locks underlying scroll!)
  const submodalTitleEl = createEl(doc, 'span', { text: '' });
  const submodalCloseBtn = createEl(doc, 'button', { type: 'button', className: 'ups-icon-btn', text: '×' });
  const submodalHeaderEl = createEl(doc, 'div', { className: 'ups-submodal-header' }, [
    submodalTitleEl,
    submodalCloseBtn,
  ]);
  const submodalBodyEl = createEl(doc, 'div', { className: 'ups-submodal-body' });
  const submodalFooterEl = createEl(doc, 'div', { className: 'ups-submodal-footer' });
  const submodalCardEl = createEl(doc, 'div', { className: 'ups-submodal-card' }, [
    submodalHeaderEl,
    submodalBodyEl,
    submodalFooterEl,
  ]);
  const submodalMaskEl = createEl(
    doc,
    'div',
    { className: 'ups-submodal-mask ups-theme-root', hidden: true, attrs: { 'data-ups-submodal': 'true' } },
    [submodalCardEl]
  );

  shadow.appendChild(backdropEl);
  shadow.appendChild(pillEl);
  shadow.appendChild(popoverEl);
  shadow.appendChild(floatingMenuEl);
  shadow.appendChild(submodalMaskEl);
  mountTarget.appendChild(host);

  // Stop host .openDrawer collapse on EVERY floating root (bubble phase)
  stopHostDrawerCollapse(host, signal);
  stopHostDrawerCollapse(modalEl, signal);
  stopHostDrawerCollapse(pillEl, signal);
  stopHostDrawerCollapse(popoverEl, signal);
  stopHostDrawerCollapse(floatingMenuEl, signal);
  stopHostDrawerCollapse(submodalCardEl, signal);

  // ==========================================================================
  // Tab 1: 工坊主页 (High-Clarity Two-Column Workbench)
  // ==========================================================================

  const narrowBothBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-seg-btn is-active',
    text: '上下同屏',
    attrs: { 'data-ups-narrow-pane': 'both' },
  });
  const narrowLeftBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-seg-btn',
    text: '只看要求',
    attrs: { 'data-ups-narrow-pane': 'left' },
  });
  const narrowRightBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-seg-btn',
    text: '只看结果',
    attrs: { 'data-ups-narrow-pane': 'right' },
  });
  const narrowNavEl = createEl(
    doc,
    'div',
    { className: 'ups-narrow-nav', attrs: { 'data-ups-narrow-nav': 'true' } },
    [
      createEl(doc, 'span', { className: 'ups-muted', text: '小屏视图' }),
      createEl(doc, 'div', { className: 'ups-segmented' }, [narrowBothBtn, narrowLeftBtn, narrowRightBtn]),
    ]
  );

  const modeABtn = createEl(doc, 'button', {
    type: 'button',
    className: `ups-seg-btn${state.mode === 'A' ? ' is-active' : ''}`,
    text: '新建人设',
    attrs: { 'data-ups-mode': 'A' },
  });
  const modeBBtn = createEl(doc, 'button', {
    type: 'button',
    className: `ups-seg-btn${state.mode === 'B' ? ' is-active' : ''}`,
    text: '改写旧人设',
    attrs: { 'data-ups-mode': 'B' },
  });
  const schemeSelect = createEl(doc, 'select', {
    className: 'ups-select',
    attrs: { 'data-ups-scheme': 'true', 'aria-label': '预设方案' },
  });
  const wordCountSelect = createEl(
    doc,
    'select',
    {
      className: 'ups-select',
      attrs: { 'data-ups-word-count': 'true', 'aria-label': '目标字数' },
    },
    WORD_COUNT_PRESETS.map((p) => createEl(doc, 'option', { value: p.id, text: p.label }))
  );
  const customCharsInput = createEl(doc, 'input', {
    type: 'number',
    className: 'ups-input',
    min: '200',
    max: '12000',
    step: '100',
    hidden: true,
    placeholder: '输入目标汉字数（如 1200）',
    attrs: { 'data-ups-custom-chars': 'true', 'aria-label': '自定义目标字数' },
  });
  const spotlightSelect = createEl(
    doc,
    'select',
    {
      className: 'ups-select',
      attrs: { 'data-ups-spotlight': 'true', 'aria-label': '职业与暗线伏笔戏份' },
    },
    SPOTLIGHT_MODES.map((m) => createEl(doc, 'option', { value: m.id, text: m.label }))
  );
  spotlightSelect.value = state.spotlightMode;

  const backstorySelect = createEl(
    doc,
    'select',
    {
      className: 'ups-select',
      attrs: { 'data-ups-backstory': 'true', 'aria-label': '过往经历塑造方式' },
    },
    BACKSTORY_MODES.map((m) => createEl(doc, 'option', { value: m.id, text: m.label }))
  );
  backstorySelect.value = state.backstoryMode;

  const popoverBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-ghost',
    text: '附加选项',
    attrs: { 'data-ups-popover-btn': 'true' },
  });

  // Mode A inputs
  const inspirationInput = createEl(doc, 'textarea', {
    className: 'ups-textarea',
    rows: 4,
    placeholder:
      '写一两句你想演的人设、关系或暗线铺垫（如：恋爱日常，表面是普通插画师实为豪门抱错的女儿；支持直接写“冷脸萌”“嘴硬心软”等神韵词）……',
    attrs: { 'data-ups-inspiration': 'true' },
  });

  const quickVibeChips = VIBE_ANCHOR_EXAMPLES.slice(0, 8).map((vibe) => {
    const chip = createEl(doc, 'button', {
      type: 'button',
      className: 'ups-btn-sm',
      text: `+ ${vibe}`,
      attrs: { 'data-ups-vibe-chip': vibe },
    });
    chip.addEventListener('click', () => {
      const cur = inspirationInput.value.trim();
      inspirationInput.value = cur ? `${cur}，${vibe}` : vibe;
      flashButtonFeedback(chip, '✓ 已填入', 900);
      setStatus(`已加入神韵锚点词：${vibe}（生成时将保留神韵并展开日常表现）`);
    }, { signal });
    return chip;
  });

  const mustHavesAInput = createEl(doc, 'input', {
    type: 'text',
    className: 'ups-input',
    placeholder: '选填：必带的外貌、习惯、职业或私密伏笔细节',
    attrs: { 'data-ups-must-haves': 'true' },
  });
  const pickFromPersonaABtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-sm',
    text: '从现有人设挑几条沿用',
    attrs: { 'data-ups-pick-points-a': 'true' },
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
    { className: 'ups-card', hidden: state.mode !== 'A', attrs: { 'data-ups-panel-mode': 'A' } },
    [
      createEl(doc, 'div', { className: 'ups-mod-head' }, [
        createEl(doc, 'span', { className: 'ups-mod-title', text: '新建人设构思' }),
        pickFromPersonaABtn,
      ]),
      createEl(doc, 'div', { className: 'ups-field' }, [
        createEl(doc, 'label', { className: 'ups-label', text: '灵感与人物感觉' }),
        inspirationInput,
      ]),
      createEl(doc, 'div', { className: 'ups-chip-group' }, [
        createEl(doc, 'span', { className: 'ups-chip-label', text: '神韵速填：' }),
        ...quickVibeChips,
      ]),
      createEl(doc, 'div', { className: 'ups-field' }, [
        createEl(doc, 'label', { className: 'ups-label', text: '必带细节' }),
        mustHavesAInput,
      ]),
      createEl(doc, 'div', { className: 'ups-btn-row' }, [generateABtn, previewPromptABtn]),
    ]
  );

  // Mode B inputs
  const subModeSelect = createEl(
    doc,
    'select',
    { className: 'ups-select', attrs: { 'data-ups-submode': 'true', 'aria-label': '改写方式' } },
    [
      createEl(doc, 'option', { value: 'de_label_reformat', text: '整理排版并去套话（保留全部原设定与伏笔）' }),
      createEl(doc, 'option', { value: 'core_expand', text: '扩写丰富细节（保留原设定骨架）' }),
      createEl(doc, 'option', { value: 'cross_card_adapt', text: '换卡改背景（保留外貌性格，只改当前身份）' }),
    ]
  );
  subModeSelect.value = state.subMode;

  const loadPersonaBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn',
    text: '载入人设',
    attrs: { 'data-ups-load-persona': 'true' },
  });
  const personaPickerSelect = createEl(doc, 'select', {
    className: 'ups-select',
    style: { flex: '1 1 130px' },
    attrs: { 'aria-label': '选择已有人设' },
  });
  const extractPointsBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-ghost',
    text: '提取可勾选项',
    attrs: { 'data-ups-extract-points': 'true' },
  });
  const existingDraftInput = createEl(doc, 'textarea', {
    className: 'ups-textarea',
    rows: 4,
    placeholder: '点击上方“载入人设”读取酒馆当前人设，或直接粘贴旧人设文本……',
    attrs: { 'data-ups-existing-draft': 'true' },
  });
  const lockedCoreInput = createEl(doc, 'textarea', {
    className: 'ups-textarea',
    rows: 2,
    placeholder: '选填：额外指定绝不改动的原句',
    attrs: { 'data-ups-locked-core': 'true' },
  });
  const mustHavesBInput = createEl(doc, 'input', {
    type: 'text',
    className: 'ups-input',
    placeholder: '选填：本次改写补充要求（如“保留体弱但别让正文天天犯病打卡”）',
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
    { className: 'ups-card', hidden: state.mode !== 'B', attrs: { 'data-ups-panel-mode': 'B' } },
    [
      createEl(doc, 'div', { className: 'ups-mod-head' }, [
        createEl(doc, 'span', { className: 'ups-mod-title', text: '载入与改写旧人设' }),
      ]),
      createEl(doc, 'div', { className: 'ups-row' }, [personaPickerSelect, loadPersonaBtn, extractPointsBtn]),
      createEl(doc, 'div', { className: 'ups-field' }, [
        createEl(doc, 'label', { className: 'ups-label', text: '改写方向' }),
        subModeSelect,
      ]),
      createEl(doc, 'div', { className: 'ups-field' }, [
        createEl(doc, 'label', { className: 'ups-label', text: '旧人设原稿' }),
        existingDraftInput,
      ]),
      createEl(doc, 'div', { className: 'ups-field' }, [
        createEl(doc, 'label', { className: 'ups-label', text: '补充改写要求' }),
        mustHavesBInput,
      ]),
      createEl(doc, 'details', { className: 'ups-advanced-details' }, [
        createEl(doc, 'summary', { text: '手写补充固定保留原句（选填）' }),
        lockedCoreInput,
      ]),
      createEl(doc, 'div', { className: 'ups-btn-row' }, [generateBBtn, previewPromptBBtn]),
    ]
  );

  // Shared Selectable Persona Points Box (2-col clean table rows)
  const pointsCountLabel = createEl(doc, 'span', {
    className: 'ups-mod-title',
    text: '勾选要保留的原人设内容',
  });
  const pointsSelectAllBtn = createEl(doc, 'button', { type: 'button', className: 'ups-btn-sm', text: '全选' });
  const pointsSelectCoreBtn = createEl(doc, 'button', { type: 'button', className: 'ups-btn-sm', text: '只留外貌性格' });
  const pointsClearBtn = createEl(doc, 'button', { type: 'button', className: 'ups-btn-sm', text: '清空' });
  const pointsListEl = createEl(doc, 'div', { className: 'ups-points-list' });
  const extractedPointsBox = createEl(
    doc,
    'div',
    {
      className: 'ups-points-box',
      hidden: true,
      attrs: { 'data-ups-points-box': 'true' },
    },
    [
      createEl(doc, 'div', { className: 'ups-row-between' }, [
        pointsCountLabel,
        createEl(doc, 'div', { className: 'ups-chip-group' }, [
          pointsSelectAllBtn,
          pointsSelectCoreBtn,
          pointsClearBtn,
        ]),
      ]),
      pointsListEl,
    ]
  );

  // Right Pane: Clean Spacious Draft Card
  const tokenBadgeEl = createEl(doc, 'span', { className: 'ups-badge', text: '0 字 · 0 tokens' });
  const lintSummaryBadge = createEl(doc, 'span', { className: 'ups-badge', text: '待检查' });
  const viewDraftLogBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-ghost',
    text: '查看自检草稿',
    hidden: true,
    attrs: { 'data-ups-view-draft-log': 'true' },
  });
  const flattenBtn = createEl(doc, 'button', { type: 'button', className: 'ups-btn-ghost', text: '清理缩进' });
  const sectionSelect = createEl(doc, 'select', {
    className: 'ups-select',
    style: { width: 'auto', maxWidth: '148px' },
    attrs: { 'aria-label': '选择重生成分段' },
  });
  const regenSectionBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-ghost',
    text: '重写本段',
    attrs: { 'data-ups-regen-section': 'true' },
  });
  const draftTextarea = createEl(doc, 'textarea', {
    className: 'ups-textarea ups-draft-editor',
    rows: 12,
    placeholder: '生成的 User 人设会显示在右侧这里，左侧改要求、右侧看成稿，无需上下翻页……',
    attrs: { 'data-ups-draft': 'true' },
  });

  // Slim Collapsible Selection-Driven Preference Bar
  const selectionSnippetEl = createEl(doc, 'span', {
    className: 'ups-selection-snippet',
    text: '拖选上方任意词句，自动展开「喜欢 / 为什么不喜欢」快捷按钮',
    attrs: { 'data-ups-selection-hint': 'true' },
  });
  const pinSelectionBarBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-sm',
    text: '展开标记栏',
    attrs: { 'data-ups-pin-selection-bar': 'true' },
  });
  const deleteSelectedBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-sm',
    text: '从正文删去',
    hidden: true,
    attrs: { 'data-ups-sel-delete': 'true' },
  });
  const clearSelectedBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-sm',
    text: '取消框选',
    hidden: true,
    attrs: { 'data-ups-sel-clear': 'true' },
  });
  const extractTasteBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-sm',
    text: '对比删改记偏好',
    attrs: { 'data-ups-extract-taste': 'true' },
  });

  const likePresetBtns = LIKE_REASON_PRESETS.map((preset) => {
    const btn = createEl(doc, 'button', {
      type: 'button',
      className: 'ups-btn-sm is-like',
      text: preset.label,
      title: preset.reason,
      attrs: { 'data-ups-like-preset': preset.id },
    });
    btn._upsPreset = preset;
    return btn;
  });

  const dislikePresetBtns = DISLIKE_REASON_PRESETS.map((preset) => {
    const btn = createEl(doc, 'button', {
      type: 'button',
      className: 'ups-btn-sm is-dislike',
      text: preset.label,
      title: preset.reason,
      attrs: { 'data-ups-dislike-preset': preset.id },
    });
    btn._upsPreset = preset;
    return btn;
  });

  const toggleCustomReasonBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-sm',
    text: '手写原因…',
    attrs: { 'data-ups-toggle-custom-reason': 'true' },
  });
  const customReasonInput = createEl(doc, 'input', {
    type: 'text',
    className: 'ups-input ups-input-sm',
    style: { flex: '1 1 150px' },
    placeholder: '补充原因，如：语气太端着 / 容易引发每轮打卡',
    attrs: { 'data-ups-custom-reason-input': 'true' },
  });
  const applyCustomDislikeBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-sm is-dislike',
    text: '记入不喜欢',
    attrs: { 'data-ups-apply-custom-dislike': 'true' },
  });
  const applyCustomLikeBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-sm is-like',
    text: '记入喜欢',
    attrs: { 'data-ups-apply-custom-like': 'true' },
  });
  const customReasonRowEl = createEl(
    doc,
    'div',
    { className: 'ups-row', hidden: true, attrs: { 'data-ups-custom-reason-row': 'true' } },
    [customReasonInput, applyCustomDislikeBtn, applyCustomLikeBtn]
  );

  const selectionDrawerInnerEl = createEl(doc, 'div', { className: 'ups-selection-drawer-inner' }, [
    createEl(doc, 'div', { className: 'ups-chip-group' }, [
      createEl(doc, 'span', { className: 'ups-chip-label', text: '喜欢：' }),
      ...likePresetBtns,
    ]),
    createEl(doc, 'div', { className: 'ups-chip-group' }, [
      createEl(doc, 'span', { className: 'ups-chip-label', text: '不喜欢：' }),
      ...dislikePresetBtns,
      toggleCustomReasonBtn,
    ]),
    customReasonRowEl,
  ]);

  const selectionTasteBar = createEl(
    doc,
    'div',
    { className: 'ups-selection-bar', attrs: { 'data-ups-selection-bar': 'true' } },
    [
      createEl(doc, 'div', { className: 'ups-row-between' }, [
        selectionSnippetEl,
        createEl(doc, 'div', { className: 'ups-chip-group' }, [
          deleteSelectedBtn,
          clearSelectedBtn,
          pinSelectionBarBtn,
          extractTasteBtn,
        ]),
      ]),
      createEl(doc, 'div', { className: 'ups-selection-drawer' }, [selectionDrawerInnerEl]),
    ]
  );

  const diffViewEl = createEl(doc, 'div', {
    className: 'ups-diff-box',
    hidden: true,
    attrs: { 'data-ups-diff-view': 'true' },
  });
  const confirmTasteBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn ups-btn-primary',
    text: '确认记入偏好库',
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
      createEl(doc, 'div', { className: 'ups-mod-title', text: '从刚才删改中识别出的个人偏好' }),
      tasteCandidatesListEl,
      createEl(doc, 'div', { className: 'ups-btn-row' }, [confirmTasteBtn]),
    ]
  );

  const lintIssuesListEl = createEl(doc, 'div', { style: { display: 'flex', flexDirection: 'column', gap: '5px' } });

  const wbNameInput = createEl(doc, 'input', {
    type: 'text',
    className: 'ups-input',
    placeholder: '补充世界书名称（留空自动命名）',
  });
  const saveWbBtn = createEl(doc, 'button', { type: 'button', className: 'ups-btn', text: '保存补充世界书' });
  const wbPreviewText = createEl(doc, 'div', { className: 'ups-muted', text: '' });
  const wbBox = createEl(
    doc,
    'div',
    { className: 'ups-card', hidden: true },
    [
      createEl(doc, 'div', { className: 'ups-mod-title', text: '补充世界书条目' }),
      wbPreviewText,
      createEl(doc, 'div', { className: 'ups-row' }, [
        createEl(doc, 'div', { style: { flex: '1 1 160px' } }, [wbNameInput]),
        saveWbBtn,
      ]),
    ]
  );

  const leftPaneEl = createEl(
    doc,
    'div',
    { className: 'ups-pane-left', attrs: { 'data-ups-pane': 'left' } },
    [
      createEl(doc, 'div', { className: 'ups-card' }, [
        createEl(doc, 'div', { className: 'ups-mod-head' }, [
          createEl(doc, 'div', { className: 'ups-segmented' }, [modeABtn, modeBBtn]),
          popoverBtn,
        ]),
        createEl(doc, 'div', { className: 'ups-grid-2' }, [
          createEl(doc, 'div', { className: 'ups-field' }, [
            createEl(doc, 'label', { className: 'ups-label', text: '预设方案' }),
            schemeSelect,
          ]),
          createEl(doc, 'div', { className: 'ups-field' }, [
            createEl(doc, 'label', { className: 'ups-label', text: '目标字数' }),
            wordCountSelect,
            customCharsInput,
          ]),
        ]),
        createEl(doc, 'div', { className: 'ups-grid-2' }, [
          createEl(doc, 'div', { className: 'ups-field' }, [
            createEl(doc, 'label', { className: 'ups-label', text: '过往经历塑造（防套皮）' }),
            backstorySelect,
          ]),
          createEl(doc, 'div', { className: 'ups-field' }, [
            createEl(doc, 'label', { className: 'ups-label', text: '职业/喜好与暗线戏份' }),
            spotlightSelect,
          ]),
        ]),
      ]),
      modeAPanel,
      modeBPanel,
      extractedPointsBox,
    ]
  );

  const rightPaneEl = createEl(
    doc,
    'div',
    { className: 'ups-pane-right', attrs: { 'data-ups-pane': 'right' } },
    [
      createEl(doc, 'div', { className: 'ups-card ups-draft-card' }, [
        createEl(doc, 'div', { className: 'ups-mod-head' }, [
          createEl(doc, 'div', { className: 'ups-row' }, [
            createEl(doc, 'span', { className: 'ups-mod-title', text: '成稿正文' }),
            tokenBadgeEl,
            lintSummaryBadge,
          ]),
          createEl(doc, 'div', { className: 'ups-btn-row' }, [
            viewDraftLogBtn,
            flattenBtn,
            sectionSelect,
            regenSectionBtn,
          ]),
        ]),
        draftTextarea,
        selectionTasteBar,
        lintIssuesListEl,
        tasteCandidatesBox,
        diffViewEl,
      ]),
      wbBox,
    ]
  );

  const studioTabPanel = createEl(
    doc,
    'section',
    { className: 'ups-tab-panel', hidden: state.activeTab !== 'studio', attrs: { 'data-ups-tab-panel': 'studio' } },
    [
      narrowNavEl,
      createEl(doc, 'div', { className: 'ups-workbench' }, [leftPaneEl, rightPaneEl]),
    ]
  );

  // ==========================================================================
  // Tab 2: 生成规则 (Presets, Favorite Pin, Reset, Drag-Reorder Accordion)
  // ==========================================================================

  const stackSchemeSelect = createEl(doc, 'select', {
    className: 'ups-select',
    style: { flex: '1 1 180px' },
    attrs: { 'aria-label': '选择编辑方案' },
  });
  const schemeFavBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-sm ups-fav-btn',
    text: '☆ 置顶',
    title: '置顶该方案并在选择框排在最顶部',
    attrs: { 'data-ups-scheme-fav': 'true' },
  });
  const schemeNameInput = createEl(doc, 'input', {
    type: 'text',
    className: 'ups-input',
    placeholder: '输入方案名称（用于另存或改名）',
  });
  const schemeSaveAsBtn = createEl(doc, 'button', { type: 'button', className: 'ups-btn', text: '另存方案' });
  const schemeRenameBtn = createEl(doc, 'button', { type: 'button', className: 'ups-btn-ghost', text: '重命名' });
  const schemeResetBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-ghost',
    text: '还原默认',
    attrs: { 'data-ups-scheme-reset': 'true' },
  });
  const schemeDeleteBtn = createEl(doc, 'button', { type: 'button', className: 'ups-btn ups-btn-danger', text: '删除方案' });
  const exportPresetBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn ups-btn-primary',
    text: '导出到酒馆预设',
    title: '导出为标准 SillyTavern 预设 JSON，可在酒馆原生预设界面直接使用',
    attrs: { 'data-ups-export-preset': 'true' },
  });
  const exportPresetModalBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-ghost',
    text: '自定义导出',
    attrs: { 'data-ups-export-custom': 'true' },
  });
  const exportDraftRegexBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-ghost',
    text: '导出隐藏草稿正则',
    title: '在酒馆原生预设里开启草稿自检时，导入该正则可自动隐藏草稿自检块',
    attrs: { 'data-ups-export-regex': 'true' },
  });

  const tailModeSelect = createEl(
    doc,
    'select',
    { className: 'ups-select', attrs: { 'aria-label': '末尾消息角色策略' } },
    [
      createEl(doc, 'option', { value: 'auto', text: '自动适配当前模型（推荐）' }),
      createEl(doc, 'option', { value: 'user', text: '固定以用户消息收尾' }),
      createEl(doc, 'option', { value: 'assistant_prefill', text: '固定追加 AI 开头引导' }),
      createEl(doc, 'option', { value: 'prefill_plus_user', text: '开头引导 + 用户消息收尾' }),
    ]
  );
  const prefillInput = createEl(doc, 'textarea', { className: 'ups-textarea', rows: 2, placeholder: '可选：自定义开头引导文本' });
  const triggerInput = createEl(doc, 'input', { type: 'text', className: 'ups-input', placeholder: '可选：自定义收尾触发句' });
  const schemeTempInput = createEl(doc, 'input', { type: 'number', className: 'ups-input', step: '0.05', min: '0', max: '2' });
  const schemeMaxTokensInput = createEl(doc, 'input', { type: 'number', className: 'ups-input', step: '100', min: '256', max: '32768' });

  const stackSearchInput = createEl(doc, 'input', {
    type: 'search',
    className: 'ups-input',
    style: { flex: '1 1 160px' },
    placeholder: '搜索规则标题或内容……',
    attrs: { 'data-ups-stack-search': 'true' },
  });
  const addStackEntryBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn',
    text: '+ 新增条目',
    attrs: { 'data-ups-add-entry': 'true' },
  });
  const stackListEl = createEl(doc, 'div', { className: 'ups-acc-list', attrs: { 'data-ups-acc-list': 'true' } });

  const presetsTabPanel = createEl(
    doc,
    'section',
    { className: 'ups-tab-panel', hidden: state.activeTab !== 'presets', attrs: { 'data-ups-tab-panel': 'presets' } },
    [
      createEl(doc, 'div', { className: 'ups-card' }, [
        createEl(doc, 'div', { className: 'ups-mod-head' }, [
          createEl(doc, 'span', { className: 'ups-mod-title', text: '预设方案管理与原生导出' }),
          createEl(doc, 'div', { className: 'ups-btn-row' }, [
            exportPresetBtn,
            exportPresetModalBtn,
            exportDraftRegexBtn,
          ]),
        ]),
        createEl(doc, 'div', { className: 'ups-row' }, [stackSchemeSelect, schemeFavBtn]),
        createEl(doc, 'div', { className: 'ups-row' }, [
          createEl(doc, 'div', { style: { flex: '1 1 150px' } }, [schemeNameInput]),
          schemeSaveAsBtn,
          schemeRenameBtn,
          schemeResetBtn,
          schemeDeleteBtn,
        ]),
        createEl(doc, 'div', { className: 'ups-grid-2' }, [
          createEl(doc, 'div', { className: 'ups-field' }, [
            createEl(doc, 'label', { className: 'ups-label', text: '采样温度（Temperature）' }),
            schemeTempInput,
          ]),
          createEl(doc, 'div', { className: 'ups-field' }, [
            createEl(doc, 'label', { className: 'ups-label', text: '最大回复上限（Max Tokens）' }),
            schemeMaxTokensInput,
          ]),
        ]),
        createEl(doc, 'details', { className: 'ups-advanced-details' }, [
          createEl(doc, 'summary', { text: '高级收尾兼容微调（默认已按模型自动适配）' }),
          createEl(doc, 'div', { className: 'ups-field' }, [
            createEl(doc, 'label', { className: 'ups-label', text: '收尾适配策略' }),
            tailModeSelect,
          ]),
          createEl(doc, 'div', { className: 'ups-grid-2' }, [
            createEl(doc, 'div', { className: 'ups-field' }, [
              createEl(doc, 'label', { className: 'ups-label', text: '自定义开头引导' }),
              prefillInput,
            ]),
            createEl(doc, 'div', { className: 'ups-field' }, [
              createEl(doc, 'label', { className: 'ups-label', text: '自定义末尾请求句' }),
              triggerInput,
            ]),
          ]),
        ]),
      ]),
      createEl(doc, 'div', { className: 'ups-card' }, [
        createEl(doc, 'div', { className: 'ups-mod-head' }, [
          createEl(doc, 'span', { className: 'ups-mod-title', text: '模块化生成规则条目（支持多开编辑与拖拽调序）' }),
        ]),
        createEl(doc, 'div', { className: 'ups-row' }, [stackSearchInput, addStackEntryBtn]),
        stackListEl,
      ]),
    ]
  );

  // ==========================================================================
  // Tab 3: 偏好词库 (Token-Conscious Banned Send Mode + Bounded Scroll Lists)
  // ==========================================================================

  const useBuiltinBannedBtn = createEl(
    doc,
    'button',
    {
      type: 'button',
      className: 'ups-switch is-on',
      attrs: { role: 'switch', 'aria-checked': 'true', 'aria-label': '启用内置人设避雷词库' },
    },
    [createEl(doc, 'span', { className: 'ups-switch-thumb' })]
  );

  const bannedSendModeSelect = createEl(
    doc,
    'select',
    {
      className: 'ups-select ups-setting-control',
      style: { width: '250px' },
      attrs: { 'data-ups-banned-send-mode': 'true', 'aria-label': '发给 AI 的禁词范围' },
    },
    [
      createEl(doc, 'option', { value: 'smart_compact', text: '精简核心 + 我的禁写（推荐·省Token）' }),
      createEl(doc, 'option', { value: 'personal_only', text: '仅发我标记的禁写（最省Token）' }),
      createEl(doc, 'option', { value: 'full', text: '完整发送启用词包（强纠偏）' }),
    ]
  );

  const dedupTasteBtn = createEl(doc, 'button', { type: 'button', className: 'ups-btn-ghost', text: '去重整理' });
  const aiDistillTasteBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-ghost',
    text: 'AI 归纳提炼（可选）',
    attrs: { 'data-ups-ai-distill': 'true' },
  });

  const builtinCategoriesContainer = createEl(doc, 'div', {
    className: 'ups-lexicon-list',
    attrs: { 'data-ups-builtin-packs': 'true' },
  });
  const builtinDetailsEl = createEl(doc, 'details', { className: 'ups-advanced-details' }, [
    createEl(doc, 'summary', {
      text: `展开查看 / 按类开关内置人设专属避雷词包（${BUILTIN_BANNED_CATEGORIES.length} 类共 ${DEFAULT_BANNED_PHRASES.length} 条，默认折叠不占高度）`,
    }),
    builtinCategoriesContainer,
  ]);

  const tasteSearchInput = createEl(doc, 'input', {
    type: 'search',
    className: 'ups-input',
    placeholder: '搜索我喜欢的细节或禁写词句……',
    attrs: { 'data-ups-taste-search': 'true' },
  });
  const addAnchorInput = createEl(doc, 'input', {
    type: 'text',
    className: 'ups-input',
    placeholder: '添加喜欢的细节偏好，如：做饭好吃但记不住路名',
  });
  const addAnchorBtn = createEl(doc, 'button', { type: 'button', className: 'ups-btn', text: '添加喜好' });
  const addBannedInput = createEl(doc, 'input', {
    type: 'text',
    className: 'ups-input',
    placeholder: '添加不爱看的禁写词句，如：人群中一眼被认出',
  });
  const addBannedBtn = createEl(doc, 'button', { type: 'button', className: 'ups-btn', text: '添加禁写' });
  const tasteListContainer = createEl(doc, 'div', {
    className: 'ups-taste-grid',
    attrs: { 'data-ups-taste-list': 'true' },
  });

  const tasteTabPanel = createEl(
    doc,
    'section',
    { className: 'ups-tab-panel', hidden: state.activeTab !== 'taste', attrs: { 'data-ups-tab-panel': 'taste' } },
    [
      createEl(doc, 'div', { className: 'ups-card' }, [
        createEl(doc, 'div', { className: 'ups-mod-head' }, [
          createEl(doc, 'span', { className: 'ups-mod-title', text: '人设避雷策略与内置词包' }),
          createEl(doc, 'div', { className: 'ups-btn-row' }, [dedupTasteBtn, aiDistillTasteBtn]),
        ]),
        createEl(doc, 'div', { className: 'ups-setting-row' }, [
          createEl(doc, 'div', { className: 'ups-setting-meta' }, [
            createEl(doc, 'div', { className: 'ups-card-title', text: '启用人设专属套话避雷' }),
            createEl(doc, 'div', { className: 'ups-muted', text: '针对玛丽苏赋魅、AI 简历对仗与易打卡微动作' }),
          ]),
          useBuiltinBannedBtn,
        ]),
        createEl(doc, 'div', { className: 'ups-setting-row' }, [
          createEl(doc, 'div', { className: 'ups-setting-meta' }, [
            createEl(doc, 'div', { className: 'ups-card-title', text: '生成时发给 AI 的禁词范围' }),
            createEl(doc, 'div', { className: 'ups-muted', text: '好模型可选“精简”或“仅个人禁写”节省 Token，本地仍全量复查' }),
          ]),
          bannedSendModeSelect,
        ]),
        builtinDetailsEl,
      ]),
      createEl(doc, 'div', { className: 'ups-card' }, [
        createEl(doc, 'div', { className: 'ups-mod-head' }, [
          createEl(doc, 'span', { className: 'ups-mod-title', text: '我的个人喜好与禁写词库（固定高度滚动，不撑高页面）' }),
        ]),
        tasteSearchInput,
        tasteListContainer,
      ]),
    ]
  );

  // ==========================================================================
  // Tab 4: 接口与设置 (Compact Grouped Widescreen Layout)
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
    className: 'ups-btn ups-btn-danger',
    text: '删除',
    attrs: { 'data-ups-profile-delete': 'true' },
  });
  const profileDeleteConfirmBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn ups-btn-danger',
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
      createEl(doc, 'div', { className: 'ups-mod-head' }, [
        createEl(doc, 'span', { className: 'ups-mod-title', text: '自定义 API 配置方案' }),
      ]),
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
          createEl(doc, 'label', { className: 'ups-label', text: 'API Key（仅本地保存）' }),
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
    { className: 'ups-tab-panel', hidden: state.activeTab !== 'settings', attrs: { 'data-ups-tab-panel': 'settings' } },
    [
      createEl(doc, 'div', { className: 'ups-card' }, [
        createEl(doc, 'div', { className: 'ups-mod-head' }, [
          createEl(doc, 'span', { className: 'ups-mod-title', text: 'AI 生成连接方式' }),
        ]),
        createEl(doc, 'div', { className: 'ups-setting-row' }, [
          createEl(doc, 'div', { className: 'ups-setting-meta' }, [
            createEl(doc, 'div', { className: 'ups-card-title', text: '当前接口通道' }),
            createEl(doc, 'div', { className: 'ups-muted', text: '可跟随酒馆当前连接，或配置独立兼容接口' }),
          ]),
          providerSelect,
        ]),
      ]),
      customApiCard,
      createEl(doc, 'div', { className: 'ups-card' }, [
        createEl(doc, 'div', { className: 'ups-mod-head' }, [
          createEl(doc, 'span', { className: 'ups-mod-title', text: '外观与入口设置' }),
        ]),
        createEl(doc, 'div', { className: 'ups-setting-row' }, [
          createEl(doc, 'div', { className: 'ups-setting-meta' }, [
            createEl(doc, 'div', { className: 'ups-label', text: '明暗显示模式' }),
          ]),
          colorModeSelect,
        ]),
        createEl(doc, 'div', { className: 'ups-setting-row' }, [
          createEl(doc, 'div', { className: 'ups-setting-meta' }, [
            createEl(doc, 'div', { className: 'ups-label', text: '人设管理面板快捷按钮' }),
          ]),
          showPersonaBtnSwitch,
        ]),
        createEl(doc, 'div', { className: 'ups-setting-row' }, [
          createEl(doc, 'div', { className: 'ups-setting-meta' }, [
            createEl(doc, 'div', { className: 'ups-label', text: '扩展菜单入口' }),
          ]),
          showWandMenuSwitch,
        ]),
        createEl(doc, 'div', { className: 'ups-setting-row' }, [
          createEl(doc, 'div', { className: 'ups-setting-meta' }, [
            createEl(doc, 'div', { className: 'ups-label', text: '导出安全配置备份' }),
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
  // Internal State, Toast Feedback & Render Helpers
  // ==========================================================================

  function showToast(text, tone = 'info', durationMs = 3000) {
    if (!text) return;
    if (state.toastTimer) {
      clearTimeout(state.toastTimer);
      state.toastTimer = null;
    }
    toastTextEl.textContent = String(text);
    toastEl.setAttribute('data-tone', tone);
    toastEl.hidden = false;
    state.toastTimer = setTimeout(() => {
      state.toastTimer = null;
      toastEl.hidden = true;
    }, durationMs);
    state.toastTimer?.unref?.();
  }

  function setStatus(text, tone = 'muted', opts = {}) {
    state.statusText = String(text || '就绪');
    state.statusTone = tone;
    statusEl.textContent = state.statusText;
    statusEl.setAttribute('data-tone', tone);
    if (opts.toast || tone === 'warn' || tone === 'error') {
      showToast(state.statusText, tone === 'muted' ? 'info' : tone);
    }
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
    const h = Number(heightPx) || modalEl.getBoundingClientRect?.().height || 680;
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
    updateCompactHeightClass(vw <= 640 ? vh : Math.min(700, Math.round(vh * 0.9)));
  }

  function syncUndoRedoButtons() {
    undoBtn.disabled = !draftHistory.canUndo();
    redoBtn.disabled = !draftHistory.canRedo();
  }

  function syncWordCountControls(scheme) {
    if (!scheme) return;
    const targetChars = Number(scheme.targetChars) || 1500;
    const presetHit = WORD_COUNT_PRESETS.find((p) => p.chars > 0 && p.chars === targetChars);
    if (presetHit) {
      wordCountSelect.value = presetHit.id;
      customCharsInput.hidden = true;
      customCharsInput.value = String(targetChars);
    } else {
      wordCountSelect.value = 'custom';
      customCharsInput.hidden = false;
      customCharsInput.value = String(targetChars);
    }
  }

  function formatSchemeOptionText(s) {
    const star = s.favorite ? '★ ' : '';
    const suffix = s.builtin ? '（内置）' : '';
    return `${star}${s.name}${suffix}`;
  }

  function updateSchemeSelects() {
    const schemes = settings.schemes || [];
    const active = getActiveScheme(settings);
    const sorted = [...schemes].sort((a, b) => Number(Boolean(b?.favorite)) - Number(Boolean(a?.favorite)));
    const makeOpts = (sel) => {
      sel.replaceChildren(
        ...sorted.map((s) => createEl(doc, 'option', { value: s.id, text: formatSchemeOptionText(s) }))
      );
      if (active) sel.value = active.id;
    };
    makeOpts(schemeSelect);
    makeOpts(stackSchemeSelect);
    if (active) {
      syncWordCountControls(active);
      tailModeSelect.value = active.tailMode || 'auto';
      prefillInput.value = active.prefillText || '';
      triggerInput.value = active.triggerText || '';
      schemeTempInput.value = String(active.temperature ?? 0.78);
      schemeMaxTokensInput.value = String(active.maxTokens ?? 3300);
      schemeDeleteBtn.disabled = Boolean(active.builtin) || schemes.length <= 1;
      schemeFavBtn.classList.toggle('is-fav', Boolean(active.favorite));
      schemeFavBtn.textContent = active.favorite ? '★ 已置顶' : '☆ 置顶';
      schemeResetBtn.hidden = !active.builtin;
      schemeResetBtn.disabled = !active.builtin || !isBuiltinSchemeModified(active);
    }
  }

  function renderExtractedPoints() {
    const pts = state.extractedPoints || [];
    if (pts.length === 0) {
      extractedPointsBox.hidden = true;
      pointsListEl.replaceChildren();
      return;
    }
    extractedPointsBox.hidden = false;
    const keptCount = pts.filter((p) => state.selectedPointIds.has(p.id)).length;
    pointsCountLabel.textContent = `勾选保留原人设条目（已选 ${keptCount}/${pts.length}）`;

    const rows = pts.map((pt) => {
      const checked = state.selectedPointIds.has(pt.id);
      const cb = createEl(doc, 'input', { type: 'checkbox', checked });
      cb.addEventListener('change', () => {
        if (cb.checked) state.selectedPointIds.add(pt.id);
        else state.selectedPointIds.delete(pt.id);
        const nowKept = pts.filter((p) => state.selectedPointIds.has(p.id)).length;
        pointsCountLabel.textContent = `勾选保留原人设条目（已选 ${nowKept}/${pts.length}）`;
      });
      return createEl(doc, 'label', { className: 'ups-point-item' }, [
        cb,
        createEl(doc, 'span', { className: 'ups-point-cat', text: pt.category }),
        createEl(doc, 'span', { text: pt.text }),
      ]);
    });
    pointsListEl.replaceChildren(...rows);
  }

  function populateExtractedPointsFromText(rawText, { defaultMode = 'smart', scrollToBox = false } = {}) {
    const pts = extractPersonaPoints(rawText);
    state.extractedPoints = pts;
    state.selectedPointIds = new Set();
    for (const pt of pts) {
      if (defaultMode === 'all' || (defaultMode === 'smart' && pt.keepByDefault)) {
        state.selectedPointIds.add(pt.id);
      }
    }
    renderExtractedPoints();
    if (scrollToBox && pts.length > 0) {
      extractedPointsBox.classList.remove('ups-just-added');
      extractedPointsBox.classList.add('ups-just-added');
      extractedPointsBox.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
    }
    return pts;
  }

  function getCombinedLockedPointsText() {
    const checkedLines = (state.extractedPoints || [])
      .filter((pt) => state.selectedPointIds.has(pt.id))
      .map((pt) => `- ${pt.fullText}`);
    const manual = lockedCoreInput.value.trim();
    if (checkedLines.length > 0 && manual) {
      return `${checkedLines.join('\n')}\n${manual}`;
    }
    if (checkedLines.length > 0) {
      return checkedLines.join('\n');
    }
    return manual;
  }

  function setNarrowPane(view) {
    const next = view === 'left' || view === 'right' ? view : 'both';
    state.narrowPane = next;
    narrowBothBtn.classList.toggle('is-active', next === 'both');
    narrowLeftBtn.classList.toggle('is-active', next === 'left');
    narrowRightBtn.classList.toggle('is-active', next === 'right');
    leftPaneEl.hidden = next === 'right';
    rightPaneEl.hidden = next === 'left';
  }

  function syncDraftRelatedViews() {
    const text = draftTextarea.value || '';
    const chars = countReadableChars(text);
    const tokens = estimateTokens(text);
    const active = getActiveScheme(settings);
    const targetChars = active?.targetChars || 1500;
    tokenBadgeEl.textContent = `${chars} 字 · 约 ${tokens} tokens（目标 ${targetChars} 字）`;
    viewDraftLogBtn.hidden = !state.lastDraftLog;

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
        const shellSec = sections.find((s) => /(?:当前背景|当前身份|剧场壳)/.test(s.title));
        sectionSelect.value = shellSec ? shellSec.title : sections[0].title;
      }
    }

    // Lint (including anti-parrot replay risk action!)
    const lint = lintPersonaText(text, {
      ...settings.tasteProfile,
      visibilityTags: state.visibilityTags,
    });
    lintSummaryBadge.textContent = text.trim()
      ? lint.issues.length === 0
        ? `检查通过 · ${lint.score}分`
        : `${lint.issues.length} 项建议`
      : '待检查';
    lintSummaryBadge.className = `ups-badge ${
      lint.issues.length === 0 && text.trim() ? 'ups-badge-ok' : lint.issues.length > 0 ? 'ups-badge-warn' : ''
    }`;

    const issueNodes = lint.issues.slice(0, 6).map((issue) => {
      const children = [createEl(doc, 'span', { text: issue.message || issue.code })];
      if (issue.type === 'replay_risk') {
        const guardBtn = createEl(doc, 'button', {
          type: 'button',
          className: 'ups-btn-sm',
          text: '+ 附上防照抄说明',
          attrs: { 'data-ups-append-antiparrot': 'true' },
        });
        guardBtn.addEventListener('click', () => {
          const guarded = appendAntiParrotClause(draftTextarea.value);
          setDraftValue(guarded, { recordHistory: true });
          setStatus('✓ 已在文末附上防照抄演绎说明，避免模型每轮照搬原示例桥段', 'ok', { toast: true });
        });
        children.push(guardBtn);
      } else if (issue.type === 'dash_overuse') {
        const dashBtn = createEl(doc, 'button', {
          type: 'button',
          className: 'ups-btn-sm',
          text: '清理破折号',
          attrs: { 'data-ups-clean-dashes': 'true' },
        });
        dashBtn.addEventListener('click', () => {
          const cleanedDashes = replaceEmDashes(draftTextarea.value);
          setDraftValue(cleanedDashes, { recordHistory: true });
          setStatus('✓ 已将文中破折号替换为清爽标点，防止正文模仿增殖', 'ok', { toast: true });
        });
        children.push(dashBtn);
      } else if (issue.match) {
        const banBtn = createEl(doc, 'button', {
          type: 'button',
          className: 'ups-btn-sm',
          text: '加入禁写',
        });
        banBtn.addEventListener('click', () => {
          settings.tasteProfile.banned = mergeTasteEntries(settings.tasteProfile.banned, [
            { text: issue.match, note: '检查结果一键屏蔽' },
          ]);
          persistSettings();
          renderTasteTab();
          syncDraftRelatedViews();
          setStatus(`✓ 已加入禁写：${issue.match}`, 'ok', { toast: true });
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

  function formatEntryPreviewText(content) {
    const raw = String(content || '');
    const chars = countReadableChars(raw);
    const flat = raw.replace(/\s+/g, ' ').trim();
    if (!flat) return '0 字 · 点击展开编写规则内容';
    const snippet = flat.length > 52 ? `${flat.slice(0, 52)}…` : flat;
    return `${chars} 字 · ${snippet}`;
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
          style: { padding: '14px 10px', textAlign: 'center' },
          text: '未找到匹配的规则条目，请清空搜索词或点击“+ 新增条目”。',
        })
      );
      return;
    }

    const cards = filtered.map((initialEntry) => {
      const entryId = initialEntry.id;
      const isJustAdded = state.justAddedEntryId === entryId;
      const isInitiallyExpanded = state.expandedEntryIds.has(entryId);
      const cardState = {
        entry: { ...initialEntry },
        isDirty: false,
        collapseTimer: null,
        nameInput: null,
      };

      const dragHandleEl = createEl(doc, 'span', {
        className: 'ups-drag-handle',
        text: '⋮⋮',
        title: '按住上下拖拽调整规则顺序（展开状态下也可直接拖拽）',
        draggable: true,
        attrs: { 'data-ups-drag-handle': entryId },
      });

      const chevEl = createEl(
        doc,
        'span',
        { className: 'ups-acc-chev', attrs: { 'aria-hidden': 'true' } },
        [createSvgIcon(doc, ['M9 6l6 6-6 6'], 14)]
      );
      const dotEl = createEl(doc, 'span', {
        className: `ups-acc-dot${cardState.entry.enabled ? ' is-on' : ''}`,
        title: cardState.entry.enabled ? '已启用' : '已停用',
      });
      const roleBadgeEl = createEl(doc, 'span', { className: 'ups-badge', text: cardState.entry.role });
      const titleEl = createEl(doc, 'span', { className: 'ups-entry-title', text: cardState.entry.name });
      const dirtyBadgeEl = createEl(doc, 'span', {
        className: 'ups-acc-dirty',
        text: '● 未保存',
        hidden: true,
        attrs: { 'data-ups-entry-dirty': 'true' },
      });
      const previewEl = createEl(doc, 'div', {
        className: 'ups-acc-preview',
        text: formatEntryPreviewText(cardState.entry.content),
      });

      const rowMainBtn = createEl(
        doc,
        'button',
        {
          type: 'button',
          className: 'ups-acc-row-main',
          attrs: {
            'data-ups-acc-toggle': entryId,
            'aria-expanded': String(isInitiallyExpanded),
          },
        },
        [
          chevEl,
          dotEl,
          createEl(doc, 'div', { className: 'ups-acc-text-col' }, [
            createEl(doc, 'div', { className: 'ups-entry-main' }, [roleBadgeEl, titleEl, dirtyBadgeEl]),
            previewEl,
          ]),
        ]
      );

      // Wide-screen flat inline actions (hidden on narrow containers via CSS @container!)
      const curIdx = entries.findIndex((e) => e.id === entryId);
      const moveUpInlineBtn = createEl(doc, 'button', {
        type: 'button',
        className: 'ups-btn-sm',
        text: '↑',
        title: '上移一位',
        disabled: curIdx <= 0,
      });
      const moveDownInlineBtn = createEl(doc, 'button', {
        type: 'button',
        className: 'ups-btn-sm',
        text: '↓',
        title: '下移一位',
        disabled: curIdx === -1 || curIdx >= entries.length - 1,
      });
      const expandBtn = createEl(doc, 'button', {
        type: 'button',
        className: 'ups-btn-sm ups-hide-xs',
        text: isInitiallyExpanded ? '收起' : '展开',
        attrs: { 'data-ups-expand-btn': 'true' },
      });
      const delInlineBtn = createEl(doc, 'button', {
        type: 'button',
        className: 'ups-btn-sm',
        text: '删除',
        disabled: Boolean(cardState.entry.locked),
        title: cardState.entry.locked ? '核心条目不可删' : '删除此条目',
      });

      const inlineActionsWrap = createEl(doc, 'div', { className: 'ups-row-inline-actions' }, [
        moveUpInlineBtn,
        moveDownInlineBtn,
        expandBtn,
        delInlineBtn,
      ]);

      const switchBtn = createEl(
        doc,
        'button',
        {
          type: 'button',
          className: `ups-switch${cardState.entry.enabled ? ' is-on' : ''}`,
          attrs: {
            role: 'switch',
            'aria-checked': String(Boolean(cardState.entry.enabled)),
            'aria-label': `开关 ${cardState.entry.name}`,
          },
        },
        [createEl(doc, 'span', { className: 'ups-switch-thumb' })]
      );

      const moreBtn = createEl(doc, 'button', {
        type: 'button',
        className: 'ups-more-btn',
        text: '···',
        title: '更多操作',
      });

      const collapseInnerEl = createEl(doc, 'div', { className: 'ups-acc-collapse-inner' });
      const collapseWrapEl = createEl(doc, 'div', { className: 'ups-acc-collapse' }, [collapseInnerEl]);

      const cardEl = createEl(
        doc,
        'div',
        {
          className: `ups-entry-card${isInitiallyExpanded ? ' is-expanded' : ''}${!cardState.entry.enabled ? ' is-disabled' : ''}${isJustAdded ? ' ups-just-added' : ''}`,
          attrs: { 'data-ups-entry-id': entryId },
        },
        [
          createEl(doc, 'div', { className: 'ups-entry-row' }, [
            dragHandleEl,
            rowMainBtn,
            createEl(doc, 'div', { className: 'ups-row-controls' }, [inlineActionsWrap, switchBtn, moreBtn]),
          ]),
          collapseWrapEl,
        ]
      );

      // Gate 5: Body-first editor (core content immediately visible; low-frequency metadata collapsed!)
      function mountEntryEditor({ openMeta = false } = {}) {
        if (collapseInnerEl.querySelector('.ups-entry-editor')) return;
        const entryHist = createDraftHistory(cardState.entry.content || '', 40);
        const nameEd = createEl(doc, 'input', {
          type: 'text',
          className: 'ups-input',
          value: cardState.entry.name || '',
        });
        cardState.nameInput = nameEd;
        cardEl._upsNameInput = nameEd;

        const roleEd = createEl(
          doc,
          'select',
          { className: 'ups-select' },
          ['system', 'user', 'assistant'].map((r) => createEl(doc, 'option', { value: r, text: r }))
        );
        roleEd.value = cardState.entry.role || 'system';

        const contentEd = createEl(doc, 'textarea', {
          className: 'ups-textarea ups-acc-textarea',
          rows: 5,
          value: cardState.entry.content || '',
        });

        const entryStatsEl = createEl(doc, 'span', {
          className: 'ups-muted',
          text: '',
          attrs: { 'data-ups-entry-stats': 'true' },
        });
        const entryUndoBtn = createEl(doc, 'button', {
          type: 'button',
          className: 'ups-btn-sm',
          text: '撤回',
          disabled: true,
        });
        const entryRedoBtn = createEl(doc, 'button', {
          type: 'button',
          className: 'ups-btn-sm',
          text: '重做',
          disabled: true,
        });
        const entryCopyBtn = createEl(doc, 'button', {
          type: 'button',
          className: 'ups-btn-sm',
          text: '复制',
        });
        const entryTallBtn = createEl(doc, 'button', {
          type: 'button',
          className: 'ups-btn-sm',
          text: '展开长文',
          attrs: { 'data-ups-entry-tall': 'true' },
        });
        const saveStatusEl = createEl(doc, 'span', {
          className: 'ups-acc-save-status',
          text: '',
        });

        const syncEditorMeta = () => {
          const curVal = contentEd.value || '';
          const cCount = countReadableChars(curVal);
          const tCount = estimateTokens(curVal);
          entryStatsEl.textContent = `${cCount} 字 · 约 ${tCount} tokens`;
          entryUndoBtn.disabled = !entryHist.canUndo();
          entryRedoBtn.disabled = !entryHist.canRedo();
          const dirtyNow =
            nameEd.value !== (cardState.entry.name || '') ||
            roleEd.value !== (cardState.entry.role || 'system') ||
            curVal !== (cardState.entry.content || '');
          cardState.isDirty = dirtyNow;
          dirtyBadgeEl.hidden = !dirtyNow;
          if (dirtyNow) {
            saveStatusEl.textContent = '';
          }
        };

        nameEd.addEventListener('input', syncEditorMeta);
        roleEd.addEventListener('change', syncEditorMeta);
        contentEd.addEventListener('input', () => {
          entryHist.push(contentEd.value);
          syncEditorMeta();
        });

        entryUndoBtn.addEventListener('click', () => {
          contentEd.value = entryHist.undo();
          syncEditorMeta();
        });
        entryRedoBtn.addEventListener('click', () => {
          contentEd.value = entryHist.redo();
          syncEditorMeta();
        });
        entryCopyBtn.addEventListener('click', () => {
          win?.navigator?.clipboard?.writeText?.(contentEd.value || '').catch(() => {});
          flashButtonFeedback(entryCopyBtn, '✓ 已复制');
          setStatus(`已复制规则内容：${nameEd.value || cardState.entry.name}`);
        });
        entryTallBtn.addEventListener('click', () => {
          const prevScrollTop = bodyEl.scrollTop;
          const tall = contentEd.classList.toggle('is-tall');
          entryTallBtn.classList.toggle('is-active', tall);
          entryTallBtn.textContent = tall ? '恢复标准高度' : '展开长文';
          bodyEl.scrollTop = prevScrollTop;
        });

        const applyBtn = createEl(doc, 'button', {
          type: 'button',
          className: 'ups-btn ups-btn-primary',
          text: '保存条目修改',
          attrs: { 'data-ups-entry-save': 'true' },
        });
        const collapseInlineBtn = createEl(doc, 'button', {
          type: 'button',
          className: 'ups-btn-ghost',
          text: '收起',
          attrs: { 'data-ups-entry-collapse': 'true' },
        });

        applyBtn.addEventListener('click', () => {
          const curScheme = getActiveScheme(settings);
          if (!curScheme) return;
          const nextName = nameEd.value.trim() || cardState.entry.name || '未命名规则';
          const nextRole = roleEd.value || 'system';
          const nextContent = contentEd.value;
          const nextScheme = updateStackEntry(curScheme, entryId, {
            name: nextName,
            role: nextRole,
            content: nextContent,
          });
          settings.schemes = settings.schemes.map((s) => (s.id === curScheme.id ? nextScheme : s));
          cardState.entry = {
            ...cardState.entry,
            name: nextName,
            role: nextRole,
            content: nextContent,
          };
          nameEd.value = nextName;
          titleEl.textContent = nextName;
          roleBadgeEl.textContent = nextRole;
          previewEl.textContent = formatEntryPreviewText(nextContent);
          cardState.isDirty = false;
          dirtyBadgeEl.hidden = true;
          saveStatusEl.textContent = '✓ 已保存';
          flashButtonFeedback(applyBtn, '✓ 已保存');
          updateSchemeSelects();
          persistSettings();
          setStatus(`✓ 已更新规则条目：${nextName}`, 'ok');
        });

        collapseInlineBtn.addEventListener('click', () => {
          setExpandedState(false);
        });

        syncEditorMeta();

        const metaDetailsEl = createEl(
          doc,
          'details',
          { className: 'ups-advanced-details', open: openMeta },
          [
            createEl(doc, 'summary', { text: '修改条目名称与消息角色（低频配置）' }),
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
          ]
        );

        const editorEl = createEl(doc, 'div', { className: 'ups-entry-editor' }, [
          createEl(doc, 'div', { className: 'ups-field' }, [
            createEl(doc, 'div', { className: 'ups-acc-editor-toolbar' }, [
              createEl(doc, 'div', { className: 'ups-row' }, [
                createEl(doc, 'label', { className: 'ups-label', text: '规则正文内容' }),
                entryStatsEl,
              ]),
              createEl(doc, 'div', { className: 'ups-acc-editor-tools' }, [
                createEl(doc, 'span', { className: 'ups-btn-pair' }, [entryUndoBtn, entryRedoBtn]),
                entryCopyBtn,
                entryTallBtn,
              ]),
            ]),
            contentEd,
          ]),
          metaDetailsEl,
          createEl(doc, 'div', { className: 'ups-acc-editor-footer' }, [
            createEl(doc, 'div', { className: 'ups-btn-row' }, [applyBtn, collapseInlineBtn]),
            saveStatusEl,
          ]),
        ]);
        collapseInnerEl.replaceChildren(editorEl);
      }

      function setExpandedState(nextOpen) {
        const curOpen = state.expandedEntryIds.has(entryId);
        if (Boolean(nextOpen) === curOpen) return;
        if (cardState.collapseTimer) {
          clearTimeout(cardState.collapseTimer);
          cardState.collapseTimer = null;
        }
        if (nextOpen) {
          state.expandedEntryIds.add(entryId);
          mountEntryEditor({ openMeta: false });
          cardEl.classList.add('is-expanded');
          rowMainBtn.setAttribute('aria-expanded', 'true');
          expandBtn.textContent = '收起';
          setStatus(`已展开条目：${cardState.entry.name}`);
        } else {
          if (cardState.isDirty && typeof win?.confirm === 'function') {
            const ok = win.confirm('当前规则条目有未保存的修改，确定收起并放弃修改吗？');
            if (!ok) return;
          }
          cardState.isDirty = false;
          dirtyBadgeEl.hidden = true;
          state.expandedEntryIds.delete(entryId);
          cardEl.classList.remove('is-expanded');
          rowMainBtn.setAttribute('aria-expanded', 'false');
          expandBtn.textContent = '展开';
          setStatus(`已收起条目：${cardState.entry.name}`);
          if (typeof win?.requestAnimationFrame === 'function') {
            cardState.collapseTimer = setTimeout(() => {
              cardState.collapseTimer = null;
              if (!state.expandedEntryIds.has(entryId)) {
                collapseInnerEl.replaceChildren();
              }
            }, 220);
            cardState.collapseTimer?.unref?.();
          } else {
            collapseInnerEl.replaceChildren();
          }
        }
      }

      if (isInitiallyExpanded) {
        mountEntryEditor({ openMeta: isJustAdded });
      }

      rowMainBtn.addEventListener('click', () => {
        setExpandedState(!state.expandedEntryIds.has(entryId));
      });
      expandBtn.addEventListener('click', () => {
        setExpandedState(!state.expandedEntryIds.has(entryId));
      });

      const doMove = (dir) => {
        const sNow = getActiveScheme(settings);
        if (!sNow) return;
        const nextScheme = moveStackEntry(sNow, entryId, dir);
        settings.schemes = settings.schemes.map((s) => (s.id === sNow.id ? nextScheme : s));
        renderStackTab();
        persistSettings();
        setStatus(`已${dir === 'up' ? '上移' : '下移'}条目：${cardState.entry.name}`);
      };
      moveUpInlineBtn.addEventListener('click', () => doMove('up'));
      moveDownInlineBtn.addEventListener('click', () => doMove('down'));

      delInlineBtn.addEventListener('click', () => {
        if (cardState.entry.locked) return;
        const sNow = getActiveScheme(settings);
        if (!sNow) return;
        const nextScheme = removeStackEntry(sNow, entryId);
        settings.schemes = settings.schemes.map((s) => (s.id === sNow.id ? nextScheme : s));
        state.expandedEntryIds.delete(entryId);
        renderStackTab();
        persistSettings();
        setStatus(`已删除条目：${cardState.entry.name}`);
      });

      // Drag-and-drop reorder works seamlessly whether entry is collapsed OR expanded!
      dragHandleEl.addEventListener('dragstart', (ev) => {
        state.draggingEntryId = entryId;
        cardEl.classList.add('is-dragging-row');
        try {
          ev.dataTransfer?.setData?.('text/plain', entryId);
          if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move';
        } catch {
          // ignore mock dataTransfer
        }
      });
      dragHandleEl.addEventListener('dragend', () => {
        state.draggingEntryId = '';
        cardEl.classList.remove('is-dragging-row');
        for (const c of stackListEl.querySelectorAll('.ups-entry-card')) {
          c.classList.remove('is-drag-over-top', 'is-drag-over-bottom');
        }
      });
      cardEl.addEventListener('dragover', (ev) => {
        if (!state.draggingEntryId || state.draggingEntryId === entryId) return;
        ev.preventDefault?.();
        const rect = cardEl.getBoundingClientRect?.() || { top: 0, height: 40 };
        const mid = rect.top + rect.height / 2;
        const isTop = (Number(ev.clientY) || 0) < mid;
        cardEl.classList.toggle('is-drag-over-top', isTop);
        cardEl.classList.toggle('is-drag-over-bottom', !isTop);
      });
      cardEl.addEventListener('dragleave', () => {
        cardEl.classList.remove('is-drag-over-top', 'is-drag-over-bottom');
      });
      cardEl.addEventListener('drop', (ev) => {
        ev.preventDefault?.();
        const fromId = state.draggingEntryId;
        state.draggingEntryId = '';
        cardEl.classList.remove('is-drag-over-top', 'is-drag-over-bottom');
        if (!fromId || fromId === entryId) return;
        const sNow = getActiveScheme(settings);
        if (!sNow) return;
        const allIds = sNow.entries.map((e) => e.id);
        const fromIdx = allIds.indexOf(fromId);
        let toIdx = allIds.indexOf(entryId);
        if (fromIdx === -1 || toIdx === -1) return;
        const rect = cardEl.getBoundingClientRect?.() || { top: 0, height: 40 };
        const after = (Number(ev.clientY) || 0) >= rect.top + rect.height / 2;
        if (after && toIdx < fromIdx) toIdx += 1;
        if (!after && toIdx > fromIdx) toIdx -= 1;
        const nextScheme = moveStackEntry(sNow, fromId, { toIndex: toIdx });
        settings.schemes = settings.schemes.map((s) => (s.id === sNow.id ? nextScheme : s));
        renderStackTab();
        persistSettings();
        setStatus('✓ 已拖拽调整规则顺序', 'ok');
      });

      switchBtn.addEventListener('click', () => {
        const curScheme = getActiveScheme(settings);
        if (!curScheme) return;
        const nextScheme = toggleStackEntry(curScheme, entryId);
        settings.schemes = settings.schemes.map((s) => (s.id === curScheme.id ? nextScheme : s));
        const updatedEntry = nextScheme.entries.find((e) => e.id === entryId);
        const nowEnabled = Boolean(updatedEntry?.enabled);
        cardState.entry.enabled = nowEnabled;
        switchBtn.classList.toggle('is-on', nowEnabled);
        switchBtn.setAttribute('aria-checked', String(nowEnabled));
        dotEl.classList.toggle('is-on', nowEnabled);
        dotEl.title = nowEnabled ? '已启用' : '已停用';
        cardEl.classList.toggle('is-disabled', !nowEnabled);
        updateSchemeSelects();
        persistSettings();
        setStatus(`${nowEnabled ? '已启用' : '已停用'}条目：${cardState.entry.name}`);
      });

      moreBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const curScheme = getActiveScheme(settings);
        const curEntries = curScheme?.entries || [];
        const liveIdx = curEntries.findIndex((e) => e.id === entryId);
        const liveOpen = state.expandedEntryIds.has(entryId);
        openFloatingMenu(moreBtn, [
          {
            label: '上移一位',
            disabled: liveIdx <= 0,
            onSelect: () => doMove('up'),
          },
          {
            label: '下移一位',
            disabled: liveIdx === -1 || liveIdx >= curEntries.length - 1,
            onSelect: () => doMove('down'),
          },
          {
            label: liveOpen ? '收起详情' : '展开详情',
            onSelect: () => setExpandedState(!state.expandedEntryIds.has(entryId)),
          },
          {
            label: cardState.entry.locked ? '核心条目不可删' : '删除条目',
            disabled: Boolean(cardState.entry.locked),
            onSelect: () => delInlineBtn.click(),
          },
        ]);
      });

      return cardEl;
    });

    stackListEl.replaceChildren(...cards);
    if (state.justAddedEntryId) {
      const targetId = state.justAddedEntryId;
      state.justAddedEntryId = '';
      const targetCard = cards.find((c) => c.getAttribute?.('data-ups-entry-id') === targetId);
      if (targetCard) {
        targetCard.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
        if (typeof bodyEl.scrollHeight === 'number' && bodyEl.scrollHeight > 0) {
          bodyEl.scrollTop = bodyEl.scrollHeight;
        }
        if (canAutoFocusDesktop(win) && targetCard._upsNameInput) {
          targetCard._upsNameInput.focus?.();
          targetCard._upsNameInput.select?.();
        }
      }
    }
  }

  function renderBuiltinLexiconPacks() {
    const disabledSet = new Set(settings.tasteProfile.disabledCategories || []);
    const packs = BUILTIN_BANNED_CATEGORIES.map((cat) => {
      const isEnabled = !disabledSet.has(cat.id);
      const sw = createEl(
        doc,
        'button',
        {
          type: 'button',
          className: `ups-switch${isEnabled ? ' is-on' : ''}`,
          attrs: {
            role: 'switch',
            'aria-checked': String(isEnabled),
            'aria-label': `开关 ${cat.name}`,
            'data-ups-cat-switch': cat.id,
          },
        },
        [createEl(doc, 'span', { className: 'ups-switch-thumb' })]
      );
      sw.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const cur = new Set(settings.tasteProfile.disabledCategories || []);
        if (cur.has(cat.id)) cur.delete(cat.id);
        else cur.add(cat.id);
        settings.tasteProfile.disabledCategories = Array.from(cur);
        renderTasteTab();
        syncDraftRelatedViews();
        persistSettings();
        setStatus(`${cur.has(cat.id) ? '已停用' : '已启用'}避雷词包：${cat.name}`);
      });

      const detailsEl = createEl(
        doc,
        'details',
        { className: `ups-lexicon-pack${isEnabled ? '' : ' is-off'}` },
        [
          createEl(doc, 'summary', { className: 'ups-lexicon-head' }, [
            createEl(doc, 'div', { className: 'ups-row' }, [
              createEl(doc, 'span', { className: 'ups-entry-title', text: cat.name }),
              createEl(doc, 'span', { className: 'ups-badge', text: `${cat.phrases.length} 条` }),
            ]),
            sw,
          ]),
          createEl(doc, 'div', { className: 'ups-lexicon-body' }, [
            createEl(doc, 'div', { className: 'ups-muted', text: cat.description }),
            createEl(
              doc,
              'div',
              { className: 'ups-lexicon-tags' },
              cat.phrases.map((p) => createEl(doc, 'span', { className: 'ups-lexicon-tag', text: p }))
            ),
          ]),
        ]
      );
      return detailsEl;
    });
    builtinCategoriesContainer.replaceChildren(...packs);
  }

  function renderTasteTab() {
    const useBuiltin = settings.tasteProfile.useBuiltinBanned !== false;
    useBuiltinBannedBtn.classList.toggle('is-on', useBuiltin);
    useBuiltinBannedBtn.setAttribute('aria-checked', String(useBuiltin));
    bannedSendModeSelect.value = settings.tasteProfile.bannedSendMode || 'smart_compact';
    renderBuiltinLexiconPacks();

    const q = state.tasteSearchQuery.trim().toLowerCase();
    const filterList = (items) =>
      (items || []).filter((item) => {
        if (!q) return true;
        return (
          String(item.text || '').toLowerCase().includes(q) ||
          String(item.note || '').toLowerCase().includes(q)
        );
      });

    const renderGroup = (title, items, kind, inputEl, addBtnEl) => {
      const rows = filterList(items).map((item) => {
        const delBtn = createEl(doc, 'button', { type: 'button', className: 'ups-btn-sm', text: '移除' });
        delBtn.addEventListener('click', () => {
          settings.tasteProfile[kind] = (settings.tasteProfile[kind] || []).filter((x) => x.id !== item.id);
          renderTasteTab();
          persistSettings();
          syncDraftRelatedViews();
          setStatus(`已移除：${item.text.slice(0, 18)}`);
        });
        const metaChildren = [createEl(doc, 'div', { className: 'ups-entry-title', text: item.text })];
        if (item.note) {
          metaChildren.push(createEl(doc, 'div', { className: 'ups-muted', text: item.note }));
        }
        const isJustAdded = state.justAddedTasteId === item.id;
        return createEl(
          doc,
          'div',
          {
            className: `ups-entry-row${isJustAdded ? ' ups-just-added' : ''}`,
            attrs: { 'data-ups-taste-id': item.id },
          },
          [
            createEl(doc, 'div', { style: { minWidth: '0', flex: '1 1 auto' } }, metaChildren),
            delBtn,
          ]
        );
      });

      return createEl(doc, 'div', { className: 'ups-entry-card', style: { padding: '8px' } }, [
        createEl(doc, 'div', { className: 'ups-mod-head' }, [
          createEl(doc, 'span', { className: 'ups-mod-title', text: `${title}（${items.length}）` }),
        ]),
        createEl(doc, 'div', { className: 'ups-row', style: { margin: '8px 0' } }, [
          createEl(doc, 'div', { style: { flex: '1 1 130px' } }, [inputEl]),
          addBtnEl,
        ]),
        createEl(
          doc,
          'div',
          { className: 'ups-taste-scroll' },
          rows.length
            ? rows
            : [createEl(doc, 'div', { className: 'ups-muted', style: { padding: '10px 4px' }, text: '暂无记录' })]
        ),
      ]);
    };

    tasteListContainer.replaceChildren(
      renderGroup('我喜欢的细节偏好', settings.tasteProfile.anchors || [], 'anchors', addAnchorInput, addAnchorBtn),
      renderGroup('我不喜欢的禁写词句', settings.tasteProfile.banned || [], 'banned', addBannedInput, addBannedBtn)
    );

    if (state.justAddedTasteId) {
      const targetId = state.justAddedTasteId;
      state.justAddedTasteId = '';
      const rowEl = tasteListContainer.querySelector?.(`[data-ups-taste-id="${targetId}"]`);
      rowEl?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
    }
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
    settings.ui.activeTab = tabId;
    popoverEl.hidden = true;
    closeFloatingMenu();
    bodyEl.classList.toggle('is-studio-tab', tabId === 'studio');
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
    persistSettings();
  }

  function setMode(nextMode) {
    const prevMode = state.mode;
    state.mode = nextMode === 'B' ? 'B' : 'A';
    settings.ui.mode = state.mode;
    modeABtn.classList.toggle('is-active', state.mode === 'A');
    modeBBtn.classList.toggle('is-active', state.mode === 'B');
    modeAPanel.hidden = state.mode !== 'A';
    modeBPanel.hidden = state.mode !== 'B';

    // Smart preset pairing on mode switch (carries over user's chosen targetChars!)
    if (prevMode !== state.mode) {
      const curScheme = getActiveScheme(settings);
      const curChars = curScheme?.targetChars || 1500;
      if (
        state.mode === 'B' &&
        (settings.activeSchemeId === 'longform_coact' || settings.activeSchemeId === 'player_controlled') &&
        settings.schemes.some((s) => s.id === 'persona_refactor')
      ) {
        state.lastCreateSchemeId = settings.activeSchemeId;
        settings.schemes = settings.schemes.map((s) =>
          s.id === 'persona_refactor' ? applyTargetCharsToScheme(s, curChars) : s
        );
        settings.activeSchemeId = 'persona_refactor';
        updateSchemeSelects();
        syncDraftRelatedViews();
      } else if (state.mode === 'A' && settings.activeSchemeId === 'persona_refactor') {
        const restoreId =
          state.lastCreateSchemeId && settings.schemes.some((s) => s.id === state.lastCreateSchemeId)
            ? state.lastCreateSchemeId
            : 'longform_coact';
        settings.activeSchemeId = restoreId;
        updateSchemeSelects();
        syncDraftRelatedViews();
      }
      persistSettings();
    }
  }

  function openSubmodal({ title, bodyNodes = [], footerNodes = [] }) {
    popoverEl.hidden = true;
    closeFloatingMenu();
    submodalCardEl.classList.remove('is-floating');
    submodalCardEl.style.left = '';
    submodalCardEl.style.top = '';
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

  // Non-blocking draggable submodal card header
  let subDrag = null;
  submodalHeaderEl.addEventListener('pointerdown', (ev) => {
    if (ev.button !== undefined && ev.button !== 0) return;
    if (ev.target?.closest?.(INTERACTIVE_DRAG_IGNORE)) return;
    const r = submodalCardEl.getBoundingClientRect();
    subDrag = {
      pointerId: ev.pointerId,
      startX: ev.clientX,
      startY: ev.clientY,
      origLeft: r.left,
      origTop: r.top,
      width: r.width,
      height: r.height,
    };
    submodalHeaderEl.setPointerCapture?.(ev.pointerId);
  }, { signal });
  submodalHeaderEl.addEventListener('pointermove', (ev) => {
    if (!subDrag || ev.pointerId !== subDrag.pointerId) return;
    const pos = computeDraggedModalPosition({
      origLeft: subDrag.origLeft,
      origTop: subDrag.origTop,
      dx: ev.clientX - subDrag.startX,
      dy: ev.clientY - subDrag.startY,
      width: subDrag.width,
      height: subDrag.height,
      viewportWidth: win?.innerWidth || 1280,
      viewportHeight: win?.innerHeight || 800,
    });
    submodalCardEl.classList.add('is-floating');
    submodalCardEl.style.left = `${pos.left}px`;
    submodalCardEl.style.top = `${pos.top}px`;
  }, { signal });
  const endSubDrag = (ev) => {
    if (!subDrag || ev.pointerId !== subDrag.pointerId) return;
    try {
      submodalHeaderEl.releasePointerCapture?.(ev.pointerId);
    } catch {
      // ignore
    }
    subDrag = null;
  };
  submodalHeaderEl.addEventListener('pointerup', endSubDrag, { signal });
  submodalHeaderEl.addEventListener('pointercancel', endSubDrag, { signal });

  // ==========================================================================
  // Context Refresh & Host Persistence
  // ==========================================================================

  async function refreshContext({ manual = false } = {}) {
    try {
      const prevSummary = `${state.cachedActivePersona?.avatarId || ''}|${state.cachedActivePersona?.description || ''}|${state.cachedCharContext?.name || ''}`;
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
        charContextHint.textContent = `当前角色：${charCtx.name}${charCtx.worldName ? `（世界书：${charCtx.worldName}）` : ''}`;
      } else {
        ctxChip.hidden = true;
        charContextHint.textContent = '当前未打开角色卡，将依据你的灵感与方案直接生成。';
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

      if (manual) {
        const nextSummary = `${activeP?.avatarId || ''}|${activeP?.description || ''}|${charCtx?.name || ''}`;
        const pName = activeP?.name || '无';
        const cName = charCtx?.name || '未选角色卡';
        flashButtonFeedback(syncHostBtn, '✓ 已同步');
        setStatus(
          prevSummary === nextSummary
            ? `✓ 已重新扫描酒馆状态，无新增变动（人设：${pName}｜角色：${cName}）`
            : `✓ 已同步最新酒馆状态（人设：${pName}｜角色：${cName}）`,
          'ok',
          { toast: true }
        );
      }
    } catch {
      if (manual) {
        setStatus('同步酒馆状态失败，请确认酒馆主界面已加载完成', 'warn');
      }
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

    const activeCustom = settings.api.provider === 'custom' ? getActiveCustomProfile(settings) : null;
    const modelHint = activeCustom
      ? { model: activeCustom.model, baseUrl: activeCustom.baseUrl, source: 'custom' }
      : undefined;

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
      lockedCore: getCombinedLockedPointsText(),
      userMustHaves,
      tasteProfile: settings.tasteProfile,
      dualLayer: state.dualLayer,
      visibilityTags: state.visibilityTags,
      draftAudit: state.draftAudit && !isSectionRegen,
      antiParrot: state.antiParrot,
      spotlightMode: state.spotlightMode,
      backstoryMode: state.backstoryMode,
      targetSection: targetSec,
      modelHint,
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
        setStatus('✓ 已复制组装提示词', 'ok', { toast: true });
        closeSubmodal();
      });
      const closePreviewBtn = createEl(doc, 'button', { type: 'button', className: 'ups-btn-ghost', text: '关闭' });
      closePreviewBtn.addEventListener('click', closeSubmodal);
      openSubmodal({
        title: `提示词预览（约 ${built.estimatedTokens} tokens · 可拖动浮窗对照底层）`,
        bodyNodes: [pre],
        footerNodes: [closePreviewBtn, copyPromptBtn],
      });
    } catch (err) {
      setStatus(`提示词组装提示：${err.message}`, 'warn');
    }
  }

  viewDraftLogBtn.addEventListener('click', () => {
    if (!state.lastDraftLog) return;
    const logArea = createEl(doc, 'textarea', {
      className: 'ups-textarea',
      rows: 10,
      readOnly: true,
      value: state.lastDraftLog,
    });
    const closeLogBtn = createEl(doc, 'button', { type: 'button', className: 'ups-btn-ghost', text: '关闭' });
    closeLogBtn.addEventListener('click', closeSubmodal);
    openSubmodal({
      title: '本次 AI 构思自检草稿记录（已自动从成稿剥离）',
      bodyNodes: [logArea],
      footerNodes: [closeLogBtn],
    });
  }, { signal });

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
          setStatus('正在读取酒馆当前人设…');
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

      if (state.narrowPane === 'left') {
        setNarrowPane('right');
      }
      state.lastDraftLog = '';
      viewDraftLogBtn.hidden = true;
      setStatus(targetSection ? `正在重写【${targetSection}】…` : '正在生成人设…');

      const activeScheme = getActiveScheme(settings);
      const minMaxTokens =
        state.draftAudit && !targetSection
          ? Math.min(32768, (Number(activeScheme?.maxTokens) || 3300) + 900)
          : undefined;

      const res = await hostApi.runStudioGeneration({
        settings,
        messages: built.messages,
        minMaxTokens,
        signal: ac.signal,
        onChunk: (_delta, fullText) => {
          if (!targetSection) {
            const stripped = stripDraftAuditBlocks(fullText);
            if (stripped.draftLog) {
              state.lastDraftLog = stripped.draftLog;
            }
            if (stripped.hasUnclosedDraft && !stripped.cleanText) {
              setStatus('AI 正在完成构思自检与防打卡排雷，即将输出正文…');
            } else {
              draftTextarea.value = stripped.cleanText;
            }
          }
        },
      });

      const strippedFinal = stripDraftAuditBlocks(res.text || '');
      if (strippedFinal.draftLog) {
        state.lastDraftLog = strippedFinal.draftLog;
      }
      const cleaned = normalizeFlatLayout(strippedFinal.cleanText || res.text || '');
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
      setStatus(
        targetSection ? `✓ 已完成【${targetSection}】重写` : `✓ 人设生成完成（来源：${res.source || 'host'}）`,
        'ok',
        { toast: true }
      );
    } catch (err) {
      if (ac.signal.aborted || err?.code === 'ABORTED' || err?.name === 'AbortError') {
        setStatus('已停止生成');
      } else {
        setStatus(`生成失败：${err?.message || '请检查连接或复制提示词外部生成'}`, 'error');
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
      setStatus('当前成稿框为空，请先生成或输入人设后再提取改稿偏好', 'warn');
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
        createEl(doc, 'div', { className: 'ups-muted', text: '暂未检测到新的删改差异；你也可以直接在上方拖选词句标记喜好。' })
      );
      tasteCandidatesBox.hidden = false;
      setStatus('未检测到初稿与当前稿的新增删改差异', 'warn');
      return;
    }

    tasteCandidatesListEl.replaceChildren(...items);
    tasteCandidatesBox.hidden = false;
    setStatus(`✓ 已从改稿差异中提取 ${items.length} 条偏好候选`, 'ok', { toast: true });
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
    setStatus(`✓ 已记入 ${nextAnchors.length} 条喜好、${nextBanned.length} 条禁写规则`, 'ok', { toast: true });
  }

  async function saveCurrentPersona(mode) {
    if (state.isSaving) return;
    const rawDraft = draftTextarea.value.trim();
    if (!rawDraft) {
      setStatus('请先生成或填写人设正文后再保存', 'warn');
      return;
    }
    const split = state.dualLayer ? splitDualLayerOutput(rawDraft) : { coreDescription: rawDraft, worldbookEntries: [] };
    const description = split.coreDescription || rawDraft;
    const nameInputVal = saveNameInput.value.trim();

    state.isSaving = true;
    saveOverwriteBtn.disabled = true;
    saveNewBtn.disabled = true;
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
      setStatus(`✓ 已${mode === 'create' ? '新建并切换' : '覆盖更新'}酒馆人设：${saved.name}`, 'ok', { toast: true });
    } catch (err) {
      setStatus(`保存人设失败：${err?.message || '宿主接口异常'}`, 'error');
    } finally {
      state.isSaving = false;
      saveOverwriteBtn.disabled = false;
      saveNewBtn.disabled = false;
    }
  }

  function exportNativePresetNow({
    includeTaste = true,
    includeUsageGuide = true,
    includeDraftAudit = state.draftAudit,
    presetName = '',
  } = {}) {
    const scheme = getActiveScheme(settings);
    const name = (presetName || `${scheme?.name || 'User人设工坊'}_ST原生预设`).trim();
    const presetObj = exportSillyTavernPreset({
      scheme,
      tasteProfile: settings.tasteProfile,
      presetName: name,
      includeTaste,
      includeUsageGuide,
      includeDraftAudit,
    });
    const safeFileName = `${name.replace(/[\\/:*?"<>|]/g, '_')}.json`;
    const jsonText = triggerJsonDownload(doc, win, safeFileName, presetObj);
    win?.navigator?.clipboard?.writeText?.(jsonText).catch(() => {});
    setStatus(`✓ 已导出酒馆原生预设 JSON：${safeFileName}`, 'ok', { toast: true });
    return presetObj;
  }

  // ==========================================================================
  // Event Wiring
  // ==========================================================================

  paletteSelect.addEventListener('change', () => {
    settings.palette = paletteSelect.value;
    applyTheme();
    persistSettings();
    const label = PALETTE_OPTIONS.find((p) => p.id === settings.palette)?.label || settings.palette;
    setStatus(`已切换主题配色：${label}`);
  }, { signal });

  syncHostBtn.addEventListener('click', () => {
    refreshContext({ manual: true });
  }, { signal });

  minimizeBtn.addEventListener('click', () => minimize(), { signal });
  closeBtn.addEventListener('click', () => close(), { signal });

  for (const [id, btn] of tabButtons.entries()) {
    btn.addEventListener('click', () => switchTab(id), { signal });
  }

  popoverBtn.addEventListener('click', () => {
    const willOpen = popoverEl.hidden;
    closeFloatingMenu();
    popoverEl.hidden = !willOpen;
    if (willOpen) {
      const r = popoverBtn.getBoundingClientRect?.() || { left: 20, right: 120, bottom: 120, top: 80 };
      const vw = Number(win?.innerWidth || 1280);
      const vh = Number(win?.innerHeight || 800);
      const pw = Math.min(320, vw - 20);
      const ph = popoverEl.offsetHeight || 240;
      const left = Math.max(10, Math.min(vw - pw - 10, r.right - pw));
      const top = r.bottom + ph + 10 > vh ? Math.max(10, r.top - ph - 6) : Math.max(10, r.bottom + 6);
      popoverEl.style.left = `${Math.round(left)}px`;
      popoverEl.style.top = `${Math.round(top)}px`;
    }
  }, { signal });

  injectCharCheckbox.addEventListener('change', () => {
    state.injectChar = injectCharCheckbox.checked;
    settings.ui.injectChar = state.injectChar;
    persistSettings();
  }, { signal });

  dualLayerCheckbox.addEventListener('change', () => {
    state.dualLayer = dualLayerCheckbox.checked;
    settings.ui.dualLayer = state.dualLayer;
    syncDraftRelatedViews();
    persistSettings();
  }, { signal });

  draftAuditCheckbox.addEventListener('change', () => {
    state.draftAudit = draftAuditCheckbox.checked;
    settings.ui.draftAudit = state.draftAudit;
    persistSettings();
  }, { signal });

  antiParrotCheckbox.addEventListener('change', () => {
    state.antiParrot = antiParrotCheckbox.checked;
    settings.ui.antiParrot = state.antiParrot;
    persistSettings();
  }, { signal });

  visibilityTagsCheckbox.addEventListener('change', () => {
    state.visibilityTags = visibilityTagsCheckbox.checked;
    settings.ui.visibilityTags = state.visibilityTags;
    syncDraftRelatedViews();
    persistSettings();
  }, { signal });

  narrowBothBtn.addEventListener('click', () => setNarrowPane('both'), { signal });
  narrowLeftBtn.addEventListener('click', () => setNarrowPane('left'), { signal });
  narrowRightBtn.addEventListener('click', () => setNarrowPane('right'), { signal });

  modeABtn.addEventListener('click', () => setMode('A'), { signal });
  modeBBtn.addEventListener('click', () => setMode('B'), { signal });

  subModeSelect.addEventListener('change', () => {
    state.subMode = subModeSelect.value;
    settings.ui.subMode = state.subMode;
    persistSettings();
  }, { signal });

  spotlightSelect.addEventListener('change', () => {
    state.spotlightMode = spotlightSelect.value;
    settings.ui.spotlightMode = state.spotlightMode;
    persistSettings();
    const picked = SPOTLIGHT_MODES.find((m) => m.id === state.spotlightMode);
    setStatus(`已切换元素与伏笔戏份：${picked?.label || state.spotlightMode}`);
  }, { signal });

  backstorySelect.addEventListener('change', () => {
    state.backstoryMode = backstorySelect.value;
    settings.ui.backstoryMode = state.backstoryMode;
    persistSettings();
    const picked = BACKSTORY_MODES.find((m) => m.id === state.backstoryMode);
    setStatus(`已切换过往经历塑造方式：${picked?.label || state.backstoryMode}`);
  }, { signal });

  schemeSelect.addEventListener('change', () => {
    settings.activeSchemeId = schemeSelect.value;
    if (state.mode === 'A' && settings.activeSchemeId !== 'persona_refactor') {
      state.lastCreateSchemeId = settings.activeSchemeId;
    }
    updateSchemeSelects();
    syncDraftRelatedViews();
    persistSettings();
    const active = getActiveScheme(settings);
    setStatus(`已切换方案：${active?.name || ''}（目标约 ${active?.targetChars || 1500} 字）`);
  }, { signal });

  function applyChosenTargetChars(rawChars) {
    const active = getActiveScheme(settings);
    if (!active) return;
    const nextScheme = applyTargetCharsToScheme(active, rawChars);
    settings.schemes = settings.schemes.map((s) => (s.id === active.id ? nextScheme : s));
    updateSchemeSelects();
    syncDraftRelatedViews();
    if (state.activeTab === 'presets') renderStackTab();
    persistSettings();
    const budget = computeLengthBudget(nextScheme.targetChars);
    setStatus(`已设目标字数：约 ${budget.chars} 字（约 ${budget.tokensApprox} tokens，生成规则已自动同步）`);
  }

  wordCountSelect.addEventListener('change', () => {
    const val = wordCountSelect.value;
    if (val === 'custom') {
      customCharsInput.hidden = false;
      const active = getActiveScheme(settings);
      customCharsInput.value = String(active?.targetChars || 1500);
      if (canAutoFocusDesktop(win)) {
        customCharsInput.focus?.();
        customCharsInput.select?.();
      }
      setStatus('请输入自定义目标汉字数（200～12000 字）');
      return;
    }
    customCharsInput.hidden = true;
    applyChosenTargetChars(Number(val) || 1500);
  }, { signal });

  customCharsInput.addEventListener('change', () => {
    const raw = customCharsInput.value.trim();
    if (!raw) {
      syncWordCountControls(getActiveScheme(settings));
      return;
    }
    applyChosenTargetChars(Number(raw) || 1500);
  }, { signal });

  generateABtn.addEventListener('click', () => executeGeneration(), { signal });
  generateBBtn.addEventListener('click', () => executeGeneration(), { signal });
  previewPromptABtn.addEventListener('click', showPromptPreview, { signal });
  previewPromptBBtn.addEventListener('click', showPromptPreview, { signal });
  regenSectionBtn.addEventListener('click', () => {
    const sec = sectionSelect.value || SHELL_SECTION_HEADER;
    executeGeneration({ targetSection: sec });
  }, { signal });

  // Always live-check host persona when cached description is empty!
  async function resolveSelectedOrActivePersona({ forceFresh = false } = {}) {
    if (!forceFresh) {
      const chosenId = personaPickerSelect.value;
      const picked =
        state.cachedPersonas.find((p) => p.avatarId === chosenId && String(p.description || '').trim()) ||
        (String(state.cachedActivePersona?.description || '').trim() ? state.cachedActivePersona : null);
      if (picked) return picked;
    }
    const [freshActive, freshList] = await Promise.all([
      hostApi.getActivePersona().catch(() => null),
      hostApi.listPersonas().catch(() => []),
    ]);
    if (Array.isArray(freshList) && freshList.length > 0) {
      state.cachedPersonas = freshList;
      personaPickerSelect.replaceChildren(
        ...freshList.map((p) =>
          createEl(doc, 'option', { value: p.avatarId, text: p.isActive ? `${p.name}（当前）` : p.name })
        )
      );
    }
    if (freshActive) {
      state.cachedActivePersona = freshActive;
      if (freshActive.avatarId) personaPickerSelect.value = freshActive.avatarId;
    }
    const chosenId = personaPickerSelect.value;
    return (
      state.cachedPersonas.find((p) => p.avatarId === chosenId && String(p.description || '').trim()) ||
      freshActive ||
      state.cachedPersonas.find((p) => String(p.description || '').trim()) ||
      null
    );
  }

  pickFromPersonaABtn.addEventListener('click', async () => {
    const picked = await resolveSelectedOrActivePersona({ forceFresh: true });
    const desc = String(picked?.description || existingDraftInput.value || draftTextarea.value || '').trim();
    if (!desc) {
      setStatus('未检测到当前酒馆人设内容：请先在酒馆「用户人设」面板填写或选中一个非空人设', 'warn');
      return;
    }
    const pts = populateExtractedPointsFromText(desc, { defaultMode: 'smart', scrollToBox: true });
    flashButtonFeedback(pickFromPersonaABtn, `✓ 已提取 ${pts.length} 条`);
    setStatus(`✓ 已从「${picked?.name || '当前人设'}」提取 ${pts.length} 条可勾选设定`, 'ok', { toast: true });
  }, { signal });

  loadPersonaBtn.addEventListener('click', () => {
    const applyLoaded = (picked) => {
      const desc = String(picked?.description || '');
      if (!desc.trim()) {
        setStatus(`人设「${picked?.name || '当前人设'}」的描述内容为空，可换选其他人设或直接粘贴原稿`, 'warn');
        return;
      }
      existingDraftInput.value = desc;
      state.baselineDraft = desc;
      state.tasteBaselineDraft = desc;
      setDraftValue(desc, { recordHistory: true });
      if (picked?.name) saveNameInput.value = picked.name;
      const pts = populateExtractedPointsFromText(desc, { defaultMode: 'smart', scrollToBox: false });
      flashButtonFeedback(loadPersonaBtn, '✓ 已载入');
      setStatus(`✓ 已载入「${picked?.name || '当前人设'}」，并提取 ${pts.length} 条可勾选保留项`, 'ok', { toast: true });
    };

    const chosenId = personaPickerSelect.value;
    const cachedPicked =
      state.cachedPersonas.find((p) => p.avatarId === chosenId && String(p.description || '').trim()) ||
      (String(state.cachedActivePersona?.description || '').trim() ? state.cachedActivePersona : null);

    if (cachedPicked) {
      applyLoaded(cachedPicked);
      return;
    }

    resolveSelectedOrActivePersona({ forceFresh: true })
      .then((fresh) => {
        if (state.isGenerating) return;
        if (!fresh) {
          setStatus('未检测到酒馆已有人设，请直接在下方粘贴旧人设原稿', 'warn');
          return;
        }
        applyLoaded(fresh);
      })
      .catch(() => {
        setStatus('读取酒馆人设失败，请稍后重试或直接粘贴文本', 'warn');
      });
  }, { signal });

  extractPointsBtn.addEventListener('click', () => {
    const src = existingDraftInput.value.trim() || draftTextarea.value.trim();
    if (!src) {
      setStatus('请先点击“载入人设”或粘贴旧人设文本后再提取可勾选项', 'warn');
      return;
    }
    const pts = populateExtractedPointsFromText(src, { defaultMode: 'smart', scrollToBox: true });
    flashButtonFeedback(extractPointsBtn, `✓ 已提取 ${pts.length} 条`);
    setStatus(pts.length ? `✓ 已提取 ${pts.length} 条设定供勾选保留` : '文本较短，可直接改写', 'ok', { toast: true });
  }, { signal });

  pointsSelectAllBtn.addEventListener('click', () => {
    state.selectedPointIds = new Set((state.extractedPoints || []).map((p) => p.id));
    renderExtractedPoints();
    setStatus('已全选全部原人设条目');
  }, { signal });

  pointsSelectCoreBtn.addEventListener('click', () => {
    state.selectedPointIds = new Set(
      (state.extractedPoints || []).filter((p) => p.keepByDefault).map((p) => p.id)
    );
    renderExtractedPoints();
    setStatus('已勾选外貌、性格与习惯条目（排除当前卡身份）');
  }, { signal });

  pointsClearBtn.addEventListener('click', () => {
    state.selectedPointIds.clear();
    renderExtractedPoints();
    setStatus('已清空勾选保留项');
  }, { signal });

  flattenBtn.addEventListener('click', () => {
    const flattened = normalizeFlatLayout(draftTextarea.value);
    setDraftValue(flattened, { recordHistory: true });
    flashButtonFeedback(flattenBtn, '✓ 已清理');
    setStatus('✓ 已清理多余缩进与格式标签', 'ok');
  }, { signal });

  function readDraftSelectionFromControl() {
    const val = String(draftTextarea.value ?? '');
    const start = Number(draftTextarea.selectionStart);
    const end = Number(draftTextarea.selectionEnd);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
    const raw = val.slice(start, end);
    const cleaned = raw
      .replace(/^\s*(?:[-*•]\s*)?(?:\[[^\]]+\]\s*)?/, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleaned.length < 2) return null;
    return { raw, text: cleaned, start, end };
  }

  function syncSelectionBar() {
    const sel = state.draftSelection;
    const hasSel = Boolean(sel?.text);
    selectionTasteBar.classList.toggle('has-selection', hasSel);
    selectionTasteBar.classList.toggle('is-pinned-open', Boolean(state.pinSelectionDrawer));
    deleteSelectedBtn.hidden = !hasSel;
    clearSelectedBtn.hidden = !hasSel;
    pinSelectionBarBtn.textContent = state.pinSelectionDrawer ? '收起标记栏' : '展开标记栏';
    pinSelectionBarBtn.classList.toggle('is-active', Boolean(state.pinSelectionDrawer));
    if (hasSel) {
      const shortText = sel.text.length > 34 ? `${sel.text.slice(0, 34)}…` : sel.text;
      selectionSnippetEl.textContent = `已框选：「${shortText}」—— 点选喜欢或为什么不喜欢：`;
    } else {
      selectionSnippetEl.textContent = '拖选上方任意词句，自动展开「喜欢 / 为什么不喜欢」快捷按钮';
    }
  }

  function captureDraftSelection({ clearIfCollapsed = false } = {}) {
    const live = readDraftSelectionFromControl();
    if (live) {
      state.draftSelection = live;
      syncSelectionBar();
    } else if (clearIfCollapsed && state.draftSelection) {
      state.draftSelection = null;
      syncSelectionBar();
    }
  }

  function resolvePhraseForQuickTaste() {
    const live = readDraftSelectionFromControl() || state.draftSelection;
    if (live?.text) return { text: live.text, fromSelection: true };
    const line = getTextareaCurrentLine(draftTextarea)
      .replace(/^\s*(?:[-*•]\s*)?(?:\[[^\]]+\]\s*)?/, '')
      .trim();
    if (line.length >= 2) return { text: line, fromSelection: false };
    return null;
  }

  function recordQuickTastePreference(kind, { label, reason }, triggerBtn) {
    const resolved = resolvePhraseForQuickTaste();
    if (!resolved) {
      setStatus('请先在成稿框中拖选词句（或把光标停在对应句子上）再点按钮', 'warn');
      return;
    }
    const targetField = kind === 'anchors' ? 'anchors' : 'banned';
    const noteText = String(reason || label || '').trim() || (kind === 'anchors' ? '框选标记喜欢' : '框选标记不喜欢');
    settings.tasteProfile[targetField] = mergeTasteEntries(settings.tasteProfile[targetField], [
      { text: resolved.text, note: noteText },
    ]);
    const hit = settings.tasteProfile[targetField].find((x) => x.text === resolved.text);
    if (hit) state.justAddedTasteId = hit.id;
    renderTasteTab();
    syncDraftRelatedViews();
    persistSettings();
    if (triggerBtn) {
      flashButtonFeedback(triggerBtn, '✓ 已记入');
    }
    const preview = resolved.text.length > 22 ? `${resolved.text.slice(0, 22)}…` : resolved.text;
    setStatus(
      kind === 'anchors'
        ? `✓ 已记入喜欢（${label}）：「${preview}」`
        : `✓ 已记入不喜欢（${label}）：「${preview}」—— 下次生成自动避开`,
      'ok',
      { toast: true }
    );
  }

  for (const btn of [
    ...likePresetBtns,
    ...dislikePresetBtns,
    deleteSelectedBtn,
    clearSelectedBtn,
    pinSelectionBarBtn,
    toggleCustomReasonBtn,
  ]) {
    btn.addEventListener('mousedown', (ev) => ev.preventDefault(), { signal });
  }

  pinSelectionBarBtn.addEventListener('click', () => {
    state.pinSelectionDrawer = !state.pinSelectionDrawer;
    syncSelectionBar();
  }, { signal });

  for (const btn of likePresetBtns) {
    btn.addEventListener('click', () => {
      recordQuickTastePreference('anchors', btn._upsPreset, btn);
    }, { signal });
  }

  for (const btn of dislikePresetBtns) {
    btn.addEventListener('click', () => {
      recordQuickTastePreference('banned', btn._upsPreset, btn);
    }, { signal });
  }

  toggleCustomReasonBtn.addEventListener('click', () => {
    state.showCustomReasonRow = !state.showCustomReasonRow;
    customReasonRowEl.hidden = !state.showCustomReasonRow;
    toggleCustomReasonBtn.classList.toggle('is-active', state.showCustomReasonRow);
    if (state.showCustomReasonRow && canAutoFocusDesktop(win)) {
      customReasonInput.focus?.();
    }
  }, { signal });

  applyCustomDislikeBtn.addEventListener('click', () => {
    const customNote = customReasonInput.value.trim() || '自定义原因不喜欢';
    recordQuickTastePreference('banned', { label: customNote, reason: customNote }, applyCustomDislikeBtn);
    customReasonInput.value = '';
  }, { signal });

  applyCustomLikeBtn.addEventListener('click', () => {
    const customNote = customReasonInput.value.trim() || '自定义原因喜欢';
    recordQuickTastePreference('anchors', { label: customNote, reason: customNote }, applyCustomLikeBtn);
    customReasonInput.value = '';
  }, { signal });

  clearSelectedBtn.addEventListener('click', () => {
    state.draftSelection = null;
    try {
      const pos = Number(draftTextarea.selectionEnd) || 0;
      draftTextarea.selectionStart = pos;
      draftTextarea.selectionEnd = pos;
    } catch {
      // ignore mock readonly properties
    }
    syncSelectionBar();
    setStatus('已取消词句框选');
  }, { signal });

  deleteSelectedBtn.addEventListener('click', () => {
    const sel = readDraftSelectionFromControl() || state.draftSelection;
    if (!sel) return;
    const curVal = String(draftTextarea.value ?? '');
    const before = curVal.slice(0, sel.start);
    const after = curVal.slice(sel.end);
    const merged = `${before}${after}`.replace(/\n{3,}/g, '\n\n');
    state.draftSelection = null;
    setDraftValue(merged, { recordHistory: true });
    syncSelectionBar();
    setStatus('✓ 已从正文中删去所选词句（可点底部“撤销”还原）', 'ok');
  }, { signal });

  draftTextarea.addEventListener('select', () => captureDraftSelection({ clearIfCollapsed: false }), { signal });
  draftTextarea.addEventListener('mouseup', () => captureDraftSelection({ clearIfCollapsed: true }), { signal });
  draftTextarea.addEventListener('keyup', () => captureDraftSelection({ clearIfCollapsed: true }), { signal });
  draftTextarea.addEventListener('touchend', () => captureDraftSelection({ clearIfCollapsed: false }), { signal });

  draftTextarea.addEventListener('input', () => {
    state.draftSelection = null;
    syncSelectionBar();
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

  async function runAiTasteDistillation() {
    const anchorsCount = (settings.tasteProfile.anchors || []).length;
    const bannedCount = (settings.tasteProfile.banned || []).length;
    if (anchorsCount + bannedCount === 0) {
      setStatus('个人偏好词库暂无记录；先在成稿框拖选词句标记喜好，积累后再按需用 AI 归纳', 'warn');
      return;
    }
    if (state.isDistillingTaste) {
      state.distillAbort?.abort();
      return;
    }
    const ac = new AbortController();
    state.isDistillingTaste = true;
    state.distillAbort = ac;
    aiDistillTasteBtn.textContent = '停止归纳';
    setStatus('正在调用 AI 归纳合并偏好词库…');

    try {
      const messages = buildTasteSummaryMessages(settings.tasteProfile);
      const res = await hostApi.runStudioGeneration({
        settings,
        messages,
        signal: ac.signal,
      });
      const parsed = parseTasteSummaryOutput(res.text || '');
      if (parsed.anchors.length + parsed.banned.length === 0) {
        setStatus('AI 未返回可识别的归纳条目，已保留原记录不变', 'warn');
        return;
      }

      const cbs = [];
      const rowNodes = [
        createEl(doc, 'div', {
          className: 'ups-muted',
          text: '勾选满意的精简规则，可追加到词库或替换原本零散的原句记录：',
        }),
      ];

      for (const item of parsed.anchors) {
        const cb = createEl(doc, 'input', { type: 'checkbox', checked: true });
        cb._kind = 'anchors';
        cb._item = item;
        cbs.push(cb);
        rowNodes.push(
          createEl(doc, 'label', { className: 'ups-check-row' }, [
            cb,
            createEl(doc, 'span', { className: 'ups-badge ups-badge-ok', text: '喜欢方向' }),
            createEl(doc, 'span', { text: item.text }),
          ])
        );
      }
      for (const item of parsed.banned) {
        const cb = createEl(doc, 'input', { type: 'checkbox', checked: true });
        cb._kind = 'banned';
        cb._item = item;
        cbs.push(cb);
        rowNodes.push(
          createEl(doc, 'label', { className: 'ups-check-row' }, [
            cb,
            createEl(doc, 'span', { className: 'ups-badge ups-badge-warn', text: '避雷规则' }),
            createEl(doc, 'span', { text: item.text }),
          ])
        );
      }

      const applyDistilled = (replaceExisting) => {
        const pickedAnchors = cbs.filter((c) => c.checked && c._kind === 'anchors').map((c) => c._item);
        const pickedBanned = cbs.filter((c) => c.checked && c._kind === 'banned').map((c) => c._item);
        if (replaceExisting) {
          if (pickedAnchors.length > 0) settings.tasteProfile.anchors = mergeTasteEntries([], pickedAnchors);
          if (pickedBanned.length > 0) settings.tasteProfile.banned = mergeTasteEntries([], pickedBanned);
        } else {
          settings.tasteProfile.anchors = mergeTasteEntries(settings.tasteProfile.anchors, pickedAnchors);
          settings.tasteProfile.banned = mergeTasteEntries(settings.tasteProfile.banned, pickedBanned);
        }
        renderTasteTab();
        syncDraftRelatedViews();
        persistSettings();
        closeSubmodal();
        setStatus(
          replaceExisting
            ? `✓ 已用 AI 归纳结果精简更新偏好词库（${pickedAnchors.length + pickedBanned.length} 条）`
            : `✓ 已将 ${pickedAnchors.length + pickedBanned.length} 条 AI 归纳规则追加至偏好词库`,
          'ok',
          { toast: true }
        );
      };

      const cancelDistillBtn = createEl(doc, 'button', { type: 'button', className: 'ups-btn-ghost', text: '取消' });
      cancelDistillBtn.addEventListener('click', closeSubmodal);
      const appendDistillBtn = createEl(doc, 'button', {
        type: 'button',
        className: 'ups-btn',
        text: '追加到词库',
        attrs: { 'data-ups-distill-append': 'true' },
      });
      appendDistillBtn.addEventListener('click', () => applyDistilled(false));
      const replaceDistillBtn = createEl(doc, 'button', {
        type: 'button',
        className: 'ups-btn ups-btn-primary',
        text: '替换零散记录',
        attrs: { 'data-ups-distill-replace': 'true' },
      });
      replaceDistillBtn.addEventListener('click', () => applyDistilled(true));

      openSubmodal({
        title: `AI 偏好归纳预览（共提炼 ${parsed.anchors.length + parsed.banned.length} 条）`,
        bodyNodes: rowNodes,
        footerNodes: [cancelDistillBtn, appendDistillBtn, replaceDistillBtn],
      });
      setStatus(`✓ AI 已提炼 ${parsed.anchors.length + parsed.banned.length} 条偏好规则，请确认保存方式`, 'ok');
    } catch (err) {
      if (ac.signal.aborted || err?.code === 'ABORTED' || err?.name === 'AbortError') {
        setStatus('已取消 AI 偏好归纳');
      } else {
        setStatus(`AI 归纳失败：${err?.message || '日常框选标记无需 AI 即可直接生效'}`, 'warn');
      }
    } finally {
      if (state.distillAbort === ac) {
        state.isDistillingTaste = false;
        state.distillAbort = null;
        aiDistillTasteBtn.textContent = 'AI 归纳提炼（可选）';
      }
    }
  }

  extractTasteBtn.addEventListener('click', runTasteCandidateExtraction, { signal });
  confirmTasteBtn.addEventListener('click', confirmTasteCandidates, { signal });

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
      setStatus(`✓ 已保存 ${res.entryCount} 条补充世界书到「${res.worldName}」`, 'ok', { toast: true });
    } catch (err) {
      setStatus(`保存世界书失败：${err?.message || '宿主接口异常'}`, 'error');
    }
  }, { signal });

  saveOverwriteBtn.addEventListener('click', () => saveCurrentPersona('overwrite'), { signal });
  saveNewBtn.addEventListener('click', () => saveCurrentPersona('create'), { signal });

  // Footer controls
  undoBtn.addEventListener('click', () => {
    setDraftValue(draftHistory.undo(), { recordHistory: false });
    setStatus('已撤销上一步修改');
  }, { signal });
  redoBtn.addEventListener('click', () => {
    setDraftValue(draftHistory.redo(), { recordHistory: false });
    setStatus('已重做修改');
  }, { signal });
  copyBtn.addEventListener('click', () => {
    win?.navigator?.clipboard?.writeText?.(draftTextarea.value || '').catch(() => {});
    flashButtonFeedback(copyBtn, '✓ 已复制');
    setStatus('✓ 已复制当前人设正文', 'ok');
  }, { signal });

  // Tab 2 controls
  exportPresetBtn.addEventListener('click', () => {
    exportNativePresetNow();
    flashButtonFeedback(exportPresetBtn, '✓ 已导出');
  }, { signal });

  exportDraftRegexBtn.addEventListener('click', () => {
    const active = getActiveScheme(settings);
    const regexObj = exportDraftStripRegexScript(active?.name || 'User人设工坊');
    triggerJsonDownload(doc, win, 'regex-隐藏人设构思自检草稿.json', regexObj);
    flashButtonFeedback(exportDraftRegexBtn, '✓ 已导出');
    setStatus('✓ 已导出酒馆隐藏草稿正则脚本 JSON', 'ok', { toast: true });
  }, { signal });

  stackSchemeSelect.addEventListener('change', () => {
    settings.activeSchemeId = stackSchemeSelect.value;
    renderStackTab();
    syncDraftRelatedViews();
    persistSettings();
    setStatus(`已切换编辑方案：${getActiveScheme(settings)?.name || ''}`);
  }, { signal });

  schemeFavBtn.addEventListener('click', () => {
    settings = toggleFavoriteScheme(settings, settings.activeSchemeId);
    updateSchemeSelects();
    persistSettings();
    const active = getActiveScheme(settings);
    setStatus(active?.favorite ? `✓ 已置顶方案：${active.name}` : `已取消置顶：${active?.name || ''}`, 'ok');
  }, { signal });

  schemeResetBtn.addEventListener('click', () => {
    const active = getActiveScheme(settings);
    if (!active?.builtin) return;
    settings = resetBuiltinScheme(settings, active.id);
    state.expandedEntryIds.clear();
    renderStackTab();
    syncDraftRelatedViews();
    persistSettings();
    flashButtonFeedback(schemeResetBtn, '✓ 已还原');
    setStatus(`✓ 已将「${getActiveScheme(settings)?.name}」还原为出厂默认规则`, 'ok', { toast: true });
  }, { signal });

  schemeSaveAsBtn.addEventListener('click', () => {
    try {
      const name = schemeNameInput.value.trim() || `${getActiveScheme(settings)?.name || '方案'} 副本`;
      settings = saveSchemeAs(settings, settings.activeSchemeId, name, { autoSuffix: true });
      schemeNameInput.value = '';
      renderStackTab();
      persistSettings();
      flashButtonFeedback(schemeSaveAsBtn, '✓ 已另存');
      setStatus(`✓ 已另存为新方案：${getActiveScheme(settings)?.name}`, 'ok', { toast: true });
    } catch (err) {
      setStatus(err.message, 'warn');
    }
  }, { signal });

  schemeRenameBtn.addEventListener('click', () => {
    try {
      const name = schemeNameInput.value.trim();
      if (!name) {
        setStatus('请先在左侧输入框填写新方案名称', 'warn');
        return;
      }
      settings = renameScheme(settings, settings.activeSchemeId, name);
      schemeNameInput.value = '';
      renderStackTab();
      persistSettings();
      flashButtonFeedback(schemeRenameBtn, '✓ 已改名');
      setStatus(`✓ 已重命名方案为：${name}`, 'ok');
    } catch (err) {
      setStatus(err.message, 'warn');
    }
  }, { signal });

  schemeDeleteBtn.addEventListener('click', () => {
    const prevName = getActiveScheme(settings)?.name || '';
    settings = deleteScheme(settings, settings.activeSchemeId);
    renderStackTab();
    persistSettings();
    setStatus(`已删除自定义方案：${prevName}`);
  }, { signal });

  tailModeSelect.addEventListener('change', () => {
    const active = getActiveScheme(settings);
    if (!active) return;
    active.tailMode = tailModeSelect.value;
    updateSchemeSelects();
    persistSettings();
    setStatus('已更新收尾兼容策略');
  }, { signal });

  prefillInput.addEventListener('change', () => {
    const active = getActiveScheme(settings);
    if (!active) return;
    active.prefillText = prefillInput.value;
    updateSchemeSelects();
    persistSettings();
  }, { signal });

  triggerInput.addEventListener('change', () => {
    const active = getActiveScheme(settings);
    if (!active) return;
    active.triggerText = triggerInput.value;
    updateSchemeSelects();
    persistSettings();
  }, { signal });

  schemeTempInput.addEventListener('change', () => {
    const active = getActiveScheme(settings);
    if (!active) return;
    const raw = schemeTempInput.value.trim();
    if (raw === '') {
      schemeTempInput.value = String(active.temperature ?? 0.78);
      return;
    }
    const v = Number(raw);
    if (Number.isFinite(v)) {
      const clamped = Math.max(0, Math.min(2, v));
      active.temperature = clamped;
      schemeTempInput.value = String(clamped);
    } else {
      schemeTempInput.value = String(active.temperature ?? 0.78);
      return;
    }
    updateSchemeSelects();
    persistSettings();
  }, { signal });

  schemeMaxTokensInput.addEventListener('change', () => {
    const active = getActiveScheme(settings);
    if (!active) return;
    const raw = schemeMaxTokensInput.value.trim();
    if (raw === '') {
      schemeMaxTokensInput.value = String(active.maxTokens ?? 3300);
      return;
    }
    const v = Math.round(Number(raw));
    if (Number.isFinite(v)) {
      const clamped = Math.max(256, Math.min(32768, v));
      active.maxTokens = clamped;
      schemeMaxTokensInput.value = String(clamped);
    } else {
      schemeMaxTokensInput.value = String(active.maxTokens ?? 3300);
      return;
    }
    updateSchemeSelects();
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
    const hadFilter = Boolean(state.stackSearchQuery.trim());
    if (hadFilter) {
      state.stackSearchQuery = '';
      stackSearchInput.value = '';
    }
    const nextScheme = addCustomStackEntry(active, {
      name: '自定义补充规则',
      role: 'system',
      slotType: 'custom',
      content: '在此填写你想补充的写作要求或人物细节规则。',
    });
    settings.schemes = settings.schemes.map((s) => (s.id === active.id ? nextScheme : s));
    const added = nextScheme.entries[nextScheme.entries.length - 1];
    if (added) {
      state.expandedEntryIds.add(added.id);
      state.justAddedEntryId = added.id;
    }
    renderStackTab();
    persistSettings();
    flashButtonFeedback(addStackEntryBtn, '✓ 已新增');
    setStatus(
      hadFilter ? '✓ 已清空搜索遮挡，新增规则条目并自动跳转展开' : '✓ 已新增规则条目并自动跳转展开',
      'ok'
    );
  }, { signal });

  exportPresetModalBtn.addEventListener('click', () => {
    const active = getActiveScheme(settings);
    const nameIn = createEl(doc, 'input', {
      type: 'text',
      className: 'ups-input',
      value: `${active?.name || 'User人设工坊'}_ST原生预设`,
    });
    const incTasteCb = createEl(doc, 'input', { type: 'checkbox', checked: true });
    const incDraftCb = createEl(doc, 'input', { type: 'checkbox', checked: state.draftAudit });
    const incGuideCb = createEl(doc, 'input', { type: 'checkbox', checked: true });
    const confirmExpBtn = createEl(doc, 'button', { type: 'button', className: 'ups-btn ups-btn-primary', text: '下载原生预设 JSON' });
    confirmExpBtn.addEventListener('click', () => {
      exportNativePresetNow({
        presetName: nameIn.value.trim(),
        includeTaste: incTasteCb.checked,
        includeDraftAudit: incDraftCb.checked,
        includeUsageGuide: incGuideCb.checked,
      });
      closeSubmodal();
    });
    const cancelExpBtn = createEl(doc, 'button', { type: 'button', className: 'ups-btn-ghost', text: '取消' });
    cancelExpBtn.addEventListener('click', closeSubmodal);
    openSubmodal({
      title: '自定义导出酒馆原生预设（OpenAI Chat Completion）',
      bodyNodes: [
        createEl(doc, 'div', { className: 'ups-field' }, [
          createEl(doc, 'label', { className: 'ups-label', text: '预设名称' }),
          nameIn,
        ]),
        createEl(doc, 'label', { className: 'ups-check-row' }, [
          incTasteCb,
          createEl(doc, 'span', { text: '注入个人喜好与当前禁词策略' }),
        ]),
        createEl(doc, 'label', { className: 'ups-check-row' }, [
          incDraftCb,
          createEl(doc, 'span', { text: '附带【草稿自检净化】条目（配合隐藏正则使用更佳）' }),
        ]),
        createEl(doc, 'label', { className: 'ups-check-row' }, [
          incGuideCb,
          createEl(doc, 'span', { text: '附带默认关闭的使用指引条目' }),
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

  bannedSendModeSelect.addEventListener('change', () => {
    settings.tasteProfile.bannedSendMode = bannedSendModeSelect.value;
    persistSettings();
    const labels = {
      smart_compact: '精简核心 + 我的禁写（省 Token）',
      personal_only: '仅发我标记的禁写（最省 Token）',
      full: '完整发送启用词包',
    };
    setStatus(`✓ 已切换禁词发送策略：${labels[bannedSendModeSelect.value] || bannedSendModeSelect.value}`, 'ok');
  }, { signal });

  dedupTasteBtn.addEventListener('click', () => {
    const beforeCount =
      (settings.tasteProfile.anchors || []).length + (settings.tasteProfile.banned || []).length;
    settings.tasteProfile.anchors = mergeTasteEntries(settings.tasteProfile.anchors, []);
    settings.tasteProfile.banned = mergeTasteEntries(settings.tasteProfile.banned, []);
    const afterCount =
      (settings.tasteProfile.anchors || []).length + (settings.tasteProfile.banned || []).length;
    renderTasteTab();
    persistSettings();
    flashButtonFeedback(dedupTasteBtn, '✓ 已整理');
    setStatus(
      beforeCount === afterCount
        ? `✓ 已检查全部 ${afterCount} 条偏好记录，无重复项`
        : `✓ 已合并清理 ${beforeCount - afterCount} 条重复偏好记录`,
      'ok',
      { toast: true }
    );
  }, { signal });

  aiDistillTasteBtn.addEventListener('click', () => runAiTasteDistillation(), { signal });

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
    if (!val) {
      setStatus('请先输入想添加的喜好细节', 'warn');
      return;
    }
    if (state.tasteSearchQuery.trim()) {
      state.tasteSearchQuery = '';
      tasteSearchInput.value = '';
    }
    settings.tasteProfile.anchors = mergeTasteEntries(settings.tasteProfile.anchors, [
      { text: val, note: '手动添加' },
    ]);
    const matched = settings.tasteProfile.anchors.find((x) => x.text === val);
    if (matched) state.justAddedTasteId = matched.id;
    addAnchorInput.value = '';
    renderTasteTab();
    persistSettings();
    flashButtonFeedback(addAnchorBtn, '✓ 已添加');
    setStatus(`✓ 已添加喜好细节：${val.slice(0, 20)}`, 'ok');
  }, { signal });

  addBannedBtn.addEventListener('click', () => {
    const val = addBannedInput.value.trim();
    if (!val) {
      setStatus('请先输入想屏蔽的禁写词句', 'warn');
      return;
    }
    if (state.tasteSearchQuery.trim()) {
      state.tasteSearchQuery = '';
      tasteSearchInput.value = '';
    }
    settings.tasteProfile.banned = mergeTasteEntries(settings.tasteProfile.banned, [
      { text: val, note: '手动添加' },
    ]);
    const matched = settings.tasteProfile.banned.find((x) => x.text === val);
    if (matched) state.justAddedTasteId = matched.id;
    addBannedInput.value = '';
    renderTasteTab();
    syncDraftRelatedViews();
    persistSettings();
    flashButtonFeedback(addBannedBtn, '✓ 已添加');
    setStatus(`✓ 已添加禁写词句：${val.slice(0, 20)}`, 'ok');
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
      flashButtonFeedback(profileCreateBtn, '✓ 已新建');
      setStatus(`✓ 已新建 API 方案：${created.name}`, 'ok');
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
    flashButtonFeedback(profileRenameBtn, '✓ 已改名');
    setStatus(`✓ 已重命名方案为：${nextName}`, 'ok');
  }, { signal });

  profileDeleteBtn.addEventListener('click', () => {
    const active = getActiveCustomProfile(settings);
    if (!active) return;
    state.pendingDeleteProfileId = active.id;
    renderSettingsTab();
    setStatus(`请点击“确认删除”以移除方案「${active.name}」`, 'warn');
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
      setStatus(`✓ 已拉取 ${models.length} 个模型`, 'ok', { toast: true });
    } catch (err) {
      if (ac.signal.aborted || state.fetchModelsAbort !== ac || err?.code === 'ABORTED' || err?.name === 'AbortError') return;
      const rawErr = err?.message || '请求失败';
      const safeErr = active.apiKey ? scrubApiKeyFromText(rawErr, active.apiKey) : rawErr;
      connStatusEl.textContent = `拉取失败：${safeErr}`;
      setStatus(connStatusEl.textContent, 'error');
    } finally {
      if (state.fetchModelsAbort === ac) state.fetchModelsAbort = null;
    }
  }, { signal });

  testConnBtn.addEventListener('click', async () => {
    const active = getActiveCustomProfile(settings);
    if (!active) {
      connStatusEl.textContent = '请先新建并填写自定义 API 方案';
      setStatus(connStatusEl.textContent, 'warn');
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
        setStatus(connStatusEl.textContent, 'error');
        return;
      }
      const safeMsg = scrubApiKeyFromText(res.message || '', active.apiKey || '');
      connStatusEl.textContent = res.ok
        ? `连接正常（${res.latencyMs ?? 0}ms · ${res.modelCount ?? 0} 个模型）`
        : `连接异常：${safeMsg}`;
      setStatus(connStatusEl.textContent, res.ok ? 'ok' : 'error', { toast: true });
    } catch (err) {
      if (ac.signal.aborted || state.testConnAbort !== ac || err?.code === 'ABORTED' || err?.name === 'AbortError') return;
      const rawErr = err?.message || '请求失败';
      const safeErr = scrubApiKeyFromText(rawErr, active.apiKey || '');
      connStatusEl.textContent = `连接异常：${safeErr}`;
      setStatus(connStatusEl.textContent, 'error');
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
    flashButtonFeedback(exportSafeBackupBtn, '✓ 已导出');
    setStatus('✓ 已导出脱敏安全配置备份', 'ok', { toast: true });
  }, { signal });

  // ==========================================================================
  // Unified PointerEvent Drag & 8-Way Invisible Edge/Corner Resize (Gate 1)
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
      state.hasUserPlacedWindow = true;
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
  for (const rz of resizeZones) {
    const dir = rz.getAttribute('data-ups-resize-dir') || 'se';
    rz.addEventListener('pointerdown', (ev) => {
      if (ev.button !== undefined && ev.button !== 0) return;
      ev.preventDefault?.();
      ev.stopPropagation?.();
      popoverEl.hidden = true;
      closeFloatingMenu();
      const r = modalEl.getBoundingClientRect();
      // Lock exact current left/top BEFORE resizing so modal never jumps back to center/top!
      applyRectToModal({
        left: Math.round(r.left),
        top: Math.round(r.top),
        width: Math.round(r.width),
        height: Math.round(r.height),
      });
      resizeSession = {
        pointerId: ev.pointerId,
        handle: dir,
        startX: ev.clientX,
        startY: ev.clientY,
        origLeft: Math.round(r.left),
        origTop: Math.round(r.top),
        origWidth: Math.round(r.width),
        origHeight: Math.round(r.height),
      };
      modalEl.classList.add('is-resizing');
      try {
        rz.setPointerCapture?.(ev.pointerId);
      } catch {
        // ignore
      }
    }, { signal });

    rz.addEventListener('pointermove', (ev) => {
      if (!resizeSession || ev.pointerId !== resizeSession.pointerId) return;
      const nextRect = computeResizedModalRect({
        origLeft: resizeSession.origLeft,
        origTop: resizeSession.origTop,
        origWidth: resizeSession.origWidth,
        origHeight: resizeSession.origHeight,
        dx: ev.clientX - resizeSession.startX,
        dy: ev.clientY - resizeSession.startY,
        handle: resizeSession.handle,
        viewportWidth: win?.innerWidth || 1280,
        viewportHeight: win?.innerHeight || 800,
      });
      applyRectToModal(nextRect);
    }, { signal });

    const endResize = (ev) => {
      if (!resizeSession || ev.pointerId !== resizeSession.pointerId) return;
      try {
        rz.releasePointerCapture?.(ev.pointerId);
      } catch {
        // ignore
      }
      resizeSession = null;
      modalEl.classList.remove('is-resizing');
      if (!state.miniMode) {
        const r = modalEl.getBoundingClientRect();
        state.hasUserPlacedWindow = true;
        settings.ui.geometry = {
          x: Math.round(r.left),
          y: Math.round(r.top),
          width: Math.round(r.width),
          height: Math.round(r.height),
        };
        persistSettings();
      }
    };
    rz.addEventListener('pointerup', endResize, { signal });
    rz.addEventListener('pointercancel', endResize, { signal });
  }

  // Minimized pill restore
  pillEl.addEventListener('click', () => restore(), { signal });

  // Gate 7: Capture-phase outside click/focus dismissal (dismisses floating popovers/menus even when clicking host ST selectors!)
  const dismissFloatingIfOutside = (ev) => {
    if (popoverEl.hidden && floatingMenuEl.hidden) return;
    const path = typeof ev.composedPath === 'function' ? ev.composedPath() : [ev.target];
    const insideNode = (container) =>
      path.includes(container) || (ev.target && container.contains?.(ev.target));

    if (!popoverEl.hidden && !insideNode(popoverEl) && !insideNode(popoverBtn)) {
      popoverEl.hidden = true;
    }
    if (
      !floatingMenuEl.hidden &&
      !insideNode(floatingMenuEl) &&
      !path.some((n) => n?.classList?.contains?.('ups-more-btn')) &&
      !ev.target?.closest?.('.ups-more-btn')
    ) {
      closeFloatingMenu();
    }
  };
  doc.addEventListener('mousedown', dismissFloatingIfOutside, { capture: true, signal });
  doc.addEventListener('touchstart', dismissFloatingIfOutside, { capture: true, passive: true, signal });
  doc.addEventListener('focusin', dismissFloatingIfOutside, { capture: true, signal });
  modalEl.addEventListener('click', dismissFloatingIfOutside, { signal });

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
            marginX: 0,
            marginTop: 0,
            marginBottom: 0,
            allowFullViewport: true,
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
        applyRectToModal(computeMiniWindowRect({ viewportWidth: vw, viewportHeight: vh }));
      } else if (vw <= 640) {
        modalEl.classList.remove('is-mini');
        clearFloatingRectOnModal();
      } else if (state.hasUserPlacedWindow && settings.ui.geometry?.x !== null && settings.ui.geometry?.y !== null) {
        modalEl.classList.remove('is-mini');
        applyRectToModal(
          clampModalRect({
            left: settings.ui.geometry.x,
            top: settings.ui.geometry.y,
            width: settings.ui.geometry.width,
            height: settings.ui.geometry.height,
            viewportWidth: vw,
            viewportHeight: vh,
            marginX: 0,
            marginTop: 0,
            marginBottom: 0,
            allowFullViewport: true,
          })
        );
      } else {
        modalEl.classList.remove('is-mini');
        clearFloatingRectOnModal();
      }
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

  // Programmatic mini-mode API preserved for unit tests & external callers (no topbar button!)
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
      applyRectToModal(computeMiniWindowRect({ viewportWidth: vw, viewportHeight: vh }));
    } else {
      state.miniMode = false;
      settings.ui.miniMode = false;
      modalEl.classList.remove('is-mini');
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
    state.hasUserPlacedWindow = Boolean(nextSettings?.ui?.geometry);
    modalEl.classList.toggle('is-mini', state.miniMode);
    paletteSelect.value = settings.palette;
    spotlightSelect.value = settings.ui.spotlightMode || 'balanced';
    backstorySelect.value = settings.ui.backstoryMode || 'light_vibe';
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
      } else if (state.hasUserPlacedWindow && settings.ui.geometry?.x !== null && settings.ui.geometry?.y !== null) {
        applyRectToModal(
          clampModalRect({
            left: settings.ui.geometry.x,
            top: settings.ui.geometry.y,
            width: settings.ui.geometry.width,
            height: settings.ui.geometry.height,
            viewportWidth: vw,
            viewportHeight: vh,
            marginX: 0,
            marginTop: 0,
            marginBottom: 0,
            allowFullViewport: true,
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
    if (state.toastTimer) {
      clearTimeout(state.toastTimer);
      state.toastTimer = null;
    }
    state.genAbort?.abort();
    state.distillAbort?.abort();
    state.distillAbort = null;
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
