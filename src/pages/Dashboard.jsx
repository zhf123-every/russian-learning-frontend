import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { isDue } from '../lib/fsrs'
import { getStreak, bumpStreak, loadDone, effectiveDone, doneCount, STEP_IDS, isAllDone } from '../lib/todayFlow'
import { trackStudyComplete, TRACK_EVENT, localStreak } from '../lib/track'
import { useVocabStore } from '../store/vocabStore'
import { useSquareStore } from '../store/squareStore'
import { useShangStore } from '../store/shangStore'
import { squareItems } from '../data/squareLibrary'

// ---------- 本周打卡占位（后端 /api/dashboard/stats 就绪后替换） ----------
const WEEK_DAYS = ['一', '二', '三', '四', '五', '六', '日']
const TODAY_WEEKDAY = new Date().getDay() || 7 // 1=周一 ... 7=周日
const STORED_WEEK = JSON.parse(localStorage.getItem('rlearn_dash_week') || 'null')

function CheckinWeek({ onOpenCalendar }) {
  const todayIdx = TODAY_WEEKDAY - 1
  const [week, setWeek] = useState(() => {
    if (STORED_WEEK && STORED_WEEK.length === 7) return STORED_WEEK
    return WEEK_DAYS.map((_, i) => ({
      d: WEEK_DAYS[i],
      done: i < todayIdx,
      today: i === todayIdx,
    }))
  })

  // 记录本周变化
  useEffect(() => {
    localStorage.setItem('rlearn_dash_week', JSON.stringify(week))
  }, [week])

  const handleCheckin = async () => {
    if (week[todayIdx].done) return // 今天已打卡
    setWeek(prev => {
      const next = [...prev]
      next[todayIdx] = { ...next[todayIdx], done: true }
      return next
    })
    try { bumpStreak() } catch (e) {}
    window.dispatchEvent(new Event('rlearn:flow-changed'))
    await trackStudyComplete(TRACK_EVENT.MANUAL_CHECKIN, { source: 'dashboard' })
  }

  return (
    <div>
      {/* 本周打卡记录：7 天方块（句乐部同款） */}
      <div className="mb-2 text-xs font-medium text-gray-700">本周打卡记录</div>
      <div className="grid grid-cols-7 gap-1">
        {week.map((w, i) => (
          <div key={i} className="flex flex-col items-center">
            <div className="mb-1 text-[10px] text-gray-500">{w.d}</div>
            <div
              className={
                'flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition-all ' +
                (w.done
                  ? 'border border-[#6d28d9] bg-[#6d28d9] text-white'
                  : w.today
                    ? 'border-2 border-[#6d28d9] bg-transparent text-[#6d28d9]'
                    : 'border border-gray-200 text-gray-300')
              }
            >
              {w.done && '✓'}
            </div>
          </div>
        ))}
      </div>
      {/* 底部双按钮：打卡日历 + 立即打卡 */}
      <div className="grid grid-cols-2 gap-2 pt-3">
        <button
          onClick={onOpenCalendar}
          className="flex items-center justify-center rounded-lg border border-gray-300 px-2 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100"
        >
          打卡日历
        </button>
        <button
          onClick={handleCheckin}
          className="flex items-center justify-center rounded-lg bg-[#6d28d9] px-2 py-2 text-xs font-bold text-white hover:bg-purple-700"
        >
          ✧ 立即打卡
        </button>
      </div>
    </div>
  )
}

// ---------- 今日任务项（句乐部同款：灰底圆角行 + 图标块 + 奖励胶囊 + 去完成） ----------
function TaskRow({ icon, tint, title, badge, desc, to }) {
  return (
    <Link to={to || '#'} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3 transition-colors hover:bg-gray-100">
      <div className={'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ' + tint}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">{title}</span>
          {badge && <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-600">{badge}</span>}
        </div>
        {desc && <div className="mt-0.5 text-xs text-gray-500 line-clamp-2">{desc}</div>}
      </div>
      <div className="shrink-0">
        <span className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600">
          去完成
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="h-4 w-4" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </span>
      </div>
    </Link>
  )
}

// ---------- 最近学习（句乐部同款：大图标块 + 三行信息） ----------
function RecentItem({ thumb, thumbCls, title, sub, time }) {
  return (
    <div className="group flex cursor-pointer items-start space-x-3 rounded-lg py-2 transition-colors hover:bg-gray-50">
      <div className={'flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded font-bold text-lg ' + thumbCls}>{thumb}</div>
      <div className="min-w-0 flex-1">
        <h3 className="mb-1 truncate text-sm font-medium text-gray-900">{title}</h3>
        <div className="mb-1 truncate text-xs text-blue-600">{sub}</div>
        <div className="text-xs text-gray-500">{time}</div>
      </div>
    </div>
  )
}

// ---------- 主页面 ----------
export default function Dashboard() {
  const [streak, setStreak] = useState(() => localStreak())
  const [goalDone, setGoalDone] = useState(() => {
    const eff = effectiveDone(loadDone())
    return doneCount(eff)
  })
  const goalTotal = STEP_IDS.length

  // 真实：到期生词
  const cards = useVocabStore(s => s.cards)
  const dueCount = useMemo(() => cards.filter(c => isDue(c.fsrs, Date.now())).length, [cards])

  // 真实：精听推荐
  const serverItems = useSquareStore(s => s.serverItems)
  const userItems = useSquareStore(s => s.userItems)
  const progress = useShangStore(s => s.progress)
  const fetchServer = useSquareStore(s => s.fetchServer)
  useEffect(() => { fetchServer() }, [fetchServer])
  const recListen = useMemo(() => {
    const seen = new Set()
    const all = []
    for (const x of [...serverItems, ...userItems, ...squareItems]) {
      if (!seen.has(x.id)) { seen.add(x.id); all.push(x) }
    }
    const withSubs = all.filter(it => Array.isArray(it.sentences) && it.sentences.length > 0)
    return withSubs.find(it => !progress[it.id]?.finished) || withSubs[0] || null
  }, [serverItems, userItems, progress])

  // 真实：课程包 / 当前单元
  const [packTarget, setPackTarget] = useState(null)
  const [showMonthCalendar, setShowMonthCalendar] = useState(false)
  useEffect(() => {
    let cancelled = false
    const base = import.meta.env.VITE_API_BASE || 'https://russian-learning-jetq.onrender.com'
    fetch(`${base}/api/course-packs`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(j => {
        if (cancelled) return
        const pack = (j.data || []).find(p => p.id === 'privet_rossiya_a1') || (j.data || [])[0]
        if (!pack) { setPackTarget(null); return }
        return fetch(`${base}/api/course-packs/${encodeURIComponent(pack.id)}/units`)
          .then(r => r.ok ? r.json() : Promise.reject())
          .then(j2 => {
            if (cancelled) return
            const units = (j2 && j2.units) || []
            units.sort((a, b) => (a.order || 0) - (b.order || 0))
            const next = units.find(u => u.status !== '已完成') || units[units.length - 1] || null
            setPackTarget(next ? { id: next.id, title: next.title || next.name, subtitle: next.subtitle || '' } : null)
          })
      })
      .catch(() => { if (!cancelled) setPackTarget(null) })
    return () => { cancelled = true }
  }, [])

  // sync streak/goal with training flow
  useEffect(() => {
    const sync = () => {
      setStreak(localStreak())
      const eff = effectiveDone(loadDone())
      setGoalDone(doneCount(eff))
    }
    window.addEventListener('rlearn:flow-changed', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('rlearn:flow-changed', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const questTo = packTarget ? `/quest-practice/${packTarget.id}?pack=privet_rossiya_a1` : '/quest-store'

  return (
    <div className="grid grid-cols-1 gap-6 p-2 md:grid-cols-[1fr_250px] md:p-3 w-full items-start">
      {/* ===== 左侧主区域 ===== */}
      <div className="space-y-6">
        {/* 双卡：每日打卡 | 每日任务 */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* 每日打卡 */}
          <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">每日打卡</h2>
              <button className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600" title="即将上线">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="w-4 h-4">
                  <path stroke="currentColor" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            </div>
            {/* 统计块：连胜 / 累计打卡（灰底圆角） */}
            <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-gray-500">连胜</div>
                  <div className="mt-1 flex items-baseline">
                    <span className="text-3xl font-bold text-[#6d28d9]">{streak}</span>
                    <span className="ml-1 text-sm text-gray-500">天</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500">累计打卡</div>
                  <div className="mt-1 flex items-baseline justify-end">
                    <span className="text-3xl font-bold text-gray-900">{streak}</span>
                    <span className="ml-1 text-sm text-gray-500">天</span>
                  </div>
                </div>
              </div>
            </div>
            {/* 今日目标块 */}
            <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
                <span>今日目标</span>
                <span className="font-semibold text-gray-700">{goalDone}/{goalTotal}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-200">
                <div className="h-2 rounded-full bg-[#6d28d9]" style={{ width: `${Math.min((goalDone / goalTotal) * 100, 100)}%` }} />
              </div>
            </div>
            {/* 本周打卡 + 底部双按钮 */}
            <CheckinWeek onOpenCalendar={() => setShowMonthCalendar(true)} />
          </div>

          {/* 每日任务 */}
          <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex shrink-0 items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">每日任务</h2>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="w-5 h-5 text-blue-500">
                    <path stroke="currentColor" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">今日打卡</span>
                    <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-600"> +30</span>
                  </div>
                </div>
                <div className="shrink-0">
                  <span className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600">去完成
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="w-4 h-4" strokeWidth="1.5" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </span>
                </div>
              </div>
              <TaskRow
                to="/square"
                icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="w-5 h-5 text-pink-500"><path stroke="currentColor" strokeWidth="1.5" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>}
                tint="bg-pink-100"
                title="五步精听一段"
                badge=" +15"
                desc="每天花几分钟，听一段真实俄语视频。"
              />
              <TaskRow
                to="/vocab"
                icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="w-5 h-5 text-amber-500"><path stroke="currentColor" strokeWidth="1.5" d="M12 6.253v13.493C10.887 20.44 9.493 21 8 21H6a2 2 0 01-2-2V7a2 2 0 012-2h2c1.493 0 2.887.56 4 1.253zm0 0C13.113 5.56 14.507 5 16 5h2a2 2 0 012 2v12a2 2 0 01-2 2h-2c-1.493 0-2.887-.56-4-1.253" /></svg>}
                tint="bg-amber-100"
                title="完成今日复习"
                badge=" +20"
                desc="完成一次复习练习"
              />
              <div className="pt-2 text-xs font-semibold text-gray-500"> 特别任务 </div>
              <TaskRow
                to="/quest-store"
                icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="w-5 h-5 text-violet-600"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" /><circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.5" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /></svg>}
                tint="bg-violet-100"
                title="测测你的俄语水平"
                badge=" +50"
              />
            </div>
          </div>
        </div>

        {/* 双小卡：重复通关 | 陌生关卡 */}
        <div className="flex flex-col flex-wrap gap-4 lg:flex-row">
          <Link to="/vocab" className="group flex-1 cursor-pointer overflow-hidden rounded-lg border border-gray-200 bg-white p-4 transition-all hover:bg-gray-50 shadow-sm hover:shadow-md">
            <div className="flex items-center">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-50">
                <svg className="h-5 w-5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
                </svg>
              </div>
              <div className="ml-3 min-w-0 flex-1">
                <h3 className="text-sm font-medium text-gray-900">重复通关</h3>
                <p className="mt-1 truncate text-xs text-gray-500">重复闯关，巩固游戏内容</p>
                <p className="mt-1 text-xs text-gray-500">复习关卡 1/30</p>
              </div>
              <div className="mr-2 flex shrink-0 items-center space-x-2">
                <div className="flex items-center space-x-1">
                  <div className="text-xl font-semibold text-amber-500">{dueCount}</div>
                  <div className="text-sm text-gray-500">推荐关卡</div>
                </div>
              </div>
            </div>
          </Link>
          <Link to="/unlocked-games" className="group flex-1 cursor-pointer overflow-hidden rounded-lg border border-gray-200 bg-white p-4 transition-all hover:bg-gray-50 shadow-sm hover:shadow-md">
            <div className="flex items-center">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-50">
                <svg className="h-5 w-5 text-purple-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" /><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
                </svg>
              </div>
              <div className="ml-3 min-w-0 flex-1">
                <h3 className="text-sm font-medium text-gray-900">陌生关卡</h3>
                <p className="mt-1 truncate text-xs text-gray-500">记录闯关失败的关卡</p>
                <p className="mt-1 text-xs text-gray-500">预习关卡 1/30</p>
              </div>
            </div>
          </Link>
        </div>

        {/* 我的游戏（在左侧底部） */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between sm:mb-6">
            <h2 className="text-xl font-medium text-gray-900">我的游戏</h2>
            <Link to="/my-games" className="flex items-center space-x-1 rounded-lg bg-gray-100 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 transition-colors">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span>游戏包商城</span>
            </Link>
          </div>
          <Link to="/my-games" className="flex min-h-[200px] cursor-pointer items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white/50 transition-colors hover:bg-gray-50">
            <div className="text-center">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                <svg className="h-6 w-6 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="p-3 text-sm text-gray-500">添加你的游戏数据包</p>
            </div>
          </Link>
        </div>
      </div>

      {/* ===== 右侧边栏 ===== */}
      <div className="space-y-6">
        {/* 六格掌握度 */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-medium text-gray-900">六格掌握度</h2>
            <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-600">Pro</span>
          </div>
          <div className="relative mx-auto mt-4 w-full max-w-[140px] aspect-square">
            <svg viewBox="0 0 200 200" className="w-full h-full">
              <polygon points="100,10 177.9,55 177.9,145 100,190 22.1,145 22.1,55" fill="none" stroke="#E5E7EB" strokeWidth="1" />
              <polygon points="100,40 151.8,70 151.8,130 100,160 48.2,130 48.2,70" fill="none" stroke="#E5E7EB" strokeWidth="1" />
              <polygon points="100,70 125.9,85 125.9,115 100,130 74.1,115 74.1,85" fill="none" stroke="#E5E7EB" strokeWidth="1" />
              <line x1="100" y1="10" x2="100" y2="190" stroke="#E5E7EB" strokeWidth="1" />
              <line x1="22.1" y1="55" x2="177.9" y2="145" stroke="#E5E7EB" strokeWidth="1" />
              <line x1="177.9" y1="55" x2="22.1" y2="145" stroke="#E5E7EB" strokeWidth="1" />
              <polygon className="rc-radar-shape" points="100,23.5 160.5,65 149.2,117.3 100,130 55.3,108.2 68.7,68.5" stroke="#6d28d9" fill="rgba(109,40,217,0.12)" strokeWidth="2" />
            </svg>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 text-[10px] text-gray-600 font-medium">一格</div>
            <div className="absolute top-[15%] right-0 text-[10px] text-gray-600 font-medium">二格</div>
            <div className="absolute bottom-[15%] right-0 text-[10px] text-gray-600 font-medium">三格</div>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[10px] text-gray-600 font-medium">四格</div>
            <div className="absolute bottom-[15%] left-0 text-[10px] text-gray-600 font-medium">五格</div>
            <div className="absolute top-[15%] left-0 text-[10px] text-gray-600 font-medium">六格</div>
          </div>
          <div className="mt-4 space-y-2">
            {[
              { name: '第一格', value: 85 },
              { name: '第二格', value: 70 },
              { name: '第三格', value: 45 },
              { name: '第四格', value: 60 },
              { name: '第五格', value: 30 },
              { name: '第六格', value: 55 },
            ].map((item, i) => (
              <div key={i}>
                <div className="mb-1 flex justify-between text-[10px] text-gray-500">
                  <span>{item.name}</span>
                  <span className="font-semibold text-gray-700">{item.value}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-[#6d28d9]" style={{ width: `${item.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 最近学习 */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-4 text-base font-medium text-gray-900">最近学习</h3>
          <div className="space-y-3">
            <RecentItem thumb="У1" thumbCls="bg-indigo-50 text-indigo-600" title="Привет, Россия! A1" sub="Урок 1 · 问候与初识" time="大约 2 小时前" />
            <RecentItem thumb="🎧" thumbCls="bg-pink-50 text-pink-600" title="精听 · 在超市购物" sub="常用对话 · 五步精听" time="大约 9 小时前" />
            <RecentItem thumb="У3" thumbCls="bg-amber-50 text-amber-600" title="句子闯关" sub="家族 2 · 第 5 步" time="1 天前" />
            <Link to="/profile" className="mt-2 block w-full rounded-lg bg-gray-100 py-2 text-center text-sm text-gray-600 transition-colors hover:bg-gray-200 hover:text-gray-900">
              查看更多
            </Link>
          </div>
        </div>

        {/* 邀请有礼 */}
        <div className="cursor-pointer overflow-hidden rounded-lg border border-purple-200 bg-gradient-to-b from-purple-500 to-purple-600 p-4 transition-colors hover:from-purple-600 hover:to-purple-700">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-lg leading-none">🎁</span>
            <h3 className="text-sm font-bold text-white">邀请有礼</h3>
          </div>
          <p className="mb-3 text-xs leading-relaxed text-white/80">邀请好友加入，双方都能获得会员时长</p>
          <button className="w-full cursor-not-allowed rounded-lg bg-white py-1.5 text-xs font-semibold text-purple-600 opacity-60 transition-colors" disabled title="即将上线">
            邀请好友 · 即将上线
          </button>
        </div>
      </div>

      {/* 月日历弹窗 */}
      {showMonthCalendar && (
        <div className="modal modal-open">
          <div className="modal-box max-w-sm">
            <h3 className="font-bold text-lg mb-4">📅 2026 年 9 月 打卡日历</h3>
            <div className="grid grid-cols-7 gap-1 mb-2 text-center text-xs text-gray-400">
              <span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-sm">
              <span></span><span></span>
              <div className="w-8 h-8 mx-auto rounded-full bg-primary text-white flex items-center justify-center">1</div>
              <div className="w-8 h-8 mx-auto rounded-full bg-primary text-white flex items-center justify-center">2</div>
              <div className="w-8 h-8 mx-auto rounded-full bg-primary text-white flex items-center justify-center">3</div>
              <div className="w-8 h-8 mx-auto rounded-full bg-primary text-white flex items-center justify-center">4</div>
              <div className="w-8 h-8 mx-auto rounded-full bg-primary text-white flex items-center justify-center">5</div>
              <div className="w-8 h-8 mx-auto rounded-full bg-primary text-white flex items-center justify-center">6</div>
              <div className="w-8 h-8 mx-auto rounded-full bg-primary text-white flex items-center justify-center">7</div>
              <div className="w-8 h-8 mx-auto rounded-full bg-primary text-white flex items-center justify-center">8</div>
              <div className="w-8 h-8 mx-auto rounded-full bg-primary text-white flex items-center justify-center">9</div>
              <div className="w-8 h-8 mx-auto rounded-full bg-primary text-white flex items-center justify-center">10</div>
              <div className="w-8 h-8 mx-auto rounded-full bg-primary text-white flex items-center justify-center">11</div>
              <div className="w-8 h-8 mx-auto rounded-full bg-primary text-white flex items-center justify-center">12</div>
              <div className="w-8 h-8 mx-auto rounded-full bg-primary text-white flex items-center justify-center">13</div>
              <div className="w-8 h-8 mx-auto rounded-full border-2 border-primary text-primary flex items-center justify-center font-bold">15</div>
              <div className="w-8 h-8 mx-auto rounded-full border border-base-300 flex items-center justify-center text-gray-400">16</div>
              <div className="w-8 h-8 mx-auto rounded-full border border-base-300 flex items-center justify-center text-gray-400">17</div>
              <div className="w-8 h-8 mx-auto rounded-full border border-base-300 flex items-center justify-center text-gray-400">18</div>
              <div className="w-8 h-8 mx-auto rounded-full border border-base-300 flex items-center justify-center text-gray-400">19</div>
              <div className="w-8 h-8 mx-auto rounded-full border border-base-300 flex items-center justify-center text-gray-400">20</div>
              <div className="w-8 h-8 mx-auto rounded-full border border-base-300 flex items-center justify-center text-gray-400">21</div>
              <div className="w-8 h-8 mx-auto rounded-full border border-base-300 flex items-center justify-center text-gray-400">22</div>
              <div className="w-8 h-8 mx-auto rounded-full border border-base-300 flex items-center justify-center text-gray-400">23</div>
              <div className="w-8 h-8 mx-auto rounded-full border border-base-300 flex items-center justify-center text-gray-400">24</div>
              <div className="w-8 h-8 mx-auto rounded-full border border-base-300 flex items-center justify-center text-gray-400">25</div>
              <div className="w-8 h-8 mx-auto rounded-full border border-base-300 flex items-center justify-center text-gray-400">26</div>
              <div className="w-8 h-8 mx-auto rounded-full border border-base-300 flex items-center justify-center text-gray-400">27</div>
              <div className="w-8 h-8 mx-auto rounded-full border border-base-300 flex items-center justify-center text-gray-400">28</div>
              <div className="w-8 h-8 mx-auto rounded-full border border-base-300 flex items-center justify-center text-gray-400">29</div>
              <div className="w-8 h-8 mx-auto rounded-full border border-base-300 flex items-center justify-center text-gray-400">30</div>
            </div>
            <div className="modal-action">
              <button className="btn btn-sm" onClick={() => setShowMonthCalendar(false)}>关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
