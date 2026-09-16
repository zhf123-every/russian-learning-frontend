/**
 * QuestPractice.jsx —— 俄语连词成句正式答题页
 *
 * 整合：
 *  - useQuestionInput（三态状态机）
 *  - useKeyboardShortcuts（全局快捷键）
 *  - QuestionInput（单词卡片渲染）
 *
 * 功能：
 *  - 从后端加载课程句子
 *  - 顶部工具栏（进度、计时器、返回）
 *  - 中文释义提示
 *  - 答对后自动跳转下一题（AnswerPanel 后续迭代）
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuestionInput } from "../hooks/useQuestionInput";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useGameStats } from "../hooks/useGameStats";
import QuestionInput from "../components/quest/QuestionInput";
import AnswerPanel from "../components/quest/AnswerPanel";
import SummaryPanel from "../components/quest/SummaryPanel";
import ModeTabs from "../components/quest/ModeTabs";
import { playTypingSound, playRightSound, playErrorSound, ensureTypingSound, checkPlayTypingSound } from "../lib/questSounds";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";
const DEFAULT_COURSE_ID = "b7254aa773f74a315211bd37";

export default function QuestPractice() {
  const navigate = useNavigate();
  const { courseId } = useParams();
  const effectiveCourseId = courseId || DEFAULT_COURSE_ID;

  // ---- 课程数据 ----
  const [statements, setStatements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0);

  // ---- 计时器 ----
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);

  // ---- 后端返回的错误详情（传给 QuestionInput 显示 suggestion）----
  const [currentErrors, setCurrentErrors] = useState([]);

  // ---- 答对提示 ----
  const [showCorrect, setShowCorrect] = useState(false);
  const [showAnswerPanel, setShowAnswerPanel] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  // ---- 游戏化统计（抽离到独立 Hook）----
  const {
    combo,
    maxCombo,
    correctCount,
    comboEffect,
    recordCorrect,
    recordWrong,
    resetStats,
    getAccuracy,
    getGrade,
  } = useGameStats();

  const currentStatement = statements[questionIndex];
  const inputRef = useRef(null);

  // ---- 全局快捷键 ----
  const { isComposingRef } = useKeyboardShortcuts({
    onSound: () => playSentenceSound(),
    onShowAnswer: () => setShowAnswer((v) => !v),
    onMastered: () => {},
    onAddWord: () => {},
    enabled: !loading && !loadError,
  });

  const [showAnswer, setShowAnswer] = useState(false);

  // ---- 输入状态机 ----
  const {
    mode,
    inputValue,
    userInputWords,
    handleChange,
    isFixMode,
    isFixInputMode,
    reset,
    handleInputKeyDown: _rawHandleInputKeyDown,
  } = useQuestionInput({
    answerText: currentStatement?.russian || "",
    statementId: currentStatement?.id || "",
    apiBaseUrl: API_BASE,
    inputRef,
    isComposingRef,
    onCorrect: (result) => {
      setCurrentErrors([]);
      setShowAnswerPanel(true);
      recordCorrect();
      playRightSound();
    },
    onWrong: (result) => {
      setCurrentErrors(result.errors || []);
      recordWrong();
      playErrorSound();
    },
  });

  // 包装键盘事件：播放打字音
  const handleInputKeyDown = (e) => {
    if (checkPlayTypingSound(e)) {
      playTypingSound();
    }
    _rawHandleInputKeyDown(e);
  };

  // ---- 加载课程 ----
  useEffect(() => {
    ensureTypingSound();
    let cancelled = false;
    async function loadCourse() {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(`${API_BASE}/api/courses/${effectiveCourseId}/statements`);
        const json = await res.json();
        if (!cancelled) {
          if (json.ok && json.data && json.data.statements) {
            setStatements(json.data.statements);
          } else {
            setLoadError("课程数据格式异常");
          }
        }
      } catch (e) {
        if (!cancelled) setLoadError(`无法连接后端: ${e.message}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadCourse();
    return () => { cancelled = true; };
  }, [effectiveCourseId]);

  // ---- 计时器 ----
  useEffect(() => {
    if (!loading && !loadError) {
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [loading, loadError]);

  // ---- 自动聚焦输入框 ----
  useEffect(() => {
    if (!loading && !loadError && currentStatement) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [loading, loadError, questionIndex, currentStatement]);

  // ---- 跳转下一题 ----
  const goToNext = useCallback(() => {
    if (questionIndex < statements.length - 1) {
      setQuestionIndex((i) => i + 1);
      setCurrentErrors([]);
      setShowAnswer(false);
    } else {
      // 全部完成，显示结算页
      setShowSummary(true);
    }
  }, [questionIndex, statements.length]);

  // ---- 发音（简单实现，后续接入 TTS）----
  const playSentenceSound = () => {
    // TODO: 接入俄语 TTS
  };

  // ---- 格式化时间 ----
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // ---- AnswerPanel 操作 ----
  const handleRetry = () => {
    setShowAnswerPanel(false);
    reset();
    setCurrentErrors([]);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleNextFromAnswer = () => {
    setShowAnswerPanel(false);
    reset();
    setCurrentErrors([]);
    goToNext();
  };

  // ---- SummaryPanel 操作 ----
  const handleRetryFromSummary = () => {
    setShowSummary(false);
    setQuestionIndex(0);
    reset();
    setCurrentErrors([]);
    setElapsed(0);
    resetStats();
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleGoCourseList = () => {
    setShowSummary(false);
    navigate(-1);
  };

  // ==========================================================
  // 渲染
  // ==========================================================
  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loading}>加载课程中...</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={styles.page}>
        <div style={styles.errorCard}>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#A86454", marginBottom: 8 }}>
            加载失败
          </div>
          <div style={{ color: "#86796D", marginBottom: 16 }}>{loadError}</div>
          <button style={styles.primaryBtn} onClick={() => navigate(-1)}>
            返回
          </button>
        </div>
      </div>
    );
  }

  // 答对详情页
  if (showAnswerPanel) {
    return (
      <AnswerPanel
        statement={currentStatement}
        onRetry={handleRetry}
        onNext={handleNextFromAnswer}
        isLast={questionIndex === statements.length - 1}
      />
    );
  }

  return (
    <div
      style={{
        ...styles.page,
        animation: comboEffect === "shake" ? "quest-shake 0.4s ease-in-out" : "none",
        boxShadow: comboEffect?.startsWith("flash")
          ? `inset 0 0 60px ${comboEffect === "flash20" ? "rgba(168,100,84,0.4)" : comboEffect === "flash10" ? "rgba(176,138,90,0.35)" : "rgba(212,168,83,0.3)"}`
          : "none",
        transition: "box-shadow 0.3s ease",
      }}
    >
      <style>{`
        @keyframes combo-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
        @keyframes quest-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
      `}</style>
      {/* 答对提示遮罩 */}
      {showCorrect && (
        <div style={styles.correctOverlay}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✓</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: "#6E8F7E" }}>正确</div>
        </div>
      )}

      {/* 顶部工具栏 */}
      <div style={styles.toolbar}>
        <button style={styles.iconBtn} onClick={() => navigate(-1)} title="返回">
          ←
        </button>
        <ModeTabs currentMode="practice" courseId={effectiveCourseId} />
        <div style={styles.progress}>
          第 {questionIndex + 1} / {statements.length} 题
        </div>
        {/* Combo 连击显示 */}
        {combo > 0 && (
          <div
            style={{
              ...styles.comboBadge,
              color: combo >= 20 ? "#A86454" : combo >= 10 ? "#B08A5A" : combo >= 5 ? "#D4A853" : "#9B7B5E",
              animation: combo >= 5 ? "combo-pulse 0.6s ease infinite" : "none",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 500 }}>Combo</span>
            <span style={{ fontSize: 20, fontWeight: 800, marginLeft: 4 }}>×{combo}</span>
          </div>
        )}
        <div style={styles.timer}>{formatTime(elapsed)}</div>
        <button style={styles.iconBtn} title="设置">
          ⚙
        </button>
      </div>

      {/* 进度条 */}
      <div style={styles.progressBarBg}>
        <div
          style={{
            ...styles.progressBarFill,
            width: `${((questionIndex + 1) / statements.length) * 100}%`,
          }}
        />
      </div>

      {/* 主内容区 */}
      <div style={styles.mainContent}>
        {/* 中文释义 */}
        <div style={styles.hintCard}>
          <div style={styles.hintLabel}>中文释义</div>
          <div style={styles.hintText}>{currentStatement?.chinese}</div>
          {currentStatement?.grammaticalNote && (
            <div style={styles.grammarNote}>{currentStatement.grammaticalNote}</div>
          )}
          {showAnswer && currentStatement?.stressMarked && (
            <div style={styles.answerReveal}>
              答案：<span style={{ fontFamily: '"PT Serif", Georgia, serif' }}>{currentStatement.stressMarked}</span>
            </div>
          )}
        </div>

        {/* 输入组件 */}
        <div style={styles.inputCard}>
          <QuestionInput
            userInputWords={userInputWords}
            mode={mode}
            inputRef={inputRef}
            value={inputValue}
            onChange={handleChange}
            onKeyDown={handleInputKeyDown}
            errors={currentErrors}
          />
        </div>

        {/* 模式提示 */}
        <div style={styles.modeHint}>
          {isFixMode && (
            <span style={{ color: "#A86454" }}>
              按任意键开始修正错误词
            </span>
          )}
          {isFixInputMode && (
            <span style={{ color: "#B08A5A" }}>
              修正当前词 · 空格跳下一个错词 · Backspace 回退
            </span>
          )}
          {!isFixMode && !isFixInputMode && (
            <span style={{ color: "#86796D" }}>
              Enter 提交 · Ctrl+' 发音 · Ctrl+; 看答案
            </span>
          )}
        </div>
      </div>

      {/* 结算页弹窗 */}
      <SummaryPanel
        visible={showSummary}
        totalQuestions={statements.length}
        totalTime={elapsed}
        accuracy={getAccuracy(statements.length)}
        maxCombo={maxCombo}
        grade={getGrade(statements.length)}
        courseId={effectiveCourseId}
        onRetry={handleRetryFromSummary}
        onGoCourseList={handleGoCourseList}
        hasNextCourse={false}
      />
    </div>
  );
}

// ==========================================================
// 样式（奶咖燕麦轻奢风）
// ==========================================================
const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    background: "#FFFFFF",
  },
  loading: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    color: "#86796D",
  },
  errorCard: {
    margin: "80px auto",
    padding: 32,
    background: "#fff",
    borderRadius: 16,
    boxShadow: "0 4px 16px rgba(155,123,94,0.10)",
    textAlign: "center",
    maxWidth: 400,
  },
  correctOverlay: {
    position: "fixed",
    top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(245,240,235,0.92)",
    backdropFilter: "blur(8px)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    animation: "fadeIn 0.3s ease",
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: "14px 24px",
    background: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(12px)",
    borderBottom: "1px solid #E8E1D9",
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    border: "none",
    background: "transparent",
    color: "#5C4D3F",
    fontSize: 18,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background 0.2s",
  },
  progress: {
    flex: 1,
    textAlign: "center",
    fontSize: 15,
    fontWeight: 600,
    color: "#3D332C",
    whiteSpace: "nowrap",
    minWidth: 80,
  },
  timer: {
    fontSize: 15,
    fontWeight: 500,
    color: "#86796D",
    fontVariantNumeric: "tabular-nums",
    minWidth: 50,
    textAlign: "center",
  },
  comboBadge: {
    display: "flex",
    alignItems: "baseline",
    padding: "4px 12px",
    background: "rgba(255,255,255,0.7)",
    borderRadius: 20,
    border: "1px solid #E8E1D9",
    marginRight: 4,
  },
  progressBarBg: {
    height: 3,
    background: "#E8E1D9",
  },
  progressBarFill: {
    height: "100%",
    background: "linear-gradient(90deg, #9B7B5E, #B08A5A)",
    transition: "width 0.3s ease",
  },
  mainContent: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "32px 24px",
    gap: 24,
    maxWidth: 800,
    margin: "0 auto",
    width: "100%",
  },
  hintCard: {
    width: "100%",
    padding: "20px 24px",
    background: "#fff",
    borderRadius: 16,
    boxShadow: "0 2px 12px rgba(155,123,94,0.06)",
    textAlign: "center",
  },
  hintLabel: {
    fontSize: 12,
    color: "#B4A79C",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  hintText: {
    fontSize: 20,
    fontWeight: 600,
    color: "#3D332C",
    lineHeight: 1.5,
  },
  grammarNote: {
    marginTop: 10,
    fontSize: 13,
    color: "#9B7B5E",
    background: "#F5EFE7",
    padding: "8px 14px",
    borderRadius: 8,
    display: "inline-block",
  },
  answerReveal: {
    marginTop: 12,
    fontSize: 16,
    color: "#6E8F7E",
    fontWeight: 500,
  },
  inputCard: {
    width: "100%",
    background: "#fff",
    borderRadius: 16,
    boxShadow: "0 4px 16px rgba(155,123,94,0.10)",
    minHeight: 140,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  modeHint: {
    fontSize: 13,
    textAlign: "center",
    minHeight: 20,
  },
  primaryBtn: {
    padding: "10px 24px",
    background: "linear-gradient(135deg, #9B7B5E, #856849)",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 500,
    cursor: "pointer",
    transition: "transform 0.2s, box-shadow 0.2s",
  },
};
