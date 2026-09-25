// 课程详情页（商城版，仿句乐部课程包详情页）
// 路由：/course/:id —— 由「游戏商城」商城课程卡进入
// 与 /game/:id（GameDetail，学习路线+大纲）为两个独立页面
import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { findGameById, FEATURED, GUIDES } from '../data/gameLibrary'
import { COURSES } from '../data/gameMallData'
import { getCourses } from '../utils/storage'
import { apiFetch } from '../lib/api'
import { API_BASE } from '../lib/api'
import { isCoursePurchased } from '../lib/courseAccess'
import { usePageHeader } from '../components/layout/PageHeaderContext'

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

function makeDemoUnits(game) {
  const total = game.total || game.lessons || 10
  return Array.from({ length: total }, (_, i) => ({
    id: 'demo-' + (game.id) + '-' + (i + 1),
    title: `第 ${i + 1} 课`,
    subtitle: `${game.title} · 第 ${i + 1} 课`,
    description: `${game.title} 第 ${i + 1} 课`,
    status: i === 0 ? '进行中' : '未开始',
    difficulty: i % 3 === 0 ? 'medium' : 'easy',
    demo: true,
  }))
}

// ============ 演示评价数据（无后端时展示，标注"演示"） ============
const DEMO_REVIEWS = [
  { name: 'baiyi', time: '1个月前', text: '我觉得非常可以，我一直都在打。', tags: ['口语表达', '留学/出国', '入门提升', '难度适中', '听力提升', '中高阶', '进阶'] },
  { name: '奶龙', time: '1个月前', text: '重复性过强但这也是一个特色', tags: ['听力提升', '词汇累计', '零基础', '偏简单'] },
  { name: 'kin_ki', time: '1个月前', text: '已学一个来月，完全零基础也慢慢习得俄语的基本造句规律及单词，非常有满足感。鼓励自己能继续坚持到听写能流畅为止！！', tags: ['口语表达', '零基础', '写作表达', '词汇累计', '语法与句型', '难度适中', '跟读/模仿'] },
  { name: 'wechat_user_6en2zh', time: '2个月前', text: '这款课程包已经学完了。前期简单句很多，过于重复，但也确实加深了我对词汇已经句型的印象。后期学习到到B1级句型我很喜欢，都是没接触过的，学完后茅塞顿开，学会了很多别的句型。', tags: ['入门提升', '语法与句型', '零基础', '跟读/模仿', '写作表达', '难度适中'] },
  { name: 'phone.', time: '2个月前', text: "It's very good.", tags: ['口语表达', '语法与句型', '词汇累计', '跟读/模仿', '写作表达', '中小学', '难度适中'] },
]
const DEMO_RATING = { total: 4.6, count: 564, dist: [296, 239, 15, 8, 1] }
const DEMO_TAGS = ['全部 564', '零基础 448', '入门提升 391', '难度适中 382', '词汇累计 347', '语法与句型 339', '听力提升 335', '口语表达 303', '跟读/模仿 208', '偏简单 177', '写作表达 156']

export default function CourseDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { setHeaderLeft } = usePageHeader() // 页眉左侧插槽（替换收起按钮）
  const [game, setGame] = useState(
    () => findGameById(id) || getCourses().find(c => c.id === id) || COURSES.find(c => c.id === id)
  )
  // 云端课程兜底（全网可见：访客没有 localStorage，从 B2 名单拉）
  useEffect(() => {
    if (game) return
    let alive = true
    apiFetch('/api/videos/list')
      .then(r => r.json())
      .then(j => {
        if (!alive) return
        if (j.ok && Array.isArray(j.videos)) {
          const hit = j.videos.find(v => v.kind === 'course' && v.id === id)
          if (hit) setGame(hit)
        }
      })
      .catch(() => {})
    return () => { alive = false }
  }, [game, id])

  const [units, setUnits] = useState([])
  const [loading, setLoading] = useState(true)
  const [isDemo, setIsDemo] = useState(false)
  const [showAllOutline, setShowAllOutline] = useState(false)
  const [reviewTag, setReviewTag] = useState('全部 564')

  useEffect(() => {
    if (!game) { setLoading(false); return }
    // 后台「搭课程序」的真实课时优先展示
    if (Array.isArray(game.units) && game.units.length) {
      setUnits(game.units.map((u, i) => ({ ...u, subtitle: u.desc || u.subtitle, status: i === 0 ? '进行中' : '未开始', demo: false })))
      setIsDemo(false)
      setLoading(false)
      return
    }
    // 云端投稿课程：自带 lessons 大纲（真实内容，不走演示占位）
    if (game.kind === 'course' && Array.isArray(game.lessons) && game.lessons.length) {
      setUnits(game.lessons.map((l, i) => ({ ...l, subtitle: l.description || l.subtitle, status: i === 0 ? '进行中' : '未开始', demo: false })))
      setIsDemo(false)
      setLoading(false)
      return
    }
    if (game.packId) {
      const isLocal = /^localhost|^127\./.test(location.hostname)
      const base = isLocal ? '' : (API_BASE || '')
      fetch(`${base}/api/course-packs/${game.packId}/units`)
        .then((r) => r.json())
        .then((data) => {
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

  // 页眉左侧：收起侧边栏 → 返回箭头（返回商城）
  useEffect(() => {
    setHeaderLeft(
      <button type="button" className="shell-card-back" aria-label="返回" onClick={() => navigate('/unlocked-games')}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
      </button>
    )
    return () => setHeaderLeft(null)
  }, [setHeaderLeft, navigate])

  if (!game) {
    return (
      <div className="min-h-full bg-base-100 flex items-center justify-center" style={{ padding: 60 }}>
        <div className="text-center">
          <div style={{ fontSize: 40 }}>🕹️</div>
          <h2 className="text-lg font-bold mt-3">课程不存在或已下线</h2>
          <Link to="/unlocked-games" className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary text-white text-sm font-bold px-6 py-2.5 hover:brightness-110 transition">回商城看看</Link>
        </div>
      </div>
    )
  }

  const doneCount = units.filter((u) => u.status === '已完成').length
  const doingCount = units.filter((u) => u.status === '进行中').length
  const progress = units.length ? Math.round((doneCount / units.length) * 100) : 0
  const outlineShown = showAllOutline ? units : units.slice(0, 7)
  const outlineHidden = units.length - 7

  // 点「开始闯关」/ 任意关卡 → 进我的游戏同款「游戏详情」学习页
  const goLearn = () => navigate(`/game/${game.id}`)

  // "学这个的人也在学"：推荐其他课程包（课程类）
  const recs = [...FEATURED, ...GUIDES].filter((g) => g.id !== game.id && g.kind === 'cover').slice(0, 4)
  const starBars = DEMO_RATING.dist.map((c, i) => ({
    star: 5 - i,
    count: c,
    pct: Math.round((c / DEMO_RATING.count) * 100),
  }))

  const coverCls = `bg-gradient-to-br ${game.cover || 'from-indigo-600 to-violet-700'}`
  const bigText = game.big || game.word || '俄语课程'

  return (
    <div className="min-h-full bg-base-100">
      <main className="px-6 py-6 max-w-[1100px] mx-auto">

        {/* ===== ① 课程头部：封面 + 信息 + 操作 ===== */}
        <div className="flex flex-col md:flex-row gap-5 md:gap-8 mb-8">
          {/* 封面 */}
          <div className={`${coverCls} w-full md:w-56 shrink-0 aspect-[4/3] md:aspect-[3/4] rounded-2xl overflow-hidden flex items-center justify-center p-4 shadow-sm`}>
            <span className={`text-2xl md:text-3xl font-extrabold leading-tight drop-shadow text-center ${game.ink || 'text-white'}`}>{bigText}</span>
          </div>

          {/* 信息 */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 leading-snug">{game.title}</h1>
              <div className="flex items-center gap-2 shrink-0">
                <button className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" /></svg>
                  推荐好友
                </button>
                <button
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary text-white px-6 py-2 text-sm font-bold hover:brightness-110 active:scale-[.98] transition shadow-sm"
                  onClick={goLearn}
                >
                  开始闯关
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                </button>
              </div>
            </div>

            <p className="text-sm text-gray-600 mt-2 leading-relaxed max-w-2xl">{game.desc}</p>

            {/* 标签 */}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {['零基础入门', '语法', '句型', '成人学习', '文字'].map((t) => (
                <span key={t} className="text-xs text-gray-500 bg-gray-100 rounded-md px-2.5 py-1">{t}</span>
              ))}
            </div>

            {/* 使用人数 + 评分 */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 text-sm text-gray-500">
              <span className="flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                {game.meta || '30.5 万人使用'}
              </span>
              <span className="flex items-center gap-1">
                <span className="text-amber-500 font-semibold">{DEMO_RATING.total}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                <span>{DEMO_RATING.count} 条评价</span>
              </span>
            </div>

            {/* 总进度（仅已解锁/有进度时展示） */}
            {isCoursePurchased(game.id) && (
              <div className="mt-5 bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div className="flex justify-between text-xs font-semibold text-gray-600 mb-2">
                  <span>我的进度</span><span>{doneCount}/{units.length} 关 · {progress}%</span>
                </div>
                <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: progress + '%' }} />
                </div>
                <div className="text-xs text-gray-400 mt-1.5">✅ {doneCount} 已完成 · 🔵 {doingCount} 进行中</div>
              </div>
            )}
          </div>
        </div>

        {/* ===== ② 大纲 ===== */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-extrabold text-gray-900">关卡 <span className="text-sm font-medium text-gray-400 ml-1">共 {units.length} 关</span></h2>
            <button className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition cursor-pointer">
              正序
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
            </button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-gray-400">加载关卡…</div>
          ) : (
            <div className="border border-gray-100 rounded-2xl divide-y divide-gray-100">
              {outlineShown.map((u, i) => {
                const dm = DIFF_META[u.difficulty] || DIFF_META.easy
                const sm = STATUS_META[u.status] || STATUS_META['未开始']
                return (
                  <div key={u.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition cursor-pointer" onClick={goLearn}>
                    <span className="text-xs font-bold text-gray-400 w-6 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">{u.title}</span>
                        <span style={{ color: dm.color, background: dm.bg }} className="text-[11px] rounded px-1.5 py-0.5">{dm.label}</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5 truncate">{u.subtitle || u.description}</div>
                    </div>
                    <span style={{ color: sm.color, background: sm.bg }} className="text-[11px] rounded px-1.5 py-0.5 shrink-0">{sm.label}</span>
                  </div>
                )
              })}
              {outlineHidden > 0 && (
                <button className="w-full py-3.5 text-sm font-semibold text-primary hover:bg-primary/5 transition cursor-pointer" onClick={() => setShowAllOutline((v) => !v)}>
                  {showAllOutline ? '收起关卡' : `展开全部关卡 (${outlineHidden})`}
                </button>
              )}
            </div>
          )}
        </div>

        {/* ===== ③ 游戏包评价 ===== */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-extrabold text-gray-900">游戏包评价 <span className="text-sm font-medium text-gray-400 ml-1">{DEMO_RATING.count} 条</span></h2>
            <button className="inline-flex items-center gap-1.5 rounded-full bg-primary text-white px-5 py-2 text-sm font-bold hover:brightness-110 transition">写评价</button>
          </div>

          {/* 评分总览 + 星级分布 */}
          <div className="flex flex-col sm:flex-row gap-6 border border-gray-100 rounded-2xl p-5 mb-4">
            <div className="flex items-center gap-4 shrink-0">
              <div className="text-center">
                <div className="text-4xl font-extrabold text-gray-900">{DEMO_RATING.total}</div>
                <div className="flex items-center justify-center gap-0.5 mt-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <svg key={s} width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                  ))}
                </div>
                <div className="text-xs text-gray-400 mt-1">{DEMO_RATING.count} 条评价</div>
              </div>
              <div className="space-y-1.5 min-w-[160px] flex-1">
                {starBars.map((b) => (
                  <div key={b.star} className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="w-7 shrink-0">{b.star} 星</span>
                    <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full bg-amber-400" style={{ width: b.pct + '%' }} />
                    </div>
                    <span className="w-8 text-right shrink-0 text-gray-400">{b.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 评价标签筛选 */}
          <div className="flex flex-wrap gap-2 mb-4">
            {DEMO_TAGS.map((t) => (
              <button key={t} onClick={() => setReviewTag(t)}
                className={`text-xs rounded-full px-3 py-1.5 transition cursor-pointer ${reviewTag === t ? 'bg-primary text-white font-semibold' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {t}
              </button>
            ))}
          </div>

          {/* 评价列表 */}
          <div className="space-y-3">
            {DEMO_REVIEWS.map((r, i) => (
              <div key={i} className="border border-gray-100 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">{r.name.slice(0, 1).toUpperCase()}</div>
                    <span className="text-sm font-semibold text-gray-900">{r.name}</span>
                  </div>
                  <span className="text-xs text-gray-400">{r.time}</span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{r.text}</p>
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {r.tags.slice(0, 5).map((t) => (
                    <span key={t} className="text-[11px] text-gray-500 bg-gray-100 rounded px-2 py-0.5">{t}</span>
                  ))}
                  {r.tags.length > 5 && <span className="text-[11px] text-gray-400">+{r.tags.length - 5}</span>}
                </div>
              </div>
            ))}
          </div>

          <button className="w-full mt-4 py-3 text-sm font-semibold text-gray-500 hover:text-gray-900 border border-gray-200 rounded-xl hover:bg-gray-50 transition cursor-pointer">查看更多</button>
        </div>

        {/* ===== ④ 学这个的人也在学 ===== */}
        <div className="mb-10">
          <h2 className="text-lg font-extrabold text-gray-900">学这个的人也在学</h2>
          <p className="text-sm text-gray-400 mt-0.5 mb-4">为你精选的课程包</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {recs.map((r) => (
              <Link key={r.id} to={`/course/${r.id}`} className="group cursor-pointer block">
                <div className={`aspect-[16/10] rounded-xl overflow-hidden mb-2 bg-gradient-to-br ${r.cover || 'from-gray-200 to-gray-300'} flex items-center justify-center p-3 group-hover:shadow-lg transition relative`}>
                  <span className={`text-sm font-extrabold leading-tight drop-shadow text-center ${r.ink || 'text-white'}`}>{r.big || r.word || r.title}</span>
                </div>
                <div className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">{r.title}</div>
                <div className="text-xs text-gray-400 mt-1 truncate">{r.meta || `${r.total || '—'} 课`}</div>
              </Link>
            ))}
          </div>
        </div>
      </main>


    </div>
  )
}
