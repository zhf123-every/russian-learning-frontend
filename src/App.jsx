import { Routes, Route, Navigate } from 'react-router-dom'
import './styles/dashboard.css'

import Dashboard from './pages/Dashboard'
import LearnHub from './pages/LearnHub'
import ToolsHub from './pages/ToolsHub'
import ProfileHub from './pages/ProfileHub'
import AppShell from './components/layout/AppShell'

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
import GameStore from './pages/GameStore'
import MyGames from './pages/MyGames'
import GameDetail from './pages/GameDetail'
import CourseDetail from './pages/CourseDetail'
import QuestDictation from './pages/QuestDictation'
import QuestListening from './pages/QuestListening'
import Journey from './pages/Journey'
import VideoStudy from './pages/VideoStudy'
import SaveNotes from './pages/SaveNotes'
import SaveProficiency from './pages/SaveProficiency'
import SaveUnknown from './pages/SaveUnknown'
import AdminDashboard from './pages/AdminDashboard'
import AdminLessons from './pages/AdminLessons'

export default function App() {
  return (
    <Routes>
      {/* 全屏沉浸页：不套外壳（答题 / 听写 / 测试 / 五步精听学习进行页） */}
      <Route path="/quest-practice" element={<QuestPractice />} />
      <Route path="/quest-practice/:courseId" element={<QuestPractice />} />
      <Route path="/quest-dictation" element={<QuestDictation />} />
      <Route path="/quest-dictation/:courseId" element={<QuestDictation />} />
      <Route path="/quest-listening" element={<QuestListening />} />
      <Route path="/quest-listening/:courseId" element={<QuestListening />} />
      <Route path="/test-practice" element={<TestPractice />} />
      <Route path="/square/:videoId" element={<Study />} />
      <Route path="/study/:videoId" element={<Study />} />
      <Route path="/video-study/:videoId" element={<VideoStudy />} />

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
        <Route path="/unlocked-games" element={<GameStore />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/lessons/:id" element={<AdminLessons />} />
        <Route path="/my-games" element={<MyGames />} />
        <Route path="/game/:id" element={<GameDetail />} />
        <Route path="/course/:id" element={<CourseDetail />} />
        <Route path="/journey" element={<Journey />} />
        <Route path="/square" element={<SquarePage />} />
        <Route path="/tutor" element={<TutorChat />} />

        {/* 工具 */}
        <Route path="/vocab" element={<Vocab />} />
        <Route path="/save/notes" element={<SaveNotes />} />
        <Route path="/save/proficiency" element={<SaveProficiency />} />
        <Route path="/save/unknown" element={<SaveUnknown />} />
        <Route path="/dictionary" element={<Dictionary />} />
        <Route path="/profile" element={<Profile />} />

        {/* 旧入口：自定义素材 / 分级课程 / 学习法介绍，统一并入「精听学习」/square */}
        <Route path="/course" element={<Navigate to="/square" replace />} />
        <Route path="/custom" element={<Navigate to="/square" replace />} />
        <Route path="/method" element={<Navigate to="/square" replace />} />
        <Route path="/method/:level" element={<Navigate to="/square" replace />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
