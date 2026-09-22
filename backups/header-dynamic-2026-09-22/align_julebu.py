# -*- coding: utf-8 -*-
"""对齐句乐部：shell-card 圆角12+边框1px；header 高48+白底去分割线；title 500。"""
import io

p = r"C:\Users\张宏飞\Desktop\website_source\russian-learning-frontend-main\src\styles\dashboard.css"
with io.open(p, "r", encoding="utf-8", newline="") as f:
    lines = f.read().splitlines(True)  # keep line endings

out = []
i = 0
n = len(lines)

def find_block(start, key):
    """返回从包含 key 的行开始的连续块（直到闭括号行）。"""
    j = start
    while j < n and key not in lines[j]:
        j += 1
    if j >= n:
        return None, start
    k = j
    while k < n and '}' not in lines[k]:
        k += 1
    return j, k

# 1) shell-card 块
j, k = find_block(i, '.shell-card{')
if j is not None:
    block = lines[j:k+1]
    print("shell-card block:")
    for l in block: print("  |" + l.rstrip())
    # 替换圆角 16->12
    for idx in range(len(block)):
        if 'border-radius:16px' in block[idx]:
            block[idx] = block[idx].replace('border-radius:16px', 'border-radius:12px')
        if 'box-shadow:0 1px 3px rgba(0,0,0,.05)' in block[idx]:
            block[idx] = block[idx].replace('box-shadow:0 1px 3px rgba(0,0,0,.05)', 'box-shadow:0 1px 2px rgba(0,0,0,.04)')
    # 确保有 border 行（插在闭括号前）
    if not any('border:1px solid #e5e7eb' in l for l in block):
        indent = '  '
        block.insert(len(block)-1, indent + 'border:1px solid #e5e7eb;\n')
    lines[j:k+1] = block

# 2) shell-card-header 块
j, k = find_block(0, '.shell-card-header{')
if j is not None:
    block = lines[j:k+1]
    print("header block:")
    for l in block: print("  |" + l.rstrip())
    for idx in range(len(block)):
        if 'height:56px' in block[idx]:
            block[idx] = block[idx].replace('height:56px', 'height:48px')
        if 'background:#fafafa' in block[idx]:
            block[idx] = block[idx].replace('background:#fafafa', 'background:#fff')
        if 'border-bottom:1px solid #e5e7eb;' in block[idx]:
            block[idx] = block[idx].replace('border-bottom:1px solid #e5e7eb;', '')
    lines[j:k+1] = block

# 3) title（上一步已改 700->500，这里保险）
with io.open(p, "r", encoding="utf-8", newline="") as f:
    s = f.read()
s2 = s.replace('.shell-card-title{font-size:18px;font-weight:700;', '.shell-card-title{font-size:18px;font-weight:500;')
if s2 != s:
    with io.open(p, "w", encoding="utf-8", newline="") as f:
        f.write(s2)
    print("title OK")
else:
    with io.open(p, "w", encoding="utf-8", newline="") as f:
        f.write(''.join(lines))
    print("title unchanged (already 500 or missing)")

print("DONE")
