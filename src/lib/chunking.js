/**
 * chunking.js —— Chunking（滚雪球式逐块累积）切块引擎
 *
 * 对标"句乐部"式 chunking：I → like → I like → to eat → I like to eat
 * 规则（用户确认）：
 *  1. 步进形式：每引入一个新块 = 先「单打新块」一步，再「累积重打」（从开头拼到当前块）一步
 *     第一块只有单打一步。总步数 = 1 + 2×(块数-1)
 *  2. 切块粒度：1~2 词一块，固定短语合并（в магазине / доброе утро / каждый день …）
 *  3. 听写音频：每步播「当前步答案串」（单打步播新块、累积步播累积串）
 */

// ---- 固定短语表（2 词一块不拆；三词固定搭配也列入）----
const FIXED_PHRASES = new Set([
  // 地点介词短语
  "в магазине", "в школе", "в университете", "в институте", "в библиотеке",
  "в центре", "в городе", "в парке", "в театре", "в кино", "в кафе",
  "в ресторане", "в комнате", "в классе", "в аудитории", "в музее",
  "на работе", "на улице", "на столе", "на уроке", "на занятиях",
  "на каникулах", "на даче", "на почте", "на станции",
  // 时间短语
  "каждый день", "каждый вечер", "каждое утро", "каждую неделю",
  "в субботу", "в воскресенье", "в понедельник", "во вторник", "в среду",
  "в четверг", "в пятницу", "вчера вечером", "сегодня утром", "в прошлом году",
  "в этом году", "в будущем году", "через год", "через месяц", "через неделю",
  "в пять часов", "в шесть часов", "в семь часов", "в восемь часов",
  "в девять часов", "в десять часов", "в одиннадцать часов", "в двенадцать часов",
  // 问候/礼貌
  "доброе утро", "добрый день", "добрый вечер", "спокойной ночи",
  "спасибо большое", "большое спасибо", "очень хорошо", "очень плохо",
  "очень интересно", "очень красиво", "очень вкусно", "очень много",
  "ничего страшного", "конечно можно", "приятно познакомиться",
  "извините пожалуйста", "до свидания", "всего хорошего",
  // 语言/课程
  "по-русски", "по-английски", "по-немецки", "по-французски", "по-китайски",
  "русский язык", "английский язык", "родной язык", "иностранный язык",
  "русский язык хорошо", "немного по-русски",
  // 人物/代词组合
  "мой друг", "моя семья", "моя мама", "мой папа", "моя сестра", "мой брат",
  "моя подруга", "мой дедушка", "моя бабушка", "его брат", "её сестра",
  "у меня", "у тебя", "у нас", "у вас", "у него", "у неё", "у них",
  "это мой", "это моя", "это моё", "это мои",
  "все вместе", "друг друга", "друг с другом", "вместе с другом",
  // 其他高频固定搭配
  "не знаю", "не понимаю", "не помню", "не хочу", "не могу",
  "я хочу", "я знаю", "я думаю", "я считаю", "я надеюсь",
  "можно войти", "можно спросить", "можно посмотреть", "можно открыть",
  "конечно хочу", "пожалуйста помогите",
]);

const PUNCT = new Set([".", ",", "!", "?", ";", ":", "…", "—", "–"]);

// 拆词：西里尔词（含连字符复合词）与标点分开
function splitTokens(ru) {
  return String(ru || "").trim().match(/[А-Яа-яЁё]+(?:-[А-Яа-яЁё]+)?|[.,!?;:…—–]/g) || [];
}

// 句子 → 块数组（1~2 词一块，固定短语合并，逗号断块，句末标点附着最后块）
export function splitSentenceToChunks(ru) {
  const toks = splitTokens(ru);
  const chunks = [];
  let i = 0;
  while (i < toks.length) {
    const t = toks[i];
    if (PUNCT.has(t)) {
      if (t === "," || t === "—" || t === "–") { i += 1; continue; } // 逗号/破折号：块边界，不单独成块
      if (chunks.length) chunks[chunks.length - 1] += t;             // 句末标点附着前块
      i += 1;
      continue;
    }
    const next = toks[i + 1];
    if (next && !PUNCT.has(next)) {
      if (FIXED_PHRASES.has(t + " " + next)) {                       // 固定短语合并
        chunks.push(t + " " + next);
        i += 2;
        continue;
      }
    }
    chunks.push(t);
    i += 1;
  }
  // 块数上限：超过 7 块时合并尾部相邻块（从后往前两两合并，保留头部细粒度）
  while (chunks.length > 7) {
    const a = chunks.pop();
    const b = chunks.pop();
    chunks.push(b + " " + a);
  }
  return chunks.filter(Boolean);
}

// 词表（{ru/lemma, zh/chinese}）→ 词形索引（ru 小写 → 中文）
export function buildZhIndex(wordList) {
  const idx = {};
  (Array.isArray(wordList) ? wordList : []).forEach((w) => {
    const ru = String(w.ru || w.lemma || w.word || "").toLowerCase().trim();
    const zh = String(w.zh || w.chinese || w.mean || "").trim();
    if (ru && zh && !idx[ru]) idx[ru] = zh;
  });
  return idx;
}

// 块 → 中文：逐词查索引；未命中做前缀匹配（词长≥3 才前缀匹配，短词精确）；仍无则用俄语原词顶替
function chunkZhOf(chunk, zhIdx) {
  const words = String(chunk).toLowerCase().match(/[а-яё]+(?:-[а-яё]+)?/g) || [];
  const parts = words.map((w) => {
    if (zhIdx[w]) return zhIdx[w];
    if (w.length >= 3) {
      const hit = Object.keys(zhIdx).find((k) => k.length >= 3 && (k.startsWith(w) || w.startsWith(k)));
      if (hit) return zhIdx[hit];
    }
    return w; // 兜底：显示俄语原词
  });
  return parts.join(" ");
}

/**
 * 一个句子 unit → chunk steps 数组
 * 返回 null 表示不可切（少于 2 块），调用方应保留原 unit
 * step 字段与答题引擎 unit 同构（russian/chinese/words/acceptableAnswers…），
 * 并附加 chunk 元数据供 UI 面包屑与推进逻辑使用
 */
export function expandUnitToChunkSteps(unit, zhIdx) {
  const ru = String(unit?.russian || "").trim();
  const chunks = splitSentenceToChunks(ru);
  if (chunks.length < 2) return null;

  const N = chunks.length;
  const zhList = chunks.map((c) => chunkZhOf(c, zhIdx));
  const cum = (k) => chunks.slice(0, k + 1).join(" ");
  const cumZh = (k) => zhList.slice(0, k + 1).filter(Boolean).join("，");

  const makeStep = (k, targetRu, targetZh, isNew, isFinal) => {
    const tokens = String(targetRu).trim().split(/\s+/).filter(Boolean);
    const words = tokens.map((w, i) => ({
      order: i, form: w, lemma: w, pos: "", posColor: "", grammarLabel: "", roleLabel: "",
    }));
    return {
      ...unit,
      id: `${unit.id}#c${k}`,
      russian: targetRu,
      stressMarked: tokens.join(" "),
      chinese: targetZh,
      words,
      // chunk 元数据
      chunkOf: unit.id,
      chunkKey: `${unit.id}#c${k}`,
      chunkStepIndex: k,          // 0..N-1
      chunkN: N,
      chunkList: chunks,          // 全部块（俄语）
      chunkZhList: zhList,        // 每块中文（面包屑副标题）
      chunkIsNew: isNew,          // 单打新块步
      chunkIsCumulative: !isNew,  // 累积重打步
      chunkIsFinal: isFinal,      // 最后累积步（= 完整句）
      chunkFull: ru,              // 完整句
      chunkFullZh: unit.chinese || "",
    };
  };

  const steps = [];
  // 块 0：只有单打一步（单打 = 累积）
  steps.push(makeStep(0, cum(0), cumZh(0), true, N === 1));
  // 块 1..N-1：单打新块 + 累积重打
  for (let k = 1; k < N; k++) {
    steps.push(makeStep(k, chunks[k], chunkZhOf(chunks[k], zhIdx), true, false)); // 单打新块
    steps.push(makeStep(k, cum(k), cumZh(k), false, k === N - 1));               // 累积重打
  }
  return steps;
}

/** 展开整个 sequences：spellWord 拼写题保留原样，句子题展开 chunking */
export function expandSequencesWithChunks(sequences, wordList) {
  const zhIdx = buildZhIndex(wordList);
  return (Array.isArray(sequences) ? sequences : []).map((seq) => {
    const units = (seq.units || []).flatMap((u) => {
      if (u && u.spellWord) return [u]; // 单词拼写环节不切块
      const steps = expandUnitToChunkSteps(u, zhIdx);
      return steps || [u];
    });
    return { ...seq, units, totalUnits: units.length };
  });
}
