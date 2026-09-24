import { useState } from 'react'

// ===== 商城页眉工具区（对标句乐部：主分类导航 + 搜索，注入全局页眉"游戏商城"右侧） =====
// 导航数组：按俄语站主分类适配（对标句乐部 推荐/教材同步/考试备考…）
const NAV_ITEMS = ['推荐', '教材同步', '考试备考', '少儿俄语', '基础俄语', '场景俄语', '阅读听力', '影视俄语', '音乐俄语', '全部']

export default function Header({ onNavChange }) {
  const [activeNav, setActiveNav] = useState('推荐') // 当前激活导航项（紫色高亮 + 紫色下划线）

  const handleNav = (item) => {
    setActiveNav(item)
    if (onNavChange) onNavChange(item)
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      {/* 导航：窄屏横向滚动，不挤乱 */}
      <nav className="min-w-0 flex-1 overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-1 whitespace-nowrap">
          {NAV_ITEMS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => handleNav(item)}
              className={`border-b-2 px-2 py-1 text-sm transition-colors ${
                activeNav === item
                  ? 'border-primary font-semibold text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </nav>

      {/* 搜索框 */}
      <div className="w-[150px] shrink-0 xl:w-[190px]">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            className="input input-bordered h-9 w-full rounded-full pl-9 pr-3 text-sm"
            placeholder="大家都在搜：专四专八"
          />
        </div>
      </div>
    </div>
  )
}
