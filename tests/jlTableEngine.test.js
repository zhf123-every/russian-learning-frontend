import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  TABLE_COLUMNS,
  TEMPLATE_SECTIONS,
  normalizeTableText,
  joinTokensRef,
  buildSkeletonIntent,
  buildCoreChainIntent,
  buildShortChainIntent,
  aiFillTable,
  buildMachineFallbackTable,
  generateUnitTableAsync,
  verifyTable,
} from '../src/lib/jlTableEngine.js'
import { sentenceHash } from '../src/lib/segmentEngine.js'

// ============ P1-5a 已实现（buildSkeletonIntent / verifyTable / joinTokensRef）：真断言 ============
// 其余函数（buildCoreChainIntent / buildShortChainIntent / aiFillTable）：仍空实现（红/抛错是预期）

describe('jlTableEngine 5a：骨架幕意图（机器按 tokens + AI 分组决策机械截取）', () => {
  test('句乐部骨架节奏：I / like / I like / the food / I like the food（4 意群 → 5 步）', () => {
    const steps = buildSkeletonIntent(['I', 'like', 'the', 'food'], [[0], [1], [2, 3]])
    assert.equal(steps.length, 5)
    assert.deepEqual(steps[0], { kind: 'part', cardType: '积木', source: 'core', tokensRef: [0, 0], role: 'chunk', groupId: 'G_01' })
    assert.deepEqual(steps[1].tokensRef, [1, 1])
    assert.deepEqual(steps[2], { kind: 'part', cardType: '积木', source: 'core', tokensRef: [0, 1], role: 'comb', groupId: 'G_01' }) // I like
    assert.deepEqual(steps[3].tokensRef, [2, 3]) // the food
    assert.deepEqual(steps[4], { kind: 'full', cardType: '完整句', template: 'skeleton', compose: [{ source: 'core', tokensRef: [0, 3] }], groupId: 'G_01' })
  })

  test('三词句 Я люблю еду：5 步（part/part/comb/part/full），末步模板 skeleton', () => {
    const steps = buildSkeletonIntent(['Я', 'люблю', 'еду'], [[0], [1], [2]])
    assert.equal(steps.length, 5)
    assert.equal(steps[2].tokensRef.join(','), '0,1')
    assert.equal(steps[4].template, 'skeleton')
    assert.equal(joinTokensRef(['Я', 'люблю', 'еду'], steps[4].compose[0].tokensRef), 'Я люблю еду')
  })

  test('hard 档：整句一个意群 → 2 步（零件单出 + 完整句）', () => {
    const steps = buildSkeletonIntent(['Я', 'люблю', 'еду'], [[0, 1, 2]])
    assert.equal(steps.length, 2)
    assert.deepEqual(steps[0].tokensRef, [0, 2])
    assert.equal(steps[1].template, 'skeleton')
  })

  test('意群组合文本机械截取：joinTokensRef 拼接 == tokens 原样', () => {
    assert.equal(joinTokensRef(['Этому', 'городу', 'уже', '500', 'лет.'], [0, 4]), 'Этому городу уже 500 лет.')
    assert.equal(joinTokensRef(['Я', 'люблю'], [1, 1]), 'люблю')
  })

  test('非法 groups（漏号/重复/不连续/超界）→ null', () => {
    assert.equal(buildSkeletonIntent(['a', 'b', 'c'], [[0], [2]]), null) // 漏 1
    assert.equal(buildSkeletonIntent(['a', 'b', 'c'], [[0], [0, 1]]), null) // 重复 0
    assert.equal(buildSkeletonIntent(['a', 'b', 'c'], [[0], [3]]), null) // 超界
    assert.equal(buildSkeletonIntent([], [[]]), null) // 空 tokens
    assert.equal(buildSkeletonIntent(['a', 'b'], null), null)
  })
})

describe('jlTableEngine 5a：verifyTable 硬校验（7 项）', () => {
  // 全绿表格：骨架幕（G_01）+ 否定幕（G_02）
  const goodRows = [
    { seq: 1, cardType: '积木', ru: 'Я', zh: '我', tag: '主语', groupId: 'G_01' },
    { seq: 2, cardType: '积木', ru: 'люблю', zh: '喜欢', tag: '谓语', groupId: 'G_01' },
    { seq: 3, cardType: '积木', ru: 'Я люблю', zh: '我喜欢', tag: '组合', groupId: 'G_01' },
    { seq: 4, cardType: '积木', ru: 'еду', zh: '食物', tag: '补语', groupId: 'G_01' },
    { seq: 5, cardType: '完整句', ru: 'Я люблю еду', zh: '我喜欢食物', tag: '主谓宾', groupId: 'G_01' },
    { seq: 6, cardType: '积木', ru: 'не', zh: '不', tag: '否定', groupId: 'G_02' },
    { seq: 7, cardType: '积木', ru: 'не люблю', zh: '不喜欢', tag: '否定组合', groupId: 'G_02' },
    { seq: 8, cardType: '完整句', ru: 'Я не люблю еду', zh: '我不喜欢食物', tag: '否定句', groupId: 'G_02' },
  ]
  const ORIG = 'Я люблю еду'
  const ORIG_ZH = '我喜欢食物'

  test('合法表格 → ok:true 零错误', () => {
    const r = verifyTable(goodRows, ORIG, ORIG_ZH)
    assert.equal(r.ok, true)
    assert.deepEqual(r.errors, [])
  })

  test('序号跳号 → 报错', () => {
    const rows = goodRows.map((x) => ({ ...x }))
    rows[5].seq = 7 // 6 → 7（重复 7）
    const r = verifyTable(rows, ORIG, ORIG_ZH)
    assert.equal(r.ok, false)
    assert.ok(r.errors.some((e) => e.includes('序号不连续')))
  })

  test('非法 cardType / 空 ru / 空 zh → 报错', () => {
    const rows = goodRows.map((x) => ({ ...x }))
    rows[2].cardType = '词卡'
    assert.equal(verifyTable(rows, ORIG, ORIG_ZH).ok, false)
    const rows2 = goodRows.map((x) => ({ ...x }))
    rows2[3].ru = '  '
    assert.equal(verifyTable(rows2, ORIG, ORIG_ZH).ok, false)
    const rows3 = goodRows.map((x) => ({ ...x }))
    rows3[4].zh = ''
    assert.equal(verifyTable(rows3, ORIG, ORIG_ZH).ok, false)
  })

  test('骨架完整句 != 原句（含零宽字符攻击）→ 逐字符拦截', () => {
    const rows = goodRows.map((x) => ({ ...x }))
    rows[4].ru = 'Я люблю еду\u200B' // 零宽字符（\u200B 不被 trim/\\s 删除，必须由长度+逐字符校验拦住）
    const r = verifyTable(rows, ORIG, ORIG_ZH)
    assert.equal(r.ok, false)
    assert.ok(r.errors.some((e) => e.includes('不一致')))
    const rows2 = goodRows.map((x) => ({ ...x }))
    rows2[4].ru = 'Я люблю еда' // 宾格错误
    assert.equal(verifyTable(rows2, ORIG, ORIG_ZH).ok, false)
  })

  test('数字俄语化比较：原句 500 → 骨架 пятьсот 通过', () => {
    const rows = [
      { seq: 1, cardType: '积木', ru: 'Этому', zh: '这个（与格）', tag: '指示词', groupId: 'G_01' },
      { seq: 2, cardType: '积木', ru: 'городу', zh: '城市（与格）', tag: '名词', groupId: 'G_01' },
      { seq: 3, cardType: '积木', ru: 'уже', zh: '已经', tag: '副词', groupId: 'G_01' },
      { seq: 4, cardType: '积木', ru: 'пятьсот', zh: '五百', tag: '数词', groupId: 'G_01' },
      { seq: 5, cardType: '积木', ru: 'лет.', zh: '年（复数）', tag: '名词', groupId: 'G_01' },
      { seq: 6, cardType: '完整句', ru: 'Этому городу уже пятьсот лет.', zh: '这座城市已经有五百年的历史了。', tag: '完整句', groupId: 'G_01' },
    ]
    const r = verifyTable(rows, 'Этому городу уже 500 лет.', '这座城市已经有五百年的历史了。')
    assert.equal(r.ok, true)
  })

  test('零件覆盖：缺 token → 报错', () => {
    const rows = goodRows.map((x) => ({ ...x }))
    rows[3].ru = 'едушки' // 'еду' 只在第 4 行作为零件出现，改掉后必须拦截
    const r = verifyTable(rows, ORIG, ORIG_ZH)
    assert.equal(r.ok, false)
    assert.ok(r.errors.some((e) => e.includes('零件未覆盖')))
  })

  test('变体完整句重复原句 / zh 照抄原句翻译 → 报错', () => {
    const rows = goodRows.map((x) => ({ ...x }))
    rows[7].ru = 'Я люблю еду' // 重复骨架
    assert.equal(verifyTable(rows, ORIG, ORIG_ZH).ok, false)
    const rows2 = goodRows.map((x) => ({ ...x }))
    rows2[7].zh = '我喜欢食物' // 照抄原句翻译
    assert.equal(verifyTable(rows2, ORIG, ORIG_ZH).ok, false)
  })

  test('同组完整句重复（第 8 项）→ 报错', () => {
    const rows = goodRows.map((x) => ({ ...x }))
    rows.push({ seq: 9, cardType: '完整句', ru: 'Я не люблю еду', zh: '我不喜欢食物', tag: '否定句', groupId: 'G_02' })
    const r = verifyTable(rows, ORIG, ORIG_ZH)
    assert.equal(r.ok, false)
    assert.ok(r.errors.some((e) => e.includes('同组完整句重复')))
  })

  test('跨组完整句同 ru 不算重复（第 8 项边界）→ ok', () => {
    const rows = goodRows.map((x) => ({ ...x }))
    // G_03 出现与 G_02 相同的完整句（≠ 原句）→ 跨组允许
    rows.push({ seq: 9, cardType: '完整句', ru: 'Я не люблю еду', zh: '我不喜欢食物', tag: '复习', groupId: 'G_03' })
    const r = verifyTable(rows, ORIG, ORIG_ZH)
    assert.equal(r.ok, true)
  })
})

describe('jlTableEngine 5a：常量契约', () => {
  test('6 列表头与飞书模板完全一致（序号/卡片类型/俄语内容/中文翻译/语法标签/组ID）', () => {
    assert.deepEqual(TABLE_COLUMNS, ['序号', '卡片类型', '俄语内容', '中文翻译', '语法标签', '组ID'])
  })

  test('TEMPLATE_SECTIONS 恰好 20 类（句乐部 01-194 步反推的节奏套路库）', () => {
    assert.equal(TEMPLATE_SECTIONS.length, 20)
  })

  test('每个 section 有 id/name/steps 且 steps 非空；id 全局唯一', () => {
    const ids = new Set()
    for (const s of TEMPLATE_SECTIONS) {
      assert.ok(s.id && typeof s.id === 'string')
      assert.ok(s.name && typeof s.name === 'string')
      assert.ok(Array.isArray(s.steps) && s.steps.length > 0, `section ${s.id} 无 steps`)
      assert.ok(!ids.has(s.id), `section id 重复：${s.id}`)
      ids.add(s.id)
    }
  })

  test('每个 step 的 cardType 只允许 积木|完整句，kind 只允许 part|full|review', () => {
    const okCard = ['积木', '完整句']
    const okKind = ['part', 'full', 'review']
    for (const s of TEMPLATE_SECTIONS) {
      for (const st of s.steps) {
        assert.ok(okCard.includes(st.cardType), `${s.id} 非法 cardType: ${st.cardType}`)
        assert.ok(okKind.includes(st.kind), `${s.id} 非法 kind: ${st.kind}`)
        if (st.kind === 'full') {
          assert.ok(st.template && typeof st.template === 'string', `${s.id} full 步缺 template`)
        }
      }
    }
  })

  test('normalizeTableText：trim + 压缩空白（与 segmentEngine 对齐）', () => {
    assert.equal(normalizeTableText('  Я  люблю   еду '), 'Я люблю еду')
    assert.equal(normalizeTableText(''), '')
    assert.equal(normalizeTableText(null), '')
  })
})

describe('jlTableEngine 5b：aiFillTable（table-fill 单次调用层）', () => {
  // 合法表格（与 5a 相同的 8 行：骨架幕 G_01 + 否定幕 G_02）
  const goodRows = [
    { seq: 1, cardType: '积木', ru: 'Я', zh: '我', tag: '主语', groupId: 'G_01' },
    { seq: 2, cardType: '积木', ru: 'люблю', zh: '喜欢', tag: '谓语', groupId: 'G_01' },
    { seq: 3, cardType: '积木', ru: 'Я люблю', zh: '我喜欢', tag: '组合', groupId: 'G_01' },
    { seq: 4, cardType: '积木', ru: 'еду', zh: '食物', tag: '补语', groupId: 'G_01' },
    { seq: 5, cardType: '完整句', ru: 'Я люблю еду', zh: '我喜欢食物', tag: '主谓宾', groupId: 'G_01' },
    { seq: 6, cardType: '积木', ru: 'не', zh: '不', tag: '否定', groupId: 'G_02' },
    { seq: 7, cardType: '积木', ru: 'не люблю', zh: '不喜欢', tag: '否定组合', groupId: 'G_02' },
    { seq: 8, cardType: '完整句', ru: 'Я не люблю еду', zh: '我不喜欢食物', tag: '否定句', groupId: 'G_02' },
  ]
  const intents = [{ kind: 'full', cardType: '完整句', template: 'skeleton', compose: [] }]
  const opts = { sentence: 'Я люблю еду', tokens: ['Я', 'люблю', 'еду'], difficulty: 'easy' }

  test('成功：后端 ok + 前端 verifyTable 通过 → reviewStatus ok，httpPost 恰好 1 次', async () => {
    let calls = 0
    const r = await aiFillTable(intents, opts, {
      zh: '我喜欢食物',
      httpPost: async (url, body) => {
        calls++
        assert.equal(url, '/api/admin/segments/table-fill')
        assert.equal(body.sentence_hash, sentenceHash('Я люблю еду', 'easy'))
        assert.deepEqual(body.tokens, ['Я', 'люблю', 'еду'])
        return { ok: true, rows: goodRows }
      },
    })
    assert.equal(r.ok, true)
    assert.equal(r.reviewStatus, 'ok')
    assert.deepEqual(r.rows, goodRows)
    assert.equal(calls, 1)
  })

  test('fallback ×2 → 机械兜底 + pending，httpPost 恰好 2 次', async () => {
    let calls = 0
    const r = await aiFillTable(intents, opts, {
      httpPost: async () => {
        calls++
        return { ok: false, fallback: true, reason: 'fill_failed' }
      },
    })
    assert.equal(r.ok, false)
    assert.equal(r.pending, true)
    assert.equal(r.fallback, true)
    assert.ok(r.rows && r.rows.length > 0, '兜底不空数据')
    assert.ok(r.rows.every((row) => row.cardType === '积木' || row.cardType === '完整句'))
    assert.equal(r.rows.filter((x) => x.cardType === '完整句').length, 1)
    assert.equal(calls, 2)
  })

  test('fallback 后重试成功 → ok，httpPost 恰好 2 次', async () => {
    let calls = 0
    const r = await aiFillTable(intents, opts, {
      zh: '我喜欢食物',
      httpPost: async () => {
        calls++
        return calls === 1 ? { ok: false, fallback: true, reason: 'x' } : { ok: true, rows: goodRows }
      },
    })
    assert.equal(r.ok, true)
    assert.equal(r.reviewStatus, 'ok')
    assert.equal(calls, 2)
  })

  test('pending:true 第一次 → 不重试直接返回 pending，httpPost 恰好 1 次', async () => {
    let calls = 0
    const r = await aiFillTable(intents, opts, {
      httpPost: async () => {
        calls++
        return { ok: false, pending: true, reason: 'generating' }
      },
    })
    assert.equal(r.ok, false)
    assert.equal(r.pending, true)
    assert.equal(r.reason, 'generating')
    assert.equal(calls, 1)
  })

  test('后端 ok 但前端 verifyTable 失败 → console.error + 兜底 + pending，禁止静默', async () => {
    const errs = []
    const orig = console.error
    console.error = (...a) => errs.push(a)
    let calls = 0
    try {
      const r = await aiFillTable(intents, opts, {
        zh: '我喜欢食物',
        httpPost: async () => {
          calls++
          const bad = goodRows.map((x) => ({ ...x }))
          bad[4].ru = 'Я люблю еда' // 骨架完整句 != 原句
          return { ok: true, rows: bad }
        },
      })
      assert.equal(r.ok, false)
      assert.equal(r.pending, true)
      assert.equal(r.fallback, true)
      assert.equal(r.reason, 'verify_failed')
      assert.ok(errs.length >= 1 && errs[0][0].includes('verifyTable'), '必须 console.error')
      assert.equal(calls, 1)
    } finally {
      console.error = orig
    }
  })

  test('httpPost 抛错 → 重试 1 次 → 仍失败 → 机械兜底 + pending', async () => {
    let calls = 0
    const r = await aiFillTable(intents, opts, {
      httpPost: async () => {
        calls++
        throw new Error('network')
      },
    })
    assert.equal(r.ok, false)
    assert.equal(r.pending, true)
    assert.equal(r.fallback, true)
    assert.equal(r.reason, 'network')
    assert.equal(calls, 2)
  })

  test('机械兜底 buildMachineFallbackTable：逐词累积 + 完整句，序号连续', () => {
    const rows = buildMachineFallbackTable(['Я', 'люблю', 'еду'], '我喜欢食物')
    // n=3 → 单出3 + 组合1 + 完整句1 = 5 行（句乐部骨架节奏：Я / люблю / Я люблю / еду / Я люблю еду）
    assert.deepEqual(rows.map((r) => r.seq), [1, 2, 3, 4, 5])
    assert.equal(rows[0].ru, 'Я')
    assert.equal(rows[2].ru, 'Я люблю')
    assert.equal(rows[3].ru, 'еду')
    assert.equal(rows[4].ru, 'Я люблю еду')
    assert.equal(rows[4].zh, '我喜欢食物')
    assert.ok(rows.every((r) => r.groupId === 'G_01'))
  })
})

describe('jlTableEngine 5c：链生成（buildCoreChainIntent / buildShortChainIntent）', () => {
  const pool = {
    negation: [{ ru: 'не', zh: '不' }],
    time: [{ ru: 'сегодня', zh: '今天' }, { ru: 'сейчас', zh: '现在' }],
    place: [{ ru: 'здесь', zh: '这里' }],
    degree: [{ ru: 'очень', zh: '非常' }],
    evaluation: [{ ru: 'важно', zh: '重要' }, { ru: 'хорошо', zh: '好' }, { ru: 'невозможно', zh: '不可能' }, { ru: 'возможно', zh: '可能' }],
    predicates: [{ ru: 'хочу', zh: '想' }, { ru: 'нужно', zh: '需要' }, { ru: 'должен', zh: '必须' }],
    objects: [{ ru: 'делать это', zh: '做这个' }],
    preposition: [{ ru: 'для меня', zh: '对我来说' }],
    connector: [{ ru: 'поэтому', zh: '所以' }],
  }

  test('核心句长链（~40 步）：骨架占位开头 + review 收尾 + 组 ID 顺序 G_01..G_09 + 行数 25-45', () => {
    const intents = buildCoreChainIntent({ sentence: 'Я люблю еду', tokens: ['Я', 'люблю', 'еду'], pool, zh: '我喜欢食物' })
    assert.ok(intents.length > 25 && intents.length <= 45, `got ${intents.length}`)
    assert.equal(intents[0].template, 'skeleton')
    assert.deepEqual(intents[0].compose, [])
    assert.equal(intents[0].groupId, 'G_01')
    const reviews = intents.filter((x) => x.template === 'review')
    assert.equal(reviews.length, 4)
    assert.ok(reviews.every((x) => x.groupId === 'G_09'), '复习行必须收尾于 G_09')
    assert.equal(reviews.filter((x) => x.hint).length, 4, '复习行带 4 条中文 hint（2026-10-06：补全 hint 防止无 hint 复习行重复复制 last_full → dup_full fallback）')
    // 组 ID 顺序严格递增（G_01 → G_09）
    const groups = [...new Set(intents.map((x) => x.groupId))]
    assert.deepEqual(groups[0], 'G_01')
    assert.deepEqual(groups[groups.length - 1], 'G_09')
    for (let i = 1; i < groups.length; i++) {
      assert.ok(groups[i] > groups[i - 1], `组乱序：${groups[i - 1]} → ${groups[i]}`)
    }
  })

  test('核心句长链（~40 步）：predicates 词池索引 0（хочу），无 evaluation 消费', () => {
    const intents = buildCoreChainIntent({ sentence: 'Я люблю еду', tokens: ['Я', 'люблю', 'еду'], pool, zh: '' })
    const predIdx = intents.filter((x) => x.source === 'pool' && x.poolKey === 'predicates').map((x) => x.poolIndex)
    assert.deepEqual(predIdx, [0])
    const evIdx = intents.filter((x) => x.source === 'pool' && x.poolKey === 'evaluation').map((x) => x.poolIndex)
    assert.deepEqual(evIdx, [])
  })

  test('核心句长链：否定幕紧跟骨架；negation 模板词固定 не', () => {
    const intents = buildCoreChainIntent({ sentence: 'Я люблю еду', tokens: ['Я', 'люблю', 'еду'], pool, zh: '' })
    const negIdx = intents.findIndex((x) => x.groupId === 'G_02')
    assert.ok(negIdx > 0, '否定幕在骨架之后')
    const neRow = intents.find((x) => x.groupId === 'G_02' && x.source === 'template')
    assert.equal(neRow.templateText, 'не')
  })

  test('短链：骨架占位 + 否定 + 时间 + 地点 + 频率，行数 < 30，G_01..G_05', () => {
    const intents = buildShortChainIntent({ sentence: 'Это дом', tokens: ['Это', 'дом'], zh: '这是房子' })
    assert.ok(intents.length < 30, `got ${intents.length}`)
    assert.equal(intents[0].template, 'skeleton')
    const groups = [...new Set(intents.map((x) => x.groupId))]
    assert.deepEqual(groups, ['G_01', 'G_02', 'G_03', 'G_04', 'G_05'])
    assert.ok(intents.some((x) => x.template === 'negation'))
    assert.ok(intents.some((x) => x.template === 'time_pos'))
    assert.ok(intents.some((x) => x.template === 'place_pos'))
  })
})

describe('jlTableEngine 5c：组合层 generateUnitTableAsync（并发分批 + 分流）', () => {
  const goodRows = [
    { seq: 1, cardType: '积木', ru: 'Я', zh: '我', tag: '主语', groupId: 'G_01' },
    { seq: 2, cardType: '积木', ru: 'люблю', zh: '喜欢', tag: '谓语', groupId: 'G_01' },
    { seq: 3, cardType: '积木', ru: 'Я люблю', zh: '我喜欢', tag: '组合', groupId: 'G_01' },
    { seq: 4, cardType: '积木', ru: 'еду', zh: '食物', tag: '补语', groupId: 'G_01' },
    { seq: 5, cardType: '完整句', ru: 'Я люблю еду', zh: '我喜欢食物', tag: '主谓宾', groupId: 'G_01' },
    { seq: 6, cardType: '积木', ru: 'не', zh: '不', tag: '否定', groupId: 'G_02' },
    { seq: 7, cardType: '积木', ru: 'не люблю', zh: '不喜欢', tag: '否定组合', groupId: 'G_02' },
    { seq: 8, cardType: '完整句', ru: 'Я не люблю еду', zh: '我不喜欢食物', tag: '否定句', groupId: 'G_02' },
  ]
  const rowsThisHouse = [
    { seq: 1, cardType: '积木', ru: 'Это', zh: '这', tag: '指示词', groupId: 'G_01' },
    { seq: 2, cardType: '积木', ru: 'дом', zh: '房子', tag: '名词', groupId: 'G_01' },
    { seq: 3, cardType: '完整句', ru: 'Это дом', zh: '这是房子', tag: '主系表', groupId: 'G_01' },
    { seq: 4, cardType: '积木', ru: 'не', zh: '不', tag: '否定', groupId: 'G_02' },
    { seq: 5, cardType: '积木', ru: 'не дом', zh: '不是房子', tag: '否定组合', groupId: 'G_02' },
    { seq: 6, cardType: '完整句', ru: 'Это не дом', zh: '这不是房子', tag: '否定句', groupId: 'G_02' },
  ]
  const rowsWantEat = [
    { seq: 1, cardType: '积木', ru: 'Я', zh: '我', tag: '主语', groupId: 'G_01' },
    { seq: 2, cardType: '积木', ru: 'хочу', zh: '想', tag: '谓语', groupId: 'G_01' },
    { seq: 3, cardType: '积木', ru: 'Я хочу', zh: '我想', tag: '组合', groupId: 'G_01' },
    { seq: 4, cardType: '积木', ru: 'есть', zh: '吃', tag: '补语', groupId: 'G_01' },
    { seq: 5, cardType: '完整句', ru: 'Я хочу есть', zh: '我想吃', tag: '主谓宾', groupId: 'G_01' },
    { seq: 6, cardType: '积木', ru: 'не', zh: '不', tag: '否定', groupId: 'G_02' },
    { seq: 7, cardType: '积木', ru: 'не хочу', zh: '不想', tag: '否定组合', groupId: 'G_02' },
    { seq: 8, cardType: '完整句', ru: 'Я не хочу есть', zh: '我不想吃', tag: '否定句', groupId: 'G_02' },
  ]
  const units = [
    { ru: 'Я люблю еду', zh: '我喜欢食物' },
    { ru: 'Я люблю еду', zh: '我喜欢食物' },
    { ru: 'Я люблю еду', zh: '我喜欢食物' },
  ]
  const mixedUnits = [
    { ru: 'Я люблю еду', zh: '我喜欢食物' },
    { ru: 'Это дом', zh: '这是房子' },
    { ru: 'Я хочу есть', zh: '我想吃' },
  ]

  test('3 句全成功（第 1 句自动核心长链，其余短链）→ done:3 failed:0 pending:0', async () => {
    let calls = 0
    const seen = []
    const r = await generateUnitTableAsync(units, {
      httpPost: async (url, body) => {
        calls++
        seen.push(body.intents.length)
        return { ok: true, rows: goodRows }
      },
    })
    assert.equal(r.done.length, 3)
    assert.equal(r.failed.length, 0)
    assert.equal(r.pending.length, 0)
    assert.equal(calls, 3)
    // 第 1 句 = 核心长链（~40 步意图行），后两句 = 短链（<30）
    assert.ok(seen[0] > 25 && seen[0] <= 45, `核心句意图 ${seen[0]}`)
    assert.ok(seen[1] < 30, `短链意图 ${seen[1]}`)
    assert.ok(seen[2] < 30, `短链意图 ${seen[2]}`)
  })

  test('中间句网络错误 → aiFillTable 兜底 pending，其余 done:2，不阻塞整批', async () => {
    let calls = 0
    const r = await generateUnitTableAsync(mixedUnits, {
      httpPost: async (url, body) => {
        calls++
        // 按句子区分：'Это дом' 永远抛错（aiFillTable 重试 1 次仍失败 → 兜底 pending）
        if (body.russian_text === 'Это дом') throw new Error('network')
        return { ok: true, rows: body.russian_text === 'Я хочу есть' ? rowsWantEat : goodRows }
      },
    })
    assert.equal(r.done.length, 2)
    assert.equal(r.pending.length, 1)
    assert.equal(r.pending[0].reason, 'network')
    assert.equal(r.failed.length, 0)
    assert.ok(calls >= 4, `抛错句重试 1 次后共 ${calls} 次调用`)
  })

  test('空句子 → failed（empty_sentence），其余照常 done', async () => {
    let calls = 0
    const r = await generateUnitTableAsync([
      { ru: '', zh: '' },
      { ru: 'Я люблю еду', zh: '我喜欢食物' },
    ], {
      httpPost: async () => {
        calls++
        return { ok: true, rows: goodRows }
      },
    })
    assert.equal(r.failed.length, 1)
    assert.equal(r.failed[0].error, 'empty_sentence')
    assert.equal(r.done.length, 1)
  })

  test('1 句返回 pending → pending:1，其余 done', async () => {
    let calls = 0
    const r = await generateUnitTableAsync(units, {
      httpPost: async () => {
        calls++
        if (calls === 3) return { ok: false, pending: true, reason: 'generating' }
        return { ok: true, rows: goodRows }
      },
    })
    assert.equal(r.done.length, 2)
    assert.equal(r.pending.length, 1)
    assert.equal(r.pending[0].reason, 'generating')
    assert.equal(r.failed.length, 0)
  })

  test('批大小：batchSize=2 时并发峰值不超过 2', async () => {
    let active = 0
    let peak = 0
    const r = await generateUnitTableAsync(units, {
      batchSize: 2,
      httpPost: async () => {
        active++
        peak = Math.max(peak, active)
        await new Promise((res) => setTimeout(res, 5))
        active--
        return { ok: true, rows: goodRows }
      },
    })
    assert.equal(r.done.length, 3)
    assert.ok(peak <= 2, `并发峰值 ${peak}`)
  })
})

// ============ 2026-10-06：三档难度提示粒度拉开（easy 全量 / medium 只出≥2词组合积木 / hard 纯完整句） ============
describe('jlTableEngine 难度分档：三档步数与提示粒度不同', () => {
  const POOL = {
    negation: [{ ru: 'не', zh: '不' }],
    time: [{ ru: 'сейчас', zh: '现在' }, { ru: 'сегодня', zh: '今天' }],
    place: [{ ru: 'здесь', zh: '这里' }],
    degree: [{ ru: 'очень', zh: '非常' }],
    evaluation: [{ ru: 'важно', zh: '重要' }, { ru: 'хорошо', zh: '好' }, { ru: 'невозможно', zh: '不可能' }, { ru: 'возможно', zh: '可能' }],
    predicates: [{ ru: 'хочу', zh: '想' }, { ru: 'нужно', zh: '需要' }, { ru: 'должен', zh: '必须' }],
    objects: [{ ru: 'еду', zh: '食物', inf: 'есть' }],
    preposition: [{ ru: 'для меня', zh: '对我来说' }],
    connector: [{ ru: 'поэтому', zh: '所以' }],
  }
  const sentence = 'Я хочу читать книгу'
  const tokens = ['Я', 'хочу', 'читать', 'книгу']

  test('三档核心链可见行数严格递减：easy > medium > hard', () => {
    const easy = buildCoreChainIntent({ sentence, tokens, pool: POOL, zh: '我想读书', difficulty: 'easy' })
    const medium = buildCoreChainIntent({ sentence, tokens, pool: POOL, zh: '我想读书', difficulty: 'medium' })
    const hard = buildCoreChainIntent({ sentence, tokens, pool: POOL, zh: '我想读书', difficulty: 'hard' })
    const vis = (its) => its.filter((i) => !i.hidden)
    assert.ok(vis(easy).length > vis(medium).length, `easy(${vis(easy).length}) > medium(${vis(medium).length})`)
    assert.ok(vis(medium).length > vis(hard).length, `medium(${vis(medium).length}) > hard(${vis(hard).length})`)
    // 完整句数量三档一致，差异全在积木
    const fulls = (its) => its.filter((i) => i.kind === 'full').length
    assert.equal(fulls(easy), fulls(medium))
    assert.equal(fulls(medium), fulls(hard))
  })

  test('medium：单个词积木隐藏（hidden），组合块正常显示', () => {
    const medium = buildCoreChainIntent({ sentence, tokens, pool: POOL, zh: '我想读书', difficulty: 'medium' })
    const parts = medium.filter((i) => i.kind === 'part')
    // 显示的积木（非 hidden）只可能是组合块 / 多词模板词
    const visible = parts.filter((i) => !i.hidden)
    const visibleSingle = visible.filter((i) => i.role !== '组合' && (!i.templateText || i.templateText.trim().split(/\s+/).length < 2))
    assert.equal(visibleSingle.length, 0, `medium 显示积木不应有单字：${JSON.stringify(visibleSingle.map((s) => s.role))}`)
    // 单个词积木都在但标记 hidden（喂 ctx，不出表）
    const hiddenParts = parts.filter((i) => i.hidden)
    assert.ok(hiddenParts.length > 0, 'medium 有隐藏的一词积木')
    // 骨架占位交给后端分组（compose 空）
    const sk = medium.find((i) => i.template === 'skeleton')
    assert.equal(sk.compose.length, 0)
  })

  test('hard：全部积木隐藏，只有完整句显示；骨架直接引用全句', () => {
    const hard = buildCoreChainIntent({ sentence, tokens, pool: POOL, zh: '我想读书', difficulty: 'hard' })
    const visible = hard.filter((i) => !i.hidden)
    assert.equal(visible.filter((i) => i.kind === 'part').length, 0, 'hard 显示行不应有积木')
    assert.ok(hard.filter((i) => i.kind === 'part').length > 0, 'hard 积木隐藏但仍在（喂 ctx）')
    assert.ok(hard.filter((i) => i.kind === 'part' && i.hidden).length === hard.filter((i) => i.kind === 'part').length, 'hard 全部积木 hidden')
    const sk = hard.find((i) => i.template === 'skeleton')
    assert.equal(sk.compose.length, 1)
    assert.deepEqual(sk.compose[0].tokensRef, [0, 3])
  })

  test('短链三档同样分档：medium 显示积木均为组合/多词、hard 纯完整句', () => {
    const medium = buildShortChainIntent({ sentence, tokens, zh: '我想读书', difficulty: 'medium' })
    const hard = buildShortChainIntent({ sentence, tokens, zh: '我想读书', difficulty: 'hard' })
    const medVisible = medium.filter((i) => i.kind === 'part' && !i.hidden)
    const medSingle = medVisible.filter((i) => i.role !== '组合' && (!i.templateText || i.templateText.trim().split(/\s+/).length < 2))
    assert.equal(medSingle.length, 0, `medium 短链显示积木不应有单字：${JSON.stringify(medSingle.map((s) => s.role))}`)
    assert.equal(hard.filter((i) => i.kind === 'part' && !i.hidden).length, 0)
  })

  test('默认难度（不传 difficulty）= easy 全量', () => {
    const dft = buildCoreChainIntent({ sentence, tokens, pool: POOL, zh: '我想读书' })
    const easy = buildCoreChainIntent({ sentence, tokens, pool: POOL, zh: '我想读书', difficulty: 'easy' })
    assert.equal(dft.length, easy.length)
  })
})
