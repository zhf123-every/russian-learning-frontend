# -*- coding: utf-8 -*-
"""提取线上 QuestPractice 主组件词槽渲染与输入逻辑"""
import re
P = r"C:\Users\张宏飞\russian-learning-frontend\scripts\_online_bundle.js"
src = open(P, encoding="utf-8").read()

def show(kw, before=300, after=5500, limit=1):
    idxs = [m.start() for m in re.finditer(re.escape(kw), src)]
    print(f"\n##### '{kw}' hits: {len(idxs)}")
    for i in idxs[:limit]:
        print(src[max(0, i-before): i+after])
        print("=" * 90)

show("修正当前词")
