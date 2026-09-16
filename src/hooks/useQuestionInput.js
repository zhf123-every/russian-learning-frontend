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

import { useState, useRef, useCallback, useEffect } from "react";

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
    start: 0,         // 该词在输入框字符串中的起始位置
    end: 0,           // 结束位置
  };
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
}) {
  // ---- 状态 ----
  const [mode, setMode] = useState(MODES.INPUT);
  const [inputValue, setInputValue] = useState("");
  const [userInputWords, setUserInputWords] = useState([]);

  // 当前正在修正的词 id（Fix_Input 模式下）
  const currentEditWordIdRef = useRef(null);

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
    answerText.split(" ").forEach((text) => {
      if (isWord(text)) {
        words.push(createWord(text, id++));
      }
    });
    if (words.length > 0) words[0].isActive = true;
    setUserInputWords(words);
    setInputValue("");
    setMode(MODES.INPUT);
    currentEditWordIdRef.current = null;
  }, [answerText]);

  // ==========================================================
  // 双向同步：输入框字符串 ↔ 单词数组
  // ==========================================================

  /**
   * 从输入框字符串同步到单词数组
   * 计算每个词的 userInput / start / end
   * 保留 incorrect 状态（提交标记的错误不因输入变化而重置）
   */
  const syncFromInput = useCallback((value) => {
    setUserInputWords((prevWords) => {
      const newWords = prevWords.map((w) => ({ ...w }));
      let position = 0;
      const parts = value.split(" ");
      newWords.forEach((word, index) => {
        const input = parts[index] || "";
        word.userInput = input;
        word.start = position;
        word.end = position + input.length;
        position += input.length + 1; // +1 是词间空格
      });
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
      // 用 requestAnimationFrame 确保 DOM 更新后再设置
      requestAnimationFrame(() => {
        inputRef.current?.setSelectionRange(pos, pos);
      });
    }
  }, [inputRef]);

  /**
   * 根据光标位置更新当前激活词（紫色高亮）
   */
  const updateActiveWord = useCallback((cursorPos) => {
    setUserInputWords((prevWords) => {
      const newWords = prevWords.map((w) => ({ ...w, isActive: false }));
      for (const word of newWords) {
        if (cursorPos >= word.start && cursorPos <= word.end) {
          word.isActive = true;
          break;
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
      setInputValue(value);
      syncFromInput(value);
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
      setUserInputWords((prevWords) => {
        const newWords = prevWords.map((w) =>
          w.id === word.id ? { ...w, userInput: "" } : w
        );
        // 同步计算 start/end
        let position = 0;
        newWords.forEach((w) => {
          w.start = position;
          w.end = position + w.userInput.length;
          position += w.userInput.length + 1;
        });
        // 更新激活词
        newWords.forEach((w) => (w.isActive = w.id === word.id));
        return newWords;
      });
      // 同步输入框值
      setUserInputWords((prevWords) => {
        const newValue = prevWords.map((w) => w.userInput).join(" ");
        setInputValue(newValue);
        return prevWords;
      });
      // 光标移到该词起始位置
      setCursorPosition(word.start);
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
   */
  const markIncorrectFromErrors = useCallback((errors) => {
    setUserInputWords((prevWords) => {
      const newWords = prevWords.map((w) => ({ ...w, incorrect: false }));
      (errors || []).forEach((err) => {
        if (err.wordIndex >= 0 && err.wordIndex < newWords.length) {
          newWords[err.wordIndex].incorrect = true;
        }
      });
      return newWords;
    });
  }, []);

  /**
   * 提交答案
   * - Fix 模式下不提交（Enter 会被 handleKeyboardInput 拦截进入 Fix_Input）
   * - 调用后端判题，有错 → Fix 模式，无错 → 清空并回调 onCorrect
   */
  const submitAnswer = useCallback(async () => {
    if (mode === MODES.FIX) return;

    const result = await submitToBackend(inputValue);

    if (result === null) return;

    if (result && result.errors && result.errors.length > 0) {
      markIncorrectFromErrors(result.errors);
      enteredFixModeRef.current = true;
      setMode(MODES.FIX);
      onWrong?.(result);
    } else {
      // 全部正确
      setMode(MODES.INPUT);
      setInputValue("");
      setUserInputWords((prevWords) =>
        prevWords.map((w) => ({ ...w, userInput: "", incorrect: false, isActive: false }))
      );
      currentEditWordIdRef.current = null;
      const resultType = computeResultType();
      onCorrect?.(result, resultType);
    }
  }, [mode, inputValue, submitToBackend, markIncorrectFromErrors, onCorrect, onWrong]);

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
