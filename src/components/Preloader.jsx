import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { cacheLesson, cacheTtsUrl, cacheTtsAudio } from "../utils/ttsPreloadShared";

// 后端基址（与各答题页一致：dev 走本地 8000，生产走 VITE_API_BASE）
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

// 预载首屏句子数（并发 TTS 生成，保证进入答题页后前 N 句发音秒播）
const PRELOAD_SENTENCE_COUNT = 20;
const TTS_CONCURRENCY = 6;
const TTS_TIMEOUT = 8000;

// 轮播提示文案
const TIPS = [
  "想自动播放下一句？点击 ⚙️ 设置 → 听力 → 开启自动下一句",
  "正在加载音频…",
  "正在准备学习内容…",
];

const BARS = 48;

const MODE_TO_PATH = {
  chinese_to_english: "quest-practice",
  dictation: "quest-dictation",
  listening: "quest-listening",
  speaking: "quest-speaking",
};

/** POST /api/tts 取真实音频 URL（带超时，失败返回空串） */
async function fetchTtsUrl(text) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TTS_TIMEOUT);
  try {
    const res = await fetch(`${API_BASE}/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice: "alena", id: "preload", type: "statement" }),
      signal: ctrl.signal,
    });
    const data = await res.json();
    if (!data.ok || !data.audio_url) return "";
    return data.audio_url.startsWith("http") ? data.audio_url : `${API_BASE}${data.audio_url}`;
  } catch (e) {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

/** 预热音频内容并存入共享缓存（答题页 ensureTtsAudio 直接复用已 canplay 的 Audio → 秒播）；6s 超时强制返回 */
function warmAudio(text, url) {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = "auto";
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      audio.oncanplay = null;
      audio.onloadeddata = null;
      audio.onerror = null;
      resolve();
    };
    const timer = setTimeout(finish, 6000);
    audio.oncanplay = () => { cacheTtsAudio(text, audio); finish(); };
    audio.onloadeddata = () => { cacheTtsAudio(text, audio); finish(); };
    audio.onerror = finish;
    audio.src = url;
    audio.load();
  });
}

/**
 * 沉浸式预加载页：真实预载当前课时的课程数据（本地/后端）+ 首屏句子 TTS 音频，
 * 按真实完成项数计算进度，写入 window.__rlearnPreload 共享缓存后自动跳答题页。
 * 路由：/preload/:mode/:unitId?courseId=xxx&src=local(可选)&pack=xxx(可选)
 */
export default function Preloader() {
  const { mode, unitId } = useParams();
  const [search] = useSearchParams();
  const courseId = search.get("courseId") || "";
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(0);
  const [total, setTotal] = useState(0);
  const [tipIdx, setTipIdx] = useState(0);
  const [error, setError] = useState("");

  // 真实预载主流程
  useEffect(() => {
    let cancelled = false;
    let doneCount = 0;
    const inc = () => {
      if (cancelled) return;
      doneCount += 1;
      setLoaded(doneCount);
    };

    (async () => {
      try {
        // 1) 课时数据：本地投稿课程从 sessionStorage 直接就绪；后台课程 fetch build-steps
        let lesson = null;
        let sentences = [];
        let backendData = null;
        try {
          lesson = JSON.parse(sessionStorage.getItem("rlearn_local_lesson_" + unitId) || "null");
        } catch (e) { lesson = null; }
        if (lesson && Array.isArray(lesson.sentences) && lesson.sentences.length) {
          sentences = lesson.sentences.filter((x) => x && x.ru).map((x) => x.ru);
        } else {
          const res = await fetch(`${API_BASE}/api/units/${courseId || unitId}/build-steps`);
          if (!res.ok) throw new Error("核心数据加载失败");
          backendData = await res.json();
          const fams = Array.isArray(backendData?.families) ? backendData.families : [];
          sentences = fams.flatMap((f) => (f.steps || []).map((s) => s.target_sentence).filter(Boolean));
        }
        // 写入共享缓存（答题页 loadUnit 命中后无遮罩直接进）
        cacheLesson(unitId, backendData || lesson || { sentences: sentences.map((ru) => ({ ru })) });
        if (cancelled) return;

        // 2) 资源总数：数据 1 + 封面 1 + 首屏音频 N
        const audioTexts = sentences.slice(0, PRELOAD_SENTENCE_COUNT);
        const totalAssets = 2 + audioTexts.length;
        setTotal(totalAssets);


        // 3) 封面图（本地静态，成败都推进）
        const modeImg = { chinese_to_english: "chinese_to_russian", dictation: "dictation", listening: "listening", speaking: "talking" }[mode] || "chinese_to_russian";
        const img = new Image();
        img.onload = () => inc();
        img.onerror = () => inc();
        img.src = `/images/game-modes/${modeImg}.webp`;

        // 4) 数据就绪
        inc();

        // 5) 首屏句子音频并发预载（每句成功/失败都推进，进度真实）
        let i = 0;
        const workers = Array.from({ length: TTS_CONCURRENCY }, async () => {
          while (i < audioTexts.length) {
            const idx = i++;
            const text = audioTexts[idx];
            try {
              const url = await fetchTtsUrl(text);
              if (url) {
                cacheTtsUrl(text, url); // 答题页 ensureTts 命中即免再请求
                await warmAudio(text, url);   // 预载并存入共享缓存，答题页秒播
              } else {
                console.warn("[Preloader] TTS 无返回:", text.slice(0, 24));
              }
            } catch (e) {
              console.warn("[Preloader] TTS 失败:", text.slice(0, 24), String(e && e.message || e));
            }
            if (cancelled) return;
            inc();
          }
        });
        await Promise.all(workers);
      } catch (e) {
        if (!cancelled) {
          console.error("[Preloader] 核心预载失败:", e);
          setError("加载失败，请刷新重试");
        }
      }
    })();

    return () => { cancelled = true; };
  }, [mode, unitId, courseId]);

  // 提示文案轮播
  useEffect(() => {
    const tv = setInterval(() => setTipIdx((i) => (i + 1) % TIPS.length), 2000);
    return () => clearInterval(tv);
  }, []);

  // 真实进度
  const progress = total ? Math.min(100, Math.floor((loaded / total) * 100)) : 0;

  // 100% 后 500ms 自动跳转对应答题页（原 query 原样透传）
  useEffect(() => {
    if (progress >= 100 && !error) {
      const t = setTimeout(() => {
        const target = MODE_TO_PATH[mode] || "quest-practice";
        const qs = search.toString();
        navigate(`/${target}/${unitId}${qs ? `?${qs}` : ""}`);
      }, 500);
      return () => clearTimeout(t);
    }
  }, [progress, error, mode, unitId, search, navigate]);

  const lit = Math.round((progress / 100) * BARS);

  if (error) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "#09090B", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, userSelect: "none", fontFamily: '"Nunito", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        <div style={{ fontSize: 40 }}>⚠️</div>
        <div style={{ fontSize: 18, fontWeight: 600 }}>{error}</div>
        <button onClick={() => window.location.reload()} style={{ padding: "12px 36px", borderRadius: 999, background: "#7C3AED", color: "#fff", fontSize: 15, fontWeight: 600, border: "none", cursor: "pointer" }}>
          刷新重试
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "#09090B", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden", userSelect: "none", fontFamily: '"Nunito", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* 中央 Logo：白色圆形笑脸 */}
      <div style={{ width: 120, height: 120, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 20px 60px rgba(124,58,237,0.25)", animation: "preloader-breathe 2.4s ease-in-out infinite" }}>
        <svg width="66" height="66" viewBox="0 0 24 24" fill="none" stroke="#18181B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8.5" cy="10" r="1.6" fill="#18181B" stroke="none" />
          <circle cx="15.5" cy="10" r="1.6" fill="#18181B" stroke="none" />
          <path d="M6.5 14.2c1.6 1.8 3.6 2.6 5.5 2.6s3.9-0.8 5.5-2.6" />
        </svg>
      </div>

      {/* 提示文案（轮播） */}
      <p key={tipIdx} style={{ marginTop: 28, fontSize: 14, color: "#71717A", letterSpacing: 0.2, animation: "preloader-fade .4s ease", textAlign: "center", padding: "0 24px" }}>
        {TIPS[tipIdx]}
      </p>

      {/* 底部 LOADING 区 */}
      <div style={{ position: "absolute", insetInline: 0, bottom: 0, padding: "0 56px 44px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, color: "#A1A1AA", letterSpacing: 5, fontWeight: 700 }}>LOADING</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: "#A78BFA", fontVariantNumeric: "tabular-nums" }}>{progress}%</span>
        </div>

        {/* 分段刻度波形进度条 */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 14, height: 34 }}>
          {Array.from({ length: BARS }).map((_, i) => {
            const wave = 10 + Math.sin((i / BARS) * Math.PI * 2) * 8 + ((i % 5) * 2) % 6;
            const on = i < lit;
            return (
              <div key={i} style={{ flex: 1, height: Math.max(8, wave), borderRadius: 2, background: on ? "#8B5CF6" : "rgba(255,255,255,0.09)", boxShadow: on ? "0 0 8px rgba(139,92,246,0.5)" : "none", transition: "background .2s ease, box-shadow .2s ease" }} />
            );
          })}
        </div>

        {/* 加载明细（真实进度依据） */}
        <div style={{ marginTop: 10, fontSize: 12, color: "#52525B", display: "flex", gap: 12 }}>
          <span>课程数据 + 封面 + 首屏音频 {total ? `${loaded}/${total}` : ""}</span>
        </div>
      </div>

      {/* 右下角用户头像 */}
      <div style={{ position: "absolute", right: 28, bottom: 32, width: 42, height: 42, borderRadius: "50%", background: "linear-gradient(135deg, #8B5CF6, #3B82F6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "#fff", boxShadow: "0 8px 24px rgba(124,58,237,0.35)" }}>
        我
      </div>

      <style>{`
        @keyframes preloader-breathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.04); } }
        @keyframes preloader-fade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
