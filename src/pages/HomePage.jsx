import { useNavigate } from 'react-router-dom'

export default function HomePage() {
  const navigate = useNavigate()

  const cards = [
    {
      title: '自定义素材',
      sub: '上传 / 粘贴视频生成学习材料',
      desc: '导入你自己的视频或字幕，自动断句，逐句听写、跟读、循环训练。',
      route: '/custom',
      icon: '🎬',
      tint: '#F0E8DC',
      tag: '自由导入',
    },
    {
      title: '分级课程',
      sub: '尚雯婕学习法 · 学习广场',
      desc: '从 A1 到 B2 系统训练短句，或到学习广场浏览精选公开素材。',
      route: '/course',
      icon: '📚',
      tint: '#E8E3D9',
      tag: '系统训练',
    },
    {
      title: '俄语AI对话教练',
      sub: '开口说 · 实时纠错 · 语音陪练',
      desc: '和AI老师自由聊天，分A1-B2四个等级，说错就纠正语法并引导你重说。',
      route: '/tutor',
      icon: '🗣️',
      tint: '#F3E9DE',
      tag: '智能陪练',
    },
  ]

  return (
    <div className="home">
      {/* 顶部品牌区 */}
      <div className="home-hero">
        <div className="hero-badge">
          <span className="hero-badge-dot"></span>
          Изучаем русский язык
        </div>
        <h1 className="hero-title">
          Russian<span className="hero-accent">Learning</span>
        </h1>
        <p className="hero-sub">选择一种学习方式，开始今天的俄语训练</p>
        <div className="hero-deco" aria-hidden="true">
          <span>А</span><span>Б</span><span>В</span><span>Г</span><span>Д</span><span>Е</span><span>Ё</span><span>Ж</span>
        </div>
      </div>

      {/* 功能卡片区 */}
      <div className="home-cards">
        {cards.map(c => (
          <div
            key={c.title}
            className="home-card"
            onClick={() => navigate(c.route)}
          >
            <div className="home-card-top">
              <div className="home-card-icon" style={{ background: c.tint }}>{c.icon}</div>
              <span className="home-card-tag">{c.tag}</span>
            </div>
            <h2>{c.title}</h2>
            <div className="home-card-sub">{c.sub}</div>
            <p>{c.desc}</p>
            <div className="home-card-btn">
              进入学习
              <span className="btn-arrow">→</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
