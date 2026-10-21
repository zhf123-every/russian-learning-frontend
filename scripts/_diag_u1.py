# -*- coding: utf-8 -*-
"""重试 u1 build-steps，完整输出所有 Где/Анн 句子"""
import json, urllib.request, time

BASE = "https://russian-learning-jetq.onrender.com"

def get(url, tries=5):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            print(f"retry {i+1}: {e}")
            time.sleep(2.5 * (i + 1))
    return None

d = get(f"{BASE}/api/units/u1/build-steps?course_id=privet_rossiya_a1")
if not d:
    print("FAILED")
else:
    fams = d.get("data", {}).get("families", [])
    print("families:", len(fams))
    for fam in fams:
        print(f"\n== {fam.get('family_name')} | seq={fam.get('sequence_id')} | steps={len(fam.get('steps', []))}")
        for s in fam.get("steps", []):
            t = s.get("target_sentence", "")
            if "Где" in t or "Анн" in t or "дома" in t:
                print(f"  [{s.get('step_order')}] {t} | {s.get('chinese')}")
