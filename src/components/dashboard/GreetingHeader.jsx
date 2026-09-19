export default function GreetingHeader({ streakDays }) {
  const h = new Date().getHours()
  const g = h < 5 ? '夜深了' : h < 11 ? '早上好' : h < 14 ? '中午好' : h < 18 ? '下午好' : '晚上好'
  return (
    <div className="db-hello">
      <div>
        <h3>{g}，学习者</h3>
        <p>今天是连续学习的第 {streakDays} 天，保持节奏</p>
      </div>
      <div className="db-streak">🔥 已连胜 {streakDays} 天</div>
    </div>
  )
}
