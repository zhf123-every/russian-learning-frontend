// ================= 复习本（句子级）统计 =================
// 复习本 = 学过的所有句子（中译俄/听写/听力/口语评测 答题时自动记录），
// 同一句子按归一化文本去重只挂一个，不叠加；模式/课程标签合并记录。
// 生词本（/save/unknown）为答题页点词手动收藏（vocabBook.js），只收词不收句。
const KEY = 'rlearn_review_items'

// 句子归一化：去重音符号、折叠空白、小写 → 作为去重键（同一句只挂一张卡片）
function normSentence(s) {
  return String(s || '')
    .replace(/[́̀̆̈]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {} } catch (e) { return {} }
}
function save(map) {
  try { localStorage.setItem(KEY, JSON.stringify(map)) } catch (e) { /* 忽略 */ }
}

/**
 * 记录一次答题的句子统计
 * @param {Object} item 当前句子 { russian, chinese }
 * @param {'correct'|'wrong'} outcome correct=答对(记为学过) / wrong=答错(错误次数+1)
 * @param {Object} meta { mode: '中译俄'|'听写'|'听力'|'口语评测', lesson: 课程/单元 id }
 */
export function trackSentence(item, outcome, meta = {}) {
  const russian = String(item?.russian || '').trim()
  const key = normSentence(russian)
  if (!key) return
  const map = load()
  const cur = map[key] || {
    key, russian, chinese: String(item?.chinese || '').trim(),
    modes: [], correctCount: 0, wrongCount: 0,
  }
  if (outcome === 'wrong') {
    cur.wrongCount = (cur.wrongCount || 0) + 1
    cur.lastWrongAt = Date.now()
  } else {
    cur.correctCount = (cur.correctCount || 0) + 1
    if (!cur.learnedAt) cur.learnedAt = Date.now()
  }
  if (!cur.chinese && item?.chinese) cur.chinese = String(item.chinese).trim()
  if (meta.mode && !cur.modes.includes(meta.mode)) cur.modes.push(meta.mode)
  if (meta.lesson) cur.lesson = meta.lesson
  cur.lastAt = Date.now()
  map[key] = cur
  save(map)
}

// 复习本全部句子（按添加时间倒序）
export function getReviewSentences() {
  return Object.values(load()).sort((a, b) => (b.learnedAt || 0) - (a.learnedAt || 0))
}

// 从复习本移除（🗑 / 删除选中）
export function removeSentence(key) {
  const map = load()
  if (map[key]) { delete map[key]; save(map) }
}
