import { useNavigate } from 'react-router-dom'
import CalendarGraph from '../components/quest/CalendarGraph'

// 最近使用的课程包（无后端，用现有路由渲染 3 个入口）
const recentPacks = [
  {
    title: '自定义素材',
    desc: '上传 / 粘贴视频生成学习材料，自动断句、逐句听写与跟读训练。',
    route: '/custom',
    icon: '🎬',
  },
  {
    title: '分级课程',
    desc: '尚雯婕学习法，从 A1 到 B2 系统训练短句，或到学习广场浏览精选素材。',
    route: '/course',
    icon: '📚',
  },
  {
    title: '俄语闯关',
    desc: '像玩游戏一样用句子学俄语：打乱单词连成句，Perfect 连击，SSS 评级。',
    route: '/quest',
    icon: '🎯',
  },
]

// 功能入口卡（保留原有四个入口）
const featureCards = [
  {
    title: '自定义素材',
    sub: '上传 / 粘贴视频生成学习材料',
    route: '/custom',
    icon: '🎬',
  },
  {
    title: '分级课程',
    sub: '尚雯婕学习法 · 学习广场',
    route: '/course',
    icon: '📚',
  },
  {
    title: '俄语闯关',
    sub: '连词成句 · 连击评分 · 句子拆解',
    route: '/quest',
    icon: '🎯',
  },
  {
    title: 'AI 对话教练',
    sub: '开口说 · 实时纠错 · 语音陪练',
    route: '/tutor',
    icon: '🗣️',
  },
]

export default function HomePage() {
  const navigate = useNavigate()

  return (
    <>
      {/* 主体：左头像栏 + 右内容（对齐 Earthworm Home） */}
      <div className="hw-home">
        {/* 左侧头像区 */}
        <aside className="hw-side">
          <div className="hw-avatar">👤</div>
          <div className="hw-username">俄语学习者</div>
          <div className="hw-subname">Привет! Давай учиться</div>
          <hr className="hw-divider" />
        </aside>

        {/* 右侧内容区 */}
        <div className="hw-main">
          <div className="hw-section-head">
            <h2 className="hw-section-title">最近使用的课程包</h2>
            <a className="hw-more" href="/course" onClick={(e) => { e.preventDefault(); navigate('/course') }}>
              更多 →
            </a>
          </div>

          <div className="hw-packs">
            {recentPacks.map((p) => (
              <div key={p.title} className="hw-pack" onClick={() => navigate(p.route)}>
                <div className="hw-pack-cover">{p.icon}</div>
                <div className="hw-pack-body">
                  <h3 className="hw-pack-title">{p.title}</h3>
                  <p className="hw-pack-desc">{p.desc}</p>
                  <div className="hw-pack-actions">
                    <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); navigate(p.route) }}>
                      打开
                    </button>
                    <button className="btn btn-sm primary" onClick={(e) => { e.stopPropagation(); navigate(p.route) }}>
                      继续学习
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="hw-calendar">
            <CalendarGraph theme="light" />
          </div>
        </div>
      </div>

      {/* 功能入口区（保留） */}
      <section className="hw-features">
        <h2 className="hw-features-title">选择学习方式</h2>
        <div className="hw-feature-grid">
          {featureCards.map((c) => (
            <div key={c.title} className="hw-feature" onClick={() => navigate(c.route)}>
              <div className="hw-feature-icon">{c.icon}</div>
              <h3>{c.title}</h3>
              <p>{c.sub}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
