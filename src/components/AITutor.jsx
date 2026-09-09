import { useState, useEffect, useRef, useCallback } from 'react'
import { callAI } from '../lib/ai'
import { toast } from '../lib/toast'
import { mdToHtml } from '../lib/md'

const STAGE_NAMES = {
  1: '整体盲听',
  2: '逐句听写',
  3: '对照精读',
  4: '跟读模仿',
  5: '脱稿背诵',
}

export default function AITutor({ stage, curSentence, sentences, videoTitle }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(true)
  const scrollRef = useRef(null)
  const textareaRef = useRef(null)
  const lastStageRef = useRef(null)

  // 自动滚动到底部
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading, scrollToBottom])

  // 阶段变化时自动获取引导语
  useEffect(() => {
    if (!stage || lastStageRef.current === stage) return
    lastStageRef.current = stage
    const stageName = STAGE_NAMES[stage] || `阶段${stage}`
    const guidePrompt = `你是俄语学习助教，正在引导用户进行尚雯婕五阶段学习法。当前阶段是第${stage}阶段（${stageName}）。
请用2-3句话给出本阶段的学习目标、方法和注意事项。用简洁中文，语气鼓励友好。`

    setLoading(true)
    callAI([{ role: 'system', content: guidePrompt }])
      .then(text => {
        setMessages(prev => [...prev, { role: 'assistant', content: text, isGuide: true }])
      })
      .catch(e => {
        setMessages(prev => [...prev, { role: 'assistant', content: `（引导语获取失败：${e.message}）`, isGuide: true }])
      })
      .finally(() => setLoading(false))
  }, [stage])

  // 发送消息
  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setLoading(true)

    const stageName = STAGE_NAMES[stage] || `阶段${stage}`
    const systemPrompt = `你是俄语学习助教，正在引导用户进行尚雯婕五阶段学习法。
当前阶段：第${stage}阶段（${stageName}）
当前句子：${curSentence?.russian || '无'} — ${curSentence?.chinese || '无'}
文章标题：${videoTitle || '未命名'}
请用简洁中文回答用户的问题，必要时给出俄语例句和中文翻译。如果用户问的是当前句子相关的问题，结合句子内容解答。`

    try {
      const reply = await callAI([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ])
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch (e) {
      toast('AI回复失败：' + e.message)
      setMessages(prev => [...prev, { role: 'assistant', content: `（回复失败：${e.message}）` }])
    } finally {
      setLoading(false)
    }
  }, [input, loading, stage, curSentence, videoTitle])

  // 回车发送（Shift+回车换行）
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // 清空对话
  const clearChat = () => {
    setMessages([])
    toast('对话已清空')
  }

  // textarea 自适应高度
  const autoResize = () => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed',
          right: 16,
          bottom: 16,
          zIndex: 998,
          borderRadius: 24,
          padding: '10px 18px',
          background: 'var(--accent, #8B735F)',
          color: '#fff',
          border: 'none',
          boxShadow: '0 4px 14px rgba(139,115,95,0.3)',
          cursor: 'pointer',
          fontSize: 14,
          fontWeight: 500,
        }}
      >
        助教
      </button>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: 340,
        height: '100vh',
        zIndex: 999,
        background: '#FFFCF7',
        borderLeft: '1px solid var(--border2, #E8E1D9)',
        boxShadow: '-4px 0 20px rgba(0,0,0,0.08)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* 顶部栏 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 14px',
          borderBottom: '1px solid var(--border2, #E8E1D9)',
          background: 'var(--soft, #F5F0E8)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'var(--accent, #8B735F)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            flexShrink: 0,
          }}
        >
          
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#3D332C' }}>俄语助教</div>
          <div style={{ fontSize: 11, color: 'var(--muted, #86796D)' }}>
            阶段{stage} · {STAGE_NAMES[stage] || '未知'}
          </div>
        </div>
        <button
          className="btn sm"
          onClick={clearChat}
          style={{ fontSize: 11, padding: '4px 8px' }}
          title="清空对话"
        >
          
        </button>
        <button
          className="btn sm"
          onClick={() => setOpen(false)}
          style={{ fontSize: 11, padding: '4px 8px' }}
          title="收起"
        >
          
        </button>
      </div>

      {/* 消息区域 */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {messages.length === 0 && !loading && (
          <div style={{ textAlign: 'center', color: 'var(--muted, #86796D)', fontSize: 13, padding: '20px 0' }}>
            有任何俄语学习问题都可以问我～
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                maxWidth: '85%',
                padding: '8px 12px',
                borderRadius: 12,
                fontSize: 13,
                lineHeight: 1.6,
                ...(msg.role === 'user'
                  ? {
                      background: 'var(--accent, #8B735F)',
                      color: '#fff',
                      borderBottomRightRadius: 4,
                    }
                  : {
                      background: '#FDF8F0',
                      border: '1px solid var(--border2, #E8E1D9)',
                      color: '#3D332C',
                      borderBottomLeftRadius: 4,
                    }),
              }}
              {...(msg.role === 'assistant'
                ? { dangerouslySetInnerHTML: { __html: mdToHtml(msg.content) } }
                : {})}
            >
              {msg.role === 'user' ? msg.content : undefined}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div
              style={{
                maxWidth: '85%',
                padding: '8px 12px',
                borderRadius: 12,
                borderBottomLeftRadius: 4,
                background: '#FDF8F0',
                border: '1px solid var(--border2, #E8E1D9)',
                fontSize: 13,
                color: 'var(--muted, #86796D)',
              }}
            >
              正在思考
              <span style={{ animation: 'pulse 1.2s infinite' }}>…</span>
            </div>
          </div>
        )}
      </div>

      {/* 输入区域 */}
      <div
        style={{
          padding: '10px 12px',
          borderTop: '1px solid var(--border2, #E8E1D9)',
          background: '#fff',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); autoResize() }}
            onKeyDown={handleKeyDown}
            placeholder="输入问题，回车发送…"
            rows={1}
            style={{
              flex: 1,
              resize: 'none',
              padding: '8px 10px',
              border: '1px solid var(--border2, #E8E1D9)',
              borderRadius: 10,
              fontSize: 13,
              fontFamily: 'inherit',
              lineHeight: 1.5,
              outline: 'none',
              maxHeight: 120,
              background: '#FFFCF7',
            }}
          />
          <button
            className="btn sm primary"
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            style={{ flexShrink: 0, padding: '8px 14px' }}
          >
            发送
          </button>
        </div>
      </div>
    </div>
  )
}
