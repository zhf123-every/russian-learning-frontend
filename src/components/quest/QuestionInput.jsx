/**
 * QuestionInput.jsx —— 连词成句输入组件（句乐部极简风格）
 *
 * 结构：隐藏的 <input> + 下划线单词槽
 * 视觉：纯白背景，无卡片，只有 border-bottom 下划线
 *   - 默认词：半透明深灰文字 + 灰色下划线 #D1D5DB
 *   - 激活词：靛蓝文字 oklch(23.27% 0.0249 284.3) + 靛蓝下划线
 *   - 错误词：文字颜色按错误类型（橙/红/蓝）+ 同色下划线 + 抖动
 * 字体：默认词系统字重400，激活/错误词 Nunito Bold 700
 * 字号：桌面端 3em，移动端 1.8em
 */

import { useMemo } from "react";

// 错误类型 → 文字颜色映射（下划线同色）
const ERROR_COLORS = {
  case_error: "#EA580C",        // 橙色（变格错误）
  spelling_error: "#E11D48",    // 红色（拼写错误）
  conjugation_error: "#5B7B9A", // 蓝色（变位错误）
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
  isJudging = false,
  placeholder = "输入俄语句子，按 Enter 提交",
}) {
  // 构建 wordIndex → error 的映射
  const errorMap = useMemo(() => {
    const map = {};
    (errors || []).forEach((err) => {
      if (err.wordIndex >= 0) map[err.wordIndex] = err;
    });
    return map;
  }, [errors]);

  return (
    <div className="quest-input-wrapper">
      <style>{`
        /* 外层：无卡片，纯文本居中 */
        .quest-input-wrapper {
          position: relative;
          width: 100%;
          text-align: center;
        }

        /* 单词行：flex 居中换行 */
        .quest-input-row {
          position: relative;
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          align-items: flex-end;
          gap: 8px;
          min-height: 4rem;
        }

        /* 单词槽：只有底部下划线，无背景无边框无圆角 */
        .quest-word {
          height: 4rem;
          border-bottom: 2px solid var(--qs-border, #D1D5DB);
          font-family: "Nunito", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-size: 3em;
          line-height: 1;
          font-weight: 400;
          color: var(--qs-sub, rgba(32, 32, 32, 0.6));
          min-width: 4ch;
          text-align: center;
          transition: color 0.15s ease, border-color 0.15s ease;
          display: inline-flex;
          align-items: flex-end;
          justify-content: center;
          padding-bottom: 2px;
        }

        /* 激活词：紫色文字 + 紫色下划线 + Bold */
        .quest-word-active {
          color: oklch(23.27% 0.0249 284.3);
          border-bottom-color: oklch(23.27% 0.0249 284.3);
          font-weight: 700;
        }

        /* 错误词：抖动 + Bold */
        .quest-word-error {
          animation: ew-shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97);
          font-weight: 700;
        }

        /* 标点符号：无下划线，直接显示 */
        .quest-word-punct {
          height: 4rem;
          font-family: "Nunito", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-size: 3em;
          line-height: 1;
          font-weight: 400;
          color: var(--qs-sub, rgba(32, 32, 32, 0.6));
          display: inline-flex;
          align-items: flex-end;
          justify-content: center;
          padding-bottom: 2px;
        }

        /* 隐藏的真实输入框 —— 绝对定位覆盖在单词行上方 */
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

        /* 占位提示 */
        .quest-placeholder {
          color: #9CA3AF;
          font-size: 18px;
          padding: 24px;
        }

        /* 移动端适配 */
        @media (max-width: 768px) {
          .quest-word,
          .quest-word-punct {
            font-size: 1.8em;
            height: 2.5rem;
            min-width: 2ch;
          }
          .quest-input-row {
            min-height: 2.5rem;
            gap: 6px;
          }
        }
      `}</style>

      <div className="quest-input-row">
        {userInputWords.length === 0 ? (
          <span className="quest-placeholder">{placeholder}</span>
        ) : (
          userInputWords.map((word, index) => {
            const error = errorMap[index];
            const errorColor = error ? ERROR_COLORS[error.errorType] || "#E11D48" : null;
            const isError = word.incorrect && error;
            const isPunct = isPunctuation(word.text);

            let className = isPunct ? "quest-word-punct" : "quest-word";
            if (word.isActive) className += " quest-word-active";
            if (isError) className += " quest-word-error";

            return (
              <div
                key={word.id}
                className={className}
                style={isError ? { color: errorColor, borderBottomColor: errorColor } : undefined}
              >
                {/* 已输入的文字显示在下划线上方；未输入时为空（只显示下划线） */}
                {word.userInput ? word.userInput : isPunct ? word.text : ""}
              </div>
            );
          })
        )}

        {/* 隐藏的真实输入框 —— 保持绝对定位覆盖，保证点击和光标 */}
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
      </div>
    </div>
  );
}
