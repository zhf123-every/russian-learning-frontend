// 通用 AI 中转：由后端持有密钥，前端不再直接调用第三方 AI 接口
import { apiFetch } from './api'

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
