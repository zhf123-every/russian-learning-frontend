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
# 动作链：站立→半蹲→屈膝蓄力→蹬地跳起→腾空→弓身横转→弓身下翻→蜷缩倒立→
#         斜倒立→竖直倒立→蜷曲翻越→屈膝落地→站稳（全程身体姿态变化，无"站立姿态旋转"帧）
FRAMES = [
    ('stand', 0, 0),        # 0 直立站立
    ('blend', 0, 0),        # 1 半蹲（混合）
    ('squat', 0, 0),        # 2 屈膝蓄力
    ('flip1', 0, -30),      # 3 蹬地跳起
    ('flip2', 0, -80),      # 4 腾空
    ('flip3', -60, -108),   # 5 弓身横转（蜷缩转回60°，身体横躺）
    ('flip3', -30, -112),   # 6 弓身下翻（蜷缩转回30°）
    ('flip3', 0, -112),     # 7 蜷缩倒立
    ('flip4', -10, -104),   # 8 斜倒立渐入
    ('flip4', 0, -98),      # 9 斜倒立
    ('flip5', -8, -96),     # 10 竖直倒立渐入
    ('flip5', 0, -92),      # 11 完全倒立
    ('flip3', 45, -80),     # 12 蜷曲翻越（倒立继续翻，头朝左下）
    ('flip3', 30, -64),     # 13 蜷曲翻越（继续翻越）
    ('flip3', 15, -48),     # 14 蜷曲翻越（接近横躺回正）
    ('flip3', 5, -34),      # 15 蜷曲翻越（回正前）
    ('flip8', -10, -20),    # 16 屈膝落地渐入
    ('flip8', 0, -8),       # 17 屈膝落地
    ('blend2', 0, 0),       # 18 落地站稳（屈膝→直立的过渡）
    ('stand', 0, 0),        # 19 直立站稳
]

def render(src, angle, dy):
    if src == 'blend':
        a = norm(stand)
        b = norm(squat)
        out = Image.blend(a, b, 0.5)
    elif src == 'blend2':
        a = norm(S['flip8'])
        b = norm(stand)
        out = Image.blend(a, b, 0.45)
    else:
        out = norm(S[src])
    if angle:
        out = out.rotate(angle, center=(256, 256), resample=Image.BICUBIC)
        bbox2 = out.getbbox()
        if bbox2:
            c = out.crop(bbox2)
            w2, h2 = c.size
            sc = TARGET_H / h2
            c = c.resize((max(1, int(w2 * sc)), TARGET_H), Image.LANCZOS)
            tmp = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
            tmp.paste(c, ((512 - c.size[0]) // 2, (512 - TARGET_H) // 2 + dy), c)
            out = tmp
        return out
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
