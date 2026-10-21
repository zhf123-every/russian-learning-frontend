# -*- coding: utf-8 -*-
"""提取线上 QuestPractice 输入相关代码：词槽渲染、onKeyDown、onChange、后端判题"""
import re

P = r"C:\Users\张宏飞\russian-learning-frontend\scripts\_online_bundle.js"
src = open(P, encoding="utf-8").read()

def show(kw, before=200, after=2200, limit=1):
    idxs = [m.start() for m in re.finditer(re.escape(kw), src)]
    print(f"\n##### '{kw}' hits: {len(idxs)}")
    for i in idxs[:limit]:
        seg = src[max(0, i-before): i+after]
        print(seg)
        print("=" * 80)

# 词槽渲染：找"下划线"相关的词槽组件
show("quest-word")
