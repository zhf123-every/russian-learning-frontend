/**
 * roleRules.js —— 形态规则引擎（本地句子成分推断）
 *
 * 原理：俄语形态（格/数/性/人称）+ 词序 → 句法角色，纯本地确定性，不依赖 AI。
 * 输入：annotateWords(sentence) 的词典标注结果（pos / grammarCase / lemma / person / tense）
 * 输出：附加 syntacticRole（英文，对应 AnswerPanel ROLE_COLORS）+ roleLabel（中文）
 *
 * 规则一览（面向课程简单句，覆盖常见句型）：
 *  - 动词 → 谓语；动词后紧跟的第二个动词（不定式）→ 补语（"Я люблю читать"）
 *  - 主格名词/代词/数词（不在介词后）→ 主语（每分句取第一个；и 连接的并列名词也标主语）
 *  - 系动词后的名词/形容词 → 表语；无动词时主语后的形容词/主格名词 → 表语
 *  - "Это/То/Вот … 名词" 句（可带 не/修饰词/多分句）→ Esto=主语、末尾名词=表语、中间形容词/物主代词=定语
 *  - "X — это Y" 判断句 → X=主语、Y=表语、это=语气词
 *  - "Тут/Здесь/Там + 名词" 处所存在句（无动词）→ 处所副词=状语、名词=主语
 *  - 非主格名词/代词（不在介词后）→ 宾语；谓语动词后的名词 → 宾语
 *  - 形容词 → 定语；副词 → 状语；介词后的名词 → 状语（介词短语成分）
 *  - не → 否定；前置词/连接词/语气词/感叹词 → 对应虚词标签
 *  - 分句处理：按句末标点切分句，每个分句独立应用句型模板与主语判定，杜绝跨分句误配
 */

// 系动词：其后主格/工具格名词或形容词 → 表语
const COPULA = new Set([
  "быть", "есть", "стать", "становиться", "являться",
  "оказаться", "казаться", "считаться", "остаться",
]);

// ===== 高频句型模板（优先于通用规则执行，杜绝"Это X"句型里定语/表语/宾语互相标错） =====
const ESTE_WORDS = new Set(["это", "то", "вот"])
const POSSESSIVE = new Set(["мой", "твой", "его", "её", "наш", "ваш", "их", "свой", "моя", "моё", "мои", "твоя", "твоё", "твои", "наша", "наше", "наши", "ваша", "ваше", "ваши"])
const LOCATIVE = new Set(["тут", "здесь", "там", "вон"])
const CLAUSE_BREAKERS = new Set(["а", "но"]) // 对比/转折连接词：视为分句边界（и 连接并列成分不切）
const isNounish2 = (w) => w.pos === "noun" || w.pos === "pronoun" || w.pos === "numeral"
const isPrepAfter2 = (i, words) => i > 0 && words[i - 1].pos === "preposition"
const lemmaOf2 = (w) => String(w.lemma || w.form || w.word || "").trim().toLowerCase()

/**
 * 按句末标点/对比连接词把整句切成若干分句块，每块独立应用句型模板与主语判定。
 * 分句边界依据原始句子的 token 尾标点（词典命中词的 form 会被原形覆盖丢失标点，不能用 form 判断）。
 */
function splitClauses(words, sentence) {
  const toks = String(sentence || "").split(/\s+/).filter(Boolean);
  const clauses = [];
  let cur = [];
  words.forEach((w, gi) => {
    cur.push(w);
    const t = toks[gi] || "";
    const hasEndPunct = /[.,;:!?…](?:—|–)?$/.test(t);
    const isBreaker = CLAUSE_BREAKERS.has(lemmaOf2(w));
    if (hasEndPunct || isBreaker) {
      clauses.push(cur);
      cur = [];
    }
  });
  if (cur.length) clauses.push(cur);
  return clauses;
}

/**
 * 模板1："Это/То/Вот + [修饰词]* + 名词"（无动词）→ Esto=主语、末尾名词=表语、中间形容词/物主代词=定语。
 * 支持分句内 esto 不在句首（如 "а это твой друг"），支持 not 等虚词位于名词前（"Это не вода"）。
 * 例：Это дом. / Это мой новый большой дом. / Это очень хороший дом. / Это я.
 */
function applyEstePattern(clause) {
  const n = clause.length
  if (n < 2) return false
  if (clause.some((w) => w.pos === "verb")) return false // 有动词交给通用规则
  // 找本分句内第一个 esto 词（可跳过块首连接词 а/но）
  let firstEsto = -1
  for (let i = 0; i < n; i++) {
    if (ESTE_WORDS.has(lemmaOf2(clause[i]))) { firstEsto = i; break }
  }
  if (firstEsto < 0) return false
  // esto 之后最后一个"不在介词后"的名词/代词/数词 → 表语
  let lastIdx = -1
  for (let i = n - 1; i > firstEsto; i--) {
    if (isNounish2(clause[i]) && !isPrepAfter2(i, clause)) { lastIdx = i; break }
  }
  if (lastIdx < 0) return false
  clause[firstEsto].syntacticRole = "subject"; clause[firstEsto].roleLabel = "主语"
  clause[lastIdx].syntacticRole = "predicative"; clause[lastIdx].roleLabel = "表语"
  // esto 与表语之间：形容词/物主代词 → 定语（не/副词/介词短语/语气词留给通用规则）
  for (let i = firstEsto + 1; i < lastIdx; i++) {
    const w = clause[i]
    if (w.syntacticRole) continue
    if (w.pos === "adjective" || (w.pos === "pronoun" && POSSESSIVE.has(lemmaOf2(w)))) { w.syntacticRole = "attribute"; w.roleLabel = "定语" }
  }
  return true
}

// 模板2："名词/代词 … это … 名词"（无动词，"X — это Y" 判断句，это 在中间）
// 例：Плёс — это мой родной город. → Плёс=主语、мой/родной=定语、город=表语、это=语气词
function applyEsteMiddlePattern(clause) {
  const n = clause.length
  if (n < 3) return false
  if (clause.some((w) => w.pos === "verb")) return false
  // 找 esto 词（i>0，不在句首）
  let mi = -1
  for (let i = 1; i < n; i++) {
    if (ESTE_WORDS.has(lemmaOf2(clause[i]))) { mi = i; break }
  }
  if (mi <= 0) return false
  // esto 前：句首必须是名词/代词（主语）
  const first = clause[0]
  if (!(first.pos === "noun" || first.pos === "pronoun")) return false
  // esto 后：优先找名词做表语（跳过 мой/новый 等修饰词），没有名词再退而求其次找代词/数词
  let lastIdx = -1
  for (let i = mi + 1; i < n; i++) {
    if (clause[i].pos === "noun" && !isPrepAfter2(i, clause)) { lastIdx = i; break }
  }
  if (lastIdx < 0) {
    for (let i = mi + 1; i < n; i++) {
      if (isNounish2(clause[i]) && !isPrepAfter2(i, clause)) { lastIdx = i; break }
    }
  }
  if (lastIdx < 0) return false
  clause[0].syntacticRole = "subject"; clause[0].roleLabel = "主语"
  clause[lastIdx].syntacticRole = "predicative"; clause[lastIdx].roleLabel = "表语"
  // esto 与表语之间：形容词/物主代词 → 定语
  for (let i = mi + 1; i < lastIdx; i++) {
    const w = clause[i]
    if (w.syntacticRole) continue
    if (w.pos === "adjective" || (w.pos === "pronoun" && POSSESSIVE.has(lemmaOf2(w)))) { w.syntacticRole = "attribute"; w.roleLabel = "定语" }
  }
  clause[mi].syntacticRole = "particle"; clause[mi].roleLabel = "语气词"
  return true
}

/**
 * 模板3：处所存在句（无动词）："Тут/Здесь/Там + 名词" → 处所副词=状语、名词=主语，
 * "и" 连接的并列名词也标主语（"Тут стол и стул" → стол/стул 都是主语）。
 */
function applyLocativePattern(clause) {
  const n = clause.length
  if (n < 2) return false
  if (clause.some((w) => w.pos === "verb")) return false
  const first = clause[0]
  if (!(first.pos === "adverb" && LOCATIVE.has(lemmaOf2(first)))) return false
  // 其后第一个不在介词后的名词/代词/数词 → 主语
  let si = -1
  for (let i = 1; i < n; i++) {
    const w = clause[i]
    if (isNounish2(w) && !isPrepAfter2(i, clause)) { si = i; break }
  }
  if (si < 0) return false
  first.syntacticRole = "adverbial"; first.roleLabel = "状语"
  clause[si].syntacticRole = "subject"; clause[si].roleLabel = "主语"
  // и 连接的后继名词 → 并列主语
  for (let i = si + 1; i < n; i++) {
    const w = clause[i]
    if ((w.pos === "noun" || w.pos === "pronoun") && clause[i - 1] && lemmaOf2(clause[i - 1]) === "и" && !w.syntacticRole) {
      w.syntacticRole = "subject"; w.roleLabel = "主语"
    }
  }
  return true
}

// 模板4：破折号判断句（无 esto、无动词）"X — Y" → X=主语、Y=表语、破折号两侧的形容词/物主代词=定语
// 例：Москва — большой город. → Москва=主语、большой=定语、город=表语；Мой брат — врач. → мой=定语、брат=主语、врач=表语
function applyDashPattern(clause) {
  const n = clause.length;
  if (n < 3) return false;
  if (clause.some((w) => w.pos === "verb")) return false;
  let di = -1;
  for (let i = 0; i < n; i++) {
    if (clause[i].isDash) { di = i; break; }
  }
  if (di <= 0 || di >= n - 1) return false; // 破折号必须在中间
  // 破折号前：最后一个不在介词后的名词/代词（主语）
  let si = -1;
  for (let i = di - 1; i >= 0; i--) {
    if (isNounish2(clause[i]) && !isPrepAfter2(i, clause)) { si = i; break; }
  }
  if (si < 0) return false;
  // 破折号后：第一个名词（表语），没有再找代词/数词
  let pi = -1;
  for (let i = di + 1; i < n; i++) {
    if (clause[i].pos === "noun" && !isPrepAfter2(i, clause)) { pi = i; break; }
  }
  if (pi < 0) {
    for (let i = di + 1; i < n; i++) {
      if (isNounish2(clause[i]) && !isPrepAfter2(i, clause)) { pi = i; break; }
    }
  }
  if (pi < 0) return false;
  clause[si].syntacticRole = "subject"; clause[si].roleLabel = "主语";
  clause[pi].syntacticRole = "predicative"; clause[pi].roleLabel = "表语";
  // 破折号两侧的形容词/物主代词 → 定语（含主语前修饰词，避免被"主语后形容词→表语"误标）
  for (let i = 0; i < n; i++) {
    if (i === si || i === pi) continue;
    const w = clause[i];
    if (w.syntacticRole) continue;
    if (w.pos === "adjective" || (w.pos === "pronoun" && POSSESSIVE.has(lemmaOf2(w)))) { w.syntacticRole = "attribute"; w.roleLabel = "定语"; }
  }
  return true;
}

export function inferRoles(sentence, dictWords) {
  const src = (dictWords || []).map((w) => ({ ...w }));
  // 破折号占位：annotateWords 会过滤独立破折号 token，导致 words 与原句 tokens 错位（分句标点判断漂移）。
  // 这里按原句把破折号以占位词插回（pos:"dash"），保证分句/模板/标点判断与真实词序对齐；
  // 全部规则跑完后在返回前移除占位（破折号显示由 AnswerPanel 的 punct 另行处理）。
  const toks = String(sentence || "").split(/\s+/).filter(Boolean);
  const words = [];
  let wi = 0;
  toks.forEach((t) => {
    if (/^[—–-]+$/.test(t)) {
      words.push({ form: t, lemma: t, pos: "dash", isDash: true });
    } else {
      words.push(src[wi] || { form: t, lemma: t });
      wi++;
    }
  });
  const n = words.length;
  if (!n) return src;

  const isVerb = (w) => w.pos === "verb";
  const isNounish = (w) => w.pos === "noun" || w.pos === "pronoun" || w.pos === "numeral";
  const isPrepAfter = (i) => i > 0 && words[i - 1].pos === "preposition";
  const lemmaOf = (w) => String(w.lemma || w.form || "").trim().toLowerCase();

  // 分句（按句末标点/对比转折连接词切），每块独立应用句型模板与主语判定
  const clauses = splitClauses(words, sentence);

  // 0) 高频句型模板优先标注（"Это X" / "X — это Y" / "Тут X" / 破折号判断句 "X — Y"）：杜绝定语/表语/宾语互标错
  clauses.forEach((clause) => { applyEstePattern(clause); });
  clauses.forEach((clause) => { applyEsteMiddlePattern(clause); });
  clauses.forEach((clause) => { applyLocativePattern(clause); });
  clauses.forEach((clause) => { applyDashPattern(clause); });

  // 1) 谓语：动词（系动词亦谓语）；动词后紧跟的第二个动词（不定式）→ 补语（"Я люблю читать"）
  for (let i = 0; i < n; i++) {
    const w = words[i];
    if (!isVerb(w)) continue;
    const prev = i > 0 ? words[i - 1] : null;
    if (prev && prev.syntacticRole === "predicate") {
      w.syntacticRole = "complement"; w.roleLabel = "补语";
    } else {
      w.syntacticRole = "predicate"; w.roleLabel = "谓语";
    }
  }

  // 2) 主语：每个分句第一个"不在介词后"的主格名词/代词/数词（无格标注的句首名词/代词也判主语）
  //    句型模板已标过主语的分句（Это X / 处所存在句）不再找第二个主语，避免 "Это не вода" 中 вода 被误标主语
  // 2.0) 人称代词主格保护：я/ты/мы/вы/он/она/оно/они 主格形式在俄语中恒为主语（не в介词后），
  //     优先于"非主格→宾语"的通用规则，杜绝 "Куда ты идёшь? — Я иду в школу." 中 Я 被误标宾语
  const PERSONAL_NOM = new Set(["я", "ты", "мы", "вы", "он", "она", "оно", "они"]);
  clauses.forEach((clause) => {
    for (let i = 0; i < clause.length; i++) {
      const w = clause[i];
      if (w.syntacticRole) continue;
      if (PERSONAL_NOM.has(lemmaOf(w)) && !(i > 0 && clause[i - 1].pos === "preposition")) {
        w.syntacticRole = "subject"; w.roleLabel = "主语";
        break;
      }
    }
  });
  clauses.forEach((clause) => {
    if (clause.some((cw) => cw.syntacticRole === "subject")) return;
    for (let i = 0; i < clause.length; i++) {
      const w = clause[i];
      if (w.syntacticRole) continue;
      if (isNounish(w) && !(i > 0 && clause[i - 1].pos === "preposition") && (w.grammarCase === "nom" || !w.grammarCase)) {
        w.syntacticRole = "subject"; w.roleLabel = "主语";
        break;
      }
    }
  });

  // 2.5) 疑问副词引导的无动词从句：где/куда/откуда/когда/почему/как/зачем + 名词（非介词后）→ 名词=主语
  //      "Я знаю, где метро" → метро=主语；chunking 丢弃中文逗号后同型 "Я знаю где метро" 同样命中；
  //      "Куда ты идёшь?" 中 ты 是代词不触发；"где работает Анна" 中 Анна 前是动词不触发
  const WHERE_ADV = new Set(["где", "куда", "откуда", "когда", "почему", "как", "зачем"]);
  words.forEach((w, i) => {
    if (w.syntacticRole) return;
    if (isNounish(w) && i > 0 && !isPrepAfter(i)) {
      const prev = words[i - 1];
      if (prev && prev.pos === "adverb" && WHERE_ADV.has(lemmaOf(prev))) {
        w.syntacticRole = "subject"; w.roleLabel = "主语";
      }
    }
  });

  // 3) 表语：系动词之后的名词/代词/形容词；无动词时主语后的形容词/名词（"Это дом." → дом 表语）
  words.forEach((w, i) => {
    if (w.syntacticRole) return;
    const prev = i > 0 ? words[i - 1] : null;
    if (prev && prev.syntacticRole === "predicate" && COPULA.has(lemmaOf(prev)) &&
        (w.pos === "noun" || w.pos === "adjective" || w.pos === "pronoun")) {
      w.syntacticRole = "predicative"; w.roleLabel = "表语";
      return;
    }
    // 无动词：主语之后的主格名词/形容词 → 表语（同分句内）。
    // 排除"该词前已有谓语动词"的情形（"Я люблю читать книги" 中 книги 是宾语；
    // 系动词句的表语由 COPULA 规则独立处理）。
    if (i > 0) {
      const inClause = clauses.find((c) => c.includes(w));
      const hasSubjectBefore = inClause && inClause.slice(0, i).some((cw) => cw.syntacticRole === "subject");
      const verbBefore = inClause && inClause.slice(0, i).some((cw) => cw.pos === "verb");
      if (hasSubjectBefore && !verbBefore &&
          (w.pos === "adjective" || (w.pos === "noun" && w.grammarCase === "nom"))) {
        w.syntacticRole = "predicative"; w.roleLabel = "表语";
      }
    }
  });

  // 4.1) 限定修饰短语：代词/数词 紧邻名词之前（不在介词后）→ 该词=定语
  //      "Он звонит каждый день" → каждый=定语（修饰 день）；"Я люблю его брата" → его=定语
  //      避免限定代词被 4.5 误判为宾语、且让紧跟名词获得正确成分归属
  words.forEach((w, i) => {
    if (w.syntacticRole) return;
    const nxt = i + 1 < words.length ? words[i + 1] : null;
    if ((w.pos === "pronoun" || w.pos === "numeral") && nxt && nxt.pos === "noun" && !isPrepAfter(i)) {
      w.syntacticRole = "attribute"; w.roleLabel = "定语";
    }
  });

  // 4.15) 时间名词状语：谓语动词之后、无介词且不在介词后的时间名词（带/不带限定词）
  //       "Он звонит каждый день" → день=时间状语（每天）；"Мы работаем весь день" 同理
  const TIME_NOUNS = new Set(["день", "утро", "вечер", "ночь", "неделя", "месяц", "год", "час", "минута", "секунда", "раз", "время"]);
  words.forEach((w, i) => {
    if (w.syntacticRole) return;
    if (w.pos === "noun" && TIME_NOUNS.has(lemmaOf(w)) && !isPrepAfter(i)) {
      let hasPred = false;
      for (let j = i - 1; j >= 0; j--) {
        if (words[j].syntacticRole === "predicate" || words[j].syntacticRole === "complement") { hasPred = true; break; }
      }
      if (hasPred) { w.syntacticRole = "adverbial"; w.roleLabel = "状语"; }
    }
  });

  // 4) 宾语：非主格名词/代词/数词（不在介词后）
  words.forEach((w, i) => {
    if (w.syntacticRole) return;
    if (isNounish(w) && w.grammarCase && w.grammarCase !== "nom" && !isPrepAfter(i)) {
      w.syntacticRole = "object"; w.roleLabel = "宾语";
    }
  });

  // 4.5) 谓语动词后的名词（未标记，含无格标注的不变格名词如 кофе）→ 宾语；
  //      中间隔不定式补语也算（"Я люблю читать книги" → книги 是宾语，不是表语/待确认）
  words.forEach((w, i) => {
    if (w.syntacticRole) return;
    if (isNounish(w) && i > 0) {
      // 向前找最近的动词；若该动词是谓语或补语（不定式链），且中间只有动词/补语 → 宾语
      for (let j = i - 1; j >= 0; j--) {
        const prev = words[j];
        if (prev.pos === "verb") {
          if (prev.syntacticRole === "predicate" || prev.syntacticRole === "complement") {
            const between = words.slice(j + 1, i);
            const onlyVerbish = between.every((b) => b.pos === "verb" || b.syntacticRole === "complement");
            if (onlyVerbish) { w.syntacticRole = "object"; w.roleLabel = "宾语"; }
          }
          break;
        }
      }
    }
  });

  // 5) 定语：形容词
  words.forEach((w) => {
    if (w.syntacticRole) return;
    if (w.pos === "adjective") { w.syntacticRole = "attribute"; w.roleLabel = "定语"; }
  });

  // 6) 状语：副词；介词短语成分（介词后的名词/代词/数词——俄语介词不支配主格，介词后一律状语成分）
  words.forEach((w, i) => {
    if (w.syntacticRole) return;
    if (w.pos === "adverb") { w.syntacticRole = "adverbial"; w.roleLabel = "状语"; }
    else if (isNounish(w) && isPrepAfter(i)) {
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

  // 移除破折号占位词（破折号显示由 AnswerPanel 的 punct/dashMap 按原句另行渲染）
  return words.filter((w) => !w.isDash);
}

// Excel「句子成分」列的逐词角色名 → 引擎 role key 映射（课程上传的权威标注直接驱动答题页角色颜色/标签）
const ROLE_ZH_TO_KEY = {
  "主语": "subject", "谓语": "predicate", "宾语": "object", "定语": "attributive",
  "状语": "adverbial", "补语": "complement", "表语": "predicative",
  "否定": "negation", "连接词": "conjunction", "连词": "conjunction",
  "前置词": "preposition", "语气词": "particle", "感叹词": "interjection",
  "待确认": "default",
};
export function roleKeyFromZh(zh) {
  return ROLE_ZH_TO_KEY[String(zh || "").trim()] || "";
}
