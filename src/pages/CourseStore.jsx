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

// 分类 Tab
const CATEGORIES = ["全部", "零基础", "考试备考", "教材同步", "高频词汇"];

// 我们的课程数据（1个课程包，12个单元）
const COURSE_PACK = {
  id: "privet_rossiya_a1",
  title: "Привет, Россия! A1",
  description: "A1 级别俄语入门课程，12 个单元，覆盖问候、地点、拥有、运动、数量、喜好、必须、过去时、将来时、从句等核心语法。",
  cover: "linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)",
  author: "句乐部",
  learners: 12800,
  units: [
    { id: "u1", title: "Урок 1", subtitle: "A1基础句子学习", difficulty: "easy", steps: 87, duration: "15:00" },
    { id: "u2", title: "Урок 2", subtitle: "A1基础句子学习", difficulty: "easy", steps: 51, duration: "12:00" },
    { id: "u3", title: "Урок 3", subtitle: "A1基础句子学习", difficulty: "easy", steps: 12, duration: "8:00" },
    { id: "u4", title: "Урок 4", subtitle: "A1基础句子学习", difficulty: "medium", steps: 56, duration: "14:00" },
    { id: "u5", title: "Урок 5", subtitle: "A1基础句子学习", difficulty: "medium", steps: 62, duration: "16:00" },
    { id: "u6", title: "Урок 6", subtitle: "A1基础句子学习", difficulty: "medium", steps: 15, duration: "10:00" },
    { id: "u7", title: "Урок 7", subtitle: "A1基础句子学习", difficulty: "medium", steps: 17, duration: "9:00" },
    { id: "u8", title: "Урок 8", subtitle: "A1基础句子学习", difficulty: "hard", steps: 34, duration: "13:00" },
    { id: "u9", title: "Урок 9", subtitle: "A1基础句子学习", difficulty: "hard", steps: 17, duration: "11:00" },
    { id: "u10", title: "Урок 10", subtitle: "A1基础句子学习", difficulty: "medium", steps: 21, duration: "12:00" },
    { id: "u11", title: "Урок 11", subtitle: "A1基础句子学习", difficulty: "hard", steps: 21, duration: "14:00" },
    { id: "u12", title: "Урок 12", subtitle: "A1基础句子学习", difficulty: "medium", steps: 36, duration: "20:00" },
  ]
};

export default function CourseStore() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState("全部");
  const [searchQuery, setSearchQuery] = useState("");

  // 格式化学习人数
  const formatLearners = (n) => {
    if (n >= 10000) return (n / 10000).toFixed(1) + "万";
    if (n >= 1000) return (n / 1000).toFixed(1) + "k";
    return String(n);
  };

  const diffLabel = { easy: "简单", medium: "中等", hard: "困难" };
  const diffColor = { easy: "#52c41a", medium: "#faad14", hard: "#ff4d4f" };

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
        {/* Banner - 课程包 */}
        <div 
          className="cs-banner" 
          style={{ background: COURSE_PACK.cover }}
          onClick={() => navigate(`/quest`)}
        >
          <div className="cs-banner-overlay">
            <span className="cs-banner-tag">新手推荐</span>
            <div className="cs-banner-title">{COURSE_PACK.title}</div>
          </div>
        </div>

        {/* 课程包信息 */}
        <div className="cs-section">
          <div className="cs-section-title">{COURSE_PACK.title}</div>
          <div style={{ color: '#6B7280', fontSize: '14px', marginBottom: '16px', lineHeight: '1.6' }}>
            {COURSE_PACK.description}
          </div>
          <div style={{ display: 'flex', gap: '16px', color: '#9CA3AF', fontSize: '13px', marginBottom: '24px' }}>
            <span>{COURSE_PACK.author}</span>
            <span>·</span>
            <span>{COURSE_PACK.units.length} 个单元</span>
            <span>·</span>
            <span>{formatLearners(COURSE_PACK.learners)}人学</span>
          </div>
        </div>

        {/* 单元网格 */}
        <div className="cs-section">
          <div className="cs-section-title">单元大纲</div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '16px',
          }}>
            {COURSE_PACK.units.map((unit, i) => (
              <div 
                key={unit.id}
                className="cs-card"
                style={{ width: 'auto', flexShrink: '1' }}
                onClick={() => navigate(`/quest`)}
              >
                <div className="cs-card-body">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div className="cs-card-title" style={{ marginBottom: '0' }}>{unit.title}</div>
                    <span style={{ 
                      fontSize: '11px', 
                      color: diffColor[unit.difficulty], 
                      background: unit.difficulty === 'easy' ? '#f6ffed' : unit.difficulty === 'medium' ? '#fffbe6' : '#fff2f0',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontWeight: 500
                    }}>
                      {diffLabel[unit.difficulty]}
                    </span>
                  </div>
                  <div className="cs-card-desc">{unit.subtitle}</div>
                  <div className="cs-card-meta">
                    <span className="cs-card-stats">
                      <span>{unit.steps}步</span>
                      <span>{unit.duration}</span>
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
