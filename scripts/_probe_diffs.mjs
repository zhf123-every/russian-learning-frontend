// 临时探针：同一新句子跑 3 难度，确认后端 easy/medium/hard 行为（不提交）
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

async function run(label, sentence, zh, difficulty) {
  const normalized = normalizeSentence(sentence)
  const tokens = splitTokens(normalized)
  const hash = sentenceHash(normalized, difficulty)
  const intents = buildCoreChainIntent({ sentence: normalized, tokens, pool: POOL, zh })
  const body = { sentence_hash: hash, russian_text: normalized, tokens, difficulty, intents, pool: POOL }
  const t0 = Date.now()
  let r
  try {
    r = await fetch(BASE + '/api/admin/segments/table-fill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + signJwt(SECRET, { sub: UID, role: 'admin' }) },
      body: JSON.stringify(body),
    })
    r = await r.json()
  } catch (e) {
    console.log(label + ' fetch-error: ' + String(e && e.message || e))
    return
  }
  const ms = Date.now() - t0
  const rows = Array.isArray(r.rows) ? r.rows : []
  const fulls = rows.filter((x) => x.cardType === '完整句').map((x) => x.ru)
  console.log(label + ': ok=' + r.ok + ' cached=' + r.cached + ' fallback=' + (r.fallback === undefined ? 'undef' : r.fallback) + ' reason=' + (r.reason || '') + ' rows=' + rows.length + ' ms=' + ms)
  if (r.fallback || !r.ok) { console.log('  → ' + JSON.stringify(r).slice(0, 300)); return }
  const hasCore = fulls.includes(normalized)
  console.log('  fulls=' + fulls.length + ' containsCore=' + hasCore)
  const dup = []
  for (let i = 1; i < rows.length; i++) if ((rows[i].ru || '') === (rows[i - 1].ru || '')) dup.push(i)
  console.log('  adjDup=' + JSON.stringify(dup))
}

await run('EASY', 'Я люблю читать книги', '我喜欢读书', 'easy')
await run('MEDIUM', 'Я люблю читать книги', '我喜欢读书', 'medium')
await run('HARD', 'Я люблю читать книги', '我喜欢读书', 'hard')
console.log('done')
