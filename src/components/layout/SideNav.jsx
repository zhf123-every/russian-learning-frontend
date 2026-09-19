import { NavLink } from 'react-router-dom'
import { NAV_GROUPS } from '../../constants/navConfig'

function NavItem({ item, onNavigate, badges }) {
  const badge = item.badgeKey && badges && badges[item.badgeKey]
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) => 'db-navitem' + (isActive ? ' active' : '')}
    >
      <span className="ic">{item.icon}</span>
      {item.label}
      {badge ? <span className="db-badge">{badge}</span> : null}
    </NavLink>
  )
}

// 桌面侧栏与手机抽屉共用的导航列表
export function NavList({ onNavigate, badges }) {
  return (
    <>
      {NAV_GROUPS.map((g) => {
        if (g.type === 'item') {
          return <NavItem key={g.to} item={g} onNavigate={onNavigate} badges={badges} />
        }
        return (
          <div key={g.label}>
            <div className="db-navgroup">{g.label}</div>
            {g.items.map((it) => (
              <NavItem key={it.to} item={it} onNavigate={onNavigate} badges={badges} />
            ))}
          </div>
        )
      })}
    </>
  )
}

export default function SideNav() {
  return (
    <aside className="db-sidenav">
      <div className="db-logo">
        <span className="mark ru">А</span>
        俄语学习
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column' }}>
        <NavList />
      </nav>
      <div className="db-sidefoot">
        <div className="t">今日目标 <span>3/5</span></div>
        <div className="row">
          <svg className="ring" viewBox="0 0 36 36" aria-hidden="true">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="#ECECEF" strokeWidth="4" />
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="#4F46E5" strokeWidth="4"
              strokeLinecap="round" strokeDasharray="58.4 97.4" transform="rotate(-90 18 18)" />
          </svg>
          <div className="tip">再完成 2 步<br />达成今日目标</div>
        </div>
      </div>
    </aside>
  )
}
