/**
 * segmentsToQuestions.js —— 语块（sentence_segments）→ 答题引擎数据
 *
 * C 混合模式（对标句乐部）：每句 × 三档语块 → 一个题目组（sequence）
 *   - 零件题：每个语块一题（先学零件），按 sort_order 顺序出
 *   - 组装题：整句一题（再组装），下划线/词卡按语块分段提示
 *
 * 难度映射（弹窗 ↔ 语块档位）：beginner→easy / intermediate→medium / advanced→hard / custom→全档按粒度过滤
 *   - 初级(easy)：零件题（全部粒度）+ 组装题
 *   - 中级(medium)：只组装题（整句，按 medium 语块分段提示）
 *   - 高级(hard)：整句一题（不拆、无分段提示）
 *   - 自定义：全档零件题按现有粒度过滤（短语单词/核心语块/组合语块/完整句子）
 *
 * 数据来源：GET /api/segments（P0 已上线，公开读）。只收 status='ok' 的语块
 * （后端 P0 硬校验：语块按 sort_order 拼接逐字符等于俄语化原句，前端无需重复校验原句）。
 * 整课无 ok 语块 → 返回 []，页面降级回老滚雪球路径（行为零变化）。
 *
 * 输出结构与 lib/scaffolding.js 的 scaffoldingToSequences 完全兼容：
 *   渲染层 / 输入层 / 校验层 / 现有粒度过滤（filterSequencesByDifficulty）零改动。
 *   组装题打 chunkIsFinal:true → 现有 granularityOfUnit 判定为 sentence。
 */
import { filterSequencesByDifficulty, filterItemsByDifficulty } from "./scaffolding.js";

const DIFF_LABEL = { easy: "初级", medium: "中级", hard: "高级" };

function cleanText(v) {
  return String(v || "").trim();
}

/** 一条 ok 语块 → 零件题 unit（与 scaffoldingToSequences 的 unit 同构） */
function segToPartUnit(seg, sequenceId, seqIdx, order, sentenceNo, diffLabel) {
  const russian = cleanText(seg.text);
  const tokens = russian.split(/\s+/).filter(Boolean);
  const words = tokens.map((w, i) => ({
    order: i,
    form: w,
    lemma: w,
    translation: cleanText(seg.chinese), // 语块中文（块级，共享给块内词；暂无逐词翻译）
    pos: "",
    posColor: "",
    grammarLabel: "",
    roleLabel: cleanText(seg.type), // 语块语法成分
    scaffoldNew: false,
  }));
  return {
    id: `${sequenceId}_${String(order).padStart(2, "0")}`,
    sequenceId,
    sequenceOrder: order,
    russian,
    stressMarked: russian,
    chinese: cleanText(seg.chinese),
    audioUrl: "",
    action: "",
    grammarNote: "",
    newElement: "",
    words,
    acceptableAnswers: [{ wordOrder: tokens.map((_, i) => i), wordVariants: {}, isDefault: true, note: "" }],
    // 语块元数据（供分段提示 / 词卡分组）
    segKind: "part",
    segType: cleanText(seg.type),
    segChinese: cleanText(seg.chinese),
    segDifficulty: seg.difficulty || "",
    sentenceNo,
  };
}

/** 一句三档 → 组装题 unit（整句；中级=按语块分段、高级=整句一块） */
function segToFullUnit(segments, sequenceId, seqIdx, translation, sentenceNo, diffKey) {
  const ordered = [...segments].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const russian = ordered.map((s) => cleanText(s.text)).filter(Boolean).join(" ");
  const tokens = russian.split(/\s+/).filter(Boolean);
  // 块级中文共享到块内每个词（词卡至少不空；逐词翻译属已知缺口，P4 可补）
  const words = tokens.map((w, i) => {
    let zh = cleanText(translation);
    let type = "";
    for (const s of ordered) {
      const blockTokens = cleanText(s.text).split(/\s+/).filter(Boolean);
      if (blockTokens.length && w === blockTokens[0]) { zh = cleanText(s.chinese); type = cleanText(s.type); break; }
    }
    return { order: i, form: w, lemma: w, translation: zh, pos: "", posColor: "", grammarLabel: "", roleLabel: type, scaffoldNew: false };
  });
  return {
    id: `${sequenceId}_full`,
    sequenceId,
    sequenceOrder: seqIdx + 1,
    russian,
    stressMarked: russian,
    chinese: cleanText(translation),
    audioUrl: "",
    action: "",
    grammarNote: "",
    newElement: "",
    words,
    acceptableAnswers: [{ wordOrder: tokens.map((_, i) => i), wordVariants: {}, isDefault: true, note: "" }],
    // 粒度标记：现有 granularityOfUnit 识别 chunkIsFinal → sentence
    chunkIsFinal: true,
    // 语块元数据（供分段提示 / 词卡分组）
    segKind: "full",
    segDifficulty: diffKey,
    segSpans: ordered.map((s, i) => ({ order: i + 1, text: cleanText(s.text), chinese: cleanText(s.chinese), type: cleanText(s.type) })),
    sentenceNo,
  };
}

/**
 * 语块 items → sequences（三档全量；渲染层可直接用，难度过滤交给 filterSegmentsByDifficulty）
 * @param {Array} items GET /api/segments 的 items（[{sentence_hash,difficulty,status,translation,segments}]）
 * @param {string} title 课时标题（兜底命名）
 * @returns {Array} 与 scaffoldingToSequences 兼容的 sequences
 */
export function segmentsToSequences(items, title) {
  const seqs = [];
  const ok = (Array.isArray(items) ? items : []).filter(
    (it) => it && it.status === "ok" && Array.isArray(it.segments) && it.segments.length
  );
  // 按句分组（sentence_hash）→ 句序 = items 出现顺序
  const bySentence = new Map();
  for (const it of ok) {
    const h = cleanText(it.sentence_hash) || `h${bySentence.size}`;
    if (!bySentence.has(h)) bySentence.set(h, []);
    bySentence.get(h).push(it);
  }
  let sentenceNo = 0;
  for (const group of bySentence.values()) {
    sentenceNo++;
    for (const it of group) {
      const diffKey = cleanText(it.difficulty) || "medium";
      const segments = [...it.segments].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      const translation = cleanText(it.translation);
      const sequenceId = `seg_${cleanText(it.sentence_hash) || sentenceNo}_${diffKey}`;
      const name = `句子 ${sentenceNo}（${DIFF_LABEL[diffKey] || diffKey}）`;
      const units = [];
      if (diffKey === "easy") {
        // 零件题：仅初级(easy)出全部语块零件（word/chunk/comb 粒度由现有过滤细分）；中级只组装
        segments.forEach((seg, i) => units.push(segToPartUnit(seg, sequenceId, i, i + 1, sentenceNo, DIFF_LABEL[diffKey])));
      }
      // medium（中级=只组装）与 hard（整句不拆）都不出零件题
      units.push(segToFullUnit(segments, sequenceId, units.length, translation, sentenceNo, diffKey));
      if (!units.length) continue;
      seqs.push({
        id: sequenceId,
        name,
        familyName: name,
        units,
        totalUnits: units.length,
        fullSentence: units[units.length - 1].russian,
        segDifficulty: diffKey,
        segSentenceNo: sentenceNo,
        segSentenceHash: cleanText(it.sentence_hash),
      });
    }
  }
  return seqs;
}

/** 弹窗难度 → 语块档位（custom 返回 null = 全档） */
export function pickSegmentDifficulty(difficultyKey) {
  if (!difficultyKey || difficultyKey === "beginner") return "easy";
  if (difficultyKey === "intermediate") return "medium";
  if (difficultyKey === "advanced") return "hard";
  return null; // custom 及未知：全档，交给现有粒度过滤
}

/**
 * 语块模式下难度过滤：先按弹窗难度选档位，再复用现有粒度过滤（custom 走粒度）。
 * 老序列（无 segDifficulty 字段）直接放行交给现有过滤，不受档位预选影响（防误用）。
 * @returns {Array} 过滤后的 sequences
 */
export function filterSegmentsByDifficulty(sequences, difficultyKey, customTypes) {
  const arr = Array.isArray(sequences) ? sequences : [];
  const hasSeg = arr.some((s) => s && s.segDifficulty);
  let picked = arr;
  if (hasSeg) {
    const pick = pickSegmentDifficulty(difficultyKey);
    if (pick) picked = arr.filter((s) => s.segDifficulty === pick);
  }
  return filterSequencesByDifficulty(picked, difficultyKey, customTypes);
}

// ============================================================
// 听写页（QuestDictation，items 流）：语块 → items（整句听写）
// ============================================================

/**
 * 语块 items → 听写 items（每句每档一个组装题，按该档语块分段渐进听写）。
 * - 每个 item 带 chunks=[{ru,zh}]（该档语块顺序，含块级中文）→ 听写页展开器
 *   优先用语块分段生成"零件→累积→整句"步骤；hard 档整句一块 → 展开器判 <2 块直接整句听写。
 * - chunkIsFinal:true → 现有 granularityOfUnit 判 sentence（粒度过滤复用）。
 */
export function segmentsToItems(items) {
  const out = [];
  const ok = (Array.isArray(items) ? items : []).filter(
    (it) => it && it.status === "ok" && Array.isArray(it.segments) && it.segments.length
  );
  const bySentence = new Map();
  for (const it of ok) {
    const h = cleanText(it.sentence_hash) || `h${bySentence.size}`;
    if (!bySentence.has(h)) bySentence.set(h, []);
    bySentence.get(h).push(it);
  }
  let sentenceNo = 0;
  for (const group of bySentence.values()) {
    sentenceNo++;
    for (const it of group) {
      const diffKey = cleanText(it.difficulty) || "medium";
      const segments = [...it.segments].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      const russian = segments.map((s) => cleanText(s.text)).filter(Boolean).join(" ");
      const tokens = russian.split(/\s+/).filter(Boolean);
      const words = tokens.map((w) => ({ ru: w, zh: cleanText(it.translation) }));
      const chunks = segments.map((s) => ({ ru: cleanText(s.text), zh: cleanText(s.chinese) })).filter((c) => c.ru);
      out.push({
        id: `seg_${cleanText(it.sentence_hash) || sentenceNo}_${diffKey}`,
        russian,
        chinese: cleanText(it.translation),
        words,
        audio_url: "",
        chunks, // 该档语块分段（含块级中文）→ 听写页按语块顺序渐进展开
        segDifficulty: diffKey,
        chunkIsFinal: true, // 现有 granularityOfUnit → sentence
      });
    }
  }
  return out;
}

/**
 * 听写页语块模式下难度过滤：档位预选 + 现有粒度过滤；老 items（无 segDifficulty）放行。
 */
export function filterSegmentsItemsByDifficulty(items, difficultyKey, customTypes) {
  const arr = Array.isArray(items) ? items : [];
  const hasSeg = arr.some((it) => it && it.segDifficulty);
  let picked = arr;
  if (hasSeg) {
    const pick = pickSegmentDifficulty(difficultyKey);
    if (pick) picked = arr.filter((it) => it.segDifficulty === pick);
  }
  return filterItemsByDifficulty(picked, difficultyKey, customTypes);
}
