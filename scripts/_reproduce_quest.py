# -*- coding: utf-8 -*-
"""复现 QuestPractice 题目生成：adaptLocalLesson + expandSequencesWithChunks
计算 totalUnits 与第 123 题内容
"""
import json, re

P = r"C:\Users\张宏飞\russian-learning-frontend\scripts\_videos_full.json"
d = json.load(open(P, encoding="utf-8"))
videos = d.get("videos", [])
u5 = videos[0]["units"][5]
sentences = u5["sentences"]
print("sentences:", len(sentences))

# ---- 复现 splitSentenceToChunks ----
FIXED_PHRASES = set([
  "в магазине", "в школе", "в университете", "в институте", "в библиотеке",
  "в центре", "в городе", "в парке", "в театре", "в кино", "в кафе",
  "в ресторане", "в комнате", "в классе", "в аудитории", "в музее",
  "на работе", "на улице", "на столе", "на уроке", "на занятиях",
  "на каникулах", "на даче", "на почте", "на станции",
  "каждый день", "каждый вечер", "каждое утро", "каждую неделю",
  "в субботу", "в воскресенье", "в понедельник", "во вторник", "в среду",
  "в четверг", "в пятницу", "вчера вечером", "сегодня утром", "в прошлом году",
  "в этом году", "в будущем году", "через год", "через месяц", "через неделю",
  "в пять часов", "в шесть часов", "в семь часов", "в восемь часов",
  "в девять часов", "в десять часов", "в одиннадцать часов", "в двенадцать часов",
  "доброе утро", "добрый день", "добрый вечер", "спокойной ночи",
  "спасибо большое", "большое спасибо", "очень хорошо", "очень плохо",
  "очень интересно", "очень красиво", "очень вкусно", "очень много",
  "ничего страшного", "конечно можно", "приятно познакомиться",
  "извините пожалуйста", "до свидания", "всего хорошего",
  "по-русски", "по-английски", "по-немецки", "по-французски", "по-китайски",
  "русский язык", "английский язык", "родной язык", "иностранный язык",
  "русский язык хорошо", "немного по-русски",
  "мой друг", "моя семья", "моя мама", "мой папа", "моя сестра", "мой брат",
  "моя подруга", "мой дедушка", "моя бабушка", "его брат", "её сестра",
  "у меня", "у тебя", "у нас", "у вас", "у него", "у неё", "у них",
  "это мой", "это моя", "это моё", "это мои",
  "все вместе", "друг друга", "друг с другом", "вместе с другом",
  "не знаю", "не понимаю", "не помню", "не хочу", "не могу",
  "я хочу", "я знаю", "я думаю", "я считаю", "я надеюсь",
  "можно войти", "можно спросить", "можно посмотреть", "можно открыть",
  "конечно хочу", "пожалуйста помогите",
])
PUNCT = set([".", ",", "!", "?", ";", ":", "…", "—", "–"])
DEMONSTRATIVES = set([
  "это", "этот", "эта", "эти", "тот", "та", "те",
  "такой", "такая", "такое", "такие",
])

def splitTokens(ru):
    return re.findall(r"[А-Яа-яЁё]+(?:-[А-Яа-яЁё]+)?|[.,!?;:…—–]", ru or "")

def splitSentenceToChunks(ru):
    toks = splitTokens(ru)
    chunks = []
    i = 0
    while i < len(toks):
        t = toks[i]
        if t in PUNCT:
            if chunks:
                chunks[-1] += t
            i += 1
            continue
        nxt = toks[i + 1] if i + 1 < len(toks) else None
        if nxt and nxt not in PUNCT:
            if t + " " + nxt in FIXED_PHRASES:
                chunks.append(t + " " + nxt)
                i += 2
                continue
            if t.lower() in DEMONSTRATIVES:
                chunks.append(t + " " + nxt)
                i += 2
                continue
        chunks.append(t)
        i += 1
    while len(chunks) > 7:
        a = chunks.pop()
        b = chunks.pop()
        chunks.append(b + " " + a)
    return [c for c in chunks if c]

# ---- adaptLocalLesson（无 words → 每句一题）----
units = []
for idx, st in enumerate(sentences):
    ru = st.get("ru", "")
    tokens = [t for t in ru.split() if t]
    units.append({
        "id": f"local_{idx+1}",
        "sequenceId": "local",
        "sequenceOrder": idx + 1,
        "russian": ru,
        "stressMarked": " ".join(tokens),
        "chinese": st.get("zh", ""),
        "words": [{"order": i, "form": w, "lemma": w} for i, w in enumerate(tokens)],
        "acceptableAnswers": [{"wordOrder": list(range(len(tokens))), "wordVariants": {}, "isDefault": True, "note": ""}],
    })
print("adapted units:", len(units))

# ---- expandSequencesWithChunks ----
def expandUnitToChunkSteps(unit):
    ru = (unit.get("russian") or "").strip()
    if not ru:
        return None
    chunks = splitSentenceToChunks(ru)
    if len(chunks) < 2:
        return None
    N = len(chunks)
    cum = lambda k: " ".join(chunks[:k+1])
    steps = []
    steps.append({"russian": cum(0), "isNew": True, "isFinal": N == 1, "chunks": [chunks[0]], "orig": ru})
    for k in range(1, N):
        steps.append({"russian": chunks[k], "isNew": True, "isFinal": False, "chunks": [chunks[k]], "orig": ru})
        steps.append({"russian": cum(k), "isNew": False, "isFinal": k == N - 1, "chunks": chunks[:k+1], "orig": ru})
    return steps

expanded = []
for u in units:
    steps = expandUnitToChunkSteps(u)
    if steps is None:
        expanded.append(u)
    else:
        for s in steps:
            uu = dict(u)
            uu["russian"] = s["russian"]
            uu["isNew"] = s["isNew"]
            uu["isFinal"] = s["isFinal"]
            uu["chunkList"] = s["chunks"]
            uu["orig"] = s["orig"]
            expanded.append(uu)

print("expanded totalUnits:", len(expanded))

# ---- granularityOfUnit ----
def granularityOfUnit(u):
    if u.get("chunkIsFinal"):
        return "sentence"
    if u.get("chunkIsNew"):
        return "word" if u.get("token_count", 0) <= 1 else "chunk"
    if u.get("chunkIsCumulative"):
        return "comb"
    n = u.get("token_count", 0)
    if n <= 1:
        return "word"
    if n <= 3:
        return "chunk"
    return "comb"

for u in expanded:
    u["token_count"] = len(u["russian"].split())

# ---- 各难度过滤 ----
def filter_by(granularities):
    return [u for u in expanded if granularityOfUnit(u) in granularities]

for name, g in [("beginner(全部)", None), ("intermediate", {"chunk","comb","sentence"}), ("advanced", {"sentence"}), ("custom全粒度", {"word","chunk","comb","sentence"})]:
    if g is None:
        cnt = len(expanded)
    else:
        cnt = len(filter_by(g))
    print(f"{name}: {cnt}")

# 统计各粒度数量
from collections import Counter
print("granularity counts:", Counter(granularityOfUnit(u) for u in expanded))

# 找第 123 题（beginner 全量）
t123 = expanded[122]
print("\n=== beginner 第 123 题 ===")
print("russian:", t123["russian"])
print("orig:", t123.get("orig"))
print("chunkIsNew:", t123.get("chunkIsNew"), "chunkIsCumulative:", t123.get("chunkIsCumulative"), "chunkIsFinal:", t123.get("chunkIsFinal"))
print("chinese:", t123.get("chinese"))
