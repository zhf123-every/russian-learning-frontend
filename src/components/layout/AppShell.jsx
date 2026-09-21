import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import SideNav from './SideNav'
import MobileNav from './MobileNav'
import TopBar from './TopBar'

// 浏览类页面的统一外壳：桌面左侧栏，手机顶栏+抽屉+底部Tab。
// 全屏答题页（/quest-practice*、/quest-dictation*、/test-practice、/square/:id、/study/:id）
// 在 App.jsx 中作为布局外的独立路由，不套此壳。
export default function AppShell() {
  // 桌面端侧边栏折叠（完全隐藏）；移动端不受影响，仍用 MobileNav 的抽屉
  const [collapsed, setCollapsed] = useState(false)
  return (
    <div className={'app-shell' + (collapsed ? ' shell-collapsed' : '')}>
      <SideNav />
      <MobileNav />
      <main className="shell-main">
        <TopBar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
        <Outlet />
      </main>
    </div>
  )
}
