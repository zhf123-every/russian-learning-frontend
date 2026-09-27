import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

// 后端基址（与各答题页一致：dev 走本地 8000，生产走 VITE_API_BASE）
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

// 轮播提示文案（每 2 秒轮换）
const TIPS = [
  "想自动播放下一句？点击 ⚙️ 设置 → 听力 → 开启自动下一句",
  "正在加载音频…",
  "正在准备学习内容…",
];

// 波形分段刻度数
const BARS = 48;

// 单个资源加载超时（毫秒）：网络慢时强制推进，避免卡在 0%
const ASSET_TIMEOUT = 5000;

// 练习模式 → 答题页路由前缀
const MODE_TO_PATH = {
  chinese_to_english: "quest-practice",
  dictation: "quest-dictation",
  listening: "quest-listening",
  speaking: "quest-speaking",
};

/**
 * 构建真实结构的待加载资源列表（基于目标课程与课时）
 * - data-current：当前课时文本/大纲 JSON（真实后端 build-steps；本地投稿课程从 sessionStorage 直接就绪）
 * - cover：课程封面图（本地静态资源）
 * - audio-current / audio-next：当前课时 + 下一课时音频（TTS 缓存 URL 结构，404/超时走容错）
 * - data-lesson：课时大纲 JSON（本地静态，非核心）
 */
function buildAssets(mode, unitId, courseId) {
  const assets = [];

  // 1. 核心数据：当前课时文本/大纲（后台课程 → 真实接口；本地课程 → sessionStorage 已就绪）
  let localLesson = null;
  try { localLesson = sessionStorage.getItem("rlearn_local_lesson_" + unitId); } catch (e) { /* 忽略 */ }
  if (localLesson) {
    assets.push({ id: "data-current", type: "local", ready: true, critical: true, label: "课时数据（本地）" });
  } else {
    assets.push({
      id: "data-current",
      type: "data",
      url: `${API_BASE}/api/units/${courseId || unitId}/build-steps`,
      critical: true,
      label: "课时大纲 JSON",
    });
  }

  // 2. 课程封面图（本地静态，几乎必然成功）
  const modeImg = { chinese_to_english: "chinese_to_russian", dictation: "dictation", listening: "listening", speaking: "talking" }[mode] || "chinese_to_russian";
  assets.push({ id: "cover", type: "image", url: `/images/game-modes/${modeImg}.webp`, critical: false, label: "课程封面图" });

  // 3. 当前课时音频（TTS 缓存 URL 结构；不存在则 404 → 容错推进）
  assets.push({ id: "audio-current", type: "audio", url: `${API_BASE}/audio_cache/${unitId}.mp3`, critical: false, label: "课时音频" });

  // 4. 下一课时音频（提前缓冲，提前一个课时）
  assets.push({ id: "audio-next", type: "audio", url: `${API_BASE}/audio_cache/${unitId}_next.mp3`, critical: false, label: "下一课时音频" });

  // 5. 课时大纲 JSON（本地静态，非核心）
  assets.push({ id: "data-lesson", type: "data", url: `/data/lessons/${unitId}.json`, critical: false, label: "课时大纲 JSON" });

  return assets;
}

/** 加载单个资源：图片 onload / 音频 oncanplaythrough / 数据 fetch，统一 5s 超时 */
function loadAsset(asset) {
  if (asset.ready) return Promise.resolve();
  if (asset.type === "image") {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const timer = setTimeout(() => { img.src = ""; reject(new Error("timeout:" + asset.id)); }, ASSET_TIMEOUT);
      img.onload = () => { clearTimeout(timer); resolve(); };
      img.onerror = () => { clearTimeout(timer); img.src = ""; reject(new Error("img-error:" + asset.id)); };
      img.src = asset.url;
    });
  }
  if (asset.type === "audio") {
    return new Promise((resolve, reject) => {
      const a = new Audio();
      const done = () => { clearTimeout(timer); cleanup(); resolve(); };
      const fail = (msg) => { clearTimeout(timer); cleanup(); reject(new Error(msg)); };
      const cleanup = () => { a.oncanplaythrough = null; a.onerror = null; a.onloadeddata = null; a.src = ""; };
      const timer = setTimeout(() => fail("timeout:" + asset.id), ASSET_TIMEOUT);
      a.oncanplaythrough = done;
      a.onloadeddata = done; // 部分浏览器只触发 loadeddata，同样视为已可播放
      a.onerror = () => fail("audio-error:" + asset.id);
      a.preload = "auto";
      a.src = asset.url;
      a.load();
    });
  }
  // data
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout:" + asset.id)), ASSET_TIMEOUT);
    fetch(asset.url)
      .then((r) => { if (!r.ok) throw new Error("http:" + r.status + ":" + asset.id); clearTimeout(timer); resolve(); })
      .catch((e) => { clearTimeout(timer); reject(e); });
  });
}

/**
 * 沉浸式预加载页：游戏详情页选择练习模式后进入，真实预载课程资源
 * （课时数据/封面/音频/大纲），按文件数计算真实进度，完成后自动跳答题页。
 * 路由：/preload/:mode/:unitId?courseId=xxx&src=local(可选)&pack=xxx(可选)
 */
export default function Preloader() {
  const { mode, unitId } = useParams();
  const [search] = useSearchParams();
  const courseId = search.get("courseId") || "";
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(0);
  const [tipIdx, setTipIdx] = useState(0);
  const [error, setError] = useState("");

  const assets = useMemo(() => buildAssets(mode, unitId, courseId), [mode, unitId, courseId]);
  const total = assets.length;

  // 并行加载全部资源（互不依赖），每次完成/容错成功 → loaded++
  useEffect(() => {
    let cancelled = false;
    let doneCount = 0;
    const inc = () => {
      if (cancelled) return;
      doneCount += 1;
      setLoaded(doneCount);
    };
    assets.forEach((asset) => {
      loadAsset(asset)
        .then(() => { if (!cancelled) inc(); })
        .catch((err) => {
          if (cancelled) return;
          if (asset.critical) {
            // 核心数据加载失败：进度停住并提示
            setError("加载失败，请刷新重试");
            return;
          }
          console.warn("[Preloader] 资源加载失败（跳过继续）:", asset.id, asset.url || "", String(err && err.message || err));
          inc(); // 非核心失败也推进，保证进度能走完
        });
    });
    return () => { cancelled = true; };
  }, [assets]);

  // 提示文案轮播
  useEffect(() => {
    const tv = setInterval(() => setTipIdx((i) => (i + 1) % TIPS.length), 2000);
    return () => clearInterval(tv);
  }, []);

  // 真实进度：按已加载文件数计算
  const progress = total ? Math.min(100, Math.floor((loaded / total) * 100)) : 0;

  // 进度满 100% 后等待 500ms 自动跳转对应答题页（原 query 原样透传）
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

  // 核心数据失败：停住并提示重试
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

        {/* 分段刻度波形进度条（宽度/背景均带过渡，真实进度不跳变） */}
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
          <span>已加载 {loaded}/{total}</span>
          <span style={{ color: "#3F3F46" }}>·</span>
          <span>超时 {ASSET_TIMEOUT / 1000}s 自动跳过</span>
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
