// 直查生产 table-fill 返回体：看 cached 标记 + 检查表内是否有野词/重复
import crypto from 'node:crypto'
import dns from 'node:dns'
dns.setDefaultResultOrder('ipv4first')
import { buildCoreChainIntent } from '../src/lib/jlTableEngine.js'
import { normalizeSentence, splitTokens, sentenceHash } from '../src/lib/segmentEngine.js'

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
const sentence = 'Я хочу читать книгу'
const zh = '我想读书'
const normalized = normalizeSentence(sentence)
const tokens = splitTokens(normalized)
const difficulty = process.env.DIFF || 'medium'
const hash = sentenceHash(normalized, difficulty)
const pool = {
  negation: [{ ru: 'не', zh: '不' }],
  time: [{ ru: 'сегодня', zh: '今天' }, { ru: 'сейчас', zh: '现在' }],
  place: [{ ru: 'здесь', zh: '这里' }],
  degree: [{ ru: 'очень', zh: '非常' }],
  evaluation: [{ ru: 'важно', zh: '重要' }, { ru: 'хорошо', zh: '好' }, { ru: 'невозможно', zh: '不可能' }, { ru: 'возможно', zh: '可能' }],
  predicates: [{ ru: 'хочу', zh: '想' }, { ru: 'нужно', zh: '需要' }, { ru: 'должен', zh: '必须' }],
  objects: [{ ru: 'делать это', zh: '做这个' }],
  preposition: [{ ru: 'для меня', zh: '对我来说' }],
  connector: [{ ru: 'поэтому', zh: '所以' }],
}
const intents = buildCoreChainIntent({ sentence: normalized, tokens, pool, zh })
const body = { sentence_hash: hash, russian_text: normalized, tokens, difficulty, intents, pool }
const r = await fetch(BASE + '/api/admin/segments/table-fill', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + signJwt(SECRET, { sub: UID, role: 'admin' }) },
  body: JSON.stringify(body),
})
const j = await r.json()
console.log('difficulty=' + difficulty, 'hash=' + hash, 'ok=' + j.ok, 'cached=' + j.cached, 'fallback=' + j.fallback, 'reason=' + (j.reason || ''))
if (j.ok && Array.isArray(j.rows)) {
  console.log('rows=' + j.rows.length)
  // 野词检查：出现这些 = LLM 造词残留
  const wild = ['библиотек', 'завтра', 'перечита', 'стихи', 'письмо', 'три раза', 'эту книгу', 'в парке', 'уроке']
  const ruAll = j.rows.map(x => (x.ru || '')).join(' ')
  for (const w of wild) if (ruAll.includes(w)) console.log('WILD_FOUND: ' + w)
  // 同组内重复检查（跨组复用零件合法，同组内重复 = 非法）
  const seenG = new Map()
  for (const x of j.rows) {
    const g = (x.groupId || '')
    const k = (x.ru || '').trim()
    if (!g || !k) continue
    const arr = seenG.get(g) || new Set()
    if (arr.has(k)) console.log('IN_GROUP_DUP(' + g + '): ' + k)
    arr.add(k)
    seenG.set(g, arr)
  }
  // 预览尾部（G_05 之后）
  console.log('--- G_03~ 预览 ---')
  for (const x of j.rows.filter(a => a.groupId && a.groupId >= 'G_03')) console.log(x.seq + ' ' + x.cardType + ' ' + (x.ru || '') + ' = ' + (x.zh || '') + ' [' + (x.tag || '') + '] ' + (x.groupId || ''))
}
