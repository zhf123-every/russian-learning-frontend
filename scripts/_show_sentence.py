# -*- coding: utf-8 -*-
"""输出 unit_1791571105350 中句子[122]的完整数据"""
import json

P = r"C:\Users\张宏飞\russian-learning-frontend\scripts\_videos_full.json"
d = json.load(open(P, encoding="utf-8"))
videos = d.get("videos", [])
v0 = videos[0]
units = v0.get("units", [])
u5 = units[5]
print("unit id:", u5.get("id"), "sentences:", len(u5.get("sentences", [])))
s122 = u5["sentences"][122]
print(json.dumps(s122, ensure_ascii=False, indent=2))
