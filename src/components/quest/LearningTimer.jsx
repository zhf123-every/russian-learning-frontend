import { useState, useEffect, useRef } from 'react'

// ================= 学习计时器组件 =================
// 对齐官方 courseTimer + learningTimeTracker：
// - 当前课程用时（从进入课程开始计时，暂停时停止）
// - 今日累计学习时长（localStorage 按日期持久化，每30秒自动保存）
// - 支持显示/隐藏切换，紧凑样式适配顶部工具栏

const STORAGE_PREFIX = 'rlearn_learning_time'

function getTodayKey() {
  const d = new Date()
  return `${STORAGE_PREFIX}_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function loadTodaySeconds() {
  try {
    const v = localStorage.getItem(getTodayKey())
    return v ? parseInt(v) || 0 : 0
  } catch { return 0 }
}

function saveTodaySeconds(sec) {
  try { localStorage.setItem(getTodayKey(), String(sec)) } catch { /* 忽略 */ }
}

export function formatSeconds(sec) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function formatMinutes(sec) {
  return Math.max(1, Math.ceil(sec / 60)).toString()
}

export default function LearningTimer({
  elapsed,           // 当前课程用时（秒），由父组件传入
  paused = false,    // 是否暂停（暂停时今日计时也停止）
  active = false,    // 是否在答题页（只有答题页才累计今日时长）
  theme,
  dark = true,
  showToday = true,  // 是否显示今日累计时长
  compact = false,   // 紧凑模式（只显示当前用时）
}) {
  const [todaySec, setTodaySec] = useState(() => loadTodaySeconds())
  const timerRef = useRef(null)
  const saveTimerRef = useRef(null)

  // 今日学习时长追踪：只有在答题页且未暂停时才累计
  useEffect(() => {
    if (active && !paused) {
      timerRef.current = setInterval(() => {
        setTodaySec(prev => {
          const next = prev + 1
          return next
        })
      }, 1000)
      // 每30秒自动保存
      saveTimerRef.current = setInterval(() => {
        setTodaySec(prev => {
          saveTodaySeconds(prev)
          return prev
        })
      }, 30000)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (saveTimerRef.current) clearInterval(saveTimerRef.current)
    }
  }, [active, paused])

  // 组件卸载时保存
  useEffect(() => {
    return () => saveTodaySeconds(todaySec)
  }, [todaySec])

  // 页面隐藏时保存
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'hidden') {
        setTodaySec(prev => { saveTodaySeconds(prev); return prev })
      }
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [])

  const T = theme || {
    text: dark ? '#F5EDE2' : '#1a1a2e',
    sub: dark ? '#8B7FA3' : '#666',
    brand: '#6366F1',
    bgSoft: dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.03)',
    border: dark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.08)',
  }

  if (compact) {
    return (
      <span style={{
        fontSize: 13, fontWeight: 600, color: T.sub,
        fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace',
        display: 'inline-flex', alignItems: 'center', gap: 4,
      }}>
        <span style={{ fontSize: 12 }}>⏱</span>
        {formatSeconds(elapsed)}
      </span>
    )
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: compact ? '4px 10px' : '6px 14px',
      background: T.bgSoft, borderRadius: 10, border: '1px solid ' + T.border,
    }}>
      {/* 当前课程用时 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontSize: 13 }}>⏱</span>
        <span style={{
          fontSize: 13.5, fontWeight: 700, color: T.text,
          fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace',
        }}>{formatSeconds(elapsed)}</span>
      </div>

      {/* 今日累计时长 */}
      {showToday && (
        <>
          <div style={{ width: 1, height: 16, background: T.border }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 12 }}>📅</span>
            <span style={{ fontSize: 12, color: T.sub }}>今日</span>
            <span style={{
              fontSize: 13, fontWeight: 700, color: T.brand,
              fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace',
            }}>{formatMinutes(todaySec)}<span style={{ fontSize: 11, fontWeight: 500 }}>分钟</span></span>
          </div>
        </>
      )}
    </div>
  )
}

// Hook：供父组件获取今日学习时长（用于结算页展示）
export function useTodayLearningTime() {
  const [todaySec, setTodaySec] = useState(() => loadTodaySeconds())
  useEffect(() => {
    const refresh = () => setTodaySec(loadTodaySeconds())
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [])
  return { todaySec, todayMinutes: formatMinutes(todaySec) }
}
