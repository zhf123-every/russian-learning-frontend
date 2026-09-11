import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch, API_BASE } from '../lib/api'
import { parseAIJSON } from '../lib/ai'
import { toast } from '../lib/toast'

const LEVELS = [
  { key: 'A1', title: 'A1 · 零基础', desc: '问候、自我介绍、日常短句', color: '#8B735F' },
  { key: 'A2', title: 'A2 · 初级', desc: '日常生活、购物、兴趣交流', color: '#A8937F' },
  { key: 'B1', title: 'B1 · 中级', desc: '表达观点、讲述经历、深度对话', color: '#B08A5A' },
  { key: 'B2', title: 'B2 · 中高级', desc: '抽象话题、复杂句式、流利表达', color: '#A86454' },
]

// AI 老师开场白（按等级）
const GREETINGS = {
  A1: 'Привет! Я твой русский учитель. Давай говорить по-русски! Как тебя зовут?（你好！我是你的俄语老师。我们来说俄语吧！你叫什么名字？）',
  A2: 'Привет! Рад тебя видеть. Как прошёл твой день?（你好！很高兴见到你。你今天过得怎么样？）',
  B1: 'Здравствуй! Давай поговорим о чём-нибудь интересном. Что тебя сейчас волнует?（你好！我们来聊聊有意思的事吧。你现在关心什么？）',
  B2: 'Здравствуйте! Сегодня отличный день для глубокого разговора. О чём бы вы хотели поговорить?（您好！今天是深入对话的好日子。您想聊点什么？）',
}

export default function TutorChat() {
  const navigate = useNavigate()
  const [level, setLevel] = useState(null)          // null=未选择难度
  const [messages, setMessages] = useState([])      // [{role:'user'|'ai', text, ruText, corrected, error_analysis, guidance, question}]
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [recording, setRecording] = useState(false)
  const [ttsPlaying, setTtsPlaying] = useState(false)
  const [srSupported] = useState(() => !!(window.SpeechRecognition || window.webkitSpeechRecognition))
  const listRef = useRef(null)
  const audioRef = useRef(null)
  const recRef = useRef(null)
  const ttsTokenRef = useRef(0)

  // 自动滚动到底部
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, sending])

  // 选择难度：AI 主动开场
  const pickLevel = (lv) => {
    setLevel(lv)
    setMessages([{ role: 'ai', text: GREETINGS[lv.key], ruText: extractRu(GREETINGS[lv.key]), corrected: '', error_analysis: '', guidance: '', question: '' }])
  }

  // 从"俄语+中文"混合文本里提取纯俄语（粗略：取括号前/字母为主的部分）
  function extractRu(t) {
    if (!t) return ''
    // 去掉括号中文：保留俄语字母部分
    const m = t.match(/[А-Яа-яЁё][^（(]*/g)
    return m ? m.join(' ').trim() : t
  }

  // 语音识别（Web Speech API，ru-RU）
  const startRecording = () => {
    if (!srSupported) {
      toast('当前浏览器不支持语音识别，请用Chrome浏览器或手动输入')
      return
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const rec = new SR()
    rec.lang = 'ru-RU'
    rec.interimResults = false
    rec.continuous = false
    rec.maxAlternatives = 1
    rec.onstart = () => setRecording(true)
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript
      setInput(transcript)
      setRecording(false)
      // 识别完成后自动发送
      if (transcript.trim()) sendMessage(transcript)
    }
    rec.onerror = (e) => {
      setRecording(false)
      if (e.error === 'not-allowed') toast('麦克风权限被拒绝，请在浏览器设置中允许')
      else if (e.error === 'no-speech') toast('没有听到声音，请再试一次')
      else toast('语音识别失败：' + e.error)
    }
    rec.onend = () => setRecording(false)
    recRef.current = rec
    rec.start()
  }

  const stopRecording = () => {
    if (recRef.current) {
      try { recRef.current.stop() } catch (e) {}
    }
    setRecording(false)
  }

  // 发送消息给 AI 老师
  const sendMessage = async (text) => {
    const msg = (text || input).trim()
    if (!msg || sending) return
    setInput('')
    setSending(true)
    // 追加用户消息
    setMessages(prev => [...prev, { role: 'user', text: msg, corrected: '', error_analysis: '', guidance: '', question: '' }])
    try {
      // 历史：从 messages 提取 role+text（不包含纠错字段）
      const history = messages.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }))
      const r = await apiFetch('/api/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: level.key, message: msg, history }),
      })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || 'AI对话失败')
      // 解析 AI 返回的结构化 JSON
      let parsed = parseAIJSON(j.content)
      let aiMsg = { role: 'ai', text: '', ruText: '', corrected: '', error_analysis: '', guidance: '', question: '' }
      if (parsed && parsed.reply) {
        aiMsg.text = parsed.reply
        aiMsg.ruText = (parsed.reply_ru || extractRu(parsed.reply))
        aiMsg.corrected = parsed.corrected || ''
        aiMsg.error_analysis = parsed.error_analysis || ''
        aiMsg.guidance = parsed.guidance || ''
        aiMsg.question = parsed.question || ''
      } else {
        aiMsg.text = j.content
        aiMsg.ruText = extractRu(j.content)
      }
      setMessages(prev => [...prev, aiMsg])
      // 自动朗读 AI 老师的回复（纯俄语部分）
      if (aiMsg.ruText) playTTS(aiMsg.ruText)
    } catch (e) {
      toast(e.message || '发送失败，请检查网络')
    } finally {
      setSending(false)
    }
  }

  // 播放 AI 老师语音（后端 Svetlana TTS）
  const playTTS = (text) => {
    if (!text) return
    if (!audioRef.current) audioRef.current = new Audio()
    const audio = audioRef.current
    const token = ++ttsTokenRef.current
    audio.pause()
    audio.onended = () => { if (ttsTokenRef.current === token) setTtsPlaying(false) }
    audio.onerror = () => {
      if (ttsTokenRef.current !== token) return
      setTtsPlaying(false)
      toast('语音播放失败，请检查后端服务')
    }
    audio.oncanplay = () => {
      if (ttsTokenRef.current !== token) return
      audio.play().catch(() => setTtsPlaying(false))
    }
    audio.src = (API_BASE || '') + '/api/tts?text=' + encodeURIComponent(text) + '&_=' + Date.now()
    audio.load()
    setTtsPlaying(true)
  }

  const stopTTS = () => {
    ttsTokenRef.current++
    if (audioRef.current) audioRef.current.pause()
    setTtsPlaying(false)
  }

  // 重说当前正确句子（把 corrected 填入输入框）
  const retryCorrected = () => {
    const last = messages[messages.length - 1]
    if (last && last.corrected) {
      setInput(last.corrected)
      playTTS(last.corrected)
    }
  }

  // 组件卸载清理
  useEffect(() => {
    return () => {
      if (recRef.current) { try { recRef.current.abort() } catch (e) {} }
      if (audioRef.current) audioRef.current.pause()
      ttsTokenRef.current++
    }
  }, [])

  // ========== 难度选择页 ==========
  if (!level) {
    return (
      <div className="landing">
        <div className="landing-head">
          <div className="landing-logo">🗣️</div>
          <h1>俄语AI对话教练</h1>
          <p>直接开口说俄语，AI老师陪你聊天、纠正语法、引导你越说越好</p>
        </div>
        <div className="tutor-level-grid">
          {LEVELS.map(lv => (
            <div key={lv.key} className="landing-card tutor-level-card" onClick={() => pickLevel(lv)}>
              <h2 style={{ color: lv.color }}>{lv.title}</h2>
              <div className="sub">{lv.desc}</div>
              <p>自由对话 · 实时纠错 · 语音朗读</p>
              <div className="go">开始对话</div>
            </div>
          ))}
        </div>
        <button className="tbtn tutor-back" onClick={() => navigate('/')}>← 返回首页</button>
      </div>
    )
  }

  // ========== 对话页 ==========
  const lv = LEVELS.find(l => l.key === level)
  return (
    <div className="tutor-page">
      <div className="tutor-header" style={{ borderColor: lv.color }}>
        <button className="tbtn" onClick={() => setLevel(null)}>← 换难度</button>
        <div className="tutor-title">
          <span className="tutor-dot" style={{ background: lv.color }}></span>
          <strong>俄语AI对话教练 · {lv.title}</strong>
        </div>
        <span className="tutor-hint">直接说话或输入，AI老师会纠正你的语法</span>
      </div>

      <div className="tutor-chat" ref={listRef}>
        {messages.map((m, i) => (
          <div key={i} className={'tutor-msg ' + (m.role === 'user' ? 'user' : 'ai')}>
            <div className="tutor-bubble">
              <div className="tutor-bubble-text">{m.text}</div>
              {/* 纠错区块 */}
              {m.role === 'ai' && (m.corrected || m.error_analysis || m.guidance) && (
                <div className="tutor-correction">
                  {m.corrected && (
                    <div className="corr-row correct">
                      <span className="corr-label">✅ 正确说法</span>
                      <span className="corr-text">{m.corrected}</span>
                    </div>
                  )}
                  {m.error_analysis && (
                    <div className="corr-row analysis">
                      <span className="corr-label">📖 语法解析</span>
                      <span className="corr-text">{m.error_analysis}</span>
                    </div>
                  )}
                  {m.guidance && (
                    <div className="corr-row guide">
                      <span className="corr-label">💬 请跟我读</span>
                      <span className="corr-text">{m.guidance}</span>
                    </div>
                  )}
                  {m.corrected && (
                    <button className="tbtn corr-btn" onClick={retryCorrected}>🔁 重说正确句子</button>
                  )}
                </div>
              )}
              {m.role === 'ai' && m.ruText && (
                <button className="tbtn corr-btn" onClick={() => playTTS(m.ruText)}>🔊 听发音</button>
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div className="tutor-msg ai">
            <div className="tutor-bubble">
              <div className="tutor-bubble-text tutor-typing">老师正在思考…</div>
            </div>
          </div>
        )}
      </div>

      <div className="tutor-inputbar">
        <button
          className={'tbtn tutor-mic' + (recording ? ' recording' : '')}
          onClick={recording ? stopRecording : startRecording}
          disabled={!srSupported}
          title={srSupported ? '点击说话（俄语）' : '当前浏览器不支持语音识别'}
        >
          {recording ? '⏹ 停止' : '🎤 说话'}
        </button>
        <input
          className="tutor-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') sendMessage() }}
          placeholder="说或输入俄语…（例：Привет, как дела?）"
        />
        <button className="tbtn tutor-send" onClick={() => sendMessage()} disabled={sending || !input.trim()}>
          发送
        </button>
        {ttsPlaying && (
          <button className="tbtn tutor-stop" onClick={stopTTS}>⏹ 停止朗读</button>
        )}
      </div>

      <div className="tutor-tip">
        💡 提示：AI老师会主动提问引导你开口；说错了会告诉你正确说法和语法规则，跟着重说一遍就能进步。
      </div>
    </div>
  )
}
