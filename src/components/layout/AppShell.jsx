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
        <main className="shell-main" style={{ flex: 1, minWidth: 0, background: '#f5f5f5' }}>
          {/* 内容区整体背景容器：页眉 + 卡片连在一起 */}
          <div style={{ background: '#fff', minHeight: '100%' }}>
            {/* 内容页页眉 */}
            <div style={{ height: 56, display: 'flex', alignItems: 'center', gap: 12, padding: '0 24px', borderBottom: '1px solid #f0f0f0' }}>
              <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>📋 我的主页</h1>
              <div style={{ flex: 1 }} />
              <button style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid #eee', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} onClick={() => setCollapsed(v => !v)}>◧</button>
              <button style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid #eee', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>⚙</button>
            </div>
            <Outlet />
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  )
}
