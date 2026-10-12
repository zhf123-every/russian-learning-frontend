// 复习本 · 学过的所有句子（句子级卡片；同一句去重只挂一个，模式/课程标签合并）
// 路由：/vocab（侧边栏「通关存档 → 复习关卡」）
// 页眉：筛选(图2) / 复习设置(图3) / 选择(图4) / 开始复习(图5)，条目卡片包裹式（图1）
// 数据源：rlearn_review_items（中译俄/听写/听力/口语评测 答题时自动记录）
// 陌生关卡仍按单词统计（答错 ≥3 次的单词 → src/lib/wordStats.js）
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

const tagStyle = { fontSize: 11, padding: '2px 8px', borderRadius: 999, background: '#F3F4F6', color: '#6B7280' }
const btnBase = { borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', padding: '6px 12px', fontSize: 13, cursor: 'pointer', color: '#374151' }
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }
const modalStyle = { background: '#fff', borderRadius: 16, padding: 20, width: 420, maxWidth: '92vw', maxHeight: '80vh', overflowY: 'auto' }

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

  // 排序：添加时间(learnedAt) / 练习次数(correct+wrong)，降序或升序
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
    <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, border: '1px solid #E5E7EB', background: '#fff' }}>
      {selecting && (
        <div
          onClick={() => toggleSelect(c.key)}
          style={{ width: 22, height: 22, borderRadius: 11, border: selected.has(c.key) ? 'none' : '2px solid #D1D5DB', background: selected.has(c.key) ? '#7C3AED' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, cursor: 'pointer', flexShrink: 0 }}
        >{selected.has(c.key) ? '✓' : ''}</div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="ru" style={{ fontSize: 15, fontWeight: 700, color: '#18181B' }}>{c.russian}</div>
        <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{c.chinese || '—'}</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
          {(c.modes && c.modes.length ? c.modes : ['学过']).map(m => <span key={m} style={tagStyle}>{m}</span>)}
          {(c.wrongCount || 0) > 0 && <span style={{ ...tagStyle, background: '#FEF3C7', color: '#D97706' }}>答错 {c.wrongCount} 次</span>}
        </div>
        <div style={{ fontSize: 12, color: '#BBB', marginTop: 4 }}>
          {fmtDate(c.learnedAt)} 添加 · 已练习 {(c.correctCount || 0) + (c.wrongCount || 0)} 次 · 上次: {fmtDate(c.lastAt)}
        </div>
      </div>
      <button className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50" onClick={() => speak(c.russian, { rate: 0.8 })}>🔊 发音</button>
      {!selecting && (
        <button style={{ border: 'none', background: 'none', color: '#DDD', cursor: 'pointer', fontSize: 15 }} title="移除"
          onClick={() => { if (window.confirm(`确定移除「${c.russian}」吗？`)) { removeSentence(c.key); refresh() } }}
        >🗑</button>
      )}
    </div>
  )

  // ---- 翻卡复习模式 ----
  if (review) {
    const { words, i, showAns, done } = review
    const cur = words[i]
    return (
      <div style={{ padding: 16, maxWidth: 640, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <button style={btnBase} onClick={() => setReview(null)}>← 返回复习本</button>
          <div style={{ flex: 1, textAlign: 'center', fontSize: 13, color: '#999' }}>
            {done ? `复习完成 · 共 ${words.length} 个` : `第 ${i + 1} / ${words.length} 个`}
          </div>
          <div style={{ fontSize: 13, color: '#7C3AED', fontWeight: 600 }}>今日进度 {dailyDone}</div>
        </div>

        {done ? (
          <div style={{ textAlign: 'center', padding: '60px 0', background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
            <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>今日复习完成！</h3>
            <p style={{ fontSize: 13, color: '#999', marginTop: 6 }}>共复习 {words.length} 个句子，明天再来巩固</p>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB', padding: 32, textAlign: 'center' }}>
            <div className="ru" style={{ fontSize: 26, fontWeight: 700, color: '#18181B', lineHeight: 1.4 }}>{cur.russian}</div>
            <button style={{ ...btnBase, marginTop: 16 }} onClick={() => speak(cur.russian, { rate: 0.8 })}>🔊 听发音</button>
            {showAns ? (
              <div style={{ marginTop: 24 }}>
                <div style={{ fontSize: 20, fontWeight: 600, color: '#374151' }}>{cur.chinese || '暂无释义'}</div>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 10, flexWrap: 'wrap' }}>
                  {(cur.modes && cur.modes.length ? cur.modes : ['学过']).map(m => <span key={m} style={tagStyle}>{m}</span>)}
                </div>
                <div style={{ fontSize: 12, color: '#BBB', marginTop: 8 }}>
                  答对 {cur.correctCount || 0} 次 · 答错 {cur.wrongCount || 0} 次
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 24 }}>
                <button style={{ background: '#7C3AED', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 28px', fontSize: 14, cursor: 'pointer' }} onClick={reveal}>显示答案</button>
              </div>
            )}
          </div>
        )}

        {!done && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 16 }}>
            <button style={btnBase} onClick={reviewPrev} disabled={i === 0}>← 上一个</button>
            <button style={{ ...btnBase, background: '#7C3AED', color: '#fff', borderColor: '#7C3AED' }} onClick={reviewNext}>
              {i + 1 >= words.length ? '完成复习 ✓' : '下一个 →'}
            </button>
          </div>
        )}
      </div>
    )
  }

  // ---- 复习本主页面 ----
  return (
    <div style={{ padding: 16 }}>
      {/* 页眉：标题 + 全部复习/按课程包 + 筛选/复习设置/选择/开始复习 */}
      {selecting ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <span style={{ fontSize: 18, fontWeight: 700 }}>管理复习项</span>
          <button style={btnBase} onClick={selectAll}>全选</button>
          <button style={btnBase} onClick={clearSelect}>取消</button>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 13, color: '#999' }}>已选择 {selected.size} 题</span>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <span style={{ fontSize: 18, fontWeight: 700 }}>复习本</span>
          <button onClick={() => setTab('all')} style={{ ...btnBase, borderColor: tab === 'all' ? '#7C3AED' : '#E5E7EB', color: tab === 'all' ? '#7C3AED' : '#374151', fontWeight: tab === 'all' ? 600 : 400 }}>全部复习</button>
          <button onClick={() => setTab('pack')} style={{ ...btnBase, borderColor: tab === 'pack' ? '#7C3AED' : '#E5E7EB', color: tab === 'pack' ? '#7C3AED' : '#374151', fontWeight: tab === 'pack' ? 600 : 400 }}>按课程包</button>
          <div style={{ flex: 1 }} />
          <button style={btnBase} onClick={() => setShowFilter(true)}>筛选</button>
          <button style={btnBase} onClick={() => setShowSettings(true)}>复习设置</button>
          <button style={btnBase} onClick={() => setSelecting(true)}>选择</button>
          <button style={{ background: '#7C3AED', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 13, cursor: 'pointer' }} onClick={() => setShowStart(true)}>开始复习({total})</button>
        </div>
      )}
      <div style={{ fontSize: 13, color: '#999', marginBottom: 14 }}>今日进度 {dailyDone} / {total}</div>

      {total === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-20 text-center">
          <div style={{ fontSize: 52, marginBottom: 12 }}>📖</div>
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>还没有学过的句子</h3>
          <p style={{ fontSize: 13, color: '#888', marginTop: 6 }}>去中译俄 / 听写 / 听力 / 口语页练习，答过的句子会自动出现在这里</p>
        </div>
      ) : tab === 'pack' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {packGroups.map(([lesson, words]) => (
            <div key={lesson}>
              <div style={{ fontSize: 13, color: '#999', margin: '4px 4px 8px' }}>课程 {lesson} · {words.length} 个</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{words.map(card)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{sorted.map(card)}</div>
      )}

      {/* 选择模式底栏 */}
      {selecting && (
        <div style={{ position: 'sticky', bottom: 12, display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '10px 14px', marginTop: 14 }}>
          <span style={{ fontSize: 13, color: '#999' }}>已选择 {selected.size} 题</span>
          <div style={{ flex: 1 }} />
          <button style={{ ...btnBase, color: '#DC2626', borderColor: '#FECACA' }} onClick={() => { if (window.confirm(`确定删除选中的 ${selected.size} 个句子吗？`)) removeMany([...selected]) }}>删除选中</button>
          <button style={{ background: '#7C3AED', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 13, cursor: 'pointer' }} onClick={() => startReview(selectedWords)}>练习选中</button>
        </div>
      )}

      {/* 图2 筛选弹窗 */}
      {showFilter && (
        <div style={overlayStyle} onClick={() => setShowFilter(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>筛选条件</span>
              <div style={{ flex: 1 }} />
              <button style={{ border: 'none', background: 'none', fontSize: 16, color: '#999', cursor: 'pointer' }} onClick={() => setShowFilter(false)}>×</button>
            </div>
            <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 8 }}>排序方式</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              {[['added', '添加时间'], ['times', '练习次数'], ['review', '复习时间']].map(([k, label]) => (
                <div key={k} onClick={() => k !== 'review' && setSortBy(k)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, cursor: k === 'review' ? 'not-allowed' : 'pointer', background: sortBy === k ? '#F5F3FF' : '#fff', border: '1px solid', borderColor: sortBy === k ? '#C4B5FD' : '#E5E7EB' }}>
                  <span style={{ fontSize: 14, color: sortBy === k ? '#7C3AED' : '#374151' }}>{sortBy === k ? '✓' : ''} {label}</span>
                  {k === 'review' && <span style={{ fontSize: 11, color: '#D97706' }}>🔒 会员</span>}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 8 }}>排序顺序</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {[['desc', '降序'], ['asc', '升序']].map(([k, label]) => (
                <button key={k} onClick={() => setSortDir(k)} style={{ ...btnBase, flex: 1, borderColor: sortDir === k ? '#7C3AED' : '#E5E7EB', color: sortDir === k ? '#7C3AED' : '#374151', fontWeight: sortDir === k ? 600 : 400 }}>{label}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ ...btnBase, flex: 1 }} onClick={() => { setSortBy('added'); setSortDir('desc') }}>重置</button>
              <button style={{ ...btnBase, flex: 1 }} onClick={() => setShowFilter(false)}>关闭</button>
            </div>
          </div>
        </div>
      )}

      {/* 图3 复习设置弹窗 */}
      {showSettings && (
        <div style={overlayStyle} onClick={() => setShowSettings(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>复习设置</span>
              <div style={{ flex: 1 }} />
              <button style={{ border: 'none', background: 'none', fontSize: 16, color: '#999', cursor: 'pointer' }} onClick={() => setShowSettings(false)}>×</button>
            </div>
            <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 8 }}>每日复习量 · 按模式自定义</div>
            {MODES.map(m => (
              <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{m}</div>
                  <div style={{ fontSize: 12, color: '#999' }}>{m === '中译俄' ? '看中文写出俄语' : m === '听写' ? '听音频写出句子' : m === '听力' ? '盲听理解句子' : '跟读和口语练习'}</div>
                </div>
                <input
                  type="number" min={1} max={99} value={settings[m] || 10}
                  onChange={e => setSettings({ ...settings, [m]: Math.min(99, Math.max(1, parseInt(e.target.value || '10', 10))) })}
                  style={{ width: 56, padding: '6px 8px', borderRadius: 8, border: '1px solid #E5E7EB', textAlign: 'center', fontSize: 14 }}
                />
                <span style={{ fontSize: 13, color: '#999', width: 20 }}>次</span>
              </div>
            ))}
            <div style={{ fontSize: 12, color: '#BBB', marginTop: 8 }}>
              自定义时按模式分别限制，互不挪用。同一内容如果今天同时有多种模式到期，会分别计入对应模式。
            </div>

            <div style={{ fontSize: 13, color: '#6B7280', marginTop: 16, marginBottom: 8 }}>复习模式 <span style={{ fontSize: 11, color: '#D97706' }}>🔒 会员</span></div>
            <div style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #F3F4F6', background: '#F9FAFB' }}>
              <div style={{ fontSize: 13, color: '#999' }}>开通会员后可自定义复习模式，专注练习薄弱环节。</div>
              <button style={{ ...btnBase, marginTop: 8, color: '#7C3AED', borderColor: '#C4B5FD' }} onClick={() => alert('会员功能暂未开放')}>开通会员</button>
            </div>

            <div style={{ fontSize: 13, color: '#6B7280', marginTop: 16, marginBottom: 8 }}>仅复习错题 <span style={{ fontSize: 11, color: '#D97706' }}>🔒 会员</span></div>
            <div style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #F3F4F6', background: '#F9FAFB' }}>
              <div style={{ fontSize: 13, color: '#999' }}>只推荐你做错过的内容。</div>
              <button style={{ ...btnBase, marginTop: 8, color: '#7C3AED', borderColor: '#C4B5FD' }} onClick={() => alert('会员功能暂未开放')}>开通会员</button>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button style={{ ...btnBase, flex: 1 }} onClick={() => { const d = {}; MODES.forEach(m => { d[m] = 10 }); setSettings(d) }}>恢复默认</button>
              <button style={{ background: '#7C3AED', color: '#fff', border: 'none', borderRadius: 8, flex: 1, padding: '8px', fontSize: 14, cursor: 'pointer' }} onClick={() => { saveSettings(settings); setShowSettings(false) }}>保存设置</button>
            </div>
          </div>
        </div>
      )}

      {/* 图5 开始复习 → 今日推荐弹窗 */}
      {showStart && (
        <div style={overlayStyle} onClick={() => setShowStart(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>今日推荐</span>
              <div style={{ flex: 1 }} />
              <button style={{ border: 'none', background: 'none', fontSize: 16, color: '#999', cursor: 'pointer' }} onClick={() => setShowStart(false)}>×</button>
            </div>
            <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 10 }}>练习模式</div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              {MODES.map(m => {
                const n = Math.min(settings[m] || 10, total)
                const active = startMode === m
                return (
                  <div key={m} onClick={() => setStartMode(m)} style={{ flex: 1, textAlign: 'center', padding: '12px 4px', borderRadius: 12, cursor: 'pointer', border: '2px solid', borderColor: active ? '#7C3AED' : '#E5E7EB', background: active ? '#F5F3FF' : '#fff' }}>
                    <div style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? '#7C3AED' : '#374151' }}>{m}</div>
                    <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{n}题</div>
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, background: '#F5F3FF', border: '1px solid #E9D5FF', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#6D28D9' }}>{startMode}模式待复习</span>
              <span style={{ fontSize: 12, color: '#7C3AED' }}>· 系统推荐 {total}题</span>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 12, color: '#7C3AED', fontWeight: 600 }}>{Math.min(settings[startMode] || 10, total)}题</span>
            </div>
            <div style={{ fontSize: 12, color: '#BBB', marginBottom: 6 }}>
              基于艾宾浩斯遗忘曲线，系统会智能安排复习时间，让你用更少的时间，记住更多内容。
            </div>
            <div style={{ fontSize: 12, color: '#BBB', marginBottom: 16 }}>
              开通会员，解锁智能推荐，系统帮你挑出最该复习的内容。
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ ...btnBase, flex: 1, color: '#7C3AED', borderColor: '#C4B5FD' }} onClick={() => {
                const pool = startMode ? sorted.filter(w => (w.modes || []).includes(startMode)) : sorted
                startReview(pool.length ? pool : sorted)
              }}>手动选择</button>
              <button style={{ ...btnBase, flex: 1 }} onClick={() => alert('会员功能暂未开放')}>👑 开通会员</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
