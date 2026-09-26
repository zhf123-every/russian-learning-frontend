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
import { markUnitDone } from "../lib/lessonProgress";
import { addStudyTime } from "../lib/learningStats";
import { getCourseById } from "../utils/courseService";
import { recordPeak, addDailyExp, recordCase } from "../lib/questStats";
import { analyzeSentence } from "../lib/ai";
import { ensureDictFull, annotateWords, warmUpIndex } from "../lib/wordAnnotate";
import { expandSequencesWithChunks } from "../lib/chunking";
import { useQuestionInput } from "../hooks/useQuestionInput";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useGameStats } from "../hooks/useGameStats";
import QuestionInput from "../components/quest/QuestionInput";
import { getPosColor } from "../constants/posColors";
import AnswerPanel from "../components/quest/AnswerPanel";
import SummaryPanel from "../components/quest/SummaryPanel";
import ModePickerModal, { COURSE_MODES } from "../components/ModePickerModal";
import SettingsModal from "../components/SettingsModal";
import LearningContentModal from "../components/LearningContentModal";
import SentenceTreeModal from "../components/SentenceTreeModal";
import ReportErrorModal from "../components/ReportErrorModal";
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
  const [showSettings, setShowSettings] = useState(false);
  const [showModePicker, setShowModePicker] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showBook, setShowBook] = useState(false);
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
    // 已有标注（词性非空）就跳过
    if (Array.isArray(stmt.words) && stmt.words.some(w => w.pos || w.grammarLabel)) return;
    const key = String(stmt.russian).trim();
    // 1) 词典标注（本地，立即生效；首次先加载全词典）
    await ensureDictFull();
    const dictWords = annotateWords(stmt.russian);
    if (dictWords.length) {
      patchWords(key, (oldWs) => dictWords.map((w, i) => {
        const oldW = oldWs[i] || {};
        return { ...oldW, ...w, order: i, roleLabel: oldW.roleLabel || "" };
      }));
    }
    // 2) AI 补充（成分 roleLabel / 中译 / 语法解析），失败不影响词典标注
    if (analysisCache[key]) { applyAI(key, analysisCache[key]); return; }
    try {
      const res = await analyzeSentence(stmt.russian);
      if (res) {
        setAnalysisCache(c => ({ ...c, [key]: res }));
        applyAI(key, res);
      }
    } catch (e) { /* 精析失败不影响答题 */ }
  }, [analysisCache, patchWords]);

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
      // Chunking：每一步答对都显示答对面板（含中间步），用户点「下一题」进入下一步
      setShowAnswerPanel(true);
      recordCorrect();
      playRightSound();
      ensureAnalysis(currentStatement);
      // 通关之路：六格天赋树（答对当前句，句中各词的格 → 正确+1）
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

  // 包装键盘事件：播放打字音
  const handleInputKeyDown = (e) => {
    if (checkPlayTypingSound(e)) {
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
              setSequences(expandSequencesWithChunks(adapted, stored?.words));
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
                    setSequences(expandSequencesWithChunks(adapted, u?.words))
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
            setSequences(expandSequencesWithChunks(adapted, null));
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

  // ---- 预加载全词典 + 构建词形索引（后台预热，答对时标注即时生效）----
  useEffect(() => {
    if (!loading && !loadError && sequences.length) {
      const t = setTimeout(async () => { await ensureDictFull(); warmUpIndex(); }, 600);
      return () => clearTimeout(t);
    }
  }, [loading, loadError, sequences.length]);

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
      // 全部完成，显示结算页 —— 记录课时完成（详情页进度打通）
      markUnitDone(effectiveCourseId);
      // 通关之路：单局最高输出（每题 +10 EXP）+ 单局最高命中率
      const totalQ = sequences.reduce((a, seq) => a + ((seq.units && seq.units.length) || 1), 0)
      const acc = totalQ > 0 ? Math.round((correctCount / totalQ) * 100) : 0
      recordPeak({ score: correctCount * 10, accuracy: acc })
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
    const a = ttsAudioRef.current;
    if (!a) { setIsPaused(false); return; }
    if (a.paused) { a.play().catch(() => {}); setIsPaused(false); }
    else { a.pause(); setIsPaused(true); }
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
  const seqsNow = () => sequences;
  const setSeqsNow = (arr) => setSequences(arr);
  const resetIndexNow = () => setCurrentSequenceIndex(0);
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
            {unitMeta?.title || "练习"}（{currentSequenceIndex + 1}/{sequences.length}）
          </div>
        </div>
        <div style={styles.toolbarRight}>
          <button style={styles.iconBtn} onClick={() => setShowSettings(true)} title="设置">⚙</button>
          <button style={styles.iconBtn} onClick={() => setShowBook(true)} title="教材">📖</button>
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
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {/* 模式选择弹窗 */}
      {showModePicker && (
        <ModePickerModal
          title={unitMeta?.title || "选择练习模式"}
          modes={COURSE_MODES}
          onClose={() => setShowModePicker(false)}
          onStart={handleModeStart}
        />
      )}

      {/* 教材阅读浮层 */}
      {showBook && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => setShowBook(false)}>
          <div style={{ width: '100%', maxWidth: 720, maxHeight: '80vh', overflowY: 'auto', background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 12px 40px rgba(0,0,0,0.2)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>📖 {localLesson?.title || '教材'}</h3>
              <button style={{ border: 0, background: 'none', fontSize: 24, cursor: 'pointer', color: '#888' }} onClick={() => setShowBook(false)} title="关闭">×</button>
            </div>
            {bookSentences.length === 0 ? (
              <p style={{ color: '#999', textAlign: 'center', padding: '30px 0' }}>本课暂无教材文本</p>
            ) : bookSentences.map((x, i) => (
              <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid #F0F0F0' }}>
                <div style={{ fontSize: 17, fontWeight: 600, fontFamily: '"PT Serif",Georgia,serif', lineHeight: 1.5 }}>{x.ru}</div>
                <div style={{ fontSize: 14, color: '#666', marginTop: 2 }}>{x.zh}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 学习内容弹窗 */}
      {showLearning && (
        <LearningContentModal
          title={unitMeta?.title || "学习内容"}
          sentences={bookSentences}
          onClose={() => setShowLearning(false)}
          onPractice={practiceSentence}
        />
      )}
      {/* 句子树弹窗 */}
      {showTree && (
        <SentenceTreeModal sentence={currentStatement?.russian || ""} onClose={() => setShowTree(false)} />
      )}
      {/* 报告错误弹窗 */}
      {showReport && (
        <ReportErrorModal sentence={currentStatement?.russian || ""} onClose={() => setShowReport(false)} />
      )}

      {/* 轻提示 */}
      {hint && (
        <div style={{ position: 'fixed', top: 72, left: '50%', transform: 'translateX(-50%)', zIndex: 200, background: '#333', color: '#fff', padding: '8px 18px', borderRadius: 999, fontSize: 13, boxShadow: '0 4px 12px rgba(0,0,0,0.25)', whiteSpace: 'nowrap' }}>{hint.text}</div>
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
    height: 2.5,
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
