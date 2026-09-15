/**
 * ModeTabs.jsx —— 模式切换胶囊 Tab
 *
 * 中译俄 / 听写 两种模式切换
 * - 点击切换
 * - Ctrl + Shift + M 快捷键切换
 * - 使用 React Router 跳转，保留 courseId
 * - 奶咖燕麦轻奢风胶囊样式
 */

import { useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

export default function ModeTabs({ currentMode, courseId = "" }) {
  const navigate = useNavigate();

  const switchMode = useCallback(
    (mode) => {
      if (mode === currentMode) return;
      const base = mode === "practice" ? "/quest-practice" : "/quest-dictation";
      const url = courseId ? `${base}/${courseId}` : base;
      navigate(url);
    },
    [currentMode, courseId, navigate]
  );

  // Ctrl + Shift + M 全局快捷键切换模式
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "M" || e.key === "m")) {
        e.preventDefault();
        e.stopPropagation();
        switchMode(currentMode === "practice" ? "dictation" : "practice");
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [currentMode, switchMode]);

  return (
    <div style={styles.tabs} role="tablist" aria-label="学习模式切换">
      <button
        role="tab"
        aria-selected={currentMode === "practice"}
        style={currentMode === "practice" ? { ...styles.tab, ...styles.tabActive } : styles.tab}
        onClick={() => switchMode("practice")}
        title="中译俄模式（Ctrl+Shift+M 切换）"
      >
        中译俄
      </button>
      <button
        role="tab"
        aria-selected={currentMode === "dictation"}
        style={currentMode === "dictation" ? { ...styles.tab, ...styles.tabActive } : styles.tab}
        onClick={() => switchMode("dictation")}
        title="听写模式（Ctrl+Shift+M 切换）"
      >
        听写
      </button>
    </div>
  );
}

const styles = {
  tabs: {
    display: "inline-flex",
    background: "#F0E9E2",
    borderRadius: 20,
    padding: 3,
    gap: 2,
    flexShrink: 0,
  },
  tab: {
    padding: "5px 16px",
    border: "none",
    background: "transparent",
    color: "#86796D",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    borderRadius: 17,
    transition: "all 0.2s ease",
    whiteSpace: "nowrap",
    lineHeight: 1.4,
  },
  tabActive: {
    background: "linear-gradient(135deg, #9B7B5E, #856849)",
    color: "#fff",
    boxShadow: "0 2px 8px rgba(155,123,94,0.3)",
  },
};
