// 本地验证：确定性轮换在大量不同句子下的词分布（不 commit）
import { buildCoreChainIntent } from '../src/lib/jlTableEngine.js'
import { DEFAULT_SLOT_POOL } from '../src/lib/slotTablesTrigger.js'

// 造 60 个不同的俄语句子（多样性：不同主语/谓语/宾语/地点/时间组合）
const subs = ['Я', 'Он', 'Она', 'Мы', 'Они']
const preds = ['люблю', 'хочу', 'читаю', 'вижу', 'понимаю', 'знаю', 'помню', 'слышу']
const objs = ['книгу', 'газету', 'фильм', 'музыку', 'письмо', 'стихи', 'песню', 'воду', 'чай', 'кофе', 'мясо', 'хлеб']
const advs = ['сейчас', 'сегодня', 'завтра', 'вчера', 'утром', 'вечером', 'ночью', 'дома', 'там', 'здесь']
const sentences = []
for (let i = 0; i < 60; i++) {
  const s = subs[i % subs.length]
  const p = preds[(i * 3) % preds.length]
  const o = objs[(i * 5 + 1) % objs.length]
  const a = advs[(i * 7 + 2) % advs.length]
  sentences.push(`${s} ${p} ${o} ${a}`)
}

const pool = DEFAULT_SLOT_POOL
const dist = {}
for (const key of ['time', 'place', 'predicates', 'objects']) dist[key] = new Array(pool[key].length).fill(0)
const usedIdx = {}
for (const key of ['time', 'place', 'predicates', 'objects']) usedIdx[key] = new Set()

for (const s of sentences) {
  const tokens = s.split(' ')
  const ins = buildCoreChainIntent({ sentence: s, tokens, pool, zh: '', difficulty: 'medium' })
  for (const st of ins) {
    if (st.source === 'pool' && dist[st.poolKey]) {
      dist[st.poolKey][st.poolIndex]++
      usedIdx[st.poolKey].add(st.poolIndex)
    }
  }
}
for (const key of ['time', 'place', 'predicates', 'objects']) {
  const arr = dist[key]
  const hits = arr.filter((v) => v > 0).length
  console.log(`=== ${key} (池 ${pool[key].length} 词, 60 句) ===`)
  console.log('  命中词数:', hits, '/', pool[key].length, ' 分布:', arr.join(','))
  console.log('  未命中的词:', pool[key].map((w, i) => (arr[i] === 0 ? w.ru : null)).filter(Boolean).join(', ') || '(全部命中)')
}
// 同一句重复生成 → 稳定
const insA = buildCoreChainIntent({ sentence: sentences[0], tokens: sentences[0].split(' '), pool, zh: '', difficulty: 'medium' })
const insB = buildCoreChainIntent({ sentence: sentences[0], tokens: sentences[0].split(' '), pool, zh: '', difficulty: 'medium' })
const keyOf = (ins, k) => ins.filter((x) => x.source === 'pool' && x.poolKey === k).map((x) => x.poolIndex).join(',')
console.log('同句重复生成稳定性:', JSON.stringify(Object.keys(usedIdx).map((k) => keyOf(insA, k) === keyOf(insB, k))))
