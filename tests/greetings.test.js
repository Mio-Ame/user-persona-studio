import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGenerationMessages, buildGreetingOptions } from '../src/core.js';

test('开场白目录只提供标题和概要，开场自身的元数据优先', () => {
  const firstMessage = '# 使用说明\n作者说明仅供阅读\n# 开场白\n1. 雨夜初遇\n*两人在渡口避雨*\n\n2. 清晨渡船\n*等候渡船*\n# 后记';
  const alternateGreetings = [
    '<!-- title: 夜雨 -->\n<!-- desc: 驿站相逢 -->\n<!-- lore: 2 -->\n他把伞靠在门边。',
    '晨钟敲响，渡船离岸。',
  ];
  const options = buildGreetingOptions({ firstMessage, alternateGreetings });
  assert.deepEqual(options, [
    { index: 1, title: '夜雨', summary: '驿站相逢', text: '他把伞靠在门边。' },
    { index: 2, title: '清晨渡船', summary: '等候渡船', text: '晨钟敲响，渡船离岸。' },
  ]);
  const build = (openingReference) => buildGenerationMessages({
    mode: 'create', inspiration: '驿站学徒',
    charContext: { name: '《渡口旧事》', firstMessage, alternateGreetings, openingReference },
  }).assembledPromptText;
  assert.equal(build().includes('开场白参考'), false);
  assert.equal(build().includes('作者说明仅供阅读'), false);
  assert.equal(build(options[1].text).includes('晨钟敲响，渡船离岸'), true);
  assert.equal(build(options[1].text).includes('他把伞靠在门边'), false);
});

test('普通首条可选，空备选保留原序号', () => {
  const options = buildGreetingOptions({
    firstMessage: '渡口在下雨。', alternateGreetings: ['', '他在塔楼里值班。'],
  });
  assert.deepEqual(options.map(({ index, text }) => [index, text]), [
    [0, '渡口在下雨。'], [2, '他在塔楼里值班。'],
  ]);
});
