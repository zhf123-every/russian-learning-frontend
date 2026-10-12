// ================= 单词学习统计（词频/错误次数）=================
// 复习本（/vocab）按句子收录（见 reviewItems.js）；生词本（/save/unknown）为答题页点词手动收藏（见 vocabBook.js）。
// 此处保留按单词的答对/答错统计：答错次数累计 ≥3 时，可用 markWordUnknown 快速加入生词本。
// 由四个答题页（中译俄/听写/听力/口语评测）在答题时实时写入 localStorage rlearn_word_stats
const KEY = 'rlearn_word_stats'

function normKey(w) {
  const t = String(w?.lemma || w?.text || w?.word || w?.ru || w?.form || '').trim()
  return t.replace(/[́̀̆̈]/g, '').toLowerCase()
}

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {} } catch (e) { return {} }
}
function save(map) {
  try { localStorage.setItem(KEY, JSON.stringify(map)) } catch (e) { /* 忽略 */ }
}

const surfaceOf = (w) => String(w?.lemma || w?.text || w?.word || w?.ru || w?.form || '').trim()

/**
 * 记录一次答题的单词统计
 * @param {Array} words 句子的单词数组，元素可含 {lemma|text|word|ru|form, chinese|zh|meaning|translation, pos, reading}
 * @param {'correct'|'wrong'} outcome correct=答对(记为学过) / wrong=答错(错误次数+1)
 * @param {Object} meta { mode: '中译俄'|'听写'|'听力'|'口语评测', lesson: 课程/单元 id }
 */
export function trackWords(words, outcome, meta = {}) {
  if (!Array.isArray(words) || !words.length) return
  const map = load()
  let changed = false
  for (const w of words) {
    const key = normKey(w)
    if (!key) continue
    const cur = map[key] || {
      key, word: surfaceOf(w) || key, chinese: '', pos: '', reading: '',
      correctCount: 0, wrongCount: 0,
    }
    if (outcome === 'wrong') {
      cur.wrongCount = (cur.wrongCount || 0) + 1
      cur.lastWrongAt = Date.now()
    } else {
      cur.correctCount = (cur.correctCount || 0) + 1
      if (!cur.learnedAt) cur.learnedAt = Date.now()
    }
    // 后续遇到带注释的词条时补全释义/词性
    if (!cur.chinese) cur.chinese = String(w?.chinese || w?.zh || w?.meaning || w?.translation || '')
    if (!cur.pos && w?.pos) cur.pos = String(w.pos)
    if (!cur.reading && w?.reading) cur.reading = String(w.reading)
    // 练习模式 / 课程标签（重复单词只挂一个，模式与课程合并记录）
    if (meta.mode) {
      cur.modes = cur.modes || []
      if (!cur.modes.includes(meta.mode)) cur.modes.push(meta.mode)
    }
    if (meta.lesson) cur.lesson = meta.lesson
    cur.lastAt = Date.now()
    map[key] = cur
    changed = true
  }
  if (changed) save(map)
}

export function getAllWordStats() {
  return Object.values(load()).sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0))
}

// 已学单词：做过题的，答错次数 < 3
export function getReviewWords() {
  return getAllWordStats().filter(x => (x.wrongCount || 0) < 3)
}

// 生词本候选：答错次数 >= 3（快速加入生词本时用）
export function getUnknownWords() {
  return getAllWordStats().filter(x => (x.wrongCount || 0) >= 3)
}

// 清零错误次数（生词 → 移回复习本时用）
export function clearWrongCount(key) {
  const map = load()
  if (map[key]) {
    map[key].wrongCount = 0
    delete map[key].lastWrongAt
    save(map)
  }
}

// 快速把单词标记进生词本（错误次数直接置 3；生词本页面数据源为手动词库 vocabBook.js）
export function markWordUnknown({ word, chinese, pos, reading } = {}) {
  const key = normKey(word)
  if (!key) return
  const map = load()
  map[key] = {
    key, word: String(word || key).trim(), chinese: chinese || '', pos: pos || '', reading: reading || '',
    correctCount: 0, wrongCount: 3, learnedAt: Date.now(), lastAt: Date.now(),
  }
  save(map)
}

export function isWordTracked(word) {
  return !!load()[normKey(word)]
}

// 是否已进生词本（错误次数 >=3）
export function isInUnknown(word) {
  const e = load()[normKey(word)]
  return !!e && (e.wrongCount || 0) >= 3
}

// 从统计中移除
export function removeWord(key) {
  const map = load()
  if (map[key]) { delete map[key]; save(map) }
}
