// 复习本 · 学过的所有句子（句子级卡片；同一句去重只挂一个，模式/课程标签合并）
// 路由：/vocab（侧边栏「通关存档 → 复习本」）
// 页眉：筛选 / 复习设置 / 选择 / 开始复习，条目卡片包裹式
// 数据源：rlearn_review_items（中译俄/听写/听力/口语评测 答题时自动记录）
// 设计：简约大气有质感 —— 无渐变装饰，细边框 + 柔和阴影 + 单一强调色，跟随全局主题（与生词本同款设计语言）
import { useState, useMemo } from 'react'
import { getReviewSentences, removeSentence } from '../lib/reviewItems'
import { speak } from '../lib/tts'

const MODES = ['中译俄', '听写', '听力', '口语评测']
const pad = n => String(n).padStart(2, '0')
const fmtDate = d => { if (!d) return ''; const t = new Date(d); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}` }
const todayStr = () => { const t = new Date(); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}` }

const SETTINGS_KEY = 'rlearn_review_settings'
const DAILY_KEY = 'rlearn_review_daily'

function loadSettings() {
  try {
    const v = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null')
    if (v && v.modes) return v.modes
  } catch (e) { /* 忽略 */ }
  const def = {}; MODES.forEach(m => { def[m] = 10 })
  return def
}
function saveSettings(modes) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ modes })) } catch (e) { /* 忽略 */ }
}
function loadDaily() {
  try {
    const v = JSON.parse(localStorage.getItem(DAILY_KEY) || 'null')
    return v && v.date === todayStr() ? (v.done || 0) : 0
  } catch (e) { return 0 }
}
function saveDaily(n) {
  try { localStorage.setItem(DAILY_KEY, JSON.stringify({ date: todayStr(), done: n })) } catch (e) { /* 忽略 */ }
}

// 统一按钮样式（与生词本一致）
const ghost = 'cursor-pointer rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50 dark:border-white/10 dark:bg-transparent dark:text-gray-300 dark:hover:bg-white/5'
const primary = 'cursor-pointer rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700'
// 页眉栏小按钮
const ghostSm = 'cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50 dark:border-white/10 dark:bg-transparent dark:text-gray-300 dark:hover:bg-white/5'
const primarySm = 'cursor-pointer rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-violet-700'

export default function Vocab() {
  const [list, setList] = useState(() => getReviewSentences())
  const [tab, setTab] = useState('all') // all | pack
  const [sortBy, setSortBy] = useState('added') // added | times | review(会员锁)
  const [sortDir, setSortDir] = useState('desc') // desc | asc
  const [showFilter, setShowFilter] = useState(false)
  const [settings, setSettings] = useState(() => loadSettings())
  const [showSettings, setShowSettings] = useState(false)
  const [startMode, setStartMode] = useState(MODES[0])
  const [showStart, setShowStart] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState(() => new Set())
  const [review, setReview] = useState(null) // { words, i, showAns, done }
  const [dailyDone, setDailyDone] = useState(() => loadDaily())

  const refresh = () => setList(getReviewSentences())

  const sorted = useMemo(() => {
    const arr = [...list]
    arr.sort((a, b) => {
      let va = 0, vb = 0
      if (sortBy === 'times') { va = (a.correctCount || 0) + (a.wrongCount || 0); vb = (b.correctCount || 0) + (b.wrongCount || 0) }
      else { va = a.learnedAt || a.lastAt || 0; vb = b.learnedAt || b.lastAt || 0 }
      return sortDir === 'desc' ? vb - va : va - vb
    })
    return arr
  }, [list, sortBy, sortDir])

  const total = list.length
  const packGroups = useMemo(() => {
    if (tab !== 'pack') return null
    const g = {}
    sorted.forEach(w => { const k = w.lesson || '未分类'; (g[k] = g[k] || []).push(w) })
    return Object.entries(g)
  }, [tab, sorted])

  const toggleSelect = key => {
    const s = new Set(selected)
    if (s.has(key)) s.delete(key); else s.add(key)
    setSelected(s)
  }
  const selectAll = () => { const s = new Set(sorted.map(w => w.key)); setSelected(s) }
  const clearSelect = () => setSelected(new Set())
  const selectedWords = useMemo(() => sorted.filter(w => selected.has(w.key)), [sorted, selected])

  const startReview = (words) => {
    if (!words.length) return
    setReview({ words, i: 0, showAns: false, done: false })
    setShowStart(false); setSelecting(false)
  }
  const reveal = () => {
    if (review && !review.showAns) {
      setReview({ ...review, showAns: true })
      setDailyDone(n => { const v = n + 1; saveDaily(v); return v })
    }
  }
  const reviewNext = () => {
    if (!review) return
    const i = review.i + 1
    if (i >= review.words.length) { setReview({ ...review, done: true }); return }
    setReview({ ...review, i, showAns: false })
  }
  const reviewPrev = () => {
    if (!review) return
    setReview({ ...review, i: Math.max(0, review.i - 1), showAns: false })
  }
  const removeMany = (keys) => {
    keys.forEach(k => removeSentence(k))
    refresh(); clearSelect()
  }

  const card = (c) => (
    <div
      key={c.key}
      onClick={() => selecting && toggleSelect(c.key)}
      className={`group rounded-xl border bg-white p-5 shadow-sm transition-all dark:bg-[#151519] ${
        selecting
          ? (selected.has(c.key)
            ? 'cursor-pointer border-violet-500 ring-1 ring-violet-500/40 dark:border-violet-400'
            : 'cursor-pointer border-gray-200 hover:border-violet-300 dark:border-white/10')
          : 'border-gray-200 hover:-translate-y-0.5 hover:shadow-md dark:border-white/10'
      }`}
    >
      <div className="flex items-start gap-4">
        {selecting && (
          <div className={`mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 text-sm text-white transition-colors ${
            selected.has(c.key) ? 'border-violet-600 bg-violet-600' : 'border-gray-300 bg-white dark:border-gray-600 dark:bg-[#1c1c22]'
          }`}>{selected.has(c.key) ? '✓' : ''}</div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <span className="ru font-['PT_Serif',Georgia,serif] text-lg font-bold leading-snug tracking-tight text-gray-900 dark:text-white">{c.russian}</span>
            <button
              onClick={e => { e.stopPropagation(); speak(c.russian, { rate: 0.8 }) }}
              title="播放发音"
              className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-gray-200 text-sm text-gray-400 transition-colors hover:border-violet-300 hover:text-violet-600 dark:border-white/10 dark:hover:border-violet-500/40 dark:hover:text-violet-400"
            >🔊</button>
          </div>
          <div className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">{c.chinese || '—'}</div>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {(c.modes && c.modes.length ? c.modes : ['学过']).map(m => (
              <span key={m} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-white/10 dark:text-gray-400">{m}</span>
            ))}
            {(c.wrongCount || 0) > 0 && (
              <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">答错 {c.wrongCount} 次</span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400 dark:text-gray-500">
            <span>{fmtDate(c.learnedAt)} 添加</span>
            <span>· 已练习 {(c.correctCount || 0) + (c.wrongCount || 0)} 次</span>
            <span>· 上次: {fmtDate(c.lastAt)}</span>
          </div>
        </div>
        {!selecting && (
          <button
            onClick={() => { if (window.confirm(`确定移除「${c.russian}」吗？`)) { removeSentence(c.key); refresh() } }}
            title="移除"
            className="shrink-0 cursor-pointer rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-400 transition-colors hover:border-rose-300 hover:text-rose-500 dark:border-white/10"
          >移除</button>
        )}
      </div>
    </div>
  )

  // ---- 翻卡复习模式 ----
  if (review) {
    const { words, i, showAns, done } = review
    const cur = words[i]
    return (
      <div className="mx-auto max-w-xl p-6">
        <div className="mb-5 flex items-center gap-3">
          <button onClick={() => setReview(null)} className={ghost}>← 返回复习本</button>
          <div className="flex-1" />
          {!done && <div className="text-sm font-semibold text-violet-600 dark:text-violet-400">{i + 1} / {words.length}</div>}
          <div className="text-sm text-gray-400 dark:text-gray-500">今日 {dailyDone}</div>
        </div>

        {done ? (
          <div className="rounded-2xl border border-gray-200 bg-white px-8 py-14 text-center shadow-sm dark:border-white/10 dark:bg-[#151519]">
            <div className="text-5xl">🎉</div>
            <h3 className="mt-4 text-xl font-bold text-gray-900 dark:text-white">今日复习完成！</h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">共复习 {words.length} 个句子，明天再来巩固</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-white/10 dark:bg-[#151519]">
            <div className="ru font-['PT_Serif',Georgia,serif] text-2xl font-bold leading-relaxed text-gray-900 dark:text-white">{cur.russian}</div>
            <button onClick={() => speak(cur.russian, { rate: 0.8 })} className={`${ghost} mt-5`}>🔊 听发音</button>
            {showAns ? (
              <div className="mt-6">
                <div className="text-lg font-semibold text-gray-700 dark:text-gray-200">{cur.chinese || '暂无释义'}</div>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  {(cur.modes && cur.modes.length ? cur.modes : ['学过']).map(m => (
                    <span key={m} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-white/10 dark:text-gray-400">{m}</span>
                  ))}
                </div>
                <div className="mt-3 text-xs text-gray-400 dark:text-gray-500">答对 {cur.correctCount || 0} 次 · 答错 {cur.wrongCount || 0} 次</div>
              </div>
            ) : (
              <div className="mt-7">
                <button onClick={reveal} className={`${primary} px-10 py-2.5`}>显示答案</button>
              </div>
            )}
          </div>
        )}

        {!done && (
          <div className="mt-6 flex items-center justify-center gap-3">
            <button onClick={reviewPrev} disabled={i === 0} className={`${ghost} disabled:cursor-not-allowed disabled:opacity-40`}>← 上一个</button>
            <button onClick={reviewNext} className={`${primary} px-8`}>{i + 1 >= words.length ? '完成复习 ✓' : '下一个 →'}</button>
          </div>
        )}
      </div>
    )
  }

  // ---- 复习本主页面 ----
  return (
    <div className="mx-auto max-w-5xl p-6">
      {/* 页眉栏：标题 + 子标签 + 功能按钮同行，页眉下为今日进度 */}
      <div className="mb-6 border-b border-gray-200 pb-5 dark:border-white/10">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">复习本</h1>
          {!selecting && (
            <>
              <div className="flex overflow-hidden rounded-lg border border-gray-200 dark:border-white/10">
                {[['all', '全部复习'], ['pack', '按课程包']].map(([k, label]) => (
                  <button key={k} onClick={() => setTab(k)}
                    className={`cursor-pointer px-3 py-1.5 text-xs font-medium transition-colors ${
                      tab === k ? 'bg-violet-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-transparent dark:text-gray-300 dark:hover:bg-white/5'
                    }`}>{label}</button>
                ))}
              </div>
              <div className="flex-1" />
              <button onClick={() => setShowFilter(true)} className={ghostSm}>筛选</button>
              <button onClick={() => setShowSettings(true)} className={ghostSm}>复习设置</button>
              <button onClick={() => setSelecting(true)} className={ghostSm}>选择</button>
              <button onClick={() => setShowStart(true)} className={primarySm}>开始复习({total})</button>
            </>
          )}
          {selecting && (
            <>
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">管理复习项</span>
              <button onClick={selectAll} className="cursor-pointer text-xs font-medium text-violet-600 hover:underline dark:text-violet-400">全选</button>
              <button onClick={clearSelect} className="cursor-pointer text-xs font-medium text-gray-500 hover:underline dark:text-gray-400">取消</button>
              <div className="flex-1" />
              <span className="text-xs text-gray-400 dark:text-gray-500">已选择 {selected.size} 题</span>
            </>
          )}
        </div>
        {/* 今日进度（页眉下） */}
        {!selecting && (
          <div className="mt-3.5 flex max-w-sm items-center gap-3">
            <span className="shrink-0 text-xs font-medium text-gray-500 dark:text-gray-400">今日进度</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
              <div className="h-full rounded-full bg-violet-600 transition-all duration-300" style={{ width: `${total ? Math.min(100, (dailyDone / total) * 100) : 0}%` }} />
            </div>
            <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">{dailyDone} / {total}</span>
          </div>
        )}
      </div>

      {/* 空态 */}
      {total === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-gray-200 bg-white py-24 text-center dark:border-white/15 dark:bg-[#151519]">
          <div className="text-5xl">📖</div>
          <h3 className="mt-5 text-lg font-bold text-gray-900 dark:text-white">还没有学过的句子</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-gray-400 dark:text-gray-500">
            去中译俄 / 听写 / 听力 / 口语页练习，答过的句子会自动出现在这里
          </p>
        </div>
      ) : tab === 'pack' ? (
        <div className="flex flex-col gap-5">
          {packGroups.map(([lesson, words]) => (
            <div key={lesson}>
              <div className="mb-2.5 flex items-baseline gap-2 px-1">
                <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">课程 {lesson}</span>
                <span className="text-xs text-gray-400">{words.length} 个</span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">{words.map(card)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">{sorted.map(card)}</div>
      )}

      {/* 选择底栏 */}
      {selecting && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-[#0d0d11]/90">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2.5">
            <span className="text-sm text-gray-500 dark:text-gray-400">已选择 <b className="text-violet-600 dark:text-violet-400">{selected.size}</b> 题 / 共 {sorted.length} 条</span>
            <div className="flex-1" />
            <button onClick={() => { if (window.confirm(`确定删除选中的 ${selected.size} 个句子吗？`)) removeMany([...selected]) }}
              className="cursor-pointer rounded-lg border border-rose-200 px-4 py-2 text-sm font-medium text-rose-500 transition-colors hover:bg-rose-50 dark:border-rose-500/30 dark:hover:bg-rose-500/10">删除选中</button>
            <button onClick={() => startReview(selectedWords)} className={primary}>练习选中({selected.size})</button>
          </div>
        </div>
      )}

      {/* 筛选弹窗 */}
      {showFilter && (
        <Modal title="筛选条件" onClose={() => setShowFilter(false)}>
          <div className="mb-2 text-xs font-medium text-gray-400">排序方式</div>
          <div className="flex flex-col gap-2">
            {[['added', '添加时间'], ['times', '练习次数'], ['review', '复习时间']].map(([k, label]) => (
              <button key={k} onClick={() => k !== 'review' && setSortBy(k)} className={optBtn(sortBy === k, k === 'review')}>
                {label}{k === 'review' && <span className="ml-1.5 text-[11px] text-amber-500">🔒 会员</span>}
              </button>
            ))}
          </div>
          <div className="mb-2 mt-5 text-xs font-medium text-gray-400">排序顺序</div>
          <div className="grid grid-cols-2 gap-2">
            {[['desc', '降序'], ['asc', '升序']].map(([k, label]) => (
              <button key={k} onClick={() => setSortDir(k)} className={optBtn(sortDir === k)}>{label}</button>
            ))}
          </div>
          <div className="mt-6 flex gap-3">
            <button onClick={() => { setSortBy('added'); setSortDir('desc') }} className={`${ghost} flex-1`}>重置</button>
            <button onClick={() => setShowFilter(false)} className={`${primary} flex-1`}>关闭</button>
          </div>
        </Modal>
      )}

      {/* 复习设置弹窗 */}
      {showSettings && (
        <Modal title="复习设置" onClose={() => setShowSettings(false)}>
          <div className="mb-3 text-xs font-medium text-gray-400">每日复习量 · 按模式自定义</div>
          {MODES.map(m => (
            <div key={m} className="flex items-center gap-3 border-b border-gray-100 py-3 last:border-0 dark:border-white/5">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">{m}</div>
                <div className="text-xs text-gray-400">{m === '中译俄' ? '看中文写出俄语' : m === '听写' ? '听音频写出句子' : m === '听力' ? '盲听理解句子' : '跟读和口语练习'}</div>
              </div>
              <input
                type="number" min={1} max={99} value={settings[m] || 10}
                onChange={e => setSettings({ ...settings, [m]: Math.min(99, Math.max(1, parseInt(e.target.value || '10', 10))) })}
                className="w-16 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-center text-sm outline-none focus:border-violet-400 dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
              <span className="w-5 text-sm text-gray-400">次</span>
            </div>
          ))}
          <p className="mt-2 text-xs leading-relaxed text-gray-400">自定义时按模式分别限制，互不挪用。同一内容如果今天同时有多种模式到期，会分别计入对应模式。</p>

          <div className="mb-2 mt-5 text-xs font-medium text-gray-400">复习模式 <span className="text-[11px] text-amber-500">🔒 会员</span></div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 dark:border-white/5 dark:bg-white/5">
            <div className="text-xs text-gray-400">开通会员后可自定义复习模式，专注练习薄弱环节。</div>
            <button onClick={() => alert('会员功能暂未开放')} className={`${ghost} mt-2.5 text-violet-600 dark:text-violet-400`}>开通会员</button>
          </div>

          <div className="mb-2 mt-5 text-xs font-medium text-gray-400">仅复习错题 <span className="text-[11px] text-amber-500">🔒 会员</span></div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 dark:border-white/5 dark:bg-white/5">
            <div className="text-xs text-gray-400">只推荐你做错过的内容。</div>
            <button onClick={() => alert('会员功能暂未开放')} className={`${ghost} mt-2.5 text-violet-600 dark:text-violet-400`}>开通会员</button>
          </div>

          <div className="mt-6 flex gap-3">
            <button onClick={() => { const d = {}; MODES.forEach(m => { d[m] = 10 }); setSettings(d) }} className={`${ghost} flex-1`}>恢复默认</button>
            <button onClick={() => { saveSettings(settings); setShowSettings(false) }} className={`${primary} flex-1`}>保存设置</button>
          </div>
        </Modal>
      )}

      {/* 开始复习 → 今日推荐弹窗 */}
      {showStart && (
        <Modal title="今日推荐" onClose={() => setShowStart(false)}>
          <div className="mb-2 text-xs font-medium text-gray-400">练习模式</div>
          <div className="grid grid-cols-2 gap-2">
            {MODES.map(m => {
              const n = Math.min(settings[m] || 10, total)
              const active = startMode === m
              return (
                <button key={m} onClick={() => setStartMode(m)}
                  className={`cursor-pointer rounded-xl border p-3 text-left transition-all ${
                    active ? 'border-violet-500 bg-violet-50/60 dark:border-violet-400 dark:bg-violet-500/10' : 'border-gray-200 hover:border-gray-300 dark:border-white/10'
                  }`}>
                  <div className={`text-sm font-semibold ${active ? 'text-violet-600 dark:text-violet-300' : 'text-gray-800 dark:text-gray-100'}`}>{m}</div>
                  <div className="mt-0.5 text-xs text-gray-400">{n}题</div>
                </button>
              )
            })}
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50/60 px-4 py-2.5 text-sm text-violet-600 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300">
            <b>{startMode}模式待复习</b>
            <span className="text-violet-500/80">· 系统推荐 {total} 题</span>
            <div className="flex-1" />
            <b>{Math.min(settings[startMode] || 10, total)}题</b>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-gray-400">基于艾宾浩斯遗忘曲线，系统会智能安排复习时间，让你用更少的时间，记住更多内容。开通会员解锁智能推荐。</p>
          <div className="mt-5 flex gap-3">
            <button className={`${ghost} flex-1 text-violet-600 dark:text-violet-400`} onClick={() => {
              const pool = startMode ? sorted.filter(w => (w.modes || []).includes(startMode)) : sorted
              startReview(pool.length ? pool : sorted)
            }}>手动选择</button>
            <button className={`${ghost} flex-1`} onClick={() => alert('会员功能暂未开放')}>👑 开通会员</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// 选项按钮（简约）
const optBtn = (active, locked) => `flex w-full items-center justify-between cursor-pointer rounded-lg border px-3 py-2.5 text-sm transition-colors ${
  active ? 'border-violet-500 bg-violet-50/60 text-violet-600 dark:border-violet-400 dark:bg-violet-500/10 dark:text-violet-300' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-white/10 dark:bg-transparent dark:text-gray-300'
}${locked && !active ? ' opacity-60' : ''}`

// ---------------- 弹窗骨架（与生词本一致） ----------------
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" style={{ animation: 'vb-fadeIn .18s ease' }} onClick={onClose}>
      <style>{`
        @keyframes vb-fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes vb-popIn { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
      <div onClick={e => e.stopPropagation()} className="max-h-[86vh] w-full max-w-md overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-[0_16px_50px_rgba(15,23,42,.16)] dark:border-white/10 dark:bg-[#151519] dark:shadow-[0_16px_50px_rgba(0,0,0,.5)]" style={{ animation: 'vb-popIn .22s ease' }}>
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
