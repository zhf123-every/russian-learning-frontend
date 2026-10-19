import { useState, useRef, useEffect, useCallback } from 'react'
import { callAI, ttsUrl } from '../../lib/ai'
import { apiFetch } from '../../lib/api'
import { toast } from '../../lib/toast'
import { useQuestSettings } from '../../hooks/useQuestSettings'
import { useSettingsStore } from '../../store/settingsStore'
import { resolveSkin } from '../../lib/petSkins'
import Wukong3D from './Wukong3D'
import { playGlobalAudio, stopGlobalAudio, preloadGlobalAudio } from '../../utils/audioService'

// 悟空语音对话助手：中译俄答题页的 AI 口语对话教练。
// - 预加载阶段（Preloader）已按本课内容生成对话引导包（dialogue prop），答题结束后自动打开并语音引导；
// - 按住说话 → 后端转写（俄语）→ AI 按本课主题回复 → 俄语语音朗读 + 文字展示；
// - 保留悟空 3D 角色与可拖拽弹窗外观（与文字版悟空一致）。
// props: statement={russian, chinese} 当前练习句子；modeLabel 模式中文名；
//        lessonContext={title, sentences[]} 本课内容（注入 AI 上下文）；
//        dialogue=预生成引导包 {topic, greeting_ru, greeting_zh, questions[], questions_zh[]}；
//        autoOpen=true 时自动打开并主动语音引导（答题结束后传入）。
const WUKONG_IDLE = '/images/ai-assistant/side-stand.webp'
const BTN_SIZE = 240

// 对话引导预设问题（无预生成引导包时的兜底）
const FALLBACK_QUESTIONS = [
  '我们这课学了什么？请用俄语带我复习一下。',
  '请用俄语问我一个关于本课内容的问题。',
  '我来说俄语，你来纠正我的语法错误。',
]

function useVoiceRecorder() {
  const recRef = useRef(null)
  const [listening, setListening] = useState(false)
  const [transcribing, setTranscribing] = useState(false)

  const start = useCallback(async () => {
    if (recRef.current) return false
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      recRef.current = { mr, stream, chunks: [] }
      mr.ondataavailable = (e) => { if (e.data && e.data.size > 0) recRef.current.chunks.push(e.data) }
      mr.start()
      setListening(true)
      return true
    } catch (err) {
      toast('无法访问麦克风，请检查浏览器权限')
      return false
    }
  }, [])

  const stop = useCallback(() => {
    return new Promise((resolve) => {
      const r = recRef.current
      if (!r) { resolve(null); return }
      const { mr, stream, chunks } = r
      mr.onstop = () => {
        try { stream.getTracks().forEach(t => t.stop()) } catch (e) { /* 忽略 */ }
        recRef.current = null
        setListening(false)
        if (chunks.length) {
          const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' })
          resolve(blob)
        } else {
          resolve(null)
        }
      }
      mr.stop()
    })
  }, [])

  return { listening, transcribing, setTranscribing, start, stop }
}

export default function WukongVoiceAssistant({
  statement, modeLabel = '练习', lessonContext = null, dialogue = null, autoOpen = false, wrongStreak = 0,
}) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [guided, setGuided] = useState(false)     // 引导语是否已播放（只播一次）
  const scrollRef = useRef(null)
  const { listening, transcribing, setTranscribing, start, stop } = useVoiceRecorder()
  const historyRef = useRef([])

  const { ui } = useQuestSettings()
  const skinCfg = resolveSkin(ui.petSkin)

  // ---- 3D 角色可拖拽位置（默认左下角，融入背景） ----
  const [btnPos, setBtnPos] = useState(() => ({
    x: 20,
    y: (typeof window !== 'undefined' ? window.innerHeight : 720) - BTN_SIZE - 40,
  }))
  const dragRef = useRef({ dragging: false, moved: false, sx: 0, sy: 0, ox: 0, oy: 0 })
  const [btnDragging, setBtnDragging] = useState(false)

  // ---- 弹窗可拖拽位置（打开时居中） ----
  const [modalPos, setModalPos] = useState(null)
  const modalDragRef = useRef({ dragging: false, sx: 0, sy: 0, ox: 0, oy: 0 })
  useEffect(() => {
    if (open) {
      const w = Math.min(560, (window.innerWidth || 1280) - 32)
      setModalPos({
        x: Math.max(8, ((window.innerWidth || 1280) - w) / 2),
        y: Math.max(8, ((window.innerHeight || 720) - 560) / 2),
      })
    }
  }, [open])

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])
  useEffect(() => { scrollToBottom() }, [messages, loading, transcribing, scrollToBottom])

  // 当前 TTS 音色（跟随声音设置：系统发音人 female/male，高级发音人 alena 等）
  const currentVoice = () => {
    try {
      const s = useSettingsStore.getState().settings
      return s.ttsVoice || (s.ttsSource === 'system' ? 'female' : 'alena')
    } catch (e) { return 'alena' }
  }

  // 朗读一段俄语文本（后端 TTS，跟随声音设置音色）
  const speakRu = useCallback((text) => {
    if (!text) return
    const url = ttsUrl(text, currentVoice())
    if (!url) return
    preloadGlobalAudio(url)
    playGlobalAudio(url)
  }, [])

  // AI 对话上下文（本课内容 + 预生成引导）
  const buildSystem = useCallback(() => {
    const ru = (lessonContext && Array.isArray(lessonContext.sentences) ? lessonContext.sentences : []).slice(0, 10).join('\n')
    const title = (lessonContext && lessonContext.title) || ''
    const curRu = statement?.russian || ''
    const curZh = statement?.chinese || ''
    let d = ''
    if (dialogue && dialogue.greeting_ru) {
      d = `\n本课对话主题：${dialogue.topic || ''}\n开场引导语：${dialogue.greeting_ru}（${dialogue.greeting_zh || ''}）\n建议引导问句：${(dialogue.questions || []).join(' / ')}`
    }
    return `你是"悟空"——俄语口语对话教练，正在陪学生练习「${modeLabel}」。
学生刚做完本课练习题，现在进入口语对话环节。
本课/课时名：${title || '（未命名）'}
本课学过的俄语句子（供你围绕话题提问、纠错、扩展）：
${ru || '（无）'}
当前最后练习的句子：${curRu}（${curZh}）${d}
对话规则：
1. 主要说俄语，用简单、符合学生水平的句子；学生说错时给出正确说法并简短中文解释；
2. 围绕本课主题主动提问引导对话，每次回复后可以追问一个小问题；
3. 回复控制在 2-4 句俄语以内，中文只做辅助提示；
4. 不要评价学生"答得好不好"，直接自然对话。`
  }, [statement, modeLabel, lessonContext, dialogue])

  // 发送一条消息（文本或语音识别结果）
  const ask = useCallback(async (question) => {
    const text = (question || '').trim()
    if (!text || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: text }])
    historyRef.current = [...historyRef.current, { role: 'user', content: text }]
    setLoading(true)
    try {
      const sys = buildSystem()
      const reply = await callAI([
        { role: 'system', content: sys },
        ...historyRef.current.slice(-12).map(m => ({ role: m.role, content: m.content })),
      ])
      historyRef.current = [...historyRef.current, { role: 'assistant', content: reply }]
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
      // 朗读回复中的俄语（整段朗读，若含中文可先取俄语句段）
      speakRu(reply)
    } catch (e) {
      toast('AI 回复失败：' + (e && e.message || e))
      setMessages(prev => [...prev, { role: 'assistant', content: '（回复失败，请稍后再试）' }])
    } finally {
      setLoading(false)
    }
  }, [loading, buildSystem, speakRu])

  // 按住说话 → 松手 → 转写 → 发送
  const onMicDown = async (e) => {
    e.preventDefault()
    if (listening || transcribing || loading) return
    const ok = await start()
    if (ok) e.currentTarget.classList.add('wv-listening')
  }
  const onMicUp = async (e) => {
    e.preventDefault()
    e.currentTarget.classList.remove('wv-listening')
    if (!listening) return
    const blob = await stop()
    if (!blob) return
    setTranscribing(true)
    try {
      const b64 = await new Promise((res, rej) => {
        const fr = new FileReader()
        fr.onload = () => res(String(fr.result))
        fr.onerror = rej
        fr.readAsDataURL(blob)
      })
      const r = await apiFetch('/api/transcribe-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: b64 }),
        timeout: 60000,
      })
      const j = await r.json()
      if (!j.ok) { toast('语音识别失败：' + (j.error || '请重试')); return }
      const text = (j.text || j.raw || '').trim()
      if (!text) { toast('没有听清，请再说一次'); return }
      ask(text)
    } catch (err) {
      toast('语音识别失败：' + (err && err.message || err))
    } finally {
      setTranscribing(false)
    }
  }

  // 答题结束后自动打开 + 语音引导（只引导一次）
  useEffect(() => {
    if (!autoOpen || open || guided) return
    setOpen(true)
  }, [autoOpen, open, guided])

  // 连续答错主动求助（对齐设置「宠物」面板 petHelp + petHint；与文字版悟空一致）
  useEffect(() => {
    if (ui.petHelp === false) return
    if (wrongStreak <= 0) return
    const hint = ui.petHint === 'always' ? 1 : (parseInt(ui.petHint || '3', 10) || 3)
    if (wrongStreak % hint !== 0) return
    setOpen(true)
    ask(`我连续答错 ${wrongStreak} 次了，能帮我讲讲这道题怎么入手吗？先给思路提示，不要直接给完整答案。`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wrongStreak, ui.petHelp, ui.petHint])

  useEffect(() => {
    if (!open || guided || !dialogue || !dialogue.greeting_ru) return
    setGuided(true)
    const t = setTimeout(() => speakRu(dialogue.greeting_ru), 500)
    return () => clearTimeout(t)
  }, [open, guided, dialogue, speakRu])

  // 卸载时停止播放/录音
  useEffect(() => () => { stopGlobalAudio() }, [])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault()
      ask(input)
    }
  }

  // ---- 按钮/弹窗拖拽（与文字版悟空一致） ----
  const onBtnPointerDown = (e) => {
    const d = dragRef.current
    d.dragging = true; d.moved = false; d.sx = e.clientX; d.sy = e.clientY; d.ox = btnPos.x; d.oy = btnPos.y
    setBtnDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onBtnPointerMove = (e) => {
    const d = dragRef.current
    if (!d.dragging) return
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy
    if (!d.moved && Math.abs(dx) + Math.abs(dy) < 6) return
    d.moved = true
    const vw = window.innerWidth || 1280, vh = window.innerHeight || 720
    setBtnPos({ x: Math.max(0, Math.min(vw - BTN_SIZE, d.ox + dx)), y: Math.max(0, Math.min(vh - BTN_SIZE, d.oy + dy)) })
  }
  const onBtnPointerUp = (e) => {
    const d = dragRef.current
    d.dragging = false; setBtnDragging(false)
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch (err) { /* 忽略 */ }
    if (!d.moved) setOpen(v => !v)
    d.moved = false
  }
  const onModalPointerDown = (e) => {
    const d = modalDragRef.current
    d.dragging = true; d.sx = e.clientX; d.sy = e.clientY; d.ox = modalPos?.x || 0; d.oy = modalPos?.y || 0
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onModalPointerMove = (e) => {
    const d = modalDragRef.current
    if (!d.dragging) return
    const vw = window.innerWidth || 1280, mw = Math.min(560, vw - 32)
    setModalPos({
      x: Math.max(8, Math.min(vw - mw - 8, d.ox + (e.clientX - d.sx))),
      y: Math.max(8, Math.min((window.innerHeight || 720) - 60, d.oy + (e.clientY - d.sy))),
    })
  }
  const onModalPointerUp = (e) => {
    const d = modalDragRef.current
    d.dragging = false
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch (err) { /* 忽略 */ }
  }

  const modalW = Math.min(560, (typeof window !== 'undefined' ? window.innerWidth : 1280) - 32)
  if (ui.petShow === false) return null

  const guideQuestions = (dialogue && dialogue.questions && dialogue.questions.length ? dialogue.questions : FALLBACK_QUESTIONS)

  return (
    <>
      {/* 答题页左下角背景角色（可拖拽，融入页面背景） */}
      <button
        aria-label="悟空语音对话"
        onPointerDown={onBtnPointerDown}
        onPointerMove={onBtnPointerMove}
        onPointerUp={onBtnPointerUp}
        onPointerCancel={onBtnPointerUp}
        style={{
          position: 'fixed', left: btnPos.x, top: btnPos.y, zIndex: 55,
          width: BTN_SIZE, height: BTN_SIZE, padding: 0, border: 'none', background: 'transparent',
          cursor: 'grab', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none',
          transition: 'transform 0.18s ease',
        }}
        className={btnDragging ? 'wukong-float-btn dragging' : 'wukong-float-btn'}
      >
        <div className="wukong-stage" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <Wukong3D paused={btnDragging} skin={skinCfg.id} />
        </div>
        <style>{`
          .wukong-float-btn { transition: transform 0.18s ease; }
          .wukong-float-btn:hover { transform: scale(1.05); }
          .wukong-float-btn.dragging { cursor: grabbing; }
        `}</style>
      </button>

      {/* AI 语音对话弹窗（可拖拽） */}
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
                <img src={WUKONG_IDLE} alt="" style={{ width: 34, height: 34, objectFit: 'contain' }} />
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>
                    悟空口语对话{dialogue && dialogue.topic ? ' · ' + dialogue.topic : ''}
                  </h2>
                  <span style={{ fontSize: 11, color: 'var(--qs-sub, #6b7280)', display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                    {listening ? '正在听你说话…' : transcribing ? '正在识别你的语音…' : '按住麦克风用俄语和我对话'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerMove={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                aria-label="关闭"
                style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'var(--qs-surface2, #f3f4f6)', color: 'var(--qs-text, #555)', cursor: 'pointer', fontSize: 15, flexShrink: 0, zIndex: 2, position: 'relative' }}
              >✕</button>
            </div>

            {/* 引导区：本课话题 + 引导问题（点按即作为对话内容发出） */}
            <div style={{ padding: '14px 18px 8px' }}>
              {dialogue && dialogue.greeting_zh && (
                <div style={{ fontSize: 13, color: 'var(--qs-sub, #6b7280)', lineHeight: 1.7, marginBottom: 10 }}>
                  {dialogue.greeting_zh}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left' }}>
                {guideQuestions.map((q, i) => (
                  <button
                    key={q} onClick={() => ask(q)} disabled={loading}
                    style={{
                      textAlign: 'left', borderRadius: 12, padding: '9px 12px', fontSize: 13, lineHeight: 1.55, cursor: 'pointer',
                      border: '1px solid var(--qs-border, #e5e7eb)', background: 'var(--qs-surface2, #fafafa)',
                      color: 'var(--qs-text, #111)', transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--qs-active, #7C3AED)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--qs-active, #7C3AED) 8%, var(--qs-surface2, #fafafa))' }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--qs-border, #e5e7eb)'; e.currentTarget.style.background = 'var(--qs-surface2, #fafafa)' }}
                  >
                    {q}
                    {dialogue && dialogue.questions_zh && dialogue.questions_zh[i] ? (
                      <span style={{ display: 'block', fontSize: 11.5, color: 'var(--qs-sub, #9ca3af)', marginTop: 3 }}>{dialogue.questions_zh[i]}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>

            {/* 对话区 */}
            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '6px 18px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {messages.length === 0 && !loading && !transcribing && (
                <div style={{ fontSize: 12.5, color: 'var(--qs-sub, #9ca3af)', textAlign: 'center', paddingTop: 18, lineHeight: 1.8 }}>
                  {dialogue ? '按住麦克风说俄语，或点上方问题开始对话。' : '按住麦克风和我用俄语对话，我会围绕本课内容回应。'}
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
              {(loading || transcribing) && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{ padding: '10px 14px', borderRadius: 14, fontSize: 13, background: 'var(--qs-surface2, #f3f4f6)', color: 'var(--qs-sub, #6b7280)' }}>
                    {transcribing ? '悟空正在听…' : '悟空正在思考…'}
                  </div>
                </div>
              )}
            </div>

            {/* 输入区：按住说话（主）+ 文字输入（兜底） */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--qs-border, #eee)', display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onPointerDown={onMicDown}
                onPointerUp={onMicUp}
                onPointerLeave={onMicUp}
                disabled={transcribing || loading}
                title="按住说话"
                style={{
                  width: 44, height: 44, borderRadius: '50%', border: 'none', flexShrink: 0, cursor: 'pointer',
                  background: listening ? '#EF4444' : 'var(--qs-active, #7C3AED)', color: '#fff', fontSize: 18,
                  boxShadow: listening ? '0 0 0 6px rgba(239,68,68,0.2)' : '0 4px 14px rgba(124,58,237,0.35)',
                  transition: 'all 0.15s ease', touchAction: 'none',
                }}
              >🎤</button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={listening ? '正在录音…松开发送' : '或输入文字…'}
                disabled={loading || listening}
                style={{
                  flex: 1, borderRadius: 999, border: '1px solid var(--qs-border, #e5e7eb)', outline: 'none',
                  padding: '10px 16px', fontSize: 13.5, background: 'var(--qs-surface2, #fff)', color: 'var(--qs-text, #111)',
                }}
              />
              <button
                onClick={() => ask(input)} disabled={loading || !input.trim()}
                style={{
                  borderRadius: 999, border: 'none', padding: '0 18px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
                  background: 'var(--qs-active, #7C3AED)', color: '#fff', opacity: loading || !input.trim() ? 0.5 : 1, flexShrink: 0,
                }}
              >发送</button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
