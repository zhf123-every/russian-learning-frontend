import { Link } from 'react-router-dom'

// 今日学习闭环：复习 / 精听 / AI（替代打卡积分任务，直接进学习）
const ACTIONS = [
  { to: '/vocab', icon: '📒', title: '复习到期生词', sub: 'SRS 间隔重复', tone: { bg: 'var(--db-danger-soft)', color: 'var(--db-danger)' } },
  { to: '/square', icon: '🎧', title: '精听 1 段', sub: '五步精听', tone: { bg: 'var(--db-brand-soft)', color: 'var(--db-brand)' } },
  { to: '/tutor', icon: '🗣️', title: 'AI 说 3 句', sub: '对话教练', tone: { bg: 'var(--db-card-2)', color: 'var(--db-text-2)' } },
]

export default function TodayActions() {
  return (
    <div>
      <div className="db-sec-title" style={{ marginBottom: 10 }}>今日学习闭环</div>
      <div className="db-actions">
        {ACTIONS.map((a) => (
          <Link className="db-act" to={a.to} key={a.to}>
            <span className="ai" style={{ background: a.tone.bg, color: a.tone.color }}>{a.icon}</span>
            <span>
              <span className="at" style={{ display: 'block' }}>{a.title}</span>
              <span className="ad" style={{ display: 'block' }}>{a.sub}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
