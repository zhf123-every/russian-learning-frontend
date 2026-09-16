/**
 * CourseStore.jsx —— 俄语课程商城
 *
 * 布局（对齐句乐部课程包商城）：
 *  - 顶部：返回按钮 + 搜索框
 *  - 分类 Tab：推荐、零基础、考试备考、教材同步、高频词汇
 *  - Banner 轮播
 *  - 多个课程模块（横向滚动卡片列表）
 *  - 卡片：封面图 + 标题 + 标签 + 简介 + 作者 + 课程数 + 学习人数
 *
 * 点击课程 → 跳转到 /quest-practice/:courseId
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE || "https://russian-learning-jetq.onrender.com";

// 分类 Tab（前端写死，后端返回的 categories 用于过滤）
const CATEGORIES = ["推荐", "零基础", "考试备考", "教材同步", "高频词汇"];

export default function CourseStore() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [storeData, setStoreData] = useState({ banners: [], categories: [], sections: [] });
  const [activeCategory, setActiveCategory] = useState("推荐");
  const [searchQuery, setSearchQuery] = useState("");

  // 获取商城数据
  const fetchStore = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/api/store/courses`);
      const json = await res.json();
      if (json.ok) {
        setStoreData(json.data);
      } else {
        setError(json.error || "加载失败");
      }
    } catch (e) {
      setError("网络错误：" + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStore();
  }, [fetchStore]);

  // 过滤课程：按分类 + 搜索词
  const filterCourses = useCallback((courses) => {
    let result = courses;
    if (activeCategory !== "推荐") {
      result = result.filter((c) => c.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          (c.description || "").toLowerCase().includes(q) ||
          (c.author || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [activeCategory, searchQuery]);

  // 格式化学习人数
  const formatLearners = (n) => {
    if (n >= 10000) return (n / 10000).toFixed(1) + "万";
    if (n >= 1000) return (n / 1000).toFixed(1) + "k";
    return String(n);
  };

  return (
    <div className="course-store">
      <style>{`
        .course-store {
          min-height: 100vh;
          background: #FFFFFF;
          padding-bottom: 40px;
        }
        .cs-header {
          position: sticky;
          top: 0;
          z-index: 100;
          background: #FFFFFF;
          padding: 16px 24px 12px;
          border-bottom: 1px solid #F3F4F6;
        }
        .cs-topbar {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 14px;
        }
        .cs-back {
          width: 36px;
          height: 36px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          border: 1px solid #E5E7EB;
          background: #fff;
          cursor: pointer;
          color: #6B7280;
          transition: all 0.15s;
          flex-shrink: 0;
        }
        .cs-back:hover {
          border-color: #E879F9;
          color: #E879F9;
        }
        .cs-search {
          flex: 1;
          position: relative;
        }
        .cs-search input {
          width: 100%;
          padding: 10px 16px 10px 40px;
          border: 1px solid #E5E7EB;
          border-radius: 24px;
          font-size: 14px;
          outline: none;
          background: #F9FAFB;
          transition: all 0.15s;
          font-family: inherit;
        }
        .cs-search input:focus {
          border-color: #E879F9;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(232,121,249,0.1);
        }
        .cs-search-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #9CA3AF;
        }
        .cs-tabs {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 4px;
          scrollbar-width: none;
        }
        .cs-tabs::-webkit-scrollbar { display: none; }
        .cs-tab {
          padding: 6px 16px;
          border-radius: 16px;
          font-size: 13px;
          font-weight: 500;
          color: #6B7280;
          background: #F3F4F6;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s;
          border: none;
          font-family: inherit;
        }
        .cs-tab:hover {
          background: #E5E7EB;
        }
        .cs-tab.active {
          background: #E879F9;
          color: #fff;
        }
        .cs-body {
          padding: 20px 24px 0;
          max-width: 1200px;
          margin: 0 auto;
        }
        .cs-banner {
          border-radius: 16px;
          overflow: hidden;
          margin-bottom: 28px;
          cursor: pointer;
          position: relative;
          height: 160px;
          background: linear-gradient(135deg, #E879F9 0%, #A855F7 100%);
        }
        .cs-banner img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .cs-banner-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(0,0,0,0.5), transparent);
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding: 20px;
        }
        .cs-banner-tag {
          display: inline-block;
          padding: 2px 10px;
          background: #E879F9;
          color: #fff;
          border-radius: 10px;
          font-size: 11px;
          font-weight: 700;
          margin-bottom: 8px;
          width: fit-content;
        }
        .cs-banner-title {
          font-size: 22px;
          font-weight: 700;
          color: #fff;
          font-family: "Nunito", sans-serif;
        }
        .cs-section {
          margin-bottom: 32px;
        }
        .cs-section-title {
          font-size: 18px;
          font-weight: 700;
          color: #1F2937;
          margin-bottom: 16px;
          font-family: "Nunito", sans-serif;
        }
        .cs-scroll {
          display: flex;
          gap: 16px;
          overflow-x: auto;
          padding-bottom: 8px;
          scrollbar-width: thin;
          scrollbar-color: #E5E7EB transparent;
        }
        .cs-scroll::-webkit-scrollbar { height: 6px; }
        .cs-scroll::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 3px; }
        .cs-card {
          flex-shrink: 0;
          width: 260px;
          border: 1px solid #E5E7EB;
          border-radius: 14px;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.2s;
          background: #fff;
        }
        .cs-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.08);
          border-color: #E879F9;
        }
        .cs-card-cover {
          width: 100%;
          height: 130px;
          object-fit: cover;
          background: linear-gradient(135deg, #F3E8FF 0%, #E9D5FF 100%);
        }
        .cs-card-body {
          padding: 14px;
        }
        .cs-card-tag {
          display: inline-block;
          padding: 2px 8px;
          background: #FDF4FF;
          color: #A855F7;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 600;
          margin-bottom: 8px;
        }
        .cs-card-title {
          font-size: 15px;
          font-weight: 700;
          color: #1F2937;
          margin-bottom: 6px;
          line-height: 1.3;
          font-family: "Nunito", sans-serif;
        }
        .cs-card-desc {
          font-size: 12px;
          color: #6B7280;
          line-height: 1.5;
          margin-bottom: 10px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .cs-card-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 11px;
          color: #9CA3AF;
        }
        .cs-card-author {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .cs-card-stats {
          display: flex;
          gap: 10px;
        }
        .cs-empty {
          text-align: center;
          padding: 60px 20px;
          color: #9CA3AF;
          font-size: 14px;
        }
        .cs-loading {
          text-align: center;
          padding: 80px 20px;
          color: #9CA3AF;
          font-size: 14px;
        }
        @media (max-width: 640px) {
          .cs-body { padding: 16px 16px 0; }
          .cs-card { width: 220px; }
          .cs-card-cover { height: 110px; }
          .cs-banner { height: 120px; }
          .cs-banner-title { font-size: 18px; }
        }
      `}</style>

      {/* 顶部：返回 + 搜索 */}
      <div className="cs-header">
        <div className="cs-topbar">
          <button className="cs-back" onClick={() => navigate(-1)} title="返回">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <div className="cs-search">
            <span className="cs-search-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </span>
            <input
              type="text"
              placeholder="搜索课程..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* 分类 Tab */}
        <div className="cs-tabs">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`cs-tab${activeCategory === cat ? " active" : ""}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* 主体 */}
      <div className="cs-body">
        {loading ? (
          <div className="cs-loading">加载中...</div>
        ) : error ? (
          <div className="cs-empty">
            {error}
            <div style={{ marginTop: 12 }}>
              <button
                onClick={fetchStore}
                style={{
                  padding: "8px 20px",
                  border: "1px solid #E879F9",
                  borderRadius: 8,
                  background: "#fff",
                  color: "#E879F9",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                重试
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Banner */}
            {storeData.banners.length > 0 && (
              <div
                className="cs-banner"
                onClick={() => navigate(`/quest-practice/${storeData.banners[0].id}`)}
              >
                {storeData.banners[0].cover_url ? (
                  <img src={storeData.banners[0].cover_url} alt={storeData.banners[0].title} />
                ) : null}
                <div className="cs-banner-overlay">
                  {storeData.banners[0].tag && (
                    <span className="cs-banner-tag">{storeData.banners[0].tag}</span>
                  )}
                  <div className="cs-banner-title">{storeData.banners[0].title}</div>
                </div>
              </div>
            )}

            {/* 课程分节 */}
            {storeData.sections.map((section, si) => {
              const courses = filterCourses(section.courses);
              if (courses.length === 0) return null;
              return (
                <div key={si} className="cs-section">
                  <div className="cs-section-title">{section.title}</div>
                  <div className="cs-scroll">
                    {courses.map((course) => (
                      <div
                        key={course.id}
                        className="cs-card"
                        onClick={() => navigate(`/quest-practice/${course.id}`)}
                      >
                        {course.cover_url ? (
                          <img className="cs-card-cover" src={course.cover_url} alt={course.title} />
                        ) : (
                          <div className="cs-card-cover" />
                        )}
                        <div className="cs-card-body">
                          {course.tag && (
                            <span className="cs-card-tag">{course.tag}</span>
                          )}
                          <div className="cs-card-title">{course.title}</div>
                          {course.description && (
                            <div className="cs-card-desc">{course.description}</div>
                          )}
                          <div className="cs-card-meta">
                            <span className="cs-card-author">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                              </svg>
                              {course.author || "句乐部"}
                            </span>
                            <span className="cs-card-stats">
                              <span>{course.lesson_count}课</span>
                              <span>{formatLearners(course.learner_count)}人学</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {storeData.sections.every((s) => filterCourses(s.courses).length === 0) && (
              <div className="cs-empty">没有找到相关课程</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
