/**
 * SummaryPanel.jsx —— 课程结算页
 *
 * 功能：
 *  - 弹窗形式，半透明遮罩
 *  - 完成题目数 + 总用时
 *  - 撒花粒子动效（canvas）
 *  - 按钮：再来一组 / 课程列表 / 下一课
 *
 * 视觉：奶咖燕麦轻奢风
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

  // 评级颜色与样式（从 useGameStats 导入的配置保持一致）
  const gradeConfig = {
    SSS: { color: "#D4A853", glow: "rgba(212,168,83,0.4)", label: "完美通关" },
    SS: { color: "#8B7BA8", glow: "rgba(139,123,168,0.35)", label: "出色表现" },
    S: { color: "#5B7B9A", glow: "rgba(91,123,154,0.35)", label: "表现优秀" },
    A: { color: "#6E8F7E", glow: "rgba(110,143,126,0.35)", label: "稳步前进" },
    B: { color: "#B08A5A", glow: "rgba(176,138,90,0.35)", label: "继续加油" },
    C: { color: "#86796D", glow: "rgba(134,121,109,0.3)", label: "需要练习" },
  };
  const currentGradeConfig = gradeConfig[grade] || gradeConfig.C;

  // ---- 弹出时自动上传练习记录 ----
  useEffect(() => {
    if (visible && !uploadedRef.current && courseId) {
      uploadedRef.current = true;
      const upload = async () => {
        try {
          await fetch("http://localhost:8000/api/course/complete", {
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
    // 重置上传标记（关闭后重新打开可再次上传）
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

  // ---- 撒花粒子系统 ----
  const initParticles = useCallback((canvas) => {
    const colors = ["#9B7B5E", "#B08A5A", "#C8B6A6", "#6E8F7E", "#A86454", "#D4B896"];
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

      // 更新位置
      p.y += p.speedY;
      p.x += p.speedX;
      p.rotation += p.rotationSpeed;

      // 超出底部后重置到顶部
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

    // 窗口大小变化时重置 canvas
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
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
        `}</style>

        {/* 评级展示 */}
        <div
          style={{
            fontSize: grade.length > 1 ? 64 : 72,
            fontWeight: 900,
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
        }}>
          {currentGradeConfig.label}
        </div>

        {/* 庆祝图标 */}
        <div style={styles.iconWrap}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={currentGradeConfig.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z"/>
          </svg>
        </div>

        {/* 标题 */}
        <h2 style={styles.title}>恭喜完成！</h2>
        <p style={styles.subtitle}>你已经完成了本组全部练习</p>

        {/* 统计数据 */}
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
            <div style={{ ...styles.statValue, color: "#B08A5A" }}>×{maxCombo}</div>
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
          <button style={styles.secondaryBtn} onClick={onRetry}>
            再来一组
          </button>
          <button style={styles.secondaryBtn} onClick={onGoCourseList}>
            课程列表
          </button>
          {hasNextCourse && (
            <button style={styles.primaryBtn} onClick={onNextCourse}>
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
// 样式（奶咖燕麦轻奢风）
// ==========================================================
const styles = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(245,240,235,0.92)",
    backdropFilter: "blur(8px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
    padding: 24,
  },
  card: {
    position: "relative",
    zIndex: 2,
    width: "100%",
    maxWidth: 440,
    background: "#fff",
    borderRadius: 24,
    padding: "40px 32px 32px",
    boxShadow: "0 12px 40px rgba(155,123,94,0.18)",
    textAlign: "center",
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #F5EFE7, #E8DDD0)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 20px",
  },
  title: {
    fontSize: 26,
    fontWeight: 700,
    color: "#3D332C",
    margin: "0 0 8px",
  },
  subtitle: {
    fontSize: 15,
    color: "#86796D",
    margin: "0 0 28px",
  },
  statsRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: "18px 16px",
    background: "#FAF7F3",
    borderRadius: 16,
    marginBottom: 20,
  },
  statItem: {
    flex: 1,
    minWidth: 0,
  },
  statValue: {
    fontSize: 22,
    fontWeight: 700,
    color: "#9B7B5E",
    marginBottom: 4,
    fontVariantNumeric: "tabular-nums",
  },
  statLabel: {
    fontSize: 13,
    color: "#86796D",
  },
  statDivider: {
    width: 1,
    height: 40,
    background: "#E0D6CB",
  },
  encouragement: {
    fontSize: 14,
    color: "#6E8F7E",
    marginBottom: 28,
    fontWeight: 500,
  },
  btnRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
  },
  secondaryBtn: {
    padding: "11px 22px",
    background: "#fff",
    color: "#5C4D3F",
    border: "1px solid #E0D6CB",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  primaryBtn: {
    padding: "11px 22px",
    background: "linear-gradient(135deg, #9B7B5E, #856849)",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    transition: "all 0.2s ease",
    boxShadow: "0 2px 8px rgba(155,123,94,0.25)",
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
