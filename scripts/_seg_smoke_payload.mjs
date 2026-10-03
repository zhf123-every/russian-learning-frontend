// P1 端到端冒烟 payload 生成：用前端真实算法算 sentence_hash/russian_text/tokens
import { normalizeSentence, sentenceHash, splitTokens } from '../src/lib/segmentEngine.js'
import { writeFileSync } from 'node:fs'

const SENTENCES = ['Я люблю книгу.', 'Этому городу уже 500 лет.']
const out = SENTENCES.map((s) => {
  const normalized = normalizeSentence(s)
  return {
    sentence: s,
    normalized,
    sentence_hash: sentenceHash(s, 'easy'),
    difficulty: 'easy',
    russian_text: normalized,
    tokens: splitTokens(normalized),
  }
})
writeFileSync('_seg_smoke_payload.json', JSON.stringify(out, null, 2), 'utf8')
console.log(`PAYLOAD items=${out.length}`)
