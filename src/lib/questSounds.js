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

// ============================================
// Web Audio API 合成音效系统（连击/答错/通关）
// ============================================
let synthAudioCtx = null

function getSynthCtx() {
  if (!synthAudioCtx) {
    try {
      synthAudioCtx = new (window.AudioContext || window.webkitAudioContext)()
    } catch (e) {
      return null
    }
  }
  // 恢复被浏览器挂起的 AudioContext
  if (synthAudioCtx.state === 'suspended') {
    synthAudioCtx.resume().catch(() => {})
  }
  return synthAudioCtx
}

/**
 * 连击音效：单词答对触发，音高随连击数升高
 * @param {number} combo - 当前连击数（从1开始）
 */
export function playComboSound(combo = 1) {
  const ctx = getSynthCtx()
  if (!ctx) return

  try {
    const osc = ctx.createOscillator()
    const gainNode = ctx.createGain()
    // 基础频率 420Hz，每连击升高 55Hz
    const baseFreq = 420 + Math.min(combo - 1, 20) * 55
    osc.type = "square"
    osc.frequency.value = baseFreq

    // 音量包络，防止爆音
    const now = ctx.currentTime
    gainNode.gain.setValueAtTime(0, now)
    gainNode.gain.linearRampToValueAtTime(0.18, now + 0.01)
    gainNode.gain.linearRampToValueAtTime(0, now + 0.09)

    osc.connect(gainNode)
    gainNode.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.09)

    // 连击≥5叠加和声
    if (combo >= 5) {
      playChord(baseFreq)
    }
  } catch (e) { /* 忽略 */ }
}

/**
 * 高连击附加和声（五度音）
 * @param {number} baseFreq - 基础频率
 */
function playChord(baseFreq) {
  const ctx = getSynthCtx()
  if (!ctx) return

  try {
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = "sine"
    osc2.frequency.value = baseFreq * 1.25

    const now = ctx.currentTime
    gain2.gain.setValueAtTime(0, now)
    gain2.gain.linearRampToValueAtTime(0.1, now + 0.01)
    gain2.gain.linearRampToValueAtTime(0, now + 0.09)

    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(now)
    osc2.stop(now + 0.09)
  } catch (e) { /* 忽略 */ }
}

/**
 * 答错 MISS 音效（低沉三角波）
 */
export function playMissSound() {
  const ctx = getSynthCtx()
  if (!ctx) return

  try {
    const osc = ctx.createOscillator()
    const gainNode = ctx.createGain()
    osc.type = "triangle"
    osc.frequency.value = 160

    const now = ctx.currentTime
    gainNode.gain.setValueAtTime(0, now)
    gainNode.gain.linearRampToValueAtTime(0.15, now + 0.01)
    gainNode.gain.linearRampToValueAtTime(0, now + 0.12)

    osc.connect(gainNode)
    gainNode.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.12)
  } catch (e) { /* 忽略 */ }
}

/**
 * 整句全部答对通关音效（大三和弦琶音）
 */
export function playSuccessChord() {
  const ctx = getSynthCtx()
  if (!ctx) return

  try {
    const freqs = [520, 650, 780] // C5, E5, G5 大三和弦
    freqs.forEach((freq, index) => {
      const osc = ctx.createOscillator()
      const gainNode = ctx.createGain()
      osc.type = "sine"
      osc.frequency.value = freq

      // 依次延迟启动，形成琶音效果
      const delay = index * 0.06
      const now = ctx.currentTime + delay
      gainNode.gain.setValueAtTime(0, now)
      gainNode.gain.linearRampToValueAtTime(0.12, now + 0.02)
      gainNode.gain.linearRampToValueAtTime(0, now + 0.22)

      osc.connect(gainNode)
      gainNode.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.22)
    })
  } catch (e) { /* 忽略 */ }
}

/**
 * 四级激励音效（Good/Great/Perfect/Amazing）
 * 根据反馈类型播放不同音效
 * @param {string} feedbackType - 'good' | 'great' | 'perfect' | 'amazing'
 * @param {number} combo - 当前连击数
 */
export function playFeedbackSound(feedbackType, combo = 1) {
  switch (feedbackType) {
    case 'amazing':
      // Amazing：高音 + 通关和弦
      playComboSound(combo)
      setTimeout(() => playSuccessChord(), 100)
      break
    case 'perfect':
      // Perfect：高音连击
      playComboSound(combo)
      break
    case 'great':
      // Great：中音连击
      playComboSound(combo)
      break
    case 'good':
    default:
      // Good：基础音
      playComboSound(combo)
      break
  }
}
