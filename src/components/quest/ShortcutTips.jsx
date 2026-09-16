/**
 * ShortcutTips.jsx —— 底部固定快捷键栏（句乐部风格）
 *
 * 全局固定在页面底部，输入模式和答对模式都显示。
 * 动态变化的只有两个按钮：
 *   - 输入模式：Enter 提交、Ctrl+; 显示答案
 *   - 答对模式：Enter 下一题、Ctrl+; 再来一次
 *
 * 完整布局（从句乐部截图1:1对齐）：
 *   ←  Ctrl+' 播放发音  Ctrl+M 掌握  Ctrl+N 生词  Enter 提交/下一题  Ctrl+; 显示答案/再来一次  →
 */

export default function ShortcutTips({
  mode = "question", // "question" | "answer"
  onSubmit,       // 输入模式：提交
  onNext,         // 答对模式：下一题
  onRetry,        // 答对模式：再来一次
  onPlaySound,    // 播放发音
  onShowAnswer,   // 输入模式：显示答案
  onPrev,         // 上一题（左箭头）
  inputRef = null,
}) {
  // 包装点击：执行后自动聚焦输入框
  const handleClick = (callback) => (e) => {
    e.preventDefault();
    callback?.();
    setTimeout(() => inputRef?.current?.focus(), 0);
  };

  // 动态按钮文字
  const enterBtn = mode === "question"
    ? { keys: ["Enter"], text: "提交", onClick: onSubmit }
    : { keys: ["Enter"], text: "下一题", onClick: onNext };

  const ctrlSemicolonBtn = mode === "question"
    ? { keys: ["Ctrl", ";"], text: "显示答案", onClick: onShowAnswer }
    : { keys: ["Ctrl", ";"], text: "再来一次", onClick: onRetry };

  const buttons = [
    { keys: ["Ctrl", "'"], text: "播放发音", onClick: onPlaySound },
    { keys: ["Ctrl", "M"], text: "掌握", onClick: null },
    { keys: ["Ctrl", "N"], text: "生词", onClick: null },
    enterBtn,
    ctrlSemicolonBtn,
  ];

  return (
    <div className="ew-shortcut-bar">
      <style>{`
        .ew-shortcut-bar {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 20px;
          padding: 14px 24px;
          background: #FFFFFF;
          z-index: 50;
        }
        .ew-nav-arrow {
          width: 32px;
          height: 32px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #D1D5DB;
          cursor: pointer;
          border-radius: 6px;
          transition: color 0.15s, background 0.15s;
          flex-shrink: 0;
        }
        .ew-nav-arrow:hover {
          color: #6B7280;
          background: #F9FAFB;
        }
        .ew-shortcut-item {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border: 1px solid #E5E7EB;
          border-radius: 8px;
          background: #fff;
          font-size: 13px;
          color: #6B7280;
          white-space: nowrap;
          cursor: pointer;
          transition: border-color 0.15s, color 0.15s;
          font-family: "Nunito", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .ew-shortcut-item:hover {
          border-color: var(--ew-accent, #E879F9);
          color: var(--ew-accent, #E879F9);
        }
        .ew-shortcut-item.disabled {
          opacity: 0.5;
          cursor: default;
        }
        .ew-shortcut-item.disabled:hover {
          border-color: #E5E7EB;
          color: #6B7280;
        }
        .ew-shortcut-item kbd {
          display: inline-block;
          padding: 1px 6px;
          background: #F3F4F6;
          border: 1px solid #E5E7EB;
          border-radius: 4px;
          font-size: 11px;
          font-family: inherit;
          color: #374151;
          font-weight: 600;
        }
        @media (max-width: 768px) {
          .ew-shortcut-bar {
            gap: 8px;
            padding: 10px 12px;
            flex-wrap: wrap;
          }
          .ew-shortcut-item {
            padding: 4px 8px;
            font-size: 12px;
          }
          .ew-nav-arrow {
            display: none;
          }
        }
      `}</style>

      {/* 左箭头 */}
      <span
        className="ew-nav-arrow"
        onClick={handleClick(onPrev)}
        title="上一题"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </span>

      {/* 快捷键按钮 */}
      {buttons.map((btn, i) => (
        <span
          key={i}
          className={`ew-shortcut-item${btn.onClick ? "" : " disabled"}`}
          onClick={btn.onClick ? handleClick(btn.onClick) : undefined}
          title={btn.onClick ? `${btn.keys.join(" + ")} ${btn.text}` : "功能开发中"}
        >
          {btn.keys.map((key, j) => (
            <span key={j}>
              {j > 0 && <span style={{ color: "#9CA3AF", fontSize: 11 }}> </span>}
              <kbd>{key}</kbd>
            </span>
          ))}
          <span>{btn.text}</span>
        </span>
      ))}

      {/* 右箭头 */}
      <span
        className="ew-nav-arrow"
        onClick={handleClick(mode === "question" ? onSubmit : onNext)}
        title={mode === "question" ? "提交" : "下一题"}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </span>
    </div>
  );
}
