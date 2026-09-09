import { useState } from 'react'
import { useVocabStore } from '../store/vocabStore'
import { RATING } from '../lib/fsrs'
import { speak } from '../lib/tts'
import AddVocabModal from '../components/AddVocabModal'

const GRADES = [
  { r: RATING.again, label: '忘记' }, { r: RATING.hard, label: '困难' },
  { r: RATING.good, label: '记得' }, { r: RATING.easy, label: '轻松' }
]

export default function Vocab() {
  const cards = useVocabStore(s => s.cards)
  const due = useVocabStore(s => s.dueCards())
  const review = useVocabStore(s => s.review)
  const removeCard = useVocabStore(s => s.remove)
  const [showAdd, setShowAdd] = useState(false)
  const [show, setShow] = useState(false)
  const [i, setI] = useState(0)
  const [tab, setTab] = useState('review') // review | all

  const card = due[i] || due[0]
  const rate = (r) => { review(card.id, r); setShow(false); setI(0) }

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      {/* 顶部标题和操作 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0 }}>📚 生词本</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--muted, #86796D)', fontSize: 14 }}>
            共 {cards.length} 个生词 · 今日待复习 {due.length} 个
          </p>
        </div>
        <button className="btn primary" onClick={() => setShowAdd(true)}>＋ 添加生词</button>
      </div>

      {/* Tab 切换 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          className={`btn sm ${tab === 'review' ? 'primary' : ''}`}
          onClick={() => setTab('review')}
        >
          今日复习 ({due.length})
        </button>
        <button
          className={`btn sm ${tab === 'all' ? 'primary' : ''}`}
          onClick={() => setTab('all')}
        >
          全部生词 ({cards.length})
        </button>
      </div>

      {/* 复习模式 */}
      {tab === 'review' && (
        due.length === 0 ? (
          <div className="empty" style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
            <h3>今天没有待复习的生词</h3>
            <p style={{ color: 'var(--muted, #86796D)' }}>可以去学习页面点击单词添加新生词，或手动添加。</p>
          </div>
        ) : (
          <div className="modal" style={{ maxWidth: 460, margin: '0 auto' }}>
            <h3>生词复习</h3>
            <div className="srs-card">
              <div className="q" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <span className="w ru">{card.word}</span>
                <button
                  className="btn sm"
                  style={{ padding: '2px 8px', fontSize: 16 }}
                  onClick={(e) => { e.stopPropagation(); speak(card.word, { rate: 0.8 }) }}
                  title="读音"
                >
                  🔊
                </button>
              </div>
              {card.reading && <div style={{ fontSize: 15, color: '#B87333', marginTop: 6, fontWeight: 500 }}>{card.reading}</div>}
              {show && <div className="a">{card.chinese}</div>}
              {!show && <button className="btn primary" onClick={() => setShow(true)}>显示答案</button>}
              {show && (
                <div className="srs-grades">
                  {GRADES.map(g => <button key={g.label} className="grade" onClick={() => rate(g.r)}>{g.label}</button>)}
                </div>
              )}
            </div>
            <div className="srs-stats">今日待复习 {due.length} 个 · 第 {Math.min(i + 1, due.length)} / {due.length} 个</div>
            {due.length > 1 && (
              <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'center' }}>
                <button className="btn sm" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0}>← 上一个</button>
                <button className="btn sm" onClick={() => setI(Math.min(due.length - 1, i + 1))} disabled={i >= due.length - 1}>下一个 →</button>
              </div>
            )}
          </div>
        )
      )}

      {/* 全部生词列表 */}
      {tab === 'all' && (
        cards.length === 0 ? (
          <div className="empty" style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📝</div>
            <h3>还没有生词</h3>
            <p style={{ color: 'var(--muted, #86796D)' }}>点击右上角"添加生词"手动添加，或在学习页面点击单词添加。</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {cards.map((c, idx) => (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 16px',
                  background: 'var(--card, #fff)',
                  border: '1px solid var(--border2, #E0D6C4)',
                  borderRadius: 8,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 16 }} className="ru">{c.word}</span>
                    <button
                      className="btn sm"
                      style={{ padding: '1px 6px', fontSize: 14 }}
                      onClick={() => speak(c.word, { rate: 0.8 })}
                      title="读音"
                    >
                      🔊
                    </button>
                  </div>
                  {c.reading && <div style={{ fontSize: 13, color: '#B87333', marginTop: 2, fontWeight: 500 }}>{c.reading}</div>}
                  <div style={{ fontSize: 14, color: 'var(--muted, #86796D)', marginTop: 2 }}>{c.chinese}</div>
                </div>
                {c.pos && <span style={{ fontSize: 12, padding: '2px 8px', background: 'var(--soft, #F5EDE0)', borderRadius: 4, marginRight: 8 }}>{c.pos}</span>}
                <button
                  className="btn sm"
                  style={{ color: '#C0392B', borderColor: '#E0D6C4' }}
                  onClick={() => {
                    if (window.confirm(`确定删除生词"${c.word}"吗？`)) {
                      removeCard(c.id)
                    }
                  }}
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        )
      )}

      {/* 添加生词弹窗 */}
      {showAdd && <AddVocabModal onClose={() => setShowAdd(false)} />}
    </div>
  )
}
