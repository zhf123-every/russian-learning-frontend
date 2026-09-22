# -*- coding: utf-8 -*-
"""MyGames：搜索框 + 筛选按钮移到页眉（setHeaderRight 插槽），删除内容区顶部工具栏。"""
import io

p = r"C:\Users\张宏飞\Desktop\website_source\russian-learning-frontend-main\src\pages\MyGames.jsx"
with io.open(p, "r", encoding="utf-8", newline="") as f:
    s = f.read()

# 1) 引入 usePageHeader
old = "import { toast } from '../lib/toast'"
new = "import { toast } from '../lib/toast'\nimport { usePageHeader } from '../components/layout/PageHeaderContext'"
assert old in s, "import not found"
s = s.replace(old, new)
print("import OK")

# 2) 组件内加 setHeaderRight + useEffect 注入工具栏
old = """  const onVideoStart = (mode) => {
    setVideoTarget(null)
    toast(`「${mode.name}」已选好，演示视频正式素材即将上线`)
  }

  return (
    <div className="min-h-full bg-base-100">

      {/* ===== 顶部工具栏（标题已上移页眉，这里只留搜索/筛选） ===== */}
      <header className="px-6 pt-6 max-w-[1440px] mx-auto">
        <div className="flex items-center justify-end gap-3 flex-wrap">
            <div className="relative w-64">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
              <input
                className="w-full h-9 pl-9 pr-10 rounded-full bg-base-200 text-sm outline-none placeholder:text-gray-400"
                placeholder="搜索我的游戏"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 bg-white rounded px-1.5 py-0.5 border border-base-300">Ctrl K</kbd>
            </div>
            <button type="button" disabled title="即将上线" className="h-9 px-4 inline-flex items-center gap-1.5 rounded-full bg-base-100 border border-base-300 text-sm text-gray-400 opacity-60 cursor-not-allowed">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
              筛选 · 即将上线
            </button>
        </div>
      </header>

      <main className="px-6 py-6 max-w-[1440px] mx-auto">"""

new = """  const setHeaderRight = usePageHeader() // 页眉插槽

  // 搜索框 + 筛选按钮 移到页眉（标题已在页眉）
  useEffect(() => {
    setHeaderRight(
      <div className="flex items-center gap-3 min-w-0 flex-1 justify-end">
        <div className="relative w-64 shrink-0">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
          <input
            className="w-full h-9 pl-9 pr-10 rounded-full bg-base-200 text-sm outline-none placeholder:text-gray-400"
            placeholder="搜索我的游戏"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 bg-white rounded px-1.5 py-0.5 border border-base-300">Ctrl K</kbd>
        </div>
        <button type="button" disabled title="即将上线" className="h-9 px-4 inline-flex items-center gap-1.5 rounded-full bg-base-100 border border-base-300 text-sm text-gray-400 opacity-60 cursor-not-allowed shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
          筛选 · 即将上线
        </button>
      </div>
    )
    return () => setHeaderRight(null)
  }, [query, setHeaderRight])

  const onVideoStart = (mode) => {
    setVideoTarget(null)
    toast(`「${mode.name}」已选好，演示视频正式素材即将上线`)
  }

  return (
    <div className="min-h-full bg-base-100">

      <main className="px-6 py-6 max-w-[1440px] mx-auto">"""

assert old in s, "toolbar block not found"
s = s.replace(old, new)
print("toolbar moved OK")

with io.open(p, "w", encoding="utf-8", newline="") as f:
    f.write(s)
print("DONE")
