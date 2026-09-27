/**
 * ExitConfirmModal —— 退出游戏确认弹窗（对标句乐部）
 *
 * - 返回首页：回到主页（学习主页与打卡中心）
 * - 返回课程列表：回到"我的游戏"中的游戏详情页（/game/:courseId）
 * - 继续学习：关闭弹窗留在当前答题页
 * 深色卡片 + 紫色主按钮，遮罩点击/ESC 不关闭（防止误触退出），仅按钮可关。
 */
import { useNavigate } from "react-router-dom";

export default function ExitConfirmModal({ open, onClose, courseId }) {
  const navigate = useNavigate();
  if (!open) return null;

  const goHome = () => navigate("/");
  const goCourseList = () => navigate(`/game/${courseId || ""}`);

  const overlay = {
    position: "fixed",
    inset: 0,
    zIndex: 200,
    background: "rgba(0,0,0,0.6)",
    backdropFilter: "blur(6px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    animation: "fadeIn .2s ease",
    fontFamily: '"Nunito", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  };
  const card = {
    width: "min(420px, calc(100vw - 40px))",
    background: "#17171B",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 20,
    padding: "28px 24px 20px",
    boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
    color: "#fff",
  };
  const title = { fontSize: 22, fontWeight: 800, textAlign: "center", letterSpacing: 0.3 };
  const sub = {
    fontSize: 13,
    color: "#A1A1AA",
    textAlign: "center",
    marginTop: 8,
    letterSpacing: 0.2,
  };
  const optBase = {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 12,
    textAlign: "left",
    background: "rgba(255,255,255,0.055)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 14,
    padding: "13px 16px",
    cursor: "pointer",
    transition: "background .18s ease, transform .12s ease",
  };
  const optHover = {
    background: "rgba(124,58,237,0.14)",
    borderColor: "rgba(124,58,237,0.45)",
  };
  const optTitle = { fontSize: 15, fontWeight: 700, color: "#fff" };
  const optDesc = { fontSize: 12, color: "#8E8E96", marginTop: 2, letterSpacing: 0.2 };
  const iconWrap = {
    width: 38,
    height: 38,
    borderRadius: 11,
    background: "rgba(124,58,237,0.16)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    color: "#A78BFA",
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
            onMouseEnter={(e) => { e.currentTarget.style.background = optHover.background; e.currentTarget.style.borderColor = optHover.borderColor; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.055)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; }}
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
            onMouseEnter={(e) => { e.currentTarget.style.background = optHover.background; e.currentTarget.style.borderColor = optHover.borderColor; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.055)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; }}
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
