import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useCourseStore } from '../store/courseStore'
import { useSquareStore } from '../store/squareStore'
import { useSessionStore } from '../store/sessionStore'
import { useShangStore, STAGES } from '../store/shangStore'
import { useVocabStore } from '../store/vocabStore'
import SentenceBox from '../components/SentenceBox'
import FullTextPanel from '../components/FullTextPanel'
import WordPop from '../components/WordPop'
import { explainSentence, reciteCompare } from '../lib/ai'
import { getVideoPlay, createPlayer } from '../lib/videoPlayer'
import { toast } from '../lib/toast'
import { mdToHtml } from '../lib/md'
import AITutor from '../components/AITutor'
import AIQuiz from '../components/AIQuiz'

// 5 个阶段提示文案
const STAGE_HINTS = {
 [STAGES.LISTEN]: '阶段 1 · 整体盲听：反复听完整篇素材，视频与字幕已隐藏，目标是感受整体语境主旨。',
 [STAGES.DICTATE]: '阶段 2 · 逐句盲听听写（核心）：单句循环播放，字幕已隐藏；把听到的敲入输入框，听不出可点「跳过」。',
 [STAGES.CORRECT]: '阶段 3 · 对照精读纠错：现在显示原文。逐句对比自己的听写文本，查生词、语法、连读弱读差异。',
 [STAGES.RECITE]: '阶段 4 · 跟读模仿训练：原文已显示，单句循环，影子跟读，模仿重音、语调与语速。',
 [STAGES.RECITE_OUT]: '阶段 5 · 脱稿背诵输出（最重要）：再次隐藏全部字幕，听一句复述一句，语速尽量对齐原声。',
}
const STAGE_LABELS = {
 [STAGES.LISTEN]: '阶段1 整体盲听',
 [STAGES.DICTATE]: '阶段2 逐句盲听听写',
 [STAGES.CORRECT]: '阶段3 对照精读纠错',
 [STAGES.RECITE]: '阶段4 影子跟读',
 [STAGES.RECITE_OUT]: '阶段5 脱稿背诵输出',
}
const SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0]

// 普通学习 · 传统三阶段（与尚雯婕五阶段区分）
const TRAD_STAGES = [
  {
    key: 'vocab',
    label: '积累词汇',
    hint: '阶段1 · 积累词汇 + 基础语法：背单词（俄↔中释义、拼写、词性），学习基础语法（时态、变格、句型、单复数），做练习巩固。目标：看得懂简单短句，能拼凑简单句子。',
  },
  {
    key: 'input',
    label: '输入训练',
    hint: '阶段2 · 输入训练 — 阅读 + 听力：阅读全文、逐句翻译、查生词、分析句子语法；听素材录音，反复听、逐句回放、听写句子。习惯：遇到不懂就查词典、标记生词。',
  },
  {
    key: 'output',
    label: '输出训练',
    hint: '阶段3 · 输出训练 — 写作 + 口语：用本篇词汇造句、写短文，写完对照参考答案改错；口语朗读课文、背诵对话、模仿跟读。条件有限就以朗读背诵为主。',
  },
]

export default function Study() {
 const { videoId } = useParams()
 const navigate = useNavigate()
 const [searchParams, setSearchParams] = useSearchParams()
 // 从 URL 携带 mode=shang 参数进入
 const shangMode = searchParams.get('mode') === 'shang'

 const courseVideo = useCourseStore(s =>s.getVideo(videoId))
 const squareVideo = useSquareStore(s =>s.getItem(videoId))
 const video = courseVideo || squareVideo
 // 提前声明：供下方 useEffect 依赖数组引用，避免 TDZ
 const play = getVideoPlay(video?.videoUrl)
 const [videoError, setVideoError] = useState(null)
 const pushRecent = useCourseStore(s =>s.pushRecent)
 const progress = useCourseStore(s =>s.progress[videoId])
 const submitVideo = useCourseStore(s =>s.submitVideo)
 const fetchServer = useSquareStore(s =>s.fetchServer)
 const settings = useSettingsStoreCompat()

 const { curIdx, stage, revealed, setIdx, setStage, toggleRevealed } = useSessionStore()
 const open = useSessionStore(s =>s.open)
 const shang = useShangStore()
 const shangState = shang.load(videoId) || { stage: STAGES.LISTEN, dictations: {}, reciteOk: {}, finished: false }
 const shangWenjieStage = shangState.stage
 const shangDictations = shangState.dictations || {}
 const shangReciteOk = shangState.reciteOk || {}
 const isShangFinished = !!shangState.finished

 const [playingIdx, setPlayingIdx] = useState(-1)
 const [aiHtml, setAiHtml] = useState('')
 const [showZh, setShowZh] = useState(false)
 const [shangUserInput, setShangUserInput] = useState('')
 const [shangDictResult, setShangDictResult] = useState(null)
 const [speed, setSpeed] = useState(settings?.rate || 1.0)
 const [loopMode, setLoopMode] = useState(true)
 const [triedFetch, setTriedFetch] = useState(false)
 const [reciteOk, setReciteOk] = useState({})

 // —— 新增状态 ——
 const [dictateVideoShown, setDictateVideoShown] = useState(false)
 const [showFullText, setShowFullText] = useState(false)
 const [fullTextTitle, setFullTextTitle] = useState('全文对照')
 const [activeSentenceIdx, setActiveSentenceIdx] = useState(-1)
 // 阶段5 录音背诵
 const [isRecording, setIsRecording] = useState(false)
 const [reciteAudioUrl, setReciteAudioUrl] = useState(null)
 const [reciteBlob, setReciteBlob] = useState(null)
 const [reciteResult, setReciteResult] = useState(null)
 const [reciteAnalyzing, setReciteAnalyzing] = useState(false)
 const [showReciteCompare, setShowReciteCompare] = useState(false)
 const [reciteCompareIdx, setReciteCompareIdx] = useState(-1)
 // AI 助教 & AI 测验
 const [showTutor, setShowTutor] = useState(false)
 const [showQuiz, setShowQuiz] = useState(false)
 const [quizPrompt, setQuizPrompt] = useState(false)
 // 普通模式 · 阶段3 写作批改 + 生词弹窗
 const [writeText, setWriteText] = useState('')
 const [writeResult, setWriteResult] = useState('')
 const [writeChecking, setWriteChecking] = useState(false)
 const [popWord, setPopWord] = useState(null)

 // 视频元素引用 + 播放器句柄
 const videoRef = useRef(null)
 const iframeRef = useRef(null)
 const pRef = useRef(null)
 const [playerReady, setPlayerReady] = useState(false)

 // 录音相关 ref
 const mediaRecorderRef = useRef(null)
 const recordChunksRef = useRef([])
 const recordStreamRef = useRef(null)
 const reciteAudioRef = useRef(null)

 // 直接访问 /square/:id（或刷新）时，先把服务端素材拉下来再判断是否存在
 useEffect(() =>{
 if (video) { setTriedFetch(true); return }
 if (triedFetch) { navigate('/'); return }
 let cancelled = false
 fetchServer().finally(() =>{ if (!cancelled) setTriedFetch(true) })
 return () =>{ cancelled = true }
 }, [video, videoId, triedFetch, fetchServer, navigate])

 useEffect(() =>{
 if (!video) return
 setAiHtml('')
 setShangUserInput('')
 setShangDictResult(null)
 if (shangMode) {
 // 进入尚雯婕模式：初始化进度
 shang.init(videoId)
 // 强制设置当前句到第 0 句
 useSessionStore.getState().setIdx(0)
 } else {
 open(videoId)
 pushRecent(videoId)
 const saved = progress?.lastIndex
 if (saved != null) {
 const i = video.sentences.findIndex(s =>s.id === saved)
 if (i >= 0) setIdx(i)
 }
 }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [videoId, shangMode])

 // 阶段切换时重置当前句 + 听写视频显示状态
 useEffect(() =>{
 if (shangMode) {
 setShangUserInput('')
 setShangDictResult(null)
 setDictateVideoShown(false)
 useSessionStore.getState().setIdx(0)
 setPlayingIdx(-1)
 setActiveSentenceIdx(-1)
 }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [shangWenjieStage])

 // 建立播放器句柄（direct 用<video>精确控制；iframe 尽力控制）
 useEffect(() =>{
 if (!play) { setPlayerReady(true); return }
 const p = createPlayer(play, videoRef.current)
 if (p.type !== 'direct') p.setIframe(iframeRef.current)
 p.onError = (code, msg) =>setVideoError(msg)
 pRef.current = p
 setPlayerReady(true)
 return () =>{
 if (pRef.current) { pRef.current.pause(); pRef.current.stopLoop() }
 }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [play?.src, play?.type])

 // 切换素材/视频时清空播放错误
 useEffect(() =>{
 setVideoError(null)
 }, [play?.src])

 // 二级兜底：如果上面的 effect 因 videoRef 时序问题未创建播放器，延迟重试
 useEffect(() =>{
 if (!play || pRef.current) return
 const timer = setTimeout(() =>{
 if (pRef.current) return
 if (play.type === 'direct' && videoRef.current) {
 const p = createPlayer(play, videoRef.current)
 p.onError = (code, msg) =>setVideoError(msg)
 pRef.current = p
 setPlayerReady(true)
 } else if (play.type !== 'direct' && iframeRef.current) {
 const p = createPlayer(play, null)
 p.onError = (code, msg) =>setVideoError(msg)
 p.setIframe(iframeRef.current)
 pRef.current = p
 setPlayerReady(true)
 }
 }, 100)
 return () =>clearTimeout(timer)
 }, [play, playerReady])

 // 监听视频播放进度，跟踪当前播放句子索引（用于全文对照面板高亮滚动）
 useEffect(() =>{
 if (!playerReady || !play || !video) return
 const sents = video.sentences || []

 const updateIdx = () =>{
 let ct = 0
 let dur = 0
 if (pRef.current) {
 ct = pRef.current.getCurrentTime() || 0
 dur = pRef.current.getDuration() || 0
 } else if (videoRef.current) {
 ct = videoRef.current.currentTime
 dur = videoRef.current.duration || 0
 }
 let found = -1
 // 1. 精确时间戳匹配
 for (let i = 0; i< sents.length; i++) {
 const s = sents[i]
 if (s.start != null && s.end != null && ct >= s.start && ct< s.end) {
 found = i
 break
 }
 }
 // 2. 无时间戳：按视频总时长平均分配估算每句时间范围
 if (found === -1 && dur >0 && isFinite(dur) && sents.length >0) {
 const per = dur / sents.length
 found = Math.min(sents.length - 1, Math.floor(ct / per))
 }
 // 3. 仍找不到：降级为当前选中句
 if (found === -1) found = curIdx
 setActiveSentenceIdx(found)
 }

 // direct 类型：用 timeupdate 事件（更精确）
 if (play.type === 'direct' && videoRef.current) {
 videoRef.current.addEventListener('timeupdate', updateIdx)
 return () =>{
 if (videoRef.current) videoRef.current.removeEventListener('timeupdate', updateIdx)
 }
 }

 // iframe 类型（YouTube/B站）：用 setInterval 轮询当前播放时间
 const timer = setInterval(updateIdx, 500)
 return () =>clearInterval(timer)
 }, [playerReady, play, video, curIdx])

 // 卸载时清理录音 URL
 useEffect(() =>{
 return () =>{
 if (reciteAudioUrl) URL.revokeObjectURL(reciteAudioUrl)
 }
 }, [reciteAudioUrl])

 // 监听尚雯婕训练完成 弹出 AI 测验提示
 useEffect(() =>{
 if (isShangFinished && shangMode) {
 setQuizPrompt(true)
 }
 }, [isShangFinished, shangMode])

 if (!video) return null
 const sentences = (video.sentences || []).map((s, i) =>({
 ...s,
 id: s.id ?? i + 1,
 russian: s.russian ?? s.text ?? '',
 chinese: s.chinese ?? s.tr ?? '',
 }))
 const cur = sentences[curIdx]

 // 无字幕素材：仅展示视频可观看，不做逐句学习
 if (sentences.length === 0) {
 return (
<div className="main">
<div className="col">
<div className="card" style={{ padding: 10 }}>
<div className="video-wrap">
 {play ? (
 play.type === 'direct' ? (
<video
 src={play.src}
 poster={video.posterUrl || video.thumbnail}
 controls
 playsInline
 />
 ) : (
<iframe
 src={play.src}
 title={video.title || '视频'}
 allowFullScreen
 allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
 style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
 />
 )
 ) : (
<img src={video.posterUrl || video.thumbnail} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
 )}
 {videoError && (
<div style={{ position: 'absolute', inset: 0, background: 'rgba(38,30,22,0.88)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#fff', zIndex: 5, textAlign: 'center', padding: 16 }}>
<div style={{ fontSize: 15, fontWeight: 700 }}>⚠️ 视频无法播放</div>
<div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.6 }}>{videoError}</div>
<div style={{ fontSize: 12, opacity: 0.65, lineHeight: 1.5 }}>可能原因：视频被删除、设为私享、禁止嵌入或地区限制。<br />建议更换一个可播放的视频链接（mp4 直链最佳）。</div>
 {video?.videoUrl && (
<a href={video.videoUrl} target="_blank" rel="noreferrer" style={{ marginTop: 8, padding: '9px 20px', background: '#fff', color: '#6E5238', borderRadius: 999, fontSize: 13, fontWeight: 700, textDecoration: 'none', boxShadow: '0 4px 14px rgba(0,0,0,0.25)' }}>在 YouTube 打开查看 →</a>
 )}
<button onClick={() =>setVideoError(null)} style={{ marginTop: 6, background: 'transparent', border: '1px solid rgba(255,255,255,0.5)', color: '#fff', padding: '6px 14px', borderRadius: 999, fontSize: 12, cursor: 'pointer' }}>关闭提示</button>
</div>
 )}
</div>
</div>
</div>
<div className="col">
<div className="card" style={{ padding: 24, textAlign: 'center' }}>
<div style={{ fontSize: 44, marginBottom: 10 }}></div>
<div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>该视频暂无字幕</div>
<p className="hint" style={{ margin: 0 }}>只能观看视频，暂无法逐句学习。</p>
</div>
</div>
</div>
 )
 }

 const go = (d) =>{
 setAiHtml('')
 const n = curIdx + d
 if (n< 0 || n >= sentences.length) return
 setActiveSentenceIdx(-1)
 setIdx(n)
 // 阶段2导航时隐藏视频
 if (shangMode && shangWenjieStage === STAGES.DICTATE) setDictateVideoShown(false)
 }

 // 当前阶段
 const curStage = shangMode ? shangWenjieStage : null
 // 尚雯婕模式：盲听/听写/背诵阶段隐藏视频；普通模式：传统学习法，画面始终可见
 const isHideMedia = shangMode
 ? ([STAGES.LISTEN, STAGES.DICTATE, STAGES.RECITE_OUT].includes(curStage))
 : false

 // 细粒度视频隐藏：阶段2点击检查本句时强制显示视频
 const shouldHideVideo = shangMode
 ? (curStage === STAGES.DICTATE ? !dictateVideoShown : isHideMedia)
 : isHideMedia

 // 确保播放器已创建（兜底：useEffect 可能因时序问题未创建成功）
 const ensurePlayer = useCallback(() =>{
 if (pRef.current || !play) return false
 if (play.type === 'direct' && videoRef.current) {
 const p = createPlayer(play, videoRef.current)
 pRef.current = p
 setPlayerReady(true)
 return true
 }
 if (play.type !== 'direct' && iframeRef.current) {
 const p = createPlayer(play, null)
 p.setIframe(iframeRef.current)
 pRef.current = p
 setPlayerReady(true)
 return true
 }
 return false
 }, [play])

 // 视频控制函数（对齐句子时间点）— 三级兜底：pRef videoRef直控 错误提示
 const playSeg = (loop = true) =>{
 if (!cur) return
 console.log('[Study] playSeg', { loop, curIdx: curIdx, curStart: cur.start, curEnd: cur.end, hasPlayer: !!pRef.current, hasVideoEl: !!videoRef.current, playType: play?.type, videoUrl: video?.videoUrl })
 ensurePlayer()
 const start = cur.start != null ? cur.start : 0
 const end = cur.end != null ? cur.end : (videoRef.current?.duration || 0)
 if (pRef.current) {
 if (loop) pRef.current.playLoop(start, end)
 else pRef.current.playSegment(start, end, false)
 } else if (videoRef.current) {
 // 终极兜底：直接控制 video 元素
 try { if (start >0) videoRef.current.currentTime = start } catch (e) {}
 videoRef.current.play().catch(() =>{ toast('视频播放被浏览器阻止，请点击视频画面播放') })
 } else {
 toast('视频未加载（该素材可能没有视频地址），无法播放')
 }
 setPlayingIdx(curIdx)
 if (shangMode && shangWenjieStage === STAGES.DICTATE) setDictateVideoShown(false)
 }
 const playFull = () =>{
 ensurePlayer()
 if (pRef.current) {
 pRef.current.playFull()
 } else if (videoRef.current) {
 try { videoRef.current.currentTime = 0 } catch (e) {}
 videoRef.current.play().catch(() =>{ toast('视频播放被浏览器阻止，请点击视频画面播放') })
 } else {
 toast('视频未加载（该素材可能没有视频地址），无法播放')
 }
 setPlayingIdx(-1)
 if (shangMode && shangWenjieStage === STAGES.DICTATE) setDictateVideoShown(false)
 }
 const stopPlay = () =>{
 if (pRef.current) { pRef.current.pause(); pRef.current.stopLoop() }
 if (videoRef.current) { videoRef.current.pause() }
 setPlayingIdx(-1)
 setActiveSentenceIdx(-1)
 }
 const onSpeed = (r) =>{
 setSpeed(r)
 ensurePlayer()
 if (pRef.current) pRef.current.setRate(r)
 else if (videoRef.current) { videoRef.current.playbackRate = r }
 }
 const toggleLoop = () =>{
 setLoopMode(v =>{
 const next = !v
 if (next) playSeg(true)
 else {
 if (pRef.current) { pRef.current.pause(); pRef.current.stopLoop() }
 if (videoRef.current) { videoRef.current.pause() }
 }
 return next
 })
 if (shangMode && shangWenjieStage === STAGES.DICTATE) setDictateVideoShown(false)
 }

 const runAI = async () =>{
 setAiHtml('解析中…')
 try { setAiHtml(mdToHtml(await explainSentence(cur.russian))) }
 catch (e) { setAiHtml(''); toast(e.message) }
 }

 // 听写规范化
 const normDict = s =>(s || '').replace(/[^\wа-яёА-ЯЁ\s]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

 const shangCheckDict = () =>{
 // 阶段2检查本句时显示视频
 if (shangMode && shangWenjieStage === STAGES.DICTATE) setDictateVideoShown(true)
 const target = normDict(cur.russian)
 const input = normDict(shangUserInput)
 const correct = target === input
 setShangDictResult({ correct, target: cur.russian, input })
 shang.setDictation(videoId, cur.id, { text: shangUserInput, ok: correct })
 }

 const shangSkipSentence = () =>{
 shang.setDictation(videoId, cur.id, { text: shangUserInput, skipped: true, ok: false })
 setShangUserInput('')
 setShangDictResult(null)
 setActiveSentenceIdx(-1)
 if (shangMode && shangWenjieStage === STAGES.DICTATE) setDictateVideoShown(false)
 if (curIdx< sentences.length - 1) {
 setIdx(curIdx + 1)
 } else {
 toast('已听完所有句子，请确认完成后进入下一阶段')
 }
 }

 // 听写进度
 const dictProgress = (() =>{
 const done = sentences.filter(s =>{
 const d = shangDictations[s.id]
 return d && (d.ok || d.skipped)
 }).length
 return { done, total: sentences.length }
 })()

 // 跟读完成度
 const reciteProgress = (() =>{
 const done = sentences.filter(s =>shangReciteOk[s.id]).length
 return { done, total: sentences.length }
 })()

 const goShangStage = (target) =>{
 if (shangMode && target >shangWenjieStage + 1) {
 toast('请按顺序完成当前阶段，不能跳跃')
 return
 }
 if (shangMode && shangWenjieStage === STAGES.DICTATE && target >= STAGES.CORRECT) {
 if (dictProgress.done< dictProgress.total) {
 toast(`听写阶段未完成（${dictProgress.done}/${dictProgress.total}）`)
 return
 }
 }
 if (shangMode) { shang.setStage(videoId, target) }
 else {
 // 普通模式：同步到 sessionStore + shangStore，让 curStage 生效
 shang.init(videoId)
 shang.setStage(videoId, target)
 }
 }

 const shangExit = () =>{
 setSearchParams({})
 }

 const shangFinish = () =>{
 shang.finish(videoId)
 toast('尚雯婕训练完成！')
 }

 // —— 阶段5 录音背诵功能 ——
 const startRecording = useCallback(async () =>{
 // 录音前暂停视频播放，避免麦克风录入视频原声
 if (pRef.current) { pRef.current.pause(); pRef.current.stopLoop() }
 try {
 const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
 recordStreamRef.current = stream
 const recorder = new MediaRecorder(stream)
 recordChunksRef.current = []
 recorder.ondataavailable = (e) =>{
 if (e.data && e.data.size >0) recordChunksRef.current.push(e.data)
 }
 recorder.onstop = () =>{
 const blob = new Blob(recordChunksRef.current, { type: 'audio/webm' })
 const url = URL.createObjectURL(blob)
 setReciteBlob(blob)
 setReciteAudioUrl(url)
 setReciteResult(null)
 if (recordStreamRef.current) {
 recordStreamRef.current.getTracks().forEach(t =>t.stop())
 recordStreamRef.current = null
 }
 toast('录音完成，可回放或上传AI分析')
 }
 mediaRecorderRef.current = recorder
 recorder.start()
 setIsRecording(true)
 setReciteResult(null)
 } catch (e) {
 toast('无法访问麦克风：' + e.message)
 }
 }, [])

 const stopRecording = useCallback(() =>{
 if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
 mediaRecorderRef.current.stop()
 }
 setIsRecording(false)
 }, [])

 const runReciteCompare = useCallback(async () =>{
 if (!reciteBlob) { toast('请先录音'); return }
 setReciteAnalyzing(true)
 try {
 const standard = sentences.map(s =>s.russian).join(' ')
 const result = await reciteCompare(reciteBlob, standard)
 setReciteResult(result)
 toast('AI比对完成')
 } catch (e) {
 toast(e.message)
 } finally {
 setReciteAnalyzing(false)
 }
 }, [reciteBlob, sentences])

 // 打开全文对照面板
 const openFullText = (title) =>{
 setFullTextTitle(title || '全文对照')
 setShowFullText(true)
 }

 // —— 普通模式 · 阶段1 生词提取（去重、去标点、忽略单字母）——
 const vocabWords = (() =>{
 const seen = {}
 for (const s of sentences) {
 const ws = (s.russian || '').toLowerCase().match(/[а-яё]+/gi) || []
 for (const w of ws) {
 const clean = w.replace(/[́̀̈̆]/g, '')
 if (clean.length < 2) continue
 seen[clean] = (seen[clean] || 0) + 1
 }
 }
 return Object.entries(seen).sort((a, b) =>b[1] - a[1]).map(([w, c]) =>({ w, c }))
 })()

 const addAllVocab = () =>{
 const cards = useVocabStore.getState().cards
 let n = 0
 for (const { w } of vocabWords) {
 const exists = cards.some(c =>(c.lemma || c.word || '').toLowerCase() === w)
 if (exists) continue
 useVocabStore.getState().add({ word: w, chinese: '', source: '素材:' + (video?.title || videoId) })
 n++
 }
 toast(n ? `已加入 ${n} 个生词到生词本` : '这些生词已全部在生词本中')
 }

 // —— 普通模式 · 阶段3 写作批改（复用 AI 语法解析接口）——
 const runWriteCheck = async () =>{
 if (!writeText.trim()) { toast('先写一句俄语再批改'); return }
 setWriteChecking(true)
 try { setWriteResult(mdToHtml(await explainSentence(writeText.trim()))) }
 catch (e) { setWriteResult(''); toast(e.message) }
 finally { setWriteChecking(false) }
 }

 // 录音比对面板：音频播放时按平均时长高亮句子
 const onReciteAudioTimeUpdate = () =>{
 const audio = reciteAudioRef.current
 if (!audio || !audio.duration || !isFinite(audio.duration)) return
 const perSentence = audio.duration / sentences.length
 if (perSentence<= 0) return
 const idx = Math.min(sentences.length - 1, Math.floor(audio.currentTime / perSentence))
 setReciteCompareIdx(idx)
 }

 // 错误类型颜色映射
 const errorColor = (type) =>{
 switch (type) {
 case 'misread': return '#C0392B'
 case 'omitted': return '#E67E22'
 case 'extra': return '#2980B9'
 case 'word_order': return '#8E44AD'
 default: return '#7F8C8D'
 }
 }
 const errorLabel = (type) =>{
 switch (type) {
 case 'misread': return '读错'
 case 'omitted': return '漏读'
 case 'extra': return '多读'
 case 'word_order': return '语序错误'
 default: return type
 }
 }

 // ========== 渲染 ==========
 return (
<div className="main">
<div className="col">
<div className="card" style={{ padding: 10 }}>
<div className={'video-wrap' + (shouldHideVideo ? ' hidden-video' : '')}>
 {play ? (
 play.type === 'direct' ? (
<video
 ref={videoRef}
 src={play.src}
 poster={video.posterUrl || video.thumbnail}
 controls
 playsInline
 style={shouldHideVideo ? { visibility: 'hidden' } : {}}
 />
 ) : (
<iframe
 ref={iframeRef}
 src={play.src}
 title={video.title || '视频'}
 allowFullScreen
 allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
 style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, visibility: shouldHideVideo ? 'hidden' : 'visible' }}
 />
 )
 ) : (
<img src={video.posterUrl || video.thumbnail} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
 )}
 {videoError && (
<div style={{ position: 'absolute', inset: 0, background: 'rgba(38,30,22,0.88)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#fff', zIndex: 5, textAlign: 'center', padding: 16 }}>
<div style={{ fontSize: 15, fontWeight: 700 }}>⚠️ 视频无法播放</div>
<div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.6 }}>{videoError}</div>
<div style={{ fontSize: 12, opacity: 0.65, lineHeight: 1.5 }}>可能原因：视频被删除、设为私享、禁止嵌入或地区限制。<br />建议更换一个可播放的视频链接（mp4 直链最佳）。</div>
 {video?.videoUrl && (
<a href={video.videoUrl} target="_blank" rel="noreferrer" style={{ marginTop: 8, padding: '9px 20px', background: '#fff', color: '#6E5238', borderRadius: 999, fontSize: 13, fontWeight: 700, textDecoration: 'none', boxShadow: '0 4px 14px rgba(0,0,0,0.25)' }}>在 YouTube 打开查看 →</a>
 )}
<button onClick={() =>setVideoError(null)} style={{ marginTop: 6, background: 'transparent', border: '1px solid rgba(255,255,255,0.5)', color: '#fff', padding: '6px 14px', borderRadius: 999, fontSize: 12, cursor: 'pointer' }}>关闭提示</button>
</div>
 )}
</div>
</div>
 {!play && (
<div className="card" style={{ padding: '10px 14px', background: '#FDF2E9', border: '1px solid #E8C9A0', color: '#A86454', fontSize: 13, lineHeight: 1.6 }}>
 该素材没有视频地址（videoUrl），按钮无法控制视频播放。请在「自定义素材」中填写 mp4 视频链接后重新学习。
</div>
 )}
 {!(shangMode && (curStage === STAGES.LISTEN || curStage === STAGES.DICTATE)) && (
<div className="card" style={{ padding: '18px 20px', textAlign: 'center' }}>
  {(() => {
    const displayIdx = activeSentenceIdx >= 0 ? activeSentenceIdx : curIdx
    const displaySentence = sentences[displayIdx]
    return (
      <div key={displayIdx} style={{ animation: 'sentenceFadeIn 0.3s ease' }}>
        <div className="ru" style={{ fontSize: 19, fontWeight: 600, color: 'var(--text)', lineHeight: 1.6, marginBottom: 6 }}>
          {displaySentence?.text || '—'}
        </div>
        {displaySentence?.tr && (
          <div style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.5 }}>
            {displaySentence.tr}
          </div>
        )}
      </div>
    )
  })()}
</div>
 )}
</div>

<div className="col">
<div className="card">
 {/* 顶部模式条：普通 / 尚雯婕 */}
<div className="row" style={{ marginBottom: 10, justifyContent: 'space-between' }}>
<div className="stages">
 {shangMode ? (
<span className="stage active">尚雯婕学习法</span>
 ) : (
<>
<span className="stage" style={{ opacity: 0.65, cursor: 'default', fontWeight: 400 }}>普通学习</span>
 {TRAD_STAGES.map(t =>(
<span key={t.key} className={'stage' + (stage === t.key ? ' active' : '')} onClick={() =>setStage(t.key)}>{t.label}</span>
 ))}
</>
 )}
</div>
 {shangMode ? (
<button className="btn sm" onClick={shangExit}>切回普通模式</button>
 ) : (
<button
 className="btn sm"
 onClick={() =>{
 if (!sentences || sentences.length === 0) {
 toast('该素材缺少分句字幕，无法使用尚雯婕学习法')
 return
 }
 shang.init(videoId)
 setSearchParams({ mode: 'shang' })
 }}
 >尚雯婕学习法</button>
 )}
</div>

 {/* 尚雯婕五阶段切换条（仅尚雯婕模式） */}
 {shangMode && (
<div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
 {[1, 2, 3, 4, 5].map(s =>(
<button
 key={s}
 className={'btn sm' + (curStage === s ? ' primary' : '')}
 disabled={s >shangWenjieStage + 1}
 onClick={() =>goShangStage(s)}
 style={{ flex: '1 1 auto', minWidth: 100 }}
 >
 {STAGE_LABELS[s]}
</button>
 ))}
</div>
 )}
<div className="shang-hint" style={{ padding: '8px 10px', background: 'var(--soft, #F5F0E8)', border: '1px solid var(--border2, #E0D6C4)', borderRadius: 6, fontSize: 12, lineHeight: 1.55, marginBottom: 10 }}>
 {shangMode
 ? (<>{STAGE_HINTS[curStage]}{isShangFinished &&<span style={{ marginLeft: 8, color: '#5C8A6B', fontWeight: 600 }}>训练完成</span>}</>)
 : (TRAD_STAGES.find(t =>t.key === stage)?.hint)}
</div>

 {/* 句子展示：按阶段决定是否显示俄文 */}
 {shangMode ? (
<>
 {shangWenjieStage === STAGES.LISTEN && (
<div style={{ padding: 20, textAlign: 'center' }}>
<div style={{ fontSize: 50, marginBottom: 10 }}></div>
<div className="ru-large" style={{ opacity: 0.2 }}>俄文字幕已隐藏</div>
<div className="zh-medium" style={{ marginTop: 6 }}>整体盲听 · 感受语境主旨</div>
<div className="hint" style={{ marginTop: 8 }}>本素材共 {sentences.length} 句，请反复听完整篇</div>
<div style={{ marginTop: 12 }}>
 {playingIdx === -1 ? (
<button className="btn primary" onClick={playFull}>整篇连播</button>
 ) : (
<button className="btn" onClick={stopPlay}>停止</button>
 )}
</div>
</div>
 )}

 {shangWenjieStage === STAGES.DICTATE && (
<>
<div className="ru-large" style={{ opacity: 0.2 }}>俄文字幕已隐藏</div>
<div className="hint" style={{ margin: '8px 0' }}>第 {curIdx + 1} 句 / 共 {sentences.length} 句 — 听写进度 {dictProgress.done}/{dictProgress.total}</div>
<input
 className="qfill"
 value={shangUserInput}
 onChange={e =>setShangUserInput(e.target.value)}
 placeholder="在这里输入你听到的俄语..."
 />
<div style={{ marginTop: 8 }}>
<button className="btn primary" onClick={shangCheckDict}>检查本句</button>
<button className="btn primary" onClick={() =>playSeg(true)} style={{ marginLeft: 8 }}>再听本句</button>
<button className="btn primary" onClick={shangSkipSentence} style={{ marginLeft: 8 }}>跳过本句</button>
</div>
 {shangDictResult && (
<div className={'result ' + (shangDictResult.correct ? 'ok' : 'err')} style={{ marginTop: 8 }}>
 {shangDictResult.correct ? '完全正确！' : '✗ 有错误'}
 {!shangDictResult.correct && (
<div style={{ marginTop: 4 }}>正确答案：{shangDictResult.target}</div>
 )}
</div>
 )}
</>
 )}

 {shangWenjieStage === STAGES.CORRECT && (
<>
<div className="ru-large">{cur.russian}</div>
 {showZh &&<div className="zh-medium" style={{ marginTop: 6 }}>{cur.chinese}</div>}
 {(() =>{
 const d = shangDictations[cur.id]
 if (!d) return null
 return (
<div className="compare-box" style={{ marginTop: 10, padding: 10, background: '#FBF6EC', border: '1px solid var(--border2)', borderRadius: 6 }}>
<div className="hint">你刚才的听写：</div>
<div style={{ marginTop: 4 }}>{d.text ||<span style={{ opacity: 0.5 }}>（已跳过）</span>}</div>
 {d.skipped &&<div className="hint" style={{ marginTop: 4, color: '#A86454' }}>本句为「跳过」状态，请重点精读</div>}
</div>
 )
 })()}
 {aiHtml &&<div className="translation" style={{ marginTop: 8 }} dangerouslySetInnerHTML={{ __html: aiHtml }} />}
<div style={{ marginTop: 8 }}>
<button className="btn sm" onClick={runAI}>AI 解析</button>
<button className="btn sm" onClick={() =>setShowZh(v =>!v)} style={{ marginLeft: 6 }}>{showZh ? '隐藏中译' : '显示中译'}</button>
<button className="btn sm" onClick={() =>openFullText('全文对照 · 精读纠错')} style={{ marginLeft: 6 }}>全文对照</button>
</div>
</>
 )}

 {shangWenjieStage === STAGES.RECITE && (
<>
 {/* 当前句卡片 */}
<div className="sentence-card">
<span className="sc-seq">第 {curIdx + 1} 句 / 共 {sentences.length} 句</span>
<div className="sc-ru">{cur.russian}</div>
 {showZh &&<div className="sc-zh">{cur.chinese}</div>}
<div className="sc-divider" />
</div>

 {/* 训练操作区 */}
<div className="train-card" style={{ marginTop: 12 }}>
<div className="tc-title">影子跟读训练</div>
<div style={{ textAlign: 'center', marginBottom: 12 }}>
<span className="act-hint">听 → 跟读 → 模仿重音、语速、语调</span>
</div>
<div className="btn-row-main">
<button className="btn primary" onClick={() =>playSeg(true)}>循环本句</button>
<button className="btn primary" onClick={() =>playSeg(false)}>听一次</button>
<button className="btn primary" onClick={() =>{
 openFullText('全文跟读 · 字幕跟随')
 ensurePlayer()
 if (pRef.current) {
 if (videoRef.current) { try { videoRef.current.currentTime = 0 } catch(e) {} }
 pRef.current.play()
 } else if (videoRef.current) {
 try { videoRef.current.currentTime = 0 } catch(e) {}
 videoRef.current.play().catch(() =>{})
 }
 }}>全文跟读</button>
</div>
<div className="prog-wrap">
<div className="prog-bar"><div className="prog-fill" style={{ width: `${reciteProgress.total ? (reciteProgress.done / reciteProgress.total * 100) : 0}%` }} /></div>
<div className="prog-meta"><span>跟读进度</span><span>{reciteProgress.done} / {reciteProgress.total} 句</span></div>
</div>
<div className="btn-row-self">
<button className="btn sm success" onClick={() =>shang.setReciteOk(videoId, cur.id, true)}>本句跟读流畅</button>
<button className="btn sm" onClick={() =>shang.setReciteOk(videoId, cur.id, false)}>还需要再练</button>
</div>
</div>
</>
 )}

 {shangWenjieStage === STAGES.RECITE_OUT && (
<div style={{ padding: 16, textAlign: 'center' }}>
<div className="ru-large" style={{ opacity: 0.12, fontSize: 22 }}>俄文字幕已隐藏 · 脱稿复述</div>
<div style={{ fontSize: 45, margin: '12px 0' }}></div>
<div className="hint" style={{ marginBottom: 8 }}>第 {curIdx + 1} 句 / 共 {sentences.length} 句 — 复述完成 {reciteProgress.done}/{reciteProgress.total}</div>
<div>
<button className="btn primary" onClick={() =>playSeg(false)}>听一句</button>
<button className="btn primary" onClick={() =>playSeg(true)} style={{ marginLeft: 6 }}>循环一句</button>
</div>
<div className="row" style={{ marginTop: 12, justifyContent: 'center' }}>
<button className="btn sm" onClick={() =>shang.setReciteOk(videoId, cur.id, true)}>已流利复述</button>
<button className="btn sm" onClick={() =>shang.setReciteOk(videoId, cur.id, false)}>还需再练</button>
</div>

 {/* 阶段5 新增：全文背诵 + 录音原文比对 */}
<div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px dashed var(--border2, #E0D6C4)' }}>
<div className="hint" style={{ marginBottom: 8 }}>整篇背诵训练</div>
<div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
 {!isRecording ? (
<button
 className="btn sm primary"
 onClick={startRecording}
 style={{ background: '#C0392B', borderColor: '#C0392B' }}
 >
 全文背诵（开始录音）
</button>
 ) : (
<button
 className="btn sm"
 onClick={stopRecording}
 style={{
 background: '#C0392B',
 color: '#fff',
 borderColor: '#C0392B',
 animation: 'pulse 1s infinite',
 }}
 >
 停止录音
</button>
 )}
<button
 className="btn sm"
 onClick={() =>{
 if (reciteAudioUrl) {
 setShowReciteCompare(true)
 ensurePlayer()
 const firstStart = sentences[0]?.start
 if (pRef.current) {
 if (firstStart != null && videoRef.current) {
 try { videoRef.current.currentTime = firstStart } catch(e) {}
 } else if (videoRef.current) {
 try { videoRef.current.currentTime = 0 } catch(e) {}
 }
 pRef.current.play()
 } else if (videoRef.current) {
 try { videoRef.current.currentTime = firstStart != null ? firstStart : 0 } catch(e) {}
 videoRef.current.play().catch(() =>{})
 }
 } else { toast('请先录音') }
 }}
 >
 录音原文比对
</button>
</div>

 {/* 阶段5 新增：AI测验入口 */}
<div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px dashed var(--border2, #E0D6C4)' }}>
<div className="hint" style={{ marginBottom: 8 }}>掌握程度检验</div>
<div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
<button
 className="btn sm primary"
 onClick={() =>setShowQuiz(true)}
 style={{ background: '#6B8E6B', borderColor: '#6B8E6B' }}
 >
 开始AI测验（30题）
</button>
</div>
<div className="hint" style={{ marginTop: 8, fontSize: 12 }}>
 检验对本篇文章的掌握程度，涵盖语法、翻译、造句等题型
</div>
</div>

 {/* 录音完成后显示回放 + AI分析 */}
 {reciteAudioUrl && !isRecording && (
<div style={{ marginTop: 12, textAlign: 'left' }}>
<div className="hint" style={{ marginBottom: 6 }}>已录制背诵音频</div>
<audio
 ref={reciteAudioRef}
 src={reciteAudioUrl}
 controls
 style={{ width: '100%', marginBottom: 8 }}
 onTimeUpdate={onReciteAudioTimeUpdate}
 />
<div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
<button
 className="btn sm primary"
 onClick={runReciteCompare}
 disabled={reciteAnalyzing}
 >
 {reciteAnalyzing ? 'AI分析中…' : 'AI分析比对'}
</button>
<button className="btn sm" onClick={() =>{ setReciteAudioUrl(null); setReciteBlob(null); setReciteResult(null) }}>
 重新录音
</button>
</div>

 {/* AI比对结果 */}
 {reciteResult && (
<div style={{ marginTop: 12, padding: 12, background: '#FBF6EC', border: '1px solid var(--border2)', borderRadius: 8, textAlign: 'left' }}>
<div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>AI 比对结果</div>
 {reciteResult.user_text && (
<div style={{ marginBottom: 10 }}>
<div className="hint">识别到的背诵内容：</div>
<div style={{ marginTop: 4, fontSize: 14, lineHeight: 1.6, color: '#3D2F22' }}>{reciteResult.user_text}</div>
</div>
 )}
 {reciteResult.errors && reciteResult.errors.length >0 ? (
<div style={{ marginBottom: 10 }}>
<div className="hint" style={{ marginBottom: 6 }}>发现 {reciteResult.errors.length} 处问题：</div>
 {reciteResult.errors.map((err, i) =>(
<div key={i} style={{
 padding: '8px 10px',
 marginBottom: 6,
 borderRadius: 6,
 background: '#fff',
 borderLeft: `3px solid ${errorColor(err.type)}`,
 fontSize: 13,
 lineHeight: 1.5,
 }}>
<div>
<span style={{
 display: 'inline-block',
 padding: '1px 6px',
 borderRadius: 3,
 background: errorColor(err.type),
 color: '#fff',
 fontSize: 11,
 fontWeight: 600,
 marginRight: 6,
 }}>{errorLabel(err.type)}</span>
 {err.type === 'omitted' ? (
<span style={{ textDecoration: 'line-through', color: errorColor(err.type) }}>{err.original}</span>
 ) : (
<span>原文：<strong>{err.original}</strong></span>
 )}
 {err.user && err.type !== 'omitted' && (
<span style={{ marginLeft: 8, color: errorColor(err.type) }}>你读的：{err.user}</span>
 )}
 {err.user && err.type === 'extra' && (
<span style={{ color: errorColor(err.type) }}>多读：{err.user}</span>
 )}
</div>
 {err.suggestion && (
<div style={{ marginTop: 4, color: '#5C8A6B' }}>{err.suggestion}</div>
 )}
 {err.correct_reading && (
<div style={{ marginTop: 2, color: 'var(--muted)', fontSize: 12 }}>正确读法：{err.correct_reading}</div>
 )}
</div>
 ))}
</div>
 ) : (
<div style={{ marginBottom: 10, color: '#5C8A6B', fontWeight: 600 }}>未发现明显错误，背诵很棒！</div>
 )}
 {reciteResult.overall_tip && (
<div style={{ padding: '8px 10px', background: 'var(--soft)', borderRadius: 6, fontSize: 13, lineHeight: 1.6 }}>
<strong>学习提示：</strong>{reciteResult.overall_tip}
</div>
 )}
</div>
 )}
</div>
 )}
</div>

 {isShangFinished &&<div style={{ marginTop: 14, color: '#5C8A6B', fontWeight: 600 }}>本素材尚雯婕训练已完成</div>}
</div>
 )}

 {/* 通用控件：变速、循环、播放、导航 */}
<div className="toolbar" style={{ marginTop: 12 }}>
<button className="btn sm" onClick={() =>go(-1)} disabled={curIdx === 0}>上一句</button>
<span className="tb-sep" />
<button className="btn sm" onClick={() =>playSeg(loopMode)}>播放本句</button>
<button className={'btn sm' + (loopMode ? ' loop-on' : '')} onClick={toggleLoop}>循环</button>
<select className="speed-select" value={speed} onChange={e =>setSpeed(parseFloat(e.target.value))}>
<option value={0.5}>0.5x</option>
<option value={0.75}>0.75x</option>
<option value={1.0}>1.0x</option>
<option value={1.25}>1.25x</option>
<option value={1.5}>1.5x</option>
</select>
<span className="tb-sep" />
<span className="pos">{curIdx + 1} / {sentences.length}</span>
<span className="tb-sep" />
<button className="btn sm" onClick={() =>go(1)} disabled={curIdx === sentences.length - 1}>下一句</button>
</div>

 {/* 阶段切换：上一阶段 / 下一阶段 */}
<div className="stage-nav">
 {curStage >STAGES.LISTEN && (
<button className="btn sm primary" onClick={() =>goShangStage(curStage - 1)}>上一阶段</button>
 )}
 {curStage< STAGES.RECITE_OUT && (
<button
 className="btn sm primary"
 onClick={() =>goShangStage(curStage + 1)}
 >
 {curStage === STAGES.DICTATE && dictProgress.done< dictProgress.total
 ? `下一阶段（先完成 ${dictProgress.done}/${dictProgress.total}）`
 : '进入下一阶段'}
</button>
 )}
 {curStage === STAGES.RECITE_OUT && reciteProgress.done >= reciteProgress.total && !isShangFinished && (
<button className="btn sm primary" onClick={shangFinish}>完成训练</button>
 )}
</div>
</>
 ) : (
<>
 {/* 普通学习 · 传统三阶段 */}
 {stage === 'vocab' && (
<div style={{ marginTop: 12 }}>
 {/* 当前句 + AI 解析 */}
<SentenceBox sentence={cur} revealed={revealed} />
 {showZh &&<div className="translation"><div className="zh-label">中文翻译</div><div>{cur.chinese}</div></div>}
 {aiHtml &&<div className="translation" dangerouslySetInnerHTML={{ __html: aiHtml }} />}

 {/* 本篇生词表 */}
<div className="hint" style={{ margin: '14px 0 6px' }}>
 本篇生词 <b>{vocabWords.length}</b> 个（点击查释义，可加入生词本）
</div>
<div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
 {vocabWords.slice(0, 80).map(({ w, c }) =>(
<span key={w} className="chip" style={{ cursor: 'pointer' }} onClick={(e) =>setPopWord({ word: w, x: e.clientX, y: e.clientY })}>
 {w}<span style={{ opacity: 0.55, marginLeft: 4 }}>{c}</span>
</span>
 ))}
 {vocabWords.length > 80 &&<span className="hint" style={{ alignSelf: 'center' }}>… 等 {vocabWords.length - 80} 个</span>}
</div>
<div className="row" style={{ marginTop: 10, gap: 6 }}>
<button className="btn sm primary" onClick={addAllVocab}>一键加入生词本</button>
<button className="btn sm" onClick={runAI}>AI 语法解析</button>
<button className="btn sm" onClick={() =>openFullText('全文对照 · 阅读精读')}>打开全文</button>
</div>
</div>
 )}

 {stage === 'input' && (
<div style={{ marginTop: 12 }}>
<SentenceBox sentence={cur} revealed={revealed} />
 {showZh &&<div className="translation"><div className="zh-label">中文翻译</div><div>{cur.chinese}</div></div>}
 {aiHtml &&<div className="translation" dangerouslySetInnerHTML={{ __html: aiHtml }} />}
<div className="row" style={{ marginTop: 10, gap: 6 }}>
<button className="btn sm primary" onClick={() =>openFullText('全文对照 · 阅读精读')}>打开全文（逐句查词翻译）</button>
<button className="btn sm" onClick={() =>playSeg(true)}>循环本句</button>
<button className="btn sm" onClick={toggleRevealed}>{revealed ? '隐藏原文' : '显示原文'}</button>
<button className="btn sm" onClick={() =>setShowZh(v =>!v)}>{showZh ? '隐藏中译' : '中译'}</button>
<button className="btn sm" onClick={runAI}>AI 语法解析</button>
</div>
</div>
 )}

 {stage === 'output' && (
<div style={{ marginTop: 12 }}>
 {/* 口语 · 朗读录音 */}
<div style={{ padding: 12, background: 'var(--soft)', borderRadius: 8, marginBottom: 10 }}>
<div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>口语 · 朗读背诵</div>
<div className="hint" style={{ margin: '0 0 8px' }}>朗读本篇素材并录音，与原声比对，检查发音与背诵准确度。</div>
<div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
 {!isRecording ? (
<button className="btn sm primary" onClick={startRecording} style={{ background: '#C0392B', borderColor: '#C0392B' }}>开始录音</button>
 ) : (
<button className="btn sm" onClick={stopRecording} style={{ background: '#C0392B', color: '#fff', borderColor: '#C0392B' }}>停止录音</button>
 )}
<button className="btn sm" onClick={() =>{ if (reciteAudioUrl) setShowReciteCompare(true); else toast('请先录音') }}>原文比对</button>
 {reciteAudioUrl && !isRecording && (
<>
<audio src={reciteAudioUrl} controls style={{ height: 32, flex: 1, minWidth: 160 }} />
<button className="btn sm primary" onClick={runReciteCompare} disabled={reciteAnalyzing}>
 {reciteAnalyzing ? 'AI分析中…' : 'AI分析比对'}
</button>
</>
 )}
</div>
 {reciteResult && (
<div style={{ marginTop: 8, padding: 10, background: '#fff', border: '1px solid var(--border2)', borderRadius: 6, fontSize: 13, lineHeight: 1.6 }}>
 {reciteResult.user_text &&<div><span className="hint">识别内容：</span>{reciteResult.user_text}</div>}
 {reciteResult.errors && reciteResult.errors.length >0 ? (
<div style={{ marginTop: 6, color: '#C0392B' }}>发现 {reciteResult.errors.length} 处问题：读错/漏读/多读等，见比对面板</div>
 ) : (
<div style={{ marginTop: 6, color: '#5C8A6B', fontWeight: 600 }}>未发现明显错误，朗读很棒！</div>
 )}
 {reciteResult.overall_tip &&<div style={{ marginTop: 6 }}>💡 {reciteResult.overall_tip}</div>}
</div>
 )}
</div>

 {/* 写作 · 造句批改 */}
<div style={{ padding: 12, background: 'var(--soft)', borderRadius: 8, marginBottom: 10 }}>
<div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>写作 · 造句练习</div>
<div className="hint" style={{ margin: '0 0 8px' }}>用本篇词汇写一句俄语（造句或短文），AI 批改语法、变格错误，写完对照参考。</div>
<textarea
 className="qfill"
 rows={3}
 value={writeText}
 onChange={e =>setWriteText(e.target.value)}
 placeholder="例如：Я люблю читать книги каждый день."
 style={{ width: '100%' }}
 />
<div style={{ marginTop: 6 }}>
<button className="btn sm primary" onClick={runWriteCheck} disabled={writeChecking}>
 {writeChecking ? '批改中…' : 'AI 批改'}
</button>
</div>
 {writeResult &&<div className="translation" style={{ marginTop: 8 }} dangerouslySetInnerHTML={{ __html: writeResult }} />}
</div>

 {/* 掌握程度检验 */}
<div style={{ padding: 12, background: 'var(--soft)', borderRadius: 8 }}>
<div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>掌握程度检验</div>
<div className="hint" style={{ margin: '0 0 8px' }}>完成本篇学习后，开始 AI 测验（语法、翻译、造句等题型）。</div>
<button className="btn sm primary" onClick={() =>setShowQuiz(true)} style={{ background: '#6B8E6B', borderColor: '#6B8E6B' }}>开始AI测验</button>
</div>
</div>
 )}

<div className="nav-arrows" style={{ marginTop: 12 }}>
<button className="btn sm" onClick={() =>go(-1)}>上一句</button>
<span className="pos">{curIdx + 1} / {sentences.length}</span>
<button className="btn sm" onClick={() =>go(1)}>下一句</button>
</div>
</>
 )}
</div>
</div>

<div className="card" style={{ gridColumn: '1/-1' }}>
<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
<div style={{ flex: 1 }}>
<div style={{ fontWeight: 600 }}>课程视频</div>
<div className="hint" style={{ margin: 0 }}>完成听写/跟读后提交评测计算得分</div>
</div>
<button className="btn primary" onClick={() =>{ const s = submitVideo(videoId); navigate('/') }}>提交评测</button>
</div>
</div>

 {/* 全文对照面板（阶段3/阶段4复用） */}
 {showFullText && (
<FullTextPanel
 sentences={sentences}
 onClose={() =>setShowFullText(false)}
 highlightIdx={activeSentenceIdx >= 0 ? activeSentenceIdx : curIdx}
 onSentenceClick={(idx) =>{
 setIdx(idx)
 if (pRef.current && sentences[idx]) {
 pRef.current.playSegment(sentences[idx].start, sentences[idx].end, false)
 }
 }}
 title={fullTextTitle}
 />
 )}

 {/* 录音原文比对面板 */}
 {showReciteCompare && reciteAudioUrl && (
<div
 style={{
 position: 'fixed',
 inset: 0,
 background: 'rgba(60, 45, 30, 0.55)',
 zIndex: 9999,
 display: 'flex',
 alignItems: 'center',
 justifyContent: 'center',
 padding: 20,
 }}
 onClick={() =>setShowReciteCompare(false)}
 >
<div
 onClick={(e) =>e.stopPropagation()}
 style={{
 background: '#FDF8F0',
 borderRadius: 14,
 boxShadow: '0 20px 60px rgba(60,45,30,0.35)',
 width: '100%',
 maxWidth: 820,
 maxHeight: '80vh',
 display: 'flex',
 flexDirection: 'column',
 overflow: 'hidden',
 border: '1px solid var(--border2, #E0D6C4)',
 }}
 >
<div style={{
 display: 'flex',
 alignItems: 'center',
 justifyContent: 'space-between',
 padding: '14px 20px',
 borderBottom: '1px solid var(--border2, #E0D6C4)',
 background: 'var(--soft, #F5F0E8)',
 }}>
<div style={{ fontWeight: 600, fontSize: 16, color: '#5C4A3A' }}>
 录音原文比对
<span style={{ marginLeft: 10, fontSize: 13, color: 'var(--muted)', fontWeight: 400 }}>播放录音时自动高亮对应句子</span>
</div>
<button className="btn sm" onClick={() =>setShowReciteCompare(false)} style={{ fontSize: 12 }}>关闭</button>
</div>

<div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border2)', background: '#FBF6EC' }}>
<div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
<audio
 src={reciteAudioUrl}
 controls
 style={{ flex: 1, minWidth: 200 }}
 onTimeUpdate={onReciteAudioTimeUpdate}
 />
<button className="btn sm" onClick={() =>{ if (pRef.current) pRef.current.playFull() }}>播放原声</button>
</div>
</div>

<div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
 {sentences.map((s, idx) =>{
 const isActive = idx === reciteCompareIdx
 return (
<div
 key={s.id ?? idx}
 style={{
 padding: '8px 14px',
 marginBottom: 6,
 borderRadius: 8,
 background: isActive ? 'rgba(176, 138, 90, 0.18)' : 'transparent',
 borderLeft: isActive ? '3px solid var(--accent, #B08A5A)' : '3px solid transparent',
 transition: 'background 0.2s',
 }}
 >
<div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
<span style={{
 flexShrink: 0,
 width: 24, height: 24, borderRadius: '50%',
 background: isActive ? 'var(--accent)' : 'var(--soft)',
 color: isActive ? '#fff' : 'var(--muted)',
 fontSize: 11, fontWeight: 600,
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 marginTop: 2,
 }}>{idx + 1}</span>
<div style={{ flex: 1 }}>
<div style={{ fontSize: 16, lineHeight: 1.6, color: '#3D2F22' }}>{s.russian}</div>
 {s.chinese &&<div style={{ marginTop: 2, fontSize: 13, color: 'var(--muted)' }}>{s.chinese}</div>}
</div>
</div>
</div>
 )
 })}
</div>
</div>
</div>
 )}

 {/* AI 助教浮动按钮（仅尚雯婕模式） */}
 {shangMode && !showTutor && (
<button
 onClick={() =>setShowTutor(true)}
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
 )}

 {/* AI 助教侧边栏（仅尚雯婕模式） */}
 {shangMode && showTutor && (
<AITutor
 stage={shangWenjieStage}
 curSentence={cur}
 sentences={sentences}
 videoTitle={video?.title || ''}
 />
 )}

 {/* 训练完成 AI 测验提示弹窗 */}
 {quizPrompt && (
<div
 style={{
 position: 'fixed',
 inset: 0,
 background: 'rgba(60, 45, 30, 0.55)',
 zIndex: 10001,
 display: 'flex',
 alignItems: 'center',
 justifyContent: 'center',
 padding: 20,
 }}
 onClick={() =>setQuizPrompt(false)}
 >
<div
 onClick={e =>e.stopPropagation()}
 style={{
 background: '#FFFCF7',
 borderRadius: 16,
 boxShadow: '0 20px 60px rgba(60,45,30,0.35)',
 padding: '28px 32px',
 maxWidth: 420,
 width: '100%',
 textAlign: 'center',
 border: '1px solid var(--border2, #E8E1D9)',
 }}
 >
<div style={{ fontSize: 48, marginBottom: 12 }}></div>
<div style={{ fontSize: 18, fontWeight: 600, color: '#3D332C', marginBottom: 8 }}>
 训练完成！
</div>
<div style={{ fontSize: 14, color: 'var(--muted, #86796D)', marginBottom: 20, lineHeight: 1.6 }}>
 是否开始 AI 测验检验学习成果？<br />
 共 30 道题，涵盖词汇、语法、翻译等。
</div>
<div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
<button className="btn sm" onClick={() =>setQuizPrompt(false)}>稍后再说</button>
<button
 className="btn sm primary"
 onClick={() =>{ setQuizPrompt(false); setShowQuiz(true) }}
 >
 开始测验
</button>
</div>
</div>
</div>
 )}

 {/* AI 测验模态框 */}
 {showQuiz && (
<AIQuiz
 sentences={sentences}
 videoId={videoId}
 videoTitle={video?.title || ''}
 onClose={() =>setShowQuiz(false)}
 />
 )}

 {/* 普通模式 · 生词查义弹窗 */}
 {popWord && (
<WordPop
 word={popWord.word}
 x={popWord.x}
 y={popWord.y}
 onClose={() =>setPopWord(null)}
 />
 )}
</div>
 )
}

// 兼容 settings store 的小工具（settings 可能为空）
function useSettingsStoreCompat() {
 try {
 const { useSettingsStore } = require('../store/settingsStore')
 return useSettingsStore()
 } catch (e) {
 return { settings: { rate: 1.0 } }
 }
}
