import { WEEK_CHECK, HEAT_PATTERN, RECENT_ACTIVITY, STREAK_DAYS } from '../../data/dashboardPlaceholder'

function Card({ title, right, children, tag }) {
  return (
    <div className="db-card">
      <div className="pad">
        <div className="db-sec-title" style={{ display: 'flex', alignItems: 'center' }}>
          {title}
          {tag ? <span className="db-placeholder-tag">{tag}</span> : null}
          <span style={{ flex: 1 }} />
          {right}
        </div>
        {children}
      </div>
    </div>
  )
}

export default function RightRail() {
  return (
    <>
      <Card title="每日打卡" right={<span style={{ color: 'var(--db-amber)', fontWeight: 700, fontSize: 13 }}>🔥{STREAK_DAYS}</span>}>
        <div className="db-week">
          {WEEK_CHECK.map((d, i) => (
            <div className="db-day" key={i}>
              {d.day}
              <span className={'c ' + (d.state || '')}>{d.state === 'done' ? '✓' : d.state === 'today' ? '今' : ''}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title="学习热力" right={<span style={{ color: 'var(--db-text-3)', fontWeight: 500, fontSize: 12 }}>9月</span>} tag="示例">
        <div className="db-heat">
          {HEAT_PATTERN.map((v, i) => <i key={i} className={v ? 'l' + v : ''} />)}
        </div>
      </Card>

      <Card title="最近学习" tag="示例">
        {RECENT_ACTIVITY.map((r, i) => (
          <div className="db-recent" key={i}>
            <span className="th ru" style={r.thumbTone === 'brandSoft'
              ? { background: 'var(--db-card-2)', color: 'var(--db-text-2)' }
              : undefined}>
              {r.thumb}
            </span>
            <span>
              <span className="r1" style={{ display: 'block' }}>{r.title}</span>
              <span className="r2" style={{ display: 'block' }}>{r.time}</span>
            </span>
          </div>
        ))}
      </Card>
    </>
  )
}
