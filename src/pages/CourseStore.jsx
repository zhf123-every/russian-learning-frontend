/**
 * CourseStore.jsx —— 课程中心（课程货架页）
 * 数据来源：GET /api/course-packs（课程包）
 *           GET /api/course-packs/:id/units（统计学习进度：已完成单元数 / 总单元数 / 总步数）
 * 付费模型：src/lib/courseAccess.js（类型 / 价格 / 免费试学单元数 / 购买状态）
 * 点击课程 → /quest/:packId（RuQuest 课程详情 + 单元锁 + 购买弹窗）
 */

import { useState, useEffect, useCallback, useMemo } from "react";
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

const TYPE_FILTERS = [
  { key: "all", label: "全部" },
  { key: "sentence", label: "句子课" },
  { key: "video", label: "视频课" },
];

export default function CourseStore() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [packs, setPacks] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [purchased, setPurchased] = useState({});

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
    setPurchased(getPurchasedMap());
    const onChange = () => setPurchased(getPurchasedMap());
    window.addEventListener("rlearn:purchase-changed", onChange);
    return () => window.removeEventListener("rlearn:purchase-changed", onChange);
  }, [fetchPacks]);

  const levels = useMemo(() => {
    const s = new Set();
    packs.forEach((p) => p.level && s.add(p.level));
    return ["all", ...Array.from(s)];
  }, [packs]);

  const visiblePacks = packs.filter((p) => {
    const meta = getCourseMeta(p);
    const q = searchQuery.trim().toLowerCase();
    if (typeFilter !== "all" && meta.type !== typeFilter) return false;
    if (levelFilter !== "all" && p.level !== levelFilter) return false;
    if (!q) return true;
    return (
      (p.title || "").toLowerCase().includes(q) ||
      (p.description || "").toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ minHeight: "100vh", background: "#F7F6FB", padding: "28px 24px 60px" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        {/* 顶部标题 + 搜索 */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#1F1B2E" }}>课程中心</div>
            <div style={{ fontSize: 13, color: "#9A90B0", marginTop: 4 }}>
              系统课程从试学到精通，选一门开始今天的训练
            </div>
          </div>
          <input
            type="text"
            placeholder="搜索课程…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: 260,
              padding: "10px 18px",
              border: "1px solid #E7E3F0",
              borderRadius: 24,
              fontSize: 14,
              outline: "none",
              background: "#fff",
            }}
          />
        </div>

        {/* 筛选行：类型 + 难度 */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24, alignItems: "center" }}>
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setTypeFilter(f.key)}
              style={{
                padding: "7px 18px",
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                border: "1px solid " + (typeFilter === f.key ? "#4F46E5" : "#E2DDF0"),
                background: typeFilter === f.key ? "#4F46E5" : "#fff",
                color: typeFilter === f.key ? "#fff" : "#6B6480",
                transition: "all .15s ease",
              }}
            >
              {f.label}
            </button>
          ))}
          <span style={{ width: 1, height: 22, background: "#E2DDF0", margin: "0 4px" }} />
          {levels.map((lv) => (
            <button
              key={lv}
              onClick={() => setLevelFilter(lv)}
              style={{
                padding: "7px 16px",
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                border: "1px solid " + (levelFilter === lv ? "#7c3aed" : "#E2DDF0"),
                background: levelFilter === lv ? "#EDE9FE" : "#fff",
                color: levelFilter === lv ? "#6D28D9" : "#6B6480",
                transition: "all .15s ease",
              }}
            >
              {lv === "all" ? "全部难度" : lv}
            </button>
          ))}
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
                animation: "csSpin .8s linear infinite",
              }}
            />
            正在加载课程…
            <style>{"@keyframes csSpin{to{transform:rotate(360deg)}}"}</style>
          </div>
        ) : error ? (
          <div style={{ textAlign: "center", padding: "80px 20px", color: "#ef4444" }}>
            {error}
            <div style={{ marginTop: 14 }}>
              <button
                onClick={fetchPacks}
                style={{
                  padding: "9px 24px",
                  border: "1px solid #4F46E5",
                  borderRadius: 20,
                  background: "#fff",
                  color: "#4F46E5",
                  cursor: "pointer",
                }}
              >
                重新加载
              </button>
            </div>
          </div>
        ) : visiblePacks.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 20px", color: "#9CA3AF" }}>
            没有找到相关课程
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 22,
            }}
          >
            {visiblePacks.map((p) => {
              const meta = getCourseMeta(p)
              const totalUnits = p._units || p.lesson_count || p.unit_count || 0
              const doneUnits = p._done || 0
              const pct = totalUnits ? Math.round((doneUnits / totalUnits) * 100) : 0
              const owned = !isFreeCourse(meta) && !!purchased[p.id]
              const isVideo = meta.type === "video"
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
                    transition:
                      "transform .18s ease, box-shadow .18s ease, border-color .18s ease",
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
                        : isVideo
                        ? "linear-gradient(135deg,#6366F1 0%,#312E81 100%)"
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
                      <span style={{ fontSize: 42, opacity: 0.95, lineHeight: 1 }}>
                        {isVideo ? "▶" : "❝"}
                      </span>
                    )}

                    {/* 左上：类型标签 */}
                    <span
                      style={{
                        position: "absolute",
                        top: 12,
                        left: 12,
                        fontSize: 11,
                        color: "#fff",
                        background: "rgba(24,24,27,.42)",
                        backdropFilter: "blur(2px)",
                        padding: "3px 10px",
                        borderRadius: 999,
                        fontWeight: 600,
                      }}
                    >
                      {typeLabel(meta.type)}
                    </span>

                    {/* 右上：价格标签 */}
                    <PriceTag meta={meta} owned={owned} />

                    {p.tag && (
                      <span
                        style={{
                          position: "absolute",
                          bottom: 12,
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

                    {/* 学习进度 / 试学提示 */}
                    <div style={{ marginTop: "auto", paddingTop: 6 }}>
                      {pct > 0 ? (
                        <>
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
                        </>
                      ) : (
                        <div
                          style={{
                            fontSize: 12,
                            color: owned ? "#059669" : "#6B6480",
                            background: owned ? "#E7F5EF" : "#F5F3FB",
                            borderRadius: 8,
                            padding: "7px 12px",
                            fontWeight: 600,
                          }}
                        >
                          {owned
                            ? "✓ 已解锁 · 开始学习"
                            : isFreeCourse(meta)
                            ? "免费开放 · 开始学习"
                            : `免费试学前 ${meta.freeUnits} 单元`}
                        </div>
                      )}
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
  )
}

/** 价格角标：免费（绿）/ 价格（紫）/ 会员（金）/ 已解锁（绿） */
function PriceTag({ meta, owned }) {
  let bg = "#fff"
  let color = "#6D28D9"
  let text = priceLabel(meta)
  if (meta.isPro) {
    bg = "#FEF3C7"
    color = "#B45309"
  } else if (isFreeCourse(meta)) {
    bg = "#E7F5EF"
    color = "#047857"
  }
  if (owned) {
    bg = "#E7F5EF"
    color = "#047857"
    text = "已解锁"
  }
  return (
    <span
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        fontSize: 12,
        color,
        background: bg,
        padding: "4px 12px",
        borderRadius: 999,
        fontWeight: 700,
        boxShadow: "0 2px 8px rgba(24,24,27,.12)",
      }}
    >
      {text}
    </span>
  )
}
