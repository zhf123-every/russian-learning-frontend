# -*- coding: utf-8 -*-
"""完整复现 QuestPractice 题目序列（chunking 路径 + segments 路径 × 各难度）
目标：找到 totalUnits=172 且第 123 题 = 'Где Анна? Она дома.' 的组合
"""
import json, re
from collections import Counter

P = r"C:\Users\张宏飞\russian-learning-frontend\scripts\_videos_full.json"
d = json.load(open(P, encoding="utf-8"))
videos = d.get("videos", [])
u5 = videos[0]["units"][5]
sentences = u5["sentences"]
print("sentences:", len(sentences))

# ================= 切块引擎（与 chunking.js 一致） =================
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
DEMONSTRATIVES = set(["это", "этот", "эта", "эти", "тот", "та", "те", "такой", "такая", "такое", "такие"])

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
                chunks.append(t + " " + nxt); i += 2; continue
            if t.lower() in DEMONSTRATIVES:
                chunks.append(t + " " + nxt); i += 2; continue
        chunks.append(t)
        i += 1
    while len(chunks) > 7:
        a = chunks.pop(); b = chunks.pop(); chunks.append(b + " " + a)
    return [c for c in chunks if c]

# ================= adaptLocalLesson =================
units = []
for idx, st in enumerate(sentences):
    ru = st.get("ru", "")
    tokens = [t for t in ru.split() if t]
    units.append({
        "id": f"local_{idx+1}", "sequenceId": "local", "sequenceOrder": idx + 1,
        "russian": ru, "stressMarked": " ".join(tokens), "chinese": st.get("zh", ""),
        "words": [{"order": i, "form": w, "lemma": w} for i, w in enumerate(tokens)],
    })

# ================= expandUnitToChunkSteps =================
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
    steps.append({**unit, "russian": cum(0), "chunkIsNew": True, "chunkIsCumulative": False, "chunkIsFinal": N == 1, "chunkN": N, "chunkIndex": 0, "chunkList": chunks})
    for k in range(1, N):
        steps.append({**unit, "russian": chunks[k], "chunkIsNew": True, "chunkIsCumulative": False, "chunkIsFinal": False, "chunkN": N, "chunkIndex": k, "chunkList": chunks})
        steps.append({**unit, "russian": cum(k), "chunkIsNew": False, "chunkIsCumulative": True, "chunkIsFinal": k == N - 1, "chunkN": N, "chunkIndex": k, "chunkList": chunks})
    return steps

expanded = []
for u in units:
    steps = expandUnitToChunkSteps(u)
    if steps is None:
        expanded.append({**u, "keptAsIs": True})
    else:
        expanded.extend(steps)

print("chunking expanded:", len(expanded))

# ================= granularity =================
def granularityOfUnit(u):
    if u.get("chunkIsFinal"):
        return "sentence"
    if u.get("chunkIsNew"):
        return "word" if len(u["russian"].split()) <= 1 else "chunk"
    if u.get("chunkIsCumulative"):
        return "comb"
    n = len(u["russian"].split())
    if n <= 1: return "word"
    if n <= 3: return "chunk"
    return "comb"

print("chunking granularity:", Counter(granularityOfUnit(u) for u in expanded))

def filter_chunking(gran):
    return [u for u in expanded if granularityOfUnit(u) in gran]

# ================= segments 路径 =================
SEG = r"C:\Users\张宏飞\russian-learning-frontend\scripts\_segments_unit.json"
segd = json.load(open(SEG, encoding="utf-8"))
items = [it for it in segd.get("items", []) if it.get("status") == "ok" and isinstance(it.get("segments"), list) and it.get("segments")]

# segmentsToSequences
seqs = []
bySentence = {}
for it in items:
    h = it["sentence_hash"]
    bySentence.setdefault(h, []).append(it)
sentence_no = 0
seg_all_units = []
for h, group in bySentence.items():
    sentence_no += 1
    for it in group:
        diff = it.get("difficulty") or "medium"
        segs = sorted(it["segments"], key=lambda s: s.get("sort_order", 0))
        trans = it.get("translation") or ""
        russian = " ".join(s.get("text", "") for s in segs).strip()
        if diff == "easy":
            for s in segs:
                seg_all_units.append({"russian": s.get("text", ""), "chinese": s.get("chinese", ""), "segDifficulty": diff, "token_count": len(s.get("text","").split())})
        seg_all_units.append({"russian": russian, "chinese": trans, "segDifficulty": diff, "chunkIsFinal": True, "token_count": len(russian.split())})
print("segments 全量 units:", len(seg_all_units))
print("segments granularity:", Counter(granularityOfUnit(u) for u in seg_all_units))

def pick_seg(diffKey):
    if not diffKey or diffKey == "beginner": return "easy"
    if diffKey == "intermediate": return "medium"
    if diffKey == "advanced": return "hard"
    return None

def filter_segments(diffKey, gran_set):
    picked = seg_all_units
    p = pick_seg(diffKey)
    if p:
        picked = [u for u in seg_all_units if u.get("segDifficulty") == p]
    return [u for u in picked if granularityOfUnit(u) in gran_set]

# ================= 输出所有组合 =================
print("\n=== chunking 路径 ===")
for name, g in [("beginner", {"word","chunk","comb","sentence"}), ("intermediate", {"chunk","comb","sentence"}), ("advanced", {"sentence"})]:
    arr = filter_chunking(g)
    print(f"chunking {name}: {len(arr)}")

print("\n=== segments 路径（有 segDifficulty 档位预选） ===")
for diff in ["beginner", "intermediate", "advanced", "custom"]:
    for name, g in [("全粒度", {"word","chunk","comb","sentence"}), ("无word", {"chunk","comb","sentence"}), ("sentence only", {"sentence"}), ("word+chunk", {"word","chunk"}), ("chunk+comb+sentence", {"chunk","comb","sentence"})]:
        arr = filter_segments(diff, g)
        print(f"segments {diff} {name}: {len(arr)}")

# 找 chunking 里第 123 题（各难度）
print("\n=== chunking 各难度第 123 题 ===")
for name, g in [("beginner", {"word","chunk","comb","sentence"}), ("intermediate", {"chunk","comb","sentence"})]:
    arr = filter_chunking(g)
    if len(arr) >= 123:
        t = arr[122]
        print(f"[{name}] 123th: {t['russian']} | zh={t['chinese']} | gran={granularityOfUnit(t)} | final={t.get('chunkIsFinal')}")

# 找 'Где Анна? Она дома.' 相关题在 chunking 展开中的位置
print("\n=== Где Анна 相关题位置 ===")
for i, u in enumerate(expanded):
    if "Анна" in u["russian"] and "Где" in u["russian"]:
        print(f"  expanded[{i}] (beginner 序号 {i+1}): {u['russian']} gran={granularityOfUnit(u)} final={u.get('chunkIsFinal')}")
