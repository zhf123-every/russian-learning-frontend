#!/usr/bin/env node
// 生成冒烟请求体（复用 jlTableEngine 意图），供 PowerShell 发送——绕开 undici 大请求问题
// 用法: node scripts/_gen_smoke_body.mjs <sentence> <zh> [CORE]
import dns from 'node:dns'
dns.setDefaultResultOrder('ipv4first')
import { writeFileSync } from 'node:fs'
import { buildShortChainIntent, buildCoreChainIntent } from '../src/lib/jlTableEngine.js'
import { normalizeSentence, splitTokens, sentenceHash } from '../src/lib/segmentEngine.js'

const sentence = process.argv[2] || 'Я люблю еду'
const zh = process.argv[3] || '我喜欢食物'
const isCore = process.env.CORE === '1'
const normalized = normalizeSentence(sentence)
const tokens = splitTokens(normalized)
const difficulty = 'easy'
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
const intents = isCore
  ? buildCoreChainIntent({ sentence: normalized, tokens, pool, zh })
  : buildShortChainIntent({ sentence: normalized, tokens, zh })
const body = { sentence_hash: hash, russian_text: normalized, tokens, difficulty, intents, pool }
writeFileSync('_smoke_body.json', JSON.stringify(body), 'utf-8')
console.log('body written: intents=' + intents.length + ' core=' + isCore)
