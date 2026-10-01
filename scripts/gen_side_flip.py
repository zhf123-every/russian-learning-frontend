# -*- coding: utf-8 -*-
"""
悟空"标准侧视后空翻"24 帧生成器 v2
素材：side-stand.webp（面向右侧身站立）+ side-tuck.webp（空中团身抱膝）
三段式动作：站立起跳(0-90°) → 团身翻滚(90-210°，身体蜷成球) → 展开落地(210-360°)
关键修复：统一"最长边"缩放（主体视觉大小恒定，无忽大忽小、无过度放大锯齿）
输出：public/images/ai-assistant/anim/side-flip-00.webp .. side-flip-23.webp（512x512 RGBA）
"""
import os
import math
from PIL import Image

BASE = r'C:\Users\张宏飞\Desktop\website_source\russian-learning-frontend-main\public\images\ai-assistant'
OUT = os.path.join(BASE, 'anim')
os.makedirs(OUT, exist_ok=True)

MAX_EDGE = 390   # 主体最长边统一值（站立=高390；横躺=宽390；配合 dy 峰值不越界）

def load_body(name):
    im = Image.open(os.path.join(BASE, name + '.webp')).convert('RGBA')
    bbox = im.getbbox()
    return im.crop(bbox) if bbox else im

STAND = load_body('side-stand')
TUCK = load_body('side-tuck')

def render(body, angle_deg, dy):
    im = body.rotate(angle_deg, center=(body.size[0]/2, body.size[1]*0.55), expand=True, resample=Image.BICUBIC)
    b2 = im.getbbox()
    c = im.crop(b2)
    # 边缘去杂色：alpha 过低视为透明（putalpha 为就地修改，不接收返回值）
    a = c.getchannel('A')
    c.putalpha(a.point(lambda x: 0 if x < 10 else x))
    c = c.crop(c.getbbox())
    w2, h2 = c.size
    m = max(w2, h2)
    sc = MAX_EDGE / m
    c = c.resize((max(1, int(w2 * sc)), max(1, int(h2 * sc))), Image.LANCZOS)
    canvas = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
    canvas.paste(c, ((512 - c.size[0]) // 2, (512 - c.size[1]) // 2 + int(dy)), c)
    return canvas

for i in range(24):
    if i <= 7:        # 起跳段：站立，0°→90°
        body, angle = STAND, i * (90 / 7)
    elif i <= 15:     # 团身段：团身，90°→210°
        body, angle = TUCK, 90 + (i - 8) * 15
    else:             # 展开落地段：站立，210°→360°
        body, angle = STAND, 210 + (i - 16) * (150 / 7)
    dy = -60 * math.sin(math.radians(angle) / 2)
    im = render(body, angle, dy)
    fp = os.path.join(OUT, 'side-flip-%02d.webp' % i)
    im.save(fp, 'WEBP', quality=88, method=6)
    print('side-flip-%02d.webp' % i, 'angle=%.1f dy=%d' % (angle, dy), os.path.getsize(fp))
