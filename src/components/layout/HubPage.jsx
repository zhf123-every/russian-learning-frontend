import { Link } from 'react-router-dom'

// 学习 / 工具 / 我的 落地页通用布局
export default function HubPage({ title, subtitle, cards }) {
  return (
    <div className="db-page">
      <div className="db-container">
        <div className="hub-head">
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <div className="hub-grid">
          {cards.map((c) => (
            c.to ? (
              <Link className="hub-card" to={c.to} key={c.title}>
                <span className="hub-icon" style={{ background: c.tone.bg, color: c.tone.color }}>{c.icon}</span>
                <h2>{c.title}</h2>
                <div className="hd">{c.desc}</div>
                {c.tags ? (
                  <div className="hub-tags">{c.tags.map((t) => <span className="hub-tag" key={t}>{t}</span>)}</div>
                ) : null}
                <div className="hfoot"><span>进入</span><span>→</span></div>
              </Link>
            ) : (
              <div className="hub-card disabled" key={c.title}>
                <span className="hub-icon" style={{ background: 'var(--db-card-2)', color: 'var(--db-text-3)' }}>{c.icon}</span>
                <h2>{c.title}</h2>
                <div className="hd">{c.desc}</div>
                <div className="hfoot"><span className="soon">{c.soon || '即将上线'}</span></div>
              </div>
            )
          ))}
        </div>
      </div>
    </div>
  )
}
