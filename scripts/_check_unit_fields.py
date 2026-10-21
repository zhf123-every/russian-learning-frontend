# -*- coding: utf-8 -*-
"""检查 unit_1791571105350 的 words/scaffoldingPaths/chunks 字段"""
import json

P = r"C:\Users\张宏飞\russian-learning-frontend\scripts\_videos_full.json"
d = json.load(open(P, encoding="utf-8"))
videos = d.get("videos", [])
v0 = videos[0]
units = v0.get("units", [])
u5 = units[5]
print("unit keys:", list(u5.keys()))
print("id:", u5.get("id"))
print("title:", u5.get("title"))
words = u5.get("words")
print("words type:", type(words).__name__, "len:", len(words) if isinstance(words, list) else words)
if isinstance(words, list) and words:
    print("first 5 words:", json.dumps(words[:5], ensure_ascii=False))
paths = u5.get("scaffoldingPaths")
print("scaffoldingPaths:", type(paths).__name__, len(paths) if isinstance(paths, list) else paths)
# 检查 sentence 是否有 chunks
s122 = u5["sentences"][122]
print("sentence[122] keys:", list(s122.keys()))
# 检查所有句子是否有 chunks 字段
has_chunks = sum(1 for s in u5["sentences"] if isinstance(s, dict) and s.get("chunks"))
print("sentences with chunks:", has_chunks, "/", len(u5["sentences"]))
