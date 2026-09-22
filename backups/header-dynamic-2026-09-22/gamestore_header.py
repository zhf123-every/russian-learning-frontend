# -*- coding: utf-8 -*-
"""解锁游戏页：去掉内容区收起按钮+标题，分类标签+搜索框整体上移页眉。
AppShell 增加页眉右侧插槽（PageHeaderCtx）。"""
import io

ROOT = r"C:\Users\张宏飞\Desktop\website_source\russian-learning-frontend-main"

def read(p):
    with io.open(p, "r", encoding="utf-8", newline="") as f:
        return f.read()

def write(p, s):
    with io.open(p, "w", encoding="utf-8", newline="") as f:
        f.write(s)

def rep(s, old, new, expect=1, label=""):
    n = s.count(old)
    if n == expect:
        print(f"[OK] {label}")
        return s.replace(old, new)
    print(f"[WARN] {label}: expected {expect}, got {n} -> SKIPPED")
    return s

# ============ 1. AppShell.jsx：页眉右侧插槽 ============
p = ROOT + r"\src\components\layout\AppShell.jsx"
s = read(p)

s = rep(s, "import TopBar from './TopBar'",
        "import TopBar from './TopBar'\nimport { PageHeaderCtx } from './PageHeaderContext'", 1, "AppShell 引入 PageHeaderCtx")

s = rep(s, """  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()""",
        """  const [collapsed, setCollapsed] = useState(false)
  const [headerRight, setHeaderRight] = useState(null)
  const location = useLocation()""", 1, "AppShell 新增 headerRight state")

old_hdr = """            <div className="shell-card-header">
              <button
                type="button"
                className="shell-card-toggle"
                onClick={() => setCollapsed(v => !v)}
                aria-label="收起侧边栏"
              >◧</button>
              <h1 className="shell-card-title">{pageTitle}</h1>
            </div>
            <Outlet />"""
new_hdr = """            <div className="shell-card-header">
              <button
                type="button"
                className="shell-card-toggle"
                onClick={() => setCollapsed(v => !v)}
                aria-label="收起侧边栏"
              >◧</button>
              <h1 className="shell-card-title">{pageTitle}</h1>
              <div className="shell-card-spacer" />
              {/* 页面注入的工具栏（分类标签/搜索等） */}
              {headerRight}
            </div>
            <PageHeaderCtx.Provider value={setHeaderRight}>
              <Outlet />
            </PageHeaderCtx.Provider>"""
if old_hdr in s:
    s = s.replace(old_hdr, new_hdr)
    print("[OK] AppShell 页眉右侧插槽")
else:
    print("[WARN] AppShell 页眉块未匹配")
write(p, s)

# ============ 2. GameStore.jsx：分类标签+搜索框上移页眉 ============
p = ROOT + r"\src\pages\GameStore.jsx"
s = read(p)

s = rep(s, "import { toast } from '../lib/toast'",
        "import { toast } from '../lib/toast'\nimport { usePageHeader } from '../components/layout/PageHeaderContext'", 1, "GameStore 引入 usePageHeader")

old_state = """  const [videoTarget, setVideoTarget] = useState(null) // 视频类卡片 → 弹窗

  useEffect(() => {
    const sync = () => setTick((t) => t + 1)
    window.addEventListener('rlearn:purchase-changed', sync)
    return () => window.removeEventListener('rlearn:purchase-changed', sync)
  }, [])"""
new_state = """  const [videoTarget, setVideoTarget] = useState(null) // 视频类卡片 → 弹窗
  const setHeaderRight = usePageHeader() // 页眉右侧插槽

  // 分类标签 + 搜索框 上移页眉（去掉内容区重复的收起按钮和"解锁游戏"标题）
  useEffect(() => {
    setHeaderRight(
      <div className="flex items-center gap-4 min-w-0">
        <details open={menuOpen} onToggle={(e) => setMenuOpen(e.currentTarget.open)} className="relative shrink-0 group">
          <summary className="list-none [&::-webkit-details-marker]:hidden flex items-center gap-2 font-semibold text-sm text-base-content cursor-pointer select-none">
            {mode === 'all' ? '全部内容' : modeLabel.replace(' · ', '')}
            <svg className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
          </summary>
          <div className="absolute left-0 top-full mt-2 w-52 bg-base-100 border border-base-200 rounded-2xl shadow-xl overflow-hidden z-30 py-1.5">
            {menuItem('all',
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><path d="M9 22V12h6v10" /></svg>,
              '全部内容')}
            <div className="h-px bg-base-200 my-1" />
            {menuItem('video',
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" /></svg>,
              '通关视频')}
            {menuItem('guide',
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /></svg>,
              '通关秘籍')}
          </div>
        </details>

        <nav className="flex-1 flex items-center gap-5 overflow-x-auto no-scrollbar text-[15px] whitespace-nowrap min-w-0">
          {visibleCats.map((c, i) => (
            <a key={c.label} className={`py-1 transition cursor-pointer ${
              i === 0 ? 'relative font-semibold text-primary after:absolute after:left-0 after:right-0 after:-bottom-[1px] after:h-[3px] after:rounded-full after:bg-primary'
              : 'text-gray-500 hover:text-primary'
            }`}>{c.label}</a>
          ))}
        </nav>

        <div className="relative hidden lg:block w-64 shrink-0">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
          <input className="w-full h-9 pl-9 pr-3 rounded-full bg-base-200 text-sm outline-none placeholder:text-gray-400" placeholder="大家都在搜：免费" />
        </div>
      </div>
    )
    return () => setHeaderRight(null)
  }, [mode, menuOpen, modeLabel, visibleCats, menuItem, setHeaderRight])

  useEffect(() => {
    const sync = () => setTick((t) => t + 1)
    window.addEventListener('rlearn:purchase-changed', sync)
    return () => window.removeEventListener('rlearn:purchase-changed', sync)
  }, [])"""
if old_state in s:
    s = s.replace(old_state, new_state)
    print("[OK] GameStore 注入页眉工具栏")
else:
    print("[WARN] GameStore state 块未匹配")

# 删除内容区 store-subbar（收起按钮 + 解锁游戏标题 + 原标签/搜索）
old_sub = """      {/* ===== 顶部商城导航 ===== */}
      <header className="store-subbar bg-base-100 border-b border-base-200">
        <div className="flex items-center gap-4 px-6 h-16">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event('app:toggle-sidebar'))}
            aria-label="收起/展开侧边栏"
            title="收起/展开侧边栏"
            className="flex-none w-9 h-9 rounded-full inline-flex items-center justify-center border-none bg-transparent text-base-content cursor-pointer hover:bg-base-200 transition"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>
          <details open={menuOpen} onToggle={(e) => setMenuOpen(e.currentTarget.open)} className="relative shrink-0 group">
            <summary className="list-none [&::-webkit-details-marker]:hidden flex items-center gap-2 font-extrabold text-lg text-base-content cursor-pointer select-none">
              解锁游戏<span>{modeLabel}</span>
              <svg className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
            </summary>
            <div className="absolute left-0 top-full mt-2 w-52 bg-base-100 border border-base-200 rounded-2xl shadow-xl overflow-hidden z-30 py-1.5">
              {menuItem('all',
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><path d="M9 22V12h6v10" /></svg>,
                '全部内容')}
              <div className="h-px bg-base-200 my-1" />
              {menuItem('video',
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" /></svg>,
                '通关视频')}
              {menuItem('guide',
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /></svg>,
                '通关秘籍')}
            </div>
          </details>

          <nav className="flex-1 flex items-center gap-6 overflow-x-auto no-scrollbar text-[15px] whitespace-nowrap">
            {visibleCats.map((c, i) => (
              <a key={c.label} className={`py-2 transition cursor-pointer ${
                i === 0 ? 'relative font-semibold text-primary after:absolute after:left-0 after:right-0 after:-bottom-[1px] after:h-[3px] after:rounded-full after:bg-primary'
                : 'text-gray-500 hover:text-primary'
              }`}>{c.label}</a>
            ))}
          </nav>

          <div className="relative hidden lg:block w-64 shrink-0">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
            <input className="w-full h-9 pl-9 pr-3 rounded-full bg-base-200 text-sm outline-none placeholder:text-gray-400" placeholder="大家都在搜：免费" />
          </div>
        </div>
      </header>

      <main className="px-6 py-7">"""
new_sub = """      <main className="px-6 py-7">"""
if old_sub in s:
    s = s.replace(old_sub, new_sub)
    print("[OK] GameStore 删除内容区 store-subbar")
else:
    print("[WARN] GameStore store-subbar 块未匹配")
write(p, s)

print("ALL DONE")
