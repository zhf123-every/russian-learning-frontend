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
// 劲舞团级游戏化音效系统（Web Audio API 合成）
// ============================================
let synthCtx = null
let masterGain = null
let reverbNode = null

function getCtx() {
  if (!synthCtx) {
    try {
      synthCtx = new (window.AudioContext || window.webkitAudioContext)()
      // 主音量
      masterGain = synthCtx.createGain()
      masterGain.gain.value = 0.6
      masterGain.connect(synthCtx.destination)
      // 简易混响（用延迟模拟）
      reverbNode = synthCtx.createGain()
      reverbNode.gain.value = 0.25
      const delay = synthCtx.createDelay(0.3)
      delay.delayTime.value = 0.08
      const feedback = synthCtx.createGain()
      feedback.gain.value = 0.3
      reverbNode.connect(delay)
      delay.connect(feedback)
      feedback.connect(delay)
      delay.connect(masterGain)
    } catch (e) {
      return null
    }
  }
  if (synthCtx.state === 'suspended') {
    synthCtx.resume().catch(() => {})
  }
  return synthCtx
}

// 播放单个音符（带混响）
function playNote(freq, startTime, duration, type = 'sine', volume = 0.3) {
  const ctx = getCtx()
  if (!ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  const t = startTime
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(volume, t + 0.005)
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration)
  osc.connect(gain)
  gain.connect(masterGain)
  gain.connect(reverbNode)
  osc.start(t)
  osc.stop(t + duration + 0.05)
}

// 播放低音鼓点
function playKick(startTime, volume = 0.4) {
  const ctx = getCtx()
  if (!ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(150, startTime)
  osc.frequency.exponentialRampToValueAtTime(40, startTime + 0.1)
  gain.gain.setValueAtTime(volume, startTime)
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.15)
  osc.connect(gain)
  gain.connect(masterGain)
  osc.start(startTime)
  osc.stop(startTime + 0.2)
}

// 音符频率（C大调）
const NOTES = {
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00, B5: 987.77,
  C6: 1046.50,
}

/**
 * 普通连击音效（劲舞团风格：清脆"叮"声+共鸣）
 * @param {number} combo - 当前连击数
 */
export function playComboSound(combo = 1) {
  const ctx = getCtx()
  if (!ctx) return
  const now = ctx.currentTime

  // 音高随连击升高（半音阶），最高到 C6
  const semitone = Math.min(combo - 1, 24)
  const baseFreq = 440 * Math.pow(2, semitone / 12)

  // 主音：正弦波，清脆
  playNote(baseFreq, now, 0.15, 'sine', 0.35)
  // 泛音：高八度，增加亮度
  playNote(baseFreq * 2, now, 0.1, 'sine', 0.15)

  // 连击≥3 加五度和声
  if (combo >= 3) {
    playNote(baseFreq * 1.5, now, 0.12, 'triangle', 0.15)
  }

  // 连击≥5 加八度和声
  if (combo >= 5) {
    playNote(baseFreq * 2, now + 0.02, 0.15, 'sine', 0.2)
  }
}

/**
 * 连击里程碑音效（5/10/20/50连击）
 * @param {number} milestone - 里程碑数值
 */
export function playComboMilestone(milestone) {
  const ctx = getCtx()
  if (!ctx) return
  const now = ctx.currentTime

  if (milestone === 5) {
    // 5连击：上升三音 do-mi-sol
    playNote(NOTES.C5, now, 0.12, 'sine', 0.3)
    playNote(NOTES.E5, now + 0.06, 0.12, 'sine', 0.3)
    playNote(NOTES.G5, now + 0.12, 0.2, 'sine', 0.35)
    playKick(now, 0.3)
  } else if (milestone === 10) {
    // 10连击：华丽五音上升+和弦
    playNote(NOTES.C5, now, 0.1, 'sine', 0.3)
    playNote(NOTES.D5, now + 0.05, 0.1, 'sine', 0.3)
    playNote(NOTES.E5, now + 0.1, 0.1, 'sine', 0.3)
    playNote(NOTES.G5, now + 0.15, 0.1, 'sine', 0.3)
    playNote(NOTES.C6, now + 0.2, 0.3, 'sine', 0.4)
    // 和弦
    playNote(NOTES.C5, now + 0.2, 0.3, 'triangle', 0.2)
    playNote(NOTES.E5, now + 0.2, 0.3, 'triangle', 0.2)
    playNote(NOTES.G5, now + 0.2, 0.3, 'triangle', 0.2)
    playKick(now, 0.4)
    playKick(now + 0.15, 0.3)
  } else if (milestone === 20) {
    // 20连击：史诗级，多声部+鼓点
    const scale = [NOTES.C5, NOTES.D5, NOTES.E5, NOTES.F5, NOTES.G5, NOTES.A5, NOTES.B5, NOTES.C6]
    scale.forEach((freq, i) => {
      playNote(freq, now + i * 0.04, 0.15, 'sine', 0.25)
    })
    // 最终和弦
    playNote(NOTES.C5, now + 0.35, 0.4, 'sine', 0.3)
    playNote(NOTES.E5, now + 0.35, 0.4, 'sine', 0.3)
    playNote(NOTES.G5, now + 0.35, 0.4, 'sine', 0.3)
    playNote(NOTES.C6, now + 0.35, 0.4, 'sine', 0.35)
    // 鼓点
    playKick(now, 0.4)
    playKick(now + 0.15, 0.35)
    playKick(now + 0.3, 0.45)
  } else {
    // 50+连击：终极
    playNote(NOTES.C6, now, 0.3, 'sine', 0.4)
    playNote(NOTES.G5, now + 0.05, 0.3, 'sine', 0.35)
    playNote(NOTES.E5, now + 0.1, 0.3, 'sine', 0.3)
    playNote(NOTES.C5, now + 0.15, 0.5, 'sine', 0.35)
    playKick(now, 0.5)
    playKick(now + 0.2, 0.4)
    playKick(now + 0.4, 0.5)
  }
}

/**
 * Perfect 判定音效（高音+大三和弦）
 */
export function playPerfectSound() {
  const ctx = getCtx()
  if (!ctx) return
  const now = ctx.currentTime
  playNote(NOTES.C6, now, 0.2, 'sine', 0.35)
  playNote(NOTES.E5, now, 0.25, 'sine', 0.25)
  playNote(NOTES.G5, now, 0.25, 'sine', 0.25)
  playNote(NOTES.C5, now, 0.3, 'triangle', 0.2)
  playKick(now, 0.3)
}

/**
 * Great 判定音效（中音+小三和弦）
 */
export function playGreatSound() {
  const ctx = getCtx()
  if (!ctx) return
  const now = ctx.currentTime
  playNote(NOTES.A5, now, 0.18, 'sine', 0.3)
  playNote(NOTES.C5, now, 0.22, 'sine', 0.22)
  playNote(NOTES.E5, now, 0.22, 'sine', 0.22)
  playKick(now, 0.25)
}

/**
 * Good 判定音效（基础音）
 */
export function playGoodSound() {
  const ctx = getCtx()
  if (!ctx) return
  const now = ctx.currentTime
  playNote(NOTES.G4, now, 0.15, 'sine', 0.25)
  playNote(NOTES.C5, now, 0.18, 'sine', 0.2)
}

/**
 * 答错 MISS 音效（低沉断开+下降音高）
 */
export function playMissSound() {
  const ctx = getCtx()
  if (!ctx) return
  const now = ctx.currentTime
  // 主音：锯齿波，音高下降
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(220, now)
  osc.frequency.exponentialRampToValueAtTime(80, now + 0.2)
  gain.gain.setValueAtTime(0.25, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
  osc.connect(gain)
  gain.connect(masterGain)
  osc.start(now)
  osc.stop(now + 0.3)
  // 低频"嗡"声
  playNote(110, now, 0.25, 'sine', 0.2)
}

/**
 * 整句通关音效（华丽琶音+最终和弦）
 */
export function playSuccessChord() {
  const ctx = getCtx()
  if (!ctx) return
  const now = ctx.currentTime
  // C大调琶音（8音符）
  const arpeggio = [NOTES.C4, NOTES.E4, NOTES.G4, NOTES.C5, NOTES.E5, NOTES.G5, NOTES.B5, NOTES.C6]
  arpeggio.forEach((freq, i) => {
    playNote(freq, now + i * 0.05, 0.2, 'sine', 0.25)
  })
  // 最终大七和弦
  const chordTime = now + 0.45
  playNote(NOTES.C4, chordTime, 0.5, 'sine', 0.2)
  playNote(NOTES.E4, chordTime, 0.5, 'sine', 0.2)
  playNote(NOTES.G4, chordTime, 0.5, 'sine', 0.2)
  playNote(NOTES.B4, chordTime, 0.5, 'sine', 0.2)
  playNote(NOTES.C5, chordTime, 0.5, 'sine', 0.3)
  // 鼓点
  playKick(now, 0.35)
  playKick(now + 0.2, 0.3)
  playKick(now + 0.4, 0.4)
  playKick(chordTime, 0.45)
}

/**
 * 四级激励音效（Good/Great/Perfect/Amazing）
 * @param {string} feedbackType - 'good' | 'great' | 'perfect' | 'amazing'
 * @param {number} combo - 当前连击数
 */
export function playFeedbackSound(feedbackType, combo = 1) {
  // 先播放普通连击音
  playComboSound(combo)

  // 里程碑特殊音效
  if (combo === 5 || combo === 10 || combo === 20 || combo === 50) {
    setTimeout(() => playComboMilestone(combo), 80)
    return
  }

  // 按等级播放判定音
  setTimeout(() => {
    switch (feedbackType) {
      case 'amazing':
        playPerfectSound()
        break
      case 'perfect':
        playPerfectSound()
        break
      case 'great':
        playGreatSound()
        break
      case 'good':
      default:
        playGoodSound()
        break
    }
  }, 60)
}
