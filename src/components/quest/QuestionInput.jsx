/**
 * QuestionInput.jsx —— 打字答题输入组件
 *
 * 结构：隐藏的 <input> + 下划线单词槽
 * 视觉：纯白背景，无卡片，只有 border-bottom 下划线
 *   - 默认词：半透明深灰文字 + 灰色下划线 #D1D5DB
 *   - 激活词：紫色文字 + 紫色下划线 + Bold
 *   - 错误词：文字颜色按错误类型（橙/红/蓝）+ 同色下划线 + 抖动
 * 字体：默认词系统字重400，激活/错误词 Nunito Bold 700
 * 字号：桌面端 3em，移动端 1.8em
 *
 * 答题输入框样式（三种都是横线，区别只在长度规则）：
 *   - dynamic 单词长度：下划线宽度 = 标准答案单词长度匹配（я 就一条短横线，不等长）
 *   - fixed   固定宽度：下划线宽度跟随该词已输入内容长度（输入越长线越长，未输入为短横线）
 *   - underline 极简横线：整行底部一条长长的横线（激活→紫色长线，错误→红色长线）
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

// 按单词长度估算下划线宽度（ch 相对当前字号，自动适配桌面/移动端）
const slotWidthFor = (text) => {
  const len = (text || "").length || 1;
  return `calc(${(len * 1.1 + 1.4).toFixed(2)}ch)`;
};

export default function QuestionInput({
  userInputWords = [],
  mode = "input",
  inputRef,
  value = "",
  onChange,
  onKeyDown,
  errors = [],
  isJudging = false,
  inputStyle = "underline",
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

  // 是否有错误词 / 是否有激活词（极简长线整条变色的依据）
  const hasError = useMemo(() => (errors || []).some((e) => e.wordIndex >= 0), [errors]);
  const hasActive = useMemo(
    () => (userInputWords || []).some((w) => w.isActive && !w.fixed),
    [userInputWords]
  );

  return (
    <div
      className="quest-input-wrapper"
      data-style={inputStyle}
      data-err={hasError ? "1" : "0"}
      data-act={hasActive ? "1" : "0"}
    >
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
          padding-bottom: 2px;
        }

        /* 单词槽：默认只有底部下划线，无背景无边框无圆角 */
        .quest-word {
          height: 4rem;
          border-bottom: 2px solid var(--qs-border, #D1D5DB);
          font-family: "Nunito", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-size: 3em;
          line-height: 1;
          font-weight: 400;
          color: var(--qs-sub, rgba(32, 32, 32, 0.6));
          text-align: center;
          transition: color 0.15s ease, border-color 0.15s ease;
          display: inline-flex;
          align-items: flex-end;
          justify-content: center;
          padding: 0 4px 2px;
        }

        /* 「固定宽度」：下划线宽度跟随该词已输入内容长度（JS 注入），不再固定 96px */
        .quest-input-wrapper[data-style="fixed"] .quest-word {
          padding: 0 6px 2px;
        }
        .quest-input-wrapper[data-style="fixed"] .quest-word-punct {
          width: auto;
          min-width: 0;
        }

        /* 「单词长度」：宽度由 JS 按单词字符数注入（不等长下划线，я 只放得下 я） */

        /* 「极简横线」：词槽不画线，整行底部一条长长的横线 */
        .quest-input-wrapper[data-style="underline"] .quest-word,
        .quest-input-wrapper[data-style="underline"] .quest-word-punct {
          border-bottom: none;
          min-width: 0;
          padding: 0 6px 2px;
        }
        .quest-input-wrapper[data-style="underline"] .quest-input-row {
          border-bottom: 2px solid var(--qs-border, #D1D5DB);
        }
        /* 有激活词 → 整条长线紫色；有错误 → 整条长线红色 */
        .quest-input-wrapper[data-style="underline"][data-act="1"][data-err="0"] .quest-input-row {
          border-bottom-color: var(--qs-active, #5B21B6);
        }
        .quest-input-wrapper[data-style="underline"][data-err="1"] .quest-input-row {
          border-bottom-color: #E11D48;
        }

        /* 激活词：紫色文字 + 紫色下划线 + Bold（极简横线模式下线由长线统一显示） */
        .quest-word-active {
          color: var(--qs-active, #5B21B6);
          border-bottom-color: var(--qs-active, #5B21B6);
          font-weight: 700;
        }
        .quest-input-wrapper[data-style="underline"] .quest-word-active {
          border-bottom-color: transparent;
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

        /* 已给人名/专有名词：纯文字显示，无下划线、无槽位 */
        .quest-word-fixed {
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
          color: var(--qs-sub, #9CA3AF);
          font-size: 18px;
          padding: 24px;
        }

        /* 移动端适配 */
        @media (max-width: 768px) {
          .quest-word,
          .quest-word-punct {
            font-size: 1.8em;
            height: 2.5rem;
          }
          .quest-input-row {
            min-height: 2.5rem;
            gap: 6px;
          }
          .quest-input-wrapper[data-style="fixed"] .quest-word {
            width: 72px;
            min-width: 72px;
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
            // 前端判题标错的词（word.incorrect）同样标红；errorType 只决定具体颜色
            const isError = !!word.incorrect;
            const isPunct = isPunctuation(word.text);

            let className = isPunct ? "quest-word-punct" : "quest-word";
            if (word.fixed) {
              // 已给人名/专有名词：纯文字显示，无下划线、不参与输入
              className = "quest-word-fixed";
            } else if (word.isActive) {
              className += " quest-word-active";
            }
            if (!word.fixed && isError) className += " quest-word-error";

            // 「单词长度」样式：每个词下划线宽度 = 该词字符数（不等长）
            // 「固定宽度」样式：宽度跟随该词已输入内容长度（输入越长线越长，未输入时是短横线）
            const dynWidth =
              (inputStyle === "dynamic" || inputStyle === "fixed") && !word.fixed && !isPunct
                ? { width: slotWidthFor(inputStyle === "fixed" ? (word.userInput || "") : word.text) }
                : undefined;

            return (
              <div
                key={word.id}
                className={className}
                style={
                  isError
                    ? { color: errorColor || "#E11D48", borderBottomColor: errorColor || "#E11D48", ...dynWidth }
                    : dynWidth
                }
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
