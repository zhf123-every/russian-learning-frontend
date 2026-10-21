// 批量导入质检逻辑自测
const { runQc, qcSummary } = await import('./src/utils/importQc.js')
let ok = 0, fail = 0
const check = (name, cond, extra = '') => { if (cond) { ok++; console.log('  ✓', name) } else { fail++; console.log('  ✗', name, extra) } }
const has = (r, code) => r.items.some(i => i.code === code)

// 1) 合格数据：零问题
const good = runQc({
  sentences: [{ ru: 'Я читаю книгу', chinese: '我读书', chunks: [{ word: 'книгу', translation: '书', role: '宾语', pos: '名词', phonetic: 'knigu' }] }],
  paths: [{ pathId: 'p1', steps: [{ stepIndex: 1, russian: 'Я', chinese: '我' }, { stepIndex: 2, russian: 'Я читаю', chinese: '我读' }] }],
  dialogues: [{ speaker: 'Иван', text: 'Привет!' }],
})
check('合格数据 0 问题', good.errors === 0 && good.warns === 0, JSON.stringify(good.items))

// 2) 句子问题
const s = runQc({ sentences: [{ ru: '', chinese: '缺俄语' }, { ru: 'Это дом.', chinese: 'Это дом' }, { ru: 'В 500 году', chinese: '在500年' }, { ru: 'Тут.', chinese: '' }] })
check('缺俄语 → error', has(s, 'empty_ru'))
check('中文混俄语 → warn', has(s, 'zh_has_cyrillic'))
check('俄语含数字 → warn', has(s, 'ru_has_digit'))
check('缺中文 → warn', has(s, 'missing_zh'))
check('句子问题计数', s.errors === 1 && s.warns === 3, JSON.stringify(s.items))

// 3) 词卡问题
const c = runQc({ sentences: [{ ru: 'Книга', chinese: '书', chunks: [{ word: 'книга' }] }] })
check('词卡缺中文 → warn', has(c, 'chunk_no_zh'))
check('词卡缺词性 → warn', has(c, 'chunk_no_pos'))
check('词卡缺成分 → warn', has(c, 'chunk_no_role'))
check('词卡缺发音 → warn', has(c, 'chunk_no_phonetic'))
check('词卡 4 提示', c.warns === 4, JSON.stringify(c.items))

// 4) 路径问题
const p = runQc({ paths: [
  { steps: [] },
  { pathId: 'p2', steps: [{ stepIndex: 1, russian: 'Я', chinese: '我' }, { stepIndex: 1, russian: 'Ты', chinese: '你' }, { russian: 'Он' }, { chinese: '' }] },
] })
check('空 pathId → error', has(p, 'empty_pathId'))
check('空 steps → error', has(p, 'empty_steps'))
check('stepIndex 重复 → warn', has(p, 'dup_stepIndex'))
check('缺步俄语 → error', has(p, 'empty_step_ru'))
check('缺步中文 → warn', has(p, 'empty_step_zh'))

// 5) 对话
const d = runQc({ dialogues: [{ text: 'Привет' }, { speaker: 'Анна' }] })
check('缺说话人 → warn', has(d, 'empty_speaker'))
check('缺对话内容 → error', has(d, 'empty_dialogue'))

// 6) 摘要文案
check('摘要', qcSummary({ errors: 2, warns: 3 }) === '2 个硬伤，3 个提示')
check('摘要通过', qcSummary({ errors: 0, warns: 0 }) === '无问题')

console.log('== 结果: %d 通过 / %d 失败 ==', ok, fail)
process.exit(fail ? 1 : 0)
