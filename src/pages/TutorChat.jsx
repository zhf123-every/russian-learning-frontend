import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch, API_BASE } from '../lib/api'
import { parseAIJSON } from '../lib/ai'
import { toast } from '../lib/toast'

const LEVELS = [
  { key: 'A1', title: 'A1 · 零基础', name: '零基础', desc: '问候、自我介绍、日常短句', color: '#B08A5A', tint: '#F5EBDD' },
  { key: 'A2', title: 'A2 · 初级', name: '初级', desc: '日常生活、购物、兴趣交流', color: '#A8937F', tint: '#F0E9E0' },
  { key: 'B1', title: 'B1 · 中级', name: '中级', desc: '表达观点、讲述经历、深度对话', color: '#8B735F', tint: '#EAE2D8' },
  { key: 'B2', title: 'B2 · 中高级', name: '中高级', desc: '抽象话题、复杂句式、流利表达', color: '#A86454', tint: '#F3E5DF' },
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
  const [micActive, setMicActive] = useState(false)   // 麦克风持续监听中
  const [speaking, setSpeaking] = useState(false)     // 用户正在说话（呼吸动画）
  const [autoTTS, setAutoTTS] = useState(true)        // 自动朗读开关，默认开启
  const [cloudAsr, setCloudAsr] = useState(false)     // 云端俄语转写开关（后端 Vosk，默认关）
  const [ttsPlaying, setTtsPlaying] = useState(false)
  const [srSupported] = useState(() => !!(window.SpeechRecognition || window.webkitSpeechRecognition))
  const listRef = useRef(null)
  const audioRef = useRef(null)
  const recRef = useRef(null)
  const ttsTokenRef = useRef(0)
  const micActiveRef = useRef(false)
  const speakingTimerRef = useRef(null)
  const pausedByTtsRef = useRef(false)                // TTS 播放期间是否暂停了麦克风
  const autoTTSRef = useRef(true)
  const cloudAsrRef = useRef(false)
  const mediaRecRef = useRef(null)                    // 云端模式 MediaRecorder
  const chunksRef = useRef([])                        // 云端模式录音分片
  const streamRef = useRef(null)                      // 云端模式录音流
  const lastWarnRef = useRef(0)                       // 非俄语提示节流
  const messagesRef = useRef([])

  // 自动滚动到底部
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, sending])

  // 同步最新值到 ref（异步回调中读取，避免闭包旧值）
  autoTTSRef.current = autoTTS
  cloudAsrRef.current = cloudAsr
  messagesRef.current = messages

  // 判断文本是否包含俄语（西里尔字母）；浏览器识别经常把中文/英语误当结果，校验后丢弃
  function isRussianText(t) {
    return /[\u0400-\u04FF]/.test(t || '')
  }

  // 非俄语提示（节流：4 秒内不重复弹）
  const warnNoRussian = () => {
    const now = Date.now()
    if (now - lastWarnRef.current > 4000) {
      lastWarnRef.current = now
      toast('没有检测到俄语，请用俄语说（初学者可放慢语速、逐词说）')
    }
  }

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

  // ========== 持续语音识别（Web Speech API，ru-RU，continuous） ==========
  // 点击【说话】一次持续收音，再次点击【停止】才停止；识别完成自动发送给AI。
  const buildRec = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const rec = new SR()
    rec.lang = 'ru-RU'
    rec.continuous = true          // 持续监听，无需反复点击
    rec.interimResults = true      // 中间结果用于判断"正在说话"
    rec.maxAlternatives = 1
    rec.onstart = () => { /* 已在 micActive 中标记 */ }
    rec.onresult = (e) => {
      // 用户正在说话 → 呼吸动画；静默 2.5s 后动画停止、监听保持
      setSpeaking(true)
      if (speakingTimerRef.current) clearTimeout(speakingTimerRef.current)
      speakingTimerRef.current = setTimeout(() => setSpeaking(false), 2500)
      // 只处理增量 final 结果（resultIndex 之后），避免重复发送旧内容
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal && r[0] && r[0].transcript.trim()) {
          const t = r[0].transcript.trim()
          // 非俄语结果（浏览器经常回退成中文/英语）→ 丢弃并提示，不发给 AI
          if (!isRussianText(t)) { warnNoRussian(); continue }
          sendMessage(t)
        }
      }
    }
    rec.onerror = (e) => {
      if (e.error === 'not-allowed') {
        // 权限被拒 → 停止监听，避免 onend 自动重启死循环
        micActiveRef.current = false
        setMicActive(false)
        setSpeaking(false)
        if (speakingTimerRef.current) clearTimeout(speakingTimerRef.current)
        toast('麦克风权限被拒绝，请在浏览器设置中允许')
      }
      else if (e.error === 'no-speech') { /* 持续模式下静默属正常，不打扰 */ }
      else if (e.error === 'aborted') { /* 主动停止，不提示 */ }
      else if (e.error !== 'network') toast('语音识别失败：' + e.error)
    }
    rec.onend = () => {
      setSpeaking(false)
      if (speakingTimerRef.current) clearTimeout(speakingTimerRef.current)
      if (micActiveRef.current) {
        // 非主动停止（浏览器静默超时等）→ 自动重启，保持持续监听
        const r = buildRec()
        recRef.current = r
        try { r.start() } catch (err) { micActiveRef.current = false; setMicActive(false) }
      } else {
        setMicActive(false)
      }
    }
    return rec
  }

  // ========== 云端俄语转写（后端 Vosk，锁定俄语，不受浏览器语言影响） ==========
  const transcribeCloud = async (blob) => {
    try {
      const dataUrl = await new Promise((res, rej) => {
        const fr = new FileReader()
        fr.onload = () => res(fr.result)
        fr.onerror = rej
        fr.readAsDataURL(blob)
      })
      const r = await apiFetch('/api/transcribe-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: dataUrl }),
      })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || '俄语转写失败')
      const t = (j.text || '').trim()
      if (!t) { warnNoRussian(); return }
      if (!isRussianText(t)) { warnNoRussian(); return }
      sendMessage(t)
    } catch (e) {
      toast('俄语转写失败：' + (e.message || '请重试'))
    }
  }

  // 云端模式：持续录音，点【停止】后上传转写
  const startCloudRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const rec = new MediaRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data) }
      rec.onstop = async () => {
        if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        chunksRef.current = []
        micActiveRef.current = false
        setMicActive(false)
        setSpeaking(false)
        if (!blob.size) return
        await transcribeCloud(blob)
      }
      mediaRecRef.current = rec
      rec.start()
      micActiveRef.current = true
      setMicActive(true)
    } catch (e) {
      toast('无法打开麦克风：' + (e.message || '请允许麦克风权限'))
    }
  }

  const startMic = () => {
    if (micActiveRef.current) return
    // 云端模式：不依赖浏览器语音识别，直接用服务器端 Vosk
    if (cloudAsrRef.current) {
      startCloudRec()
      return
    }
    if (!srSupported) {
      toast('当前浏览器不支持语音识别，请用Chrome浏览器，或打开顶部「云端俄语转写」开关')
      return
    }
    const rec = buildRec()
    recRef.current = rec
    micActiveRef.current = true
    setMicActive(true)
    try { rec.start() } catch (e) {
      micActiveRef.current = false
      setMicActive(false)
      toast('语音识别启动失败，请重试')
    }
  }

  const stopMic = () => {
    micActiveRef.current = false
    setSpeaking(false)
    if (speakingTimerRef.current) clearTimeout(speakingTimerRef.current)
    if (cloudAsrRef.current) {
      // 云端模式：停止录音，onstop 里自动上传转写
      const rec = mediaRecRef.current
      if (rec && rec.state !== 'inactive') { try { rec.stop() } catch (e) {} }
      else {
        if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
        setMicActive(false)
      }
      return
    }
    if (recRef.current) { try { recRef.current.stop() } catch (e) {} }
    setMicActive(false)
  }

  // TTS 播放结束后恢复被暂停的麦克风
  const resumeMicAfterTts = () => {
    if (!pausedByTtsRef.current) return
    pausedByTtsRef.current = false
    if (cloudAsrRef.current) {
      // 云端模式：恢复录音（不触发上传）
      try { if (mediaRecRef.current && mediaRecRef.current.state === 'paused') mediaRecRef.current.resume() } catch (e) {}
    } else {
      startMic()
    }
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
      // 历史：从最新消息提取 role+text（不包含纠错字段）
      const history = messagesRef.current.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }))
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
      // 自动朗读 AI 老师的回复（受顶部开关控制，默认开启）
      if (aiMsg.ruText && autoTTSRef.current) playTTS(aiMsg.ruText)
    } catch (e) {
      toast(e.message || '发送失败，请检查网络')
    } finally {
      setSending(false)
    }
  }

  // 播放 AI 老师语音（后端 Svetlana TTS）
  const playTTS = (text) => {
    if (!text) return
    // AI 朗读时临时屏蔽麦克风收音，防止 AI 播放的语音被误捕获
    if (micActiveRef.current) {
      pausedByTtsRef.current = true
      if (cloudAsrRef.current) {
        // 云端模式：暂停录音即可（停止会触发上传转写）
        try { if (mediaRecRef.current && mediaRecRef.current.state === 'recording') mediaRecRef.current.pause() } catch (e) {}
      } else {
        stopMic()
      }
    }
    if (!audioRef.current) audioRef.current = new Audio()
    const audio = audioRef.current
    const token = ++ttsTokenRef.current
    audio.pause()
    audio.onended = () => {
      if (ttsTokenRef.current !== token) return
      setTtsPlaying(false)
      resumeMicAfterTts()
    }
    audio.onerror = () => {
      if (ttsTokenRef.current !== token) return
      setTtsPlaying(false)
      resumeMicAfterTts()
      toast('语音播放失败，请检查后端服务')
    }
    audio.oncanplay = () => {
      if (ttsTokenRef.current !== token) return
      audio.play().catch(() => { setTtsPlaying(false); resumeMicAfterTts() })
    }
    audio.src = (API_BASE || '') + '/api/tts?text=' + encodeURIComponent(text) + '&_=' + Date.now()
    audio.load()
    setTtsPlaying(true)
  }

  const stopTTS = () => {
    ttsTokenRef.current++
    if (audioRef.current) audioRef.current.pause()
    setTtsPlaying(false)
    resumeMicAfterTts()
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
      if (speakingTimerRef.current) clearTimeout(speakingTimerRef.current)
      if (recRef.current) { try { recRef.current.abort() } catch (e) {} }
      if (mediaRecRef.current && mediaRecRef.current.state !== 'inactive') { try { mediaRecRef.current.stop() } catch (e) {} }
      if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
      if (audioRef.current) audioRef.current.pause()
      ttsTokenRef.current++
    }
  }, [])

  // ========== 难度选择页 ==========
  if (!level) {
    return (
      <div className="tutor-level-page">
        <div className="tutor-level-hero">
          <div className="tutor-level-badge">
            <span className="tutor-badge-dot"></span>
            Русский AI-учитель
          </div>
          <h1 className="tutor-level-title">
            俄语AI<span className="tutor-title-accent">对话教练</span>
          </h1>
          <p className="tutor-level-sub">直接开口说俄语，AI老师陪你聊天、纠正语法、引导你越说越好</p>
          <div className="tutor-hero-deco" aria-hidden="true">
            <span>А</span><span>Б</span><span>В</span><span>Г</span><span>Д</span>
          </div>
        </div>
        <div className="tutor-level-grid">
          {LEVELS.map(lv => (
            <div key={lv.key} className="tutor-level-card" style={{ '--lv': lv.color, '--lv-tint': lv.tint }} onClick={() => pickLevel(lv)}>
              <div className="tutor-lv-watermark" aria-hidden="true">{lv.key}</div>
              <div className="tutor-lv-top">
                <span className="tutor-lv-mark" style={{ background: lv.tint, color: lv.color }}>{lv.key}</span>
                <span className="tutor-lv-level">{lv.title}</span>
              </div>
              <p className="tutor-lv-desc">{lv.desc}</p>
              <div className="tutor-lv-feats">
                <span>自由对话</span>
                <span>实时纠错</span>
                <span>语音朗读</span>
              </div>
              <div className="tutor-lv-btn">
                开始对话
                <span className="tutor-lv-arrow">→</span>
              </div>
            </div>
          ))}
        </div>
        <button className="tbtn tutor-back" onClick={() => navigate('/')}>← 返回首页</button>
      </div>
    )
  }

  // ========== 对话页 ==========
  const lv = LEVELS.find(l => l.key === (level && level.key))
  return (
    <div className="tutor-page">
      <div className="tutor-header" style={{ borderColor: lv.color }}>
        <button className="tbtn" onClick={() => setLevel(null)}>← 换难度</button>
        <div className="tutor-title">
          <span className="tutor-dot" style={{ background: lv.color }}></span>
          <strong>俄语AI对话教练</strong>
          <span className="tutor-lv-tag" style={{ background: lv.tint, color: lv.color }}>{lv.title}</span>
        </div>
        <div className="tutor-header-right">
          <button
            className={'tbtn tutor-tts-toggle' + (cloudAsr ? ' on' : '')}
            onClick={() => {
              if (micActive) { toast('请先停止当前录音，再切换识别方式'); return }
              setCloudAsr(v => !v)
            }}
            title="开启后使用服务器端俄语识别（Vosk），不受浏览器语言影响，识别更准"
          >
            云端俄语转写：{cloudAsr ? '开' : '关'}
          </button>
          <button
            className={'tbtn tutor-tts-toggle' + (autoTTS ? ' on' : '')}
            onClick={() => setAutoTTS(v => !v)}
            title="AI回复后是否自动朗读俄语"
          >
            自动朗读：{autoTTS ? '开' : '关'}
          </button>
          <span className="tutor-hint">直接说话或输入，AI老师会纠正你的语法</span>
        </div>
      </div>

      <div className="tutor-chat" ref={listRef}>
        {messages.map((m, i) => (
          <div key={i} className={'tutor-msg ' + (m.role === 'user' ? 'user' : 'ai')}>
            {m.role === 'ai' && (
              <div className="tutor-avatar" style={{ background: lv.tint, color: lv.color }}>А</div>
            )}
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
                    <button className="tbtn corr-btn" onClick={retryCorrected}>重说正确句子</button>
                  )}
                </div>
              )}
              {m.role === 'ai' && m.ruText && (
                <div className="tutor-actions">
                  <button className="tbtn corr-btn" title="听发音" onClick={() => playTTS(m.ruText)}>听发音</button>
                </div>
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div className="tutor-msg ai">
            <div className="tutor-avatar" style={{ background: lv.tint, color: lv.color }}>А</div>
            <div className="tutor-bubble">
              <div className="tutor-bubble-text tutor-typing">
                <span className="ty-dot"></span><span className="ty-dot"></span><span className="ty-dot"></span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="tutor-inputbar">
        <button
          className={'tbtn tutor-mic' + (micActive ? ' listening' : '') + (speaking ? ' speaking' : '')}
          onClick={micActive ? stopMic : startMic}
          disabled={!srSupported && !cloudAsr}
          title={micActive
            ? (cloudAsr ? '点击停止录音，自动识别并发送' : '点击停止持续收音')
            : (cloudAsr ? '点击开始录音（云端俄语识别）' : (srSupported ? '点击开始持续收音，再点一次停止' : '当前浏览器不支持语音识别，请开云端转写或换Chrome'))}
        >
          {micActive ? '停止' : (cloudAsr ? '录音' : '说话')}
        </button>
        <input
          className="tutor-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') sendMessage() }}
          placeholder="说或输入俄语…（例：Привет, как дела?）"
        />
        <button className="tutor-send" onClick={() => sendMessage()} disabled={sending || !input.trim()}>
          发送
        </button>
        {ttsPlaying && (
          <button className="tbtn tutor-stop" onClick={stopTTS} title="停止朗读">停止朗读</button>
        )}
      </div>

      <div className="tutor-tip">
        💡 提示：AI老师会主动提问引导你开口；说错了会告诉你正确说法和语法规则，跟着重说一遍就能进步。
        {!cloudAsr && ' 如果浏览器识别不准（识别成中文/英语），请打开顶部「云端俄语转写」开关。'}
      </div>
    </div>
  )
}
