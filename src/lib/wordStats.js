// ================= 学过单词 / 陌生关卡 统计 =================
// 复习关卡 = 学过的单词且答错次数 < 3；陌生关卡 = 答错次数 >= 3（互斥不重叠）
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
 */
export function trackWords(words, outcome) {
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
    cur.lastAt = Date.now()
    map[key] = cur
    changed = true
  }
  if (changed) save(map)
}

export function getAllWordStats() {
  return Object.values(load()).sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0))
}

// 复习关卡：学过的单词（做过题的），答错次数 < 3
export function getReviewWords() {
  return getAllWordStats().filter(x => (x.wrongCount || 0) < 3)
}

// 陌生关卡：答错次数 >= 3
export function getUnknownWords() {
  return getAllWordStats().filter(x => (x.wrongCount || 0) >= 3)
}

// 陌生 → 移回复习（清零错误次数）
export function clearWrongCount(key) {
  const map = load()
  if (map[key]) {
    map[key].wrongCount = 0
    delete map[key].lastWrongAt
    save(map)
  }
}

// 从统计中移除（复习/陌生关卡 🗑）
export function removeWord(key) {
  const map = load()
  if (map[key]) { delete map[key]; save(map) }
}
