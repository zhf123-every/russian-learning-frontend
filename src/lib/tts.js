export function getRuVoice() {
  if (!('speechSynthesis' in window)) return null
  const voices = window.speechSynthesis.getVoices()
  return voices.find(v => /ru/i.test(v.lang)) || null
}

export function speak(text, { rate = 1, voice = null, onStart, onEnd } = {}) {
  if (!('speechSynthesis' in window)) return
  const u = new SpeechSynthesisUtterance(text)
  if (voice) u.voice = voice
  u.lang = voice?.lang || 'ru-RU'
  u.rate = rate
  if (onStart) u.onstart = onStart
  if (onEnd) u.onend = onEnd
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(u)
}

export function cancelSpeech() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
}

export function speakAll(sentences, { from = 0, rate = 1, voice = null, onIndex, onDone } = {}) {
  let i = from
  const next = () => {
    if (i >= sentences.length) { onDone?.(); return }
    onIndex?.(i)
    speak(sentences[i].russian, {
      rate, voice,
      onEnd: () => { i++; next() },
    })
  }
  next()
}

/**
 * 系统发音播放器（发音源=系统发音人时使用）：按次数循环朗读，支持音量/倍速/间隔。
 * 与后端 TTS 的 playGlobalAudio 语义对齐：times 次数、gap 间隔、onDone 全部播完回调。
 */
export function speakText(text, { rate = 1, volume = 1, times = 1, gap = 600, onDone } = {}) {
  if (!text) { onDone?.(); return }
  if (!('speechSynthesis' in window)) { onDone?.(); return }
  try { window.speechSynthesis.cancel() } catch (e) { /* 忽略 */ }
  const ru = getRuVoice()
  let i = 0
  const next = () => {
    if (i >= (times || 1)) { onDone?.(); return }
    i += 1
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'ru-RU'
    u.rate = rate || 1
    u.volume = volume == null ? 1 : volume
    if (ru) u.voice = ru
    u.onend = () => setTimeout(next, gap || 600)
    u.onerror = () => setTimeout(next, gap || 600)
    try { window.speechSynthesis.speak(u) } catch (e) { setTimeout(next, gap || 600) }
  }
  next()
}

export function loopSentence(sentences, i, times = 3, { rate = 1, voice = null, onIndex, onDone } = {}) {
  let n = 0
  const next = () => {
    if (n >= times) { onDone?.(); return }
    n++
    onIndex?.(i)
    speak(sentences[i].russian, { rate, voice, onEnd: next })
  }
  next()
}
