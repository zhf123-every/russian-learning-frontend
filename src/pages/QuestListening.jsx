// QuestListening.jsx —— 听力模式答题页（1:1 对标句乐部听力模式）
// 流程：新题 → 盲听（只听不看"请仔细聆听"）→ 慢听（词卡+慢速0.7x）→ 答案（1x）→ 停留
// 布局：顶栏(退出+标题+10图标) / 计时器行 / 游戏区(倍速胶囊+词卡+上下题+底部快捷键) / AI学习助手
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { checkUnitAccess } from "../lib/courseAccess";
import { findLocalUnitById } from "../utils/storage";
import { apiFetch } from "../lib/api";
import { markUnitDone } from "../lib/lessonProgress";
import { touchSync } from "../lib/cloudProgress";
import { addStudyTime } from "../lib/learningStats";
import { addDailyExp } from "../lib/questStats";
import { expandSequencesWithChunks } from "../lib/chunking";
import { scaffoldingToSequences } from "../lib/scaffolding";
import { segmentsToSequences, filterSegmentsByDifficulty } from "../lib/segmentsToQuestions";
import { loadSlotTablesForUnit } from "../lib/loadSlotTables";
import { getCachedTtsUrl, getCachedTtsAudio, getCachedLesson } from "../utils/ttsPreloadShared";
import { playGlobalAudio, stopGlobalAudio } from "../utils/audioService";

import { preloadTtsAll } from "../lib/ttsPreload";
import ModePickerModal, { COURSE_MODES } from "../components/ModePickerModal";
import SettingsModal, { loadHotkeys, keysOfEvent } from "../components/SettingsModal";
import Icon from "../components/TopBarIcons";
import LearningContentModal from "../components/LearningContentModal";
import SentenceTreeModal from "../components/SentenceTreeModal";
import ReportErrorModal from "../components/ReportErrorModal";
import ExitConfirmModal from "../components/quest/ExitConfirmModal";
import WukongAiAssistant from "../components/quest/WukongAiAssistant";
import { toast } from "../lib/toast";
import { getPosColor, getPosLabel, buildGrammarLabel } from "../constants/posColors";
import { ensureDictFull, annotateWords, warmUpIndex } from "../lib/wordAnnotate";
import { useQuestSettings, BG_STYLE, THEME_OF, loadUi, saveUi } from "../hooks/useQuestSettings";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";
const DEFAULT_UNIT_ID = "u1";

// P3：读课时语块 → C 混合题目。课时有 ok 语块 → 返回题目组；无/读失败 → null（调用方降级老路径）
async function loadSegmentsForUnit(unitId, courseId) {
  if (!unitId) return null;
  try {
    const q = new URLSearchParams();
    if (courseId) q.set("course_id", courseId);
    q.set("unit_id", unitId);
    const res = await fetch(`${API_BASE}/api/segments?${q.toString()}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.ok) return null;
    const seqs = segmentsToSequences(data.items || [], "本课");
    return seqs && seqs.length ? seqs : null;
  } catch (e) {
    return null;
  }
}

// ---- P4 句乐部路径优先：三档路径按难度取档（与 QuestPractice 一致） ----
const diffToPathKey = { beginner: "easy", intermediate: "medium", advanced: "hard" };
function pathsByDifficulty(paths, diffKey) {
  const arr = Array.isArray(paths) ? paths : [];
  const key = diffToPathKey[diffKey];
  if (!key) return arr;
  const matched = arr.filter((p) => !p.difficulty || p.difficulty === key);
  return matched.length ? matched : arr;
}
function seqsFromPaths(paths, title, diffKey) {
  return scaffoldingToSequences(pathsByDifficulty(paths, diffKey), title || "本课");
}

// ---- 数据适配（与 QuestPractice 一致）----
function adaptBuildSteps(data) {
  const families = Array.isArray(data?.families) ? data.families : [];
  return families.map((fam) => {
    const units = (fam.steps || []).map((step, idx) => {
      const rawWords = Array.isArray(step.words) ? step.words : [];
      const words = rawWords.map((w, i) => ({
        ...w, order: i,
        form: w.stress_marked || w.word || w.lemma || "",
        lemma: w.lemma || w.word || "",
        pos: w.pos || "",
        grammarLabel: [w.gender, w.grammar_case, w.number === "复数" ? "复数" : ""].filter(Boolean).join("·"),
        roleLabel: w.syntactic_role || "",
      }));
      const wordOrder = words.map((_, i) => i);
      return {
        id: `${fam.sequence_id}_${step.step_order ?? idx + 1}`,
        sequenceId: fam.sequence_id,
        sequenceOrder: step.step_order ?? idx + 1,
        russian: step.target_sentence || "",
        stressMarked: words.map((w) => w.form).filter(Boolean).join(" "),
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

function adaptLocalLesson(lesson) {
  // 优先：后台固定的滚雪球步骤（scaffoldingPaths）→ 直接按步骤出题（不再现切 chunking）
  if (Array.isArray(lesson.scaffoldingPaths) && lesson.scaffoldingPaths.length) {
    return scaffoldingToSequences(lesson.scaffoldingPaths, lesson.title || "本课");
  }
  const sentences = Array.isArray(lesson.sentences) ? lesson.sentences.filter(x => x && x.ru) : [];
  const words = Array.isArray(lesson.words) ? lesson.words.filter(w => w && w.ru) : [];
  const buildUnit = (ru, zh, idx) => {
    const tokens = String(ru || "").trim().split(/\s+/).filter(Boolean);
    const ws = tokens.map((w, i) => ({ order: i, form: w, lemma: w, pos: "", grammarLabel: "", roleLabel: "" }));
    return {
      id: `local_${idx + 1}`, sequenceId: "local", sequenceOrder: idx + 1,
      russian: ru || "", stressMarked: tokens.join(" "), chinese: zh || "",
      action: "", grammarNote: "", newElement: "", words: ws,
      acceptableAnswers: [{ wordOrder: tokens.map((_, i) => i), wordVariants: {}, isDefault: true, note: "" }],
    };
  };
  if (!words.length) {
    const units = sentences.map((st, idx) => buildUnit(st.ru, st.zh, idx));
    return [{ id: "local", name: lesson.title || "本课", familyName: lesson.title || "本课", units, totalUnits: units.length, fullSentence: "" }];
  }
  const normTok = (t) => String(t).toLowerCase().replace(/[.,!?;:«»"']/g, "");
  const matchedByWord = words.map(w => {
    const wl = String(w.ru).toLowerCase();
    const idxs = [];
    sentences.forEach((s, si) => {
      const toks = String(s.ru).toLowerCase().split(/\s+/).map(normTok).filter(Boolean);
      const hit = wl.length >= 3
        ? toks.some(t => t === wl || t.startsWith(wl) || wl.startsWith(t))
        : toks.some(t => t === wl);
      if (hit) idxs.push(si);
    });
    return { w, idxs };
  });
  const units = [];
  const assigned = new Set();
  let uid = 0;
  const MAX_PER_WORD = 3, MIN_PER_WORD = 2;
  for (const { w, idxs } of matchedByWord) {
    uid += 1;
    units.push({ ...buildUnit(w.ru, w.zh, uid - 1), spellWord: true, spellTotal: words.length });
    const avail = idxs.filter(i => !assigned.has(i));
    let take = Math.min(avail.length, MAX_PER_WORD);
    if (take < MIN_PER_WORD) take = Math.min(avail.length, Math.max(MIN_PER_WORD - take, 0)) + take;
    const chosen = avail.slice(0, take);
    chosen.forEach(i => { assigned.add(i); units.push({ ...buildUnit(sentences[i].ru, sentences[i].zh, uid++), fromWord: w.ru }); });
  }
  if (!units.length) {
    const us = sentences.map((st, idx) => buildUnit(st.ru, st.zh, idx));
    return [{ id: "local", name: lesson.title || "本课", familyName: lesson.title || "本课", units: us, totalUnits: us.length, fullSentence: "" }];
  }
  return [{ id: "local", name: lesson.title || "本课", familyName: lesson.title || "本课", units, totalUnits: units.length, fullSentence: "" }];
}

// 阶段配置
const DEFAULT_CFG = {
  blind: { on: true, times: 2, speed: 1, label: "盲听" },
  slow:  { on: true, times: 2, speed: 0.7, label: "慢听" },
  answer:{ on: true, times: 1, speed: 1, label: "答案" },
};

function TipBtn({ label, keys, style, children }) {
  const [tip, setTip] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-flex", ...style }} onMouseEnter={() => setTip(true)} onMouseLeave={() => setTip(false)}>
      {children}
      {tip && (
        <div style={{ position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 6, background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 10px", whiteSpace: "nowrap", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 80, fontSize: 13, color: "#374151", pointerEvents: "none" }}>
          <span>{label}</span>
          {keys.map(k => <kbd key={k} style={{ borderRadius: 5, background: "#fff", border: "1px solid #d1d5db", padding: "2px 6px", fontSize: 11, fontWeight: 500, color: "#111", boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.05)" }}>{k}</kbd>)}
        </div>
      )}
    </span>
  );
}

export default function QuestListening() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const effectiveCourseId = courseId || DEFAULT_UNIT_ID;
  const studyCourseId = (() => { try { return new URLSearchParams(window.location.search).get('courseId') || effectiveCourseId } catch (e) { return effectiveCourseId } })()

  const [loading, setLoading] = useState(true);
  const [ttsProgress, setTtsProgress] = useState(null); // { done, total } 进页前发音预载进度
  const [loadError, setLoadError] = useState(null);
  const [sequences, setSequences] = useState([]);
  const [unitMeta, setUnitMeta] = useState(null);
  const [localLesson, setLocalLesson] = useState(null);
  const [isLocalMode, setIsLocalMode] = useState(false);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [phase, setPhase] = useState("standby"); // standby/blind/slow/answer
  const [ready, setReady] = useState(false);      // 准备界面（对标句乐部"准备好了吗"）
  const [shuffled, setShuffled] = useState(false);
  const [order, setOrder] = useState([]); // 乱序后的原始索引
  const [isPaused, setIsPaused] = useState(false);

  // ---- 难度（URL 传入；原地开启模式切难度） = 出题粒度过滤 ----
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
  const rawSequencesRef = useRef([]);
  const applyDiff = (seqs) => {
    rawSequencesRef.current = seqs;
    return filterSegmentsByDifficulty(seqs, diffKeyRef.current, customRef.current);
  };

  // ---- 难度切换 → 重新过滤 + 从第 0 题开始 ----
  useEffect(() => {
    const raw = rawSequencesRef.current;
    if (!raw.length) return;
    setSequences(filterSegmentsByDifficulty(raw, diffKey, customTypes));
    setCurrentIdx(0);
    setOrder([]); setShuffled(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diffKey, customTypes]);

  // ---- 学习进度持久化（同难度才恢复；切难度/乱序则从头） ----
  const progKey = () => `qs_progress_listening_${effectiveCourseId}`;
  useEffect(() => {
    if (loading || loadError || !sequences.length) return;
    try {
      const saved = JSON.parse(localStorage.getItem(progKey()) || "null");
      if (saved && saved.difficulty === diffKey && saved.idx !== undefined) {
        const idx = Math.min(saved.idx, sequences.flatMap((s) => s.units || []).length - 1);
        setCurrentIdx(Math.max(0, idx));
      }
    } catch (e) { /* 缓存损坏则从头 */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, loadError, sequences.length]);
  useEffect(() => {
    if (loading || !sequences.length) return;
    try {
      localStorage.setItem(progKey(), JSON.stringify({ idx: currentIdx, difficulty: diffKey, custom: customTypes, ts: Date.now() }));
      touchSync();
    } catch (e) { /* 忽略 */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, currentIdx, sequences.length]);

  // 顶栏弹窗
  const [showSettings, setShowSettings] = useState(false);
  const [showExit, setShowExit] = useState(false);
  const { ui, settings, refreshSettings } = useQuestSettings();
  const [showModePicker, setShowModePicker] = useState(false);
  const [showLearning, setShowLearning] = useState(false);
  const [showTree, setShowTree] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showAnswerMode, setShowAnswerMode] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [coverText, setCoverText] = useState(null); // 进模式前遮罩

  // 倍速设置（初始值来自设置弹窗「听力」面板：listenBlind/listenSlow/listenAns）
  const [cfg, setCfg] = useState(() => {
    const u = loadUi();
    return {
      blind: { on: u.listenBlind !== false, times: u.listenBlindTimes ?? 2, speed: u.listenBlindSpeed ?? 1, label: "盲听" },
      slow:  { on: u.listenSlow !== false, times: u.listenSlowTimes ?? 2, speed: u.listenSlowSpeed ?? 0.7, label: "慢听" },
      answer:{ on: u.listenAns !== false, times: u.listenAnsTimes ?? 1, speed: u.listenAnsSpeed ?? 1, label: "答案" },
    };
  });
  const [popover, setPopover] = useState(null); // 'blind'|'slow'|'answer'|null

  // 阶段参数改动 → 实时写回 rlearn_quest_ui（听力面板持久化）
  useEffect(() => {
    saveUi({
      listenBlind: cfg.blind.on, listenBlindTimes: cfg.blind.times, listenBlindSpeed: cfg.blind.speed,
      listenSlow: cfg.slow.on, listenSlowTimes: cfg.slow.times, listenSlowSpeed: cfg.slow.speed,
      listenAns: cfg.answer.on, listenAnsTimes: cfg.answer.times, listenAnsSpeed: cfg.answer.speed,
    });
  }, [cfg]);

  const ttsRef = useRef(null);
  const seqPlayRef = useRef(null); // 阶段链播放器句柄
  const chainRef = useRef(0);      // 阶段链代际（防竞态）
  const timerRef = useRef(null);

  // ---- 拍平所有单元（听力模式按题遍历） ----
  const flatItems = useMemo(() => {
    const out = [];
    sequences.forEach((seq, si) => {
      (seq.units || []).forEach((u, ui) => out.push({ ...u, si, ui }));
    });
    return out;
  }, [sequences]);

  const total = flatItems.length;
  const realIdx = order.length ? (order[currentIdx] ?? currentIdx) : currentIdx;
  const current = flatItems[realIdx];
  const currentSequence = current ? sequences[current.si] : null;

  // ---- 加载单元数据 ----
  useEffect(() => {
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
        } catch (e) { last = e; await new Promise((r) => setTimeout(r, 900 * (i + 1))); }
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
          // P2：表格优先（句乐部式 6 列表格，已入库 ok）→ 出表格题；无 → 走路径/语块降级链
          const slotSeqs = await loadSlotTablesForUnit(effectiveCourseId, studyCourseId);
          if (slotSeqs) {
            if (!cancelled) {
              setUnitMeta(pre.unit || null);
              setSequences(applyDiff(slotSeqs));
              setLoading(false);
            }
            return;
          }
          // 路径优先（句乐部三档路径）：存在 scaffoldingPaths → 按难度取档出题，不读语块
          const hasPaths = Array.isArray(pre.scaffoldingPaths) && pre.scaffoldingPaths.length;
          if (hasPaths) {
            if (!cancelled) {
              setUnitMeta(pre.unit || null);
              const seqs = seqsFromPaths(pre.scaffoldingPaths, (pre.unit && pre.unit.title) || pre.title || "本课", diffKeyRef.current);
              setSequences(applyDiff(seqs));
              setLoading(false);
            }
            return;
          }
          if (pre.families) {
            const adapted = adaptBuildSteps(pre);
            if (!cancelled) {
              setUnitMeta(pre.unit || null);
              const cloudWords = adapted.flatMap((sq) => (sq.units || []).flatMap((u) => (u.words || []).map((w) => ({ ru: w.lemma || w.word || w.ru || "", zh: w.zh || w.chinese || w.mean || "" }))));
              // 直接按课时步骤展开（上传即用），不读后端旧 segments
              const seqs = expandSequencesWithChunks(adapted, cloudWords);
              setSequences(applyDiff(seqs));
              setLoading(false);
            }
            return;
          }
          if ((Array.isArray(pre.sentences) && pre.sentences.length) || (Array.isArray(pre.scaffoldingPaths) && pre.scaffoldingPaths.length)) {
            const hasPaths = Array.isArray(pre.scaffoldingPaths) && pre.scaffoldingPaths.length;
            const adapted = hasPaths ? null : adaptLocalLesson(pre);
            if (!cancelled) {
              setLocalLesson(pre); setIsLocalMode(true);
              setUnitMeta({ title: pre.title || pre.name || "本课", description: pre.description || "" });
              let seqs = null;
              if (hasPaths) {
                seqs = seqsFromPaths(pre.scaffoldingPaths, pre.title || "本课", diffKeyRef.current);
              } else {
                // 课时有 sentences（Excel 上传即用）：直接按表格顺序展开，不读后端旧 segments（覆盖不全会丢句）
                seqs = expandSequencesWithChunks(adapted, pre?.words);
              }
              setSequences(applyDiff(seqs));
              setLoading(false);
            }
            return;
          }
        }
      } catch (e) { /* 缓存不可用 → 走原逻辑 */ }

      try {
        const isLocal = new URLSearchParams(window.location.search).get("src") === "local";
        const isBackendUnit = String(effectiveCourseId).startsWith("unit_");
        if (isLocal || isBackendUnit) {
          let stored = null;
          try { stored = JSON.parse(sessionStorage.getItem("rlearn_local_lesson_" + effectiveCourseId) || "null") } catch (e) { stored = null }
          if (!(stored && ((Array.isArray(stored.sentences) && stored.sentences.length) || (Array.isArray(stored.scaffoldingPaths) && stored.scaffoldingPaths.length)))) stored = findLocalUnitById(effectiveCourseId);
          if (stored && ((Array.isArray(stored.sentences) && stored.sentences.length) || (Array.isArray(stored.scaffoldingPaths) && stored.scaffoldingPaths.length))) {
            const adapted = adaptLocalLesson(stored);
            if (!cancelled) {
              setLocalLesson(stored);
              setIsLocalMode(true);
              window.__unitKnowledge = window.__unitKnowledge || {};
              window.__unitKnowledge[effectiveCourseId] = (stored && stored.knowledge) || {};
              setUnitMeta({ title: stored.title || stored.name || "本课", description: stored.description || "" });
              // 课时有 sentences：直接按表格顺序展开（上传即用），不读后端旧 segments
              const seqs = expandSequencesWithChunks(adapted, stored?.words);
              setSequences(applyDiff(seqs));
              if (!cancelled) setLoading(false);
            }
            return;
          }
          if (!cancelled) setIsLocalMode(false);
        }
      } catch (e) { /* 走 API */ }

      if (String(effectiveCourseId).startsWith("unit_")) {
        try {
          const cloudRes = await apiFetch('/api/videos/list');
          const cloudJson = await cloudRes.json();
          if (cloudJson.ok && Array.isArray(cloudJson.videos)) {
            for (const v of cloudJson.videos) {
              if (v && v.kind === 'course' && Array.isArray(v.units)) {
                const u = v.units.find(x => x.id === effectiveCourseId);
                if (u && ((Array.isArray(u.sentences) && u.sentences.length) || (Array.isArray(u.scaffoldingPaths) && u.scaffoldingPaths.length))) {
                  const adapted = adaptLocalLesson(u);
                  if (!cancelled) {
                    setLocalLesson(u);
                    setIsLocalMode(true);
                    setUnitMeta({ title: u.title || u.name || "本课", description: u.description || "" });
                    // 课时有 sentences：直接按表格顺序展开（上传即用），不读后端旧 segments
                    const seqs = expandSequencesWithChunks(adapted, u?.words);
                    setSequences(applyDiff(seqs));
                    if (!cancelled) setLoading(false);
                  }
                  return;
                }
              }
            }
          }
        } catch (e) { /* 云端不可用 */ }
      }

      try {
        const data = await fetchJsonRetry(`${API_BASE}/api/units/${effectiveCourseId}/build-steps`);
        const adapted = adaptBuildSteps(data);
        if (!cancelled) {
          if (adapted.length === 0) {
            setLoadError("该单元没有可学习的步骤");
            if (!cancelled) setLoading(false);
          }
          else {
            setUnitMeta(data.unit || null);
            const cloudWords = adapted.flatMap((sq) => (sq.units || []).flatMap((u) => (u.words || []).map((w) => ({ ru: w.lemma || w.word || w.ru || "", zh: w.zh || w.chinese || w.mean || "" }))));
            // 直接按课时步骤展开（上传即用），不读后端旧 segments
            const seqs = expandSequencesWithChunks(adapted, cloudWords);
            setSequences(applyDiff(seqs));
            if (!cancelled) setLoading(false);
          }
        }
      } catch (e) {
        if (!cancelled) {
          if (!courseId) { navigate('/quest-store', { replace: true }); return; }
          setLoadError(`无法连接后端: ${e.message}`);
          setLoading(false);
        }
      }
    }
    loadUnit();
    return () => { cancelled = true; };
  }, [effectiveCourseId]);

  // ---- 访问检查 ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await checkUnitAccess(API_BASE, effectiveCourseId, undefined);
      if (!cancelled && !r.allowed) {
        navigate('/quest/' + encodeURIComponent(effectiveCourseId) + '?locked=undefined', { replace: true });
      }
    })();
    return () => { cancelled = true };
  }, [effectiveCourseId]);

  // ---- 计时器 ----
  useEffect(() => {
    if (!loading && !loadError) {
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [loading, loadError]);

  // 组件卸载：立即停止全局音频（离开答题页/切换模式后不再残留任何声音）
  useEffect(() => () => { stopGlobalAudio(); }, []);

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // ---- TTS 发音源（与中译俄一致：voice=alena / type=statement；优先数据自带音频；同句缓存） ----
  const ttsUrlCacheRef = useRef({});
  const ttsAudioCacheRef = useRef({}); // text -> { audio, promise }，同句复用已预载 Audio
  const ensureTtsUrl = useCallback(async (text) => {
    if (!text) return "";
    if (ttsUrlCacheRef.current[text]) return ttsUrlCacheRef.current[text];
    // 预加载页已真实生成该句 TTS → 直接复用（免再请求后端）
    const preUrl = getCachedTtsUrl(text);
    if (preUrl) { ttsUrlCacheRef.current[text] = preUrl; return preUrl; }
    let url = (current && current.audio_url) || "";
    if (!url) {
      try {
        const res = await fetch(`${API_BASE}/api/tts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voice: "alena", id: effectiveCourseId, type: "statement" }),
        });
        const data = await res.json();
        if (data.ok && data.audio_url) url = data.audio_url;
      } catch (e) { /* 忽略 */ }
    }
    if (!url) return "";
    if (!url.startsWith("http")) url = `${API_BASE}${url}`;
    ttsUrlCacheRef.current[text] = url;
    return url;
  }, [current, effectiveCourseId]);

  const ensureTtsAudio = useCallback((text) => {
    if (!text) return null;
    if (ttsAudioCacheRef.current[text]) return ttsAudioCacheRef.current[text];
    // 预加载页已预载内容就绪的 Audio → 直接复用（秒播）
    const preAudio = getCachedTtsAudio(text);
    if (preAudio) {
      const entry = { audio: preAudio, promise: Promise.resolve() };
      ttsAudioCacheRef.current[text] = entry;
      return entry;
    }
    const entry = { audio: null, promise: null };
    entry.promise = (async () => {
      try {
        const url = await ensureTtsUrl(text);
        if (!url) return;
        const a = new Audio(url);
        a.preload = "auto";
        await new Promise((res) => {
          a.addEventListener("canplay", res, { once: true });
          a.addEventListener("error", res, { once: true });
        });
        entry.audio = a;
      } catch (e) { /* 预载失败不阻塞 */ }
    })();
    ttsAudioCacheRef.current[text] = entry;
    return entry;
  }, [ensureTtsUrl]);

  // 进答题页之前全量预载本单元所有句子发音（并发 4，进度显示；失败不阻塞）
  const preloadUnit = useCallback(async (seqs) => {
    setTtsProgress({ done: 0, total: 0 });
    await preloadTtsAll(seqs, async (sq) => {
      const e = ensureTtsAudio(sq?.russian);
      if (e) await e.promise;
    }, { concurrency: 10, limit: 100, timeout: 8000, onProgress: (done, total) => setTtsProgress({ done, total }) });
  }, [ensureTtsAudio]);

  // ---- TTS 播放 ----
  const stopAudio = useCallback(() => {
    chainRef.current += 1; // 使所有旧阶段链失效
    seqPlayRef.current = null;
    stopGlobalAudio(); // 全局唯一音频：立即停止并复位（任何在途重播循环一并作废）
    ttsRef.current = null;
  }, []);

  const playTimes = useCallback((url, speed, times, onDone, readyEl) => {
    if (seqPlayRef.current !== 'running') return;
    // 全局唯一音频控制器：暂停旧 → 复位 → 播放（预载就绪直接播；未就绪走 globalAudio）
    // times 次数由控制器内部循环（切题/stopAudio 立即作废），播完 onFinished 推进阶段链
    playGlobalAudio(url, {
      el: readyEl,
      times,
      rate: speed,
      gap: 500,
      onFinished: () => { if (seqPlayRef.current === 'running') onDone && onDone(); },
    });
  }, []);

  const runStageChain = useCallback(async (text) => {
    stopAudio(); // 先停旧链（chainRef+1）
    const myChain = chainRef.current + 1; // 再取新链号
    chainRef.current = myChain;
    const stages = [];
    if (cfg.blind.on) stages.push({ key: 'blind', cfg: cfg.blind });
    if (cfg.slow.on) stages.push({ key: 'slow', cfg: cfg.slow });
    if (cfg.answer.on) stages.push({ key: 'answer', cfg: cfg.answer });
    if (!stages.length) { setPhase('answer'); return; }
    // 取音频期间先进入首个阶段（盲听=只听不看"请仔细聆听"）
    setPhase(stages[0].key);
    let url = null;
    let readyEl = null; // 已内容就绪的预载 Audio → 直接播（零延迟）
    try {
      const entry = ensureTtsAudio(text);
      if (entry) {
        await entry.promise;
        if (entry.audio && entry.audio.src) { url = entry.audio.src; readyEl = entry.audio; }
      }
      if (!url) url = await ensureTtsUrl(text);
    } catch (e) { /* 无音频也继续 */ }
    if (chainRef.current !== myChain) return; // 已被更新题取代
    if (!url) { setPhase('answer'); return; }
    seqPlayRef.current = 'running';
    let si = 0;
    const run = () => {
      if (chainRef.current !== myChain || seqPlayRef.current !== 'running') return;
      if (si >= stages.length) { setPhase('answer'); seqPlayRef.current = null; return; }
      const st = stages[si];
      setPhase(st.key);
      playTimes(url, st.cfg.speed, st.cfg.times, () => { si += 1; run(); }, readyEl);
    };
    run();
  }, [cfg, playTimes, stopAudio, effectiveCourseId, ensureTtsUrl]);

  // ---- 进入新题自动播放（须已点击"准备好了吗"以放行自动播放） ----
  useEffect(() => {
    if (!loading && !loadError && current && ready) {
      stopAudio();
      setPhase('standby');
      const t = setTimeout(() => runStageChain(current.russian), 400);
      return () => { clearTimeout(t); stopAudio(); };
    }
  }, [loading, loadError, currentIdx, current, ready, runStageChain]);

  const handleStart = async () => {
    setReady(true);
    if (!current) return;
    setCoverText("正在连接语音服务，请稍候…");
    try {
      await ensureTtsUrl(current.russian);
    } catch (e) { /* 忽略 */ }
    setCoverText(null);
    runStageChain(current.russian);
  };

  // ---- 学习时长上报 ----
  useEffect(() => {
    const iv = setInterval(() => { if (elapsed > 0 && elapsed % 60 === 0) { addStudyTime(60); addDailyExp(1); } }, 1000);
    return () => clearInterval(iv);
  }, [elapsed]);

  // ---- 完成标记 ----
  useEffect(() => {
    if (!loading && current && total && currentIdx === total - 1 && phase === 'answer') {
      markUnitDone(effectiveCourseId);
      addStudyTime(elapsed);
    }
  }, [loading, currentIdx, phase, total, current, effectiveCourseId, elapsed]);

  // ---- 单阶段重播 / 慢速单播 ----
  // ---- 进模式前预取当前题发音（播放时命中缓存 → 即时，无延迟） ----
  useEffect(() => {
    if (!loading && !loadError && current?.russian) {
      ensureTtsAudio(current.russian);
    }
  }, [loading, loadError, currentIdx, current, ensureTtsAudio]);

  const playStageOnly = useCallback(async (key) => {
    if (!current) return;
    const c = cfg[key];
    stopAudio();
    try {
      const url = await ensureTtsUrl(current.russian);
      if (!url) return;
      seqPlayRef.current = 'running';
      setPhase(key);
      playTimes(url, c.speed, Math.max(c.times, 1), () => { setPhase('answer'); seqPlayRef.current = null; });
    } catch (e) { /* 忽略 */ }
  }, [current, cfg, playTimes, stopAudio, effectiveCourseId, ensureTtsUrl]);

  const playSingleSlow = useCallback(() => {
    if (!current) return;
    stopAudio();
    (async () => {
      try {
        const url = await ensureTtsUrl(current.russian);
        if (!url) return;
        seqPlayRef.current = 'running';
        playTimes(url, 0.6, 1, () => { seqPlayRef.current = null; });
      } catch (e) { /* 忽略 */ }
    })();
  }, [current, playTimes, stopAudio, effectiveCourseId, ensureTtsUrl]);

  // ---- 导航 ----
  const goPrev = () => { if (currentIdx > 0) { stopAudio(); setCurrentIdx(currentIdx - 1); setElapsed(0); } };
  const goNext = () => {
    if (currentIdx < total - 1) { stopAudio(); setCurrentIdx(currentIdx + 1); setElapsed(0); }
    else { markUnitDone(effectiveCourseId); addStudyTime(elapsed); setPhase('answer'); }
  };
  const goPrevSeq = () => {
    if (!current) return;
    if (current.ui > 0) { stopAudio(); setCurrentIdx(Math.max(0, currentIdx - current.ui)); }
    else if (current.si > 0) {
      const prevSeq = sequences[current.si - 1];
      const prevCount = (prevSeq?.units || []).length;
      stopAudio(); setCurrentIdx(Math.max(0, currentIdx - 1 - current.ui + prevCount - (prevCount || 1) + 1));
      // 简化：跳到上一序列首题
      const idx = (order.length ? order : flatItems.map((_, i) => i)).findIndex((_, i) => i < currentIdx && flatItems[i] && flatItems[i].si === current.si - 1);
      setCurrentIdx(idx > -1 ? idx : 0);
    }
  };
  const goNextSeq = () => {
    if (!current) return;
    if (current.si < sequences.length - 1) {
      const nextSeq = sequences[current.si + 1];
      const first = flatItems.findIndex((x) => x.si === current.si + 1);
      if (first > -1) { stopAudio(); setCurrentIdx(first); }
    }
  };
  const toggleShuffle = () => {
    stopAudio();
    if (!shuffled) {
      const arr = flatItems.map((_, i) => i);
      for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
      setOrder(arr);
      setCurrentIdx(0);
    } else {
      setOrder([]);
      setCurrentIdx(0);
    }
    setShuffled(!shuffled);
  };
  const handleResetProgress = () => {
    if (!window.confirm("确定重置当前课程进度？")) return;
    stopAudio();
    setCurrentIdx(0);
    setElapsed(0);
  };
  const togglePause = () => {
    // 全局唯一音频：暂停→stopGlobalAudio 复位；恢复→重新从盲听阶段开始
    if (isPaused) {
      setIsPaused(false);
      if (current?.russian) runStageChain(current.russian);
    } else {
      stopGlobalAudio();
      seqPlayRef.current = null;
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
    const suffix = isLocal ? '?src=local' : '';
    const dq = `${suffix ? '&' : '?'}difficulty=${difficulty || 'beginner'}${customTypes && customTypes.length ? '&custom=' + encodeURIComponent(customTypes.join(',')) : ''}`;
    if (mode.key === 'listening') {
      // 原地开启：难度直接生效（重新过滤 + 从头开始）
      setDiffKey(difficulty || 'beginner');
      if (customTypes && customTypes.length) setCustomTypes(customTypes);
      setShowModePicker(false); return;
    }
    setShowModePicker(false);
    const mk = (mode.key === 'chinese_to_english' || mode.key === 'dictation' || mode.key === 'speaking') ? mode.key : 'chinese_to_english';
    // 切换模式 → 先进入沉浸式预加载页（真实资源预载），完成后自动跳对应答题页
    navigate(`/preload/${mk}/${u}${suffix}${dq}`);
  };

  // ---- 点击弹窗外部关闭倍速设置 ----
  useEffect(() => {
    if (!popover) return;
    const onDoc = (e) => {
      if (e.target && e.target.closest && !e.target.closest('[data-speed-pop]')) setPopover(null);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [popover]);

  // ---- 词典预热：首次答对时标注即时生效 ----
  useEffect(() => {
    const t = setTimeout(async () => { await ensureDictFull(); warmUpIndex(); }, 600);
    return () => clearTimeout(t);
  }, []);

  // ---- 答对后逐词标注：词性颜色 / 重音 / 性数格（与中译俄一致） ----
  useEffect(() => {
    if (!current) { setAnnot([]); return; }
    const ws = (Array.isArray(current.words) && current.words.length) ? current.words : [];
    const hasMark = ws.some(w => (w.pos && w.pos !== "default") || w.grammarLabel || (w.form && w.form !== w.lemma));
    const toAnnot = (arr) => arr.map((w) => ({
      ...w,
      posColor: w.posColor || (w.pos ? getPosColor(w.pos) : ""),
      grammarLabel: w.grammarLabel || buildGrammarLabel({ pos: w.pos, grammaticalCase: w.grammarCase || w.grammar_case, number: w.number, gender: w.gender, tense: w.tense, aspect: w.aspect, person: w.person }),
    }));
    if (hasMark) { setAnnot(toAnnot(ws)); return; }
    let alive = true;
    (async () => {
      await ensureDictFull();
      const arr = annotateWords(current.russian);
      if (alive && arr.length) setAnnot(toAnnot(arr));
    })();
    return () => { alive = false; };
  }, [current]);

  // ---- 生词本：Ctrl+N（设置弹窗可改键位） ----
  const addVocab = () => {
    if (!current) return;
    try {
      const KEY = 'rlearn_vocab';
      const list = JSON.parse(localStorage.getItem(KEY) || '[]');
      const ru = (current.russian || "").trim();
      if (!ru) return;
      if (!list.some(v => v.ru === ru)) {
        list.unshift({ ru, zh: (current.chinese || "").trim(), at: Date.now() });
        localStorage.setItem(KEY, JSON.stringify(list));
        toast('已加入生词本');
      } else {
        toast('已在生词本中');
      }
    } catch (e) { /* 忽略 */ }
  };

  // ---- 键盘快捷键（与底部栏键位一致；设置弹窗可改键位，即时生效） ----
  useEffect(() => {
    const onKey = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (document.querySelector('.qs-mask')) return; // 设置弹窗打开时禁用
      const k = keysOfEvent(e);
      if (!k) return;
      // 底部栏固定键位：Shift← 上一题 / Shift→ 下一题 / ← 上一阶段 / → 下一阶段
      if (k === 'shift+arrowleft') { e.preventDefault(); goPrev(); return; }
      if (k === 'shift+arrowright') { e.preventDefault(); goNext(); return; }
      if (k === 'arrowleft') { e.preventDefault(); goPrevSeq(); return; }
      if (k === 'arrowright') { e.preventDefault(); goNextSeq(); return; }
      // 设置弹窗可改键位（rlearn_quest_hotkeys）
      const hk = loadHotkeys();
      let act = null;
      for (const id in hk) { if (hk[id] === k) { act = id; break; } }
      if (!act) return;
      e.preventDefault();
      switch (act) {
        case 'toggleSpeech': // Space：开始 / 暂停
          if (!ready) { setReady(true); if (current) runStageChain(current.russian); }
          else togglePause();
          break;
        case 'pauseGame': togglePause(); break;
        case 'addVocab': addVocab(); break;
        case 'courseContent': setShowLearning(true); break;
        case 'wordByWord': playSingleSlow(); break;
        case 'playSound': if (current) runStageChain(current.russian); break;
        case 'toggleSettings': setShowSettings(true); break;
        case 'toggleNotes': setShowNote(true); break;
        default: break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePause, goPrev, goNext, goPrevSeq, goNextSeq, ready, current, runStageChain, playSingleSlow]);

  // ---- 笔记 ----
  const [noteText, setNoteText] = useState("");
  const [annot, setAnnot] = useState([]);
  const saveNote = () => {
    if (!current) return;
    try {
      const KEY = 'rlearn_quest_notes';
      const list = JSON.parse(localStorage.getItem(KEY) || '[]');
      list.unshift({
        id: 'qn' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        unitId: effectiveCourseId,
        courseId: courseId || effectiveCourseId,
        mode: 'listening',
        ru: (current.russian || "").trim(),
        zh: (current.chinese || "").trim(),
        note: noteText.trim(),
        createdAt: Date.now(),
      });
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch (e) { /* 忽略 */ }
    toast('已记录通关笔记');
    setNoteText("");
    setShowNote(false);
  };

  // ---- 渲染 ----
  if (loading) {
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontSize: 16, color: "#888" }}>加载中…{ttsProgress && ttsProgress.total > 0 ? ' 发音 ' + ttsProgress.done + '/' + ttsProgress.total : ""}</div>;
  }
  if (loadError) {
    return <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", gap: 12 }}>
      <div style={{ fontSize: 15, color: "#666" }}>{loadError}</div>
      <button onClick={() => window.location.reload()} style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}>重试</button>
    </div>;
  }
  if (!total || !current) {
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontSize: 15, color: "#888" }}>暂无学习内容</div>;
  }

  const title = unitMeta?.title || (currentSequence?.familyName) || "听力练习";
  const showCard = phase === 'answer' || showAnswerMode; // 慢听阶段不显示答案，仅答案阶段显示

  // ===== 准备界面（对标句乐部"准备好了吗？点我开始"） =====
  if (!ready) {
    return (
      <div style={{ position: "fixed", inset: 0, ...THEME_OF(ui).vars, background: BG_STYLE(ui).background, display: "flex", flexDirection: "column", zIndex: 100 }}>
        <div style={{ position: "relative", display: "flex", height: 64, alignItems: "center", justifyContent: "space-between", padding: "0 24px", borderBottom: "1px solid var(--qs-border, #f0f0f4)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <button onClick={() => setShowExit(true)} aria-label="退出游戏" title="退出游戏" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 4, border: "none", background: "transparent", cursor: "pointer", color: "var(--qs-text)" }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M17 9L20 12L17 15" />
                <path d="M5 5H19" />
                <path d="M5 12H14" />
                <path d="M5 19H19" />
              </svg>
            </button>
            <span style={{ fontSize: 18, color: "var(--qs-text)", fontWeight: 500 }}>（{currentIdx + 1}/{total})</span>
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 28, background: "linear-gradient(135deg, rgba(139,92,246,0.05), rgba(59,130,246,0.05))" }}>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 28, fontWeight: 600, color: "var(--qs-text)", letterSpacing: 0.5 }}>准备好了吗？点我开始</p>
            <p style={{ fontSize: 14, color: "#9ca3af", marginTop: 10 }}>盲听 → 慢听 → 答案，三段自动推进</p>
          </div>
          <button onClick={handleStart} style={{ padding: "14px 48px", borderRadius: 999, background: "#7C3AED", color: "#fff", fontSize: 16, fontWeight: 600, border: "none", cursor: "pointer", boxShadow: "0 10px 30px rgba(124,58,237,0.35)", transition: "transform .15s" }} onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.97)")} onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}>
            开始听力
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#6b7280", fontSize: 13 }}>
            <kbd style={{ borderRadius: 8, background: "var(--qs-surface2)", padding: "6px 12px", fontSize: 13, color: "var(--qs-text)", border: "1px solid var(--qs-border)", boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.06)" }}>Space</kbd>
            <span>或按空格键开始</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {coverText && (
        <div style={{ position: "fixed", inset: 0, zIndex: 400, background: "linear-gradient(160deg, #0b0b12 0%, #17102b 55%, #2a1a4d 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24 }}>
          <div style={{ fontSize: 17, color: "#fff", letterSpacing: 0.5 }}>{coverText}</div>
          <div style={{ width: 240, height: 5, borderRadius: 999, background: "rgba(255,255,255,0.14)", overflow: "hidden" }}>
            <div style={{ width: "45%", height: "100%", borderRadius: 999, background: "#A78BFA", animation: "listenCoverSlide 1.1s ease-in-out infinite" }} />
          </div>
          <style>{`@keyframes listenCoverSlide { 0% { margin-left: -45%; } 100% { margin-left: 100%; } }`}</style>
        </div>
      )}
    <div style={{ position: "fixed", inset: 0, ...THEME_OF(ui).vars, background: BG_STYLE(ui).background, display: "flex", flexDirection: "column", zIndex: 100 }}>
      {/* ===== 顶栏 h-16（对标句乐部） ===== */}
      <div style={{ position: "relative", display: "flex", height: 64, alignItems: "center", justifyContent: "space-between", padding: "0 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24, maxWidth: "90%" }}>
          <button onClick={() => setShowExit(true)} title="退出游戏" aria-label="退出游戏" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 4, border: "none", background: "transparent", cursor: "pointer", color: "#111" }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M17 9L20 12L17 15" />
              <path d="M5 5H19" />
              <path d="M5 12H14" />
              <path d="M5 19H19" />
            </svg>
          </button>
          <span style={{ fontSize: 18, color: "var(--qs-text)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            （{currentIdx + 1}/{total})
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "nowrap" }}>
          <button style={{ ...iconBtn, color: "var(--qs-text)" }} onClick={() => setShowSettings(true)} title="设置"><Icon name="gear" /></button>
          <button style={{ ...iconBtn, color: showAnswerMode ? "#7C3AED" : "#111" }} onClick={() => setShowAnswerMode(v => !v)} title={showAnswerMode ? "关闭看答案模式" : "开启看答案模式"}><Icon name="bookOpen" /></button>
          <button style={{ ...iconBtn, color: "var(--qs-text)" }} onClick={() => setShowLearning(true)} title="查看课程学习内容（Ctrl+1）"><Icon name="notebook" /></button>
          <button style={{ ...iconBtn, color: "var(--qs-text)" }} onClick={() => setShowTree(true)} title="句子树"><Icon name="tree" /></button>
          <button style={{ ...iconBtn, color: "var(--qs-text)" }} onClick={() => setShowModePicker(true)} title="切换游戏模式"><Icon name="gamepad" /></button>
          <button style={{ ...iconBtn, color: shuffled ? "#7C3AED" : "#111" }} onClick={toggleShuffle} title={shuffled ? "恢复正序" : "乱序模式"}><Icon name="shuffle" /></button>
          <button style={{ ...iconBtn, color: "var(--qs-text)" }} onClick={togglePause} title={isPaused ? "继续播放" : "暂停"}>{isPaused ? <Icon name="play" /> : <Icon name="pause" />}</button>
          <button style={{ ...iconBtn, color: "var(--qs-text)" }} onClick={handleResetProgress} title="重置当前课程进度"><Icon name="rotateCcw" /></button>
          <button style={{ ...iconBtn, color: "var(--qs-text)" }} onClick={() => setShowReport(true)} title="报告错误"><Icon name="alert" /></button>
          <button style={{ ...iconBtn, color: "var(--qs-text)" }} onClick={toggleFullscreen} title="全屏"><Icon name="maximize" /></button>
        </div>
      </div>

      {/* ===== 计时器行 ===== */}
      <div style={{ padding: "12px 24px 4px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <p style={{ width: "4.5rem", fontSize: 18, fontWeight: 500, fontVariantNumeric: "tabular-nums", color: "var(--qs-sub)" }}>{formatTime(elapsed)}</p>
          {phase !== 'answer' && (
            <span style={{ fontSize: 12, color: "var(--qs-sub)", background: "var(--qs-surface2)", borderRadius: 999, padding: "2px 10px" }}>
              {phase === 'blind' ? '盲听阶段' : phase === 'slow' ? '慢听阶段' : ''}
            </span>
          )}
        </div>
      </div>

      {/* ===== 游戏区 ===== */}
      <div style={{ flex: 1, padding: 6, display: "flex", minHeight: 0 }}>
        <div className="game-layers" style={{ flex: 1, borderRadius: 16, background: "var(--qs-surface)", padding: "6px 24px", display: "flex", position: "relative" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: "16px 0", position: "relative" }}>
            {/* 倍速区（顶部居中） */}
            <div style={{ position: "absolute", left: "50%", top: 4, transform: "translateX(-50%)", zIndex: 50 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, position: "relative" }}>
                {['blind', 'slow', 'answer'].map((key, ki) => (
                  <div key={key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {ki > 0 && <div style={{ width: 12, height: 1, background: "rgba(0,0,0,0.15)" }} />}
                    <div style={{ display: "flex", alignItems: "stretch", borderRadius: 999, border: "1px solid", borderColor: phase === key ? "#7C3AED" : "#e5e7eb", background: phase === key ? "rgba(124,58,237,0.1)" : "rgba(243,244,246,0.6)", color: phase === key ? "#111" : "#6b7280", overflow: "hidden", transition: "background .2s,border-color .2s" }} data-speed-pop>
                      <button onClick={() => { stopAudio(); playStageOnly(key); }} title={`${cfg[key].label}（${cfg[key].times}次 × ${cfg[key].speed}x）`} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px 6px 12px", border: "none", background: "transparent", cursor: "pointer", color: "inherit", fontFamily: "inherit" }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={cfg[key].on ? "#7C3AED" : "#d1d5db"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        <span style={{ fontSize: 12, fontWeight: 500, color: phase === key ? "#111" : (cfg[key].on ? "#374151" : "#9ca3af") }}>{cfg[key].label}</span>
                        <span style={{ fontSize: 10, fontVariantNumeric: "tabular-nums", opacity: 0.75, color: "inherit" }}>
                          <span style={{ display: "inline-block", width: "1.35em", textAlign: "right" }}>×{cfg[key].times}</span>
                          <span style={{ display: "inline-block", width: "2.35em", textAlign: "right" }}>{cfg[key].speed}x</span>
                        </span>
                      </button>
                      <button onClick={() => setPopover(popover === key ? null : key)} aria-label={`${cfg[key].label}设置`} data-speed-pop style={{ display: "flex", alignItems: "center", borderLeft: "1px solid rgba(0,0,0,0.08)", padding: "0 8px", borderTop: "none", borderBottom: "none", borderRight: "none", background: "transparent", cursor: "pointer", color: "#6b7280" }}>
                        <Icon name="gear" size={13} />
                      </button>
                    </div>
                  </div>
                ))}
                {/* 倍速设置弹窗 */}
                {popover && (
                  <div data-speed-pop style={{ position: "absolute", top: 44, left: "50%", transform: "translateX(-50%)", zIndex: 999, width: 224, borderRadius: 12, border: "1px solid #e5e7eb", background: "#fff", boxShadow: "0 12px 40px rgba(0,0,0,0.15)", padding: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(0,0,0,0.06)", paddingBottom: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: "#111" }}>{cfg[popover].label}</span>
                      <button role="switch" aria-checked={cfg[popover].on} onClick={() => setCfg({ ...cfg, [popover]: { ...cfg[popover], on: !cfg[popover].on } })} style={{ width: 36, height: 20, borderRadius: 999, border: "none", cursor: "pointer", background: cfg[popover].on ? "#7C3AED" : "#e5e7eb", position: "relative", transition: "background .2s" }}>
                        <span style={{ position: "absolute", top: 2, left: cfg[popover].on ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left .2s" }} />
                      </button>
                    </div>
                    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ fontSize: 12, color: "#6b7280", width: 34 }}>次数</span>
                        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
                          <input type="range" min="1" max="5" step="1" value={cfg[popover].times} onChange={(e) => setCfg({ ...cfg, [popover]: { ...cfg[popover], times: Number(e.target.value) } })} style={{ flex: 1, accentColor: "#7C3AED", cursor: "pointer" }} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#7C3AED", width: 18, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{cfg[popover].times}</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ fontSize: 12, color: "#6b7280", width: 34 }}>速度</span>
                        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
                          <input type="range" min="0.5" max="2" step="0.1" value={cfg[popover].speed} onChange={(e) => setCfg({ ...cfg, [popover]: { ...cfg[popover], speed: Number(e.target.value) } })} style={{ flex: 1, accentColor: "#7C3AED", cursor: "pointer" }} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#7C3AED", width: 40, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{cfg[popover].speed}x</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ===== 答题区 ===== */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", maxWidth: 1024, padding: "16px 0" }}>
              {!showCard ? (
                <div style={{ fontSize: 28, color: "#6b7280", fontWeight: 500, letterSpacing: 1 }}>请仔细聆听</div>
              ) : (
                <>
                  {/* 词卡行：每词一张 word-card（中译俄格式：重音符→大字→词性色下划线→中文→性数格→词性） */}
                  <div style={{ position: "relative", display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "flex-start", gap: 16, animation: "listen-fade .3s ease" }}>
                    {(annot.length ? annot : [{ form: current.stressMarked || current.russian, lemma: current.russian, pos: "", posColor: "", grammarLabel: "", roleLabel: "", chinese: current.chinese }]).map((w, i) => {
                      const color = w.posColor || "#9CA3AF";
                      const roleLabel = w.roleLabel || "";
                      const grammarLabel = w.grammarLabel || "";
                      const pl = getPosLabel(w.pos);
                      const showZh = annot.length <= 1 && (w.chinese || current.chinese);
                      const displayWord = w.form || w.lemma || "";
                      const plainWord = displayWord.replace(/\u0301/g, ""); // 大字不带重音，重音保留在灰色小字
                      return (
                        <div key={i} style={{ position: "relative", display: "inline-flex", flexDirection: "column", alignItems: "center", padding: "20px 24px 14px", minWidth: 120, border: "1px solid " + color + "60", borderRadius: 12, background: "var(--qs-surface2)", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
                          {roleLabel && roleLabel !== "待确认" && <span style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", padding: "2px 10px", borderRadius: 10, fontSize: 11, fontWeight: 700, color: "#fff", background: color, whiteSpace: "nowrap" }}>{roleLabel}</span>}
                          <div style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 4, marginTop: 4, minHeight: 18, fontFamily: '"PT Serif", Georgia, serif' }}>{displayWord}</div>
                          <div style={{ fontFamily: '"Nunito", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', fontSize: "2.5rem", fontWeight: 700, color: "#1F2937", lineHeight: 1.2, marginBottom: 6 }}>{plainWord}</div>
                          <div style={{ width: "100%", height: 4, borderRadius: 2, marginBottom: 8, minWidth: 50, background: color }} />
                          {showZh && <div style={{ fontSize: 14, color: "#4B5563", fontWeight: 500 }}>{w.chinese || current.chinese}</div>}
                          {grammarLabel && <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 2 }}>{grammarLabel}</div>}
                          {pl !== "其他" && <div style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 500, marginTop: 2 }}>{pl}</div>}
                        </div>
                      );
                    })}
                    <TipBtn label="逐词播放" keys={["Ctrl", "Shift", ","]} style={{ position: "absolute", top: -18, right: 4 }}>
                      <button onClick={() => { playSingleSlow(); }} aria-label="逐词播放" style={{ fontSize: 20, background: "none", border: "none", cursor: "pointer", color: "#6b7280", transition: "transform .15s" }} onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.95)")} onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}>
                        🐢
                      </button>
                    </TipBtn>
                  </div>
                  {/* 整句中文（多词句子时） */}
                  {annot.length > 1 && current.chinese && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 24, animation: "listen-fade .3s .06s ease both" }}>
                      <span style={{ whiteSpace: "pre-wrap", fontSize: 16, color: "#4B5563", fontWeight: 500 }}>{current.chinese}</span>
                    </div>
                  )}
                  {/* 卡片区：框外笔记按钮（居中） */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 16, animation: "listen-fade .3s .06s ease both" }}>
                    <button onClick={() => setShowNote(true)} title="笔记" aria-label="笔记" style={{ width: 32, height: 32, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: "rgba(0,0,0,0.05)", border: "none", cursor: "pointer", color: "#6b7280", transition: "background .15s" }} onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.09)")} onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.05)")}>
                      <Icon name="notebook" size={17} />
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* 底部快捷键栏（句乐部样式）：上一题 · 暂停 · 生词 · 上一阶段 · 下一阶段 · 下一题 */}
            <div style={{ pointerEvents: "none", zIndex: 20, display: "flex", flexWrap: "nowrap", alignItems: "center", justifyContent: "center", gap: "14px 20px", maxWidth: "calc(100% - 5rem)", position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", width: "100%" }}>
              <div style={{ pointerEvents: "auto", marginRight: 330 }}>
                <TipBtn label="上一题" keys={["Shift", "←"]}>
                  <button onClick={goPrev} disabled={currentIdx === 0} aria-label="上一题" style={{ width: 30, height: 30, display: "grid", placeItems: "center", borderRadius: "50%", border: "none", background: "transparent", color: currentIdx === 0 ? "var(--qs-sub)" : "var(--qs-text)", cursor: currentIdx === 0 ? "not-allowed" : "pointer", transition: "background .2s, color .2s" }} onMouseEnter={(e) => { if (currentIdx > 0) { e.currentTarget.style.background = "rgba(0,0,0,0.04)"; e.currentTarget.style.color = "var(--qs-text)"; } }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = currentIdx === 0 ? "var(--qs-sub)" : "var(--qs-text)"; }}>
                    <Icon name="caretLeft" size={18} />
                  </button>
                </TipBtn>
              </div>
              <button onClick={togglePause} style={{ display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 6, border: "none", background: "transparent", color: "#374151", fontSize: 13, cursor: "pointer", padding: "6px 10px", pointerEvents: "auto" }}>
                <kbd style={{ borderRadius: 6, background: "var(--qs-surface2)", padding: "3px 6px", fontSize: 11, fontWeight: 500, color: "var(--qs-text)", border: "1px solid var(--qs-border)", boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.05)" }}>Space</kbd>
                <span>暂停</span>
              </button>
              <button onClick={addVocab} style={{ display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 6, border: "none", background: "transparent", color: "#374151", fontSize: 13, cursor: "pointer", padding: "6px 10px", pointerEvents: "auto" }}>
                <kbd style={{ borderRadius: 6, background: "var(--qs-surface2)", padding: "3px 6px", fontSize: 11, fontWeight: 500, color: "var(--qs-text)", border: "1px solid var(--qs-border)", boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.05)" }}>Ctrl N</kbd>
                <span>生词</span>
              </button>
              <button onClick={goPrevSeq} style={{ display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 6, border: "none", background: "transparent", color: "#374151", fontSize: 13, cursor: "pointer", padding: "6px 10px", pointerEvents: "auto" }}>
                <span>← 上一阶段</span>
              </button>
              <button onClick={goNextSeq} style={{ display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 6, border: "none", background: "transparent", color: "#374151", fontSize: 13, cursor: "pointer", padding: "6px 10px", pointerEvents: "auto" }}>
                <span>下一阶段 →</span>
              </button>
              <div style={{ pointerEvents: "auto", marginLeft: 330 }}>
                <TipBtn label="下一题" keys={["Shift", "→"]}>
                  <button onClick={goNext} aria-label="下一题" style={{ width: 30, height: 30, display: "grid", placeItems: "center", borderRadius: "50%", border: "none", background: "transparent", color: "var(--qs-text)", cursor: "pointer", transition: "background .2s, color .2s" }} onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.04)"; e.currentTarget.style.color = "var(--qs-text)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--qs-text)"; }}>
                    <Icon name="caretRight" size={18} />
                  </button>
                </TipBtn>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== 弹窗 ===== */}
      {showSettings && <SettingsModal onClose={() => {
        setShowSettings(false);
        refreshSettings();
        const u = loadUi();
        setCfg({
          blind: { on: u.listenBlind !== false, times: u.listenBlindTimes ?? 2, speed: u.listenBlindSpeed ?? 1, label: "盲听" },
          slow:  { on: u.listenSlow !== false, times: u.listenSlowTimes ?? 2, speed: u.listenSlowSpeed ?? 0.7, label: "慢听" },
          answer:{ on: u.listenAns !== false, times: u.listenAnsTimes ?? 1, speed: u.listenAnsSpeed ?? 1, label: "答案" },
        });
      }} />}
      {showModePicker && (
        <ModePickerModal
          title={title}
          modes={COURSE_MODES}
          onClose={() => setShowModePicker(false)}
          onStart={handleModeStart}
        />
      )}
      {showLearning && current && (
        <LearningContentModal
          title={current.russian}
          sentences={[current.russian]}
          unitId={effectiveCourseId}
          onClose={() => setShowLearning(false)}
          onPractice={() => { setShowLearning(false); }}
        />
      )}
      {showTree && current && (
        <SentenceTreeModal
          sentence={current.russian}
          chinese={current.chinese}
          onClose={() => setShowTree(false)}
        />
      )}
      {showReport && current && (
        <ReportErrorModal
          sentence={current.russian}
          context={`${title} 听力题`}
          onClose={() => setShowReport(false)}
        />
      )}

      {/* 单词笔记弹窗 */}
      {showNote && current && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setShowNote(false)}>
          <div style={{ width: "min(420px, 94vw)", background: "#fff", borderRadius: 16, boxShadow: "0 24px 80px rgba(0,0,0,0.3)", overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #f0f0f4" }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111" }}>通关笔记</h3>
              <button onClick={() => setShowNote(false)} style={{ width: 28, height: 28, borderRadius: "50%", border: "none", background: "#f3f4f6", color: "#555", cursor: "pointer", fontSize: 13 }}>✕</button>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 24, fontWeight: 600, color: "#7C3AED" }}>{current.russian}</span>
                {current.stressMarked && current.stressMarked !== (current.russian || "").trim() && (
                  <span style={{ fontSize: 14, color: "#9ca3af" }}>{current.stressMarked}</span>
                )}
              </div>
              <div style={{ fontSize: 15, color: "#374151" }}>{current.chinese}</div>
              <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="记录你的通关笔记（本句的要点、易错点、记忆技巧…）" style={{ width: "100%", minHeight: 90, borderRadius: 10, border: "1px solid #e5e7eb", padding: "10px 12px", fontSize: 14, outline: "none", resize: "vertical", fontFamily: "inherit" }} />
            </div>
            <div style={{ padding: "14px 20px", borderTop: "1px solid #f0f0f4", display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setShowNote(false)} style={{ borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", color: "#374151", padding: "9px 18px", fontSize: 14, cursor: "pointer" }}>取消</button>
              <button onClick={saveNote} style={{ borderRadius: 10, border: "none", background: "#7C3AED", color: "#fff", padding: "9px 18px", fontSize: 14, cursor: "pointer", fontWeight: 500 }}>记录笔记</button>
            </div>
          </div>
        </div>
      )}

      {/* 退出游戏确认弹窗（对标句乐部） */}
      <ExitConfirmModal
        open={showExit}
        onClose={() => setShowExit(false)}
        courseId={studyCourseId}
      />

      {/* 悟空 AI 助手（右下角浮动孙悟空，点击弹出 AI 问答弹窗） */}
      <WukongAiAssistant statement={current} modeLabel="听力" />

      <style>{`
        @keyframes listen-fade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
    </>
  );
}

const iconBtn = {
  display: "flex", alignItems: "center", justifyContent: "center",
  width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent",
  cursor: "pointer", transition: "background .15s, color .15s",
};
