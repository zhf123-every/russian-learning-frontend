# -*- coding: utf-8 -*-
import re
p = r'C:\Users\张宏飞\Desktop\website_source\russian-learning-frontend-main\src\pages\Dashboard.jsx'
t = open(p, encoding='utf-8').read()

# 1) 外层灰底div + main p-3 替换为 fragment + home-grid(p-2 md:p-3)
pat1 = re.compile(r'return \(\s*\n\s*<div className="min-h-screen bg-gray-50 font-ui text-gray-900">\s*\n\s*<main className="flex-1 p-3 overflow-auto">')
t, n1 = pat1.subn('return (\n    <>\n      <div className="home-grid p-2 md:p-3">', t)

# 2) 删除旧的 <div className="home-grid"> 开标签（保留其内容）
pat2 = re.compile(r'\n\s*<div className="home-grid">')
t, n2 = pat2.subn('', t, count=1)

# 3) 删除 main 闭合 </main>（保留 grid 闭合 </div>）
pat3 = re.compile(r'\n\s*</main>')
t, n3 = pat3.subn('', t, count=1)

# 4) 末尾外层 div 闭合 -> fragment 闭合
pat4 = re.compile(r'\n    </div>\n  \)\n\}')
t, n4 = pat4.subn('\n    </>\n  )\n}', t, count=1)

open(p, 'w', encoding='utf-8', newline='').write(t)
print('OK', n1, n2, n3, n4)
