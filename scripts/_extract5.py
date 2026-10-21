# -*- coding: utf-8 -*-
import re
P = r"C:\Users\张宏飞\russian-learning-frontend\scripts\_online_bundle.js"
src = open(P, encoding="utf-8").read()

def show(kw, before=100, after=2800, limit=2):
    idxs = [m.start() for m in re.finditer(re.escape(kw), src)]
    print(f"\n##### '{kw}' hits: {len(idxs)}")
    for i in idxs[:limit]:
        seg = src[max(0, i-before): i+after]
        print(seg)
        print("=" * 90)

show("isJudging")
