import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import SideNav from './SideNav'
import MobileNav from './MobileNav'
import TopBar from './TopBar'
import { PageHeaderCtx } from './PageHeaderContext'

// 路由 → 页眉标题（跟随导航栏）
const TITLES = {
  '/': '我的主页',
  '/unlocked-games': '解锁游戏',
  '/my-games': '我的游戏',
  '/vocab': '复习关卡',
  '/quest-store': '游戏化学习',
  '/square': '精听学习',
  '/tutor': 'AI 对话教练',
  '/dictionary': '词典',
  '/profile': '统计',
  '/learn': '学习',
  '/tools': '工具',
  '/me': '我的',
}
const PREFIX_TITLES = [
  ['/game/', '游戏详情'],
  ['/course/', '游戏详情'],
  ['/quest-practice', '闯关练习'],
  ['/quest-dictation', '听写练习'],
  ['/square/', '精听学习'],
  ['/study/', '精听学习'],
  ['/custom', '自定义素材'],
  ['/method', '五步精听法'],
]
function resolveTitle(path) {
  if (TITLES[path]) return TITLES[path]
  for (const [pre, t] of PREFIX_TITLES) {
    if (path.startsWith(pre)) return t
  }
  return ''
}

export default function AppShell() {
  const [collapsed, setCollapsed] = useState(false)
  const [headerLeft, setHeaderLeft] = useState(null)
  const [headerRight, setHeaderRight] = useState(null)
  const [titleOverride, setTitleOverride] = useState(null)
  const location = useLocation()
  const pageTitle = resolveTitle(location.pathname)
  useEffect(() => {
    const handler = () => setCollapsed((v) => !v)
    window.addEventListener('app:toggle-sidebar', handler)
    return () => window.removeEventListener('app:toggle-sidebar', handler)
  }, [])
  return (
    <div className={'app-shell' + (collapsed ? ' shell-collapsed' : '')}>
      {/* 顶栏横跨全宽（含侧边栏上方） */}
      <TopBar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
      {/* 顶栏下面：侧边栏（占位符 + fixed 实体）+ 主内容区（flex-1） */}
      <div className="shell-body">
        {/* ① 侧边栏占位符（防遮挡）：占文档流宽度，fixed 侧栏再覆盖上去 */}
        <div className="shell-sidebar-ph" aria-hidden="true" />
        {/* ② 侧边栏固定实体（fixed） */}
        <SideNav />
        {/* ③ 主内容区（flex-1 自适应滚动） */}
        <main className="shell-main">
          {/* 白色大卡片容器：页眉 + 所有内容都在里面 */}
          <div className="shell-card">
            {/* 内容页页眉：[◧ 收起] 或页面注入的左侧按钮 + 当前页面标题（跟随导航栏） */}
            <div className="shell-card-header">
              {headerLeft || (
                <button
                  type="button"
                  className="shell-card-toggle"
                  onClick={() => setCollapsed(v => !v)}
                  aria-label="收起侧边栏"
                >◧</button>
              )}
              {titleOverride || <h1 className="shell-card-title">{pageTitle}</h1>}
              {/* 页面注入的标题右侧工具栏（分类标签/搜索等，紧贴标题） */}
              {headerRight}
            </div>
            <PageHeaderCtx.Provider value={{ setHeaderLeft, setHeaderRight, setTitleOverride }}>
              <Outlet />
            </PageHeaderCtx.Provider>
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  )
}
