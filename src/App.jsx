import { Routes, Route, Navigate } from 'react-router-dom'
import './styles/dashboard.css'

import Dashboard from './pages/Dashboard'
import LearnHub from './pages/LearnHub'
import ToolsHub from './pages/ToolsHub'
import ProfileHub from './pages/ProfileHub'
import AppShell from './components/layout/AppShell'

import CoursePage from './pages/CoursePage'
import CustomMaterials from './pages/CustomMaterials'
import ShangMethod from './pages/ShangMethod'
import SquarePage from './pages/SquarePage'
import Study from './pages/Study'
import Vocab from './pages/Vocab'
import Profile from './pages/Profile'
import Dictionary from './pages/Dictionary'
import TutorChat from './pages/TutorChat'
import RuQuest from './pages/RuQuest'
import TestPractice from './pages/TestPractice'
import QuestPractice from './pages/QuestPractice'
import CourseStore from './pages/CourseStore'
import QuestDictation from './pages/QuestDictation'

export default function App() {
  return (
    <Routes>
      {/* 全屏沉浸页：不套外壳（答题 / 听写 / 测试 / 五步精听学习进行页） */}
      <Route path="/quest-practice" element={<QuestPractice />} />
      <Route path="/quest-practice/:courseId" element={<QuestPractice />} />
      <Route path="/quest-dictation" element={<QuestDictation />} />
      <Route path="/quest-dictation/:courseId" element={<QuestDictation />} />
      <Route path="/test-practice" element={<TestPractice />} />
      <Route path="/square/:videoId" element={<Study />} />
      <Route path="/study/:videoId" element={<Study />} />

      {/* 浏览类页面：统一套 AppShell（桌面侧栏 / 手机顶栏+底栏） */}
      <Route element={<AppShell />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/learn" element={<LearnHub />} />
        <Route path="/tools" element={<ToolsHub />} />
        <Route path="/me" element={<ProfileHub />} />

        {/* 学习 */}
        <Route path="/quest" element={<RuQuest />} />
        <Route path="/quest/:packId" element={<RuQuest />} />
        <Route path="/quest-store" element={<CourseStore />} />
        <Route path="/square" element={<SquarePage />} />
        <Route path="/tutor" element={<TutorChat />} />

        {/* 工具 */}
        <Route path="/vocab" element={<Vocab />} />
        <Route path="/dictionary" element={<Dictionary />} />
        <Route path="/profile" element={<Profile />} />

        {/* 旧入口：导航已移除，路由暂留防死链，第二批整合后重定向 */}
        <Route path="/course" element={<CoursePage />} />
        <Route path="/custom" element={<CustomMaterials />} />
        <Route path="/method" element={<ShangMethod />} />
        <Route path="/method/:level" element={<ShangMethod />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
