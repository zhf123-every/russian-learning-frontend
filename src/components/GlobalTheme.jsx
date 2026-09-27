/**
 * GlobalTheme —— 全局深夜/白天模式同步（作用到全站，不止答题页）
 *
 * 读取 rlearn_quest_ui.themeMode（设置弹窗"外观"面板的 深夜/白天/跟随系统），
 * 在 <html> 根上应用：
 *  1. Tailwind dark 类（darkMode:'class'）→ 全站 dark: 样式统一跟随设置
 *  2. data-theme="dark|light" → 自定义 CSS 选择器可用
 *  3. --qs-* CSS 变量（答题页同款主题令牌）→ 非答题页也能用主题色
 *  4. body 背景兜底（切换瞬间不白闪）
 *
 * 实时同步：storage 事件 / quest-ui-changed 广播 / 系统偏好变化（auto 模式）。
 * 挂载位置：main.jsx 的 BrowserRouter 内、App 之前，全局只渲染一次。
 */
import { useEffect, useState } from "react";
import { loadUi, THEME_OF } from "../hooks/useQuestSettings";

export default function GlobalTheme() {
  const [ui, setUi] = useState(() => loadUi());

  // 跨标签页/设置弹窗保存后即时刷新
  useEffect(() => {
    const h = () => setUi(loadUi());
    window.addEventListener("storage", h);
    window.addEventListener("quest-ui-changed", h);
    return () => {
      window.removeEventListener("storage", h);
      window.removeEventListener("quest-ui-changed", h);
    };
  }, []);

  // 应用主题到 <html> 根 + body 背景
  useEffect(() => {
    const t = THEME_OF(ui);
    const root = document.documentElement;
    root.classList.toggle("dark", !!t.dark);
    root.dataset.theme = t.dark ? "dark" : "light";
    Object.entries(t.vars || {}).forEach(([k, v]) => root.style.setProperty(k, v));
    root.style.background = t.bg;
    document.body.style.background = t.bg;
  }, [ui]);

  // auto（跟随系统）模式下监听系统深色切换
  useEffect(() => {
    if ((ui.themeMode || "auto") !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const h = () => setUi(loadUi());
    mq.addEventListener?.("change", h);
    return () => mq.removeEventListener?.("change", h);
  }, [ui.themeMode]);

  return null;
}
