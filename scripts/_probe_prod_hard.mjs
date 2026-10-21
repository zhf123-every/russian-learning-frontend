// 生产验证：三档新链路（hidden 积木喂 ctx；词池确定性轮换）——本地验证用，不 commit
import { buildCoreChainIntent } from '../src/lib/jlTableEngine.js'
import { DEFAULT_SLOT_POOL } from '../src/lib/slotTablesTrigger.js'
import { normalizeSentence, splitTokens, sentenceHash } from '../src/lib/segmentEngine.js'
const POOL = DEFAULT_SLOT_POOL
const sentence = process.env.PROBE_SENTENCE || 'Я хочу читать книгу'
const tokens = splitTokens(normalizeSentence(sentence))
const difficulty = process.env.PROBE_DIFFICULTY || 'hard'
const chainIndex = Number(process.env.PROBE_CHAIN_INDEX || '0')
const poolSeed = process.env.PROBE_POOL_SEED || 'course_probe::unit_probe'
const intents = buildCoreChainIntent({ sentence, tokens, pool: POOL, zh: '我想读书', difficulty, chainIndex, poolSeed })
console.log('intents 总数:', intents.length, '可见:', intents.filter((i) => !i.hidden).length, '隐藏:', intents.filter((i) => i.hidden).length)
const poolIdxLog = {}
for (const st of intents) {
  if (st.source === 'pool') poolIdxLog[st.poolKey + '@' + st.groupId] = st.poolIndex
}
console.log('poolIndex:', JSON.stringify(poolIdxLog))
const body = {
  sentence_hash: sentenceHash(sentence, difficulty),
  russian_text: sentence,
  tokens,
  difficulty,
  intents,
  pool: POOL,
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1X2MwYmMxN2Q3YjIwYjQ1Nzk5NzIxIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzkxMDI1OTAwLCJleHAiOjE3OTE2MzA3MDB9.mh2SYKbiLE8C_YAAglolzJdSIPNRW3YIuSGkYv5M2pY',
}
const t0 = Date.now()
try {
  const res = await fetch('https://russian-learning-jetq.onrender.com/api/admin/segments/table-fill', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  const txt = await res.text()
  console.log('http', res.status, '耗时(s)', ((Date.now() - t0) / 1000).toFixed(1))
  let j
  try { j = JSON.parse(txt) } catch { console.log('raw:', txt.slice(0, 400)); process.exit(0) }
  if (j.ok && Array.isArray(j.rows)) {
    const parts = j.rows.filter((r) => r.cardType === '积木')
    const fulls = j.rows.filter((r) => r.cardType === '完整句')
    console.log('rows:', j.rows.length, '积木:', parts.length, '完整句:', fulls.length)
    console.log('积木明细:', parts.map((r) => `${r.seq}:[${r.ru}]/${r.tag}`).join(' | '))
    console.log('完整句明细:', fulls.map((r) => `${r.seq}:[${r.ru}]/${r.tag}`).join(' | '))
    console.log('首行:', JSON.stringify(j.rows[0]))
    console.log('末行:', JSON.stringify(j.rows[j.rows.length - 1]))
  } else {
    console.log('resp:', JSON.stringify(j).slice(0, 500))
  }
} catch (e) {
  console.log('网络错误:', String(e && e.message || e))
}
