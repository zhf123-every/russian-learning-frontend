/**
 * test_ru_numbers.mjs —— 数字 → 俄语数词转换单测
 * 覆盖：0~999999 整数转换、句子文本替换、词槽与判题集成（复用 test_fixed_slot 的状态机逻辑）
 */
import { numToRu, ruNumbersInText } from "./src/lib/ruNumbers.js";

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log("  ✓ " + name); }
  else { fail++; console.log("  ✗ " + name + (detail !== undefined ? "  → " + detail : "")); }
}

// ---- [1] 整数 → 俄语数词 ----
const cases = [
  [0, "ноль"], [1, "один"], [5, "пять"], [10, "десять"], [19, "девятнадцать"],
  [21, "двадцать один"], [55, "пятьдесят пять"], [99, "девяносто девять"],
  [100, "сто"], [101, "сто один"], [129, "сто двадцать девять"],
  [1000, "одна тысяча"], [2000, "две тысячи"], [5000, "пять тысяч"],
  [55555, "пятьдесят пять тысяч пятьсот пятьдесят пять"],
  [999999, "девятьсот девяносто девять тысяч девятьсот девяносто девять"],
];
console.log("[1] numToRu 整数转换");
for (const [n, expect] of cases) {
  const got = numToRu(n);
  check(`${n} → ${expect}`, got === expect, `got ${got}`);
}
check("超范围 1000000 → null", numToRu(1000000) === null);
check("负数 → null", numToRu(-1) === null);
check("小数 → null", numToRu(5.5) === null);

// ---- [2] 句子文本替换 ----
console.log("[2] ruNumbersInText 句子替换");
check("雨伞 55 卢布", ruNumbersInText("Этот зонт стоит 55 рублей.") === "Этот зонт стоит пятьдесят пять рублей.",
  ruNumbersInText("Этот зонт стоит 55 рублей."));
check("无数字不变", ruNumbersInText("Я люблю тебя.") === "Я люблю тебя.");
check("多个数字", ruNumbersInText("Мне 25 лет, ему 30.") === "Мне двадцать пять лет, ему тридцать.");
check("超范围保留", ruNumbersInText("1000000 рублей") === "1000000 рублей");

// ---- [3] 词槽与判题集成（模拟 useQuestionInput 核心逻辑）----
console.log("[3] 词槽与判题集成（55 → пятьдесят пять 可正常输入判对）");
const answerText = ruNumbersInText("Этот зонт стоит 55 рублей."); // 转换后整句

// 简单状态机（与 test_fixed_slot 一致）
const WORD_REGEX = /[a-zA-Z0-9а-яА-ЯёЁ]/;
const isWord = (t) => WORD_REGEX.test(t);
const stripPunct = (s) => s.replace(/^[.,!?;:…'"()\[\]{}\-–—]+|[.,!?;:…'"()\[\]{}\-–—]+$/g, "");
const norm = (s) => stripPunct(String(s || "").toLowerCase());
function makeWords(answerText) {
  const words = [];
  let id = 0;
  String(answerText).split(" ").forEach((text) => {
    if (isWord(text)) {
      const clean = String(text).replace(/^[^А-Яа-яЁё]+|[^А-Яа-яЁё-]+$/g, "");
      const isFirstRealWord = words.length === 0;
      const heuristicName = !isFirstRealWord && !/[.!?…]["'"»)]*$/.test(words[words.length - 1]?.text || "") && /^[А-ЯЁ]/.test(clean);
      words.push({ id: id++, text, userInput: heuristicName ? text : "", fixed: heuristicName, incorrect: false, isActive: false, start: 0, end: 0 });
    }
  });
  if (words.length > 0) words[0].isActive = true;
  return words;
}
function syncFromInput(words, value, cursorPos) {
  const newWords = words.map((w) => ({ ...w }));
  const inputParts = String(value).trim().split(/\s+/).filter(Boolean);
  let partIdx = 0;
  let position = 0;
  for (const w of newWords) {
    w.userInput = "";
    w.start = position;
    if (w.fixed) {
      w.userInput = w.text;
      position += w.userInput.length + 1;
      continue;
    }
    if (partIdx < inputParts.length) {
      const part = inputParts[partIdx];
      const fixedIdx = newWords.findIndex((x) => x.fixed && norm(x.text) === norm(part));
      if (fixedIdx >= 0) {
        newWords[fixedIdx].userInput = part; // 消费 fixed 匹配词
        partIdx++;
        w.userInput = partIdx < inputParts.length ? inputParts[partIdx] : "";
      } else {
        w.userInput = part;
      }
      partIdx++;
    }
    w.end = position + w.userInput.length;
    position += w.userInput.length + 1;
  }
  if (cursorPos !== undefined) {
    let found = false;
    for (const w of newWords) {
      if (!w.fixed && cursorPos >= w.start && cursorPos <= w.end) { w.isActive = true; found = true; break; }
    }
    if (!found) newWords[newWords.length - 1].isActive = true;
  }
  return newWords;
}
function judge(input, answerText, words) {
  const answerWords = String(answerText).split(" ").filter(isWord).map(norm).filter(Boolean);
  const inputWords = String(input).trim().split(/\s+/).map(norm).filter(Boolean);
  const userWordsFiltered = [];
  for (const w of words) {
    if (w.fixed) continue;
    const matched = inputWords.find((x) => norm(x) === norm(w.text));
    if (matched) userWordsFiltered.push(norm(matched));
  }
  const expected = answerWords.filter((x) => !words.some((w) => w.fixed && norm(w.text) === x));
  const sameLen = userWordsFiltered.length === expected.length && expected.length > 0;
  const sameSet = sameLen && expected.every((x) => userWordsFiltered.includes(x));
  return { ok: sameSet, reason: `user=${userWordsFiltered.join(",")} expected=${expected.join(",")}` };
}

const w = makeWords(answerText);
check("词槽数 = 6（Этот зонт стоит пятьдесят пять рублей）", w.length === 6, `got ${w.length} → ${w.map(x => x.text).join("|")}`);
check("数字词槽为 пятьдесят", w[3].text === "пятьдесят", w[3].text);
check("数字词槽为 пять", w[4].text === "пять", w[4].text);
// 完整输入
const synced = syncFromInput(w, "Этот зонт стоит пятьдесят пять рублей", 32);
check("词槽全部落位", synced.every((x) => norm(x.userInput) === norm(x.text)), synced.map(x=>x.userInput).join("|"));
check("判题正确", judge("Этот зонт стоит пятьдесят пять рублей", answerText, synced).ok, judge("Этот зонт стоит пятьдесят пять рублей", answerText, synced).reason);
// 忽略大小写判对
check("小写输入判对", judge("этот зонт стоит пятьдесят пять рублей", answerText, synced).ok, judge("этот зонт стоит пятьдесят пять рублей", answerText, synced).reason);
// 输入错误判错
check("错误输入判错", !judge("этот зонт стоит пять рублей", answerText, synced).ok, judge("этот зонт стоит пять рублей", answerText, synced).reason);

console.log("\n结果: PASS " + pass + " / FAIL " + fail);
process.exit(fail === 0 ? 0 : 1);
