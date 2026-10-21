# -*- coding: utf-8 -*-
"""遍历线上后端所有单元数据，搜索 Где Анна 相关句子"""
import json, urllib.request

BASE = "https://russian-learning-jetq.onrender.com"

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))

raw = get(f"{BASE}/api/course-packs/privet_rossiya_a1/units")
units = raw["data"]["units"] if isinstance(raw.get("data"), dict) and "units" in raw["data"] else raw["data"]
print("units count:", len(units))

hits = []
for u in units:
    uid = u["id"]
    # build-steps
    try:
        d = get(f"{BASE}/api/units/{uid}/build-steps?course_id=privet_rossiya_a1")
        for fam in d.get("data", {}).get("families", []):
            for s in fam.get("steps", []):
                t = s.get("target_sentence", "")
                if "Где" in t or "Анн" in t:
                    hits.append(f"[build-steps {uid}] {fam.get('family_name')} | {s.get('step_order')} | {t} | {s.get('chinese')}")
    except Exception as e:
        print("ERR build-steps", uid, e)
    # slot-tables
    try:
        d = get(f"{BASE}/api/slot-tables?course_id=privet_rossiya_a1&unit_id={uid}")
        items = d.get("data", {}).get("items", []) if isinstance(d.get("data"), dict) else d.get("items", [])
        for it in items:
            t = it.get("russian") or it.get("sentence") or it.get("text") or ""
            zh = it.get("chinese") or it.get("zh") or ""
            if "Где" in t or "Анн" in t:
                hits.append(f"[slot-tables {uid}] {t} | {zh}")
    except Exception as e:
        print("ERR slot-tables", uid, e)

print("\n=== HITS ===")
for h in hits:
    print(h)
print("total hits:", len(hits))
