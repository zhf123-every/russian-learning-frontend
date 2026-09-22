# -*- coding: utf-8 -*-
"""把 Tailwind Play 定稿参数同步到线上项目（仅主页相关）。
用法: python sync_play.py
"""
import io, sys

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
        print(f"[WARN] {label}: expected {expect} hits, got {n}  -> SKIPPED")
        return s
    if n == 0:
        print(f"[WARN] {label}: 0 hits -> SKIPPED")
        return s
    print(f"[OK] {label}: {n} hit(s)")
    return s.replace(old, new)

# ================= 1. tailwind.css: 全站 16px 基准 =================
p = ROOT + r"\src\styles\tailwind.css"
s = read(p)
s = rep(s, "html { scroll-behavior: smooth; font-size: 22px; }",
        "html { scroll-behavior: smooth; font-size: 16px; }", 1, "tailwind.css html 22->16px")
write(p, s)

# ================= 2. dashboard.css =================
p = ROOT + r"\src\styles\dashboard.css"
s = read(p)

# 侧栏宽 300->256
s = rep(s, "--db-sidenav-w:300px;", "--db-sidenav-w:256px;", 1, "侧栏宽 300->256")
# 侧栏 fixed top 60->50（顶栏同步变矮）
s = rep(s, "position:fixed;top:60px;left:0;bottom:0;z-index:20;",
        "position:fixed;top:50px;left:0;bottom:0;z-index:20;", 1, "侧栏 top 60->50")
# 菜单文字 15->14
s = rep(s, "font-size:15px;color:var(--db-text-2);cursor:pointer;margin-bottom:2px;",
        "font-size:14px;color:var(--db-text-2);cursor:pointer;margin-bottom:2px;", 1, "侧栏菜单 15->14")
s = rep(s, ".db-collapsible-items .db-navitem{font-size:15px;padding:8px 10px}",
        ".db-collapsible-items .db-navitem{font-size:14px;padding:8px 10px}", 1, "折叠子菜单 15->14")
# 顶栏 60->50
s = rep(s, "height:60px;padding:0 18px;", "height:50px;padding:0 18px;", 1, "顶栏 60->50")
# 商城吸顶栏跟随顶栏
s = rep(s, "@media(min-width:901px){ .store-subbar{top:60px} }",
        "@media(min-width:901px){ .store-subbar{top:50px} }", 1, "商城吸顶 top 60->50")
# 页眉：留白 24->12、加灰底、分割线改 #e5e7eb
s = rep(s, "height:56px;display:flex;align-items:center;gap:12px;padding:0 24px;",
        "height:56px;display:flex;align-items:center;gap:12px;padding:0 12px;\n  background:#fafafa;", 1, "页眉 留白12+灰底")
s = rep(s, "border-bottom:1px solid #f0f0f0;flex-shrink:0;",
        "border-bottom:1px solid #e5e7eb;flex-shrink:0;", 1, "页眉分割线 #e5e7eb")

# 追加：侧栏滚动条 + 主页卡片对齐 + 我的游戏虚线框骨架
ADD = """
/* ================= ★★★ Play 定稿同步（2026-09-22） ★★★ ================= */
/* 侧边栏滚动条（句乐部同款：6px 浅灰、圆角3px） */
.db-sidenav::-webkit-scrollbar{width:6px}
.db-sidenav::-webkit-scrollbar-track{background:transparent}
.db-sidenav::-webkit-scrollbar-thumb{background:rgba(209,213,219,.5);border-radius:3px}
.db-sidenav::-webkit-scrollbar-thumb:hover{background:rgb(156 163 175)}
.db-sidenav{scrollbar-width:thin;scrollbar-color:rgba(209,213,219,.5) transparent}

/* 主页卡片对齐 Play 定稿：12px 圆角 / 1px #e5e7eb / 无阴影 */
.home-grid .card{border-radius:12px;border:1px solid #e5e7eb;box-shadow:none}
.home-grid .card-body{padding:16px}
.home-grid .card .card-body{padding:16px}

/* ===== 我的游戏（句乐部“我的课程”骨架：虚线框+加号，只占左+中列） ===== */
.course-card{
  grid-column:1 / span 2;display:block;text-decoration:none;color:inherit;
  background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:16px;
}
.course-card:hover{background:#fafafa}
.course-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
.course-title{font-size:20px;font-weight:500;margin:0}
.course-btn{display:inline-flex;align-items:center;gap:4px;background:#f3f4f6;border:none;border-radius:8px;padding:6px 12px;font-size:14px;color:#4b5563;cursor:pointer;font-family:inherit}
.course-btn:hover{background:#e5e7eb}
.course-empty{min-height:200px;display:flex;flex-direction:column;align-items:center;justify-content:center;border:1px dashed #d1d5db;border-radius:8px;background:rgba(255,255,255,.5)}
.course-empty:hover{background:#f9fafb}
.course-plus{width:48px;height:48px;border-radius:50%;background:#f3f4f6;display:flex;align-items:center;justify-content:center;font-size:24px;color:#6b7280;margin:0 auto 8px}
.course-hint{text-align:center;font-size:14px;color:#6b7280;padding:12px;margin:0}
"""
s = s.rstrip() + "\n" + ADD.lstrip("\n")
write(p, s)
print("[OK] dashboard.css 追加滚动条/卡片对齐/我的游戏骨架")

# ================= 3. Dashboard.jsx =================
p = ROOT + r"\src\pages\Dashboard.jsx"
s = read(p)

# 打卡/任务卡高度 490->438
s = rep(s, "h-[490px]", "h-[438px]", 2, "大卡高度 490->438")
# 卡片标题 24px->16px/700
s = rep(s, "text-2xl font-bold", "text-base font-bold", 2, "卡片标题 16px/700")
# 打卡数字 36px->30px/700
s = rep(s, "text-4xl font-extrabold leading-none", "text-3xl font-bold leading-none", 2, "打卡数字 30px/700")
# 连胜/累计标签 16->12
s = rep(s, "text-base text-gray-400 mb-1", "text-xs text-gray-400 mb-1", 2, "连胜/累计标签 12px")
# 今日目标行 16->12
s = rep(s, "text-base text-gray-500 mb-1.5", "text-xs text-gray-500 mb-1.5", 1, "今日目标行 12px")
# 本周打卡记录 16->12
s = rep(s, "text-base text-gray-400 mb-2", "text-xs text-gray-400 mb-2", 1, "本周打卡记录 12px")
# 任务名 20px->14px/500（4 处内联）
s = rep(s, "text-xl font-semibold text-gray-900", "text-sm font-medium text-gray-900", 4, "任务名 14px/500")
# 任务描述 16->12（先带 line-clamp 的）
s = rep(s, "text-sm text-gray-500 leading-relaxed line-clamp-2", "text-xs text-gray-500 leading-relaxed line-clamp-2", 1, "精听描述 12px")
s = rep(s, "text-sm text-gray-500 leading-relaxed", "text-xs text-gray-500 leading-relaxed", 2, "任务描述 12px")
# 大卡内边距 20->16（5 处：打卡/任务/右栏三卡）
s = rep(s, "card-body p-5", "card-body p-4", 5, "大卡内边距 16px")
# 右栏最近学习标题 14/600->16/500
s = rep(s, "text-sm font-semibold mb-1", "text-base font-medium mb-1", 1, "最近学习标题 16px/500")
# 六格标题 14/600->14/700（对齐 Play mini-title）
s = rep(s, '<span className="text-sm font-semibold">六格掌握度</span>',
        '<span className="text-sm font-bold">六格掌握度</span>', 1, "六格标题 700")

# 我的游戏入口 -> 虚线框骨架（整块替换）
OLD_ENTRY = """          {/* ===== 我的游戏入口（跨左中两列，上下居中） ===== */}
          <Link to="/my-games" className="col-entry flex items-center self-center card bg-transparent shadow-sm hover:shadow-md transition cursor-pointer px-4 py-3">
            <div className="h-20 w-20 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-700">
                <line x1="6" y1="11" x2="10" y2="11"/>
                <line x1="8" y1="9" x2="8" y2="13"/>
                <line x1="15" y1="12" x2="15.01" y2="12"/>
                <line x1="18" y1="10" x2="18.01" y2="10"/>
                <rect x="2" y="6" width="20" height="12" rx="2"/>
              </svg>
            </div>
            <div className="min-w-0 flex-1 ml-3">
              <div className="text-2xl font-semibold text-gray-900">我的游戏</div>
              <div className="text-xl text-gray-400 mt-0.5">添加你的游戏数据包</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 shrink-0">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </Link>"""
NEW_ENTRY = """          {/* ===== 我的游戏（句乐部“我的课程”骨架：虚线框+加号，只占左+中列） ===== */}
          <Link to="/my-games" className="course-card">
            <div className="course-head">
              <h2 className="course-title">我的游戏</h2>
              <span className="course-btn">🎮 游戏包商城</span>
            </div>
            <div className="course-empty">
              <div className="course-plus">＋</div>
              <p className="course-hint">添加你的游戏数据包</p>
            </div>
          </Link>"""
if OLD_ENTRY in s:
    s = s.replace(OLD_ENTRY, NEW_ENTRY)
    print("[OK] 我的游戏 -> 虚线框骨架")
else:
    print("[WARN] 我的游戏入口整块未匹配 -> SKIPPED")

write(p, s)
print("ALL DONE")
