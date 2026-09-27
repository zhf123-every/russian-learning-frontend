import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

// 轮播提示文案（每 2 秒轮换）
const TIPS = [
  "想自动播放下一句？点击 ⚙️ 设置 → 听力 → 开启自动下一句",
  "正在加载音频…",
  "正在准备学习内容…",
];

// 波形分段刻度数
const BARS = 48;

/**
 * 沉浸式预加载页：大纲页点击「可试学」课时后先进入本页，
 * 模拟加载（进度 0→100%）完成后自动跳转到游戏详情页。
 * 路由：/preload/:courseId/:lessonId
 */
export default function Preloader() {
  const { courseId, lessonId } = useParams();
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [tipIdx, setTipIdx] = useState(0);

  // 模拟进度：每 80ms 随机 +2~5%，约 2 秒跑完
  useEffect(() => {
    const iv = setInterval(() => {
      setProgress((p) => Math.min(100, p + 2 + Math.floor(Math.random() * 4)));
    }, 80);
    return () => clearInterval(iv);
  }, []);

  // 提示文案轮播
  useEffect(() => {
    const tv = setInterval(() => setTipIdx((i) => (i + 1) % TIPS.length), 2000);
    return () => clearInterval(tv);
  }, []);

  // 进度满 100% 后等待 500ms 自动跳转游戏详情页
  useEffect(() => {
    if (progress >= 100) {
      const t = setTimeout(() => {
        navigate(`/game/${courseId}${lessonId ? `?lessonId=${lessonId}` : ""}`);
      }, 500);
      return () => clearTimeout(t);
    }
  }, [progress, courseId, lessonId, navigate]);

  const lit = Math.round((progress / 100) * BARS);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "#09090B", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden", userSelect: "none", fontFamily: '"Nunito", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* 中央 Logo：白色圆形笑脸 */}
      <div style={{ width: 120, height: 120, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 20px 60px rgba(124,58,237,0.25)", animation: "preloader-breathe 2.4s ease-in-out infinite" }}>
        <svg width="66" height="66" viewBox="0 0 24 24" fill="none" stroke="#18181B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {/* 眼睛 */}
          <circle cx="8.5" cy="10" r="1.6" fill="#18181B" stroke="none" />
          <circle cx="15.5" cy="10" r="1.6" fill="#18181B" stroke="none" />
          {/* 微笑 */}
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
            // 正弦波形高度（中部高、两端低），营造波形分段感
            const wave = 10 + Math.sin((i / BARS) * Math.PI * 2) * 8 + ((i % 5) * 2) % 6;
            const on = i < lit;
            return (
              <div key={i} style={{ flex: 1, height: Math.max(8, wave), borderRadius: 2, background: on ? "#8B5CF6" : "rgba(255,255,255,0.09)", boxShadow: on ? "0 0 8px rgba(139,92,246,0.5)" : "none", transition: "background .15s ease, box-shadow .15s ease" }} />
            );
          })}
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
