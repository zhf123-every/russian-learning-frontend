// slotTablesToQuestions.test.js —— 表格 → 答题引擎转换器单测
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { slotTablesToSequences, slotTablesToItems } from '../src/lib/slotTablesToQuestions.js'
import { granularityOfUnit, filterSequencesByDifficulty, filterItemsByDifficulty } from '../src/lib/scaffolding.js'
import { filterSegmentsByDifficulty, filterSegmentsItemsByDifficulty } from '../src/lib/segmentsToQuestions.js'

const SAMPLE_ITEMS = [
  {
    sentence_hash: 'aa11',
    sentence: 'Я люблю еду',
    difficulty: 'easy',
    status: 'ok',
    rows: [
      { seq: 1, cardType: '积木', ru: 'Я', zh: '我', tag: '主语', groupId: 'G_01' },
      { seq: 2, cardType: '积木', ru: 'люблю', zh: '喜欢', tag: '谓语', groupId: 'G_01' },
      { seq: 3, cardType: '积木', ru: 'еду', zh: '食物', tag: '宾格', groupId: 'G_01' },
      { seq: 4, cardType: '完整句', ru: 'Я люблю еду', zh: '我喜欢食物', tag: '主谓宾', groupId: 'G_01' },
    ],
  },
  {
    sentence_hash: 'bb22',
    sentence: 'Я не люблю еду',
    difficulty: 'medium',
    status: 'ok',
    rows: [
      { seq: 1, cardType: '积木', ru: 'Я не люблю', zh: '我不喜欢', tag: '主谓', groupId: 'G_02' },
      { seq: 2, cardType: '完整句', ru: 'Я не люблю еду', zh: '我不喜欢食物', tag: '否定句', groupId: 'G_02' },
    ],
  },
  {
    sentence_hash: 'cc33',
    sentence: 'Хорошо',
    difficulty: 'hard',
    status: 'pending', // 机械兜底：不进学生端
    rows: [{ seq: 1, cardType: '完整句', ru: 'Хорошо', zh: '好', tag: '评价', groupId: 'G_03' }],
  },
]

test('slotTablesToSequences: 只收 ok 行，pending 句不出现', () => {
  const seqs = slotTablesToSequences(SAMPLE_ITEMS, '本课')
  assert.equal(seqs.length, 2, '只应有 easy/medium 两句（pending 过滤）')
  assert.ok(seqs.every((s) => s.segSentenceHash !== 'cc33'))
})

test('slotTablesToSequences: 每行一步、顺序 = seq、序号不出现在展示字段', () => {
  const seqs = slotTablesToSequences(SAMPLE_ITEMS, '本课')
  const easy = seqs.find((s) => s.segDifficulty === 'easy')
  assert.equal(easy.units.length, 4, 'easy 4 行 = 4 步')
  assert.deepEqual(
    easy.units.map((u) => u.russian),
    ['Я', 'люблю', 'еду', 'Я люблю еду'],
    '行顺序 = seq 顺序',
  )
  // 序号只定顺序：unit 不出现 seq 数字在标题/内容展示位（tableRow 元数据除外）
  for (const u of easy.units) {
    assert.ok(!String(u.id).startsWith('1.'), 'id 不含展示序号')
  }
})

test('slotTablesToSequences: 粒度标记（积木=word/chunk，完整句=sentence）', () => {
  const seqs = slotTablesToSequences(SAMPLE_ITEMS, '本课')
  const easy = seqs.find((s) => s.segDifficulty === 'easy')
  assert.equal(granularityOfUnit(easy.units[0]), 'word', '1 词积木 = word')
  assert.equal(granularityOfUnit(easy.units[1]), 'word')
  assert.equal(granularityOfUnit(easy.units[2]), 'word')
  assert.equal(granularityOfUnit(easy.units[3]), 'sentence', '完整句行 = sentence')
  const med = seqs.find((s) => s.segDifficulty === 'medium')
  assert.equal(granularityOfUnit(med.units[0]), 'chunk', '2 词积木 = chunk')
  assert.equal(granularityOfUnit(med.units[1]), 'sentence')
})

test('slotTablesToSequences: 现有难度过滤兼容（beginner 全放行 / advanced 只整句）', () => {
  const seqs = slotTablesToSequences(SAMPLE_ITEMS, '本课')
  // 档位预选：beginner→easy 只剩 easy 句；粒度 null = 全放行
  const beginner = filterSegmentsByDifficulty(seqs, 'beginner')
  assert.equal(beginner.length, 1)
  assert.equal(beginner[0].segDifficulty, 'easy')
  assert.equal(beginner[0].units.length, 4)
  // advanced：档位→hard（本样本无 ok hard）→ 空；老序列放行逻辑不误伤
  const advanced = filterSegmentsByDifficulty(seqs, 'advanced')
  assert.equal(advanced.length, 0, '无 ok hard 档 → 空')
  // intermediate：档位→medium，粒度 chunk/comb/sentence → 2 行都留
  const inter = filterSegmentsByDifficulty(seqs, 'intermediate')
  assert.equal(inter.length, 1)
  assert.equal(inter[0].units.length, 2)
})

test('slotTablesToItems: 每行一个听写 item、按 seq 顺序、pending 过滤', () => {
  const items = slotTablesToItems(SAMPLE_ITEMS)
  assert.equal(items.length, 6, 'easy 4 行 + medium 2 行 = 6 行；pending 不出现 → 6')
  const ids = items.map((it) => it.russian)
  assert.deepEqual(ids, ['Я', 'люблю', 'еду', 'Я люблю еду', 'Я не люблю', 'Я не люблю еду'])
  const full = items.find((it) => it.russian === 'Я люблю еду')
  assert.equal(granularityOfUnit(full), 'sentence')
  const part = items.find((it) => it.russian === 'Я')
  assert.equal(granularityOfUnit(part), 'word')
})

test('slotTablesToItems: 听写难度过滤复用（intermediate → 只留 medium 档）', () => {
  const items = slotTablesToItems(SAMPLE_ITEMS)
  const inter = filterSegmentsItemsByDifficulty(items, 'intermediate')
  assert.equal(inter.length, 2)
  assert.ok(inter.every((it) => it.segDifficulty === 'medium'))
})

test('空输入 / 全 pending：返回空数组（页面降级）', () => {
  assert.deepEqual(slotTablesToSequences([], '本课'), [])
  assert.deepEqual(slotTablesToItems([]), [])
  assert.deepEqual(slotTablesToSequences([SAMPLE_ITEMS[2]], '本课'), [])
})
