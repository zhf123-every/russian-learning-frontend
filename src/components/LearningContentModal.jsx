import React, { useState } from 'react'

// 学习内容弹窗（对标句乐部「查看课程学习内容 Ctrl+1」）
// 左侧：本课句子列表；右侧：选中句的知识点解析（中文翻译/俄语释义/单词短语注解）+「练习此句」
export default function LearningContentModal({ title, sentences, onClose, onPractice }) {
  const [activeIdx, setActiveIdx] = useState(0)
  const list = (sentences && sentences.length) ? sentences : []
  const s = list[activeIdx] || null

  // 主句显示带重音形式（stressMarked 有则用，否则原句）
  const mainRu = s?.stressMarked || s?.ru || ''
  // 逐词注解：优先用 words（重音形式+词性），退化为按空格分词
  const wordRows = (() => {
    if (!s) return []
    if (Array.isArray(s.words) && s.words.length) {
      return s.words.filter((w) => w && w.form).map((w) => ({
        form: w.form,
        pos: w.pos || '',
        grammar: w.grammarLabel || '',
      }))
    }
    return String(s.ru || '').split(/\s+/).filter(Boolean).map((w) => ({ form: w, pos: '', grammar: '' }))
  })()

  const label = { fontSize: 13, fontWeight: 700, color: '#3D332C', marginBottom: 6 }
  const value = { fontSize: 14, color: '#666', lineHeight: 1.7 }
  const placeholder = { fontSize: 12, color: '#BBB', lineHeight: 1.7 }

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

        {/* 右侧：知识点解析（对标句乐部） */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '22px 26px' }}>
          {!s ? (
            <p style={{ color: '#999', textAlign: 'center', padding: '60px 0' }}>选择左侧句子查看知识点解析</p>
          ) : (
            <>
              {/* 顶部行：知识点解析 + 练习此句 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#3D332C' }}>知识点解析</div>
                <button
                  onClick={() => onPractice && onPractice(s)}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#7C3AED', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
                >
                  练习此句
                </button>
              </div>

              {/* 主句（俄语 + 重音） */}
              <div style={{ marginTop: 14, fontSize: 24, fontWeight: 700, fontFamily: '"PT Serif",Georgia,serif', lineHeight: 1.4, color: '#18181B' }}>
                {mainRu}
              </div>

              {/* 中文翻译 */}
              <div style={{ marginTop: 18 }}>
                <div style={label}>中文翻译</div>
                <div style={value}>{s.zh || '—'}</div>
              </div>

              {/* 俄语释义（对标句乐部「英文释义」） */}
              <div style={{ marginTop: 14 }}>
                <div style={label}>俄语释义</div>
                {s.translation ? (
                  <div style={value}>{s.translation}</div>
                ) : (
                  <div style={placeholder}>暂无释义数据（接入词典后可展示）</div>
                )}
              </div>

              {/* 单词短语注解 */}
              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#3D332C', marginBottom: 8 }}>单词短语注解</div>
                {wordRows.map((w, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid #F5F5F5', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 16, fontWeight: 600, fontFamily: '"PT Serif",Georgia,serif', minWidth: 70, color: '#18181B' }}>{w.form}</span>
                    {w.pos ? (
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#7C3AED', background: '#F3F0FF', padding: '2px 8px', borderRadius: 999 }}>{w.pos}</span>
                    ) : (
                      <span style={{ fontSize: 11, color: '#BBB', padding: '2px 8px' }}>词性待标注</span>
                    )}
                    {w.grammar ? (
                      <span style={{ fontSize: 11, color: '#888' }}>{w.grammar}</span>
                    ) : null}
                  </div>
                ))}

                <div style={{ marginTop: 12, fontSize: 12, color: '#BBB', lineHeight: 1.9 }}>
                  <div><span style={{ color: '#888' }}>基本含义：</span>暂无数据（接入词典后可展示）</div>
                  <div><span style={{ color: '#888' }}>上下文含义：</span>暂无数据（接入词典后可展示）</div>
                  <div><span style={{ color: '#888' }}>同义词：</span>暂无数据</div>
                  <div><span style={{ color: '#888' }}>反义词：</span>暂无数据</div>
                  <div><span style={{ color: '#888' }}>常用短语：</span>暂无数据</div>
                </div>
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
