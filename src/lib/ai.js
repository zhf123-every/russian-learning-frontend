// 通用 AI 中转：由后端持有密钥，前端不再直接调用第三方 AI 接口
import { apiFetch, API_BASE } from './api'

// AI 请求超时：后端 Render 免费实例冷启动 30-60s + 大模型生成 10-60s，150s 偏紧会被掐断（报 abort）
const AI_TIMEOUT = 180000

// 单次 AI 调用；AbortError（超时被前端掐断）时自动等 3s 重试一次——
// 首次超时多半是后端冷启动，重试时后端已被唤醒，基本必成
async function chatOnce(messages, timeout) {
  const r = await apiFetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
    timeout,
  })
  const j = await r.json()
  if (!j.ok) throw new Error(j.error || 'AI 接口错误')
  return j.content
}

async function chatWithRetry(messages, timeout) {
  try {
    return await chatOnce(messages, timeout)
  } catch (e) {
    if (e && e.name === 'AbortError') {
      await new Promise(res => setTimeout(res, 3000)) // 等后端冷启动完成
      try {
        return await chatOnce(messages, timeout)
      } catch (e2) {
        if (e2 && e2.name === 'AbortError') {
          throw new Error('AI 请求超时（后端启动或生成较慢），请稍候 1 分钟再试')
        }
        throw e2
      }
    }
    throw e
  }
}

export async function chat({ messages } = {}) {
  return chatWithRetry(messages, AI_TIMEOUT)
}

// 调用后端 /api/ai（统一 AI 入口，密钥在服务端环境变量中）
export async function callAI(messages) {
  return chatWithRetry(messages, AI_TIMEOUT)
}

// 解析 AI 返回的 JSON（去除 markdown 代码块包裹；支持对象与数组）
export function parseAIJSON(content) {
  let t = (content || '').trim()
  // 去掉 ```json ... ``` 包裹
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  // 1) 先尝试整体解析（AI 可能直接返回合法 JSON 对象或数组）
  try {
    const v = JSON.parse(t)
    if (v && typeof v === 'object') return v
  } catch (e) { /* 继续提取 */ }
  // 2) 提取 [ ... ]（数组）
  const c = t.indexOf('['), d = t.lastIndexOf(']')
  if (c >= 0 && d > c) {
    try {
      const v = JSON.parse(t.slice(c, d + 1))
      if (Array.isArray(v)) return v
    } catch (e) { /* 继续 */ }
  }
  // 3) 提取 { ... }（对象）
  const a = t.indexOf('{'), b = t.lastIndexOf('}')
  if (a >= 0 && b > a) {
    try {
      const v = JSON.parse(t.slice(a, b + 1))
      if (v && typeof v === 'object') return v
    } catch (e) { return null }
  }
  return null
}

// 通用包装：AbortError（超时被前端掐断）时等 3s 自动重试一次，重试仍超时给友好文案
async function retryOnAbort(fn, friendlyMsg) {
  try {
    return await fn()
  } catch (e) {
    if (e && e.name === 'AbortError') {
      await new Promise(res => setTimeout(res, 3000))
      try {
        return await fn()
      } catch (e2) {
        if (e2 && e2.name === 'AbortError') throw new Error(friendlyMsg)
        throw e2
      }
    }
    throw e
  }
}

// 语法解释：调用后端 /api/grammar（服务端持有密钥）
export async function explainSentence(text) {
  return retryOnAbort(async () => {
    const r = await apiFetch('/api/grammar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sentence: text }),
      timeout: AI_TIMEOUT,
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
  }, '语法解析超时（后端启动或生成较慢），请稍候再试')
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
  return retryOnAbort(async () => {
    const r = await apiFetch('/api/sentence-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sentence }),
      timeout: AI_TIMEOUT,
    })
    if (!r.ok) throw new Error('句子解析失败（HTTP ' + r.status + '）')
    const j = await r.json()
    if (!j.ok) throw new Error(j.error || '句子解析失败')
    return j.result
  }, '句子解析超时（后端启动或生成较慢），请稍候再试')
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
