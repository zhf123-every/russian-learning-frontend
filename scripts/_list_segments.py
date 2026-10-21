# -*- coding: utf-8 -*-
"""列出 segments 中所有含 Анна/дома/Где 的完整拼接句"""
import json
from collections import defaultdict

P = r"C:\Users\张宏飞\russian-learning-frontend\scripts\_segments_unit.json"
d = json.load(open(P, encoding="utf-8"))
items = d.get("items", [])

ok_items = [it for it in items if it.get("status") == "ok" and isinstance(it.get("segments"), list) and it.get("segments")]
print("ok items:", len(ok_items), "/ total:", len(items))

by_hash = defaultdict(list)
for it in ok_items:
    by_hash[it["sentence_hash"]].append(it)
print("distinct sentences:", len(by_hash))

for h, group in by_hash.items():
    for it in group:
        segs = sorted(it["segments"], key=lambda s: s.get("sort_order", 0))
        full = " ".join(s.get("text", "") for s in segs).strip()
        if "Анна" in full or "дома" in full or "Где" in full:
            print(f"[{h}] {it['difficulty']:6s} | {full} | trans: {it['translation']} | segs={len(segs)}")
