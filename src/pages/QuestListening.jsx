// QuestListening.jsx —— 听力模式答题页（1:1 对标句乐部听力模式）
// 流程：新题 → 盲听（只听不看"请仔细聆听"）→ 慢听（词卡+慢速0.7x）→ 答案（1x）→ 停留
// 布局：顶栏(退出+标题+10图标) / 计时器行 / 游戏区(倍速胶囊+词卡+上下题+底部快捷键) / AI学习助手
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { checkUnitAccess } from "../lib/courseAccess";
import { findLocalUnitById } from "../utils/storage";
import { apiFetch } from "../lib/api";
import { markUnitDone } from "../lib/lessonProgress";
import { addStudyTime } from "../lib/learningStats";
import { addDailyExp } from "../lib/questStats";
import { expandSequencesWithChunks } from "../lib/chunking";
import ModePickerModal, { COURSE_MODES } from "../components/ModePickerModal";
import SettingsModal from "../components/SettingsModal";
import Icon from "../components/TopBarIcons";
import LearningContentModal from "../components/LearningContentModal";
import SentenceTreeModal from "../components/SentenceTreeModal";
import ReportErrorModal from "../components/ReportErrorModal";
import { toast } from "../lib/toast";
import { getPosColor, getPosLabel, buildGrammarLabel } from "../constants/posColors";
import { ensureDictFull, annotateWords, warmUpIndex } from "../lib/wordAnnotate";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";
const DEFAULT_UNIT_ID = "u1";

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

export default function QuestListening() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const effectiveCourseId = courseId || DEFAULT_UNIT_ID;

  const [loading, setLoading] = useState(true);
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

  // 顶栏弹窗
  const [showSettings, setShowSettings] = useState(false);
  const [showModePicker, setShowModePicker] = useState(false);
  const [showLearning, setShowLearning] = useState(false);
  const [showTree, setShowTree] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showAnswerMode, setShowAnswerMode] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [showNote, setShowNote] = useState(false);

  // 倍速设置
  const [cfg, setCfg] = useState({ ...DEFAULT_CFG });
  const [popover, setPopover] = useState(null); // 'blind'|'slow'|'answer'|null

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
      try {
        const isLocal = new URLSearchParams(window.location.search).get("src") === "local";
        const isBackendUnit = String(effectiveCourseId).startsWith("unit_");
        if (isLocal || isBackendUnit) {
          let stored = null;
          try { stored = JSON.parse(sessionStorage.getItem("rlearn_local_lesson_" + effectiveCourseId) || "null") } catch (e) { stored = null }
          if (!(stored && Array.isArray(stored.sentences) && stored.sentences.length)) stored = findLocalUnitById(effectiveCourseId);
          if (stored && Array.isArray(stored.sentences) && stored.sentences.length) {
            const adapted = adaptLocalLesson(stored);
            if (!cancelled) {
              setLocalLesson(stored);
              setIsLocalMode(true);
              setUnitMeta({ title: stored.title || stored.name || "本课", description: stored.description || "" });
              setSequences(expandSequencesWithChunks(adapted, stored?.words));
            }
            if (!cancelled) setLoading(false);
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
                if (u && Array.isArray(u.sentences) && u.sentences.length) {
                  const adapted = adaptLocalLesson(u);
                  if (!cancelled) {
                    setLocalLesson(u);
                    setIsLocalMode(true);
                    setUnitMeta({ title: u.title || u.name || "本课", description: u.description || "" });
                    setSequences(expandSequencesWithChunks(adapted, u?.words));
                  }
                  if (!cancelled) setLoading(false);
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
          if (adapted.length === 0) setLoadError("该单元没有可学习的步骤");
          else {
            setUnitMeta(data.unit || null);
            setSequences(expandSequencesWithChunks(adapted, null));
          }
        }
      } catch (e) {
        if (!cancelled) {
          if (!courseId) { navigate('/quest-store', { replace: true }); return; }
          setLoadError(`无法连接后端: ${e.message}`);
        }
      } finally {
        if (!cancelled) setLoading(false);
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

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // ---- TTS 播放 ----
  const stopAudio = useCallback(() => {
    chainRef.current += 1; // 使所有旧阶段链失效
    seqPlayRef.current = null;
    if (ttsRef.current) {
      try { ttsRef.current.pause(); ttsRef.current.onended = null; ttsRef.current = null; } catch (e) { /* 忽略 */ }
    }
  }, []);

  const playTimes = useCallback((url, speed, times, onDone) => {
    let left = times;
    const step = () => {
      if (seqPlayRef.current !== 'running') return;
      if (left <= 0) { onDone && onDone(); return; }
      left -= 1;
      const a = new Audio(url);
      a.playbackRate = speed;
      ttsRef.current = a;
      a.onended = () => setTimeout(step, 500);
      a.play().catch(() => setTimeout(step, 300)); // 播放失败（含自动播放拦截）也推进
    };
    step();
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
    try {
      const res = await fetch(`${API_BASE}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: "alena", id: effectiveCourseId, type: "listening" }),
      });
      const data = await res.json();
      if (data.ok && data.audio_url) url = data.audio_url.startsWith("http") ? data.audio_url : `${API_BASE}${data.audio_url}`;
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
      playTimes(url, st.cfg.speed, st.cfg.times, () => { si += 1; run(); });
    };
    run();
  }, [cfg, playTimes, stopAudio, effectiveCourseId]);

  // ---- 进入新题自动播放（须已点击"准备好了吗"以放行自动播放） ----
  useEffect(() => {
    if (!loading && !loadError && current && ready) {
      stopAudio();
      setPhase('standby');
      const t = setTimeout(() => runStageChain(current.russian), 400);
      return () => { clearTimeout(t); stopAudio(); };
    }
  }, [loading, loadError, currentIdx, current, ready, runStageChain]);

  const handleStart = () => {
    setReady(true);
    if (current) runStageChain(current.russian);
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
  const playStageOnly = useCallback(async (key) => {
    if (!current) return;
    const c = cfg[key];
    stopAudio();
    try {
      const res = await fetch(`${API_BASE}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: current.russian, voice: "alena", id: effectiveCourseId, type: "listening" }),
      });
      const data = await res.json();
      let url = data.ok && data.audio_url ? data.audio_url : null;
      if (!url) return;
      if (!url.startsWith("http")) url = `${API_BASE}${url}`;
      seqPlayRef.current = 'running';
      setPhase(key);
      playTimes(url, c.speed, Math.max(c.times, 1), () => { setPhase('answer'); seqPlayRef.current = null; });
    } catch (e) { /* 忽略 */ }
  }, [current, cfg, playTimes, stopAudio, effectiveCourseId]);

  const playSingleSlow = useCallback(() => {
    if (!current) return;
    stopAudio();
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/tts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: current.russian, voice: "alena", id: effectiveCourseId, type: "listening" }),
        });
        const data = await res.json();
        let url = data.ok && data.audio_url ? data.audio_url : null;
        if (!url) return;
        if (!url.startsWith("http")) url = `${API_BASE}${url}`;
        seqPlayRef.current = 'running';
        playTimes(url, 0.6, 1, () => { seqPlayRef.current = null; });
      } catch (e) { /* 忽略 */ }
    })();
  }, [current, playTimes, stopAudio, effectiveCourseId]);

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
    const a = ttsRef.current;
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
    const suffix = isLocal ? '?src=local' : '';
    if (mode.key === 'chinese_to_english') navigate(`/quest-practice/${u}${suffix}`);
    else if (mode.key === 'dictation') navigate(`/quest-dictation/${u}${suffix}`);
    else if (mode.key === 'listening') { setShowModePicker(false); }
    else navigate(`/quest-practice/${u}${suffix}`);
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
    const hasMark = ws.some(w => w.pos || w.grammarLabel || (w.form && w.form !== w.lemma));
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

  // ---- 键盘快捷键 ----
  useEffect(() => {
    const onKey = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.key === ' ') {
        e.preventDefault();
        if (!ready) { setReady(true); if (current) runStageChain(current.russian); }
        else togglePause();
      }
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'n' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); setShowAi(true); }
      else if (e.key === '1' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); setShowLearning(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePause, goPrev, goNext, ready, current, runStageChain]);

  // ---- AI 助手 ----
  const [aiQ, setAiQ] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiAns, setAiAns] = useState("");
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

  const askAi = async (q) => {
    const text = q || aiQ;
    if (!text.trim() || aiBusy) return;
    setAiBusy(true);
    setAiAns("思考中…");
    try {
      const res = await fetch(`${API_BASE}/api/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [
          { role: 'system', content: '你是俄语学习助手。用简洁中文回答学习者关于当前句子的发音、词汇、语法问题。' },
          { role: 'user', content: `当前学习的句子：${current?.russian || ''}（中文：${current?.chinese || ''}）。问题：${text}` },
        ] }),
      });
      const data = await res.json();
      setAiAns(data.content || "（无回答）");
    } catch (e) {
      setAiAns("AI 连接失败，请重试。");
    } finally {
      setAiBusy(false);
      setAiQ("");
    }
  };

  // ---- 渲染 ----
  if (loading) {
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontSize: 16, color: "#888" }}>加载中…</div>;
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
  const showCard = phase !== 'blind' || showAnswerMode;

  // ===== 准备界面（对标句乐部"准备好了吗？点我开始"） =====
  if (!ready) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "#fff", display: "flex", flexDirection: "column", zIndex: 100 }}>
        <div style={{ position: "relative", display: "flex", height: 64, alignItems: "center", justifyContent: "space-between", padding: "0 24px", borderBottom: "1px solid #f0f0f4" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <button onClick={() => navigate(-1)} aria-label="退出游戏" title="退出游戏" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 4, border: "none", background: "transparent", cursor: "pointer", color: "#111" }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M17 9L20 12L17 15" />
                <path d="M5 5H19" />
                <path d="M5 12H14" />
                <path d="M5 19H19" />
              </svg>
            </button>
            <span style={{ fontSize: 18, color: "#111", fontWeight: 500 }}>{title}（{currentIdx + 1}/{total})</span>
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 28, background: "linear-gradient(135deg, rgba(139,92,246,0.05), rgba(59,130,246,0.05))" }}>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 28, fontWeight: 600, color: "#111", letterSpacing: 0.5 }}>准备好了吗？点我开始</p>
            <p style={{ fontSize: 14, color: "#9ca3af", marginTop: 10 }}>盲听 → 慢听 → 答案，三段自动推进</p>
          </div>
          <button onClick={handleStart} style={{ padding: "14px 48px", borderRadius: 999, background: "#7C3AED", color: "#fff", fontSize: 16, fontWeight: 600, border: "none", cursor: "pointer", boxShadow: "0 10px 30px rgba(124,58,237,0.35)", transition: "transform .15s" }} onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.97)")} onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}>
            开始听力
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#6b7280", fontSize: 13 }}>
            <kbd style={{ borderRadius: 8, background: "#f3f4f6", padding: "6px 12px", fontSize: 13, color: "#111", border: "1px solid #d1d5db", boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.06)" }}>Space</kbd>
            <span>或按空格键开始</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#fff", display: "flex", flexDirection: "column", zIndex: 100 }}>
      {/* ===== 顶栏 h-16（对标句乐部） ===== */}
      <div style={{ position: "relative", display: "flex", height: 64, alignItems: "center", justifyContent: "space-between", padding: "0 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24, maxWidth: "90%" }}>
          <button onClick={() => navigate(-1)} title="退出游戏" aria-label="退出游戏" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 4, border: "none", background: "transparent", cursor: "pointer", color: "#111" }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M17 9L20 12L17 15" />
              <path d="M5 5H19" />
              <path d="M5 12H14" />
              <path d="M5 19H19" />
            </svg>
          </button>
          <span style={{ fontSize: 18, color: "#111", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {title}（{currentIdx + 1}/{total})
          </span>
        </div>
        <div style={{ display: "none", alignItems: "center", gap: 16, flexWrap: "nowrap" }} className="md:flex">
          <button style={{ ...iconBtn, color: "#111" }} onClick={() => setShowSettings(true)} title="设置"><Icon name="gear" /></button>
          <button style={{ ...iconBtn, color: showAnswerMode ? "#7C3AED" : "#111" }} onClick={() => setShowAnswerMode(v => !v)} title={showAnswerMode ? "关闭看答案模式" : "开启看答案模式"}><Icon name="bookOpen" /></button>
          <button style={{ ...iconBtn, color: "#111" }} onClick={() => setShowLearning(true)} title="查看课程学习内容（Ctrl+1）"><Icon name="notebook" /></button>
          <button style={{ ...iconBtn, color: "#111" }} onClick={() => setShowTree(true)} title="句子树"><Icon name="tree" /></button>
          <button style={{ ...iconBtn, color: "#111" }} onClick={() => setShowModePicker(true)} title="切换游戏模式"><Icon name="gamepad" /></button>
          <button style={{ ...iconBtn, color: shuffled ? "#7C3AED" : "#111" }} onClick={toggleShuffle} title={shuffled ? "恢复正序" : "乱序模式"}><Icon name="shuffle" /></button>
          <button style={{ ...iconBtn, color: "#111" }} onClick={togglePause} title={isPaused ? "继续播放" : "暂停"}>{isPaused ? <Icon name="play" /> : <Icon name="pause" />}</button>
          <button style={{ ...iconBtn, color: "#111" }} onClick={handleResetProgress} title="重置当前课程进度"><Icon name="rotateCcw" /></button>
          <button style={{ ...iconBtn, color: "#111" }} onClick={() => setShowReport(true)} title="报告错误"><Icon name="alert" /></button>
          <button style={{ ...iconBtn, color: "#111" }} onClick={toggleFullscreen} title="全屏"><Icon name="maximize" /></button>
        </div>
      </div>

      {/* ===== 计时器行 ===== */}
      <div style={{ padding: "12px 24px 4px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <p style={{ width: "4.5rem", fontSize: 18, fontWeight: 500, fontVariantNumeric: "tabular-nums", color: "#6b7280" }}>{formatTime(elapsed)}</p>
          {phase !== 'answer' && (
            <span style={{ fontSize: 12, color: "#9ca3af", background: "#f3f4f6", borderRadius: 999, padding: "2px 10px" }}>
              {phase === 'blind' ? '盲听阶段' : phase === 'slow' ? '慢听阶段' : ''}
            </span>
          )}
        </div>
      </div>

      {/* ===== 游戏区 ===== */}
      <div style={{ flex: 1, padding: 6, display: "flex", minHeight: 0 }}>
        <div className="game-layers" style={{ flex: 1, borderRadius: 16, background: "linear-gradient(135deg, rgba(139,92,246,0.06), rgba(59,130,246,0.06))", padding: "6px 24px", display: "flex", position: "relative" }}>
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
                  {/* 词卡：圆角卡片（句乐部样式：小字重音 → 大字词性色 → 中文 → 词性标签） */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", animation: "listen-fade .3s ease" }}>
                    <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minWidth: "min(560px, 92%)", padding: "36px 40px 26px", borderRadius: 24, border: "1px solid rgba(244,114,182,0.35)", background: "#fff", boxShadow: "0 2px 20px rgba(0,0,0,0.05)" }}>
                      {/* 🐢 逐词播放（卡片内右上角） */}
                      <button onClick={() => { playSingleSlow(); }} title="逐词播放" aria-label="逐词播放" style={{ position: "absolute", top: 12, right: 16, fontSize: 20, background: "none", border: "none", cursor: "pointer", color: "#6b7280", transition: "transform .15s" }} onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.95)")} onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}>
                        🐢
                      </button>
                      {/* 顶部小字：带重音词形 */}
                      <div style={{ fontSize: 16, letterSpacing: 1.5, color: "#9ca3af", fontWeight: 400 }}>
                        {annot.map(w => w.form || w.lemma).filter(Boolean).join(" ") || current.stressMarked || current.russian}
                      </div>
                      {/* 大字（词性着色） */}
                      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0 12px", lineHeight: 1.25 }}>
                        {annot.length > 1 ? (
                          annot.map((w, i) => (
                            <span key={i} style={{ fontSize: 44, fontWeight: 600, color: w.posColor || "#111", cursor: "pointer", transition: "color .2s" }} onMouseEnter={(e) => { if (!w.posColor) e.currentTarget.style.color = "#7C3AED"; }} onMouseLeave={(e) => { if (!w.posColor) e.currentTarget.style.color = "#111"; }}>
                              {w.form || w.lemma}
                            </span>
                          ))
                        ) : (
                          <span style={{ fontSize: 44, fontWeight: 600, color: annot[0]?.posColor || "#111", cursor: "pointer", transition: "color .2s" }} onMouseEnter={(e) => { if (!annot[0]?.posColor) e.currentTarget.style.color = "#7C3AED"; }} onMouseLeave={(e) => { if (!annot[0]?.posColor) e.currentTarget.style.color = "#111"; }}>
                            {current.stressMarked || current.russian}
                          </span>
                        )}
                      </div>
                      {/* 中文 + 笔记 */}
                      {current.chinese && (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 }}>
                          <span style={{ whiteSpace: "pre-wrap", fontSize: 20, color: "#6b7280", fontWeight: 400 }}>{current.chinese}</span>
                          <button onClick={() => setShowNote(true)} title="笔记" aria-label="笔记" style={{ width: 24, height: 24, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 6, background: "rgba(0,0,0,0.04)", border: "none", cursor: "pointer", color: "#6b7280", fontSize: 14 }}>
                            ✎
                          </button>
                        </div>
                      )}
                      {/* 标签行：性数格（灰胶囊） + 词性（词性色胶囊）分开显示 */}
                      {annot.some(w => w.grammarLabel || (w.pos && w.pos !== "default")) && (
                        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 6 }}>
                          {annot.map((w, i) => {
                            const pl = getPosLabel(w.pos);
                            const color = w.posColor || "#9ca3af";
                            return (
                              <span key={i} style={{ display: "flex", gap: 8 }}>
                                {w.grammarLabel && (
                                  <span style={{ fontSize: 12, fontWeight: 500, color: "#6b7280", background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 999, padding: "3px 12px" }}>{w.grammarLabel}</span>
                                )}
                                {pl !== "其他" && (
                                  <span style={{ fontSize: 12, fontWeight: 500, color, background: color + "14", border: "1px solid " + color + "3a", borderRadius: 999, padding: "3px 12px" }}>{pl}</span>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* 上一题/下一题（绝对定位左右） */}
            <div style={{ position: "absolute", left: 0, right: 0, top: "50%", transform: "translateY(-50%)", zIndex: 40, display: "flex", alignItems: "center", justifyContent: "space-between", pointerEvents: "none", padding: "0 8px" }}>
              <div style={{ pointerEvents: "auto" }}>
                <button onClick={goPrev} disabled={currentIdx === 0} aria-label="上一题" title="上一题（←）" style={{ width: 32, height: 32, display: "grid", placeItems: "center", borderRadius: "50%", border: "none", background: "transparent", color: currentIdx === 0 ? "#d1d5db" : "#6b7280", cursor: currentIdx === 0 ? "not-allowed" : "pointer", transition: "background .2s, color .2s" }} onMouseEnter={(e) => { if (currentIdx > 0) { e.currentTarget.style.background = "rgba(0,0,0,0.04)"; e.currentTarget.style.color = "#111"; } }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = currentIdx === 0 ? "#d1d5db" : "#6b7280"; }}>
                  <Icon name="caretLeft" size={20} />
                </button>
              </div>
              <div style={{ pointerEvents: "auto" }}>
                <button onClick={goNext} aria-label="下一题" title="下一题（→）" style={{ width: 32, height: 32, display: "grid", placeItems: "center", borderRadius: "50%", border: "none", background: "transparent", color: "#6b7280", cursor: "pointer", transition: "background .2s, color .2s" }} onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.04)"; e.currentTarget.style.color = "#111"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#6b7280"; }}>
                  <Icon name="caretRight" size={20} />
                </button>
              </div>
            </div>

            {/* 底部快捷键栏 */}
            <div style={{ pointerEvents: "none", zIndex: 20, display: "none", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: "8px 8px", maxWidth: "calc(100% - 5rem)", position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", width: "100%" }} className="min-[780px]:flex">
              <button onClick={togglePause} style={{ display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 6, border: "none", background: "transparent", color: "#374151", fontSize: 14, cursor: "pointer", padding: "8px 16px", pointerEvents: "auto" }}>
                <kbd style={{ borderRadius: 6, background: "#f3f4f6", padding: "4px 8px", fontSize: 12, fontWeight: 500, color: "#111", border: "1px solid #d1d5db", boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.05)" }}>Space</kbd>
                <span>暂停</span>
              </button>
              <button onClick={() => setShowAi(true)} style={{ display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 6, border: "none", background: "transparent", color: "#374151", fontSize: 14, cursor: "pointer", padding: "8px 16px", pointerEvents: "auto" }}>
                <kbd style={{ borderRadius: 6, background: "#f3f4f6", padding: "4px 8px", fontSize: 12, fontWeight: 500, color: "#111", border: "1px solid #d1d5db" }}>Ctrl N</kbd>
                <span>生词</span>
              </button>
              <button onClick={goPrevSeq} style={{ display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 6, border: "none", background: "transparent", color: "#374151", fontSize: 14, cursor: "pointer", padding: "8px 16px", pointerEvents: "auto" }}>
                <span>← 上一阶段</span>
              </button>
              <button onClick={goNextSeq} style={{ display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 6, border: "none", background: "transparent", color: "#374151", fontSize: 14, cursor: "pointer", padding: "8px 16px", pointerEvents: "auto" }}>
                <span>→ 下一阶段</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ===== AI 学习助手（浮动右下） ===== */}
      <button onClick={() => setShowAi(true)} aria-label="AI 学习助手" title="AI 学习助手" style={{ position: "fixed", right: 20, bottom: 20, width: 48, height: 48, borderRadius: "50%", border: "none", background: "linear-gradient(135deg,#7C3AED,#9333EA)", color: "#fff", fontSize: 18, cursor: "pointer", boxShadow: "0 8px 24px rgba(124,58,237,0.35)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600 }}>
        AI
      </button>

      {/* ===== 弹窗 ===== */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
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
          content={current.russian}
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

      {/* AI 学习助手弹窗 */}
      {showAi && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setShowAi(false)}>
          <div style={{ width: "min(560px, 96vw)", maxHeight: "80vh", background: "#fff", borderRadius: 18, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,0.35)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #f0f0f4" }}>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: "#111" }}>AI 学习助手</h2>
                <p style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>针对当前句子的发音、词汇、语法问题</p>
              </div>
              <button onClick={() => setShowAi(false)} style={{ width: 30, height: 30, borderRadius: "50%", border: "none", background: "#f3f4f6", color: "#555", cursor: "pointer", fontSize: 14 }}>✕</button>
            </div>
            <div style={{ padding: 16, overflowY: "auto", flex: 1 }}>
              <div style={{ marginBottom: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
                {["解释这句话", "逐词讲解", "语法分析", "怎么发音"].map((q) => (
                  <button key={q} onClick={() => askAi(q)} disabled={aiBusy} style={{ borderRadius: 999, border: "1px solid #e5e7eb", background: "#fff", color: "#374151", fontSize: 12, padding: "6px 12px", cursor: "pointer" }}>{q}</button>
                ))}
              </div>
              <div style={{ fontSize: 14, color: "#111", whiteSpace: "pre-wrap", lineHeight: 1.8, minHeight: 80, maxHeight: 300, overflowY: "auto", background: "#fafafa", borderRadius: 12, padding: 14 }}>
                {aiAns || "点击上方问题或输入你的问题，AI 将基于当前句子作答。"}
              </div>
            </div>
            <div style={{ padding: "12px 16px", borderTop: "1px solid #f0f0f4", display: "flex", gap: 8 }}>
              <input
                value={aiQ}
                onChange={(e) => setAiQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") askAi(); }}
                placeholder="输入问题，回车发送…"
                style={{ flex: 1, borderRadius: 10, border: "1px solid #e5e7eb", padding: "10px 14px", fontSize: 14, outline: "none" }}
              />
              <button onClick={() => askAi()} disabled={aiBusy} style={{ borderRadius: 10, border: "none", background: "#7C3AED", color: "#fff", padding: "0 20px", fontSize: 14, cursor: "pointer", fontWeight: 500 }}>发送</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes listen-fade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

const iconBtn = {
  display: "flex", alignItems: "center", justifyContent: "center",
  width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent",
  cursor: "pointer", transition: "background .15s, color .15s",
};
