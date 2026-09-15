/**
 * AnswerPanel.jsx —— 答对详情页
 *
 * 功能：
 *  - 大字号逐词渲染，hover 变主色调，点击单词发音
 *  - 整句发音喇叭按钮
 *  - 展示重音标注、中文释义、语法要点
 *  - 按钮：再来一次 / 下一题
 *  - 空格、Enter 快捷键跳转下一题
 *
 * 发音：Web Speech API (speechSynthesis)，俄语 lang='ru-RU'
 */

import { useEffect, useCallback } from "react";

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
        .answer-word {
          transition: color 0.15s ease, transform 0.15s ease;
          cursor: pointer;
        }
        .answer-word:hover {
          color: #9B7B5E;
          transform: translateY(-2px);
        }
      `}</style>

      {/* 主卡片 */}
      <div style={{ ...styles.card, animation: "answer-fadeIn 0.4s ease" }}>
        {/* 成功标识 */}
        <div style={styles.successBadge}>
          <span style={{ fontSize: 20, marginRight: 6 }}>✓</span>
          回答正确
        </div>

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
            style={styles.speakBtn}
            onClick={() => speakRussian(statement.russian)}
            title="播放整句发音"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

        {/* 语法要点 */}
        {statement.grammaticalNote && (
          <div style={styles.grammarNote}>
            <span style={{ fontWeight: 600, marginRight: 4 }}>语法：</span>
            {statement.grammaticalNote}
          </div>
        )}

        {/* 操作按钮 */}
        <div style={styles.btnRow}>
          <button style={styles.secondaryBtn} onClick={onRetry}>
            再来一次
          </button>
          <button style={styles.primaryBtn} onClick={onNext}>
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
// 样式（奶咖燕麦轻奢风）
// ==========================================================
const styles = {
  wrapper: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    background: "#F5F0EB",
  },
  card: {
    width: "100%",
    maxWidth: 640,
    background: "#fff",
    borderRadius: 20,
    padding: "40px 36px 32px",
    boxShadow: "0 8px 28px rgba(155,123,94,0.14)",
    textAlign: "center",
  },
  successBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 16px",
    background: "#E4EDE8",
    color: "#6E8F7E",
    borderRadius: 20,
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 28,
  },
  wordsRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px 14px",
    marginBottom: 20,
    minHeight: 60,
  },
  wordText: {
    fontFamily: '"PT Serif", Georgia, "Segoe UI", serif',
    fontSize: 36,
    color: "#3D332C",
    lineHeight: 1.3,
    letterSpacing: "0.3px",
  },
  speakBtn: {
    width: 44,
    height: 44,
    borderRadius: "50%",
    border: "1px solid #E8E1D9",
    background: "#FAF7F3",
    color: "#86796D",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s ease",
    marginLeft: 4,
  },
  stressMark: {
    fontFamily: '"PT Serif", Georgia, serif',
    fontSize: 18,
    color: "#9B7B5E",
    marginBottom: 12,
    letterSpacing: "0.5px",
  },
  chinese: {
    fontSize: 20,
    color: "#5C4D3F",
    fontWeight: 500,
    marginBottom: 16,
    lineHeight: 1.5,
  },
  grammarNote: {
    fontSize: 14,
    color: "#86796D",
    background: "#F5EFE7",
    padding: "10px 18px",
    borderRadius: 10,
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
  secondaryBtn: {
    padding: "12px 28px",
    background: "#fff",
    color: "#5C4D3F",
    border: "1px solid #E0D6CB",
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  primaryBtn: {
    padding: "12px 28px",
    background: "linear-gradient(135deg, #9B7B5E, #856849)",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    transition: "all 0.2s ease",
    boxShadow: "0 2px 8px rgba(155,123,94,0.25)",
  },
  kbdHint: {
    display: "inline-block",
    padding: "1px 6px",
    background: "rgba(255,255,255,0.25)",
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 400,
  },
  hint: {
    fontSize: 12,
    color: "#B4A79C",
  },
};
