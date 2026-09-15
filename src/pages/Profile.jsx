import { LEVELS } from '../data/courseLibrary'
import { useCourseStore } from '../store/courseStore'
import { useVocabStore } from '../store/vocabStore'
import CheckInPanel from '../components/quest/CheckInPanel'
import CalendarGraph from '../components/quest/CalendarGraph'

export default function Profile() {
  const progress = useCourseStore(s => s.progress)
  const levelMastery = useCourseStore(s => s.levelMastery)
  const isLevelUnlocked = useCourseStore(s => s.isLevelUnlocked)
  const cards = useVocabStore(s => s.cards)

  const doneVideos = Object.values(progress).filter(p => p.done).length
  let practiced = 0
  for (const p of Object.values(progress)) practiced += Object.keys(p.sentenceScores || {}).length

  const days = new Set(Object.values(progress).map(p => new Date(p.updatedAt).toDateString()))
  const sortedDays = [...days].map(d => new Date(d)).sort((a, b) => a - b)
  let streak = 0
  for (let i = sortedDays.length - 1; i >= 0; i--) {
    if (i === sortedDays.length - 1) { streak = 1; continue }
    const gap = Math.round((sortedDays[i + 1] - sortedDays[i]) / 86400000)
    if (gap === 1) streak++
    else break
  }

  return (
    <div className="course" style={{ maxWidth: 900, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 20 }}>📊 学习中心</h2>

      {/* 核心统计卡片 */}
      <div className="videos-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', marginBottom: 24 }}>
        <div className="card"><div className="score-big">{days.size}</div><div className="hint">学习天数</div></div>
        <div className="card"><div className="score-big" style={{ color: '#8b5cf6' }}>{streak}</div><div className="hint">连续打卡</div></div>
        <div className="card"><div className="score-big">{practiced}</div><div className="hint">练习句子数</div></div>
        <div className="card"><div className="score-big">{doneVideos}</div><div className="hint">完成视频数</div></div>
        <div className="card"><div className="score-big">{cards.length}</div><div className="hint">生词总数</div></div>
      </div>

      {/* 签到面板 */}
      <div style={{ marginBottom: 24 }}>
        <CheckInPanel theme="light" />
      </div>

      {/* 年度学习热力图 */}
      <div style={{ marginBottom: 24 }}>
        <CalendarGraph theme="light" />
      </div>

      {/* 各级掌握度 */}
      <h3 style={{ marginBottom: 12 }}>🎯 各级掌握度</h3>
      {LEVELS.map(l => (
        <div key={l} className="course-item" style={{ cursor: 'default' }}>
          <span className="t">{l}</span>
          <span className="hint">{isLevelUnlocked(l) ? `掌握 ${levelMastery(l)}%` : '🔒 未解锁'}</span>
        </div>
      ))}

      {/* 功能入口 */}
      <div style={{ marginTop: 32, padding: 20, borderRadius: 14, background: '#f9fafb', border: '1px solid #e5e7eb' }}>
        <h3 style={{ margin: '0 0 12px' }}>🔗 快捷入口</h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a href="/vocab" className="btn sm" style={{ textDecoration: 'none' }}>📚 生词本 / FSRS复习</a>
          <a href="/quest" className="btn sm primary" style={{ textDecoration: 'none' }}>🎮 俄语闯关</a>
          <a href="/dictionary" className="btn sm" style={{ textDecoration: 'none' }}>📖 词典</a>
          <a href="/" className="btn sm" style={{ textDecoration: 'none' }}>🏠 首页</a>
        </div>
      </div>
    </div>
  )
}
