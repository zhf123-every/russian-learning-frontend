# -*- coding: utf-8 -*-
"""下载该单元 segments 完整数据并检查 Где Анна 的语块"""
import json, urllib.request, time

BASE = "https://russian-learning-jetq.onrender.com"
OUT = r"C:\Users\张宏飞\russian-learning-frontend\scripts\_segments_unit.json"

def get(url, tries=5):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.read().decode("utf-8")
        except Exception as e:
            print("retry", i + 1, e)
            time.sleep(2.5 * (i + 1))
    return None

raw = get(f"{BASE}/api/segments?course_id=course_1790663451314&unit_id=unit_1791571105350")
with open(OUT, "w", encoding="utf-8") as f:
    f.write(raw)
print("saved", len(raw))

d = json.loads(raw)
items = d.get("items", [])
print("items:", len(items))

# 按 sentence_hash 聚合，找包含 Где Анна 或 Анна 的
from collections import defaultdict
by_hash = defaultdict(list)
for it in items:
    by_hash[it["sentence_hash"]].append(it)

# 需要 sentence_hash → 俄语原文映射。segments 里没有 russian？检查 keys
print("sample keys:", list(items[0].keys()))
