# -*- coding: utf-8 -*-
"""AppShell 支持 titleOverride：页面可接管页眉标题（可点击下拉）。"""
import io

p = r"C:\Users\张宏飞\Desktop\website_source\russian-learning-frontend-main\src\components\layout\AppShell.jsx"
with io.open(p, "r", encoding="utf-8", newline="") as f:
    s = f.read()

old = """  const [headerRight, setHeaderRight] = useState(null)
  const location = useLocation()"""
new = """  const [headerRight, setHeaderRight] = useState(null)
  const [titleOverride, setTitleOverride] = useState(null)
  const location = useLocation()"""
assert old in s, "state not found"
s = s.replace(old, new)

old2 = """              <h1 className="shell-card-title">{pageTitle}</h1>
              <div className="shell-card-spacer" />
              {/* 页面注入的工具栏（分类标签/搜索等） */}
              {headerRight}
            </div>
            <PageHeaderCtx.Provider value={setHeaderRight}>
              <Outlet />
            </PageHeaderCtx.Provider>"""
new2 = """              {titleOverride || <h1 className="shell-card-title">{pageTitle}</h1>}
              {/* 页面注入的标题右侧工具栏（分类标签/搜索等，紧贴标题） */}
              {headerRight}
            </div>
            <PageHeaderCtx.Provider value={{ setHeaderRight, setTitleOverride }}>
              <Outlet />
            </PageHeaderCtx.Provider>"""
assert old2 in s, "header block not found"
s = s.replace(old2, new2)

with io.open(p, "w", encoding="utf-8", newline="") as f:
    f.write(s)
print("AppShell OK")
