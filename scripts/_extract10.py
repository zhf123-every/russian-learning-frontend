# -*- coding: utf-8 -*-
import re
P = r"C:\Users\张宏飞\russian-learning-frontend\scripts\_online_bundle.js"
src = open(P, encoding="utf-8").read()

# 调用点：nameWords: 出现在对象参数中
for m in re.finditer(r"nameWords:", src):
    seg = src[max(0, m.start()-800): m.start()+1600]
    print(seg)
    print("=" * 90)
    break

# 也找 ordinaryWords: 调用点
for m in re.finditer(r"ordinaryWords:", src):
    seg = src[max(0, m.start()-400): m.start()+900]
    print("ORD:", seg)
    print("=" * 90)
    break
