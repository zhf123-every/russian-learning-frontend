// P1 5a 前后端逐字符一致性比对：前端侧（node ESM 直跑 segmentEngine.js 真实导出）
import { normalizeSentence, splitTokens, sentenceHash } from '../src/lib/segmentEngine.js'
import { writeFileSync } from 'node:fs'

const SENTENCES = [
  'Этому городу уже 500 лет.',
  'Я люблю книгу.',
  'Он читает книгу в школе.',
  'На улице Чистые пруды находится театр «Современник».',
  'Антон спросил Тома , куда он пошёл вечером .',
]

const out = SENTENCES.map((s) => ({
  sentence: s,
  normalized: normalizeSentence(s),
  tokens: splitTokens(s),
  hash_easy: sentenceHash(s, 'easy'),
}))

writeFileSync('_seg_compare_front_out.json', JSON.stringify(out, null, 2), 'utf8')
console.log(`FRONT_DONE items=${out.length}`)
for (const o of out) console.log(JSON.stringify(o))
