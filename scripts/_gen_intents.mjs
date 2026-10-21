// 生成前端 intents JSON（v12 结构）供 Python 本地复现；词池用生产同款 DEFAULT_SLOT_POOL
import { buildCoreChainIntent } from '../src/lib/jlTableEngine.js'
import { normalizeSentence, splitTokens } from '../src/lib/segmentEngine.js'
import { DEFAULT_SLOT_POOL as POOL } from '../src/lib/slotTablesTrigger.js'
import fs from 'node:fs'
const sentence = 'Я люблю читать книги'
const normalized = normalizeSentence(sentence)
const tokens = splitTokens(normalized)
const intents = buildCoreChainIntent({ sentence: normalized, tokens, pool: POOL, zh: '我喜欢读书' })
fs.writeFileSync('_intents_v9.json', JSON.stringify({ intents, tokens, pool: POOL, sentence: normalized }, null, 2))
console.log('intents=' + intents.length, 'tokens=' + JSON.stringify(tokens))
