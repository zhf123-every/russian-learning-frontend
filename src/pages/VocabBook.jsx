// ================= 生词本（手动收藏的单词，只收词不收句子）=================
// 路由：/save/unknown（侧边栏「通关存档 → 生词本」）
// 收录方式：答题页点词卡 → 单词卡「添加到生词本」
// 页眉：筛选 / 导出(9种模板) / 选择 / 开始练习 —— 全部真实交互
// 设计：简约大气有质感 —— 无渐变装饰，细边框 + 柔和阴影 + 单一强调色，跟随全局主题
import { useState, useMemo } from 'react'
import { getVocabWords, removeVocabWord, incrementVocabPractice } from '../lib/vocabBook'
import { speak } from '../lib/tts'
import { toast } from '../lib/toast'

// ---------------- 工具 ----------------
const pad = n => String(n).padStart(2, '0')
const fmtDate = d => { if (!d) return ''; const t = new Date(d); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}` }
const norm = s => String(s || '').replace(/[́̀̆̈]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()

const MODES = [
  { id: 'cn2ru', label: '中译俄', desc: '看中文写出俄语', icon: '✍️' },
  { id: 'dict', label: '听写', desc: '听音频写出俄语', icon: '🎧' },
  { id: 'listen', label: '听力模式', desc: '听音频看答案', icon: '👂' },
  { id: 'speak', label: '口语模式', desc: '看词跟读练习', icon: '🗣️' },
]

// ================= 导出模板（9 套商用级设计系统）=================
// 每套模板有完整的视觉语言：配色体系、字体组合、编号徽章、背景纹理、版面节奏。
// 弹窗预览（TplSample）、PNG 导出（canvas）、PDF 导出（HTML）共用同一份配置。
const TEMPLATES = [
  {
    id: 'whitespace', name: '留白', desc: '杂志式排版 · 极致留白',
    bg: '#ffffff', text: '#111827', sub: '#9aa3b2', accent: '#18181b', line: 'rgba(17,24,39,.10)',
    font: 'sans', numbered: false, badge: 'none', phonetics: 'below', bar: null, pattern: null, glow: false, headerCenter: true, card: 'rgba(249,250,251,.9)',
  },
  {
    id: 'parchment', name: '纸语', desc: '羊皮纸底 · 古典衬线',
    bg: '#f4ecdd', text: '#46362a', sub: '#93816b', accent: '#a1622b', line: 'rgba(70,54,42,.16)',
    font: 'serif', numbered: true, badge: 'line', phonetics: 'below', bar: null, pattern: 'paper', glow: false, headerCenter: true, card: 'rgba(255,255,255,.42)',
  },
  {
    id: 'forest', name: '青藤', desc: '森林渐变 · 自然静谧',
    bgStops: ['#0e2a1c', '#17432e', '#2c6b49'], text: '#eef7f0', sub: '#a9cfb5', accent: '#82d7a0', line: 'rgba(238,247,240,.14)',
    font: 'sans', numbered: true, badge: 'circle', phonetics: 'below', bar: null, pattern: null, glow: true, headerCenter: false, card: 'rgba(255,255,255,.07)',
  },
  {
    id: 'midnight', name: '夜航', desc: '暗夜底色 · 黄色点缀',
    bg: '#0c0d11', text: '#f2f2f4', sub: '#8f93a2', accent: '#facc15', line: 'rgba(242,242,244,.10)',
    font: 'sans', numbered: true, badge: 'square', phonetics: 'below', bar: '#facc15', pattern: null, glow: false, headerCenter: false, card: 'rgba(255,255,255,.045)',
  },
  {
    id: 'aurora', name: '霓光', desc: '蓝紫极光 · 梦幻深邃',
    bgStops: ['#131a3f', '#312e81', '#6d28d9'], text: '#f4f2ff', sub: '#b5afe8', accent: '#a78bfa', line: 'rgba(244,242,255,.14)',
    font: 'sans', numbered: false, badge: 'none', phonetics: 'below', bar: null, pattern: 'glow', glow: true, headerCenter: false, card: 'rgba(255,255,255,.07)',
  },
  {
    id: 'crt', name: '像素', desc: '复古终端 · 扫描线质感',
    bgStops: ['#0a3529', '#0e5a44', '#0d3b2e'], text: '#d8ffec', sub: '#8fe8c8', accent: '#5eead4', line: 'rgba(216,255,236,.13)',
    font: 'mono', numbered: true, badge: 'square', phonetics: 'below', bar: null, pattern: 'scan', glow: true, headerCenter: false, card: 'rgba(0,0,0,.22)',
  },
  {
    id: 'gilded', name: '鎏金', desc: '藏蓝鎏金 · 典藏气质',
    bg: '#1b2431', text: '#f0e3c0', sub: '#b7a678', accent: '#d4af37', line: 'rgba(212,175,55,.28)',
    font: 'serif', numbered: true, badge: 'line', phonetics: 'below', bar: null, pattern: null, glow: false, headerCenter: true, card: 'rgba(212,175,55,.055)',
  },
  {
    id: 'coast', name: '海岸', desc: '海盐蓝调 · 明朗现代',
    bgStops: ['#eef6fc', '#d7eaf8', '#b7d8f2'], text: '#1e3a5f', sub: '#5d7fa3', accent: '#1f6feb', line: 'rgba(30,58,95,.12)',
    font: 'sans', numbered: true, badge: 'circle', phonetics: 'below', bar: null, pattern: null, glow: false, headerCenter: false, card: 'rgba(255,255,255,.55)',
  },
  {
    id: 'dusk', name: '暮色', desc: '柔粉暮光 · 温润优雅',
    bgStops: ['#fdf3f6', '#fbe7ee', '#f6d3e4'], text: '#51283a', sub: '#a8768b', accent: '#db2777', line: 'rgba(81,40,58,.12)',
    font: 'serif', numbered: false, badge: 'none', phonetics: 'below', bar: null, pattern: null, glow: false, headerCenter: true, card: 'rgba(255,255,255,.5)',
  },
]
const tplBg = t => t.bgStops ? `linear-gradient(155deg, ${t.bgStops.join(', ')})` : t.bg
// 背景纹理（叠加在底色之上）
const tplPattern = t => {
  if (t.pattern === 'scan') return 'repeating-linear-gradient(0deg, rgba(255,255,255,.05) 0 2px, transparent 2px 4px)'
  if (t.pattern === 'paper') return 'radial-gradient(circle at 1px 1px, rgba(70,54,42,.07) 1px, transparent 1.5px)'
  if (t.pattern === 'glow') return 'radial-gradient(120% 90% at 85% -10%, rgba(167,139,250,.22), transparent 55%), radial-gradient(100% 80% at 0% 110%, rgba(94,234,212,.14), transparent 50%)'
  return 'none'
}
const tplFont = t => t.font === 'serif' ? '"PT Serif", Georgia, "Songti SC", serif'
  : t.font === 'mono' ? '"Cascadia Mono", "Consolas", "SF Mono", monospace'
  : '"Inter", "Nunito", "PingFang SC", "Microsoft YaHei", sans-serif'
const tplFontName = t => t.font === 'serif' ? 'PT Serif' : t.font === 'mono' ? 'Consolas' : 'Inter'

// 预览示例词条（俄语，用于缩略图/放大预览，展示模板排版效果）
const SAMPLE = [
  { word: 'привет', chinese: '你好', reading: 'приве́т', example: 'Привет, как дела?' },
  { word: 'спасибо', chinese: '谢谢', reading: 'спаси́бо', example: 'Большое спасибо за помощь.' },
  { word: 'любовь', chinese: '爱', reading: 'любо́вь', example: 'Любовь — это чудо.' },
  { word: 'время', chinese: '时间', reading: 'вре́мя', example: 'Время летит быстро.' },
  { word: 'мир', chinese: '世界', reading: 'мир', example: 'Мир прекрасен.' },
]

// 统一按钮样式
const ghost = 'cursor-pointer rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50 dark:border-white/10 dark:bg-transparent dark:text-gray-300 dark:hover:bg-white/5'
const primary = 'cursor-pointer rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700'
// 页眉栏小按钮
const ghostSm = 'cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50 dark:border-white/10 dark:bg-transparent dark:text-gray-300 dark:hover:bg-white/5'
const primarySm = 'cursor-pointer rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-violet-700'

// ---------------- 页面 ----------------
export default function VocabBook() {
  const [list, setList] = useState(() => getVocabWords())
  const [sortBy, setSortBy] = useState('added') // added | alpha | times
  const [sortDir, setSortDir] = useState('desc') // desc | asc
  const [timeRange, setTimeRange] = useState('all') // all | today | 7d | 30d
  const [minTimesOn, setMinTimesOn] = useState(false)
  const [minTimes, setMinTimes] = useState(1)
  const [showFilter, setShowFilter] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState(() => new Set())
  const [showExport, setShowExport] = useState(false)
  const [exportTpl, setExportTpl] = useState('whitespace')
  const [previewTpl, setPreviewTpl] = useState(null) // 放大的模板示例预览
  const [exportFormat, setExportFormat] = useState('image') // image | pdf
  const [exportWithExample, setExportWithExample] = useState(true)
  const [exportCourse, setExportCourse] = useState('all')
  const [exportTime, setExportTime] = useState('all')
  const [showStart, setShowStart] = useState(false)
  const [practice, setPractice] = useState(null)
  const [practiceMode, setPracticeMode] = useState('cn2ru')
  const [practiceOrder, setPracticeOrder] = useState('list')
  const [practiceCount, setPracticeCount] = useState(0)
  const [practiceAll, setPracticeAll] = useState(true)

  const refresh = () => setList(getVocabWords())
  const total = list.length

  const inTimeRange = w => {
    if (timeRange === 'all') return true
    const d = new Date(w.addedAt || 0).getTime()
    const now = Date.now()
    if (timeRange === 'today') return now - d < 86400000
    if (timeRange === '7d') return now - d < 7 * 86400000
    return now - d < 30 * 86400000
  }
  const passesMinTimes = w => !minTimesOn || (w.practiceCount || 0) >= minTimes

  const sorted = useMemo(() => {
    const arr = list.filter(w => inTimeRange(w) && passesMinTimes(w))
    arr.sort((a, b) => {
      if (sortBy === 'alpha') {
        const va = norm(a.word), vb = norm(b.word)
        return sortDir === 'desc' ? vb.localeCompare(va, 'ru') : va.localeCompare(vb, 'ru')
      }
      let va = sortBy === 'times' ? (a.practiceCount || 0) : (a.addedAt || 0)
      let vb = sortBy === 'times' ? (b.practiceCount || 0) : (b.addedAt || 0)
      return sortDir === 'desc' ? vb - va : va - vb
    })
    return arr
  }, [list, sortBy, sortDir, timeRange, minTimesOn, minTimes])

  const courses = useMemo(() => [...new Set(list.map(w => w.course).filter(Boolean))], [list])
  const exportList = useMemo(() => {
    let arr = sorted
    if (exportCourse !== 'all') arr = arr.filter(w => w.course === exportCourse)
    if (exportTime === 'today') arr = arr.filter(w => Date.now() - (w.addedAt || 0) < 86400000)
    if (exportTime === '7d') arr = arr.filter(w => Date.now() - (w.addedAt || 0) < 7 * 86400000)
    if (exportTime === '30d') arr = arr.filter(w => Date.now() - (w.addedAt || 0) < 30 * 86400000)
    return arr
  }, [sorted, exportCourse, exportTime])

  // ---- 选择 ----
  const toggleSelect = key => { const s = new Set(selected); s.has(key) ? s.delete(key) : s.add(key); setSelected(s) }
  const selectAll = () => setSelected(new Set(sorted.map(w => w.key)))
  const clearSelect = () => setSelected(new Set())
  const selectedWords = useMemo(() => sorted.filter(w => selected.has(w.key)), [sorted, selected])
  const exportTarget = selecting && selected.size ? selectedWords : exportList

  // ---- 学会 / 删除 ----
  const markLearned = keys => {
    keys.forEach(k => removeVocabWord(k))
    refresh(); clearSelect(); toast(`已标记学会 ${keys.length} 个单词`)
  }
  const removeMany = keys => {
    if (!window.confirm(`确定删除选中的 ${keys.length} 个生词吗？`)) return
    keys.forEach(k => removeVocabWord(k))
    refresh(); clearSelect()
  }

  // ---- 导出 ----
  const doExport = () => {
    if (!exportTarget.length) { toast('没有可导出的生词'); return }
    const tpl = TEMPLATES.find(t => t.id === exportTpl) || TEMPLATES[0]
    if (exportFormat === 'pdf') exportPDF(exportTarget, tpl, exportWithExample)
    else exportPNG(exportTarget, tpl, exportWithExample)
  }

  // ---- 开始练习 ----
  const startPractice = (words) => {
    if (!words.length) { toast('没有可练习的生词'); return }
    let arr = [...words]
    if (practiceOrder === 'random') arr = arr.sort(() => Math.random() - 0.5)
    if (!practiceAll && practiceCount > 0) arr = arr.slice(0, practiceCount)
    setPractice({ mode: practiceMode, words: arr, i: 0, input: '', result: null, showAns: false, done: false, correct: 0 })
    setShowStart(false); setSelecting(false)
  }

  const p = practice
  const checkAnswer = () => {
    if (!p || p.showAns || !p.input) return
    const cur = p.words[p.i]
    const ok = norm(p.input) === norm(cur.word)
    incrementVocabPractice(cur.key)
    setPractice({ ...p, result: ok ? 'correct' : 'wrong', showAns: true, correct: p.correct + (ok ? 1 : 0) })
    refresh()
  }
  const revealAnswer = () => {
    if (!p || p.showAns) return
    incrementVocabPractice(p.words[p.i].key)
    setPractice({ ...p, showAns: true, result: 'reveal' })
    refresh()
  }
  const practiceNext = () => {
    if (!p) return
    if (p.i + 1 >= p.words.length) setPractice({ ...p, done: true })
    else setPractice({ ...p, i: p.i + 1, input: '', result: null, showAns: false })
  }
  const practicePrev = () => {
    if (!p) return
    setPractice({ ...p, i: Math.max(0, p.i - 1), input: '', result: null, showAns: false })
  }

  // ---- 卡片 ----
  const card = (w) => (
    <div
      key={w.key}
      onClick={() => selecting && toggleSelect(w.key)}
      className={`group rounded-xl border bg-white p-5 shadow-sm transition-all dark:bg-[#151519] ${
        selecting
          ? (selected.has(w.key)
            ? 'cursor-pointer border-violet-500 ring-1 ring-violet-500/40 dark:border-violet-400'
            : 'cursor-pointer border-gray-200 hover:border-violet-300 dark:border-white/10')
          : 'border-gray-200 hover:-translate-y-0.5 hover:shadow-md dark:border-white/10'
      }`}
    >
      <div className="flex items-start gap-4">
        {selecting && (
          <div className={`mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 text-sm text-white transition-colors ${
            selected.has(w.key) ? 'border-violet-600 bg-violet-600' : 'border-gray-300 bg-white dark:border-gray-600 dark:bg-[#1c1c22]'
          }`}>{selected.has(w.key) ? '✓' : ''}</div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <span className="truncate font-['PT_Serif',Georgia,serif] text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{w.word}</span>
            <button
              onClick={e => { e.stopPropagation(); speak(w.word, { rate: 0.8 }) }}
              title="播放发音"
              className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-gray-200 text-sm text-gray-400 transition-colors hover:border-violet-300 hover:text-violet-600 dark:border-white/10 dark:hover:border-violet-500/40 dark:hover:text-violet-400"
            >🔊</button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {w.pos && <span className="rounded bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">{w.pos}</span>}
            {w.chinese && <span className="text-sm text-gray-600 dark:text-gray-300">{w.chinese}</span>}
          </div>
          {w.example && (
            <div className="mt-2.5 border-l-2 border-gray-200 pl-3 dark:border-white/15">
              <span className="font-['PT_Serif',Georgia,serif] text-[13px] text-gray-500 dark:text-gray-400">{w.example}</span>
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400 dark:text-gray-500">
            {(w.course || w.lesson) && <span>{(w.course || '') + (w.course && w.lesson ? ' / ' : '') + (w.lesson || '')}</span>}
            <span>· {fmtDate(w.addedAt)} 添加</span>
            <span>· 练习 {w.practiceCount || 0} 次</span>
          </div>
        </div>
        {!selecting && (
          <button
            onClick={e => { e.stopPropagation(); markLearned([w.key]) }}
            className="shrink-0 cursor-pointer rounded-lg border border-emerald-300 px-3.5 py-1.5 text-xs font-medium text-emerald-600 transition-colors hover:bg-emerald-500 hover:text-white dark:border-emerald-500/40 dark:text-emerald-400 dark:hover:bg-emerald-500 dark:hover:text-white"
          >学会了</button>
        )}
      </div>
    </div>
  )

  // ================= 练习会话 =================
  if (p) {
    const cur = p.words[p.i]
    const promptLabel = MODES.find(m => m.id === p.mode)
    return (
      <div className="mx-auto max-w-xl p-6">
        <div className="mb-5 flex items-center gap-3">
          <button onClick={() => setPractice(null)} className={ghost}>← 返回生词本</button>
          <div className="flex-1" />
          {!p.done && <div className="text-sm font-semibold text-violet-600 dark:text-violet-400">{p.i + 1} / {p.words.length}</div>}
        </div>
        {!p.done && (
          <div className="mb-5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
            <div className="h-full bg-violet-600 transition-all duration-300" style={{ width: `${((p.i + (p.showAns ? 1 : 0)) / p.words.length) * 100}%` }} />
          </div>
        )}

        {p.done ? (
          <div className="rounded-2xl border border-gray-200 bg-white px-8 py-14 text-center shadow-sm dark:border-white/10 dark:bg-[#151519]">
            <div className="text-5xl">🎉</div>
            <h3 className="mt-4 text-xl font-bold text-gray-900 dark:text-white">练习完成！</h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">共练习 {p.words.length} 个生词 · 答对 {p.correct} 个</p>
            <button onClick={() => setPractice(null)} className={`${primary} mt-6 px-8`}>返回生词本</button>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <span>{promptLabel?.icon}</span>
              <span>{promptLabel?.label} · {promptLabel?.desc}</span>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-white/10 dark:bg-[#151519]">
              {p.mode === 'cn2ru' && (
                <div className="min-h-[72px] text-xl font-medium leading-relaxed text-gray-800 dark:text-gray-100">{cur.chinese || cur.word}</div>
              )}
              {p.mode === 'dict' && (
                <div className="min-h-[72px]">
                  <button onClick={() => speak(cur.word, { rate: 0.8 })} className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-full bg-violet-600 text-2xl text-white shadow-md transition-transform hover:scale-105" title="播放发音">▶</button>
                </div>
              )}
              {(p.mode === 'listen' || p.mode === 'speak') && (
                <div className="min-h-[72px]">
                  <div className="font-['PT_Serif',Georgia,serif] text-4xl font-bold text-gray-900 dark:text-white">{cur.word}</div>
                  <button onClick={() => speak(cur.word, { rate: 0.8 })} className={`${ghost} mt-4`}>🔊 播放发音</button>
                </div>
              )}

              {(p.mode === 'cn2ru' || p.mode === 'dict') && (
                <div className="mt-6">
                  <input
                    value={p.input}
                    onChange={e => setPractice({ ...p, input: e.target.value })}
                    onKeyDown={e => { if (e.key === 'Enter') { p.showAns ? practiceNext() : checkAnswer() } }}
                    autoFocus
                    placeholder="输入俄语…"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-center text-lg text-gray-900 outline-none transition-colors focus:border-violet-400 focus:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white"
                  />
                </div>
              )}

              {p.showAns ? (
                <div className="mt-5">
                  <div className={`text-base font-semibold ${p.result === 'correct' ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {p.result === 'correct' ? '✓ 答对了！' : p.result === 'wrong' ? '✗ 再想想' : ''}
                  </div>
                  <div className="mt-2">
                    <span className="font-['PT_Serif',Georgia,serif] text-lg font-bold text-gray-900 dark:text-white">{cur.word}</span>
                    <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">{cur.chinese}</span>
                  </div>
                </div>
              ) : (p.mode === 'listen' || p.mode === 'speak') && (
                <button onClick={revealAnswer} className={`${ghost} mt-6`}>显示答案</button>
              )}

              <div className="mt-6 flex items-center justify-center gap-3">
                {p.showAns ? (
                  <button onClick={practiceNext} className={`${primary} px-10`}>{p.i + 1 >= p.words.length ? '完成 ✓' : '下一个 →'}</button>
                ) : (p.mode === 'cn2ru' || p.mode === 'dict') && (
                  <>
                    <button onClick={checkAnswer} disabled={!p.input.trim()} className={`${primary} px-8 disabled:cursor-not-allowed disabled:opacity-40`}>检查</button>
                    <button onClick={revealAnswer} className={ghost}>直接看答案</button>
                  </>
                )}
              </div>
            </div>
            {p.i > 0 && (
              <div className="mt-4 text-center">
                <button onClick={practicePrev} className="cursor-pointer text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">← 上一个</button>
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  // ================= 主页面 =================
  return (
    <div className="mx-auto max-w-5xl p-6">
      {/* 页眉栏：标题 + 副标题 + 功能按钮同行（筛选/导出/选择/开始练习都在页眉上） */}
      <div className="mb-6 border-b border-gray-200 pb-5 dark:border-white/10">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">生词本</h1>
          <span className="text-xs text-gray-400 dark:text-gray-500">共 {total} 个生词</span>
          {!selecting ? (
            <>
              <div className="flex-1" />
              <button onClick={() => setShowFilter(true)} className={ghostSm}>筛选</button>
              <button onClick={() => { setExportCourse('all'); setExportTime('all'); setShowExport(true) }} className={ghostSm}>导出</button>
              <button onClick={() => setSelecting(true)} className={ghostSm}>选择</button>
              <button onClick={() => setShowStart(true)} className={primarySm}>开始练习</button>
            </>
          ) : (
            <>
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">管理生词</span>
              <button onClick={selectAll} className="cursor-pointer text-xs font-medium text-violet-600 hover:underline dark:text-violet-400">全选</button>
              <button onClick={clearSelect} className="cursor-pointer text-xs font-medium text-gray-500 hover:underline dark:text-gray-400">取消</button>
              <div className="flex-1" />
              <span className="text-xs text-gray-400 dark:text-gray-500">已选择 {selected.size} 个</span>
            </>
          )}
        </div>
      </div>

      {/* 空态 */}
      {total === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-gray-200 bg-white py-24 text-center dark:border-white/15 dark:bg-[#151519]">
          <div className="text-5xl">📒</div>
          <h3 className="mt-5 text-lg font-bold text-gray-900 dark:text-white">生词本还是空的</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-gray-400 dark:text-gray-500">
            在答题页点击句子里的单词，弹出单词卡后点「添加到生词本」，即可收录到这里
          </p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-gray-200 bg-white py-20 text-center dark:border-white/15 dark:bg-[#151519]">
          <div className="text-4xl">🔍</div>
          <p className="mt-4 text-sm text-gray-400 dark:text-gray-500">当前筛选条件下没有生词</p>
          <button onClick={() => { setSortBy('added'); setSortDir('desc'); setTimeRange('all'); setMinTimesOn(false) }} className={`${ghost} mt-4 text-violet-600`}>重置筛选</button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">{sorted.map(card)}</div>
      )}

      {/* 选择底栏 */}
      {selecting && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-[#0d0d11]/90">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2.5">
            <span className="text-sm text-gray-500 dark:text-gray-400">已选择 <b className="text-violet-600 dark:text-violet-400">{selected.size}</b> 个单词 / 共 {sorted.length} 条</span>
            <div className="flex-1" />
            <button onClick={() => removeMany([...selected])} className="cursor-pointer rounded-lg border border-rose-200 px-4 py-2 text-sm font-medium text-rose-500 transition-colors hover:bg-rose-50 dark:border-rose-500/30 dark:hover:bg-rose-500/10">删除</button>
            <button onClick={() => setShowExport(true)} className={ghost}>导出</button>
            <button onClick={() => markLearned([...selected])} className="cursor-pointer rounded-lg border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-600 transition-colors hover:bg-emerald-50 dark:border-emerald-500/30 dark:text-emerald-400 dark:hover:bg-emerald-500/10">标记为学会</button>
            <button onClick={() => startPractice(selectedWords)} className={primary}>练习所选({selected.size})</button>
          </div>
        </div>
      )}

      {/* ============ 筛选弹窗 ============ */}
      {showFilter && (
        <Modal title="筛选条件" onClose={() => setShowFilter(false)}>
          <div className="mb-2 text-xs font-medium text-gray-400">排序方式</div>
          <div className="grid grid-cols-3 gap-2">
            {[['added', '最新添加'], ['alpha', '字母顺序'], ['times', '练习次数']].map(([k, label]) => (
              <button key={k} onClick={() => setSortBy(k)} className={optBtn(sortBy === k)}>{label}</button>
            ))}
          </div>
          <div className="mb-2 mt-5 text-xs font-medium text-gray-400">排序顺序</div>
          <div className="grid grid-cols-2 gap-2">
            {[['desc', '降序'], ['asc', '升序']].map(([k, label]) => (
              <button key={k} onClick={() => setSortDir(k)} className={optBtn(sortDir === k)}>{label}</button>
            ))}
          </div>
          <div className="mb-2 mt-5 text-xs font-medium text-gray-400">添加时间</div>
          <div className="grid grid-cols-4 gap-2">
            {[['all', '全部时间'], ['today', '今天'], ['7d', '7天内'], ['30d', '一个月内']].map(([k, label]) => (
              <button key={k} onClick={() => setTimeRange(k)} className={optBtn(timeRange === k)}>{label}</button>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 dark:border-white/10">
            <div>
              <div className="text-sm font-medium text-gray-800 dark:text-gray-100">练习次数筛选</div>
              <div className="text-xs text-gray-400">启用基于练习次数的筛选</div>
            </div>
            <div className="flex items-center gap-2">
              {minTimesOn && (
                <input type="number" min={1} max={99} value={minTimes} onChange={e => setMinTimes(Math.max(1, parseInt(e.target.value || '1', 10)))}
                  className="w-16 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-center text-sm outline-none focus:border-violet-400 dark:border-white/10 dark:bg-white/5 dark:text-white" />
              )}
              <Toggle on={minTimesOn} onChange={() => setMinTimesOn(!minTimesOn)} />
            </div>
          </div>
          <div className="mt-6 flex gap-3">
            <button onClick={() => { setSortBy('added'); setSortDir('desc'); setTimeRange('all'); setMinTimesOn(false); setMinTimes(1) }} className={`${ghost} flex-1`}>重置</button>
            <button onClick={() => setShowFilter(false)} className={`${primary} flex-1`}>完成</button>
          </div>
        </Modal>
      )}

      {/* ============ 导出弹窗 ============ */}
      {showExport && (
        <Modal title="导出生词本" onClose={() => setShowExport(false)} wide>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <div className="mb-2 text-xs font-medium text-gray-400">课程包</div>
              <select value={exportCourse} onChange={e => setExportCourse(e.target.value)}
                className="w-full cursor-pointer rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-violet-400 dark:border-white/10 dark:bg-white/5 dark:text-gray-200">
                <option value="all">全部课程包</option>
                {courses.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <div className="mb-2 text-xs font-medium text-gray-400">时间范围</div>
              <select value={exportTime} onChange={e => setExportTime(e.target.value)}
                className="w-full cursor-pointer rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-violet-400 dark:border-white/10 dark:bg-white/5 dark:text-gray-200">
                <option value="all">全部</option>
                <option value="today">今天添加</option>
                <option value="7d">7天内添加</option>
                <option value="30d">一个月内添加</option>
              </select>
            </div>
          </div>
          <div className="mt-3 rounded-lg border border-violet-100 bg-violet-50/60 px-4 py-2.5 text-sm text-violet-600 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300">
            {selecting && selected.size ? `已选择 ${selected.size} 个生词将被导出` : `共 ${exportList.length} 个生词将被导出`}
          </div>

          <div className="mb-2 mt-5 text-xs font-medium text-gray-400">选择模板</div>
          <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto pr-1">
            {TEMPLATES.map(t => (
              <button key={t.id} onClick={() => setExportTpl(t.id)}
                className={`cursor-pointer rounded-xl border p-2.5 text-left transition-all ${exportTpl === t.id ? 'border-violet-500 ring-1 ring-violet-500/25 dark:border-violet-400' : 'border-gray-200 hover:border-gray-300 dark:border-white/10'}`}>
                {/* 示例缩略图：点击放大预览 */}
                <div className="group/thumb relative cursor-zoom-in overflow-hidden rounded-lg" onClick={e => { e.stopPropagation(); setPreviewTpl(t) }}>
                  <TplSample t={t} words={SAMPLE.slice(0, 2)} showHeader={false} compact />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover/thumb:bg-black/30 group-hover/thumb:opacity-100">
                    <span className="rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-medium text-gray-700">🔍 放大预览</span>
                  </div>
                </div>
                <div className="mt-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200">{t.name}</div>
                <div className="text-[11px] leading-tight text-gray-400">{t.desc}</div>
              </button>
            ))}
          </div>

          {/* 模板效果预览（点击可放大） */}
          <div className="mb-2 mt-4 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">模板效果预览</span>
            <button onClick={() => setPreviewTpl(TEMPLATES.find(t => t.id === exportTpl))} className="cursor-pointer text-[11px] font-medium text-violet-600 hover:underline dark:text-violet-400">🔍 放大预览</button>
          </div>
          <div className="cursor-zoom-in overflow-hidden rounded-xl shadow-sm" style={{ background: tplBg(TEMPLATES.find(t => t.id === exportTpl)) }}
            onClick={() => setPreviewTpl(TEMPLATES.find(t => t.id === exportTpl))}>
            <TplSample t={TEMPLATES.find(t => t.id === exportTpl)} words={SAMPLE.slice(0, 3)} />
          </div>

          <div className="mb-2 mt-5 text-xs font-medium text-gray-400">导出格式</div>
          <div className="grid grid-cols-2 gap-2">
            {[['image', '🖼 图片 (PNG)'], ['pdf', '📄 PDF']].map(([k, label]) => (
              <button key={k} onClick={() => setExportFormat(k)} className={optBtn(exportFormat === k)}>{label}</button>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 dark:border-white/10">
            <div>
              <div className="text-sm font-medium text-gray-800 dark:text-gray-100">附上例句</div>
              <div className="text-xs text-gray-400">在生词下方标注收录时所在的句子</div>
            </div>
            <Toggle on={exportWithExample} onChange={() => setExportWithExample(!exportWithExample)} />
          </div>

          <div className="mt-6 flex gap-3">
            <button onClick={() => setShowExport(false)} className={`${ghost} flex-1`}>关闭</button>
            <button onClick={doExport} className={`${primary} flex-1`}>导出{exportFormat === 'image' ? '图片' : 'PDF'}</button>
          </div>
        </Modal>
      )}

      {/* ============ 模板放大预览 ============ */}
      {previewTpl && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" style={{ animation: 'vb-fadeIn .18s ease' }} onClick={() => setPreviewTpl(null)}>
          <div onClick={e => e.stopPropagation()} className="w-[540px] max-w-[94vw] rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[#151519] dark:shadow-[0_16px_50px_rgba(0,0,0,.5)]" style={{ animation: 'vb-popIn .22s ease' }}>
            <div className="mb-3 flex items-center gap-2">
              <span className="text-base font-bold text-gray-900 dark:text-white">{previewTpl.name}</span>
              <span className="text-xs text-gray-400">{previewTpl.desc}</span>
              <div className="flex-1" />
              <button onClick={() => setPreviewTpl(null)} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-base text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-500 dark:hover:bg-white/10">×</button>
            </div>
            <div className="overflow-hidden rounded-xl shadow-md">
              <TplSample t={previewTpl} words={SAMPLE} showFooter />
            </div>
            <p className="mt-3 text-center text-[11px] text-gray-400 dark:text-gray-500">示例预览 · 点击空白处关闭</p>
          </div>
        </div>
      )}

      {/* ============ 开始练习弹窗 ============ */}
      {showStart && (
        <Modal title="开始练习" onClose={() => setShowStart(false)}>
          <div className="mb-2 text-xs font-medium text-gray-400">练习模式</div>
          <div className="grid grid-cols-2 gap-2">
            {MODES.map(m => (
              <button key={m.id} onClick={() => setPracticeMode(m.id)} className={`cursor-pointer rounded-xl border p-3 text-left transition-all ${
                practiceMode === m.id ? 'border-violet-500 bg-violet-50/60 dark:border-violet-400 dark:bg-violet-500/10' : 'border-gray-200 hover:border-gray-300 dark:border-white/10'
              }`}>
                <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">{m.icon} {m.label}</div>
                <div className="mt-0.5 text-xs text-gray-400">{m.desc}</div>
              </button>
            ))}
          </div>
          <div className="mb-2 mt-5 text-xs font-medium text-gray-400">练习顺序</div>
          <div className="grid grid-cols-2 gap-2">
            {[['list', '按列表顺序'], ['random', '随机顺序']].map(([k, label]) => (
              <button key={k} onClick={() => setPracticeOrder(k)} className={optBtn(practiceOrder === k)}>{label}</button>
            ))}
          </div>
          <div className="mb-2 mt-5 text-xs font-medium text-gray-400">练习数量</div>
          <div className="flex items-center gap-3">
            <div className="flex items-center overflow-hidden rounded-lg border border-gray-200 dark:border-white/10">
              <button onClick={() => { setPracticeAll(false); setPracticeCount(c => Math.max(0, c - 1)) }} className="h-10 w-10 cursor-pointer text-lg text-gray-500 transition-colors hover:bg-gray-50 dark:hover:bg-white/5">−</button>
              <input type="number" min={0} max={total} value={practiceCount} onChange={e => { setPracticeAll(false); setPracticeCount(Math.max(0, parseInt(e.target.value || '0', 10))) }}
                className="h-10 w-16 border-x border-gray-200 bg-gray-50 text-center text-sm outline-none dark:border-white/10 dark:bg-white/5 dark:text-white" />
              <button onClick={() => { setPracticeAll(false); setPracticeCount(c => Math.min(total, c + 1)) }} className="h-10 w-10 cursor-pointer text-lg text-gray-500 transition-colors hover:bg-gray-50 dark:hover:bg-white/5">＋</button>
            </div>
            <span className="text-xs text-gray-400">最多 {total} 个</span>
            <div className="flex-1" />
            <button onClick={() => { setPracticeAll(true); setPracticeCount(total) }} className={optBtn(practiceAll)}>全部</button>
          </div>
          <button onClick={() => startPractice(sorted)} className={`${primary} mt-6 w-full py-3`}>
            开始练习{total ? `（${practiceAll ? total : Math.min(practiceCount || 1, total)} 个）` : ''}
          </button>
        </Modal>
      )}
    </div>
  )
}

// 选项按钮（简约）
const optBtn = active => `cursor-pointer rounded-lg border px-3 py-2.5 text-sm transition-colors ${
  active ? 'border-violet-500 bg-violet-50/60 text-violet-600 dark:border-violet-400 dark:bg-violet-500/10 dark:text-violet-300' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-white/10 dark:bg-transparent dark:text-gray-300'
}`

// 开关
function Toggle({ on, onChange }) {
  return (
    <button onClick={onChange} className={`relative h-6 w-11 cursor-pointer rounded-full transition-colors ${on ? 'bg-violet-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )
}

// ---------------- 模板示例渲染（弹窗预览 / 放大预览共用，HTML 质感版）----------------
// 与 exportPNG / exportPDF 共用同一套 TEMPLATES 配置，保证「所见即所得」
function TplSample({ t, words = SAMPLE, compact = false, showHeader = true, showFooter = false }) {
  const pad = compact ? 8 : 16
  const headPad = compact ? 8 : 14
  return (
    <div className="relative w-full overflow-hidden" style={{ background: tplBg(t), borderRadius: 10 }}>
      {/* 纹理层 */}
      <div className="pointer-events-none absolute inset-0" style={{ background: tplPattern(t) }} />
      <div className="relative" style={{ padding: `${headPad}px ${pad}px ${pad}px` }}>
        {/* 页眉 */}
        {showHeader && (
          <>
            <div className="flex items-baseline justify-between" style={{ marginBottom: compact ? 6 : 10 }}>
              <span className="font-bold tracking-wide" style={{ color: t.text, fontSize: compact ? 11 : 15 }}>生词本</span>
              <span style={{ color: t.sub, fontSize: compact ? 8 : 10 }}>JULEBU · {words.length} 词条</span>
            </div>
            {/* 装饰线 */}
            <div style={{ height: 2, background: `linear-gradient(90deg, ${t.accent}, transparent)`, borderRadius: 99, marginBottom: compact ? 8 : 12, opacity: .85 }} />
          </>
        )}

        {words.map((w, i) => {
          const last = i === words.length - 1
          return (
            <div key={i} style={{ borderBottom: !last ? `1px solid ${t.line}` : 'none', padding: `${compact ? 5 : 8}px 0`, borderLeft: t.bar ? `3px solid ${t.bar}` : 'none', paddingLeft: t.bar ? (compact ? 6 : 10) : 0 }}>
              <div className="flex items-baseline gap-2">
                {t.numbered && (
                  t.badge === 'circle' ? (
                    <span className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white" style={{ background: t.accent, width: compact ? 15 : 20, height: compact ? 15 : 20, fontSize: compact ? 8 : 10 }}>{i + 1}</span>
                  ) : t.badge === 'square' ? (
                    <span className="flex shrink-0 items-center justify-center font-semibold" style={{ color: t.accent, border: `1px solid ${t.accent}`, borderRadius: 3, width: compact ? 15 : 20, height: compact ? 15 : 20, fontSize: compact ? 8 : 10 }}>{i + 1}</span>
                  ) : (
                    <span className="shrink-0 font-semibold" style={{ color: t.accent, fontSize: compact ? 8 : 11, letterSpacing: .5 }}>{String(i + 1).padStart(2, '0')}</span>
                  )
                )}
                <span className="truncate font-bold" style={{ color: t.text, fontSize: compact ? 12 : 17, fontFamily: tplFont(t), letterSpacing: t.font === 'mono' ? -.3 : 0 }}>{w.word}</span>
                <span className="ml-auto shrink-0" style={{ color: t.sub, fontSize: compact ? 8 : 12 }}>{w.chinese}</span>
              </div>
              {t.phonetics !== 'none' && w.reading && (
                <div className="mt-0.5" style={{ color: t.sub, fontSize: compact ? 7 : 10, fontStyle: 'italic', letterSpacing: .4, opacity: .9 }}>{w.reading}</div>
              )}
              {w.example && (
                <div className="mt-0.5 truncate" style={{ color: t.sub, fontSize: compact ? 7 : 10, fontStyle: 'italic', opacity: .75 }}>{w.example}</div>
              )}
            </div>
          )
        })}

        {showFooter && (
          <div className="mt-2 flex items-center justify-between border-t pt-2" style={{ borderColor: t.line }}>
            <span style={{ color: t.sub, fontSize: 9, letterSpacing: 2 }}>© JULEBU 生词本</span>
            <span style={{ color: t.sub, fontSize: 9 }}>{fmtDate(Date.now())}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------- 弹窗骨架 ----------------
function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" style={{ animation: 'vb-fadeIn .18s ease' }} onClick={onClose}>
      <style>{`
        @keyframes vb-fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes vb-popIn { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
      <div onClick={e => e.stopPropagation()} className={`${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[86vh] w-full overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-[0_16px_50px_rgba(15,23,42,.16)] dark:border-white/10 dark:bg-[#151519] dark:shadow-[0_16px_50px_rgba(0,0,0,.5)]`} style={{ animation: 'vb-popIn .22s ease' }}>
        <div className="mb-5 flex items-center">
          <h3 className="text-base font-bold text-gray-900 dark:text-white">{title}</h3>
          <div className="flex-1" />
          <button onClick={onClose} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-base text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-500 dark:hover:bg-white/10">×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ---------------- 导出实现 ----------------
// PNG（canvas）与 PDF（HTML）按同一套 TEMPLATES 配置渲染，与弹窗预览「所见即所得」

function exportPNG(words, tpl, withExample) {
  const W = 900
  const headerH = 150
  const rowBase = 104
  const rowH = rowBase + (tpl.phonetics !== 'none' && words.some(w => w.reading) ? 30 : 0) + (withExample && words.some(w => w.example) ? 32 : 0)
  const footerH = 76
  const H = headerH + words.length * rowH + footerH
  const cv = document.createElement('canvas')
  cv.width = W; cv.height = H
  const ctx = cv.getContext('2d')

  // ---- 背景（渐变 / 纯色）----
  if (tpl.bgStops) {
    const g = ctx.createLinearGradient(0, 0, 0, H)
    tpl.bgStops.forEach((c, i) => g.addColorStop(i / (tpl.bgStops.length - 1), c))
    ctx.fillStyle = g
  } else { ctx.fillStyle = tpl.bg }
  ctx.fillRect(0, 0, W, H)

  // ---- 纹理 ----
  if (tpl.pattern === 'scan') {
    ctx.fillStyle = 'rgba(255,255,255,.05)'
    for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1.5)
  } else if (tpl.pattern === 'paper') {
    ctx.fillStyle = 'rgba(70,54,42,.06)'
    for (let y = 8; y < H; y += 16) for (let x = 8; x < W; x += 16) { ctx.beginPath(); ctx.arc(x, y, 1, 0, 7); ctx.fill() }
  } else if (tpl.pattern === 'glow') {
    let g = ctx.createRadialGradient(W * .85, -40, 0, W * .85, -40, 420)
    g.addColorStop(0, 'rgba(167,139,250,.28)'); g.addColorStop(1, 'rgba(167,139,250,0)')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
    g = ctx.createRadialGradient(0, H + 60, 0, 0, H + 60, 460)
    g.addColorStop(0, 'rgba(94,234,212,.20)'); g.addColorStop(1, 'rgba(94,234,212,0)')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  }

  // ---- 页眉 ----
  const fontOf = (px, weight = 400, italic = false) => `${italic ? 'italic ' : ''}${weight} ${px}px ${tplFont(t)}`
  ctx.textAlign = 'left'
  ctx.fillStyle = tpl.text
  ctx.font = fontOf(36, 700)
  ctx.fillText('生词本', 56, 66)
  // 徽标胶囊
  ctx.font = fontOf(11, 600)
  const badgeW = ctx.measureText('JULEBU').width + 24
  ctx.fillStyle = tpl.accent
  roundRect(ctx, 56, 82, badgeW, 24, 12); ctx.fill()
  ctx.fillStyle = tpl.bg ? (tpl.bg !== '#ffffff' ? '#fff' : tpl.text) : '#fff'
  ctx.fillText('JULEBU', 56 + 12, 98)
  // 右侧：词数 · 日期
  ctx.textAlign = 'right'
  ctx.fillStyle = tpl.sub
  ctx.font = fontOf(14)
  ctx.fillText(`${words.length} 个生词 · ${fmtDate(Date.now())}`, W - 56, 100)
  ctx.textAlign = 'left'
  // 装饰渐变线
  const lg = ctx.createLinearGradient(56, 0, 300, 0)
  lg.addColorStop(0, tpl.accent); lg.addColorStop(1, 'transparent')
  ctx.fillStyle = lg
  ctx.fillRect(56, 120, 244, 3)

  // ---- 词条 ----
  words.forEach((w, i) => {
    const y = headerH + i * rowH + 10
    const hasRead = tpl.phonetics !== 'none' && w.reading
    const hasEx = withExample && w.example
    const padX = 26
    const r = 16
    // 卡片
    ctx.fillStyle = tpl.card
    if (tpl.glow) {
      ctx.shadowColor = tpl.accent; ctx.shadowBlur = 14; ctx.shadowOffsetY = 0
    }
    roundRect(ctx, padX, y, W - padX * 2, rowH - 20, r); ctx.fill()
    ctx.shadowBlur = 0
    // bar 竖条（夜航）
    if (tpl.bar) {
      ctx.fillStyle = tpl.bar
      roundRect(ctx, padX + 10, y + 16, 4, rowH - 52, 2); ctx.fill()
    }
    const x0 = padX + (tpl.bar ? 30 : 16)
    // 编号徽章
    let wordX = x0
    if (tpl.numbered) {
      const bs = 30
      if (tpl.badge === 'circle') {
        ctx.fillStyle = tpl.accent
        ctx.beginPath(); ctx.arc(x0 + bs / 2, y + 34, bs / 2, 0, 7); ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.font = fontOf(13, 700)
        ctx.textAlign = 'center'; ctx.fillText(String(i + 1), x0 + bs / 2, y + 39); ctx.textAlign = 'left'
      } else if (tpl.badge === 'square') {
        ctx.strokeStyle = tpl.accent; ctx.lineWidth = 1.5
        roundRect(ctx, x0, y + 19, bs, bs, 5); ctx.stroke()
        ctx.fillStyle = tpl.accent
        ctx.font = fontOf(13, 700)
        ctx.textAlign = 'center'; ctx.fillText(String(i + 1), x0 + bs / 2, y + 39); ctx.textAlign = 'left'
      } else {
        ctx.fillStyle = tpl.accent
        ctx.font = fontOf(12, 600)
        ctx.fillText(String(i + 1).padStart(2, '0'), x0, y + 40)
      }
      wordX = x0 + (tpl.badge === 'none' ? 34 : 44)
    }
    // 单词
    ctx.fillStyle = tpl.text
    ctx.font = fontOf(29, 700)
    ctx.fillText(w.word, wordX, y + 40)
    // pos
    if (w.pos) {
      const ww = ctx.measureText(w.word).width
      ctx.fillStyle = tpl.accent
      ctx.font = fontOf(12, 600)
      ctx.fillText(w.pos, wordX + ww + 12, y + 40)
    }
    // 中文（右对齐）
    ctx.fillStyle = tpl.sub
    ctx.font = fontOf(16, 500)
    ctx.textAlign = 'right'
    ctx.fillText(w.chinese || '', W - padX - 18, y + 40)
    ctx.textAlign = 'left'
    // 音标行
    let exY = y + 40
    if (hasRead) {
      ctx.fillStyle = tpl.sub
      ctx.font = fontOf(14, 400, true)
      ctx.fillText(w.reading, wordX, y + 66)
      exY = y + 66
    }
    // 例句行
    if (hasEx) {
      ctx.fillStyle = tpl.sub
      ctx.globalAlpha = .8
      ctx.font = fontOf(13, 400, true)
      ctx.fillText('「' + w.example + '」', wordX, exY + 28)
      ctx.globalAlpha = 1
    }
  })

  // ---- 页脚 ----
  ctx.strokeStyle = tpl.line
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(56, H - footerH + 18); ctx.lineTo(W - 56, H - footerH + 18); ctx.stroke()
  ctx.fillStyle = tpl.sub
  ctx.font = fontOf(12)
  ctx.fillText('© JULEBU · 生词本', 56, H - footerH + 46)
  ctx.textAlign = 'right'
  ctx.fillText(`${words.length} 个词条 · ${fmtDate(Date.now())}`, W - 56, H - footerH + 46)
  ctx.textAlign = 'left'

  const a = document.createElement('a')
  a.href = cv.toDataURL('image/png')
  a.download = `生词本-${tpl.name}-${Date.now()}.png`
  a.click()
  toast(`已导出图片（${words.length} 个生词，模板「${tpl.name}」）`)
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function exportPDF(words, tpl, withExample) {
  const t = tpl
  const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const rows = words.map((w, i) => {
    const hasRead = t.phonetics !== 'none' && w.reading
    const hasEx = withExample && w.example
    const badge = t.numbered
      ? t.badge === 'circle'
        ? `<span class="badge circle">${i + 1}</span>`
        : t.badge === 'square'
          ? `<span class="badge square">${i + 1}</span>`
          : `<span class="badge line">${String(i + 1).padStart(2, '0')}</span>`
      : ''
    return `
    <div class="row">
      <div class="row-inner">
        ${badge}
        <div class="main">
          <div class="line1">
            <span class="word">${esc(w.word)}</span>
            ${w.pos ? `<span class="pos">${esc(w.pos)}</span>` : ''}
            <span class="cn">${esc(w.chinese || '')}</span>
          </div>
          ${hasRead ? `<div class="read">${esc(w.reading)}</div>` : ''}
          ${hasEx ? `<div class="ex">「${esc(w.example)}」</div>` : ''}
        </div>
      </div>
    </div>`
  }).join('')

  const patternCss = t.pattern === 'scan'
    ? 'background-image:repeating-linear-gradient(0deg, rgba(255,255,255,.05) 0 2px, transparent 2px 4px);'
    : t.pattern === 'paper'
      ? 'background-image:radial-gradient(circle at 1px 1px, rgba(70,54,42,.07) 1px, transparent 1.5px);background-size:16px 16px;'
      : t.pattern === 'glow'
        ? 'background-image:radial-gradient(120% 90% at 85% -10%, rgba(167,139,250,.22), transparent 55%), radial-gradient(100% 80% at 0% 110%, rgba(94,234,212,.14), transparent 50%);'
        : ''

  const win = window.open('', '_blank')
  win.document.write(`<!doctype html><html><head><title>生词本导出 · ${t.name}</title><style>
    @page { margin: 14mm; }
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:${t.bgStops ? `linear-gradient(155deg,${t.bgStops.join(',')}) fixed` : t.bg}; color:${t.text}; font-family:${tplFont(t)}; padding:36px 44px; ${patternCss} }
    .wrap { max-width:820px; margin:0 auto; }
    .head { display:flex; align-items:flex-end; justify-content:space-between; margin-bottom:10px; }
    .title { font-size:32px; font-weight:700; letter-spacing:.5px; }
    .badge-top { display:inline-block; padding:2px 10px; border-radius:99px; background:${t.accent}; color:#fff; font-size:10px; font-weight:600; letter-spacing:1.5px; vertical-align:5px; margin-left:10px; }
    .meta { font-size:13px; opacity:.68; }
    .rule { height:3px; border-radius:99px; background:linear-gradient(90deg, ${t.accent}, transparent); margin-bottom:26px; }
    .row { border-bottom:1px solid ${t.line}; padding:14px 2px; }
    .row:last-child { border-bottom:none; }
    .row-inner { display:flex; align-items:flex-start; gap:14px; border-left:${t.bar ? `3px solid ${t.bar}` : 'none'}; padding-left:${t.bar ? '14px' : '0'}; }
    .badge.circle { flex-shrink:0; width:26px; height:26px; border-radius:50%; background:${t.accent}; color:#fff; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; margin-top:4px; }
    .badge.square { flex-shrink:0; width:24px; height:24px; border-radius:5px; border:1.5px solid ${t.accent}; color:${t.accent}; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; margin-top:5px; }
    .badge.line { flex-shrink:0; color:${t.accent}; font-size:12px; font-weight:700; letter-spacing:1px; margin-top:8px; }
    .main { flex:1; min-width:0; }
    .line1 { display:flex; align-items:baseline; gap:12px; }
    .word { font-size:24px; font-weight:700; letter-spacing:.2px; }
    .pos { font-size:11px; font-weight:600; color:${t.accent}; }
    .cn { flex:1; text-align:right; font-size:14px; opacity:.75; }
    .read { margin-top:4px; font-size:12px; font-style:italic; letter-spacing:.4px; opacity:.8; }
    .ex { margin-top:3px; font-size:12px; font-style:italic; opacity:.62; }
    .foot { margin-top:22px; padding-top:12px; border-top:1px solid ${t.line}; display:flex; justify-content:space-between; font-size:11px; letter-spacing:1.5px; opacity:.65; }
    @media print { body { padding:0; } }
  </style></head><body>
    <div class="wrap">
      <div class="head">
        <span class="title">生词本<span class="badge-top">JULEBU</span></span>
        <span class="meta">共 ${words.length} 个生词 · ${fmtDate(Date.now())}</span>
      </div>
      <div class="rule"></div>
      ${rows}
      <div class="foot">
        <span>© JULEBU · 生词本</span>
        <span>${words.length} 个词条 · ${fmtDate(Date.now())}</span>
      </div>
    </div>
  </body></html>`)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print() }, 400)
  toast('已打开 PDF 打印窗口（选择"另存为 PDF"即可）')
}
