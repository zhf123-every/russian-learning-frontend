import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { VIDEOS, GUIDES } from '../data/gameLibrary'
import { isCoursePurchased, savePurchase } from '../lib/courseAccess'
import ModePickerModal, { VIDEO_MODES } from '../components/ModePickerModal'
import ContributeModal from '../components/ContributeModal'
import CourseContributeModal from '../components/CourseContributeModal'
import { useGameVideoStore } from '../store/gameVideoStore'
import { useGameCourseStore } from '../store/gameCourseStore'
import { useAdminStore } from '../store/adminStore'
import { toast } from '../lib/toast'
import { usePageHeader } from '../components/layout/PageHeaderContext'
import { apiFetch } from '../lib/api'

// 游戏商城 · 课程包商城（总入口）
// 课程类（kind=cover）：已解锁点卡片 → 课程详情页 /game/:id（学习路线+大纲）
// 视频类（kind=video）：已解锁点卡片 → 直接弹练习模式弹窗（整体盲听/逐段盲听/精听/跟读/口语测评）

// ===== 主分类（对标句乐部 shelf：页眉一层） =====
const CATS = [
  { label: '推荐', cat: 'both' },
  { label: '教材同步', cat: 'guide' },
  { label: '考试备考', cat: 'guide' },
  { label: '少儿俄语', cat: 'guide' },
  { label: '基础俄语', cat: 'guide' },
  { label: '场景俄语', cat: 'guide' },
  { label: '阅读听力', cat: 'guide' },
  { label: '影视俄语', cat: 'video' },
  { label: '音乐俄语', cat: 'video' },
  { label: '全部', cat: 'both' },
]

// ===== 子分类组（对标句乐部 sub：每个主分类专属一组；教材同步组的教材自动生成） =====
const SUBCATS = {
  '推荐': ['全部'],
  '教材同步': ['全部', '走遍俄罗斯', '新概念俄语', '大学俄语', '东方俄语', '黑大俄语', '北外俄语', '人教版初中', '人教版高中', '自编课'],
  '考试备考': ['全部', '中高考', '专四专八', '考研', 'ТРКИ等级', '留学预科', 'CATTI', '职业俄语'],
  '少儿俄语': ['全部', '少儿启蒙', '动画分级', '分级阅读', '动画绘本', '儿歌童谣', '字母拼读', '少儿词汇'],
  '基础俄语': ['全部', '零基础路线', '字母发音', '基础语法', '基础词汇', '核心句型', '经典教材', '综合提升'],
  '场景俄语': ['全部', '日常对话', '商务职场', '外贸商务', '旅游出行', '面试校园', '社交口语', '写作邮件'],
  '阅读听力': ['全部', '短文精读', '俄语故事', '名著简写', '新闻短文', '文化科普', '专业阅读'],
  '影视俄语': ['全部', '情景剧', '影视台词', '电影片段', '动画片段', '经典教材剧'],
  '音乐俄语': ['全部', '俄语歌曲'],
  '全部': ['全部'],
}

// ===== 旧投稿数据映射：旧的"分类"字段 → 新主分类 + 子分类（不丢旧内容） =====
const CAT_MAP = {
  '基础入门': ['基础俄语', '全部'],
  '字母发音': ['基础俄语', '字母发音'],
  '基础语法': ['基础俄语', '基础语法'],
  '基础词汇': ['基础俄语', '基础词汇'],
  '场景对话': ['场景俄语', '日常对话'],
  '场景口语': ['场景俄语', '全部'],
  '语法专练': ['基础俄语', '基础语法'],
  '听力训练': ['阅读听力', '全部'],
  '阅读提升': ['阅读听力', '短文精读'],
  '影视音乐': ['影视俄语', '全部'],
  '考试备考': ['考试备考', '全部'],
}
// 数据 → 主分类：新分类直通；旧内置分类名/旧投稿分类走映射（默认基础入门）
const mapCat = (v) => {
  const key = v.cat || v.category || ''
  if (key && SUBCATS[key]) return key
  if (key) return (CAT_MAP[key] || ['基础俄语', '全部'])[0]
  return '基础俄语'
}
// 数据 → 子分类：新数据直通；旧投稿有教材体系的并入教材同步子分类；其余走映射（默认"全部"）
const mapSub = (v) => {
  if (v.subcat) return v.subcat
  if (v.cat === '教材同步' && v.textbook) return v.textbook
  const key = v.cat || v.category || ''
  return (CAT_MAP[key] || ['基础俄语', '全部'])[1]
}

// ===== 推荐页运营分区（对标句乐部"本周主编精选"等主题分区；items 从数据实时计算） =====
const ZONES = [
  { key: 'z1', title: '本周主编精选', items: (vs, gs) => [...vs, ...gs].slice(0, 5) },
  { key: 'z2', title: '从零开始俄语入门', sub: '基础俄语', items: (vs, gs) => [...vs, ...gs].filter(x => mapCat(x) === '基础俄语') },
  { key: 'z3', title: '备考冲刺专区', sub: '考试备考', items: (vs, gs) => [...vs, ...gs].filter(x => mapCat(x) === '考试备考') },
  { key: 'z4', title: '影视音乐精选', sub: '影视俄语', items: (vs, gs) => [...vs, ...gs].filter(x => mapCat(x) === '影视俄语') },
]
// 学习人数格式化：12345 → 1.2万
const fmtViews = (n) => { const x = n || 0; return x >= 10000 ? (x / 10000).toFixed(1) + '万' : String(x) }

function PlayBadge() {
  return (
    <span className="w-11 h-11 rounded-full bg-white/25 backdrop-blur flex items-center justify-center">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><polygon points="6 4 20 12 6 20 6 4" /></svg>
    </span>
  )
}

function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
  )
}

// 解锁 / 已解锁操作区
function UnlockBar({ game, onVideoStart }) {
  // 投稿课程（kind=course，管理员发布）直接开放学习，无需解锁
  const unlocked = isCoursePurchased(game.id) || game.kind === 'course'
  if (unlocked) {
    // 视频类：卡片点击本身弹弹窗，这里不再放“去学习”
    if (game.kind === 'video') {
      return (
        <div className="mt-2.5 flex items-center">
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            已解锁 · 点卡片选模式
          </span>
        </div>
      )
    }
    // 课程类：去学习 → 课程详情页
    return (
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          已解锁
        </span>
        <Link to={`/course/${game.id}`} className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-0.5">
          去学习 <ChevronRight />
        </Link>
      </div>
    )
  }
  return (
    <div className="mt-2.5">
      <button
        type="button"
        onClick={() => savePurchase(game.id, { kind: 'unlock' })}
        className="w-full h-8 rounded-lg bg-primary text-white text-xs font-bold transition hover:brightness-110 active:scale-[.98]"
      >
        🔓 解锁
      </button>
    </div>
  )
}

export default function GameStore() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('all')
  const [activeCat, setActiveCat] = useState('推荐') // 当前主分类标签
  const [activeSub, setActiveSub] = useState('全部') // 当前子分类标签
  const [activeStage, setActiveStage] = useState('全部') // 当前学段（学历方向：零基础/初中/高中/大学/成人/留学）
  const [activeSource, setActiveSource] = useState('all') // 来源筛选：all=全部 builtin=内置 uploaded=管理员投稿
  const [query, setQuery] = useState('')             // 搜索关键词
  const [menuOpen, setMenuOpen] = useState(false)
  const [, setTick] = useState(0)
  const [videoTarget, setVideoTarget] = useState(null) // 视频类卡片 → 弹窗
  const [showContribute, setShowContribute] = useState(false) // 上传视频弹窗
  const [showCourseContribute, setShowCourseContribute] = useState(false) // 投稿课程弹窗
  const [showAdmin, setShowAdmin] = useState(false) // 管理员登录弹窗
  // 隐藏管理入口：只有 URL 带 ?admin=1（仅你知道）才显示"管理登录"，普通访客看不到任何投稿/管理按钮
  const [isAdminMode, setIsAdminMode] = useState(() => new URLSearchParams(location.search).get('admin') === '1')
  const [adminInput, setAdminInput] = useState('')
  const { setHeaderRight, setTitleOverride } = usePageHeader() // 页眉插槽
  const uploadedVideos = useGameVideoStore(s => s.videos) // 用户投稿的视频（优先展示）
  const uploadedCourses = useGameCourseStore(s => s.courses) // 用户投稿的课程（优先展示）
  const [cloudVideos, setCloudVideos] = useState([]) // 云端共享名单-视频（所有访客可见）
  const [cloudCourses, setCloudCourses] = useState([]) // 云端共享名单-课程（所有访客可见）

  const adminKey = useAdminStore(s => s.adminKey)
  // 云端名单清洗：去掉 dataURL 大字段，保证 sync body 小且干净
  const sanitizeForCloud = (list) => list.map(v => {
    const c = { ...v }
    if (c.thumbnail && String(c.thumbnail).startsWith('data:')) c.thumbnail = ''
    if (c.posterUrl && String(c.posterUrl).startsWith('data:')) c.posterUrl = ''
    return c
  })

  // 页面加载时拉取云端投稿名单，合并展示；若本地有投稿而云端缺失，用管理员密钥自动补同步（所有人可见）
  useEffect(() => {
    let alive = true
    const loadCloud = async () => {
      let cloud = []
      try {
        const r = await apiFetch('/api/videos/list')
        const j = await r.json()
        if (j.ok && Array.isArray(j.videos)) cloud = j.videos
      } catch (e) { /* 后端不可用时仅显示本地 */ }
      if (!alive) return
      setCloudVideos(cloud.filter(v => v && v.title && (v.videoUrl || v.kind === 'course') && v.kind !== 'course'))
      setCloudCourses(cloud.filter(v => v && v.kind === 'course' && v.title))
      // 自动补同步：登录过管理员 且 本地有投稿（视频或课程），云端缺本地记录 → 推本地完整名单上云
      const localVideos = useGameVideoStore.getState().videos
      const localCourses = useGameCourseStore.getState().courses
      const localAll = [...localVideos, ...localCourses]
      if (adminKey && localAll.length) {
        const cloudIds = new Set(cloud.map(v => v.id))
        const localIds = new Set(localAll.map(v => v.id))
        const needSync = localAll.some(v => !cloudIds.has(v.id)) || cloud.some(v => !localIds.has(v.id))
        if (needSync) {
          try {
            // 合并式：云端已有条目保留（尤其云端课程），本地新增补齐——绝不用本机残缺名单覆盖云端
            const seenSync = new Set()
            const mergedAll = [...localAll, ...cloud].filter(v => { if (seenSync.has(v.id)) return false; seenSync.add(v.id); return true })
            const sr = await apiFetch('/api/videos/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ videos: sanitizeForCloud(mergedAll), adminKey })
            })
            const sj = await sr.json()
            if (alive && sj.ok) {
              setCloudVideos(localVideos.filter(v => v && v.title && v.videoUrl))
              setCloudCourses(localCourses.filter(c => c && c.title))
              toast('已将你投稿的视频和课程同步到云端，所有访客可见')
            } else if (alive && !sj.ok) {
              toast('⚠️ 云端同步失败：' + (sj.error || '未知错误') + '。请退出后重新登录管理员再试')
            }
          } catch (e) { if (alive) toast('⚠️ 云端同步异常，请重新登录管理员后再试') }
        }
      }
    }
    loadCloud()
    return () => { alive = false }
  }, [adminKey])
  const adminLogin = useAdminStore(s => s.login)
  const adminLogout = useAdminStore(s => s.logout)

  // 通关视频区 = 云端投稿（前） + 本地投稿（去重） + 内置视频（后）
  const mergedVideos = [...cloudVideos, ...uploadedVideos]
  const seen = new Set()
  const dedup = mergedVideos.filter(v => { if (seen.has(v.id)) return false; seen.add(v.id); return true })
  const allVideos = [...dedup, ...VIDEOS]

  // 分类过滤：推荐/全部 → 全部；其他 → 按新主分类（旧数据走映射）
  const catMatch = (v) => activeCat === '推荐' || activeCat === '全部' || mapCat(v) === activeCat
  // 子分类过滤：每个主分类一组自己的子分类；旧数据走映射
  const subMatch = (v) => activeSub === '全部' || mapSub(v) === activeSub
  // 学段过滤：旧数据（无 stage）一律归"零基础"
  const stageMatch = (v) => activeStage === '全部' || (v.grade || v.stage || '零基础') === activeStage
  // 来源过滤：内置 / 管理员投稿 / 全部
  const isUploaded = (v) => uploadedVideos.some(u => u.id === v.id) || uploadedCourses.some(c => c.id === v.id) || cloudVideos.some(c => c.id === v.id) || cloudCourses.some(c => c.id === v.id)
  const sourceMatch = (v) => activeSource === 'all' || (activeSource === 'uploaded' ? isUploaded(v) : !isUploaded(v))
  const queryMatch = (v) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return ((v.title || '') + ' ' + (v.desc || '') + ' ' + (v.category || v.cat || '')).toLowerCase().includes(q)
  }
  const filteredVideos = allVideos.filter(v => catMatch(v) && subMatch(v) && stageMatch(v) && sourceMatch(v) && queryMatch(v))
  // 通关秘籍区 = 投稿课程（云端+本地去重，前） + 内置秘籍（后）
  const mergedCourses = [...cloudCourses, ...uploadedCourses]
  const cseen = new Set()
  const dedupCourses = mergedCourses.filter(c => { if (cseen.has(c.id)) return false; cseen.add(c.id); return true })
  const allGuides = [...dedupCourses, ...GUIDES]
  const filteredGuides = allGuides.filter(g => catMatch(g) && subMatch(g) && stageMatch(g) && sourceMatch(g) && queryMatch(g))
  // 教材同步组子分类：仅当选中"教材同步"时，从投稿数据里出现过的教材去重自动生成（对标句乐部教材版本动态标签；其他主分类用固定子分类组）
  const allItemsForTextbook = [...allVideos, ...allGuides]
  const dynamicTextbooks = activeCat === '教材同步'
    ? Array.from(new Set(allItemsForTextbook.filter(x => mapCat(x) === '教材同步' && mapSub(x) !== '全部').map(v => mapSub(v))))
    : []
  const baseSubs = SUBCATS[activeCat] || ['全部']
  const subTagsForActive = [...baseSubs, ...dynamicTextbooks.filter(t => !baseSubs.includes(t))]

  // 点「上传视频」：未登录管理员 → 先登录；已登录 → 打开投稿弹窗
  const openContribute = () => {
    if (!adminKey) { if (!isAdminMode) return; setShowAdmin(true); return }
    setShowContribute(true)
  }

  const doAdminLogin = async () => {
    const ok = await adminLogin(adminInput)
    if (ok) { setShowAdmin(false); setAdminInput(''); toast('已进入管理模式'); setShowContribute(true) }
    else { toast('密钥错误') }
  }

  const doAdminLogout = () => {
    adminLogout()
    toast('已退出管理模式')
  }

  // 分类标签（含"全部"）：mode=all 显示全部，否则按当前模式过滤
  const visibleCats = mode === 'all' ? CATS : CATS.filter(c => c.cat === 'both' || c.cat === mode)
  const modeLabel = mode === 'video' ? ' · 通关视频' : mode === 'guide' ? ' · 通关秘籍' : ''

  const pick = (m) => { setMode(m); setMenuOpen(false) }

  const menuItem = (key, icon, label) => (
    <button
      type="button"
      onClick={() => pick(key)}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer transition ${
        mode === key ? 'bg-base-200 font-semibold text-primary' : 'text-gray-700 hover:bg-base-200'
      }`}
    >
      {icon}{label}
    </button>
  )

  // 页眉：标题"游戏商城▾"可点开子菜单（全部内容/通关视频/通关秘籍）；分类标签紧贴标题；搜索框最右
  useEffect(() => {
    setTitleOverride(
      <details open={menuOpen} onToggle={(e) => setMenuOpen(e.currentTarget.open)} className="relative shrink-0 group">
        <summary className="list-none [&::-webkit-details-marker]:hidden flex items-center gap-2 font-bold text-lg text-base-content cursor-pointer select-none whitespace-nowrap">
          游戏商城
          <svg className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
        </summary>
        <div className="absolute left-0 top-full mt-2 w-52 bg-base-100 border border-base-200 rounded-2xl shadow-xl overflow-hidden z-30 py-1.5">
          {menuItem('all',
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><path d="M9 22V12h6v10" /></svg>,
            '全部内容')}
          <div className="h-px bg-base-200 my-1" />
          {menuItem('video',
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" /></svg>,
            '通关视频')}
          {menuItem('guide',
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /></svg>,
            '通关秘籍')}
        </div>
      </details>
    )
    setHeaderRight(
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <nav className="flex-1 flex items-center gap-5 overflow-x-auto no-scrollbar text-[15px] whitespace-nowrap min-w-0">
          {visibleCats.map((c) => (
            <a key={c.label} onClick={() => setActiveCat(c.label)} className={`py-1 transition cursor-pointer ${
              activeCat === c.label
                ? 'relative font-semibold text-primary after:absolute after:left-0 after:right-0 after:-bottom-[1px] after:h-[3px] after:rounded-full after:bg-primary'
                : 'text-gray-500 hover:text-primary'
            }`}>{c.label}</a>
          ))}
        </nav>

        <div className="relative w-64 shrink-0">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-full bg-base-200 text-sm outline-none placeholder:text-gray-400"
            placeholder="搜索视频 / 课程…"
          />
        </div>
      </div>
    )
    return () => { setTitleOverride(null); setHeaderRight(null) }
  }, [mode, menuOpen, activeCat, query, visibleCats, menuItem, setHeaderRight, setTitleOverride])

  useEffect(() => {
    const sync = () => setTick((t) => t + 1)
    window.addEventListener('rlearn:purchase-changed', sync)
    return () => window.removeEventListener('rlearn:purchase-changed', sync)
  }, [])

  // 课程类已解锁 → 进课程大纲页 /course/:id（阶段二：大纲试学）；未解锁 → 不响应点击（只能先解锁）
  const onCoverCardClick = (it) => {
    // 投稿课程（kind=course）直接可学；内置课程需解锁
    if (it.kind === 'course' || isCoursePurchased(it.id)) navigate(`/course/${it.id}`)
  }
  // 视频类已解锁 → 弹练习模式弹窗；投稿视频视为已解锁
  const onVideoCardClick = (v) => {
    const uploaded = uploadedVideos.some(u => u.id === v.id)
    if (uploaded || isCoursePurchased(v.id)) setVideoTarget(v)
  }

  // 视频弹窗“开始”：跳转五步学习页（盲听/听写/精读纠错/跟读/口语评测）
  // 模式 key → step 映射：listen_overall/listen_segment→listen；intensive→dictate；
  // follow→recite；speaking→speaking；其余 fallback listen
  const MODE_TO_STEP = {
    listen_overall: 'listen', listen_segment: 'listen',
    intensive: 'dictate',
    follow: 'recite',
    speaking: 'speaking',
  }
  const onVideoStart = (mode) => {
    const v = videoTarget
    setVideoTarget(null)
    if (!v) return
    const step = MODE_TO_STEP[mode.key] || 'listen'
    navigate(`/video-study/${v.id}?step=${step}`)
  }

  return (
    <div className="min-h-full bg-base-100">

      <main className="px-6 py-7">

        {/* ===== 推荐页：运营主题分区（对标句乐部"本周主编精选/备考冲刺"等） ===== */}
        {activeCat === '推荐' && mode === 'all' ? (
          <div className="space-y-10">
            {ZONES.map(zone => {
              const items = zone.items(allVideos, allGuides)
              if (!items.length) return null
              return (
                <section key={zone.key}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-extrabold">{zone.title}</h2>
                    {zone.sub && (
                      <button
                        type="button"
                        onClick={() => { setActiveCat(zone.sub); setActiveSub('全部') }}
                        className="text-sm text-gray-400 hover:text-primary flex items-center gap-1 cursor-pointer"
                      >
                        {zone.sub} <ChevronRight />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                    {items.map(it => (
                      <div key={it.id} className="group" onClick={() => it.kind === 'video' ? onVideoCardClick(it) : onCoverCardClick(it)} style={{ cursor: 'pointer' }}>
                        <div
                          className={`aspect-video rounded-xl overflow-hidden mb-2 flex items-center justify-center group-hover:shadow-lg transition relative ${
                            it.thumbnail ? '' : `bg-gradient-to-br ${it.cover}`
                          }`}
                          style={it.thumbnail ? { backgroundImage: `url(${it.thumbnail})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                        >
                          {!it.thumbnail && it.kind !== 'video' && (
                            <span className={`font-extrabold text-base ${it.ink}`}>{it.word}</span>
                          )}
                          {!it.thumbnail && it.kind === 'video' && (
                            <span className="w-9 h-9 rounded-full bg-white/25 backdrop-blur flex items-center justify-center">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><polygon points="6 4 20 12 6 20 6 4" /></svg>
                            </span>
                          )}
                          <span className="absolute bottom-1.5 right-2 text-[11px] text-white bg-black/40 rounded px-1.5 py-0.5">{it.eps || (it.kind === 'video' ? '1 集' : '1 关')}</span>
                        </div>
                        <div className="text-sm font-semibold line-clamp-1">{it.title}</div>
                        <div className="text-xs text-gray-400 mt-0.5 truncate">{it.author || '管理员'} · {it.total || 1} 课 · {fmtViews(it.views)} 人在学</div>
                        <UnlockBar game={it} />
                      </div>
                    ))}
                  </div>
                </section>
              )
            })}
            {ZONES.every(z => !z.items(allVideos, allGuides).length) && (
              <div className="py-12 text-center text-gray-400 text-sm">还没有内容，管理员投稿后即可展示</div>
            )}
          </div>
        ) : (
        <>
        {/* ===== 子分类栏（对标句乐部：每个主分类一组自己的标签；教材同步组自动生成教材标签） ===== */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-sm text-gray-400 mr-1">分类</span>
          {subTagsForActive.map((sb) => (
            <button
              key={sb}
              type="button"
              onClick={() => setActiveSub(sb)}
              className={`px-3.5 py-1.5 rounded-full text-sm cursor-pointer transition ${
                activeSub === sb ? 'bg-primary text-white font-semibold' : 'bg-base-200 text-gray-500 hover:bg-base-300'
              }`}
            >
              {sb}
            </button>
          ))}
        </div>

        {/* ===== 年级筛选栏（仅"教材同步"分类显示：年级 一~九/高中） ===== */}
        {activeCat === '教材同步' && (
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <span className="text-sm text-gray-400 mr-1">年级</span>
            {['全部', '一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '七年级', '八年级', '九年级', '高中'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setActiveStage(st)}
                className={`px-3.5 py-1.5 rounded-full text-sm cursor-pointer transition ${
                  activeStage === st ? 'bg-primary text-white font-semibold' : 'bg-base-200 text-gray-500 hover:bg-base-300'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        )}

        {/* ===== 筛选工具行（对标句乐部：内容类型/来源 + 共N个课程包·推荐排序） ===== */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <select value={mode} onChange={e => setMode(e.target.value)} className="select select-sm select-bordered text-sm">
              <option value="all">内容类型：全部</option>
              <option value="video">内容类型：通关视频</option>
              <option value="guide">内容类型：通关课程</option>
            </select>
            <select value={activeSource} onChange={e => setActiveSource(e.target.value)} className="select select-sm select-bordered text-sm">
              <option value="all">来源：全部</option>
              <option value="builtin">来源：内置</option>
              <option value="uploaded">来源：管理员投稿</option>
            </select>
          </div>
          <div className="text-sm text-gray-400">
            共 <span className="font-semibold text-gray-600">{filteredVideos.length + filteredGuides.length}</span> 个课程包 · 推荐排序
          </div>
        </div>

        {/* ===== 通关视频 ===== */}
        {mode !== 'guide' && (
          <section className="mt-10">
            <div className="flex items-center justify-end mb-4">
              <div className="flex items-center gap-3">
                {adminKey ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowContribute(true)}
                      className="text-sm text-primary font-semibold flex items-center gap-1 cursor-pointer hover:underline"
                    >
                      ＋ 上传视频
                    </button>
                    <button
                      type="button"
                      onClick={doAdminLogout}
                      className="text-sm text-gray-400 flex items-center gap-1 cursor-pointer hover:text-gray-600"
                    >
                      退出管理
                    </button>
                  </>
                ) : isAdminMode ? (
                  <button
                    type="button"
                    onClick={() => setShowAdmin(true)}
                    className="text-sm text-primary font-semibold flex items-center gap-1 cursor-pointer hover:underline"
                  >
                    🔑 管理登录
                  </button>
                ) : null}

              </div>
            </div>
            {filteredVideos.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-sm">该分类下暂无视频{query ? '，换个关键词试试' : ''}</div>
            ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {filteredVideos.map((v) => {
                const uploaded = uploadedVideos.some(u => u.id === v.id)
                const unlocked = uploaded || isCoursePurchased(v.id)
                return (
                  <div key={v.id} className="group" onClick={() => onVideoCardClick(v)} style={{ cursor: unlocked ? 'pointer' : 'default' }}>
                    <div
                      className={`aspect-video rounded-xl overflow-hidden mb-2 flex items-center justify-center group-hover:shadow-lg transition relative ${
                        v.thumbnail && uploaded ? '' : `bg-gradient-to-br ${v.cover}`
                      }`}
                      style={v.thumbnail && uploaded ? { backgroundImage: `url(${v.thumbnail})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                    >
                      <span className="w-9 h-9 rounded-full bg-white/25 backdrop-blur flex items-center justify-center">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><polygon points="6 4 20 12 6 20 6 4" /></svg>
                      </span>
                      <span className="absolute bottom-1.5 right-2 text-[11px] text-white bg-black/40 rounded px-1.5 py-0.5">{v.eps || '1 集'}</span>
                      {uploaded && (
                        <span className="absolute top-1.5 left-2 text-[10px] text-white bg-primary/80 rounded px-1.5 py-0.5">投稿</span>
                      )}
                    </div>
                    <div className="text-sm font-semibold line-clamp-1">{v.title}</div>
                    <div className="text-xs text-gray-400 mt-0.5 truncate">{v.author || '管理员'} · {v.total || 1} 课 · {fmtViews(v.views)} 人在学</div>
                    {uploaded ? (
                      <div className="mt-2.5 flex items-center">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                          已上线 · 点卡片选模式
                        </span>
                      </div>
                    ) : (
                      <UnlockBar game={v} />
                    )}
                  </div>
                )
              })}
            </div>
            )}
          </section>
        )}

        {/* ===== 通关秘籍 ===== */}
        {mode !== 'video' && (
          <section className="mt-10">
            <div className="flex items-center justify-end mb-4">
              <div className="flex items-center gap-3">
                {adminKey ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowCourseContribute(true)}
                      className="text-sm text-primary font-semibold flex items-center gap-1 cursor-pointer hover:underline"
                    >
                      ＋ 投稿课程
                    </button>
                    <button
                      type="button"
                      onClick={doAdminLogout}
                      className="text-sm text-gray-400 flex items-center gap-1 cursor-pointer hover:text-gray-600"
                    >
                      退出管理
                    </button>
                  </>
                ) : isAdminMode ? (
                  <button
                    type="button"
                    onClick={() => setShowAdmin(true)}
                    className="text-sm text-primary font-semibold flex items-center gap-1 cursor-pointer hover:underline"
                  >
                    🔑 管理登录
                  </button>
                ) : null}

              </div>
            </div>
            {filteredGuides.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-sm">该分类下暂无课程{query ? '，换个关键词试试' : ''}</div>
            ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {filteredGuides.map((g) => {
                const uploaded = uploadedCourses.some(u => u.id === g.id) || cloudCourses.some(c => c.id === g.id)
                const unlocked = uploaded || g.kind === 'course' || isCoursePurchased(g.id)
                return (
                  <div key={g.id} className="group" onClick={() => onCoverCardClick(g)} style={{ cursor: unlocked ? 'pointer' : 'default' }}>
                    <div
                      className={`aspect-video rounded-xl overflow-hidden mb-2 flex items-center justify-center group-hover:shadow-lg transition relative ${
                        g.thumbnail ? '' : `bg-gradient-to-br ${g.cover}`
                      }`}
                      style={g.thumbnail ? { backgroundImage: `url(${g.thumbnail})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                    >
                      {!g.thumbnail && (
                        <span className={`font-extrabold text-base ${g.ink} ${g.title.startsWith('字母') ? 'tracking-widest' : ''}`}>{g.word}</span>
                      )}
                      <span className="absolute bottom-1.5 right-2 text-[11px] text-white bg-black/40 rounded px-1.5 py-0.5">{g.eps || '1 关'}</span>
                      {uploaded && (
                        <span className="absolute top-1.5 left-2 text-[10px] text-white bg-primary/80 rounded px-1.5 py-0.5">投稿</span>
                      )}
                    </div>
                    <div className="text-sm font-semibold line-clamp-1">{g.title}</div>
                    <div className="text-xs text-gray-400 mt-0.5 truncate">{g.author || '管理员'} · {g.total || 1} 课 · {fmtViews(g.views)} 人在学</div>
                    {uploaded ? (
                      <div className="mt-2.5 flex items-center">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                          已上线 · 点击开始
                        </span>
                      </div>
                    ) : (
                      <UnlockBar game={g} />
                    )}
                  </div>
                )
              })}
            </div>
            )}
          </section>
        )}
        </>
        )}

      </main>

      {/* ===== 视频类 · 练习模式弹窗 ===== */}
      {videoTarget && (
        <ModePickerModal
          title={videoTarget.title}
          modes={VIDEO_MODES}
          onClose={() => setVideoTarget(null)}
          onStart={onVideoStart}
        />
      )}

      {/* ===== 上传视频弹窗（投稿到通关视频） ===== */}
      {showContribute && (
        <ContributeModal onClose={() => setShowContribute(false)} />
      )}

      {/* ===== 投稿课程弹窗（通关秘籍区） ===== */}
      {showCourseContribute && (
        <CourseContributeModal onClose={() => setShowCourseContribute(false)} />
      )}

      {/* ===== 管理员登录弹窗 ===== */}
      {showAdmin && isAdminMode && (
        <div className="modal-mask" onClick={() => setShowAdmin(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <h2>管理登录</h2>
            <p className="hint">管理模式 · 仅管理员可见。登录后可投稿课程/视频，投稿对所有访客公开。</p>
            <p className="hint">输入管理员密钥后可上传本地视频到通关视频区。</p>
            <input
              autoFocus
              value={adminInput}
              onChange={e => setAdminInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') doAdminLogin() }}
              placeholder="管理员密钥"
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', marginBottom: 12 }}
            />
            <div className="mfoot">
              <button className="btn" onClick={() => setShowAdmin(false)}>取消</button>
              <button className="btn primary" onClick={doAdminLogin}>登录</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
