# -*- coding: utf-8 -*-
"""
悟空后空翻 20 帧补间生成器
关键帧：stand(直立) / squat(屈膝) / flip-1(蹬地跳起) / flip-2(腾空) /
        flip-3(蜷缩) / flip-4(倒立) / flip-5(竖直倒立) /
        flip-6(翻越下落) / flip-7(近直立下落) / flip-8(屈膝落地) / stand(站稳)
规则：姿态帧为 AI 真实姿态；姿态间仅做 ≤18° 渐入旋转 + 抛物线位移平滑过渡
输出：public/images/ai-assistant/anim/flip-00.webp .. flip-19.webp（512x512 RGBA）
"""
import os
from PIL import Image

BASE = r'C:\Users\张宏飞\Desktop\website_source\russian-learning-frontend-main\public\images\ai-assistant'
OUT = os.path.join(BASE, 'anim')
os.makedirs(OUT, exist_ok=True)

def load(name):
    p = os.path.join(BASE, name + '.webp')
    im = Image.open(p).convert('RGBA')
    bbox = im.getbbox()
    return im.crop(bbox) if bbox else im

stand = load('stand')
squat = load('squat')
f1 = load('flip-1')
f2 = load('flip-2')
f3 = load('flip-3')
f4 = load('flip-4')
f5 = load('flip-5')
f6 = load('flip-6')
f7 = load('flip-7')
f8 = load('flip-8')
S = {'stand': stand, 'squat': squat, 'flip1': f1, 'flip2': f2, 'flip3': f3,
     'flip4': f4, 'flip5': f5, 'flip6': f6, 'flip7': f7, 'flip8': f8}

TARGET_H = 470  # 主体统一高度，保证翻跟头时大小稳定

def norm(im):
    """等比例缩放到统一高度，并居中到 512x512 画布，返回画布"""
    w, h = im.size
    sc = TARGET_H / h
    nw = max(1, int(w * sc))
    im = im.resize((nw, TARGET_H), Image.LANCZOS)
    canvas = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
    canvas.paste(im, ((512 - nw) // 2, (512 - TARGET_H) // 2), im)
    return canvas

# 关键帧表: (源图, 渐入旋转角(往回转), 垂直位移dy)
FRAMES = [
    ('stand', 0, 0),
    ('blend', 0, 0),
    ('squat', 0, 0),
    ('flip1', 0, -30),
    ('flip2', 0, -80),
    ('flip3', -18, -108),
    ('flip3', -9, -112),
    ('flip3', 0, -112),
    ('flip4', -10, -104),
    ('flip4', 0, -98),
    ('flip5', -8, -96),
    ('flip5', 0, -92),
    ('flip6', -16, -78),
    ('flip6', -8, -62),
    ('flip6', 0, -48),
    ('flip7', -12, -36),
    ('flip7', 0, -24),
    ('flip8', -10, -14),
    ('flip8', 0, -5),
    ('stand', 0, 0),
]

def render(src, angle, dy):
    if src == 'blend':
        a = norm(stand)
        b = norm(squat)
        out = Image.blend(a, b, 0.5)
    else:
        im = norm(S[src])
        out = im
    if angle:
        out = out.rotate(angle, center=(256, 256), resample=Image.BICUBIC)
    if dy:
        tmp = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
        tmp.paste(out, (0, dy), out)
        out = tmp
    return out

for i, (src, angle, dy) in enumerate(FRAMES):
    im = render(src, angle, dy)
    fp = os.path.join(OUT, 'flip-%02d.webp' % i)
    im.save(fp, 'WEBP', quality=88, method=6)
    print('flip-%02d.webp' % i, src, angle, dy, os.path.getsize(fp))
