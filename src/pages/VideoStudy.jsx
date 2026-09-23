// 视频学习页（五步独立学习，重做版 v2）
// 路由：/video-study/:videoId?step=listen|dictate|correct|recite|speaking
// v2 改动：
//   1) 页眉 sticky 固定，不随页面滚动
//   2) 底部步骤切换条移除 → 页眉加"手柄标签"：悬停提示"切换游戏模式"，点击弹出选择模式弹窗
//   3) 快捷键：空格=播放/暂停切换（按一下播、再按暂停、不按一直播）；←/→=上一句/下一句
//   4) 听写页不放"播放本句"按钮：进入句子自动播放，播完一句自动暂停，等用户输入提交
import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { getVideoPlay, createPlayer } from '../lib/videoPlayer'
import { resolvePlayUrl } from '../lib/playUrl'
import { analyzeSentence, pronunciationScore } from '../lib/ai'
import { useGameVideoStore } from '../store/gameVideoStore'
import { useCourseStore } from '../store/courseStore'
import { useSquareStore } from '../store/squareStore'
import { apiFetch } from '../lib/api'
import { VIDEOS as BUILTIN_VIDEOS } from '../data/gameLibrary'
import { toast } from '../lib/toast'
import WordPop from '../components/WordPop'
import ModePickerModal, { VIDEO_MODES } from '../components/ModePickerModal'

const STEPS = [
  { key: 'listen', label: '盲听', short: '盲听' },
  { key: 'dictate', label: '听写', short: '听写' },
  { key: 'correct', label: '精读纠错', short: '精读' },
  { key: 'recite', label: '跟读', short: '跟读' },
  { key: 'speaking', label: '口语评测', short: '口语' },
]
const SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5]
// 模式弹窗 key → step 映射
const MODE_STEP_MAP = {
  listen_overall: 'listen', listen_segment: 'listen',
  intensive: 'dictate', correct: 'correct',
  follow: 'recite', speaking: 'speaking',
}

function normSentences(video) {
  const raw = (video && video.sentences) || []
  return raw.map((s, i) => ({
    ...s,
    id: s.id ?? i + 1,
    russian: s.russian ?? s.text ?? '',
    chinese: s.chinese ?? s.tr ?? '',
  }))
}

export default function VideoStudy() {
  const { videoId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const step = searchParams.get('step') || 'listen'

  const uploaded = useGameVideoStore(s => s.videos.find(v => v.id === videoId))
  const courseVideo = useCourseStore(s => s.getVideo(videoId))
  const squareVideo = useSquareStore(s => s.getItem(videoId))
  const fetchServer = useSquareStore(s => s.fetchServer)
  const [video, setVideo] = useState(null)
  const [playSrc, setPlaySrc] = useState('')
  const [sentences, setSentences] = useState([])
  const [loading, setLoading] = useState(true)

  const [curIdx, setCurIdx] = useState(0)
  const [paused, setPaused] = useState(true)
  const [speed, setSpeed] = useState(1.0)
  const [videoError, setVideoError] = useState('')
  const [aiHtml, setAiHtml] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [popWord, setPopWord] = useState(null)
  const [modeOpen, setModeOpen] = useState(false)
  const [tooltipOn, setTooltipOn] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordingIdx, setRecordingIdx] = useState(-1)
  const [myAudioUrl, setMyAudioUrl] = useState(null)
  const [myBlob, setMyBlob] = useState(null)
  const [scoreResult, setScoreResult] = useState(null)
  const [scoring, setScoring] = useState(false)

  const [dictInput, setDictInput] = useState('')
  const [dictResult, setDictResult] = useState(null)
  const [dictDone, setDictDone] = useState({})

  const [reciteMode, setReciteMode] = useState('segment')
  const [activeIdx, setActiveIdx] = useState(-1)

  const videoRef = useRef(null)
  const pRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const recordChunksRef = useRef([])
  const streamRef = useRef(null)
  const activeIdxRef = useRef(0)
  const dictResultRef = useRef(null)
  dictResultRef.current = dictResult
  const pausedRef = useRef(true)
  pausedRef.current = paused
  const curIdxRef = useRef(0)
  curIdxRef.current = curIdx
  const stepRef = useRef(step)
  stepRef.current = step
  const reciteModeRef = useRef(reciteMode)
  reciteModeRef.current = reciteMode
  const sentencesRef = useRef([])
  sentencesRef.current = sentences
  const recordingIdxRef = useRef(-1)
  recordingIdxRef.current = recordingIdx

  const cur = sentences[curIdx]

  // ---------- 数据加载 ----------
  useEffect(() => {
    let alive = true
    const load = async () => {
      let v = uploaded || courseVideo || squareVideo || BUILTIN_VIDEOS.find(x => x.id === videoId)
      if (!v) {
        try {
          const r = await apiFetch('/api/videos/list')
          const j = await r.json()
          if (alive && j.ok && Array.isArray(j.videos)) {
            const hit = j.videos.find(x => x.id === videoId)
            if (hit) v = hit
          }
        } catch (e) { /* 后端不可用 */ }
      }
      if (!v && !courseVideo && !squareVideo) {
        const timeout = new Promise((res) => setTimeout(() => res('timeout'), 6000))
        try { await Promise.race([fetchServer(), timeout]) } catch (e) { /* 忽略 */ }
        const sv = useSquareStore.getState().getItem(videoId)
        if (alive && sv) v = sv
      }
      if (!alive) return
      if (!v) { setLoading(false); return }
      setVideo(v)
      setSentences(normSentences(v))
      const src = await resolvePlayUrl(v.videoUrl || '')
      if (alive) { setPlaySrc(src); setLoading(false) }
    }
    load()
    return () => { alive = false }
  }, [videoId]) // eslint-disable-line

  // ---------- 播放器 ----------
  useEffect(() => {
    if (!playSrc) return
    const play = getVideoPlay(playSrc)
    const p = createPlayer(play, videoRef.current)
    p.onError = (code, msg) => setVideoError(msg)
    pRef.current = p
    return () => { if (pRef.current) { pRef.current.pause(); pRef.current.stopLoop() } }
  }, [playSrc])

  // 播放状态与 <video> 元素同步（播完自动暂停 / 用户手动暂停都反映到 paused）
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onPause = () => setPaused(true)
    const onPlay = () => setPaused(false)
    v.addEventListener('pause', onPause)
    v.addEventListener('play', onPlay)
    return () => { v.removeEventListener('pause', onPause); v.removeEventListener('play', onPlay) }
  }, [playSrc])

  // 播放当前句片段（end 自动暂停；loop 时循环 N 遍后停）
  const playSeg = useCallback((idx, { loop = false, times = 3 } = {}) => {
    const s = sentences[idx]
    if (!s || !pRef.current) return
    let start = s.start != null ? s.start : 0
    let end = s.end != null ? s.end : (videoRef.current?.duration || 0)
    if (end <= start || (videoRef.current?.duration && end >= videoRef.current.duration - 0.5)) {
      const wc = (s.russian || '').trim().split(/\s+/).filter(Boolean).length
      end = start + Math.min(12, Math.max(3, wc * 0.7))
    }
    if (loop) pRef.current.playLoop(start, end, times)
    else pRef.current.playSegment(start, end, false)
    setPaused(false)
  }, [sentences])

  const playFull = useCallback(() => {
    if (!pRef.current) return
    pRef.current.stopLoop()
    pRef.current.playFull()
    setPaused(false)
  }, [])

  const stopPlay = useCallback(() => {
    if (pRef.current) { pRef.current.pause(); pRef.current.stopLoop() }
    setPaused(true)
  }, [])

  const setRate = (r) => {
    setSpeed(r)
    if (pRef.current) pRef.current.setRate(r)
    else if (videoRef.current) videoRef.current.playbackRate = r
  }

  // ---------- 听写：进入句子自动播放一句（播完自动停，等输入提交） ----------
  useEffect(() => {
    if (step === 'dictate' && sentences.length > 0) {
      playSeg(curIdx, { loop: false })
    }
  }, [step, curIdx, playSrc, sentences.length]) // eslint-disable-line

  // ---------- 空格 / 方向键全局快捷键 ----------
  const togglePlay = useCallback(() => {
    const p = pRef.current
    if (!p) return
    if (!pausedRef.current) { stopPlay(); return }
    const s = sentencesRef.current
    const i = curIdxRef.current
    const st = stepRef.current
    if (st === 'listen') { playFull(); return }
    if (st === 'recite' && reciteModeRef.current === 'full') { playFull(); return }
    if (s[i]) playSeg(i, { loop: false })
  }, [playFull, playSeg, stopPlay])

  useEffect(() => {
    const onKey = (e) => {
      const t = e.target
      const isInput = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
      // 输入框内：交给输入框自己的逻辑（听写页 Enter/空格已处理，方向键移动光标）
      if (isInput) return
      if (e.key === ' ') {
        e.preventDefault()
        togglePlay()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (curIdxRef.current > 0) { setCurIdx(curIdxRef.current - 1); setActiveIdx(-1) }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        if (curIdxRef.current < sentencesRef.current.length - 1) { setCurIdx(curIdxRef.current + 1); setActiveIdx(-1) }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePlay])

  // 整篇跟读/精读：字幕跟随高亮
  useEffect(() => {
    if (!videoRef.current) return
    const onTime = () => {
      const v = videoRef.current
      const ct = v.currentTime
      const dur = v.duration || 0
      let found = -1
      for (let i = 0; i < sentences.length; i++) {
        const s = sentences[i]
        if (s.start != null && s.end != null && ct >= s.start && ct < s.end) { found = i; break }
      }
      if (found === -1 && dur > 0 && sentences.length > 0) {
        const per = dur / sentences.length
        found = Math.min(sentences.length - 1, Math.floor(ct / per))
      }
      if (found !== activeIdxRef.current) {
        activeIdxRef.current = found
        setActiveIdx(found)
      }
    }
    videoRef.current.addEventListener('timeupdate', onTime)
    return () => videoRef.current?.removeEventListener('timeupdate', onTime)
  }, [sentences, playSrc])

  // ---------- 听写 ----------
  const normDict = (s) => (s || '').replace(/[^\wа-яёА-ЯЁ\s]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
  const checkDict = () => {
    if (!cur) return
    const target = normDict(cur.russian)
    const input = normDict(dictInput)
    const correct = target === input && input.length > 0
    setDictResult({ correct, target: cur.russian, input })
    if (correct) {
      setDictDone(d => ({ ...d, [cur.id]: true }))
      toast('正确！按空格继续下一句')
    } else {
      toast('有错误，请再听一次')
    }
  }
  const onKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); checkDict(); return }
    if (e.key === ' ') {
      if (dictResultRef.current && dictResultRef.current.correct) {
        e.preventDefault()
        setDictInput(''); setDictResult(null)
        if (curIdxRef.current < sentences.length - 1) { setCurIdx(curIdxRef.current + 1); setActiveIdx(-1) }
        else toast('全部句子听写完成 🎉')
      }
    }
  }

  // ---------- 录音（跟读/口语共用） ----------
  const startRec = async (idx = -1) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      recordChunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) recordChunksRef.current.push(e.data) }
      recorder.onstop = () => {
        const blob = new Blob(recordChunksRef.current, { type: 'audio/webm' })
        const url = URL.createObjectURL(blob)
        setMyBlob(blob); setMyAudioUrl(url); setScoreResult(null)
        streamRef.current?.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
      mediaRecorderRef.current = recorder
      recorder.start()
      setRecording(true); setRecordingIdx(idx)
    } catch (e) {
      toast('无法访问麦克风：' + e.message)
    }
  }
  const stopRec = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop()
    setRecording(false)
  }

  // 口语评测
  const runScore = async () => {
    if (!myBlob) { toast('请先录音'); return }
    const standard = recordingIdxRef.current >= 0
      ? (sentences[recordingIdxRef.current]?.russian || '')
      : sentences.map(s => s.russian).join(' ')
    if (!standard.trim()) { toast('缺少标准文本'); return }
    setScoring(true)
    try {
      const r = await pronunciationScore(myBlob, standard)
      setScoreResult(r)
      toast('口语评测完成')
    } catch (e) {
      toast(e.message || '评测失败')
    } finally {
      setScoring(false)
    }
  }

  // 精读 AI 解析
  const runAI = async () => {
    if (!cur) return
    setAnalyzing(true)
    setAiHtml('解析中…')
    try {
      const r = await analyzeSentence(cur.russian)
      const parts = []
      if (r.translation) parts.push('**中文翻译**：' + r.translation)
      if (r.words && r.words.length) {
        parts.push('**逐词分析**：\n' + r.words.map(w =>
          '- ' + (w.stressed || w.word || '') + (w.pos ? '（' + w.pos + '）' : '') + (w.mean ? '：' + w.mean : '')
        ).join('\n'))
      }
      if (r.components && r.components.length) {
        parts.push('**句子成分**：\n' + r.components.map(c => '- ' + c.role + '：' + c.text).join('\n'))
      }
      if (r.grammar) parts.push('**语法解析**：\n' + r.grammar)
      const md = parts.join('\n\n') || r.grammar || JSON.stringify(r, null, 2)
      const { mdToHtml } = await import('../lib/md')
      setAiHtml(mdToHtml(md))
    } catch (e) {
      setAiHtml(''); toast('AI 解析失败：' + (e.message || ''))
    } finally {
      setAnalyzing(false)
    }
  }

  const onWordHover = (e, word) => {
    if (!word || word.length < 2) return
    setPopWord({ word, x: e.clientX, y: e.clientY })
  }

  // 生成字幕
  const genSubs = async () => {
    if (!video?.videoUrl) { toast('视频地址缺失'); return }
    toast('正在转写，可能需要 30-60 秒…')
    try {
      const r = await apiFetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: video.videoUrl, model: 'tiny' }),
      })
      const j = await r.json()
      if (!j.ok) { toast('转写失败：' + (j.error || '')); return }
      if (!j.segments || !j.segments.length) { toast('未识别出句子'); return }
      const sents = j.segments.map((s, i) => ({ id: i + 1, russian: s.text, chinese: '', start: s.start, end: s.end }))
      setSentences(sents)
      if (uploaded) {
        const { useGameVideoStore } = await import('../store/gameVideoStore')
        const item = { ...uploaded, sentences: sents }
        const others = useGameVideoStore.getState().videos.filter(x => x.id !== videoId)
        useGameVideoStore.setState({ videos: [item, ...others] })
        try {
          const { saveLS } = await import('../lib/persistence')
          saveLS('rlearn_v1_game_videos', [item, ...others])
        } catch (e) { /* 忽略 */ }
      }
      toast('已生成 ' + sents.length + ' 句字幕，可开始学习')
    } catch (e) {
      toast('转写失败：' + (e.message || ''))
    }
  }

  // 手柄弹窗选模式 → 切 step（并重置页面状态）
  const switchMode = (modeKey) => {
    const next = MODE_STEP_MAP[modeKey] || 'listen'
    setSearchParams({ step: next })
    setCurIdx(0); setActiveIdx(-1)
    setDictInput(''); setDictResult(null); setDictDone({})
    setScoreResult(null); setMyAudioUrl(null); setMyBlob(null)
    setAiHtml(''); setModeOpen(false)
    if (pRef.current) pRef.current.stopLoop()
  }

  // ---------- 渲染 ----------
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
        视频加载中…
      </div>
    )
  }
  if (!video) {
    return (
      <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#555' }}>
        <div style={{ fontSize: 44 }}>🎬</div>
        <div style={{ fontSize: 18, fontWeight: 600 }}>视频不存在或已下线</div>
        <button className="btn sm primary" onClick={() => navigate('/unlocked-games')}>回解锁游戏</button>
      </div>
    )
  }

  const stepMeta = STEPS.find(s => s.key === step) || STEPS[0]
  const stepIdx = STEPS.findIndex(s => s.key === step)

  const renderSub = (text) => (
    <span>
      {(text || '').split(/(\s+)/).map((w, i) =>
        w.trim() && /^[а-яёА-ЯЁa-zA-Z]+$/.test(w.trim())
          ? <span key={i} onMouseEnter={(e) => onWordHover(e, w.trim())} style={{ cursor: 'pointer' }}>{w}</span>
          : <span key={i}>{w}</span>
      )}
    </span>
  )

  const renderScore = () => {
    if (!scoreResult) return null
    const r = scoreResult
    const okCount = Array.isArray(r.words) ? r.words.filter(w => w.status === 'ok').length : 0
    const total = Array.isArray(r.words) ? r.words.length : 0
    return (
      <div style={{ padding: 14, background: '#f8f8fb', borderRadius: 10, border: '1px solid #eee', marginTop: 10, textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <div style={{ fontSize: 34, fontWeight: 800, color: '#6d28d9' }}>{r.score ?? '—'}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: '#888' }}>AI 口语评分 {total > 0 ? '· ' + okCount + '/' + total + ' 词读对' : ''}</div>
            <div style={{ height: 6, background: '#eee', borderRadius: 99, marginTop: 6 }}>
              <div style={{ height: '100%', width: Math.min(100, r.score || 0) + '%', background: 'linear-gradient(90deg,#8b5cf6,#6d28d9)', borderRadius: 99 }} />
            </div>
          </div>
        </div>
        {r.user_text && (
          <div style={{ fontSize: 13, marginBottom: 6 }}><b>你读的：</b>{r.user_text}</div>
        )}
        {Array.isArray(r.words) && r.words.length > 0 && (
          <div style={{ fontSize: 13, marginBottom: 6 }}>
            <b>逐词标注：</b>
            <span>
              {r.words.map((w, i) => (
                <span key={i} style={{
                  color: w.status === 'ok' ? '#16a34a' : (w.status === 'wrong' || w.status === 'omitted' ? '#dc2626' : '#d97706'),
                  fontWeight: w.status === 'ok' ? 500 : 700,
                }}>{w.target || w.word || ''}{' '}</span>
              ))}
            </span>
          </div>
        )}
        {r.summary && <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6, marginBottom: 6 }}>{r.summary}</div>}
        {r.rhythm && <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6, marginBottom: 6 }}><b>节奏停顿：</b>{r.rhythm}</div>}
        {r.stress && <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6 }}><b>重音建议：</b>{r.stress}</div>}
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', flexDirection: 'column', fontFamily: "'Nunito', 'Segoe UI', sans-serif" }}>
      {/* ===== 顶部白底固定页眉（sticky，不随滚动） ===== */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 16px', borderBottom: '1px solid #eee', background: '#fff', gap: 8 }}>
        <button type="button" onClick={() => navigate(-1)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, color: '#555', display: 'flex', alignItems: 'center' }} aria-label="返回">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        </button>
        <span style={{ fontSize: 17, fontWeight: 700, color: '#18181b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {video.title || '视频学习'}
        </span>
        <span style={{ fontSize: 13, color: '#9ca3af', fontWeight: 600 }}>{stepMeta.label}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>{stepIdx + 1}/{STEPS.length}</span>
          {sentences.length === 0 && (
            <button type="button" onClick={genSubs} className="btn sm primary" style={{ fontSize: 12 }}>生成字幕</button>
          )}
          {/* 手柄标签：悬停提示"切换游戏模式"，点击弹选择模式弹窗 */}
          <div
            style={{ position: 'relative' }}
            onMouseEnter={() => setTooltipOn(true)}
            onMouseLeave={() => setTooltipOn(false)}
          >
            <button
              type="button"
              onClick={() => setModeOpen(true)}
              aria-label="切换游戏模式"
              style={{
                width: 38, height: 38, borderRadius: 10, border: '1px solid #e5e7eb',
                background: '#fafafa', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#18181b" aria-hidden="true">
                <path d="M17 4H7C4.243 4 2 6.243 2 9v6c0 2.757 2.243 5 5 5 1.2 0 2.4-.45 3.33-1.27l1.67-1.48 1.67 1.48C14.6 19.55 15.8 20 17 20c2.757 0 5-2.243 5-5V9c0-2.757-2.243-5-5-5zm-6 4h-2v2H7v2h2v2h2v-2h2v-2h-2V8zm6.5 7a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm-2-3.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/>
              </svg>
            </button>
            {tooltipOn && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0, whiteSpace: 'nowrap',
                background: '#18181b', color: '#fff', fontSize: 12, padding: '6px 12px', borderRadius: 8,
                boxShadow: '0 4px 16px rgba(0,0,0,0.18)', zIndex: 30,
              }}>
                切换游戏模式
                <div style={{ position: 'absolute', top: -5, right: 14, width: 10, height: 10, background: '#18181b', transform: 'rotate(45deg)' }} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== 视频区（中上） ===== */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 16px 0' }}>
        <div style={{ width: '100%', maxWidth: 760, aspectRatio: '16/9', background: '#000', borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
          {playSrc ? (
            getVideoPlay(playSrc).type === 'direct' ? (
              <video
                ref={videoRef}
                src={playSrc}
                poster={video.posterUrl || video.thumbnail}
                controls
                playsInline
                style={{ width: '100%', height: '100%', display: 'block', background: '#000' }}
              />
            ) : (
              <iframe
                src={getVideoPlay(playSrc).src}
                title={video.title || '视频'}
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
              />
            )
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, background: '#111' }}>
              {videoError ? '视频无法播放：' + videoError : '视频加载中…'}
            </div>
          )}
          {videoError && playSrc && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(24,24,27,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#fff', zIndex: 5, textAlign: 'center', padding: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>⚠️ 视频无法播放</div>
              <div style={{ fontSize: 13, opacity: 0.9 }}>{videoError}</div>
              <button type="button" onClick={() => setVideoError('')} style={{ marginTop: 4, background: 'transparent', border: '1px solid rgba(255,255,255,0.5)', color: '#fff', padding: '6px 14px', borderRadius: 999, fontSize: 12, cursor: 'pointer' }}>关闭提示</button>
            </div>
          )}
        </div>

        {/* 快捷键提示 + 变速（暂停/播放/整篇连播按钮已移除，由空格控制） */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
          <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>
            {step === 'dictate'
              ? '视频自动播一句停一句 · Enter 提交 · 正确后空格跳下一句'
              : '空格 播放/暂停 · ← → 上一句/下一句'}
          </span>
          <select value={speed} onChange={e => setRate(parseFloat(e.target.value))} style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, background: '#fff' }}>
            {SPEEDS.map(s => <option key={s} value={s}>{s}x</option>)}
          </select>
        </div>
      </div>

      {/* ===== 步骤内容区 ===== */}
      <div style={{ flex: 1, maxWidth: 760, width: '100%', margin: '0 auto', padding: '16px 16px 48px' }}>

        {sentences.length === 0 && (
          <div style={{ padding: 14, background: '#fef3c7', borderRadius: 10, color: '#92400e', fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
            <b>该视频暂无字幕。</b>{' '}
            {step === 'listen' ? '可先盲听整篇（按空格开始）；' : '精读/跟读/口语需要字幕断句，请先点右上角「生成字幕」。'}
          </div>
        )}

        {/* ===== ① 盲听 ===== */}
        {step === 'listen' && (
          <div style={{ textAlign: 'center', paddingTop: 8 }}>
            <div style={{ fontSize: 14, color: '#9ca3af', marginBottom: 14 }}>反复听完整篇素材 · 感受整体语境主旨 · 无字幕</div>
            <div style={{ fontSize: 13, color: '#6d28d9', fontWeight: 700, marginBottom: 4 }}>按 空格键 开始播放 · 再按一次暂停</div>
            <div style={{ fontSize: 12, color: '#bbb', marginTop: 10 }}>{sentences.length ? '本素材共 ' + sentences.length + ' 句' : '本素材暂无字幕断句'}</div>
          </div>
        )}

        {/* ===== ② 听写 ===== */}
        {step === 'dictate' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 13, color: '#888' }}>第 {curIdx + 1} 句 / 共 {sentences.length} 句</div>
              <div style={{ fontSize: 13, color: '#888' }}>完成 {Object.keys(dictDone).length}/{sentences.length}</div>
            </div>
            {!cur ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>请先「生成字幕」再开始听写</div>
            ) : (
              <>
                <div style={{ padding: '30px 10px', textAlign: 'center' }}>
                  <div style={{ display: 'inline-block', width: '100%', maxWidth: 620 }}>
                    <input
                      value={dictInput}
                      onChange={e => setDictInput(e.target.value)}
                      onKeyDown={onKeyDown}
                      placeholder="输入你听到的俄语…（Enter 提交）"
                      autoFocus
                      style={{
                        width: '100%', border: 'none', borderBottom: '2px solid #d4d4d8',
                        fontSize: 24, textAlign: 'center', padding: '8px 4px', outline: 'none',
                        background: 'transparent', fontFamily: 'inherit',
                      }}
                    />
                  </div>
                </div>
                {dictResult && (
                  <div style={{ textAlign: 'center', marginBottom: 10 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: dictResult.correct ? '#16a34a' : '#dc2626', marginBottom: 4 }}>
                      {dictResult.correct ? '✓ 完全正确！按空格进入下一句' : '✗ 有错误，请再听'}
                    </div>
                    {!dictResult.correct && (
                      <div style={{ fontSize: 13, color: '#888' }}>
                        你的输入：{dictResult.input || '（空）'}
                      </div>
                    )}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 8 }}>
                  <button className="btn primary" onClick={() => playSeg(curIdx, { loop: false })}>🔊 再听本句</button>
                  <button className="btn" onClick={checkDict}>提交（Enter）</button>
                  <button className="btn" onClick={() => {
                    setDictDone(d => ({ ...d, [cur.id]: true }))
                    setDictInput(''); setDictResult(null)
                    if (curIdx < sentences.length - 1) { setCurIdx(curIdx + 1); setActiveIdx(-1) }
                    else toast('全部句子听写完成 🎉')
                  }}>跳过本句</button>
                </div>
                <div style={{ textAlign: 'center', fontSize: 12, color: '#bbb', marginTop: 14 }}>
                  快捷键：Enter 提交 · 正确后按 空格 进入下一句
                </div>
              </>
            )}
          </div>
        )}

        {/* ===== ③ 精读纠错 ===== */}
        {step === 'correct' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 13, color: '#888' }}>第 {curIdx + 1} 句 / 共 {sentences.length} 句</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn sm" onClick={() => { if (curIdx > 0) { setCurIdx(curIdx - 1); setActiveIdx(-1) } }}>上一句</button>
                <button className="btn sm" onClick={() => { if (curIdx < sentences.length - 1) { setCurIdx(curIdx + 1); setActiveIdx(-1) } }}>下一句</button>
              </div>
            </div>
            {!cur ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>请先「生成字幕」再精读</div>
            ) : (
              <>
                <div style={{ padding: 16, background: '#fafafa', borderRadius: 10, border: '1px solid #eee', fontSize: 18, lineHeight: 1.8, fontWeight: 500, color: '#18181b' }}>
                  {renderSub(cur.russian)}
                </div>
                {cur.chinese && (
                  <div style={{ padding: '8px 4px', fontSize: 14, color: '#888' }}>{cur.chinese}</div>
                )}
                <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                  <button className="btn sm primary" onClick={runAI} disabled={analyzing}>{analyzing ? '解析中…' : '✨ AI 解析'}</button>
                  <button className="btn sm" onClick={() => playSeg(curIdx, { loop: true })}>🔁 循环本句</button>
                </div>
                {aiHtml && (
                  <div style={{ marginTop: 10, padding: 14, background: '#f8f8fb', borderRadius: 10, border: '1px solid #eee', fontSize: 14, lineHeight: 1.7, textAlign: 'left' }} dangerouslySetInnerHTML={{ __html: aiHtml }} />
                )}
                <div style={{ textAlign: 'center', fontSize: 12, color: '#bbb', marginTop: 12 }}>提示：鼠标悬停字幕中的单词可查看释义 · 空格播放/暂停 · ←→ 切换句子</div>
              </>
            )}
          </div>
        )}

        {/* ===== ④ 跟读 ===== */}
        {step === 'recite' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <button className={'btn sm' + (reciteMode === 'segment' ? ' primary' : '')} onClick={() => setReciteMode('segment')}>分段跟读</button>
              <button className={'btn sm' + (reciteMode === 'full' ? ' primary' : '')} onClick={() => setReciteMode('full')}>整篇跟读</button>
            </div>

            {reciteMode === 'segment' ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 13, color: '#888' }}>第 {curIdx + 1} 句 / 共 {sentences.length} 句</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn sm" onClick={() => { if (curIdx > 0) { setCurIdx(curIdx - 1); setActiveIdx(-1) } }}>上一句</button>
                    <button className="btn sm" onClick={() => { if (curIdx < sentences.length - 1) { setCurIdx(curIdx + 1); setActiveIdx(-1) } }}>下一句</button>
                  </div>
                </div>
                {!cur ? (
                  <div style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>请先「生成字幕」再跟读</div>
                ) : (
                  <>
                    <div style={{ padding: 16, background: '#fafafa', borderRadius: 10, border: '1px solid #eee', fontSize: 18, lineHeight: 1.8, fontWeight: 500 }}>
                      {renderSub(cur.russian)}
                    </div>
                    <div style={{ marginTop: 10, display: 'flex', gap: 8, justifyContent: 'center' }}>
                      <button className="btn primary" onClick={() => playSeg(curIdx, { loop: true, times: 3 })}>🔁 循环跟读</button>
                      <button className="btn" onClick={() => playSeg(curIdx, { loop: false })}>听一次</button>
                    </div>
                    <div style={{ marginTop: 12, padding: 12, background: '#fafafa', borderRadius: 10, border: '1px solid #eee' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>🎤 本句跟读录音</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {!recording ? (
                          <button className="btn sm primary" onClick={() => startRec(curIdx)}>开始录音</button>
                        ) : (
                          <button className="btn sm" onClick={stopRec} style={{ background: '#dc2626', color: '#fff', borderColor: '#dc2626' }}>停止录音（录当前句）</button>
                        )}
                        {myAudioUrl && !recording && (
                          <>
                            <audio src={myAudioUrl} controls style={{ height: 34, maxWidth: 240 }} />
                            <button className="btn sm primary" onClick={runScore} disabled={scoring}>{scoring ? '评分中…' : 'AI 评测本句'}</button>
                          </>
                        )}
                      </div>
                      {renderScore()}
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 13, color: '#888' }}>整篇连播 · 字幕跟随高亮 · 空格 播放/暂停</div>
                </div>
                <div style={{ padding: 16, background: '#fafafa', borderRadius: 10, border: '1px solid #eee', fontSize: 17, lineHeight: 2 }}>
                  {sentences.map((s, i) => (
                    <div
                      key={s.id ?? i}
                      onClick={() => { setCurIdx(i); playSeg(i, { loop: false }) }}
                      style={{
                        padding: '4px 8px', borderRadius: 8, cursor: 'pointer',
                        background: i === activeIdx ? 'rgba(109,40,217,0.12)' : 'transparent',
                        borderLeft: i === activeIdx ? '3px solid #6d28d9' : '3px solid transparent',
                        transition: 'background .2s',
                      }}
                    >
                      <span style={{ color: i === activeIdx ? '#6d28d9' : '#9ca3af', fontSize: 12, marginRight: 8 }}>{i + 1}</span>
                      {renderSub(s.russian)}
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 12, padding: 12, background: '#fafafa', borderRadius: 10, border: '1px solid #eee' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>🎤 整篇跟读录音</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {!recording ? (
                      <button className="btn sm primary" onClick={() => startRec(-1)}>开始录音（整篇）</button>
                    ) : (
                      <button className="btn sm" onClick={stopRec} style={{ background: '#dc2626', color: '#fff', borderColor: '#dc2626' }}>停止录音</button>
                    )}
                    {myAudioUrl && !recording && (
                      <>
                        <audio src={myAudioUrl} controls style={{ height: 34, maxWidth: 240 }} />
                        <button className="btn sm primary" onClick={runScore} disabled={scoring}>{scoring ? '评分中…' : 'AI 评测整篇'}</button>
                      </>
                    )}
                  </div>
                  {renderScore()}
                </div>
              </>
            )}
          </div>
        )}

        {/* ===== ⑤ 口语评测 ===== */}
        {step === 'speaking' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <button className={'btn sm' + (recordingIdx < 0 && !recording ? ' primary' : '')} onClick={() => { setRecordingIdx(-1); setScoreResult(null) }}>整篇评测</button>
              <button className={'btn sm' + (recordingIdx >= 0 && !recording ? ' primary' : '')} onClick={() => { setRecordingIdx(0); setScoreResult(null) }}>逐段评测</button>
            </div>

            {recordingIdx >= 0 && !recording && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 13, color: '#888' }}>当前段：第 {recordingIdx + 1} 句 / 共 {sentences.length} 句</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn sm" disabled={recordingIdx === 0} onClick={() => { setRecordingIdx(recordingIdx - 1); setScoreResult(null) }}>上一段</button>
                  <button className="btn sm" disabled={recordingIdx >= sentences.length - 1} onClick={() => { setRecordingIdx(recordingIdx + 1); setScoreResult(null) }}>下一段</button>
                </div>
              </div>
            )}

            {sentences.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>请先「生成字幕」再口语评测</div>
            ) : (
              <>
                {recordingIdx >= 0 && !recording ? (
                  <div style={{ padding: 16, background: '#fafafa', borderRadius: 10, border: '1px solid #eee', fontSize: 18, lineHeight: 1.8, fontWeight: 500 }}>
                    {renderSub(sentences[recordingIdx]?.russian || '')}
                    {sentences[recordingIdx]?.chinese && <div style={{ marginTop: 6, fontSize: 13, color: '#888' }}>{sentences[recordingIdx].chinese}</div>}
                  </div>
                ) : (
                  <div style={{ padding: 16, background: '#fafafa', borderRadius: 10, border: '1px solid #eee', fontSize: 16, lineHeight: 2, maxHeight: 260, overflowY: 'auto' }}>
                    {sentences.map((s, i) => (
                      <div key={s.id ?? i} style={{ padding: '3px 0' }}>
                        <span style={{ color: '#9ca3af', fontSize: 12, marginRight: 8 }}>{i + 1}</span>
                        {renderSub(s.russian)}
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
                  {!recording ? (
                    <button className="btn primary" onClick={() => startRec(recordingIdx)} style={{ background: '#dc2626', borderColor: '#dc2626' }}>
                      🎙️ 开始录音{recordingIdx >= 0 ? '（当前段）' : '（整篇）'}
                    </button>
                  ) : (
                    <button className="btn" onClick={stopRec} style={{ background: '#dc2626', color: '#fff', borderColor: '#dc2626' }}>⏹ 停止录音</button>
                  )}
                  {myAudioUrl && !recording && (
                    <button className="btn primary" onClick={runScore} disabled={scoring}>{scoring ? '评分中…' : '✨ AI 打分'}</button>
                  )}
                </div>
                {myAudioUrl && !recording && (
                  <div style={{ marginTop: 10, textAlign: 'center' }}>
                    <audio src={myAudioUrl} controls style={{ height: 36, width: '100%', maxWidth: 480 }} />
                  </div>
                )}
                {renderScore()}
                <div style={{ textAlign: 'center', fontSize: 12, color: '#bbb', marginTop: 12 }}>
                  评测后可将你的口语与原文逐词对比，AI 按实际录音数据打分 · 空格可播放原文
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ===== 模式选择弹窗（手柄标签点击弹出） ===== */}
      {modeOpen && (
        <ModePickerModal
          title={video.title || '本课'}
          modes={VIDEO_MODES}
          onClose={() => setModeOpen(false)}
          onStart={(m) => switchMode(m.key)}
        />
      )}

      {/* 生词弹窗 */}
      {popWord && <WordPop word={popWord.word} x={popWord.x} y={popWord.y} onClose={() => setPopWord(null)} />}
    </div>
  )
}
