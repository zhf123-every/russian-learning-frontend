// slotTablesTrigger.js —— P2：保存课时后异步触发表格生成（6 列表格 → 课时维度持久化 sentence_slot_unit_tables）。
//
// 方案 A（用户已拍板）：每课第 1 句 = 核心长链（~190 步），其余句子 = 短链（~20 步）；
// 三档难度（easy / medium / hard）各生成一次（学生端难度联动出题粒度）。
//
// 边界（与 segmentTrigger 同款，写进契约文档）：
// - inFlight 只防"同页面内"重复触发；跨标签页 / 跨浏览器 / 关页面重开不防。
//   重复触发由后端 table-fill 幂等缓存 + save replace（整课时重写）兜底，成本可控。
// - 关页面后不保证本次生成完成；下次打开课时时由 retryPendingSlotTables 自动补跑。
// - 不做 sendBeacon / keepalive；失败由"下次打开"兜底。
// - 前端禁止直连 LLM：httpPost 必须从 deps 注入（由调用方包装 apiFetch + authBody + 403 重试）。
import { generateUnitTableAsync } from './jlTableEngine.js'
import { normalizeSentence, sentenceHash } from './segmentEngine.js'

const STORAGE_KEY = 'rb_pending_slot_tables'
const inFlight = new Set()
const DIFFICULTIES = ['easy', 'medium', 'hard']

// 默认课级词池（与端到端冒烟同款；后端 table-fill 据此填 predicates/objects/evaluation 等扩展词）
// 允许调用方通过 deps.pool 覆盖（后续做"按课程级词池"改造时替换）
export const DEFAULT_SLOT_POOL = {
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
export function readPendingSlotTables({ courseId, unitId }, deps = {}) {
  const { data } = readStore(deps)
  return data[`${courseId}::${unitId}`] || []
}

// 写回：done（已成功入库）的 (sentenceHash, difficulty) 从记录中清除；failed（未入库）合并写入。
// pending（机械兜底已入库）不进本列表：下次整课时重跑会再试一次（后端 cache 无 ok 记录则重新生成）。
export function writePendingSlotTables({ courseId, unitId, done, failed }, deps = {}) {
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

// 保存课时后异步触发：整课时三档生成 → table-fill（AI）→ save（写课时维度库）。
// sentences: 课时句子数组（[{ru, zh}]，兼容 {russian}/{text}/{chinese}）。
// 返回 { skipped: 'in_flight' | 'no_sentences' } 或 { done, failed, pending, saved }。
export async function triggerUnitSlotTables({ courseId, unitId, sentences, deps = {} }) {
  const key = `${courseId}::${unitId}`
  if (inFlight.has(key)) return { skipped: 'in_flight' }
  const list = (Array.isArray(sentences) ? sentences : [])
    .map((s) => ({
      ru: String((s && (s.ru || s.russian || s.text)) || '').trim(),
      zh: String((s && (s.zh || s.chinese)) || '').trim(),
    }))
    .filter((s) => s.ru)
  if (!list.length) return { skipped: 'no_sentences' }
  inFlight.add(key)
  try {
    // 方案 A：第 1 句 = 核心长链；三档难度各生成一次
    const units = []
    list.forEach((s, idx) => {
      for (const d of DIFFICULTIES) units.push({ ru: s.ru, zh: s.zh, difficulty: d, core: idx === 0 })
    })
    const pool = (deps && deps.pool) || DEFAULT_SLOT_POOL
    const r = await generateUnitTableAsync(units, { httpPost: deps.httpPost, pool }, deps)
    // hash → 原句 映射（save 需要 sentence 字段；与 generateUnitTableAsync 内部 hash 算法一致）
    const hashToSentence = {}
    for (const s of list) {
      for (const d of DIFFICULTIES) {
        hashToSentence[sentenceHash(normalizeSentence(s.ru), d)] = s.ru
      }
    }
    // 组装 save items：done(ok) + pending(机械兜底有 rows) 都入库；failed 不存
    const toSave = []
    for (const d of r.done) {
      toSave.push({
        sentence_hash: d.sentenceHash,
        sentence: hashToSentence[d.sentenceHash] || '',
        difficulty: d.difficulty,
        intents_fp: 'unit',
        rows: Array.isArray(d.rows) ? d.rows : [],
        review_status: 'ok',
      })
    }
    for (const p of r.pending) {
      if (Array.isArray(p.rows) && p.rows.length) {
        toSave.push({
          sentence_hash: p.sentenceHash,
          sentence: hashToSentence[p.sentenceHash] || '',
          difficulty: p.difficulty,
          intents_fp: 'unit',
          rows: p.rows,
          review_status: 'pending',
        })
      }
    }
    let saved = 0
    let saveFailed = false
    if (toSave.length) {
      const res0 = await deps.httpPost('/api/admin/slot-tables/save', { course_id: courseId, unit_id: unitId, items: toSave })
      // ⚠️ 同款兼容：httpPost 可能返回 fetch Response（.ok=HTTP 状态）而非 JSON，必须解析后再判断业务 ok
      const res = (res0 && typeof res0.json === 'function') ? await res0.json().catch(() => ({})) : (res0 || {})
      if (res && res.ok) {
        saved = typeof res.saved === 'number' ? res.saved : toSave.length
      } else {
        // save 失败 → 全部进失败列表（下次打开补跑会重新生成 + 重存）
        saveFailed = true
        const allFailed = r.done.map((d) => ({ sentenceHash: d.sentenceHash, difficulty: d.difficulty, error: 'save_failed' }))
        writePendingSlotTables({ courseId, unitId, done: [], failed: allFailed }, deps)
        return { done: [], failed: allFailed, pending: [], saved: 0, saveFailed: true }
      }
    }
    // 成功入库的 done 从待重试清除；生成层 failed（HTTP/JSON 未入库）写入待重试
    writePendingSlotTables({ courseId, unitId, done: r.done, failed: r.failed }, deps)
    return { done: r.done, failed: r.failed, pending: r.pending, saved }
  } finally {
    inFlight.delete(key)
  }
}

// 下次打开课时自动补跑：本机有待重试记录才触发（整课时重跑；后端 table-fill 幂等缓存，已 ok 句命中零 LLM 成本）。
export async function retryPendingSlotTables({ courseId, unitId, sentences, deps = {} }) {
  const pending = readPendingSlotTables({ courseId, unitId }, deps)
  if (!pending.length) return { skipped: 'no_pending' }
  return triggerUnitSlotTables({ courseId, unitId, sentences, deps })
}
