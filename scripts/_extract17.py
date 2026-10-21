# -*- coding: utf-8 -*-
import re
P = r"C:\Users\张宏飞\russian-learning-frontend\scripts\_online_bundle.js"
src = open(P, encoding="utf-8").read()

# isPlaceStem 定义
m = re.search(r"function isPlaceStem\(", src)
if m:
    seg = src[m.start(): m.start()+2500]
    print("=== isPlaceStem ===")
    print(seg)
else:
    # 可能写成 const isPlaceStem=
    for mm in re.finditer(r"isPlaceStem=", src):
        seg = src[mm.start()-20: mm.start()+2500]
        print("=== isPlaceStem at", mm.start(), "===")
        print(seg)
        break
