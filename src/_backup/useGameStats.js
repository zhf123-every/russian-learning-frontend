/**
 * useGameStats.js —— 游戏化统计 Hook
 *
 * 职责：
 *  - Combo 连击计数（答对 +1，答错清零，间隔超10秒重置为1）
 *  - 最大连击追踪
 *  - 答对题数统计
 *  - 根据连击数自动计算反馈类型（Good/Great/Perfect/Amazing）
 *  - 正确率计算
 *  - 评级计算（SSS/SS/S/A/B/C）
 *
 * 反馈分级规则：
 *  - 连击 1-3 → Good（显示 Good×1, Good×2, Good×3）
 *  - 连击 4-5 → Great（显示 Great×4, Great×5）
 *  - 连击 6-8 → Perfect（显示 Perfect×6, Perfect×7, Perfect×8）
 *  - 连击 9+  → Amazing（显示 Amazing×9, Amazing×10, ...）
 */

import { useState, useRef, useCallback } from "react";

// 连击时间窗口（毫秒）：两次答对间隔超过此值，连击重置为1
const COMBO_TIMEOUT = 10 * 1000;

// 评级配置（颜色、发光、标签）
export const GRADE_CONFIG = {
  SSS: { color: "#7C3AED", glow: "rgba(124,58,237,0.4)", label: "完美通关" },
  SS: { color: "#A855F7", glow: "rgba(168,85,247,0.35)", label: "出色表现" },
  S: { color: "#C084FC", glow: "rgba(192,132,252,0.35)", label: "表现优秀" },
  A: { color: "#6B7280", glow: "rgba(107,114,128,0.35)", label: "稳步前进" },
  B: { color: "#9CA3AF", glow: "rgba(156,163,175,0.35)", label: "继续加油" },
  C: { color: "#9CA3AF", glow: "rgba(156,163,175,0.3)", label: "需要练习" },
};

// 根据连击数计算反馈类型
export function getFeedbackType(combo) {
  if (combo >= 9) return "amazing";
  if (combo >= 6) return "perfect";
  if (combo >= 4) return "great";
  return "good";
}

export function useGameStats() {
  // ---- 状态 ----
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [comboEffect, setComboEffect] = useState(null); // 屏幕光效/震动

  // 上次答对时间（用于10秒间隔判断）
  const lastAnswerTimeRef = useRef(0);
  const comboTimerRef = useRef(null);

  // ---- 答对：处理连击逻辑 ----
  const recordCorrect = useCallback(() => {
    const now = Date.now();
    const lastTime = lastAnswerTimeRef.current;
    lastAnswerTimeRef.current = now;

    setCombo((prev) => {
      let next;
      // 如果是第一次答对，或者距离上次答对超过10秒，连击重置为1
      if (prev === 0 || lastTime === 0 || now - lastTime > COMBO_TIMEOUT) {
        next = 1;
      } else {
        // 否则连击+1
        next = prev + 1;
      }

      setMaxCombo((max) => Math.max(max, next));
      setCorrectCount((c) => c + 1);

      // 里程碑光效：进入 Great/Perfect/Amazing 时触发
      if (next === 4 || next === 6 || next === 9) {
        setComboEffect(`flash${next}`);
        if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
        comboTimerRef.current = setTimeout(() => setComboEffect(null), 800);
      }

      return next;
    });
  }, []);

  // ---- 答错：Combo 清零 + 页面震动 ----
  const recordWrong = useCallback(() => {
    setCombo(0);
    lastAnswerTimeRef.current = 0;
    setComboEffect("shake");
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    comboTimerRef.current = setTimeout(() => setComboEffect(null), 400);
  }, []);

  // ---- 重置全部统计 ----
  const resetStats = useCallback(() => {
    setCombo(0);
    setMaxCombo(0);
    setCorrectCount(0);
    setComboEffect(null);
    lastAnswerTimeRef.current = 0;
    if (comboTimerRef.current) {
      clearTimeout(comboTimerRef.current);
      comboTimerRef.current = null;
    }
  }, []);

  // ---- 正确率计算 ----
  const getAccuracy = useCallback(
    (totalQuestions) => {
      return totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;
    },
    [correctCount]
  );

  // ---- 评级计算 ----
  const getGrade = useCallback(
    (totalQuestions) => {
      const accuracy = getAccuracy(totalQuestions);
      if (accuracy >= 95 && maxCombo >= 15) return "SSS";
      if (accuracy >= 90) return "SS";
      if (accuracy >= 80) return "S";
      if (accuracy >= 70) return "A";
      if (accuracy >= 60) return "B";
      return "C";
    },
    [getAccuracy, maxCombo]
  );

  // 当前反馈类型（根据连击数）
  const feedbackType = getFeedbackType(combo);

  return {
    // 状态
    combo,
    maxCombo,
    correctCount,
    comboEffect,
    feedbackType, // 当前连击对应的反馈类型
    // 操作
    recordCorrect,
    recordWrong,
    resetStats,
    // 计算
    getAccuracy,
    getGrade,
  };
}
