# -*- coding: utf-8 -*-
"""定位 Где Анна / 安娜在哪里 在 videos 数据中的位置"""
import json

P = r"C:\Users\张宏飞\russian-learning-frontend\scripts\_videos_full.json"
d = json.load(open(P, encoding="utf-8"))
videos = d.get("videos", [])

def walk(obj, path=""):
    found = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            found += walk(v, f"{path}.{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            found += walk(v, f"{path}[{i}]")
    elif isinstance(obj, str):
        if "Где Анна" in obj or "Анна? Она" in obj or "Анна? Анна" in obj or "安娜在哪里" in obj or "Она дома" in obj:
            found.append((path, obj))
    return found

for vi, v in enumerate(videos):
    title = v.get("title", "")
    vid = v.get("id", "")
    units = v.get("units", [])
    print(f"\n=== [{vi}] {vid} | {title} | units={len(units) if isinstance(units, list) else '?'} ===")
    if isinstance(units, list):
        for ui, u in enumerate(units):
            if not isinstance(u, dict):
                continue
            uid = u.get("id")
            sents = u.get("sentences", [])
            paths = u.get("scaffoldingPaths", [])
            txt = json.dumps(u, ensure_ascii=False)
            if any(kw in txt for kw in ["Где Анна", "Анна? Она", "安娜在哪里", "Она дома"]):
                print(f"  UNIT[{ui}] id={uid} sentences={len(sents) if isinstance(sents, list) else '?'} paths={len(paths) if isinstance(paths, list) else '?'}")
                for h in walk(u):
                    print("    HIT:", h[0], "=>", h[1])
