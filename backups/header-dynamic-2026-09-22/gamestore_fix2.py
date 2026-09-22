# -*- coding: utf-8 -*-
"""GameStore 修复：1) 分类标签恢复"全部"；2) 搜索框始终显示（去掉 hidden lg:block）。"""
import io

p = r"C:\Users\张宏飞\Desktop\website_source\russian-learning-frontend-main\src\pages\GameStore.jsx"
with io.open(p, "r", encoding="utf-8", newline="") as f:
    s = f.read()

# 1) visibleCats 恢复"全部"标签
old = """  // 分类标签：去掉"全部"（用户要求）；mode=all 显示全部，否则按当前模式过滤
  const visibleCats = (mode === 'all' ? CATS : CATS.filter(c => c.cat === 'both' || c.cat === mode))
    .filter(c => c.label !== '全部')"""
new = """  // 分类标签（含"全部"）：mode=all 显示全部，否则按当前模式过滤
  const visibleCats = mode === 'all' ? CATS : CATS.filter(c => c.cat === 'both' || c.cat === mode)"""
assert old in s, "visibleCats block not found"
s = s.replace(old, new)
print("visibleCats OK")

# 2) 搜索框去掉 hidden lg:block，始终显示
old = """        <div className="relative hidden lg:block w-64 shrink-0">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
          <input className="w-full h-9 pl-9 pr-3 rounded-full bg-base-200 text-sm outline-none placeholder:text-gray-400" placeholder="大家都在搜：免费" />
        </div>"""
new = """        <div className="relative w-64 shrink-0">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
          <input className="w-full h-9 pl-9 pr-3 rounded-full bg-base-200 text-sm outline-none placeholder:text-gray-400" placeholder="大家都在搜：免费" />
        </div>"""
assert old in s, "search box not found"
s = s.replace(old, new)
print("search box OK")

with io.open(p, "w", encoding="utf-8", newline="") as f:
    f.write(s)
print("DONE")
