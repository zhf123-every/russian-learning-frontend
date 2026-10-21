// 完整链路：用户真实句子 3 难度 → save → read（probe 假 id），定位"只存 1 档"
import { buildCoreChainIntent } from '../src/lib/jlTableEngine.js'
import { normalizeSentence, splitTokens, sentenceHash } from '../src/lib/segmentEngine.js'
import crypto from 'node:crypto'
const BASE = 'https://russian-learning-jetq.onrender.com'
const SECRET = 'f1af671f29f125467d69431d87dc7f5cc1a039aea236dd3c75f38c8be69e2c68'
const UID = 'u_c0bc17d7b20b45799721'
const signJwt = (secret, payload) => {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const h = b64({ alg: 'HS256', typ: 'JWT' })
  const p = b64({ ...payload, iat: now, exp: now + 600 })
  const s = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url')
  return `${h}.${p}.${s}`
}
const POOL = {
  negation: [{ ru: 'не', zh: '不' }], time: [{ ru: 'сейчас', zh: '现在' }, { ru: 'сегодня', zh: '今天' }],
  place: [{ ru: 'здесь', zh: '这里' }], degree: [{ ru: 'очень', zh: '非常' }],
  evaluation: [{ ru: 'важно', zh: '重要' }, { ru: 'хорошо', zh: '好' }, { ru: 'невозможно', zh: '不可能' }, { ru: 'возможно', zh: '可能' }],
  predicates: [{ ru: 'хочу', zh: '想' }, { ru: 'нужно', zh: '需要' }, { ru: 'должен', zh: '必须' }],
  objects: [{ ru: 'еду', zh: '食物', inf: 'есть' }],
  preposition: [{ ru: 'для меня', zh: '对我来说' }], connector: [{ ru: 'поэтому', zh: '所以' }],
}
const COURSE = 'probe-user-sentence-course'
const UNIT = 'probe-user-sentence-unit'
async function post(path, body) {
  const r = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + signJwt(SECRET, { sub: UID, role: 'admin' }) }, body: JSON.stringify(body) })
  return r.json().catch(() => ({}))
}
async function get(path) {
  const r = await fetch(BASE + path, { headers: { Authorization: 'Bearer ' + signJwt(SECRET, { sub: UID, role: 'admin' }) } })
  return r.json().catch(() => ({}))
}
const sentence = 'Я хочу читать книгу'
const zh = '我想读书'
const normalized = normalizeSentence(sentence)
const tokens = splitTokens(normalized)
const items = []
for (const diff of ['easy', 'medium', 'hard']) {
  const hash = sentenceHash(normalized, diff)
  const intents = buildCoreChainIntent({ sentence: normalized, tokens, pool: POOL, zh })
  const t0 = Date.now()
  const r = await post('/api/admin/segments/table-fill', { sentence_hash: hash, russian_text: normalized, tokens, difficulty: diff, intents, pool: POOL })
  console.log('fill ' + diff + ': ok=' + r.ok + ' cached=' + r.cached + ' fallback=' + (r.fallback === undefined ? 'undef' : r.fallback) + ' err=' + (r.error || '') + ' rows=' + (Array.isArray(r.rows) ? r.rows.length : 0) + ' ms=' + (Date.now() - t0))
  if (r.ok && Array.isArray(r.rows) && r.rows.length) items.push({ sentence_hash: hash, sentence: normalized, difficulty: diff, intents_fp: 'probe', rows: r.rows, review_status: 'ok' })
}
console.log('items=' + items.length)
const s = await post('/api/admin/slot-tables/save', { course_id: COURSE, unit_id: UNIT, items })
console.log('save: ok=' + s.ok + ' saved=' + s.saved + ' err=' + (s.error || ''))
const rd = await get('/api/slot-tables?course_id=' + COURSE + '&unit_id=' + UNIT + '&include_pending=1')
console.log('read: ok=' + rd.ok + ' items=' + (Array.isArray(rd.items) ? rd.items.length : 0))
if (Array.isArray(rd.items)) for (const it of rd.items) console.log('  ' + it.difficulty + ' ' + it.status + ' rows=' + (Array.isArray(it.rows) ? it.rows.length : 0) + ' hash=' + (it.sentence_hash || '').slice(0, 10))
console.log('done')
