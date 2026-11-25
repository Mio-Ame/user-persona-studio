// Pure ESM core engine for user-persona-studio.
// Strictly DOM-free and runtime-agnostic (runs identically in Node ESM and browser ESM).

import {
  CORE_SECTION_HEADER,
  SHELL_SECTION_HEADER,
  WORLDBOOK_DIVIDER,
  DRAFT_START_MARKER,
  DRAFT_END_MARKER,
  VISIBILITY_MARKERS,
  VIBE_ANCHOR_EXAMPLES,
  DEFAULT_MUST_HAVE_TEMPLATES,
  SPOTLIGHT_MODES,
  BACKSTORY_MODES,
  ANTI_PARROT_CLAUSE,
  WORD_COUNT_PRESETS,
  LIKE_REASON_PRESETS,
  DISLIKE_REASON_PRESETS,
  BUILTIN_USAGE_GUIDE,
  BUILTIN_BANNED_CATEGORIES,
  DEFAULT_BANNED_PHRASES,
  QUALITATIVE_LABEL_PATTERNS,
  BUILTIN_PRESET_SCHEMES,
} from './presets.js';

export {
  CORE_SECTION_HEADER,
  SHELL_SECTION_HEADER,
  WORLDBOOK_DIVIDER,
  DRAFT_START_MARKER,
  DRAFT_END_MARKER,
  VISIBILITY_MARKERS,
  VIBE_ANCHOR_EXAMPLES,
  DEFAULT_MUST_HAVE_TEMPLATES,
  SPOTLIGHT_MODES,
  BACKSTORY_MODES,
  ANTI_PARROT_CLAUSE,
  WORD_COUNT_PRESETS,
  LIKE_REASON_PRESETS,
  DISLIKE_REASON_PRESETS,
  BUILTIN_USAGE_GUIDE,
  BUILTIN_BANNED_CATEGORIES,
  DEFAULT_BANNED_PHRASES,
  QUALITATIVE_LABEL_PATTERNS,
  BUILTIN_PRESET_SCHEMES,
};

export const DEFAULT_PREFILL = `${CORE_SECTION_HEADER}\n## 外貌与日常印象\n-`;
export const DEFAULT_TRIGGER = '请直接按以上要求输出完整结果，不要寒暄或附加解释。';

export const ST_SENSITIVE_FIELDS = Object.freeze([
  'reverse_proxy',
  'proxy_password',
  'custom_url',
  'custom_include_body',
  'custom_exclude_body',
  'custom_include_headers',
  'vertexai_region',
  'vertexai_express_project_id',
  'azure_base_url',
  'azure_deployment_name',
  'workers_ai_account_id',
]);

const VALID_ROLES = new Set(['system', 'user', 'assistant']);
const VALID_STYLES = new Set(['longform', 'objective', 'refactor']);
const VALID_SLOT_TYPES = new Set([
  'role',
  'context',
  'craft',
  'taste',
  'banned',
  'pacing',
  'format',
  'custom',
]);
const VALID_TAIL_MODES = new Set(['auto', 'user', 'assistant_prefill', 'prefill_plus_user']);
const VALID_PALETTES = new Set(['paper', 'ink', 'warm', 'sakura', 'glass-dark', 'host']);
const VALID_COLOR_MODES = new Set(['auto', 'light', 'dark']);
const VALID_UI_TABS = new Set(['studio', 'presets', 'taste', 'settings']);
const VALID_UI_SUBMODES = new Set(['de_label_reformat', 'core_expand', 'cross_card_adapt']);
const VALID_BANNED_SEND_MODES = new Set(['smart_compact', 'personal_only', 'full']);
const VALID_SPOTLIGHT_MODES = new Set(['balanced', 'featured', 'light_daily']);
const VALID_BACKSTORY_MODES = new Set(['light_vibe', 'blank_self', 'rich_arc']);
const BUILTIN_SCHEME_IDS = new Set(Object.keys(BUILTIN_PRESET_SCHEMES));
const VALID_BANNED_CATEGORY_IDS = new Set(BUILTIN_BANNED_CATEGORIES.map((c) => c.id));

let idCounter = 0;

function generateId(prefix = 'id') {
  idCounter = (idCounter + 1) % 1000000;
  const rand = Math.random().toString(36).slice(2, 7);
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}_${rand}`;
}

export function deepClone(value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch {
      // Fallback for non-cloneable wrappers if any
    }
  }
  return JSON.parse(JSON.stringify(value));
}

function clampNumber(value, min, max, fallback) {
  if (
    value === null ||
    value === undefined ||
    typeof value === 'boolean' ||
    (typeof value === 'string' && value.trim() === '')
  ) {
    return fallback;
  }
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function clampInt(value, min, max, fallback) {
  if (
    value === null ||
    value === undefined ||
    typeof value === 'boolean' ||
    (typeof value === 'string' && value.trim() === '')
  ) {
    return fallback;
  }
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.round(num)));
}

function optionalFiniteNumber(value, min, max, fallback = null) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string' && value.trim() === '') return fallback;
  if (typeof value === 'boolean') return fallback;
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function validRole(role, fallback = 'system') {
  return VALID_ROLES.has(role) ? role : fallback;
}

function validSlotType(slotType, fallback = 'custom') {
  return VALID_SLOT_TYPES.has(slotType) ? slotType : fallback;
}

function validTailMode(tailMode, fallback = 'auto') {
  return VALID_TAIL_MODES.has(tailMode) ? tailMode : fallback;
}

export function countReadableChars(text) {
  const str = String(text ?? '');
  if (!str.trim()) return 0;
  return str.replace(/\s+/g, '').length;
}

export function computeLengthBudget(targetChars) {
  const chars = clampInt(targetChars, 200, 12000, 1500);
  const charsMin = Math.max(150, Math.round((chars * 0.88) / 10) * 10);
  const charsMax = Math.max(charsMin + 40, Math.round((chars * 1.12) / 10) * 10);
  const tokensApprox = Math.max(1, Math.round(chars * 1.35));
  const tokensMin = Math.max(100, Math.round((charsMin * 1.35) / 10) * 10);
  const tokensMax = Math.max(tokensMin + 40, Math.round((charsMax * 1.35) / 10) * 10);
  // Generous max_tokens headroom so draft self-check + reasoning/thinking + full persona never truncate
  const recommendedMaxTokens = clampInt(
    Math.max(2600, Math.round((tokensMax * 1.75 + 1200) / 100) * 100),
    1024,
    32768,
    5200
  );
  return {
    chars,
    charsMin,
    charsMax,
    tokensApprox,
    tokensMin,
    tokensMax,
    recommendedMaxTokens,
  };
}

export function applyTargetCharsToScheme(scheme, targetChars) {
  const next = sanitizeScheme(scheme);
  const budget = computeLengthBudget(targetChars);
  next.targetChars = budget.chars;
  next.targetTokens = { min: budget.tokensMin, max: budget.tokensMax };
  next.maxTokens = budget.recommendedMaxTokens;
  return next;
}

function extractEntryText(item) {
  if (typeof item === 'string') return item.trim();
  if (item && typeof item === 'object' && typeof item.text === 'string') {
    return item.text.trim();
  }
  return '';
}

function sanitizeSchemeEntry(entry, index = 0) {
  const raw = entry && typeof entry === 'object' ? entry : {};
  const id = String(raw.id || '').trim() || generateId(`entry_${index}`);
  const name = String(raw.name || '').trim() || `自定义条目 ${index + 1}`;
  return {
    id,
    name,
    slotType: validSlotType(raw.slotType, 'custom'),
    role: validRole(raw.role, 'system'),
    enabled: raw.enabled !== false,
    locked: Boolean(raw.locked),
    content: String(raw.content ?? ''),
  };
}

function normalizeBuiltinLegacyName(id, rawName) {
  const trimmed = String(rawName || '').trim();
  if (id === 'longform_coact') {
    if (!trimmed || /^(?:长文代演|细致代演|适合抢话党)/u.test(trimmed)) return '适合抢话党';
  } else if (id === 'player_controlled') {
    if (!trimmed || /^(?:纯手控|适合不抢话党)/u.test(trimmed)) return '适合不抢话党';
  } else if (id === 'persona_refactor') {
    if (!trimmed || /^旧人设改写/u.test(trimmed)) return '旧人设改写';
  }
  return trimmed;
}

function normalizeBuiltinLegacyMaxTokens(id, rawMaxTokens, targetChars, fallbackMaxTokens) {
  const num = Number(rawMaxTokens);
  if (!Number.isFinite(num)) return fallbackMaxTokens;
  if (id === 'longform_coact' && targetChars === 1500 && (num === 3200 || num === 3300)) {
    return fallbackMaxTokens;
  }
  if (id === 'player_controlled' && targetChars === 600 && (num === 1200 || num === 1400)) {
    return fallbackMaxTokens;
  }
  if (id === 'persona_refactor' && targetChars === 1500 && num === 3300) {
    return fallbackMaxTokens;
  }
  return clampInt(rawMaxTokens, 256, 32768, fallbackMaxTokens);
}

function sanitizeMustHaveTemplates(rawTemplates) {
  if (!Array.isArray(rawTemplates)) {
    return deepClone(DEFAULT_MUST_HAVE_TEMPLATES);
  }
  const seen = new Set();
  const out = [];
  for (let i = 0; i < rawTemplates.length; i += 1) {
    const item = rawTemplates[i];
    if (!item || typeof item !== 'object') continue;
    const content = String(item.content ?? '').trim();
    if (!content) continue;
    const label = String(item.label ?? '').trim() || content.slice(0, 10);
    let id = String(item.id || '').trim() || generateId(`tpl_${i}`);
    while (seen.has(id)) id = generateId('tpl');
    seen.add(id);
    out.push({ id, label: label.slice(0, 24), content });
  }
  return out;
}

function sanitizeScheme(scheme, fallbackIndex = 0) {
  const raw = scheme && typeof scheme === 'object' ? scheme : {};
  const style = VALID_STYLES.has(raw.style) ? raw.style : 'longform';
  const defaultChars = style === 'objective' ? 600 : 1500;
  const defaultTemp = style === 'objective' ? 0.55 : style === 'refactor' ? 0.65 : 0.78;
  const defaultBudget = computeLengthBudget(defaultChars);
  const rawEntries = Array.isArray(raw.entries) ? raw.entries : [];
  const seenIds = new Set();
  const entries = rawEntries.map((item, idx) => {
    const clean = sanitizeSchemeEntry(item, idx);
    while (seenIds.has(clean.id)) {
      clean.id = generateId('entry');
    }
    seenIds.add(clean.id);
    return clean;
  });

  const hasExplicitChars =
    raw.targetChars !== undefined &&
    raw.targetChars !== null &&
    String(raw.targetChars).trim() !== '' &&
    Number.isFinite(Number(raw.targetChars));
  const hasExplicitTokens = Boolean(
    raw.targetTokens &&
      typeof raw.targetTokens === 'object' &&
      (Number.isFinite(Number(raw.targetTokens.min)) || Number.isFinite(Number(raw.targetTokens.max)))
  );

  let targetChars = hasExplicitChars
    ? clampInt(raw.targetChars, 200, 12000, defaultChars)
    : defaultChars;
  const charBudget = computeLengthBudget(targetChars);

  let minTokens;
  let maxTokens;
  if (hasExplicitTokens) {
    minTokens = clampInt(raw.targetTokens?.min, 100, 16000, charBudget.tokensMin);
    maxTokens = Math.max(
      minTokens,
      clampInt(raw.targetTokens?.max, 200, 32000, charBudget.tokensMax)
    );
    if (!hasExplicitChars) {
      targetChars = clampInt(Math.round((minTokens + maxTokens) / 2 / 1.35 / 10) * 10, 200, 12000, defaultChars);
    }
  } else {
    minTokens = charBudget.tokensMin;
    maxTokens = charBudget.tokensMax;
  }

  const resolvedId = String(raw.id || '').trim() || generateId(`scheme_${fallbackIndex}`);
  const isBuiltinId = BUILTIN_SCHEME_IDS.has(resolvedId);
  const migratedName = isBuiltinId
    ? normalizeBuiltinLegacyName(resolvedId, raw.name)
    : String(raw.name || '').trim();
  const effectiveBudget = computeLengthBudget(targetChars);
  const migratedMaxTokens = isBuiltinId
    ? normalizeBuiltinLegacyMaxTokens(resolvedId, raw.maxTokens, targetChars, effectiveBudget.recommendedMaxTokens)
    : clampInt(raw.maxTokens, 256, 32768, defaultBudget.recommendedMaxTokens);

  return {
    id: resolvedId,
    name: migratedName || `未命名方案 ${fallbackIndex + 1}`,
    style,
    builtin: Boolean(raw.builtin || isBuiltinId),
    favorite: Boolean(raw.favorite),
    description: String(raw.description ?? ''),
    targetChars,
    targetTokens: {
      min: minTokens,
      max: maxTokens,
    },
    tailMode: validTailMode(raw.tailMode, 'auto'),
    prefillText: String(raw.prefillText ?? `${CORE_SECTION_HEADER}\n`),
    triggerText: String(raw.triggerText ?? DEFAULT_TRIGGER),
    temperature: clampNumber(raw.temperature, 0, 2, defaultTemp),
    maxTokens: migratedMaxTokens,
    entries,
  };
}

function sortFavoriteSchemesFirst(schemes) {
  return [...schemes].sort((a, b) => Number(Boolean(b?.favorite)) - Number(Boolean(a?.favorite)));
}

// ============================================================================
// A. Settings & Sanitization
// ============================================================================

export function createDefaultSettings(overrides = {}) {
  const src = overrides && typeof overrides === 'object' ? overrides : {};
  const defaultSchemes = [
    sanitizeScheme(deepClone(BUILTIN_PRESET_SCHEMES.longform_coact), 0),
    sanitizeScheme(deepClone(BUILTIN_PRESET_SCHEMES.player_controlled), 1),
    sanitizeScheme(deepClone(BUILTIN_PRESET_SCHEMES.persona_refactor), 2),
  ];

  let schemes = defaultSchemes;
  if (Array.isArray(src.schemes) && src.schemes.length > 0) {
    schemes = src.schemes.map((s, idx) => sanitizeScheme(s, idx));
    const hasLongform = schemes.some((s) => s.id === 'longform_coact');
    const hasObjective = schemes.some((s) => s.id === 'player_controlled');
    const hasRefactor = schemes.some((s) => s.id === 'persona_refactor');
    if (!hasLongform) {
      schemes.unshift(sanitizeScheme(deepClone(BUILTIN_PRESET_SCHEMES.longform_coact), 0));
    }
    if (!hasObjective) {
      schemes.push(sanitizeScheme(deepClone(BUILTIN_PRESET_SCHEMES.player_controlled), schemes.length));
    }
    if (!hasRefactor) {
      schemes.push(sanitizeScheme(deepClone(BUILTIN_PRESET_SCHEMES.persona_refactor), schemes.length));
    }
    schemes = sortFavoriteSchemesFirst(schemes);
  }

  const candidateActiveId = typeof src.activeSchemeId === 'string' ? src.activeSchemeId.trim() : '';
  const activeSchemeId = schemes.some((s) => s.id === candidateActiveId)
    ? candidateActiveId
    : schemes[0].id;

  const rawTaste = src.tasteProfile && typeof src.tasteProfile === 'object' ? src.tasteProfile : {};
  const anchors = mergeTasteEntries([], Array.isArray(rawTaste.anchors) ? rawTaste.anchors : []);
  const banned = mergeTasteEntries([], Array.isArray(rawTaste.banned) ? rawTaste.banned : []);
  const disabledCategories = Array.isArray(rawTaste.disabledCategories)
    ? Array.from(new Set(rawTaste.disabledCategories.filter((id) => VALID_BANNED_CATEGORY_IDS.has(id))))
    : [];

  const rawApi = src.api && typeof src.api === 'object' ? src.api : {};
  const rawProfiles = Array.isArray(rawApi.profiles) ? rawApi.profiles : [];
  const profiles = [];
  for (const p of rawProfiles) {
    if (!p || typeof p !== 'object') continue;
    try {
      profiles.push(createApiProfile(p, profiles));
    } catch {
      // Skip invalid malformed profile in partial overrides
    }
  }
  const activeProfileId = profiles.some((p) => p.id === rawApi.activeProfileId)
    ? rawApi.activeProfileId
    : (profiles[0]?.id || '');

  const rawUi = src.ui && typeof src.ui === 'object' ? src.ui : {};
  const rawGeo = rawUi.geometry && typeof rawUi.geometry === 'object' ? rawUi.geometry : {};

  return {
    version: 1,
    palette: VALID_PALETTES.has(src.palette) ? src.palette : 'paper',
    colorMode: VALID_COLOR_MODES.has(src.colorMode) ? src.colorMode : 'auto',
    activeSchemeId,
    schemes,
    tasteProfile: {
      anchors,
      banned,
      useBuiltinBanned: rawTaste.useBuiltinBanned !== false,
      bannedSendMode: VALID_BANNED_SEND_MODES.has(rawTaste.bannedSendMode)
        ? rawTaste.bannedSendMode
        : 'smart_compact',
      disabledCategories,
    },
    api: {
      provider: rawApi.provider === 'custom' ? 'custom' : 'host',
      activeProfileId,
      profiles,
    },
    ui: {
      showPersonaBtn: rawUi.showPersonaBtn !== false,
      showWandMenu: rawUi.showWandMenu !== false,
      showCharAdaptBtn: rawUi.showCharAdaptBtn !== false,
      activeTab: VALID_UI_TABS.has(rawUi.activeTab) ? rawUi.activeTab : 'studio',
      mode: rawUi.mode === 'B' ? 'B' : 'A',
      subMode: VALID_UI_SUBMODES.has(rawUi.subMode) ? rawUi.subMode : 'de_label_reformat',
      spotlightMode: VALID_SPOTLIGHT_MODES.has(rawUi.spotlightMode) ? rawUi.spotlightMode : 'balanced',
      backstoryMode: VALID_BACKSTORY_MODES.has(rawUi.backstoryMode) ? rawUi.backstoryMode : 'light_vibe',
      injectChar: rawUi.injectChar !== false,
      dualLayer: Boolean(rawUi.dualLayer),
      visibilityTags: Boolean(rawUi.visibilityTags),
      draftAudit: rawUi.draftAudit !== false,
      antiParrot: rawUi.antiParrot !== false,
      mustHaveTemplates: sanitizeMustHaveTemplates(rawUi.mustHaveTemplates),
      geometry: {
        x: Number.isFinite(rawGeo.x) && rawGeo.x >= 0 ? Math.round(rawGeo.x) : 120,
        y: Number.isFinite(rawGeo.y) && rawGeo.y >= 0 ? Math.round(rawGeo.y) : 60,
        width: clampInt(rawGeo.width, 320, 3840, 1080),
        height: clampInt(rawGeo.height, 280, 2160, 700),
      },
      minimized: Boolean(rawUi.minimized),
      miniMode: Boolean(rawUi.miniMode),
    },
  };
}

export function sanitizeSettingsForExport(settings) {
  const cloned = deepClone(settings && typeof settings === 'object' ? settings : createDefaultSettings());
  delete cloned.undoStack;
  delete cloned.redoStack;

  if (cloned.api && Array.isArray(cloned.api.profiles)) {
    cloned.api.profiles = cloned.api.profiles.map((profile) => {
      const p = profile && typeof profile === 'object' ? { ...profile } : {};
      for (const secretKey of ['apiKey', 'api_key', 'key', 'token', 'secret', 'authorization', 'Authorization', 'proxy_password']) {
        if (Object.hasOwn(p, secretKey)) {
          delete p[secretKey];
        }
      }
      return p;
    });
  }

  for (const field of ST_SENSITIVE_FIELDS) {
    if (Object.hasOwn(cloned, field)) {
      delete cloned[field];
    }
  }

  return cloned;
}

// ============================================================================
// B. Preset Stack & Scheme CRUD (including Built-in Reset & Favorite Pinning)
// ============================================================================

export function cloneScheme(scheme, overrides = {}) {
  const base = sanitizeScheme(scheme);
  const ov = overrides && typeof overrides === 'object' ? deepClone(overrides) : {};
  const rawName = ov.name !== undefined && ov.name !== null ? String(ov.name).trim() : '';
  const sourceEntries = Array.isArray(ov.entries) ? ov.entries : base.entries;

  const merged = {
    ...base,
    ...ov,
    id: String(ov.id || '').trim() || generateId('scheme'),
    name: rawName || `${base.name} (副本)`,
    builtin: Boolean(ov.builtin ?? false),
    favorite: Boolean(ov.favorite ?? false),
    entries: sourceEntries,
  };
  delete merged.regenerateEntryIds;

  const sanitized = sanitizeScheme(merged);
  if (ov.regenerateEntryIds) {
    sanitized.entries = sanitized.entries.map((entry) => ({
      ...entry,
      id: generateId('entry'),
    }));
  }
  return sanitized;
}

export function isBuiltinSchemeModified(scheme) {
  if (!scheme || typeof scheme !== 'object') return false;
  const id = String(scheme.id || '').trim();
  if (!Object.hasOwn(BUILTIN_PRESET_SCHEMES, id)) return false;

  const current = sanitizeScheme({ ...scheme, favorite: false });
  const factory = sanitizeScheme({ ...deepClone(BUILTIN_PRESET_SCHEMES[id]), favorite: false });
  return JSON.stringify(current) !== JSON.stringify(factory);
}

export function resetBuiltinScheme(settings, schemeId) {
  const id = String(schemeId || '').trim();
  const hasBuiltin = Object.hasOwn(BUILTIN_PRESET_SCHEMES, id);

  if (!isSettingsContainer(settings) && Array.isArray(settings)) {
    const listCopy = deepClone(settings);
    if (!hasBuiltin) return listCopy;
    const idx = listCopy.findIndex((s) => s && s.id === id);
    const prevFavorite = idx !== -1 ? Boolean(listCopy[idx]?.favorite) : false;
    const restored = sanitizeScheme({ ...deepClone(BUILTIN_PRESET_SCHEMES[id]), favorite: prevFavorite });
    if (idx !== -1) {
      listCopy[idx] = restored;
    } else {
      listCopy.push(restored);
    }
    return sortFavoriteSchemesFirst(listCopy);
  }

  const next = deepClone(settings && typeof settings === 'object' ? settings : createDefaultSettings());
  if (!hasBuiltin) return next;

  const schemes = Array.isArray(next.schemes) ? next.schemes : [];
  const idx = schemes.findIndex((s) => s && s.id === id);
  const prevFavorite = idx !== -1 ? Boolean(schemes[idx]?.favorite) : false;
  const restored = sanitizeScheme({ ...deepClone(BUILTIN_PRESET_SCHEMES[id]), favorite: prevFavorite });

  if (idx !== -1) {
    schemes[idx] = restored;
  } else {
    schemes.push(restored);
  }
  next.schemes = sortFavoriteSchemesFirst(schemes);
  return next;
}

export function toggleFavoriteScheme(settings, schemeId, forceFavorite) {
  const id = String(schemeId || '').trim();

  if (!isSettingsContainer(settings) && Array.isArray(settings)) {
    const listCopy = deepClone(settings).map((s, idx) => sanitizeScheme(s, idx));
    const target = listCopy.find((s) => s.id === id);
    if (!target) return listCopy;
    target.favorite = typeof forceFavorite === 'boolean' ? forceFavorite : !target.favorite;
    return sortFavoriteSchemesFirst(listCopy);
  }

  const next = deepClone(settings && typeof settings === 'object' ? settings : createDefaultSettings());
  const schemes = (Array.isArray(next.schemes) ? next.schemes : []).map((s, idx) => sanitizeScheme(s, idx));
  const target = schemes.find((s) => s.id === id);
  if (!target) return next;

  target.favorite = typeof forceFavorite === 'boolean' ? forceFavorite : !target.favorite;
  next.schemes = sortFavoriteSchemesFirst(schemes);
  return next;
}

export function toggleStackEntry(scheme, entryId, enabled) {
  const next = sanitizeScheme(scheme);
  const target = next.entries.find((e) => e.id === entryId);
  if (!target) return next;
  target.enabled = typeof enabled === 'boolean' ? enabled : !target.enabled;
  return next;
}

export function moveStackEntry(scheme, entryId, directionOrTarget) {
  const next = sanitizeScheme(scheme);
  const idx = next.entries.findIndex((e) => e.id === entryId);
  if (idx === -1 || next.entries.length <= 1) return next;

  let targetIdx = idx;
  if (directionOrTarget === 'up' || directionOrTarget === -1) {
    targetIdx = idx - 1;
  } else if (directionOrTarget === 'down' || directionOrTarget === 1) {
    targetIdx = idx + 1;
  } else if (directionOrTarget && typeof directionOrTarget === 'object') {
    const rawIdx = directionOrTarget.toIndex ?? directionOrTarget.targetIndex;
    if (Number.isInteger(rawIdx)) {
      targetIdx = Math.max(0, Math.min(next.entries.length - 1, rawIdx));
    }
  }

  if (targetIdx < 0 || targetIdx >= next.entries.length || targetIdx === idx) {
    return next;
  }

  const [item] = next.entries.splice(idx, 1);
  next.entries.splice(targetIdx, 0, item);
  return next;
}

export function updateStackEntry(scheme, entryId, patch = {}) {
  const next = sanitizeScheme(scheme);
  const idx = next.entries.findIndex((e) => e.id === entryId);
  if (idx === -1 || !patch || typeof patch !== 'object') return next;

  const current = next.entries[idx];
  const updated = { ...current };

  if (patch.name !== undefined) {
    const trimmed = String(patch.name).trim();
    if (trimmed) updated.name = trimmed;
  }
  if (patch.role !== undefined) {
    updated.role = validRole(patch.role, current.role);
  }
  if (patch.slotType !== undefined) {
    updated.slotType = validSlotType(patch.slotType, current.slotType);
  }
  if (patch.enabled !== undefined) {
    updated.enabled = Boolean(patch.enabled);
  }
  if (patch.content !== undefined) {
    updated.content = String(patch.content);
  }
  if (patch.locked !== undefined && !current.locked) {
    updated.locked = Boolean(patch.locked);
  }

  next.entries[idx] = updated;
  return next;
}

export function addCustomStackEntry(scheme, entry = {}) {
  const next = sanitizeScheme(scheme);
  const raw = entry && typeof entry === 'object' ? entry : {};
  const existingIds = new Set(next.entries.map((e) => e.id));

  let id = String(raw.id || '').trim() || generateId('custom');
  while (existingIds.has(id)) {
    id = generateId('custom');
  }

  const created = {
    id,
    name: String(raw.name || '').trim() || '自定义规则条目',
    slotType: validSlotType(raw.slotType, 'custom'),
    role: validRole(raw.role, 'system'),
    enabled: raw.enabled !== false,
    locked: false,
    content: String(raw.content ?? ''),
  };

  if (Number.isInteger(raw.insertIndex)) {
    const pos = Math.max(0, Math.min(next.entries.length, raw.insertIndex));
    next.entries.splice(pos, 0, created);
  } else {
    next.entries.push(created);
  }
  return next;
}

export function removeStackEntry(scheme, entryId) {
  const next = sanitizeScheme(scheme);
  const target = next.entries.find((e) => e.id === entryId);
  if (!target || target.locked) {
    return next;
  }
  next.entries = next.entries.filter((e) => e.id !== entryId);
  return next;
}

function isSettingsContainer(target) {
  return Boolean(
    target &&
    typeof target === 'object' &&
    !Array.isArray(target) &&
    (Array.isArray(target.schemes) || Object.hasOwn(target, 'activeSchemeId'))
  );
}

export function saveSchemeAs(settingsOrCollection, sourceSchemeId, newName, options = {}) {
  const trimmedName = String(newName ?? '').trim();
  if (!trimmedName) {
    throw new Error('方案名称不能为空');
  }

  const isSettings = isSettingsContainer(settingsOrCollection);
  if (!isSettings && settingsOrCollection && typeof settingsOrCollection === 'object') {
    const isArray = Array.isArray(settingsOrCollection);
    const colCopy = deepClone(settingsOrCollection);
    const schemes = isArray ? colCopy : Object.values(colCopy);
    const source =
      typeof sourceSchemeId === 'string'
        ? schemes.find((s) => s && s.id === sourceSchemeId) ||
          (!isArray && Object.hasOwn(colCopy, sourceSchemeId) ? colCopy[sourceSchemeId] : null)
        : (sourceSchemeId && typeof sourceSchemeId === 'object' ? sourceSchemeId : null);
    if (!source) {
      throw new Error('未找到可另存的源方案');
    }

    let finalName = trimmedName;
    const exists = (candidate) =>
      schemes.some((s) => String(s?.name || '').trim().toLowerCase() === candidate.toLowerCase());
    const autoSuffix = options?.autoSuffix !== false;

    if (exists(finalName)) {
      if (autoSuffix) {
        let suffix = 2;
        while (exists(`${trimmedName} (${suffix})`)) {
          suffix += 1;
        }
        finalName = `${trimmedName} (${suffix})`;
      } else {
        throw new Error('方案名称已存在');
      }
    }

    let newId = generateId('scheme');
    while (schemes.some((s) => s && s.id === newId)) {
      newId = generateId('scheme');
    }

    const cloned = cloneScheme(source, {
      id: newId,
      name: finalName,
      builtin: false,
      favorite: false,
    });

    if (isArray) {
      return sortFavoriteSchemesFirst([...colCopy, cloned]);
    }
    return { ...colCopy, [cloned.id]: cloned };
  }

  const next = deepClone(settingsOrCollection && typeof settingsOrCollection === 'object' ? settingsOrCollection : createDefaultSettings());
  const schemes = Array.isArray(next.schemes) ? next.schemes : [];

  const source =
    schemes.find((s) => s.id === sourceSchemeId) ||
    schemes.find((s) => s.id === next.activeSchemeId) ||
    schemes[0];
  if (!source) {
    throw new Error('未找到可另存的源方案');
  }

  let finalName = trimmedName;
  const exists = (candidate) =>
    schemes.some((s) => String(s.name || '').trim().toLowerCase() === candidate.toLowerCase());

  if (exists(finalName)) {
    if (options && options.autoSuffix) {
      let suffix = 2;
      while (exists(`${trimmedName} (${suffix})`)) {
        suffix += 1;
      }
      finalName = `${trimmedName} (${suffix})`;
    } else {
      throw new Error('方案名称已存在');
    }
  }

  let newId = generateId('scheme');
  while (schemes.some((s) => s.id === newId)) {
    newId = generateId('scheme');
  }

  const cloned = cloneScheme(source, {
    id: newId,
    name: finalName,
    builtin: false,
    favorite: false,
  });

  next.schemes = sortFavoriteSchemesFirst([...schemes, cloned]);
  next.activeSchemeId = cloned.id;
  return next;
}

export function renameScheme(settingsOrCollection, schemeId, newName) {
  const trimmedName = String(newName ?? '').trim();
  if (!trimmedName) {
    throw new Error('方案名称不能为空');
  }

  if (!isSettingsContainer(settingsOrCollection) && settingsOrCollection && typeof settingsOrCollection === 'object') {
    const isArray = Array.isArray(settingsOrCollection);
    const colCopy = deepClone(settingsOrCollection);
    if (isArray) {
      const idx = colCopy.findIndex((s) => s && s.id === schemeId);
      if (idx === -1) return colCopy;
      const conflict = colCopy.some(
        (s) => s && s.id !== schemeId && String(s.name || '').trim().toLowerCase() === trimmedName.toLowerCase()
      );
      if (conflict) {
        throw new Error('方案名称已存在');
      }
      colCopy[idx] = { ...colCopy[idx], name: trimmedName };
      return colCopy;
    }
    if (!Object.hasOwn(colCopy, schemeId)) return colCopy;
    const conflict = Object.values(colCopy).some(
      (s) => s && s.id !== schemeId && String(s.name || '').trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (conflict) {
      throw new Error('方案名称已存在');
    }
    colCopy[schemeId] = { ...colCopy[schemeId], name: trimmedName };
    return colCopy;
  }

  const next = deepClone(settingsOrCollection && typeof settingsOrCollection === 'object' ? settingsOrCollection : createDefaultSettings());
  const schemes = Array.isArray(next.schemes) ? next.schemes : [];
  const idx = schemes.findIndex((s) => s.id === schemeId);
  if (idx === -1) return next;

  const conflict = schemes.some(
    (s) => s.id !== schemeId && String(s.name || '').trim().toLowerCase() === trimmedName.toLowerCase()
  );
  if (conflict) {
    throw new Error('方案名称已存在');
  }

  schemes[idx] = { ...schemes[idx], name: trimmedName };
  next.schemes = schemes;
  return next;
}

export function deleteScheme(settingsOrCollection, schemeId) {
  if (!isSettingsContainer(settingsOrCollection) && settingsOrCollection && typeof settingsOrCollection === 'object') {
    const isArray = Array.isArray(settingsOrCollection);
    const colCopy = deepClone(settingsOrCollection);
    if (isArray) {
      const target = colCopy.find((s) => s && s.id === schemeId);
      if (!target || target.builtin || BUILTIN_SCHEME_IDS.has(target.id) || colCopy.length <= 1) {
        return colCopy;
      }
      const filtered = colCopy.filter((s) => s && s.id !== schemeId);
      if (filtered.length === 0) {
        return colCopy;
      }
      return filtered;
    }
    const target = Object.hasOwn(colCopy, schemeId) ? colCopy[schemeId] : undefined;
    const keys = Object.keys(colCopy);
    if (!target || target.builtin || BUILTIN_SCHEME_IDS.has(schemeId) || keys.length <= 1) {
      return colCopy;
    }
    delete colCopy[schemeId];
    return colCopy;
  }

  const next = deepClone(settingsOrCollection && typeof settingsOrCollection === 'object' ? settingsOrCollection : createDefaultSettings());
  const schemes = Array.isArray(next.schemes) ? next.schemes : [];
  const target = schemes.find((s) => s && s.id === schemeId);
  if (!target || target.builtin || BUILTIN_SCHEME_IDS.has(target.id) || schemes.length <= 1) {
    return next;
  }

  const remaining = schemes.filter((s) => s && s.id !== schemeId);
  if (remaining.length === 0) {
    return next;
  }
  next.schemes = remaining;
  if (next.activeSchemeId === schemeId) {
    next.activeSchemeId = next.schemes[0]?.id || '';
  }
  return next;
}

// ============================================================================
// C. Prompt Assembly, Categorized Banned Lexicon, Draft Self-Check & Tail Role
// ============================================================================

function normalizeMode(mode, subMode) {
  if (mode === 'create' || mode === 'new') return { mode: 'create', subMode: undefined };
  if (mode === 'optimize' || mode === 'refactor') {
    return { mode: 'optimize', subMode: normalizeSubMode(subMode) };
  }
  if (
    mode === 'de_label_reformat' ||
    mode === 'lossless_reformat' ||
    mode === 'refactor_lossless' ||
    mode === 'core_expand' ||
    mode === 'expand_core' ||
    mode === 'cross_card_adapt' ||
    mode === 'crosscard_adapt'
  ) {
    return { mode: 'optimize', subMode: normalizeSubMode(mode) };
  }
  throw new Error(`不支持的工作流模式：${String(mode ?? '')}`);
}

function normalizeSubMode(subMode) {
  if (!subMode || subMode === 'de_label_reformat' || subMode === 'lossless_reformat' || subMode === 'refactor_lossless') {
    return 'de_label_reformat';
  }
  if (subMode === 'core_expand' || subMode === 'expand_core') {
    return 'core_expand';
  }
  if (subMode === 'cross_card_adapt' || subMode === 'crosscard_adapt') {
    return 'cross_card_adapt';
  }
  throw new Error(`不支持的优化子模式：${String(subMode)}`);
}

const GENERIC_TASTE_NOTES = new Set([
  '手动添加',
  '单句一键拉黑',
  '单句收藏锚点',
  '检查结果一键屏蔽',
  '质检一键拉黑',
]);

function formatTastePromptItem(item, kind = 'anchors') {
  const text = extractEntryText(item);
  if (!text) return '';
  const rawNote = item && typeof item === 'object' && typeof item.note === 'string' ? item.note.trim() : '';
  if (!rawNote || GENERIC_TASTE_NOTES.has(rawNote)) {
    return `- ${text}`;
  }
  if (kind === 'banned') {
    return `- 「${text}」（不喜欢的点：${rawNote}，请连同类风格写法一并避开）`;
  }
  return `- ${text}（喜好方向：${rawNote}）`;
}

function formatBuiltinBannedPromptBlock(disabledCategories = [], bannedSendMode = 'smart_compact') {
  if (bannedSendMode === 'personal_only') return '';
  const disabledSet = new Set(Array.isArray(disabledCategories) ? disabledCategories : []);
  const enabledCats = BUILTIN_BANNED_CATEGORIES.filter((cat) => !disabledSet.has(cat.id));
  if (enabledCats.length === 0) return '';

  const isCompact = bannedSendMode !== 'full';
  const lines = [
    isCompact
      ? '【人设避雷准则与代表禁词（写作时直接规避，严禁原样或变体混入成稿）】'
      : '【分类禁写词库与句式红线（写作时直接规避，严禁原样或变体混入成稿）】',
  ];

  for (const cat of enabledCats) {
    lines.push(`▸ ${cat.name}`);
    if (Array.isArray(cat.rules) && cat.rules.length > 0) {
      lines.push(`  核心准则：${cat.rules.join('；')}。`);
    }
    if (Array.isArray(cat.phrases) && cat.phrases.length > 0) {
      const sample = isCompact ? cat.phrases.slice(0, 3) : cat.phrases;
      lines.push(`  ${isCompact ? '代表禁词' : '禁写词句'}：${sample.join('、')}${isCompact && cat.phrases.length > 3 ? ' 等同类套话' : ''}`);
    }
  }

  return lines.join('\n');
}

function resolveSlotContent(entry, scheme, tasteProfile = {}, includeTaste = true) {
  const budget = computeLengthBudget(scheme.targetChars || 1500);
  let content = String(entry.content ?? '')
    .replaceAll('{{targetChars}}', String(budget.chars))
    .replaceAll('{{targetCharsMin}}', String(budget.charsMin))
    .replaceAll('{{targetCharsMax}}', String(budget.charsMax))
    .replaceAll('{{targetMin}}', String(scheme.targetTokens?.min ?? budget.tokensMin))
    .replaceAll('{{targetMax}}', String(scheme.targetTokens?.max ?? budget.tokensMax));

  const anchors = includeTaste
    ? (Array.isArray(tasteProfile?.anchors) ? tasteProfile.anchors : [])
        .map((item) => formatTastePromptItem(item, 'anchors'))
        .filter(Boolean)
    : [];

  const userBanned = includeTaste
    ? (Array.isArray(tasteProfile?.banned) ? tasteProfile.banned : [])
        .map((item) => formatTastePromptItem(item, 'banned'))
        .filter(Boolean)
    : [];

  const useBuiltinBanned = tasteProfile?.useBuiltinBanned !== false;
  const bannedSendMode = VALID_BANNED_SEND_MODES.has(tasteProfile?.bannedSendMode)
    ? tasteProfile.bannedSendMode
    : 'smart_compact';
  const disabledCategories = Array.isArray(tasteProfile?.disabledCategories)
    ? tasteProfile.disabledCategories
    : [];

  if (entry.slotType === 'taste') {
    if (anchors.length > 0) {
      content += `\n\n【个人喜欢的细节偏好（精炼融入，吃穿小喜好点到即止并按人物性格自然体现外显度）】\n${anchors.join('\n')}`;
    }
  } else if (entry.slotType === 'banned') {
    const blocks = [];
    if (useBuiltinBanned) {
      const catBlock = formatBuiltinBannedPromptBlock(disabledCategories, bannedSendMode);
      if (catBlock) {
        blocks.push(catBlock);
      }
    }
    if (userBanned.length > 0) {
      blocks.push(`【个人屏蔽的不爱看写法】\n${userBanned.join('\n')}`);
    }
    if (blocks.length > 0) {
      content += `\n\n${blocks.join('\n\n')}`;
    }
  }

  return content.trim();
}

export function buildDraftAuditInstruction(scheme = {}, options = {}) {
  const isObjective = scheme?.style === 'objective';
  const backstoryMode = VALID_BACKSTORY_MODES.has(options?.backstoryMode) ? options.backstoryMode : 'light_vibe';
  const backstoryShort =
    backstoryMode === 'blank_self'
      ? '严守过往纯留白零编造'
      : backstoryMode === 'rich_arc'
        ? '成长脉络与性格自然呼应'
        : '仅保留轻度氛围、不乱编亲属变故';

  return [
    '【成稿前草稿自检】',
    `输出正文前，先在顶部用唯一一个 \`${DRAFT_START_MARKER}\` 与 \`${DRAFT_END_MARKER}\` 包裹简短核对（控制在 120 字内）：`,
    `1. 题材与经历边界：贴合故事语境，${backstoryShort}，性格顺着人物本色落地而不套固定公式；`,
    '2. 戏份与伏笔分寸：职业、特殊属性与小喜好收放自然无打卡隐患（喜好外显度符合人物性格，不强设旁人必全知或必猜错），暗线具备自然日常表象，具体举例不写成必演剧本；',
    `3. 语言净稿：符合${isObjective ? '纯手控零代演' : '自然代演留白'}边界，清零赋魅套话、系统口号与破折号。`,
    `闭合 \`${DRAFT_END_MARKER}\` 后换一行直接从 \`${CORE_SECTION_HEADER}\` 输出干净正文。`,
  ].join('\n');
}

function formatCharContextBlock(charContext) {
  if (!charContext || typeof charContext !== 'object') return '';
  const fields = [
    ['角色名称', charContext.name],
    ['角色简介', charContext.description],
    ['性格设定', charContext.personality],
    ['当前场景', charContext.scenario],
    ['开场白参考', charContext.firstMessage],
  ];
  const lines = [];
  for (const [label, val] of fields) {
    const text = String(val ?? '').trim();
    if (text) {
      lines.push(`${label}：\n${text}`);
    }
  }

  if (Array.isArray(charContext.selectedWorldEntries)) {
    const entryLines = [];
    for (const entry of charContext.selectedWorldEntries) {
      if (!entry || typeof entry !== 'object') continue;
      const body = String(entry.content ?? '').trim();
      if (!body) continue;
      const label = String(entry.comment ?? '').trim() || (Array.isArray(entry.keys) ? entry.keys[0] : '') || '设定';
      const keys = Array.isArray(entry.keys) && entry.keys.length > 0 ? `（关键词：${entry.keys.slice(0, 5).join('、')}）` : '';
      entryLines.push(`- ${label}${keys}：${body}`);
    }
    if (entryLines.length > 0) {
      lines.push(`世界观设定参考：\n${entryLines.join('\n')}`);
    }
  } else {
    const summaryText = String(charContext.worldSummary ?? '').trim();
    if (summaryText) {
      lines.push(`世界观摘要：\n${summaryText}`);
    }
  }

  if (lines.length === 0) return '';
  return [
    '【当前角色卡公开背景参考】',
    '（仅用于对齐时代背景、基调与开场关系；不得抄袭角色卡私有秘密，也不要写系统说教口号）',
    lines.join('\n\n'),
  ].join('\n');
}

function buildDualLayerDirective(scheme) {
  const isObjective = scheme?.style === 'objective';
  const mainRange = isObjective ? '350～550 字' : '650～950 字';
  return [
    '【长设定自动拆出世界书（已开启）】',
    `请将主档案正文精简至约 ${mainRange} 并放在上半部分；随后另起一行输出分隔标题 \`${WORLDBOOK_DIVIDER}\`，在分隔标题之下生成 2～4 条按关键词触发的补充背景条目，严格使用以下格式：`,
    '[条目：条目标题]',
    '关键词：关键词1, 关键词2',
    '内容：补充事实与触发范围说明。',
  ].join('\n');
}

function buildVisibilityTagsDirective() {
  return [
    '【信息可见度标注（已按需开启）】',
    `当前故事涉及阵营试探、悬疑或明显信息差，请按需使用 ${VISIBILITY_MARKERS.join(' / ')} 简要区分旁人一眼可见的特征、开场双方已知的共识与尚未公开的私密信息；普通日常细节仍保持自然行文，无需逐句机械打标。`,
  ].join('\n');
}

function buildBackstoryDirective(backstoryMode = 'light_vibe') {
  if (backstoryMode === 'blank_self') {
    return '【经历尺度：纯留白零编造】严禁编造任何玩家未主动提供的家庭出身、童年往事或旧日事件，完全通过当下的气质、习惯与处境立住人物。';
  }
  if (backstoryMode === 'rich_arc') {
    return '【经历尺度：补全成长经历】结合人物特质与世界观，自然补全合理的成长环境与习惯成因，让人物来处清晰有血肉。';
  }
  return '【经历尺度：轻底色防套皮】已写明的经历完整保留；未提及过往处仅用宽泛生活氛围托底，不擅自编造具体父母亲属或童年创伤。';
}

function buildSpotlightDirective(spotlightMode = 'balanced') {
  if (spotlightMode === 'featured') {
    return '【元素与伏笔戏份：围绕设定展开】适当提高职业习惯、特殊属性与暗线伏笔在日常与开场中的比重和线索感，避免重复死板口头禅。';
  }
  if (spotlightMode === 'light_daily') {
    return '【元素与伏笔戏份：轻盈纯日常】不额外铺设复杂沉重的身世暗线，职业与小习惯轻巧点缀，专注当下相处氛围。';
  }
  return '';
}

export function inferOptimalTailMode(modelHint = {}) {
  const hint = modelHint && typeof modelHint === 'object' ? modelHint : {};
  const model = String(hint.model ?? '').trim().toLowerCase();
  const source = String(hint.source ?? '').trim().toLowerCase();
  const baseUrl = String(hint.baseUrl ?? '').trim().toLowerCase();

  if (!model && !source && !baseUrl) {
    return 'user';
  }

  // Reasoning / thinking models reject or break on assistant prefill
  if (/\b(?:o1|o3|o4|qwq|r1)\b|reasoner|thinking/i.test(model)) {
    return 'user';
  }

  // Native Anthropic Claude (non-thinking) supports clean assistant prefill
  if (
    model.includes('claude') &&
    (source === 'claude' || source === 'anthropic' || baseUrl.includes('anthropic.com'))
  ) {
    return 'assistant_prefill';
  }

  // Gemini, OpenAI, DeepSeek, Grok, OpenRouter, and general OpenAI-compatible relays: end with user
  return 'user';
}

export function buildGenerationMessages(options = {}) {
  const opts = options && typeof options === 'object' ? options : {};
  const scheme = sanitizeScheme(opts.scheme || BUILTIN_PRESET_SCHEMES.longform_coact);
  const { mode, subMode } = normalizeMode(opts.mode || 'create', opts.subMode);
  const tasteProfile = opts.tasteProfile && typeof opts.tasteProfile === 'object' ? opts.tasteProfile : {};
  const effectiveTailMode =
    scheme.tailMode === 'auto' ? inferOptimalTailMode(opts.modelHint) : scheme.tailMode;

  const messages = [];
  for (const entry of scheme.entries) {
    if (!entry.enabled) continue;
    const resolved = resolveSlotContent(entry, scheme, tasteProfile, true);
    if (!resolved) continue;
    messages.push({
      role: validRole(entry.role, 'system'),
      content: resolved,
    });
  }

  const taskParts = [];
  const inspiration = String(opts.inspiration ?? '').trim();
  const userMustHaves = String(opts.userMustHaves ?? '').trim();
  const existingDraft = String(opts.existingDraft ?? '').trim();
  const lockedCore = String(opts.lockedCore ?? '').trim();
  const targetSection = String(opts.targetSection ?? '').trim();
  const useVisibilityTags = opts.visibilityTags === true;
  const useDraftAudit = opts.draftAudit === true && !targetSection;
  const charBlock = formatCharContextBlock(opts.charContext);
  const budget = computeLengthBudget(scheme.targetChars);

  if (mode === 'create') {
    taskParts.push(`【任务模式：新建 {{user}} 人设（目标约 ${budget.chars} 字）】`);
    if (inspiration) {
      taskParts.push(`【玩家想法与定位】\n${inspiration}`);
    } else if (!userMustHaves && !lockedCore) {
      taskParts.push('【玩家想法】\n请根据当前流派与角色卡背景，构建一个细节扎实、自然好读的 {{user}} 人设档案。');
    }
    if (lockedCore) {
      taskParts.push(`【从已有人设沿用的保留设定（必须原样保留）】\n${lockedCore}`);
    }
    if (userMustHaves) {
      taskParts.push(`【必须包含的设定要求】\n${userMustHaves}`);
    }
    if (charBlock) {
      taskParts.push(charBlock);
    }
  } else {
    if (!existingDraft && !(subMode === 'cross_card_adapt' && lockedCore)) {
      throw new Error('请先载入或粘贴需要优化的原有人设文本');
    }
    const directiveMap = {
      de_label_reformat:
        '【任务模式：无损去标签与排版整理】\n完整保留原人设所有既定事实、经历与个人喜好，清理混乱格式与套话，顺着原人设自身性格走向把空泛标签展开为具体言行细节，整理为上下两部分结构。',
      core_expand:
        `【任务模式：扩写细节（目标约 ${budget.chars} 字，区间 ${budget.charsMin}～${budget.charsMax} 字）】\n保留原人设事实骨架，顺着人物本色补充好恶界线、处事习惯与日常相处细节。`,
      cross_card_adapt:
        `【任务模式：换卡改背景】\n严格保留下方指定的固定人设内容不做篡改，仅结合新角色卡背景重写${SHELL_SECTION_HEADER}，让身份与开场关系自然融入新故事。`,
    };
    taskParts.push(directiveMap[subMode]);

    if (lockedCore) {
      taskParts.push(`【必须保留不变的设定（严禁改动）】\n${lockedCore}`);
    } else if (subMode === 'cross_card_adapt' && existingDraft) {
      const split = splitCoreAndShell(existingDraft);
      if (split.core) {
        taskParts.push(`【自动提取的固定保留设定（严禁改动）】\n${split.core}`);
      }
    }

    if (targetSection) {
      taskParts.push(
        `【局部重生成目标小节】\n本次仅重写小节「${targetSection}」的正文内容，其余章节无需输出；可直接以「## ${targetSection}」开头或直接给出该小节更新后的段落内容，保持与前文设定完全一致。`
      );
    }

    if (userMustHaves) {
      taskParts.push(`【补充修改要求】\n${userMustHaves}`);
    }
    if (charBlock) {
      taskParts.push(charBlock);
    }
    if (existingDraft) {
      taskParts.push(`【原有人设底稿】\n${existingDraft}`);
    }
  }

  const backstoryMode = VALID_BACKSTORY_MODES.has(opts.backstoryMode) ? opts.backstoryMode : '';
  const spotlightMode = VALID_SPOTLIGHT_MODES.has(opts.spotlightMode) ? opts.spotlightMode : '';

  if (backstoryMode && !targetSection) {
    const bsText = buildBackstoryDirective(backstoryMode);
    if (bsText) taskParts.push(bsText);
  }
  if (spotlightMode && !targetSection) {
    const spText = buildSpotlightDirective(spotlightMode);
    if (spText) taskParts.push(spText);
  }

  const combinedInputForExamples = `${inspiration}\n${userMustHaves}\n${existingDraft}\n${lockedCore}`;
  if (opts.antiParrot !== false && !targetSection && hasReplayRiskExamples(combinedInputForExamples)) {
    taskParts.push(
      '【示例防照抄提醒】\n检测到输入中包含“例如/比如”等具体情境示例：请先提炼出背后的通用思维回路与反应规律；若在正文中保留具体示例辅助理解，须保持简练并在括号内注明“仅作理解思维逻辑的参考例，日常互动随情境自然反应，不复刻原例桥段”。'
    );
  }

  if (useVisibilityTags) {
    taskParts.push(buildVisibilityTagsDirective());
  }

  if (opts.dualLayer && !targetSection) {
    taskParts.push(buildDualLayerDirective(scheme));
  }

  if (useDraftAudit) {
    messages.push({
      role: 'system',
      content: buildDraftAuditInstruction(scheme, {
        backstoryMode: backstoryMode || 'light_vibe',
        spotlightMode: spotlightMode || 'balanced',
      }),
    });
  }

  if (effectiveTailMode === 'user' && scheme.triggerText && scheme.triggerText.trim()) {
    if (useDraftAudit) {
      taskParts.push(
        `${scheme.triggerText.trim()}\n（请先以 ${DRAFT_START_MARKER}…${DRAFT_END_MARKER} 完成简短草稿自检，闭合后立即输出干净的最终人设正文。）`
      );
    } else {
      taskParts.push(scheme.triggerText.trim());
    }
  }

  messages.push({
    role: 'user',
    content: taskParts.join('\n\n'),
  });

  const effectivePrefillText =
    useDraftAudit && effectiveTailMode === 'assistant_prefill'
      ? `${DRAFT_START_MARKER}\n`
      : scheme.prefillText;

  const finalMessages = applyTailRoleStrategy(messages, {
    tailMode: effectiveTailMode,
    prefillText: effectivePrefillText,
    triggerText: scheme.triggerText,
    modelHint: opts.modelHint,
  });

  const assembledPromptText = finalMessages
    .map((m) => `[${m.role}]\n${m.content}`)
    .join('\n\n');

  return {
    messages: finalMessages,
    assembledPromptText,
    estimatedTokens: estimateTokens(assembledPromptText),
  };
}

export function applyTailRoleStrategy(messages, options = {}) {
  const opts = options && typeof options === 'object' ? options : {};
  const rawMode = validTailMode(opts.tailMode, 'auto');
  const tailMode = rawMode === 'auto' ? inferOptimalTailMode(opts.modelHint) : rawMode;
  const rawPrefill = String(opts.prefillText ?? '').trimEnd();
  const prefill = rawPrefill || DEFAULT_PREFILL.trimEnd();
  const trigger = String(opts.triggerText ?? '').trim() || DEFAULT_TRIGGER;

  const list = Array.isArray(messages)
    ? messages
        .filter((m) => m && typeof m === 'object' && typeof m.content === 'string')
        .map((m) => ({
          role: validRole(m.role, 'user'),
          content: m.content,
        }))
    : [];

  while (list.length > 0 && list[list.length - 1].role === 'assistant') {
    list.pop();
  }

  if (tailMode === 'user') {
    if (list.length === 0 || list[list.length - 1].role !== 'user') {
      list.push({ role: 'user', content: trigger });
    }
    return list;
  }

  if (tailMode === 'assistant_prefill') {
    list.push({ role: 'assistant', content: prefill });
    return list;
  }

  // 'prefill_plus_user'
  list.push({ role: 'assistant', content: prefill });
  list.push({ role: 'user', content: trigger });
  return list;
}

// ============================================================================
// D. SillyTavern Native Chat Completion Preset & Regex Script Exporters
// ============================================================================

function sanitizePromptIdentifier(id) {
  return String(id || 'custom')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'custom';
}

function makeCustomPromptEntry({ identifier, name, role, content }) {
  return {
    identifier,
    name,
    system_prompt: false,
    marker: false,
    role: validRole(role, 'system'),
    content: String(content ?? ''),
    injection_position: 0,
    injection_depth: 4,
    injection_order: 100,
    injection_trigger: [],
    forbid_overrides: false,
  };
}

export function exportSillyTavernPreset(options = {}) {
  const opts = options && typeof options === 'object' ? options : {};
  const scheme = sanitizeScheme(opts.scheme || BUILTIN_PRESET_SCHEMES.longform_coact);
  const tasteProfile = opts.tasteProfile && typeof opts.tasteProfile === 'object' ? opts.tasteProfile : {};
  const includeTaste = opts.includeTaste !== false;
  const includeUsageGuide = opts.includeUsageGuide !== false;
  const includeDraftAudit = Boolean(opts.includeDraftAudit);
  const rawPresetName =
    opts.presetName !== undefined && opts.presetName !== null ? String(opts.presetName).trim() : '';
  const presetName = rawPresetName || String(scheme.name ?? '').trim() || 'User 人设工坊预设';

  const mainSystemContent =
    `【${presetName}】当前预设用于生成或优化 SillyTavern {{user}} 人设档案。请将玩家在聊天框发送的灵感或旧人设作为本次输入，并结合已启用的角色卡设定与下方模块化规则直接输出人设正文。`;

  // All 12 mandatory built-in SillyTavern PromptManager identifiers
  const builtinPrompts = [
    {
      identifier: 'main',
      name: 'Main Prompt',
      system_prompt: true,
      marker: false,
      role: 'system',
      content: mainSystemContent,
    },
    {
      identifier: 'nsfw',
      name: 'Auxiliary Prompt',
      system_prompt: true,
      marker: false,
      role: 'system',
      content: '',
    },
    {
      identifier: 'enhanceDefinitions',
      name: 'Enhance Definitions',
      system_prompt: true,
      marker: false,
      role: 'system',
      content: '',
    },
    {
      identifier: 'jailbreak',
      name: 'Post-History Instructions',
      system_prompt: true,
      marker: false,
      role: 'system',
      content: '',
    },
    {
      identifier: 'worldInfoBefore',
      name: 'World Info (before)',
      system_prompt: true,
      marker: true,
    },
    {
      identifier: 'charDescription',
      name: 'Char Description',
      system_prompt: true,
      marker: true,
    },
    {
      identifier: 'charPersonality',
      name: 'Char Personality',
      system_prompt: true,
      marker: true,
    },
    {
      identifier: 'scenario',
      name: 'Scenario',
      system_prompt: true,
      marker: true,
    },
    {
      identifier: 'personaDescription',
      name: 'Persona Description',
      system_prompt: true,
      marker: true,
    },
    {
      identifier: 'worldInfoAfter',
      name: 'World Info (after)',
      system_prompt: true,
      marker: true,
    },
    {
      identifier: 'dialogueExamples',
      name: 'Chat Examples',
      system_prompt: true,
      marker: true,
    },
    {
      identifier: 'chatHistory',
      name: 'Chat History',
      system_prompt: true,
      marker: true,
    },
  ];

  const prompts = [...builtinPrompts];
  const reservedSystemIds = new Set([
    'ups_usage_guide',
    'ups_draft_audit',
    'ups_tail_prefill',
    'ups_tail_trigger',
  ]);
  const usedIds = new Set(prompts.map((p) => p.identifier));
  const order = [];

  if (includeUsageGuide) {
    const guideId = 'ups_usage_guide';
    usedIds.add(guideId);
    prompts.push(
      makeCustomPromptEntry({
        identifier: guideId,
        name: '【使用说明】发送灵感或旧人设即可生成',
        role: 'system',
        content: BUILTIN_USAGE_GUIDE,
      })
    );
    order.push({ identifier: guideId, enabled: false });
  }

  order.push(
    { identifier: 'main', enabled: true },
    { identifier: 'worldInfoBefore', enabled: false },
    { identifier: 'charDescription', enabled: true },
    { identifier: 'scenario', enabled: true },
    { identifier: 'charPersonality', enabled: false },
    { identifier: 'personaDescription', enabled: false },
    { identifier: 'enhanceDefinitions', enabled: false },
    { identifier: 'nsfw', enabled: false },
    { identifier: 'worldInfoAfter', enabled: false },
    { identifier: 'dialogueExamples', enabled: false }
  );

  for (const entry of scheme.entries) {
    const baseIdentifier = `ups_${sanitizePromptIdentifier(entry.id)}`;
    let identifier = baseIdentifier;
    if (usedIds.has(identifier) || reservedSystemIds.has(identifier)) {
      let suffix = 2;
      while (
        usedIds.has(`${baseIdentifier}_${suffix}`) ||
        reservedSystemIds.has(`${baseIdentifier}_${suffix}`)
      ) {
        suffix += 1;
      }
      identifier = `${baseIdentifier}_${suffix}`;
    }
    usedIds.add(identifier);

    const content = resolveSlotContent(entry, scheme, tasteProfile, includeTaste);
    prompts.push(
      makeCustomPromptEntry({
        identifier,
        name: entry.name,
        role: entry.role,
        content,
      })
    );
    order.push({ identifier, enabled: Boolean(entry.enabled) });
  }

  if (includeDraftAudit) {
    const auditId = 'ups_draft_audit';
    usedIds.add(auditId);
    prompts.push(
      makeCustomPromptEntry({
        identifier: auditId,
        name: '【草稿自检净化】先扫除套话禁词再输出成稿',
        role: 'system',
        content: buildDraftAuditInstruction(scheme),
      })
    );
    order.push({ identifier: auditId, enabled: true });
  }

  order.push({ identifier: 'chatHistory', enabled: true });

  const basePrefill = String(scheme.prefillText ?? '').trimEnd() || DEFAULT_PREFILL.trimEnd();
  const prefillContent =
    includeDraftAudit && scheme.tailMode === 'assistant_prefill' && basePrefill === CORE_SECTION_HEADER
      ? DRAFT_START_MARKER
      : basePrefill;
  const triggerContent = String(scheme.triggerText ?? '').trim() || DEFAULT_TRIGGER;

  if (scheme.tailMode === 'assistant_prefill') {
    const prefillId = 'ups_tail_prefill';
    usedIds.add(prefillId);
    prompts.push(
      makeCustomPromptEntry({
        identifier: prefillId,
        name: '【末尾策略】Assistant 预填充起手',
        role: 'assistant',
        content: prefillContent,
      })
    );
    order.push({ identifier: prefillId, enabled: true });
  } else if (scheme.tailMode === 'prefill_plus_user') {
    const prefillId = 'ups_tail_prefill';
    const triggerId = 'ups_tail_trigger';
    usedIds.add(prefillId);
    usedIds.add(triggerId);
    prompts.push(
      makeCustomPromptEntry({
        identifier: prefillId,
        name: '【末尾策略】Assistant 预填充起手',
        role: 'assistant',
        content: prefillContent,
      }),
      makeCustomPromptEntry({
        identifier: triggerId,
        name: '【末尾策略】User 末条触发',
        role: 'user',
        content: triggerContent,
      })
    );
    order.push(
      { identifier: prefillId, enabled: true },
      { identifier: triggerId, enabled: true }
    );
  } else {
    // 'user' or 'auto'
    const triggerId = 'ups_tail_trigger';
    usedIds.add(triggerId);
    prompts.push(
      makeCustomPromptEntry({
        identifier: triggerId,
        name: '【末尾策略】User 末条触发',
        role: 'user',
        content: triggerContent,
      })
    );
    order.push({ identifier: triggerId, enabled: true });
  }

  order.push({ identifier: 'jailbreak', enabled: false });

  return {
    name: presetName,
    temperature: clampNumber(scheme.temperature, 0, 2, 0.78),
    frequency_penalty: 0,
    presence_penalty: 0,
    top_p: 1,
    top_k: 0,
    top_a: 0,
    min_p: 0,
    repetition_penalty: 1,
    openai_max_context: 128000,
    openai_max_tokens: clampInt(scheme.maxTokens, 256, 32768, 3200),
    seed: -1,
    n: 1,
    stream_openai: true,
    max_context_unlocked: false,
    names_behavior: 0,
    send_if_empty: '',
    impersonation_prompt: '',
    new_chat_prompt: '[Start a new Chat]',
    new_group_chat_prompt: '[Start a new group chat. Group members: {{group}}]',
    new_example_chat_prompt: '[Example Chat]',
    continue_nudge_prompt: '[Continue your last message without repeating its original content.]',
    group_nudge_prompt: '',
    wi_format: '{0}',
    scenario_format: '{{scenario}}',
    personality_format: '{{personality}}',
    assistant_prefill: '',
    assistant_impersonation: '',
    use_sysprompt: false,
    squash_system_messages: false,
    continue_prefill: false,
    continue_postfix: ' ',
    wrap_in_quotes: false,
    show_thoughts: true,
    reasoning_effort: 'auto',
    prompts,
    prompt_order: [
      { character_id: 100000, order: deepClone(order) },
      { character_id: 100001, order: deepClone(order) },
    ],
    extensions: {
      user_persona_studio: {
        schemaVersion: 1,
        presetName,
        style: scheme.style,
        tailMode: scheme.tailMode,
        includeDraftAudit,
      },
    },
  };
}

export function exportDraftStripRegexScript(presetName = 'User人设工坊') {
  const cleanName = String(presetName ?? '').trim() || 'User人设工坊';
  return {
    id: 'ups-strip-draft-audit',
    scriptName: `${cleanName} · 隐藏草稿自检块`,
    findRegex: '/(?:【草稿自检】[\\s\\S]*?【\\/草稿自检】|<!--\\s*(?:persona_)?draft[\\s\\S]*?-->)\\s*/gi',
    replaceString: '',
    trimStrings: [],
    placement: [2],
    disabled: false,
    markdownOnly: true,
    promptOnly: true,
    runOnEdit: true,
    substituteRegex: 0,
    minDepth: null,
    maxDepth: null,
  };
}

// ============================================================================
// E. Draft Stripping, Post-Processing, Smart Linting, Splitting & Diff
// ============================================================================

export function stripDraftAuditBlocks(rawText) {
  const input = String(rawText ?? '').replace(/\r\n?/g, '\n');
  if (!input) {
    return { cleanText: '', draftLog: '', hasUnclosedDraft: false };
  }

  const openRe = /【\s*草稿自检\s*】|<!--\s*(?:persona_)?draft(?:\b|(?=[\s:：-]|$))/gi;
  let cursor = 0;
  let cleanOut = '';
  const draftParts = [];
  let hasUnclosedDraft = false;

  // Handle continuation where assistant prefill supplied 【草稿自检】 and upstream only returned body + 【/草稿自检】
  const firstOpen = openRe.exec(input);
  openRe.lastIndex = 0;
  const orphanCloseRe = /【\s*\/\s*草稿自检\s*】/;
  const orphanCloseMatch = orphanCloseRe.exec(input);
  if (orphanCloseMatch && (!firstOpen || orphanCloseMatch.index < firstOpen.index)) {
    const preBody = input.slice(0, orphanCloseMatch.index).trim();
    if (preBody) draftParts.push(preBody);
    cursor = orphanCloseMatch.index + orphanCloseMatch[0].length;
  }

  while (cursor < input.length) {
    openRe.lastIndex = cursor;
    const openMatch = openRe.exec(input);
    if (!openMatch) {
      cleanOut += input.slice(cursor);
      break;
    }

    cleanOut += input.slice(cursor, openMatch.index);
    const bodyStart = openMatch.index + openMatch[0].length;
    const isHtmlComment = openMatch[0].startsWith('<!--');

    if (isHtmlComment) {
      const closeIdx = input.indexOf('-->', bodyStart);
      if (closeIdx === -1) {
        hasUnclosedDraft = true;
        const partial = input.slice(bodyStart).replace(/^[:：\s-]+/, '').trim();
        if (partial) draftParts.push(partial);
        cursor = input.length;
        break;
      }
      const inner = input.slice(bodyStart, closeIdx).replace(/^[:：\s-]+/, '').trim();
      if (inner) draftParts.push(inner);
      cursor = closeIdx + 3;
    } else {
      const closeRe = /【\s*\/\s*草稿自检\s*】/g;
      closeRe.lastIndex = bodyStart;
      const closeMatch = closeRe.exec(input);
      if (!closeMatch) {
        hasUnclosedDraft = true;
        const partial = input.slice(bodyStart).trim();
        if (partial) draftParts.push(partial);
        cursor = input.length;
        break;
      }
      const inner = input.slice(bodyStart, closeMatch.index).trim();
      if (inner) draftParts.push(inner);
      cursor = closeMatch.index + closeMatch[0].length;
    }
  }

  return {
    cleanText: cleanOut.replace(/\n{3,}/g, '\n\n').trim(),
    draftLog: draftParts.join('\n\n').trim(),
    hasUnclosedDraft,
  };
}

export function estimateTokens(text) {
  const str = String(text ?? '');
  if (!str.trim()) return 0;
  const cjkMatches = str.match(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af\uff00-\uffef]/g);
  const cjkCount = cjkMatches ? cjkMatches.length : 0;
  const nonCjkCount = Math.max(0, str.length - cjkCount);
  return Math.max(1, Math.round(cjkCount * 1.35 + nonCjkCount * 0.28));
}

export function normalizeFlatLayout(text) {
  const strippedDraft = stripDraftAuditBlocks(text).cleanText;
  let out = String(strippedDraft ?? '').replace(/\r\n?/g, '\n').trim();
  if (!out) return '';

  // Unwrap outer fenced code blocks such as ```markdown / ```yaml / ```xml / ```
  const fenceMatch = out.match(/^```[a-zA-Z0-9_-]*\s*\n([\s\S]*?)\n```\s*$/);
  if (fenceMatch) {
    out = fenceMatch[1].trim();
  }

  // Strip simple XML-like wrapper tags while preserving square-bracket visibility markers
  out = out.replace(/<\/?([a-zA-Z][a-zA-Z0-9_-]*)(?:\s[^>]*)?>/g, () => '');

  const lines = out.split('\n').map((line) => {
    let cur = line.replace(/\t/g, '  ').replace(/[ \t]+$/g, '');
    // Flatten nested YAML/Markdown bullet indentation
    cur = cur.replace(/^[ ]{2,}[-*+]\s+/, '- ');
    // Flatten nested YAML key: value lines
    cur = cur.replace(/^[ ]{2,}([^\s:#【\[]+[:：])/, '$1');
    return cur;
  });

  out = lines.join('\n');
  out = out.replace(/\n{3,}/g, '\n\n').trim();
  return out;
}

function isExpandedVibeAnchorLine(lineText, lineLabelCount) {
  if (lineLabelCount >= 3) return false;
  if (countReadableChars(lineText) <= 26) return false;
  if (!/[，,：:；;（()]/.test(lineText)) return false;

  const clauses = lineText
    .split(/[，,：:；;（）()]+/)
    .map((c) => c.trim())
    .filter(Boolean);
  if (clauses.length < 2) return false;

  return clauses.some((clause) => {
    const listSeparators = (clause.match(/、/g) || []).length;
    return listSeparators <= 1 && countReadableChars(clause) >= 10;
  });
}

export function hasReplayRiskExamples(text) {
  const s = String(text ?? '');
  if (!s.trim()) return false;
  if (/(?:并非固定必演桥段|不复刻原例|不重复原桥段|禁止原样照搬|勿照搬|仅作理解思维)/u.test(s)) {
    return false;
  }
  return /(?:例如|比如|譬如|示例[:：]|不到(?:三|五|十)分钟)/u.test(s);
}

export function appendAntiParrotClause(text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return ANTI_PARROT_CLAUSE;
  if (trimmed.includes(ANTI_PARROT_CLAUSE) || /(?:并非固定必演桥段|不复刻原例|不重复原桥段)/u.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed}\n\n${ANTI_PARROT_CLAUSE}`;
}

export function replaceEmDashes(text) {
  const input = String(text ?? '');
  if (!input) return '';
  return input
    .replace(/\s*(?:——|――|--+)\s*/g, '，')
    .replace(/([：:；;。！？!?])，+/g, '$1')
    .replace(/，{2,}/g, '，')
    .replace(/，([。！？!?；;）)])/g, '$1')
    .replace(/(^|\n)([ \t]*[-*+]\s+)，/g, '$1$2')
    .replace(/(^|\n)，+/g, '$1');
}

export function lintPersonaText(text, tasteProfile = {}) {
  const raw = String(text ?? '');
  const normalized = raw.replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');
  const issues = [];

  const findLineNumber = (index) => {
    if (index < 0) return 0;
    return normalized.slice(0, index).split('\n').length;
  };

  // Pre-collect qualitative label matches per line so vibe anchors expanded with concrete daily details pass cleanly
  const rawLabelHits = [];
  const lineHitCounts = new Map();

  for (const item of QUALITATIVE_LABEL_PATTERNS) {
    const regex = new RegExp(
      item.pattern.source,
      item.pattern.flags.includes('g') ? item.pattern.flags : `${item.pattern.flags}g`
    );
    let m;
    while ((m = regex.exec(normalized)) !== null) {
      const lineNum = findLineNumber(m.index);
      lineHitCounts.set(lineNum, (lineHitCounts.get(lineNum) || 0) + 1);
      rawLabelHits.push({
        item,
        match: m[0],
        index: m.index,
        line: lineNum,
      });
    }
  }

  for (const hit of rawLabelHits) {
    const lineText = lines[hit.line - 1] || '';
    const lineCount = lineHitCounts.get(hit.line) || 1;
    if (isExpandedVibeAnchorLine(lineText, lineCount)) {
      continue;
    }
    issues.push({
      type: 'qualitative_label',
      severity: 'warn',
      label: hit.item.label,
      term: hit.item.label,
      category: hit.item.category,
      match: hit.match,
      index: hit.index,
      line: hit.line,
      message: `出现未展开的性格标签词「${hit.item.label}」（${hit.item.category}）`,
      suggestion: hit.item.hint,
    });
  }

  // 2. Built-in categorized clichés & user blacklist
  const useBuiltinBanned = tasteProfile?.useBuiltinBanned !== false;
  if (useBuiltinBanned) {
    const disabledSet = new Set(
      Array.isArray(tasteProfile?.disabledCategories) ? tasteProfile.disabledCategories : []
    );
    const activeBuiltinPhrases = Array.from(
      new Set(
        BUILTIN_BANNED_CATEGORIES
          .filter((cat) => !disabledSet.has(cat.id))
          .flatMap((cat) => cat.phrases)
      )
    );
    for (const phrase of activeBuiltinPhrases) {
      const idx = normalized.indexOf(phrase);
      if (idx !== -1) {
        issues.push({
          type: 'cliche_phrase',
          severity: 'warn',
          term: phrase,
          match: phrase,
          index: idx,
          line: findLineNumber(idx),
          message: `命中常见人设腔套话「${phrase}」`,
          suggestion: '建议改写为具体可感的生活习惯、感官体感或取舍逻辑。',
        });
      }
    }
  }

  const userBanned = Array.isArray(tasteProfile?.banned) ? tasteProfile.banned : [];
  for (const rawItem of userBanned) {
    const phrase = extractEntryText(rawItem);
    if (!phrase) continue;
    const idx = normalized.indexOf(phrase);
    if (idx !== -1) {
      issues.push({
        type: 'cliche_phrase',
        severity: 'error',
        term: phrase,
        match: phrase,
        index: idx,
        line: findLineNumber(idx),
        message: `命中个人拉黑写法「${phrase}」`,
        suggestion: '请替换为符合个人偏好的自然表达。',
      });
    }
  }

  // 3. System / meta preaching
  const metaPatterns = [
    /(?:禁止|严禁|不得|不要)\s*(?:(?:对|向|替|给|让)\s*)?(?:NPC|AI|模型|角色|系统|user|\{\{user\}\}|玩家|主角)[^\n。]*?(?:全知|赋魅|抢话|读心|主角光环)/i,
    /作为(?:AI|语言模型)/i,
  ];
  for (const pat of metaPatterns) {
    const m = normalized.match(pat);
    if (m) {
      issues.push({
        type: 'meta_preaching',
        severity: 'error',
        term: m[0],
        match: m[0],
        index: m.index ?? 0,
        line: findLineNumber(m.index ?? 0),
        message: `包含面向模型或叙事规则的系统说教「${m[0]}」`,
        suggestion: '请删去系统说教口号；若有未公开的私事直接用平实中文说明（如“此事平时未向外人提起”），悬疑阵营题材可按需开启可见度标注。',
      });
    }
  }

  // 4. Rigid prop / absolute negative rules
  const rigidRegex = /(?:绝不|永远不(?:会)?|每次都必|绝对不会)[^\n。，；]{1,18}/g;
  const rigidMatches = [...normalized.matchAll(rigidRegex)];
  if (rigidMatches.length >= 3) {
    for (const m of rigidMatches) {
      issues.push({
        type: 'rigid_prop_rule',
        severity: 'warn',
        term: m[0],
        match: m[0],
        index: m.index ?? 0,
        line: findLineNumber(m.index ?? 0),
        message: `存在密集的死板绝对禁令「${m[0]}」`,
        suggestion: '建议改为平时的日常习惯与何种契机下才会心软破例的弹性表现。',
      });
    }
  }

  // 5. Nested indentation or XML residual
  lines.forEach((line, idx) => {
    if (/^[ \t]{2,}[-*+]|^[ \t]{4,}\S/.test(line) || /<\/?[a-zA-Z][a-zA-Z0-9_-]*(?:\s[^>]*)?>/.test(line)) {
      const trimmedLine = line.trim();
      issues.push({
        type: 'nested_indent',
        severity: 'warn',
        term: trimmedLine,
        match: trimmedLine,
        line: idx + 1,
        message: '存在嵌套缩进或残余标签，可能破坏扁平排版结构',
        suggestion: '可使用「扁平排版整理」清理缩进与标签。',
      });
    }
  });

  // 6. Concrete episode replay risk & em-dash proliferation guards
  if (hasReplayRiskExamples(normalized)) {
    issues.push({
      type: 'replay_risk',
      code: 'REPLAY_RISK',
      severity: 'warn',
      term: '示例防照抄',
      match: '',
      line: 0,
      message: '检测到具体情境举例（如“例如/比如”），正文模型容易每轮原样照搬复演，建议附上防照抄说明',
      suggestion: ANTI_PARROT_CLAUSE,
    });
  }

  const dashMatches = normalized.match(/——|――/g);
  if (dashMatches && dashMatches.length >= 2) {
    issues.push({
      type: 'dash_overuse',
      code: 'DASH_OVERUSE',
      severity: 'warn',
      term: '破折号过多',
      match: '',
      line: 0,
      message: `检测到 ${dashMatches.length} 处破折号，易诱导正文模型模仿并引发破折号增殖，建议替换为自然逗号或冒号`,
      suggestion: '可点击旁侧「清理破折号」一键替换为清爽标点。',
    });
  }

  // 7. Structural headers & optional visibility markers
  const hasCoreShell =
    (normalized.includes('基础人设') && normalized.includes('当前背景')) ||
    (normalized.includes('人物本体核') && normalized.includes('当前剧场壳'));
  const hasVisibilityMarkers =
    normalized.includes('[外表可见]') ||
    normalized.includes('[开场已知]') ||
    normalized.includes('[私密未公开]') ||
    normalized.includes('[外显可感知]') ||
    normalized.includes('[既有共识') ||
    normalized.includes('[未公开私事');

  const advisories = [];
  if (tasteProfile?.visibilityTags === true && !hasVisibilityMarkers && normalized.trim().length > 0) {
    advisories.push({
      type: 'missing_visibility_marker',
      severity: 'info',
      term: '',
      match: '',
      line: 0,
      message: '已开启信息可见度标注，但正文中尚未检测到标记（如 [外表可见]、[私密未公开]）',
      suggestion: '涉及悬疑或阵营信息差时，可按需补充标记区分公开特征与私密心事。',
    });
  }

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warnCount = issues.filter((i) => i.severity === 'warn').length;
  const infoCount = issues.filter((i) => i.severity === 'info').length;
  const score = Math.max(0, Math.min(100, 100 - errorCount * 15 - warnCount * 6 - infoCount * 2));

  return {
    ok: errorCount === 0,
    score,
    issues,
    advisories,
    stats: {
      tokens: estimateTokens(normalized),
      charCount: normalized.length,
      readableChars: countReadableChars(normalized),
      lineCount: normalized ? lines.length : 0,
      hasCoreShell,
      hasVisibilityMarkers,
    },
  };
}

export function splitCoreAndShell(text) {
  const normalized = String(text ?? '').replace(/\r\n?/g, '\n').trim();
  if (!normalized) {
    return { core: '', shell: '', other: '' };
  }

  const lines = normalized.split('\n');
  const buckets = { core: [], shell: [], other: [] };
  let active = 'other';

  for (const line of lines) {
    const trimmed = line.trim();
    const isBoxHeading = /^【[^】]+】\s*$/.test(trimmed);
    const isTopHeading = isBoxHeading || /^#{1,3}\s+/.test(trimmed);
    if (isTopHeading) {
      if (/(?:基础人设|固定人设|人物本体核|本体核)/.test(trimmed)) {
        active = 'core';
      } else if (/(?:当前背景与关系|当前身份与关系|当前背景|当前剧场壳|剧场壳)/.test(trimmed)) {
        active = 'shell';
      } else if (isBoxHeading) {
        active = 'other';
      }
    }
    buckets[active].push(line);
  }

  if (buckets.core.length === 0 && buckets.shell.length === 0 && buckets.other.length > 0) {
    return {
      core: buckets.other.join('\n').trim(),
      shell: '',
      other: '',
    };
  }

  return {
    core: buckets.core.join('\n').trim(),
    shell: buckets.shell.join('\n').trim(),
    other: buckets.other.join('\n').trim(),
  };
}

function classifyPersonaPointCategory(sectionTitle, lineText) {
  const sec = String(sectionTitle ?? '').trim();
  const line = String(lineText ?? '').trim();
  const keyPartMatch = line.match(/^([^:：\n]{1,36})[:：]/);
  const lineKey = keyPartMatch ? keyPartMatch[1].trim() : '';

  // 1. Explicit line-key current-role overrides (keepByDefault: false)
  if (
    /(?:^|·|\s)(?:当前身份|当前背景|当前处境|目前处境|当前状态|开场|(?:当前|目前|现在|初始)?(?:与|和).{0,24}的?关系|当前关系|目前关系|现在关系|人物关系|剧场壳|阵营|职位|就职|现居|居住地|当前住址|住址|职业或身份|当前职业|社会地位|生活阶级|经济状况|social_status|occupation|residence|address)(?:\s|$|·)/i.test(
      lineKey
    )
  ) {
    return { category: '当前身份与关系', keepByDefault: false };
  }

  // 2. Specific line-key identity / basic info fields (keepByDefault: true)
  if (
    /(?:^|·|\s)(?:姓名|名字|中文名|英文名|别名|昵称|别称|乳名|称呼|别人对.*称呼|年龄|性别|生日|出生|星座|血型|mbti|种族|学历|语言|标签|name|char_name|chinese\s*name|english\s*name|nickname|alias|age|gender|sex|birthday|zodiac|tags)(?:\s|$|·|\/)/i.test(
      lineKey
    ) ||
    /^(?:姓名|名字|中文名|英文名|别名|昵称|别称|乳名|称呼|年龄|性别|生日|出生|星座|血型|mbti|种族|学历|语言|name|char_name|nickname|age|gender|birthday)[:：\s]/i.test(
      line
    )
  ) {
    return { category: '基础信息', keepByDefault: true };
  }

  // 3. Strong explicit section-level classification (prevents prose words inside a named section from drifting)
  if (
    /(?:当前身份|当前背景|当前处境|目前处境|当前状态|剧场壳|开场|与.*关系|居住地|当前住址|住址|职业或身份|当前职业)/i.test(
      sec
    )
  ) {
    return { category: '当前身份与关系', keepByDefault: false };
  }
  if (/(?:外貌|体貌|面容|穿搭|衣着|外表|appearance)/i.test(sec)) {
    return { category: '外貌与印象', keepByDefault: true };
  }
  if (/(?:生活习惯|习惯与喜好|喜好|偏好|饮食|作息|爱好|preferences|hobby)/i.test(sec)) {
    return { category: '习惯与喜好', keepByDefault: true };
  }
  if (/(?:成长经历|过往|经历|背景|技能|特长|能力|术式|background|history|technique)/i.test(sec)) {
    return { category: '经历与技能', keepByDefault: true };
  }
  if (/(?:性格|行为逻辑|底色|性情|人格|personality)/i.test(sec)) {
    return { category: '性格与底色', keepByDefault: true };
  }
  if (/(?:基本身份|基础信息|基本信息|basic_info|identity)/i.test(sec)) {
    return { category: '基础信息', keepByDefault: true };
  }

  // 4. Unanchored line heuristic for unsectioned / generic-section lines
  if (
    /(?:当前身份|当前背景|开场|与.*关系|剧场壳|阵营|职位|就职|现居|居住地|当前住址|担任.*与.*共事|与.*共事)/.test(
      line
    )
  ) {
    return { category: '当前身份与关系', keepByDefault: false };
  }

  // 4. General combined keyword matching for flat / unsectioned lines
  const combined = `${sec} ${line}`.trim();
  if (
    /(?:外貌|体貌|面容|脸型|五官|眉|眼|瞳|鼻|唇|肤色|发色|头发|发型|身高|体重|体型|身材|体态|身体|腿|手|疤|痣|耳饰|穿衣|穿搭|穿着|衣着|声线|声音|外表|气质|appearance|hair|skin|eyes|nose|lips|face|build|height|weight)/i.test(
      combined
    )
  ) {
    return { category: '外貌与印象', keepByDefault: true };
  }
  if (
    /(?:喜好|偏好|偏爱|爱好|生活习惯|饮食|食物|忌口|过敏|作息|睡眠|熬夜|厌恶|讨厌|爱吃|不吃|习惯|日常|food|preferences|hobby|nsfw)/i.test(
      combined
    )
  ) {
    return { category: '习惯与喜好', keepByDefault: true };
  }
  if (
    /(?:过往|成长经历|经历|出身|家庭|童年|少年|青年|介绍|背景|秘密|私事|旧事|技能|特长|擅长|不擅长|能力|术式|灵根|境界|background|history|timeline|technique)/i.test(
      combined
    )
  ) {
    return { category: '经历与技能', keepByDefault: true };
  }

  return { category: '性格与底色', keepByDefault: true };
}

function measureLineIndent(rawLine) {
  let count = 0;
  for (let i = 0; i < rawLine.length; i += 1) {
    const ch = rawLine[i];
    if (ch === ' ') count += 1;
    else if (ch === '\t') count += 2;
    else break;
  }
  return count;
}

function unwrapOuterQuotes(str) {
  const s = String(str ?? '').trim();
  if (
    s.length >= 2 &&
    ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))
  ) {
    return s.slice(1, -1).trim();
  }
  return s;
}

function stripTrailingYamlComment(rawLine) {
  const src = String(rawLine ?? '');
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === "'" && !inDouble) {
      if (i === 0 || (!inSingle && /[\s:：]/.test(src[i - 1]))) {
        inSingle = true;
      } else if (inSingle) {
        if (src[i + 1] === "'") {
          i += 1;
        } else {
          inSingle = false;
        }
      }
    } else if (ch === '"' && !inSingle && src[i - 1] !== '\\') {
      inDouble = !inDouble;
    } else if (ch === '#' && !inSingle && !inDouble) {
      const prev = i > 0 ? src[i - 1] : '';
      if (i === 0 || /\s|"|'/.test(prev)) {
        return src.slice(0, i).trim();
      }
    }
  }
  return src.trim();
}

function isTimeOrUrlText(str) {
  const s = String(str ?? '').trim();
  return /^\d{1,2}:\d{2}(?:\b|$)/.test(s) || /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(s);
}

function parseYamlValueAndComment(rawVal) {
  const src = String(rawVal ?? '').trim();
  if (!src) return { value: '', comment: '' };

  let inSingle = false;
  let inDouble = false;
  let commentIdx = -1;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === "'" && !inDouble) {
      if (i === 0) {
        inSingle = true;
      } else if (inSingle) {
        if (src[i + 1] === "'") {
          i += 1;
        } else {
          inSingle = false;
        }
      }
    } else if (ch === '"' && !inSingle && src[i - 1] !== '\\') {
      inDouble = !inDouble;
    } else if (ch === '#' && !inSingle && !inDouble) {
      const prev = i > 0 ? src[i - 1] : '';
      if (i === 0 || /\s|"|'/.test(prev)) {
        commentIdx = i;
        break;
      }
    }
  }

  const mainPart = commentIdx >= 0 ? src.slice(0, commentIdx).trim() : src;
  const commentPart = commentIdx >= 0 ? src.slice(commentIdx + 1).trim() : '';
  const unwrapped = unwrapOuterQuotes(mainPart);

  // Format inline YAML flow map `{phase: 相遇, time: ...}` cleanly
  if (unwrapped.startsWith('{') && unwrapped.endsWith('}')) {
    const inner = unwrapped.slice(1, -1).replace(/\s*,\s*/g, ' · ').trim();
    return { value: inner, comment: commentPart };
  }

  return { value: unwrapped, comment: commentPart };
}

function formatYamlItemWithComment(rawVal) {
  const { value, comment } = parseYamlValueAndComment(rawVal);
  if (value && comment) return `${value}（${comment}）`;
  return value || comment;
}

function isPureIdentityScalarKey(key) {
  return /^(?:姓名|名字|中文名|英文名|年龄|性别|生日|出生|星座|血型|mbti|身高|体重|民族|籍贯|name|char_name|chinese\s*name|english\s*name|age|gender|sex|birthday|zodiac|height|weight)$/i.test(
    String(key ?? '').trim()
  );
}

export function extractPersonaPoints(text, maxPoints = 24) {
  const normalized = String(text ?? '').replace(/\r\n?/g, '\n').trim();
  if (!normalized) return [];

  const limit = Math.max(1, Math.min(60, Math.round(Number(maxPoints) || 24)));
  const rawLines = normalized.split('\n');
  const points = [];
  const seenKeys = new Set();
  let currentSection = '';
  let inWorldbook = false;

  const pushPoint = (rawItem, sectionOverride = currentSection) => {
    if (points.length >= limit) return;
    const cleaned = String(rawItem ?? '')
      .replace(/^\s*(?:[-*+•]|\d+[.、)])\s*/, '')
      .replace(/\[(?:外表可见|开场已知|私密未公开|外显可感知|既有共识[^\]]*|未公开私事[^\]]*)\]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleaned.length < 2) return;
    if (/^【[^】]+】$/.test(cleaned) || /^#{1,6}\s/.test(cleaned)) return;
    const dedupKey = normalizeTasteKey(cleaned);
    if (!dedupKey || seenKeys.has(dedupKey)) return;
    seenKeys.add(dedupKey);
    const { category, keepByDefault } = classifyPersonaPointCategory(sectionOverride, cleaned);
    points.push({
      id: `pt_${points.length + 1}`,
      category,
      text: cleaned.length > 110 ? `${cleaned.slice(0, 108)}…` : cleaned,
      fullText: cleaned,
      keepByDefault,
    });
  };

  // Pre-filter outer fenced code markers & standalone XML wrapper tags
  const lines = [];
  for (const raw of rawLines) {
    const trimmed = raw.trim();
    if (!trimmed) {
      lines.push('');
      continue;
    }
    if (/^```[a-zA-Z0-9_-]*\s*$/.test(trimmed)) continue;
    if (/^<\/?(?:USER人设|user|persona|world_patch|world_setting|setting)(?:\s+[^>]*)?>\s*$/i.test(trimmed)) {
      continue;
    }
    lines.push(raw);
  }

  let idx = 0;
  let indentStack = []; // [{ indent, key }]

  const getActiveSectionPath = () => {
    const parts = [];
    if (currentSection) parts.push(currentSection);
    for (const s of indentStack) {
      if (s.key && !parts.includes(s.key)) parts.push(s.key);
    }
    return parts.join(' · ');
  };

  const popStackForIndent = (indent) => {
    while (indentStack.length > 0 && indent <= indentStack[indentStack.length - 1].indent) {
      indentStack.pop();
    }
  };

  const emitJoinedChunks = (prefixKey, items, sectionPath, maxChunkLen = 110) => {
    if (!items || items.length === 0) return;
    let bucket = [];
    let bucketLen = 0;
    const flushBucket = () => {
      if (bucket.length === 0) return;
      const body = bucket.join(' / ');
      pushPoint(prefixKey ? `${prefixKey}：${body}` : body, sectionPath);
      bucket = [];
      bucketLen = 0;
    };
    for (const item of items) {
      const cleanItem = String(item ?? '').trim();
      if (!cleanItem) continue;
      if (bucket.length > 0 && bucketLen + cleanItem.length + 3 > maxChunkLen) {
        flushBucket();
      }
      bucket.push(cleanItem);
      bucketLen += cleanItem.length + 3;
    }
    flushBucket();
  };

  while (idx < lines.length && points.length < limit) {
    const rawLine = lines[idx];
    const trimmed = rawLine.trim();
    if (!trimmed) {
      idx += 1;
      continue;
    }

    if (/^(?:【补充世界书条目】|【延展背景世界书】|={3,}\s*WORLDBOOK\s*={3,})/i.test(trimmed)) {
      inWorldbook = true;
      break;
    }
    if (inWorldbook) break;

    // 1. Explicit section headers: 【标题】 or ## 标题
    const boxMatch = trimmed.match(/^【([^】]+)】(?:（[^）]*）|\([^)]*\))?[:：]?\s*$/);
    const mdMatch = trimmed.match(/^#{1,4}\s+(.+?)\s*$/);
    if (boxMatch || mdMatch) {
      currentSection = (boxMatch?.[1] || mdMatch?.[1] || '').trim();
      indentStack = [];
      idx += 1;
      continue;
    }

    const indent = measureLineIndent(rawLine);
    popStackForIndent(indent);

    // 2. Block scalar header: `外貌与体型: |` or `existential_definition: >-`
    const blockScalarMatch = trimmed.match(/^([^\s:#【\[{][^:\n：]{0,36})[:：]\s*([|>][+-]?\d*)\s*$/);
    if (blockScalarMatch) {
      const blockKey = unwrapOuterQuotes(blockScalarMatch[1].replace(/^\s*[-*+•]\s*/, '').trim());
      const sectionPath = [getActiveSectionPath(), blockKey].filter(Boolean).join(' · ');
      const collectedLines = [];
      idx += 1;
      let blockMinIndent = null;
      while (idx < lines.length) {
        const nextRaw = lines[idx];
        const nextTrimmed = nextRaw.trim();
        if (!nextTrimmed) {
          collectedLines.push('');
          idx += 1;
          continue;
        }
        const nextIndent = measureLineIndent(nextRaw);
        if (nextIndent <= indent) break;
        if (blockMinIndent === null || nextIndent < blockMinIndent) {
          blockMinIndent = nextIndent;
        }
        collectedLines.push(nextTrimmed);
        idx += 1;
      }

      // Parse collected lines as bullets or prose paragraphs
      let paraBuf = [];
      const flushPara = () => {
        if (paraBuf.length === 0) return;
        const para = paraBuf.join(' ').replace(/\s+/g, ' ').trim();
        paraBuf = [];
        if (!para) return;
        const sentences = para
          .split(/(?<=[。！？；!?])\s*/)
          .map((s) => s.trim())
          .filter(Boolean);
        for (const s of sentences) {
          const formatted = s.startsWith(blockKey) || /^[【#]/.test(s) ? s : `${blockKey}：${s}`;
          pushPoint(formatted, sectionPath);
        }
      };

      for (const cl of collectedLines) {
        if (!cl) {
          flushPara();
          continue;
        }
        if (/^(?:[-*+•]|\d+[.、)])\s+/.test(cl)) {
          flushPara();
          const bulletBody = formatYamlItemWithComment(cl.replace(/^(?:[-*+•]|\d+[.、)])\s+/, ''));
          if (bulletBody) {
            pushPoint(`${blockKey}：${bulletBody}`, sectionPath);
          }
        } else {
          paraBuf.push(cl);
        }
      }
      flushPara();
      continue;
    }

    // 3. Empty-value container key (e.g. `别名:`, `别名: # 称呼`, `基本身份:`, `- 昵称或别称：`, `cursed_technique:`)
    const bulletStripped = trimmed.replace(/^(?:[-*+•]|\d+[.、)])\s+/, '');
    const isBulletLine = bulletStripped !== trimmed;
    const containerCandidate = stripTrailingYamlComment(bulletStripped);
    const emptyContainerMatch = containerCandidate.match(/^([^\s:#【\[{][^:\n：]{0,36})[:：]\s*$/);
    if (emptyContainerMatch) {
      const containerKey = unwrapOuterQuotes(emptyContainerMatch[1].trim());
      // Peek ahead for children (indented OR unindented `-` bullets right after indent-0 `key:`)
      const children = [];
      let j = idx + 1;
      while (j < lines.length) {
        const peekRaw = lines[j];
        const peekTrimmed = peekRaw.trim();
        if (!peekTrimmed) {
          // Stop on blank line if next non-blank line isn't deeper indented
          let k = j + 1;
          while (k < lines.length && !lines[k].trim()) k += 1;
          if (k >= lines.length || measureLineIndent(lines[k]) <= indent) break;
          j += 1;
          continue;
        }
        const peekIndent = measureLineIndent(peekRaw);
        const peekIsBullet = /^(?:[-*+•]|\d+[.、)])\s+/.test(peekTrimmed);
        if (peekIndent > indent || (!isBulletLine && indent === 0 && peekIndent === 0 && peekIsBullet)) {
          children.push({ raw: peekRaw, trimmed: peekTrimmed, indent: peekIndent, isBullet: peekIsBullet });
          j += 1;
        } else {
          break;
        }
      }

      if (children.length === 0) {
        idx += 1;
        continue;
      }

      // Check if direct children are pure bullet scalar/alias items (no nested sub-containers)
      const directChildIndent = Math.min(...children.map((c) => c.indent));
      const directChildren = children.filter((c) => c.indent === directChildIndent);
      const hasSubBlocks = children.some((c) => {
        const s = stripTrailingYamlComment(c.trimmed.replace(/^(?:[-*+•]|\d+[.、)])\s+/, ''));
        return /^[^\s:#【\[{][^:\n：]{0,36}[:：]\s*(?:[|>][+-]?\d*)?$/.test(s);
      });
      const allDirectBullets = directChildren.every((c) => c.isBullet);

      const sectionPath = [getActiveSectionPath(), containerKey].filter(Boolean).join(' · ');

      if (allDirectBullets && !hasSubBlocks) {
        const formattedItems = directChildren
          .map((c) => formatYamlItemWithComment(c.trimmed.replace(/^(?:[-*+•]|\d+[.、)])\s+/, '')))
          .filter(Boolean);
        emitJoinedChunks(containerKey, formattedItems, sectionPath);
        idx = j;
        continue;
      }

      // Check if direct children are flat key:value pairs (e.g. 基本身份: 年龄/性别/生日/职业/居住地)
      const allDirectKv = !hasSubBlocks && directChildren.every((c) => {
        const s = c.trimmed.replace(/^(?:[-*+•]|\d+[.、)])\s+/, '');
        return !isTimeOrUrlText(s) && /^([^\s:#【\[{][^:\n：]{0,36})[:：]\s*\S+/.test(s);
      });
      if (allDirectKv) {
        const scalarIdentityItems = [];
        const separateItems = [];
        for (const c of directChildren) {
          const s = c.trimmed.replace(/^(?:[-*+•]|\d+[.、)])\s+/, '');
          const kv = !isTimeOrUrlText(s) ? s.match(/^([^\s:#【\[{][^:\n：]{0,36})[:：]\s*(.+)$/) : null;
          if (!kv) continue;
          const k = unwrapOuterQuotes(kv[1].trim());
          const v = formatYamlItemWithComment(kv[2]);
          if (!v) continue;
          if (isPureIdentityScalarKey(k)) {
            scalarIdentityItems.push(`${k} ${v}`);
          } else {
            separateItems.push({ k, v });
          }
        }
        if (scalarIdentityItems.length > 0) {
          emitJoinedChunks(containerKey, scalarIdentityItems, sectionPath);
        }
        for (const item of separateItems) {
          pushPoint(`${item.k}：${item.v}`, sectionPath);
        }
        idx = j;
        continue;
      }

      // Multi-level nested YAML (e.g. 外貌: -> 面容: -> 类型: ...): push container onto indentStack
      indentStack.push({ indent, key: containerKey });
      idx += 1;
      continue;
    }

    // 4. Inline key: value line (e.g. `姓名: "宁雨眠"`, `别人对他的称呼: 楚霁寒/...`)
    const kvMatch = !isBulletLine && !isTimeOrUrlText(bulletStripped)
      ? bulletStripped.match(/^([^\s:#【\[{][^:\n：]{0,36})[:：]\s*(.+)$/)
      : null;
    if (kvMatch) {
      const k = unwrapOuterQuotes(kvMatch[1].trim());
      let v = formatYamlItemWithComment(kvMatch[2]);
      // Absorb unindented short slash/alias continuation lines immediately following (e.g. `楚小子/...`)
      while (idx + 1 < lines.length) {
        const nextRaw = lines[idx + 1];
        const nextTrimmed = nextRaw.trim();
        if (
          nextTrimmed &&
          measureLineIndent(nextRaw) === indent &&
          !/^(?:[-*+•]|\d+[.、)]|【|#)/.test(nextTrimmed) &&
          !/^[^\s:#【\[{][^:\n：]{0,36}[:：]/.test(nextTrimmed) &&
          nextTrimmed.length < 48 &&
          nextTrimmed.includes('/') &&
          !/[。！？]$/.test(nextTrimmed)
        ) {
          v = `${v} / ${formatYamlItemWithComment(nextTrimmed)}`;
          idx += 1;
        } else {
          break;
        }
      }
      const sectionPath = getActiveSectionPath();
      const topContainer = indentStack.length > 0 ? indentStack[indentStack.length - 1].key : '';
      const displayKey = topContainer && isPureIdentityScalarKey(k) ? `${topContainer}·${k}` : k;
      if (v) {
        pushPoint(`${displayKey}：${v}`, sectionPath);
      }
      idx += 1;
      continue;
    }

    // 5. Standard bullet or prose line (including Markdown bullets & long prose sentences)
    const cleanText = isBulletLine ? formatYamlItemWithComment(bulletStripped) : trimmed;
    const sectionPath = getActiveSectionPath();
    if (cleanText.length <= 85 || /^[^\s:：]{1,12}[:：]/.test(cleanText)) {
      pushPoint(cleanText, sectionPath);
    } else {
      const sentences = cleanText
        .split(/(?<=[。！？；!?])\s*/)
        .map((s) => s.trim())
        .filter(Boolean);
      for (const sentence of sentences) {
        pushPoint(sentence, sectionPath);
      }
    }
    idx += 1;
  }

  return points;
}

export function splitDualLayerOutput(text) {
  const stripped = stripDraftAuditBlocks(text).cleanText;
  const normalized = String(stripped ?? '').replace(/\r\n?/g, '\n').trim();
  if (!normalized) {
    return { coreDescription: '', worldbookEntries: [] };
  }

  const dividerRegex =
    /^(?:【补充世界书条目】|【延展背景世界书】|={3,}\s*WORLDBOOK\s*={3,}|#{1,3}\s*(?:补充世界书条目|延展背景世界书))\s*$/im;
  const match = dividerRegex.exec(normalized);
  if (!match) {
    return { coreDescription: normalized, worldbookEntries: [] };
  }

  const coreDescription = normalized.slice(0, match.index).trim();
  const wbRaw = normalized.slice(match.index + match[0].length).trim();
  if (!wbRaw) {
    return { coreDescription, worldbookEntries: [] };
  }

  const lines = wbRaw.split('\n');
  const entries = [];
  let current = null;
  let readingContent = false;

  const flush = () => {
    if (!current) return;
    const content = current.contentLines.join('\n').trim();
    const comment = current.comment.trim() || current.key[0] || '补充背景';
    if (content) {
      entries.push({
        key: current.key,
        comment,
        content,
      });
    }
    current = null;
    readingContent = false;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const headerBracketMatch = line.match(/^\[条目(?:[:：]\s*(.+?))?\]\s*$/);
    const headerHashMatch = line.match(/^#{2,4}\s+(.+?)\s*$/);
    const headerPrefixMatch = line.match(/^条目[:：]\s*(.+?)\s*$/);

    if (headerBracketMatch || headerHashMatch || headerPrefixMatch) {
      flush();
      const title = (headerBracketMatch?.[1] || headerHashMatch?.[1] || headerPrefixMatch?.[1] || '').trim();
      current = { comment: title, key: [], contentLines: [] };
      continue;
    }

    if (!current) {
      if (!line) continue;
      current = { comment: '', key: [], contentLines: [] };
    }

    const kwMatch = line.match(/^关键词[:：]\s*(.*)$/);
    if (kwMatch && !readingContent) {
      current.key = kwMatch[1]
        .split(/[,，/|、]/)
        .map((k) => k.trim())
        .filter(Boolean);
      continue;
    }

    const titleLineMatch = line.match(/^(?:标题|条目名)[:：]\s*(.+)$/);
    if (titleLineMatch && !readingContent) {
      current.comment = titleLineMatch[1].trim();
      continue;
    }

    const contentMatch = line.match(/^内容[:：]\s*(.*)$/);
    if (contentMatch) {
      readingContent = true;
      if (contentMatch[1].trim()) {
        current.contentLines.push(contentMatch[1].trim());
      }
      continue;
    }

    if (readingContent || line) {
      if (readingContent || current.key.length > 0 || current.comment) {
        current.contentLines.push(rawLine.trimEnd());
      }
    }
  }

  flush();
  return { coreDescription, worldbookEntries: entries };
}

export function parsePersonaSections(text) {
  const normalized = String(text ?? '').replace(/\r\n?/g, '\n');
  if (!normalized.trim()) return [];

  const lines = normalized.split('\n');
  const sections = [];
  let current = null;
  let seq = 0;

  const pushCurrent = () => {
    if (!current) return;
    sections.push({
      ...current,
      content: current.lines.join('\n').trim(),
    });
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const boxHeading = trimmed.match(/^【([^】]+)】\s*$/);
    const mdHeading = trimmed.match(/^(#{1,3})\s+(.+?)\s*$/);

    if (boxHeading) {
      pushCurrent();
      seq += 1;
      current = {
        id: `sec_${seq}`,
        title: boxHeading[1].trim(),
        level: 1,
        rawHeading: trimmed,
        lines: [],
      };
    } else if (mdHeading) {
      pushCurrent();
      seq += 1;
      current = {
        id: `sec_${seq}`,
        title: mdHeading[2].trim(),
        level: mdHeading[1].length,
        rawHeading: trimmed,
        lines: [],
      };
    } else {
      if (!current) {
        if (!trimmed) continue;
        current = {
          id: 'sec_0',
          title: '前导概述',
          level: 0,
          rawHeading: '',
          lines: [],
        };
      }
      current.lines.push(line);
    }
  }

  pushCurrent();
  return sections.map(({ lines: _unused, ...rest }) => rest);
}

export function computeLineDiff(oldText, newText) {
  const oldNorm = String(oldText ?? '').replace(/\r\n?/g, '\n');
  const newNorm = String(newText ?? '').replace(/\r\n?/g, '\n');

  const oldLines = oldNorm === '' ? [] : oldNorm.split('\n');
  const newLines = newNorm === '' ? [] : newNorm.split('\n');

  let prefixLen = 0;
  while (
    prefixLen < oldLines.length &&
    prefixLen < newLines.length &&
    oldLines[prefixLen] === newLines[prefixLen]
  ) {
    prefixLen += 1;
  }

  let suffixLen = 0;
  while (
    suffixLen < oldLines.length - prefixLen &&
    suffixLen < newLines.length - prefixLen &&
    oldLines[oldLines.length - 1 - suffixLen] === newLines[newLines.length - 1 - suffixLen]
  ) {
    suffixLen += 1;
  }

  const diffLines = [];
  for (let i = 0; i < prefixLen; i += 1) {
    diffLines.push({ type: 'equal', text: oldLines[i], oldLine: i + 1, newLine: i + 1 });
  }

  const midOld = oldLines.slice(prefixLen, oldLines.length - suffixLen);
  const midNew = newLines.slice(prefixLen, newLines.length - suffixLen);

  if (midOld.length * midNew.length <= 250000) {
    // Standard LCS DP for accurate line diff
    const m = midOld.length;
    const n = midNew.length;
    const dp = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));
    for (let i = m - 1; i >= 0; i -= 1) {
      for (let j = n - 1; j >= 0; j -= 1) {
        if (midOld[i] === midNew[j]) {
          dp[i][j] = dp[i + 1][j + 1] + 1;
        } else {
          dp[i][j] = dp[i + 1][j] >= dp[i][j + 1] ? dp[i + 1][j] : dp[i][j + 1];
        }
      }
    }

    let i = 0;
    let j = 0;
    while (i < m && j < n) {
      if (midOld[i] === midNew[j]) {
        diffLines.push({
          type: 'equal',
          text: midOld[i],
          oldLine: prefixLen + i + 1,
          newLine: prefixLen + j + 1,
        });
        i += 1;
        j += 1;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        diffLines.push({
          type: 'remove',
          text: midOld[i],
          oldLine: prefixLen + i + 1,
          newLine: null,
        });
        i += 1;
      } else {
        diffLines.push({
          type: 'add',
          text: midNew[j],
          oldLine: null,
          newLine: prefixLen + j + 1,
        });
        j += 1;
      }
    }
    while (i < m) {
      diffLines.push({ type: 'remove', text: midOld[i], oldLine: prefixLen + i + 1, newLine: null });
      i += 1;
    }
    while (j < n) {
      diffLines.push({ type: 'add', text: midNew[j], oldLine: null, newLine: prefixLen + j + 1 });
      j += 1;
    }
  } else {
    // Safe O(M+N) fallback for huge inputs
    midOld.forEach((line, idx) => {
      diffLines.push({ type: 'remove', text: line, oldLine: prefixLen + idx + 1, newLine: null });
    });
    midNew.forEach((line, idx) => {
      diffLines.push({ type: 'add', text: line, oldLine: null, newLine: prefixLen + idx + 1 });
    });
  }

  for (let s = 0; s < suffixLen; s += 1) {
    const oIdx = oldLines.length - suffixLen + s;
    const nIdx = newLines.length - suffixLen + s;
    diffLines.push({ type: 'equal', text: oldLines[oIdx], oldLine: oIdx + 1, newLine: nIdx + 1 });
  }

  let addedCount = 0;
  let removedCount = 0;
  let unchangedCount = 0;
  for (const item of diffLines) {
    if (item.type === 'add') addedCount += 1;
    else if (item.type === 'remove') removedCount += 1;
    else unchangedCount += 1;
  }

  return {
    lines: diffLines,
    summary: { addedCount, removedCount, unchangedCount },
  };
}

export function mergeSectionUpdate(fullText, sectionTitle, newContent) {
  const targetTitle = String(sectionTitle ?? '').trim();
  const strippedContent = stripDraftAuditBlocks(newContent).cleanText;
  let cleanBody = String(strippedContent ?? '').replace(/\r\n?/g, '\n').trim();
  const sections = parsePersonaSections(fullText);

  if (sections.length === 0) {
    return targetTitle ? `### ${targetTitle}\n${cleanBody}`.trim() : cleanBody;
  }

  const targetIdx = sections.findIndex(
    (sec) => sec.title === targetTitle || sec.title.toLowerCase() === targetTitle.toLowerCase()
  );

  if (targetIdx === -1) {
    const base = String(fullText ?? '').trim();
    const appended = targetTitle ? `### ${targetTitle}\n${cleanBody}` : cleanBody;
    return base ? `${base}\n\n${appended}` : appended;
  }

  const targetSec = sections[targetIdx];
  const escapedTitle = targetSec.title
    ? targetSec.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    : '';
  const altHeadingRe = escapedTitle
    ? new RegExp(`^(?:#{1,3}\\s+${escapedTitle}|【${escapedTitle}】)[ \\t]*(?:\\n|$)`)
    : null;

  while (cleanBody) {
    if (
      targetSec.rawHeading &&
      (cleanBody === targetSec.rawHeading || cleanBody.startsWith(`${targetSec.rawHeading}\n`))
    ) {
      cleanBody = cleanBody.slice(targetSec.rawHeading.length).trim();
      continue;
    }
    if (altHeadingRe && altHeadingRe.test(cleanBody)) {
      cleanBody = cleanBody.replace(altHeadingRe, '').trim();
      continue;
    }
    break;
  }

  const rebuilt = sections.map((sec, idx) => {
    const body = idx === targetIdx ? cleanBody : sec.content;
    if (!sec.rawHeading) return body;
    return body ? `${sec.rawHeading}\n${body}` : sec.rawHeading;
  });

  return rebuilt.filter(Boolean).join('\n\n').trim();
}

// ============================================================================
// F. Taste Profile Growth & Deduplication
// ============================================================================

function normalizeTasteKey(text) {
  let s = String(text ?? '').normalize('NFKC');
  s = s
    .replace(/，/g, ',')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/：/g, ':')
    .replace(/；/g, ';')
    .replace(/！/g, '!')
    .replace(/？/g, '?')
    .replace(/\s+/g, ' ')
    .trim();

  // Strip spaces adjacent to CJK characters or punctuation (e.g. "喜欢 安静 书房" -> "喜欢安静书房")
  s = s
    .replace(/([\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af,.!?;:()[\]{}、。「」『』【】])\s+/g, '$1')
    .replace(/\s+([\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af,.!?;:()[\]{}、。「」『』【】])/g, '$1');

  return s.replace(/[，。！？；：、,.!?;:]+$/g, '').trim().toLowerCase();
}

function isHeadingOrNoise(clause) {
  const s = clause.trim();
  if (!s) return true;
  if (/^【[^】]+】$/.test(s)) return true;
  if (/^#{1,6}\s/.test(s)) return true;
  if (/^\[[^\]]+\]$/.test(s)) return true;
  if (/^[-*+•\s]+$/.test(s)) return true;
  return false;
}

function stripBulletPrefix(line) {
  return line.replace(/^\s*[-*+•]\s+/, '').trim();
}

function splitTextIntoClauses(text, minLen = 2, maxLen = 120) {
  const result = [];
  const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n');
  for (const rawLine of lines) {
    const cleaned = stripBulletPrefix(rawLine);
    if (isHeadingOrNoise(cleaned)) continue;
    const clauses = cleaned
      .split(/[，,。；;！？!?\n]/)
      .map((c) => stripBulletPrefix(c))
      .filter((c) => c.length >= minLen && c.length <= maxLen && !isHeadingOrNoise(c));
    for (const clause of clauses) {
      result.push(clause);
    }
  }
  return result;
}

export function extractTasteCandidates(draftText, finalText, currentTaste = {}) {
  const diff = computeLineDiff(draftText, finalText);
  const existingBannedKeys = new Set(
    [
      ...DEFAULT_BANNED_PHRASES,
      ...(Array.isArray(currentTaste?.banned) ? currentTaste.banned.map(extractEntryText) : []),
    ]
      .map(normalizeTasteKey)
      .filter(Boolean)
  );
  const existingAnchorKeys = new Set(
    (Array.isArray(currentTaste?.anchors) ? currentTaste.anchors.map(extractEntryText) : [])
      .map(normalizeTasteKey)
      .filter(Boolean)
  );

  const draftAllClauseKeys = new Set(
    splitTextIntoClauses(draftText, 1, 200).map(normalizeTasteKey).filter(Boolean)
  );
  const finalAllClauseKeys = new Set(
    splitTextIntoClauses(finalText, 1, 200).map(normalizeTasteKey).filter(Boolean)
  );

  const rawRemovedClauses = [];
  const rawAddedClauses = [];
  const removedClauseKeys = new Set();
  const addedClauseKeys = new Set();

  for (const item of diff.lines) {
    if (item.type === 'remove') {
      const cleaned = stripBulletPrefix(item.text);
      if (isHeadingOrNoise(cleaned)) continue;
      const wholeKey = normalizeTasteKey(cleaned);
      if (wholeKey && (existingBannedKeys.has(wholeKey) || finalAllClauseKeys.has(wholeKey))) {
        continue;
      }
      const clauses = splitTextIntoClauses(cleaned, 2, 60);
      for (const clause of clauses) {
        const key = normalizeTasteKey(clause);
        if (!key) continue;
        removedClauseKeys.add(key);
        rawRemovedClauses.push({ clause, key, sourceLine: item.text.trim() });
      }
    } else if (item.type === 'add') {
      const cleaned = stripBulletPrefix(item.text);
      if (isHeadingOrNoise(cleaned)) continue;
      const wholeKey = normalizeTasteKey(cleaned);
      if (wholeKey && (existingAnchorKeys.has(wholeKey) || draftAllClauseKeys.has(wholeKey))) {
        continue;
      }
      const clauses = splitTextIntoClauses(cleaned, 3, 120);
      for (const clause of clauses) {
        const key = normalizeTasteKey(clause);
        if (!key) continue;
        addedClauseKeys.add(key);
        rawAddedClauses.push({ clause, key, sourceLine: item.text.trim() });
      }
    }
  }

  const bannedCandidates = [];
  const anchorCandidates = [];
  const seenBanned = new Set();
  const seenAnchors = new Set();

  for (const { clause, key, sourceLine } of rawRemovedClauses) {
    if (
      existingBannedKeys.has(key) ||
      seenBanned.has(key) ||
      finalAllClauseKeys.has(key) ||
      addedClauseKeys.has(key)
    ) {
      continue;
    }
    seenBanned.add(key);
    bannedCandidates.push({
      text: clause,
      reason: '从初稿中删改',
      sourceLine,
    });
  }

  for (const { clause, key, sourceLine } of rawAddedClauses) {
    if (
      existingAnchorKeys.has(key) ||
      seenAnchors.has(key) ||
      draftAllClauseKeys.has(key) ||
      removedClauseKeys.has(key)
    ) {
      continue;
    }
    seenAnchors.add(key);
    anchorCandidates.push({
      text: clause,
      reason: '定稿时手动补入',
      sourceLine,
    });
  }

  return { bannedCandidates, anchorCandidates };
}

export function mergeTasteEntries(existingList = [], newItems = []) {
  const result = [];
  const indexByKey = new Map();

  const ingest = (item) => {
    const rawText = extractEntryText(item);
    const cleanedText = rawText.replace(/\s+/g, ' ').trim();
    if (!cleanedText) return;
    const key = normalizeTasteKey(cleanedText);
    if (!key) return;

    const note =
      item && typeof item === 'object' && typeof item.note === 'string' ? item.note.trim() : '';

    if (indexByKey.has(key)) {
      const existingIdx = indexByKey.get(key);
      if (note && note !== result[existingIdx].note && !GENERIC_TASTE_NOTES.has(note)) {
        result[existingIdx] = { ...result[existingIdx], note };
      } else if (note && !result[existingIdx].note) {
        result[existingIdx] = { ...result[existingIdx], note };
      }
      return;
    }

    const entry = {
      id:
        item && typeof item === 'object' && typeof item.id === 'string' && item.id.trim()
          ? item.id.trim()
          : generateId('taste'),
      text: cleanedText,
      note,
      createdAt:
        item && typeof item === 'object' && Number.isFinite(item.createdAt)
          ? item.createdAt
          : Date.now(),
    };

    indexByKey.set(key, result.length);
    result.push(entry);
  };

  if (Array.isArray(existingList)) {
    for (const item of existingList) ingest(item);
  }
  if (Array.isArray(newItems)) {
    for (const item of newItems) ingest(item);
  }

  return result;
}

export function buildTasteSummaryMessages(tasteProfile = {}) {
  const anchors = (Array.isArray(tasteProfile?.anchors) ? tasteProfile.anchors : [])
    .map((item) => formatTastePromptItem(item, 'anchors'))
    .filter(Boolean);
  const banned = (Array.isArray(tasteProfile?.banned) ? tasteProfile.banned : [])
    .map((item) => formatTastePromptItem(item, 'banned'))
    .filter(Boolean);

  if (anchors.length === 0 && banned.length === 0) {
    throw new Error('偏好词库目前为空，请先在文稿中框选添加几条喜好或不喜欢记录');
  }

  return [
    {
      role: 'system',
      content: [
        '你是一位帮玩家整理写作口味偏好的助手。请把玩家平时零散标记的「喜欢的句子」和「不喜欢的句子及原因」，归纳提炼成简明、直白、好懂的通用写作偏好与避雷条目，供后续生成 User 人设时复用。',
        '严格按以下两段纯文本格式输出，每条一行，以 "- " 开头，禁止写多余寒暄或解释：',
        '【归纳后的喜好偏好】',
        '- 简短直白的喜好规则（2～5 条，若无原记录则写“无”）',
        '',
        '【归纳后的避雷规则】',
        '- 简短直白的避雷规则（2～5 条，若无原记录则写“无”）',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        anchors.length > 0 ? `【零散喜欢的句子】\n${anchors.join('\n')}` : '【零散喜欢的句子】\n无',
        banned.length > 0 ? `【零散不喜欢的句子与原因】\n${banned.join('\n')}` : '【零散不喜欢的句子与原因】\n无',
        '请直接按上述格式输出归纳结果。',
      ].join('\n\n'),
    },
  ];
}

export function parseTasteSummaryOutput(text) {
  const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n');
  const anchors = [];
  const banned = [];
  let bucket = '';

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (/喜好|偏爱/.test(trimmed) && (/^【/.test(trimmed) || /^#{1,4}\s/.test(trimmed))) {
      bucket = 'anchors';
      continue;
    }
    if (/避雷|禁写|不喜欢/.test(trimmed) && (/^【/.test(trimmed) || /^#{1,4}\s/.test(trimmed))) {
      bucket = 'banned';
      continue;
    }
    const item = trimmed.replace(/^\s*(?:[-*+•]|\d+[.、)])\s*/, '').trim();
    if (!item || item === '无' || item === '暂无' || /^【[^】]+】$/.test(item)) continue;
    if (bucket === 'anchors') {
      anchors.push({ text: item, note: 'AI 归纳提炼' });
    } else if (bucket === 'banned') {
      banned.push({ text: item, note: 'AI 归纳提炼' });
    }
  }

  return { anchors, banned };
}

// ============================================================================
// G. Custom API Helpers
// ============================================================================

export function normalizeBaseUrl(url) {
  const raw = String(url ?? '').trim();
  if (!raw) return '';

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return '';
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return '';
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    return '';
  }

  let pathname = parsed.pathname.replace(/\/+$/, '');
  if (/\/responses$/i.test(pathname)) {
    return '';
  }

  pathname = pathname.replace(/\/chat\/completions$/i, '').replace(/\/models$/i, '').replace(/\/+$/, '');
  return `${parsed.origin}${pathname}`;
}

export function maskApiKey(key) {
  const s = String(key ?? '').trim();
  if (!s) return '';
  if (s.length <= 4) return '••••';
  if (s.length <= 8) return `••••${s.slice(-2)}`;
  return `${s.slice(0, 4)}••••${s.slice(-4)}`;
}

export function createApiProfile(input = {}, existingProfiles = []) {
  const raw = input && typeof input === 'object' ? input : {};
  const list = Array.isArray(existingProfiles) ? existingProfiles : [];

  const rawBaseUrl = String(raw.baseUrl ?? '').trim();
  const baseUrl = rawBaseUrl ? normalizeBaseUrl(rawBaseUrl) : '';
  if (rawBaseUrl && !baseUrl) {
    throw new Error('API 基础地址格式无效');
  }

  const rawKey = String(raw.apiKey ?? '');
  if (/[\r\n]/.test(rawKey)) {
    throw new Error('API Key 不能包含换行符');
  }

  let id = String(raw.id || '').trim() || generateId('api');
  while (list.some((p) => p && p.id === id)) {
    id = generateId('api');
  }

  const baseName = String(raw.name || '').trim() || '自定义方案';
  let finalName = baseName;
  let n = 2;
  while (list.some((p) => p && p.id !== id && String(p.name || '').trim() === finalName)) {
    finalName = `${baseName} (${n})`;
    n += 1;
  }

  return {
    id,
    name: finalName,
    baseUrl,
    apiKey: rawKey.trim(),
    model: String(raw.model ?? '').trim(),
    temperature: optionalFiniteNumber(raw.temperature, 0, 2, null),
    maxTokens: clampInt(raw.maxTokens, 256, 32768, 4096),
    topP: optionalFiniteNumber(raw.topP, 0, 1, null),
    stream: raw.stream !== false,
    timeoutSeconds: clampInt(raw.timeoutSeconds, 10, 300, 120),
  };
}

export function buildCustomChatPayload(profile, messages, options = {}) {
  const opts = options && typeof options === 'object' ? options : {};
  const baseUrl = normalizeBaseUrl(profile?.baseUrl);
  if (!baseUrl) {
    throw new Error('请填写有效的自定义 API 基础地址');
  }

  const model = String(profile?.model ?? '').trim();
  if (!model) {
    throw new Error('请先选择或填写模型名称');
  }

  const apiKey = String(profile?.apiKey ?? '');
  if (/[\r\n]/.test(apiKey)) {
    throw new Error('API Key 不能包含换行符');
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('消息列表不能为空');
  }

  const cleanMessages = messages.map((m) => ({
    role: validRole(m?.role, 'user'),
    content: String(m?.content ?? ''),
  }));

  const maxTokens = clampInt(profile?.maxTokens, 256, 32768, 4096);
  const stream = opts.stream !== undefined ? Boolean(opts.stream) : Boolean(profile?.stream);

  const includeBody = { max_tokens: maxTokens };
  const temp = optionalFiniteNumber(profile?.temperature, 0, 2, null);
  if (temp !== null) {
    includeBody.temperature = temp;
  }
  const topP = optionalFiniteNumber(profile?.topP, 0, 1, null);
  if (topP !== null) {
    includeBody.top_p = topP;
  }

  if (opts.target === 'openai_direct') {
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey.trim()) {
      headers.Authorization = `Bearer ${apiKey.trim()}`;
    }
    return {
      url: `${baseUrl}/chat/completions`,
      headers,
      body: {
        model,
        messages: cleanMessages,
        stream,
        ...includeBody,
      },
    };
  }

  const excludeBody = [
    'temperature',
    'top_p',
    'top_k',
    'presence_penalty',
    'frequency_penalty',
    'reasoning_effort',
  ].filter((k) => !Object.hasOwn(includeBody, k));

  return {
    type: 'quiet',
    chat_completion_source: 'custom',
    custom_url: baseUrl,
    model,
    messages: cleanMessages,
    stream,
    // Always override Authorization explicitly in ST proxy mode: ST's chat-completions backend
    // unconditionally injects `'Authorization': 'Bearer ' + readSecret(SECRET_KEYS.CUSTOM)` before
    // spreading `custom_include_headers`, so omitting Authorization would leak ST's stored Custom key.
    custom_include_headers: JSON.stringify({
      Authorization: apiKey.trim() ? `Bearer ${apiKey.trim()}` : '',
    }),
    custom_include_body: JSON.stringify(includeBody),
    custom_exclude_body: JSON.stringify(excludeBody),
  };
}

function extractContentText(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && (part.type === 'text' || part.type === 'output_text')) {
          return String(part.text ?? '');
        }
        return '';
      })
      .join('');
  }
  return '';
}

export function parseChatCompletionChunkOrJson(rawText) {
  const trimmed = String(rawText ?? '').trim();
  if (!trimmed) {
    return { text: '', done: false, error: null, usage: null };
  }

  if (trimmed.startsWith('{')) {
    try {
      const payload = JSON.parse(trimmed);
      if (payload && payload.error) {
        const msg =
          typeof payload.error === 'string'
            ? payload.error
            : payload.error.message || JSON.stringify(payload.error);
        return { text: '', done: true, error: String(msg), usage: payload.usage ?? null };
      }
      const choice = Array.isArray(payload?.choices) ? payload.choices[0] : null;
      const text = extractContentText(choice?.delta?.content ?? choice?.message?.content ?? choice?.text ?? '');
      const done = Boolean(choice?.finish_reason) || Boolean(choice?.message);
      return { text, done, error: null, usage: payload?.usage ?? null };
    } catch {
      return { text: '', done: false, error: '响应解析失败', usage: null };
    }
  }

  const lines = trimmed.split(/\r?\n/);
  let text = '';
  let done = false;
  let error = null;
  let usage = null;
  let parsedAnyData = false;
  let sawSseFrameLine = false;
  let sawNonSseLine = false;
  let sawMalformedData = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith(':') || /^(?:event|id|retry):/i.test(line)) {
      sawSseFrameLine = true;
      continue;
    }
    if (!line.startsWith('data:')) {
      sawNonSseLine = true;
      continue;
    }

    sawSseFrameLine = true;
    const dataStr = line.slice(5).trim();
    if (!dataStr) continue;
    if (dataStr === '[DONE]') {
      done = true;
      parsedAnyData = true;
      continue;
    }

    try {
      const payload = JSON.parse(dataStr);
      parsedAnyData = true;
      if (payload && payload.error) {
        error =
          typeof payload.error === 'string'
            ? payload.error
            : String(payload.error.message || JSON.stringify(payload.error));
        done = true;
        continue;
      }
      if (payload?.usage) usage = payload.usage;
      const choice = Array.isArray(payload?.choices) ? payload.choices[0] : null;
      if (choice) {
        const piece = extractContentText(choice.delta?.content ?? choice.message?.content ?? choice.text ?? '');
        if (piece) text += piece;
        if (choice.finish_reason) done = true;
      }
    } catch {
      sawMalformedData = true;
      continue;
    }
  }

  if (!parsedAnyData) {
    if (sawSseFrameLine && !sawNonSseLine && !sawMalformedData) {
      return { text: '', done: false, error: null, usage: null };
    }
    return { text: '', done: false, error: '响应解析失败', usage: null };
  }

  return { text, done, error, usage };
}
