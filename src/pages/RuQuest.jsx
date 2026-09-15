import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLevelVideos, LEVELS } from '../data/courseLibrary'
import { callAI } from '../lib/ai'
import { API_BASE } from '../lib/api'
import { toast } from '../lib/toast'
import { loadHotkeys, keysOfEvent } from '../components/SettingsModal'
import SettingsModal from '../components/SettingsModal'
import SummaryModal from '../components/quest/SummaryModal'           // P4 结算弹窗（评级+环形图+错题+撒花）
import GameSettingModal from '../components/quest/GameSettingModal'   // P4 游戏内设置（倍速/播放次数/间隔）
import GamePauseModal from '../components/quest/GamePauseModal'       // P4 暂停弹窗
import CourseContentsModal from '../components/quest/CourseContentsModal' // P4 本课内容面板（筛选+发音+跳转）
import DictationControls from '../components/quest/DictationControls'       // P5 听写模式播放控制栏（盲听/慢听/提示）
import LearningTimer from '../components/quest/LearningTimer'                 // P5 学习计时器（当前用时+今日累计）
import DesktopPet, { petSpeak, petSetMood } from '../components/quest/DesktopPet' // P6 桌面宠物
import WrongBookModal from '../components/quest/WrongBookModal'               // P6 错题本独立弹窗
import * as questSounds from '../lib/questSounds' // 官方句乐部 mp3 原声音效（键盘/答对/答错）

// ================= 工具 =================
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
const cleanWord = w => (w || '').replace(/[.,!?…;:—"«»()]/g, '')
const fmtTime = s => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60
  return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m + ':' + (ss < 10 ? '0' : '') + ss
}
const fmtScore = n => n.toLocaleString('en-US')

// ================= 课程库（俄语闯关课程，基于分级句子） =================
const COURSE_META = {
  A1: { title: '零基础生存俄语', subtitle: '打招呼 · 自我介绍 · 日常需求', emoji: '🌱', tag: '新手推荐', desc: '从最基础的词汇和短句开始，掌握打招呼、自我介绍、买东西等真实场景表达。' },
  A2: { title: '初级日常俄语', subtitle: '生活场景 · 购物 · 出行', emoji: '🚶', tag: '初级', desc: '围绕日常生活的真实场景，积累常用句型，学会表达时间、地点、喜好和需求。' },
  B1: { title: '中级进阶表达', subtitle: '观点 · 经历 · 社会话题', emoji: '💬', tag: '中级', desc: '能谈论自己的经历和观点，掌握更复杂的句型结构，表达更自然流畅。' },
  B2: { title: '高级流利输出', subtitle: '深度话题 · 复杂句型', emoji: '🎓', tag: '高级', desc: '挑战长句和复杂表达，掌握高级语法结构，能够就深度话题展开讨论。' },
}
const MODES = [
  { key: 'chinese_to_english', name: '中译俄模式', tag: '初级', rec: '新手推荐', desc: '看到中文提示，尝试用俄语表达。练习运用所学词汇和语法。' },
  { key: 'dictation', name: '听写模式', tag: '初级', desc: '听俄语原声，把听到的句子写下来。锻炼听力与拼写。' },
  { key: 'speaking', name: '口语评测模式', tag: '初级', desc: '先听标准发音，跟读录音，AI 实时评分并纠正发音。' },
  { key: 'scramble', name: '乱序模式', tag: '中级', desc: '句子单词顺序打乱，通过点击或键盘重组完整句子。' },
  { key: 'reading', name: '阅读模式', tag: '初级', desc: '先全文通读 + 逐句跟读预习，再开始打字答题。' },
]
const DIFFS = ['自定义', '初级', '中级', '高级']

// ================= 俄语鼓励词 =================
const PRAISE = ['Молодец!', 'Отлично!', 'Супер!', 'Прекрасно!', 'Великолепно!', 'Так держать!', 'Замечательно!', 'Браво!']
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

// ================= 音效系统（Web Audio 合成 · 可配置） =================
let audioCtx = null
const SFX_DEFAULT = {
  enabled: true,   // 全局音效总开关（一键静音）
  vol: 0.7,        // 全局音量 0~1
  keyOn: true,     // 按键音效开关
  keyType: 'soft', // 按键音风格：soft 轻柔 / drum 鼓点 / bubble 气泡 / typewriter 打字机 / sword 金属剑 / cherryBlue 青轴 / cherryRed 红轴
  keyVol: 1,       // 打字音效音量 0~1（声音设置页滑块，默认100%）
  answerOn: true,  // 答题反馈音效开关
  answerVol: 1,    // 反馈音效音量 0~1（声音设置页滑块，默认100%）
  comboAnim: true, // 连击动画开关（与连击音效联动）
  comboFx: true,   // 连击激励音效开关
  sceneOn: true,   // 场景功能音效开关
}
let SFX_CFG = { ...SFX_DEFAULT }
const loadSfxCfg = () => {
  try {
    const s = JSON.parse(localStorage.getItem('rlearn_quest_sfx') || 'null')
    if (s) SFX_CFG = { ...SFX_DEFAULT, ...s }
  } catch (e) { /* 忽略 */ }
}
const saveSfxCfg = (patch) => {
  SFX_CFG = { ...SFX_CFG, ...patch }
  try { localStorage.setItem('rlearn_quest_sfx', JSON.stringify(SFX_CFG)) } catch (e) { /* 忽略 */ }
}
loadSfxCfg()
function ac() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {})
    return audioCtx
  } catch (e) { return null }
}
// 当前音效类别（'key' 按键 / 'answer' 反馈 / '' 其他），用于按类别应用独立音量
let sfxKind = ''
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
  } catch (e) { /* 忽略 */ }
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
  } catch (e) { /* 忽略 */ }
}
// —— 一、按键音效组（7 种风格） ——
const KEY_FX = {
  soft: () => playTone(1560, 0.03, 'sine', 0.05, 0, null, 'key'),                                                     // 默认轻柔按键音
  drum: () => { playNoise(0.06, 0.07, 0, 'key'); playTone(120, 0.07, 'sine', 0.09, 0, 80, 'key') },                    // 鼓点打击乐
  bubble: () => playTone(420, 0.07, 'sine', 0.06, 0, 1300, 'key'),                                           // 气泡破裂（上滑）
  typewriter: () => { playTone(950, 0.02, 'square', 0.035, 0, null, 'key'); playNoise(0.015, 0.025, 0, 'key') },                // 复古打字机
  sword: () => playTone(2300, 0.07, 'sawtooth', 0.045, 0, 900, 'key'),                                       // 金属剑音（扫频）
  cherryBlue: () => { playTone(1650, 0.018, 'square', 0.05, 0, null, 'key'); playTone(720, 0.03, 'triangle', 0.04, 0.03, null, 'key') }, // Cherry 青轴（咔嗒+触底）
  cherryRed: () => { playTone(1050, 0.015, 'square', 0.04, 0, null, 'key'); playNoise(0.012, 0.018, 0, 'key') },                // Cherry 红轴（柔短闷响）
}
// 按键音效：默认「轻柔按键音」= 官方句乐部 typing.mp3 原声（百分百复刻键盘声）；其余 6 种风格为合成音
const sfxKey = () => {
  if (!SFX_CFG.enabled || !SFX_CFG.keyOn) return
  if (SFX_CFG.keyType === 'soft') { questSounds.ensureTypingSound(); questSounds.playTypingSound(); return }
  ;(KEY_FX[SFX_CFG.keyType] || KEY_FX.soft)()
}
// —— 二、答题反馈音效组（官方 mp3 原声：答对 right.mp3 / 答错 error.mp3） ——
const withAnswerVol = (fn) => { const _k = sfxKind; sfxKind = 'answer'; try { fn() } finally { sfxKind = _k } }
const sfxPerfect = () => { if (!SFX_CFG.enabled || !SFX_CFG.answerOn) return; withAnswerVol(() => questSounds.playRightSound()) } // 无修改全对：官方答对原声
const sfxGreat = () => { if (!SFX_CFG.enabled || !SFX_CFG.answerOn) return; withAnswerVol(() => questSounds.playRightSound()) } // 有修改后答对：官方答对原声
const sfxError = () => { if (!SFX_CFG.enabled || !SFX_CFG.answerOn) return; withAnswerVol(() => questSounds.playErrorSound()) } // 答错：官方错误原声（与抖动同步）
const sfxSentence = () => { if (!SFX_CFG.enabled || !SFX_CFG.answerOn) return; withAnswerVol(() => questSounds.playRightSound()) } // 整句完成：官方答对原声收尾
// —— 三、连击激励音效组（需 连击动画 + 连击音效 两开关同时开启） ——
const sfxCombo = (level) => {
  if (!SFX_CFG.enabled || !SFX_CFG.comboFx || !SFX_CFG.comboAnim) return
  withAnswerVol(() => {
  if (level >= 10) { // 高燃冲刺
    playTone(523, 0.06, 'square', 0.07); playTone(659, 0.06, 'square', 0.07, 0.05); playTone(784, 0.06, 'square', 0.07, 0.1); playTone(1046, 0.06, 'square', 0.07, 0.15); playTone(1318, 0.08, 'square', 0.07, 0.2); playTone(1568, 0.22, 'square', 0.08, 0.25); playNoise(0.18, 0.05, 0.1)
  } else if (level >= 6) { // 递进节奏
    playTone(523, 0.07, 'triangle', 0.08); playTone(659, 0.07, 'triangle', 0.08, 0.06); playTone(784, 0.07, 'triangle', 0.08, 0.12); playTone(1046, 0.16, 'triangle', 0.09, 0.18)
  } else { // 3-5 连击：基础轻快激励
    playTone(523, 0.09, 'triangle', 0.08); playTone(784, 0.16, 'triangle', 0.09, 0.08)
  }
  })
}
const sfxComboBreak = () => { if (!SFX_CFG.enabled || !SFX_CFG.comboFx || !SFX_CFG.comboAnim) return; withAnswerVol(() => { playTone(784, 0.1, 'sine', 0.06, 0, 480) }) } // 连击中断：轻微回落
// —— 四、场景功能音效组 ——
const sfxScene = () => { if (!SFX_CFG.enabled || !SFX_CFG.sceneOn) return; withAnswerVol(() => { playTone(523, 0.07, 'triangle', 0.06); playTone(784, 0.1, 'triangle', 0.06, 0.06) }) } // 页面切换/切题过渡
const sfxFunc = () => { if (!SFX_CFG.enabled || !SFX_CFG.sceneOn) return; withAnswerVol(() => { playTone(880, 0.04, 'sine', 0.045) }) } // 功能操作（发音/生词/答案）轻量确认
const sfxRating = (label) => { // 结算评级成就音
  if (!SFX_CFG.enabled || !SFX_CFG.sceneOn) return
  withAnswerVol(() => {
  const seq = { SSS: [523, 659, 784, 1046, 1318, 1568], SS: [523, 659, 784, 1046], S: [523, 659, 784], A: [523, 659], B: [523], C: [392, 330] }[label] || [523]
  seq.forEach((f, i) => playTone(f, label === 'SSS' ? 0.16 : 0.1, label === 'SSS' ? 'sine' : 'triangle', 0.09, i * 0.09))
  if (label === 'SSS') playTone(2093, 0.5, 'sine', 0.05, 0.5)
  })
}

// ================= 模块1.1 字体与字号体系 =================
// 字体规则：俄文+中文统一系统默认无衬线；可选 Nunito/Fredoka 圆润英文字体切换（只覆盖拉丁字符，其余自动回退）
// P5 新增 Nunito（官方句乐部同款圆润字体）
const FONT_STACK = {
  system: "-apple-system,'Segoe UI','PingFang SC','Microsoft YaHei','Noto Sans','Helvetica Neue',sans-serif",
  nunito: "'Nunito',-apple-system,'Segoe UI','PingFang SC','Microsoft YaHei','Noto Sans','Helvetica Neue',sans-serif",
  fredoka: "'Fredoka',-apple-system,'Segoe UI','PingFang SC','Microsoft YaHei','Noto Sans',sans-serif",
}
// 字号分级：小 / 中 / 大 三档，默认中
const Q_SIZE = { 小: 24, 中: 30, 大: 38 }   // 核心题干（页面最高视觉层级）
const S_WORD = { 小: 16, 中: 20, 大: 26 }   // 重音·输入词块
const S_ROLE = { 小: 24, 中: 30, 大: 38 }   // 重音·答案词
const S_BIG  = { 小: 32, 中: 42, 大: 54 }   // 重音·答案大词
const AUX_SIZE = { 小: 11, 中: 12.5, 大: 14 } // 辅助文字（顶部进度条/底部操作栏/提示文案，比题干低2个层级，跟随题干档位自动适配）

// ================= 模块1.2 全局配色体系（浅色默认 + 3 种护眼主题） =================
const THEMES = {
  light: { name: '浅色', bg: '#FFFFFF', bgSoft: '#F6F6F8', panel: '#FFFFFF', text: '#3A3A3A', textStrong: '#1C1C1E', sub: '#8E8E93', border: '#E4E4E7', brand: '#7C5CFC', brandSoft: 'rgba(124,92,252,.10)', ok: '#22C55E', okSoft: 'rgba(34,197,94,.12)', err: '#EF4444', errSoft: 'rgba(239,68,68,.10)', aiBg: '#FBFBFD', aiBorder: '#ECE9F4', shadow: '0 12px 44px rgba(60,40,120,.14)', grad: 'linear-gradient(160deg,#F7F6FB 0%,#FFFFFF 45%)' },
  dark: { name: '深色', bg: '#0D0918', bgSoft: '#16111F', panel: '#1B1330', text: '#F5EDE2', textStrong: '#FFFFFF', sub: '#8B7FA3', border: 'rgba(255,255,255,.12)', brand: '#8B5CF6', brandSoft: 'rgba(139,92,246,.16)', ok: '#10B981', okSoft: 'rgba(16,185,129,.2)', err: '#F87171', errSoft: 'rgba(239,68,68,.15)', aiBg: 'rgba(20,14,36,.94)', aiBorder: 'rgba(255,255,255,.07)', shadow: '0 18px 60px rgba(0,0,0,.5)', grad: 'radial-gradient(ellipse at 50% -20%, #241A3D 0%, #0D0918 55%)' },
  warm: { name: '暖色护眼', bg: '#FAF3E7', bgSoft: '#F3E9D7', panel: '#FFFDF7', text: '#4A3F33', textStrong: '#2E2620', sub: '#9A8A76', border: '#E5D9C7', brand: '#B0793B', brandSoft: 'rgba(176,121,59,.12)', ok: '#4C9A57', okSoft: 'rgba(76,154,87,.12)', err: '#C0564B', errSoft: 'rgba(192,86,75,.12)', aiBg: '#FBF6EC', aiBorder: '#EFE3D0', shadow: '0 12px 40px rgba(74,63,51,.10)', grad: 'linear-gradient(160deg,#F7EFE0 0%,#FAF3E7 45%)' },
  green: { name: '绿色护眼', bg: '#EAF4EA', bgSoft: '#DEEBDE', panel: '#F5FBF5', text: '#2F4432', textStrong: '#1F2E21', sub: '#7E9783', border: '#CFE0CF', brand: '#3E8E4E', brandSoft: 'rgba(62,142,78,.12)', ok: '#2E9E4F', okSoft: 'rgba(46,158,79,.12)', err: '#C14B4B', errSoft: 'rgba(193,75,75,.12)', aiBg: '#F0F8F0', aiBorder: '#DCEBDC', shadow: '0 12px 40px rgba(31,46,33,.10)', grad: 'linear-gradient(160deg,#E2F0E2 0%,#EAF4EA 45%)' },
}
// 词性标注：不同词性使用不同下划线颜色；posMark=false 时隐藏
const POS_COLORS = {
  'сущ.': '#3B82F6', '名词': '#3B82F6',
  'гл.': '#22C55E', '动词': '#22C55E',
  'прил.': '#F59E0B', '形容词': '#F59E0B',
  'нар.': '#8B5CF6', '副词': '#8B5CF6',
  'мест.': '#EC4899', '代词': '#EC4899',
  'предл.': '#14B8A6', '介词': '#14B8A6',
  'союз': '#EF4444', '连词': '#EF4444',
}
const posColor = (pos) => { for (const k in POS_COLORS) { if ((pos || '').includes(k)) return POS_COLORS[k] } return '#9CA3AF' }
const UI_DEFAULT = { font: 'system', qSize: '中', sSize: '中', theme: 'light', inputStyle: 'dynamic', answerMode: 'float', posMark: true, autoSpeak: false, speakTimes: 2, speakSpeed: 1, speakGap: 1, answerSpeak: false, autoNext: false, ignoreCase: true, showImage: true, imgPos: 'center', imgSize: 'mid', autoReveal: '3', wrongRec: '3', learnDefault: '初级', showProgress: true, showStruct: true, structStyle: 'outline', showWordTrans: true, skipNames: true, showPos: true, posStyle: 'color_text', posColors: { '名词': '#3b82f6', '动词': '#22c55e', '形容词': '#8b5cf6', '副词': '#eab308', '代词': '#ef4444', '介词': '#1e40af', '并列连词': '#f43f5e', '从属连词': '#f43f5e', '感叹词': '#f97316', '限定词': '#14b8a6', '助动词': '#22c55e', '专有名词': '#3b82f6', '人名': '#3b82f6', '数词': '#8b5cf6', '助词': '#9ca3af' }, posVis: { '名词': true, '动词': true, '形容词': true, '副词': true, '代词': true, '介词': true, '并列连词': true, '从属连词': true, '感叹词': true, '限定词': true, '助动词': true, '专有名词': true, '人名': true, '数词': true, '助词': true } }
// 朗读速度档位（0.5x ~ 2x）
const SPEED_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]
// 两遍朗读之间的停顿间隔（秒）
const GAP_STEPS = [0.3, 0.5, 0.8, 1]

// ================= 主组件 =================
export default function RuQuest() {
  const navigate = useNavigate()
  // 阶段：courses 课程选择 / lessons 课列表 / preview 阅读预习 / loading 准备 / game 答题 / result 结算
  const [phase, setPhase] = useState('courses')
  const [curLevel, setCurLevel] = useState('A1')
  const [lessons, setLessons] = useState([])       // 当前课程的全部课
  const [curLesson, setCurLesson] = useState(null) // 当前课
  const [mode, setMode] = useState(() => {
    try { return localStorage.getItem('rlearn_quest_mode') || 'chinese_to_english' } catch (e) { return 'chinese_to_english' }
  })
  const [modeOpen, setModeOpen] = useState(false)  // 答题页内模式切换面板
  const [moreOpen, setMoreOpen] = useState(false)    // 工具栏「更多」溢出菜单（保留扩展功能入口）

  // 答题状态
  const [questions, setQuestions] = useState([])   // 本课全部题（每词一题 + 整句一题）
  const [qi, setQi] = useState(0)                  // 全局题号 (x/总)
  const [score, setScore] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [startAt, setStartAt] = useState(0)
  const [combo, setCombo] = useState(0)
  const [maxCombo, setMaxCombo] = useState(0)
  const [paused, setPaused] = useState(false)            // 暂停状态
  const [showSettings, setShowSettings] = useState(false) // 设置弹窗（快捷键/播放/听力等配置，仅俄语闯关页内打开）
  const [gameSettingOpen, setGameSettingOpen] = useState(false) // P4 游戏内设置弹窗（倍速/播放次数/间隔）
  const [dictTipVisible, setDictTipVisible] = useState(false)    // P5 听写模式答案提示显示状态
  const [wrongBookOpen, setWrongBookOpen] = useState(false)      // P6 错题本独立弹窗
  const [petVisible, setPetVisible] = useState(true)              // P6 桌面宠物可见性
  const [comboPop, setComboPop] = useState(null)         // 连击浮动文字 {n, high}
  const [comboBreak, setComboBreak] = useState(false)    // 连击中断回落
  const [perfect, setPerfect] = useState(0)
  const [good, setGood] = useState(0)
  const [skipped, setSkipped] = useState(0)
  const [acc, setAcc] = useState({ answered: 0, correct: 0, firstHit: 0 })
  // 结算与闭环：本次练习错题记录 / 结算页错题回顾弹层
  const [wrongList, setWrongList] = useState([])
  const [resultWrong, setResultWrong] = useState(false)
  // 单题状态
  const [typed, setTyped] = useState('')           // 输入串（空格分隔的词，透明输入框真实值）
  const [chunks, setChunks] = useState([])         // 输入拆词（兼容乱序/撤销）
  const [wrong, setWrong] = useState(false)
  const [wrongCount, setWrongCount] = useState(0)
  // —— 官方连词成句状态机（移植自 earthworm apps/client/composables/main/question.ts，俄语适配） ——
  // mode: input 正常输入 / fix 提交后有错误 / fix_input 正在修改某个错误词
  const [fixMode, setFixMode] = useState('input')
  const [editIdx, setEditIdx] = useState(-1)       // fix_input 正在编辑的错误词下标
  const [slotState, setSlotState] = useState({ incorrect: [], active: -1 }) // 错误词下标集 + 当前激活词下标
  const [done, setDone] = useState(false)          // 当前题答对
  const [showAnswer, setShowAnswer] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [analysing, setAnalysing] = useState(false)
  const [praise, setPraise] = useState('')
  const [stuckOpen, setStuckOpen] = useState(false) // 卡住了吗
  const [loadPct, setLoadPct] = useState(0)
  // 口语评测（模式 speaking）
  const [recording, setRecording] = useState(false)
  const [recDur, setRecDur] = useState(0)
  const [speakLoading, setSpeakLoading] = useState(false)
  const [speakResult, setSpeakResult] = useState(null)
  const [recordingUrl, setRecordingUrl] = useState('')   // 最近一次口语录音的本地回放地址
  const mediaRecRef = useRef(null)
  const recChunks = useRef([])
  const recTimer = useRef(null)
  // 乱序模式（scramble）
  const [scramblePicked, setScramblePicked] = useState([])
  // 掌握/生词
  const [mastered, setMastered] = useState(() => JSON.parse(localStorage.getItem('rlearn_quest_mastered') || '[]'))
  const [vocabNote, setVocabNote] = useState(() => JSON.parse(localStorage.getItem('rlearn_quest_vocab') || '[]'))
  // AI 助手
  const [aiThread, setAiThread] = useState([])
  const [aiBusy, setAiBusy] = useState(false)
  const [aiQ, setAiQ] = useState('')
  // 页面功能控件：顶部工具栏收起/展开、AI 侧栏唤起、本课内容、撤销栈
  const [topExpanded, setTopExpanded] = useState(false)   // 顶部功能栏展开（hover 或点击展开按钮）
  const [aiOpen, setAiOpen] = useState(false)             // 右下角悬浮图标唤起侧边AI助手（默认收起，不遮挡答题区）
  const [contentOpen, setContentOpen] = useState(false)   // 本课内容面板（句子列表 + 跳转）
  const undoStack = useRef([])                            // 输入撤销栈（Ctrl+Z 回退上一步输入）
  const composing = useRef(false)                         // 中文输入法组合中（官方：composition 期间不触发提交）
  // 模块1.1 外观设置（字体 + 字号档位）
  const [uiOpen, setUiOpen] = useState(false)
  const [ui, setUi] = useState(() => {
    try { return { ...UI_DEFAULT, ...(JSON.parse(localStorage.getItem('rlearn_quest_ui') || '{}') || {}) } } catch { return { ...UI_DEFAULT } }
  })
  // 主题派生：外观页「主题设置」强制浅/深；跟随系统时由「练习背景色」决定（默认/暖色/绿色）
  const themeOf = () => {
    if (ui.themeMode === 'light') return 'light'
    if (ui.themeMode === 'dark') return 'dark'
    if (ui.bgColor === 'warm') return 'warm'
    if (ui.bgColor === 'green') return 'green'
    return 'light'
  }
  const uiCfg = { font: ui.font || 'system', qSize: ui.qSize || '中', sSize: ui.sSize || '中', theme: themeOf(), themeMode: ui.themeMode || 'auto', bgColor: ui.bgColor || 'default', inputStyle: ui.inputStyle || 'dynamic', answerMode: ui.answerMode || 'float', posMark: ui.posMark !== false, autoSpeak: !!ui.autoSpeak, speakTimes: ui.speakTimes || 2, speakSpeed: ui.speakSpeed || 1, speakGap: ui.speakGap ?? 1, answerSpeak: !!ui.answerSpeak, autoNext: !!ui.autoNext, ignoreCase: ui.ignoreCase !== false, showImage: ui.showImage !== false, imgPos: ui.imgPos || 'center', imgSize: ui.imgSize || 'mid', autoReveal: ui.autoReveal || '3', wrongRec: ui.wrongRec || '3', learnDefault: ui.learnDefault || '初级', showProgress: ui.showProgress !== false, showStruct: ui.showStruct !== false, structStyle: ui.structStyle || 'outline', showWordTrans: ui.showWordTrans !== false, skipNames: ui.skipNames !== false, showPos: ui.showPos !== false, posStyle: ui.posStyle || 'color_text', posColors: ui.posColors || UI_DEFAULT.posColors, posVis: ui.posVis || UI_DEFAULT.posVis, showScore: ui.showScore !== false, bgImage: ui.bgImage || null }
  // 练习背景图（外观页上传，覆盖在主题渐变之上）
  const bgImageStyle = uiCfg.bgImage ? { backgroundImage: 'url(' + uiCfg.bgImage + ')', backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' } : null
  // 答题校验：忽略大小写（默认开）→ 小写归一；关闭 → 严格大小写
  const normFor = (w) => { const c = cleanWord(w || ''); return uiCfg.ignoreCase ? stripStress(c).toLowerCase().trim() : stripStress(c).trim() }
  const recThreshold = { '3': 3, '2': 2, '1': 1, always: 1 }[uiCfg.wrongRec] || 3        // 记录到错题本阈值
  const revealThreshold = { '3': 3, '2': 2, '1': 1, off: 99 }[uiCfg.autoReveal] || 3     // 自动显示答案阈值
  const saveUi = useCallback((patch) => {
    const n = { ...uiCfg, ...patch }
    setUi(n)
    try { localStorage.setItem('rlearn_quest_ui', JSON.stringify(n)) } catch { /* 忽略 */ }
  }, [uiCfg])
  // 选择 Fredoka 时动态加载字体（加载失败自动回退系统字体）
  useEffect(() => {
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

  // —— 课程/题库 ——
  const poolOf = useCallback((lv) => {
    const sents = []
    for (const { video } of getLevelVideos(lv)) {
      for (const s of video.sentences || []) {
        if (s.russian && s.russian.trim()) sents.push({ ...s, source: video.title })
      }
    }
    return sents
  }, [])

  // 生成课程（每课 10 句）
  const buildLessons = useCallback((lv) => {
    const pool = shuffle(poolOf(lv))
    const list = []
    for (let i = 0; i < pool.length; i += 10) {
      list.push({ id: lv + '_L' + String(list.length + 1).padStart(2, '0'), idx: list.length + 1, sentences: pool.slice(i, i + 10) })
    }
    return list.slice(0, 8)
  }, [poolOf])

  const lessonsByLevel = useMemo(() => {
    const m = {}
    for (const lv of LEVELS) m[lv] = buildLessons(lv)
    return m
  }, [buildLessons])

  // 拉取一句的逐词词典（复用 /api/dict，带缓存）
  const fetchDict = useCallback(async (word) => {
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

  // 生成课内题目（前缀累加渐进式：逐词打基础 → 每2词前缀累加 → 整句收尾）
  const buildQuestions = useCallback(async (lesson) => {
    const qs = []
    for (const s of lesson.sentences) {
      const ws = s.russian.trim().split(/\s+/).filter(Boolean)
      if (ws.length === 0) continue
      // 单词句：直接一道整句题，避免重复
      if (ws.length === 1) {
        qs.push({ s, partIdx: 1, partTotal: 1, full: true, zh: s.chinese || '', answer: s.russian, wordCount: 1, id: s.id + '_full' })
        continue
      }
      let lastPrefixEnd = 0
      for (let i = 0; i < ws.length; i++) {
        // ① 逐词题：每个词单独一题，打好基础
        qs.push({ s, partIdx: i + 1, partTotal: ws.length, full: false, zh: s.chinese || '', answer: ws[i], wordCount: 1, id: s.id + '_w' + i })
        // ② 前缀累加题：每学完2个词（且非最后一词），用前面所有词组合检验
        if ((i + 1) % 2 === 0 && i < ws.length - 1) {
          const prefix = ws.slice(0, i + 1).join(' ')
          qs.push({ s, partIdx: i + 1, partTotal: ws.length, full: true, zh: s.chinese || '', answer: prefix, wordCount: i + 1, id: s.id + '_p' + (i + 1) })
          lastPrefixEnd = i + 1
        }
      }
      // ③ 整句题：最后收尾（若上一次累加未覆盖整句）
      if (lastPrefixEnd < ws.length) {
        qs.push({ s, partIdx: ws.length, partTotal: ws.length, full: true, zh: s.chinese || '', answer: s.russian, wordCount: ws.length, id: s.id + '_full' })
      }
    }
    return qs
  }, [])

  // —— 开始一课（支持恢复上次进度；reading 模式先进预习） ——
  const startLesson = async (lesson, resume) => {
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

  // —— 进度自动保存（切换题目/离开时写入 localStorage） ——
  const saveProgress = useCallback(() => {
    if (!curLesson) return
    try {
      localStorage.setItem('rlearn_quest_progress', JSON.stringify({
        lessonId: curLesson.id, qi, score, elapsed, combo, maxCombo, perfect, good, skipped, acc,
        updatedAt: Date.now(),
      }))
    } catch (e) { /* 忽略 */ }
  }, [curLesson, qi, score, elapsed, combo, maxCombo, perfect, good, skipped, acc])

  // —— 加载题目 ——
  const loadQuestion = useCallback((idx) => {
    const q = questions[idx]
    if (!q) return
    setTyped(''); setChunks([]); setWrong(false); setWrongCount(0); setDone(false); setShowAnswer(false)
    setFixMode('input'); setEditIdx(-1); setSlotState({ incorrect: [], active: -1 })
    setPraise(''); setAnalysis(analysisCache.current[q.id] || null); setAnalysing(false)
    setStuckOpen(false)
    setScramblePicked([])          // 乱序模式：重置已选
    setSpeakResult(null); setSpeakLoading(false); setRecording(false) // 口语模式：重置
  }, [questions])

  useEffect(() => {
    if (phase === 'game' && questions.length) loadQuestion(qi)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qi, phase])

  useEffect(() => {
    if (phase !== 'game' || paused) return
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startAt) / 1000)), 1000)
    return () => clearInterval(t)
  }, [phase, startAt, paused])

  // 自动聚焦输入
  useEffect(() => {
    if (phase === 'game') {
      const t = setTimeout(() => inputRef.current?.focus(), 80)
      return () => clearTimeout(t)
    }
  }, [phase, qi, done])

  // —— 发音（speed: 0.5~2.0，走后端 /api/tts?rate=） ——
  const speak = useCallback((text, speed) => {
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

  // —— 可配置快捷键动作（设置弹窗可改键位，配置存 rlearn_quest_hotkeys） ——
  const playWordByWord = () => {
    if (!cur) { toast('请先进入一课'); return }
    const ws = cur.s.russian.trim().split(/\s+/)
    ws.forEach((w, i) => setTimeout(() => speak(w), i * 900))
    toast('逐词播放：' + ws.length + ' 个单词')
  }
  const playCurrentWordFn = () => {
    if (!cur) { toast('请先进入一课'); return }
    const ws = typed.trim() ? typed.trim().split(/\s+/) : cur.answer.trim().split(/\s+/)
    speak(ws[ws.length - 1] || cur.answer)
  }
  const playRecordingFn = () => {
    if (recordingUrl) { const a = new Audio(recordingUrl); a.play().catch(() => {}); return }
    toast('暂无录音可播放，请先在口语评测中录音')
  }
  const hotActionsRef = useRef({})
  hotActionsRef.current = { playWordByWord, playCurrentWordFn, playRecordingFn, startRec: () => startRec(), stopRec: () => stopRec(), showAnswerNow: () => showAnswerNow() }

  // —— 先读后写：进入新题自动朗读（听写模式默认自动播；autoSpeak 开关控制其他模式） ——
  // P5 听写模式自动播放读取游戏设置工具栏（倍速/次数/间隔），其他模式用外观页朗读设置
  useEffect(() => {
    if (phase !== 'game' || !cur) return
    if (done || mode === 'speaking') return
    const needAuto = mode === 'dictation' || uiCfg.autoSpeak
    if (!needAuto) return
    let times, speed, gap
    if (mode === 'dictation') {
      // P5 听写模式：从游戏设置工具栏读取配置
      try {
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

  // —— AI 拆解（答案卡） ——
  const fetchAnalysis = useCallback(async (q) => {
    if (!q) return
    if (analysisCache.current[q.id]) { setAnalysis(analysisCache.current[q.id]); return }
    setAnalysing(true)
    try {
      const content = await callAI([
        { role: 'system', content: '你是俄语老师。把用户给的俄语句子逐词拆解并按语法成分分组，严格只输出 JSON，不要任何解释。JSON 格式：{"zh":"整句中文翻译","roles":[{"role":"主语","words":[{"word":"原词","stress":"带重音的规范词形(重音元音后用\'\u0301\'标)","pos":"词性(中文)","zh":"中文释义"}]}]}，roles 按 主语/谓语/宾语/定语/状语 等成分分组，按句子实际成分输出' },
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

  // —— 暂停/恢复（恢复时固化已计时，避免暂停时长计入） ——
  const resumePause = () => {
    if (paused) { setStartAt(Date.now() - elapsed * 1000); setPaused(false) }
  }
  const togglePause = () => {
    if (paused) resumePause()
    else { setPaused(true); try { audioRef.current?.pause() } catch (e) { /* 忽略 */ } }
  }
  // 逐字错误：强制重触发输入行抖动动画（不打断输入）
  const shakeRow = () => {
    const el = inputRowRef.current
    if (!el) return
    el.style.animation = 'none'
    void el.offsetWidth
    el.style.animation = 'ruqShake .3s ease'
  }

  // —— 提交（官方逐词校验 + Fix 修复流：有错时自动进入修复模式，改对后 Great） ——
  const submit = useCallback(() => {
    if (done || !cur) return
    if (fixMode === 'fix') return                    // Fix 待命：等用户按键进入修改，不重复提交
    const exp = expectWordsOf(cur)
    const parts = typed.split(' ')
    // 官方校验：逐词对比（词槽数 = 期望词数；多余输入忽略）
    const incorrectIdx = []
    for (let i = 0; i < exp.length; i++) {
      const u = parts[i] !== undefined ? parts[i] : ''
      if (normFor(cleanWord(u)) !== exp[i]) incorrectIdx.push(i)
    }
    const ok = incorrectIdx.length === 0 && parts.length >= exp.length
    if (ok) {
      setDone(true)
      setFixMode('input'); setEditIdx(-1); setSlotState({ incorrect: [], active: -1 })
      const isPerfect = wrongCount === 0 // 无修改全对 = Perfect；有修改后答对 = Great
      const nc = combo + 1
      setCombo(nc); setMaxCombo(m => Math.max(m, nc))
      // 渐进式三档分值：逐词题300 / 前缀累加题500 / 整句题700
      const isSentenceFinal = cur.partIdx === cur.partTotal
      const base = !cur.full ? 300 : (isSentenceFinal ? 700 : 500)
      setScore(s => s + base + Math.min(500, combo * 50))
      setPerfect(p => p + 1)
      setAcc(a => ({ ...a, answered: a.answered + 1, correct: a.correct + 1, firstHit: a.firstHit + (isPerfect ? 1 : 0) }))
      if (wrongCount > 0 && wrongCount >= recThreshold) recordWrong(cur, parts.slice(0, exp.length).join(' ') || '（有修改后答对）', wrongReasonOf(cur, parts.slice(0, exp.length).map(cleanWord).map(normFor)))
      if (isPerfect) sfxPerfect(); else sfxGreat()          // 答对反馈：Perfect 清亮 / Great 柔和
      if (petVisible) { petSpeak('correct', 4000); petSetMood(isPerfect ? 'excited' : 'happy') } // P6 宠物答对互动
      if (isSentenceFinal) sfxSentence()                     // 仅整句题播放收尾音
      if (nc >= 3 && isPerfect) sfxCombo(nc)                 // 连击激励（3-5 / 6-10 / 10+）
      if (nc >= 3 && SFX_CFG.comboAnim) {                    // 连击动效：Perfect × N 浮动文字（10+ 高亮发光+全屏闪效）
        setComboPop({ n: nc, high: nc >= 10 })
        setTimeout(() => setComboPop(null), 420)
      }
      const p = pickPraise()
      setPraise(p)
      speak(p)
      if (uiCfg.answerSpeak) speak(cur.s.russian)   // 「显示答案时自动朗读」开关（默认关）
      fetchAnalysis(cur)
      if (uiCfg.autoNext) setTimeout(nextQ, 750)    // 「答题正确后自动下一题」开关（默认关，延迟让反馈可见）
    } else {
      setWrong(true)
      setWrongCount(c => c + 1)
      const wc = wrongCount + 1
      const inputChunks = parts.slice(0, exp.length).filter(Boolean)
      if (wc >= recThreshold) recordWrong(cur, inputChunks.join(' ') || '（答题错误）', wrongReasonOf(cur, parts.slice(0, exp.length).map(cleanWord).map(normFor)))
      if (combo >= 3) {                             // 连击中断：回落音 + 轻微视觉回落
        sfxComboBreak()
        setComboBreak(true)
        setTimeout(() => setComboBreak(false), 560)
      }
      setCombo(0)
      sfxError()
      if (petVisible) { petSpeak('wrong', 4000); petSetMood('thinking') } // P6 宠物答错鼓励
      if (wc >= revealThreshold) showAnswerNow()    // 「自动显示答案」：错误 N 次后自动展示答案
      else if (wc >= 3) setStuckOpen(true)          // 未开启自动显示时，保留原「答错3次提示看答案」
      // 官方 Fix 修复流：标记错误词并进入修复模式（按任意键清空第一个错误词重打）
      setSlotState({ incorrect: incorrectIdx, active: -1 })
      setFixMode('fix')
    }
  }, [done, cur, typed, fixMode, combo, wrongCount, speak, fetchAnalysis, uiCfg.answerSpeak, uiCfg.autoNext, uiCfg.wrongRec, uiCfg.autoReveal, recThreshold, revealThreshold])

  // —— 撤销：回退上一步输入（Ctrl+Z，仅标准输入模式；须在全局快捷键 effect 之前定义） ——
  const undo = useCallback(() => {
    if (mode === 'scramble') { toast('乱序模式不支持撤销'); return }
    if (!undoStack.current.length) { toast('没有可撤销的输入'); return }
    const prev = undoStack.current.pop()
    setTyped(prev)
    setChunks(prev.trim() ? prev.trim().split(/\s+/) : [])
    setWrong(false)
    setFixMode('input'); setEditIdx(-1); setSlotState(s => ({ ...s, incorrect: [], active: -1 }))
    sfxFunc()
  }, [mode])

  // —— 输入处理（官方连词成句：透明输入框 + 单词下划线槽，空格分词） ——
  // 期望词（去重音/标点/小写归一后的规范词）
  const expectWordsOf = (q) => (q?.answer || '').trim().split(/\s+/).filter(Boolean).map(cleanWord).map(normFor)
  const onInputChange = (e) => {
    if (done) return
    const v = e.target.value
    // 撤销栈：每次输入变化压入上一步值（仅 insertText，栈深限 50）
    if (e.nativeEvent?.inputType === 'insertText' && v !== typed) {
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
    // 光标变化 → 更新激活词（官方：光标所在词高亮）
    const pos = e.target.selectionStart ?? v.length
    setSlotState(s => ({ ...s, active: activeFromCursor(v, pos) }))
  }

  // 由光标位置计算激活词下标（词 i 覆盖 [start_i, end_i]）
  const activeFromCursor = (val, pos) => {
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

  // 清空第 idx 个槽的输入并把光标移到该词开头（Fix 修复流）
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
    if (done) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nextQ() } return } // 官方 Answer：空格/Enter 下一题
    // Ctrl+Z 撤销（用户快捷键规范保留；须在 Ctrl 全拦截之前）
    if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); undo(); return }
    // Windows：Ctrl+Backspace 删除上一个单词（官方扩展，兼容某些浏览器 input 不支持 ctrl+backspace）
    if (e.ctrlKey && e.key === 'Backspace') { e.preventDefault(); deletePrevWordOnWin(); return }
    // 官方：Ctrl 键全拦截（避免中文输入法预输入上屏 / 触发异常）
    if (e.ctrlKey) { e.preventDefault(); return }
    if (e.key === 'Escape') { e.preventDefault(); inputRef.current?.blur(); return }
    // 官方：全部方向键禁止（避免光标乱跑导致激活词错乱）
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); return }
    // 官方 Fix 修复流：提交有错后，按任意键（含空格/退格，仅 preventDefault 不上屏）→ 定位并清空第一个错误词进入修改
    if (fixMode === 'fix') {
      if (e.key === 'Enter') return // 官方：Fix 态 Enter 无动作（submitAnswer 在 Fix 下直接 return）
      if (e.key === 'Space' || e.key === 'Backspace') e.preventDefault()
      const idx = slotState.incorrect[0]
      if (idx >= 0) {
        clearSlotWord(idx)
        setEditIdx(idx)
        setFixMode('fix_input')
      }
      return
    }
    // Fix_Input：空格在最后一个错误词 → 提交；Backspace 空词 → 回上一错误词；Enter 提交（中文输入法组合中跳过）
    if (fixMode === 'fix_input') {
      if (e.key === 'Space' && isLastIncorrectOf(editIdx)) { e.preventDefault(); submit(); return }
      if (e.key === 'Backspace' && (typed.split(' ')[editIdx] || '') === '') {
        e.preventDefault()
        const prev = prevIncorrectOf(editIdx)
        if (prev >= 0) { clearSlotWord(prev); setEditIdx(prev) }
        return
      }
      if (e.key === 'Enter' && !composing.current) { e.preventDefault(); submit(); return }
      return // 其余按键直接上屏（原生 input）
    }
    // 官方 useSpaceSubmitAnswer：输入焦点在最后一个词槽时按空格提交答案（IME 组合中跳过）；非末词空格仍分词跳格
    if (fixMode === 'input' && e.key === ' ' && !composing.current) {
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

  // Windows Ctrl+Backspace：删除光标前的整个上一个单词（官方 deletePreviousWordOnWin 移植）
  const deletePrevWordOnWin = () => {
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

  // 全局快捷键
  useEffect(() => {
    const h = (e) => {
      if (phase !== 'game' || paused) return
      // 乱序模式：无输入框，拼好后按 Enter 提交
      if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.altKey && mode === 'scramble' && !done) { e.preventDefault(); submit(); return }
      // 左右方向键切换上一题/下一题（输入框聚焦时保留光标移动，不切题）
      if (e.key === 'ArrowLeft' && document.activeElement !== inputRef.current) { e.preventDefault(); prevQ(); return }
      if (e.key === 'ArrowRight' && document.activeElement !== inputRef.current) { e.preventDefault(); nextQ(); return }
    }
    window.addEventListener('keydown', h)
    document.addEventListener('keydown', h)
    return () => { window.removeEventListener('keydown', h); document.removeEventListener('keydown', h) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, cur, qi, mode, done, paused, undo])

  // —— P4 结算页 & 暂停弹窗快捷键 ——
  useEffect(() => {
    const h = (e) => {
      // 结算页：Enter / 空格 → 下一课
      if (phase === 'result') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          nextLesson()
        }
        return
      }
      // 暂停弹窗：Esc / 空格 → 继续游戏
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

  // —— 可配置全局快捷键（设置弹窗内可改键位；输入框激活或设置弹窗打开时自动禁用） ——
  useEffect(() => {
    const h = (e) => {
      if (document.querySelector('.qs-mask')) return          // 设置弹窗打开时禁用
      const ae = document.activeElement
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return // 打字时禁用
      const k = keysOfEvent(e)
      if (!k) return
      const hk = loadHotkeys()
      let act = null
      for (const id in hk) { if (hk[id] === k) { act = id; break } }
      if (!act) return
      e.preventDefault()
      const A = hotActionsRef.current
      switch (act) {
        case 'toggleSettings': setShowSettings(o => !o); break
        case 'toggleCommand': toast('命令面板即将上线'); break
        case 'playSound':
          if (phase === 'game' && cur) speak(cur.s.russian)
          else toast('请先在答题中播放声音')
          break
        case 'showAnswer':
          if (phase === 'game' && cur) { if (done) toast('当前题已完成'); else A.showAnswerNow() }
          else toast('请在答题中使用该快捷键')
          break
        case 'skipQ': if (phase === 'game') nextQ(); break
        case 'prevQ': if (phase === 'game') prevQ(); break
        case 'master': toggleMastered(); break
        case 'undoMaster':
          if (mastered.includes(cur ? cur.id + '_' + qi : '')) toggleMastered()
          else toast('当前题未标记掌握')
          break
        case 'addVocab': addVocab(); break
        case 'pauseGame': togglePause(); break
        case 'courseContent': setContentOpen(true); break
        case 'sentenceTree':
          if (phase === 'game') { const n = uiCfg.showStruct; setUi(o => { const nu = { ...o, showStruct: !n }; try { localStorage.setItem('rlearn_quest_ui', JSON.stringify(nu)) } catch (e) { /* 忽略 */ } return nu }); toast(n ? '已隐藏句子结构' : '已显示句子结构') }
          break
        case 'toggleAI': setAiOpen(o => !o); break
        case 'wordByWord': A.playWordByWord(); break
        case 'playCurrentWord': A.playCurrentWordFn(); break
        case 'toggleSpeech':
          if (mode === 'speaking') { if (recording) A.stopRec(); else A.startRec() }
          else toast('请先切换到口语评测模式')
          break
        case 'playRecording': A.playRecordingFn(); break
        case 'toggleHint':
          if (phase === 'game' && cur) { if (done) toast('当前题已完成'); else A.showAnswerNow() }
          else toast('请在答题中使用该快捷键')
          break
        case 'toggleNotes': toast('笔记功能即将上线'); break
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
    if (recThreshold <= 1) recordWrong(cur, '（未作答，查看答案）', '未作答 / 跳过') // 记录到错题本：「总是/错误1次后」才记录跳过
    sfxFunc()
    if (uiCfg.answerSpeak) speak(cur.s.russian)
    fetchAnalysis(cur)
  }

  // —— 切题（上一题/下一题），切换时自动保存学习进度 ——
  const nextQ = () => {
    saveProgress()
    setDictTipVisible(false) // P5 切换题目时重置听写答案提示
    if (qi + 1 >= questions.length) { runCloseLoop(); setPhase('result'); const r = ratingOf(acc); setTimeout(() => sfxRating(r.label), 260); return }
    sfxScene()
    setQi(q => q + 1)
  }
  const prevQ = () => {
    if (qi <= 0) return
    saveProgress()
    setDictTipVisible(false) // P5 切换题目时重置听写答案提示
    sfxScene()
    setQi(q => q - 1)
  }

  // —— 错题记录（本次练习内，供结算页错题本闭环使用） ——
  const recordWrong = (q, user, reason) => {
    setWrongList(w => w.some(x => x.id === q.id) ? w : [...w, { id: q.id, q, user, reason }])
  }
  const wrongReasonOf = (q, inputNorm) => {
    const expect = (q.answer || '').trim().split(/\s+/).map(cleanWord).map(normFor)
    if (!inputNorm || !inputNorm.length) return '未作答 / 跳过'
    if (inputNorm.length < expect.length) return '漏词（输入词数少于答案）'
    if (inputNorm.length > expect.length) return '多词（输入词数多于答案）'
    return '拼写或词形错误'
  }

  const toggleMastered = () => {
    if (!cur) return
    const id = cur.id + '_' + qi
    const nm = mastered.includes(id) ? mastered.filter(x => x !== id) : [...mastered, id]
    setMastered(nm); localStorage.setItem('rlearn_quest_mastered', JSON.stringify(nm))
    sfxFunc()
    toast(mastered.includes(id) ? '已取消掌握' : '已标记掌握')
  }
  const addVocab = () => {
    if (!cur) return
    const id = cur.id + '_' + qi
    const nv = vocabNote.includes(id) ? vocabNote.filter(x => x !== id) : [...vocabNote, id]
    setVocabNote(nv); localStorage.setItem('rlearn_quest_vocab', JSON.stringify(nv))
    sfxFunc()
    toast(vocabNote.includes(id) ? '已从生词移除' : '已加入生词')
  }

  // —— 重置本课进度：从头开始（清进度 + 清零统计与计时） ——
  const resetLesson = useCallback(() => {
    if (!curLesson || !window.confirm('确定重置本课进度，从头开始吗？')) return
    try { localStorage.removeItem('rlearn_quest_progress') } catch (e) { /* 忽略 */ }
    setQi(0); setScore(0); setCombo(0); setMaxCombo(0); setPerfect(0); setGood(0); setSkipped(0)
    setAcc({ answered: 0, correct: 0, firstHit: 0 }); setElapsed(0); setStartAt(Date.now())
    setModeOpen(false)
    sfxScene()
    toast('本课进度已重置，从头开始')
  }, [curLesson])

  // —— 全屏沉浸模式 ——
  const toggleFullscreen = () => {
    sfxFunc()
    if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}) }
    else { document.documentElement.requestFullscreen().catch(() => toast('浏览器不支持全屏，请按 F11')) }
  }

  // —— 退出后自动闭环：错题本 / 智能复习计划 / 个人数据中心 ——
  const collectCloseLoop = (lesson, wl, el, sc, ac) => {
    if (!lesson) return
    const now = Date.now()
    // 1) 本次练习错题自动收录进错题本，标注错误原因
    if (wl && wl.length) {
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
    // 2) 未掌握词汇/句子 → 智能复习计划（遗忘曲线：1/2/4/7/15 天递进）
    if (wl && wl.length) {
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
    // 3) 学习时长 / 累计积分 / 正确率 → 个人数据中心
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

  // —— 再来一组：同难度、同主题拓展练习题 ——
  const extraGroup = async () => {
    if (!curLesson || !curLevel) return
    sfxFunc()
    const pool = poolOf(curLevel)
    const usedIds = new Set(curLesson.sentences.map(s => s.id))
    const fresh = pool.filter(s => !usedIds.has(s.id))
    if (fresh.length < 5) { toast('题库剩余句子不足，无法生成拓展组'); return }
    const group = shuffle(fresh).slice(0, 10)
    const lesson = { id: curLesson.id + '_X' + String(Date.now()).slice(-4), idx: curLesson.idx, sentences: group }
    toast('已生成同难度拓展组，共 10 句')
    startLesson(lesson, false)
  }
  // —— 下一课：直接进入下一章节 ——
  const nextLesson = () => {
    if (!curLesson || !lessons.length) return
    sfxFunc()
    const idx = lessons.findIndex(l => l.id === curLesson.id)
    const nx = lessons[idx + 1]
    if (!nx) { toast('已经是最后一课了'); return }
    toast('进入下一课 ' + nx.id)
    startLesson(nx, false)
  }

  // 本课全部句子（整句题的题号 → 句子），供「本课内容」快速跳转
  const sentenceEntries = useMemo(() => {
    const map = []
    questions.forEach((q, i) => { if (q.partIdx === q.partTotal) map.push({ qi: i, s: q.s }) })  // 课程目录只展示整句题
    return map
  }, [questions])

  // —— 口语评测（speaking 模式）：录音 → 后端转写+AI 比对 → 评分 ——
  const gradeOfPct = (pct) => pct >= 95 ? 'SSS' : pct >= 88 ? 'SS' : pct >= 80 ? 'S' : pct >= 68 ? 'A' : pct >= 50 ? 'B' : 'C'
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
          // 达标视为通过：计入成绩并展示答案卡
          setDone(true); setCombo(c => { const nc = c + 1; setMaxCombo(m => Math.max(m, nc)); return nc })
          setScore(s => s + 500); setPerfect(p => p + 1)
          setAcc(a => ({ ...a, answered: a.answered + 1, correct: a.correct + 1, firstHit: a.firstHit + 1 }))
          sfxPerfect()
          const p = pickPraise(); setPraise(p); speak(p)
          fetchAnalysis(cur)
        }
      } else {
        setSpeakResult({ err: j.error || '评分失败，请重试' })
      }
    } catch (e) {
      setSpeakResult({ err: '网络错误：' + e.message })
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
        try { stream.getTracks().forEach(t => t.stop()) } catch (e) { /* 忽略 */ }
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
      toast('无法访问麦克风：' + (e.message || '请检查浏览器权限'))
    }
  }
  const stopRec = () => {
    clearInterval(recTimer.current)
    setRecording(false)
    try { mediaRecRef.current?.stop() } catch (e) { /* 忽略 */ }
  }

  // —— 乱序模式（scramble）：点击词块重组句子 ——
  const scrambleOrder = useMemo(() => {
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

  // —— AI 助手 ——
  const askAI = async (q0) => {
    const q = (q0 || aiQ).trim()
    if (!q || aiBusy) return
    setAiBusy(true)
    const thread = [...aiThread, { role: 'user', text: q }]
    setAiThread(thread); setAiQ('')
    const ctx = cur ? ('当前练习的句子是："' + cur.s.russian + '"（中文：' + (cur.zh || cur.s.chinese) + '）\n') : ''
    try {
      const content = await callAI([
        { role: 'system', content: '你是俄语老师。回答要简洁、准确，用中文讲解，可以给出例句。注意：用户可能是在做题，不要直接给出完整答案，先引导思考，除非用户明确要求看答案。' },
        ...thread.map(t => ({ role: t.role === 'user' ? 'user' : 'assistant', content: t.text })),
      ])
      setAiThread([...thread, { role: 'assistant', text: content }])
    } catch (e) {
      setAiThread([...thread, { role: 'assistant', text: '（AI 老师暂时无法回答，请稍后再试）' }])
    } finally {
      setAiBusy(false)
    }
  }

  const quickAsk = (q) => askAI(q)

  // 答对后针对性追问
  const followUp = useMemo(() => {
    if (!cur) return []
    const w = cleanWord(cur.answer.split(/\s+/)[0])  // 每句话都是整句题，取首词
    const wText = stripStress(w)
    return [
      '“' + wText + '”这个词在句子里起什么作用？',
      '“' + wText + '”还有哪些常见用法？',
    ]
  }, [cur])

  // —— 渲染：课程选择（高级质感商城风格） ——
  if (phase === 'courses' || phase === 'lessons') {
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
            {/* 顶部导航栏 */}
            <div style={styles.mallNav}>
              <div style={styles.mallNavLeft}>
                <span style={styles.mallNavTitle}>课程包商城</span>
              </div>
              <div style={styles.mallNavTabs}>
                {['推荐', '零基础', '初级', '中级', '高级', '全部'].map((t, i) => (
                  <span key={t} className="mall-nav-tab" style={{ ...styles.mallNavTab, ...(i === 0 ? styles.mallNavTabOn : {}) }}>{t}</span>
                ))}
              </div>
              <div style={styles.mallNavSearch}>搜索课程…</div>
            </div>

            {/* 内容区 */}
            <div style={styles.mallContent}>
              {/* 本周主编精选 */}
              <div style={styles.mallSection}>
                <div style={styles.mallSectionTitle}>本周主编精选</div>
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
                          <div style={styles.mallFeaturedMeta}>句乐部 · {lessonsByLevel[lv].length} 课 · {pool.length} 句</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 全部俄语课程 */}
              <div style={{ ...styles.mallSection, marginTop: 40 }}>
                <div style={styles.mallSectionHeader}>
                  <div style={styles.mallSectionTitle}>全部俄语课程</div>
                  <div style={styles.mallSectionMore} className="mall-section-more">查看全部</div>
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
                          <div style={styles.mallListMeta}>{lessonsByLevel[lv].length} 课 · {pool.length} 句</div>
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
            {/* 顶部导航 */}
            <div style={styles.detailNav}>
              <span style={styles.detailBack} onClick={() => setPhase('courses')}>←</span>
              <span style={styles.detailNavTitle}>课程详情</span>
            </div>

            {/* 课程信息头部 */}
            <div style={styles.detailContent}>
              <div style={styles.detailHead}>
                <div style={{ ...styles.detailCover, background: gradients[LEVELS.indexOf(curLevel)] }}>
                  <span style={styles.detailCoverLevel}>{curLevel}</span>
                </div>
                <div style={styles.detailHeadInfo}>
                  <div style={styles.detailTitle}>{COURSE_META[curLevel]?.title}</div>
                  <div style={styles.detailDesc}>{COURSE_META[curLevel]?.desc}</div>
                  <div style={styles.detailTags}>
                    {['基础', '句型', '词汇', '口语'].map(t => <span key={t} style={styles.detailTag}>{t}</span>)}
                  </div>
                  <div style={styles.detailMeta}>
                    <span style={styles.detailMetaItem}>句乐部</span>
                    <span style={styles.detailMetaDot}>·</span>
                    <span style={styles.detailMetaItem}>{lessons.length} 课</span>
                    <span style={styles.detailMetaDot}>·</span>
                    <span style={styles.detailMetaItem}>{poolOf(curLevel).length} 句</span>
                  </div>
                </div>
                <div style={styles.detailHeadRight}>
                  <button style={styles.detailStartBtn} onClick={() => lessons.length > 0 && startLesson(lessons[0], false)}>开始学习</button>
                </div>
              </div>

              {/* 大纲列表 */}
              <div style={styles.detailOutline}>
                <div style={styles.detailOutlineHeader}>
                  <div style={styles.detailOutlineTitle}>大纲 <span style={styles.detailOutlineCount}>共 {lessons.length} 课</span> <span style={styles.detailOutlineTrial}>全部免费试学</span></div>
                  <div style={styles.detailSortBtn}>⇅ 正序</div>
                </div>
                {lessons.map((l, i) => {
                  let hasProg = false
                  try { const sp = JSON.parse(localStorage.getItem('rlearn_quest_progress') || 'null'); hasProg = !!(sp && sp.lessonId === l.id) } catch (e) { hasProg = false }
                  return (
                    <div key={l.id} style={styles.detailLessonRow} onClick={() => startLesson(l, true)}>
                      <div style={styles.detailLessonNo}>{String(i + 1).padStart(2, '0')}</div>
                      <div style={styles.detailLessonIcon}>📄</div>
                      <div style={{ flex: 1 }}>
                        <div style={styles.detailLessonName}>第{l.idx}课 · {l.sentences[0]?.source || COURSE_META[curLevel]?.title}</div>
                        <div style={styles.detailLessonDesc}>{l.sentences.slice(0, 2).map(s => stripStress(s.russian)).join(' · ')}…</div>
                      </div>
                      <span style={{ ...styles.detailTrialTag, ...(hasProg ? styles.detailTrialActive : {}) }}>{hasProg ? '继续学习' : '可试学'}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  // —— 渲染：阅读模式预习（全文通读 + 逐句跟读） ——
  if (phase === 'preview') {
    const Tp = THEMES[uiCfg.theme]
    return (
      <div style={{ ...styles.previewRoot, background: Tp.grad, color: Tp.text, fontFamily: FONT_STACK[uiCfg.font], ...(bgImageStyle || {}) }}>
        <div style={{ ...styles.previewCard, background: Tp.panel, borderColor: Tp.border, boxShadow: Tp.shadow }}>
          <div style={{ ...styles.previewTitle, color: Tp.textStrong }}>{COURSE_META[curLevel]?.title} · 阅读预习</div>
          <div style={{ ...styles.previewSub, color: Tp.sub }}>先通读全文，点击 🔊 逐句跟读，熟悉后再进入打字答题</div>
          <div style={styles.previewList}>
            {curLesson?.sentences?.map((s, i) => (
              <div key={i} style={{ ...styles.previewLine, borderColor: Tp.border, background: Tp.bgSoft }}>
                <span style={{ ...styles.previewNo, color: Tp.sub }}>{i + 1}</span>
                <div style={styles.previewBody}>
                  <div style={{ ...styles.previewRu, color: Tp.textStrong }}>{s.russian}</div>
                  <div style={{ ...styles.previewZh, color: Tp.sub }}>{s.chinese}</div>
                </div>
                <button style={{ ...styles.previewPlay, color: Tp.brand, borderColor: Tp.brand, background: Tp.brandSoft }} onClick={() => speak(s.russian)}>🔊</button>
              </div>
            ))}
          </div>
          <div style={styles.previewFoot}>
            <button style={{ ...styles.previewBack, color: Tp.sub, borderColor: Tp.border, background: 'transparent' }} onClick={() => setPhase('lessons')}>返回课表</button>
            <button style={{ ...styles.previewStart, background: Tp.brand, color: '#fff' }} onClick={() => setPhase('game')}>开始练习 →</button>
          </div>
        </div>
      </div>
    )
  }

  // —— 渲染：加载页 ——
  if (phase === 'loading') {
    return (
      <div style={styles.loadRoot}>
        <div style={styles.loadLogo}>🇷🇺</div>
        <div style={styles.loadText}>LOADING</div>
        <div style={styles.loadBar}><div style={{ ...styles.loadFill, width: loadPct + '%' }} /></div>
        <div style={styles.loadPct}>{loadPct}%</div>
        <div style={styles.loadTip}>正在准备题目与逐词解析…</div>
      </div>
    )
  }

  // —— 渲染：结算（P4 SummaryModal：评级+环形图+错题+撒花+每日一句） ——
  if (phase === 'result') {
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
          lessonTitle={curLesson?.title || (curLesson?.sentences?.[0]?.source) || '本课练习'}
          onClose={() => { setPhase('lessons'); setResultWrong(false) }}
          onDoAgain={() => startLesson(curLesson, false)}
          onExtraGroup={extraGroup}
          onNextLesson={nextLesson}
          onGoCourseList={() => { setPhase('lessons'); setResultWrong(false) }}
          onShare={() => toast('📸 打卡分享图功能开发中，敬请期待！')}
          theme={T}
          dark={isDark}
        />
      </div>
    )
  }

  // —— 渲染：答题页 ——
  if (!cur) return null
  const T = THEMES[uiCfg.theme]
  const expectChunks = cur.answer.trim().split(/\s+/).map(cleanWord).map(normFor)
  // 输入框三样式（动态宽度默认 / 固定等宽 / 极简横线）+ 状态色（乱序模式词块用）
  const chipBoxStyle = (i, ok) => {
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
      {/* 顶部工具栏（对齐 Earthworm Tool.vue）：左侧返回+课程名(进度)+学习视频链接；右侧 4 常驻图标 + 溢出菜单 */}
      <div style={styles.topBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="ruq-toolbtn" style={styles.toolIconBtn} onClick={() => { sfxScene(); setPhase('lessons') }} title="返回课程列表">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <span style={styles.topCourse}>{curLesson?.sentences[0]?.source || COURSE_META[curLevel]?.title}</span>
          <span style={styles.topProgressText}>{(qi + 1)} / {questions.length}</span>
          <button className="ruq-toolbtn" style={styles.studyVideoLink} onClick={playCur} title="播放当前句发音">▶ 学习视频</button>
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
            <button className="ruq-toolbtn" style={styles.toolIconBtn} title="游戏设置：倍速/播放次数/间隔（听写模式）" onClick={() => { sfxFunc(); setGameSettingOpen(true) }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
          )}
          <button className="ruq-toolbtn" style={styles.toolIconBtn} title={paused ? '继续练习' : '暂停练习'} onClick={togglePause}>
            {paused
              ? <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              : <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1.5"/><rect x="14" y="5" width="4" height="14" rx="1.5"/></svg>}
          </button>
          <button className="ruq-toolbtn" style={styles.toolIconBtn} title="重置本课进度，从头开始" onClick={resetLesson}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>
          </button>
          <button className="ruq-toolbtn" style={styles.toolIconBtn} title="排行榜（开发中）" onClick={() => toast('排行榜功能即将上线')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4a1 1 0 0 0-1 1c0 2 1.5 3 3 3M17 6h3a1 1 0 0 1 1 1c0 2-1.5 3-3 3"/></svg>
          </button>
          {/* 溢出菜单：保留模式切换/本课内容/错题本/宠物/外观/全屏/设置等扩展功能入口 */}
          <div style={{ position: 'relative' }}>
            <button className="ruq-toolbtn" style={styles.toolIconBtn} title="更多功能" onClick={() => setMoreOpen(o => !o)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>
            </button>
            {moreOpen && (
              <div style={styles.overflowPop}>
                <div style={{ ...styles.overflowItem, color: '#94a3b8', fontSize: 11, padding: '4px 12px', cursor: 'default' }}>切换练习模式</div>
                {MODES.map(m => (
                  <div key={m.key} style={{ ...styles.overflowItem, ...(mode === m.key ? styles.overflowItemOn : {}) }} onClick={() => { if (m.key !== mode) { setMode(m.key); try { localStorage.setItem('rlearn_quest_mode', m.key) } catch (e) { /* 忽略 */ } toast('已切换：' + m.name + '（进度已保留）') } setMoreOpen(false) }}>
                    {m.name}{m.key === mode && ' ✓'}
                  </div>
                ))}
                <div style={{ height: 1, background: '#e2e8f0', margin: '6px 0' }} />
                <div style={styles.overflowItem} onClick={() => { setMoreOpen(false); sfxFunc(); setContentOpen(true) }}>📖 本课内容</div>
                <div style={styles.overflowItem} onClick={() => { setMoreOpen(false); sfxFunc(); setWrongBookOpen(true) }}>📕 错题本</div>
                <div style={styles.overflowItem} onClick={() => { setMoreOpen(false); sfxFunc(); setPetVisible(v => !v) }}>{petVisible ? '🐱 隐藏宠物' : '🐾 显示宠物'}</div>
                <div style={styles.overflowItem} onClick={() => { setMoreOpen(false); setUiOpen(o => !o) }}>Aa 外观设置</div>
                <div style={styles.overflowItem} onClick={() => { setMoreOpen(false); toggleFullscreen() }}>⛶ 全屏</div>
                <div style={styles.overflowItem} onClick={() => { setMoreOpen(false); sfxFunc(); setShowSettings(true) }}>⚙ 设置</div>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* 通宽进度条（对齐 Earthworm CommonProgressBar h-6）：百分比 = 当前题序/总题数 */}
      <div style={styles.progressBarFull}>
        <div style={{ ...styles.progressBarFill, width: Math.max(2, Math.round(100 * (qi + 1) / questions.length)) + '%' }} />
      </div>

      <div style={styles.gameMain}>
        {/* 中央题目区（切题时极简淡入，无闪烁） */}
        <div key={qi} style={{ ...styles.center, animation: 'ruqFadeIn .3s ease' }} onClick={() => inputRef.current?.focus()}>
          {done && (
            <div style={{ ...styles.praise, ...(combo >= 2 ? { background: 'linear-gradient(90deg,' + T.brand + ',' + T.ok + ',' + T.brand + ')', backgroundSize: '200% auto', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', animation: 'ruqGrad 1.6s linear infinite' } : { color: T.ok }) }}>{praise}</div>
          )}
          {!done && (mode === 'dictation'
            ? <>
                <div style={{ ...styles.dictHint, fontSize: Q_SIZE[uiCfg.qSize], color: T.brand }}>🎧 听写 · 请听音拼写</div>
                {/* P5 听写模式播放控制栏：盲听(正常速) → 慢听(0.5x) → 显示答案提示 */}
                <DictationControls
                  text={cur.s.russian}
                  onPlay={(t, rate) => speak(t, rate)}
                  onToggleTip={() => setDictTipVisible(v => !v)}
                  showTip={dictTipVisible}
                  theme={T}
                  dark={uiCfg.themeMode === 'dark' || uiCfg.theme === 'dark'}
                />
                {/* 答案提示浮层（对齐官方 AnswerTip.vue） */}
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
                    }}>✕</button>
                    <div style={{ fontSize: 18, fontWeight: 700, color: T.text, textAlign: 'center', paddingRight: 20 }}>{cur.s.russian}</div>
                    {cur.s.soundmark && <div style={{ fontSize: 13, color: T.sub, textAlign: 'center', marginTop: 4 }}>{cur.s.soundmark}</div>}
                  </div>
                )}
              </>
            : <>
              {/* 渐进式阶段标签：逐词 / 前缀累加 / 整句 */}
              {!cur.full ? (
                <div style={{ fontSize: 13, color: T.sub, marginBottom: 6, letterSpacing: 1 }}>📝 逐词练习 · 第 {cur.partIdx} / {cur.partTotal} 词</div>
              ) : cur.partIdx < cur.partTotal ? (
                <div style={{ fontSize: 13, color: T.brand, marginBottom: 6, letterSpacing: 1 }}>🔗 前缀累加 · 前 {cur.partIdx} 词组合</div>
              ) : (
                <div style={{ fontSize: 13, color: T.ok, marginBottom: 6, letterSpacing: 1 }}>✨ 整句连词造句</div>
              )}
              <div style={{ ...styles.zhText, fontSize: Q_SIZE[uiCfg.qSize], color: T.text, fontWeight: 500 }}>{cur.zh}</div>
            </>)}
          {done ? (
            /* 答案显示：答题居中区内原地替换渲染（对齐 Earthworm Answer.vue：无全屏遮罩/卡片） */
            <div style={{ animation: 'ruqFadeUp .35s ease', textAlign: 'center' }}>
              {/* 官方：整句逐词大字号展示（text-5xl=48px，gap-1=4px），点击单词发音；右侧整句发音喇叭 */}
              <div style={styles.answerWords}>
                {cur.answer.trim().split(/\s+/).map((w, i) => (
                  <span key={i} className="ruq-aw" style={styles.answerWord} onClick={() => speak(w)} title="点击发音">{w}</span>
                ))}
                <span className="ruq-as" style={styles.answerSpeaker} onClick={() => speak(cur.s.russian)} title="整句发音">🔊</span>
              </div>
              {cur.s.soundmark && <div style={styles.answerSoundmark}>{cur.s.soundmark}</div>}
              <div style={styles.answerZhLine}>{cur.zh || cur.s.chinese}</div>
              <div style={styles.answerBtns}>
                <button className="ruq-awbtn" style={styles.answerBtn} onClick={() => loadQuestion(qi)}>再来一次</button>
                <button className="ruq-awbtn" style={styles.answerBtnMain} onClick={nextQ}>{qi + 1 >= questions.length ? '完成本课 →' : '下一题 →'}</button>
              </div>
              {/* 保留：AI 逐词拆解（词性/语法成分/释义，俄语扩展功能） */}
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
                  <div style={{ ...styles.answerErr, fontSize: AUX_SIZE[uiCfg.qSize], color: T.sub }}>AI 拆解失败，点击 <span style={{ ...styles.retry, color: T.brand }} onClick={() => fetchAnalysis(cur)}>重试</span></div>
                </div>
              ) : analysing && (
                <div style={{ ...styles.answerErr, fontSize: AUX_SIZE[uiCfg.qSize], color: T.sub }}>正在解析…</div>
              )}
            </div>
          ) : mode === 'speaking' ? (
            /* 口语评测模式：先听原句 → 跟读录音 → AI 实时评分 */
            <div style={styles.speakWrap}>
              <div style={{ ...styles.speakTip, fontSize: S_WORD[uiCfg.sSize], color: T.text }}>先听标准发音，再跟读录音</div>
              <div style={styles.speakBtns}>
                <button style={{ ...styles.speakBtn, color: T.text, borderColor: T.border, background: T.bgSoft }} onClick={playCur}>🔊 听原句</button>
                {recording
                  ? <button style={{ ...styles.speakBtnRec, background: T.err }} onClick={stopRec}>⏹ 停止录音 {recDur}s</button>
                  : <button style={{ ...styles.speakBtnMain, background: T.brand, color: '#fff' }} onClick={startRec}>🎙 开始录音</button>}
              </div>
              {speakLoading && <div style={{ ...styles.speakLoading, color: T.sub }}>AI 评测中…</div>}
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
                      <div style={{ ...styles.speakText, color: T.textStrong }}>识别：{speakResult.text || '（未识别到内容，请再试一次）'}</div>
                      {speakResult.errors && speakResult.errors.length > 0 && (
                        <div style={{ ...styles.speakErrors, color: T.err }}>
                          {speakResult.errors.map((e, i) => (
                            <div key={i}>✗ {e.original || e.user} → {e.correct_reading || e.suggestion || ''}</div>
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
            /* 乱序模式：点击词块按顺序重组句子（也可直接键盘输入） */
            <div style={styles.scrambleWrap}>
              <input ref={inputRef} readOnly tabIndex={-1} style={styles.scrambleHiddenInput} onKeyDown={onInputKey} autoFocus aria-hidden="true" />
              <div style={{ ...styles.wordRow, ...(wrong ? { animation: 'ruqShake .4s ease' } : {}) }}>
                {scramblePicked.map((pi, idx) => (
                  <span key={idx} style={chipBoxStyle(idx, true)} onClick={() => unpickWord(pi)} title="点击撤销">
                    {scrambleOrder[pi]}
                  </span>
                ))}
                {scramblePicked.length === 0 && <span style={{ ...styles.wordPlaceholder, color: T.sub, fontSize: S_WORD[uiCfg.sSize] }}>点击下方单词按顺序组成句子</span>}
              </div>
              <div style={styles.scramblePool}>
                {scrambleOrder.map((w, i) => scramblePicked.includes(i) ? null : (
                  <span key={i} style={{ ...styles.scrambleChip, color: T.textStrong, borderColor: T.border, background: T.bgSoft }} onClick={() => pickWord(i)}>{w}</span>
                ))}
                {scramblePicked.length === scrambleOrder.length && scrambleOrder.length > 0 && <div style={{ ...styles.scrambleDone, color: T.sub }}>句子已拼好，按 Enter 提交</div>}
              </div>
            </div>
          ) : (
            <>
              {/* 官方连词成句：单词下划线槽（QuestionInput.vue 1:1：槽 64px / 字号 48px / 激活整词 #d946ef / 错误整词 red+shake(仅fix模式) / 默认 #20202099；标点直接显示无槽） */}
              <div ref={inputRowRef} style={styles.slotRow}>
                {expectChunks.map((text, i) => {
                  const userInput = typed.split(' ')[i] !== undefined ? typed.split(' ')[i] : ''
                  const editing = fixMode === 'fix_input' && i === editIdx
                  const incorrect = !editing && slotState.incorrect.includes(i)
                  const active = fixMode === 'input' && slotState.active === i
                  const isWordChunk = /[a-zA-Zа-яА-ЯёЁ0-9]/.test(text || '') // 官方 isWord（俄语扩展西里尔）
                  // 官方三态词级高亮（getWordsClassNames）
                  let col = '#20202099', bcol = '#D1D5DB'
                  if (incorrect) { col = '#EF4444'; bcol = '#EF4444' }
                  else if (active) { col = '#d946ef'; bcol = '#d946ef' }
                  // 官方：默认固定 4ch（isShowWordsWidth 关闭时），不按词长动态计算；外观「固定等宽」仍保留 96px
                  const slotW = uiCfg.inputStyle === 'fixed' ? 96 : 4
                  if (!isWordChunk) {
                    // 官方：非词（标点）无下划线槽，直接显示，同高 64px
                    return <div key={i} style={{ ...styles.slotPunct, fontSize: 48, color: '#20202099' }}>{text}</div>
                  }
                  return (
                    <div key={i} style={{ ...styles.slotBox, minWidth: slotW + 'ch', borderBottom: '2px solid ' + bcol, fontSize: 48, color: col, ...(incorrect && fixMode !== 'input' ? { animation: 'ruqShake .3s ease' } : {}) }}>
                      {userInput}
                    </div>
                  )
                })}
                {/* 官方透明输入框：覆盖整个词行，点击/光标定位激活词；双击与鼠标按下按官方仅聚焦不移动光标 */}
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
                {fixMode === 'fix' ? '部分单词有误 — 直接输入字母修改第一个红色单词' : fixMode === 'fix_input' ? '正在修改错误单词 · 空格跳到下一个 · Enter 提交' : '直接在下方输入 · 空格分隔单词 · Enter 提交'}
              </div>
              {/* 移动端按钮组（仅小屏显示，对齐 Earthworm QuestionInput md:hidden）：提交/显示答案/播放声音/掌握 */}
              <div className="ruq-mobbar" style={styles.mobBar}>
                {!done && <button style={styles.mobBtnMain} onClick={submit}>提交</button>}
                {!done && <button style={styles.mobBtn} onClick={showAnswerNow}>显示答案</button>}
                <button style={styles.mobBtn} onClick={playCur}>🔊 播放</button>
                <button style={styles.mobBtn} onClick={toggleMastered}>✓ 掌握</button>
                {done && <button style={styles.mobBtnMain} onClick={nextQ}>{qi + 1 >= questions.length ? '完成本课' : '下一题'}</button>}
              </div>
              {wrong && fixMode === 'input' && <div style={{ ...styles.wrongTip, fontSize: AUX_SIZE[uiCfg.qSize] + 3, color: T.err }}>再试一次</div>}
              {stuckOpen && (
                <div style={{ ...styles.stuckBox, background: T.brandSoft, borderColor: T.brand }}>
                  <div style={{ ...styles.stuckTitle, color: T.brand }}>卡住了吗？</div>
                  <div style={{ ...styles.stuckText, color: T.sub }}>这题已经连续错了 3 次，我可以先给一点提示。</div>
                  <div style={styles.stuckBtns}>
                    <button style={{ ...styles.stuckNo, color: T.sub, borderColor: T.border }} onClick={() => setStuckOpen(false)}>这题不用</button>
                    <button style={{ ...styles.stuckYes, background: T.brand }} onClick={() => { setStuckOpen(false); quickAsk('这道题我应该从哪里入手？请先给一个提示，不要直接给完整答案。') }}>帮我看看</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 连击动效：Perfect × N 浮动文字（3-9 基础 / 10+ 高亮发光+全屏闪效） */}
      {comboPop && (
        <div key={'cp' + comboPop.n} style={{ ...styles.comboPop, color: T.brand, ...(comboPop.high ? { textShadow: '0 0 16px ' + T.brand + ', 0 0 44px ' + T.brand } : {}) }}>
          Perfect × {comboPop.n}
        </div>
      )}
      {comboPop?.high && <div key={'cf' + comboPop.n} style={{ ...styles.comboFlash, background: 'radial-gradient(circle at 50% 40%, rgba(255,255,255,.5), rgba(255,255,255,0) 62%)' }} />}
      {comboBreak && <div key={'cb' + Date.now()} style={styles.comboBreak}>连击中断</div>}

      {/* P4 暂停弹窗（对齐官方 GamePauseModal.vue：随机鼓励语 + 继续游戏） */}
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

      {/* AI 助手：右下角悬浮图标唤起（默认收起，不遮挡答题区；展开后自动识别当前句子） */}
      <div style={{ ...styles.aiPanel, background: T.aiBg, borderLeft: '1px solid ' + T.aiBorder, ...(aiOpen ? { transform: 'translateX(0)' } : { transform: 'translateX(102%)', pointerEvents: 'none' }) }}>
        <div style={{ ...styles.aiHead, color: T.text, borderBottom: '1px solid ' + T.aiBorder }}>
          <span style={{ ...styles.aiDot, background: T.ok }} /> 智能助手
          <span style={{ ...styles.aiClose, color: T.sub, borderColor: T.aiBorder, background: T.bgSoft }} onClick={() => { sfxFunc(); setAiOpen(false) }} title="收起 AI 助手">✕</span>
        </div>
        <div style={{ ...styles.aiStatus, color: T.sub }}>正在看当前练习</div>
        <div style={styles.aiBody}>
          {aiThread.length === 0 && (
            <>
              <div style={{ ...styles.aiIntro, color: T.sub }}>有关于当前练习的问题？随时问我！</div>
              {[
                '这道题我应该从哪里入手？请先给一个提示，不要直接给完整答案。',
                '请解释这道题在考什么，以及我应该如何理解正确答案。',
                '请拆一下这句话的语法结构，重点说明主干、修饰关系和词序。',
                '请讲解这句话里的重点单词和短语。',
              ].map(q => (
                <div key={q} style={{ ...styles.aiQuick, color: T.text, background: T.brandSoft, borderColor: T.brand }} onClick={() => quickAsk(q)}>{q}</div>
              ))}
              {!done && (
                <>
                  <div style={{ ...styles.aiSection, color: T.sub }}>针对这题</div>
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
          {aiBusy && <div style={{ ...styles.aiMsgBot, background: T.bgSoft, color: T.text }}>正在思考…</div>}
        </div>
        <div style={{ ...styles.aiFoot, borderTop: '1px solid ' + T.aiBorder }}>
          <input
            value={aiQ}
            onChange={e => setAiQ(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') askAI() }}
            placeholder="输入你的问题..."
            style={{ ...styles.aiInput, background: T.bgSoft, borderColor: T.border, color: T.text }}
          />
          <button style={{ ...styles.aiSend, background: T.brand }} onClick={() => askAI()}>➤</button>
        </div>
      </div>

      {/* 右下角悬浮 AI 对话图标（点击唤起侧边栏，不打断练习节奏） */}
      {!aiOpen && (
        <button style={{ ...styles.aiFab, background: T.brand, boxShadow: T.shadow }} onClick={() => { sfxFunc(); setAiOpen(true) }} title="打开 AI 助手（解答语法/词汇/搭配）">💬</button>
      )}

      {/* P4 本课内容面板（对齐官方 CourseContents.vue：筛选+发音+掌握标记+跳转） */}
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

      {/* P4 游戏内设置弹窗（倍速/播放次数/播放间隔，服务听写模式） */}
      <GameSettingModal
        visible={gameSettingOpen}
        onClose={() => setGameSettingOpen(false)}
        onChange={data => { /* 设置已自动保存到 localStorage，听写模式读取时生效 */ }}
        theme={T}
        dark={uiCfg.themeMode === 'dark' || uiCfg.theme === 'dark'}
      />

      {/* P6 错题本独立弹窗 */}
      <WrongBookModal
        visible={wrongBookOpen}
        onClose={() => setWrongBookOpen(false)}
        onPlaySound={text => speak(text)}
        theme={T}
        dark={uiCfg.themeMode === 'dark' || uiCfg.theme === 'dark'}
      />

      {/* P6 桌面宠物（可拖拽、点击互动、随机台词） */}
      <DesktopPet
        visible={petVisible && phase === 'game'}
        theme={uiCfg.themeMode === 'dark' || uiCfg.theme === 'dark' ? 'dark' : 'light'}
        position={{ x: 24, y: 140 }}
      />

      {/* 模块1.1 外观设置弹窗 */}
      {uiOpen && (
        <div style={styles.uiMask} onClick={() => setUiOpen(false)}>
          <div style={styles.uiPanel} onClick={e => e.stopPropagation()}>
            <div style={styles.uiTitle}>外观设置</div>
            <div style={styles.uiRow}>
              <div style={styles.uiLabel}>字体</div>
              <div style={styles.uiOpts}>
                {[['system', '系统默认'], ['nunito', 'Nunito 圆润'], ['fredoka', 'Fredoka 圆润']].map(([k, label]) => (
                  <span key={k} style={{ ...styles.uiOpt, ...(uiCfg.font === k ? styles.uiOptOn : {}) }} onClick={() => saveUi({ font: k })}>{label}</span>
                ))}
              </div>
            </div>
            <div style={styles.uiRow}>
              <div style={styles.uiLabel}>题干字号</div>
              <div style={styles.uiOpts}>
                {['小', '中', '大'].map(s => (
                  <span key={s} style={{ ...styles.uiOpt, ...(uiCfg.qSize === s ? styles.uiOptOn : {}) }} onClick={() => saveUi({ qSize: s })}>{s}</span>
                ))}
              </div>
            </div>
            <div style={styles.uiRow}>
              <div style={styles.uiLabel}>重音字号</div>
              <div style={styles.uiOpts}>
                {['小', '中', '大'].map(s => (
                  <span key={s} style={{ ...styles.uiOpt, ...(uiCfg.sSize === s ? styles.uiOptOn : {}) }} onClick={() => saveUi({ sSize: s })}>{s}</span>
                ))}
              </div>
            </div>
            <div style={styles.uiRow}>
              <div style={styles.uiLabel}>背景主题</div>
              <div style={styles.uiOpts}>
                {Object.entries(THEMES).map(([k, v]) => (
                  <span key={k} style={{ ...styles.uiOpt, ...(uiCfg.theme === k ? styles.uiOptOn : {}) }} onClick={() => saveUi({ theme: k })}>{v.name}</span>
                ))}
              </div>
            </div>
            <div style={styles.uiRow}>
              <div style={styles.uiLabel}>输入框样式</div>
              <div style={styles.uiOpts}>
                {[['dynamic', '动态宽度'], ['fixed', '固定等宽'], ['underline', '极简横线']].map(([k, label]) => (
                  <span key={k} style={{ ...styles.uiOpt, ...(uiCfg.inputStyle === k ? styles.uiOptOn : {}) }} onClick={() => saveUi({ inputStyle: k })}>{label}</span>
                ))}
              </div>
            </div>
            <div style={styles.uiRow}>
              <div style={styles.uiLabel}>答案显示</div>
              <div style={styles.uiOpts}>
                {[['float', '浮层模式'], ['inline', '内嵌模式']].map(([k, label]) => (
                  <span key={k} style={{ ...styles.uiOpt, ...(uiCfg.answerMode === k ? styles.uiOptOn : {}) }} onClick={() => saveUi({ answerMode: k })}>{label}</span>
                ))}
              </div>
            </div>
            <div style={styles.uiRow}>
              <div style={styles.uiLabel}>词性标注</div>
              <div style={styles.uiOpts}>
                {[[true, '显示'], [false, '隐藏']].map(([k, label]) => (
                  <span key={k} style={{ ...styles.uiOpt, ...(uiCfg.posMark === k ? styles.uiOptOn : {}) }} onClick={() => saveUi({ posMark: k })}>{label}</span>
                ))}
              </div>
            </div>
            <div style={{ ...styles.uiGroupTitle, color: T.text }}>朗读设置</div>
            <div style={styles.uiRow}>
              <div style={styles.uiLabel}>做题时自动播放声音</div>
              <div style={styles.uiOpts}>
                {[[true, '开'], [false, '关']].map(([k, label]) => (
                  <span key={k} style={{ ...styles.uiOpt, ...(uiCfg.autoSpeak === k ? styles.uiOptOn : {}) }} onClick={() => saveUi({ autoSpeak: k })}>{label}</span>
                ))}
              </div>
            </div>
            <div style={styles.uiRow}>
              <div style={styles.uiLabel}>朗读次数</div>
              <div style={styles.uiOpts}>
                {[1, 2, 3, 4, 5].map(n => (
                  <span key={n} style={{ ...styles.uiOpt, ...(uiCfg.speakTimes === n ? styles.uiOptOn : {}) }} onClick={() => saveUi({ speakTimes: n })}>{n}遍</span>
                ))}
              </div>
            </div>
            <div style={styles.uiRow}>
              <div style={styles.uiLabel}>朗读速度</div>
              <div style={styles.uiOpts}>
                {SPEED_STEPS.map(v => (
                  <span key={v} style={{ ...styles.uiOpt, ...(uiCfg.speakSpeed === v ? styles.uiOptOn : {}) }} onClick={() => saveUi({ speakSpeed: v })}>{v}x</span>
                ))}
              </div>
            </div>
            <div style={styles.uiRow}>
              <div style={styles.uiLabel}>遍间停顿</div>
              <div style={styles.uiOpts}>
                {GAP_STEPS.map(v => (
                  <span key={v} style={{ ...styles.uiOpt, ...(uiCfg.speakGap === v ? styles.uiOptOn : {}) }} onClick={() => saveUi({ speakGap: v })}>{v}s</span>
                ))}
              </div>
            </div>
            <div style={styles.uiRow}>
              <div style={styles.uiLabel}>显示答案时自动朗读</div>
              <div style={styles.uiOpts}>
                {[[true, '开'], [false, '关']].map(([k, label]) => (
                  <span key={k} style={{ ...styles.uiOpt, ...(uiCfg.answerSpeak === k ? styles.uiOptOn : {}) }} onClick={() => saveUi({ answerSpeak: k })}>{label}</span>
                ))}
              </div>
            </div>
            <div style={styles.uiHint}>「做题时自动播放声音」开启后：每道题加载完成 → 自动朗读原句（可调次数/速度/停顿）→ 朗读结束后进入可输入状态。听写模式始终自动播放。</div>
            <div style={{ ...styles.uiGroupTitle, color: T.text, marginTop: 18 }}>声音设置</div>
            <div style={styles.uiRow}>
              <div style={styles.uiLabel}>全局音效</div>
              <div style={styles.uiOpts}>
                {[[true, '开'], [false, '静音']].map(([k, label]) => (
                  <span key={k} style={{ ...styles.uiOpt, ...(SFX_CFG.enabled === k ? styles.uiOptOn : {}) }} onClick={() => saveSfxCfg({ enabled: k })}>{label}</span>
                ))}
              </div>
            </div>
            <div style={styles.uiRow}>
              <div style={styles.uiLabel}>音量</div>
              <div style={styles.uiOpts}>
                {[[0.25, '低'], [0.5, '中低'], [0.7, '中'], [0.9, '高'], [1, '最大']].map(([v, label]) => (
                  <span key={v} style={{ ...styles.uiOpt, ...(SFX_CFG.vol === v ? styles.uiOptOn : {}) }} onClick={() => saveSfxCfg({ vol: v })}>{label}</span>
                ))}
              </div>
            </div>
            <div style={styles.uiRow}>
              <div style={styles.uiLabel}>按键音效</div>
              <div style={styles.uiOpts}>
                {[[true, '开'], [false, '关']].map(([k, label]) => (
                  <span key={k} style={{ ...styles.uiOpt, ...(SFX_CFG.keyOn === k ? styles.uiOptOn : {}) }} onClick={() => saveSfxCfg({ keyOn: k })}>{label}</span>
                ))}
              </div>
            </div>
            <div style={styles.uiRow}>
              <div style={styles.uiLabel}>按键音类型</div>
              <div style={styles.uiOpts}></div>
            </div>
            <div style={{ ...styles.uiSfxGrid }}>
              {[['soft', '轻柔'], ['drum', '鼓点'], ['bubble', '气泡'], ['typewriter', '打字机'], ['sword', '金属剑'], ['cherryBlue', '青轴'], ['cherryRed', '红轴']].map(([k, label]) => (
                <span key={k} style={{ ...styles.uiSfxChip, ...(SFX_CFG.keyType === k ? styles.uiOptOn : {}) }} onClick={() => saveSfxCfg({ keyType: k })}>{label}</span>
              ))}
            </div>
            <div style={styles.uiRow}>
              <div style={styles.uiLabel}>答题反馈音</div>
              <div style={styles.uiOpts}>
                {[[true, '开'], [false, '关']].map(([k, label]) => (
                  <span key={k} style={{ ...styles.uiOpt, ...(SFX_CFG.answerOn === k ? styles.uiOptOn : {}) }} onClick={() => saveSfxCfg({ answerOn: k })}>{label}</span>
                ))}
              </div>
            </div>
            <div style={styles.uiRow}>
              <div style={styles.uiLabel}>连击动画</div>
              <div style={styles.uiOpts}>
                {[[true, '开'], [false, '关']].map(([k, label]) => (
                  <span key={k} style={{ ...styles.uiOpt, ...(SFX_CFG.comboAnim === k ? styles.uiOptOn : {}) }} onClick={() => saveSfxCfg({ comboAnim: k })}>{label}</span>
                ))}
              </div>
            </div>
            <div style={styles.uiRow}>
              <div style={styles.uiLabel}>连击激励音</div>
              <div style={styles.uiOpts}>
                {[[true, '开'], [false, '关']].map(([k, label]) => (
                  <span key={k} style={{ ...styles.uiOpt, ...(SFX_CFG.comboFx === k ? styles.uiOptOn : {}) }} onClick={() => saveSfxCfg({ comboFx: k })}>{label}</span>
                ))}
              </div>
            </div>
            <div style={styles.uiRow}>
              <div style={styles.uiLabel}>场景功能音</div>
              <div style={styles.uiOpts}>
                {[[true, '开'], [false, '关']].map(([k, label]) => (
                  <span key={k} style={{ ...styles.uiOpt, ...(SFX_CFG.sceneOn === k ? styles.uiOptOn : {}) }} onClick={() => saveSfxCfg({ sceneOn: k })}>{label}</span>
                ))}
              </div>
            </div>
            <div style={styles.uiHint}>连击激励需同时开启「连击动画」与「连击激励音」：3-5 连击轻快激励 / 6-10 递进节奏 / 10 连击以上高燃冲刺；断连播放回落音。全局静音一键关闭全部音效。</div>
          </div>
        </div>
      )}

      {/* 设置弹窗：快捷键/播放/听力/学习等配置（归属俄语闯关页，工具栏 ⚙ 设置 / Ctrl+, 打开） */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}

// ================= 样式 =================
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
  // —— 商城风格（高级质感） ——
  mallNav: { background: '#ffffff', borderBottom: '1px solid #f0f0f0', padding: '0 40px', display: 'flex', alignItems: 'center', gap: 32, position: 'sticky', top: 0, zIndex: 10, height: 64 },
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
  // —— 课程详情页（对齐句乐部课程详情） ——
  detailNav: { background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '0 40px', display: 'flex', alignItems: 'center', height: 56, position: 'sticky', top: 0, zIndex: 10 },
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
  loadRoot: { position: 'fixed', inset: 0, background: '#0D0918', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, zIndex: 60, fontFamily: FONT_STACK.system },
  loadLogo: { fontSize: 52 },
  loadText: { fontSize: 13, letterSpacing: 3, color: '#9B8DB5' },
  loadBar: { width: 260, height: 4, background: 'rgba(255,255,255,.12)', borderRadius: 2, overflow: 'hidden', marginTop: 8 },
  loadFill: { height: '100%', background: '#8B5CF6', transition: 'width .2s' },
  loadPct: { fontSize: 12, color: '#9B8DB5' },
  loadTip: { fontSize: 11.5, color: '#6B5E85', marginTop: 8 },
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
  // 官方连词成句：单词下划线槽 + 透明覆盖输入框（1:1 复刻 earthworm QuestionInput）
  // Earthworm: relative flex flex-wrap justify-center gap-2(8px) transition-all；槽 h-[4rem]=64px；text-[3em]=48px；leading-none；normal 字重
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
  // 官方 Answer.vue：逐词大字号可点击发音 + 整句喇叭 + 音标 + 中文 + 再来一次/下一题（原地渲染，无遮罩卡片）
  answerWords: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 4, fontSize: 48, fontWeight: 400, lineHeight: 1.2, margin: '0 0 4px' },
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
  // 本课内容面板
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
  // 模块1.1 外观设置
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
  // 即时状态反馈：连击动效 + 暂停
  comboPop: { position: 'fixed', left: '50%', top: '38%', transform: 'translateX(-50%)', fontSize: 36, fontWeight: 800, letterSpacing: 1, pointerEvents: 'none', zIndex: 60, animation: 'ruqComboPop .3s ease forwards' },
  comboFlash: { position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 59, animation: 'ruqFlash .5s ease forwards' },
  comboBreak: { position: 'fixed', left: '50%', top: '46%', transform: 'translateX(-50%)', fontSize: 15, fontWeight: 600, letterSpacing: 2, opacity: .75, pointerEvents: 'none', zIndex: 58, animation: 'ruqBreak .55s ease forwards' },
  pauseMask: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'ruqFadeIn .25s ease' },
  pauseCard: { padding: '36px 48px', borderRadius: 20, border: '1px solid', textAlign: 'center', maxWidth: '88vw' },
  pauseTitle: { fontSize: 23, fontWeight: 800, marginBottom: 8 },
  pauseTime: { fontSize: 13, marginBottom: 24 },
  pauseBtns: { display: 'flex', gap: 12, justifyContent: 'center' },
  // 顶部总进度条 + 模式切换
  progressTrack: { width: 120, height: 7, borderRadius: 4, border: '1px solid', overflow: 'hidden', flexShrink: 0 },
  progressFill: { height: '100%', borderRadius: 3, transition: 'width .3s ease' },
  modeWrap: { position: 'relative' },
  modePop: { position: 'absolute', top: 30, right: 0, width: 176, borderRadius: 14, padding: 6, zIndex: 80 },
  modePopItem: { padding: '8px 12px', borderRadius: 10, fontSize: 12.5, cursor: 'pointer' },
  // 听写模式
  dictHint: { fontWeight: 700, marginBottom: 26, textAlign: 'center', letterSpacing: 1 },
  // 口语评测模式
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
  // 乱序模式
  scrambleWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, maxWidth: 680 },
  scramblePool: { display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', minHeight: 50, alignItems: 'center' },
  scrambleChip: { padding: '9px 18px', borderRadius: 12, border: '1px solid', fontSize: 18, fontWeight: 600, cursor: 'pointer', transition: 'transform .12s, opacity .12s' },
  scrambleDone: { fontSize: 12.5, marginTop: 4 },
  scrambleHiddenInput: { position: 'absolute', opacity: 0, width: 1, height: 1, border: 'none', outline: 'none', pointerEvents: 'none' },
  // 阅读预习
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
