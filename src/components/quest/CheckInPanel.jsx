import { useState, useEffect, useMemo } from 'react'

// ================= 签到面板 =================
// 每日签到 + 连续签到奖励 + 签到日历
// 数据存储：rlearn_checkin_data = { lastDate, streak, total, history: { 'YYYY-MM-DD': true } }

const STORAGE_KEY = 'rlearn_checkin_data'

function getTodayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getYesterdayKey() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function loadCheckinData() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    return s || { lastDate: '', streak: 0, total: 0, history: {} }
  } catch { return { lastDate: '', streak: 0, total: 0, history: {} } }
}

function saveCheckinData(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) } catch { /* 忽略 */ }
}

// 连续签到奖励配置
const REWARD_MILESTONES = [
  { days: 3, label: '连续3天', emoji: '🔥', reward: '学习热情 +10' },
  { days: 7, label: '连续7天', emoji: '⭐', reward: '一周达人成就' },
  { days: 14, label: '连续14天', emoji: '💎', reward: '坚持之星成就' },
  { days: 30, label: '连续30天', emoji: '👑', reward: '月度学霸成就' },
  { days: 100, label: '连续100天', emoji: '🏆', reward: '百日传奇成就' },
]

export default function CheckInPanel({
  theme = 'light',
  onCheckIn,  // (data) => void 签到成功回调
}) {
  const [data, setData] = useState(() => loadCheckinData())
  const [justChecked, setJustChecked] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)

  const todayKey = getTodayKey()
  const isCheckedToday = data.history[todayKey]

  const handleCheckIn = () => {
    if (isCheckedToday) return
    const yesterday = getYesterdayKey()
    const newStreak = data.lastDate === yesterday ? data.streak + 1 : 1
    const newData = {
      lastDate: todayKey,
      streak: newStreak,
      total: data.total + 1,
      history: { ...data.history, [todayKey]: true },
    }
    setData(newData)
    saveCheckinData(newData)
    setJustChecked(true)
    onCheckIn && onCheckIn(newData)
    setTimeout(() => setJustChecked(false), 3000)
  }

  // 下一个奖励里程碑
  const nextMilestone = useMemo(() => {
    return REWARD_MILESTONES.find(m => m.days > data.streak) || null
  }, [data.streak])

  const progressToNext = nextMilestone
    ? Math.min(100, Math.round((data.streak / nextMilestone.days) * 100))
    : 100

  // 本月签到日历
  const monthDays = useMemo(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const days = []
    // 填充月初空白
    for (let i = 0; i < firstDay; i++) days.push(null)
    // 填充日期
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      days.push({ day: d, key, checked: !!data.history[key], isToday: key === todayKey })
    }
    return days
  }, [data.history, todayKey])

  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body p-6">
        <style>{`
          @keyframes ciPop { 0%{transform:scale(.8); opacity:0} 50%{transform:scale(1.1)} 100%{transform:scale(1); opacity:1} }
          @keyframes ciShine { 0%{background-position:-200% center} 100%{background-position:200% center} }
          .ci-btn-checked{ background: linear-gradient(90deg,oklch(23.27% 0.0249 284.3),#818CF8,oklch(23.27% 0.0249 284.3)); background-size:200% auto; animation:ciShine 2s linear infinite; }
          .ci-day-checked{ background: linear-gradient(135deg,oklch(23.27% 0.0249 284.3),#818CF8) !important; color:#fff !important; border-color:oklch(23.27% 0.0249 284.3) !important; }
          .ci-day-today{ outline: 2px solid #f59e0b; outline-offset: 1px; }
        `}</style>

        {/* 签到成功动效 */}
        {justChecked && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 rounded-2xl">
            <div className="bg-base-100 p-6 px-10 rounded-2xl text-center border border-primary" style={{ animation: 'ciPop .4s ease' }}>
              <div className="text-5xl mb-2">🎉</div>
              <div className="text-xl font-extrabold text-base-content mb-1">签到成功！</div>
              <div className="text-sm text-primary font-semibold">连续签到 {data.streak} 天</div>
            </div>
          </div>
        )}

        {/* 头部 */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="text-lg font-bold text-base-content mb-1">
              📅 每日签到
            </div>
            <div className="text-sm text-gray-500">
              已累计签到 <b className="text-base-content">{data.total}</b> 天
            </div>
          </div>
          <button
            onClick={handleCheckIn}
            disabled={isCheckedToday}
            className={`btn btn-primary ${isCheckedToday ? '' : 'ci-btn-checked'}`}
          >
            {isCheckedToday ? '✓ 已签到' : '立即签到'}
          </button>
        </div>

        {/* 连续签到展示 */}
        <div className="flex items-center gap-4 p-4 bg-primary/10 rounded-xl mb-4">
          <div className="text-4xl">🔥</div>
          <div className="flex-1">
            <div className="text-2xl font-black text-primary leading-none">
              {data.streak} <span className="text-sm font-semibold">天连续签到</span>
            </div>
            {nextMilestone && (
              <div className="mt-2">
                <div className="text-xs text-gray-500 mb-1">
                  距离 {nextMilestone.label} {nextMilestone.emoji} 还差 {nextMilestone.days - data.streak} 天
                </div>
                <div className="w-full bg-base-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-primary h-1.5 rounded-full transition-all duration-500"
                    style={{ width: progressToNext + '%' }}
                  />
                </div>
              </div>
            )}
            {!nextMilestone && (
              <div className="text-xs text-primary font-semibold mt-1">
                🏆 已达成所有里程碑，太厉害了！
              </div>
            )}
          </div>
        </div>

        {/* 里程碑展示 */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {REWARD_MILESTONES.map(m => {
            const achieved = data.streak >= m.days
            return (
              <div key={m.days} className={`flex-1 min-w-[60px] p-2 rounded-lg text-center ${achieved ? 'bg-primary/10 border border-primary' : 'bg-base-200 border border-base-300 opacity-50'}`}>
                <div className="text-lg">{achieved ? m.emoji : '🔒'}</div>
                <div className={`text-xs font-semibold mt-0.5 ${achieved ? 'text-primary' : 'text-gray-500'}`}>{m.days}天</div>
              </div>
            )
          })}
        </div>

        {/* 本月签到日历切换 */}
        <button
          onClick={() => setShowCalendar(s => !s)}
          className="w-full p-2 rounded-lg border border-base-300 bg-base-200 text-gray-500 text-xs flex justify-between items-center"
        >
          <span>本月签到日历</span>
          <span>{showCalendar ? '▲ 收起' : '▼ 展开'}</span>
        </button>

        {/* 本月签到日历 */}
        {showCalendar && (
          <div className="mt-3">
            <div className="grid grid-cols-7 gap-1 mb-1">
              {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                <div key={d} className="text-center text-xs text-gray-500 font-semibold">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {monthDays.map((d, i) => {
                if (!d) return <div key={i} />
                return (
                  <div
                    key={i}
                    className={`aspect-square flex items-center justify-center rounded-md text-xs font-semibold border ${d.checked ? 'ci-day-checked' : 'bg-base-200 border-base-300 text-base-content'} ${d.isToday ? 'ci-day-today' : ''}`}
                  >
                    {d.day}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
