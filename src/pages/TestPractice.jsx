/**
 * TestPractice.jsx —— 连词成句状态机闭环测试页（真实后端版）
 *
 * 接入真实 Python 后端 http://localhost:8000
 *  - GET  /api/courses/<courseId>/statements  获取课程全部句子
 *  - POST /api/answer/submit                   提交判题
 *
 * 验证完整流程：
 *   输入 → Enter 提交后端 → 返回 errors → Fix 模式
 *   → 按任意键进入 Fix_Input → 空格跳转下一个错词 → 修正 → 提交成功
 */

import { useRef, useState, useEffect, useCallback } from "react";
import { useQuestionInput, MODES } from "../hooks/useQuestionInput";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";

// ============================================================
// 配置
// ============================================================
const API_BASE = "http://localhost:8000";
const COURSE_ID = "76ac2183f7ff4a6ffdf53c30"; // A1 基础课程（3条种子数据）

// ============================================================
// 测试组件
// ============================================================
export default function TestPractice() {
  const [statements, setStatements] = useState([]); // 后端返回的全部句子
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [eventLog, setEventLog] = useState([]);
  const inputRef = useRef(null);

  const currentStatement = statements[questionIndex];

  // ---- 日志工具 ----
  const addLog = useCallback((msg) => {
    const time = new Date().toLocaleTimeString();
    console.log(`[TestPractice] ${msg}`);
    setEventLog((prev) => [...prev.slice(-14), `[${time}] ${msg}`]);
  }, []);

  // ---- 全局快捷键 + 输入法状态 ----
  const { isComposingRef } = useKeyboardShortcuts({
    onSound: () => addLog("🔊 Ctrl+' 发音触发"),
    onShowAnswer: () => addLog("👁 Ctrl+; 看答案触发"),
    onMastered: () => addLog("✅ Ctrl+M 标记掌握触发"),
    onAddWord: () => addLog("📝 Ctrl+N 加生词触发"),
  });

  // ---- 从后端加载课程数据 ----
  useEffect(() => {
    let cancelled = false;
    async function loadCourse() {
      setLoading(true);
      setLoadError(null);
      try {
        console.log(`[TestPractice] GET ${API_BASE}/api/courses/${COURSE_ID}/statements`);
        const res = await fetch(`${API_BASE}/api/courses/${COURSE_ID}/statements`);
        const json = await res.json();
        console.log("[TestPractice] 后端返回课程数据:", json);
        if (!cancelled) {
          if (json.ok && json.data && json.data.statements) {
            setStatements(json.data.statements);
            addLog(`✅ 从后端加载 ${json.data.statements.length} 条句子`);
            // 加载完成后自动聚焦输入框
            setTimeout(() => {
              inputRef.current?.focus();
              addLog("🎯 输入框已自动聚焦");
            }, 300);
          } else {
            setLoadError("后端返回格式异常: " + JSON.stringify(json).slice(0, 200));
          }
        }
      } catch (e) {
        console.error("[TestPractice] 加载课程失败:", e);
        if (!cancelled) {
          setLoadError(
            `无法连接后端 ${API_BASE}。请确认后端已启动：\n` +
            `cd C:\\Users\\张宏飞\\russian-learning && python server.py\n` +
            `错误: ${e.message}`
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadCourse();
    return () => { cancelled = true; };
  }, []);

  // ---- 输入状态机（接入真实后端）----
  const {
    mode,
    inputValue,
    userInputWords,
    handleChange,
    handleInputKeyDown,
    isFixMode,
    isFixInputMode,
    isInputMode,
  } = useQuestionInput({
    answerText: currentStatement?.russian || "",
    statementId: currentStatement?.id || "",
    apiBaseUrl: API_BASE,
    inputRef,
    isComposingRef,
    onCorrect: (result) => {
      addLog(`🎉 后端判定正确！errors=0, wordAnalysis=${result?.wordAnalysis?.length || 0}词`);
    },
    onWrong: (result) => {
      const errTypes = result?.errors?.map((e) => e.errorType).join(",");
      addLog(`❌ 后端判定错误！errors=${result?.errors?.length} [${errTypes}] → 进入 Fix`);
      console.log("[TestPractice] 后端 errors 详情:", result?.errors);
      console.log("[TestPractice] 后端 wordAnalysis:", result?.wordAnalysis);
    },
  });

  // ---- 题目切换 ----
  const goNext = () => {
    if (questionIndex < statements.length - 1) {
      setQuestionIndex((i) => i + 1);
      addLog(`→ 切换到第 ${questionIndex + 2} 题`);
    }
  };
  const goPrev = () => {
    if (questionIndex > 0) {
      setQuestionIndex((i) => i - 1);
      addLog(`→ 切换到第 ${questionIndex} 题`);
    }
  };

  // ==========================================================
  // 渲染
  // ==========================================================
  if (loading) {
    return (
      <div style={{ maxWidth: 800, margin: "80px auto", textAlign: "center", fontFamily: "sans-serif" }}>
        <div style={{ fontSize: 18, color: "#6b7280" }}>⏳ 正在从后端加载课程数据...</div>
        <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 8 }}>
          GET {API_BASE}/api/courses/{COURSE_ID}/statements
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ maxWidth: 800, margin: "80px auto", fontFamily: "sans-serif" }}>
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", padding: 20, borderRadius: 8 }}>
          <div style={{ color: "#dc2626", fontWeight: "bold", marginBottom: 8 }}>❌ 后端连接失败</div>
          <pre style={{ whiteSpace: "pre-wrap", color: "#991b1b", fontSize: 13 }}>{loadError}</pre>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 860, margin: "40px auto", padding: 20, fontFamily: "system-ui, sans-serif" }}>
      <h2 style={{ borderBottom: "2px solid #e879f9", paddingBottom: 10, marginTop: 0 }}>
        🧪 连词成句状态机 · 真实后端测试
      </h2>

      {/* 题目信息 */}
      <div style={{ background: "#f9fafb", padding: 16, borderRadius: 8, marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>
          第 {questionIndex + 1} / {statements.length} 题
          &nbsp;|&nbsp; statementId: <code style={{ fontSize: 11 }}>{currentStatement?.id}</code>
        </div>
        <div style={{ fontSize: 22, fontWeight: "bold", marginBottom: 4 }}>
          {currentStatement?.chinese}
        </div>
        {currentStatement?.stress_marked && (
          <div style={{ fontSize: 14, color: "#9ca3af" }}>
            重音标注: <code>{currentStatement.stress_marked}</code>
          </div>
        )}
        {currentStatement?.grammatical_note && (
          <div style={{ fontSize: 13, color: "#a78bfa", marginTop: 4 }}>
            💡 {currentStatement.grammatical_note}
          </div>
        )}
      </div>

      {/* 模式指示器 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
        <span style={{ fontSize: 13, color: "#6b7280" }}>当前模式:</span>
        <span style={badgeStyle(isInputMode, "#e879f9")}>Input</span>
        <span style={badgeStyle(isFixMode, "#ef4444")}>Fix</span>
        <span style={badgeStyle(isFixInputMode, "#f59e0b")}>Fix_Input</span>
      </div>

      {/* 输入框 */}
      <div style={{ marginBottom: 16 }}>
        <input
          ref={inputRef}
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleInputKeyDown}
          placeholder="输入俄语句子，按 Enter 提交到后端判题..."
          style={{
            width: "100%",
            padding: "14px 18px",
            fontSize: 18,
            border: "2px solid #e5e7eb",
            borderRadius: 10,
            outline: "none",
            boxSizing: "border-box",
          }}
          onFocus={(e) => (e.target.style.borderColor = "#e879f9")}
          onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
        />
        <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 6, lineHeight: 1.6 }}>
          Enter 提交到后端 | 方向键已禁用 | Fix 模式按任意键开始修正 | 空格跳下一个错词 | Backspace 回退
        </div>
      </div>

      {/* 单词状态展示 */}
      <div style={{ background: "#f9fafb", padding: 16, borderRadius: 8, marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 10 }}>
          userInputWords 实时状态（共 {userInputWords.length} 词）
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {userInputWords.map((word) => (
            <div
              key={word.id}
              style={{
                padding: "8px 14px",
                borderRadius: 6,
                fontSize: 16,
                minWidth: 60,
                textAlign: "center",
                background: word.incorrect ? "#fef2f2" : word.isActive ? "#fdf4ff" : "white",
                border: `2px solid ${
                  word.incorrect ? "#ef4444" : word.isActive ? "#e879f9" : "#e5e7eb"
                }`,
                color: word.incorrect ? "#ef4444" : word.isActive ? "#c026d3" : "#374151",
                fontWeight: word.isActive ? "bold" : "normal",
                transition: "all 0.15s",
              }}
            >
              <div>{word.userInput || <span style={{ color: "#d1d5db" }}>___</span>}</div>
              <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>
                {word.text} | [{word.start}-{word.end}]
                {word.incorrect && " ❌"}
                {word.isActive && " 🟣"}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 操作按钮 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <button onClick={goPrev} disabled={questionIndex === 0} style={btnStyle(questionIndex === 0)}>← 上一题</button>
        <button onClick={goNext} disabled={questionIndex === statements.length - 1} style={btnStyle(questionIndex === statements.length - 1)}>下一题 →</button>
        <button onClick={() => inputRef.current?.focus()} style={btnStyle(false)}>🎯 聚焦输入框</button>
        <button onClick={() => setEventLog([])} style={btnStyle(false)}>🗑 清空日志</button>
      </div>

      {/* 事件日志 */}
      <div style={{
        background: "#1f2937", color: "#d1d5db", padding: 16, borderRadius: 8,
        fontFamily: "monospace", fontSize: 12, minHeight: 180, maxHeight: 280, overflowY: "auto",
      }}>
        <div style={{ color: "#9ca3af", marginBottom: 8, fontWeight: "bold" }}>📋 事件日志（同步输出到浏览器 Console）</div>
        {eventLog.length === 0 ? (
          <div style={{ color: "#6b7280" }}>（暂无事件，点击"聚焦输入框"后开始测试）</div>
        ) : (
          eventLog.map((log, i) => <div key={i} style={{ marginBottom: 2 }}>{log}</div>)
        )}
      </div>

      {/* 测试指引 */}
      <div style={{ marginTop: 16, padding: 16, background: "#eff6ff", borderRadius: 8, fontSize: 13, lineHeight: 2 }}>
        <div style={{ fontWeight: "bold", marginBottom: 6, fontSize: 14 }}>🧪 真实后端测试步骤</div>
        <div><b>1. 变格错误测试：</b>输入 <code>Я люблю ты</code> → Enter → 后端应返回 <code>case_error</code>，第3词标红进入 Fix</div>
        <div><b>2. 拼写错误测试：</b>输入 <code>Я люблю тибя</code> → Enter → 后端应返回 <code>spelling_error</code>，第3词标红</div>
        <div><b>3. 灵活语序测试：</b>输入 <code>Я тебя люблю</code> → Enter → 后端应返回 <code>correct: true</code></div>
        <div><b>4. Fix 修正闭环：</b>出错后按空格 → 进入 Fix_Input，错词被清空 → 输入正确词 → 空格/Enter 提交</div>
        <div><b>5. 快捷键测试：</b>Ctrl+' / Ctrl+; / Ctrl+M / Ctrl+N → 日志中应显示触发</div>
      </div>
    </div>
  );
}

// ============================================================
// 样式工具
// ============================================================
function badgeStyle(active, color) {
  return {
    padding: "4px 14px",
    borderRadius: 20,
    fontSize: 13,
    fontWeight: active ? "bold" : "normal",
    background: active ? color : "#e5e7eb",
    color: active ? "white" : "#6b7280",
    transition: "all 0.2s",
  };
}

function btnStyle(disabled) {
  return {
    padding: "8px 18px",
    borderRadius: 6,
    fontSize: 14,
    cursor: disabled ? "not-allowed" : "pointer",
    border: "1px solid #d1d5db",
    background: disabled ? "#f3f4f6" : "white",
    color: disabled ? "#9ca3af" : "#374151",
  };
}
