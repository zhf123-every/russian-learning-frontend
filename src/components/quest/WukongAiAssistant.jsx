import { useState, useRef, useEffect, useCallback } from 'react'
import { callAI } from '../../lib/ai'
import { toast } from '../../lib/toast'

// 悟空 AI 助手：右下角浮动（踩筋斗云的孙悟空），点击弹出对标"句乐部"的深色 AI 问答弹窗
// props: statement={russian, chinese} 当前练习句子；modeLabel 模式中文名（如"中译俄"）
const WUKONG_IMG = '/images/ai-assistant/wukong-cloud.webp'

const PRESET_QUESTIONS = [
  '这道题我应该从哪里入手？请先给一个提示，不要直接给完整答案。',
  '请解释这道题在考什么，以及我应该如何理解正确答案。',
  '请拆一下这句话的语法结构，重点说明主干、修饰关系和词序。',
  '请讲解这道题里的重点单词和短语，说明它们在上下文里的意思。',
]

export default function WukongAiAssistant({ statement, modeLabel = '练习' }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef(null)

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, loading, scrollToBottom])

  // 发送一条问题（预设按钮或输入框共用）
  const ask = useCallback(async (question) => {
    const text = (question || '').trim()
    if (!text || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setLoading(true)

    const ru = statement?.russian || ''
    const zh = statement?.chinese || ''
    const systemPrompt = `你是"悟空"——俄语学习网站的 AI 智能助手，用简洁中文回答，语气友好、专业。
用户正在做「${modeLabel}」练习。
当前练习的俄语句子：${ru}
中文翻译：${zh}
请结合当前这道练习作答，不要泛泛而谈。需要时给出俄语原句、逐词解释、重音标注和中文翻译。`

    try {
      const reply = await callAI([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ])
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch (e) {
      toast('AI 回复失败：' + e.message)
      setMessages(prev => [...prev, { role: 'assistant', content: `（回复失败：${e.message}，请稍后再试）` }])
    } finally {
      setLoading(false)
    }
  }, [loading, statement, modeLabel])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault()
      ask(input)
    }
  }

  return (
    <>
      {/* 右下角浮动孙悟空（踩筋斗云） */}
      <button
        aria-label="悟空智能助手"
        onClick={() => setOpen(v => !v)}
        style={{
          position: 'fixed', right: 16, bottom: 96, zIndex: 55,
          width: 92, height: 92, padding: 0, border: 'none', background: 'transparent',
          cursor: 'pointer', filter: 'drop-shadow(0 8px 20px rgba(255,170,60,0.35))',
          transition: 'transform 0.18s ease',
        }}
        className="wukong-float-btn"
      >
        <img
          src={WUKONG_IMG} alt="悟空"
          style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }}
        />
        {/* 状态小光点 */}
        <span style={{
          position: 'absolute', right: 2, bottom: 6, width: 12, height: 12, borderRadius: '50%',
          background: '#22c55e', border: '2px solid #fff', boxShadow: '0 0 8px rgba(34,197,94,0.8)',
        }} />
        <style>{`
          @keyframes wukong-floatY { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
          @keyframes wukong-sway { 0%,100% { transform: rotate(-2deg); } 50% { transform: rotate(2deg); } }
          .wukong-float-btn { animation: wukong-floatY 2.8s ease-in-out infinite; }
          .wukong-float-btn img { animation: wukong-sway 3.6s ease-in-out infinite; }
          .wukong-float-btn:hover { transform: scale(1.08); }
        `}</style>
      </button>

      {/* AI 问答弹窗（句乐部式） */}
      {open && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setOpen(false)}
        >
          <div
            style={{
              width: 'min(560px, 94vw)', maxHeight: '82vh', borderRadius: 20, overflow: 'hidden',
              display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
              background: 'var(--qs-surface, #fff)', color: 'var(--qs-text, #111)',
              border: '1px solid var(--qs-border, #e5e7eb)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 顶栏 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--qs-border, #eee)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <img src={WUKONG_IMG} alt="" style={{ width: 34, height: 34, objectFit: 'contain' }} />
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>悟空智能助手</h2>
                  <span style={{ fontSize: 11, color: 'var(--qs-sub, #6b7280)', display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                    正在看当前练习
                  </span>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'var(--qs-surface2, #f3f4f6)', color: 'var(--qs-text, #555)', cursor: 'pointer', fontSize: 15 }}
              >✕</button>
            </div>

            {/* 引导区 */}
            <div style={{ padding: '16px 18px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: 'var(--qs-sub, #6b7280)', lineHeight: 1.7 }}>
                有关于当前练习的问题？随时问我！
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12, textAlign: 'left' }}>
                {PRESET_QUESTIONS.map((q) => (
                  <button
                    key={q} onClick={() => ask(q)} disabled={loading}
                    style={{
                      textAlign: 'left', borderRadius: 12, padding: '9px 12px', fontSize: 13, lineHeight: 1.55, cursor: 'pointer',
                      border: '1px solid var(--qs-border, #e5e7eb)', background: 'var(--qs-surface2, #fafafa)',
                      color: 'var(--qs-text, #111)', transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--qs-active, #7C3AED)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--qs-active, #7C3AED) 8%, var(--qs-surface2, #fafafa))' }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--qs-border, #e5e7eb)'; e.currentTarget.style.background = 'var(--qs-surface2, #fafafa)' }}
                  >{q}</button>
                ))}
              </div>
            </div>

            {/* 对话区 */}
            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '6px 18px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {messages.length === 0 && !loading && (
                <div style={{ fontSize: 12.5, color: 'var(--qs-sub, #9ca3af)', textAlign: 'center', paddingTop: 18, lineHeight: 1.8 }}>
                  我是悟空 👋 针对这道「{modeLabel}」题，
                  <br />点上方问题或直接输入，我帮你讲解。
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div
                    style={{
                      maxWidth: '86%', padding: '10px 14px', borderRadius: 14, fontSize: 13.5, lineHeight: 1.75,
                      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      background: m.role === 'user' ? 'var(--qs-active, #7C3AED)' : 'var(--qs-surface2, #f3f4f6)',
                      color: m.role === 'user' ? '#fff' : 'var(--qs-text, #111)',
                    }}
                  >{m.content}</div>
                </div>
              ))}
              {loading && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{ padding: '10px 14px', borderRadius: 14, fontSize: 13, background: 'var(--qs-surface2, #f3f4f6)', color: 'var(--qs-sub, #6b7280)' }}>悟空正在思考...</div>
                </div>
              )}
            </div>

            {/* 输入区 */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--qs-border, #eee)', display: 'flex', gap: 8 }}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入你的问题..."
                disabled={loading}
                style={{
                  flex: 1, borderRadius: 999, border: '1px solid var(--qs-border, #e5e7eb)', outline: 'none',
                  padding: '10px 16px', fontSize: 13.5, background: 'var(--qs-surface2, #fff)', color: 'var(--qs-text, #111)',
                }}
              />
              <button
                onClick={() => ask(input)} disabled={loading || !input.trim()}
                style={{
                  borderRadius: 999, border: 'none', padding: '0 20px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
                  background: 'var(--qs-active, #7C3AED)', color: '#fff', opacity: loading || !input.trim() ? 0.5 : 1,
                }}
              >发送</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
