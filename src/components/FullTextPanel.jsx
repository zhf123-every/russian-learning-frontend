import { useState, useRef, useEffect, useCallback } from 'react'
import { apiFetch } from '../lib/api'
import { callAI, parseAIJSON } from '../lib/ai'

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
  title = '全文对照',
}) {
  const [showZh, setShowZh] = useState(true)
  const [hoveredSentence, setHoveredSentence] = useState(-1)
  const [wordTip, setWordTip] = useState(null) // { word, pos, meaning, synonym, example, x, y, above }
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

  // 计算 tooltip 位置，确保不超出视口
  const computeTipPos = useCallback((rect) => {
    const tipW = 280
    const tipH = 130 // 估算高度
    let x = rect.left + rect.width / 2
    x = Math.max(tipW / 2 + 8, Math.min(x, window.innerWidth - tipW / 2 - 8))
    let y = rect.bottom + 6
    let above = false
    // 下方空间不足且上方足够时，显示在单词上方
    if (rect.bottom + tipH > window.innerHeight && rect.top > tipH + 12) {
      y = rect.top - 6
      above = true
    }
    return { x, y, above }
  }, [])

  // 单词查询（带缓存，优先 AI 丰富释义，失败降级到 /api/dict）
  const lookupWord = useCallback(async (word, e) => {
    const clean = word.toLowerCase().trim()
    if (!clean) return
    const rect = e.target.getBoundingClientRect()
    const pos = computeTipPos(rect)

    setWordTip({ word: clean, pos: '', meaning: '查询中…', synonym: '', example: '', x: pos.x, y: pos.y, above: pos.above })

    if (wordCache.current[clean]) {
      const cached = wordCache.current[clean]
      setWordTip({ ...cached, x: pos.x, y: pos.y, above: pos.above })
      return
    }

    setLoadingWord(clean)
    try {
      // 优先调用 /api/ai 获取丰富结构化释义
      const text = await callAI([
        { role: 'system', content: '你是俄语词典。对用户输入的俄语单词，严格按以下JSON格式返回，不要输出其他文字：{"word":"原形(重音)","pos":"词性","meaning":"主要中文释义","synonym":"中文同义词，用/分隔，如：去/走/前往","example":"俄语例句 — 中文翻译"}' },
        { role: 'user', content: clean }
      ])
      const parsed = parseAIJSON(text)
      if (parsed && parsed.word) {
        const rich = {
          word: parsed.word || clean,
          pos: parsed.pos || '',
          meaning: parsed.meaning || '',
          synonym: parsed.synonym || '',
          example: parsed.example || '',
        }
        wordCache.current[clean] = rich
        setWordTip(prev => prev ? { ...rich, x: prev.x, y: prev.y, above: prev.above } : null)
      } else {
        throw new Error('AI 返回格式异常')
      }
    } catch (err) {
      // 降级到 /api/dict 获取简单释义
      try {
        const r = await apiFetch('/api/dict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ word: clean }),
        })
        if (r.ok) {
          const j = await r.json()
          const meaning = (j && (j.meaning || j.translation || j.result)) || '未找到释义'
          const simple = { word: clean, pos: '', meaning, synonym: '', example: '' }
          wordCache.current[clean] = simple
          setWordTip(prev => prev ? { ...simple, x: prev.x, y: prev.y, above: prev.above } : null)
        } else {
          const simple = { word: clean, pos: '', meaning: '查询失败', synonym: '', example: '' }
          wordCache.current[clean] = simple
          setWordTip(prev => prev ? { ...simple, x: prev.x, y: prev.y, above: prev.above } : null)
        }
      } catch (e2) {
        const simple = { word: clean, pos: '', meaning: '网络错误', synonym: '', example: '' }
        wordCache.current[clean] = simple
        setWordTip(prev => prev ? { ...simple, x: prev.x, y: prev.y, above: prev.above } : null)
      }
    } finally {
      setLoadingWord('')
    }
  }, [computeTipPos])

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
              关闭
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

      {/* 单词释义 tooltip（固定定位，跟随单词位置，结构化分层展示） */}
      {wordTip && (
        <div
          style={{
            position: 'fixed',
            left: wordTip.x,
            top: wordTip.y,
            transform: wordTip.above ? 'translate(-50%, -100%)' : 'translateX(-50%)',
            background: '#FDF8F0',
            border: '1px solid var(--border2, #E0D6C4)',
            borderRadius: 8,
            padding: '10px 12px',
            maxWidth: 280,
            boxShadow: '0 4px 16px rgba(90,70,50,0.18)',
            zIndex: 10000,
            fontSize: 13,
            color: '#5C4A3A',
            lineHeight: 1.5,
            pointerEvents: 'none',
            textAlign: 'left',
          }}
        >
          {/* 第一行：单词原形（加粗）+ 词性 */}
          <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 14 }}>
            {wordTip.word}
            {wordTip.pos && (
              <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--muted, #9A8B7A)', marginLeft: 6 }}>
                {wordTip.pos}
              </span>
            )}
          </div>
          {/* 第二行：中文释义 */}
          {wordTip.meaning && (
            <div style={{ marginBottom: 4 }}>{wordTip.meaning}</div>
          )}
          {/* 第三行：中文同义解释 */}
          {wordTip.synonym && (
            <div style={{ color: 'var(--accent, #B08A5A)', fontSize: 12, marginBottom: 4 }}>
              在中文中相当于：{wordTip.synonym}
            </div>
          )}
          {/* 第四行：例句 */}
          {wordTip.example && (
            <div style={{ fontSize: 11, color: '#7A6B5A', fontStyle: 'italic' }}>
              {wordTip.example}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
