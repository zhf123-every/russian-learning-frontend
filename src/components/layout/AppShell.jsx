import { Outlet } from 'react-router-dom'
import SideNav from './SideNav'
import MobileNav from './MobileNav'

// 浏览类页面的统一外壳：桌面左侧栏，手机顶栏+抽屉+底部Tab。
// 全屏答题页（/quest-practice*、/quest-dictation*、/test-practice、/square/:id、/study/:id）
// 在 App.jsx 中作为布局外的独立路由，不套此壳。
export default function AppShell() {
  return (
    <div className="app-shell">
      <SideNav />
      <MobileNav />
      <main className="shell-main">
        <Outlet />
      </main>
    </div>
  )
}
