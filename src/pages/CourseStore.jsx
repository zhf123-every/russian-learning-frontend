/**
 * CourseStore.jsx —— 我的课程包列表页（第一层）
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";

const COURSE_PACKS = [
  {
    id: "privet_rossiya_a1",
    title: "Привет, Россия! A1",
    description: "A1 级别俄语入门课程，12 个单元，覆盖问候、地点、拥有、运动、数量、喜好、必须、过去时、将来时、从句等核心语法。",
    cover: "linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)",
    level: "A1",
    unitCount: 12,
    progress: 0,
    completed: 0,
  }
];

export default function CourseStore() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredPacks = COURSE_PACKS.filter(pack => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return pack.title.toLowerCase().includes(q);
  });

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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
        {filteredPacks.map((pack) => (
          <div 
            key={pack.id}
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
              background: pack.cover,
            }}>
              {pack.title}
            </div>
            <div style={{ padding: '16px' }}>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#1F2937', marginBottom: '8px' }}>{pack.title}</div>
              <div style={{ fontSize: '13px', color: '#6B7280', lineHeight: 1.5, marginBottom: '12px' }}>{pack.description}</div>
              <div style={{ height: '4px', background: '#F3F4F6', borderRadius: '2px', marginBottom: '8px' }}>
                <div style={{ height: '100%', width: `${pack.progress}%`, background: '#7c3aed', borderRadius: '2px' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#9CA3AF' }}>
                <span>{pack.completed}/{pack.unitCount} 单元</span>
                <span>{pack.progress}% 完成</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
