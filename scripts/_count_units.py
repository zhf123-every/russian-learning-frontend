# -*- coding: utf-8 -*-
"""计算 segments 各档题目数"""
import json
from collections import defaultdict

P = r"C:\Users\张宏飞\russian-learning-frontend\scripts\_segments_unit.json"
d = json.load(open(P, encoding="utf-8"))
items = d.get("items", [])

ok_items = [it for it in items if it.get("status") == "ok" and isinstance(it.get("segments"), list) and it.get("segments")]
print("ok items:", len(ok_items))

# 按 sentence_hash + difficulty 分组 → sequence；计算每个 sequence 的 units 数
by_key = defaultdict(list)
for it in ok_items:
    by_key[(it["sentence_hash"], it["difficulty"])].append(it)

seq_count = {"easy": 0, "medium": 0, "hard": 0}
unit_count = {"easy": 0, "medium": 0, "hard": 0}
for (h, diff), group in by_key.items():
    segs = sorted(group[0]["segments"], key=lambda s: s.get("sort_order", 0))
    seq_count[diff] += 1
    if diff == "easy":
        unit_count[diff] += len(segs) + 1  # 零件题 + 组装题
    else:
        unit_count[diff] += 1  # 只组装

print("sequences per diff:", seq_count)
print("units per diff:", unit_count)
print("easy sequences:", seq_count["easy"], "easy units:", unit_count["easy"])
print("TOTAL easy+medium+hard units:", sum(unit_count.values()))
