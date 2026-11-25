// Pure ESM core engine for user-persona-studio.
// Strictly DOM-free and runtime-agnostic (runs identically in Node ESM and browser ESM).

import {
  CORE_SECTION_HEADER,
  SHELL_SECTION_HEADER,
  WORLDBOOK_DIVIDER,
  VISIBILITY_MARKERS,
  BUILTIN_USAGE_GUIDE,
  DEFAULT_BANNED_PHRASES,
  QUALITATIVE_LABEL_PATTERNS,
  BUILTIN_PRESET_SCHEMES,
} from './presets.js';

export {
  CORE_SECTION_HEADER,
  SHELL_SECTION_HEADER,
  WORLDBOOK_DIVIDER,
  VISIBILITY_MARKERS,
  BUILTIN_USAGE_GUIDE,
  DEFAULT_BANNED_PHRASES,
  QUALITATIVE_LABEL_PATTERNS,
  BUILTIN_PRESET_SCHEMES,
};

export const DEFAULT_PREFILL = `${CORE_SECTION_HEADER}\n## 基础档案\n-`;
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
const VALID_TAIL_MODES = new Set(['user', 'assistant_prefill', 'prefill_plus_user']);
const VALID_PALETTES = new Set(['paper', 'ink', 'warm', 'sakura', 'glass-dark', 'host']);
const VALID_COLOR_MODES = new Set(['auto', 'light', 'dark']);

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
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function clampInt(value, min, max, fallback) {
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

function validTailMode(tailMode, fallback = 'user') {
  return VALID_TAIL_MODES.has(tailMode) ? tailMode : fallback;
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

function sanitizeScheme(scheme, fallbackIndex = 0) {
  const raw = scheme && typeof scheme === 'object' ? scheme : {};
  const style = raw.style === 'objective' ? 'objective' : 'longform';
  const defaultTokens = style === 'objective' ? { min: 600, max: 1000 } : { min: 1500, max: 2800 };
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

  const minTokens = clampInt(raw.targetTokens?.min, 100, 16000, defaultTokens.min);
  const maxTokens = Math.max(
    minTokens,
    clampInt(raw.targetTokens?.max, 200, 32000, defaultTokens.max)
  );

  return {
    id: String(raw.id || '').trim() || generateId(`scheme_${fallbackIndex}`),
    name: String(raw.name || '').trim() || `未命名方案 ${fallbackIndex + 1}`,
    style,
    builtin: Boolean(raw.builtin),
    description: String(raw.description ?? ''),
    targetTokens: {
      min: minTokens,
      max: maxTokens,
    },
    tailMode: validTailMode(raw.tailMode, 'user'),
    prefillText: String(raw.prefillText ?? `${CORE_SECTION_HEADER}\n`),
    triggerText: String(raw.triggerText ?? DEFAULT_TRIGGER),
    temperature: clampNumber(raw.temperature, 0, 2, 0.78),
    maxTokens: clampInt(raw.maxTokens, 256, 32768, 3200),
    entries,
  };
}

// ============================================================================
// A. Settings & Sanitization
// ============================================================================

export function createDefaultSettings(overrides = {}) {
  const src = overrides && typeof overrides === 'object' ? overrides : {};
  const defaultSchemes = [
    deepClone(BUILTIN_PRESET_SCHEMES.longform_coact),
    deepClone(BUILTIN_PRESET_SCHEMES.player_controlled),
  ];

  let schemes = defaultSchemes;
  if (Array.isArray(src.schemes) && src.schemes.length > 0) {
    schemes = src.schemes.map((s, idx) => sanitizeScheme(s, idx));
    const hasLongform = schemes.some((s) => s.id === 'longform_coact');
    const hasObjective = schemes.some((s) => s.id === 'player_controlled');
    if (!hasLongform) schemes.unshift(deepClone(BUILTIN_PRESET_SCHEMES.longform_coact));
    if (!hasObjective) schemes.push(deepClone(BUILTIN_PRESET_SCHEMES.player_controlled));
  }

  const candidateActiveId = typeof src.activeSchemeId === 'string' ? src.activeSchemeId.trim() : '';
  const activeSchemeId = schemes.some((s) => s.id === candidateActiveId)
    ? candidateActiveId
    : schemes[0].id;

  const rawTaste = src.tasteProfile && typeof src.tasteProfile === 'object' ? src.tasteProfile : {};
  const anchors = mergeTasteEntries([], Array.isArray(rawTaste.anchors) ? rawTaste.anchors : []);
  const banned = mergeTasteEntries([], Array.isArray(rawTaste.banned) ? rawTaste.banned : []);

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
    },
    api: {
      provider: rawApi.provider === 'custom' ? 'custom' : 'host',
      activeProfileId,
      profiles,
    },
    ui: {
      showPersonaBtn: rawUi.showPersonaBtn !== false,
      showWandMenu: rawUi.showWandMenu !== false,
      geometry: {
        x: Number.isFinite(rawGeo.x) && rawGeo.x >= 0 ? rawGeo.x : 230,
        y: Number.isFinite(rawGeo.y) && rawGeo.y >= 0 ? rawGeo.y : 80,
        width: clampInt(rawGeo.width, 320, 1920, 820),
        height: clampInt(rawGeo.height, 360, 1440, 640),
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
// B. Preset Stack & Scheme CRUD
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
    });

    if (isArray) {
      return [...colCopy, cloned];
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
  });

  next.schemes = [...schemes, cloned];
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
      if (!target || target.builtin || target.id === 'longform_coact' || target.id === 'player_controlled' || colCopy.length <= 1) {
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
    if (!target || target.builtin || schemeId === 'longform_coact' || schemeId === 'player_controlled' || keys.length <= 1) {
      return colCopy;
    }
    delete colCopy[schemeId];
    return colCopy;
  }

  const next = deepClone(settingsOrCollection && typeof settingsOrCollection === 'object' ? settingsOrCollection : createDefaultSettings());
  const schemes = Array.isArray(next.schemes) ? next.schemes : [];
  const target = schemes.find((s) => s && s.id === schemeId);
  if (!target || target.builtin || schemes.length <= 1) {
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
// C. Prompt Assembly & Tail-Role Strategy
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

function resolveSlotContent(entry, scheme, tasteProfile = {}, includeTaste = true) {
  let content = String(entry.content ?? '')
    .replaceAll('{{targetMin}}', String(scheme.targetTokens?.min ?? 1500))
    .replaceAll('{{targetMax}}', String(scheme.targetTokens?.max ?? 2800));

  const anchors = includeTaste
    ? (Array.isArray(tasteProfile?.anchors) ? tasteProfile.anchors : [])
        .map(extractEntryText)
        .filter(Boolean)
    : [];

  const userBanned = includeTaste
    ? (Array.isArray(tasteProfile?.banned) ? tasteProfile.banned : [])
        .map(extractEntryText)
        .filter(Boolean)
    : [];

  const useBuiltinBanned = tasteProfile?.useBuiltinBanned !== false;

  if (entry.slotType === 'taste') {
    if (anchors.length > 0) {
      content += `\n\n【个人长期偏爱特质锚点】\n${anchors.map((a) => `- ${a}`).join('\n')}`;
    }
  } else if (entry.slotType === 'banned') {
    const blocks = [];
    if (useBuiltinBanned && DEFAULT_BANNED_PHRASES.length > 0) {
      blocks.push(`【常见人设腔禁写词库】\n${DEFAULT_BANNED_PHRASES.map((p) => `- ${p}`).join('\n')}`);
    }
    if (userBanned.length > 0) {
      blocks.push(`【个人额外拉黑写法】\n${userBanned.map((p) => `- ${p}`).join('\n')}`);
    }
    if (blocks.length > 0) {
      content += `\n\n${blocks.join('\n\n')}`;
    }
  }

  return content.trim();
}

function formatCharContextBlock(charContext) {
  if (!charContext || typeof charContext !== 'object') return '';
  const fields = [
    ['角色名称', charContext.name],
    ['角色简介', charContext.description],
    ['性格设定', charContext.personality],
    ['当前场景', charContext.scenario],
    ['开场白参考', charContext.firstMessage],
    ['世界观摘要', charContext.worldSummary],
  ];
  const lines = [];
  for (const [label, val] of fields) {
    const text = String(val ?? '').trim();
    if (text) {
      lines.push(`${label}：\n${text}`);
    }
  }
  if (lines.length === 0) return '';
  return [
    '【当前角色卡公开舞台参考】',
    '（仅用于对齐时代背景、基调与开场关系起点；不得抄袭角色卡私有秘密，也不要写系统说教词）',
    lines.join('\n\n'),
  ].join('\n');
}

function buildDualLayerDirective(scheme) {
  const isObjective = scheme?.style === 'objective';
  const mainRange = isObjective ? '450–700 tokens' : '800–1200 tokens';
  return [
    '【双层输出模式（已开启）】',
    `请将主档案正文精简至约 ${mainRange} 并置于上半部分；随后另起一行输出分隔标题 \`${WORLDBOOK_DIVIDER}\`，在分隔标题之下生成 2–4 条按关键词触发的补充背景世界书条目，严格使用以下扁平格式：`,
    '[条目：条目标题]',
    '关键词：关键词1, 关键词2',
    '内容：补充事实与触发边界说明。',
  ].join('\n');
}

export function buildGenerationMessages(options = {}) {
  const opts = options && typeof options === 'object' ? options : {};
  const scheme = sanitizeScheme(opts.scheme || BUILTIN_PRESET_SCHEMES.longform_coact);
  const { mode, subMode } = normalizeMode(opts.mode || 'create', opts.subMode);
  const tasteProfile = opts.tasteProfile && typeof opts.tasteProfile === 'object' ? opts.tasteProfile : {};

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
  const charBlock = formatCharContextBlock(opts.charContext);

  if (mode === 'create') {
    taskParts.push('【任务模式：新建直出 {{user}} 人设】');
    if (inspiration) {
      taskParts.push(`【玩家一句话灵感】\n${inspiration}`);
    } else if (!userMustHaves) {
      taskParts.push('【玩家灵感】\n请根据当前方案风格与舞台背景，构建一个细节扎实、逻辑自洽的 {{user}} 人物档案。');
    }
    if (userMustHaves) {
      taskParts.push(`【玩家必带偏好与核心要求】\n${userMustHaves}`);
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
        '【任务模式：无损去标签与排版重整】\n请完整保留原人设中的所有既定事实、经历细节与私人偏爱，绝不擅自删改核心设定；消除嵌套缩进与套话，把所有定性标签词改写为具体的成因、舒适基准、取舍顺序与亲疏弹性区间，并规范为两层扁平结构。',
      core_expand:
        `【任务模式：保核扩写丰满】\n请完整保留原人设骨架与既有事实，在当前方案篇幅预算（${scheme.targetTokens.min}–${scheme.targetTokens.max} tokens）内扩充感官与舒适基准线、价值取舍优先级、生活烟火气细节与反应张力空间。`,
      cross_card_adapt:
        `【任务模式：旧人设跨卡合理化改编】\n请完全锁死${CORE_SECTION_HEADER}中的底色、性情成因与生活习惯不作篡改，仅结合下方当前角色卡舞台背景重写${SHELL_SECTION_HEADER}，使人物身份、职责与开场关系自然融入新故事。`,
    };
    taskParts.push(directiveMap[subMode]);

    if (lockedCore) {
      taskParts.push(`【锁定的人物本体核（严禁改动）】\n${lockedCore}`);
    } else if (subMode === 'cross_card_adapt' && existingDraft) {
      const split = splitCoreAndShell(existingDraft);
      if (split.core) {
        taskParts.push(`【提取并锁定的人物本体核（严禁改动）】\n${split.core}`);
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

  if (opts.dualLayer && !targetSection) {
    taskParts.push(buildDualLayerDirective(scheme));
  }

  if (scheme.tailMode === 'user' && scheme.triggerText && scheme.triggerText.trim()) {
    taskParts.push(scheme.triggerText.trim());
  }

  messages.push({
    role: 'user',
    content: taskParts.join('\n\n'),
  });

  const finalMessages = applyTailRoleStrategy(messages, {
    tailMode: scheme.tailMode,
    prefillText: scheme.prefillText,
    triggerText: scheme.triggerText,
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
  const tailMode = validTailMode(opts.tailMode, 'user');
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
// D. SillyTavern Native Chat Completion Preset Exporter
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
  const reservedSystemIds = new Set(['ups_usage_guide', 'ups_tail_prefill', 'ups_tail_trigger']);
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

  order.push({ identifier: 'chatHistory', enabled: true });

  const prefillContent = String(scheme.prefillText ?? '').trimEnd() || DEFAULT_PREFILL.trimEnd();
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
    // 'user'
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
      },
    },
  };
}

// ============================================================================
// E. Post-Processing, Linting, Splitting & Diff / Local Regen
// ============================================================================

export function estimateTokens(text) {
  const str = String(text ?? '');
  if (!str.trim()) return 0;
  const cjkMatches = str.match(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af\uff00-\uffef]/g);
  const cjkCount = cjkMatches ? cjkMatches.length : 0;
  const nonCjkCount = Math.max(0, str.length - cjkCount);
  return Math.max(1, Math.round(cjkCount * 1.35 + nonCjkCount * 0.28));
}

export function normalizeFlatLayout(text) {
  let out = String(text ?? '').replace(/\r\n?/g, '\n').trim();
  if (!out) return '';

  // Unwrap outer fenced code blocks such as ```markdown / ```yaml / ```xml / ```
  const fenceMatch = out.match(/^```[a-zA-Z0-9_-]*\s*\n([\s\S]*?)\n```\s*$/);
  if (fenceMatch) {
    out = fenceMatch[1].trim();
  }

  // Strip simple XML-like wrapper tags while preserving square-bracket visibility markers
  out = out.replace(/<\/?([a-zA-Z][a-zA-Z0-9_-]*)(?:\s[^>]*)?>/g, (full, tagName) => {
    // Keep common angle placeholders if not HTML/XML wrappers? Strip XML wrappers cleanly.
    void tagName;
    return '';
  });

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

export function lintPersonaText(text, tasteProfile = {}) {
  const raw = String(text ?? '');
  const normalized = raw.replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');
  const issues = [];

  const findLineNumber = (index) => {
    if (index < 0) return 0;
    return normalized.slice(0, index).split('\n').length;
  };

  // 1. Qualitative labels
  for (const item of QUALITATIVE_LABEL_PATTERNS) {
    const regex = new RegExp(item.pattern.source, item.pattern.flags.includes('g') ? item.pattern.flags : `${item.pattern.flags}g`);
    let m;
    while ((m = regex.exec(normalized)) !== null) {
      issues.push({
        type: 'qualitative_label',
        severity: 'error',
        label: item.label,
        term: item.label,
        category: item.category,
        match: m[0],
        index: m.index,
        line: findLineNumber(m.index),
        message: `出现定性标签词「${item.label}」（${item.category}）`,
        suggestion: item.hint,
      });
    }
  }

  // 2. Built-in clichés & user blacklist
  const useBuiltinBanned = tasteProfile?.useBuiltinBanned !== false;
  if (useBuiltinBanned) {
    for (const phrase of DEFAULT_BANNED_PHRASES) {
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
        suggestion: '请删去说教口号，改用 [外显可感知] / [既有共识 / 开场起点] / [未公开私事 / 旁人无从知晓] 标识信息边界。',
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
        suggestion: '建议改为平时的舒适基准与何种临界条件下才会打破常态的弹性区间。',
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

  // 6. Structural headers & visibility markers (advisory only; keep issues clean for markerless factual prose)
  const hasCoreShell =
    normalized.includes('人物本体核') && normalized.includes('当前剧场壳');
  const hasVisibilityMarkers =
    normalized.includes('[外显可感知]') ||
    normalized.includes('[既有共识') ||
    normalized.includes('[未公开私事');

  const advisories = [];
  if (!hasVisibilityMarkers && normalized.trim().length > 0) {
    advisories.push({
      type: 'missing_visibility_marker',
      severity: 'info',
      term: '',
      match: '',
      line: 0,
      message: '尚未检测到信息可见性标识（如 [外显可感知]、[未公开私事 / 旁人无从知晓]）',
      suggestion: '补充可见性标识有助于区分公开表象与未公开私事，无需写系统禁止口号。',
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
      if (/(?:人物本体核|本体核)/.test(trimmed)) {
        active = 'core';
      } else if (/(?:当前剧场壳|剧场壳)/.test(trimmed)) {
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

export function splitDualLayerOutput(text) {
  const normalized = String(text ?? '').replace(/\r\n?/g, '\n').trim();
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
  let cleanBody = String(newContent ?? '').replace(/\r\n?/g, '\n').trim();
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
      if (note && !result[existingIdx].note) {
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
