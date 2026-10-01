import React, { useState, useEffect } from 'react'
import { annotateWords, ensureDictFull } from '../lib/wordAnnotate'
import { inferRoles } from '../lib/roleRules'
import { getPosColor, getPosLabel, buildGrammarLabel } from '../constants/posColors'

// 句子成分树弹窗（对标句乐部「句子书」）
// 展示当前句的逐词成分拆解：词性（专属颜色）+ 句子成分 + 语法标注（格/数/性/时态/人称）+ 中文释义
// 数据：本地词典标注（虚词表 + 完整词典）+ 形态规则引擎，全部确定性生成，不依赖 AI
export default function SentenceTreeModal({ sentence, onClose }) {
  const sentenceText = typeof sentence === 'string'
    ? sentence
    : (sentence?.stressMarked || sentence?.russian || sentence?.ru || sentence?.text || '')
  const [words, setWords] = useState(null)

  useEffect(() => {
    let alive = true
    if (!sentenceText) { setWords([]); return () => { alive = false } }
    const annotate = () => {
      if (!alive) return
      const annotated = annotateWords(sentenceText)
      setWords(inferRoles(sentenceText, annotated))
    }
    // 先确保完整词典就位（动词变位等实词更准确），失败也走兜底标注
    Promise.resolve(ensureDictFull()).then(annotate).catch(annotate)
    return () => { alive = false }
  }, [sentenceText])

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 110, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}
    >
      <div
        style={{ width: '100%', maxWidth: 760, maxHeight: '85vh', background: '#fff', borderRadius: 16, padding: '20px 24px', boxShadow: '0 12px 40px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexShrink: 0 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>句子成分树</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 24, color: '#888', cursor: 'pointer' }} title="关闭">×</button>
        </div>

        {/* 当前句子 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexShrink: 0 }}>
          <div style={{ flex: 1, padding: '8px 12px', border: '1px solid #DDD', borderRadius: 8, fontSize: 15, fontFamily: '"PT Serif",Georgia,serif' }}>
            {sentenceText || '——'}
          </div>
        </div>

        {/* 逐词成分列表 */}
        <div style={{ flex: 1, overflowY: 'auto', margin: '0 -4px', padding: '0 4px' }}>
          {words === null ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#999', fontSize: 13 }}>
              <div style={{ fontSize: 34, marginBottom: 10 }}>⏳</div>
              正在解析句子成分…
            </div>
          ) : words.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '56px 0', color: '#999' }}>
              <div style={{ fontSize: 44, marginBottom: 14 }}>🌳</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>暂无句子数据</div>
              <div style={{ fontSize: 13, color: '#BBB', marginTop: 6 }}>该练习点暂未提供句子分析数据</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {words.map((w, i) => {
                const color = getPosColor(w.pos)
                const label = getPosLabel(w.pos)
                const gLabel = buildGrammarLabel(w)
                const role = w.roleLabel || '待确认'
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: '#F8F7F5', border: '1px solid #EFEDEA' }}>
                    {/* 单词（词性色） */}
                    <div style={{ minWidth: 150, flexShrink: 0 }}>
                      <span style={{ fontSize: 15, fontFamily: '"PT Serif",Georgia,serif', fontWeight: 600, color, marginRight: 6 }}>{w.stress || w.form || w.word}</span>
                      <span style={{ fontSize: 11, color: color, background: color + '1A', borderRadius: 999, padding: '1px 7px', marginLeft: 2 }}>{label}</span>
                    </div>
                    {/* 成分标签 */}
                    <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, color: '#3D332C', background: '#EFEAE4', borderRadius: 999, padding: '2px 10px' }}>{role}</span>
                    {/* 语法标注 */}
                    {gLabel && <span style={{ flexShrink: 0, fontSize: 11, color: '#8A8078' }}>{gLabel}</span>}
                    {/* 中文 */}
                    <span style={{ flex: 1, textAlign: 'right', fontSize: 13, color: '#6B635C' }}>{w.chinese || ''}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
