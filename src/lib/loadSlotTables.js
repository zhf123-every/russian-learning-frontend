// loadSlotTables.js —— P2：学生端表格数据源加载（表格优先，失败静默降级）。
//
// GET /api/slot-tables（公开读）→ 有 ok items → 转换答题引擎数据；无/读失败 → null
// （调用方走现有降级链：路径 → 语块 → 老路径，行为零变化）。
// 静默失败：后端冷启动 403/404/超时一律返回 null，不弹错不卡。
import { slotTablesToSequences, slotTablesToItems } from './slotTablesToQuestions.js'

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

async function fetchSlotItems(unitId, courseId) {
  if (!unitId) return null
  try {
    const q = new URLSearchParams()
    if (courseId) q.set("course_id", courseId)
    q.set("unit_id", unitId)
    const res = await fetch(`${API_BASE}/api/slot-tables?${q.toString()}`)
    if (!res.ok) return null
    const data = await res.json()
    if (!data || !data.ok) return null
    return (Array.isArray(data.items) && data.items.length) ? data.items : null
  } catch (e) {
    return null
  }
}

/** 表格优先读（答题页 sequence 流）：有 ok 表格 → sequences；无/失败 → null */
export async function loadSlotTablesForUnit(unitId, courseId) {
  const items = await fetchSlotItems(unitId, courseId)
  if (!items) return null
  const seqs = slotTablesToSequences(items, "本课")
  return seqs && seqs.length ? seqs : null
}

/** 表格优先读（听写页 items 流）：有 ok 表格 → 听写 items；无/失败 → null */
export async function loadSlotTablesItemsForUnit(unitId, courseId) {
  const items = await fetchSlotItems(unitId, courseId)
  if (!items) return null
  const out = slotTablesToItems(items)
  return out && out.length ? out : null
}
