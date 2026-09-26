import React, { useState } from 'react'

// 学习内容弹窗（对标句乐部「查看课程学习内容 Ctrl+1」）
// 左侧：本课句子列表；右侧：选中句的知识点解析 + 「练习此句」
export default function LearningContentModal({ title, sentences, onClose, onPractice }) {
  const [activeIdx, setActiveIdx] = useState(0)
  const list = (sentences && sentences.length) ? sentences : []
  const s = list[activeIdx] || null

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 110, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}
    >
      <div
        style={{ position: 'relative', width: '100%', maxWidth: 920, maxHeight: '84vh', display: 'flex', background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.2)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 左侧：句子列表 */}
        <div style={{ width: 300, flexShrink: 0, borderRight: '1px solid #EEE', overflowY: 'auto', padding: '18px 0 12px' }}>
          <div style={{ padding: '0 20px 12px', fontSize: 18, fontWeight: 700 }}>{title || '学习内容'}</div>
          {list.length === 0 ? (
            <p style={{ padding: 20, color: '#999', textAlign: 'center', fontSize: 14 }}>暂无句子</p>
          ) : list.map((x, i) => (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '10px 20px', border: 'none',
                borderLeft: i === activeIdx ? '3px solid #7C3AED' : '3px solid transparent',
                background: i === activeIdx ? '#F3F0FF' : '#fff',
                color: i === activeIdx ? '#6D28D9' : '#3D332C',
                fontSize: 14, cursor: 'pointer'
              }}
            >
              <span style={{ color: '#999', marginRight: 8, fontSize: 12 }}>{String(i + 1).padStart(2, '0')}</span>
              {x.ru}
            </button>
          ))}
        </div>
        {/* 右侧：知识点解析 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '22px 26px' }}>
          {!s ? (
            <p style={{ color: '#999', textAlign: 'center', padding: '60px 0' }}>选择左侧句子查看知识点解析</p>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: '"PT Serif",Georgia,serif', lineHeight: 1.4 }}>{s.ru}</div>
                <button
                  onClick={() => onPractice && onPractice(s)}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#7C3AED', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
                >
                  练习此句
                </button>
              </div>
              <div style={{ fontSize: 15, color: '#666', marginTop: 8 }}>{s.zh}</div>
              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 13, color: '#999', fontWeight: 600, marginBottom: 6 }}>单词解析</div>
                {s.ru.split(/\s+/).filter(Boolean).map((w, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '7px 0', borderBottom: '1px solid #F5F5F5' }}>
                    <span style={{ fontSize: 16, fontWeight: 600, fontFamily: '"PT Serif",Georgia,serif', minWidth: 60 }}>{w}</span>
                    <span style={{ fontSize: 12, color: '#BBB' }}>逐词释义待词典数据接入后展示</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: 14, right: 18, border: 'none', background: 'none', fontSize: 24, color: '#888', cursor: 'pointer', zIndex: 2 }}
          title="关闭"
        >
          ×
        </button>
      </div>
    </div>
  )
}
