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

/**
 * 全站深色降级覆盖：非答题页（主页/商城/我的游戏/详情页等）大量使用
 * bg-white / text-gray-* / border-gray-* 等浅色工具类，深夜模式下用
 * !important 统一切换，保证"深夜模式作用到网站全局"。
 * 只覆盖常用工具类，答题页（走 --qs-* 变量）与特殊设计不受影响。
 */
const DARK_OVERRIDES = `
html[data-theme="dark"] body { background: #000; color: #f4f4f5; }
html[data-theme="dark"] .bg-white { background-color: #121214 !important; }
html[data-theme="dark"] .bg-gray-50, html[data-theme="dark"] .bg-gray-100 { background-color: #161618 !important; }
html[data-theme="dark"] .bg-gray-200 { background-color: #1d1d20 !important; }
html[data-theme="dark"] .bg-gray-100\/80 { background-color: #161618 !important; }
html[data-theme="dark"] .bg-muted, html[data-theme="dark"] .bg-muted\/60 { background-color: #17171a !important; }
html[data-theme="dark"] .bg-card { background-color: #141416 !important; }
html[data-theme="dark"] .bg-background { background-color: #000 !important; }
html[data-theme="dark"] .text-gray-950, html[data-theme="dark"] .text-gray-900 { color: #f3f4f6 !important; }
html[data-theme="dark"] .text-gray-800, html[data-theme="dark"] .text-gray-700 { color: #e5e7eb !important; }
html[data-theme="dark"] .text-gray-600, html[data-theme="dark"] .text-gray-500 { color: #c7c7cf !important; }
html[data-theme="dark"] .text-gray-400 { color: #9ca3af !important; }
html[data-theme="dark"] .text-gray-300 { color: #b9bcc4 !important; }
html[data-theme="dark"] .text-foreground { color: #f1f5f9 !important; }
html[data-theme="dark"] .text-muted-foreground { color: #a8b2c1 !important; }
html[data-theme="dark"] .border-gray-300, html[data-theme="dark"] .border-gray-200, html[data-theme="dark"] .border-gray-100 { border-color: #2a2a2e !important; }
html[data-theme="dark"] .border-border { border-color: #27272a !important; }
/* daisyUI 主题类（后台/商城/表单等页面用 bg-base-100 等） */
html[data-theme="dark"] .bg-base-100 { background-color: #121214 !important; }
html[data-theme="dark"] .bg-base-200 { background-color: #161618 !important; }
html[data-theme="dark"] .bg-base-300 { background-color: #1d1d20 !important; }
html[data-theme="dark"] .bg-base-content { background-color: #f4f4f5 !important; }
html[data-theme="dark"] .text-base-content { color: #f4f4f5 !important; }
html[data-theme="dark"] .input, html[data-theme="dark"] .select, html[data-theme="dark"] .textarea { background-color: #161618 !important; color: #f4f4f5 !important; border-color: #333338 !important; }
html[data-theme="dark"] .card { background-color: #121214 !important; border-color: #27272a !important; }
html[data-theme="dark"] .modal-box { background-color: #141416 !important; color: #f4f4f5 !important; }
html[data-theme="dark"] .dropdown-content, html[data-theme="dark"] .menu { background-color: #141416 !important; }
html[data-theme="dark"] .table :where(th, td) { color: #f4f4f5 !important; border-color: #27272a !important; }
html[data-theme="dark"] .label-text { color: #a1a1aa !important; }
html[data-theme="dark"] .alert { background-color: #161618 !important; border-color: #27272a !important; }
html[data-theme="dark"] .hover\\:bg-gray-100:hover, html[data-theme="dark"] .hover\\:bg-gray-100\\/80:hover { background-color: #1d1d20 !important; }
html[data-theme="dark"] .hover\\:bg-gray-50:hover { background-color: #1a1a1d !important; }
html[data-theme="dark"] .shadow-xl { box-shadow: 0 20px 25px -5px rgba(0,0,0,0.55) !important; }
html[data-theme="dark"] .shadow-card, html[data-theme="dark"] .shadow-pop { box-shadow: 0 4px 14px rgba(0,0,0,0.45) !important; }
html[data-theme="dark"] .shadow-sm { box-shadow: 0 1px 2px rgba(0,0,0,0.4) !important; }
/* 弹窗/卡片等浅紫与带透明度浅灰：深色下统一压暗（学习内容弹窗右栏/左栏/词条卡等） */
html[data-theme="dark"] .bg-purple-50, html[data-theme="dark"] .bg-purple-100 { background-color: #211a2e !important; }
html[data-theme="dark"] .bg-purple-50\/40, html[data-theme="dark"] .bg-purple-50\/60 { background-color: #211a2e !important; }
html[data-theme="dark"] .bg-gray-50\/40, html[data-theme="dark"] .bg-gray-50\/60, html[data-theme="dark"] .bg-gray-50\/80 { background-color: #161618 !important; }
html[data-theme="dark"] .bg-white\/40, html[data-theme="dark"] .bg-white\/50, html[data-theme="dark"] .bg-white\/60, html[data-theme="dark"] .bg-white\/80 { background-color: #121214 !important; }
/* 带斜杠的 Tailwind 透明度类（bg-white/50 等）转义选择器匹配不可靠，改用属性选择器兜底：大面积半透明白块深夜改纯黑 */
html[data-theme="dark"] [class~="bg-white/40"], html[data-theme="dark"] [class~="bg-white/50"], html[data-theme="dark"] [class~="bg-white/60"], html[data-theme="dark"] [class~="bg-white/80"] { background-color: #000000 !important; }
html[data-theme="dark"] [class~="bg-gray-50/40"], html[data-theme="dark"] [class~="bg-gray-50/60"], html[data-theme="dark"] [class~="bg-gray-50/80"] { background-color: #161618 !important; }
html[data-theme="dark"] [class~="bg-purple-50/40"], html[data-theme="dark"] [class~="bg-purple-50/60"] { background-color: #211a2e !important; }
html[data-theme="dark"] [class~="bg-amber-50"], html[data-theme="dark"] [class~="bg-amber-50/60"], html[data-theme="dark"] [class~="bg-amber-100"] { background-color: #241f16 !important; }
html[data-theme="dark"] .hover\\:bg-purple-50:hover, html[data-theme="dark"] .hover\\:bg-purple-50\\/40:hover { background-color: #2a2136 !important; }
html[data-theme="dark"] .border-purple-100, html[data-theme="dark"] .border-purple-200, html[data-theme="dark"] .border-purple-300, html[data-theme="dark"] .border-purple-400 { border-color: #3b2f4d !important; }
html[data-theme="dark"] .text-purple-500, html[data-theme="dark"] .text-purple-600, html[data-theme="dark"] .text-purple-700 { color: #c4b5fd !important; }
/* 商城试学/简介页：可试学条目浅橙底、锁定时浅灰条目深色化 */
html[data-theme="dark"] .bg-amber-50, html[data-theme="dark"] .bg-amber-50\/60, html[data-theme="dark"] .bg-amber-100 { background-color: #241f16 !important; }
html[data-theme="dark"] .hover\\:bg-amber-50:hover { background-color: #2d2719 !important; }
html[data-theme="dark"] .border-amber-100, html[data-theme="dark"] .border-amber-200 { border-color: #4a3f24 !important; }
/* 通关之路（/journey）：所有紫色文字深夜模式改为白色 */
html[data-theme="dark"] .section-title, html[data-theme="dark"] .stat-value, html[data-theme="dark"] .rpg-card-link,
html[data-theme="dark"] .chart-total, html[data-theme="dark"] .radar-name, html[data-theme="dark"] .bar-head,
html[data-theme="dark"] .awaken-note, html[data-theme="dark"] .section-sub::before { color: #ffffff !important; }
html[data-theme="dark"] .peak, html[data-theme="dark"] .peak-num, html[data-theme="dark"] .talent-label { fill: #ffffff !important; }
`;

export default function GlobalTheme() {
  const [ui, setUi] = useState(() => loadUi());

  // 注入全站深色覆盖样式（仅挂载一次）
  useEffect(() => {
    const id = "global-theme-dark-overrides";
    if (document.getElementById(id)) return;
    const st = document.createElement("style");
    st.id = id;
    st.textContent = DARK_OVERRIDES;
    document.head.appendChild(st);
  }, []);

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
