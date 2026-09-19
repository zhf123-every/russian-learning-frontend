import { useNavigate } from 'react-router-dom'

// 继续学习主 CTA：数据来自 /api/course-packs + units（真实单元状态）
export default function ContinueLearningCard({ loading, error, pack, target, completed, total, onRetry }) {
  const navigate = useNavigate()

  const packTitle = pack?.title || 'Привет, Россия! A1'
  const t = target || { id: 'u1', title: 'Урок 1', subtitle: '', step_count: null, status: '未开始' }
  const status = t.status || '未开始'

  const width = status === '已完成' ? 100 : status === '进行中' ? null : 0
  const btn = status === '进行中' ? '继续' : status === '已完成' ? '复习' : '开始'
  const statusText =
    status === '已完成' ? '本单元已完成'
    : status === '进行中' ? '进行中…'
    : `${t.step_count ? `共 ${t.step_count} 步 · ` : ''}尚未开始`

  const go = () => navigate(`/quest-practice/${t.id || 'u1'}`)

  return (
    <button className="db-continue" onClick={go}>
      <span className="ck ru">П</span>
      <span className="grow">
        <span className="pack" style={{ display: 'block' }}>
          {loading ? '加载课程…' : packTitle}
          {!loading && total ? `　·　${completed || 0}/${total} 单元完成` : ''}
        </span>
        <span className="lesson ru" style={{ display: 'block' }}>{t.title}</span>
        <span className="db-track" style={{ display: 'block' }}>
          <i style={{ width: width === null ? '15%' : width + '%' }} className={width === null ? 'indeterminate' : ''} />
        </span>
        <span className="pct" style={{ display: 'block' }}>
          {error ? '课程加载失败，点击仍可从 Урок 1 开始' : `${t.subtitle ? t.subtitle + ' · ' : ''}${statusText}`}
        </span>
      </span>
      <span className="go">{btn} →</span>
      {error && onRetry ? (
        <span className="go" onClick={(e) => { e.stopPropagation(); onRetry() }} style={{ background: 'rgba(255,255,255,.2)', color: '#fff' }}>重试</span>
      ) : null}
    </button>
  )
}
