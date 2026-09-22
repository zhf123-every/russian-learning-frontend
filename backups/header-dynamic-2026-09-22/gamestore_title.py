# -*- coding: utf-8 -*-
"""GameStore：标题接管为"解锁游戏▾"可点击子菜单；分类标签去掉"全部"；推荐紧贴标题；搜索框最右。"""
import io

p = r"C:\Users\张宏飞\Desktop\website_source\russian-learning-frontend-main\src\pages\GameStore.jsx"
with io.open(p, "r", encoding="utf-8", newline="") as f:
    s = f.read()

# 1) usePageHeader 解构出两个 setter
old = "  const setHeaderRight = usePageHeader() // 页眉右侧插槽"
new = "  const { setHeaderRight, setTitleOverride } = usePageHeader() // 页眉插槽"
assert old in s, "usePageHeader line not found"
s = s.replace(old, new)

# 2) visibleCats 去掉"全部"标签
old = "  const visibleCats = mode === 'all' ? CATS : CATS.filter(c => c.cat === 'both' || c.cat === mode)"
new = """  // 分类标签：去掉"全部"（用户要求）；mode=all 显示全部，否则按当前模式过滤
  const visibleCats = (mode === 'all' ? CATS : CATS.filter(c => c.cat === 'both' || c.cat === mode))
    .filter(c => c.label !== '全部')"""
assert old in s, "visibleCats not found"
s = s.replace(old, new)

# 3) 替换整个 useEffect：标题接管 + 标签紧贴 + 搜索框最右
old_effect = """  // 分类标签 + 搜索框 上移页眉（去掉内容区重复的收起按钮和"解锁游戏"标题）
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
  }, [mode, menuOpen, modeLabel, visibleCats, menuItem, setHeaderRight])"""

new_effect = """  // 页眉：标题"解锁游戏▾"可点开子菜单（全部内容/通关视频/通关秘籍）；分类标签紧贴标题；搜索框最右
  useEffect(() => {
    setTitleOverride(
      <details open={menuOpen} onToggle={(e) => setMenuOpen(e.currentTarget.open)} className="relative shrink-0 group">
        <summary className="list-none [&::-webkit-details-marker]:hidden flex items-center gap-2 font-bold text-lg text-base-content cursor-pointer select-none whitespace-nowrap">
          解锁游戏
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
    )
    setHeaderRight(
      <div className="flex items-center gap-4 min-w-0 flex-1">
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
    return () => { setTitleOverride(null); setHeaderRight(null) }
  }, [mode, menuOpen, visibleCats, menuItem, setHeaderRight, setTitleOverride])"""

assert old_effect in s, "effect block not found"
s = s.replace(old_effect, new_effect)

with io.open(p, "w", encoding="utf-8", newline="") as f:
    f.write(s)
print("GameStore OK")
