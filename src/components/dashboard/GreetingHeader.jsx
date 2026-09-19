import { useEffect, useState } from 'react'
import { getStreak } from '../../lib/todayFlow'

export default function GreetingHeader() {
  const [streak, setStreak] = useState(0)

  useEffect(() => {
    const sync = () => setStreak(getStreak())
    sync()
    window.addEventListener('rlearn:flow-changed', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('rlearn:flow-changed', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const h = new Date().getHours()
  const g = h < 5 ? '夜深了' : h < 11 ? '早上好' : h < 14 ? '中午好' : h < 18 ? '下午好' : '晚上好'
  const sub = streak > 0
    ? `今天是连续学习的第 ${streak} 天，完成今日训练保持节奏`
    : '从今日训练开始，开启你的学习连胜'

  return (
    <div className="db-hello">
      <div>
        <h3>{g}，学习者</h3>
        <p>{sub}</p>
      </div>
      {streak > 0 && <div className="db-streak">🔥 已连胜 {streak} 天</div>}
    </div>
  )
}
