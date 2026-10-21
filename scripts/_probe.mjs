// 决定性实验：验证生产 table-fill 在 ①全新句子+pool ②pool=None 两种情况下是否干净
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
const POOL = {
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
const WILD = ['библиотек', 'завтра', 'перечита', 'стихи', 'письмо', 'три раза', 'эту книгу', 'в парке', 'вечером', 'утром', 'скорее', 'еще раз', 'каждый день']

async function run(label, sentence, zh, difficulty, withPool) {
  const normalized = normalizeSentence(sentence)
  const tokens = splitTokens(normalized)
  const hash = sentenceHash(normalized, difficulty)
  const intents = buildCoreChainIntent({ sentence: normalized, tokens, pool: withPool ? POOL : undefined, zh })
  const body = { sentence_hash: hash, russian_text: normalized, tokens, difficulty, intents }
  if (withPool) body.pool = POOL
  const r = await fetch(BASE + '/api/admin/segments/table-fill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + signJwt(SECRET, { sub: UID, role: 'admin' }) },
    body: JSON.stringify(body),
  })
  const j = await r.json()
  const rows = (j.ok && Array.isArray(j.rows)) ? j.rows : []
  const ruAll = rows.map(x => (x.ru || '')).join(' ')
  const wildFound = WILD.filter(w => ruAll.includes(w))
  // 同组重复
  const seenG = new Map(); const inGroupDup = []
  for (const x of rows) {
    const g = x.groupId || ''; const k = (x.ru || '').trim()
    if (!g || !k) continue
    const s = seenG.get(g) || new Set()
    if (s.has(k)) inGroupDup.push(g + ':' + k)
    s.add(k); seenG.set(g, s)
  }
  console.log(`\n== ${label} ==`)
  console.log('ok=' + j.ok, 'cached=' + j.cached, 'fallback=' + j.fallback, 'reason=' + (j.reason || ''), 'rows=' + rows.length)
  console.log('wild=' + JSON.stringify(wildFound))
  console.log('inGroupDup=' + JSON.stringify(inGroupDup.slice(0, 10)))
  if (label.includes('new_sentence_pool')) {
    console.log('--- 全表预览 ---')
    for (const x of rows) console.log(x.seq + ' [' + (x.groupId || '') + '] ' + (x.ru || '') + ' = ' + (x.zh || ''))
  }
}

// 实验①：全新句子 + pool（生产从未生成过）
await run('new_sentence_pool', 'Я люблю читать книги', '我喜欢读书', 'easy', true)
// 实验②：全新句子 + 无 pool（模拟用户前端未传词池）
await run('new_sentence_nopool', 'Я люблю читать книги', '我喜欢读书', 'medium', false)
// 实验③：用户句子 + 无 pool
await run('user_sentence_nopool', 'Я хочу читать книгу', '我想读书', 'medium', false)
