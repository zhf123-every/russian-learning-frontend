/**
 * CourseStore.jsx —— 我的课程包列表页（第一层）
 * 从后端 API 读取课程数据
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE || "https://russian-learning-jetq.onrender.com";

export default function CourseStore() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [storeData, setStoreData] = useState({ banners: [], categories: [], sections: [] });
  const [searchQuery, setSearchQuery] = useState("");

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

  const filterCourses = (courses) => {
    let result = courses;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          (c.description || "").toLowerCase().includes(q)
      );
    }
    return result;
  };

  const formatLearners = (n) => {
    if (n >= 10000) return (n / 10000).toFixed(1) + "万";
    if (n >= 1000) return (n / 1000).toFixed(1) + "k";
    return String(n);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#fff', padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ fontSize: '24px', fontWeight: 700, color: '#1F2937' }}>我的课程包</div>
        <div style={{ position: 'relative', width: '300px' }}>
          <input
            type="text"
            placeholder="搜索课程包..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 16px 10px 40px',
              border: '1px solid #E5E7EB',
              borderRadius: '24px',
              fontSize: '14px',
              outline: 'none',
              background: '#F9FAFB',
            }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9CA3AF' }}>加载中...</div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#ef4444' }}>
          {error}
          <div style={{ marginTop: 12 }}>
            <button onClick={fetchStore} style={{ padding: '8px 20px', border: '1px solid #7c3aed', borderRadius: 8, background: '#fff', color: '#7c3aed', cursor: 'pointer' }}>
              重试
            </button>
          </div>
        </div>
      ) : (
        <>
          {storeData.sections.map((section, si) => {
            const courses = filterCourses(section.courses);
            if (courses.length === 0) return null;
            return (
              <div key={si} style={{ marginBottom: '32px' }}>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#1F2937', marginBottom: '16px' }}>{section.title}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
                  {courses.map((course) => (
                    <div 
                      key={course.id}
                      onClick={() => navigate(`/quest`)}
                      style={{
                        border: '1px solid #E5E7EB',
                        borderRadius: '16px',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        background: '#fff',
                      }}
                    >
                      <div style={{
                        height: '160px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontSize: '20px',
                        fontWeight: 700,
                        textAlign: 'center',
                        padding: '20px',
                        background: 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
                      }}>
                        {course.title}
                      </div>
                      <div style={{ padding: '16px' }}>
                        <div style={{ fontSize: '16px', fontWeight: 600, color: '#1F2937', marginBottom: '8px' }}>{course.title}</div>
                        <div style={{ fontSize: '13px', color: '#6B7280', lineHeight: 1.5, marginBottom: '12px' }}>{course.description}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#9CA3AF' }}>
                          <span>{course.lesson_count} 单元</span>
                          <span>{formatLearners(course.learner_count)}人学</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {storeData.sections.every((s) => filterCourses(s.courses).length === 0) && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9CA3AF' }}>没有找到相关课程包</div>
          )}
        </>
      )}
    </div>
  );
}
