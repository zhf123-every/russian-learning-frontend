/**
 * useGameStats.js —— 游戏化统计 Hook
 *
 * 职责：
 *  - Combo 连击计数（答对 +1，答错回退到上一级从×1开始）
 *  - 最大连击追踪
 *  - 答对题数统计
 *  - 根据连击数自动计算反馈类型（Good/Great/Perfect/Amazing）
 *  - 正确率计算
 *  - 评级计算（SSS/SS/S/A/B/C）
 *
 * 反馈分级规则（按正确程度累加，不按时间）：
 *  - 连击 1-3 → Good（显示 Good×1, Good×2, Good×3）
 *  - 连击 4-5 → Great（显示 Great×1, Great×2）
 *  - 连击 6-8 → Perfect（显示 Perfect×1, Perfect×2, Perfect×3）
 *  - 连击 9+  → Amazing（显示 Amazing×1, Amazing×2, ...）
 *
 * 答错回退规则：
 *  - Good 级答错 → 保持 Good，从 ×1 开始（combo=1）
 *  - Great 级答错 → 回退到 Good×1（combo=1）
 *  - Perfect 级答错 → 回退到 Great×1（combo=4）
 *  - Amazing 级答错 → 回退到 Perfect×1（combo=6）
 */

import { useState, useRef, useCallback } from "react";
import { playComboSound, playMissSound, playSuccessChord } from "../lib/questSounds";

// 评级配置（颜色、发光、标签）
export const GRADE_CONFIG = {
  SSS: { color: "#7C3AED", glow: "rgba(124,58,237,0.4)", label: "完美通关" },
  SS: { color: "#A855F7", glow: "rgba(168,85,247,0.35)", label: "出色表现" },
  S: { color: "#C084FC", glow: "rgba(192,132,252,0.35)", label: "表现优秀" },
  A: { color: "#6B7280", glow: "rgba(107,114,128,0.35)", label: "稳步前进" },
  B: { color: "#9CA3AF", glow: "rgba(156,163,175,0.35)", label: "继续加油" },
  C: { color: "#D1D5DB", glow: "rgba(209,213,219,0.3)", label: "需要练习" },
};

// 等级边界配置
const LEVEL_THRESHOLDS = {
  good: { min: 1, max: 3, start: 1 },
  great: { min: 4, max: 5, start: 4 },
  perfect: { min: 6, max: 8, start: 6 },
  amazing: { min: 9, max: Infinity, start: 9 },
};

// 根据连击数计算反馈类型
export function getFeedbackType(combo) {
  if (combo >= 9) return "amazing";
  if (combo >= 6) return "perfect";
  if (combo >= 4) return "great";
  return "good";
}

// 计算答错后回退到的连击数（回退到上一级从×1开始）
function getFallbackCombo(currentCombo) {
  if (currentCombo >= 9) {
    // Amazing → 回退到 Perfect×1
    return LEVEL_THRESHOLDS.perfect.start;
  }
  if (currentCombo >= 6) {
    // Perfect → 回退到 Great×1
    return LEVEL_THRESHOLDS.great.start;
  }
  if (currentCombo >= 4) {
    // Great → 回退到 Good×1
    return LEVEL_THRESHOLDS.good.start;
  }
  // Good → 保持 Good，从 ×1 开始
  return LEVEL_THRESHOLDS.good.start;
}

// 计算当前等级内的倍数（每个等级从×1开始）
export function getLevelCombo(combo) {
  if (combo >= 9) return combo - 8; // Amazing: ×1, ×2, ...
  if (combo >= 6) return combo - 5; // Perfect: ×1, ×2, ×3
  if (combo >= 4) return combo - 3; // Great: ×1, ×2
  return combo; // Good: ×1, ×2, ×3
}

export function useGameStats() {
  // ---- 状态 ----
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [comboEffect, setComboEffect] = useState(null); // 屏幕光效/震动

  const comboTimerRef = useRef(null);

  // ---- 答对：连击+1（无时间限制，按正确程度累加） ----
  const recordCorrect = useCallback(() => {
    setCombo((prev) => {
      // 第一次答对从1开始，之后每次+1
      const next = prev === 0 ? 1 : prev + 1;

      setMaxCombo((max) => Math.max(max, next));
      setCorrectCount((c) => c + 1);

      // 播放连击音效（音高随连击数升高）
      playComboSound(next);

      // 里程碑光效：进入 Great/Perfect/Amazing 时触发
      if (next === 4 || next === 6 || next === 9) {
        setComboEffect(`flash${next}`);
        if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
        comboTimerRef.current = setTimeout(() => setComboEffect(null), 800);
      }

      return next;
    });
  }, []);

  // ---- 答错：回退到上一级从×1开始 + 页面震动 ----
  const recordWrong = useCallback(() => {
    // 播放答错 MISS 音效
    playMissSound();

    setCombo((prev) => {
      if (prev === 0) return 0;
      // 回退到上一级从×1开始
      const fallback = getFallbackCombo(prev);
      return fallback;
    });

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
  // 当前等级内的倍数（每个等级从×1开始）
  const levelCombo = getLevelCombo(combo);

  // ---- 整句答对通关：播放通关和弦 ----
  const recordSentenceComplete = useCallback(() => {
    playSuccessChord();
  }, []);

  return {
    // 状态
    combo,
    levelCombo, // 等级内倍数（Good×1, Great×1 等）
    maxCombo,
    correctCount,
    comboEffect,
    feedbackType, // 当前连击对应的反馈类型
    // 操作
    recordCorrect,
    recordWrong,
    recordSentenceComplete, // 整句答对通关音效
    resetStats,
    // 计算
    getAccuracy,
    getGrade,
  };
}
