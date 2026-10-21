# -*- coding: utf-8 -*-
"""抓取 videos/list 中所有课程 units 完整数据，搜索 Где Анна / 安娜在哪里"""
import json, urllib.request, time

BASE = "https://russian-learning-jetq.onrender.com"

def get(url, tries=4):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            print("retry", i + 1, e)
            time.sleep(2 * (i + 1))
    return None

d = get(f"{BASE}/api/videos/list")
videos = d.get("videos", [])
print("videos:", len(videos))

def walk(obj, path=""):
    """递归搜索包含 Где Анна 或 安娜在哪里 的字符串"""
    found = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            found += walk(v, f"{path}.{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            found += walk(v, f"{path}[{i}]")
    elif isinstance(obj, str):
        if "Где Анна" in obj or "Анна? Она" in obj or "Анна? Анна" in obj or "安娜在哪里" in obj or "Где она" in obj:
            found.append((path, obj[:200]))
    return found

for v in videos:
    vid = v.get("id", "")
    title = v.get("title", "")
    units = v.get("units")
    print(f"\n=== course {vid} | {title} | units type={type(units).__name__} ===")
    if isinstance(units, list):
        print("units count:", len(units))
        for u in units:
            uid = u.get("id") if isinstance(u, dict) else None
            sents = u.get("sentences") if isinstance(u, dict) else None
            paths = u.get("scaffoldingPaths") if isinstance(u, dict) else None
            print(f"  unit {uid} | sentences={len(sents) if isinstance(sents, list) else '?'} paths={len(paths) if isinstance(paths, list) else '?'}")
        hits = walk(units)
        for h in hits:
            print("  HIT:", h)
    else:
        print("units not list:", str(units)[:200])
