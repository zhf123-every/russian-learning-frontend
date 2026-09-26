// questStats.js —— 通关之路（/journey）统一数据层（localStorage rlearn_quest_stats）
// 世界观映射：学习时长(分钟)=经验值EXP / 答题=打怪输出(每题+10 EXP) / 六格语法=天赋树
// 结构：
// {
//   peaks: { maxCombo, maxScore, maxAccuracy },        // 巅峰战绩
//   dailyExp: { 'YYYY-MM-DD': { '全部': mins, '中译俄': mins, '听写': mins } },  // 经验获取曲线
//   caseStats: { '主格': {seen,correct}, '属格': {...}, '与格': {...}, '宾格': {...}, '工具格': {...}, '前置格': {...} }, // 天赋树
//   global: { answered, correct },                      // 全局命中率兜底
// }

const KEY = 'rlearn_quest_stats'

// 六格规范化：AI 标注 grammar_case 值 → 中文格名
export const CASE_MAP = {
  nominative: '主格', '主格': '主格', '第一格': '主格',
  genitive: '属格', '属格': '属格', '第二格': '属格',
  dative: '与格', '与格': '与格', '第三格': '与格',
  accusative: '宾格', '宾格': '宾格', '第四格': '宾格',
  instrumental: '工具格', '工具格': '工具格', '第五格': '工具格',
  prepositional: '前置格', '前置格': '前置格', '第六格': '前置格',
}
export const CASE_NAMES = ['主格', '属格', '与格', '宾格', '工具格', '前置格']

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null') || {} } catch { return {} }
}
function save(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* ignore */ }
}
function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ---- 巅峰战绩 ----
export function recordPeak({ maxCombo = 0, score = 0, accuracy = 0 } = {}) {
  const s = load()
  const p = s.peaks || (s.peaks = { maxCombo: 0, maxScore: 0, maxAccuracy: 0 })
  if (maxCombo > p.maxCombo) p.maxCombo = maxCombo
  if (score > p.maxScore) p.maxScore = score
  if (accuracy > p.maxAccuracy) p.maxAccuracy = Math.round(accuracy)
  save(s)
}
export function getPeaks() {
  const p = (load().peaks) || {}
  return { maxCombo: p.maxCombo || 0, maxScore: p.maxScore || 0, maxAccuracy: p.maxAccuracy || 0 }
}

// ---- 每日 EXP（按模式） ----
export function addDailyExp(mins, mode = '全部') {
  if (!(mins > 0)) return
  const s = load()
  const day = today()
  const d = s.dailyExp || (s.dailyExp = {})
  const row = d[day] || (d[day] = { '全部': 0, '中译俄': 0, '听写': 0 })
  row['全部'] = (row['全部'] || 0) + mins
  if (mode !== '全部') row[mode] = (row[mode] || 0) + mins
  save(s)
}
// 近 N 天（含今天，按日期顺序返回 [{ date, label, exp }]）
export function getDailyExp(days = 7, mode = '全部') {
  const s = load()
  const d = s.dailyExp || {}
  const out = []
  const now = new Date()
  const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  for (let i = days - 1; i >= 0; i--) {
    const t = new Date(now.getTime() - i * 86400e3)
    const key = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
    const row = d[key] || {}
    out.push({ date: key, label: WEEK[t.getDay()], exp: Math.round((row[mode] || 0)) })
  }
  return out
}
export function getExpSummary(days = 7, mode = '全部') {
  const rows = getDailyExp(days, mode)
  const total = rows.reduce((s, r) => s + r.exp, 0)
  return { total, avg: rows.length ? Math.round(total / rows.length) : 0 }
}
// 打卡天数：有学习记录的天数（dailyExp 有值的 key 数）
export function getStudyDays() {
  const d = (load().dailyExp) || {}
  return Object.keys(d).filter((k) => (d[k] && (d[k]['全部'] || 0) > 0)).length
}
// 连击天数：日期序列中最大连续段
export function getStreakDays() {
  const d = (load().dailyExp) || {}
  const days = Object.keys(d).filter((k) => (d[k] && (d[k]['全部'] || 0) > 0)).sort()
  let best = 0, cur = 0, prev = null
  for (const k of days) {
    if (prev !== null && new Date(k) - new Date(prev) === 86400e3) cur += 1
    else cur = 1
    if (cur > best) best = cur
    prev = k
  }
  return best
}

// ---- 六格天赋树 ----
export function recordCase(caseKey, correct) {
  const name = CASE_MAP[caseKey] || CASE_MAP[String(caseKey).toLowerCase()] || null
  if (!name) return
  const s = load()
  const cs = s.caseStats || (s.caseStats = {})
  const row = cs[name] || (cs[name] = { seen: 0, correct: 0 })
  row.seen += 1
  if (correct) row.correct += 1
  save(s)
}
// 六格掌握度：{ name: { seen, correct, pct } }
export function getCaseStats() {
  const cs = (load().caseStats) || {}
  return CASE_NAMES.map((name) => {
    const r = cs[name] || { seen: 0, correct: 0 }
    return { name, seen: r.seen || 0, correct: r.correct || 0, pct: r.seen ? Math.round(((r.correct || 0) / r.seen) * 100) : 0 }
  })
}

// ---- 全局命中率（兜底：单局命中率之外的累计口径） ----
export function recordGlobalAnswer(correct) {
  const s = load()
  const g = s.global || (s.global = { answered: 0, correct: 0 })
  g.answered += 1
  if (correct) g.correct += 1
  save(s)
}
export function getGlobalAccuracy() {
  const g = (load().global) || {}
  return g.answered ? Math.round((g.correct / g.answered) * 100) : 0
}
