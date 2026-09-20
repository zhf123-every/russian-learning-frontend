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

function CheckinWeek() {
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
    <div className="flex items-center justify-between">
      {week.map((w, i) => (
        <div key={i} className="flex flex-col items-center gap-1.5">
          <span className="text-[11px] text-gray-400">{w.d}</span>
          <div
            className={
              'h-7 w-7 rounded-full border flex items-center justify-center text-xs transition-all ' +
              (w.done
                ? 'border-brand bg-brand text-white'
                : w.today
                  ? 'border-brand text-brand font-bold'
                  : 'border-gray-200 text-transparent')
            }
          >
            {w.done && '✓'}
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------- 今日任务项 ----------
function TaskRow({ icon, tint, title, badge, desc, to }) {
  return (
    <Link to={to || '#'} className="group flex items-start gap-3 py-3.5 border-b border-gray-100 last:border-b-0 transition-colors hover:bg-gray-50/60 -mx-2 px-2 rounded-xl">
      <div className={'mt-0.5 h-10 w-10 shrink-0 rounded-xl flex items-center justify-center text-base ' + tint}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">{title}</span>
          {badge && <span className="inline-flex rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-bold text-amber-700">{badge}</span>}
        </div>
        {desc && <p className="mt-1 text-xs text-gray-500 leading-relaxed line-clamp-2">{desc}</p>}
      </div>
      <div className="shrink-0 pt-1 text-xs text-gray-400 transition-colors group-hover:text-brand">
        去完成 <span className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
      </div>
    </Link>
  )
}

// ---------- 最近学习 ----------
function RecentItem({ thumb, title, sub, time }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-b-0">
      <div className="h-10 w-10 shrink-0 rounded-lg bg-brand-soft flex items-center justify-center text-[11px] font-bold text-brand">
        {thumb}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-gray-900 truncate">{title}</div>
        <div className="text-xs text-gray-500 truncate">{sub}</div>
        <div className="text-[11px] text-gray-400">{time}</div>
      </div>
    </div>
  )
}

// ---------- 热力图 ----------
function HeatMini() {
  // 确定性伪随机热力数据
  const cells = useMemo(() => {
    const arr = []
    for (let i = 0; i < 35; i++) {
      arr.push([0, 0, 0, 1, 1, 1, 1][i % 7] || 0)
    }
    return arr
  }, [])
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-gray-900">学习热力图</span>
        <span className="text-[11px] text-gray-400">2026 年 9 月</span>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {WEEK_DAYS.map(d => (
          <div key={d} className="text-center text-[10px] text-gray-400">{d}</div>
        ))}
        {cells.map((v, i) => (
          <div key={i} className={'aspect-square rounded-sm transition-colors ' + (v === 0 ? 'bg-gray-100' : v === 1 ? 'bg-indigo-100' : v === 2 ? 'bg-indigo-200' : v === 3 ? 'bg-indigo-400' : 'bg-indigo-600')} />
        ))}
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
    <div className="min-h-screen bg-gray-50/80 font-ui text-gray-900">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 pb-20 pt-6">

        {/* 顶栏 */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-brand flex items-center justify-center text-white font-bold font-ru">А</div>
            <h1 className="text-lg font-bold">我的主页</h1>
          </div>
          <div className="h-9 w-9 rounded-full bg-brand flex items-center justify-center text-sm font-bold text-white cursor-pointer">
            学
          </div>
        </div>

        {/* 三栏网格 */}
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr_310px] gap-5 items-start">

          {/* ===== 左列 ===== */}
          <div className="flex flex-col gap-4">
            {/* 每日打卡 */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold">每日打卡</span>
                <div className="flex items-center gap-1.5">
                  <button className="text-gray-400 hover:text-brand transition-colors">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </button>
                </div>
              </div>

              {/* 统计 */}
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-[11px] text-gray-400 mb-1">连胜</div>
                  <div className="text-[32px] font-extrabold leading-none tracking-tight">
                    {streak}<span className="text-xs font-semibold text-gray-400 ml-1">天</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-gray-400 mb-1">累计打卡</div>
                  <div className="text-[32px] font-extrabold leading-none tracking-tight">
                    {streak}<span className="text-xs font-semibold text-gray-400 ml-1">天</span>
                  </div>
                </div>
              </div>

              {/* 今日目标 */}
              <div className="mt-4">
                <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                  <span>今日目标</span>
                  <span className="font-semibold text-gray-700">{goalDone}/{goalTotal}</span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${Math.min((goalDone / goalTotal) * 100, 100)}%` }} />
                </div>
              </div>

              {/* 本周 */}
              <div className="mt-4">
                <div className="text-[11px] text-gray-400 mb-2">本周打卡记录</div>
                <CheckinWeek />
              </div>

              {/* 打卡按钮 */}
              <button
                onClick={handleCheckin}
                className="mt-4 w-full rounded-xl bg-brand py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-hover active:scale-[0.98]"
              >
                ✧ 立即打卡
              </button>
            </div>

            {/* 复习本 / 生词本 */}
            <div className="grid grid-cols-2 gap-3">
              <Link to="/vocab" className="card p-3.5 hover:shadow-card-hover transition group">
                <div className="h-9 w-9 rounded-lg bg-amber-50 flex items-center justify-center text-base mb-2.5">📕</div>
                <div className="text-sm font-semibold text-gray-900 leading-tight">复习本</div>
                <div className="text-[11px] text-gray-400 mt-1 leading-relaxed">智能复习，巩固学习内容</div>
                {dueCount > 0 && (
                  <div className="mt-2 text-[11px] font-semibold text-amber-600">今日推荐 <span className="text-amber-500">{dueCount}</span></div>
                )}
              </Link>
              <Link to="/vocab" className="card p-3.5 hover:shadow-card-hover transition group">
                <div className="h-9 w-9 rounded-lg bg-brand-soft flex items-center justify-center text-base mb-2.5">📖</div>
                <div className="text-sm font-semibold text-gray-900 leading-tight">生词本</div>
                <div className="text-[11px] text-gray-400 mt-1 leading-relaxed">记录学习中遇到的生词</div>
              </Link>
            </div>
          </div>

          {/* ===== 中列 ===== */}
          <div className="card p-5">
            <div className="text-sm font-semibold mb-3">每日任务</div>
            <TaskRow icon="🗓" tint="bg-blue-50 text-blue-600" title="今日打卡" badge="+30" to="#" />
            <TaskRow
              icon="🎧"
              tint="bg-rose-50 text-rose-600"
              title="五步精听一段"
              badge="+15"
              desc="每天花几分钟，听一段真实俄语视频——自己听懂、跟读出来的句子，才是你真正能脱口而出的。盲听、听写、精读、跟读、复述，五步走完；听不懂也没关系。"
              to={recListen ? `/square/${recListen.id}` : '/square'}
            />
            <TaskRow icon="📅" tint="bg-amber-50 text-amber-600" title="完成今日复习" badge="+20" desc="完成一次复习练习" to="/vocab" />
            <div className="pt-3 pb-1">
              <span className="text-[11px] text-gray-400 tracking-wide uppercase">特别任务</span>
            </div>
            <TaskRow icon="🎯" tint="bg-brand-soft text-brand" title="测测你的俄语水平" badge="+50" to="/profile" />
          </div>

          {/* ===== 右列 ===== */}
          <div className="flex flex-col gap-4">
            {/* 学习热力图 */}
            <div className="card p-5">
              <HeatMini />
            </div>

            {/* 最近学习 */}
            <div className="card p-5">
              <div className="text-sm font-semibold mb-1">最近学习</div>
              <RecentItem thumb="У1" title="Привет, Россия! A1" sub="Урок 1 · 问候与初识" time="大约 2 小时前" />
              <RecentItem thumb="🎧" title="精听 · 在超市购物" sub="常用对话 · 五步精听" time="大约 9 小时前" />
              <RecentItem thumb="У3" title="句子闯关" sub="家族 2 · 第 5 步" time="1 天前" />
              <button className="mt-2 w-full text-center text-xs text-gray-400 hover:text-brand transition-colors py-1">
                查看更多
              </button>
            </div>

            {/* 邀请有礼 */}
            <div className="rounded-2xl bg-brand p-5 text-white shadow-sm">
              <div className="text-sm font-bold mb-1">🎁 邀请有礼</div>
              <div className="text-xs text-white/80 leading-relaxed mb-3">邀请好友加入，双方都能获得会员时长</div>
              <button className="w-full rounded-xl bg-white py-2 text-sm font-bold text-brand transition hover:bg-gray-50">
                邀请好友
              </button>
            </div>
          </div>
        </div>

        {/* ===== 底部：我的课程 ===== */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-extrabold text-gray-900">我的课程</h2>
            <Link to="/quest-store" className="btn-ghost text-xs py-1.5 px-3">
              🛒 课程包商城
            </Link>
          </div>
          <div className="card border-dashed">
            <div className="flex flex-col items-center justify-center gap-3 py-10">
              <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center text-xl text-gray-400">＋</div>
              <div className="text-sm text-gray-500">将常用课程包添加到主页，让您的学习更便捷高效</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}