/**
 * ExitConfirmModal —— 退出游戏确认弹窗（对标句乐部）
 *
 * - 返回首页：回到主页（学习主页与打卡中心）
 * - 返回课程列表：回到"我的游戏"中的游戏详情页（/game/:courseId）
 * - 继续学习：关闭弹窗留在当前答题页
 * 弹窗颜色跟随全局深夜/白天模式（GlobalTheme 在 <html> 上写 data-theme），
 * 遮罩点击/ESC 不关闭（防止误触退出），仅按钮可关。
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function ExitConfirmModal({ open, onClose, courseId }) {
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(
    () => typeof document !== "undefined" && document.documentElement.dataset.theme === "dark"
  );

  // 跟随全局主题切换（data-theme 变化 / 设置弹窗保存广播）
  useEffect(() => {
    const upd = () => setIsDark(document.documentElement.dataset.theme === "dark");
    upd();
    const mo = new MutationObserver(upd);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    window.addEventListener("quest-ui-changed", upd);
    window.addEventListener("storage", upd);
    return () => {
      mo.disconnect();
      window.removeEventListener("quest-ui-changed", upd);
      window.removeEventListener("storage", upd);
    };
  }, []);

  if (!open) return null;

  const goHome = () => navigate("/");
  const goCourseList = () => navigate(`/game/${courseId || ""}`);

  const C = isDark
    ? {
        overlayBg: "rgba(0,0,0,0.6)",
        cardBg: "#17171B",
        cardBorder: "rgba(255,255,255,0.08)",
        cardShadow: "0 24px 80px rgba(0,0,0,0.55)",
        title: "#FFFFFF",
        sub: "#A1A1AA",
        optBg: "rgba(255,255,255,0.055)",
        optBorder: "rgba(255,255,255,0.07)",
        optBgHover: "rgba(124,58,237,0.14)",
        optBorderHover: "rgba(124,58,237,0.45)",
        optTitle: "#FFFFFF",
        optDesc: "#8E8E96",
        iconBg: "rgba(124,58,237,0.16)",
        iconColor: "#A78BFA",
      }
    : {
        overlayBg: "rgba(15,15,20,0.45)",
        cardBg: "#FFFFFF",
        cardBorder: "rgba(0,0,0,0.08)",
        cardShadow: "0 24px 70px rgba(24,24,27,0.22)",
        title: "#111827",
        sub: "#6B7280",
        optBg: "rgba(0,0,0,0.045)",
        optBorder: "rgba(0,0,0,0.07)",
        optBgHover: "rgba(124,58,237,0.10)",
        optBorderHover: "rgba(124,58,237,0.45)",
        optTitle: "#111827",
        optDesc: "#6B7280",
        iconBg: "rgba(124,58,237,0.10)",
        iconColor: "#7C3AED",
      };

  const overlay = {
    position: "fixed",
    inset: 0,
    zIndex: 200,
    background: C.overlayBg,
    backdropFilter: "blur(6px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    animation: "fadeIn .2s ease",
    fontFamily: '"Nunito", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  };
  const card = {
    width: "min(420px, calc(100vw - 40px))",
    background: C.cardBg,
    border: `1px solid ${C.cardBorder}`,
    borderRadius: 20,
    padding: "28px 24px 20px",
    boxShadow: C.cardShadow,
    color: C.title,
  };
  const title = { fontSize: 22, fontWeight: 800, textAlign: "center", letterSpacing: 0.3 };
  const sub = { fontSize: 13, color: C.sub, textAlign: "center", marginTop: 8, letterSpacing: 0.2 };
  const optBase = {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 12,
    textAlign: "left",
    background: C.optBg,
    border: `1px solid ${C.optBorder}`,
    borderRadius: 14,
    padding: "13px 16px",
    cursor: "pointer",
    transition: "background .18s ease, transform .12s ease",
  };
  const optTitle = { fontSize: 15, fontWeight: 700, color: C.optTitle };
  const optDesc = { fontSize: 12, color: C.optDesc, marginTop: 2, letterSpacing: 0.2 };
  const iconWrap = {
    width: 38,
    height: 38,
    borderRadius: 11,
    background: C.iconBg,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    color: C.iconColor,
  };
  const primary = {
    width: "100%",
    marginTop: 18,
    padding: "13px 0",
    borderRadius: 13,
    background: "#7C3AED",
    color: "#fff",
    fontSize: 15,
    fontWeight: 700,
    border: "none",
    cursor: "pointer",
    transition: "background .18s ease",
    letterSpacing: 0.5,
  };

  return (
    <div style={overlay}>
      <div style={card}>
        <div style={title}>退出游戏</div>
        <p style={sub}>休息是为了更好的学习，期待你的归来！</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 22 }}>
          <button
            type="button"
            style={optBase}
            onMouseEnter={(e) => { e.currentTarget.style.background = C.optBgHover; e.currentTarget.style.borderColor = C.optBorderHover; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = C.optBg; e.currentTarget.style.borderColor = C.optBorder; }}
            onClick={goHome}
          >
            <span style={iconWrap}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M9.5 21v-6h5v6" />
              </svg>
            </span>
            <span>
              <span style={optTitle}>返回首页</span>
              <span style={optDesc}>回到学习主页与打卡中心</span>
            </span>
          </button>

          <button
            type="button"
            style={optBase}
            onMouseEnter={(e) => { e.currentTarget.style.background = C.optBgHover; e.currentTarget.style.borderColor = C.optBorderHover; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = C.optBg; e.currentTarget.style.borderColor = C.optBorder; }}
            onClick={goCourseList}
          >
            <span style={iconWrap}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18" /><path d="M9 14h6" />
              </svg>
            </span>
            <span>
              <span style={optTitle}>返回课程列表</span>
              <span style={optDesc}>浏览与切换当前课程包关卡</span>
            </span>
          </button>
        </div>

        <button
          type="button"
          style={primary}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#8B5CF6"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "#7C3AED"; }}
          onClick={onClose}
        >
          继续学习
        </button>
      </div>

      <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
    </div>
  );
}
