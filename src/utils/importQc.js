// ========== 批量导入质检（导入即检，问题清单化） ==========
// 确定性规则质检：不调 AI，秒出结果；AI 深度审核（语序/语义/语法）由页面层另行调用。
// 输出统一结构：{ errors, warns, items:[{type,index,level,code,message}] }
//   type: sentence | path | step | dialogue | chunk
//   level: error（硬伤，建议修）| warn（质量提示，可忽略）

const CYRILLIC = /[а-яё]/i
const DIGIT = /[0-9]/

// 取 chunk 的中文：translation / zh / cn / chinese
const chunkZh = (c) => String(c && (c.translation || c.zh || c.cn || c.chinese) || '').trim()
// 取 chunk 的发音字段：phonetic / accent / transcription / pronounce / pron
const chunkPhonetic = (c) => String(c && (c.phonetic || c.accent || c.transcription || c.pronounce || c.pron) || '').trim()
// 取词性：pos / partOfSpeech / posTag / type
const chunkPos = (c) => String(c && (c.pos || c.partOfSpeech || c.posTag || c.type) || '').trim()

function qcChunk(c, type, index, out) {
  if (!c || typeof c !== 'object') return
  const w = String(c.word || c.ru || c.russian || '').trim()
  if (!w) return
  const base = { type, index }
  if (!chunkZh(c)) out.push({ ...base, level: 'warn', code: 'chunk_no_zh', message: `词卡「${w}」缺中文翻译` })
  if (!chunkPos(c)) out.push({ ...base, level: 'warn', code: 'chunk_no_pos', message: `词卡「${w}」缺词性(pos)` })
  if (!c.role) out.push({ ...base, level: 'warn', code: 'chunk_no_role', message: `词卡「${w}」缺句子成分(role)` })
  if (!chunkPhonetic(c)) out.push({ ...base, level: 'warn', code: 'chunk_no_phonetic', message: `词卡「${w}」缺发音` })
  if (DIGIT.test(w)) out.push({ ...base, level: 'warn', code: 'ru_has_digit', message: `词卡「${w}」含阿拉伯数字（按规范应用俄语数字）` })
}

function countLevels(items) {
  return { errors: items.filter((i) => i.level === 'error').length, warns: items.filter((i) => i.level === 'warn').length }
}

/**
 * 质检入口：对已归一化的导入数据跑规则检查。
 * @param {{sentences:Array, paths:Array, dialogues:Array}} data normalizeImportData 的输出
 * @returns {{errors, warns, items}}
 */
export function runQc(data) {
  const items = []
  const sentences = Array.isArray(data && data.sentences) ? data.sentences : []
  const paths = Array.isArray(data && data.paths) ? data.paths : []
  const dialogues = Array.isArray(data && data.dialogues) ? data.dialogues : []

  // —— 句子 ——
  sentences.forEach((s, i) => {
    const ru = String(s && (s.ru || s.russian || s.text) || '').trim()
    if (!ru) { items.push({ type: 'sentence', index: i, level: 'error', code: 'empty_ru', message: `第 ${i + 1} 句缺俄语原文` }); return }
    const zh = String(s && (s.chinese || s.zh || s.cn) || '').trim()
    if (!zh) items.push({ type: 'sentence', index: i, level: 'warn', code: 'missing_zh', message: `「${ru.slice(0, 30)}…」缺中文翻译（可点「导入并 AI 修复」自动补）` })
    else if (CYRILLIC.test(zh)) items.push({ type: 'sentence', index: i, level: 'warn', code: 'zh_has_cyrillic', message: `「${zh.slice(0, 30)}…」中文里混入了俄文字母` })
    if (DIGIT.test(ru)) items.push({ type: 'sentence', index: i, level: 'warn', code: 'ru_has_digit', message: `「${ru.slice(0, 30)}…」含阿拉伯数字（按规范应用俄语数字，如 500 → пятьсот）` })
    // 词卡质检（chunks / words）
    const chunks = Array.isArray(s.chunks) ? s.chunks : (Array.isArray(s.words) ? s.words : [])
    chunks.forEach((c, ci) => qcChunk(c, 'sentence', i, items))
  })

  // —— 滚动路径 ——
  paths.forEach((p, pi) => {
    const pid = String(p && p.pathId || '').trim()
    if (!pid) items.push({ type: 'path', index: pi, level: 'error', code: 'empty_pathId', message: `第 ${pi + 1} 条路径缺 pathId` })
    const steps = Array.isArray(p && p.steps) ? p.steps : []
    if (!steps.length) { items.push({ type: 'path', index: pi, level: 'error', code: 'empty_steps', message: `路径「${pid || pi + 1}」没有 steps` }); return }
    const seenIdx = new Set()
    let expect = 1
    steps.forEach((st, si) => {
      const ru = String(st && (st.russian || st.ru) || '').trim()
      if (!ru) { items.push({ type: 'step', index: pi, level: 'error', code: 'empty_step_ru', message: `路径「${pid || pi + 1}」第 ${si + 1} 步缺俄语` }); return }
      const zh = String(st && (st.chinese || st.zh) || '').trim()
      if (!zh) items.push({ type: 'step', index: pi, level: 'warn', code: 'empty_step_zh', message: `路径「${pid || pi + 1}」第 ${si + 1} 步「${ru}」缺中文` })
      const idx = Number(st.stepIndex)
      if (idx) {
        if (seenIdx.has(idx)) items.push({ type: 'step', index: pi, level: 'warn', code: 'dup_stepIndex', message: `路径「${pid || pi + 1}」stepIndex ${idx} 重复` })
        seenIdx.add(idx)
      } else if (si + 1 !== expect) {
        // stepIndex 缺失且与位置不符 → 提示不连续（宽松：不强制）
        items.push({ type: 'step', index: pi, level: 'warn', code: 'step_index_gap', message: `路径「${pid || pi + 1}」步骤序号可能不连续（第 ${si + 1} 步）` })
      }
      expect = si + 2
      const allChunks = Array.isArray(st.allChunks) ? st.allChunks : []
      const newChunks = Array.isArray(st.newChunks) ? st.newChunks : []
      ;[...newChunks, ...allChunks].forEach((c, ci) => qcChunk(c, 'step', pi, items))
    })
  })

  // —— 对话 ——
  dialogues.forEach((d, di) => {
    const speaker = String(d && (d.speaker || d.who) || '').trim()
    const text = String(d && (d.text || d.ru || d.russian) || '').trim()
    if (!speaker) items.push({ type: 'dialogue', index: di, level: 'warn', code: 'empty_speaker', message: `第 ${di + 1} 条对话缺说话人(speaker)` })
    if (!text) items.push({ type: 'dialogue', index: di, level: 'error', code: 'empty_dialogue', message: `第 ${di + 1} 条对话缺内容(text)` })
  })

  const { errors, warns } = countLevels(items)
  return { errors, warns, items }
}

/** 质检面板摘要文案 */
export function qcSummary(r) {
  if (!r) return ''
  const parts = []
  if (r.errors) parts.push(r.errors + ' 个硬伤')
  if (r.warns) parts.push(r.warns + ' 个提示')
  return parts.join('，') || '无问题'
}
