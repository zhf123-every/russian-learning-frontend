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
// originalSentence = 俄语化压缩空白后的原句（骨架强校验基准）
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
    let accZh = "";
    for (let si = 0; si < steps.length; si++) {
      const st = steps[si];
      const add = slotNormalize(st && st.add);
      if (!add) throw new Error(`slotPlan: 第${gi + 1}组第${si + 1}步 add 为空`);
      const russian = slotNormalize(st && st.russian);
      const expected = si === 0 ? add : built[si - 1].russian + " " + add;
      if (russian !== expected) {
        // 后端已机械拼好；此处双保险：不一致视为异常
        throw new Error(`slotPlan: 第${gi + 1}组第${si + 1}步拼接不一致 expected=${expected} got=${russian}`);
      }
      const zh = slotNormalize(st && st.zh);
      accZh = si === 0 ? zh : ([accZh, zh].filter(Boolean).join(" "));
      // 词卡块：add 整块作为零件（连词成句的颗粒）
      const addChunk = { word: add, translation: zh, role: slotNormalize(st && st.type) || "chunk" };
      built.push({
        stepIndex: si + 1,
        russian,
        chinese: "",
        zhAcc: accZh,
        newChunks: [addChunk],
        allChunks: (built[si - 1] ? built[si - 1].allChunks : []).concat([addChunk]),
      });
    }
    // 最后一步中文 = 整句通顺翻译（translation）；中间步 = 该步零件中文累积
    for (let si = 0; si < built.length; si++) {
      built[si].chinese = (si === built.length - 1 && translation) ? translation : built[si].zhAcc;
    }
    // 骨架组（第1组）强校验：拼接 == 原句
    if (gi === 0) {
      const finalText = built[built.length - 1].russian;
      if (finalText !== slotNormalize(originalSentence)) {
        throw new Error(`slotPlan: 骨架组拼接 != 原句 expected=${slotNormalize(originalSentence)} got=${finalText}`);
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

// 校验已生成的 paths（写入前防御）：骨架组拼接 == 原句；每步 russian 递增
export function verifySlotPaths(paths, originalSentence) {
  const arr = Array.isArray(paths) ? paths : [];
  if (!arr.length) return { ok: false, errors: ["无路径"] };
  const errors = [];
  for (let gi = 0; gi < arr.length; gi++) {
    const steps = Array.isArray(arr[gi].steps) ? arr[gi].steps : [];
    if (!steps.length) { errors.push(`路径${gi + 1}无步骤`); continue; }
    for (let si = 0; si < steps.length; si++) {
      const r = slotNormalize(steps[si].russian);
      if (!r) { errors.push(`路径${gi + 1}第${si + 1}步为空`); continue; }
      if (si > 0) {
        const prev = slotNormalize(steps[si - 1].russian);
        const add = slotNormalize(steps[si].newChunks && steps[si].newChunks[0] && steps[si].newChunks[0].word);
        if (r !== prev + " " + add) {
          errors.push(`路径${gi + 1}第${si + 1}步拼接不一致`);
        }
      }
    }
    if (gi === 0) {
      const finalText = slotNormalize(steps[steps.length - 1].russian);
      if (finalText !== slotNormalize(originalSentence)) {
        errors.push(`骨架组拼接 != 原句`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}
