# -*- coding: utf-8 -*-
import re
P = r"C:\Users\张宏飞\russian-learning-frontend\scripts\_online_bundle.js"
src = open(P, encoding="utf-8").read()

# 1. vr（submitAnswer）完整代码：从 const vr= 到 },[
m = re.search(r"const vr=reactExports\.useCallback\(async\(\)=>", src)
seg = src[m.start(): m.start()+4500]
print("=== submitAnswer 完整 ===")
print(seg)
print("=" * 100)

# 2. 调用处是否传 nameWords（冒号形式）
print("\n=== nameWords: 调用参数出现次数 ===")
print(len(re.findall(r"nameWords:", src)))
