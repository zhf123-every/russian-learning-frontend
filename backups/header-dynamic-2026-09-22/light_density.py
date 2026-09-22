# -*- coding: utf-8 -*-
"""轻改：主页内容留白压缩（shell-main 16→8px；Dashboard p-6→p-3）。"""
import io

# 1) dashboard.css
p = r"C:\Users\张宏飞\Desktop\website_source\russian-learning-frontend-main\src\styles\dashboard.css"
with io.open(p, "r", encoding="utf-8", newline="") as f:
    s = f.read()

old = "  background:#f5f5f5;padding:16px;"
new = "  background:#f5f5f5;padding:8px;"
n = s.count(old)
print("shell-main hits:", n)
assert n >= 1
s = s.replace(old, new, 1)
with io.open(p, "w", encoding="utf-8", newline="") as f:
    f.write(s)
print("shell-main OK")

# 2) Dashboard.jsx
p = r"C:\Users\张宏飞\Desktop\website_source\russian-learning-frontend-main\src\pages\Dashboard.jsx"
with io.open(p, "r", encoding="utf-8", newline="") as f:
    s = f.read()

old = '<main className="flex-1 p-6 overflow-auto">'
new = '<main className="flex-1 p-3 overflow-auto">'
n = s.count(old)
print("Dashboard main hits:", n)
assert n == 1
s = s.replace(old, new, 1)
with io.open(p, "w", encoding="utf-8", newline="") as f:
    f.write(s)
print("Dashboard OK")
print("DONE")
