/**
 * wordAnnotate.js —— 词典驱动的逐词标注（词性颜色 / 重音 / 性数格）
 *
 * 数据源：
 *  1. dict-full.js（OpenRussian 开源词典，window.RU_DICT_FULL，25MB，懒加载）
 *     - 名词：完整六格变格表 f.sg / f.pl，性别 g，带重音原形 s
 *     - 动词：变位 f.pres / f.past / f.imp
 *     - 形容词：四性六格 f.m / f.f / f.n / f.pl
 *     - 其它：仅释义
 *  2. dict-data.js（内置简版词典，window.RU_DICT，常驻）：{p: 词性中文, z: 释义}
 *
 * 原理：句中词形 → 在变格/变位表里反向匹配 → 命中即得 原形/词性/性/格/数 + 重音。
 * 纯本地确定性标注，不依赖 AI。
 */
import { getPosColor } from "../constants/posColors";
import { RU_DICT } from "./lemma";

// 中文词性 → 英文代码（posColors 用）
export function ruPosToEn(p) {
  if (!p) return "default";
  if (p.includes("动")) return "verb";
  if (p.includes("名")) return "noun";
  if (p.includes("形")) return "adjective";
  if (p.includes("代") || p.includes("疑")) return "pronoun";
  if (p.includes("数")) return "numeral";
  if (p.includes("副")) return "adverb";
  if (p.includes("连")) return "conjunction";
  if (p.includes("介")) return "preposition";
  if (p.includes("叹")) return "interjection";
  if (p.includes("助") || p.includes("语")) return "particle";
  return "default";
}

function ruGender(p) {
  if (p.includes("阳")) return "masculine";
  if (p.includes("阴")) return "feminine";
  if (p.includes("中")) return "neuter";
  return "";
}

function normForm(word) {
  return (word || "")
    .replace(/'/g, "") // 去重音撇号（词典变格表带 '，句中原文不带，统一用无重音形式匹配）
    .replace(/^[«"'(]+|[»"').,;:!?…]+$/g, "")
    .toLowerCase()
    .trim();
}

// 重音标记：词典用 ' 表示（如 челове'к），转成组合重音符号（приве́т）
// 规则：只有一个元音的词不标重音（俄语单音节词重音唯一，无需标注）
function countVowels(word) {
  return (word.match(/[аеёиоуыэюя]/gi) || []).length;
}

function toStress(word) {
  if (!word) return "";
  const bare = (word || "").replace(/'/g, "");
  if (countVowels(bare) <= 1) return bare;
  return bare.replace(/'/g, "\u0301");
}

const CASE_CODES = ["nom", "gen", "dat", "acc", "inst", "prep"];
const SINGULAR_GENDERS = { m: "masculine", f: "feminine", n: "neuter" };

let dictFullLoaded = false;
let formIndex = null;

/** 懒加载 dict-full.js（25MB，仅首次答对时加载一次） */
export function ensureDictFull() {
  if (dictFullLoaded) return Promise.resolve(true);
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.RU_DICT_FULL) {
    dictFullLoaded = true;
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "/dict-full.js";
    s.onload = () => { dictFullLoaded = true; resolve(true); };
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}

/** 构建 词形 → 词条 索引（正向索引，一次性；form 来自变格/变位表）
 *  注意：仅当全词典（RU_DICT_FULL）已就绪时才缓存索引，
 *  避免"先空构建、后加载"导致空索引被永久缓存。 */
function buildIndex() {
  if (formIndex) return formIndex;
  const D = window.RU_DICT_FULL || {};
  const hasFull = typeof D === "object" && Object.keys(D).length > 0;
  const idx = new Map();
  for (const lemma in D) {
    const e = D[lemma] || {};
    const f = e.f || {};
    const stressedLemma = toStress(e.s || lemma);
    if (e.p === "n") {
      const gender = SINGULAR_GENDERS[e.g] || "";
      ["sg", "pl"].forEach((num, ni) => {
        (f[num] || []).forEach((form, ci) => {
          if (form) idx.set(normForm(form), {
            lemma, pos: "noun", gender,
            caseCode: CASE_CODES[ci] || "",
            number: ni === 0 ? "singular" : "plural",
            stressed: toStress(form),
          });
        });
      });
    } else if (e.p === "a") {
      ["m", "f", "n", "pl"].forEach((key, ki) => {
        const gender = ki === 0 ? "masculine" : ki === 1 ? "feminine" : ki === 2 ? "neuter" : "";
        const number = ki === 3 ? "plural" : "singular";
        (f[key] || []).forEach((form, ci) => {
          if (form) idx.set(normForm(form), {
            lemma, pos: "adjective", gender,
            caseCode: CASE_CODES[ci] || "",
            number,
            stressed: toStress(form),
          });
        });
      });
    } else if (e.p === "v") {
      (f.pres || []).forEach((form, pi) => {
        if (form) idx.set(normForm(form), {
          lemma, pos: "verb",
          person: pi + 1, tense: "present",
          stressed: toStress(form),
        });
      });
      (f.past || []).forEach((form, ki) => {
        if (form) idx.set(normForm(form), {
          lemma, pos: "verb", tense: "past",
          gender: ki === 0 ? "masculine" : ki === 1 ? "feminine" : ki === 2 ? "neuter" : "",
          number: ki === 3 ? "plural" : "singular",
          stressed: toStress(form),
        });
      });
    } else {
      // p === "o"：其它词（代词/副词/数词等），先入原形，稍后用简版词典细化词性
      idx.set(normForm(lemma), {
        lemma, pos: "", stressed: stressedLemma,
      });
    }
  }
  // 用简版词典（RU_DICT）细化 p==="o" 词条的词性 + 补简版未收录词的标注
  for (const lemma in D) {
    const e = D[lemma] || {};
    if (e.p !== "o") continue;
    const hit = idx.get(normForm(lemma));
    if (!hit) continue;
    const base = RU_DICT[lemma];
    if (base && base.p) {
      hit.pos = ruPosToEn(base.p);
      hit.chinese = base.z || "";
    } else {
      hit.pos = "default";
    }
    if (base && base.p && base.p.includes("名")) hit.gender = ruGender(base.p);
  }
  // 简版词典中 dict-full 未收录的词（直接原形入库）
  for (const lemma in RU_DICT) {
    if (D[lemma]) continue;
    const base = RU_DICT[lemma];
    idx.set(normForm(lemma), {
      lemma, pos: ruPosToEn(base.p), chinese: base.z || "",
      gender: ruGender(base.p), stressed: lemma,
    });
  }
  if (hasFull) formIndex = idx;
  return idx;
}

/** 预热：确保全词典已加载并提前构建词形索引（后台调用，答对时标注即时生效） */
export function warmUpIndex() {
  if (formIndex) return formIndex;
  if (typeof window === "undefined" || !window.RU_DICT_FULL) return null;
  return buildIndex();
}

/**
 * 给整句俄语逐词标注。
 * 返回 words 数组（与 AnswerPanel 渲染字段对齐）：
 *  form（带重音）/ lemma / pos / posColor / gender / grammarCase / number / chinese
 */
export function annotateWords(sentence) {
  const idx = buildIndex();
  const tokens = (sentence || "").split(/\s+/).filter(Boolean);
  return tokens.map((w) => {
    const n = normForm(w);
    const hit = idx.get(n);
    if (hit) {
      return {
        form: hit.stressed || w,
        lemma: hit.lemma || n,
        pos: hit.pos || "",
        posColor: hit.pos ? getPosColor(hit.pos) : "",
        gender: hit.gender || "",
        grammarCase: hit.caseCode || "",
        number: hit.number || "",
        chinese: hit.chinese || "",
        roleLabel: "",
        person: hit.person || "",
        tense: hit.tense || "",
      };
    }
    // 兜底：简版词典原形
    const base = RU_DICT[n];
    if (base) {
      const pos = ruPosToEn(base.p);
      return {
        form: w, lemma: n, pos,
        posColor: getPosColor(pos),
        gender: ruGender(base.p),
        chinese: base.z || "",
        roleLabel: "",
      };
    }
    return { form: w, lemma: n, pos: "", posColor: "", chinese: "", roleLabel: "" };
  });
}
