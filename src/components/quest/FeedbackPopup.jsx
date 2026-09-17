/**
 * FeedbackPopup.jsx —— 劲舞团级游戏化反馈系统
 *
 * 视觉效果：
 *  - 粒子爆发（答对时）
 *  - 屏幕闪光（里程碑时）
 *  - 连击数字大字体跳动
 *  - 四级判定文字弹出（Good/Great/Perfect/Amazing）
 *  - 背景光晕（随连击数变化颜色和强度）
 *  - 答错屏幕震动+红色闪烁
 */

import { useEffect, useRef, useMemo } from "react";

// 四级反馈配置
const FEEDBACK_CONFIG = {
  good: {
    text: "Good",
    color: "#60A5FA",
    glowColor: "rgba(96,165,250,0.6)",
    particleCount: 8,
    particleColors: ["#60A5FA", "#93C5FD", "#BFDBFE"],
    scale: 1,
  },
  great: {
    text: "Great",
    color: "#3B82F6",
    glowColor: "rgba(59,130,246,0.7)",
    particleCount: 12,
    particleColors: ["#3B82F6", "#60A5FA", "#93C5FD", "#DBEAFE"],
    scale: 1.1,
  },
  perfect: {
    text: "Perfect",
    color: "#22C55E",
    glowColor: "rgba(34,197,94,0.8)",
    particleCount: 16,
    particleColors: ["#22C55E", "#4ADE80", "#86EFAC", "#BBF7D0"],
    scale: 1.2,
  },
  amazing: {
    text: "Amazing",
    color: "#F59E0B",
    glowColor: "rgba(245,158,11,0.9)",
    particleCount: 24,
    particleColors: ["#F59E0B", "#FBBF24", "#FCD34D", "#FEF3C7", "#FFFFFF"],
    scale: 1.4,
    flash: true,
  },
};

// 生成随机粒子
function generateParticles(count, colors) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const distance = 80 + Math.random() * 120;
    const size = 4 + Math.random() * 8;
    return {
      id: i,
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      size,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 0.1,
      duration: 0.6 + Math.random() * 0.4,
    };
  });
}

export default function FeedbackPopup({
  type = "perfect",
  comboNumber = 0,
  totalCombo = 0,
  visible = false,
  feedbackKey = 0,
  isMilestone = false,
  onDone,
}) {
  const config = FEEDBACK_CONFIG[type] || FEEDBACK_CONFIG.perfect;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const timerRef = useRef(null);

  // 生成粒子（只在 visible 变化时重新生成）
  const particles = useMemo(() => {
    if (!visible) return [];
    return generateParticles(config.particleCount, config.particleColors);
  }, [visible, feedbackKey, config.particleCount, config.particleColors]);

  // 弹窗显示计时：1.5秒后自动消失
  useEffect(() => {
    if (!visible) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onDoneRef.current?.();
    }, 1500);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible, feedbackKey]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        zIndex: 9999,
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes feedback-pop {
          0%   { opacity: 0; transform: translateY(40px) scale(0.5); }
          15%  { opacity: 1; transform: translateY(0) scale(1.2); }
          30%  { transform: scale(${config.scale}); }
          50%  { transform: scale(${config.scale * 1.05}); }
          70%  { opacity: 1; transform: scale(${config.scale}); }
          100% { opacity: 0; transform: translateY(-30px) scale(${config.scale * 0.9}); }
        }
        @keyframes particle-fly {
          0%   { opacity: 1; transform: translate(0, 0) scale(1); }
          100% { opacity: 0; transform: translate(var(--tx), var(--ty)) scale(0); }
        }
        @keyframes screen-flash {
          0%   { opacity: 0; }
          20%  { opacity: 0.4; }
          100% { opacity: 0; }
        }
        @keyframes combo-bounce {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
        @keyframes ring-expand {
          0%   { opacity: 0.8; transform: scale(0.3); }
          100% { opacity: 0; transform: scale(2.5); }
        }
        .feedback-text {
          font-family: "Nunito", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-weight: 900;
          text-align: center;
          user-select: none;
          line-height: 1;
          letter-spacing: 2px;
          animation: feedback-pop 1.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .combo-display {
          position: absolute;
          top: 15%;
          left: 50%;
          transform: translateX(-50%);
          font-family: "Nunito", sans-serif;
          font-weight: 900;
          font-size: 4rem;
          color: ${config.color};
          text-shadow: 0 0 30px ${config.glowColor}, 0 0 60px ${config.glowColor};
          animation: combo-bounce 0.3s ease-in-out;
          opacity: 0.9;
        }
        .combo-label {
          font-size: 1rem;
          font-weight: 600;
          opacity: 0.7;
          letter-spacing: 4px;
          text-transform: uppercase;
        }
        .particle {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
          animation: particle-fly var(--duration) ease-out forwards;
          animation-delay: var(--delay);
        }
        .flash-overlay {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: radial-gradient(circle, ${config.color}66 0%, transparent 70%);
          animation: screen-flash 0.5s ease-out forwards;
        }
        .ring {
          position: absolute;
          border: 3px solid ${config.color};
          border-radius: 50%;
          width: 200px;
          height: 200px;
          animation: ring-expand 0.8s ease-out forwards;
        }
      `}</style>

      {/* 屏幕闪光（里程碑/Amazing时） */}
      {(isMilestone || config.flash) && <div className="flash-overlay" />}

      {/* 扩散圆环 */}
      <div className="ring" />

      {/* 连击数字显示 */}
      {totalCombo > 0 && (
        <div className="combo-display">
          <div className="combo-label">COMBO</div>
          {totalCombo}
        </div>
      )}

      {/* 粒子爆发 */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="particle"
          style={{
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
            "--tx": `${p.x}px`,
            "--ty": `${p.y}px`,
            "--delay": `${p.delay}s`,
            "--duration": `${p.duration}s`,
          }}
        />
      ))}

      {/* 主判定文字 */}
      <div
        className="feedback-text"
        style={{
          color: config.color,
          fontSize: `${4 * config.scale}rem`,
          textShadow: `0 0 20px ${config.glowColor}, 0 0 40px ${config.glowColor}, 0 4px 8px rgba(0,0,0,0.3)`,
        }}
      >
        {config.text}
        {comboNumber > 0 && (
          <span style={{ fontSize: "0.5em", opacity: 0.8, marginLeft: "0.15em" }}>
            ×{comboNumber}
          </span>
        )}
      </div>
    </div>
  );
}
