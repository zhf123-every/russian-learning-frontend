# -*- coding: utf-8 -*-
"""重改：去掉白色大容器（shell-card 白底/圆角/阴影），卡片直接铺灰底。
保留 shell-card-header 页眉条（用户此前明确要求）。"""
import io

p = r"C:\Users\张宏飞\Desktop\website_source\russian-learning-frontend-main\src\styles\dashboard.css"
with io.open(p, "r", encoding="utf-8", newline="") as f:
    s = f.read()

old = """.shell-card{
  background:#fff;border-radius:16px;min-height:100%;
  box-shadow:0 1px 3px rgba(0,0,0,.05);overflow:hidden;
}"""
new = """.shell-card{
  background:transparent;border-radius:0;min-height:100%;
  box-shadow:none;overflow:visible;
}"""
assert old in s, "shell-card block not found"
s = s.replace(old, new)
print("shell-card -> transparent OK")

with io.open(p, "w", encoding="utf-8", newline="") as f:
    f.write(s)
print("DONE")
