# -*- coding: utf-8 -*-
"""videos/list 完整数据下载到本地文件，再本地搜索"""
import json, urllib.request, time

BASE = "https://russian-learning-jetq.onrender.com"
OUT = r"C:\Users\张宏飞\russian-learning-frontend\scripts\_videos_full.json"

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

raw = get(f"{BASE}/api/videos/list")
if raw:
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(raw)
    print("saved", len(raw), "bytes")
    # 快速字符串搜索
    for kw in ["Где Анна", "Анна? Она", "Анна? Анна", "安娜在哪里", "Где она", "Она дома"]:
        print(kw, "->", raw.count(kw))
else:
    print("FAILED")
