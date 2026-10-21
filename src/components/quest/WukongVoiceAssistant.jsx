import { useState, useRef, useEffect, useCallback } from 'react'
import { callAI, ttsUrl } from '../../lib/ai'
import { apiFetch } from '../../lib/api'
import { toast } from '../../lib/toast'
import { useQuestSettings } from '../../hooks/useQuestSettings'
import { useSettingsStore } from '../../store/settingsStore'
import { resolveSkin } from '../../lib/petSkins'
import Wukong3D from './Wukong3D'
import { playGlobalAudio, stopGlobalAudio, preloadGlobalAudio } from '../../utils/audioService'
import { getCachedTtsUrl } from '../../utils/ttsPreloadShared'

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

// 文字模式预设问题（答题过程中的解题向提问，与文字版悟空一致）
const PRESET_QUESTIONS = [
  '这道题我应该从哪里入手？请先给一个提示，不要直接给完整答案。',
  '请解释这道题在考什么，以及我应该如何理解正确答案。',
  '请拆一下这句话的语法结构，重点说明主干、修饰关系和词序。',
  '请讲解这道题里的重点单词和短语，说明它们在上下文里的意思。',
]
const TEXT_INTRO = '有关于当前练习的问题？随时问我！'

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
  const [guided, setGuided] = useState(false)     // 引导语是否已播放（答题结束只播一次）
  const [voiceMode, setVoiceMode] = useState(false) // true=答题结束语音对话模式；false=答题过程文字问答模式
  const voiceModeRef = useRef(false)
  useEffect(() => { voiceModeRef.current = voiceMode }, [voiceMode])
  const scrollRef = useRef(null)
  const { listening, transcribing, setTranscribing, start, stop } = useVoiceRecorder()
  const historyRef = useRef([])

  const { ui } = useQuestSettings()
  const skinCfg = resolveSkin(ui.petSkin)

  // ---- 3D 角色可拖拽位置（默认答题页左下角，与背景悟空融为一体） ----
  const [btnPos, setBtnPos] = useState(() => ({
    x: 20,
    y: (typeof window !== 'undefined' ? window.innerHeight : 720) - BTN_SIZE - 40,
  }))
  const dragRef = useRef({ dragging: false, moved: false, sx: 0, sy: 0, ox: 0, oy: 0 })
  const [btnDragging, setBtnDragging] = useState(false)

  // ---- 弹窗可拖拽位置 + 可缩放尺寸（打开时居中） ----
  const [modalPos, setModalPos] = useState(null)
  const [modalSize, setModalSize] = useState(null) // { w, h }，右下角手柄拖动缩放
  const modalDragRef = useRef({ dragging: false, sx: 0, sy: 0, ox: 0, oy: 0 })
  const resizeRef = useRef({ dragging: false, sx: 0, sy: 0, sw: 0, sh: 0 })
  useEffect(() => {
    if (open) {
      const vw = window.innerWidth || 1280, vh = window.innerHeight || 720
      const w = Math.min(560, vw - 32)
      const h = Math.min(560, Math.round(vh * 0.72))
      setModalPos({ x: Math.max(8, (vw - w) / 2), y: Math.max(8, (vh - h) / 2) })
      setModalSize({ w, h })
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

  // 朗读一段俄语文本（后端 TTS，跟随声音设置音色；优先复用 Preloader 预载的缓存 URL → 秒播）
  const speakRu = useCallback((text) => {
    if (!text) return
    const v = currentVoice()
    let url = ''
    try { url = getCachedTtsUrl(text, v) } catch (e) { /* 忽略 */ }
    if (!url) url = ttsUrl(text, v)
    if (!url) return
    preloadGlobalAudio(url)
    playGlobalAudio(url)
  }, [])

  // AI 对话上下文：文字模式=讲解当前题（与文字版悟空一致）；语音模式=本课主题口语教练
  const buildSystem = useCallback(() => {
    const ru = (lessonContext && Array.isArray(lessonContext.sentences) ? lessonContext.sentences : []).slice(0, 10).join('\n')
    const title = (lessonContext && lessonContext.title) || ''
    const curRu = statement?.russian || ''
    const curZh = statement?.chinese || ''
    if (!voiceMode) {
      return `你是"悟空"——俄语学习助教，正在学生做「${modeLabel}」练习时答疑。
当前练习的俄语句子：${curRu}
中文翻译：${curZh}
本课/课时名：${title || '（未命名）'}
本课学过的俄语句子（供讲解时引用）：
${ru || '（无）'}
请结合当前这道练习作答，不要泛泛而谈。需要时给出俄语原句、逐词解释、重音标注和中文翻译。
如果学生问的是"怎么入手"，先给思路提示，不要直接给完整答案。`
    }
    let d = ''
    if (dialogue && dialogue.greeting_ru) {
      d = `\n本课对话主题：${dialogue.topic || ''}\n开场引导语：${dialogue.greeting_ru}（${dialogue.greeting_zh || ''}）\n建议引导问句：${(dialogue.questions || []).join(' / ')}`
    }
    return `你是"悟空"——一位耐心、温和的俄语口语老师，正在陪学生进行「${modeLabel}」本课主题的口语对话练习。
本课/课时名：${title || '（未命名）'}
本课学过的俄语句子（围绕这些内容提问、纠错、扩展）：
${ru || '（无）'}
当前最后练习的句子：${curRu}（${curZh}）${d}
教学要求：
1. 对话要持续、自然、不冷场：每轮回复都以一个新问题或新话题承接，让对话不断流；学生没话接时主动换个更简单的问题；
2. 学生说得对：用简短俄语肯定（Отлично! Правильно! Верно!），再顺势扩展一个小问题或新话题（不要总是让学生重说）；
3. 学生说错或语法不正确：先温和指出正确说法（用中文简短解释错在哪），然后**直接继续对话**（不要让学生重说一遍）——学生说的内容已经收到，你继续问下一个问题；
4. 不厌其烦：学生反复说错也不要急，改用更简单的表达继续引导；学生可以用中文提问，你用俄语+中文解释；
5. 回复以俄语为主（2-4 句），中文仅作解释/提示；不要评价学生"答得好不好"，直接自然对话；
6. 像真实聊天一样：你主动提问、分享、引导，不要总是纠正学生——让学生觉得你在和他聊天，而不是在考试。`
  }, [voiceMode, statement, modeLabel, lessonContext, dialogue])

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
      // 语音模式朗读回复中的俄语；文字模式不自动朗读（与文字版悟空一致）
      if (voiceModeRef.current) speakRu(reply)
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
        body: JSON.stringify({
          audio: b64,
          // 发音容错：把本课学过的俄语句子带给后端，识别接近时自动纠回正确句
          context: Array.isArray(lessonContext?.sentences)
            ? lessonContext.sentences.map(s => (typeof s === 'string' ? s : (s && s.ru) || '')).filter(Boolean)
            : [],
        }),
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

  // 答题结束后自动打开 + 语音引导（只引导一次；平时手动打开为文字问答模式）
  useEffect(() => {
    if (!autoOpen || open || guided) return
    setVoiceMode(true)
    setOpen(true)
  }, [autoOpen, open, guided])

  // 连续答错主动求助（答题过程中的文字求助，与设置「宠物」面板 petHelp + petHint 联动）
  useEffect(() => {
    if (ui.petHelp === false) return
    if (wrongStreak <= 0) return
    const hint = ui.petHint === 'always' ? 1 : (parseInt(ui.petHint || '3', 10) || 3)
    if (wrongStreak % hint !== 0) return
    setOpen(true)
    ask(`我连续答错 ${wrongStreak} 次了，能帮我讲讲这道题怎么入手吗？先给思路提示，不要直接给完整答案。`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wrongStreak, ui.petHelp, ui.petHint])

  // 答题结束语音模式下自动播放引导语（AI 先开口引导，不只弹窗；只播一次；手动打开不自动播）
  useEffect(() => {
    if (!voiceMode || !open || guided || !dialogue || !dialogue.greeting_ru) return
    setGuided(true)
    const t = setTimeout(() => speakRu(dialogue.greeting_ru), 300)
    return () => clearTimeout(t)
  }, [voiceMode, open, guided, dialogue, speakRu])

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

  // ---- 弹窗缩放（右下角手柄）----
  const onResizeDown = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const d = resizeRef.current
    d.dragging = true; d.sx = e.clientX; d.sy = e.clientY; d.sw = modalSize?.w || 560; d.sh = modalSize?.h || 420
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch (err) { /* 忽略 */ }
  }
  const onResizeMove = (e) => {
    const d = resizeRef.current
    if (!d.dragging) return
    const vw = window.innerWidth || 1280, vh = window.innerHeight || 720
    setModalSize({
      w: Math.max(380, Math.min(vw - 24, d.sw + (e.clientX - d.sx))),
      h: Math.max(300, Math.min(vh - 24, d.sh + (e.clientY - d.sy))),
    })
  }
  const onResizeUp = (e) => {
    const d = resizeRef.current
    d.dragging = false
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch (err) { /* 忽略 */ }
  }

  const modalW = modalSize?.w || Math.min(560, (typeof window !== 'undefined' ? window.innerWidth : 1280) - 32)
  if (ui.petShow === false) return null

  const guideQuestions = (dialogue && dialogue.questions && dialogue.questions.length ? dialogue.questions : FALLBACK_QUESTIONS)

  return (
    <>
      {/* 答题页左下角背景角色（可拖拽，融入页面背景）：
          答题过程中=文字问答+连错求助；答题结束自动弹出并语音引导（按住说话） */}
      <button
        aria-label="悟空AI助手"
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
              height: modalSize?.h || 'auto', borderRadius: 20, overflow: 'hidden',
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
                    {voiceMode
                      ? '悟空口语对话' + (dialogue && dialogue.topic ? ' · ' + dialogue.topic : '')
                      : '悟空AI助手'}
                  </h2>
                  <span style={{ fontSize: 11, color: 'var(--qs-sub, #6b7280)', display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                    {listening ? '正在听你说话…' : transcribing ? '正在识别你的语音…' : voiceMode ? '按住麦克风用俄语和我对话' : '答题中的问题都可以问我'}
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

            {/* 引导区：文字模式=预设解题问题；语音模式=本课话题引导问句（点按即发出） */}
            <div style={{ padding: '14px 18px 8px' }}>
              {voiceMode ? (
                <>
                  {dialogue && dialogue.greeting_zh && (
                    <div style={{ fontSize: 13, color: 'var(--qs-sub, #6b7280)', lineHeight: 1.7, marginBottom: 10, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <span style={{ flex: 1 }}>{dialogue.greeting_zh}</span>
                      <button
                        onClick={() => speakRu(dialogue.greeting_ru)}
                        title="播放引导语"
                        aria-label="播放引导语"
                        style={{
                          flexShrink: 0, width: 26, height: 26, borderRadius: '50%', border: '1px solid var(--qs-border, #e5e7eb)',
                          background: 'var(--qs-surface2, #f3f4f6)', color: 'var(--qs-text, #555)', cursor: 'pointer',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </button>
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
                </>
              ) : (
                <>
                  <div style={{ fontSize: 12.5, color: 'var(--qs-sub, #6b7280)', marginBottom: 8 }}>{TEXT_INTRO}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left' }}>
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
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* 对话区 */}
            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '6px 18px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {messages.length === 0 && !loading && !transcribing && (
                <div style={{ fontSize: 12.5, color: 'var(--qs-sub, #9ca3af)', textAlign: 'center', paddingTop: 18, lineHeight: 1.8 }}>
                  {voiceMode
                    ? (dialogue ? '按住麦克风说俄语，或点上方问题开始对话。' : '按住麦克风和我用俄语对话，我会围绕本课内容回应。')
                    : '点上方问题或直接输入，我帮你讲解。'}
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
                  width: 46, height: 46, borderRadius: '50%', border: listening ? '2px solid #EF4444' : '2px solid #111827',
                  flexShrink: 0, cursor: 'pointer', background: 'transparent', color: listening ? '#EF4444' : '#111827',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: listening ? '0 0 0 6px rgba(239,68,68,0.18)' : 'none',
                  transition: 'all 0.15s ease', touchAction: 'none', padding: 0,
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              </button>
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

            {/* 右下角缩放手柄：拖动可随意放大缩小弹窗 */}
            <div
              onPointerDown={onResizeDown}
              onPointerMove={onResizeMove}
              onPointerUp={onResizeUp}
              onPointerCancel={onResizeUp}
              title="拖动调整窗口大小"
              style={{
                position: 'absolute', right: 0, bottom: 0, width: 24, height: 24,
                cursor: 'nwse-resize', touchAction: 'none', zIndex: 4,
                display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', padding: 3,
                color: 'var(--qs-sub, #9ca3af)',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15L15 21M21 10L10 21M21 5L5 21" />
              </svg>
            </div>
          </div>
        </>
      )}
    </>
  )
}
