/**
 * useKeyboardShortcuts —— 全局快捷键 + 输入法组合状态管理（React Hook 版）
 *
 * 职责：
 *  1. 管理 isComposing 状态（中文/俄文输入法组合输入时为 true）
 *     —— 确保组合状态下按 Enter 不提交答案
 *  2. 全局监听 Ctrl 组合快捷键：
 *     - Ctrl + '  → 发音（播放当前句子音频）
 *     - Ctrl + ;  → 看答案（显示完整句子）
 *     - Ctrl + M  → 标记掌握
 *     - Ctrl + N  → 加入生词本
 *  3. 提供 isComposingRef 给 useQuestionInput 使用
 *
 * 与句乐部 Vue 版的对应：
 *  - shortcutKey.ts → 快捷键定义与自定义（本 Hook 简化为固定快捷键 + 回调）
 *  - QuestionInput.vue 的 compositionstart/compositionend → 本 Hook 全局监听
 *  - registerShortcut/cancelShortcut → useEffect 全局 addEventListener/removeEventListener
 */

import { useEffect, useRef, useCallback } from "react";

// ============================================================
// 快捷键 code 映射（用 e.code 而非 e.key，避免输入法/大小写差异）
// ============================================================
const SHORTCUT_CODES = {
  SOUND: "Quote",       // Ctrl + '
  ANSWER: "Semicolon",   // Ctrl + ;
  MASTERED: "KeyM",      // Ctrl + M
  ADD_WORD: "KeyN",      // Ctrl + N
};

// ============================================================
// Hook
// ============================================================

/**
 * @param {Object} handlers
 * @param {Function} handlers.onSound     - Ctrl+' 发音回调
 * @param {Function} handlers.onShowAnswer - Ctrl+; 看答案回调
 * @param {Function} handlers.onMastered  - Ctrl+M 标记掌握回调
 * @param {Function} handlers.onAddWord   - Ctrl+N 加生词回调
 * @param {boolean}  handlers.enabled     - 是否启用全局快捷键（默认 true）
 */
export function useKeyboardShortcuts({
  onSound,
  onShowAnswer,
  onMastered,
  onAddWord,
  enabled = true,
} = {}) {
  // 输入法组合状态（用 ref 因为事件监听闭包需要最新值）
  const isComposingRef = useRef(false);

  // 用 ref 存储最新的 handlers，避免 useEffect 依赖变化导致重复绑定
  const handlersRef = useRef({ onSound, onShowAnswer, onMastered, onAddWord });
  useEffect(() => {
    handlersRef.current = { onSound, onShowAnswer, onMastered, onAddWord };
  }, [onSound, onShowAnswer, onMastered, onAddWord]);

  // ==========================================================
  // 全局键盘监听
  // ==========================================================
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e) => {
      // 只处理 Ctrl/Cmd 组合键
      if (!e.ctrlKey && !e.metaKey) return;

      // 输入法组合状态下，Ctrl 组合键也可能触发输入法上屏，直接阻止
      if (isComposingRef.current) {
        e.preventDefault();
        return;
      }

      const h = handlersRef.current;
      let handled = false;

      switch (e.code) {
        case SHORTCUT_CODES.SOUND:
          e.preventDefault();
          h.onSound?.();
          handled = true;
          break;
        case SHORTCUT_CODES.ANSWER:
          e.preventDefault();
          h.onShowAnswer?.();
          handled = true;
          break;
        case SHORTCUT_CODES.MASTERED:
          e.preventDefault();
          h.onMastered?.();
          handled = true;
          break;
        case SHORTCUT_CODES.ADD_WORD:
          e.preventDefault();
          h.onAddWord?.();
          handled = true;
          break;
        default:
          break;
      }

      // 阻止 Ctrl+R 刷新、Ctrl+W 关闭等浏览器默认行为（仅当我们处理了这个快捷键）
      if (handled) {
        e.stopPropagation();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled]);

  // ==========================================================
  // 全局输入法组合状态监听
  // ==========================================================
  useEffect(() => {
    if (!enabled) return;

    const handleCompositionStart = () => {
      isComposingRef.current = true;
    };

    const handleCompositionEnd = () => {
      // compositionend 触发时字符已上屏，延迟一帧重置
      // 确保紧接着的 keydown（如 Enter）不会误判为组合状态
      requestAnimationFrame(() => {
        isComposingRef.current = false;
      });
    };

    // composition 事件需要绑定在 document 上（input 上也可以，但全局更可靠）
    document.addEventListener("compositionstart", handleCompositionStart);
    document.addEventListener("compositionend", handleCompositionEnd);

    return () => {
      document.removeEventListener("compositionstart", handleCompositionStart);
      document.removeEventListener("compositionend", handleCompositionEnd);
    };
  }, [enabled]);

  // ==========================================================
  // 提供给 input 元素的 onKeyDown 包装
  // （处理 Enter 提交 + 输入法判断 + Ctrl 拦截）
  // 注意：实际的状态机键盘逻辑在 useQuestionInput.handleKeyboardInput 中
  // ==========================================================

  /**
   * 检查当前是否处于输入法组合状态
   */
  const isComposing = useCallback(() => isComposingRef.current, []);

  return {
    isComposingRef,   // 传给 useQuestionInput 使用
    isComposing,       // 函数式获取当前组合状态
  };
}
