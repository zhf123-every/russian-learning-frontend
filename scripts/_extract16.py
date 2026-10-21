# -*- coding: utf-8 -*-
import re
P = r"C:\Users\张宏飞\russian-learning-frontend\scripts\_online_bundle.js"
src = open(P, encoding="utf-8").read()

base = 737257  # useQuestionInput 定义位置
body = src[base: base+20000]
# 在 body 内找 vr=
for m in re.finditer(r"vr=reactExports\.useCallback", body):
    print("vr at", base+m.start())
    seg = body[m.start(): m.start()+4500]
    print(seg)
    print("=" * 100)
    break
