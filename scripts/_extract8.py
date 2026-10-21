# -*- coding: utf-8 -*-
import re
P = r"C:\Users\张宏飞\russian-learning-frontend\scripts\_online_bundle.js"
src = open(P, encoding="utf-8").read()

def show(kw, before=100, after=2500, limit=1):
    idxs = [m.start() for m in re.finditer(re.escape(kw), src)]
    print(f"\n##### '{kw}' hits: {len(idxs)}")
    for i in idxs[:limit]:
        print(src[max(0, i-before): i+after])
        print("=" * 90)

# 找 useQuestionInput 调用处（nameWords/ordinaryWords 参数）
show("nameWords")
