/**
 * SummaryPanel.jsx —— 课程结算页（句乐部白底紫色风格）
 *
 * 功能：
 *  - 弹窗形式，半透明黑色遮罩
 *  - 评级展示（SSS/SS/S/A/B/C，紫色系）
 *  - 完成题目数 + 总用时 + 正确率 + 最大连击
 *  - 撒花粒子动效（canvas，紫色系）
 *  - 按钮：再来一组 / 课程列表 / 下一课
 *  - 自动上传练习记录
 */

import { useEffect, useRef, useCallback } from "react";

export default function SummaryPanel({
  visible = false,
  totalQuestions = 0,
  totalTime = 0,
  accuracy = 0,
  maxCombo = 0,
  grade = "C",
  courseId = "",
  onRetry,
  onGoCourseList,
  onNextCourse,
  hasNextCourse = false,
}) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const particlesRef = useRef([]);
  const uploadedRef = useRef(false);

  // 评级颜色与样式（紫色系）
  const gradeConfig = {
    SSS: { color: "#7C3AED", glow: "rgba(124,58,237,0.5)", label: "完美通关" },
    SS:  { color: "#A855F7", glow: "rgba(168,85,247,0.45)", label: "出色表现" },
    S:   { color: "#C084FC", glow: "rgba(192,132,252,0.4)", label: "表现优秀" },
    A:   { color: "#6B7280", glow: "rgba(107,114,128,0.35)", label: "稳步前进" },
    B:   { color: "#9CA3AF", glow: "rgba(156,163,175,0.3)", label: "继续加油" },
    C:   { color: "#D1D5DB", glow: "rgba(209,213,219,0.25)", label: "需要练习" },
  };
  const currentGradeConfig = gradeConfig[grade] || gradeConfig.C;

  // ---- 弹出时自动上传练习记录 ----
  useEffect(() => {
    if (visible && !uploadedRef.current && courseId) {
      uploadedRef.current = true;
      const apiBase = import.meta.env.VITE_API_BASE || "http://localhost:8000";
      const upload = async () => {
        try {
          await fetch(`${apiBase}/api/course/complete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              course_id: courseId,
              completion_time: totalTime,
              correct_count: Math.round((accuracy / 100) * totalQuestions),
              total_count: totalQuestions,
              max_combo: maxCombo,
              rating: grade,
            }),
          });
        } catch (e) {
          console.warn("练习记录上传失败:", e);
        }
      };
      upload();
    }
    if (!visible) {
      uploadedRef.current = false;
    }
  }, [visible, courseId, totalTime, accuracy, totalQuestions, maxCombo, grade]);

  // ---- 格式化时间 ----
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s}秒`;
    return `${m}分${s.toString().padStart(2, "0")}秒`;
  };

  // ---- 撒花粒子系统（紫色系） ----
  const initParticles = useCallback((canvas) => {
    const colors = ["#E879F9", "#A855F7", "#C084FC", "#F0ABFC", "#FFFFFF"];
    const particles = [];
    const count = 80;
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * -canvas.height - 20,
        size: Math.random() * 8 + 4,
        speedY: Math.random() * 2 + 1,
        speedX: (Math.random() - 0.5) * 1.5,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        opacity: Math.random() * 0.5 + 0.5,
        shape: Math.random() > 0.5 ? "rect" : "circle",
      });
    }
    return particles;
  }, []);

  const drawParticles = useCallback((ctx, canvas, particles) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;
      if (p.shape === "rect") {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      p.y += p.speedY;
      p.x += p.speedX;
      p.rotation += p.rotationSpeed;

      if (p.y > canvas.height + 20) {
        p.y = -20;
        p.x = Math.random() * canvas.width;
      }
    });
  }, []);

  // ---- 启动/停止动画 ----
  useEffect(() => {
    if (!visible) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    particlesRef.current = initParticles(canvas);

    const animate = () => {
      drawParticles(ctx, canvas, particlesRef.current);
      animationRef.current = requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    // 清理：cancelAnimationFrame 必须在返回函数里调用
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      window.removeEventListener("resize", handleResize);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [visible, initParticles, drawParticles]);

  if (!visible) return null;

  return (
    <div style={styles.overlay}>
      {/* 撒花 canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />

      {/* 结算卡片 */}
      <div style={{ ...styles.card, animation: "summary-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)" }}>
        <style>{`
          @keyframes summary-pop {
            0% { opacity: 0; transform: scale(0.8) translateY(20px); }
            100% { opacity: 1; transform: scale(1) translateY(0); }
          }
          @keyframes grade-glow {
            0%, 100% { text-shadow: 0 0 20px ${currentGradeConfig.glow}, 0 0 40px ${currentGradeConfig.glow}; }
            50% { text-shadow: 0 0 30px ${currentGradeConfig.glow}, 0 0 60px ${currentGradeConfig.glow}; }
          }
          @keyframes grade-reveal {
            0% { opacity: 0; transform: scale(0.5) rotate(-10deg); }
            60% { transform: scale(1.15) rotate(3deg); }
            100% { opacity: 1; transform: scale(1) rotate(0); }
          }
          .summary-btn-primary { transition: opacity 0.15s ease; }
          .summary-btn-primary:hover { opacity: 0.85; }
          .summary-btn-secondary { transition: border-color 0.15s ease, color 0.15s ease; }
          .summary-btn-secondary:hover { border-color: var(--ew-accent, #E879F9); color: var(--ew-accent, #E879F9); }
        `}</style>

        {/* 评级展示 */}
        <div
          style={{
            fontFamily: '"Nunito", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            fontSize: "3.75rem",
            fontWeight: 700,
            color: currentGradeConfig.color,
            letterSpacing: grade.length > 1 ? 4 : 0,
            marginBottom: 4,
            animation: "grade-reveal 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), grade-glow 2s ease-in-out infinite",
            lineHeight: 1.1,
          }}
        >
          {grade}
        </div>
        <div style={{
          fontSize: 14,
          color: currentGradeConfig.color,
          fontWeight: 600,
          marginBottom: 20,
          letterSpacing: 2,
          textTransform: "uppercase",
        }}>
          {currentGradeConfig.label}
        </div>

        {/* 标题 */}
        <h2 style={styles.title}>恭喜完成！</h2>
        <p style={styles.subtitle}>你已经完成了本组全部练习</p>

        {/* 统计数据（四格） */}
        <div style={styles.statsRow}>
          <div style={styles.statItem}>
            <div style={styles.statValue}>{totalQuestions}</div>
            <div style={styles.statLabel}>完成题目</div>
          </div>
          <div style={styles.statDivider} />
          <div style={styles.statItem}>
            <div style={styles.statValue}>{formatTime(totalTime)}</div>
            <div style={styles.statLabel}>总用时</div>
          </div>
          <div style={styles.statDivider} />
          <div style={styles.statItem}>
            <div style={{ ...styles.statValue, color: currentGradeConfig.color }}>{accuracy.toFixed(0)}%</div>
            <div style={styles.statLabel}>正确率</div>
          </div>
          <div style={styles.statDivider} />
          <div style={styles.statItem}>
            <div style={{ ...styles.statValue, color: "#A855F7" }}>×{maxCombo}</div>
            <div style={styles.statLabel}>最大连击</div>
          </div>
        </div>

        {/* 鼓励语 */}
        <div style={styles.encouragement}>
          {totalTime / totalQuestions < 15
            ? "速度很快，继续保持！"
            : totalTime / totalQuestions < 30
            ? "稳扎稳打，表现不错！"
            : "认真学习的样子最棒！"}
        </div>

        {/* 操作按钮 */}
        <div style={styles.btnRow}>
          <button className="summary-btn-secondary" style={styles.secondaryBtn} onClick={onRetry}>
            再来一组
          </button>
          <button className="summary-btn-secondary" style={styles.secondaryBtn} onClick={onGoCourseList}>
            课程列表
          </button>
          {hasNextCourse && (
            <button className="summary-btn-primary" style={styles.primaryBtn} onClick={onNextCourse}>
              下一课
              <span style={styles.kbdHint}>↵</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ==========================================================
// 样式（句乐部白底紫色风格）
// ==========================================================
const styles = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
    padding: 16,
    overflowY: "auto",
  },
  card: {
    position: "relative",
    zIndex: 2,
    width: "100%",
    maxWidth: 440,
    background: "#FFFFFF",
    borderRadius: 16,
    padding: "36px 28px 28px",
    textAlign: "center",
    maxHeight: "90vh",
    overflowY: "auto",
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: "#202020",
    margin: "0 0 6px",
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    margin: "0 0 24px",
  },
  statsRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "16px 12px",
    background: "#F9FAFB",
    borderRadius: 12,
    marginBottom: 20,
  },
  statItem: {
    flex: 1,
    minWidth: 0,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 700,
    color: "#374151",
    marginBottom: 4,
    fontVariantNumeric: "tabular-nums",
  },
  statLabel: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  statDivider: {
    width: 1,
    height: 36,
    background: "#E5E7EB",
  },
  encouragement: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 24,
    fontWeight: 500,
  },
  btnRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
  },
  secondaryBtn: {
    padding: "10px 22px",
    background: "#fff",
    color: "#374151",
    border: "1px solid #D1D5DB",
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
  },
  primaryBtn: {
    padding: "10px 22px",
    background: "var(--ew-accent, #E879F9)",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  },
  kbdHint: {
    display: "inline-block",
    padding: "1px 5px",
    background: "rgba(255,255,255,0.25)",
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 400,
  },
};
