// questSounds.js —— 对标句乐部（Earthworm）音效系统
// 音效资源：/sounds/{correct,error,combo,victory,typing}.mp3（correct/error/combo/victory 与句乐部同款）
// 播放器：Web Audio API（AudioContext + decodeAudioData + BufferSource + Gain → feedbackBus）
// 触发：答对→correct、答错→error、连击≥2→combo、整句通关→victory、打字→typing（60ms 节流）
//
// 声音设置联动（与设置弹窗「声音」页同一份 localStorage: rlearn_quest_sfx）：
//  - SFX_CFG.keyOn/keyType/keyVol → 打字音效开关/风格/音量（sfxKey() 统一入口）
//  - SFX_CFG.answerOn/answerVol   → 答题反馈音效开关/音量（playRight/playError 等自动应用）
// 页面在收到 quest-ui-changed / storage 事件后调用 loadSfxConfig() 即可实时生效。
const SOUNDS = {
  correct: "/sounds/correct.mp3",
  error: "/sounds/error.mp3",
  combo: "/sounds/combo.mp3",
  victory: "/sounds/victory.mp3",
  typing: "/sounds/typing.mp3",
};

/* ================= 共享音效配置（与 SettingsModal 声音页 / useQuestSettings 同 key） ================= */
export const SFX_DEFAULT = {
  enabled: true,   // 全局音效总开关
  vol: 0.7,        // 全局音量 0~1（答题页内联面板）
  keyOn: true,     // 打字音效开关
  keyType: 'soft', // 按键音风格：soft 轻柔 / drum 鼓点 / bubble 气泡 / typewriter 打字机 / sword 金属剑 / cherryBlue 青轴 / cherryRed 红轴
  keyVol: 1,       // 打字音效音量 0~1（设置弹窗「打字音效音量」滑块）
  answerOn: true,  // 答题反馈音效开关
  answerVol: 1,    // 反馈音效音量 0~1（设置弹窗「反馈音效音量」滑块）
  combo: true, comboAnim: true, comboFx: true, sceneOn: true,
}
let SFX_CFG = { ...SFX_DEFAULT }
export const getSfxConfig = () => ({ ...SFX_CFG })
export const loadSfxConfig = () => {
  try {
    const s = JSON.parse(localStorage.getItem('rlearn_quest_sfx') || 'null')
    if (s && typeof s === 'object') SFX_CFG = { ...SFX_DEFAULT, ...s }
  } catch (e) { /* 忽略 */ }
  return SFX_CFG
}
export const setSfxConfig = (patch) => {
  SFX_CFG = { ...SFX_CFG, ...(patch || {}) }
  try { localStorage.setItem('rlearn_quest_sfx', JSON.stringify(SFX_CFG)) } catch (e) { /* 忽略 */ }
  return SFX_CFG
}
loadSfxConfig() // 模块加载即同步最新设置

// 设置弹窗/答题页保存 rlearn_quest_sfx 后实时刷新（打字音效类型/音量、反馈音量等即时生效）
// 否则各页 sfxKey()/playRightSound 等会一直用模块加载时的旧配置
if (typeof window !== 'undefined') {
  const __refreshSfx = () => { loadSfxConfig() }
  window.addEventListener('quest-ui-changed', __refreshSfx)
  window.addEventListener('storage', __refreshSfx)
}

let ctx = null;        // 全局 AudioContext
let bus = null;        // 音效总线（feedbackBus，与语音播放隔离）
let buffers = {};      // name -> AudioBuffer
let preloading = false;

function getCtx() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      bus = ctx.createGain();
      bus.gain.value = 0.9;
      bus.connect(ctx.destination);
    } catch (e) { return null; }
  }
  if (ctx.state === "suspended") { ctx.resume().catch(() => {}); }
  return ctx;
}

function loadOne(name) {
  const url = SOUNDS[name];
  if (!url || buffers[name] || !ctx) return;
  fetch(url)
    .then((r) => r.arrayBuffer())
    .then((buf) => ctx.decodeAudioData(buf))
    .then((d) => { buffers[name] = d; })
    .catch(() => { /* 资源未就绪，静默等待下次 */ });
}

// 预加载全部音效（进答题页调用；句乐部式：首播无网络等待）
export function ensureQuestSounds() {
  const c = getCtx();
  if (!c || preloading) return;
  preloading = true;
  Object.keys(SOUNDS).forEach(loadOne);
}

// 兼容旧 API：打字音预加载（含全部音效预载）
export function ensureTypingSound() { ensureQuestSounds(); }

// 播放一个音效（BufferSource + Gain → feedbackBus）
function play(name, volume = 0.6) {
  const c = getCtx();
  if (!c || !buffers[name]) return;
  try {
    const src = c.createBufferSource();
    src.buffer = buffers[name];
    const g = c.createGain();
    g.gain.value = volume;
    src.connect(g);
    g.connect(bus);
    src.start();
    src.onended = () => { src.disconnect(); g.disconnect(); };
  } catch (e) { /* 忽略 */ }
}

// ---- 公开 API（保持旧签名兼容；音量自动应用声音设置：反馈音量 answerVol / 打字音量 keyVol）----
export function playRightSound() { play("correct", 0.7 * (SFX_CFG.answerVol ?? 1)); }            // 答对 → correct.mp3（句乐部同款）
export function playErrorSound() { play("error", 0.65 * (SFX_CFG.answerVol ?? 1)); }             // 答错 → error.mp3（句乐部同款）
export function playMissSound() { play("error", 0.65 * (SFX_CFG.answerVol ?? 1)); }              // 答错 MISS → error.mp3
export function playComboSound(combo = 1) { if (combo >= 2) play("combo", 0.7 * (SFX_CFG.answerVol ?? 1)); }  // 连击≥2 → combo.mp3（句乐部同款）
export function playVictorySound() { play("victory", 0.8 * (SFX_CFG.answerVol ?? 1)); }          // 通关 → victory.mp3（句乐部同款）
export function playSuccessChord() { play("victory", 0.8 * (SFX_CFG.answerVol ?? 1)); }          // 整句通关 → victory.mp3

// ---- 打字音效（保留原 Web Audio 实现 + 60ms 节流；音量跟随「打字音效音量」keyVol）----
const PLAY_INTERVAL_TIME = 60;
let lastPlayTime = 0;
export function playTypingSound() {
  const now = Date.now();
  if (now - lastPlayTime < PLAY_INTERVAL_TIME) return;
  if (!ctx || !buffers.typing) return;
  try {
    const src = ctx.createBufferSource();
    src.buffer = buffers.typing;
    const g = ctx.createGain();
    g.gain.value = 0.9 * (SFX_CFG.keyVol ?? 1); // 基增益 0.9：typing.mp3 录音偏轻，100% 音量需明显可闻
    src.connect(g);
    g.connect(bus);
    src.start();
    lastPlayTime = now;
    src.onended = () => { src.disconnect(); g.disconnect(); };
  } catch (e) { /* 忽略 */ }
}

/* ---- 打字音效风格合成（音效类型 keyType；soft=官方 typing.mp3，其余 6 种为合成音） ---- */
function synthTone(freq, dur, type = "sine", gain = 0.1, when = 0, slideTo, vol = 1) {
  const c = getCtx(); if (!c) return
  try {
    const t = c.currentTime + when
    const o = c.createOscillator(); const g = c.createGain()
    o.type = type; o.frequency.setValueAtTime(freq, t)
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur)
    g.gain.setValueAtTime(gain * vol, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    o.connect(g); g.connect(bus)
    o.start(t); o.stop(t + dur + 0.03)
  } catch (e) { /* 忽略 */ }
}
function synthNoise(dur, gain = 0.08, when = 0, vol = 1) {
  const c = getCtx(); if (!c) return
  try {
    const t = c.currentTime + when
    const len = Math.max(1, Math.floor(c.sampleRate * dur))
    const buf = c.createBuffer(1, len, c.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len)
    const src = c.createBufferSource(); src.buffer = buf
    const g = c.createGain()
    g.gain.setValueAtTime(gain * vol, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    src.connect(g); g.connect(bus)
    src.start(t); src.stop(t + dur + 0.02)
  } catch (e) { /* 忽略 */ }
}
const KEY_FX = {
  drum: (v) => { synthNoise(0.06, 0.07, 0, v); synthTone(120, 0.07, "sine", 0.09, 0, 80, v) },                    // 鼓点
  bubble: (v) => synthTone(420, 0.07, "sine", 0.06, 0, 1300, v),                                                  // 气泡
  typewriter: (v) => { synthTone(950, 0.02, "square", 0.035, 0, null, v); synthNoise(0.015, 0.025, 0, v) },       // 打字机
  sword: (v) => synthTone(2300, 0.07, "sawtooth", 0.045, 0, 900, v),                                               // 金属剑
  cherryBlue: (v) => { synthTone(1650, 0.018, "square", 0.05, 0, null, v); synthTone(720, 0.03, "triangle", 0.04, 0.03, null, v) }, // 青轴
  cherryRed: (v) => { synthTone(1050, 0.015, "square", 0.04, 0, null, v); synthNoise(0.012, 0.018, 0, v) },       // 红轴
}

/**
 * 统一打字音效入口：读取声音设置「打字音效/音效类型/打字音效音量」，
 * soft → 官方 typing.mp3（音量 keyVol），其余 6 种 → 合成音（音量 keyVol）。
 * 所有答题页统一调用本函数，保证设置弹窗的音效设置真实生效。
 */
export function sfxKey() {
  if (!SFX_CFG.enabled || !SFX_CFG.keyOn) return
  const t = SFX_CFG.keyType || 'soft'
  if (t === 'soft') { ensureTypingSound(); playTypingSound(); return }
  const kv = SFX_CFG.keyVol ?? 1
  ;(KEY_FX[t] || KEY_FX.bubble)(kv)
}

// 可打印键才触发（正则扩俄语西里尔字符）
export function checkPlayTypingSound(e) {
  if (e.altKey || e.ctrlKey || e.metaKey) return false;
  if (/^[a-zA-Zа-яА-ЯёЁ0-9]$/.test(e.key) || ["Backspace", " ", "'"].includes(e.key)) return true;
  return false;
}

// ============================================
// 保留：连击里程碑/四级判定合成音（叠加庆祝，不替代 mp3 主音效）
// ============================================
let masterGain = null;
let reverbNode = null;

function getSynthCtx() {
  const c = getCtx();
  if (!c) return null;
  if (!masterGain) {
    masterGain = c.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(bus || c.destination);
    reverbNode = c.createGain();
    reverbNode.gain.value = 0.2;
    const delay = c.createDelay(0.3);
    delay.delayTime.value = 0.08;
    const feedback = c.createGain();
    feedback.gain.value = 0.3;
    reverbNode.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(masterGain);
  }
  return c;
}

function playNote(freq, startTime, duration, type = "sine", volume = 0.3) {
  const c = getSynthCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t = startTime;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volume, t + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  osc.connect(gain);
  gain.connect(masterGain);
  gain.connect(reverbNode);
  osc.start(t);
  osc.stop(t + duration + 0.05);
}

function playKick(startTime, volume = 0.4) {
  const c = getSynthCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(150, startTime);
  osc.frequency.exponentialRampToValueAtTime(40, startTime + 0.1);
  gain.gain.setValueAtTime(volume, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.15);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(startTime);
  osc.stop(startTime + 0.2);
}

const NOTES = {
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00, B5: 987.77,
  C6: 1046.50,
};

export function playComboMilestone(milestone) {
  const c = getSynthCtx();
  if (!c) return;
  const now = c.currentTime;
  if (milestone === 5) {
    playNote(NOTES.C5, now, 0.12, "sine", 0.3);
    playNote(NOTES.E5, now + 0.06, 0.12, "sine", 0.3);
    playNote(NOTES.G5, now + 0.12, 0.2, "sine", 0.35);
    playKick(now, 0.3);
  } else if (milestone === 10) {
    playNote(NOTES.C5, now, 0.1, "sine", 0.3);
    playNote(NOTES.D5, now + 0.05, 0.1, "sine", 0.3);
    playNote(NOTES.E5, now + 0.1, 0.1, "sine", 0.3);
    playNote(NOTES.G5, now + 0.15, 0.1, "sine", 0.3);
    playNote(NOTES.C6, now + 0.2, 0.3, "sine", 0.4);
    playNote(NOTES.C5, now + 0.2, 0.3, "triangle", 0.2);
    playNote(NOTES.E5, now + 0.2, 0.3, "triangle", 0.2);
    playNote(NOTES.G5, now + 0.2, 0.3, "triangle", 0.2);
    playKick(now, 0.4);
    playKick(now + 0.15, 0.3);
  } else if (milestone === 20) {
    const scale = [NOTES.C5, NOTES.D5, NOTES.E5, NOTES.F5, NOTES.G5, NOTES.A5, NOTES.B5, NOTES.C6];
    scale.forEach((freq, i) => { playNote(freq, now + i * 0.04, 0.15, "sine", 0.25); });
    playNote(NOTES.C5, now + 0.35, 0.4, "sine", 0.3);
    playNote(NOTES.E5, now + 0.35, 0.4, "sine", 0.3);
    playNote(NOTES.G5, now + 0.35, 0.4, "sine", 0.3);
    playNote(NOTES.C6, now + 0.35, 0.4, "sine", 0.35);
    playKick(now, 0.4);
    playKick(now + 0.15, 0.35);
    playKick(now + 0.3, 0.45);
  } else {
    playNote(NOTES.C6, now, 0.3, "sine", 0.4);
    playNote(NOTES.G5, now + 0.05, 0.3, "sine", 0.35);
    playNote(NOTES.E5, now + 0.1, 0.3, "sine", 0.3);
    playNote(NOTES.C5, now + 0.15, 0.5, "sine", 0.35);
    playKick(now, 0.5);
    playKick(now + 0.2, 0.4);
    playKick(now + 0.4, 0.5);
  }
}

export function playPerfectSound() {
  const c = getSynthCtx();
  if (!c) return;
  const now = c.currentTime;
  playNote(NOTES.C6, now, 0.2, "sine", 0.35);
  playNote(NOTES.E5, now, 0.25, "sine", 0.25);
  playNote(NOTES.G5, now, 0.25, "sine", 0.25);
  playNote(NOTES.C5, now, 0.3, "triangle", 0.2);
  playKick(now, 0.3);
}

export function playGreatSound() {
  const c = getSynthCtx();
  if (!c) return;
  const now = c.currentTime;
  playNote(NOTES.A5, now, 0.18, "sine", 0.3);
  playNote(NOTES.C5, now, 0.22, "sine", 0.22);
  playNote(NOTES.E5, now, 0.22, "sine", 0.22);
  playKick(now, 0.25);
}

export function playGoodSound() {
  const c = getSynthCtx();
  if (!c) return;
  const now = c.currentTime;
  playNote(NOTES.G4, now, 0.15, "sine", 0.25);
  playNote(NOTES.C5, now, 0.18, "sine", 0.2);
}

// 四级激励音效（combo.mp3 主音 + 里程碑合成庆祝）
export function playFeedbackSound(feedbackType, combo = 1) {
  playComboSound(combo);
  if (combo === 5 || combo === 10 || combo === 20 || combo === 50) {
    setTimeout(() => playComboMilestone(combo), 80);
    return;
  }
  setTimeout(() => {
    switch (feedbackType) {
      case "amazing":
      case "perfect":
        playPerfectSound();
        break;
      case "great":
        playGreatSound();
        break;
      case "good":
      default:
        playGoodSound();
        break;
    }
  }, 60);
}
