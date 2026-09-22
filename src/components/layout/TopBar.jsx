// 全局顶部页眉：左侧收起按钮，右侧会员状态+金币钻石+消息+头像
import { Link } from 'react-router-dom'

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
      <button
        type="button"
        className="app-topbar-toggle"
        onClick={onToggle}
        aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
      >
        <ToggleGlyph collapsed={collapsed} />
      </button>

      <div className="ml-auto flex items-center gap-3">
        {/* 会员状态（占位，后续接后端） */}
        <div className="hidden md:flex items-center gap-2 text-sm text-gray-500">
          <span className="font-medium">体验会员</span>
          <span className="text-gray-300">|</span>
          <span>剩余 1天 08时</span>
          <span className="text-primary font-medium cursor-pointer">查看 ›</span>
        </div>

        <span className="hidden md:block text-gray-300">|</span>

        {/* 推广赚佣金（即将上线） */}
        <button className="hidden md:inline-flex items-center text-sm text-gray-600 hover:text-primary transition-colors opacity-60 cursor-not-allowed" title="即将上线">
          推广赚佣金
        </button>

        {/* 帮助与反馈（即将上线） */}
        <button className="hidden md:inline-flex items-center text-sm text-gray-600 hover:text-primary transition-colors opacity-60 cursor-not-allowed" title="即将上线">
          帮助与反馈
        </button>

        <span className="hidden md:block text-gray-300">|</span>

        {/* 消息图标（即将上线） */}
        <button className="relative text-gray-500 hover:text-primary transition-colors opacity-60 cursor-not-allowed" title="即将上线">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/>
          </svg>
        </button>

        {/* 金币（占位） */}
        <div className="flex items-center gap-1 text-sm">
          <span className="text-amber-500">🪙</span>
          <span className="font-semibold text-gray-700">0</span>
        </div>

        {/* 钻石（占位） */}
        <div className="flex items-center gap-1 text-sm">
          <span className="text-cyan-500">💎</span>
          <span className="font-semibold text-gray-700">1,000</span>
        </div>

        {/* 头像 */}
        <Link to="/me" className="app-topbar-avatar" aria-label="个人中心" title="个人中心" />
      </div>
    </header>
  )
}
