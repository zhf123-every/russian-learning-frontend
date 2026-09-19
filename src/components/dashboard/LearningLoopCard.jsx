import { useNavigate } from 'react-router-dom'

const STAGES = [
  {
    icon: '🎧', tone: 'brand', tag: '输入',
    title: '五步精听',
    desc: '盲听 · 听写 · 精读 · 跟读 · 复述，吃透一段真实俄语视频',
    to: '/square',
  },
  {
    icon: '🎮', tone: 'brand', tag: '内化',
    title: '游戏化闯关',
    desc: '逐词打字、连击激励、SSS 评级，把句子练到形成肌肉记忆',
    to: '/quest-store',
  },
  {
    icon: '🗣️', tone: 'ok', tag: '输出',
    title: 'AI 对话教练',
    desc: '任意话题自由对话，实时纠错讲语法，把学过的真正说出口',
    to: '/tutor',
  },
]

// 学习法闭环导览：一套素材走通“输入 → 内化 → 输出”
export default function LearningLoopCard() {
  const navigate = useNavigate()
  return (
    <div className="db-card">
      <div className="pad">
        <div className="db-sec-title" style={{ marginBottom: 4 }}>一套素材，走通输入到输出</div>
        <div className="db-sec-cap" style={{ marginBottom: 14 }}>先听懂、再练熟、最后说出口，形成完整学习闭环</div>
        <div className="ll-list">
          {STAGES.map((s, i) => (
            <button key={s.tag} className={'ll-item ll-' + s.tone} onClick={() => navigate(s.to)}>
              <span className="ll-ic">{s.icon}</span>
              <span className="ll-body">
                <span className="ll-h"><span className={'ll-tag k-' + s.tone}>{s.tag}</span>{s.title}</span>
                <span className="ll-d">{s.desc}</span>
              </span>
              <span className="ll-arrow">→</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
