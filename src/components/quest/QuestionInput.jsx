/**
 * QuestionInput.jsx —— 连词成句输入组件
 *
 * 结构：隐藏的 <input> + 覆盖层单词卡片
 * 视觉：奶咖燕麦轻奢风，激活词用主色调 #9B7B5E
 * 错误类型区分：
 *   - case_error       → 暖橙 #B08A5A + 抖动
 *   - spelling_error   → 暗红 #A86454 + 抖动
 *   - conjugation_error → 灰蓝 #5B7B9A + 抖动
 * 每个错误词下方展示后端返回的 suggestion
 */

import { useMemo } from "react";

// 错误类型 → 颜色映射（与奶咖色系协调）
const ERROR_COLORS = {
  case_error: "#B08A5A",        // 暖橙（变格错误）
  spelling_error: "#A86454",    // 暗红（拼写错误）
  conjugation_error: "#5B7B9A", // 灰蓝（变位错误）
};

const ERROR_LABELS = {
  case_error: "变格",
  spelling_error: "拼写",
  conjugation_error: "变位",
};

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
      {/* 组件专属样式 */}
      <style>{`
        .quest-input-wrapper {
          position: relative;
          width: 100%;
          min-height: 120px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* 隐藏的真实输入框 */
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

        /* 覆盖层：单词卡片 */
        .quest-input-overlay {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
          gap: 8px 12px;
          padding: 24px 32px;
          min-height: 80px;
          width: 100%;
        }

        /* 单词卡片 */
        .quest-word {
          position: relative;
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          padding: 4px 2px;
          transition: color 0.15s ease;
        }

        .quest-word-text {
          font-family: "PT Serif", Georgia, "Segoe UI", serif;
          font-size: 28px;
          line-height: 1.4;
          letter-spacing: 0.3px;
          min-width: 24px;
          text-align: center;
          transition: color 0.15s ease;
        }

        /* 空词占位（下划线） */
        .quest-word-empty {
          display: inline-block;
          min-width: 32px;
          border-bottom: 2px solid #D5CBBF;
          margin-bottom: 2px;
        }

        /* 激活词：主色调 + 下划线 */
        .quest-word-active .quest-word-text {
          color: #9B7B5E;
        }
        .quest-word-active .quest-word-empty {
          border-bottom-color: #9B7B5E;
        }

        /* 错误词：颜色由 errorType 决定 + 抖动 */
        .quest-word-error {
          animation: quest-shake 0.4s ease-in-out;
        }
        .quest-word-error .quest-word-text {
          font-weight: 600;
        }

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
        }

        /* Fix 模式下的错误提示更明显 */
        .quest-mode-fix .quest-word-suggestion {
          font-weight: 500;
        }

        /* 抖动动画 */
        @keyframes quest-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-4px); }
          40% { transform: translateX(4px); }
          60% { transform: translateX(-3px); }
          80% { transform: translateX(3px); }
        }

        /* 占位提示 */
        .quest-placeholder {
          color: #B4A79C;
          font-size: 18px;
          font-style: italic;
          padding: 24px;
        }

        /* 点击区域提示 */
        .quest-input-wrapper:hover .quest-input-overlay {
          background: rgba(155, 123, 94, 0.02);
        }
        .quest-input-wrapper {
          border-radius: 16px;
          transition: background 0.2s ease;
        }
      `}</style>

      {/* 隐藏的真实输入框 */}
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
            const errorColor = error ? ERROR_COLORS[error.errorType] || "#A86454" : null;
            const isError = word.incorrect && error;

            let wordClass = "quest-word";
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
