import { Link } from 'react-router-dom'

function Card({ title, children }) {
  return (
    <div className="db-card">
      <div className="pad">
        <div className="db-sec-title" style={{ marginBottom: 12 }}>{title}</div>
        {children}
      </div>
    </div>
  )
}

function Row({ to, icon, title, sub, tone = 'brand' }) {
  return (
    <Link className={'qt-row qt-' + tone} to={to}>
      <span className="qt-ic">{icon}</span>
      <span className="qt-txt">
        <span className="qt-t">{title}</span>
        <span className="qt-s">{sub}</span>
      </span>
      <span className="qt-arrow">→</span>
    </Link>
  )
}

// 学习舱侧栏：全部为真实可用入口，无占位假数据
export default function QuickTools() {
  return (
    <>
      <Card title="学习工具">
        <div className="qt-list">
          <Row to="/vocab" icon="📒" title="生词本" sub="SRS 间隔重复复习" tone="amber" />
          <Row to="/dictionary" icon="🔎" title="词典" sub="重音 · 变格 · 例句" tone="brand" />
          <Row to="/profile" icon="📊" title="学习统计" sub="数据与掌握情况" tone="ok" />
        </div>
      </Card>

      <Card title="训练场">
        <div className="qt-list">
          <Row to="/quest-store" icon="🎮" title="课程中心" sub="体系句子课 · 闯关" tone="brand" />
          <Row to="/square" icon="🎬" title="视频广场" sub="真实语料五步精听" tone="brand" />
          <Row to="/tutor" icon="🗣️" title="AI 对话教练" sub="A1–B2 口语陪练" tone="ok" />
        </div>
      </Card>
    </>
  )
}
