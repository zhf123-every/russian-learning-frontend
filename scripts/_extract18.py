# -*- coding: utf-8 -*-
import re
P = r"C:\Users\张宏飞\russian-learning-frontend\scripts\_online_bundle.js"
src = open(P, encoding="utf-8").read()

idxs = [m.start() for m in re.finditer(r"isPlaceStem", src)]
print("出现次数:", len(idxs))
for i in idxs[:8]:
    print("\n--- at", i, "---")
    print(src[max(0,i-150): i+600])
