import {
  CORE_SECTION_HEADER,
  SHELL_SECTION_HEADER,
  WORD_COUNT_PRESETS,
  SPOTLIGHT_MODES,
  BACKSTORY_MODES,
  VIBE_ANCHOR_EXAMPLES,
  COMMON_PERSONA_LEXICON_CATEGORIES,
  COMPANION_CARRY_MODES,
  WORLDBOOK_LIGHT_MODES,
  COMPANION_FREQUENCY_TIERS,
  COMPANION_RELATION_PRESETS,
  GENERATION_LAYOUT_STYLES,
  GENERATION_SECTION_GROUPS,
  GENERATION_SECTION_PRESETS,
  MODULE_RATIO_KEYS,
  DEFAULT_MUST_HAVE_TEMPLATES,
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
  groupPersonaPoints,
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
  pushGenerationHistory,
  resolveCharacterRealName,
  classifyWorldbookEntry,
  detectMultiCharacterCard,
  computeCompanionTokenPlan,
  buildCompanionWorldbookEntries,
  normalizeModuleRatios,
  normalizeGenerationSectionsConfig,
  resolvePresetEntryPreview,
  buildSyncedPreferenceEntries,
} from './core.js';
import {
  getActivePersona,
  listPersonas,
  listCharacters,
  listWorldbooks,
  getCharacterContext,
  getActiveCharacterContext,
  loadCharacterWorldbookEntries,
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
const HISTORY_STORAGE_KEY = 'ups_generation_history_v1';

// ============================================================================
// Pure Geometry & Draft History Helpers (Node-testable)
// ============================================================================

function getSafeViewport(win, doc) {
  const candidatesW = [
    Number(win?.innerWidth),
    Number(doc?.documentElement?.clientWidth),
    Number(win?.visualViewport?.width),
  ].filter((n) => Number.isFinite(n) && n > 0);
  const candidatesH = [
    Number(win?.innerHeight),
    Number(doc?.documentElement?.clientHeight),
    Number(win?.visualViewport?.height),
  ].filter((n) => Number.isFinite(n) && n > 0);
  return {
    vw: candidatesW.length > 0 ? Math.min(...candidatesW) : 1280,
    vh: candidatesH.length > 0 ? Math.min(...candidatesH) : 800,
  };
}

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
    const safeMinTop = Math.min(8, Math.max(0, vh - minH));
    const maxNorthH = Math.max(minH, bottomEdge - safeMinTop);
    nextHeight = Math.max(minH, Math.min(maxNorthH, Math.round(startH - dY)));
    nextTop = Math.max(safeMinTop, bottomEdge - nextHeight);
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

function createSvgIcon(doc, pathDefs = [], size = 15, strokeWidth = 2) {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', String(strokeWidth));
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

const ICON_PATHS = Object.freeze({
  plus: ['M12 5v14', 'M5 12h14'],
  chevronDown: ['M6 9l6 6 6-6'],
  chevronUp: ['M6 15l6-6 6 6'],
  refresh: ['M20 6v5h-5', 'M19 11a7 7 0 1 0 1 4'],
  close: ['M6 6l12 12', 'M18 6 6 18'],
  shield: ['M12 3l7 3v5c0 4.6-2.8 8-7 10-4.2-2-7-5.4-7-10V6l7-3z'],
});

function setButtonIconLabel(doc, button, label, iconPaths = [], { iconFirst = false } = {}) {
  if (!button) return;
  const labelEl = createEl(doc, 'span', { className: 'ups-btn-label', text: label });
  const iconEl = iconPaths.length > 0 ? createSvgIcon(doc, iconPaths, 14) : null;
  button.replaceChildren(...(iconFirst && iconEl ? [iconEl, labelEl] : iconEl ? [labelEl, iconEl] : [labelEl]));
}

function setDisclosureLabel(doc, button, label, expanded) {
  button.setAttribute('aria-expanded', String(expanded));
  setButtonIconLabel(doc, button, label, expanded ? ICON_PATHS.chevronUp : ICON_PATHS.chevronDown);
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
  const labelSpan = btn.querySelector?.('.ups-btn-label') || null;
  const target = labelSpan || btn;
  if (!btn._upsBaseText) {
    btn._upsBaseText = target.textContent || '';
  }
  if (btn._upsFlashTimer) {
    clearTimeout(btn._upsFlashTimer);
    btn._upsFlashTimer = null;
  }
  target.textContent = feedbackText;
  btn._upsFlashTimer = setTimeout(() => {
    btn._upsFlashTimer = null;
    if (!btn.disabled && btn._upsBaseText) {
      target.textContent = btn._upsBaseText;
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
    listCharacters: options.hostApi?.listCharacters || listCharacters,
    listWorldbooks: options.hostApi?.listWorldbooks || listWorldbooks,
    getCharacterContext: options.hostApi?.getCharacterContext || getCharacterContext,
    getActiveCharacterContext: options.hostApi?.getActiveCharacterContext || getActiveCharacterContext,
    loadCharacterWorldbookEntries:
      options.hostApi?.loadCharacterWorldbookEntries || loadCharacterWorldbookEntries,
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
  let companionSeq = 0;

  function readHistoryFromStorage() {
    try {
      const storage = win?.localStorage || globalThis.localStorage || null;
      if (!storage || typeof storage.getItem !== 'function') return [];
      const raw = storage.getItem(HISTORY_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeHistoryToStorage(list) {
    try {
      const storage = win?.localStorage || globalThis.localStorage || null;
      if (!storage || typeof storage.setItem !== 'function') return;
      storage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(Array.isArray(list) ? list : []));
    } catch {
      // Ignore quota / disabled storage errors safely
    }
  }

  const state = {
    isOpen: false,
    minimized: false,
    miniMode: Boolean(settings.ui.miniMode),
    activeTab: settings.ui.activeTab || 'studio',
    mode: settings.ui.mode === 'B' ? 'B' : 'A',
    lastCreateSchemeId:
      settings.activeSchemeId === 'persona_refactor' ? 'longform_coact' : settings.activeSchemeId,
    subMode: settings.ui.subMode || 'de_label_reformat',
    spotlightMode: settings.ui.spotlightMode || 'balanced',
    backstoryMode: settings.ui.backstoryMode || 'light_vibe',
    injectChar: settings.ui.injectChar !== false,
    dualLayer: Boolean(settings.ui.dualLayer),
    worldbookLightMode: settings.ui.worldbookLightMode || 'green_selective',
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
    statusFlashTimer: null,
    vibeTrayOpen: false,
    lexiconOpen: false,
    activeLexiconCatId: COMMON_PERSONA_LEXICON_CATEGORIES[0]?.id || 'animal_archetype',
    companionOpen: false,
    charComboOpen: false,
    realNameEditedForCharKey: '',
    charRealNameManualOpen: false,
    expandedSyncedIds: new Set(),
    sectionsPanelOpen: false,
    mustHaveTrayOpen: false,
    pointsBoxOpen: false,
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
    cachedCharacters: [],
    selectedCharTarget: settings.ui.injectChar === false ? '__none__' : '',
    charSearchQuery: '',
    charSearchComposing: false,
    charRealNameOverride: '',
    multiCharInfo: { isMultiChar: false, characterEntries: [] },
    selectedSubCharKeys: [],
    isCharAdaptFlow:
      settings.ui.mode === 'B' && (settings.ui.subMode || 'de_label_reformat') === 'cross_card_adapt',
    cachedCharContext: null,
    charWorldEntries: [],
    selectedWorldEntryKeys: new Set(),
    worldSelectionCharKey: '',
    hasExplicitWorldSelection: false,
    worldEntriesOpen: false,
    worldEntryFilter: '',
    worldEntryFilterComposing: false,
    generationSections: normalizeGenerationSectionsConfig(settings.ui.generationSections),
    moduleRatios: normalizeModuleRatios(settings.ui.moduleRatios),
    pureCrossCardReuse: Boolean(settings.ui.pureCrossCardReuse),
    companions: [],
    companionCarryMode: settings.ui.companionCarryMode || 'persona_book',
    companionTargetBook: settings.ui.companionTargetBook || '',
    availableWorldbooks: [],
    generationHistory: readHistoryFromStorage(),
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
    lastViewportWidth: getSafeViewport(win, doc).vw,
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
      'aria-label': 'User 人设工坊',
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

  const syncHostBtn = createEl(
    doc,
    'button',
    {
      type: 'button',
      className: 'ups-btn-sm',
      title: '重新读取酒馆角色卡与人设列表',
      attrs: { 'data-ups-sync-host': 'true', 'aria-label': '重新读取酒馆列表' },
    },
    [
      createSvgIcon(doc, ['M21 12a9 9 0 1 1-2.64-6.36', 'M21 3v6h-6'], 13),
      createEl(doc, 'span', { className: 'ups-btn-label', text: '重读列表' }),
    ]
  );

  const minimizeBtn = createEl(
    doc,
    'button',
    {
      type: 'button',
      className: 'ups-icon-btn',
      title: '最小化为挂起胶囊',
      attrs: { 'data-ups-minimize': 'true', 'aria-label': '最小化' },
    },
    [createSvgIcon(doc, ['M5 12h14'], 14)]
  );

  const closeBtn = createEl(
    doc,
    'button',
    {
      type: 'button',
      className: 'ups-icon-btn',
      title: '关闭工坊',
      attrs: { 'data-ups-close': 'true', 'aria-label': '关闭' },
    },
    [createSvgIcon(doc, ['M18 6L6 18', 'M6 6l12 12'], 14)]
  );

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
        closeBtn,
      ]),
    ]
  );

  // Constant 4-Tab Bar
  const TAB_DEFS = [
    { id: 'studio', label: '工坊主页' },
    { id: 'presets', label: '生成预设' },
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

  // Unified Constant Footer + Framed Status Box
  const statusDotEl = createEl(doc, 'span', {
    className: 'ups-status-dot',
    attrs: { 'aria-hidden': 'true' },
  });
  const statusTextSpan = createEl(doc, 'span', {
    className: 'ups-status-text',
    text: '就绪',
  });
  const statusEl = createEl(
    doc,
    'span',
    {
      className: 'ups-footer-status',
      title: '就绪',
      attrs: { 'data-ups-status': 'true', 'data-tone': 'muted' },
    },
    [statusDotEl, statusTextSpan]
  );
  const undoBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-sm',
    text: '撤销修改',
    title: '撤销上一步成稿正文编辑 (Ctrl+Z)',
    disabled: true,
    attrs: { 'data-ups-undo': 'true', 'aria-label': '撤销成稿修改' },
  });
  const redoBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-sm',
    text: '重做修改',
    title: '重做已撤销的成稿正文编辑 (Ctrl+Y)',
    disabled: true,
    attrs: { 'data-ups-redo': 'true', 'aria-label': '重做成稿修改' },
  });
  const copyBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-sm',
    text: '复制正文',
    title: '复制当前成稿正文到剪贴板',
    attrs: { 'data-ups-copy': 'true', 'aria-label': '复制成稿正文' },
  });
  const saveOverwriteBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn',
    text: '覆盖当前人设',
    title: '覆盖保存到酒馆当前正在使用的 User 人设',
    attrs: { 'data-ups-save-overwrite': 'true', 'data-ups-footer-save': 'true' },
  });
  const saveAsBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn ups-btn-primary',
    text: '另存为新人设',
    title: '新建一个独立 User 人设并切换过去',
    attrs: { 'data-ups-save-as-btn': 'true', 'data-ups-save-new': 'true' },
  });
  const footerContextHintEl = createEl(doc, 'span', {
    className: 'ups-muted',
    text: '修改将自动保存至酒馆扩展配置',
    hidden: state.activeTab === 'studio',
    attrs: { 'data-ups-footer-hint': 'true' },
  });

  const footerEl = createEl(
    doc,
    'footer',
    { className: 'ups-footer', attrs: { 'data-ups-footer': 'true' } },
    [
      createEl(doc, 'div', { className: 'ups-footer-left' }, [statusEl]),
      createEl(doc, 'div', { className: 'ups-footer-actions' }, [
        saveOverwriteBtn,
        saveAsBtn,
        footerContextHintEl,
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
  const debugAuditCheckbox = createEl(doc, 'input', { type: 'checkbox', checked: settings.ui.debugAudit, attrs: { 'data-ups-debug-audit': 'true' } });
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
        createEl(doc, 'span', { text: '长设定拆入世界书' }),
      ]),
      createEl(doc, 'label', { className: 'ups-check-row' }, [
        draftAuditCheckbox,
        createEl(doc, 'span', { text: '生成前自检' }),
      ]),
      createEl(doc, 'label', { className: 'ups-check-row' }, [
        antiParrotCheckbox,
        createEl(doc, 'span', { text: '含“例如/比如”示例时自动附防照抄说明' }),
      ]),
      createEl(doc, 'label', { className: 'ups-check-row' }, [
        debugAuditCheckbox,
        createEl(doc, 'span', { text: '查看自检记录' }),
      ]),
      createEl(doc, 'label', { className: 'ups-check-row' }, [
        visibilityTagsCheckbox,
        createEl(doc, 'span', { text: '标注公开/私密标签（适用暗恋、想分手、隐瞒心事或秘密局）' }),
      ]),
    ]
  );

  // Anchored floating menu for compact row actions
  const floatingMenuEl = createEl(doc, 'div', {
    className: 'ups-floating-menu ups-theme-root',
    hidden: true,
    attrs: { 'data-ups-floating-menu': 'true' },
  });

  // Anchored preset menu for unified 32px word-count combo
  const wordCountMenuEl = createEl(
    doc,
    'div',
    {
      className: 'ups-floating-menu ups-theme-root',
      hidden: true,
      attrs: { 'data-ups-word-count-menu': 'true' },
    },
    WORD_COUNT_PRESETS.filter((p) => p.chars > 0).map((p) =>
      createEl(doc, 'button', {
        type: 'button',
        className: 'ups-menu-item',
        text: p.label,
        attrs: { 'data-ups-word-count-option': String(p.chars) },
      })
    )
  );

  // Non-blocking Generation History Popover (FIFO cap = 8, stored in localStorage)
  const historyPopoverEl = createEl(doc, 'div', {
    className: 'ups-popover ups-history-popover ups-theme-root',
    hidden: true,
    attrs: { 'data-ups-history-popover': 'true' },
  });

  // Dedicated Non-Blocking Save-As Name Submodal
  const saveAsCloseBtn = createEl(
    doc,
    'button',
    { type: 'button', className: 'ups-icon-btn', title: '关闭', attrs: { 'aria-label': '关闭' } },
    [createSvgIcon(doc, ['M18 6L6 18', 'M6 6l12 12'], 14)]
  );
  const saveAsHeaderEl = createEl(doc, 'div', { className: 'ups-submodal-header' }, [
    createEl(doc, 'span', { text: '另存为新人设' }),
    saveAsCloseBtn,
  ]);
  const saveAsNameInput = createEl(doc, 'input', {
    type: 'text',
    className: 'ups-input',
    placeholder: '输入新人设名称',
    attrs: { 'aria-label': '新人设名称' },
  });
  const saveAsCancelBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-ghost',
    text: '取消',
  });
  const saveAsConfirmBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn ups-btn-primary',
    text: '确认保存',
    attrs: { 'data-ups-save-name-confirm': 'true' },
  });
  const saveAsCardEl = createEl(doc, 'div', { className: 'ups-submodal-card' }, [
    saveAsHeaderEl,
    createEl(doc, 'div', { className: 'ups-submodal-body' }, [
      createEl(doc, 'div', { className: 'ups-field' }, [
        createEl(doc, 'label', { className: 'ups-label', text: '人设名称' }),
        saveAsNameInput,
      ]),
    ]),
    createEl(doc, 'div', { className: 'ups-submodal-footer' }, [saveAsCancelBtn, saveAsConfirmBtn]),
  ]);
  const saveNameSubmodalEl = createEl(
    doc,
    'div',
    {
      className: 'ups-submodal-mask ups-theme-root',
      hidden: true,
      attrs: { 'data-ups-save-name-submodal': 'true' },
    },
    [saveAsCardEl]
  );

  // Non-Blocking Draggable Auxiliary Floating Card (Gate 2: never locks underlying scroll!)
  const submodalTitleEl = createEl(doc, 'span', { text: '' });
  const submodalCloseBtn = createEl(
    doc,
    'button',
    { type: 'button', className: 'ups-icon-btn', title: '关闭浮窗', attrs: { 'aria-label': '关闭浮窗' } },
    [createSvgIcon(doc, ['M18 6L6 18', 'M6 6l12 12'], 14)]
  );
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
  shadow.appendChild(wordCountMenuEl);
  shadow.appendChild(floatingMenuEl);
  shadow.appendChild(historyPopoverEl);
  shadow.appendChild(saveNameSubmodalEl);
  shadow.appendChild(submodalMaskEl);
  mountTarget.appendChild(host);

  // Stop host .openDrawer collapse on EVERY floating root (bubble phase)
  stopHostDrawerCollapse(host, signal);
  stopHostDrawerCollapse(modalEl, signal);
  stopHostDrawerCollapse(pillEl, signal);
  stopHostDrawerCollapse(popoverEl, signal);
  stopHostDrawerCollapse(floatingMenuEl, signal);
  stopHostDrawerCollapse(wordCountMenuEl, signal);
  stopHostDrawerCollapse(historyPopoverEl, signal);
  stopHostDrawerCollapse(saveAsCardEl, signal);
  stopHostDrawerCollapse(submodalCardEl, signal);

  // ==========================================================================
  // Tab 1: 工坊主页 (High-Clarity Two-Column Workbench)
  // ==========================================================================

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
  const wordCountInput = createEl(doc, 'input', {
    type: 'text',
    className: 'ups-input ups-word-count-input',
    value: String(getActiveScheme(settings)?.targetChars || 1500),
    placeholder: '目标字数',
    attrs: { 'data-ups-word-count-input': 'true', inputmode: 'numeric', 'aria-label': '目标字数' },
  });
  const wordCountMenuBtn = createEl(
    doc,
    'button',
    {
      type: 'button',
      className: 'ups-word-count-menu-btn',
      title: '选择常用目标字数',
      attrs: { 'data-ups-word-count-menu-btn': 'true', 'aria-label': '选择常用目标字数' },
    },
    [createSvgIcon(doc, ['M6 9l6 6 6-6'], 13)]
  );
  const wordCountComboEl = createEl(doc, 'div', { className: 'ups-word-count-combo' }, [
    wordCountInput,
    wordCountMenuBtn,
  ]);
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

  const sectionsSummaryEl = createEl(doc, 'span', {
    className: 'ups-muted',
    text: '已选板块',
    attrs: { 'data-ups-sections-summary': 'true' },
  });

  const ratioToggleBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-sm',
    text: '选择板块与比重',
    attrs: { 'data-ups-ratio-toggle': 'true', 'aria-expanded': 'false' },
  });
  setButtonIconLabel(doc, ratioToggleBtn, '选择板块与比重', ICON_PATHS.chevronDown);

  const sectionsBarEl = createEl(
    doc,
    'div',
    { className: 'ups-sections-bar', attrs: { 'data-ups-sections-bar': 'true' } },
    [
      createEl(doc, 'div', { className: 'ups-sections-bar-info' }, [
        createEl(doc, 'span', { className: 'ups-label', text: '要生成的板块与篇幅比重' }),
        sectionsSummaryEl,
      ]),
      ratioToggleBtn,
    ]
  );

  const splitHintBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-split-hint',
    hidden: true,
    text: '长设定拆入世界书',
    attrs: { 'data-ups-split-hint': 'true' },
  });

  const worldbookLightSelect = createEl(
    doc,
    'select',
    {
      className: 'ups-select ups-input-sm',
      style: { flex: '1 1 180px' },
      attrs: { 'data-ups-wb-light-mode': 'true', 'aria-label': '世界书蓝绿灯触发方式' },
    },
    WORLDBOOK_LIGHT_MODES.map((m) => createEl(doc, 'option', { value: m.id, text: m.label }))
  );
  worldbookLightSelect.value = state.worldbookLightMode;

  const worldbookLightRowEl = createEl(
    doc,
    'div',
    { className: 'ups-row', hidden: !state.dualLayer, attrs: { 'data-ups-wb-light-row': 'true' } },
    [
      createEl(doc, 'span', { className: 'ups-chip-label', text: '世界书触发灯色：' }),
      worldbookLightSelect,
    ]
  );

  const splitBoxEl = createEl(
    doc,
    'div',
    { className: 'ups-split-box', hidden: true, attrs: { 'data-ups-split-box': 'true' } },
    [
      createEl(doc, 'div', { className: 'ups-row-between' }, [
        createEl(doc, 'div', { style: { flex: '1 1 180px', minWidth: '0' } }, [
          createEl(doc, 'div', { className: 'ups-label', text: '长设定分流存为世界书' }),
          createEl(doc, 'div', {
            className: 'ups-muted',
            text: '字数较长时，人设框只留核心形象，把延展背景自动存成世界书条目',
          }),
        ]),
        splitHintBtn,
      ]),
      worldbookLightRowEl,
    ]
  );

  const layoutStyleSelect = createEl(
    doc,
    'select',
    {
      className: 'ups-select ups-input-sm',
      attrs: { 'data-ups-layout-style': 'true', 'aria-label': '输出版式' },
    },
    GENERATION_LAYOUT_STYLES.map((st) => createEl(doc, 'option', { value: st.id, text: st.label }))
  );
  const sectionPresetBtns = [
    { id: 'minimal', label: '精简核心' },
    { id: 'standard', label: '日常标准' },
    { id: 'full', label: '完整详尽' },
  ].map((p) =>
    createEl(doc, 'button', {
      type: 'button',
      className: 'ups-btn-sm',
      text: p.label,
      attrs: { 'data-ups-section-preset': p.id },
    })
  );
  const sectionGroupsContainerEl = createEl(doc, 'div', { className: 'ups-section-groups' });
  const customSectionNameInput = createEl(doc, 'input', {
    type: 'text',
    className: 'ups-input ups-input-sm',
    style: { flex: '1 1 140px' },
    placeholder: '自定义板块名称（如：修仙灵根与境界）',
    attrs: { 'data-ups-custom-section-name': 'true', 'aria-label': '自定义板块名称' },
  });
  const customSectionAddBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-sm',
    text: '添加板块',
    attrs: { 'data-ups-custom-section-add': 'true' },
  });
  setButtonIconLabel(doc, customSectionAddBtn, '添加板块', ICON_PATHS.plus, { iconFirst: true });
  const customSectionsListEl = createEl(doc, 'div', { className: 'ups-chip-group' });
  const pureReuseCheckbox = createEl(doc, 'input', {
    type: 'checkbox',
    checked: state.pureCrossCardReuse,
    attrs: { 'data-ups-pure-reuse': 'true' },
  });

  const RATIO_FIELD_DEFS = [
    { key: 'appearance', label: '外貌' },
    { key: 'personality', label: '性格' },
    { key: 'backstory', label: '经历' },
    { key: 'relationship', label: '关系' },
    { key: 'private', label: '私密暗线' },
  ];
  const ratioInputsMap = new Map();
  const ratioRowEl = createEl(
    doc,
    'div',
    { className: 'ups-ratio-grid' },
    RATIO_FIELD_DEFS.map((def) => {
      const inp = createEl(doc, 'input', {
        type: 'text',
        className: 'ups-input ups-input-sm ups-ratio-input',
        value: String(state.moduleRatios[def.key] ?? 0),
        attrs: { 'data-ups-ratio-input': def.key, inputmode: 'numeric', 'aria-label': `${def.label}比重` },
      });
      ratioInputsMap.set(def.key, inp);
      return createEl(doc, 'label', { className: 'ups-ratio-cell' }, [
        createEl(doc, 'span', { className: 'ups-chip-label', text: `${def.label}%` }),
        inp,
      ]);
    })
  );

  const sectionsPanelEl = createEl(
    doc,
    'div',
    { className: 'ups-sections-panel', hidden: true, attrs: { 'data-ups-sections-panel': 'true' } },
    [
      createEl(doc, 'div', { className: 'ups-row-between' }, [
        createEl(doc, 'div', { className: 'ups-row' }, [
          createEl(doc, 'span', { className: 'ups-label', text: '输出版式' }),
          layoutStyleSelect,
        ]),
        createEl(doc, 'div', { className: 'ups-chip-group' }, sectionPresetBtns),
      ]),
      sectionGroupsContainerEl,
      createEl(doc, 'div', { className: 'ups-row' }, [customSectionNameInput, customSectionAddBtn]),
      customSectionsListEl,
      createEl(doc, 'label', { className: 'ups-check-row' }, [
        pureReuseCheckbox,
        createEl(doc, 'span', { text: '写成跨卡通用人设' }),
      ]),
      createEl(doc, 'div', { className: 'ups-field' }, [
        createEl(doc, 'span', { className: 'ups-label', text: '各板块篇幅比重' }),
        ratioRowEl,
      ]),
    ]
  );

  sectionsBarEl.appendChild(sectionsPanelEl);

  // Mode A inputs (capsule-grouped lexicon + must-have templates)
  const inspirationInput = createEl(doc, 'textarea', {
    className: 'ups-textarea',
    rows: 4,
    placeholder:
      '写一两句你想演的人设、关系或暗线（如：刑侦搭档日常，表面散漫实则办案极稳；或同居日常，外冷内热的青年画师）……',
    attrs: { 'data-ups-inspiration': 'true' },
  });

  const lexiconToggleBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-sm',
    text: '常用词库',
    attrs: { 'data-ups-lexicon-toggle': 'true', 'aria-expanded': 'false' },
  });
  setButtonIconLabel(doc, lexiconToggleBtn, '常用词库', ICON_PATHS.chevronDown);

  const toggleVibeTrayBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-sm',
    text: '补充神韵词',
    attrs: { 'data-ups-toggle-vibe-tray': 'true', 'aria-expanded': 'false' },
  });
  setButtonIconLabel(doc, toggleVibeTrayBtn, '补充神韵词', ICON_PATHS.chevronDown);

  const lexiconAllChips = [];
  const syncLexiconPickedChips = () => {
    const cur = inspirationInput.value.trim();
    const partsSet = new Set(
      cur
        ? cur
            .split(/[，,、；;\s]+/)
            .map((s) => s.trim())
            .filter(Boolean)
        : []
    );
    for (const item of lexiconAllChips) {
      item.chip.classList.toggle('is-picked', partsSet.has(item.term));
    }
  };

  const appendTermToInspiration = (term, triggerBtn, labelPrefix = '设定词') => {
    const cur = inspirationInput.value.trim();
    const existingParts = cur
      ? cur
          .split(/[，,、；;\s]+/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    if (!existingParts.includes(term)) {
      inspirationInput.value = cur ? `${cur}，${term}` : term;
    }
    syncLexiconPickedChips();
    flashButtonFeedback(triggerBtn, '✓ 已填入', 900);
    setStatus(`✓ 已填入${labelPrefix}：${term}`, 'ok');
  };

  inspirationInput.addEventListener('input', syncLexiconPickedChips, { signal });

  const lexiconTabButtons = new Map();
  const lexiconCategoryMap = new Map();

  const syncLexiconTabs = () => {
    for (const [catId, tabBtn] of lexiconTabButtons.entries()) {
      const isActive = catId === state.activeLexiconCatId;
      tabBtn.classList.toggle('is-active', isActive);
      tabBtn.setAttribute('aria-selected', String(isActive));
    }
    for (const [catId, blockEl] of lexiconCategoryMap.entries()) {
      blockEl.hidden = catId !== state.activeLexiconCatId;
    }
  };

  const lexiconTabsBarEl = createEl(
    doc,
    'div',
    { className: 'ups-lexicon-tabs', attrs: { role: 'tablist', 'aria-label': '常用词库分类胶囊' } },
    COMMON_PERSONA_LEXICON_CATEGORIES.map((cat) => {
      const isInitial = cat.id === state.activeLexiconCatId;
      const tabBtn = createEl(doc, 'button', {
        type: 'button',
        className: `ups-lexicon-tab${isInitial ? ' is-active' : ''}`,
        text: cat.label,
        attrs: {
          role: 'tab',
          'data-ups-lexicon-tab': cat.id,
          'aria-selected': String(isInitial),
        },
      });
      tabBtn.addEventListener('click', () => {
        state.activeLexiconCatId = cat.id;
        syncLexiconTabs();
      }, { signal });
      lexiconTabButtons.set(cat.id, tabBtn);
      return tabBtn;
    })
  );

  const lexiconCategoryBlocks = COMMON_PERSONA_LEXICON_CATEGORIES.map((cat) => {
    const chips = cat.terms.map((term) => {
      const chip = createEl(doc, 'button', {
        type: 'button',
        className: 'ups-btn-sm ups-lexicon-chip',
        text: `+ ${term}`,
        attrs: { 'data-ups-lexicon-chip': term },
      });
      lexiconAllChips.push({ term, chip });
      chip.addEventListener('click', () => {
        appendTermToInspiration(term, chip, '设定词');
      }, { signal });
      return chip;
    });
    const blockEl = createEl(
      doc,
      'div',
      {
        className: 'ups-lexicon-cat',
        hidden: cat.id !== state.activeLexiconCatId,
        attrs: { 'data-ups-lexicon-category': cat.id },
      },
      [createEl(doc, 'div', { className: 'ups-lexicon-chips' }, chips)]
    );
    lexiconCategoryMap.set(cat.id, blockEl);
    return blockEl;
  });

  const quickVibeChips = VIBE_ANCHOR_EXAMPLES.map((vibe) => {
    const chip = createEl(doc, 'button', {
      type: 'button',
      className: 'ups-btn-sm',
      text: `+ ${vibe}`,
      attrs: { 'data-ups-vibe-chip': vibe },
    });
    chip.addEventListener('click', () => {
      appendTermToInspiration(vibe, chip, '神韵词');
    }, { signal });
    return chip;
  });

  const vibeTrayEl = createEl(
    doc,
    'div',
    { className: 'ups-tray', hidden: true, attrs: { 'data-ups-vibe-tray': 'true' } },
    quickVibeChips
  );

  const lexiconPanelEl = createEl(
    doc,
    'div',
    { className: 'ups-lexicon-panel', hidden: true, attrs: { 'data-ups-lexicon-panel': 'true' } },
    [
      lexiconTabsBarEl,
      ...lexiconCategoryBlocks,
      createEl(doc, 'div', { className: 'ups-row-between', style: { paddingTop: '4px' } }, [
        createEl(doc, 'span', { className: 'ups-muted', text: '点击词条自动填入上方灵感框' }),
        toggleVibeTrayBtn,
      ]),
    ]
  );

  const mustHavesAInput = createEl(doc, 'input', {
    type: 'text',
    className: 'ups-input',
    placeholder: '选填：必带的外貌、习惯、职业或私密伏笔细节',
    attrs: { 'data-ups-must-haves': 'true' },
  });
  const toggleMustTrayBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-sm',
    text: '常用模板',
    attrs: { 'data-ups-toggle-must-tray': 'true', 'aria-expanded': 'false' },
  });
  setButtonIconLabel(doc, toggleMustTrayBtn, '常用模板', ICON_PATHS.chevronDown);
  const saveMustTplBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-sm',
    text: '存为模板',
    title: '将当前输入的必带细节保存为可复用模板',
    attrs: { 'data-ups-save-must-tpl': 'true' },
  });
  const mustHaveTrayEl = createEl(doc, 'div', {
    className: 'ups-tray',
    hidden: true,
    attrs: { 'data-ups-must-tray': 'true' },
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
  const generateARow = createEl(
    doc,
    'div',
    { className: 'ups-btn-row', hidden: state.mode !== 'A' },
    [generateABtn, previewPromptABtn]
  );

  const modeAPanel = createEl(
    doc,
    'div',
    { className: 'ups-card', hidden: state.mode !== 'A', attrs: { 'data-ups-panel-mode': 'A' } },
    [
      createEl(doc, 'div', { className: 'ups-mod-head' }, [
        createEl(doc, 'span', { className: 'ups-mod-title', text: '第一步 · 填写人设想法' }),
        pickFromPersonaABtn,
      ]),
      createEl(doc, 'div', { className: 'ups-field' }, [
        createEl(doc, 'div', { className: 'ups-field-head' }, [
          createEl(doc, 'label', { className: 'ups-label', text: '灵感与人物感觉' }),
          createEl(doc, 'div', { className: 'ups-chip-group' }, [lexiconToggleBtn]),
        ]),
        inspirationInput,
        lexiconPanelEl,
        vibeTrayEl,
      ]),
      createEl(doc, 'div', { className: 'ups-field' }, [
        createEl(doc, 'div', { className: 'ups-field-head' }, [
          createEl(doc, 'label', { className: 'ups-label', text: '必带细节' }),
          createEl(doc, 'div', { className: 'ups-chip-group' }, [toggleMustTrayBtn, saveMustTplBtn]),
        ]),
        mustHavesAInput,
        mustHaveTrayEl,
      ]),
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
      createEl(doc, 'option', { value: 'cross_card_adapt', text: '换卡融合重塑（保留外貌性格，结合新卡重塑经历与关系）' }),
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
  const lockSelectionBtn = createEl(doc, 'button', { type: 'button', className: 'ups-btn-sm', hidden: true, text: '保留选中原句', attrs: { 'data-ups-lock-selection': 'true' } });
  const selectedOldText = () => existingDraftInput.value.slice(existingDraftInput.selectionStart, existingDraftInput.selectionEnd);
  for (const event of ['select', 'input', 'mouseup', 'keyup', 'touchend']) {
    existingDraftInput.addEventListener(event, () => { lockSelectionBtn.hidden = !selectedOldText().trim(); }, { signal });
  }
  lockSelectionBtn.addEventListener('click', () => {
    const phrase = selectedOldText();
    if (!phrase.trim()) return;
    if (!`\n${lockedCoreInput.value}\n`.includes(`\n${phrase}\n`)) {
      lockedCoreInput.value += (lockedCoreInput.value ? '\n' : '') + phrase;
    }
    lockedCoreInput.parentElement.open = true;
    setStatus('已保留原句', 'ok');
  }, { signal });
  const lockedCoreInput = createEl(doc, 'textarea', {
    className: 'ups-textarea',
    rows: 2,
    placeholder: '选填：额外指定绝不改动的原句',
    attrs: { 'data-ups-locked-core': 'true' },
  });
  const mustHavesBInput = createEl(doc, 'input', {
    type: 'text',
    className: 'ups-input',
    placeholder: '选填：本次改写补充要求（如“保留原有职业，精简多余修饰词”）',
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
  const generateBRow = createEl(
    doc,
    'div',
    { className: 'ups-btn-row', hidden: state.mode !== 'B' },
    [generateBBtn, previewPromptBBtn]
  );

  const modeBPanel = createEl(
    doc,
    'div',
    { className: 'ups-card', hidden: state.mode !== 'B', attrs: { 'data-ups-panel-mode': 'B' } },
    [
      createEl(doc, 'div', { className: 'ups-mod-head' }, [
        createEl(doc, 'span', { className: 'ups-mod-title', text: '第一步 · 载入与改写旧人设' }),
      ]),
      createEl(doc, 'div', { className: 'ups-row' }, [personaPickerSelect, loadPersonaBtn, extractPointsBtn]),
      createEl(doc, 'div', { className: 'ups-field' }, [
        createEl(doc, 'label', { className: 'ups-label', text: '改写方向' }),
        subModeSelect,
      ]),
      createEl(doc, 'div', { className: 'ups-field' }, [
        createEl(doc, 'label', { className: 'ups-label', text: '旧人设原稿' }),
        existingDraftInput,
        lockSelectionBtn,
      ]),
      createEl(doc, 'div', { className: 'ups-field' }, [
        createEl(doc, 'label', { className: 'ups-label', text: '补充改写要求' }),
        mustHavesBInput,
      ]),
      createEl(doc, 'details', { className: 'ups-advanced-details' }, [
        createEl(doc, 'summary', { text: '额外指定不改动的原句' }),
        lockedCoreInput,
      ]),
    ]
  );

  // Shared Selectable Persona Points Box
  const pointsCountLabel = createEl(doc, 'span', {
    className: 'ups-mod-title',
    text: '勾选保留原人设条目',
  });
  const pointsPersonaSelect = createEl(doc, 'select', {
    className: 'ups-select',
    style: { flex: '1 1 150px', height: '28px', minHeight: '28px', maxHeight: '28px', lineHeight: '26px', fontSize: '12px' },
    attrs: { 'data-ups-points-persona': 'true', 'aria-label': '选择沿用哪份原人设' },
  });
  const pointsSelectAllBtn = createEl(doc, 'button', { type: 'button', className: 'ups-btn-sm', text: '全选' });
  const pointsSelectCoreBtn = createEl(doc, 'button', { type: 'button', className: 'ups-btn-sm', text: '只留外貌性格' });
  const pointsClearBtn = createEl(doc, 'button', { type: 'button', className: 'ups-btn-sm', text: '取消全选' });
  const pointsCloseBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-sm',
    text: '退出沿用',
    title: '关闭原人设勾选面板并不再沿用勾选条目',
    attrs: { 'data-ups-points-close': 'true' },
  });
  const pointsNavEl = createEl(doc, 'nav', { className: 'ups-chip-group', attrs: { 'aria-label': '旧人设分组' } });
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
          pointsCloseBtn,
        ]),
      ]),
      createEl(doc, 'div', { className: 'ups-row' }, [
        createEl(doc, 'span', { className: 'ups-chip-label', text: '选择原人设：' }),
        pointsPersonaSelect,
      ]),
      pointsNavEl, pointsListEl,
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
    placeholder: '生成的 User 人设会显示在这里，可直接编辑调整或局部重写……',
    attrs: { 'data-ups-draft': 'true' },
  });
  const historyBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-sm',
    text: '历史记录',
    title: '查看最近生成或改写前的历史成稿（最多保留 8 条）',
    attrs: { 'data-ups-history-btn': 'true', 'aria-label': '查看生成历史记录' },
  });

  // Slim Collapsible Selection-Driven Preference & Pattern-Distillation Bar
  const selectionSnippetEl = createEl(doc, 'span', {
    className: 'ups-selection-snippet',
    text: '拖选正文词句可标记喜欢，或按「句式问题 / 解释性语言」归入禁写规律',
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
  const draftDistillTasteBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-sm',
    text: 'AI 归纳禁写规律',
    title: '将标记的不喜欢句子或删改差异提炼成共性避雷规则（如同类句式问题、解释性语言过多）',
    attrs: { 'data-ups-draft-distill': 'true' },
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
    placeholder: '补充原因，如：同类转折句式太多 / 解释性心理剖析太啰嗦',
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
      createEl(doc, 'span', { className: 'ups-chip-label', text: '不喜欢（按句式/共性毛病避雷）：' }),
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
          draftDistillTasteBtn,
        ]),
      ]),
      createEl(doc, 'div', { className: 'ups-selection-drawer' }, [selectionDrawerInnerEl]),
    ]
  );

  const openDiffBtn = createEl(doc, 'button', { type: 'button', className: 'ups-btn-sm', text: '修改对比', hidden: true, attrs: { 'data-ups-open-diff': 'true' } });
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
  const confirmAndDistillTasteBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn',
    text: '记入并用 AI 归纳共性规律',
    attrs: { 'data-ups-confirm-and-distill': 'true' },
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
      createEl(doc, 'div', {
        className: 'ups-muted',
        text: '若多处删改体现同一类句式问题或解释性语言，可记入后一键让 AI 归纳为通用避雷规则。',
      }),
      tasteCandidatesListEl,
      createEl(doc, 'div', { className: 'ups-btn-row' }, [confirmTasteBtn, confirmAndDistillTasteBtn]),
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

  // Unified Searchable Character Combobox + 卡中角色名
  const charComboLabelSpan = createEl(doc, 'span', {
    className: 'ups-char-combo-label',
    text: '跟随当前对话角色',
  });
  const charComboBtn = createEl(
    doc,
    'button',
    {
      type: 'button',
      className: 'ups-char-combo-btn',
      title: '点击搜索或切换关联角色卡',
      attrs: { 'data-ups-char-combo-btn': 'true', 'aria-expanded': 'false' },
    },
    [charComboLabelSpan, createSvgIcon(doc, ['M6 9l6 6 6-6'], 13)]
  );
  const charSearchInput = createEl(doc, 'input', {
    type: 'search',
    className: 'ups-input ups-input-sm',
    placeholder: '输入角色名或世界书搜索…',
    attrs: { 'data-ups-char-search': 'true', 'aria-label': '搜索角色名' },
  });
  const charComboListEl = createEl(doc, 'div', {
    className: 'ups-char-combo-list',
    attrs: { 'data-ups-char-combo-list': 'true' },
  });
  const charComboMenuEl = createEl(
    doc,
    'div',
    {
      className: 'ups-char-combo-menu',
      hidden: true,
      attrs: { 'data-ups-char-combo-menu': 'true' },
    },
    [charSearchInput, charComboListEl]
  );
  const charComboboxEl = createEl(doc, 'div', { className: 'ups-char-combobox' }, [
    charComboBtn,
    charComboMenuEl,
  ]);

  const charPickerSelect = createEl(doc, 'select', {
    className: 'ups-select',
    hidden: true,
    attrs: { 'data-ups-char-select': 'true', 'aria-label': '选择适配角色卡' },
  });

  const charRealNameToggleBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-link-btn',
    hidden: true,
    text: '卡名不是角色本名？点此填写实际称呼',
    attrs: { 'data-ups-char-real-name-toggle': 'true' },
  });
  const charRealNameInput = createEl(doc, 'input', {
    type: 'text',
    className: 'ups-input ups-input-sm',
    style: { flex: '1 1 130px' },
    placeholder: '填写卡中角色的实际姓名',
    attrs: { 'data-ups-char-real-name': 'true', 'aria-label': '卡中角色实际姓名' },
  });
  const charRealNameAutoBadgeEl = createEl(doc, 'span', {
    className: 'ups-badge ups-badge-ok',
    hidden: true,
    text: '已识别本名',
  });
  const charRealNameRowEl = createEl(
    doc,
    'div',
    { className: 'ups-row', hidden: true, attrs: { 'data-ups-char-real-name-row': 'true' } },
    [
      createEl(doc, 'span', { className: 'ups-chip-label', text: '卡中角色名：' }),
      charRealNameInput,
      charRealNameAutoBadgeEl,
    ]
  );
  const multiCharFocusBarEl = createEl(doc, 'div', {
    className: 'ups-chip-group',
    hidden: true,
    attrs: { 'data-ups-multichar-bar': 'true' },
  });
  const charFollowActiveBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-sm',
    text: '跟随当前对话',
    title: '恢复跟随酒馆当前打开的角色卡',
    attrs: { 'data-ups-char-follow-active': 'true' },
  });
  setButtonIconLabel(doc, charFollowActiveBtn, '跟随当前对话', ICON_PATHS.refresh, { iconFirst: true });
  const wbToggleBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-sm',
    text: '世界书条目 (0/0)',
    title: '展开或收起角色关联世界书条目（仅本次生成生效，不改动原书）',
    attrs: { 'data-ups-wb-toggle': 'true', 'aria-expanded': 'false' },
  });
  setButtonIconLabel(doc, wbToggleBtn, '世界书条目 (0/0)', ICON_PATHS.chevronDown);
  const wbFilterInput = createEl(doc, 'input', {
    type: 'search',
    className: 'ups-input ups-input-sm',
    style: { flex: '1 1 130px' },
    placeholder: '筛选世界书条目…',
    attrs: { 'data-ups-wb-filter': 'true', 'aria-label': '筛选角色世界书条目' },
  });
  const wbSelectAllBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-sm',
    text: '全选',
    attrs: { 'data-ups-wb-all': 'true' },
  });
  const wbSelectDefaultBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-sm',
    text: '仅原书启用',
    attrs: { 'data-ups-wb-default': 'true' },
  });
  const wbSelectNoneBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-sm',
    text: '全不选',
    attrs: { 'data-ups-wb-none': 'true' },
  });
  const wbListEl = createEl(doc, 'div', {
    className: 'ups-wb-list',
    attrs: { 'data-ups-wb-list': 'true' },
  });
  const wbBodyEl = createEl(
    doc,
    'div',
    { className: 'ups-wb-body', hidden: true, attrs: { 'data-ups-wb-body': 'true' } },
    [
      createEl(doc, 'div', { className: 'ups-muted', text: '仅控制本次生成注入的条目，不会改写酒馆原世界书的启用状态。' }),
      createEl(doc, 'div', { className: 'ups-row' }, [
        wbFilterInput,
        wbSelectAllBtn,
        wbSelectDefaultBtn,
        wbSelectNoneBtn,
      ]),
      wbListEl,
    ]
  );
  const wbPanelEl = createEl(
    doc,
    'div',
    { className: 'ups-wb-panel', hidden: true, attrs: { 'data-ups-worldbook-box': 'true' } },
    [
      createEl(doc, 'div', { className: 'ups-row-between' }, [
        createEl(doc, 'span', { className: 'ups-label', text: '角色关联世界书' }),
        wbToggleBtn,
      ]),
      wbBodyEl,
    ]
  );
  const charAdaptBoxEl = createEl(
    doc,
    'div',
    { className: 'ups-char-box', attrs: { 'data-ups-char-box': 'true' } },
    [
      createEl(doc, 'div', { className: 'ups-row-between' }, [
        createEl(doc, 'label', { className: 'ups-label', text: '关联角色卡' }),
        charFollowActiveBtn,
      ]),
      charComboboxEl,
      charPickerSelect,
      charRealNameToggleBtn,
      charRealNameRowEl,
      multiCharFocusBarEl,
      wbPanelEl,
    ]
  );

  // Optional Collapsible Cross-Card Companion Section
  const companionBudgetBadgeEl = createEl(doc, 'span', {
    className: 'ups-badge',
    hidden: true,
    text: '',
    attrs: { 'data-ups-companion-budget': 'true' },
  });
  const companionToggleBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-sm',
    text: '展开',
    attrs: { 'data-ups-companion-toggle': 'true', 'aria-expanded': 'false' },
  });
  setButtonIconLabel(doc, companionToggleBtn, '展开', ICON_PATHS.chevronDown);
  const companionAddBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-sm',
    text: '添加客串角色',
    attrs: { 'data-ups-companion-add': 'true' },
  });
  setButtonIconLabel(doc, companionAddBtn, '添加客串角色', ICON_PATHS.plus, { iconFirst: true });
  const companionCarryModeSelect = createEl(
    doc,
    'select',
    {
      className: 'ups-select ups-input-sm',
      style: { flex: '1 1 160px' },
      attrs: { 'data-ups-companion-carry-mode': 'true', 'aria-label': '客串资料存放位置' },
    },
    COMPANION_CARRY_MODES.map((m) => createEl(doc, 'option', { value: m.id, text: m.label }))
  );
  companionCarryModeSelect.value = state.companionCarryMode;

  const companionTargetBookSelect = createEl(doc, 'select', {
    className: 'ups-select ups-input-sm',
    style: { flex: '1 1 140px' },
    hidden: state.companionCarryMode !== 'target_book',
    attrs: { 'data-ups-companion-target-book': 'true', 'aria-label': '选择目标世界书' },
  });
  const companionSlotsListEl = createEl(doc, 'div', {
    className: 'ups-companion-slots',
    attrs: { 'data-ups-companion-slots': 'true' },
  });
  const companionBodyEl = createEl(
    doc,
    'div',
    { className: 'ups-companion-body', hidden: true, attrs: { 'data-ups-companion-body': 'true' } },
    [
      createEl(doc, 'div', { className: 'ups-row' }, [
        createEl(doc, 'span', { className: 'ups-chip-label', text: '资料存放在哪：' }),
        companionCarryModeSelect,
        companionTargetBookSelect,
      ]),
      companionSlotsListEl,
    ]
  );
  const companionSectionEl = createEl(
    doc,
    'div',
    { className: 'ups-companion-section', attrs: { 'data-ups-companion-section': 'true' } },
    [
      createEl(doc, 'div', { className: 'ups-row-between' }, [
        createEl(doc, 'div', { className: 'ups-row' }, [
          createEl(doc, 'span', { className: 'ups-label', text: '带其他角色亲友客串（可选）' }),
          companionBudgetBadgeEl,
        ]),
        createEl(doc, 'div', { className: 'ups-chip-group' }, [companionToggleBtn, companionAddBtn]),
      ]),
      companionBodyEl,
    ]
  );

  // Human-Ordered Left Pane: Mode & Character -> Step 1 (Idea/Old Persona + Optional Companion) -> Step 2 (Modules, Output & Generate)
  const leftPaneEl = createEl(
    doc,
    'div',
    { className: 'ups-pane-left', attrs: { 'data-ups-pane': 'left' } },
    [
      createEl(doc, 'div', { className: 'ups-card' }, [
        createEl(doc, 'div', { className: 'ups-mod-head' }, [
          createEl(doc, 'div', { className: 'ups-segmented' }, [modeABtn, modeBBtn]),
          syncHostBtn,
        ]),
        charAdaptBoxEl,
      ]),
      modeAPanel,
      modeBPanel,
      extractedPointsBox,
      companionSectionEl,
      createEl(doc, 'div', { className: 'ups-card' }, [
        createEl(doc, 'div', { className: 'ups-mod-head' }, [
          createEl(doc, 'span', { className: 'ups-mod-title', text: '第二步 · 生成板块与输出设置' }),
          popoverBtn,
        ]),
        createEl(doc, 'div', { className: 'ups-grid-2' }, [
          createEl(doc, 'div', { className: 'ups-field' }, [
            createEl(doc, 'label', { className: 'ups-label', text: '写作风格' }),
            schemeSelect,
          ]),
          createEl(doc, 'div', { className: 'ups-field' }, [
            createEl(doc, 'label', { className: 'ups-label', text: '目标字数' }),
            wordCountComboEl,
          ]),
        ]),
        createEl(doc, 'div', { className: 'ups-grid-2' }, [
          createEl(doc, 'div', { className: 'ups-field' }, [
            createEl(doc, 'label', { className: 'ups-label', text: '过往经历写法' }),
            backstorySelect,
          ]),
          createEl(doc, 'div', { className: 'ups-field' }, [
            createEl(doc, 'label', { className: 'ups-label', text: '日常与暗线重心' }),
            spotlightSelect,
          ]),
        ]),
        sectionsBarEl,
        splitBoxEl,
        generateARow,
        generateBRow,
      ]),
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
        createEl(doc, 'div', { className: 'ups-draft-toolbar', attrs: { 'data-ups-draft-toolbar': 'true' } }, [
          createEl(doc, 'span', { className: 'ups-draft-toolbar-hint', text: '成稿编辑快捷操作' }),
          createEl(doc, 'div', { className: 'ups-btn-row' }, [historyBtn, undoBtn, redoBtn, copyBtn, openDiffBtn]),
        ]),
        draftTextarea,
        selectionTasteBar,
        lintIssuesListEl,
        tasteCandidatesBox,
      ]),
      wbBox,
    ]
  );

  const studioTabPanel = createEl(
    doc,
    'section',
    { className: 'ups-tab-panel', hidden: state.activeTab !== 'studio', attrs: { 'data-ups-tab-panel': 'studio' } },
    [
      createEl(doc, 'div', { className: 'ups-workbench' }, [leftPaneEl, rightPaneEl]),
    ]
  );

  // ==========================================================================
  // Tab 2: 生成预设 (Presets, Favorite Pin, Reset, Drag-Reorder Accordion)
  // ==========================================================================

  const stackSchemeSelect = createEl(doc, 'select', {
    className: 'ups-select',
    style: { flex: '1 1 180px' },
    attrs: { 'aria-label': '选择编辑方案' },
  });
  const schemeFavLabelSpan = createEl(doc, 'span', { className: 'ups-btn-label', text: '置顶' });
  const schemeFavBtn = createEl(
    doc,
    'button',
    {
      type: 'button',
      className: 'ups-btn-sm ups-fav-btn',
      title: '置顶该方案并在选择框排在最顶部',
      attrs: { 'data-ups-scheme-fav': 'true' },
    },
    [
      createSvgIcon(doc, ['M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z'], 13),
      schemeFavLabelSpan,
    ]
  );
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
    placeholder: '搜索条目标题或内容……',
    attrs: { 'data-ups-stack-search': 'true' },
  });
  const addStackEntryBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn',
    text: '新增条目',
    attrs: { 'data-ups-add-entry': 'true' },
  });
  setButtonIconLabel(doc, addStackEntryBtn, '新增条目', ICON_PATHS.plus, { iconFirst: true });
  const stackListEl = createEl(doc, 'div', { className: 'ups-acc-list', attrs: { 'data-ups-acc-list': 'true' } });
  const syncedEntriesListEl = createEl(doc, 'div', { className: 'ups-synced-list', attrs: { 'data-ups-synced-list': 'true' } });

  const presetsTabPanel = createEl(
    doc,
    'section',
    { className: 'ups-tab-panel', hidden: state.activeTab !== 'presets', attrs: { 'data-ups-tab-panel': 'presets' } },
    [
      createEl(doc, 'div', { className: 'ups-card' }, [
        createEl(doc, 'div', { className: 'ups-mod-head' }, [
          createEl(doc, 'span', { className: 'ups-mod-title', text: '预设方案与导出' }),
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
        createEl(doc, 'details', { className: 'ups-advanced-details', attrs: { 'data-ups-preset-advanced': 'true' } }, [
          createEl(doc, 'summary', { text: '发散度（温度）、最大回复上限与收尾设置' }),
          createEl(doc, 'div', { className: 'ups-grid-2', style: { marginBottom: '8px' } }, [
            createEl(doc, 'div', { className: 'ups-field' }, [
              createEl(doc, 'label', { className: 'ups-label', text: '发散度（温度）' }),
              schemeTempInput,
            ]),
            createEl(doc, 'div', { className: 'ups-field' }, [
              createEl(doc, 'label', { className: 'ups-label', text: '最大回复字数（tokens）' }),
              schemeMaxTokensInput,
            ]),
          ]),
          createEl(doc, 'div', { className: 'ups-field', style: { marginBottom: '8px' } }, [
            createEl(doc, 'label', { className: 'ups-label', text: '收尾适配方式' }),
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
      createEl(doc, 'div', { className: 'ups-card', attrs: { 'data-ups-synced-entries': 'true' } }, [
        createEl(doc, 'div', { className: 'ups-mod-head' }, [
          createEl(doc, 'span', { className: 'ups-mod-title', text: '本次生成条目' }),
        ]),
        syncedEntriesListEl,
      ]),
      createEl(doc, 'div', { className: 'ups-card' }, [
        createEl(doc, 'div', { className: 'ups-mod-head' }, [
          createEl(doc, 'span', { className: 'ups-mod-title', text: '预设条目' }),
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
      createEl(doc, 'option', { value: 'smart_compact', text: '精简核心 + 我的禁写' }),
      createEl(doc, 'option', { value: 'personal_only', text: '仅发我标记的禁写' }),
      createEl(doc, 'option', { value: 'full', text: '完整发送启用词包' }),
    ]
  );

  const dedupTasteBtn = createEl(doc, 'button', { type: 'button', className: 'ups-btn-ghost', text: '去重整理' });
  const aiDistillTasteBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-ghost',
    text: 'AI 归纳整理',
    attrs: { 'data-ups-ai-distill': 'true' },
  });

  const builtinCategoriesContainer = createEl(doc, 'div', {
    className: 'ups-lexicon-list',
    attrs: { 'data-ups-builtin-packs': 'true' },
  });
  const builtinDetailsEl = createEl(doc, 'details', { className: 'ups-advanced-details' }, [
    createEl(doc, 'summary', {
      text: `查看或开关内置避雷词包（${BUILTIN_BANNED_CATEGORIES.length} 类 ${DEFAULT_BANNED_PHRASES.length} 条）`,
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
    placeholder: '添加喜欢的细节偏好，如：说话干脆利落、办事靠谱',
  });
  const addAnchorBtn = createEl(doc, 'button', { type: 'button', className: 'ups-btn', text: '添加喜好' });
  const addBannedInput = createEl(doc, 'input', {
    type: 'text',
    className: 'ups-input',
    placeholder: '添加禁写词句或句式毛病，如：少用“表面…实则…”句式 / 禁解释性说明',
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
            createEl(doc, 'div', { className: 'ups-muted', text: '过滤自夸吹捧、简历式空话与易反复打卡的微动作' }),
          ]),
          useBuiltinBannedBtn,
        ]),
        createEl(doc, 'div', { className: 'ups-setting-row' }, [
          createEl(doc, 'div', { className: 'ups-setting-meta' }, [
            createEl(doc, 'div', { className: 'ups-card-title', text: '生成时发给 AI 的禁词范围' }),
            createEl(doc, 'div', { className: 'ups-muted', text: '好模型可选“精简”或“仅个人禁写”节省上下文，本地仍全量检查' }),
          ]),
          bannedSendModeSelect,
        ]),
        builtinDetailsEl,
      ]),
      createEl(doc, 'div', { className: 'ups-card' }, [
        createEl(doc, 'div', { className: 'ups-mod-head' }, [
          createEl(doc, 'span', { className: 'ups-mod-title', text: '我的喜好与禁写词库' }),
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
  const profileSaveBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn ups-btn-primary',
    text: '保存方案',
    attrs: { 'data-ups-profile-save': 'true' },
  });
  const profileSaveHintEl = createEl(doc, 'span', {
    className: 'ups-muted',
    text: '修改参数后可点击保存确认',
    attrs: { 'data-ups-profile-save-hint': 'true' },
  });
  const testConnBtn = createEl(doc, 'button', {
    type: 'button',
    className: 'ups-btn-ghost',
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
        createEl(doc, 'label', { className: 'ups-label', text: '接口地址' }),
        apiUrlInput,
      ]),
      createEl(doc, 'div', { className: 'ups-field' }, [
        createEl(doc, 'div', { className: 'ups-row-between' }, [
          createEl(doc, 'label', { className: 'ups-label', text: '接口密钥' }),
          apiKeyMaskEl,
        ]),
        createEl(doc, 'div', { className: 'ups-row' }, [
          createEl(doc, 'div', { style: { flex: '1 1 160px' } }, [apiKeyInput]),
          toggleKeyVisBtn,
        ]),
      ]),
      createEl(doc, 'div', { className: 'ups-field' }, [
        createEl(doc, 'label', { className: 'ups-label', text: '模型名称' }),
        createEl(doc, 'div', { className: 'ups-row' }, [
          createEl(doc, 'div', { style: { flex: '1 1 160px' } }, [apiModelInput]),
          fetchModelsBtn,
        ]),
        apiModelSelect,
      ]),
      createEl(doc, 'div', { className: 'ups-grid-2' }, [
        createEl(doc, 'div', { className: 'ups-field' }, [
          createEl(doc, 'label', { className: 'ups-label', text: '发散度（温度）' }),
          apiTempInput,
        ]),
        createEl(doc, 'div', { className: 'ups-field' }, [
          createEl(doc, 'label', { className: 'ups-label', text: '最大回复上限' }),
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
          createEl(doc, 'div', { className: 'ups-label', text: '流式输出' }),
        ]),
        apiStreamSwitch,
      ]),
      createEl(doc, 'div', { className: 'ups-api-save-bar' }, [
        profileSaveBtn,
        profileSaveHintEl,
      ]),
      createEl(doc, 'details', { className: 'ups-advanced-details', attrs: { 'data-ups-conn-details': 'true' } }, [
        createEl(doc, 'summary', { text: '连接测试' }),
        createEl(doc, 'div', { className: 'ups-row' }, [testConnBtn, connStatusEl]),
      ]),
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
  const showCharAdaptBtnSwitch = createEl(
    doc,
    'button',
    {
      type: 'button',
      className: `ups-switch${settings.ui.showCharAdaptBtn !== false ? ' is-on' : ''}`,
      attrs: {
        role: 'switch',
        'aria-checked': String(settings.ui.showCharAdaptBtn !== false),
        'aria-label': '角色列表显示人设适配按钮',
        'data-ups-setting-char-adapt': 'true',
      },
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
            createEl(doc, 'div', { className: 'ups-label', text: '角色列表显示「人设适配」按钮' }),
          ]),
          showCharAdaptBtnSwitch,
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
    statusTextSpan.textContent = state.statusText;
    statusEl.title = state.statusText;
    statusEl.setAttribute('data-tone', tone);
    statusEl.classList.remove('is-flashing');
    statusEl.classList.add('is-flashing');
    if (state.statusFlashTimer) {
      clearTimeout(state.statusFlashTimer);
    }
    state.statusFlashTimer = setTimeout(() => {
      state.statusFlashTimer = null;
      statusEl.classList.remove('is-flashing');
    }, 880);
    state.statusFlashTimer?.unref?.();
    if (opts.toast || tone === 'warn' || tone === 'error') {
      showToast(state.statusText, tone === 'muted' ? 'info' : tone);
    }
  }

  function persistSettings() {
    Promise.resolve(hostApi.saveSettings(settings)).catch((err) => {
      setStatus(`配置保存提示：${err?.message || '已暂存内存'}`, 'warn');
    });
  }

  function resetStatusQuiet() {
    if (state.statusFlashTimer) {
      clearTimeout(state.statusFlashTimer);
      state.statusFlashTimer = null;
    }
    state.statusText = '就绪';
    state.statusTone = 'muted';
    statusTextSpan.textContent = '就绪';
    statusEl.title = '就绪';
    statusEl.setAttribute('data-tone', 'muted');
    statusEl.classList.remove('is-flashing');
    toastEl.hidden = true;
  }

  function recordHistorySnapshot(text, { mode = state.mode, label = '' } = {}) {
    const res = pushGenerationHistory(state.generationHistory, {
      text,
      mode,
      charName:
        state.charRealNameOverride ||
        state.cachedCharContext?.realName ||
        state.cachedCharContext?.name ||
        '',
      personaName: label || state.cachedActivePersona?.name || '',
    });
    if (res.added) {
      state.generationHistory = res.list;
      writeHistoryToStorage(res.list);
      if (!historyPopoverEl.hidden) {
        renderHistoryPopover();
      }
    }
    return res;
  }

  function renderHistoryPopover() {
    const list = Array.isArray(state.generationHistory) ? state.generationHistory : [];
    const clearAllBtn = createEl(doc, 'button', {
      type: 'button',
      className: 'ups-btn-sm',
      text: '清空历史',
      disabled: list.length === 0,
      attrs: { 'data-ups-history-clear': 'true' },
    });
    clearAllBtn.addEventListener('click', () => {
      state.generationHistory = [];
      writeHistoryToStorage([]);
      renderHistoryPopover();
      setStatus('已清空生成历史记录');
    });

    const headEl = createEl(doc, 'div', { className: 'ups-row-between' }, [
      createEl(doc, 'span', { className: 'ups-mod-title', text: `最近成稿历史（${list.length}/8）` }),
      clearAllBtn,
    ]);

    if (list.length === 0) {
      historyPopoverEl.replaceChildren(
        headEl,
        createEl(doc, 'div', {
          className: 'ups-muted',
          style: { padding: '8px 2px' },
          text: '暂无历史成稿记录（每次生成或覆盖前会自动保存最近 8 条）',
        })
      );
      return;
    }

    const itemsNodes = list.map((item) => {
      const preview = item.text.replace(/\s+/g, ' ').trim().slice(0, 84);
      const restoreItemBtn = createEl(doc, 'button', {
        type: 'button',
        className: 'ups-btn-sm',
        text: '填入编辑区',
        attrs: { 'data-ups-history-restore': item.id },
      });
      restoreItemBtn.addEventListener('click', () => {
        draftHistory.push(draftTextarea.value);
        setDraftValue(item.text, { recordHistory: true });
        historyPopoverEl.hidden = true;
        setStatus('✓ 已恢复历史成稿（可点撤销还原上一稿）', 'ok');
      });

      const deleteItemBtn = createEl(doc, 'button', {
        type: 'button',
        className: 'ups-btn-sm',
        text: '删除',
        attrs: { 'data-ups-history-delete': item.id },
      });
      deleteItemBtn.addEventListener('click', () => {
        state.generationHistory = state.generationHistory.filter((x) => x.id !== item.id);
        writeHistoryToStorage(state.generationHistory);
        renderHistoryPopover();
        setStatus('已删除一条历史记录');
      });

      return createEl(
        doc,
        'div',
        { className: 'ups-history-item', attrs: { 'data-ups-history-item': item.id } },
        [
          createEl(doc, 'div', { className: 'ups-history-meta' }, [
            createEl(doc, 'span', {
              className: 'ups-badge',
              text: `${item.chars || countReadableChars(item.text)} 字`,
            }),
            item.charName
              ? createEl(doc, 'span', { className: 'ups-muted', text: item.charName })
              : null,
          ]),
          createEl(doc, 'div', { className: 'ups-history-preview', text: preview }),
          createEl(doc, 'div', { className: 'ups-btn-row' }, [restoreItemBtn, deleteItemBtn]),
        ]
      );
    });

    historyPopoverEl.replaceChildren(
      headEl,
      createEl(doc, 'div', { className: 'ups-history-list' }, itemsNodes)
    );
  }

  function applyTheme() {
    const hostVars = readHostThemeVars(doc, win);
    const themeOpts = { palette: settings.palette, colorMode: settings.colorMode };
    applyThemeToRoot(backdropEl, themeOpts, hostVars);
    applyThemeToRoot(pillEl, themeOpts, hostVars);
    applyThemeToRoot(popoverEl, themeOpts, hostVars);
    applyThemeToRoot(floatingMenuEl, themeOpts, hostVars);
    applyThemeToRoot(wordCountMenuEl, themeOpts, hostVars);
    applyThemeToRoot(historyPopoverEl, themeOpts, hostVars);
    applyThemeToRoot(saveNameSubmodalEl, themeOpts, hostVars);
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
    const { vw, vh } = getSafeViewport(win, doc);
    updateCompactHeightClass(vw <= 640 ? vh : Math.min(700, Math.max(240, vh - 16)));
  }

  function syncUndoRedoButtons() {
    undoBtn.disabled = !draftHistory.canUndo();
    redoBtn.disabled = !draftHistory.canRedo();
  }

  function syncWordCountControls(scheme, { preserveFocusedText = false } = {}) {
    if (!scheme) return;
    const targetChars = Number(scheme.targetChars) || 1500;
    const isFocused = doc.activeElement === wordCountInput || shadow.activeElement === wordCountInput;
    if (!(preserveFocusedText && isFocused)) {
      wordCountInput.value = String(targetChars);
    }
  }

  function formatSchemeOptionText(s) {
    const star = s.favorite ? '★ ' : '';
    return `${star}${s.name}`;
  }

  function syncSplitHint() {
    const active = getActiveScheme(settings);
    const targetChars = Number(active?.targetChars) || 1500;
    const draftRaw = String(draftTextarea.value || '');
    const draftChars = countReadableChars(draftRaw);
    const shouldShow =
      targetChars >= 1500 ||
      state.companions.length > 0 ||
      draftChars >= 1500 ||
      draftRaw.trim().length >= 1500;
    splitBoxEl.hidden = !shouldShow;
    splitHintBtn.hidden = !shouldShow;
    splitHintBtn.classList.toggle('is-active', Boolean(state.dualLayer));
    splitHintBtn.textContent = state.dualLayer
      ? '✓ 长设定拆入世界书（已开启）'
      : '长设定拆入世界书';
    worldbookLightRowEl.hidden = !state.dualLayer;
    worldbookLightSelect.value = state.worldbookLightMode;
  }

  function syncSectionsSummary() {
    const cfg = normalizeGenerationSectionsConfig(state.generationSections);
    const layoutObj =
      GENERATION_LAYOUT_STYLES.find((s) => s.id === cfg.layoutStyle) || GENERATION_LAYOUT_STYLES[0];
    const totalCount = cfg.enabledIds.length + (cfg.customSections?.length || 0);
    sectionsSummaryEl.textContent = `${layoutObj.label} · 已选 ${totalCount} 个板块${
      state.pureCrossCardReuse ? ' · 通用跨卡' : ''
    }`;
  }

  function renderSectionsPanel() {
    const cfg = normalizeGenerationSectionsConfig(state.generationSections);
    state.generationSections = cfg;
    layoutStyleSelect.value = cfg.layoutStyle;
    pureReuseCheckbox.checked = Boolean(state.pureCrossCardReuse);
    syncSectionsSummary();
    for (const [k, inp] of ratioInputsMap.entries()) {
      if (doc.activeElement !== inp && shadow.activeElement !== inp) {
        inp.value = String(state.moduleRatios[k] ?? 0);
      }
    }
    for (const btn of sectionPresetBtns) {
      const pid = btn.getAttribute('data-ups-section-preset');
      btn.classList.toggle('is-active', cfg.presetId === pid);
    }

    const enabledSet = new Set(cfg.enabledIds);
    const groupNodes = GENERATION_SECTION_GROUPS.map((grp) => {
      const itemNodes = grp.items.map((item) => {
        const cb = createEl(doc, 'input', {
          type: 'checkbox',
          checked: enabledSet.has(item.id),
          attrs: { 'data-ups-section-cb': item.id },
        });
        cb.addEventListener('change', () => {
          const curSet = new Set(state.generationSections.enabledIds);
          if (cb.checked) curSet.add(item.id);
          else curSet.delete(item.id);
          state.generationSections = normalizeGenerationSectionsConfig({
            ...state.generationSections,
            presetId: 'custom',
            enabledIds: Array.from(curSet),
          });
          settings.ui.generationSections = state.generationSections;
          for (const b of sectionPresetBtns) b.classList.remove('is-active');
          syncSectionsSummary();
          if (state.activeTab === 'presets') renderSyncedEntriesBlock();
          persistSettings();
        });
        return createEl(doc, 'label', { className: 'ups-check-row ups-section-item' }, [
          cb,
          createEl(doc, 'span', { text: item.label }),
        ]);
      });
      return createEl(doc, 'div', { className: 'ups-section-group-box' }, [
        createEl(doc, 'div', { className: 'ups-chip-label', text: grp.label }),
        createEl(doc, 'div', { className: 'ups-section-items-grid' }, itemNodes),
      ]);
    });
    sectionGroupsContainerEl.replaceChildren(...groupNodes);

    const customPills = (cfg.customSections || []).map((cs) => {
      const delBtn = createEl(doc, 'button', {
        type: 'button',
        className: 'ups-tpl-del',
        title: `移除自定义板块「${cs.name}」`,
        attrs: { 'aria-label': `移除自定义板块 ${cs.name}` },
      }, [createSvgIcon(doc, ICON_PATHS.close, 12)]);
      delBtn.addEventListener('click', () => {
        state.generationSections = normalizeGenerationSectionsConfig({
          ...state.generationSections,
          customSections: state.generationSections.customSections.filter((x) => x.id !== cs.id),
        });
        settings.ui.generationSections = state.generationSections;
        renderSectionsPanel();
        if (state.activeTab === 'presets') renderSyncedEntriesBlock();
        persistSettings();
        setStatus(`已移除自定义板块：${cs.name}`);
      });
      return createEl(doc, 'span', { className: 'ups-tpl-pill' }, [
        createEl(doc, 'span', { className: 'ups-tpl-apply', text: cs.name }),
        delBtn,
      ]);
    });
    customSectionsListEl.replaceChildren(...customPills);
  }

  function syncTargetBookSelectOptions() {
    const books = Array.isArray(state.availableWorldbooks) ? state.availableWorldbooks : [];
    companionTargetBookSelect.hidden = state.companionCarryMode !== 'target_book';
    if (books.length === 0) {
      companionTargetBookSelect.replaceChildren(
        createEl(doc, 'option', { value: '', text: '暂无已有世界书（将自动新建）' })
      );
      return;
    }
    companionTargetBookSelect.replaceChildren(
      ...books.map((b) => createEl(doc, 'option', { value: b, text: b }))
    );
    if (state.companionTargetBook && books.includes(state.companionTargetBook)) {
      companionTargetBookSelect.value = state.companionTargetBook;
    } else {
      state.companionTargetBook = books[0];
      companionTargetBookSelect.value = books[0];
    }
  }

  async function refreshAvailableWorldbooks() {
    const books = await Promise.resolve(hostApi.listWorldbooks?.()).catch(() => []);
    state.availableWorldbooks = Array.isArray(books) ? books : [];
    syncTargetBookSelectOptions();
  }

  function buildActiveCompanionsPayload() {
    return state.companions.slice(0, 3).map((slot) => {
      const ctx = slot.cardContext || {};
      const selectedEntries = (slot.worldEntries || []).filter((e) =>
        slot.selectedWorldEntryKeys.has(e.entryKey)
      );
      const effectiveRealName = String(slot.realName || ctx.realName || '').trim();
      const rawCardName = String(ctx.name || slot.name || '').trim();
      return {
        id: slot.id,
        chid: slot.chid,
        avatar: ctx.avatar || slot.avatar || '',
        cardName: rawCardName,
        name: effectiveRealName || rawCardName,
        realName: effectiveRealName,
        relationToUser: String(slot.relationToUser || '亲友').trim() || '亲友',
        knowsMainChar: Boolean(slot.knowsMainChar),
        relationToMainChar: slot.knowsMainChar ? String(slot.relationToMainChar || '').trim() : '',
        frequency: slot.frequency || 'occasional',
        frequencyTier: slot.frequency || 'occasional',
        carryMode: state.companionCarryMode || 'inline',
        includeDialogueExamples: Boolean(slot.includeDialogueExamples),
        description: ctx.mergedDescription || ctx.description || '',
        personality: ctx.personality || '',
        scenario: ctx.scenario || '',
        firstMessage: ctx.firstMessage || '',
        mesExamples: slot.includeDialogueExamples ? ctx.mesExamples || '' : '',
        cardContext: {
          ...ctx,
          mesExamples: slot.includeDialogueExamples ? ctx.mesExamples || '' : '',
        },
        selectedWorldEntries: selectedEntries,
      };
    });
  }

  function updateCompanionBudgetBadge() {
    if (state.companions.length === 0) {
      companionBudgetBadgeEl.hidden = true;
      companionBudgetBadgeEl.textContent = '';
      return;
    }
    const plan = computeCompanionTokenPlan({
      personaText: draftTextarea.value || existingDraftInput.value || inspirationInput.value,
      mainCharContext: state.cachedCharContext,
      mainSelectedWorldEntries: (state.charWorldEntries || []).filter((e) =>
        state.selectedWorldEntryKeys.has(e.entryKey)
      ),
      companions: buildActiveCompanionsPayload(),
      maxContextTokens: 16000,
    });
    companionBudgetBadgeEl.hidden = false;
    companionBudgetBadgeEl.className = `ups-badge ${
      plan.headroomStatus === 'over'
        ? 'ups-badge-warn'
        : plan.headroomStatus === 'tight'
          ? 'ups-badge-warn'
          : 'ups-badge-ok'
    }`;
    companionBudgetBadgeEl.textContent =
      plan.headroomStatus === 'ok'
        ? `${state.companions.length}/3 位 · 余量充足`
        : plan.headroomStatus === 'tight'
          ? `${state.companions.length}/3 位 · 余量偏紧`
          : `${state.companions.length}/3 位 · 建议改用世界书承载`;
  }

  async function loadCompanionSlotContext(slot, { syncRealNameEl = null, wbContainerEl = null } = {}) {
    if (!slot || slot.chid === '' || slot.chid === undefined || slot.chid === null) {
      slot.cardContext = null;
      slot.worldEntries = [];
      slot.selectedWorldEntryKeys = new Set();
      updateCompanionBudgetBadge();
      return;
    }
    const ctx = await hostApi
      .getCharacterContext(
        { chid: String(slot.chid) },
        {
          includeWorldSummary: true,
          includeWorldEntries: true,
          includeDialogueExamples: Boolean(slot.includeDialogueExamples),
        }
      )
      .catch(() => null);
    if (!ctx) return;
    slot.cardContext = ctx;
    slot.avatar = ctx.avatar || slot.avatar;
    slot.name = ctx.name || slot.name;
    const resolvedReal =
      String(ctx.realName || '').trim() ||
      resolveCharacterRealName({
        name: ctx.name,
        description: ctx.mergedDescription || ctx.description,
        firstMessage: ctx.firstMessage,
        worldEntries: ctx.worldEntries,
      }).realName ||
      ctx.name ||
      '';
    if (!slot.userEditedRealName) {
      slot.realName = resolvedReal;
      if (syncRealNameEl) syncRealNameEl.value = resolvedReal;
    }
    const entries = Array.isArray(ctx.worldEntries) ? ctx.worldEntries : [];
    slot.worldEntries = entries;
    slot.selectedWorldEntryKeys = new Set(
      entries
        .filter((e) => e.defaultEnabled && classifyWorldbookEntry(e) !== 'system_format')
        .map((e) => e.entryKey)
    );
    if (wbContainerEl) {
      renderCompanionSlotWorldbook(slot, wbContainerEl);
    }
    updateCompanionBudgetBadge();
  }

  function renderCompanionSlotWorldbook(slot, containerEl) {
    const entries = slot.worldEntries || [];
    if (entries.length === 0) {
      containerEl.hidden = true;
      containerEl.replaceChildren();
      return;
    }
    containerEl.hidden = false;
    const countSelected = () => entries.filter((e) => slot.selectedWorldEntryKeys.has(e.entryKey)).length;
    const toggleBtn = createEl(doc, 'button', {
      type: 'button',
      className: 'ups-btn-sm',
      attrs: { 'data-ups-companion-wb-toggle': slot.id },
    });
    const listWrap = createEl(doc, 'div', { className: 'ups-wb-list', hidden: !slot.wbOpen });
    const rebuildList = () => {
      listWrap.hidden = !slot.wbOpen;
      setDisclosureLabel(doc, toggleBtn, `关联世界书 (${countSelected()}/${entries.length})`, slot.wbOpen);
      if (!slot.wbOpen) return;
      const rows = entries.map((entry) => {
        const cb = createEl(doc, 'input', {
          type: 'checkbox',
          checked: slot.selectedWorldEntryKeys.has(entry.entryKey),
          attrs: { 'data-ups-companion-wb-entry': entry.entryKey },
        });
        cb.addEventListener('change', () => {
          if (cb.checked) slot.selectedWorldEntryKeys.add(entry.entryKey);
          else slot.selectedWorldEntryKeys.delete(entry.entryKey);
          setDisclosureLabel(doc, toggleBtn, `关联世界书 (${countSelected()}/${entries.length})`, slot.wbOpen);
          updateCompanionBudgetBadge();
        });
        return createEl(doc, 'label', { className: 'ups-check-row' }, [
          cb,
          createEl(doc, 'span', { text: entry.comment || '未命名条目' }),
        ]);
      });
      listWrap.replaceChildren(...rows);
    };
    toggleBtn.addEventListener('click', () => {
      slot.wbOpen = !slot.wbOpen;
      rebuildList();
    });
    rebuildList();
    containerEl.replaceChildren(toggleBtn, listWrap);
  }

  function populateCompanionCharOptions(slot, selectEl) {
    const chars = state.cachedCharacters || [];
    const q = String(slot.searchQuery || '').trim().toLowerCase();
    const filtered = chars.filter((c) => {
      if (!q) return true;
      return String(c.name || '').toLowerCase().includes(q) || String(c.worldName || '').toLowerCase().includes(q);
    });
    if (filtered.length === 0) {
      selectEl.replaceChildren(createEl(doc, 'option', { value: '', text: q ? '无匹配角色' : '暂无可选角色' }));
      return;
    }
    selectEl.replaceChildren(
      ...filtered.map((c) => createEl(doc, 'option', { value: String(c.chid), text: c.name }))
    );
    if (slot.chid !== '' && filtered.some((c) => String(c.chid) === String(slot.chid))) {
      selectEl.value = String(slot.chid);
    } else {
      slot.chid = String(filtered[0].chid);
      slot.name = filtered[0].name || '';
      selectEl.value = slot.chid;
    }
  }

  function syncCompanionVisibility() {
    const isOpen = Boolean(state.companionOpen || state.companions.length > 0);
    companionBodyEl.hidden = !isOpen;
    companionSectionEl.classList.toggle('has-companions', state.companions.length > 0);
    companionToggleBtn.classList.toggle('is-active', isOpen);
    setDisclosureLabel(doc, companionToggleBtn, isOpen ? '收起' : '展开', isOpen);
  }

  function renderCompanionSlots() {
    companionAddBtn.disabled = state.companions.length >= 3;
    syncCompanionVisibility();
    if (state.companions.length === 0) {
      companionSlotsListEl.replaceChildren(
        createEl(doc, 'div', {
          className: 'ups-muted',
          text: '可从已有角色卡选择 1～3 位亲友或旧识一起出场，原句保留性格与说话习惯。',
        })
      );
      updateCompanionBudgetBadge();
      return;
    }

    const cards = state.companions.map((slot, idx) => {
      const compSearchInput = createEl(doc, 'input', {
        type: 'search',
        className: 'ups-input ups-input-sm',
        style: { flex: '0 1 115px' },
        value: slot.searchQuery || '',
        placeholder: '搜客串角色…',
        attrs: { 'data-ups-companion-search': 'true', 'aria-label': `搜索客串角色 ${idx + 1}` },
      });
      const compCharSelect = createEl(doc, 'select', {
        className: 'ups-select ups-input-sm',
        style: { flex: '1 1 130px' },
        attrs: {
          'data-ups-companion-char': 'true',
          'data-ups-companion-char-select': 'true',
          'aria-label': `选择客串角色 ${idx + 1}`,
        },
      });
      populateCompanionCharOptions(slot, compCharSelect);

      const compRealNameInput = createEl(doc, 'input', {
        type: 'text',
        className: 'ups-input ups-input-sm',
        style: { flex: '0 1 110px' },
        value: slot.realName || slot.name || '',
        placeholder: '卡中本名',
        attrs: { 'data-ups-companion-real-name': 'true', 'aria-label': '客串角色本名' },
      });
      const compRelationInput = createEl(doc, 'input', {
        type: 'text',
        className: 'ups-input ups-input-sm',
        style: { flex: '1 1 130px' },
        value: slot.relationToUser || '',
        placeholder: '与你的关系（如：哥哥、挚友）',
        attrs: { 'data-ups-companion-relation': 'true', 'aria-label': '与你的关系' },
      });
      const compFreqSelect = createEl(
        doc,
        'select',
        {
          className: 'ups-select ups-input-sm',
          style: { flex: '1 1 140px' },
          attrs: {
            'data-ups-companion-frequency': 'true',
            'data-ups-companion-freq': 'true',
            'aria-label': '客串出场频率',
          },
        },
        COMPANION_FREQUENCY_TIERS.map((t) => createEl(doc, 'option', { value: t.id, text: t.label }))
      );
      compFreqSelect.value = slot.frequency || 'occasional';

      const knowsMainCb = createEl(doc, 'input', {
        type: 'checkbox',
        checked: Boolean(slot.knowsMainChar),
        attrs: { 'data-ups-companion-knows-main': 'true' },
      });
      const mainRelInput = createEl(doc, 'input', {
        type: 'text',
        className: 'ups-input ups-input-sm',
        style: { flex: '1 1 130px' },
        hidden: !slot.knowsMainChar,
        value: slot.relationToMainChar || '',
        placeholder: '与主角色关系（如：旧部下）',
        attrs: { 'data-ups-companion-main-relation': 'true', 'aria-label': '与主角色关系' },
      });
      const dialogueExCb = createEl(doc, 'input', {
        type: 'checkbox',
        checked: Boolean(slot.includeDialogueExamples),
        attrs: { 'data-ups-companion-dialogue': 'true' },
      });
      const removeSlotBtn = createEl(doc, 'button', {
        type: 'button',
        className: 'ups-btn-sm',
        text: '移除',
        attrs: { 'data-ups-companion-remove': 'true' },
      });
      const slotWbContainerEl = createEl(doc, 'div', { className: 'ups-companion-wb', hidden: true });
      renderCompanionSlotWorldbook(slot, slotWbContainerEl);

      const relChips = COMPANION_RELATION_PRESETS.slice(0, 6).map((presetRel) => {
        const b = createEl(doc, 'button', {
          type: 'button',
          className: 'ups-btn-sm',
          text: presetRel,
        });
        b.addEventListener('click', () => {
          slot.relationToUser = presetRel;
          compRelationInput.value = presetRel;
        });
        return b;
      });

      compSearchInput.addEventListener('compositionstart', () => {
        slot.searchComposing = true;
      });
      compSearchInput.addEventListener('compositionend', () => {
        slot.searchComposing = false;
        slot.searchQuery = compSearchInput.value;
        populateCompanionCharOptions(slot, compCharSelect);
      });
      compSearchInput.addEventListener('input', (ev) => {
        if (slot.searchComposing || ev?.isComposing) return;
        slot.searchQuery = compSearchInput.value;
        populateCompanionCharOptions(slot, compCharSelect);
      });

      compCharSelect.addEventListener('change', () => {
        slot.chid = compCharSelect.value;
        slot.userEditedRealName = false;
        loadCompanionSlotContext(slot, { syncRealNameEl: compRealNameInput, wbContainerEl: slotWbContainerEl });
      });

      compRealNameInput.addEventListener('input', () => {
        slot.userEditedRealName = true;
        slot.realName = compRealNameInput.value.trim();
      });

      compRelationInput.addEventListener('input', () => {
        slot.relationToUser = compRelationInput.value;
      });

      compFreqSelect.addEventListener('change', () => {
        slot.frequency = compFreqSelect.value;
        updateCompanionBudgetBadge();
      });

      knowsMainCb.addEventListener('change', () => {
        slot.knowsMainChar = knowsMainCb.checked;
        mainRelInput.hidden = !slot.knowsMainChar;
      });

      mainRelInput.addEventListener('input', () => {
        slot.relationToMainChar = mainRelInput.value;
      });

      dialogueExCb.addEventListener('change', () => {
        slot.includeDialogueExamples = dialogueExCb.checked;
        loadCompanionSlotContext(slot, { syncRealNameEl: compRealNameInput, wbContainerEl: slotWbContainerEl });
      });

      removeSlotBtn.addEventListener('click', () => {
        state.companions = state.companions.filter((x) => x.id !== slot.id);
        if (state.companions.length === 0) {
          state.companionOpen = false;
        }
        renderCompanionSlots();
        syncSplitHint();
        setStatus('已移除客串角色');
      });

      if (!slot.cardContext && slot.chid !== '') {
        loadCompanionSlotContext(slot, { syncRealNameEl: compRealNameInput, wbContainerEl: slotWbContainerEl });
      }

      return createEl(
        doc,
        'div',
        { className: 'ups-companion-slot', attrs: { 'data-ups-companion-slot': slot.id } },
        [
          createEl(doc, 'div', { className: 'ups-row-between' }, [
            createEl(doc, 'span', { className: 'ups-label', text: `客串角色 ${idx + 1}` }),
            removeSlotBtn,
          ]),
          createEl(doc, 'div', { className: 'ups-row' }, [compSearchInput, compCharSelect, compRealNameInput]),
          createEl(doc, 'div', { className: 'ups-row' }, [compRelationInput, compFreqSelect]),
          createEl(doc, 'div', { className: 'ups-chip-group' }, relChips),
          createEl(doc, 'div', { className: 'ups-row' }, [
            createEl(doc, 'label', { className: 'ups-check-row' }, [
              knowsMainCb,
              createEl(doc, 'span', { text: '认识主角色' }),
            ]),
            mainRelInput,
            createEl(doc, 'label', { className: 'ups-check-row' }, [
              dialogueExCb,
              createEl(doc, 'span', { text: '附原卡台词示例' }),
            ]),
          ]),
          slotWbContainerEl,
        ]
      );
    });

    companionSlotsListEl.replaceChildren(...cards);
    updateCompanionBudgetBadge();
  }

  function renderMustHaveTray() {
    if (!Array.isArray(settings.ui.mustHaveTemplates)) {
      settings.ui.mustHaveTemplates = DEFAULT_MUST_HAVE_TEMPLATES.map((t) => ({ ...t }));
    }
    const templates = settings.ui.mustHaveTemplates;
    if (templates.length === 0) {
      const restoreBtn = createEl(doc, 'button', {
        type: 'button',
        className: 'ups-btn-sm',
        text: '恢复默认模板',
        attrs: { 'data-ups-restore-must-tpl': 'true' },
      });
      restoreBtn.addEventListener('click', () => {
        settings.ui.mustHaveTemplates = DEFAULT_MUST_HAVE_TEMPLATES.map((t) => ({ ...t }));
        renderMustHaveTray();
        persistSettings();
        setStatus('✓ 已恢复默认必带细节模板', 'ok');
      });
      mustHaveTrayEl.replaceChildren(
        createEl(doc, 'span', { className: 'ups-muted', text: '暂无模板' }),
        restoreBtn
      );
      return;
    }

    const pills = templates.map((tpl) => {
      const applyBtn = createEl(doc, 'button', {
        type: 'button',
        className: 'ups-tpl-apply',
        text: `+ ${tpl.label}`,
        title: tpl.content,
        attrs: { 'data-ups-must-tpl': tpl.id },
      });
      applyBtn.addEventListener('click', () => {
        const cur = mustHavesAInput.value.trim();
        if (!cur) {
          mustHavesAInput.value = tpl.content;
        } else if (!cur.includes(tpl.content)) {
          mustHavesAInput.value = `${cur}；${tpl.content}`;
        }
        flashButtonFeedback(applyBtn, '✓ 已填入', 900);
        setStatus(`✓ 已填入模板：${tpl.label}`, 'ok');
      });

      const delBtn = createEl(doc, 'button', {
        type: 'button',
        className: 'ups-tpl-del',
        title: `删除模板「${tpl.label}」`,
        attrs: { 'data-ups-del-must-tpl': tpl.id, 'aria-label': `删除模板 ${tpl.label}` },
      }, [createSvgIcon(doc, ICON_PATHS.close, 12)]);
      delBtn.addEventListener('click', () => {
        settings.ui.mustHaveTemplates = (settings.ui.mustHaveTemplates || []).filter((x) => x.id !== tpl.id);
        renderMustHaveTray();
        persistSettings();
        setStatus(`已移除模板：${tpl.label}`);
      });

      return createEl(doc, 'span', { className: 'ups-tpl-pill' }, [applyBtn, delBtn]);
    });
    mustHaveTrayEl.replaceChildren(...pills);
  }

  function syncPersonaSelectOptions(preferredAvatarId = '') {
    const list = state.cachedPersonas || [];
    const targetId = preferredAvatarId || personaPickerSelect.value || state.cachedActivePersona?.avatarId || '';
    const fillSelect = (sel) => {
      if (list.length > 0) {
        sel.replaceChildren(
          ...list.map((p) =>
            createEl(doc, 'option', { value: p.avatarId, text: p.isActive ? `${p.name}（当前）` : p.name })
          )
        );
        if (targetId && list.some((p) => p.avatarId === targetId)) {
          sel.value = targetId;
        }
      } else {
        sel.replaceChildren(createEl(doc, 'option', { value: '', text: '暂无可选人设' }));
      }
    };
    fillSelect(personaPickerSelect);
    fillSelect(pointsPersonaSelect);
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
      schemeMaxTokensInput.value = String(active.maxTokens ?? 5200);
      schemeDeleteBtn.disabled = Boolean(active.builtin) || schemes.length <= 1;
      schemeFavBtn.classList.toggle('is-fav', Boolean(active.favorite));
      schemeFavLabelSpan.textContent = active.favorite ? '已置顶' : '置顶';
      schemeResetBtn.hidden = !active.builtin;
      schemeResetBtn.disabled = !active.builtin || !isBuiltinSchemeModified(active);
    }
    syncSplitHint();
  }

  function renderExtractedPoints() {
    pointsNavEl.replaceChildren();
    const pts = state.extractedPoints || [];
    if (!state.pointsBoxOpen && pts.length === 0) {
      extractedPointsBox.hidden = true;
      pointsListEl.replaceChildren();
      return;
    }
    extractedPointsBox.hidden = false;
    const updateTotalCountLabel = () => {
      const keptCount = pts.filter((p) => state.selectedPointIds.has(p.id)).length;
      pointsCountLabel.textContent =
        pts.length > 0 ? `勾选保留原人设条目（已选 ${keptCount}/${pts.length}）` : '勾选保留原人设条目（0 条）';
    };
    updateTotalCountLabel();

    if (pts.length === 0) {
      pointsListEl.replaceChildren(
        createEl(doc, 'div', {
          className: 'ups-muted',
          style: { padding: '8px 10px' },
          text: '该人设暂无可拆分的正文内容，可在上方下拉框切换其他人设，或点右上角“退出沿用”。',
        })
      );
      return;
    }

    const groups = groupPersonaPoints(pts);
    const groupNodes = groups.map((group) => {
      const childRecords = [];
      const syncGroupHeaderState = (groupCb, countSpan) => {
        const checkedInGroup = childRecords.filter((r) => state.selectedPointIds.has(r.pt.id)).length;
        const allChecked = childRecords.length > 0 && checkedInGroup === childRecords.length;
        groupCb.checked = allChecked;
        groupCb.indeterminate = checkedInGroup > 0 && !allChecked;
        countSpan.textContent = `${checkedInGroup}/${childRecords.length}`;
      };

      const groupCountSpan = createEl(doc, 'span', { className: 'ups-badge', text: '' });
      const groupCb = createEl(doc, 'input', {
        type: 'checkbox',
        checked: false,
        attrs: { 'data-ups-point-group-cb': group.category },
      });

      const itemRows = group.items.map((pt) => {
        const checked = state.selectedPointIds.has(pt.id);
        const cb = createEl(doc, 'input', {
          type: 'checkbox',
          checked,
          attrs: { 'data-ups-point-cb': pt.id },
        });
        childRecords.push({ pt, cb });
        cb.addEventListener('change', () => {
          if (cb.checked) state.selectedPointIds.add(pt.id);
          else state.selectedPointIds.delete(pt.id);
          syncGroupHeaderState(groupCb, groupCountSpan);
          updateTotalCountLabel();
        });
        return createEl(doc, 'label', { className: 'ups-point-item' }, [
          cb,
          createEl(doc, 'span', { text: pt.text }),
        ]);
      });

      syncGroupHeaderState(groupCb, groupCountSpan);

      groupCb.addEventListener('change', () => {
        const wantCheck = Boolean(groupCb.checked);
        for (const rec of childRecords) {
          rec.cb.checked = wantCheck;
          if (wantCheck) state.selectedPointIds.add(rec.pt.id);
          else state.selectedPointIds.delete(rec.pt.id);
        }
        syncGroupHeaderState(groupCb, groupCountSpan);
        updateTotalCountLabel();
      });

      return createEl(
        doc,
        'div',
        { className: 'ups-point-group', attrs: { 'data-ups-point-group': group.category } },
        [
          createEl(doc, 'label', { className: 'ups-point-group-head' }, [
            groupCb,
            createEl(doc, 'span', { className: 'ups-point-cat', text: group.category }),
            groupCountSpan,
          ]),
          createEl(doc, 'div', { className: 'ups-point-group-items' }, itemRows),
        ]
      );
    });
    pointsListEl.replaceChildren(...groupNodes);
    pointsNavEl.replaceChildren(...groups.map((group, i) => {
      const jump = createEl(doc, 'button', { type: 'button', className: 'ups-lexicon-tab', text: group.category, attrs: { 'data-ups-point-jump': group.category } });
      jump.addEventListener('click', () => groupNodes[i].scrollIntoView?.({ block: 'nearest' }));
      return jump;
    }));
  }

  function renderWorldbookEntriesChecklist() {
    const entries = state.charWorldEntries || [];
    const total = entries.length;
    const selectedCount = entries.filter((e) => state.selectedWorldEntryKeys.has(e.entryKey)).length;

    if (total === 0) {
      wbPanelEl.hidden = true;
      wbListEl.replaceChildren();
      setDisclosureLabel(doc, wbToggleBtn, '世界书条目 (0/0)', false);
      return;
    }

    wbPanelEl.hidden = false;
    wbBodyEl.hidden = !state.worldEntriesOpen;
    setDisclosureLabel(doc, wbToggleBtn, `世界书条目 (${selectedCount}/${total})`, state.worldEntriesOpen);

    if (!state.worldEntriesOpen) {
      return;
    }

    const q = String(state.worldEntryFilter || '').trim().toLowerCase();
    const visible = entries.filter((e) => {
      if (!q) return true;
      return (
        String(e.comment || '').toLowerCase().includes(q) ||
        String(e.bookName || '').toLowerCase().includes(q) ||
        String(e.content || '').toLowerCase().includes(q) ||
        (e.keys || []).some((k) => String(k || '').toLowerCase().includes(q))
      );
    });

    if (visible.length === 0) {
      wbListEl.replaceChildren(
        createEl(doc, 'div', {
          className: 'ups-muted',
          style: { padding: '8px 10px' },
          text: q ? '没有匹配该筛选词的世界书条目' : '该角色卡关联的世界书暂无可注入条目',
        })
      );
      return;
    }

    const bookCount = new Set(entries.map((e) => e.bookName)).size;
    const rows = visible.map((entry) => {
      const checked = state.selectedWorldEntryKeys.has(entry.entryKey);
      const cls = classifyWorldbookEntry(entry);
      const cb = createEl(doc, 'input', {
        type: 'checkbox',
        checked,
        attrs: { 'data-ups-wb-entry': entry.entryKey },
      });
      cb.addEventListener('change', () => {
        if (cb.checked) state.selectedWorldEntryKeys.add(entry.entryKey);
        else state.selectedWorldEntryKeys.delete(entry.entryKey);
        state.hasExplicitWorldSelection = true;
        const curKey = getCharContextSelectionKey(state.cachedCharContext);
        if (curKey) state.worldSelectionCharKey = curKey;
        const nowCount = entries.filter((e) => state.selectedWorldEntryKeys.has(e.entryKey)).length;
        setDisclosureLabel(doc, wbToggleBtn, `世界书条目 (${nowCount}/${total})`, state.worldEntriesOpen);
        updateCompanionBudgetBadge();
      });

      const headNodes = [
        createEl(doc, 'span', { className: 'ups-wb-item-title', text: entry.comment || '未命名条目' }),
      ];
      if (cls === 'acting_rules') {
        headNodes.push(createEl(doc, 'span', { className: 'ups-badge ups-badge-ok', text: '演绎修正' }));
      } else if (cls === 'system_format') {
        headNodes.push(createEl(doc, 'span', { className: 'ups-badge', text: '格式状态' }));
      }
      if (bookCount > 1 && entry.bookName) {
        headNodes.push(createEl(doc, 'span', { className: 'ups-badge', text: entry.bookName }));
      }
      if (entry.constant) {
        headNodes.push(createEl(doc, 'span', { className: 'ups-badge ups-badge-ok', text: '常驻' }));
      }
      if (!entry.defaultEnabled) {
        headNodes.push(createEl(doc, 'span', { className: 'ups-badge ups-badge-warn', text: '原书未启用' }));
      }

      const previewText = entry.content.length > 96 ? `${entry.content.slice(0, 94)}…` : entry.content;
      return createEl(doc, 'label', { className: 'ups-wb-item' }, [
        cb,
        createEl(doc, 'div', { className: 'ups-wb-item-meta' }, [
          createEl(doc, 'div', { className: 'ups-wb-item-head' }, headNodes),
          createEl(doc, 'div', { className: 'ups-wb-item-preview', text: previewText }),
        ]),
      ]);
    });
    wbListEl.replaceChildren(...rows);
  }

  function renderMultiCharFocusBar() {
    const info = state.multiCharInfo;
    if (!info || !info.isMultiChar || !Array.isArray(info.characterEntries) || info.characterEntries.length === 0) {
      multiCharFocusBarEl.hidden = true;
      multiCharFocusBarEl.replaceChildren();
      return;
    }
    multiCharFocusBarEl.hidden = false;
    const selectedSet = new Set(state.selectedSubCharKeys);
    const chips = [
      createEl(doc, 'span', { className: 'ups-chip-label', text: '多人卡聚焦（不选则按群像全局）：' }),
      ...info.characterEntries.map((ce) => {
        const isPicked = selectedSet.has(ce.key);
        const chip = createEl(doc, 'button', {
          type: 'button',
          className: `ups-btn-sm${isPicked ? ' is-active' : ''}`,
          text: ce.name,
          attrs: { 'data-ups-subchar-chip': ce.key },
        });
        chip.addEventListener('click', () => {
          const cur = new Set(state.selectedSubCharKeys);
          if (cur.has(ce.key)) {
            cur.delete(ce.key);
          } else if (cur.size < 3) {
            cur.add(ce.key);
          } else {
            setStatus('多人卡单次最多聚焦 3 位子角色', 'warn');
            return;
          }
          state.selectedSubCharKeys = Array.from(cur);
          renderMultiCharFocusBar();
        });
        return chip;
      }),
    ];
    multiCharFocusBarEl.replaceChildren(...chips);
  }

  async function handlePickCharacterOption(val) {
    if (val === '__no_match__') return;
    state.charComboOpen = false;
    charComboMenuEl.hidden = true;
    charComboBtn.setAttribute('aria-expanded', 'false');
    const pickedCtx = await selectCharacterTarget(val, {
      openWorldbook: val !== '__none__',
      adaptFlow: Boolean(val && val !== '__none__'),
    });
    if (val === '__none__') {
      setStatus('已关闭角色卡背景注入');
    } else if (pickedCtx?.name) {
      setStatus(`✓ 已选择关联角色卡：${pickedCtx.name}`, 'ok', { toast: true });
    } else {
      setStatus('已恢复跟随当前对话角色');
    }
  }

  function renderCharacterSelectOptions() {
    const chars = state.cachedCharacters || [];
    const q = String(state.charSearchQuery || '').trim().toLowerCase();
    const filteredChars = chars.filter((c) => {
      if (!q) return true;
      return String(c.name || '').toLowerCase().includes(q) || String(c.worldName || '').toLowerCase().includes(q);
    });
    const activeChar = chars.find((c) => c.isActive) || null;
    const followLabel =
      activeChar && (!q || String(activeChar.name || '').toLowerCase().includes(q))
        ? `跟随当前对话角色（${activeChar.name}）`
        : '跟随当前对话角色';

    const items = [];
    if (!q) {
      items.push(
        { value: '', label: followLabel, disabled: false },
        { value: '__none__', label: '不关联角色卡（纯按灵感生成）', disabled: false }
      );
    } else if (filteredChars.length === 0) {
      items.push({ value: '__no_match__', label: '未找到匹配角色', disabled: true });
    }
    for (const c of filteredChars) {
      if (!q && c.isActive && String(c.chid) !== state.selectedCharTarget) continue;
      const suffixParts = [];
      if (c.isActive) suffixParts.push('当前对话');
      if (c.worldName && c.worldName !== c.name) suffixParts.push(c.worldName);
      const label = suffixParts.length > 0 ? `${c.name}（${suffixParts.join(' · ')}）` : c.name;
      items.push({ value: String(c.chid), label, disabled: false });
    }

    const opts = items.map((item) =>
      createEl(doc, 'option', { value: item.value, text: item.label, disabled: item.disabled })
    );
    charPickerSelect.replaceChildren(...opts);
    const curVal = state.selectedCharTarget || '';
    if (items.some((o) => o.value === curVal)) {
      charPickerSelect.value = curVal;
    } else if (items.length > 0) {
      charPickerSelect.value = items[0].value;
    }

    const comboButtons = items.map((item) => {
      const isSelected = !item.disabled && item.value === curVal;
      const btn = createEl(doc, 'button', {
        type: 'button',
        className: `ups-char-combo-opt${isSelected ? ' is-selected' : ''}`,
        text: item.label,
        disabled: item.disabled,
        attrs: { 'data-ups-char-opt': item.value },
      });
      if (!item.disabled) {
        btn.addEventListener('click', () => {
          handlePickCharacterOption(item.value);
        });
      }
      return btn;
    });
    charComboListEl.replaceChildren(...comboButtons);

    if (q) {
      const exactSelected = items.find((i) => !i.disabled && i.value === curVal);
      charComboLabelSpan.textContent = exactSelected
        ? exactSelected.label
        : `搜索结果（${filteredChars.length} 项）`;
    } else {
      const selectedItem = items.find((i) => i.value === curVal) || items[0];
      charComboLabelSpan.textContent = selectedItem ? selectedItem.label : followLabel;
    }
    charFollowActiveBtn.disabled = !state.selectedCharTarget;
  }

  function getCharContextSelectionKey(charCtx) {
    if (!charCtx || typeof charCtx !== 'object') return '';
    if (charCtx.characterId !== undefined && charCtx.characterId !== null && charCtx.characterId !== '') {
      return `id:${String(charCtx.characterId)}`;
    }
    if (charCtx.avatar) return `av:${String(charCtx.avatar)}`;
    if (charCtx.name) return `nm:${String(charCtx.name)}`;
    return '';
  }

  function computeIsCharAdaptFlow({
    mode = state.mode,
    subMode = state.subMode,
    selectedCharTarget = state.selectedCharTarget,
  } = {}) {
    const hasChosenChar = Boolean(selectedCharTarget && selectedCharTarget !== '__none__');
    const isCrossCardSubMode = mode === 'B' && subMode === 'cross_card_adapt';
    return hasChosenChar || isCrossCardSubMode;
  }

  function applyLoadedCharacterContext(charCtx, { preserveWorldSelection = false, openWorldbook = false } = {}) {
    state.cachedCharContext = charCtx || null;
    const entries = Array.isArray(charCtx?.worldEntries) ? charCtx.worldEntries : [];
    const nextCharKey = getCharContextSelectionKey(charCtx);
    const sameChar = Boolean(nextCharKey && state.worldSelectionCharKey && nextCharKey === state.worldSelectionCharKey);
    const prevSelected = preserveWorldSelection && sameChar ? new Set(state.selectedWorldEntryKeys) : null;
    state.charWorldEntries = entries;
    if (
      prevSelected &&
      (state.hasExplicitWorldSelection || entries.some((e) => prevSelected.has(e.entryKey)))
    ) {
      state.selectedWorldEntryKeys = new Set(
        entries.filter((e) => prevSelected.has(e.entryKey)).map((e) => e.entryKey)
      );
    } else {
      state.selectedWorldEntryKeys = new Set(
        entries
          .filter((e) => e.defaultEnabled && classifyWorldbookEntry(e) !== 'system_format')
          .map((e) => e.entryKey)
      );
      state.hasExplicitWorldSelection = false;
    }

    if (!charCtx) {
      state.realNameEditedForCharKey = '';
      state.charRealNameManualOpen = false;
      state.charRealNameOverride = '';
      charRealNameInput.value = '';
      charRealNameRowEl.hidden = true;
      charRealNameToggleBtn.hidden = true;
      charRealNameAutoBadgeEl.hidden = true;
      state.selectedSubCharKeys = [];
    } else {
      if (!sameChar) {
        state.charRealNameManualOpen = false;
        state.selectedSubCharKeys = [];
      }
      const resolvedReal =
        String(charCtx.realName || '').trim() ||
        resolveCharacterRealName({
          name: charCtx.name,
          description: charCtx.mergedDescription || charCtx.description,
          firstMessage: charCtx.firstMessage,
          worldEntries: entries,
        }).realName ||
        charCtx.name ||
        '';
      if (state.realNameEditedForCharKey !== nextCharKey) {
        state.charRealNameOverride = resolvedReal;
        charRealNameInput.value = resolvedReal;
      }
      const differsFromCard = Boolean(resolvedReal && charCtx.name && resolvedReal !== charCtx.name);
      const showRealRow =
        differsFromCard ||
        state.charRealNameManualOpen ||
        state.realNameEditedForCharKey === nextCharKey;
      charRealNameRowEl.hidden = !showRealRow;
      charRealNameToggleBtn.hidden = showRealRow;
      charRealNameAutoBadgeEl.hidden = !(differsFromCard && state.realNameEditedForCharKey !== nextCharKey);
    }

    state.multiCharInfo = charCtx ? detectMultiCharacterCard(charCtx, entries) : { isMultiChar: false, characterEntries: [] };
    renderMultiCharFocusBar();
    state.worldSelectionCharKey = nextCharKey;
    if (openWorldbook && entries.length > 0) {
      state.worldEntriesOpen = true;
    }

    if (charCtx?.name) {
      ctxChip.textContent = charCtx.isActive === false ? `适配 · ${charCtx.name}` : charCtx.name;
      ctxChip.hidden = false;
      const wbLabel =
        Array.isArray(charCtx.worldNames) && charCtx.worldNames.length > 0
          ? `（世界书：${charCtx.worldNames.join('、')}）`
          : charCtx.worldName
            ? `（世界书：${charCtx.worldName}）`
            : '';
      charContextHint.textContent = `${charCtx.isActive === false ? '已选关联角色' : '当前角色'}：${charCtx.name}${wbLabel}`;
    } else {
      ctxChip.hidden = true;
      charContextHint.textContent =
        state.selectedCharTarget === '__none__'
          ? '已关闭角色卡背景注入，将依据你的灵感与方案直接生成。'
          : '当前未打开角色卡，可在上方选择任意角色卡或直接按灵感生成。';
    }
    renderWorldbookEntriesChecklist();
    updateCompanionBudgetBadge();
  }

  async function selectCharacterTarget(targetRef, { openWorldbook = false, adaptFlow = false } = {}) {
    if (targetRef === '__none__') {
      const prevAdaptFlow = state.isCharAdaptFlow;
      state.selectedCharTarget = '__none__';
      state.injectChar = false;
      injectCharCheckbox.checked = false;
      settings.ui.injectChar = false;
      state.isCharAdaptFlow = computeIsCharAdaptFlow();
      renderCharacterSelectOptions();
      applyLoadedCharacterContext(null);
      if (
        prevAdaptFlow &&
        !state.isCharAdaptFlow &&
        state.mode === 'B' &&
        state.extractedPoints.length > 0 &&
        getDefaultPointsModeForCurrentFlow() === 'all'
      ) {
        state.selectedPointIds = new Set(state.extractedPoints.map((p) => p.id));
        renderExtractedPoints();
      }
      persistSettings();
      return null;
    }

    const isFollowActive = targetRef === '' || targetRef === null || targetRef === undefined;
    if (isFollowActive) {
      const prevAdaptFlow = state.isCharAdaptFlow;
      state.selectedCharTarget = '';
      state.injectChar = true;
      injectCharCheckbox.checked = true;
      settings.ui.injectChar = true;
      state.isCharAdaptFlow = computeIsCharAdaptFlow();
      renderCharacterSelectOptions();
      const charCtx = await hostApi
        .getCharacterContext(null, { includeWorldSummary: true, includeWorldEntries: true })
        .catch(() => hostApi.getActiveCharacterContext({ includeWorldSummary: true }).catch(() => null));
      applyLoadedCharacterContext(charCtx, { openWorldbook });
      if (
        prevAdaptFlow &&
        !state.isCharAdaptFlow &&
        state.mode === 'B' &&
        state.extractedPoints.length > 0 &&
        getDefaultPointsModeForCurrentFlow() === 'all'
      ) {
        state.selectedPointIds = new Set(state.extractedPoints.map((p) => p.id));
        renderExtractedPoints();
      }
      persistSettings();
      return charCtx;
    }

    const targetObj =
      typeof targetRef === 'object'
        ? targetRef
        : { chid: String(targetRef) };
    const charCtx = await hostApi
      .getCharacterContext(targetObj, { includeWorldSummary: true, includeWorldEntries: true })
      .catch(() => null);
    if (!charCtx) {
      return null;
    }
    const prevAdaptFlow = state.isCharAdaptFlow;
    state.selectedCharTarget = String(charCtx.characterId || targetObj.chid || '');
    state.injectChar = true;
    injectCharCheckbox.checked = true;
    settings.ui.injectChar = true;
    state.isCharAdaptFlow = Boolean(adaptFlow) || computeIsCharAdaptFlow();
    renderCharacterSelectOptions();
    applyLoadedCharacterContext(charCtx, { openWorldbook });
    if ((adaptFlow || !prevAdaptFlow) && state.isCharAdaptFlow && state.extractedPoints.length > 0) {
      state.selectedPointIds.clear();
      renderExtractedPoints();
    }
    persistSettings();
    return charCtx;
  }

  function getDefaultPointsModeForCurrentFlow() {
    if (
      state.mode === 'B' &&
      !state.isCharAdaptFlow &&
      (subModeSelect.value === 'de_label_reformat' || subModeSelect.value === 'core_expand')
    ) {
      return 'all';
    }
    return 'none';
  }

  function populateExtractedPointsFromText(rawText, { defaultMode = 'none', scrollToBox = false, keepOpen = true } = {}) {
    const pts = extractPersonaPoints(rawText, 60);
    state.extractedPoints = pts;
    state.pointsBoxOpen = Boolean(keepOpen && (pts.length > 0 || state.cachedPersonas.length > 0));
    state.selectedPointIds = new Set();
    for (const pt of pts) {
      if (defaultMode === 'all' || (defaultMode === 'smart' && pt.keepByDefault)) {
        state.selectedPointIds.add(pt.id);
      }
    }
    renderExtractedPoints();
    if (scrollToBox && !extractedPointsBox.hidden) {
      extractedPointsBox.classList.remove('ups-just-added');
      extractedPointsBox.classList.add('ups-just-added');
      extractedPointsBox.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
    }
    return pts;
  }

  function getCombinedLockedPointsText() {
    const lines = [];
    const sections = new Map();
    for (const point of state.extractedPoints) {
      if (!state.selectedPointIds.has(point.id)) continue;
      const field = /^(外貌与体型|性格与(?:行为)?逻辑)[：:]\s*(.+)$/u.exec(point.fullText);
      if (!field) {
        lines.push(`- ${point.fullText}`);
        continue;
      }
      const [, heading, body] = field;
      if (!sections.has(heading)) {
        const section = { heading, bodies: new Set() };
        sections.set(heading, section);
        lines.push(section);
      }
      sections.get(heading).bodies.add(body.trim());
    }
    const checkedText = lines.map((line) => {
      if (typeof line === 'string') return line;
      const bodies = [...line.bodies];
      return bodies.length === 1
        ? `- ${line.heading}：${bodies[0]}`
        : `${line.heading}：\n${bodies.map((body) => `- ${body}`).join('\n')}`;
    }).join('\n');
    return [checkedText, lockedCoreInput.value.trim()].filter(Boolean).join('\n');
  }

  function syncDraftRelatedViews() {
    const text = draftTextarea.value || '';
    const chars = countReadableChars(text);
    const tokens = estimateTokens(text);
    const active = getActiveScheme(settings);
    const targetChars = active?.targetChars || 1500;
    tokenBadgeEl.textContent = `${chars} 字 · 约 ${tokens} tokens（目标 ${targetChars} 字）`;
    viewDraftLogBtn.hidden = !settings.ui.debugAudit || !state.lastDraftLog;

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
      } else if (issue.match && !issue.noBanAction) {
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
    openDiffBtn.hidden = !(state.baselineDraft && text && state.baselineDraft.trim() !== text.trim());
    if (diffViewEl.parentElement === submodalBodyEl && !openDiffBtn.hidden) {
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
      const split = splitDualLayerOutput(text, { worldbookLightMode: state.worldbookLightMode });
      if (split.worldbookEntries.length > 0) {
        wbBox.hidden = false;
        wbPreviewText.textContent = `已解析 ${split.worldbookEntries.length} 条补充设定：${split.worldbookEntries
          .map((e) => `${e.comment}（${e.constant ? '蓝灯常驻' : '绿灯触发'}）`)
          .join('、')}`;
      } else {
        wbBox.hidden = true;
      }
    } else {
      wbBox.hidden = true;
    }
    syncSplitHint();
  }

  function setDraftValue(nextText, { recordHistory = true } = {}) {
    const { cleanText: val, draftLog } = stripDraftAuditBlocks(nextText);
    if (draftLog) state.lastDraftLog = draftLog;
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

  function renderSyncedEntriesBlock() {
    const active = getActiveScheme(settings);
    if (!active) return;
    const syncedItems = buildSyncedPreferenceEntries({ scheme: active, ui: settings.ui });
    const rows = syncedItems.map((item) => {
      const isExpanded = state.expandedSyncedIds.has(item.id);
      const bodyElNode = createEl(doc, 'div', {
        className: 'ups-synced-body',
        hidden: !isExpanded,
        text: item.content,
        attrs: { 'data-ups-synced-body': item.id },
      });
      const viewBtn = createEl(doc, 'button', {
        type: 'button',
        className: 'ups-btn-sm',
        text: isExpanded ? '收起内容' : '查看内容',
        attrs: { 'data-ups-synced-expand': item.id },
      });
      viewBtn.addEventListener('click', () => {
        if (state.expandedSyncedIds.has(item.id)) {
          state.expandedSyncedIds.delete(item.id);
          bodyElNode.hidden = true;
          viewBtn.textContent = '查看内容';
        } else {
          state.expandedSyncedIds.add(item.id);
          bodyElNode.hidden = false;
          viewBtn.textContent = '收起内容';
        }
      });

      const controls = [];
      if (item.id === 'ups_synced_worldbook') {
        const presetLightSelect = createEl(
          doc,
          'select',
          {
            className: 'ups-select ups-input-sm',
            style: { width: 'auto', maxWidth: '170px' },
            attrs: { 'data-ups-preset-wb-light': 'true', 'aria-label': '预设世界书蓝绿灯方式' },
          },
          WORLDBOOK_LIGHT_MODES.map((m) => createEl(doc, 'option', { value: m.id, text: m.shortLabel }))
        );
        presetLightSelect.value = state.worldbookLightMode;
        presetLightSelect.addEventListener('change', () => {
          state.worldbookLightMode = presetLightSelect.value;
          settings.ui.worldbookLightMode = state.worldbookLightMode;
          worldbookLightSelect.value = state.worldbookLightMode;
          renderSyncedEntriesBlock();
          syncDraftRelatedViews();
          persistSettings();
          const modeObj = WORLDBOOK_LIGHT_MODES.find((m) => m.id === state.worldbookLightMode);
          setStatus(`✓ 已切换世界书触发灯色：${modeObj?.label || state.worldbookLightMode}`, 'ok');
        });
        controls.push(presetLightSelect);
      }

      controls.push(viewBtn);

      if (item.toggleable) {
        const sw = createEl(
          doc,
          'button',
          {
            type: 'button',
            className: `ups-switch${item.enabled ? ' is-on' : ''}`,
            attrs: {
              role: 'switch',
              'aria-checked': String(Boolean(item.enabled)),
              'aria-label': `开关 ${item.name}`,
              'data-ups-synced-switch': item.key,
            },
          },
          [createEl(doc, 'span', { className: 'ups-switch-thumb' })]
        );
        sw.addEventListener('click', () => {
          if (item.key === 'dualLayer') {
            state.dualLayer = !state.dualLayer;
            settings.ui.dualLayer = state.dualLayer;
            dualLayerCheckbox.checked = state.dualLayer;
            syncDraftRelatedViews();
            renderSyncedEntriesBlock();
            persistSettings();
            setStatus(state.dualLayer ? '✓ 已在预设中开启长设定拆入世界书' : '已在预设中关闭长设定拆入世界书', 'ok');
          } else if (item.key === 'draftAudit') {
            state.draftAudit = !state.draftAudit;
            settings.ui.draftAudit = state.draftAudit;
            draftAuditCheckbox.checked = state.draftAudit;
            renderSyncedEntriesBlock();
            persistSettings();
            setStatus(state.draftAudit ? '✓ 已开启成稿前草稿自检条目' : '已关闭成稿前草稿自检条目', 'ok');
          }
        });
        controls.push(sw);
      } else {
        controls.push(createEl(doc, 'span', { className: 'ups-badge ups-badge-ok', text: '已启用' }));
      }

      return createEl(
        doc,
        'div',
        {
          className: `ups-synced-row${item.enabled ? '' : ' is-disabled'}`,
          attrs: { 'data-ups-synced-id': item.id },
        },
        [
          createEl(doc, 'div', { className: 'ups-synced-head' }, [
            createEl(doc, 'div', { style: { minWidth: '0', flex: '1 1 200px' } }, [
              createEl(doc, 'div', { className: 'ups-entry-main' }, [
                createEl(doc, 'span', { className: 'ups-badge', text: item.role }),
                createEl(doc, 'span', { className: 'ups-entry-title', text: item.name }),
              ]),
              createEl(doc, 'div', {
                className: 'ups-acc-preview',
                text: formatEntryPreviewText(item.content),
              }),
            ]),
            createEl(doc, 'div', { className: 'ups-chip-group' }, controls),
          ]),
          bodyElNode,
        ]
      );
    });
    syncedEntriesListEl.replaceChildren(...rows);
  }

  function renderStackTab() {
    const active = getActiveScheme(settings);
    if (!active) return;
    updateSchemeSelects();
    renderSyncedEntriesBlock();
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

      const dragHandleEl = createEl(
        doc,
        'span',
        {
          className: 'ups-drag-handle',
          title: '按住上下拖动调整顺序',
          draggable: true,
          attrs: { 'data-ups-drag-handle': entryId },
        },
        [
          createSvgIcon(
            doc,
            ['M9 5h.01', 'M9 12h.01', 'M9 19h.01', 'M15 5h.01', 'M15 12h.01', 'M15 19h.01'],
            14,
            2.6
          ),
        ]
      );

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
        text: formatEntryPreviewText(resolvePresetEntryPreview(cardState.entry, active, settings.tasteProfile)),
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

      // Wide-screen flat inline actions (drag-and-drop handles reordering; no ugly arrow buttons!)
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

      const moreBtn = createEl(
        doc,
        'button',
        {
          type: 'button',
          className: 'ups-more-btn',
          title: '更多操作',
          attrs: { 'aria-label': '更多操作' },
        },
        [createSvgIcon(doc, ['M5 12h.01', 'M12 12h.01', 'M19 12h.01'], 14, 2.6)]
      );

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
          const curActive = getActiveScheme(settings) || active;
          const budgetHint = curVal.includes('{{targetChars}}')
            ? (() => {
                const b = computeLengthBudget(curActive?.targetChars);
                return ` · 当前生效约 ${b.chars} 字（${b.charsMin}～${b.charsMax} 字）`;
              })()
            : '';
          entryStatsEl.textContent = `${cCount} 字 · 约 ${tCount} tokens${budgetHint}`;
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
          previewEl.textContent = formatEntryPreviewText(
            resolvePresetEntryPreview(cardState.entry, nextScheme, settings.tasteProfile)
          );
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
            createEl(doc, 'summary', { text: '修改条目名称与发送角色' }),
            createEl(doc, 'div', { className: 'ups-grid-2' }, [
              createEl(doc, 'div', { className: 'ups-field' }, [
                createEl(doc, 'label', { className: 'ups-label', text: '条目名称' }),
                nameEd,
              ]),
              createEl(doc, 'div', { className: 'ups-field' }, [
                createEl(doc, 'label', { className: 'ups-label', text: '发送角色' }),
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
      renderGroup('我不喜欢的禁写词句与句式规律', settings.tasteProfile.banned || [], 'banned', addBannedInput, addBannedBtn)
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
    showCharAdaptBtnSwitch.classList.toggle('is-on', settings.ui.showCharAdaptBtn !== false);
    showCharAdaptBtnSwitch.setAttribute('aria-checked', String(settings.ui.showCharAdaptBtn !== false));

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

  function syncFooterForTab(tabId = state.activeTab) {
    const isStudio = tabId === 'studio';
    saveOverwriteBtn.hidden = !isStudio;
    saveAsBtn.hidden = !isStudio;
    footerContextHintEl.hidden = isStudio;
  }

  function switchTab(tabId) {
    if (!tabButtons.has(tabId)) return;
    const prevTab = state.activeTab;
    state.activeTab = tabId;
    settings.ui.activeTab = tabId;
    popoverEl.hidden = true;
    wordCountMenuEl.hidden = true;
    historyPopoverEl.hidden = true;
    closeFloatingMenu();
    if (prevTab !== tabId) {
      resetStatusQuiet();
    }
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
    syncFooterForTab(tabId);

    if (tabId === 'presets') renderStackTab();
    if (tabId === 'taste') renderTasteTab();
    if (tabId === 'settings') renderSettingsTab();
    persistSettings();
  }

  function setMode(nextMode) {
    const prevMode = state.mode;
    state.mode = nextMode === 'B' ? 'B' : 'A';
    settings.ui.mode = state.mode;
    state.isCharAdaptFlow = computeIsCharAdaptFlow();
    modeABtn.classList.toggle('is-active', state.mode === 'A');
    modeBBtn.classList.toggle('is-active', state.mode === 'B');
    modeAPanel.hidden = state.mode !== 'A';
    modeBPanel.hidden = state.mode !== 'B';
    generateARow.hidden = state.mode !== 'A';
    generateBRow.hidden = state.mode !== 'B';

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
    wordCountMenuEl.hidden = true;
    historyPopoverEl.hidden = true;
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

  function inferSuggestedPersonaName() {
    const draft = String(draftTextarea.value || '');
    const m = draft.match(/(?:^|\n)\s*(?:[-*•]\s*)?(?:姓名|名字|名称|角色名)[:：]\s*([^\n，,（(]{1,28})/u);
    if (m && m[1].trim()) {
      return m[1].trim();
    }
    const baseName = String(state.cachedActivePersona?.name || '').trim();
    return baseName ? `${baseName}_工坊版` : '新人设';
  }

  function openSaveNameSubmodal() {
    popoverEl.hidden = true;
    wordCountMenuEl.hidden = true;
    historyPopoverEl.hidden = true;
    closeFloatingMenu();
    saveAsCardEl.classList.remove('is-floating');
    saveAsCardEl.style.left = '';
    saveAsCardEl.style.top = '';
    saveAsNameInput.value = inferSuggestedPersonaName();
    saveNameSubmodalEl.hidden = false;
    if (canAutoFocusDesktop(win)) {
      saveAsNameInput.focus?.();
      saveAsNameInput.select?.();
    }
  }

  function closeSaveNameSubmodal() {
    saveNameSubmodalEl.hidden = true;
  }

  saveAsCloseBtn.addEventListener('click', closeSaveNameSubmodal, { signal });
  saveAsCancelBtn.addEventListener('click', closeSaveNameSubmodal, { signal });
  saveAsConfirmBtn.addEventListener('click', async () => {
    const cleanName = saveAsNameInput.value.trim();
    if (!cleanName) {
      setStatus('请输入新人设名称后再保存', 'warn');
      return;
    }
    const ok = await saveCurrentPersona('create', cleanName);
    if (ok) {
      closeSaveNameSubmodal();
    }
  }, { signal });
  saveAsNameInput.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault?.();
      saveAsConfirmBtn.click();
    } else if (ev.key === 'Escape') {
      ev.preventDefault?.();
      closeSaveNameSubmodal();
    }
  }, { signal });

  let saveAsDrag = null;
  saveAsHeaderEl.addEventListener('pointerdown', (ev) => {
    if (ev.button !== undefined && ev.button !== 0) return;
    if (ev.target?.closest?.(INTERACTIVE_DRAG_IGNORE)) return;
    const r = saveAsCardEl.getBoundingClientRect();
    saveAsDrag = {
      pointerId: ev.pointerId,
      startX: ev.clientX,
      startY: ev.clientY,
      origLeft: r.left,
      origTop: r.top,
      width: r.width,
      height: r.height,
    };
    saveAsHeaderEl.setPointerCapture?.(ev.pointerId);
  }, { signal });
  saveAsHeaderEl.addEventListener('pointermove', (ev) => {
    if (!saveAsDrag || ev.pointerId !== saveAsDrag.pointerId) return;
    const pos = computeDraggedModalPosition({
      origLeft: saveAsDrag.origLeft,
      origTop: saveAsDrag.origTop,
      dx: ev.clientX - saveAsDrag.startX,
      dy: ev.clientY - saveAsDrag.startY,
      width: saveAsDrag.width,
      height: saveAsDrag.height,
      viewportWidth: win?.innerWidth || 1280,
      viewportHeight: win?.innerHeight || 800,
    });
    saveAsCardEl.classList.add('is-floating');
    saveAsCardEl.style.left = `${pos.left}px`;
    saveAsCardEl.style.top = `${pos.top}px`;
  }, { signal });
  const endSaveAsDrag = (ev) => {
    if (!saveAsDrag || ev.pointerId !== saveAsDrag.pointerId) return;
    try {
      saveAsHeaderEl.releasePointerCapture?.(ev.pointerId);
    } catch {
      // ignore
    }
    saveAsDrag = null;
  };
  saveAsHeaderEl.addEventListener('pointerup', endSaveAsDrag, { signal });
  saveAsHeaderEl.addEventListener('pointercancel', endSaveAsDrag, { signal });

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
      const selectedTarget =
        state.selectedCharTarget && state.selectedCharTarget !== '__none__'
          ? { chid: state.selectedCharTarget }
          : null;
      const charFetchPromise =
        state.selectedCharTarget === '__none__'
          ? Promise.resolve(null)
          : hostApi
              .getCharacterContext(selectedTarget, { includeWorldSummary: true, includeWorldEntries: true })
              .catch(() =>
                selectedTarget
                  ? null
                  : hostApi.getActiveCharacterContext({ includeWorldSummary: true }).catch(() => null)
              );

      const [activeP, allP, allChars, charCtx, worldbooks] = await Promise.all([
        hostApi.getActivePersona().catch(() => null),
        hostApi.listPersonas().catch(() => []),
        hostApi.listCharacters().catch(() => []),
        charFetchPromise,
        Promise.resolve(hostApi.listWorldbooks?.()).catch(() => []),
      ]);
      state.cachedActivePersona = activeP;
      state.cachedPersonas = Array.isArray(allP) ? allP : [];
      state.cachedCharacters = Array.isArray(allChars) ? allChars : [];
      state.availableWorldbooks = Array.isArray(worldbooks) ? worldbooks : [];

      renderCharacterSelectOptions();
      syncTargetBookSelectOptions();
      if (state.companions.length > 0) {
        renderCompanionSlots();
      }
      applyLoadedCharacterContext(charCtx, { preserveWorldSelection: true });

      syncPersonaSelectOptions(activeP?.avatarId || '');

      if (manual) {
        const nextSummary = `${activeP?.avatarId || ''}|${activeP?.description || ''}|${charCtx?.name || ''}`;
        const pName = activeP?.name || '无';
        const cName = charCtx?.name || '未选角色卡';
        flashButtonFeedback(syncHostBtn, '✓ 已同步');
        setStatus(
          prevSummary === nextSummary
            ? `✓ 已重新扫描刷新酒馆状态，无变动（人设：${pName}｜角色：${cName}）`
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

    const charContextForPrompt =
      state.injectChar && state.cachedCharContext
        ? {
            ...state.cachedCharContext,
            realName: state.charRealNameOverride || state.cachedCharContext.realName || '',
            ...(state.charWorldEntries.length > 0
              ? {
                  selectedWorldEntries: state.charWorldEntries.filter((e) =>
                    state.selectedWorldEntryKeys.has(e.entryKey)
                  ),
                }
              : {}),
          }
        : null;

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
      charContext: charContextForPrompt,
      selectedSubCharacterKeys: state.selectedSubCharKeys,
      existingDraft,
      lockedCore: getCombinedLockedPointsText(),
      userMustHaves,
      tasteProfile: settings.tasteProfile,
      dualLayer: state.dualLayer,
      worldbookLightMode: state.worldbookLightMode,
      visibilityTags: state.visibilityTags,
      draftAudit: state.draftAudit && !isSectionRegen,
      antiParrot: state.antiParrot,
      spotlightMode: state.spotlightMode,
      backstoryMode: state.backstoryMode,
      generationSections: state.generationSections,
      moduleRatios: state.moduleRatios,
      pureCrossCardReuse: state.pureCrossCardReuse,
      companions: buildActiveCompanionsPayload(),
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
        title: `提示词预览（约 ${built.estimatedTokens} tokens）`,
        bodyNodes: [pre],
        footerNodes: [closePreviewBtn, copyPromptBtn],
      });
    } catch (err) {
      setStatus(`提示词组装提示：${err.message}`, 'warn');
    }
  }

  openDiffBtn.addEventListener('click', () => {
    openSubmodal({ title: '修改对比', bodyNodes: [diffViewEl] });
    syncDraftRelatedViews();
  }, { signal });
  debugAuditCheckbox.addEventListener('change', () => {
    settings.ui.debugAudit = debugAuditCheckbox.checked;
    if (!settings.ui.debugAudit && submodalTitleEl.textContent === '自检记录') closeSubmodal();
    syncDraftRelatedViews(); persistSettings();
  }, { signal });
  viewDraftLogBtn.addEventListener('click', () => {
    if (!settings.ui.debugAudit || !state.lastDraftLog) return;
    const logArea = createEl(doc, 'textarea', {
      className: 'ups-textarea',
      rows: 10,
      readOnly: true,
      value: state.lastDraftLog,
    });
    const closeLogBtn = createEl(doc, 'button', { type: 'button', className: 'ups-btn-ghost', text: '关闭' });
    closeLogBtn.addEventListener('click', closeSubmodal);
    openSubmodal({
      title: '自检记录',
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

      if (prevDraftBeforeGen && prevDraftBeforeGen.trim()) {
        recordHistorySnapshot(prevDraftBeforeGen);
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
              setStatus('AI 正在完成构思自检，即将输出正文…');
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
      const cleaned = normalizeFlatLayout(strippedFinal.cleanText);
      if (!cleaned.trim()) {
        setDraftValue(prevDraftBeforeGen, { recordHistory: false });
        setStatus('没有收到成稿正文', 'warn');
        return;
      }
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
      recordHistorySnapshot(finalDraft);
      setStatus(
        targetSection ? `✓ 已重写「${targetSection}」` : '✓ 人设已生成',
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

  async function saveCurrentPersona(mode, explicitCreateName = '') {
    if (state.isSaving) return false;
    const rawDraft = stripDraftAuditBlocks(draftTextarea.value).cleanText.trim();
    if (!rawDraft) {
      setStatus('请先生成或填写人设正文后再保存', 'warn');
      return false;
    }
    const split = state.dualLayer
      ? splitDualLayerOutput(rawDraft, { worldbookLightMode: state.worldbookLightMode })
      : { coreDescription: rawDraft, worldbookEntries: [] };
    const description = split.coreDescription || rawDraft;

    state.isSaving = true;
    saveOverwriteBtn.disabled = true;
    saveAsBtn.disabled = true;
    saveAsConfirmBtn.disabled = true;
    try {
      if (!state.cachedActivePersona) {
        const fresh = await hostApi.getActivePersona?.().catch(() => null);
        if (fresh) state.cachedActivePersona = fresh;
      }

      const cleanCreateName = String(explicitCreateName ?? '').trim();
      const targetName =
        mode === 'create'
          ? cleanCreateName || `${state.cachedActivePersona?.name || '新人设'}_工坊版`
          : state.cachedActivePersona?.name || 'User';

      const activeComps = buildActiveCompanionsPayload();
      const hasDualEntries = state.dualLayer && split.worldbookEntries.length > 0;
      const hasCompBookEntries = activeComps.length > 0 && state.companionCarryMode !== 'inline';

      const dualManagedEntries = hasDualEntries
        ? split.worldbookEntries.map((e, idx) => ({
            ...e,
            extensions: {
              user_persona_studio: {
                managed: true,
                slotKey: `ups:dual:${idx + 1}:${String(e.comment || '补充').slice(0, 24)}`,
              },
            },
          }))
        : [];

      const compManagedEntries = hasCompBookEntries
        ? buildCompanionWorldbookEntries({
            companions: activeComps,
            companionPlans: computeCompanionTokenPlan({
              personaText: description,
              mainCharContext: state.cachedCharContext,
              mainSelectedWorldEntries: (state.charWorldEntries || []).filter((e) =>
                state.selectedWorldEntryKeys.has(e.entryKey)
              ),
              companions: activeComps,
              maxContextTokens: 16000,
            }),
            targetPersonaName: targetName,
            lightMode: state.worldbookLightMode === 'blue_constant' ? 'blue_constant' : 'green_selective',
          })
        : [];

      let finalLorebook = mode === 'create' ? '' : state.cachedActivePersona?.lorebook;

      if (hasCompBookEntries && state.companionCarryMode === 'target_book') {
        const targetWbName =
          state.companionTargetBook ||
          state.availableWorldbooks[0] ||
          wbNameInput.value.trim() ||
          `${targetName}_携伴设定`;
        await hostApi.saveSupplementaryWorldbook({
          worldName: targetWbName,
          entries: compManagedEntries,
          upsert: true,
          pruneManaged: true,
        });
        if (hasDualEntries) {
          const dualWbName = wbNameInput.value.trim() || `${targetName}_补充设定`;
          await hostApi.saveSupplementaryWorldbook({
            worldName: dualWbName,
            entries: dualManagedEntries,
            upsert: true,
            pruneManaged: true,
          });
          finalLorebook = dualWbName;
        }
      } else if (hasCompBookEntries || hasDualEntries) {
        const existingPersonaBook =
          mode === 'overwrite' ? String(state.cachedActivePersona?.lorebook || '').trim() : '';
        const defaultSuffix = hasCompBookEntries ? '携伴设定' : '补充设定';
        const wbName =
          wbNameInput.value.trim() || existingPersonaBook || `${targetName}_${defaultSuffix}`;
        await hostApi.saveSupplementaryWorldbook({
          worldName: wbName,
          entries: [...dualManagedEntries, ...compManagedEntries],
          upsert: true,
          pruneManaged: true,
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
      setStatus(
        `✓ 已${mode === 'create' ? '新建并切换' : '覆盖更新'}酒馆人设：${saved?.name || targetName}`,
        'ok',
        { toast: true }
      );
      return true;
    } catch (err) {
      setStatus(`保存人设失败：${err?.message || '宿主接口异常'}`, 'error');
      return false;
    } finally {
      state.isSaving = false;
      saveOverwriteBtn.disabled = false;
      saveAsBtn.disabled = false;
      saveAsConfirmBtn.disabled = false;
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
      uiPreferences: settings.ui,
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
    wordCountMenuEl.hidden = true;
    historyPopoverEl.hidden = true;
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

  historyBtn.addEventListener('click', () => {
    const willOpen = historyPopoverEl.hidden;
    popoverEl.hidden = true;
    wordCountMenuEl.hidden = true;
    closeFloatingMenu();
    historyPopoverEl.hidden = !willOpen;
    if (willOpen) {
      renderHistoryPopover();
      const r = historyBtn.getBoundingClientRect?.() || { left: 20, right: 120, bottom: 120, top: 80 };
      const vw = Number(win?.innerWidth || 1280);
      const vh = Number(win?.innerHeight || 800);
      const pw = Math.min(340, vw - 20);
      const ph = historyPopoverEl.offsetHeight || 280;
      const left = Math.max(10, Math.min(vw - pw - 10, r.left));
      const top = r.bottom + ph + 10 > vh ? Math.max(10, r.top - ph - 6) : Math.max(10, r.bottom + 6);
      historyPopoverEl.style.left = `${Math.round(left)}px`;
      historyPopoverEl.style.top = `${Math.round(top)}px`;
    }
  }, { signal });

  injectCharCheckbox.addEventListener('change', () => {
    state.injectChar = injectCharCheckbox.checked;
    settings.ui.injectChar = state.injectChar;
    if (!state.injectChar) {
      const prevAdaptFlow = state.isCharAdaptFlow;
      state.selectedCharTarget = '__none__';
      state.isCharAdaptFlow = computeIsCharAdaptFlow();
      renderCharacterSelectOptions();
      applyLoadedCharacterContext(null);
      if (
        prevAdaptFlow &&
        !state.isCharAdaptFlow &&
        state.mode === 'B' &&
        state.extractedPoints.length > 0 &&
        getDefaultPointsModeForCurrentFlow() === 'all'
      ) {
        state.selectedPointIds = new Set(state.extractedPoints.map((p) => p.id));
        renderExtractedPoints();
      }
    } else if (state.selectedCharTarget === '__none__') {
      selectCharacterTarget('', { adaptFlow: false });
      return;
    }
    persistSettings();
  }, { signal });

  charComboBtn.addEventListener('click', () => {
    state.charComboOpen = !state.charComboOpen;
    charComboMenuEl.hidden = !state.charComboOpen;
    charComboBtn.setAttribute('aria-expanded', String(state.charComboOpen));
    if (state.charComboOpen) {
      popoverEl.hidden = true;
      wordCountMenuEl.hidden = true;
      historyPopoverEl.hidden = true;
      closeFloatingMenu();
      if (canAutoFocusDesktop(win)) {
        charSearchInput.focus?.();
      }
    }
  }, { signal });

  charRealNameToggleBtn.addEventListener('click', () => {
    state.charRealNameManualOpen = true;
    charRealNameRowEl.hidden = false;
    charRealNameToggleBtn.hidden = true;
    if (canAutoFocusDesktop(win)) {
      charRealNameInput.focus?.();
      charRealNameInput.select?.();
    }
  }, { signal });

  charSearchInput.addEventListener('compositionstart', () => {
    state.charSearchComposing = true;
  }, { signal });
  charSearchInput.addEventListener('compositionend', () => {
    state.charSearchComposing = false;
    state.charSearchQuery = charSearchInput.value;
    renderCharacterSelectOptions();
  }, { signal });
  charSearchInput.addEventListener('input', (ev) => {
    if (state.charSearchComposing || ev?.isComposing) return;
    state.charSearchQuery = charSearchInput.value;
    renderCharacterSelectOptions();
  }, { signal });

  charRealNameInput.addEventListener('input', () => {
    const curKey = getCharContextSelectionKey(state.cachedCharContext) || '__manual__';
    state.realNameEditedForCharKey = curKey;
    charRealNameAutoBadgeEl.hidden = true;
    state.charRealNameOverride = charRealNameInput.value.trim();
  }, { signal });

  charPickerSelect.addEventListener('change', async () => {
    await handlePickCharacterOption(charPickerSelect.value);
  }, { signal });

  charFollowActiveBtn.addEventListener('click', async () => {
    const activeCtx = await selectCharacterTarget('', { openWorldbook: false, adaptFlow: false });
    flashButtonFeedback(charFollowActiveBtn, '✓ 已恢复');
    setStatus(
      activeCtx?.name
        ? `✓ 已恢复跟随当前对话角色：${activeCtx.name}`
        : '已恢复跟随当前对话角色',
      'ok'
    );
  }, { signal });

  wbToggleBtn.addEventListener('click', () => {
    state.worldEntriesOpen = !state.worldEntriesOpen;
    renderWorldbookEntriesChecklist();
  }, { signal });

  wbFilterInput.addEventListener('compositionstart', () => {
    state.worldEntryFilterComposing = true;
  }, { signal });
  wbFilterInput.addEventListener('compositionend', () => {
    state.worldEntryFilterComposing = false;
    state.worldEntryFilter = wbFilterInput.value;
    renderWorldbookEntriesChecklist();
  }, { signal });
  wbFilterInput.addEventListener('input', () => {
    if (state.worldEntryFilterComposing) return;
    state.worldEntryFilter = wbFilterInput.value;
    renderWorldbookEntriesChecklist();
  }, { signal });

  wbSelectAllBtn.addEventListener('click', () => {
    state.selectedWorldEntryKeys = new Set((state.charWorldEntries || []).map((e) => e.entryKey));
    state.hasExplicitWorldSelection = true;
    const curKey = getCharContextSelectionKey(state.cachedCharContext);
    if (curKey) state.worldSelectionCharKey = curKey;
    renderWorldbookEntriesChecklist();
    setStatus(`已全选 ${state.selectedWorldEntryKeys.size} 条世界书条目（仅本次生效，不改动原书）`);
  }, { signal });

  wbSelectDefaultBtn.addEventListener('click', () => {
    state.selectedWorldEntryKeys = new Set(
      (state.charWorldEntries || []).filter((e) => e.defaultEnabled).map((e) => e.entryKey)
    );
    state.hasExplicitWorldSelection = true;
    const curKey = getCharContextSelectionKey(state.cachedCharContext);
    if (curKey) state.worldSelectionCharKey = curKey;
    renderWorldbookEntriesChecklist();
    setStatus(`已恢复仅勾选原书启用条目（${state.selectedWorldEntryKeys.size} 条）`);
  }, { signal });

  wbSelectNoneBtn.addEventListener('click', () => {
    state.selectedWorldEntryKeys.clear();
    state.hasExplicitWorldSelection = true;
    const curKey = getCharContextSelectionKey(state.cachedCharContext);
    if (curKey) state.worldSelectionCharKey = curKey;
    renderWorldbookEntriesChecklist();
    setStatus('已取消全部世界书条目注入（仅本次生效，不改动原书）');
  }, { signal });

  dualLayerCheckbox.addEventListener('change', () => {
    state.dualLayer = dualLayerCheckbox.checked;
    settings.ui.dualLayer = state.dualLayer;
    syncDraftRelatedViews();
    if (state.activeTab === 'presets') renderSyncedEntriesBlock();
    persistSettings();
  }, { signal });

  worldbookLightSelect.addEventListener('change', () => {
    state.worldbookLightMode = worldbookLightSelect.value;
    settings.ui.worldbookLightMode = state.worldbookLightMode;
    syncDraftRelatedViews();
    if (state.activeTab === 'presets') renderSyncedEntriesBlock();
    persistSettings();
    const picked = WORLDBOOK_LIGHT_MODES.find((m) => m.id === state.worldbookLightMode);
    setStatus(`✓ 已切换世界书触发灯色：${picked?.label || state.worldbookLightMode}`, 'ok');
  }, { signal });

  draftAuditCheckbox.addEventListener('change', () => {
    state.draftAudit = draftAuditCheckbox.checked;
    settings.ui.draftAudit = state.draftAudit;
    if (state.activeTab === 'presets') renderSyncedEntriesBlock();
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

  modeABtn.addEventListener('click', () => setMode('A'), { signal });
  modeBBtn.addEventListener('click', () => setMode('B'), { signal });

  subModeSelect.addEventListener('change', () => {
    state.subMode = subModeSelect.value;
    settings.ui.subMode = state.subMode;
    state.isCharAdaptFlow = computeIsCharAdaptFlow();
    if (state.subMode === 'cross_card_adapt') {
      if (state.extractedPoints.length > 0) {
        state.selectedPointIds.clear();
        renderExtractedPoints();
      }
    } else if (!state.isCharAdaptFlow && state.extractedPoints.length > 0) {
      state.selectedPointIds = new Set(state.extractedPoints.map((p) => p.id));
      renderExtractedPoints();
    }
    persistSettings();
  }, { signal });

  spotlightSelect.addEventListener('change', () => {
    state.spotlightMode = spotlightSelect.value;
    settings.ui.spotlightMode = state.spotlightMode;
    if (state.activeTab === 'presets') renderSyncedEntriesBlock();
    persistSettings();
    const picked = SPOTLIGHT_MODES.find((m) => m.id === state.spotlightMode);
    setStatus(`已切换日常与暗线重心：${picked?.label || state.spotlightMode}`);
  }, { signal });

  backstorySelect.addEventListener('change', () => {
    state.backstoryMode = backstorySelect.value;
    settings.ui.backstoryMode = state.backstoryMode;
    if (state.activeTab === 'presets') renderSyncedEntriesBlock();
    persistSettings();
    const picked = BACKSTORY_MODES.find((m) => m.id === state.backstoryMode);
    setStatus(`已切换过往经历写法：${picked?.label || state.backstoryMode}`);
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

  function applyChosenTargetChars(rawChars, { quiet = false, preserveFocusedText = false } = {}) {
    const active = getActiveScheme(settings);
    if (!active) return;
    const nextScheme = applyTargetCharsToScheme(active, rawChars);
    settings.schemes = settings.schemes.map((s) => (s.id === active.id ? nextScheme : s));
    updateSchemeSelects();
    syncWordCountControls(nextScheme, { preserveFocusedText });
    syncDraftRelatedViews();
    if (state.activeTab === 'presets') renderStackTab();
    persistSettings();
    if (!quiet) {
      const budget = computeLengthBudget(nextScheme.targetChars);
      setStatus(
        `已设目标字数：约 ${budget.chars} 字（回复上限已联动调至 ${nextScheme.maxTokens} tokens）`
      );
    }
  }

  function commitWordCountInput({ quiet = false } = {}) {
    const raw = String(wordCountInput.value ?? '').trim();
    const active = getActiveScheme(settings);
    const fallback = Math.max(200, Math.min(12000, Math.round(Number(active?.targetChars) || 1500)));
    if (!raw) {
      applyChosenTargetChars(fallback, { quiet: true });
      wordCountInput.value = String(getActiveScheme(settings)?.targetChars || fallback);
      return;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      applyChosenTargetChars(fallback, { quiet: true });
      wordCountInput.value = String(getActiveScheme(settings)?.targetChars || fallback);
      return;
    }
    const clamped = Math.max(200, Math.min(12000, Math.round(parsed)));
    applyChosenTargetChars(clamped, { quiet });
    wordCountInput.value = String(clamped);
  }

  wordCountInput.addEventListener('input', () => {
    const raw = String(wordCountInput.value ?? '').trim();
    if (!raw) return;
    const num = Number(raw);
    if (Number.isFinite(num) && num >= 200 && num <= 12000) {
      applyChosenTargetChars(Math.round(num), { quiet: true, preserveFocusedText: true });
    }
  }, { signal });

  wordCountInput.addEventListener('change', () => {
    const raw = String(wordCountInput.value ?? '').trim();
    if (!raw || !Number.isFinite(Number(raw))) return;
    commitWordCountInput({ quiet: false });
  }, { signal });

  wordCountInput.addEventListener('blur', () => {
    commitWordCountInput({ quiet: true });
  }, { signal });

  wordCountMenuBtn.addEventListener('click', (ev) => {
    ev.stopPropagation?.();
    const willOpen = wordCountMenuEl.hidden;
    popoverEl.hidden = true;
    historyPopoverEl.hidden = true;
    closeFloatingMenu();
    wordCountMenuEl.hidden = !willOpen;
    if (willOpen) {
      const r = wordCountComboEl.getBoundingClientRect?.() || { left: 20, right: 160, bottom: 120, top: 88 };
      const vw = Number(win?.innerWidth || 1280);
      const vh = Number(win?.innerHeight || 800);
      const mw = wordCountMenuEl.offsetWidth || 168;
      const mh = wordCountMenuEl.offsetHeight || 150;
      const left = Math.max(8, Math.min(vw - mw - 8, r.right - mw));
      const top = r.bottom + mh + 8 > vh ? Math.max(8, r.top - mh - 4) : Math.max(8, r.bottom + 4);
      wordCountMenuEl.style.left = `${Math.round(left)}px`;
      wordCountMenuEl.style.top = `${Math.round(top)}px`;
    }
  }, { signal });

  for (const optBtn of wordCountMenuEl.querySelectorAll('[data-ups-word-count-option]')) {
    optBtn.addEventListener('click', () => {
      const chars = Number(optBtn.getAttribute('data-ups-word-count-option')) || 1500;
      wordCountMenuEl.hidden = true;
      wordCountInput.value = String(chars);
      applyChosenTargetChars(chars, { quiet: false });
    }, { signal });
  }

  ratioToggleBtn.addEventListener('click', () => {
    state.sectionsPanelOpen = !state.sectionsPanelOpen;
    if (state.sectionsPanelOpen) {
      renderSectionsPanel();
    }
    sectionsPanelEl.hidden = !state.sectionsPanelOpen;
    ratioToggleBtn.classList.toggle('is-active', state.sectionsPanelOpen);
    ratioToggleBtn.setAttribute('aria-expanded', String(state.sectionsPanelOpen));
    setDisclosureLabel(doc, ratioToggleBtn, state.sectionsPanelOpen ? '收起板块与比重' : '选择板块与比重', state.sectionsPanelOpen);
  }, { signal });

  layoutStyleSelect.addEventListener('change', () => {
    state.generationSections = normalizeGenerationSectionsConfig({
      ...state.generationSections,
      layoutStyle: layoutStyleSelect.value,
    });
    settings.ui.generationSections = state.generationSections;
    syncSectionsSummary();
    if (state.activeTab === 'presets') renderSyncedEntriesBlock();
    persistSettings();
    setStatus(`已切换输出版式：${layoutStyleSelect.options[layoutStyleSelect.selectedIndex]?.textContent || layoutStyleSelect.value}`);
  }, { signal });

  for (const btn of sectionPresetBtns) {
    btn.addEventListener('click', () => {
      const presetId = btn.getAttribute('data-ups-section-preset') || 'standard';
      state.generationSections = normalizeGenerationSectionsConfig({
        ...state.generationSections,
        presetId,
        enabledIds: GENERATION_SECTION_PRESETS[presetId],
      });
      settings.ui.generationSections = state.generationSections;
      renderSectionsPanel();
      if (state.activeTab === 'presets') renderSyncedEntriesBlock();
      persistSettings();
      setStatus(`已切换板块预设：${btn.textContent}`);
    }, { signal });
  }

  customSectionAddBtn.addEventListener('click', () => {
    const rawName = customSectionNameInput.value.trim();
    if (!rawName) {
      setStatus('请先输入自定义板块名称', 'warn');
      return;
    }
    const nextCustom = [
      ...(state.generationSections.customSections || []),
      {
        id: `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        name: rawName,
        guidance: '按玩家指定要求平实写清该板块核心事实。',
      },
    ];
    state.generationSections = normalizeGenerationSectionsConfig({
      ...state.generationSections,
      customSections: nextCustom,
    });
    settings.ui.generationSections = state.generationSections;
    customSectionNameInput.value = '';
    renderSectionsPanel();
    if (state.activeTab === 'presets') renderSyncedEntriesBlock();
    persistSettings();
    setStatus(`✓ 已添加自定义板块：${rawName}`, 'ok');
  }, { signal });

  pureReuseCheckbox.addEventListener('change', () => {
    state.pureCrossCardReuse = pureReuseCheckbox.checked;
    settings.ui.pureCrossCardReuse = state.pureCrossCardReuse;
    syncSectionsSummary();
    if (state.activeTab === 'presets') renderSyncedEntriesBlock();
    persistSettings();
    setStatus(state.pureCrossCardReuse ? '已开启通用人设跨卡复用' : '已关闭通用人设跨卡复用');
  }, { signal });

  for (const [key, inp] of ratioInputsMap.entries()) {
    const onRatioUpdate = () => {
      const raw = inp.value.trim();
      const num = Number(raw);
      if (raw !== '' && Number.isFinite(num)) {
        state.moduleRatios = normalizeModuleRatios({
          ...state.moduleRatios,
          mode: 'custom',
          [key]: Math.round(num),
        });
        settings.ui.moduleRatios = state.moduleRatios;
        persistSettings();
      }
    };
    inp.addEventListener('input', onRatioUpdate, { signal });
    inp.addEventListener('change', onRatioUpdate, { signal });
  }

  splitHintBtn.addEventListener('click', () => {
    state.dualLayer = !state.dualLayer;
    settings.ui.dualLayer = state.dualLayer;
    dualLayerCheckbox.checked = state.dualLayer;
    syncDraftRelatedViews();
    persistSettings();
    setStatus(
      state.dualLayer ? '✓ 已开启长设定拆入世界书' : '已关闭长设定拆入世界书',
      'ok'
    );
  }, { signal });

  lexiconToggleBtn.addEventListener('click', () => {
    state.lexiconOpen = !state.lexiconOpen;
    lexiconPanelEl.hidden = !state.lexiconOpen;
    lexiconToggleBtn.classList.toggle('is-active', state.lexiconOpen);
    lexiconToggleBtn.setAttribute('aria-expanded', String(state.lexiconOpen));
    setDisclosureLabel(doc, lexiconToggleBtn, '常用词库', state.lexiconOpen);
  }, { signal });

  companionToggleBtn.addEventListener('click', () => {
    state.companionOpen = !state.companionOpen;
    syncCompanionVisibility();
  }, { signal });

  companionCarryModeSelect.addEventListener('change', () => {
    state.companionCarryMode = companionCarryModeSelect.value;
    settings.ui.companionCarryMode = state.companionCarryMode;
    companionTargetBookSelect.hidden = state.companionCarryMode !== 'target_book';
    if (state.companionCarryMode === 'target_book') {
      refreshAvailableWorldbooks();
    }
    persistSettings();
    const picked = COMPANION_CARRY_MODES.find((m) => m.id === state.companionCarryMode);
    setStatus(`已切换客串存放位置：${picked?.label || state.companionCarryMode}`);
  }, { signal });

  companionTargetBookSelect.addEventListener('change', () => {
    state.companionTargetBook = companionTargetBookSelect.value;
    settings.ui.companionTargetBook = state.companionTargetBook;
    persistSettings();
  }, { signal });

  companionAddBtn.addEventListener('click', () => {
    if (state.companions.length >= 3) {
      companionAddBtn.disabled = true;
      setStatus('最多同时携带 3 位客串角色', 'warn');
      return;
    }
    state.companionOpen = true;
    const chars = state.cachedCharacters || [];
    const usedChids = new Set(state.companions.map((c) => String(c.chid)));
    const mainActiveChid = String(
      state.selectedCharTarget && state.selectedCharTarget !== '__none__'
        ? state.selectedCharTarget
        : chars.find((c) => c.isActive)?.chid ?? ''
    );
    const defaultChar =
      chars.find((c) => String(c.chid) !== mainActiveChid && !usedChids.has(String(c.chid))) ||
      chars.find((c) => !usedChids.has(String(c.chid))) ||
      chars[0] ||
      null;

    companionSeq += 1;
    const slot = {
      id: `comp_${Date.now().toString(36)}_${companionSeq}`,
      chid: defaultChar ? String(defaultChar.chid) : '',
      avatar: defaultChar?.avatar || '',
      name: defaultChar?.name || '',
      realName: defaultChar?.name || '',
      userEditedRealName: false,
      relationToUser: '亲友',
      knowsMainChar: false,
      relationToMainChar: '',
      frequency: 'occasional',
      includeDialogueExamples: false,
      searchQuery: '',
      searchComposing: false,
      cardContext: null,
      worldEntries: [],
      selectedWorldEntryKeys: new Set(),
      wbOpen: false,
    };
    state.companions.push(slot);
    renderCompanionSlots();
    syncSplitHint();
    setStatus(`✓ 已添加客串角色栏位（${state.companions.length}/3）`, 'ok');
  }, { signal });

  toggleVibeTrayBtn.addEventListener('click', () => {
    state.vibeTrayOpen = !state.vibeTrayOpen;
    vibeTrayEl.hidden = !state.vibeTrayOpen;
    toggleVibeTrayBtn.classList.toggle('is-active', state.vibeTrayOpen);
    toggleVibeTrayBtn.setAttribute('aria-expanded', String(state.vibeTrayOpen));
    setDisclosureLabel(doc, toggleVibeTrayBtn, '补充神韵词', state.vibeTrayOpen);
  }, { signal });

  toggleMustTrayBtn.addEventListener('click', () => {
    state.mustHaveTrayOpen = !state.mustHaveTrayOpen;
    if (state.mustHaveTrayOpen) {
      renderMustHaveTray();
    }
    mustHaveTrayEl.hidden = !state.mustHaveTrayOpen;
    toggleMustTrayBtn.classList.toggle('is-active', state.mustHaveTrayOpen);
    toggleMustTrayBtn.setAttribute('aria-expanded', String(state.mustHaveTrayOpen));
    setDisclosureLabel(doc, toggleMustTrayBtn, '常用模板', state.mustHaveTrayOpen);
  }, { signal });

  saveMustTplBtn.addEventListener('click', () => {
    const rawContent = mustHavesAInput.value.trim();
    if (!rawContent) {
      setStatus('请先在「必带细节」输入框写好想保存的细节，再点“存为模板”', 'warn');
      return;
    }
    const defaultLabel = rawContent.replace(/[，。；、！？\s]+/g, ' ').trim().slice(0, 10) || '常用细节';
    const tplLabelInput = createEl(doc, 'input', {
      type: 'text',
      className: 'ups-input',
      value: defaultLabel,
      placeholder: '模板短名称（如：刑侦搭档 / 不聊本行）',
      attrs: { 'data-ups-must-tpl-label': 'true' },
    });
    const tplContentInput = createEl(doc, 'textarea', {
      className: 'ups-textarea',
      rows: 3,
      value: rawContent,
      attrs: { 'data-ups-must-tpl-content': 'true' },
    });
    const cancelTplBtn = createEl(doc, 'button', { type: 'button', className: 'ups-btn-ghost', text: '取消' });
    cancelTplBtn.addEventListener('click', closeSubmodal);
    const confirmTplBtn = createEl(doc, 'button', {
      type: 'button',
      className: 'ups-btn ups-btn-primary',
      text: '保存模板',
      attrs: { 'data-ups-confirm-must-tpl': 'true' },
    });
    confirmTplBtn.addEventListener('click', () => {
      const content = tplContentInput.value.trim();
      if (!content) {
        setStatus('模板内容不能为空', 'warn');
        return;
      }
      const label = (tplLabelInput.value.trim() || content.slice(0, 10)).slice(0, 24);
      const nextList = Array.isArray(settings.ui.mustHaveTemplates) ? [...settings.ui.mustHaveTemplates] : [];
      nextList.push({
        id: `tpl_user_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        label,
        content,
      });
      settings.ui.mustHaveTemplates = nextList;
      state.mustHaveTrayOpen = true;
      renderMustHaveTray();
      mustHaveTrayEl.hidden = false;
      toggleMustTrayBtn.classList.add('is-active');
      toggleMustTrayBtn.setAttribute('aria-expanded', 'true');
      setDisclosureLabel(doc, toggleMustTrayBtn, '常用模板', true);
      persistSettings();
      closeSubmodal();
      flashButtonFeedback(saveMustTplBtn, '✓ 已保存');
      setStatus(`✓ 已保存必带细节模板：${label}`, 'ok', { toast: true });
    });
    openSubmodal({
      title: '保存为必带细节常用模板',
      bodyNodes: [
        createEl(doc, 'div', { className: 'ups-field' }, [
          createEl(doc, 'label', { className: 'ups-label', text: '模板名称' }),
          tplLabelInput,
        ]),
        createEl(doc, 'div', { className: 'ups-field' }, [
          createEl(doc, 'label', { className: 'ups-label', text: '模板内容' }),
          tplContentInput,
        ]),
      ],
      footerNodes: [cancelTplBtn, confirmTplBtn],
    });
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
    }
    if (freshActive) {
      state.cachedActivePersona = freshActive;
    }
    syncPersonaSelectOptions(freshActive?.avatarId || personaPickerSelect.value);
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
    if (picked?.avatarId) {
      syncPersonaSelectOptions(picked.avatarId);
    }
    const desc = String(picked?.description || existingDraftInput.value || draftTextarea.value || '').trim();
    if (!desc && state.cachedPersonas.length === 0) {
      setStatus('未检测到当前酒馆人设内容：请先在酒馆「用户人设」面板填写或新建人设', 'warn');
      return;
    }
    state.pointsBoxOpen = true;
    const pts = populateExtractedPointsFromText(desc, { defaultMode: 'none', scrollToBox: true, keepOpen: true });
    flashButtonFeedback(pickFromPersonaABtn, pts.length > 0 ? `✓ 已提取 ${pts.length} 条` : '✓ 已打开');
    setStatus(
      pts.length > 0
        ? `✓ 已从「${picked?.name || '当前人设'}」提取 ${pts.length} 条可勾选设定（默认未勾选，按需自选）`
        : '已打开原人设沿用面板，可在下拉框切换其他人设',
      'ok',
      { toast: true }
    );
  }, { signal });

  loadPersonaBtn.addEventListener('click', () => {
    const applyLoaded = (picked) => {
      const desc = String(picked?.description || '');
      if (!desc.trim()) {
        setStatus(`人设「${picked?.name || '当前人设'}」的描述内容为空，可换选其他人设或直接粘贴原稿`, 'warn');
        return;
      }
      if (picked?.avatarId) {
        syncPersonaSelectOptions(picked.avatarId);
      }
      existingDraftInput.value = desc;
      state.baselineDraft = desc;
      state.tasteBaselineDraft = desc;
      setDraftValue(desc, { recordHistory: true });
      const pts = populateExtractedPointsFromText(desc, {
        defaultMode: getDefaultPointsModeForCurrentFlow(),
        scrollToBox: false,
        keepOpen: true,
      });
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
    const pts = populateExtractedPointsFromText(src, {
      defaultMode: getDefaultPointsModeForCurrentFlow(),
      scrollToBox: true,
    });
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
    setStatus('已勾选核心外貌、性格与基础设定（排除当前卡身份）');
  }, { signal });

  pointsClearBtn.addEventListener('click', () => {
    state.selectedPointIds.clear();
    renderExtractedPoints();
    setStatus('已取消全部勾选');
  }, { signal });

  pointsPersonaSelect.addEventListener('change', async () => {
    const chosenId = pointsPersonaSelect.value;
    personaPickerSelect.value = chosenId;
    let picked = state.cachedPersonas.find((p) => p.avatarId === chosenId) || null;
    if (!picked) {
      await resolveSelectedOrActivePersona({ forceFresh: true });
      picked = state.cachedPersonas.find((p) => p.avatarId === chosenId) || null;
    }
    const desc = String(picked?.description || '');
    if (state.mode === 'B' && desc.trim()) {
      existingDraftInput.value = desc;
    }
    state.pointsBoxOpen = true;
    const pts = populateExtractedPointsFromText(desc, {
      defaultMode: getDefaultPointsModeForCurrentFlow(),
      scrollToBox: false,
      keepOpen: true,
    });
    setStatus(
      pts.length > 0
        ? `✓ 已切换原人设：「${picked?.name || '已选人设'}」（提取 ${pts.length} 条设定）`
        : `已切换至「${picked?.name || '已选人设'}」（该人设暂无正文内容）`,
      pts.length > 0 ? 'ok' : 'warn'
    );
  }, { signal });

  pointsCloseBtn.addEventListener('click', () => {
    state.pointsBoxOpen = false;
    state.extractedPoints = [];
    state.selectedPointIds.clear();
    renderExtractedPoints();
    setStatus('已退出原人设沿用面板');
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
      selectionSnippetEl.textContent = `已框选：「${shortText}」—— 可选句式问题/解释性语言等原因，或点右侧 AI 归纳规律：`;
    } else {
      selectionSnippetEl.textContent = '拖选正文词句可标记喜欢，或按「句式问题 / 解释性语言」归入禁写规律';
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
    draftDistillTasteBtn,
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
    setStatus('✓ 已从正文中删去所选词句（可点成稿上方“撤销修改”还原）', 'ok');
  }, { signal });

  draftTextarea.addEventListener('select', () => captureDraftSelection({ clearIfCollapsed: false }), { signal });
  draftTextarea.addEventListener('mouseup', () => captureDraftSelection({ clearIfCollapsed: true }), { signal });
  draftTextarea.addEventListener('keyup', () => captureDraftSelection({ clearIfCollapsed: true }), { signal });
  draftTextarea.addEventListener('touchend', () => captureDraftSelection({ clearIfCollapsed: false }), { signal });

  draftTextarea.addEventListener('input', () => {
    const parsed = stripDraftAuditBlocks(draftTextarea.value);
    if (parsed.draftLog || parsed.hasUnclosedDraft || /【\s*草稿自检\s*】/.test(draftTextarea.value)) {
      state.lastDraftLog = parsed.draftLog;
      draftTextarea.value = parsed.cleanText;
    }
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
        aiDistillTasteBtn.textContent = 'AI 归纳整理';
        draftDistillTasteBtn.textContent = 'AI 归纳禁写规律';
      }
    }
  }

  draftDistillTasteBtn.addEventListener('click', () => {
    const sel = readDraftSelectionFromControl() || state.draftSelection;
    if (sel?.text) {
      settings.tasteProfile.banned = mergeTasteEntries(settings.tasteProfile.banned, [
        { text: sel.text, note: '成稿框选不喜欢的句式或解释性表达（待归纳）' },
      ]);
      renderTasteTab();
      persistSettings();
    } else if ((settings.tasteProfile.anchors || []).length + (settings.tasteProfile.banned || []).length === 0) {
      const baseline = state.tasteBaselineDraft || state.baselineDraft || existingDraftInput.value || '';
      const diffCands = extractTasteCandidates(baseline, draftTextarea.value || '', settings.tasteProfile);
      if (diffCands.bannedCandidates.length > 0 || diffCands.anchorCandidates.length > 0) {
        settings.tasteProfile.banned = mergeTasteEntries(
          settings.tasteProfile.banned,
          diffCands.bannedCandidates.map((c) => ({ text: c.text, note: c.reason }))
        );
        settings.tasteProfile.anchors = mergeTasteEntries(
          settings.tasteProfile.anchors,
          diffCands.anchorCandidates.map((c) => ({ text: c.text, note: c.reason }))
        );
        renderTasteTab();
        persistSettings();
      }
    }
    if ((settings.tasteProfile.anchors || []).length + (settings.tasteProfile.banned || []).length > 0) {
      draftDistillTasteBtn.textContent = state.isDistillingTaste ? 'AI 归纳禁写规律' : '停止归纳';
    }
    runAiTasteDistillation();
  }, { signal });

  extractTasteBtn.addEventListener('click', runTasteCandidateExtraction, { signal });
  confirmTasteBtn.addEventListener('click', confirmTasteCandidates, { signal });
  confirmAndDistillTasteBtn.addEventListener('click', () => {
    confirmTasteCandidates();
    runAiTasteDistillation();
  }, { signal });

  saveWbBtn.addEventListener('click', async () => {
    const split = splitDualLayerOutput(draftTextarea.value, { worldbookLightMode: state.worldbookLightMode });
    if (!split.worldbookEntries.length) {
      setStatus('未解析到补充世界书条目', 'warn');
      return;
    }
    const worldName = wbNameInput.value.trim() || `${state.cachedActivePersona?.name || 'User人设'}_补充设定`;
    try {
      const res = await hostApi.saveSupplementaryWorldbook({
        worldName,
        entries: split.worldbookEntries,
        avatarId: state.cachedActivePersona?.avatarId,
        upsert: true,
      });
      setStatus(`✓ 已保存 ${res.entryCount} 条补充世界书到「${res.worldName}」`, 'ok', { toast: true });
    } catch (err) {
      setStatus(`保存世界书失败：${err?.message || '宿主接口异常'}`, 'error');
    }
  }, { signal });

  saveOverwriteBtn.addEventListener('click', () => saveCurrentPersona('overwrite'), { signal });
  saveAsBtn.addEventListener('click', () => openSaveNameSubmodal(), { signal });

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
      title: '自定义导出酒馆预设',
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
      smart_compact: '精简核心 + 我的禁写',
      personal_only: '仅发我标记的禁写',
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

  profileSaveBtn.addEventListener('click', () => {
    const active = ensureActiveProfileForEdits({ syncInputs: false });
    const typedName = profileNameInput.value.trim();
    if (typedName) {
      active.name = typedName;
    }
    const rawUrl = apiUrlInput.value.trim();
    if (rawUrl) {
      try {
        const normalized = normalizeBaseUrl(rawUrl);
        active.baseUrl = normalized;
        apiUrlInput.value = normalized;
      } catch (err) {
        setStatus(`接口地址格式提醒：${err.message}`, 'warn');
        return;
      }
    } else {
      active.baseUrl = '';
    }
    active.apiKey = apiKeyInput.value;
    active.model = apiModelInput.value.trim();
    renderSettingsTab();
    persistSettings();
    flashButtonFeedback(profileSaveBtn, '✓ 已保存方案');
    profileSaveHintEl.textContent = `✓ 已保存方案「${active.name}」`;
    setStatus(`✓ 已保存自定义 API 方案：「${active.name}」`, 'ok', { toast: true });
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

  showCharAdaptBtnSwitch.addEventListener('click', () => {
    settings.ui.showCharAdaptBtn = settings.ui.showCharAdaptBtn === false;
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
    wordCountMenuEl.hidden = true;
    historyPopoverEl.hidden = true;
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
      wordCountMenuEl.hidden = true;
      historyPopoverEl.hidden = true;
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
    if (
      popoverEl.hidden &&
      floatingMenuEl.hidden &&
      wordCountMenuEl.hidden &&
      historyPopoverEl.hidden &&
      charComboMenuEl.hidden
    ) {
      return;
    }
    const path = typeof ev.composedPath === 'function' ? ev.composedPath() : [ev.target];
    const insideNode = (container) =>
      path.includes(container) || (ev.target && container.contains?.(ev.target));

    if (!popoverEl.hidden && !insideNode(popoverEl) && !insideNode(popoverBtn)) {
      popoverEl.hidden = true;
    }
    if (!wordCountMenuEl.hidden && !insideNode(wordCountMenuEl) && !insideNode(wordCountMenuBtn)) {
      wordCountMenuEl.hidden = true;
    }
    if (!historyPopoverEl.hidden && !insideNode(historyPopoverEl) && !insideNode(historyBtn)) {
      historyPopoverEl.hidden = true;
    }
    if (!charComboMenuEl.hidden && !insideNode(charComboMenuEl) && !insideNode(charComboBtn)) {
      state.charComboOpen = false;
      charComboMenuEl.hidden = true;
      charComboBtn.setAttribute('aria-expanded', 'false');
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

  // Viewport & zoom resize clamping (Gate 10: soft-keyboard height-only resize NEVER closes focused search/input popovers!)
  const handleViewportResize = () => {
    if (!state.isOpen) return;
    const { vw, vh } = getSafeViewport(win, doc);
    const widthChanged = Math.abs(vw - (state.lastViewportWidth || vw)) > 40;
    state.lastViewportWidth = vw;
    const activeShadowEl = shadow.activeElement || null;
    const isInputFocused = Boolean(
      activeShadowEl && (activeShadowEl.tagName === 'INPUT' || activeShadowEl.tagName === 'TEXTAREA')
    );

    if (widthChanged || !isInputFocused) {
      if (!popoverEl.contains?.(activeShadowEl)) popoverEl.hidden = true;
      if (!wordCountMenuEl.contains?.(activeShadowEl)) wordCountMenuEl.hidden = true;
      if (!historyPopoverEl.contains?.(activeShadowEl)) historyPopoverEl.hidden = true;
      if (!floatingMenuEl.contains?.(activeShadowEl)) closeFloatingMenu();
      if (!charComboMenuEl.contains?.(activeShadowEl)) {
        state.charComboOpen = false;
        charComboMenuEl.hidden = true;
        charComboBtn.setAttribute('aria-expanded', 'false');
      }
    }

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
          marginTop: 8,
          marginBottom: 0,
          allowFullViewport: true,
        })
      );
    } else {
      updateCompactHeightClass(Math.min(700, Math.max(240, vh - 16)));
      const r = modalEl.getBoundingClientRect?.();
      if (r && r.top < 4) {
        applyRectToModal(
          clampModalRect({
            left: r.left,
            top: 8,
            width: r.width,
            height: r.height,
            viewportWidth: vw,
            viewportHeight: vh,
            marginX: 8,
            marginTop: 8,
            marginBottom: 8,
            allowFullViewport: true,
          })
        );
      }
    }
  };

  if (win && typeof win.addEventListener === 'function') {
    win.addEventListener('resize', handleViewportResize, { signal });
    win.visualViewport?.addEventListener?.('resize', handleViewportResize, { signal });
  }

  // ==========================================================================
  // Public Lifecycle API
  // ==========================================================================

  function open(openOpts = {}) {
    applyTheme();
    updateSchemeSelects();
    syncSectionsSummary();
    syncCompanionVisibility();
    syncDraftRelatedViews();
    syncFooterForTab(state.activeTab);
    state.isOpen = true;
    backdropEl.hidden = false;
    if (state.minimized) {
      restore();
    } else {
      pillEl.hidden = true;
      backdropEl.classList.remove('is-minimized');
      backdropEl.removeAttribute('aria-hidden');
      const { vw, vh } = getSafeViewport(win, doc);
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
            marginTop: 8,
            marginBottom: 0,
            allowFullViewport: true,
          })
        );
      } else {
        modalEl.classList.remove('is-mini');
        clearFloatingRectOnModal();
      }
    }

    const refreshPromise = !openOpts?.skipRefresh ? refreshContext() : Promise.resolve();
    options.onOpenChange?.(true);
    return refreshPromise;
  }

  async function openForCharacter(characterRef = {}, openOpts = {}) {
    const targetRef =
      typeof characterRef === 'object' && characterRef !== null
        ? characterRef
        : { chid: String(characterRef ?? '') };
    state.isCharAdaptFlow = true;
    if (openOpts.mode === 'B' || openOpts.mode === 'A') {
      setMode(openOpts.mode);
    }
    if (state.mode === 'B' && openOpts.subMode) {
      subModeSelect.value = openOpts.subMode;
      state.subMode = openOpts.subMode;
    }
    if (state.extractedPoints.length > 0) {
      state.selectedPointIds.clear();
      renderExtractedPoints();
    }
    switchTab('studio');
    open({ skipRefresh: true });
    await refreshContext();
    const loaded = await selectCharacterTarget(targetRef, {
      openWorldbook: openOpts.openWorldbook !== false,
      adaptFlow: true,
    });
    if (loaded?.name) {
      setStatus(
        `✓ 已载入角色卡「${loaded.name}」用于人设适配`,
        'ok',
        { toast: true }
      );
    }
    return loaded;
  }

  function close() {
    state.isOpen = false;
    state.minimized = false;
    popoverEl.hidden = true;
    wordCountMenuEl.hidden = true;
    historyPopoverEl.hidden = true;
    closeFloatingMenu();
    closeSaveNameSubmodal();
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
    wordCountMenuEl.hidden = true;
    historyPopoverEl.hidden = true;
    closeFloatingMenu();
    backdropEl.classList.add('is-minimized');
    backdropEl.setAttribute('aria-hidden', 'true');
    pillEl.hidden = false;
    const { vw, vh } = getSafeViewport(win, doc);
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
    const { vw, vh } = getSafeViewport(win, doc);
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
          marginTop: 8,
        })
      );
    }
    bodyEl.scrollTop = state.savedBodyScrollTop || 0;
  }

  // Programmatic mini-mode API preserved for unit tests & external callers (no topbar button!)
  function toggleMini() {
    popoverEl.hidden = true;
    closeFloatingMenu();
    const { vw, vh } = getSafeViewport(win, doc);
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
        applyRectToModal(clampModalRect({ ...state.normalRect, viewportWidth: vw, viewportHeight: vh, marginTop: 8 }));
      } else {
        clearFloatingRectOnModal();
      }
    }
    persistSettings();
  }

  function setSettings(nextSettings) {
    settings = createDefaultSettings(nextSettings);
    debugAuditCheckbox.checked = settings.ui.debugAudit;
    state.miniMode = Boolean(settings.ui?.miniMode);
    state.hasUserPlacedWindow = Boolean(nextSettings?.ui?.geometry);
    state.worldbookLightMode = settings.ui?.worldbookLightMode || 'green_selective';
    state.generationSections = normalizeGenerationSectionsConfig(settings.ui?.generationSections);
    state.moduleRatios = normalizeModuleRatios(settings.ui?.moduleRatios);
    state.pureCrossCardReuse = Boolean(settings.ui?.pureCrossCardReuse);
    state.companionCarryMode = settings.ui?.companionCarryMode || 'persona_book';
    state.companionTargetBook = settings.ui?.companionTargetBook || '';
    modalEl.classList.toggle('is-mini', state.miniMode);
    paletteSelect.value = settings.palette;
    spotlightSelect.value = settings.ui.spotlightMode || 'balanced';
    backstorySelect.value = settings.ui.backstoryMode || 'light_vibe';
    worldbookLightSelect.value = state.worldbookLightMode;
    companionCarryModeSelect.value = state.companionCarryMode;
    syncTargetBookSelectOptions();
    syncCompanionVisibility();
    applyTheme();
    updateSchemeSelects();
    renderSectionsPanel();
    renderMustHaveTray();
    if (state.activeTab === 'presets') renderStackTab();
    if (state.activeTab === 'taste') renderTasteTab();
    if (state.activeTab === 'settings') renderSettingsTab();
    if (state.isOpen && !state.minimized) {
      const { vw, vh } = getSafeViewport(win, doc);
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
            marginTop: 8,
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
      selectedCharTarget: state.selectedCharTarget,
      selectedWorldEntryKeys: Array.from(state.selectedWorldEntryKeys),
      selectedSubCharKeys: [...state.selectedSubCharKeys],
      companions: buildActiveCompanionsPayload(),
      companionCarryMode: state.companionCarryMode,
      worldbookLightMode: state.worldbookLightMode,
      isCharAdaptFlow: state.isCharAdaptFlow,
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
    if (state.statusFlashTimer) {
      clearTimeout(state.statusFlashTimer);
      state.statusFlashTimer = null;
    }
    state.genAbort?.abort();
    state.distillAbort?.abort();
    state.distillAbort = null;
    state.fetchModelsAbort?.abort();
    state.fetchModelsAbort = null;
    state.testConnAbort?.abort();
    state.testConnAbort = null;
    state.charWorldEntries = [];
    state.selectedWorldEntryKeys.clear();
    state.worldSelectionCharKey = '';
    state.hasExplicitWorldSelection = false;
    state.companions = [];
    lifecycleAc.abort();
    host.remove();
  }

  // Initial sync
  applyTheme();
  updateSchemeSelects();
  renderSectionsPanel();
  renderCompanionSlots();
  syncTargetBookSelectOptions();
  renderCharacterSelectOptions();
  if (state.selectedCharTarget === '__none__') {
    applyLoadedCharacterContext(null);
  }
  renderMustHaveTray();
  renderStackTab();
  renderTasteTab();
  renderSettingsTab();
  syncUndoRedoButtons();
  syncDraftRelatedViews();
  syncFooterForTab(state.activeTab);

  return {
    host,
    shadow,
    open,
    openForCharacter,
    selectCharacterTarget,
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
