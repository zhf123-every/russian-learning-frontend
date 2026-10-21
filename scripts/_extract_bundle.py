# -*- coding: utf-8 -*-
"""从线上 bundle 提取答题输入逻辑片段"""
import re

P = r"C:\Users\张宏飞\russian-learning-frontend\scripts\_online_bundle.js"
src = open(P, encoding="utf-8").read()
print("bundle size:", len(src))

def show(kw, before=120, after=600, limit=2):
    idxs = [m.start() for m in re.finditer(re.escape(kw), src)]
    print(f"\n##### '{kw}' hits: {len(idxs)}")
    for i in idxs[:limit]:
        seg = src[max(0, i-before): i+after]
        print("---")
        print(seg)

show("输入俄语句子")
show("修正当前词")
show("syncFromInput")
