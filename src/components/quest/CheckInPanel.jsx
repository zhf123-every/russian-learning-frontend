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

  const T = theme === 'dark'
    ? { text: '#F5EDE2', sub: '#8B7FA3', border: 'rgba(255,255,255,.1)', bg: '#1B1330', bgSoft: 'rgba(255,255,255,.05)', brand: '#8b5cf6', brandSoft: 'rgba(139,92,246,.15)', ok: '#10B981' }
    : { text: '#1a1a2e', sub: '#666', border: '#e5e7eb', bg: '#ffffff', bgSoft: '#f9fafb', brand: '#7c3aed', brandSoft: 'rgba(124,92,252,.1)', ok: '#22c55e' }

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
    <div style={{
      padding: 20, borderRadius: 16, border: '1px solid ' + T.border,
      background: T.bg, position: 'relative', overflow: 'hidden',
    }}>
      <style>{`
        @keyframes ciPop { 0%{transform:scale(.8); opacity:0} 50%{transform:scale(1.1)} 100%{transform:scale(1); opacity:1} }
        @keyframes ciShine { 0%{background-position:-200% center} 100%{background-position:200% center} }
        .ci-btn-checked{ background: linear-gradient(90deg,#8b5cf6,#a78bfa,#8b5cf6); background-size:200% auto; animation:ciShine 2s linear infinite; }
        .ci-day-checked{ background: linear-gradient(135deg,#8b5cf6,#a78bfa) !important; color:#fff !important; border-color:#8b5cf6 !important; }
        .ci-day-today{ outline: 2px solid #f59e0b; outline-offset: 1px; }
      `}</style>

      {/* 签到成功动效 */}
      {justChecked && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,.3)', zIndex: 10, borderRadius: 16,
        }}>
          <div style={{
            background: T.bg, padding: '24px 36px', borderRadius: 16, textAlign: 'center',
            animation: 'ciPop .4s ease', border: '1px solid ' + T.brand,
          }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🎉</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.text, marginBottom: 4 }}>签到成功！</div>
            <div style={{ fontSize: 14, color: T.brand, fontWeight: 600 }}>连续签到 {data.streak} 天</div>
          </div>
        </div>
      )}

      {/* 头部 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: T.text, marginBottom: 4 }}>
            📅 每日签到
          </div>
          <div style={{ fontSize: 13, color: T.sub }}>
            已累计签到 <b style={{ color: T.text }}>{data.total}</b> 天
          </div>
        </div>
        <button
          onClick={handleCheckIn}
          disabled={isCheckedToday}
          className={isCheckedToday ? '' : 'ci-btn-checked'}
          style={{
            padding: '10px 24px', borderRadius: 12, border: 'none', cursor: isCheckedToday ? 'default' : 'pointer',
            fontSize: 14, fontWeight: 700, color: '#fff',
            background: isCheckedToday ? T.ok : undefined,
            opacity: isCheckedToday ? 0.9 : 1,
            transition: 'all .2s ease',
          }}
        >
          {isCheckedToday ? '✓ 已签到' : '立即签到'}
        </button>
      </div>

      {/* 连续签到展示 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, padding: '14px 16px',
        background: T.brandSoft, borderRadius: 12, marginBottom: 14,
      }}>
        <div style={{ fontSize: 36 }}>🔥</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: T.brand, lineHeight: 1 }}>
            {data.streak} <span style={{ fontSize: 14, fontWeight: 600 }}>天连续签到</span>
          </div>
          {nextMilestone && (
            <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: 11, color: T.sub, marginBottom: 3 }}>
                距离 {nextMilestone.label} {nextMilestone.emoji} 还差 {nextMilestone.days - data.streak} 天
              </div>
              <div style={{ height: 6, background: T.bgSoft, borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: progressToNext + '%',
                  background: `linear-gradient(90deg,${T.brand},#a78bfa)`,
                  borderRadius: 3, transition: 'width .5s ease',
                }} />
              </div>
            </div>
          )}
          {!nextMilestone && (
            <div style={{ fontSize: 12, color: T.brand, fontWeight: 600, marginTop: 4 }}>
              🏆 已达成所有里程碑，太厉害了！
            </div>
          )}
        </div>
      </div>

      {/* 里程碑展示 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {REWARD_MILESTONES.map(m => {
          const achieved = data.streak >= m.days
          return (
            <div key={m.days} style={{
              flex: '1 1 auto', minWidth: 60, padding: '8px 6px', borderRadius: 8,
              background: achieved ? T.brandSoft : T.bgSoft,
              border: '1px solid ' + (achieved ? T.brand : T.border),
              textAlign: 'center', opacity: achieved ? 1 : 0.5,
            }}>
              <div style={{ fontSize: 18 }}>{achieved ? m.emoji : '🔒'}</div>
              <div style={{ fontSize: 10, color: achieved ? T.brand : T.sub, fontWeight: 600, marginTop: 2 }}>{m.days}天</div>
            </div>
          )
        })}
      </div>

      {/* 本月签到日历切换 */}
      <button
        onClick={() => setShowCalendar(s => !s)}
        style={{
          width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid ' + T.border,
          background: T.bgSoft, color: T.sub, fontSize: 12, cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}
      >
        <span>本月签到日历</span>
        <span>{showCalendar ? '▲ 收起' : '▼ 展开'}</span>
      </button>

      {/* 本月签到日历 */}
      {showCalendar && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 6 }}>
            {['日', '一', '二', '三', '四', '五', '六'].map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 11, color: T.sub, fontWeight: 600 }}>{d}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
            {monthDays.map((d, i) => {
              if (!d) return <div key={i} />
              return (
                <div
                  key={i}
                  className={(d.checked ? 'ci-day-checked ' : '') + (d.isToday ? 'ci-day-today' : '')}
                  style={{
                    aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 6, fontSize: 12, fontWeight: 600,
                    background: d.checked ? undefined : T.bgSoft,
                    color: d.checked ? undefined : T.text,
                    border: '1px solid ' + (d.checked ? T.brand : T.border),
                  }}
                >
                  {d.day}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
