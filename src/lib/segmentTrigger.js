// segmentTrigger.js —— P2-A：保存课时后异步触发语块生成 + 本机失败重试增强（rb_pending_segments）。
//
// 边界（写进设计文档）：
// - inFlight 只防"同页面内"重复触发；跨标签页 / 跨浏览器 / 关页面重开不防。
//   重复触发由后端 llm-segment 幂等（缓存命中不调 LLM）+ save upsert 兜底，成本可控。
// - 关页面后不保证本次生成完成；下次打开课时时由 retryPendingSegments 自动补跑。
// - 不做 sendBeacon / keepalive：异步触发即可，失败由"下次打开"兜底。
// - 前端禁止直连 LLM：httpPost 必须从 deps 注入（由调用方包装 apiFetch + authBody + 403 重试）。
// - rb_pending_segments 仅承担"本机失败重试"增强，不承担跨设备补跑；
//   跨设备补跑 = 整课时重跑（原句来自本地/localStorage，云端课时缺句子时补跑不可用，只读展示）。
import { generateUnitSegmentsAsync } from './segmentEngine.js'

const STORAGE_KEY = 'rb_pending_segments'
const inFlight = new Set()

function readStore(deps) {
  const ls = (deps && deps.storage) || (typeof window !== 'undefined' ? window.localStorage : null)
  if (!ls) return { data: {}, ls: null }
  try {
    return { data: JSON.parse(ls.getItem(STORAGE_KEY) || '{}') || {}, ls }
  } catch {
    return { data: {}, ls }
  }
}

function writeStore(ls, data) {
  if (!ls) return
  try {
    ls.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    /* 存储不可用：静默降级（不影响主流程） */
  }
}

// 读某课时的待重试记录（[{sentenceHash, difficulty, error, at}]）
export function readPendingSegments({ courseId, unitId }, deps = {}) {
  const { data } = readStore(deps)
  return data[`${courseId}::${unitId}`] || []
}

// 写回：done（ok/pending 已入库）的 (sentenceHash, difficulty) 从记录中清除；failed（HTTP/JSON 层未入库）合并写入。
// pending 不进本列表：机械兜底已入库（status='pending' 待人工校对），下次整课时重跑会再试一次（后端 cache 无 ok 记录）。
export function writePendingSegments({ courseId, unitId, done, failed }, deps = {}) {
  const { data, ls } = readStore(deps)
  const key = `${courseId}::${unitId}`
  const prev = (data[key] || []).filter(
    (p) => !done.some((d) => d.sentenceHash === p.sentenceHash && d.difficulty === p.difficulty),
  )
  const next = [...prev]
  for (const f of failed) {
    const i = next.findIndex((p) => p.sentenceHash === f.sentenceHash && p.difficulty === f.difficulty)
    const rec = { sentenceHash: f.sentenceHash, difficulty: f.difficulty, error: f.error, at: Date.now() }
    if (i >= 0) next[i] = rec
    else next.push(rec)
  }
  if (next.length) data[key] = next
  else delete data[key]
  writeStore(ls, data)
}

// 保存课时后异步触发：整课时三档（easy / medium / hard）生成。
// sentences: 课时句子数组（[{ru}]，兼容 {russian} / {text}）。
// 返回 { skipped: 'in_flight' | 'no_sentences' } 或 { done, failed, pending }（generateUnitSegmentsAsync 契约）。
export async function triggerUnitSegments({ courseId, unitId, sentences, deps = {} }) {
  const key = `${courseId}::${unitId}`
  if (inFlight.has(key)) return { skipped: 'in_flight' }
  const texts = (Array.isArray(sentences) ? sentences : [])
    .map((s) => String((s && (s.ru || s.russian || s.text)) || '').trim())
    .filter(Boolean)
  if (!texts.length) return { skipped: 'no_sentences' }
  inFlight.add(key)
  try {
    const r = await generateUnitSegmentsAsync(
      { courseId, unitId, sentences: texts.map((russian) => ({ russian })), difficulties: ['easy', 'medium', 'hard'] },
      deps,
    )
    writePendingSegments({ courseId, unitId, done: r.done, failed: r.failed }, deps)
    return r
  } finally {
    inFlight.delete(key)
  }
}

// 下次打开课时自动补跑：本机有待重试记录才触发（整课时重跑；后端 llm-segment 幂等，已 ok 句命中缓存零 LLM 成本）。
export async function retryPendingSegments({ courseId, unitId, sentences, deps = {} }) {
  const pending = readPendingSegments({ courseId, unitId }, deps)
  if (!pending.length) return { skipped: 'no_pending' }
  return triggerUnitSegments({ courseId, unitId, sentences, deps })
}
