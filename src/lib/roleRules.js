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

export function inferRoles(sentence, dictWords) {
  const words = (dictWords || []).map((w) => ({ ...w }));
  const n = words.length;
  if (!n) return words;

  const isVerb = (w) => w.pos === "verb";
  const isNounish = (w) => w.pos === "noun" || w.pos === "pronoun" || w.pos === "numeral";
  const isPrepAfter = (i) => i > 0 && words[i - 1].pos === "preposition";
  const lemmaOf = (w) => String(w.lemma || w.form || "").trim().toLowerCase();

  const hasVerb = words.some(isVerb);

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

  // 8) 兜底：词典未收录等未命中角色 → 无标签（边框回退词性色）
  words.forEach((w) => {
    if (!w.syntacticRole) { w.syntacticRole = "default"; w.roleLabel = ""; }
  });

  return words;
}
