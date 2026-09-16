/**
 * ShortcutTips.jsx —— 底部快捷键提示栏
 *
 * 根据当前状态（输入模式 / 答对模式）动态切换按钮：
 * - 输入模式：Enter 提交、Ctrl+' 播放发音、Ctrl+; 显示答案
 * - 答对模式：Enter 下一题、Ctrl+' 播放发音、Ctrl+; 再来一次
 *
 * 样式：灰色边框按键 + 文字说明，hover 变紫
 */

export default function ShortcutTips({
  mode = "question", // "question" | "answer"
  variant = "practice", // "practice" | "dictation"
  inputRef = null, // 可选：点击按钮后自动聚焦回输入框
  onSubmit,
  onNext,
  onRetry,
  onPlaySound,
  onShowAnswer,
}) {
  // 包装点击事件：执行回调后自动聚焦输入框
  const handleClick = (callback) => (e) => {
    e.preventDefault();
    callback?.();
    // 延迟聚焦，确保回调执行完
    setTimeout(() => inputRef?.current?.focus(), 0);
  };
  // 根据模式和变体构建按钮列表
  const buttons = mode === "question"
    ? variant === "dictation"
      ? [
          { keys: ["Enter"], text: "提交", onClick: onSubmit },
          { keys: ["Space"], text: "重播发音", onClick: onPlaySound },
          { keys: ["Ctrl", ";"], text: "看字幕", onClick: onShowAnswer },
        ]
      : [
          { keys: ["Enter"], text: "提交", onClick: onSubmit },
          { keys: ["Ctrl", "'"], text: "播放发音", onClick: onPlaySound },
          { keys: ["Ctrl", ";"], text: "显示答案", onClick: onShowAnswer },
        ]
    : [
        { keys: ["Enter"], text: "下一题", onClick: onNext },
        { keys: ["Ctrl", "'"], text: "播放发音", onClick: onPlaySound },
        { keys: ["Ctrl", ";"], text: "再来一次", onClick: onRetry },
      ];

  return (
    <div className="shortcut-tips">
      <style>{`
        .shortcut-tips {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          padding: 16px 24px;
          border-top: 1px solid #E5E7EB;
          background: #FFFFFF;
          min-height: 64px;
        }
        .shortcut-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          background: transparent;
          border: none;
          cursor: pointer;
          font-size: 14px;
          color: #6B7280;
          transition: color 0.15s ease;
          font-family: "Nunito", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .shortcut-btn:hover {
          color: var(--ew-accent, #E879F9);
        }
        .shortcut-btn:active {
          opacity: 0.6;
          transform: scale(0.96);
        }
        .shortcut-btn:hover .shortcut-key {
          border-color: var(--ew-accent, #E879F9);
          color: var(--ew-accent, #E879F9);
        }
        .shortcut-key {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 24px;
          height: 24px;
          padding: 0 6px;
          border: 1px solid #D1D5DB;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
          color: #4B5563;
          background: #F9FAFB;
          transition: border-color 0.15s ease, color 0.15s ease;
        }
        .shortcut-key-sep {
          color: #9CA3AF;
          font-size: 12px;
          margin: 0 2px;
        }
        @media (max-width: 640px) {
          .shortcut-tips {
            gap: 8px;
            padding: 12px 16px;
            flex-wrap: wrap;
          }
          .shortcut-btn {
            padding: 4px 10px;
            font-size: 13px;
          }
        }
      `}</style>

      {buttons.map((btn, i) => (
        <button
          key={i}
          type="button"
          className="shortcut-btn"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleClick(btn.onClick)}
          title={`${btn.keys.join(" + ")} ${btn.text}`}
        >
          {btn.keys.map((key, j) => (
            <span key={j}>
              {j > 0 && <span className="shortcut-key-sep">+</span>}
              <span className="shortcut-key">{key}</span>
            </span>
          ))}
          <span>{btn.text}</span>
        </button>
      ))}
    </div>
  );
}
