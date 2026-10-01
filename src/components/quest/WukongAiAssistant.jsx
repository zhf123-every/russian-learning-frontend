import { useState, useRef, useEffect, useCallback } from 'react'
import { callAI } from '../../lib/ai'
import { toast } from '../../lib/toast'

// 悟空 AI 助手：右下角浮动（孙悟空踩在筋斗云上表演动作，可鼠标拖拽移动），点击弹出对标"句乐部"的深色 AI 问答弹窗（弹窗可拖动）
// 结构：筋斗云是独立底座（只浮动不旋转），悟空本体在云上做动作（后空翻只转悟空，云不动）
// props: statement={russian, chinese} 当前练习句子；modeLabel 模式中文名（如"中译俄"）
const WUKONG_CLOUD = '/images/ai-assistant/wukong-cloud.webp'    // 筋斗云底座
const WUKONG_BODY1 = '/images/ai-assistant/wukong-body-1.webp'   // 悟空动作1：站立瞭望
const WUKONG_BODY2 = '/images/ai-assistant/wukong-body-2.webp'   // 悟空动作2：后空翻
const WUKONG_BODY3 = '/images/ai-assistant/wukong-body-3.webp'   // 悟空动作3：招手
const BTN_SIZE = 92

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

  // ---- 孙悟空浮动按钮：可拖拽位置 ----
  const [btnPos, setBtnPos] = useState(() => ({
    x: (typeof window !== 'undefined' ? window.innerWidth : 1280) - BTN_SIZE - 16,
    y: (typeof window !== 'undefined' ? window.innerHeight : 720) - BTN_SIZE - 96,
  }))
  const dragRef = useRef({ dragging: false, moved: false, sx: 0, sy: 0, ox: 0, oy: 0 })
  const [btnDragging, setBtnDragging] = useState(false)

  // ---- AI 弹窗：可拖拽位置（打开时居中） ----
  const [modalPos, setModalPos] = useState(null)
  const modalDragRef = useRef({ dragging: false, sx: 0, sy: 0, ox: 0, oy: 0 })

  // 打开弹窗时初始化到屏幕居中
  useEffect(() => {
    if (open) {
      const w = Math.min(560, (window.innerWidth || 1280) - 32)
      const h = Math.min(560, (window.innerWidth || 1280) - 32)
      setModalPos({
        x: Math.max(8, ((window.innerWidth || 1280) - w) / 2),
        y: Math.max(8, ((window.innerHeight || 720) - h) / 2),
      })
    }
  }, [open])

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

  // ---- 浮动按钮拖拽（拖动不触发点击） ----
  const onBtnPointerDown = (e) => {
    const d = dragRef.current
    d.dragging = true
    d.moved = false
    d.sx = e.clientX
    d.sy = e.clientY
    d.ox = btnPos.x
    d.oy = btnPos.y
    setBtnDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onBtnPointerMove = (e) => {
    const d = dragRef.current
    if (!d.dragging) return
    const dx = e.clientX - d.sx
    const dy = e.clientY - d.sy
    if (!d.moved && Math.abs(dx) + Math.abs(dy) < 6) return // 位移小于阈值视为点击
    d.moved = true
    const vw = window.innerWidth || 1280
    const vh = window.innerHeight || 720
    setBtnPos({
      x: Math.max(0, Math.min(vw - BTN_SIZE, d.ox + dx)),
      y: Math.max(0, Math.min(vh - BTN_SIZE, d.oy + dy)),
    })
  }
  const onBtnPointerUp = (e) => {
    const d = dragRef.current
    d.dragging = false
    setBtnDragging(false)
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch (err) { /* 忽略 */ }
    if (!d.moved) setOpen(v => !v) // 未拖动 → 视为点击，切换弹窗
    d.moved = false
  }

  // ---- 弹窗标题栏拖拽 ----
  const onModalPointerDown = (e) => {
    const d = modalDragRef.current
    d.dragging = true
    d.sx = e.clientX
    d.sy = e.clientY
    d.ox = modalPos?.x || 0
    d.oy = modalPos?.y || 0
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onModalPointerMove = (e) => {
    const d = modalDragRef.current
    if (!d.dragging) return
    const vw = window.innerWidth || 1280
    const vh = window.innerHeight || 720
    const mw = Math.min(560, vw - 32)
    setModalPos({
      x: Math.max(8, Math.min(vw - mw - 8, d.ox + (e.clientX - d.sx))),
      y: Math.max(8, Math.min(vh - 60, d.oy + (e.clientY - d.sy))),
    })
  }
  const onModalPointerUp = (e) => {
    const d = modalDragRef.current
    d.dragging = false
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch (err) { /* 忽略 */ }
  }

  const modalW = Math.min(560, (typeof window !== 'undefined' ? window.innerWidth : 1280) - 32)

  return (
    <>
      {/* 右下角浮动孙悟空（踩筋斗云，可拖拽） */}
      <button
        aria-label="悟空智能助手"
        onPointerDown={onBtnPointerDown}
        onPointerMove={onBtnPointerMove}
        onPointerUp={onBtnPointerUp}
        onPointerCancel={onBtnPointerUp}
        style={{
          position: 'fixed', left: btnPos.x, top: btnPos.y, zIndex: 55,
          width: BTN_SIZE, height: BTN_SIZE, padding: 0, border: 'none', background: 'transparent',
          cursor: 'grab', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none',
          filter: 'drop-shadow(0 8px 20px rgba(255,170,60,0.35))',
          transition: 'transform 0.18s ease',
        }}
        className={btnDragging ? "wukong-float-btn dragging" : "wukong-float-btn"}
      >
        {/* 双层结构：筋斗云底座 + 悟空在云上表演 */}
        <div className="wukong-stage" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {/* 筋斗云：独立底座，只轻微浮动，不参与旋转 */}
          <img src={WUKONG_CLOUD} alt="" className="wukong-cloud-img" />
          {/* 悟空本体：在云上方做三动作（旋转/位移只作用于悟空） */}
          <div className="wukong-body-wrap">
            <img src={WUKONG_BODY1} alt="" className="wukong-act-img wukong-b1" />
            <img src={WUKONG_BODY2} alt="" className="wukong-act-img wukong-b2" />
            <img src={WUKONG_BODY3} alt="" className="wukong-act-img wukong-b3" />
          </div>
        </div>
        {/* 状态小光点 */}
        <span style={{
          position: 'absolute', right: 2, bottom: 6, width: 12, height: 12, borderRadius: '50%',
          background: '#22c55e', border: '2px solid #fff', boxShadow: '0 0 8px rgba(34,197,94,0.8)',
        }} />
        <style>{`
          /* 筋斗云：只浮动，始终在底部 */
          @keyframes wukong-cloud-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
          .wukong-cloud-img {
            position: absolute; left: 0; right: 0; bottom: 0; width: 100%; height: 56%;
            object-fit: contain; animation: wukong-cloud-float 3.2s ease-in-out infinite;
          }
          /* 悟空层：放大主体，位于云上方 */
          .wukong-body-wrap {
            position: absolute; left: 0; right: 0; bottom: 24%; width: 100%; height: 62%;
            transform: scale(1.5); transform-origin: bottom center;
          }
          /* 动作1：站立瞭望（0-33%），上抛衔接后空翻 */
          @keyframes wukong-b1 {
            0%   { opacity: 0; transform: translateY(8px) rotate(0deg); }
            3%   { opacity: 1; transform: translateY(0) rotate(0deg); }
            8%   { opacity: 1; transform: translateY(-6px) rotate(-2deg); }
            13%  { opacity: 1; transform: translateY(0) rotate(0deg); }
            18%  { opacity: 1; transform: translateY(-6px) rotate(2deg); }
            24%  { opacity: 1; transform: translateY(0) rotate(0deg); }
            29%  { opacity: 1; transform: translateY(-4px) rotate(0deg); }
            32%  { opacity: 0; transform: translateY(-18px) rotate(6deg); }
            100% { opacity: 0; transform: translateY(-18px) rotate(6deg); }
          }
          /* 动作2：后空翻（33-66%），悟空原地翻360°落回云上，云不动 */
          @keyframes wukong-b2 {
            0%   { opacity: 0; transform: translateY(-18px) rotate(6deg); }
            33%  { opacity: 0; transform: translateY(-18px) rotate(6deg); }
            36%  { opacity: 1; transform: translateY(-12px) rotate(-30deg); }
            45%  { opacity: 1; transform: translateY(-2px) rotate(120deg); }
            54%  { opacity: 1; transform: translateY(-6px) rotate(240deg); }
            61%  { opacity: 1; transform: translateY(0) rotate(360deg); }
            64%  { opacity: 0; transform: translateY(14px) rotate(392deg); }
            100% { opacity: 0; transform: translateY(14px) rotate(392deg); }
          }
          /* 动作3：招手摇摆（66-100%），下沉探入后左右摇摆 */
          @keyframes wukong-b3 {
            0%   { opacity: 0; transform: translateY(14px) rotate(0deg); }
            66%  { opacity: 0; transform: translateY(14px) rotate(0deg); }
            69%  { opacity: 1; transform: translateY(5px) rotate(-4deg); }
            73%  { opacity: 1; transform: translateY(-3px) rotate(4deg); }
            77%  { opacity: 1; transform: translateY(0) rotate(-5deg); }
            81%  { opacity: 1; transform: translateY(-3px) rotate(5deg); }
            85%  { opacity: 1; transform: translateY(0) rotate(-3deg); }
            89%  { opacity: 1; transform: translateY(-3px) rotate(3deg); }
            93%  { opacity: 0; transform: translateY(-13px) rotate(0deg); }
            100% { opacity: 0; transform: translateY(-13px) rotate(0deg); }
          }
          .wukong-act-img {
            position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain;
            opacity: 0; will-change: transform, opacity;
          }
          .wukong-b1 { animation: wukong-b1 12s infinite; }
          .wukong-b2 { animation: wukong-b2 12s infinite; }
          .wukong-b3 { animation: wukong-b3 12s infinite; }
          .wukong-float-btn { transition: transform 0.18s ease; }
          .wukong-float-btn:hover { transform: scale(1.08); }
          .wukong-float-btn.dragging { cursor: grabbing; }
          .wukong-float-btn.dragging .wukong-act-img,
          .wukong-float-btn.dragging .wukong-cloud-img { animation: none; }
        `}</style>
      </button>

      {/* AI 问答弹窗（句乐部式，可拖拽移动） */}
      {open && modalPos && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300 }}
            onClick={() => setOpen(false)}
          />
          <div
            style={{
              position: 'fixed', left: modalPos.x, top: modalPos.y, width: modalW,
              maxHeight: '82vh', borderRadius: 20, overflow: 'hidden',
              display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
              background: 'var(--qs-surface, #fff)', color: 'var(--qs-text, #111)',
              border: '1px solid var(--qs-border, #e5e7eb)', zIndex: 301,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 顶栏（可拖动） */}
            <div
              onPointerDown={onModalPointerDown}
              onPointerMove={onModalPointerMove}
              onPointerUp={onModalPointerUp}
              onPointerCancel={onModalPointerUp}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 18px', borderBottom: '1px solid var(--qs-border, #eee)',
                cursor: 'grab', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, pointerEvents: 'none' }}>
                <img src={WUKONG_BODY1} alt="" style={{ width: 34, height: 34, objectFit: 'contain' }} />
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
                style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'var(--qs-surface2, #f3f4f6)', color: 'var(--qs-text, #555)', cursor: 'pointer', fontSize: 15, flexShrink: 0 }}
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
        </>
      )}
    </>
  )
}
