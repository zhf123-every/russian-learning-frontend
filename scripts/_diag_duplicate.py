# -*- coding: utf-8 -*-
"""诊断：查找 '安娜在哪里？她在家。' 的题目数据，检查 answer 是否重复人名"""
import sqlite3

DB = r"C:\Users\张宏飞\russian-learning\russian_learning.db"
con = sqlite3.connect(DB)
cur = con.cursor()

cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [r[0] for r in cur.fetchall()]
print("TABLES:", tables)

# 找到含句子的表
for t in tables:
    try:
        cur.execute(f"PRAGMA table_info('{t}')")
        cols = [c[1] for c in cur.fetchall()]
        if "chinese" in cols or "russian" in cols or "zh" in cols or "answer" in cols:
            print(f"\n=== TABLE {t} cols={cols} ===")
            # 打印所有含 '安娜' 的行
            for c in cols:
                if c in ("chinese", "zh", "text_zh", "cn"):
                    try:
                        cur.execute(f"SELECT * FROM '{t}' WHERE {c} LIKE '%安娜%' LIMIT 20")
                        rows = cur.fetchall()
                        for r in rows:
                            print(r)
                    except Exception as e:
                        print("  err", e)
                    break
    except Exception as e:
        print(t, "ERR", e)

con.close()
