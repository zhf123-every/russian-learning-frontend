# -*- coding: utf-8 -*-
import re
P = r"C:\Users\张宏飞\russian-learning-frontend\scripts\_online_bundle.js"
src = open(P, encoding="utf-8").read()

# 找带 nameWords 的 useQuestionInput 调用
for mm in re.finditer(r"useQuestionInput\(\{", src):
    seg = src[mm.start(): mm.start()+1500]
    if "nameWords" in seg:
        print("=== 带 nameWords 的调用 ===")
        print(seg[:1500])
        print("=" * 90)
        break

# 提取 useQuestionInput 完整函数体到可读文件
m = re.search(r"function useQuestionInput\(\{", src)
body = src[m.start(): m.start()+18500]
# 用分号缩进美化输出关键函数
print("\n=== 函数体开头 6000 字符 ===")
print(body[:6000])
