#!/usr/bin/env node
// 端到端冒烟（P2 持久化）：table-fill 生成短链 → 生产 save（probe 课时）→ 生产 read → 校验读回。
// 用法：node scripts/_slot_save_smoke.mjs ["俄语句子"] ["中文"]
// 退出码：0=全链路通过  1=HTTP/响应异常  2=网络错误  3=后端 fallback  4=响应结构异常  5=verifyTable 未过
//        6=save 失败  7=read 回读不符
import crypto from 'node:crypto'
import dns from 'node:dns'
dns.setDefaultResultOrder('ipv4first')
import { buildShortChainIntent, verifyTable } from '../src/lib/jlTableEngine.js'
import { normalizeSentence, splitTokens, sentenceHash } from '../src/lib/segmentEngine.js'

const BASE = process.env.SMOKE_BASE || 'https://russian-learning-jetq.onrender.com'
const SECRET = process.env.SMOKE_SECRET || 'f1af671f29f125467d69431d87dc7f5cc1a039aea236dd3c75f38c8be69e2c68'
const UID = process.env.SMOKE_UID || 'u_c0bc17d7b20b45799721'

function signJwt(secret, payload) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const h = b64({ alg: 'HS256', typ: 'JWT' })
  const p = b64({ ...payload, iat: now, exp: now + 600 })
  const s = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url')
  return `${h}.${p}.${s}`
}

async function post(path, body, token) {
  let res
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      res = await fetch(BASE + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(body),
      })
      return { res, json: await res.json().catch(() => null) }
    } catch (e) {
      if (attempt === 3) { console.error('网络错误:', e.message); process.exit(2) }
      console.error(`网络错误第 ${attempt} 次，5s 后重试:`, e.message)
      await new Promise((r) => setTimeout(r, 5000))
    }
  }
}
async function get(path) {
  let res
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      res = await fetch(BASE + path)
      return { res, json: await res.json().catch(() => null) }
    } catch (e) {
      if (attempt === 3) { console.error('网络错误:', e.message); process.exit(2) }
      console.error(`网络错误第 ${attempt} 次，5s 后重试:`, e.message)
      await new Promise((r) => setTimeout(r, 5000))
    }
  }
}

const sentence = process.argv[2] || 'Я люблю еду'
const zh = process.argv[3] || '我喜欢食物'
const normalized = normalizeSentence(sentence)
const tokens = splitTokens(normalized)
const difficulty = 'easy'
const hash = sentenceHash(normalized, difficulty)
const token = signJwt(SECRET, { sub: UID, role: 'admin' })
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
const intents = buildShortChainIntent({ sentence: normalized, tokens, zh })

// 1) 生成
console.log(`① 生成短链 · sentence="${normalized}" · hash=${hash}`)
const { res, json } = await post('/api/admin/segments/table-fill', {
  sentence_hash: hash, russian_text: normalized, tokens, difficulty, intents, pool,
}, token)
if (!res.ok || !json) { console.error('生成异常:', JSON.stringify(json || {}, null, 2).slice(0, 500)); process.exit(1) }
if (json.pending) { console.log('→ pending:', json.reason); process.exit(0) }
if (json.fallback) { console.log('→ fallback:', json.reason); process.exit(3) }
if (!json.ok || !Array.isArray(json.rows)) { console.error('生成响应异常:', JSON.stringify(json, null, 2).slice(0, 500)); process.exit(4) }
const v = verifyTable(json.rows, normalized, zh)
console.log(`   rows=${json.rows.length} · verifyTable=${v.ok ? '通过' : '未过'}${v.ok ? '' : ' ' + JSON.stringify(v.errors).slice(0, 300)}`)
if (!v.ok) process.exit(5)

// 2) save（probe 课时，不污染真实课程）
const courseId = 'probe', unitId = 'probe'
const items = [{ sentence_hash: hash, sentence: normalized, difficulty, intents_fp: 'unit', rows: json.rows, review_status: 'ok' }]
const s = await post('/api/admin/slot-tables/save', { course_id: courseId, unit_id: unitId, items }, token)
console.log(`② save · HTTP ${s.res.status} · ${JSON.stringify(s.json || {}).slice(0, 200)}`)
if (!s.res.ok || !s.json || !s.json.ok) process.exit(6)

// 3) read（公开读，学生端数据源）
const r = await get(`/api/slot-tables?course_id=${courseId}&unit_id=${unitId}`)
console.log(`③ read · HTTP ${r.res.status} · items=${(r.json && r.json.items || []).length}`)
if (!r.res.ok || !r.json || !r.json.ok) process.exit(7)
const found = (r.json.items || []).find((it) => it.sentence_hash === hash && it.difficulty === difficulty)
if (!found) { console.error('read 回读缺该句该档'); process.exit(7) }
const v2 = verifyTable(found.rows, found.sentence, zh)
console.log(`   回读 rows=${found.rows.length} · seq 首末=${found.rows[0].seq}..${found.rows[found.rows.length - 1].seq} · verifyTable=${v2.ok ? '通过' : '未过'}${v2.ok ? '' : ' ' + JSON.stringify(v2.errors).slice(0, 300)}`)
if (!v2.ok) process.exit(5)
console.log('✅ P2 持久化端到端冒烟通过：生成 → 入库 → 学生端可读')
process.exit(0)
