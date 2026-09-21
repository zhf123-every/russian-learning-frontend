// 全局顶部页眉（仅桌面显示，移动端由 MobileNav 的顶栏/抽屉承担）：
// 最左为「收起 / 展开侧边栏」按钮，右侧为头像（点击进入个人中心）；不显示页面标题
// （各页面自己的标题与功能保留在页面自身顶部，例如商城页点「解锁游戏」弹出的子菜单不受影响）。

import { Link } from 'react-router-dom'

// 侧边栏开关图标：展开态竖条在左（panel-left），收起态竖条在右（panel-right）
function ToggleGlyph({ collapsed }) {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      {collapsed
        ? <line x1="15" y1="3" x2="15" y2="21" />
        : <line x1="9" y1="3" x2="9" y2="21" />}
    </svg>
  )
}

export default function TopBar({ collapsed, onToggle }) {
  return (
    <header className="app-topbar">
      {/* 收起 / 展开侧边栏 */}
      <button
        type="button"
        className="app-topbar-toggle"
        onClick={onToggle}
        aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
        title={collapsed ? '展开侧边栏' : '收起侧边栏'}
      >
        <ToggleGlyph collapsed={collapsed} />
      </button>

      {/* 右侧：头像（点击进入个人中心 /me） */}
      <div className="ml-auto flex items-center gap-3">
        <Link to="/me" className="app-topbar-avatar" aria-label="个人中心" title="个人中心" />
      </div>
    </header>
  )
}
