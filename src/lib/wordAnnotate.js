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
  // "疑/连"（что 等）→ 连词（从句引导词常见）；"数/形" 会在后面命中"形"
  if (p.includes("连")) return "conjunction";
  if (p.includes("动")) return "verb";
  // 注意顺序：'副/名'（时间词 сегодня/завтра 等）须判为副词（状语），不能先命中"名"
  if (p.includes("副")) return "adverb";
  if (p.includes("名")) return "noun";
  if (p.includes("形")) return "adjective";
  if (p.includes("代") || p.includes("疑")) return "pronoun";
  if (p.includes("数")) return "numeral";
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
    .replace(/^[«"'(]+|[»"').,;:!?…—–-]+$/g, "")
    .toLowerCase()
    .trim();
}

// 去掉 token 尾部标点（词卡显示用；标点由 AnswerPanel 按原句另行渲染）
function cleanToken(word) {
  return String(word || "").replace(/[.,!?;:…—–-]+$/g, "").trim();
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
  // ---- 代词（常见） ----
  "это": { pos: "pronoun", zh: "这是", gender: "neuter", number: "singular" },
  "Это": { pos: "pronoun", zh: "这是", gender: "neuter", number: "singular" },
  "этом": { pos: "pronoun", zh: "这个（前置）", gender: "neuter", number: "singular", grammarCase: "prepositional" },
  "этот": { pos: "pronoun", zh: "这个", gender: "masculine", number: "singular" },
  "эта": { pos: "pronoun", zh: "这个", gender: "feminine", number: "singular" },
  "эти": { pos: "pronoun", zh: "这些", number: "plural" },
  "он": { pos: "pronoun", zh: "他", gender: "masculine", number: "singular" },
  "она": { pos: "pronoun", zh: "她", gender: "feminine", number: "singular" },
  "оно": { pos: "pronoun", zh: "它", gender: "neuter", number: "singular" },
  "они": { pos: "pronoun", zh: "他们", number: "plural" },
  "его": { pos: "pronoun", zh: "他（属格）", gender: "masculine", number: "singular", grammarCase: "genitive" },
  "её": { pos: "pronoun", zh: "她（属格）", gender: "feminine", number: "singular", grammarCase: "genitive" },
  "им": { pos: "pronoun", zh: "他（与格）", grammarCase: "dative" },
  "них": { pos: "pronoun", zh: "他们（前置/属格）", number: "plural", grammarCase: "prepositional" },
  "я": { pos: "pronoun", zh: "我", number: "singular" },
  "ты": { pos: "pronoun", zh: "你", number: "singular" },
  "мы": { pos: "pronoun", zh: "我们", number: "plural" },
  "вы": { pos: "pronoun", zh: "你们/您", number: "plural" },
  "меня": { pos: "pronoun", zh: "我（属格）", number: "singular", grammarCase: "genitive" },
  "тебя": { pos: "pronoun", zh: "你（属格）", number: "singular", grammarCase: "genitive" },
  "мне": { pos: "pronoun", zh: "我（与格）", number: "singular", grammarCase: "dative" },
  "тебе": { pos: "pronoun", zh: "你（与格）", number: "singular", grammarCase: "dative" },
  "нас": { pos: "pronoun", zh: "我们（属格）", number: "plural", grammarCase: "genitive" },
  "вас": { pos: "pronoun", zh: "你们（属格）", number: "plural", grammarCase: "genitive" },
  "не": { pos: "negation", zh: "不/不是" },
  "нет": { pos: "negation", zh: "不/没有" },
  "неправда": { pos: "negation", zh: "不对" },
  // давай + 动词 = 祈使建议语气词（"Давай пойдём!" 我们去吧），优先于 давать 命令式"给"
  "давай": { pos: "particle", zh: "来吧/让我们" },
  "разве": { pos: "particle", zh: "难道" },
  "ли": { pos: "particle", zh: "是否/呢" },
  "же": { pos: "particle", zh: "就/倒是" },
  "только": { pos: "particle", zh: "只/仅" },
  // 无人称谓语副词（категория состояния）："Как жаль!" 真遗憾——词典常缺失，人工补词保证词性
  "жаль": { pos: "adverb", zh: "遗憾/可惜" },
  "надо": { pos: "adverb", zh: "需要" },
  "можно": { pos: "adverb", zh: "可以" },
  "нужно": { pos: "adverb", zh: "需要" },
  "нельзя": { pos: "adverb", zh: "不可以" },
  "пора": { pos: "adverb", zh: "该…了" },
  "уже": { pos: "adverb", zh: "已经" },
  "ещё": { pos: "adverb", zh: "还/再" },
  "очень": { pos: "adverb", zh: "很/非常" },
  "тут": { pos: "adverb", zh: "这里" },
  "там": { pos: "adverb", zh: "那里" },
  "здесь": { pos: "adverb", zh: "这里" },
  "сейчас": { pos: "adverb", zh: "现在" },
  "потом": { pos: "adverb", zh: "然后" },
  "сейчас": { pos: "adverb", zh: "现在" },
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
  "где": { pos: "adverb", zh: "在哪里" },
  "куда": { pos: "adverb", zh: "去哪里" },
  "откуда": { pos: "adverb", zh: "从哪里" },
  "когда": { pos: "adverb", zh: "什么时候" },
  "зачем": { pos: "adverb", zh: "为什么" },
  "почему": { pos: "adverb", zh: "为什么" },
  "как": { pos: "adverb", zh: "怎样/如何" },
  // ---- 词典兜底补词（dict-full/简版词典缺失，导致词卡无词性无成分）----
  "домой": { pos: "adverb", zh: "回家/向家里" },
  "отдыхать": { pos: "verb", zh: "休息" },
  "москва": { pos: "noun", zh: "莫斯科", gender: "feminine", number: "singular" },
  "москве": { pos: "noun", zh: "莫斯科", gender: "feminine", number: "singular", grammarCase: "prepositional" },
  "москву": { pos: "noun", zh: "莫斯科", gender: "feminine", number: "singular", grammarCase: "accusative" },
  // ---- 数词 ----
  "одна": { pos: "numeral", zh: "一个（阴性）" },
  "один": { pos: "numeral", zh: "一个（阳性）" },
  "одно": { pos: "numeral", zh: "一个（中性）" },
  "два": { pos: "numeral", zh: "二" },
  "три": { pos: "numeral", zh: "三" },
  "четыре": { pos: "numeral", zh: "四" },
  "сто": { pos: "numeral", zh: "百" },
  "двести": { pos: "numeral", zh: "二百" },
  "триста": { pos: "numeral", zh: "三百" },
  "четыреста": { pos: "numeral", zh: "四百" },
  "тысяча": { pos: "numeral", zh: "千" },
  "девятьсот": { pos: "numeral", zh: "九百" },
  "восемьдесят": { pos: "numeral", zh: "八十" },
  // ---- 代词 ----
  "мной": { pos: "pronoun", zh: "我（第五格）" },
  "мне": { pos: "pronoun", zh: "我（第三格）" },
  "меня": { pos: "pronoun", zh: "我（第二格）" },
  "меня́": { pos: "pronoun", zh: "我（第二格）" },
};

// 高频动词现在时变位补充表（dict-full.js 未就绪/加载失败时的兜底）
// 作用：знаю/говорит/любишь 等只有完整词典才有变位索引的词形，即使懒加载词典没到也能标出动词词性 → 词性色 + 谓语成分
const VERB_FORMS = {
  "знаю": { lemma: "знать", person: 1, zh: "知道" }, "знаешь": { lemma: "знать", person: 2, zh: "知道" }, "знает": { lemma: "знать", person: 3, zh: "知道" }, "знаем": { lemma: "знать", person: 1, zh: "知道" }, "знаете": { lemma: "знать", person: 2, zh: "知道" }, "знают": { lemma: "знать", person: 3, zh: "知道" },
  // 动词原形（不定式）
  "заниматься": { lemma: "заниматься", person: 0, zh: "学习、从事、忙于" },
  "мечтать": { lemma: "мечтать", person: 0, zh: "梦想、幻想" },
  "познакомьтесь": { lemma: "познакомиться", person: 2, zh: "认识一下" },  "говорю": { lemma: "говорить", person: 1, zh: "说" }, "говоришь": { lemma: "говорить", person: 2, zh: "说" }, "говорит": { lemma: "говорить", person: 3, zh: "说" }, "говорим": { lemma: "говорить", person: 1, zh: "说" }, "говорите": { lemma: "говорить", person: 2, zh: "说" }, "говорят": { lemma: "говорить", person: 3, zh: "说" },
  "люблю": { lemma: "любить", person: 1, zh: "爱" }, "любишь": { lemma: "любить", person: 2, zh: "爱" }, "любит": { lemma: "любить", person: 3, zh: "爱" }, "любим": { lemma: "любить", person: 1, zh: "爱" }, "любите": { lemma: "любить", person: 2, zh: "爱" }, "любят": { lemma: "любить", person: 3, zh: "爱" },
  "хочу": { lemma: "хотеть", person: 1, zh: "想要" }, "хочешь": { lemma: "хотеть", person: 2, zh: "想要" }, "хочет": { lemma: "хотеть", person: 3, zh: "想要" }, "хотим": { lemma: "хотеть", person: 1, zh: "想要" }, "хотите": { lemma: "хотеть", person: 2, zh: "想要" }, "хотят": { lemma: "хотеть", person: 3, zh: "想要" },
  "могу": { lemma: "мочь", person: 1, zh: "能够" }, "можешь": { lemma: "мочь", person: 2, zh: "能够" }, "может": { lemma: "мочь", person: 3, zh: "能够" }, "можем": { lemma: "мочь", person: 1, zh: "能够" }, "можете": { lemma: "мочь", person: 2, zh: "能够" }, "могут": { lemma: "мочь", person: 3, zh: "能够" },
  "делаю": { lemma: "делать", person: 1, zh: "做" }, "делаешь": { lemma: "делать", person: 2, zh: "做" }, "делает": { lemma: "делать", person: 3, zh: "做" }, "делаем": { lemma: "делать", person: 1, zh: "做" }, "делаете": { lemma: "делать", person: 2, zh: "做" }, "делают": { lemma: "делать", person: 3, zh: "做" },
  "живу": { lemma: "жить", person: 1, zh: "住" }, "живёшь": { lemma: "жить", person: 2, zh: "住" }, "живёт": { lemma: "жить", person: 3, zh: "住" }, "живём": { lemma: "жить", person: 1, zh: "住" }, "живёте": { lemma: "жить", person: 2, zh: "住" }, "живут": { lemma: "жить", person: 3, zh: "住" },
  "работаю": { lemma: "работать", person: 1, zh: "工作" }, "работаешь": { lemma: "работать", person: 2, zh: "工作" }, "работает": { lemma: "работать", person: 3, zh: "工作" }, "работаем": { lemma: "работать", person: 1, zh: "工作" }, "работаете": { lemma: "работать", person: 2, zh: "工作" }, "работают": { lemma: "работать", person: 3, zh: "工作" },
  "читаю": { lemma: "читать", person: 1, zh: "读" }, "читаешь": { lemma: "читать", person: 2, zh: "读" }, "читает": { lemma: "читать", person: 3, zh: "读" }, "читаем": { lemma: "читать", person: 1, zh: "读" }, "читаете": { lemma: "читать", person: 2, zh: "读" }, "читают": { lemma: "читать", person: 3, zh: "读" },
  "пишу": { lemma: "писать", person: 1, zh: "写" }, "пишешь": { lemma: "писать", person: 2, zh: "写" }, "пишет": { lemma: "писать", person: 3, zh: "写" }, "пишем": { lemma: "писать", person: 1, zh: "写" }, "пишете": { lemma: "писать", person: 2, zh: "写" }, "пишут": { lemma: "писать", person: 3, zh: "写" },
  "вижу": { lemma: "видеть", person: 1, zh: "看见" }, "видишь": { lemma: "видеть", person: 2, zh: "看见" }, "видит": { lemma: "видеть", person: 3, zh: "看见" }, "видим": { lemma: "видеть", person: 1, zh: "看见" }, "видите": { lemma: "видеть", person: 2, zh: "看见" }, "видят": { lemma: "видеть", person: 3, zh: "看见" },
  "понимаю": { lemma: "понимать", person: 1, zh: "明白" }, "понимаешь": { lemma: "понимать", person: 2, zh: "明白" }, "понимает": { lemma: "понимать", person: 3, zh: "明白" }, "понимаем": { lemma: "понимать", person: 1, zh: "明白" }, "понимаете": { lemma: "понимать", person: 2, zh: "明白" }, "понимают": { lemma: "понимать", person: 3, zh: "明白" },
  "слышу": { lemma: "слышать", person: 1, zh: "听见" }, "слышишь": { lemma: "слышать", person: 2, zh: "听见" }, "слышит": { lemma: "слышать", person: 3, zh: "听见" }, "слышим": { lemma: "слышать", person: 1, zh: "听见" }, "слышите": { lemma: "слышать", person: 2, zh: "听见" }, "слышат": { lemma: "слышать", person: 3, zh: "听见" },
  "иду": { lemma: "идти", person: 1, zh: "走" }, "идёшь": { lemma: "идти", person: 2, zh: "走" }, "идёт": { lemma: "идти", person: 3, zh: "走" }, "идём": { lemma: "идти", person: 1, zh: "走" }, "идёте": { lemma: "идти", person: 2, zh: "走" }, "идут": { lemma: "идти", person: 3, zh: "走" },
  "ем": { lemma: "есть", person: 1, zh: "吃" }, "ешь": { lemma: "есть", person: 2, zh: "吃" }, "ест": { lemma: "есть", person: 3, zh: "吃" }, "едим": { lemma: "есть", person: 1, zh: "吃" }, "едите": { lemma: "есть", person: 2, zh: "吃" }, "едят": { lemma: "есть", person: 3, zh: "吃" },
  "учу": { lemma: "учить", person: 1, zh: "学习" }, "учишь": { lemma: "учить", person: 2, zh: "学习" }, "учит": { lemma: "учить", person: 3, zh: "学习" }, "учим": { lemma: "учить", person: 1, zh: "学习" }, "учите": { lemma: "учить", person: 2, zh: "学习" }, "учат": { lemma: "учить", person: 3, zh: "学习" },
  "играю": { lemma: "играть", person: 1, zh: "玩" }, "играешь": { lemma: "играть", person: 2, zh: "玩" }, "играет": { lemma: "играть", person: 3, zh: "玩" }, "играем": { lemma: "играть", person: 1, zh: "玩" }, "играете": { lemma: "играть", person: 2, zh: "玩" }, "играют": { lemma: "играть", person: 3, zh: "玩" },
  "смотрю": { lemma: "смотреть", person: 1, zh: "看" }, "смотришь": { lemma: "смотреть", person: 2, zh: "看" }, "смотрит": { lemma: "смотреть", person: 3, zh: "看" }, "смотрим": { lemma: "смотреть", person: 1, zh: "看" }, "смотрите": { lemma: "смотреть", person: 2, zh: "看" }, "смотрят": { lemma: "смотреть", person: 3, zh: "看" },
  "слушаю": { lemma: "слушать", person: 1, zh: "听" }, "слушаешь": { lemma: "слушать", person: 2, zh: "听" }, "слушает": { lemma: "слушать", person: 3, zh: "听" }, "слушаем": { lemma: "слушать", person: 1, zh: "听" }, "слушаете": { lemma: "слушать", person: 2, zh: "听" }, "слушают": { lemma: "слушать", person: 3, zh: "听" },
  "пью": { lemma: "пить", person: 1, zh: "喝" }, "пьёшь": { lemma: "пить", person: 2, zh: "喝" }, "пьёт": { lemma: "пить", person: 3, zh: "喝" }, "пьём": { lemma: "пить", person: 1, zh: "喝" }, "пьёте": { lemma: "пить", person: 2, zh: "喝" }, "пьют": { lemma: "пить", person: 3, zh: "喝" },
  "сплю": { lemma: "спать", person: 1, zh: "睡觉" }, "спишь": { lemma: "спать", person: 2, zh: "睡觉" }, "спит": { lemma: "спать", person: 3, zh: "睡觉" }, "спим": { lemma: "спать", person: 1, zh: "睡觉" }, "спите": { lemma: "спать", person: 2, zh: "睡觉" }, "спят": { lemma: "спать", person: 3, zh: "睡觉" },
  "зову": { lemma: "звать", person: 1, zh: "叫/称呼" }, "зовёшь": { lemma: "звать", person: 2, zh: "叫/称呼" }, "зовёт": { lemma: "звать", person: 3, zh: "叫/称呼" }, "зовём": { lemma: "звать", person: 1, zh: "叫/称呼" }, "зовёте": { lemma: "звать", person: 2, zh: "叫/称呼" }, "зовут": { lemma: "звать", person: 3, zh: "叫/称呼" },
  "дам": { lemma: "дать", person: 1, zh: "给" }, "дашь": { lemma: "дать", person: 2, zh: "给" }, "даст": { lemma: "дать", person: 3, zh: "给" }, "дадим": { lemma: "дать", person: 1, zh: "给" }, "дадите": { lemma: "дать", person: 2, zh: "给" }, "дадут": { lemma: "дать", person: 3, zh: "给" },
  "ест": { lemma: "есть", person: 3, zh: "吃" }, "едят": { lemma: "есть", person: 3, zh: "吃" },
  "встаю": { lemma: "вставать", person: 1, zh: "起床" }, "встаёт": { lemma: "вставать", person: 3, zh: "起床" }, "встают": { lemma: "вставать", person: 3, zh: "起床" },
  "завтракаю": { lemma: "завтракать", person: 1, zh: "吃早饭" }, "завтракает": { lemma: "завтракать", person: 3, zh: "吃早饭" }, "завтракают": { lemma: "завтракать", person: 3, zh: "吃早饭" },
  "обедаю": { lemma: "обедать", person: 1, zh: "吃午饭" }, "обедает": { lemma: "обедать", person: 3, zh: "吃午饭" }, "обедают": { lemma: "обедать", person: 3, zh: "吃午饭" },
  "ужинаю": { lemma: "ужинать", person: 1, zh: "吃晚饭" }, "ужинает": { lemma: "ужинать", person: 3, zh: "吃晚饭" }, "ужинают": { lemma: "ужинать", person: 3, zh: "吃晚饭" },
  "отдыхаю": { lemma: "отдыхать", person: 1, zh: "休息" }, "отдыхает": { lemma: "отдыхать", person: 3, zh: "休息" }, "отдыхают": { lemma: "отдыхать", person: 3, zh: "休息" },
  "гуляю": { lemma: "гулять", person: 1, zh: "散步" }, "гуляет": { lemma: "гулять", person: 3, zh: "散步" }, "гуляют": { lemma: "гулять", person: 3, zh: "散步" },
  "звоню": { lemma: "звонить", person: 1, zh: "打电话" }, "звонит": { lemma: "звонить", person: 3, zh: "打电话" }, "звонят": { lemma: "звонить", person: 3, zh: "打电话" },
  "письмо": { lemma: "писать", person: 1, zh: "写" },
  "плаваю": { lemma: "плавать", person: 1, zh: "游泳" }, "плавает": { lemma: "плавать", person: 3, zh: "游泳" }, "плавают": { lemma: "плавать", person: 3, zh: "游泳" },
  "катаюсь": { lemma: "кататься", person: 1, zh: "滑冰/骑车" }, "катается": { lemma: "кататься", person: 3, zh: "滑冰/骑车" }, "катаются": { lemma: "кататься", person: 3, zh: "滑冰/骑车" },
  "рисую": { lemma: "рисовать", person: 1, zh: "画画" }, "рисует": { lemma: "рисовать", person: 3, zh: "画画" }, "рисуют": { lemma: "рисовать", person: 3, zh: "画画" },
  "пою": { lemma: "петь", person: 1, zh: "唱歌" }, "поёт": { lemma: "петь", person: 3, zh: "唱歌" }, "поют": { lemma: "петь", person: 3, zh: "唱歌" },
  "танцую": { lemma: "танцевать", person: 1, zh: "跳舞" }, "танцует": { lemma: "танцевать", person: 3, zh: "跳舞" }, "танцуют": { lemma: "танцевать", person: 3, zh: "跳舞" },
  "играю": { lemma: "играть", person: 1, zh: "玩" }, "играет": { lemma: "играть", person: 3, zh: "玩" }, "играют": { lemma: "играть", person: 3, zh: "玩" },
  "учу": { lemma: "учить", person: 1, zh: "学习" }, "учит": { lemma: "учить", person: 3, zh: "学习" }, "учат": { lemma: "учить", person: 3, zh: "学习" },
  "говорю": { lemma: "говорить", person: 1, zh: "说" }, "говорит": { lemma: "говорить", person: 3, zh: "说" }, "говорят": { lemma: "говорить", person: 3, zh: "说" },
  "смотрю": { lemma: "смотреть", person: 1, zh: "看" }, "смотрит": { lemma: "смотреть", person: 3, zh: "看" }, "смотрят": { lemma: "смотреть", person: 3, zh: "看" },
  "слушаю": { lemma: "слушать", person: 1, zh: "听" }, "слушает": { lemma: "слушать", person: 3, zh: "听" }, "слушают": { lemma: "слушать", person: 3, zh: "听" },
  "читаю": { lemma: "читать", person: 1, zh: "读" }, "читает": { lemma: "читать", person: 3, zh: "读" }, "читают": { lemma: "читать", person: 3, zh: "读" },
  "пишу": { lemma: "писать", person: 1, zh: "写" }, "пишет": { lemma: "писать", person: 3, zh: "写" }, "пишут": { lemma: "писать", person: 3, zh: "写" },
  "ем": { lemma: "есть", person: 1, zh: "吃" }, "ешь": { lemma: "есть", person: 2, zh: "吃" }, "едим": { lemma: "есть", person: 1, zh: "吃" }, "едите": { lemma: "есть", person: 2, zh: "吃" },
  "пью": { lemma: "пить", person: 1, zh: "喝" }, "пьёт": { lemma: "пить", person: 3, zh: "喝" }, "пьют": { lemma: "пить", person: 3, zh: "喝" },
  "сплю": { lemma: "спать", person: 1, zh: "睡觉" }, "спит": { lemma: "спать", person: 3, zh: "睡觉" }, "спят": { lemma: "спать", person: 3, zh: "睡觉" },
  "живу": { lemma: "жить", person: 1, zh: "住" }, "живёт": { lemma: "жить", person: 3, zh: "住" }, "живут": { lemma: "жить", person: 3, zh: "住" },
  "работаю": { lemma: "работать", person: 1, zh: "工作" }, "работает": { lemma: "работать", person: 3, zh: "工作" }, "работают": { lemma: "работать", person: 3, zh: "工作" },
  "хочу": { lemma: "хотеть", person: 1, zh: "想要" }, "хочет": { lemma: "хотеть", person: 3, zh: "想要" }, "хотят": { lemma: "хотеть", person: 3, zh: "想要" },
  "могу": { lemma: "мочь", person: 1, zh: "能够" }, "может": { lemma: "мочь", person: 3, zh: "能够" }, "могут": { lemma: "мочь", person: 3, zh: "能够" },
  "знаю": { lemma: "знать", person: 1, zh: "知道" }, "знает": { lemma: "знать", person: 3, zh: "知道" }, "знают": { lemma: "знать", person: 3, zh: "知道" },
  "делаю": { lemma: "делать", person: 1, zh: "做" }, "делает": { lemma: "делать", person: 3, zh: "做" }, "делают": { lemma: "делать", person: 3, zh: "做" },
  "иду": { lemma: "идти", person: 1, zh: "走" }, "идёт": { lemma: "идти", person: 3, zh: "走" }, "идут": { lemma: "идти", person: 3, zh: "走" },
  "вижу": { lemma: "видеть", person: 1, zh: "看见" }, "видит": { lemma: "видеть", person: 3, zh: "看见" }, "видят": { lemma: "видеть", person: 3, zh: "看见" },
  "понимаю": { lemma: "понимать", person: 1, zh: "明白" }, "понимает": { lemma: "понимать", person: 3, zh: "明白" }, "понимают": { lemma: "понимать", person: 3, zh: "明白" },
  "слышу": { lemma: "слышать", person: 1, zh: "听见" }, "слышит": { lemma: "слышать", person: 3, zh: "听见" }, "слышат": { lemma: "слышать", person: 3, zh: "听见" },
  "люблю": { lemma: "любить", person: 1, zh: "爱" }, "любит": { lemma: "любить", person: 3, zh: "爱" }, "любят": { lemma: "любить", person: 3, zh: "爱" },
  "жду": { lemma: "ждать", person: 1, zh: "等" }, "ждёт": { lemma: "ждать", person: 3, zh: "等" }, "ждут": { lemma: "ждать", person: 3, zh: "等" },
  "беру": { lemma: "брать", person: 1, zh: "拿" }, "берёт": { lemma: "брать", person: 3, zh: "拿" }, "берут": { lemma: "брать", person: 3, zh: "拿" },
  "даю": { lemma: "давать", person: 1, zh: "给" }, "даёт": { lemma: "давать", person: 3, zh: "给" }, "дают": { lemma: "давать", person: 3, zh: "给" },
  "получаю": { lemma: "получать", person: 1, zh: "收到" }, "получает": { lemma: "получать", person: 3, zh: "收到" }, "получают": { lemma: "получать", person: 3, zh: "收到" },
  "отправляю": { lemma: "отправлять", person: 1, zh: "发送" }, "отправляет": { lemma: "отправлять", person: 3, zh: "发送" }, "отправляют": { lemma: "отправлять", person: 3, zh: "发送" },
  "покупаю": { lemma: "покупать", person: 1, zh: "买" }, "покупает": { lemma: "покупать", person: 3, zh: "买" }, "покупают": { lemma: "покупать", person: 3, zh: "买" },
  "продаю": { lemma: "продавать", person: 1, zh: "卖" }, "продаёт": { lemma: "продавать", person: 3, zh: "卖" }, "продают": { lemma: "продавать", person: 3, zh: "卖" },
  "называю": { lemma: "называть", person: 1, zh: "称呼" }, "называет": { lemma: "называть", person: 3, zh: "称呼" }, "называют": { lemma: "называть", person: 3, zh: "称呼" },
  "начинаю": { lemma: "начинать", person: 1, zh: "开始" }, "начинает": { lemma: "начинать", person: 3, zh: "开始" }, "начинают": { lemma: "начинать", person: 3, zh: "开始" },
  "кончаю": { lemma: "кончать", person: 1, zh: "结束" }, "кончает": { lemma: "кончать", person: 3, zh: "结束" }, "кончают": { lemma: "кончать", person: 3, zh: "结束" },
  "работаю": { lemma: "работать", person: 1, zh: "工作" }, "работает": { lemma: "работать", person: 3, zh: "工作" }, "работают": { lemma: "работать", person: 3, zh: "工作" },
  "путешествую": { lemma: "путешествовать", person: 1, zh: "旅行" }, "путешествует": { lemma: "путешествовать", person: 3, zh: "旅行" }, "путешествуют": { lemma: "путешествовать", person: 3, zh: "旅行" },
  "мечтаю": { lemma: "мечтать", person: 1, zh: "梦想" }, "мечтает": { lemma: "мечтать", person: 3, zh: "梦想" }, "мечтают": { lemma: "мечтать", person: 3, zh: "梦想" },
  "планирую": { lemma: "планировать", person: 1, zh: "计划" }, "планирует": { lemma: "планировать", person: 3, zh: "计划" }, "планируют": { lemma: "планировать", person: 3, zh: "计划" },
  "решю": { lemma: "решать", person: 1, zh: "决定" }, "решает": { lemma: "решать", person: 3, zh: "决定" }, "решают": { lemma: "решать", person: 3, zh: "决定" },
  "думаю": { lemma: "думать", person: 1, zh: "想" }, "думает": { lemma: "думать", person: 3, zh: "想" }, "думают": { lemma: "думать", person: 3, zh: "想" },
  "знаю": { lemma: "знать", person: 1, zh: "知道" }, "знает": { lemma: "знать", person: 3, zh: "知道" }, "знают": { lemma: "знать", person: 3, zh: "知道" },
  "верю": { lemma: "верить", person: 1, zh: "相信" }, "верит": { lemma: "верить", person: 3, zh: "相信" }, "верят": { lemma: "верить", person: 3, zh: "相信" },
  "надеюсь": { lemma: "надеяться", person: 1, zh: "希望" }, "надеется": { lemma: "надеяться", person: 3, zh: "希望" }, "надеются": { lemma: "надеяться", person: 3, zh: "希望" },
  "боюсь": { lemma: "бояться", person: 1, zh: "害怕" }, "боится": { lemma: "бояться", person: 3, zh: "害怕" }, "боятся": { lemma: "бояться", person: 3, zh: "害怕" },
  "радуюсь": { lemma: "радоваться", person: 1, zh: "高兴" }, "радуется": { lemma: "радоваться", person: 3, zh: "高兴" }, "радуются": { lemma: "радоваться", person: 3, zh: "高兴" },
  "огорчаюсь": { lemma: "огорчаться", person: 1, zh: "难过" }, "огорчается": { lemma: "огорчаться", person: 3, zh: "难过" }, "огорчаются": { lemma: "огорчаться", person: 3, zh: "难过" },
  "удивляюсь": { lemma: "удивляться", person: 1, zh: "惊讶" }, "удивляется": { lemma: "удивляться", person: 3, zh: "惊讶" }, "удивляются": { lemma: "удивляться", person: 3, zh: "惊讶" },
  "интересуюсь": { lemma: "интересоваться", person: 1, zh: "感兴趣" }, "интересуется": { lemma: "интересоваться", person: 3, zh: "感兴趣" }, "интересуются": { lemma: "интересоваться", person: 3, zh: "感兴趣" },
  "занимаюсь": { lemma: "заниматься", person: 1, zh: "从事" }, "занимается": { lemma: "заниматься", person: 3, zh: "从事" }, "занимаются": { lemma: "заниматься", person: 3, zh: "从事" },
  "увлекаюсь": { lemma: "увлекаться", person: 1, zh: "喜欢" }, "увлекается": { lemma: "увлекаться", person: 3, zh: "喜欢" }, "увлекаются": { lemma: "увлекаться", person: 3, zh: "喜欢" },
  "надеваю": { lemma: "надевать", person: 1, zh: "穿" }, "надевает": { lemma: "надевать", person: 3, zh: "穿" }, "надевают": { lemma: "надевать", person: 3, zh: "穿" },
  "снимаю": { lemma: "снимать", person: 1, zh: "脱" }, "снимает": { lemma: "снимать", person: 3, zh: "脱" }, "снимают": { lemma: "снимать", person: 3, zh: "脱" },
  "мою": { lemma: "мыть", person: 1, zh: "洗" }, "моет": { lemma: "мыть", person: 3, zh: "洗" }, "моют": { lemma: "мыть", person: 3, zh: "洗" },
  "чищу": { lemma: "чистить", person: 1, zh: "打扫" }, "чистит": { lemma: "чистить", person: 3, zh: "打扫" }, "чистят": { lemma: "чистить", person: 3, zh: "打扫" },
  "готовлю": { lemma: "готовить", person: 1, zh: "做饭" }, "готовит": { lemma: "готовить", person: 3, zh: "做饭" }, "готовят": { lemma: "готовить", person: 3, zh: "做饭" },
  "стираю": { lemma: "стирать", person: 1, zh: "洗" }, "стирает": { lemma: "стирать", person: 3, zh: "洗" }, "стирают": { lemma: "стирать", person: 3, zh: "洗" },
  "глажу": { lemma: "гладить", person: 1, zh: "熨" }, "гладит": { lemma: "гладить", person: 3, zh: "熨" }, "гладят": { lemma: "гладить", person: 3, zh: "熨" },
  "убираю": { lemma: "убирать", person: 1, zh: "收拾" }, "убирает": { lemma: "убирать", person: 3, zh: "收拾" }, "убирают": { lemma: "убирать", person: 3, zh: "收拾" },
  "выметаю": { lemma: "выметать", person: 1, zh: "扫" }, "выметает": { lemma: "выметать", person: 3, zh: "扫" }, "вymетают": { lemma: "выметать", person: 3, zh: "扫" },
  "поливаю": { lemma: "поливать", person: 1, zh: "浇" }, "поливает": { lemma: "поливать", person: 3, zh: "浇" }, "поливают": { lemma: "поливать", person: 3, zh: "浇" },
  "поливаю": { lemma: "полить", person: 1, zh: "浇" }, "поливает": { lemma: "полить", person: 3, zh: "浇" }, "поливают": { lemma: "полить", person: 3, zh: "浇" },
  "кормлю": { lemma: "кормить", person: 1, zh: "喂" }, "кормит": { lemma: "кормить", person: 3, zh: "喂" }, "кормят": { lemma: "кормить", person: 3, zh: "喂" },
  "гуляю": { lemma: "гулять", person: 1, zh: "散步" }, "гуляет": { lemma: "гулять", person: 3, zh: "散步" }, "гуляют": { lemma: "гулять", person: 3, zh: "散步" },
  "играю": { lemma: "играть", person: 1, zh: "玩" }, "играет": { lemma: "играть", person: 3, zh: "玩" }, "играют": { lemma: "играть", person: 3, zh: "玩" },
  "смотрю": { lemma: "смотреть", person: 1, zh: "看" }, "смотрит": { lemma: "смотреть", person: 3, zh: "看" }, "смотрят": { lemma: "смотреть", person: 3, zh: "看" },
  "слушаю": { lemma: "слушать", person: 1, zh: "听" }, "слушает": { lemma: "слушать", person: 3, zh: "听" }, "слушают": { lemma: "слушать", person: 3, zh: "听" },
  "читаю": { lemma: "читать", person: 1, zh: "读" }, "читает": { lemma: "читать", person: 3, zh: "读" }, "читают": { lemma: "читать", person: 3, zh: "读" },
  "пишу": { lemma: "писать", person: 1, zh: "写" }, "пишет": { lemma: "писать", person: 3, zh: "写" }, "пишут": { lemma: "писать", person: 3, zh: "写" },
  "ем": { lemma: "есть", person: 1, zh: "吃" }, "ешь": { lemma: "есть", person: 2, zh: "吃" }, "едим": { lemma: "есть", person: 1, zh: "吃" }, "едите": { lemma: "есть", person: 2, zh: "吃" },
  "пью": { lemma: "пить", person: 1, zh: "喝" }, "пьёт": { lemma: "пить", person: 3, zh: "喝" }, "пьют": { lemma: "пить", person: 3, zh: "喝" },
  "сплю": { lemma: "спать", person: 1, zh: "睡觉" }, "спит": { lemma: "спать", person: 3, zh: "睡觉" }, "спят": { lemma: "спать", person: 3, zh: "睡觉" },
  "живу": { lemma: "жить", person: 1, zh: "住" }, "живёт": { lemma: "жить", person: 3, zh: "住" }, "живут": { lemma: "жить", person: 3, zh: "住" },
  "работаю": { lemma: "работать", person: 1, zh: "工作" }, "работает": { lemma: "работать", person: 3, zh: "工作" }, "работают": { lemma: "работать", person: 3, zh: "工作" },
  "хочу": { lemma: "хотеть", person: 1, zh: "想要" }, "хочет": { lemma: "хотеть", person: 3, zh: "想要" }, "хотят": { lemma: "хотеть", person: 3, zh: "想要" },
  "могу": { lemma: "мочь", person: 1, zh: "能够" }, "может": { lemma: "мочь", person: 3, zh: "能够" }, "могут": { lemma: "мочь", person: 3, zh: "能够" },
  "знаю": { lemma: "знать", person: 1, zh: "知道" }, "знает": { lemma: "знать", person: 3, zh: "知道" }, "знают": { lemma: "знать", person: 3, zh: "知道" },
  "делаю": { lemma: "делать", person: 1, zh: "做" }, "делает": { lemma: "делать", person: 3, zh: "做" }, "делают": { lemma: "делать", person: 3, zh: "做" },
  "иду": { lemma: "идти", person: 1, zh: "走" }, "идёт": { lemma: "идти", person: 3, zh: "走" }, "идут": { lemma: "идти", person: 3, zh: "走" },
  "вижу": { lemma: "видеть", person: 1, zh: "看见" }, "видит": { lemma: "видеть", person: 3, zh: "看见" }, "видят": { lemma: "видеть", person: 3, zh: "看见" },
  "понимаю": { lemma: "понимать", person: 1, zh: "明白" }, "понимает": { lemma: "понимать", person: 3, zh: "明白" }, "понимают": { lemma: "понимать", person: 3, zh: "明白" },
  "слышу": { lemma: "слышать", person: 1, zh: "听见" }, "слышит": { lemma: "слышать", person: 3, zh: "听见" }, "слышат": { lemma: "слышать", person: 3, zh: "听见" },
  "люблю": { lemma: "любить", person: 1, zh: "爱" }, "любит": { lemma: "любить", person: 3, zh: "爱" }, "любят": { lemma: "любить", person: 3, zh: "爱" },
  "жду": { lemma: "ждать", person: 1, zh: "等" }, "ждёт": { lemma: "ждать", person: 3, zh: "等" }, "ждут": { lemma: "ждать", person: 3, zh: "等" },
  "беру": { lemma: "брать", person: 1, zh: "拿" }, "берёт": { lemma: "брать", person: 3, zh: "拿" }, "берут": { lemma: "брать", person: 3, zh: "拿" },
  "даю": { lemma: "давать", person: 1, zh: "给" }, "даёт": { lemma: "давать", person: 3, zh: "给" }, "дают": { lemma: "давать", person: 3, zh: "给" },
  "получаю": { lemma: "получать", person: 1, zh: "收到" }, "получает": { lemma: "получать", person: 3, zh: "收到" }, "получают": { lemma: "получать", person: 3, zh: "收到" },
  "отправляю": { lemma: "отправлять", person: 1, zh: "发送" }, "отправляет": { lemma: "отправлять", person: 3, zh: "发送" }, "отправляют": { lemma: "отправлять", person: 3, zh: "发送" },
  "покупаю": { lemma: "покупать", person: 1, zh: "买" }, "покупает": { lemma: "покупать", person: 3, zh: "买" }, "покупают": { lemma: "покупать", person: 3, zh: "买" },
  "продаю": { lemma: "продавать", person: 1, zh: "卖" }, "продаёт": { lemma: "продавать", person: 3, zh: "卖" }, "продают": { lemma: "продавать", person: 3, zh: "卖" },
  "называю": { lemma: "называть", person: 1, zh: "称呼" }, "называет": { lemma: "называть", person: 3, zh: "称呼" }, "называют": { lemma: "называть", person: 3, zh: "称呼" },
  "начинаю": { lemma: "начинать", person: 1, zh: "开始" }, "начинает": { lemma: "начинать", person: 3, zh: "开始" }, "начинают": { lemma: "начинать", person: 3, zh: "开始" },
  "кончаю": { lemma: "кончать", person: 1, zh: "结束" }, "кончает": { lemma: "кончать", person: 3, zh: "结束" }, "кончают": { lemma: "кончать", person: 3, zh: "结束" },
  "путешествую": { lemma: "путешествовать", person: 1, zh: "旅行" }, "путешествует": { lemma: "путешествовать", person: 3, zh: "旅行" }, "путешествуют": { lemma: "путешествовать", person: 3, zh: "旅行" },
  "мечтаю": { lemma: "мечтать", person: 1, zh: "梦想" }, "мечтает": { lemma: "мечтать", person: 3, zh: "梦想" }, "мечтают": { lemma: "мечтать", person: 3, zh: "梦想" },
  "планирую": { lemma: "планировать", person: 1, zh: "计划" }, "планирует": { lemma: "планировать", person: 3, zh: "计划" }, "планируют": { lemma: "планировать", person: 3, zh: "计划" },
  "решаю": { lemma: "решать", person: 1, zh: "决定" }, "решает": { lemma: "решать", person: 3, zh: "决定" }, "решают": { lemma: "решать", person: 3, zh: "决定" },
  "думаю": { lemma: "думать", person: 1, zh: "想" }, "думает": { lemma: "думать", person: 3, zh: "想" }, "думают": { lemma: "думать", person: 3, zh: "想" },
  "верю": { lemma: "верить", person: 1, zh: "相信" }, "верит": { lemma: "верить", person: 3, zh: "相信" }, "верят": { lemma: "верить", person: 3, zh: "相信" },
  "надеюсь": { lemma: "надеяться", person: 1, zh: "希望" }, "надеется": { lemma: "надеяться", person: 3, zh: "希望" }, "надеются": { lemma: "надеяться", person: 3, zh: "希望" },
  "боюсь": { lemma: "бояться", person: 1, zh: "害怕" }, "боится": { lemma: "бояться", person: 3, zh: "害怕" }, "боятся": { lemma: "бояться", person: 3, zh: "害怕" },
  "радуюсь": { lemma: "радоваться", person: 1, zh: "高兴" }, "радуется": { lemma: "радоваться", person: 3, zh: "高兴" }, "радуются": { lemma: "радоваться", person: 3, zh: "高兴" },
  "огорчаюсь": { lemma: "огорчаться", person: 1, zh: "难过" }, "огорчается": { lemma: "огорчаться", person: 3, zh: "难过" }, "огорчаются": { lemma: "огорчаться", person: 3, zh: "难过" },
  "удивляюсь": { lemma: "удивляться", person: 1, zh: "惊讶" }, "удивляется": { lemma: "удивляться", person: 3, zh: "惊讶" }, "удивляются": { lemma: "удивляться", person: 3, zh: "惊讶" },
  "интересуюсь": { lemma: "интересоваться", person: 1, zh: "感兴趣" }, "интересуется": { lemma: "интересоваться", person: 3, zh: "感兴趣" }, "интересуются": { lemma: "интересоваться", person: 3, zh: "感兴趣" },
  "занимаюсь": { lemma: "заниматься", person: 1, zh: "从事" }, "занимается": { lemma: "заниматься", person: 3, zh: "从事" }, "занимаются": { lemma: "заниматься", person: 3, zh: "从事" },
  "увлекаюсь": { lemma: "увлекаться", person: 1, zh: "喜欢" }, "увлекается": { lemma: "увлекаться", person: 3, zh: "喜欢" }, "увлекаются": { lemma: "увлекаться", person: 3, zh: "喜欢" },
  "надеваю": { lemma: "надевать", person: 1, zh: "穿" }, "надевает": { lemma: "надевать", person: 3, zh: "穿" }, "надевают": { lemma: "надевать", person: 3, zh: "穿" },
  "снимаю": { lemma: "снимать", person: 1, zh: "脱" }, "снимает": { lemma: "снимать", person: 3, zh: "脱" }, "снимают": { lemma: "снимать", person: 3, zh: "脱" },
  "мою": { lemma: "мыть", person: 1, zh: "洗" }, "моет": { lemma: "мыть", person: 3, zh: "洗" }, "моют": { lemma: "мыть", person: 3, zh: "洗" },
  "чищу": { lemma: "чистить", person: 1, zh: "打扫" }, "чистит": { lemma: "чистить", person: 3, zh: "打扫" }, "чистят": { lemma: "чистить", person: 3, zh: "打扫" },
  "готовлю": { lemma: "готовить", person: 1, zh: "做饭" }, "готовит": { lemma: "готовить", person: 3, zh: "做饭" }, "готовят": { lemma: "готовить", person: 3, zh: "做饭" },
  "стираю": { lemma: "стирать", person: 1, zh: "洗" }, "стирает": { lemma: "стирать", person: 3, zh: "洗" }, "стирают": { lemma: "стирать", person: 3, zh: "洗" },
  "глажу": { lemma: "гладить", person: 1, zh: "熨" }, "гладит": { lemma: "гладить", person: 3, zh: "熨" }, "гладят": { lemma: "гладить", person: 3, zh: "熨" },
  "убираю": { lemma: "убирать", person: 1, zh: "收拾" }, "убирает": { lemma: "убирать", person: 3, zh: "收拾" }, "убирают": { lemma: "убирать", person: 3, zh: "收拾" },
  "выметаю": { lemma: "выметать", person: 1, zh: "扫" }, "вymетает": { lemma: "выметать", person: 3, zh: "扫" }, "выметают": { lemma: "выметать", person: 3, zh: "扫" },
  "поливаю": { lemma: "поливать", person: 1, zh: "浇" }, "поливает": { lemma: "поливать", person: 3, zh: "浇" }, "поливают": { lemma: "поливать", person: 3, zh: "浇" },
  "кормлю": { lemma: "кормить", person: 1, zh: "喂" }, "кормит": { lemma: "кормить", person: 3, zh: "喂" }, "кормят": { lemma: "кормить", person: 3, zh: "喂" },
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

/** 释义优选表：词典（БКРС）第一义项与现代常用译法不一致时，用推荐译名覆盖。
 *  例如 преподаватель 在词典里第一义项是"教员"（旧式称呼），现代俄语教材常用"教师"。
 *  可随时追加更多词条（按原形 lemma 匹配，变形词自动命中）。 */
const ZH_PREFER = {
  "преподаватель": "教师",
  "переводить": "翻译",
  "перевести": "翻译",
};

/** БКРС（dict-zh）词条清洗：只保留第一个义项的中文，去词性标记/拼音/义项序号/残留标点。
 *  dict-zh 词条格式示例："м, преподавательница ж教员 jiàoyuán, 教师 jiàoshī"
 *  → 去开头词性标记 → 取第一个逗号前义项 → 去拼音 → "教员" */
function firstMeaning(t) {
  if (!t) return t;
  let s = String(t);
  // 1) 去开头词性/性标记（西里尔字母 + 符号，直到第一个非西里尔字符为止）
  s = s.replace(/^[\u0400-\u04FF\u0301\s,，.。;；:：/\\()[\]{}<>+\-=*#@]+/g, "");
  // 2) 取第一个义项：逗号/顿号/分号/竖线/换行（БКРС 义项以逗号分隔）
  s = s.split(/[,，、;；\n|]/)[0];
  // 3) 去数字/罗马数字义项序号（"1. 献给"、"I. 教师"）
  s = s.replace(/^(?:[IVX]{1,4}|[①②③④⑤⑥⑦⑧⑨⑩]|\d{1,2})[\.\、)）]?\s*/g, "");
  // 4) 去拼音（拉丁字母，含带声调/变音符号的扩展拉丁区）
  s = s.replace(/[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]+/g, "");
  // 5) 去残留西里尔字母（防止词性标记混在释义中）
  s = s.replace(/[\u0400-\u04FF]+/g, "");
  // 6) 压缩空白 + 去首尾标点
  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/^[\s,，.。;；:：、\-—–]+|[\s,，.。;；:：、\-—–]+$/g, "").trim();
  return s;
}

/** 中文释义查询链：词形直查 → 原形查询（БКРС 含变形词，先直查词形再查原形）；
 *  返回统一清洗后的单一核心义项（去词性标记/拼音/多余义项），词卡框与词卡直接显示 */
export function zhOf(form, lemma) {
  const D = (typeof window !== "undefined" && window.RU_DICT_ZH) || {};
  const n = normForm(form);
  const l = normForm(lemma);
  // 释义优选：词典第一义项与现代常用译法不一致时优先用推荐译名（如 преподаватель → 教师）
  const prefer = ZH_PREFER[l] || ZH_PREFER[n];
  if (prefer) return prefer;
  return firstMeaning(D[n] || (l && l !== n ? D[l] : "") || "");
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
// 同形变格消歧优先级：词形 → 首选 lemma（dict-full 遍历时多个词的同形变格互相覆盖，
// 按常用义优先。如 банке 同时是 банк（银行）与 банка（罐子）的第六格，默认取银行）
const DISAMBIG = {
  "банке": "банк",
  // парке 同时是 парк（公园）与 парка（派克大衣）的前置格，教学语料常用"公园"，优先公园
  "парке": "парк",
};

// 带消歧的索引写入：非首选 lemma 遇到该词形已被占时跳过，首选可覆盖
// 同形多格位：主格（nom）优先——俄语阳性无生命名词/形容词主格=宾格（город/большой），
// 若按 nom→acc 顺序写入则后写的 acc 覆盖 nom，导致主格名词被判宾格（表语误判宾语）。
function setIdx(idx, form, entry) {
  const nf = normForm(form);
  const pref = DISAMBIG[nf];
  if (pref && pref !== entry.lemma && idx.has(nf)) return;
  const prev = idx.get(nf);
  if (prev && prev.caseCode === "nom" && entry.caseCode !== "nom") return; // 同形多格位：主格优先
  idx.set(nf, entry);
}

// 词典释义显示清理：去罗马数字/义项序号/学科标记/拼音注音残留（"[-tou]"、"[-]"），保留拼音正文
// 注意：JS \b 不识别西里尔字母，学科/词性标记不用 \b（西里尔单字母 м/ж/с 不会出现在拼音与中文中）
function cleanZhText(t) {
  if (!t) return t;
  return String(t)
    .replace(/\[-[^\]]*\]/g, "")                        // 拼音注音残留 "[-tou]" 与分隔符污染 "[-]"
    .replace(/[IVX]{1,4}[мжс]?/g, "；")                 // 罗马数字义项 + 附着的词性字母（I1. IIж）
    .replace(/(?:союз|сущ|прил|нар|числ|мест|предл|част|межд|глаг|мед|физ|астр|юр|хим|тех|разг|книжн|прост|г|м|ж|с|ср)\.?/g, "；") // 词性/学科/语域标记
    .replace(/\d+\.+\s*/g, "")                          // 义项序号 "1." "2.."
    .replace(/\s*[；;]\s*/g, "；")                      // 压缩分号及周围空白
    .replace(/[；;]{2,}/g, "；")
    .replace(/^[；;，,、\s]+|[；;，,、\s]+$/g, "")
    .trim();
}

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
          if (form) setIdx(idx, form, {
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
          if (form) setIdx(idx, form, {
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
        if (form) setIdx(idx, form, {
          lemma, pos: "verb",
          person: pi + 1, tense: "present",
          stressed: toStress(form),
          chinese: zh,
        });
      });
      (f.past || []).forEach((form, ki) => {
        if (form) setIdx(idx, form, {
          lemma, pos: "verb", tense: "past",
          gender: ki === 0 ? "masculine" : ki === 1 ? "feminine" : ki === 2 ? "neuter" : "",
          number: ki === 3 ? "plural" : "singular",
          stressed: toStress(form),
          chinese: zh,
        });
      });
    } else {
      // p === "o"：其它词（代词/副词/数词等），先入原形，稍后用简版词典细化词性
      setIdx(idx, lemma, {
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
  // 全角标点先转半角（"Нет，это" → "Нет, это"），否则逗号在词中间无法从词中拆出
  const srcSentence = String(sentence || "")
    .replace(/[，。！？；：]/g, (m) => (
      { "，": ",", "。": ".", "！": "!", "？": "?", "；": ";", "：": ":" }[m] || m
    ))
    .replace(/[\u00ad\u200b-\u200f\u2060-\u2064\u206a-\u206f\ufeff]+/g, "")
    .replace(/[\u00a0\u3000\u2009\u2028\u2029\u202f\u205f\t\r\n\f\v]+/g, " ")
    // 词中标点补空格："Нет，это"（全角逗号转半角后无空格）→ "Нет, это"，逗号独立成标点槽
    .replace(/([\u0410-\u044f\u0401\u0451a-zA-Z])([,.;:!?…])(?=[\u0410-\u044f\u0401\u0451a-zA-Z])/g, "$1$2 ");
  // 词卡按纯俄语词标注：token 去首尾标点（半角/全角），逗号/句号由 AnswerPanel 的 punct 单独显示
  const tokens = srcSentence.split(/\s+/).filter(Boolean)
    .filter((t) => !/^[—–-]+$/.test(t))
    .map((t) => t.replace(/^[\s.,!?;:…—–，。！？；：、'"()\[\]{}-]+|[\s.,!?;:…—–，。！？；：、'"()\[\]{}-]+$/g, ""))
    .filter(Boolean);

  // 兜底查询：FUNCTION_WORDS + VERB_FORMS（dict-full pos 为空/"default" 时也走这里补全）
  const lookupFallback = (n) => {
    const fw = FUNCTION_WORDS[n];
    if (fw) {
      return {
        form: cleanToken(w_global), lemma: n, pos: fw.pos,
        posColor: getPosColor(fw.pos),
        chinese: cleanZhText(fw.zh) || "",
        roleLabel: "",
      };
    }
    const vf = VERB_FORMS[n];
    if (vf) {
      return {
        form: cleanToken(w_global), lemma: vf.lemma, pos: "verb",
        posColor: getPosColor("verb"),
        chinese: cleanZhText(vf.zh) || "",
        roleLabel: "",
        person: vf.person,
        tense: "present",
      };
    }
    return null;
  };

  return tokens.map((w, i) => {
    const n = normForm(w);
    const w_global = w; // 供 lookupFallback 使用

    // 阿拉伯数字（"5 часов" 等）→ 数词
    if (/^\d+$/.test(w_global)) {
      return {
        form: w_global, lemma: w_global, pos: "numeral",
        posColor: getPosColor("numeral"),
        chinese: w_global, roleLabel: "",
      };
    }

    // FUNCTION_WORDS 优先：人工维护的高频虚词表（介词/连词/语气词/疑问副词）比 dict-full 更准确
    // 如 где 被 dict-full 标为代词，但实际是疑问副词 → 用 FUNCTION_WORDS 覆盖
    const fw = FUNCTION_WORDS[n];
    if (fw) {
      return {
        form: cleanToken(w), lemma: n, pos: fw.pos,
        posColor: getPosColor(fw.pos),
        gender: fw.gender || "",
        grammarCase: fw.grammarCase || "",
        number: fw.number || "",
        chinese: cleanZhText(fw.zh) || "",
        roleLabel: "",
      };
    }

    const hit = idx.get(n);
    // 简版词典原形优先：RU_DICT（教学高频词）收录的原形词，词性/释义权威。
    // 防 dict-full 变格表同形误占（如 большой 被其它阴性形容词的前置格形式占用 → 错标 前置格/阴性），
    // 变格词形（большого 等）RU_DICT 无 → 仍走 dict-full。
    const base0 = RU_DICT[n];
    if (base0) {
      const pos0 = ruPosToEn(base0.p);
      return {
        form: cleanToken(w), lemma: n, pos: pos0,
        posColor: getPosColor(pos0),
        gender: ruGender(base0.p),
        chinese: cleanZhText(base0.z || zhOf(n, n)) || "",
        roleLabel: "",
      };
    }
    // dict-full 命中且 pos 有值（非空非"default"）→ 直接用
    if (hit && hit.pos && hit.pos !== "default") {
      return {
        form: hit.stressed || w,
        lemma: hit.lemma || n,
        pos: hit.pos,
        posColor: getPosColor(hit.pos),
        gender: hit.gender || "",
        grammarCase: hit.caseCode || "",
        number: hit.number || "",
        chinese: cleanZhText(hit.chinese || zhOf(n, hit.lemma)) || "",
        roleLabel: "",
        person: hit.person || "",
        tense: hit.tense || "",
      };
    }
    // dict-full 命中但 pos 为空/"default"（如 p="o" 词条无词性）→ 查 VERB_FORMS 兜底
    if (hit) {
      const vf = VERB_FORMS[n];
      if (vf) {
        return {
          form: cleanToken(w), lemma: vf.lemma, pos: "verb",
          posColor: getPosColor("verb"),
          chinese: cleanZhText(vf.zh) || "",
          roleLabel: "",
          person: vf.person,
          tense: "present",
        };
      }
      // 兜底表也没命中 → 用 hit 原始数据（pos 留空）
      return {
        form: hit.stressed || w,
        lemma: hit.lemma || n,
        pos: hit.pos || "",
        posColor: hit.pos ? getPosColor(hit.pos) : "",
        gender: hit.gender || "",
        grammarCase: hit.caseCode || "",
        number: hit.number || "",
        chinese: cleanZhText(hit.chinese || zhOf(n, hit.lemma)) || "",
        roleLabel: "",
        person: hit.person || "",
        tense: hit.tense || "",
      };
    }
    // dict-full 未命中 → 简版词典原形
    const base = RU_DICT[n];
    if (base) {
      const pos = ruPosToEn(base.p);
      return {
        form: cleanToken(w), lemma: n, pos,
        posColor: getPosColor(pos),
        gender: ruGender(base.p),
        chinese: cleanZhText(base.z || zhOf(n, n)) || "",
        roleLabel: "",
      };
    }
    // 兜底：高频动词变位表（dict-full 未命中时也查）
    const vf = VERB_FORMS[n];
    if (vf) {
      return {
        form: cleanToken(w), lemma: vf.lemma, pos: "verb",
        posColor: getPosColor("verb"),
        chinese: cleanZhText(vf.zh) || "",
        roleLabel: "",
        person: vf.person,
        tense: "present",
      };
    }
    // 兜底：高频虚词表（dict-full 未命中时也查）
    const fw2 = FUNCTION_WORDS[n];
    if (fw2) {
      return {
        form: cleanToken(w), lemma: n, pos: fw2.pos,
        posColor: getPosColor(fw2.pos),
        gender: fw2.gender || "",
        grammarCase: fw2.grammarCase || "",
        number: fw2.number || "",
        chinese: cleanZhText(fw2.zh) || "",
        roleLabel: "",
      };
    }
    // 兜底：句中大写开头（非句首）→ 专有名词（人名/地名等变格形式，如 "у Виктора"），
    // 保证词性/成分可判；句首大写多为普通名词（走词典），不在此兜底
    if (i > 0 && /^[А-ЯЁA-Z]/.test(w_global)) {
      return {
        form: cleanToken(w), lemma: n, pos: "noun",
        posColor: getPosColor("noun"),
        chinese: cleanZhText(zhOf(n, n)) || "",
        roleLabel: "",
      };
    }
    return { form: cleanToken(w), lemma: n, pos: "", posColor: "", chinese: cleanZhText(zhOf(n, n)) || "", roleLabel: "" };
  });
}
