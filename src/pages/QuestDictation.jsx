/**
 * QuestDictation.jsx —— 俄语听写模式答题页
 *
 * 与 QuestPractice（中译俄）共用 90% 逻辑：
 *  - useQuestionInput（三态状态机）
 *  - useKeyboardShortcuts（全局快捷键）
 *  - useGameStats（Combo + 评级）
 *  - QuestionInput（单词卡片渲染）
 *  - AnswerPanel（答对详情）
 *  - SummaryPanel（结算 + 数据上报）
 *
 * 听写模式差异：
 *  - 不显示中文释义，改为大播放按钮
 *  - 进入题目自动播放俄语发音
 *  - 输入为空时按 Space 重播发音
 *  - Ctrl+; 查看模糊字幕（答完后才能彻底看清）
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
import ShortcutTips from "../components/quest/ShortcutTips";
;
import { playTypingSound, playRightSound, playErrorSound, ensureTypingSound, checkPlayTypingSound } from "../lib/questSounds";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";
const DEFAULT_COURSE_ID = "b7254aa773f74a315211bd37";

export default function QuestDictation() {
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

  // ---- 后端返回的错误详情 ----
  const [currentErrors, setCurrentErrors] = useState([]);

  // ---- 页面状态 ----
  const [showAnswerPanel, setShowAnswerPanel] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showSubtitle, setShowSubtitle] = useState(false); // 模糊字幕
  const [isPlaying, setIsPlaying] = useState(false);
  const [needsInteraction, setNeedsInteraction] = useState(true); // 浏览器自动播放限制引导

  const currentStatement = statements[questionIndex];
  const inputRef = useRef(null);
  const hasInteractedRef = useRef(false);

  // ---- 游戏化统计 ----
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

  // ---- 俄语发音（Web Speech API）----
  const playAudio = useCallback((text) => {
    const textToPlay = text || currentStatement?.russian;
    if (!textToPlay || typeof window === "undefined" || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(textToPlay);
      utterance.lang = "ru-RU";
      utterance.rate = 0.85;
      utterance.pitch = 1;
      utterance.onstart = () => setIsPlaying(true);
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("发音失败:", e);
      setIsPlaying(false);
    }
  }, [currentStatement?.russian]);

  // ---- 全局快捷键 ----
  const { isComposingRef } = useKeyboardShortcuts({
    onSound: () => playAudio(),
    onShowAnswer: () => setShowSubtitle((v) => !v),
    onMastered: () => {},
    onAddWord: () => {},
    enabled: !loading && !loadError,
  });

  // ---- 输入状态机 ----
  const {
    mode,
    inputValue,
    userInputWords,
    handleChange,
    handleInputKeyDown,
    isFixMode,
    isFixInputMode,
    reset,
    submitAnswer,
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

  // ---- 听写模式：包装键盘事件，输入为空时 Space 重播发音（所有模式优先）----
  const wrappedHandleKeyDown = useCallback(
    (e) => {
      // 听写模式：输入框为空 + 非输入法组合状态 → Space 重播发音
      // 优先级高于状态机：Input 模式下不输入空格，Fix_Input 模式下不跳下一个错词
      // 输入框有内容时，Space 才交给状态机处理（Input 输入空格 / Fix_Input 跳下一个错词）
      if (
        e.code === "Space" &&
        inputValue.length === 0 &&
        !(isComposingRef?.current ?? false)
      ) {
        e.preventDefault();
        playAudio();
        return;
      }
      if (checkPlayTypingSound(e)) {
        playTypingSound();
      }
      handleInputKeyDown(e);
    },
    [inputValue, isComposingRef, playAudio, handleInputKeyDown]
  );

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

  // ---- 进入题目自动播放发音（需用户先交互一次）----
  useEffect(() => {
    if (
      currentStatement?.russian &&
      !loading &&
      !loadError &&
      !showAnswerPanel &&
      !showSummary &&
      hasInteractedRef.current
    ) {
      const timer = setTimeout(() => playAudio(), 500);
      return () => clearTimeout(timer);
    }
  }, [questionIndex, currentStatement?.id, loading, loadError, showAnswerPanel, showSummary, playAudio]);

  // ---- 开始听写（用户首次交互，解锁自动播放）----
  const handleStartDictation = useCallback(() => {
    hasInteractedRef.current = true;
    setNeedsInteraction(false);
    setTimeout(() => {
      playAudio();
      inputRef.current?.focus();
    }, 200);
  }, [playAudio]);

  // ---- 自动聚焦输入框 ----
  useEffect(() => {
    if (!loading && !loadError && currentStatement && !showAnswerPanel && !showSummary) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [loading, loadError, questionIndex, currentStatement, showAnswerPanel, showSummary]);

  // ---- 跳转下一题 ----
  const goToNext = useCallback(() => {
    if (questionIndex < statements.length - 1) {
      setQuestionIndex((i) => i + 1);
      setCurrentErrors([]);
      setShowSubtitle(false);
    } else {
      setShowSummary(true);
    }
  }, [questionIndex, statements.length]);

  // ---- AnswerPanel 操作 ----
  const handleRetry = () => {
    setShowAnswerPanel(false);
    reset();
    setCurrentErrors([]);
    setShowSubtitle(false);
    setTimeout(() => {
      inputRef.current?.focus();
      playAudio();
    }, 200);
  };

  const handleNextFromAnswer = () => {
    setShowAnswerPanel(false);
    reset();
    setCurrentErrors([]);
    setShowSubtitle(false);
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
    setShowSubtitle(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleGoCourseList = () => {
    setShowSummary(false);
    navigate(-1);
  };

  // ---- 格式化时间 ----
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
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
          <div style={{ fontSize: 18, fontWeight: 600, color: "#E11D48", marginBottom: 8 }}>
            加载失败
          </div>
          <div style={{ color: "#A1A1AA", marginBottom: 16 }}>{loadError}</div>
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
        @keyframes play-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(79,70,229,0.4); }
          50% { box-shadow: 0 0 0 16px rgba(79,70,229,0); }
        }
      `}</style>

      {/* 首次进入引导层（浏览器自动播放限制，需用户点击一次） */}
      {needsInteraction && (
        <div style={styles.startOverlay}>
          <div style={styles.startCard}>
            <button style={styles.startButton} onClick={handleStartDictation}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="6 3 20 12 6 21 6 3" />
              </svg>
            </button>
            <div style={styles.startTitle}>听写模式</div>
            <div style={styles.startDesc}>
              点击开始，播放第一题发音<br />
              凭听力输入俄语句子
            </div>
            <div style={styles.startTips}>
              <span>空格键重播</span>
              <span style={{ margin: "0 8px", color: "#D4C9BE" }}>·</span>
              <span>Ctrl+; 看模糊字幕</span>
              <span style={{ margin: "0 8px", color: "#D4C9BE" }}>·</span>
              <span>Enter 提交</span>
            </div>
          </div>
        </div>
      )}

      {/* 顶部工具栏 */}
      <div style={styles.toolbar}>
        <button style={styles.iconBtn} onClick={() => navigate(-1)} title="返回">
          ←
        </button>
        <ModeTabs currentMode="dictation" courseId={effectiveCourseId} />
        <div style={styles.progress}>
          第 {questionIndex + 1} / {statements.length} 题
        </div>
        {combo > 0 && (
          <div
            style={{
              ...styles.comboBadge,
              color: combo >= 20 ? "#E11D48" : combo >= 10 ? "#EA580C" : combo >= 5 ? "#F59E0B" : "#4F46E5",
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
        {/* 播放按钮（替代中文释义） */}
        <div style={styles.playSection}>
          <button
            style={{
              ...styles.playButton,
              animation: isPlaying ? "play-pulse 1.2s ease infinite" : "none",
              background: isPlaying
                ? "linear-gradient(135deg, #4338CA, #3730A3)"
                : "linear-gradient(135deg, #4F46E5, #4338CA)",
            }}
            onClick={() => playAudio()}
            title="播放发音（空格键重播）"
          >
            {isPlaying ? (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="2">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="6 3 20 12 6 21 6 3" />
              </svg>
            )}
          </button>
          <div style={styles.playHint}>
            {isPlaying ? "正在播放..." : "点击播放 · 输入为空时按空格键重播"}
          </div>

          {/* 模糊字幕（Ctrl+; 切换） */}
          {showSubtitle && (
            <div style={styles.subtitleBlur}>
              <span style={{ fontSize: 11, color: "#A1A1AA", marginBottom: 4, display: "block" }}>
                字幕（模糊预览，答完后可看清）
              </span>
              <span style={styles.subtitleText}>{currentStatement?.russian}</span>
            </div>
          )}
          {!showSubtitle && (
            <div style={{ fontSize: 12, color: "#A1A1AA", marginTop: 8 }}>
              按 Ctrl+; 查看模糊字幕
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
            onKeyDown={wrappedHandleKeyDown}
            errors={currentErrors}
          />
        </div>

        {/* 模式提示 */}
        <div style={styles.modeHint}>
          {isFixMode && (
            <span style={{ color: "#E11D48" }}>
              按字母键开始修正 · 空格键重播发音
            </span>
          )}
          {isFixInputMode && inputValue.length === 0 && (
            <span style={{ color: "#EA580C" }}>
              输入修正词 · 空输入时空格重播发音 · Backspace 回退上一个错词
            </span>
          )}
          {isFixInputMode && inputValue.length > 0 && (
            <span style={{ color: "#EA580C" }}>
              修正当前词 · 空格跳下一个错词 · Backspace 回退
            </span>
          )}
          {!isFixMode && !isFixInputMode && inputValue.length === 0 && (
            <span style={{ color: "#A1A1AA" }}>
              先听发音，再输入 · 空格键重播 · Enter 提交
            </span>
          )}
          {!isFixMode && !isFixInputMode && inputValue.length > 0 && (
            <span style={{ color: "#A1A1AA" }}>
              Enter 提交 · Ctrl+' 重播发音 · Ctrl+; 看字幕
            </span>
          )}
        </div>
      </div>

      {/* 底部快捷键提示栏 */}
      <ShortcutTips
        mode="question"
        variant="dictation"
        inputRef={inputRef}
        onSubmit={submitAnswer}
        onNext={handleNextFromAnswer}
        onRetry={handleRetry}
        onPlaySound={() => playAudio()}
        onShowAnswer={() => setShowSubtitle((v) => !v)}
      />

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
    color: "#A1A1AA",
  },
  errorCard: {
    margin: "80px auto",
    padding: 32,
    background: "#fff",
    borderRadius: 16,
    boxShadow: "0 4px 16px rgba(79,70,229,0.10)",
    textAlign: "center",
    maxWidth: 400,
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 24px",
    background: "#FFFFFF",
    borderBottom: "1px solid #E5E7EB",
  },
  toolbarLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  toolbarRight: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    border: "none",
    background: "transparent",
    color: "#4B5563",
    fontSize: 18,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "color 0.15s ease",
  },
  progress: {
    fontSize: 15,
    fontWeight: 600,
    color: "#374151",
    whiteSpace: "nowrap",
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
  timer: {
    fontSize: 15,
    fontWeight: 500,
    color: "#6B7280",
    fontVariantNumeric: "tabular-nums",
    minWidth: 50,
    textAlign: "center",
  },
  progressBarBg: {
    height: 3,
    background: "#E5E7EB",
  },
  progressBarFill: {
    height: "100%",
    background: "linear-gradient(90deg, #6366F1, #4F46E5)",
    transition: "width 0.3s ease",
  },
  mainContent: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "32px 24px 24px",
    gap: 24,
    maxWidth: 800,
    margin: "0 auto",
    width: "100%",
  },
  playSection: {
    width: "100%",
    padding: "24px 24px 20px",
    background: "#fff",
    borderRadius: 16,
    boxShadow: "0 2px 12px rgba(79,70,229,0.06)",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: "50%",
    border: "none",
    color: "#fff",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "transform 0.2s, box-shadow 0.2s",
    boxShadow: "0 4px 16px rgba(79,70,229,0.3)",
    marginBottom: 12,
  },
  playHint: {
    fontSize: 14,
    color: "#A1A1AA",
    fontWeight: 500,
  },
  subtitleBlur: {
    marginTop: 16,
    padding: "10px 20px",
    background: "#F4F4F6",
    borderRadius: 10,
    maxWidth: "100%",
  },
  subtitleText: {
    fontFamily: '"PT Serif", Georgia, serif',
    fontSize: 20,
    color: "#18181B",
    filter: "blur(4px)",
    userSelect: "none",
    letterSpacing: "0.5px",
    display: "inline-block",
  },
  inputCard: {
    width: "100%",
    background: "#fff",
    borderRadius: 16,
    boxShadow: "0 4px 16px rgba(79,70,229,0.10)",
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
    padding: "12px 28px",
    background: "linear-gradient(135deg, #4F46E5, #4338CA)",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s ease",
    boxShadow: "0 2px 8px rgba(79,70,229,0.25)",
  },
  // ---- 首次进入引导层 ----
  startOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(247,247,249,0.96)",
    backdropFilter: "blur(8px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  startCard: {
    textAlign: "center",
    padding: "48px 40px",
    background: "#fff",
    borderRadius: 24,
    boxShadow: "0 8px 32px rgba(79,70,229,0.15)",
    maxWidth: 420,
  },
  startButton: {
    width: 88,
    height: 88,
    borderRadius: "50%",
    border: "none",
    background: "linear-gradient(135deg, #4F46E5, #4338CA)",
    color: "#fff",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 24px",
    boxShadow: "0 6px 24px rgba(79,70,229,0.35)",
    transition: "transform 0.2s, box-shadow 0.2s",
  },
  startTitle: {
    fontSize: 26,
    fontWeight: 800,
    color: "#18181B",
    marginBottom: 12,
    letterSpacing: "1px",
  },
  startDesc: {
    fontSize: 15,
    color: "#A1A1AA",
    lineHeight: 1.7,
    marginBottom: 24,
  },
  startTips: {
    fontSize: 13,
    color: "#A1A1AA",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
  },
};
