// 单测：useQuestionInput 的 fixed 判定 + syncFromInput 修复 + 判题
// 直接抽取核心算法（与 src/hooks/useQuestionInput.js 一致）验证

const stripNonLetters = (s) => s.replace(/^[^А-Яа-яЁё]+|[^А-Яа-яЁё-]+$/g, "");
const stripPunct = (s) =>
  s.replace(/^[.,!?;:…'"()\[\]{}\-–—]+|[.,!?;:…'"()\[\]{}\-–—]+$/g, "");

const PLACE_STEMS = [
  "москв","росси","российск","кита","китайск","петербург","санкт-петербург","пекин","франци","француз","германи","немецк","итали","испани","англи","америк","европ","сибир","украин","белорус","казахстан","шанха","харбин","баку","байкал","волг","урал","кремл","дон","осак","токио","лондон","париж","берлин","рим","московск","чехов","гагарин","пушкин","чисты","икеа","мир","площад","проспект","улиц","переулк","набережн","вокзал","аэропорт","станц","музе","театр","университет","институт","компани","банк","завод","фабрик","магазин",
];
function isPlaceStem(s) {
  const e = String(s || "").toLowerCase().replace(/^[^а-яё]+|[^а-яё-]+$/g, "");
  return !e || e.length < 3 ? false : PLACE_STEMS.some((i) => e.startsWith(i) || e.endsWith(i));
}
const QUESTION_WORDS = new Set(["она","он","оно","они","мы","вы","я","ты","кто","что","где","когда","куда","почему","зачем","как"]);
const WORD_REGEX = /[a-zA-Z0-9а-яА-ЯёЁ]/;
const isWord = (t) => WORD_REGEX.test(t);

// 初始化（与 useEffect 一致）
function initWords(answerText, nameWords = [], ordinaryWords = []) {
  const nameWordsSet = new Set(nameWords.map((w) => String(w).trim().toLowerCase()));
  const ordinaryWordsSet = new Set(ordinaryWords.map((w) => String(w).trim().toLowerCase()));
  const words = [];
  let id = 0;
  let newSentence = false;
  answerText.split(" ").forEach((text) => {
    if (isWord(text)) {
      const word = { id: id++, text, userInput: "", incorrect: false, isActive: false, fixed: false, start: 0, end: 0 };
      const clean = stripNonLetters(text);
      const lower = clean.toLowerCase();
      const isFirstWord = words.length === 0;
      const nameHit = nameWordsSet.has(lower);
      const ordinaryHit = ordinaryWordsSet.has(lower);
      const placeHit = isPlaceStem(clean);
      const capStart = !placeHit && !QUESTION_WORDS.has(lower) && !isFirstWord && !newSentence && /^[А-ЯЁ]/.test(clean);
      word.fixed = (nameHit && !placeHit) || (!ordinaryHit && capStart);
      if (word.fixed) word.userInput = text;
      words.push(word);
    }
    if (/[.!?…]["'"»)]*$/.test(text)) newSentence = true;
    else if (isWord(text) || /[А-Яа-яЁё]/.test(text)) newSentence = false;
  });
  if (words.length > 0) words[0].isActive = true;
  return words;
}

// syncFromInput（修复版：fixed 词消费匹配输入）
function syncFromInput(words, value, cursorPos) {
  const newWords = words.map((w) => ({ ...w, isActive: false }));
  let position = 0;
  const parts = value.split(" ");
  let inputIndex = 0;
  newWords.forEach((word) => {
    if (word.fixed) {
      const nextInput = parts[inputIndex] || "";
      if (nextInput && stripPunct(nextInput).toLowerCase() === stripPunct(word.text).toLowerCase()) {
        inputIndex++;
      }
      word.userInput = word.text;
    } else {
      const input = parts[inputIndex] || "";
      inputIndex++;
      word.userInput = input;
    }
    word.start = position;
    word.end = position + word.userInput.length;
    position += word.userInput.length + 1;
    if (cursorPos !== undefined && cursorPos >= word.start && cursorPos <= word.end) {
      word.isActive = true;
    }
  });
  if (cursorPos !== undefined && !newWords.some((w) => w.isActive)) {
    const lastEditable = [...newWords].reverse().find((w) => !w.fixed);
    if (lastEditable) lastEditable.isActive = true;
  }
  return newWords;
}

// submitAnswer 判题（去 fixed 词 + 顺序比对）
function judge(inputValue, answerText, words, ignoreCase = true) {
  const norm = (s) => (ignoreCase ? s.toLowerCase() : s);
  const userWords = inputValue.trim().split(/\s+/).filter(Boolean).map(stripPunct).map(norm).filter(Boolean);
  const answerWords = (answerText || "").trim().split(/\s+/).filter(Boolean).map(stripPunct).map(norm).filter(Boolean);
  const fixedWords = new Set(words.filter((w) => w.fixed).map((w) => norm(stripPunct(w.text))));
  const answerNonFixed = answerWords.filter((w) => !fixedWords.has(w));
  const userNonFixed = userWords.filter((w) => !fixedWords.has(w));
  if (userNonFixed.length !== answerNonFixed.length) return { ok: false, reason: "词数不同" };
  if (userNonFixed.every((w, i) => w === answerNonFixed[i])) return { ok: true, reason: "顺序一致" };
  return { ok: false, reason: "顺序不同" };
}

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log("  ✓", name); }
  else { fail++; console.log("  ✗", name, "→", detail); }
}

// ===== 用例 =====
console.log("[1] 初始化 fixed 判定 — Где Анна? Она дома.");
const w1 = initWords("Где Анна? Она дома.");
check("4 个词槽", w1.length === 4, JSON.stringify(w1.map(w => w.text)));
check("Где 不固定", !w1[0].fixed);
check("Анна? 固定(自动填充)", w1[1].fixed === true && w1[1].userInput === "Анна?");
check("Она 不固定(代词集)", !w1[2].fixed);
check("дома. 不固定", !w1[3].fixed);

console.log("[2] syncFromInput 修复 — 完整输入 где анна? она дома");
let s1 = syncFromInput(w1, "где анна? она дома", 18);
check("词槽1=где", s1[0].userInput === "где", s1.map(w=>w.userInput).join("|"));
check("词槽2=Анна?(消费掉анна?)", s1[1].userInput === "Анна?", s1.map(w=>w.userInput).join("|"));
check("词槽3=она", s1[2].userInput === "она", s1.map(w=>w.userInput).join("|"));
check("词槽4=дома", s1[3].userInput === "дома", s1.map(w=>w.userInput).join("|"));
check("无重复人名", new Set(s1.map(w=>w.userInput.toLowerCase().replace(/[?.,]/g,""))).size === 4, s1.map(w=>w.userInput).join("|"));
check("判题正确", judge("где анна? она дома", "Где Анна? Она дома.", w1).ok, judge("где анна? она дома", "Где Анна? Она дома.", w1).reason);

console.log("[3] syncFromInput — 省略名字只打 3 词 где она дома");
let s2 = syncFromInput(w1, "где она дома", 13);
check("词槽1=где", s2[0].userInput === "где", s2.map(w=>w.userInput).join("|"));
check("词槽2=Анна?(自动补)", s2[1].userInput === "Анна?", s2.map(w=>w.userInput).join("|"));
check("词槽3=она", s2[2].userInput === "она", s2.map(w=>w.userInput).join("|"));
check("词槽4=дома", s2[3].userInput === "дома", s2.map(w=>w.userInput).join("|"));
check("判题正确(省略名)", judge("где она дома", "Где Анна? Она дома.", w1).ok, judge("где она дома", "Где Анна? Она дома.", w1).reason);

console.log("[4] 打字过程：输入 где анна? она д 时（最后一词未打完）");
let s3 = syncFromInput(w1, "где анна? она д", 15);
check("词槽不错位", s3.map(w=>w.userInput).join("|") === "где|Анна?|она|д", s3.map(w=>w.userInput).join("|"));

console.log("[5] 回归 — 常规句 Я люблю тебя（无大写专名，全部手输）");
const w5 = initWords("Я люблю тебя");
check("3 词槽", w5.length === 3);
check("Я 句首不固定", !w5[0].fixed);
check("люблю 不固定", !w5[1].fixed);
check("тебя 不固定", !w5[2].fixed);
check("判题", judge("я люблю тебя", "Я люблю тебя", w5).ok);

console.log("[6] 回归 — 地名不自动填充 Это Москва");
const w6 = initWords("Это Москва");
check("Москва 地名不固定", !w6[1].fixed, "fixed=" + w6[1].fixed);

console.log("[7] 回归 — Она дома.（Она 代词集，句尾标点后）");
const w7 = initWords("Она дома.");
check("Она 不固定", !w7[0].fixed);

console.log("[8] 回归 — 多句 Меня зовут Анна. Я из Китая.");
const w8 = initWords("Меня зовут Анна. Я из Китая.");
check("6 词槽", w8.length === 6, w8.map(w=>w.text).join("|"));
check("Анна. 固定", w8[2].fixed === true, "fixed=" + w8[2].fixed);
check("句首 Я(标点后) 不固定", !w8[3].fixed);
check("Китая. 地名不固定", !w8[4].fixed);
check("判题: меня зовут анна я из китая", judge("меня зовут анна я из китая", "Меня зовут Анна. Я из Китая.", w8).ok);

console.log("[9] 判题 — 词数不同仍判错");
check("缺词判错", !judge("где она", "Где Анна? Она дома.", w1).ok);
check("多词判错", !judge("где анна? она дома дома", "Где Анна? Она дома.", w1).ok);

console.log("[10] 空格跳词 — 填完 где 按空格 → 跳到 она（跳过 fixed Анна?）");
function spaceJump(words) {
  const activeIdx = words.findIndex((w) => w.isActive);
  let nextIdx = -1;
  for (let i = activeIdx + 1; i < words.length; i++) {
    if (!words[i].fixed) { nextIdx = i; break; }
  }
  if (nextIdx >= 0) {
    const joined = words.map((w) => w.userInput).join(" ");
    const synced = syncFromInput(words, joined, words[nextIdx].start);
    synced.forEach((w, i) => { w.isActive = i === nextIdx; });
    return { words: synced, joined };
  }
  return { words, joined: null };
}
// где 填上，光标在 где（初始 active 是 где）
let w10 = w1.map(w => ({ ...w }));
w10[0].userInput = "где";
const j1 = spaceJump(w10);
check("跳词后 она 激活", j1.words[2].isActive === true && j1.words[0].isActive === false,
  j1.words.map(w => (w.isActive ? "ACTIVE:" : "") + w.text).join("|"));
check("跳词后输入框为 где Анна?（词间空格）", j1.joined === "где Анна?  ", "[" + j1.joined + "]");
// она 填上再跳
let w10b = j1.words.map(w => ({ ...w }));
w10b[2].userInput = "она";
const j2 = spaceJump(w10b);
check("再跳词 → дома 激活", j2.words[3].isActive === true && j2.words[2].isActive === false,
  j2.words.map(w => (w.isActive ? "ACTIVE:" : "") + w.text).join("|"));
// 跳词后打 дома
let w10c = j2.words.map(w => ({ ...w }));
const afterDoma = syncFromInput(w10c, "где Анна? она дома", 18);
check("跳词后输入 дома 成功", afterDoma[3].userInput === "дома", afterDoma.map(w=>w.userInput).join("|"));
check("最终判题正确", judge("где Анна? она дома", "Где Анна? Она дома.", afterDoma).ok, judge("где Анна? она дома", "Где Анна? Она дома.", afterDoma).reason);

console.log("\n结果: PASS " + pass + " / FAIL " + fail);
process.exit(fail === 0 ? 0 : 1);
