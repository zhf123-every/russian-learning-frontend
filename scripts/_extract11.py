# -*- coding: utf-8 -*-
"""提取线上 useQuestionInput 的 submitAnswer / handleKeyboardInput 逻辑"""
import re
P = r"C:\Users\张宏飞\russian-learning-frontend\scripts\_online_bundle.js"
src = open(P, encoding="utf-8").read()

# 找 submitAnswer 定义：函数体里应包含词数判断/后端提交
# useQuestionInput 返回对象里有 submitAnswer:vr，找 const vr= 的定义
# 搜索 "submitToBackend" 的赋值与使用
for m in re.finditer(r"const vr=", src):
    seg = src[m.start(): m.start()+3500]
    if "answer" in seg or "submit" in seg.lower():
        print("=== vr (submitAnswer?) ===")
        print(seg[:3500])
        print("=" * 90)
        break

for m in re.finditer(r"const Yt=", src):
    seg = src[m.start(): m.start()+1800]
    print("=== Yt ===")
    print(seg[:1800])
    print("=" * 90)
    break

for m in re.finditer(r"const Zr=", src):
    seg = src[m.start(): m.start()+3000]
    if "Space" in seg or "Backspace" in seg:
        print("=== Zr (handleKeyboardInput?) ===")
        print(seg[:3000])
        print("=" * 90)
        break

for m in re.finditer(r"const Qt=", src):
    seg = src[m.start(): m.start()+2000]
    if "Enter" in seg:
        print("=== Qt (handleInputKeyDown?) ===")
        print(seg[:2000])
        print("=" * 90)
        break
