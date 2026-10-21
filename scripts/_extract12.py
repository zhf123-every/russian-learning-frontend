# -*- coding: utf-8 -*-
import re
P = r"C:\Users\张宏飞\russian-learning-frontend\scripts\_online_bundle.js"
src = open(P, encoding="utf-8").read()

# 1. useQuestionInput 函数体（从定义到下一个 4000 字符后的边界标记）
m = re.search(r"function useQuestionInput\(\{", src)
print("def at:", m.start())
body = src[m.start(): m.start()+30000]
# 找到函数体结束：匹配 "return{" 后的平衡？简化：截断到下一个 "}function " 或 22000 字符
end = body.find("}function")
print("end marker at:", end if end > 0 else "not found")
print("length:", len(body))

# 保存 body 到文件供分析
with open(r"C:\Users\张宏飞\russian-learning-frontend\scripts\_useQuestionInput_online.js", "w", encoding="utf-8") as f:
    f.write(body[:20000])
print("saved body 20000 chars")

# 2. 调用点：QuestPractice 里 useQuestionInput({ 参数
for mm in re.finditer(r"useQuestionInput\(\{", src):
    seg = src[mm.start(): mm.start()+1200]
    if "answerText" in seg and "nameWords" not in seg and "statementId" in seg:
        print("\n=== QuestPractice 调用点 ===")
        print(seg[:1200])
        break
