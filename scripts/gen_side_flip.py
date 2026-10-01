# -*- coding: utf-8 -*-
"""
悟空"标准侧视后空翻"24 帧生成器
素材：side-stand.webp（面向右的侧身站立悟空，抠图透明）
原理：侧身图绕重心逆时针旋转 360°（头 上→左→下→右→上 = 标准的"从前往后"后空翻路径），
      叠加抛物线位移（倒立点最高）+ 空中收腿（scaleX 收缩，倒立时最蜷）
输出：public/images/ai-assistant/anim/side-flip-00.webp .. side-flip-23.webp（512x512 RGBA）
"""
import os
import math
from PIL import Image

BASE = r'C:\Users\张宏飞\Desktop\website_source\russian-learning-frontend-main\public\images\ai-assistant'
OUT = os.path.join(BASE, 'anim')
os.makedirs(OUT, exist_ok=True)

src = Image.open(os.path.join(BASE, 'side-stand.webp')).convert('RGBA')
bbox = src.getbbox()
body = src.crop(bbox) if bbox else src
bw, bh = body.size

TARGET_H = 470   # 主体统一高度
N = 24           # 24 帧，每 15° 一步

def render(angle_deg, dy, scale_x):
    im = body.rotate(angle_deg, center=(bw/2, bh*0.55), expand=True, resample=Image.BICUBIC)
    b2 = im.getbbox()
    c = im.crop(b2)
    w2, h2 = c.size
    sc = TARGET_H / h2
    c = c.resize((max(1, int(w2*sc*scale_x)), TARGET_H), Image.LANCZOS)
    canvas = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
    canvas.paste(c, ((512 - c.size[0]) // 2, (512 - TARGET_H) // 2 + int(dy)), c)
    return canvas

for i in range(N):
    angle = i * 15                     # 0..345，逆时针（向后翻）
    rad = math.radians(angle)
    sinv = math.sin(rad / 2)           # 0 -> 1 -> 0（0°→180°→360°）
    dy = -105 * sinv                   # 抛物线：倒立点最高
    scale_x = 1 - 0.16 * sinv          # 空中收腿：倒立时最蜷
    im = render(angle, dy, scale_x)
    fp = os.path.join(OUT, 'side-flip-%02d.webp' % i)
    im.save(fp, 'WEBP', quality=88, method=6)
    print('side-flip-%02d.webp' % i, 'angle=%d dy=%d sx=%.2f' % (angle, dy, scale_x), os.path.getsize(fp))
