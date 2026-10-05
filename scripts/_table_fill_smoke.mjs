#!/usr/bin/env node
// 端到端冒烟：真实调生产 /api/admin/segments/table-fill（真 LLM + 真鉴权），前端 verifyTable 双保险
// 用法：node scripts/_table_fill_smoke.mjs ["俄语句子"] ["中文"]
//   CORE=1 跑核心句长链（~190 步意图），默认短链（~20 步）
// 退出码：0=verifyTable 通过  1=HTTP/响应异常  2=网络错误（未部署）  3=后端 fallback  4=响应结构异常  5=verifyTable 未过
import crypto from 'node:crypto'
import dns from 'node:dns'
dns.setDefaultResultOrder('ipv4first') // Windows 双栈 DNS：强制 IPv4（否则 fetch 走无路由 IPv6 间歇 failed）
import { buildShortChainIntent, buildCoreChainIntent, verifyTable } from '../src/lib/jlTableEngine.js'
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

const sentence = process.argv[2] || 'Я люблю еду'
const zh = process.argv[3] || '我喜欢食物'
const normalized = normalizeSentence(sentence)
const tokens = splitTokens(normalized)
const difficulty = process.env.DIFF || 'easy'
const hash = sentenceHash(normalized, difficulty)
const isCore = process.env.CORE === '1'
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
const intents = isCore
  ? buildCoreChainIntent({ sentence: normalized, tokens, pool, zh })
  : buildShortChainIntent({ sentence: normalized, tokens, zh })

const body = { sentence_hash: hash, russian_text: normalized, tokens, difficulty, intents, pool }
const start = Date.now()
let res
for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    res = await fetch(BASE + '/api/admin/segments/table-fill', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + signJwt(SECRET, { sub: UID, role: 'admin' }),
      },
      body: JSON.stringify(body),
    })
    break
  } catch (e) {
    if (attempt === 3) {
      console.error('网络错误（生产接口未部署/离线？）:', e.message)
      process.exit(2)
    }
    console.error(`网络错误第 ${attempt} 次，5s 后重试:`, e.message)
    await new Promise((r) => setTimeout(r, 5000))
  }
}
const elapsed = ((Date.now() - start) / 1000).toFixed(1)
const json = await res.json().catch(() => null)
console.log(`HTTP ${res.status} · ${elapsed}s · intents=${intents.length}（${isCore ? '核心长链' : '短链'}）· sentence="${normalized}"`)
if (!res.ok || !json) {
  console.error('非 200 或响应非 JSON:', JSON.stringify(json || {}, null, 2))
  process.exit(1)
}
if (json.pending) { console.log('→ pending:', json.reason); process.exit(0) }
if (json.fallback) { console.log('→ fallback:', json.reason, '| detail:', json.detail || ''); process.exit(3) }
if (!json.ok || !Array.isArray(json.rows)) { console.error('异常响应:', JSON.stringify(json, null, 2).slice(0, 800)); process.exit(4) }
const v = verifyTable(json.rows, normalized, zh)
console.log(`rows=${json.rows.length} · 组数=${new Set(json.rows.map((r) => r.groupId)).size}`)
console.log('行预览（前 8）:')
for (const r of json.rows.slice(0, 8)) console.log(`  ${String(r.seq).padStart(3)} ${r.cardType} ${r.ru} — ${r.zh} [${r.tag}] (${r.groupId})`)
if (v.ok) {
  console.log('✅ verifyTable 通过：骨架完整句逐字符==原句、零件全覆盖、变体不重复')
  process.exit(0)
}
console.error('❌ verifyTable 失败:', v.errors.slice(0, 5).join('\n   '))
console.error('— 完整句行全览 —')
for (const r of json.rows.filter((x) => x.cardType === '完整句')) console.error(`  #${r.seq} [${r.groupId}] ${r.ru} | ${r.zh}`)
process.exit(5)
