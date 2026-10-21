# -*- coding: utf-8 -*-
import re
P = r"C:\Users\张宏飞\russian-learning-frontend\scripts\_online_bundle.js"
src = open(P, encoding="utf-8").read()

# 找 useQuestionInput 调用点：参数里有 nameWords 或 statementId 的对象字面量
for m in re.finditer(r"useQuestionInput\(\{", src):
    seg = src[m.start(): m.start()+2200]
    # 只打印包含 nameWords 或 statementId 的调用
    if "nameWords" in seg or "statementId" in seg:
        print(seg[:2200])
        print("=" * 90)
        break
