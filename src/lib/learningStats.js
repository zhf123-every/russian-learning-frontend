// 学习时长与最近学习统计（localStorage rlearn_learning_stats，按课程 ID 分组）
// 结构：{ [courseId]: { totalMs: number, lastAt: number } }

const KEY = 'rlearn_learning_stats'

export function getCourseStats(courseId) {
  if (!courseId) return { totalMs: 0, lastAt: 0 }
  try {
    const all = JSON.parse(localStorage.getItem(KEY) || '{}')
    const s = all[courseId]
    return s && typeof s === 'object'
      ? { totalMs: Number(s.totalMs) || 0, lastAt: Number(s.lastAt) || 0 }
      : { totalMs: 0, lastAt: 0 }
  } catch {
    return { totalMs: 0, lastAt: 0 }
  }
}

// 累加一次学习时长（毫秒），并刷新最近学习时间
export function addStudyTime(courseId, ms) {
  if (!courseId || !(ms > 0)) return
  try {
    const all = JSON.parse(localStorage.getItem(KEY) || '{}')
    const cur = getCourseStats(courseId)
    all[courseId] = { totalMs: (cur.totalMs || 0) + ms, lastAt: Date.now() }
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch { /* ignore */ }
}

// 只刷新最近学习时间（不累加时长）
export function touchLastStudied(courseId) {
  if (!courseId) return
  try {
    const all = JSON.parse(localStorage.getItem(KEY) || '{}')
    const cur = getCourseStats(courseId)
    all[courseId] = { totalMs: cur.totalMs || 0, lastAt: Date.now() }
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch { /* ignore */ }
}

// 格式化学习时长：分钟（不足 1 分钟显示"1 分钟内"）
export function fmtDuration(ms) {
  const mins = Math.round((Number(ms) || 0) / 60000)
  if (mins <= 0) return '1 分钟内'
  if (mins < 60) return `${mins} 分钟`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h} 小时 ${m} 分钟` : `${h} 小时`
}

// 格式化最近学习时间
export function fmtLastAt(t) {
  if (!t) return '—'
  const diff = Date.now() - Number(t)
  if (diff < 3600e3) return '刚刚'
  if (diff < 86400e3) return Math.floor(diff / 3600e3) + ' 小时前'
  if (diff < 7 * 86400e3) return Math.floor(diff / 86400e3) + ' 天前'
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
