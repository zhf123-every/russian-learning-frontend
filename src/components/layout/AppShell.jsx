import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import SideNav from './SideNav'
import MobileNav from './MobileNav'
import TopBar from './TopBar'

export default function AppShell() {
  const [collapsed, setCollapsed] = useState(false)
  useEffect(() => {
    const handler = () => setCollapsed((v) => !v)
    window.addEventListener('app:toggle-sidebar', handler)
    return () => window.removeEventListener('app:toggle-sidebar', handler)
  }, [])
  return (
    <div className={'app-shell' + (collapsed ? ' shell-collapsed' : '')}>
      {/* 顶栏横跨全宽（含侧边栏上方） */}
      <TopBar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
      {/* 顶栏下面：左侧边栏 + 右内容 */}
      <div className="shell-body" style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <SideNav />
        <main className="shell-main" style={{ flex: 1, minWidth: 0 }}>
          <Outlet />
        </main>
      </div>
      <MobileNav />
    </div>
  )
}
