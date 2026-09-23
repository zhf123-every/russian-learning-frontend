// 视频学习页（五步独立学习，重做版）
// 路由：/video-study/:videoId?step=listen|dictate|correct|recite|speaking
// 五步：
//   盲听   —— 无字幕，视频整块白屏中上，整篇连播
//   听写   —— 无字幕，视频一句读完自动暂停，底部下划线输入，正确按空格跳下一句
//   精读纠错 —— 视频下方显示字幕，随时暂停，悬停字幕查词，AI 解析同页
//   跟读   —— 分段/整篇跟读，视频下方显示字幕
//   口语评测 —— 逐段/整篇评测，录音后与原文对比，AI 打分
import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { getVideoPlay, createPlayer } from '../lib/videoPlayer'
import { resolvePlayUrl } from '../lib/playUrl'
import { analyzeSentence, pronunciationScore, explainSentence } from '../lib/ai'
import { useGameVideoStore } from '../store/gameVideoStore'
import { useCourseStore } from '../store/courseStore'
import { useSquareStore } from '../store/squareStore'
import { apiFetch } from '../lib/api'
import { toast } from '../lib/toast'
import WordPop from '../components/WordPop'

const STEPS = [
  { key: 'listen', label: '盲听', short: '盲听' },
  { key: 'dictate', label: '听写', short: '听写' },
  { key: 'correct', label: '精读纠错', short: '精读' },
  { key: 'recite', label: '跟读', short: '跟读' },
  { key: 'speaking', label: '口语评测', short: '口语' },
]
const SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5]

// 从视频数据中取字幕句（兼容 russian/text 字段）
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

  // 视频来源：投稿视频（本地 store + 云端）+ 内置课程 + 学习广场素材
  const uploaded = useGameVideoStore(s => s.videos.find(v => v.id === videoId))
  const courseVideo = useCourseStore(s => s.getVideo(videoId))
  const squareVideo = useSquareStore(s => s.getItem(videoId))
  const fetchServer = useSquareStore(s => s.fetchServer)
  const [cloudVideo, setCloudVideo] = useState(null)
  const [video, setVideo] = useState(null)
  const [playSrc, setPlaySrc] = useState('')
  const [sentences, setSentences] = useState([])
  const [loading, setLoading] = useState(true)

  // 通用状态
  const [curIdx, setCurIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  const [speed, setSpeed] = useState(1.0)
  const [videoError, setVideoError] = useState('')
  const [aiHtml, setAiHtml] = useState('')   // 精读 AI 解析结果
  const [analyzing, setAnalyzing] = useState(false)
  const [popWord, setPopWord] = useState(null)
  const [recording, setRecording] = useState(false)
  const [recordingIdx, setRecordingIdx] = useState(-1) // -1 = 整篇
  const [myAudioUrl, setMyAudioUrl] = useState(null)
  const [myBlob, setMyBlob] = useState(null)
  const [scoreResult, setScoreResult] = useState(null)
  const [scoring, setScoring] = useState(false)

  // 听写
  const [dictInput, setDictInput] = useState('')
  const [dictResult, setDictResult] = useState(null) // {correct, target, input}
  const [dictDone, setDictDone] = useState({}) // id -> true

  // 跟读：分段跟读（当前句循环）/ 整篇跟读（连播+字幕高亮）
  const [reciteMode, setReciteMode] = useState('segment') // segment | full

  // refs
  const videoRef = useRef(null)
  const pRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const recordChunksRef = useRef([])
  const streamRef = useRef(null)
  const myAudioRef = useRef(null)
  const activeIdxRef = useRef(0)

  const cur = sentences[curIdx]

  // ---------- 数据加载 ----------
  useEffect(() => {
    let alive = true
    const load = async () => {
      // 1. 本地投稿 / 内置课程 / 学习广场素材
      let v = uploaded || courseVideo || squareVideo
      // 2. 云端投稿名单（可能本地没有，但云端有）
      if (!v) {
        try {
          const r = await apiFetch('/api/videos/list')
          const j = await r.json()
          if (alive && j.ok && Array.isArray(j.videos)) {
            const hit = j.videos.find(x => x.id === videoId)
            if (hit) { setCloudVideo(hit); v = hit }
          }
        } catch (e) { /* 后端不可用 */ }
      }
      // 3. 学习广场服务端素材（square 刷新场景）
      if (!v && !courseVideo && !squareVideo) {
        try { await fetchServer() } catch (e) { /* 忽略 */ }
        const sv = useSquareStore.getState().getItem(videoId)
        if (alive && sv) v = sv
      }
      if (!alive) return
      if (!v) { setLoading(false); return }
      setVideo(v)
      const sents = normSentences(v)
      setSentences(sents)
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

  // 播放当前句片段（end 自动暂停）
  const playSeg = useCallback((idx, { loop = false, times = 3 } = {}) => {
    const s = sentences[idx]
    if (!s || !pRef.current) return
    const start = s.start != null ? s.start : 0
    let end = s.end != null ? s.end : (videoRef.current?.duration || 0)
    if (end <= start || (videoRef.current?.duration && end >= videoRef.current.duration - 0.5)) {
      const wc = (s.russian || '').trim().split(/\s+/).filter(Boolean).length
      end = start + Math.min(12, Math.max(3, wc * 0.7))
    }
    if (loop) { pRef.current.playLoop(start, end, times) }
    else { pRef.current.playSegment(start, end, false) }
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

  // 整篇跟读/精读时：字幕跟随高亮
  const [activeIdx, setActiveIdx] = useState(-1)
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
  // 空格提交：正确 → 下一句并重置输入
  const onKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); checkDict(); return }
    if (e.key === ' ') {
      if (dictResult && dictResult.correct) {
        e.preventDefault()
        setDictInput(''); setDictResult(null)
        if (curIdx < sentences.length - 1) { setCurIdx(curIdx + 1); setActiveIdx(-1) }
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

  // 口语评测：标准文本 = 当前句或全文
  const runScore = async () => {
    if (!myBlob) { toast('请先录音'); return }
    const standard = recordingIdx >= 0
      ? (sentences[recordingIdx]?.russian || '')
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
      if (r.translation) parts.push(`**中文翻译**：${r.translation}`)
      if (r.words && r.words.length) {
        parts.push('**逐词分析**：\n' + r.words.map(w =>
          `- ${w.stressed || w.word || ''}${w.pos ? '（' + w.pos + '）' : ''}${w.mean ? '：' + w.mean : ''}`
        ).join('\n'))
      }
      if (r.components && r.components.length) {
        parts.push('**句子成分**：\n' + r.components.map(c => `- ${c.role}：${c.text}`).join('\n'))
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

  // 悬停查词
  const onWordHover = (e, word) => {
    if (!word || word.length < 2) return
    setPopWord({ word, x: e.clientX, y: e.clientY })
  }

  // 生成字幕（投稿视频无字幕时）
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
      // 回写投稿视频 store
      if (uploaded) {
        const { useGameVideoStore } = await import('../store/gameVideoStore')
        const item = { ...uploaded, sentences: sents }
        const others = useGameVideoStore.getState().videos.filter(x => x.id !== videoId)
        useGameVideoStore.setState({ videos: [item, ...others] })
        try {
          const { loadLS, saveLS } = await import('../lib/persistence')
          saveLS('rlearn_v1_game_videos', [item, ...others])
        } catch (e) { /* 忽略 */ }
      }
      toast('已生成 ' + sents.length + ' 句字幕，可开始学习')
    } catch (e) {
      toast('转写失败：' + (e.message || ''))
    }
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

  // 字幕词高亮渲染（悬停查词）
  const renderSub = (text) => (
    <span>
      {(text || '').split(/(\s+)/).map((w, i) =>
        w.trim() && /^[а-яёА-ЯЁa-zA-Z]+$/.test(w.trim())
          ? <span key={i} onMouseEnter={(e) => onWordHover(e, w.trim())} style={{ cursor: 'pointer' }}>{w}</span>
          : <span key={i}>{w}</span>
      )}
    </span>
  )

  // 口语/跟读结果展示
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
            <div style={{ fontSize: 13, color: '#888' }}>AI 口语评分 {total > 0 ? `· ${okCount}/${total} 词读对` : ''}</div>
            <div style={{ height: 6, background: '#eee', borderRadius: 99, marginTop: 6 }}>
              <div style={{ height: '100%', width: `${Math.min(100, r.score || 0)}%`, background: 'linear-gradient(90deg,#8b5cf6,#6d28d9)', borderRadius: 99 }} />
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
      {/* ===== 顶部白底固定栏 ===== */}
      <div style={{ height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 16px', borderBottom: '1px solid #eee', background: '#fff', gap: 8 }}>
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
        </div>
      </div>

      {/* ===== 视频区（中上）===== */}
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
              {videoError ? `视频无法播放：${videoError}` : '视频加载中…'}
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

        {/* 变速 + 播放控制（共用） */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
          <button className="btn sm" onClick={() => { if (paused && pRef.current) { pRef.current.play(); setPaused(false) } else stopPlay() }}>
            {paused ? '继续' : '暂停'}
          </button>
          <button className="btn sm" onClick={() => playSeg(curIdx, { loop: false })}>播放本句</button>
          {step !== 'speaking' && (
            <button className="btn sm" onClick={playFull}>整篇连播</button>
          )}
          <select value={speed} onChange={e => setRate(parseFloat(e.target.value))} style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, background: '#fff' }}>
            {SPEEDS.map(s => <option key={s} value={s}>{s}x</option>)}
          </select>
        </div>
      </div>

      {/* ===== 步骤内容区 ===== */}
      <div style={{ flex: 1, maxWidth: 760, width: '100%', margin: '0 auto', padding: '16px 16px 60px' }}>

        {/* 无字幕提示（盲听/听写仍可进行；精读/跟读/口语需要字幕） */}
        {sentences.length === 0 && (
          <div style={{ padding: 14, background: '#fef3c7', borderRadius: 10, color: '#92400e', fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
            <b>该视频暂无字幕。</b>{' '}
            {step === 'listen' ? '可先盲听整篇；' : step === 'dictate' ? '听写需要字幕断句，请先生成字幕。' : '精读/跟读/口语需要字幕断句，请先点右上角「生成字幕」。'}
          </div>
        )}

        {/* ===== ① 盲听 ===== */}
        {step === 'listen' && (
          <div style={{ textAlign: 'center', paddingTop: 8 }}>
            <div style={{ fontSize: 14, color: '#9ca3af', marginBottom: 14 }}>反复听完整篇素材 · 感受整体语境主旨 · 无字幕</div>
            <button className="btn primary" onClick={playFull} style={{ padding: '12px 40px', fontSize: 15, borderRadius: 12 }}>▶ 整篇连播</button>
            <div style={{ fontSize: 12, color: '#bbb', marginTop: 10 }}>{sentences.length ? `本素材共 ${sentences.length} 句` : '本素材暂无字幕断句'}</div>
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
                {/* 下划线输入 */}
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
                {/* 结果 */}
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
                {/* 操作按钮 */}
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
                {/* 视频下方字幕（可悬停查词） */}
                <div style={{ padding: 16, background: '#fafafa', borderRadius: 10, border: '1px solid #eee', fontSize: 18, lineHeight: 1.8, fontWeight: 500, color: '#18181b' }}>
                  {renderSub(cur.russian)}
                </div>
                {cur.chinese && (
                  <div style={{ padding: '8px 4px', fontSize: 14, color: '#888' }}>{cur.chinese}</div>
                )}
                {/* AI 解析 */}
                <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                  <button className="btn sm primary" onClick={runAI} disabled={analyzing}>{analyzing ? '解析中…' : '✨ AI 解析'}</button>
                  <button className="btn sm" onClick={() => playSeg(curIdx, { loop: true })}>🔁 循环本句</button>
                </div>
                {aiHtml && (
                  <div style={{ marginTop: 10, padding: 14, background: '#f8f8fb', borderRadius: 10, border: '1px solid #eee', fontSize: 14, lineHeight: 1.7, textAlign: 'left' }} dangerouslySetInnerHTML={{ __html: aiHtml }} />
                )}
                <div style={{ textAlign: 'center', fontSize: 12, color: '#bbb', marginTop: 12 }}>提示：鼠标悬停字幕中的单词可查看释义</div>
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
                            <audio ref={myAudioRef} src={myAudioUrl} controls style={{ height: 34, maxWidth: 240 }} />
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
                {/* 整篇跟读：连播 + 字幕跟随高亮 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 13, color: '#888' }}>整篇连播 · 字幕跟随高亮 · 随时暂停跟读</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn sm" onClick={playFull}>▶ 连播</button>
                    <button className="btn sm" onClick={stopPlay}>暂停</button>
                  </div>
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
                {/* 评测对象：整篇显示全部 / 逐段显示当前句 */}
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

                {/* 录音控制 */}
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
                  评测后可将你的口语与原文逐词对比，AI 按实际录音数据打分
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* 步骤切换条（底部） */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'center', gap: 4, padding: '10px 12px', zIndex: 10 }}>
        {STEPS.map((s, i) => (
          <button
            key={s.key}
            type="button"
            onClick={() => { setSearchParams({ step: s.key }); setCurIdx(0); setDictInput(''); setDictResult(null); setActiveIdx(-1); setScoreResult(null); setMyAudioUrl(null); setMyBlob(null); setAiHtml(''); if (pRef.current) pRef.current.stopLoop() }}
            style={{
              padding: '7px 14px', borderRadius: 99, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              border: '1px solid ' + (step === s.key ? '#6d28d9' : '#e5e7eb'),
              background: step === s.key ? '#6d28d9' : '#fff',
              color: step === s.key ? '#fff' : '#555',
              whiteSpace: 'nowrap',
            }}
          >
            {i + 1} {s.label}
          </button>
        ))}
      </div>

      {/* 生词弹窗 */}
      {popWord && <WordPop word={popWord.word} x={popWord.x} y={popWord.y} onClose={() => setPopWord(null)} />}
    </div>
  )
}
