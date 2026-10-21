# -*- coding: utf-8 -*-
"""精确定位 'Где Анна? Она дома.' 的语块数据"""
import json

P = r"C:\Users\张宏飞\russian-learning-frontend\scripts\_segments_unit.json"
d = json.load(open(P, encoding="utf-8"))
items = d.get("items", [])

for it in items:
    seg = it.get("segments")
    s = json.dumps(seg, ensure_ascii=False)
    if "Где Анна" in s or "Анна? Она" in s:
        print("hash:", it["sentence_hash"], "| diff:", it["difficulty"], "| trans:", it["translation"])
        print(json.dumps(seg, ensure_ascii=False, indent=1))
        print("=" * 60)
