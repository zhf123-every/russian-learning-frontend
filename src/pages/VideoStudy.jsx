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
import { thumbUrl } from '../lib/thumb'
import { resolvePlayUrl } from '../lib/playUrl'
import { analyzeSentence, pronunciationScore } from '../lib/ai'
import { useGameVideoStore } from '../store/gameVideoStore'
import { useCourseStore } from '../store/courseStore'
import { useAdminStore } from '../store/adminStore'
import { useSquareStore } from '../store/squareStore'
import { useSettingsStore } from '../store/settingsStore'
import { apiFetch } from '../lib/api'
import { VIDEOS as BUILTIN_VIDEOS } from '../data/gameLibrary'
import { toast } from '../lib/toast'
import WordPop from '../components/WordPop'
import ModePickerModal, { VIDEO_MODES } from '../components/ModePickerModal'
import StudyToolbar, { Icon as StudyIcon } from '../components/quest/StudyToolbar'
import SettingsModal from '../components/SettingsModal'
import FullTextPanel from '../components/FullTextPanel'
import { useQuestionInput } from '../hooks/useQuestionInput'
import QuestionInput from '../components/quest/QuestionInput'
import ShortcutTips from '../components/quest/ShortcutTips'
import WukongAiAssistant from '../components/quest/WukongAiAssistant'
import { sfxKey, playRightSound, playErrorSound } from '../lib/questSounds'
import { ensureDictFull, annotateWords } from '../lib/wordAnnotate'
import { inferRoles } from '../lib/roleRules'

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
  const { settings, save: saveSettings } = useSettingsStore()
  // —— 设置弹窗关联：读「听力/视频/口语」面板配置（rlearn_quest_ui，与 RuQuest 同 key）——
  const loadUiCfg = () => { try { return JSON.parse(localStorage.getItem('rlearn_quest_ui') || '{}') || {} } catch (e) { return {} } }
  const [uiCfg, setUiCfg] = useState(loadUiCfg)
  useEffect(() => { const h = () => setUiCfg(loadUiCfg()); window.addEventListener('storage', h); return () => window.removeEventListener('storage', h) }, [])
  useEffect(() => { const h = () => setIsFs(!!document.fullscreenElement); document.addEventListener('fullscreenchange', h); return () => document.removeEventListener('fullscreenchange', h) }, [])
  const [videoError, setVideoError] = useState('')
  const [transcoding, setTranscoding] = useState(false)
  const [subsModalOpen, setSubsModalOpen] = useState(false) // 粘贴字幕替换弹窗
  const [subsText, setSubsText] = useState('')
  const [aiHtml, setAiHtml] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [popWord, setPopWord] = useState(null)
  const [modeOpen, setModeOpen] = useState(false)
  const [tooltipOn, setTooltipOn] = useState(false)
  const [muted, setMuted] = useState(false)
  const [loopMode, setLoopMode] = useState(false)
  const [showFullText, setShowFullText] = useState(false)
  const [isFs, setIsFs] = useState(false)
  const [coverH, setCoverH] = useState(60)                // 视频遮挡条高度（视频面板 videoCover）
  const [showSettings2, setShowSettings2] = useState(false)
  useEffect(() => { if (searchParams.get('s') === '1') setShowSettings2(true) }, [searchParams])
  const [recording, setRecording] = useState(false)
  const [recordingIdx, setRecordingIdx] = useState(-1)
  const [myAudioUrl, setMyAudioUrl] = useState(null)
  const [myBlob, setMyBlob] = useState(null)
  const [scoreResult, setScoreResult] = useState(null)
  const [scoring, setScoring] = useState(false)

  const [dictDone, setDictDone] = useState({})
  // —— 听写升级：逐词输入槽 + 逐次判定 + 词典标注 + 底部快捷键栏 ——
  const [answerDone, setAnswerDone] = useState(false)   // 当前句答对（显示标注答案面板）
  const [revealed, setRevealed] = useState(false)       // 显示答案（Ctrl+; / 跳过）
  const [listenReveal, setListenReveal] = useState(false) // 盲听：显示本句字幕揭晓
  const [analysis, setAnalysis] = useState(null)        // 当前句词典标注结果
  const [currentErrors, setCurrentErrors] = useState([])
  const autoNextTimer = useRef(null)
  const nextSentenceRef = useRef(null)
  const isComposingRef = useRef(false)
  useEffect(() => {
    const s = () => { isComposingRef.current = true }
    const e = () => { isComposingRef.current = false }
    window.addEventListener('compositionstart', s)
    window.addEventListener('compositionend', e)
    return () => { window.removeEventListener('compositionstart', s); window.removeEventListener('compositionend', e) }
  }, [])

  const inputRef = useRef(null)

  const [reciteMode, setReciteMode] = useState('segment')
  const [activeIdx, setActiveIdx] = useState(-1)

  const rootRef = useRef(null)
  const videoRef = useRef(null)
  const pRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const recordChunksRef = useRef([])
  const streamRef = useRef(null)
  const activeIdxRef = useRef(0)
  const pausedRef = useRef(true)
  pausedRef.current = paused
  const curIdxRef = useRef(0)
  curIdxRef.current = curIdx
  const stepRef = useRef(step)
  stepRef.current = step
  const reciteModeRef = useRef(reciteMode)
  reciteModeRef.current = reciteMode
  const loopModeRef = useRef(loopMode)
  loopModeRef.current = loopMode
  const sentencesRef = useRef([])
  sentencesRef.current = sentences
  const recordingIdxRef = useRef(-1)
  recordingIdxRef.current = recordingIdx

  const cur = sentences[curIdx]

  // 当前句词典标注（异步，答对/显示答案时）
  const analysisNow = (stmt) => {
    ensureDictFull().then(() => {
      const dw = annotateWords(stmt.russian)
      const rw = dw.length ? inferRoles(stmt.russian, dw) : []
      setAnalysis({ words: rw, stress: stmt.stressMarked || '' })
    }).catch(() => {})
  }

  // 逐词输入状态机：前端快速判题（后端 /api/answer/submit 失败自动忽略，不影响本地判定）
  const {
    mode: qMode,
    isJudging: qJudging,
    isFixMode,
    isFixInputMode,
    inputValue,
    userInputWords,
    handleChange: qHandleChange,
    handleInputKeyDown,
    submitAnswer,
    reset: qReset,
    handleSlotClick: qSlotClick,
  } = useQuestionInput({
    answerText: cur?.russian || '',
    statementId: cur?.id != null ? String(cur.id) : '',
    inputRef,
    isComposingRef,
    ignoreCase: uiCfg.ignoreCase !== false,
    onCorrect: () => {
      if (!cur) return
      setDictDone(d => ({ ...d, [cur.id]: true }))
      setCurrentErrors([])
      setAnswerDone(true)
      setRevealed(false)
      setAnalysis(null)
      analysisNow(cur)
      playRightSound()
      clearTimeout(autoNextTimer.current)
      autoNextTimer.current = setTimeout(() => nextSentenceRef.current?.(), 1600)
    },
    onWrong: () => {
      playErrorSound()
      setAnswerDone(false)
      setRevealed(false)
    },
  })
  // 打字音效：输入时播放（音量/开关/风格读声音设置）
  const onDictChange = (e) => { sfxKey(); qHandleChange(e) }

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
            const hit = j.videos.find(x => x.id === videoId && x.title && x.videoUrl)
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

  // 播放失败 → 后台转码为浏览器兼容格式（H.264），完成后自动切换播放
  const startTranscode = async () => {
    if (!video?.videoUrl) return
    setTranscoding(true)
    try {
      const r = await apiFetch('/api/transcode-async', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: video.videoUrl, id: video.id || '' }),
        timeout: 30000,
      })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || '提交转码失败')
      const taskId = j.task_id
      toast('正在后台转码为浏览器兼容格式（约几分钟），完成后自动播放')
      const t0 = Date.now()
      while (Date.now() - t0 < 20 * 60 * 1000) {
        await new Promise(res => setTimeout(res, 6000))
        const s = await apiFetch('/api/transcode-async/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ task_id: taskId }),
          timeout: 30000,
        })
        const sj = await s.json()
        if (sj.status === 'done') {
          if (sj.url) {
            // 持久化：把本地投稿条目的播放地址更新为兼容格式，刷新后不再卡（云端名单由后端转码线程按 id 更新）
            if (video?.videoUrl && video.videoUrl.startsWith('b2://') && sj.url.startsWith('b2://')) {
              try {
                const { useGameVideoStore } = await import('../store/gameVideoStore')
                const st = useGameVideoStore.getState()
                if (st.videos.some(v => v.id === video.id)) st.update(video.id, { videoUrl: sj.url })
              } catch (e) { /* 忽略 */ }
            }
            const newSrc = await resolvePlayUrl(sj.url)
            setPlaySrc(newSrc)
            setVideoError('')
            toast('转码完成，已切换为兼容格式播放')
          }
          return
        }
        if (sj.status === 'error') throw new Error(sj.error || '转码失败')
      }
      throw new Error('转码超过 20 分钟未完成，请稍后重试')
    } catch (e) {
      toast('转码失败：' + (e.message || '请重试'))
    } finally {
      setTranscoding(false)
    }
  }

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

  // 下一句（答对自动 / 右箭头）
  const nextSentence = () => {
    stopPlay()
    setAnswerDone(false); setRevealed(false); setListenReveal(false); setAnalysis(null); setCurrentErrors([])
    if (curIdxRef.current < sentences.length - 1) {
      setCurIdx(curIdxRef.current + 1)
      setActiveIdx(-1)
    } else {
      toast('🎉 全部句子已完成！')
    }
  }
  nextSentenceRef.current = nextSentence
  // 上一句（左箭头）
  const prevSentence = () => {
    stopPlay()
    if (curIdxRef.current > 0) {
      setCurIdx(curIdxRef.current - 1)
      setActiveIdx(-1)
      setAnswerDone(false); setRevealed(false); setListenReveal(false); setAnalysis(null); setCurrentErrors([])
    }
  }

  const setRate = (r) => {
    setSpeed(r)
    if (pRef.current) pRef.current.setRate(r)
    else if (videoRef.current) videoRef.current.playbackRate = r
    saveSettings({ rate: r }) // 同步到设置存储（设置弹窗「播放」面板倍速）
  }
  // 设置弹窗改倍速 -> 播放器实时生效
  useEffect(() => {
    const r = settings.rate || 1.0
    setSpeed(r)
    if (pRef.current) pRef.current.setRate(r)
    else if (videoRef.current) videoRef.current.playbackRate = r
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.rate])

  // ---------- 句乐部式工具栏回调 ----------
  const toggleMute = () => {
    setMuted(m => {
      const next = !m
      if (videoRef.current) videoRef.current.muted = next
      return next
    })
  }
  const toggleLoop = () => { setLoopMode(m => !m) }
  const goFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
      setIsFs(false)
      return
    }
    setIsFs(true) // 点击瞬间立即收起页眉/控制行，不等 fullscreenchange 事件
    const el = rootRef.current
    if (el) el.requestFullscreen().catch(() => { setIsFs(false); toast('全屏失败') })
  }
  const doReset = () => {
    stopPlay()
    setCurIdx(0); setActiveIdx(-1)
    setDictInput(''); setDictResult(null); setDictDone({})
    setScoreResult(null); setMyAudioUrl(null); setMyBlob(null); setAiHtml('')
    toast('已重置进度')
  }
  const jumpTo = (i) => { setCurIdx(i); setActiveIdx(-1) }

  // ---------- 口语评测：自动播放当前段原文（口语面板 speakAutoPlay） ----------
  useEffect(() => {
    if (step === 'speaking' && uiCfg.speakAutoPlay && recordingIdx >= 0 && !recording && sentences[recordingIdx]) {
      playSeg(recordingIdx, { loop: false })
    }
  }, [step, recordingIdx, uiCfg.speakAutoPlay, sentences.length]) // eslint-disable-line

  // ---------- 听写：进入句子自动播放一句（播完自动停，等输入提交） ----------
  useEffect(() => {
    if (step === 'dictate' && sentences.length > 0 && uiCfg.listenSlow !== false) {
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
    if (s[i]) playSeg(i, { loop: loopModeRef.current, times: loopModeRef.current ? 999 : 3 })
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

  // 听写页：进句/切句/修正后自动聚焦输入槽
  useEffect(() => {
    if (step === 'dictate') {
      const t = setTimeout(() => inputRef.current?.focus(), 120)
      return () => clearTimeout(t)
    }
  }, [step, curIdx, answerDone, qMode])

  // 切句/切步骤时清盲听揭晓
  useEffect(() => { setListenReveal(false) }, [step, curIdx])

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

  // 生成字幕（异步任务模式：提交 /api/transcribe-async 后台识别 → 轮询结果）
  // 长视频（1-3 分钟以上）用同步接口会在 12s 默认超时下必然失败，故与投稿弹窗一致走异步任务。
  const genSubs = async () => {
    if (!video?.videoUrl) { toast('该视频没有可用的播放地址（可能是测试残留记录）。请在游戏商城页重新投稿该视频后再试'); return }
    toast('已提交转写任务，正在后台识别俄语语音…（约 1-3 分钟）')
    try {
      const r = await apiFetch('/api/transcribe-async', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: video.videoUrl }),
        timeout: 30000,
      })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || '提交转写任务失败')
      const taskId = j.task_id
      const t0 = Date.now()
      // 轮询最多 10 分钟；长视频下载+识别通常 1-3 分钟
      while (Date.now() - t0 < 10 * 60 * 1000) {
        await new Promise(res => setTimeout(res, 5000))
        const s = await apiFetch('/api/transcribe-async/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ task_id: taskId }),
          timeout: 30000,
        })
        const sj = await s.json()
        if (sj.status === 'done') {
          if (!sj.segments || !sj.segments.length) { toast('未识别到俄语语音（视频可能没有音频轨，或内容不是俄语）'); return }
          const sents = sj.segments.map((seg, i) => ({ id: i + 1, russian: (seg.text || '').trim(), chinese: '', start: seg.start, end: seg.end }))
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
          return
        }
        if (sj.status === 'error') throw new Error(sj.error || '转写失败')
      }
      throw new Error('转写超过 10 分钟未完成，请稍后重试或换更短的视频')
    } catch (e) {
      toast('转写失败：' + (e.message || ''))
    }
  }

  // 粘贴带时间戳的字幕并替换（支持「0:00 + 文本」两行式格式）
  const applySubsText = async () => {
    if (!subsText.trim()) { toast('请先粘贴字幕内容'); return }
    const { parseTimestampLines } = await import('../lib/srt')
    let cues = []
    try { cues = parseTimestampLines(subsText) } catch (e) { /* 解析失败走空 */ }
    if (!cues.length) {
      toast('未识别到「时间戳+文本」格式。请按每两行一组粘贴：0:00 回车 句子文本 回车 0:01 回车 句子文本 …')
      return
    }
    const sents = cues.map((c, i) => ({ id: i + 1, russian: c.text, chinese: '', start: c.start, end: c.end }))
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
    setSubsModalOpen(false)
    toast('已用粘贴的字幕替换（' + sents.length + ' 句），可开始学习')
    // 同步云端名单（管理员登录态）：让所有设备/访客都能看到新字幕。
    // 合并时本机条目优先（videoUrl 为 b2:// 原始形式，写回云端可避免残留签名直链）。
    try {
      const cr = await apiFetch('/api/videos/list', { timeout: 90000 })
      const cj = await cr.json()
      const cloudList = (cj.ok && Array.isArray(cj.videos)) ? cj.videos : []
      const cloudVids = cloudList.filter(v => v.kind !== 'course')
      const cloudCrs = cloudList.filter(v => v.kind === 'course')
      const localVids = useGameVideoStore.getState().videos
      const localVidsArr = Array.isArray(localVids) ? localVids : []
      const seenV = new Set()
      const mergedVideos = [...localVidsArr, ...cloudVids].filter(v => { if (seenV.has(v.id)) return false; seenV.add(v.id); return true })
      // 课程列表云端原样保留（本机课程 store 不含课程数据，不参与合并）
      const mergedAll = [...mergedVideos, ...cloudCrs]
      const authBody = useAdminStore.getState().authBody
      const sr = await apiFetch('/api/videos/sync', {
        method: 'POST',
        timeout: 180000,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authBody({ videos: mergedAll })),
      })
      const sj = await sr.json()
      if (sj.ok) toast('✓ 字幕已同步云端，所有设备可见')
      else toast('字幕已替换到本机；云端同步失败：' + (sj.error || '请稍后重试'))
    } catch (e) {
      toast('字幕已替换到本机；云端同步失败（' + (e.message || '网络异常') + '），稍后可重新粘贴一次即会重试同步')
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
        <button className="btn sm primary" onClick={() => navigate('/unlocked-games')}>回游戏商城</button>
      </div>
    )
  }

  const stepMeta = STEPS.find(s => s.key === step) || STEPS[0]
  const videoPos = uiCfg.videoPos || 'center'          // 视频面板：视频位置（center/side）
  const studyBg = { default: '#fff', warm: '#faf3e7', green: '#eaf4ea' }[uiCfg.bgColor || 'default'] || '#fff'  // 外观面板「练习背景色」
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
    <div ref={rootRef} style={{ height: '100vh', overflowY: 'auto', background: studyBg, display: 'flex', flexDirection: 'column', fontFamily: "'Nunito', 'Segoe UI', sans-serif" }}>
      {/* ===== 句乐部式顶部工具栏（sticky；全屏时收起） ===== */}
      {!isFs && (
        <StudyToolbar
          title={video.title}
          stepLabel={stepMeta.label}
          stepIdx={stepIdx + 1}
          stepTotal={STEPS.length}
          curIdx={curIdx}
          total={sentences.length}
          paused={paused}
          loopMode={loopMode}
          muted={muted}
          speed={speed}
          sentences={sentences}
          videoType={(getVideoPlay(playSrc) || {}).type}
          onBack={() => navigate(-1)}
          onTogglePlay={togglePlay}
          onPrev={() => { if (curIdx > 0) { setCurIdx(curIdx - 1); setActiveIdx(-1) } }}
          onNext={() => { if (curIdx < sentences.length - 1) { setCurIdx(curIdx + 1); setActiveIdx(-1) } }}
          onOpenMode={() => setModeOpen(true)}
          onReset={doReset}
          onSetSpeed={setRate}
          onToggleLoop={toggleLoop}
          onToggleMute={toggleMute}
          onFullscreen={goFullscreen}
          onOpenFullText={() => setShowFullText(true)}
          onJump={jumpTo}
          onSettingsClose={() => setUiCfg(loadUiCfg())}
        />
      )}

      {/* 完整设置弹窗（?s=1 直达 / 齿轮进入） */}
      {showSettings2 && <SettingsModal onClose={() => setShowSettings2(false)} defaultTab={searchParams.get('tab') || '声音'} />}

      {/* 播放控制行（七个分类标签下方，靠右，固定不随滚动；控件包在白色圆角卡片中，对标句乐部；全屏时保持显示） */}
      <div style={{ position: 'sticky', top: 59, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '8px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '6px 8px', boxShadow: '0 1px 3px rgba(0,0,0,.05)' }}>
          <button type="button" onClick={togglePlay} aria-label="播放/暂停" title="播放/暂停（空格）" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: paused === false ? '#f5f3ff' : 'transparent', color: '#555', width: 40, height: 40, borderRadius: 10, cursor: 'pointer', flexShrink: 0 }}>
            {paused ? StudyIcon.play : StudyIcon.pause}
          </button>
          <select
            value={speed}
            onChange={e => setRate(parseFloat(e.target.value))}
            aria-label="倍速"
            style={{ padding: '5px 8px', borderRadius: 8, border: 'none', fontSize: 13, background: 'transparent', color: '#555', cursor: 'pointer', height: 36, flexShrink: 0 }}
          >
            {[0.5, 0.75, 1.0, 1.25, 1.5].map(sp => <option key={sp} value={sp}>{sp}x</option>)}
          </select>
          <button type="button" onClick={toggleLoop} aria-label="循环" title={loopMode ? '循环中（关闭）' : '循环播放（开启）'} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: loopMode ? '#f5f3ff' : 'transparent', color: loopMode ? '#6d28d9' : '#555', width: 40, height: 40, borderRadius: 10, cursor: 'pointer', flexShrink: 0 }}>
            {StudyIcon.repeat}
          </button>
          <button type="button" onClick={toggleMute} aria-label={muted ? '取消静音' : '静音'} title={muted ? '取消静音' : '静音'} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: muted ? '#f5f3ff' : 'transparent', color: muted ? '#6d28d9' : '#555', width: 40, height: 40, borderRadius: 10, cursor: 'pointer', flexShrink: 0 }}>
            {muted ? StudyIcon.volOff : StudyIcon.volOn}
          </button>
        </div>
      </div>

      {/* ===== 视频区（中上） ===== */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: videoPos === 'side' ? 'flex-start' : 'center', padding: '16px 16px 0' }}>
        <div style={{ width: '100%', maxWidth: videoPos === 'center' ? 760 : 560, aspectRatio: '16/9', background: '#000', borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
          {playSrc ? (
            getVideoPlay(playSrc).type === 'direct' ? (
              <video
                ref={videoRef}
                src={playSrc}
                poster={thumbUrl(video.posterUrl || video.thumbnail)}
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
          {uiCfg.videoCover && (
            <div
              style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: coverH, background: 'rgba(24,24,27,0.82)', zIndex: 4, cursor: 'ns-resize', borderTop: '1px solid rgba(255,255,255,0.22)' }}
              onMouseDown={(e) => { e.preventDefault(); const startY = e.clientY; const startH = coverH; const mv = (ev) => { const nh = Math.max(20, Math.min(220, startH + (ev.clientY - startY))); setCoverH(nh) }; const up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up) }; window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up) }}
            >
              <div style={{ position: 'absolute', top: -9, left: '50%', transform: 'translateX(-50%)', fontSize: 11, color: 'rgba(255,255,255,0.65)', background: 'rgba(0,0,0,0.35)', padding: '2px 8px', borderRadius: 999 }}>⤒ 拖拽遮挡字幕</div>
            </div>
          )}
          {videoError && playSrc && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(24,24,27,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#fff', zIndex: 5, textAlign: 'center', padding: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>⚠️ 视频无法播放</div>
              <div style={{ fontSize: 13, opacity: 0.9 }}>{videoError}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 6 }}>
                <button type="button" onClick={startTranscode} disabled={transcoding} style={{ background: '#4C6FFF', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: 999, fontSize: 13, cursor: 'pointer' }}>
                  {transcoding ? '⏳ 转码中（几分钟）…' : '🎞️ 自动转码为兼容格式'}
                </button>
                <button type="button" onClick={() => setVideoError('')} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.5)', color: '#fff', padding: '6px 14px', borderRadius: 999, fontSize: 12, cursor: 'pointer' }}>关闭提示</button>
              </div>
            </div>
          )}
        </div>

        {/* 快捷键提示（播放/暂停由空格控制） */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
          <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>
            {step === 'dictate'
              ? '视频自动播一句停一句 · Enter 提交 · 答对自动进入下一句 · < 回到上一句'
              : '空格 播放/暂停 · ← → 上一句/下一句'}
          </span>
        </div>
      </div>

      {/* ===== 步骤内容区 ===== */}
      <div style={{ flex: 1, maxWidth: 760, width: '100%', margin: '0 auto', padding: '16px 16px 48px' }}>

        {sentences.length === 0 ? (
          <div style={{ padding: 14, background: '#fef3c7', borderRadius: 10, color: '#92400e', fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
            <b>该视频暂无字幕。</b>{' '}
            {step === 'listen' ? '可先盲听整篇（按空格开始）；' : '精读/跟读/口语需要字幕断句：'}
            <button type="button" className="btn sm primary" onClick={genSubs} style={{ fontSize: 12, marginTop: 6 }}>生成字幕</button>
          </div>
        ) : (
          <div style={{ padding: '10px 14px', background: '#f0f9ff', borderRadius: 10, color: '#1e40af', fontSize: 13, lineHeight: 1.6, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <span>本素材已有 <b>{sentences.length} 句字幕</b>{sentences.length > 0 && cur?.russian ? '，可正常学习' : ''}。觉得字幕和视频对不上？</span>
            <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button type="button" className="btn sm" onClick={() => { setSubsText(''); setSubsModalOpen(true) }} style={{ fontSize: 12 }}>📋 粘贴字幕替换</button>
              <button type="button" className="btn sm" onClick={() => {
                if (window.confirm('重新识别字幕将覆盖当前 ' + sentences.length + ' 句字幕，确定继续？（约 30-60 秒）')) genSubs()
              }} style={{ fontSize: 12 }}>🔄 重新生成字幕</button>
            </span>
          </div>
        )}

        {/* ===== ① 盲听 ===== */}
        {step === 'listen' && (
          <div style={{ textAlign: 'center', paddingTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: '#888' }}>当前第 {curIdx + 1} 句 / 共 {sentences.length} 句</div>
              <div style={{ fontSize: 13, color: '#888' }}>{sentences.length ? '本素材共 ' + sentences.length + ' 句' : '本素材暂无字幕断句'}</div>
            </div>
            {/* 盲听揭晓：Ctrl+; 显示本句字幕 */}
            {listenReveal && cur && (
              <div style={{ maxWidth: 640, margin: '16px auto 92px' }}>
                <div style={{
                  background: 'var(--qs-surface2, #fafafa)', border: '1px solid var(--qs-border, #eee)',
                  borderRadius: 12, padding: '12px 16px', textAlign: 'left',
                }}>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>本句揭晓</div>
                  <div style={{ fontSize: 17, lineHeight: 1.9, fontWeight: 600, color: '#18181b' }}>{cur.russian}</div>
                  {cur.chinese && (
                    <div style={{ fontSize: 13, color: '#666', marginTop: 8, borderTop: '1px dashed #e2e8f0', paddingTop: 8 }}>{cur.chinese}</div>
                  )}
                </div>
              </div>
            )}
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
                <div style={{ padding: '26px 10px 10px', textAlign: 'center' }}>
                  <div style={{ display: 'inline-block', width: '100%', maxWidth: 620 }}>
                    {/* 逐词下划线输入槽（样式继承答题设置：单词长度/固定宽度/极简横线） */}
                    <QuestionInput
                      userInputWords={userInputWords}
                      isJudging={qJudging}
                      mode={qMode}
                      inputRef={inputRef}
                      value={inputValue}
                      onChange={onDictChange}
                      onKeyDown={handleInputKeyDown}
                      onSlotClick={qSlotClick}
                      errors={currentErrors}
                      inputStyle={uiCfg.inputStyle || 'dynamic'}
                      placeholder="输入你听到的俄语…（Enter 提交）"
                    />
                  </div>
                </div>

                {/* 标注答案面板（答对自动展示 / Ctrl+; 显示答案） */}
                {(answerDone || revealed) && (
                  <div style={{ maxWidth: 640, margin: '0 auto 6px' }}>
                    <div style={{
                      background: 'var(--qs-surface2, #fafafa)', border: '1px solid var(--qs-border, #eee)',
                      borderRadius: 12, padding: '12px 16px', textAlign: 'left',
                    }}>
                      <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>
                        {answerDone ? '✓ 完全正确！即将进入下一句' : '标准答案'}
                      </div>
                      {analysis && analysis.words.length > 0 ? (
                        <div style={{ fontSize: 17, lineHeight: 2, letterSpacing: 0.2 }}>
                          {analysis.words.map((w, i) => (
                            <span key={i} style={{ marginRight: 5 }}>
                              <span style={{ color: w.posColor || '#18181b', fontWeight: 600 }}>{w.form}</span>
                              {w.roleLabel && (
                                <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 2, verticalAlign: 'super' }}>{w.roleLabel}</span>
                              )}
                              {' '}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: 15, color: '#444', lineHeight: 1.9 }}>
                          {analysis && analysis.stress ? analysis.stress : cur.russian}
                        </div>
                      )}
                      {cur.chinese && (
                        <div style={{ fontSize: 13, color: '#666', marginTop: 8, borderTop: '1px dashed #e2e8f0', paddingTop: 8 }}>
                          {cur.chinese}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div style={{ textAlign: 'center', fontSize: 12, color: '#bbb', marginTop: 10, marginBottom: 92 }}>
                  {isFixMode || isFixInputMode
                    ? '✗ 有错误词，按任意键开始修正（重新输入正确写法）'
                    : '听一句打一句，Enter 提交 · 答对自动进入下一句'}
                </div>
              </>
            )}
          </div>
        )}

        {/* 底部快捷键栏（中译俄答题页同款：< 上一句 · 快捷键 · > 提交/下一句） */}
        {step === 'dictate' && cur && (
          <ShortcutTips
            mode={answerDone ? 'answer' : 'question'}
            onSubmit={submitAnswer}
            onNext={nextSentence}
            onRetry={() => { qReset(); setAnswerDone(false); setRevealed(false); setAnalysis(null); setCurrentErrors([]) }}
            onPlaySound={() => playSeg(curIdx, { loop: !!uiCfg.loopPlay, times: uiCfg.listenSlowTimes ?? 1 })}
            onShowAnswer={() => { setRevealed(true); setAnswerDone(false); if (cur) analysisNow(cur) }}
            onPrev={prevSentence}
            inputRef={inputRef}
          />
        )}

        {/* 盲听底部快捷键栏：< 上一句 · 播放整篇/下一句/显示本句 · > 下一句 */}
        {step === 'listen' && cur && (
          <ShortcutTips
            mode="question"
            playText="播放整篇"
            enterText="下一句"
            showAnswerText="显示本句"
            onSubmit={nextSentence}
            onNext={nextSentence}
            onPlaySound={playFull}
            onShowAnswer={() => setListenReveal(true)}
            onPrev={prevSentence}
          />
        )}

        {/* ===== ③ 精读纠错 ===== */}
        {step === 'correct' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 13, color: '#888' }}>第 {curIdx + 1} 句 / 共 {sentences.length} 句</div>
            </div>
            {!cur ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>请先「生成字幕」再精读</div>
            ) : (
              <>
                {uiCfg.listenShowEn !== false && (
                  <div style={{ padding: 16, background: '#fafafa', borderRadius: 10, border: '1px solid #eee', fontSize: 18, lineHeight: 1.8, fontWeight: 500, color: '#18181b', textAlign: 'center' }}>
                    {renderSub(cur.russian)}
                  </div>
                )}
                {uiCfg.listenShowZh !== false && cur.chinese && (
                  <div style={{ padding: '8px 4px', fontSize: 14, color: '#888', textAlign: 'center' }}>{cur.chinese}</div>
                )}
                {aiHtml && (
                  <div style={{ marginTop: 10, padding: 14, background: '#f8f8fb', borderRadius: 10, border: '1px solid #eee', fontSize: 14, lineHeight: 1.7, textAlign: 'left' }} dangerouslySetInnerHTML={{ __html: aiHtml }} />
                )}
                <div style={{ height: 92 }} />
              </>
            )}
          </div>
        )}

        {/* 精读底部快捷键栏：< 上一句 · 循环本句/下一句/AI解析 · > 下一句 */}
        {step === 'correct' && cur && (
          <ShortcutTips
            mode="question"
            playText="循环本句"
            enterText="下一句"
            showAnswerText="AI解析"
            onSubmit={nextSentence}
            onNext={nextSentence}
            onPlaySound={() => playSeg(curIdx, { loop: true, times: uiCfg.listenAnsTimes ?? 1 })}
            onShowAnswer={runAI}
            onPrev={prevSentence}
          />
        )}

        {/* 精读页悟空助手（AI 解析逻辑不变；悟空问答预设适配"精读"场景） */}
        {step === 'correct' && cur && (
          <WukongAiAssistant
            statement={{ russian: cur.russian, chinese: cur.chinese }}
            modeLabel="精读"
            presetQuestions={[
              '请对这句话做完整语法解析：动词的时态与变位、名词和形容词的格/数/性，以及句子的句法结构（主干、修饰、语序）。',
              '请逐词讲解这句话，说明每个单词的意思和在句中的作用。',
              '请标出这句话每个单词的重音，并说明朗读时的语调和停顿。',
              '这句话的中文翻译为什么是这样？请解释每个词的对应关系。',
            ]}
            introText="正在精读这一句？有什么问题随时问悟空！"
          />
        )}

        {/* ===== ④ 跟读 ===== */}
        {step === 'recite' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 13, color: '#888' }}>第 {curIdx + 1} 句 / 共 {sentences.length} 句</div>
            </div>
            {!cur ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>请先「生成字幕」再跟读</div>
            ) : (
              <>
                {uiCfg.listenShowEn !== false && (
                  <div style={{ padding: 16, background: '#fafafa', borderRadius: 10, border: '1px solid #eee', fontSize: 18, lineHeight: 1.8, fontWeight: 500, textAlign: 'center' }}>
                    {renderSub(cur.russian)}
                  </div>
                )}
                <div style={{ height: 92 }} />
              </>
            )}
          </div>
        )}

        {/* 跟读底部快捷键栏：< 上一句 · 循环本句/下一句 · > 下一句（跟读页无录音） */}
        {step === 'recite' && cur && (
          <ShortcutTips
            mode="question"
            playText="循环本句"
            enterText="下一句"
            showAnswerText={null}
            onSubmit={nextSentence}
            onNext={nextSentence}
            onPlaySound={() => playSeg(curIdx, { loop: true, times: 3 })}
            onPrev={prevSentence}
          />
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
                    {uiCfg.speakMode !== 'zh' && uiCfg.speakMode !== 'blind' && renderSub(sentences[recordingIdx]?.russian || '')}
                    {uiCfg.speakMode === 'zh' && <div style={{ fontSize: 18, fontWeight: 500 }}>{sentences[recordingIdx]?.chinese || ''}</div>}
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

      {/* 课文全文对照面板（📖 图标） */}
      {showFullText && (
        <FullTextPanel
          title={(video.title || '视频') + ' · 全文对照'}
          sentences={sentences}
          onClose={() => setShowFullText(false)}
        />
      )}

      {/* 粘贴字幕替换弹窗 */}
      {subsModalOpen && (
        <div className="modal-mask" onClick={() => setSubsModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 580, maxHeight: '86vh', overflowY: 'auto' }}>
            <h2>📋 粘贴字幕替换</h2>
            <p className="hint" style={{ fontSize: 12, lineHeight: 1.7 }}>
              支持「时间戳 + 文本」格式（每两行一组），时间戳为 M:SS 或 MM:SS：<br />
              0:00<br />Привет, Аня.<br />0:01<br />Привет, Иван. Как дела?
            </p>
            <textarea
              rows={14}
              value={subsText}
              onChange={e => setSubsText(e.target.value)}
              placeholder={'0:00\nПривет, Аня.\n0:01\nПривет, Иван. Как дела?\n…'}
              style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'Consolas, monospace', fontSize: 13, padding: 8, border: '1px solid #ddd', borderRadius: 8 }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button className="btn sm" onClick={() => setSubsModalOpen(false)}>取消</button>
              <button className="btn sm primary" onClick={applySubsText}>保存替换</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
