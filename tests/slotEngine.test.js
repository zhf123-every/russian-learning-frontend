import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { planToScaffoldingPaths, verifySlotPaths, generateSlotPaths, generateVariantPool, slotNormalize } from '../src/lib/slotEngine.js'

// 与后端 _slot_verify_and_build 对齐的样例（块模式：add 直显，末步 = 完整句）
// 骨架组节奏对齐句乐部：Это → мой → Это мой → друг, → который живёт в Москве → 完整句
const PLAN = {
  groups: [
    {
      title: '骨架',
      steps: [
        { add: 'Это', russian: 'Это', zh: '这', type: 'pronoun' },
        { add: 'мой', russian: 'мой', zh: '我的', type: 'adj' },
        { add: 'Это мой', russian: 'Это мой', zh: '这是我的', type: 'comb' },
        { add: 'друг,', russian: 'друг,', zh: '朋友，', type: 'noun' },
        { add: 'который живёт в Москве', russian: 'который живёт в Москве', zh: '他住在莫斯科', type: 'clause' },
        { add: 'Это мой друг, который живёт в Москве', russian: 'Это мой друг, который живёт в Москве', zh: '这是我的朋友，他住在莫斯科。', type: 'sentence' },
      ],
    },
    {
      title: '否定',
      steps: [
        { add: 'не', russian: 'не', zh: '不', type: 'neg' },
        { add: 'не живёт', russian: 'не живёт', zh: '不居住', type: 'comb' },
        { add: 'не живёт в Москве', russian: 'не живёт в Москве', zh: '不住在莫斯科', type: 'comb' },
        { add: 'Это мой друг, который не живёт в Москве', russian: 'Это мой друг, который не живёт в Москве', zh: '这是我的朋友，他不住在莫斯科。', type: 'sentence' },
      ],
    },
  ],
  translation: '这是我的朋友，他住在莫斯科。',
}
const ORIGINAL = 'Это мой друг, который живёт в Москве'

describe('slotEngine P4 句乐部式滚雪球（块模式）', () => {
  test('plan → scaffoldingPaths：结构正确（pathId / stepIndex / 末步=完整句）', () => {
    const paths = planToScaffoldingPaths(PLAN, ORIGINAL)
    assert.equal(paths.length, 2)
    assert.equal(paths[0].pathId, 'path_01')
    assert.equal(paths[1].pathId, 'path_02')
    assert.equal(paths[0].name, '骨架')
    assert.equal(paths[0].steps.length, 6)
    assert.equal(paths[0].steps[1].stepIndex, 2)
    assert.equal(paths[0].steps[2].russian, 'Это мой') // 块直显
    assert.equal(paths[0].steps[5].russian, ORIGINAL) // 骨架末步 == 原句
    assert.equal(paths[1].steps[3].russian, 'Это мой друг, который не живёт в Москве') // 变体末步 = 完整句
  })

  test('块模式：每步 russian 直显（= add），系统不累加', () => {
    const paths = planToScaffoldingPaths(PLAN, ORIGINAL)
    assert.equal(paths[0].steps[0].russian, 'Это')
    assert.equal(paths[0].steps[3].russian, 'друг,')
    assert.equal(paths[0].steps[4].russian, 'который живёт в Москве')
    assert.equal(paths[1].steps[1].russian, 'не живёт')
  })

  test('最后一步 chinese = translation（通顺整句）；中间步 = 该块中文', () => {
    const paths = planToScaffoldingPaths(PLAN, ORIGINAL)
    assert.equal(paths[0].steps[5].chinese, '这是我的朋友，他住在莫斯科。')
    assert.equal(paths[0].steps[2].chinese, '这是我的')
    assert.equal(paths[1].steps[3].chinese, '这是我的朋友，他住在莫斯科。') // 变体末步用整句翻译
  })

  test('newChunks / allChunks：教学块作零件，累积正确', () => {
    const paths = planToScaffoldingPaths(PLAN, ORIGINAL)
    assert.equal(paths[0].steps[0].newChunks[0].word, 'Это')
    assert.equal(paths[0].steps[1].allChunks.length, 2)
    assert.equal(paths[0].steps[5].allChunks.length, 6)
    assert.equal(paths[0].steps[5].allChunks[5].word, ORIGINAL)
    assert.equal(paths[0].steps[5].allChunks[4].translation, '他住在莫斯科')
  })

  test('骨架组末步 != 原句 → 抛错（防 AI 漏词/篡改）', () => {
    const bad = JSON.parse(JSON.stringify(PLAN))
    bad.groups[0].steps = bad.groups[0].steps.slice(0, 5) // 缺完整句块
    assert.throws(() => planToScaffoldingPaths(bad, ORIGINAL), /骨架组末步 != 原句/)
  })

  test('russian 为空 → 抛错', () => {
    const bad = JSON.parse(JSON.stringify(PLAN))
    bad.groups[1].steps[0].russian = '  '
    assert.throws(() => planToScaffoldingPaths(bad, ORIGINAL), /russian 为空/)
  })

  test('verifySlotPaths：合法路径通过；篡改骨架末步 → 拦截', () => {
    const paths = planToScaffoldingPaths(PLAN, ORIGINAL)
    assert.equal(verifySlotPaths(paths, ORIGINAL).ok, true)
    paths[0].steps[5].russian = 'Это мой друг' // 篡改骨架最终步
    const v = verifySlotPaths(paths, ORIGINAL)
    assert.equal(v.ok, false)
    assert.ok(v.errors.some((e) => e.includes('骨架组末步')))
  })

  test('verifySlotPaths：末步不是最长块 → 拦截（防末步不是完整句）', () => {
    const paths = planToScaffoldingPaths(PLAN, ORIGINAL)
    paths[1].steps[3].russian = 'не живёт в Москве' // 末步变短
    const v = verifySlotPaths(paths, ORIGINAL)
    assert.equal(v.ok, false)
    assert.ok(v.errors.some((e) => e.includes('末步不是最长块')))
  })

  test('verifySlotPaths：变体末步重复骨架末步 → 拦截（变体句不能等于原句）', () => {
    const paths = planToScaffoldingPaths(PLAN, ORIGINAL)
    paths[1].steps[3].russian = ORIGINAL // 变体末步改成原句
    const v = verifySlotPaths(paths, ORIGINAL)
    assert.equal(v.ok, false)
    assert.ok(v.errors.some((e) => e.includes('与骨架末步重复')))
  })

  test('verifySlotPaths：变体末步中文照抄原句翻译 → 拦截（中文错乱）', () => {
    const paths = planToScaffoldingPaths(PLAN, ORIGINAL)
    paths[1].steps[3].chinese = '这是我的朋友，他住在莫斯科。' // 照抄原句翻译
    const v = verifySlotPaths(paths, ORIGINAL, '这是我的朋友，他住在莫斯科。')
    assert.equal(v.ok, false)
    assert.ok(v.errors.some((e) => e.includes('中文与原句翻译相同')))
  })

  test('verifySlotPaths：变体末步缺中文 → 拦截', () => {
    const paths = planToScaffoldingPaths(PLAN, ORIGINAL)
    paths[1].steps[3].chinese = '  '
    const v = verifySlotPaths(paths, ORIGINAL, '这是我的朋友，他住在莫斯科。')
    assert.equal(v.ok, false)
    assert.ok(v.errors.some((e) => e.includes('缺中文')))
  })

  test('generateSlotPaths：httpPost 返回 fetch Response-like → 解析成功', async () => {
    const body = { ok: true, groups: PLAN.groups, translation: PLAN.translation }
    const post = async () => ({ ok: true, json: async () => body })
    const r = await generateSlotPaths({ sentence: ORIGINAL, tokens: ['Это', 'мой', 'друг,', 'который', 'живёт', 'в', 'Москве'], difficulty: 'easy', httpPost: post })
    assert.ok(r.paths)
    assert.equal(r.paths[0].steps[5].russian, ORIGINAL)
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
