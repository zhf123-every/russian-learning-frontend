# -*- coding: utf-8 -*-
"""解析 segments 字段，找 Где Анна 相关语块"""
import json

P = r"C:\Users\张宏飞\russian-learning-frontend\scripts\_segments_unit.json"
d = json.load(open(P, encoding="utf-8"))
items = d.get("items", [])

# 查看 segments 字段类型
print("segments type:", type(items[0].get("segments")))
print("first segments:", json.dumps(items[0].get("segments"), ensure_ascii=False)[:500])

# 遍历所有 segments 找 Где Анна
found = 0
for it in items:
    seg = it.get("segments")
    s = json.dumps(seg, ensure_ascii=False)
    if "Где" in s or "Анн" in s or "дома" in s:
        found += 1
        print("\n---", it["sentence_hash"], it["difficulty"], "trans:", it["translation"])
        print(s[:1500])
print("\ntotal hits:", found)
