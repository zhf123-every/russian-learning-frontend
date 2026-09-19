import { useDashboardData } from '../hooks/useDashboardData'
import GreetingHeader from '../components/dashboard/GreetingHeader'
import ContinueLearningCard from '../components/dashboard/ContinueLearningCard'
import TodayFlow from '../components/dashboard/TodayFlow'
import QuickTools from '../components/dashboard/QuickTools'
import LearningLoopCard from '../components/dashboard/LearningLoopCard'
import '../styles/dashboard.css'

export default function Dashboard() {
  const dash = useDashboardData()

  return (
    <div className="db-page">
      <div className="db-container">
        <GreetingHeader />

        {/* 今日训练流：复习 → 精听 → 闯关 → 口语，一条线串起三大学习模式 */}
        <TodayFlow pack={dash.pack} target={dash.target} loading={dash.loading} />

        <div className="db-grid">
          <main className="db-col-main">
            <ContinueLearningCard {...dash} />
            <LearningLoopCard />
          </main>
          <aside className="db-col-side">
            <QuickTools />
          </aside>
        </div>
      </div>
    </div>
  )
}
