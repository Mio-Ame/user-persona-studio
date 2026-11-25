import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  EXTENSION_SETTINGS_KEY,
  HOST_CUSTOM_EVENTS,
  LIVE_PERSONA_AVATAR_ID,
  buildImportCandidates,
  getHostContext,
  resolveHostContext,
  getHostRequestHeaders,
  _resetHostCacheForTests,
  waitForHostReady,
  loadSettings,
  saveSettings,
  getActivePersona,
  listPersonas,
  listCharacters,
  listWorldbooks,
  getCharacterContext,
  getActiveCharacterContext,
  loadCharacterWorldbookEntries,
  savePersonaToHost,
  saveSupplementaryWorldbook,
  estimateHostTokens,
} from '../src/host.js';

import {
  scrubApiKeyFromText,
  createLinkedAbortSignal,
  classifyApiError,
  runStudioGeneration,
  fetchCustomModels,
  testCustomConnection,
} from '../src/api.js';

import { createDefaultSettings, createApiProfile } from '../src/core.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

function makeByteStream(chunks) {
  const encoder = new TextEncoder();
  let idx = 0;
  return new ReadableStream({
    pull(controller) {
      if (idx >= chunks.length) {
        controller.close();
        return;
      }
      const item = chunks[idx++];
      controller.enqueue(item instanceof Uint8Array ? item : encoder.encode(String(item)));
    },
  });
}

// ============================================================================
// Group M: Manifest & Hygiene Checks
// ============================================================================

test('M1: manifest.json matches SillyTavern extension contract', () => {
  const manifestPath = path.join(PROJECT_ROOT, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.display_name, '客制化成长型 User 人设工坊');
  assert.equal(manifest.loading_order, 12);
  assert.deepEqual(manifest.requires, []);
  assert.deepEqual(manifest.optional, []);
  assert.equal(manifest.js, 'index.js');
  assert.equal(manifest.css, 'style.css');
  assert.equal(manifest.author, 'Mio-Ame');
  assert.equal(manifest.version, '1.6.0');
  assert.equal(manifest.homePage, 'https://github.com/Mio-Ame/user-persona-studio');
  assert.equal(manifest.auto_update, true);
  assert.equal(manifest.minimum_client_version, '1.12.0');
});

// ============================================================================
// Group H: src/host.js Tests (H1 - H8)
// ============================================================================

test('H1: waitForHostReady handles missing, resolving, rejecting, and timed-out TauriTavern promises', async () => {
  const origTT = globalThis.__TAURITAVERN__;
  const origMainReady = globalThis.__TAURITAVERN_MAIN_READY__;
  try {
    delete globalThis.__TAURITAVERN__;
    delete globalThis.__TAURITAVERN_MAIN_READY__;

    // Absent TT global resolves true immediately
    assert.equal(await waitForHostReady({}, { skipDynamicImport: true }), true);

    // Resolving deferred TT ready promise
    let resolveReady;
    globalThis.__TAURITAVERN__ = {
      ready: new Promise((resolve) => {
        resolveReady = resolve;
      }),
    };
    const pending = waitForHostReady({ timeoutMs: 1000 }, { skipDynamicImport: true });
    resolveReady();
    assert.equal(await pending, true);

    // Rejecting TT ready promise resolves false without throwing
    globalThis.__TAURITAVERN__ = {
      ready: Promise.reject(new Error('tt-init-failed')),
    };
    assert.equal(await waitForHostReady({ timeoutMs: 1000 }, { skipDynamicImport: true }), false);

    // Hung TT ready promise hits timeout and returns false cleanly
    globalThis.__TAURITAVERN__ = {
      ready: new Promise(() => {}),
    };
    assert.equal(await waitForHostReady({ timeoutMs: 25 }, { skipDynamicImport: true }), false);
  } finally {
    if (origTT === undefined) delete globalThis.__TAURITAVERN__;
    else globalThis.__TAURITAVERN__ = origTT;
    if (origMainReady === undefined) delete globalThis.__TAURITAVERN_MAIN_READY__;
    else globalThis.__TAURITAVERN_MAIN_READY__ = origMainReady;
  }
});

test('H2: loadSettings & saveSettings initialize defaults, preserve partial overrides, and invoke saveSettingsDebounced', async () => {
  _resetHostCacheForTests();
  const extensionSettings = {};
  let saveCount = 0;
  const ctx = {
    extensionSettings,
    saveSettingsDebounced: () => {
      saveCount += 1;
    },
  };

  // Fresh initialization
  const initial = await loadSettings({ ctx, skipDynamicImport: true });
  assert.equal(initial.version, 1);
  assert.equal(initial.palette, 'paper');
  assert.equal(initial.schemes.length, 3);
  assert.equal(extensionSettings[EXTENSION_SETTINGS_KEY], initial);

  // Partial legacy merge preserves custom palette and taste entries while keeping built-in schemes
  extensionSettings[EXTENSION_SETTINGS_KEY] = {
    palette: 'ink',
    tasteProfile: {
      anchors: [{ text: '偏爱安静手冲咖啡馆的清晨节奏' }],
    },
  };
  const merged = await loadSettings({ ctx, skipDynamicImport: true });
  assert.equal(merged.palette, 'ink');
  assert.equal(merged.schemes.length, 3);
  assert.equal(merged.tasteProfile.anchors.length, 1);
  assert.equal(merged.tasteProfile.anchors[0].text, '偏爱安静手冲咖啡馆的清晨节奏');

  // saveSettings normalizes and triggers saveSettingsDebounced once
  merged.colorMode = 'dark';
  const saved = await saveSettings(merged, { ctx, skipDynamicImport: true });
  assert.equal(saved.colorMode, 'dark');
  assert.equal(extensionSettings[EXTENSION_SETTINGS_KEY].colorMode, 'dark');
  assert.equal(saveCount, 1);
});

test('H3: getActivePersona, listPersonas, and getActiveCharacterContext handle CJK names, index 0, unshallow, and public-only filtering', async () => {
  const powerUser = {
    default_persona: 'beta.png',
    personas: {
      'alpha.png': '旅人一号',
      'beta.png': '默认档案乙',
    },
    persona_descriptions: {
      'alpha.png': {
        description: '外显稳重的新任书记官。',
        title: '书记官',
        lorebook: 'wb_alpha',
        position: 0,
        depth: 2,
        role: 0,
      },
      'beta.png': {
        description: '常规档案内容。',
        title: '默认',
        lorebook: '',
        position: 1,
        depth: 3,
        role: 1,
      },
      'orphan.png': {
        description: '仅保留描述的孤儿人设。',
        title: '孤儿',
      },
    },
    persona_description: '活跃镜像文本',
    persona_description_position: 0,
    persona_description_depth: 2,
    persona_description_role: 0,
    persona_description_lorebook: 'wb_alpha',
  };

  // Absent powerUser + empty DOM returns null; present powerUser with empty user_avatar falls back to default_persona
  assert.equal(
    await getActivePersona({ powerUser: null, document: null, userAvatar: '', skipDynamicImport: true }),
    null
  );
  const fallbackDefault = await getActivePersona({ powerUser, document: null, userAvatar: '', skipDynamicImport: true });
  assert.equal(fallbackDefault.avatarId, 'beta.png');
  assert.equal(fallbackDefault.isDefault, true);

  const active = await getActivePersona({ powerUser, userAvatar: 'alpha.png', skipDynamicImport: true });
  assert.equal(active.avatarId, 'alpha.png');
  assert.equal(active.name, '旅人一号');
  assert.equal(active.isActive, true);
  assert.equal(active.isDefault, false);

  const listed = await listPersonas({ powerUser, userAvatar: 'alpha.png', skipDynamicImport: true });
  assert.equal(listed.length, 3);
  assert.equal(listed[0].avatarId, 'alpha.png'); // active first
  assert.equal(listed[1].avatarId, 'beta.png');  // default second
  assert.equal(listed[2].avatarId, 'orphan.png'); // descriptor-only orphan included

  // Character context: undefined returns null
  assert.equal(
    await getActiveCharacterContext({}, { ctx: { characterId: undefined, characters: [] }, skipDynamicImport: true }),
    null
  );

  // Character index 0 (numeric) + shallow unshallow + private field exclusion
  let unshallowedId = null;
  const characters = [
    {
      avatar: 'char0.png',
      name: '测试角色甲',
      shallow: true,
      data: { extensions: { world: '公共世界观甲' } },
    },
  ];
  const ctx = {
    characterId: 0,
    name2: '测试角色甲',
    chatId: 'chat-001',
    characters,
    unshallowCharacter: async (chid) => {
      unshallowedId = chid;
      characters[0].shallow = false;
    },
    getCharacterCardFields: () => ({
      description: '公开外貌与职业背景',
      personality: '公开待人尺度',
      scenario: '雨夜书店大厅',
      firstMessage: '柜台后的灯光亮着。',
      system: 'PRIVATE_SYSTEM_PROMPT',
      jailbreak: 'PRIVATE_JAILBREAK',
      creatorNotes: 'PRIVATE_NOTES',
      charDepthPrompt: 'PRIVATE_DEPTH',
      mesExamples: 'PRIVATE_EXAMPLES',
      persona: 'PRIVATE_PERSONA_OVERRIDE',
    }),
  };

  const charCtx = await getActiveCharacterContext({}, { ctx, skipDynamicImport: true });
  assert.equal(unshallowedId, 0);
  assert.equal(charCtx.characterId, '0');
  assert.equal(charCtx.name, '测试角色甲');
  assert.equal(charCtx.worldName, '公共世界观甲');
  assert.equal(charCtx.worldSummary, '关联世界书：公共世界观甲');
  assert.equal(charCtx.description, '公开外貌与职业背景');
  assert.equal(charCtx.shallow, false);
  for (const priv of ['system', 'jailbreak', 'creatorNotes', 'charDepthPrompt', 'mesExamples', 'persona']) {
    assert.equal(Object.hasOwn(charCtx, priv), false, `Must omit private field: ${priv}`);
  }
});

test('H4: savePersonaToHost overwrite syncs active mirror fields only for active persona and preserves omitted fields', async () => {
  const powerUser = {
    personas: {
      'active.png': '当前人设',
      'other.png': '备用人设',
    },
    persona_descriptions: {
      'active.png': {
        description: '旧正文',
        position: 4,
        depth: 3,
        role: 2,
        lorebook: 'wb_old',
        title: '旧头衔',
        connections: [{ type: 'character', id: 'char_a.png' }],
      },
      'other.png': {
        description: '备用旧正文',
        position: 1,
        depth: 5,
        role: 0,
        lorebook: 'wb_other',
        title: '备用头衔',
        connections: [{ type: 'group', id: 'grp_1' }],
      },
    },
    persona_description: '旧正文',
    persona_description_position: 4,
    persona_description_depth: 3,
    persona_description_role: 2,
    persona_description_lorebook: 'wb_old',
  };

  const events = [];
  let setPersonaDescCalls = 0;
  let saveCalls = 0;
  const avatarRefreshCalls = [];

  const commonDeps = {
    powerUser,
    userAvatar: 'active.png',
    setPersonaDescription: () => {
      setPersonaDescCalls += 1;
    },
    saveSettingsDebounced: () => {
      saveCalls += 1;
    },
    getUserAvatars: async (doRender, openAt) => {
      avatarRefreshCalls.push({ doRender, openAt });
    },
    eventSource: {
      emit: async (type, payload) => {
        events.push({ type, payload });
      },
    },
    eventTypes: { PERSONA_UPDATED: 'persona_updated', PERSONA_RENAMED: 'persona_renamed' },
    skipDynamicImport: true,
  };

  // Overwriting active persona updates both descriptor and all 5 mirror fields while preserving omitted fields
  const res1 = await savePersonaToHost(
    { mode: 'overwrite', avatarId: 'active.png', description: '新正文甲' },
    commonDeps
  );
  assert.equal(res1.isNew, false);
  assert.equal(powerUser.persona_descriptions['active.png'].description, '新正文甲');
  assert.equal(powerUser.persona_descriptions['active.png'].title, '旧头衔');
  assert.equal(powerUser.persona_descriptions['active.png'].position, 4);
  assert.deepEqual(powerUser.persona_descriptions['active.png'].connections, [{ type: 'character', id: 'char_a.png' }]);
  assert.equal(powerUser.persona_description, '新正文甲');
  assert.equal(powerUser.persona_description_position, 4);
  assert.equal(powerUser.persona_description_depth, 3);
  assert.equal(powerUser.persona_description_role, 2);
  assert.equal(powerUser.persona_description_lorebook, 'wb_old');
  assert.equal(setPersonaDescCalls, 1);
  assert.equal(saveCalls, 1);
  assert.equal(events.some((e) => e.type === 'persona_updated' && e.payload === 'active.png'), true);
  assert.deepEqual(avatarRefreshCalls[0], { doRender: true, openAt: 'active.png' });

  // Overwriting inactive persona must NOT clobber active mirror fields
  await savePersonaToHost(
    { mode: 'overwrite', avatarId: 'other.png', description: '备用新正文' },
    commonDeps
  );
  assert.equal(powerUser.persona_descriptions['other.png'].description, '备用新正文');
  assert.deepEqual(powerUser.persona_descriptions['other.png'].connections, [{ type: 'group', id: 'grp_1' }]);
  assert.equal(powerUser.persona_description, '新正文甲');
  assert.equal(setPersonaDescCalls, 1);
});

test('H5: savePersonaToHost create uploads FormData avatar, uses CJK fallback avatarId, and handles errors', async () => {
  const powerUser = {
    personas: {},
    persona_descriptions: {},
    persona_description: '',
    persona_description_position: 0,
    persona_description_depth: 2,
    persona_description_role: 0,
    persona_description_lorebook: '',
  };

  let uploadedForm = null;
  let uploadedHeaders = null;
  const initCalls = [];
  const activeCalls = [];
  const emitted = [];

  const mockFetch = async (url, init) => {
    if (url === 'img/user-default.png') {
      return {
        ok: true,
        blob: async () => new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' }),
      };
    }
    if (url === '/api/avatars/upload') {
      uploadedForm = init.body;
      uploadedHeaders = init.headers;
      return {
        ok: true,
        json: async () => ({ path: String(init.body.get('overwrite_name')) }),
      };
    }
    throw new Error(`Unexpected url ${url}`);
  };

  const result = await savePersonaToHost(
    {
      mode: 'create',
      name: '纯中文人设',
      description: '完整设定正文',
      title: '观察者',
      setAsActive: true,
    },
    {
      powerUser,
      fetch: mockFetch,
      getRequestHeaders: (opts) => (opts?.omitContentType ? { 'X-CSRF-Token': 'tok' } : { 'Content-Type': 'application/json' }),
      initPersona: async (avatarId, name, desc, title, opts) => {
        initCalls.push({ avatarId, name, desc, title, opts });
        powerUser.personas[avatarId] = name;
        powerUser.persona_descriptions[avatarId] = { description: desc, title, ...opts };
      },
      setUserAvatar: async (avatarId, opts) => {
        activeCalls.push({ avatarId, opts });
      },
      getUserAvatars: async () => {},
      eventSource: {
        emit: async (t, p) => emitted.push({ t, p }),
      },
      skipDynamicImport: true,
    }
  );

  assert.equal(result.isNew, true);
  assert.match(result.avatarId, /^\d+-\.png$/);
  assert.ok(uploadedForm instanceof FormData);
  assert.ok(uploadedForm.get('avatar'));
  assert.equal(uploadedForm.get('overwrite_name'), result.avatarId);
  assert.equal(uploadedHeaders['Content-Type'], undefined);
  assert.equal(uploadedHeaders['X-CSRF-Token'], 'tok');
  assert.equal(initCalls.length, 1);
  assert.equal(activeCalls.length, 1);
  assert.equal(activeCalls[0].avatarId, result.avatarId);
  assert.equal(powerUser.persona_description, '完整设定正文');

  // Non-ok upload must throw clear Chinese error
  await assert.rejects(
    () =>
      savePersonaToHost(
        { mode: 'create', name: 'ErrorCase', description: 'x' },
        {
          powerUser,
          fetch: async (url) =>
            url === 'img/user-default.png'
              ? { ok: false, status: 404 }
              : { ok: false, status: 500 },
          skipDynamicImport: true,
        }
      ),
    /上传新人设头像失败/
  );
});

test('H6: ups:persona-saved CustomEvent bridge dispatches safely and tolerates absent window or hostile listeners', async () => {
  const powerUser = {
    personas: { 'p1.png': '档案一' },
    persona_descriptions: { 'p1.png': { description: '旧' } },
  };
  const dispatched = [];
  class FakeCustomEvent {
    constructor(type, init) {
      this.type = type;
      this.detail = init?.detail;
    }
  }

  const fakeWindow = {
    dispatchEvent: (evt) => {
      dispatched.push(evt);
    },
  };

  await savePersonaToHost(
    { mode: 'overwrite', avatarId: 'p1.png', description: '更新正文', lorebook: 'wb_1' },
    {
      powerUser,
      userAvatar: 'p1.png',
      ctx: { characterId: 0, chatId: 'chat_99' },
      window: fakeWindow,
      CustomEvent: FakeCustomEvent,
      skipDynamicImport: true,
    }
  );

  assert.equal(dispatched.length, 1);
  assert.equal(dispatched[0].type, HOST_CUSTOM_EVENTS.PERSONA_SAVED);
  assert.deepEqual(dispatched[0].detail, {
    avatarId: 'p1.png',
    name: '档案一',
    description: '更新正文',
    lorebook: 'wb_1',
    isNew: false,
    characterId: '0',
    chatId: 'chat_99',
    mode: 'overwrite',
  });

  // Hostile listener throwing must not crash savePersonaToHost
  await savePersonaToHost(
    { mode: 'overwrite', avatarId: 'p1.png', description: '再次更新' },
    {
      powerUser,
      userAvatar: 'p1.png',
      window: {
        dispatchEvent: () => {
          throw new Error('listener exploded');
        },
      },
      CustomEvent: FakeCustomEvent,
      skipDynamicImport: true,
    }
  );
});

test('H7: saveSupplementaryWorldbook creates selective green-light entries, saves immediately, and binds persona lorebook', async () => {
  const savedCalls = [];
  let listUpdated = false;
  let saveSettingsCalled = 0;
  let setPersonaDescCalled = 0;
  const emitted = [];

  const powerUser = {
    personas: { 'p1.png': '档案一' },
    persona_descriptions: { 'p1.png': { description: '核心', lorebook: '' } },
    persona_description_lorebook: '',
  };

  const res = await saveSupplementaryWorldbook(
    {
      worldName: '用户补充设定集',
      avatarId: 'p1.png',
      entries: [
        { key: ['旧怀表', '修表铺'], comment: '祖父修表铺', content: '街角老修表铺的来历与手艺习惯。' },
        { key: '夜班', comment: '夜班习惯', content: '夜班后总在便利店买热豆浆。' },
      ],
    },
    {
      powerUser,
      userAvatar: 'p1.png',
      loadWorldInfo: async () => null,
      createWorldInfoEntry: (_name, data) => {
        const uid = Object.keys(data.entries).length;
        data.entries[uid] = { uid };
        return data.entries[uid];
      },
      saveWorldInfo: async (name, data, immediately) => {
        savedCalls.push({ name, data, immediately });
      },
      updateWorldInfoList: async () => {
        listUpdated = true;
      },
      setPersonaDescription: () => {
        setPersonaDescCalled += 1;
      },
      saveSettingsDebounced: () => {
        saveSettingsCalled += 1;
      },
      eventSource: {
        emit: async (type, payload) => emitted.push({ type, payload }),
      },
      eventTypes: { PERSONA_UPDATED: 'persona_updated' },
      skipDynamicImport: true,
    }
  );

  assert.equal(res.worldName, '用户补充设定集');
  assert.equal(res.entryCount, 2);
  assert.equal(res.boundAvatarId, 'p1.png');
  assert.equal(savedCalls.length, 1);
  assert.equal(savedCalls[0].immediately, true);
  assert.equal(listUpdated, true);

  const entry0 = savedCalls[0].data.entries[0];
  assert.equal(entry0.constant, false);
  assert.equal(entry0.selective, true);
  assert.equal(entry0.disable, false);
  assert.equal(entry0.position, 4);
  assert.equal(entry0.depth, 2);
  assert.equal(entry0.role, 0);
  assert.equal(entry0.order, 120);
  assert.deepEqual(entry0.key, ['旧怀表', '修表铺']);
  assert.equal(powerUser.persona_descriptions['p1.png'].lorebook, '用户补充设定集');
  assert.equal(powerUser.persona_description_lorebook, '用户补充设定集');
  assert.equal(setPersonaDescCalled, 1);
  assert.equal(saveSettingsCalled, 1);
  assert.equal(emitted.some((e) => e.type === 'persona_updated' && e.payload === 'p1.png'), true);
});

test('H8: estimateHostTokens prefers getTokenCountAsync and falls back to estimateTokens when missing or rejecting', async () => {
  assert.equal(await estimateHostTokens('   ', { skipDynamicImport: true }), 0);

  const exact = await estimateHostTokens('一段测试文本', {
    getTokenCountAsync: async () => 42,
    skipDynamicImport: true,
  });
  assert.equal(exact, 42);

  const fallbackOnReject = await estimateHostTokens('一段测试文本', {
    getTokenCountAsync: async () => {
      throw new Error('tokenizer unavailable');
    },
    skipDynamicImport: true,
  });
  assert.ok(fallbackOnReject > 0);

  const fallbackOnMissing = await estimateHostTokens('一段测试文本', {
    ctx: null,
    skipDynamicImport: true,
  });
  assert.equal(fallbackOnMissing, fallbackOnReject);
});

test('H9: getHostContext, resolveHostContext, and getHostRequestHeaders fallbacks work cleanly', async () => {
  const prevBridge = globalThis.__UPS_HOST_BRIDGE__;
  try {
    globalThis.__UPS_HOST_BRIDGE__ = {
      context: { mainApi: 'openai', getRequestHeaders: () => ({ 'X-Bridge': '1' }) },
    };
    assert.equal(getHostContext().mainApi, 'openai');
    assert.equal((await resolveHostContext({ skipDynamicImport: true })).mainApi, 'openai');
    assert.deepEqual(await getHostRequestHeaders({}, { skipDynamicImport: true }), { 'X-Bridge': '1' });

    delete globalThis.__UPS_HOST_BRIDGE__;
    assert.deepEqual(
      await getHostRequestHeaders({ omitContentType: true }, { ctx: null, skipDynamicImport: true }),
      {}
    );
    assert.deepEqual(
      await getHostRequestHeaders({ omitContentType: false }, { ctx: null, skipDynamicImport: true }),
      { 'Content-Type': 'application/json' }
    );
  } finally {
    if (prevBridge === undefined) delete globalThis.__UPS_HOST_BRIDGE__;
    else globalThis.__UPS_HOST_BRIDGE__ = prevBridge;
  }
});

// ============================================================================
// Group A: src/api.js Tests (A1 - A12)
// ============================================================================

test('A1: runStudioGeneration host mode uses ChatCompletionService.sendRequest (non-stream)', async () => {
  const settings = createDefaultSettings();
  let capturedSignal = null;

  const ctx = {
    mainApi: 'openai',
    chatCompletionSettings: {
      chat_completion_source: 'openai',
      openai_model: 'gpt-4o-mini',
      stream_openai: true,
    },
    ChatCompletionService: {
      presetToGeneratePayload: async (_p, _o, override) => ({ ...override, chat_completion_source: 'openai' }),
      sendRequest: async (_data, _extract, sig) => {
        capturedSignal = sig;
        return { content: '生成结果正文', reasoning: '内部推理不应混入' };
      },
    },
  };

  const ac = new AbortController();
  const res = await runStudioGeneration({
    settings,
    messages: [{ role: 'user', content: '生成人设' }],
    signal: ac.signal,
    deps: { ctx, skipDynamicImport: true },
  });

  assert.equal(capturedSignal, ac.signal);
  assert.equal(res.text, '生成结果正文');
  assert.equal(res.source, 'host:chat-completion');
});

test('A2: runStudioGeneration host mode consumes ChatCompletionService stream generator factory with cumulative deltas', async () => {
  const settings = createDefaultSettings();
  const chunks = [];

  const ctx = {
    mainApi: 'openai',
    chatCompletionSettings: {
      chat_completion_source: 'openai',
      openai_model: 'gpt-4o-mini',
      stream_openai: true,
    },
    ChatCompletionService: {
      createRequestData: (d) => d,
      sendRequest: async () => {
        return async function* streamData() {
          yield { text: '第1段' };
          yield { text: '第1段第2段' };
        };
      },
    },
  };

  const res = await runStudioGeneration({
    settings,
    messages: [{ role: 'user', content: '流式测试' }],
    onChunk: (delta, full) => chunks.push({ delta, full }),
    deps: { ctx, skipDynamicImport: true },
  });

  assert.deepEqual(chunks, [
    { delta: '第1段', full: '第1段' },
    { delta: '第2段', full: '第1段第2段' },
  ]);
  assert.equal(res.text, '第1段第2段');
  assert.equal(res.source, 'host:chat-completion');
});

test('A3: runStudioGeneration host generateRaw clones messages and consumes returned stream generator with warning', async () => {
  const settings = createDefaultSettings();
  const originalMessages = [{ role: 'user', content: '原始消息' }];

  // (a) Non-openai mainApi clones messages before passing to generateRaw
  const ctxA = {
    mainApi: 'textgenerationwebui',
    generateRaw: async ({ prompt }) => {
      prompt[0].content = 'MUTATED_BY_HOST';
      return '普通生成文本';
    },
  };
  const resA = await runStudioGeneration({
    settings,
    messages: originalMessages,
    deps: { ctx: ctxA, skipDynamicImport: true },
  });
  assert.equal(originalMessages[0].content, '原始消息');
  assert.equal(resA.text, '普通生成文本');
  assert.equal(resA.source, 'host:generate-raw');

  // (b) openai + stream_openai = true without ChatCompletionService consumes generator from generateRaw + emits warning
  const chunks = [];
  const ctxB = {
    mainApi: 'openai',
    chatCompletionSettings: { stream_openai: true },
    generateRaw: async () => {
      return async function* () {
        yield { text: '片段A' };
        yield { text: '片段A片段B' };
      };
    },
  };
  const resB = await runStudioGeneration({
    settings,
    messages: originalMessages,
    onChunk: (d, f) => chunks.push({ d, f }),
    deps: { ctx: ctxB, skipDynamicImport: true },
  });
  assert.equal(resB.text, '片段A片段B');
  assert.equal(resB.source, 'host:generate-raw');
  assert.ok(resB.warning && resB.warning.includes('流式输出'));
  assert.deepEqual(chunks, [
    { d: '片段A', f: '片段A' },
    { d: '片段B', f: '片段A片段B' },
  ]);
});

test('A4: runStudioGeneration host fallback generateQuietPrompt and unconfigured host errors', async () => {
  const settings = createDefaultSettings();
  let capturedQuietOpts = null;

  const ctx = {
    mainApi: 'novel',
    generateQuietPrompt: async (opts) => {
      capturedQuietOpts = opts;
      return '静默通道输出';
    },
  };

  const res = await runStudioGeneration({
    settings,
    messages: [
      { role: 'system', content: '系统设定' },
      { role: 'user', content: '用户灵感' },
    ],
    deps: { ctx, skipDynamicImport: true },
  });
  assert.equal(capturedQuietOpts.skipWIAN, true);
  assert.equal(capturedQuietOpts.quietToLoud, false);
  assert.match(capturedQuietOpts.quietPrompt, /\[system\]/);
  assert.equal(res.text, '静默通道输出');
  assert.equal(res.source, 'host:quiet-prompt');
  assert.ok(res.warning);

  // Missing ctx error
  await assert.rejects(
    () =>
      runStudioGeneration({
        settings,
        messages: [{ role: 'user', content: 'hi' }],
        deps: { ctx: null, skipDynamicImport: true },
      }),
    /未检测到酒馆运行环境/
  );

  // Unconfigured mainApi === 'none'
  await assert.rejects(
    () =>
      runStudioGeneration({
        settings,
        messages: [{ role: 'user', content: 'hi' }],
        deps: { ctx: { mainApi: 'none' }, skipDynamicImport: true },
      }),
    /尚未配置可用的 AI 连接/
  );
});

test('A5: runStudioGeneration custom ST proxy SSE streaming handles split chunks & UTF-8 boundaries', async () => {
  const profile = createApiProfile({
    id: 'p_custom',
    name: '自定义中转',
    baseUrl: 'https://api.example.test/v1',
    apiKey: 'sk-mock-proxy-1234',
    model: 'model-test',
    stream: true,
  });
  const settings = createDefaultSettings({
    api: { provider: 'custom', activeProfileId: profile.id, profiles: [profile] },
  });

  const encoder = new TextEncoder();
  const fullLine1 = 'data: {"choices":[{"delta":{"content":"你好"}}]}\n\n';
  const splitBytes = encoder.encode(fullLine1);
  // Split right inside multi-byte UTF-8 Chinese characters AND JSON structure
  const part1 = splitBytes.slice(0, 38);
  const part2 = splitBytes.slice(38);

  let capturedUrl = '';
  let capturedBody = null;
  let capturedHeaders = null;
  const mockFetch = async (url, init) => {
    capturedUrl = url;
    capturedHeaders = init.headers;
    capturedBody = JSON.parse(init.body);
    return {
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/event-stream' }),
      body: makeByteStream([
        part1,
        part2,
        'data: {"choices":[{"delta":{"content":"世界"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n',
      ]),
    };
  };

  const deltas = [];
  const res = await runStudioGeneration({
    settings,
    messages: [{ role: 'user', content: '测试' }],
    onChunk: (d, f) => deltas.push({ d, f }),
    deps: {
      fetch: mockFetch,
      getRequestHeaders: () => ({ 'Content-Type': 'application/json', 'X-CSRF-Token': 'abc' }),
      skipDynamicImport: true,
    },
  });

  assert.equal(capturedUrl, '/api/backends/chat-completions/generate');
  assert.equal(capturedHeaders['X-CSRF-Token'], 'abc');
  assert.equal(capturedBody.chat_completion_source, 'custom');
  assert.deepEqual(JSON.parse(capturedBody.custom_include_headers), {
    Authorization: 'Bearer sk-mock-proxy-1234',
  });
  assert.deepEqual(deltas, [
    { d: '你好', f: '你好' },
    { d: '世界', f: '你好世界' },
  ]);
  assert.equal(res.text, '你好世界');
  assert.equal(res.source, 'custom:proxy');
});

test('A6: runStudioGeneration custom stream JSON sniffer falls back to JSON parsing when SSE header is missing', async () => {
  const profile = createApiProfile({
    id: 'p_sniff',
    baseUrl: 'https://api.example.test/v1',
    apiKey: '',
    model: 'model-test',
    stream: true,
  });
  const settings = createDefaultSettings({
    api: { provider: 'custom', activeProfileId: profile.id, profiles: [profile] },
  });

  const chunks = [];
  const mockFetch = async () => ({
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'text/plain' }),
    body: makeByteStream([
      '  {"choices":[{"message":',
      '{"content":"JSON直出"},"finish_reason":"stop"}]}',
    ]),
  });

  const res = await runStudioGeneration({
    settings,
    messages: [{ role: 'user', content: '测试' }],
    onChunk: (d, f) => chunks.push({ d, f }),
    deps: { fetch: mockFetch, skipDynamicImport: true },
  });

  assert.equal(res.text, 'JSON直出');
  assert.deepEqual(chunks, [{ d: 'JSON直出', f: 'JSON直出' }]);
});

test('A7: runStudioGeneration classifies ST proxy HTTP 200 quota_error and HTTP 400 Unauthorized stream rewrite', async () => {
  const profile = createApiProfile({
    id: 'p_err',
    baseUrl: 'https://api.example.test/v1',
    apiKey: 'sk-mock-test-err-0001',
    model: 'model-test',
    stream: false,
  });
  const settings = createDefaultSettings({
    api: { provider: 'custom', activeProfileId: profile.id, profiles: [profile] },
  });

  // (a) HTTP 200 with { error, quota_error: true }
  await assert.rejects(
    () =>
      runStudioGeneration({
        settings,
        messages: [{ role: 'user', content: 'hi' }],
        deps: {
          fetch: async () => ({
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
            text: async () => JSON.stringify({ error: { message: 'Too Many Requests' }, quota_error: true }),
          }),
          skipDynamicImport: true,
        },
      }),
    (err) => err.code === 'RATE_LIMIT' && err.message.includes('429')
  );

  // (b) HTTP 400 statusText: Unauthorized (ST streaming rewrite of upstream 401)
  await assert.rejects(
    () =>
      runStudioGeneration({
        settings,
        messages: [{ role: 'user', content: 'hi' }],
        deps: {
          fetch: async () => ({
            ok: false,
            status: 400,
            statusText: 'Unauthorized',
            text: async () => 'Authentication failed',
          }),
          skipDynamicImport: true,
        },
      }),
    (err) => err.code === 'AUTH_ERROR' && err.message.includes('鉴权失败')
  );
});

test('A8: runStudioGeneration custom openai_direct standalone transport', async () => {
  const profile = createApiProfile({
    id: 'p_direct',
    baseUrl: 'https://api.example.test/v1',
    apiKey: 'sk-mock-direct-1234',
    model: 'model-direct',
    stream: false,
  });
  const settings = createDefaultSettings({
    api: { provider: 'custom', activeProfileId: profile.id, profiles: [profile] },
  });

  let requestedUrl = '';
  let requestedHeaders = null;
  let requestedBody = null;

  const res = await runStudioGeneration({
    settings,
    messages: [{ role: 'user', content: 'hello' }],
    deps: {
      transport: 'direct',
      fetch: async (url, init) => {
        requestedUrl = url;
        requestedHeaders = init.headers;
        requestedBody = JSON.parse(init.body);
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          text: async () => JSON.stringify({ choices: [{ message: { content: '直连输出' }, finish_reason: 'stop' }] }),
        };
      },
      skipDynamicImport: true,
    },
  });

  assert.equal(requestedUrl, 'https://api.example.test/v1/chat/completions');
  assert.equal(requestedHeaders.Authorization, 'Bearer sk-mock-direct-1234');
  assert.equal(requestedBody.model, 'model-direct');
  assert.equal(res.text, '直连输出');
  assert.equal(res.source, 'custom:direct');
});

test('A9: zero API key leakage across errors, stacks, testCustomConnection, and console', async () => {
  const secretKey = 'sk-mock-super-9999';
  const profile = createApiProfile({
    id: 'p_sec',
    baseUrl: 'https://api.example.test/v1',
    apiKey: secretKey,
    model: 'model-sec',
    stream: false,
  });
  const settings = createDefaultSettings({
    api: { provider: 'custom', activeProfileId: profile.id, profiles: [profile] },
  });

  const consoleLogs = [];
  const origError = console.error;
  const origWarn = console.warn;
  console.error = (...args) => consoleLogs.push(args.join(' '));
  console.warn = (...args) => consoleLogs.push(args.join(' '));

  try {
    const leakFetch = async () => ({
      ok: false,
      status: 401,
      statusText: `Unauthorized ${secretKey}`,
      text: async () => `Invalid key ${secretKey} in Authorization: Bearer ${secretKey}`,
    });

    await assert.rejects(
      () =>
        runStudioGeneration({
          settings,
          messages: [{ role: 'user', content: 'hi' }],
          deps: { fetch: leakFetch, skipDynamicImport: true },
        }),
      (err) => {
        assert.equal(err.message.includes(secretKey), false);
        assert.equal(String(err.stack || '').includes(secretKey), false);
        return true;
      }
    );

    await assert.rejects(
      () => fetchCustomModels(profile, undefined, { fetch: leakFetch, skipDynamicImport: true }),
      (err) => {
        assert.equal(err.message.includes(secretKey), false);
        assert.equal(String(err.stack || '').includes(secretKey), false);
        return true;
      }
    );

    const testRes = await testCustomConnection(profile, undefined, {
      fetch: leakFetch,
      skipDynamicImport: true,
    });
    assert.equal(testRes.ok, false);
    assert.equal(testRes.message.includes(secretKey), false);
    assert.equal(consoleLogs.join('\n').includes(secretKey), false);

    // Direct scrub helper test including URL-encoded key
    const specialKey = 'sk-mock-abc+123/xyz';
    const scrubbed = scrubApiKeyFromText(
      `Err Bearer ${specialKey} encoded=${encodeURIComponent(specialKey)}`,
      specialKey
    );
    assert.equal(scrubbed.includes(specialKey), false);
    assert.equal(scrubbed.includes(encodeURIComponent(specialKey)), false);
  } finally {
    console.error = origError;
    console.warn = origWarn;
  }
});

test('A10: abort and timeout handling (pre-aborted, mid-flight abort, timeoutSeconds expiry)', async () => {
  const profile = createApiProfile({
    id: 'p_abort',
    baseUrl: 'https://api.example.test/v1',
    apiKey: 'sk-mock-abort-1234',
    model: 'model-abort',
    stream: false,
    timeoutSeconds: 10,
  });
  const settings = createDefaultSettings({
    api: { provider: 'custom', activeProfileId: profile.id, profiles: [profile] },
  });

  // (a) Pre-aborted signal fails immediately without calling fetch
  let fetchCalled = false;
  const preAborted = new AbortController();
  preAborted.abort();
  await assert.rejects(
    () =>
      runStudioGeneration({
        settings,
        messages: [{ role: 'user', content: 'hi' }],
        signal: preAborted.signal,
        deps: {
          fetch: async () => {
            fetchCalled = true;
            return { ok: true, text: async () => '{}' };
          },
          skipDynamicImport: true,
        },
      }),
    (err) => err.name === 'AbortError' && err.code === 'ABORTED'
  );
  assert.equal(fetchCalled, false);

  // (b) Mid-flight caller abort
  const ac = new AbortController();
  const pendingFetch = (_url, init) =>
    new Promise((_resolve, reject) => {
      init.signal.addEventListener(
        'abort',
        () => {
          const e = new Error('aborted');
          e.name = 'AbortError';
          reject(e);
        },
        { once: true }
      );
    });
  const genPromise = runStudioGeneration({
    settings,
    messages: [{ role: 'user', content: 'hi' }],
    signal: ac.signal,
    deps: { fetch: pendingFetch, skipDynamicImport: true },
  });
  setTimeout(() => ac.abort(), 15);
  await assert.rejects(genPromise, (err) => err.name === 'AbortError' && err.code === 'ABORTED');

  // (c) Short timeoutSeconds triggers TIMEOUT
  const timeoutSettings = createDefaultSettings({
    api: { provider: 'custom', activeProfileId: profile.id, profiles: [profile] },
  });
  timeoutSettings.api.profiles[0].timeoutSeconds = 0.03;
  await assert.rejects(
    () =>
      runStudioGeneration({
        settings: timeoutSettings,
        messages: [{ role: 'user', content: 'hi' }],
        deps: { fetch: pendingFetch, skipDynamicImport: true },
      }),
    (err) => err.code === 'TIMEOUT'
  );

  // Linked signal cleanup helper sanity
  const linked = createLinkedAbortSignal(undefined, 5);
  assert.equal(linked.signal.aborted, false);
  linked.cleanup();
});

test('A11: fetchCustomModels supports standard response shapes, empty-key Authorization override, and ST /status errors', async () => {
  const baseProfile = createApiProfile({
    id: 'p_models',
    baseUrl: 'https://api.example.test/v1',
    apiKey: '',
    model: 'm1',
  });

  // (1) OpenAI { data: [...] } with duplicates & empty apiKey Authorization override
  let capturedBody = null;
  const list1 = await fetchCustomModels(baseProfile, undefined, {
    fetch: async (_url, init) => {
      capturedBody = JSON.parse(init.body);
      return {
        ok: true,
        json: async () => ({ data: [{ id: 'model-b' }, { id: 'model-a' }, { id: 'model-a' }] }),
      };
    },
    skipDynamicImport: true,
  });
  assert.deepEqual(list1, ['model-a', 'model-b']);
  assert.deepEqual(JSON.parse(capturedBody.custom_include_headers), { Authorization: '' });

  // (2) { models: ['m2', { model: 'm1' }] }
  const list2 = await fetchCustomModels(baseProfile, undefined, {
    fetch: async () => ({
      ok: true,
      json: async () => ({ models: ['m2', { model: 'm1' }] }),
    }),
    skipDynamicImport: true,
  });
  assert.deepEqual(list2, ['m1', 'm2']);

  // (3) Top-level array ['z', 'y']
  const list3 = await fetchCustomModels(baseProfile, undefined, {
    fetch: async () => ({
      ok: true,
      json: async () => ['z', 'y'],
    }),
    skipDynamicImport: true,
  });
  assert.deepEqual(list3, ['y', 'z']);

  // (4) ST /status HTTP 200 { error: true, data: { data: [] } } throws
  await assert.rejects(
    () =>
      fetchCustomModels(baseProfile, undefined, {
        fetch: async () => ({
          ok: true,
          json: async () => ({ error: true, data: { data: [] } }),
        }),
        skipDynamicImport: true,
      }),
    /获取模型列表失败/
  );
});

test('A12: testCustomConnection handles success, 404 ping fallback, and 401 failure without key leak', async () => {
  const profile = createApiProfile({
    id: 'p_conn',
    baseUrl: 'https://api.example.test/v1',
    apiKey: 'sk-mock-conn-8888',
    model: 'model-ping',
  });

  // (a) /status returns 3 models
  const okRes = await testCustomConnection(profile, undefined, {
    fetch: async () => ({
      ok: true,
      json: async () => ({ data: [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }] }),
    }),
    skipDynamicImport: true,
  });
  assert.equal(okRes.ok, true);
  assert.equal(okRes.modelCount, 3);
  assert.ok(okRes.latencyMs >= 0);

  // (b) /status returns 404 while profile.model is set -> falls back to 1-token /generate ping
  let pingBody = null;
  const fallbackRes = await testCustomConnection(profile, undefined, {
    fetch: async (url, init) => {
      if (url.endsWith('/status')) {
        return { ok: false, status: 404, statusText: 'Not Found', text: async () => 'not found' };
      }
      pingBody = JSON.parse(init.body);
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ choices: [{ message: { content: 'pong' } }] }),
      };
    },
    skipDynamicImport: true,
  });
  assert.equal(fallbackRes.ok, true);
  assert.equal(fallbackRes.modelCount, 0);
  assert.equal(pingBody.stream, false);
  assert.equal(JSON.parse(pingBody.custom_include_body).max_tokens, 1);

  // (c) /status fails 401 with raw key in error body
  const failRes = await testCustomConnection(profile, undefined, {
    fetch: async () => ({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => 'bad key sk-mock-conn-8888',
    }),
    skipDynamicImport: true,
  });
  assert.equal(failRes.ok, false);
  assert.equal(failRes.modelCount, 0);
  assert.equal(failRes.message.includes('sk-mock-conn-8888'), false);
  assert.ok(failRes.message.includes('鉴权失败'));

  // classifyApiError direct sanity check
  const err502 = classifyApiError({ status: 502, bodyText: 'Bad Gateway', apiKey: 'sk-mock-conn-8888' });
  assert.equal(err502.code, 'NETWORK_ERROR');
});

// ============================================================================
// Group R: Iteration 2 Regression & Edge-Case Coverage (H10-H11, A13-A18)
// ============================================================================

test('H10: savePersonaToHost overwrite with setAsActive and rename invokes setUserName', async () => {
  const powerUser = {
    personas: {
      'persona_a.png': '人设甲',
      'persona_b.png': '人设乙',
    },
    persona_descriptions: {
      'persona_a.png': { description: '甲内容', position: 0, depth: 2, role: 0, lorebook: '', title: '' },
      'persona_b.png': { description: '乙内容', position: 1, depth: 3, role: 1, lorebook: 'wb_b', title: '乙头衔' },
    },
    persona_description: '甲内容',
    persona_description_position: 0,
    persona_description_depth: 2,
    persona_description_role: 0,
    persona_description_lorebook: '',
  };

  const setUserNameCalls = [];
  const setUserAvatarCalls = [];
  const res = await savePersonaToHost(
    {
      mode: 'overwrite',
      avatarId: 'persona_b.png',
      name: '人设乙新版',
      description: '乙新内容',
      setAsActive: true,
    },
    {
      powerUser,
      userAvatar: 'persona_a.png',
      setUserName: (name) => setUserNameCalls.push(name),
      setUserAvatar: async (id) => setUserAvatarCalls.push(id),
      setPersonaDescription: () => {},
      saveSettingsDebounced: () => {},
      getUserAvatars: async () => {},
      skipDynamicImport: true,
    }
  );

  assert.equal(res.name, '人设乙新版');
  assert.deepEqual(setUserNameCalls, ['人设乙新版']);
  assert.deepEqual(setUserAvatarCalls, ['persona_b.png']);
  assert.equal(powerUser.persona_description, '乙新内容');
  assert.equal(powerUser.persona_description_lorebook, 'wb_b');
});

test('H11: getActiveCharacterContext with includeWorldSummary summarizes enabled entries and falls back to loadWorldInfo', async () => {
  const ctx = {
    characterId: 0,
    name2: '测试角色',
    characters: [
      {
        avatar: 'char.png',
        name: '测试角色',
        shallow: false,
        data: { extensions: { world: '舞台世界书' } },
      },
    ],
    getCharacterCardFields: () => ({
      description: '角色公开外貌',
      personality: '角色公开性格',
      scenario: '港口车站',
      firstMessage: '列车即将进站。',
    }),
  };

  // (a) Direct /api/worldinfo/get fetch path filters disabled entries and formats up to 3 enabled entries
  const resFetch = await getActiveCharacterContext(
    { includeWorldSummary: true },
    {
      ctx,
      fetch: async (url, init) => {
        assert.equal(url, '/api/worldinfo/get');
        assert.deepEqual(JSON.parse(init.body), { name: '舞台世界书' });
        return {
          ok: true,
          json: async () => ({
            entries: {
              0: { uid: 0, disable: true, comment: '已禁用', content: '不应出现' },
              1: { uid: 1, disable: false, comment: '港口规则', content: '夜间十点后关闭北闸口。' },
              2: { uid: 2, disable: false, key: ['钟楼'], content: '整点会响起铜钟。' },
            },
          }),
        };
      },
      skipDynamicImport: true,
    }
  );
  assert.equal(resFetch.worldName, '舞台世界书');
  assert.match(resFetch.worldSummary, /港口规则：夜间十点后关闭北闸口。/);
  assert.match(resFetch.worldSummary, /钟楼：整点会响起铜钟。/);
  assert.equal(resFetch.worldSummary.includes('不应出现'), false);

  // (b) Falls back to loadWorldInfo when /api/worldinfo/get fails
  const resFallback = await getActiveCharacterContext(
    { includeWorldSummary: true },
    {
      ctx,
      fetch: async () => ({ ok: false, status: 500 }),
      loadWorldInfo: async () => ({
        entries: {
          0: { uid: 0, disable: false, comment: '回退设定', content: '通过 loadWorldInfo 读取。' },
        },
      }),
      skipDynamicImport: true,
    }
  );
  assert.equal(resFallback.worldSummary, '回退设定：通过 loadWorldInfo 读取。');
});

test('A13: raw ECONNREFUSED/cause.code errors with materialized stack containing raw & encoded apiKey classify as NETWORK_ERROR with zero stack leak', async () => {
  const specialKey = 'sk-mock-net+key/leak=999';
  const encodedKey = encodeURIComponent(specialKey);
  const profile = createApiProfile({
    id: 'p_net',
    baseUrl: 'https://api.example.test/v1',
    apiKey: specialKey,
    model: 'model-net',
    stream: false,
  });
  const settings = createDefaultSettings({
    api: { provider: 'custom', activeProfileId: profile.id, profiles: [profile] },
  });

  const makeMaterializedNetErr = (code, msg) => {
    const err = new Error(msg);
    err.code = code;
    void err.stack; // Force V8 to materialize stack containing raw + encoded key
    return err;
  };

  await assert.rejects(
    () =>
      runStudioGeneration({
        settings,
        messages: [{ role: 'user', content: 'hi' }],
        deps: {
          fetch: async () => {
            throw makeMaterializedNetErr(
              'ECONNREFUSED',
              `connect ECONNREFUSED key=${specialKey} enc=${encodedKey}`
            );
          },
          skipDynamicImport: true,
        },
      }),
    (err) => {
      assert.equal(err.code, 'NETWORK_ERROR');
      assert.equal(err.message.includes(specialKey), false);
      assert.equal(err.message.includes(encodedKey), false);
      assert.equal(String(err.stack || '').includes(specialKey), false);
      assert.equal(String(err.stack || '').includes(encodedKey), false);
      return true;
    }
  );

  await assert.rejects(
    () =>
      fetchCustomModels(profile, undefined, {
        fetch: async () => {
          const inner = makeMaterializedNetErr('ETIMEDOUT', `timeout ${specialKey}`);
          const outer = new Error(`fetch failed ${encodedKey}`, { cause: inner });
          void outer.stack;
          throw outer;
        },
        skipDynamicImport: true,
      }),
    (err) => {
      assert.equal(err.code, 'NETWORK_ERROR');
      assert.equal(err.message.includes(specialKey), false);
      assert.equal(err.message.includes(encodedKey), false);
      assert.equal(String(err.stack || '').includes(specialKey), false);
      assert.equal(String(err.stack || '').includes(encodedKey), false);
      return true;
    }
  );
});

test('A14: DOMException AbortError in ChatCompletionService stream and mid-flight AbortSignal on hanging generateRaw generator reject promptly with ABORTED', async () => {
  const settings = createDefaultSettings();

  // (a) DOMException('Aborted', 'AbortError') inside ChatCompletionService stream
  const ctxDomAbort = {
    mainApi: 'openai',
    chatCompletionSettings: { chat_completion_source: 'openai', openai_model: 'm1', stream_openai: true },
    ChatCompletionService: {
      createRequestData: (d) => d,
      sendRequest: async () => {
        return async function* () {
          yield { text: '部分输出' };
          throw new DOMException('Aborted', 'AbortError');
        };
      },
    },
  };
  await assert.rejects(
    () =>
      runStudioGeneration({
        settings,
        messages: [{ role: 'user', content: 'test' }],
        onChunk: () => {},
        deps: { ctx: ctxDomAbort, skipDynamicImport: true },
      }),
    (err) => err.name === 'AbortError' && err.code === 'ABORTED'
  );

  // (b) Mid-flight AbortSignal on a suspended generateRaw async generator unblocks immediately
  let finallyRan = false;
  const ac = new AbortController();
  const ctxHanging = {
    mainApi: 'openai',
    chatCompletionSettings: { stream_openai: true },
    generateRaw: async () => {
      return async function* () {
        try {
          yield { text: '首段' };
          await new Promise(() => {});
        } finally {
          finallyRan = true;
        }
      };
    },
  };

  const started = Date.now();
  const genPromise = runStudioGeneration({
    settings,
    messages: [{ role: 'user', content: 'hang' }],
    signal: ac.signal,
    deps: { ctx: ctxHanging, skipDynamicImport: true },
  });
  setTimeout(() => ac.abort(), 20);

  await assert.rejects(genPromise, (err) => err.name === 'AbortError' && err.code === 'ABORTED');
  assert.ok(Date.now() - started < 1000, 'Aborted hanging async generator must reject promptly');
  assert.equal(finallyRan, false); // Generator suspended on unresolved await cannot reach finally until settled
});

test('A15: readCompletionResponse classifies pretty-printed multi-line JSON & single-line JSON with quota_error: true under text/event-stream as RATE_LIMIT', async () => {
  const profile = createApiProfile({
    id: 'p_sse_quota',
    baseUrl: 'https://api.example.test/v1',
    apiKey: 'sk-mock-sse-quota-1111',
    model: 'model-sse',
    stream: true,
  });
  const settings = createDefaultSettings({
    api: { provider: 'custom', activeProfileId: profile.id, profiles: [profile] },
  });

  // (a) Pretty-printed multi-line JSON error under Content-Type: text/event-stream
  await assert.rejects(
    () =>
      runStudioGeneration({
        settings,
        messages: [{ role: 'user', content: 'hi' }],
        deps: {
          fetch: async () => ({
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'text/event-stream' }),
            body: makeByteStream([
              '{\n  "error": {\n',
              '    "message": "Quota exceeded on upstream"\n  },\n',
              '  "quota_error": true\n}',
            ]),
          }),
          skipDynamicImport: true,
        },
      }),
    (err) => err.code === 'RATE_LIMIT' && err.message.includes('429')
  );

  // (b) Single-line JSON with quota_error: true under Content-Type: text/event-stream
  await assert.rejects(
    () =>
      runStudioGeneration({
        settings,
        messages: [{ role: 'user', content: 'hi' }],
        deps: {
          fetch: async () => ({
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'text/event-stream' }),
            body: makeByteStream([
              '{"error":{"message":"Usage cap reached"},"quota_error":true}\n',
            ]),
          }),
          skipDynamicImport: true,
        },
      }),
    (err) => err.code === 'RATE_LIMIT' && err.message.includes('429')
  );

  // (c) SSE data: line JSON with quota_error: true
  await assert.rejects(
    () =>
      runStudioGeneration({
        settings,
        messages: [{ role: 'user', content: 'hi' }],
        deps: {
          fetch: async () => ({
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'text/event-stream' }),
            body: makeByteStream([
              'data: {"error":{"message":"Usage cap reached"},"quota_error":true}\n\n',
            ]),
          }),
          skipDynamicImport: true,
        },
      }),
    (err) => err.code === 'RATE_LIMIT' && err.message.includes('429')
  );
});

test('A16: testCustomConnection 404 /generate ping rejects HTTP 200 HTML/text error pages as ok: false', async () => {
  const profile = createApiProfile({
    id: 'p_html',
    baseUrl: 'https://api.example.test/v1',
    apiKey: 'sk-mock-html-test-1234',
    model: 'model-ping',
  });

  const resHtml = await testCustomConnection(profile, undefined, {
    fetch: async (url) => {
      if (url.endsWith('/status')) {
        return { ok: false, status: 404, statusText: 'Not Found', text: async () => 'not found' };
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html' }),
        text: async () => '<html><body>502 Bad Gateway Captive Portal</body></html>',
      };
    },
    skipDynamicImport: true,
  });

  assert.equal(resHtml.ok, false);
  assert.equal(resHtml.modelCount, 0);
  assert.equal(resHtml.message.includes('sk-mock-html-test-1234'), false);
});

test('A17: scrubApiKeyFromText redacts Bearer tokens containing +, /, and =', () => {
  const out1 = scrubApiKeyFromText(
    'Auth Bearer sk-mock-secret+token/abc=123 failed',
    'sk-mock-secret'
  );
  assert.equal(out1, 'Auth Bearer [已脱敏] failed');

  const out2 = scrubApiKeyFromText(
    'Header Bearer sk-mock-hdr.pay+part/more== rejected',
    ''
  );
  assert.equal(out2, 'Header Bearer [已脱敏] rejected');
});

test('A18: scrubApiKeyFromText & classifyApiError redact URL-encoded, colon, special-char, JSON-quoted, and query-param keys without tail leaks', () => {
  // 1. URL-encoded + / = after Bearer (full key, prefix key, and empty key)
  const plusSlashEqKey = 'sk-mock-12345678+supersecret/tail=1';
  const encodedPlusSlashEq = encodeURIComponent(plusSlashEqKey);
  assert.equal(
    scrubApiKeyFromText(`Auth Bearer ${encodedPlusSlashEq} rejected`, plusSlashEqKey),
    'Auth Bearer [已脱敏] rejected'
  );
  assert.equal(
    scrubApiKeyFromText(`Auth Bearer ${encodedPlusSlashEq} rejected`, 'sk-mock-12345678'),
    'Auth Bearer [已脱敏] rejected'
  );
  assert.equal(
    scrubApiKeyFromText(`Auth Bearer ${encodedPlusSlashEq} rejected`, ''),
    'Auth Bearer [已脱敏] rejected'
  );

  // 2. Colon-containing Bearer key (full key, prefix key, and empty key)
  const colonKey = 'sk-mock-12345678:mysecretpass';
  assert.equal(
    scrubApiKeyFromText(`Auth Bearer ${colonKey} rejected`, colonKey),
    'Auth Bearer [已脱敏] rejected'
  );
  assert.equal(
    scrubApiKeyFromText(`Auth Bearer ${colonKey} rejected`, 'sk-mock-12345678'),
    'Auth Bearer [已脱敏] rejected'
  );
  assert.equal(
    scrubApiKeyFromText(`Auth Bearer ${colonKey} rejected`, ''),
    'Auth Bearer [已脱敏] rejected'
  );

  // 3. Special characters outside Bearer charset ($ / !) must not leak tails when key is known
  const symKey = 'sk-mock-12345678$secret!tail';
  assert.equal(
    scrubApiKeyFromText(`Auth Bearer ${symKey} rejected`, symKey),
    'Auth Bearer [已脱敏] rejected'
  );

  // 4. Delimiter preservation (JSON quotes, trailing period, trailing colon separator, query params)
  assert.equal(
    scrubApiKeyFromText(`{"error":"Authorization: Bearer ${colonKey}"}`, ''),
    '{"error":"Authorization: Bearer [已脱敏]"}'
  );
  assert.equal(
    scrubApiKeyFromText('Invalid Bearer sk-mock-12345678+abc/def=1.', ''),
    'Invalid Bearer [已脱敏].'
  );
  assert.equal(
    scrubApiKeyFromText('Bearer sk-mock-12345678: unauthorized', ''),
    'Bearer [已脱敏]: unauthorized'
  );
  assert.equal(
    scrubApiKeyFromText(`GET https://api.example.test/v1/models?api_key=${encodedPlusSlashEq}&v=1`, plusSlashEqKey),
    'GET https://api.example.test/v1/models?api_key=[已脱敏]&v=1'
  );

  // 5. Truncated JSON slash-escape & decodeURIComponent variants
  const truncatedJsonErr = `{"error":{"message":"bad key ${plusSlashEqKey.replace(/\//g, '\\/')}"`;
  const scrubbedTruncated = scrubApiKeyFromText(truncatedJsonErr, plusSlashEqKey);
  assert.equal(scrubbedTruncated.includes('supersecret'), false);
  assert.equal(
    scrubApiKeyFromText('Decoded sk-mock-12345678+decoded/secret failed', 'sk-mock-12345678%2Bdecoded%2Fsecret'),
    'Decoded [已脱敏] failed'
  );

  // 6. End-to-end classifyApiError double-scrub idempotency with URL-encoded & colon Bearer bodies
  const classifiedEnc = classifyApiError({
    status: 500,
    bodyText: `Upstream rejected Bearer ${encodedPlusSlashEq}`,
    apiKey: plusSlashEqKey,
  });
  assert.equal(classifiedEnc.message.includes('supersecret'), false);
  assert.equal(classifiedEnc.message.includes('%2B'), false);
  assert.equal(classifiedEnc.message.includes('Bearer [已脱敏]'), true);

  const classifiedColon = classifyApiError({
    status: 500,
    bodyText: `Upstream rejected Bearer ${colonKey}`,
    apiKey: colonKey,
  });
  assert.equal(classifiedColon.message.includes('mysecretpass'), false);
  assert.equal(classifiedColon.message.includes('Bearer [已脱敏]'), true);
});

test('A19: runHostGeneration Step A1 (ChatCompletionService.sendRequest) unblocks immediately on AbortSignal with ABORTED', async () => {
  const settings = createDefaultSettings();

  // (a) Pending ChatCompletionService.sendRequest rejects promptly on abort without falling back to generateRaw
  let generateRawCalled = false;
  const ac1 = new AbortController();
  const ctxPendingSend = {
    mainApi: 'openai',
    chatCompletionSettings: { chat_completion_source: 'openai', openai_model: 'm1', stream_openai: true },
    ChatCompletionService: {
      createRequestData: (d) => d,
      sendRequest: () => new Promise(() => {}),
    },
    generateRaw: async () => {
      generateRawCalled = true;
      return 'should not run';
    },
  };

  const started = Date.now();
  const pendingPromise = runStudioGeneration({
    settings,
    messages: [{ role: 'user', content: 'abort sendRequest' }],
    signal: ac1.signal,
    deps: { ctx: ctxPendingSend, skipDynamicImport: true },
  });
  setTimeout(() => ac1.abort(), 20);

  await assert.rejects(pendingPromise, (err) => err.name === 'AbortError' && err.code === 'ABORTED');
  assert.ok(Date.now() - started < 1000, 'Pending sendRequest must unblock promptly on abort');
  assert.equal(generateRawCalled, false);

  // (b) presetToGeneratePayload aborts ac during execution -> sendRequest is never called
  let sendCalled = false;
  const ac2 = new AbortController();
  const ctxPayloadAbort = {
    mainApi: 'openai',
    chatCompletionSettings: { chat_completion_source: 'openai', openai_model: 'm1', stream_openai: true },
    ChatCompletionService: {
      presetToGeneratePayload: async () => {
        ac2.abort();
        return { messages: [{ role: 'user', content: 'x' }] };
      },
      sendRequest: async () => {
        sendCalled = true;
        return 'should not be called';
      },
    },
  };

  await assert.rejects(
    () =>
      runStudioGeneration({
        settings,
        messages: [{ role: 'user', content: 'abort during presetToGeneratePayload' }],
        signal: ac2.signal,
        deps: { ctx: ctxPayloadAbort, skipDynamicImport: true },
      }),
    (err) => err.name === 'AbortError' && err.code === 'ABORTED'
  );
  assert.equal(sendCalled, false);
});

test('A20: readCompletionResponse stalled reader.read() distinguishes caller abort (ABORTED) vs timeoutSeconds (TIMEOUT) and handles hanging cancel()', async () => {
  const makeStalledSseStream = ({ onCancel, hangCancel = false } = {}) => {
    const encoder = new TextEncoder();
    let pulls = 0;
    return new ReadableStream({
      pull(controller) {
        pulls += 1;
        if (pulls === 1) {
          controller.enqueue(
            encoder.encode('data: {"choices":[{"delta":{"content":"首段"}}]}\n\n')
          );
          return;
        }
        return new Promise(() => {});
      },
      cancel(reason) {
        onCancel?.(reason);
        if (hangCancel) {
          return new Promise(() => {});
        }
      },
    });
  };

  // (a) Caller abort during stalled reader.read() -> ABORTED + cancels reader
  const profileAbort = createApiProfile({
    id: 'p_abort_stream',
    baseUrl: 'https://api.example.test/v1',
    apiKey: 'sk-mock-stream-abort-1111',
    model: 'm-stream',
    stream: true,
    timeoutSeconds: 30,
  });
  const settingsAbort = createDefaultSettings({
    api: { provider: 'custom', activeProfileId: profileAbort.id, profiles: [profileAbort] },
  });

  let cancelledA = false;
  const ac = new AbortController();
  const startedA = Date.now();
  const pAbort = runStudioGeneration({
    settings: settingsAbort,
    messages: [{ role: 'user', content: 'hi' }],
    signal: ac.signal,
    deps: {
      fetch: async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
        body: makeStalledSseStream({ onCancel: () => { cancelledA = true; } }),
      }),
      skipDynamicImport: true,
    },
  });
  setTimeout(() => ac.abort(), 20);

  await assert.rejects(pAbort, (err) => err.name === 'AbortError' && err.code === 'ABORTED');
  assert.ok(Date.now() - startedA < 1000, 'Stalled reader.read() must abort promptly');
  assert.equal(cancelledA, true);

  // (b) timeoutSeconds expiry during stalled reader.read() -> TIMEOUT (never ABORTED) + cancels reader
  const profileTimeout = createApiProfile({
    id: 'p_timeout_stream',
    baseUrl: 'https://api.example.test/v1',
    apiKey: 'sk-mock-stream-timeout-2222',
    model: 'm-stream',
    stream: true,
  });
  profileTimeout.timeoutSeconds = 0.03;
  const settingsTimeout = createDefaultSettings({
    api: { provider: 'custom', activeProfileId: profileTimeout.id, profiles: [profileTimeout] },
  });
  settingsTimeout.api.profiles[0].timeoutSeconds = 0.03;

  let cancelledB = false;
  const startedB = Date.now();
  await assert.rejects(
    () =>
      runStudioGeneration({
        settings: settingsTimeout,
        messages: [{ role: 'user', content: 'hi' }],
        deps: {
          fetch: async () => ({
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'text/event-stream' }),
            body: makeStalledSseStream({ onCancel: () => { cancelledB = true; } }),
          }),
          skipDynamicImport: true,
        },
      }),
    (err) => {
      assert.equal(err.name, 'TimeoutError');
      assert.equal(err.code, 'TIMEOUT');
      assert.notEqual(err.code, 'ABORTED');
      assert.equal(err.message.includes('请求超时'), true);
      return true;
    }
  );
  assert.ok(Date.now() - startedB < 1000, 'Stalled reader.read() must time out promptly');
  assert.equal(cancelledB, true);

  // (c) Hostile hanging cancel() on stalled stream must still settle promptly in finally
  let cancelledC = false;
  const acC = new AbortController();
  const startedC = Date.now();
  const pHostile = runStudioGeneration({
    settings: settingsAbort,
    messages: [{ role: 'user', content: 'hi' }],
    signal: acC.signal,
    deps: {
      fetch: async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
        body: makeStalledSseStream({
          onCancel: () => {
            cancelledC = true;
          },
          hangCancel: true,
        }),
      }),
      skipDynamicImport: true,
    },
  });
  setTimeout(() => acC.abort(), 20);

  await assert.rejects(pHostile, (err) => err.name === 'AbortError' && err.code === 'ABORTED');
  assert.ok(Date.now() - startedC < 1000, 'Hanging reader.cancel() must not block finally');
  assert.equal(cancelledC, true);
});

test('A21: testCustomConnection resolves { ok: false } across pre-abort, 404->ping transition abort, mid-ping abort, and ping timeout', async () => {
  const baseProfile = createApiProfile({
    id: 'p_conn_abort',
    baseUrl: 'https://api.example.test/v1',
    apiKey: 'sk-mock-conn-abort-9999',
    model: 'model-ping',
    timeoutSeconds: 30,
  });

  // (a) Pre-aborted signal -> resolves { ok: false, modelCount: 0, message: '已取消生成' }
  const acPre = new AbortController();
  acPre.abort();
  const resPre = await testCustomConnection(baseProfile, acPre.signal, {
    fetch: async () => {
      throw new Error('should not fetch when pre-aborted');
    },
    skipDynamicImport: true,
  });
  assert.equal(resPre.ok, false);
  assert.equal(resPre.modelCount, 0);
  assert.equal(resPre.message, '已取消生成');

  // (b) /status returns 404 and triggers ac.abort() inside res.text() -> /generate ping is NOT called
  const acTransition = new AbortController();
  let pingCalledOnTransition = false;
  const resTransition = await testCustomConnection(baseProfile, acTransition.signal, {
    fetch: async (url) => {
      if (url.endsWith('/status')) {
        return {
          ok: false,
          status: 404,
          statusText: 'Not Found',
          text: async () => {
            acTransition.abort();
            return 'not found';
          },
        };
      }
      pingCalledOnTransition = true;
      return { ok: true, status: 200, text: async () => '{}' };
    },
    skipDynamicImport: true,
  });
  assert.equal(pingCalledOnTransition, false);
  assert.equal(resTransition.ok, false);
  assert.equal(resTransition.modelCount, 0);
  assert.equal(resTransition.message, '已取消生成');

  // (c) /status returns 404 cleanly, then ac.abort() fires during pending /generate ping -> resolves { ok: false }
  const acMidPing = new AbortController();
  const startedMid = Date.now();
  const pingPromise = testCustomConnection(baseProfile, acMidPing.signal, {
    fetch: async (url) => {
      if (url.endsWith('/status')) {
        return { ok: false, status: 404, statusText: 'Not Found', text: async () => 'not found' };
      }
      return new Promise(() => {});
    },
    skipDynamicImport: true,
  });
  setTimeout(() => acMidPing.abort(), 20);
  const resMidPing = await pingPromise;
  assert.ok(Date.now() - startedMid < 1000);
  assert.equal(resMidPing.ok, false);
  assert.equal(resMidPing.modelCount, 0);
  assert.equal(resMidPing.message, '已取消生成');

  // (d) /status returns 404 cleanly, then /generate ping stalls past timeoutSeconds -> resolves { ok: false } with timeout message
  const timeoutProfile = createApiProfile({
    ...baseProfile,
    id: 'p_conn_timeout',
  });
  timeoutProfile.timeoutSeconds = 0.03;
  const startedTimeout = Date.now();
  const resPingTimeout = await testCustomConnection(timeoutProfile, undefined, {
    fetch: async (url) => {
      if (url.endsWith('/status')) {
        return { ok: false, status: 404, statusText: 'Not Found', text: async () => 'not found' };
      }
      return new Promise(() => {});
    },
    skipDynamicImport: true,
  });
  assert.ok(Date.now() - startedTimeout < 1000);
  assert.equal(resPingTimeout.ok, false);
  assert.equal(resPingTimeout.modelCount, 0);
  assert.equal(resPingTimeout.message.includes('请求超时'), true);
});

test('A22: zero unhandledRejection across raceWithAbortSignal, getHeaders()->fetchFn, presetToGeneratePayload, and readCompletionResponse abort transitions', async () => {
  const unhandled = [];
  const onUnhandled = (reason) => {
    unhandled.push(reason);
  };
  process.on('unhandledRejection', onUnhandled);

  try {
    // (a) presetToGeneratePayload calls ac.abort() synchronously and rejects with DOMException('AbortError')
    const hostSettings = createDefaultSettings();
    const acHost = new AbortController();
    let sendCalled = false;
    let generateRawCalled = false;
    await assert.rejects(
      () =>
        runStudioGeneration({
          settings: hostSettings,
          messages: [{ role: 'user', content: 'abort payload' }],
          signal: acHost.signal,
          deps: {
            ctx: {
              mainApi: 'openai',
              chatCompletionSettings: { chat_completion_source: 'openai', openai_model: 'm1' },
              ChatCompletionService: {
                presetToGeneratePayload: () => {
                  acHost.abort();
                  return Promise.reject(new DOMException('Aborted', 'AbortError'));
                },
                sendRequest: async () => {
                  sendCalled = true;
                  return 'unexpected';
                },
              },
              generateRaw: async () => {
                generateRawCalled = true;
                return 'unexpected';
              },
            },
            skipDynamicImport: true,
          },
        }),
      (err) => err.name === 'AbortError' && err.code === 'ABORTED'
    );
    assert.equal(sendCalled, false);
    assert.equal(generateRawCalled, false);

    // (b) runStudioGeneration (custom proxy) where getRequestHeaders() calls ac.abort() -> fetch NOT called
    const profile = createApiProfile({
      id: 'p_headers_abort',
      baseUrl: 'https://api.example.test/v1',
      apiKey: 'sk-mock-headers-abort-1234',
      model: 'model-test',
      stream: false,
    });
    const customSettings = createDefaultSettings({
      api: { provider: 'custom', activeProfileId: profile.id, profiles: [profile] },
    });

    const acGen = new AbortController();
    let genFetchCalled = false;
    await assert.rejects(
      () =>
        runStudioGeneration({
          settings: customSettings,
          messages: [{ role: 'user', content: 'hi' }],
          signal: acGen.signal,
          deps: {
            getRequestHeaders: async () => {
              acGen.abort();
              return { 'Content-Type': 'application/json' };
            },
            fetch: async (_url, init) => {
              genFetchCalled = true;
              if (init?.signal?.aborted) {
                return Promise.reject(new DOMException('Aborted', 'AbortError'));
              }
              return { ok: true, status: 200, text: async () => '{}' };
            },
            skipDynamicImport: true,
          },
        }),
      (err) => err.name === 'AbortError' && err.code === 'ABORTED'
    );
    assert.equal(genFetchCalled, false);

    // (b2) runStudioGeneration (custom proxy) where synchronous getRequestHeaders() aborts and rejects
    const acGenReject = new AbortController();
    let genRejectFetchCalled = false;
    await assert.rejects(
      () =>
        runStudioGeneration({
          settings: customSettings,
          messages: [{ role: 'user', content: 'hi' }],
          signal: acGenReject.signal,
          deps: {
            getRequestHeaders: () => {
              acGenReject.abort();
              return Promise.reject(new DOMException('Headers aborted', 'AbortError'));
            },
            fetch: async () => {
              genRejectFetchCalled = true;
              return { ok: true, status: 200, text: async () => '{}' };
            },
            skipDynamicImport: true,
          },
        }),
      (err) => err.name === 'AbortError' && err.code === 'ABORTED'
    );
    assert.equal(genRejectFetchCalled, false);

    // (c) fetchCustomModels (proxy) where getRequestHeaders() calls ac.abort() -> fetch NOT called
    const acModels = new AbortController();
    let modelsFetchCalled = false;
    await assert.rejects(
      () =>
        fetchCustomModels(profile, acModels.signal, {
          getRequestHeaders: async () => {
            acModels.abort();
            return { 'Content-Type': 'application/json' };
          },
          fetch: async (_url, init) => {
            modelsFetchCalled = true;
            if (init?.signal?.aborted) {
              return Promise.reject(new DOMException('Aborted', 'AbortError'));
            }
            return { ok: true, status: 200, json: async () => ({ data: [] }) };
          },
          skipDynamicImport: true,
        }),
      (err) => err.name === 'AbortError' && err.code === 'ABORTED'
    );
    assert.equal(modelsFetchCalled, false);

    // (d) testCustomConnection (proxy 404->ping) where getRequestHeaders() calls ac.abort() before ping -> ping fetch NOT called
    const acConn = new AbortController();
    let headerCalls = 0;
    let pingFetchCalled = false;
    const connRes = await testCustomConnection(profile, acConn.signal, {
      getRequestHeaders: async () => {
        headerCalls += 1;
        if (headerCalls === 2) {
          acConn.abort();
        }
        return { 'Content-Type': 'application/json' };
      },
      fetch: async (url, init) => {
        if (url.endsWith('/status')) {
          return { ok: false, status: 404, statusText: 'Not Found', text: async () => 'not found' };
        }
        pingFetchCalled = true;
        if (init?.signal?.aborted) {
          return Promise.reject(new DOMException('Ping aborted', 'AbortError'));
        }
        return { ok: true, status: 200, text: async () => '{}' };
      },
      skipDynamicImport: true,
    });
    assert.equal(headerCalls, 2);
    assert.equal(pingFetchCalled, false);
    assert.equal(connRes.ok, false);
    assert.equal(connRes.modelCount, 0);
    assert.equal(connRes.message, '已取消生成');

    // (e1) readCompletionResponse: !res.ok res.text() calls ac.abort() synchronously & rejects with AbortError
    const acNonOkText = new AbortController();
    await assert.rejects(
      () =>
        runStudioGeneration({
          settings: customSettings,
          messages: [{ role: 'user', content: 'hi' }],
          signal: acNonOkText.signal,
          deps: {
            fetch: async () => ({
              ok: false,
              status: 500,
              statusText: 'Internal Server Error',
              text: () => {
                acNonOkText.abort();
                return Promise.reject(new DOMException('Body aborted', 'AbortError'));
              },
            }),
            skipDynamicImport: true,
          },
        }),
      (err) => err.name === 'AbortError' && err.code === 'ABORTED'
    );

    // (e2) readCompletionResponse: stream reader.read() calls ac.abort() synchronously & rejects with AbortError
    const streamProfile = createApiProfile({
      ...profile,
      id: 'p_reader_abort',
      stream: true,
    });
    const streamSettings = createDefaultSettings({
      api: { provider: 'custom', activeProfileId: streamProfile.id, profiles: [streamProfile] },
    });
    const acReader = new AbortController();
    await assert.rejects(
      () =>
        runStudioGeneration({
          settings: streamSettings,
          messages: [{ role: 'user', content: 'hi' }],
          signal: acReader.signal,
          deps: {
            fetch: async () => ({
              ok: true,
              status: 200,
              headers: new Headers({ 'content-type': 'text/event-stream' }),
              body: {
                getReader: () => ({
                  read: () => {
                    acReader.abort();
                    return Promise.reject(new DOMException('Reader aborted', 'AbortError'));
                  },
                  cancel: async () => {},
                  releaseLock: () => {},
                }),
              },
            }),
            skipDynamicImport: true,
          },
        }),
      (err) => err.name === 'AbortError' && err.code === 'ABORTED'
    );

    // (e3) readCompletionResponse: non-stream res.text() & res.json() abort synchronously & reject with AbortError
    const acNonStreamText = new AbortController();
    await assert.rejects(
      () =>
        runStudioGeneration({
          settings: customSettings,
          messages: [{ role: 'user', content: 'hi' }],
          signal: acNonStreamText.signal,
          deps: {
            fetch: async () => ({
              ok: true,
              status: 200,
              headers: new Headers({ 'content-type': 'application/json' }),
              text: () => {
                acNonStreamText.abort();
                return Promise.reject(new DOMException('Text aborted', 'AbortError'));
              },
            }),
            skipDynamicImport: true,
          },
        }),
      (err) => err.name === 'AbortError' && err.code === 'ABORTED'
    );

    const acNonStreamJson = new AbortController();
    await assert.rejects(
      () =>
        runStudioGeneration({
          settings: customSettings,
          messages: [{ role: 'user', content: 'hi' }],
          signal: acNonStreamJson.signal,
          deps: {
            fetch: async () => ({
              ok: true,
              status: 200,
              headers: new Headers({ 'content-type': 'application/json' }),
              json: () => {
                acNonStreamJson.abort();
                return Promise.reject(new DOMException('Json aborted', 'AbortError'));
              },
            }),
            skipDynamicImport: true,
          },
        }),
      (err) => err.name === 'AbortError' && err.code === 'ABORTED'
    );

    // Allow microtasks / event loop to flush any pending unhandledRejection notifications
    await new Promise((resolve) => setTimeout(resolve, 25));
    assert.deepEqual(unhandled, []);
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
});

test('A23: scrubApiKeyFromText redacts combined JSON escaping (\\/ and \\")', () => {
  assert.equal(
    scrubApiKeyFromText('{"err":"bad sk-a\\/b\\"c"}', 'sk-a/b"c'),
    '{"err":"bad [已脱敏]"}'
  );
  assert.equal(
    scrubApiKeyFromText('{"err":"bad sk-a\\/b\\\\c\\"d"}', 'sk-a/b\\c"d'),
    '{"err":"bad [已脱敏]"}'
  );
});

test('H12: savePersonaToHost normalizes subpath uploadJson.path to basename', async () => {
  const powerUser = { personas: {}, persona_descriptions: {} };
  const result = await savePersonaToHost(
    { mode: 'create', name: '林栖', description: '高海拔观测员' },
    {
      powerUser,
      fetch: async (url) => {
        if (String(url).includes('user-default.png')) {
          return { ok: true, blob: async () => new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' }) };
        }
        return { ok: true, json: async () => ({ path: '/User Avatars/1700000001-linqi.png' }) };
      },
      getRequestHeaders: () => ({ 'X-CSRF-Token': 'mock' }),
      saveSettingsDebounced: () => {},
      skipDynamicImport: true,
    }
  );
  assert.equal(result.avatarId, '1700000001-linqi.png');
  assert.equal(powerUser.personas['1700000001-linqi.png'], '林栖');
  assert.equal(Object.hasOwn(powerUser.personas, '/User Avatars/1700000001-linqi.png'), false);
});

test('A24: readCompletionResponse tolerates isolated malformed SSE data lines when valid deltas follow, while all-malformed SSE throws', async () => {
  const profile = createApiProfile({
    id: 'p_sse_malformed',
    baseUrl: 'https://api.example.test/v1',
    apiKey: 'sk-mock-sse-malformed-1234',
    model: 'model-sse',
    stream: true,
  });
  const settings = createDefaultSettings({
    api: { provider: 'custom', activeProfileId: profile.id, profiles: [profile] },
  });

  // (a) Isolated malformed data: line followed by valid data: deltas succeeds
  const chunks = [];
  const resOk = await runStudioGeneration({
    settings,
    messages: [{ role: 'user', content: 'hi' }],
    onChunk: (d, f) => chunks.push({ d, f }),
    deps: {
      fetch: async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
        body: makeByteStream([
          ': keepalive\n',
          'data: {broken_json\n',
          'data: {"choices":[{"delta":{"content":"第一段"}}]}\n\n',
          'data: {also_broken\n',
          'data: {"choices":[{"delta":{"content":"第二段"},"finish_reason":"stop"}]}\n\n',
          'data: [DONE]\n',
        ]),
      }),
      skipDynamicImport: true,
    },
  });
  assert.equal(resOk.text, '第一段第二段');
  assert.deepEqual(chunks, [
    { d: '第一段', f: '第一段' },
    { d: '第二段', f: '第一段第二段' },
  ]);

  // (b) Stream with ONLY malformed data: lines and zero valid chunks throws 响应解析失败
  await assert.rejects(
    () =>
      runStudioGeneration({
        settings,
        messages: [{ role: 'user', content: 'hi' }],
        deps: {
          fetch: async () => ({
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'text/event-stream' }),
            body: makeByteStream([
              ': keepalive\n',
              'data: {bad1\n',
              'data: {bad2\n',
            ]),
          }),
          skipDynamicImport: true,
        },
      }),
    (err) => err.message.includes('响应解析失败')
  );
});

// ============================================================================
// Tier 5 Adversarial Regression Tests (Gaps 5 & 10)
// ============================================================================

test('H13 (Tier 5): buildPersonaRecord guards Object.prototype keys like toString and constructor', async () => {
  for (const protoAvatarId of ['toString', 'constructor', 'valueOf']) {
    const rec = await getActivePersona({
      powerUser: { personas: {}, persona_descriptions: {} },
      userAvatar: protoAvatarId,
      skipDynamicImport: true,
    });
    assert.equal(rec.avatarId, protoAvatarId);
    assert.equal(rec.name, '');
    assert.equal(rec.description, '');
    assert.equal(rec.lorebook, '');
  }
});

test('H14 (Tier 5): README.md documents exact ups:persona-saved detail payload emitted by savePersonaToHost', async () => {
  const dispatched = [];
  const mockWin = {
    dispatchEvent: (ev) => dispatched.push(ev),
  };
  class MockCustomEvent {
    constructor(type, init) {
      this.type = type;
      this.detail = init?.detail;
    }
  }
  const powerUser = {
    personas: { 'u1.png': '林清' },
    persona_descriptions: { 'u1.png': { description: '旧描述', lorebook: 'wb_keep' } },
  };

  await savePersonaToHost(
    { mode: 'overwrite', avatarId: 'u1.png', description: '新描述', setAsActive: true },
    {
      powerUser,
      userAvatar: 'u1.png',
      ctx: { characterId: 7, getCurrentChatId: () => 'chat-7' },
      window: mockWin,
      CustomEvent: MockCustomEvent,
      saveSettingsDebounced: () => {},
      skipDynamicImport: true,
    }
  );

  assert.equal(dispatched.length, 1);
  assert.equal(dispatched[0].type, HOST_CUSTOM_EVENTS.PERSONA_SAVED);
  const actualKeys = Object.keys(dispatched[0].detail).sort();
  assert.deepEqual(actualKeys, [
    'avatarId',
    'characterId',
    'chatId',
    'description',
    'isNew',
    'lorebook',
    'mode',
    'name',
  ]);
  assert.equal(dispatched[0].detail.lorebook, 'wb_keep');

  const readme = fs.readFileSync(path.join(PROJECT_ROOT, 'README.md'), 'utf8');
  const eventLine = readme.split(/\r?\n/).find((l) => l.includes('ups:persona-saved') && l.includes('detail'));
  assert.ok(eventLine, 'README.md must document ups:persona-saved detail payload');
  for (const key of actualKeys) {
    assert.ok(eventLine.includes(key), `README.md ups:persona-saved detail must document ${key}`);
  }
  assert.equal(eventLine.includes('timestamp'), false);
});

test('H15 (Tier 5 | R2): getActiveCharacterContext guards Object.prototype keys like __proto__ and toString', async () => {
  for (const protoKey of ['__proto__', 'toString', 'constructor', 'valueOf']) {
    const res = await getActiveCharacterContext({}, {
      ctx: { characterId: protoKey, characters: {} },
      skipDynamicImport: true,
    });
    assert.equal(res, null);
  }
  // Valid numeric and own string keys still resolve properly
  const valid = await getActiveCharacterContext({}, {
    ctx: {
      characterId: 0,
      characters: [{ name: '测试角色', data: { description: '公开简介' } }],
    },
    skipDynamicImport: true,
  });
  assert.equal(valid?.name, '测试角色');
});

test('A25: runStudioGeneration auto-recovers when upstream rejects trailing assistant prefill and restores prefill heading', async () => {
  const sentBatches = [];
  const customSettings = {
    activeSchemeId: 'manual_prefill_scheme',
    schemes: [
      {
        id: 'manual_prefill_scheme',
        name: '强制预填充测试',
        tailMode: 'assistant_prefill',
        maxTokens: 2048,
        entries: [],
      },
    ],
    api: {
      provider: 'custom',
      activeProfileId: 'p_strict',
      profiles: [
        {
          id: 'p_strict',
          name: '严格用户收尾中转',
          baseUrl: 'https://relay.example.com/v1',
          apiKey: 'sk-mock-strict-1111',
          model: 'strict-model-v1',
          maxTokens: 2048,
          stream: false,
        },
      ],
    },
  };

  let attempt = 0;
  const res = await runStudioGeneration({
    settings: customSettings,
    messages: [
      { role: 'system', content: '系统设定' },
      { role: 'user', content: '请生成人设' },
      { role: 'assistant', content: '【基础人设】' },
    ],
    deps: {
      directFetch: async (_url, init) => {
        attempt += 1;
        const body = JSON.parse(init.body);
        sentBatches.push(body.messages);
        if (attempt === 1) {
          return {
            ok: false,
            status: 400,
            statusText: 'Bad Request',
            text: async () => JSON.stringify({ error: { message: 'Conversation must end with a user message' } }),
          };
        }
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          text: async () =>
            JSON.stringify({
              choices: [{ message: { content: '【基础人设】\n## 外貌\n干净利落。' }, finish_reason: 'stop' }],
            }),
        };
      },
    },
  });

  assert.equal(attempt, 2);
  assert.equal(sentBatches[0].at(-1).role, 'assistant');
  assert.equal(sentBatches[1].at(-1).role, 'user');
  assert.equal(res.retriedWithoutPrefill, true);
  assert.ok(res.text.includes('【基础人设】'));

  // Also verify prefill heading restoration when native prefill succeeds with continuation-only text
  const resPrefillOk = await runStudioGeneration({
    settings: customSettings,
    messages: [
      { role: 'user', content: '请生成人设' },
      { role: 'assistant', content: '【基础人设】' },
    ],
    deps: {
      directFetch: async () => ({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        text: async () =>
          JSON.stringify({
            choices: [{ message: { content: '## 外貌与印象\n短发清爽。' }, finish_reason: 'stop' }],
          }),
      }),
    },
  });
  assert.equal(resPrefillOk.text, '【基础人设】\n## 外貌与印象\n短发清爽。');
});

// ============================================================================
// v1.3.0 Host Persona Reading & API Token Headroom Regression Tests
// ============================================================================

test('H16: ctx.powerUserSettings (real SillyTavern getContext shape) and buildImportCandidates multi-depth specifiers', async () => {
  const scriptCandidates = buildImportCandidates('personas.js');
  assert.ok(scriptCandidates.includes('../../../personas.js'));
  assert.ok(scriptCandidates.includes('../../../../personas.js'));
  assert.ok(scriptCandidates.includes('../../../../../personas.js'));
  assert.ok(scriptCandidates.includes('/scripts/personas.js'));

  const rootCandidates = buildImportCandidates('script.js', true);
  assert.ok(rootCandidates.includes('../../../script.js'));
  assert.ok(rootCandidates.includes('../../../../script.js'));
  assert.ok(rootCandidates.includes('../../../../../script.js'));
  assert.ok(rootCandidates.includes('/script.js'));

  const powerUserSettings = {
    personas: {
      'st_real.png': '沈初',
    },
    persona_descriptions: {
      'st_real.png': {
        description: '常年在档案馆夜班整理旧卷宗。',
        title: '馆员',
        lorebook: 'wb_archive',
        position: 0,
        depth: 2,
        role: 0,
      },
    },
    persona_description: '常年在档案馆夜班整理旧卷宗。',
    persona_description_position: 0,
    persona_description_depth: 2,
    persona_description_role: 0,
    persona_description_lorebook: 'wb_archive',
  };

  // Real SillyTavern getContext() exposes powerUserSettings (ctx.powerUser is undefined, ctx.userAvatar is undefined)
  const ctx = {
    name1: '沈初',
    powerUserSettings,
  };

  const active = await getActivePersona({ ctx, document: null, skipDynamicImport: true });
  assert.ok(active);
  assert.equal(active.avatarId, 'st_real.png');
  assert.equal(active.name, '沈初');
  assert.equal(active.description, '常年在档案馆夜班整理旧卷宗。');
  assert.equal(active.lorebook, 'wb_archive');
  assert.equal(active.isActive, true);

  const listed = await listPersonas({ ctx, document: null, skipDynamicImport: true });
  assert.equal(listed.length, 1);
  assert.equal(listed[0].avatarId, 'st_real.png');
  assert.equal(listed[0].isActive, true);
});

test('H17: getActivePersona & listPersonas infer avatarId from DOM/description or fall back to __live_persona__ so non-empty persona is never lost', async () => {
  // (a) Infers avatarId from selected DOM block #user_avatar_block .avatar-container.selected[data-avatar-id]
  const domSelectedDoc = {
    querySelector: (sel) => {
      if (sel.includes('#user_avatar_block')) {
        return { getAttribute: (attr) => (attr === 'data-avatar-id' ? 'dom_sel.png' : null) };
      }
      return null;
    },
  };
  const puWithEmptySlotDesc = {
    personas: { 'dom_sel.png': '陆澄' },
    persona_descriptions: { 'dom_sel.png': { description: '' } },
    persona_description: '来自镜像字段的完整设定正文。',
  };
  const activeFromDomBlock = await getActivePersona({
    ctx: { powerUserSettings: puWithEmptySlotDesc },
    document: domSelectedDoc,
    skipDynamicImport: true,
  });
  assert.equal(activeFromDomBlock.avatarId, 'dom_sel.png');
  assert.equal(activeFromDomBlock.name, '陆澄');
  assert.equal(activeFromDomBlock.description, '来自镜像字段的完整设定正文。');

  // (b) Falls back to __live_persona__ when user_avatar is unavailable and no slot matches power_user.persona_description
  const puUnmatched = {
    personas: { 'saved_a.png': '旧档案' },
    persona_descriptions: { 'saved_a.png': { description: '旧档案固定文本' } },
    persona_description: '当前面板里直接手写的新人设内容。',
    persona_description_lorebook: 'wb_live',
    persona_description_position: 1,
    persona_description_depth: 4,
    persona_description_role: 0,
  };
  const liveActive = await getActivePersona({
    ctx: { name1: '温言', powerUserSettings: puUnmatched },
    document: null,
    skipDynamicImport: true,
  });
  assert.equal(liveActive.avatarId, LIVE_PERSONA_AVATAR_ID);
  assert.equal(liveActive.name, '温言');
  assert.equal(liveActive.description, '当前面板里直接手写的新人设内容。');
  assert.equal(liveActive.lorebook, 'wb_live');
  assert.equal(liveActive.position, 1);
  assert.equal(liveActive.depth, 4);
  assert.equal(liveActive.isActive, true);

  const listedWithLive = await listPersonas({
    ctx: { name1: '温言', powerUserSettings: puUnmatched },
    document: null,
    skipDynamicImport: true,
  });
  assert.equal(listedWithLive.length, 2);
  assert.equal(listedWithLive[0].avatarId, LIVE_PERSONA_AVATAR_ID);
  assert.equal(listedWithLive[0].description, '当前面板里直接手写的新人设内容。');
  assert.equal(listedWithLive[1].avatarId, 'saved_a.png');

  // (c) Pure DOM fallback (#persona_description textarea + #your_name) even when power_user is unavailable
  const pureDomDoc = {
    querySelector: (sel) => {
      if (sel === '#persona_description') return { value: '仅存在于 DOM 文本框中的现有人设。' };
      if (sel === '#your_name') return { textContent: '叶知秋' };
      return null;
    },
  };
  const domOnlyActive = await getActivePersona({
    ctx: null,
    powerUser: null,
    document: pureDomDoc,
    skipDynamicImport: true,
  });
  assert.ok(domOnlyActive);
  assert.equal(domOnlyActive.avatarId, LIVE_PERSONA_AVATAR_ID);
  assert.equal(domOnlyActive.name, '叶知秋');
  assert.equal(domOnlyActive.description, '仅存在于 DOM 文本框中的现有人设。');

  const domOnlyList = await listPersonas({
    ctx: null,
    powerUser: null,
    document: pureDomDoc,
    skipDynamicImport: true,
  });
  assert.equal(domOnlyList.length, 1);
  assert.equal(domOnlyList[0].avatarId, LIVE_PERSONA_AVATAR_ID);
});

test('H18: savePersonaToHost overwrite with __live_persona__ updates power_user.persona_description and DOM #persona_description while preserving ghost avatarId guard', async () => {
  const descTextarea = { value: '旧的面板人设文本' };
  const mockDoc = {
    querySelector: (sel) => {
      if (sel === '#persona_description') return descTextarea;
      if (sel === '#your_name') return { textContent: '原名' };
      return null;
    },
  };

  const powerUserSettings = {
    personas: {},
    persona_descriptions: {},
    persona_description: '旧的面板人设文本',
    persona_description_lorebook: 'wb_prev',
    persona_description_position: 0,
    persona_description_depth: 2,
    persona_description_role: 0,
  };

  const setUserNameCalls = [];
  let setPersonaDescCalls = 0;
  let saveCalls = 0;
  const emitted = [];
  const dispatched = [];

  class MockCustomEvent {
    constructor(type, init) {
      this.type = type;
      this.detail = init?.detail;
    }
  }

  const saved = await savePersonaToHost(
    {
      mode: 'overwrite',
      avatarId: LIVE_PERSONA_AVATAR_ID,
      name: '新名字',
      description: '写入后的完整新人设文本',
      lorebook: 'wb_next',
    },
    {
      ctx: { name1: '原名', characterId: 2, chatId: 'chat_live', powerUserSettings },
      document: mockDoc,
      setUserName: (n) => setUserNameCalls.push(n),
      setPersonaDescription: () => {
        setPersonaDescCalls += 1;
      },
      saveSettingsDebounced: () => {
        saveCalls += 1;
      },
      eventSource: {
        emit: async (type, payload) => emitted.push({ type, payload }),
      },
      eventTypes: { PERSONA_UPDATED: 'persona_updated' },
      window: { dispatchEvent: (e) => dispatched.push(e) },
      CustomEvent: MockCustomEvent,
      skipDynamicImport: true,
    }
  );

  assert.equal(saved.avatarId, LIVE_PERSONA_AVATAR_ID);
  assert.equal(saved.name, '新名字');
  assert.equal(saved.description, '写入后的完整新人设文本');
  assert.equal(saved.lorebook, 'wb_next');
  assert.equal(saved.isNew, false);
  assert.equal(powerUserSettings.persona_description, '写入后的完整新人设文本');
  assert.equal(powerUserSettings.persona_description_lorebook, 'wb_next');
  assert.equal(descTextarea.value, '写入后的完整新人设文本');
  assert.deepEqual(setUserNameCalls, ['新名字']);
  assert.equal(setPersonaDescCalls, 1);
  assert.equal(saveCalls, 1);
  assert.equal(
    emitted.some((e) => e.type === 'persona_updated' && e.payload === LIVE_PERSONA_AVATAR_ID),
    true
  );
  assert.equal(dispatched.length, 1);
  assert.equal(dispatched[0].type, HOST_CUSTOM_EVENTS.PERSONA_SAVED);
  assert.equal(dispatched[0].detail.avatarId, LIVE_PERSONA_AVATAR_ID);

  // Explicit non-existent avatarId still throws 未找到目标人设
  await assert.rejects(
    () =>
      savePersonaToHost(
        { mode: 'overwrite', avatarId: 'ghost.png', description: '不应写入' },
        { ctx: { powerUserSettings }, document: mockDoc, skipDynamicImport: true }
      ),
    /未找到目标人设/
  );
});

test('A26: runStudioGeneration honors minMaxTokens across host & custom transports without mutating settings', async () => {
  // (a) Host ChatCompletionService + generateQuietPrompt raise max_tokens / responseLength to minMaxTokens & clamp at 32768
  const hostSettings = createDefaultSettings();
  hostSettings.schemes[0].maxTokens = 2048;
  const hostSnapshot = structuredClone(hostSettings);

  let capturedHostPayload = null;
  await runStudioGeneration({
    settings: hostSettings,
    messages: [{ role: 'user', content: '生成自检人设' }],
    minMaxTokens: 4200,
    deps: {
      ctx: {
        mainApi: 'openai',
        chatCompletionSettings: { chat_completion_source: 'openai', openai_model: 'gpt-4o' },
        ChatCompletionService: {
          presetToGeneratePayload: async (_p, _o, override) => {
            capturedHostPayload = override;
            return { ...override, chat_completion_source: 'openai' };
          },
          sendRequest: async () => ({ content: '宿主生成结果' }),
        },
      },
      skipDynamicImport: true,
    },
  });
  assert.equal(capturedHostPayload.max_tokens, 4200);
  assert.deepEqual(hostSettings, hostSnapshot);

  let capturedQuietOpts = null;
  await runStudioGeneration(
    {
      settings: hostSettings,
      messages: [{ role: 'user', content: '超上限夹紧测试' }],
      minMaxTokens: 99999,
    },
    {
      ctx: {
        mainApi: 'novel',
        generateQuietPrompt: async (opts) => {
          capturedQuietOpts = opts;
          return '静默结果';
        },
      },
      skipDynamicImport: true,
    }
  );
  assert.equal(capturedQuietOpts.responseLength, 32768);
  assert.deepEqual(hostSettings, hostSnapshot);

  // (b) Custom API (ST proxy & direct) uses Math.max(profile.maxTokens, minMaxTokens) without mutating settings
  const lowProfile = createApiProfile({
    id: 'p_low_tok',
    baseUrl: 'https://api.example.test/v1',
    apiKey: 'sk-mock-headroom-1111',
    model: 'm-test',
    maxTokens: 2048,
    stream: false,
  });
  const customSettings = createDefaultSettings({
    api: { provider: 'custom', activeProfileId: lowProfile.id, profiles: [lowProfile] },
  });
  const customSnapshot = structuredClone(customSettings);

  let capturedProxyBody = null;
  await runStudioGeneration({
    settings: customSettings,
    messages: [{ role: 'user', content: '代理测试' }],
    minMaxTokens: 4200,
    deps: {
      fetch: async (_url, init) => {
        capturedProxyBody = JSON.parse(init.body);
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          text: async () => JSON.stringify({ choices: [{ message: { content: '代理成功' }, finish_reason: 'stop' }] }),
        };
      },
      skipDynamicImport: true,
    },
  });
  assert.equal(JSON.parse(capturedProxyBody.custom_include_body).max_tokens, 4200);
  assert.deepEqual(customSettings, customSnapshot);

  // Higher profile.maxTokens (8192 > 4200) is preserved
  customSettings.api.profiles[0].maxTokens = 8192;
  const highSnapshot = structuredClone(customSettings);
  let capturedDirectBody = null;
  await runStudioGeneration({
    settings: customSettings,
    messages: [{ role: 'user', content: '直连测试' }],
    minMaxTokens: 4200,
    deps: {
      transport: 'direct',
      fetch: async (_url, init) => {
        capturedDirectBody = JSON.parse(init.body);
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          text: async () => JSON.stringify({ choices: [{ message: { content: '直连成功' }, finish_reason: 'stop' }] }),
        };
      },
      skipDynamicImport: true,
    },
  });
  assert.equal(capturedDirectBody.max_tokens, 8192);
  assert.deepEqual(customSettings, highSnapshot);
});

test('H7 (R1): listCharacters, getCharacterContext & loadCharacterWorldbookEntries read non-active cards and worldbooks non-destructively', async () => {
  let saveWorldInfoCalls = 0;
  let selectCharacterCalls = 0;

  const primaryWorldbook = {
    entries: {
      0: { uid: 0, comment: '雾港规则', key: ['雾港'], content: '入夜后码头封锁。', disable: false, constant: true, order: 10 },
      1: { uid: 1, comment: '隐藏禁区', key: ['灯塔'], content: '灯塔底层禁止外人进入。', disable: true, constant: false, order: 20 },
    },
  };
  const extraWorldbook = {
    entries: {
      5: { uid: 5, comment: '补充商行', key: ['商行'], content: '港务局由沈氏代行调度。', disable: false, order: 30 },
    },
  };
  const primarySnapshot = structuredClone(primaryWorldbook);
  const extraSnapshot = structuredClone(extraWorldbook);

  const characters = [
    {
      avatar: 'active_char.png',
      name: '当前对话角色',
      shallow: false,
      data: { description: '当前角色简介', extensions: { world: '' } },
    },
    {
      avatar: 'non_active.png',
      name: '沈砚',
      shallow: true,
      data: {
        extensions: { world: '雾港主书' },
        character_book: {
          name: '沈砚内置设定',
          entries: [
            { id: 'emb1', comment: '怀表秘密', keys: ['怀表'], content: '怀表内侧刻有年份。', enabled: true, order: 5 },
          ],
        },
      },
    },
    {
      avatar: 'sys.png',
      name: 'SillyTavern System',
      shallow: false,
    },
  ];

  const ctx = {
    characterId: 0,
    name2: '当前对话角色',
    chatId: 'chat-active',
    characters,
    selectCharacterById: () => {
      selectCharacterCalls += 1;
    },
    unshallowCharacter: async (chid) => {
      if (String(chid) === '1') {
        characters[1].shallow = false;
        characters[1].data.description = '港务局调度员';
        characters[1].data.personality = '寡言克制';
        characters[1].data.scenario = '雨夜港务大厅';
        characters[1].data.first_mes = '灯还亮着。';
        characters[1].data.system_prompt = 'PRIVATE_SYS';
      }
    },
  };

  const deps = {
    ctx,
    charLore: [{ name: 'non_active', extraBooks: ['补充商行书'] }],
    saveWorldInfo: async () => {
      saveWorldInfoCalls += 1;
    },
    fetch: async (url, init) => {
      if (url === '/api/worldinfo/get') {
        const body = JSON.parse(init.body);
        if (body.name === '雾港主书') {
          return { ok: true, json: async () => structuredClone(primaryWorldbook) };
        }
        if (body.name === '补充商行书') {
          return { ok: true, json: async () => structuredClone(extraWorldbook) };
        }
      }
      return { ok: false, status: 404 };
    },
    skipDynamicImport: true,
  };

  const listed = await listCharacters(deps);
  assert.equal(listed.length, 2); // SillyTavern System filtered out
  assert.equal(listed[0].chid, '0');
  assert.equal(listed[0].isActive, true);
  assert.equal(listed[1].chid, '1');
  assert.equal(listed[1].isActive, false);

  const nonActiveCtx = await getCharacterContext(
    { chid: '1' },
    { includeWorldSummary: true, includeWorldEntries: true },
    deps
  );
  assert.equal(ctx.characterId, 0);
  assert.equal(selectCharacterCalls, 0);
  assert.equal(nonActiveCtx.name, '沈砚');
  assert.equal(nonActiveCtx.isActive, false);
  assert.equal(nonActiveCtx.description, '港务局调度员');
  assert.equal(nonActiveCtx.worldEntries.length, 4);
  assert.equal(nonActiveCtx.worldEntries.some((e) => e.comment === '隐藏禁区' && e.defaultEnabled === false), true);
  assert.equal(nonActiveCtx.worldEntries.some((e) => e.comment === '补充商行' && e.sourceType === 'world'), true);
  assert.equal(nonActiveCtx.worldEntries.some((e) => e.comment === '怀表秘密' && e.sourceType === 'embedded'), true);
  assert.equal(Object.hasOwn(nonActiveCtx, 'system'), false);

  // Original worldbooks and saveWorldInfo remain completely untouched
  assert.equal(saveWorldInfoCalls, 0);
  assert.deepEqual(primaryWorldbook, primarySnapshot);
  assert.deepEqual(extraWorldbook, extraSnapshot);

  // Shallow non-active fallback via /api/characters/get must NOT be shadowed by empty strings from getCharacterCardFields
  const shallowCharacters = [
    { avatar: 'active.png', name: '当前甲', shallow: false, data: { description: '甲' } },
    { avatar: 'shallow_api.png', name: '浅卡乙', shallow: true },
  ];
  let shallowSelectCalls = 0;
  const shallowCtx = {
    characterId: 0,
    characters: shallowCharacters,
    selectCharacterById: () => {
      shallowSelectCalls += 1;
    },
    getCharacterCardFields: () => ({
      description: '',
      personality: '',
      scenario: '',
      firstMessage: '',
    }),
  };
  const shallowResult = await getCharacterContext(
    { chid: '1' },
    { includeWorldSummary: false },
    {
      ctx: shallowCtx,
      fetch: async (url, init) => {
        if (url === '/api/characters/get') {
          const body = JSON.parse(init.body);
          assert.equal(body.avatar_url, 'shallow_api.png');
          return {
            ok: true,
            json: async () => ({
              data: {
                description: '来自API的真实角色简介',
                personality: '沉稳克制',
                scenario: '雨夜码头',
                first_mes: '你比约定时间晚了五分钟。',
              },
            }),
          };
        }
        return { ok: false, status: 404 };
      },
      skipDynamicImport: true,
    }
  );
  assert.equal(shallowCtx.characterId, 0);
  assert.equal(shallowSelectCalls, 0);
  assert.equal(shallowResult.shallow, false);
  assert.equal(shallowResult.description, '来自API的真实角色简介');
  assert.equal(shallowResult.personality, '沉稳克制');
  assert.equal(shallowResult.scenario, '雨夜码头');
  assert.equal(shallowResult.firstMessage, '你比约定时间晚了五分钟。');
});

test('H19 (R1): listWorldbooks reads and deduplicates sorted names read-only without mutating host or calling updateWorldInfoList', async () => {
  let updateCalls = 0;
  const rawInput = ['  雾港主书 ', '冬夜书目', '雾港主书', '', '  ', null, 42, '安平镇'];
  const snapshot = [...rawInput];

  const fromDeps = await listWorldbooks({
    worldNames: rawInput,
    updateWorldInfoList: () => {
      updateCalls += 1;
    },
    skipDynamicImport: true,
  });
  assert.deepEqual(rawInput, snapshot);
  assert.equal(updateCalls, 0);
  assert.equal(fromDeps.length, 4);
  assert.ok(fromDeps.includes('雾港主书'));
  assert.ok(fromDeps.includes('42'));

  const fromCtx = await listWorldbooks({
    ctx: { worldInfo: { world_names: ['乙书', '甲书', '乙书'] } },
    skipDynamicImport: true,
  });
  assert.deepEqual(fromCtx, ['甲书', '乙书']);

  const prevGlobal = globalThis.world_names;
  try {
    globalThis.world_names = ['全局书B', '全局书A'];
    const fromGlobal = await listWorldbooks({ skipDynamicImport: true });
    assert.deepEqual(fromGlobal, ['全局书A', '全局书B']);
  } finally {
    if (prevGlobal === undefined) {
      delete globalThis.world_names;
    } else {
      globalThis.world_names = prevGlobal;
    }
  }
});

test('H20 (R4): getCharacterContext attaches mesExamples only when includeDialogueExamples is true and supports (target, deps, options)', async () => {
  let selectCalls = 0;
  const ctx = {
    characterId: 0,
    chatId: 'chat-active-1',
    selectCharacterById: () => {
      selectCalls += 1;
    },
    characters: [
      {
        avatar: 'main.png',
        name: '主角色',
        shallow: false,
        data: { description: '主角色简介' },
      },
      {
        avatar: 'comp.png',
        name: '客串甲',
        shallow: false,
        data: {
          description: '姓名: 客串甲\n身高 180cm',
          mes_example: '<START>\n客串甲：先把茶端过去吧。',
        },
      },
    ],
  };

  // Default omitted -> mesExamples MUST NOT exist
  const withoutExamples = await getCharacterContext({ chid: '1' }, {}, { ctx, skipDynamicImport: true });
  assert.equal(Object.hasOwn(withoutExamples, 'mesExamples'), false);
  assert.equal(ctx.characterId, 0);
  assert.equal(ctx.chatId, 'chat-active-1');
  assert.equal(selectCalls, 0);

  // Canonical (target, options, deps) with includeDialogueExamples: true
  const withExamples = await getCharacterContext(
    { chid: '1' },
    { includeDialogueExamples: true },
    { ctx, skipDynamicImport: true }
  );
  assert.equal(withExamples.mesExamples, '<START>\n客串甲：先把茶端过去吧。');

  // Tolerant (target, deps, options) order
  const swappedOrder = await getCharacterContext(
    { chid: '1' },
    { ctx, skipDynamicImport: true },
    { includeDialogueExamples: true }
  );
  assert.equal(swappedOrder.mesExamples, '<START>\n客串甲：先把茶端过去吧。');
  assert.equal(ctx.characterId, 0);
  assert.equal(selectCalls, 0);
});

test('H21 (R1): saveSupplementaryWorldbook supports idempotent in-place upsert and managed-only pruneManaged', async () => {
  const store = {
    '用户专属世界书': {
      entries: {
        10: {
          uid: 10,
          key: ['旧角色'],
          comment: '用户手写条目',
          content: '玩家自己写的世界观条目，不能被删。',
          constant: false,
          selective: true,
          disable: false,
          extensions: { other_plugin: { keep: 1 } },
        },
        11: {
          uid: 11,
          key: ['老客串'],
          comment: '客串角色：老客串',
          content: '旧版托管内容',
          extensions: {
            [EXTENSION_SETTINGS_KEY]: { managed: true, slotKey: 'ups:companion:old_comp' },
          },
        },
      },
    },
  };

  let nextUid = 20;
  const deps = {
    skipDynamicImport: true,
    loadWorldInfo: async (name) => structuredClone(store[name] || { entries: {} }),
    saveWorldInfo: async (name, data) => {
      store[name] = structuredClone(data);
    },
    createWorldInfoEntry: (_name, data) => {
      const uid = nextUid++;
      const entry = { uid, key: [], comment: '', content: '' };
      data.entries[uid] = entry;
      return entry;
    },
    updateWorldInfoList: async () => {},
  };

  // First upsert + pruneManaged: creates c1, updates/prunes old_comp, keeps user entry 10 untouched
  const res1 = await saveSupplementaryWorldbook(
    {
      worldName: '用户专属世界书',
      upsert: true,
      pruneManaged: true,
      entries: [
        {
          key: ['顾淮', '哥哥'],
          comment: '客串角色：顾淮',
          content: '第一版客串设定',
          order: 100,
          extensions: {
            [EXTENSION_SETTINGS_KEY]: { managed: true, slotKey: 'ups:companion:c1' },
          },
        },
      ],
    },
    deps
  );
  assert.equal(res1.createdCount, 1);
  assert.equal(res1.updatedCount, 0);
  assert.equal(res1.prunedCount, 1);

  const savedEntries1 = Object.values(store['用户专属世界书'].entries);
  assert.equal(savedEntries1.length, 2);
  assert.ok(savedEntries1.some((e) => e.uid === 10 && e.extensions?.other_plugin?.keep === 1));
  const c1Uid = savedEntries1.find((e) => e.extensions?.[EXTENSION_SETTINGS_KEY]?.slotKey === 'ups:companion:c1').uid;

  // Second upsert: updates in-place preserving uid, zero duplicates
  const res2 = await saveSupplementaryWorldbook(
    {
      worldName: '用户专属世界书',
      upsert: true,
      pruneManaged: true,
      entries: [
        {
          key: ['顾淮', '二哥'],
          comment: '客串角色：顾淮',
          content: '更新后的客串设定',
          order: 80,
          extensions: {
            [EXTENSION_SETTINGS_KEY]: { managed: true, slotKey: 'ups:companion:c1' },
          },
        },
      ],
    },
    deps
  );
  assert.equal(res2.createdCount, 0);
  assert.equal(res2.updatedCount, 1);
  assert.equal(res2.prunedCount, 0);
  const savedEntries2 = Object.values(store['用户专属世界书'].entries);
  assert.equal(savedEntries2.length, 2);
  const updatedC1 = savedEntries2.find((e) => e.uid === c1Uid);
  assert.equal(updatedC1.content, '更新后的客串设定');
  assert.equal(updatedC1.order, 80);

  // Removing all managed entries with pruneManaged: true leaves non-managed entry 10 intact
  const res3 = await saveSupplementaryWorldbook(
    {
      worldName: '用户专属世界书',
      upsert: true,
      pruneManaged: true,
      entries: [],
    },
    deps
  );
  assert.equal(res3.prunedCount, 1);
  assert.deepEqual(Object.keys(store['用户专属世界书'].entries), ['10']);
});

test('H22: getCharacterContext resolves realName, flags disabled entries & merges character_lore + acting_rules when description < 300 chars', async () => {
  const ctx = {
    characterId: 0,
    characters: [
      {
        avatar: 'title_card.png',
        name: '《青石巷往事》',
        shallow: false,
        data: {
          description: '',
          extensions: { world: '青石巷世界书' },
        },
      },
    ],
  };

  const result = await getCharacterContext(
    { chid: '0' },
    { includeWorldSummary: true, includeWorldEntries: true },
    {
      ctx,
      loadWorldInfo: async () => ({
        entries: {
          0: { uid: 0, disable: false, comment: '人物档案', content: '姓名: 陆停云\n性格温和但极有原则。' },
          1: { uid: 1, disable: false, comment: '令行禁止', content: '说话不带儿化音，遇事不轻易失控。' },
          2: { uid: 2, disable: false, comment: '状态栏', content: '<status>日期</status>' },
          3: { uid: 3, disable: true, comment: 'IF分支档案', content: '未启用的分支设定，不该自动合并。' },
        },
      }),
      skipDynamicImport: true,
    }
  );

  assert.equal(result.realName, '陆停云');
  assert.ok(result.description.includes('性格温和但极有原则'));
  assert.ok(result.description.includes('说话不带儿化音'));
  assert.equal(result.description.includes('<status>'), false);
  assert.equal(result.description.includes('未启用的分支设定'), false);

  const ifEntry = result.worldEntries.find((e) => e.comment === 'IF分支档案');
  assert.equal(ifEntry.disabled, true);
  assert.equal(ifEntry.category, 'character_lore');
  const ruleEntry = result.worldEntries.find((e) => e.comment === '令行禁止');
  assert.equal(ruleEntry.category, 'acting_rules');
  const sysEntry = result.worldEntries.find((e) => e.comment === '状态栏');
  assert.equal(sysEntry.category, 'system_format');
});

test('H23 (R1.3): saveSupplementaryWorldbook persists explicit position, depth, role, order & default overrides', async () => {
  const saved = [];
  const deps = {
    skipDynamicImport: true,
    loadWorldInfo: async () => ({ entries: {} }),
    createWorldInfoEntry: (_name, data) => {
      const uid = Object.keys(data.entries).length;
      data.entries[uid] = { uid };
      return data.entries[uid];
    },
    saveWorldInfo: async (_name, data) => {
      saved.push(structuredClone(data));
    },
    updateWorldInfoList: async () => {},
  };

  await saveSupplementaryWorldbook(
    {
      worldName: '用户补充世界书',
      defaultPosition: 4,
      defaultDepth: 3,
      defaultRole: 0,
      defaultOrder: 140,
      entries: [
        { key: ['暗线'], comment: '【{{user}}补充设定】暗线', content: '深度条目', depth: 5, role: 1, order: 155 },
        { key: ['后置'], comment: '【{{user}}补充设定】后置', content: '角色后置条目', position: 1, order: 130 },
        { key: ['默认'], comment: '【{{user}}补充设定】默认', content: '走默认配置条目' },
      ],
    },
    deps
  );

  const e0 = saved[0].entries[0];
  const e1 = saved[0].entries[1];
  const e2 = saved[0].entries[2];

  assert.equal(e0.position, 4);
  assert.equal(e0.depth, 5);
  assert.equal(e0.role, 1);
  assert.equal(e0.order, 155);

  assert.equal(e1.position, 1);
  assert.equal(e1.order, 130);
  assert.equal('depth' in e1, false);

  assert.equal(e2.position, 4);
  assert.equal(e2.depth, 3);
  assert.equal(e2.role, 0);
  assert.equal(e2.order, 140);
});
