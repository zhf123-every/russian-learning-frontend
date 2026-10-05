/**
 * slotTablesToQuestions.js —— 6 列表格（sentence_slot_unit_tables）→ 答题引擎数据
 *
 * 学生端契约（用户钉死）：不显示序号/列表，只按 rows 顺序给中文 → 打字输入俄语；每行 = 一步。
 * 数据来源：GET /api/slot-tables（P2 已上线，公开读）。只收 status='ok' 且 rows 非空的句子。
 * 整课无 ok 表格 → 返回 []，页面降级回现有链路（语块/滚雪球），行为零变化。
 *
 * 粒度设计（兼容现有 filterSegmentsByDifficulty / filterSegmentsItemsByDifficulty）：
 * - 积木行   → chunkIsNew:true（≤1 词=word、>1 词=chunk）
 * - 完整句行 → chunkIsFinal:true（sentence）
 * - sequence/item 带 segDifficulty（档位预选复用：beginner→easy / intermediate→medium / advanced→hard）
 * - 序号只定顺序（seq），不出现在任何 unit 展示字段
 */
const DIFF_LABEL = { easy: "初级", medium: "中级", hard: "高级" };

function cleanText(v) {
  return String(v || "").trim();
}

/** 表格行 → 零件题/组装题 unit（与 scaffoldingToSequences 的 unit 同构） */
function rowToUnit(row, sequenceId, seqIdx, order, sentenceNo, diffLabel) {
  const russian = cleanText(row.ru);
  const tokens = russian.split(/\s+/).filter(Boolean);
  const zh = cleanText(row.zh);
  const words = tokens.map((w, i) => ({
    order: i,
    form: w,
    lemma: w,
    translation: zh, // 行级中文（积木=该块中文，完整句=整句中文）
    pos: "",
    posColor: "",
    grammarLabel: "",
    roleLabel: cleanText(row.tag), // 语法标签（6 列表格第 5 列）
    scaffoldNew: false,
  }));
  const isFull = cleanText(row.cardType) === "完整句";
  return {
    id: `${sequenceId}_${String(order).padStart(2, "0")}`,
    sequenceId,
    sequenceOrder: order,
    russian,
    stressMarked: russian,
    chinese: zh,
    audioUrl: "",
    action: "",
    grammarNote: "",
    newElement: "",
    words,
    acceptableAnswers: [{ wordOrder: tokens.map((_, i) => i), wordVariants: {}, isDefault: true, note: "" }],
    // 粒度标记（现有 granularityOfUnit 识别）：完整句=sentence；积木行=word/chunk 按词数
    ...(isFull ? { chunkIsFinal: true } : { chunkIsNew: true }),
    // 表格元数据
    tableRow: { seq: row.seq, cardType: cleanText(row.cardType), tag: cleanText(row.tag), groupId: cleanText(row.groupId) },
    sentenceNo,
  };
}

/**
 * 表格 items → sequences（每句每档一个 sequence；每行 = 一个 unit，顺序 = seq）
 * @param {Array} items GET /api/slot-tables 的 items（[{sentence_hash,sentence,difficulty,status,rows}]）
 * @param {string} title 课时标题（兜底命名）
 * @returns {Array} 与 scaffoldingToSequences 兼容的 sequences
 */
export function slotTablesToSequences(items, title) {
  const seqs = [];
  const ok = (Array.isArray(items) ? items : []).filter(
    (it) => it && it.status === "ok" && Array.isArray(it.rows) && it.rows.length
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
      const rows = [...it.rows].sort((a, b) => (a.seq || 0) - (b.seq || 0));
      const sequenceId = `slot_${cleanText(it.sentence_hash) || sentenceNo}_${diffKey}`;
      const name = `句子 ${sentenceNo}（${DIFF_LABEL[diffKey] || diffKey}）`;
      const units = rows.map((row, i) => rowToUnit(row, sequenceId, i, i + 1, sentenceNo, DIFF_LABEL[diffKey]));
      if (!units.length) continue;
      seqs.push({
        id: sequenceId,
        name,
        familyName: name,
        units,
        totalUnits: units.length,
        fullSentence: cleanText(it.sentence) || units[units.length - 1].russian,
        segDifficulty: diffKey,
        segSentenceNo: sentenceNo,
        segSentenceHash: cleanText(it.sentence_hash),
      });
    }
  }
  return seqs;
}

// ============================================================
// 听写页（QuestDictation，items 流）：表格 → items（每行一个听写步）
// ============================================================

/**
 * 表格 items → 听写 items（每句每档一个 sequence 的每行一个 item，按 seq 顺序）。
 * 每行独立听写该行 ru（给 zh → 听 → 打 ru）；积木行/完整句行都作为一步。
 * 粒度标记复用：完整句行 chunkIsFinal / 积木行 chunkIsNew。
 */
export function slotTablesToItems(items) {
  const out = [];
  const ok = (Array.isArray(items) ? items : []).filter(
    (it) => it && it.status === "ok" && Array.isArray(it.rows) && it.rows.length
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
      const rows = [...it.rows].sort((a, b) => (a.seq || 0) - (b.seq || 0));
      for (const row of rows) {
        const russian = cleanText(row.ru);
        if (!russian) continue;
        const tokens = russian.split(/\s+/).filter(Boolean);
        const isFull = cleanText(row.cardType) === "完整句";
        out.push({
          id: `slot_${cleanText(it.sentence_hash) || sentenceNo}_${diffKey}_${row.seq || 0}`,
          russian,
          chinese: cleanText(row.zh),
          words: tokens.map((w) => ({ ru: w, zh: cleanText(row.zh) })),
          audio_url: "",
          chunks: [], // 单行整句听写（无分段提示）
          segDifficulty: diffKey,
          ...(isFull ? { chunkIsFinal: true } : { chunkIsNew: true }),
        });
      }
    }
  }
  return out;
}
