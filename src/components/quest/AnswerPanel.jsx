/**
 * AnswerPanel.jsx —— 答对详情页（句乐部白底紫色风格）
 *
 * 功能：
 *  - 大字号逐词渲染，hover 变紫色，点击单词发音
 *  - 整句发音喇叭按钮
 *  - 展示重音标注、中文释义、语法要点
 *  - 按钮：再来一次 / 下一题
 *  - 空格、Enter 快捷键跳转下一题
 *
 * 发音：Web Speech API (speechSynthesis)，俄语 lang='ru-RU'
 */

import { useEffect, useCallback } from "react";
import WordGrammarCard from "./WordGrammarCard";

export default function AnswerPanel({
  statement,
  onRetry,
  onNext,
  isLast = false,
}) {
  // ---- 俄语发音 ----
  const speakRussian = useCallback((text) => {
    if (!text || typeof window === "undefined" || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ru-RU";
      utterance.rate = 0.9;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("发音失败:", e);
    }
  }, []);

  // 进入页面自动播放整句发音
  useEffect(() => {
    if (statement?.russian) {
      const timer = setTimeout(() => speakRussian(statement.russian), 400);
      return () => clearTimeout(timer);
    }
  }, [statement?.russian, speakRussian]);

  // 空格 / Enter 快捷键 → 下一题
  useEffect(() => {
    const handleKey = (e) => {
      if (e.code === "Space" || e.code === "Enter" || e.code === "NumpadEnter") {
        e.preventDefault();
        onNext?.();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onNext]);

  if (!statement) return null;

  // 按空格拆分单词（过滤标点）
  const words = (statement.russian || "").split(" ").filter((w) => /[а-яА-ЯёЁa-zA-Z0-9]/.test(w));

  return (
    <div style={styles.wrapper}>
      <style>{`
        @keyframes answer-fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        /* 单词 hover：紫色，无位移 */
        .answer-word {
          transition: color 0.15s ease;
          cursor: pointer;
          padding: 4px;
          color: #202020;
        }
        .answer-word:hover {
          color: var(--ew-accent, #E879F9);
        }
        /* 喇叭按钮 hover：变紫 */
        .answer-speak-btn {
          transition: color 0.15s ease, border-color 0.15s ease;
        }
        .answer-speak-btn:hover {
          color: var(--ew-accent, #E879F9);
          border-color: var(--ew-accent, #E879F9);
        }
        /* 按钮 hover：边框变紫 */
        .answer-btn {
          transition: border-color 0.15s ease, color 0.15s ease;
        }
        .answer-btn:hover {
          border-color: var(--ew-accent, #E879F9);
          color: var(--ew-accent, #E879F9);
        }
      `}</style>

      {/* 主卡片 */}
      <div style={{ ...styles.card, animation: "answer-fadeIn 0.4s ease" }}>
        {/* 单词逐词渲染 */}
        <div style={styles.wordsRow}>
          {words.map((word, index) => (
            <span
              key={index}
              className="answer-word"
              style={styles.wordText}
              onClick={() => speakRussian(word)}
              title="点击发音"
            >
              {word}
            </span>
          ))}
          {/* 整句发音按钮 */}
          <button
            className="answer-speak-btn"
            style={styles.speakBtn}
            onClick={() => speakRussian(statement.russian)}
            title="播放整句发音"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
            </svg>
          </button>
        </div>

        {/* 重音标注 */}
        {statement.stressMarked && (
          <div style={styles.stressMark}>
            {statement.stressMarked}
          </div>
        )}

        {/* 中文释义 */}
        <div style={styles.chinese}>
          {statement.chinese}
        </div>

        {/* 语法拆解卡片（按词性上色） */}
        {statement.words && statement.words.length > 0 && (
          <div style={styles.grammarCardsRow}>
            {statement.words.map((w, i) => (
              <WordGrammarCard
                key={i}
                word={w}
                onPlaySound={(text) => speakRussian(text)}
              />
            ))}
          </div>
        )}

        {/* 语法要点 */}
        {statement.grammaticalNote && (
          <div style={styles.grammarNote}>
            <span style={{ fontWeight: 600, marginRight: 4 }}>语法：</span>
            {statement.grammaticalNote}
          </div>
        )}

        {/* 操作按钮 */}
        <div style={styles.btnRow}>
          <button className="answer-btn" style={styles.btn} onClick={onRetry}>
            再来一次
          </button>
          <button className="answer-btn" style={styles.btn} onClick={onNext}>
            {isLast ? "完成课程" : "下一题"}
            <span style={styles.kbdHint}>↵</span>
          </button>
        </div>

        {/* 快捷键提示 */}
        <div style={styles.hint}>
          按 空格 / Enter 快速进入下一题 · 点击单词可单独发音
        </div>
      </div>
    </div>
  );
}

// ==========================================================
// 样式（句乐部白底紫色风格）
// ==========================================================
const styles = {
  wrapper: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    background: "#FFFFFF",
  },
  card: {
    width: "100%",
    maxWidth: 640,
    background: "#fff",
    borderRadius: 16,
    padding: "48px 36px 32px",
    textAlign: "center",
  },
  wordsRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: "4px",
    marginBottom: 24,
    minHeight: 60,
  },
  wordText: {
    fontFamily: '"Nunito", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: "3rem",
    fontWeight: 700,
    lineHeight: 1.2,
  },
  speakBtn: {
    width: 44,
    height: 44,
    borderRadius: "50%",
    border: "1px solid #D1D5DB",
    background: "#fff",
    color: "#6B7280",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  stressMark: {
    fontSize: "1.25rem",
    color: "#6B7280",
    margin: "24px 0",
    letterSpacing: "0.5px",
  },
  chinese: {
    fontSize: "1.25rem",
    color: "#6B7280",
    margin: "24px 0",
    lineHeight: 1.5,
  },
  grammarCardsRow: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "flex-start",
    gap: 4,
    marginTop: 20,
    marginBottom: 8,
    padding: "12px 8px",
    background: "#FAFAFA",
    borderRadius: 12,
    border: "1px solid #F0F0F0",
  },
  grammarNote: {
    fontSize: 14,
    color: "#4B5563",
    background: "#F9FAFB",
    padding: "12px 20px",
    borderRadius: 8,
    marginBottom: 28,
    lineHeight: 1.6,
    display: "inline-block",
    maxWidth: "100%",
  },
  btnRow: {
    display: "flex",
    gap: 12,
    justifyContent: "center",
    marginBottom: 16,
  },
  btn: {
    padding: "10px 28px",
    background: "#fff",
    color: "#374151",
    border: "1px solid #D1D5DB",
    borderRadius: 6,
    fontSize: 15,
    fontWeight: 500,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  },
  kbdHint: {
    display: "inline-block",
    padding: "1px 6px",
    background: "#F3F4F6",
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 400,
    color: "#9CA3AF",
  },
  hint: {
    fontSize: 12,
    color: "#9CA3AF",
  },
};
