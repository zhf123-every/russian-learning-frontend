/**
 * slotEngine.js —— 句乐部式滚雪球规划（P4）
 *
 * 链路：后端 /api/admin/segments/plan 返回「增量词序列组」（AI 只出 add，不写整句）
 *      → 本模块机械拼 target（零拼写错误）→ 校验骨架组拼接 == 原句
 *      → 转成 scaffoldingPaths 格式（前端四个答题页直接消费）。
 *
 * 句乐部节奏：第1组=骨架（逐块累积到原句），后续组=变体（否定/疑问/替换），
 * 每组内部 = 新零件 → 累积（句乐部：I → like → I like → the food → I like the food）。
 *
 * 数据结构（与后端 plan 接口对齐）：
 *   plan: {
 *     groups: [{ title, steps: [{ add, russian, zh, type }] }],
 *     translation: "整句中文",
 *   }
 *
 * 输出（scaffoldingPaths 格式，与 scaffolding.js 对齐）：
 *   [{ pathId, name, steps: [{ stepIndex, russian, chinese, newChunks, allChunks }] }]
 */

// 归一化：trim + 压缩空白（与 segmentEngine.normalizeSentence 对齐；俄语化由调用方完成）
export function slotNormalize(text) {
  return String(text || "").trim().replace(/\s+/g, " ");
}

import { normalizeSentence, sentenceHash } from "./segmentEngine.js";

// plan → scaffoldingPaths（纯函数，可单测）
// 块模式（对齐句乐部）：add = 教学块直显，每组最后一步 add = 完整句
// originalSentence = 俄语化压缩空白后的原句（骨架组末步强校验基准）
export function planToScaffoldingPaths(plan, originalSentence) {
  const groups = Array.isArray(plan && plan.groups) ? plan.groups : [];
  if (!groups.length) throw new Error("slotPlan: 无 groups");
  const translation = slotNormalize(plan && plan.translation);
  const paths = [];
  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi];
    const steps = Array.isArray(g.steps) ? g.steps : [];
    if (!steps.length) throw new Error(`slotPlan: 第${gi + 1}组无 steps`);
    const built = [];
    for (let si = 0; si < steps.length; si++) {
      const st = steps[si];
      const block = slotNormalize(st && st.russian);
      if (!block) throw new Error(`slotPlan: 第${gi + 1}组第${si + 1}步 russian 为空`);
      const zh = slotNormalize(st && st.zh);
      // 词卡块：该步教学块整体作为一个零件（连词成句的颗粒）
      const addChunk = { word: block, translation: zh, role: slotNormalize(st && st.type) || "chunk" };
      built.push({
        stepIndex: si + 1,
        russian: block,
        chinese: "",
        zhAcc: zh,
        newChunks: [addChunk],
        allChunks: (built[si - 1] ? built[si - 1].allChunks : []).concat([addChunk]),
      });
    }
    // 最后一步中文 = 整句通顺翻译（translation）；中间步 = 该步块的中文
    for (let si = 0; si < built.length; si++) {
      built[si].chinese = (si === built.length - 1 && translation) ? translation : built[si].zhAcc;
    }
    // 骨架组（第1组）强校验：末步块 == 原句（句乐部机制：末步 add = 完整句）
    if (gi === 0) {
      const finalText = built[built.length - 1].russian;
      if (finalText !== slotNormalize(originalSentence)) {
        throw new Error(`slotPlan: 骨架组末步 != 原句 expected=${slotNormalize(originalSentence)} got=${finalText}`);
      }
    }
    paths.push({
      pathId: `path_${String(gi + 1).padStart(2, "0")}`,
      name: slotNormalize(g.title) || `路径${gi + 1}`,
      steps: built,
    });
  }
  return paths;
}

// 调后端 plan 接口 → 校验 → 转 scaffoldingPaths
// deps: { httpPost(path, body) } 注入（与 segmentEngine 一致，兼容 fetch Response）
// pool：本课变体词池（可选；传了则变体词只能从词池取）
export async function generateSlotPaths({ sentence, tokens, difficulty = "easy", pool, httpPost }, deps = {}) {
  const post = httpPost || (deps && deps.httpPost);
  if (typeof post !== "function") throw new Error("slotEngine: httpPost 必须注入");
  const normalized = normalizeSentence(sentence);
  const body = { sentence_hash: sentenceHash(sentence, difficulty), russian_text: normalized, tokens, difficulty };
  if (pool && typeof pool === "object") body.pool = pool;
  const res = await post("/api/admin/segments/plan", body);
  const r = (res && typeof res.json === "function") ? await res.json().catch(() => ({})) : (res || {});
  if (r.ok === false) {
    if (r.pending) return { pending: true };
    return { fallback: true, reason: r.reason || "fallback", raw: r.raw || "" };
  }
  const paths = planToScaffoldingPaths({ groups: r.groups, translation: r.translation }, normalized);
  return { paths };
}

// 调后端 pool 接口 → 课程级变体词池（9 类各 2-4 词）
export async function generateVariantPool({ sentences, httpPost }, deps = {}) {
  const post = httpPost || (deps && deps.httpPost);
  if (typeof post !== "function") throw new Error("slotEngine: httpPost 必须注入");
  const list = (Array.isArray(sentences) ? sentences : []).map((s) => ({
    ru: String(s.ru || s.russian || s.text || "").trim(),
    zh: String(s.zh || s.chinese || "").trim(),
  })).filter((s) => s.ru);
  if (!list.length) throw new Error("slotEngine: 词池生成需要至少一句");
  const res = await post("/api/admin/segments/pool", { sentences: list });
  const r = (res && typeof res.json === "function") ? await res.json().catch(() => ({})) : (res || {});
  if (r.ok === false) return { fallback: true, reason: r.reason || "fallback", raw: r.raw || "" };
  return { pool: r.pool };
}

// 校验已生成的 paths（写入前防御，块模式）：
//  骨架组：末步块 == 原句（硬校验）；末步是组内最长块（弱校验，防 AI 末步不是完整句）
//  变体组：末步非空且最长；末步 != 骨架末步（不重复原句）；末步中文非空且 != 原句翻译（防中文错乱）
export function verifySlotPaths(paths, originalSentence, originalZh) {
  const arr = Array.isArray(paths) ? paths : [];
  if (!arr.length) return { ok: false, errors: ["无路径"] };
  const errors = [];
  const skeletonFinal = arr[0] && Array.isArray(arr[0].steps) && arr[0].steps.length
    ? slotNormalize(arr[0].steps[arr[0].steps.length - 1].russian)
    : "";
  const skeletonZh = arr[0] && Array.isArray(arr[0].steps) && arr[0].steps.length
    ? String(arr[0].steps[arr[0].steps.length - 1].chinese || "").trim()
    : "";
  for (let gi = 0; gi < arr.length; gi++) {
    const steps = Array.isArray(arr[gi].steps) ? arr[gi].steps : [];
    if (!steps.length) { errors.push(`路径${gi + 1}无步骤`); continue; }
    let maxLen = 0;
    for (let si = 0; si < steps.length - 1; si++) {
      const r = slotNormalize(steps[si].russian);
      if (!r) { errors.push(`路径${gi + 1}第${si + 1}步为空`); continue; }
      if (r.length > maxLen) maxLen = r.length;
    }
    const finalText = slotNormalize(steps[steps.length - 1].russian);
    if (gi === 0) {
      if (finalText !== slotNormalize(originalSentence)) {
        errors.push(`骨架组末步 != 原句`);
      }
    } else {
      // 变体组：末步必须不同于骨架末步（不能重复原句）
      if (finalText === skeletonFinal) {
        errors.push(`路径${gi + 1}末步与骨架末步重复（变体句不能等于原句）`);
      }
      // 变体组：末步中文不能照抄原句翻译（防中文错乱）
      const finalZh = String(steps[steps.length - 1].chinese || "").trim();
      if (!finalZh) {
        errors.push(`路径${gi + 1}末步缺中文`);
      } else if (originalZh && finalZh === String(originalZh || "").trim()) {
        errors.push(`路径${gi + 1}末步中文与原句翻译相同（变体句翻译错误）`);
      }
    }
    if (finalText.length <= maxLen) {
      errors.push(`路径${gi + 1}末步不是最长块（最后一步应是完整句）`);
    }
  }
  return { ok: errors.length === 0, errors };
}
