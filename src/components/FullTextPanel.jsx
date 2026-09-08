import { useState, useRef, useEffect, useCallback } from 'react'
import { apiFetch } from '../lib/api'

/**
 * 全文对照面板
 * 自包含组件，所有数据通过 props 传入，不依赖外部 store。
 *
 * Props:
 *   sentences       — [{ russian, chinese, id? }]
 *   onClose         — 关闭回调
 *   highlightIdx    — 当前高亮句子索引（外部播放进度驱动），自动滚动到可视区
 *   onSentenceClick — 点击句子回调 (idx) => void
 *   title           — 面板标题（默认"全文对照"）
 */
export default function FullTextPanel({
  sentences = [],
  onClose,
  highlightIdx = -1,
  onSentenceClick,
  title = '📖 全文对照',
}) {
  const [showZh, setShowZh] = useState(true)
  const [hoveredSentence, setHoveredSentence] = useState(-1)
  const [wordTip, setWordTip] = useState(null) // { text, x, y }
  const [loadingWord, setLoadingWord] = useState('')
  const wordCache = useRef({})
  const bodyRef = useRef(null)
  const sentenceRefs = useRef([])

  // 高亮句自动滚动到可视区域
  useEffect(() => {
    if (highlightIdx < 0) return
    const el = sentenceRefs.current[highlightIdx]
    if (el && bodyRef.current) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlightIdx])

  // 单词查询（带缓存）
  const lookupWord = useCallback(async (word, e) => {
    const clean = word.toLowerCase().trim()
    if (!clean) return
    const rect = e.target.getBoundingClientRect()
    setWordTip({ text: '查询中…', x: rect.left + rect.width / 2, y: rect.bottom + 6 })

    if (wordCache.current[clean]) {
      setWordTip({ text: wordCache.current[clean], x: rect.left + rect.width / 2, y: rect.bottom + 6 })
      return
    }

    setLoadingWord(clean)
    try {
      const r = await apiFetch('/api/dict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: clean }),
      })
      if (r.ok) {
        const j = await r.json()
        const meaning = (j && (j.meaning || j.translation || j.result)) || '未找到释义'
        wordCache.current[clean] = meaning
        setWordTip(prev => prev ? { ...prev, text: meaning } : null)
      } else {
        const meaning = '查询失败'
        wordCache.current[clean] = meaning
        setWordTip(prev => prev ? { ...prev, text: meaning } : null)
      }
    } catch (err) {
      const meaning = '网络错误'
      wordCache.current[clean] = meaning
      setWordTip(prev => prev ? { ...prev, text: meaning } : null)
    } finally {
      setLoadingWord('')
    }
  }, [])

  const clearWordTip = useCallback(() => setWordTip(null), [])

  // 将俄语句子拆分为单词 + 标点片段
  const renderWords = (text, sentIdx) => {
    if (!text) return null
    // 匹配俄语单词（含 ё），其余作为分隔符
    const parts = text.split(/([а-яёА-ЯЁ]+(?:[-'][а-яёА-ЯЁ]+)*)/g)
    return parts.map((part, i) => {
      if (/^[а-яёА-ЯЁ]/.test(part)) {
        return (
          <span
            key={i}
            onMouseEnter={(e) => lookupWord(part, e)}
            onMouseLeave={clearWordTip}
            style={{
              cursor: 'help',
              padding: '0 1px',
              borderRadius: 3,
              transition: 'background 0.15s',
            }}
          >
            {part}
          </span>
        )
      }
      return <span key={i}>{part}</span>
    })
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(60, 45, 30, 0.55)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#FDF8F0',
          borderRadius: 14,
          boxShadow: '0 20px 60px rgba(60,45,30,0.35)',
          width: '100%',
          maxWidth: 820,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid var(--border2, #E0D6C4)',
        }}
      >
        {/* 头部 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: '1px solid var(--border2, #E0D6C4)',
            background: 'var(--soft, #F5F0E8)',
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 16, color: '#5C4A3A' }}>
            {title}
            <span style={{ marginLeft: 10, fontSize: 13, color: 'var(--muted, #9A8B7A)', fontWeight: 400 }}>
              共 {sentences.length} 句 · 悬停单词查释义
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="btn sm"
              onClick={() => setShowZh(v => !v)}
              style={{ fontSize: 12 }}
            >
              {showZh ? '隐藏中译' : '显示中译'}
            </button>
            <button
              className="btn sm"
              onClick={onClose}
              style={{ fontSize: 12 }}
            >
              ✕ 关闭
            </button>
          </div>
        </div>

        {/* 正文滚动区 */}
        <div
          ref={bodyRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 20px',
          }}
        >
          {sentences.map((s, idx) => {
            const isActive = idx === highlightIdx
            const isHover = idx === hoveredSentence
            return (
              <div
                key={s.id ?? idx}
                ref={(el) => { sentenceRefs.current[idx] = el }}
                data-idx={idx}
                onMouseEnter={() => setHoveredSentence(idx)}
                onMouseLeave={() => setHoveredSentence(-1)}
                onClick={() => onSentenceClick && onSentenceClick(idx)}
                style={{
                  padding: '10px 14px',
                  marginBottom: 8,
                  borderRadius: 8,
                  cursor: onSentenceClick ? 'pointer' : 'default',
                  background: isActive
                    ? 'rgba(176, 138, 90, 0.18)'
                    : isHover
                      ? 'rgba(176, 138, 90, 0.08)'
                      : 'transparent',
                  borderLeft: isActive ? '3px solid var(--accent, #B08A5A)' : '3px solid transparent',
                  transition: 'background 0.2s, border-color 0.2s',
                }}
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span
                    style={{
                      flexShrink: 0,
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      background: isActive ? 'var(--accent, #B08A5A)' : 'var(--soft, #F5F0E8)',
                      color: isActive ? '#fff' : 'var(--muted, #9A8B7A)',
                      fontSize: 12,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginTop: 2,
                    }}
                  >
                    {idx + 1}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      className="ru-large"
                      style={{
                        fontSize: 17,
                        lineHeight: 1.6,
                        color: '#3D2F22',
                        wordBreak: 'break-word',
                      }}
                    >
                      {renderWords(s.russian, idx)}
                    </div>
                    {showZh && s.chinese && (
                      <div
                        className="zh-medium"
                        style={{
                          marginTop: 4,
                          fontSize: 14,
                          color: 'var(--muted, #9A8B7A)',
                          lineHeight: 1.5,
                        }}
                      >
                        {s.chinese}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          {sentences.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
              暂无句子数据
            </div>
          )}
        </div>
      </div>

      {/* 单词释义 tooltip（固定定位，跟随单词位置） */}
      {wordTip && (
        <div
          style={{
            position: 'fixed',
            left: wordTip.x,
            top: wordTip.y,
            transform: 'translateX(-50%)',
            background: '#3D2F22',
            color: '#FDF8F0',
            padding: '6px 12px',
            borderRadius: 6,
            fontSize: 13,
            maxWidth: 280,
            zIndex: 10000,
            pointerEvents: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            lineHeight: 1.4,
            whiteSpace: 'normal',
            textAlign: 'center',
          }}
        >
          {loadingWord ? '查询中…' : wordTip.text}
        </div>
      )}
    </div>
  )
}
