/**
 * useGameStats.js —— 游戏化统计 Hook
 *
 * 职责：
 *  - Combo 连击计数（答对 +1，答错清零）
 *  - 最大连击追踪
 *  - 答对题数统计
 *  - 连击里程碑特效（5/10/20 屏幕光效，答错震动）
 *  - 正确率计算
 *  - 评级计算（SSS/SS/S/A/B/C）
 *
 * 使用方式：
 *  const { combo, maxCombo, correctCount, comboEffect,
 *          recordCorrect, recordWrong, resetStats,
 *          getAccuracy, getGrade } = useGameStats();
 */

import { useState, useRef, useCallback } from "react";

// 评级配置（颜色、发光、标签）
export const GRADE_CONFIG = {
  SSS: { color: "#D4A853", glow: "rgba(212,168,83,0.4)", label: "完美通关" },
  SS: { color: "#8B7BA8", glow: "rgba(139,123,168,0.35)", label: "出色表现" },
  S: { color: "#5B7B9A", glow: "rgba(91,123,154,0.35)", label: "表现优秀" },
  A: { color: "#6E8F7E", glow: "rgba(110,143,126,0.35)", label: "稳步前进" },
  B: { color: "#B08A5A", glow: "rgba(176,138,90,0.35)", label: "继续加油" },
  C: { color: "#86796D", glow: "rgba(134,121,109,0.3)", label: "需要练习" },
};

export function useGameStats() {
  // ---- 状态 ----
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [comboEffect, setComboEffect] = useState(null); // "flash5" | "flash10" | "flash20" | "shake"

  const comboTimerRef = useRef(null);

  // ---- 答对：Combo +1，更新最大连击，触发里程碑特效 ----
  const recordCorrect = useCallback(() => {
    setCombo((prev) => {
      const next = prev + 1;
      setMaxCombo((max) => Math.max(max, next));
      // 连击里程碑：5/10/20 触发屏幕光效
      if (next === 5 || next === 10 || next === 20) {
        setComboEffect(`flash${next}`);
        if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
        comboTimerRef.current = setTimeout(() => setComboEffect(null), 800);
      }
      return next;
    });
    setCorrectCount((prev) => prev + 1);
  }, []);

  // ---- 答错：Combo 清零 + 页面震动 ----
  const recordWrong = useCallback(() => {
    setCombo(0);
    setComboEffect("shake");
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    comboTimerRef.current = setTimeout(() => setComboEffect(null), 400);
  }, []);

  // ---- 重置全部统计（再来一组时调用）----
  const resetStats = useCallback(() => {
    setCombo(0);
    setMaxCombo(0);
    setCorrectCount(0);
    setComboEffect(null);
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

  return {
    // 状态
    combo,
    maxCombo,
    correctCount,
    comboEffect,
    // 操作
    recordCorrect,
    recordWrong,
    resetStats,
    // 计算
    getAccuracy,
    getGrade,
  };
}
