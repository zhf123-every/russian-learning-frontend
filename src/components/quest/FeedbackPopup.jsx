/**
 * FeedbackPopup.jsx —— 四级反馈弹窗（Good / Great / Perfect / Amazing）
 *
 * 触发规则（根据连击数）：
 *  - 连击 1-3 → Good（显示 Good×1, Good×2, Good×3）
 *  - 连击 4-5 → Great（显示 Great×1, Great×2）
 *  - 连击 6-8 → Perfect（显示 Perfect×1, Perfect×2, Perfect×3）
 *  - 连击 9+  → Amazing（显示 Amazing×1, Amazing×2, ...）
 *
 * 优化：
 *  - 音效预加载，消除播放延迟
 *  - 每次答对立即播放，不依赖 visible/type 变化
 *  - 使用 currentTime=0 快速重播
 */

import { useEffect, useRef } from "react";

// 四级反馈配置
const FEEDBACK_CONFIG = {
  good: {
    text: "Good!",
    subText: "继续加油",
    color: "#60A5FA",
    fontSize: "2.5rem",
    ttsRate: 1.1,
    ttsPitch: 1.0,
    animation: "feedback-pop-light",
  },
  great: {
    text: "Great!",
    subText: "",
    color: "#3B82F6",
    fontSize: "3rem",
    ttsRate: 1.15,
    ttsPitch: 1.0,
    animation: "feedback-pop",
  },
  perfect: {
    text: "Perfect!",
    subText: "",
    color: "#22C55E",
    fontSize: "3.5rem",
    ttsRate: 1.2,
    ttsPitch: 1.1,
    animation: "feedback-pop",
  },
  amazing: {
    text: "Amazing!",
    subText: "史诗连击！",
    color: "#F59E0B",
    fontSize: "5rem",
    ttsRate: 1.2,
    ttsPitch: 1.1,
    animation: "feedback-amazing",
    glow: true,
  },
};

// 音效预加载池（模块级，只加载一次）
const audioPool = {};
let audioPoolInitialized = false;

function initAudioPool() {
  if (audioPoolInitialized || typeof window === "undefined") return;
  try {
    ["good", "great", "perfect", "amazing"].forEach((type) => {
      const audio = new Audio(`/sounds/${type}.mp3`);
      audio.preload = "auto";
      audio.volume = 0.7;
      audioPool[type] = audio;
    });
    audioPoolInitialized = true;
  } catch (e) {
    console.warn("音效预加载失败:", e);
  }
}

// 立即播放指定音效（预加载 + 重置 + 播放）
function playFeedbackSound(type) {
  if (typeof window === "undefined") return;

  // 确保音效池已初始化
  if (!audioPoolInitialized) initAudioPool();

  try {
    const audio = audioPool[type];
    if (audio) {
      // 重置到开头，立即播放（消除延迟）
      audio.currentTime = 0;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn("音效播放失败，降级为TTS:", err);
          playTTSFallback(type);
        });
      }
    } else {
      playTTSFallback(type);
    }
  } catch (e) {
    console.warn("音效播放异常:", e);
    playTTSFallback(type);
  }
}

// TTS 降级播报
function playTTSFallback(type) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    const config = FEEDBACK_CONFIG[type] || FEEDBACK_CONFIG.perfect;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(config.text);
    utterance.lang = "en-US";
    utterance.rate = config.ttsRate;
    utterance.pitch = config.ttsPitch;
    utterance.volume = 0.8;
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.warn("TTS降级失败:", e);
  }
}

export default function FeedbackPopup({
  type = "perfect", // "good" | "great" | "perfect" | "amazing"
  comboNumber = 0,   // 当前等级内倍数，用于显示 Good×3 这样的文本
  visible = false,   // 是否显示
  feedbackKey = 0,   // 每次答对递增的唯一key，强制触发音效播放
  onDone,            // 动画结束回调
}) {
  const config = FEEDBACK_CONFIG[type] || FEEDBACK_CONFIG.perfect;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const timerRef = useRef(null);

  // 初始化音效池（组件挂载时）
  useEffect(() => {
    initAudioPool();
  }, []);

  // 音效播放：依赖 feedbackKey 强制触发，每次答对都播放
  useEffect(() => {
    if (!visible || feedbackKey === 0) return;
    // 立即播放音效（预加载已消除延迟）
    playFeedbackSound(type);
  }, [feedbackKey, visible, type]);

  // 弹窗显示计时：1.2秒后自动消失
  useEffect(() => {
    if (!visible) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onDoneRef.current?.();
    }, 1200);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible, feedbackKey]);

  if (!visible) return null;

  return (
    <div
      className="feedback-popup-overlay"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none", // 不遮挡输入
        zIndex: 9999,
      }}
    >
      <style>{`
        @keyframes feedback-pop {
          0%   { opacity: 0; transform: translateY(30px) scale(0.7); }
          25%  { opacity: 1; transform: translateY(0) scale(1.15); }
          45%  { transform: scale(1); }
          75%  { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: translateY(-20px) scale(0.95); }
        }
        @keyframes feedback-pop-light {
          0%   { opacity: 0; transform: scale(0.9); }
          30%  { opacity: 1; transform: scale(1.05); }
          60%  { transform: scale(1); }
          100% { opacity: 0; transform: scale(0.95); }
        }
        @keyframes feedback-amazing {
          0%   { opacity: 0; transform: scale(0.5) rotate(-5deg); }
          20%  { opacity: 1; transform: scale(1.3) rotate(2deg); }
          35%  { transform: scale(1.1) rotate(-1deg); }
          50%  { transform: scale(1.15) rotate(1deg); }
          70%  { opacity: 1; transform: scale(1.1); }
          100% { opacity: 0; transform: scale(1.2) translateY(-30px); }
        }
        @keyframes amazing-glow {
          0%, 100% { text-shadow: 0 0 20px rgba(245,158,11,0.5), 0 0 40px rgba(245,158,11,0.3); }
          50%      { text-shadow: 0 0 40px rgba(245,158,11,0.8), 0 0 80px rgba(245,158,11,0.5); }
        }
        .feedback-popup-text {
          font-family: "Nunito", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-weight: 800;
          text-align: center;
          user-select: none;
          line-height: 1.1;
        }
        .feedback-popup-combo {
          font-size: 1.2rem;
          font-weight: 600;
          margin-top: 8px;
          opacity: 0.8;
        }
      `}</style>

      <div
        className="feedback-popup-text"
        style={{
          color: config.color,
          fontSize: config.fontSize,
          animation: `${config.animation} 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards`,
          textShadow: config.glow
            ? "0 0 30px rgba(245,158,11,0.6)"
            : `0 2px 10px ${config.color}33`,
          ...(config.glow ? { animation: "feedback-amazing 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards, amazing-glow 0.6s ease-in-out infinite" } : {}),
        }}
      >
        {config.text}
        {comboNumber > 0 && (
          <span style={{ fontSize: "0.6em", opacity: 0.85, marginLeft: "0.1em" }}>
            ×{comboNumber}
          </span>
        )}
        {config.subText && (
          <div style={{ fontSize: "1rem", fontWeight: 500, marginTop: 4, opacity: 0.7 }}>
            {config.subText}
          </div>
        )}
      </div>
    </div>
  );
}
