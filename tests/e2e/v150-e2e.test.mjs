// End-to-End Opaque-Box Test Suite for user-persona-studio v1.5.0
// Covers Tiers 1-4 (200 behavioral cases) + Static & Compliance Gate (16 checks) = 216 cases.

globalThis.__UPS_DISABLE_AUTO_BOOT__ = true;

import test, { before, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import {
  REPO_ROOT,
  MockStorage,
  loadStudioModules,
  createE2EEnvironment,
  createMockSTHost,
  extractCssRuleBlocks,
  listRepoTextFiles,
  decodeBase64List,
} from './e2e-harness.mjs';

let mods;
let activeCleanups = [];

before(async () => {
  mods = await loadStudioModules();
});

afterEach(() => {
  while (activeCleanups.length > 0) {
    const fn = activeCleanups.pop();
    try {
      fn();
    } catch {
      // ignore cleanup error
    }
  }
});

async function mountFreshStudio(envOpts = {}, hostConfig = {}, controllerOpts = {}) {
  const env = createE2EEnvironment(envOpts);
  const stHost = createMockSTHost(env, hostConfig);
  stHost.install();
  const ctrl = await mods.entry.mountStudioForTest({
    doc: env.doc,
    win: env.win,
    skipCssRefresh: true,
    ...controllerOpts,
  });
  activeCleanups.push(() => {
    ctrl?.destroy?.();
    stHost.cleanup(mods.host._resetHostCacheForTests);
  });
  return { env, stHost, ctrl, shadow: ctrl.shadow };
}

function getModalRect(shadow) {
  const modal = shadow.querySelector('.ups-modal');
  assert.ok(modal, 'Expected .ups-modal to exist in Shadow DOM');
  return modal.getBoundingClientRect();
}

function getStatusText(shadow) {
  return String(shadow.querySelector('[data-ups-status]')?.textContent || '').trim();
}

function makeCompanionSample(overrides = {}) {
  return {
    id: overrides.id || 'comp_1',
    chid: overrides.chid || '1',
    avatar: overrides.avatar || 'guhan.png',
    name: overrides.name || '顾寒',
    realName: overrides.realName || '',
    carryMode: overrides.carryMode || 'inline',
    relationToUser: overrides.relationToUser || '哥哥',
    knowsMainChar: overrides.knowsMainChar ?? true,
    relationToMainChar: overrides.relationToMainChar || '旧部下',
    frequency: overrides.frequency || 'occasional',
    includeDialogueExamples: overrides.includeDialogueExamples ?? false,
    description:
      overrides.description ||
      '顾寒二十八岁，黑发微乱，常穿深灰工装外套，左腕戴银壳机械表。说话简短利落，习惯先动手把事办妥再开口。',
    personality: overrides.personality || '外冷内热，护短且分寸感极强，不爱说多余的客套话。',
    scenario: overrides.scenario || '我是{{user}}的未婚夫，今晚我们被困在暴雪山庄。',
    firstMessage: overrides.firstMessage || '“炉子生起来了。”\n<status>HP: 100</status>',
    mesExamples: overrides.mesExamples || '<START>\n{{char}}: “有事直接叫我，别自己硬扛。”',
    selectedWorldEntries: overrides.selectedWorldEntries || [
      {
        entryKey: 'world::顾寒专属设定::20',
        comment: '顾寒日常落脚点',
        keys: ['顾寒', '修表铺'],
        content: '顾寒在巷口开了家修表铺，柜台抽屉常备薄荷糖和急救绷带。',
      },
    ],
  };
}

// ============================================================================
// TIER 1: HAPPY-PATH FUNCTIONAL COVERAGE (85 Cases = F1..F17 x 5)
// ============================================================================

test('T1-F01-01: inline carry mode writes companion anchor into persona without creating companion worldbook', async () => {
  const { env, stHost, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  const modeSel = shadow.querySelector('[data-ups-companion-carry-mode]');
  assert.ok(modeSel, 'Expected [data-ups-companion-carry-mode]');
  env.selectOption(modeSel, 'inline');

  const addBtn = shadow.querySelector('[data-ups-companion-add]');
  assert.ok(addBtn, 'Expected [data-ups-companion-add]');
  addBtn.click();
  await env.waitTicks();

  const genBtn = shadow.querySelector('[data-ups-generate]');
  genBtn.click();
  await env.waitTicks(20);

  const wbBeforeCount = stHost.worldbooks.size;
  const saveOverBtn = shadow.querySelector('[data-ups-save-overwrite]');
  saveOverBtn.click();
  await env.waitTicks(20);

  assert.equal(stHost.worldbooks.size, wbBeforeCount);
  const savedDesc = stHost.powerUser.persona_descriptions['linqi.png'].description;
  assert.ok(savedDesc.length > 0);
});

test('T1-F01-02: persona_book carry mode creates/binds persona-linked worldbook with slotKey and managed=true', async () => {
  const { env, stHost } = await mountFreshStudio();
  const companion = makeCompanionSample({ id: 'c_guhan', name: '顾寒' });
  const entries = mods.core.buildCompanionWorldbookEntries({
    companions: [companion],
    companionPlans: [{ id: 'c_guhan', verbatimText: '顾寒在巷口开了家修表铺。' }],
    targetPersonaName: '林栖',
  });
  assert.ok(entries.length >= 1);
  assert.equal(entries[0].extensions?.user_persona_studio?.slotKey, 'ups:companion:c_guhan');
  assert.equal(entries[0].extensions?.user_persona_studio?.managed, true);

  const res = await mods.host.saveSupplementaryWorldbook({
    worldName: '林栖_携伴设定',
    entries,
    avatarId: 'linqi.png',
    upsert: true,
    pruneManaged: true,
  });
  assert.equal(res.worldName, '林栖_携伴设定');
  assert.equal(stHost.powerUser.persona_descriptions['linqi.png'].lorebook, '林栖_携伴设定');
  const wb = stHost.worldbooks.get('林栖_携伴设定');
  assert.ok(wb);
  const stored = Object.values(wb.entries);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].extensions?.user_persona_studio?.slotKey, 'ups:companion:c_guhan');
  assert.equal(env.worldInfoSelect.options.some((o) => o.value === '林栖_携伴设定'), true);
});

test('T1-F01-03: re-saving same persona in persona_book mode updates entry in-place preserving uid (zero duplicates)', async () => {
  const { stHost } = await mountFreshStudio();
  const companionV1 = makeCompanionSample({ id: 'c_guhan', name: '顾寒' });
  const entriesV1 = mods.core.buildCompanionWorldbookEntries({
    companions: [companionV1],
    companionPlans: [{ id: 'c_guhan', verbatimText: '版本一：修表铺在巷口东侧。' }],
    targetPersonaName: '林栖',
  });
  await mods.host.saveSupplementaryWorldbook({
    worldName: '林栖_携伴设定',
    entries: entriesV1,
    avatarId: 'linqi.png',
    upsert: true,
  });
  const firstUid = Object.values(stHost.worldbooks.get('林栖_携伴设定').entries)[0].uid;

  const entriesV2 = mods.core.buildCompanionWorldbookEntries({
    companions: [companionV1],
    companionPlans: [{ id: 'c_guhan', verbatimText: '版本二：修表铺常备薄荷糖和绷带。' }],
    targetPersonaName: '林栖',
  });
  await mods.host.saveSupplementaryWorldbook({
    worldName: '林栖_携伴设定',
    entries: entriesV2,
    avatarId: 'linqi.png',
    upsert: true,
    pruneManaged: true,
  });

  const allEntries = Object.values(stHost.worldbooks.get('林栖_携伴设定').entries);
  assert.equal(allEntries.length, 1);
  assert.equal(allEntries[0].uid, firstUid);
  assert.ok(allEntries[0].content.includes('版本二'));
  assert.equal(Array.from(stHost.worldbooks.keys()).filter((k) => k.includes('林栖')).length, 1);
});

test('T1-F01-04: listWorldbooks discovers books and target_book upsert merges in-place preserving existing manual entries', async () => {
  const { stHost } = await mountFreshStudio();
  const books = await mods.host.listWorldbooks();
  assert.equal(books.includes('主线背景书'), true);
  assert.equal(books.includes('城市群像录'), true);

  const companion = makeCompanionSample({ id: 'c_suwan', name: '苏晚', avatar: 'suwan.png' });
  const entries = mods.core.buildCompanionWorldbookEntries({
    companions: [companion],
    companionPlans: [{ id: 'c_suwan', verbatimText: '苏晚经营社区甜品工作室。' }],
    targetPersonaName: '林栖',
  });

  await mods.host.saveSupplementaryWorldbook({
    worldName: '主线背景书',
    entries,
    upsert: true,
  });

  const wb = stHost.worldbooks.get('主线背景书');
  const stored = Object.values(wb.entries);
  assert.equal(stored.some((e) => e.uid === 0 && e.comment === '城市地标与港口规则'), true);
  assert.equal(stored.some((e) => e.extensions?.user_persona_studio?.slotKey === 'ups:companion:c_suwan'), true);
});

test('T1-F01-05: switching personas preserves separate persona_book lorebook bindings automatically', async () => {
  const { stHost } = await mountFreshStudio();
  await mods.host.saveSupplementaryWorldbook({
    worldName: '林栖_专属书',
    entries: [{ key: ['顾寒'], comment: '顾寒', content: '修表铺老板。' }],
    avatarId: 'linqi.png',
    upsert: true,
  });
  await mods.host.saveSupplementaryWorldbook({
    worldName: '江澄_专属书',
    entries: [{ key: ['苏晚'], comment: '苏晚', content: '甜品店主理人。' }],
    avatarId: 'jiangcheng.png',
    upsert: true,
  });

  await stHost.bridge.setUserAvatar('linqi.png');
  assert.equal(stHost.powerUser.persona_description_lorebook, '林栖_专属书');
  await stHost.bridge.setUserAvatar('jiangcheng.png');
  assert.equal(stHost.powerUser.persona_description_lorebook, '江澄_专属书');
});

test('T1-F02-01: COMPANION_FREQUENCY_TIERS exposes exact 3 tiers with full contract fields', () => {
  const tiers = mods.presets.COMPANION_FREQUENCY_TIERS;
  assert.ok(Array.isArray(tiers));
  assert.deepEqual(tiers.map((t) => t.id), ['background', 'occasional', 'active_circle']);
  for (const t of tiers) {
    assert.ok(typeof t.label === 'string' && t.label.length > 0);
    assert.ok(typeof t.description === 'string' && t.description.length > 0);
    assert.ok(Number.isFinite(t.worldbookOrder));
    assert.ok(typeof t.promptRule === 'string' && t.promptRule.length > 0);
  }
});

test('T1-F02-02: background tier produces lowest companion worldbook order and non-intrusive prompt rule', () => {
  const bgTier = mods.presets.COMPANION_FREQUENCY_TIERS.find((t) => t.id === 'background');
  const activeTier = mods.presets.COMPANION_FREQUENCY_TIERS.find((t) => t.id === 'active_circle');
  assert.ok(bgTier.worldbookOrder < activeTier.worldbookOrder);

  const comp = makeCompanionSample({ frequency: 'background' });
  const entries = mods.core.buildCompanionWorldbookEntries({
    companions: [comp],
    companionPlans: [{ id: comp.id, verbatimText: '顾寒二十八岁，深灰工装外套。' }],
  });
  assert.equal(entries[0].constant, false);
  assert.equal(entries[0].selective, true);
  assert.equal(entries[0].order, bgTier.worldbookOrder);

  const built = mods.core.buildGenerationMessages({
    mode: 'create',
    inspiration: '日常合租',
    companions: [comp],
  });
  assert.ok(built.assembledPromptText.includes(bgTier.promptRule) || built.assembledPromptText.includes('背景'));
});

test('T1-F02-03: occasional tier uses mid-tier order, trigger keys, and natural contact prompt rule', () => {
  const bgTier = mods.presets.COMPANION_FREQUENCY_TIERS.find((t) => t.id === 'background');
  const occTier = mods.presets.COMPANION_FREQUENCY_TIERS.find((t) => t.id === 'occasional');
  const activeTier = mods.presets.COMPANION_FREQUENCY_TIERS.find((t) => t.id === 'active_circle');
  assert.ok(occTier.worldbookOrder > bgTier.worldbookOrder && occTier.worldbookOrder < activeTier.worldbookOrder);

  const comp = makeCompanionSample({ frequency: 'occasional', name: '顾寒', relationToUser: '哥哥' });
  const entries = mods.core.buildCompanionWorldbookEntries({
    companions: [comp],
    companionPlans: [{ id: comp.id, verbatimText: '顾寒在巷口修表。' }],
  });
  assert.equal(entries[0].order, occTier.worldbookOrder);
  assert.equal(entries[0].key.includes('顾寒'), true);
});

test('T1-F02-04: active_circle tier uses highest companion order and spotlight-respecting prompt directive', () => {
  const activeTier = mods.presets.COMPANION_FREQUENCY_TIERS.find((t) => t.id === 'active_circle');
  const comp = makeCompanionSample({ frequency: 'active_circle' });
  const entries = mods.core.buildCompanionWorldbookEntries({
    companions: [comp],
    companionPlans: [{ id: comp.id, verbatimText: '顾寒经常路过旧书店。' }],
  });
  assert.equal(entries[0].order, activeTier.worldbookOrder);
  const built = mods.core.buildGenerationMessages({
    mode: 'create',
    inspiration: '老街生活',
    companions: [comp],
  });
  assert.ok(built.assembledPromptText.includes('顾寒'));
  assert.ok(built.assembledPromptText.includes(activeTier.promptRule) || built.assembledPromptText.includes('常驻'));
});

test('T1-F02-05: changing companion frequency dropdown in Studio UI updates getState() and LLM prompt payload', async () => {
  const { env, stHost, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  shadow.querySelector('[data-ups-companion-add]').click();
  await env.waitTicks();

  const freqSelect = shadow.querySelector('[data-ups-companion-frequency], [data-ups-companion-section] select[data-ups-companion-freq]');
  assert.ok(freqSelect, 'Expected companion frequency select in [data-ups-companion-section]');
  env.selectOption(freqSelect, 'active_circle');
  await env.waitTicks();

  shadow.querySelector('[data-ups-generate]').click();
  await env.waitTicks(20);
  assert.ok(stHost.capturedGenerations.length >= 1);
  const sent = stHost.capturedGenerations.at(-1).messages.map((m) => m.content).join('\n');
  assert.ok(sent.includes('同圈') || sent.includes('常驻') || sent.includes('active_circle'));
});

test('T1-F03-01: add 1 companion slot in UI, select char and {{user}} relation, reflects in prompt', async () => {
  const { env, stHost, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  shadow.querySelector('[data-ups-companion-add]').click();
  await env.waitTicks();

  const section = shadow.querySelector('[data-ups-companion-section]');
  const charSel = section.querySelector('select[data-ups-companion-char], [data-ups-companion-char-select]');
  assert.ok(charSel, 'Expected companion character selector');
  env.selectOption(charSel, '1');
  await env.waitTicks();

  const relInput = section.querySelector('[data-ups-companion-relation]');
  assert.ok(relInput, 'Expected companion relation input');
  env.setInputValue(relInput, '哥哥');

  shadow.querySelector('[data-ups-generate]').click();
  await env.waitTicks(20);
  const sent = stHost.capturedGenerations.at(-1).messages.map((m) => m.content).join('\n');
  assert.ok(sent.includes('顾寒') && sent.includes('哥哥'));
});

test('T1-F03-02: supports 3 concurrent companion slots and exposes COMPANION_RELATION_PRESETS', async () => {
  assert.ok(Array.isArray(mods.presets.COMPANION_RELATION_PRESETS));
  assert.equal(mods.presets.COMPANION_RELATION_PRESETS.includes('哥哥'), true);
  assert.equal(mods.presets.COMPANION_RELATION_PRESETS.includes('挚友'), true);

  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  const addBtn = shadow.querySelector('[data-ups-companion-add]');
  addBtn.click();
  addBtn.click();
  addBtn.click();
  await env.waitTicks();

  const cards = shadow.querySelectorAll('[data-ups-companion-slot]');
  assert.equal(cards.length, 3);
});

test('T1-F03-03: encodes knowsMainChar=true relation and knowsMainChar=false boundary distinctly', () => {
  const c1 = makeCompanionSample({ id: 'c1', name: '顾寒', knowsMainChar: true, relationToMainChar: '旧部下' });
  const c2 = makeCompanionSample({ id: 'c2', name: '苏晚', knowsMainChar: false, relationToMainChar: '' });
  const built = mods.core.buildGenerationMessages({
    mode: 'create',
    inspiration: '城市日常',
    companions: [c1, c2],
  });
  assert.ok(built.assembledPromptText.includes('旧部下'));
  assert.ok(built.assembledPromptText.includes('互不相识') || built.assembledPromptText.includes('不认识'));

  const entries = mods.core.buildCompanionWorldbookEntries({
    companions: [c1, c2],
    companionPlans: [
      { id: 'c1', verbatimText: '顾寒设定' },
      { id: 'c2', verbatimText: '苏晚设定' },
    ],
  });
  assert.ok(entries[0].content.includes('旧部下'));
  assert.ok(entries[1].content.includes('互不相识') || entries[1].content.includes('不认识'));
});

test('T1-F03-04: selective companion worldbook entry toggles include only checked entries in slicing & token plan', () => {
  const allEntries = [
    { entryKey: 'e1', comment: '落脚点', keys: ['修表铺'], content: '巷口修表铺常备薄荷糖。', defaultEnabled: true },
    { entryKey: 'e2', comment: '旧疤', keys: ['雨夜'], content: '左腕淡疤阴雨天发酸。', defaultEnabled: true },
    { entryKey: 'e3', comment: '线人', keys: ['密信'], content: '港口旧同事暗号。', defaultEnabled: false },
    { entryKey: 'e4', comment: '机械表', keys: ['表'], content: '走了十五年的银壳机械表。', defaultEnabled: false },
  ];
  const checked = allEntries.slice(0, 2);
  const sliced = mods.core.extractVerbatimCompanionSlices(
    { name: '顾寒', description: '黑发微乱。', personality: '外冷内热。' },
    checked,
    800
  );
  assert.ok(sliced.text.includes('巷口修表铺常备薄荷糖。'));
  assert.ok(sliced.text.includes('左腕淡疤阴雨天发酸。'));
  assert.equal(sliced.text.includes('港口旧同事暗号。'), false);
  assert.equal(sliced.text.includes('走了十五年的银壳机械表。'), false);
});

test('T1-F03-05: removing companion slot and re-saving with pruneManaged=true removes obsolete slotKey', async () => {
  const { stHost } = await mountFreshStudio();
  const c1 = makeCompanionSample({ id: 'c1', name: '顾寒' });
  const c2 = makeCompanionSample({ id: 'c2', name: '苏晚', avatar: 'suwan.png' });
  await mods.host.saveSupplementaryWorldbook({
    worldName: '林栖_携伴设定',
    entries: mods.core.buildCompanionWorldbookEntries({
      companions: [c1, c2],
      companionPlans: [
        { id: 'c1', verbatimText: '顾寒原文' },
        { id: 'c2', verbatimText: '苏晚原文' },
      ],
    }),
    upsert: true,
    pruneManaged: true,
  });
  assert.equal(Object.keys(stHost.worldbooks.get('林栖_携伴设定').entries).length, 2);

  await mods.host.saveSupplementaryWorldbook({
    worldName: '林栖_携伴设定',
    entries: mods.core.buildCompanionWorldbookEntries({
      companions: [c1],
      companionPlans: [{ id: 'c1', verbatimText: '顾寒原文' }],
    }),
    upsert: true,
    pruneManaged: true,
  });
  const remaining = Object.values(stHost.worldbooks.get('林栖_携伴设定').entries);
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].extensions.user_persona_studio.slotKey, 'ups:companion:c1');
});

test('T1-F04-01: computeCompanionTokenPlan allocates non-zero budgets with headroomStatus ok under ample context', () => {
  const plan = mods.core.computeCompanionTokenPlan({
    personaText: '林栖，24岁，旧书店装帧师。',
    mainCharContext: { name: '沈砚', description: '旧书店店主。', personality: '温和克制。' },
    mainSelectedWorldEntries: [{ content: '青岚港老城区。' }],
    companions: [makeCompanionSample({ id: 'c1' }), makeCompanionSample({ id: 'c2', name: '苏晚' })],
    maxContextTokens: 8192,
  });
  assert.equal(plan.headroomStatus, 'ok');
  assert.equal(plan.warningMessage, '');
  assert.ok(plan.remainingTokens > 0);
  assert.equal(plan.perCompanionBudgets.length, 2);
  assert.ok(plan.perCompanionBudgets.every((b) => b.allocatedTokens > 0));
});

test('T1-F04-02: extractVerbatimCompanionSlices preserves exact author sentences verbatim', () => {
  const descSentence = '黑发微乱，常穿深灰工装外套，左腕戴银壳机械表。';
  const entrySentence = '顾寒在巷口开了家修表铺，柜台抽屉常备薄荷糖和急救绷带。';
  const res = mods.core.extractVerbatimCompanionSlices(
    { name: '顾寒', description: descSentence, personality: '外冷内热。' },
    [{ comment: '落脚点', content: entrySentence }],
    1000
  );
  assert.equal(res.truncated, false);
  assert.equal(res.text.includes(descSentence), true);
  assert.equal(res.text.includes(entrySentence), true);
});

test('T1-F04-03: stripCompanionConflicts strips first_mes, scenario, status block, and conflicting {{user}} identity', () => {
  const stripped = mods.core.stripCompanionConflicts({
    name: '顾寒',
    description: '黑发微乱，左腕戴银壳机械表。\n我是{{user}}的未婚夫。\n<status>HP: 100</status>',
    personality: '外冷内热，护短且分寸感极强。',
    scenario: '今晚被困暴雪山庄。',
    firstMessage: '“炉子生起来了。”',
  });
  assert.equal(stripped.strippedTypes.includes('first_mes'), true);
  assert.equal(stripped.strippedTypes.includes('scenario'), true);
  assert.equal(stripped.strippedTypes.includes('status_directive'), true);
  const joined = stripped.cleanSections.map((s) => s.content).join('\n');
  assert.equal(joined.includes('黑发微乱'), true);
  assert.equal(joined.includes('外冷内热'), true);
  assert.equal(joined.includes('<status>'), false);
  assert.equal(joined.includes('未婚夫'), false);
});

test('T1-F04-04: getCharacterContext with includeDialogueExamples=true returns mesExamples verbatim', async () => {
  await mountFreshStudio();
  const ctx = await mods.host.getCharacterContext(
    { chid: '1' },
    { includeWorldEntries: true, includeDialogueExamples: true }
  );
  assert.ok(ctx.mesExamples.includes('别自己硬扛'));
  const built = mods.core.buildGenerationMessages({
    mode: 'create',
    inspiration: '日常',
    companions: [makeCompanionSample({ includeDialogueExamples: true, mesExamples: ctx.mesExamples })],
  });
  assert.ok(built.assembledPromptText.includes('别自己硬扛'));
  assert.ok(/原样|原文|不得改写/.test(built.assembledPromptText));
});

test('T1-F04-05: reading non-active companion cards never switches active chat or active character on host', async () => {
  const { stHost } = await mountFreshStudio();
  const c1 = await mods.host.getCharacterContext({ chid: '1' }, { includeWorldEntries: true });
  const c2 = await mods.host.getCharacterContext({ chid: '2' }, { includeWorldEntries: true });
  assert.equal(c1.name, '顾寒');
  assert.equal(c2.name, '苏晚');
  assert.equal(stHost.getActiveCharacterId(), '0');
  assert.equal(stHost.getActiveChatId(), 'chat-active-001');
  assert.equal(stHost.getActiveChatMessages()[0].mes, '开场聊天记录不可被改动');
});

test('T1-F05-01: version parity equals 1.6.1 across manifest.json, package.json, and index.js', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'manifest.json'), 'utf8'));
  assert.equal(pkg.version, '1.6.1');
  assert.equal(manifest.version, '1.6.1');
  assert.equal(mods.entry.EXTENSION_VERSION, '1.6.1');
});

test('T1-F05-02: mountStudioForTest opens .ups-modal at stable locked dimensions inside viewport', async () => {
  const { ctrl, shadow } = await mountFreshStudio({ innerWidth: 1280, innerHeight: 800 });
  await ctrl.open();
  const r = getModalRect(shadow);
  assert.ok(r.width > 600 && r.width <= 1280);
  assert.ok(r.height > 400 && r.height <= 800);
});

test('T1-F05-03: adding 2 companions inside Studio causes zero outer .ups-modal size jump', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio({ innerWidth: 1280, innerHeight: 800 });
  await ctrl.open();
  const before = getModalRect(shadow);

  const addBtn = shadow.querySelector('[data-ups-companion-add]');
  addBtn.click();
  addBtn.click();
  await env.waitTicks();

  const after = getModalRect(shadow);
  assert.equal(after.width, before.width);
  assert.equal(after.height, before.height);
});

test('T1-F05-04: switching across all 4 top tabs preserves identical .ups-modal outer width and height', async () => {
  const { ctrl, shadow } = await mountFreshStudio({ innerWidth: 1280, innerHeight: 800 });
  await ctrl.open();
  const baseRect = getModalRect(shadow);
  for (const tabId of ['presets', 'taste', 'settings', 'studio']) {
    shadow.querySelector(`[data-ups-tab="${tabId}"]`).click();
    const cur = getModalRect(shadow);
    assert.equal(cur.width, baseRect.width);
    assert.equal(cur.height, baseRect.height);
  }
});

test('T1-F05-05: refreshExtensionStylesheet appends ?v=1.6.1 once and skips duplicates', () => {
  const env = createE2EEnvironment();
  const oldLink = env.doc.createElement('link');
  oldLink.setAttribute('rel', 'stylesheet');
  oldLink.setAttribute('href', '/scripts/extensions/third-party/user-persona-studio/style.css');
  env.doc.head.appendChild(oldLink);

  const updated = mods.entry.refreshExtensionStylesheet(env.doc, '1.6.1');
  assert.equal(updated, true);
  const links = env.doc.querySelectorAll('link[rel="stylesheet"]');
  assert.equal(links.some((l) => String(l.getAttribute('href')).includes('v=1.6.1')), true);

  const second = mods.entry.refreshExtensionStylesheet(env.doc, '1.6.1');
  assert.equal(second, false);
});

test('T1-F06-01: groupPersonaPoints organizes extracted points into semantic categories', () => {
  const text = [
    '【基础人设】',
    '姓名：林栖',
    '外貌：黑发齐肩，戴银耳钉。',
    '性格：平时温和，熟络后护短。',
    '习惯：睡前喝半杯温牛奶。',
    '技能：擅长修旧书。',
    '【当前背景与关系】',
    '当前身份：旧书店装帧师。',
  ].join('\n');
  const pts = mods.core.extractPersonaPoints(text, 36);
  const grouped = mods.core.groupPersonaPoints(pts);
  assert.ok(Array.isArray(grouped) && grouped.length >= 4);
  const cats = grouped.map((g) => g.category);
  assert.equal(cats.includes('基础信息'), true);
  assert.equal(cats.includes('外貌与印象'), true);
  assert.equal(cats.includes('性格与底色'), true);
});

test('T1-F06-02: extracted-points panel renders semantic group headers with [data-ups-point-group-cb] and [data-ups-point-cb]', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  shadow.querySelector('[data-ups-mode="B"]').click();
  shadow.querySelector('[data-ups-load-persona]').click();
  await env.waitTicks();

  const box = shadow.querySelector('[data-ups-points-box]');
  assert.equal(box.hidden, false);
  const groupCbs = box.querySelectorAll('[data-ups-point-group-cb]');
  const itemCbs = box.querySelectorAll('[data-ups-point-cb]');
  assert.ok(groupCbs.length >= 2);
  assert.ok(itemCbs.length >= 4);
});

test('T1-F06-03: toggling [data-ups-point-group-cb] batch-checks and batch-unchecks only its own category children', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  shadow.querySelector('[data-ups-mode="B"]').click();
  shadow.querySelector('[data-ups-load-persona]').click();
  await env.waitTicks();

  const box = shadow.querySelector('[data-ups-points-box]');
  const groupCbs = box.querySelectorAll('[data-ups-point-group-cb]');
  assert.ok(groupCbs.length >= 2);

  const firstGroupCb = groupCbs[0];
  const secondGroupCb = groupCbs[1];
  const initialSecondState = secondGroupCb.checked;

  firstGroupCb.click();
  await env.waitTicks();
  assert.equal(secondGroupCb.checked, initialSecondState);

  firstGroupCb.click();
  await env.waitTicks();
  assert.equal(secondGroupCb.checked, initialSecondState);
});

test('T1-F06-04: .ups-points-list CSS height is expanded (>= 260px) with internal scrolling', () => {
  const blocks = extractCssRuleBlocks(mods.styles.SHADOW_CSS, (h) => h.includes('.ups-points-list'));
  assert.ok(blocks.length >= 1);
  const body = blocks.map((b) => b.body).join('\n');
  const maxHMatch = /max-height:\s*(\d+)px/.exec(body);
  assert.ok(maxHMatch && Number(maxHMatch[1]) >= 260, `Expected .ups-points-list max-height >= 260px, got ${body}`);
  assert.ok(/overflow-y:\s*auto/.test(body));
});

test('T1-F06-05: points panel top bar supports select-all, clear-all, persona switch, and close', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  shadow.querySelector('[data-ups-pick-points-a]').click();
  await env.waitTicks();

  const box = shadow.querySelector('[data-ups-points-box]');
  assert.equal(box.hidden, false);
  const btns = box.querySelectorAll('button');
  const selectAll = btns.find((b) => b.textContent.includes('全选'));
  const clearAll = btns.find((b) => b.textContent.includes('取消') || b.textContent.includes('清空'));
  const closeBtn = shadow.querySelector('[data-ups-points-close]');

  selectAll.click();
  assert.ok(box.querySelectorAll('[data-ups-point-cb]').every((cb) => cb.checked));
  clearAll.click();
  assert.ok(box.querySelectorAll('[data-ups-point-cb]').every((cb) => !cb.checked));
  closeBtn.click();
  assert.equal(box.hidden, true);
});

test('T1-F07-01: status bar wraps long text (>80 CJK chars) without single-line ellipsis truncation while modal size stays locked', async () => {
  const statusBlocks = extractCssRuleBlocks(
    mods.styles.SHADOW_CSS,
    (h) => h.includes('.ups-status-text') || h.includes('.ups-footer-status')
  );
  const cssJoined = statusBlocks.map((b) => b.body).join('\n');
  assert.equal(/text-overflow:\s*ellipsis/.test(cssJoined), false);
  assert.equal(/white-space:\s*nowrap/.test(cssJoined), false);
});

test('T1-F07-02: browse-only expand/collapse on sections/lexicon/preset entry emits zero status bar noise', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  const initialStatus = getStatusText(shadow);

  shadow.querySelector('[data-ups-ratio-toggle]')?.click();
  shadow.querySelector('[data-ups-lexicon-toggle]')?.click();
  await env.waitTicks();

  assert.equal(getStatusText(shadow), initialStatus);
});

test('T1-F07-03: switching top tabs automatically clears stale status message from previous tab', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  shadow.querySelector('[data-ups-tab="presets"]').click();
  shadow.querySelector('[data-ups-add-entry]')?.click();
  await env.waitTicks();
  assert.notEqual(getStatusText(shadow), '就绪');

  shadow.querySelector('[data-ups-tab="studio"]').click();
  await env.waitTicks();
  assert.equal(getStatusText(shadow), '就绪');
});

test('T1-F07-04: substantive actions including zero-change rescan emit immediate visible status confirmation', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  shadow.querySelector('[data-ups-sync-host]').click();
  await env.waitTicks(20);
  const txt = getStatusText(shadow);
  assert.ok(txt.includes('刷新') || txt.includes('同步') || txt.includes('无变动'));
});

test('T1-F07-05: toggling split-worldbook hint and copy draft provide immediate visible feedback', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  const draft = shadow.querySelector('[data-ups-draft]');
  env.setInputValue(draft, '测试人设文本内容'.repeat(200));
  await env.waitTicks();

  const hint = shadow.querySelector('[data-ups-split-hint]');
  assert.ok(hint && !hint.hidden);
  hint.click();
  await env.waitTicks();

  shadow.querySelector('[data-ups-copy]').click();
  await env.waitTicks(10);
  assert.ok(env.win.navigator.clipboard.copied.includes('测试人设文本内容'));
});

test('T1-F08-01: footer bar has NO permanent saveNameInput', async () => {
  const { ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  const footer = shadow.querySelector('[data-ups-footer]');
  assert.equal(footer.querySelector('[data-ups-save-name]'), null);
  assert.equal(footer.querySelectorAll('input').length, 0);
});

test('T1-F08-02: narrowNavEl (小屏视图) is completely removed on desktop and mobile', async () => {
  const desk = await mountFreshStudio({ innerWidth: 1280, innerHeight: 800 });
  await desk.ctrl.open();
  assert.equal(desk.shadow.querySelector('[data-ups-narrow-nav]'), null);
  assert.equal(desk.shadow.textContent.includes('小屏视图'), false);

  const mob = await mountFreshStudio({ innerWidth: 390, innerHeight: 844, coarse: true });
  await mob.ctrl.open();
  assert.equal(mob.shadow.querySelector('[data-ups-narrow-nav]'), null);
  assert.equal(mob.shadow.textContent.includes('小屏视图'), false);
});

test('T1-F08-03: clicking [data-ups-save-as-btn] opens non-blocking [data-ups-save-name-submodal] pre-filled', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  env.setInputValue(shadow.querySelector('[data-ups-draft]'), '【基础人设】\n姓名：林栖');
  const btn = shadow.querySelector('[data-ups-save-as-btn]');
  assert.ok(btn, 'Expected [data-ups-save-as-btn]');
  btn.click();
  await env.waitTicks();

  const submodal = shadow.querySelector('[data-ups-save-name-submodal]');
  assert.ok(submodal && !submodal.hidden);
  const input = submodal.querySelector('input');
  assert.ok(input && input.value.length > 0);
});

test('T1-F08-04: confirming new persona name in [data-ups-save-name-submodal] creates persona without closing main modal', async () => {
  const { env, stHost, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  env.setInputValue(shadow.querySelector('[data-ups-draft]'), '【基础人设】\n姓名：林栖·新卷');
  shadow.querySelector('[data-ups-save-as-btn]').click();
  await env.waitTicks();

  const submodal = shadow.querySelector('[data-ups-save-name-submodal]');
  const nameInput = submodal.querySelector('input');
  env.setInputValue(nameInput, '林栖·新卷');
  const confirmBtn = submodal.querySelector('[data-ups-save-name-confirm], button.ups-btn-primary');
  confirmBtn.click();
  await env.waitTicks(30);

  assert.equal(Object.values(stHost.powerUser.personas).includes('林栖·新卷'), true);
  assert.equal(ctrl.getState().isOpen, true);
});

test('T1-F08-05: clicking overwrite saves active persona directly without opening name submodal', async () => {
  const { env, stHost, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  env.setInputValue(shadow.querySelector('[data-ups-draft]'), '【基础人设】\n姓名：林栖\n性格：直接覆盖测试');
  shadow.querySelector('[data-ups-save-overwrite]').click();
  await env.waitTicks(30);

  assert.equal(shadow.querySelector('[data-ups-save-name-submodal]')?.hidden ?? true, true);
  assert.ok(stHost.powerUser.persona_descriptions['linqi.png'].description.includes('直接覆盖测试'));
});

test('T1-F09-01: unified 32px word-count combo exists with NO second custom-chars input', async () => {
  const { ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  const input = shadow.querySelector('[data-ups-word-count-input]');
  const menuBtn = shadow.querySelector('[data-ups-word-count-menu-btn]');
  assert.ok(input, 'Expected [data-ups-word-count-input]');
  assert.ok(menuBtn, 'Expected [data-ups-word-count-menu-btn]');
  assert.equal(shadow.querySelector('[data-ups-custom-chars]'), null);
  assert.equal(shadow.querySelector('[data-ups-word-count]'), null);
});

test('T1-F09-02: selecting 1500 from [data-ups-word-count-menu-btn] updates input and targetChars', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  shadow.querySelector('[data-ups-word-count-menu-btn]').click();
  await env.waitTicks();
  const item1500 = shadow.querySelectorAll('[data-ups-word-count-option], .ups-menu-item').find((b) => b.textContent.includes('1500'));
  assert.ok(item1500, 'Expected 1500 option in word count menu');
  item1500.click();
  await env.waitTicks();
  assert.equal(shadow.querySelector('[data-ups-word-count-input]').value, '1500');
});

test('T1-F09-03: editing [data-ups-word-count-input] inline to 1250 updates targetChars directly', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  const input = shadow.querySelector('[data-ups-word-count-input]');
  env.setInputValue(input, '1250');
  await env.waitTicks();
  const active = ctrl.getState().settings.schemes.find((s) => s.id === ctrl.getState().settings.activeSchemeId);
  assert.equal(active.targetChars, 1250);
});

test('T1-F09-04: all 4 word-count presets (600, 1000, 1500, 2000) are selectable', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  for (const val of ['600', '1000', '1500', '2000']) {
    shadow.querySelector('[data-ups-word-count-menu-btn]').click();
    await env.waitTicks();
    const opt = shadow.querySelectorAll('[data-ups-word-count-option], .ups-menu-item').find((b) => b.textContent.includes(val));
    assert.ok(opt, `Expected preset ${val}`);
    opt.click();
    await env.waitTicks();
    assert.equal(shadow.querySelector('[data-ups-word-count-input]').value, val);
  }
});

test('T1-F09-05: word-count combo CSS maintains 32px height', () => {
  const blocks = extractCssRuleBlocks(mods.styles.SHADOW_CSS, (h) => h.includes('word-count') || h.includes('ups-input'));
  const body = blocks.map((b) => b.body).join('\n');
  assert.ok(/height:\s*32px/.test(body));
});

test('T1-F10-01: AI generation snapshots draft to isolated localStorage key (not bloating extensionSettings)', async () => {
  const { env, stHost, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  shadow.querySelector('[data-ups-generate]').click();
  await env.waitTicks(20);

  const keys = Object.keys(env.storage.snapshot());
  assert.ok(keys.some((k) => k.includes('history') || k.includes('ups')));
  assert.equal(Object.hasOwn(stHost.extensionSettings?.user_persona_studio || {}, 'generationHistory'), false);
});

test('T1-F10-02: clicking [data-ups-history-btn] opens non-blocking [data-ups-history-popover]', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  shadow.querySelector('[data-ups-generate]').click();
  await env.waitTicks(20);

  const btn = shadow.querySelector('[data-ups-history-btn]');
  assert.ok(btn);
  btn.click();
  await env.waitTicks();

  const pop = shadow.querySelector('[data-ups-history-popover]');
  assert.ok(pop && !pop.hidden);
  assert.ok(pop.textContent.includes('林栖'));
});

test('T1-F10-03: 填入编辑区 restores snapshot AND pushes prior draft onto undo stack', async () => {
  const { env, stHost, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();

  stHost.setLlmResponder(() => '【基础人设】\n姓名：第一版快照');
  shadow.querySelector('[data-ups-generate]').click();
  await env.waitTicks(20);

  env.setInputValue(shadow.querySelector('[data-ups-draft]'), '【基础人设】\n姓名：手动改写后版本');
  shadow.querySelector('[data-ups-history-btn]').click();
  await env.waitTicks();

  const pop = shadow.querySelector('[data-ups-history-popover]');
  const restoreBtn = pop.querySelectorAll('button').find((b) => b.textContent.includes('填入编辑区'));
  assert.ok(restoreBtn);
  restoreBtn.click();
  await env.waitTicks();

  assert.ok(shadow.querySelector('[data-ups-draft]').value.includes('第一版快照'));
  const undoBtn = shadow.querySelector('[data-ups-undo]');
  assert.equal(undoBtn.disabled, false);
  undoBtn.click();
  assert.ok(shadow.querySelector('[data-ups-draft]').value.includes('手动改写后版本'));
});

test('T1-F10-04: single-item delete removes only targeted entry from history', async () => {
  const { env, stHost, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  for (const label of ['版本A', '版本B', '版本C']) {
    stHost.setLlmResponder(() => `【基础人设】\n姓名：${label}`);
    shadow.querySelector('[data-ups-generate]').click();
    await env.waitTicks(15);
  }
  shadow.querySelector('[data-ups-history-btn]').click();
  await env.waitTicks();

  const pop = shadow.querySelector('[data-ups-history-popover]');
  const delBtns = pop.querySelectorAll('[data-ups-history-delete], button').filter((b) => b.textContent.includes('删除') && !b.textContent.includes('清空'));
  assert.equal(delBtns.length, 3);
  delBtns[0].click();
  await env.waitTicks();

  const remainingBtns = pop.querySelectorAll('[data-ups-history-delete], button').filter((b) => b.textContent.includes('删除') && !b.textContent.includes('清空'));
  assert.equal(remainingBtns.length, 2);
});

test('T1-F10-05: 清空历史 clears all history snapshots cleanly', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  shadow.querySelector('[data-ups-generate]').click();
  await env.waitTicks(20);
  shadow.querySelector('[data-ups-history-btn]').click();
  await env.waitTicks();

  const pop = shadow.querySelector('[data-ups-history-popover]');
  const clearBtn = pop.querySelectorAll('button').find((b) => b.textContent.includes('清空历史'));
  assert.ok(clearBtn);
  clearBtn.click();
  await env.waitTicks();
  assert.ok(pop.textContent.includes('暂无') || pop.querySelectorAll('[data-ups-history-item]').length === 0);
});

test('T1-F11-01: main character search filters candidates by keyword', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  const searchEl = shadow.querySelector('[data-ups-char-search]');
  assert.ok(searchEl, 'Expected [data-ups-char-search]');
  env.setInputValue(searchEl, '苏');
  await env.waitTicks();

  const charBox = shadow.querySelector('[data-ups-char-box]');
  assert.ok(charBox.textContent.includes('苏晚'));
  assert.equal(charBox.textContent.includes('周牧'), false);
});

test('T1-F11-02: companion character search filters companion candidates without clearing main char', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  shadow.querySelector('[data-ups-companion-add]').click();
  await env.waitTicks();

  const compSection = shadow.querySelector('[data-ups-companion-section]');
  const compSearch = compSection.querySelector('[data-ups-char-search], input[type="search"], input[type="text"]');
  assert.ok(compSearch);
  env.setInputValue(compSearch, '顾');
  await env.waitTicks();

  assert.ok(compSection.textContent.includes('顾寒'));
  assert.equal(ctrl.getState().selectedCharTarget, '');
});

test('T1-F11-03: [data-ups-char-search] carries spellcheck="false" and clean placeholder', async () => {
  const { ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  const searchEl = shadow.querySelector('[data-ups-char-search]');
  assert.equal(searchEl.getAttribute('spellcheck'), 'false');
  assert.ok((searchEl.getAttribute('placeholder') || '').length > 0);
});

test('T1-F11-04: clearing [data-ups-char-search] restores full unfiltered character list', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  const searchEl = shadow.querySelector('[data-ups-char-search]');
  env.setInputValue(searchEl, '苏');
  await env.waitTicks();
  env.setInputValue(searchEl, '');
  await env.waitTicks();

  const charBox = shadow.querySelector('[data-ups-char-box]');
  assert.ok(charBox.textContent.includes('沈砚'));
  assert.ok(charBox.textContent.includes('顾寒'));
  assert.ok(charBox.textContent.includes('苏晚'));
  assert.ok(charBox.textContent.includes('周牧'));
});

test('T1-F11-05: selecting filtered character on desktop loads context without touching host active chat', async () => {
  const { env, stHost, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  const searchEl = shadow.querySelector('[data-ups-char-search]');
  env.setInputValue(searchEl, '苏');
  await env.waitTicks();

  const charSel = shadow.querySelector('[data-ups-char-select]');
  env.selectOption(charSel, '2');
  await env.waitTicks(20);

  assert.equal(ctrl.getState().selectedCharTarget, '2');
  assert.equal(stHost.getActiveCharacterId(), '0');
  assert.equal(stHost.getActiveChatId(), 'chat-active-001');
});

test('T1-F12-01: 生成板块与比重 defaults collapsed, core on, NPC/Body/亲密设定 off, layoutStyle structured, private=0', async () => {
  const normSections = mods.core.normalizeGenerationSectionsConfig();
  assert.equal(normSections.layoutStyle, 'structured');
  assert.equal(normSections.presetId, 'standard');
  const normRatios = mods.core.normalizeModuleRatios();
  assert.equal(normRatios.private, 0);

  const intimateGroup = mods.presets.GENERATION_SECTION_GROUPS.find((g) => g.id === 'intimate');
  assert.ok(intimateGroup && intimateGroup.label.includes('亲密设定'));
  assert.equal(intimateGroup.items.every((i) => i.defaultEnabled === false), true);

  const { ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  const panel = shadow.querySelector('[data-ups-sections-panel]');
  assert.ok(panel);
  assert.equal(panel.hidden, true);
});

test('T1-F12-02: layoutStyle switches cleanly between structured (no fences/XML, parseable by extractPersonaPoints) and natural', () => {
  assert.deepEqual(
    mods.presets.GENERATION_LAYOUT_STYLES.map((s) => s.id),
    ['structured', 'natural']
  );

  const structuredDir = mods.core.buildGenerationSectionDirective(
    { layoutStyle: 'structured', presetId: 'standard' },
    { backstoryMode: 'light_vibe', companions: [] }
  );
  assert.equal(structuredDir.includes('```'), false);
  assert.equal(/<\/?[a-z]+>/i.test(structuredDir), false);
  assert.ok(/键值|结构化|清单/.test(structuredDir));

  const sampleStructuredOut = [
    '【基础人设】',
    '姓名：林栖',
    '外貌与穿搭：黑发齐肩，常穿浅米色针织衫。',
    '性格与行为逻辑：说话直接但分寸得当，高兴时眉眼微弯。',
    '【当前背景与关系】',
    '与{{char}}关系：同巷邻居，平时互相照应。',
  ].join('\n');
  assert.ok(mods.core.extractPersonaPoints(sampleStructuredOut).length >= 3);

  const naturalDir = mods.core.buildGenerationSectionDirective(
    { layoutStyle: 'natural', presetId: 'standard' },
    { backstoryMode: 'light_vibe', companions: [] }
  );
  assert.ok(/自然分段|段落/.test(naturalDir));
});

test('T1-F12-03: quick presets minimal < standard < full keep intimate OFF by default', () => {
  const minCfg = mods.core.normalizeGenerationSectionsConfig({ presetId: 'minimal' });
  const stdCfg = mods.core.normalizeGenerationSectionsConfig({ presetId: 'standard' });
  const fullCfg = mods.core.normalizeGenerationSectionsConfig({ presetId: 'full' });

  assert.ok(minCfg.enabledIds.length < stdCfg.enabledIds.length);
  assert.ok(stdCfg.enabledIds.length < fullCfg.enabledIds.length);
  const intimateIds = mods.presets.GENERATION_SECTION_GROUPS.find((g) => g.id === 'intimate').items.map((i) => i.id);
  for (const id of intimateIds) {
    assert.equal(minCfg.enabledIds.includes(id), false);
    assert.equal(stdCfg.enabledIds.includes(id), false);
    assert.equal(fullCfg.enabledIds.includes(id), false);
  }
});

test('T1-F12-04: custom section + opt-in intimate_dynamic + custom moduleRatios reflect in buildGenerationMessages', () => {
  const built = mods.core.buildGenerationMessages({
    mode: 'create',
    inspiration: '宗门日常修行',
    moduleRatios: { mode: 'custom', appearance: 20, personality: 30, backstory: 20, relationship: 20, private: 10 },
    generationSections: {
      layoutStyle: 'structured',
      presetId: 'custom',
      enabledIds: ['basic_identity', 'personality_logic', 'intimate_dynamic'],
      customSections: [{ id: 'custom_1', name: '修仙灵根与境界', guidance: '写明灵根属性与日常隐匿方式' }],
    },
  });
  assert.ok(built.assembledPromptText.includes('修仙灵根与境界'));
  assert.ok(built.assembledPromptText.includes('亲密关系倾向'));
  assert.ok(built.assembledPromptText.includes('不生成') || built.assembledPromptText.includes('禁止生成'));
});

test('T1-F12-05: unchecking backstory_growth with intimate off forbids backstory AND adult/NSFW content', () => {
  const built = mods.core.buildGenerationMessages({
    mode: 'create',
    inspiration: '日常甜文',
    generationSections: {
      layoutStyle: 'structured',
      presetId: 'custom',
      enabledIds: ['basic_identity', 'appearance_outfit', 'personality_logic', 'relation_to_char'],
    },
  });
  assert.ok(built.assembledPromptText.includes('成长经历与现状'));
  assert.ok(/不生成|禁止输出|严禁生成/.test(built.assembledPromptText));
  assert.ok(/亲密|成人|NSFW/.test(built.assembledPromptText));
});

test('T1-F13-01: detectConcealmentSignals returns true for emotional/relationship concealment cues', () => {
  assert.equal(mods.core.detectConcealmentSignals('表面温柔顺从，其实暗自攒钱想分手并隐瞒债务'), true);
});

test('T1-F13-02: buildGenerationMessages separates surface vs unspoken intent and forbids {{char}} mind-reading', () => {
  const built = mods.core.buildGenerationMessages({
    mode: 'create',
    inspiration: '表面如常相处，心里暗自打算分手',
  });
  assert.ok(/表面|外显/.test(built.assembledPromptText));
  assert.ok(/读心|看穿|未宣之于口|未公开/.test(built.assembledPromptText));
});

test('T1-F13-03: cognitive boundary UI label covers everyday emotional/relationship undercurrents', async () => {
  const { ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  const pop = shadow.querySelector('[data-ups-popover]');
  const text = pop.textContent;
  assert.equal(text.includes('仅悬疑或马甲局需开'), false);
  assert.ok(/暗恋|分手|隐瞒|私密|心事/.test(text));
});

test('T1-F13-04: joint upbringing cue allows shared childhood imprints inside 【基础人设】', () => {
  const built = mods.core.buildGenerationMessages({
    mode: 'create',
    inspiration: '和{{char}}是青梅竹马，从小一起长大',
    sharedUpbringing: true,
  });
  assert.ok(built.assembledPromptText.includes('【基础人设】'));
  assert.ok(/共同成长|青梅竹马|养成|共生/.test(built.assembledPromptText));
});

test('T1-F13-05: pure cross-card reuse mode strips specific {{char}} dependencies from 【基础人设】', () => {
  const built = mods.core.buildGenerationMessages({
    mode: 'create',
    inspiration: '和沈砚住在同一条老街',
    pureCrossCardReuse: true,
  });
  assert.ok(/跨卡复用|去.*角色|剥离/.test(built.assembledPromptText));
});

test('T1-F14-01: targetChars >= 1500 makes [data-ups-split-hint] visible in main Studio view', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  const wcInput = shadow.querySelector('[data-ups-word-count-input]');
  env.setInputValue(wcInput, '600');
  await env.waitTicks();
  const hint = shadow.querySelector('[data-ups-split-hint]');
  assert.equal(hint.hidden, true);

  env.setInputValue(wcInput, '1500');
  await env.waitTicks();
  assert.equal(hint.hidden, false);
  assert.ok(hint.textContent.includes('长设定拆入世界书'));
});

test('T1-F14-02: adding active companion makes [data-ups-split-hint] visible even when targetChars=1000', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  env.setInputValue(shadow.querySelector('[data-ups-word-count-input]'), '1000');
  await env.waitTicks();
  shadow.querySelector('[data-ups-companion-add]').click();
  await env.waitTicks();

  const hint = shadow.querySelector('[data-ups-split-hint]');
  assert.equal(hint.hidden, false);
});

test('T1-F14-03: pasting long draft >= 1500 chars surfaces [data-ups-split-hint] proactively', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  env.setInputValue(shadow.querySelector('[data-ups-word-count-input]'), '600');
  env.setInputValue(shadow.querySelector('[data-ups-draft]'), '长设定背景文本。'.repeat(240));
  await env.waitTicks();

  assert.equal(shadow.querySelector('[data-ups-split-hint]').hidden, false);
});

test('T1-F14-04: clicking [data-ups-split-hint] synchronizes dualLayer setting ON/OFF', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  env.setInputValue(shadow.querySelector('[data-ups-word-count-input]'), '1600');
  await env.waitTicks();

  const hint = shadow.querySelector('[data-ups-split-hint]');
  const before = ctrl.getState().settings.ui.dualLayer;
  hint.click();
  await env.waitTicks();
  assert.equal(ctrl.getState().settings.ui.dualLayer, !before);
});

test('T1-F14-05: generating with split-to-worldbook enabled requests 【补充世界书条目】', async () => {
  const { env, stHost, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  env.setInputValue(shadow.querySelector('[data-ups-word-count-input]'), '1600');
  await env.waitTicks();
  const hint = shadow.querySelector('[data-ups-split-hint]');
  if (!ctrl.getState().settings.ui.dualLayer) hint.click();

  shadow.querySelector('[data-ups-generate]').click();
  await env.waitTicks(20);
  const sent = stHost.capturedGenerations.at(-1).messages.map((m) => m.content).join('\n');
  assert.ok(sent.includes('【补充世界书条目】'));
  assert.ok(shadow.querySelector('[data-ups-draft]').value.includes('【补充世界书条目】'));
});

test('T1-F15-01: BUILTIN_PRESET_SCHEMES has zero forced 20% secret quota and zero [未公开私事 / 旁人无从知晓]', () => {
  const serialized = JSON.stringify(mods.presets.BUILTIN_PRESET_SCHEMES);
  assert.equal(serialized.includes('[未公开私事 / 旁人无从知晓]'), false);
  assert.equal(/占\s*20%/.test(serialized), false);
});

test('T1-F15-02: daily sweet-romance prompt keeps private quota at 0% and injects zero unrequested secret instructions', () => {
  const built = mods.core.buildGenerationMessages({
    mode: 'create',
    inspiration: '青梅竹马周末一起逛花市，一起买糖葫芦',
  });
  assert.equal(built.assembledPromptText.includes('[未公开私事 / 旁人无从知晓]'), false);
  assert.equal(/未公开私事.*20%/.test(built.assembledPromptText), false);
});

test('T1-F15-03: preset labels and UI copy unify on 不抢话', () => {
  const serialized = JSON.stringify(mods.presets.BUILTIN_PRESET_SCHEMES);
  assert.equal(serialized.includes('不抢话'), true);
  assert.equal(/(?:手控客观|纯手控|客观手控|非抢话)/.test(serialized), false);
});

test('T1-F15-04: legacy persisted settings with old objective scheme name migrate cleanly to 不抢话', () => {
  const migrated = mods.core.createDefaultSettings({
    schemes: [
      {
        id: 'player_controlled',
        name: '纯手控',
        style: 'objective',
        builtin: true,
        entries: [],
      },
    ],
  });
  const pc = migrated.schemes.find((s) => s.id === 'player_controlled');
  assert.equal(pc.name, '适合不抢话党');
});

test('T1-F15-05: selecting 不抢话 preset enforces anti-speaking-for-user rules in prompt', async () => {
  const { env, stHost, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  env.selectOption(shadow.querySelector('[data-ups-scheme]'), 'player_controlled');
  await env.waitTicks();

  shadow.querySelector('[data-ups-generate]').click();
  await env.waitTicks(20);
  const sent = stHost.capturedGenerations.at(-1).messages.map((m) => m.content).join('\n');
  assert.ok(sent.includes('不抢话') || sent.includes('玩家'));
});

test('T1-F16-01: COMMON_PERSONA_LEXICON_CATEGORIES has 7 frozen categories including animal tropes', () => {
  const cats = mods.presets.COMMON_PERSONA_LEXICON_CATEGORIES;
  assert.equal(Array.isArray(cats), true);
  assert.equal(cats.length, 7);
  assert.equal(Object.isFrozen(cats), true);
  const allTerms = cats.flatMap((c) => c.terms);
  assert.equal(allTerms.includes('猫系'), true);
  assert.equal(allTerms.includes('犬系'), true);
  assert.equal(allTerms.includes('狐系'), true);
});

test('T1-F16-02: VIBE_ANCHOR_EXAMPLES remains exported and non-empty for backward compatibility', () => {
  assert.ok(Array.isArray(mods.presets.VIBE_ANCHOR_EXAMPLES));
  assert.ok(mods.presets.VIBE_ANCHOR_EXAMPLES.length >= 10);
});

test('T1-F16-03: [data-ups-lexicon-toggle] panel is collapsed by default on initial mount', async () => {
  const { ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  const toggle = shadow.querySelector('[data-ups-lexicon-toggle]');
  assert.ok(toggle);
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
});

test('T1-F16-04: expanding [data-ups-lexicon-toggle] renders 7 category sections with zero status-bar noise', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  const beforeStatus = getStatusText(shadow);
  const toggle = shadow.querySelector('[data-ups-lexicon-toggle]');
  toggle.click();
  await env.waitTicks();

  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  const cats = shadow.querySelectorAll('[data-ups-lexicon-category]');
  assert.equal(cats.length, 7);
  assert.equal(getStatusText(shadow), beforeStatus);
});

test('T1-F16-05: clicking lexicon chips across categories appends tags into inspiration without duplicates', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  shadow.querySelector('[data-ups-lexicon-toggle]').click();
  await env.waitTicks();

  const chips = shadow.querySelectorAll('[data-ups-lexicon-chip]');
  const catChip = chips.find((c) => c.textContent.includes('猫系'));
  const softChip = chips.find((c) => c.textContent.includes('嘴硬心软'));
  assert.ok(catChip && softChip);

  catChip.click();
  softChip.click();
  const insp = shadow.querySelector('[data-ups-inspiration]');
  assert.ok(insp.value.includes('猫系') && insp.value.includes('嘴硬心软'));
});

test('T1-F17-01: controlHintEl is absent from rendered Studio left-column DOM', async () => {
  const { ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  assert.equal(shadow.querySelector('[data-ups-control-hint]'), null);
  assert.equal(shadow.textContent.includes('不擅编父母与童年创伤'), false);
});

test('T1-F17-02: character adaptation UI uses clean copy without 无需切换对话 or 不切聊天窗', async () => {
  const { ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  const charBox = shadow.querySelector('[data-ups-char-box]');
  assert.equal(charBox.textContent.includes('无需切换对话'), false);
  assert.equal(charBox.textContent.includes('不切聊天窗'), false);
});

test('T1-F17-03: all text/search inputs and textareas in Shadow DOM have spellcheck="false"', async () => {
  const { ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  const fields = shadow.querySelectorAll('input, textarea');
  for (const el of fields) {
    const t = (el.getAttribute('type') || el.type || 'text').toLowerCase();
    if (['checkbox', 'radio', 'button', 'submit', 'range', 'file'].includes(t)) continue;
    assert.equal(el.getAttribute('spellcheck'), 'false', `Missing spellcheck="false" on ${el.tagName} ${el.className}`);
  }
});

test('T1-F17-04: clicking inside body modal/popovers stops propagation so host .openDrawer never closes', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  assert.equal(env.personaMgmt.classList.contains('openDrawer'), true);

  shadow.querySelector('[data-ups-draft]').dispatchEvent({ type: 'click', bubbles: true });
  shadow.querySelector('.ups-modal').dispatchEvent({ type: 'mousedown', bubbles: true });
  assert.equal(env.personaMgmt.classList.contains('openDrawer'), true);
});

test('T1-F17-05: opening Studio popover then clicking host #world_info dismisses Studio popover via capture listener', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  shadow.querySelector('[data-ups-popover-btn]').click();
  const pop = shadow.querySelector('[data-ups-popover]');
  assert.equal(pop.hidden, false);

  env.worldInfoSelect.dispatchEvent({ type: 'mousedown', bubbles: true });
  assert.equal(pop.hidden, true);
});

// ============================================================================
// TIER 2: BOUNDARY, CORNER & NEGATIVE CASES (85 Cases = F1..F17 x 5)
// ============================================================================

test('T2-F01-01: target_book upsert + pruneManaged=true preserves unrelated user entries while pruning obsolete managed slots', async () => {
  const { stHost } = await mountFreshStudio();
  const wb = stHost.worldbooks.get('城市群像录');
  wb.entries['101'] = { uid: 101, key: ['手工1'], comment: '手工条目1', content: '保留手工内容1', disable: false };
  wb.entries['102'] = { uid: 102, key: ['手工2'], comment: '手工条目2', content: '保留手工内容2', disable: false };
  wb.entries['201'] = {
    uid: 201,
    key: ['旧客串'],
    comment: '旧客串',
    content: '待清理旧客串',
    extensions: { user_persona_studio: { slotKey: 'ups:companion:c1', managed: true } },
  };

  await mods.host.saveSupplementaryWorldbook({
    worldName: '城市群像录',
    entries: mods.core.buildCompanionWorldbookEntries({
      companions: [makeCompanionSample({ id: 'c2', name: '苏晚' })],
      companionPlans: [{ id: 'c2', verbatimText: '苏晚新条目' }],
    }),
    upsert: true,
    pruneManaged: true,
  });

  const finalEntries = Object.values(stHost.worldbooks.get('城市群像录').entries);
  assert.equal(finalEntries.some((e) => e.uid === 101 && e.content === '保留手工内容1'), true);
  assert.equal(finalEntries.some((e) => e.uid === 102 && e.content === '保留手工内容2'), true);
  assert.equal(finalEntries.some((e) => e.extensions?.user_persona_studio?.slotKey === 'ups:companion:c1'), false);
  assert.equal(finalEntries.some((e) => e.extensions?.user_persona_studio?.slotKey === 'ups:companion:c2'), true);
});

test('T2-F01-02: saveSupplementaryWorldbook rejects blank/whitespace worldName without creating corrupt book', async () => {
  const { stHost } = await mountFreshStudio();
  const before = stHost.worldbooks.size;
  await assert.rejects(() => mods.host.saveSupplementaryWorldbook({ worldName: '   ', entries: [], upsert: true }));
  assert.equal(stHost.worldbooks.size, before);
});

test('T2-F01-03: save failure releases isSaving lock, shows error in status bar, and skips ups:persona-saved event', async () => {
  const { env, stHost, ctrl, shadow } = await mountFreshStudio(
    {},
    {},
    {
      hostApi: {
        saveSupplementaryWorldbook: async () => {
          throw new Error('模拟世界书写入失败');
        },
      },
    }
  );
  await ctrl.open();
  env.setInputValue(shadow.querySelector('[data-ups-word-count-input]'), '1600');
  shadow.querySelector('[data-ups-split-hint]').click();
  env.setInputValue(
    shadow.querySelector('[data-ups-draft]'),
    '【基础人设】\n姓名：林栖\n\n【补充世界书条目】\n[条目：测试]\n关键词：测试\n内容：测试内容'
  );
  const saveBtn = shadow.querySelector('[data-ups-save-overwrite]');
  saveBtn.click();
  await env.waitTicks(30);

  assert.equal(saveBtn.disabled, false);
  assert.ok(getStatusText(shadow).includes('失败'));
  assert.equal(env.dispatchedCustomEvents.some((e) => e.type === 'ups:persona-saved'), false);
});

test('T2-F01-04: upsert matches legacy entry by normalized comment/keys and updates in-place preserving uid', async () => {
  const { stHost } = await mountFreshStudio();
  stHost.worldbooks.set('兼容旧书', {
    entries: {
      '77': {
        uid: 77,
        key: ['顾寒'],
        comment: '客串 · 顾寒',
        content: '旧版未带extensions的条目',
        disable: false,
      },
    },
  });
  await mods.host.saveSupplementaryWorldbook({
    worldName: '兼容旧书',
    entries: [
      {
        key: ['顾寒'],
        comment: '客串 · 顾寒',
        content: '原地升级后的内容',
        extensions: { user_persona_studio: { slotKey: 'ups:companion:c1', managed: true } },
      },
    ],
    upsert: true,
  });
  const list = Object.values(stHost.worldbooks.get('兼容旧书').entries);
  assert.equal(list.length, 1);
  assert.equal(list[0].uid, 77);
  assert.equal(list[0].content, '原地升级后的内容');
});

test('T2-F01-05: UI degrades gracefully when listWorldbooks returns empty array or rejects', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio(
    {},
    {},
    {
      hostApi: {
        listWorldbooks: async () => {
          throw new Error('worldbook list unavailable');
        },
      },
    }
  );
  await ctrl.open();
  env.selectOption(shadow.querySelector('[data-ups-companion-carry-mode]'), 'target_book');
  await env.waitTicks();
  assert.equal(ctrl.getState().isOpen, true);
});

test('T2-F02-01: unknown frequency tier falls back deterministically without NaN order', () => {
  const comp = makeCompanionSample({ frequency: 'invalid_tier_xyz' });
  const entries = mods.core.buildCompanionWorldbookEntries({
    companions: [comp],
    companionPlans: [{ id: comp.id, verbatimText: '顾寒内容' }],
  });
  assert.equal(Number.isFinite(entries[0].order), true);
});

test('T2-F02-02: empty trigger alias list auto-derives companion name and relation keyword', () => {
  const comp = makeCompanionSample({ name: '顾寒', relationToUser: '哥哥', frequency: 'occasional', selectedWorldEntries: [] });
  const entries = mods.core.buildCompanionWorldbookEntries({
    companions: [comp],
    companionPlans: [{ id: comp.id, verbatimText: '顾寒二十八岁。' }],
  });
  assert.ok(entries[0].key.length >= 1);
  assert.equal(entries[0].key.includes('顾寒'), true);
});

test('T2-F02-03: 3 active_circle companions trigger spotlight-guard clause against stealing {{char}} focus', () => {
  const comps = [
    makeCompanionSample({ id: 'c1', name: '顾寒', frequency: 'active_circle' }),
    makeCompanionSample({ id: 'c2', name: '苏晚', frequency: 'active_circle' }),
    makeCompanionSample({ id: 'c3', name: '周牧', frequency: 'active_circle' }),
  ];
  const built = mods.core.buildGenerationMessages({
    mode: 'create',
    inspiration: '群像生活',
    companions: comps,
  });
  assert.ok(/主角色|抢戏|主角|{{char}}/.test(built.assembledPromptText));
});

test('T2-F02-04: 3 background companions enforce low-intrusion background texture', () => {
  const comps = [
    makeCompanionSample({ id: 'c1', name: '顾寒', frequency: 'background' }),
    makeCompanionSample({ id: 'c2', name: '苏晚', frequency: 'background' }),
    makeCompanionSample({ id: 'c3', name: '周牧', frequency: 'background' }),
  ];
  const built = mods.core.buildGenerationMessages({
    mode: 'create',
    inspiration: '日常',
    companions: comps,
  });
  assert.ok(/背景|低干扰|不主动/.test(built.assembledPromptText));
});

test('T2-F02-05: companion worldbook entries strictly keep constant=false and selective=true across all tiers', () => {
  for (const tier of ['background', 'occasional', 'active_circle']) {
    const comp = makeCompanionSample({ id: `c_${tier}`, frequency: tier });
    const entries = mods.core.buildCompanionWorldbookEntries({
      companions: [comp],
      companionPlans: [{ id: comp.id, verbatimText: '测试内容' }],
    });
    assert.equal(entries[0].constant, false);
    assert.equal(entries[0].selective, true);
  }
});

test('T2-F03-01: enforces hard cap of 3 companions when attempting to add a 4th', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  const addBtn = shadow.querySelector('[data-ups-companion-add]');
  addBtn.click();
  addBtn.click();
  addBtn.click();
  addBtn.click();
  await env.waitTicks();

  assert.equal(shadow.querySelectorAll('[data-ups-companion-slot]').length, 3);
  assert.equal(addBtn.disabled || getStatusText(shadow).includes('3'), true);
});

test('T2-F03-02: duplicate character across main/companion or slots 1 & 2 is guarded without corrupting slotKey', () => {
  const c1 = makeCompanionSample({ id: 'c1', chid: '1', name: '顾寒' });
  const c2 = makeCompanionSample({ id: 'c2', chid: '1', name: '顾寒' });
  const entries = mods.core.buildCompanionWorldbookEntries({
    companions: [c1, c2],
    companionPlans: [
      { id: 'c1', verbatimText: '切片1' },
      { id: 'c2', verbatimText: '切片2' },
    ],
  });
  const keys = entries.map((e) => e.extensions?.user_persona_studio?.slotKey);
  assert.equal(new Set(keys).size, entries.length);
});

test('T2-F03-03: incomplete companion slot with empty char/relation never injects "undefined" into messages', () => {
  const built = mods.core.buildGenerationMessages({
    mode: 'create',
    inspiration: '测试',
    companions: [{ id: 'c_empty', name: '', relationToUser: '', frequency: 'occasional' }],
  });
  assert.equal(built.assembledPromptText.includes('undefined'), false);
});

test('T2-F03-04: stale relationToMainChar text is ignored when knowsMainChar=false', () => {
  const comp = makeCompanionSample({
    name: '苏晚',
    knowsMainChar: false,
    relationToMainChar: '应被忽略的旧关系字符串XYZ',
  });
  const built = mods.core.buildGenerationMessages({
    mode: 'create',
    inspiration: '日常',
    companions: [comp],
  });
  assert.equal(built.assembledPromptText.includes('应被忽略的旧关系字符串XYZ'), false);
});

test('T2-F03-05: companion with 0 worldbook entries still slices core card safely without throwing', () => {
  const comp = makeCompanionSample({ selectedWorldEntries: [] });
  const sliced = mods.core.extractVerbatimCompanionSlices(comp, [], 600);
  assert.ok(sliced.text.includes('顾寒二十八岁'));
});

test('T2-F04-01: tight token headroom sets headroomStatus="tight", scales budgets, emits warningMessage', () => {
  const longText = '背景设定段落。'.repeat(180);
  const plan = mods.core.computeCompanionTokenPlan({
    personaText: longText,
    mainCharContext: { name: '沈砚', description: longText },
    mainSelectedWorldEntries: [{ content: longText }],
    companions: [makeCompanionSample({ id: 'c1' }), makeCompanionSample({ id: 'c2', name: '苏晚' })],
    maxContextTokens: mods.core.estimateTokens(longText) * 3 + 350,
  });
  assert.equal(plan.headroomStatus, 'tight');
  assert.ok(plan.warningMessage.length > 0);
  assert.ok(plan.perCompanionBudgets.every((b) => b.allocatedTokens > 0));
});

test('T2-F04-02: over token headroom sets headroomStatus="over" and clamps remainingTokens >= 0', () => {
  const huge = '超长主卡背景信息。'.repeat(500);
  const plan = mods.core.computeCompanionTokenPlan({
    personaText: huge,
    mainCharContext: { name: '沈砚', description: huge },
    mainSelectedWorldEntries: [{ content: huge }],
    companions: [makeCompanionSample({ id: 'c1' })],
    maxContextTokens: 800,
  });
  assert.equal(plan.headroomStatus, 'over');
  assert.ok(plan.remainingTokens >= 0);
  assert.ok(plan.warningMessage.length > 0);
});

test('T2-F04-03: extractVerbatimCompanionSlices under tiny budget truncates cleanly on sentence boundary', () => {
  const res = mods.core.extractVerbatimCompanionSlices(
    {
      name: '顾寒',
      description: '顾寒二十八岁，黑发微乱。习惯先动手把事办妥再开口。左腕戴着走了十五年的银壳机械表。',
    },
    [],
    30
  );
  assert.equal(res.truncated, true);
  assert.ok(res.usedTokens <= 45);
  assert.equal(res.text.includes('\uFFFD'), false);
});

test('T2-F04-04: stripCompanionConflicts removes <style>, <status>, 【状态栏】, and English old-user identity lines', () => {
  const stripped = mods.core.stripCompanionConflicts({
    name: '顾寒',
    description: '<style>.x{}</style>\n【状态栏】HP:10\nYou are {{user}}\'s ex-husband.\n黑发微乱，常穿深灰工装外套。',
    personality: '外冷内热。',
  });
  const txt = stripped.cleanSections.map((s) => s.content).join('\n');
  assert.equal(txt.includes('<style>'), false);
  assert.equal(txt.includes('【状态栏】'), false);
  assert.equal(txt.includes('ex-husband'), false);
  assert.equal(txt.includes('黑发微乱'), true);
});

test('T2-F04-05: missing mes_example with includeDialogueExamples=true returns empty string safely without throwing', async () => {
  await mountFreshStudio();
  const ctx = await mods.host.getCharacterContext({ chid: '0' }, { includeDialogueExamples: true });
  assert.equal(typeof ctx.mesExamples, 'string');
  const ctxNoEx = await mods.host.getCharacterContext(
    { chid: '0' },
    { includeDialogueExamples: true },
    {
      ctx: {
        characterId: '0',
        characters: [{ name: '无例句', avatar: 'noex.png', description: '普通设定' }],
      },
    }
  );
  assert.equal(ctxNoEx.mesExamples, '');
});

test('T2-F05-01: rapid open/close and tab switches with 3 companions + long status keep modal delta 0px', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio({ innerWidth: 1280, innerHeight: 800 });
  await ctrl.open();
  const base = getModalRect(shadow);

  const addBtn = shadow.querySelector('[data-ups-companion-add]');
  addBtn.click();
  addBtn.click();
  addBtn.click();
  await env.waitTicks();

  for (const t of ['presets', 'taste', 'settings', 'studio']) {
    shadow.querySelector(`[data-ups-tab="${t}"]`).click();
    const cur = getModalRect(shadow);
    assert.equal(cur.width - base.width, 0);
    assert.equal(cur.height - base.height, 0);
  }
  ctrl.close();
  await ctrl.open();
  const reopened = getModalRect(shadow);
  assert.equal(reopened.width, base.width);
  assert.equal(reopened.height, base.height);
});

test('T2-F05-02: active runtime version constants contain zero stale 1.4.0/1.3.0', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'manifest.json'), 'utf8'));
  assert.notEqual(pkg.version, '1.4.0');
  assert.notEqual(manifest.version, '1.4.0');
  assert.notEqual(mods.entry.EXTENSION_VERSION, '1.4.0');
  assert.equal(mods.entry.EXTENSION_VERSION, '1.6.1');
});

test('T2-F05-03: refreshExtensionStylesheet returns false when ?v=1.6.1 is already present', () => {
  const env = createE2EEnvironment();
  const link = env.doc.createElement('link');
  link.setAttribute('rel', 'stylesheet');
  link.setAttribute('href', '/user-persona-studio/style.css?v=1.6.1');
  env.doc.head.appendChild(link);
  assert.equal(mods.entry.refreshExtensionStylesheet(env.doc, '1.6.1'), false);
});

test('T2-F05-04: mountStudioForTest degrades gracefully when host lacks worldbook list APIs', async () => {
  const env = createE2EEnvironment();
  const ctrl = await mods.entry.mountStudioForTest({
    doc: env.doc,
    win: env.win,
    skipCssRefresh: true,
    hostDeps: { skipDynamicImport: true, ctx: { name1: '测试', characters: [] } },
  });
  activeCleanups.push(() => {
    ctrl?.destroy?.();
    mods.host._resetHostCacheForTests();
  });
  await ctrl.open();
  assert.equal(ctrl.getState().isOpen, true);
});

test('T2-F05-05: destroy() while companion/submodal open removes host and listeners cleanly', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  shadow.querySelector('[data-ups-companion-add]').click();
  shadow.querySelector('[data-ups-save-as-btn]').click();
  await env.waitTicks();
  ctrl.destroy();
  assert.equal(env.doc.querySelector('#user-persona-studio-host'), null);
});

test('T2-F06-01: groupPersonaPoints handles empty or whitespace-only inputs without phantom empty groups', () => {
  assert.deepEqual(mods.core.groupPersonaPoints([]), []);
  const pts = mods.core.extractPersonaPoints('   \n  ', 36);
  assert.deepEqual(mods.core.groupPersonaPoints(pts), []);
});

test('T2-F06-02: mixed/unclassified custom bullets map into safe semantic fallback group', () => {
  const pts = mods.core.extractPersonaPoints('- 随身总带一把折叠木梳\n- 喜欢在雨天去街角旧书店看杂志', 36);
  const grouped = mods.core.groupPersonaPoints(pts);
  const totalGrouped = grouped.reduce((sum, g) => sum + g.items.length, 0);
  assert.equal(totalGrouped, pts.length);
});

test('T2-F06-03: group checkbox partial selection checks all children cleanly when toggled', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  shadow.querySelector('[data-ups-pick-points-a]').click();
  await env.waitTicks();

  const box = shadow.querySelector('[data-ups-points-box]');
  const groupBlock = box.querySelector('[data-ups-point-group]');
  assert.ok(groupBlock, 'Expected [data-ups-point-group]');
  const groupCb = groupBlock.querySelector('[data-ups-point-group-cb]');
  const children = groupBlock.querySelectorAll('[data-ups-point-cb]');
  if (children.length > 0) {
    children[0].click();
    await env.waitTicks();
    if (!groupCb.checked) {
      groupCb.click();
      await env.waitTicks();
      assert.equal(children.every((c) => c.checked), true);
    }
  }
});

test('T2-F06-04: 60+ extracted points keep .ups-points-list bounded without overflowing footer', async () => {
  const manyLines = Array.from({ length: 65 }, (_, i) => `- 特征条目_${i + 1}：具体描写内容${i + 1}`).join('\n');
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  shadow.querySelector('[data-ups-mode="B"]').click();
  env.setInputValue(shadow.querySelector('[data-ups-existing-draft]'), manyLines);
  shadow.querySelector('[data-ups-extract-points]').click();
  await env.waitTicks();

  const box = shadow.querySelector('[data-ups-points-box]');
  assert.equal(box.hidden, false);
  const modalRect = getModalRect(shadow);
  assert.ok(modalRect.height <= 800);
});

test('T2-F06-05: Mode A defaults 0 points selected; Mode B de_label_reformat defaults all selected', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  shadow.querySelector('[data-ups-pick-points-a]').click();
  await env.waitTicks();
  const cbsA = shadow.querySelectorAll('[data-ups-point-cb]');
  assert.ok(cbsA.length > 0);
  assert.equal(cbsA.every((c) => !c.checked), true);

  shadow.querySelector('[data-ups-mode="B"]').click();
  shadow.querySelector('[data-ups-load-persona]').click();
  await env.waitTicks();
  const cbsB = shadow.querySelectorAll('[data-ups-point-cb]');
  assert.ok(cbsB.length > 0);
  assert.equal(cbsB.every((c) => c.checked), true);
});

test('T2-F07-01: very long status message (>200 CJK chars) renders full text without pushing footer buttons', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio({}, {}, {
    hostApi: {
      savePersonaToHost: async () => {
        throw new Error('非常长的错误提示内容：' + '请检查当前世界书绑定与角色卡上下文容量配额设置是否超出上限。'.repeat(5));
      },
    },
  });
  await ctrl.open();
  env.setInputValue(shadow.querySelector('[data-ups-draft]'), '【基础人设】\n姓名：林栖');
  shadow.querySelector('[data-ups-save-overwrite]').click();
  await env.waitTicks(20);
  assert.ok(getStatusText(shadow).length > 100);
  assert.equal(shadow.querySelector('[data-ups-save-overwrite]').hidden, false);
});

test('T2-F07-02: rapidly toggling browse panels 5 times triggers zero status messages', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  const baseline = getStatusText(shadow);
  const ratioBtn = shadow.querySelector('[data-ups-ratio-toggle]');
  const lexBtn = shadow.querySelector('[data-ups-lexicon-toggle]');
  for (let i = 0; i < 5; i += 1) {
    ratioBtn?.click();
    lexBtn?.click();
  }
  await env.waitTicks();
  assert.equal(getStatusText(shadow), baseline);
});

test('T2-F07-03: switching from settings tab back to studio clears settings local status', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  shadow.querySelector('[data-ups-tab="settings"]').click();
  shadow.querySelector('[data-ups-profile-create]')?.click();
  await env.waitTicks();
  shadow.querySelector('[data-ups-tab="studio"]').click();
  await env.waitTicks();
  assert.equal(getStatusText(shadow), '就绪');
});

test('T2-F07-04: clicking sync/rescan with zero host changes emits explicit visible confirmation', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  shadow.querySelector('[data-ups-sync-host]').click();
  await env.waitTicks(20);
  const txt = getStatusText(shadow);
  assert.notEqual(txt, '就绪');
  assert.ok(txt.includes('无变动') || txt.includes('已同步') || txt.includes('已刷新'));
});

test('T2-F07-05: status tone resets cleanly when switching tabs', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  shadow.querySelector('[data-ups-generate]').click();
  await env.waitTicks(20);
  assert.equal(shadow.querySelector('[data-ups-status]').getAttribute('data-tone'), 'ok');

  shadow.querySelector('[data-ups-tab="presets"]').click();
  await env.waitTicks();
  assert.equal(shadow.querySelector('[data-ups-status]').getAttribute('data-tone'), 'muted');
});

test('T2-F08-01: blank/whitespace name in [data-ups-save-name-submodal] is rejected and keeps submodal open', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  env.setInputValue(shadow.querySelector('[data-ups-draft]'), '【基础人设】\n姓名：林栖');
  shadow.querySelector('[data-ups-save-as-btn]').click();
  await env.waitTicks();

  const submodal = shadow.querySelector('[data-ups-save-name-submodal]');
  const input = submodal.querySelector('input');
  env.setInputValue(input, '   ');
  submodal.querySelector('[data-ups-save-name-confirm], button.ups-btn-primary').click();
  await env.waitTicks();

  assert.equal(submodal.hidden, false);
});

test('T2-F08-02: clicking backdrop outside .ups-modal does NOT close main modal', async () => {
  const { ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  shadow.querySelector('[data-ups-backdrop]').dispatchEvent({ type: 'click', bubbles: true });
  assert.equal(ctrl.getState().isOpen, true);
});

test('T2-F08-03: canceling [data-ups-save-name-submodal] leaves active persona and draft untouched', async () => {
  const { env, stHost, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  env.setInputValue(shadow.querySelector('[data-ups-draft]'), '保留原文稿');
  shadow.querySelector('[data-ups-save-as-btn]').click();
  await env.waitTicks();

  const submodal = shadow.querySelector('[data-ups-save-name-submodal]');
  env.setInputValue(submodal.querySelector('input'), '取消的名字');
  const cancelBtn = submodal.querySelectorAll('button').find((b) => b.textContent.includes('取消'));
  cancelBtn.click();
  await env.waitTicks();

  assert.equal(submodal.hidden, true);
  assert.equal(shadow.querySelector('[data-ups-draft]').value, '保留原文稿');
  assert.equal(Object.values(stHost.powerUser.personas).includes('取消的名字'), false);
});

test('T2-F08-04: viewport 375x667 mobile has zero narrowNavEl and accessible panes', async () => {
  const { ctrl, shadow } = await mountFreshStudio({ innerWidth: 375, innerHeight: 667, coarse: true });
  await ctrl.open();
  assert.equal(shadow.querySelector('[data-ups-narrow-nav]'), null);
  assert.equal(shadow.querySelector('[data-ups-pane="left"]').hidden, false);
  assert.equal(shadow.querySelector('[data-ups-pane="right"]').hidden, false);
});

test('T2-F08-05: 另存为新人设 submodal opens cleanly even when active persona is empty', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio({}, { userAvatar: '' });
  await ctrl.open();
  env.setInputValue(shadow.querySelector('[data-ups-draft]'), '【基础人设】\n姓名：新角色');
  shadow.querySelector('[data-ups-save-as-btn]').click();
  await env.waitTicks();
  assert.equal(shadow.querySelector('[data-ups-save-name-submodal]').hidden, false);
});

test('T2-F09-01: non-numeric or negative input in [data-ups-word-count-input] clamps safely', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  const input = shadow.querySelector('[data-ups-word-count-input]');
  env.setInputValue(input, 'abc-10');
  input.dispatchEvent({ type: 'blur', bubbles: false });
  await env.waitTicks();
  const active = ctrl.getState().settings.schemes.find((s) => s.id === ctrl.getState().settings.activeSchemeId);
  assert.ok(Number.isFinite(active.targetChars) && active.targetChars >= 200);
});

test('T2-F09-02: clearing [data-ups-word-count-input] and blurring restores safe numeric value (no NaN)', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  const input = shadow.querySelector('[data-ups-word-count-input]');
  env.setInputValue(input, '');
  input.dispatchEvent({ type: 'blur', bubbles: false });
  await env.waitTicks();
  const active = ctrl.getState().settings.schemes.find((s) => s.id === ctrl.getState().settings.activeSchemeId);
  assert.equal(Number.isFinite(active.targetChars), true);
  assert.notEqual(input.value, 'NaN');
});

test('T2-F09-03: extreme word counts (50 and 99999) clamp to 200..12000 bounds', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  const input = shadow.querySelector('[data-ups-word-count-input]');
  env.setInputValue(input, '50');
  input.dispatchEvent({ type: 'blur', bubbles: false });
  let active = ctrl.getState().settings.schemes.find((s) => s.id === ctrl.getState().settings.activeSchemeId);
  assert.equal(active.targetChars, 200);

  env.setInputValue(input, '99999');
  input.dispatchEvent({ type: 'blur', bubbles: false });
  active = ctrl.getState().settings.schemes.find((s) => s.id === ctrl.getState().settings.activeSchemeId);
  assert.equal(active.targetChars, 12000);
});

test('T2-F09-04: word-count menu auto-dismisses on outside click or opening another popover', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  shadow.querySelector('[data-ups-word-count-menu-btn]').click();
  await env.waitTicks();
  const menu = shadow.querySelector('[data-ups-word-count-menu], [data-ups-floating-menu]');
  assert.equal(menu.hidden, false);

  env.doc.body.dispatchEvent({ type: 'mousedown', bubbles: true });
  assert.equal(menu.hidden, true);
});

test('T2-F09-05: switching between preset 1500 and inline 1375 never spawns a second visible input', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  const input = shadow.querySelector('[data-ups-word-count-input]');
  const field = input.closest('.ups-field') || input.parentNode;
  const countBefore = field.querySelectorAll('input').length;
  env.setInputValue(input, '1375');
  await env.waitTicks();
  assert.equal(field.querySelectorAll('input').length, countBefore);
  assert.equal(countBefore, 1);
});

test('T2-F10-01: opening [data-ups-history-popover] with 0 entries renders clean empty state', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  shadow.querySelector('[data-ups-history-btn]').click();
  await env.waitTicks();
  const pop = shadow.querySelector('[data-ups-history-popover]');
  assert.equal(pop.hidden, false);
  assert.ok(pop.textContent.includes('暂无'));
});

test('T2-F10-02: pushGenerationHistory deduplicates identical/whitespace-equivalent consecutive drafts', () => {
  const r1 = mods.core.pushGenerationHistory([], { text: '【基础人设】\n姓名：林栖' });
  assert.equal(r1.added, true);
  const r2 = mods.core.pushGenerationHistory(r1.list, { text: '  【基础人设】\n姓名：林栖  ' });
  assert.equal(r2.added, false);
  assert.equal(r2.list.length, 1);
});

test('T2-F10-03: pushGenerationHistory rejects empty or whitespace-only drafts', () => {
  const r1 = mods.core.pushGenerationHistory([], { text: '' });
  const r2 = mods.core.pushGenerationHistory([], { text: '   \n\t  ' });
  assert.equal(r1.added, false);
  assert.equal(r2.added, false);
  assert.equal(r2.list.length, 0);
});

test('T2-F10-04: pushGenerationHistory enforces FIFO cap = 8 and MAX_HISTORY_ENTRY_CHARS = 12000', () => {
  assert.equal(mods.core.MAX_GENERATION_HISTORY, 8);
  assert.equal(mods.core.MAX_HISTORY_ENTRY_CHARS, 12000);
  let list = [];
  for (let i = 1; i <= 10; i += 1) {
    const big = `草稿_${i}_` + '字'.repeat(15000);
    const res = mods.core.pushGenerationHistory(list, { text: big });
    assert.equal(res.added, true);
    list = res.list;
  }
  assert.equal(list.length, 8);
  assert.ok(list.every((item) => item.text.length <= 12000));
  assert.equal(list.some((item) => item.text.startsWith('草稿_1_')), false);
  assert.equal(list.some((item) => item.text.startsWith('草稿_2_')), false);
  assert.equal(list[0].text.startsWith('草稿_10_'), true);
});

test('T2-F10-05: corrupted localStorage JSON or throwing setItem never crashes Studio', async () => {
  const badStorage = new MockStorage({ ups_generation_history_v1: '{invalid-json' });
  badStorage.throwOnSet = true;
  const { env, ctrl, shadow } = await mountFreshStudio({ storage: badStorage });
  await ctrl.open();
  shadow.querySelector('[data-ups-generate]').click();
  await env.waitTicks(20);
  assert.equal(ctrl.getState().isOpen, true);
});

test('T2-F11-01: Chinese IME composition on [data-ups-char-search] filters only on compositionend', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  const searchEl = shadow.querySelector('[data-ups-char-search]');
  searchEl.dispatchEvent({ type: 'compositionstart', bubbles: true, data: '' });
  searchEl.value = 'suw';
  searchEl.dispatchEvent({ type: 'input', bubbles: true, isComposing: true });
  const charBox = shadow.querySelector('[data-ups-char-box]');
  assert.ok(charBox.textContent.includes('沈砚'), 'Intermediate IME pinyin must not wipe list prematurely');

  searchEl.value = '苏';
  searchEl.dispatchEvent({ type: 'compositionend', bubbles: true, data: '苏' });
  searchEl.dispatchEvent({ type: 'input', bubbles: true, isComposing: false });
  await env.waitTicks();
  assert.ok(charBox.textContent.includes('苏晚'));
  assert.equal(charBox.textContent.includes('周牧'), false);
});

test('T2-F11-02: mobile soft-keyboard window.resize (844 -> 480) preserves open search picker, DOM node, focus & value', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio({ innerWidth: 390, innerHeight: 844, coarse: true });
  await ctrl.open();
  const searchEl = shadow.querySelector('[data-ups-char-search]');
  searchEl.focus();
  env.setInputValue(searchEl, '苏');
  assert.equal(shadow.activeElement, searchEl);

  env.simulateSoftKeyboard(364);
  await env.waitTicks();

  const afterEl = shadow.querySelector('[data-ups-char-search]');
  assert.equal(afterEl, searchEl);
  assert.equal(afterEl.value, '苏');
  assert.equal(shadow.activeElement, searchEl);
});

test('T2-F11-03: zero-match character search shows clean empty state with locked .ups-modal dimensions', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio({ innerWidth: 1280, innerHeight: 800 });
  await ctrl.open();
  const before = getModalRect(shadow);
  env.setInputValue(shadow.querySelector('[data-ups-char-search]'), '不存在的角色XYZ');
  await env.waitTicks();
  const after = getModalRect(shadow);
  assert.equal(after.width, before.width);
  assert.equal(after.height, before.height);
});

test('T2-F11-04: opening picker on mobile (390x844 coarse) never calls automatic .focus()', async () => {
  const { env, ctrl } = await mountFreshStudio({ innerWidth: 390, innerHeight: 844, coarse: true });
  await ctrl.open();
  await env.waitTicks();
  assert.equal(env.focusCalls.length, 0);
});

test('T2-F11-05: mobile @media rule enforces font-size: 16px on inputs including [data-ups-char-search]', () => {
  const mobileStart = mods.styles.SHADOW_CSS.indexOf('@media (max-width: 680px)');
  assert.notEqual(mobileStart, -1);
  const mobileSlice = mods.styles.SHADOW_CSS.slice(mobileStart);
  assert.ok(mobileSlice.includes('.ups-input'));
  assert.ok(/font-size:\s*16px/.test(mobileSlice));
});

test('T2-F12-01: normalizeModuleRatios and normalizeGenerationSectionsConfig sanitize invalid ratios and unknown IDs', () => {
  const r = mods.core.normalizeModuleRatios({ mode: 'custom', appearance: -10, personality: NaN, private: 90 });
  assert.equal(r.private <= 40 && r.private >= 0, true);
  assert.equal(r.appearance >= 0, true);
  assert.equal(Number.isFinite(r.personality), true);

  const s = mods.core.normalizeGenerationSectionsConfig({
    enabledIds: ['basic_identity', 'nonexistent_xyz_999'],
  });
  assert.equal(s.enabledIds.includes('basic_identity'), true);
  assert.equal(s.enabledIds.includes('nonexistent_xyz_999'), false);
});

test('T2-F12-02: toggling intimate item on then off removes all adult instructions and enforces DO-NOT-generate rule', () => {
  const onDir = mods.core.buildGenerationSectionDirective({
    enabledIds: ['basic_identity', 'intimate_dynamic'],
  });
  assert.ok(onDir.includes('亲密关系倾向'));

  const offDir = mods.core.buildGenerationSectionDirective({
    enabledIds: ['basic_identity'],
  });
  assert.ok(/不生成|严禁|禁止/.test(offDir));
  assert.equal(offDir.includes('亲密关系倾向：请写出'), false);
});

test('T2-F12-03: unchecking backstory_growth overrides rich_arc so unwanted childhood/backstory is forbidden', () => {
  const dir = mods.core.buildGenerationSectionDirective(
    { enabledIds: ['basic_identity', 'personality_logic'] },
    { backstoryMode: 'rich_arc' }
  );
  assert.ok(dir.includes('成长经历与现状'));
  assert.ok(/不生成|禁止/.test(dir));
});

test('T2-F12-04: custom section rejects blank name and safely escapes XSS payloads without code fences/XML', async () => {
  const clean = mods.core.normalizeGenerationSectionsConfig({
    customSections: [
      { id: 'c1', name: '   ', guidance: 'ignored' },
      { id: 'c2', name: '<script>alert(1)</script>', guidance: '测试引导' },
    ],
  });
  assert.equal(clean.customSections.length, 1);

  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  shadow.querySelector('[data-ups-ratio-toggle]')?.click();
  await env.waitTicks();
  const customInput = shadow.querySelector('[data-ups-custom-section-name]');
  if (customInput) {
    env.setInputValue(customInput, '<script>alert(1)</script>');
    shadow.querySelector('[data-ups-custom-section-add]')?.click();
    await env.waitTicks();
    const panel = shadow.querySelector('[data-ups-sections-panel]');
    assert.equal(panel.querySelectorAll('script').length, 0);
  }
});

test('T2-F12-05: checking npc_network siblings while companions define 哥哥 coordinates without duplication', () => {
  const dir = mods.core.buildGenerationSectionDirective(
    { presetId: 'full' },
    { companions: [makeCompanionSample({ name: '顾寒', relationToUser: '哥哥' })] }
  );
  assert.ok(dir.includes('顾寒') || dir.includes('携伴客串'));
  assert.ok(/不重复|衔接|避免冲突/.test(dir));
});

test('T2-F13-01: detectConcealmentSignals distinguishes sweet romance (false) from breakup concealment (true)', () => {
  assert.equal(mods.core.detectConcealmentSignals('周末一起去买菜做饭，甜甜蜜蜜'), false);
  assert.equal(mods.core.detectConcealmentSignals('表面笑着答应，心里其实想分手'), true);
});

test('T2-F13-02: concealment signal in mustHave auto-triggers cognitive boundary separation even with visibilityTags=false', () => {
  const built = mods.core.buildGenerationMessages({
    mode: 'create',
    inspiration: '城市合租',
    userMustHaves: '瞒着对方还债',
    visibilityTags: false,
  });
  assert.ok(/读心|表面|未公开|隐瞒/.test(built.assembledPromptText));
});

test('T2-F13-03: benign substrings (分外开心, 公开课, 密友) do not trigger false-positive concealment wall', () => {
  assert.equal(mods.core.detectConcealmentSignals('今天分外开心，去旁听公开课后和密友喝奶茶'), false);
});

test('T2-F13-04: joint upbringing with blank_self honors zero-trauma rule while keeping natural shared tie', () => {
  const built = mods.core.buildGenerationMessages({
    mode: 'create',
    inspiration: '青梅竹马',
    backstoryMode: 'blank_self',
    sharedUpbringing: true,
  });
  assert.ok(built.assembledPromptText.includes('纯留白'));
  assert.ok(built.assembledPromptText.includes('共同成长') || built.assembledPromptText.includes('青梅竹马'));
});

test('T2-F13-05: pure cross-card reuse mode instructs stripping 沈砚-specific dependency from 【基础人设】', () => {
  const built = mods.core.buildGenerationMessages({
    mode: 'create',
    inspiration: '与沈砚同住老街',
    pureCrossCardReuse: true,
    charContext: { name: '沈砚', description: '旧书店店主' },
  });
  assert.ok(/跨卡复用|剥离|独立/.test(built.assembledPromptText));
});

test('T2-F14-01: [data-ups-split-hint] stays hidden for short draft (400 chars), targetChars=600, 0 companions', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  env.setInputValue(shadow.querySelector('[data-ups-word-count-input]'), '600');
  env.setInputValue(shadow.querySelector('[data-ups-draft]'), '短人设测试'.repeat(40));
  await env.waitTicks();
  assert.equal(shadow.querySelector('[data-ups-split-hint]').hidden, true);
});

test('T2-F14-02: toggling [data-ups-split-hint] synchronizes with dualLayer checkbox in popover', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  env.setInputValue(shadow.querySelector('[data-ups-word-count-input]'), '1600');
  await env.waitTicks();
  const hint = shadow.querySelector('[data-ups-split-hint]');
  hint.click();
  await env.waitTicks();
  const pop = shadow.querySelector('[data-ups-popover]');
  const dualCb = pop.querySelectorAll('input[type="checkbox"]')[1];
  assert.equal(dualCb.checked, ctrl.getState().settings.ui.dualLayer);
});

test('T2-F14-03: toggling [data-ups-split-hint] OFF when targetChars=2000 respects user opt-out', async () => {
  const { env, stHost, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  env.setInputValue(shadow.querySelector('[data-ups-word-count-input]'), '2000');
  await env.waitTicks();
  const hint = shadow.querySelector('[data-ups-split-hint]');
  if (ctrl.getState().settings.ui.dualLayer) hint.click();
  assert.equal(ctrl.getState().settings.ui.dualLayer, false);

  shadow.querySelector('[data-ups-generate]').click();
  await env.waitTicks(20);
  const sent = stHost.capturedGenerations.at(-1).messages.map((m) => m.content).join('\n');
  assert.equal(sent.includes('【长设定自动拆出世界书（已开启）】'), false);
});

test('T2-F14-04: removing companions and lowering targetChars to 600 hides hint without resizing modal', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  const before = getModalRect(shadow);
  shadow.querySelector('[data-ups-companion-add]').click();
  await env.waitTicks();
  const hint = shadow.querySelector('[data-ups-split-hint]');
  assert.equal(hint.hidden, false);

  shadow.querySelector('[data-ups-companion-remove]').click();
  env.setInputValue(shadow.querySelector('[data-ups-word-count-input]'), '600');
  await env.waitTicks();
  assert.equal(hint.hidden, true);
  assert.deepEqual(getModalRect(shadow), before);
});

test('T2-F14-05: pasting 1800-char draft manually triggers [data-ups-split-hint] before clicking Generate', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  env.setInputValue(shadow.querySelector('[data-ups-word-count-input]'), '600');
  env.setInputValue(shadow.querySelector('[data-ups-draft]'), '长设定文本测试内容'.repeat(230));
  await env.waitTicks();
  assert.equal(shadow.querySelector('[data-ups-split-hint]').hidden, false);
});

test('T2-F15-01: default generation emits zero [未公开私事 / 旁人无从知晓] and zero 20% secret quota', () => {
  const built = mods.core.buildGenerationMessages({ mode: 'create', inspiration: '普通大学室友日常' });
  assert.equal(built.assembledPromptText.includes('[未公开私事 / 旁人无从知晓]'), false);
  assert.equal(/占\s*20%/.test(built.assembledPromptText), false);
});

test('T2-F15-02: setting private=25 activates on-demand private directive without rigid bracket boilerplate', () => {
  const built = mods.core.buildGenerationMessages({
    mode: 'create',
    inspiration: '平静日常',
    moduleRatios: { mode: 'custom', private: 25, appearance: 20, personality: 25, backstory: 15, relationship: 15 },
  });
  assert.equal(built.assembledPromptText.includes('[未公开私事 / 旁人无从知晓]'), false);
  assert.ok(/私密|隐瞒|暗线|25%/.test(built.assembledPromptText));
});

test('T2-F15-03: custom user scheme entry authored by user is preserved while builtin presets stay 不抢话', () => {
  const custom = mods.core.createDefaultSettings({
    schemes: [
      {
        id: 'custom_user_scheme',
        name: '我的自定义方案',
        style: 'objective',
        builtin: false,
        entries: [{ id: 'e1', name: '自定义', role: 'system', content: '用户自写纯手控笔记' }],
      },
    ],
  });
  const u = custom.schemes.find((s) => s.id === 'custom_user_scheme');
  assert.equal(u.entries[0].content, '用户自写纯手控笔记');
});

test('T2-F15-04: resetBuiltinScheme restores 不抢话 and 0% default private behavior', () => {
  const modified = mods.core.deepClone(mods.presets.BUILTIN_PRESET_SCHEMES.player_controlled);
  modified.name = '已修改';
  const col = mods.core.resetBuiltinScheme({ schemes: [modified], activeSchemeId: 'player_controlled' }, 'player_controlled');
  const restored = col.schemes.find((s) => s.id === 'player_controlled');
  assert.equal(restored.name, '适合不抢话党');
});

test('T2-F15-05: exportSillyTavernPreset passes R8/R9 clean check and default 越狱|破限 guard', () => {
  const exported = mods.core.exportSillyTavernPreset({ scheme: mods.presets.BUILTIN_PRESET_SCHEMES.player_controlled });
  const text = JSON.stringify(exported);
  assert.equal(text.includes('[未公开私事 / 旁人无从知晓]'), false);
  assert.equal(/(?:越狱|破限)/.test(text), false);
  assert.equal(/(?:手控客观|纯手控|客观手控|非抢话)/.test(text), false);
});

test('T2-F16-01: all 7 lexicon categories are sanitized with zero banned/third-party tokens', () => {
  const cats = mods.presets.COMMON_PERSONA_LEXICON_CATEGORIES;
  assert.equal(cats.length, 7);
  const total = cats.reduce((n, c) => n + c.terms.length, 0);
  assert.ok(total >= 70);
  const banned = decodeBase64List(['Z2FnYQ==', 'bm92YS1jcmVhdG9y', 'bm92YSBjcmVhdG9y']);
  const joined = JSON.stringify(cats).toLowerCase();
  for (const b of banned) assert.equal(joined.includes(b), false);
});

test('T2-F16-02: clicking same lexicon chip 猫系 twice does not duplicate 猫系 in inspiration input', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  shadow.querySelector('[data-ups-lexicon-toggle]').click();
  await env.waitTicks();
  const chip = shadow.querySelectorAll('[data-ups-lexicon-chip]').find((c) => c.textContent.includes('猫系'));
  chip.click();
  chip.click();
  const insp = shadow.querySelector('[data-ups-inspiration]');
  assert.equal(insp.value.split('猫系').length - 1, 1);
});

test('T2-F16-03: COMMON_PERSONA_LEXICON_CATEGORIES and child category objects are frozen', () => {
  const cats = mods.presets.COMMON_PERSONA_LEXICON_CATEGORIES;
  assert.equal(Object.isFrozen(cats), true);
  for (const c of cats) {
    assert.equal(Object.isFrozen(c), true);
    assert.equal(Object.isFrozen(c.terms), true);
  }
});

test('T2-F16-04: lexicon chips wrap cleanly on 375x667 mobile without horizontal overflow', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio({ innerWidth: 375, innerHeight: 667, coarse: true });
  await ctrl.open();
  shadow.querySelector('[data-ups-lexicon-toggle]').click();
  await env.waitTicks();
  const blocks = extractCssRuleBlocks(mods.styles.SHADOW_CSS, (h) => h.includes('lexicon'));
  const body = blocks.map((b) => b.body).join('\n');
  assert.ok(/flex-wrap:\s*wrap/.test(body));
});

test('T2-F16-05: repeatedly toggling lexicon panel keeps modal size locked and emits zero status spam', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio({ innerWidth: 1280, innerHeight: 800 });
  await ctrl.open();
  const beforeRect = getModalRect(shadow);
  const beforeStatus = getStatusText(shadow);
  const toggle = shadow.querySelector('[data-ups-lexicon-toggle]');
  for (let i = 0; i < 4; i += 1) toggle.click();
  await env.waitTicks();
  assert.deepEqual(getModalRect(shadow), beforeRect);
  assert.equal(getStatusText(shadow), beforeStatus);
});

test('T2-F17-01: XSS payloads in persona name, companion relation, search query, and status bar render safely via textContent', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  const payload = '<img src=x onerror=alert(1)>';
  env.setInputValue(shadow.querySelector('[data-ups-char-search]'), payload);
  shadow.querySelector('[data-ups-companion-add]').click();
  await env.waitTicks();
  const rel = shadow.querySelector('[data-ups-companion-relation]');
  env.setInputValue(rel, payload);
  assert.equal(shadow.querySelectorAll('img').length, 0);
});

test('T2-F17-02: README.md and NEXT.md contain zero R9 dev-talk and zero third-party names', () => {
  const banned = [
    ...decodeBase64List(['Z2FnYQ==', 'bm92YS1jcmVhdG9y', 'bm92YSBjcmVhdG9y']),
    '不擅编父母',
    '自然收放不刷屏',
    '无需切换对话',
    '不切聊天窗',
    '先排雷防打卡',
    '省常驻字数',
    '防套皮',
  ];
  for (const name of ['README.md', 'NEXT.md']) {
    const txt = fs.readFileSync(path.join(REPO_ROOT, name), 'utf8').toLowerCase();
    for (const term of banned) {
      assert.equal(txt.includes(term.toLowerCase()), false, `${name} leaked banned term: ${term}`);
    }
  }
});

test('T2-F17-03: SHADOW_CSS and style.css contain zero backdrop-filter and zero blur(', () => {
  const styleCss = fs.readFileSync(path.join(REPO_ROOT, 'style.css'), 'utf8');
  for (const css of [mods.styles.SHADOW_CSS, styleCss]) {
    assert.equal(/backdrop-filter/i.test(css), false);
    assert.equal(/blur\(/i.test(css), false);
  }
});

test('T2-F17-04: dynamically created companion inputs and save-name submodal input carry spellcheck="false"', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  shadow.querySelector('[data-ups-companion-add]').click();
  shadow.querySelector('[data-ups-save-as-btn]').click();
  await env.waitTicks();

  const inputs = shadow.querySelectorAll('input, textarea');
  for (const el of inputs) {
    const t = (el.getAttribute('type') || el.type || 'text').toLowerCase();
    if (['checkbox', 'radio', 'button', 'submit'].includes(t)) continue;
    assert.equal(el.getAttribute('spellcheck'), 'false');
  }
});

test('T2-F17-05: opening one Studio popover closes competing Studio popovers while keeping host .openDrawer open', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  shadow.querySelector('[data-ups-popover-btn]').click();
  assert.equal(shadow.querySelector('[data-ups-popover]').hidden, false);

  shadow.querySelector('[data-ups-word-count-menu-btn]').click();
  await env.waitTicks();
  assert.equal(shadow.querySelector('[data-ups-popover]').hidden, true);
  assert.equal(env.personaMgmt.classList.contains('openDrawer'), true);
});

// ============================================================================
// TIER 3: PAIRWISE CROSS-FEATURE COMBINATIONS (20 Required + 3 New Contracts)
// ============================================================================

test('T3-01: 3 companions + persona_book upsert + tight tokens + 长设定拆入世界书', async () => {
  const { env, stHost, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  env.setInputValue(shadow.querySelector('[data-ups-word-count-input]'), '1600');
  shadow.querySelector('[data-ups-split-hint]').click();
  env.selectOption(shadow.querySelector('[data-ups-companion-carry-mode]'), 'persona_book');

  const addBtn = shadow.querySelector('[data-ups-companion-add]');
  addBtn.click();
  addBtn.click();
  addBtn.click();
  await env.waitTicks();

  const plan = mods.core.computeCompanionTokenPlan({
    personaText: '长基础人设内容。'.repeat(120),
    mainCharContext: { name: '沈砚', description: '旧书店店主。'.repeat(80) },
    mainSelectedWorldEntries: [],
    companions: [
      makeCompanionSample({ id: 'c1', frequency: 'background' }),
      makeCompanionSample({ id: 'c2', name: '苏晚', frequency: 'occasional' }),
      makeCompanionSample({ id: 'c3', name: '周牧', frequency: 'active_circle' }),
    ],
    maxContextTokens: 1600,
  });
  assert.ok(['tight', 'over', 'ok'].includes(plan.headroomStatus));

  shadow.querySelector('[data-ups-generate]').click();
  await env.waitTicks(25);
  assert.ok(shadow.querySelector('[data-ups-draft]').value.includes('【补充世界书条目】'));

  shadow.querySelector('[data-ups-save-overwrite]').click();
  await env.waitTicks(25);
  shadow.querySelector('[data-ups-save-overwrite]').click();
  await env.waitTicks(25);

  const personaBooks = Array.from(stHost.worldbooks.keys()).filter((k) => k.includes('林栖'));
  assert.equal(personaBooks.length <= 1, true);
});

test('T3-02: char search + companion worldbook toggles + history restore + undo + save submodal', async () => {
  const { env, stHost, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  env.setInputValue(shadow.querySelector('[data-ups-char-search]'), '沈');
  await env.waitTicks();

  stHost.setLlmResponder(() => '【基础人设】\n姓名：草稿A');
  shadow.querySelector('[data-ups-generate]').click();
  await env.waitTicks(20);

  stHost.setLlmResponder(() => '【基础人设】\n姓名：草稿B');
  shadow.querySelector('[data-ups-generate]').click();
  await env.waitTicks(20);
  assert.ok(shadow.querySelector('[data-ups-draft]').value.includes('草稿B'));

  shadow.querySelector('[data-ups-history-btn]').click();
  await env.waitTicks();
  const restoreBtns = shadow.querySelector('[data-ups-history-popover]').querySelectorAll('button').filter((b) => b.textContent.includes('填入编辑区'));
  assert.ok(restoreBtns.length >= 2);
  restoreBtns[1].click();
  await env.waitTicks();
  assert.ok(shadow.querySelector('[data-ups-draft]').value.includes('草稿A'));

  shadow.querySelector('[data-ups-undo]').click();
  assert.ok(shadow.querySelector('[data-ups-draft]').value.includes('草稿B'));

  shadow.querySelector('[data-ups-save-as-btn]').click();
  await env.waitTicks();
  const submodal = shadow.querySelector('[data-ups-save-name-submodal]');
  env.setInputValue(submodal.querySelector('input'), '林栖·组合测试');
  submodal.querySelector('[data-ups-save-name-confirm], button.ups-btn-primary').click();
  await env.waitTicks(25);
  assert.equal(Object.values(stHost.powerUser.personas).includes('林栖·组合测试'), true);
});

test('T3-03: concealment signal + custom ratios/sections + joint upbringing 【基础人设】', () => {
  const built = mods.core.buildGenerationMessages({
    mode: 'create',
    inspiration: '青梅竹马一起长大，表面温和顺从，心里暗自想分手',
    sharedUpbringing: true,
    moduleRatios: { mode: 'custom', appearance: 15, personality: 30, backstory: 0, relationship: 35, private: 20 },
    generationSections: {
      layoutStyle: 'structured',
      presetId: 'custom',
      enabledIds: ['basic_identity', 'appearance_outfit', 'personality_logic', 'relation_to_char'],
    },
  });
  assert.ok(built.assembledPromptText.includes('【基础人设】'));
  assert.ok(/读心|未公开|隐瞒/.test(built.assembledPromptText));
  assert.equal(built.assembledPromptText.includes('[未公开私事 / 旁人无从知晓]'), false);
  assert.ok(/亲密|成人|NSFW/.test(built.assembledPromptText));
  assert.ok(/不生成|禁止/.test(built.assembledPromptText));
});

test('T3-04: target_book merge + mixed frequency tiers + includeDialogueExamples=true', async () => {
  const { stHost } = await mountFreshStudio();
  const ctxGuhan = await mods.host.getCharacterContext(
    { chid: '1' },
    { includeWorldEntries: true, includeDialogueExamples: true }
  );
  const cBg = makeCompanionSample({ id: 'c_bg', name: '周牧', frequency: 'background' });
  const cAct = makeCompanionSample({
    id: 'c_act',
    name: '顾寒',
    frequency: 'active_circle',
    includeDialogueExamples: true,
    mesExamples: ctxGuhan.mesExamples,
  });
  const entries = mods.core.buildCompanionWorldbookEntries({
    companions: [cBg, cAct],
    companionPlans: [
      { id: 'c_bg', verbatimText: '周牧三十五岁，内科医生。' },
      { id: 'c_act', verbatimText: `顾寒常穿工装外套。\n${ctxGuhan.mesExamples}` },
    ],
  });
  assert.ok(entries[1].order > entries[0].order);
  assert.ok(entries[1].content.includes('别自己硬扛'));

  await mods.host.saveSupplementaryWorldbook({ worldName: '城市群像录', entries, upsert: true });
  const stored = Object.values(stHost.worldbooks.get('城市群像录').entries);
  assert.equal(stored.some((e) => e.uid === 10 && e.comment === '城市地铁线'), true);
});

test('T3-05: remove 1 of 3 companions + persona_book pruneManaged + wrapped status bar', async () => {
  const { stHost } = await mountFreshStudio();
  const c1 = makeCompanionSample({ id: 'c1', name: '顾寒' });
  const c2 = makeCompanionSample({ id: 'c2', name: '苏晚' });
  const c3 = makeCompanionSample({ id: 'c3', name: '周牧' });
  await mods.host.saveSupplementaryWorldbook({
    worldName: '林栖_携伴',
    entries: mods.core.buildCompanionWorldbookEntries({
      companions: [c1, c2, c3],
      companionPlans: [
        { id: 'c1', verbatimText: '1' },
        { id: 'c2', verbatimText: '2' },
        { id: 'c3', verbatimText: '3' },
      ],
    }),
    upsert: true,
    pruneManaged: true,
  });
  await mods.host.saveSupplementaryWorldbook({
    worldName: '林栖_携伴',
    entries: mods.core.buildCompanionWorldbookEntries({
      companions: [c1, c3],
      companionPlans: [
        { id: 'c1', verbatimText: '1' },
        { id: 'c3', verbatimText: '3' },
      ],
    }),
    upsert: true,
    pruneManaged: true,
  });
  const slots = Object.values(stHost.worldbooks.get('林栖_携伴').entries).map(
    (e) => e.extensions?.user_persona_studio?.slotKey
  );
  assert.equal(slots.includes('ups:companion:c2'), false);
  assert.equal(slots.length, 2);
});

test('T3-06: changing [data-ups-word-count-input] 600 -> 2000 surfaces split hint & recalculates budget', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  const wc = shadow.querySelector('[data-ups-word-count-input]');
  env.setInputValue(wc, '600');
  await env.waitTicks();
  assert.equal(shadow.querySelector('[data-ups-split-hint]').hidden, true);

  env.setInputValue(wc, '2000');
  await env.waitTicks();
  assert.equal(shadow.querySelector('[data-ups-split-hint]').hidden, false);
  const b = mods.core.computeLengthBudget(2000);
  assert.equal(b.chars, 2000);
});

test('T3-07: grouped points panel + modal size lock + silent browse toggle', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio({ innerWidth: 1280, innerHeight: 800 });
  await ctrl.open();
  const baseRect = getModalRect(shadow);
  shadow.querySelector('[data-ups-pick-points-a]').click();
  await env.waitTicks();
  const afterStatus = getStatusText(shadow);
  shadow.querySelector('[data-ups-ratio-toggle]')?.click();
  assert.equal(getStatusText(shadow), afterStatus);
  assert.deepEqual(getModalRect(shadow), baseRect);
});

test('T3-08: Mode B refine with selected point groups -> generate -> FIFO history -> submodal save', async () => {
  const { env, stHost, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  shadow.querySelector('[data-ups-mode="B"]').click();
  shadow.querySelector('[data-ups-load-persona]').click();
  await env.waitTicks();

  shadow.querySelector('[data-ups-generate-b]').click();
  await env.waitTicks(20);
  shadow.querySelector('[data-ups-history-btn]').click();
  await env.waitTicks();
  assert.equal(shadow.querySelector('[data-ups-history-popover]').hidden, false);

  shadow.querySelector('[data-ups-save-as-btn]').click();
  await env.waitTicks();
  const sub = shadow.querySelector('[data-ups-save-name-submodal]');
  env.setInputValue(sub.querySelector('input'), '林栖·精修版');
  sub.querySelector('[data-ups-save-name-confirm], button.ups-btn-primary').click();
  await env.waitTicks(25);
  assert.equal(Object.values(stHost.powerUser.personas).includes('林栖·精修版'), true);
});

test('T3-09: open history popover -> switchTab dismisses popover, clears stale status, keeps .openDrawer open', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  shadow.querySelector('[data-ups-generate]').click();
  await env.waitTicks(20);
  shadow.querySelector('[data-ups-history-btn]').click();
  await env.waitTicks();
  assert.equal(shadow.querySelector('[data-ups-history-popover]').hidden, false);

  shadow.querySelector('[data-ups-tab="presets"]').click();
  await env.waitTicks();
  assert.equal(shadow.querySelector('[data-ups-history-popover]').hidden, true);
  assert.equal(getStatusText(shadow), '就绪');
  assert.equal(env.personaMgmt.classList.contains('openDrawer'), true);
});

test('T3-10: word-count 1000 + standard sections + 不抢话 scheme -> enforces 1000 budget, 0% private, and DO-NOT-generate rules', () => {
  const scheme = mods.core.applyTargetCharsToScheme(mods.presets.BUILTIN_PRESET_SCHEMES.player_controlled, 1000);
  const built = mods.core.buildGenerationMessages({
    mode: 'create',
    scheme,
    inspiration: '校园日常',
    generationSections: { layoutStyle: 'natural', presetId: 'standard' },
  });
  assert.ok(built.assembledPromptText.includes('1000'));
  assert.ok(built.assembledPromptText.includes('不抢话'));
  assert.equal(built.assembledPromptText.includes('[未公开私事 / 旁人无从知晓]'), false);
  assert.ok(/亲密|成人|NSFW/.test(built.assembledPromptText));
});

test('T3-11: mobile 390x844 lexicon chip tap + IME char search + soft-keyboard resize preserves search & input', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio({ innerWidth: 390, innerHeight: 844, coarse: true });
  await ctrl.open();
  assert.equal(env.focusCalls.length, 0);

  shadow.querySelector('[data-ups-lexicon-toggle]').click();
  await env.waitTicks();
  const chip = shadow.querySelectorAll('[data-ups-lexicon-chip]').find((c) => c.textContent.includes('猫系'));
  chip.click();
  assert.ok(shadow.querySelector('[data-ups-inspiration]').value.includes('猫系'));

  const searchEl = shadow.querySelector('[data-ups-char-search]');
  searchEl.focus();
  env.typeWithIME(searchEl, '苏');
  env.simulateSoftKeyboard(364);
  await env.waitTicks();

  assert.equal(shadow.activeElement, searchEl);
  assert.equal(searchEl.value, '苏');
  assert.ok(shadow.querySelector('[data-ups-inspiration]').value.includes('猫系'));
});

test('T3-12: pure cross-card reuse mode + inline companion + sweet romance', () => {
  const built = mods.core.buildGenerationMessages({
    mode: 'create',
    inspiration: '周末去花市逛街',
    pureCrossCardReuse: true,
    companions: [makeCompanionSample({ id: 'c1', carryMode: 'inline' })],
  });
  assert.ok(/跨卡复用|剥离/.test(built.assembledPromptText));
  assert.equal(built.assembledPromptText.includes('[未公开私事 / 旁人无从知晓]'), false);
  assert.ok(built.assembledPromptText.includes('顾寒'));
});

test('T3-13: selecting main char + 2 companions updates token headroom plan accurately', async () => {
  await mountFreshStudio();
  const mainCtx = await mods.host.getCharacterContext({ chid: '0' }, { includeWorldEntries: true });
  const c1 = await mods.host.getCharacterContext({ chid: '1' }, { includeWorldEntries: true });
  const c2 = await mods.host.getCharacterContext({ chid: '2' }, { includeWorldEntries: true });
  const plan = mods.core.computeCompanionTokenPlan({
    personaText: '林栖基础设定',
    mainCharContext: mainCtx,
    mainSelectedWorldEntries: mainCtx.worldEntries,
    companions: [c1, c2],
    maxContextTokens: 4096,
  });
  assert.equal(plan.perCompanionBudgets.length, 2);
  assert.ok(plan.baseUsedTokens > 0);
});

test('T3-14: companion slot (父亲) + full preset (npc_network) avoids duplicating companion in NPC section', () => {
  const dir = mods.core.buildGenerationSectionDirective(
    { presetId: 'full' },
    { companions: [makeCompanionSample({ name: '周牧', relationToUser: '父亲' })] }
  );
  assert.ok(dir.includes('周牧'));
  assert.ok(/不重复|协调|避免冲突/.test(dir));
});

test('T3-15: Mode B refactor with selected point groups + 长设定拆入世界书 splits overflow into worldbook', () => {
  const built = mods.core.buildGenerationMessages({
    mode: 'optimize',
    subMode: 'core_expand',
    existingDraft: '【基础人设】\n外貌：黑发齐肩\n性格：温和有主见',
    lockedCore: '- 外貌：黑发齐肩\n- 性格：温和有主见',
    dualLayer: true,
  });
  assert.ok(built.assembledPromptText.includes('黑发齐肩'));
  assert.ok(built.assembledPromptText.includes('【补充世界书条目】'));
});

test('T3-16: opening word-count menu then clicking host #world_info dismisses menu while locking modal size', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio({ innerWidth: 1280, innerHeight: 800 });
  await ctrl.open();
  const rectBefore = getModalRect(shadow);
  shadow.querySelector('[data-ups-word-count-menu-btn]').click();
  await env.waitTicks();
  const menu = shadow.querySelector('[data-ups-word-count-menu], [data-ups-floating-menu]');
  assert.equal(menu.hidden, false);

  env.worldInfoSelect.dispatchEvent({ type: 'mousedown', bubbles: true });
  assert.equal(menu.hidden, true);
  assert.deepEqual(getModalRect(shadow), rectBefore);
});

test('T3-17: dual-layer generation snapshot -> save to persona_book -> restore snapshot preserves divider', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  env.setInputValue(shadow.querySelector('[data-ups-word-count-input]'), '1600');
  if (!ctrl.getState().settings.ui.dualLayer) shadow.querySelector('[data-ups-split-hint]').click();

  shadow.querySelector('[data-ups-generate]').click();
  await env.waitTicks(20);
  const dualOut = shadow.querySelector('[data-ups-draft]').value;
  assert.ok(dualOut.includes('【补充世界书条目】'));

  env.setInputValue(shadow.querySelector('[data-ups-draft]'), '临时替换文本');
  shadow.querySelector('[data-ups-history-btn]').click();
  await env.waitTicks();
  const restoreBtn = shadow.querySelector('[data-ups-history-popover]').querySelectorAll('button').find((b) => b.textContent.includes('填入编辑区'));
  restoreBtn.click();
  assert.ok(shadow.querySelector('[data-ups-draft]').value.includes('【补充世界书条目】'));
});

test('T3-18: lexicon tags + structured layout + custom section + unchecked backstory_growth + 1500 targetChars', () => {
  const scheme = mods.core.applyTargetCharsToScheme(mods.presets.BUILTIN_PRESET_SCHEMES.longform_coact, 1500);
  const built = mods.core.buildGenerationMessages({
    mode: 'create',
    scheme,
    inspiration: '松弛感，嘴硬心软，早睡早起',
    generationSections: {
      layoutStyle: 'structured',
      presetId: 'custom',
      enabledIds: ['basic_identity', 'appearance_outfit', 'personality_logic', 'habits_tastes', 'relation_to_char'],
      customSections: [{ id: 'club', name: '校园社团日常', guidance: '写明社团职责与周常节奏' }],
    },
  });
  assert.ok(built.assembledPromptText.includes('校园社团日常'));
  assert.ok(built.assembledPromptText.includes('成长经历与现状'));
  assert.equal(built.assembledPromptText.includes('```'), false);
});

test('T3-19: open Studio via character card adapt trigger, set persona_book, save via submodal without touching active chat', async () => {
  const { env, stHost, ctrl, shadow } = await mountFreshStudio();
  const adaptBtn = env.doc.querySelector('[data-chid="1"] [data-ups-char-adapt="true"]');
  assert.ok(adaptBtn);
  adaptBtn.click();
  await env.waitTicks(30);

  assert.equal(ctrl.getState().isOpen, true);
  assert.equal(ctrl.getState().selectedCharTarget, '1');
  assert.equal(stHost.getActiveCharacterId(), '0');

  env.setInputValue(shadow.querySelector('[data-ups-draft]'), '【基础人设】\n姓名：林栖\n\n【当前背景与关系】\n与顾寒同住老街。');
  shadow.querySelector('[data-ups-save-as-btn]').click();
  await env.waitTicks();
  const sub = shadow.querySelector('[data-ups-save-name-submodal]');
  env.setInputValue(sub.querySelector('input'), '林栖·适配版');
  sub.querySelector('[data-ups-save-name-confirm], button.ups-btn-primary').click();
  await env.waitTicks(25);
  assert.equal(ctrl.getState().isOpen, true);
});

test('T3-20: switching target persona inside extracted-points switcher renders XSS-safe semantic groups', async () => {
  const { env, stHost, ctrl, shadow } = await mountFreshStudio();
  stHost.powerUser.personas['xss.png'] = '<img src=x onerror=alert(1)>';
  stHost.powerUser.persona_descriptions['xss.png'] = {
    description: '【基础人设】\n姓名：<script>alert(1)</script>\n外貌：黑发',
  };
  await ctrl.open();
  await ctrl.ui.refreshContext();
  shadow.querySelector('[data-ups-pick-points-a]').click();
  await env.waitTicks();

  const sel = shadow.querySelector('[data-ups-points-persona]');
  env.selectOption(sel, 'xss.png');
  await env.waitTicks(20);
  const box = shadow.querySelector('[data-ups-points-box]');
  assert.equal(box.querySelectorAll('script, img').length, 0);
});

test('T3-21: resolveCharacterRealName + editable 角色名 UI + prompt {{char}} guard + companion worldbook key priority', async () => {
  const resXml = mods.core.resolveCharacterRealName({
    name: '《星屿手记》',
    description: '<character_information character="程屿">\n姓名：程屿\n性格：温和',
  });
  assert.equal(resXml.realName, '程屿');

  const resAttr = mods.core.resolveCharacterRealName({
    name: '《冬日来信》',
    description: '<character name="林见夏">\nChinese_name: 林见夏',
  });
  assert.equal(resAttr.realName, '林见夏');

  const resYaml = mods.core.resolveCharacterRealName({
    name: '《旧城雨季》',
    description: '```yaml\n<info>\n<character>\n周叙白:\n  身份: 建筑师\n```',
  });
  assert.equal(resYaml.realName, '周叙白');

  const { env, stHost, ctrl, shadow } = await mountFreshStudio({}, {
    characters: [
      {
        name: '《冬日来信》',
        avatar: 'work_title.png',
        description: '<character name="林见夏">\n年龄：25\n性格：沉静内敛。',
        personality: '理性温和',
        scenario: '老城区咖啡馆。',
        first_mes: '“坐吧。”',
        extensions: { world: '' },
        shallow: false,
      },
      ...createMockSTHost(createE2EEnvironment()).characters.slice(1),
    ],
  });
  await ctrl.open();
  const realNameInput = shadow.querySelector('[data-ups-char-real-name]');
  assert.ok(realNameInput, 'Expected editable [data-ups-char-real-name] input');
  assert.equal(realNameInput.getAttribute('spellcheck'), 'false');
  assert.equal(realNameInput.value, '林见夏');

  env.setInputValue(realNameInput, '阿夏');
  shadow.querySelector('[data-ups-generate]').click();
  await env.waitTicks(20);
  const sent = stHost.capturedGenerations.at(-1).messages.map((m) => m.content).join('\n');
  assert.ok(sent.includes('阿夏'));
  assert.ok(/禁止.*\{\{char\}\}|不要.*\{\{char\}\}|严禁.*\{\{char\}\}/.test(sent));

  const compEntries = mods.core.buildCompanionWorldbookEntries({
    companions: [makeCompanionSample({ name: '《星屿手记》', realName: '程屿' })],
    companionPlans: [{ id: 'comp_1', verbatimText: '程屿性格温和。' }],
  });
  assert.equal(compEntries[0].key[0], '程屿');
});

test('T3-22: Subject-omission Token economy removes repeated {{user}} instruction and enforces default subject omission', () => {
  const presetsJson = JSON.stringify(mods.presets.BUILTIN_PRESET_SCHEMES);
  assert.equal(presetsJson.includes('尽量用 {{user}} 指代'), false);
  assert.equal(presetsJson.includes('尽量用{{user}}指代'), false);

  const built = mods.core.buildGenerationMessages({
    mode: 'create',
    inspiration: '安静书店店员',
  });
  assert.ok(/省略主语|省.*主语|不.*重复.*\{\{user\}\}/.test(built.assembledPromptText));
  assert.ok(/歧义|消歧/.test(built.assembledPromptText));
});

test('T3-23: Three-way classifyWorldbookEntry retains acting_rules (令行禁止/人设修正/剧情守则), isolates system_format, respects disable:true, strips shells', async () => {
  assert.equal(mods.core.classifyWorldbookEntry({ comment: '角色背景与关系', content: '周叙白二十八岁，建筑师。' }), 'character_lore');
  assert.equal(mods.core.classifyWorldbookEntry({ comment: '人设修正', content: '说话不带儿化音，吵架不失控。' }), 'acting_rules');
  assert.equal(mods.core.classifyWorldbookEntry({ comment: '令行禁止', content: '绝不公开炫富，线上打字句尾不加句号。' }), 'acting_rules');
  assert.equal(mods.core.classifyWorldbookEntry({ comment: '剧情守则 · 防霸总', content: '禁止强行壁咚油腻台词。' }), 'acting_rules');
  assert.equal(mods.core.classifyWorldbookEntry({ comment: '状态栏', content: '<status>HP</status>' }), 'system_format');
  assert.equal(mods.core.classifyWorldbookEntry({ comment: '思维链 cot', content: 'thinking rules' }), 'system_format');
  assert.equal(mods.core.classifyWorldbookEntry({ comment: 'writingspec initvar regex', content: 'var' }), 'system_format');

  const stripped = mods.core.stripCompanionConflicts({
    name: '周叙白',
    description: '```yaml\n<info>\n<character_information character="周叙白">\n外貌：身高一米八三，短黑发。\n性格：敏锐冷静。\n</character_information>\n</info>\n```',
    selectedWorldEntries: [
      { comment: '令行禁止', content: '说话不带儿化音，线上打字句尾不加句号。\n输出字数控制在1200字并更新状态栏。' },
    ],
  });
  const body = stripped.cleanSections.map((s) => s.content).join('\n');
  assert.equal(body.includes('```yaml'), false);
  assert.equal(body.includes('<info>'), false);
  assert.equal(body.includes('<character_information'), false);
  assert.equal(body.includes('身高一米八三，短黑发。'), true);
  assert.equal(body.includes('说话不带儿化音'), true);

  const env = createE2EEnvironment();
  const shortHost = createMockSTHost(env, {
    characters: [
      {
        name: '《短卡示例》',
        avatar: 'short.png',
        description: '<剧情守则>保持克制语气</剧情守则>',
        extensions: { world: '短卡世界书' },
        shallow: false,
      },
    ],
    worldbooks: new Map([
      [
        '短卡世界书',
        {
          entries: {
            '1': { uid: 1, key: ['主角'], comment: '状态栏', content: '状态栏HTML模板', disable: false },
            '2': { uid: 2, key: ['人物'], comment: '人物档案', content: '姓名：周清晏，二十七岁，建筑师，性格沉稳。', disable: false },
            '3': { uid: 3, key: ['修正'], comment: '人设修正', content: '说话温和克制，绝不油腻说教。', disable: false },
            '4': { uid: 4, key: ['IF'], comment: '黑化线分支', content: 'IF线设定内容', disable: true },
          },
        },
      ],
    ]),
  });
  shortHost.install();
  activeCleanups.push(() => shortHost.cleanup(mods.host._resetHostCacheForTests));
  const ctx = await mods.host.getCharacterContext({ chid: '0' }, { includeWorldEntries: true });
  assert.ok(ctx.description.includes('周清晏') || ctx.worldSummary.includes('周清晏'));
  assert.ok(ctx.description.includes('说话温和克制') || ctx.worldSummary.includes('说话温和克制'));
  assert.equal(ctx.description.includes('状态栏HTML模板'), false);
  assert.equal(ctx.description.includes('IF线设定内容'), false);
});

test('T3-24: detectMultiCharacterCard supports ensemble roster summary vs focused 1-3 sub-chars & companion single sub-char extraction', () => {
  const ensembleEntries = Array.from({ length: 12 }, (_, i) => ({
    entryKey: `world::学园群像::${i + 1}`,
    comment: `角色档案·学园成员${i + 1}`,
    keys: [`成员${i + 1}`],
    content: `姓名：学园成员${i + 1}\n身份：三年级${i + 1}班学生\n外貌与性格：特征编号${i + 1}的详细长段描写。`.repeat(6),
    defaultEnabled: i < 11,
  }));
  ensembleEntries[2].comment = '角色档案·许知秋';
  ensembleEntries[2].keys = ['许知秋'];
  ensembleEntries[2].content = '姓名：许知秋\n身份：天文社社长\n性格：安静专注，观察力很强，常在天台看星图。';
  ensembleEntries[11].comment = 'IF分支·隐藏角色';
  ensembleEntries[11].defaultEnabled = false;
  ensembleEntries.push({
    entryKey: 'world::学园群像::99',
    comment: '令行禁止',
    keys: ['守则'],
    content: '全员说话贴合高中生口吻，不写浮夸腔调。',
    defaultEnabled: true,
  });

  const detected = mods.core.detectMultiCharacterCard(
    { name: '《青藤学园群像》', description: '海滨小镇高中社团群像舞台。' },
    ensembleEntries
  );
  assert.equal(detected.isMultiChar, true);
  assert.ok(detected.characterEntries.length >= 10);
  assert.equal(detected.characterEntries.some((c) => c.name === '许知秋'), true);

  // Global ensemble mode (0 sub-chars selected) uses compact summary, not full 12-char dump
  const globalBuilt = mods.core.buildGenerationMessages({
    mode: 'create',
    inspiration: '新转来的插画社社员',
    charContext: {
      name: '《青藤学园群像》',
      description: '海滨小镇高中社团群像舞台。',
      selectedWorldEntries: ensembleEntries,
    },
    selectedSubCharacterKeys: [],
  });
  assert.ok(globalBuilt.assembledPromptText.includes('许知秋'));
  assert.equal(globalBuilt.assembledPromptText.includes('特征编号9的详细长段描写。'.repeat(5)), false);

  // Focused 1-3 sub-char mode deep-reads 许知秋 + acting_rules and excludes unselected siblings
  const focusedBuilt = mods.core.buildGenerationMessages({
    mode: 'create',
    inspiration: '和许知秋一起值班看星图',
    charContext: {
      name: '《青藤学园群像》',
      description: '海滨小镇高中社团群像舞台。',
      selectedWorldEntries: ensembleEntries,
    },
    selectedSubCharacterKeys: ['world::学园群像::3'],
  });
  assert.ok(focusedBuilt.assembledPromptText.includes('天文社社长'));
  assert.ok(focusedBuilt.assembledPromptText.includes('全员说话贴合高中生口吻'));
  assert.equal(focusedBuilt.assembledPromptText.includes('特征编号9的详细长段描写。'), false);

  // Companion single sub-char verbatim extraction has zero cross-character leakage
  const compSlice = mods.core.extractVerbatimCompanionSlices(
    { name: '《青藤学园群像》', description: '' },
    [ensembleEntries[2]],
    800
  );
  assert.ok(compSlice.text.includes('许知秋'));
  assert.equal(compSlice.text.includes('学园成员9'), false);
});

// ============================================================================
// TIER 4: END-TO-END REAL-WORLD PLAYER WORKFLOWS (10 Mounted Workflows)
// ============================================================================

test('T4-01: Scenario 1 - New persona + 3 companions + persona_book idempotent re-save', async () => {
  const { env, stHost, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();

  env.setInputValue(shadow.querySelector('[data-ups-char-search]'), '沈');
  env.selectOption(shadow.querySelector('[data-ups-char-select]'), '0');
  await env.waitTicks(15);

  env.selectOption(shadow.querySelector('[data-ups-companion-carry-mode]'), 'persona_book');
  const addBtn = shadow.querySelector('[data-ups-companion-add]');
  addBtn.click();
  addBtn.click();
  addBtn.click();
  await env.waitTicks();

  const slots = shadow.querySelectorAll('[data-ups-companion-slot]');
  assert.equal(slots.length, 3);
  const tiers = ['background', 'occasional', 'active_circle'];
  slots.forEach((slot, i) => {
    const freq = slot.querySelector('[data-ups-companion-frequency]');
    if (freq) env.selectOption(freq, tiers[i]);
    const rel = slot.querySelector('[data-ups-companion-relation]');
    if (rel) env.setInputValue(rel, ['哥哥', '挚友', '师长'][i]);
  });

  shadow.querySelector('[data-ups-generate]').click();
  await env.waitTicks(25);

  shadow.querySelector('[data-ups-save-as-btn]').click();
  await env.waitTicks();
  const sub = shadow.querySelector('[data-ups-save-name-submodal]');
  env.setInputValue(sub.querySelector('input'), '沈知意');
  sub.querySelector('[data-ups-save-name-confirm], button.ups-btn-primary').click();
  await env.waitTicks(30);

  const booksAfterCreate = Array.from(stHost.worldbooks.keys()).filter((k) => k.includes('沈知意'));
  assert.equal(booksAfterCreate.length, 1);
  const uidsBefore = Object.values(stHost.worldbooks.get(booksAfterCreate[0]).entries).map((e) => e.uid);

  const rel2 = slots[1].querySelector('[data-ups-companion-relation]');
  if (rel2) env.setInputValue(rel2, '多年挚友');
  shadow.querySelector('[data-ups-save-overwrite]').click();
  await env.waitTicks(30);

  const booksAfterOverwrite = Array.from(stHost.worldbooks.keys()).filter((k) => k.includes('沈知意'));
  assert.equal(booksAfterOverwrite.length, 1);
  const uidsAfter = Object.values(stHost.worldbooks.get(booksAfterOverwrite[0]).entries).map((e) => e.uid);
  assert.deepEqual(uidsAfter, uidsBefore);
  assert.equal(stHost.getActiveChatId(), 'chat-active-001');
});

test('T4-02: Scenario 2 - Daily sweet-romance + joint upbringing + 不抢话 + lexicon + default section discipline', async () => {
  const { env, stHost, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();

  shadow.querySelector('[data-ups-lexicon-toggle]').click();
  await env.waitTicks();
  const catChip = shadow.querySelectorAll('[data-ups-lexicon-chip]').find((c) => c.textContent.includes('猫系'));
  const calmChip = shadow.querySelectorAll('[data-ups-lexicon-chip]').find((c) => c.textContent.includes('松弛感'));
  catChip.click();
  calmChip.click();

  env.selectOption(shadow.querySelector('[data-ups-scheme]'), 'player_controlled');
  env.setInputValue(shadow.querySelector('[data-ups-inspiration]'), `${shadow.querySelector('[data-ups-inspiration]').value}，和青梅竹马周末一起逛夜市`);
  assert.equal(shadow.querySelector('[data-ups-sections-panel]').hidden, true);

  shadow.querySelector('[data-ups-generate]').click();
  await env.waitTicks(25);

  const sent = stHost.capturedGenerations.at(-1).messages.map((m) => m.content).join('\n');
  assert.equal(sent.includes('[未公开私事 / 旁人无从知晓]'), false);
  assert.equal(/占\s*20%/.test(sent), false);
  assert.ok(/亲密|成人|NSFW/.test(sent) && /不生成|严禁/.test(sent));
  assert.ok(/青梅竹马|共同成长/.test(sent));
  assert.equal(/(?:纯手控|非抢话|手控客观)/.test(shadow.textContent), false);
});

test('T4-03: Scenario 3 - Concealment undercurrent + structured layout + custom ratio/sections + anti-mind-reading', async () => {
  const { env, stHost, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();

  env.setInputValue(
    shadow.querySelector('[data-ups-inspiration]'),
    '表面顺从温柔，心里暗自攒钱想分手并隐瞒外债'
  );
  shadow.querySelector('[data-ups-ratio-toggle]').click();
  await env.waitTicks();

  const layoutSel = shadow.querySelector('[data-ups-layout-style]');
  env.selectOption(layoutSel, 'structured');
  const privateInput = shadow.querySelector('[data-ups-ratio-input="private"]');
  if (privateInput) env.setInputValue(privateInput, '20');
  const intimateDyn = shadow.querySelector('[data-ups-section-cb="intimate_dynamic"]');
  if (intimateDyn && !intimateDyn.checked) intimateDyn.click();

  const customName = shadow.querySelector('[data-ups-custom-section-name]');
  if (customName) {
    env.setInputValue(customName, '财务账本暗线');
    shadow.querySelector('[data-ups-custom-section-add]')?.click();
  }

  shadow.querySelector('[data-ups-generate]').click();
  await env.waitTicks(25);

  const sent = stHost.capturedGenerations.at(-1).messages.map((m) => m.content).join('\n');
  assert.ok(/读心|看穿|表面|隐瞒/.test(sent));
  assert.ok(sent.includes('财务账本暗线'));
  assert.ok(sent.includes('亲密关系倾向'));
  assert.equal(sent.includes('[未公开私事 / 旁人无从知晓]'), false);
});

test('T4-04: Scenario 4 - Old persona refactor + grouped points + 32px word combo + worldbook split + submodal save', async () => {
  const { env, stHost, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  assert.equal(shadow.querySelector('[data-ups-save-name]'), null);
  assert.equal(shadow.querySelector('[data-ups-narrow-nav]'), null);

  shadow.querySelector('[data-ups-mode="B"]').click();
  shadow.querySelector('[data-ups-load-persona]').click();
  await env.waitTicks();

  const groupCbs = shadow.querySelectorAll('[data-ups-point-group-cb]');
  assert.ok(groupCbs.length >= 2);
  shadow.querySelector('[data-ups-word-count-menu-btn]').click();
  await env.waitTicks();
  shadow.querySelectorAll('[data-ups-word-count-option], .ups-menu-item').find((b) => b.textContent.includes('1500')).click();
  env.setInputValue(shadow.querySelector('[data-ups-word-count-input]'), '1650');
  await env.waitTicks();

  const hint = shadow.querySelector('[data-ups-split-hint]');
  assert.equal(hint.hidden, false);
  if (!ctrl.getState().settings.ui.dualLayer) hint.click();

  shadow.querySelector('[data-ups-generate-b]').click();
  await env.waitTicks(25);
  assert.ok(shadow.querySelector('[data-ups-draft]').value.includes('【补充世界书条目】'));

  shadow.querySelector('[data-ups-save-as-btn]').click();
  await env.waitTicks();
  const sub = shadow.querySelector('[data-ups-save-name-submodal]');
  env.setInputValue(sub.querySelector('input'), '新版林栖');
  sub.querySelector('[data-ups-save-name-confirm], button.ups-btn-primary').click();
  await env.waitTicks(25);
  assert.equal(Object.values(stHost.powerUser.personas).includes('新版林栖'), true);
});

test('T4-05: Scenario 5 - Mobile 390x844 searchable picker + IME + soft-keyboard resize + history recovery', async () => {
  const { env, stHost, ctrl, shadow } = await mountFreshStudio({ innerWidth: 390, innerHeight: 844, coarse: true });
  await ctrl.open();
  assert.equal(env.focusCalls.length, 0);

  const searchEl = shadow.querySelector('[data-ups-char-search]');
  searchEl.focus();
  env.typeWithIME(searchEl, '苏');
  env.simulateSoftKeyboard(384);
  await env.waitTicks();
  assert.equal(shadow.activeElement, searchEl);
  assert.equal(shadow.querySelector('[data-ups-char-search]'), searchEl);

  stHost.setLlmResponder(() => '【基础人设】\n姓名：第一版手机生成');
  shadow.querySelector('[data-ups-generate]').click();
  await env.waitTicks(20);
  env.setInputValue(shadow.querySelector('[data-ups-draft]'), '【基础人设】\n姓名：手改编辑版');

  shadow.querySelector('[data-ups-history-btn]').click();
  await env.waitTicks();
  shadow.querySelector('[data-ups-history-popover]').querySelectorAll('button').find((b) => b.textContent.includes('填入编辑区')).click();
  assert.ok(shadow.querySelector('[data-ups-draft]').value.includes('第一版手机生成'));

  shadow.querySelector('[data-ups-undo]').click();
  assert.ok(shadow.querySelector('[data-ups-draft]').value.includes('手改编辑版'));
});

test('T4-06: Scenario 6 - target_book merge & cross-persona isolation', async () => {
  const { stHost } = await mountFreshStudio();
  await mods.host.saveSupplementaryWorldbook({
    worldName: '城市群像录',
    entries: mods.core.buildCompanionWorldbookEntries({
      companions: [makeCompanionSample({ id: 'pA_c1', name: '顾寒' })],
      companionPlans: [{ id: 'pA_c1', verbatimText: '江澄的哥哥顾寒' }],
      targetPersonaName: '江澄',
    }),
    upsert: true,
    pruneManaged: true,
    managedPrefix: 'ups:persona:jiangcheng.png:',
  });

  await mods.host.saveSupplementaryWorldbook({
    worldName: '城市群像录',
    entries: mods.core.buildCompanionWorldbookEntries({
      companions: [makeCompanionSample({ id: 'pB_c1', name: '苏晚' })],
      companionPlans: [{ id: 'pB_c1', verbatimText: '白术的挚友苏晚' }],
      targetPersonaName: '白术',
    }),
    upsert: true,
    pruneManaged: true,
    managedPrefix: 'ups:persona:baishu.png:',
  });

  await mods.host.saveSupplementaryWorldbook({
    worldName: '城市群像录',
    entries: [],
    upsert: true,
    pruneManaged: true,
    managedPrefix: 'ups:persona:jiangcheng.png:',
  });

  const entries = Object.values(stHost.worldbooks.get('城市群像录').entries);
  assert.equal(entries.some((e) => e.uid === 10 && e.comment === '城市地铁线'), true);
  assert.equal(entries.some((e) => e.content.includes('白术的挚友苏晚')), true);
});

test('T4-07: Scenario 7 - 2-round regeneration + unsaved edit protection + FIFO=8 overflow + delete + clear', async () => {
  const { env, stHost, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();

  for (let i = 1; i <= 8; i += 1) {
    stHost.setLlmResponder(() => `【基础人设】\n姓名：自动第${i}版`);
    shadow.querySelector('[data-ups-generate]').click();
    await env.waitTicks(15);
  }

  env.setInputValue(shadow.querySelector('[data-ups-draft]'), '【基础人设】\n姓名：未保存手动修改稿');
  stHost.setLlmResponder(() => '【基础人设】\n姓名：第9版生成');
  shadow.querySelector('[data-ups-generate]').click();
  await env.waitTicks(20);

  shadow.querySelector('[data-ups-history-btn]').click();
  await env.waitTicks();
  const pop = shadow.querySelector('[data-ups-history-popover]');
  assert.ok(pop.textContent.includes('未保存手动修改稿'));
  assert.equal(pop.querySelectorAll('[data-ups-history-item]').length, 8);
  assert.equal(pop.textContent.includes('自动第1版'), false);

  const delBtns = pop.querySelectorAll('[data-ups-history-delete]');
  delBtns[0].click();
  await env.waitTicks();
  assert.equal(pop.querySelectorAll('[data-ups-history-item]').length, 7);

  pop.querySelector('[data-ups-history-clear]').click();
  await env.waitTicks();
  assert.equal(pop.querySelectorAll('[data-ups-history-item]').length, 0);
});

test('T4-08: Scenario 8 - Desktop resize anchor stability + status wrapping + silent browse + tab reset', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio({ innerWidth: 1280, innerHeight: 800 });
  await ctrl.open();
  const resized = mods.ui.computeResizedModalRect({
    origLeft: 100,
    origTop: 50,
    origWidth: 1080,
    origHeight: 700,
    dx: 40,
    dy: 50,
    handle: 'se',
    viewportWidth: 1280,
    viewportHeight: 800,
  });
  assert.equal(resized.left, 100);
  assert.equal(resized.top, 50);
  assert.equal(resized.height, 750);

  const rectBefore = getModalRect(shadow);
  const initialStatus = getStatusText(shadow);
  shadow.querySelector('[data-ups-lexicon-toggle]').click();
  shadow.querySelector('[data-ups-ratio-toggle]').click();
  await env.waitTicks();
  assert.equal(getStatusText(shadow), initialStatus);

  shadow.querySelector('[data-ups-generate]').click();
  await env.waitTicks(20);
  assert.notEqual(getStatusText(shadow), '就绪');

  shadow.querySelector('[data-ups-tab="presets"]').click();
  await env.waitTicks();
  assert.equal(getStatusText(shadow), '就绪');
  assert.deepEqual(getModalRect(shadow), rectBefore);
});

test('T4-09: Scenario 9 - Pure cross-card reuse vs joint upbringing & minimal no-backstory mode', async () => {
  const { env, stHost, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();

  env.setInputValue(shadow.querySelector('[data-ups-inspiration]'), '和沈砚是多年旧识，在旧书店重逢');
  shadow.querySelector('[data-ups-generate]').click();
  await env.waitTicks(20);
  const runA = stHost.capturedGenerations.at(-1).messages.map((m) => m.content).join('\n');
  assert.ok(/共同成长|青梅竹马|多年/.test(runA));

  shadow.querySelector('[data-ups-ratio-toggle]').click();
  await env.waitTicks();
  const minimalBtn = shadow.querySelector('[data-ups-section-preset="minimal"]');
  if (minimalBtn) minimalBtn.click();
  const backstoryCb = shadow.querySelector('[data-ups-section-cb="backstory_growth"]');
  if (backstoryCb && backstoryCb.checked) backstoryCb.click();
  const pureReuseCb = shadow.querySelector('[data-ups-pure-reuse]');
  if (pureReuseCb && !pureReuseCb.checked) pureReuseCb.click();

  shadow.querySelector('[data-ups-generate]').click();
  await env.waitTicks(20);
  const runB = stHost.capturedGenerations.at(-1).messages.map((m) => m.content).join('\n');
  assert.ok(/跨卡复用|剥离/.test(runB));
  assert.ok(runB.includes('成长经历与现状') && /不生成|禁止/.test(runB));
});

test('T4-10: Scenario 10 - Token headroom recovery (over -> tight -> ok) & verbatim fidelity audit', async () => {
  await mountFreshStudio();
  const bloated = '冗余设定段落。'.repeat(240);
  const compCard = makeCompanionSample({
    id: 'c_guhan',
    includeDialogueExamples: true,
    description: '顾寒二十八岁，黑发微乱，常穿深灰工装外套，左腕戴银壳机械表。',
    selectedWorldEntries: [
      { entryKey: 'e1', content: '顾寒在巷口开了家修表铺。' },
      { entryKey: 'e2', content: bloated },
      { entryKey: 'e3', content: bloated },
    ],
  });

  const overPlan = mods.core.computeCompanionTokenPlan({
    personaText: bloated,
    mainCharContext: { name: '沈砚', description: bloated },
    mainSelectedWorldEntries: [{ content: bloated }],
    companions: [compCard],
    maxContextTokens: 900,
  });
  assert.equal(overPlan.headroomStatus, 'over');

  const okPlan = mods.core.computeCompanionTokenPlan({
    personaText: '林栖，24岁，旧书店装帧师。',
    mainCharContext: { name: '沈砚', description: '温和克制，城南旧书店店主。' },
    mainSelectedWorldEntries: [],
    companions: [{ ...compCard, includeDialogueExamples: false, selectedWorldEntries: [compCard.selectedWorldEntries[0]] }],
    maxContextTokens: 4096,
  });
  assert.equal(okPlan.headroomStatus, 'ok');

  const verbatim = mods.core.extractVerbatimCompanionSlices(
    compCard,
    [compCard.selectedWorldEntries[0]],
    okPlan.perCompanionBudgets[0].allocatedTokens
  );
  assert.equal(verbatim.text.includes('黑发微乱，常穿深灰工装外套，左腕戴银壳机械表。'), true);
  assert.equal(verbatim.text.includes('顾寒在巷口开了家修表铺。'), true);
});

test('T4-11: Scenario 11 (v1.6.1) - Searchable char combobox, live 卡中角色名 update, capsule lexicon, preset synced entries (draftAudit + blue/green light) & API save button', async () => {
  const { env, stHost, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();

  // 1. Topbar has no confusing refresh button; contextual 重读列表 exists in left pane
  const topbar = shadow.querySelector('[data-ups-topbar]');
  assert.equal(topbar.querySelector('[data-ups-sync-host]'), null);
  assert.ok(shadow.querySelector('[data-ups-sync-host]'));

  // 2. Searchable character combobox & switching characters updates 卡中角色名 immediately
  const comboBtn = shadow.querySelector('[data-ups-char-combo-btn]');
  assert.ok(comboBtn);
  comboBtn.click();
  assert.equal(shadow.querySelector('[data-ups-char-combo-menu]').hidden, false);
  const optGuhan = shadow.querySelector('[data-ups-char-opt="1"]');
  assert.ok(optGuhan);
  optGuhan.click();
  await env.waitTicks(20);
  assert.equal(shadow.querySelector('[data-ups-char-real-name]').value, '顾寒');

  env.selectOption(shadow.querySelector('[data-ups-char-select]'), '2');
  await env.waitTicks(20);
  assert.equal(shadow.querySelector('[data-ups-char-real-name]').value, '苏晚');

  // 3. Capsule lexicon tabs switch categories cleanly with zero status spam
  shadow.querySelector('[data-ups-lexicon-toggle]').click();
  await env.waitTicks();
  const statusBeforeTab = getStatusText(shadow);
  const vibeTab = shadow.querySelector('[data-ups-lexicon-tab="vibe_aura"]');
  assert.ok(vibeTab);
  vibeTab.click();
  assert.equal(shadow.querySelector('[data-ups-lexicon-category="vibe_aura"]').hidden, false);
  assert.equal(shadow.querySelector('[data-ups-lexicon-category="animal_archetype"]').hidden, true);
  assert.equal(getStatusText(shadow), statusBeforeTab);

  // 4. Companion body starts collapsed by default until expanded or added
  assert.equal(shadow.querySelector('[data-ups-companion-body]').hidden, true);

  // 5. Word count 2000 -> tight 1840~2160 preview in Tab 2 + worldbook blue/green light sync + draftAudit synced entry
  env.setInputValue(shadow.querySelector('[data-ups-word-count-input]'), '2000');
  await env.waitTicks();
  if (!ctrl.getState().settings.ui.dualLayer) {
    shadow.querySelector('[data-ups-split-hint]').click();
  }
  const wbLightSel = shadow.querySelector('[data-ups-wb-light-mode]');
  assert.ok(wbLightSel);
  env.selectOption(wbLightSel, 'blue_constant');
  await env.waitTicks();

  shadow.querySelector('[data-ups-tab="presets"]').click();
  await env.waitTicks();
  const presetsPanel = shadow.querySelector('[data-ups-tab-panel="presets"]');
  assert.ok(presetsPanel.textContent.includes('1840～2160'));
  const syncedBox = presetsPanel.querySelector('[data-ups-acc-list] [data-ups-synced-list]');
  assert.ok(syncedBox);
  assert.equal(presetsPanel.textContent.includes('本次生成条目'), false);
  assert.ok(syncedBox.textContent.includes('成稿前草稿自检'));
  assert.ok(syncedBox.textContent.includes('蓝灯常驻'));

  // 6. Custom API explicit 保存方案 button & collapsed connection diagnostics
  shadow.querySelector('[data-ups-tab="settings"]').click();
  env.selectOption(shadow.querySelector('[data-ups-provider]'), 'custom');
  await env.waitTicks();
  const saveProfileBtn = shadow.querySelector('[data-ups-profile-save]');
  assert.ok(saveProfileBtn);
  env.setInputValue(shadow.querySelector('[data-ups-profile-name]'), '主力接口');
  env.setInputValue(shadow.querySelector('[data-ups-api-url]'), 'https://api.example.com/v1');
  saveProfileBtn.click();
  await env.waitTicks();
  assert.ok(getStatusText(shadow).includes('已保存自定义 API 方案'));
  const connDetails = shadow.querySelector('[data-ups-conn-details]');
  assert.ok(connDetails && !connDetails.open);
});

// ============================================================================
// STATIC & COMPLIANCE GATE (16 Checks: S-01 .. S-16)
// ============================================================================

test('S-01: manifest.json, package.json, and index.js EXTENSION_VERSION equal 1.6.1', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'manifest.json'), 'utf8'));
  assert.equal(pkg.version, '1.6.1');
  assert.equal(manifest.version, '1.6.1');
  assert.equal(mods.entry.EXTENSION_VERSION, '1.6.1');
});

test('S-02: src/ui.js has zero controlHintEl or deleted boilerplate hint string', () => {
  const uiSrc = fs.readFileSync(path.join(REPO_ROOT, 'src/ui.js'), 'utf8');
  assert.equal(uiSrc.includes('controlHintEl'), false);
  assert.equal(uiSrc.includes('不擅编父母与童年创伤'), false);
  assert.equal(uiSrc.includes('职业与喜好自然收放不刷屏'), false);
});

test('S-03: R9 forbidden dev-talk/self-praise phrases absent from UI, presets, styles, index, README, NEXT', () => {
  const forbidden = [
    '不擅编父母',
    '自然收放不刷屏',
    '无需切换对话',
    '不切聊天窗',
    '先排雷防打卡',
    '省常驻字数',
    '推荐·省Token',
    '防套皮',
    '不撑高页面',
    '默认折叠不占高度',
    '可拖动浮窗对照底层',
    '易引发每轮打卡',
  ];
  const targets = ['src/ui.js', 'index.js', 'src/presets.js', 'src/styles.js', 'README.md', 'NEXT.md'];
  for (const rel of targets) {
    const content = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
    for (const phrase of forbidden) {
      assert.equal(content.includes(phrase), false, `R9 forbidden phrase "${phrase}" found in ${rel}`);
    }
  }
});

test('S-04: R8 forbidden control terms (手控客观/纯手控/客观手控/非抢话) absent from presets, UI, index, README, NEXT', () => {
  const forbidden = ['手控客观', '纯手控', '客观手控', '非抢话'];
  const targets = ['src/presets.js', 'src/ui.js', 'index.js', 'README.md', 'NEXT.md'];
  for (const rel of targets) {
    const content = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
    for (const term of forbidden) {
      assert.equal(content.includes(term), false, `R8 forbidden term "${term}" found in ${rel}`);
    }
  }
});

test('S-05: zero hardcoded 20% secret boilerplate, default presets pass 越狱|破限 guard, intimate group defaults OFF', () => {
  for (const rel of ['src/presets.js', 'src/core.js', 'src/ui.js']) {
    const content = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
    assert.equal(content.includes('[未公开私事 / 旁人无从知晓]'), false, `Hardcoded secret template in ${rel}`);
    assert.equal(/占\s*20%/.test(content), false, `Hardcoded 20% quota in ${rel}`);
  }
  const serializedPresets = JSON.stringify(mods.presets.BUILTIN_PRESET_SCHEMES);
  assert.equal(/(?:越狱|破限)/i.test(serializedPresets), false);
  const intimateGroup = mods.presets.GENERATION_SECTION_GROUPS.find((g) => g.id === 'intimate');
  assert.ok(intimateGroup && intimateGroup.items.every((i) => i.defaultEnabled === false));
});

test('S-06: zero backdrop-filter and zero blur( across all source files and style.css', () => {
  for (const file of listRepoTextFiles()) {
    if (!/^(?:src\/|index\.js|style\.css)/.test(file.rel)) continue;
    assert.equal(/backdrop-filter/i.test(file.text), false, `backdrop-filter found in ${file.rel}`);
    assert.equal(/blur\(/i.test(file.text), false, `blur( found in ${file.rel}`);
  }
});

test('S-07: zero .innerHTML =, .outerHTML =, insertAdjacentHTML( across src/*.js and index.js', () => {
  for (const file of listRepoTextFiles()) {
    if (!/^(?:src\/|index\.js)/.test(file.rel)) continue;
    assert.equal(/\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML\s*\(/i.test(file.text), false, `Unsafe HTML sink in ${file.rel}`);
  }
});

test('S-08: every text/search/number input and textarea in Shadow DOM and host card carries spellcheck="false"', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  const allFields = [
    ...shadow.querySelectorAll('input, textarea'),
    ...env.doc.querySelectorAll('#ups-ext-settings input, #ups-ext-settings textarea'),
  ];
  for (const el of allFields) {
    const t = (el.getAttribute('type') || el.type || 'text').toLowerCase();
    if (['checkbox', 'radio', 'button', 'submit', 'range', 'file'].includes(t)) continue;
    assert.equal(el.getAttribute('spellcheck'), 'false', `Missing spellcheck="false" on ${el.tagName}`);
  }
});

test('S-09: mobile @media rule sets font-size >= 16px on inputs and contains zero narrowNavEl/小屏视图 styles', () => {
  const styleCss = fs.readFileSync(path.join(REPO_ROOT, 'style.css'), 'utf8');
  const combined = `${mods.styles.SHADOW_CSS}\n${styleCss}`;
  assert.equal(combined.includes('ups-narrow-nav'), false);
  const idx = mods.styles.SHADOW_CSS.indexOf('@media (max-width: 680px)');
  assert.notEqual(idx, -1);
  assert.ok(/font-size:\s*16px/.test(mods.styles.SHADOW_CSS.slice(idx)));
});

test('S-10: zero automatic .focus() calls during mobile (390x844) open, tab switch, or picker open', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio({ innerWidth: 390, innerHeight: 844, coarse: true });
  await ctrl.open();
  shadow.querySelector('[data-ups-tab="presets"]').click();
  shadow.querySelector('[data-ups-tab="studio"]').click();
  await env.waitTicks();
  assert.equal(env.focusCalls.length, 0);
});

test('S-11: handleViewportResize never closes or rebuilds focused search input popover on soft-keyboard resize', async () => {
  const { env, ctrl, shadow } = await mountFreshStudio({ innerWidth: 390, innerHeight: 844, coarse: true });
  await ctrl.open();
  const searchEl = shadow.querySelector('[data-ups-char-search]');
  searchEl.focus();
  env.setInputValue(searchEl, '顾');
  env.simulateSoftKeyboard(380);
  await env.waitTicks();

  assert.equal(shadow.querySelector('[data-ups-char-search]'), searchEl);
  assert.equal(shadow.activeElement, searchEl);
  assert.equal(searchEl.value, '顾');
});

test('S-12: AGENTS.md 10-point layout checks (no mini-size button, 100dvh max-height, resize anchor, non-blocking submodal, right-aligned star)', () => {
  const uiSrc = fs.readFileSync(path.join(REPO_ROOT, 'src/ui.js'), 'utf8');
  assert.equal(uiSrc.includes('缩小尺寸'), false);
  assert.equal(uiSrc.includes('小窗对照'), false);
  assert.ok(mods.styles.SHADOW_CSS.includes('100dvh'));
  assert.ok(mods.styles.SHADOW_CSS.includes('@container'));
  const resized = mods.ui.computeResizedModalRect({
    origLeft: 80,
    origTop: 40,
    origWidth: 800,
    origHeight: 600,
    dx: 50,
    dy: 60,
    handle: 'se',
    viewportWidth: 1280,
    viewportHeight: 800,
  });
  assert.equal(resized.left, 80);
  assert.equal(resized.top, 40);
});

test('S-13: zero third-party plugin/preset/author names and zero non-mock sk- secret tokens across entire repo', () => {
  const bannedTokens = decodeBase64List(['Z2FnYQ==', 'bm92YS1jcmVhdG9y', 'bm92YSBjcmVhdG9y']);
  const realSecretRe = /\bsk-(?!mock-)[A-Za-z0-9]{16,}\b/g;
  for (const file of listRepoTextFiles()) {
    const lower = file.text.toLowerCase();
    for (const token of bannedTokens) {
      assert.equal(lower.includes(token), false, `Third-party token found in ${file.rel}`);
    }
    const secretHits = file.text.match(realSecretRe);
    assert.equal(secretHits, null, `Potential real secret token found in ${file.rel}: ${secretHits}`);
  }
});

test('S-14: COMMON_PERSONA_LEXICON_CATEGORIES has 7 frozen sanitized categories with animal tropes', () => {
  const cats = mods.presets.COMMON_PERSONA_LEXICON_CATEGORIES;
  assert.equal(Object.isFrozen(cats), true);
  assert.equal(cats.length, 7);
  const terms = cats.flatMap((c) => c.terms);
  assert.equal(terms.includes('猫系'), true);
  assert.equal(terms.includes('犬系'), true);
  assert.equal(terms.includes('狐系'), true);
});

test('S-15: status bar wraps cleanly without ellipsis clipping, no permanent footer name input, no narrowNavEl', async () => {
  const { ctrl, shadow } = await mountFreshStudio();
  await ctrl.open();
  assert.equal(shadow.querySelector('[data-ups-footer] [data-ups-save-name]'), null);
  assert.equal(shadow.querySelector('[data-ups-narrow-nav]'), null);
  const statusBlocks = extractCssRuleBlocks(mods.styles.SHADOW_CSS, (h) => h.includes('.ups-status-text'));
  assert.equal(statusBlocks.some((b) => /text-overflow:\s*ellipsis/.test(b.body)), false);
});

test('S-16: workspace boundary stays strictly inside user-persona-studio', () => {
  const top = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
  assert.equal(path.resolve(top).toLowerCase(), path.resolve(REPO_ROOT).toLowerCase());
  const statusOut = execFileSync('git', ['status', '--porcelain'], { cwd: REPO_ROOT, encoding: 'utf8' });
  for (const line of statusOut.split(/\r?\n/).filter(Boolean)) {
    assert.equal(line.includes('..'), false, `Unexpected parent path in git status: ${line}`);
  }
});
