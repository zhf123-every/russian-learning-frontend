/**
 * posColors.js —— 词性颜色映射
 *
 * 基于句乐部真实的词性颜色设置：
 * 名词蓝、动词绿、形容词紫、副词黄、代词红、介词靛蓝、连词粉、感叹词橙
 * 数词同形容词（紫）、助词深灰、其他浅灰
 */

export const POS_COLORS = {
  noun: "#3B82F6",         // 名词 - 蓝
  verb: "#22C55E",         // 动词 - 绿
  adjective: "#A855F7",    // 形容词 - 紫
  adverb: "#EAB308",       // 副词 - 黄
  pronoun: "#EF4444",      // 代词 - 红
  preposition: "oklch(23.27% 0.0249 284.3)",  // 介词 - 靛蓝
  conjunction: "#EC4899",  // 连词 - 粉
  interjection: "#F97316", // 感叹词 - 橙
  numeral: "#A855F7",      // 数词 - 紫（同形容词）
  particle: "#06B6D4",     // 助词 - 青（高亮，区别于其他词性）
  default: "#9CA3AF",      // 其他 - 浅灰
};

// 词性中文标签
export const POS_LABELS = {
  noun: "名词",
  verb: "动词",
  adjective: "形容词",
  adverb: "副词",
  pronoun: "代词",
  preposition: "介词",
  conjunction: "连词",
  interjection: "感叹词",
  numeral: "数词",
  particle: "助词",
};

// 句法角色中文标签
export const ROLE_LABELS = {
  subject: "主语",
  predicate: "谓语",
  object: "宾语",
  attribute: "定语",
  adverbial: "状语",
  complement: "补语",
};

// 格中文标签
export const CASE_LABELS = {
  nom: "第一格",
  acc: "第四格",
  gen: "第二格",
  dat: "第三格",
  ins: "第五格",
  prep: "第六格",
};

// 时态中文标签
export const TENSE_LABELS = {
  present: "现在时",
  past: "过去时",
  future: "将来时",
};

// 人称中文标签
export const PERSON_LABELS = {
  "1st": "1人称",
  "2nd": "2人称",
  "3rd": "3人称",
  1: "1人称",
  2: "2人称",
  3: "3人称",
};

// 数中文标签
export const NUMBER_LABELS = {
  singular: "单数",
  plural: "复数",
};

// 性中文标签
export const GENDER_LABELS = {
  masculine: "阳性",
  feminine: "阴性",
  neuter: "中性",
};

// 体中文标签
export const ASPECT_LABELS = {
  perfective: "完成体",
  imperfective: "未完成体",
};

/**
 * 根据词性获取颜色
 */
export function getPosColor(pos) {
  return POS_COLORS[pos] || POS_COLORS.default;
}

/**
 * 根据词性获取中文标签
 */
export function getPosLabel(pos) {
  return POS_LABELS[pos] || pos || "其他";
}

/**
 * 根据单词的语法字段生成语法标注文字
 * 例如：动词 → "现在时·1人称·单数"
 *      名词 → "第四格·单数·阳性"
 */
export function buildGrammarLabel(word) {
  if (!word) return "";

  const parts = [];

  // 动词：时态 + 体 + 人称 + 数
  if (word.pos === "verb") {
    if (word.tense) parts.push(TENSE_LABELS[word.tense] || word.tense);
    if (word.aspect) parts.push(ASPECT_LABELS[word.aspect] || word.aspect);
    if (word.person) parts.push(PERSON_LABELS[word.person] || word.person);
    if (word.number) parts.push(NUMBER_LABELS[word.number] || word.number);
  }
  // 名词/形容词/代词/数词：格 + 数 + 性
  else if (["noun", "adjective", "pronoun", "numeral"].includes(word.pos)) {
    if (word.grammaticalCase) parts.push(CASE_LABELS[word.grammaticalCase] || word.grammaticalCase);
    if (word.number) parts.push(NUMBER_LABELS[word.number] || word.number);
    if (word.gender) parts.push(GENDER_LABELS[word.gender] || word.gender);
  }
  // 其他：格（如果有）
  else {
    if (word.grammaticalCase) parts.push(CASE_LABELS[word.grammaticalCase] || word.grammaticalCase);
  }

  return parts.join("·");
}
