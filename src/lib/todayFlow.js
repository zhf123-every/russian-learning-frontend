// 今日训练流状态（本地持久化）
// 一条训练线串联：热身复习(review) → 精听输入(listen) → 闯关内化(quest) → 口语输出(speak)
// 完成态按本地日期存储，跨天自动重置；全部完成时维护一个真实的连胜天数。

const FLOW_KEY = 'rlearn_today_flow_v1'
const STREAK_KEY = 'rlearn_streak_v1'

// 固定四步顺序（新增步骤需谨慎，会影响老用户本地结构，缺失步默认未完成）
export const STEP_IDS = ['review', 'listen', 'quest', 'speak']

function dateKey(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function dateKeyOffset(offset) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return dateKey(d)
}

function readRaw() {
  try {
    return JSON.parse(localStorage.getItem(FLOW_KEY) || '{}')
  } catch (e) {
    return {}
  }
}

// 返回今天的完成映射 {review,listen,quest,speak}；非今天的记录视为空
export function loadDone() {
  const raw = readRaw()
  const empty = { review: false, listen: false, quest: false, speak: false }
  if (!raw || raw.date !== dateKey()) return empty
  return { ...empty, ...(raw.done || {}) }
}

// 标记某一步完成，返回最新完成映射
export function markStep(stepId) {
  const done = loadDone()
  if (!STEP_IDS.includes(stepId)) return done
  done[stepId] = true
  try {
    localStorage.setItem(FLOW_KEY, JSON.stringify({ date: dateKey(), done }))
  } catch (e) { /* 隐私模式等场景忽略 */ }
  return done
}

// 重置今天的某一步（用于“再练一次”等场景，当前 UI 未暴露，预留）
export function clearStep(stepId) {
  const done = loadDone()
  done[stepId] = false
  try {
    localStorage.setItem(FLOW_KEY, JSON.stringify({ date: dateKey(), done }))
  } catch (e) { /* ignore */ }
  return done
}

// 合并“自动完成”步骤（如没有到期生词时，复习步视为已完成，不写入存储）
export function effectiveDone(done, auto = {}) {
  const out = { ...done }
  STEP_IDS.forEach((id) => { if (auto[id]) out[id] = true })
  return out
}

export function isAllDone(done) {
  return STEP_IDS.every((id) => done[id])
}

export function doneCount(done) {
  return STEP_IDS.reduce((n, id) => n + (done[id] ? 1 : 0), 0)
}

// ---- 真实连胜 ----
export function getStreak() {
  try {
    const s = JSON.parse(localStorage.getItem(STREAK_KEY) || '{}')
    // 连胜只在“今天已完成”或“昨天完成（今天尚未断）”时有效
    if (s.lastDate === dateKey() || s.lastDate === dateKeyOffset(-1)) return s.count || 0
    return 0
  } catch (e) {
    return 0
  }
}

// 今日全部完成时调用；幂等：同一天只计一次，断签则从 1 重新开始
export function bumpStreak() {
  const today = dateKey()
  let prev = { lastDate: '', count: 0 }
  try { prev = JSON.parse(localStorage.getItem(STREAK_KEY) || '{}') || prev } catch (e) { prev = { lastDate: '', count: 0 } }
  if (prev.lastDate === today) return prev.count || 0
  const count = prev.lastDate === dateKeyOffset(-1) ? (prev.count || 0) + 1 : 1
  try { localStorage.setItem(STREAK_KEY, JSON.stringify({ lastDate: today, count })) } catch (e) { /* ignore */ }
  return count
}
