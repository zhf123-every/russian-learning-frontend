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
import { checkUnitAccess } from "../lib/courseAccess";
import { findLocalUnitById } from "../utils/storage";
import { apiFetch } from "../lib/api";
import { markUnitDone } from "../lib/lessonProgress";
import { addStudyTime } from "../lib/learningStats";
import { getCourseById } from "../utils/courseService";
import { recordPeak, addDailyExp, recordCase } from "../lib/questStats";
import { expandUnitToChunkSteps, buildZhIndex } from "../lib/chunking";
import { useQuestionInput } from "../hooks/useQuestionInput";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useGameStats } from "../hooks/useGameStats";
import QuestionInput from "../components/quest/QuestionInput";
import AnswerPanel from "../components/quest/AnswerPanel";
import SummaryPanel from "../components/quest/SummaryPanel";
import ModePickerModal, { COURSE_MODES } from "../components/ModePickerModal";
import SettingsModal from "../components/SettingsModal";
import LearningContentModal from "../components/LearningContentModal";
import SentenceTreeModal from "../components/SentenceTreeModal";
import ReportErrorModal from "../components/ReportErrorModal";
import ShortcutTips from "../components/quest/ShortcutTips";
;
import { playTypingSound, playRightSound, playErrorSound, ensureTypingSound, checkPlayTypingSound } from "../lib/questSounds";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";
// 无 courseId 时的默认单元：privet_rossiya_a1 课程包第一单元（u1），后端已确证存在
const DEFAULT_UNIT_ID = "u1";

// Chunking：把拍平的 statements 逐句展开为滚雪球步骤（听写页无 spellWord 单词环节，全部句子切块）
function expandStatements(items, wordList) {
  const zhIdx = buildZhIndex(wordList);
  return (Array.isArray(items) ? items : []).flatMap((it) => {
    const steps = expandUnitToChunkSteps(it, zhIdx);
    return steps || [it];
  });
}

export default function QuestDictation() {
  const navigate = useNavigate();
  const { courseId } = useParams();
  const effectiveCourseId = courseId || DEFAULT_UNIT_ID;
  const sessionStartRef = useRef(Date.now()); // 学习时长统计起点
  // 学习时长归属课程：优先取 URL 上 ?courseId=（详情页跳转带入），否则用单元 ID
  const studyCourseId = (() => { try { return new URLSearchParams(window.location.search).get('courseId') || effectiveCourseId } catch (e) { return effectiveCourseId } })()
  // 离开学习页时累计本次学习时长（含完成）+ 每日 EXP（听写模式）
  useEffect(() => {
    return () => {
      const mins = Math.max(1, Math.round((Date.now() - sessionStartRef.current) / 60000))
      addStudyTime(studyCourseId, Date.now() - sessionStartRef.current)
      addDailyExp(mins, '听写')
    }
  }, [studyCourseId])

  // ---- 通关之路：显式语法课程门控（仅 isGrammar=true 的课程积累六格天赋树）----
  const grammarOnRef = useRef(false)
  useEffect(() => {
    let alive = true
    getCourseById(studyCourseId).then((info) => {
      if (!alive) return
      const g = !!(info && (info.isGrammar || info.category === '语法专项'))
      grammarOnRef.current = g
    }).catch(() => { grammarOnRef.current = false })
    return () => { alive = false }
  }, [studyCourseId])

  const [statements, setStatements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  // 本地投稿课程（?src=local）：lesson.sentences 逐句听写
  const [localLesson, setLocalLesson] = useState(null);
  const [isLocalMode, setIsLocalMode] = useState(false);
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
  const [showSettings, setShowSettings] = useState(false);
  const [showModePicker, setShowModePicker] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showAnswerMode, setShowAnswerMode] = useState(false);
  const [showLearning, setShowLearning] = useState(false);
  const [showTree, setShowTree] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [shuffled, setShuffled] = useState(false);
  const originalSeqRef = useRef(null);
  const [hint, setHint] = useState(null);
  const hintTimerRef = useRef(null);
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

  // ---- 巅峰连斩 ----
  useEffect(() => {
    if (maxCombo > 0) recordPeak({ maxCombo })
  }, [maxCombo])

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
      // Chunking：每一步答对都显示答对面板（含中间步），用户点「下一题」进入下一步
      setShowAnswerPanel(true);
      recordCorrect();
      playRightSound();
      // 通关之路：六格天赋树（听写模式同样积累；仅语法课程的词句带 grammar_case 标注时起效）
      if (Array.isArray(currentStatement?.words)) {
        if (grammarOnRef.current) currentStatement.words.forEach((w) => { if (w && w.grammar_case) recordCase(w.grammar_case, true) })
      }
    },
    onWrong: (result) => {
      setCurrentErrors(result.errors || []);
      recordWrong();
      playErrorSound();
      // 通关之路：六格天赋树（答错 → 该句各词格的答题数+1，不计正确）
      if (Array.isArray(currentStatement?.words)) {
        if (grammarOnRef.current) currentStatement.words.forEach((w) => { if (w && w.grammar_case) recordCase(w.grammar_case, false) })
      }
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

  // ---- 付费单元守卫：带 ?pack= 进入时校验是否解锁，锁定则回课程详情并弹购买窗 ----
  useEffect(() => {
    let packId = null
    try { packId = new URLSearchParams(window.location.search).get("pack") } catch (e) { packId = null }
    if (!packId || !effectiveCourseId) return
    let cancelled = false
    ;(async () => {
      const r = await checkUnitAccess(API_BASE, packId, effectiveCourseId)
      if (!cancelled && !r.allowed) {
        navigate('/quest/' + encodeURIComponent(packId) + '?locked=' + encodeURIComponent(effectiveCourseId), { replace: true })
      }
    })()
    return () => { cancelled = true }
  }, [effectiveCourseId])

  // ---- 加载课程 ----
  useEffect(() => {
    ensureTypingSound();
    let cancelled = false;
    async function loadCourse() {
      setLoading(true);
      setLoadError(null);
      // 本地投稿课程：直接消费课时数据（单词 + 渐进例句）逐句听写，不依赖后端
      // 数据源：① sessionStorage（投稿链路写入）→ ② 本地课程库（后台课时，持久化兜底）
      try {
        const isLocal = new URLSearchParams(window.location.search).get("src") === "local";
        const isBackendUnit = String(effectiveCourseId).startsWith("unit_");
        if (isLocal || isBackendUnit) {
          let stored = null
          try { stored = JSON.parse(sessionStorage.getItem("rlearn_local_lesson_" + effectiveCourseId) || "null") } catch (e) { stored = null }
          if (!(stored && Array.isArray(stored.sentences) && stored.sentences.length)) {
            stored = findLocalUnitById(effectiveCourseId)
          }
          if (stored && Array.isArray(stored.sentences) && stored.sentences.length) {
            const items = stored.sentences.filter(x => x && x.ru).map((st, i) => ({
              id: `local_${i + 1}`,
              russian: st.ru || "",
              chinese: st.zh || "",
              words: [],
            }));
            if (!cancelled) {
              setLocalLesson(stored);
              setIsLocalMode(true);
              setStatements(expandStatements(items, stored.words));
            }
            if (!cancelled) setLoading(false);
            return;
          }
          if (!cancelled) setIsLocalMode(false);
        }
      } catch (e) { /* 忽略，走 API */ }

      // 云端课程库兜底（全网可见）：后台课程已同步到 B2，访客浏览器无 localStorage，从云端名单找课时
      if (String(effectiveCourseId).startsWith("unit_")) {
        try {
          const cloudRes = await apiFetch('/api/videos/list')
          const cloudJson = await cloudRes.json()
          if (cloudJson.ok && Array.isArray(cloudJson.videos)) {
            for (const v of cloudJson.videos) {
              if (v && v.kind === 'course' && Array.isArray(v.units)) {
                const u = v.units.find(x => x.id === effectiveCourseId)
                if (u && Array.isArray(u.sentences) && u.sentences.length) {
                  const items = u.sentences.filter(x => x && x.ru).map((st, i) => ({
                    id: `cloud_${i + 1}`,
                    russian: st.ru || "",
                    chinese: st.zh || "",
                    words: [],
                  }));
                  if (!cancelled) {
                    setLocalLesson(u)
                    setIsLocalMode(true)
                    setUnitMeta({ title: u.title || u.name || "本课", description: u.description || "" })
                    setStatements(expandStatements(items, u.words))
                  }
                  if (!cancelled) setLoading(false)
                  return
                }
              }
            }
          }
        } catch (e) { /* 云端不可用，走后端 */ }
      }

      try {
        const res = await fetch(`${API_BASE}/api/units/${effectiveCourseId}/build-steps`);
        const json = await res.json();
        if (!cancelled) {
          if (json.ok && json.data) {
            // build-steps → 听写 statements 拍平映射（family 无分组，step → statement）
            const items = [];
            for (const fam of json.data.families || []) {
              for (const st of fam.steps || []) {
                items.push({
                  id: st.step_order != null ? `${fam.family_name}-${st.step_order}` : `s${items.length}`,
                  russian: st.target_sentence || "",
                  chinese: st.chinese || "",
                  words: Array.isArray(st.words) ? st.words : [],
                });
              }
            }
            if (items.length === 0) {
              setLoadError("该单元没有可听写的句子");
            } else {
              setStatements(expandStatements(items, null));
            }
          } else {
            setLoadError("课程数据格式异常");
          }
        }
      } catch (e) {
        if (!cancelled) {
          // 默认兜底单元也加载失败 → 去课程列表选课，不留在 404 页
          if (!courseId) { navigate('/quest-store', { replace: true }); return; }
          setLoadError(`无法连接后端: ${e.message}`);
        }
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
      // 全部完成 —— 记录课时完成（详情页进度打通）
      markUnitDone(courseId);
      // 通关之路：单局最高输出（每题 +10 EXP）+ 单局最高命中率
      const totalQ = statements.length || 1
      const acc = totalQ > 0 ? Math.round((correctCount / totalQ) * 100) : 0
      recordPeak({ score: correctCount * 10, accuracy: acc })
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

  // ---- 顶栏操作（对标句乐部）----
  const handleResetProgress = () => {
    if (!window.confirm("确定重置当前课程进度？")) return;
    setShowSummary(false);
    setQuestionIndex(0);
    reset();
    setCurrentErrors([]);
    setElapsed(0);
    resetStats();
    setShowSubtitle(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const togglePause = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) { setIsPaused(false); return; }
    if (window.speechSynthesis.paused) { window.speechSynthesis.resume(); setIsPaused(false); }
    else { window.speechSynthesis.pause(); setIsPaused(true); }
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); }
    else { document.documentElement.requestFullscreen().catch(() => {}); }
  };

  const handleModeStart = (mode) => {
    const u = courseId || effectiveCourseId;
    const isLocal = new URLSearchParams(window.location.search).get('src') === 'local';
    const suffix = isLocal ? `?src=local&courseId=${effectiveCourseId}` : `?courseId=${effectiveCourseId}`;
    setShowModePicker(false);
    if (mode.key === 'chinese_to_english') navigate(`/quest-practice/${u}${suffix}`);
    else if (mode.key === 'dictation') navigate(`/quest-dictation/${u}${suffix}`);
    else alert('该模式暂未开放，当前支持「中译俄 / 听写」两种模式');
  };

  // ---- 顶栏补全适配（乱序/教材数据）----
  const seqsNow = () => statements;
  const setSeqsNow = (arr) => setStatements(arr);
  const resetIndexNow = () => setQuestionIndex(0);
  const bookSentences = (localLesson?.sentences || []).filter((x) => x && x.ru);

  // ---- 补全图标逻辑：教材 / 笔记 / 大纲 / 乱序 / 陌生句 ----
  const showHint = (text) => {
    setHint({ text, id: Date.now() });
    clearTimeout(hintTimerRef.current);
    hintTimerRef.current = setTimeout(() => setHint(null), 1800);
  };

  const openLearning = () => setShowLearning(true);
  const openTree = () => setShowTree(true);
  const openReport = () => setShowReport(true);

  const practiceSentence = (s) => {
    const ru = s?.ru || '';
    if (!ru) return;
    const idx = statements.findIndex((x) => x?.russian === ru);
    if (idx >= 0) { setQuestionIndex(idx); setShowLearning(false); showHint('已定位到该句'); }
    else showHint('未找到该句所在位置');
  };

  const toggleShuffle = () => {
    if (!originalSeqRef.current) originalSeqRef.current = [...seqsNow()];
    if (shuffled) { setSeqsNow([...originalSeqRef.current]); }
    else {
      const arr = [...seqsNow()];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      setSeqsNow(arr);
    }
    setShuffled(!shuffled);
    resetIndexNow();
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
          0%, 100% { box-shadow: 0 0 0 0 rgba(26,26,30,0.4); }
          50% { box-shadow: 0 0 0 16px rgba(26,26,30,0); }
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

      {/* 本地投稿课程：本课单词热身区（先学单词，再逐句听写渐进） */}
      {isLocalMode && !loading && !loadError && Array.isArray(localLesson?.words) && localLesson.words.length > 0 && (
        <div style={{ margin: '14px 18px 0', padding: '14px 16px', borderRadius: 14, background: '#F5F3FF', border: '1px solid #EDE9FE' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#5b21b6', marginBottom: 10 }}>
            📖 本课单词（{localLesson.words.length} 个）— 先记词，再逐句听写
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {localLesson.words.map((w, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, background: '#fff', border: '1px solid #E9D5FF', borderRadius: 999, padding: '4px 12px', fontSize: 13 }}>
                <span style={{ fontWeight: 700, color: '#3b0764', fontFamily: '"PT Serif",Georgia,serif' }}>{w.ru}</span>
                {w.zh && <span style={{ color: '#6d28d9', fontSize: 12 }}>{w.zh}</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 顶部工具栏（对标句乐部：左退出+标题，右图标组） */}
      <div style={styles.toolbar}>
        <div style={styles.toolbarLeft}>
          <button style={styles.iconBtn} onClick={() => navigate(-1)} title="退出游戏" aria-label="退出游戏">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M17 9L20 12L17 15" />
              <path d="M5 5H19" />
              <path d="M5 12H14" />
              <path d="M5 19H19" />
            </svg>
          </button>
          <div style={styles.progress}>
            {localLesson?.title || "听写练习"}（{questionIndex + 1}/{statements.length}）
          </div>
        </div>
        <div style={styles.toolbarRight}>
          <button style={styles.iconBtn} onClick={() => setShowSettings(true)} title="设置">⚙</button>
          <button style={{ ...styles.iconBtn, color: showAnswerMode ? "#7C3AED" : undefined }} onClick={() => setShowAnswerMode((v) => !v)} title={showAnswerMode ? "关闭看答案模式" : "开启看答案模式"}>{showAnswerMode ? "📖✓" : "📖"}</button>
          <button style={styles.iconBtn} onClick={openLearning} title="学习内容">📋</button>
          <button style={styles.iconBtn} onClick={openTree} title="句子树">🔗</button>
          <button style={styles.iconBtn} onClick={() => setShowModePicker(true)} title="切换游戏模式">🎮</button>
          <button style={styles.iconBtn} onClick={toggleShuffle} title={shuffled ? "恢复正序" : "乱序模式"}>{shuffled ? "🔀✓" : "🔀"}</button>
          <button style={styles.iconBtn} onClick={togglePause} title={isPaused ? "继续播放" : "暂停"}>{isPaused ? "▶" : "⏸"}</button>
          <button style={styles.iconBtn} onClick={handleResetProgress} title="重置当前课程进度">↺</button>
          <button style={styles.iconBtn} onClick={openReport} title="报告错误">❗</button>
          <button style={styles.iconBtn} onClick={toggleFullscreen} title="全屏">⛶</button>
        </div>
      </div>

      {/* 状态行：进度 + Combo + 计时器 */}
      <div style={styles.familyBar}>
        <span style={styles.familyName}>{localLesson?.title || "听写练习"}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: "auto" }}>
          {combo > 0 && (
            <div
              style={{
                ...styles.comboBadge,
                color: combo >= 20 ? "#E11D48" : combo >= 10 ? "#EA580C" : combo >= 5 ? "#F59E0B" : "oklch(23.27% 0.0249 284.3)",
                animation: combo >= 5 ? "combo-pulse 0.6s ease infinite" : "none",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 500 }}>Combo</span>
              <span style={{ fontSize: 20, fontWeight: 800, marginLeft: 4 }}>×{combo}</span>
            </div>
          )}
          <span style={styles.familyStep}>
            第 {questionIndex + 1}/{statements.length} 题 · {formatTime(elapsed)}
          </span>
        </div>
      </div>

      {/* 设置弹窗 */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {/* 模式选择弹窗 */}
      {showModePicker && (
        <ModePickerModal
          title={localLesson?.title || "选择练习模式"}
          modes={COURSE_MODES}
          onClose={() => setShowModePicker(false)}
          onStart={handleModeStart}
        />
      )}

      {/* 轻提示 */}
      {hint && (
        <div style={{ position: 'fixed', top: 72, left: '50%', transform: 'translateX(-50%)', zIndex: 200, background: '#333', color: '#fff', padding: '8px 18px', borderRadius: 999, fontSize: 13, boxShadow: '0 4px 12px rgba(0,0,0,0.25)', whiteSpace: 'nowrap' }}>{hint.text}</div>
      )}

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
                ? "linear-gradient(135deg, oklch(18% 0.0249 284.3), oklch(15% 0.0249 284.3))"
                : "linear-gradient(135deg, oklch(23.27% 0.0249 284.3), oklch(18% 0.0249 284.3))",
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

          {/* 看答案模式（📖 开关）：完整答案 */}
          {showAnswerMode && currentStatement?.russian && (
            <div style={styles.subtitleBlur}>
              <span style={{ fontSize: 11, color: "#7C3AED", marginBottom: 4, display: "block", fontWeight: 600 }}>
                看答案模式 · 当前句完整答案
              </span>
              <span style={styles.subtitleText}>{currentStatement?.russian}</span>
            </div>
          )}
          {/* 模糊字幕（Ctrl+; 切换） */}
          {!showAnswerMode && showSubtitle && (
            <div style={styles.subtitleBlur}>
              <span style={{ fontSize: 11, color: "#A1A1AA", marginBottom: 4, display: "block" }}>
                字幕（模糊预览，答完后可看清）
              </span>
              <span style={styles.subtitleText}>{currentStatement?.russian}</span>
            </div>
          )}
          {!showAnswerMode && !showSubtitle && (
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
    boxShadow: "0 4px 16px rgba(26,26,30,0.10)",
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
  familyBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 24px",
    fontSize: 12,
    background: "#FFFFFF",
  },
  familyName: { fontWeight: 600, color: "#6D5C4E" },
  familyStep: { color: "#A99B8C", fontVariantNumeric: "tabular-nums" },
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
    height: 2.5,
    background: "#E5E7EB",
  },
  progressBarFill: {
    height: "100%",
    background: "linear-gradient(90deg, oklch(23.27% 0.0249 284.3), oklch(23.27% 0.0249 284.3))",
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
    boxShadow: "0 2px 12px rgba(26,26,30,0.06)",
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
    boxShadow: "0 4px 16px rgba(26,26,30,0.3)",
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
    boxShadow: "0 4px 16px rgba(26,26,30,0.10)",
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
    background: "linear-gradient(135deg, oklch(23.27% 0.0249 284.3), oklch(18% 0.0249 284.3))",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s ease",
    boxShadow: "0 2px 8px rgba(26,26,30,0.25)",
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
    boxShadow: "0 8px 32px rgba(26,26,30,0.15)",
    maxWidth: 420,
  },
  startButton: {
    width: 88,
    height: 88,
    borderRadius: "50%",
    border: "none",
    background: "linear-gradient(135deg, oklch(23.27% 0.0249 284.3), oklch(18% 0.0249 284.3))",
    color: "#fff",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 24px",
    boxShadow: "0 6px 24px rgba(26,26,30,0.35)",
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
