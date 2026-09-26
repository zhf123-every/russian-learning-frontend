// 课程详情页（课程类：学习路线 + 大纲）
// /game/:id  —— 课程类（kind=cover）进来；视频类不走这里，直接弹模式弹窗
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { findGameById } from '../data/gameLibrary'
import { COURSES } from '../data/gameMallData'
import { getCourses } from '../utils/storage'
import { useGameCourseStore } from '../store/gameCourseStore'
import { API_BASE, apiFetch } from '../lib/api'
import ModePickerModal, { COURSE_MODES } from '../components/ModePickerModal'
import { getCourseById } from '../utils/courseService'
import { getUnitDoneMap } from '../lib/lessonProgress'
import { usePageHeader } from '../components/layout/PageHeaderContext'
import { toast } from '../lib/toast'

// 难度 / 状态 样式（与 RuQuest 对齐）
const DIFF_META = {
  easy: { label: '简单', color: '#16a34a', bg: '#DCFCE7' },
  medium: { label: '中等', color: '#d97706', bg: '#FEF3C7' },
  hard: { label: '困难', color: '#dc2626', bg: '#FEE2E2' },
}
const STATUS_META = {
  '未开始': { label: '未开始', color: '#9ca3af', bg: '#F3F4F6' },
  '进行中': { label: '进行中', color: '#7c3aed', bg: '#EDE9FE' },
  '已完成': { label: '已完成 ✓', color: '#16a34a', bg: '#DCFCE7' },
}

// 演示课程：没有后端大纲时，生成示例单元（标“演示”）
function makeDemoUnits(game) {
  const total = game.total || game.lessons || 10
  return Array.from({ length: total }, (_, i) => ({
    id: 'demo-' + (game.id) + '-' + (i + 1),
    title: `第 ${i + 1} 课`,
    description: game.title,
    status: i === 0 ? '进行中' : '未开始',
    difficulty: i % 3 === 0 ? 'medium' : 'easy',
    demo: true,
  }))
}

export default function GameDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  // 课程来源：courseService（本地缓存 → 云端 → 本地投稿 → 后台课程），带缓存即时渲染
  const [game, setGame] = useState(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    getCourseById(id)
      .then((c) => { if (alive) setGame(c) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [id])

  const [units, setUnits] = useState([])
  const [loading, setLoading] = useState(true)
  const [isDemo, setIsDemo] = useState(false)
  const [pickedUnit, setPickedUnit] = useState(null)
  const [activeTab, setActiveTab] = useState('大纲') // 句乐部式 Tab：学习路线 / 大纲 / 评价

  // ===== 评价逻辑（localStorage 持久化 rlearn_course_reviews） =====
  const REVIEW_KEY = 'rlearn_course_reviews'
  const [reviews, setReviews] = useState([])
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewText, setReviewText] = useState('')
  const [reviewName, setReviewName] = useState('')

  const loadReviews = () => {
    const all = JSON.parse(localStorage.getItem(REVIEW_KEY) || '{}')
    return all[game?.id] || []
  }
  useEffect(() => { setReviews(loadReviews()) }, [game])

  const submitReview = () => {
    if (!reviewText.trim()) { toast('请写下你的学习感受'); return }
    const all = JSON.parse(localStorage.getItem(REVIEW_KEY) || '{}')
    const list = all[game.id] || []
    list.unshift({ id: 'r_' + Date.now(), name: reviewName.trim() || '我', rating: reviewRating, text: reviewText.trim(), time: Date.now() })
    all[game.id] = list
    localStorage.setItem(REVIEW_KEY, JSON.stringify(all))
    setReviews(list)
    setShowReviewModal(false)
    setReviewText('')
    setReviewName('')
    toast('评价已发布')
  }

  const fmtTime = (t) => {
    const d = new Date(t), diff = Date.now() - t
    if (diff < 3600e3) return '刚刚'
    if (diff < 86400e3) return Math.floor(diff / 3600e3) + ' 小时前'
    if (diff < 7 * 86400e3) return Math.floor(diff / 86400e3) + ' 天前'
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const { setHeaderLeft } = usePageHeader() // 页眉左侧插槽（替换收起按钮）

  useEffect(() => {
    if (!game) { setLoading(false); return }
    const doneMap = getUnitDoneMap()
    // 后台「搭课程序」的真实课时优先展示
    if (Array.isArray(game.units) && game.units.length) {
      setUnits(game.units.map((u, i) => ({ ...u, status: doneMap[u.id] ? '已完成' : (i === 0 ? '进行中' : '未开始'), demo: false })))
      setIsDemo(false)
      setLoading(false)
      return
    }
    // 投稿课程：直接用投稿时填写的关卡大纲（真实内容，不走演示占位）
    if (game.kind === 'course' && Array.isArray(game.lessons) && game.lessons.length) {
      setUnits(game.lessons.map((l, i) => ({ ...l, status: doneMap[l.id] ? '已完成' : (i === 0 ? '进行中' : '未开始'), demo: false })))
      setIsDemo(false)
      setLoading(false)
      return
    }
    if (game.packId) {
      // 本地预览（localhost）走相对路径，由 vite proxy 转发避免跨域；线上 Netlify 用 API_BASE 完整地址
      const isLocal = /^localhost|^127\./.test(location.hostname)
      const base = isLocal ? '' : (API_BASE || '')
      fetch(`${base}/api/course-packs/${game.packId}/units`)
        .then((r) => r.json())
        .then((data) => {
          // 后端返回 {ok, data:{pack, units:[...]}}；兼容直接数组 / {units} / {items}
          const list = (data && data.data && data.data.units) || (data && data.units) || (Array.isArray(data) ? data : [])
          setUnits(list.length ? list : makeDemoUnits(game))
          setIsDemo(!list.length)
          setLoading(false)
        })
        .catch(() => { setUnits(makeDemoUnits(game)); setIsDemo(true); setLoading(false) })
    } else {
      setUnits(makeDemoUnits(game)); setIsDemo(true); setLoading(false)
    }
  }, [game])

  // 页眉左侧：收起侧边栏 → 返回箭头（参照句乐部详情页）
  useEffect(() => {
    setHeaderLeft(
      <button type="button" className="shell-card-back" aria-label="返回" onClick={() => navigate(-1)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
      </button>
    )
    return () => setHeaderLeft(null)
  }, [setHeaderLeft, navigate])

  if (loading && !game) {
    return <div className='db-page'><div className='db-container' style={{ padding: 60, textAlign: 'center' }}><div className='loading loading-spinner text-primary' style={{ width: 40 }} /></div></div>
  }

  if (!game) {
    return (
      <div className="db-page"><div className="db-container" style={{ padding: 60, textAlign: 'center' }}>
        <div style={{ fontSize: 40 }}>🕹️</div>
        <h2>课程不存在或已下线</h2>
        <button className="btn sm primary" onClick={() => navigate('/unlocked-games')}>回商城看看</button>
      </div></div>
    )
  }

  const doneCount = units.filter((u) => u.status === '已完成').length
  const doingCount = units.filter((u) => u.status === '进行中').length
  const progress = units.length ? Math.round((doneCount / units.length) * 100) : 0

  // 弹窗点“开始”：按模式跳对应学习页
  const handleStart = (mode) => {
    const u = pickedUnit
    setPickedUnit(null)
    if (!u) return
    // 投稿课程（无 packId）：自带本课内容（单词 + 渐进例句），走本地学习模式，学习页直接消费 lesson 数据
    const isLocalCourse = !game.packId && Array.isArray(u.sentences) && u.sentences.length > 0
    if (isLocalCourse) {
      try { sessionStorage.setItem('rlearn_local_lesson_' + u.id, JSON.stringify(u)) } catch (e) { /* 忽略 */ }
      if (mode.key === 'chinese_to_english') navigate(`/quest-practice/${u.id}?src=local`)
      else if (mode.key === 'dictation') navigate(`/quest-dictation/${u.id}?src=local`)
      else toast('该模式暂仅支持内置课程包，投稿课程支持「中译俄 / 听写」两种模式')
      return
    }
    // 后台课程课时但没有挂内容 → 提示，不进学习页（避免跳到不存在的后端单元）
    if (!game.packId && !(Array.isArray(u.sentences) && u.sentences.length)) {
      toast('该课时还没有内容：请先在后台上传生词表并生成渐进例句')
      return
    }
    const packQ = game.packId ? `?pack=${game.packId}` : ''
    if (mode.key === 'chinese_to_english') navigate(`/quest-practice/${u.id}${packQ}`)
    else if (mode.key === 'dictation') navigate(`/quest-dictation/${u.id}${packQ}`)
    else if (mode.key === 'speaking') navigate(`/quest/${game.packId || ''}?mode=speaking`)
    else if (mode.key === 'reading') navigate(`/quest/${game.packId || ''}?mode=reading`)
  }

  // 学习路线：抽首尾几个节点展示（完整路线见大纲）
  const routeNodes = units.length > 8 ? [units[0], units[1], units[2], null /* … */, units[units.length - 2], units[units.length - 1]] : units

  // 蛇形路线图参数（对标句乐部：左右交替、纵向每节 116px）
  const routeH = units.length ? 214 + (units.length - 1) * 116 + 64 + 24 : 300
  const routePts = units.map((_, i) => ({ x: i % 2 === 0 ? 20 : 80, y: 246 + i * 116 }))
  const routeFullPath = 'M ' + routePts.map((pt) => `${pt.x} ${pt.y}`).join(' L ')
  const routeProgPts = routePts.slice(0, Math.min(doneCount + 1, routePts.length))
  const routeProgressPath = routeProgPts.length > 1
    ? 'M ' + routeProgPts.map((pt) => `${pt.x} ${pt.y}`).join(' L ')
    : (routeProgPts.length === 1 ? `M ${routeProgPts[0].x} ${routeProgPts[0].y}` : '')

  return (
    <div className="db-page">
      <div className="db-container" style={{}}>

        {/* ===== 顶部 Hero：对标句乐部「我的课程」课程详情卡片 ===== */}
        <div className="mb-5 overflow-hidden rounded-2xl border border-gray-200 bg-white/50 p-6 dark:border-gray-800 dark:bg-gray-900/30">
          <div className="flex flex-col gap-5 md:flex-row md:gap-6">
            {/* 封面 */}
            <div className={`flex h-[135px] w-full flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100 md:w-60 ${typeof game.cover === 'string' && game.cover.startsWith('bg-') ? game.cover : ''}`}>
              {game.posterUrl || game.thumbnail ? (
                <img src={game.posterUrl || game.thumbnail} alt={game.title} className="h-full w-full object-cover" onError={e => { e.currentTarget.style.display = 'none' }} />
              ) : (
                <span className="select-none text-5xl font-black text-purple-700/60">{String(game.title || '课').charAt(0)}</span>
              )}
            </div>
            {/* 右侧 */}
            <div className="min-w-0 flex-1">
              {/* 标题行 + 继续学习 */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-medium text-gray-900 dark:text-white">{game.title}</h1>
                {units.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPickedUnit(units.find((u) => u.status !== '已完成') || units[0])}
                    className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:brightness-110"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4l14 8-14 8z" /></svg>
                    继续学习「第 1 课」
                  </button>
                )}
              </div>
              {/* 徽章行 */}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 dark:border-blue-800/30 dark:bg-blue-900/20 dark:text-blue-400">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                  商城领取
                </span>
                <span className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-xs font-medium text-violet-700 dark:border-violet-800/30 dark:bg-violet-900/20 dark:text-violet-400">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l1.9 5.7L19.5 10l-5.6 1.3L12 17l-1.9-5.7L4.5 10l5.6-1.3z" /></svg>
                  试学中 · 前 {Number(game.freeTrialCount) || 0} 课
                </span>
              </div>
              {/* 描述 */}
              <p className="mt-2 text-gray-500 dark:text-gray-400">{game.subtitle || game.desc || ''}</p>
              {/* 进度条 */}
              <div className="mt-6 space-y-2">
                <div aria-valuemax="100" aria-valuemin="0" aria-valuenow={progress} role="progressbar" className="relative h-1.5 w-full overflow-hidden rounded-full bg-primary/20">
                  <div className="h-full bg-primary transition-all" style={{ width: progress + '%' }} />
                </div>
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>{doneCount}/{units.length} 课程</span>
                  <span>{progress}% 完成</span>
                </div>
              </div>
              {/* 信息行 */}
              <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
                <div className="flex items-center gap-1">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                  <span>学习时长：0 分钟</span>
                </div>
                <div className="flex items-center gap-1">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                  <span>最近学习：—</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== Tab 导航（对标句乐部） ===== */}
        <div className="mb-6 flex gap-8 border-b border-gray-100">
          {['学习路线', '大纲', '评价'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setActiveTab(t)}
              className={`relative cursor-pointer py-4 text-[15px] font-bold transition-colors ${activeTab === t ? 'text-gray-900' : 'text-gray-400 hover:text-gray-700'}`}
            >
              {t}
              {activeTab === t && <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-primary" />}
            </button>
          ))}
        </div>

        {activeTab === '学习路线' && (
        <>
        {/* ===== 学习路线（句乐部式蛇形路线图） ===== */}
        <div className="card" style={{ padding: '16px 12px 20px', borderRadius: 16, marginBottom: 20, overflow: 'hidden' }}>
          <style>{`
            @keyframes rl-breathe { 0%,100% { box-shadow: 0 0 0 0 rgba(109,40,217,0.35) } 50% { box-shadow: 0 0 0 14px rgba(109,40,217,0) } }
          `}</style>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>学习路线</div>
          <div style={{ fontSize: 13.5, color: '#9ca3af', marginBottom: 12 }}>按顺序学习效果最佳，绿色=已完成，紫色=当前，灰色=未解锁</div>
          <div className="relative mx-auto w-full overflow-x-auto">
            <div className="relative mx-auto w-full" style={{ minWidth: 360, height: routeH }}>
              {/* SVG 之字形路径 */}
              <svg className="pointer-events-none absolute inset-0" width="100%" height={routeH} viewBox={`0 0 100 ${routeH}`} preserveAspectRatio="none" fill="none">
                {/* 灰线：完整路径 */}
                <path d={routeFullPath} stroke="#d1d5db" strokeWidth="6" strokeLinecap="round" strokeDasharray="2 12" opacity="0.35" vectorEffect="non-scaling-stroke" />
                {/* 紫线：已走过的进度 */}
                <path d={routeProgressPath} stroke="#7c3aed" strokeWidth="6" strokeLinecap="round" opacity="0.9" vectorEffect="non-scaling-stroke" />
              </svg>
              {/* 起点徽章 */}
              <div className="absolute inset-x-0" style={{ top: 0 }}>
                <div className="absolute inset-x-0 flex items-center justify-center gap-3 px-8">
                  <span className="h-px max-w-16 flex-1 bg-gradient-to-r from-transparent to-primary/30" />
                  <span className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/[0.08] px-3.5 py-1 text-[14px] font-bold text-primary">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></svg>
                    起点
                  </span>
                  <span className="h-px max-w-16 flex-1 bg-gradient-to-l from-transparent to-primary/30" />
                </div>
              </div>
              {/* 蛇形节点 */}
              {units.map((u, i) => {
                const dm = DIFF_META[u.difficulty] || DIFF_META.easy
                const done = u.status === '已完成'
                const current = u.status === '进行中'
                const nodeLeft = i % 2 === 0 ? '16%' : '76%'
                const nodeTop = 214 + i * 116
                return (
                  <div key={u.id} className="absolute z-10" style={{ left: nodeLeft, top: nodeTop, transform: 'translateX(-50%)' }}>
                    <div className="flex cursor-pointer flex-col items-center" onClick={() => setPickedUnit(u)}>
                      <div
                        className={`relative flex items-center justify-center rounded-full border-2 transition-colors ${done ? 'border-green-500 bg-green-500 text-white' : current ? 'border-primary bg-primary/10 text-primary' : 'border-gray-300 bg-gray-50 text-gray-400 hover:border-gray-400'}`}
                        style={{ width: 64, height: 64, animation: current ? 'rl-breathe 2s ease-in-out infinite' : undefined }}
                      >
                        {done ? (
                          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                        ) : (
                          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 8 6 6" /><path d="m4 14 6-6 2-3" /><path d="M2 5h12" /><path d="M7 2h1" /><path d="m22 22-5-10-5 10" /><path d="M14 18h6" /></svg>
                        )}
                        {/* 当前节点呼吸光圈 */}
                        {current && <span className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-primary/40" />}
                      </div>
                      <div className="mt-1.5 max-w-[110px] truncate text-[11px] font-medium text-gray-500">{dm.label}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        </>
        )}

        {activeTab === '大纲' && (
        <>
        {/* ===== 大纲 ===== */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>课程大纲</div>
          {isDemo && <span style={{ fontSize: 11.5, color: '#b45309', background: '#FEF3C7', borderRadius: 6, padding: '3px 10px' }}>示例大纲 · 演示</span>}
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>加载大纲…</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 14, marginBottom: 40 }}>
            {units.map((u, i) => {
              const dm = DIFF_META[u.difficulty] || DIFF_META.easy
              const sm = STATUS_META[u.status] || STATUS_META['未开始']
              const stats = Array.isArray(u.sentences) && u.sentences.length > 0
                ? (Array.isArray(u.words) ? u.words.length : 0) + ' 词 · ' + u.sentences.length + ' 句'
                : dm.label
              const desc = u.subtitle || u.description || ''
              return (
                <div
                  key={u.id}
                  onClick={() => setPickedUnit(u)}
                  className="relative flex h-full min-h-[150px] cursor-pointer flex-col overflow-hidden rounded-xl border border-gray-200 bg-white p-3 pr-8 transition-all hover:scale-[1.02] hover:bg-gray-100/80 hover:shadow-xl hover:shadow-purple-100/20 sm:p-5 sm:pr-10"
                >
                  {/* 右上角序号 */}
                  <div className="absolute right-2 top-2 z-0 sm:right-3 sm:top-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gray-100 font-mono text-xs text-gray-500 sm:h-8 sm:w-8 sm:text-sm">
                      #{i + 1}
                    </div>
                  </div>
                  {/* 标题 */}
                  <h3 className="line-clamp-1 text-sm font-bold text-gray-900 sm:text-base" title={u.title}>{u.title}</h3>
                  {/* 副标题 */}
                  {desc && (
                    <p className="mt-1 line-clamp-2 text-xs text-gray-500/90 sm:mt-2 sm:text-sm" title={desc}>
                      {desc}
                    </p>
                  )}
                  {/* 底部信息 */}
                  <div className="mt-auto flex items-center gap-3 pt-3 text-[10px] text-gray-500 sm:text-xs">
                    <div className="flex items-center gap-1">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                      {stats}
                    </div>
                    <div className="flex items-center gap-1">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                      <span style={{ color: sm.color, fontWeight: 600 }}>{sm.label}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        </>
        )}

        {activeTab === '评价' && (
          <div className="card" style={{ padding: 20, borderRadius: 16, marginBottom: 40 }}>
            {/* 头部：评分汇总 + 写评价 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {reviews.length > 0 ? (
                  <>
                    <span style={{ fontSize: 34, fontWeight: 800, color: '#111827' }}>{(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)}</span>
                    <div>
                      <div style={{ fontSize: 15, color: '#f59e0b', letterSpacing: 2 }}>
                        {'★'.repeat(Math.round(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length))}{'☆'.repeat(5 - Math.round(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length))}
                      </div>
                      <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{reviews.length} 条评价</div>
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#374151' }}>课程评价</div>
                )}
              </div>
              <button type="button" onClick={() => setShowReviewModal(true)} className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-white transition hover:brightness-110">
                ✏️ 写评价
              </button>
            </div>

            {reviews.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#9ca3af', padding: '26px 0 10px' }}>
                <div style={{ fontSize: 34 }}>💬</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#6b7280', marginTop: 10 }}>暂无评价</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>学习课程后可以来评价</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {reviews.map((r) => (
                  <div key={r.id} style={{ display: 'flex', gap: 12, padding: '14px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#f3e8ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>
                      {String(r.name).charAt(0)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{r.name}</span>
                        <span style={{ fontSize: 12, color: '#f59e0b', letterSpacing: 1 }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                      </div>
                      <div style={{ fontSize: 13.5, color: '#374151', marginTop: 6, lineHeight: 1.6 }}>{r.text}</div>
                      <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>{fmtTime(r.time)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== 练习模式弹窗 ===== */}
      {pickedUnit && (
        <ModePickerModal
          title={pickedUnit.title}
          modes={COURSE_MODES}
          onClose={() => setPickedUnit(null)}
          onStart={handleStart}
        />
      )}

      {/* ===== 写评价弹窗 ===== */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowReviewModal(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-extrabold text-gray-900">评价课程</h3>
            <div style={{ display: 'flex', gap: 6, margin: '14px 0 10px' }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setReviewRating(n)} style={{ fontSize: 28, color: n <= reviewRating ? '#f59e0b' : '#d1d5db', border: 0, background: 'none', cursor: 'pointer', lineHeight: 1 }}>★</button>
              ))}
            </div>
            <input value={reviewName} onChange={(e) => setReviewName(e.target.value)} placeholder="昵称（默认：我）" className="mb-3 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none transition focus:border-primary" />
            <textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="写下你的学习感受…" rows={4} className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none transition focus:border-primary" />
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => setShowReviewModal(false)} className="flex-1 rounded-full border border-gray-300 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50">取消</button>
              <button type="button" onClick={submitReview} className="flex-1 rounded-full bg-primary py-2.5 text-sm font-bold text-white transition hover:brightness-110">提交评价</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
