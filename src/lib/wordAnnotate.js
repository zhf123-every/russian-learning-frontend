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
  // 注意顺序：'副/名'（时间词 сегодня/завтра 等）须判为副词（状语），不能先命中"名"
  if (p.includes("副")) return "adverb";
  if (p.includes("名")) return "noun";
  if (p.includes("形")) return "adjective";
  if (p.includes("代") || p.includes("疑")) return "pronoun";
  if (p.includes("数")) return "numeral";
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
    .replace(/\u0301/g, "") // 去 Unicode 组合重音符（句中原文 é 的真实重音，如 "Э́то"）
    .replace(/^[«"'(]+|[»"').,;:!?…]+$/g, "")
    .toLowerCase()
    .trim();
}

// 高频虚词硬编码表（词典未收录时的兜底标注，key 为 normForm 无重音小写原形）
// 作用：保证以后上传的任何课程，句中连词/前置词/语气词/感叹词都有正确词性 → 形态规则引擎据此标对句子成分
const FUNCTION_WORDS = {
  // ---- 连接词 ----
  "и": { pos: "conjunction", zh: "和" },
  "а": { pos: "conjunction", zh: "而/但是" },
  "но": { pos: "conjunction", zh: "但是" },
  "или": { pos: "conjunction", zh: "或者" },
  "либо": { pos: "conjunction", zh: "或者" },
  "что": { pos: "conjunction", zh: "（连接词）" },
  "чтобы": { pos: "conjunction", zh: "为了/以便" },
  "чтоб": { pos: "conjunction", zh: "为了/以便" },
  "если": { pos: "conjunction", zh: "如果" },
  "когда": { pos: "conjunction", zh: "当…时" },
  "хотя": { pos: "conjunction", zh: "虽然/尽管" },
  "хоть": { pos: "conjunction", zh: "虽然/哪怕" },
  "потому": { pos: "conjunction", zh: "因为" },
  "поэтому": { pos: "conjunction", zh: "因此" },
  "так": { pos: "conjunction", zh: "这样/所以" },
  "как": { pos: "conjunction", zh: "如何/像" },
  "будто": { pos: "conjunction", zh: "仿佛" },
  "словно": { pos: "conjunction", zh: "好像" },
  "зато": { pos: "conjunction", zh: "但是/不过" },
  "однако": { pos: "conjunction", zh: "然而" },
  "чем": { pos: "conjunction", zh: "（比较）" },
  "пока": { pos: "conjunction", zh: "趁/直到" },
  "тоже": { pos: "conjunction", zh: "也" },
  "также": { pos: "conjunction", zh: "同样/也" },
  "то": { pos: "conjunction", zh: "那么/（指示）" },
  "да": { pos: "conjunction", zh: "和/但是/（是的）" },
  // ---- 前置词 ----
  "в": { pos: "preposition", zh: "在…里" },
  "во": { pos: "preposition", zh: "在…里" },
  "на": { pos: "preposition", zh: "在…上" },
  "с": { pos: "preposition", zh: "和/从" },
  "со": { pos: "preposition", zh: "和/从" },
  "к": { pos: "preposition", zh: "朝…" },
  "ко": { pos: "preposition", zh: "朝…" },
  "у": { pos: "preposition", zh: "在…旁边" },
  "о": { pos: "preposition", zh: "关于" },
  "об": { pos: "preposition", zh: "关于" },
  "обо": { pos: "preposition", zh: "关于" },
  "из": { pos: "preposition", zh: "从…里" },
  "изо": { pos: "preposition", zh: "从…里" },
  "для": { pos: "preposition", zh: "为了" },
  "по": { pos: "preposition", zh: "沿着/按照" },
  "за": { pos: "preposition", zh: "在…后面" },
  "до": { pos: "preposition", zh: "直到" },
  "от": { pos: "preposition", zh: "从" },
  "ото": { pos: "preposition", zh: "从" },
  "при": { pos: "preposition", zh: "在…时/附属于" },
  "между": { pos: "preposition", zh: "在…之间" },
  "через": { pos: "preposition", zh: "穿过/经过" },
  "без": { pos: "preposition", zh: "没有" },
  "безо": { pos: "preposition", zh: "没有" },
  "над": { pos: "preposition", zh: "在…上方" },
  "надо": { pos: "preposition", zh: "在…上方" },
  "под": { pos: "preposition", zh: "在…下面" },
  "подо": { pos: "preposition", zh: "在…下面" },
  "перед": { pos: "preposition", zh: "在…前面" },
  "пред": { pos: "preposition", zh: "在…前面" },
  "после": { pos: "preposition", zh: "在…之后" },
  "около": { pos: "preposition", zh: "在…附近" },
  "возле": { pos: "preposition", zh: "在…旁边" },
  "вокруг": { pos: "preposition", zh: "围绕" },
  "среди": { pos: "preposition", zh: "在…之中" },
  "против": { pos: "preposition", zh: "反对" },
  "кроме": { pos: "preposition", zh: "除了" },
  "вместо": { pos: "preposition", zh: "代替" },
  "напротив": { pos: "preposition", zh: "在…对面" },
  "вдоль": { pos: "preposition", zh: "沿着" },
  "мимо": { pos: "preposition", zh: "经过" },
  "сквозь": { pos: "preposition", zh: "穿过" },
  // ---- 语气词 ----
  "не": { pos: "particle", zh: "不" },
  "ни": { pos: "particle", zh: "（否定加强）" },
  "же": { pos: "particle", zh: "（强调）" },
  "ж": { pos: "particle", zh: "（强调）" },
  "ли": { pos: "particle", zh: "吗（疑问）" },
  "ль": { pos: "particle", zh: "吗（疑问）" },
  "бы": { pos: "particle", zh: "（假设）" },
  "б": { pos: "particle", zh: "（假设）" },
  "ведь": { pos: "particle", zh: "要知道" },
  "вот": { pos: "particle", zh: "这就是" },
  "вон": { pos: "particle", zh: "那就是" },
  "только": { pos: "particle", zh: "只/仅" },
  "лишь": { pos: "particle", zh: "只/仅仅" },
  "даже": { pos: "particle", zh: "甚至" },
  "именно": { pos: "particle", zh: "正是" },
  "разве": { pos: "particle", zh: "难道" },
  "неужели": { pos: "particle", zh: "难道" },
  "пусть": { pos: "particle", zh: "让/尽管" },
  "пускай": { pos: "particle", zh: "让/尽管" },
  "уж": { pos: "particle", zh: "（强调）" },
  "нет": { pos: "particle", zh: "不/没有" },
  // ---- 感叹词 ----
  "ах": { pos: "interjection", zh: "啊" },
  "ох": { pos: "interjection", zh: "噢" },
  "ой": { pos: "interjection", zh: "哎哟" },
  "эй": { pos: "interjection", zh: "喂" },
  "ай": { pos: "interjection", zh: "哎呀" },
  "ура": { pos: "interjection", zh: "乌拉/万岁" },
  "ну": { pos: "interjection", zh: "那么/喂" },
  "ага": { pos: "interjection", zh: "（表示明白）" },
  "ого": { pos: "interjection", zh: "哦豁" },
  // ---- 时间/地点副词（词典变形未收录时兜底：名词第五格时间词 → 副词 → 成分标状语）----
  "утром": { pos: "adverb", zh: "在早晨" },
  "днём": { pos: "adverb", zh: "在白天" },
  "вечером": { pos: "adverb", zh: "在晚上" },
  "ночью": { pos: "adverb", zh: "在夜里" },
  "летом": { pos: "adverb", zh: "在夏天" },
  "зимой": { pos: "adverb", zh: "在冬天" },
  "весной": { pos: "adverb", zh: "在春天" },
  "осенью": { pos: "adverb", zh: "在秋天" },
  "сегодня": { pos: "adverb", zh: "今天" },
  "завтра": { pos: "adverb", zh: "明天" },
  "вчера": { pos: "adverb", zh: "昨天" },
  "сейчас": { pos: "adverb", zh: "现在" },
  "потом": { pos: "adverb", zh: "然后" },
  "сначала": { pos: "adverb", zh: "首先" },
  "рано": { pos: "adverb", zh: "早" },
  "поздно": { pos: "adverb", zh: "晚" },
  "всегда": { pos: "adverb", zh: "总是" },
  "никогда": { pos: "adverb", zh: "从不" },
  "часто": { pos: "adverb", zh: "经常" },
  "редко": { pos: "adverb", zh: "很少" },
  "быстро": { pos: "adverb", zh: "快速地" },
  "медленно": { pos: "adverb", zh: "慢慢地" },
  "хорошо": { pos: "adverb", zh: "好" },
  "плохо": { pos: "adverb", zh: "坏" },
  "очень": { pos: "adverb", zh: "非常" },
  "здесь": { pos: "adverb", zh: "在这里" },
  "тут": { pos: "adverb", zh: "在这里" },
  "там": { pos: "adverb", zh: "在那里" },
  "дома": { pos: "adverb", zh: "在家" },
  "везде": { pos: "adverb", zh: "到处" },
};

// 重音标记：词典用 ' 表示（如 челове'к），转成组合重音符号（приве́т）
// 规则：只有一个元音的词不标重音（俄语单音节词重音唯一，无需标注）
function countVowels(word) {
  return (word.match(/[аеёиоуыэюя]/gi) || []).length;
}

function toStress(word) {
  if (!word) return "";
  const bare = (word || "").replace(/'/g, "");
  if (countVowels(bare) <= 1) return bare; // 单音节词不标重音
  // 把词典撇号重音转成组合重音符号（必须在含撇号的原文上替换，不能先删撇号再替换）
  return (word || "").replace(/'/g, "\u0301");
}

const CASE_CODES = ["nom", "gen", "dat", "acc", "inst", "prep"];
const SINGULAR_GENDERS = { m: "masculine", f: "feminine", n: "neuter" };

let dictFullLoaded = false;
let formIndex = null;

/** 懒加载 dict-zh.js（БКРС 俄汉词典，7.9MB，中文释义补全） */
let dictZhLoaded = false;
export function ensureDictZh() {
  if (dictZhLoaded) return Promise.resolve(true);
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.RU_DICT_ZH) {
    dictZhLoaded = true;
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "/dict-zh.js";
    s.onload = () => { dictZhLoaded = true; resolve(true); };
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}

/** 中文释义查询链：词形直查 → 原形查询（БКРС 含变形词，先直查词形再查原形） */
function zhOf(form, lemma) {
  const D = (typeof window !== "undefined" && window.RU_DICT_ZH) || {};
  const n = normForm(form);
  const l = normForm(lemma);
  return D[n] || (l && l !== n ? D[l] : "") || "";
}

/** 懒加载 dict-full.js（25MB，仅首次答对时加载一次） */
export function ensureDictFull() {
  if (dictFullLoaded) return Promise.resolve(true);
  ensureDictZh(); // 顺带并行预热中文释义词典
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
// 词典缺失词条补充表（dict-full.js 缺物主代词 наш/ваш，导致 ваша/наша 等查不到 → 无词性色/无成分）
// 格式与 dict-full 一致：p=a（形容词，与 мой/твой/свой 同标注）、f 为四性六格变格表，重音用 ' 撇号
const SUPPLEMENT = {
  "наш": { p: "a", s: "на'ш", f: {
    m: ["на'ш", "на'шего", "на'шему", "на'ш", "на'шим", "на'шем"],
    f: ["на'ша", "на'шей", "на'шей", "на'шу", "на'шей", "на'шей"],
    n: ["на'ше", "на'шего", "на'шему", "на'ше", "на'шим", "на'шем"],
    pl: ["на'ши", "на'ших", "на'шим", "на'ши", "на'шими", "на'ших"],
  } },
  "ваш": { p: "a", s: "ва'ш", f: {
    m: ["ва'ш", "ва'шего", "ва'шему", "ва'ш", "ва'шим", "ва'шем"],
    f: ["ва'ша", "ва'шей", "ва'шей", "ва'шу", "ва'шей", "ва'шей"],
    n: ["ва'ше", "ва'шего", "ва'шему", "ва'ше", "ва'шим", "ва'шем"],
    pl: ["ва'ши", "ва'ших", "ва'шим", "ва'ши", "ва'шими", "ва'ших"],
  } },
};
function buildIndex() {
  if (formIndex) return formIndex;
  const D0 = window.RU_DICT_FULL || {};
  const hasFull = typeof D0 === "object" && Object.keys(D0).length > 0;
  const D = { ...SUPPLEMENT, ...D0 }; // 补充缺失词条（dict-full 已有词条优先，不覆盖）
  const idx = new Map();
  for (const lemma in D) {
    const e = D[lemma] || {};
    const f = e.f || {};
    const stressedLemma = toStress(e.s || lemma);
    if (e.p === "n") {
      const gender = SINGULAR_GENDERS[e.g] || "";
      const zh = (RU_DICT[lemma] && RU_DICT[lemma].z) || ""; // 变形词回填中文释义（简版词典）
      ["sg", "pl"].forEach((num, ni) => {
        (f[num] || []).forEach((form, ci) => {
          if (form) idx.set(normForm(form), {
            lemma, pos: "noun", gender,
            caseCode: CASE_CODES[ci] || "",
            number: ni === 0 ? "singular" : "plural",
            stressed: toStress(form),
            chinese: zh,
          });
        });
      });
    } else if (e.p === "a") {
      const zh = (RU_DICT[lemma] && RU_DICT[lemma].z) || "";
      ["m", "f", "n", "pl"].forEach((key, ki) => {
        const gender = ki === 0 ? "masculine" : ki === 1 ? "feminine" : ki === 2 ? "neuter" : "";
        const number = ki === 3 ? "plural" : "singular";
        (f[key] || []).forEach((form, ci) => {
          if (form) idx.set(normForm(form), {
            lemma, pos: "adjective", gender,
            caseCode: CASE_CODES[ci] || "",
            number,
            stressed: toStress(form),
            chinese: zh,
          });
        });
      });
    } else if (e.p === "v") {
      const zh = (RU_DICT[lemma] && RU_DICT[lemma].z) || "";
      (f.pres || []).forEach((form, pi) => {
        if (form) idx.set(normForm(form), {
          lemma, pos: "verb",
          person: pi + 1, tense: "present",
          stressed: toStress(form),
          chinese: zh,
        });
      });
      (f.past || []).forEach((form, ki) => {
        if (form) idx.set(normForm(form), {
          lemma, pos: "verb", tense: "past",
          gender: ki === 0 ? "masculine" : ki === 1 ? "feminine" : ki === 2 ? "neuter" : "",
          number: ki === 3 ? "plural" : "singular",
          stressed: toStress(form),
          chinese: zh,
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
        chinese: hit.chinese || zhOf(n, hit.lemma) || "",
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
        chinese: base.z || zhOf(n, n) || "",
        roleLabel: "",
      };
    }
    // 兜底2：高频虚词硬编码表（连词/前置词/语气词/感叹词）——词典未收录也保证词性与成分正确
    const fw = FUNCTION_WORDS[n];
    if (fw) {
      return {
        form: w, lemma: n, pos: fw.pos,
        posColor: getPosColor(fw.pos),
        chinese: fw.zh || "",
        roleLabel: "",
      };
    }
    return { form: w, lemma: n, pos: "", posColor: "", chinese: zhOf(n, n) || "", roleLabel: "" };
  });
}
