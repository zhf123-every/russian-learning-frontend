// v9 决定性验证：全新句子（无缓存）+ 严格校验
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
  time: [{ ru: 'сейчас', zh: '现在' }, { ru: 'сегодня', zh: '今天' }],
  place: [{ ru: 'здесь', zh: '这里' }],
  degree: [{ ru: 'очень', zh: '非常' }],
  evaluation: [{ ru: 'важно', zh: '重要' }, { ru: 'хорошо', zh: '好' }, { ru: 'невозможно', zh: '不可能' }, { ru: 'возможно', zh: '可能' }],
  predicates: [{ ru: 'хочу', zh: '想' }, { ru: 'нужно', zh: '需要' }, { ru: 'должен', zh: '必须' }],
  objects: [{ ru: 'еду', zh: '食物', inf: 'есть' }],
  preposition: [{ ru: 'для меня', zh: '对我来说' }],
  connector: [{ ru: 'поэтому', zh: '所以' }],
}
const WILD = ['библиотек', 'завтра', 'перечита', 'стихи', 'письмо', 'три раза', 'эту книгу', 'в парке', 'вечером', 'утром', 'скорее', 'еще раз', 'каждый день', 'по вечерам', 'из-за работы', 'заслуживает', 'порекомендовал', 'слишком сложной', 'успеваю', 'интересных']
const CONNECTOR = ['поэтому', 'if', 'потому что', 'хотя']

async function run(label, sentence, zh, difficulty) {
  const normalized = normalizeSentence(sentence)
  const tokens = splitTokens(normalized)
  const hash = sentenceHash(normalized, difficulty)
  const intents = buildCoreChainIntent({ sentence: normalized, tokens, pool: POOL, zh })
  const body = { sentence_hash: hash, russian_text: normalized, tokens, difficulty, intents, pool: POOL }
  const r = await fetch(BASE + '/api/admin/segments/table-fill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + signJwt(SECRET, { sub: UID, role: 'admin' }) },
    body: JSON.stringify(body),
  })
  const raw = await r.text()
  let j
  try { j = JSON.parse(raw) } catch { j = { parse_error: raw.slice(0, 200) } }
  const rows = (j.ok && Array.isArray(j.rows)) ? j.rows : []
  const ruAll = rows.map(x => (x.ru || '')).join(' ')
  const wildFound = WILD.filter(w => ruAll.includes(w))
  const seenG = new Map(); const inGroupDup = []
  for (const x of rows) {
    const g = x.groupId || ''; const k = (x.ru || '').trim()
    if (!g || !k) continue
    const s = seenG.get(g) || new Set()
    if (s.has(k)) inGroupDup.push(g + ':' + k)
    s.add(k); seenG.set(g, s)
  }
  // 顺序重复（相邻两行 ru 相同）
  const adjDup = []
  for (let i = 1; i < rows.length; i++) if ((rows[i].ru || '') === (rows[i - 1].ru || '')) adjDup.push(i)
  // 完整句 vs 原句
  const fulls = rows.filter(x => x.cardType === '完整句').map(x => x.ru)
  const containsCore = fulls.includes(normalized)
  const ok =
    j.ok === true && j.fallback === undefined && rows.length > 0 &&
    wildFound.length === 0 && inGroupDup.length === 0 && adjDup.length === 0 && containsCore
  console.log(`\n== ${label} ==`)
  console.log('ok=' + j.ok, 'cached=' + j.cached, 'fallback=' + (j.fallback === undefined ? 'undef' : j.fallback), 'prompt_v=' + (j.prompt_v || '?'), 'rows=' + rows.length)
  console.log('VERDICT=' + (ok ? 'CLEAN ✅' : 'DIRTY ❌'))
  if (wildFound.length) console.log('WILD=' + JSON.stringify(wildFound))
  if (inGroupDup.length) console.log('GROUP_DUP=' + JSON.stringify(inGroupDup.slice(0, 10)))
  if (adjDup.length) console.log('ADJ_DUP=' + JSON.stringify(adjDup))
  console.log('fullCount=' + fulls.length, 'containsCore=' + containsCore)
  console.log('--- 全表 ---')
  for (const x of rows) console.log(x.seq + ' [' + (x.groupId || '') + '] ' + (x.ru || '') + ' || ' + (x.zh || ''))
}

// 全新句子（生产从未生成过）
await run('fresh_sentence', 'Я люблю читать книги', '我喜欢读书', 'easy')
