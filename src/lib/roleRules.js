/**
 * roleRules.js —— 形态规则引擎（本地句子成分推断）
 *
 * 原理：俄语形态（格/数/性/人称）+ 词序 → 句法角色，纯本地确定性，不依赖 AI。
 * 输入：annotateWords(sentence) 的词典标注结果（pos / grammarCase / lemma / person / tense）
 * 输出：附加 syntacticRole（英文，对应 AnswerPanel ROLE_COLORS）+ roleLabel（中文）
 *
 * 规则一览（教学简化，复杂句可能标错，对课程简单句足够）：
 *  - 动词 → 谓语
 *  - 主格名词/代词/数词（不在介词后，取第一个）→ 主语
 *  - 系动词后的名词/形容词，或无动词时主语后的形容词/名词 → 表语（"Это дом." → дом 表语）
 *  - 非主格名词/代词（不在介词后）→ 宾语
 *  - 谓语动词后的名词（含无格标注的不变格名词如 кофе）→ 宾语
 *  - 形容词 → 定语；副词 → 状语；介词后的名词 → 状语（介词短语成分）
 *  - не → 否定；前置词/连接词/语气词/感叹词 → 对应虚词标签
 */

// 系动词：其后主格/工具格名词或形容词 → 表语
const COPULA = new Set([
  "быть", "есть", "стать", "становиться", "являться",
  "оказаться", "казаться", "считаться", "остаться",
]);

// ===== 高频句型模板（优先于通用规则执行，杜绝"Это X"句型里定语/表语/宾语互相标错） =====
const ESTE_WORDS = new Set(["это", "то", "вот"])
const POSSESSIVE = new Set(["мой", "твой", "его", "её", "наш", "ваш", "их", "свой", "моя", "моё", "мои", "твоя", "твоё", "твои", "наша", "наше", "наши", "ваша", "ваше", "ваши"])
const isNounish2 = (w) => w.pos === "noun" || w.pos === "pronoun" || w.pos === "numeral"
const isPrepAfter2 = (i, words) => i > 0 && words[i - 1].pos === "preposition"
const lemmaOf2 = (w) => String(w.lemma || w.form || w.word || "").trim().toLowerCase()

// 模板1："Это/То/Вот + [修饰词]* + 名词"（无动词）→ 句首指示词=主语、末尾名词=表语、中间形容词/物主代词=定语
// 例：Это дом. / Это мой новый большой дом. / Это очень хороший дом. / Это я.
function applyEstePattern(words) {
  const n = words.length
  if (n < 2) return false
  if (!ESTE_WORDS.has(lemmaOf2(words[0]))) return false
  if (words.some((w) => w.pos === "verb")) return false // 有动词交给通用规则
  // 从右往左找第一个"不在介词后"的名词/代词/数词 → 表语
  let lastIdx = -1
  for (let i = n - 1; i > 0; i--) {
    if (isNounish2(words[i]) && !isPrepAfter2(i, words)) { lastIdx = i; break }
  }
  if (lastIdx <= 0) return false
  words[0].syntacticRole = "subject"; words[0].roleLabel = "主语"
  words[lastIdx].syntacticRole = "predicative"; words[lastIdx].roleLabel = "表语"
  // 中间 形容词/物主代词 → 定语（не/副词/介词短语/人称代词留给通用规则）
  for (let i = 1; i < lastIdx; i++) {
    const w = words[i]
    if (w.syntacticRole) continue
    if (w.pos === "adjective" || (w.pos === "pronoun" && POSSESSIVE.has(lemmaOf2(w)))) { w.syntacticRole = "attribute"; w.roleLabel = "定语" }
  }
  return true
}

// 模板2："名词/代词 … это … 名词"（无动词，"X — это Y" 判断句，это 在中间）
// 例：Плёс — это мой родной город. → Плёс=主语、мой/родной=定语、город=表语、это=语气词
function applyEsteMiddlePattern(words) {
  const n = words.length
  if (n < 3) return false
  if (words.some((w) => w.pos === "verb")) return false
  // 找 esto 词（i>0，不在句首）
  let mi = -1
  for (let i = 1; i < n; i++) {
    if (ESTE_WORDS.has(lemmaOf2(words[i]))) { mi = i; break }
  }
  if (mi <= 0) return false
  // esto 前：句首必须是名词/代词（主语）
  const first = words[0]
  if (!(first.pos === "noun" || first.pos === "pronoun")) return false
  // esto 后：优先找名词做表语（跳过 мой/новый 等修饰词），没有名词再退而求其次找代词/数词
  let lastIdx = -1
  for (let i = mi + 1; i < n; i++) {
    if (words[i].pos === "noun" && !isPrepAfter2(i, words)) { lastIdx = i; break }
  }
  if (lastIdx < 0) {
    for (let i = mi + 1; i < n; i++) {
      if (isNounish2(words[i]) && !isPrepAfter2(i, words)) { lastIdx = i; break }
    }
  }
  if (lastIdx < 0) return false
  words[0].syntacticRole = "subject"; words[0].roleLabel = "主语"
  words[lastIdx].syntacticRole = "predicative"; words[lastIdx].roleLabel = "表语"
  // esto 与表语之间：形容词/物主代词 → 定语
  for (let i = mi + 1; i < lastIdx; i++) {
    const w = words[i]
    if (w.syntacticRole) continue
    if (w.pos === "adjective" || (w.pos === "pronoun" && POSSESSIVE.has(lemmaOf2(w)))) { w.syntacticRole = "attribute"; w.roleLabel = "定语" }
  }
  words[mi].syntacticRole = "particle"; words[mi].roleLabel = "语气词"
  return true
}

export function inferRoles(sentence, dictWords) {
  const words = (dictWords || []).map((w) => ({ ...w }));
  const n = words.length;
  if (!n) return words;

  const isVerb = (w) => w.pos === "verb";
  const isNounish = (w) => w.pos === "noun" || w.pos === "pronoun" || w.pos === "numeral";
  const isPrepAfter = (i) => i > 0 && words[i - 1].pos === "preposition";
  const lemmaOf = (w) => String(w.lemma || w.form || "").trim().toLowerCase();

  const hasVerb = words.some(isVerb);

  // 0) 高频句型模板优先标注（"Это X" / "X — это Y"）：杜绝定语/表语/宾语互标错
  applyEstePattern(words);
  applyEsteMiddlePattern(words);

  // 1) 谓语：动词（系动词亦谓语）
  words.forEach((w) => {
    if (isVerb(w)) { w.syntacticRole = "predicate"; w.roleLabel = "谓语"; }
  });

  // 2) 主语：主格名词/代词/数词（不在介词后），取第一个；无格标注的句首名词/代词（如 это）也判主语
  let subjectIdx = -1;
  for (let i = 0; i < n; i++) {
    const w = words[i];
    if (w.syntacticRole) continue;
    if (isNounish(w) && !isPrepAfter(i) && (w.grammarCase === "nom" || !w.grammarCase)) {
      w.syntacticRole = "subject"; w.roleLabel = "主语";
      subjectIdx = i;
      break;
    }
  }

  // 3) 表语：系动词之后的名词/代词/形容词；无动词时主语后的形容词/名词（"Это дом." → дом 表语）
  words.forEach((w, i) => {
    if (w.syntacticRole) return;
    const prev = i > 0 ? words[i - 1] : null;
    if (prev && prev.syntacticRole === "predicate" && COPULA.has(lemmaOf(prev)) &&
        (w.pos === "noun" || w.pos === "adjective" || w.pos === "pronoun")) {
      w.syntacticRole = "predicative"; w.roleLabel = "表语";
      return;
    }
    if (!hasVerb && subjectIdx >= 0 && i > subjectIdx &&
        (w.pos === "adjective" || (w.pos === "noun" && w.grammarCase === "nom"))) {
      w.syntacticRole = "predicative"; w.roleLabel = "表语";
    }
  });

  // 4) 宾语：非主格名词/代词/数词（不在介词后）
  words.forEach((w, i) => {
    if (w.syntacticRole) return;
    if (isNounish(w) && w.grammarCase && w.grammarCase !== "nom" && !isPrepAfter(i)) {
      w.syntacticRole = "object"; w.roleLabel = "宾语";
    }
  });

  // 4.5) 谓语动词后的名词（未标记，含无格标注的不变格名词如 кофе）→ 宾语
  words.forEach((w, i) => {
    if (w.syntacticRole) return;
    if (isNounish(w) && i > 0) {
      const prev = words[i - 1];
      if (prev && prev.syntacticRole === "predicate") {
        w.syntacticRole = "object"; w.roleLabel = "宾语";
      }
    }
  });

  // 5) 定语：形容词
  words.forEach((w) => {
    if (w.syntacticRole) return;
    if (w.pos === "adjective") { w.syntacticRole = "attribute"; w.roleLabel = "定语"; }
  });

  // 6) 状语：副词；介词短语成分（介词后的名词/代词/数词）
  words.forEach((w, i) => {
    if (w.syntacticRole) return;
    if (w.pos === "adverb") { w.syntacticRole = "adverbial"; w.roleLabel = "状语"; }
    else if (isNounish(w) && w.grammarCase && w.grammarCase !== "nom" && isPrepAfter(i)) {
      w.syntacticRole = "adverbial"; w.roleLabel = "状语";
    }
  });

  // 7) 虚词：не → 否定；前置词/连接词/语气词/感叹词
  words.forEach((w) => {
    if (w.syntacticRole) return;
    const lem = lemmaOf(w);
    if (lem === "не") { w.syntacticRole = "negation"; w.roleLabel = "否定"; }
    else if (w.pos === "preposition") { w.syntacticRole = "preposition"; w.roleLabel = "前置词"; }
    else if (w.pos === "conjunction") { w.syntacticRole = "conjunction"; w.roleLabel = "连接词"; }
    else if (w.pos === "particle") { w.syntacticRole = "particle"; w.roleLabel = "语气词"; }
    else if (w.pos === "interjection") { w.syntacticRole = "interjection"; w.roleLabel = "感叹词"; }
  });

  // 8) 兜底：词典未收录等未命中角色 → 待确认（前端不显示成分标签，只显示词性与释义）
  words.forEach((w) => {
    if (!w.syntacticRole) { w.syntacticRole = "default"; w.roleLabel = "待确认"; }
  });

  return words;
}
