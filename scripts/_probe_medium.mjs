// 决定性对照：单独只发 MEDIUM（不先 easy/hard），确认 medium 是否特定 403
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
async function post(path, body, token) {
  const r = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(body) })
  return r.json().catch(() => ({}))
}
const sentence = 'Я люблю читать книги'
const normalized = normalizeSentence(sentence)
const tokens = splitTokens(normalized)
const diff = 'medium'
const hash = sentenceHash(normalized, diff)
const intents = buildCoreChainIntent({ sentence: normalized, tokens, pool: POOL, zh: '我喜欢读书' })
const t0 = Date.now()
const r = await post('/api/admin/segments/table-fill', { sentence_hash: hash, russian_text: normalized, tokens, difficulty: diff, intents, pool: POOL }, signJwt(SECRET, { sub: UID, role: 'admin' }))
console.log('MEDIUM-only: ok=' + r.ok + ' cached=' + r.cached + ' fallback=' + (r.fallback === undefined ? 'undef' : r.fallback) + ' err=' + (r.error || '') + ' rows=' + (Array.isArray(r.rows) ? r.rows.length : 0) + ' ms=' + (Date.now() - t0))
console.log('done')
