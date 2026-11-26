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
  COMMON_PERSONA_LEXICON_CATEGORIES,
  COMPANION_FREQUENCY_TIERS,
  COMPANION_CARRY_MODES,
  WORLDBOOK_LIGHT_MODES,
  COMPANION_RELATION_PRESETS,
  MODULE_RATIO_KEYS,
  MODULE_RATIO_DEFAULTS,
  GENERATION_LAYOUT_STYLES,
  GENERATION_SECTION_GROUPS,
  GENERATION_SECTION_PRESETS,
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
  BUILTIN_PRESET_SCHEMA_VERSION,
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
  COMMON_PERSONA_LEXICON_CATEGORIES,
  COMPANION_FREQUENCY_TIERS,
  COMPANION_CARRY_MODES,
  WORLDBOOK_LIGHT_MODES,
  COMPANION_RELATION_PRESETS,
  MODULE_RATIO_KEYS,
  MODULE_RATIO_DEFAULTS,
  GENERATION_LAYOUT_STYLES,
  GENERATION_SECTION_GROUPS,
  GENERATION_SECTION_PRESETS,
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
  BUILTIN_PRESET_SCHEMA_VERSION,
  BUILTIN_PRESET_SCHEMES,
};

export const DEFAULT_PREFILL = `${CORE_SECTION_HEADER}\n## 外貌与日常印象\n-`;
export const DEFAULT_TRIGGER = '请直接按以上要求输出完整结果，不要寒暄或附加解释。';
export const MAX_GENERATION_HISTORY = 8;
export const MAX_HISTORY_ENTRY_CHARS = 12000;
export const DEFAULT_HIDE_DRAFT_AUDIT = true;

export const WORLD_INFO_POSITION = Object.freeze({
  BEFORE: 0,
  AFTER: 1,
  AN_TOP: 2,
  AN_BOTTOM: 3,
  AT_DEPTH: 4,
  EM_TOP: 5,
  EM_BOTTOM: 6,
  OUTLET: 7,
});

export const DEFAULT_USER_WORLDBOOK_PLACEMENT = Object.freeze({
  position: WORLD_INFO_POSITION.AT_DEPTH,
  depth: 2,
  role: 0,
  order: 120,
});

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
  'worldbook',
  'draft_audit',
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
const VALID_LAYOUT_STYLES = new Set(GENERATION_LAYOUT_STYLES.map((s) => s.id));
const VALID_SECTION_PRESETS = new Set([...Object.keys(GENERATION_SECTION_PRESETS), 'custom']);
const ALL_SECTION_ITEMS = GENERATION_SECTION_GROUPS.flatMap((g) => g.items);
const VALID_SECTION_IDS = new Set(ALL_SECTION_ITEMS.map((item) => item.id));
const SECTION_ITEM_BY_ID = new Map(ALL_SECTION_ITEMS.map((item) => [item.id, item]));
const INTIMATE_SECTION_IDS = new Set(
  (GENERATION_SECTION_GROUPS.find((g) => g.id === 'intimate')?.items || []).map((item) => item.id)
);
const NPC_NETWORK_SECTION_IDS = new Set(
  (GENERATION_SECTION_GROUPS.find((g) => g.id === 'npc_network')?.items || []).map((item) => item.id)
);
const BODY_TRAIT_SECTION_IDS = new Set(
  (GENERATION_SECTION_GROUPS.find((g) => g.id === 'body_traits')?.items || []).map((item) => item.id)
);
const SECTION_CHAR_WEIGHTS = Object.freeze({
  basic_identity: 0.7,
  appearance_outfit: 1.1,
  personality_logic: 1.3,
  habits_tastes: 1.0,
  backstory_growth: 1.1,
  career_finance: 0.85,
  relation_to_char: 1.15,
  parents_family: 0.65,
  siblings: 0.65,
  friends_circle: 0.65,
  ex_partner: 0.65,
  key_npc_pet: 0.65,
  height_build: 0.65,
  voice_scent_marks: 0.65,
  constitution_ability: 0.65,
  intimate_dynamic: 0.75,
  intimate_preference: 0.75,
  intimate_sensitivity: 0.75,
  intimate_boundary: 0.75,
});
const VALID_COMPANION_TIER_IDS = new Set(COMPANION_FREQUENCY_TIERS.map((t) => t.id));
const COMPANION_TIER_BY_ID = new Map(COMPANION_FREQUENCY_TIERS.map((t) => [t.id, t]));
const VALID_COMPANION_CARRY_MODES = new Set(COMPANION_CARRY_MODES.map((m) => m.id));
const VALID_WORLDBOOK_LIGHT_MODES = new Set(WORLDBOOK_LIGHT_MODES.map((m) => m.id));
const COMPANION_TIER_WEIGHTS = Object.freeze({
  background: 0.7,
  occasional: 1.0,
  active_circle: 1.35,
});
const UPS_EXT_KEY = 'user_persona_studio';
export const CANONICAL_POINT_CATEGORIES = Object.freeze([
  '基础信息',
  '外貌与印象',
  '性格与底色',
  '习惯与喜好',
  '经历与技能',
  'NSFW / 亲密设定',
  '当前身份与关系',
]);
const NSFW_INTIMATE_RE =
  /(?:nsfw|r18|亲密设定|亲密关系倾向|亲密偏好|亲密氛围|亲密互动|亲密表现|亲密接触|敏感取向|敏感带|敏感点|身体敏感|生理敏感|性敏感|事后相处|边界与事后|性癖|情欲|床事|欢爱|房事|性向|xp倾向)/iu;
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
  // Tight ±8% range so e.g. 2000 chars gives 1840~2160 instead of a loose 1000-char spread
  const charsMin = Math.max(150, Math.round((chars * 0.92) / 10) * 10);
  const charsMax = Math.max(charsMin + 30, Math.round((chars * 1.08) / 10) * 10);
  const tokensApprox = Math.max(1, Math.round(chars * 1.35));
  const tokensMin = Math.max(100, Math.round((charsMin * 1.35) / 10) * 10);
  const tokensMax = Math.max(tokensMin + 40, Math.round((charsMax * 1.35) / 10) * 10);
  // Generous max_tokens headroom so draft self-check + reasoning/thinking + full persona never truncate
  const recommendedMaxTokens = clampInt(
    Math.max(2800, Math.round((tokensMax * 1.82 + 1200) / 100) * 100),
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
    if (!trimmed || /(?:手控|非抢话|^适合不抢话党)/u.test(trimmed)) return '适合不抢话党';
  } else if (id === 'persona_refactor') {
    if (!trimmed || /^(?:旧人设改写|人设重构)/u.test(trimmed)) return '旧人设改写';
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

const LEGACY_BUILTIN_CONTENT_RE =
  /(?:人物本体核|当前剧场壳|跨卡可锁|随卡可换|手控客观|纯手控|客观手控|非抢话|未公开私事|旁人无从知晓|外显可感知|既有共识|占\s*20%|1300\s*至\s*2400|尽量用\s*\{\{user\}\}\s*指代|开启【长设定自动拆出世界书】|仅当.*开启通用跨卡模式|仅在明确选择通用跨卡模式|及在场亲友|及客串人物|切勿大幅缩水或超写)/u;

const BUILTIN_WORDING_EDITS = new Map([
  ['lf_format', [/标点干净利落：(?=全文不使用破折号)|，防止后续对话模仿引发破折号增殖/gu, '']],
  ['lf_craft', ['（严禁每行开头重复堆砌 {{user}} 浪费上下文）', '，不逐句重复写 {{user}}']],
  ['lf_banned', ['与正文预设重复的系统命令口号', '系统命令']],
  ['pc_banned', ['与正文预设重复的系统禁令口号', '系统命令']],
  ['pr_taste', ['过多吃穿小喜好适度精简收束避免细节每轮重复', '精简琐碎的吃穿喜好，不把细节写成每轮必提']],
]);

function upgradeLegacyBuiltinEntries(resolvedId, sanitizedEntries, rawPresetVersion) {
  const factory = BUILTIN_PRESET_SCHEMES[resolvedId];
  if (!factory) return sanitizedEntries;
  const ver = Number(rawPresetVersion) || 0;
  const serialized = JSON.stringify(sanitizedEntries);
  const needsUpgrade =
    ver < BUILTIN_PRESET_SCHEMA_VERSION ||
    sanitizedEntries.length === 0 ||
    LEGACY_BUILTIN_CONTENT_RE.test(serialized);
  if (!needsUpgrade) return sanitizedEntries;

  const factoryIds = new Set(factory.entries.map((e) => e.id));
  const existingById = new Map(sanitizedEntries.map((e) => [e.id, e]));
  const upgraded = factory.entries.map((fe, idx) => {
    const prev = existingById.get(fe.id);
    const enabled = prev ? prev.enabled !== false : fe.enabled !== false;
    return sanitizeSchemeEntry({ ...deepClone(fe), enabled }, idx);
  });

  // Preserve any custom entries added by the user (non-factory IDs / custom slotType)
  for (const existing of sanitizedEntries) {
    if (!factoryIds.has(existing.id) && !LEGACY_BUILTIN_CONTENT_RE.test(`${existing.name}\n${existing.content}`)) {
      upgraded.push(existing);
    }
  }
  return upgraded;
}

function sanitizeScheme(scheme, fallbackIndex = 0) {
  const raw = scheme && typeof scheme === 'object' ? scheme : {};
  const resolvedId = String(raw.id || '').trim() || generateId(`scheme_${fallbackIndex}`);
  const isBuiltinId = BUILTIN_SCHEME_IDS.has(resolvedId);
  const factory = isBuiltinId ? BUILTIN_PRESET_SCHEMES[resolvedId] : null;
  const isLegacyBuiltin = Boolean(
    isBuiltinId && ((Number(raw.presetVersion) || 0) < BUILTIN_PRESET_SCHEMA_VERSION)
  );

  const style = VALID_STYLES.has(raw.style) ? raw.style : (factory?.style || 'longform');
  const defaultChars = style === 'objective' ? 600 : 1500;
  const defaultTemp = style === 'objective' ? 0.55 : style === 'refactor' ? 0.65 : 0.78;
  const defaultBudget = computeLengthBudget(defaultChars);
  const rawEntries = Array.isArray(raw.entries) ? raw.entries : [];
  const seenIds = new Set();
  const initialEntries = rawEntries.map((item, idx) => {
    const clean = sanitizeSchemeEntry(item, idx);
    const wordingEdit = isBuiltinId && BUILTIN_WORDING_EDITS.get(clean.id);
    if (wordingEdit) clean.content = clean.content.replace(...wordingEdit);
    while (seenIds.has(clean.id)) {
      clean.id = generateId('entry');
    }
    seenIds.add(clean.id);
    return clean;
  });
  const entries = isBuiltinId
    ? upgradeLegacyBuiltinEntries(resolvedId, initialEntries, raw.presetVersion)
    : initialEntries;

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
  if (hasExplicitTokens && (!isLegacyBuiltin || targetChars === (factory?.targetChars ?? defaultChars))) {
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

  const migratedName = isBuiltinId
    ? normalizeBuiltinLegacyName(resolvedId, raw.name)
    : String(raw.name || '').trim();
  const effectiveBudget = computeLengthBudget(targetChars);
  const migratedMaxTokens = isBuiltinId
    ? normalizeBuiltinLegacyMaxTokens(resolvedId, raw.maxTokens, targetChars, effectiveBudget.recommendedMaxTokens)
    : clampInt(raw.maxTokens, 256, 32768, defaultBudget.recommendedMaxTokens);

  const rawDesc = String(raw.description ?? '');
  const description =
    isBuiltinId && (isLegacyBuiltin || !rawDesc || LEGACY_BUILTIN_CONTENT_RE.test(rawDesc))
      ? String(factory.description)
      : rawDesc;
  const rawPrefill = String(raw.prefillText ?? '');
  const prefillText =
    isBuiltinId && (isLegacyBuiltin || !rawPrefill || LEGACY_BUILTIN_CONTENT_RE.test(rawPrefill))
      ? String(factory.prefillText)
      : (raw.prefillText !== undefined ? rawPrefill : `${CORE_SECTION_HEADER}\n`);
  const rawTrigger = String(raw.triggerText ?? '');
  const triggerText =
    isBuiltinId && (isLegacyBuiltin || !rawTrigger || LEGACY_BUILTIN_CONTENT_RE.test(rawTrigger))
      ? String(factory.triggerText)
      : (raw.triggerText !== undefined ? rawTrigger : DEFAULT_TRIGGER);
  const syncedOverrides = {};
  for (const key of ['generationSections', 'dualLayer', 'draftAudit']) {
    const text = raw.syncedOverrides?.[key];
    if (typeof text === 'string' && text.trim()) syncedOverrides[key] = text.trim();
  }

  return {
    id: resolvedId,
    ...(isBuiltinId ? { presetVersion: BUILTIN_PRESET_SCHEMA_VERSION } : {}),
    name: migratedName || `未命名方案 ${fallbackIndex + 1}`,
    style,
    builtin: Boolean(raw.builtin || isBuiltinId),
    favorite: Boolean(raw.favorite),
    description,
    targetChars,
    targetTokens: {
      min: minTokens,
      max: maxTokens,
    },
    tailMode: validTailMode(raw.tailMode, 'auto'),
    prefillText,
    triggerText,
    temperature: clampNumber(raw.temperature, 0, 2, defaultTemp),
    maxTokens: migratedMaxTokens,
    entries,
    ...(Object.keys(syncedOverrides).length > 0 ? { syncedOverrides } : {}),
  };
}

function sortFavoriteSchemesFirst(schemes) {
  return [...schemes].sort((a, b) => Number(Boolean(b?.favorite)) - Number(Boolean(a?.favorite)));
}

export function normalizeModuleRatios(ratios = {}) {
  const raw = ratios && typeof ratios === 'object' ? ratios : {};
  const appearance = clampInt(raw.appearance, 0, 80, MODULE_RATIO_DEFAULTS.appearance);
  const personality = clampInt(raw.personality, 0, 80, MODULE_RATIO_DEFAULTS.personality);
  const backstory = clampInt(raw.backstory, 0, 80, MODULE_RATIO_DEFAULTS.backstory);
  const relationship = clampInt(raw.relationship, 0, 80, MODULE_RATIO_DEFAULTS.relationship);
  const privateQuota = clampInt(raw.private, 0, 40, MODULE_RATIO_DEFAULTS.private);

  const hasCustomValues =
    appearance !== MODULE_RATIO_DEFAULTS.appearance ||
    personality !== MODULE_RATIO_DEFAULTS.personality ||
    backstory !== MODULE_RATIO_DEFAULTS.backstory ||
    relationship !== MODULE_RATIO_DEFAULTS.relationship ||
    privateQuota !== MODULE_RATIO_DEFAULTS.private;

  const mode =
    raw.mode === 'custom'
      ? 'custom'
      : raw.mode === 'auto'
        ? (privateQuota > 0 ? 'custom' : 'auto')
        : hasCustomValues
          ? 'custom'
          : 'auto';

  return {
    mode,
    appearance,
    personality,
    backstory,
    relationship,
    private: privateQuota,
  };
}

export function normalizeGenerationSectionsConfig(config = {}) {
  const raw = config && typeof config === 'object' ? config : {};
  const layoutStyle = VALID_LAYOUT_STYLES.has(raw.layoutStyle) ? raw.layoutStyle : 'structured';
  const rawPreset = typeof raw.presetId === 'string' ? raw.presetId.trim() : '';
  let presetId = VALID_SECTION_PRESETS.has(rawPreset) ? rawPreset : 'standard';

  let enabledIds;
  if (Array.isArray(raw.enabledIds)) {
    const seen = new Set();
    const filtered = [];
    for (const id of raw.enabledIds) {
      const clean = String(id ?? '').trim();
      if (VALID_SECTION_IDS.has(clean) && !seen.has(clean)) {
        seen.add(clean);
        filtered.push(clean);
      }
    }
    enabledIds = filtered;
  } else {
    const presetKey = presetId !== 'custom' && GENERATION_SECTION_PRESETS[presetId] ? presetId : 'standard';
    enabledIds = [...GENERATION_SECTION_PRESETS[presetKey].enabledIds];
  }

  if (!rawPreset) {
    if (Array.isArray(raw.enabledIds)) {
      const std = GENERATION_SECTION_PRESETS.standard.enabledIds;
      const isStd = std.length === enabledIds.length && std.every((id) => enabledIds.includes(id));
      presetId = isStd ? 'standard' : 'custom';
    } else {
      presetId = 'standard';
    }
  } else if (presetId !== 'custom' && Array.isArray(raw.enabledIds)) {
    const presetTarget = GENERATION_SECTION_PRESETS[presetId]?.enabledIds || [];
    const sameSize = presetTarget.length === enabledIds.length;
    const sameItems = sameSize && presetTarget.every((id) => enabledIds.includes(id));
    if (!sameItems) {
      presetId = 'custom';
    }
  }

  const customSections = [];
  if (Array.isArray(raw.customSections)) {
    const seenCustomIds = new Set();
    const seenCustomNames = new Set();
    for (let i = 0; i < raw.customSections.length && customSections.length < 12; i += 1) {
      const item = raw.customSections[i];
      if (!item || typeof item !== 'object') continue;
      const name = String(item.name ?? '').trim().slice(0, 30);
      if (!name) continue;
      const nameKey = name.toLowerCase();
      if (seenCustomNames.has(nameKey)) continue;
      seenCustomNames.add(nameKey);
      let id = String(item.id || '').trim() || generateId(`csec_${i}`);
      while (seenCustomIds.has(id)) {
        id = generateId('csec');
      }
      seenCustomIds.add(id);
      const guidance = String(item.guidance ?? '').trim().slice(0, 200);
      customSections.push({ id, name, guidance });
    }
  }

  return {
    layoutStyle,
    presetId,
    enabledIds,
    customSections,
  };
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
      hostApiConfirmed: rawUi.hostApiConfirmed === true,
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
      worldbookLightMode: VALID_WORLDBOOK_LIGHT_MODES.has(rawUi.worldbookLightMode)
        ? rawUi.worldbookLightMode
        : 'green_selective',
      companionCarryMode: VALID_COMPANION_CARRY_MODES.has(rawUi.companionCarryMode)
        ? rawUi.companionCarryMode
        : 'persona_book',
      companionTargetBook: typeof rawUi.companionTargetBook === 'string' ? rawUi.companionTargetBook.trim() : '',
      pureCrossCardReuse: Boolean(rawUi.pureCrossCardReuse),
      visibilityTags: Boolean(rawUi.visibilityTags),
      draftAudit: rawUi.draftAudit !== false,
      debugAudit: rawUi.debugAudit === true,
      hideDraftAudit: rawUi.hideDraftAudit !== false,
      antiParrot: rawUi.antiParrot !== false,
      worldbookPosition: clampInt(rawUi.worldbookPosition, 0, 7, DEFAULT_USER_WORLDBOOK_PLACEMENT.position),
      worldbookDepth: clampInt(rawUi.worldbookDepth, 0, 99, DEFAULT_USER_WORLDBOOK_PLACEMENT.depth),
      worldbookOrder: clampInt(rawUi.worldbookOrder, 0, 10000, DEFAULT_USER_WORLDBOOK_PLACEMENT.order),
      worldbookRole: clampInt(rawUi.worldbookRole, 0, 2, DEFAULT_USER_WORLDBOOK_PLACEMENT.role),
      moduleRatios: normalizeModuleRatios(rawUi.moduleRatios),
      generationSections: normalizeGenerationSectionsConfig(rawUi.generationSections),
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
  if (cloned.ui) delete cloned.ui.hostApiConfirmed;

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
  if (kind === 'banned') {
    if (!rawNote || GENERIC_TASTE_NOTES.has(rawNote)) {
      return `- 「${text}」（请同时规避该词句背后同类的句式结构、解释性旁白或修饰习惯，而非仅避开字面原句）`;
    }
    return `- 「${text}」（问题症结：${rawNote}，请识别其背后的句式通病或表达问题，连同类句式与写法一并规避，而非仅避开单个原句）`;
  }
  if (!rawNote || GENERIC_TASTE_NOTES.has(rawNote)) {
    return `- ${text}`;
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

function getCompanionNpcFlags(ctx = null) {
  const c = ctx && typeof ctx === 'object' ? ctx : {};
  const hasCompanions = Array.isArray(c.companions) && c.companions.some((x) => x && typeof x === 'object');
  const enabledIds = Array.isArray(c.generationSections?.enabledIds)
    ? c.generationSections.enabledIds
    : [];
  const hasNpcNetwork = enabledIds.some((id) => NPC_NETWORK_SECTION_IDS.has(id));
  return { hasCompanions, hasNpcNetwork, hasAny: hasCompanions || hasNpcNetwork };
}

function normalizeWorldbookPlacement(raw = {}) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    position: clampInt(src.position ?? src.worldbookPosition, 0, 7, DEFAULT_USER_WORLDBOOK_PLACEMENT.position),
    depth: clampInt(src.depth ?? src.worldbookDepth, 0, 99, DEFAULT_USER_WORLDBOOK_PLACEMENT.depth),
    role: clampInt(src.role ?? src.worldbookRole, 0, 2, DEFAULT_USER_WORLDBOOK_PLACEMENT.role),
    order: clampInt(src.order ?? src.worldbookOrder, 0, 10000, DEFAULT_USER_WORLDBOOK_PLACEMENT.order),
  };
}

function ensureUserWorldbookAttribution(content, ownershipLine = '【以下为 {{user}} 的个人补充设定（非 {{char}} 设定）】') {
  const body = String(content ?? '').trim();
  if (!body) return '';
  const firstLine = body.split('\n')[0] || '';
  if (/\{\{user\}\}/.test(firstLine) && /(?:补充设定|客串角色|非\s*\{\{char\}\})/.test(firstLine)) {
    return body;
  }
  return `${ownershipLine}\n${body}`;
}

function buildSegmentedPacingDirective(scheme = {}, uiContext = null) {
  const budget = computeLengthBudget(scheme?.targetChars || 1500);
  const tokensMin = scheme?.targetTokens?.min ?? budget.tokensMin;
  const tokensMax = scheme?.targetTokens?.max ?? budget.tokensMax;
  const ctx = uiContext && typeof uiContext === 'object' ? uiContext : {};
  const sectionsCfg = normalizeGenerationSectionsConfig(ctx.generationSections || {});
  const backstoryMode = VALID_BACKSTORY_MODES.has(ctx.backstoryMode) ? ctx.backstoryMode : '';
  const enabledSet = new Set(sectionsCfg.enabledIds);
  if (backstoryMode === 'blank_self') {
    enabledSet.delete('backstory_growth');
  }

  const ratios = normalizeModuleRatios(ctx.moduleRatios);
  const useRatioScaling = ratios.mode === 'custom' || ratios.private > 0;
  const rawItems = [];
  for (const group of GENERATION_SECTION_GROUPS) {
    for (const item of group.items) {
      if (enabledSet.has(item.id)) {
        rawItems.push({ id: item.id, label: item.label });
      }
    }
  }
  for (const cs of sectionsCfg.customSections) {
    rawItems.push({ id: cs.id || cs.name, label: cs.name });
  }
  if (rawItems.length === 0) {
    rawItems.push({ id: 'basic_identity', label: '基本身份' });
  }

  const weightedItems = rawItems.map((item) => {
    let w = SECTION_CHAR_WEIGHTS[item.id] || 1.0;
    if (useRatioScaling) {
      if (item.id === 'appearance_outfit' || BODY_TRAIT_SECTION_IDS.has(item.id)) {
        w *= Math.max(0.25, ratios.appearance / 25);
      } else if (item.id === 'personality_logic' || item.id === 'habits_tastes') {
        w *= Math.max(0.25, ratios.personality / 30);
      } else if (item.id === 'backstory_growth') {
        w *= Math.max(0.25, ratios.backstory / 20);
      } else if (
        item.id === 'relation_to_char' ||
        item.id === 'career_finance' ||
        NPC_NETWORK_SECTION_IDS.has(item.id)
      ) {
        w *= Math.max(0.25, ratios.relationship / 25);
      } else if (INTIMATE_SECTION_IDS.has(item.id)) {
        w *= Math.max(0.35, (ratios.private || 15) / 15);
      }
    }
    return { ...item, weight: w };
  });

  const totalWeight = weightedItems.reduce((sum, item) => sum + item.weight, 0) || 1;
  const avgPerSection = Math.round(budget.chars / Math.max(1, weightedItems.length));
  const quotaLines = weightedItems.map((item) => {
    const center = Math.max(30, Math.round(((budget.chars * item.weight) / totalWeight) / 10) * 10);
    const secMin = Math.max(20, Math.round((center * 0.85) / 10) * 10);
    const secMax = Math.max(secMin + 20, Math.round((center * 1.15) / 10) * 10);
    return `- ${item.label}：约 ${secMin}～${secMax} 字`;
  });

  let densityBlock;
  if (budget.chars <= 800 || avgPerSection < 95) {
    densityBlock = [
      '【细节展开密度：精炼短句】',
      `当前字数偏紧凑且共划分 ${weightedItems.length} 个板块，请用高信息密度的精炼短句直写核心特征与事实，删去铺垫套话，严格控制在 ${budget.charsMax} 字以内。`,
    ].join('\n');
  } else if (budget.chars >= 1400 || avgPerSection >= 180) {
    densityBlock = [
      '【细节展开密度：充分扩写】',
      `各启用板块均须充分展开具体的生活细节、言行习惯、行为逻辑与情绪微表现，用扎实的生活质感撑起篇幅，确保成稿有效汉字稳步达到 ${budget.charsMin} 字以上。`,
    ].join('\n');
  } else {
    densityBlock = [
      '【细节展开密度：适中扎实】',
      `各板块写明关键事实并配 1～2 处具体日常表现，不空泛凑字也不流水账堆砌，成稿稳步落在 ${budget.charsMin}～${budget.charsMax} 字区间。`,
    ].join('\n');
  }

  return [
    `【总字数硬约束】全文有效汉字不少于 ${budget.charsMin} 字、不超过 ${budget.charsMax} 字（目标约 ${budget.chars} 字，约 ${tokensMin}～${tokensMax} tokens）${ctx.dualLayer ? '；开启世界书分流时为主档案正文与补充世界书条目之和' : ''}。`,
    densityBlock,
    `【分段参考配额（当前启用 ${weightedItems.length} 个板块，平均约 ${avgPerSection} 字/板块）】\n${quotaLines.join('\n')}`,
  ].join('\n\n');
}

function resolveSlotContent(entry, scheme, tasteProfile = {}, includeTaste = true, uiContext = null) {
  if (entry.slotType === 'worldbook' && scheme.syncedOverrides?.dualLayer) return scheme.syncedOverrides.dualLayer;
  if (entry.slotType === 'draft_audit' && scheme.syncedOverrides?.draftAudit) return scheme.syncedOverrides.draftAudit;
  const sectionsOverridden = Boolean(scheme.syncedOverrides?.generationSections);
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

  const hasUiCtx = Boolean(uiContext && typeof uiContext === 'object');
  const factoryScheme = BUILTIN_PRESET_SCHEMES[scheme?.id] || null;
  const factoryEntry = factoryScheme?.entries?.find((fe) => fe.id === entry.id) || null;
  const isDefaultEntryContent = !factoryEntry || String(entry.content ?? '').trim() === String(factoryEntry.content ?? '').trim();

  if (entry.slotType === 'context' && hasUiCtx && !sectionsOverridden) {
    const backstoryMode = VALID_BACKSTORY_MODES.has(uiContext.backstoryMode) ? uiContext.backstoryMode : '';
    const spotlightMode = VALID_SPOTLIGHT_MODES.has(uiContext.spotlightMode) ? uiContext.spotlightMode : '';
    const { hasCompanions, hasNpcNetwork } = getCompanionNpcFlags(uiContext);
    const relationTarget =
      hasCompanions && hasNpcNetwork
        ? '角色、在场亲友与客串角色'
        : hasCompanions
          ? '角色与客串角色'
          : hasNpcNetwork
            ? '角色与在场亲友'
            : '角色';
    const contextAddons = [];
    if (uiContext.pureCrossCardReuse === true) {
      contextAddons.push(
        `【纯通用跨卡复用】保持${CORE_SECTION_HEADER}独立通用，剥离特定角色或旧卡专属绑定，仅在${SHELL_SECTION_HEADER}衔接当前角色关系。`
      );
    } else if (backstoryMode !== 'blank_self') {
      contextAddons.push(
        `【人物经历与故事融合】人物的成长环境、经历轨迹与习惯成因顺着当前世界观、社会土壤及与${relationTarget}的交集脉络自然生长，长出有来处的真实血肉。`
      );
    }
    if (backstoryMode) {
      const bsText = buildBackstoryDirective(backstoryMode);
      if (bsText) contextAddons.push(bsText);
    }
    if (spotlightMode) {
      const spText = buildSpotlightDirective(spotlightMode);
      if (spText) contextAddons.push(spText);
    }
    if (contextAddons.length > 0) {
      content += `\n\n${contextAddons.join('\n')}`;
    }
  } else if (entry.slotType === 'taste') {
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
  } else if (entry.slotType === 'pacing' && !uiContext?.targetSection) {
    if (hasUiCtx && uiContext.backstoryMode === 'blank_self') {
      content = content
        .replace(/与成长脉络/g, '与当下生活状态')
        .replace(/及成长经历/g, '与当下生活状态')
        .replace(/与过往事实/g, '与当下客观事实');
    }
    if (!sectionsOverridden && (hasUiCtx || isDefaultEntryContent)) {
      const segmentedPacing = buildSegmentedPacingDirective(scheme, uiContext);
      if (segmentedPacing) {
        content += `\n\n${segmentedPacing}`;
      }
    }
    if (!sectionsOverridden && hasUiCtx && uiContext.moduleRatios) {
      const ratios = normalizeModuleRatios(uiContext.moduleRatios);
      if (ratios.mode === 'custom' || ratios.private > 0) {
        const ratioParts = [
          `外貌气质约 ${ratios.appearance}%`,
          `性格习惯约 ${ratios.personality}%`,
          `过往经历约 ${ratios.backstory}%`,
          `当前背景与关系约 ${ratios.relationship}%`,
        ];
        if (ratios.private > 0) {
          ratioParts.push(`私密心事或暗线约 ${ratios.private}%`);
        }
        content += `\n\n【人设构成占比指导】\n请按以下篇幅比重分配各维度细节（优先满足玩家明确指定的要求）：${ratioParts.join('，')}。`;
      }
    }
  } else if (entry.slotType === 'format' && !sectionsOverridden && hasUiCtx && uiContext.generationSections) {
    const backstoryMode = VALID_BACKSTORY_MODES.has(uiContext.backstoryMode) ? uiContext.backstoryMode : 'light_vibe';
    const secDirective = buildGenerationSectionDirective(uiContext.generationSections, {
      backstoryMode,
      companions: Array.isArray(uiContext.companions) ? uiContext.companions : [],
    });
    if (secDirective) {
      content += `\n\n${secDirective}`;
    }
  } else if (entry.slotType === 'worldbook' && hasUiCtx && isDefaultEntryContent) {
    content = buildDualLayerDirective(scheme, uiContext.worldbookLightMode);
  } else if (entry.slotType === 'draft_audit' && hasUiCtx && isDefaultEntryContent) {
    content = buildDraftAuditInstruction(scheme, {
      backstoryMode: VALID_BACKSTORY_MODES.has(uiContext.backstoryMode) ? uiContext.backstoryMode : 'light_vibe',
      spotlightMode: VALID_SPOTLIGHT_MODES.has(uiContext.spotlightMode) ? uiContext.spotlightMode : 'balanced',
    });
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
    '2. 戏份与伏笔分寸：职业、特殊属性与小喜好收放自然无机械重复隐患（喜好外显度符合人物性格，不强设旁人必全知或必猜错），暗线具备自然日常表象，具体举例不写成必演剧本；',
    `3. 语言净稿：符合${isObjective ? '不抢话零代演' : '自然代演留白'}边界，清零赋魅套话、系统口号与破折号。`,
    `闭合 \`${DRAFT_END_MARKER}\` 后换一行直接从 \`${CORE_SECTION_HEADER}\` 输出干净正文。`,
  ].join('\n');
}

export function classifyWorldbookEntry(entry) {
  if (!entry || typeof entry !== 'object') return 'character_lore';
  const comment = String(entry.comment ?? entry.name ?? '').trim();
  const keysList = Array.isArray(entry.keys)
    ? entry.keys
    : Array.isArray(entry.key)
      ? entry.key
      : [];
  const keysText = keysList.map((k) => String(k ?? '').trim()).filter(Boolean).join(' ');
  const content = String(entry.content ?? '').trim();
  const headerProbe = `${comment}\n${keysText}`;
  const head = content.slice(0, 280);

  // 0. Pure section dividers, empty separator banners, or author-only notices ("请勿开启") -> system_format
  if (
    (!content && /^[=\-─━✦✧☯۰•↓↑\s]/.test(comment)) ||
    /^(?:=+[^=]+=+|─+[^─]+─+|☯۰•.*•۰☯)$/u.test(comment) ||
    /(?:玩前须知|请勿开启)/u.test(comment) ||
    /^\{\{\/\//.test(head)
  ) {
    return 'system_format';
  }

  // 1. Acting / portrayal rules ('acting_rules') — check BEFORE system_format so character anti-OOC rules are NEVER discarded
  if (
    /(?:人设修正|人物修正|人设规范|令行禁止|防\s*OOC|防霸总|防油腻|防超雄|防发情|端水化|边缘化|扮演原则|扮演准则|演绎守则|演绎修正|剧情守则|故事守则|言行边界|行为准则|行为规范|人物禁令|说话规范|说话习惯修正|时空一致性|现实逻辑|信息边界|人物与关系一致性|关系背景通用规则|情感变化规则|情感数值|塑造补丁|correct_spec|roleplay_rule|^(?:修正|守则)$|(?:^|[【\[·\s_-])修正(?:$|[】\]·\s_-]))/iu.test(
      headerProbe
    ) ||
    /^(?:【(?:人设修正|令行禁止|剧情守则|故事守则|扮演原则|防OOC|人设规范)】|<\s*(?:扮演原则|roleplay_rule|时空一致性|现实逻辑与信息边界|人物与关系一致性|关系背景通用规则|补丁[：:]))/iu.test(
      head
    )
  ) {
    return 'acting_rules';
  }

  // 2. Pure technical/system/format entries ('system_format')
  if (
    /(?:状态栏|标题栏|任务面板|statusbar|status_bar|status_rule|思维链|\bcot\b|writingspec|writing_spec|写作格式规范|排版规范|字数要求|regex|正则|initvar|mvu|变量初始化|变量更新|变量表|变量脚本|format_spec|输出格式控制|弹幕美化|短信输出规则)/iu.test(
      headerProbe
    ) ||
    /^(?:<\s*(?:status(?:bar|_rule)?|顶部状态栏|底部状态栏|顶部标题规则|续命面板|xjw_status|jzd_status_instruction|cot|thinking|writingspec|initvar|format_spec)\b|\/\/\s*initvar|\[InitVar\]|【(?:状态栏|思维链|变量初始化|变量脚本|输出格式)】)/iu.test(
      head
    )
  ) {
    return 'system_format';
  }

  return 'character_lore';
}

export function isNoiseWorldbookEntry(entry) {
  return classifyWorldbookEntry(entry) === 'system_format';
}

export function isWorldbookEntryDisabled(entry) {
  if (!entry || typeof entry !== 'object') return false;
  if (entry.disabled === true || entry.disable === true) return true;
  if (entry.defaultEnabled === false || entry.enabled === false) return true;
  return false;
}

function stripCardTitleDecorations(rawTitle) {
  let s = String(rawTitle ?? '').trim();
  if (!s) return '';
  s = s.replace(/^[【\[（(][^】\]）)]{1,16}[】\]）)]\s*/g, '');
  s = s.replace(/^[^\p{L}\p{N}《〈「『]+/gu, '');
  const wrapped = s.match(/^[《〈「『](.+?)[》〉」』]$/);
  if (wrapped) {
    s = wrapped[1].trim();
  }
  s = s.replace(/\s*(?:v\d+(?:\.\d+)*|ver\.?\s*\d+(?:\.\d+)*|（[^）]{0,12}版）|\([^)]{0,12}ver[^)]*\))$/iu, '');
  return s.trim();
}

function isTitleLikeCardName(rawName) {
  const s = String(rawName ?? '').trim();
  if (!s) return true;
  if (/[《》【】\[\]｜|]/.test(s)) return true;
  if (/^[^\p{L}\p{N}]/u.test(s)) return true;
  if (/(?:\s-\s|\s—\s|之|往事|物语|手札|四季|指南|档案卡|世界观)/.test(s)) return true;
  const cjkCount = (s.match(/[\u4e00-\u9fff]/g) || []).length;
  return cjkCount > 5;
}

function cleanExtractedPersonName(rawVal) {
  let s = String(rawVal ?? '').trim();
  if (!s) return '';
  s = s.replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim();
  s = s.replace(/\s*#.*$/, '').trim();
  s = s.split(/[（(｜|/／,，☯✦✧]/)[0].trim();
  s = s.replace(/\s*[-－—–·]\s*(?:丈夫|妻子|夫君|夫人|女儿|儿子|母亲|父亲|哥哥|姐姐|弟弟|妹妹|兄长|伴侣|配偶)(?=[\s\p{Extended_Pictographic}\uFE0F]*$)/u, '');
  s = s.replace(/[\s\p{Extended_Pictographic}\uFE0F]+$/u, '');
  s = s.replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim();
  if (!s || s.length > 24) return '';
  if (/^(?:\{\{char\}\}|\{\{user\}\}|<char>|<user>|unknown|none|null|undefined|未命名|待定|未知|不详|保密|无)$/i.test(s)) {
    return '';
  }
  if (
    /^(?:基本信息|基础信息|基本资料|人物设定|角色设定|角色档案|外貌|性格|背景|当前状态|简介|情感观|爱情观|价值观|世界观|时代背景|家庭背景|高中及以前|高中毕业后|志愿填报|职业生涯|一些经历|地点|次要角色|人物关系|其他角色|NPC|npc|IF线|时期|身份|阶段|主线|支线|iMessage|微博|小手机)$/iu.test(
      s
    )
  ) {
    return '';
  }
  return s;
}

const GENERIC_YAML_TOP_KEYS = new Set([
  'info',
  'character',
  'char',
  'profile',
  'data',
  'basic_info',
  'basicinfo',
  'appearance',
  'personality',
  'background',
  'relationships',
  'relationship',
  'habits',
  'skills',
  'speech_style',
  'current_state',
  '基本信息',
  '基础信息',
  '基本资料',
  '基本身份',
  '人物档案',
  '角色档案',
  '外貌',
  '性格',
  '背景',
  '设定',
  '关系',
  '习惯',
  '技能',
  '能力',
  '状态',
  '剧情守则',
  '状态栏',
]);

function extractExplicitTrueName(text) {
  const match = String(text ?? '').match(/(?:^|\n|[（(])[ \t]*(?:[-*•][ \t]*)?(?:真名|本名|原名|真实姓名)\s*[:：][ \t]*([^\n#<>）)]{1,40})/u);
  return cleanExtractedPersonName(match?.[1]);
}

function extractRealNameFromText(text, rawCardName) {
  const src = String(text ?? '').replace(/\r\n?/g, '\n');
  if (!src.trim()) return '';
  const explicitTrueName = extractExplicitTrueName(src);
  if (explicitTrueName) return explicitTrueName;

  // 1. XML / tag attributes: <character_information character="..."> or <character name="...">
  const tagAttrRe = /<\s*(?:character_information|character)\b[^>]*\b(?:character|name)\s*=\s*["']([^"'\n<>]{1,32})["']/i;
  const tagMatch = src.match(tagAttrRe);
  if (tagMatch) {
    const cleaned = cleanExtractedPersonName(tagMatch[1]);
    if (cleaned) return cleaned;
  }

  // 2. Explicit person-name KV fields
  const explicitKvRe =
    /(?:^|\n)[ \t]*(?:[-*•]\s*)?(?:姓名|名字|本名|真名|角色名|人物名|Chinese[ _]?name|full[ _]?name)\s*[:：]\s*([^\n#<>]{1,40})/iu;
  const explicitMatch = src.match(explicitKvRe);
  if (explicitMatch) {
    const cleaned = cleanExtractedPersonName(explicitMatch[1]);
    if (cleaned) return cleaned;
  }

  // 3. Generic `name:` field (accept when distinct from title-like card.name or looks like a person name)
  const genericNameRe = /(?:^|\n)[ \t]*(?:[-*•]\s*)?name\s*[:：]\s*([^\n#<>]{1,40})/iu;
  const genericMatch = src.match(genericNameRe);
  if (genericMatch) {
    const cleaned = cleanExtractedPersonName(genericMatch[1]);
    if (cleaned && (cleaned !== rawCardName || !isTitleLikeCardName(cleaned))) {
      return cleaned;
    }
  }

  // 4. Top-level YAML person object key (e.g. ```yaml\n<info>\n<character>\n周恪:\n  年龄: 26)
  const strippedLines = src
    .split('\n')
    .filter((l) => {
      const t = l.trim();
      return !/^```/.test(t) && !/^<\/?(?:info|character|character_information|profile)\b[^>]*>$/i.test(t);
    });
  for (let i = 0; i < strippedLines.length; i += 1) {
    const line = strippedLines[i];
    const topKeyMatch = line.match(/^[ \t]{0,4}([^\s:#【\[<>{}"'()（）]{2,12})\s*[:：]\s*(?:#.*)?$/);
    if (!topKeyMatch) continue;
    const candidateKey = topKeyMatch[1].trim();
    if (GENERIC_YAML_TOP_KEYS.has(candidateKey.toLowerCase()) || GENERIC_YAML_TOP_KEYS.has(candidateKey)) {
      continue;
    }
    const baseIndent = measureLineIndent(line);
    const nextLine = strippedLines.slice(i + 1).find((l) => l.trim() !== '');
    if (
      nextLine &&
      measureLineIndent(nextLine) > baseIndent &&
      /(?:年龄|性别|身高|外貌|性格|身份|简介|职业|age|gender|height|appearance|personality|basic_info|aliases)/iu.test(
        nextLine
      )
    ) {
      const cleaned = cleanExtractedPersonName(candidateKey);
      if (cleaned) return cleaned;
    }
  }

  return '';
}

export function resolveCharacterRealName({
  name = '',
  cardName = '',
  description = '',
  firstMes = '',
  firstMessage = '',
  worldEntries = [],
} = {}) {
  const rawCardName = String(name || cardName || '').trim();
  const strippedCardTitle = stripCardTitleDecorations(rawCardName);

  const nameFromCard = cleanExtractedPersonName(rawCardName);
  if (!isTitleLikeCardName(rawCardName) && nameFromCard) {
    return { realName: nameFromCard, source: 'card_name', strippedCardTitle };
  }

  const fromDesc = extractRealNameFromText(description, rawCardName);
  if (fromDesc) {
    return { realName: fromDesc, source: 'description', strippedCardTitle };
  }

  const fromFirst = extractRealNameFromText(firstMes || firstMessage, rawCardName);
  if (fromFirst) {
    return { realName: fromFirst, source: 'firstMes', strippedCardTitle };
  }

  const worldNames = new Set();
  for (const entry of Array.isArray(worldEntries) ? worldEntries : []) {
    if (!entry || isWorldbookEntryDisabled(entry) || classifyWorldbookEntry(entry) !== 'character_lore') continue;
    const label = String(entry.comment ?? entry.name ?? '').trim();
    // Named supporting entries and route variants cannot establish the card's main identity.
    if (!/^(?:(?:主角|主控|核心角色|当前角色)(?:\s*[：:·-]\s*.+|(?:人物|角色)?(?:档案|简介|设定|资料))?|(?:角色|人物|自我)(?:档案|简介|设定)|基本(?:资料|信息)|character[ _]profile)$/iu.test(label)) continue;
    const candidate = extractRealNameFromText(entry.content, rawCardName);
    if (candidate) worldNames.add(candidate);
  }
  if (worldNames.size === 1) {
    return { realName: [...worldNames][0], source: 'worldbook', strippedCardTitle };
  }

  if (strippedCardTitle && strippedCardTitle !== rawCardName) {
    return { realName: strippedCardTitle, source: 'stripped_title', strippedCardTitle };
  }

  return {
    realName: rawCardName,
    source: 'card_name',
    strippedCardTitle,
  };
}

export function resolveCharacterReferenceName(context = {}) {
  if (typeof context.realName === 'string') return context.realName.trim();
  const resolved = resolveCharacterRealName({
    ...context,
    firstMes: '',
    firstMessage: '',
    worldEntries: context.worldEntries ?? context.selectedWorldEntries,
  });
  if (resolved.source === 'stripped_title') return '';
  if (resolved.source === 'card_name' && isTitleLikeCardName(resolved.realName)) return '';
  return resolved.realName;
}

export function buildGreetingOptions({ firstMessage = '', alternateGreetings = [] } = {}) {
  const first = typeof firstMessage === 'string' ? firstMessage : '';
  const alternatives = Array.isArray(alternateGreetings) ? alternateGreetings : [];
  const directoryLines = first.split(/\r?\n/);
  const heading = directoryLines.findIndex((line) =>
    /^\s*(?:#{1,6}\s*|【)?(?:开场白|开场)(?:目录|索引|列表|一览)?[】：:]?\s*$/u.test(line)
  );
  const directory = new Map();
  let current;
  for (let i = heading + 1; heading >= 0 && i < directoryLines.length; i += 1) {
    const line = directoryLines[i].trim();
    const item = line.match(/^(?:#{1,6}\s*|[-*]\s+)?(?:开场白\s*)?#?(\d{1,3})[.．、：:)）\s]+\s*(.+)$/u);
    if (item) {
      current = { title: item[2].trim(), summary: '' };
      directory.set(Number(item[1]), current);
    } else if (/^#{1,6}\s+/u.test(line)) {
      break;
    } else if (current && !current.summary && line) {
      current.summary = line.replace(/^(?:简介|概要|摘要)[：:]\s*/u, '').replace(/^\*+|\*+$/g, '').trim();
    }
  }

  const firstIsDirectory = heading >= 0 && (
    directory.size > 1 ||
    /(?:目录|索引|列表|一览)/u.test(directoryLines[heading]) ||
    (directory.size === 1 && /(?:食用说明|使用说明|游玩指南|版权声明)/u.test(first))
  );
  const options = [];
  for (const [index, raw] of [first, ...alternatives].entries()) {
    if (typeof raw !== 'string' || (index === 0 && firstIsDirectory)) continue;
    const comments = {};
    const text = raw.replace(/<!--[\s\S]*?-->/g, (comment) => {
      const field = comment.match(/^<!---?\s*(title|desc)\s*[:：]\s*([\s\S]*?)\s*-?-->$/iu);
      if (field && !comments[field[1].toLowerCase()]) comments[field[1].toLowerCase()] = field[2].trim();
      return '';
    }).replace(/<(script|style|iframe)\b[^>]*>[\s\S]*?<\/\1\s*>/giu, '').trim();
    if (!text) continue;
    const listing = firstIsDirectory ? directory.get(index) : null;
    options.push({
      index,
      title: (comments.title || listing?.title || '').slice(0, 100),
      summary: (comments.desc || listing?.summary || '').slice(0, 250),
      text,
    });
  }
  return options;
}

const NON_CHARACTER_LORE_TITLE_RE =
  /(?:世界观|背景总纲|背景设定|故事背景|时代背景|世界背景|历史沿革|地理|地图|地点|风物|江湖|势力|宗门|剑宗|朝堂|制度|规则|时间线|年表|术语|词条说明|使用说明|玩前须知|开场前情|总览|简介|user设定|用户设定|user\s*信息|用户\s*信息|参考\s*[:：]?\s*user|玩家身份|开篇导语|关系总览|人物关系|次要角色|相关NPC|众生志|^(?:NPC|npc)$|情感观|爱情观|价值观|线上人设|iMessage|小手机|微博|论坛|表情包|黑料|一些经历|职业生涯|志愿填报|高中及以前|高中毕业|家庭背景|多选一|三选一|日常向|恋爱向|色色向|彩蛋走向|剧情走向|\bABO\b|第二性征|\bUser是|系统线|副本|凝u|doi|把尿|边缘性行为|\bNSFW\b)/iu;

const NON_PERSON_CANDIDATE_NAME_RE =
  /^(?:\d+|(?:.*[\s·_-])?(?:角色|人物|配角|npc)\s*\d+|(?:.*(?:的|生成|全部|所有|其他|主要|次要|世界))?(?:npc|npcs|npc们|路人|路人们|配角|龙套|群演|群众)|参考.*|.*user.*信息|.*IF\s*线.*|IF分支.*|分支|时期|身份|阶段|主线|支线|补丁|选开|情感观|家庭背景|时代背景|世界观|皇室|皇家.*|后宫.*|.*嫔位|朝堂|朝廷|宗门|门派|家族|家庭|家人|父母|爸妈|老.{1,4}家|.{1,6}家族|.{1,6}世家|前男友|前女友|前任|现男友|现女友|男友|女友|丈夫|妻子|老公|老婆|恩爱夫妻|夫妻|情侣|忠犬|病娇|白月光|替身|(?:府内|宫中|门下)?(?:下属|小厮|仆役)|.*(?:的小厮|的下属|的侍卫|的丫鬟|们)|高中.*|大学.*|初中.*|小学.*|童年.*|毕业.*|志愿.*|iMessage|微博|小手机|表情包|状态栏|续命.*|.*(?:面板|规则|规范|一致性|边界|定位|补丁|走向|系统|副本|故事|大纲|经历|修养|设定|背景|简介|详情|指南|攻略|流程|模式|事件|之旅|日记|日程))$/iu;

const PLACE_OR_ORG_NAME_RE =
  /(?:.{1,10}(?:市|省|县|区|镇|村|路|街|巷)|.{1,10}(?:一中|二中|三中|中学|实验小学|小学|大学|学院|校区|分校|书院)(?:分校|校区|校门|门口|大门|教学楼|宿舍|食堂|操场|图书馆)?|.{1,10}(?:分校|校门|校区)|.{1,10}(?:华庭|壹号|一号|澜庭|花园|公馆|公寓|别墅|大厦|山庄|梅庄|集团|公司|医院|基地|俱乐部|工作室|实验室|事务所|研究院|研究所)|.{0,10}(?:皇宫|行宫|东宫|后宫|冷宫|宫殿)|.{2,}(?:府|司|殿|阁|院))$/u;

function countStructuredBioSignals(content) {
  const src = String(content ?? '').replace(/\r\n?/g, '\n').slice(0, 1200);
  const patterns = [
    /(?:^|\n)[ \t]*(?:(?:[-*+•]|\d+[.、)])\s*)?(?:姓名|名字|名称|本名|真名|char_name|Chinese[ _]?name|name)\s*[:：]/iu,
    /(?:^|\n)[ \t]*(?:(?:[-*+•]|\d+[.、)])\s*)?(?:年龄|岁数|出生日期|生日|age|birthday)\s*[:：]/iu,
    /(?:^|\n)[ \t]*(?:(?:[-*+•]|\d+[.、)])\s*)?(?:性别|第二性征|信素|gender|sex)\s*[:：]/iu,
    /(?:^|\n)[ \t]*(?:(?:[-*+•]|\d+[.、)])\s*)?(?:身高|体型|外貌|长相|appearance|height)\s*[:：]/iu,
    /(?:^|\n)[ \t]*(?:(?:[-*+•]|\d+[.、)])\s*)?(?:性格|性情|外貌与性格|personality)\s*[:：]/iu,
    /(?:^|\n)[ \t]*(?:(?:[-*+•]|\d+[.、)])\s*)?(?:身份|身份定位|当前身份|职业|头衔|定位|role)\s*[:：]/iu,
  ];
  let hits = 0;
  for (const re of patterns) {
    if (re.test(src)) hits += 1;
  }
  return hits;
}

function extractRoleTagFromContent(content) {
  const src = String(content ?? '').replace(/\r\n?/g, '\n');
  const kvMatch = src.match(
    /(?:^|\n)[ \t]*(?:(?:[-*+•]|\d+[.、)])\s*)?(?:身份定位|当前身份|身份|定位|职业|头衔|关系|角色定位)\s*[:：]\s*([^\n#<>]{2,28})/iu
  );
  if (kvMatch) {
    return kvMatch[1].replace(/^["'“”]+|["'“”]+$/g, '').split(/[。！？]/)[0].trim().slice(0, 24);
  }
  const firstLine = src
    .split('\n')
    .map((l) => l.trim().replace(/^\s*(?:[-*+•]|\d+[.、)])\s*/, '').trim())
    .find(
      (l) =>
        l &&
        !/^[【#`<>\[\]{}\-=]/.test(l) &&
        !/^[^:：\n]{1,28}[:：]\s*$/.test(l) &&
        !/^(?:姓名|名字|名称|本名|真名|外号|别名|昵称|年龄|岁数|出生日期|生日|星座|血型|mbti|性别|第二性征|信素|身高|体重|出生地|出生地与成长地|成长地|籍贯|地域背景|游戏\s*ID|id|char_name|character(?:_name)?|Chinese[ _]?name|English[ _]?name|full[ _]?name|nickname|alias(?:es)?|name|age|gender|sex|height|weight|birthday|zodiac)\s*[:：]/i.test(
          l
        )
    );
  if (!firstLine) return '';
  const clean = firstLine.split(/[。！？；]/)[0].trim();
  return clean.length > 24 ? `${clean.slice(0, 23)}…` : clean;
}

function getWorldbookEntryIdentityKey(entry, idx = 0) {
  return String(entry?.entryKey ?? entry?.uid ?? entry?.comment ?? `wb_${idx}`).trim();
}

function looksLikeSingleCharacterEntry(entry, mainProtagonistName = '') {
  if (!entry || typeof entry !== 'object') return false;
  if (classifyWorldbookEntry(entry) !== 'character_lore') return false;
  const comment = String(entry.comment ?? entry.name ?? '').trim();
  const content = String(entry.content ?? '').trim();
  if (!content) return false;
  if (NON_CHARACTER_LORE_TITLE_RE.test(comment)) return false;
  if (/^(?:IF\s*线?|时期|身份|阶段|主线|支线|补丁)\s*[｜|:：·-]/iu.test(comment)) return false;

  // Reject XML blocks that clearly describe routes, stages, locations, collectives, or user settings
  const rootTagMatch = content.match(/^<\s*([^>\s/]{1,36})/);
  if (rootTagMatch) {
    const rootTag = rootTagMatch[1];
    if (
      /^(?:IF线|时期|身份|location|world|scenario|attitude|npc|npcs|其他角色|角色列表|关系|状态栏|续命|规则|补丁|剧情走向|第二性征|character_user|\{\{user\}\}|user)/iu.test(
        rootTag
      )
    ) {
      return false;
    }
    if (mainProtagonistName && rootTag.startsWith(`${mainProtagonistName}_`)) {
      return false;
    }
  }
  if (mainProtagonistName && comment.includes(mainProtagonistName) && comment !== mainProtagonistName) {
    return false;
  }

  // 1. Explicit character profile markers in comment or XML root tag
  const explicitHeaderMatch = comment.match(
    /^(?:主要角色|角色档案|人物档案|角色|人物|攻略对象|可攻略(?:角色|npc)?)[：:·\s-]+(.+)$/iu
  );
  if (explicitHeaderMatch) {
    const explicitCandidate = cleanExtractedPersonName(
      stripCardTitleDecorations(explicitHeaderMatch[1]).split(/[（(｜|/／·-]/)[0]
    );
    if (
      explicitCandidate &&
      !NON_PERSON_CANDIDATE_NAME_RE.test(explicitCandidate) &&
      !PLACE_OR_ORG_NAME_RE.test(explicitCandidate) &&
      !(mainProtagonistName && explicitCandidate === mainProtagonistName)
    ) {
      return true;
    }
    return false;
  }

  const strippedComment = stripCardTitleDecorations(comment);
  const strippedWithoutParen = strippedComment.split(/[（(｜|/／]/)[0].trim();
  const candidateHead = cleanExtractedPersonName(strippedComment.split(/[（(｜|/／·-]/)[0]);
  if (
    (strippedWithoutParen &&
      (NON_PERSON_CANDIDATE_NAME_RE.test(strippedWithoutParen) ||
        PLACE_OR_ORG_NAME_RE.test(strippedWithoutParen))) ||
    (candidateHead &&
      (NON_PERSON_CANDIDATE_NAME_RE.test(candidateHead) ||
        PLACE_OR_ORG_NAME_RE.test(candidateHead) ||
        (mainProtagonistName && candidateHead === mainProtagonistName)))
  ) {
    return false;
  }

  const xmlCharMatch = content.match(
    /^<\s*(?:主要角色|人物|角色|character_information|character)(?=\s|[：:_=>/])([^>]*)>/iu
  );
  if (xmlCharMatch) {
    const tagHeader = xmlCharMatch[0];
    const tagAttrs = xmlCharMatch[1] || '';
    const attrNameMatch = tagAttrs.match(/\b(?:name|character)\s*=\s*["']([^"'\n<>]{1,40})["']/iu);
    if (attrNameMatch) {
      const cleanedAttr = cleanExtractedPersonName(attrNameMatch[1]);
      if (
        !cleanedAttr ||
        NON_PERSON_CANDIDATE_NAME_RE.test(cleanedAttr) ||
        PLACE_OR_ORG_NAME_RE.test(cleanedAttr) ||
        (mainProtagonistName && cleanedAttr === mainProtagonistName)
      ) {
        return false;
      }
    }
    if (/^<\s*(?:主要角色|人物|角色)\s*[：:_]/iu.test(tagHeader)) {
      const suffixMatch = tagAttrs.match(/^\s*[：:_]\s*([^\s>/"']+)/u);
      if (suffixMatch) {
        const cleanedSuffix = cleanExtractedPersonName(suffixMatch[1]);
        if (
          !cleanedSuffix ||
          NON_PERSON_CANDIDATE_NAME_RE.test(cleanedSuffix) ||
          PLACE_OR_ORG_NAME_RE.test(cleanedSuffix) ||
          (mainProtagonistName && cleanedSuffix === mainProtagonistName)
        ) {
          return false;
        }
      }
    }
    return true;
  }
  if (/【[^】]{1,16}】.*(?:可攻略|角色档案)/iu.test(comment)) {
    return true;
  }

  // 2. Clean candidate title & require genuine structured bio fields (>= 2 bio keys)
  if (!candidateHead) return false;

  const bioSignalCount = countStructuredBioSignals(content);
  if (bioSignalCount >= 2 && /^[\u4e00-\u9fff·A-Za-z0-9]{1,12}$/.test(candidateHead)) {
    return true;
  }
  return false;
}

export function detectMultiCharacterCard(cardContext = {}, worldEntries = []) {
  const ctx = cardContext && typeof cardContext === 'object' ? cardContext : {};
  const entries = Array.isArray(worldEntries) && worldEntries.length > 0
    ? worldEntries
    : Array.isArray(ctx.worldEntries)
      ? ctx.worldEntries
      : Array.isArray(ctx.selectedWorldEntries)
        ? ctx.selectedWorldEntries
        : [];

  const rawCardName = String(ctx.name ?? ctx.cardName ?? '').trim();
  const cardIsTitleLike = isTitleLikeCardName(rawCardName);
  const mainProtagonistName = !cardIsTitleLike ? cleanExtractedPersonName(rawCardName) : '';

  let sawNpcSectionDivider = false;
  const byName = new Map();

  entries.forEach((entry, idx) => {
    const rawComment = String(entry?.comment ?? entry?.name ?? '').trim();
    if (/^=+.*NPC.*=+$/iu.test(rawComment)) {
      sawNpcSectionDivider = true;
      return;
    }
    if (/^=+.*=+$/.test(rawComment)) {
      sawNpcSectionDivider = false;
      return;
    }
    if (!looksLikeSingleCharacterEntry(entry, mainProtagonistName)) return;

    const contentStr = String(entry.content ?? '').trim();
    const isExplicitMainRole =
      /^<\s*主要角色\s*[：:_]/iu.test(contentStr) ||
      /^(?:主要角色|角色档案|攻略对象|可攻略)/iu.test(rawComment);
    const isSupportingNpc =
      !isExplicitMainRole && (sawNpcSectionDivider || /^<\s*人物_/iu.test(contentStr) || /^NPC[：:\s-]/iu.test(rawComment));

    const cleanedTitle = cleanExtractedPersonName(
      stripCardTitleDecorations(
        rawComment.replace(/^(?:主要角色|角色档案|人物档案|角色|人物|NPC|配角|攻略对象|可攻略(?:角色|npc)?)[：:·\s-]+/iu, '')
      )
    );
    const explicitTrueName = extractExplicitTrueName(contentStr) || extractExplicitTrueName(rawComment);
    const candidateFromTitle =
      cleanedTitle && !NON_PERSON_CANDIDATE_NAME_RE.test(cleanedTitle) && !PLACE_OR_ORG_NAME_RE.test(cleanedTitle)
        ? cleanedTitle
        : '';
    const name =
      (explicitTrueName && !NON_PERSON_CANDIDATE_NAME_RE.test(explicitTrueName) && !PLACE_OR_ORG_NAME_RE.test(explicitTrueName) ? explicitTrueName : '') ||
      candidateFromTitle ||
      extractRealNameFromText(contentStr, cleanedTitle) ||
      (Array.isArray(entry.keys) ? cleanExtractedPersonName(entry.keys[0]) : '') ||
      `角色${idx + 1}`;
    if (!name || NON_PERSON_CANDIDATE_NAME_RE.test(name) || PLACE_OR_ORG_NAME_RE.test(name)) return;
    if (mainProtagonistName && name === mainProtagonistName) return;

    const yinYangTag = rawComment.match(/☯([^☯\n]{2,16})☯/)?.[1]?.trim() || '';
    const parenTag = rawComment.match(/[（(]([^）)|｜↑↓]{2,20})[）)]/)?.[1]?.trim() || '';
    const cleanParenTag = /(?:二选一|多选一|选开|默认|IF线)/iu.test(parenTag) ? '' : parenTag;
    const roleTag = yinYangTag || cleanParenTag || extractRoleTagFromContent(contentStr);
    const summaryLine = roleTag ? `${name}（${roleTag}）` : name;
    const key = getWorldbookEntryIdentityKey(entry, idx);
    const disabled = isWorldbookEntryDisabled(entry);
    const sourceOrder = Number.isFinite(Number(entry.order)) ? Number(entry.order) : Number.MAX_SAFE_INTEGER;

    const record = {
      key,
      name,
      roleTag,
      summaryLine,
      disabled,
      isExplicitMainRole,
      isSupportingNpc,
      sourceOrder,
      firstIndex: idx,
    };

    const existing = byName.get(name);
    if (!existing) {
      byName.set(name, record);
    } else if (
      (existing.disabled && !disabled) ||
      (existing.disabled === disabled && !existing.isExplicitMainRole && isExplicitMainRole)
    ) {
      // Replace disabled/secondary variant with enabled primary entry while preserving slot index
      byName.set(name, { ...record, firstIndex: existing.firstIndex });
    }
  });

  const dedupedRecords = Array.from(byName.values());
  dedupedRecords.sort((a, b) => {
    if (a.disabled !== b.disabled) return Number(a.disabled) - Number(b.disabled);
    if (a.isExplicitMainRole !== b.isExplicitMainRole) {
      return Number(b.isExplicitMainRole) - Number(a.isExplicitMainRole);
    }
    if (a.isSupportingNpc !== b.isSupportingNpc) {
      return Number(a.isSupportingNpc) - Number(b.isSupportingNpc);
    }
    if (a.sourceOrder !== b.sourceOrder) return a.sourceOrder - b.sourceOrder;
    if (a.firstIndex !== b.firstIndex) return a.firstIndex - b.firstIndex;
    return a.name.localeCompare(b.name, 'zh-CN');
  });

  const characterEntries = dedupedRecords.map(({ key, name, roleTag, summaryLine, disabled }) => ({
    key,
    name,
    roleTag,
    summaryLine,
    disabled,
  }));

  const mainRoleTagCount = dedupedRecords.filter((r) => r.isExplicitMainRole).length;
  const nonNpcEntryCount = dedupedRecords.filter((r) => !r.isSupportingNpc).length;

  // Single-protagonist cards that merely carry a supporting NPC roster
  // are NOT multi-protagonist ensemble cards unless they explicitly declare >=3 main/playable roles.
  const isEnsembleCard = cardIsTitleLike
    ? mainRoleTagCount >= 3 || nonNpcEntryCount >= 4
    : mainRoleTagCount >= 3 || (nonNpcEntryCount >= 4 && !mainProtagonistName);

  return {
    isMultiChar: isEnsembleCard,
    characterEntries,
  };
}

function getFocusedCharacterName(context, character) {
  const overrides = context.subCharacterNameOverrides;
  const override = overrides && Object.hasOwn(overrides, character.key) ? overrides[character.key] : '';
  return String(override ?? '').trim() || character.name;
}

export function buildEnsembleRosterSummary(characterEntries = [], maxTokens = 450) {
  const list = Array.isArray(characterEntries) ? characterEntries.filter((c) => c && !c.disabled) : [];
  if (list.length === 0) return '';
  const lines = [];
  let usedTokens = 0;
  for (const item of list) {
    const line = `- ${item.summaryLine || item.name}`;
    const t = estimateTokens(line);
    if (lines.length > 0 && usedTokens + t > maxTokens) {
      lines.push(`- 其余共 ${list.length - lines.length} 位登场人物从简略过`);
      break;
    }
    lines.push(line);
    usedTokens += t;
  }
  return lines.join('\n');
}

function formatCharContextBlock(charContext, options = {}) {
  if (!charContext || typeof charContext !== 'object') return '';
  const opts = options && typeof options === 'object' ? options : {};
  const effectiveDescription =
    String(charContext.mergedDescription ?? '').trim() || String(charContext.description ?? '').trim();

  const allEntries = Array.isArray(charContext.selectedWorldEntries)
    ? charContext.selectedWorldEntries
    : Array.isArray(charContext.worldEntries)
      ? charContext.worldEntries
      : null;

  const multiInfo = detectMultiCharacterCard(charContext, charContext.worldEntries ?? allEntries);
  const explicitSubKeys = Array.isArray(opts.selectedSubCharKeys)
    ? opts.selectedSubCharKeys.map((k) => String(k ?? '').trim()).filter(Boolean)
    : [];

  let entriesForContext = allEntries;
  let rosterSummaryText = '';
  let focusedCharacterNames = [];

  if (multiInfo.isMultiChar && Array.isArray(allEntries)) {
    const charKeySet = new Set(multiInfo.characterEntries.map((c) => c.key));
    if (explicitSubKeys.length > 0) {
      // Focused target mode (1–3 sub-characters selected explicitly)
      const focusedSet = new Set(explicitSubKeys.slice(0, 3));
      focusedCharacterNames = multiInfo.characterEntries
        .filter((c) => focusedSet.has(c.key))
        .map((c) => getFocusedCharacterName(charContext, c));
      entriesForContext = allEntries.filter((entry, idx) => {
        const cls = classifyWorldbookEntry(entry);
        if (cls === 'system_format' && entry.forceInclude !== true) return false;
        const k = getWorldbookEntryIdentityKey(entry, idx);
        if (charKeySet.has(k)) return focusedSet.has(k);
        // Keep acting_rules & general non-character worldbuilding
        return cls === 'acting_rules' || (!looksLikeSingleCharacterEntry(entry) && !isWorldbookEntryDisabled(entry));
      });
    } else if (Array.isArray(charContext.selectedWorldEntries)) {
      // Inspect whether user manually checked 1–3 specific character entries inside selectedWorldEntries
      const checkedKeys = new Set(allEntries.map(getWorldbookEntryIdentityKey));
      const checkedCharEntries = multiInfo.characterEntries.filter((c) => !c.disabled && checkedKeys.has(c.key));
      if (checkedCharEntries.length >= 1 && checkedCharEntries.length <= 3 && multiInfo.characterEntries.length >= 4) {
        focusedCharacterNames = checkedCharEntries.map((c) => getFocusedCharacterName(charContext, c));
      } else {
        // Global ensemble mode: card overview + worldbuilding + acting_rules + compact 1-line roster summary
        rosterSummaryText = buildEnsembleRosterSummary(multiInfo.characterEntries, 450);
        entriesForContext = allEntries.filter((entry) => {
          const cls = classifyWorldbookEntry(entry);
          if (cls === 'system_format' && entry.forceInclude !== true) return false;
          if (isWorldbookEntryDisabled(entry) && entry.forceInclude !== true) return false;
          return !looksLikeSingleCharacterEntry(entry);
        });
      }
    } else {
      // Global ensemble mode when no specific sub-chars selected
      rosterSummaryText = buildEnsembleRosterSummary(multiInfo.characterEntries, 450);
      entriesForContext = allEntries.filter((entry) => {
        const cls = classifyWorldbookEntry(entry);
        if (cls === 'system_format' && entry.forceInclude !== true) return false;
        if (isWorldbookEntryDisabled(entry) && entry.forceInclude !== true) return false;
        return !looksLikeSingleCharacterEntry(entry);
      });
    }
  }

  const resolvedRealName =
    focusedCharacterNames.length === 1
      ? focusedCharacterNames[0]
      : resolveCharacterReferenceName({ ...charContext, worldEntries: allEntries });

  const fields = [
    ['角色卡名称', charContext.name],
    ['角色真名', resolvedRealName && resolvedRealName !== charContext.name ? resolvedRealName : ''],
    ['聚焦目标角色', focusedCharacterNames.length > 0 ? focusedCharacterNames.join('、') : ''],
    ['角色简介', effectiveDescription],
    ['性格设定', charContext.personality],
    ['当前场景', charContext.scenario],
    ['开场白参考', charContext.openingReference],
  ];
  const lines = [];
  for (const [label, val] of fields) {
    const text = String(val ?? '').trim();
    if (text) {
      lines.push(`${label}：\n${text}`);
    }
  }

  if (rosterSummaryText) {
    lines.push(`卡内人物名册摘要（群像舞台参考，仅列名称与定位）：\n${rosterSummaryText}`);
  }

  if (Array.isArray(entriesForContext)) {
    const hasExplicitSelection = Array.isArray(charContext.selectedWorldEntries);
    const entryLines = [];
    for (const entry of entriesForContext) {
      if (!entry || typeof entry !== 'object') continue;
      if (isNoiseWorldbookEntry(entry) && entry.forceInclude !== true) continue;
      if (!hasExplicitSelection && isWorldbookEntryDisabled(entry) && entry.forceInclude !== true && explicitSubKeys.length === 0) {
        continue;
      }
      const body = String(entry.content ?? '').trim();
      if (!body) continue;
      const label = String(entry.comment ?? '').trim() || (Array.isArray(entry.keys) ? entry.keys[0] : '') || '设定';
      const keys = Array.isArray(entry.keys) && entry.keys.length > 0 ? `（关键词：${entry.keys.slice(0, 5).join('、')}）` : '';
      entryLines.push(`- ${label}${keys}：${body}`);
    }
    if (entryLines.length > 0) {
      lines.push(`世界观与演绎守则参考：\n${entryLines.join('\n')}`);
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
    '（仅用于对齐时代背景、基调、演绎边界与开场关系；不得抄袭角色卡私有秘密，也不要写系统说教口号）',
    lines.join('\n\n'),
  ].join('\n');
}

export function resolvePresetEntryPreview(entry, scheme, tasteProfile = {}, uiContext = null) {
  return resolveSlotContent(entry, scheme || BUILTIN_PRESET_SCHEMES.longform_coact, tasteProfile, true, uiContext);
}

export function buildDualLayerDirective(scheme, lightMode = 'green_selective') {
  const isObjective = scheme?.style === 'objective';
  const mainRange = isObjective ? '350～550 字' : '650～950 字';
  const safeLight = VALID_WORLDBOOK_LIGHT_MODES.has(lightMode) ? lightMode : 'green_selective';
  const ownershipRule =
    '所有拆分条目均严格归属 {{user}} 个人补充设定（严禁写成 {{char}} 设定），每条内容首行必须写明「【以下为 {{user}} 的个人补充设定（非 {{char}} 设定）】」。';
  const triggerKeywords =
    '每条绿灯条目须从该条内容中取 1～4 个聊天时自然会用到的专名、简称或具体事件短语，用逗号分隔。避开 {{user}}、{{char}}、家人、过去等会在无关对话中出现的词。示例词仅展示写法。缺少贴切关键词的内容留在主档案。';

  if (safeLight === 'blue_constant') {
    return [
      '【补充世界书拆分规范（蓝灯常驻）】',
      `请将主档案正文精简至约 ${mainRange} 并放在上半部分；随后另起一行输出分隔标题 \`${WORLDBOOK_DIVIDER}\`，在分隔标题之下生成 2～3 条【蓝灯常驻】核心补充条目（适合全程都需要记住的重要背景、深层关系或行事准则）。${ownershipRule}严格使用以下格式：`,
      '[条目：条目标题]',
      '触发方式：蓝灯常驻',
      '关键词：核心标签1, 核心标签2',
      '内容：【以下为 {{user}} 的个人补充设定（非 {{char}} 设定）】常驻生效的重要补充事实。',
    ].join('\n');
  }

  if (safeLight === 'smart_mix') {
    return [
      '【补充世界书拆分规范（蓝绿灯分流）】',
      `请将主档案正文精简至约 ${mainRange} 并放在上半部分；随后另起一行输出分隔标题 \`${WORLDBOOK_DIVIDER}\`，在分隔标题之下生成最多 4 条补充背景条目，并按重要度分配蓝绿灯（全程不可或缺的重要关系或底线标为「蓝灯常驻」，聊到相关话题才展开的过往或支线细节标为「绿灯触发」）。${ownershipRule}`,
      triggerKeywords,
      '每条按下列格式输出，触发方式只写「蓝灯常驻」或「绿灯触发」其中一个。',
      '[条目：条目标题]',
      '触发方式：绿灯触发',
      '关键词：栖霞修表铺, 修表铺旧址',
      '内容：【以下为 {{user}} 的个人补充设定（非 {{char}} 设定）】补充事实与适用情境。',
    ].join('\n');
  }

  return [
    '【补充世界书拆分规范（绿灯关键词触发）】',
    `请将主档案正文精简至约 ${mainRange} 并放在上半部分。另起一行输出分隔标题 \`${WORLDBOOK_DIVIDER}\`，其下放最多 4 条按关键词触发的补充背景。${ownershipRule}`,
    '身份、核心关系和行动底线保留在主档案。世界书只放谈到相关话题才需要的往事和细节。',
    triggerKeywords,
    '每条按下列格式输出。',
    '[条目：条目标题]',
    '触发方式：绿灯触发',
    '关键词：栖霞修表铺, 修表铺旧址',
    '内容：【以下为 {{user}} 的个人补充设定（非 {{char}} 设定）】补充事实。',
  ].join('\n');
}

export function detectConcealmentSignals(text) {
  const s = String(text ?? '');
  if (!s.trim()) return false;
  return /(?:隐瞒|瞒着|不让.{0,8}知道|暗自|暗中|私下打算|心里打算|表面不说|嘴上不说|想分手|提分手|暗恋|单恋|藏着|秘密|不敢说|假装|伪装|马甲|隐藏身份|潜伏|卧底|双面|债务|负债|病情|心事|苦衷|难言之隐|不为人知|未公开)/u.test(s);
}

export function detectJointUpbringingSignals(text) {
  const s = String(text ?? '');
  if (!s.trim()) return false;
  return /(?:青梅竹马|从小一起|一起长大|自幼|养父|养母|养兄|养姐|养亲|师徒|师父|徒弟|养成|多年共生|相依为命|多年旧识|伴随成长|发小)/u.test(s);
}

function buildVisibilityTagsDirective() {
  return [
    '【信息可见度与认知边界】',
    `当前故事涉及情感暗流（如想分手、暗恋、隐瞒近况或未说出口的心事）、隐藏秘密或阵营信息差，请使用 ${VISIBILITY_MARKERS.join(' / ')} 清晰区分 {{char}} 表面可观察到的表现、开场已知共识与 {{user}} 未宣之于口的内心隐瞒，严防 {{char}} 读心直接看穿；普通日常细节保持自然行文，无需逐句机械打标。`,
  ].join('\n');
}

function buildConcealmentBoundaryDirective() {
  return [
    '【隐瞒与认知边界（防读心）】',
    '检测到本次设定包含内心隐瞒、暗自打算或未宣之于口的心事：请写明 {{user}} 日常待人如常的可观察外在表现，同时单独交代内心真实打算或隐情仅限于本人知晓；严防 {{char}} 在缺乏可见线索时凭空读心看穿。',
  ].join('\n');
}

function buildBackstoryDirective(backstoryMode = 'light_vibe') {
  if (backstoryMode === 'blank_self') {
    return '【经历尺度：纯留白零编造】严禁编造任何玩家未主动提供的家庭出身、童年往事或旧日事件，完全通过当下的气质、习惯与处境立住人物。';
  }
  if (backstoryMode === 'rich_arc') {
    return '【经历尺度：补全成长经历】结合人物特质与世界观，自然补全合理的成长环境与习惯成因，让人物来处清晰有血肉。';
  }
  return '【经历尺度：轻底色留余地】已写明的经历完整保留；未提及过往处仅用宽泛生活氛围托底，不擅自编造具体父母亲属或童年创伤。';
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

export function buildGenerationSectionDirective(sectionsConfig = {}, context = {}) {
  const cfg = normalizeGenerationSectionsConfig(sectionsConfig);
  const ctx = context && typeof context === 'object' ? context : {};
  const backstoryMode = VALID_BACKSTORY_MODES.has(ctx.backstoryMode) ? ctx.backstoryMode : '';
  const companions = Array.isArray(ctx.companions) ? ctx.companions.filter((c) => c && typeof c === 'object') : [];

  const effectiveEnabledSet = new Set(cfg.enabledIds);
  if (backstoryMode === 'blank_self') {
    effectiveEnabledSet.delete('backstory_growth');
  }

  const lines = [];
  if (cfg.layoutStyle === 'structured') {
    lines.push(
      '【输出版式：清单版（浅层中文分栏 + 平实大白话）】',
      `请以 ${CORE_SECTION_HEADER} 与 ${SHELL_SECTION_HEADER} 为一级标题，下方按本次启用的板块输出二级小标题（## 板块名），其下直接写 1～2 层的浅层中文键值（字段名：内容）或简洁短句；只输出契合当前世界观且有实质内容的字段，不留空壳占位格（例如古风或校园题材不硬套现代商务装，没有实质设定则跳过不硬凑）。`,
      '全程使用平实直白的大白话写具体事实、习惯、外显情绪表现与个人目标短板，禁堆砌华丽比喻句；各条目短句默认省略主语，不逐句重复写 {{user}}，仅在双人互动容易混淆谁对谁时点一次 {{user}} 或角色名消歧；严禁使用代码块或 XML 标签包裹。'
    );
  } else {
    lines.push(
      '【输出版式：分段版（平实分段叙述）】',
      `请以 ${CORE_SECTION_HEADER} 与 ${SHELL_SECTION_HEADER} 为一级标题，下方按本次启用的板块使用简洁二级小标题（## 板块名）配合自然连贯的段落或短句撰写；用平实大白话写具体事实与情绪表现，默认省略主语，仅在双人关系指代不清时点明，禁比喻堆砌、禁代码块与 XML 标签。`
    );
  }

  const enabledGuideLines = [];
  for (const group of GENERATION_SECTION_GROUPS) {
    for (const item of group.items) {
      if (effectiveEnabledSet.has(item.id)) {
        enabledGuideLines.push(`- ${item.label}：${item.guidance}`);
      }
    }
  }
  for (const cs of cfg.customSections) {
    enabledGuideLines.push(`- ${cs.name}：${cs.guidance || '按玩家指定要求平实写清该板块核心事实。'}`);
  }
  if (enabledGuideLines.length > 0) {
    lines.push('【本次生成的板块与填写指引】\n' + enabledGuideLines.join('\n'));
  }

  const disabledLabels = [];
  for (const group of GENERATION_SECTION_GROUPS) {
    for (const item of group.items) {
      if (!effectiveEnabledSet.has(item.id)) {
        disabledLabels.push(item.label);
      }
    }
  }

  const anyIntimateEnabled = Array.from(INTIMATE_SECTION_IDS).some((id) => effectiveEnabledSet.has(id));
  const forbidParts = [];
  if (disabledLabels.length > 0) {
    forbidParts.push(`以下未勾选板块本次严禁擅自生成（禁止生成未勾选内容）：${disabledLabels.join('、')}。`);
  }
  if (backstoryMode === 'blank_self') {
    forbidParts.push('当前处于纯留白模式，严禁生成任何童年、少年或过往家庭经历。');
  }
  if (!anyIntimateEnabled) {
    forbidParts.push('严禁生成任何成人向、情色或越界亲密描写内容。');
  }
  if (companions.length > 0) {
    const compNames = companions
      .map((c) => String(c.realName || c.name || '').trim())
      .filter(Boolean)
      .join('、');
    forbidParts.push(
      `已携带客串角色时${compNames ? `（携伴客串：${compNames}）` : ''}，亲友关系网应与客串名单及时间线协调衔接、避免冲突，不重复编写或冲突覆盖客串角色设定。`
    );
  }
  if (forbidParts.length > 0) {
    lines.push('【未勾选板块约束（严禁擅自生成）】\n' + forbidParts.join('\n'));
  }

  return lines.join('\n\n');
}

function stripOuterContainerShells(rawText) {
  let out = String(rawText ?? '').replace(/\r\n?/g, '\n').trim();
  if (!out) return '';
  out = out.replace(/^```[a-zA-Z0-9_-]*[ \t]*\n?/gm, '').replace(/\n?```[ \t]*$/gm, '');
  out = out.replace(/<\/?\s*(?:info|character|character_information|profile|user_persona)\b[^>]*>/gi, '');
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

function stripBodyConflicts(rawText, strippedSet) {
  let out = stripOuterContainerShells(rawText);
  if (!out) return '';

  const xmlBlockRe = /<\s*(style|status(?:bar)?|format|system|ooc|instructions|thinking|cot|writingspec|initvar)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;
  if (xmlBlockRe.test(out)) {
    strippedSet.add('statusBarDirective');
    strippedSet.add('status_directive');
    out = out.replace(xmlBlockRe, '');
  }
  const openTagRe = /<\/?\s*(style|status(?:bar)?|format|system|ooc|instructions|thinking|cot|writingspec|initvar)\b[^>]*>/gi;
  if (openTagRe.test(out)) {
    strippedSet.add('statusBarDirective');
    strippedSet.add('status_directive');
    out = out.replace(openTagRe, '');
  }

  const filteredLines = [];
  for (const line of out.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) {
      filteredLines.push('');
      continue;
    }
    if (
      /^(?:[-*•]\s*)?(?:【\s*(?:状态栏|输出格式|格式控制)\s*】|\[?(?:状态栏|Status\s*Bar|输出格式(?:要求|控制)?|格式要求|格式控制|排版要求|字数要求|系统指令|System\s*Prompt)\]?|每次回复(?:末尾|结尾)?(?:必须|请)?(?:输出|附带|控制在)|回复末尾(?:必须|请)?附上|(?:输出)?字数控制在\s*\d+|并更新状态栏)/iu.test(
        trimmed
      )
    ) {
      strippedSet.add('statusBarDirective');
      strippedSet.add('status_directive');
      continue;
    }
    if (
      /(?:开场(?:时|处境|阶段|剧情)|初遇时|当前剧情开端|本局开局)[^\n]*?(?:\{\{user\}\}|<user>|玩家)/iu.test(trimmed) ||
      /^(?:[-*•]\s*)?(?:与\s*(?:\{\{user\}\}|<user>)\s*的?(?:旧关系|初始关系|原关系)|\{\{user\}\}\s*(?:初始身份|开场身份|原身份))[:：]/iu.test(
        trimmed
      ) ||
      /(?:我是|身为|作为)\s*(?:\{\{user\}\}|<user>)\s*的\s*(?:未婚[夫妻]|男朋?友|女朋?友|丈夫|妻子|前任|前夫|前妻|老公|老婆|伴侣|恋人)/iu.test(
        trimmed
      ) ||
      /\byou\s+are\s+(?:\{\{user\}\}|<user>)'?s\s+(?:ex-)?(?:husband|wife|boyfriend|girlfriend|fianc[eé]+|partner|lover)\b/iu.test(
        trimmed
      )
    ) {
      strippedSet.add('oldUserRelation');
      strippedSet.add('user_relation');
      continue;
    }
    filteredLines.push(line);
  }

  return filteredLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function stripCompanionConflicts(cardContext = {}) {
  const ctx = cardContext && typeof cardContext === 'object' ? cardContext : {};
  const strippedSet = new Set();

  const rawFirstMes = String(ctx.firstMessage ?? ctx.first_mes ?? '').trim();
  if (rawFirstMes) {
    strippedSet.add('firstMessage');
    strippedSet.add('first_mes');
  }

  const rawScenario = String(ctx.scenario ?? '').trim();
  if (rawScenario) strippedSet.add('scenario');

  const rawDesc = String(ctx.mergedDescription ?? ctx.description ?? '');
  const name = String(ctx.name ?? '').trim();
  const description = stripBodyConflicts(rawDesc, strippedSet);
  const personality = stripBodyConflicts(ctx.personality, strippedSet);
  const mesExamples = stripBodyConflicts(ctx.mesExamples ?? ctx.mes_example ?? '', strippedSet);

  const worldCleanItems = [];
  if (Array.isArray(ctx.selectedWorldEntries)) {
    for (const entry of ctx.selectedWorldEntries) {
      if (!entry || typeof entry !== 'object') continue;
      if (isNoiseWorldbookEntry(entry) && entry.forceInclude !== true) continue;
      const cleanedEntry = stripBodyConflicts(entry.content, strippedSet);
      if (cleanedEntry) {
        worldCleanItems.push({
          key: String(entry.comment || 'worldEntry'),
          content: cleanedEntry,
        });
      }
    }
  }

  const cleanSections = [];
  if (description) cleanSections.push({ key: 'description', content: description });
  if (personality) cleanSections.push({ key: 'personality', content: personality });
  if (mesExamples) cleanSections.push({ key: 'mesExamples', content: mesExamples });
  for (const w of worldCleanItems) cleanSections.push(w);

  Object.defineProperties(cleanSections, {
    name: { value: name, enumerable: false, configurable: true },
    description: { value: description, enumerable: false, configurable: true },
    personality: { value: personality, enumerable: false, configurable: true },
    mesExamples: { value: mesExamples, enumerable: false, configurable: true },
  });

  return {
    cleanSections,
    strippedTypes: Array.from(strippedSet),
  };
}

function truncateVerbatimAtBoundary(text, tokenBudget) {
  const clean = String(text ?? '').trim();
  if (!clean || tokenBudget <= 0) return { text: '', truncated: Boolean(clean) };
  if (estimateTokens(clean) <= tokenBudget) return { text: clean, truncated: false };

  const targetRatio = Math.max(0.05, Math.min(0.98, tokenBudget / Math.max(1, estimateTokens(clean))));
  let approxChars = Math.max(16, Math.floor(clean.length * targetRatio));

  const trySlice = (endIdx) => {
    const candidate = clean.slice(0, endIdx).trim();
    return candidate && estimateTokens(candidate) <= tokenBudget ? candidate : '';
  };

  while (approxChars >= 16) {
    const windowSlice = clean.slice(0, approxChars);
    const paraBreak = windowSlice.lastIndexOf('\n\n');
    if (paraBreak >= 24) {
      const res = trySlice(paraBreak);
      if (res) return { text: res, truncated: true };
    }
    const lineBreak = windowSlice.lastIndexOf('\n');
    if (lineBreak >= 20) {
      const res = trySlice(lineBreak);
      if (res) return { text: res, truncated: true };
    }
    const sentMatch = [...windowSlice.matchAll(/[。！？!?]/g)].pop();
    if (sentMatch && sentMatch.index >= 16) {
      const res = trySlice(sentMatch.index + 1);
      if (res) return { text: res, truncated: true };
    }
    const clauseMatch = [...windowSlice.matchAll(/[，；,;]/g)].pop();
    if (clauseMatch && clauseMatch.index >= 12) {
      const res = trySlice(clauseMatch.index);
      if (res) return { text: res, truncated: true };
    }
    const hardRes = trySlice(approxChars);
    if (hardRes) return { text: hardRes, truncated: true };
    approxChars = Math.floor(approxChars * 0.78);
  }

  return { text: '', truncated: true };
}

export function extractVerbatimCompanionSlices(cardContext = {}, selectedWorldEntries = [], tokenBudget = 1200) {
  const budget = Math.max(0, Math.round(Number.isFinite(Number(tokenBudget)) ? Number(tokenBudget) : 1200));
  const { cleanSections } = stripCompanionConflicts(cardContext);
  const candidates = [];

  if (cleanSections.description) {
    candidates.push({ source: 'description', label: '原卡外貌与简介', text: cleanSections.description });
  }
  if (cleanSections.personality) {
    candidates.push({ source: 'personality', label: '原卡性格设定', text: cleanSections.personality });
  }
  if (cleanSections.mesExamples) {
    candidates.push({ source: 'mesExamples', label: '原卡代表台词', text: cleanSections.mesExamples });
  }

  if (Array.isArray(selectedWorldEntries)) {
    const dummySet = new Set();
    for (const entry of selectedWorldEntries) {
      if (!entry || typeof entry !== 'object') continue;
      if (isNoiseWorldbookEntry(entry) && entry.forceInclude !== true) continue;
      const cleaned = stripBodyConflicts(entry.content, dummySet);
      if (!cleaned) continue;
      const label =
        String(entry.comment ?? '').trim() ||
        (Array.isArray(entry.keys) && entry.keys[0] ? String(entry.keys[0]).trim() : '') ||
        '原卡关联设定';
      candidates.push({ source: 'worldbook', label, text: cleaned });
    }
  }

  const slices = [];
  let remaining = budget;
  let truncated = false;

  for (const item of candidates) {
    if (remaining < 24) {
      truncated = true;
      break;
    }
    const itemTokens = estimateTokens(item.text);
    if (itemTokens <= remaining) {
      slices.push({
        source: item.source,
        label: item.label,
        text: item.text,
        tokens: itemTokens,
      });
      remaining -= itemTokens;
    } else {
      const partial = truncateVerbatimAtBoundary(item.text, remaining);
      if (partial.text) {
        const partTokens = estimateTokens(partial.text);
        slices.push({
          source: item.source,
          label: item.label,
          text: partial.text,
          tokens: partTokens,
        });
        remaining -= partTokens;
      }
      truncated = true;
      break;
    }
  }

  const text = slices.map((s) => `[${s.label}]\n${s.text}`).join('\n\n');
  return {
    slices,
    text,
    usedTokens: estimateTokens(text),
    truncated,
  };
}

export function computeCompanionTokenPlan({
  personaText = '',
  mainCharContext = null,
  mainSelectedWorldEntries = [],
  companions = [],
  maxContextTokens = 16000,
} = {}) {
  const totalBudget = clampInt(maxContextTokens, 256, 128000, 16000);
  const personaTokens = estimateTokens(personaText);

  let mainCharTokens = 0;
  if (mainCharContext && typeof mainCharContext === 'object') {
    mainCharTokens += estimateTokens(mainCharContext.mergedDescription || mainCharContext.description);
    mainCharTokens += estimateTokens(mainCharContext.personality);
    mainCharTokens += estimateTokens(mainCharContext.scenario);
    mainCharTokens += estimateTokens(mainCharContext.openingReference);
    const entriesSource = Array.isArray(mainSelectedWorldEntries)
      ? mainSelectedWorldEntries
      : Array.isArray(mainCharContext.selectedWorldEntries)
        ? mainCharContext.selectedWorldEntries
        : null;
    if (entriesSource) {
      for (const e of entriesSource) {
        if (e && typeof e === 'object' && (!isNoiseWorldbookEntry(e) || e.forceInclude === true)) {
          mainCharTokens += estimateTokens(e.content);
        }
      }
    } else if (mainCharContext.worldSummary) {
      mainCharTokens += estimateTokens(mainCharContext.worldSummary);
    }
  } else if (Array.isArray(mainSelectedWorldEntries)) {
    for (const e of mainSelectedWorldEntries) {
      if (e && typeof e === 'object' && (!isNoiseWorldbookEntry(e) || e.forceInclude === true)) {
        mainCharTokens += estimateTokens(e.content);
      }
    }
  }

  const baseUsedTokens = personaTokens + mainCharTokens;
  const rawRemaining = totalBudget - baseUsedTokens;
  const remainingTokens = Math.max(0, rawRemaining);
  const promptReserve =
    rawRemaining > 0
      ? Math.min(1200, Math.round(totalBudget * 0.1), Math.floor(rawRemaining * 0.35))
      : 0;
  const allocatable = Math.max(0, rawRemaining - promptReserve);

  const activeCompanions = (Array.isArray(companions) ? companions : [])
    .filter((c) => c && typeof c === 'object')
    .slice(0, 3);

  const resolveCompTier = (c) => {
    const raw = c?.frequencyTier ?? c?.frequency;
    return VALID_COMPANION_TIER_IDS.has(raw) ? raw : 'occasional';
  };

  const totalWeight =
    activeCompanions.reduce((sum, c) => {
      const tier = resolveCompTier(c);
      return sum + (COMPANION_TIER_WEIGHTS[tier] || 1.0);
    }, 0) || 1;

  const perCompanionBudgets = activeCompanions.map((c, idx) => {
    const tierId = resolveCompTier(c);
    const carryMode = VALID_COMPANION_CARRY_MODES.has(c.carryMode) ? c.carryMode : 'inline';
    const weight = COMPANION_TIER_WEIGHTS[tierId] || 1.0;
    const cardCtx = c.cardContext && typeof c.cardContext === 'object' ? c.cardContext : c;
    const selectedEntries = Array.isArray(c.selectedWorldEntries) ? c.selectedWorldEntries : [];
    const { cleanSections } = stripCompanionConflicts(cardCtx);
    let estimatedSourceTokens =
      estimateTokens(cleanSections.description) +
      estimateTokens(cleanSections.personality) +
      estimateTokens(cleanSections.mesExamples);
    const dummySet = new Set();
    for (const e of selectedEntries) {
      if (e && typeof e === 'object' && (!isNoiseWorldbookEntry(e) || e.forceInclude === true)) {
        estimatedSourceTokens += estimateTokens(stripBodyConflicts(e.content, dummySet));
      }
    }

    const weightedShare = allocatable > 0 ? Math.floor((allocatable * weight) / totalWeight) : 0;
    const tierCap = Math.round(2800 * weight);
    const allocatedTokens = Math.min(tierCap, weightedShare);

    return {
      id: String(c.id || c.avatar || c.name || `comp_${idx}`),
      name: String(c.name || cleanSections.name || `客串角色${idx + 1}`).trim(),
      frequencyTier: tierId,
      carryMode,
      weight,
      allocatedTokens,
      estimatedSourceTokens,
    };
  });

  let headroomStatus = 'ok';
  let warningMessage = '';
  if (rawRemaining <= 0 || (activeCompanions.length > 0 && allocatable < activeCompanions.length * 40)) {
    headroomStatus = 'over';
    warningMessage =
      '当前用户设定与主角色上下文已接近或超出预算上限，建议精简主世界书勾选条目，或改用世界书承载客串设定。';
  } else if (
    rawRemaining < totalBudget * 0.25 ||
    perCompanionBudgets.some((b) => b.estimatedSourceTokens > b.allocatedTokens)
  ) {
    headroomStatus = 'tight';
    warningMessage =
      '可用上下文余量偏紧，已按出场频率自动分配各客串角色的原文切片配额，优先保留外貌、性格与代表台词。';
  }

  return {
    totalBudget,
    baseUsedTokens,
    personaTokens,
    mainCharTokens,
    remainingTokens,
    headroomStatus,
    perCompanionBudgets,
    warningMessage,
  };
}

function resolveCompanionSliceSource(c, cardCtx) {
  const rawEntries = Array.isArray(c.selectedWorldEntries) ? c.selectedWorldEntries : [];
  const subKey = String(c.subCharKey ?? '').trim();
  const hasExplicitSub = Boolean(subKey) || c.isolateSubChar === true;

  if (!hasExplicitSub) {
    return { effectiveCardCtx: cardCtx, effectiveEntries: rawEntries, subCharName: '' };
  }

  const pool = rawEntries.length > 0
    ? rawEntries
    : Array.isArray(cardCtx.worldEntries)
      ? cardCtx.worldEntries
      : [];
  const multiAll = detectMultiCharacterCard(
    cardCtx,
    Array.isArray(cardCtx.worldEntries) && cardCtx.worldEntries.length > 0 ? cardCtx.worldEntries : pool
  );
  const multi = multiAll.characterEntries.length > 0 ? multiAll : detectMultiCharacterCard(cardCtx, pool);
  const matchedSub = subKey
    ? multi.characterEntries.find((ce) => ce.key === subKey || ce.name === subKey)
    : multi.characterEntries.length === 1
      ? multi.characterEntries[0]
      : null;

  const filteredEntries = pool.filter((entry, idx) => {
    if (!entry || typeof entry !== 'object') return false;
    const cls = classifyWorldbookEntry(entry);
    if (cls === 'system_format' && entry.forceInclude !== true) return false;
    if (cls === 'acting_rules') return !isWorldbookEntryDisabled(entry) || entry.forceInclude === true;
    const k = getWorldbookEntryIdentityKey(entry, idx);
    if (subKey) return k === subKey || String(entry.comment ?? '').trim() === subKey;
    return matchedSub ? k === matchedSub.key : true;
  });

  const subCharName = matchedSub?.name || '';
  const effectiveCardCtx = {
    name: subCharName || cardCtx.name,
    description: '',
    personality: '',
    mesExamples: '',
  };
  return { effectiveCardCtx, effectiveEntries: filteredEntries, subCharName };
}

export function buildCompanionWorldbookEntries({
  companions = [],
  companionPlans = null,
  targetPersonaName = '',
  lightMode = '',
  position,
  depth,
  role,
  order,
  worldbookPlacement = null,
} = {}) {
  const activeCompanions = (Array.isArray(companions) ? companions : [])
    .filter((c) => c && typeof c === 'object')
    .slice(0, 3);
  if (activeCompanions.length === 0) return [];

  const placement = normalizeWorldbookPlacement({
    position: position ?? worldbookPlacement?.position,
    depth: depth ?? worldbookPlacement?.depth,
    role: role ?? worldbookPlacement?.role,
    order: order ?? worldbookPlacement?.order,
  });
  const hasExplicitOrder =
    (order !== undefined && order !== null && String(order).trim() !== '' && Number.isFinite(Number(order))) ||
    (worldbookPlacement?.order !== undefined &&
      worldbookPlacement?.order !== null &&
      String(worldbookPlacement.order).trim() !== '' &&
      Number.isFinite(Number(worldbookPlacement.order)));

  const personaLabel = String(targetPersonaName ?? '').trim() || '{{user}}';
  const planList = Array.isArray(companionPlans)
    ? companionPlans
    : Array.isArray(companionPlans?.perCompanionBudgets)
      ? companionPlans.perCompanionBudgets
      : [];
  const usedSlotKeys = new Set();

  return activeCompanions.map((c, idx) => {
    const cardCtx = c.cardContext && typeof c.cardContext === 'object' ? c.cardContext : c;
    const { effectiveCardCtx, effectiveEntries, subCharName } = resolveCompanionSliceSource(c, cardCtx);
    const rawCardName = String(c.cardName || cardCtx.name || c.name || '').trim();
    const resolvedNameInfo = resolveCharacterRealName({
      name: subCharName || rawCardName,
      description: effectiveCardCtx.mergedDescription || effectiveCardCtx.description,
      firstMessage: effectiveCardCtx.firstMessage || effectiveCardCtx.first_mes,
      worldEntries: effectiveEntries.length > 0 ? effectiveEntries : cardCtx.worldEntries,
    });
    const compName =
      String(c.realName ?? '').trim() ||
      subCharName ||
      (c.name && !isTitleLikeCardName(c.name) ? String(c.name).trim() : '') ||
      resolvedNameInfo.realName ||
      rawCardName ||
      `客串角色${idx + 1}`;
    const rawId = String(c.id || c.avatar || compName || `comp_${idx}`).trim();
    const baseSafeId = rawId.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || `comp_${idx}`;
    let safeId = baseSafeId;
    let suffix = 2;
    while (usedSlotKeys.has(`ups:companion:${safeId}`)) {
      safeId = `${baseSafeId}_${suffix}`;
      suffix += 1;
    }
    const slotKey = `ups:companion:${safeId}`;
    usedSlotKeys.add(slotKey);

    const rawTier = c.frequencyTier ?? c.frequency;
    const tierId = VALID_COMPANION_TIER_IDS.has(rawTier) ? rawTier : 'occasional';
    const tier = COMPANION_TIER_BY_ID.get(tierId) || COMPANION_FREQUENCY_TIERS[1];

    const matchedPlan =
      planList.find((p) => p && (p.id === rawId || p.name === compName || p.name === rawCardName)) ||
      planList[idx] ||
      null;
    const budget =
      matchedPlan && Number.isFinite(matchedPlan.allocatedTokens) && matchedPlan.allocatedTokens > 0
        ? matchedPlan.allocatedTokens
        : 1200;

    const explicitVerbatim =
      matchedPlan && typeof matchedPlan.verbatimText === 'string' && matchedPlan.verbatimText.trim()
        ? matchedPlan.verbatimText.trim()
        : '';
    const verbatimText = explicitVerbatim || extractVerbatimCompanionSlices(effectiveCardCtx, effectiveEntries, budget).text;

    const relationToUser = String(c.relationToUser ?? '').trim() || '亲友';
    const knowsMainChar = Boolean(c.knowsMainChar);
    const relationToMainChar = String(c.relationToMainChar ?? '').trim();
    const mainRelText = knowsMainChar
      ? relationToMainChar || '彼此相识'
      : '互不相识（暂不认识，互无直接交集）';

    const keys = [];
    const pushKey = (k) => {
      const clean = String(k ?? '').trim();
      if (clean && !keys.includes(clean)) keys.push(clean);
    };
    pushKey(compName);
    if (/^[\u4e00-\u9fff]{3}$/.test(compName)) {
      pushKey(compName.slice(1));
    }
    if (Array.isArray(c.triggerKeys)) {
      for (const k of c.triggerKeys) pushKey(k);
    }
    if (relationToUser && relationToUser !== '亲友') {
      pushKey(relationToUser);
    }
    if (rawCardName && rawCardName !== compName && !isTitleLikeCardName(rawCardName)) {
      pushKey(rawCardName);
    }

    const rawLight = c.lightMode || lightMode || '';
    const isBlue = rawLight === 'blue_constant';
    const lightLabel = isBlue ? '蓝灯常驻' : '绿灯按关键词触发';

    const contentParts = [
      '【以下为 {{user}} 的个人补充设定中的关联客串角色（非 {{char}} 设定）】',
      `【客串角色：${compName}】`,
      `与 ${personaLabel} 的关系：${relationToUser}`,
      `与当前主角色的关系：${mainRelText}`,
      `出场频率（${tier.label}）：${tier.promptRule}`,
    ];
    if (verbatimText) {
      contentParts.push(`【原卡原文设定（严格保真，禁止擅自改写或编造）】\n${verbatimText}`);
    }

    const entryOrder = hasExplicitOrder
      ? clampInt(placement.order + (tier.worldbookOrder - 80), 0, 10000, tier.worldbookOrder)
      : tier.worldbookOrder;

    return {
      key: keys,
      comment: `【{{user}}客串角色：${compName}】`,
      content: contentParts.join('\n'),
      constant: isBlue,
      selective: !isBlue,
      disable: false,
      addMemo: true,
      position: placement.position,
      order: entryOrder,
      ...(placement.position === WORLD_INFO_POSITION.AT_DEPTH
        ? { depth: placement.depth, role: placement.role }
        : {}),
      extensions: {
        [UPS_EXT_KEY]: {
          managed: true,
          slotKey,
          companionId: rawId,
          frequencyTier: tier.id,
          lightMode: isBlue ? 'blue_constant' : 'green_selective',
          lightLabel,
        },
      },
    };
  });
}

function formatCompanionPromptBlock(companions = [], companionPlans = null) {
  const activeCompanions = (Array.isArray(companions) ? companions : [])
    .filter((c) => c && typeof c === 'object')
    .slice(0, 3);
  if (activeCompanions.length === 0) return '';

  const planList = Array.isArray(companionPlans)
    ? companionPlans
    : Array.isArray(companionPlans?.perCompanionBudgets)
      ? companionPlans.perCompanionBudgets
      : [];

  const blocks = [
    '【携伴客串与人物关系网（1～3 位低干扰客串）】',
    '核心要求：客串角色的外貌、性格、习惯与台词风格必须忠于原卡。引用须保留原文，不改写或编造设定。以当前角色 {{char}} 为剧情主角，客串人物按设定频率出场。',
  ];

  activeCompanions.forEach((c, idx) => {
    const cardCtx = c.cardContext && typeof c.cardContext === 'object' ? c.cardContext : c;
    const { effectiveCardCtx, effectiveEntries, subCharName } = resolveCompanionSliceSource(c, cardCtx);
    const rawCardName = String(c.cardName || cardCtx.name || c.name || '').trim();
    const resolvedNameInfo = resolveCharacterRealName({
      name: subCharName || rawCardName,
      description: effectiveCardCtx.mergedDescription || effectiveCardCtx.description,
      firstMessage: effectiveCardCtx.firstMessage || effectiveCardCtx.first_mes,
      worldEntries: effectiveEntries.length > 0 ? effectiveEntries : cardCtx.worldEntries,
    });
    const compName =
      String(c.realName ?? '').trim() ||
      subCharName ||
      (c.name && !isTitleLikeCardName(c.name) ? String(c.name).trim() : '') ||
      resolvedNameInfo.realName ||
      rawCardName ||
      `客串角色${idx + 1}`;
    const rawTier = c.frequencyTier ?? c.frequency;
    const tierId = VALID_COMPANION_TIER_IDS.has(rawTier) ? rawTier : 'occasional';
    const tier = COMPANION_TIER_BY_ID.get(tierId) || COMPANION_FREQUENCY_TIERS[1];
    const carryMode = VALID_COMPANION_CARRY_MODES.has(c.carryMode) ? c.carryMode : 'inline';
    const relationToUser = String(c.relationToUser ?? '').trim() || '亲友';
    const knowsMainChar = Boolean(c.knowsMainChar);
    const relationToMainChar = String(c.relationToMainChar ?? '').trim();
    const mainRelText = knowsMainChar ? relationToMainChar || '彼此认识' : '互不相识（暂不认识，互无交集）';

    const matchedPlan =
      planList.find((p) => p && (p.id === String(c.id || '') || p.name === compName || p.name === rawCardName)) ||
      planList[idx] ||
      null;
    const budget =
      matchedPlan && Number.isFinite(matchedPlan.allocatedTokens) && matchedPlan.allocatedTokens > 0
        ? matchedPlan.allocatedTokens
        : 1200;

    const lines = [
      `▸ 客串 ${idx + 1}：${compName}`,
      `- 与 {{user}} 关系：${relationToUser}`,
      `- 与主角色关系：${mainRelText}`,
      `- 出场频率（${tier.label}）：${tier.promptRule}`,
    ];

    if (carryMode === 'inline') {
      const explicitVerbatim =
        matchedPlan && typeof matchedPlan.verbatimText === 'string' && matchedPlan.verbatimText.trim()
          ? matchedPlan.verbatimText.trim()
          : '';
      const slicedText = explicitVerbatim || extractVerbatimCompanionSlices(effectiveCardCtx, effectiveEntries, budget).text;
      if (slicedText) {
        lines.push(
          '- 资料存放：随本次人设正文精简锚定（下方为原卡原文切片，必须原样参考、不得改写措辞或添油加醋）：\n' +
            slicedText
        );
      } else {
        lines.push('- 资料存放：随本次人设正文精简写入关系锚点。');
      }
    } else {
      const compLightText = c.lightMode === 'blue_constant' ? '蓝灯常驻生效' : '绿灯按名字/关系关键词触发';
      lines.push(
        `- 存放与触发：${carryMode === 'persona_book' ? '绑定人设专属世界书' : '写入指定已有世界书'}（${compLightText}；详细人物档案写入世界书，本正文只需在关系板块简明交代其与 {{user}} / {{char}} 的关系与出场节奏，不堆砌重复长设定）。`
      );
    }

    blocks.push(lines.join('\n'));
  });

  return blocks.join('\n\n');
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

  const targetSection = String(opts.targetSection ?? '').trim();
  const backstoryMode = VALID_BACKSTORY_MODES.has(opts.backstoryMode) ? opts.backstoryMode : '';
  const spotlightMode = VALID_SPOTLIGHT_MODES.has(opts.spotlightMode) ? opts.spotlightMode : '';
  const ratios = normalizeModuleRatios(opts.moduleRatios);
  const companions = (Array.isArray(opts.companions) ? opts.companions : [])
    .filter((c) => c && typeof c === 'object')
    .slice(0, 3);
  const applySectionsDirective = !targetSection && Boolean(opts.generationSections || subMode !== 'cross_card_adapt');
  const sectionsOverride = !targetSection && scheme.syncedOverrides?.generationSections;
  const effectiveDualLayer =
    !targetSection &&
    (opts.dualLayer !== undefined
      ? Boolean(opts.dualLayer)
      : Boolean(scheme.entries.find((e) => e.slotType === 'worldbook')?.enabled));
  const useDraftAudit =
    !targetSection &&
    (opts.draftAudit !== undefined
      ? opts.draftAudit === true
      : Boolean(scheme.entries.find((e) => e.slotType === 'draft_audit')?.enabled));

  const slotUiContext = targetSection
    ? null
    : {
        mode,
        subMode,
        backstoryMode,
        spotlightMode,
        pureCrossCardReuse: Boolean(opts.pureCrossCardReuse),
        moduleRatios: opts.moduleRatios,
        generationSections: applySectionsDirective ? (opts.generationSections || {}) : null,
        dualLayer: effectiveDualLayer,
        worldbookLightMode: opts.worldbookLightMode,
        companions,
      };

  const messages = [];
  let emittedContextSlot = false;
  let emittedPacingSlot = false;
  let emittedFormatSlot = false;
  let emittedWorldbookSlot = false;
  let emittedDraftAuditSlot = false;

  for (const entry of scheme.entries) {
    let isEntryEnabled = Boolean(entry.enabled);
    if (entry.slotType === 'worldbook') {
      if (scheme.syncedOverrides?.dualLayer && emittedWorldbookSlot) continue;
      isEntryEnabled = effectiveDualLayer;
    } else if (entry.slotType === 'draft_audit') {
      if (scheme.syncedOverrides?.draftAudit && emittedDraftAuditSlot) continue;
      isEntryEnabled = useDraftAudit;
    }
    if (!isEntryEnabled) continue;

    const resolved = resolveSlotContent(entry, scheme, tasteProfile, true, slotUiContext);
    if (!resolved) continue;

    if (entry.slotType === 'context') emittedContextSlot = true;
    else if (entry.slotType === 'pacing') emittedPacingSlot = true;
    else if (entry.slotType === 'format') emittedFormatSlot = true;
    else if (entry.slotType === 'worldbook') emittedWorldbookSlot = true;
    else if (entry.slotType === 'draft_audit') emittedDraftAuditSlot = true;

    messages.push({
      role: validRole(entry.role, 'system'),
      content: resolved,
    });
  }

  const taskParts = [];
  const inspiration = String(opts.inspiration ?? '').trim();
  const userMustHaves = String(opts.userMustHaves ?? '').trim();
  const existingDraft = mode === 'create' ? '' : mergeDuplicatePersonaSections(opts.existingDraft ?? '');
  const lockedCore = String(opts.lockedCore ?? '').trim();
  const useVisibilityTags = opts.visibilityTags === true;
  const resolvedSubCharKeys = Array.isArray(opts.selectedSubCharKeys)
    ? opts.selectedSubCharKeys
    : Array.isArray(opts.selectedSubCharacterKeys)
      ? opts.selectedSubCharacterKeys
      : undefined;
  const charBlock = formatCharContextBlock(opts.charContext, {
    selectedSubCharKeys: resolvedSubCharKeys,
  });
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
        `【任务模式：换卡融合重塑】\n严格保留下方指定的性格神韵、外貌本色与已勾选固定项；同时结合新角色卡的世界观、时代环境与角色关系，自然重塑与之契合的成长经历来处及${SHELL_SECTION_HEADER}，让身份、过往与开场关系在新故事里长出真实血肉。`,
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

  if (opts.charContext && typeof opts.charContext === 'object') {
    const cardName = String(opts.charContext.name ?? '').trim();
    const explicitSubKeys = Array.isArray(resolvedSubCharKeys)
      ? resolvedSubCharKeys.map((k) => String(k ?? '').trim()).filter(Boolean)
      : [];
    const poolEntries = opts.charContext.worldEntries || opts.charContext.selectedWorldEntries || [];
    const multiInfo = Array.isArray(poolEntries) && poolEntries.length > 0
      ? detectMultiCharacterCard(opts.charContext, poolEntries)
      : { isMultiChar: false, characterEntries: [] };
    let focusedSubRealName = '';
    if (multiInfo.isMultiChar && explicitSubKeys.length > 0) {
      const focusedSet = new Set(explicitSubKeys.slice(0, 3));
      const matched = multiInfo.characterEntries.filter((c) => focusedSet.has(c.key));
      if (matched.length === 1) {
        focusedSubRealName = getFocusedCharacterName(opts.charContext, matched[0]);
      }
    }
    const resolvedMainRealName =
      focusedSubRealName ||
      resolveCharacterReferenceName(opts.charContext);
    if (resolvedMainRealName && cardName && resolvedMainRealName !== cardName) {
      taskParts.push(
        `【角色真名指代规范】\n关联角色的称呼为「${resolvedMainRealName}」。需要点名时使用该称呼，严禁机械输出 {{char}} 或将作品卡名当作人名。`
      );
    } else if (cardName) {
      taskParts.push('卡名可能是作品名。请按角色资料和世界书里的明确称呼写；仍无法确定时，用关系称呼或省略姓名，不要猜测。');
    }
  }

  if (!emittedContextSlot && !sectionsOverride) {
    if (backstoryMode && !targetSection) {
      const bsText = buildBackstoryDirective(backstoryMode);
      if (bsText) taskParts.push(bsText);
    }
    if (spotlightMode && !targetSection) {
      const spText = buildSpotlightDirective(spotlightMode);
      if (spText) taskParts.push(spText);
    }
  }

  if (sectionsOverride) {
    taskParts.push(sectionsOverride);
  } else if (applySectionsDirective && !emittedFormatSlot) {
    taskParts.push(
      buildGenerationSectionDirective(opts.generationSections, {
        backstoryMode: backstoryMode || 'light_vibe',
        companions,
      })
    );
  }

  if (!emittedPacingSlot && !targetSection && !sectionsOverride && (ratios.mode === 'custom' || ratios.private > 0)) {
    const ratioParts = [
      `外貌气质约 ${ratios.appearance}%`,
      `性格习惯约 ${ratios.personality}%`,
      `过往经历约 ${ratios.backstory}%`,
      `当前背景与关系约 ${ratios.relationship}%`,
    ];
    if (ratios.private > 0) {
      ratioParts.push(`私密心事或暗线约 ${ratios.private}%`);
    }
    taskParts.push(
      `【人设构成占比指导】\n请按以下篇幅比重分配各维度细节（优先满足玩家明确指定的要求）：${ratioParts.join('，')}。`
    );
  }

  const combinedText = [
    inspiration,
    userMustHaves,
    existingDraft,
    lockedCore,
    opts.charContext?.description,
    opts.charContext?.scenario,
    ...companions.map((c) => `${c.relationToUser || ''} ${c.relationToMainChar || ''}`),
  ]
    .filter(Boolean)
    .join('\n');

  if (!targetSection && !sectionsOverride) {
    if (opts.pureCrossCardReuse === true && !emittedContextSlot) {
      taskParts.push(
        `【纯通用跨卡复用】\n本次需要跨卡通用复用：请保持${CORE_SECTION_HEADER}独立通用，剥离特定角色或旧卡专属绑定，仅在${SHELL_SECTION_HEADER}衔接当前角色卡。`
      );
    } else if (
      opts.pureCrossCardReuse !== true &&
      (opts.sharedUpbringing === true || detectJointUpbringingSignals(combinedText))
    ) {
      const { hasCompanions, hasNpcNetwork } = getCompanionNpcFlags({
        companions,
        generationSections: opts.generationSections,
      });
      const jointTarget =
        hasCompanions && hasNpcNetwork
          ? '{{char}}、亲友或客串角色'
          : hasCompanions
            ? '{{char}} 或客串角色'
            : hasNpcNetwork
              ? '{{char}} 或亲友'
              : '{{char}}';
      taskParts.push(
        `【基础人设与共同成长融合】\n检测到与 ${jointTarget} 存在青梅竹马、家人养亲、师徒养成或多年共生关系：请将塑造 {{user}} 性格底色、生活习惯与安全感边界的共同成长印记自然融入${CORE_SECTION_HEADER}，不要机械割裂；同时将当下所处时间点、现居状态与开场矛盾写入${SHELL_SECTION_HEADER}，保持年龄与时间线前后一致。`
      );
    } else if (opts.pureCrossCardReuse !== true && opts.charContext && backstoryMode !== 'blank_self') {
      taskParts.push(
        `【人物经历与角色世界血肉融合】\n当前关联了具体角色卡：请不要把${CORE_SECTION_HEADER}写成脱离故事的空泛模板，人物的成长环境、经历轨迹与习惯成因可顺着当前角色卡的世界观、社会土壤及与角色的交集脉络自然生长，让人物真正长出有来处的血肉。`
      );
    }
  }

  const combinedInputForExamples = `${inspiration}\n${userMustHaves}\n${existingDraft}\n${lockedCore}`;
  if (opts.antiParrot !== false && !targetSection && hasReplayRiskExamples(combinedInputForExamples)) {
    taskParts.push(
      '【示例防照抄提醒】\n检测到输入中包含“例如/比如”等具体情境示例：请先提炼出背后的通用思维回路与反应规律；若在正文中保留具体示例辅助理解，须保持简练并在括号内注明“仅作理解思维逻辑的参考例，日常互动随情境自然反应，不复刻原例桥段”。'
    );
  }

  if (useVisibilityTags) {
    taskParts.push(buildVisibilityTagsDirective());
  } else if (!targetSection && (detectConcealmentSignals(combinedInputForExamples) || ratios.private > 0)) {
    taskParts.push(buildConcealmentBoundaryDirective());
  }

  if (companions.length > 0 && !targetSection) {
    const companionPlans =
      opts.companionPlans ||
      computeCompanionTokenPlan({
        personaText: existingDraft || lockedCore || inspiration,
        mainCharContext: opts.charContext,
        mainSelectedWorldEntries: opts.charContext?.selectedWorldEntries,
        companions,
        maxContextTokens: opts.maxContextTokens,
      });
    const compBlock = formatCompanionPromptBlock(companions, companionPlans);
    if (compBlock) {
      taskParts.push(compBlock);
    }
  }

  if (effectiveDualLayer && !emittedWorldbookSlot) {
    taskParts.push(scheme.syncedOverrides?.dualLayer || buildDualLayerDirective(scheme, opts.worldbookLightMode));
  }

  if (useDraftAudit && !emittedDraftAuditSlot) {
    messages.push({
      role: 'system',
      content: scheme.syncedOverrides?.draftAudit || buildDraftAuditInstruction(scheme, {
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

export function buildSyncedPreferenceEntries({ scheme, ui = {} } = {}) {
  const safeScheme = sanitizeScheme(scheme || BUILTIN_PRESET_SCHEMES.longform_coact);
  const uiCfg = ui && typeof ui === 'object' ? ui : {};
  const backstoryMode = VALID_BACKSTORY_MODES.has(uiCfg.backstoryMode) ? uiCfg.backstoryMode : 'light_vibe';
  const spotlightMode = VALID_SPOTLIGHT_MODES.has(uiCfg.spotlightMode) ? uiCfg.spotlightMode : 'balanced';
  const sectionsCfg = normalizeGenerationSectionsConfig(uiCfg.generationSections);
  const ratios = normalizeModuleRatios(uiCfg.moduleRatios);
  const lightMode = VALID_WORLDBOOK_LIGHT_MODES.has(uiCfg.worldbookLightMode)
    ? uiCfg.worldbookLightMode
    : 'green_selective';

  const sectionParts = [
    buildBackstoryDirective(backstoryMode),
    buildSpotlightDirective(spotlightMode),
    buildGenerationSectionDirective(sectionsCfg, { backstoryMode }),
  ].filter(Boolean);

  if (ratios.mode === 'custom' || ratios.private > 0) {
    const rp = [
      `外貌气质约 ${ratios.appearance}%`,
      `性格习惯约 ${ratios.personality}%`,
      `过往经历约 ${ratios.backstory}%`,
      `当前背景与关系约 ${ratios.relationship}%`,
    ];
    if (ratios.private > 0) rp.push(`私密心事或暗线约 ${ratios.private}%`);
    sectionParts.push(`【人设构成占比指导】\n请按以下篇幅比重分配各维度细节：${rp.join('，')}。`);
  }
  if (uiCfg.pureCrossCardReuse) {
    sectionParts.push(
      `【纯通用跨卡复用】\n保持${CORE_SECTION_HEADER}独立通用，剥离特定角色绑定，仅在${SHELL_SECTION_HEADER}衔接当前角色卡。`
    );
  }

  return [
    {
      id: 'ups_synced_sections',
      key: 'generationSections',
      name: '生成板块与经历尺度',
      role: 'system',
      enabled: true,
      toggleable: false,
      content: sectionParts.join('\n\n'),
    },
    {
      id: 'ups_synced_worldbook',
      key: 'dualLayer',
      name: `补充世界书拆分规范（${
        WORLDBOOK_LIGHT_MODES.find((m) => m.id === lightMode)?.shortLabel || '聊到时补充'
      }）`,
      role: 'system',
      enabled: Boolean(uiCfg.dualLayer),
      toggleable: true,
      content: buildDualLayerDirective(safeScheme, lightMode),
    },
    {
      id: 'ups_draft_audit',
      key: 'draftAudit',
      name: '成稿前草稿自检',
      role: 'system',
      enabled: uiCfg.draftAudit !== false,
      toggleable: true,
      content: buildDraftAuditInstruction(safeScheme, {
        backstoryMode,
        spotlightMode,
      }),
    },
  ].map((entry) => {
    const override = safeScheme.syncedOverrides?.[entry.key];
    return override ? { ...entry, content: override, overridden: true } : entry;
  });
}

export function exportSillyTavernPreset(options = {}) {
  const opts = options && typeof options === 'object' ? options : {};
  const scheme = sanitizeScheme(opts.scheme || BUILTIN_PRESET_SCHEMES.longform_coact);
  const tasteProfile = opts.tasteProfile && typeof opts.tasteProfile === 'object' ? opts.tasteProfile : {};
  const includeTaste = opts.includeTaste !== false;
  const includeUsageGuide = opts.includeUsageGuide !== false;
  const includeSyncedOptions = Boolean(opts.uiPreferences && typeof opts.uiPreferences === 'object');
  const schemeDraftAuditEntry = scheme.entries.find((e) => e.slotType === 'draft_audit');
  const effectiveIncludeDraftAudit =
    opts.includeDraftAudit !== undefined
      ? Boolean(opts.includeDraftAudit)
      : includeSyncedOptions && opts.uiPreferences.draftAudit !== undefined
        ? Boolean(opts.uiPreferences.draftAudit)
        : schemeDraftAuditEntry
          ? Boolean(schemeDraftAuditEntry.enabled)
          : false;
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
    'ups_synced_sections',
    'ups_synced_worldbook',
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

  const exportUiContext = includeSyncedOptions
    ? {
        ...opts.uiPreferences,
        generationSections: opts.uiPreferences.generationSections || {},
        dualLayer: Boolean(opts.uiPreferences.dualLayer),
        worldbookLightMode: opts.uiPreferences.worldbookLightMode || 'green_selective',
      }
    : null;
  let exportedWorldbookSlot = false;
  let exportedDraftAuditSlot = false;
  let exportedFormatSlot = false;

  for (const entry of scheme.entries) {
    if (entry.slotType === 'worldbook' && scheme.syncedOverrides?.dualLayer && exportedWorldbookSlot) continue;
    if (entry.slotType === 'draft_audit' && scheme.syncedOverrides?.draftAudit && exportedDraftAuditSlot) continue;
    let identifier;
    if (entry.slotType === 'worldbook' && !usedIds.has('ups_synced_worldbook')) {
      identifier = 'ups_synced_worldbook';
    } else if (entry.slotType === 'draft_audit' && !usedIds.has('ups_draft_audit')) {
      identifier = 'ups_draft_audit';
    } else {
      const baseIdentifier = `ups_${sanitizePromptIdentifier(entry.id)}`;
      identifier = baseIdentifier;
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
    }
    usedIds.add(identifier);

    let effectiveEnabled = Boolean(entry.enabled);
    if (entry.slotType === 'worldbook') {
      exportedWorldbookSlot = true;
      if (includeSyncedOptions) effectiveEnabled = Boolean(opts.uiPreferences.dualLayer);
    } else if (entry.slotType === 'draft_audit') {
      exportedDraftAuditSlot = true;
      effectiveEnabled = effectiveIncludeDraftAudit;
    } else if (entry.slotType === 'format') {
      exportedFormatSlot = true;
    }

    const content = resolveSlotContent(entry, scheme, tasteProfile, includeTaste, exportUiContext);
    prompts.push(
      makeCustomPromptEntry({
        identifier,
        name: entry.name,
        role: entry.role,
        content,
      })
    );
    order.push({ identifier, enabled: effectiveEnabled });
  }

  if (includeSyncedOptions || scheme.syncedOverrides?.generationSections) {
    const syncedEntries = buildSyncedPreferenceEntries({
      scheme,
      ui: opts.uiPreferences,
    });
    for (const sEntry of syncedEntries) {
      if (sEntry.id === 'ups_draft_audit') continue;
      if (!includeSyncedOptions && sEntry.id !== 'ups_synced_sections') continue;
      if (sEntry.id === 'ups_synced_worldbook' && exportedWorldbookSlot) continue;
      if (sEntry.id === 'ups_synced_sections' && exportedFormatSlot && !sEntry.overridden) continue;
      usedIds.add(sEntry.id);
      prompts.push(
        makeCustomPromptEntry({
          identifier: sEntry.id,
          name: sEntry.name,
          role: 'system',
          content: sEntry.content,
        })
      );
      order.push({ identifier: sEntry.id, enabled: Boolean(sEntry.enabled) });
    }
  }

  if (effectiveIncludeDraftAudit && !exportedDraftAuditSlot) {
    const auditId = 'ups_draft_audit';
    usedIds.add(auditId);
    prompts.push(
      makeCustomPromptEntry({
        identifier: auditId,
        name: '成稿前草稿自检',
        role: 'system',
        content: scheme.syncedOverrides?.draftAudit || buildDraftAuditInstruction(scheme, opts.uiPreferences || {}),
      })
    );
    order.push({ identifier: auditId, enabled: true });
  }

  order.push({ identifier: 'chatHistory', enabled: true });

  const basePrefill = String(scheme.prefillText ?? '').trimEnd() || DEFAULT_PREFILL.trimEnd();
  const prefillContent =
    effectiveIncludeDraftAudit &&
    scheme.tailMode === 'assistant_prefill' &&
    (basePrefill === CORE_SECTION_HEADER || basePrefill === DEFAULT_PREFILL.trimEnd())
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
        includeDraftAudit: effectiveIncludeDraftAudit,
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
        suggestion: '请删去系统说教口号；若有未公开的心事或秘密直接用平实中文说明（如“此事平时未向外人提起”），涉及情感暗流、秘密隐瞒或阵营信息差时可按需开启可见度标注。',
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

  // 5. Nested indentation or non-whitelisted XML/HTML residual tags
  const ALLOWED_PERSONA_TAGS = new Set(['user', 'char', 'user_supplement']);
  const nestedHits = [];
  lines.forEach((line, idx) => {
    const indentHit = /^[ \t]{2,}[-*+]\s+\S|^[ \t]{4,}\S/.test(line);
    let nonAllowedTagMatch = '';
    const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9_-]*)(?:\s[^>\n]{0,80})?>/g;
    let m;
    while ((m = tagRe.exec(line)) !== null) {
      if (!ALLOWED_PERSONA_TAGS.has(m[1].toLowerCase())) {
        nonAllowedTagMatch = m[0];
        break;
      }
    }
    if (indentHit || nonAllowedTagMatch) {
      nestedHits.push({
        line: idx + 1,
        match: nonAllowedTagMatch || line.trim(),
      });
    }
  });
  if (nestedHits.length > 0) {
    issues.push({
      type: 'nested_indent',
      severity: 'warn',
      noBanAction: true,
      term: nestedHits[0].match,
      match: nestedHits[0].match,
      line: nestedHits[0].line,
      count: nestedHits.length,
      message:
        nestedHits.length > 1
          ? `存在 ${nestedHits.length} 处嵌套缩进或残余标签，可能破坏扁平排版结构`
          : '存在嵌套缩进或残余标签，可能破坏扁平排版结构',
      suggestion: '可使用「扁平排版整理」清理缩进与标签。',
    });
  }

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
      message: `发现 ${dashMatches.length} 处破折号，可改用逗号或冒号`,
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
      suggestion: '涉及情感暗流、隐瞒秘密或阵营信息差时，可按需补充标记区分公开表象与私密内心，避免被轻易读心看穿。',
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
  if (NSFW_INTIMATE_RE.test(sec) || NSFW_INTIMATE_RE.test(lineKey)) {
    return { category: 'NSFW / 亲密设定', keepByDefault: true };
  }
  if (
    /(?:当前身份|当前背景|当前处境|目前处境|当前状态|剧场壳|开场|与.*关系|居住地|当前住址|住址|职业或身份|当前职业|职业与经济|关系网|亲友|父母|兄弟姐妹|朋友|前任|重要伙伴)/i.test(
      sec
    )
  ) {
    return { category: '当前身份与关系', keepByDefault: false };
  }
  if (/(?:外貌|体貌|面容|穿搭|衣着|外表|身体特征|身高体型|声音\/气味|appearance)/i.test(sec)) {
    return { category: '外貌与印象', keepByDefault: true };
  }
  if (/(?:生活习惯|生活与做事习惯|习惯与喜好|喜好|偏好|饮食|作息|爱好|preferences|hobby)/i.test(sec)) {
    return { category: '习惯与喜好', keepByDefault: true };
  }
  if (/(?:成长经历|过往|经历|背景|技能|特长|能力|术式|体质|background|history|technique)/i.test(sec)) {
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
  if (NSFW_INTIMATE_RE.test(combined)) {
    return { category: 'NSFW / 亲密设定', keepByDefault: true };
  }
  if (
    /(?:外貌|体貌|面容|脸型|五官|眉|眼|瞳|鼻|唇|肤色|发色|头发|发型|身高|体重|体型|身材|体态|身体|腿|手|疤|痣|耳饰|穿衣|穿搭|穿着|衣着|声线|声音|外表|气质|appearance|hair|skin|eyes|nose|lips|face|build|height|weight)/i.test(
      combined
    )
  ) {
    return { category: '外貌与印象', keepByDefault: true };
  }
  if (
    /(?:喜好|偏好|偏爱|爱好|生活习惯|饮食|食物|忌口|过敏|作息|睡眠|熬夜|厌恶|讨厌|爱吃|不吃|习惯|日常|food|preferences|hobby)/i.test(
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

export function groupPersonaPoints(points = []) {
  const list = Array.isArray(points) ? points : [];
  const buckets = new Map();
  for (const cat of CANONICAL_POINT_CATEGORIES) {
    buckets.set(cat, []);
  }
  const extraCategories = [];

  for (const pt of list) {
    if (!pt || typeof pt !== 'object') continue;
    const category = String(pt.category ?? '').trim() || '其他';
    if (!buckets.has(category)) {
      buckets.set(category, []);
      extraCategories.push(category);
    }
    buckets.get(category).push(pt);
  }

  const orderedCats = [...CANONICAL_POINT_CATEGORIES, ...extraCategories];
  const groups = [];
  for (const category of orderedCats) {
    const items = buckets.get(category);
    if (items && items.length > 0) {
      groups.push({ category, items });
    }
  }
  return groups;
}

export function splitDualLayerOutput(text, options = {}) {
  const opts = options && typeof options === 'object' ? options : {};
  const defaultLight = VALID_WORLDBOOK_LIGHT_MODES.has(opts.worldbookLightMode)
    ? opts.worldbookLightMode
    : 'green_selective';
  const placement = normalizeWorldbookPlacement(opts.worldbookPlacement || opts);
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
  const keptInPersona = [];
  const ownershipLine = '【以下为 {{user}} 的个人补充设定（非 {{char}} 设定）】';
  let current = null;
  let readingContent = false;

  const flush = () => {
    if (!current) return;
    const rawContent = current.contentLines.join('\n').trim();
    const rawComment = current.comment.trim() || current.key[0] || '补充背景';
    if (rawContent) {
      const isBlueConstant =
        defaultLight === 'blue_constant' || (defaultLight === 'smart_mix' && current.parsedLight === 'blue');
      if (!isBlueConstant && current.key.length === 0) {
        const body = rawContent.startsWith(ownershipLine) ? rawContent.slice(ownershipLine.length).trim() : rawContent;
        if (body) keptInPersona.push(`## ${rawComment}\n${body}`);
      } else {
        const comment = /\{\{user\}\}/.test(rawComment) ? rawComment : `【{{user}}补充设定】${rawComment}`;
        entries.push({
          key: current.key,
          comment,
          content: ensureUserWorldbookAttribution(rawContent, ownershipLine),
          constant: isBlueConstant,
          selective: !isBlueConstant,
          position: placement.position,
          order: clampInt(placement.order + entries.length, 0, 10000, DEFAULT_USER_WORLDBOOK_PLACEMENT.order),
          ...(placement.position === WORLD_INFO_POSITION.AT_DEPTH
            ? { depth: placement.depth, role: placement.role }
            : {}),
        });
      }
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
      const rawTitle = (headerBracketMatch?.[1] || headerHashMatch?.[1] || headerPrefixMatch?.[1] || '').trim();
      const lightSuffix = /(?:^|[\s（(【\[])\s*(蓝灯常驻|绿灯触发|蓝灯|绿灯)\s*[）)】\]]?$/u.exec(rawTitle);
      const parsedLight = lightSuffix?.[1].startsWith('蓝灯') ? 'blue' : '';
      const cleanTitle = lightSuffix ? rawTitle.slice(0, lightSuffix.index).trim() : rawTitle;
      current = { comment: cleanTitle || rawTitle, key: [], contentLines: [], parsedLight };
      continue;
    }

    if (!current) {
      if (!line) continue;
      current = { comment: '', key: [], contentLines: [], parsedLight: '' };
    }

    const triggerModeMatch = line.match(/^(?:触发方式|灯色|状态)[:：]\s*(.+)$/);
    if (triggerModeMatch && !readingContent) {
      const modeVal = triggerModeMatch[1].trim();
      current.parsedLight = /^(?:蓝灯(?:常驻)?|常驻(?:生效)?|constant)$/i.test(modeVal) ? 'blue' : 'green';
      continue;
    }

    const kwMatch = line.match(/^关键词[:：]\s*(.*)$/);
    if (kwMatch && !readingContent) {
      const placeholder = /^(?:\{\{\s*(?:user|char)\s*\}\}|(?:关键词|核心标签)\s*\d+|无|无关键词)$/iu;
      const keywords = kwMatch[1]
        .split(/[,，/|、；;]/)
        .map((k) => k.trim())
        .filter((k) => k && !placeholder.test(k));
      current.key = [...new Set(keywords)];
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
  if (keptInPersona.length > 0) {
    return {
      coreDescription: [coreDescription, ...keptInPersona].filter(Boolean).join('\n\n'),
      worldbookEntries: entries,
      keptInPersonaCount: keptInPersona.length,
    };
  }
  return { coreDescription, worldbookEntries: entries };
}

export function mergeDuplicatePersonaSections(text) {
  const normalized = String(text ?? '').replace(/\r\n?/g, '\n');
  if (!normalized.trim()) return '';

  const dividerRegex =
    /^(?:【补充世界书条目】|【延展背景世界书】|={3,}\s*WORLDBOOK\s*={3,}|#{1,3}\s*(?:补充世界书条目|延展背景世界书))\s*$/im;
  const dividerMatch = dividerRegex.exec(normalized);
  const bodyRaw = dividerMatch ? normalized.slice(0, dividerMatch.index).trimEnd() : normalized.trimEnd();
  const wbTail = dividerMatch ? normalized.slice(dividerMatch.index).trim() : '';

  if (!bodyRaw.trim()) {
    return wbTail;
  }

  const normalizeHeadingKey = (rawTitle) =>
    String(rawTitle ?? '')
      .replace(/^[【#\s]+|[】\s:：]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

  const dedupSectionLines = (lines) => {
    const trimmedLines = [...lines];
    while (trimmedLines.length > 0 && !trimmedLines[0].trim()) trimmedLines.shift();
    while (trimmedLines.length > 0 && !trimmedLines[trimmedLines.length - 1].trim()) trimmedLines.pop();
    const seen = new Set();
    const out = [];
    let prevBlank = false;
    for (const rawLine of trimmedLines) {
      const trimmed = rawLine.trim();
      if (!trimmed) {
        if (!prevBlank) {
          out.push('');
          prevBlank = true;
        }
        continue;
      }
      const normKey = trimmed
        .replace(/^\s*(?:[-*+•]|\d+[.、)])\s*/, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (normKey && seen.has(normKey)) {
        continue;
      }
      if (normKey) seen.add(normKey);
      out.push(rawLine.trimEnd());
      prevBlank = false;
    }
    return out;
  };

  const preambleTop = {
    key: '__preamble__',
    rawHeading: '',
    directLines: [],
    subSections: [],
    subMap: new Map(),
  };
  const topGroups = [preambleTop];
  const topMap = new Map([['__preamble__', preambleTop]]);

  let activeTop = preambleTop;
  let activeSub = null;

  for (const line of bodyRaw.split('\n')) {
    const trimmed = line.trim();
    const boxMatch = trimmed.match(/^【([^】]+)】\s*$/);
    const h1Match = !boxMatch ? trimmed.match(/^#\s+(.+?)\s*$/) : null;
    const subMatch = !boxMatch && !h1Match ? trimmed.match(/^(#{2,3})\s+(.+?)\s*$/) : null;

    if (boxMatch || h1Match) {
      const rawTitle = (boxMatch?.[1] || h1Match?.[1] || '').trim();
      const topKey = normalizeHeadingKey(rawTitle) || `__top_${topGroups.length}`;
      let group = topMap.get(topKey);
      if (!group) {
        group = {
          key: topKey,
          rawHeading: trimmed,
          directLines: [],
          subSections: [],
          subMap: new Map(),
        };
        topMap.set(topKey, group);
        topGroups.push(group);
      }
      activeTop = group;
      activeSub = null;
      continue;
    }

    if (subMatch) {
      const rawTitle = subMatch[2].trim();
      const subKey = normalizeHeadingKey(rawTitle) || `__sub_${activeTop.subSections.length}`;
      let sub = activeTop.subMap.get(subKey);
      if (!sub) {
        sub = {
          key: subKey,
          rawHeading: trimmed,
          lines: [],
        };
        activeTop.subMap.set(subKey, sub);
        activeTop.subSections.push(sub);
      }
      activeSub = sub;
      continue;
    }

    if (activeSub) {
      activeSub.lines.push(line);
    } else {
      activeTop.directLines.push(line);
    }
  }

  const outLines = [];
  for (const top of topGroups) {
    const direct = dedupSectionLines(top.directLines);
    const hasContent = Boolean(top.rawHeading) || direct.length > 0 || top.subSections.length > 0;
    if (!hasContent) continue;

    if (top.rawHeading) {
      if (outLines.length > 0 && outLines[outLines.length - 1] !== '') {
        outLines.push('');
      }
      outLines.push(top.rawHeading);
    }
    if (direct.length > 0) {
      outLines.push(...direct);
    }
    for (const sub of top.subSections) {
      const subLines = dedupSectionLines(sub.lines);
      if (outLines.length > 0 && outLines[outLines.length - 1] !== '' && subLines.length > 0 && top.rawHeading && direct.length > 0) {
        // Keep clean separation if directLines preceded subsection
      }
      outLines.push(sub.rawHeading);
      if (subLines.length > 0) {
        outLines.push(...subLines);
      }
    }
  }

  const mergedBody = outLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!wbTail) return mergedBody;
  return mergedBody ? `${mergedBody}\n\n${wbTail}` : wbTail;
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
        '你是一位帮玩家提炼写作审美与避雷规律的编辑助手。请把玩家零散标记的「喜欢的句子」和「不喜欢的词句及原因」，归纳成简明、直白的通用规则，供后续生成 User 人设时复用。',
        '重要要求：对于「不喜欢的句子与原因」，不要只复述孤立的原词原句！请重点诊断多条记录背后反映的同一个共性写作问题（例如：滥用“并非…而是…”等转折对比句式、喜欢在行为事实后面追加解释性语言剖析心理原因、空泛总结、替玩家抢话或堆砌形容词等），归纳为针对“句式结构与表达通病”的通用禁写规则。',
        '严格按以下两段纯文本格式输出，每条一行，以 "- " 开头，禁止写多余寒暄或解释：',
        '【归纳后的喜好偏好】',
        '- 简短直白的喜好规则（2～5 条，若无原记录则写“无”）',
        '',
        '【归纳后的避雷规则】',
        '- 简短直白的句式/表达避雷规则（2～6 条，若无原记录则写“无”）',
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

// ============================================================================
// H. Bounded Generation History Queue (Follow-up 2)
// ============================================================================

export function pushGenerationHistory(historyList = [], entry = {}, options = {}) {
  const maxItems = clampInt(options?.maxItems, 1, 50, MAX_GENERATION_HISTORY);
  const maxChars = clampInt(options?.maxChars, 200, 100000, MAX_HISTORY_ENTRY_CHARS);

  const normalizeExistingItem = (item) => {
    if (!item || typeof item !== 'object') return null;
    const raw = String(item.text ?? '').trim();
    if (!raw) return null;
    const capped = raw.length > maxChars ? raw.slice(0, maxChars) : raw;
    return {
      id: String(item.id || '').trim() || generateId('hist'),
      text: capped,
      timestamp: Number.isFinite(Number(item.timestamp)) ? Number(item.timestamp) : Date.now(),
      mode: String(item.mode || 'A').trim(),
      charName: String(item.charName || '').trim(),
      personaName: String(item.personaName || '').trim(),
      chars: Number.isFinite(Number(item.chars)) ? Number(item.chars) : countReadableChars(capped),
    };
  };

  const cleanExisting = (Array.isArray(historyList) ? historyList : [])
    .map(normalizeExistingItem)
    .filter(Boolean)
    .slice(0, maxItems);

  const rawText = String(typeof entry === 'string' ? entry : entry?.text ?? '').trim();
  if (!rawText) {
    return { list: cleanExisting, added: false };
  }

  const text = rawText.length > maxChars ? rawText.slice(0, maxChars) : rawText;
  if (cleanExisting.length > 0 && cleanExisting[0].text.trim() === text) {
    return { list: cleanExisting, added: false };
  }

  const dedupedOlder = cleanExisting.filter((item) => item.text.trim() !== text);
  const meta = entry && typeof entry === 'object' ? entry : {};
  const nextItem = {
    id: String(meta.id || '').trim() || generateId('hist'),
    text,
    timestamp: Number.isFinite(Number(meta.timestamp)) ? Number(meta.timestamp) : Date.now(),
    mode: String(meta.mode || 'A').trim(),
    charName: String(meta.charName || '').trim(),
    personaName: String(meta.personaName || '').trim(),
    chars: countReadableChars(text),
  };

  return {
    list: [nextItem, ...dedupedOlder].slice(0, maxItems),
    added: true,
  };
}
