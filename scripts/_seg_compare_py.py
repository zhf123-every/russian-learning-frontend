# P1 5a 前后端逐字符一致性比对：normalizeSentence / splitTokens / sentence_hash
# 与前端 src/lib/segmentEngine.js 的规则逐字符一致（前端为基准，本脚本为 Python 参考实现）。
import hashlib, json, re, sys

# —— 与前端 RU_* 数组逐字符一致 ——
RU_N1 = ['ноль', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять', 'десять',
         'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать',
         'семнадцать', 'восемнадцать', 'девятнадцать']
RU_N10 = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто']
RU_N100 = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот']
RU_N1000 = ['', 'тысяча', 'две тысячи', 'три тысячи', 'четыре тысячи', 'пять тысяч', 'шесть тысяч', 'семь тысяч', 'восемь тысяч', 'девять тысяч']

def number_to_russian(n):
    n = int(n)
    if n < 0:
        return '-' + number_to_russian(-n)
    if n < 20:
        return RU_N1[n]
    if n < 100:
        s = RU_N10[n // 10] + ((' ' + RU_N1[n % 10]) if n % 10 else '')
        return s.strip()
    if n < 1000:
        s = RU_N100[n // 100] + ((' ' + number_to_russian(n % 100)) if n % 100 else '')
        return s.strip()
    if n < 10000:
        s = RU_N1000[n // 1000] + ((' ' + number_to_russian(n % 1000)) if n % 1000 else '')
        return s.strip()
    return str(n)

def russianize_numbers(text):
    return re.sub(r'\d+', lambda m: number_to_russian(int(m.group(0))), str(text or ''))

def normalize_sentence(text):
    s = str(text or '').strip()
    if not s:
        return ''
    return russianize_numbers(s)

def split_tokens(sentence):
    raw = [w for w in re.split(r'\s+', str(sentence or '').strip()) if w]
    tokens = []
    for w in raw:
        if re.fullmatch(r'[.,!?;:…]+', w) and tokens:
            tokens[-1] += w
        else:
            tokens.append(w)
    return tokens

def sentence_hash(text, difficulty):
    return hashlib.sha256(normalize_sentence(text).encode('utf-8')).hexdigest()[:16]

SENTENCES = [
    'Этому городу уже 500 лет.',
    'Я люблю книгу.',
    'Он читает книгу в школе.',
    'На улице Чистые пруды находится театр «Современник».',
    'Антон спросил Тома , куда он пошёл вечером .',
]

out = []
for s in SENTENCES:
    out.append({
        'sentence': s,
        'normalized': normalize_sentence(s),
        'tokens': split_tokens(s),
        'hash_easy': sentence_hash(s, 'easy'),
    })
with open('_seg_compare_py_out.json', 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=2)
print('PY_DONE items=%d' % len(out))
for o in out:
    print(json.dumps(o, ensure_ascii=False))
