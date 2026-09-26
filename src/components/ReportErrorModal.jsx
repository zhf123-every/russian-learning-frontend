import React, { useState } from 'react'

// 报告错误弹窗（对标句乐部「报告错误」）
// 收集问题类型 + 描述 + 当前句，存 localStorage（rlearn_error_reports），提交后展示成功态
const TYPES = ['句子有误', '发音有问题', '翻译不准确', '其他问题']

export default function ReportErrorModal({ sentence, onClose }) {
  const [type, setType] = useState(TYPES[0])
  const [desc, setDesc] = useState('')
  const [done, setDone] = useState(false)

  const submit = () => {
    try {
      const list = JSON.parse(localStorage.getItem('rlearn_error_reports') || '[]')
      list.push({ type, desc: desc.trim(), sentence, time: Date.now() })
      localStorage.setItem('rlearn_error_reports', JSON.stringify(list))
      setDone(true)
    } catch (e) {
      alert('提交失败，请重试')
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 110, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}
    >
      <div
        style={{ position: 'relative', width: '100%', maxWidth: 480, background: '#fff', borderRadius: 16, padding: '22px 24px', boxShadow: '0 12px 40px rgba(0,0,0,0.2)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>报告错误</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 24, color: '#888', cursor: 'pointer' }} title="关闭">×</button>
        </div>
        {done ? (
          <div style={{ textAlign: 'center', padding: '36px 0' }}>
            <div style={{ fontSize: 42, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#3D332C' }}>已提交，感谢反馈！</div>
            <div style={{ fontSize: 13, color: '#999', marginTop: 6 }}>我们会尽快核查并修正</div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>当前句子</div>
            <div style={{ padding: '10px 12px', background: '#F7F5F2', borderRadius: 8, fontSize: 15, fontFamily: '"PT Serif",Georgia,serif', marginBottom: 16 }}>
              {sentence || '——'}
            </div>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>问题类型</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  style={{
                    padding: '6px 14px', borderRadius: 999, border: '1px solid ' + (type === t ? '#7C3AED' : '#DDD'),
                    background: type === t ? '#F3F0FF' : '#fff', color: type === t ? '#6D28D9' : '#666',
                    fontSize: 13, cursor: 'pointer'
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>补充描述（选填）</div>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={3}
              placeholder="请描述你遇到的问题…"
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #DDD', borderRadius: 8, fontSize: 14, resize: 'vertical', fontFamily: 'inherit' }}
            />
            <button
              onClick={submit}
              style={{ width: '100%', marginTop: 16, padding: '11px 0', borderRadius: 8, border: 'none', background: '#7C3AED', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
            >
              提交反馈
            </button>
          </>
        )}
      </div>
    </div>
  )
}
