import React from 'react'

// 句子依存树弹窗（对标句乐部「查看句子树」）
// 当前练习点未接入俄语句法依存数据 → 展示空态说明（与句乐部无数据时的行为一致）
export default function SentenceTreeModal({ sentence, onClose }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 110, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}
    >
      <div
        style={{ width: '100%', maxWidth: 720, background: '#fff', borderRadius: 16, padding: '20px 24px', boxShadow: '0 12px 40px rgba(0,0,0,0.2)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>句子依存树</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 24, color: '#888', cursor: 'pointer' }} title="关闭">×</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1, padding: '8px 12px', border: '1px solid #DDD', borderRadius: 8, fontSize: 15, fontFamily: '"PT Serif",Georgia,serif' }}>
            {sentence || '——'}
          </div>
        </div>
        <div style={{ textAlign: 'center', padding: '56px 0', color: '#999' }}>
          <div style={{ fontSize: 44, marginBottom: 14 }}>🌳</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>暂无句子数据</div>
          <div style={{ fontSize: 13, color: '#BBB', marginTop: 6 }}>该练习点暂未提供句子分析数据</div>
        </div>
      </div>
    </div>
  )
}
