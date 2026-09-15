import { useEffect, useRef, useState } from 'react'
import { useSettingsStore } from '../store/settingsStore'
import { exportBackup, importBackup } from '../lib/backup'
import { toast } from '../lib/toast'

/* ================= 快捷键定义（quest 俄语闯关页生效；设置弹窗全站可改） ================= */
export const HOTKEY_DEFS = [
  { id: 'playSound', label: '播放声音', def: "ctrl+'" },
  { id: 'showAnswer', label: '显示隐藏/答案预览/再来一次', def: 'ctrl+;' },
  { id: 'skipQ', label: '跳过当前题目', def: 'shift+arrowright' },
  { id: 'prevQ', label: '返回上个题目', def: 'shift+arrowleft' },
  { id: 'master', label: '标记掌握/生词学会了', def: 'ctrl+m' },
  { id: 'undoMaster', label: '撤销掌握', def: 'ctrl+z' },
  { id: 'addVocab', label: '添加到生词本', def: 'ctrl+n' },
  { id: 'pauseGame', label: '暂停游戏/继续游戏', def: 'ctrl+p' },
  { id: 'courseContent', label: '查看课程学习内容', def: 'ctrl+1' },
  { id: 'sentenceTree', label: '显示/隐藏句子树', def: 'ctrl+2' },
  { id: 'toggleAI', label: '打开/关闭 AI 助手', def: 'ctrl+/' },
  { id: 'toggleSettings', label: '打开/关闭设置', def: 'ctrl+,' },
  { id: 'toggleCommand', label: '打开/关闭命令面板', def: 'ctrl+shift+p' },
  { id: 'wordByWord', label: '逐词播放', def: "ctrl+shift+'" },
  { id: 'playCurrentWord', label: '播放当前单词', def: 'ctrl+.' },
  { id: 'toggleSpeech', label: '开始/停止 口语识别', def: 'space' },
  { id: 'playRecording', label: '播放录音', def: 'shift+space' },
  { id: 'toggleHint', label: '显示/隐藏当前单词提示', def: 'ctrl+shift+;' },
  { id: 'toggleNotes', label: '打开/关闭笔记', def: 'ctrl+j' },
]
export const HOTKEYS_KEY = 'rlearn_quest_hotkeys'

export const loadHotkeys = () => {
  const out = {}
  HOTKEY_DEFS.forEach(d => { out[d.id] = d.def })
  try {
    const raw = JSON.parse(localStorage.getItem(HOTKEYS_KEY) || '{}') || {}
    HOTKEY_DEFS.forEach(d => { if (raw[d.id]) out[d.id] = raw[d.id] })
  } catch (e) { /* 忽略 */ }
  return out
}
export const saveHotkeys = (hk) => {
  try { localStorage.setItem(HOTKEYS_KEY, JSON.stringify(hk)) } catch (e) { /* 忽略 */ }
}

/* 键盘事件 → 归一化键串（如 ctrl+shift+p / space / ctrl+,） */
export const keysOfEvent = (e) => {
  const parts = []
  if (e.ctrlKey) parts.push('ctrl')
  if (e.shiftKey) parts.push('shift')
  if (e.altKey) parts.push('alt')
  if (e.metaKey) parts.push('meta')
  const k = e.key
  if (k === ' ' || k === 'Spacebar') parts.push('space')
  else if (/^[a-zA-Z0-9]$/.test(k)) parts.push(k.toLowerCase())
  else if (k === ',') parts.push(',')
  else if (k === '.') parts.push('.')
  else if (k === ';') parts.push(';')
  else if (k === '/') parts.push('/')
  else if (k === "'") parts.push("'")
  else if (/^F([1-9]|1[0-2])$/.test(k)) parts.push(k.toLowerCase())
  else if (['Enter', 'Escape', 'Tab', 'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(k)) parts.push(k.toLowerCase())
  else return null
  return parts.join('+')
}
const KEY_LABEL = {
  ctrl: 'Ctrl', shift: 'Shift', alt: 'Alt', meta: '⌘', space: 'Space',
  enter: 'Enter', escape: 'Esc', tab: 'Tab', backspace: '⌫', delete: 'Del',
  arrowleft: '←', arrowright: '→', arrowup: '↑', arrowdown: '↓',
  home: 'Home', end: 'End', pageup: 'PgUp', pagedown: 'PgDn',
  f1: 'F1', f2: 'F2', f3: 'F3', f4: 'F4', f5: 'F5', f6: 'F6',
  f7: 'F7', f8: 'F8', f9: 'F9', f10: 'F10', f11: 'F11', f12: 'F12',
}
export const prettyKeys = (s) => (s || '').split('+').map(p => KEY_LABEL[p] || p).join(' + ')

/* ================= 声音页与闯关音效配置联动（rlearn_quest_sfx / rlearn_quest_ui） ================= */
const SFX_DEFAULT = { enabled: true, vol: 0.7, keyOn: true, keyType: 'soft', keyVol: 1, answerOn: true, answerVol: 1, combo: true, comboAnim: true, comboFx: true, sceneOn: true }
const loadSfx = () => { try { return { ...SFX_DEFAULT, ...(JSON.parse(localStorage.getItem('rlearn_quest_sfx') || '{}') || {}) } } catch { return { ...SFX_DEFAULT } } }
const saveSfx = (patch) => {
  const n = { ...loadSfx(), ...patch }
  try { localStorage.setItem('rlearn_quest_sfx', JSON.stringify(n)) } catch (e) { /* 忽略 */ }
  return n
}
const UI_DEFAULT = { font: 'system', qSize: '中', sSize: '中', theme: 'light', inputStyle: 'dynamic', answerMode: 'float', posMark: true, autoSpeak: false, speakTimes: 2, speakSpeed: 1, speakGap: 1, answerSpeak: false, autoNext: false, ignoreCase: true, showImage: true, imgPos: 'center', imgSize: 'mid', autoReveal: '3', wrongRec: '3', learnDefault: '初级', showProgress: true, showStruct: true, structStyle: 'outline', showWordTrans: true, skipNames: true, showPos: true, posStyle: 'color_text', posColors: { '名词': '#3b82f6', '动词': '#22c55e', '形容词': '#8b5cf6', '副词': '#eab308', '代词': '#ef4444', '介词': '#1e40af', '并列连词': '#f43f5e', '从属连词': '#f43f5e', '感叹词': '#f97316', '限定词': '#14b8a6', '助动词': '#22c55e', '专有名词': '#3b82f6', '人名': '#3b82f6', '数词': '#8b5cf6', '助词': '#9ca3af' }, posVis: { '名词': true, '动词': true, '形容词': true, '副词': true, '代词': true, '介词': true, '并列连词': true, '从属连词': true, '感叹词': true, '限定词': true, '助动词': true, '专有名词': true, '人名': true, '数词': true, '助词': true }, listenBlind: true, listenBlindTimes: 2, listenBlindSpeed: 1, listenSlow: true, listenSlowTimes: 2, listenSlowSpeed: 0.7, listenAns: true, listenAnsTimes: 1, listenAnsSpeed: 1, listenShowEn: true, listenShowZh: true, listenShowIpa: true, stageBtns: true, autoNextS: false, loopPlay: false, autoNextL: false, phaseGap: 2, speakMode: 'en', speakAutoPlay: true, videoPos: 'center', videoCover: false, showScore: true, petShow: true, petHelp: true, petHint: '3', themeMode: 'auto', bgColor: 'default', bgImage: null }
const POS_CATS = { '名词类': ['名词', '专有名词', '人名'], '动词类': ['动词', '助动词'], '修饰类': ['形容词', '副词'], '功能类': ['代词', '介词', '并列连词', '从属连词', '感叹词', '限定词', '数词', '助词'], '其他': [] }
const POS_ORDER = ['名词', '动词', '形容词', '副词', '代词', '介词', '并列连词', '从属连词', '感叹词', '限定词', '助动词', '专有名词', '人名', '数词', '助词']
const loadUi = () => { try { return { ...UI_DEFAULT, ...(JSON.parse(localStorage.getItem('rlearn_quest_ui') || '{}') || {}) } } catch { return { ...UI_DEFAULT } } }
const saveUi = (patch) => {
  const n = { ...loadUi(), ...patch }
  try { localStorage.setItem('rlearn_quest_ui', JSON.stringify(n)) } catch (e) { /* 忽略 */ }
  return n
}

/* ================= 设置弹窗 ================= */
const MENUS = [
  { key: '声音', icon: '🔊' },
  { key: '播放', icon: '▶️' },
  { key: '答题', icon: '✅' },
  { key: '学习', icon: '📚' },
  { key: '听力', icon: '🎧' },
  { key: '口语', icon: '🗣️' },
  { key: '视频', icon: '🎬' },
  { key: '游戏特效', icon: '✨' },
  { key: '宠物', icon: '🐾' },
  { key: '外观', icon: '🎨' },
  { key: '快捷键', icon: '⌨️' },
]
const KEY_TYPES = [['soft', '默认'], ['drum', '鼓点'], ['bubble', '气泡'], ['typewriter', '打字机'], ['sword', '金属剑'], ['cherryBlue', '青轴'], ['cherryRed', '红轴']]

/* Web Audio 预览试听（与闯关按键音同风格实现） */
function useAudioPreview() {
  const ctxRef = useRef(null)
  const ac = () => {
    try {
      if (!ctxRef.current) ctxRef.current = new (window.AudioContext || window.webkitAudioContext)()
      if (ctxRef.current.state === 'suspended') ctxRef.current.resume().catch(() => {})
      return ctxRef.current
    } catch (e) { return null }
  }
  const tone = (freq, dur, type = 'sine', gain = 0.1, when = 0, slideTo, vol = 1) => {
    const c = ac(); if (!c) return
    try {
      const t = c.currentTime + when
      const o = c.createOscillator(); const g = c.createGain()
      o.type = type; o.frequency.setValueAtTime(freq, t)
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur)
      g.gain.setValueAtTime(gain * vol, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + dur)
      o.connect(g); g.connect(c.destination)
      o.start(t); o.stop(t + dur + 0.03)
    } catch (e) { /* 忽略 */ }
  }
  const noise = (dur, gain = 0.08, when = 0, vol = 1) => {
    const c = ac(); if (!c) return
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
      src.connect(g); g.connect(c.destination)
      src.start(t); src.stop(t + dur + 0.02)
    } catch (e) { /* 忽略 */ }
  }
  const playKey = (type, vol = 0.7) => {
    const fx = {
      soft: () => tone(1560, 0.03, 'sine', 0.05, 0, null, vol),
      drum: () => { noise(0.06, 0.07, 0, vol); tone(120, 0.07, 'sine', 0.09, 0, 80, vol) },
      bubble: () => tone(420, 0.07, 'sine', 0.06, 0, 1300, vol),
      typewriter: () => { tone(950, 0.02, 'square', 0.035, 0, null, vol); noise(0.015, 0.025, 0, vol) },
      sword: () => tone(2300, 0.07, 'sawtooth', 0.045, 0, 900, vol),
      cherryBlue: () => { tone(1650, 0.018, 'square', 0.05, 0, null, vol); tone(720, 0.03, 'triangle', 0.04, 0.03, null, vol) },
      cherryRed: () => { tone(1050, 0.015, 'square', 0.04, 0, null, vol); noise(0.012, 0.018, 0, vol) },
    }
    ;(fx[type] || fx.soft)()
  }
  const playFeedback = (vol = 0.7) => {
    tone(523, 0.09, 'sine', 0.09, 0, null, vol); tone(659, 0.09, 'sine', 0.09, 0.06, null, vol); tone(784, 0.09, 'sine', 0.09, 0.12, null, vol); tone(1046, 0.18, 'sine', 0.1, 0.18, null, vol)
  }
  return { playKey, playFeedback, tone }
}

/* 发音试听：浏览器语音合成（俄语） */
const speakPreview = (text, vol = 1, rate = 1) => {
  try {
    const u = new SpeechSynthesisUtterance(text || 'Привет! Это проверка звука.')
    u.lang = 'ru-RU'; u.volume = vol; u.rate = rate
    const v = speechSynthesis.getVoices().find(v => v.lang && v.lang.toLowerCase().startsWith('ru'))
    if (v) u.voice = v
    speechSynthesis.cancel(); speechSynthesis.speak(u)
  } catch (e) { /* 忽略 */ }
}

export default function SettingsModal({ onClose }) {
  const { settings, save } = useSettingsStore()
  const [s, setS] = useState(settings)
  const [tab, setTab] = useState('快捷键')   // 默认选中快捷键
  const [hk, setHk] = useState(() => loadHotkeys())
  const [recId, setRecId] = useState(null)    // 正在录制的功能 id
  const [conflict, setConflict] = useState(null) // {id, newKeys, oldId, oldLabel}
  // 声音页配置（实时读写闯关配置）
  const [sfx, setSfx] = useState(() => loadSfx())
  const [ui, setUi] = useState(() => loadUi())
  const [posCat, setPosCat] = useState('全部')
  const { playKey, playFeedback } = useAudioPreview()

  const set = (k, v) => setS(prev => ({ ...prev, [k]: v }))
  const applyKeys = (id, k) => { const n = { ...hk, [id]: k }; setHk(n); saveHotkeys(n); setRecId(null); toast('快捷键已更新并保存') }
  const patchSfx = (p) => { const n = saveSfx(p); setSfx(n) }
  const patchUi = (p) => { const n = saveUi(p); setUi(n) }

  // 录制监听：捕获任意按键，Esc 取消，检测冲突
  useEffect(() => {
    if (!recId) return
    const h = (e) => {
      e.preventDefault(); e.stopPropagation()
      if (e.key === 'Escape') { setRecId(null); return }
      const k = keysOfEvent(e)
      if (!k) return
      const hasMod = e.ctrlKey || e.shiftKey || e.altKey || e.metaKey
      const isSpace = k === 'space' || k === 'shift+space'
      const isFn = /f\d+$/.test(k)
      if (!hasMod && !isSpace && !isFn) return // 单字母/数字必须带修饰键，避免打字误触
      const dupe = HOTKEY_DEFS.find(d => d.id !== recId && hk[d.id] === k)
      if (dupe) { setConflict({ id: recId, newKeys: k, oldId: dupe.id, oldLabel: dupe.label }); return }
      applyKeys(recId, k)
    }
    window.addEventListener('keydown', h, true)
    return () => window.removeEventListener('keydown', h, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recId, hk])

  const overwrite = () => {
    if (!conflict) return
    const n = { ...hk }
    const dup = HOTKEY_DEFS.find(d => d.id !== conflict.id && hk[d.id] === conflict.newKeys)
    if (dup) n[dup.id] = dup.def // 被覆盖项恢复默认键
    n[conflict.id] = conflict.newKeys
    setHk(n); saveHotkeys(n); setConflict(null); setRecId(null)
    toast('已覆盖，原功能恢复默认快捷键')
  }

  const doExport = () => {
    try { exportBackup(); toast('已导出备份') } catch (e) { toast('导出失败：' + e.message) }
  }
  const doImport = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    const r = new FileReader()
    r.onload = () => {
      try { importBackup(r.result); toast('已导入备份，刷新页面生效') } catch (err) { toast('导入失败：' + err.message) }
    }
    r.readAsText(f)
  }

  /* 练习背景图：10MB 限制 + 自动压缩到 1920px 宽 + JPEG 0.82 */
  const onBgImage = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 10 * 1024 * 1024) { toast('图片超过 10MB，请压缩后上传'); return }
    const r = new FileReader()
    r.onload = () => {
      const img = new Image()
      img.onload = () => {
        try {
          const maxW = 1920
          const scale = Math.min(1, maxW / (img.width || 1))
          const cv = document.createElement('canvas')
          cv.width = Math.round((img.width || 1) * scale); cv.height = Math.round((img.height || 1) * scale)
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height)
          patchUi({ bgImage: cv.toDataURL('image/jpeg', 0.82) })
          toast('背景图已应用')
        } catch (err) { toast('图片处理失败：' + err.message) }
      }
      img.onerror = () => toast('图片读取失败，请换一张试试')
      img.src = r.result
    }
    r.readAsDataURL(f)
  }

  const placeholder = (name) => (
    <div className="qs-ph">
      <div className="qs-ph-icon">🛠</div>
      <div className="qs-ph-title">「{name}」面板</div>
      <div className="qs-ph-desc">该配置面板正在规划中，后续版本开放，敬请期待。</div>
    </div>
  )

  const field = (label, children) => (
    <div className="qs-field">
      <label className="qs-field-label">{label}</label>
      {children}
    </div>
  )

  const Toggle = ({ on, onChange }) => (
    <button type="button" className={'qs-toggle' + (on ? ' qs-toggle-on' : '')} onClick={() => onChange(!on)} aria-pressed={!!on}>
      <span className="qs-toggle-knob" />
    </button>
  )

  const Slider = ({ value, onChange }) => (
    <span className="qs-slider-wrap">
      <input type="range" min="0" max="100" value={value} className="qs-slider" style={{ '--pct': value + '%' }} onChange={e => onChange(parseInt(e.target.value, 10))} />
      <span className="qs-slider-num">{value}%</span>
    </span>
  )

  /* 通用滑块：min/max/step + 自定义显示文案（播放页 1:1 用） */
  const QSlider = ({ min, max, step, value, display, onChange, w = 150 }) => (
    <span className="qs-slider-wrap">
      <input type="range" min={min} max={max} step={step} value={value} className="qs-slider" style={{ '--pct': ((value - min) / (max - min)) * 100 + '%', width: w + 'px' }} onChange={e => onChange(parseFloat(e.target.value))} />
      <span className="qs-slider-num">{display}</span>
    </span>
  )

  /* —— 「声音」设置页（1:1 复刻：发音源设置 + 声音开关设置） —— */
  const soundPanel = (
    <>
      {/* 区块1：发音源设置 */}
      <div className="qs-sec">
        <div className="qs-sec-title">发音源设置</div>
        <div className="qs-sec-sub">选择英语发音的来源和相关设置</div>

        <div className="qs-item">
          <div className="qs-item-left">
            <div className="qs-item-label">发音源</div>
          </div>
          <div className="qs-item-right">
            <select value={s.ttsSource || 'premium'} onChange={e => { const v = e.target.value; set('ttsSource', v); save({ ...s, ttsSource: v }) }}>
              <option value="premium">高级发音人</option>
              <option value="system">系统发音人</option>
            </select>
          </div>
        </div>

        <div className="qs-item">
          <div className="qs-item-left">
            <div className="qs-item-label">发音类型</div>
          </div>
          <div className="qs-item-right">
            <select value={s.ttsVoice || 'female'} onChange={e => { const v = e.target.value; set('ttsVoice', v); save({ ...s, ttsVoice: v }) }}>
              <option value="female">Ava（美式-女）</option>
              <option value="male">Dmitry（俄语-男）</option>
            </select>
            <button type="button" className="qs-preview-btn" title="试听发音人" onClick={() => speakPreview('Привет! Это проверка звука.', (s.vol ?? 100) / 100, s.rate || 1)}>🔊</button>
          </div>
        </div>

        <div className="qs-item">
          <div className="qs-item-left">
            <div className="qs-item-label">音量</div>
          </div>
          <div className="qs-item-right">
            <Slider value={s.vol ?? 100} onChange={v => { set('vol', v); save({ ...s, vol: v }) }} />
          </div>
        </div>

        <div className="qs-item">
          <div className="qs-item-left">
            <div className="qs-item-label">听不到声音？</div>
            <div className="qs-item-desc">检查播放设置，再试听发音人和音效</div>
          </div>
          <div className="qs-item-right">
            <button type="button" className="qs-detect-btn" onClick={() => { speakPreview('Проверка звука. Раз, два, три.', (s.vol ?? 100) / 100, s.rate || 1); playFeedback((s.vol ?? 100) / 100); toast('正在播放检测音，请检查扬声器') }}>开始检测</button>
          </div>
        </div>

        <button type="button" className="qs-grad-btn" onClick={() => toast('更多发音人正在接入中，敬请期待')}>✨ 解锁更多媲美真人的发音人</button>
      </div>

      {/* 区块2：声音开关设置 */}
      <div className="qs-sec">
        <div className="qs-sec-title">声音开关设置</div>
        <div className="qs-sec-sub">控制答题、答案等场景下的声音播放</div>

        <div className="qs-item">
          <div className="qs-item-left">
            <div className="qs-item-label">答案页自动播放声音</div>
          </div>
          <div className="qs-item-right">
            <Toggle on={!!ui.answerSpeak} onChange={v => patchUi({ answerSpeak: v })} />
          </div>
        </div>

        <div className="qs-item">
          <div className="qs-item-left">
            <div className="qs-item-label">答题页自动播放声音</div>
          </div>
          <div className="qs-item-right">
            <Toggle on={!!ui.autoSpeak} onChange={v => patchUi({ autoSpeak: v })} />
          </div>
        </div>

        <div className="qs-item">
          <div className="qs-item-left">
            <div className="qs-item-label">打字音效</div>
            <div className="qs-item-desc">输入时的按键声音</div>
          </div>
          <div className="qs-item-right">
            <Toggle on={!!sfx.keyOn} onChange={v => patchSfx({ keyOn: v })} />
          </div>
        </div>

        <div className="qs-item">
          <div className="qs-item-left">
            <div className="qs-item-label">音效类型</div>
            <div className="qs-item-desc">选择你喜欢的打字音效，点击试听</div>
          </div>
          <div className="qs-item-right">
            <select value={sfx.keyType} onChange={e => patchSfx({ keyType: e.target.value })}>
              {KEY_TYPES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
            <button type="button" className="qs-preview-btn" title="试听按键音" onClick={() => playKey(sfx.keyType, sfx.keyVol * 0.7)}>🔊</button>
          </div>
        </div>

        <div className="qs-item">
          <div className="qs-item-left">
            <div className="qs-item-label">打字音效音量</div>
            <div className="qs-item-desc">调节打字声音的大小</div>
          </div>
          <div className="qs-item-right">
            <Slider value={Math.round((sfx.keyVol ?? 1) * 100)} onChange={v => patchSfx({ keyVol: v / 100 })} />
          </div>
        </div>

        <div className="qs-item">
          <div className="qs-item-left">
            <div className="qs-item-label">操作反馈音效</div>
            <div className="qs-item-desc">答题正确/错误/完成时的提示音</div>
          </div>
          <div className="qs-item-right">
            <Toggle on={!!sfx.answerOn} onChange={v => patchSfx({ answerOn: v })} />
          </div>
        </div>

        <div className="qs-item">
          <div className="qs-item-left">
            <div className="qs-item-label">反馈音效音量</div>
            <div className="qs-item-desc">调节提示音的大小</div>
          </div>
          <div className="qs-item-right">
            <Slider value={Math.round((sfx.answerVol ?? 1) * 100)} onChange={v => patchSfx({ answerVol: v / 100 })} />
          </div>
        </div>
      </div>
    </>
  )

  return (
    <div className="qs-mask" onClick={onClose}>
      <div className="qs-panel" onClick={e => e.stopPropagation()}>
        <div className="qs-head">
          <h2>设置</h2>
          <button className="qs-close" onClick={onClose} title="关闭">×</button>
        </div>
        <div className="qs-body">
          <div className="qs-side">
            {MENUS.map(m => (
              <div key={m.key} className={'qs-menu' + (tab === m.key ? ' qs-menu-on' : '')} onClick={() => setTab(m.key)}>
                <span className="qs-menu-icon">{m.icon}</span>
                <span>{m.key}</span>
              </div>
            ))}
          </div>
          <div className="qs-main">
            {tab === '声音' ? soundPanel
              : tab === '答题' ? (
                <>
                  <div className="qs-panel-title">答题</div>
                  <div className="qs-panel-sub">答题、校验与错题相关设置</div>
                  <div className="qs-item">
                    <div className="qs-item-left"><div className="qs-item-label">答题正确后自动下一题</div></div>
                    <div className="qs-item-right"><Toggle on={!!ui.autoNext} onChange={v => patchUi({ autoNext: v })} /></div>
                  </div>
                  <div className="qs-item">
                    <div className="qs-item-left"><div className="qs-item-label">忽略大小写</div></div>
                    <div className="qs-item-right"><Toggle on={ui.ignoreCase !== false} onChange={v => patchUi({ ignoreCase: v })} /></div>
                  </div>
                  <div className="qs-item">
                    <div className="qs-item-left"><div className="qs-item-label">显示图片</div></div>
                    <div className="qs-item-right"><Toggle on={ui.showImage !== false} onChange={v => patchUi({ showImage: v })} /></div>
                  </div>
                  <div className="qs-item">
                    <div className="qs-item-left"><div className="qs-item-label">图片位置</div></div>
                    <div className="qs-item-right">
                      <select value={ui.imgPos || 'center'} onChange={e => patchUi({ imgPos: e.target.value })}>
                        <option value="center">居中</option><option value="top">上方</option><option value="bottom">下方</option>
                      </select>
                    </div>
                  </div>
                  <div className="qs-item">
                    <div className="qs-item-left"><div className="qs-item-label">图片大小</div></div>
                    <div className="qs-item-right">
                      <select value={ui.imgSize || 'mid'} onChange={e => patchUi({ imgSize: e.target.value })}>
                        <option value="small">小</option><option value="mid">中</option><option value="large">大</option>
                      </select>
                    </div>
                  </div>
                  <div className="qs-item">
                    <div className="qs-item-left"><div className="qs-item-label">答题输入框样式</div></div>
                    <div className="qs-item-right">
                      <select value={ui.inputStyle || 'dynamic'} onChange={e => patchUi({ inputStyle: e.target.value })}>
                        <option value="dynamic">单词长度</option><option value="fixed">固定宽度</option><option value="underline">极简横线</option>
                      </select>
                    </div>
                  </div>
                  <div className="qs-item">
                    <div className="qs-item-left">
                      <div className="qs-item-label">答案显示模式</div>
                      <div className="qs-item-desc">内联模式适合小屏幕</div>
                    </div>
                    <div className="qs-item-right">
                      <select value={ui.answerMode || 'float'} onChange={e => patchUi({ answerMode: e.target.value })}>
                        <option value="float">浮层模式</option><option value="inline">内嵌模式</option>
                      </select>
                    </div>
                  </div>
                  <div className="qs-item">
                    <div className="qs-item-left"><div className="qs-item-label">自动显示答案</div></div>
                    <div className="qs-item-right">
                      <select value={ui.autoReveal || '3'} onChange={e => patchUi({ autoReveal: e.target.value })}>
                        <option value="3">错误3次后</option><option value="2">错误2次后</option><option value="1">错误1次后</option><option value="off">不显示</option>
                      </select>
                    </div>
                  </div>
                  <div className="qs-item">
                    <div className="qs-item-left"><div className="qs-item-label">记录到错题本</div></div>
                    <div className="qs-item-right">
                      <select value={ui.wrongRec || '3'} onChange={e => patchUi({ wrongRec: e.target.value })}>
                        <option value="3">错误3次后</option><option value="2">错误2次后</option><option value="1">错误1次后</option><option value="always">总是</option>
                      </select>
                    </div>
                  </div>
                </>
              ) : tab === '快捷键' ? (
                <>
                  <div className="qs-panel-title">快捷键</div>
                  <div className="qs-panel-sub">点击「编辑」重新录制组合键；修改自动保存到浏览器，刷新不丢失。输入框打字时快捷键自动禁用。</div>
                  {HOTKEY_DEFS.map(d => (
                    <div className="qs-row" key={d.id}>
                      <span className="qs-row-name">{d.label}</span>
                      <span className="qs-chip">{prettyKeys(hk[d.id])}</span>
                      <button className="qs-edit" onClick={() => setRecId(d.id)}>编辑</button>
                    </div>
                  ))}
                </>
              ) : tab === '播放' ? (
                <div className="qs-sec">
                  <div className="qs-sec-title">播放设置</div>
                  <div className="qs-sec-sub">调整播放速度、次数和间隔</div>

                  <div className="qs-item">
                    <div className="qs-item-left">
                      <div className="qs-item-label">倍速</div>
                    </div>
                    <div className="qs-item-right">
                      <QSlider min={0.5} max={2} step={0.1} value={s.rate ?? 1} display={(s.rate ?? 1) + 'x'} onChange={v => { set('rate', v); save({ ...s, rate: v }) }} />
                    </div>
                  </div>

                  <div className="qs-item">
                    <div className="qs-item-left">
                      <div className="qs-item-label">播放次数</div>
                    </div>
                    <div className="qs-item-right">
                      <QSlider min={1} max={5} step={1} value={ui.speakTimes ?? 2} display={(ui.speakTimes ?? 2) + '次'} onChange={v => patchUi({ speakTimes: v })} />
                    </div>
                  </div>

                  <div className="qs-item">
                    <div className="qs-item-left">
                      <div className="qs-item-label">播放间隔</div>
                    </div>
                    <div className="qs-item-right">
                      <QSlider min={0} max={3} step={0.5} value={ui.speakGap ?? 1} display={(ui.speakGap ?? 1) + 's'} onChange={v => patchUi({ speakGap: v })} />
                    </div>
                  </div>
                </div>
              ) : tab === '听力' ? (
                <>
                  {/* 区块1：听力模式设置 */}
                  <div className="qs-sec">
                    <div className="qs-sec-title">听力模式设置</div>
                    <div className="qs-sec-sub">配置每个阶段的播放次数、速度和开关</div>

                    {/* 盲听阶段 */}
                    <div className="qs-item">
                      <div className="qs-item-left">
                        <div className="qs-item-label">盲听</div>
                        <div className="qs-item-desc">无字幕，正常语速</div>
                      </div>
                      <div className="qs-item-right"><Toggle on={ui.listenBlind !== false} onChange={v => patchUi({ listenBlind: v })} /></div>
                    </div>
                    <div className="qs-stage-row">
                      <span className="qs-stage-k">次数</span>
                      <select className="qs-stage-select" value={ui.listenBlindTimes ?? 2} onChange={e => patchUi({ listenBlindTimes: parseInt(e.target.value, 10) })}>
                        <option value="1">1次</option><option value="2">2次</option><option value="3">3次</option>
                      </select>
                      <span className="qs-stage-k">速度</span>
                      <select className="qs-stage-select" value={ui.listenBlindSpeed ?? 1} onChange={e => patchUi({ listenBlindSpeed: parseFloat(e.target.value) })}>
                        <option value="0.7">0.7x</option><option value="0.8">0.8x</option><option value="0.9">0.9x</option><option value="1">1.0x</option><option value="1.2">1.2x</option><option value="1.5">1.5x</option>
                      </select>
                    </div>

                    {/* 慢听阶段 */}
                    <div className="qs-item">
                      <div className="qs-item-left">
                        <div className="qs-item-label">慢听</div>
                        <div className="qs-item-desc">无字幕，慢速播放</div>
                      </div>
                      <div className="qs-item-right"><Toggle on={ui.listenSlow !== false} onChange={v => patchUi({ listenSlow: v })} /></div>
                    </div>
                    <div className="qs-stage-row">
                      <span className="qs-stage-k">次数</span>
                      <select className="qs-stage-select" value={ui.listenSlowTimes ?? 2} onChange={e => patchUi({ listenSlowTimes: parseInt(e.target.value, 10) })}>
                        <option value="1">1次</option><option value="2">2次</option><option value="3">3次</option>
                      </select>
                      <span className="qs-stage-k">速度</span>
                      <select className="qs-stage-select" value={ui.listenSlowSpeed ?? 0.7} onChange={e => patchUi({ listenSlowSpeed: parseFloat(e.target.value) })}>
                        <option value="0.5">0.5x</option><option value="0.6">0.6x</option><option value="0.7">0.7x</option><option value="0.8">0.8x</option><option value="0.9">0.9x</option>
                      </select>
                    </div>

                    {/* 答案阶段 */}
                    <div className="qs-item">
                      <div className="qs-item-left">
                        <div className="qs-item-label">答案</div>
                        <div className="qs-item-desc">播放原速音频，展示完整答案与逐词信息</div>
                      </div>
                      <div className="qs-item-right"><Toggle on={ui.listenAns !== false} onChange={v => patchUi({ listenAns: v })} /></div>
                    </div>
                    <div className="qs-stage-row">
                      <span className="qs-stage-k">次数</span>
                      <select className="qs-stage-select" value={ui.listenAnsTimes ?? 1} onChange={e => patchUi({ listenAnsTimes: parseInt(e.target.value, 10) })}>
                        <option value="1">1次</option><option value="2">2次</option><option value="3">3次</option>
                      </select>
                      <span className="qs-stage-k">速度</span>
                      <select className="qs-stage-select" value={ui.listenAnsSpeed ?? 1} onChange={e => patchUi({ listenAnsSpeed: parseFloat(e.target.value) })}>
                        <option value="0.7">0.7x</option><option value="0.8">0.8x</option><option value="0.9">0.9x</option><option value="1">1.0x</option><option value="1.2">1.2x</option>
                      </select>
                    </div>
                    <div className="qs-show-row">
                      <span className="qs-stage-k">显示内容</span>
                      <span className="qs-show-item"><span>英文</span><Toggle on={ui.listenShowEn !== false} onChange={v => patchUi({ listenShowEn: v })} /></span>
                      <span className="qs-show-item"><span>中文</span><Toggle on={ui.listenShowZh !== false} onChange={v => patchUi({ listenShowZh: v })} /></span>
                      <span className="qs-show-item"><span>音标</span><Toggle on={ui.listenShowIpa !== false} onChange={v => patchUi({ listenShowIpa: v })} /></span>
                    </div>
                    <div className="qs-stage-hint">至少保留英文或中文其一</div>
                  </div>

                  {/* 区块2：推进设置 */}
                  <div className="qs-sec">
                    <div className="qs-sec-title">推进设置</div>
                    <div className="qs-item">
                      <div className="qs-item-left">
                        <div className="qs-item-label">显示阶段按钮</div>
                        <div className="qs-item-desc">隐藏盲听/慢听/答案胶囊，减少学习干扰</div>
                      </div>
                      <div className="qs-item-right"><Toggle on={ui.stageBtns !== false} onChange={v => patchUi({ stageBtns: v })} /></div>
                    </div>
                    <div className="qs-item">
                      <div className="qs-item-left"><div className="qs-item-label">自动下一句</div></div>
                      <div className="qs-item-right"><Toggle on={!!ui.autoNextS} onChange={v => patchUi({ autoNextS: v })} /></div>
                    </div>
                    <div className="qs-item">
                      <div className="qs-item-left">
                        <div className="qs-item-label">循环播放</div>
                        <div className="qs-item-desc">播完最后一句后自动从第一句重新开始</div>
                      </div>
                      <div className="qs-item-right"><Toggle on={!!ui.loopPlay} onChange={v => patchUi({ loopPlay: v })} /></div>
                    </div>
                    <div className="qs-item">
                      <div className="qs-item-left">
                        <div className="qs-item-label">自动下一课</div>
                        <div className="qs-item-desc">一课听完自动进入下一课，连续播放整个课程包</div>
                      </div>
                      <div className="qs-item-right"><Toggle on={!!ui.autoNextL} onChange={v => patchUi({ autoNextL: v })} /></div>
                    </div>
                    <div className="qs-item">
                      <div className="qs-item-left"><div className="qs-item-label">阶段间停顿</div></div>
                      <div className="qs-item-right">
                        <QSlider min={0} max={5} step={0.5} value={ui.phaseGap ?? 2} display={(ui.phaseGap ?? 2).toFixed(1) + 's'} onChange={v => patchUi({ phaseGap: v })} />
                      </div>
                    </div>
                  </div>

                  {/* 区块3：转写设置（保留原有功能） */}
                  <div className="qs-sec">
                    <div className="qs-sec-title">转写设置</div>
                    <div className="qs-sec-sub">「从音频识别字幕」用，纯本地无需 key</div>
                    <div className="qs-item">
                      <div className="qs-item-left"><div className="qs-item-label">Whisper 转写模型</div></div>
                      <div className="qs-item-right">
                        <select value={s.whisperModel || 'small'} onChange={e => set('whisperModel', e.target.value)}>
                          <option value="tiny">tiny —— 最快，错字较多</option>
                          <option value="base">base —— 快，一般</option>
                          <option value="small">small —— 推荐，质量/速度平衡</option>
                          <option value="medium">medium —— 更准，慢、占内存多</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </>
              ) : tab === '学习' ? (
                <>
                  {/* 区块1：默认难度 */}
                  <div className="qs-sec">
                    <div className="qs-sec-title">默认难度</div>
                    <div className="qs-sec-sub">进入新课程时的默认选择(切换不会立刻更新游戏难度)</div>
                    <div className="qs-item">
                      <div className="qs-item-left"><div className="qs-item-label">难度选择</div></div>
                      <div className="qs-item-right">
                        <select value={ui.learnDefault || '初级'} onChange={e => patchUi({ learnDefault: e.target.value })}>
                          <option value="初级">初级</option><option value="中级">中级</option><option value="高级">高级</option><option value="自定义">自定义</option>
                        </select>
                      </div>
                    </div>
                    <div className="qs-tips">
                      <div className="qs-tip"><span className="qs-tip-ico qs-tip-purple">🧩</span><span>练习内容：句子 + 语块 + 组合语块 + 短语单词</span></div>
                      <div className="qs-tip"><span className="qs-tip-ico qs-tip-yellow">💡</span><span>学习建议：适合刚接触新内容，还不太熟悉时使用</span></div>
                    </div>
                  </div>

                  {/* 区块2：句子设置 */}
                  <div className="qs-sec">
                    <div className="qs-sec-title">句子设置</div>
                    <div className="qs-sec-sub">自定义句子学习的显示和交互</div>
                    <div className="qs-item">
                      <div className="qs-item-left">
                        <div className="qs-item-label">显示句子进度</div>
                        <div className="qs-item-desc">在右上角显示当前句子的学习进度（如 3/7）</div>
                      </div>
                      <div className="qs-item-right"><Toggle on={ui.showProgress !== false} onChange={v => patchUi({ showProgress: v })} /></div>
                    </div>
                    <div className="qs-item">
                      <div className="qs-item-left">
                        <div className="qs-item-label">显示句子结构</div>
                        <div className="qs-item-desc">开启后可查看句子的结构划分，并为不同成分智能高亮，悬浮时可查看成分释义</div>
                      </div>
                      <div className="qs-item-right"><Toggle on={ui.showStruct !== false} onChange={v => patchUi({ showStruct: v })} /></div>
                    </div>
                    <div className="qs-item">
                      <div className="qs-item-left">
                        <div className="qs-item-label">结构高亮样式</div>
                        <div className="qs-item-desc">框线：描边框住成分并显示成分名；色块：实色填充更醒目</div>
                      </div>
                      <div className="qs-item-right">
                        <select value={ui.structStyle || 'outline'} onChange={e => patchUi({ structStyle: e.target.value })}>
                          <option value="outline">框线 + 成分名</option><option value="block">色块填充</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* 区块3：单词显示设置 */}
                  <div className="qs-sec">
                    <div className="qs-sec-title">单词显示设置</div>
                    <div className="qs-sec-sub">自定义单词的显示内容和样式</div>
                    <div className="qs-item">
                      <div className="qs-item-left">
                        <div className="qs-item-label">显示单词翻译</div>
                        <div className="qs-item-desc">在单词下方显示中文翻译</div>
                      </div>
                      <div className="qs-item-right"><Toggle on={ui.showWordTrans !== false} onChange={v => patchUi({ showWordTrans: v })} /></div>
                    </div>
                    <div className="qs-item">
                      <div className="qs-item-left">
                        <div className="qs-item-label">忽略人名</div>
                        <div className="qs-item-desc">练习时自动跳过人名，无需输入</div>
                      </div>
                      <div className="qs-item-right"><Toggle on={ui.skipNames !== false} onChange={v => patchUi({ skipNames: v })} /></div>
                    </div>
                    <div className="qs-item">
                      <div className="qs-item-left">
                        <div className="qs-item-label">显示词性</div>
                        <div className="qs-item-desc">在单词下方显示词性标记</div>
                      </div>
                      <div className="qs-item-right"><Toggle on={ui.showPos !== false} onChange={v => patchUi({ showPos: v })} /></div>
                    </div>
                    <div className="qs-item">
                      <div className="qs-item-left">
                        <div className="qs-item-label">词性显示方式</div>
                        <div className="qs-item-desc">选择使用颜色下划线、文字标签或两者同时显示</div>
                      </div>
                      <div className="qs-item-right">
                        <select value={ui.posStyle || 'color_text'} onChange={e => patchUi({ posStyle: e.target.value })}>
                          <option value="color_text">颜色+文字</option><option value="color">仅颜色</option><option value="text">仅文字</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* 区块4：词性颜色设置 */}
                  <div className="qs-sec">
                    <div className="qs-sec-title">词性颜色设置</div>
                    <div className="qs-sec-sub">自定义不同词性的显示颜色和可见性</div>
                    <div className="qs-sub-note">中文（名词/动词/形容词/...）或英文（NOUN/VERB/ADJ/...）</div>
                    <div className="qs-pos-actions">
                      <button className="qs-pos-act qs-pos-act-blue" onClick={() => { const nv = {}; POS_ORDER.forEach(k => { nv[k] = true }); patchUi({ posVis: nv }) }}>全部显示</button>
                      <button className="qs-pos-act qs-pos-act-gray" onClick={() => { const nv = {}; POS_ORDER.forEach(k => { nv[k] = false }); patchUi({ posVis: nv }) }}>全部隐藏</button>
                      <button className="qs-pos-act qs-pos-act-purple" onClick={() => patchUi({ posColors: { ...UI_DEFAULT.posColors } })}>重置颜色</button>
                    </div>
                    <div className="qs-pos-tabs">
                      {['全部', ...Object.keys(POS_CATS)].map(c => (
                        <button key={c} className={'qs-pos-tab' + (posCat === c ? ' qs-pos-tab-on' : '')} onClick={() => setPosCat(c)}>{c}</button>
                      ))}
                    </div>
                    <div className="qs-pos-grid">
                      {POS_ORDER.filter(k => posCat === '全部' || (POS_CATS[posCat] || []).includes(k)).map(k => (
                        <div key={k} className="qs-pos-card" style={{ borderTop: '3px solid ' + (ui.posColors || UI_DEFAULT.posColors)[k] }}>
                          <div className="qs-pos-name">{k}</div>
                          <button className="qs-pos-eye" title={ui.posVis ? ui.posVis[k] !== false ? '点击隐藏' : '点击显示' : '点击隐藏'} onClick={() => patchUi({ posVis: { ...(ui.posVis || UI_DEFAULT.posVis), [k]: ui.posVis ? ui.posVis[k] === false : false } })}>{ui.posVis ? ui.posVis[k] !== false ? '👁' : '🙈' : '👁'}</button>
                          <span className="qs-pos-swatch" style={{ background: (ui.posColors || UI_DEFAULT.posColors)[k] }} />
                          <label className="qs-pos-edit" title="自定义颜色">
                            ✏️
                            <input type="color" value={(ui.posColors || UI_DEFAULT.posColors)[k]} onChange={e => patchUi({ posColors: { ...(ui.posColors || UI_DEFAULT.posColors), [k]: e.target.value } })} />
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 区块5：AI 与数据（保留原有功能） */}
                  <div className="qs-sec">
                    <div className="qs-sec-title">AI 与数据</div>
                    <div className="qs-sec-sub">AI 助教与数据备份</div>
                    <div className="qs-item">
                      <div className="qs-item-left"><div className="qs-item-label">AI 朗读声音</div></div>
                      <div className="qs-item-right">
                        <select value={s.ttsVoice || 'female'} onChange={e => set('ttsVoice', e.target.value)}>
                          <option value="female">女声</option>
                          <option value="male">男声（Dmitry）</option>
                        </select>
                      </div>
                    </div>
                    <div className="qs-item">
                      <div className="qs-item-left"><div className="qs-item-label">尚雯婕模式循环遍数</div></div>
                      <div className="qs-item-right"><input type="number" min="1" max="10" style={{ width: 90 }} value={s.loopTimes} onChange={e => set('loopTimes', parseInt(e.target.value) || 3)} /></div>
                    </div>
                    <div className="qs-item">
                      <div className="qs-item-left"><div className="qs-item-label">AI 助教自动朗读</div></div>
                      <div className="qs-item-right">
                        <select value={s.autoRead === false ? 'off' : 'on'} onChange={e => set('autoRead', e.target.value === 'on')}>
                          <option value="on">开启（AI 回复后自动朗读）</option>
                          <option value="off">关闭（手动点朗读）</option>
                        </select>
                      </div>
                    </div>
                    <div className="qs-hint">「语法解释 / AI 解析 / AI 断句 / AI 助教」等 AI 功能均由服务端统一处理（密钥在服务器环境变量中配置），无需在网页内填写。</div>
                    <div className="qs-btns">
                      <button className="qs-btn" onClick={doExport}>导出备份</button>
                      <button className="qs-btn" onClick={() => document.getElementById('impBackup').click()}>导入备份</button>
                      <input type="file" id="impBackup" accept=".json" style={{ display: 'none' }} onChange={doImport} />
                    </div>
                  </div>
                </>
              ) : tab === '口语' ? (
                <>
                  <div className="qs-sec">
                    <div className="qs-sec-title">口语模式设置</div>
                    <div className="qs-sec-sub">调整口语评测的显示模式</div>
                    <div className="qs-sel-group">
                      <div className={'qs-sel-card' + ((ui.speakMode || 'en') === 'en' ? ' qs-sel-on' : '')} onClick={() => patchUi({ speakMode: 'en' })}>
                        <span className="qs-sel-ico">Aa</span>
                        <div className="qs-sel-body">
                          <div className="qs-sel-title">显示英文</div>
                          <div className="qs-sel-desc">看英文原句，练习朗读发音</div>
                        </div>
                        {(ui.speakMode || 'en') === 'en' && <span className="qs-sel-check">✓</span>}
                      </div>
                      <div className={'qs-sel-card' + (ui.speakMode === 'zh' ? ' qs-sel-on' : '')} onClick={() => patchUi({ speakMode: 'zh' })}>
                        <span className="qs-sel-ico">文A</span>
                        <div className="qs-sel-body">
                          <div className="qs-sel-title">显示中文</div>
                          <div className="qs-sel-desc">看中文翻译，练习口语翻译</div>
                        </div>
                        {ui.speakMode === 'zh' && <span className="qs-sel-check">✓</span>}
                      </div>
                      <div className={'qs-sel-card' + (ui.speakMode === 'blind' ? ' qs-sel-on' : '')} onClick={() => patchUi({ speakMode: 'blind' })}>
                        <span className="qs-sel-ico">🙈</span>
                        <div className="qs-sel-body">
                          <div className="qs-sel-title">盲读模式</div>
                          <div className="qs-sel-desc">不显示任何提示，挑战记忆</div>
                        </div>
                        {ui.speakMode === 'blind' && <span className="qs-sel-check">✓</span>}
                      </div>
                    </div>
                    <div className="qs-item">
                      <div className="qs-item-left">
                        <div className="qs-item-label">自动播放声音</div>
                        <div className="qs-item-desc">进入口语题目时自动播放声音</div>
                      </div>
                      <div className="qs-item-right"><Toggle on={ui.speakAutoPlay !== false} onChange={v => patchUi({ speakAutoPlay: v })} /></div>
                    </div>
                  </div>
                </>
              ) : tab === '视频' ? (
                <>
                  <div className="qs-panel-title">视频</div>
                  <div className="qs-panel-sub">视频播放与字幕相关设置</div>
                  <div className="qs-item">
                    <div className="qs-item-left"><div className="qs-item-label">视频位置</div></div>
                    <div className="qs-item-right">
                      <select value={ui.videoPos || 'center'} onChange={e => patchUi({ videoPos: e.target.value })}>
                        <option value="center">居中（沉浸）</option><option value="side">侧边</option><option value="top">顶部</option><option value="bottom">底部</option>
                      </select>
                    </div>
                  </div>
                  <div className="qs-item">
                    <div className="qs-item-left">
                      <div className="qs-item-label">遮挡字幕</div>
                      <div className="qs-item-desc">开启后可在视频上直接拖拽调整</div>
                    </div>
                    <div className="qs-item-right"><Toggle on={!!ui.videoCover} onChange={v => patchUi({ videoCover: v })} /></div>
                  </div>
                </>
              ) : tab === '游戏特效' ? (
                <>
                  <div className="qs-sec">
                    <div className="qs-sec-title">游戏特效</div>
                    <div className="qs-sec-sub">调整游戏内的激励反馈效果</div>
                    <div className="qs-item">
                      <div className="qs-item-left">
                        <div className="qs-item-label">连击</div>
                        <div className="qs-item-desc">连续答对时的激励反馈效果</div>
                      </div>
                      <div className="qs-item-right"><Toggle on={sfx.combo !== false} onChange={v => patchSfx({ combo: v })} /></div>
                    </div>
                    <div className="qs-item">
                      <div className="qs-item-left">
                        <div className="qs-item-label">连击动画</div>
                        <div className="qs-item-desc">连续答对时在屏幕中间显示 Great/Perfect 动画</div>
                      </div>
                      <div className="qs-item-right"><Toggle on={sfx.comboAnim !== false} onChange={v => patchSfx({ comboAnim: v })} /></div>
                    </div>
                    <div className="qs-item">
                      <div className="qs-item-left">
                        <div className="qs-item-label">连击音效</div>
                        <div className="qs-item-desc">连续答对时播放激励音效</div>
                      </div>
                      <div className="qs-item-right"><Toggle on={sfx.comboFx !== false} onChange={v => patchSfx({ comboFx: v })} /></div>
                    </div>
                    <div className="qs-item">
                      <div className="qs-item-left">
                        <div className="qs-item-label">积分显示</div>
                        <div className="qs-item-desc">在游戏页面右上角显示当前积分</div>
                      </div>
                      <div className="qs-item-right"><Toggle on={ui.showScore !== false} onChange={v => patchUi({ showScore: v })} /></div>
                    </div>
                  </div>
                </>
              ) : tab === '宠物' ? (
                <>
                  <div className="qs-sec">
                    <div className="qs-sec-title">宠物设置</div>
                    <div className="qs-sec-sub">练习页面右下角的宠物助手</div>
                    <div className="qs-item">
                      <div className="qs-item-left">
                        <div className="qs-item-label">宠物助手</div>
                        <div className="qs-item-desc">控制练习页面右下角的宠物显示</div>
                      </div>
                      <div className="qs-item-right"><Toggle on={ui.petShow !== false} onChange={v => patchUi({ petShow: v })} /></div>
                    </div>
                    <div className="qs-item">
                      <div className="qs-item-left">
                        <div className="qs-item-label">主动求助提示</div>
                        <div className="qs-item-desc">连续答错时，宠物会询问是否请求 AI 帮助</div>
                      </div>
                      <div className="qs-item-right"><Toggle on={ui.petHelp !== false} onChange={v => patchUi({ petHelp: v })} /></div>
                    </div>
                    <div className="qs-item">
                      <div className="qs-item-left">
                        <div className="qs-item-label">提示时机</div>
                        <div className="qs-item-desc">达到次数后，每道题只提示一次</div>
                      </div>
                      <div className="qs-item-right">
                        <select value={ui.petHint || '3'} onChange={e => patchUi({ petHint: e.target.value })}>
                          <option value="1">错误1次后</option><option value="2">错误2次后</option><option value="3">错误3次后</option><option value="5">错误5次后</option><option value="always">总是</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </>
              ) : tab === '外观' ? (
                <>
                  <div className="qs-item">
                    <div className="qs-item-left"><div className="qs-item-label">主题设置</div></div>
                    <div className="qs-item-right">
                      <div className="qs-theme-row">
                        <button type="button" className={'qs-theme-ic' + ((ui.themeMode || 'auto') === 'light' ? ' qs-theme-on' : '')} title="浅色模式" onClick={() => patchUi({ themeMode: 'light' })}>☀️</button>
                        <button type="button" className={'qs-theme-ic' + (ui.themeMode === 'dark' ? ' qs-theme-on' : '')} title="深色模式" onClick={() => patchUi({ themeMode: 'dark' })}>🌙</button>
                        <button type="button" className={'qs-theme-ic' + ((ui.themeMode || 'auto') === 'auto' ? ' qs-theme-on' : '')} title="跟随系统" onClick={() => patchUi({ themeMode: 'auto' })}>🖥️</button>
                      </div>
                    </div>
                  </div>
                  <div className="qs-bg-block">
                    <div className="qs-bg-title">练习背景色</div>
                    <div className="qs-bg-sub">选择游戏练习时的背景颜色，或上传自定义背景图</div>
                    <div className="qs-bg-row">
                      <button type="button" className={'qs-bg-sq' + ((ui.bgColor || 'default') === 'default' ? ' qs-bg-on' : '')} style={{ background: '#ffffff' }} title="默认" onClick={() => patchUi({ bgColor: 'default', bgImage: null })} />
                      <button type="button" className={'qs-bg-sq' + (ui.bgColor === 'warm' ? ' qs-bg-on' : '')} style={{ background: '#faf3e7' }} title="暖色护眼" onClick={() => patchUi({ bgColor: 'warm', bgImage: null })} />
                      <button type="button" className={'qs-bg-sq' + (ui.bgColor === 'green' ? ' qs-bg-on' : '')} style={{ background: '#eaf4ea' }} title="绿色护眼" onClick={() => patchUi({ bgColor: 'green', bgImage: null })} />
                    </div>
                    <div className="qs-bg-labels"><span>默认</span><span>暖色护眼</span><span>绿色护眼</span></div>
                    <label className="qs-bg-upload">
                      <span>🖼️ 上传背景图</span>
                      <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={onBgImage} />
                    </label>
                    <div className="qs-bg-note">
                      支持 JPG / PNG / WebP，单张最大 10MB（上传后会自动压缩）。<br />
                      推荐画面简洁的横向大图（渐变、风景、纹理），分辨率 1920px 以上；主体避开中央，练习内容会居中显示。
                    </div>
                  </div>
                </>
              ) : placeholder(tab)}
          </div>
        </div>
        <div className="qs-foot">
          <button className="qs-btn qs-btn-ghost" onClick={onClose}>取消</button>
          <button className="qs-btn qs-btn-primary" onClick={() => { save(s); onClose() }}>保存</button>
        </div>
      </div>

      {/* 按键录制弹窗 */}
      {recId && (
        <div className="qs-rec-mask" onClick={e => e.stopPropagation()}>
          <div className="qs-rec">
            <div className="qs-rec-title">录制快捷键</div>
            <div className="qs-rec-desc">请为「{HOTKEY_DEFS.find(d => d.id === recId)?.label}」按下新的组合键…</div>
            <div className="qs-rec-box">按下任意组合键（Esc 取消）</div>
            <button className="qs-btn qs-btn-ghost" onClick={() => setRecId(null)}>取消</button>
          </div>
        </div>
      )}

      {/* 冲突提示 */}
      {conflict && (
        <div className="qs-rec-mask" onClick={e => e.stopPropagation()}>
          <div className="qs-rec">
            <div className="qs-rec-title">快捷键冲突</div>
            <div className="qs-rec-desc">
              「{prettyKeys(conflict.newKeys)}」已被「{conflict.oldLabel}」占用，是否覆盖？
              <br />覆盖后原功能将恢复默认快捷键。
            </div>
            <div className="qs-btns" style={{ justifyContent: 'center' }}>
              <button className="qs-btn qs-btn-ghost" onClick={() => { setConflict(null) }}>取消</button>
              <button className="qs-btn qs-btn-primary" onClick={overwrite}>覆盖</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .qs-mask{position:fixed;inset:0;background:rgba(15,15,18,.45);backdrop-filter:blur(3px);z-index:1300;display:flex;align-items:center;justify-content:center;padding:20px;font-family:-apple-system,'Segoe UI','PingFang SC','Microsoft YaHei','Noto Sans','Helvetica Neue',sans-serif}
        .qs-panel{width:min(920px,96vw);max-width:920px;max-height:88vh;background:#fff;border-radius:16px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.25);color:#333;position:relative}
        .qs-head{display:flex;align-items:center;justify-content:space-between;padding:15px 22px;border-bottom:1px solid #ececef;flex-shrink:0}
        .qs-head h2{margin:0;font-size:17px;font-weight:600;color:#222}
        .qs-close{background:#f4f4f6;border:none;width:32px;height:32px;border-radius:9px;font-size:20px;line-height:1;color:#666;cursor:pointer;display:flex;align-items:center;justify-content:center}
        .qs-close:hover{background:#e8e8ec;color:#222}
        .qs-body{display:flex;flex:1;min-height:0}
        .qs-side{width:172px;flex-shrink:0;border-right:1px solid #ececef;padding:12px 10px;overflow-y:auto;background:#fafafb}
        .qs-menu{display:flex;align-items:center;gap:9px;padding:10px 15px;border-radius:9px;color:#555;cursor:pointer;font-size:14px;margin-bottom:3px;user-select:none;transition:background .15s,color .15s}
        .qs-menu-icon{font-size:15px;line-height:1;width:18px;text-align:center}
        .qs-menu:hover{background:#efeff2;color:#222}
        .qs-menu-on{background:#2b2b31;color:#fff;font-weight:600}
        .qs-menu-on:hover{background:#2b2b31;color:#fff}
        .qs-main{flex:1;overflow-y:auto;padding:22px 26px;background:#fff}
        .qs-panel-title{font-size:16px;font-weight:600;color:#222;margin-bottom:6px}
        .qs-panel-sub{font-size:12.5px;color:#999;margin-bottom:16px;line-height:1.6}
        /* —— 声音页：两个浅灰边框区块 —— */
        .qs-sec{border:1px solid #efeff2;border-radius:14px;padding:20px 22px 8px;margin-bottom:18px;background:#fff}
        .qs-sec-title{font-size:16px;font-weight:600;color:#222;margin-bottom:4px}
        .qs-sec-sub{font-size:12.5px;color:#999;margin-bottom:6px;line-height:1.6}
        .qs-item{display:flex;justify-content:space-between;align-items:center;padding:14px 2px;border-bottom:1px solid #f4f4f6}
        .qs-item:last-child{border-bottom:none}
        .qs-item-left{display:flex;flex-direction:column;gap:3px}
        .qs-item-label{font-size:14px;color:#333;font-weight:500}
        .qs-item-desc{font-size:12px;color:#aaa}
        .qs-item-right{display:flex;align-items:center;gap:10px;flex-shrink:0;margin-left:20px}
        .qs-item-right select{min-width:170px;padding:7px 12px;border:1px solid #e0e0e4;border-radius:8px;font-size:13.5px;color:#333;background:#fff;outline:none;cursor:pointer}
        .qs-item-right select:focus{border-color:#a78bfa;box-shadow:0 0 0 3px rgba(139,92,246,.1)}
        .qs-preview-btn{width:32px;height:32px;border-radius:9px;border:1px solid #e0e0e4;background:#fff;color:#7c6bd8;font-size:14px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:all .15s;flex-shrink:0}
        .qs-preview-btn:hover{background:#f4f0ff;border-color:#c4b5fd}
        .qs-detect-btn{padding:7px 18px;border-radius:9px;border:1px solid #e0e0e4;background:#fff;color:#555;font-size:13.5px;cursor:pointer;transition:all .15s}
        .qs-detect-btn:hover{background:#f5f5f7;color:#222;border-color:#b8b8c0}
        .qs-grad-btn{width:100%;margin:8px 0 14px;padding:12px;border:none;border-radius:12px;background:linear-gradient(135deg,#8b5cf6,#d946ef);color:#fff;font-size:14.5px;font-weight:600;cursor:pointer;transition:opacity .2s,transform .15s}
        .qs-grad-btn:hover{opacity:.93;transform:translateY(-1px)}
        .qs-grad-btn:active{transform:translateY(0)}
        /* 开关：紫开灰关 + 过渡动画 */
        .qs-toggle{position:relative;width:44px;height:24px;border-radius:14px;border:none;background:#d8d8de;cursor:pointer;transition:background .22s;padding:0;flex-shrink:0}
        .qs-toggle-knob{position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:transform .22s}
        .qs-toggle-on{background:#8b5cf6}
        .qs-toggle-on .qs-toggle-knob{transform:translateX(20px)}
        /* 滑块：紫色填充 + 右侧数值 */
        .qs-slider-wrap{display:flex;align-items:center;gap:10px}
        .qs-slider{-webkit-appearance:none;appearance:none;width:150px;height:6px;border-radius:3px;background:linear-gradient(90deg,#8b5cf6 var(--pct),#e8e6ee var(--pct));outline:none;cursor:pointer;margin:0}
        .qs-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:17px;height:17px;border-radius:50%;background:#8b5cf6;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.22);cursor:pointer}
        .qs-slider::-moz-range-thumb{width:13px;height:13px;border-radius:50%;background:#8b5cf6;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.22);cursor:pointer}
        .qs-slider-num{font-size:13px;color:#333;min-width:38px;text-align:right;font-variant-numeric:tabular-nums}
        /* —— 快捷键页：功能名 + 按键胶囊 + 编辑按钮 —— */
        .qs-row{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:13px 4px;border-bottom:1px solid #f4f4f6}
        .qs-row-name{font-size:14px;color:#333;flex:1;min-width:0}
        .qs-chip{display:inline-flex;align-items:center;gap:4px;background:#f1f1f4;border-radius:8px;padding:5px 12px;font-size:12.5px;color:#555;white-space:nowrap;flex-shrink:0}
        .qs-edit{padding:6px 18px;border:1px solid #e0e0e4;border-radius:8px;background:#fff;color:#555;font-size:13px;cursor:pointer;transition:all .15s;flex-shrink:0}
        .qs-edit:hover{border-color:#c4b5fd;color:#7c3aed;background:#faf7ff}
        /* —— 学习页：默认难度提示行 —— */
        .qs-tips{background:#f7f7f9;border:1px solid #efeff2;border-radius:12px;padding:4px 16px;margin:4px 0 14px}
        .qs-tip{display:flex;align-items:center;gap:10px;padding:9px 0;font-size:13px;color:#555;line-height:1.6}
        .qs-tip-ico{width:24px;height:24px;border-radius:7px;display:inline-flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0}
        .qs-tip-purple{background:#f0eaff;color:#8b5cf6}
        .qs-tip-yellow{background:#fef6e0;color:#d97706}
        .qs-sub-note{font-size:12px;color:#aaa;margin:-2px 0 12px;line-height:1.6}
        /* —— 学习页：词性颜色设置 —— */
        .qs-pos-actions{display:flex;gap:10px;margin:8px 0 14px}
        .qs-pos-act{padding:7px 18px;border-radius:9px;border:none;font-size:13.5px;cursor:pointer;color:#fff;transition:opacity .15s,transform .1s}
        .qs-pos-act:hover{opacity:.88;transform:translateY(-1px)}
        .qs-pos-act:active{transform:translateY(0)}
        .qs-pos-act-blue{background:#3b82f6}
        .qs-pos-act-gray{background:#9ca3af}
        .qs-pos-act-purple{background:#8b5cf6}
        .qs-pos-tabs{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
        .qs-pos-tab{padding:6px 16px;border-radius:99px;border:1px solid #e5e5e9;background:#fff;color:#555;font-size:13px;cursor:pointer;transition:all .15s}
        .qs-pos-tab:hover{border-color:#c4b5fd;color:#7c3aed}
        .qs-pos-tab-on{background:#8b5cf6;border-color:#8b5cf6;color:#fff;font-weight:600}
        .qs-pos-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:4px 0 14px}
        .qs-pos-card{background:#fff;border:1px solid #eef0f3;border-radius:12px;padding:12px 14px 10px;position:relative;box-shadow:0 1px 3px rgba(0,0,0,.04)}
        .qs-pos-name{font-size:13.5px;color:#333;font-weight:500;margin-bottom:10px;padding-right:26px}
        .qs-pos-eye{position:absolute;top:8px;right:8px;background:none;border:none;font-size:15px;cursor:pointer;padding:2px;line-height:1}
        .qs-pos-swatch{display:inline-block;width:16px;height:16px;border-radius:5px;border:1px solid rgba(0,0,0,.08);vertical-align:middle}
        .qs-pos-edit{position:absolute;bottom:9px;right:9px;font-size:13px;cursor:pointer;color:#999;display:inline-flex;align-items:center;line-height:1}
        .qs-pos-edit input{position:absolute;width:1px;height:1px;opacity:0;overflow:hidden;pointer-events:none}
        .qs-pos-edit:hover{color:#333}
        /* —— 听力页：阶段子模块 —— */
        .qs-stage-row{display:flex;align-items:center;gap:8px;padding:2px 2px 16px;border-bottom:1px solid #f4f4f6;margin-bottom:4px}
        .qs-stage-k{font-size:13px;color:#666;margin-left:4px}
        .qs-stage-select{padding:6px 10px;border:1px solid #e0e0e4;border-radius:8px;font-size:13px;color:#333;background:#fff;outline:none;cursor:pointer;min-width:0}
        .qs-stage-select:focus{border-color:#a78bfa;box-shadow:0 0 0 3px rgba(139,92,246,.1)}
        .qs-show-row{display:flex;align-items:center;gap:18px;padding:10px 2px 2px;flex-wrap:wrap}
        .qs-show-item{display:inline-flex;align-items:center;gap:8px;font-size:13.5px;color:#333}
        .qs-stage-hint{font-size:12px;color:#aaa;padding:6px 2px 10px}
        /* —— 口语页：单选卡片组 —— */
        .qs-sel-group{display:flex;flex-direction:column;gap:10px;margin:6px 0 16px}
        .qs-sel-card{display:flex;align-items:center;gap:12px;border:1.5px solid #e5e5e9;border-radius:12px;padding:12px 14px;background:#fff;cursor:pointer;transition:all .15s;position:relative}
        .qs-sel-card:hover{border-color:#c4b5fd}
        .qs-sel-on{border-color:#8b5cf6;background:rgba(139,92,246,.06)}
        .qs-sel-ico{width:38px;height:38px;border-radius:10px;background:#f3f0ff;color:#7c3aed;font-size:14px;font-weight:600;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}
        .qs-sel-body{flex:1}
        .qs-sel-title{font-size:14px;color:#333;font-weight:500;margin-bottom:2px}
        .qs-sel-desc{font-size:12px;color:#aaa}
        .qs-sel-check{width:22px;height:22px;border-radius:50%;background:#8b5cf6;color:#fff;font-size:13px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}
        /* —— 外观页：主题图标 + 背景色块 —— */
        .qs-theme-row{display:flex;gap:8px}
        .qs-theme-ic{width:40px;height:40px;border-radius:10px;border:1.5px solid #e5e5e9;background:#fff;font-size:17px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;filter:grayscale(.4)}
        .qs-theme-ic:hover{border-color:#c4b5fd}
        .qs-theme-on{background:rgba(139,92,246,.1);border-color:#8b5cf6;filter:none}
        .qs-bg-block{margin-top:6px}
        .qs-bg-title{font-size:15px;font-weight:600;color:#333;margin-bottom:4px}
        .qs-bg-sub{font-size:12px;color:#aaa;margin-bottom:14px}
        .qs-bg-row{display:flex;gap:14px;margin-bottom:6px}
        .qs-bg-sq{width:74px;height:52px;border-radius:10px;border:2px solid #e5e5e9;cursor:pointer;transition:all .15s;position:relative}
        .qs-bg-sq:hover{border-color:#c4b5fd}
        .qs-bg-on{border-color:#8b5cf6;box-shadow:0 0 0 3px rgba(139,92,246,.15)}
        .qs-bg-labels{display:flex;gap:14px;margin-bottom:14px}
        .qs-bg-labels span{width:74px;text-align:center;font-size:12px;color:#888}
        .qs-bg-upload{display:inline-flex;align-items:center;gap:8px;padding:9px 18px;border:1.5px solid #e5e5e9;border-radius:10px;background:#fff;font-size:13.5px;color:#444;cursor:pointer;transition:all .15s}
        .qs-bg-upload:hover{border-color:#c4b5fd;color:#7c3aed}
        .qs-bg-note{font-size:12px;color:#aaa;line-height:1.9;margin-top:12px}
        /* —— 其余面板 —— */
        .qs-row{display:flex;align-items:center;padding:11px 4px;border-bottom:1px solid #f2f2f4}
        .qs-row-name{flex:1;font-size:14px;color:#333}
        .qs-chip{background:#f0f0f2;color:#666;border-radius:9px;padding:6px 16px;font-size:13px;font-family:ui-monospace,Consolas,monospace;margin-right:14px;letter-spacing:.3px}
        .qs-edit{background:transparent;border:1px solid #e0e0e4;color:#555;border-radius:9px;padding:6px 18px;cursor:pointer;font-size:13px;transition:all .15s}
        .qs-edit:hover{background:#f5f5f7;color:#222;border-color:#b8b8c0}
        .qs-field{margin-bottom:16px}
        .qs-field-label{display:block;font-size:13px;color:#555;margin-bottom:7px}
        .qs-field select,.qs-field input{width:100%;max-width:320px;padding:9px 12px;border:1px solid #e0e0e4;border-radius:9px;font-size:14px;color:#333;background:#fff;box-sizing:border-box}
        .qs-field select:focus,.qs-field input:focus{outline:none;border-color:#9a8bf0;box-shadow:0 0 0 3px rgba(124,92,252,.12)}
        .qs-hint{font-size:12.5px;color:#999;background:#fafafb;border:1px solid #efeff2;border-radius:10px;padding:12px 14px;line-height:1.7;margin-bottom:16px}
        .qs-btns{display:flex;gap:10px}
        .qs-btn{padding:9px 22px;border-radius:10px;font-size:14px;cursor:pointer;border:1px solid #e0e0e4;background:#fff;color:#555;transition:all .15s}
        .qs-btn:hover{background:#f5f5f7;color:#222;border-color:#b8b8c0}
        .qs-btn-ghost{background:transparent}
        .qs-btn-primary{background:#2b2b31;border-color:#2b2b31;color:#fff;font-weight:500}
        .qs-btn-primary:hover{background:#3a3a42;border-color:#3a3a42;color:#fff}
        .qs-foot{display:flex;justify-content:flex-end;gap:10px;padding:14px 22px;border-top:1px solid #ececef;flex-shrink:0;background:#fff}
        .qs-ph{text-align:center;padding:60px 20px;color:#999}
        .qs-ph-icon{font-size:40px;margin-bottom:14px;opacity:.55}
        .qs-ph-title{font-size:15px;font-weight:600;color:#666;margin-bottom:8px}
        .qs-ph-desc{font-size:13px;color:#aaa}
        .qs-rec-mask{position:absolute;inset:0;background:rgba(240,240,244,.6);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;z-index:5;border-radius:16px}
        .qs-rec{background:#fff;border-radius:14px;box-shadow:0 18px 60px rgba(0,0,0,.2);padding:26px 32px;text-align:center;max-width:420px;width:92%}
        .qs-rec-title{font-size:16px;font-weight:600;color:#222;margin-bottom:10px}
        .qs-rec-desc{font-size:13px;color:#777;line-height:1.7;margin-bottom:16px}
        .qs-rec-box{border:2px dashed #d8d8de;border-radius:12px;padding:26px 16px;font-size:14px;color:#666;margin-bottom:18px;background:#fafafb}
        @media (max-width:720px){
          .qs-mask{padding:10px}
          .qs-panel{max-height:92vh}
          .qs-body{flex-direction:column}
          .qs-side{width:100%;display:flex;overflow-x:auto;border-right:none;border-bottom:1px solid #ececef;padding:8px}
          .qs-menu{flex-shrink:0;margin-bottom:0;margin-right:6px;white-space:nowrap}
          .qs-main{padding:16px 14px}
          .qs-row{flex-wrap:wrap;gap:8px}
          .qs-row-name{flex:1 1 100%}
          .qs-item{flex-wrap:wrap;gap:8px}
          .qs-item-right{margin-left:0;width:100%;justify-content:flex-end}
          .qs-slider{width:110px}
          .qs-pos-grid{grid-template-columns:repeat(2,1fr)}
        }
      `}</style>
    </div>
  )
}
