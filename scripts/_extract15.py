# -*- coding: utf-8 -*-
import re
P = r"C:\Users\张宏飞\russian-learning-frontend\scripts\_online_bundle.js"
src = open(P, encoding="utf-8").read()

# 定位 vr: 搜 "if(lt===MODES$1.FIX||ft)return"
for kw in ["FIX||ft)return", "FIX||ft)return;", "MODES$1.FIX||ft"]:
    m = re.search(re.escape(kw), src)
    if m:
        print("found at", m.start(), "kw:", kw)
        # 往前找到 const vr=
        start = src.rfind("const vr=", 0, m.start())
        print("const vr= at", start)
        seg = src[start: m.start()+4000]
        print(seg)
        print("=" * 100)
        break
else:
    print("not found, try other")
    for kw in ["vr=reactExports.useCallback(async", "submitAnswer"]:
        idxs = [mm.start() for mm in re.finditer(re.escape(kw), src)]
        print(kw, idxs[:5])
