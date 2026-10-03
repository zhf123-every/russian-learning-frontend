// tests/segmentsToQuestions.test.js —— P3-A 语块 → 题目转换（C 混合）
// 运行：node --test tests/segmentsToQuestions.test.js
// 覆盖：
//   1) 只收 status='ok'；pending 句不出题
//   2) 三档结构：easy=零件+组装 / medium=只组装 / hard=只组装（整句一块）
//   3) 组装题拼接（segments 按 sort_order 的 text join）== 俄语化整句
//   4) 组装题 chunkIsFinal:true → 现有 granularityOfUnit 判定 sentence（渲染/过滤层零改动）
//   5) 零件题按词数粒度：1=word / 2-3=chunk / >3=comb（复用现有兜底判定）
//   6) filterSegmentsByDifficulty：beginner→easy / intermediate→medium / advanced→hard / custom→全档按粒度
//   7) 整课无 ok → []
//   8) 数字句俄语化拼接
//   9) 词卡中文：零件题=块级中文；组装题=块级中文共享到块内词

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { segmentsToSequences, pickSegmentDifficulty, filterSegmentsByDifficulty, segmentsToItems, filterSegmentsItemsByDifficulty } from '../src/lib/segmentsToQuestions.js'
import { granularityOfUnit, unitTokenCount } from '../src/lib/scaffolding.js'

// —— mock 语块（与后端 GET /api/segments 返回结构一致；text 为原句 token 子串，sort_order 已对）——
const S1 = 'Я люблю читать книгу сегодня в школе'
const S2 = 'Этому городу уже пятьсот лет.'

function item(hash, difficulty, status, segments, translation) {
  return { sentence_hash: hash, difficulty, status, translation, segments: segments.map((s, i) => ({ sort_order: i + 1, text: s[0], type: s[1], chinese: s[2] })) }
}

const items = [
  // 句1 三档全 ok
  item('h1', 'easy', 'ok', [
    ['Я люблю', 'phrase', '我爱'],
    ['читать', 'verb', '读'],
    ['книгу', 'noun', '书'],
    ['сегодня в школе', 'adverbial', '今天在学校'],
  ], '我今天在学校喜欢读书'),
  item('h1', 'medium', 'ok', [
    ['Я люблю читать', 'phrase', '我爱读书'],
    ['книгу сегодня', 'phrase', '今天的书'],
    ['в школе', 'adverbial', '在学校'],
  ], '我今天在学校喜欢读书'),
  item('h1', 'hard', 'ok', [
    ['Я люблю читать книгу сегодня в школе', 'sentence', '我今天在学校喜欢读书'],
  ], '我今天在学校喜欢读书'),
  // 句2 数字句（俄语化），仅 easy
  item('h2', 'easy', 'ok', [
    ['Этому городу', 'phrase', '这座城市'],
    ['уже', 'adverb', '已经'],
    ['пятьсот лет.', 'phrase', '五百年'],
  ], '这座城市已经有五百年了'),
  // 句3 全是 pending —— 不应出题
  item('h3', 'easy', 'pending', [['Нет данных', 'sentence', '无']], '无'),
]

describe('segmentsToSequences', () => {
  const seqs = segmentsToSequences(items, '测试课')

  test('只收 ok：pending 句不出题', () => {
    assert.ok(!seqs.some((s) => s.segSentenceHash === 'h3'), 'pending 句不应出现')
  })

  test('句序 = 上传顺序（h1 在前，h2 在后）', () => {
    assert.equal(seqs[0].segSentenceNo, 1)
    assert.equal(seqs[0].segSentenceHash, 'h1')
    assert.equal(seqs[seqs.length - 1].segSentenceHash, 'h2')
  })

  test('三档结构：h1 easy=零件+组装', () => {
    const easy = seqs.find((s) => s.segDifficulty === 'easy' && s.segSentenceHash === 'h1')
    assert.ok(easy)
    // 4 个零件 + 1 个组装
    assert.equal(easy.units.filter((u) => u.segKind === 'part').length, 4)
    assert.equal(easy.units.filter((u) => u.segKind === 'full').length, 1)
    // 零件按 sort_order 顺序
    assert.deepEqual(easy.units.filter((u) => u.segKind === 'part').map((u) => u.russian), ['Я люблю', 'читать', 'книгу', 'сегодня в школе'])
    // 组装题在最后
    assert.equal(easy.units[easy.units.length - 1].russian, S1)
    assert.equal(easy.units[easy.units.length - 1].chinese, '我今天在学校喜欢读书')
  })

  test('三档结构：medium=只组装（无零件题）', () => {
    const med = seqs.find((s) => s.segDifficulty === 'medium' && s.segSentenceHash === 'h1')
    assert.ok(med)
    assert.equal(med.units.length, 1)
    assert.equal(med.units[0].segKind, 'full')
    assert.equal(med.units[0].russian, S1)
  })

  test('三档结构：hard=整句一块（只组装）', () => {
    const hard = seqs.find((s) => s.segDifficulty === 'hard' && s.segSentenceHash === 'h1')
    assert.ok(hard)
    assert.equal(hard.units.length, 1)
    assert.equal(hard.units[0].segKind, 'full')
    assert.equal(hard.units[0].russian, S1)
    // hard 无分段（单块）
    assert.equal(hard.units[0].segSpans.length, 1)
  })

  test('组装题拼接 == 俄语化整句（含数字句）', () => {
    const s1full = seqs.find((s) => s.segDifficulty === 'easy' && s.segSentenceHash === 'h1').units.find((u) => u.segKind === 'full')
    assert.equal(s1full.russian, S1)
    const s2easy = seqs.find((s) => s.segDifficulty === 'easy' && s.segSentenceHash === 'h2')
    const s2full = s2easy.units.find((u) => u.segKind === 'full')
    assert.equal(s2full.russian, S2)
  })

  test('组装题 chunkIsFinal:true → 现有 granularityOfUnit 判 sentence（过滤层零改动）', () => {
    for (const seq of seqs) {
      const full = seq.units.find((u) => u.segKind === 'full')
      assert.equal(granularityOfUnit(full), 'sentence')
    }
  })

  test('零件题按词数粒度：1=word / 2-3=chunk / >3=comb（复用现有兜底）', () => {
    const easy = seqs.find((s) => s.segDifficulty === 'easy' && s.segSentenceHash === 'h1')
    const parts = easy.units.filter((u) => u.segKind === 'part')
    assert.equal(granularityOfUnit(parts[1]), 'word')          // 'читать' 1 词
    assert.equal(granularityOfUnit(parts[0]), 'chunk')         // 'Я люблю' 2 词
    assert.equal(granularityOfUnit(parts[3]), 'chunk')         // 'сегодня в школе' 3 词 → chunk
    // 词数 >3 的块判 comb
    assert.equal(granularityOfUnit({ ...parts[0], russian: 'a b c d' }), 'comb')
  })

  test('词卡中文：零件题=块级中文；组装题=块级中文共享到块内词', () => {
    const easy = seqs.find((s) => s.segDifficulty === 'easy' && s.segSentenceHash === 'h1')
    const part = easy.units.find((u) => u.segKind === 'part' && u.russian === 'книгу')
    assert.equal(part.words[0].translation, '书')
    const full = easy.units.find((u) => u.segKind === 'full')
    // 块首词 'Я' 属于 'Я люблю'（我爱），'книгу' 属于 'книгу'（书）
    assert.equal(full.words[0].translation, '我爱')
    const s2full = seqs.find((s) => s.segDifficulty === 'easy' && s.segSentenceHash === 'h2').units.find((u) => u.segKind === 'full')
    assert.equal(s2full.words[0].translation, '这座城市')
  })

  test('sequence 元数据：segDifficulty / segSentenceNo / fullSentence', () => {
    const easy = seqs.find((s) => s.segDifficulty === 'easy' && s.segSentenceHash === 'h1')
    assert.equal(easy.segDifficulty, 'easy')
    assert.equal(easy.fullSentence, S1)
    assert.equal(easy.totalUnits, 5)
  })

  test('整课无 ok → []', () => {
    assert.deepEqual(segmentsToSequences([item('h9', 'easy', 'pending', [['x', 'sentence', 'x']], 'x')], '空课'), [])
    assert.deepEqual(segmentsToSequences([], '空'), [])
  })
})

describe('filterSegmentsByDifficulty（弹窗难度 → 档位预选 + 现有粒度过滤）', () => {
  const seqs = segmentsToSequences(items, '测试课')

  test('beginner → 只留 easy 档（零件+组装全出）', () => {
    const r = filterSegmentsByDifficulty(seqs, 'beginner')
    assert.ok(r.every((s) => s.segDifficulty === 'easy'))
    assert.equal(r.length, 2) // h1 easy + h2 easy
    const h1easy = r.find((s) => s.segSentenceHash === 'h1')
    assert.equal(h1easy.units.length, 5) // 零件4 + 组装1，全出
  })

  test('intermediate → 只留 medium 档（只组装题）', () => {
    const r = filterSegmentsByDifficulty(seqs, 'intermediate')
    assert.ok(r.every((s) => s.segDifficulty === 'medium'))
    assert.equal(r.length, 1)
    assert.equal(r[0].units.length, 1)
    assert.equal(r[0].units[0].segKind, 'full')
  })

  test('advanced → 只留 hard 档（整句一题）', () => {
    const r = filterSegmentsByDifficulty(seqs, 'advanced')
    assert.ok(r.every((s) => s.segDifficulty === 'hard'))
    assert.equal(r.length, 1)
    assert.equal(r[0].units.length, 1)
  })

  test('custom → 全档 + 现有粒度过滤（勾选 短语单词+核心语块）', () => {
    const r = filterSegmentsByDifficulty(seqs, 'custom', ['短语单词', '核心语块'])
    // word + chunk 粒度的题保留，comb/sentence 被滤掉
    for (const s of r) {
      for (const u of s.units) {
        assert.ok(['word', 'chunk'].includes(granularityOfUnit(u)), `不应出现 ${granularityOfUnit(u)} 粒度的题`)
      }
    }
  })

  test('pickSegmentDifficulty 映射', () => {
    assert.equal(pickSegmentDifficulty('beginner'), 'easy')
    assert.equal(pickSegmentDifficulty('intermediate'), 'medium')
    assert.equal(pickSegmentDifficulty('advanced'), 'hard')
    assert.equal(pickSegmentDifficulty('custom'), null)
  })

  test('老序列（无 segDifficulty）走现有过滤不受影响', () => {
    const fake = [{ id: 'p1', units: [{ id: 'u1', russian: 'Я', scaffoldStepIndex: 0, scaffoldN: 2 }, { id: 'u2', russian: 'Я люблю', scaffoldStepIndex: 1, scaffoldN: 2 }] }]
    const r = filterSegmentsByDifficulty(fake, 'advanced')
    assert.equal(r.length, 1)
    assert.equal(r[0].units.length, 1) // 只整句
    assert.equal(r[0].units[0].russian, 'Я люблю')
  })
})

describe('segmentsToItems / filterSegmentsItemsByDifficulty（听写页）', () => {
  const dItems = segmentsToItems(items)

  test('每句每档一个组装题（整句听写，不拆零件）', () => {
    // h1 三档 + h2 easy = 4 个；pending h3 不出
    assert.equal(dItems.length, 4)
    assert.ok(!dItems.some((it) => it.id.includes('h3')), 'pending 句不出题')
    for (const it of dItems) {
      assert.equal(it.segKind, 'full')
      assert.equal(it.chunkIsFinal, true)
      assert.equal(granularityOfUnit(it), 'sentence')
      // h1 各档整句 = S1；h2 整句 = S2
      assert.equal(it.russian, it.id.includes('h2') ? S2 : S1)
    }
  })

  test('难度档位预选：beginner→easy / intermediate→medium / advanced→hard', () => {
    assert.equal(filterSegmentsItemsByDifficulty(dItems, 'beginner').length, 2) // h1 easy + h2 easy
    const med = filterSegmentsItemsByDifficulty(dItems, 'intermediate')
    assert.equal(med.length, 1)
    assert.equal(med[0].segDifficulty, 'medium')
    const adv = filterSegmentsItemsByDifficulty(dItems, 'advanced')
    assert.equal(adv.length, 1)
    assert.equal(adv[0].segDifficulty, 'hard')
  })

  test('老 items（无 segDifficulty）放行，粒度过滤正常', () => {
    const fake = [{ id: 'x1', russian: 'Я', scaffoldStepIndex: 0, scaffoldN: 2 }, { id: 'x2', russian: 'Я люблю', scaffoldStepIndex: 1, scaffoldN: 2 }]
    const r = filterSegmentsItemsByDifficulty(fake, 'advanced')
    assert.equal(r.length, 1)
    assert.equal(r[0].russian, 'Я люблю')
  })
})
