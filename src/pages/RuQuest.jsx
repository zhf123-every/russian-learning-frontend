import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLevelVideos, LEVELS } from '../data/courseLibrary'
import { callAI } from '../lib/ai'
import { API_BASE } from '../lib/api'
import { toast } from '../lib/toast'
import { loadHotkeys, keysOfEvent } from '../components/SettingsModal'
import SettingsModal from '../components/SettingsModal'
import SummaryModal from '../components/quest/SummaryModal'           // P4 缁撶畻寮圭獥锛堣瘎绾?鐜舰鍥?閿欓+鎾掕姳锛?import GameSettingModal from '../components/quest/GameSettingModal'   // P4 娓告垙鍐呰缃紙鍊嶉€?鎾斁娆℃暟/闂撮殧锛?import GamePauseModal from '../components/quest/GamePauseModal'       // P4 鏆傚仠寮圭獥
import CourseContentsModal from '../components/quest/CourseContentsModal' // P4 鏈鍐呭闈㈡澘锛堢瓫閫?鍙戦煶+璺宠浆锛?import DictationControls from '../components/quest/DictationControls'       // P5 鍚啓妯″紡鎾斁鎺у埗鏍忥紙鐩插惉/鎱㈠惉/鎻愮ず锛?import LearningTimer from '../components/quest/LearningTimer'                 // P5 瀛︿範璁℃椂鍣紙褰撳墠鐢ㄦ椂+浠婃棩绱锛?import DesktopPet, { petSpeak, petSetMood } from '../components/quest/DesktopPet' // P6 妗岄潰瀹犵墿
import WrongBookModal from '../components/quest/WrongBookModal'               // P6 閿欓鏈嫭绔嬪脊绐?import * as questSounds from '../lib/questSounds' // 瀹樻柟鍙ヤ箰閮?mp3 鍘熷０闊虫晥锛堥敭鐩?绛斿/绛旈敊锛?
// ================= 宸ュ叿 =================
const stripStress = s => (s || '').replace(/[\u0300-\u036f]/g, '')
const shuffle = arr => {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
const norm = w => stripStress(w || '').toLowerCase().trim()
const cleanWord = w => (w || '').replace(/[.,!?鈥?:鈥?芦禄()]/g, '')
const fmtTime = s => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60
  return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m + ':' + (ss < 10 ? '0' : '') + ss
}
const fmtScore = n => n.toLocaleString('en-US')

// ================= 璇剧▼搴擄紙淇勮闂叧璇剧▼锛屽熀浜庡垎绾у彞瀛愶級 =================
const COURSE_META = {
  A1: { title: '袩褉懈胁械褌, 袪芯褋褋懈褟! A1', subtitle: '12涓崟鍏?路 鏍稿績鍙ュ瀷 路 娓愯繘鏋勫缓', emoji: '馃嚪馃嚭', tag: '鏂版墜鎺ㄨ崘', desc: 'A1 绾у埆淇勮鍏ラ棬璇剧▼锛?2 涓崟鍏冿紝瑕嗙洊闂€欍€佸湴鐐广€佹嫢鏈夈€佽繍鍔ㄣ€佹暟閲忋€佸枩濂姐€佸繀椤汇€佽繃鍘绘椂銆佸皢鏉ユ椂銆佷粠鍙ョ瓑鏍稿績璇硶銆? },
}
const MODES = [
  { key: 'chinese_to_english', name: '涓瘧淇勬ā寮?, tag: '鍒濈骇', rec: '鏂版墜鎺ㄨ崘', desc: '鐪嬪埌涓枃鎻愮ず锛屽皾璇曠敤淇勮琛ㄨ揪銆傜粌涔犺繍鐢ㄦ墍瀛﹁瘝姹囧拰璇硶銆? },
  { key: 'dictation', name: '鍚啓妯″紡', tag: '鍒濈骇', desc: '鍚縿璇師澹帮紝鎶婂惉鍒扮殑鍙ュ瓙鍐欎笅鏉ャ€傞敾鐐煎惉鍔涗笌鎷煎啓銆? },
  { key: 'speaking', name: '鍙ｈ璇勬祴妯″紡', tag: '鍒濈骇', desc: '鍏堝惉鏍囧噯鍙戦煶锛岃窡璇诲綍闊筹紝AI 瀹炴椂璇勫垎骞剁籂姝ｅ彂闊炽€? },
  { key: 'scramble', name: '涔卞簭妯″紡', tag: '涓骇', desc: '鍙ュ瓙鍗曡瘝椤哄簭鎵撲贡锛岄€氳繃鐐瑰嚮鎴栭敭鐩橀噸缁勫畬鏁村彞瀛愩€? },
  { key: 'reading', name: '闃呰妯″紡', tag: '鍒濈骇', desc: '鍏堝叏鏂囬€氳 + 閫愬彞璺熻棰勪範锛屽啀寮€濮嬫墦瀛楃瓟棰樸€? },
]
const DIFFS = ['鑷畾涔?, '鍒濈骇', '涓骇', '楂樼骇']

// ================= 淇勮榧撳姳璇?=================
const PRAISE = ['袦芯谢芯写械褑!', '袨褌谢懈褔薪芯!', '小褍锌械褉!', '袩褉械泻褉邪褋薪芯!', '袙械谢懈泻芯谢械锌薪芯!', '孝邪泻 写械褉卸邪褌褜!', '袟邪屑械褔邪褌械谢褜薪芯!', '袘褉邪胁芯!']
const pickPraise = () => PRAISE[Math.floor(Math.random() * PRAISE.length)]

const RATINGS = [
  { min: 0.95, label: 'SSS', color: '#FFD75E' },
  { min: 0.88, label: 'SS', color: '#FFB347' },
  { min: 0.8, label: 'S', color: '#FF8A5C' },
  { min: 0.68, label: 'A', color: '#7ED6A5' },
  { min: 0.5, label: 'B', color: '#6FB7FF' },
  { min: 0, label: 'C', color: '#B7A8E8' },
]
const ratingOf = acc => {
  const r = acc.correct / Math.max(1, acc.answered)
  return RATINGS.find(x => r >= x.min) || RATINGS[RATINGS.length - 1]
}

// ================= 闊虫晥绯荤粺锛圵eb Audio 鍚堟垚 路 鍙厤缃級 =================
let audioCtx = null
const SFX_DEFAULT = {
  enabled: true,   // 鍏ㄥ眬闊虫晥鎬诲紑鍏筹紙涓€閿潤闊筹級
  vol: 0.7,        // 鍏ㄥ眬闊抽噺 0~1
  keyOn: true,     // 鎸夐敭闊虫晥寮€鍏?  keyType: 'soft', // 鎸夐敭闊抽鏍硷細soft 杞绘煍 / drum 榧撶偣 / bubble 姘旀场 / typewriter 鎵撳瓧鏈?/ sword 閲戝睘鍓?/ cherryBlue 闈掕酱 / cherryRed 绾㈣酱
  keyVol: 1,       // 鎵撳瓧闊虫晥闊抽噺 0~1锛堝０闊宠缃〉婊戝潡锛岄粯璁?00%锛?  answerOn: true,  // 绛旈鍙嶉闊虫晥寮€鍏?  answerVol: 1,    // 鍙嶉闊虫晥闊抽噺 0~1锛堝０闊宠缃〉婊戝潡锛岄粯璁?00%锛?  comboAnim: true, // 杩炲嚮鍔ㄧ敾寮€鍏筹紙涓庤繛鍑婚煶鏁堣仈鍔級
  comboFx: true,   // 杩炲嚮婵€鍔遍煶鏁堝紑鍏?  sceneOn: true,   // 鍦烘櫙鍔熻兘闊虫晥寮€鍏?}
let SFX_CFG = { ...SFX_DEFAULT }
const loadSfxCfg = () => {
  try {
    const s = JSON.parse(localStorage.getItem('rlearn_quest_sfx') || 'null')
    if (s) SFX_CFG = { ...SFX_DEFAULT, ...s }
  } catch (e) { /* 蹇界暐 */ }
}
const saveSfxCfg = (patch) => {
  SFX_CFG = { ...SFX_CFG, ...patch }
  try { localStorage.setItem('rlearn_quest_sfx', JSON.stringify(SFX_CFG)) } catch (e) { /* 蹇界暐 */ }
}
loadSfxCfg()
function ac() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {})
    return audioCtx
  } catch (e) { return null }
}
// 褰撳墠闊虫晥绫诲埆锛?key' 鎸夐敭 / 'answer' 鍙嶉 / '' 鍏朵粬锛夛紝鐢ㄤ簬鎸夌被鍒簲鐢ㄧ嫭绔嬮煶閲?let sfxKind = ''
function playTone(freq, dur, type = 'sine', gain = 0.1, when = 0, slideTo, kind) {
  const ctx = ac(); if (!ctx) return
  try {
    const k = kind || sfxKind
    const kv = k === 'key' ? (SFX_CFG.keyVol ?? 1) : k === 'answer' ? (SFX_CFG.answerVol ?? 1) : 1
    const t = ctx.currentTime + when
    const o = ctx.createOscillator(); const g = ctx.createGain()
    o.type = type; o.frequency.setValueAtTime(freq, t)
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur)
    g.gain.setValueAtTime(gain * SFX_CFG.vol * kv, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    o.connect(g); g.connect(ctx.destination)
    o.start(t); o.stop(t + dur + 0.03)
  } catch (e) { /* 蹇界暐 */ }
}
function playNoise(dur, gain = 0.08, when = 0, kind) {
  const ctx = ac(); if (!ctx) return
  try {
    const k = kind || sfxKind
    const kv = k === 'key' ? (SFX_CFG.keyVol ?? 1) : k === 'answer' ? (SFX_CFG.answerVol ?? 1) : 1
    const t = ctx.currentTime + when
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur))
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len)
    const src = ctx.createBufferSource(); src.buffer = buf
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain * SFX_CFG.vol * kv, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    src.connect(g); g.connect(ctx.destination)
    src.start(t); src.stop(t + dur + 0.02)
  } catch (e) { /* 蹇界暐 */ }
}
// 鈥斺€?涓€銆佹寜閿煶鏁堢粍锛? 绉嶉鏍硷級 鈥斺€?const KEY_FX = {
  soft: () => playTone(1560, 0.03, 'sine', 0.05, 0, null, 'key'),                                                     // 榛樿杞绘煍鎸夐敭闊?  drum: () => { playNoise(0.06, 0.07, 0, 'key'); playTone(120, 0.07, 'sine', 0.09, 0, 80, 'key') },                    // 榧撶偣鎵撳嚮涔?  bubble: () => playTone(420, 0.07, 'sine', 0.06, 0, 1300, 'key'),                                           // 姘旀场鐮磋锛堜笂婊戯級
  typewriter: () => { playTone(950, 0.02, 'square', 0.035, 0, null, 'key'); playNoise(0.015, 0.025, 0, 'key') },                // 澶嶅彜鎵撳瓧鏈?  sword: () => playTone(2300, 0.07, 'sawtooth', 0.045, 0, 900, 'key'),                                       // 閲戝睘鍓戦煶锛堟壂棰戯級
  cherryBlue: () => { playTone(1650, 0.018, 'square', 0.05, 0, null, 'key'); playTone(720, 0.03, 'triangle', 0.04, 0.03, null, 'key') }, // Cherry 闈掕酱锛堝挃鍡?瑙﹀簳锛?  cherryRed: () => { playTone(1050, 0.015, 'square', 0.04, 0, null, 'key'); playNoise(0.012, 0.018, 0, 'key') },                // Cherry 绾㈣酱锛堟煍鐭椃鍝嶏級
}
// 鎸夐敭闊虫晥锛氶粯璁ゃ€岃交鏌旀寜閿煶銆? 瀹樻柟鍙ヤ箰閮?typing.mp3 鍘熷０锛堢櫨鍒嗙櫨澶嶅埢閿洏澹帮級锛涘叾浣?6 绉嶉鏍间负鍚堟垚闊?const sfxKey = () => {
  if (!SFX_CFG.enabled || !SFX_CFG.keyOn) return
  if (SFX_CFG.keyType === 'soft') { questSounds.ensureTypingSound(); questSounds.playTypingSound(); return }
  ;(KEY_FX[SFX_CFG.keyType] || KEY_FX.soft)()
}
// 鈥斺€?浜屻€佺瓟棰樺弽棣堥煶鏁堢粍锛堝畼鏂?mp3 鍘熷０锛氱瓟瀵?right.mp3 / 绛旈敊 error.mp3锛?鈥斺€?const withAnswerVol = (fn) => { const _k = sfxKind; sfxKind = 'answer'; try { fn() } finally { sfxKind = _k } }
const sfxPerfect = () => { if (!SFX_CFG.enabled || !SFX_CFG.answerOn) return; withAnswerVol(() => questSounds.playRightSound()) } // 鏃犱慨鏀瑰叏瀵癸細瀹樻柟绛斿鍘熷０
const sfxGreat = () => { if (!SFX_CFG.enabled || !SFX_CFG.answerOn) return; withAnswerVol(() => questSounds.playRightSound()) } // 鏈変慨鏀瑰悗绛斿锛氬畼鏂圭瓟瀵瑰師澹?const sfxError = () => { if (!SFX_CFG.enabled || !SFX_CFG.answerOn) return; withAnswerVol(() => questSounds.playErrorSound()) } // 绛旈敊锛氬畼鏂归敊璇師澹帮紙涓庢姈鍔ㄥ悓姝ワ級
const sfxSentence = () => { if (!SFX_CFG.enabled || !SFX_CFG.answerOn) return; withAnswerVol(() => questSounds.playRightSound()) } // 鏁村彞瀹屾垚锛氬畼鏂圭瓟瀵瑰師澹版敹灏?// 鈥斺€?涓夈€佽繛鍑绘縺鍔遍煶鏁堢粍锛堥渶 杩炲嚮鍔ㄧ敾 + 杩炲嚮闊虫晥 涓ゅ紑鍏冲悓鏃跺紑鍚級 鈥斺€?const sfxCombo = (level) => {
  if (!SFX_CFG.enabled || !SFX_CFG.comboFx || !SFX_CFG.comboAnim) return
  withAnswerVol(() => {
  if (level >= 10) { // 楂樼噧鍐插埡
    playTone(523, 0.06, 'square', 0.07); playTone(659, 0.06, 'square', 0.07, 0.05); playTone(784, 0.06, 'square', 0.07, 0.1); playTone(1046, 0.06, 'square', 0.07, 0.15); playTone(1318, 0.08, 'square', 0.07, 0.2); playTone(1568, 0.22, 'square', 0.08, 0.25); playNoise(0.18, 0.05, 0.1)
  } else if (level >= 6) { // 閫掕繘鑺傚
    playTone(523, 0.07, 'triangle', 0.08); playTone(659, 0.07, 'triangle', 0.08, 0.06); playTone(784, 0.07, 'triangle', 0.08, 0.12); playTone(1046, 0.16, 'triangle', 0.09, 0.18)
  } else { // 3-5 杩炲嚮锛氬熀纭€杞诲揩婵€鍔?    playTone(523, 0.09, 'triangle', 0.08); playTone(784, 0.16, 'triangle', 0.09, 0.08)
  }
  })
}
const sfxComboBreak = () => { if (!SFX_CFG.enabled || !SFX_CFG.comboFx || !SFX_CFG.comboAnim) return; withAnswerVol(() => { playTone(784, 0.1, 'sine', 0.06, 0, 480) }) } // 杩炲嚮涓柇锛氳交寰洖钀?// 鈥斺€?鍥涖€佸満鏅姛鑳介煶鏁堢粍 鈥斺€?const sfxScene = () => { if (!SFX_CFG.enabled || !SFX_CFG.sceneOn) return; withAnswerVol(() => { playTone(523, 0.07, 'triangle', 0.06); playTone(784, 0.1, 'triangle', 0.06, 0.06) }) } // 椤甸潰鍒囨崲/鍒囬杩囨浮
const sfxFunc = () => { if (!SFX_CFG.enabled || !SFX_CFG.sceneOn) return; withAnswerVol(() => { playTone(880, 0.04, 'sine', 0.045) }) } // 鍔熻兘鎿嶄綔锛堝彂闊?鐢熻瘝/绛旀锛夎交閲忕‘璁?const sfxRating = (label) => { // 缁撶畻璇勭骇鎴愬氨闊?  if (!SFX_CFG.enabled || !SFX_CFG.sceneOn) return
  withAnswerVol(() => {
  const seq = { SSS: [523, 659, 784, 1046, 1318, 1568], SS: [523, 659, 784, 1046], S: [523, 659, 784], A: [523, 659], B: [523], C: [392, 330] }[label] || [523]
  seq.forEach((f, i) => playTone(f, label === 'SSS' ? 0.16 : 0.1, label === 'SSS' ? 'sine' : 'triangle', 0.09, i * 0.09))
  if (label === 'SSS') playTone(2093, 0.5, 'sine', 0.05, 0.5)
  })
}

// ================= 妯″潡1.1 瀛椾綋涓庡瓧鍙蜂綋绯?=================
// 瀛椾綋瑙勫垯锛氫縿鏂?涓枃缁熶竴绯荤粺榛樿鏃犺‖绾匡紱鍙€?Nunito/Fredoka 鍦嗘鼎鑻辨枃瀛椾綋鍒囨崲锛堝彧瑕嗙洊鎷変竵瀛楃锛屽叾浣欒嚜鍔ㄥ洖閫€锛?// P5 鏂板 Nunito锛堝畼鏂瑰彞涔愰儴鍚屾鍦嗘鼎瀛椾綋锛?const FONT_STACK = {
  system: "-apple-system,'Segoe UI','PingFang SC','Microsoft YaHei','Noto Sans','Helvetica Neue',sans-serif",
  nunito: "'Nunito',-apple-system,'Segoe UI','PingFang SC','Microsoft YaHei','Noto Sans','Helvetica Neue',sans-serif",
  fredoka: "'Fredoka',-apple-system,'Segoe UI','PingFang SC','Microsoft YaHei','Noto Sans',sans-serif",
}
// 瀛楀彿鍒嗙骇锛氬皬 / 涓?/ 澶?涓夋。锛岄粯璁や腑
const Q_SIZE = { 灏? 24, 涓? 30, 澶? 38 }   // 鏍稿績棰樺共锛堥〉闈㈡渶楂樿瑙夊眰绾э級
const S_WORD = { 灏? 16, 涓? 20, 澶? 26 }   // 閲嶉煶路杈撳叆璇嶅潡
const S_ROLE = { 灏? 24, 涓? 30, 澶? 38 }   // 閲嶉煶路绛旀璇?const S_BIG  = { 灏? 32, 涓? 42, 澶? 54 }   // 閲嶉煶路绛旀澶ц瘝
const AUX_SIZE = { 灏? 11, 涓? 12.5, 澶? 14 } // 杈呭姪鏂囧瓧锛堥《閮ㄨ繘搴︽潯/搴曢儴鎿嶄綔鏍?鎻愮ず鏂囨锛屾瘮棰樺共浣?涓眰绾э紝璺熼殢棰樺共妗ｄ綅鑷姩閫傞厤锛?
// ================= 妯″潡1.2 鍏ㄥ眬閰嶈壊浣撶郴锛堟祬鑹查粯璁?+ 3 绉嶆姢鐪间富棰橈級 =================
const THEMES = {
  light: { name: '娴呰壊', bg: '#FFFFFF', bgSoft: '#F6F6F8', panel: '#FFFFFF', text: '#3A3A3A', textStrong: '#1C1C1E', sub: '#8E8E93', border: '#E4E4E7', brand: '#7C5CFC', brandSoft: 'rgba(124,92,252,.10)', ok: '#22C55E', okSoft: 'rgba(34,197,94,.12)', err: '#EF4444', errSoft: 'rgba(239,68,68,.10)', aiBg: '#FBFBFD', aiBorder: '#ECE9F4', shadow: '0 12px 44px rgba(60,40,120,.14)', grad: 'linear-gradient(160deg,#F7F6FB 0%,#FFFFFF 45%)' },
  dark: { name: '娣辫壊', bg: '#0D0918', bgSoft: '#16111F', panel: '#1B1330', text: '#F5EDE2', textStrong: '#FFFFFF', sub: '#8B7FA3', border: 'rgba(255,255,255,.12)', brand: '#8B5CF6', brandSoft: 'rgba(139,92,246,.16)', ok: '#10B981', okSoft: 'rgba(16,185,129,.2)', err: '#F87171', errSoft: 'rgba(239,68,68,.15)', aiBg: 'rgba(20,14,36,.94)', aiBorder: 'rgba(255,255,255,.07)', shadow: '0 18px 60px rgba(0,0,0,.5)', grad: 'radial-gradient(ellipse at 50% -20%, #241A3D 0%, #0D0918 55%)' },
  warm: { name: '鏆栬壊鎶ょ溂', bg: '#FAF3E7', bgSoft: '#F3E9D7', panel: '#FFFDF7', text: '#4A3F33', textStrong: '#2E2620', sub: '#9A8A76', border: '#E5D9C7', brand: '#B0793B', brandSoft: 'rgba(176,121,59,.12)', ok: '#4C9A57', okSoft: 'rgba(76,154,87,.12)', err: '#C0564B', errSoft: 'rgba(192,86,75,.12)', aiBg: '#FBF6EC', aiBorder: '#EFE3D0', shadow: '0 12px 40px rgba(74,63,51,.10)', grad: 'linear-gradient(160deg,#F7EFE0 0%,#FAF3E7 45%)' },
  green: { name: '缁胯壊鎶ょ溂', bg: '#EAF4EA', bgSoft: '#DEEBDE', panel: '#F5FBF5', text: '#2F4432', textStrong: '#1F2E21', sub: '#7E9783', border: '#CFE0CF', brand: '#3E8E4E', brandSoft: 'rgba(62,142,78,.12)', ok: '#2E9E4F', okSoft: 'rgba(46,158,79,.12)', err: '#C14B4B', errSoft: 'rgba(193,75,75,.12)', aiBg: '#F0F8F0', aiBorder: '#DCEBDC', shadow: '0 12px 40px rgba(31,46,33,.10)', grad: 'linear-gradient(160deg,#E2F0E2 0%,#EAF4EA 45%)' },
}
// 璇嶆€ф爣娉細涓嶅悓璇嶆€т娇鐢ㄤ笉鍚屼笅鍒掔嚎棰滆壊锛沺osMark=false 鏃堕殣钘?const POS_COLORS = {
  '褋褍褖.': '#3B82F6', '鍚嶈瘝': '#3B82F6',
  '谐谢.': '#22C55E', '鍔ㄨ瘝': '#22C55E',
  '锌褉懈谢.': '#F59E0B', '褰㈠璇?: '#F59E0B',
  '薪邪褉.': '#8B5CF6', '鍓瘝': '#8B5CF6',
  '屑械褋褌.': '#EC4899', '浠ｈ瘝': '#EC4899',
  '锌褉械写谢.': '#14B8A6', '浠嬭瘝': '#14B8A6',
  '褋芯褞蟹': '#EF4444', '杩炶瘝': '#EF4444',
}
const posColor = (pos) => { for (const k in POS_COLORS) { if ((pos || '').includes(k)) return POS_COLORS[k] } return '#9CA3AF' }
const UI_DEFAULT = { font: 'system', qSize: '涓?, sSize: '涓?, theme: 'light', inputStyle: 'dynamic', answerMode: 'float', posMark: true, autoSpeak: false, speakTimes: 2, speakSpeed: 1, speakGap: 1, answerSpeak: false, autoNext: false, ignoreCase: true, showImage: true, imgPos: 'center', imgSize: 'mid', autoReveal: '3', wrongRec: '3', learnDefault: '鍒濈骇', showProgress: true, showStruct: true, structStyle: 'outline', showWordTrans: true, skipNames: true, showPos: true, posStyle: 'color_text', posColors: { '鍚嶈瘝': '#3b82f6', '鍔ㄨ瘝': '#22c55e', '褰㈠璇?: '#8b5cf6', '鍓瘝': '#eab308', '浠ｈ瘝': '#ef4444', '浠嬭瘝': '#1e40af', '骞跺垪杩炶瘝': '#f43f5e', '浠庡睘杩炶瘝': '#f43f5e', '鎰熷徆璇?: '#f97316', '闄愬畾璇?: '#14b8a6', '鍔╁姩璇?: '#22c55e', '涓撴湁鍚嶈瘝': '#3b82f6', '浜哄悕': '#3b82f6', '鏁拌瘝': '#8b5cf6', '鍔╄瘝': '#9ca3af' }, posVis: { '鍚嶈瘝': true, '鍔ㄨ瘝': true, '褰㈠璇?: true, '鍓瘝': true, '浠ｈ瘝': true, '浠嬭瘝': true, '骞跺垪杩炶瘝': true, '浠庡睘杩炶瘝': true, '鎰熷徆璇?: true, '闄愬畾璇?: true, '鍔╁姩璇?: true, '涓撴湁鍚嶈瘝': true, '浜哄悕': true, '鏁拌瘝': true, '鍔╄瘝': true } }
// 鏈楄閫熷害妗ｄ綅锛?.5x ~ 2x锛?const SPEED_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]
// 涓ら亶鏈楄涔嬮棿鐨勫仠椤块棿闅旓紙绉掞級
const GAP_STEPS = [0.3, 0.5, 0.8, 1]

// ================= 涓荤粍浠?=================
export default function RuQuest() {
  const navigate = useNavigate()
  // 闃舵锛歝ourses 璇剧▼閫夋嫨 / lessons 璇惧垪琛?/ preview 闃呰棰勪範 / loading 鍑嗗 / game 绛旈 / result 缁撶畻
  const [phase, setPhase] = useState('courses')
  const [curLevel, setCurLevel] = useState('A1')
  const [lessons, setLessons] = useState([])       // 褰撳墠璇剧▼鐨勫叏閮ㄨ
  const [detailTab, setDetailTab] = useState('route') // 璇剧▼璇︽儏椤垫爣绛撅細route=瀛︿範璺嚎锛宱utline=澶х翰
  const [curLesson, setCurLesson] = useState(null) // 褰撳墠璇?  const [mode, setMode] = useState(() => {
    try { return localStorage.getItem('rlearn_quest_mode') || 'chinese_to_english' } catch (e) { return 'chinese_to_english' }
  })
  const [modeOpen, setModeOpen] = useState(false)  // 绛旈椤靛唴妯″紡鍒囨崲闈㈡澘
  const [moreOpen, setMoreOpen] = useState(false)    // 宸ュ叿鏍忋€屾洿澶氥€嶆孩鍑鸿彍鍗曪紙淇濈暀鎵╁睍鍔熻兘鍏ュ彛锛?
  // 绛旈鐘舵€?  const [questions, setQuestions] = useState([])   // 鏈鍏ㄩ儴棰橈紙姣忚瘝涓€棰?+ 鏁村彞涓€棰橈級
  const [qi, setQi] = useState(0)                  // 鍏ㄥ眬棰樺彿 (x/鎬?
  const [score, setScore] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [startAt, setStartAt] = useState(0)
  const [combo, setCombo] = useState(0)
  const [maxCombo, setMaxCombo] = useState(0)
  const [paused, setPaused] = useState(false)            // 鏆傚仠鐘舵€?  const [showSettings, setShowSettings] = useState(false) // 璁剧疆寮圭獥锛堝揩鎹烽敭/鎾斁/鍚姏绛夐厤缃紝浠呬縿璇棷鍏抽〉鍐呮墦寮€锛?  const [gameSettingOpen, setGameSettingOpen] = useState(false) // P4 娓告垙鍐呰缃脊绐楋紙鍊嶉€?鎾斁娆℃暟/闂撮殧锛?  const [dictTipVisible, setDictTipVisible] = useState(false)    // P5 鍚啓妯″紡绛旀鎻愮ず鏄剧ず鐘舵€?  const [wrongBookOpen, setWrongBookOpen] = useState(false)      // P6 閿欓鏈嫭绔嬪脊绐?  const [petVisible, setPetVisible] = useState(true)              // P6 妗岄潰瀹犵墿鍙鎬?  const [comboPop, setComboPop] = useState(null)         // 杩炲嚮娴姩鏂囧瓧 {n, high}
  const [comboBreak, setComboBreak] = useState(false)    // 杩炲嚮涓柇鍥炶惤
  const [perfect, setPerfect] = useState(0)
  const [good, setGood] = useState(0)
  const [skipped, setSkipped] = useState(0)
  const [acc, setAcc] = useState({ answered: 0, correct: 0, firstHit: 0 })
  // 缁撶畻涓庨棴鐜細鏈缁冧範閿欓璁板綍 / 缁撶畻椤甸敊棰樺洖椤惧脊灞?  const [wrongList, setWrongList] = useState([])
  const [resultWrong, setResultWrong] = useState(false)
  // 鍗曢鐘舵€?  const [typed, setTyped] = useState('')           // 杈撳叆涓诧紙绌烘牸鍒嗛殧鐨勮瘝锛岄€忔槑杈撳叆妗嗙湡瀹炲€硷級
  const [chunks, setChunks] = useState([])         // 杈撳叆鎷嗚瘝锛堝吋瀹逛贡搴?鎾ら攢锛?  const [wrong, setWrong] = useState(false)
  const [wrongCount, setWrongCount] = useState(0)
  // 鈥斺€?瀹樻柟杩炶瘝鎴愬彞鐘舵€佹満锛堢Щ妞嶈嚜 earthworm apps/client/composables/main/question.ts锛屼縿璇€傞厤锛?鈥斺€?  // mode: input 姝ｅ父杈撳叆 / fix 鎻愪氦鍚庢湁閿欒 / fix_input 姝ｅ湪淇敼鏌愪釜閿欒璇?  const [fixMode, setFixMode] = useState('input')
  const [editIdx, setEditIdx] = useState(-1)       // fix_input 姝ｅ湪缂栬緫鐨勯敊璇瘝涓嬫爣
  const [slotState, setSlotState] = useState({ incorrect: [], active: -1 }) // 閿欒璇嶄笅鏍囬泦 + 褰撳墠婵€娲昏瘝涓嬫爣
  const [done, setDone] = useState(false)          // 褰撳墠棰樼瓟瀵?  const [showAnswer, setShowAnswer] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [analysing, setAnalysing] = useState(false)
  const [praise, setPraise] = useState('')
  const [stuckOpen, setStuckOpen] = useState(false) // 鍗′綇浜嗗悧
  const [loadPct, setLoadPct] = useState(0)
  // 鍙ｈ璇勬祴锛堟ā寮?speaking锛?  const [recording, setRecording] = useState(false)
  const [recDur, setRecDur] = useState(0)
  const [speakLoading, setSpeakLoading] = useState(false)
  const [speakResult, setSpeakResult] = useState(null)
  const [recordingUrl, setRecordingUrl] = useState('')   // 鏈€杩戜竴娆″彛璇綍闊崇殑鏈湴鍥炴斁鍦板潃
  const mediaRecRef = useRef(null)
  const recChunks = useRef([])
  const recTimer = useRef(null)
  // 涔卞簭妯″紡锛坰cramble锛?  const [scramblePicked, setScramblePicked] = useState([])
  // 鎺屾彙/鐢熻瘝
  const [mastered, setMastered] = useState(() => JSON.parse(localStorage.getItem('rlearn_quest_mastered') || '[]'))
  const [vocabNote, setVocabNote] = useState(() => JSON.parse(localStorage.getItem('rlearn_quest_vocab') || '[]'))
  // AI 鍔╂墜
  const [aiThread, setAiThread] = useState([])
  const [aiBusy, setAiBusy] = useState(false)
  const [aiQ, setAiQ] = useState('')
  // 椤甸潰鍔熻兘鎺т欢锛氶《閮ㄥ伐鍏锋爮鏀惰捣/灞曞紑銆丄I 渚ф爮鍞よ捣銆佹湰璇惧唴瀹广€佹挙閿€鏍?  const [topExpanded, setTopExpanded] = useState(false)   // 椤堕儴鍔熻兘鏍忓睍寮€锛坔over 鎴栫偣鍑诲睍寮€鎸夐挳锛?  const [aiOpen, setAiOpen] = useState(false)             // 鍙充笅瑙掓偓娴浘鏍囧敜璧蜂晶杈笰I鍔╂墜锛堥粯璁ゆ敹璧凤紝涓嶉伄鎸＄瓟棰樺尯锛?  const [contentOpen, setContentOpen] = useState(false)   // 鏈鍐呭闈㈡澘锛堝彞瀛愬垪琛?+ 璺宠浆锛?  const undoStack = useRef([])                            // 杈撳叆鎾ら攢鏍堬紙Ctrl+Z 鍥為€€涓婁竴姝ヨ緭鍏ワ級
  const composing = useRef(false)                         // 涓枃杈撳叆娉曠粍鍚堜腑锛堝畼鏂癸細composition 鏈熼棿涓嶈Е鍙戞彁浜わ級
  // 妯″潡1.1 澶栬璁剧疆锛堝瓧浣?+ 瀛楀彿妗ｄ綅锛?  const [uiOpen, setUiOpen] = useState(false)
  const [ui, setUi] = useState(() => {
    try { return { ...UI_DEFAULT, ...(JSON.parse(localStorage.getItem('rlearn_quest_ui') || '{}') || {}) } } catch { return { ...UI_DEFAULT } }
  })
  // 涓婚娲剧敓锛氬瑙傞〉銆屼富棰樿缃€嶅己鍒舵祬/娣憋紱璺熼殢绯荤粺鏃剁敱銆岀粌涔犺儗鏅壊銆嶅喅瀹氾紙榛樿/鏆栬壊/缁胯壊锛?  const themeOf = () => {
    if (ui.themeMode === 'light') return 'light'
    if (ui.themeMode === 'dark') return 'dark'
    if (ui.bgColor === 'warm') return 'warm'
    if (ui.bgColor === 'green') return 'green'
    return 'light'
  }
  const uiCfg = { font: ui.font || 'system', qSize: ui.qSize || '涓?, sSize: ui.sSize || '涓?, theme: themeOf(), themeMode: ui.themeMode || 'auto', bgColor: ui.bgColor || 'default', inputStyle: ui.inputStyle || 'dynamic', answerMode: ui.answerMode || 'float', posMark: ui.posMark !== false, autoSpeak: !!ui.autoSpeak, speakTimes: ui.speakTimes || 2, speakSpeed: ui.speakSpeed || 1, speakGap: ui.speakGap ?? 1, answerSpeak: !!ui.answerSpeak, autoNext: !!ui.autoNext, ignoreCase: ui.ignoreCase !== false, showImage: ui.showImage !== false, imgPos: ui.imgPos || 'center', imgSize: ui.imgSize || 'mid', autoReveal: ui.autoReveal || '3', wrongRec: ui.wrongRec || '3', learnDefault: ui.learnDefault || '鍒濈骇', showProgress: ui.showProgress !== false, showStruct: ui.showStruct !== false, structStyle: ui.structStyle || 'outline', showWordTrans: ui.showWordTrans !== false, skipNames: ui.skipNames !== false, showPos: ui.showPos !== false, posStyle: ui.posStyle || 'color_text', posColors: ui.posColors || UI_DEFAULT.posColors, posVis: ui.posVis || UI_DEFAULT.posVis, showScore: ui.showScore !== false, bgImage: ui.bgImage || null }
  // 缁冧範鑳屾櫙鍥撅紙澶栬椤典笂浼狅紝瑕嗙洊鍦ㄤ富棰樻笎鍙樹箣涓婏級
  const bgImageStyle = uiCfg.bgImage ? { backgroundImage: 'url(' + uiCfg.bgImage + ')', backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' } : null
  // 绛旈鏍￠獙锛氬拷鐣ュぇ灏忓啓锛堥粯璁ゅ紑锛夆啋 灏忓啓褰掍竴锛涘叧闂?鈫?涓ユ牸澶у皬鍐?  const normFor = (w) => { const c = cleanWord(w || ''); return uiCfg.ignoreCase ? stripStress(c).toLowerCase().trim() : stripStress(c).trim() }
  const recThreshold = { '3': 3, '2': 2, '1': 1, always: 1 }[uiCfg.wrongRec] || 3        // 璁板綍鍒伴敊棰樻湰闃堝€?  const revealThreshold = { '3': 3, '2': 2, '1': 1, off: 99 }[uiCfg.autoReveal] || 3     // 鑷姩鏄剧ず绛旀闃堝€?  const saveUi = useCallback((patch) => {
    const n = { ...uiCfg, ...patch }
    setUi(n)
    try { localStorage.setItem('rlearn_quest_ui', JSON.stringify(n)) } catch { /* 蹇界暐 */ }
  }, [uiCfg])
  // 閫夋嫨 Fredoka 鏃跺姩鎬佸姞杞藉瓧浣擄紙鍔犺浇澶辫触鑷姩鍥為€€绯荤粺瀛椾綋锛?  useEffect(() => {
    if (uiCfg.font === 'fredoka' && !document.getElementById('fredoka-font')) {
      const l = document.createElement('link')
      l.id = 'fredoka-font'; l.rel = 'stylesheet'
      l.href = 'https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&display=swap'
      document.head.appendChild(l)
    }
  }, [uiCfg.font])

  const audioRef = useRef(null)
  const inputRef = useRef(null)
  const inputRowRef = useRef(null)
  const analysisCache = useRef({})
  const dictCache = useRef({})
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])

  const cur = questions[qi] || null

  // 鈥斺€?璇剧▼/棰樺簱 鈥斺€?  const poolOf = useCallback((lv) => {
    const sents = []
    for (const video of getLevelVideos(lv)) {
      for (const s of video.sentences || []) {
        if (s.russian && s.russian.trim()) sents.push({ ...s, source: video.title })
      }
    }
    return sents
  }, [])

  // 鐢熸垚璇剧▼锛堢洿鎺ヤ粠 courseLibrary 璇诲彇鍗曞厓锛?  const buildLessons = useCallback((lv) => {
    const videos = getLevelVideos(lv)
    return videos.map((v, i) => ({
      id: v.id,
      idx: i + 1,
      title: v.title,
      description: v.description,
      duration: v.duration,
      words: v.words,
      sentences: v.sentences || []
    }))
  }, [])

  const lessonsByLevel = useMemo(() => {
    const m = {}
    for (const lv of LEVELS) m[lv] = buildLessons(lv)
    return m
  }, [buildLessons])

  // 鎷夊彇涓€鍙ョ殑閫愯瘝璇嶅吀锛堝鐢?/api/dict锛屽甫缂撳瓨锛?  const fetchDict = useCallback(async (word) => {
    const w = cleanWord(word)
    if (!w) return null
    if (dictCache.current[w]) return dictCache.current[w]
    try {
      const r = await fetch((API_BASE || '') + '/api/dict?word=' + encodeURIComponent(stripStress(w)), { headers: { 'Content-Type': 'application/json' } })
      if (!r.ok) return null
      const j = await r.json()
      const d = j && (j.entries?.[0] || j.data?.entries?.[0] || j)
      dictCache.current[w] = d || null
      return d || null
    } catch (e) { return null }
  }, [])

  // 鐢熸垚璇惧唴棰樼洰锛堝墠缂€绱姞娓愯繘寮忥細閫愯瘝鎵撳熀纭€ 鈫?姣?璇嶅墠缂€绱姞 鈫?鏁村彞鏀跺熬锛?  const buildQuestions = useCallback(async (lesson) => {
    const qs = []
    for (const s of lesson.sentences) {
      const ws = s.russian.trim().split(/\s+/).filter(Boolean)
      if (ws.length === 0) continue
      // 鍗曡瘝鍙ワ細鐩存帴涓€閬撴暣鍙ラ锛岄伩鍏嶉噸澶?      if (ws.length === 1) {
        qs.push({ s, partIdx: 1, partTotal: 1, full: true, zh: s.chinese || '', answer: s.russian, wordCount: 1, id: s.id + '_full' })
        continue
      }
      let lastPrefixEnd = 0
      for (let i = 0; i < ws.length; i++) {
        // 鈶?閫愯瘝棰橈細姣忎釜璇嶅崟鐙竴棰橈紝鎵撳ソ鍩虹
        qs.push({ s, partIdx: i + 1, partTotal: ws.length, full: false, zh: s.chinese || '', answer: ws[i], wordCount: 1, id: s.id + '_w' + i })
        // 鈶?鍓嶇紑绱姞棰橈細姣忓瀹?涓瘝锛堜笖闈炴渶鍚庝竴璇嶏級锛岀敤鍓嶉潰鎵€鏈夎瘝缁勫悎妫€楠?        if ((i + 1) % 2 === 0 && i < ws.length - 1) {
          const prefix = ws.slice(0, i + 1).join(' ')
          qs.push({ s, partIdx: i + 1, partTotal: ws.length, full: true, zh: s.chinese || '', answer: prefix, wordCount: i + 1, id: s.id + '_p' + (i + 1) })
          lastPrefixEnd = i + 1
        }
      }
      // 鈶?鏁村彞棰橈細鏈€鍚庢敹灏撅紙鑻ヤ笂涓€娆＄疮鍔犳湭瑕嗙洊鏁村彞锛?      if (lastPrefixEnd < ws.length) {
        qs.push({ s, partIdx: ws.length, partTotal: ws.length, full: true, zh: s.chinese || '', answer: s.russian, wordCount: ws.length, id: s.id + '_full' })
      }
    }
    return qs
  }, [])

  // 鈥斺€?寮€濮嬩竴璇撅紙鏀寔鎭㈠涓婃杩涘害锛況eading 妯″紡鍏堣繘棰勪範锛?鈥斺€?  const startLesson = async (lesson, resume) => {
    setCurLesson(lesson)
    setPhase('loading'); setLoadPct(5)
    const timer = setInterval(() => {
      setLoadPct(p => Math.min(92, p + Math.floor(Math.random() * 12) + 4))
    }, 220)
    const qs = await buildQuestions(lesson)
    clearInterval(timer)
    setQuestions(qs)
    let saved = null
    try { saved = JSON.parse(localStorage.getItem('rlearn_quest_progress') || 'null') } catch (e) { saved = null }
    const useSaved = resume && saved && saved.lessonId === lesson.id
    if (useSaved) {
      setQi(Math.min(saved.qi || 0, Math.max(0, qs.length - 1)))
      setScore(saved.score || 0)
      setCombo(saved.combo || 0); setMaxCombo(saved.maxCombo || 0)
      setPerfect(saved.perfect || 0); setGood(saved.good || 0); setSkipped(saved.skipped || 0)
      setAcc(saved.acc || { answered: 0, correct: 0, firstHit: 0 })
      setElapsed(saved.elapsed || 0); setStartAt(Date.now() - (saved.elapsed || 0) * 1000)
    } else {
      setQi(0); setScore(0); setCombo(0); setMaxCombo(0); setPerfect(0); setGood(0); setSkipped(0)
      setAcc({ answered: 0, correct: 0, firstHit: 0 })
      setElapsed(0); setStartAt(Date.now())
    }
    setWrongList([]); setResultWrong(false)
    setAnalysis(null); setAiThread([]); setModeOpen(false)
    setLoadPct(100)
    sfxScene()
    setTimeout(() => setPhase(mode === 'reading' ? 'preview' : 'game'), 350)
  }

  // 鈥斺€?杩涘害鑷姩淇濆瓨锛堝垏鎹㈤鐩?绂诲紑鏃跺啓鍏?localStorage锛?鈥斺€?  const saveProgress = useCallback(() => {
    if (!curLesson) return
    try {
      localStorage.setItem('rlearn_quest_progress', JSON.stringify({
        lessonId: curLesson.id, qi, score, elapsed, combo, maxCombo, perfect, good, skipped, acc,
        updatedAt: Date.now(),
      }))
    } catch (e) { /* 蹇界暐 */ }
  }, [curLesson, qi, score, elapsed, combo, maxCombo, perfect, good, skipped, acc])

  // 鈥斺€?鍔犺浇棰樼洰 鈥斺€?  const loadQuestion = useCallback((idx) => {
    const q = questions[idx]
    if (!q) return
    setTyped(''); setChunks([]); setWrong(false); setWrongCount(0); setDone(false); setShowAnswer(false)
    setFixMode('input'); setEditIdx(-1); setSlotState({ incorrect: [], active: -1 })
    setPraise(''); setAnalysis(analysisCache.current[q.id] || null); setAnalysing(false)
    setStuckOpen(false)
    setScramblePicked([])          // 涔卞簭妯″紡锛氶噸缃凡閫?    setSpeakResult(null); setSpeakLoading(false); setRecording(false) // 鍙ｈ妯″紡锛氶噸缃?  }, [questions])

  useEffect(() => {
    if (phase === 'game' && questions.length) loadQuestion(qi)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qi, phase])

  useEffect(() => {
    if (phase !== 'game' || paused) return
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startAt) / 1000)), 1000)
    return () => clearInterval(t)
  }, [phase, startAt, paused])

  // 鑷姩鑱氱劍杈撳叆
  useEffect(() => {
    if (phase === 'game') {
      const t = setTimeout(() => inputRef.current?.focus(), 80)
      return () => clearTimeout(t)
    }
  }, [phase, qi, done])

  // 鈥斺€?鍙戦煶锛坰peed: 0.5~2.0锛岃蛋鍚庣 /api/tts?rate=锛?鈥斺€?  const speak = useCallback((text, speed) => {
    if (!text) return
    if (!audioRef.current) audioRef.current = new Audio()
    const a = audioRef.current
    a.pause()
    const sp = speed != null && speed !== 1 ? speed : null
    a.src = (API_BASE || '') + '/api/tts?text=' + encodeURIComponent(text) + '&_=' + Date.now() + (sp ? '&rate=' + sp : '')
    a.play().catch(() => {})
  }, [])

  const playCur = useCallback(() => {
    if (cur) { sfxFunc(); speak(cur.s.russian) }
  }, [cur, speak])

  // 鈥斺€?鍙厤缃揩鎹烽敭鍔ㄤ綔锛堣缃脊绐楀彲鏀归敭浣嶏紝閰嶇疆瀛?rlearn_quest_hotkeys锛?鈥斺€?  const playWordByWord = () => {
    if (!cur) { toast('璇峰厛杩涘叆涓€璇?); return }
    const ws = cur.s.russian.trim().split(/\s+/)
    ws.forEach((w, i) => setTimeout(() => speak(w), i * 900))
    toast('閫愯瘝鎾斁锛? + ws.length + ' 涓崟璇?)
  }
  const playCurrentWordFn = () => {
    if (!cur) { toast('璇峰厛杩涘叆涓€璇?); return }
    const ws = typed.trim() ? typed.trim().split(/\s+/) : cur.answer.trim().split(/\s+/)
    speak(ws[ws.length - 1] || cur.answer)
  }
  const playRecordingFn = () => {
    if (recordingUrl) { const a = new Audio(recordingUrl); a.play().catch(() => {}); return }
    toast('鏆傛棤褰曢煶鍙挱鏀撅紝璇峰厛鍦ㄥ彛璇瘎娴嬩腑褰曢煶')
  }
  const hotActionsRef = useRef({})
  hotActionsRef.current = { playWordByWord, playCurrentWordFn, playRecordingFn, startRec: () => startRec(), stopRec: () => stopRec(), showAnswerNow: () => showAnswerNow() }

  // 鈥斺€?鍏堣鍚庡啓锛氳繘鍏ユ柊棰樿嚜鍔ㄦ湕璇伙紙鍚啓妯″紡榛樿鑷姩鎾紱autoSpeak 寮€鍏虫帶鍒跺叾浠栨ā寮忥級 鈥斺€?  // P5 鍚啓妯″紡鑷姩鎾斁璇诲彇娓告垙璁剧疆宸ュ叿鏍忥紙鍊嶉€?娆℃暟/闂撮殧锛夛紝鍏朵粬妯″紡鐢ㄥ瑙傞〉鏈楄璁剧疆
  useEffect(() => {
    if (phase !== 'game' || !cur) return
    if (done || mode === 'speaking') return
    const needAuto = mode === 'dictation' || uiCfg.autoSpeak
    if (!needAuto) return
    let times, speed, gap
    if (mode === 'dictation') {
      // P5 鍚啓妯″紡锛氫粠娓告垙璁剧疆宸ュ叿鏍忚鍙栭厤缃?      try {
        const tb = JSON.parse(localStorage.getItem('rlearn_quest_toolbar') || 'null') || { times: '2', rate: '1', interval: '3000' }
        times = parseInt(tb.times) || 2
        speed = parseFloat(tb.rate) || 1
        gap = (parseInt(tb.interval) || 3000) / 1000
      } catch { times = 2; speed = 1; gap = 3 }
    } else {
      times = uiCfg.speakTimes || 1
      speed = uiCfg.speakSpeed
      gap = uiCfg.speakGap
    }
    const timers = []
    for (let i = 0; i < times; i++) {
      timers.push(setTimeout(() => speak(cur.s.russian, speed), i * ((gap * 1000) + 600)))
    }
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, cur?.id, done, mode, uiCfg.autoSpeak, uiCfg.speakTimes, uiCfg.speakGap, uiCfg.speakSpeed])

  // 鈥斺€?AI 鎷嗚В锛堢瓟妗堝崱锛?鈥斺€?  const fetchAnalysis = useCallback(async (q) => {
    if (!q) return
    if (analysisCache.current[q.id]) { setAnalysis(analysisCache.current[q.id]); return }
    setAnalysing(true)
    try {
      const content = await callAI([
        { role: 'system', content: '浣犳槸淇勮鑰佸笀銆傛妸鐢ㄦ埛缁欑殑淇勮鍙ュ瓙閫愯瘝鎷嗚В骞舵寜璇硶鎴愬垎鍒嗙粍锛屼弗鏍煎彧杈撳嚭 JSON锛屼笉瑕佷换浣曡В閲娿€侸SON 鏍煎紡锛歿"zh":"鏁村彞涓枃缈昏瘧","roles":[{"role":"涓昏","words":[{"word":"鍘熻瘝","stress":"甯﹂噸闊崇殑瑙勮寖璇嶅舰(閲嶉煶鍏冮煶鍚庣敤\'\u0301\'鏍?","pos":"璇嶆€?涓枃)","zh":"涓枃閲婁箟"}]}]}锛宺oles 鎸?涓昏/璋撹/瀹捐/瀹氳/鐘惰 绛夋垚鍒嗗垎缁勶紝鎸夊彞瀛愬疄闄呮垚鍒嗚緭鍑? },
        { role: 'user', content: q.s.russian },
      ])
      let t = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
      const a = t.indexOf('{'), b = t.lastIndexOf('}')
      if (a >= 0 && b > a) t = t.slice(a, b + 1)
      const parsed = JSON.parse(t)
      if (parsed && parsed.roles) {
        analysisCache.current[q.id] = parsed
        setAnalysis(parsed)
      } else throw new Error('bad')
    } catch (e) {
      setAnalysis({ roles: null, zh: q.zh || '', err: true })
    } finally {
      if (mounted.current) setAnalysing(false)
    }
  }, [])

  // 鈥斺€?鏆傚仠/鎭㈠锛堟仮澶嶆椂鍥哄寲宸茶鏃讹紝閬垮厤鏆傚仠鏃堕暱璁″叆锛?鈥斺€?  const resumePause = () => {
    if (paused) { setStartAt(Date.now() - elapsed * 1000); setPaused(false) }
  }
  const togglePause = () => {
    if (paused) resumePause()
    else { setPaused(true); try { audioRef.current?.pause() } catch (e) { /* 蹇界暐 */ } }
  }
  // 閫愬瓧閿欒锛氬己鍒堕噸瑙﹀彂杈撳叆琛屾姈鍔ㄥ姩鐢伙紙涓嶆墦鏂緭鍏ワ級
  const shakeRow = () => {
    const el = inputRowRef.current
    if (!el) return
    el.style.animation = 'none'
    void el.offsetWidth
    el.style.animation = 'ruqShake .3s ease'
  }

  // 鈥斺€?鎻愪氦锛堝畼鏂归€愯瘝鏍￠獙 + Fix 淇娴侊細鏈夐敊鏃惰嚜鍔ㄨ繘鍏ヤ慨澶嶆ā寮忥紝鏀瑰鍚?Great锛?鈥斺€?  const submit = useCallback(() => {
    if (done || !cur) return
    if (fixMode === 'fix') return                    // Fix 寰呭懡锛氱瓑鐢ㄦ埛鎸夐敭杩涘叆淇敼锛屼笉閲嶅鎻愪氦
    const exp = expectWordsOf(cur)
    const parts = typed.split(' ')
    // 瀹樻柟鏍￠獙锛氶€愯瘝瀵规瘮锛堣瘝妲芥暟 = 鏈熸湜璇嶆暟锛涘浣欒緭鍏ュ拷鐣ワ級
    const incorrectIdx = []
    for (let i = 0; i < exp.length; i++) {
      const u = parts[i] !== undefined ? parts[i] : ''
      if (normFor(cleanWord(u)) !== exp[i]) incorrectIdx.push(i)
    }
    const ok = incorrectIdx.length === 0 && parts.length >= exp.length
    if (ok) {
      setDone(true)
      setFixMode('input'); setEditIdx(-1); setSlotState({ incorrect: [], active: -1 })
      const isPerfect = wrongCount === 0 // 鏃犱慨鏀瑰叏瀵?= Perfect锛涙湁淇敼鍚庣瓟瀵?= Great
      const nc = combo + 1
      setCombo(nc); setMaxCombo(m => Math.max(m, nc))
      // 娓愯繘寮忎笁妗ｅ垎鍊硷細閫愯瘝棰?00 / 鍓嶇紑绱姞棰?00 / 鏁村彞棰?00
      const isSentenceFinal = cur.partIdx === cur.partTotal
      const base = !cur.full ? 300 : (isSentenceFinal ? 700 : 500)
      setScore(s => s + base + Math.min(500, combo * 50))
      setPerfect(p => p + 1)
      setAcc(a => ({ ...a, answered: a.answered + 1, correct: a.correct + 1, firstHit: a.firstHit + (isPerfect ? 1 : 0) }))
      if (wrongCount > 0 && wrongCount >= recThreshold) recordWrong(cur, parts.slice(0, exp.length).join(' ') || '锛堟湁淇敼鍚庣瓟瀵癸級', wrongReasonOf(cur, parts.slice(0, exp.length).map(cleanWord).map(normFor)))
      if (isPerfect) sfxPerfect(); else sfxGreat()          // 绛斿鍙嶉锛歅erfect 娓呬寒 / Great 鏌斿拰
      if (petVisible) { petSpeak('correct', 4000); petSetMood(isPerfect ? 'excited' : 'happy') } // P6 瀹犵墿绛斿浜掑姩
      if (isSentenceFinal) sfxSentence()                     // 浠呮暣鍙ラ鎾斁鏀跺熬闊?      if (nc >= 3 && isPerfect) sfxCombo(nc)                 // 杩炲嚮婵€鍔憋紙3-5 / 6-10 / 10+锛?      if (nc >= 3 && SFX_CFG.comboAnim) {                    // 杩炲嚮鍔ㄦ晥锛歅erfect 脳 N 娴姩鏂囧瓧锛?0+ 楂樹寒鍙戝厜+鍏ㄥ睆闂晥锛?        setComboPop({ n: nc, high: nc >= 10 })
        setTimeout(() => setComboPop(null), 420)
      }
      const p = pickPraise()
      setPraise(p)
      speak(p)
      if (uiCfg.answerSpeak) speak(cur.s.russian)   // 銆屾樉绀虹瓟妗堟椂鑷姩鏈楄銆嶅紑鍏筹紙榛樿鍏筹級
      fetchAnalysis(cur)
      if (uiCfg.autoNext) setTimeout(nextQ, 750)    // 銆岀瓟棰樻纭悗鑷姩涓嬩竴棰樸€嶅紑鍏筹紙榛樿鍏筹紝寤惰繜璁╁弽棣堝彲瑙侊級
    } else {
      setWrong(true)
      setWrongCount(c => c + 1)
      const wc = wrongCount + 1
      const inputChunks = parts.slice(0, exp.length).filter(Boolean)
      if (wc >= recThreshold) recordWrong(cur, inputChunks.join(' ') || '锛堢瓟棰橀敊璇級', wrongReasonOf(cur, parts.slice(0, exp.length).map(cleanWord).map(normFor)))
      if (combo >= 3) {                             // 杩炲嚮涓柇锛氬洖钀介煶 + 杞诲井瑙嗚鍥炶惤
        sfxComboBreak()
        setComboBreak(true)
        setTimeout(() => setComboBreak(false), 560)
      }
      setCombo(0)
      sfxError()
      if (petVisible) { petSpeak('wrong', 4000); petSetMood('thinking') } // P6 瀹犵墿绛旈敊榧撳姳
      if (wc >= revealThreshold) showAnswerNow()    // 銆岃嚜鍔ㄦ樉绀虹瓟妗堛€嶏細閿欒 N 娆″悗鑷姩灞曠ず绛旀
      else if (wc >= 3) setStuckOpen(true)          // 鏈紑鍚嚜鍔ㄦ樉绀烘椂锛屼繚鐣欏師銆岀瓟閿?娆℃彁绀虹湅绛旀銆?      // 瀹樻柟 Fix 淇娴侊細鏍囪閿欒璇嶅苟杩涘叆淇妯″紡锛堟寜浠绘剰閿竻绌虹涓€涓敊璇瘝閲嶆墦锛?      setSlotState({ incorrect: incorrectIdx, active: -1 })
      setFixMode('fix')
    }
  }, [done, cur, typed, fixMode, combo, wrongCount, speak, fetchAnalysis, uiCfg.answerSpeak, uiCfg.autoNext, uiCfg.wrongRec, uiCfg.autoReveal, recThreshold, revealThreshold])

  // 鈥斺€?鎾ら攢锛氬洖閫€涓婁竴姝ヨ緭鍏ワ紙Ctrl+Z锛屼粎鏍囧噯杈撳叆妯″紡锛涢』鍦ㄥ叏灞€蹇嵎閿?effect 涔嬪墠瀹氫箟锛?鈥斺€?  const undo = useCallback(() => {
    if (mode === 'scramble') { toast('涔卞簭妯″紡涓嶆敮鎸佹挙閿€'); return }
    if (!undoStack.current.length) { toast('娌℃湁鍙挙閿€鐨勮緭鍏?); return }
    const prev = undoStack.current.pop()
    setTyped(prev)
    setChunks(prev.trim() ? prev.trim().split(/\s+/) : [])
    setWrong(false)
    setFixMode('input'); setEditIdx(-1); setSlotState(s => ({ ...s, incorrect: [], active: -1 }))
    sfxFunc()
  }, [mode])

  // 鈥斺€?杈撳叆澶勭悊锛堝畼鏂硅繛璇嶆垚鍙ワ細閫忔槑杈撳叆妗?+ 鍗曡瘝涓嬪垝绾挎Ы锛岀┖鏍煎垎璇嶏級 鈥斺€?  // 鏈熸湜璇嶏紙鍘婚噸闊?鏍囩偣/灏忓啓褰掍竴鍚庣殑瑙勮寖璇嶏級
  const expectWordsOf = (q) => (q?.answer || '').trim().split(/\s+/).filter(Boolean).map(cleanWord).map(normFor)
  const onInputChange = (e) => {
    if (done) return
    const v = e.target.value
    // 鎾ら攢鏍堬細姣忔杈撳叆鍙樺寲鍘嬪叆涓婁竴姝ュ€硷紙浠?insertText锛屾爤娣遍檺 50锛?    if (e.nativeEvent?.inputType === 'insertText' && v !== typed) {
      undoStack.current.push(typed)
      if (undoStack.current.length > 50) undoStack.current.shift()
    }
    setTyped(v)
    const cs = v.trim() ? v.trim().split(/\s+/) : []
    setChunks(cs)
    setWrong(false)
    if (v.length > 0 && v[v.length - 1] !== ' ' && e.nativeEvent?.inputType === 'insertText') {
      sfxKey()
    }
    // 鍏夋爣鍙樺寲 鈫?鏇存柊婵€娲昏瘝锛堝畼鏂癸細鍏夋爣鎵€鍦ㄨ瘝楂樹寒锛?    const pos = e.target.selectionStart ?? v.length
    setSlotState(s => ({ ...s, active: activeFromCursor(v, pos) }))
  }

  // 鐢卞厜鏍囦綅缃绠楁縺娲昏瘝涓嬫爣锛堣瘝 i 瑕嗙洊 [start_i, end_i]锛?  const activeFromCursor = (val, pos) => {
    const parts = val.split(' ')
    let p = 0, active = -1
    for (let i = 0; i < parts.length; i++) {
      const s = p, e = s + parts[i].length
      if (pos >= s && pos <= e) { active = i; break }
      p = e + 1
    }
    if (active === -1 && parts.length) active = parts.length - 1
    return active
  }

  // 娓呯┖绗?idx 涓Ы鐨勮緭鍏ュ苟鎶婂厜鏍囩Щ鍒拌璇嶅紑澶达紙Fix 淇娴侊級
  const clearSlotWord = (idx) => {
    const exp = expectWordsOf(cur)
    const parts = typed.split(' ')
    while (parts.length < exp.length) parts.push('')
    if (idx < 0 || idx >= exp.length) return
    parts[idx] = ''
    const v = parts.join(' ')
    setTyped(v)
    setChunks(v.trim() ? v.trim().split(/\s+/) : [])
    requestAnimationFrame(() => {
      const el = inputRef.current
      if (!el) return
      let pos = 0
      for (let i = 0; i < idx; i++) pos += (parts[i].length + 1)
      el.setSelectionRange(pos, pos)
      setSlotState(s => ({ ...s, active: idx }))
    })
  }
  const prevIncorrectOf = (idx) => { const a = slotState.incorrect.filter(i => i < idx); return a.length ? a[a.length - 1] : -1 }
  const isLastIncorrectOf = (idx) => !slotState.incorrect.some(i => i > idx)

  const onInputKey = (e) => {
    if (done) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nextQ() } return } // 瀹樻柟 Answer锛氱┖鏍?Enter 涓嬩竴棰?    // Ctrl+Z 鎾ら攢锛堢敤鎴峰揩鎹烽敭瑙勮寖淇濈暀锛涢』鍦?Ctrl 鍏ㄦ嫤鎴箣鍓嶏級
    if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); undo(); return }
    // Windows锛欳trl+Backspace 鍒犻櫎涓婁竴涓崟璇嶏紙瀹樻柟鎵╁睍锛屽吋瀹规煇浜涙祻瑙堝櫒 input 涓嶆敮鎸?ctrl+backspace锛?    if (e.ctrlKey && e.key === 'Backspace') { e.preventDefault(); deletePrevWordOnWin(); return }
    // 瀹樻柟锛欳trl 閿叏鎷︽埅锛堥伩鍏嶄腑鏂囪緭鍏ユ硶棰勮緭鍏ヤ笂灞?/ 瑙﹀彂寮傚父锛?    if (e.ctrlKey) { e.preventDefault(); return }
    if (e.key === 'Escape') { e.preventDefault(); inputRef.current?.blur(); return }
    // 瀹樻柟锛氬叏閮ㄦ柟鍚戦敭绂佹锛堥伩鍏嶅厜鏍囦贡璺戝鑷存縺娲昏瘝閿欎贡锛?    if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); return }
    // 瀹樻柟 Fix 淇娴侊細鎻愪氦鏈夐敊鍚庯紝鎸変换鎰忛敭锛堝惈绌烘牸/閫€鏍硷紝浠?preventDefault 涓嶄笂灞忥級鈫?瀹氫綅骞舵竻绌虹涓€涓敊璇瘝杩涘叆淇敼
    if (fixMode === 'fix') {
      if (e.key === 'Enter') return // 瀹樻柟锛欶ix 鎬?Enter 鏃犲姩浣滐紙submitAnswer 鍦?Fix 涓嬬洿鎺?return锛?      if (e.key === 'Space' || e.key === 'Backspace') e.preventDefault()
      const idx = slotState.incorrect[0]
      if (idx >= 0) {
        clearSlotWord(idx)
        setEditIdx(idx)
        setFixMode('fix_input')
      }
      return
    }
    // Fix_Input锛氱┖鏍煎湪鏈€鍚庝竴涓敊璇瘝 鈫?鎻愪氦锛汢ackspace 绌鸿瘝 鈫?鍥炰笂涓€閿欒璇嶏紱Enter 鎻愪氦锛堜腑鏂囪緭鍏ユ硶缁勫悎涓烦杩囷級
    if (fixMode === 'fix_input') {
      if (e.key === 'Space' && isLastIncorrectOf(editIdx)) { e.preventDefault(); submit(); return }
      if (e.key === 'Backspace' && (typed.split(' ')[editIdx] || '') === '') {
        e.preventDefault()
        const prev = prevIncorrectOf(editIdx)
        if (prev >= 0) { clearSlotWord(prev); setEditIdx(prev) }
        return
      }
      if (e.key === 'Enter' && !composing.current) { e.preventDefault(); submit(); return }
      return // 鍏朵綑鎸夐敭鐩存帴涓婂睆锛堝師鐢?input锛?    }
    // 瀹樻柟 useSpaceSubmitAnswer锛氳緭鍏ョ劍鐐瑰湪鏈€鍚庝竴涓瘝妲芥椂鎸夌┖鏍兼彁浜ょ瓟妗堬紙IME 缁勫悎涓烦杩囷級锛涢潪鏈瘝绌烘牸浠嶅垎璇嶈烦鏍?    if (fixMode === 'input' && e.key === ' ' && !composing.current) {
      const exp = expectWordsOf(cur)
      const lastIdx = exp.length - 1
      const parts = typed.split(' ')
      const activeText = (parts[slotState.active] || '').trim()
      if (exp.length > 0 && slotState.active === lastIdx && activeText) {
        e.preventDefault()
        submit()
        return
      }
    }
    if (e.key === 'Enter' && !composing.current && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); submit() }
  }

  // Windows Ctrl+Backspace锛氬垹闄ゅ厜鏍囧墠鐨勬暣涓笂涓€涓崟璇嶏紙瀹樻柟 deletePreviousWordOnWin 绉绘锛?  const deletePrevWordOnWin = () => {
    const el = inputRef.current
    if (!el) return
    let start = el.selectionStart ?? typed.length
    const end = el.selectionEnd ?? typed.length
    if (end === 0) return
    while (start > 0 && typed[start - 1] === ' ') start--
    const newEnd = typed.substring(0, start).lastIndexOf(' ') + 1
    const nv = typed.substring(0, newEnd)
    setTyped(nv)
    setChunks(nv.trim() ? nv.trim().split(/\s+/) : [])
    requestAnimationFrame(() => { el.setSelectionRange(newEnd, newEnd); setSlotState(s => ({ ...s, active: activeFromCursor(nv, newEnd) })) })
  }

  // 鍏ㄥ眬蹇嵎閿?  useEffect(() => {
    const h = (e) => {
      if (phase !== 'game' || paused) return
      // 涔卞簭妯″紡锛氭棤杈撳叆妗嗭紝鎷煎ソ鍚庢寜 Enter 鎻愪氦
      if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.altKey && mode === 'scramble' && !done) { e.preventDefault(); submit(); return }
      // 宸﹀彸鏂瑰悜閿垏鎹笂涓€棰?涓嬩竴棰橈紙杈撳叆妗嗚仛鐒︽椂淇濈暀鍏夋爣绉诲姩锛屼笉鍒囬锛?      if (e.key === 'ArrowLeft' && document.activeElement !== inputRef.current) { e.preventDefault(); prevQ(); return }
      if (e.key === 'ArrowRight' && document.activeElement !== inputRef.current) { e.preventDefault(); nextQ(); return }
    }
    window.addEventListener('keydown', h)
    document.addEventListener('keydown', h)
    return () => { window.removeEventListener('keydown', h); document.removeEventListener('keydown', h) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, cur, qi, mode, done, paused, undo])

  // 鈥斺€?P4 缁撶畻椤?& 鏆傚仠寮圭獥蹇嵎閿?鈥斺€?  useEffect(() => {
    const h = (e) => {
      // 缁撶畻椤碉細Enter / 绌烘牸 鈫?涓嬩竴璇?      if (phase === 'result') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          nextLesson()
        }
        return
      }
      // 鏆傚仠寮圭獥锛欵sc / 绌烘牸 鈫?缁х画娓告垙
      if (paused) {
        if (e.key === 'Escape' || e.key === ' ') {
          e.preventDefault()
          togglePause()
        }
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, paused])

  // 鈥斺€?鍙厤缃叏灞€蹇嵎閿紙璁剧疆寮圭獥鍐呭彲鏀归敭浣嶏紱杈撳叆妗嗘縺娲绘垨璁剧疆寮圭獥鎵撳紑鏃惰嚜鍔ㄧ鐢級 鈥斺€?  useEffect(() => {
    const h = (e) => {
      if (document.querySelector('.qs-mask')) return          // 璁剧疆寮圭獥鎵撳紑鏃剁鐢?      const ae = document.activeElement
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return // 鎵撳瓧鏃剁鐢?      const k = keysOfEvent(e)
      if (!k) return
      const hk = loadHotkeys()
      let act = null
      for (const id in hk) { if (hk[id] === k) { act = id; break } }
      if (!act) return
      e.preventDefault()
      const A = hotActionsRef.current
      switch (act) {
        case 'toggleSettings': setShowSettings(o => !o); break
        case 'toggleCommand': toast('鍛戒护闈㈡澘鍗冲皢涓婄嚎'); break
        case 'playSound':
          if (phase === 'game' && cur) speak(cur.s.russian)
          else toast('璇峰厛鍦ㄧ瓟棰樹腑鎾斁澹伴煶')
          break
        case 'showAnswer':
          if (phase === 'game' && cur) { if (done) toast('褰撳墠棰樺凡瀹屾垚'); else A.showAnswerNow() }
          else toast('璇峰湪绛旈涓娇鐢ㄨ蹇嵎閿?)
          break
        case 'skipQ': if (phase === 'game') nextQ(); break
        case 'prevQ': if (phase === 'game') prevQ(); break
        case 'master': toggleMastered(); break
        case 'undoMaster':
          if (mastered.includes(cur ? cur.id + '_' + qi : '')) toggleMastered()
          else toast('褰撳墠棰樻湭鏍囪鎺屾彙')
          break
        case 'addVocab': addVocab(); break
        case 'pauseGame': togglePause(); break
        case 'courseContent': setContentOpen(true); break
        case 'sentenceTree':
          if (phase === 'game') { const n = uiCfg.showStruct; setUi(o => { const nu = { ...o, showStruct: !n }; try { localStorage.setItem('rlearn_quest_ui', JSON.stringify(nu)) } catch (e) { /* 蹇界暐 */ } return nu }); toast(n ? '宸查殣钘忓彞瀛愮粨鏋? : '宸叉樉绀哄彞瀛愮粨鏋?) }
          break
        case 'toggleAI': setAiOpen(o => !o); break
        case 'wordByWord': A.playWordByWord(); break
        case 'playCurrentWord': A.playCurrentWordFn(); break
        case 'toggleSpeech':
          if (mode === 'speaking') { if (recording) A.stopRec(); else A.startRec() }
          else toast('璇峰厛鍒囨崲鍒板彛璇瘎娴嬫ā寮?)
          break
        case 'playRecording': A.playRecordingFn(); break
        case 'toggleHint':
          if (phase === 'game' && cur) { if (done) toast('褰撳墠棰樺凡瀹屾垚'); else A.showAnswerNow() }
          else toast('璇峰湪绛旈涓娇鐢ㄨ蹇嵎閿?)
          break
        case 'toggleNotes': toast('绗旇鍔熻兘鍗冲皢涓婄嚎'); break
        default: break
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, cur, mode, recording, done, qi, mastered, uiCfg.showStruct])

  const showAnswerNow = () => {
    if (done || !cur) return
    setDone(true); setShowAnswer(true); setSkipped(s => s + 1); setCombo(0)
    setAcc(a => ({ ...a, answered: a.answered + 1 }))
    if (recThreshold <= 1) recordWrong(cur, '锛堟湭浣滅瓟锛屾煡鐪嬬瓟妗堬級', '鏈綔绛?/ 璺宠繃') // 璁板綍鍒伴敊棰樻湰锛氥€屾€绘槸/閿欒1娆″悗銆嶆墠璁板綍璺宠繃
    sfxFunc()
    if (uiCfg.answerSpeak) speak(cur.s.russian)
    fetchAnalysis(cur)
  }

  // 鈥斺€?鍒囬锛堜笂涓€棰?涓嬩竴棰橈級锛屽垏鎹㈡椂鑷姩淇濆瓨瀛︿範杩涘害 鈥斺€?  const nextQ = () => {
    saveProgress()
    setDictTipVisible(false) // P5 鍒囨崲棰樼洰鏃堕噸缃惉鍐欑瓟妗堟彁绀?    if (qi + 1 >= questions.length) { runCloseLoop(); setPhase('result'); const r = ratingOf(acc); setTimeout(() => sfxRating(r.label), 260); return }
    sfxScene()
    setQi(q => q + 1)
  }
  const prevQ = () => {
    if (qi <= 0) return
    saveProgress()
    setDictTipVisible(false) // P5 鍒囨崲棰樼洰鏃堕噸缃惉鍐欑瓟妗堟彁绀?    sfxScene()
    setQi(q => q - 1)
  }

  // 鈥斺€?閿欓璁板綍锛堟湰娆＄粌涔犲唴锛屼緵缁撶畻椤甸敊棰樻湰闂幆浣跨敤锛?鈥斺€?  const recordWrong = (q, user, reason) => {
    setWrongList(w => w.some(x => x.id === q.id) ? w : [...w, { id: q.id, q, user, reason }])
  }
  const wrongReasonOf = (q, inputNorm) => {
    const expect = (q.answer || '').trim().split(/\s+/).map(cleanWord).map(normFor)
    if (!inputNorm || !inputNorm.length) return '鏈綔绛?/ 璺宠繃'
    if (inputNorm.length < expect.length) return '婕忚瘝锛堣緭鍏ヨ瘝鏁板皯浜庣瓟妗堬級'
    if (inputNorm.length > expect.length) return '澶氳瘝锛堣緭鍏ヨ瘝鏁板浜庣瓟妗堬級'
    return '鎷煎啓鎴栬瘝褰㈤敊璇?
  }

  const toggleMastered = () => {
    if (!cur) return
    const id = cur.id + '_' + qi
    const nm = mastered.includes(id) ? mastered.filter(x => x !== id) : [...mastered, id]
    setMastered(nm); localStorage.setItem('rlearn_quest_mastered', JSON.stringify(nm))
    sfxFunc()
    toast(mastered.includes(id) ? '宸插彇娑堟帉鎻? : '宸叉爣璁版帉鎻?)
  }
  const addVocab = () => {
    if (!cur) return
    const id = cur.id + '_' + qi
    const nv = vocabNote.includes(id) ? vocabNote.filter(x => x !== id) : [...vocabNote, id]
    setVocabNote(nv); localStorage.setItem('rlearn_quest_vocab', JSON.stringify(nv))
    sfxFunc()
    toast(vocabNote.includes(id) ? '宸蹭粠鐢熻瘝绉婚櫎' : '宸插姞鍏ョ敓璇?)
  }

  // 鈥斺€?閲嶇疆鏈杩涘害锛氫粠澶村紑濮嬶紙娓呰繘搴?+ 娓呴浂缁熻涓庤鏃讹級 鈥斺€?  const resetLesson = useCallback(() => {
    if (!curLesson || !window.confirm('纭畾閲嶇疆鏈杩涘害锛屼粠澶村紑濮嬪悧锛?)) return
    try { localStorage.removeItem('rlearn_quest_progress') } catch (e) { /* 蹇界暐 */ }
    setQi(0); setScore(0); setCombo(0); setMaxCombo(0); setPerfect(0); setGood(0); setSkipped(0)
    setAcc({ answered: 0, correct: 0, firstHit: 0 }); setElapsed(0); setStartAt(Date.now())
    setModeOpen(false)
    sfxScene()
    toast('鏈杩涘害宸查噸缃紝浠庡ご寮€濮?)
  }, [curLesson])

  // 鈥斺€?鍏ㄥ睆娌夋蹈妯″紡 鈥斺€?  const toggleFullscreen = () => {
    sfxFunc()
    if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}) }
    else { document.documentElement.requestFullscreen().catch(() => toast('娴忚鍣ㄤ笉鏀寔鍏ㄥ睆锛岃鎸?F11')) }
  }

  // 鈥斺€?閫€鍑哄悗鑷姩闂幆锛氶敊棰樻湰 / 鏅鸿兘澶嶄範璁″垝 / 涓汉鏁版嵁涓績 鈥斺€?  const collectCloseLoop = (lesson, wl, el, sc, ac) => {
    if (!lesson) return
    const now = Date.now()
    // 1) 鏈缁冧範閿欓鑷姩鏀跺綍杩涢敊棰樻湰锛屾爣娉ㄩ敊璇師鍥?    if (wl && wl.length) {
      let wb = []
      try { wb = JSON.parse(localStorage.getItem('rlearn_quest_wrongbook') || '[]') } catch (e) { wb = [] }
      const seen = new Set(wb.map(x => x.id))
      const fresh = wl.filter(w => !seen.has(w.id)).map(w => ({
        id: w.id, lesson: lesson.id, qText: w.q.s.russian, zh: w.q.s.chinese || '',
        user: w.user, correct: w.q.answer, reason: w.reason, ts: now,
      }))
      if (fresh.length) {
        try { localStorage.setItem('rlearn_quest_wrongbook', JSON.stringify([...fresh, ...wb].slice(0, 300))) } catch (e) {}
      }
    }
    // 2) 鏈帉鎻¤瘝姹?鍙ュ瓙 鈫?鏅鸿兘澶嶄範璁″垝锛堥仐蹇樻洸绾匡細1/2/4/7/15 澶╅€掕繘锛?    if (wl && wl.length) {
      let rv = []
      try { rv = JSON.parse(localStorage.getItem('rlearn_quest_review') || '[]') } catch (e) { rv = [] }
      const seen = new Set(rv.map(x => x.id))
      const stages = [1, 2, 4, 7, 15]
      const add = []
      for (const w of wl) {
        const s = w.q.s
        if (!s || seen.has(s.id)) continue
        add.push({ id: s.id, text: s.russian, zh: s.chinese || '', due: now + stages[0] * 86400000, stage: 0, ts: now })
      }
      if (add.length) {
        try { localStorage.setItem('rlearn_quest_review', JSON.stringify([...add, ...rv].slice(0, 500))) } catch (e) {}
      }
    }
    // 3) 瀛︿範鏃堕暱 / 绱绉垎 / 姝ｇ‘鐜?鈫?涓汉鏁版嵁涓績
    let st = { sessions: 0, time: 0, score: 0, answered: 0, correct: 0 }
    try { st = JSON.parse(localStorage.getItem('rlearn_quest_stats') || 'null') || st } catch (e) {}
    st.sessions = (st.sessions || 0) + 1
    st.time = (st.time || 0) + (el || 0)
    st.score = (st.score || 0) + (sc || 0)
    st.answered = (st.answered || 0) + ((ac && ac.answered) || 0)
    st.correct = (st.correct || 0) + ((ac && ac.correct) || 0)
    try { localStorage.setItem('rlearn_quest_stats', JSON.stringify(st)) } catch (e) {}
  }
  const runCloseLoop = () => collectCloseLoop(curLesson, wrongList, elapsed, score, acc)

  // 鈥斺€?鍐嶆潵涓€缁勶細鍚岄毦搴︺€佸悓涓婚鎷撳睍缁冧範棰?鈥斺€?  const extraGroup = async () => {
    if (!curLesson || !curLevel) return
    sfxFunc()
    const pool = poolOf(curLevel)
    const usedIds = new Set(curLesson.sentences.map(s => s.id))
    const fresh = pool.filter(s => !usedIds.has(s.id))
    if (fresh.length < 5) { toast('棰樺簱鍓╀綑鍙ュ瓙涓嶈冻锛屾棤娉曠敓鎴愭嫇灞曠粍'); return }
    const group = shuffle(fresh).slice(0, 10)
    const lesson = { id: curLesson.id + '_X' + String(Date.now()).slice(-4), idx: curLesson.idx, sentences: group }
    toast('宸茬敓鎴愬悓闅惧害鎷撳睍缁勶紝鍏?10 鍙?)
    startLesson(lesson, false)
  }
  // 鈥斺€?涓嬩竴璇撅細鐩存帴杩涘叆涓嬩竴绔犺妭 鈥斺€?  const nextLesson = () => {
    if (!curLesson || !lessons.length) return
    sfxFunc()
    const idx = lessons.findIndex(l => l.id === curLesson.id)
    const nx = lessons[idx + 1]
    if (!nx) { toast('宸茬粡鏄渶鍚庝竴璇句簡'); return }
    toast('杩涘叆涓嬩竴璇?' + nx.id)
    startLesson(nx, false)
  }

  // 鏈鍏ㄩ儴鍙ュ瓙锛堟暣鍙ラ鐨勯鍙?鈫?鍙ュ瓙锛夛紝渚涖€屾湰璇惧唴瀹广€嶅揩閫熻烦杞?  const sentenceEntries = useMemo(() => {
    const map = []
    questions.forEach((q, i) => { if (q.partIdx === q.partTotal) map.push({ qi: i, s: q.s }) })  // 璇剧▼鐩綍鍙睍绀烘暣鍙ラ
    return map
  }, [questions])

  // 鈥斺€?鍙ｈ璇勬祴锛坰peaking 妯″紡锛夛細褰曢煶 鈫?鍚庣杞啓+AI 姣斿 鈫?璇勫垎 鈥斺€?  const gradeOfPct = (pct) => pct >= 95 ? 'SSS' : pct >= 88 ? 'SS' : pct >= 80 ? 'S' : pct >= 68 ? 'A' : pct >= 50 ? 'B' : 'C'
  const scoreColor = (pct) => pct >= 80 ? '#22C55E' : pct >= 60 ? '#F59E0B' : '#EF4444'

  const runSpeakEval = async (b64) => {
    if (!cur) return
    setSpeakLoading(true); setSpeakResult(null)
    try {
      const r = await fetch((API_BASE || '') + '/api/recite-compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ standard: cur.answer, audio: 'data:audio/webm;base64,' + b64 }),
      })
      const j = await r.json()
      if (j.ok && j.result) {
        const user = (j.result.user_text || '').trim()
        const std = cur.answer.trim().split(/\s+/).map(norm)
        const usr = user.split(/\s+/).map(norm).filter(Boolean)
        let hit = 0
        usr.forEach(w => { if (std.includes(w)) hit++ })
        const pct = Math.max(0, Math.min(100, Math.round(100 * hit / Math.max(1, std.length))))
        setSpeakResult({ text: user, pct, errors: j.result.errors || [], tip: j.result.overall_tip || '' })
        if (pct >= 80 && !done) {
          // 杈炬爣瑙嗕负閫氳繃锛氳鍏ユ垚缁╁苟灞曠ず绛旀鍗?          setDone(true); setCombo(c => { const nc = c + 1; setMaxCombo(m => Math.max(m, nc)); return nc })
          setScore(s => s + 500); setPerfect(p => p + 1)
          setAcc(a => ({ ...a, answered: a.answered + 1, correct: a.correct + 1, firstHit: a.firstHit + 1 }))
          sfxPerfect()
          const p = pickPraise(); setPraise(p); speak(p)
          fetchAnalysis(cur)
        }
      } else {
        setSpeakResult({ err: j.error || '璇勫垎澶辫触锛岃閲嶈瘯' })
      }
    } catch (e) {
      setSpeakResult({ err: '缃戠粶閿欒锛? + e.message })
    } finally {
      setSpeakLoading(false)
    }
  }

  const startRec = async () => {
    if (recording) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      mediaRecRef.current = mr; recChunks.current = []
      mr.ondataavailable = e => { if (e.data && e.data.size) recChunks.current.push(e.data) }
      mr.onstop = async () => {
        try { stream.getTracks().forEach(t => t.stop()) } catch (e) { /* 蹇界暐 */ }
        const blob = new Blob(recChunks.current, { type: 'audio/webm' })
        setRecordingUrl(URL.createObjectURL(blob))
        const b64 = await new Promise((res, rej) => {
          const fr = new FileReader()
          fr.onload = () => res(String(fr.result).split(',')[1] || '')
          fr.onerror = rej
          fr.readAsDataURL(blob)
        })
        if (b64) runSpeakEval(b64)
      }
      mr.start()
      setRecording(true); setRecDur(0)
      recTimer.current = setInterval(() => setRecDur(d => d + 1), 1000)
    } catch (e) {
      toast('鏃犳硶璁块棶楹﹀厠椋庯細' + (e.message || '璇锋鏌ユ祻瑙堝櫒鏉冮檺'))
    }
  }
  const stopRec = () => {
    clearInterval(recTimer.current)
    setRecording(false)
    try { mediaRecRef.current?.stop() } catch (e) { /* 蹇界暐 */ }
  }

  // 鈥斺€?涔卞簭妯″紡锛坰cramble锛夛細鐐瑰嚮璇嶅潡閲嶇粍鍙ュ瓙 鈥斺€?  const scrambleOrder = useMemo(() => {
    if (mode !== 'scramble' || !cur) return []
    return shuffle(cur.answer.trim().split(/\s+/).map(cleanWord).map(norm))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, cur?.id])
  const pickWord = (i) => {
    if (scramblePicked.includes(i)) return
    const np = [...scramblePicked, i]
    setScramblePicked(np)
    setTyped(np.map(p => scrambleOrder[p]).join(' '))
    setWrong(false)
  }
  const unpickWord = (i) => {
    const np = scramblePicked.filter(p => p !== i)
    setScramblePicked(np)
    setTyped(np.map(p => scrambleOrder[p]).join(' '))
    setWrong(false)
  }

  // 鈥斺€?AI 鍔╂墜 鈥斺€?  const askAI = async (q0) => {
    const q = (q0 || aiQ).trim()
    if (!q || aiBusy) return
    setAiBusy(true)
    const thread = [...aiThread, { role: 'user', text: q }]
    setAiThread(thread); setAiQ('')
    const ctx = cur ? ('褰撳墠缁冧範鐨勫彞瀛愭槸锛?' + cur.s.russian + '"锛堜腑鏂囷細' + (cur.zh || cur.s.chinese) + '锛塡n') : ''
    try {
      const content = await callAI([
        { role: 'system', content: '浣犳槸淇勮鑰佸笀銆傚洖绛旇绠€娲併€佸噯纭紝鐢ㄤ腑鏂囪瑙ｏ紝鍙互缁欏嚭渚嬪彞銆傛敞鎰忥細鐢ㄦ埛鍙兘鏄湪鍋氶锛屼笉瑕佺洿鎺ョ粰鍑哄畬鏁寸瓟妗堬紝鍏堝紩瀵兼€濊€冿紝闄ら潪鐢ㄦ埛鏄庣‘瑕佹眰鐪嬬瓟妗堛€? },
        ...thread.map(t => ({ role: t.role === 'user' ? 'user' : 'assistant', content: t.text })),
      ])
      setAiThread([...thread, { role: 'assistant', text: content }])
    } catch (e) {
      setAiThread([...thread, { role: 'assistant', text: '锛圓I 鑰佸笀鏆傛椂鏃犳硶鍥炵瓟锛岃绋嶅悗鍐嶈瘯锛? }])
    } finally {
      setAiBusy(false)
    }
  }

  const quickAsk = (q) => askAI(q)

  // 绛斿鍚庨拡瀵规€ц拷闂?  const followUp = useMemo(() => {
    if (!cur) return []
    const w = cleanWord(cur.answer.split(/\s+/)[0])  // 姣忓彞璇濋兘鏄暣鍙ラ锛屽彇棣栬瘝
    const wText = stripStress(w)
    return [
      '鈥? + wText + '鈥濊繖涓瘝鍦ㄥ彞瀛愰噷璧蜂粈涔堜綔鐢紵',
      '鈥? + wText + '鈥濊繕鏈夊摢浜涘父瑙佺敤娉曪紵',
    ]
  }, [cur])

  // 鈥斺€?娓叉煋锛氳绋嬮€夋嫨锛堥珮绾ц川鎰熷晢鍩庨鏍硷級 鈥斺€?  if (phase === 'courses' || phase === 'lessons') {
    const gradients = [
      'linear-gradient(135deg,#667eea 0%,#764ba2 100%)',
      'linear-gradient(135deg,#4facfe 0%,#00f2fe 100%)',
      'linear-gradient(135deg,#43e97b 0%,#38f9d7 100%)',
      'linear-gradient(135deg,#fa709a 0%,#fee140 100%)',
    ]
    return (
      <div style={styles.coursesRoot}>
        {phase === 'courses' && (
          <>
            {/* 椤堕儴瀵艰埅鏍?*/}
            <div style={styles.mallNav}>
              <div style={styles.mallNavLeft}>
                <span style={styles.mallNavTitle}>璇剧▼鍖呭晢鍩?/span>
              </div>
              <div style={styles.mallNavTabs}>
                {['鎺ㄨ崘', '闆跺熀纭€', '鍒濈骇', '涓骇', '楂樼骇', '鍏ㄩ儴'].map((t, i) => (
                  <span key={t} className="mall-nav-tab" style={{ ...styles.mallNavTab, ...(i === 0 ? styles.mallNavTabOn : {}) }}>{t}</span>
                ))}
              </div>
              <div style={styles.mallNavSearch}>鎼滅储璇剧▼鈥?/div>
            </div>

            {/* 鍐呭鍖?*/}
            <div style={styles.mallContent}>
              {/* 鏈懆涓荤紪绮鹃€?*/}
              <div style={styles.mallSection}>
                <div style={styles.mallSectionTitle}>鏈懆涓荤紪绮鹃€?/div>
                <div style={styles.mallFeaturedGrid}>
                  {LEVELS.map((lv, i) => {
                    const m = COURSE_META[lv]
                    const pool = poolOf(lv)
                    return (
                      <div key={lv} className="mall-featured-card" style={styles.mallFeaturedCard} onClick={() => { setCurLevel(lv); setLessons(lessonsByLevel[lv]); setPhase('lessons') }}>
                        <div style={{ ...styles.mallFeaturedCover, background: gradients[i] }}>
                          <span style={styles.mallFeaturedLevel}>{lv}</span>
                          <div style={styles.mallFeaturedOverlay}>
                            <span style={styles.mallFeaturedCoverTitle}>{m.title}</span>
                          </div>
                        </div>
                        <div style={styles.mallFeaturedInfo}>
                          <div style={styles.mallFeaturedName}>{m.title}</div>
                          <div style={styles.mallFeaturedMeta}>鍙ヤ箰閮?路 {lessonsByLevel[lv].length} 璇?路 {pool.length} 鍙?/div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 鍏ㄩ儴淇勮璇剧▼ */}
              <div style={{ ...styles.mallSection, marginTop: 40 }}>
                <div style={styles.mallSectionHeader}>
                  <div style={styles.mallSectionTitle}>鍏ㄩ儴淇勮璇剧▼</div>
                  <div style={styles.mallSectionMore} className="mall-section-more">鏌ョ湅鍏ㄩ儴</div>
                </div>
                <div style={styles.mallListGrid}>
                  {LEVELS.map((lv, i) => {
                    const m = COURSE_META[lv]
                    const pool = poolOf(lv)
                    return (
                      <div key={lv} className="mall-list-card" style={styles.mallListCard} onClick={() => { setCurLevel(lv); setLessons(lessonsByLevel[lv]); setPhase('lessons') }}>
                        <div style={{ ...styles.mallListCover, background: gradients[i] }}>
                          <span style={styles.mallListLevel}>{lv}</span>
                        </div>
                        <div style={styles.mallListInfo}>
                          <div style={styles.mallListName}>{m.title}</div>
                          <div style={styles.mallListMeta}>{lessonsByLevel[lv].length} 璇?路 {pool.length} 鍙?/div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </>
        )}
        {phase === 'lessons' && (
          <>
            {/* 椤堕儴瀵艰埅 */}
            <div style={styles.detailNav}>
              <span style={styles.detailBack} onClick={() => setPhase('courses')}>鈫?/span>
              <span style={styles.detailNavTitle}>璇剧▼璇︽儏</span>
            </div>

            {/* 璇剧▼淇℃伅澶撮儴 */}
            <div style={styles.detailContent}>
              <div style={styles.detailHead}>
                <div style={{ ...styles.detailCover, background: gradients[LEVELS.indexOf(curLevel)] }}>
                  <span style={styles.detailCoverLevel}>{curLevel}</span>
                </div>
                <div style={styles.detailHeadInfo}>
                  <div style={styles.detailTitle}>{COURSE_META[curLevel]?.title}</div>
                  <div style={styles.detailDesc}>{COURSE_META[curLevel]?.desc}</div>
                  <div style={styles.detailTags}>
                    {['鍩虹', '鍙ュ瀷', '璇嶆眹', '鍙ｈ'].map(t => <span key={t} style={styles.detailTag}>{t}</span>)}
                  </div>
                  <div style={styles.detailMeta}>
                    <span style={styles.detailMetaItem}>鍙ヤ箰閮?/span>
                    <span style={styles.detailMetaDot}>路</span>
                    <span style={styles.detailMetaItem}>{lessons.length} 璇?/span>
                    <span style={styles.detailMetaDot}>路</span>
                    <span style={styles.detailMetaItem}>{poolOf(curLevel).length} 鍙?/span>
                  </div>
                </div>
                <div style={styles.detailHeadRight}>
                  <button style={styles.detailStartBtn} onClick={() => lessons.length > 0 && startLesson(lessons[0], false)}>寮€濮嬪涔?/button>
                </div>
              </div>

              {/* 鏍囩椤靛垏鎹?*/}
              <div style={styles.detailTabs}>
                <span style={{ ...styles.detailTabItem, ...(detailTab === 'route' ? styles.detailTabItemOn : {}) }} onClick={() => setDetailTab('route')}>瀛︿範璺嚎</span>
                <span style={{ ...styles.detailTabItem, ...(detailTab === 'outline' ? styles.detailTabItemOn : {}) }} onClick={() => setDetailTab('outline')}>澶х翰</span>
                <span style={styles.detailTabItem}>璇勪环</span>
              </div>

              {/* 瀛︿範璺嚎瑙嗗浘 */}
              {detailTab === 'route' && (
                <div style={styles.routeView}>
                  <div style={styles.routeHeader}>
                    <span style={styles.routeDifficulty}>瀛︿範璺嚎</span>
                    <span style={styles.routeSetting}>鈿?璺嚎璁剧疆</span>
                  </div>
                  <div style={{
                    position: 'relative',
                    padding: '40px 20px',
                    minHeight: '600px'
                  }}>
                    {lessons.map((l, i) => {
                      const isLeft = i % 2 === 0
                      const diffMap = { 1: 'easy', 2: 'easy', 3: 'easy', 4: 'medium', 5: 'medium', 6: 'medium', 7: 'medium', 8: 'hard', 9: 'hard', 10: 'medium', 11: 'hard', 12: 'medium' }
                      const diffLabel = { easy: '绠€鍗?, medium: '涓瓑', hard: '鍥伴毦' }
                      const diffColor = { easy: '#52c41a', medium: '#faad14', hard: '#ff4d4f' }
                      const diff = diffMap[i + 1] || 'easy'
                      let hasProg = false
                      let sp = null
                      try { sp = JSON.parse(localStorage.getItem('rlearn_quest_progress') || 'null'); hasProg = !!(sp && sp.lessonId === l.id) } catch (e) { hasProg = false }
                      const isLocked = i > 0 && !hasProg && !(sp && sp.completedLessons && sp.completedLessons.includes(lessons[i-1].id))
                      return (
                        <div key={l.id} style={{
                          position: 'relative',
                          display: 'flex',
                          justifyContent: isLeft ? 'flex-start' : 'flex-end',
                          marginBottom: '60px'
                        }}>
                          {/* 杩炴帴绾?*/}
                          {i > 0 && (
                            <div style={{
                              position: 'absolute',
                              top: '50%',
                              left: isLeft ? '25%' : '50%',
                              width: isLeft ? '50%' : '50%',
                              height: '3px',
                              background: hasProg ? 'linear-gradient(90deg, #7c3aed, #a78bfa)' : '#e5e7eb',
                              borderRadius: '2px',
                              transform: 'translateY(-50%)',
                              zIndex: 0
                            }} />
                          )}
                          {/* 鑺傜偣 */}
                          <div 
                            className="route-node-wrap" 
                            style={{ 
                              position: 'relative',
                              zIndex: 1,
                              textAlign: 'center',
                              cursor: isLocked ? 'not-allowed' : 'pointer'
                            }} 
                            onClick={() => !isLocked && startLesson(l, true)}
                          >
                            <div style={{
                              width: '80px',
                              height: '80px',
                              borderRadius: '50%',
                              background: hasProg ? 'linear-gradient(135deg, #7c3aed, #a78bfa)' : '#f3f4f6',
                              border: hasProg ? '3px solid #7c3aed' : '3px solid #e5e7eb',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '24px',
                              fontWeight: 700,
                              color: hasProg ? '#fff' : '#9ca3af',
                              boxShadow: hasProg ? '0 8px 24px rgba(124, 58, 237, 0.3)' : '0 2px 8px rgba(0,0,0,0.05)',
                              transition: 'all 0.3s'
                            }}>
                              {isLocked ? '馃敀' : `校${i + 1}`}
                            </div>
                            <div style={{
                              marginTop: '12px',
                              fontSize: '14px',
                              fontWeight: 600,
                              color: '#1f2937'
                            }}>校褉芯泻 {i + 1}</div>
                            <div style={{
                              fontSize: '12px',
                              color: diffColor[diff],
                              marginTop: '4px',
                              background: diff === 'easy' ? '#f6ffed' : diff === 'medium' ? '#fffbe6' : '#fff2f0',
                              padding: '2px 8px',
                              borderRadius: '10px',
                              display: 'inline-block'
                            }}>
                              {diffLabel[diff]}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* 澶х翰鍒楄〃瑙嗗浘 - 鍗＄墖缃戞牸甯冨眬 */}
              {detailTab === 'outline' && (
                <div style={styles.detailOutline}>
                  <div style={styles.detailOutlineHeader}>
                    <div style={styles.detailOutlineTitle}>澶х翰 <span style={styles.detailOutlineCount}>鍏?{lessons.length} 鍗曞厓</span></div>
                    <div style={styles.detailSortBtn}>鈬?姝ｅ簭</div>
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: '16px',
                    padding: '8px 0'
                  }}>
                    {lessons.map((l, i) => {
                      let hasProg = false
                      try { const sp = JSON.parse(localStorage.getItem('rlearn_quest_progress') || 'null'); hasProg = !!(sp && sp.lessonId === l.id) } catch (e) { hasProg = false }
                      const diffMap = { 1: 'easy', 2: 'easy', 3: 'easy', 4: 'medium', 5: 'medium', 6: 'medium', 7: 'medium', 8: 'hard', 9: 'hard', 10: 'medium', 11: 'hard', 12: 'medium' }
                      const diffLabel = { easy: '绠€鍗?, medium: '涓瓑', hard: '鍥伴毦' }
                      const diffColor = { easy: '#52c41a', medium: '#faad14', hard: '#ff4d4f' }
                      const diff = diffMap[i + 1] || 'easy'
                      return (
                        <div 
                          key={l.id} 
                          onClick={() => startLesson(l, true)}
                          style={{
                            border: hasProg ? '2px solid #7c3aed' : '1px solid #e5e7eb',
                            borderRadius: '12px',
                            padding: '20px',
                            cursor: 'pointer',
                            background: hasProg ? '#faf5ff' : '#fff',
                            transition: 'all 0.2s',
                            boxShadow: hasProg ? '0 4px 12px rgba(124, 58, 237, 0.15)' : '0 1px 3px rgba(0,0,0,0.05)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)'
                            e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.1)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)'
                            e.currentTarget.style.boxShadow = hasProg ? '0 4px 12px rgba(124, 58, 237, 0.15)' : '0 1px 3px rgba(0,0,0,0.05)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                            <div style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937' }}>校褉芯泻 {i + 1}</div>
                            <div style={{ 
                              fontSize: '11px', 
                              color: diffColor[diff], 
                              background: diff === 'easy' ? '#f6ffed' : diff === 'medium' ? '#fffbe6' : '#fff2f0',
                              padding: '2px 8px',
                              borderRadius: '10px',
                              fontWeight: 500
                            }}>
                              {diffLabel[diff]}
                            </div>
                          </div>
                          <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '8px' }}>A1鍩虹鍙ュ瓙瀛︿範</div>
                          <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                            {l.words || 0} 姝?路 {l.duration || '10:00'}
                          </div>
                          {hasProg && (
                            <div style={{ 
                              marginTop: '12px', 
                              fontSize: '12px', 
                              color: '#7c3aed', 
                              fontWeight: 500 
                            }}>
                              缁х画瀛︿範 鈫?                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    )
  }

  // 鈥斺€?娓叉煋锛氶槄璇绘ā寮忛涔狅紙鍏ㄦ枃閫氳 + 閫愬彞璺熻锛?鈥斺€?  if (phase === 'preview') {
    const Tp = THEMES[uiCfg.theme]
    return (
      <div style={{ ...styles.previewRoot, background: Tp.grad, color: Tp.text, fontFamily: FONT_STACK[uiCfg.font], ...(bgImageStyle || {}) }}>
        <div style={{ ...styles.previewCard, background: Tp.panel, borderColor: Tp.border, boxShadow: Tp.shadow }}>
          <div style={{ ...styles.previewTitle, color: Tp.textStrong }}>{COURSE_META[curLevel]?.title} 路 闃呰棰勪範</div>
          <div style={{ ...styles.previewSub, color: Tp.sub }}>鍏堥€氳鍏ㄦ枃锛岀偣鍑?馃攰 閫愬彞璺熻锛岀啛鎮夊悗鍐嶈繘鍏ユ墦瀛楃瓟棰?/div>
          <div style={styles.previewList}>
            {curLesson?.sentences?.map((s, i) => (
              <div key={i} style={{ ...styles.previewLine, borderColor: Tp.border, background: Tp.bgSoft }}>
                <span style={{ ...styles.previewNo, color: Tp.sub }}>{i + 1}</span>
                <div style={styles.previewBody}>
                  <div style={{ ...styles.previewRu, color: Tp.textStrong }}>{s.russian}</div>
                  <div style={{ ...styles.previewZh, color: Tp.sub }}>{s.chinese}</div>
                </div>
                <button style={{ ...styles.previewPlay, color: Tp.brand, borderColor: Tp.brand, background: Tp.brandSoft }} onClick={() => speak(s.russian)}>馃攰</button>
              </div>
            ))}
          </div>
          <div style={styles.previewFoot}>
            <button style={{ ...styles.previewBack, color: Tp.sub, borderColor: Tp.border, background: 'transparent' }} onClick={() => setPhase('lessons')}>杩斿洖璇捐〃</button>
            <button style={{ ...styles.previewStart, background: Tp.brand, color: '#fff' }} onClick={() => setPhase('game')}>寮€濮嬬粌涔?鈫?/button>
          </div>
        </div>
      </div>
    )
  }

  // 鈥斺€?娓叉煋锛氬姞杞介〉 鈥斺€?  if (phase === 'loading') {
    return (
      <div style={styles.loadRoot}>
        <img src="/logo.png" style={styles.loadLogo} alt="Russian Learning" />
        <div style={styles.loadTip}>" 鎯崇湅淇勮璇嶆€х缉鍐欙紵鐐瑰嚮 鈿?璁剧疆 鈫?瀛︿範 鈫?鍒囨崲鏍囩鏍峰紡 "</div>
        <div style={styles.loadBottom}>
          <span style={styles.loadText}>LOADING</span>
          <span style={styles.loadPct}>{loadPct}%</span>
        </div>
        <div style={styles.loadBar}>
          <div style={{ ...styles.loadFill, width: loadPct + '%' }} />
        </div>
      </div>
    )
  }

  // 鈥斺€?娓叉煋锛氱粨绠楋紙P4 SummaryModal锛氳瘎绾?鐜舰鍥?閿欓+鎾掕姳+姣忔棩涓€鍙ワ級 鈥斺€?  if (phase === 'result') {
    const T = THEMES[uiCfg.theme]
    const isDark = uiCfg.themeMode === 'dark' || uiCfg.theme === 'dark'
    return (
      <div style={{
        minHeight: '100vh', background: T.grad,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <SummaryModal
          visible={true}
          acc={acc}
          score={score}
          elapsed={elapsed}
          maxCombo={maxCombo}
          totalQuestions={questions.length}
          totalSentences={curLesson?.sentences?.length || 0}
          wrongList={wrongList}
          lessonTitle={curLesson?.title || (curLesson?.sentences?.[0]?.source) || '鏈缁冧範'}
          onClose={() => { setPhase('lessons'); setResultWrong(false) }}
          onDoAgain={() => startLesson(curLesson, false)}
          onExtraGroup={extraGroup}
          onNextLesson={nextLesson}
          onGoCourseList={() => { setPhase('lessons'); setResultWrong(false) }}
          onShare={() => toast('馃摳 鎵撳崱鍒嗕韩鍥惧姛鑳藉紑鍙戜腑锛屾暚璇锋湡寰咃紒')}
          theme={T}
          dark={isDark}
        />
      </div>
    )
  }

  // 鈥斺€?娓叉煋锛氱瓟棰橀〉 鈥斺€?  if (!cur) return null
  const T = THEMES[uiCfg.theme]
  const expectChunks = cur.answer.trim().split(/\s+/).map(cleanWord).map(normFor)
  // 杈撳叆妗嗕笁鏍峰紡锛堝姩鎬佸搴﹂粯璁?/ 鍥哄畾绛夊 / 鏋佺畝妯嚎锛? 鐘舵€佽壊锛堜贡搴忔ā寮忚瘝鍧楃敤锛?  const chipBoxStyle = (i, ok) => {
    const base = { ...styles.wordChip, fontSize: S_WORD[uiCfg.sSize], transition: 'all .45s ease' }
    if (uiCfg.inputStyle === 'fixed') { base.minWidth = 96; base.display = 'inline-flex'; base.alignItems = 'center'; base.justifyContent = 'center'; base.flex = '0 0 96px' }
    if (uiCfg.inputStyle === 'underline') { base.background = 'transparent'; base.border = 'none'; base.borderBottom = '2px solid ' + T.border; base.borderRadius = 0; base.padding = '4px 6px 2px' }
    if (done) Object.assign(base, { color: T.sub, borderColor: T.ok, background: uiCfg.inputStyle === 'underline' ? 'transparent' : T.okSoft })
    else if (wrong && !ok) Object.assign(base, { color: T.err, borderColor: T.err, background: uiCfg.inputStyle === 'underline' ? 'transparent' : T.errSoft })
    else if (ok) Object.assign(base, { color: T.brand, borderColor: T.brand, background: uiCfg.inputStyle === 'underline' ? 'transparent' : T.brandSoft })
    else Object.assign(base, { color: T.textStrong, borderColor: T.border, background: uiCfg.inputStyle === 'underline' ? 'transparent' : '#FFFFFF' })
    return base
  }

  return (
    <div style={{ ...styles.gameRoot, fontFamily: FONT_STACK[uiCfg.font], background: '#ffffff', color: '#3A3A3A' }}>
      <style>{`
        @keyframes ruqShake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-5px)} 80%{transform:translateX(5px)} }
        @keyframes ruqGrad { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
        @keyframes ruqFadeUp { from{opacity:0; transform:translateY(14px)} to{opacity:1; transform:translateY(0)} }
        @keyframes ruqPop { 0%{transform:scale(.92); opacity:0} 60%{transform:scale(1.03)} 100%{transform:scale(1); opacity:1} }
        @keyframes ruqPulse { 0%,100%{opacity:1; transform:scale(1)} 50%{opacity:.65; transform:scale(.97)} }
        @keyframes ruqComboPop { 0%{transform:translateX(-50%) scale(1.5); opacity:0} 25%{transform:translateX(-50%) scale(1.04); opacity:1} 100%{transform:translateX(-50%) scale(1) translateY(-46px); opacity:0} }
        @keyframes ruqFlash { 0%{opacity:0} 30%{opacity:1} 100%{opacity:0} }
        @keyframes ruqBreak { 0%{opacity:.85; transform:translateX(-50%) scale(1)} 100%{opacity:0; transform:translateX(-50%) scale(.92) translateY(14px)} }
        @keyframes ruqFadeIn { from{opacity:0; transform:translateY(10px)} to{opacity:1; transform:translateY(0)} }
        .ruq-aw:hover{color:#d946ef !important}
        .ruq-as:hover{color:#d946ef !important}
        .ruq-awbtn:hover{background:#f3f4f6; border-color:#9ca3af; color:#374151}
        .ruq-toolbtn:hover{color:#d946ef !important}
        .ruq-mobbar{display:none}
        @media (max-width:768px){.ruq-mobbar{display:flex}}
      `}</style>
      {/* 椤堕儴宸ュ叿鏍忥紙瀵归綈 Earthworm Tool.vue锛夛細宸︿晶杩斿洖+璇剧▼鍚?杩涘害)+瀛︿範瑙嗛閾炬帴锛涘彸渚?4 甯搁┗鍥炬爣 + 婧㈠嚭鑿滃崟 */}
      <div style={styles.topBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="ruq-toolbtn" style={styles.toolIconBtn} onClick={() => { sfxScene(); setPhase('lessons') }} title="杩斿洖璇剧▼鍒楄〃">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <span style={styles.topCourse}>{curLesson?.sentences[0]?.source || COURSE_META[curLevel]?.title}</span>
          <span style={styles.topProgressText}>{(qi + 1)} / {questions.length}</span>
          <button className="ruq-toolbtn" style={styles.studyVideoLink} onClick={playCur} title="鎾斁褰撳墠鍙ュ彂闊?>鈻?瀛︿範瑙嗛</button>
          <LearningTimer
            elapsed={elapsed}
            paused={paused}
            active={phase === 'game' && !done}
            theme={T}
            dark={uiCfg.themeMode === 'dark' || uiCfg.theme === 'dark'}
            showToday={false}
            compact={true}
          />
        </div>
        <div style={styles.topRight}>
          {mode === 'dictation' && (
            <button className="ruq-toolbtn" style={styles.toolIconBtn} title="娓告垙璁剧疆锛氬€嶉€?鎾斁娆℃暟/闂撮殧锛堝惉鍐欐ā寮忥級" onClick={() => { sfxFunc(); setGameSettingOpen(true) }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
          )}
          <button className="ruq-toolbtn" style={styles.toolIconBtn} title={paused ? '缁х画缁冧範' : '鏆傚仠缁冧範'} onClick={togglePause}>
            {paused
              ? <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              : <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1.5"/><rect x="14" y="5" width="4" height="14" rx="1.5"/></svg>}
          </button>
          <button className="ruq-toolbtn" style={styles.toolIconBtn} title="閲嶇疆鏈杩涘害锛屼粠澶村紑濮? onClick={resetLesson}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>
          </button>
          <button className="ruq-toolbtn" style={styles.toolIconBtn} title="鎺掕姒滐紙寮€鍙戜腑锛? onClick={() => toast('鎺掕姒滃姛鑳藉嵆灏嗕笂绾?)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4a1 1 0 0 0-1 1c0 2 1.5 3 3 3M17 6h3a1 1 0 0 1 1 1c0 2-1.5 3-3 3"/></svg>
          </button>
          {/* 婧㈠嚭鑿滃崟锛氫繚鐣欐ā寮忓垏鎹?鏈鍐呭/閿欓鏈?瀹犵墿/澶栬/鍏ㄥ睆/璁剧疆绛夋墿灞曞姛鑳藉叆鍙?*/}
          <div style={{ position: 'relative' }}>
            <button className="ruq-toolbtn" style={styles.toolIconBtn} title="鏇村鍔熻兘" onClick={() => setMoreOpen(o => !o)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>
            </button>
            {moreOpen && (
              <div style={styles.overflowPop}>
                <div style={{ ...styles.overflowItem, color: '#94a3b8', fontSize: 11, padding: '4px 12px', cursor: 'default' }}>鍒囨崲缁冧範妯″紡</div>
                {MODES.map(m => (
                  <div key={m.key} style={{ ...styles.overflowItem, ...(mode === m.key ? styles.overflowItemOn : {}) }} onClick={() => { if (m.key !== mode) { setMode(m.key); try { localStorage.setItem('rlearn_quest_mode', m.key) } catch (e) { /* 蹇界暐 */ } toast('宸插垏鎹細' + m.name + '锛堣繘搴﹀凡淇濈暀锛?) } setMoreOpen(false) }}>
                    {m.name}{m.key === mode && ' 鉁?}
                  </div>
                ))}
                <div style={{ height: 1, background: '#e2e8f0', margin: '6px 0' }} />
                <div style={styles.overflowItem} onClick={() => { setMoreOpen(false); sfxFunc(); setContentOpen(true) }}>馃摉 鏈鍐呭</div>
                <div style={styles.overflowItem} onClick={() => { setMoreOpen(false); sfxFunc(); setWrongBookOpen(true) }}>馃摃 閿欓鏈?/div>
                <div style={styles.overflowItem} onClick={() => { setMoreOpen(false); sfxFunc(); setPetVisible(v => !v) }}>{petVisible ? '馃惐 闅愯棌瀹犵墿' : '馃惥 鏄剧ず瀹犵墿'}</div>
                <div style={styles.overflowItem} onClick={() => { setMoreOpen(false); setUiOpen(o => !o) }}>Aa 澶栬璁剧疆</div>
                <div style={styles.overflowItem} onClick={() => { setMoreOpen(false); toggleFullscreen() }}>鉀?鍏ㄥ睆</div>
                <div style={styles.overflowItem} onClick={() => { setMoreOpen(false); sfxFunc(); setShowSettings(true) }}>鈿?璁剧疆</div>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* 閫氬杩涘害鏉★紙瀵归綈 Earthworm CommonProgressBar h-6锛夛細鐧惧垎姣?= 褰撳墠棰樺簭/鎬婚鏁?*/}
      <div style={styles.progressBarFull}>
        <div style={{ ...styles.progressBarFill, width: Math.max(2, Math.round(100 * (qi + 1) / questions.length)) + '%' }} />
      </div>

      <div style={styles.gameMain}>
        {/* 涓ぎ棰樼洰鍖猴紙鍒囬鏃舵瀬绠€娣″叆锛屾棤闂儊锛?*/}
        <div key={qi} style={{ ...styles.center, animation: 'ruqFadeIn .3s ease' }} onClick={() => inputRef.current?.focus()}>
          {done && (
            <div style={{ ...styles.praise, ...(combo >= 2 ? { background: 'linear-gradient(90deg,' + T.brand + ',' + T.ok + ',' + T.brand + ')', backgroundSize: '200% auto', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', animation: 'ruqGrad 1.6s linear infinite' } : { color: T.ok }) }}>{praise}</div>
          )}
          {!done && (mode === 'dictation'
            ? <>
                <div style={{ ...styles.dictHint, fontSize: Q_SIZE[uiCfg.qSize], color: T.brand }}>馃帶 鍚啓 路 璇峰惉闊虫嫾鍐?/div>
                {/* P5 鍚啓妯″紡鎾斁鎺у埗鏍忥細鐩插惉(姝ｅ父閫? 鈫?鎱㈠惉(0.5x) 鈫?鏄剧ず绛旀鎻愮ず */}
                <DictationControls
                  text={cur.s.russian}
                  onPlay={(t, rate) => speak(t, rate)}
                  onToggleTip={() => setDictTipVisible(v => !v)}
                  showTip={dictTipVisible}
                  theme={T}
                  dark={uiCfg.themeMode === 'dark' || uiCfg.theme === 'dark'}
                />
                {/* 绛旀鎻愮ず娴眰锛堝榻愬畼鏂?AnswerTip.vue锛?*/}
                {dictTipVisible && (
                  <div style={{
                    position: 'relative', margin: '0 auto 20px', maxWidth: 600,
                    padding: '14px 22px', borderRadius: 14,
                    background: T.panel, border: '1px solid ' + T.brand,
                    boxShadow: '0 8px 24px rgba(0,0,0,.15)',
                    animation: 'ruqPop .25s ease',
                  }}>
                    <button onClick={() => setDictTipVisible(false)} style={{
                      position: 'absolute', right: 8, top: 8, width: 26, height: 26,
                      borderRadius: 6, border: 'none', background: T.bgSoft, color: T.sub,
                      cursor: 'pointer', fontSize: 14,
                    }}>鉁?/button>
                    <div style={{ fontSize: 18, fontWeight: 700, color: T.text, textAlign: 'center', paddingRight: 20 }}>{cur.s.russian}</div>
                    {cur.s.soundmark && <div style={{ fontSize: 13, color: T.sub, textAlign: 'center', marginTop: 4 }}>{cur.s.soundmark}</div>}
                  </div>
                )}
              </>
            : <>
              {/* 娓愯繘寮忛樁娈垫爣绛撅細閫愯瘝 / 鍓嶇紑绱姞 / 鏁村彞 */}
              {!cur.full ? (
                <div style={{ fontSize: 13, color: T.sub, marginBottom: 6, letterSpacing: 1 }}>馃摑 閫愯瘝缁冧範 路 绗?{cur.partIdx} / {cur.partTotal} 璇?/div>
              ) : cur.partIdx < cur.partTotal ? (
                <div style={{ fontSize: 13, color: T.brand, marginBottom: 6, letterSpacing: 1 }}>馃敆 鍓嶇紑绱姞 路 鍓?{cur.partIdx} 璇嶇粍鍚?/div>
              ) : (
                <div style={{ fontSize: 13, color: T.ok, marginBottom: 6, letterSpacing: 1 }}>鉁?鏁村彞杩炶瘝閫犲彞</div>
              )}
              <div style={{ ...styles.zhText, fontSize: Q_SIZE[uiCfg.qSize], color: T.text, fontWeight: 500 }}>{cur.zh}</div>
            </>)}
          {done ? (
            /* 绛旀鏄剧ず锛氱瓟棰樺眳涓尯鍐呭師鍦版浛鎹㈡覆鏌擄紙瀵归綈 Earthworm Answer.vue锛氭棤鍏ㄥ睆閬僵/鍗＄墖锛?*/
            <div style={{ animation: 'ruqFadeUp .35s ease', textAlign: 'center' }}>
              {/* 瀹樻柟锛氭暣鍙ラ€愯瘝澶у瓧鍙峰睍绀猴紙text-5xl=48px锛実ap-1=4px锛夛紝鐐瑰嚮鍗曡瘝鍙戦煶锛涘彸渚ф暣鍙ュ彂闊冲枃鍙?*/}
              <div style={styles.answerWords}>
                {cur.answer.trim().split(/\s+/).map((w, i) => (
                  <span key={i} className="ruq-aw" style={styles.answerWord} onClick={() => speak(w)} title="鐐瑰嚮鍙戦煶">{w}</span>
                ))}
                <span className="ruq-as" style={styles.answerSpeaker} onClick={() => speak(cur.s.russian)} title="鏁村彞鍙戦煶">馃攰</span>
              </div>
              {cur.s.soundmark && <div style={styles.answerSoundmark}>{cur.s.soundmark}</div>}
              <div style={styles.answerZhLine}>{cur.zh || cur.s.chinese}</div>
              <div style={styles.answerBtns}>
                <button className="ruq-awbtn" style={styles.answerBtn} onClick={() => loadQuestion(qi)}>鍐嶆潵涓€娆?/button>
                <button className="ruq-awbtn" style={styles.answerBtnMain} onClick={nextQ}>{qi + 1 >= questions.length ? '瀹屾垚鏈 鈫? : '涓嬩竴棰?鈫?}</button>
              </div>
              {/* 淇濈暀锛欰I 閫愯瘝鎷嗚В锛堣瘝鎬?璇硶鎴愬垎/閲婁箟锛屼縿璇墿灞曞姛鑳斤級 */}
              {analysis?.roles ? (
                <div style={styles.rolesRow}>
                  {analysis.roles.map((r, ri) => (
                    <div key={ri} style={styles.roleCol}>
                      <div style={{ ...styles.roleName, color: T.brand, background: T.brandSoft }}>{r.role}</div>
                      {r.words.map((w, wi) => (
                        <div key={wi} style={styles.roleWordWrap}>
                          <div style={{ ...styles.roleWord, fontSize: S_ROLE[uiCfg.sSize], color: T.textStrong }}>{stripStress(w.word)}</div>
                          <div style={{ ...styles.roleStress, fontSize: AUX_SIZE[uiCfg.qSize] - 1, color: T.sub }}>{w.stress || w.word}</div>
                          {uiCfg.posMark ? (
                            <div style={{ ...styles.rolePos, fontSize: AUX_SIZE[uiCfg.qSize], color: posColor(w.pos), borderBottom: '2px solid ' + posColor(w.pos) }}>{w.pos}</div>
                          ) : <div style={styles.rolePosHidden} />}
                          <div style={{ ...styles.roleZh, fontSize: AUX_SIZE[uiCfg.qSize] + 2, color: T.text }}>{w.zh}</div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : analysis?.err ? (
                <div style={styles.answerFallback}>
                  <div style={{ ...styles.answerErr, fontSize: AUX_SIZE[uiCfg.qSize], color: T.sub }}>AI 鎷嗚В澶辫触锛岀偣鍑?<span style={{ ...styles.retry, color: T.brand }} onClick={() => fetchAnalysis(cur)}>閲嶈瘯</span></div>
                </div>
              ) : analysing && (
                <div style={{ ...styles.answerErr, fontSize: AUX_SIZE[uiCfg.qSize], color: T.sub }}>姝ｅ湪瑙ｆ瀽鈥?/div>
              )}
            </div>
          ) : mode === 'speaking' ? (
            /* 鍙ｈ璇勬祴妯″紡锛氬厛鍚師鍙?鈫?璺熻褰曢煶 鈫?AI 瀹炴椂璇勫垎 */
            <div style={styles.speakWrap}>
              <div style={{ ...styles.speakTip, fontSize: S_WORD[uiCfg.sSize], color: T.text }}>鍏堝惉鏍囧噯鍙戦煶锛屽啀璺熻褰曢煶</div>
              <div style={styles.speakBtns}>
                <button style={{ ...styles.speakBtn, color: T.text, borderColor: T.border, background: T.bgSoft }} onClick={playCur}>馃攰 鍚師鍙?/button>
                {recording
                  ? <button style={{ ...styles.speakBtnRec, background: T.err }} onClick={stopRec}>鈴?鍋滄褰曢煶 {recDur}s</button>
                  : <button style={{ ...styles.speakBtnMain, background: T.brand, color: '#fff' }} onClick={startRec}>馃帣 寮€濮嬪綍闊?/button>}
              </div>
              {speakLoading && <div style={{ ...styles.speakLoading, color: T.sub }}>AI 璇勬祴涓€?/div>}
              {speakResult && (
                <div style={{ ...styles.speakCard, background: T.panel, borderColor: T.border, boxShadow: T.shadow }}>
                  {speakResult.err ? (
                    <div style={{ ...styles.speakErr, color: T.err }}>{speakResult.err}</div>
                  ) : (
                    <>
                      <div style={styles.speakScoreRow}>
                        <span style={{ fontSize: 44, fontWeight: 800, color: scoreColor(speakResult.pct) }}>{speakResult.pct}</span>
                        <span style={{ color: T.sub }}>/100</span>
                        <span style={{ ...styles.speakGrade, color: scoreColor(speakResult.pct) }}>{gradeOfPct(speakResult.pct)}</span>
                      </div>
                      <div style={{ ...styles.speakText, color: T.textStrong }}>璇嗗埆锛歿speakResult.text || '锛堟湭璇嗗埆鍒板唴瀹癸紝璇峰啀璇曚竴娆★級'}</div>
                      {speakResult.errors && speakResult.errors.length > 0 && (
                        <div style={{ ...styles.speakErrors, color: T.err }}>
                          {speakResult.errors.map((e, i) => (
                            <div key={i}>鉁?{e.original || e.user} 鈫?{e.correct_reading || e.suggestion || ''}</div>
                          ))}
                        </div>
                      )}
                      {speakResult.tip && <div style={{ ...styles.speakTip2, color: T.sub }}>{speakResult.tip}</div>}
                    </>
                  )}
                </div>
              )}
            </div>
          ) : mode === 'scramble' ? (
            /* 涔卞簭妯″紡锛氱偣鍑昏瘝鍧楁寜椤哄簭閲嶇粍鍙ュ瓙锛堜篃鍙洿鎺ラ敭鐩樿緭鍏ワ級 */
            <div style={styles.scrambleWrap}>
              <input ref={inputRef} readOnly tabIndex={-1} style={styles.scrambleHiddenInput} onKeyDown={onInputKey} autoFocus aria-hidden="true" />
              <div style={{ ...styles.wordRow, ...(wrong ? { animation: 'ruqShake .4s ease' } : {}) }}>
                {scramblePicked.map((pi, idx) => (
                  <span key={idx} style={chipBoxStyle(idx, true)} onClick={() => unpickWord(pi)} title="鐐瑰嚮鎾ら攢">
                    {scrambleOrder[pi]}
                  </span>
                ))}
                {scramblePicked.length === 0 && <span style={{ ...styles.wordPlaceholder, color: T.sub, fontSize: S_WORD[uiCfg.sSize] }}>鐐瑰嚮涓嬫柟鍗曡瘝鎸夐『搴忕粍鎴愬彞瀛?/span>}
              </div>
              <div style={styles.scramblePool}>
                {scrambleOrder.map((w, i) => scramblePicked.includes(i) ? null : (
                  <span key={i} style={{ ...styles.scrambleChip, color: T.textStrong, borderColor: T.border, background: T.bgSoft }} onClick={() => pickWord(i)}>{w}</span>
                ))}
                {scramblePicked.length === scrambleOrder.length && scrambleOrder.length > 0 && <div style={{ ...styles.scrambleDone, color: T.sub }}>鍙ュ瓙宸叉嫾濂斤紝鎸?Enter 鎻愪氦</div>}
              </div>
            </div>
          ) : (
            <>
              {/* 瀹樻柟杩炶瘝鎴愬彞锛氬崟璇嶄笅鍒掔嚎妲斤紙QuestionInput.vue 1:1锛氭Ы 64px / 瀛楀彿 48px / 婵€娲绘暣璇?#d946ef / 閿欒鏁磋瘝 red+shake(浠協ix妯″紡) / 榛樿 #20202099锛涙爣鐐圭洿鎺ユ樉绀烘棤妲斤級 */}
              <div ref={inputRowRef} style={styles.slotRow}>
                {expectChunks.map((text, i) => {
                  const userInput = typed.split(' ')[i] !== undefined ? typed.split(' ')[i] : ''
                  const editing = fixMode === 'fix_input' && i === editIdx
                  const incorrect = !editing && slotState.incorrect.includes(i)
                  const active = fixMode === 'input' && slotState.active === i
                  const isWordChunk = /[a-zA-Z邪-褟袗-携褢衼0-9]/.test(text || '') // 瀹樻柟 isWord锛堜縿璇墿灞曡タ閲屽皵锛?                  // 瀹樻柟涓夋€佽瘝绾ч珮浜紙getWordsClassNames锛?                  let col = '#20202099', bcol = '#D1D5DB'
                  if (incorrect) { col = '#EF4444'; bcol = '#EF4444' }
                  else if (active) { col = '#d946ef'; bcol = '#d946ef' }
                  // 瀹樻柟锛氶粯璁ゅ浐瀹?4ch锛坕sShowWordsWidth 鍏抽棴鏃讹級锛屼笉鎸夎瘝闀垮姩鎬佽绠楋紱澶栬銆屽浐瀹氱瓑瀹姐€嶄粛淇濈暀 96px
                  const slotW = uiCfg.inputStyle === 'fixed' ? 96 : 4
                  if (!isWordChunk) {
                    // 瀹樻柟锛氶潪璇嶏紙鏍囩偣锛夋棤涓嬪垝绾挎Ы锛岀洿鎺ユ樉绀猴紝鍚岄珮 64px
                    return <div key={i} style={{ ...styles.slotPunct, fontSize: 48, color: '#20202099' }}>{text}</div>
                  }
                  return (
                    <div key={i} style={{ ...styles.slotBox, minWidth: slotW + 'ch', borderBottom: '2px solid ' + bcol, fontSize: 48, color: col, ...(incorrect && fixMode !== 'input' ? { animation: 'ruqShake .3s ease' } : {}) }}>
                      {userInput}
                    </div>
                  )
                })}
                {/* 瀹樻柟閫忔槑杈撳叆妗嗭細瑕嗙洊鏁翠釜璇嶈锛岀偣鍑?鍏夋爣瀹氫綅婵€娲昏瘝锛涘弻鍑讳笌榧犳爣鎸変笅鎸夊畼鏂逛粎鑱氱劍涓嶇Щ鍔ㄥ厜鏍?*/}
                <input
                  ref={inputRef}
                  value={typed}
                  onChange={onInputChange}
                  onKeyDown={onInputKey}
                  onCompositionStart={() => { composing.current = true }}
                  onCompositionEnd={() => { composing.current = false }}
                  onSelect={e => { const pos = e.target.selectionStart ?? typed.length; setSlotState(s => ({ ...s, active: activeFromCursor(typed, pos) })) }}
                  onFocus={() => { const pos = inputRef.current?.selectionStart ?? typed.length; setSlotState(s => ({ ...s, active: activeFromCursor(typed, pos) })) }}
                  onDoubleClick={e => e.preventDefault()}
                  onMouseDown={e => { e.preventDefault(); inputRef.current?.focus() }}
                  style={styles.slotInput}
                  lang="ru"
                  autoComplete="off" autoCorrect="off" spellCheck={false}
                />
              </div>
              <div style={{ ...styles.inputHint, fontSize: AUX_SIZE[uiCfg.qSize], color: T.sub }}>
                {fixMode === 'fix' ? '閮ㄥ垎鍗曡瘝鏈夎 鈥?鐩存帴杈撳叆瀛楁瘝淇敼绗竴涓孩鑹插崟璇? : fixMode === 'fix_input' ? '姝ｅ湪淇敼閿欒鍗曡瘝 路 绌烘牸璺冲埌涓嬩竴涓?路 Enter 鎻愪氦' : '鐩存帴鍦ㄤ笅鏂硅緭鍏?路 绌烘牸鍒嗛殧鍗曡瘝 路 Enter 鎻愪氦'}
              </div>
              {/* 绉诲姩绔寜閽粍锛堜粎灏忓睆鏄剧ず锛屽榻?Earthworm QuestionInput md:hidden锛夛細鎻愪氦/鏄剧ず绛旀/鎾斁澹伴煶/鎺屾彙 */}
              <div className="ruq-mobbar" style={styles.mobBar}>
                {!done && <button style={styles.mobBtnMain} onClick={submit}>鎻愪氦</button>}
                {!done && <button style={styles.mobBtn} onClick={showAnswerNow}>鏄剧ず绛旀</button>}
                <button style={styles.mobBtn} onClick={playCur}>馃攰 鎾斁</button>
                <button style={styles.mobBtn} onClick={toggleMastered}>鉁?鎺屾彙</button>
                {done && <button style={styles.mobBtnMain} onClick={nextQ}>{qi + 1 >= questions.length ? '瀹屾垚鏈' : '涓嬩竴棰?}</button>}
              </div>
              {wrong && fixMode === 'input' && <div style={{ ...styles.wrongTip, fontSize: AUX_SIZE[uiCfg.qSize] + 3, color: T.err }}>鍐嶈瘯涓€娆?/div>}
              {stuckOpen && (
                <div style={{ ...styles.stuckBox, background: T.brandSoft, borderColor: T.brand }}>
                  <div style={{ ...styles.stuckTitle, color: T.brand }}>鍗′綇浜嗗悧锛?/div>
                  <div style={{ ...styles.stuckText, color: T.sub }}>杩欓宸茬粡杩炵画閿欎簡 3 娆★紝鎴戝彲浠ュ厛缁欎竴鐐规彁绀恒€?/div>
                  <div style={styles.stuckBtns}>
                    <button style={{ ...styles.stuckNo, color: T.sub, borderColor: T.border }} onClick={() => setStuckOpen(false)}>杩欓涓嶇敤</button>
                    <button style={{ ...styles.stuckYes, background: T.brand }} onClick={() => { setStuckOpen(false); quickAsk('杩欓亾棰樻垜搴旇浠庡摢閲屽叆鎵嬶紵璇峰厛缁欎竴涓彁绀猴紝涓嶈鐩存帴缁欏畬鏁寸瓟妗堛€?) }}>甯垜鐪嬬湅</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 杩炲嚮鍔ㄦ晥锛歅erfect 脳 N 娴姩鏂囧瓧锛?-9 鍩虹 / 10+ 楂樹寒鍙戝厜+鍏ㄥ睆闂晥锛?*/}
      {comboPop && (
        <div key={'cp' + comboPop.n} style={{ ...styles.comboPop, color: T.brand, ...(comboPop.high ? { textShadow: '0 0 16px ' + T.brand + ', 0 0 44px ' + T.brand } : {}) }}>
          Perfect 脳 {comboPop.n}
        </div>
      )}
      {comboPop?.high && <div key={'cf' + comboPop.n} style={{ ...styles.comboFlash, background: 'radial-gradient(circle at 50% 40%, rgba(255,255,255,.5), rgba(255,255,255,0) 62%)' }} />}
      {comboBreak && <div key={'cb' + Date.now()} style={styles.comboBreak}>杩炲嚮涓柇</div>}

      {/* P4 鏆傚仠寮圭獥锛堝榻愬畼鏂?GamePauseModal.vue锛氶殢鏈洪紦鍔辫 + 缁х画娓告垙锛?*/}
      <GamePauseModal
        visible={paused}
        elapsed={elapsed}
        currentQi={qi}
        totalQuestions={questions.length}
        onResume={togglePause}
        onGoCourseList={() => { if (paused) { setStartAt(Date.now() - elapsed * 1000); setPaused(false) } setPhase('lessons') }}
        theme={T}
        dark={uiCfg.themeMode === 'dark' || uiCfg.theme === 'dark'}
      />

      {/* AI 鍔╂墜锛氬彸涓嬭鎮诞鍥炬爣鍞よ捣锛堥粯璁ゆ敹璧凤紝涓嶉伄鎸＄瓟棰樺尯锛涘睍寮€鍚庤嚜鍔ㄨ瘑鍒綋鍓嶅彞瀛愶級 */}
      <div style={{ ...styles.aiPanel, background: T.aiBg, borderLeft: '1px solid ' + T.aiBorder, ...(aiOpen ? { transform: 'translateX(0)' } : { transform: 'translateX(102%)', pointerEvents: 'none' }) }}>
        <div style={{ ...styles.aiHead, color: T.text, borderBottom: '1px solid ' + T.aiBorder }}>
          <span style={{ ...styles.aiDot, background: T.ok }} /> 鏅鸿兘鍔╂墜
          <span style={{ ...styles.aiClose, color: T.sub, borderColor: T.aiBorder, background: T.bgSoft }} onClick={() => { sfxFunc(); setAiOpen(false) }} title="鏀惰捣 AI 鍔╂墜">鉁?/span>
        </div>
        <div style={{ ...styles.aiStatus, color: T.sub }}>姝ｅ湪鐪嬪綋鍓嶇粌涔?/div>
        <div style={styles.aiBody}>
          {aiThread.length === 0 && (
            <>
              <div style={{ ...styles.aiIntro, color: T.sub }}>鏈夊叧浜庡綋鍓嶇粌涔犵殑闂锛熼殢鏃堕棶鎴戯紒</div>
              {[
                '杩欓亾棰樻垜搴旇浠庡摢閲屽叆鎵嬶紵璇峰厛缁欎竴涓彁绀猴紝涓嶈鐩存帴缁欏畬鏁寸瓟妗堛€?,
                '璇疯В閲婅繖閬撻鍦ㄨ€冧粈涔堬紝浠ュ強鎴戝簲璇ュ浣曠悊瑙ｆ纭瓟妗堛€?,
                '璇锋媶涓€涓嬭繖鍙ヨ瘽鐨勮娉曠粨鏋勶紝閲嶇偣璇存槑涓诲共銆佷慨楗板叧绯诲拰璇嶅簭銆?,
                '璇疯瑙ｈ繖鍙ヨ瘽閲岀殑閲嶇偣鍗曡瘝鍜岀煭璇€?,
              ].map(q => (
                <div key={q} style={{ ...styles.aiQuick, color: T.text, background: T.brandSoft, borderColor: T.brand }} onClick={() => quickAsk(q)}>{q}</div>
              ))}
              {!done && (
                <>
                  <div style={{ ...styles.aiSection, color: T.sub }}>閽堝杩欓</div>
                  {followUp.map(q => (
                    <div key={q} style={{ ...styles.aiQuick, color: T.text, background: T.brandSoft, borderColor: T.brand }} onClick={() => quickAsk(q)}>{q}</div>
                  ))}
                </>
              )}
            </>
          )}
          {aiThread.map((m, i) => (
            <div key={i} style={{ ...styles.aiMsg, ...(m.role === 'user' ? { ...styles.aiMsgUser, background: T.brandSoft, color: T.text } : { ...styles.aiMsgBot, background: T.bgSoft, color: T.text }) }}>
              {m.text}
            </div>
          ))}
          {aiBusy && <div style={{ ...styles.aiMsgBot, background: T.bgSoft, color: T.text }}>姝ｅ湪鎬濊€冣€?/div>}
        </div>
        <div style={{ ...styles.aiFoot, borderTop: '1px solid ' + T.aiBorder }}>
          <input
            value={aiQ}
            onChange={e => setAiQ(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') askAI() }}
            placeholder="杈撳叆浣犵殑闂..."
            style={{ ...styles.aiInput, background: T.bgSoft, borderColor: T.border, color: T.text }}
          />
          <button style={{ ...styles.aiSend, background: T.brand }} onClick={() => askAI()}>鉃?/button>
        </div>
      </div>

      {/* 鍙充笅瑙掓偓娴?AI 瀵硅瘽鍥炬爣锛堢偣鍑诲敜璧蜂晶杈规爮锛屼笉鎵撴柇缁冧範鑺傚锛?*/}
      {!aiOpen && (
        <button style={{ ...styles.aiFab, background: T.brand, boxShadow: T.shadow }} onClick={() => { sfxFunc(); setAiOpen(true) }} title="鎵撳紑 AI 鍔╂墜锛堣В绛旇娉?璇嶆眹/鎼厤锛?>馃挰</button>
      )}

      {/* P4 鏈鍐呭闈㈡澘锛堝榻愬畼鏂?CourseContents.vue锛氱瓫閫?鍙戦煶+鎺屾彙鏍囪+璺宠浆锛?*/}
      <CourseContentsModal
        visible={contentOpen}
        sentences={sentenceEntries.map(({ qi: qIdx, s }) => ({
          russian: s.russian,
          chinese: s.chinese,
          soundmark: s.soundmark,
          qi: qIdx,
          isMastered: mastered.includes((cur?.id || '') + '_' + qIdx),
        }))}
        currentQi={qi}
        onJump={qIdx => { sfxScene(); setQi(qIdx) }}
        onPlaySound={text => speak(text)}
        onClose={() => setContentOpen(false)}
        theme={T}
        dark={uiCfg.themeMode === 'dark' || uiCfg.theme === 'dark'}
      />

      {/* P4 娓告垙鍐呰缃脊绐楋紙鍊嶉€?鎾斁娆℃暟/鎾斁闂撮殧锛屾湇鍔″惉鍐欐ā寮忥級 */}
      <GameSettingModal
        visible={gameSettingOpen}
        onClose={() => setGameSettingOpen(false)}
        onChange={data => { /* 璁剧疆宸茶嚜鍔ㄤ繚瀛樺埌 localStorage锛屽惉鍐欐ā寮忚鍙栨椂鐢熸晥 */ }}
        theme={T}
        dark={uiCfg.themeMode === 'dark' || uiCfg.theme === 'dark'}
      />

      {/* P6 閿欓鏈嫭绔嬪脊绐?*/}
      <WrongBookModal
        visible={wrongBookOpen}
        onClose={() => setWrongBookOpen(false)}
        onPlaySound={text => speak(text)}
        theme={T}
        dark={uiCfg.themeMode === 'dark' || uiCfg.theme === 'dark'}
      />

      {/* P6 妗岄潰瀹犵墿锛堝彲鎷栨嫿銆佺偣鍑讳簰鍔ㄣ€侀殢鏈哄彴璇嶏級 */}
      <DesktopPet
        visible={petVisible && phase === 'game'}
        theme={uiCfg.themeMode === 'dark' || uiCfg.theme === 'dark' ? 'dark' : 'light'}
        position={{ x: 24, y: 140 }}
      />

      {/* 妯″潡1.1 澶栬璁剧疆寮圭獥 */}
      {uiOpen && (
        <div style={styles.uiMask} onClick={() => setUiOpen(false)}>
          <div style={styles.uiPanel} onClick={e => e.stopPropagation()}>
            <div style={styles.uiTitle}>澶栬璁剧疆</div>
            <div style={styles.uiRow}>
              <div style={styles.uiLabel}>瀛椾綋</div>
              <div style={styles.uiOpts}>
                {[['system', '绯荤粺榛樿'], ['nunito', 'Nunito 鍦嗘鼎'], ['fredoka', 'Fredoka 鍦嗘鼎']].map(([k, label]) => (
                  <span key={k} style={{ ...styles.uiOpt, ...(uiCfg.font === k ? styles.uiOptOn : {}) }} onClick={() => saveUi({ font: k })}>{label}</span>
                ))}
              </div>
            </div>
            <div style={styles.uiRow}>
              <div style={styles.uiLabel}>棰樺共瀛楀彿</div>
              <div style={styles.uiOpts}>
                {['灏?, '涓?, '澶?].map(s => (
                  <span key={s} style={{ ...styles.uiOpt, ...(uiCfg.qSize === s ? styles.uiOptOn : {}) }} onClick={() => saveUi({ qSize: s })}>{s}</span>
                ))}
              </div>
            </div>
            <div style={styles.uiRow}>
              <div style={styles.uiLabel}>閲嶉煶瀛楀彿</div>
              <div style={styles.uiOpts}>
                {['灏?, '涓?, '澶?].map(s => (
                  <span key={s} style={{ ...styles.uiOpt, ...(uiCfg.sSize === s ? styles.uiOptOn : {}) }} onClick={() => saveUi({ sSize: s })}>{s}</span>
                ))}
              </div>
            </div>
            <div style={styles.uiRow}>
              <div style={styles.uiLabel}>鑳屾櫙涓婚</div>
              <div style={styles.uiOpts}>
                {Object.entries(THEMES).map(([k, v]) => (
                  <span key={k} style={{ ...styles.uiOpt, ...(uiCfg.theme === k ? styles.uiOptOn : {}) }} onClick={() => saveUi({ theme: k })}>{v.name}</span>
                ))}
              </div>
            </div>
            <div style={styles.uiRow}>
              <div style={styles.uiLabel}>杈撳叆妗嗘牱寮?/div>
              <div style={styles.uiOpts}>
                {[['dynamic', '鍔ㄦ€佸搴?], ['fixed', '鍥哄畾绛夊'], ['underline', '鏋佺畝妯嚎']].map(([k, label]) => (
                  <span key={k} style={{ ...styles.uiOpt, ...(uiCfg.inputStyle === k ? styles.uiOptOn : {}) }} onClick={() => saveUi({ inputStyle: k })}>{label}</span>
                ))}
              </div>
            </div>
            <div style={styles.uiRow}>
              <div style={styles.uiLabel}>绛旀鏄剧ず</div>
              <div style={styles.uiOpts}>
                {[['float', '娴眰妯″紡'], ['inline', '鍐呭祵妯″紡']].map(([k, label]) => (
                  <span key={k} style={{ ...styles.uiOpt, ...(uiCfg.answerMode === k ? styles.uiOptOn : {}) }} onClick={() => saveUi({ answerMode: k })}>{label}</span>
                ))}
              </div>
            </div>
            <div style={styles.uiRow}>
              <div style={styles.uiLabel}>璇嶆€ф爣娉?/div>
              <div style={styles.uiOpts}>
                {[[true, '鏄剧ず'], [false, '闅愯棌']].map(([k, label]) => (
                  <span key={k} style={{ ...styles.uiOpt, ...(uiCfg.posMark === k ? styles.uiOptOn : {}) }} onClick={() => saveUi({ posMark: k })}>{label}</span>
                ))}
              </div>
            </div>
            <div style={{ ...styles.uiGroupTitle, color: T.text }}>鏈楄璁剧疆</div>
            <div style={styles.uiRow}>
              <div style={styles.uiLabel}>鍋氶鏃惰嚜鍔ㄦ挱鏀惧０闊?/div>
              <div style={styles.uiOpts}>
                {[[true, '寮€'], [false, '鍏?]].map(([k, label]) => (
                  <span key={k} style={{ ...styles.uiOpt, ...(uiCfg.autoSpeak === k ? styles.uiOptOn : {}) }} onClick={() => saveUi({ autoSpeak: k })}>{label}</span>
                ))}
              </div>
            </div>
            <div style={styles.uiRow}>
              <div style={styles.uiLabel}>鏈楄娆℃暟</div>
              <div style={styles.uiOpts}>
                {[1, 2, 3, 4, 5].map(n => (
                  <span key={n} style={{ ...styles.uiOpt, ...(uiCfg.speakTimes === n ? styles.uiOptOn : {}) }} onClick={() => saveUi({ speakTimes: n })}>{n}閬?/span>
                ))}
              </div>
            </div>
            <div style={styles.uiRow}>
              <div style={styles.uiLabel}>鏈楄閫熷害</div>
              <div style={styles.uiOpts}>
                {SPEED_STEPS.map(v => (
                  <span key={v} style={{ ...styles.uiOpt, ...(uiCfg.speakSpeed === v ? styles.uiOptOn : {}) }} onClick={() => saveUi({ speakSpeed: v })}>{v}x</span>
                ))}
              </div>
            </div>
            <div style={styles.uiRow}>
              <div style={styles.uiLabel}>閬嶉棿鍋滈】</div>
              <div style={styles.uiOpts}>
                {GAP_STEPS.map(v => (
                  <span key={v} style={{ ...styles.uiOpt, ...(uiCfg.speakGap === v ? styles.uiOptOn : {}) }} onClick={() => saveUi({ speakGap: v })}>{v}s</span>
                ))}
              </div>
            </div>
            <div style={styles.uiRow}>
              <div style={styles.uiLabel}>鏄剧ず绛旀鏃惰嚜鍔ㄦ湕璇?/div>
              <div style={styles.uiOpts}>
                {[[true, '寮€'], [false, '鍏?]].map(([k, label]) => (
                  <span key={k} style={{ ...styles.uiOpt, ...(uiCfg.answerSpeak === k ? styles.uiOptOn : {}) }} onClick={() => saveUi({ answerSpeak: k })}>{label}</span>
                ))}
              </div>
            </div>
            <div style={styles.uiHint}>銆屽仛棰樻椂鑷姩鎾斁澹伴煶銆嶅紑鍚悗锛氭瘡閬撻鍔犺浇瀹屾垚 鈫?鑷姩鏈楄鍘熷彞锛堝彲璋冩鏁?閫熷害/鍋滈】锛夆啋 鏈楄缁撴潫鍚庤繘鍏ュ彲杈撳叆鐘舵€併€傚惉鍐欐ā寮忓缁堣嚜鍔ㄦ挱鏀俱€?/div>
            <div style={{ ...styles.uiGroupTitle, color: T.text, marginTop: 18 }}>澹伴煶璁剧疆</div>
            <div style={styles.uiRow}>
              <div style={styles.uiLabel}>鍏ㄥ眬闊虫晥</div>
              <div style={styles.uiOpts}>
                {[[true, '寮€'], [false, '闈欓煶']].map(([k, label]) => (
                  <span key={k} style={{ ...styles.uiOpt, ...(SFX_CFG.enabled === k ? styles.uiOptOn : {}) }} onClick={() => saveSfxCfg({ enabled: k })}>{label}</span>
                ))}
              </div>
            </div>
            <div style={styles.uiRow}>
              <div style={styles.uiLabel}>闊抽噺</div>
              <div style={styles.uiOpts}>
                {[[0.25, '浣?], [0.5, '涓綆'], [0.7, '涓?], [0.9, '楂?], [1, '鏈€澶?]].map(([v, label]) => (
                  <span key={v} style={{ ...styles.uiOpt, ...(SFX_CFG.vol === v ? styles.uiOptOn : {}) }} onClick={() => saveSfxCfg({ vol: v })}>{label}</span>
                ))}
              </div>
            </div>
            <div style={styles.uiRow}>
              <div style={styles.uiLabel}>鎸夐敭闊虫晥</div>
              <div style={styles.uiOpts}>
                {[[true, '寮€'], [false, '鍏?]].map(([k, label]) => (
                  <span key={k} style={{ ...styles.uiOpt, ...(SFX_CFG.keyOn === k ? styles.uiOptOn : {}) }} onClick={() => saveSfxCfg({ keyOn: k })}>{label}</span>
                ))}
              </div>
            </div>
            <div style={styles.uiRow}>
              <div style={styles.uiLabel}>鎸夐敭闊崇被鍨?/div>
              <div style={styles.uiOpts}></div>
            </div>
            <div style={{ ...styles.uiSfxGrid }}>
              {[['soft', '杞绘煍'], ['drum', '榧撶偣'], ['bubble', '姘旀场'], ['typewriter', '鎵撳瓧鏈?], ['sword', '閲戝睘鍓?], ['cherryBlue', '闈掕酱'], ['cherryRed', '绾㈣酱']].map(([k, label]) => (
                <span key={k} style={{ ...styles.uiSfxChip, ...(SFX_CFG.keyType === k ? styles.uiOptOn : {}) }} onClick={() => saveSfxCfg({ keyType: k })}>{label}</span>
              ))}
            </div>
            <div style={styles.uiRow}>
              <div style={styles.uiLabel}>绛旈鍙嶉闊?/div>
              <div style={styles.uiOpts}>
                {[[true, '寮€'], [false, '鍏?]].map(([k, label]) => (
                  <span key={k} style={{ ...styles.uiOpt, ...(SFX_CFG.answerOn === k ? styles.uiOptOn : {}) }} onClick={() => saveSfxCfg({ answerOn: k })}>{label}</span>
                ))}
              </div>
            </div>
            <div style={styles.uiRow}>
              <div style={styles.uiLabel}>杩炲嚮鍔ㄧ敾</div>
              <div style={styles.uiOpts}>
                {[[true, '寮€'], [false, '鍏?]].map(([k, label]) => (
                  <span key={k} style={{ ...styles.uiOpt, ...(SFX_CFG.comboAnim === k ? styles.uiOptOn : {}) }} onClick={() => saveSfxCfg({ comboAnim: k })}>{label}</span>
                ))}
              </div>
            </div>
            <div style={styles.uiRow}>
              <div style={styles.uiLabel}>杩炲嚮婵€鍔遍煶</div>
              <div style={styles.uiOpts}>
                {[[true, '寮€'], [false, '鍏?]].map(([k, label]) => (
                  <span key={k} style={{ ...styles.uiOpt, ...(SFX_CFG.comboFx === k ? styles.uiOptOn : {}) }} onClick={() => saveSfxCfg({ comboFx: k })}>{label}</span>
                ))}
              </div>
            </div>
            <div style={styles.uiRow}>
              <div style={styles.uiLabel}>鍦烘櫙鍔熻兘闊?/div>
              <div style={styles.uiOpts}>
                {[[true, '寮€'], [false, '鍏?]].map(([k, label]) => (
                  <span key={k} style={{ ...styles.uiOpt, ...(SFX_CFG.sceneOn === k ? styles.uiOptOn : {}) }} onClick={() => saveSfxCfg({ sceneOn: k })}>{label}</span>
                ))}
              </div>
            </div>
            <div style={styles.uiHint}>杩炲嚮婵€鍔遍渶鍚屾椂寮€鍚€岃繛鍑诲姩鐢汇€嶄笌銆岃繛鍑绘縺鍔遍煶銆嶏細3-5 杩炲嚮杞诲揩婵€鍔?/ 6-10 閫掕繘鑺傚 / 10 杩炲嚮浠ヤ笂楂樼噧鍐插埡锛涙柇杩炴挱鏀惧洖钀介煶銆傚叏灞€闈欓煶涓€閿叧闂叏閮ㄩ煶鏁堛€?/div>
          </div>
        </div>
      )}

      {/* 璁剧疆寮圭獥锛氬揩鎹烽敭/鎾斁/鍚姏/瀛︿範绛夐厤缃紙褰掑睘淇勮闂叧椤碉紝宸ュ叿鏍?鈿?璁剧疆 / Ctrl+, 鎵撳紑锛?*/}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}

// ================= 鏍峰紡 =================
const styles = {
  coursesRoot: { minHeight: '100vh', background: '#ffffff', color: '#1a1a1a', fontFamily: FONT_STACK.system, paddingBottom: 60 },
  mallHeader: { background: '#ffffff', borderBottom: '1px solid #e5e7eb', padding: '14px 30px', position: 'sticky', top: 0, zIndex: 5 },
  mallTitle: { fontSize: 30, fontWeight: 400, color: '#1a1a1a', textAlign: 'center', marginBottom: 16, marginTop: 8 },
  mallScroll: { maxWidth: 1120, margin: '0 auto', padding: '0 16px', maxHeight: '79vh', overflowY: 'auto', overflowX: 'hidden' },
  tabsWrap: { display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  tab: { padding: '4px 12px', borderRadius: 14, fontSize: 13, color: '#6b7280', cursor: 'pointer' },
  tabOn: { background: '#1a1a1a', color: '#fff', fontWeight: 600 },
  tabSearch: { marginLeft: 'auto', fontSize: 12.5, color: '#9ca3af' },
  mallBody: { maxWidth: 1120, margin: '0 auto', padding: '26px 30px' },
  sectionTitle: { fontSize: 17, fontWeight: 700, color: '#1a1a1a', marginBottom: 16 },
  courseGrid: { display: 'grid', gridTemplateColumns: 'repeat(1, minmax(0,1fr))', gap: 16, '@media (min-width:640px)': { gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }, '@media (min-width:768px)': { gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }, '@media (min-width:1024px)': { gridTemplateColumns: 'repeat(4, minmax(0,1fr))' } },
  courseCard: { background: '#ffffff', borderRadius: '6px', borderTopLeftRadius: '12px', borderTopRightRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden', cursor: 'pointer', transition: 'all .3s ease', ':hover': { boxShadow: '0 10px 30px rgba(0,0,0,.12)', transform: 'translateY(-2px)' } },
  courseCover: { aspectRatio: '16/9', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' },
  courseEmoji: { fontSize: 56, lineHeight: 1 },
  courseTag: { position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,.35)', color: '#fff', fontSize: 11, padding: '2px 8px', borderRadius: 10 },
  courseInfo: { padding: 16, display: 'flex', flexDirection: 'column', flexGrow: 1 },
  courseName: { fontSize: 18, fontWeight: 600, color: '#1a1a1a', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  courseNew: { fontSize: 11, color: '#9ca3af', fontWeight: 400 },
  courseSub: { fontSize: 14, color: '#6b7280', margin: '8px 0 0', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
  courseMeta: { fontSize: 12, color: '#9ca3af', marginTop: 8 },
  // 鈥斺€?鍟嗗煄椋庢牸锛堥珮绾ц川鎰燂級 鈥斺€?  mallNav: { background: '#ffffff', borderBottom: '1px solid #f0f0f0', padding: '0 40px', display: 'flex', alignItems: 'center', gap: 32, position: 'sticky', top: 0, zIndex: 10, height: 64 },
  mallNavLeft: { display: 'flex', alignItems: 'center', flexShrink: 0 },
  mallNavTitle: { fontSize: 18, fontWeight: 600, color: '#1a1a1a', letterSpacing: 1 },
  mallNavTabs: { display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', flex: 1 },
  mallNavTab: { padding: '8px 16px', fontSize: 14, color: '#888', cursor: 'pointer', borderRadius: 6, transition: 'color .2s', fontWeight: 400 },
  mallNavTabOn: { color: '#1a1a1a', fontWeight: 600 },
  mallNavSearch: { fontSize: 13, color: '#bbb', background: '#f7f7f7', padding: '8px 18px', borderRadius: 20, flexShrink: 0, whiteSpace: 'nowrap', border: '1px solid #f0f0f0' },
  mallContent: { maxWidth: 1280, margin: '0 auto', padding: '40px 40px 80px' },
  mallSection: { marginBottom: 8 },
  mallSectionTitle: { fontSize: 20, fontWeight: 600, color: '#1a1a1a', marginBottom: 20, letterSpacing: 0.5 },
  mallSectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  mallSectionMore: { fontSize: 13, color: '#999', cursor: 'pointer', fontWeight: 400, transition: 'color .2s' },
  mallFeaturedGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 20 },
  mallFeaturedCard: { cursor: 'pointer', transition: 'transform .25s cubic-bezier(.4,0,.2,1), box-shadow .25s', borderRadius: 14, background: '#fff', boxShadow: '0 2px 12px rgba(0,0,0,.06)' },
  mallFeaturedCover: { aspectRatio: '16/10', position: 'relative', overflow: 'hidden', borderRadius: '14px 14px 0 0' },
  mallFeaturedLevel: { position: 'absolute', left: 20, top: 18, fontSize: 26, fontWeight: 200, color: 'rgba(255,255,255,.9)', letterSpacing: 3, fontStyle: 'italic' },
  mallFeaturedOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: '32px 20px 16px', background: 'linear-gradient(to top, rgba(0,0,0,.5), transparent)' },
  mallFeaturedCoverTitle: { fontSize: 17, fontWeight: 500, color: '#fff', letterSpacing: 0.5 },
  mallFeaturedInfo: { padding: '16px 18px 18px' },
  mallFeaturedName: { fontSize: 15, fontWeight: 600, color: '#1a1a1a', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  mallFeaturedMeta: { fontSize: 12, color: '#aaa', fontWeight: 400 },
  mallListGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 20 },
  mallListCard: { cursor: 'pointer', transition: 'transform .25s cubic-bezier(.4,0,.2,1), box-shadow .25s', borderRadius: 12, background: '#fff', boxShadow: '0 2px 10px rgba(0,0,0,.05)' },
  mallListCover: { aspectRatio: '16/9', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px 12px 0 0', overflow: 'hidden', position: 'relative' },
  mallListLevel: { fontSize: 30, fontWeight: 200, color: 'rgba(255,255,255,.85)', letterSpacing: 2, fontStyle: 'italic' },
  mallListInfo: { padding: '14px 16px 16px' },
  mallListName: { fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  mallListMeta: { fontSize: 11.5, color: '#aaa', fontWeight: 400 },
  // 鈥斺€?璇剧▼璇︽儏椤碉紙瀵归綈鍙ヤ箰閮ㄨ绋嬭鎯咃級 鈥斺€?  detailNav: { background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '0 40px', display: 'flex', alignItems: 'center', height: 56, position: 'sticky', top: 0, zIndex: 10 },
  detailBack: { fontSize: 22, color: '#1a1a1a', cursor: 'pointer', marginRight: 16, fontWeight: 300 },
  detailNavTitle: { fontSize: 17, fontWeight: 600, color: '#1a1a1a' },
  detailContent: { maxWidth: 1200, margin: '0 auto', padding: '28px 40px 60px' },
  detailHead: { background: '#fff', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,.05)', padding: 28, display: 'flex', gap: 24, alignItems: 'flex-start' },
  detailCover: { width: 200, height: 140, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' },
  detailCoverLevel: { fontSize: 36, fontWeight: 200, color: 'rgba(255,255,255,.9)', fontStyle: 'italic', letterSpacing: 2 },
  detailHeadInfo: { flex: 1, minWidth: 0 },
  detailTitle: { fontSize: 24, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 },
  detailDesc: { fontSize: 14, color: '#888', marginBottom: 14, lineHeight: 1.6 },
  detailTags: { display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  detailTag: { fontSize: 12, color: '#666', background: '#f5f5f5', padding: '4px 12px', borderRadius: 12 },
  detailMeta: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#999' },
  detailMetaItem: {},
  detailMetaDot: { color: '#ddd' },
  detailHeadRight: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexShrink: 0 },
  detailStartBtn: { background: 'linear-gradient(135deg,#8B5CF6,#6D28D9)', color: '#fff', border: 'none', padding: '12px 36px', borderRadius: 24, fontSize: 15, fontWeight: 600, cursor: 'pointer', transition: 'opacity .2s', boxShadow: '0 4px 16px rgba(139,92,246,.3)' },
  detailOutline: { background: '#fff', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,.05)', marginTop: 24, padding: '20px 28px' },
  detailOutlineHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  detailOutlineTitle: { fontSize: 17, fontWeight: 600, color: '#1a1a1a' },
  detailOutlineCount: { fontSize: 14, color: '#888', fontWeight: 400, marginLeft: 10 },
  detailOutlineTrial: { fontSize: 13, color: '#aaa', marginLeft: 10 },
  detailSortBtn: { fontSize: 13, color: '#666', background: '#f7f7f7', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', border: '1px solid #eee' },
  detailLessonRow: { display: 'flex', alignItems: 'center', gap: 14, padding: '16px 0', borderBottom: '1px solid #f5f5f5', cursor: 'pointer', transition: 'background .15s' },
  detailLessonNo: { fontSize: 14, color: '#ccc', fontWeight: 500, width: 28, flexShrink: 0, textAlign: 'center' },
  detailLessonIcon: { fontSize: 16, color: '#ddd', flexShrink: 0 },
  detailLessonName: { fontSize: 15, fontWeight: 600, color: '#1a1a1a', marginBottom: 4 },
  detailLessonDesc: { fontSize: 12.5, color: '#bbb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  detailTrialTag: { fontSize: 12, color: '#999', background: '#f7f7f7', padding: '4px 14px', borderRadius: 12, flexShrink: 0, fontWeight: 500 },
  detailTrialActive: { color: '#15803D', background: '#DCFCE7' },
  // 鈥斺€?璇剧▼璇︽儏椤垫爣绛鹃〉 鈥斺€?  detailTabs: { display: 'flex', gap: 28, borderBottom: '1px solid #f0f0f0', marginTop: 24 },
  detailTabItem: { padding: '12px 0', fontSize: 15, color: '#888', cursor: 'pointer', borderBottom: '2px solid transparent', marginBottom: -1, transition: 'color .2s' },
  detailTabItemOn: { color: '#1a1a1a', fontWeight: 600, borderBottom: '2px solid #8B5CF6' },
  // 鈥斺€?瀛︿範璺嚎瑙嗗浘 鈥斺€?  routeView: { marginTop: 24 },
  routeHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  routeDifficulty: { fontSize: 13, color: '#8B5CF6', background: '#F3E8FF', padding: '5px 16px', borderRadius: 14, fontWeight: 500 },
  routeSetting: { fontSize: 13, color: '#999', cursor: 'pointer' },
  routeGraph: { position: 'relative', padding: '10px 0' },
  routeRow: { display: 'flex', alignItems: 'center', position: 'relative', height: 96, marginBottom: 4 },
  routeConnector: { position: 'absolute', top: 0, width: '50%', height: '100%', border: '2px dashed #e0e0e0', borderBottom: 'none', pointerEvents: 'none' },
  routeConnectorLeft: { left: '50%', borderLeft: 'none', borderRadius: '0 48px 0 0' },
  routeConnectorRight: { right: '50%', borderRight: 'none', borderRadius: '48px 0 0 0' },
  routeNodeWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', zIndex: 1, position: 'relative', transition: 'transform .2s' },
  routeNode: { width: 56, height: 56, borderRadius: '50%', background: '#f5f5f5', border: '2px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .2s' },
  routeNodeActive: { background: 'linear-gradient(135deg,#8B5CF6,#6D28D9)', borderColor: '#8B5CF6', boxShadow: '0 4px 16px rgba(139,92,246,.35)' },
  routeNodeIcon: { fontSize: 16, fontWeight: 700, color: '#aaa' },
  routeNodeLabel: { fontSize: 13, color: '#555', marginTop: 8, fontWeight: 500 },
  routeNodeDiff: { fontSize: 11, color: '#bbb', marginTop: 2 },
  backHome: { position: 'fixed', left: 18, bottom: 18, background: '#3D2E1E', color: '#F6F1E8', border: 'none', padding: '8px 16px', borderRadius: 20, fontSize: 13, cursor: 'pointer', zIndex: 10 },
  lessonHead: { maxWidth: 900, margin: '20px auto 0', background: '#FFFDF9', borderRadius: 18, padding: 22, display: 'flex', gap: 20, boxShadow: '0 2px 14px rgba(61,46,30,.06)' },
  lessonCover: { width: 90, height: 90, borderRadius: 14, background: 'linear-gradient(135deg,#8B5CF6,#6D28D9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44, flexShrink: 0 },
  lessonTitle: { fontSize: 19, fontWeight: 700, color: '#3D2E1E' },
  lessonDesc: { fontSize: 12.5, color: '#8A7A66', margin: '6px 0', lineHeight: 1.6 },
  lessonTags: { display: 'flex', gap: 6, margin: '6px 0' },
  tagPill: { fontSize: 11, padding: '2px 10px', borderRadius: 10, background: '#F0E8DA', color: '#7A6A55' },
  lessonStat: { fontSize: 12, color: '#B3A692', marginTop: 4 },
  outline: { maxWidth: 900, margin: '20px auto 0', background: '#FFFDF9', borderRadius: 18, padding: 22, boxShadow: '0 2px 14px rgba(61,46,30,.06)' },
  outlineTitle: { fontSize: 15, fontWeight: 700, color: '#3D2E1E', marginBottom: 10 },
  lessonRow: { display: 'flex', gap: 14, alignItems: 'center', padding: '12px 4px', borderBottom: '1px solid #F0E8DA', cursor: 'pointer' },
  lessonNo: { fontSize: 13, fontWeight: 700, color: '#B3A692', width: 28 },
  lessonRowName: { fontSize: 13.5, fontWeight: 600, color: '#3D2E1E' },
  lessonRowDesc: { fontSize: 11.5, color: '#A99C8B', marginTop: 3 },
  trial: { fontSize: 11, color: '#8B5CF6', background: '#EDE9FE', padding: '2px 10px', borderRadius: 10, flexShrink: 0 },
  modalRoot: { position: 'fixed', inset: 0, background: 'rgba(10,6,20,.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, fontFamily: FONT_STACK.system },
  modeModal: { width: 860, maxWidth: '92vw', background: '#FFFDF9', borderRadius: 20, padding: 28, boxShadow: '0 24px 80px rgba(0,0,0,.4)' },
  modeModalTitle: { fontSize: 22, fontWeight: 800, color: '#1F1B2E' },
  modeModalSub: { fontSize: 12, color: '#A99C8B', marginBottom: 20 },
  modeBody: { display: 'flex', gap: 24 },
  modeList: { width: 240, display: 'flex', flexDirection: 'column', gap: 4 },
  modeItem: { padding: '12px 14px', borderRadius: 12, cursor: 'pointer', position: 'relative', border: '1px solid transparent' },
  modeItemOn: { background: '#F3EFFC', borderColor: '#C4B5FD' },
  modeItemName: { fontSize: 14.5, fontWeight: 600, color: '#1F1B2E' },
  modeItemTag: { fontSize: 11, color: '#A99C8B', marginTop: 2 },
  modeRec: { position: 'absolute', top: 8, right: 10, fontSize: 10, color: '#8B5CF6', background: '#EDE9FE', padding: '1px 8px', borderRadius: 8 },
  modeDetail: { flex: 1, background: '#FAF7F2', borderRadius: 14, padding: 20 },
  modeDetailTitle: { fontSize: 17, fontWeight: 700, color: '#1F1B2E' },
  modeDetailDesc: { fontSize: 13, color: '#7A6A55', margin: '8px 0 18px', lineHeight: 1.7 },
  diffLabel: { fontSize: 13, fontWeight: 600, color: '#1F1B2E', marginBottom: 8 },
  diffRow: { display: 'flex', gap: 8 },
  diffPill: { padding: '6px 16px', borderRadius: 18, border: '1px solid #E0D5C3', color: '#7A6A55', fontSize: 13, cursor: 'pointer', background: '#fff' },
  diffOn: { background: '#1F1B2E', color: '#fff', borderColor: '#1F1B2E' },
  diffHint: { fontSize: 11.5, color: '#B3A692', marginTop: 10 },
  modeFoot: { display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 22 },
  modeCancel: { padding: '9px 22px', borderRadius: 20, border: '1px solid #E0D5C3', background: '#fff', color: '#7A6A55', fontSize: 14, cursor: 'pointer' },
  modeStart: { padding: '9px 26px', borderRadius: 20, border: 'none', background: '#DC2626', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  loadRoot: { position: 'fixed', inset: 0, background: '#0a0a0a', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 60, fontFamily: FONT_STACK.system },
  loadLogo: { width: 280, height: 'auto', filter: 'invert(1)', marginBottom: 70, opacity: 0.95 },
  loadTip: { fontSize: 14, color: '#777', marginBottom: 90, textAlign: 'center', letterSpacing: 0.5, maxWidth: 500 },
  loadBottom: { width: 560, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  loadText: { fontSize: 13, letterSpacing: 4, color: '#555', fontWeight: 600 },
  loadBar: { width: 560, height: 22, background: '#161616', borderRadius: 11, border: '1px solid #262626', overflow: 'hidden', position: 'relative', backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 55px, #2a2a2a 55px, #2a2a2a 56px)' },
  loadFill: { height: '100%', background: 'linear-gradient(90deg,#a855f7,#d946ef)', borderRadius: 10, transition: 'width .25s ease', boxShadow: '0 0 12px rgba(168,85,247,.5)' },
  loadPct: { fontSize: 18, color: '#a855f7', fontWeight: 700 },
  resultRoot: { position: 'fixed', inset: 0, background: 'linear-gradient(160deg,#0D0918 0%,#1B1330 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT_STACK.system, overflowY: 'auto' },
  resultCard: { width: 660, maxWidth: '94vw', background: '#171028', borderRadius: 24, padding: '34px 34px 30px', textAlign: 'center', border: '1px solid rgba(255,255,255,.08)', margin: '20px auto' },
  ratingBadge: { fontSize: 56, fontWeight: 900, letterSpacing: 2 },
  resultTitle: { fontSize: 24, fontWeight: 800, color: '#F5EDE2', margin: '4px 0 4px' },
  resultSub: { fontSize: 13, color: '#8B7FA3' },
  resultScore: { fontSize: 44, fontWeight: 900, color: '#FFD75E', marginTop: 14, textShadow: '0 0 34px rgba(255,215,94,.3)' },
  resultScoreLabel: { fontSize: 12, color: '#8B7FA3', letterSpacing: 2, marginTop: 2 },
  resultStats: { display: 'flex', justifyContent: 'space-between', gap: 4, margin: '22px 0 18px', padding: '16px 12px', background: 'rgba(255,255,255,.05)', borderRadius: 14 },
  stat: { flex: 1, textAlign: 'center' },
  statNum: { fontSize: 19, fontWeight: 800, color: '#FFD75E' },
  statLabel: { fontSize: 11.5, color: '#8B7FA3', marginTop: 4 },
  ringRow: { display: 'flex', justifyContent: 'center', gap: 14, margin: '2px 0 20px' },
  ringItem: { width: 124, textAlign: 'center' },
  resultTip: { fontSize: 14, color: '#C9BEE0', marginBottom: 24 },
  resultBtns: { display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'nowrap' },
  wrongMask: { position: 'fixed', inset: 0, background: 'rgba(10,6,20,.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, backdropFilter: 'blur(2px)', padding: 20 },
  wrongPanel: { width: 540, maxWidth: '94vw', maxHeight: '74vh', overflowY: 'auto', background: '#171028', borderRadius: 20, padding: 26, border: '1px solid rgba(255,255,255,.1)', textAlign: 'center' },
  wrongTitle: { fontSize: 18, fontWeight: 800, color: '#F5EDE2', marginBottom: 14 },
  wrongNo: { fontSize: 15, color: '#4ADE80', padding: '22px 0', textAlign: 'center' },
  wrongRow: { background: 'rgba(255,255,255,.05)', borderRadius: 12, padding: '12px 14px', marginBottom: 10, textAlign: 'left' },
  wrongQ: { fontSize: 15, fontWeight: 700, color: '#F5EDE2' },
  wrongZh: { fontSize: 12.5, color: '#8B7FA3', margin: '3px 0 6px' },
  wrongAns: { fontSize: 13, color: '#C9BEE0', marginTop: 2 },
  wrongReason: { fontSize: 12, color: '#FFB347', marginTop: 6 },
  btnGhost: { padding: '9px 18px', borderRadius: 22, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.2)', color: '#E5DDF5', fontSize: 14, cursor: 'pointer' },
  btnPrimary: { padding: '9px 18px', borderRadius: 22, background: '#8B5CF6', border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  gameRoot: { minHeight: '100vh', background: '#ffffff', color: '#3A3A3A', position: 'relative', fontFamily: FONT_STACK.system, display: 'flex', flexDirection: 'column' },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', fontSize: 13, color: '#475569', gap: 16, borderTop: '1px solid #e2e8f0', borderBottom: 'none' },
  toolIconBtn: { width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: 'none', background: 'transparent', color: '#475569', fontSize: 18, cursor: 'pointer', padding: 0, transition: 'color .12s, background .12s' },
  topCourse: { fontWeight: 600, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 14 },
  topProgressText: { color: '#64748b', fontVariantNumeric: 'tabular-nums', fontSize: 13 },
  studyVideoLink: { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: 'transparent', color: '#475569', fontSize: 12.5, cursor: 'pointer', whiteSpace: 'nowrap' },
  topRight: { display: 'flex', gap: 16, alignItems: 'center', flexShrink: 0 },
  topTime: { fontVariantNumeric: 'tabular-nums' },
  topPart: { fontVariantNumeric: 'tabular-nums' },
  topScore: { display: 'none' },
  overflowPop: { position: 'absolute', top: 40, right: 0, minWidth: 168, borderRadius: 12, padding: 6, zIndex: 80, background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 12px 32px rgba(15,23,42,.14)' },
  overflowItem: { padding: '8px 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#334155', display: 'flex', alignItems: 'center', gap: 8 },
  overflowItemOn: { background: '#f5f3ff', color: '#7c3aed', fontWeight: 600 },
  progressBarFull: { height: 24, width: '100%', background: '#f1f5f9', padding: 2, boxSizing: 'border-box', borderBottom: '1px solid #e2e8f0' },
  progressBarFill: { height: '100%', background: '#d946ef', borderRadius: 4, transition: 'width .3s ease' },
  gameMain: { display: 'flex', flexDirection: 'column', flex: 1 },
  center: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 30px' },
  praise: { fontSize: 34, fontWeight: 900, color: '#FFD75E', marginBottom: 10, textShadow: '0 0 30px rgba(255,215,94,.35)' },
  zhText: { fontSize: 30, fontWeight: 700, color: '#F5EDE2', marginBottom: 26, textAlign: 'center', lineHeight: 1.5 },
  wordRow: { display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', minHeight: 62, alignItems: 'center', maxWidth: 640 },
  wordChip: { padding: '8px 16px', borderRadius: 12, border: '1px solid', fontSize: 20, fontWeight: 700, minWidth: 40, textAlign: 'center', transition: 'all .15s' },
  // 瀹樻柟杩炶瘝鎴愬彞锛氬崟璇嶄笅鍒掔嚎妲?+ 閫忔槑瑕嗙洊杈撳叆妗嗭紙1:1 澶嶅埢 earthworm QuestionInput锛?  // Earthworm: relative flex flex-wrap justify-center gap-2(8px) transition-all锛涙Ы h-[4rem]=64px锛泃ext-[3em]=48px锛沴eading-none锛沶ormal 瀛楅噸
  slotRow: { display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', alignItems: 'center', position: 'relative', padding: '0 4px' },
  slotBox: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 2, borderBottom: '2px solid', padding: '0 6px', height: 64, lineHeight: 1, textAlign: 'center', fontWeight: 400, transition: 'border-color .15s, color .15s' },
  slotPunct: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 64, lineHeight: 1, textAlign: 'center', fontWeight: 400, padding: '0 4px' },
  slotInput: { position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'text', border: 'none', outline: 'none', background: 'transparent', color: 'transparent', caretColor: 'transparent', zIndex: 1, fontSize: 16 },
  hiddenInput: { width: 0, height: 0, opacity: 0, position: 'absolute', pointerEvents: 'none' },
  inputHint: { fontSize: 12.5, color: '#8B7FA3', marginTop: 14 },
  wrongTip: { fontSize: 16, fontWeight: 700, color: '#F87171', marginTop: 10 },
  stuckBox: { marginTop: 18, background: 'rgba(139,92,246,.12)', border: '1px solid rgba(139,92,246,.4)', borderRadius: 14, padding: '14px 18px', maxWidth: 380, textAlign: 'center' },
  stuckTitle: { fontSize: 15, fontWeight: 700, color: '#C4B5FD' },
  stuckText: { fontSize: 12.5, color: '#B9AFCB', margin: '8px 0 12px' },
  stuckBtns: { display: 'flex', gap: 10, justifyContent: 'center' },
  stuckNo: { padding: '6px 16px', borderRadius: 16, background: 'transparent', border: '1px solid rgba(255,255,255,.25)', color: '#B9AFCB', fontSize: 12.5, cursor: 'pointer' },
  stuckYes: { padding: '6px 16px', borderRadius: 16, background: '#8B5CF6', border: 'none', color: '#fff', fontSize: 12.5, cursor: 'pointer' },
  // 瀹樻柟 Answer.vue锛氶€愯瘝澶у瓧鍙峰彲鐐瑰嚮鍙戦煶 + 鏁村彞鍠囧彮 + 闊虫爣 + 涓枃 + 鍐嶆潵涓€娆?涓嬩竴棰橈紙鍘熷湴娓叉煋锛屾棤閬僵鍗＄墖锛?  answerWords: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 4, fontSize: 48, fontWeight: 400, lineHeight: 1.2, margin: '0 0 4px' },
  answerWord: { cursor: 'pointer', padding: 4, transition: 'color .12s' },
  answerSpeaker: { marginLeft: 8, fontSize: 28, cursor: 'pointer', color: '#6b7280', transition: 'color .12s' },
  answerSoundmark: { fontSize: 20, color: '#6b7280', margin: '24px 0 0' },
  answerZhLine: { fontSize: 20, color: '#6b7280', margin: '24px 0 0' },
  answerBtns: { display: 'flex', gap: 0, justifyContent: 'center', margin: '24px 0 8px' },
  answerBtn: { padding: '8px 20px', borderRadius: 8, border: '1px solid #D1D5DB', background: 'transparent', color: '#4B5563', fontSize: 14, cursor: 'pointer', transition: 'background .12s,border-color .12s,color .12s' },
  answerBtnMain: { padding: '8px 20px', borderRadius: 8, border: '1px solid #D1D5DB', background: 'transparent', color: '#4B5563', fontSize: 14, cursor: 'pointer', transition: 'background .12s,border-color .12s,color .12s', marginLeft: 24 },
  inlineWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, maxWidth: 640 },
  inlineMeta: { display: 'flex', flexWrap: 'wrap', gap: '10px 18px', justifyContent: 'center', lineHeight: 1.9 },
  inlineRole: { display: 'inline-flex', alignItems: 'baseline', gap: 8 },
  inlineWord: { display: 'inline-flex', alignItems: 'baseline', gap: 4, marginRight: 6, fontWeight: 600 },
  inlinePos: { fontStyle: 'normal', fontWeight: 600, paddingBottom: 1, marginLeft: 2, fontSize: 11 },
  inlineZh: { fontStyle: 'normal', opacity: .75, marginLeft: 2, fontWeight: 400 },
  wordPlaceholder: { letterSpacing: 6, opacity: .5, padding: '8px 4px' },
  rolePosHidden: { height: 14 },
  rolesRow: { display: 'flex', gap: 40, justifyContent: 'center', flexWrap: 'wrap' },
  roleCol: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 },
  roleName: { fontSize: 13, color: '#C4B5FD', background: 'rgba(139,92,246,.2)', padding: '3px 14px', borderRadius: 12 },
  roleWordWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 },
  roleWord: { fontSize: 30, fontWeight: 800, color: '#F5EDE2' },
  roleStress: { fontSize: 12, color: '#8B7FA3' },
  rolePos: { fontSize: 12, color: '#C4B5FD' },
  roleZh: { fontSize: 14, color: '#E5DDF5' },
  answerFallback: { textAlign: 'center' },
  answerBig: { fontSize: 42, fontWeight: 800, color: '#F5EDE2', margin: '10px 0 6px' },
  answerZh: { fontSize: 18, color: '#C9BEE0' },
  answerErr: { fontSize: 12, color: '#8B7FA3', marginTop: 10 },
  retry: { color: '#C4B5FD', cursor: 'pointer', textDecoration: 'underline' },
  answerOk: { marginTop: 16, fontSize: 15, fontWeight: 700, color: '#34D399' },
  bottomBar: { display: 'none' },
  sKey: { background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569', fontSize: 12, padding: '8px 12px', borderRadius: 10, cursor: 'pointer' },
  sKeyMain: { background: '#d946ef', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, padding: '8px 16px', borderRadius: 10, cursor: 'pointer' },
  mobBar: { display: 'none', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 18 },
  mobBtn: { padding: '9px 16px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', fontSize: 13, cursor: 'pointer' },
  mobBtnMain: { padding: '9px 16px', borderRadius: 10, border: 'none', background: '#d946ef', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  navArrows: { display: 'flex', gap: 4, marginLeft: 4 },
  navArrow: { width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: 'rgba(255,255,255,.06)', color: '#B9AFCB', cursor: 'pointer', fontSize: 16 },
  aiPanel: { position: 'fixed', top: 0, right: 0, bottom: 0, width: 300, background: 'rgba(20,14,36,.92)', borderLeft: '1px solid rgba(255,255,255,.07)', display: 'flex', flexDirection: 'column', zIndex: 10, transition: 'transform .28s ease' },
  aiClose: { float: 'right', padding: '2px 8px', borderRadius: 8, border: '1px solid', fontSize: 12, cursor: 'pointer' },
  aiFab: { position: 'fixed', right: 22, bottom: 96, width: 54, height: 54, borderRadius: '50%', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer', zIndex: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform .15s, box-shadow .15s' },
  // 鏈鍐呭闈㈡澘
  contentHint: { fontSize: 12, color: '#8B7FA3', marginBottom: 12 },
  contentList: { display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '52vh', overflowY: 'auto', paddingRight: 4 },
  contentRow: { display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 12, border: '1px solid', cursor: 'pointer', transition: 'background .15s' },
  contentNo: { fontSize: 12, fontWeight: 700, width: 22, flexShrink: 0, marginTop: 1 },
  contentRu: { fontSize: 14.5, lineHeight: 1.5 },
  contentZh: { fontSize: 12, marginTop: 2, opacity: .8 },
  contentGo: { fontSize: 12, flexShrink: 0, marginTop: 2 },
  aiHead: { padding: '16px 18px', fontSize: 15, fontWeight: 700, color: '#E5DDF5', borderBottom: '1px solid rgba(255,255,255,.07)' },
  aiDot: { display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#34D399', marginRight: 8 },
  aiStatus: { fontSize: 11.5, color: '#8B7FA3', padding: '4px 18px 8px' },
  aiBody: { flex: 1, overflowY: 'auto', padding: '6px 14px', display: 'flex', flexDirection: 'column', gap: 8 },
  aiIntro: { fontSize: 12.5, color: '#B9AFCB', margin: '6px 0 10px' },
  aiQuick: { fontSize: 12, color: '#C9BEE0', background: 'rgba(139,92,246,.12)', border: '1px solid rgba(139,92,246,.25)', borderRadius: 12, padding: '8px 12px', cursor: 'pointer', lineHeight: 1.5 },
  aiSection: { fontSize: 11.5, color: '#8B7FA3', marginTop: 8 },
  aiMsg: { fontSize: 12.5, padding: '9px 12px', borderRadius: 12, lineHeight: 1.6, maxWidth: '92%' },
  aiMsgUser: { background: 'rgba(139,92,246,.25)', color: '#E5DDF5', alignSelf: 'flex-end' },
  aiMsgBot: { background: 'rgba(255,255,255,.07)', color: '#D8CFF0', alignSelf: 'flex-start' },
  aiFoot: { display: 'flex', gap: 8, padding: 12, borderTop: '1px solid rgba(255,255,255,.07)' },
  aiInput: { flex: 1, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 12, padding: '8px 12px', color: '#F5EDE2', fontSize: 12.5, outline: 'none' },
  aiSend: { width: 36, height: 36, borderRadius: 12, background: '#8B5CF6', border: 'none', color: '#fff', fontSize: 15, cursor: 'pointer' },
  // 妯″潡1.1 澶栬璁剧疆
  uiBtn: { background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.16)', color: '#E5DDF5', fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 10, cursor: 'pointer', letterSpacing: 1 },
  uiMask: { position: 'fixed', inset: 0, background: 'rgba(5,3,12,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 90, backdropFilter: 'blur(2px)' },
  uiPanel: { width: 400, maxWidth: '92vw', background: '#1B1330', border: '1px solid rgba(255,255,255,.1)', borderRadius: 18, padding: 22, boxShadow: '0 18px 60px rgba(0,0,0,.5)', maxHeight: '86vh', overflowY: 'auto' },
  uiTitle: { fontSize: 17, fontWeight: 800, color: '#F5EDE2', marginBottom: 16 },
  uiRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 },
  uiLabel: { fontSize: 13.5, color: '#C9BEE0', flexShrink: 0, width: 78 },
  uiOpts: { display: 'flex', gap: 6 },
  uiOpt: { padding: '5px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,.16)', color: '#B9AFCB', fontSize: 12.5, cursor: 'pointer', background: 'rgba(255,255,255,.05)' },
  uiOptOn: { background: '#8B5CF6', borderColor: '#8B5CF6', color: '#fff', fontWeight: 600 },
  uiHint: { fontSize: 11.5, color: '#8B7FA3', lineHeight: 1.7, marginTop: 6, borderTop: '1px solid rgba(255,255,255,.08)', paddingTop: 12 },
  uiGroupTitle: { fontSize: 12.5, fontWeight: 700, letterSpacing: 1, margin: '2px 0 12px', opacity: .85 },
  uiSfxGrid: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  uiSfxChip: { padding: '5px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,.16)', color: '#B9AFCB', fontSize: 12, cursor: 'pointer', background: 'rgba(255,255,255,.05)' },
  // 鍗虫椂鐘舵€佸弽棣堬細杩炲嚮鍔ㄦ晥 + 鏆傚仠
  comboPop: { position: 'fixed', left: '50%', top: '38%', transform: 'translateX(-50%)', fontSize: 36, fontWeight: 800, letterSpacing: 1, pointerEvents: 'none', zIndex: 60, animation: 'ruqComboPop .3s ease forwards' },
  comboFlash: { position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 59, animation: 'ruqFlash .5s ease forwards' },
  comboBreak: { position: 'fixed', left: '50%', top: '46%', transform: 'translateX(-50%)', fontSize: 15, fontWeight: 600, letterSpacing: 2, opacity: .75, pointerEvents: 'none', zIndex: 58, animation: 'ruqBreak .55s ease forwards' },
  pauseMask: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'ruqFadeIn .25s ease' },
  pauseCard: { padding: '36px 48px', borderRadius: 20, border: '1px solid', textAlign: 'center', maxWidth: '88vw' },
  pauseTitle: { fontSize: 23, fontWeight: 800, marginBottom: 8 },
  pauseTime: { fontSize: 13, marginBottom: 24 },
  pauseBtns: { display: 'flex', gap: 12, justifyContent: 'center' },
  // 椤堕儴鎬昏繘搴︽潯 + 妯″紡鍒囨崲
  progressTrack: { width: 120, height: 7, borderRadius: 4, border: '1px solid', overflow: 'hidden', flexShrink: 0 },
  progressFill: { height: '100%', borderRadius: 3, transition: 'width .3s ease' },
  modeWrap: { position: 'relative' },
  modePop: { position: 'absolute', top: 30, right: 0, width: 176, borderRadius: 14, padding: 6, zIndex: 80 },
  modePopItem: { padding: '8px 12px', borderRadius: 10, fontSize: 12.5, cursor: 'pointer' },
  // 鍚啓妯″紡
  dictHint: { fontWeight: 700, marginBottom: 26, textAlign: 'center', letterSpacing: 1 },
  // 鍙ｈ璇勬祴妯″紡
  speakWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, maxWidth: 520 },
  speakTip: { fontWeight: 600, opacity: .9 },
  speakBtns: { display: 'flex', gap: 12, marginTop: 4 },
  speakBtn: { padding: '10px 22px', borderRadius: 14, border: '1px solid', fontSize: 14, cursor: 'pointer' },
  speakBtnMain: { padding: '10px 22px', borderRadius: 14, border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  speakBtnRec: { padding: '10px 22px', borderRadius: 14, border: 'none', fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer', animation: 'ruqPulse 1s ease infinite' },
  speakLoading: { fontSize: 13 },
  speakCard: { width: '100%', maxWidth: 460, borderRadius: 16, padding: '18px 22px', border: '1px solid', textAlign: 'center' },
  speakScoreRow: { display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 8 },
  speakGrade: { fontSize: 18, fontWeight: 800, letterSpacing: 1 },
  speakText: { fontSize: 13.5, marginTop: 10, lineHeight: 1.6 },
  speakErrors: { fontSize: 12.5, marginTop: 8, lineHeight: 1.8, textAlign: 'left' },
  speakTip2: { fontSize: 12, marginTop: 8, lineHeight: 1.6 },
  speakErr: { fontSize: 13.5 },
  // 涔卞簭妯″紡
  scrambleWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, maxWidth: 680 },
  scramblePool: { display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', minHeight: 50, alignItems: 'center' },
  scrambleChip: { padding: '9px 18px', borderRadius: 12, border: '1px solid', fontSize: 18, fontWeight: 600, cursor: 'pointer', transition: 'transform .12s, opacity .12s' },
  scrambleDone: { fontSize: 12.5, marginTop: 4 },
  scrambleHiddenInput: { position: 'absolute', opacity: 0, width: 1, height: 1, border: 'none', outline: 'none', pointerEvents: 'none' },
  // 闃呰棰勪範
  previewRoot: { minHeight: '100vh', padding: '30px 20px 90px', display: 'flex', justifyContent: 'center', fontFamily: FONT_STACK.system },
  previewCard: { width: 760, maxWidth: '94vw', borderRadius: 22, padding: 26, border: '1px solid' },
  previewTitle: { fontSize: 20, fontWeight: 800 },
  previewSub: { fontSize: 12.5, margin: '6px 0 18px' },
  previewList: { display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '56vh', overflowY: 'auto', paddingRight: 4 },
  previewLine: { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', borderRadius: 14, border: '1px solid' },
  previewNo: { fontSize: 13, fontWeight: 700, width: 22, flexShrink: 0, marginTop: 2 },
  previewBody: { flex: 1 },
  previewRu: { fontSize: 15.5, fontWeight: 600, cursor: 'pointer', lineHeight: 1.5 },
  previewZh: { fontSize: 12.5, marginTop: 3, opacity: .8 },
  previewPlay: { width: 40, height: 40, borderRadius: '50%', border: '1px solid', fontSize: 17, cursor: 'pointer', flexShrink: 0 },
  previewFoot: { display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 22 },
  previewBack: { padding: '9px 22px', borderRadius: 20, border: '1px solid', fontSize: 13.5, cursor: 'pointer' },
  previewStart: { padding: '9px 26px', borderRadius: 20, border: 'none', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' },
}

