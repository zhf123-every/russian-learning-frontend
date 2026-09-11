import { useNavigate } from 'react-router-dom'

export default function HomePage() {
  const navigate = useNavigate()

  const cards = [
    {
      title: '自定义素材',
      sub: '上传 / 粘贴视频生成学习材料',
      desc: '导入你自己的视频或字幕，自动断句，逐句听写、跟读、循环训练。',
      route: '/custom',
      primary: true,
    },
    {
      title: '分级课程',
      sub: '尚雯婕学习法 · 学习广场',
      desc: '从 A1 到 B2 系统训练短句，或到学习广场浏览精选公开素材。',
      route: '/course',
      primary: false,
    },
    {
      title: '俄语AI对话教练',
      sub: '开口说 · 实时纠错 · 语音陪练',
      desc: '和AI老师自由聊天，分A1-B2四个等级，说错就纠正语法并引导你重说。',
      route: '/tutor',
      primary: false,
    },
  ]

  return (
    <div className="landing">
      <div className="landing-head">
        <div className="landing-logo">📖</div>
        <h1>Russian Learning</h1>
        <p>选择一种学习方式，开始今天的俄语训练</p>
      </div>
      <div className="landing-cards">
        {cards.map(c => (
          <div
            key={c.title}
            className={'landing-card' + (c.primary ? '' : ' secondary')}
            onClick={() => navigate(c.route)}
          >
            <h2>{c.title}</h2>
            <div className="sub">{c.sub}</div>
            <p>{c.desc}</p>
            <div className="go">进入学习</div>
          </div>
        ))}
      </div>
    </div>
  )
}
