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

// paths → items（QuestDictation 听写页用：{id, russian, chinese, words, audio_url}）
export function scaffoldingToItems(paths) {
  const items = [];
  (Array.isArray(paths) ? paths : []).forEach((p, pi) => {
    (Array.isArray(p.steps) ? p.steps : []).forEach((st, si) => {
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
      });
    });
  });
  return items;
}
