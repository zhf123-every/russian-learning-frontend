// 课程大纲页（阶段二 · 大纲试学逻辑）
// 路由：/course/:id —— 课程卡片点击进入，展示课时大纲 + 试学配置
import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getCourseById, getTrialConfig, getLessonsList } from '../utils/courseService'
import { usePageHeader } from '../components/layout/PageHeaderContext'

export default function CourseDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { setHeaderLeft } = usePageHeader() // 页眉左侧插槽（返回箭头）
  const [course, setCourse] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sortOrder, setSortOrder] = useState('asc') // 大纲排序：asc 正序 / desc 倒序
  const [showAll, setShowAll] = useState(false)     // 是否展开全部课时

  // 读取完整课程（云端含大纲 lessonsList）
  useEffect(() => {
    let alive = true
    setLoading(true)
    getCourseById(id)
      .then((c) => { if (alive) setCourse(c) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [id])

  // 页眉左侧：返回箭头
  useEffect(() => {
    setHeaderLeft(
      <button type="button" className="shell-card-back" aria-label="返回" onClick={() => navigate(-1)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
      </button>
    )
    return () => setHeaderLeft(null)
  }, [setHeaderLeft, navigate])

  if (loading) {
    return <div className="db-page"><div className="db-container" style={{ padding: 60, textAlign: 'center' }}><div className="loading loading-spinner text-primary" style={{ width: 40 }} /></div></div>
  }

  if (!course) {
    return (
      <div className="db-page"><div className="db-container" style={{ padding: 60, textAlign: 'center' }}>
        <div style={{ fontSize: 40 }}>🕹️</div>
        <h2 className="text-lg font-bold mt-3">课程不存在或已下线</h2>
        <Link to="/unlocked-games" className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary text-white text-sm font-bold px-6 py-2.5 hover:brightness-110 transition">回游戏商城看看</Link>
      </div></div>
    )
  }

  const { freeTrialCount, isVipOnly } = getTrialConfig(course)
  const lessons = getLessonsList(course)
  const totalLessons = lessons.length
  const sorted = sortOrder === 'asc' ? lessons : [...lessons].reverse()
  // 默认展示前 freeTrialCount+2 条（含试学课），点击"展开全部大纲"显示全部
  const previewCount = Math.min(Math.max(freeTrialCount + 2, 4), totalLessons)
  const visible = showAll ? sorted : sorted.slice(0, previewCount)
  const pad = (n) => String(n + 1).padStart(2, '0')
  // 人数格式化（万单位）
  const fmtViews = (n) => { const v = Number(n) || 0; return v >= 10000 ? (v / 10000).toFixed(1) + '万' : String(v) }
  // 点击「可试学」课时 → 跳到游戏详情页（/game/:id，学习路线+大纲）
  const goGameDetail = () => navigate(`/game/${course.id}`)

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6">
      {/* ===== 顶部 Hero：对标句乐部课程详情卡片 ===== */}
      <div className="detail-hero-pc flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm md:flex-row">
        {/* 封面 */}
        <div className={`detail-cover relative flex w-full shrink-0 items-center justify-center overflow-hidden md:w-[300px] ${typeof course.cover === 'string' && course.cover.startsWith('bg-') ? course.cover : 'bg-gradient-to-br from-violet-100 to-purple-200'}`}>
          {course.posterUrl || course.thumbnail ? (
            <img src={course.posterUrl || course.thumbnail} alt={course.title} className="h-full w-full object-cover" onError={e => { e.currentTarget.style.display = 'none' }} />
          ) : (
            <span className="select-none text-7xl font-black text-purple-700/60">{String(course.title || '课').charAt(0)}</span>
          )}
          {course.badge && (
            <span className="absolute left-3 top-3 rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">{course.badge}</span>
          )}
        </div>
        {/* 右侧正文 */}
        <div className="detail-body min-w-0 flex-1 p-5 md:p-6">
          {/* 标题行 + 推荐好友 */}
          <div className="detail-title-row flex items-start justify-between gap-3">
            <h2 className="detail-title text-xl font-extrabold leading-snug text-gray-900 md:text-2xl">{course.title}</h2>
            <button type="button" className="detail-share-btn flex shrink-0 items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 transition hover:bg-gray-50">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98" /></svg>
              推荐好友
            </button>
          </div>
          {/* 描述（保留试学信息） */}
          <div className="detail-desc-wrap mt-2">
            <p className="detail-desc text-sm leading-relaxed text-gray-500">
              {course.subtitle || course.desc || '适合零基础入门的俄语课程'}
            </p>
            <p className="mt-1.5 text-xs text-gray-400">
              前 <span className="font-semibold text-amber-600">{freeTrialCount}</span> 课可试学 · 共 <span className="font-semibold text-gray-700">{totalLessons}</span> 课
            </p>
          </div>
          {/* 标签行 */}
          <div className="detail-tag-row mt-3 flex flex-wrap gap-1.5">
            {(course.tags || []).filter(t => t !== 'course').slice(0, 6).map(t => (
              <span key={t} className="detail-tag rounded-full bg-gray-100 px-2.5 py-1 text-[11px] text-gray-500">{t}</span>
            ))}
          </div>
          {/* 底部：统计 + CTA */}
          <div className="detail-footer-bottom mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3">
            <div className="detail-stats flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
              <span className="detail-author inline-flex items-center gap-1.5">
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                  {String(course.author || '管').charAt(0)}
                </span>
                <span className="truncate">{course.author || '管理员'}</span>
              </span>
              <span className="detail-stat-usage inline-flex items-center gap-1">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                {fmtViews(course.views ?? course.students ?? 0)} 人使用
              </span>
              <span className="detail-rating-link inline-flex items-center gap-1 text-gray-400">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="text-amber-400"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                暂无评价
              </span>
            </div>
            <div className="detail-cta-col flex shrink-0 items-center gap-2.5">
              <button type="button" className="detail-btn-ghost rounded-full border border-gray-300 px-5 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50">
                开通会员
              </button>
              <button type="button" className="detail-btn-primary inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:brightness-110">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4" /></svg>
                试学前 {freeTrialCount} 课
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ===== 大纲区 ===== */}
      <div className="mt-6 rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-baseline gap-2.5">
            <h2 className="text-lg font-extrabold text-gray-900">大纲</h2>
            <span className="text-xs text-gray-400">
              共 <span className="font-semibold text-gray-600">{totalLessons}</span> 课 · 前 <span className="font-semibold text-amber-600">{freeTrialCount}</span> 课免费试学
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              {sortOrder === 'asc'
                ? <path d="M8 6h13M8 12h9M8 18h5M3 4v4M3 10v4M3 16v4M3 18h2" />
                : <path d="M8 6h13M8 12h9M8 18h5M3 4h2M3 10h2M3 16h2M3 4v4M3 10v4M3 16v4" />}
            </svg>
            {sortOrder === 'asc' ? '正序' : '倒序'}
          </button>
        </div>

        {/* 课时列表 */}
        <ul className="px-4 md:px-6 py-3">
          {visible.map((l, i) => {
            const isFree = Boolean(l.isFree)
            return (
              <li key={l.lessonId || i} onClick={isFree ? goGameDetail : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-3 transition-colors ${isFree ? 'cursor-pointer bg-amber-50/60 hover:bg-amber-50' : 'hover:bg-gray-50'}`}>
                <span className={`w-8 shrink-0 text-sm font-bold ${isFree ? 'text-amber-600' : 'text-gray-300'}`}>{pad(i)}</span>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isFree ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-400'}`}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M16 13H8" /><path d="M16 17H8" /></svg>
                </span>
                <div className="min-w-0 flex-1">
                  <div className={`truncate text-sm font-semibold ${isFree ? 'text-gray-900' : 'text-gray-700'}`}>{l.title}</div>
                  {l.subtitle && l.subtitle !== l.title && (
                    <div className="mt-0.5 truncate text-xs text-gray-400">{l.subtitle}</div>
                  )}
                </div>
                {isFree ? (
                  <span className="shrink-0 rounded-full bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-white">可试学 →</span>
                ) : (
                  <span className="shrink-0 text-lg text-gray-300" title="已锁定">🔒</span>
                )}
              </li>
            )
          })}
        </ul>

        {totalLessons > previewCount && (
          <div className="px-6 pb-5">
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              className="w-full rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition"
            >
              {showAll ? '收起大纲 ▲' : `展开全部大纲（共 ${totalLessons} 课）▾`}
            </button>
          </div>
        )}
      </div>

      {isVipOnly && (
        <p className="mt-4 text-center text-xs text-gray-400">
          💎 本课程为会员专享，试学 {freeTrialCount} 课后开通会员可继续学习
        </p>
      )}
    </div>
  )
}