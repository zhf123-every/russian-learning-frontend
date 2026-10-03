// tests/segmentEngine.test.js —— P1 第 4 步单测框架（骨架阶段：预期全红 = not implemented）
// 运行：node --test tests/segmentEngine.test.js
// 第 5 步填实现后本文件逐项转绿。
// 覆盖 v2 锁定的 7 类场景：
//   1) AI 返回结构 = 索引 + 元数据（segments 含 indexes/type/chinese + 顶层 translation）
//   2) verifySegments 硬校验：索引并集不重不漏 + 组内连续 + 拼接逐字符 == 俄语化原句
//   3) translation 只展示不参与拼接校验；chinese/type 缺失或乱码允许留空，不阻塞主流程
//   4) 三档全生成：easy/medium 调 LLM（deps.httpPost），hard 前端直构不调 LLM
//   5) 未生成句 status='generating' → 前端降级读原句整句，不报错不卡住
//   6) 后端 fallback:true → 机械兜底+pending；后端成功但 verifySegments 失败 → console.error+上报后端+兜底+pending（禁止静默兜底）
//   7) 兜底 = 机械每3词一组 + review_status='pending'

import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeSentence,
  sentenceHash,
  splitTokens,
  aiSegment,
  verifyIndexes,
  verifySegments,
  buildMachineFallback,
  buildHardSegments,
  generateUnitSegmentsAsync,
  checkCache,
  saveSegments,
  withRetry403,
} from '../src/lib/segmentEngine.js'

// ---------- mock 工具 ----------
// 返回一个 httpPost：记录调用，按 { path: 响应 } 路由；未配置的路由抛错（模拟后端故障）。
export function makeHttpPost(routes = {}, calls = []) {
  const post = async (path, body) => {
    calls.push({ path, body })
    if (routes[path] === undefined) throw new Error(`mock httpPost 未配置路由: ${path}`)
    return routes[path]
  }
  post.calls = calls
  return post
}

const S1 = 'Я люблю книгу.'                      // 3 tokens：["Я","люблю","книгу."]
const S2 = 'Он читает книгу в школе.'            // 5 tokens
const S3 = 'Этому городу уже 500 лет.'           // 数字 → 俄语化后 5 tokens
const T1 = ['Я', 'люблю', 'книгу.']

// 固定搭配（中级禁止拆碎）："в школе" 必须整组
const G2 = [
  { indexes: [0, 1], type: 'phrase', chinese: '他读' },
  { indexes: [2], type: 'word', chinese: '书' },
  { indexes: [3, 4], type: 'prep_phrase', chinese: '在学校。' },
]

// ---------- 场景 1：normalizeSentence / sentenceHash ----------
describe('场景1 normalizeSentence & sentenceHash（原文俄语化 + 确定性 hash）', () => {
  test('数字俄语化：500 лет. → пятьсот лет.', () => {
    assert.equal(normalizeSentence('Этому городу уже 500 лет.'), 'Этому городу уже пятьсот лет.')
  })
  test('去首尾空白', () => {
    assert.equal(normalizeSentence('  Я люблю книгу.  '), 'Я люблю книгу.')
  })
  test('空输入返回空串（不抛错）', () => {
    assert.equal(normalizeSentence(''), '')
    assert.equal(normalizeSentence(null), '')
  })
  test('同句同难度 hash 确定且一致', () => {
    assert.equal(sentenceHash(S1, 'easy'), sentenceHash(S1, 'easy'))
  })
  test('不同句子 hash 不同；难度不参与 hash（后端 cache 键=(hash,difficulty) 两列）', () => {
    assert.notEqual(sentenceHash(S1, 'easy'), sentenceHash(S2, 'easy'))
    assert.equal(sentenceHash(S1, 'easy'), sentenceHash(S1, 'medium'))
  })
  test('hash 与后端一致性：sha256(normalizeSentence(text)).hex() 前 16 位（探针 H1 对齐）', () => {
    assert.equal(sentenceHash(S1, 'easy'), 'b186482aedd7d79f')
  })
})

// ---------- 场景 2：splitTokens ----------
describe('场景2 splitTokens（空格拆分 + 标点附着）', () => {
  test('普通句子拆为词', () => {
    assert.deepEqual(splitTokens(S1), ['Я', 'люблю', 'книгу.'])
  })
  test('独立标点附着到前一个词', () => {
    assert.deepEqual(splitTokens('Антон спросил Тома , куда он пошёл .'), ['Антон', 'спросил', 'Тома,', 'куда', 'он', 'пошёл.'])
  })
  test('词尾标点保持附着', () => {
    assert.deepEqual(splitTokens('Он читает книгу в школе.'), ['Он', 'читает', 'книгу', 'в', 'школе.'])
  })
  test('空句子返回空数组', () => {
    assert.deepEqual(splitTokens(''), [])
  })
  test('数字句流水线：splitTokens(normalize(s)) join == 俄语化原句（tokens 是 "пятьсот" 而非 "500"）', () => {
    const n = normalizeSentence('Этому городу уже 500 лет.')
    const toks = splitTokens(n)
    assert.deepEqual(toks, ['Этому', 'городу', 'уже', 'пятьсот', 'лет.'])
    assert.equal(toks.join(' '), n) // 与俄语化原句逐字符相等
  })
})

// ---------- 场景 3：verifyIndexes（结构 = 索引 + 元数据） ----------
describe('场景3 verifyIndexes（并集不重不漏 + 组内连续 + 升序重排）', () => {
  test('合法分组原样通过并升序重排', () => {
    const ok = [{ indexes: [2], type: 'word' }, { indexes: [0, 1], type: 'phrase' }]
    assert.deepEqual(verifyIndexes(ok, 3), [{ indexes: [0, 1], type: 'phrase' }, { indexes: [2], type: 'word' }])
  })
  test('重复索引 → null', () => {
    assert.equal(verifyIndexes([{ indexes: [0, 0] }, { indexes: [1] }], 3), null)
  })
  test('漏索引（并集不覆盖全部）→ null', () => {
    assert.equal(verifyIndexes([{ indexes: [0, 1] }], 3), null)
  })
  test('越界索引 → null', () => {
    assert.equal(verifyIndexes([{ indexes: [0, 1, 5] }], 3), null)
  })
  test('组内不连续（跳号）→ null', () => {
    assert.equal(verifyIndexes([{ indexes: [0, 2] }, { indexes: [1] }], 3), null)
  })
  test('非整数/布尔索引 → null', () => {
    assert.equal(verifyIndexes([{ indexes: ['0'] }, { indexes: [1, 2] }], 3), null)
    assert.equal(verifyIndexes([{ indexes: [true] }, { indexes: [1, 2] }], 3), null)
  })
})

// ---------- 场景 4：verifySegments（硬校验 + translation/chinese 容错） ----------
describe('场景4 verifySegments（拼接逐字符 == 原句；translation 不参与校验；chinese/type 缺失不阻塞）', () => {
  test('拼接 == 俄语化原句 → ok', () => {
    const r = verifySegments(G2, ['Он', 'читает', 'книгу', 'в', 'школе.'], 'Он читает книгу в школе.')
    assert.equal(r.ok, true)
    assert.equal(r.rebuilt, 'Он читает книгу в школе.')
  })
  test('拼接 != 原句 → ok=false 且给出差异（tokens 未俄语化 vs 原句已俄语化）', () => {
    const bad = [{ indexes: [0] }, { indexes: [1] }, { indexes: [2] }, { indexes: [3] }, { indexes: [4] }]
    const r = verifySegments(bad, ['Этому', 'городу', 'уже', '500', 'лет.'], 'Этому городу уже пятьсот лет.')
    assert.equal(r.ok, false)
    assert.ok(Array.isArray(r.errors) && r.errors.length > 0)
  })
  test('translation 缺失/乱码不参与拼接校验，chinese/type 缺失允许留空不阻塞', () => {
    const r = verifySegments([{ indexes: [0] }, { indexes: [1, 2] }], T1, 'Я люблю книгу.')
    assert.equal(r.ok, true) // chinese/type 缺失不影响拼接结果
  })
  test('故意插入零宽字符 U+200B → 逐字符比较必须拦下', () => {
    const r = verifySegments([{ indexes: [0] }, { indexes: [1] }, { indexes: [2] }], ['Я', 'люблю', 'книгу.'], 'Я люблю кни\u200Bгу.')
    assert.equal(r.ok, false) // 肉眼不可见但 charCodeAt 逐字符比较能发现
    assert.ok(r.errors.length > 0)
  })
})

// ---------- 场景 5：aiSegment（三档生成，deps.httpPost 注入；内部结构返回） ----------
describe('场景5 aiSegment（easy/medium 调 LLM，hard 直构；fallback 重试1次；pending 不重试；内存缓存）', () => {
  test('easy：deps.httpPost 收到 sentence_hash/russian_text/tokens/difficulty；返回内部结构', async () => {
    const post = makeHttpPost({ '/api/admin/segments/llm-segment': { ok: true, segments: [{ indexes: [0, 1], type: 'phrase', chinese: '我爱' }, { indexes: [2], type: 'word', chinese: '书。' }], translation: '我爱书。' } })
    const r = await aiSegment({ sentence: S1, tokens: T1, difficulty: 'easy' }, { httpPost: post })
    assert.equal(post.calls.length, 1)
    const b = post.calls[0].body
    assert.equal(b.sentence_hash, sentenceHash(S1, 'easy'))
    assert.equal(b.russian_text, 'Я люблю книгу.')
    assert.deepEqual(b.tokens, T1)
    assert.equal(b.difficulty, 'easy')
    assert.equal(r.reviewStatus, 'ok')
    assert.equal(r.translation, '我爱书。')
    assert.deepEqual(r.tokens, T1)
    assert.equal(r.sentenceHash, sentenceHash(S1, 'easy'))
    assert.deepEqual(r.segments, [{ indexes: [0, 1], type: 'phrase', chinese: '我爱' }, { indexes: [2], type: 'word', chinese: '书。' }])
  })
  test('medium：走后端 llm-segment，固定搭配整组保留', async () => {
    const post = makeHttpPost({ '/api/admin/segments/llm-segment': { ok: true, segments: [{ indexes: [0, 1], type: 'phrase', chinese: '他读' }, { indexes: [2], type: 'word', chinese: '书' }, { indexes: [3, 4], type: 'prep_phrase', chinese: '在学校。' }], translation: '他在学校读书。' } })
    const r = await aiSegment({ sentence: S2, tokens: ['Он', 'читает', 'книгу', 'в', 'школе.'], difficulty: 'medium' }, { httpPost: post })
    assert.equal(r.reviewStatus, 'ok')
    assert.deepEqual(r.segments[2].indexes, [3, 4]) // 固定搭配整组
  })
  test('hard：不调 LLM（httpPost 调用 0 次），前端直构整句一组', async () => {
    const post = makeHttpPost({})
    const r = await aiSegment({ sentence: S2, tokens: ['Он', 'читает', 'книгу', 'в', 'школе.'], difficulty: 'hard' }, { httpPost: post })
    assert.equal(post.calls.length, 0)
    assert.equal(r.reviewStatus, 'ok')
    assert.deepEqual(r.segments, [{ indexes: [0, 1, 2, 3, 4], type: 'sentence', chinese: '' }]) // translation 留空，P2 补
  })
  test('后端 fallback:true → 重试 1 次；仍失败 → 机械兜底 + pending', async () => {
    const calls = []
    const post = makeHttpPost({ '/api/admin/segments/llm-segment': { ok: false, fallback: true } }, calls)
    const r = await aiSegment({ sentence: 'Этому городу уже 500 лет.', difficulty: 'easy' }, { httpPost: post })
    assert.equal(calls.length, 2) // 首次 + 重试 1 次
    assert.equal(r.reviewStatus, 'pending')
    assert.deepEqual(r.segments.map((s) => s.text), ['Этому городу уже', 'пятьсот лет.']) // 机械每 3 词
  })
  test('后端 pending:true → 不重试，返回 reviewStatus=generating（占位在途，非人工校对）', async () => {
    const calls = []
    const post = makeHttpPost({ '/api/admin/segments/llm-segment': { ok: false, pending: true } }, calls)
    const r = await aiSegment({ sentence: S1, tokens: T1, difficulty: 'medium' }, { httpPost: post })
    assert.equal(calls.length, 1)
    assert.equal(r.reviewStatus, 'generating') // 与 AI 失败(校对 pending)区分
    assert.deepEqual(r.segments, [])
  })
  test('deps 缺失 httpPost → 抛错（含 httpPost 字样，不静默用全局 fetch）', async () => {
    await assert.rejects(() => aiSegment({ sentence: S1, tokens: T1, difficulty: 'easy' }), /httpPost/)
  })
  test('内存缓存：第二次同句同难度 → httpPost 调用 0 次', async () => {
    const calls = []
    const post = makeHttpPost({
      '/api/admin/segments/llm-segment': { ok: true, segments: [{ indexes: [0] }, { indexes: [1] }, { indexes: [2] }, { indexes: [3] }, { indexes: [4] }], translation: '他在学校读书。' },
    }, calls)
    await aiSegment({ sentence: S2, tokens: ['Он', 'читает', 'книгу', 'в', 'школе.'], difficulty: 'easy' }, { httpPost: post })
    assert.equal(calls.length, 1)
    const r2 = await aiSegment({ sentence: S2, tokens: ['Он', 'читает', 'книгу', 'в', 'школе.'], difficulty: 'easy' }, { httpPost: post })
    assert.equal(calls.length, 1) // 第二次未发起网络请求
    assert.equal(r2.reviewStatus, 'ok')
  })
})

// ---------- 场景 6：兜底链路（机械兜底 + pending + 告警上报，禁止静默） ----------
describe('场景6 兜底链路（buildMachineFallback + verifySegments 失败告警上报）', () => {
  test('机械兜底：每 3 词一组，末组按实际，review_status=pending', () => {
    const f = buildMachineFallback(['Он', 'читает', 'книгу', 'в', 'школе.'])
    assert.equal(f.review_status, 'pending')
    assert.deepEqual(f.segments.map((s) => s.text), ['Он читает книгу', 'в школе.'])
  })
  test('hard 直构：整句一组 type=sentence chinese=translation', () => {
    assert.deepEqual(buildHardSegments(T1, '我爱书。'), [{ indexes: [0, 1, 2], type: 'sentence', chinese: '我爱书。' }])
  })
  test('后端成功但前端 verify 失败 → console.error + saveSegments 回写 pending（禁止静默兜底）', async () => {
    const calls = []
    let errCalls = 0
    const origErr = console.error
    console.error = (...a) => { errCalls++; origErr(...a) }
    try {
      const post = makeHttpPost({
        '/api/admin/segments/llm-segment': { ok: true, segments: [{ indexes: [0] }, { indexes: [1, 1] }], translation: '我的兄弟在读书。' }, // 重复索引 → verifyIndexes 失败
        '/api/admin/segments/save': { ok: true, saved: 1 },
      }, calls)
      const r = await generateUnitSegmentsAsync({
        courseId: 'c', unitId: 'u',
        sentences: [{ russian: 'Мой брат читает книгу.' }],
        difficulties: ['easy'],
      }, { httpPost: post })
      assert.equal(r.done.length, 0)
      assert.equal(r.failed.length, 0)
      assert.equal(r.pending.length, 1) // 机械兜底进校对队列
      assert.equal(r.pending[0].reason, 'ai_fallback_machine')
      assert.ok(calls.some((c) => c.path === '/api/admin/segments/save' && c.body.items[0].status === 'pending'))
      assert.ok(errCalls >= 2, `console.error 至少 2 次，实际 ${errCalls}`) // verifyIndexes 失败 + 机械兜底
    } finally {
      console.error = origErr
    }
  })
})

// ---------- 场景 7：generateUnitSegmentsAsync / checkCache / saveSegments ----------
describe('场景7 批量生成与缓存读取（并发上限、单句失败不阻塞、generating 降级）', () => {
  test('3 句并发，中间 1 句 httpPost 抛 Error(network) → done 2 / failed 1 / pending 0', async () => {
    const calls = []
    const post = async (path, body) => {
      calls.push({ path, body })
      if (path === '/api/admin/segments/llm-segment') {
        if (body.russian_text === 'СРЕДНЯЯ СТРОКА.') throw new Error('network')
        const n = body.tokens.length
        return { ok: true, segments: Array.from({ length: n }, (_, i) => ({ indexes: [i] })), translation: '（译文）' }
      }
      if (path === '/api/admin/segments/save') return { ok: true, saved: 1 }
      throw new Error('unknown path: ' + path)
    }
    const r = await generateUnitSegmentsAsync({
      courseId: 'c', unitId: 'u',
      sentences: [{ russian: 'Мой брат читает книгу.' }, { russian: 'СРЕДНЯЯ СТРОКА.' }, { russian: 'Девочка рисует дом.' }],
      difficulties: ['easy'],
    }, { httpPost: post })
    assert.equal(r.done.length, 2)
    assert.equal(r.failed.length, 1)
    assert.equal(r.failed[0].error, 'network')
    assert.equal(r.pending.length, 0)
    // 两成功句各自 save（status=ok，且带 sentence=俄语化原句供后端 cache 溯源）
    const okSaves = calls.filter((c) => c.path === '/api/admin/segments/save' && c.body.items[0].status === 'ok')
    assert.equal(okSaves.length, 2)
    assert.ok(okSaves.every((c) => typeof c.body.items[0].sentence === 'string' && c.body.items[0].sentence.length > 0))
  })
  test('并发上限 ≤ 5（BATCH=3 分批，12 句全完成，单句失败不阻塞）', async () => {
    let inFlight = 0
    let maxInFlight = 0
    const post = async (path, body) => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((r) => setTimeout(r, 20))
      inFlight--
      if (path === '/api/admin/segments/llm-segment') {
        const n = body.tokens.length
        return { ok: true, segments: Array.from({ length: n }, (_, i) => ({ indexes: [i] })), translation: '（译文）' }
      }
      if (path === '/api/admin/segments/save') return { ok: true, saved: 1 }
      throw new Error('unknown path: ' + path)
    }
    const sentences = Array.from({ length: 12 }, (_, i) => ({ russian: `Урок номер ${i + 1}.` }))
    const r = await generateUnitSegmentsAsync({ courseId: 'c', unitId: 'u', sentences, difficulties: ['easy'] }, { httpPost: post })
    assert.ok(maxInFlight <= 5, `并发 ${maxInFlight} > 5`)
    assert.equal(r.done.length, 12)
    assert.equal(r.failed.length, 0)
    assert.equal(r.pending.length, 0)
  })
  test('checkCache：返回 Map（key=sentenceHash::difficulty），status=generating / segments 空 → 供前端降级', async () => {
    const post = makeHttpPost({ '/api/segments?course_id=c&unit_id=u': { ok: true, items: [{ sentence_hash: sentenceHash(S1, 'easy'), difficulty: 'easy', status: 'generating', segments: [] }] } })
    const r = await checkCache({ courseId: 'c', unitId: 'u' }, { httpPost: post })
    assert.ok(r instanceof Map)
    const it = r.get(`${sentenceHash(S1, 'easy')}::easy`)
    assert.equal(it.status, 'generating')
    assert.deepEqual(it.segments, [])
  })
  test('saveSegments：转发 items 到 /api/admin/segments/save', async () => {
    const calls = []
    const post = makeHttpPost({ '/api/admin/segments/save': { ok: true, saved: 1 } }, calls)
    const r = await saveSegments({ courseId: 'c', unitId: 'u', items: [{ sentence_hash: sentenceHash(S1, 'easy'), difficulty: 'easy', segments: [{ sort_order: 0, text: 'Я люблю', type: 'phrase', chinese: '我爱' }], status: 'ok', translation: '我爱书。' }] }, { httpPost: post })
    assert.equal(r.ok, true)
    assert.equal(calls[0].path, '/api/admin/segments/save')
  })
})

describe('场景8 withRetry403（TiDB 冷启动 403 自动重试 1 次）', () => {
  test('403 → 自动重试 1 次 → 第二次成功', async () => {
    let calls = 0
    const post = async () => { calls++; if (calls === 1) throw Object.assign(new Error('403'), { status: 403 }); return { ok: true } }
    const wrapped = await withRetry403(post)
    const r = await wrapped('/api/admin/segments/check', {})
    assert.deepEqual(r, { ok: true })
    assert.equal(calls, 2)
  })
  test('连续 403 → 重试后仍抛出（调用 2 次）', async () => {
    let calls = 0
    const post = async () => { calls++; throw Object.assign(new Error('403'), { status: 403 }) }
    const wrapped = await withRetry403(post)
    await assert.rejects(() => wrapped('/api/x', {}), (e) => e.status === 403)
    assert.equal(calls, 2)
  })
  test('网络错误（无 status）→ 不重试，直接抛', async () => {
    let calls = 0
    const post = async () => { calls++; throw new Error('network') }
    const wrapped = await withRetry403(post)
    await assert.rejects(() => wrapped('/api/x', {}), /network/)
    assert.equal(calls, 1)
  })
  test('非 403（如 500）→ 不重试，直接抛', async () => {
    let calls = 0
    const post = async () => { calls++; throw Object.assign(new Error('500'), { status: 500 }) }
    const wrapped = await withRetry403(post)
    await assert.rejects(() => wrapped('/api/x', {}), (e) => e.status === 500)
    assert.equal(calls, 1)
  })
  test('httpPost 非函数 → 构造时抛错', async () => {
    await assert.rejects(() => withRetry403(null), /httpPost 必须为函数/)
  })
})
