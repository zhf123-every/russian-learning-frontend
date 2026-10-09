/**
 * scaffolding.js —— 后台固定的「滚雪球步骤」（scaffoldingPaths）→ 答题引擎数据
 *
 * 数据结构（后台导入时透传保存）：
 *   scaffoldingPaths: [{
 *     pathId, name?,
 *     steps: [{
 *       stepIndex, russian, chinese, audioUrl,
 *       newChunks: [{word, translation, role, color}],   // 本步新增词
 *       allChunks: [{word, translation, role, color}],   // 截止本步整句拆解
 *     }]
 *   }]
 *
 * 用途：中译俄 / 听写 / 听力 / 口语评测 四个答题页共用。
 * 每个 path = 一个句型家族（sequence）；每个 step = 一题（unit），
 * 直接是最终形态，前端不再现切 chunking。
 */

// paths → sequences（QuestPractice / QuestListening / QuestSpeaking 共用）
export function scaffoldingToSequences(paths, title) {
  return (Array.isArray(paths) ? paths : []).map((p, pi) => {
    const steps = (Array.isArray(p.steps) ? p.steps : []).filter((s) => s && String(s.russian || s.ru || "").trim());
    const units = steps.map((st, si) => {
      const russian = String(st.russian || st.ru || "").trim();
      const tokens = russian.split(/\s+/).filter(Boolean);
      const allChunks = Array.isArray(st.allChunks) ? st.allChunks : [];
      const newSet = new Set(
        (Array.isArray(st.newChunks) ? st.newChunks : [])
          .map((c) => String(c.word || c.ru || c.text || "").trim().toLowerCase())
          .filter(Boolean)
      );
      const words = allChunks.length
        ? allChunks.map((c, i) => ({
            order: i,
            form: String(c.word || c.ru || "").trim(),
            lemma: String(c.word || c.ru || "").trim(),
            translation: String(c.translation || c.zh || c.mean || "").trim(),
            pos: String(c.pos || "").trim(),
            posColor: c.color || "",
            grammarLabel: String(c.grammar || c.grammarLabel || "").trim(),
            roleLabel: String(c.role || c.roleLabel || "").trim(),
            scaffoldNew: newSet.has(String(c.word || c.ru || "").trim().toLowerCase()),
          }))
        : tokens.map((w, i) => ({
            order: i, form: w, lemma: w, translation: "", pos: "", posColor: "",
            grammarLabel: "", roleLabel: "", scaffoldNew: false,
          }));
      return {
        id: `${p.pathId || "path_" + (pi + 1)}_${st.stepIndex || si + 1}`,
        sequenceId: p.pathId || "path_" + (pi + 1),
        sequenceOrder: st.stepIndex || si + 1,
        russian,
        stressMarked: tokens.join(" "),
        chinese: String(st.chinese || st.zh || "").trim(),
        audioUrl: String(st.audioUrl || st.audio || "").trim(),
        action: st.action || "",
        grammarNote: st.grammarNote || st.grammar_note || "",
        newElement: st.newElement || st.new_element || "",
        words,
        acceptableAnswers: [{ wordOrder: tokens.map((_, i) => i), wordVariants: {}, isDefault: true, note: "" }],
        // 滚雪球元数据（供 UI 高亮新词 / 显示步骤进度）
        scaffoldStepIndex: si,
        scaffoldN: steps.length,
        scaffoldNewChunks: Array.isArray(st.newChunks) ? st.newChunks : [],
        scaffoldAllChunks: allChunks,
        scaffoldIsNewStep: Array.isArray(st.newChunks) && st.newChunks.length > 0,
      };
    });
    return {
      id: p.pathId || "path_" + (pi + 1),
      name: p.name || p.pathId || title || "本课",
      familyName: p.name || p.pathId || title || "本课",
      units,
      totalUnits: units.length,
      fullSentence: units.length ? units[units.length - 1].russian : "",
    };
  });
}

// ============================================================
// 难度 = 出题粒度过滤（对标句乐部：初级=全出 / 中级=去单词 / 高级=只整句 / 自定义=勾选）
// 粒度判定：滚雪球课程用 scaffoldStepIndex（最后一步=整句，词数分单词/语块/组合语块）；
//           chunking 课程用 chunk 元数据（单打新块=词/语块，累积步=组合语块，最后累积=整句）；
//           兜底按词数。
// ============================================================
export function unitTokenCount(unit) {
  const n = String(unit?.russian || unit?.ru || "").trim().split(/\s+/).filter(Boolean).length;
  return Number.isFinite(n) ? n : 0;
}

export function granularityOfUnit(unit) {
  if (!unit) return "word";
  // 滚雪球课程（scaffoldingPaths 直接出题，unit 带 scaffoldStepIndex）
  if (unit.scaffoldStepIndex !== undefined) {
    const isFinal = unit.scaffoldStepIndex >= (unit.scaffoldN || 1) - 1;
    if (isFinal) return "sentence";
  }
  // chunking 课程（expandUnitToChunkSteps 产物）
  if (unit.chunkIsFinal) return "sentence";
  if (unit.chunkIsNew) {
    return unitTokenCount(unit) <= 1 ? "word" : "chunk";
  }
  if (unit.chunkIsCumulative) return "comb";
  // 兜底：按词数分（最后一步整句已在上面覆盖）
  const n = unitTokenCount(unit);
  if (n <= 1) return "word";
  if (n <= 3) return "chunk";
  return "comb";
}

// 弹窗题型名 → 粒度 key
const TYPE_TO_GRAN = {
  "短语单词": "word", "核心语块": "chunk", "组合语块": "comb", "完整句子": "sentence",
  "句子": "sentence", "语块": "chunk",
};

/** 难度 key（beginner/intermediate/advanced/custom）+ custom 勾选（中文题型名数组）→ 允许的粒度集合（仅 custom 用）
 * 三档（简单/中等/困难）按「原句类型」过滤句子，见 filterSequencesByDifficulty */
function allowedGranularities(difficultyKey, customTypes) {
  if (difficultyKey !== "custom") return null; // 三档不走块步粒度
  const list = Array.isArray(customTypes) && customTypes.length
    ? customTypes
    : ["句子", "语块", "组合语块", "短语单词"];
  const set = new Set(list.map((t) => TYPE_TO_GRAN[t]).filter(Boolean));
  if (set.size === 0) return null; // 勾选异常时退回全部
  return set;
}

/** 原句类型（按原句词数：1词=单词、2~3词=短语、4+词=完整句）——三档过滤判定基准 */
function sentenceTypeOfUnit(unit) {
  const full = String(unit?.chunkFull || unit?.russian || "").trim();
  const m = full.match(/[А-Яа-яЁё]+(?:-[А-Яа-яЁё]+)?/g);
  const n = m ? m.length : 0;
  if (n <= 1) return "word";
  if (n <= 3) return "chunk";
  return "sentence";
}

/** 三档 → 允许的原句类型：简单=全出、中等=短语+完整句、困难=只完整句 */
const DIFF_TO_SENTENCE_TYPES = {
  beginner: ["word", "chunk", "sentence"],
  intermediate: ["chunk", "sentence"],
  advanced: ["sentence"],
};

/** sequences（sequence→units 嵌套）按难度过滤；空序列剔除 */
export function filterSequencesByDifficulty(sequences, difficultyKey, customTypes) {
  if (difficultyKey === "custom") {
    const allowed = allowedGranularities("custom", customTypes);
    if (!allowed) return sequences;
    return (Array.isArray(sequences) ? sequences : [])
      .map((seq) => {
        const units = (seq.units || []).filter((u) => allowed.has(granularityOfUnit(u)));
        return { ...seq, units, totalUnits: units.length };
      })
      .filter((seq) => (seq.units || []).length > 0);
  }
  // 三档：按「原句类型」过滤句子，每句一题（用整句/final 步代表）
  const allowed = new Set(DIFF_TO_SENTENCE_TYPES[difficultyKey] || ["word", "chunk", "sentence"]);
  return (Array.isArray(sequences) ? sequences : [])
    .map((seq) => {
      const bySentence = new Map();
      for (const u of (seq.units || [])) {
        if (u && u.spellWord) continue;
        const full = String(u.chunkFull || u.russian || "").trim();
        if (!full) continue;
        const prev = bySentence.get(full);
        if (!prev) { bySentence.set(full, u); continue; }
        if (u.chunkIsFinal && !prev.chunkIsFinal) bySentence.set(full, u); // 用整句步代表
      }
      const units = [...bySentence.values()].filter((u) => allowed.has(sentenceTypeOfUnit(u)));
      return { ...seq, units, totalUnits: units.length };
    })
    .filter((seq) => (seq.units || []).length > 0);
}

/** 扁平 items（QuestDictation 用）按难度过滤：三档按原句类型、custom 按块步粒度 */
export function filterItemsByDifficulty(items, difficultyKey, customTypes) {
  if (difficultyKey === "custom") {
    const allowed = allowedGranularities("custom", customTypes);
    if (!allowed) return items;
    return (Array.isArray(items) ? items : []).filter((it) => allowed.has(granularityOfUnit(it)));
  }
  const allowed = new Set(DIFF_TO_SENTENCE_TYPES[difficultyKey] || ["word", "chunk", "sentence"]);
  return (Array.isArray(items) ? items : []).filter((it) => allowed.has(sentenceTypeOfUnit(it)));
}

// paths → items（QuestDictation 听写页用：{id, russian, chinese, words, audio_url}）
export function scaffoldingToItems(paths) {
  const items = [];
  (Array.isArray(paths) ? paths : []).forEach((p, pi) => {
    const steps = (Array.isArray(p.steps) ? p.steps : []).filter((s) => s && String(s.russian || s.ru || "").trim());
    steps.forEach((st, si) => {
      if (!st || !String(st.russian || st.ru || "").trim()) return;
      const russian = String(st.russian || st.ru || "").trim();
      const allChunks = Array.isArray(st.allChunks) ? st.allChunks : [];
      const words = allChunks.length
        ? allChunks.map((c) => ({ ru: c.word || c.ru || "", zh: c.translation || c.zh || c.mean || "" }))
        : russian.split(/\s+/).filter(Boolean).map((w) => ({ ru: w, zh: "" }));
      items.push({
        id: `${p.pathId || "path_" + (pi + 1)}_${st.stepIndex || si + 1}`,
        russian,
        chinese: String(st.chinese || st.zh || "").trim(),
        words,
        audio_url: st.audioUrl || st.audio || "",
        // 滚雪球元数据（难度粒度判定用：最后一步=整句）
        scaffoldStepIndex: si,
        scaffoldN: steps.length,
      });
    });
  });
  return items;
}
