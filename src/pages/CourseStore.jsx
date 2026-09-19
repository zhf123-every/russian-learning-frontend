/**
 * CourseStore.jsx —— 我的课程包列表页（第一层）
 * 数据来源：GET /api/course-packs（课程包）
 *           GET /api/course-packs/:id/units（统计学习进度：已完成单元数 / 总单元数 / 总步数）
 * 点击课程包 → /quest/:packId（RuQuest 课程单元展示页）
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE || "https://russian-learning-jetq.onrender.com";

// 带退避重试（Render 免费实例冷启动 / 边缘抖动）
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
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw last || new Error("网络错误");
}

const formatLearners = (n) => {
  n = Number(n) || 0;
  if (n >= 10000) return (n / 10000).toFixed(1) + "万";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
};

export default function CourseStore() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [packs, setPacks] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchPacks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJson(`${API_BASE}/api/course-packs`);
      const list = Array.isArray(data) ? data : [];
      // 每个包再拉一次单元列表，用于统计学习进度
      const withProgress = await Promise.all(
        list.map(async (p) => {
          try {
            const u = await fetchJson(
              `${API_BASE}/api/course-packs/${encodeURIComponent(p.id)}/units`
            );
            const units = (u && u.units) || [];
            const done = units.filter((x) => x.status === "已完成").length;
            const steps = units.reduce((n, x) => n + (x.step_count || 0), 0);
            return { ...p, _units: units.length, _done: done, _steps: steps };
          } catch (e) {
            return {
              ...p,
              _units: p.lesson_count || p.unit_count || 0,
              _done: 0,
              _steps: 0,
            };
          }
        })
      );
      setPacks(withProgress);
    } catch (e) {
      setError("网络错误：" + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPacks();
  }, [fetchPacks]);

  const visiblePacks = packs.filter((p) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      (p.title || "").toLowerCase().includes(q) ||
      (p.description || "").toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ minHeight: "100vh", background: "#F7F6FB", padding: "28px 24px 60px" }}>
      <div>
        {/* 顶部标题 + 搜索 */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 26,
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#1F1B2E" }}>我的课程包</div>
            <div style={{ fontSize: 13, color: "#9A90B0", marginTop: 4 }}>
              选择一个课程包，开始句型家族渐进构建学习
            </div>
          </div>
          <input
            type="text"
            placeholder="搜索课程包…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: 280,
              padding: "10px 18px",
              border: "1px solid #E7E3F0",
              borderRadius: 24,
              fontSize: 14,
              outline: "none",
              background: "#fff",
            }}
          />
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
                borderTopColor: "#8B5CF6",
                animation: "ruSpin .8s linear infinite",
              }}
            />
            正在加载课程包…
            <style>{"@keyframes ruSpin{to{transform:rotate(360deg)}}"}</style>
          </div>
        ) : error ? (
          <div style={{ textAlign: "center", padding: "80px 20px", color: "#ef4444" }}>
            {error}
            <div style={{ marginTop: 14 }}>
              <button
                onClick={fetchPacks}
                style={{
                  padding: "9px 24px",
                  border: "1px solid #7c3aed",
                  borderRadius: 20,
                  background: "#fff",
                  color: "#7c3aed",
                  cursor: "pointer",
                }}
              >
                重新加载
              </button>
            </div>
          </div>
        ) : visiblePacks.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 20px", color: "#9CA3AF" }}>
            没有找到相关课程包
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))",
              gap: 24,
            }}
          >
            {visiblePacks.map((p) => {
              const totalUnits = p._units || p.lesson_count || p.unit_count || 0;
              const doneUnits = p._done || 0;
              const pct = totalUnits ? Math.round((doneUnits / totalUnits) * 100) : 0;
              return (
                <div
                  key={p.id}
                  className="pack-card"
                  onClick={() => navigate("/quest/" + encodeURIComponent(p.id))}
                  style={{
                    background: "#fff",
                    borderRadius: 18,
                    border: "1px solid #EEE9F9",
                    overflow: "hidden",
                    cursor: "pointer",
                    boxShadow: "0 2px 12px rgba(61,46,100,.05)",
                    transition: "transform .18s ease, box-shadow .18s ease, border-color .18s ease",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {/* 封面 */}
                  <div
                    style={{
                      height: 150,
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      background: p.cover_url
                        ? undefined
                        : "linear-gradient(135deg,#8B5CF6 0%,#6D28D9 100%)",
                      overflow: "hidden",
                    }}
                  >
                    {p.cover_url ? (
                      <img
                        src={p.cover_url}
                        alt={p.title}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <span style={{ fontSize: 40, fontWeight: 300, fontStyle: "italic", letterSpacing: 2 }}>
                        {p.level || "A1"}
                      </span>
                    )}
                    {p.tag && (
                      <span
                        style={{
                          position: "absolute",
                          top: 12,
                          right: 12,
                          fontSize: 11,
                          color: "#6D28D9",
                          background: "rgba(255,255,255,.92)",
                          padding: "3px 10px",
                          borderRadius: 999,
                          fontWeight: 600,
                        }}
                      >
                        {p.tag}
                      </span>
                    )}
                  </div>

                  {/* 信息 */}
                  <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                    <div style={{ fontSize: 17, fontWeight: 800, color: "#1F1B2E" }}>{p.title}</div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "#7C7390",
                        lineHeight: 1.6,
                        minHeight: 41,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {p.description}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {[p.level, p.category].filter(Boolean).map((t) => (
                        <span
                          key={t}
                          style={{
                            fontSize: 11,
                            color: "#7c3aed",
                            background: "#EDE9FE",
                            padding: "2px 10px",
                            borderRadius: 999,
                          }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                    <div style={{ fontSize: 12.5, color: "#9A90B0", display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span>{p.author || "句乐部"}</span>
                      <span>·</span>
                      <span>{totalUnits} 单元</span>
                      <span>·</span>
                      <span>{p._steps || 0} 步</span>
                      <span>·</span>
                      <span>{formatLearners(p.learner_count)} 人在学</span>
                    </div>

                    {/* 学习进度 */}
                    <div style={{ marginTop: "auto", paddingTop: 6 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 12,
                          color: "#9A90B0",
                          marginBottom: 6,
                        }}
                      >
                        <span>
                          {doneUnits}/{totalUnits} 单元完成
                        </span>
                        <span style={{ color: "#7c3aed", fontWeight: 600 }}>{pct}%</span>
                      </div>
                      <div style={{ height: 7, background: "#F1EEF9", borderRadius: 4, overflow: "hidden" }}>
                        <div
                          style={{
                            width: pct + "%",
                            height: "100%",
                            borderRadius: 4,
                            background: "linear-gradient(90deg,#8B5CF6,#6D28D9)",
                            transition: "width .4s ease",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>
        {`
          .pack-card:hover{transform:translateY(-4px);box-shadow:0 16px 40px rgba(124,58,237,.18)!important;border-color:#C4B5FD!important}
        `}
      </style>
    </div>
  );
}
