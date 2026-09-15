// 官方 Earthworm（句乐部）音效系统 React 移植 —— 1:1 复刻 useTypingSound.ts + usePlayTipSound.ts
// 打字音：Web Audio API decodeAudioData + 60ms 节流；答对/答错：普通 Audio
// 资源：public/sounds/{typing,right,error}.mp3（从 earthworm apps/client/assets/sounds 复制，error-feeble 备用）
const RIGHT = '/sounds/right.mp3'
const ERROR = '/sounds/error.mp3'
const TYPING = '/sounds/typing.mp3'

const rightAudio = typeof Audio !== 'undefined' ? new Audio(RIGHT) : null
const errorAudio = typeof Audio !== 'undefined' ? new Audio(ERROR) : null

// 正确提示音（官方 usePlayTipSound）
export function playRightSound() {
  try { rightAudio && rightAudio.play().catch(() => { /* 忽略 */ }) } catch (e) { /* 忽略 */ }
}

// 错误提示音（官方 usePlayTipSound）
export function playErrorSound() {
  try { errorAudio && errorAudio.play().catch(() => { /* 忽略 */ }) } catch (e) { /* 忽略 */ }
}

const PLAY_INTERVAL_TIME = 60 // 官方：两次打字音最小间隔 60ms
let audioCtxRef = null
let audioBuffer = null
let lastPlayTime = 0

// 提前加载 AudioContext（官方：不需要等页面渲染就可以加载）
export function ensureTypingSound() {
  if (audioCtxRef) return
  try {
    audioCtxRef = new (window.AudioContext || window.webkitAudioContext)()
    fetch(TYPING)
      .then(r => r.arrayBuffer())
      .then(buf => audioCtxRef.decodeAudioData(buf))
      .then(d => { audioBuffer = d })
      .catch(() => { /* 资源未就绪，静默等待下次 */ })
  } catch (e) { /* 忽略 */ }
}

export function playTypingSound() {
  const now = Date.now()
  if (now - lastPlayTime < PLAY_INTERVAL_TIME) return // 官方节流
  if (!audioCtxRef || !audioBuffer) return
  try {
    const source = audioCtxRef.createBufferSource()
    source.buffer = audioBuffer
    source.connect(audioCtxRef.destination)
    source.start()
    lastPlayTime = now
    source.onended = () => { source.disconnect() } // 播放结束释放资源（官方）
  } catch (e) { /* 忽略 */ }
}

// 官方 checkPlayTypingSound：可打印键才触发（正则扩俄语西里尔字符）
export function checkPlayTypingSound(e) {
  if (e.altKey || e.ctrlKey || e.metaKey) return false
  if (/^[a-zA-Zа-яА-ЯёЁ0-9]$/.test(e.key) || ['Backspace', ' ', "'"].includes(e.key)) return true
  return false
}
