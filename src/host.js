// Browser/Node-testable SillyTavern & TauriTavern host adapter for user-persona-studio.
// Supports clean DI via `deps` and `globalThis.__UPS_HOST_BRIDGE__` plus multi-depth lazy imports.

import {
  classifyWorldbookEntry,
  createDefaultSettings,
  deepClone,
  detectMultiCharacterCard,
  estimateTokens,
  isNoiseWorldbookEntry,
  resolveCharacterRealName,
} from './core.js';

export const EXTENSION_SETTINGS_KEY = 'user_persona_studio';

export const HOST_CUSTOM_EVENTS = Object.freeze({
  PERSONA_SAVED: 'ups:persona-saved',
});

// Valid 1x1 transparent PNG fallback (ensures valid PNG magic bytes on ST & TauriTavern)
const FALLBACK_PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
  0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
  0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

const moduleCache = new Map();

export function _resetHostCacheForTests() {
  moduleCache.clear();
}

function getBridge() {
  return globalThis.__UPS_HOST_BRIDGE__ && typeof globalThis.__UPS_HOST_BRIDGE__ === 'object'
    ? globalThis.__UPS_HOST_BRIDGE__
    : null;
}

export const LIVE_PERSONA_AVATAR_ID = '__live_persona__';

export function buildImportCandidates(relToScripts, isRootScript = false) {
  const absPath = isRootScript ? `/${relToScripts}` : `/scripts/${relToScripts}`;
  const candidates = isRootScript
    ? [
        `../../../../../${relToScripts}`,
        `../../../../${relToScripts}`,
        `../../../${relToScripts}`,
        absPath,
      ]
    : [
        `../../../../${relToScripts}`,
        `../../../${relToScripts}`,
        `../../../../../${relToScripts}`,
        absPath,
      ];

  try {
    const href = globalThis.location?.href;
    if (href && /^[a-z][a-z0-9+.-]*:/i.test(href) && !/^file:/i.test(href)) {
      const resolved = new URL(absPath, href).href;
      if (!candidates.includes(resolved)) {
        candidates.push(resolved);
      }
    }
  } catch {
    // Ignore invalid location in non-browser runtimes
  }
  return candidates;
}

async function importFirstAvailable(cacheKey, candidates, deps = {}) {
  if (deps?.skipDynamicImport === true) {
    return null;
  }
  if (moduleCache.has(cacheKey)) {
    return moduleCache.get(cacheKey);
  }
  const loaderPromise = (async () => {
    for (const specifier of candidates) {
      try {
        const mod = await import(specifier);
        if (mod) return mod;
      } catch {
        // Try next candidate path depth
      }
    }
    return null;
  })();
  moduleCache.set(cacheKey, loaderPromise);
  return loaderPromise;
}

async function loadHostModules(needed = {}, deps = {}) {
  const bridge = getBridge();
  const skip = deps?.skipDynamicImport === true;

  const mods = {
    stContext: null,
    extensions: null,
    powerUser: null,
    personas: null,
    worldInfo: null,
    script: null,
  };

  if (skip) return mods;

  const tasks = [];
  if (needed.stContext && !deps?.context && !bridge?.context && !globalThis.SillyTavern?.getContext) {
    tasks.push(
      importFirstAvailable('st-context', buildImportCandidates('st-context.js'), deps).then((m) => {
        mods.stContext = m;
      })
    );
  }
  if (needed.extensions && !deps?.extensionSettings && !deps?.extension_settings && !bridge?.extensionSettings) {
    tasks.push(
      importFirstAvailable('extensions', buildImportCandidates('extensions.js'), deps).then((m) => {
        mods.extensions = m;
      })
    );
  }
  const immediateCtx = deps?.context ?? deps?.ctx ?? bridge?.context ?? null;
  if (needed.powerUser && !hasImmediatePowerUser(deps, bridge, immediateCtx)) {
    tasks.push(
      importFirstAvailable('power-user', buildImportCandidates('power-user.js'), deps).then((m) => {
        mods.powerUser = m;
      })
    );
  }
  if (needed.personas) {
    tasks.push(
      importFirstAvailable('personas', buildImportCandidates('personas.js'), deps).then((m) => {
        mods.personas = m;
      })
    );
  }
  if (needed.worldInfo) {
    tasks.push(
      importFirstAvailable('world-info', buildImportCandidates('world-info.js'), deps).then((m) => {
        mods.worldInfo = m;
      })
    );
  }
  if (needed.script) {
    tasks.push(
      importFirstAvailable('script', buildImportCandidates('script.js', true), deps).then((m) => {
        mods.script = m;
      })
    );
  }

  if (tasks.length > 0) {
    await Promise.all(tasks);
  }
  return mods;
}

export function getHostContext(deps = {}) {
  const bridge = getBridge();
  if (deps?.context !== undefined) return deps.context;
  if (deps?.ctx !== undefined) return deps.ctx;
  if (bridge?.context !== undefined) return bridge.context;
  if (typeof bridge?.getContext === 'function') return bridge.getContext();
  if (typeof globalThis.SillyTavern?.getContext === 'function') {
    return globalThis.SillyTavern.getContext();
  }
  return null;
}

export async function resolveHostContext(deps = {}) {
  const immediate = getHostContext(deps);
  if (immediate) return immediate;

  const mods = await loadHostModules({ stContext: true }, deps);
  if (typeof mods.stContext?.getContext === 'function') {
    return mods.stContext.getContext();
  }
  return getHostContext(deps);
}

export async function getHostRequestHeaders(options = {}, deps = {}) {
  const bridge = getBridge();
  const ctx = await resolveHostContext(deps);

  const directFn =
    deps?.getRequestHeaders ??
    bridge?.getRequestHeaders ??
    ctx?.getRequestHeaders ??
    null;

  if (typeof directFn === 'function') {
    return directFn(options);
  }

  const mods = await loadHostModules({ script: true }, deps);
  if (typeof mods.script?.getRequestHeaders === 'function') {
    return mods.script.getRequestHeaders(options);
  }

  return options?.omitContentType ? {} : { 'Content-Type': 'application/json' };
}

function resolveExtensionSettingsContainer(deps, bridge, ctx, extensionsMod) {
  return (
    deps?.extensionSettings ??
    deps?.extension_settings ??
    bridge?.extensionSettings ??
    bridge?.extension_settings ??
    ctx?.extensionSettings ??
    extensionsMod?.extension_settings ??
    globalThis.extension_settings ??
    null
  );
}

function hasFiniteNumber(val) {
  return (
    typeof val !== 'boolean' &&
    val !== null &&
    val !== undefined &&
    String(val).trim() !== '' &&
    Number.isFinite(Number(val))
  );
}

function hasImmediatePowerUser(deps, bridge, ctx) {
  return Boolean(
    deps?.powerUser ||
      deps?.power_user ||
      deps?.powerUserSettings ||
      bridge?.powerUser ||
      bridge?.power_user ||
      bridge?.powerUserSettings ||
      ctx?.powerUserSettings ||
      ctx?.powerUser ||
      globalThis.power_user
  );
}

function resolvePowerUser(deps, bridge, ctx, powerUserMod) {
  return (
    deps?.powerUser ??
    deps?.power_user ??
    deps?.powerUserSettings ??
    bridge?.powerUser ??
    bridge?.power_user ??
    bridge?.powerUserSettings ??
    ctx?.powerUserSettings ??
    ctx?.powerUser ??
    powerUserMod?.power_user ??
    globalThis.power_user ??
    null
  );
}

function resolveHostDocument(deps = {}) {
  if (deps && Object.hasOwn(deps, 'document')) {
    return deps.document || null;
  }
  return typeof document !== 'undefined' ? document : null;
}

function readLiveDomPersona(deps = {}) {
  const doc = resolveHostDocument(deps);
  if (!doc) {
    return { doc: null, descEl: null, description: '', name: '' };
  }
  const descEl =
    doc.querySelector?.('#persona_description') ??
    doc.getElementById?.('persona_description') ??
    null;
  const nameEl =
    doc.querySelector?.('#your_name') ??
    doc.getElementById?.('your_name') ??
    null;
  const description =
    descEl && descEl.value !== undefined && descEl.value !== null
      ? String(descEl.value)
      : '';
  const name = nameEl ? String(nameEl.textContent || nameEl.value || '').trim() : '';
  return { doc, descEl, description, name };
}

function resolveActiveAvatarId(deps, bridge, ctx, personasMod, powerUser = null, doc = null) {
  if (typeof deps?.getUserAvatar === 'function') {
    const v = String(deps.getUserAvatar() ?? '').trim();
    if (v) return v;
  }
  if (deps?.userAvatar !== undefined) {
    const v = String(deps.userAvatar ?? '').trim();
    if (v) return v;
  }
  if (typeof bridge?.getUserAvatar === 'function') {
    const v = String(bridge.getUserAvatar() ?? '').trim();
    if (v) return v;
  }
  if (bridge?.userAvatar !== undefined) {
    const v = String(bridge.userAvatar ?? '').trim();
    if (v) return v;
  }
  if (ctx?.userAvatar !== undefined) {
    const v = String(ctx.userAvatar ?? '').trim();
    if (v) return v;
  }
  if (personasMod?.user_avatar !== undefined) {
    const v = String(personasMod.user_avatar ?? '').trim();
    if (v) return v;
  }

  const selectedEl = doc?.querySelector?.(
    '#user_avatar_block .avatar-container.selected, #user_avatar_block .avatar.selected'
  );
  if (selectedEl) {
    const domAvatarId = String(
      selectedEl.getAttribute?.('data-avatar-id') ??
        selectedEl.dataset?.avatarId ??
        selectedEl.querySelector?.('[data-avatar-id]')?.getAttribute?.('data-avatar-id') ??
        ''
    ).trim();
    if (domAvatarId) return domAvatarId;
  }

  const personasMap =
    powerUser?.personas && typeof powerUser.personas === 'object' ? powerUser.personas : null;
  const descriptionsMap =
    powerUser?.persona_descriptions && typeof powerUser.persona_descriptions === 'object'
      ? powerUser.persona_descriptions
      : null;

  const liveDescTrimmed = String(powerUser?.persona_description ?? '').trim();
  if (liveDescTrimmed && descriptionsMap) {
    const activeNameTrimmed = String(ctx?.name1 ?? '').trim();
    let firstMatchId = '';
    for (const id of Object.keys(descriptionsMap)) {
      const cleanId = String(id ?? '').trim();
      if (!cleanId || !Object.hasOwn(descriptionsMap, id)) continue;
      const item = descriptionsMap[id];
      if (!item || typeof item !== 'object') continue;
      const itemDesc = String(item.description ?? '').trim();
      if (itemDesc && itemDesc === liveDescTrimmed) {
        if (!firstMatchId) firstMatchId = cleanId;
        if (
          activeNameTrimmed &&
          personasMap &&
          Object.hasOwn(personasMap, id) &&
          String(personasMap[id] ?? '').trim() === activeNameTrimmed
        ) {
          return cleanId;
        }
      }
    }
    if (firstMatchId) return firstMatchId;
  }

  const defaultPersona = String(powerUser?.default_persona ?? '').trim();
  if (
    defaultPersona &&
    ((personasMap && Object.hasOwn(personasMap, defaultPersona)) ||
      (descriptionsMap && Object.hasOwn(descriptionsMap, defaultPersona)))
  ) {
    return defaultPersona;
  }

  return '';
}

function buildLivePersonaRecord(powerUser, ctx, liveDom) {
  const fallbackDesc = String(powerUser?.persona_description || liveDom?.description || '');
  const fallbackName = String(ctx?.name1 || liveDom?.name || '').trim();
  return {
    avatarId: LIVE_PERSONA_AVATAR_ID,
    name: fallbackName || '当前人设',
    description: fallbackDesc,
    title: '',
    lorebook: String(powerUser?.persona_description_lorebook ?? ''),
    position: hasFiniteNumber(powerUser?.persona_description_position)
      ? Number(powerUser.persona_description_position)
      : 0,
    depth: hasFiniteNumber(powerUser?.persona_description_depth)
      ? Number(powerUser.persona_description_depth)
      : 2,
    role: hasFiniteNumber(powerUser?.persona_description_role)
      ? Number(powerUser.persona_description_role)
      : 0,
    connections: [],
    isDefault: false,
    isActive: true,
  };
}

function buildPersonaRecord(avatarId, personasMap, descriptionsMap, powerUser, activeAvatarId, ctx) {
  const desc =
    descriptionsMap &&
    typeof descriptionsMap === 'object' &&
    Object.hasOwn(descriptionsMap, avatarId) &&
    descriptionsMap[avatarId] &&
    typeof descriptionsMap[avatarId] === 'object'
      ? descriptionsMap[avatarId]
      : {};
  const isActive = Boolean(activeAvatarId && avatarId === activeAvatarId);
  const defaultPersona = String(powerUser?.default_persona ?? '').trim();

  const rawName =
    personasMap && typeof personasMap === 'object' && Object.hasOwn(personasMap, avatarId)
      ? personasMap[avatarId]
      : undefined;
  const name =
    rawName !== undefined && rawName !== null
      ? String(rawName)
      : (isActive && ctx?.name1 ? String(ctx.name1) : '');

  const description =
    desc.description !== undefined && desc.description !== null
      ? String(desc.description)
      : (isActive ? String(powerUser?.persona_description ?? '') : '');

  const lorebook =
    desc.lorebook !== undefined && desc.lorebook !== null
      ? String(desc.lorebook)
      : (isActive ? String(powerUser?.persona_description_lorebook ?? '') : '');

  const position = Number.isFinite(Number(desc.position))
    ? Number(desc.position)
    : (isActive && Number.isFinite(Number(powerUser?.persona_description_position))
        ? Number(powerUser.persona_description_position)
        : 0);

  const depth = Number.isFinite(Number(desc.depth))
    ? Number(desc.depth)
    : (isActive && Number.isFinite(Number(powerUser?.persona_description_depth))
        ? Number(powerUser.persona_description_depth)
        : 2);

  const role = Number.isFinite(Number(desc.role))
    ? Number(desc.role)
    : (isActive && Number.isFinite(Number(powerUser?.persona_description_role))
        ? Number(powerUser.persona_description_role)
        : 0);

  return {
    avatarId,
    name,
    description,
    title: String(desc.title ?? ''),
    lorebook,
    position,
    depth,
    role,
    connections: Array.isArray(desc.connections) ? deepClone(desc.connections) : [],
    isDefault: Boolean(defaultPersona && avatarId === defaultPersona),
    isActive,
  };
}

function dispatchPersonaSavedEvent(detail, deps = {}) {
  const win = deps?.window ?? (typeof window !== 'undefined' ? window : null);
  const EventCtor = deps?.CustomEvent ?? (typeof CustomEvent === 'function' ? CustomEvent : null);
  if (!win || typeof win.dispatchEvent !== 'function' || typeof EventCtor !== 'function') {
    return;
  }
  try {
    const evt = new EventCtor(HOST_CUSTOM_EVENTS.PERSONA_SAVED, {
      detail: deepClone(detail),
    });
    win.dispatchEvent(evt);
  } catch {
    // Guarded against hostile listeners or non-standard Event environments
  }
}

async function resolveDefaultAvatarBlob(deps, bridge, scriptMod, fetchImpl) {
  const defaultUrl =
    deps?.defaultUserAvatar ??
    bridge?.defaultUserAvatar ??
    scriptMod?.default_user_avatar ??
    'img/user-default.png';

  if (typeof fetchImpl === 'function' && defaultUrl) {
    try {
      const res = await fetchImpl(defaultUrl, { cache: 'no-cache' });
      if (res && res.ok && typeof res.blob === 'function') {
        const blob = await res.blob();
        if (blob && (blob.size === undefined || blob.size > 0)) {
          return blob;
        }
      }
    } catch {
      // Fall back to deterministic valid 1x1 PNG bytes
    }
  }

  if (typeof Blob === 'function') {
    return new Blob([FALLBACK_PNG_BYTES], { type: 'image/png' });
  }
  return FALLBACK_PNG_BYTES;
}

// ============================================================================
// Primary Exported API
// ============================================================================

export async function waitForHostReady(options = {}, deps = {}) {
  const timeoutMs =
    Number.isFinite(Number(options?.timeoutMs)) && Number(options.timeoutMs) > 0
      ? Number(options.timeoutMs)
      : 5000;

  const bridge = getBridge();
  const readyPromise =
    deps?.ready ??
    bridge?.ready ??
    globalThis.__TAURITAVERN__?.ready ??
    globalThis.__TAURITAVERN_MAIN_READY__ ??
    null;

  if (!readyPromise || typeof readyPromise.then !== 'function') {
    return true;
  }

  let timer = null;
  try {
    const result = await Promise.race([
      Promise.resolve(readyPromise).then(
        () => true,
        () => false
      ),
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(false), timeoutMs);
      }),
    ]);
    return Boolean(result);
  } catch {
    return false;
  } finally {
    if (timer !== null) {
      clearTimeout(timer);
    }
  }
}

export async function loadSettings(deps = {}) {
  const bridge = getBridge();
  const ctx = await resolveHostContext(deps);
  const mods = await loadHostModules({ extensions: !ctx?.extensionSettings }, deps);
  const container = resolveExtensionSettingsContainer(deps, bridge, ctx, mods.extensions);
  const raw = container && typeof container === 'object' ? container[EXTENSION_SETTINGS_KEY] : undefined;
  const normalized = createDefaultSettings(raw);

  if (container && typeof container === 'object') {
    container[EXTENSION_SETTINGS_KEY] = normalized;
  }
  return normalized;
}

export async function saveSettings(settings, deps = {}) {
  const bridge = getBridge();
  const ctx = await resolveHostContext(deps);
  const needScript =
    typeof deps?.saveSettingsDebounced !== 'function' &&
    typeof bridge?.saveSettingsDebounced !== 'function' &&
    typeof ctx?.saveSettingsDebounced !== 'function';
  const mods = await loadHostModules(
    {
      extensions: !ctx?.extensionSettings,
      script: needScript,
    },
    deps
  );

  const container = resolveExtensionSettingsContainer(deps, bridge, ctx, mods.extensions);
  const normalized = createDefaultSettings(settings);

  if (container && typeof container === 'object') {
    container[EXTENSION_SETTINGS_KEY] = normalized;
  }

  const saveDebounced =
    deps?.saveSettingsDebounced ??
    bridge?.saveSettingsDebounced ??
    ctx?.saveSettingsDebounced ??
    mods.script?.saveSettingsDebounced ??
    null;

  if (typeof saveDebounced === 'function') {
    await saveDebounced();
  }
  return normalized;
}

export async function getActivePersona(deps = {}) {
  const bridge = getBridge();
  const ctx = await resolveHostContext(deps);
  const hasExplicitAvatar =
    typeof deps?.getUserAvatar === 'function' ||
    Boolean(String(deps?.userAvatar ?? '').trim()) ||
    typeof bridge?.getUserAvatar === 'function' ||
    Boolean(String(bridge?.userAvatar ?? '').trim()) ||
    Boolean(String(ctx?.userAvatar ?? '').trim());
  const mods = await loadHostModules(
    {
      powerUser: !hasImmediatePowerUser(deps, bridge, ctx),
      personas: !hasExplicitAvatar,
    },
    deps
  );

  const liveDom = readLiveDomPersona(deps);
  const rawPowerUser = resolvePowerUser(deps, bridge, ctx, mods.powerUser);
  const powerUser = rawPowerUser && typeof rawPowerUser === 'object' ? rawPowerUser : null;
  const activeAvatarId = resolveActiveAvatarId(
    deps,
    bridge,
    ctx,
    mods.personas,
    powerUser,
    liveDom.doc
  );

  if (activeAvatarId && powerUser) {
    const personasMap =
      powerUser.personas && typeof powerUser.personas === 'object' ? powerUser.personas : {};
    const descriptionsMap =
      powerUser.persona_descriptions && typeof powerUser.persona_descriptions === 'object'
        ? powerUser.persona_descriptions
        : {};
    const record = buildPersonaRecord(
      activeAvatarId,
      personasMap,
      descriptionsMap,
      powerUser,
      activeAvatarId,
      ctx
    );
    if (!record.description.trim()) {
      const liveFallbackDesc = String(powerUser.persona_description || liveDom.description || '');
      if (liveFallbackDesc.trim()) {
        record.description = liveFallbackDesc;
      }
    }
    if (!record.name && liveDom.name) {
      record.name = liveDom.name;
    }
    return record;
  }

  const fallbackDesc = String(powerUser?.persona_description || liveDom.description || '');
  if (!powerUser && !fallbackDesc.trim()) {
    return null;
  }

  const liveRecord = buildLivePersonaRecord(powerUser, ctx, liveDom);
  if (activeAvatarId) {
    liveRecord.avatarId = activeAvatarId;
  }
  return liveRecord;
}

export async function listPersonas(deps = {}) {
  const bridge = getBridge();
  const ctx = await resolveHostContext(deps);
  const hasExplicitAvatar =
    typeof deps?.getUserAvatar === 'function' ||
    Boolean(String(deps?.userAvatar ?? '').trim()) ||
    typeof bridge?.getUserAvatar === 'function' ||
    Boolean(String(bridge?.userAvatar ?? '').trim()) ||
    Boolean(String(ctx?.userAvatar ?? '').trim());
  const mods = await loadHostModules(
    {
      powerUser: !hasImmediatePowerUser(deps, bridge, ctx),
      personas: !hasExplicitAvatar,
    },
    deps
  );

  const liveDom = readLiveDomPersona(deps);
  const rawPowerUser = resolvePowerUser(deps, bridge, ctx, mods.powerUser);
  const powerUser = rawPowerUser && typeof rawPowerUser === 'object' ? rawPowerUser : null;
  if (!powerUser) {
    if (liveDom.description.trim()) {
      return [buildLivePersonaRecord(null, ctx, liveDom)];
    }
    return [];
  }

  const activeAvatarId = resolveActiveAvatarId(
    deps,
    bridge,
    ctx,
    mods.personas,
    powerUser,
    liveDom.doc
  );
  const personasMap = powerUser.personas && typeof powerUser.personas === 'object' ? powerUser.personas : {};
  const descriptionsMap =
    powerUser.persona_descriptions && typeof powerUser.persona_descriptions === 'object'
      ? powerUser.persona_descriptions
      : {};

  const idSet = new Set();
  for (const key of Object.keys(personasMap)) {
    const trimmed = String(key ?? '').trim();
    if (trimmed) idSet.add(trimmed);
  }
  for (const key of Object.keys(descriptionsMap)) {
    const trimmed = String(key ?? '').trim();
    if (trimmed) idSet.add(trimmed);
  }

  const list = [];
  for (const avatarId of idSet) {
    const rec = buildPersonaRecord(avatarId, personasMap, descriptionsMap, powerUser, activeAvatarId, ctx);
    if (rec.isActive && !rec.description.trim()) {
      const liveFallbackDesc = String(powerUser.persona_description || liveDom.description || '');
      if (liveFallbackDesc.trim()) {
        rec.description = liveFallbackDesc;
      }
    }
    list.push(rec);
  }

  list.sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    return a.name.localeCompare(b.name, 'zh-CN');
  });

  const liveDesc = String(powerUser.persona_description || liveDom.description || '');
  const hasActiveInList = list.some((item) => item.isActive);
  const hasSameDescInList =
    Boolean(liveDesc.trim()) &&
    list.some((item) => String(item.description ?? '').trim() === liveDesc.trim());
  if (liveDesc.trim() && !hasActiveInList && !hasSameDescInList) {
    list.unshift(buildLivePersonaRecord(powerUser, ctx, liveDom));
  }

  return list;
}

function pickOwnCharacterEntry(map, id) {
  if (!map || (typeof map !== 'object' && !Array.isArray(map))) return null;
  if (id !== undefined && id !== null && id !== '') {
    if (Object.hasOwn(map, id)) return map[id];
    const strId = String(id);
    if (Object.hasOwn(map, strId)) return map[strId];
    const numId = Number(id);
    if (Number.isFinite(numId) && Object.hasOwn(map, numId)) return map[numId];
  }
  return null;
}

function isValidCharacterEntry(ch) {
  if (!ch || typeof ch !== 'object') return false;
  const name = String(ch.name ?? '').trim();
  const avatar = String(ch.avatar ?? '').trim();
  if (!name || !avatar) return false;
  if (name === 'SillyTavern System') return false;
  return true;
}

function resolveCharacterPrimaryWorldName(character) {
  return String(
    character?.data?.extensions?.world ??
      character?.extensions?.world ??
      ''
  ).trim();
}

function resolveCharLoreExtraBooks(character, ctx, deps, bridge, worldInfoMod) {
  const avatar = String(character?.avatar ?? '').trim();
  if (!avatar) return [];
  const baseName = avatar.replace(/\.[^/.]+$/, '');
  const charLoreList =
    deps?.charLore ??
    bridge?.charLore ??
    ctx?.worldInfo?.charLore ??
    worldInfoMod?.charLore ??
    null;
  if (!Array.isArray(charLoreList)) return [];

  const extras = [];
  for (const item of charLoreList) {
    if (!item || typeof item !== 'object') continue;
    const itemName = String(item.name ?? '').trim();
    if (!itemName) continue;
    if (itemName === avatar || itemName === baseName) {
      if (Array.isArray(item.extraBooks)) {
        for (const b of item.extraBooks) {
          const clean = String(b ?? '').trim();
          if (clean && !extras.includes(clean)) extras.push(clean);
        }
      }
    }
  }
  return extras;
}

function normalizeRawWorldbookEntries(rawEntries, { bookName, sourceType }) {
  const out = [];
  if (!rawEntries) return out;
  const list = Array.isArray(rawEntries)
    ? rawEntries
    : typeof rawEntries === 'object'
      ? Object.values(rawEntries)
      : [];

  let fallbackIdx = 0;
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const rawContent = String(entry.content ?? '').trim();
    if (!rawContent) continue;

    const uid =
      entry.uid !== undefined && entry.uid !== null && String(entry.uid).trim() !== ''
        ? String(entry.uid)
        : String(entry.id ?? fallbackIdx);
    fallbackIdx += 1;

    const keys = Array.isArray(entry.key)
      ? entry.key.map((k) => String(k ?? '').trim()).filter(Boolean)
      : Array.isArray(entry.keys)
        ? entry.keys.map((k) => String(k ?? '').trim()).filter(Boolean)
        : [];
    const comment = String(entry.comment ?? entry.name ?? '').trim() || keys[0] || `条目 ${uid}`;
    const defaultEnabled =
      entry.enabled !== undefined && entry.disable === undefined
        ? Boolean(entry.enabled)
        : !Boolean(entry.disable);
    const order = Number.isFinite(Number(entry.order))
      ? Number(entry.order)
      : Number.isFinite(Number(entry.insertion_order))
        ? Number(entry.insertion_order)
        : 100;

    const category = classifyWorldbookEntry({
      comment,
      keys,
      content: rawContent,
    });

    out.push({
      entryKey: `${sourceType}::${bookName}::${uid}`,
      sourceType,
      bookName,
      uid,
      comment,
      keys,
      content: rawContent,
      constant: Boolean(entry.constant),
      selective: entry.selective !== false,
      defaultEnabled,
      disabled: !defaultEnabled,
      category,
      order,
    });
  }
  return out;
}

async function fetchSingleWorldbookData(worldName, deps = {}, bridge = null) {
  let wbData = null;
  const fetchImpl = deps?.fetch ?? bridge?.fetch ?? globalThis.fetch;
  if (typeof fetchImpl === 'function') {
    try {
      const headers = await getHostRequestHeaders({}, deps);
      const res = await fetchImpl('/api/worldinfo/get', {
        method: 'POST',
        headers,
        cache: 'no-cache',
        body: JSON.stringify({ name: worldName }),
      });
      if (res && res.ok && typeof res.json === 'function') {
        wbData = await res.json();
      }
    } catch {
      wbData = null;
    }
  }

  if (!wbData) {
    const loadWorldInfoFn = deps?.loadWorldInfo ?? bridge?.loadWorldInfo ?? null;
    if (typeof loadWorldInfoFn === 'function') {
      try {
        wbData = await loadWorldInfoFn(worldName);
      } catch {
        wbData = null;
      }
    } else {
      const mods = await loadHostModules({ worldInfo: true }, deps);
      if (typeof mods.worldInfo?.loadWorldInfo === 'function') {
        try {
          wbData = await mods.worldInfo.loadWorldInfo(worldName);
        } catch {
          wbData = null;
        }
      }
    }
  }

  return wbData;
}

export async function listCharacters(deps = {}) {
  const ctx = await resolveHostContext(deps);
  if (!ctx) return [];
  const characters = ctx.characters;
  if (!characters || (typeof characters !== 'object' && !Array.isArray(characters))) {
    return [];
  }

  const activeId =
    ctx.characterId !== undefined && ctx.characterId !== null && ctx.characterId !== ''
      ? String(ctx.characterId)
      : '';

  const list = [];
  const keys = Array.isArray(characters)
    ? characters.map((_, idx) => String(idx))
    : Object.keys(characters);

  for (const chid of keys) {
    const ch = pickOwnCharacterEntry(characters, chid);
    if (!isValidCharacterEntry(ch)) continue;
    list.push({
      chid: String(chid),
      avatar: String(ch.avatar ?? ''),
      name: String(ch.name ?? '').trim(),
      worldName: resolveCharacterPrimaryWorldName(ch),
      isActive: Boolean(activeId && String(chid) === activeId),
      shallow: Boolean(ch.shallow),
    });
  }

  list.sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return a.name.localeCompare(b.name, 'zh-CN');
  });
  return list;
}

function pickWorldNamesSource(deps, bridge, ctx, worldInfoMod) {
  if (Array.isArray(deps?.worldNames)) return deps.worldNames;
  if (Array.isArray(deps?.world_names)) return deps.world_names;
  if (Array.isArray(bridge?.worldNames)) return bridge.worldNames;
  if (Array.isArray(bridge?.world_names)) return bridge.world_names;

  const candidates = [
    ctx?.worldNames,
    ctx?.world_names,
    ctx?.worldInfo?.world_names,
    worldInfoMod?.world_names,
    worldInfoMod?.worldNames,
    globalThis.world_names,
    globalThis.worldNames,
  ];
  for (const arr of candidates) {
    if (Array.isArray(arr) && arr.length > 0) return arr;
  }
  for (const arr of candidates) {
    if (Array.isArray(arr)) return arr;
  }
  return [];
}

export async function listWorldbooks(deps = {}) {
  const bridge = getBridge();
  const ctx = await resolveHostContext(deps);

  const hasImmediateSource =
    Array.isArray(deps?.worldNames) ||
    Array.isArray(deps?.world_names) ||
    Array.isArray(bridge?.worldNames) ||
    Array.isArray(bridge?.world_names) ||
    Array.isArray(ctx?.worldNames) ||
    Array.isArray(ctx?.world_names) ||
    Array.isArray(ctx?.worldInfo?.world_names) ||
    Array.isArray(globalThis.world_names) ||
    Array.isArray(globalThis.worldNames);

  let worldInfoMod = null;
  if (!hasImmediateSource) {
    const mods = await loadHostModules({ worldInfo: true }, deps);
    worldInfoMod = mods.worldInfo;
  }

  const rawList = pickWorldNamesSource(deps, bridge, ctx, worldInfoMod);
  if (!Array.isArray(rawList)) return [];

  const unique = new Set();
  for (const item of rawList) {
    if (typeof item !== 'string' && typeof item !== 'number') continue;
    const clean = String(item).trim();
    if (clean) unique.add(clean);
  }
  return Array.from(unique).sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

export async function loadCharacterWorldbookEntries(targetOrWorldNames = {}, deps = {}) {
  const bridge = getBridge();
  const ctx = await resolveHostContext(deps);

  const worldNames = [];
  const pushWorldName = (name) => {
    const clean = String(name ?? '').trim();
    if (clean && !worldNames.includes(clean)) {
      worldNames.push(clean);
    }
  };

  let characterObj = null;
  let includeEmbedded = true;

  if (typeof targetOrWorldNames === 'string') {
    pushWorldName(targetOrWorldNames);
    includeEmbedded = false;
  } else if (Array.isArray(targetOrWorldNames)) {
    for (const n of targetOrWorldNames) pushWorldName(n);
    includeEmbedded = false;
  } else if (targetOrWorldNames && typeof targetOrWorldNames === 'object') {
    includeEmbedded = targetOrWorldNames.includeEmbedded !== false;
    if (Array.isArray(targetOrWorldNames.worldNames)) {
      for (const n of targetOrWorldNames.worldNames) pushWorldName(n);
    }
    if (targetOrWorldNames.worldName) {
      pushWorldName(targetOrWorldNames.worldName);
    }
    if (targetOrWorldNames.character && typeof targetOrWorldNames.character === 'object') {
      characterObj = targetOrWorldNames.character;
    } else if (
      (targetOrWorldNames.chid !== undefined || targetOrWorldNames.avatar) &&
      ctx?.characters
    ) {
      if (targetOrWorldNames.chid !== undefined && targetOrWorldNames.chid !== null && targetOrWorldNames.chid !== '') {
        characterObj = pickOwnCharacterEntry(ctx.characters, targetOrWorldNames.chid);
      }
      if (!characterObj && targetOrWorldNames.avatar) {
        const list = Array.isArray(ctx.characters) ? ctx.characters : Object.values(ctx.characters);
        characterObj = list.find((c) => c && c.avatar === targetOrWorldNames.avatar) || null;
      }
    }

    if (characterObj) {
      pushWorldName(resolveCharacterPrimaryWorldName(characterObj));
      let worldInfoMod = null;
      if (!deps?.charLore && !bridge?.charLore && !ctx?.worldInfo?.charLore) {
        const mods = await loadHostModules({ worldInfo: true }, deps);
        worldInfoMod = mods.worldInfo;
      }
      const extras = resolveCharLoreExtraBooks(characterObj, ctx, deps, bridge, worldInfoMod);
      for (const extra of extras) pushWorldName(extra);
    }
  }

  const entries = [];
  // Non-destructive, low-concurrency sequential disk reads with immediate GC nulling
  for (const worldName of worldNames) {
    let wbData = await fetchSingleWorldbookData(worldName, deps, bridge);
    if (wbData && wbData.entries) {
      const normalized = normalizeRawWorldbookEntries(wbData.entries, {
        bookName: worldName,
        sourceType: 'world',
      });
      entries.push(...normalized);
    }
    wbData = null;
  }

  if (includeEmbedded && characterObj) {
    const embeddedBook = characterObj?.data?.character_book ?? characterObj?.character_book ?? null;
    if (embeddedBook && typeof embeddedBook === 'object' && embeddedBook.entries) {
      const bookName = String(embeddedBook.name ?? '').trim() || `${String(characterObj.name ?? '角色卡').trim()}内置世界书`;
      const normalizedEmbedded = normalizeRawWorldbookEntries(embeddedBook.entries, {
        bookName,
        sourceType: 'embedded',
      });
      entries.push(...normalizedEmbedded);
    }
  }

  return {
    worldNames,
    entries,
  };
}

function normalizeGetCharCtxArgs(options, deps) {
  const optObj = options && typeof options === 'object' ? options : {};
  const depObj = deps && typeof deps === 'object' ? deps : {};
  const optKeys = [
    'includeWorldSummary',
    'includeWorldEntries',
    'includeDialogueExamples',
    'unshallow',
  ];
  const depKeys = [
    'ctx',
    'context',
    'fetch',
    'loadWorldInfo',
    'charLore',
    'skipDynamicImport',
    'getRequestHeaders',
    'powerUser',
    'worldNames',
  ];
  const hasOpt = (o) => optKeys.some((k) => Object.hasOwn(o, k));
  const hasDep = (o) => depKeys.some((k) => Object.hasOwn(o, k));
  if (!hasOpt(optObj) && hasDep(optObj) && !hasDep(depObj)) {
    return { resolvedOptions: depObj, resolvedDeps: optObj };
  }
  return { resolvedOptions: optObj, resolvedDeps: depObj };
}

function isCharacterProfileWorldbookEntry(entry, rawName = '') {
  if (!entry || typeof entry !== 'object') return false;
  if (isNoiseWorldbookEntry(entry)) return false;
  const comment = String(entry.comment ?? '').trim();
  const keys = Array.isArray(entry.keys) ? entry.keys.join(' ') : '';
  const content = String(entry.content ?? '').trim();
  if (!content) return false;

  const headerText = `${comment}\n${keys}`;
  if (
    /(?:角色档案|人物档案|自我档案|人物设定|角色设定|人设|角色简介|人物简介|基本资料|基本信息|外貌设定|性格设定|character_profile|char_profile|persona_bio|\bbio\b)/iu.test(
      headerText
    )
  ) {
    return true;
  }
  const cleanName = String(rawName ?? '').trim();
  if (
    cleanName &&
    cleanName.length >= 2 &&
    (comment.includes(cleanName) || (Array.isArray(entry.keys) && entry.keys.some((k) => String(k).trim() === cleanName))) &&
    /(?:姓名|年龄|性别|外貌|性格|身份|档案|简介|age|gender|appearance|personality)/iu.test(content)
  ) {
    return true;
  }
  if (
    /(?:^|\n)[ \t]*(?:姓名|本名|年龄|外貌|性格|basic_info|appearance|personality)\s*[:：]/iu.test(content)
  ) {
    return true;
  }
  return false;
}

export async function getCharacterContext(target = null, options = {}, deps = {}) {
  const { resolvedOptions, resolvedDeps } = normalizeGetCharCtxArgs(options, deps);
  const bridge = getBridge();
  const ctx = await resolveHostContext(resolvedDeps);
  if (!ctx) return null;

  const characters = ctx.characters;
  if (!characters || (typeof characters !== 'object' && !Array.isArray(characters))) {
    return null;
  }

  let characterId = null;
  let character = null;

  const targetObj =
    target && typeof target === 'object'
      ? target
      : target !== null && target !== undefined && target !== ''
        ? { chid: target }
        : null;

  if (targetObj) {
    if (targetObj.chid !== undefined && targetObj.chid !== null && targetObj.chid !== '') {
      const candidate = pickOwnCharacterEntry(characters, targetObj.chid);
      if (candidate && typeof candidate === 'object') {
        characterId = targetObj.chid;
        character = candidate;
      }
    }
    if (!character && targetObj.avatar) {
      const keys = Array.isArray(characters)
        ? characters.map((_, idx) => String(idx))
        : Object.keys(characters);
      for (const k of keys) {
        const candidate = pickOwnCharacterEntry(characters, k);
        if (candidate && candidate.avatar === targetObj.avatar) {
          characterId = k;
          character = candidate;
          break;
        }
      }
    }
  } else {
    characterId = ctx.characterId;
    if (characterId === undefined || characterId === null || characterId === '') {
      return null;
    }
    character = pickOwnCharacterEntry(characters, characterId);
  }

  if (!character || typeof character !== 'object') {
    return null;
  }

  // Hydrate shallow card WITHOUT ever switching ctx.characterId or calling selectCharacterById
  let hydratedViaApi = false;
  if (character.shallow && resolvedOptions?.unshallow !== false) {
    try {
      if (typeof ctx.unshallowCharacter === 'function') {
        await ctx.unshallowCharacter(characterId);
      } else if (typeof ctx.getOneCharacter === 'function' && character.avatar) {
        await ctx.getOneCharacter(character.avatar);
      }
    } catch {
      // Non-fatal: continue with currently available fields
    }
    const refreshed = pickOwnCharacterEntry(ctx.characters, characterId);
    if (refreshed && typeof refreshed === 'object') {
      character = refreshed;
    }
    if (character.shallow && character.avatar) {
      const fetchImpl = resolvedDeps?.fetch ?? bridge?.fetch ?? globalThis.fetch;
      if (typeof fetchImpl === 'function') {
        try {
          const headers = await getHostRequestHeaders({}, resolvedDeps);
          const res = await fetchImpl('/api/characters/get', {
            method: 'POST',
            headers,
            cache: 'no-cache',
            body: JSON.stringify({ avatar_url: character.avatar }),
          });
          if (res && res.ok && typeof res.json === 'function') {
            const fullCard = await res.json();
            if (fullCard && typeof fullCard === 'object') {
              character = {
                ...character,
                ...fullCard,
                data: {
                  ...(character.data && typeof character.data === 'object' ? character.data : {}),
                  ...(fullCard.data && typeof fullCard.data === 'object' ? fullCard.data : {}),
                },
                shallow: false,
              };
              hydratedViaApi = true;
            }
          }
        } catch {
          // Non-fatal
        }
      }
    }
  }

  let fields = {};
  if (!hydratedViaApi && typeof ctx.getCharacterCardFields === 'function') {
    try {
      fields = ctx.getCharacterCardFields({ chid: characterId }) || {};
    } catch {
      fields = {};
    }
  }

  const pickNonEmptyField = (...candidates) => {
    for (const candidate of candidates) {
      if (candidate !== undefined && candidate !== null) {
        const text = String(candidate);
        if (text !== '') return text;
      }
    }
    return '';
  };

  const activeId =
    ctx.characterId !== undefined && ctx.characterId !== null && ctx.characterId !== ''
      ? String(ctx.characterId)
      : '';
  const isActive = Boolean(activeId && String(characterId) === activeId);
  const rawName = String(character.name ?? (isActive ? ctx.name2 : '') ?? '').trim();
  const rawDescription = pickNonEmptyField(fields.description, character.description, character.data?.description);
  const rawPersonality = pickNonEmptyField(fields.personality, character.personality, character.data?.personality);
  const rawScenario = pickNonEmptyField(fields.scenario, character.scenario, character.data?.scenario);
  const rawFirstMessage = pickNonEmptyField(fields.firstMessage, character.first_mes, character.data?.first_mes);

  const worldName = resolveCharacterPrimaryWorldName(character);
  let worldSummary = worldName ? `关联世界书：${worldName}` : '';
  let worldNames = worldName ? [worldName] : [];
  let worldEntries = [];
  let loadedEntriesForMerge = [];

  const needWorldLoad =
    Boolean(resolvedOptions?.includeWorldSummary) ||
    Boolean(resolvedOptions?.includeWorldEntries) ||
    rawDescription.trim().length < 300;

  if (needWorldLoad) {
    const loaded = await loadCharacterWorldbookEntries({ character }, resolvedDeps);
    loadedEntriesForMerge = Array.isArray(loaded.entries) ? loaded.entries : [];
    if (resolvedOptions?.includeWorldSummary || resolvedOptions?.includeWorldEntries) {
      worldNames = loaded.worldNames.length > 0 ? loaded.worldNames : worldNames;
    }
    if (resolvedOptions?.includeWorldEntries) {
      worldEntries = loadedEntriesForMerge;
    }
    if (resolvedOptions?.includeWorldSummary) {
      const snippets = [];
      for (const entry of loadedEntriesForMerge) {
        if (!entry.defaultEnabled) continue;
        const label = entry.comment || entry.keys[0] || '设定';
        snippets.push(`${label}：${entry.content}`);
        if (snippets.length >= 3) break;
      }
      if (snippets.length > 0) {
        const joined = snippets.join('\n');
        worldSummary = joined.length > 600 ? `${joined.slice(0, 597)}...` : joined;
      } else if (!worldSummary && worldNames.length > 0) {
        worldSummary = `关联世界书：${worldNames.join('、')}`;
      }
    }
  }

  let effectiveDescription = rawDescription;
  let mergedDescription = '';
  if (rawDescription.trim().length < 300 && loadedEntriesForMerge.length > 0) {
    const multiInfo = detectMultiCharacterCard(character, loadedEntriesForMerge);
    const multiCharKeySet = new Set(multiInfo.characterEntries.map((c) => c.key));

    const eligibleEntries = loadedEntriesForMerge.filter((e) => {
      if (e.defaultEnabled === false || e.disabled === true) return false;
      const cls = classifyWorldbookEntry(e);
      if (cls === 'system_format') return false;
      if (multiInfo.isMultiChar && multiCharKeySet.has(e.entryKey)) {
        return false;
      }
      return cls === 'acting_rules' || isCharacterProfileWorldbookEntry(e, rawName);
    });

    const nonNoiseFallback =
      eligibleEntries.length > 0
        ? eligibleEntries
        : !rawDescription.trim() || isNoiseWorldbookEntry({ content: rawDescription })
          ? loadedEntriesForMerge.filter((e) => {
              if (e.defaultEnabled === false || e.disabled === true) return false;
              if (classifyWorldbookEntry(e) === 'system_format') return false;
              if (multiInfo.isMultiChar && multiCharKeySet.has(e.entryKey)) return false;
              return true;
            })
          : [];

    if (nonNoiseFallback.length > 0) {
      const extraParts = nonNoiseFallback
        .map((e) => `${e.comment ? `[${e.comment}]\n` : ''}${e.content}`)
        .filter(Boolean);
      const basePart =
        rawDescription.trim() && !isNoiseWorldbookEntry({ content: rawDescription })
          ? rawDescription.trim()
          : '';
      mergedDescription = [basePart, ...extraParts].filter(Boolean).join('\n\n');
      effectiveDescription = mergedDescription;
    }
  }

  const realNameInfo = resolveCharacterRealName({
    name: rawName,
    description: effectiveDescription,
    firstMessage: rawFirstMessage,
    worldEntries: loadedEntriesForMerge,
  });

  const rawChatId = isActive
    ? typeof ctx.getCurrentChatId === 'function'
      ? ctx.getCurrentChatId()
      : ctx.chatId
    : null;

  // Strictly public-only fields (omits system, jailbreak, creatorNotes, charDepthPrompt, persona; mesExamples only when explicitly requested)
  const result = {
    characterId: String(characterId),
    avatar: String(character.avatar ?? ''),
    name: rawName,
    realName: realNameInfo.realName || rawName,
    chatId: rawChatId !== undefined && rawChatId !== null && rawChatId !== '' ? String(rawChatId) : null,
    isActive,
    worldName,
    worldNames,
    worldSummary,
    description: effectiveDescription,
    ...(mergedDescription ? { mergedDescription } : {}),
    personality: rawPersonality,
    scenario: rawScenario,
    firstMessage: rawFirstMessage,
    shallow: Boolean(character.shallow),
  };
  if (resolvedOptions?.includeWorldEntries) {
    result.worldEntries = worldEntries;
  }
  const includeDialogueExamples =
    resolvedOptions?.includeDialogueExamples === true ||
    targetObj?.includeDialogueExamples === true;
  if (includeDialogueExamples) {
    result.mesExamples = pickNonEmptyField(
      fields.mesExamples,
      character.mes_example,
      character.mes_examples,
      character.data?.mes_example,
      character.data?.mes_examples
    );
  }
  return result;
}

export async function getActiveCharacterContext(options = {}, deps = {}) {
  return getCharacterContext(null, options, deps);
}

export async function savePersonaToHost(payload = {}, deps = {}) {
  const mode = payload?.mode ?? 'overwrite';
  if (mode !== 'overwrite' && mode !== 'create') {
    throw new Error(`不支持的人设保存模式：${String(mode)}`);
  }

  const bridge = getBridge();
  const ctx = await resolveHostContext(deps);

  const needPersonas =
    typeof deps?.initPersona !== 'function' ||
    typeof deps?.setPersonaDescription !== 'function' ||
    typeof deps?.setUserAvatar !== 'function' ||
    typeof deps?.getUserAvatars !== 'function' ||
    (deps?.userAvatar === undefined && typeof deps?.getUserAvatar !== 'function');

  const needScript =
    typeof deps?.saveSettingsDebounced !== 'function' ||
    typeof deps?.setUserName !== 'function';

  const mods = await loadHostModules(
    {
      powerUser: !hasImmediatePowerUser(deps, bridge, ctx),
      personas: needPersonas,
      script: needScript,
    },
    deps
  );

  const liveDom = readLiveDomPersona(deps);
  const powerUser = resolvePowerUser(deps, bridge, ctx, mods.powerUser);
  if (!powerUser || typeof powerUser !== 'object') {
    throw new Error('未检测到酒馆用户人设存储（power_user），无法写入人设');
  }
  if (!powerUser.personas || typeof powerUser.personas !== 'object') {
    powerUser.personas = {};
  }
  if (!powerUser.persona_descriptions || typeof powerUser.persona_descriptions !== 'object') {
    powerUser.persona_descriptions = {};
  }

  const activeAvatarId = resolveActiveAvatarId(
    deps,
    bridge,
    ctx,
    mods.personas,
    powerUser,
    liveDom.doc
  );
  const saveDebounced =
    deps?.saveSettingsDebounced ??
    bridge?.saveSettingsDebounced ??
    ctx?.saveSettingsDebounced ??
    mods.script?.saveSettingsDebounced ??
    null;

  const eventSource = deps?.eventSource ?? bridge?.eventSource ?? ctx?.eventSource ?? null;
  const eventTypes = deps?.eventTypes ?? bridge?.eventTypes ?? ctx?.eventTypes ?? {};
  const setPersonaDescriptionFn =
    deps?.setPersonaDescription ?? bridge?.setPersonaDescription ?? mods.personas?.setPersonaDescription ?? null;
  const setUserAvatarFn =
    deps?.setUserAvatar ?? bridge?.setUserAvatar ?? mods.personas?.setUserAvatar ?? null;
  const getUserAvatarsFn =
    deps?.getUserAvatars ?? bridge?.getUserAvatars ?? mods.personas?.getUserAvatars ?? null;
  const setUserNameFn =
    deps?.setUserName ?? bridge?.setUserName ?? mods.script?.setUserName ?? null;
  const initPersonaFn =
    deps?.initPersona ?? bridge?.initPersona ?? mods.personas?.initPersona ?? null;
  const fetchImpl = deps?.fetch ?? bridge?.fetch ?? globalThis.fetch;

  const rawChatId =
    ctx && typeof ctx.getCurrentChatId === 'function' ? ctx.getCurrentChatId() : ctx?.chatId;
  const characterId =
    ctx?.characterId !== undefined && ctx?.characterId !== null && ctx?.characterId !== ''
      ? String(ctx.characterId)
      : null;
  const chatId = rawChatId !== undefined && rawChatId !== null && rawChatId !== '' ? String(rawChatId) : null;

  if (mode === 'overwrite') {
    const explicitId = String(payload.avatarId ?? '').trim();
    const targetId = explicitId || activeAvatarId;

    if (targetId === LIVE_PERSONA_AVATAR_ID || !targetId) {
      const prevDescription = String(powerUser.persona_description ?? liveDom.description ?? '');
      const nextDescription =
        payload.description !== undefined ? String(payload.description) : prevDescription;
      const finalLorebook =
        payload.lorebook !== undefined
          ? String(payload.lorebook)
          : String(powerUser.persona_description_lorebook ?? '');
      const nextPosition =
        payload.position !== undefined && Number.isFinite(Number(payload.position))
          ? Number(payload.position)
          : hasFiniteNumber(powerUser.persona_description_position)
            ? Number(powerUser.persona_description_position)
            : 0;
      const nextDepth =
        payload.depth !== undefined && Number.isFinite(Number(payload.depth))
          ? Number(payload.depth)
          : hasFiniteNumber(powerUser.persona_description_depth)
            ? Number(powerUser.persona_description_depth)
            : 2;
      const nextRole =
        payload.role !== undefined && Number.isFinite(Number(payload.role))
          ? Number(payload.role)
          : hasFiniteNumber(powerUser.persona_description_role)
            ? Number(powerUser.persona_description_role)
            : 0;

      const prevName = String(ctx?.name1 || liveDom.name || '').trim();
      const requestedName = payload.name !== undefined ? String(payload.name).trim() : '';
      const finalName = requestedName || prevName || '当前人设';

      if (requestedName && requestedName !== prevName && typeof setUserNameFn === 'function') {
        setUserNameFn(requestedName);
      }

      powerUser.persona_description = nextDescription;
      powerUser.persona_description_position = nextPosition;
      powerUser.persona_description_depth = nextDepth;
      powerUser.persona_description_role = nextRole;
      powerUser.persona_description_lorebook = finalLorebook;

      if (liveDom.descEl) {
        liveDom.descEl.value = nextDescription;
      }

      if (typeof setPersonaDescriptionFn === 'function') {
        setPersonaDescriptionFn();
      }
      if (typeof saveDebounced === 'function') {
        await saveDebounced();
      }

      await eventSource?.emit?.(eventTypes.PERSONA_UPDATED ?? 'persona_updated', LIVE_PERSONA_AVATAR_ID);

      const liveResult = {
        avatarId: LIVE_PERSONA_AVATAR_ID,
        name: finalName,
        description: nextDescription,
        title: payload.title !== undefined ? String(payload.title) : '',
        lorebook: finalLorebook,
        isNew: false,
        mode: 'overwrite',
      };

      dispatchPersonaSavedEvent(
        {
          avatarId: liveResult.avatarId,
          name: liveResult.name,
          description: liveResult.description,
          lorebook: liveResult.lorebook,
          isNew: false,
          characterId,
          chatId,
          mode: 'overwrite',
        },
        deps
      );

      return liveResult;
    }

    const exists =
      Object.hasOwn(powerUser.personas, targetId) ||
      Object.hasOwn(powerUser.persona_descriptions, targetId);
    if (!exists) {
      throw new Error(`未找到目标人设（${targetId}），无法覆盖保存`);
    }

    const prevDesc =
      Object.hasOwn(powerUser.persona_descriptions, targetId) &&
      powerUser.persona_descriptions[targetId] &&
      typeof powerUser.persona_descriptions[targetId] === 'object'
        ? powerUser.persona_descriptions[targetId]
        : {};

    let currentName = Object.hasOwn(powerUser.personas, targetId) ? String(powerUser.personas[targetId] ?? '') : '';
    const becomingActive = Boolean(payload.setAsActive) && targetId !== activeAvatarId;
    const isTargetActive = targetId === activeAvatarId || Boolean(payload.setAsActive);

    if (payload.name !== undefined) {
      const nextName = String(payload.name).trim();
      if (nextName && nextName !== currentName) {
        const oldName = currentName;
        powerUser.personas[targetId] = nextName;
        currentName = nextName;
        if (isTargetActive && typeof setUserNameFn === 'function') {
          setUserNameFn(nextName);
        }
        await eventSource?.emit?.(eventTypes.PERSONA_RENAMED ?? 'persona_renamed', {
          avatarId: targetId,
          oldName,
          newName: nextName,
        });
      }
    }

    const nextDesc = {
      description:
        payload.description !== undefined ? String(payload.description) : String(prevDesc.description ?? ''),
      position:
        payload.position !== undefined && Number.isFinite(Number(payload.position))
          ? Number(payload.position)
          : (Number.isFinite(Number(prevDesc.position)) ? Number(prevDesc.position) : 0),
      depth:
        payload.depth !== undefined && Number.isFinite(Number(payload.depth))
          ? Number(payload.depth)
          : (Number.isFinite(Number(prevDesc.depth)) ? Number(prevDesc.depth) : 2),
      role:
        payload.role !== undefined && Number.isFinite(Number(payload.role))
          ? Number(payload.role)
          : (Number.isFinite(Number(prevDesc.role)) ? Number(prevDesc.role) : 0),
      lorebook:
        payload.lorebook !== undefined ? String(payload.lorebook) : String(prevDesc.lorebook ?? ''),
      title: payload.title !== undefined ? String(payload.title) : String(prevDesc.title ?? ''),
      connections: Array.isArray(prevDesc.connections) ? deepClone(prevDesc.connections) : [],
    };

    powerUser.persona_descriptions[targetId] = nextDesc;

    if (becomingActive && typeof setUserAvatarFn === 'function') {
      await setUserAvatarFn(targetId, { toastPersonaNameChange: false });
    }

    if (isTargetActive) {
      powerUser.persona_description = nextDesc.description;
      powerUser.persona_description_position = nextDesc.position;
      powerUser.persona_description_depth = nextDesc.depth;
      powerUser.persona_description_role = nextDesc.role;
      powerUser.persona_description_lorebook = nextDesc.lorebook;
      if (liveDom.descEl) {
        liveDom.descEl.value = nextDesc.description;
      }
      if (typeof setPersonaDescriptionFn === 'function') {
        setPersonaDescriptionFn();
      }
    }

    if (typeof saveDebounced === 'function') {
      await saveDebounced();
    }

    await eventSource?.emit?.(eventTypes.PERSONA_UPDATED ?? 'persona_updated', targetId);

    if (typeof getUserAvatarsFn === 'function') {
      await getUserAvatarsFn(true, targetId);
    }

    const result = {
      avatarId: targetId,
      name: currentName,
      description: nextDesc.description,
      title: nextDesc.title,
      lorebook: nextDesc.lorebook,
      isNew: false,
      mode: 'overwrite',
    };

    dispatchPersonaSavedEvent(
      {
        avatarId: result.avatarId,
        name: result.name,
        description: result.description,
        lorebook: result.lorebook,
        isNew: false,
        characterId,
        chatId,
        mode: 'overwrite',
      },
      deps
    );

    return result;
  }

  // mode === 'create'
  const trimmedName = String(payload.name ?? '').trim();
  if (!trimmedName) {
    throw new Error('新建人设名称不能为空');
  }
  if (typeof fetchImpl !== 'function') {
    throw new Error('当前运行环境缺少 fetch 接口，无法上传新建人设头像');
  }

  const asciiPart = trimmedName.replace(/[^a-zA-Z0-9]/g, '');
  const candidateAvatarId = `${Date.now()}-${asciiPart}.png`;

  const avatarBlob = await resolveDefaultAvatarBlob(deps, bridge, mods.script, fetchImpl);
  const formData = new FormData();
  const filePart =
    typeof File === 'function'
      ? new File([avatarBlob], 'avatar.png', { type: 'image/png' })
      : avatarBlob;
  formData.append('avatar', filePart, 'avatar.png');
  formData.append('overwrite_name', candidateAvatarId);

  const uploadHeaders = await getHostRequestHeaders({ omitContentType: true }, deps);
  const uploadRes = await fetchImpl('/api/avatars/upload', {
    method: 'POST',
    headers: uploadHeaders,
    cache: 'no-cache',
    body: formData,
  });

  if (!uploadRes || !uploadRes.ok) {
    throw new Error(`上传新人设头像失败（HTTP ${uploadRes?.status ?? 0}）`);
  }

  let uploadJson = {};
  if (typeof uploadRes.json === 'function') {
    try {
      uploadJson = (await uploadRes.json()) || {};
    } catch {
      uploadJson = {};
    }
  }

  const rawUploadPath = String(uploadJson?.path || '').trim();
  const normalizedUploadId = rawUploadPath
    ? rawUploadPath.replace(/\\/g, '/').replace(/^\/+/, '').replace(/^User Avatars\//i, '').split('/').filter(Boolean).pop() || ''
    : '';
  const finalAvatarId = normalizedUploadId || candidateAvatarId;
  const description = String(payload.description ?? '');
  const title = payload.title !== undefined ? String(payload.title) : '';
  const lorebook = payload.lorebook !== undefined ? String(payload.lorebook) : '';
  const position =
    payload.position !== undefined && Number.isFinite(Number(payload.position)) ? Number(payload.position) : 0;
  const depth =
    payload.depth !== undefined && Number.isFinite(Number(payload.depth)) ? Number(payload.depth) : 2;
  const role =
    payload.role !== undefined && Number.isFinite(Number(payload.role)) ? Number(payload.role) : 0;

  if (typeof initPersonaFn === 'function') {
    await initPersonaFn(finalAvatarId, trimmedName, description, title, {
      position,
      depth,
      role,
      lorebook,
    });
    if (
      powerUser.persona_descriptions[finalAvatarId] &&
      !Array.isArray(powerUser.persona_descriptions[finalAvatarId].connections)
    ) {
      powerUser.persona_descriptions[finalAvatarId].connections = [];
    }
  } else {
    powerUser.personas[finalAvatarId] = trimmedName;
    powerUser.persona_descriptions[finalAvatarId] = {
      description,
      position,
      depth,
      role,
      lorebook,
      title,
      connections: [],
    };
    if (typeof saveDebounced === 'function') {
      await saveDebounced();
    }
    await eventSource?.emit?.(eventTypes.PERSONA_CREATED ?? 'persona_created', {
      avatarId: finalAvatarId,
      name: trimmedName,
      description,
      title,
    });
  }

  if (payload.setAsActive) {
    if (typeof setUserAvatarFn === 'function') {
      await setUserAvatarFn(finalAvatarId, { toastPersonaNameChange: false });
    }
    powerUser.persona_description = description;
    powerUser.persona_description_position = position;
    powerUser.persona_description_depth = depth;
    powerUser.persona_description_role = role;
    powerUser.persona_description_lorebook = lorebook;
    if (liveDom.descEl) {
      liveDom.descEl.value = description;
    }
    if (typeof setUserNameFn === 'function') {
      setUserNameFn(trimmedName);
    }
    if (typeof setPersonaDescriptionFn === 'function') {
      setPersonaDescriptionFn();
    }
    if (typeof saveDebounced === 'function') {
      await saveDebounced();
    }
  }

  if (typeof getUserAvatarsFn === 'function') {
    await getUserAvatarsFn(true, finalAvatarId);
  }

  const result = {
    avatarId: finalAvatarId,
    name: trimmedName,
    description,
    title,
    lorebook,
    isNew: true,
    mode: 'create',
  };

  dispatchPersonaSavedEvent(
    {
      avatarId: result.avatarId,
      name: result.name,
      description: result.description,
      lorebook: result.lorebook,
      isNew: true,
      characterId,
      chatId,
      mode: 'create',
    },
    deps
  );

  return result;
}

function allocateFallbackWorldInfoEntry(data) {
  if (!data.entries || typeof data.entries !== 'object') {
    data.entries = {};
  }
  let uid = 0;
  while (Object.hasOwn(data.entries, uid) || Object.hasOwn(data.entries, String(uid))) {
    uid += 1;
  }
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
}

function normalizeWorldEntryText(s) {
  return String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeWorldEntryKeys(keysArr) {
  return Array.from(new Set((Array.isArray(keysArr) ? keysArr : []).map(normalizeWorldEntryText).filter(Boolean)))
    .sort()
    .join('\u0000');
}

function hasWorldKeyOverlap(keysA, keysB) {
  const setA = new Set((Array.isArray(keysA) ? keysA : []).map(normalizeWorldEntryText).filter(Boolean));
  if (setA.size === 0) return false;
  for (const k of Array.isArray(keysB) ? keysB : []) {
    if (setA.has(normalizeWorldEntryText(k))) return true;
  }
  return false;
}

function getWorldEntryUpsMeta(entry) {
  const meta = entry?.extensions?.[EXTENSION_SETTINGS_KEY];
  return meta && typeof meta === 'object' ? meta : null;
}

function normalizeWorldbookEntriesContainer(data) {
  if (!data.entries || typeof data.entries !== 'object') {
    data.entries = {};
    return;
  }
  if (Array.isArray(data.entries)) {
    const obj = {};
    data.entries.forEach((entry, idx) => {
      if (!entry || typeof entry !== 'object') return;
      const key =
        entry.uid !== undefined && entry.uid !== null && String(entry.uid).trim() !== ''
          ? String(entry.uid)
          : String(idx);
      obj[key] = entry;
    });
    data.entries = obj;
  }
}

export async function saveSupplementaryWorldbook(
  {
    worldName,
    entries,
    avatarId,
    upsert = false,
    pruneManaged = false,
    managedPrefix = '',
    defaultPosition = 4,
    defaultDepth = 2,
    defaultRole = 0,
    defaultOrder = 120,
  } = {},
  deps = {}
) {
  const cleanWorldName = String(worldName ?? '').trim();
  const cleanManagedPrefix = String(managedPrefix ?? '').trim();
  if (!cleanWorldName) {
    throw new Error('补充世界书名称不能为空');
  }
  if (!Array.isArray(entries)) {
    throw new Error('补充世界书条目必须为数组');
  }

  const bridge = getBridge();
  const ctx = await resolveHostContext(deps);

  const needWorldInfo =
    typeof deps?.loadWorldInfo !== 'function' ||
    typeof deps?.saveWorldInfo !== 'function' ||
    typeof deps?.createWorldInfoEntry !== 'function' ||
    typeof deps?.updateWorldInfoList !== 'function';

  const mods = await loadHostModules(
    {
      worldInfo: needWorldInfo,
      powerUser: Boolean(avatarId) && !hasImmediatePowerUser(deps, bridge, ctx),
      personas:
        Boolean(avatarId) &&
        ((deps?.userAvatar === undefined && bridge?.userAvatar === undefined) ||
          (typeof deps?.setPersonaDescription !== 'function' &&
            typeof bridge?.setPersonaDescription !== 'function')),
      script: Boolean(avatarId) && typeof deps?.saveSettingsDebounced !== 'function',
    },
    deps
  );

  const loadWorldInfoFn = deps?.loadWorldInfo ?? bridge?.loadWorldInfo ?? mods.worldInfo?.loadWorldInfo ?? null;
  const saveWorldInfoFn = deps?.saveWorldInfo ?? bridge?.saveWorldInfo ?? mods.worldInfo?.saveWorldInfo ?? null;
  const createWorldInfoEntryFn =
    deps?.createWorldInfoEntry ?? bridge?.createWorldInfoEntry ?? mods.worldInfo?.createWorldInfoEntry ?? null;
  const updateWorldInfoListFn =
    deps?.updateWorldInfoList ?? bridge?.updateWorldInfoList ?? mods.worldInfo?.updateWorldInfoList ?? null;

  if (typeof saveWorldInfoFn !== 'function') {
    throw new Error('当前环境缺少 saveWorldInfo 接口，无法保存补充世界书');
  }

  let data = null;
  if (typeof loadWorldInfoFn === 'function') {
    data = await loadWorldInfoFn(cleanWorldName);
  }
  if (!data || typeof data !== 'object') {
    data = { entries: {} };
  }
  normalizeWorldbookEntriesContainer(data);

  const uids = [];
  const claimedMapKeys = new Set();
  const incomingManagedSlotKeys = new Set();
  let createdCount = 0;
  let updatedCount = 0;
  let prunedCount = 0;

  for (const rawEntry of entries) {
    const content = String(rawEntry?.content ?? '').trim();
    if (!content) continue;

    const keys = Array.isArray(rawEntry.key)
      ? rawEntry.key.map((k) => String(k ?? '').trim()).filter(Boolean)
      : String(rawEntry.key ?? '')
          .split(/[,，/|、]/)
          .map((k) => k.trim())
          .filter(Boolean);
    const comment = String(rawEntry.comment ?? rawEntry.title ?? keys[0] ?? '补充背景').trim();

    const rawUpsMeta = getWorldEntryUpsMeta(rawEntry);
    const incomingSlotKey = String(rawUpsMeta?.slotKey ?? rawEntry?.slotKey ?? '').trim();
    const incomingManaged =
      rawUpsMeta?.managed !== undefined
        ? Boolean(rawUpsMeta.managed)
        : rawEntry?.managed !== undefined
          ? Boolean(rawEntry.managed)
          : Boolean(incomingSlotKey);

    let targetEntry = null;
    let targetMapKey = null;

    if (upsert === true) {
      const existingMapKeys = Object.keys(data.entries);

      // Pass 1: exact slotKey match
      if (incomingSlotKey) {
        const slotMatches = [];
        for (const mapKey of existingMapKeys) {
          if (claimedMapKeys.has(mapKey)) continue;
          const candidate = data.entries[mapKey];
          if (!candidate || typeof candidate !== 'object') continue;
          const meta = getWorldEntryUpsMeta(candidate);
          if (String(meta?.slotKey ?? '').trim() === incomingSlotKey) {
            slotMatches.push(mapKey);
          }
        }
        if (slotMatches.length > 0) {
          targetMapKey = slotMatches[0];
          targetEntry = data.entries[targetMapKey];
          // Self-heal extra managed duplicates sharing the same slotKey
          for (let i = 1; i < slotMatches.length; i += 1) {
            const dupKey = slotMatches[i];
            if (getWorldEntryUpsMeta(data.entries[dupKey])?.managed === true) {
              delete data.entries[dupKey];
              prunedCount += 1;
            }
          }
        }
      }

      // Pass 2: normalized (comment, key) signature match
      if (!targetEntry) {
        const inComment = normalizeWorldEntryText(comment);
        const inKeys = normalizeWorldEntryKeys(keys);
        for (const mapKey of existingMapKeys) {
          if (claimedMapKeys.has(mapKey)) continue;
          const candidate = data.entries[mapKey];
          if (!candidate || typeof candidate !== 'object') continue;
          const existingSlot = String(getWorldEntryUpsMeta(candidate)?.slotKey ?? '').trim();
          if (existingSlot && (!incomingSlotKey || existingSlot !== incomingSlotKey)) {
            continue;
          }
          const existingComment = normalizeWorldEntryText(candidate.comment);
          const existingKeyArr = Array.isArray(candidate.key)
            ? candidate.key
            : Array.isArray(candidate.keys)
              ? candidate.keys
              : [];
          const existingKeys = normalizeWorldEntryKeys(existingKeyArr);

          const matched =
            (inComment && existingComment === inComment && inKeys && existingKeys === inKeys) ||
            (inComment &&
              inComment !== '补充背景' &&
              existingComment === inComment &&
              (!inKeys || !existingKeys || hasWorldKeyOverlap(keys, existingKeyArr))) ||
            ((!inComment || inComment === '补充背景') &&
              (!existingComment || existingComment === '补充背景') &&
              inKeys &&
              existingKeys === inKeys);

          if (matched) {
            targetMapKey = mapKey;
            targetEntry = candidate;
            break;
          }
        }
      }
    }

    if (targetEntry) {
      updatedCount += 1;
    } else {
      const beforeKeys = new Set(Object.keys(data.entries));
      targetEntry =
        typeof createWorldInfoEntryFn === 'function'
          ? createWorldInfoEntryFn(cleanWorldName, data)
          : allocateFallbackWorldInfoEntry(data);
      createdCount += 1;
      if (targetEntry && typeof targetEntry === 'object') {
        targetMapKey =
          Object.keys(data.entries).find((k) => data.entries[k] === targetEntry) ||
          Object.keys(data.entries).find((k) => !beforeKeys.has(k)) ||
          (targetEntry.uid !== undefined && targetEntry.uid !== null ? String(targetEntry.uid) : null);
      }
    }

    if (targetMapKey !== null) {
      claimedMapKeys.add(targetMapKey);
    }
    if (incomingSlotKey && incomingManaged) {
      incomingManagedSlotKeys.add(incomingSlotKey);
    }

    targetEntry.key = keys;
    targetEntry.comment = comment;
    targetEntry.content = content;
    targetEntry.constant = Boolean(rawEntry.constant);
    targetEntry.selective = rawEntry.selective !== false;
    targetEntry.disable = Boolean(rawEntry.disable);
    targetEntry.addMemo = rawEntry.addMemo !== false;
    const fallbackPosition = Number.isFinite(Number(defaultPosition))
      ? Math.min(7, Math.max(0, Math.round(Number(defaultPosition))))
      : 4;
    const fallbackDepth = Number.isFinite(Number(defaultDepth))
      ? Math.min(99, Math.max(0, Math.round(Number(defaultDepth))))
      : 2;
    const fallbackRole = Number.isFinite(Number(defaultRole))
      ? Math.min(2, Math.max(0, Math.round(Number(defaultRole))))
      : 0;
    const fallbackOrder = Number.isFinite(Number(defaultOrder))
      ? Math.min(10000, Math.max(0, Math.round(Number(defaultOrder))))
      : 120;

    const hasExplicitPos =
      rawEntry.position !== undefined &&
      rawEntry.position !== null &&
      String(rawEntry.position).trim() !== '' &&
      Number.isFinite(Number(rawEntry.position));
    const hasExplicitDepth =
      rawEntry.depth !== undefined &&
      rawEntry.depth !== null &&
      String(rawEntry.depth).trim() !== '' &&
      Number.isFinite(Number(rawEntry.depth));
    const hasExplicitRole =
      rawEntry.role !== undefined &&
      rawEntry.role !== null &&
      String(rawEntry.role).trim() !== '' &&
      Number.isFinite(Number(rawEntry.role));
    const hasExplicitOrder =
      rawEntry.order !== undefined &&
      rawEntry.order !== null &&
      String(rawEntry.order).trim() !== '' &&
      Number.isFinite(Number(rawEntry.order));

    const resolvedPosition = hasExplicitPos
      ? Math.min(7, Math.max(0, Math.round(Number(rawEntry.position))))
      : hasExplicitDepth
        ? 4
        : fallbackPosition;
    const resolvedOrder = hasExplicitOrder
      ? Math.min(10000, Math.max(0, Math.round(Number(rawEntry.order))))
      : fallbackOrder;

    targetEntry.position = resolvedPosition;
    targetEntry.order = resolvedOrder;
    if (resolvedPosition === 4 || hasExplicitDepth) {
      targetEntry.depth = hasExplicitDepth
        ? Math.min(99, Math.max(0, Math.round(Number(rawEntry.depth))))
        : fallbackDepth;
    }
    if (resolvedPosition === 4 || hasExplicitRole) {
      targetEntry.role = hasExplicitRole
        ? Math.min(2, Math.max(0, Math.round(Number(rawEntry.role))))
        : fallbackRole;
    }

    if (incomingSlotKey || incomingManaged || rawUpsMeta || cleanManagedPrefix) {
      const prevExts =
        targetEntry.extensions && typeof targetEntry.extensions === 'object' ? targetEntry.extensions : {};
      const prevUps = getWorldEntryUpsMeta(targetEntry) || {};
      targetEntry.extensions = {
        ...prevExts,
        [EXTENSION_SETTINGS_KEY]: {
          ...prevUps,
          ...(rawUpsMeta || {}),
          ...(incomingSlotKey ? { slotKey: incomingSlotKey } : {}),
          ...(cleanManagedPrefix ? { managedPrefix: cleanManagedPrefix } : {}),
          managed: incomingManaged,
        },
      };
    }

    if (targetEntry.uid !== undefined && targetEntry.uid !== null) {
      uids.push(targetEntry.uid);
    }
  }

  if (pruneManaged === true) {
    for (const mapKey of Object.keys(data.entries)) {
      if (claimedMapKeys.has(mapKey)) continue;
      const entry = data.entries[mapKey];
      const meta = getWorldEntryUpsMeta(entry);
      if (meta && meta.managed === true) {
        const slot = String(meta.slotKey ?? '').trim();
        const entryPrefix = String(meta.managedPrefix ?? '').trim();
        if (cleanManagedPrefix) {
          const belongsToPrefix =
            entryPrefix === cleanManagedPrefix || (slot && slot.startsWith(cleanManagedPrefix));
          if (!belongsToPrefix) continue;
        }
        if (!slot || !incomingManagedSlotKeys.has(slot)) {
          delete data.entries[mapKey];
          prunedCount += 1;
        }
      }
    }
  }

  await saveWorldInfoFn(cleanWorldName, data, true);

  if (typeof updateWorldInfoListFn === 'function') {
    await updateWorldInfoListFn();
  }

  const boundAvatarId = String(avatarId ?? '').trim();
  if (boundAvatarId) {
    const liveDom = readLiveDomPersona(deps);
    const powerUser = resolvePowerUser(deps, bridge, ctx, mods.powerUser);
    if (powerUser && typeof powerUser === 'object') {
      if (boundAvatarId === LIVE_PERSONA_AVATAR_ID) {
        powerUser.persona_description_lorebook = cleanWorldName;
        const setPersonaDescriptionFn =
          deps?.setPersonaDescription ?? bridge?.setPersonaDescription ?? mods.personas?.setPersonaDescription ?? null;
        if (typeof setPersonaDescriptionFn === 'function') {
          setPersonaDescriptionFn();
        }
      } else {
        if (!powerUser.persona_descriptions || typeof powerUser.persona_descriptions !== 'object') {
          powerUser.persona_descriptions = {};
        }
        if (
          !Object.hasOwn(powerUser.persona_descriptions, boundAvatarId) ||
          !powerUser.persona_descriptions[boundAvatarId] ||
          typeof powerUser.persona_descriptions[boundAvatarId] !== 'object'
        ) {
          powerUser.persona_descriptions[boundAvatarId] = {
            description: '',
            position: 0,
            depth: 2,
            role: 0,
            lorebook: cleanWorldName,
            title: '',
            connections: [],
          };
        } else {
          powerUser.persona_descriptions[boundAvatarId].lorebook = cleanWorldName;
        }

        const activeAvatarId = resolveActiveAvatarId(
          deps,
          bridge,
          ctx,
          mods.personas,
          powerUser,
          liveDom.doc
        );
        if (boundAvatarId === activeAvatarId) {
          powerUser.persona_description_lorebook = cleanWorldName;
          const setPersonaDescriptionFn =
            deps?.setPersonaDescription ?? bridge?.setPersonaDescription ?? mods.personas?.setPersonaDescription ?? null;
          if (typeof setPersonaDescriptionFn === 'function') {
            setPersonaDescriptionFn();
          }
        }
      }

      const saveDebounced =
        deps?.saveSettingsDebounced ??
        bridge?.saveSettingsDebounced ??
        ctx?.saveSettingsDebounced ??
        mods.script?.saveSettingsDebounced ??
        null;
      if (typeof saveDebounced === 'function') {
        await saveDebounced();
      }

      const eventSource = deps?.eventSource ?? bridge?.eventSource ?? ctx?.eventSource ?? null;
      const eventTypes = deps?.eventTypes ?? bridge?.eventTypes ?? ctx?.eventTypes ?? {};
      await eventSource?.emit?.(eventTypes.PERSONA_UPDATED ?? 'persona_updated', boundAvatarId);
    }
  }

  return {
    worldName: cleanWorldName,
    entryCount: uids.length,
    uids,
    boundAvatarId,
    createdCount,
    updatedCount,
    prunedCount,
  };
}

export async function estimateHostTokens(text, deps = {}) {
  const str = String(text ?? '');
  if (!str.trim()) return 0;

  const bridge = getBridge();
  const ctx = await resolveHostContext(deps);
  const tokenCounter =
    deps?.getTokenCountAsync ??
    bridge?.getTokenCountAsync ??
    ctx?.getTokenCountAsync ??
    null;

  if (typeof tokenCounter === 'function') {
    try {
      const count = await tokenCounter(str);
      if (Number.isFinite(Number(count)) && Number(count) >= 0) {
        return Math.round(Number(count));
      }
    } catch {
      // Fall back to deterministic pure estimator
    }
  }

  return estimateTokens(str);
}
