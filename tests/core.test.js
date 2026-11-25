import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
  BUILTIN_USAGE_GUIDE,
  BUILTIN_BANNED_CATEGORIES,
  DEFAULT_BANNED_PHRASES,
  QUALITATIVE_LABEL_PATTERNS,
  BUILTIN_PRESET_SCHEMES,
} from '../src/presets.js';

import {
  DEFAULT_PREFILL,
  DEFAULT_TRIGGER,
  ST_SENSITIVE_FIELDS,
  createDefaultSettings,
  sanitizeSettingsForExport,
  cloneScheme,
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
  countReadableChars,
  computeLengthBudget,
  applyTargetCharsToScheme,
  inferOptimalTailMode,
  extractPersonaPoints,
  buildDraftAuditInstruction,
  buildGenerationMessages,
  applyTailRoleStrategy,
  exportSillyTavernPreset,
  exportDraftStripRegexScript,
  stripDraftAuditBlocks,
  hasReplayRiskExamples,
  appendAntiParrotClause,
  replaceEmDashes,
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
  buildCustomChatPayload,
  parseChatCompletionChunkOrJson,
} from '../src/core.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// ============================================================================
// Group 1: presets.js Structural, Pure-ESM, Categorized Lexicon & Sanitization
// ============================================================================

test('Group 1.1: presets.js exports structural constants, balanced vibe anchors, backstory/spotlight modes & 4 original persona-sheet banned packs', () => {
  assert.equal(CORE_SECTION_HEADER, '【基础人设】');
  assert.equal(SHELL_SECTION_HEADER, '【当前背景与关系】');
  assert.equal(WORLDBOOK_DIVIDER, '【补充世界书条目】');
  assert.equal(DRAFT_START_MARKER, '【草稿自检】');
  assert.equal(DRAFT_END_MARKER, '【/草稿自检】');
  assert.deepEqual(VISIBILITY_MARKERS, [
    '[外表可见]',
    '[开场已知]',
    '[私密未公开]',
  ]);
  assert.equal(VIBE_ANCHOR_EXAMPLES.length, 20);
  for (const v of ['沉稳可靠', '外冷内热', '痞帅散漫', '少年意气', '冷面护短', '清冷克制', '冷脸萌', '嘴硬心软']) {
    assert.ok(VIBE_ANCHOR_EXAMPLES.includes(v), `Missing vibe anchor: ${v}`);
  }
  assert.equal(DEFAULT_MUST_HAVE_TEMPLATES.length, 4);
  for (const tpl of DEFAULT_MUST_HAVE_TEMPLATES) {
    assert.ok(tpl.id && tpl.label && tpl.content);
  }
  assert.deepEqual(SPOTLIGHT_MODES.map((m) => m.id), ['balanced', 'featured', 'light_daily']);
  assert.deepEqual(BACKSTORY_MODES.map((m) => m.id), ['light_vibe', 'blank_self', 'rich_arc']);
  assert.ok(ANTI_PARROT_CLAUSE.includes('并非固定必演桥段'));
  assert.equal(CORE_SECTION_HEADER.includes('本体核'), false);
  assert.equal(SHELL_SECTION_HEADER.includes('剧场壳'), false);
  assert.ok(WORD_COUNT_PRESETS.length >= 5);
  assert.ok(BUILTIN_USAGE_GUIDE.includes('SillyTavern'));

  assert.equal(BUILTIN_BANNED_CATEGORIES.length, 4);
  const expectedCatIds = [
    'persona_marysue',
    'persona_resume_ai',
    'persona_tic_lock',
    'persona_meta_overstep',
  ];
  assert.deepEqual(
    BUILTIN_BANNED_CATEGORIES.map((c) => c.id),
    expectedCatIds
  );

  for (const cat of BUILTIN_BANNED_CATEGORIES) {
    assert.ok(cat.name && cat.description);
    assert.equal(cat.scope, 'all');
    assert.ok(Array.isArray(cat.rules) && cat.rules.length >= 1 && cat.rules.length <= 4);
    assert.ok(
      Array.isArray(cat.phrases) && cat.phrases.length >= 10 && cat.phrases.length <= 15,
      `Category ${cat.id} phrases length ${cat.phrases.length} out of 10..15`
    );
  }

  assert.equal(DEFAULT_BANNED_PHRASES.length, 45);
  const trimmedUnique = new Set(DEFAULT_BANNED_PHRASES.map((p) => p.trim()).filter(Boolean));
  assert.equal(trimmedUnique.size, DEFAULT_BANNED_PHRASES.length);

  // Zero em-dashes (——) in preset prompts & label hints to prevent em-dash proliferation, and zero reverse-template priming
  const allPresetPromptText = JSON.stringify({
    QUALITATIVE_LABEL_PATTERNS: QUALITATIVE_LABEL_PATTERNS.map((p) => p.hint),
    BUILTIN_PRESET_SCHEMES,
  });
  assert.equal(allPresetPromptText.includes('——'), false, 'Built-in prompts & hints must not contain —— em-dashes');
  assert.equal(allPresetPromptText.includes('外人面前维持体面'), false, 'Must not prime or reverse-taboo specific personality direction');
});

test('Group 1.2: QUALITATIVE_LABEL_PATTERNS has 16 detectors matching their own labels with causal/gap hints', () => {
  assert.equal(QUALITATIVE_LABEL_PATTERNS.length, 16);
  const labels = QUALITATIVE_LABEL_PATTERNS.map((item) => item.label);
  for (const required of ['娇气', '娇蛮', '傲娇', '清冷', '高冷', '病娇', '呆萌', '腹黑', '温柔', '社恐']) {
    assert.ok(labels.includes(required), `Missing label detector: ${required}`);
  }
  for (const item of QUALITATIVE_LABEL_PATTERNS) {
    assert.ok(item.id && item.category && item.hint.length >= 20);
    assert.ok(item.pattern instanceof RegExp);
    assert.ok(item.pattern.test(item.label), `Pattern for ${item.label} must match itself`);
  }
});

test('Group 1.3: BUILTIN_PRESET_SCHEMES defines 3 relatable built-in presets with 7 modular slots & natural everyday default format', () => {
  assert.equal(Object.keys(BUILTIN_PRESET_SCHEMES).length, 3);
  const { longform_coact, player_controlled, persona_refactor } = BUILTIN_PRESET_SCHEMES;

  assert.equal(longform_coact.name, '适合抢话党');
  assert.equal(longform_coact.style, 'longform');
  assert.equal(longform_coact.targetChars, 1500);
  assert.deepEqual(longform_coact.targetTokens, { min: 1780, max: 2270 });
  assert.equal(longform_coact.maxTokens, 5200);

  assert.equal(player_controlled.name, '适合不抢话党');
  assert.equal(player_controlled.style, 'objective');
  assert.equal(player_controlled.targetChars, 600);
  assert.deepEqual(player_controlled.targetTokens, { min: 720, max: 900 });
  assert.equal(player_controlled.maxTokens, 2800);

  assert.equal(persona_refactor.name, '旧人设改写');
  assert.equal(persona_refactor.style, 'refactor');
  assert.equal(persona_refactor.builtin, true);
  assert.equal(persona_refactor.targetChars, 1500);
  assert.deepEqual(persona_refactor.targetTokens, { min: 1780, max: 2270 });
  assert.equal(persona_refactor.temperature, 0.65);
  assert.equal(persona_refactor.maxTokens, 5200);

  const requiredSlots = ['role', 'context', 'craft', 'taste', 'banned', 'pacing', 'format'];
  for (const scheme of [longform_coact, player_controlled, persona_refactor]) {
    assert.equal(scheme.tailMode, 'auto');
    assert.ok(scheme.prefillText.length > 0);
    assert.ok(scheme.triggerText.length > 0);
    assert.equal(scheme.entries.length, 7);
    const slotTypes = scheme.entries.map((e) => e.slotType);
    for (const slot of requiredSlots) {
      assert.ok(slotTypes.includes(slot), `${scheme.id} missing slotType ${slot}`);
    }
    const joined = scheme.entries.map((e) => e.content).join('\n');
    assert.ok(joined.includes(CORE_SECTION_HEADER));
    assert.ok(joined.includes(SHELL_SECTION_HEADER));
    assert.equal(joined.includes('人物本体核'), false);
    // Default built-in entries use clean everyday prose without forcing [外表可见]/[开场已知]/[私密未公开] brackets
    for (const marker of VISIBILITY_MARKERS) {
      assert.equal(joined.includes(marker), false, `${scheme.id} must not force ${marker} by default`);
    }
  }
});

test('Group 1.4: Pure ESM isolation & sanitization check on src/presets.js and src/core.js', () => {
  const presetsSrc = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'presets.js'), 'utf8');
  const coreSrc = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'core.js'), 'utf8');

  for (const [name, src] of [['presets.js', presetsSrc], ['core.js', coreSrc]]) {
    assert.equal(/\b(window|document|localStorage|sessionStorage|fetch)\b/.test(src), false, `${name} must not reference browser/DOM APIs`);
  }

  const serializedPresets = JSON.stringify({
    BUILTIN_USAGE_GUIDE,
    VIBE_ANCHOR_EXAMPLES,
    BUILTIN_BANNED_CATEGORIES,
    DEFAULT_BANNED_PHRASES,
    QUALITATIVE_LABEL_PATTERNS: QUALITATIVE_LABEL_PATTERNS.map(({ id, label, category, hint }) => ({
      id,
      label,
      category,
      hint,
    })),
    BUILTIN_PRESET_SCHEMES,
  });

  // Zero XML tags or explicit third-party preset/author patterns
  assert.equal(/<\/?[a-zA-Z][a-zA-Z0-9_-]*>/.test(serializedPresets), false);
  assert.equal(/(?:越狱|破限|nsfw|18\+|R18)/i.test(serializedPresets), false);
});

// ============================================================================
// Group 2: Settings Factory, Persistent UI Prefs, Stack CRUD & Scheme CRUD
// ============================================================================

test('Group 2.1: createDefaultSettings returns valid deep-isolated defaults, 3 schemes, disabledCategories & persistent UI prefs', () => {
  const s1 = createDefaultSettings();
  const s2 = createDefaultSettings();
  assert.equal(s1.version, 1);
  assert.equal(s1.palette, 'paper');
  assert.equal(s1.colorMode, 'auto');
  assert.equal(s1.activeSchemeId, 'longform_coact');
  assert.equal(s1.schemes.length, 3);
  assert.deepEqual(
    s1.schemes.map((s) => s.id),
    ['longform_coact', 'player_controlled', 'persona_refactor']
  );
  assert.equal(s1.tasteProfile.useBuiltinBanned, true);
  assert.equal(s1.tasteProfile.bannedSendMode, 'smart_compact');
  assert.deepEqual(s1.tasteProfile.disabledCategories, []);
  assert.equal(s1.api.provider, 'host');
  assert.equal(s1.ui.activeTab, 'studio');
  assert.equal(s1.ui.mode, 'A');
  assert.equal(s1.ui.subMode, 'de_label_reformat');
  assert.equal(s1.ui.spotlightMode, 'balanced');
  assert.equal(s1.ui.backstoryMode, 'light_vibe');
  assert.equal(s1.ui.injectChar, true);
  assert.equal(s1.ui.dualLayer, false);
  assert.equal(s1.ui.visibilityTags, false);
  assert.equal(s1.ui.draftAudit, true);
  assert.equal(s1.ui.antiParrot, true);
  assert.equal(s1.ui.geometry.width, 1080);
  assert.equal(s1.ui.geometry.height, 700);
  assert.equal(s1.ui.minimized, false);
  assert.equal(s1.ui.mustHaveTemplates.length, 4);

  // Legacy v1.0 saved scheme names & old tight maxTokens automatically migrate to clean beginner names & higher maxTokens
  const migratedLegacy = createDefaultSettings({
    schemes: [
      { ...BUILTIN_PRESET_SCHEMES.longform_coact, name: '长文代演主力方案（含语气与反应）', maxTokens: 3200 },
      { ...BUILTIN_PRESET_SCHEMES.player_controlled, name: '纯手控客观方案（零代演台词）', maxTokens: 1200 },
      { ...BUILTIN_PRESET_SCHEMES.persona_refactor, name: '旧人设改写与跨卡重构', maxTokens: 3300 },
    ],
  });
  assert.deepEqual(
    migratedLegacy.schemes.map((s) => s.name),
    ['适合抢话党', '适合不抢话党', '旧人设改写']
  );
  assert.deepEqual(
    migratedLegacy.schemes.map((s) => s.maxTokens),
    [5200, 2800, 5200]
  );

  s1.schemes[0].entries[0].content = 'changed';
  assert.notEqual(s2.schemes[0].entries[0].content, 'changed');

  const partial = createDefaultSettings({
    palette: 'ink',
    activeSchemeId: 'non_existent',
    schemes: [BUILTIN_PRESET_SCHEMES.longform_coact],
    tasteProfile: { bannedSendMode: 'personal_only', disabledCategories: ['persona_tic_lock', 'invalid_cat'] },
    ui: {
      activeTab: 'taste',
      mode: 'B',
      subMode: 'cross_card_adapt',
      spotlightMode: 'featured',
      backstoryMode: 'blank_self',
      injectChar: false,
      dualLayer: true,
      visibilityTags: true,
      draftAudit: false,
      antiParrot: false,
      geometry: { width: 99999, height: 100 },
    },
  });
  assert.equal(partial.palette, 'ink');
  assert.equal(partial.activeSchemeId, 'longform_coact');
  assert.equal(partial.schemes.length, 3);
  assert.equal(partial.tasteProfile.bannedSendMode, 'personal_only');
  assert.deepEqual(partial.tasteProfile.disabledCategories, ['persona_tic_lock']);
  assert.equal(partial.ui.activeTab, 'taste');
  assert.equal(partial.ui.mode, 'B');
  assert.equal(partial.ui.subMode, 'cross_card_adapt');
  assert.equal(partial.ui.spotlightMode, 'featured');
  assert.equal(partial.ui.backstoryMode, 'blank_self');
  assert.equal(partial.ui.injectChar, false);
  assert.equal(partial.ui.dualLayer, true);
  assert.equal(partial.ui.visibilityTags, true);
  assert.equal(partial.ui.draftAudit, false);
  assert.equal(partial.ui.antiParrot, false);
  assert.equal(partial.ui.geometry.width, 3840);
  assert.equal(partial.ui.geometry.height, 280);
});

test('Group 2.2: Stack entry CRUD (clone, toggle, move, update, add, remove) is immutable & guards locked entries', () => {
  const orig = BUILTIN_PRESET_SCHEMES.longform_coact;
  const cloned = cloneScheme(orig, { name: '测试克隆方案' });
  assert.notEqual(cloned.id, orig.id);
  assert.equal(cloned.builtin, false);
  assert.equal(cloned.name, '测试克隆方案');

  const toggled = toggleStackEntry(orig, 'lf_taste', false);
  assert.equal(toggled.entries.find((e) => e.id === 'lf_taste').enabled, false);
  assert.equal(orig.entries.find((e) => e.id === 'lf_taste').enabled, true);

  // Move boundary & adjacent & explicit index
  const noOpUp = moveStackEntry(orig, orig.entries[0].id, 'up');
  assert.deepEqual(noOpUp.entries.map((e) => e.id), orig.entries.map((e) => e.id));

  const noOpDown = moveStackEntry(orig, orig.entries[orig.entries.length - 1].id, 1);
  assert.deepEqual(noOpDown.entries.map((e) => e.id), orig.entries.map((e) => e.id));

  const movedDown = moveStackEntry(orig, 'lf_context', 'down');
  assert.equal(movedDown.entries[2].id, 'lf_context');

  const movedBack = moveStackEntry(movedDown, 'lf_context', -1);
  assert.equal(movedBack.entries[1].id, 'lf_context');

  const movedToEnd = moveStackEntry(orig, 'lf_context', { toIndex: 5 });
  assert.equal(movedToEnd.entries[5].id, 'lf_context');

  const patched = updateStackEntry(orig, 'lf_pacing', { name: '篇幅调整', role: 'user', content: '新内容' });
  assert.equal(patched.entries.find((e) => e.id === 'lf_pacing').name, '篇幅调整');
  assert.equal(patched.entries.find((e) => e.id === 'lf_pacing').role, 'user');

  const added = addCustomStackEntry(orig, { name: '补充细节规则', content: '注意饮食作息细节。', insertIndex: 2 });
  assert.equal(added.entries.length, orig.entries.length + 1);
  assert.equal(added.entries[2].slotType, 'custom');
  assert.equal(added.entries[2].name, '补充细节规则');

  // Locked entry cannot be removed; custom entry can be removed
  const afterLockedRemove = removeStackEntry(added, 'lf_role');
  assert.equal(afterLockedRemove.entries.length, added.entries.length);

  const customId = added.entries[2].id;
  const afterCustomRemove = removeStackEntry(afterLockedRemove, customId);
  assert.equal(afterCustomRemove.entries.length, orig.entries.length);
});

test('Group 2.3: Scheme CRUD, resetBuiltinScheme, isBuiltinSchemeModified & toggleFavoriteScheme enforce invariants', () => {
  const s0 = createDefaultSettings();
  assert.throws(() => saveSchemeAs(s0, 'longform_coact', '   '), /方案名称不能为空/);
  assert.throws(() => saveSchemeAs(s0, 'longform_coact', '适合抢话党'), /方案名称已存在/);

  const s1 = saveSchemeAs(s0, 'longform_coact', '适合抢话党', { autoSuffix: true });
  assert.equal(s1.schemes.length, 4);
  const customScheme = s1.schemes[3];
  assert.equal(customScheme.name, '适合抢话党 (2)');
  assert.equal(customScheme.builtin, false);
  assert.equal(s1.activeSchemeId, customScheme.id);

  const s2 = renameScheme(s1, customScheme.id, '个人古风慢节奏');
  assert.equal(s2.schemes.find((s) => s.id === customScheme.id).name, '个人古风慢节奏');

  // Cannot delete any of the 3 built-in schemes (including persona_refactor)
  for (const builtinId of ['longform_coact', 'player_controlled', 'persona_refactor']) {
    const afterBuiltinDel = deleteScheme(s2, builtinId);
    assert.equal(afterBuiltinDel.schemes.length, 4);
    const afterArrDel = deleteScheme(s2.schemes, builtinId);
    assert.equal(afterArrDel.length, 4);
  }

  // Favorite pinning & sorting to top + preserving favorite across resetBuiltinScheme
  const favUpdated = toggleFavoriteScheme(s2, 'persona_refactor');
  assert.equal(favUpdated.schemes[0].id, 'persona_refactor');
  assert.equal(favUpdated.schemes[0].favorite, true);
  assert.equal(isBuiltinSchemeModified(favUpdated.schemes[0]), false, 'Favorite toggle alone must not count as modified');

  // Modify built-in scheme entry -> isBuiltinSchemeModified === true -> resetBuiltinScheme restores factory & keeps favorite
  favUpdated.schemes[0] = updateStackEntry(favUpdated.schemes[0], 'pr_craft', { content: '用户临时改写规则' });
  favUpdated.schemes[0].favorite = true;
  assert.equal(isBuiltinSchemeModified(favUpdated.schemes[0]), true);

  const afterReset = resetBuiltinScheme(favUpdated, 'persona_refactor');
  const restoredRefactor = afterReset.schemes.find((s) => s.id === 'persona_refactor');
  assert.equal(isBuiltinSchemeModified(restoredRefactor), false);
  assert.equal(restoredRefactor.favorite, true);
  assert.equal(afterReset.schemes[0].id, 'persona_refactor');

  const unfavored = toggleFavoriteScheme(afterReset, 'persona_refactor');
  assert.equal(unfavored.schemes.find((s) => s.id === 'persona_refactor').favorite, false);

  // Deleting active custom scheme resets activeSchemeId safely
  const afterCustomDel = deleteScheme(s2, customScheme.id);
  assert.equal(afterCustomDel.schemes.length, 3);
  assert.equal(afterCustomDel.activeSchemeId, 'longform_coact');

  // Duplicate custom IDs leaving zero schemes must not throw TypeError and preserves schemes
  const dupScheme = cloneScheme(BUILTIN_PRESET_SCHEMES.longform_coact, { id: 'dup_id', name: '重复方案' });
  const dupSettings = { activeSchemeId: 'dup_id', schemes: [dupScheme, cloneScheme(dupScheme, { id: 'dup_id' })] };
  const afterDupSettingsDel = deleteScheme(dupSettings, 'dup_id');
  assert.equal(afterDupSettingsDel.schemes.length, 2);
  assert.equal(afterDupSettingsDel.activeSchemeId, 'dup_id');

  const afterDupArrayDel = deleteScheme([dupScheme, cloneScheme(dupScheme, { id: 'dup_id' })], 'dup_id');
  assert.equal(afterDupArrayDel.length, 2);

  // Duplicate custom IDs with another remaining scheme removes duplicates and updates activeSchemeId
  const otherScheme = cloneScheme(BUILTIN_PRESET_SCHEMES.player_controlled, { id: 'other_id', name: '保留方案' });
  const afterMixedDel = deleteScheme(
    { activeSchemeId: 'dup_id', schemes: [dupScheme, cloneScheme(dupScheme, { id: 'dup_id' }), otherScheme] },
    'dup_id'
  );
  assert.equal(afterMixedDel.schemes.length, 1);
  assert.equal(afterMixedDel.activeSchemeId, 'other_id');
});

// ============================================================================
// Group 3: Mode A / Mode B Assembly, Draft Audit, Visibility Opt-in & Tail Role
// ============================================================================

test('Group 3.1: buildGenerationMessages honors bannedSendMode, backstoryMode, spotlightMode, antiParrot & opt-in flags', () => {
  const scheme = toggleStackEntry(BUILTIN_PRESET_SCHEMES.longform_coact, 'lf_taste', false);
  const res = buildGenerationMessages({
    mode: 'new',
    scheme,
    inspiration: '恋爱日常，孤儿出身但其实是豪门抱错的女儿；例如看书不到十分钟就会走神',
    userMustHaves: '清冷感，私下是个拍照博主',
    charContext: {
      name: '顾行舟',
      scenario: '社团活动室午后',
    },
    tasteProfile: {
      anchors: ['偏爱节制留白的日常互动'],
      banned: [{ text: '强行制造狗血误会', note: '偏爱日常甜文不虐' }],
      useBuiltinBanned: true,
      bannedSendMode: 'smart_compact',
      disabledCategories: ['persona_tic_lock'],
    },
    spotlightMode: 'balanced',
    backstoryMode: 'blank_self',
    antiParrot: true,
    dualLayer: true,
  });

  assert.ok(res.messages.length >= 6);
  assert.ok(res.estimatedTokens > 100);
  // Disabled taste slot is excluded
  assert.equal(res.assembledPromptText.includes('偏爱节制留白的日常互动'), false);
  // smart_compact sends rules + first 3 representative phrases, saves tokens on tail phrases, and omits disabled persona_tic_lock
  assert.ok(res.assembledPromptText.includes(DEFAULT_BANNED_PHRASES[0]));
  assert.equal(res.assembledPromptText.includes(BUILTIN_BANNED_CATEGORIES[0].phrases.at(-1)), false);
  assert.equal(res.assembledPromptText.includes('嘴角勾起一抹意味深长的弧度'), false);
  assert.ok(res.assembledPromptText.includes('并非…而是…'));
  assert.ok(res.assembledPromptText.includes('强行制造狗血误会'));
  assert.ok(res.assembledPromptText.includes('偏爱日常甜文不虐'));
  // Backstory blank_self + balanced spotlight (no duplicate block needed) + Anti-parrot example reminder
  assert.ok(res.assembledPromptText.includes('纯留白零编造'));
  assert.ok(res.assembledPromptText.includes('示例防照抄提醒'));
  assert.equal(res.assembledPromptText.includes('无从知晓'), false, 'Must not force extreme cluelessness template');
  assert.equal(res.assembledPromptText.includes('——'), false, 'Assembled prompt must contain zero —— em-dashes');
  // Default visibilityTags is false -> no forced [外表可见] directive
  assert.equal(res.assembledPromptText.includes('[外表可见]'), false);
  // Default draftAudit is false when omitted
  assert.equal(res.assembledPromptText.includes(DRAFT_START_MARKER), false);
  // Dual layer delimiter instructed
  assert.ok(res.assembledPromptText.includes(WORLDBOOK_DIVIDER));
  assert.ok(res.assembledPromptText.includes('顾行舟'));
  assert.equal(res.messages[res.messages.length - 1].role, 'user');

  // personal_only sends 0 built-in phrases while preserving user's personal banned list; full sends tail phrases too
  const personalOnlyRes = buildGenerationMessages({
    mode: 'create',
    scheme: BUILTIN_PRESET_SCHEMES.longform_coact,
    inspiration: '日常故事',
    tasteProfile: {
      anchors: ['偏爱温和烟火气'],
      banned: ['自定义讨厌词'],
      useBuiltinBanned: true,
      bannedSendMode: 'personal_only',
    },
  });
  assert.equal(personalOnlyRes.assembledPromptText.includes(DEFAULT_BANNED_PHRASES[0]), false);
  assert.ok(personalOnlyRes.assembledPromptText.includes('自定义讨厌词'));
  assert.ok(personalOnlyRes.assembledPromptText.includes('按人物性格自然体现外显度'));

  const fullSendRes = buildGenerationMessages({
    mode: 'create',
    scheme: BUILTIN_PRESET_SCHEMES.longform_coact,
    inspiration: '日常故事',
    tasteProfile: { useBuiltinBanned: true, bannedSendMode: 'full' },
  });
  assert.ok(fullSendRes.assembledPromptText.includes(BUILTIN_BANNED_CATEGORIES[0].phrases.at(-1)));

  // Opt-in visibilityTags: true + draftAudit: true (both user tail and Claude assistant_prefill tail)
  const withAuditAndTags = buildGenerationMessages({
    mode: 'create',
    scheme: BUILTIN_PRESET_SCHEMES.longform_coact,
    inspiration: '阵营悬疑故事里的潜伏联络员',
    visibilityTags: true,
    draftAudit: true,
    backstoryMode: 'rich_arc',
    spotlightMode: 'featured',
    modelHint: { model: 'claude-3-7-sonnet-20250219', source: 'claude' },
  });
  assert.ok(withAuditAndTags.assembledPromptText.includes(VISIBILITY_MARKERS[0]));
  assert.ok(withAuditAndTags.assembledPromptText.includes('补全成长经历'));
  assert.ok(withAuditAndTags.assembledPromptText.includes('围绕设定展开'));
  assert.ok(withAuditAndTags.assembledPromptText.includes(DRAFT_START_MARKER));
  assert.ok(withAuditAndTags.assembledPromptText.includes(DRAFT_END_MARKER));
  assert.equal(withAuditAndTags.messages.at(-1).role, 'assistant');
  assert.equal(withAuditAndTags.messages.at(-1).content, DRAFT_START_MARKER);
});

test('Group 3.2: buildGenerationMessages supports Mode B aliases, persona_refactor, useBuiltinBanned:false & targetSection', () => {
  assert.throws(
    () => buildGenerationMessages({ mode: 'optimize', subMode: 'de_label_reformat', existingDraft: '   ' }),
    /原有人设文本/
  );

  const draft = `${CORE_SECTION_HEADER}\n## 饮食与作息\n爱喝温白水。\n\n${SHELL_SECTION_HEADER}\n## 当前身份\n书局校对。`;

  const r1 = buildGenerationMessages({
    mode: 'refactor',
    subMode: 'refactor_lossless',
    scheme: BUILTIN_PRESET_SCHEMES.persona_refactor,
    existingDraft: draft,
    tasteProfile: { anchors: ['讲究分寸感'], banned: [], useBuiltinBanned: false },
  });
  assert.ok(r1.assembledPromptText.includes('无损去标签'));
  assert.ok(r1.assembledPromptText.includes('讲究分寸感'));
  assert.equal(r1.assembledPromptText.includes(DEFAULT_BANNED_PHRASES[0]), false);

  // targetSection suppresses full-document draftAudit block
  const r2 = buildGenerationMessages({
    mode: 'optimize',
    subMode: 'crosscard_adapt',
    scheme: BUILTIN_PRESET_SCHEMES.longform_coact,
    existingDraft: draft,
    targetSection: '当前身份',
    draftAudit: true,
    charContext: { name: '林栖', scenario: '冬夜山间气象站' },
  });
  assert.ok(r2.assembledPromptText.includes('严格保留'));
  assert.ok(r2.assembledPromptText.includes('局部重生成目标小节'));
  assert.ok(r2.assembledPromptText.includes('当前身份'));
  assert.equal(r2.assembledPromptText.includes(DRAFT_START_MARKER), false);
});

test('Group 3.3: applyTailRoleStrategy handles all 3 modes cleanly without mutating inputs', () => {
  const base = [
    { role: 'system', content: '系统设定' },
    { role: 'user', content: '玩家灵感' },
  ];

  // Mode 1: user
  const u1 = applyTailRoleStrategy(base, { tailMode: 'user', triggerText: '开始生成' });
  assert.equal(u1[u1.length - 1].role, 'user');
  const u2 = applyTailRoleStrategy(
    [{ role: 'system', content: '规则' }, { role: 'assistant', content: '旧预填充' }],
    { tailMode: 'user', triggerText: '自定义触发' }
  );
  assert.deepEqual(u2, [
    { role: 'system', content: '规则' },
    { role: 'user', content: '自定义触发' },
  ]);

  // Mode 2: assistant_prefill with .trimEnd()
  const p1 = applyTailRoleStrategy(base, {
    tailMode: 'assistant_prefill',
    prefillText: '【基础人设】\n  \n',
  });
  assert.equal(p1[p1.length - 1].role, 'assistant');
  assert.equal(p1[p1.length - 1].content, '【基础人设】');

  // Mode 3: prefill_plus_user
  const pu = applyTailRoleStrategy(base, {
    tailMode: 'prefill_plus_user',
    prefillText: '开头如下：\n  ',
    triggerText: '请继续补全',
  });
  assert.equal(pu.length, 4);
  assert.deepEqual(pu[2], { role: 'assistant', content: '开头如下：' });
  assert.deepEqual(pu[3], { role: 'user', content: '请继续补全' });

  // Fallbacks when empty
  const emptyFb = applyTailRoleStrategy([], { tailMode: 'prefill_plus_user', prefillText: '', triggerText: '' });
  assert.equal(emptyFb[0].content, DEFAULT_PREFILL.trimEnd());
  assert.equal(emptyFb[1].content, DEFAULT_TRIGGER);
  assert.equal(base.length, 2);
});

// ============================================================================
// Group 4: SillyTavern Native Preset JSON Export & Draft Regex Exporter
// ============================================================================

test('Group 4.1: exportSillyTavernPreset emits all 12 built-ins, categorized banned lexicon, optional ups_draft_audit & zero sensitive keys', () => {
  const mandatory12 = [
    'main',
    'nsfw',
    'dialogueExamples',
    'jailbreak',
    'chatHistory',
    'worldInfoAfter',
    'worldInfoBefore',
    'enhanceDefinitions',
    'charDescription',
    'charPersonality',
    'scenario',
    'personaDescription',
  ];

  const scheme = cloneScheme(BUILTIN_PRESET_SCHEMES.longform_coact, {
    name: '导出测试方案',
    tailMode: 'prefill_plus_user',
    prefillText: `${CORE_SECTION_HEADER}\n  `,
    triggerText: '请按上述结构继续写完。',
  });

  const exported = exportSillyTavernPreset({
    scheme,
    tasteProfile: {
      anchors: ['偏好写实生活细节'],
      banned: ['不要过度戏剧化'],
      useBuiltinBanned: true,
    },
    includeTaste: true,
    includeDraftAudit: true,
  });

  const promptIds = exported.prompts.map((p) => p.identifier);
  assert.equal(new Set(promptIds).size, promptIds.length, 'No duplicate identifiers allowed');
  for (const id of mandatory12) {
    assert.ok(promptIds.includes(id), `Missing ST built-in identifier: ${id}`);
  }
  assert.ok(promptIds.includes('ups_draft_audit'));

  // All custom entries must have system_prompt: false and standard ST injection properties
  const customEntries = exported.prompts.filter((p) => !mandatory12.includes(p.identifier));
  assert.ok(customEntries.length >= 10);
  for (const entry of customEntries) {
    assert.equal(entry.system_prompt, false);
    assert.equal(entry.marker, false);
    assert.equal(entry.injection_position, 0);
    assert.equal(entry.injection_depth, 4);
    assert.equal(entry.injection_order, 100);
    assert.deepEqual(entry.injection_trigger, []);
    assert.equal(entry.forbid_overrides, false);
  }

  // prompt_order for 100000 and 100001
  assert.equal(exported.prompt_order.length, 2);
  assert.equal(exported.prompt_order[0].character_id, 100000);
  assert.equal(exported.prompt_order[1].character_id, 100001);

  const orderList = exported.prompt_order[0].order;
  for (const item of orderList) {
    assert.ok(promptIds.includes(item.identifier), `Order references missing identifier ${item.identifier}`);
  }

  // Usage guide exists & disabled by default; draft audit enabled before chatHistory
  const guideOrder = orderList.find((o) => o.identifier === 'ups_usage_guide');
  assert.ok(guideOrder && guideOrder.enabled === false);
  const auditIdx = orderList.findIndex((o) => o.identifier === 'ups_draft_audit');
  const chatIdx = orderList.findIndex((o) => o.identifier === 'chatHistory');
  const prefillIdx = orderList.findIndex((o) => o.identifier === 'ups_tail_prefill');
  const triggerIdx = orderList.findIndex((o) => o.identifier === 'ups_tail_trigger');
  assert.ok(auditIdx !== -1 && auditIdx < chatIdx);
  assert.equal(orderList[auditIdx].enabled, true);
  assert.ok(chatIdx !== -1 && prefillIdx === chatIdx + 1 && triggerIdx === chatIdx + 2);
  assert.equal(exported.prompts.find((p) => p.identifier === 'ups_tail_prefill').content, CORE_SECTION_HEADER);

  // Taste & categorized banned lexicon included
  const jsonStr = JSON.stringify(exported);
  assert.ok(jsonStr.includes('偏好写实生活细节'));
  assert.ok(jsonStr.includes('不要过度戏剧化'));
  assert.ok(jsonStr.includes(DEFAULT_BANNED_PHRASES[0]));

  // Zero ST sensitiveFields & zero API/connection keys
  for (const field of ST_SENSITIVE_FIELDS) {
    assert.equal(Object.hasOwn(exported, field), false, `Must omit sensitiveField ${field}`);
    assert.equal(jsonStr.includes(`"${field}"`), false, `Serialized JSON must not contain ${field}`);
  }
  for (const forbidden of ['apiKey', 'api_key', 'sk-mock-secret', 'chat_completion_source', 'openai_model']) {
    assert.equal(jsonStr.includes(forbidden), false);
  }
});

test('Group 4.2: exportSillyTavernPreset handles user / assistant_prefill tail modes, includeTaste:false & exportDraftStripRegexScript', () => {
  const schemeUser = cloneScheme(BUILTIN_PRESET_SCHEMES.player_controlled, { tailMode: 'user' });
  const expUser = exportSillyTavernPreset({
    scheme: schemeUser,
    tasteProfile: { anchors: ['私密偏爱条目'], banned: ['私密拉黑条目'], useBuiltinBanned: true },
    includeTaste: false,
  });
  const expUserJson = JSON.stringify(expUser);
  assert.equal(expUserJson.includes('私密偏爱条目'), false);
  assert.equal(expUserJson.includes('私密拉黑条目'), false);
  assert.equal(expUser.prompts.some((p) => p.identifier === 'ups_draft_audit'), false);
  assert.equal(expUser.temperature, 0.55);
  assert.equal(expUser.openai_max_tokens, 2800);
  const orderUser = expUser.prompt_order[0].order;
  const chatIdx = orderUser.findIndex((o) => o.identifier === 'chatHistory');
  assert.equal(orderUser[chatIdx + 1].identifier, 'ups_tail_trigger');

  const schemePrefill = cloneScheme(BUILTIN_PRESET_SCHEMES.longform_coact, {
    tailMode: 'assistant_prefill',
    prefillText: `${CORE_SECTION_HEADER}\n   `,
  });
  const expPrefill = exportSillyTavernPreset({ scheme: schemePrefill });
  assert.equal(expPrefill.assistant_prefill, '');
  const orderPrefill = expPrefill.prompt_order[0].order;
  const chatIdx2 = orderPrefill.findIndex((o) => o.identifier === 'chatHistory');
  assert.equal(orderPrefill[chatIdx2 + 1].identifier, 'ups_tail_prefill');
  assert.equal(orderPrefill[chatIdx2 + 1].enabled, true);
  assert.equal(expPrefill.prompts.find((p) => p.identifier === 'ups_tail_prefill').content, CORE_SECTION_HEADER);

  // Verify SillyTavern RegexScriptData exporter
  const regexScript = exportDraftStripRegexScript('测试工坊');
  assert.equal(regexScript.scriptName, '测试工坊 · 隐藏草稿自检块');
  assert.equal(regexScript.replaceString, '');
  assert.deepEqual(regexScript.placement, [2]);
  assert.equal(regexScript.disabled, false);
  assert.equal(regexScript.markdownOnly, true);
  assert.equal(regexScript.promptOnly, true);
  const compiled = new RegExp(
    regexScript.findRegex.slice(1, regexScript.findRegex.lastIndexOf('/')),
    regexScript.findRegex.slice(regexScript.findRegex.lastIndexOf('/') + 1)
  );
  const sampleMsg = '【草稿自检】内部排查【/草稿自检】\n\n<!-- persona_draft 备注 -->\n【基础人设】\n干净正文';
  assert.equal(sampleMsg.replace(compiled, ''), '【基础人设】\n干净正文');
});

// ============================================================================
// Group 5: Draft Block Stripping, Linter (Smart Vibe Anchors) & Splitters
// ============================================================================

test('Group 5.0: stripDraftAuditBlocks handles closed blocks, streaming unclosed blocks & HTML comment variants', () => {
  // 1. Closed 【草稿自检】...【/草稿自检】
  const closed = stripDraftAuditBlocks(
    '【草稿自检】\n1. 语域：现代校园甜宠\n2. 已替换“嘴角勾起一抹”\n【/草稿自检】\n\n【基础人设】\n## 外貌与印象\n黑发清爽。'
  );
  assert.equal(closed.hasUnclosedDraft, false);
  assert.ok(closed.draftLog.includes('现代校园甜宠'));
  assert.equal(closed.cleanText, '【基础人设】\n## 外貌与印象\n黑发清爽。');

  // 2. Streaming unclosed 【草稿自检】...
  const streaming = stripDraftAuditBlocks('【草稿自检】\n1. 正在核对禁词与冷脸萌反差细节...');
  assert.equal(streaming.hasUnclosedDraft, true);
  assert.equal(streaming.cleanText, '');
  assert.ok(streaming.draftLog.includes('正在核对禁词'));

  // 3. Closed & unclosed HTML comment <!-- persona_draft ... --> and <!-- draft ... -->
  const htmlClosed = stripDraftAuditBlocks(
    '<!-- persona_draft: 排查半文言词汇完毕 -->\n<!-- draft 第二次核对 -->\n【基础人设】\n日常自然正文。'
  );
  assert.equal(htmlClosed.hasUnclosedDraft, false);
  assert.equal(htmlClosed.cleanText, '【基础人设】\n日常自然正文。');
  assert.ok(htmlClosed.draftLog.includes('排查半文言词汇完毕'));
  assert.ok(htmlClosed.draftLog.includes('第二次核对'));

  const htmlStreaming = stripDraftAuditBlocks('<!-- persona_draft 正在生成自检草稿');
  assert.equal(htmlStreaming.hasUnclosedDraft, true);
  assert.equal(htmlStreaming.cleanText, '');
  assert.equal(htmlStreaming.draftLog, '正在生成自检草稿');

  const instr = buildDraftAuditInstruction(BUILTIN_PRESET_SCHEMES.longform_coact);
  assert.ok(instr.includes(DRAFT_START_MARKER) && instr.includes(DRAFT_END_MARKER));
});

test('Group 5.1: estimateTokens & normalizeFlatLayout behave deterministically', () => {
  assert.equal(estimateTokens(''), 0);
  assert.equal(estimateTokens('   \n\t '), 0);
  const cjk100 = '茶'.repeat(100);
  const est = estimateTokens(cjk100);
  assert.ok(est >= 120 && est <= 150);
  assert.ok(estimateTokens(`${cjk100} hello world`) > est);

  const messy = [
    '```yaml',
    '<persona>',
    '【草稿自检】先自检一遍【/草稿自检】',
    `${CORE_SECTION_HEADER}`,
    '  - 习惯: 早上喝热姜茶',
    '    作息: 晚上十一点睡',
    '',
    '',
    '',
    `${SHELL_SECTION_HEADER}`,
    '## 开场处境',
    '在码头货栈核对账目。',
    '</persona>',
    '```',
  ].join('\n');

  const clean = normalizeFlatLayout(messy);
  assert.equal(clean.includes('```'), false);
  assert.equal(clean.includes('<persona>'), false);
  assert.equal(clean.includes('草稿自检'), false);
  assert.ok(clean.includes('- 习惯: 早上喝热姜茶'));
  assert.ok(clean.includes('作息: 晚上十一点睡'));
  assert.equal(/\n{3,}/.test(clean), false);
});

test('Group 5.2: lintPersonaText distinguishes bare labels vs concrete vibe-anchor lines, catches clichés & passes natural everyday personas', () => {
  // Bare short label input must still emit qualitative_label (severity: 'warn')
  const bareShort = lintPersonaText('性格：傲娇，其实很娇气。');
  const bareShortLabels = bareShort.issues.filter((i) => i.type === 'qualitative_label');
  assert.equal(bareShortLabels.length, 2);
  assert.ok(bareShortLabels.every((i) => i.severity === 'warn'));
  assert.ok(bareShortLabels.some((i) => i.label === '傲娇'));
  assert.ok(bareShortLabels.some((i) => i.label === '娇气'));

  // Stacked 3+ labels on one long line must still be flagged
  const stackedLong = lintPersonaText('性格特征：温柔、高冷、傲娇，平时在学校里总是独来独往让人觉得十分神秘。');
  assert.ok(stackedLong.issues.filter((i) => i.type === 'qualitative_label').length >= 3);

  // Expanded vibe/gap anchor (> 26 readable chars + < 3 labels + concrete daily behavior) is NOT flagged!
  const expandedVibe = lintPersonaText(
    '身边熟人常笑称她有点反差萌：在自习室核对资料时总是神情认真一板一眼，下课买到刚出炉的烤红薯却会捧在手心弯起眼睛小口吹气。'
  );
  assert.equal(
    expandedVibe.issues.some((i) => i.type === 'qualitative_label'),
    false,
    'Vibe anchor followed by concrete daily gap behavior must not be flagged'
  );

  const badText = [
    '【基础人设】',
    '性格有些娇气又有点傲娇，嘴角勾起一抹意味深长的弧度。',
    '严禁NPC读心和全知。',
    '绝不哭泣，永远不会退让，每次都必先开口，绝对不会低头。',
    '  - 嵌套列表项',
  ].join('\n');

  const badReport = lintPersonaText(badText, {
    banned: ['嘴角勾起'],
    useBuiltinBanned: true,
  });
  assert.equal(badReport.ok, false);
  assert.ok(badReport.issues.some((i) => i.type === 'qualitative_label' && i.label === '娇气'));
  assert.ok(badReport.issues.some((i) => i.type === 'qualitative_label' && i.label === '傲娇'));
  assert.ok(badReport.issues.some((i) => i.type === 'cliche_phrase'));
  assert.ok(badReport.issues.some((i) => i.type === 'meta_preaching'));
  assert.ok(badReport.issues.some((i) => i.type === 'rigid_prop_rule'));
  assert.ok(badReport.issues.some((i) => i.type === 'nested_indent'));

  // disabledCategories exempts specific built-in category when toggled off
  const ticText = '说话前总是先垂下眼帘，安静听完再回应。';
  assert.equal(
    lintPersonaText(ticText, { useBuiltinBanned: true, disabledCategories: ['persona_tic_lock'] }).issues.some(
      (i) => i.type === 'cliche_phrase'
    ),
    false
  );

  // Replay risk detection & 1-click anti-parrot clause guard
  const quirkyExample = '注意力容易发散，例如戴着耳机看书做笔记通常坚持不到十分钟就会走神放弃。';
  assert.equal(hasReplayRiskExamples(quirkyExample), true);
  assert.ok(lintPersonaText(quirkyExample).issues.some((i) => i.type === 'replay_risk'));
  const guardedExample = appendAntiParrotClause(quirkyExample);
  assert.equal(hasReplayRiskExamples(guardedExample), false);
  assert.equal(appendAntiParrotClause(guardedExample), guardedExample);
  assert.equal(lintPersonaText(guardedExample).issues.some((i) => i.type === 'replay_risk'), false);

  // Em-dash proliferation detection & 1-click cleanup
  const dashyText = '她平时话不多——习惯独来独往——对陌生人也保持礼貌距离。';
  assert.ok(lintPersonaText(dashyText).issues.some((i) => i.type === 'dash_overuse'));
  const cleanedDash = replaceEmDashes(dashyText);
  assert.equal(cleanedDash.includes('——'), false);
  assert.equal(lintPersonaText(cleanedDash).issues.some((i) => i.type === 'dash_overuse'), false);

  const respectingDisabledBuiltin = lintPersonaText(DEFAULT_BANNED_PHRASES[0], {
    useBuiltinBanned: false,
  });
  assert.equal(
    respectingDisabledBuiltin.issues.some((i) => i.type === 'cliche_phrase'),
    false
  );

  // Clean everyday persona WITHOUT [外表可见] brackets scores 100 with zero issues and zero nagging advisories
  const cleanEverydayFixture = [
    CORE_SECTION_HEADER,
    '## 外貌与日常印象',
    '中等身量，长年做旧书修补，指腹常有薄茧，说话语速平稳，习惯穿袖口利落的棉麻衬衫。',
    '## 性格习惯与相处分寸',
    '从小跟着祖父在库房整理纸张长大，对潮湿和尖锐噪音比较敏感；室内保持干燥安静时能连续伏案三小时，一旦环境嘈杂就会先收手退到走廊透气。（左手腕内侧有一道早年裁纸留下的浅痕，平时戴表遮住，未向外人提起。）',
    '',
    SHELL_SECTION_HEADER,
    '## 当前身份与开场关系',
    '受聘于城南图书馆古籍室做季度外包修复，与馆内负责人早已签妥三个月工期。',
  ].join('\n');

  const cleanReport = lintPersonaText(cleanEverydayFixture);
  assert.equal(cleanReport.ok, true);
  assert.equal(cleanReport.stats.hasCoreShell, true);
  assert.equal(cleanReport.stats.hasVisibilityMarkers, false);
  assert.equal(cleanReport.advisories.length, 0);
  assert.equal(cleanReport.score, 100);
});

test('Group 5.3: splitCoreAndShell & splitDualLayerOutput parse all supported delimiters & entry formats', () => {
  const twoTier = `${CORE_SECTION_HEADER}\n核内正文\n\n${SHELL_SECTION_HEADER}\n壳内正文`;
  const split = splitCoreAndShell(twoTier);
  assert.ok(split.core.includes('核内正文'));
  assert.ok(split.shell.includes('壳内正文'));
  assert.equal(split.other, '');

  const singleLayer = splitDualLayerOutput('只有主档案内容');
  assert.equal(singleLayer.coreDescription, '只有主档案内容');
  assert.deepEqual(singleLayer.worldbookEntries, []);

  for (const divider of [WORLDBOOK_DIVIDER, '【延展背景世界书】', '===WORLDBOOK===', '### 补充世界书条目']) {
    const dual = [
      `${CORE_SECTION_HEADER}\n主档案摘要`,
      '',
      divider,
      '[条目：祖传修书工坊]',
      '关键词：修书工坊，老街铺面, 浆糊配方',
      '内容：位于老街尽头的二层木屋，一楼堆放旧纸料。',
      '二楼只留作晾晒书页之用。',
      '',
      '### 早期学徒旧债',
      '关键词：旧债/同门',
      '内容：三年前替同门垫付过一笔修缮款，至今未收回。',
      '',
      '[条目：空条目将被忽略]',
      '关键词：空',
      '内容：   ',
    ].join('\n');

    const parsed = splitDualLayerOutput(dual);
    assert.ok(parsed.coreDescription.includes('主档案摘要'));
    assert.equal(parsed.worldbookEntries.length, 2);
    assert.equal(parsed.worldbookEntries[0].comment, '祖传修书工坊');
    assert.deepEqual(parsed.worldbookEntries[0].key, ['修书工坊', '老街铺面', '浆糊配方']);
    assert.ok(parsed.worldbookEntries[0].content.includes('二楼只留作晾晒书页之用'));
    assert.deepEqual(parsed.worldbookEntries[1].key, ['旧债', '同门']);
  }
});

// ============================================================================
// Group 6: Section Parsing, Diff, Partial Regen & Taste Profile Growth
// ============================================================================

test('Group 6.1: parsePersonaSections, mergeSectionUpdate & computeLineDiff', () => {
  const doc = [
    CORE_SECTION_HEADER,
    '## 外貌特征',
    '短发，常穿深灰风衣。',
    '## 饮食习惯',
    '不吃生冷海鲜。',
    '',
    SHELL_SECTION_HEADER,
    '## 当前身份',
    '夜班调度员。',
  ].join('\n');

  const secs = parsePersonaSections(doc);
  assert.equal(secs.length, 5);
  assert.equal(secs[1].title, '外貌特征');

  const updated = mergeSectionUpdate(doc, '饮食习惯', '## 饮食习惯\n偏好热汤面与清茶，忌辛辣。');
  assert.ok(updated.includes('偏好热汤面与清茶，忌辛辣。'));
  assert.ok(updated.includes('短发，常穿深灰风衣。'));
  assert.ok(updated.includes('夜班调度员。'));
  assert.equal(updated.includes('不吃生冷海鲜'), false);

  const appended = mergeSectionUpdate(doc, '额外备忘', '习惯随身带一支黑笔。');
  assert.ok(appended.includes('### 额外备忘\n习惯随身带一支黑笔。'));

  const diffSame = computeLineDiff('a\nb', 'a\nb');
  assert.deepEqual(diffSame.summary, { addedCount: 0, removedCount: 0, unchangedCount: 2 });

  const diffMixed = computeLineDiff('第一行\n删掉的句子\n第三行', '第一行\n新增的细节\n第三行');
  assert.equal(diffMixed.summary.addedCount, 1);
  assert.equal(diffMixed.summary.removedCount, 1);
  assert.equal(diffMixed.summary.unchangedCount, 2);
});

test('Group 6.2: extractTasteCandidates & mergeTasteEntries deduplicate cleanly', () => {
  const draft = [
    CORE_SECTION_HEADER,
    '- 习惯低头摆弄袖口，讲话总是慢半拍。',
    `- ${DEFAULT_BANNED_PHRASES[0]}`,
    '- 常年喝温热的乌龙茶。',
  ].join('\n');

  const finalText = [
    CORE_SECTION_HEADER,
    '- 习惯提前十分钟到场并备好纸质笔记。',
    '- 常年喝温热的乌龙茶。',
  ].join('\n');

  const candidates = extractTasteCandidates(draft, finalText, {
    banned: ['讲话总是慢半拍'],
    anchors: [],
  });

  // DEFAULT_BANNED_PHRASES[0] and already-banned '讲话总是慢半拍' should be skipped
  assert.ok(candidates.bannedCandidates.some((c) => c.text === '习惯低头摆弄袖口'));
  assert.equal(
    candidates.bannedCandidates.some((c) => c.text === DEFAULT_BANNED_PHRASES[0]),
    false
  );
  assert.equal(
    candidates.bannedCandidates.some((c) => c.text === '讲话总是慢半拍'),
    false
  );

  assert.ok(candidates.anchorCandidates.some((c) => c.text.includes('习惯提前十分钟到场')));

  const existing = [{ id: 't1', text: '喜欢安静书房', note: '', createdAt: 100 }];
  const merged = mergeTasteEntries(existing, [
    '  喜欢安静书房。 ',
    { text: '喜欢安静书房', note: '长期保留' },
    '不喝加糖饮料',
    '   ',
  ]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].note, '长期保留');
  assert.equal(merged[1].text, '不喝加糖饮料');
  assert.equal(existing[0].note, '');
});

// ============================================================================
// Group 7: Custom API Helpers & Settings Sanitization
// ============================================================================

test('Group 7.1: normalizeBaseUrl & maskApiKey validate & protect credentials', () => {
  assert.equal(normalizeBaseUrl('https://api.example.com/v1/chat/completions/'), 'https://api.example.com/v1');
  assert.equal(normalizeBaseUrl('http://127.0.0.1:8080/v1/models'), 'http://127.0.0.1:8080/v1');
  assert.equal(normalizeBaseUrl('https://api.example.com/v1/responses'), '');
  assert.equal(normalizeBaseUrl('ftp://example.com/v1'), '');
  assert.equal(normalizeBaseUrl('javascript:alert(1)'), '');
  assert.equal(normalizeBaseUrl('https://user:pass@example.com/v1'), '');
  assert.equal(normalizeBaseUrl('https://example.com/v1?key=123'), '');
  assert.equal(normalizeBaseUrl('https://example.com/v1#frag'), '');

  assert.equal(maskApiKey(''), '');
  assert.equal(maskApiKey('abcd'), '••••');
  assert.equal(maskApiKey('123456'), '••••56');
  assert.equal(maskApiKey('sk-mock-1234567890abcd'), 'sk-m••••abcd');
});

test('Group 7.2: createApiProfile, buildCustomChatPayload & sanitizeSettingsForExport', () => {
  assert.throws(() => createApiProfile({ baseUrl: 'javascript:bad' }), /基础地址格式无效/);
  assert.throws(() => createApiProfile({ apiKey: 'line1\nline2' }), /换行符/);

  const p1 = createApiProfile({
    name: '自建中转',
    baseUrl: 'https://relay.example.com/v1/',
    apiKey: 'sk-mock-secret-9999',
    model: 'model-a',
    temperature: 0,
    topP: 0,
    maxTokens: 2048,
    stream: true,
  });
  assert.equal(p1.temperature, 0);
  assert.equal(p1.topP, 0);

  const proxyPayload = buildCustomChatPayload(p1, [{ role: 'user', content: 'hi' }], { stream: true });
  assert.equal(proxyPayload.chat_completion_source, 'custom');
  assert.equal(proxyPayload.custom_url, 'https://relay.example.com/v1');
  const includeBody = JSON.parse(proxyPayload.custom_include_body);
  assert.equal(includeBody.temperature, 0);
  assert.equal(includeBody.top_p, 0);
  assert.equal(includeBody.max_tokens, 2048);

  const directPayload = buildCustomChatPayload(p1, [{ role: 'user', content: 'hi' }], {
    target: 'openai_direct',
    stream: false,
  });
  assert.equal(directPayload.url, 'https://relay.example.com/v1/chat/completions');
  assert.equal(directPayload.body.stream, false);
  assert.equal(Object.hasOwn(directPayload.body, 'apiKey'), false);

  const settings = createDefaultSettings({
    api: { provider: 'custom', activeProfileId: p1.id, profiles: [p1] },
  });
  const sanitized = sanitizeSettingsForExport(settings);
  assert.equal(sanitized.api.profiles[0].apiKey, undefined);
  assert.equal(JSON.stringify(sanitized).includes('sk-mock-secret-9999'), false);
  assert.equal(settings.api.profiles[0].apiKey, 'sk-mock-secret-9999');
});

test('Group 7.3: parseChatCompletionChunkOrJson parses SSE, non-stream JSON, errors & malformed payloads', () => {
  const sse = [
    ': keepalive',
    'data: {"choices":[{"delta":{"reasoning_content":"内部思考不可泄露","content":"第一段"}}]}',
    '',
    'data: {"choices":[{"delta":{"content":"第二段"},"finish_reason":"stop"}],"usage":{"total_tokens":42}}',
    'data: [DONE]',
  ].join('\n');
  const parsedSse = parseChatCompletionChunkOrJson(sse);
  assert.equal(parsedSse.text, '第一段第二段');
  assert.equal(parsedSse.done, true);
  assert.equal(parsedSse.error, null);
  assert.equal(parsedSse.usage.total_tokens, 42);

  const jsonOk = parseChatCompletionChunkOrJson(
    JSON.stringify({ choices: [{ message: { content: '完整响应正文' }, finish_reason: 'stop' }] })
  );
  assert.equal(jsonOk.text, '完整响应正文');
  assert.equal(jsonOk.done, true);

  const jsonErr = parseChatCompletionChunkOrJson(
    JSON.stringify({ error: { message: '额度不足' } })
  );
  assert.equal(jsonErr.error, '额度不足');
  assert.equal(jsonErr.done, true);

  const malformed = parseChatCompletionChunkOrJson('{not-valid-json');
  assert.equal(malformed.error, '响应解析失败');
  assert.equal(malformed.text, '');
});

// ============================================================================
// Group 8: Iteration 2 Regression Tests & Boundary Hardening (Findings 1-10)
// ============================================================================

test('Group 8.1: lintPersonaText displays actual label name & catches expanded meta preaching patterns', () => {
  const labelReport = lintPersonaText('性格偏娇气，平时也有点傲娇。');
  const labelIssues = labelReport.issues.filter((i) => i.type === 'qualitative_label');
  assert.equal(labelIssues.length, 2);
  assert.ok(labelIssues.some((i) => i.label === '娇气' && i.message.includes('「娇气」')));
  assert.ok(labelIssues.some((i) => i.label === '傲娇' && i.message.includes('「傲娇」')));
  for (const issue of labelIssues) {
    assert.equal(issue.message.includes('undefined'), false);
  }

  for (const phrase of [
    '禁止对 user 赋魅。',
    '禁止向 {{user}} 赋魅。',
    '禁止 NPC 全知。',
    '不得替玩家抢话。',
    '不要让AI抢话。',
  ]) {
    const r = lintPersonaText(phrase);
    assert.ok(
      r.issues.some((i) => i.type === 'meta_preaching'),
      `Expected meta_preaching issue for: ${phrase}`
    );
  }
});

test('Group 8.2: exportSillyTavernPreset trims whitespace presetName & disambiguates colliding reserved IDs', () => {
  const customScheme = cloneScheme(BUILTIN_PRESET_SCHEMES.longform_coact, {
    name: '安全导出方案',
    tailMode: 'prefill_plus_user',
    entries: [
      ...BUILTIN_PRESET_SCHEMES.longform_coact.entries,
      { id: 'tail_prefill', name: '自定义碰撞1', slotType: 'custom', role: 'system', enabled: true, content: '自定义内容1' },
      { id: 'tail_trigger', name: '自定义碰撞2', slotType: 'custom', role: 'system', enabled: true, content: '自定义内容2' },
      { id: 'usage_guide', name: '自定义碰撞3', slotType: 'custom', role: 'system', enabled: true, content: '自定义内容3' },
      { id: 'draft_audit', name: '自定义碰撞4', slotType: 'custom', role: 'system', enabled: true, content: '自定义内容4' },
    ],
  });

  const exported = exportSillyTavernPreset({
    scheme: customScheme,
    presetName: '   ',
    includeUsageGuide: true,
    includeDraftAudit: true,
  });

  const mainPrompt = exported.prompts.find((p) => p.identifier === 'main');
  assert.ok(mainPrompt.content.startsWith('【安全导出方案】'));
  assert.equal(mainPrompt.content.includes('【】'), false);
  assert.equal(exported.extensions.user_persona_studio.presetName, '安全导出方案');

  const promptIds = exported.prompts.map((p) => p.identifier);
  assert.equal(new Set(promptIds).size, promptIds.length, 'prompts[] must have unique identifiers');
  for (const orderGroup of exported.prompt_order) {
    const orderIds = orderGroup.order.map((o) => o.identifier);
    assert.equal(new Set(orderIds).size, orderIds.length, 'prompt_order[].order[] must have unique identifiers');
  }

  assert.ok(promptIds.includes('ups_tail_prefill_2'));
  assert.ok(promptIds.includes('ups_tail_trigger_2'));
  assert.ok(promptIds.includes('ups_usage_guide_2'));
  assert.ok(promptIds.includes('ups_draft_audit_2'));
  assert.equal(exported.prompts.find((p) => p.identifier === 'ups_tail_prefill').role, 'assistant');
  assert.equal(exported.prompts.find((p) => p.identifier === 'ups_tail_trigger').role, 'user');
});

test('Group 8.3: extractTasteCandidates & normalizeTasteKey handle partial edits & width/whitespace variants', () => {
  const partial = extractTasteCandidates(
    '习惯喝温水，也喜欢在雨天看书。',
    '习惯喝温水，也喜欢在晴天散步。',
    { anchors: [], banned: [] }
  );
  assert.deepEqual(
    partial.bannedCandidates.map((c) => c.text),
    ['也喜欢在雨天看书']
  );
  assert.deepEqual(
    partial.anchorCandidates.map((c) => c.text),
    ['也喜欢在晴天散步']
  );

  assert.equal(mergeTasteEntries(['不吃香菜，喝茶'], ['不吃香菜,喝茶']).length, 1);
  assert.equal(mergeTasteEntries(['偏好 ABC 风格'], ['偏好 ＡＢＣ 风格']).length, 1);
  assert.equal(mergeTasteEntries(['喜欢安静书房'], ['喜欢　安静　书房']).length, 1);
  assert.equal(mergeTasteEntries(['习惯(早起)读书'], ['习惯（早起）读书']).length, 1);
  assert.equal(mergeTasteEntries(['quiet room'], ['quiet  study']).length, 2);

  const suppressed = extractTasteCandidates(
    '- 不吃香菜，喝茶。\n- 偏好 ＡＢＣ 风格',
    '- 全新加入的细节设定',
    { banned: ['不吃香菜,喝茶', '偏好 ABC 风格'], anchors: [] }
  );
  assert.equal(suppressed.bannedCandidates.length, 0);
  assert.deepEqual(
    suppressed.anchorCandidates.map((c) => c.text),
    ['全新加入的细节设定']
  );
});

test('Group 8.4: parseChatCompletionChunkOrJson treats SSE keepalive/metadata/empty data as no-op & rejects garbage', () => {
  for (const frame of [
    ': keepalive\n\n',
    'event: ping\nid: 12\nretry: 3000\n\n',
    'data:\n\n',
    'event: message\ndata:   \n\n',
  ]) {
    assert.deepEqual(parseChatCompletionChunkOrJson(frame), {
      text: '',
      done: false,
      error: null,
      usage: null,
    });
  }

  assert.equal(parseChatCompletionChunkOrJson('data: {broken').error, '响应解析失败');
  assert.equal(parseChatCompletionChunkOrJson('502 Bad Gateway').error, '响应解析失败');
  assert.equal(parseChatCompletionChunkOrJson(': ok\ngarbage non-sse').error, '响应解析失败');
});

test('Group 8.5: buildCustomChatPayload ignores blank temp/topP, preserves 0, & overrides ST Authorization when keyless', () => {
  const blankNumericProfile = createApiProfile({
    name: '空采样参数',
    baseUrl: 'http://127.0.0.1:11434/v1',
    apiKey: '',
    model: 'local-model',
    temperature: '   ',
    topP: '',
  });
  assert.equal(blankNumericProfile.temperature, null);
  assert.equal(blankNumericProfile.topP, null);

  const proxyBlank = buildCustomChatPayload(
    { baseUrl: 'http://127.0.0.1:11434/v1', apiKey: '', model: 'local-model', temperature: '', topP: '  ' },
    [{ role: 'user', content: 'hi' }]
  );
  const proxyBody = JSON.parse(proxyBlank.custom_include_body);
  assert.equal(Object.hasOwn(proxyBody, 'temperature'), false);
  assert.equal(Object.hasOwn(proxyBody, 'top_p'), false);
  const proxyExclude = JSON.parse(proxyBlank.custom_exclude_body);
  assert.ok(proxyExclude.includes('temperature'));
  assert.ok(proxyExclude.includes('top_p'));
  assert.equal(proxyBlank.custom_include_headers, JSON.stringify({ Authorization: '' }));

  const directBlank = buildCustomChatPayload(
    { baseUrl: 'http://127.0.0.1:11434/v1', apiKey: '', model: 'local-model', temperature: '0', topP: '0' },
    [{ role: 'user', content: 'hi' }],
    { target: 'openai_direct' }
  );
  assert.equal(Object.hasOwn(directBlank.headers, 'Authorization'), false);
  assert.equal(directBlank.body.temperature, 0);
  assert.equal(directBlank.body.top_p, 0);
});

test('Group 8.6: mergeSectionUpdate, splitDualLayerOutput & splitCoreAndShell edge boundaries', () => {
  const doc = `${CORE_SECTION_HEADER}\n## 饮食\n旧内容\n## 习惯\n旧习惯`;
  const prefixMerged = mergeSectionUpdate(doc, '饮食', '## 饮食习惯\n每天喝热茶。');
  assert.ok(prefixMerged.includes('## 饮食\n## 饮食习惯\n每天喝热茶。'));

  const repeatedMerged = mergeSectionUpdate(doc, '习惯', '## 习惯\n## 习惯\n新习惯内容');
  assert.ok(repeatedMerged.includes('## 习惯\n新习惯内容'));
  assert.equal(repeatedMerged.includes('## 习惯\n## 习惯'), false);

  const altLevelMerged = mergeSectionUpdate(doc, '习惯', '### 习惯\n三级标题替换');
  assert.ok(altLevelMerged.includes('## 习惯\n三级标题替换'));
  assert.equal(altLevelMerged.includes('### 习惯'), false);

  const dualWithPseudoField = [
    `${CORE_SECTION_HEADER}\n主档案`,
    WORLDBOOK_DIVIDER,
    '[条目：旧案卷宗]',
    '关键词：密码本, 暗号',
    '内容：第一行正文',
    '关键词：正文里出现的伪字段',
  ].join('\n');
  const parsedDual = splitDualLayerOutput(dualWithPseudoField);
  assert.equal(parsedDual.worldbookEntries.length, 1);
  assert.deepEqual(parsedDual.worldbookEntries[0].key, ['密码本', '暗号']);
  assert.ok(parsedDual.worldbookEntries[0].content.includes('关键词：正文里出现的伪字段'));

  const threeTier = [
    `${CORE_SECTION_HEADER}\n核内`,
    `${SHELL_SECTION_HEADER}\n壳内`,
    `${WORLDBOOK_DIVIDER}\n世界书内容`,
  ].join('\n');
  const split = splitCoreAndShell(threeTier);
  assert.equal(split.shell, `${SHELL_SECTION_HEADER}\n壳内`);
  assert.equal(split.other, `${WORLDBOOK_DIVIDER}\n世界书内容`);
});

test('Group 8.7: sanitizeScheme & cloneScheme boundary hardening', () => {
  const settings = createDefaultSettings({
    schemes: [
      {
        id: 'inverted',
        name: '倒置预算',
        style: 'refactor',
        favorite: true,
        targetTokens: { min: 4000, max: 500 },
        entries: [{ id: 'e1', name: '规则', content: '正文' }],
      },
    ],
  });
  const inv = settings.schemes.find((s) => s.id === 'inverted');
  assert.equal(inv.style, 'refactor');
  assert.equal(inv.favorite, true);
  assert.equal(inv.targetTokens.min, 4000);
  assert.equal(inv.targetTokens.max, 4000);

  const cloned = cloneScheme(BUILTIN_PRESET_SCHEMES.longform_coact, {
    name: '   ',
    temperature: 99,
    maxTokens: 10,
    targetTokens: { min: 3000, max: 600 },
    entries: [{ id: 'custom_1', name: '覆盖条目', role: 'invalid_role', content: '新条目正文' }],
  });
  assert.equal(cloned.name, '适合抢话党 (副本)');
  assert.equal(cloned.temperature, 2);
  assert.equal(cloned.maxTokens, 256);
  assert.equal(cloned.targetTokens.min, 3000);
  assert.equal(cloned.targetTokens.max, 3000);
  assert.equal(cloned.entries.length, 1);
  assert.equal(cloned.entries[0].role, 'system');
  assert.equal(cloned.entries[0].content, '新条目正文');
});

// ============================================================================
// Group 9: Tier 5 Adversarial Regression Tests (Gaps 9 & 10)
// ============================================================================

test('Group 9.1 (Tier 5): splitDualLayerOutput parses ##/#### headings & lintPersonaText catches XML tags with attributes', () => {
  const dualH2H4 = [
    `${CORE_SECTION_HEADER}\n主档案摘要`,
    '',
    WORLDBOOK_DIVIDER,
    '## 补充条目一',
    '关键词：码头, 货栈',
    '内容：第一条世界书正文。',
    '',
    '#### 补充条目二',
    '关键词：旧账',
    '内容：第二条世界书正文。',
  ].join('\n');

  const parsed = splitDualLayerOutput(dualH2H4);
  assert.equal(parsed.worldbookEntries.length, 2);
  assert.equal(parsed.worldbookEntries[0].comment, '补充条目一');
  assert.deepEqual(parsed.worldbookEntries[0].key, ['码头', '货栈']);
  assert.equal(parsed.worldbookEntries[0].content, '第一条世界书正文。');
  assert.equal(parsed.worldbookEntries[1].comment, '补充条目二');
  assert.deepEqual(parsed.worldbookEntries[1].key, ['旧账']);
  assert.equal(parsed.worldbookEntries[1].content, '第二条世界书正文。');

  const attrXmlReport = lintPersonaText('<div class="x">hello');
  assert.ok(
    attrXmlReport.issues.some((i) => i.type === 'nested_indent' && i.match.includes('<div class="x">')),
    'lintPersonaText must catch XML tags with attributes'
  );
});

test('Group 9.2 (Tier 5): deleteScheme ignores Object.prototype keys like toString and constructor', () => {
  const singleCol = { s1: { id: 's1', name: '方案一', entries: [] } };
  const multiCol = {
    s1: { id: 's1', name: '方案一', entries: [] },
    s2: { id: 's2', name: '方案二', entries: [] },
  };
  for (const protoKey of ['toString', 'constructor', 'valueOf', 'hasOwnProperty']) {
    const resSingle = deleteScheme(singleCol, protoKey);
    assert.deepEqual(Object.keys(resSingle), ['s1']);
    const resMulti = deleteScheme(multiCol, protoKey);
    assert.deepEqual(Object.keys(resMulti), ['s1', 's2']);
  }
});

test('Group 9.3 (Tier 5 | R2): saveSchemeAs rejects Object.prototype keys in dictionary collections', () => {
  const dict = { s1: { id: 's1', name: '方案一', entries: [] } };
  for (const protoKey of ['toString', 'constructor', 'valueOf', '__proto__']) {
    assert.throws(
      () => saveSchemeAs(dict, protoKey, '新方案'),
      (err) => err.message.includes('未找到可另存的源方案')
    );
  }
});

// ============================================================================
// Group 10: Word Count Sync, Auto Model Tail Adaptation & Persona Point Extractor
// ============================================================================

test('Group 10.1: computeLengthBudget, applyTargetCharsToScheme & countReadableChars sync narrow budgets into prompts', () => {
  assert.equal(countReadableChars('  你好 世界\n123  '), 7);
  const b1000 = computeLengthBudget(1000);
  assert.equal(b1000.chars, 1000);
  assert.equal(b1000.charsMin, 880);
  assert.equal(b1000.charsMax, 1120);
  assert.ok(b1000.tokensMin >= 1150 && b1000.tokensMax <= 1550);

  const updatedScheme = applyTargetCharsToScheme(BUILTIN_PRESET_SCHEMES.longform_coact, 1000);
  assert.equal(updatedScheme.targetChars, 1000);
  assert.equal(updatedScheme.targetTokens.min, b1000.tokensMin);
  assert.equal(updatedScheme.targetTokens.max, b1000.tokensMax);

  const built = buildGenerationMessages({
    mode: 'create',
    scheme: updatedScheme,
    inspiration: '钟表铺学徒',
  });
  assert.ok(built.assembledPromptText.includes('约 1000 字'));
  assert.ok(built.assembledPromptText.includes('880～1120 汉字'));
});

test('Group 10.2: inferOptimalTailMode & applyTailRoleStrategy auto-adapt to Claude, Gemini, GPT & thinking models', () => {
  assert.equal(inferOptimalTailMode({ model: 'claude-3-7-sonnet-20250219', source: 'claude' }), 'assistant_prefill');
  assert.equal(inferOptimalTailMode({ model: 'claude-3-7-sonnet-thinking', source: 'claude' }), 'user');
  assert.equal(inferOptimalTailMode({ model: 'gemini-2.5-pro', source: 'makersuite' }), 'user');
  assert.equal(inferOptimalTailMode({ model: 'gpt-4o', source: 'openai' }), 'user');
  assert.equal(inferOptimalTailMode({ model: 'deepseek-reasoner', source: 'deepseek' }), 'user');
  assert.equal(inferOptimalTailMode({}), 'user');

  const msgs = [
    { role: 'system', content: '规则' },
    { role: 'user', content: '生成请求' },
  ];
  const autoClaude = applyTailRoleStrategy(msgs, {
    tailMode: 'auto',
    prefillText: '【基础人设】\n',
    modelHint: { model: 'claude-sonnet-4', baseUrl: 'https://api.anthropic.com/v1' },
  });
  assert.equal(autoClaude.at(-1).role, 'assistant');
  assert.equal(autoClaude.at(-1).content, '【基础人设】');

  const autoGemini = applyTailRoleStrategy(msgs, {
    tailMode: 'auto',
    prefillText: '【基础人设】\n',
    modelHint: { model: 'gemini-2.5-flash' },
  });
  assert.equal(autoGemini.at(-1).role, 'user');
});

test('Group 10.3: extractPersonaPoints extracts categorized selectable points without manual copy-paste', () => {
  const samplePersona = [
    '【基础人设】',
    '## 外貌与印象 [外表可见]',
    '- 黑发微卷，左眼下方有一颗浅褐色小痣。',
    '- 说话语速偏慢，冬天习惯戴针织手套。',
    '## 喜好与习惯',
    '偏好热茶与清淡汤面，讨厌烟味和刺耳鸣笛。',
    '',
    '【当前背景与关系】',
    '- 现居港城，担任气象台夜班记录员，与值班长共事半年。',
  ].join('\n');

  const pts = extractPersonaPoints(samplePersona);
  assert.equal(pts.length, 4);
  assert.equal(pts[0].category, '外貌与印象');
  assert.equal(pts[0].keepByDefault, true);
  assert.equal(pts[0].text.includes('[外表可见]'), false);
  assert.equal(pts[2].category, '习惯与喜好');
  assert.equal(pts[2].keepByDefault, true);
  assert.equal(pts[3].category, '当前身份与关系');
  assert.equal(pts[3].keepByDefault, false);
});

test('Group 11.1 (R3): extractPersonaPoints parses structured/YAML personas cleanly without misclassifying basic info as personality', () => {
  const ningYumianYaml = [
    '姓名: "宁雨眠"',
    '别名:',
    '  - "Undine"  # English name',
    '  - "眠眠" #家人、熟人、{{char}}一般称呼',
    '  - "小棉花"  # 幼时乳名，因为小时候特别爱抓着棉花玩',
    '  - "心与共栖"  # 网络博主id',
    '',
    '基本身份:',
    '  年龄: "19岁"',
    '  性别: "女"',
    '  生日："7月16日"',
    '  职业或身份: "重点大学在读本科生、生活与穿搭博主、宁家养女"',
    '  居住地: "和{{char}}一起住"',
    '',
    '外貌与体型: |',
    '  幼态鹅蛋脸，睫毛浓密，浅杏眼眸清澈明亮，肤色白润。',
    '  身材纤细偏娇小，常穿柔和针织衫。',
    '',
    '性格与行为逻辑: |',
    '  在外人面前温和有礼，日常相处时会把脆弱藏在微笑后面。',
    '',
    '成长经历: |',
    '  十岁那年被宁家收养，自小学会察言观色。',
    '',
    '生活习惯: |',
    '  偏爱热牛奶和软糯甜点，睡前习惯听白噪音。',
  ].join('\n');

  const pts = extractPersonaPoints(ningYumianYaml, 36);
  // Zero dangling empty header points like "别名:" or "基本身份:" or "外貌与体型: |"
  assert.equal(pts.some((p) => /^(?:别名|基本身份|外貌与体型|性格与行为逻辑|成长经历|生活习惯)[:：]?$/.test(p.text.trim())), false);

  const namePt = pts.find((p) => p.text.includes('宁雨眠'));
  assert.ok(namePt);
  assert.equal(namePt.category, '基础信息');
  assert.equal(namePt.keepByDefault, true);

  const aliasPts = pts.filter((p) => p.text.startsWith('别名：'));
  assert.ok(aliasPts.length >= 1);
  for (const ap of aliasPts) {
    assert.equal(ap.category, '基础信息');
    assert.equal(ap.keepByDefault, true);
  }
  assert.ok(aliasPts.some((p) => p.fullText.includes('眠眠（家人、熟人、{{char}}一般称呼）')));

  const identityAgePt = pts.find((p) => p.text.includes('19岁') && p.text.includes('7月16日'));
  assert.ok(identityAgePt);
  assert.equal(identityAgePt.category, '基础信息');

  const occPt = pts.find((p) => p.text.includes('职业或身份'));
  assert.ok(occPt);
  assert.equal(occPt.category, '当前身份与关系');
  assert.equal(occPt.keepByDefault, false);

  const resPt = pts.find((p) => p.text.includes('和{{char}}一起住'));
  assert.ok(resPt);
  assert.equal(resPt.category, '当前身份与关系');
  assert.equal(resPt.keepByDefault, false);

  const appPt = pts.find((p) => p.text.includes('幼态鹅蛋脸'));
  assert.ok(appPt);
  assert.equal(appPt.category, '外貌与印象');

  const persPt = pts.find((p) => p.text.includes('日常相处时会把脆弱藏在微笑后面'));
  assert.ok(persPt);
  assert.equal(persPt.category, '性格与底色');

  const bgPt = pts.find((p) => p.text.includes('被宁家收养'));
  assert.ok(bgPt);
  assert.equal(bgPt.category, '经历与技能');

  const habitPt = pts.find((p) => p.text.includes('热牛奶'));
  assert.ok(habitPt);
  assert.equal(habitPt.category, '习惯与喜好');
});

test('Group 11.2 (R3): extractPersonaPoints handles XML wrappers, nested YAML trees, Markdown nested bullets, and continuation lines', () => {
  const mixedPersona = [
    '<USER人设>',
    '```yaml',
    '外貌:',
    '  面容:',
    '    类型: "浓颜系"',
    '    特点: "左眼下有一颗淡痣"',
    '```',
    '## 基本信息',
    '- 姓名：程以窈',
    '- 昵称或别称：',
    '  - 窈窈：家人称呼',
    '  - 小程：同事简称',
    '- 住址：',
    '  - 上海：静安公寓',
    '别人对他的称呼: 楚霁寒/小师叔',
    '楚小子/小寒',
    '【目前处境】',
    '- 刚接手城南旧书铺。',
    '</USER人设>',
  ].join('\n');

  const pts = extractPersonaPoints(mixedPersona, 36);
  const facePt = pts.find((p) => p.text.includes('浓颜系'));
  assert.ok(facePt);
  assert.equal(facePt.category, '外貌与印象');

  const namePt = pts.find((p) => p.text.includes('程以窈'));
  assert.ok(namePt);
  assert.equal(namePt.category, '基础信息');

  const nickPt = pts.find((p) => p.text.includes('窈窈') && p.text.includes('小程'));
  assert.ok(nickPt);
  assert.equal(nickPt.category, '基础信息');

  const addrPt = pts.find((p) => p.text.includes('静安公寓'));
  assert.ok(addrPt);
  assert.equal(addrPt.category, '当前身份与关系');
  assert.equal(addrPt.keepByDefault, false);

  const contPt = pts.find((p) => p.text.includes('楚霁寒') && p.text.includes('楚小子'));
  assert.ok(contPt);
  assert.equal(contPt.category, '基础信息');

  const sitPt = pts.find((p) => p.text.includes('城南旧书铺'));
  assert.ok(sitPt);
  assert.equal(sitPt.category, '当前身份与关系');
});

test('Group 11.3 (R1): buildGenerationMessages honors charContext.selectedWorldEntries including explicit empty array', () => {
  const baseChar = {
    name: '顾临',
    description: '刑侦支队队长',
    worldName: '港城档案',
    worldSummary: '不该被兜底注入的旧摘要',
  };

  const filtered = buildGenerationMessages({
    mode: 'create',
    inspiration: '法医搭档',
    charContext: {
      ...baseChar,
      selectedWorldEntries: [
        { comment: '港城警署架构', keys: ['警署', '支队'], content: '下设重案与法证两组。' },
      ],
    },
  });
  assert.ok(filtered.assembledPromptText.includes('港城警署架构'));
  assert.ok(filtered.assembledPromptText.includes('下设重案与法证两组'));
  assert.equal(filtered.assembledPromptText.includes('不该被兜底注入的旧摘要'), false);

  const noneSelected = buildGenerationMessages({
    mode: 'create',
    inspiration: '法医搭档',
    charContext: {
      ...baseChar,
      selectedWorldEntries: [],
    },
  });
  assert.equal(noneSelected.assembledPromptText.includes('港城警署架构'), false);
  assert.equal(noneSelected.assembledPromptText.includes('不该被兜底注入的旧摘要'), false);
});

test('Group 11.4 (R3 regression): explicit core sections resist greedy prose heuristics, trailing # comments on empty containers preserve children, and times/URLs/apostrophes stay intact', () => {
  const edgeYaml = [
    '别名: # 称呼',
    '  - "眠眠"',
    '  - "小棉花"',
    '性格与行为逻辑: |',
    '  每次开场寒暄后就会迅速沉默，习惯观察他人反应。',
    '成长经历: |',
    '  自幼与父母关系冷淡，十八岁独自搬去外地求学。',
    '外貌与体型: |',
    '  开场给人冷淡距离感，常穿深灰大衣。',
    '生活习惯: |',
    '  19:30 准时吃晚饭。',
    '  https://blog.example.com/u/123',
    '  - don\'t panic # 遇事冷静',
  ].join('\n');

  const pts = extractPersonaPoints(edgeYaml, 36);

  // 1. Empty container with trailing # comment keeps child bullets attached
  assert.equal(pts.some((p) => p.fullText === '别名：称呼'), false);
  const aliasPt = pts.find((p) => p.fullText.startsWith('别名：') && p.fullText.includes('眠眠') && p.fullText.includes('小棉花'));
  assert.ok(aliasPt);
  assert.equal(aliasPt.category, '基础信息');
  assert.equal(aliasPt.keepByDefault, true);

  // 2. Explicit core sections do NOT get misclassified as 当前身份与关系 by prose words like 开场 / 与...关系
  const persPt = pts.find((p) => p.fullText.includes('每次开场寒暄后就会迅速沉默'));
  assert.ok(persPt);
  assert.equal(persPt.category, '性格与底色');
  assert.equal(persPt.keepByDefault, true);

  const histPt = pts.find((p) => p.fullText.includes('自幼与父母关系冷淡'));
  assert.ok(histPt);
  assert.equal(histPt.category, '经历与技能');
  assert.equal(histPt.keepByDefault, true);

  const appPt = pts.find((p) => p.fullText.includes('开场给人冷淡距离感'));
  assert.ok(appPt);
  assert.equal(appPt.category, '外貌与印象');
  assert.equal(appPt.keepByDefault, true);

  // 3. Unindented time (19:30) and URL (https://) are NOT rewritten to full-width colons
  const unindentedTimeAndUrl = [
    '19:30 准时吃晚饭。',
    'https://blog.example.com/u/123',
    '- don\'t panic # 遇事冷静',
  ].join('\n');
  const flatPts = extractPersonaPoints(unindentedTimeAndUrl, 36);
  assert.ok(flatPts.some((p) => p.fullText === '19:30 准时吃晚饭。'));
  assert.ok(flatPts.some((p) => p.fullText === 'https://blog.example.com/u/123'));
  assert.ok(flatPts.some((p) => p.fullText === "don't panic（遇事冷静）"));

  // 4. Nested relation keys under 基本身份: classify as 当前身份与关系 (keepByDefault: false)
  const nestedRelationYaml = [
    '基本身份:',
    '  年龄: 20岁',
    '  当前与{{char}}关系: 合租室友',
    '  当前与char关系: 大学同学',
    '  现在与{{char}}的关系: 青梅竹马',
    '  和{{char}}的关系: 邻居',
    '  人物关系: 互相照应',
  ].join('\n');
  const nestedRelPts = extractPersonaPoints(nestedRelationYaml, 36);
  const nestedAgePt = nestedRelPts.find((p) => p.fullText.includes('20岁'));
  assert.ok(nestedAgePt);
  assert.equal(nestedAgePt.category, '基础信息');
  assert.equal(nestedAgePt.keepByDefault, true);
  for (const expectedVal of ['合租室友', '大学同学', '青梅竹马', '邻居', '互相照应']) {
    const relPt = nestedRelPts.find((p) => p.fullText.includes(expectedVal));
    assert.ok(relPt, `Expected relation point containing ${expectedVal}`);
    assert.equal(relPt.category, '当前身份与关系');
    assert.equal(relPt.keepByDefault, false);
  }
});
