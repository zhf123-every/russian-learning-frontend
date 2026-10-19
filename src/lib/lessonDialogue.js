// 每课 AI 语音对话引导生成：Preloader 预加载阶段调用，按本课内容生成对话引导包，
// 答题页复用（含预载的引导语 TTS），避免答题结束后再等 AI 生成。
import { callAI, parseAIJSON } from './ai'
import { apiFetch, API_BASE } from './api'

const DIALOGUE_TIMEOUT = 90000 // AI 生成对话引导包（后端冷启动+大模型），放宽超时

/** 从课时数据提炼本课上下文文本（供 AI 理解话题） */
export function lessonContextText(sentences, lesson) {
  const ru = (Array.isArray(sentences) ? sentences : []).filter(Boolean).slice(0, 12).join('\n')
  const title = (lesson && (lesson.title || lesson.name)) || ''
  const zh = (lesson && Array.isArray(lesson.sentences)
    ? lesson.sentences.filter(x => x && x.ru && (x.zh || x.chinese)).slice(0, 8).map(x => (x.zh || x.chinese) + ' — ' + x.ru).join('\n')
    : '')
  return { title, ru, zh }
}

/**
 * 生成对话引导包（AI）：
 * 返回 { topic, greeting_ru, greeting_zh, questions: [俄语问句...], questions_zh: [中文问句...] }
 * 失败返回 null（调用方静默降级：答题页直接进自由对话）
 */
export async function buildLessonDialogue(sentences, lesson) {
  const { title, ru, zh } = lessonContextText(sentences, lesson)
  const prompt =
    '你是一位俄语口语对话教练。下面是一课俄语学习内容。请为这一课设计一个"课后口语对话引导"，供学生答完题后和你进行口语对话练习。\n' +
    '课程/课时名：' + (title || '（未命名）') + '\n' +
    '本课俄语句子示例：\n' + (ru || '（无）') + '\n' +
    (zh ? '中俄对照：\n' + zh + '\n' : '') +
    '要求：\n' +
    '1. 主题紧扣本课内容（从例句中提炼），难度贴合例句水平；\n' +
    '2. 开场引导语 greeting_ru 用简单俄语（符合本课水平，长度 1-2 句），greeting_zh 为对应中文；\n' +
    '3. questions 给出 3 个本课主题相关的俄语问句（由易到难），questions_zh 逐句对应中文；\n' +
    '4. 只输出 JSON，不要多余文字：{"topic":"主题名(中文)","greeting_ru":"...","greeting_zh":"...","questions":["...","...","..."],"questions_zh":["...","...","..."]}'
  try {
    const content = await callAI([
      { role: 'system', content: '你是俄语口语教练，只输出要求的 JSON，不要任何解释。' },
      { role: 'user', content: prompt },
    ])
    const d = parseAIJSON(content)
    if (!d || !d.greeting_ru || !Array.isArray(d.questions)) return null
    return {
      topic: String(d.topic || '').slice(0, 40),
      greeting_ru: String(d.greeting_ru || '').trim(),
      greeting_zh: String(d.greeting_zh || '').trim(),
      questions: d.questions.map(q => String(q || '').trim()).filter(Boolean).slice(0, 3),
      questions_zh: (Array.isArray(d.questions_zh) ? d.questions_zh : []).map(q => String(q || '').trim()).filter(Boolean).slice(0, 3),
    }
  } catch (e) {
    console.warn('[lessonDialogue] 对话引导生成失败:', e && e.message || e)
    return null
  }
}

/** 生成引导语 TTS 音频 URL（复用后端 /api/tts，与答题页同音色），失败返回空串 */
async function dialogueTtsUrl(text, voice) {
  if (!text) return ''
  try {
    const r = await apiFetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice, id: 'dialogue', type: 'statement' }),
      timeout: 12000,
    })
    const j = await r.json()
    if (!j.ok || !j.audio_url) return ''
    return String(j.audio_url).startsWith('http') ? j.audio_url : (API_BASE || '') + j.audio_url
  } catch (e) {
    return ''
  }
}

/**
 * 完整预载对话引导：生成引导包 + 为 greeting_ru/questions 预载 TTS 音频 URL。
 * 供 Preloader 调用（fire-and-forget，不阻塞进入答题页）。
 * 返回 Promise<dialogue | null>
 */
export async function preloadLessonDialogue(sentences, lesson, voice) {
  const dialogue = await buildLessonDialogue(sentences, lesson)
  if (!dialogue) return null
  const texts = [dialogue.greeting_ru, ...dialogue.questions].filter(Boolean)
  // 尽力而为：预载引导语音频（并发，失败不阻塞），并把 URL 写入共享缓存 → 答题页秒播
  await Promise.all(texts.map(async (t) => {
    try {
      const url = await dialogueTtsUrl(t, voice || 'alena')
      if (url) {
        try {
          const { cacheTtsUrl } = await import('../utils/ttsPreloadShared')
          cacheTtsUrl(t, url, voice || 'alena')
        } catch (e) { /* 缓存非必须 */ }
        const a = new Audio()
        a.preload = 'auto'
        a.src = url
        a.load()
      }
    } catch (e) { /* 忽略：答题页会兜底再请求 */ }
  }))
  return dialogue
}
