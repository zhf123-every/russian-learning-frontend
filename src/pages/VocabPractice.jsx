/**
 * VocabPractice.jsx —— 生词本全屏答题页（与课程答题页同款沉浸体验）
 *
 * 路由：/vocab-practice?mode=cn2ru|dict|listen|speak&order=list|random&keys=k1,k2
 * 题目来源：生词本（rlearn_vocab_book）词条，包装成答题 statement 喂给正式页同款组件。
 * 复用：AnswerPanel（答案详情卡）、ShortcutTips（底部快捷键栏）、useGameStats（Combo/统计/音效）、
 *       useQuestSettings（主题/背景/UI 偏好）、SettingsModal（设置弹窗）。
 */
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getVocabWords, incrementVocabPractice } from "../lib/vocabBook";
import { speak } from "../lib/tts";
import { useGameStats } from "../hooks/useGameStats";
import { useQuestSettings, BG_STYLE, THEME_OF } from "../hooks/useQuestSettings";
import AnswerPanel from "../components/quest/AnswerPanel";
import ShortcutTips from "../components/quest/ShortcutTips";
import SettingsModal from "../components/SettingsModal";
import Icon from "../components/TopBarIcons";

const MODES = [
  { id: "cn2ru", label: "中译俄", desc: "看中文写出俄语", icon: "✍️" },
  { id: "dict", label: "听写", desc: "听音频写出俄语", icon: "🎧" },
  { id: "listen", label: "听力模式", desc: "听音频看答案", icon: "👂" },
  { id: "speak", label: "口语模式", desc: "看词跟读练习", icon: "🗣️" },
];

// 归一化判题：去重音符、小写、压缩空格
const norm = (s) =>
  String(s || "")
    .replace(/[̀-ͯЃ-҉]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
const formatTime = (sec) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

// 生词词条 → 答题 statement（供 AnswerPanel 复用）
function toStatement(w) {
  return {
    id: w.key,
    russian: w.word,
    chinese: w.chinese || "",
    reading: w.reading || "",
    pos: w.pos || "",
    example: w.example || "",
    words: [
      {
        order: 0,
        form: w.word,
        lemma: w.word,
        pos: w.pos || "",
        chinese: w.chinese || "",
        grammarLabel: "",
        roleLabel: "",
      },
    ],
    raw: w,
  };
}

export default function VocabPractice() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const mode = MODES.some((m) => m.id === params.get("mode")) ? params.get("mode") : "cn2ru";
  const order = params.get("order") === "random" ? "random" : "list";
  const keysParam = params.get("keys") || "";

  // ---- 题目初始化（仅一次）----
  const initialItems = useMemo(() => {
    const all = getVocabWords();
    let arr = all;
    if (keysParam) {
      const set = new Set(keysParam.split(",").filter(Boolean));
      const picked = all.filter((w) => set.has(w.key));
      if (picked.length) arr = picked;
    }
    if (order === "random") arr = [...arr].sort(() => Math.random() - 0.5);
    return arr.map(toStatement);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [items, setItems] = useState(initialItems);
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState("question"); // question | answer
  const [result, setResult] = useState(null); // correct | wrong | reveal
  const [done, setDone] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const inputRef = useRef(null);

  const { ui, refreshSettings } = useQuestSettings();
  const {
    combo, maxCombo, correctCount, comboEffect,
    recordCorrect, recordWrong, getAccuracy, getGrade, resetStats,
  } = useGameStats();

  const cur = items[idx];
  const isLast = idx >= items.length - 1;
  const modeMeta = MODES.find((m) => m.id === mode) || MODES[0];
  const inputMode = mode === "cn2ru" || mode === "dict";

  // ---- 计时 ----
  useEffect(() => {
    if (done) return;
    const iv = setInterval(() => setElapsed((v) => v + 1), 1000);
    return () => clearInterval(iv);
  }, [done]);

  const playSound = useCallback(() => {
    if (cur?.russian) speak(cur.russian, { rate: 0.8 });
  }, [cur]);

  // ---- 判题 ----
  const checkAnswer = useCallback(() => {
    if (!cur || phase !== "question" || !inputMode) return;
    if (!input.trim()) return;
    const ok = norm(input) === norm(cur.russian);
    incrementVocabPractice(cur.id);
    if (ok) {
      recordCorrect();
      setResult("correct");
    } else {
      recordWrong();
      setResult("wrong");
    }
    setPhase("answer");
  }, [cur, phase, inputMode, input, recordCorrect, recordWrong]);

  const revealAnswer = useCallback(() => {
    if (!cur || phase !== "question") return;
    incrementVocabPractice(cur.id);
    setResult("reveal");
    setPhase("answer");
  }, [cur, phase]);

  const goNext = useCallback(() => {
    if (!cur) return;
    if (isLast) { setDone(true); return; }
    setIdx((i) => i + 1);
    setInput("");
    setPhase("question");
    setResult(null);
  }, [cur, isLast]);

  const goPrev = useCallback(() => {
    if (idx === 0) return;
    setIdx((i) => Math.max(0, i - 1));
    setInput("");
    setPhase("question");
    setResult(null);
  }, [idx]);

  const replay = useCallback(() => {
    const arr = [...items];
    if (order === "random") arr.sort(() => Math.random() - 0.5);
    setItems(arr);
    setIdx(0);
    setInput("");
    setPhase("question");
    setResult(null);
    setDone(false);
    setElapsed(0);
    resetStats();
  }, [items, order, resetStats]);

  // ---- 快捷键 ----
  useEffect(() => {
    const onKey = (e) => {
      if (done) return;
      if (showSettings) return;
      if (e.key === "Enter") {
        e.preventDefault();
        if (phase === "question") {
          inputMode ? checkAnswer() : revealAnswer();
        } else {
          goNext();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === ";") {
        e.preventDefault();
        if (phase === "question") revealAnswer();
      } else if (e.key === " " && phase === "question") {
        e.preventDefault();
        playSound();
      } else if (e.key === "ArrowLeft") {
        goPrev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [done, showSettings, phase, inputMode, checkAnswer, revealAnswer, goNext, goPrev, playSound]);

  // 切题后聚焦输入框
  useEffect(() => {
    if (phase === "question" && inputMode) inputRef.current?.focus();
  }, [idx, phase, inputMode]);

  // ---- 空态 ----
  if (!items.length) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: THEME_OF(ui).bg, color: THEME_OF(ui).text, padding: 24 }}>
        <div style={{ textAlign: "center", maxWidth: 360 }}>
          <div style={{ fontSize: 48 }}>📒</div>
          <h3 style={{ marginTop: 16, fontSize: 18, fontWeight: 700 }}>生词本还是空的</h3>
          <p style={{ marginTop: 8, fontSize: 14, opacity: 0.7 }}>在答题页点击句子里的单词，把想复习的词收录到生词本后再来练习。</p>
          <button onClick={() => navigate("/save/unknown")} style={{ marginTop: 20, padding: "10px 24px", borderRadius: 12, border: "none", background: "#7C3AED", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
            返回生词本
          </button>
        </div>
      </div>
    );
  }

  const accuracy = getAccuracy(items.length);
  const grade = getGrade(items.length);

  // ===== 答案态：整页只渲染 AnswerPanel（其内部自带 answer 快捷键栏，对齐正式答题页）=====
  if (phase === "answer" && cur) {
    return (
      <div
        style={{
          minHeight: "100vh",
          ...THEME_OF(ui).vars,
          background: BG_STYLE(ui).background || THEME_OF(ui).bg,
        }}
      >
        <AnswerPanel statement={cur} onNext={goNext} isLast={isLast} ui={ui} />
      </div>
    );
  }

  return (
    <div
      style={{
        ...styles.page,
        ...THEME_OF(ui).vars,
        background: BG_STYLE(ui).background || THEME_OF(ui).bg,
        animation: comboEffect === "shake" ? "quest-shake 0.4s ease-in-out" : "none",
      }}
    >
      <style>{`
        @keyframes quest-shake {
          0%,100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
      `}</style>

      {/* 顶部工具栏 */}
      <div style={styles.toolbar}>
        <div style={styles.toolbarLeft}>
          <button style={styles.iconBtn} onClick={() => navigate("/save/unknown")} title="返回生词本" aria-label="返回生词本">
            <Icon name="caretLeft" size={26} />
          </button>
          <div style={styles.progress}>生词本练习（{idx + 1}/{items.length}）</div>
        </div>
        <div style={styles.toolbarRight}>
          <button style={styles.iconBtn} onClick={() => setShowSettings(true)} title="设置"><Icon name="gear" /></button>
          <button style={styles.iconBtn} onClick={replay} title="重置本轮"><Icon name="rotateCcw" /></button>
        </div>
      </div>

      {/* 状态行：标题 + Combo + 计时 */}
      <div style={styles.familyBar}>
        <span style={styles.familyName}>{modeMeta.icon} {modeMeta.label} · {modeMeta.desc}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: "auto" }}>
          {combo > 0 && (
            <div style={{ ...styles.comboBadge, color: combo >= 9 ? "#E11D48" : combo >= 6 ? "#EA580C" : combo >= 4 ? "#F59E0B" : "#7C3AED" }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>Combo</span>
              <span style={{ fontSize: 20, fontWeight: 800, marginLeft: 4 }}>×{combo}</span>
            </div>
          )}
          <span style={styles.familyStep}>第 {idx + 1}/{items.length} 题 · {formatTime(elapsed)}</span>
        </div>
      </div>

      {/* 主区 */}
      <div style={styles.mainContent}>
        {done ? (
          /* ===== 结算页 ===== */
          <div style={styles.summaryCard}>
            <div style={{ fontSize: 52 }}>🎉</div>
            <h3 style={{ marginTop: 16, fontSize: 24, fontWeight: 800, color: THEME_OF(ui).text }}>练习完成！</h3>
            <div style={{ marginTop: 18, display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap", color: THEME_OF(ui).sub, fontSize: 14 }}>
              <span>共 {items.length} 词</span>
              <span>答对 {correctCount}</span>
              <span>正确率 {Math.round(accuracy)}%</span>
              <span>最大连击 ×{maxCombo}</span>
              <span style={{ fontWeight: 700, color: "#7C3AED" }}>评级 {grade}</span>
            </div>
            <div style={{ marginTop: 28, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={replay} style={styles.primaryBtn}>再来一轮</button>
              <button onClick={() => navigate("/save/unknown")} style={styles.ghostBtn}>返回生词本</button>
            </div>
          </div>
        ) : (
          /* ===== 题面卡 ===== */
          <div style={styles.questionCard}>
            <div style={styles.modeTag}>{modeMeta.icon} {modeMeta.label}</div>

            {mode === "cn2ru" && (
              <div style={styles.promptZh}>{cur.chinese || cur.russian}</div>
            )}

            {mode === "dict" && (
              <button onClick={playSound} style={styles.playBtn} title="播放发音">▶</button>
            )}

            {(mode === "listen" || mode === "speak") && (
              <>
                <div style={styles.promptRu}>{cur.russian}</div>
                {cur.reading && <div style={styles.promptReading}>{cur.reading}</div>}
                <button onClick={playSound} style={styles.ghostBtn}>🔊 播放发音</button>
              </>
            )}

            {inputMode && (
              <div style={{ marginTop: 24, width: "100%" }}>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); checkAnswer(); } }}
                  autoFocus
                  placeholder="输入俄语…"
                  style={styles.input}
                />
                <div style={{ marginTop: 16, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                  <button onClick={checkAnswer} disabled={!input.trim()} style={{ ...styles.primaryBtn, opacity: input.trim() ? 1 : 0.4, cursor: input.trim() ? "pointer" : "not-allowed" }}>检查</button>
                  <button onClick={revealAnswer} style={styles.ghostBtn}>直接看答案</button>
                </div>
              </div>
            )}

            {!inputMode && (
              <div style={{ marginTop: 20 }}>
                <button onClick={revealAnswer} style={styles.primaryBtn}>显示答案</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 底部快捷键栏（仅题面态；答案态由 AnswerPanel 自带） */}
      {!done && phase === "question" && (
        <ShortcutTips
          mode="question"
          onSubmit={checkAnswer}
          onNext={goNext}
          onPlaySound={playSound}
          onShowAnswer={revealAnswer}
          onPrev={goPrev}
          playText="播放发音"
          inputRef={inputRef}
        />
      )}

      {showSettings && (
        <SettingsModal onClose={() => { setShowSettings(false); refreshSettings(); }} />
      )}
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 24px",
    background: "var(--qs-surface)",
    borderBottom: "1px solid var(--qs-border, #E5E7EB)",
  },
  toolbarLeft: { display: "flex", alignItems: "center", gap: 12 },
  toolbarRight: { display: "flex", alignItems: "center", gap: 12 },
  familyBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 24px",
    fontSize: 12,
    background: "var(--qs-surface)",
  },
  familyName: { fontWeight: 600, color: "var(--qs-sub)" },
  familyStep: { color: "var(--qs-sub)", fontVariantNumeric: "tabular-nums" },
  iconBtn: {
    width: 36, height: 36, borderRadius: 8, border: "none", background: "transparent",
    color: "var(--qs-text)", fontSize: 18, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", transition: "color 0.15s ease",
  },
  progress: { fontSize: 15, fontWeight: 600, color: "var(--qs-text)", whiteSpace: "nowrap" },
  comboBadge: {
    display: "flex", alignItems: "baseline", padding: "4px 12px",
    background: "var(--qs-surface2, rgba(255,255,255,0.7))", borderRadius: 20,
    border: "1px solid var(--qs-border, #E8E1D9)", marginRight: 4,
  },
  mainContent: {
    flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    padding: "32px 24px 96px", gap: 24, maxWidth: 800, margin: "0 auto", width: "100%",
  },
  questionCard: {
    width: "100%", maxWidth: 560, background: "var(--qs-surface2, #fff)",
    border: "1px solid var(--qs-border, #E5E7EB)", borderRadius: 24, padding: "36px 28px",
    display: "flex", flexDirection: "column", alignItems: "center", boxShadow: "0 4px 16px rgba(26,26,30,0.08)",
  },
  summaryCard: {
    width: "100%", maxWidth: 560, background: "var(--qs-surface2, #fff)",
    border: "1px solid var(--qs-border, #E5E7EB)", borderRadius: 24, padding: "40px 28px",
    textAlign: "center", boxShadow: "0 4px 16px rgba(26,26,30,0.08)",
  },
  modeTag: {
    fontSize: 13, fontWeight: 600, color: "#7C3AED", background: "rgba(124,58,237,0.08)",
    padding: "4px 14px", borderRadius: 999, marginBottom: 20,
  },
  promptZh: {
    minHeight: 56, fontSize: 26, fontWeight: 600, lineHeight: 1.5, color: "var(--qs-text)", textAlign: "center",
  },
  promptRu: {
    minHeight: 56, fontSize: 40, fontWeight: 800, color: "var(--qs-text)", textAlign: "center",
    fontFamily: '"PT Serif", Georgia, serif',
  },
  promptReading: { marginTop: 6, fontSize: 15, fontStyle: "italic", color: "var(--qs-sub)" },
  playBtn: {
    width: 72, height: 72, borderRadius: "50%", border: "none", background: "#7C3AED", color: "#fff",
    fontSize: 26, cursor: "pointer", boxShadow: "0 6px 18px rgba(124,58,237,0.35)", transition: "transform 0.15s",
  },
  input: {
    width: "100%", padding: "13px 16px", borderRadius: 14, border: "1px solid var(--qs-border, #E5E7EB)",
    background: "var(--qs-surface, #fff)", fontSize: 18, textAlign: "center", color: "var(--qs-text)", outline: "none",
  },
  primaryBtn: {
    padding: "11px 28px", borderRadius: 14, border: "none", background: "#7C3AED", color: "#fff",
    fontWeight: 700, fontSize: 15, cursor: "pointer",
  },
  ghostBtn: {
    padding: "11px 22px", borderRadius: 14, border: "1px solid var(--qs-border, #E5E7EB)", background: "transparent",
    color: "var(--qs-sub)", fontWeight: 600, fontSize: 14, cursor: "pointer",
  },
};
