import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { TABBAR } from '../../constants/navConfig'
import { NavList } from './SideNav'

// 根据路径高亮底部对应 Tab（学习/工具是分组，覆盖其子页面）
function activeTab(pathname) {
  if (pathname === '/') return '/'
  if (pathname.startsWith('/me')) return '/me'
  if (/^\/(vocab|dictionary|profile|tools)/.test(pathname)) return '/tools'
  if (/^\/(learn|quest|square|study|tutor)/.test(pathname)) return '/learn'
  return '/'
}

export default function MobileNav() {
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  const cur = activeTab(loc.pathname)

  return (
    <>
      <header className="db-topbar">
        <button className="menu" onClick={() => setOpen(true)} aria-label="打开菜单">☰</button>
        <div className="tbrand"><span className="mark ru">А</span>俄语学习</div>
        <div className="sp" />
      </header>

      <div className={'db-drawer' + (open ? ' open' : '')}>
        <div className="mask" onClick={() => setOpen(false)} />
        <div className="panel" role="navigation">
          <div className="d-logo"><span className="mark ru">А</span>俄语学习</div>
          <NavList onNavigate={() => setOpen(false)} />
        </div>
      </div>

      <nav className="db-tabbar">
        {TABBAR.map((t) => (
          t.soon ? (
            <span key={t.to} className="db-tab soon" title="即将上线">
              <span className="tic">{t.icon}</span>
              {t.label}
            </span>
          ) : (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={cur === t.to ? 'active' : ''}
            >
              <span className="tic">{t.icon}</span>
              {t.label}
            </NavLink>
          )
        ))}
      </nav>
    </>
  )
}
