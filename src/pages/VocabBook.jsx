// ================= 生词本（只收录单词，不收录句子）=================
// 路由：/vocab-book（侧边栏「通关存档 → 生词本」）
// 数据源：rlearn_vocab_book（答题页点词弹窗「添加到生词本」收录）
// 页眉：筛选 / 导出(9种模板) / 选择 / 开始练习 —— 全部真实交互
// 设计：跟随全局主题（白天/深夜自动切换），质感来自渐变点缀、层次阴影、微动效与排版
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
const MODE_KEYS = MODES.map(m => m.id)

// 导出模板（9 种）：预览卡与 PNG/PDF 导出共用同一份配置
const TEMPLATES = [
  { id: 'simple', name: '简洁', desc: '简约白底，适合打印', bg: '#ffffff', text: '#111827', sub: '#6b7280', accent: '#7c3aed', serif: false, bgStops: null, cardBg: '#f3f4f6' },
  { id: 'mist', name: '林间雾语', desc: '森林背景，优雅衬线', bg: null, bgStops: ['#0f3d2e', '#1a5c45', '#2e8b57'], text: '#f0fdf4', sub: '#a7d7c3', accent: '#86efac', serif: true, cardBg: 'rgba(255,255,255,.09)' },
  { id: 'acid', name: '酸性平面', desc: '荧光撞色，前卫大胆', bg: null, bgStops: ['#facc15', '#22d3ee', '#d946ef'], text: '#111827', sub: '#3f3f46', accent: '#111827', serif: false, cardBg: 'rgba(255,255,255,.32)' },
  { id: 'classic', name: '古典书库', desc: '复古羊皮纸，典雅衬线', bg: '#f2e6cd', text: '#3f2d1b', sub: '#8b7355', accent: '#b45309', serif: true, cardBg: '#eadfc2' },
  { id: 'graffiti', name: '街头涂鸦', desc: '暗黑街头，黄色标记', bg: '#1a1a1a', text: '#fafafa', sub: '#9ca3af', accent: '#fde047', serif: false, cardBg: 'rgba(255,255,255,.07)' },
  { id: 'neon', name: '赛博霓虹', desc: '霓虹科幻，未来感', bg: null, bgStops: ['#0b1026', '#1a0b2e', '#2a0f3a'], text: '#e0f2fe', sub: '#93c5fd', accent: '#22d3ee', serif: false, cardBg: 'rgba(34,211,238,.10)' },
  { id: 'flow', name: '流光漫溢', desc: '梦幻渐变，轻盈通透', bg: null, bgStops: ['#fdf2f8', '#e0f2fe', '#fef9c3'], text: '#475569', sub: '#94a3b8', accent: '#d946ef', serif: false, cardBg: 'rgba(255,255,255,.55)' },
  { id: 'swiss', name: '瑞士现代', desc: '极简主义，黑白经典', bg: '#ffffff', text: '#000000', sub: '#6b7280', accent: '#000000', serif: false, cardBg: '#f3f4f6' },
  { id: 'ink', name: '水墨空寂', desc: '禅意留白，东方美学', bg: '#f7f5f0', text: '#2b2b2b', sub: '#8d8a83', accent: '#4a4a4a', serif: true, cardBg: '#efece3' },
]
const tplBg = t => t.bgStops ? `linear-gradient(160deg, ${t.bgStops.join(', ')})` : t.bg

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
  const [exportTpl, setExportTpl] = useState('ink')
  const [exportFormat, setExportFormat] = useState('image') // image | pdf
  const [exportWithExample, setExportWithExample] = useState(true)
  const [exportCourse, setExportCourse] = useState('all')
  const [exportTime, setExportTime] = useState('all')
  const [showStart, setShowStart] = useState(false)
  const [practice, setPractice] = useState(null) // { mode, words, i, input, result, showAns, done, correct }
  const [practiceMode, setPracticeMode] = useState('cn2ru')
  const [practiceOrder, setPracticeOrder] = useState('list') // list | random
  const [practiceCount, setPracticeCount] = useState(0)
  const [practiceAll, setPracticeAll] = useState(true) // false → practiceCount

  const refresh = () => setList(getVocabWords())
  const total = list.length
  const practiced = list.filter(w => (w.practiceCount || 0) > 0).length

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
      let va = 0, vb = 0
      if (sortBy === 'alpha') { va = norm(a.word); vb = norm(b.word); return sortDir === 'desc' ? vb.localeCompare(va, 'ru') : va.localeCompare(vb, 'ru') }
      if (sortBy === 'times') { va = a.practiceCount || 0; vb = b.practiceCount || 0 }
      else { va = a.addedAt || 0; vb = b.addedAt || 0 }
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

  // ---- 标记学会 / 删除 ----
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
    const next = { ...p, result: ok ? 'correct' : 'wrong', showAns: true, correct: p.correct + (ok ? 1 : 0) }
    incrementVocabPractice(cur.key)
    setPractice(next)
    refresh()
  }
  const revealAnswer = () => {
    if (!p || p.showAns) return
    const cur = p.words[p.i]
    incrementVocabPractice(cur.key)
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
  const card = (w, idx) => (
    <div
      key={w.key}
      onClick={() => selecting && toggleSelect(w.key)}
      className={`group relative overflow-hidden rounded-2xl border bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,.06)] transition-all duration-200 dark:bg-[#151519] dark:shadow-[0_1px_3px_rgba(0,0,0,.4)] ${
        selecting
          ? (selected.has(w.key)
            ? 'cursor-pointer border-violet-500 ring-2 ring-violet-500/40 dark:border-violet-400'
            : 'cursor-pointer border-gray-200 hover:border-violet-300 dark:border-white/10 dark:hover:border-violet-500/50')
          : 'border-gray-200 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(15,23,42,.12)] dark:border-white/10 dark:hover:shadow-[0_14px_34px_rgba(0,0,0,.5)]'
      }`}
    >
      {/* 顶部品牌细条（渐变） */}
      <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-400 opacity-0 transition-opacity duration-200 ${selecting && selected.has(w.key) ? 'opacity-100' : 'group-hover:opacity-100'}`} />

      <div className="flex items-start gap-4">
        {/* 勾选圆（选择模式） */}
        {selecting && (
          <div className={`mt-1 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 text-sm text-white transition-colors ${
            selected.has(w.key) ? 'border-violet-500 bg-violet-500' : 'border-gray-300 bg-white dark:border-gray-600 dark:bg-[#1c1c22]'
          }`}>{selected.has(w.key) ? '✓' : ''}</div>
        )}

        {/* 左：词 + 发音 */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <span className="truncate font-['PT_Serif',Georgia,serif] text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{w.word}</span>
            <button
              onClick={e => { e.stopPropagation(); speak(w.word, { rate: 0.8 }) }}
              title="播放发音"
              className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-violet-200 bg-violet-50 text-sm transition-all hover:scale-110 hover:bg-violet-100 dark:border-violet-500/30 dark:bg-violet-500/15 dark:hover:bg-violet-500/25"
            >🔊</button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {w.pos && (
              <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-600 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-300">{w.pos}</span>
            )}
            {w.chinese && <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{w.chinese}</span>}
          </div>
          {w.example && (
            <div className="mt-2.5 flex items-start gap-2 border-l-2 border-violet-300 pl-2.5 dark:border-violet-500/40">
              <span className="truncate font-['PT_Serif',Georgia,serif] text-[13px] text-gray-500 dark:text-gray-400">{w.example}</span>
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400 dark:text-gray-500">
            {(w.course || w.lesson) && <span>{(w.course || '') + (w.course && w.lesson ? ' / ' : '') + (w.lesson || '')}</span>}
            <span>· {fmtDate(w.addedAt)} 添加</span>
            <span>· 练习 {w.practiceCount || 0} 次</span>
          </div>
        </div>

        {/* 右：学会了（选择模式隐藏，进底栏） */}
        {!selecting && (
          <button
            onClick={e => { e.stopPropagation(); markLearned([w.key]) }}
            className="shrink-0 cursor-pointer rounded-full border border-emerald-300 px-3.5 py-1.5 text-xs font-semibold text-emerald-600 transition-all hover:bg-emerald-500 hover:text-white dark:border-emerald-500/40 dark:text-emerald-400 dark:hover:bg-emerald-500 dark:hover:text-white"
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
        {/* 顶栏 */}
        <div className="mb-5 flex items-center gap-3">
          <button onClick={() => setPractice(null)} className="cursor-pointer rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-[#151519] dark:text-gray-300 dark:hover:bg-white/5">← 返回生词本</button>
          <div className="flex-1" />
          {!p.done && (
            <div className="text-sm font-semibold text-violet-600 dark:text-violet-400">{p.i + 1} / {p.words.length}</div>
          )}
        </div>
        {/* 进度条 */}
        {!p.done && (
          <div className="mb-5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-300" style={{ width: `${((p.i + (p.showAns ? 1 : 0)) / p.words.length) * 100}%` }} />
          </div>
        )}

        {p.done ? (
          <div className="rounded-3xl border border-gray-200 bg-white px-8 py-14 text-center shadow-sm dark:border-white/10 dark:bg-[#151519]">
            <div className="text-5xl">🎉</div>
            <h3 className="mt-4 text-xl font-bold text-gray-900 dark:text-white">练习完成！</h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">共练习 {p.words.length} 个生词 · 答对 {p.correct} 个</p>
            <button onClick={() => setPractice(null)} className="mt-6 cursor-pointer rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-8 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-600/25">返回生词本</button>
          </div>
        ) : (
          <>
            {/* 模式提示 */}
            <div className="mb-4 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <span>{promptLabel?.icon}</span>
              <span>{promptLabel?.label} · {promptLabel?.desc}</span>
            </div>
            <div className="rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-white/10 dark:bg-[#151519]">
              {/* 题面 */}
              {p.mode === 'cn2ru' && (
                <div className="min-h-[72px] text-xl font-semibold leading-relaxed text-gray-800 dark:text-gray-100">{cur.chinese || cur.word}</div>
              )}
              {p.mode === 'dict' && (
                <div className="min-h-[72px]">
                  <button onClick={() => speak(cur.word, { rate: 0.8 })} className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 text-2xl text-white shadow-lg shadow-violet-600/30 transition-transform hover:scale-105" title="播放发音">▶</button>
                </div>
              )}
              {(p.mode === 'listen' || p.mode === 'speak') && (
                <div className="min-h-[72px]">
                  <div className="font-['PT_Serif',Georgia,serif] text-4xl font-bold text-gray-900 dark:text-white">{cur.word}</div>
                  <button onClick={() => speak(cur.word, { rate: 0.8 })} className="mt-4 cursor-pointer rounded-full border border-violet-200 bg-violet-50 px-5 py-2 text-sm font-medium text-violet-600 transition-all hover:scale-105 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-300">🔊 播放发音</button>
                </div>
              )}

              {/* 输入（中译俄/听写） */}
              {(p.mode === 'cn2ru' || p.mode === 'dict') && (
                <div className="mt-6">
                  <input
                    value={p.input}
                    onChange={e => setPractice({ ...p, input: e.target.value })}
                    onKeyDown={e => { if (e.key === 'Enter') { p.showAns ? practiceNext() : checkAnswer() } }}
                    autoFocus
                    placeholder="输入俄语…"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-center text-lg text-gray-900 outline-none transition-colors focus:border-violet-400 focus:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:border-violet-500 dark:focus:bg-white/10"
                  />
                </div>
              )}

              {/* 反馈 / 答案 */}
              {p.showAns ? (
                <div className="mt-5">
                  <div className={`text-base font-bold ${p.result === 'correct' ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {p.result === 'correct' ? '✓ 答对了！' : p.result === 'wrong' ? '✗ 再想想' : ''}
                  </div>
                  <div className="mt-2">
                    <span className="font-['PT_Serif',Georgia,serif] text-lg font-bold text-gray-900 dark:text-white">{cur.word}</span>
                    <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">{cur.chinese}</span>
                  </div>
                </div>
              ) : (p.mode === 'listen' || p.mode === 'speak') && (
                <button onClick={revealAnswer} className="mt-6 cursor-pointer rounded-xl border border-gray-200 bg-gray-50 px-8 py-2.5 text-sm font-semibold text-gray-700 transition-all hover:border-violet-300 hover:bg-violet-50 hover:text-violet-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-violet-500/15">显示答案</button>
              )}

              {/* 操作 */}
              <div className="mt-6 flex items-center justify-center gap-3">
                {p.showAns ? (
                  <button onClick={practiceNext} className="cursor-pointer rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-10 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-600/25 transition-transform hover:scale-[1.02]">
                    {p.i + 1 >= p.words.length ? '完成 ✓' : '下一个 →'}
                  </button>
                ) : (
                  (p.mode === 'cn2ru' || p.mode === 'dict') && (
                    <>
                      <button onClick={checkAnswer} disabled={!p.input.trim()} className="cursor-pointer rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-8 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-600/25 transition-opacity disabled:cursor-not-allowed disabled:opacity-40">检查</button>
                      <button onClick={revealAnswer} className="cursor-pointer rounded-xl border border-gray-200 px-6 py-2.5 text-sm text-gray-500 transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-gray-400 dark:hover:bg-white/5">直接看答案</button>
                    </>
                  )
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
      {/* 页眉 */}
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            生词本
            <span className="ml-2 inline-block h-1.5 w-10 rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-400 align-middle" />
          </h1>
          <p className="mt-1 text-[13px] text-gray-400 dark:text-gray-500">共 {total} 个生词 · 已练习 {practiced} 个</p>
        </div>
        {!selecting && (
          <>
            <button onClick={() => setShowFilter(true)} className="cursor-pointer rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 transition-all hover:border-violet-300 hover:text-violet-600 dark:border-white/10 dark:bg-[#151519] dark:text-gray-300 dark:hover:border-violet-500/50 dark:hover:text-violet-400">筛选</button>
            <button onClick={() => { setExportCourse('all'); setExportTime('all'); setShowExport(true) }} className="cursor-pointer rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 transition-all hover:border-violet-300 hover:text-violet-600 dark:border-white/10 dark:bg-[#151519] dark:text-gray-300 dark:hover:border-violet-500/50 dark:hover:text-violet-400">导出</button>
            <button onClick={() => setSelecting(true)} className="cursor-pointer rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 transition-all hover:border-violet-300 hover:text-violet-600 dark:border-white/10 dark:bg-[#151519] dark:text-gray-300 dark:hover:border-violet-500/50 dark:hover:text-violet-400">选择</button>
            <button onClick={() => setShowStart(true)} className="cursor-pointer rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-violet-600/25 transition-transform hover:scale-[1.03]">开始练习</button>
          </>
        )}
      </div>

      {/* 选择模式页眉 */}
      {selecting && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50/60 px-4 py-3 dark:border-violet-500/25 dark:bg-violet-500/10">
          <span className="text-base font-bold text-gray-900 dark:text-white">管理生词</span>
          <button onClick={selectAll} className="cursor-pointer text-sm font-medium text-violet-600 hover:underline dark:text-violet-400">全选</button>
          <button onClick={clearSelect} className="cursor-pointer text-sm font-medium text-gray-500 hover:underline dark:text-gray-400">取消</button>
          <div className="flex-1" />
          <span className="text-sm text-gray-500 dark:text-gray-400">已选择 {selected.size} 个</span>
        </div>
      )}

      {/* 空态 */}
      {total === 0 ? (
        <div className="mt-10 rounded-3xl border border-dashed border-gray-200 bg-white py-24 text-center dark:border-white/15 dark:bg-[#151519]">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-fuchsia-100 text-4xl dark:from-violet-500/20 dark:to-fuchsia-500/20">📒</div>
          <h3 className="mt-5 text-lg font-bold text-gray-900 dark:text-white">生词本还是空的</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-gray-400 dark:text-gray-500">
            在答题页点击句子里的单词，会弹出单词卡，点「添加到生词本」即可收录到这里
          </p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-dashed border-gray-200 bg-white py-20 text-center dark:border-white/15 dark:bg-[#151519]">
          <div className="text-4xl">🔍</div>
          <p className="mt-4 text-sm text-gray-400 dark:text-gray-500">当前筛选条件下没有生词</p>
          <button onClick={() => { setSortBy('added'); setSortDir('desc'); setTimeRange('all'); setMinTimesOn(false) }} className="mt-4 cursor-pointer rounded-xl border border-gray-200 px-5 py-2 text-sm text-violet-600 hover:bg-violet-50 dark:border-white/10 dark:text-violet-400 dark:hover:bg-violet-500/10">重置筛选</button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">{sorted.map(card)}</div>
      )}

      {/* 选择底栏 */}
      {selecting && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/85 px-4 py-3 backdrop-blur-md dark:border-white/10 dark:bg-[#0d0d11]/85">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2.5">
            <span className="text-sm text-gray-500 dark:text-gray-400">已选择 <b className="text-violet-600 dark:text-violet-400">{selected.size}</b> 个单词 / 共 {sorted.length} 条</span>
            <div className="flex-1" />
            <button onClick={() => removeMany([...selected])} className="cursor-pointer rounded-xl border border-rose-200 px-4 py-2 text-sm font-medium text-rose-500 transition-colors hover:bg-rose-50 dark:border-rose-500/30 dark:hover:bg-rose-500/10">删除</button>
            <button onClick={() => setShowExport(true)} className="cursor-pointer rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5">导出</button>
            <button onClick={() => markLearned([...selected])} className="cursor-pointer rounded-xl border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-600 transition-colors hover:bg-emerald-50 dark:border-emerald-500/30 dark:text-emerald-400 dark:hover:bg-emerald-500/10">标记为学会</button>
            <button onClick={() => startPractice(selectedWords)} className="cursor-pointer rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-violet-600/25">练习所选({selected.size})</button>
          </div>
        </div>
      )}

      {/* ============ 筛选弹窗 ============ */}
      {showFilter && (
        <Modal title="筛选条件" onClose={() => setShowFilter(false)}>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">排序方式</div>
          <div className="grid grid-cols-3 gap-2">
            {[['added', '最新添加'], ['alpha', '字母顺序'], ['times', '练习次数']].map(([k, label]) => (
              <button key={k} onClick={() => setSortBy(k)} className={`cursor-pointer rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
                sortBy === k ? 'border-violet-500 bg-violet-50 text-violet-600 dark:border-violet-400 dark:bg-violet-500/15 dark:text-violet-300' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-white/10 dark:bg-transparent dark:text-gray-300'
              }`}>{label}</button>
            ))}
          </div>
          <div className="mb-1.5 mt-5 text-xs font-semibold uppercase tracking-wide text-gray-400">排序顺序</div>
          <div className="grid grid-cols-2 gap-2">
            {[['desc', '降序'], ['asc', '升序']].map(([k, label]) => (
              <button key={k} onClick={() => setSortDir(k)} className={`cursor-pointer rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
                sortDir === k ? 'border-violet-500 bg-violet-50 text-violet-600 dark:border-violet-400 dark:bg-violet-500/15 dark:text-violet-300' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-white/10 dark:bg-transparent dark:text-gray-300'
              }`}>{label}</button>
            ))}
          </div>
          <div className="mb-1.5 mt-5 text-xs font-semibold uppercase tracking-wide text-gray-400">添加时间</div>
          <div className="grid grid-cols-4 gap-2">
            {[['all', '全部时间'], ['today', '今天'], ['7d', '7天内'], ['30d', '一个月内']].map(([k, label]) => (
              <button key={k} onClick={() => setTimeRange(k)} className={`cursor-pointer rounded-xl border px-2 py-2.5 text-[13px] font-medium transition-all ${
                timeRange === k ? 'border-violet-500 bg-violet-50 text-violet-600 dark:border-violet-400 dark:bg-violet-500/15 dark:text-violet-300' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-white/10 dark:bg-transparent dark:text-gray-300'
              }`}>{label}</button>
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
              <button onClick={() => setMinTimesOn(!minTimesOn)} className={`relative h-6 w-11 cursor-pointer rounded-full transition-colors ${minTimesOn ? 'bg-violet-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${minTimesOn ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>
          </div>
          <div className="mt-6 flex gap-3">
            <button onClick={() => { setSortBy('added'); setSortDir('desc'); setTimeRange('all'); setMinTimesOn(false); setMinTimes(1) }} className="flex-1 cursor-pointer rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5">重置</button>
            <button onClick={() => setShowFilter(false)} className="flex-1 cursor-pointer rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-600/25">完成</button>
          </div>
        </Modal>
      )}

      {/* ============ 导出弹窗 ============ */}
      {showExport && (
        <Modal title="导出生词本" onClose={() => setShowExport(false)} wide>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">课程包</div>
              <select value={exportCourse} onChange={e => setExportCourse(e.target.value)}
                className="w-full cursor-pointer rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-violet-400 dark:border-white/10 dark:bg-white/5 dark:text-gray-200">
                <option value="all">全部课程包</option>
                {courses.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">时间范围</div>
              <select value={exportTime} onChange={e => setExportTime(e.target.value)}
                className="w-full cursor-pointer rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-violet-400 dark:border-white/10 dark:bg-white/5 dark:text-gray-200">
                <option value="all">全部</option>
                <option value="today">今天添加</option>
                <option value="7d">7天内添加</option>
                <option value="30d">一个月内添加</option>
              </select>
            </div>
          </div>
          <div className="mt-3 rounded-xl border border-violet-100 bg-violet-50/60 px-4 py-2.5 text-sm text-violet-600 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300">
            {selecting && selected.size ? `已选择 ${selected.size} 个生词将被导出` : `共 ${exportList.length} 个生词将被导出`}
          </div>

          <div className="mb-1.5 mt-5 text-xs font-semibold uppercase tracking-wide text-gray-400">选择模板</div>
          <div className="grid max-h-56 grid-cols-3 gap-2 overflow-y-auto pr-1">
            {TEMPLATES.map(t => (
              <button key={t.id} onClick={() => setExportTpl(t.id)}
                className={`cursor-pointer rounded-xl border p-2.5 text-left transition-all ${exportTpl === t.id ? 'border-violet-500 ring-2 ring-violet-500/25 dark:border-violet-400' : 'border-gray-200 hover:border-gray-300 dark:border-white/10'}`}>
                <div className="h-9 rounded-lg" style={{ background: tplBg(t) }}>
                  <div className="px-2 pt-1.5 font-['PT_Serif',Georgia,serif] text-xs font-bold" style={{ color: t.text }}>привет</div>
                </div>
                <div className="mt-1.5 text-xs font-semibold" style={{ color: t.text }}>{t.name}</div>
                <div className="text-[11px] leading-tight text-gray-400">{t.desc}</div>
              </button>
            ))}
          </div>

          {/* 模板预览 */}
          <div className="mb-1.5 mt-4 text-xs font-semibold uppercase tracking-wide text-gray-400">模板效果预览</div>
          <div className="overflow-hidden rounded-xl" style={{ background: tplBg(TEMPLATES.find(t => t.id === exportTpl)) }}>
            <div className="flex items-center justify-between border-b border-white/20 px-4 py-2.5" style={{ color: TEMPLATES.find(t => t.id === exportTpl).sub }}>
              <span className="text-xs font-semibold tracking-wide">生词本 · 共 {Math.min(3, exportList.length)} 个示例</span>
              <span className="text-[10px]">{fmtDate(Date.now())}</span>
            </div>
            {exportList.slice(0, 3).map(w => (
              <div key={w.key} className="border-b border-white/15 px-4 py-2.5">
                <div className="flex items-baseline gap-2">
                  <span className={`${TEMPLATES.find(t => t.id === exportTpl).serif ? "font-['PT_Serif',Georgia,serif]" : ''} text-lg font-bold`} style={{ color: TEMPLATES.find(t => t.id === exportTpl).text }}>{w.word}</span>
                  {w.pos && <span className="text-[10px]" style={{ color: TEMPLATES.find(t => t.id === exportTpl).accent }}>{w.pos}</span>}
                  <span className="flex-1 text-right text-xs" style={{ color: TEMPLATES.find(t => t.id === exportTpl).sub }}>{w.chinese}</span>
                </div>
                {exportWithExample && w.example && (
                  <div className="mt-0.5 text-[11px] italic" style={{ color: TEMPLATES.find(t => t.id === exportTpl).sub }}>{w.example}</div>
                )}
              </div>
            ))}
          </div>

          <div className="mb-1.5 mt-5 text-xs font-semibold uppercase tracking-wide text-gray-400">导出格式</div>
          <div className="grid grid-cols-2 gap-2">
            {[['image', '🖼 图片 (PNG)'], ['pdf', '📄 PDF']].map(([k, label]) => (
              <button key={k} onClick={() => setExportFormat(k)} className={`cursor-pointer rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
                exportFormat === k ? 'border-violet-500 bg-violet-50 text-violet-600 dark:border-violet-400 dark:bg-violet-500/15 dark:text-violet-300' : 'border-gray-200 bg-white text-gray-600 dark:border-white/10 dark:bg-transparent dark:text-gray-300'
              }`}>{label}</button>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 dark:border-white/10">
            <div>
              <div className="text-sm font-medium text-gray-800 dark:text-gray-100">附上例句</div>
              <div className="text-xs text-gray-400">在生词下方标注收录时所在的句子</div>
            </div>
            <button onClick={() => setExportWithExample(!exportWithExample)} className={`relative h-6 w-11 cursor-pointer rounded-full transition-colors ${exportWithExample ? 'bg-violet-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${exportWithExample ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>

          <div className="mt-6 flex gap-3">
            <button onClick={() => setShowExport(false)} className="flex-1 cursor-pointer rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5">关闭</button>
            <button onClick={doExport} className="flex-1 cursor-pointer rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-600/25">导出{exportFormat === 'image' ? '图片' : 'PDF'}</button>
          </div>
        </Modal>
      )}

      {/* ============ 开始练习弹窗 ============ */}
      {showStart && (
        <Modal title="开始练习" onClose={() => setShowStart(false)}>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">练习模式</div>
          <div className="grid grid-cols-2 gap-2">
            {MODES.map(m => (
              <button key={m.id} onClick={() => setPracticeMode(m.id)} className={`cursor-pointer rounded-xl border p-3 text-left transition-all ${
                practiceMode === m.id ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-500/25 dark:border-violet-400 dark:bg-violet-500/15' : 'border-gray-200 hover:border-gray-300 dark:border-white/10'
              }`}>
                <div className="text-sm font-bold text-gray-800 dark:text-gray-100">{m.icon} {m.label}</div>
                <div className="mt-0.5 text-xs text-gray-400">{m.desc}</div>
              </button>
            ))}
          </div>
          <div className="mb-1.5 mt-5 text-xs font-semibold uppercase tracking-wide text-gray-400">练习顺序</div>
          <div className="grid grid-cols-2 gap-2">
            {[['list', '按列表顺序'], ['random', '随机顺序']].map(([k, label]) => (
              <button key={k} onClick={() => setPracticeOrder(k)} className={`cursor-pointer rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
                practiceOrder === k ? 'border-violet-500 bg-violet-50 text-violet-600 dark:border-violet-400 dark:bg-violet-500/15 dark:text-violet-300' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-white/10 dark:bg-transparent dark:text-gray-300'
              }`}>{label}</button>
            ))}
          </div>
          <div className="mb-1.5 mt-5 text-xs font-semibold uppercase tracking-wide text-gray-400">练习数量</div>
          <div className="flex items-center gap-3">
            <div className="flex items-center overflow-hidden rounded-xl border border-gray-200 dark:border-white/10">
              <button onClick={() => { setPracticeAll(false); setPracticeCount(c => Math.max(0, c - 1)) }} className="h-10 w-10 cursor-pointer text-lg text-gray-500 transition-colors hover:bg-gray-50 dark:hover:bg-white/5">−</button>
              <input type="number" min={0} max={total} value={practiceCount} onChange={e => { setPracticeAll(false); setPracticeCount(Math.max(0, parseInt(e.target.value || '0', 10))) }}
                className="h-10 w-16 border-x border-gray-200 bg-gray-50 text-center text-sm outline-none dark:border-white/10 dark:bg-white/5 dark:text-white" />
              <button onClick={() => { setPracticeAll(false); setPracticeCount(c => Math.min(total, c + 1)) }} className="h-10 w-10 cursor-pointer text-lg text-gray-500 transition-colors hover:bg-gray-50 dark:hover:bg-white/5">＋</button>
            </div>
            <span className="text-xs text-gray-400">最多 {total} 个</span>
            <div className="flex-1" />
            <button onClick={() => { setPracticeAll(true); setPracticeCount(total) }} className={`cursor-pointer rounded-xl border px-4 py-2 text-sm font-medium transition-all ${
              practiceAll ? 'border-violet-500 bg-violet-50 text-violet-600 dark:border-violet-400 dark:bg-violet-500/15 dark:text-violet-300' : 'border-gray-200 text-gray-600 hover:border-gray-300 dark:border-white/10 dark:text-gray-300'
            }`}>全部</button>
          </div>
          <button onClick={() => startPractice(sorted)} className="mt-6 w-full cursor-pointer rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3 text-sm font-bold text-white shadow-lg shadow-violet-600/25 transition-transform hover:scale-[1.01]">
            开始练习{total ? `（${practiceAll ? total : Math.min(practiceCount || 1, total)} 个）` : ''}
          </button>
        </Modal>
      )}
    </div>
  )
}

// ---------------- 弹窗骨架 ----------------
function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" style={{ animation: 'vb-fadeIn .18s ease' }} onClick={onClose}>
      <style>{`
        @keyframes vb-fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes vb-popIn { from { opacity: 0; transform: translateY(14px) scale(.98) } to { opacity: 1; transform: translateY(0) scale(1) } }
      `}</style>
      <div onClick={e => e.stopPropagation()} className={`${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[86vh] w-full overflow-y-auto rounded-3xl border border-gray-200/80 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,.18)] dark:border-white/10 dark:bg-[#151519] dark:shadow-[0_24px_70px_rgba(0,0,0,.55)]`} style={{ animation: 'vb-popIn .22s cubic-bezier(.2,.9,.3,1.2)' }}>
        <div className="mb-5 flex items-center">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h3>
          <div className="flex-1" />
          <button onClick={onClose} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-base text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-500 dark:hover:bg-white/10">×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ---------------- 导出实现 ----------------
function exportPNG(words, tpl, withExample) {
  const W = 900
  const headerH = 130
  const rowH = withExample ? 136 : 96
  const H = headerH + words.length * rowH + 90
  const cv = document.createElement('canvas')
  cv.width = W; cv.height = H
  const ctx = cv.getContext('2d')

  // 背景
  if (tpl.bgStops) {
    const g = ctx.createLinearGradient(0, 0, 0, H)
    tpl.bgStops.forEach((c, i) => g.addColorStop(i / (tpl.bgStops.length - 1), c))
    ctx.fillStyle = g
  } else { ctx.fillStyle = tpl.bg }
  ctx.fillRect(0, 0, W, H)

  // 头部
  ctx.fillStyle = tpl.text
  ctx.font = '700 34px "PT Serif", Georgia, serif'
  ctx.fillText('生词本', 48, 62)
  ctx.fillStyle = tpl.sub
  ctx.font = '500 16px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillText(`共 ${words.length} 个生词  ·  ${fmtDate(Date.now())}`, 48, 92)
  // 装饰线
  ctx.fillStyle = tpl.accent
  ctx.fillRect(48, 104, 64, 4)

  // 词条
  words.forEach((w, i) => {
    const y = headerH + i * rowH
    const pad = 24
    const r = 14
    ctx.fillStyle = tpl.cardBg
    ctx.beginPath()
    ctx.moveTo(pad + r, y); ctx.arcTo(pad + W - pad, y, pad + W - pad, y + rowH - 14, r)
    ctx.arcTo(pad + W - pad, y + rowH - 14, pad, y + rowH - 14, r)
    ctx.arcTo(pad, y + rowH - 14, pad, y, r); ctx.arcTo(pad, y, pad + W - pad, y, r)
    ctx.closePath(); ctx.fill()

    // 单词
    ctx.fillStyle = tpl.text
    ctx.font = `${tpl.serif ? '700' : '700'} 30px ${tpl.serif ? '"PT Serif", Georgia, serif' : '"Nunito", "Segoe UI", sans-serif'}`
    ctx.fillText(w.word, 52, y + 40)
    // 词性标签（强调色小方块）
    if (w.pos) {
      ctx.fillStyle = tpl.accent
      ctx.font = '600 13px "PingFang SC", "Microsoft YaHei", sans-serif'
      ctx.fillText(w.pos, 52 + ctx.measureText(w.word).width + 14, y + 40)
    }
    // 中文（右侧）
    ctx.fillStyle = tpl.sub
    ctx.textAlign = 'right'
    ctx.font = '500 17px "PingFang SC", "Microsoft YaHei", sans-serif'
    ctx.fillText(w.chinese || '', W - 52, y + 40)
    ctx.textAlign = 'left'
    // 例句
    if (withExample && w.example) {
      ctx.fillStyle = tpl.sub
      ctx.font = 'italic 400 15px "PT Serif", Georgia, serif'
      ctx.fillText('「' + w.example + '」', 52, y + 74)
    }
    // 底部细线
    ctx.strokeStyle = tpl.cardBg === '#f3f4f6' ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.14)'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(pad + 8, y + rowH - 8); ctx.lineTo(W - pad - 8, y + rowH - 8); ctx.stroke()
  })

  const a = document.createElement('a')
  a.href = cv.toDataURL('image/png')
  a.download = `生词本-${tpl.name}-${Date.now()}.png`
  a.click()
  toast(`已导出图片（${words.length} 个生词，模板「${tpl.name}」）`)
}

function exportPDF(words, tpl, withExample) {
  const t = tpl
  const rows = words.map(w => `
    <div class="row">
      <div class="row-head">
        <span class="word">${w.word}</span>
        ${w.pos ? `<span class="pos">${w.pos}</span>` : ''}
        <span class="cn">${w.chinese || ''}</span>
      </div>
      ${withExample && w.example ? `<div class="ex">「${w.example}」</div>` : ''}
    </div>
  `).join('')
  const win = window.open('', '_blank')
  win.document.write(`<!doctype html><html><head><title>生词本导出</title><style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:${t.bgStops ? `linear-gradient(160deg,${t.bgStops.join(',')}) fixed` : t.bg}; color:${t.text}; font-family:${t.serif ? '"PT Serif", Georgia, serif' : '"Nunito", "Segoe UI", "PingFang SC", sans-serif'}; padding:48px; }
    .head { display:flex; align-items:baseline; gap:16px; margin-bottom:8px; }
    .title { font-size:30px; font-weight:700; }
    .meta { font-size:14px; opacity:.65; }
    .bar { width:64px; height:4px; background:${t.accent}; margin-bottom:32px; }
    .row { background:${t.cardBg}; border-radius:14px; padding:18px 22px; margin-bottom:12px; }
    .row-head { display:flex; align-items:baseline; gap:12px; }
    .word { font-size:24px; font-weight:700; }
    .pos { font-size:12px; font-weight:600; color:${t.accent}; }
    .cn { flex:1; text-align:right; font-size:15px; opacity:.75; }
    .ex { margin-top:6px; font-size:13px; font-style:italic; opacity:.6; }
    @media print { body { padding:24px; } }
  </style></head><body>
    <div class="head"><span class="title">生词本</span><span class="meta">共 ${words.length} 个生词 · ${fmtDate(Date.now())}</span></div>
    <div class="bar"></div>
    ${rows}
  </body></html>`)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print() }, 400)
  toast('已打开 PDF 打印窗口（选择"另存为 PDF"即可）')
}
