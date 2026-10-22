/**
 * ruNumbers.js —— 阿拉伯数字 → 俄语数词
 *
 * 背景：课程句子里的价格/数量常写作阿拉伯数字（"Этот зонт стоит 55 рублей."），
 * 答题页要求用户以俄语形式输入数词（пятьдесят пять），且 TTS 朗读俄语形式。
 * 因此在数据适配层把句子中的整数统一转为俄语数词，词槽/判题/朗读自然一致。
 *
 * 支持范围：0 ~ 999999（整数）。超范围或带小数/分隔符的数字保持原样，避免误转。
 */

const ONES = ["ноль", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const TEENS = [
  "десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать",
  "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать",
];
const TENS = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
const HUNDREDS = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];

/** 两位数（1..99）→ 俄语；0 返回空串 */
function twoDigits(n) {
  if (n <= 0) return "";
  if (n < 10) return ONES[n];
  if (n < 20) return TEENS[n - 10];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return o > 0 ? TENS[t] + " " + ONES[o] : TENS[t];
}

/** 三位数（1..999）→ 俄语；0 返回空串 */
function threeDigits(n) {
  if (n <= 0) return "";
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h === 0) return twoDigits(rest);
  const s = HUNDREDS[h];
  const r = twoDigits(rest);
  return r ? s + " " + r : s;
}

/** 整数（0..999999）→ 俄语数词；超范围/非整数返回 null */
export function numToRu(n) {
  if (!Number.isInteger(n) || n < 0 || n >= 1000000) return null;
  if (n === 0) return "ноль";
  const th = Math.floor(n / 1000);
  const rest = n % 1000;
  let parts = [];
  if (th > 0) {
    // 千位性数格：одна тысяча / две·три·четыре тысячи / пять+ тысяч
    if (th === 1) parts.push("одна тысяча");
    else if (th === 2) parts.push("две тысячи");
    else if (th === 3) parts.push("три тысячи");
    else if (th === 4) parts.push("четыре тысячи");
    else parts.push(threeDigits(th) + " тысяч");
  }
  const r = threeDigits(rest);
  if (r) parts.push(r);
  return parts.join(" ");
}

/** 句子文本中所有整数（\d+）→ 俄语数词；超范围/异常保留原样 */
export function ruNumbersInText(text) {
  return String(text || "").replace(/\d+/g, (m) => {
    const n = parseInt(m, 10);
    if (!Number.isInteger(n) || n < 0 || n >= 1000000) return m;
    const ru = numToRu(n);
    return ru || m;
  });
}
