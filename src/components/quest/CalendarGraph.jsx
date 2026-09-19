import { useMemo, useState } from 'react'

// ================= 年度学习热力图（GitHub 风格贡献图） =================
// 读取 LearningTimer 写入的每日学习时长（rlearn_learning_time_YYYY-MM-DD）
// 生成过去 52 周的贡献热力图，颜色深浅代表学习时长

const STORAGE_PREFIX = 'rlearn_learning_time'

function getDayKey(date) {
  return `${STORAGE_PREFIX}_${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function loadDaySeconds(date) {
  try {
    const v = localStorage.getItem(getDayKey(date))
    return v ? parseInt(v) || 0 : 0
  } catch { return 0 }
}

// 颜色等级（GitHub 风格绿色系 4 档，对齐 Earthworm：#9be9a8 → #216e39）
function getColor(seconds, theme) {
  if (seconds <= 0) return theme === 'dark' ? 'rgba(255,255,255,.06)' : '#ebedf0'
  if (seconds < 300) return theme === 'dark' ? '#0e4429' : '#9be9a8'
  if (seconds < 900) return theme === 'dark' ? '#006d32' : '#40c463'
  if (seconds < 1800) return theme === 'dark' ? '#26a641' : '#30a14e'
  return theme === 'dark' ? '#39d353' : '#216e39'
}

function formatDuration(sec) {
  if (sec <= 0) return '未学习'
  const m = Math.floor(sec / 60)
  if (m < 60) return `${m} 分钟`
  const h = Math.floor(m / 60)
  const rm = m % 60
  return `${h} 小时 ${rm} 分`
}

const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
const WEEKDAY_LABELS = ['一', '三', '五']

export default function CalendarGraph({
  theme = 'light',  // 'light' | 'dark'
  onDayClick,        // (date, seconds) => void 可选
}) {
  const [hover, setHover] = useState(null) // { date, seconds, x, y }

  // 生成过去 52 周（364天）的数据
  const { weeks, totalDays, totalSeconds, activeDays, currentStreak, longestStreak } = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // 找到52周前的周日（或周一）
    const start = new Date(today)
    start.setDate(start.getDate() - 364)
    // 调整到周日
    const dayOfWeek = start.getDay()
    start.setDate(start.getDate() - dayOfWeek)

    const weeks = []
    let totalSec = 0
    let active = 0
    const dayData = []

    // 生成所有天
    const cursor = new Date(start)
    while (cursor <= today) {
      const sec = loadDaySeconds(cursor)
      const dayInfo = {
        date: new Date(cursor),
        seconds: sec,
        dateStr: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`,
      }
      dayData.push(dayInfo)
      totalSec += sec
      if (sec > 0) active++
      cursor.setDate(cursor.getDate() + 1)
    }

    // 按周分组
    for (let i = 0; i < dayData.length; i += 7) {
      weeks.push(dayData.slice(i, i + 7))
    }

    // 计算连续打卡天数（从今天往前数）
    let streak = 0
    for (let i = dayData.length - 1; i >= 0; i--) {
      if (dayData[i].seconds > 0) streak++
      else break
    }

    // 计算最长连续打卡
    let longest = 0
    let current = 0
    for (const d of dayData) {
      if (d.seconds > 0) { current++; longest = Math.max(longest, current) }
      else current = 0
    }

    return {
      weeks,
      totalDays: dayData.length,
      totalSeconds: totalSec,
      activeDays: active,
      currentStreak: streak,
      longestStreak: longest,
    }
  }, [])

  const T = theme === 'dark'
    ? { text: '#F5EDE2', sub: '#8B7FA3', border: 'rgba(255,255,255,.1)', bg: '#1B1330' }
    : { text: '#1a1a2e', sub: '#666', border: '#e5e7eb', bg: '#ffffff' }

  // 计算月份标签位置
  const monthPositions = useMemo(() => {
    const positions = []
    let lastMonth = -1
    weeks.forEach((week, wi) => {
      const firstDay = week[0]
      if (firstDay && firstDay.date.getMonth() !== lastMonth) {
        positions.push({ month: firstDay.date.getMonth(), week: wi })
        lastMonth = firstDay.date.getMonth()
      }
    })
    return positions
  }, [weeks])

  return (
    <div style={{
      padding: 16, borderRadius: 14, border: '1px solid ' + T.border,
      background: T.bg, overflowX: 'auto',
    }}>
      <style>{`
        .cg-cell{ transition: transform .1s ease; cursor: pointer; }
        .cg-cell:hover{ transform: scale(1.25); outline: 2px solid ${theme === 'dark' ? '#818CF8' : '#6366F1'}; outline-offset: 1px; }
        .cg-tooltip{ position: fixed; z-index: 9999; pointer-events: none;
          background: ${theme === 'dark' ? '#2d1f4e' : '#1a1a2e'}; color: #fff;
          padding: '8px 12px'; border-radius: 8px; font-size: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,.3); white-space: nowrap;
          transform: translate(-50%, -120%); }
      `}</style>

      {/* 统计摘要 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>
          📊 年度学习热力图
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: T.sub }}>
          <span>累计 <b style={{ color: T.text }}>{formatDuration(totalSeconds)}</b></span>
          <span>活跃 <b style={{ color: T.text }}>{activeDays}</b> 天</span>
          <span>连续 <b style={{ color: '#6366F1' }}>{currentStreak}</b> 天</span>
          <span>最长 <b style={{ color: '#6366F1' }}>{longestStreak}</b> 天</span>
        </div>
      </div>

      {/* 热力图主体 */}
      <div style={{ display: 'flex', gap: 4, minWidth: 680 }}>
        {/* 星期标签 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingTop: 20, width: 16 }}>
          {WEEKDAY_LABELS.map((label, i) => (
            <div key={i} style={{
              height: 12, fontSize: 10, color: T.sub, lineHeight: '12px',
              marginTop: i === 0 ? 0 : 12,
            }}>{label}</div>
          ))}
        </div>

        {/* 月份标签 + 格子 */}
        <div style={{ flex: 1 }}>
          {/* 月份标签 */}
          <div style={{ display: 'flex', gap: 3, marginBottom: 4, height: 14, position: 'relative' }}>
            {monthPositions.map(({ month, week }, i) => (
              <div key={i} style={{
                position: 'absolute',
                top: 0, left: 0,
                marginLeft: week * 15,
                fontSize: 10, color: T.sub, whiteSpace: 'nowrap',
              }}>{MONTH_LABELS[month]}</div>
            ))}
          </div>

          {/* 周列 */}
          <div style={{ display: 'flex', gap: 3 }}>
            {weeks.map((week, wi) => (
              <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {week.map((day, di) => {
                  if (!day) return <div key={di} style={{ width: 12, height: 12 }} />
                  return (
                    <div
                      key={di}
                      className="cg-cell"
                      style={{
                        width: 12, height: 12, borderRadius: 3,
                        background: getColor(day.seconds, theme),
                      }}
                      onMouseEnter={(e) => {
                        const rect = e.target.getBoundingClientRect()
                        setHover({
                          date: day.dateStr,
                          seconds: day.seconds,
                          x: rect.left + rect.width / 2,
                          y: rect.top,
                        })
                      }}
                      onMouseLeave={() => setHover(null)}
                      onClick={() => onDayClick && onDayClick(day.date, day.seconds)}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 图例 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 12, fontSize: 11, color: T.sub }}>
        <span>少</span>
        {[0, 300, 900, 1800, 3600].map((sec, i) => (
          <div key={i} style={{
            width: 12, height: 12, borderRadius: 3,
            background: getColor(sec, theme),
          }} />
        ))}
        <span>多</span>
      </div>

      {/* Tooltip */}
      {hover && (
        <div className="cg-tooltip" style={{ left: hover.x, top: hover.y }}>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>{hover.date}</div>
          <div>{formatDuration(hover.seconds)}</div>
        </div>
      )}
    </div>
  )
}
