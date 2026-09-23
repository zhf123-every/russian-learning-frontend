// 复习关卡 · 复习本（对照句乐部「复习本」页）
// 路由：/vocab（侧边栏「通关存档 → 复习关卡」）
// 布局：顶部标签(全部复习/按课程包) + 操作按钮(筛选/复习设置/自选练习/今日推荐)
//       + 今日进度 + 复习条目列表（类型/到期/添加时间/练习次数/上次复习/删除）
import { useState } from 'react'
import { useVocabStore } from '../store/vocabStore'
import { RATING } from '../lib/fsrs'
import { speak } from '../lib/tts'
import AddVocabModal from '../components/AddVocabModal'

const GRADES = [
  { r: RATING.again, label: '忘记' }, { r: RATING.hard, label: '困难' },
  { r: RATING.good, label: '记得' }, { r: RATING.easy, label: '轻松' }
]

// 到期文案：今天 / 明天 / N天后（对照截图）
function dueText(due) {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const d = new Date(due.getFullYear(), due.getMonth(), due.getDate())
  const days = Math.round((d - start) / 86400000)
  if (days <= 0) return { t: '今天', cls: 'text-purple-600 bg-purple-50' }
  if (days === 1) return { t: '明天', cls: 'text-amber-600 bg-amber-50' }
  return { t: `${days}天后`, cls: 'text-gray-500 bg-gray-100' }
}

// 类型标签（对照截图的口语/听写/中译英，按来源近似映射）
function typeOf(card) {
  const src = card.source || ''
  if (src.includes('dict') || src.includes('听写')) return '听写'
  if (src.includes('listen') || src.includes('square')) return '听力'
  if (src.includes('tutor') || src.includes('口语')) return '口语'
  return '中译俄'
}

function fmtDate(d) {
  if (!d) return ''
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export default function Vocab() {
  const cards = useVocabStore(s => s.cards)
  const due = useVocabStore(s => s.dueCards())
  const review = useVocabStore(s => s.review)
  const removeCard = useVocabStore(s => s.remove)
  const [showAdd, setShowAdd] = useState(false)
  const [show, setShow] = useState(false)
  const [i, setI] = useState(0)
  const [tab, setTab] = useState('all') // all 全部复习 | pack 按课程包
  const [reviewing, setReviewing] = useState(false) // 复习卡模式

  const card = due[i] || due[0]
  const rate = (r) => { if (card) { review(card.id, r); setShow(false); setI(0) } }
  const list = tab === 'pack' ? cards.filter(c => c.source) : cards

  // ---------- 复习卡模式（今日推荐进入） ----------
  if (reviewing) {
    return (
      <div style={{ padding: 16, maxWidth: 560, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <button
            onClick={() => setReviewing(false)}
            className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            ← 返回复习本
          </button>
          <span style={{ fontSize: 13, color: '#888' }}>今日待复习 {due.length} 个 · 第 {Math.min(i + 1, due.length)} / {due.length} 个</span>
        </div>
        {due.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
            <div style={{ fontSize: 44, marginBottom: 10 }}>🎉</div>
            <h3 style={{ fontSize: 16, fontWeight: 600 }}>今天没有待复习的关卡</h3>
            <p style={{ fontSize: 13, color: '#888', marginTop: 4 }}>可以去学习页面添加生词，或手动添加。</p>
            <button
              className="mt-4 rounded-lg bg-[#6d28d9] px-5 py-2 text-sm font-bold text-white hover:bg-purple-700"
              onClick={() => setShowAdd(true)}
            >添加生词</button>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <span className="ru" style={{ fontSize: 24, fontWeight: 700 }}>{card.word}</span>
                <button
                  className="rounded-md border border-gray-200 px-2 py-0.5 text-sm hover:bg-gray-50"
                  onClick={(e) => { e.stopPropagation(); speak(card.word, { rate: 0.8 }) }}
                  title="读音"
                >🔊</button>
              </div>
              {card.reading && <div style={{ fontSize: 14, color: '#B87333', marginTop: 6, fontWeight: 500 }}>{card.reading}</div>}
              {card.pos && <span style={{ display: 'inline-block', marginTop: 6, fontSize: 12, background: '#F5F5F5', padding: '2px 10px', borderRadius: 4, color: '#888' }}>{card.pos}</span>}
            </div>
            <div style={{ marginTop: 24, textAlign: 'center' }}>
              {show
                ? <div style={{ fontSize: 18, color: '#333' }}>{card.chinese}</div>
                : <button className="rounded-lg bg-[#6d28d9] px-6 py-2 text-sm font-bold text-white hover:bg-purple-700" onClick={() => setShow(true)}>显示答案</button>}
            </div>
            {show && (
              <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                {GRADES.map(g => (
                  <button key={g.label} className="rounded-lg border border-gray-200 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => rate(g.r)}>{g.label}</button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ padding: 16 }}>
      {/* ① 标签行 + 操作按钮（对照截图） */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="rounded-lg px-4 py-1.5 text-sm font-semibold"
            style={tab === 'all'
              ? { background: '#6d28d9', color: '#fff' }
              : { color: '#888' }}
            onClick={() => setTab('all')}
          >全部复习</button>
          <button
            className="rounded-lg px-4 py-1.5 text-sm font-semibold"
            style={tab === 'pack'
              ? { background: '#6d28d9', color: '#fff' }
              : { color: '#888' }}
            onClick={() => setTab('pack')}
          >按课程包</button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">筛选</button>
          <button className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">复习设置</button>
          <button className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">自选练习</button>
          <button
            className="rounded-lg bg-[#6d28d9] px-4 py-1.5 text-sm font-bold text-white hover:bg-purple-700"
            onClick={() => { setReviewing(true); setI(0); setShow(false) }}
          >今日推荐 ({due.length})</button>
        </div>
      </div>

      {/* ② 今日进度（对照截图） */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 12, border: '1px solid #E5E7EB', background: '#fff', marginBottom: 12 }}>
        <div style={{ fontSize: 14 }}>
          <span style={{ fontWeight: 700, color: '#18181B' }}>今日进度 {due.length === 0 ? 0 : 0} / {due.length}</span>
          <span style={{ fontSize: 12, color: '#BBB', marginLeft: 10 }}>完成复习可巩固记忆</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: '#999' }}>今日待复习</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#6d28d9' }}>{due.length === 0 ? 0 : Math.min(3, Math.round((due.length / Math.max(cards.length, 1)) * 100))}%</div>
        </div>
      </div>

      {/* ③ 复习条目列表（对照截图：类型/到期/添加时间/练习次数/上次复习/删除） */}
      {list.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-20 text-center">
          <div style={{ fontSize: 52, marginBottom: 12 }}>📖</div>
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>还没有复习条目</h3>
          <p style={{ fontSize: 13, color: '#888', marginTop: 6 }}>练习时收藏的生词会自动进入复习本</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map((c) => {
            const dueT = dueText(c.fsrs?.due || new Date())
            const reps = c.fsrs?.reps || 0
            return (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, border: '1px solid #E5E7EB', background: '#fff' }}>
                <div style={{ display: 'flex', gap: 6, width: 170, flexShrink: 0, flexWrap: 'wrap' }}>
                  <span className="rounded px-2 py-0.5 text-xs font-medium" style={{ background: '#F3E8FF', color: '#6d28d9' }}>{typeOf(c)}</span>
                  <span className="rounded px-2 py-0.5 text-xs font-medium" style={{ background: dueT.cls.includes('purple') ? '#F3E8FF' : dueT.cls.includes('amber') ? '#FEF3C7' : '#F3F4F6', color: dueT.cls.includes('purple') ? '#6d28d9' : dueT.cls.includes('amber') ? '#B45309' : '#6B7280' }}>{dueT.t}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="ru" style={{ fontSize: 14, fontWeight: 600, color: '#18181B' }}>{c.word}</span>
                    {c.reading && <span style={{ fontSize: 12, color: '#B87333' }}>{c.reading}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 14, fontSize: 12, color: '#BBB', marginTop: 4, flexWrap: 'wrap' }}>
                    <span>{fmtDate(c.createdAt ? new Date(c.createdAt) : new Date())} 添加</span>
                    <span>已练习 {reps} 次</span>
                    <span>{c.fsrs?.last_review ? '上次: ' + fmtDate(new Date(c.fsrs.last_review)) : ''}</span>
                  </div>
                </div>
                <button
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                  onClick={() => { setReviewing(true); setI(Math.max(0, due.findIndex(d => d.id === c.id))); setShow(false) }}
                >去复习</button>
                <button
                  style={{ border: 'none', background: 'none', color: '#DDD', cursor: 'pointer', fontSize: 14 }}
                  title="删除"
                  onClick={() => { if (window.confirm(`确定删除「${c.word}」吗？`)) removeCard(c.id) }}
                >🗑</button>
              </div>
            )
          })}
        </div>
      )}

      {showAdd && <AddVocabModal onClose={() => setShowAdd(false)} />}
    </div>
  )
}
