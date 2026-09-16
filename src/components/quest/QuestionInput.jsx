/**
 * QuestionInput.jsx —— 连词成句输入组件（句乐部白底紫色风格）
 *
 * 结构：隐藏的 <input> + 覆盖层单词卡片
 * 视觉：白底紫色，激活词 fuchsia #E879F9，默认词半透明深灰
 * 错误类型区分（仅文字颜色变化，下划线统一灰色）：
 *   - case_error       → 橙色 #F59E0B + 抖动
 *   - spelling_error   → 红色 #EF4444 + 抖动
 *   - conjugation_error → 蓝色 #3B82F6 + 抖动
 * 字体：默认词系统字重400，激活/错误词 Nunito Bold 700
 * 字号：桌面端 3em，移动端 1.8em（CSS变量 --ew-word-size）
 */

import { useMemo } from "react";

// 错误类型 → 文字颜色映射（下划线统一灰色，只有文字变色）
const ERROR_COLORS = {
  case_error: "#F59E0B",        // 橙色（变格错误）
  spelling_error: "#EF4444",    // 红色（拼写错误）
  conjugation_error: "#3B82F6", // 蓝色（变位错误）
};

const ERROR_LABELS = {
  case_error: "变格",
  spelling_error: "拼写",
  conjugation_error: "变位",
};

// 判断是否为纯标点符号（不生成下划线）
const isPunctuation = (text) => /^[.,!?;:…'"()\[\]{}\-–—\s]+$/.test(text || "");

export default function QuestionInput({
  userInputWords = [],
  mode = "input",
  inputRef,
  value = "",
  onChange,
  onKeyDown,
  errors = [],
  placeholder = "输入俄语句子，按 Enter 提交",
}) {
  // 构建 wordIndex → error 的映射，方便渲染时查找
  const errorMap = useMemo(() => {
    const map = {};
    (errors || []).forEach((err) => {
      if (err.wordIndex >= 0) map[err.wordIndex] = err;
    });
    return map;
  }, [errors]);

  return (
    <div className="quest-input-wrapper">
      {/* 组件专属样式 —— 句乐部白底紫色风格 */}
      <style>{`
        .quest-input-wrapper {
          position: relative;
          width: 100%;
          min-height: 120px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* 隐藏的真实输入框 —— 核心底线：position/z-index/opacity/font-size 完全不动 */
        .quest-input-real {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          opacity: 0;
          border: none;
          outline: none;
          background: transparent;
          font-size: 24px;
          color: transparent;
          caret-color: transparent;
          cursor: text;
          z-index: 2;
        }

        /* 覆盖层：单词卡片容器 */
        .quest-input-overlay {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 16px;
          min-height: 80px;
          width: 100%;
        }

        /* 单词卡片（有下划线） */
        .quest-word {
          position: relative;
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          padding: 0 2px;
          height: var(--ew-word-height, 4rem);
          justify-content: flex-end;
          transition: color 0.15s ease;
        }

        /* 纯标点符号（无下划线） */
        .quest-word-punct {
          position: relative;
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          padding: 0 2px;
          height: var(--ew-word-height, 4rem);
          justify-content: flex-end;
        }

        /* 单词文字 —— 默认：系统字重400，半透明深灰 */
        .quest-word-text {
          font-family: "Nunito", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-size: var(--ew-word-size, 3em);
          line-height: 1;
          font-weight: 400;
          color: rgba(32, 32, 32, 0.6);
          min-width: 1ch;
          text-align: center;
          transition: color 0.15s ease;
        }

        /* 标点文字 —— 无下划线，默认色 */
        .quest-word-punct .quest-word-text {
          color: rgba(32, 32, 32, 0.6);
        }

        /* 空词占位（下划线）—— 统一灰色 */
        .quest-word-empty {
          display: inline-block;
          min-width: 2ch;
          border-bottom: 2px solid var(--ew-border, #D1D5DB);
          margin-bottom: 2px;
        }

        /* 激活词：紫色文字 + 紫色下划线 + Nunito Bold */
        .quest-word-active .quest-word-text {
          color: var(--ew-accent, #E879F9);
          font-weight: 700;
        }
        .quest-word-active .quest-word-empty {
          border-bottom-color: var(--ew-accent, #E879F9);
        }

        /* 错误词：抖动 + Nunito Bold（下划线保持灰色，文字颜色由内联style控制） */
        .quest-word-error {
          animation: ew-shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97);
        }
        .quest-word-error .quest-word-text {
          font-weight: 700;
        }
        /* 错误词下划线保持灰色 —— 不覆盖 border-color */

        /* 错误提示（suggestion） */
        .quest-word-suggestion {
          font-size: 11px;
          margin-top: 6px;
          padding: 4px 10px;
          border-radius: 6px;
          white-space: normal;
          line-height: 1.5;
          max-width: 220px;
          text-align: center;
          word-break: break-word;
          font-weight: 500;
        }

        /* 占位提示 */
        .quest-placeholder {
          color: var(--ew-text-faint, #9CA3AF);
          font-size: 18px;
          padding: 24px;
        }
      `}</style>

      {/* 隐藏的真实输入框 —— 完全保持原样 */}
      <input
        ref={inputRef}
        className="quest-input-real"
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        aria-label={placeholder}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />

      {/* 覆盖层：单词卡片 */}
      <div className={`quest-input-overlay quest-mode-${mode}`}>
        {userInputWords.length === 0 ? (
          <span className="quest-placeholder">{placeholder}</span>
        ) : (
          userInputWords.map((word, index) => {
            const error = errorMap[index];
            const errorColor = error ? ERROR_COLORS[error.errorType] || "#EF4444" : null;
            const isError = word.incorrect && error;
            const isPunct = isPunctuation(word.text);

            let wordClass = isPunct ? "quest-word-punct" : "quest-word";
            if (word.isActive) wordClass += " quest-word-active";
            if (isError) wordClass += " quest-word-error";

            return (
              <div key={word.id} className={wordClass}>
                <span
                  className="quest-word-text"
                  style={isError ? { color: errorColor } : undefined}
                >
                  {word.userInput ? (
                    word.userInput
                  ) : isPunct ? (
                    word.text
                  ) : (
                    <span className="quest-word-empty">&nbsp;</span>
                  )}
                </span>

                {/* 错误提示：仅在有错误且有 suggestion 时显示 */}
                {isError && error.suggestion && (
                  <span
                    className="quest-word-suggestion"
                    style={{
                      color: errorColor,
                      background: `${errorColor}14`,
                      border: `1px solid ${errorColor}30`,
                    }}
                  >
                    {error.suggestion}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
