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
        {/* ===== 学习路线 ===== */}
        <div className="card" style={{ padding: 20, borderRadius: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>学习路线</div>
          <div style={{ fontSize: 13.5, color: '#9ca3af', marginBottom: 16 }}>按顺序学习效果最佳，绿色=已完成，紫色=正在学</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto', paddingBottom: 6 }}>
            {routeNodes.map((u, i) => {
              if (!u) return <div key={'e' + i} style={{ flex: '0 0 28px', textAlign: 'center', color: '#c0c4cc', fontWeight: 800 }}>…</div>
              const st = STATUS_META[u.status] || STATUS_META['未开始']
              const done = u.status === '已完成'
              return (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ textAlign: 'center', flexShrink: 0 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%', margin: '0 auto',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800,
                      background: done ? '#16a34a' : (u.status === '进行中' ? '#7c3aed' : '#e5e7eb'),
                      color: done || u.status === '进行中' ? '#fff' : '#9ca3af',
                    }}>{done ? '✓' : (i + 1)}</div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4, whiteSpace: 'nowrap' }}>{u.title}</div>
                  </div>
                  {i < routeNodes.length - 1 && <div style={{ flex: 1, minWidth: 18, height: 2, background: '#e5e7eb', margin: '0 4px' }} />}
                </div>
              )
            })}
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
                  className="relative h-full cursor-pointer overflow-hidden rounded-xl border border-gray-200 bg-white p-3 pr-8 transition-all hover:scale-[1.02] hover:bg-gray-100/80 hover:shadow-xl hover:shadow-purple-100/20 sm:p-5 sm:pr-10"
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
                  <div className="mt-2 flex items-center gap-3 text-[10px] text-gray-500 sm:text-xs">
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
          <div className="card" style={{ padding: 48, borderRadius: 16, textAlign: 'center', color: '#9ca3af', marginBottom: 40 }}>
            <div style={{ fontSize: 34 }}>💬</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#6b7280', marginTop: 10 }}>暂无评价</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>学习课程后可以来评价</div>
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
    </div>
  )
}
