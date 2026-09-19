/**
 * MyCoursesHub.jsx —— 「我的」课程中心
 * 展示：正在学习（含继续学习）、已购买、可试学课程；底部保留工具入口。
 * 数据：GET /api/course-packs + /api/course-packs/:id/units；购买状态走 courseAccess（localStorage）。
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  getCourseMeta,
  getPurchasedMap,
  isFreeCourse,
  priceLabel,
  typeLabel,
} from "../lib/courseAccess";

const API_BASE =
  import.meta.env.VITE_API_BASE || "https://russian-learning-jetq.onrender.com";

async function fetchJson(url, tries = 4) {
  let last = null;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json = await res.json();
      if (json && json.ok) return json.data;
      throw new Error((json && json.error) || "返回数据格式异常");
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 900 * (i + 1)));
    }
  }
  throw last || new Error("网络错误");
}

const TOOL_LINKS = [
  { icon: "📒", label: "生词本", desc: "间隔重复复习", to: "/vocab" },
  { icon: "🔎", label: "词典", desc: "重音 · 变格 · 例句", to: "/dictionary" },
  { icon: "📊", label: "学习统计", desc: "数据与掌握情况", to: "/profile" },
];

export default function MyCoursesHub() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [courses, setCourses] = useState([]);
  const [purchased, setPurchased] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchJson(`${API_BASE}/api/course-packs`);
      const list = Array.isArray(data) ? data : [];
      const merged = await Promise.all(
        list.map(async (p) => {
          try {
            const u = await fetchJson(
              `${API_BASE}/api/course-packs/${encodeURIComponent(p.id)}/units`
            );
            const units = (u && u.units) || [];
            const done = units.filter((x) => x.status === "已完成").length;
            const doing = units.filter((x) => x.status === "进行中").length;
            const steps = units.reduce((n, x) => n + (x.step_count || 0), 0);
            // 继续学习：优先进行中单元，否则第一个未完成单元
            const nextUnit =
              units.find((x) => x.status === "进行中") ||
              units.find((x) => x.status !== "已完成") ||
              units[0];
            return { ...p, _units: units.length, _done: done, _doing: doing, _steps: steps, _next: nextUnit };
          } catch (e) {
            return { ...p, _units: p.lesson_count || 0, _done: 0, _doing: 0, _steps: 0, _next: null };
          }
        })
      );
      setCourses(merged);
    } catch (e) {
      setError("课程加载失败：" + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    setPurchased(getPurchasedMap());
    const onChange = () => setPurchased(getPurchasedMap());
    window.addEventListener("rlearn:purchase-changed", onChange);
    return () => window.removeEventListener("rlearn:purchase-changed", onChange);
  }, [load]);

  const decorated = courses.map((p) => {
    const meta = getCourseMeta(p);
    const owned = !isFreeCourse(meta) && !!purchased[p.id];
    const pct = p._units ? Math.round((p._done / p._units) * 100) : 0;
    return { ...p, _meta: meta, _owned: owned, _pct: pct };
  });

  const learning = decorated.filter((p) => p._pct > 0 || p._owned);
  const exploring = decorated.filter((p) => !(p._pct > 0 || p._owned));

  const continueStudy = (p) => {
    if (p._next) navigate("/quest-practice/" + encodeURIComponent(p._next.id) + "?pack=" + encodeURIComponent(p.id));
    else navigate("/quest/" + encodeURIComponent(p.id));
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F7F6FB", padding: "28px 24px 60px", overflowX: "hidden" }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <div style={{ marginBottom: 26 }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#1F1B2E" }}>我的课程</div>
          <div style={{ fontSize: 13, color: "#9A90B0", marginTop: 4 }}>
            继续学习、查看已购课程与学习进度
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 20px", color: "#9CA3AF" }}>
            <div
              style={{
                width: 40,
                height: 40,
                margin: "0 auto 16px",
                borderRadius: "50%",
                border: "3px solid #EDE9FE",
                borderTopColor: "#6366F1",
                animation: "mcSpin .8s linear infinite",
              }}
            />
            正在加载…
            <style>{"@keyframes mcSpin{to{transform:rotate(360deg)}}"}</style>
          </div>
        ) : error ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#ef4444" }}>
            {error}
            <div style={{ marginTop: 14 }}>
              <button
                onClick={load}
                style={{ padding: "9px 24px", border: "1px solid #4F46E5", borderRadius: 20, background: "#fff", color: "#4F46E5", cursor: "pointer" }}
              >
                重新加载
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* 正在学习 / 已购买 */}
            <SectionTitle title="继续学习" />
            {learning.length === 0 ? (
              <EmptyHint
                text="还没有开始学习的课程，去课程中心选一门，免费试学第一单元"
                actionText="去课程中心"
                onAction={() => navigate("/quest-store")}
              />
            ) : (
              <div style={{ display: "grid", gap: 16, marginBottom: 34 }}>
                {learning.map((p) => (
                  <CourseRow key={p.id} p={p} onContinue={() => continueStudy(p)} onDetail={() => navigate("/quest/" + encodeURIComponent(p.id))} />
                ))}
              </div>
            )}

            {/* 探索更多 */}
            {exploring.length > 0 && (
              <>
                <SectionTitle title="更多课程" />
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
                    gap: 18,
                    marginBottom: 34,
                  }}
                >
                  {exploring.map((p) => (
                    <MiniCourseCard key={p.id} p={p} onClick={() => navigate("/quest/" + encodeURIComponent(p.id))} />
                  ))}
                </div>
              </>
            )}

            {/* 学习工具 */}
            <SectionTitle title="学习工具" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: 14 }}>
              {TOOL_LINKS.map((t) => (
                <div
                  key={t.to}
                  onClick={() => navigate(t.to)}
                  style={{
                    background: "#fff",
                    border: "1px solid #EEE9F9",
                    borderRadius: 16,
                    padding: "18px 20px",
                    cursor: "pointer",
                    display: "flex",
                    gap: 14,
                    alignItems: "center",
                    boxShadow: "0 2px 10px rgba(61,46,100,.04)",
                    transition: "transform .15s ease, box-shadow .15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = "none")}
                >
                  <span style={{ fontSize: 26 }}>{t.icon}</span>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#1F1B2E" }}>{t.label}</div>
                    <div style={{ fontSize: 12.5, color: "#9A90B0", marginTop: 2 }}>{t.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function SectionTitle({ title }) {
  return (
    <div style={{ fontSize: 15, fontWeight: 700, color: "#1F1B2E", marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ width: 4, height: 16, borderRadius: 2, background: "linear-gradient(180deg,#6366F1,#4F46E5)" }} />
      {title}
    </div>
  )
}

function EmptyHint({ text, actionText, onAction }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px dashed #D9D2EC",
        borderRadius: 16,
        padding: "34px 24px",
        textAlign: "center",
        color: "#7C7390",
        fontSize: 14,
        marginBottom: 34,
      }}
    >
      {text}
      <div style={{ marginTop: 16 }}>
        <button
          onClick={onAction}
          style={{
            padding: "10px 26px",
            border: "none",
            borderRadius: 22,
            background: "linear-gradient(135deg,#6366F1,#4F46E5)",
            color: "#fff",
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 6px 16px rgba(79,70,229,.25)",
          }}
        >
          {actionText}
        </button>
      </div>
    </div>
  )
}

function CourseRow({ p, onContinue, onDetail }) {
  const meta = p._meta
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #EEE9F9",
        borderRadius: 18,
        padding: 20,
        display: "flex",
        gap: 18,
        alignItems: "center",
        flexWrap: "wrap",
        boxShadow: "0 2px 12px rgba(61,46,100,.05)",
      }}
    >
      <div
        onClick={onDetail}
        style={{
          width: 76,
          height: 76,
          borderRadius: 14,
          flex: "0 0 auto",
          cursor: "pointer",
          background:
            meta.type === "video"
              ? "linear-gradient(135deg,#6366F1,#312E81)"
              : "linear-gradient(135deg,#8B5CF6,#6D28D9)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 26,
        }}
      >
        {meta.type === "video" ? "▶" : "❝"}
      </div>
      <div style={{ flex: 1, minWidth: 200 }} onClick={onDetail} className="mc-cursor">
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: "#1F1B2E", cursor: "pointer" }}>{p.title}</span>
          <span style={{ fontSize: 11, color: "#6D28D9", background: "#EDE9FE", padding: "2px 9px", borderRadius: 999 }}>
            {typeLabel(meta.type)}
          </span>
          {p._owned && (
            <span style={{ fontSize: 11, color: "#047857", background: "#E7F5EF", padding: "2px 9px", borderRadius: 999, fontWeight: 700 }}>
              已解锁
            </span>
          )}
        </div>
        <div style={{ fontSize: 12.5, color: "#9A90B0", margin: "6px 0 8px" }}>
          {p._done}/{p._units} 单元 · {p._steps} 步 {p._doing > 0 ? "· 有进行中的单元" : ""}
        </div>
        <div style={{ height: 7, background: "#F1EEF9", borderRadius: 4, overflow: "hidden" }}>
          <div
            style={{
              width: p._pct + "%",
              height: "100%",
              borderRadius: 4,
              background: "linear-gradient(90deg,#8B5CF6,#6D28D9)",
              transition: "width .4s ease",
            }}
          />
        </div>
      </div>
      <button
        onClick={onContinue}
        style={{
          padding: "11px 26px",
          border: "none",
          borderRadius: 22,
          background: "linear-gradient(135deg,#6366F1,#4F46E5)",
          color: "#fff",
          fontWeight: 700,
          fontSize: 14,
          cursor: "pointer",
          boxShadow: "0 6px 16px rgba(79,70,229,.25)",
          flex: "0 0 auto",
        }}
      >
        {p._pct > 0 ? "继续学习" : "开始学习"}
      </button>
    </div>
  )
}

function MiniCourseCard({ p, onClick }) {
  const meta = p._meta
  return (
    <div
      onClick={onClick}
      style={{
        background: "#fff",
        border: "1px solid #EEE9F9",
        borderRadius: 16,
        overflow: "hidden",
        cursor: "pointer",
        boxShadow: "0 2px 10px rgba(61,46,100,.04)",
        transition: "transform .15s ease, box-shadow .15s ease",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-3px)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "none")}
    >
      <div
        style={{
          height: 92,
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontSize: 26,
          background:
            meta.type === "video"
              ? "linear-gradient(135deg,#6366F1,#312E81)"
              : "linear-gradient(135deg,#8B5CF6,#6D28D9)",
        }}
      >
        {meta.type === "video" ? "▶" : "❝"}
        <span
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            fontSize: 11.5,
            fontWeight: 700,
            color: p._owned ? "#047857" : "#6D28D9",
            background: p._owned ? "#E7F5EF" : "#fff",
            padding: "3px 10px",
            borderRadius: 999,
          }}
        >
          {p._owned ? "已解锁" : priceLabel(meta)}
        </span>
      </div>
      <div style={{ padding: 14 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: "#1F1B2E" }}>{p.title}</div>
        <div style={{ fontSize: 12, color: "#9A90B0", marginTop: 5 }}>
          {p._units} 单元 · {p._steps} 步
        </div>
      </div>
    </div>
  )
}
