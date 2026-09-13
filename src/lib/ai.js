// 通用 AI 中转：由后端持有密钥，前端不再直接调用第三方 AI 接口
import { apiFetch, API_BASE } from './api'

export async function chat({ messages } = {}) {
  const r = await apiFetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  })
  const j = await r.json()
  if (!j.ok) throw new Error(j.error || 'AI 接口错误')
  return j.content
}

// 调用后端 /api/ai（统一 AI 入口，密钥在服务端环境变量中）
export async function callAI(messages) {
  const r = await apiFetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages })
  })
  const j = await r.json()
  if (!j.ok) throw new Error(j.error || 'AI 接口错误')
  return j.content
}

// 解析 AI 返回的 JSON（去除 markdown 代码块包裹）
export function parseAIJSON(content) {
  let t = (content || '').trim()
  // 去掉 ```json ... ``` 包裹
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  // 提取 { ... }
  const a = t.indexOf('{'), b = t.lastIndexOf('}')
  if (a >= 0 && b > a) t = t.slice(a, b + 1)
  try {
    return JSON.parse(t)
  } catch (e) {
    return null
  }
}

// 语法解释：调用后端 /api/grammar（服务端持有密钥）
export async function explainSentence(text) {
  const r = await apiFetch('/api/grammar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sentence: text }),
  })
  if (!r.ok) {
    let errMsg = '语法解析失败（HTTP ' + r.status + '）'
    try {
      const j = await r.json()
      if (j && j.error) errMsg = j.error
    } catch (e) { /* body 非 JSON，忽略 */ }
    throw new Error(errMsg)
  }
  const j = await r.json()
  if (!j.ok) throw new Error(j.error || '语法解析失败')
  return j.content
}

// Blob 转 base64（用于上传录音）
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// 背诵录音与原文比对：调用后端 /api/recite-compare
// 返回 { user_text, errors: [{type, original, user, suggestion, correct_reading}], overall_tip }
export async function reciteCompare(audioBlob, standardText) {
  const base64 = await blobToBase64(audioBlob)
  const r = await apiFetch('/api/recite-compare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio: base64, standard: standardText }),
  })
  if (!r.ok) {
    let errMsg = 'AI比对失败（HTTP ' + r.status + '）'
    try {
      const j = await r.json()
      if (j && j.error) errMsg = j.error
    } catch (e) { /* body 非 JSON，忽略 */ }
    throw new Error(errMsg)
  }
  const j = await r.json()
  if (!j.ok) throw new Error(j.error || 'AI比对失败')
  return j.result
}

// 句子精析：逐词（重音/词性/词义）+ 句子成分 + 中译 + 语法解析
// 返回 { words:[{word,stressed,pos,mean}], components:[{text,role}], translation, grammar }
export async function analyzeSentence(sentence) {
  const r = await apiFetch('/api/sentence-analysis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sentence }),
  })
  if (!r.ok) throw new Error('句子解析失败（HTTP ' + r.status + '）')
  const j = await r.json()
  if (!j.ok) throw new Error(j.error || '句子解析失败')
  return j.result
}

// 口语评测：录音 + 标准原文 → 五档分数 + 逐词标注 + 重音停顿建议
// 返回 { user_text, score, ratio, words:[{target,heard,status}], stress, rhythm, summary }
export async function pronunciationScore(audioBlob, standardText) {
  const base64 = await blobToBase64(audioBlob)
  const r = await apiFetch('/api/pronunciation-score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio: base64, standard: standardText }),
  })
  if (!r.ok) {
    let errMsg = '口语评测失败（HTTP ' + r.status + '）'
    try {
      const j = await r.json()
      if (j && j.error) errMsg = j.error
    } catch (e) { /* 忽略 */ }
    throw new Error(errMsg)
  }
  const j = await r.json()
  if (!j.ok) throw new Error(j.error || '口语评测失败')
  return j.result
}

// 后端 edge-tts 音频地址：voice 传 'female'/'male' 切换男女声
export function ttsUrl(text, voice = 'female') {
  return (API_BASE || '') + '/api/tts?text=' + encodeURIComponent(text) +
    '&voice=' + encodeURIComponent(voice) + '&_=' + Date.now()
}
