import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { planToScaffoldingPaths, verifySlotPaths, generateSlotPaths, generateVariantPool, slotNormalize } from '../src/lib/slotEngine.js'

// 与后端 _slot_verify_and_build 对齐的样例（骨架 + 否定变体）
const PLAN = {
  groups: [
    {
      title: '骨架',
      steps: [
        { add: 'Это', russian: 'Это', zh: '这', type: 'pronoun' },
        { add: 'мой', russian: 'Это мой', zh: '我的', type: 'adj' },
        { add: 'друг,', russian: 'Это мой друг,', zh: '朋友，', type: 'noun' },
        { add: 'который живёт в Москве', russian: 'Это мой друг, который живёт в Москве', zh: '他住在莫斯科', type: 'clause' },
      ],
    },
    {
      title: '否定',
      steps: [
        { add: 'не', russian: 'не', zh: '不', type: 'neg' },
        { add: 'живёт', russian: 'не живёт', zh: '居住', type: 'verb' },
        { add: 'в Москве', russian: 'не живёт в Москве', zh: '在莫斯科', type: 'prep_phrase' },
      ],
    },
  ],
  translation: '这是我的朋友，他住在莫斯科。',
}
const ORIGINAL = 'Это мой друг, который живёт в Москве'

describe('slotEngine P4 句乐部式滚雪球', () => {
  test('plan → scaffoldingPaths：结构正确（pathId / stepIndex / russian 递增）', () => {
    const paths = planToScaffoldingPaths(PLAN, ORIGINAL)
    assert.equal(paths.length, 2)
    assert.equal(paths[0].pathId, 'path_01')
    assert.equal(paths[1].pathId, 'path_02')
    assert.equal(paths[0].name, '骨架')
    assert.equal(paths[0].steps.length, 4)
    assert.equal(paths[0].steps[1].stepIndex, 2)
    assert.equal(paths[0].steps[1].russian, 'Это мой')
    assert.equal(paths[0].steps[3].russian, ORIGINAL) // 骨架最终 == 原句
  })

  test('每步 russian = 前一步 + add（机械拼接零错误）', () => {
    const paths = planToScaffoldingPaths(PLAN, ORIGINAL)
    assert.equal(paths[0].steps[2].russian, 'Это мой друг,')
    assert.equal(paths[1].steps[1].russian, 'не живёт')
    assert.equal(paths[1].steps[2].russian, 'не живёт в Москве')
  })

  test('最后一步 chinese = translation（通顺整句）；中间步 = 零件中文累积', () => {
    const paths = planToScaffoldingPaths(PLAN, ORIGINAL)
    assert.equal(paths[0].steps[3].chinese, '这是我的朋友，他住在莫斯科。')
    assert.equal(paths[0].steps[1].chinese, '这 我的')
    assert.ok(paths[0].steps[0].chinese.includes('这'))
  })

  test('newChunks / allChunks：add 整块作零件，累积正确', () => {
    const paths = planToScaffoldingPaths(PLAN, ORIGINAL)
    assert.equal(paths[0].steps[0].newChunks[0].word, 'Это')
    assert.equal(paths[0].steps[1].allChunks.length, 2)
    assert.equal(paths[0].steps[3].allChunks.length, 4)
    assert.equal(paths[0].steps[3].allChunks[3].translation, '他住在莫斯科')
  })

  test('骨架组拼接 != 原句 → 抛错（防 AI 漏词）', () => {
    const bad = JSON.parse(JSON.stringify(PLAN))
    bad.groups[0].steps = bad.groups[0].steps.slice(0, 3) // 缺最后一块
    assert.throws(() => planToScaffoldingPaths(bad, ORIGINAL), /骨架组拼接 != 原句/)
  })

  test('add 为空 → 抛错', () => {
    const bad = JSON.parse(JSON.stringify(PLAN))
    bad.groups[1].steps[0].add = '  '
    assert.throws(() => planToScaffoldingPaths(bad, ORIGINAL), /add 为空/)
  })

  test('russian 与机械拼接不一致 → 抛错', () => {
    const bad = JSON.parse(JSON.stringify(PLAN))
    bad.groups[0].steps[1].russian = 'мой Это' // 语序反了
    assert.throws(() => planToScaffoldingPaths(bad, ORIGINAL), /拼接不一致/)
  })

  test('verifySlotPaths：合法路径通过；篡改后拦截', () => {
    const paths = planToScaffoldingPaths(PLAN, ORIGINAL)
    assert.equal(verifySlotPaths(paths, ORIGINAL).ok, true)
    paths[0].steps[3].russian = 'Это мой друг' // 篡改骨架最终步
    const v = verifySlotPaths(paths, ORIGINAL)
    assert.equal(v.ok, false)
    assert.ok(v.errors.some((e) => e.includes('骨架组拼接')))
  })

  test('generateSlotPaths：httpPost 返回 fetch Response-like → 解析成功', async () => {
    const body = { ok: true, groups: PLAN.groups, translation: PLAN.translation }
    const post = async () => ({ ok: true, json: async () => body })
    const r = await generateSlotPaths({ sentence: ORIGINAL, tokens: ['Это', 'мой', 'друг,', 'который', 'живёт', 'в', 'Москве'], difficulty: 'easy', httpPost: post })
    assert.ok(r.paths)
    assert.equal(r.paths[0].steps[3].russian, ORIGINAL)
  })

  test('generateSlotPaths：fallback → 返回 {fallback, reason} 不抛错', async () => {
    const post = async () => ({ ok: false, fallback: true, reason: 'skeleton_concat_mismatch' })
    const r = await generateSlotPaths({ sentence: ORIGINAL, tokens: ['Это', 'мой'], difficulty: 'easy', httpPost: post })
    assert.equal(r.fallback, true)
    assert.equal(r.reason, 'skeleton_concat_mismatch')
  })

  test('httpPost 缺失 → 抛错', async () => {
    await assert.rejects(() => generateSlotPaths({ sentence: ORIGINAL, tokens: [], difficulty: 'easy' }), /httpPost/)
  })

  test('slotNormalize：压缩空白', () => {
    assert.equal(slotNormalize('  Это   мой  друг '), 'Это мой друг')
  })

  test('generateSlotPaths：带 pool 时 POST body 含 pool（词池随句传）', async () => {
    let posted = null
    const pool = { time: [{ ru: 'завтра', zh: '明天' }], predicates: [{ ru: 'хочу', zh: '想' }] }
    const post = async (path, body) => { posted = { path, body }; return { ok: true, groups: PLAN.groups, translation: PLAN.translation } }
    const r = await generateSlotPaths({ sentence: ORIGINAL, tokens: ['Это', 'мой', 'друг,'], difficulty: 'easy', pool, httpPost: post })
    assert.ok(r.paths)
    assert.deepEqual(posted.body.pool, pool)
    assert.equal(posted.body.sentence_hash.length, 16)
  })

  test('generateVariantPool：正常返回 9 类词池', async () => {
    const pool = { negation: [{ ru: 'не', zh: '不' }], time: [{ ru: 'сейчас', zh: '现在' }] }
    const post = async () => ({ ok: true, pool })
    const r = await generateVariantPool({ sentences: [{ ru: ORIGINAL, zh: 'x' }], httpPost: post })
    assert.ok(r.pool)
    assert.equal(r.pool.time[0].ru, 'сейчас')
  })

  test('generateVariantPool：fallback 返回 {fallback, reason}', async () => {
    const post = async () => ({ ok: false, fallback: true, reason: 'ai_none' })
    const r = await generateVariantPool({ sentences: [{ ru: ORIGINAL }], httpPost: post })
    assert.equal(r.fallback, true)
    assert.equal(r.reason, 'ai_none')
  })

  test('generateVariantPool：httpPost 缺失 → 抛错', async () => {
    await assert.rejects(() => generateVariantPool({ sentences: [{ ru: ORIGINAL }] }), /httpPost/)
  })
})
