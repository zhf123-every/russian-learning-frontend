// ================= 生词本（手动收藏的单词，只收词不收句子）=================
// 从答题页点词弹窗「添加到生词本」收录；同一单词按归一化词形去重只挂一个。
// 数据键：rlearn_vocab_book（localStorage）
const KEY = 'rlearn_vocab_book'

function normKey(w) {
  return String(w || '')
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
 * 添加生词（已存在则更新例句/来源并保留收录时间）
 * @param {Object} item { word, pos, chinese, reading, example, course, lesson }
 */
export function addVocabWord(item = {}) {
  const key = normKey(item.word)
  if (!key) return null
  const map = load()
  const cur = map[key] || {
    key, word: String(item.word || key).trim(), pos: '', chinese: '', reading: '',
    example: '', course: '', lesson: '', addedAt: Date.now(), practiceCount: 0,
  }
  if (item.pos) cur.pos = String(item.pos)
  if (item.chinese) cur.chinese = String(item.chinese)
  if (item.reading) cur.reading = String(item.reading)
  if (item.example) cur.example = String(item.example)
  if (item.course) cur.course = String(item.course)
  if (item.lesson) cur.lesson = String(item.lesson)
  map[key] = cur
  save(map)
  return cur
}

export function isInVocab(word) {
  return !!load()[normKey(word)]
}

export function getVocabWords() {
  return Object.values(load()).sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
}

export function removeVocabWord(key) {
  const map = load()
  if (map[key]) { delete map[key]; save(map) }
}

// 练习次数 +1（开始练习完成一题后调用）
export function incrementVocabPractice(key) {
  const map = load()
  if (map[key]) {
    map[key].practiceCount = (map[key].practiceCount || 0) + 1
    map[key].lastPracticedAt = Date.now()
    save(map)
  }
}

export function vocabStats() {
  const all = getVocabWords()
  return { total: all.length, practiced: all.filter(w => (w.practiceCount || 0) > 0).length }
}
