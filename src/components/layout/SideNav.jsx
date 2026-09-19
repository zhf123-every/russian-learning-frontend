import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { NAV_GROUPS } from '../../constants/navConfig'
import { useVocabStore } from '../../store/vocabStore'
import { isDue } from '../../lib/fsrs'
import { loadDone, effectiveDone, doneCount, STEP_IDS } from '../../lib/todayFlow'

function NavItem({ item, onNavigate, badges }) {
  const badge = item.badgeKey && badges && badges[item.badgeKey]
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) => 'db-navitem' + (isActive ? ' active' : '')}
    >
      <span className="ic">{item.icon}</span>
      {item.label}
      {badge ? <span className="db-badge">{badge}</span> : null}
    </NavLink>
  )
}

// 桌面侧栏与手机抽屉共用的导航列表
export function NavList({ onNavigate, badges }) {
  return (
    <>
      {NAV_GROUPS.map((g) => {
        if (g.type === 'item') {
          return <NavItem key={g.to} item={g} onNavigate={onNavigate} badges={badges} />
        }
        return (
          <div key={g.label}>
            <div className="db-navgroup">{g.label}</div>
            {g.items.map((it) => (
              <NavItem key={it.to} item={it} onNavigate={onNavigate} badges={badges} />
            ))}
          </div>
        )
      })}
    </>
  )
}

// 侧栏底部：真实今日训练流进度（复习步无到期生词时自动计完成）
function TodayGoalMini() {
  const navigate = useNavigate()
  const cards = useVocabStore((s) => s.cards)
  const [, setTick] = useState(0)

  useEffect(() => {
    const sync = () => setTick((t) => t + 1)
    window.addEventListener('rlearn:flow-changed', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('rlearn:flow-changed', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const due = cards.filter((c) => isDue(c.fsrs, Date.now())).length
  const eff = effectiveDone(loadDone(), { review: due === 0 })
  const count = doneCount(eff)
  const total = STEP_IDS.length
  const C = 2 * Math.PI * 15.5
  const finished = count >= total

  return (
    <div className="db-sidefoot" style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
      <div className="t">今日目标 <span>{count}/{total}</span></div>
      <div className="row">
        <svg className="ring" viewBox="0 0 36 36" aria-hidden="true">
          <circle cx="18" cy="18" r="15.5" fill="none" stroke="#ECECEF" strokeWidth="4" />
          <circle cx="18" cy="18" r="15.5" fill="none" stroke="#4F46E5" strokeWidth="4"
            strokeLinecap="round" strokeDasharray={`${(count / total) * C} ${C}`}
            transform="rotate(-90 18 18)" />
        </svg>
        <div className="tip">
          {finished
            ? <>今日训练全部完成<br />保持连胜 🔥</>
            : <>再完成 {total - count} 步<br />达成今日目标</>}
        </div>
      </div>
    </div>
  )
}

export default function SideNav() {
  return (
    <aside className="db-sidenav">
      <div className="db-logo">
        <span className="mark ru">А</span>
        俄语学习
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column' }}>
        <NavList />
      </nav>
      <TodayGoalMini />
    </aside>
  )
}
