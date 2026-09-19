import { useDashboardData } from '../hooks/useDashboardData'
import { CASE_ABILITIES, STREAK_DAYS } from '../data/dashboardPlaceholder'
import GreetingHeader from '../components/dashboard/GreetingHeader'
import ContinueLearningCard from '../components/dashboard/ContinueLearningCard'
import GrammarAbilitySection from '../components/dashboard/GrammarAbilitySection'
import TodayActions from '../components/dashboard/TodayActions'
import RightRail from '../components/dashboard/RightRail'
import '../styles/dashboard.css'

export default function Dashboard() {
  const dash = useDashboardData()

  return (
    <div className="db-page">
      <div className="db-container">
        <GreetingHeader streakDays={STREAK_DAYS} />
        <ContinueLearningCard {...dash} />
        <div className="db-grid">
          <main className="db-col-main">
            <GrammarAbilitySection abilities={CASE_ABILITIES} />
            <TodayActions />
          </main>
          <aside className="db-col-side">
            <RightRail />
          </aside>
        </div>
      </div>
    </div>
  )
}
