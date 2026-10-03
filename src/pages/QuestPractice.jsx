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

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { checkUnitAccess } from "../lib/courseAccess";
import { findLocalUnitById } from "../utils/storage";
import { apiFetch } from "../lib/api";
import { markUnitDone } from "../lib/lessonProgress";
import { touchSync } from "../lib/cloudProgress";
import { addStudyTime } from "../lib/learningStats";
import { getCourseById } from "../utils/courseService";
import { recordPeak, addDailyExp, recordCase } from "../lib/questStats";
import { analyzeSentence } from "../lib/ai";
import { ensureDictFull, annotateWords, warmUpIndex } from "../lib/wordAnnotate";
import { inferRoles } from "../lib/roleRules";
import { expandSequencesWithChunks } from "../lib/chunking";
import { scaffoldingToSequences, filterSequencesByDifficulty } from "../lib/scaffolding";
import { getCachedTtsUrl, getCachedTtsAudio, getCachedLesson } from "../utils/ttsPreloadShared";
import { useQuestionInput } from "../hooks/useQuestionInput";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useGameStats } from "../hooks/useGameStats";
import QuestionInput from "../components/quest/QuestionInput";
import { getPosColor } from "../constants/posColors";
import AnswerPanel from "../components/quest/AnswerPanel";
import SummaryPanel from "../components/quest/SummaryPanel";
import ModePickerModal, { COURSE_MODES } from "../components/ModePickerModal";
import WukongAiAssistant from "../components/quest/WukongAiAssistant";
import SettingsModal from "../components/SettingsModal";
import Icon from "../components/TopBarIcons";
import LearningContentModal from "../components/LearningContentModal";
import SentenceTreeModal from "../components/SentenceTreeModal";
import ReportErrorModal from "../components/ReportErrorModal";
import ShortcutTips from "../components/quest/ShortcutTips";
import FeedbackPopup from "../components/quest/FeedbackPopup";
import ExitConfirmModal from "../components/quest/ExitConfirmModal";
;
import { playTypingSound, playRightSound, playErrorSound, ensureTypingSound, checkPlayTypingSound } from "../lib/questSounds";
import { preloadTtsAll } from "../lib/ttsPreload";
import { playGlobalAudio, stopGlobalAudio, preloadGlobalAudio } from "../utils/audioService";
import { useQuestSettings, BG_STYLE, THEME_OF } from "../hooks/useQuestSettings";

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
  // 优先：后台固定的滚雪球步骤（scaffoldingPaths）→ 直接按步骤出题（不再现切 chunking）
  if (Array.isArray(lesson.scaffoldingPaths) && lesson.scaffoldingPaths.length) {
    return scaffoldingToSequences(lesson.scaffoldingPaths, lesson.title || "本课");
  }
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
  const [ttsProgress, setTtsProgress] = useState(null); // { done, total } 进页前发音预载进度
  const [loadError, setLoadError] = useState(null);
  const [currentSequenceIndex, setCurrentSequenceIndex] = useState(0);
  const [currentUnitIndex, setCurrentUnitIndex] = useState(0);
  const [unitMeta, setUnitMeta] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showExit, setShowExit] = useState(false);
  const { ui, sfx, settings, refreshSettings } = useQuestSettings();
  const [showModePicker, setShowModePicker] = useState(false);
  const [isPaused, setIsPaused] = useState(false)
  const [audioBlocked, setAudioBlocked] = useState(false)   // 自动播放策略拦截提示（点亮后提示用户点击屏幕激活）;
  const [showAnswerMode, setShowAnswerMode] = useState(false);
  const [showLearning, setShowLearning] = useState(false);
  const [showTree, setShowTree] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [shuffled, setShuffled] = useState(false);
  const originalSeqRef = useRef(null);
  const [hint, setHint] = useState(null);
  const hintTimerRef = useRef(null);
  // ---- 本地投稿课程模式（?src=local + sessionStorage 里的 lesson）----
  const sessionStartRef = useRef(Date.now()); // 学习时长统计起点
  // 学习时长归属课程：优先取 URL 上 ?courseId=（详情页跳转带入），否则用单元 ID
  const studyCourseId = (() => { try { return new URLSearchParams(window.location.search).get('courseId') || effectiveCourseId } catch (e) { return effectiveCourseId } })()
  // 离开学习页时累计本次学习时长（含完成）
  useEffect(() => {
    return () => {
      const mins = Math.max(1, Math.round((Date.now() - sessionStartRef.current) / 60000)) // 不足 1 分钟按 1 分钟计（EXP 世界观：1 分钟 = 1 EXP）
      addStudyTime(studyCourseId, Date.now() - sessionStartRef.current)
      addDailyExp(mins, '中译俄')
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
  const [wrongStreak, setWrongStreak] = useState(0); // 连续答错次数（悟空主动求助）

  // ---- 难度（URL 传入；切换模式时经预加载页透传） = 出题粒度过滤 ----
  const [diffKey, setDiffKey] = useState(() => {
    try { return new URLSearchParams(window.location.search).get("difficulty") || "beginner" } catch (e) { return "beginner" }
  });
  const [customTypes, setCustomTypes] = useState(() => {
    try {
      const c = new URLSearchParams(window.location.search).get("custom");
      return c ? c.split(",").filter(Boolean) : [];
    } catch (e) { return [] }
  });
  const diffKeyRef = useRef(diffKey); diffKeyRef.current = diffKey;
  const customRef = useRef(customTypes); customRef.current = customTypes;
  const rawSequencesRef = useRef([]); // 过滤前的原始 sequences（切难度时重新过滤，不从 0 重下数据）
  const applyDiff = (seqs) => {
    rawSequencesRef.current = seqs;
    return filterSequencesByDifficulty(seqs, diffKeyRef.current, customRef.current);
  };

  // ---- 难度切换 → 重新过滤 + 从第 0 题开始（对标句乐部：选难度即重新开始） ----
  useEffect(() => {
    const raw = rawSequencesRef.current;
    if (!raw.length) return;
    setSequences(filterSequencesByDifficulty(raw, diffKey, customTypes));
    setCurrentSequenceIndex(0);
    setCurrentUnitIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diffKey, customTypes]);

  // ---- 学习进度持久化（退出重进继续上次；同难度才恢复，切难度则从头） ----
  const progKey = () => `qs_progress_practice_${effectiveCourseId}`;
  useEffect(() => {
    if (loading || loadError || !sequences.length) return;
    try {
      const saved = JSON.parse(localStorage.getItem(progKey()) || "null");
      if (saved && saved.difficulty === diffKey && saved.seqIndex !== undefined) {
        const si = Math.min(saved.seqIndex, sequences.length - 1);
        const seq = sequences[si];
        const ui = seq ? Math.min(saved.unitIndex ?? 0, (seq.units || []).length - 1) : 0;
        setCurrentSequenceIndex(si); setCurrentUnitIndex(ui);
      }
    } catch (e) { /* 缓存损坏则从头 */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, loadError, sequences.length]);
  useEffect(() => {
    if (loading || !sequences.length) return;
    try {
      localStorage.setItem(progKey(), JSON.stringify({ seqIndex: currentSequenceIndex, unitIndex: currentUnitIndex, difficulty: diffKey, custom: customTypes, ts: Date.now() }));
      touchSync();
    } catch (e) { /* 忽略 */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, currentSequenceIndex, currentUnitIndex, sequences.length]);

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

  // ---- 悟空 AI 助手：模式中文名（按 URL mode 参数映射）----
  const aiModeLabel = useMemo(() => {
    const k = new URLSearchParams(window.location.search).get('mode') || 'chinese_to_english';
    return ({ chinese_to_english: '中译俄', dictation: '听写', listening: '听力', speaking: '口语评测' })[k] || '练习';
  }, []);

  // ---- 答对后按需精析：词典标注（词性颜色/重音/性数格，本地确定性） + AI 补充（成分/翻译/语法） ----
  const [analysisCache, setAnalysisCache] = useState({});
  const patchWords = useCallback((key, getWs) => {
    setSequences(seqs => seqs.map((s, si) => {
      if (si !== currentSequenceIndex) return s;
      return {
        ...s,
        units: (s.units || []).map((u, ui) => {
          if (ui !== currentUnitIndex || String(u.russian || "").trim() !== key) return u;
          const oldWs = Array.isArray(u.words) ? u.words : [];
          const ws = getWs(oldWs);
          return { ...u, words: ws, stressMarked: ws.map(x => x.form).filter(Boolean).join(" ") };
        }),
      };
    }));
  }, [currentSequenceIndex, currentUnitIndex]);

  const ensureAnalysis = useCallback(async (stmt) => {
    if (!stmt || stmt.spellWord || !stmt.russian) return;
    const key = String(stmt.russian).trim();
    // 纯本地确定性标注：词典（重音/词性/性数格）+ 形态规则引擎（句子成分），即时完成，不依赖 AI
    await ensureDictFull();
    const dictWords = annotateWords(stmt.russian);
    if (dictWords.length) {
      const roleWords = inferRoles(stmt.russian, dictWords);
      patchWords(key, (oldWs) => roleWords.map((w, i) => {
        const oldW = oldWs[i] || {};
        return { ...oldW, ...w, order: i, roleLabel: w.roleLabel || oldW.roleLabel || "", chinese: w.chinese || oldW.chinese || oldW.zh || "" };
      }));
    }
  }, [patchWords]);

  const applyAI = useCallback((key, res) => {
    patchWords(key, (oldWs) => {
      const roleMap = {};
      (res.components || []).forEach(c => {
        const t = String(c.text || "").trim().toLowerCase();
        if (t && !roleMap[t]) roleMap[t] = c.role || "";
      });
      return oldWs.map((w, i) => {
        const aiW = (res.words && res.words[i]) || {};
        return {
          ...w,
          roleLabel: roleMap[String(w.lemma || aiW.word || "").trim().toLowerCase()] || w.roleLabel || "",
          chinese: w.chinese || aiW.mean || "",
          translation: res.translation || "",
          grammar: res.grammar || "",
        };
      });
    });
  }, [patchWords]);
  const totalUnits = sequences.reduce((sum, s) => sum + (s.totalUnits || s.units?.length || 0), 0);
  const currentGlobalUnitIndex = sequences.slice(0, currentSequenceIndex).reduce((sum, s) => sum + (s.totalUnits || s.units?.length || 0), 0) + currentUnitIndex;
  const isLastUnit = currentSequenceIndex === sequences.length - 1 && currentUnitIndex === (currentSequence?.units?.length || 1) - 1;

  const inputRef = useRef(null);

  // ---- 全局快捷键 ----
  const { isComposingRef } = useKeyboardShortcuts({
    onSound: () => playSentenceSound(), // 题目显示什么发音读什么（当前 step 的 russian）
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
      setWrongStreak(0); // 答对清零连续答错计数（悟空主动求助逻辑）
      // Chunking：每一步答对都显示答对面板（含中间步），用户点「下一题」进入下一步
      setShowAnswerPanel(true);
      recordCorrect();
      if (sfx.answerOn !== false) playRightSound();
      ensureAnalysis(currentStatement);
      // 通关之路：六格天赋树（答对当前句，句中各词的格 → 正确+1）
      if (Array.isArray(currentStatement?.words)) {
        if (grammarOnRef.current) currentStatement.words.forEach((w) => { if (w && w.grammar_case) recordCase(w.grammar_case, true) })
      }
    },
    onWrong: (result) => {
      setCurrentErrors(result.errors || []);
      setWrongStreak((s) => s + 1); // 答错累计连续答错（悟空主动求助逻辑）
      recordWrong();
      if (sfx.answerOn !== false) playErrorSound();
      // 通关之路：六格天赋树（答错 → 该句各词格的答题数+1，不计正确）
      if (Array.isArray(currentStatement?.words)) {
        if (grammarOnRef.current) currentStatement.words.forEach((w) => { if (w && w.grammar_case) recordCase(w.grammar_case, false) })
      }
    },
  });

  // 包装键盘事件：播放打字音
  const handleInputKeyDown = (e) => {
    if (checkPlayTypingSound(e) && sfx.keyOn !== false) {
      playTypingSound();
    }
    _rawHandleInputKeyDown(e);
  };

  // ---- 巅峰连斩：本局最高连击写入通关之路 ----
  useEffect(() => {
    if (maxCombo > 0) recordPeak({ maxCombo })
  }, [maxCombo])

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
      // 预加载页已预载课时数据（后端 build-steps 原始数据 或 本地 lesson）→ 无遮罩直接消费
      try {
        const pre = getCachedLesson(effectiveCourseId);
        if (pre) {
          if (pre.families) {
            const adapted = adaptBuildSteps(pre);
            if (!cancelled) {
              setUnitMeta(pre.unit || null);
              const cloudWords = adapted.flatMap((sq) => (sq.units || []).flatMap((u) => (u.words || []).map((w) => ({ ru: w.lemma || w.word || w.ru || "", zh: w.zh || w.chinese || w.mean || "" }))));
              const seqs = expandSequencesWithChunks(adapted, cloudWords);
              setSequences(applyDiff(seqs)); setCurrentSequenceIndex(0); setCurrentUnitIndex(0);
              setLoading(false);
            }
            return;
          }
          if ((Array.isArray(pre.sentences) && pre.sentences.length) || (Array.isArray(pre.scaffoldingPaths) && pre.scaffoldingPaths.length)) {
            const adapted = adaptLocalLesson(pre);
            if (!cancelled) {
              setLocalLesson(pre); setIsLocalMode(true);
              window.__unitKnowledge = window.__unitKnowledge || {};
              window.__unitKnowledge[effectiveCourseId] = (pre && pre.knowledge) || {};
              setUnitMeta({ title: pre.title || pre.name || "本课", description: pre.description || "" });
              const seqs = expandSequencesWithChunks(adapted, pre?.words);
              setSequences(applyDiff(seqs)); setCurrentSequenceIndex(0); setCurrentUnitIndex(0);
              setLoading(false);
            }
            return;
          }
        }
      } catch (e) { /* 缓存不可用 → 走原逻辑 */ }

      // 本地投稿课程：直接消费课时数据（单词 + 渐进例句），不依赖后端
      // 数据源：① sessionStorage（投稿链路写入）→ ② 本地课程库（后台课时，持久化兜底）
      try {
        const isLocal = new URLSearchParams(window.location.search).get("src") === "local";
        const isBackendUnit = String(effectiveCourseId).startsWith("unit_");
        if (isLocal || isBackendUnit) {
          let stored = null
          try { stored = JSON.parse(sessionStorage.getItem("rlearn_local_lesson_" + effectiveCourseId) || "null") } catch (e) { stored = null }
          if (!(stored && ((Array.isArray(stored.sentences) && stored.sentences.length) || (Array.isArray(stored.scaffoldingPaths) && stored.scaffoldingPaths.length)))) {
            stored = findLocalUnitById(effectiveCourseId)
          }
          if (stored && ((Array.isArray(stored.sentences) && stored.sentences.length) || (Array.isArray(stored.scaffoldingPaths) && stored.scaffoldingPaths.length))) {
            const adapted = adaptLocalLesson(stored);
            if (!cancelled) {
              setLocalLesson(stored);
              setIsLocalMode(true);
              window.__unitKnowledge = window.__unitKnowledge || {};
              window.__unitKnowledge[effectiveCourseId] = (stored && stored.knowledge) || {};
              setUnitMeta({ title: stored.title || stored.name || "本课", description: stored.description || "" });
              const seqs = expandSequencesWithChunks(adapted, stored?.words);
              setSequences(applyDiff(seqs));
              setCurrentSequenceIndex(0);
              setCurrentUnitIndex(0);
              if (!cancelled) setLoading(false);
            }
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
                if (u && ((Array.isArray(u.sentences) && u.sentences.length) || (Array.isArray(u.scaffoldingPaths) && u.scaffoldingPaths.length))) {
                  const adapted = adaptLocalLesson(u)
                  if (!cancelled) {
                    setLocalLesson(u)
                    setIsLocalMode(true)
                    setUnitMeta({ title: u.title || u.name || "本课", description: u.description || "" })
                    const seqs = expandSequencesWithChunks(adapted, u?.words)
                    setSequences(applyDiff(seqs))
                    setCurrentSequenceIndex(0)
                    setCurrentUnitIndex(0)
                    if (!cancelled) setLoading(false);
                  }
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
            if (!cancelled) setLoading(false);
          } else {
            setUnitMeta(data.unit || null);
            // 云端词表：从各句 words 提取 {ru, zh}，供 chunking 块中文翻译（缺词不再兜底俄语）
            const cloudWords = adapted.flatMap((sq) => (sq.units || []).flatMap((u) => (u.words || []).map((w) => ({ ru: w.lemma || w.word || w.ru || "", zh: w.zh || w.chinese || w.mean || "" }))));
            const seqs = expandSequencesWithChunks(adapted, cloudWords);
            setSequences(applyDiff(seqs));
            setCurrentSequenceIndex(0);
            setCurrentUnitIndex(0);
            if (!cancelled) setLoading(false);
          }
        }
      } catch (e) {
        if (!cancelled) {
          // 默认兜底单元也加载失败 → 去课程列表选课，不留在 404 页
          if (!courseId) { navigate('/quest-store', { replace: true }); return; }
          setLoadError(`无法连接后端: ${e.message}`);
          setLoading(false);
        }
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

  // ---- 数据就绪后后台预分析：逐句词典+AI 标注（并发 4），答对时重音/词性/成分已就绪 ----
  const preAnalysisStartedRef = useRef(false);
  useEffect(() => {
    if (loading || loadError || !sequences.length || preAnalysisStartedRef.current) return;
    preAnalysisStartedRef.current = true;
    const all = sequences.flatMap((sq) => (sq.units || [])).filter((u) => u && u.russian);
    let i = 0;
    const worker = async () => {
      while (i < all.length) {
        const idx = i++;
        const u = all[idx];
        try { await ensureAnalysis(u); } catch (e) { /* 单句失败不影响答题 */ }
      }
    };
    Array.from({ length: 4 }).forEach(() => worker());
  }, [loading, loadError, sequences.length, ensureAnalysis]);

  // ---- 数据就绪后后台全量预载发音（并发 10，不阻塞进页；Preloader 覆盖首屏 20 句之外也秒播） ----
  // preloadUnit 定义在后（724 行），依赖数组渲染期求值会 TDZ → 用 ref 间接引用
  const preloadUnitRef = useRef(null);
  const preloadStartedRef = useRef(false);
  useEffect(() => {
    if (loading || loadError || !sequences.length || preloadStartedRef.current) return;
    preloadStartedRef.current = true;
    preloadUnitRef.current(sequences);
  }, [loading, loadError, sequences.length, preloadUnitRef]);

  // ---- 自动聚焦输入框 ----
  useEffect(() => {
    if (!loading && !loadError && currentStatement) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [loading, loadError, currentSequenceIndex, currentUnitIndex, currentStatement]);

  // ---- 预加载全词典 + 构建词形索引（后台预热，答对时标注即时生效）----
  useEffect(() => {
    if (!loading && !loadError && sequences.length) {
      // 立即预热全词典 + 构建词形索引（25MB 静态资源，浏览器缓存；答对时重音/性数格即时可标注）
      ensureDictFull().then(() => warmUpIndex());
    }
  }, [loading, loadError, sequences.length]);

  // ---- 跳转下一题（双层索引：先unit后sequence）----
  // ensureTtsAudio 定义在后（691 行），goToNext 依赖数组渲染期求值会 TDZ → 用 ref 间接引用
  const ensureTtsAudioRef = useRef(null);
  const goToNext = useCallback(() => {
    stopPlayback(); // 切题立即打断发音，避免答对发音带入下一题
    const seq = sequences[currentSequenceIndex];
    const unitsLen = seq?.units?.length || 1;
    let ni = currentSequenceIndex, nu = currentUnitIndex + 1;
    if (currentUnitIndex < unitsLen - 1) {
      // 同 sequence 内下一个 unit
      setCurrentUnitIndex((i) => i + 1);
      setCurrentErrors([]);
      setShowAnswer(false);
    } else if (currentSequenceIndex < sequences.length - 1) {
      // 进入下一个 sequence 的 unit 1
      ni = currentSequenceIndex + 1; nu = 0;
      setCurrentSequenceIndex((i) => i + 1);
      setCurrentUnitIndex(0);
      setCurrentErrors([]);
      setShowAnswer(false);
    } else {
      // 全部完成，显示结算页 —— 记录课时完成（详情页进度打通）
      markUnitDone(effectiveCourseId);
      // 通关之路：单局最高输出（每题 +10 EXP）+ 单局最高命中率
      const totalQ = sequences.reduce((a, seq) => a + ((seq.units && seq.units.length) || 1), 0)
      const acc = totalQ > 0 ? Math.round((correctCount / totalQ) * 100) : 0
      recordPeak({ score: correctCount * 10, accuracy: acc })
      setShowSummary(true);
      return;
    }
    // 后台滚动预载：从下一题起预载后续 12 句音频（并发 6、去重、不阻塞），答快时发音不延迟
    setTimeout(() => {
      const s = sequences[ni];
      if (!s) return;
      const rest = (s.units || []).slice(nu);
      preloadTtsAll(rest, (it) => {
        const e = ensureTtsAudioRef.current(it);
        return e ? e.promise : Promise.resolve();
      }, { concurrency: 6, limit: 12 });
    }, 0);
  }, [currentSequenceIndex, currentUnitIndex, sequences, ensureTtsAudioRef, correctCount, effectiveCourseId]);

  // ---- 发音（Yandex 真人俄语发音）：TTS 缓存 + 即时播放 ----
  const ttsAudioRef = useRef(null);
  const ttsAudioPoolRef = useRef(new Set()); // 所有播放中的 Audio 实例，打断时全部暂停（防旧实例漏停）
  const playTokenRef = useRef(0); // 播放令牌：新播放/切题递增，作废所有在途播放
  const ttsUrlCacheRef = useRef({}); // id -> url，同一句只请求一次
  const ensureTts = useCallback(async (stmt) => {
    if (!stmt || !stmt.russian) return "";
    if (ttsUrlCacheRef.current[stmt.id]) return ttsUrlCacheRef.current[stmt.id];
    // 预加载页已真实生成该句 TTS → 直接复用（免再请求后端）
    const preUrl = getCachedTtsUrl(stmt.russian);
    if (preUrl) { ttsUrlCacheRef.current[stmt.id] = preUrl; return preUrl; }
    let url = stmt.audio_url;
    if (!url) {
      try {
        const res = await fetch(`${API_BASE}/api/tts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: stmt.russian, voice: "alena", id: stmt.id, type: "statement" }),
        });
        const data = await res.json();
        if (data.ok && data.audio_url) {
          url = data.audio_url.startsWith("http") ? data.audio_url : `${API_BASE}${data.audio_url}`;
        }
      } catch (e) { console.warn("TTS 获取失败:", e); }
    } else if (!url.startsWith("http")) {
      url = `${API_BASE}${url}`;
    }
    if (url) ttsUrlCacheRef.current[stmt.id] = url;
    return url;
  }, []);

  // 预载音频内容：拿到 URL 后立即创建 Audio 并等 canplay（内容就绪），播放时秒开
  const ttsAudioCacheRef = useRef({}); // id -> { audio, promise }，同句复用已预载 Audio
  const ensureTtsAudio = useCallback((stmt) => {
    const cid = stmt?.id || stmt?.russian || "";
    if (!cid) return null;
    if (ttsAudioCacheRef.current[cid]) return ttsAudioCacheRef.current[cid];
    // 预加载页已预载内容就绪的 Audio → 直接复用（秒播）
    const preAudio = getCachedTtsAudio(stmt.russian || "");
    if (preAudio) {
      const entry = { audio: preAudio, promise: Promise.resolve() };
      ttsAudioCacheRef.current[cid] = entry;
      return entry;
    }
    const entry = { audio: null, promise: null };
    entry.promise = (async () => {
      try {
        const url = await ensureTts(stmt);
        if (!url) return;
        const audio = new Audio(url);
        audio.preload = "auto";
        await new Promise((res) => {
          audio.addEventListener("canplay", res, { once: true });
          audio.addEventListener("error", res, { once: true });
        });
        entry.audio = audio;
      } catch (e) { /* 预载失败，播放时再兜底 */ }
    })();
    ttsAudioCacheRef.current[cid] = entry;
    return entry;
  }, [ensureTts]);
  ensureTtsAudioRef.current = ensureTtsAudio;

  // 进答题页之前全量预载本单元所有 step 的 russian（单打块 + 累积整句），题目显示什么就预载什么（并发 10，失败不阻塞）
  const preloadUnit = useCallback(async (seqs) => {
    const items = [];
    const seen = new Set();
    (seqs || []).forEach((seq) => {
      (seq.units || []).forEach((u) => {
        if (!u?.russian) return;
        if (!seen.has(u.russian)) { seen.add(u.russian); items.push(u); }
      });
    });
    setTtsProgress({ done: 0, total: items.length });
    await preloadTtsAll(items, async (sq) => {
      const e = ensureTtsAudio(sq);
      if (e) await e.promise;
    }, { concurrency: 10, limit: 100, timeout: 8000, onProgress: (done, total) => setTtsProgress({ done, total }) });
  }, [ensureTtsAudio]);
  preloadUnitRef.current = preloadUnit;

  // 播放竞态保护：callId（最新播放调用编号）+ currentStmtRef（当前题快照）
  const callIdRef = useRef(0);
  const currentStmtRef = useRef(null);
  currentStmtRef.current = currentStatement;

  // 预取当前句音频：题目显示什么就预载什么（当前 step 的 russian），缓存就绪 → 即时播放
  useEffect(() => {
    if (!loading && !loadError && currentStatement) {
      ensureTtsAudio(currentStatement);
    }
  }, [loading, loadError, currentStatement, ensureTtsAudio]);

  // 发音：全局唯一音频控制器（暂停旧 → 复位 → 赋新 src → play），
  // 已预载就绪的 Audio 取其 src（浏览器已缓冲 → 赋给 globalAudio 秒开，零延迟）
  // 异步竞态保护：callId 作废在途调用（切题/答对/新播放后，旧闭包绝不覆盖新播放）
  const playSentenceSound = useCallback((times = 1) => {
    const stmt = currentStatement;
    if (!stmt?.russian) return;
    const myCallId = ++callIdRef.current;
    (async () => {
      let url = "";
      let readyEl = null; // 已内容就绪的预载 Audio → 直接播（零延迟，跳过重新加载）
      try {
        const entry = ensureTtsAudioRef.current(stmt);
        if (entry && entry.audio && entry.audio.src) { url = entry.audio.src; readyEl = entry.audio; }
        if (!url) url = await ensureTts(stmt);
      } catch (e) { /* ignore */ }
      if (callIdRef.current !== myCallId) return;   // 已被更新播放/切题取代 → 不播（防旧覆盖新）
      if (currentStmtRef.current !== stmt) return;  // 当前题已变 → 放弃
      if (!url && !readyEl) return;
      playGlobalAudio(url, {
        el: readyEl, // 已预载就绪 → 直接播；未就绪 → globalAudio 流式播
        times,
        rate: settings.rate || 1,
        gap: (ui.speakGap ?? 1) * 1000,
        onBlocked: () => setAudioBlocked(true), // 自动播放策略拦截 → 点亮提示
      });
      setAudioBlocked(false);
      prefetchNextAudioRef.current(); // 预加载后续句 → 连续答题切题不延迟
    })();
  }, [currentStatement, ensureTts, ensureTtsAudio, settings.rate, ui.speakGap]);

  // 立即停止全局唯一音频（切题/重试/暂停时调用；任何在途重播循环一并作废）
  const stopPlayback = useCallback(() => {
    callIdRef.current += 1; // 作废所有在途播放调用（旧闭包 await 完成后不再播）
    stopGlobalAudio();
    ttsAudioPoolRef.current.forEach((a) => {
      try { a.onended = null; a.pause(); a.currentTime = 0; } catch (e) { /* ignore */ }
    });
    ttsAudioPoolRef.current.clear();
    ttsAudioRef.current = null;
  }, []);
  // 预加载后续句发音（切题/答对时调用 → 下一题秒播，连续答题零延迟）
  const prefetchNextAudio = useCallback(() => {
    const seq = sequences[currentSequenceIndex];
    const units = (seq && seq.units) || [];
    const nu = currentUnitIndex + 1;
    const nextUnits = nu < units.length
      ? units.slice(nu, nu + 2)
      : (currentSequenceIndex + 1 < sequences.length ? ((sequences[currentSequenceIndex + 1].units || []).slice(0, 2)) : []);
    if (!nextUnits.length) return;
    preloadTtsAll(nextUnits, (it) => {
      const e = ensureTtsAudioRef.current(it);
      return e ? e.promise : Promise.resolve();
    }, { concurrency: 2, limit: 2 });
  }, [sequences, currentSequenceIndex, currentUnitIndex]);
  const prefetchNextAudioRef = useRef(prefetchNextAudio);
  prefetchNextAudioRef.current = prefetchNextAudio;

  // ---- 统一切题打断：任何导致 currentStatement 变化的路径（按钮/引擎快捷键/autoNext）
  // 在自动播放前先停旧题残留发音，杜绝答对/上一题声音带入新题连读 ----
  const lastStmtKeyRef = useRef(null);
  useEffect(() => {
    const key = currentStatement ? String(currentStatement.russian || "").trim() : "";
    if (lastStmtKeyRef.current && lastStmtKeyRef.current !== key) {
      stopPlayback();
      prefetchNextAudioRef.current(); // 切题瞬间立即预载后续句 → 下一题秒播
    }
    lastStmtKeyRef.current = key;
  }, [currentStatement, stopPlayback]);
  // 组件卸载：立即停止全局音频（离开答题页/切换模式后不再残留任何声音）
  useEffect(() => () => { stopGlobalAudio(); }, []);

  // 自动播放被拦截时：点击屏幕任意位置解锁并恢复当前题发音（Autoplay Policy 解除）
  useEffect(() => {
    if (!audioBlocked) return;
    const unlock = () => {
      setAudioBlocked(false);
      playSentenceSound(1);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, [audioBlocked, playSentenceSound]);

  // ---- 题目出现时自动播放两遍发音（即时，无延迟） ----
  useEffect(() => {
    if (!loading && !loadError && currentStatement && ui.autoSpeak !== false) {
      playSentenceSound(ui.speakTimes ?? 2);
    }
  }, [loading, loadError, currentSequenceIndex, currentUnitIndex, currentStatement, playSentenceSound, ui.autoSpeak, ui.speakTimes]);

  // ---- 格式化时间 ----
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // ---- 答对后即时播放标准发音 ----
  useEffect(() => {
    if (showAnswerPanel && currentStatement && ui.answerSpeak) {
      playSentenceSound(1); // 答对面板显示当前 step → 读当前 step（题目显示什么读什么）
      // 答对瞬间预载接下来 2 句发音 → 用户点「下一题」时秒播（连续答题不延迟）
      prefetchNextAudioRef.current();
    }
  }, [showAnswerPanel, currentStatement, playSentenceSound, ui.answerSpeak, currentSequenceIndex, currentUnitIndex, sequences, ensureTtsAudio]);

  // ---- AnswerPanel 操作 ----
  const handleRetry = () => {
    stopPlayback();
    setShowAnswerPanel(false);
    reset();
    setCurrentErrors([]);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleNextFromAnswer = () => {
    stopPlayback();
    setShowAnswerPanel(false);
    reset();
    setCurrentErrors([]);
    goToNext();
  };

  // ---- 设置「答题正确后自动下一题」（autoNext） ----
  useEffect(() => {
    if (showAnswerPanel && ui.autoNext) {
      const t = setTimeout(() => {
        setShowAnswerPanel(false);
        reset();
        setCurrentErrors([]);
        goToNext();
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [showAnswerPanel, ui.autoNext]);

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

  // ---- 顶栏操作（对标句乐部）----
  const handleResetProgress = () => {
    if (!window.confirm("确定重置当前课程进度？")) return;
    setShowSummary(false);
    setCurrentSequenceIndex(0);
    setCurrentUnitIndex(0);
    reset();
    setCurrentErrors([]);
    setElapsed(0);
    resetStats();
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const togglePause = () => {
    // 全局唯一音频：暂停→stopGlobalAudio 复位；恢复→重新播放当前句
    if (isPaused) {
      setIsPaused(false);
      playSentenceSound(1);
    } else {
      stopGlobalAudio();
      setIsPaused(true);
    }
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); }
    else { document.documentElement.requestFullscreen().catch(() => {}); }
  };

  const handleModeStart = (mode, difficulty, customTypes) => {
    const u = courseId || effectiveCourseId;
    const isLocal = new URLSearchParams(window.location.search).get('src') === 'local';
    const suffix = isLocal ? `?src=local&courseId=${effectiveCourseId}` : `?courseId=${effectiveCourseId}`;
    const dq = `&difficulty=${difficulty || 'beginner'}${customTypes && customTypes.length ? '&custom=' + encodeURIComponent(customTypes.join(',')) : ''}`;
    setShowModePicker(false);
    if (mode.key === 'chinese_to_english' || mode.key === 'speaking' || mode.key === 'listening' || mode.key === 'dictation') {
      // 切换模式 → 先进入沉浸式预加载页（真实资源预载），完成后自动跳对应答题页
      navigate(`/preload/${mode.key}/${u}${suffix}${dq}`);
    } else {
      alert('该模式暂未开放，当前支持「中译俄 / 听写 / 听力 / 口语」模式');
    }
  };

  // ---- 顶栏补全适配（乱序/教材数据）----
  const seqsNow = () => sequences;
  const setSeqsNow = (arr) => setSequences(arr);
  const resetIndexNow = () => setCurrentSequenceIndex(0);
  // 学习内容句子源：优先顶层 sentences；滚雪球课程无 sentences 时，从每条路径提取完整句（最后一步）
  const bookSentences = (() => {
    const ls = localLesson
    if (!ls) return []
    const sents = (ls.sentences || []).filter((x) => x && (x.ru || x.russian || x.text))
    if (sents.length) return sents
    return (ls.scaffoldingPaths || [])
      .map((p) => {
        const steps = Array.isArray(p.steps) ? p.steps : []
        const last = steps[steps.length - 1]
        if (!last) return null
        return { ...last, russian: last.russian, chinese: last.chinese, pathId: p.pathId }
      })
      .filter(Boolean)
  })()

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
    for (let i = 0; i < sequences.length; i++) {
      const units = sequences[i]?.units || [];
      for (let j = 0; j < units.length; j++) {
        if (units[j]?.russian === ru) {
          setCurrentSequenceIndex(i);
          setCurrentUnitIndex(j);
          setShowLearning(false);
          showHint('已定位到该句');
          return;
        }
      }
    }
    showHint('未找到该句所在位置');
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
  }

  // ==========================================================
  // 渲染
  // ==========================================================
  if (loading) {
    return (
      <div style={styles.page}>
        <div style={{ ...styles.loading, flexDirection: "column", gap: 16 }}>
          <style>{"@keyframes qp-spin{to{transform:rotate(360deg)}}"}</style>
<div style={{ width: 38, height: 38, borderRadius: "50%", border: "3px solid oklch(95% 0.0081 61.42)", borderTopColor: "oklch(23.27% 0.0249 284.3)", animation: "qp-spin .8s linear infinite" }} />
          <span>正在加载课程…{ttsProgress && ttsProgress.total > 0 ? ' 发音 ' + ttsProgress.done + '/' + ttsProgress.total : ""}</span>
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
        ...THEME_OF(ui).vars,
        background: BG_STYLE(ui).background,
        backgroundImage: ui.bgImage ? undefined : "none",
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

      {/* 顶部工具栏（对标句乐部：左退出+标题，右图标组） */}
      <div style={styles.toolbar}>
        <div style={styles.toolbarLeft}>
          <button style={styles.iconBtn} onClick={() => setShowExit(true)} title="退出游戏" aria-label="退出游戏">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M17 9L20 12L17 15" />
              <path d="M5 5H19" />
              <path d="M5 12H14" />
              <path d="M5 19H19" />
            </svg>
          </button>
          <div style={styles.progress}>
            （{currentSequenceIndex + 1}/{sequences.length}）
          </div>
        </div>
        <div style={styles.toolbarRight}>
          <button style={styles.iconBtn} onClick={() => setShowSettings(true)} title="设置"><Icon name="gear" /></button>
          <button style={{ ...styles.iconBtn, color: showAnswerMode ? "#7C3AED" : undefined }} onClick={() => setShowAnswerMode((v) => !v)} title={showAnswerMode ? "关闭看答案模式" : "开启看答案模式"}><Icon name="bookOpen" color={showAnswerMode ? "#7C3AED" : undefined} /></button>
          <button style={styles.iconBtn} onClick={openLearning} title="查看课程学习内容（Ctrl+1）"><Icon name="notebook" /></button>
          <button style={styles.iconBtn} onClick={openTree} title="句子树"><Icon name="tree" /></button>
          <button style={styles.iconBtn} onClick={() => setShowModePicker(true)} title="切换游戏模式"><Icon name="gamepad" /></button>
          <button style={styles.iconBtn} onClick={toggleShuffle} title={shuffled ? "恢复正序" : "乱序模式"}><Icon name="shuffle" color={shuffled ? "#7C3AED" : undefined} /></button>
          <button style={styles.iconBtn} onClick={togglePause} title={isPaused ? "继续播放" : "暂停"}>{isPaused ? <Icon name="play" /> : <Icon name="pause" />}</button>
          <button style={styles.iconBtn} onClick={handleResetProgress} title="重置当前课程进度"><Icon name="rotateCcw" /></button>
          <button style={styles.iconBtn} onClick={openReport} title="报告错误"><Icon name="alert" /></button>
          <button style={styles.iconBtn} onClick={toggleFullscreen} title="全屏"><Icon name="maximize" /></button>
        </div>
      </div>

      {/* 状态行：家族进度 + Combo + 计时器 */}
      <div style={styles.familyBar}>
        <span style={styles.familyName}>{currentSequence?.familyName || ""}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: "auto" }}>
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
          <span style={styles.familyStep}>
            步骤 {currentUnitIndex + 1}/{currentSequence?.units?.length || 0} · {formatTime(elapsed)}
          </span>
        </div>
      </div>

      {/* 设置弹窗 */}
      {showSettings && <SettingsModal onClose={() => { setShowSettings(false); refreshSettings(); }} />}
      {/* 模式选择弹窗 */}
      {showModePicker && (
        <ModePickerModal
          title={unitMeta?.title || "选择练习模式"}
          modes={COURSE_MODES}
          onClose={() => setShowModePicker(false)}
          onStart={handleModeStart}
        />
      )}

      {/* 学习内容弹窗 */}
      {showLearning && (
        <LearningContentModal
          title={unitMeta?.title || "学习内容"}
          sentences={bookSentences}
          unitId={effectiveCourseId || ''}
          onClose={() => setShowLearning(false)}
          onPractice={practiceSentence}
        />
      )}
      {/* 句子树弹窗 */}
      {showTree && (
        <SentenceTreeModal
          sentence={currentStatement}
          onClose={() => setShowTree(false)}
        />
      )}
      {/* 报告错误弹窗 */}
      {showReport && (
        <ReportErrorModal
          sentence={currentStatement}
          onClose={() => setShowReport(false)}
        />
      )}

      {/* 轻提示 */}
      {hint && (
        <div style={{ position: 'fixed', top: 72, left: '50%', transform: 'translateX(-50%)', zIndex: 200, background: '#333', color: '#fff', padding: '8px 18px', borderRadius: 999, fontSize: 13, boxShadow: '0 4px 12px rgba(0,0,0,0.25)', whiteSpace: 'nowrap' }}>{hint.text}</div>
      )}
      {/* 自动播放策略被拦截 → 点亮提示，点击屏幕任意处即解锁 */}
      {audioBlocked && (
        <div style={{ position: 'fixed', top: 108, left: '50%', transform: 'translateX(-50%)', zIndex: 200, background: 'rgba(124,58,237,0.95)', color: '#fff', padding: '8px 18px', borderRadius: 999, fontSize: 13, boxShadow: '0 4px 12px rgba(0,0,0,0.25)', whiteSpace: 'nowrap' }}>
          🔊 音频被浏览器拦截，请点击屏幕任意位置激活后自动恢复发音
        </div>
      )}

      {/* 全局进度条 */}
      <div style={styles.progressBarBg}>
        <div
          style={{
            ...styles.progressBarFill,
            width: `${((currentGlobalUnitIndex + 1) / totalUnits) * 100}%`,
          }}
        />
      </div>



      {/* 主内容区（答对展示面板加宽，一行容纳更多词卡；答题中保持原宽） */}
      <div style={{ ...styles.mainContent, maxWidth: showAnswerPanel ? 1120 : styles.mainContent.maxWidth }}>

        {/* 答对详情页 */}
        {showAnswerPanel ? (
          <AnswerPanel
            statement={currentStatement}
            onRetry={handleRetry}
            onNext={handleNextFromAnswer}
            isLast={isLastUnit}
            ui={ui}
          />
        ) : (
        <>
        {/* 中文释义 */}
        <div style={styles.hintCard}>
          {showAnswerMode && currentStatement?.russian && (
            <div style={styles.answerTop}>
              答案：<span style={{ fontFamily: '"PT Serif", Georgia, serif' }}>{currentStatement.russian}</span>
            </div>
          )}
          <div style={styles.hintText}>{currentStatement?.chinese || currentStatement?.russian}</div>
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
            <span style={{ color: "var(--qs-sub, #A1A1AA)" }}>
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

      {/* 退出游戏确认弹窗（对标句乐部：返回首页 / 返回课程列表 / 继续学习） */}
      <ExitConfirmModal
        open={showExit}
        onClose={() => setShowExit(false)}
        courseId={studyCourseId}
      />

      {/* 悟空 AI 助手（右下角浮动孙悟空，点击弹出 AI 问答弹窗） */}
      <WukongAiAssistant statement={currentStatement} modeLabel={aiModeLabel} wrongStreak={wrongStreak} />
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
    background: "var(--qs-surface)",
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
    color: "var(--qs-text)",
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
    color: "var(--qs-text)",
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
    height: 2.5,
    background: "#E5E7EB",
  },
  progressBarFill: {
    height: "100%",
    background: "linear-gradient(90deg, #22C55E, #16A34A)",
    transition: "width 0.3s ease",
  },

  familyBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 24px",
    fontSize: 12,
    background: "var(--qs-surface)",
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
    color: "var(--qs-text, #18181B)",
    lineHeight: 1.3,
  },
  grammarNote: {
    marginTop: 10,
    fontSize: 13,
    color: "var(--qs-active, oklch(18% 0.0249 284.3))",
    background: "var(--qs-surface2, oklch(95% 0.0081 61.42))",
    padding: "8px 14px",
    borderRadius: 8,
    display: "inline-block",
  },
  answerReveal: {
    marginTop: 12,
    fontSize: 16,
    color: "var(--qs-success, #059669)",
    fontWeight: 500,
  },
  answerTop: {
    marginBottom: 10,
    fontSize: 20,
    fontWeight: 700,
    color: "#7C3AED",
    fontFamily: '"PT Serif", Georgia, serif',
    lineHeight: 1.4,
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
