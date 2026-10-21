/**
 * useQuestionInput —— 连词成句输入状态机（React Hook 版）
 *
 * 三态流转：Input → Fix → Fix_Input
 *  - Input：正常输入，Enter 提交判题
 *  - Fix：展示错误词（整词标红），按任意键进入 Fix_Input
 *  - Fix_Input：逐词修正，空格跳下一个错词，Backspace 回退上一个错词
 *
 * 核心数据结构 userInputWords：
 *  [{ id, text, userInput, incorrect, isActive, start, end }]
 *
 * 与句乐部 Vue 版的对应关系：
 *  - Vue reactive → React useState
 *  - Vue ref → React useRef
 *  - Vue watchEffect → React useEffect
 *  - Vue 普通函数 → React useCallback
 */

import { useState, useRef, useCallback, useEffect, useMemo } from "react";

// ============================================================
// 常量
// ============================================================

export const MODES = {
  INPUT: "input",
  FIX: "fix",
  FIX_INPUT: "fix-input",
};

// 俄语字母也视为单词字符（句乐部只判断英数，俄语版需要加上西里尔字母）
const WORD_REGEX = /[a-zA-Z0-9а-яА-ЯёЁ]/;

function isWord(text) {
  return WORD_REGEX.test(text);
}

function createWord(text, id) {
  return {
    id,
    text,            // 标准答案的词（如 "люблю"）
    userInput: "",   // 用户输入的这个词
    incorrect: false, // 是否错误（提交后标记）
    isActive: false,  // 当前光标是否在这个词上（紫色高亮）
    fixed: false,     // 已给词（人名/专有名词直接显示，不用打）
    start: 0,         // 该词在输入框字符串中的起始位置
    end: 0,           // 结束位置
  };
}

// 判断是否为人名/专有名词（启发式：非句首、非分句句首、首字母大写）
// 说明：只认首字母大写会把句中被误大写的普通词（如 "Здравствуйте! Разрешите…"）也当名字。
// 判定分三层（初始化 useEffect 中执行）：
//   1) nameWords（词典词性=人名）→ 权威：直接显示
//   2) ordinaryWords（词典标注为普通词性）→ 反证：即使大写也正常输入
//   3) 启发式兜底：非句首真词 + 非分句句首 + 首字母大写 + 非地名词干（真名通常词典未收录）
function isProperNoun(text) {
  const clean = String(text || "").replace(/^[^А-Яа-яЁё]+|[^А-Яа-яЁё-]+$/g, "");
  if (!clean) return false;
  return /^[А-ЯЁ]/.test(clean);
}

// 常见俄语地名/机构专有名词词干（国家、城市、街道、景点等，含常见变格）
// 这类词首字母大写但不是人名，不应被当作「人名直接显示」跳过输入
const PLACE_STEMS = [
  'москв', 'росси', 'российск', 'кита', 'китайск', 'петербург', 'санкт-петербург',
  'пекин', 'франци', 'француз', 'германи', 'немецк', 'итали', 'испани', 'англи',
  'америк', 'европ', 'сибир', 'украин', 'белорус', 'казахстан', 'шанха', 'харбин',
  'баку', 'байкал', 'волг', 'урал', 'кремл', 'дон', 'осак', 'токио', 'лондон',
  'париж', 'берлин', 'рим', 'московск', 'чехов', 'гагарин', 'пушкин', 'чисты', 'икеа',
  'мир', 'площад', 'проспект', 'улиц', 'переулк', 'набережн', 'вокзал', 'аэропорт',
  'станц', 'музе', 'театр', 'университет', 'институт', 'компани', 'банк', 'завод',
  'фабрик', 'магазин'
];
function isPlaceStem(text) {
  const lower = String(text || "").toLowerCase().replace(/^[^а-яё]+|[^а-яё-]+$/g, "");
  if (!lower || lower.length < 3) return false;
  return PLACE_STEMS.some((s) => lower.startsWith(s) || lower.endsWith(s));
}

// ============================================================
// Hook
// ============================================================

/**
 * @param {Object} options
 * @param {string} options.answerText     - 标准答案句子（如 "Я люблю тебя"）
 * @param {string} options.statementId    - 句子 ID，用于提交后端
 * @param {string} options.apiBaseUrl     - API 基础路径（默认 ''，即同源）
 * @param {React.RefObject} options.inputRef - input 元素的 ref
 * @param {Object} options.isComposingRef - 输入法组合状态 ref（来自 useKeyboardShortcuts）
 * @param {Function} options.onCorrect    - 答对回调
 * @param {Function} options.onWrong      - 答错回调
 */
export function useQuestionInput({
  answerText,
  statementId,
  apiBaseUrl = "",
  inputRef,
  isComposingRef,
  onCorrect,
  onWrong,
  ignoreCase = true,
  nameWords = [],        // 词典词性标注为「专有名词/人名」的词 → 直接显示（权威）
  ordinaryWords = [],    // 词典标注为普通词性的词 → 反证：大写也不算名字
}) {
  // ---- 状态 ----
  const [mode, setMode] = useState(MODES.INPUT);
  const [inputValue, setInputValue] = useState("");
  const [userInputWords, setUserInputWords] = useState([]);
  const [isJudging, setIsJudging] = useState(false); // 判题中状态，用于立即隐藏输入框

  // 当前正在修正的词 id（Fix_Input 模式下）
  const currentEditWordIdRef = useRef(null);

  // 名字词/普通词集合（小写比对；用 join 键做依赖，标注完成更新后触发重算）
  const nameSet = useMemo(
    () => new Set((nameWords || []).map((w) => String(w || "").trim().toLowerCase())),
    [nameWords]
  );
  const ordinarySet = useMemo(
    () => new Set((ordinaryWords || []).map((w) => String(w || "").trim().toLowerCase())),
    [ordinaryWords]
  );
  const nameWordsKey = (nameWords || []).join("|");
  const ordinaryWordsKey = (ordinaryWords || []).join("|");

  // ---- 四级反馈追踪（Good/Great/Perfect/Amazing）----
  const usedHintRef = useRef(false);        // 是否使用过提示（Ctrl+;）
  const enteredFixModeRef = useRef(false);  // 是否进入过 Fix 模式
  const questionStartTimeRef = useRef(Date.now()); // 本题开始时间

  /** 标记使用了提示（Ctrl+; 时调用） */
  const markHintUsed = useCallback(() => {
    usedHintRef.current = true;
  }, []);

  /** 计算本题的反馈类型 */
  const computeResultType = useCallback(() => {
    const elapsed = (Date.now() - questionStartTimeRef.current) / 1000;
    if (usedHintRef.current || elapsed > 30) return "good";
    if (enteredFixModeRef.current) return "great";
    return "perfect";
  }, []);

  // ==========================================================
  // 初始化：根据标准答案拆分单词
  // ==========================================================
  useEffect(() => {
    if (!answerText) return;
    const words = [];
    let id = 0;
    const tokens = String(answerText).split(" ");
    let prevEndsSentence = false; // 前一个 token 以句末标点（.!?…）结尾 → 当前大写词是新句首，不算名字
    tokens.forEach((text) => {
      const isWordTok = isWord(text);
      if (isWordTok) {
        const w = createWord(text, id++);
        // 三层判定：
        //   1) 词典词性权威：标注为专有名词/人名 → 直接显示
        //   2) 词典反证：标注为普通词性 → 即使首字母大写也正常输入
        //   3) 启发式兜底：非句首真词 + 非分句句首 + 首字母大写（真名通常词典未收录）
        const clean = String(text).replace(/^[^А-Яа-яЁё]+|[^А-Яа-яЁё-]+$/g, "");
        const isFirstRealWord = words.length === 0;
        const lower = clean.toLowerCase();
        const dictName = nameSet.has(lower);
        const knownOrdinary = ordinarySet.has(lower);
        // 地名/机构专有名词（国家、城市、街道、景点等）不是人名：即使大写也照常输入
        const isPlace = isPlaceStem(clean);
        // 常见大写代词（она/он/оно/они/мы/вы/я/ты）不是人名：即使大写开头也正常输入
        const PRONOUNS = new Set(["она", "он", "оно", "они", "мы", "вы", "я", "ты", "кто", "что", "где", "когда", "куда", "почему", "зачем", "как"]);
        const isPronoun = PRONOUNS.has(lower);
        const heuristicName = !isPlace && !isPronoun && !isFirstRealWord && !prevEndsSentence && /^[А-ЯЁ]/.test(clean);
        w.fixed = (dictName && !isPlace) || (!knownOrdinary && heuristicName);
        if (w.fixed) w.userInput = text; // 预设为正确文本
        words.push(w);
      }
      // 更新「是否新句首」：token 以句末标点结尾 → 下一个大写词是新句首（要打，不算名字）
      if (/[.!?…]["'"»)]*$/.test(text)) prevEndsSentence = true;
      else if (isWordTok || /[А-Яа-яЁё]/.test(text)) prevEndsSentence = false;
    });
    if (words.length > 0) words[0].isActive = true;
    setUserInputWords(words);
    setInputValue("");
    setMode(MODES.INPUT);
    currentEditWordIdRef.current = null;
  }, [answerText, nameWordsKey, ordinaryWordsKey]);

  // ==========================================================
  // 双向同步：输入框字符串 ↔ 单词数组
  // ==========================================================

  /**
   * 从输入框字符串同步到单词数组
   * 计算每个词的 userInput / start / end
   * 保留 incorrect 状态（提交标记的错误不因输入变化而重置）
   */
  const syncFromInput = useCallback((value, cursorPos) => {
    setUserInputWords((prevWords) => {
      const newWords = prevWords.map((w) => ({ ...w, isActive: false }));
      const parts = value.split(" ");
      let partIdx = 0;
      let position = 0;
      newWords.forEach((word) => {
        if (word.fixed) {
          // 已给人名：始终显示标准答案，不消耗用户输入的空格位
          word.userInput = word.text;
          word.start = position;
          word.end = position + word.text.length;
          position += word.text.length + 1;
        } else {
          const input = parts[partIdx] || "";
          partIdx++;
          word.userInput = input;
          word.start = position;
          word.end = position + input.length;
          position += input.length + 1;
          // 根据光标位置判断当前激活词（fixed 词不激活，光标应落在非 fixed 词上）
          if (cursorPos !== undefined && cursorPos >= word.start && cursorPos <= word.end && !word.fixed) {
            word.isActive = true;
          }
        }
      });
      // 如果光标没有命中任何可输入词（如落在人名/专有名词区间），
      // 优先激活「光标之后的第一个可输入词」，避免直接跳到最后一个空槽
      if (cursorPos !== undefined && !newWords.some(w => w.isActive) && newWords.length > 0) {
        const inputWords = newWords.filter(w => !w.fixed);
        if (inputWords.length > 0) {
          const next = inputWords.find(w => cursorPos <= w.end);
          (next || inputWords[inputWords.length - 1]).isActive = true;
        }
      }
      // 修复：光标位置超过最后一个词的 end 时，强制激活最后一个词
      // （解决"最后一个词打不出来"的问题——用户按空格后，光标在空格后面，
      //   但最后一个词的 end 是 15，光标位置是 16，没有命中）
      if (cursorPos !== undefined && newWords.length > 0) {
        const inputWords = newWords.filter(w => !w.fixed);
        if (inputWords.length > 0) {
          const last = inputWords[inputWords.length - 1];
          if (cursorPos > last.end) {
            last.isActive = true;
          }
        }
      }
      return newWords;
    });
  }, []);

  /**
   * 从单词数组同步到输入框字符串
   * Fix 模式清空某个词后调用
   */
  const syncFromWords = useCallback(() => {
    setUserInputWords((prevWords) => {
      const newValue = prevWords.map((w) => w.userInput).join(" ");
      setInputValue(newValue);
      return prevWords;
    });
  }, []);

  // ==========================================================
  // 光标与激活词
  // ==========================================================

  const getCursorPosition = useCallback(() => {
    return inputRef.current?.selectionStart ?? 0;
  }, [inputRef]);

  const setCursorPosition = useCallback((pos) => {
    if (inputRef.current) {
      // 直接设置，避免一帧延迟
      inputRef.current.setSelectionRange(pos, pos);
    }
  }, [inputRef]);

  /**
   * 根据光标位置更新当前激活词（紫色高亮）
   * 人名/专有名词（fixed）不参与激活：光标落在其区间时，激活其后的第一个可输入词
   */
  const updateActiveWord = useCallback((cursorPos) => {
    setUserInputWords((prevWords) => {
      const newWords = prevWords.map((w) => ({ ...w, isActive: false }));
      let hit = false;
      for (const word of newWords) {
        if (word.fixed) continue;
        if (cursorPos >= word.start && cursorPos <= word.end) {
          word.isActive = true;
          hit = true;
          break;
        }
      }
      if (!hit) {
        const inputWords = newWords.filter(w => !w.fixed);
        if (inputWords.length > 0) {
          const next = inputWords.find(w => cursorPos <= w.end);
          (next || inputWords[inputWords.length - 1]).isActive = true;
        }
      }
      return newWords;
    });
  }, []);

  // ==========================================================
  // onChange：用户输入
  // ==========================================================
  const handleChange = useCallback(
    (e) => {
      const value = e.target.value;
      const cursorPos = e.target.selectionStart ?? value.length;
      setInputValue(value);
      syncFromInput(value, cursorPos);
    },
    [syncFromInput]
  );

  // ==========================================================
  // 错词查找工具函数
  // ==========================================================

  const getFirstIncorrectWord = useCallback(() => {
    return userInputWords.find((w) => w.incorrect);
  }, [userInputWords]);

  /**
   * 从当前编辑词之后找下一个错误词
   */
  const findNextIncorrectWord = useCallback(() => {
    const currentId = currentEditWordIdRef.current;
    if (currentId === null) return null;
    const currentIndex = userInputWords.findIndex((w) => w.id === currentId);
    for (let i = currentIndex + 1; i < userInputWords.length; i++) {
      if (userInputWords[i].incorrect) return userInputWords[i];
    }
    return null;
  }, [userInputWords]);

  /**
   * 从当前编辑词之前找上一个错误词
   */
  const findPreviousIncorrectWord = useCallback(() => {
    const currentId = currentEditWordIdRef.current;
    if (currentId === null) return null;
    const currentIndex = userInputWords.findIndex((w) => w.id === currentId);
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (userInputWords[i].incorrect) return userInputWords[i];
    }
    return null;
  }, [userInputWords]);

  const isLastIncorrectWord = useCallback(() => {
    return !findNextIncorrectWord();
  }, [findNextIncorrectWord]);

  const isCurrentEditWordEmpty = useCallback(() => {
    const currentId = currentEditWordIdRef.current;
    if (currentId === null) return true;
    const word = userInputWords.find((w) => w.id === currentId);
    return !word || word.userInput.length <= 0;
  }, [userInputWords]);

  const lastWordIsActive = useCallback(() => {
    if (userInputWords.length === 0) return false;
    return userInputWords[userInputWords.length - 1].isActive;
  }, [userInputWords]);

  // ==========================================================
  // Fix 模式：定位并清空错误词
  // ==========================================================

  /**
   * 清空指定词的用户输入，设置为当前编辑词，同步到输入框，移动光标
   */
  const clearAndFocusWord = useCallback(
    (word) => {
      if (!word) return;
      currentEditWordIdRef.current = word.id;

      // 先计算新的单词数组和输入框值（不在 setState 回调中调用另一个 setState）
      let newCursorPos = 0;
      setUserInputWords((prevWords) => {
        const newWords = prevWords.map((w) => {
          if (w.id === word.id) {
            // 清空当前错词，清除 incorrect 标记，激活
            return { ...w, userInput: "", incorrect: false, isActive: true };
          }
          return { ...w, isActive: false };
        });

        // 重新计算 start/end
        let position = 0;
        newWords.forEach((w) => {
          w.start = position;
          w.end = position + w.userInput.length;
          position += w.userInput.length + 1;
        });

        // 记录当前词的新 start 位置，用于设置光标
        const targetWord = newWords.find((w) => w.id === word.id);
        if (targetWord) newCursorPos = targetWord.start;

        // 同步输入框值
        const newValue = newWords.map((w) => w.userInput).join(" ");
        setInputValue(newValue);

        return newWords;
      });

      // 光标移到该词起始位置
      setTimeout(() => setCursorPosition(newCursorPos), 0);
    },
    [setCursorPosition]
  );

  /**
   * Fix → Fix_Input：定位第一个错误词并清空
   */
  const fixFirstIncorrectWord = useCallback(() => {
    const first = getFirstIncorrectWord();
    if (first) {
      setMode(MODES.FIX_INPUT);
      clearAndFocusWord(first);
    }
  }, [getFirstIncorrectWord, clearAndFocusWord]);

  /**
   * Fix_Input：定位下一个错误词并清空
   */
  const fixNextIncorrectWord = useCallback(() => {
    const next = findNextIncorrectWord();
    if (next) {
      clearAndFocusWord(next);
    }
  }, [findNextIncorrectWord, clearAndFocusWord]);

  /**
   * 根据当前模式自动调用 fixFirst 或 fixNext
   */
  const fixIncorrectWord = useCallback(() => {
    if (mode === MODES.FIX) {
      fixFirstIncorrectWord();
    } else if (mode === MODES.FIX_INPUT) {
      fixNextIncorrectWord();
    }
  }, [mode, fixFirstIncorrectWord, fixNextIncorrectWord]);

  /**
   * Fix_Input：回退到上一个错误词
   */
  const activePreviousIncorrectWord = useCallback(() => {
    const prev = findPreviousIncorrectWord();
    if (prev) {
      currentEditWordIdRef.current = prev.id;
      setUserInputWords((prevWords) =>
        prevWords.map((w) => ({ ...w, isActive: w.id === prev.id }))
      );
      setCursorPosition(prev.end);
    }
  }, [findPreviousIncorrectWord, setCursorPosition]);

  // ==========================================================
  // 提交判题（调用后端 API）
  // ==========================================================

  /**
   * 调用后端 POST /api/answer/submit
   * 返回 { correct, errors, wordAnalysis, acceptedVariants }
   */
  const submitToBackend = useCallback(
    async (userInput) => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/answer/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ statementId, userInput }),
        });
        const json = await response.json();
        if (json.ok && json.data) return json.data;
        return null;
      } catch (e) {
        console.error("[useQuestionInput] 提交后端失败:", e);
        return null;
      }
    },
    [apiBaseUrl, statementId]
  );

  /**
   * 根据后端返回的 errors 标记错误词
   * 后端 errors[].wordIndex 对应用户输入词的位置索引
   * 「忽略大小写」开启时：纯大小写差异不标红（后端可能按严格大小写判题）
   */
  const markIncorrectFromErrors = useCallback((errors) => {
    setUserInputWords((prevWords) => {
      const stripPunct = (s) => s.replace(/^[.,!?;:…'"()\[\]{}\-–—]+|[.,!?;:…'"()\[\]{}\-–—]+$/g, '');
      const norm = (s) => (ignoreCase ? s.toLowerCase() : s);
      const ans = (answerText || "").trim().split(/\s+/).filter(Boolean).map(stripPunct).map(norm);
      const newWords = prevWords.map((w) => ({ ...w, incorrect: false }));
      (errors || []).forEach((err) => {
        if (err.wordIndex >= 0 && err.wordIndex < newWords.length) {
          const w = newWords[err.wordIndex];
          if (w.fixed) return;
          const uw = norm(stripPunct(w.userInput));
          const aw = ans[err.wordIndex];
          if (ignoreCase && uw && aw && uw === aw) return;
          w.incorrect = true;
        }
      });
      return newWords;
    });
  }, [answerText, ignoreCase]);

  /**
   * 提交答案
   * - Fix 模式下不提交（Enter 会被 handleKeyboardInput 拦截进入 Fix_Input）
   * - 调用后端判题，有错 → Fix 模式，无错 → 清空并回调 onCorrect
   */
  const submitAnswer = useCallback(async () => {
    if (mode === MODES.FIX) return;
    if (isJudging) return;

    // ===== 前端快速判题：词集合匹配（忽略语序），瞬间出结果 =====
    // 去掉词首尾的标点符号，避免 "друг." != "друг" 的误判
    // 「忽略大小写」设置：开→小写归一；关→严格大小写
    const stripPunct = (s) => s.replace(/^[.,!?;:…'"()\[\]{}\-–—]+|[.,!?;:…'"()\[\]{}\-–—]+$/g, '');
    const norm = (s) => (ignoreCase ? s.toLowerCase() : s);
    const userWords = inputValue.trim().split(/\s+/).filter(Boolean).map(stripPunct).map(norm).filter(Boolean);
    const allAnswerWords = (answerText || "").trim().split(/\s+/).filter(Boolean).map(stripPunct).map(norm).filter(Boolean);
    // 已给人名/专有名词：从标准答案和用户输入中都排除（用户多打了人名也不误判）
    const fixedSet = new Set(
      userInputWords.filter(w => w.fixed).map(w => norm(stripPunct(w.text)))
    );
    const answerWords = allAnswerWords.filter(w => !fixedSet.has(w));
    const userWordsFiltered = userWords.filter(w => !fixedSet.has(w));

    // 词数不同 → 立即判定错误（已给人名不算错）
    if (userWordsFiltered.length !== answerWords.length) {
      setUserInputWords((prevWords) => prevWords.map((w) => ({ ...w, incorrect: w.fixed ? false : true })));
      enteredFixModeRef.current = true;
      setMode(MODES.FIX);
      // 前端已判定错误 → 同步触发 onWrong（不依赖后端），后端返回仅补充精确错误词标注
      onWrong?.({ correct: false, errors: [], wordAnalysis: [] });
      submitToBackend(inputValue).then((result) => {
        if (result && result.errors) markIncorrectFromErrors(result.errors);
      });
      return;
    }

    // 词数相同 → 按顺序逐词比较（俄语词序虽灵活，但学习阶段应按标准答案顺序判定，让用户掌握正确语序）
    const seqMatch = userWordsFiltered.every((w, i) => w === answerWords[i]);

    if (seqMatch) {
      // 词集合匹配（包括灵活语序）→ 立即跳转正确答案页
      setMode(MODES.INPUT);
      setInputValue("");
      setUserInputWords((prevWords) => prevWords.map((w) => ({
        ...w,
        userInput: w.fixed ? w.text : "", // 已给人名保持显示，其余清空
        incorrect: false,
        isActive: false,
      })));
      currentEditWordIdRef.current = null;
      const resultType = computeResultType();
      onCorrect?.({ correct: true, errors: [], wordAnalysis: [] }, resultType);
      submitToBackend(inputValue).catch(() => {});
      return;
    }

    // 词数相同但词不匹配 → 立即标记错误（已给人名不标红）
    setUserInputWords((prevWords) => {
      const newWords = prevWords.map((w) => ({ ...w }));
      const answerSet = new Set(answerWords);
      newWords.forEach((w) => {
        if (w.fixed) { w.incorrect = false; return; }
        // 非 fixed 词按用户输入顺序比较
        const idx = newWords.filter(x => !x.fixed).findIndex(x => x.id === w.id);
        const userWord = userWordsFiltered[idx] || "";
        if (!answerSet.has(norm(userWord))) w.incorrect = true;
      });
      return newWords;
    });
    enteredFixModeRef.current = true;
    setMode(MODES.FIX);
    // 前端已判定错误 → 同步触发 onWrong（不依赖后端），后端返回仅补充精确错误词标注
    onWrong?.({ correct: false, errors: [], wordAnalysis: [] });
    submitToBackend(inputValue).then((result) => {
      if (result && result.errors) markIncorrectFromErrors(result.errors);
    });
  }, [mode, inputValue, answerText, isJudging, userInputWords, submitToBackend, markIncorrectFromErrors, onCorrect, onWrong, computeResultType, ignoreCase]);

  // ==========================================================
  // 键盘事件处理（绑定在 input 元素的 onKeyDown 上）
  //
  // 优先级（对应句乐部 handleKeyboardInput）：
  //  1. 方向键 → 禁止
  //  2. Input/Fix_Input + 空格 + 最后一个词激活 → 空格提交（如果开启）
  //  3. Fix 模式 + 任意键 → 进入 Fix_Input（定位第一个错词）
  //  4. Fix_Input + 空格 + 最后一个错词 → 空格提交
  //  5. Fix_Input + Backspace + 当前词为空 → 回退上一个错词
  //  6. 非 Input + 空格 → 修复下一个错词
  // ==========================================================
  const handleKeyboardInput = useCallback(
    (e) => {
      // 1. 禁止方向键移动光标
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)
      ) {
        e.preventDefault();
        return;
      }

      // 2. Input/Fix_Input 模式 + 空格 + 最后一个词激活 → 空格提交
      //    （空格提交开关由外部控制，这里预留 handleSpaceSubmit 回调）
      if (
        mode !== MODES.FIX &&
        e.code === "Space" &&
        lastWordIsActive()
      ) {
        // 空格提交逻辑由外部 onSpaceSubmit 决定是否启用
        // 如果启用，外部会调用 submitAnswer()
        // 这里只做事件拦截，防止空格输入到下一个词
        // e.preventDefault();  // 由外部决定是否阻止
      }

      // 3. Fix 模式：按任意键 → 定位第一个错误词并清空
      if (mode === MODES.FIX) {
        if (e.code === "Space" || e.code === "Backspace") {
          e.preventDefault();
        }
        fixFirstIncorrectWord();
        return;
      }

      // 4. Fix_Input + 空格 + 最后一个错词 → 提交
      if (
        mode === MODES.FIX_INPUT &&
        e.code === "Space" &&
        isLastIncorrectWord()
      ) {
        e.preventDefault();
        submitAnswer();
        return;
      }

      // 5. Fix_Input + Backspace + 当前编辑词为空 → 回退上一个错词
      if (
        mode === MODES.FIX_INPUT &&
        e.code === "Backspace" &&
        isCurrentEditWordEmpty()
      ) {
        e.preventDefault();
        activePreviousIncorrectWord();
        return;
      }

      // 6. 非 Input 模式 + 空格 → 修复下一个错词
      if (mode !== MODES.INPUT && e.code === "Space") {
        e.preventDefault();
        fixIncorrectWord();
        return;
      }
    },
    [
      mode,
      lastWordIsActive,
      fixFirstIncorrectWord,
      isLastIncorrectWord,
      submitAnswer,
      isCurrentEditWordEmpty,
      activePreviousIncorrectWord,
      fixIncorrectWord,
    ]
  );

  // ==========================================================
  // input 元素的完整 onKeyDown（包含 Enter 提交 + 输入法判断）
  // 由 useKeyboardShortcuts 提供 isComposingRef
  // ==========================================================
  const handleInputKeyDown = useCallback(
    (e) => {
      // Ctrl+Backspace（Windows）：删除上一个单词
      if (e.code === "Backspace" && e.ctrlKey) {
        e.preventDefault();
        // 简单实现：删除光标前的一个词
        const pos = getCursorPosition();
        const value = inputValue;
        let newEnd = pos;
        while (newEnd > 0 && value[newEnd - 1] === " ") newEnd--;
        const newStart = value.lastIndexOf(" ", newEnd - 1) + 1;
        const newValue = value.slice(0, newStart) + value.slice(pos);
        setInputValue(newValue);
        syncFromInput(newValue);
        setCursorPosition(newStart);
        return;
      }

      // Ctrl+任意键：阻止默认行为（避免中文输入法上屏问题）
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        return;
      }

      // Enter + 非输入法组合状态 + 非 Fix 模式 → 提交
      // 注意：主键盘 Enter code="Enter"，小键盘 Enter code="NumpadEnter"，都要支持
      if (
        (e.code === "Enter" || e.code === "NumpadEnter") &&
        !(isComposingRef?.current ?? false) &&
        mode !== MODES.FIX
      ) {
        e.preventDefault();
        e.stopPropagation();
        submitAnswer();
        return;
      }

      // 其他键交给状态机处理
      handleKeyboardInput(e);
    },
    [
      getCursorPosition,
      inputValue,
      syncFromInput,
      setCursorPosition,
      isComposingRef,
      mode,
      submitAnswer,
      handleKeyboardInput,
    ]
  );

  // ==========================================================
  // 重置（切换题目时调用）
  // ==========================================================
  const reset = useCallback(() => {
    setMode(MODES.INPUT);
    setInputValue("");
    setUserInputWords((prevWords) =>
      prevWords.map((w) => ({ ...w, userInput: "", incorrect: false, isActive: false }))
    );
    currentEditWordIdRef.current = null;
    usedHintRef.current = false;
    enteredFixModeRef.current = false;
    questionStartTimeRef.current = Date.now();
  }, []);

  // ==========================================================
  // 返回
  // ==========================================================
  return {
    // 状态
    mode,
    inputValue,
    userInputWords,
    isJudging,
    // 事件
    handleChange,
    handleInputKeyDown,
    handleKeyboardInput,
    // 操作
    submitAnswer,
    submitToBackend,
    fixIncorrectWord,
    fixFirstIncorrectWord,
    reset,
    markHintUsed,
    // 工具
    getCursorPosition,
    setCursorPosition,
    updateActiveWord,
    isFixMode: mode === MODES.FIX,
    isFixInputMode: mode === MODES.FIX_INPUT,
    isInputMode: mode === MODES.INPUT,
  };
}
