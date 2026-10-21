# -*- coding: utf-8 -*-
# 生成测试封面：1600x900 渐变+网格，PNG 体积故意做大(约1.5MB)以测试上传前压缩
from PIL import Image, ImageDraw
import os

w, h = 1600, 900
img = Image.new('RGB', (w, h))
px = img.load()
# 渐变（横向：红->蓝）加随机噪声纹理，增大 PNG 体积
import random
random.seed(42)
for y in range(h):
    for x in range(w):
        r = int(255 * x / w)
        b = int(255 * (1 - x / w))
        g = int(128 * y / h)
        n = random.randint(-18, 18)
        px[x, y] = (max(0, min(255, r + n)), max(0, min(255, g + n)), max(0, min(255, b + n)))

d = ImageDraw.Draw(img)
# 网格线
for x in range(0, w, 80):
    d.line([(x, 0), (x, h)], fill=(255, 255, 255), width=2)
for y in range(0, h, 80):
    d.line([(0, y), (w, y)], fill=(255, 255, 255), width=2)
# 中央方块标记（区别于 picsum 风景图）
d.rectangle([650, 300, 950, 600], fill=(0, 200, 80), outline=(255, 255, 255), width=8)
d.ellipse([720, 370, 880, 530], fill=(255, 220, 0))

out = r'C:\Users\张宏飞\Desktop\website_source\russian-learning-frontend-main\_cover_test_big.png'
img.save(out, 'PNG')
print('saved', out, os.path.getsize(out), 'bytes')
