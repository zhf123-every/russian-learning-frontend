// 三档难度 intents 行数验证（新规则：medium 只出≥2词组合积木；hard 纯完整句）
import { buildCoreChainIntent } from '../src/lib/jlTableEngine.js'
import { normalizeSentence, splitTokens } from '../src/lib/segmentEngine.js'
const POOL = {
  negation: [{ ru: 'не', zh: '不' }], time: [{ ru: 'сейчас', zh: '现在' }, { ru: 'сегодня', zh: '今天' }],
  place: [{ ru: 'здесь', zh: '这里' }], degree: [{ ru: 'очень', zh: '非常' }],
  evaluation: [{ ru: 'важно', zh: '重要' }, { ru: 'хорошо', zh: '好' }, { ru: 'невозможно', zh: '不可能' }, { ru: 'возможно', zh: '可能' }],
  predicates: [{ ru: 'хочу', zh: '想' }, { ru: 'нужно', zh: '需要' }, { ru: 'должен', zh: '必须' }],
  objects: [{ ru: 'еду', zh: '食物', inf: 'есть' }],
  preposition: [{ ru: 'для меня', zh: '对我来说' }], connector: [{ ru: 'поэтому', zh: '所以' }],
}
const sentence = 'Я хочу читать книгу'
const tokens = splitTokens(normalizeSentence(sentence))
for (const d of ['easy', 'medium', 'hard']) {
  const intents = buildCoreChainIntent({ sentence, tokens, pool: POOL, zh: '我想读书', difficulty: d })
  const vis = intents.filter((i) => !i.hidden)
  const parts = vis.filter((i) => i.kind === 'part').length
  const fulls = vis.filter((i) => i.kind === 'full').length
  const hidden = intents.length - vis.length
  const sk = intents.filter((i) => i.groupId === 'G_01' && i.template === 'skeleton')
  const oneWord = vis.filter((i) => i.kind === 'part' && (!i.templateText || i.templateText.trim().split(/\s+/).length < 2) && i.role !== '组合').length
  console.log(`${d}: 表格 ${vis.length} 行（积木 ${parts} + 完整句 ${fulls}，隐藏 ${hidden} 行喂ctx），骨架compose=${sk[0].compose.length ? '全句' : '后端分组'}，可见单字积木=${oneWord}`)
}
console.log('done')
