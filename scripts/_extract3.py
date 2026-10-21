# -*- coding: utf-8 -*-
"""提取线上答题提交与词槽渲染逻辑"""
import re

P = r"C:\Users\张宏飞\russian-learning-frontend\scripts\_online_bundle.js"
src = open(P, encoding="utf-8").read()

def show(kw, before=150, after=2600, limit=1):
    idxs = [m.start() for m in re.finditer(re.escape(kw), src)]
    print(f"\n##### '{kw}' hits: {len(idxs)}")
    for i in idxs[:limit]:
        seg = src[max(0, i-before): i+after]
        print(seg)
        print("=" * 90)

show("提交到后端")
show("/api/answer")
