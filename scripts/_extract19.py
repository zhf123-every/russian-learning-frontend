# -*- coding: utf-8 -*-
import re
P = r"C:\Users\张宏飞\russian-learning-frontend\scripts\_online_bundle.js"
src = open(P, encoding="utf-8").read()

m = re.search(r"PLACE_STEMS", src)
start = src.rfind("=", 0, m.start())  # 找数组定义起点
seg = src[start-5: m.start()+4000]
print(seg)
