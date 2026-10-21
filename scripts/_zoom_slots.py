# -*- coding: utf-8 -*-
"""裁剪词槽区域并放大"""
from PIL import Image
src = r"C:\Users\张宏飞\AppData\Local\Doubao\User Data\ClipboardTemp\74f5f4c2-ca5e-43d0-830b-d87f92bacf3a.png"
im = Image.open(src)
W, H = im.size
print("size:", W, H)
# 词槽 y: 610-675 千分比 -> 像素
y0, y1 = int(610/1000*H), int(675/1000*H)
# x: 300-700 千分比
x0, x1 = int(300/1000*W), int(700/1000*W)
crop = im.crop((x0, y0, x1, y1))
crop = crop.resize((crop.width*3, crop.height*3), Image.LANCZOS)
out = r"C:\Users\张宏飞\russian-learning-frontend\scripts\_slots_zoom.png"
crop.save(out)
print("saved", out)
