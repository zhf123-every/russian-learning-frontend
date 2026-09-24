/**
 * QuestPractice.jsx —— 俄语连词成句正式答题页（逐级累加模式）
 *
 * 整合：
 *  - useQuestionInput（三态状态机）
 *  - useKeyboardShortcuts（全局快捷键）
 *  - QuestionInput（单词卡片渲染）
 *
 * 功能：
 *  - 从后端加载课程句子（按 sequence_id 分组）
 *  - 逐级累加答题流：unit → sequence → 下一个sequence
 *  - 顶部工具栏（进度、计时器、返回）
 *  - 答对后自动跳转下一题
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { checkUnitAccess } from "../lib/courseAccess";
import { findLocalUnitById } from "../utils/storage";
import { apiFetch } from "../lib/api";
import { useQuestionInput } from "../hooks/useQuestionInput";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useGameStats } from "../hooks/useGameStats";
import QuestionInput from "../components/quest/QuestionInput";
import { getPosColor } from "../constants/posColors";
import AnswerPanel from "../components/quest/AnswerPanel";
import SummaryPanel from "../components/quest/SummaryPanel";
import ModeTabs from "../components/quest/ModeTabs";
import ShortcutTips from "../components/quest/ShortcutTips";
import FeedbackPopup from "../components/quest/FeedbackPopup";
;
import { playTypingSound, playRightSound, playErrorSound, ensureTypingSound, checkPlayTypingSound } from "../lib/questSounds";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";
// 无 courseId 时的默认单元：privet_rossiya_a1 课程包第一单元（u1），后端已确证存在
const DEFAULT_UNIT_ID = "u1";

// 把 /api/units/:id/build-steps 的 family/step 适配成答题引擎使用的 sequence/unit 结构
// family -> sequence；step -> unit；答题状态机/判题/连击/结算完全复用，不感知数据来源
function adaptBuildSteps(data) {
  const families = Array.isArray(data?.families) ? data.families : [];
  return families.map((fam) => {
    const units = (fam.steps || []).map((step, idx) => {
      const rawWords = Array.isArray(step.words) ? step.words : [];
      const words = rawWords.map((w, i) => {
        const isPlural = w.number === "复数" || w.number === "plural";
        // 业务规则：第一格不标；二~六格直接显示中文；性直接显示；单数不标、复数标“复数”
        const grammarLabel = [w.gender, w.grammar_case, isPlural ? "复数" : ""]
          .filter(Boolean).join("·");
        return {
          ...w,
          order: i,
          form: w.stress_marked || w.word || w.lemma || "",
          lemma: w.lemma || w.word || "",
          pos: w.pos || "",
          posColor: w.pos ? getPosColor(w.pos) : "",
          grammarLabel,
          roleLabel: w.syntactic_role || "",
        };
      });
      const wordOrder = words.map((_, i) => i);
      const stressMarked = words.map((w) => w.form).filter(Boolean).join(" ");
      return {
        id: `${fam.sequence_id}_${step.step_order ?? idx + 1}`,
        sequenceId: fam.sequence_id,
        sequenceOrder: step.step_order ?? idx + 1,
        russian: step.target_sentence || "",
        stressMarked,
        chinese: step.chinese || "",
        action: step.action || "",
        grammarNote: step.grammar_note || "",
        newElement: step.new_element || "",
        words,
        acceptableAnswers: [{ wordOrder, wordVariants: {}, isDefault: true, note: "" }],
      };
    });
    return {
      id: fam.sequence_id,
      name: fam.family_name || fam.sequence_id,
      familyName: fam.family_name || fam.sequence_id,
      units,
      totalUnits: units.length,
      fullSentence: fam.full_sentence || "",
    };
  });
}

// 本地投稿课程：lesson.sentences（AI 渐进例句）→ 答题引擎 sequence/unit 结构
// 学习流程 = 逐词推进：出一个单词 → 打字拼写该词 → 紧接着打该词相关的渐进句（每词 2-3 句，短→中→长）
// 生词少的课每词多配几句凑够渐进梯度；词表缺失时退回「全部句子渐进」
function adaptLocalLesson(lesson) {
  const sentences = Array.isArray(lesson.sentences) ? lesson.sentences.filter(x => x && x.ru) : [];
  const words = Array.isArray(lesson.words) ? lesson.words.filter(w => w && w.ru) : [];

  const buildUnit = (ru, zh, idx) => {
    const tokens = String(ru || "").trim().split(/\s+/).filter(Boolean);
    const ws = tokens.map((w, i) => ({
      order: i, form: w, lemma: w, pos: "", posColor: "", grammarLabel: "", roleLabel: "",
    }));
    return {
      id: `local_${idx + 1}`,
      sequenceId: "local",
      sequenceOrder: idx + 1,
      russian: ru || "",
      stressMarked: tokens.join(" "),
      chinese: zh || "",
      action: "", grammarNote: "", newElement: "",
      words: ws,
      acceptableAnswers: [{ wordOrder: tokens.map((_, i) => i), wordVariants: {}, isDefault: true, note: "" }],
    };
  };

  // 无词表：退回「全部句子渐进」（一句话一题）
  if (!words.length) {
    const units = sentences.map((st, idx) => buildUnit(st.ru, st.zh, idx));
    return [{
      id: "local", name: lesson.title || "本课", familyName: lesson.title || "本课",
      units, totalUnits: units.length, fullSentence: "",
    }];
  }

  // 词 ↔ 句子匹配：句子分词后 token 与词相同、或以词开头（覆盖 дома→дом 等词形变化）
  const normTok = (t) => String(t).toLowerCase().replace(/[.,!?;:«»"']/g, "");
  const matchedByWord = words.map(w => {
    const wl = String(w.ru).toLowerCase();
    const idxs = [];
    sentences.forEach((s, si) => {
      const toks = String(s.ru).toLowerCase().split(/\s+/).map(normTok).filter(Boolean);
      const hit = wl.length >= 3
        ? toks.some(t => t === wl || t.startsWith(wl) || wl.startsWith(t))
        : toks.some(t => t === wl); // 短词（я/ты/в/на/и/а）精确匹配，避免抢走长句
      if (hit) idxs.push(si);
    });
    return { w, idxs }; // idxs 按渐进顺序
  });

  const units = [];
  const assigned = new Set();
  let uid = 0;
  const MAX_PER_WORD = 3;
  const MIN_PER_WORD = 2;

  // 第一轮：每词 拼写题 + 2~3 句（短、中、长梯度）
  for (const { w, idxs } of matchedByWord) {
    uid += 1;
    units.push({ ...buildUnit(w.ru, w.zh, uid - 1), spellWord: true, spellTotal: words.length });
    const avail = idxs.filter(i => !assigned.has(i));
    if (!avail.length) continue;
    const pick = [];
    if (avail[0] !== undefined) pick.push(avail[0]);               // 最短（渐进首位）
    if (avail.length > 1) pick.push(avail[avail.length - 1]);      // 最长（渐进末位）
    if (avail.length > 2 && pick.length < MAX_PER_WORD) {
      const mid = avail[Math.floor(avail.length / 2)];
      if (!pick.includes(mid)) pick.push(mid);                      // 中段
    }
    for (const si of pick) {
      if (!assigned.has(si)) {
        assigned.add(si);
        uid += 1;
        units.push(buildUnit(sentences[si].ru, sentences[si].zh, uid - 1));
      }
    }
  }

  // 第二、三轮：未分配的句子按渐进顺序继续补（生词少的课多配、梯度更满）
  let leftovers = sentences.map((_, i) => i).filter(i => !assigned.has(i));
  let pass = 0;
  while (leftovers.length && pass < 3) {
    pass += 1;
    for (const { w } of matchedByWord) {
      if (!leftovers.length) break;
      const myCount = units.filter(u => u.words.length === 1 && !u.spellWord && u.russian === w.ru).length;
      if (myCount >= MAX_PER_WORD + 1) continue;
      const si = leftovers[0];
      assigned.add(si);
      leftovers.shift();
      uid += 1;
      units.push(buildUnit(sentences[si].ru, sentences[si].zh, uid - 1));
    }
  }

  return [{
    id: "local",
    name: lesson.title || "本课",
    familyName: lesson.title || "本课",
    units,
    totalUnits: units.length,
    fullSentence: "",
  }];
}

export default function QuestPractice() {
  const navigate = useNavigate();
  const { courseId } = useParams();
  const effectiveCourseId = courseId || DEFAULT_UNIT_ID;

  // ---- 课程数据（按 sequence 分组）----
  const [sequences, setSequences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [currentSequenceIndex, setCurrentSequenceIndex] = useState(0);
  const [currentUnitIndex, setCurrentUnitIndex] = useState(0);
  const [unitMeta, setUnitMeta] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  // ---- 本地投稿课程模式（?src=local + sessionStorage 里的 lesson）----
  const [localLesson, setLocalLesson] = useState(null);
  const [isLocalMode, setIsLocalMode] = useState(false);

  // ---- 计时器 ----
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);

  // ---- 后端返回的错误详情（传给 QuestionInput 显示 suggestion）----
  const [currentErrors, setCurrentErrors] = useState([]);

  // ---- 答对提示 ----
  const [showCorrect, setShowCorrect] = useState(false);
  const [showAnswerPanel, setShowAnswerPanel] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackKey, setFeedbackKey] = useState(0); // 每次答对递增，强制触发音效

  // ---- 游戏化统计（抽离到独立 Hook）----
  const {
    combo,
    maxCombo,
    correctCount,
    comboEffect,
    feedbackType,
    levelCombo,
    recordCorrect,
    recordWrong,
    resetStats,
    getAccuracy,
    getGrade,
  } = useGameStats();

  // ---- 当前题目计算（双层索引）----
  const currentSequence = sequences[currentSequenceIndex];
  const currentStatement = currentSequence?.units?.[currentUnitIndex];
  // 已完成的单词拼写数（用于词进度提示）
  const spellDoneCount = sequences
    .slice(0, currentSequenceIndex)
    .reduce((n, s) => n + (s.units || []).filter(u => u.spellWord).length, 0)
    + (currentSequence?.units || []).slice(0, currentUnitIndex).filter(u => u.spellWord).length;
  const totalUnits = sequences.reduce((sum, s) => sum + (s.totalUnits || s.units?.length || 0), 0);
  const currentGlobalUnitIndex = sequences.slice(0, currentSequenceIndex).reduce((sum, s) => sum + (s.totalUnits || s.units?.length || 0), 0) + currentUnitIndex;
  const isLastUnit = currentSequenceIndex === sequences.length - 1 && currentUnitIndex === (currentSequence?.units?.length || 1) - 1;

  const inputRef = useRef(null);

  // ---- 全局快捷键 ----
  const { isComposingRef } = useKeyboardShortcuts({
    onSound: () => playSentenceSound(),
    onShowAnswer: () => {
      setShowAnswer((v) => !v);
      markHintUsed?.();
    },
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
    isJudging,
    handleChange,
    isFixMode,
    isFixInputMode,
    reset,
    submitAnswer,
    markHintUsed,
    handleInputKeyDown: _rawHandleInputKeyDown,
  } = useQuestionInput({
    answerText: currentStatement?.russian || "",
    statementId: currentStatement?.id || "",
    apiBaseUrl: API_BASE,
    inputRef,
    isComposingRef,
    onCorrect: (result, resultType) => {
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

  // ---- 监听连击变化，自动显示反馈弹窗 ----
  useEffect(() => {
    if (combo > 0) {
      setFeedbackKey((k) => k + 1); // 每次答对递增，强制触发音效
      setShowFeedback(true);
    }
  }, [combo]);

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

  // ---- 加载单元的渐进构建步骤（按 family 分组，带冷启动重试）----
  useEffect(() => {
    ensureTypingSound();
    let cancelled = false;
    async function fetchJsonRetry(url, tries = 4) {
      let last = null;
      for (let i = 0; i < tries; i++) {
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error("HTTP " + res.status);
          const json = await res.json();
          if (json.ok && json.data) return json.data;
          throw new Error(json.error || "数据格式异常");
        } catch (e) {
          last = e;
          await new Promise((r) => setTimeout(r, 900 * (i + 1)));
        }
      }
      throw last || new Error("网络错误");
    }
    async function loadUnit() {
      setLoading(true);
      setLoadError(null);
      // 本地投稿课程：直接消费课时数据（单词 + 渐进例句），不依赖后端
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
            const adapted = adaptLocalLesson(stored);
            if (!cancelled) {
              setLocalLesson(stored);
              setIsLocalMode(true);
              setUnitMeta({ title: stored.title || stored.name || "本课", description: stored.description || "" });
              setSequences(adapted);
              setCurrentSequenceIndex(0);
              setCurrentUnitIndex(0);
            }
            if (!cancelled) setLoading(false);
            return;
          }
          // 本地标记但无数据 → 清标记走 API 兜底
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
                  const adapted = adaptLocalLesson(u)
                  if (!cancelled) {
                    setLocalLesson(u)
                    setIsLocalMode(true)
                    setUnitMeta({ title: u.title || u.name || "本课", description: u.description || "" })
                    setSequences(adapted)
                    setCurrentSequenceIndex(0)
                    setCurrentUnitIndex(0)
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
        const data = await fetchJsonRetry(
          `${API_BASE}/api/units/${effectiveCourseId}/build-steps`
        );
        const adapted = adaptBuildSteps(data);
        if (!cancelled) {
          if (adapted.length === 0) {
            setLoadError("该单元没有可学习的步骤");
          } else {
            setUnitMeta(data.unit || null);
            setSequences(adapted);
            setCurrentSequenceIndex(0);
            setCurrentUnitIndex(0);
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
    loadUnit();
    return () => { cancelled = true; };
  }, [effectiveCourseId, reloadKey]);

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
  }, [loading, loadError, currentSequenceIndex, currentUnitIndex, currentStatement]);

  // ---- 跳转下一题（双层索引：先unit后sequence）----
  const goToNext = useCallback(() => {
    const seq = sequences[currentSequenceIndex];
    const unitsLen = seq?.units?.length || 1;
    if (currentUnitIndex < unitsLen - 1) {
      // 同 sequence 内下一个 unit
      setCurrentUnitIndex((i) => i + 1);
      setCurrentErrors([]);
      setShowAnswer(false);
    } else if (currentSequenceIndex < sequences.length - 1) {
      // 进入下一个 sequence 的 unit 1
      setCurrentSequenceIndex((i) => i + 1);
      setCurrentUnitIndex(0);
      setCurrentErrors([]);
      setShowAnswer(false);
    } else {
      // 全部完成，显示结算页
      setShowSummary(true);
    }
  }, [currentSequenceIndex, currentUnitIndex, sequences]);

  // ---- 发音（Yandex 真人俄语发音）----
  const ttsAudioRef = useRef(null);
  const playSentenceSound = useCallback(async (times = 1) => {
    const stmt = currentStatement;
    if (!stmt?.russian) return;
    try {
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause();
        ttsAudioRef.current.currentTime = 0;
      }
      let url = stmt.audio_url;
      if (!url) {
        const res = await fetch(`${API_BASE}/api/tts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: stmt.russian, voice: "alena", id: stmt.id, type: "statement" }),
        });
        const data = await res.json();
        if (data.ok && data.audio_url) {
          url = data.audio_url.startsWith("http") ? data.audio_url : `${API_BASE}${data.audio_url}`;
        }
      } else if (!url.startsWith("http")) {
        url = `${API_BASE}${url}`;
      }
      if (url) {
        const playOnce = (remaining) => {
          const audio = new Audio(url);
          ttsAudioRef.current = audio;
          audio.play().catch((e) => console.warn("播放失败:", e));
          if (remaining > 1) {
            audio.onended = () => {
              setTimeout(() => playOnce(remaining - 1), 600);
            };
          }
        };
        playOnce(times);
      }
    } catch (e) {
      console.warn("发音失败:", e);
    }
  }, [currentStatement]);

  // ---- 题目出现时自动播放两遍发音 ----
  useEffect(() => {
    if (!loading && !loadError && currentStatement) {
      const timer = setTimeout(() => playSentenceSound(2), 500);
      return () => clearTimeout(timer);
    }
  }, [loading, loadError, currentSequenceIndex, currentUnitIndex, currentStatement, playSentenceSound]);

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
    setCurrentSequenceIndex(0);
    setCurrentUnitIndex(0);
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
        <div style={{ ...styles.loading, flexDirection: "column", gap: 16 }}>
          <style>{"@keyframes qp-spin{to{transform:rotate(360deg)}}"}</style>
          <div style={{ width: 38, height: 38, borderRadius: "50%", border: "3px solid oklch(95% 0.0081 61.42)", borderTopColor: "oklch(23.27% 0.0249 284.3)", animation: "qp-spin .8s linear infinite" }} />
          <span>正在加载课程…</span>
        </div>
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
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button style={{ ...styles.primaryBtn, background: "#fff", color: "oklch(18% 0.0249 284.3)", border: "1px solid #D4CCC0" }} onClick={() => setReloadKey((k) => k + 1)}>
              重新加载
            </button>
            <button style={styles.primaryBtn} onClick={() => navigate(-1)}>
              返回
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        ...styles.page,
        animation: comboEffect === "shake" ? "quest-shake 0.4s ease-in-out" : "none",
        boxShadow: comboEffect?.startsWith("milestone") || comboEffect?.startsWith("levelup")
          ? `inset 0 0 80px ${combo >= 20 ? "rgba(245,158,11,0.4)" : combo >= 10 ? "rgba(99,102,241,0.35)" : "rgba(59,130,246,0.3)"}`
          : "none",
        background: "#FFFFFF",
        backgroundImage: combo >= 9
          ? `radial-gradient(ellipse at center, rgba(245,158,11,${0.05 + Math.min(combo, 30) * 0.005}) 0%, transparent 70%)`
          : combo >= 6
          ? `radial-gradient(ellipse at center, rgba(34,197,94,${0.03 + Math.min(combo, 15) * 0.004}) 0%, transparent 70%)`
          : "none",
        transition: "box-shadow 0.3s ease, background 0.5s ease",
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
          <div style={{ fontSize: 20, fontWeight: 600, color: "#059669" }}>正确</div>
        </div>
      )}

      {/* 顶部工具栏 */}
      <div style={styles.toolbar}>
        <button style={styles.iconBtn} onClick={() => navigate(-1)} title="返回">
          ←
        </button>
        <ModeTabs currentMode="practice" courseId={effectiveCourseId} />
        <div style={styles.progress}>
          {unitMeta?.title || "练习"} ({currentSequenceIndex + 1}/{sequences.length})
        </div>
        {/* Combo 连击显示 */}
        {combo > 0 && (
          <div
            style={{
              ...styles.comboBadge,
              color: combo >= 20 ? "#E11D48" : combo >= 10 ? "#EA580C" : combo >= 5 ? "#F59E0B" : "oklch(23.27% 0.0249 284.3)",
              animation: combo >= 5 ? "combo-pulse 0.6s ease infinite" : "none",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 50 }}>Combo</span>
            <span style={{ fontSize: 20, fontWeight: 800, marginLeft: 4 }}>×{combo}</span>
          </div>
        )}
        <div style={styles.timer}>{formatTime(elapsed)}</div>
        <button style={styles.iconBtn} title="设置">
          ⚙
        </button>
      </div>

      {/* 全局进度条 */}
      <div style={styles.progressBarBg}>
        <div
          style={{
            ...styles.progressBarFill,
            width: `${((currentGlobalUnitIndex + 1) / totalUnits) * 100}%`,
          }}
        />
      </div>

      {/* 家族内进度：家族名 + 步骤 x/y */}
      <div style={styles.familyBar}>
        <span style={styles.familyName}>{currentSequence?.familyName || ""}</span>
        <span style={styles.familyStep}>
          步骤 {currentUnitIndex + 1}/{currentSequence?.units?.length || 0}
        </span>
      </div>

      {/* 本地投稿课程：当前词进度提示（词拼写题时显示；不直接展示全部词表，词需打字拼写） */}
      {isLocalMode && !loading && !loadError && currentStatement?.spellWord && (
        <div style={{ margin: '14px 18px 0', padding: '12px 16px', borderRadius: 14, background: '#F5F3FF', border: '1px solid #EDE9FE' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#5b21b6' }}>
            ✏️ 单词拼写 {spellDoneCount + 1}/{currentStatement.spellTotal || (localLesson?.words?.length || 0)}
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: '#7c3aed' }}>
            看中文释义打出俄语单词，打对后进入该词的渐进句
          </div>
        </div>
      )}

      {/* 主内容区 */}
      <div style={styles.mainContent}>

        {/* 答对详情页 */}
        {showAnswerPanel ? (
          <AnswerPanel
            statement={currentStatement}
            onRetry={handleRetry}
            onNext={handleNextFromAnswer}
            isLast={isLastUnit}
          />
        ) : (
        <>
        {/* 中文释义 */}
        <div style={styles.hintCard}>
          <div style={styles.hintText}>{currentStatement?.chinese}</div>
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
          isJudging={isJudging}
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
            <span style={{ color: "#E11D48" }}>
              按任意键开始修正错误词
            </span>
          )}
          {isFixInputMode && (
            <span style={{ color: "#EA580C" }}>
              修正当前词 · 空格跳下一个错词 · Backspace 回退
            </span>
          )}
          {!isFixMode && !isFixInputMode && (
            <span style={{ color: "#A1A1AA" }}>
              Enter 提交 · Ctrl+' 发音 · Ctrl+; 看答案
            </span>
          )}
        </div>
        </>
        )}
      </div>

      {/* 底部快捷键提示栏 */}
      <ShortcutTips
        mode={showAnswerPanel ? "answer" : "question"}
        inputRef={inputRef}
        onSubmit={submitAnswer}
        onNext={handleNextFromAnswer}
        onRetry={handleRetry}
        onPlaySound={playSentenceSound}
        onShowAnswer={() => setShowAnswer((v) => !v)}
      />

      {/* 四级反馈弹窗 */}
      <FeedbackPopup
        type={feedbackType || "good"}
        comboNumber={levelCombo}
        totalCombo={combo}
        visible={showFeedback}
        feedbackKey={feedbackKey}
        isMilestone={[5, 10, 20, 50].includes(combo)}
        onDone={() => setShowFeedback(false)}
      />

      {/* 结算页弹窗 */}
      <SummaryPanel
        visible={showSummary}
        onShow={() => {}}
        totalQuestions={totalUnits}
        totalTime={elapsed}
        accuracy={getAccuracy(totalUnits)}
        maxCombo={maxCombo}
        grade={getGrade(totalUnits)}
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
    backgroundImage: "none",
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
  timer: {
    fontSize: 15,
    fontWeight: 500,
    color: "#6B7280",
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
    background: "#E5E7EB",
  },
  progressBarFill: {
    height: "100%",
    background: "linear-gradient(90deg, oklch(23.27% 0.0249 284.3), oklch(18% 0.0249 284.3))",
    transition: "width 0.3s ease",
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

  hintCard: {
    width: "100%",
    textAlign: "center",
    marginBottom: 32,
  },
  hintLabel: {
    display: "none",
  },
  hintText: {
    fontSize: "2.5rem",
    fontWeight: 700,
    fontFamily: '"Nunito", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    color: "#18181B",
    lineHeight: 1.3,
  },
  grammarNote: {
    marginTop: 10,
    fontSize: 13,
    color: "oklch(18% 0.0249 284.3)",
    background: "oklch(95% 0.0081 61.42)",
    padding: "8px 14px",
    borderRadius: 8,
    display: "inline-block",
  },
  answerReveal: {
    marginTop: 12,
    fontSize: 16,
    color: "#059669",
    fontWeight: 500,
  },
  inputCard: {
    width: "100%",
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
    background: "linear-gradient(135deg, oklch(23.27% 0.0249 284.3), oklch(18% 0.0249 284.3))",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 500,
    cursor: "pointer",
    transition: "transform 0.2s, box-shadow 0.2s",
  },
};
