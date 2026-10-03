// segmentEngine.js —— 语块化（segments）引擎（P1 第 5a 步：纯函数层已实现）
// 设计基线（v2 已锁定）：
//   - AI 只做"分组决策"（返回索引组 + type/chinese + 顶层 translation），绝不返回句子文本
//   - 文本一律从 splitTokens 机械截取，拼接天然等于原句；verifySegments 逐字符硬校验
//   - 难度=拆分粒度：easy=允许单字成组(固定搭配整组)；medium=最小单元短语/语块；hard=整句一组(不调 AI)
//   - 兜底=机械每3词一组 + review_status='pending'；前端禁止静默兜底（console.error + 上报后端）
//   - AI 调用一律走后端 llm-segment（deps.httpPost 注入），前端绝不直调 LLM
// 字段命名全程 type，禁止 segment_type。
//
// 关于局部复制：splitTokens / numberToRussian 规则与 snowballEngine.js 逐字符一致，
// 但 snowballEngine 内部 import './ai'（无扩展名）在 node ESM 下无法解析，故在此等价复制
// 并由"单测 + 前后端 Python 比对"双重锁定，防止规则漂移。sha256 为浏览器/Node 通用纯 JS 实现
// （不依赖 node:crypto，保证 Vite 生产构建可用）。

// ---------- 数字俄语化（与 snowballEngine.numberToRussian 逐字符一致） ----------
const RU_N1 = ['ноль', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять', 'десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать']
const RU_N10 = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто']
const RU_N100 = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот']
const RU_N1000 = ['', 'тысяча', 'две тысячи', 'три тысячи', 'четыре тысячи', 'пять тысяч', 'шесть тысяч', 'семь тысяч', 'восемь тысяч', 'девять тысяч']
function numberToRussian(n) {
  n = Math.floor(n)
  if (n < 0) return '-' + numberToRussian(-n)
  if (n < 20) return RU_N1[n]
  if (n < 100) return (RU_N10[Math.floor(n / 10)] + (n % 10 ? ' ' + RU_N1[n % 10] : '')).trim()
  if (n < 1000) return (RU_N100[Math.floor(n / 100)] + (n % 100 ? ' ' + numberToRussian(n % 100) : '')).trim()
  if (n < 10000) return (RU_N1000[Math.floor(n / 1000)] + (n % 1000 ? ' ' + numberToRussian(n % 1000) : '')).trim()
  return String(n)
}
function russianizeNumbers(text) {
  return String(text || '').replace(/\d+/g, (m) => numberToRussian(parseInt(m, 10)))
}

// ---------- 拆分（与 snowballEngine.splitTokens 逐字符一致） ----------
function splitTokensLikeSnowball(sentence) {
  const raw = String(sentence || '').trim().split(/\s+/).filter(Boolean)
  const tokens = []
  for (const w of raw) {
    if (/^[.,!?;:…]+$/.test(w) && tokens.length) {
      tokens[tokens.length - 1] += w
    } else {
      tokens.push(w)
    }
  }
  return tokens
}

// ---------- sha256（纯 JS 同步实现；浏览器/Node 通用） ----------
const SHA_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]
function sha256Hex(msg) {
  // 必须先 UTF-8 编码（TextEncoder 同步，浏览器/Node 通用），与 Python hashlib sha256(bytes) 一致
  const m = Array.from(new TextEncoder().encode(String(msg)))
  const bitLen = m.length * 8
  m.push(0x80)
  while (m.length % 64 !== 56) m.push(0)
  const lenHi = Math.floor(bitLen / 0x100000000), lenLo = bitLen >>> 0
  for (let i = 3; i >= 0; i--) m.push((lenHi >>> (i * 8)) & 0xff)
  for (let i = 3; i >= 0; i--) m.push((lenLo >>> (i * 8)) & 0xff)
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a,
      h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19
  const w = new Array(64)
  const rotr = (x, n) => ((x >>> n) | (x << (32 - n))) >>> 0
  for (let off = 0; off < m.length; off += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = ((m[off + i * 4] << 24) | (m[off + i * 4 + 1] << 16) | (m[off + i * 4 + 2] << 8) | m[off + i * 4 + 3]) >>> 0
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      const ch = (e & f) ^ (~e & g)
      const t1 = (h + S1 + ch + SHA_K[i] + w[i]) >>> 0
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const t2 = (S0 + maj) >>> 0
      h = g; g = f; f = e; e = (d + t1) >>> 0
      d = c; c = b; b = a; a = (t1 + t2) >>> 0
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0
  }
  const hex = (x) => (x >>> 0).toString(16).padStart(8, '0')
  return hex(h0) + hex(h1) + hex(h2) + hex(h3) + hex(h4) + hex(h5) + hex(h6) + hex(h7)
}

// 归一化句子：去首尾空白 + 数字俄语化（"500 лет." → "пятьсот лет."）。
// 作为 sentence_hash 的输入原文（俄语化后），避免 tokenizer 升级导致缓存失效。
export function normalizeSentence(text) {
  const s = String(text ?? '').trim()
  if (!s) return ''
  return russianizeNumbers(s)
}

// 生成句子 hash：sha256(normalizeSentence(text)).hex() 前 16 位。
// 难度不参与 hash 值；后端全局缓存键 = (sentence_hash, difficulty) 两列联合唯一。
export function sentenceHash(text, difficulty) {
  return sha256Hex(normalizeSentence(text)).slice(0, 16)
}

// 拆 token：按空格拆分；独立标点（", " 开头）附着到前一个词；词尾标点保持附着。
export function splitTokens(sentence) {
  return splitTokensLikeSnowball(sentence)
}

// 模块级内存缓存：key = `${sentenceHash}::${difficulty}`；只缓存成功(ok)结果，失败/兜底/在途态不缓存以便补跑。
// **边界声明**：这是进程内缓存，只优化单会话内的重复请求；权威源是后端 sentence_segment_cache 表（跨设备/跨会话）。
// **不参与 reviewStatus 判定**：状态判定只以 llm-segment 响应 + 前端 verify 结果为准，缓存命中只是直接复用此前 ok 的结果。
const aiCache = new Map()

// 调后端 llm-segment 做 AI 切块（后端持 key，幂等三分支）。
// 流水线顺序固定：normalizeSentence(sentence) → sentenceHash → splitTokens(俄语化后) → POST → verifyIndexes → verifySegments。
// retry：收到 {fallback:true} → 重试 1 次；{pending:true} → 不重试，返回 reviewStatus='generating'（占位行在途，等补跑）；
// 重试仍失败 → buildMachineFallback + reviewStatus='pending'（人工校对队列）。
// 返回内部结构 { segments(索引组), translation, reviewStatus, tokens, sentenceHash }——不是入库格式；
// 文本截取与 sort_order 赋值由 saveSegments 环节（入库准备）负责。
// reviewStatus 语义：'ok'=AI 切块通过；'pending'=AI 失败机械兜底，需人工校对；'generating'=后端占位在途，不写不报。
// deps.httpPost(path, body) 必须注入；缺失时抛错（消息含 httpPost，禁止静默兜底/直连 LLM）。
export async function aiSegment({ sentence, tokens, difficulty }, deps = {}) {
  if (!deps || typeof deps.httpPost !== 'function') {
    throw new Error('aiSegment: deps.httpPost 必须注入（前端禁止直连 LLM）')
  }
  const d = String(difficulty || 'medium').trim()
  const normalized = normalizeSentence(sentence)
  const tks = Array.isArray(tokens) && tokens.length ? tokens.slice() : splitTokens(normalized)
  const hash = sentenceHash(sentence, d)
  const cacheKey = `${hash}::${d}`
  if (aiCache.has(cacheKey)) return aiCache.get(cacheKey)
  // hard 档不调 AI：前端直构（translation 留空，P2 从课程已有翻译补齐）
  if (d === 'hard') {
    const hardResult = { segments: buildHardSegments(tks, ''), translation: '', reviewStatus: 'ok', tokens: tks, sentenceHash: hash }
    aiCache.set(cacheKey, hardResult)
    return hardResult
  }
  const callOnce = async () =>
    deps.httpPost('/api/admin/segments/llm-segment', {
      sentence_hash: hash, russian_text: normalized, tokens: tks, difficulty: d,
    })
  // 注意：HTTP/JSON 层异常不在此吞掉——向上抛，由调用方（generateUnitSegmentsAsync）catch 进 failed；
  // 只有后端明确返回 {ok:false,fallback:true}（业务失败）才走"重试 1 次 → 机械兜底 pending"。
  const makeGenerating = (segments) => ({ segments, translation: '', reviewStatus: 'generating', tokens: tks, sentenceHash: hash })
  let resp = await callOnce()
  if (resp && resp.ok === false && resp.pending) {
    return makeGenerating([]) // 占位行在途，等补跑：不重试、不缓存、不进补跑列表
  }
  for (let attempt = 1; attempt <= 2; attempt++) {
    if (attempt === 2) resp = await callOnce() // fallback / 校验失败 → 重试 1 次
    if (resp && resp.ok === true && Array.isArray(resp.segments)) {
      const ordered = verifyIndexes(resp.segments, tks.length)
      const translation = String(resp.translation || '').trim()
      if (ordered) {
        const groups = ordered.map((g) => ({ indexes: g.indexes.slice(), type: String(g.type || 'chunk'), chinese: String(g.chinese || '') }))
        const v = verifySegments(groups, tks, normalized)
        if (v.ok) {
          const result = { segments: groups, translation, reviewStatus: 'ok', tokens: tks, sentenceHash: hash }
          aiCache.set(cacheKey, result)
          return result
        }
        console.error('[segmentEngine] verifySegments 失败（后端成功但拼接不通过）', { sentenceHash: hash, difficulty: d, rebuilt: v.rebuilt, russianized: normalized, errors: v.errors })
      } else {
        console.error('[segmentEngine] verifyIndexes 失败（索引非法）', { sentenceHash: hash, difficulty: d, segments: resp.segments })
      }
      if (attempt === 1) continue
      break
    }
    if (resp && resp.ok === false && resp.pending) {
      return makeGenerating([])
    }
    if (resp && resp.ok === false && resp.fallback) {
      if (attempt === 1) continue
      break
    }
    break // 未知响应，不再重试
  }
  // 重试仍失败 → 机械兜底 + pending（禁止静默兜底：已 console.error）
  // **契约**：reviewStatus='pending' 时 segments 为**入库格式**（sort_order/text，buildMachineFallback 直接产出，
  // 整体作为 items[].segments，不再走 aiResultToInbound）；'ok'/'generating' 时为索引组 {indexes,type,chinese}。
  console.error('[segmentEngine] AI 切块两次均失败/校验未过，机械兜底 + pending', { sentenceHash: hash, difficulty: d })
  return { segments: buildMachineFallback(tks).segments, translation: '', reviewStatus: 'pending', tokens: tks, sentenceHash: hash }
}

// 索引组 → 入库格式：机械截取 tokens 生成 text、按序赋 sort_order。
// 这是"文本截取与 sort_order 赋值"的落地处（aiSegment 只返回索引组，不产出入库 segments）。
function aiResultToInbound(job, r) {
  return [{
    sentence_hash: job.sentenceHash,
    difficulty: job.difficulty,
    segments: r.segments.map((g, idx) => ({
      sort_order: idx,
      text: g.indexes.map((i) => r.tokens[i]).join(' '),
      type: g.type,
      chinese: g.chinese,
    })),
    status: r.reviewStatus,
    translation: r.translation,
  }]
}

// 读课时语块（公开接口）：GET /api/segments → 转 Map。
// key = `${sentence_hash}::${difficulty}`，value = 后端 item（含 status/translation/segments）。
// status='generating' 或 segments 空 → 调用方（练习页）降级读原句整句，不报错不卡住。
// deps.httpPost(path) 注入。
export async function checkCache({ courseId, unitId }, deps = {}) {
  if (!deps || typeof deps.httpPost !== 'function') {
    throw new Error('checkCache: deps.httpPost 必须注入')
  }
  const path = `/api/segments?course_id=${encodeURIComponent(courseId)}&unit_id=${encodeURIComponent(unitId)}`
  const r = await deps.httpPost(path)
  const map = new Map()
  for (const it of (Array.isArray(r.items) ? r.items : [])) {
    map.set(`${it.sentence_hash}::${it.difficulty}`, it)
  }
  return map
}

// 写语块：POST /api/admin/segments/save（后端 upsert，幂等；尾部裁剪由后端负责，本函数不裁剪）。
// items 为入库格式：[{ sentence_hash, difficulty, segments:[{sort_order,text,type,chinese}], status, translation }]。
// deps.httpPost(path, body) 注入；返回后端响应（{ok,saved}）。
export async function saveSegments({ courseId, unitId, items }, deps = {}) {
  if (!deps || typeof deps.httpPost !== 'function') {
    throw new Error('saveSegments: deps.httpPost 必须注入')
  }
  return deps.httpPost('/api/admin/segments/save', { courseId, unitId, items })
}

// 索引校验（纯函数，只管"索引"层）：并集==0..n-1 不重不漏 + 每组 indexes 连续递增 + 索引为合法整数；
// 通过则按首索引升序重排返回，非法返回 null。**不接触文本内容**——
// 职责边界：verifyIndexes 管"索引全覆盖 + 组内连续 + 无越界/重复"；文本拼接对错由 verifySegments 管。
export function verifyIndexes(groups, n) {
  if (!Array.isArray(groups) || groups.length === 0) return null
  const seen = new Set()
  for (const g of groups) {
    const idx = g && g.indexes
    if (!Array.isArray(idx) || idx.length === 0) return null
    for (const i of idx) {
      if (typeof i !== 'number' || !Number.isInteger(i) || i < 0 || i >= n || seen.has(i)) return null
      seen.add(i)
    }
    for (let k = 1; k < idx.length; k++) {
      if (idx[k] !== idx[k - 1] + 1) return null
    }
  }
  if (seen.size !== n) return null
  return [...groups].sort((a, b) => a.indexes[0] - b.indexes[0])
}

// 拼接硬校验（纯函数，只管"文本"层）：按 tokens 机械截取重建后，charCodeAt 逐字符 == 俄语化原句。
// **调用方必须先跑 verifyIndexes 通过，再把索引组传进来**；本函数不重复检查索引合法性。
// translation 只展示不参与拼接校验；chinese/type 缺失或乱码允许留空，不阻塞主流程。
// 返回 { ok, rebuilt, errors: [] }。
export function verifySegments(groups, tokens, russianizedOriginal) {
  const errors = []
  if (!Array.isArray(groups) || groups.length === 0) {
    return { ok: false, rebuilt: '', errors: ['segments 为空'] }
  }
  let rebuilt = ''
  try {
    rebuilt = groups
      .map((g) => (g.indexes || []).map((i) => tokens[i]).join(' '))
      .join(' ')
  } catch (e) {
    return { ok: false, rebuilt: '', errors: ['索引重建失败：' + e.message] }
  }
  // 逐字符比较（charCodeAt），长度不同或任一字符码点不同都判定失败
  if (rebuilt.length !== russianizedOriginal.length) {
    errors.push(`长度不一致：重建 ${rebuilt.length} vs 原句 ${russianizedOriginal.length}`)
  } else {
    for (let i = 0; i < rebuilt.length; i++) {
      if (rebuilt.charCodeAt(i) !== russianizedOriginal.charCodeAt(i)) {
        errors.push(`第 ${i} 个字符不一致：重建 '${rebuilt[i]}'(U+${rebuilt.charCodeAt(i).toString(16).toUpperCase()}) vs 原句 '${russianizedOriginal[i]}'(U+${russianizedOriginal.charCodeAt(i).toString(16).toUpperCase()})`)
        break
      }
    }
  }
  return { ok: errors.length === 0, rebuilt, errors }
}

// 机械兜底：每 3 词一组（末组不足 3 词按实际），打标 pending（待人工校对）。
// 返回 { segments:[{sort_order,text,type,chinese}], review_status:'pending' }。
export function buildMachineFallback(tokens) {
  const segments = []
  for (let i = 0; i < tokens.length; i += 3) {
    segments.push({ sort_order: segments.length, text: tokens.slice(i, i + 3).join(' '), type: 'chunk', chinese: '' })
  }
  return { segments, review_status: 'pending' }
}

// hard 档直构（不调 AI）：整句一组，type='sentence'，chinese=translation。
// 返回 [{ indexes:[0..n-1], type:'sentence', chinese }]。
export function buildHardSegments(tokens, translation) {
  return [{ indexes: tokens.map((_, i) => i), type: 'sentence', chinese: translation || '' }]
}

// 保存课时时自动触发：对每个 (句,难度) 调 aiSegment → 入库准备 → saveSegments。
// **并发用分批实现（slice + Promise.all），批大小 BATCH=3（上限 3-5 内）**；
// **单句 catch 只包 HTTP 层和 JSON 解析层**：业务兜底/在途不是失败（reviewStatus 判定由 aiSegment 完成）。
// verifySegments 失败已在 aiSegment 内 console.error(sentenceHash, difficulty, rebuilt, russianized)，
// 这里对 pending 句通过 saveSegments 回写（status='pending'），不加新接口。
// 返回 { done: [{sentenceHash, difficulty, reviewStatus}],
//         failed: [{sentenceHash, difficulty, error}],
//         pending: [{sentenceHash, difficulty, reason}] }；
// 'generating'（后端占位在途）不写不报，不进任何列表。
// deps.httpPost 注入。注意：不传 tokens 给 aiSegment，由其内部 splitTokens(俄语化原句)，避免数字句/标点坑。
export async function generateUnitSegmentsAsync({ courseId, unitId, sentences, difficulties }, deps = {}) {
  if (!deps || typeof deps.httpPost !== 'function') {
    throw new Error('generateUnitSegmentsAsync: deps.httpPost 必须注入')
  }
  const diffs = Array.isArray(difficulties) && difficulties.length ? difficulties : ['easy', 'medium', 'hard']
  const BATCH = 3
  const jobs = []
  for (const s of sentences) {
    const hash = sentenceHash(s.russian, 'easy') // hash 不含难度；(hash, diff) 联合才是 cache 键
    for (const d of diffs) jobs.push({ sentenceHash: hash, difficulty: d, russian: s.russian })
  }
  const done = []
  const failed = []
  const pending = []
  for (let i = 0; i < jobs.length; i += BATCH) {
    const batch = jobs.slice(i, i + BATCH)
    const results = await Promise.all(batch.map(async (job) => {
      try {
        const r = await aiSegment({ sentence: job.russian, difficulty: job.difficulty }, deps)
        if (r.reviewStatus === 'ok') {
          const items = aiResultToInbound(job, r)
          await deps.httpPost('/api/admin/segments/save', { courseId, unitId, items })
          return { kind: 'done', sentenceHash: job.sentenceHash, difficulty: job.difficulty, reviewStatus: r.reviewStatus }
        }
        if (r.reviewStatus === 'pending') {
          // 机械兜底：segments 已是入库格式（sort_order/text），整体写回，status='pending' 待人工校对
          const items = [{ sentence_hash: job.sentenceHash, difficulty: job.difficulty, segments: r.segments, status: 'pending', translation: '' }]
          await deps.httpPost('/api/admin/segments/save', { courseId, unitId, items })
          return { kind: 'pending', sentenceHash: job.sentenceHash, difficulty: job.difficulty, reason: 'ai_fallback_machine' }
        }
        return { kind: 'skip', sentenceHash: job.sentenceHash, difficulty: job.difficulty } // generating：占位在途
      } catch (e) {
        return { kind: 'failed', sentenceHash: job.sentenceHash, difficulty: job.difficulty, error: e.message } // 仅 HTTP/JSON 层
      }
    }))
    for (const r of results) {
      if (r.kind === 'done') done.push({ sentenceHash: r.sentenceHash, difficulty: r.difficulty, reviewStatus: r.reviewStatus })
      else if (r.kind === 'pending') pending.push({ sentenceHash: r.sentenceHash, difficulty: r.difficulty, reason: r.reason })
      else if (r.kind === 'failed') failed.push({ sentenceHash: r.sentenceHash, difficulty: r.difficulty, error: r.error })
    }
  }
  return { done, failed, pending }
}
