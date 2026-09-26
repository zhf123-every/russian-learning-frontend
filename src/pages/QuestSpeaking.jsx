// QuestSpeaking.jsx —— 口语评测答题页（对标句乐部口语模式）
// 流程：长按麦克风朗读 → 松开发送 → AI 四维评分（总得分/准确度/流利度/完整度）
// 布局：顶栏(退出+标题+10图标) / 计时器行 / 游戏区(评分卡片+麦克风+词卡+底部快捷键) / AI学习助手
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
import SettingsModal, { loadHotkeys, keysOfEvent } from "../components/SettingsModal";
import { useQuestSettings, BG_STYLE, THEME_OF } from "../hooks/useQuestSettings";
import Icon from "../components/TopBarIcons";
import LearningContentModal from "../components/LearningContentModal";
import SentenceTreeModal from "../components/SentenceTreeModal";
import ReportErrorModal from "../components/ReportErrorModal";
import { toast } from "../lib/toast";
import { pipeline, env } from "@xenova/transformers";
env.allowLocalModels = false;   // 强制从 HuggingFace CDN 加载模型（免费、多人可用）
env.useBrowserCache = false;    // 走浏览器 HTTP 缓存（Cache API 在部分受限环境会异常）
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

export default function QuestSpeaking() {
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
  const [ready, setReady] = useState(true);       // 进页面即就绪（对标句乐部：黑屏加载后直接答题）
  const [shuffled, setShuffled] = useState(false);
  const [order, setOrder] = useState([]); // 乱序后的原始索引
  const [isPaused, setIsPaused] = useState(false);

  // 顶栏弹窗
  const [showSettings, setShowSettings] = useState(false);
  const { ui, settings, refreshSettings } = useQuestSettings();
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

  // ---- 口语评测状态 ----
  const [hoverMic, setHoverMic] = useState(false);
  const [recState, setRecState] = useState("idle"); // idle/recording/scored
  const [score, setScore] = useState({ total: 0, accuracy: 0, fluency: 0, completeness: 0 });
  const recRef = useRef(null);
  const recStartRef = useRef(0);
  const asrRef = useRef(null);
  let asrPromise = null;
  const [modelStatus, setModelStatus] = useState("idle"); // idle/loading/ready/error
  const [modelProgress, setModelProgress] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [modelError, setModelError] = useState("");

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

  // ---- TTS 发音源（与中译俄一致：voice=alena / type=statement；优先数据自带音频；同句缓存） ----
  const ttsUrlCacheRef = useRef({});
  const ensureTtsUrl = useCallback(async (text) => {
    if (!text) return "";
    if (ttsUrlCacheRef.current[text]) return ttsUrlCacheRef.current[text];
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
      url = await ensureTtsUrl(text);
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
  }, [cfg, playTimes, stopAudio, effectiveCourseId, ensureTtsUrl]);

  // ---- 进入新题自动播放（须已点击"准备好了吗"以放行自动播放） ----
  useEffect(() => {
    if (!loading && !loadError && current && ready && ui.speakAutoPlay !== false) {
      stopAudio();
      setPhase('standby');
      const t = setTimeout(() => runStageChain(current.russian), 400);
      return () => { clearTimeout(t); stopAudio(); };
    }
  }, [loading, loadError, currentIdx, current, ready, runStageChain, ui.speakAutoPlay]);

  // ---- 本地 Whisper 识别与四维评分（浏览器本地推理，免费多人可用） ----
  function normTokens(text) {
    return String(text || "").toLowerCase().replace(/[.,!?;:«»"'()\-—…\s]+/g, " ").trim().split(/\s+/).filter(Boolean);
  }
  function editDist(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    return dp[m][n];
  }
  function computeScores(whisperOut, targetRu, recDur) {
    const hypTokens = normTokens(whisperOut && whisperOut.text);
    const refTokens = normTokens(targetRu);
    if (!refTokens.length || !hypTokens.length) return { total: 0, accuracy: 0, fluency: 0, completeness: 0 };
    // 准确度：词级编辑距离相似度
    const ed = editDist(hypTokens, refTokens);
    const accuracy = Math.max(0, Math.round((1 - ed / Math.max(refTokens.length, hypTokens.length)) * 100));
    // 完整度：标准词命中比例（容忍词形变化：4字母以上前缀匹配）
    let hit = 0;
    for (const rt of refTokens) {
      const isHit = hypTokens.some(ht => ht === rt || (ht.length >= 4 && rt.length >= 4 && (ht.startsWith(rt.slice(0, 4)) || rt.startsWith(ht.slice(0, 4)))));
      if (isHit) hit++;
    }
    const completeness = Math.round((hit / refTokens.length) * 100);
    // 流利度：词时间戳（语速 + 停顿惩罚）
    let fluency = 70;
    try {
      const words = (whisperOut && whisperOut.chunks || []).flatMap(c => (c.words || []).filter(w => w && typeof w.start === "number"));
      if (words.length >= 2) {
        const dur = Math.max(words[words.length - 1].end - words[0].start, 0.6);
        const wps = words.length / dur;
        const gaps = words.slice(1).filter((w, i) => (w.start - words[i].end) > 0.8).length;
        fluency = Math.max(0, Math.min(100, Math.round(100 - Math.abs(wps - 2.2) * 12 - gaps * 10)));
      } else if (recDur > 0) {
        const wps = hypTokens.length / recDur;
        fluency = Math.max(0, Math.min(100, Math.round(100 - Math.abs(wps - 2.0) * 20)));
      }
    } catch (e) { fluency = 70; }
    const total = Math.round(accuracy * 0.4 + fluency * 0.3 + completeness * 0.3);
    return { total, accuracy, fluency, completeness };
  }
  async function loadASR() {
    if (asrRef.current) return asrRef.current;
    if (asrPromise) return asrPromise;
    setModelStatus("loading");
    setModelProgress(0);
    asrPromise = (async () => {
      const modelName = "Xenova/whisper-" + (settings.whisperModel || "tiny");
      const pipe = await pipeline("automatic-speech-recognition", modelName, {
        progress_callback: (pp) => {
          if (pp && pp.status === "progress" && typeof pp.progress === "number") setModelProgress(Math.round(pp.progress));
        },
      });
      asrRef.current = pipe;
      setModelStatus("ready");
      return pipe;
    })().catch((e) => { asrPromise = null; setModelStatus("error"); setModelError((e && e.message) ? e.message : String(e)); throw e; });
    return asrPromise;
  }

  // ---- 麦克风录音与 AI 评分 ----
  async function startRec() {
    if (recState === "recording" || recRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      recRef.current = { mr, stream, chunks: [] };
      mr.ondataavailable = (e) => { if (e.data && e.data.size > 0) recRef.current.chunks.push(e.data); };
      mr.start();
      recStartRef.current = Date.now();
      setRecState("recording");
    } catch (err) {
      toast("无法访问麦克风，请检查浏览器权限");
    }
  }
  function endRec() {
    if (!recRef.current) return;
    const { mr, stream, chunks } = recRef.current;
    mr.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const dur = (Date.now() - recStartRef.current) / 1000;
      recRef.current = null;
      if (dur >= 0.6 && chunks.length) {
        const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
        setTranscribing(true);
        (async () => {
          try {
            const pipe = await loadASR();
            const out = await pipe(blob, { language: "russian", task: "transcribe", return_timestamps: "word", chunk_length_s: 30 });
            const sc = computeScores(out, current ? (current.russian || "") : "", dur);
            setScore(sc);
            setRecState("scored");
          } catch (err) {
            console.error("ASR error", err);
            setScore({ total: 0, accuracy: 0, fluency: 0, completeness: 0 });
            setRecState("idle");
            toast("语音识别失败：" + (err && err.message ? err.message : String(err)));
          } finally {
            setTranscribing(false);
          }
        })();
      } else {
        setScore({ total: 0, accuracy: 0, fluency: 0, completeness: 0 });
        setRecState("idle");
      }
    };
    mr.stop();
  }

  // ---- 进页面即加载语音评测服务 + 预取首题发音（对标句乐部：黑屏加载→就绪即答题） ----
  useEffect(() => {
    loadASR().catch(() => {});
    if (current) ensureTtsUrl(current.russian).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    else if (mode.key === 'speaking') { setShowModePicker(false); }
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

  // ---- 键盘快捷键（底部栏键位一致；Space=按住说话；设置弹窗可改键位） ----
  useEffect(() => {
    const onKey = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (document.querySelector('.qs-mask')) return;
      const k = keysOfEvent(e);
      if (!k) return;
      // 底部栏固定键位：Shift← 上一题 / Shift→ 下一题 / ← 上一阶段 / → 下一阶段
      if (k === 'shift+arrowleft') { e.preventDefault(); goPrev(); return; }
      if (k === 'shift+arrowright') { e.preventDefault(); goNext(); return; }
      if (k === 'arrowleft') { e.preventDefault(); goPrevSeq(); return; }
      if (k === 'arrowright') { e.preventDefault(); goNextSeq(); return; }
      const hk = loadHotkeys();
      let act = null;
      for (const id in hk) { if (hk[id] === k) { act = id; break; } }
      if (!act) return;
      e.preventDefault();
      switch (act) {
        case 'toggleSpeech': // Space：长按说话（keydown 开始录音，keyup 结束）
          if (!ready) { setReady(true); if (current) runStageChain(current.russian); }
          else if (!recRef.current) startRec();
          break;
        case 'pauseGame': togglePause(); break;
        case 'addVocab': addVocab(); break;
        case 'courseContent': setShowLearning(true); break;
        case 'wordByWord': playSingleSlow(); break;
        case 'playSound': if (current) runStageChain(current.russian); break;
        case 'toggleAI': setShowAi(true); break;
        case 'toggleSettings': setShowSettings(true); break;
        case 'toggleNotes': setShowNote(true); break;
        default: break;
      }
    };
    const onKeyUp = (e) => {
      const k = keysOfEvent(e);
      if (k !== 'space') return;
      if (recRef.current) { e.preventDefault(); endRec(); }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp); };
  }, [togglePause, goPrev, goNext, goPrevSeq, goNextSeq, ready, current, runStageChain, playSingleSlow, startRec, endRec]);

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

  return (
    <>
      {modelStatus === "loading" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 400, background: "linear-gradient(160deg, #0b0b12 0%, #17102b 55%, #2a1a4d 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24 }}>
          <div style={{ fontSize: 17, color: "#fff", letterSpacing: 0.5 }}>正在连接语音评测服务，请稍候</div>
          <div style={{ width: 240, height: 5, borderRadius: 999, background: "rgba(255,255,255,0.14)", overflow: "hidden" }}>
            <div style={{ width: Math.max(modelProgress, 8) + "%", height: "100%", borderRadius: 999, background: "#A78BFA", transition: "width .3s" }} />
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", fontVariantNumeric: "tabular-nums" }}>{modelProgress}%</div>
        </div>
      )}
      <style>{`@keyframes speak-pulse { 0% { box-shadow: 0 0 0 0 rgba(124,58,237,0.45); } 70% { box-shadow: 0 0 0 28px rgba(124,58,237,0); } 100% { box-shadow: 0 0 0 0 rgba(124,58,237,0); } }`}</style>
    <div style={{ position: "fixed", inset: 0, ...THEME_OF(ui).vars, background: BG_STYLE(ui).background, display: "flex", flexDirection: "column", zIndex: 100 }}>
      {/* ===== 顶栏 h-16（对标句乐部） ===== */}
      <div style={{ position: "relative", display: "flex", height: 64, alignItems: "center", justifyContent: "space-between", padding: "0 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24, maxWidth: "90%" }}>
          <button onClick={() => navigate(-1)} title="退出游戏" aria-label="退出游戏" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 4, border: "none", background: "transparent", cursor: "pointer", color: "var(--qs-text)" }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M17 9L20 12L17 15" />
              <path d="M5 5H19" />
              <path d="M5 12H14" />
              <path d="M5 19H19" />
            </svg>
          </button>
          <span style={{ fontSize: 18, color: "var(--qs-text)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {title}（{currentIdx + 1}/{total})
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "nowrap" }}>
          <button style={{ ...iconBtn, color: "var(--qs-text)" }} onClick={() => setShowSettings(true)} title="设置"><Icon name="gear" /></button>
          <button style={{ ...iconBtn, color: showAnswerMode ? "#7C3AED" : "var(--qs-text)" }} onClick={() => setShowAnswerMode(v => !v)} title={showAnswerMode ? "关闭看答案模式" : "开启看答案模式"}><Icon name="bookOpen" /></button>
          <button style={{ ...iconBtn, color: "var(--qs-text)" }} onClick={() => setShowLearning(true)} title="查看课程学习内容（Ctrl+1）"><Icon name="notebook" /></button>
          <button style={{ ...iconBtn, color: "var(--qs-text)" }} onClick={() => setShowTree(true)} title="句子树"><Icon name="tree" /></button>
          <button style={{ ...iconBtn, color: "var(--qs-text)" }} onClick={() => setShowModePicker(true)} title="切换游戏模式"><Icon name="gamepad" /></button>
          <button style={{ ...iconBtn, color: shuffled ? "#7C3AED" : "var(--qs-text)" }} onClick={toggleShuffle} title={shuffled ? "恢复正序" : "乱序模式"}><Icon name="shuffle" /></button>
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

        </div>
      </div>

      {/* ===== 游戏区 ===== */}
      <div style={{ flex: 1, padding: 6, display: "flex", minHeight: 0 }}>
        <div className="game-layers" style={{ flex: 1, borderRadius: 16, background: "var(--qs-surface)", padding: "6px 24px", display: "flex", position: "relative" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: "16px 0", position: "relative" }}>
            {/* ===== 口语控制区（麦克风 + 评分卡片） ===== */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, width: "100%", padding: "16px 0 6px" }}>
              {/* 评分卡片（打分态显示） */}
              {recState === "scored" && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, flexWrap: "wrap", marginBottom: 6, animation: "listen-fade .3s ease" }}>
                  {[
                    { key: "total", label: "总得分", value: score.total, max: null, play: true },
                    { key: "accuracy", label: "准确度", value: score.accuracy, max: 100, play: false },
                    { key: "fluency", label: "流利度", value: score.fluency, max: 100, play: false },
                    { key: "completeness", label: "完整度", value: score.completeness, max: 100, play: false },
                  ].map((c) => (
                    <div key={c.key} style={{ minWidth: 132, borderRadius: 14, border: "1px solid #e5e7eb", background: "#fafafa", padding: "14px 16px 12px", textAlign: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#6b7280" }}>
                        <span>{c.label}</span>
                        {c.play && (
                          <button onClick={() => { playSingleSlow(); }} title="播放发音" aria-label="播放发音" style={{ width: 22, height: 22, borderRadius: "50%", border: "none", background: "#7C3AED", color: "#fff", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                            <Icon name="play" size={11} />
                          </button>
                        )}
                      </div>
                      <div style={{ fontSize: 40, fontWeight: 700, color: "#111", fontVariantNumeric: "tabular-nums", marginTop: 4, lineHeight: 1.1 }}>
                        {c.value}
                        {c.max !== null && <span style={{ fontSize: 16, fontWeight: 500, color: "#9ca3af" }}>/{c.max}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 紫色麦克风：悬停显示"长按 Space"，按住呼吸动效 */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                {modelStatus === "loading" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--qs-surface)", padding: "8px 16px", borderRadius: 10, boxShadow: "0 4px 14px rgba(0,0,0,0.08)", whiteSpace: "nowrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>正在加载语音模型 {modelProgress}%</span>
                    <div style={{ width: 90, height: 6, borderRadius: 999, background: "#e5e7eb", overflow: "hidden" }}>
                      <div style={{ width: modelProgress + "%", height: "100%", background: "#7C3AED", borderRadius: 999, transition: "width .3s" }} />
                    </div>
                  </div>
                )}
                {modelStatus === "error" && (
                  <div style={{ background: "#FEF2F2", padding: "8px 16px", borderRadius: 10, fontSize: 13, color: "#B91C1C", fontWeight: 600, whiteSpace: "nowrap" }}>
                    语音模型加载失败：{modelError || "请检查网络后刷新重试"}
                  </div>
                )}
                {(modelStatus === "ready" && (hoverMic || recState === "recording")) && (
                  <div style={{ background: "var(--qs-surface)", padding: "8px 18px", borderRadius: 10, fontSize: 14, fontWeight: 600, color: "#111", boxShadow: "0 4px 14px rgba(0,0,0,0.08)", whiteSpace: "nowrap", transition: "opacity .15s" }}>
                    长按 Space
                  </div>
                )}
                <button
                  onMouseEnter={() => setHoverMic(true)}
                  onMouseLeave={() => { setHoverMic(false); if (recState === "recording") endRec(); }}
                  onMouseDown={(e) => { e.preventDefault(); startRec(); }}
                  onMouseUp={() => endRec()}
                  onTouchStart={(e) => { e.preventDefault(); startRec(); }}
                  onTouchEnd={() => endRec()}
                  title="长按 Space 说话"
                  aria-label="按住说话"
                  style={{ position: "relative", width: 104, height: 104, borderRadius: "50%", border: "none", background: "linear-gradient(135deg,#7C3AED,#A855F7)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: recState === "recording" ? "0 10px 30px rgba(124,58,237,0.45)" : "0 10px 30px rgba(124,58,237,0.35)", animation: recState === "recording" ? "speak-pulse 1.6s ease-out infinite" : "none", transition: "box-shadow .2s, transform .15s", transform: recState === "recording" ? "scale(1.04)" : "scale(1)" }}
                >
                  <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="2" width="6" height="12" rx="3" />
                    <path d="M5 10a7 7 0 0 0 14 0" />
                    <path d="M12 17v5" />
                    <path d="M8 22h8" />
                  </svg>
                </button>
                <span style={{ fontSize: 14, color: "#6b7280", letterSpacing: 0.5 }}>
                  {transcribing ? "识别中…" : recState === "recording" ? "松开 发送" : recState === "scored" ? "按住 重新评测" : "按住 说话"}
                </span>
              </div>
            </div>

            {/* ===== 答题区 ===== */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", maxWidth: 1024, padding: "16px 0" }}>
              {!showCard ? (
                <div style={{ fontSize: 28, color: "#6b7280", fontWeight: 500, letterSpacing: 1 }}>请仔细聆听</div>
              ) : (
                <>
                  {/* 口语评测：不展示词卡，按设置「口语模式」显示（zh=中文 / en=俄语 / blind=盲读不显示） */}
                  {ui.speakMode !== 'blind' && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, animation: "listen-fade .3s ease" }}>
                      <span style={{ whiteSpace: "pre-wrap", fontSize: 22, color: "#374151", fontWeight: 600, textAlign: "center", lineHeight: 1.6 }}>
                        {ui.speakMode === 'en' ? (current.russian || '') : (current.chinese || '')}
                      </span>
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
                  <button onClick={goPrev} disabled={currentIdx === 0} aria-label="上一题" style={{ width: 30, height: 30, display: "grid", placeItems: "center", borderRadius: "50%", border: "none", background: "transparent", color: currentIdx === 0 ? "#d1d5db" : "#6b7280", cursor: currentIdx === 0 ? "not-allowed" : "pointer", transition: "background .2s, color .2s" }} onMouseEnter={(e) => { if (currentIdx > 0) { e.currentTarget.style.background = "rgba(0,0,0,0.04)"; e.currentTarget.style.color = "#111"; } }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = currentIdx === 0 ? "#d1d5db" : "#6b7280"; }}>
                    <Icon name="caretLeft" size={18} />
                  </button>
                </TipBtn>
              </div>
              <button onClick={togglePause} style={{ display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 6, border: "none", background: "transparent", color: "#374151", fontSize: 13, cursor: "pointer", padding: "6px 10px", pointerEvents: "auto" }}>
                <kbd style={{ borderRadius: 6, background: "#f3f4f6", padding: "3px 6px", fontSize: 11, fontWeight: 500, color: "#111", border: "1px solid #d1d5db", boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.05)" }}>Space</kbd>
                <span>按住说话</span>
              </button>
              <button onClick={() => setShowAi(true)} style={{ display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 6, border: "none", background: "transparent", color: "#374151", fontSize: 13, cursor: "pointer", padding: "6px 10px", pointerEvents: "auto" }}>
                <kbd style={{ borderRadius: 6, background: "#f3f4f6", padding: "3px 6px", fontSize: 11, fontWeight: 500, color: "#111", border: "1px solid #d1d5db", boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.05)" }}>Ctrl N</kbd>
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
                  <button onClick={goNext} aria-label="下一题" style={{ width: 30, height: 30, display: "grid", placeItems: "center", borderRadius: "50%", border: "none", background: "transparent", color: "#6b7280", cursor: "pointer", transition: "background .2s, color .2s" }} onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.04)"; e.currentTarget.style.color = "#111"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#6b7280"; }}>
                    <Icon name="caretRight" size={18} />
                  </button>
                </TipBtn>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== AI 学习助手（浮动右下） ===== */}
      <button onClick={() => setShowAi(true)} aria-label="AI 学习助手" title="AI 学习助手" style={{ position: "fixed", right: 20, bottom: 20, width: 48, height: 48, borderRadius: "50%", border: "none", background: "linear-gradient(135deg,#7C3AED,#9333EA)", color: "#fff", fontSize: 18, cursor: "pointer", boxShadow: "0 8px 24px rgba(124,58,237,0.35)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600 }}>
        AI
      </button>

      {/* ===== 弹窗 ===== */}
      {showSettings && <SettingsModal onClose={() => { setShowSettings(false); refreshSettings(); }} />}
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
    </>
  );
}

const iconBtn = {
  display: "flex", alignItems: "center", justifyContent: "center",
  width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent",
  cursor: "pointer", transition: "background .15s, color .15s",
};
