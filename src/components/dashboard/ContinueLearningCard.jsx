import { useNavigate, Link } from 'react-router-dom'

// 首页主 CTA。
// 两种形态：
//  1) 无学习记录（零进度 / 加载中 / 加载失败）→「开始你的第一课」引导卡：
//     · 主按钮一键直达 Урок 1 答题页 /quest-practice/u1
//     · 卡片下方小字链接进入课程包单元列表页（想看课程结构的用户入口）
//  2) 有进度（进行中或已完成若干单元）→「继续学习」卡，显示进度，点击进入当前单元答题
// 设计目标：首屏立即渲染引导卡，不被后端冷启动（Render 免费版 20s+）阻塞，也不出现空白。
export default function ContinueLearningCard({ loading, error, pack, target, completed, total, onRetry }) {
  const navigate = useNavigate()

  const packId = pack?.id || 'privet_rossiya_a1'
  const packTitle = pack?.title || 'Привет, Россия! A1'
  const t = target || { id: 'u1', title: 'Урок 1', subtitle: '', step_count: null, status: '未开始' }

  const hasProgress = (total || 0) > 0 && ((completed || 0) > 0 || t.status === '进行中')

  // 引导卡：零记录 / 加载中 / 失败都稳定显示
  if (!hasProgress) {
    const sub = loading
      ? '正在准备你的课程…'
      : error
        ? '从 Урок 1 开始学俄语'
        : `从 ${t.title || 'Урок 1'} 开始学俄语`
    return (
      <>
        <button className="db-continue" onClick={() => navigate(`/quest-practice/${t.id || 'u1'}`)}>
          <span className="ck ru">П</span>
          <span className="grow">
            <span className="pack" style={{ display: 'block' }}>
              {packTitle}{total ? `　·　${total} 个单元` : ''}
            </span>
            <span className="lesson" style={{ display: 'block' }}>开始你的第一课</span>
            <span className="pct" style={{ display: 'block' }}>{sub}</span>
          </span>
          <span className="go">开始 →</span>
        </button>
        <div style={{ textAlign: 'right', marginTop: 8, paddingRight: 4 }}>
          <Link
            to={`/quest/${packId}`}
            style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--db-text-2)', textDecoration: 'none' }}
          >
            查看全部 {total || 12} 个单元 →
          </Link>
        </div>
      </>
    )
  }

  // 继续学习卡：存在真实进度
  const done = completed || 0
  const pct = Math.min(100, Math.round((done / total) * 100))
  const inProgress = t.status === '进行中'
  const btn = t.status === '已完成' ? '复习' : '继续'
  const statusText =
    t.status === '已完成' ? '本单元已完成'
      : inProgress ? '进行中…'
        : `${t.step_count ? `共 ${t.step_count} 步 · ` : ''}尚未开始`

  return (
    <button className="db-continue" onClick={() => navigate(`/quest-practice/${t.id || 'u1'}`)}>
      <span className="ck ru">П</span>
      <span className="grow">
        <span className="pack" style={{ display: 'block' }}>
          继续学习　·　{packTitle}　·　{done}/{total} 单元完成
        </span>
        <span className="lesson ru" style={{ display: 'block' }}>{t.title}</span>
        <span className="db-track" style={{ display: 'block' }}>
          <i style={{ width: inProgress ? '15%' : pct + '%' }} className={inProgress ? 'indeterminate' : ''} />
        </span>
        <span className="pct" style={{ display: 'block' }}>
          {t.subtitle ? t.subtitle + ' · ' : ''}{statusText}
        </span>
      </span>
      <span className="go">{btn} →</span>
    </button>
  )
}
