# -*- coding: utf-8 -*-
"""页眉动态标题 + 顶部通栏去收起按钮 + MyGames 标题上移。
用法: python header_dynamic.py
"""
import io

ROOT = r"C:\Users\张宏飞\Desktop\website_source\russian-learning-frontend-main"

def read(p):
    with io.open(p, "r", encoding="utf-8", newline="") as f:
        return f.read()

def write(p, s):
    with io.open(p, "w", encoding="utf-8", newline="") as f:
        f.write(s)

def rep(s, old, new, expect=None, label=""):
    n = s.count(old)
    if expect is not None and n != expect:
        print(f"[WARN] {label}: expected {expect}, got {n} -> SKIPPED")
        return s
    if n == 0:
        print(f"[WARN] {label}: 0 hits -> SKIPPED")
        return s
    print(f"[OK] {label}: {n} hit(s)")
    return s.replace(old, new)

# ================= 1. TopBar.jsx：去掉方块А左边的收起按钮 =================
p = ROOT + r"\src\components\layout\TopBar.jsx"
s = read(p)

# 删掉 ToggleGlyph 组件（不再需要）
old_toggle_comp = """function ToggleGlyph({ collapsed }) {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      {collapsed
        ? <line x1="15" y1="3" x2="15" y2="21" />
        : <line x1="9" y1="3" x2="9" y2="21" />}
    </svg>
  )
}

"""
if old_toggle_comp in s:
    s = s.replace(old_toggle_comp, "")
    print("[OK] TopBar 删除 ToggleGlyph 组件")
else:
    print("[WARN] ToggleGlyph 未匹配")

# 删掉收起按钮 + props
old_header = """export default function TopBar({ collapsed, onToggle }) {
  return (
    <header className="app-topbar">
      {/* 左侧：收起按钮 + logo（和侧边栏连着） */}
      <button
        type="button"
        className="app-topbar-toggle"
        onClick={onToggle}
        aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
      >
        <ToggleGlyph collapsed={collapsed} />
      </button>
      <Link to="/" className="flex items-center gap-2 font-bold text-base whitespace-nowrap">"""
new_header = """export default function TopBar() {
  return (
    <header className="app-topbar">
      {/* 左侧：logo（收起功能已放内容页页眉 [◧]） */}
      <Link to="/" className="flex items-center gap-2 font-bold text-base whitespace-nowrap">"""
if old_header in s:
    s = s.replace(old_header, new_header)
    print("[OK] TopBar 删除收起按钮")
else:
    print("[WARN] TopBar header 未匹配")
write(p, s)

# ================= 2. AppShell.jsx：页眉动态标题 =================
p = ROOT + r"\src\components\layout\AppShell.jsx"
s = read(p)

s = rep(s, "import { Outlet } from 'react-router-dom'",
        "import { Outlet, useLocation } from 'react-router-dom'", 1, "AppShell 引入 useLocation")

# 标题映射 + 解析函数，插到组件前
TITLES = """// 路由 → 页眉标题（跟随导航栏）
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

"""
anchor = "export default function AppShell() {"
if anchor in s:
    s = s.replace(anchor, TITLES + anchor, 1)
    print("[OK] AppShell 插入标题映射")
else:
    print("[WARN] AppShell anchor 未匹配")

s = rep(s, """export default function AppShell() {
  const [collapsed, setCollapsed] = useState(false)""",
        """export default function AppShell() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const pageTitle = resolveTitle(location.pathname)""", 1, "AppShell 读取路由标题")

# 页眉：去掉文字/右侧按钮，改动态标题
old_header_block = """            {/* 内容页页眉 */}
            <div className="shell-card-header">
              <button
                type="button"
                className="shell-card-toggle"
                onClick={() => setCollapsed(v => !v)}
                aria-label="收起侧边栏"
              >◧</button>
              <span className="shell-card-hint">收起侧边栏</span>
              <div className="shell-card-spacer" />
              <button type="button" className="shell-card-btn" aria-label="收起侧边栏">◧</button>
              <button type="button" className="shell-card-btn" aria-label="设置">⚙</button>
            </div>"""
new_header_block = """            {/* 内容页页眉：[◧ 收起] + 当前页面标题（跟随导航栏） */}
            <div className="shell-card-header">
              <button
                type="button"
                className="shell-card-toggle"
                onClick={() => setCollapsed(v => !v)}
                aria-label="收起侧边栏"
              >◧</button>
              <h1 className="shell-card-title">{pageTitle}</h1>
            </div>"""
if old_header_block in s:
    s = s.replace(old_header_block, new_header_block)
    print("[OK] AppShell 页眉动态标题")
else:
    print("[WARN] AppShell header 块未匹配")
write(p, s)

# ================= 3. dashboard.css：页眉标题样式 =================
p = ROOT + r"\src\styles\dashboard.css"
s = read(p)
anchor_css = ".shell-card-hint{font-size:14px;color:#666;white-space:nowrap}"
new_css = """.shell-card-hint{font-size:14px;color:#666;white-space:nowrap}
.shell-card-title{font-size:18px;font-weight:700;color:#18181b;margin:0;white-space:nowrap}"""
if anchor_css in s:
    s = s.replace(anchor_css, new_css)
    print("[OK] dashboard.css 新增 .shell-card-title")
else:
    print("[WARN] dashboard.css hint 未匹配")
write(p, s)

# ================= 4. MyGames.jsx：标题上移页眉，内容区去掉标题+计数，保留搜索/筛选 =================
p = ROOT + r"\src\pages\MyGames.jsx"
s = read(p)

old_top = """      {/* ===== 顶部栏 ===== */}
      <header className="px-6 pt-6 max-w-[1440px] mx-auto">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 font-extrabold text-2xl text-base-content">
            <FolderMark size={24} strokeWidth={2} />
            我的游戏
          </div>
          <span className="text-sm text-gray-400">共 <span className="text-primary font-bold">{unlockedGames.length}</span> 个游戏</span>

          <div className="ml-auto flex items-center gap-3">"""
new_top = """      {/* ===== 顶部工具栏（标题已上移页眉，这里只留搜索/筛选） ===== */}
      <header className="px-6 pt-6 max-w-[1440px] mx-auto">
        <div className="flex items-center justify-end gap-3 flex-wrap">"""
if old_top in s:
    s = s.replace(old_top, new_top)
    print("[OK] MyGames 顶部栏去掉标题+计数")
else:
    print("[WARN] MyGames 顶部栏未匹配")
write(p, s)

print("ALL DONE")
