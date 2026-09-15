import { Routes, Route, Link, useLocation } from 'react-router-dom'
import HomePage from './pages/HomePage'
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

export default function App() {
  const loc = useLocation()

  return (
    <>
      {loc.pathname !== '/quest' && (
        <header className="navbar">
          <div className="navbar-inner">
            <Link className="navbar-brand" to="/">
              <span className="navbar-logo">📖</span>
              <h1 className="navbar-title">Russian Learning</h1>
            </Link>
            <div className="navbar-right">
              <Link className="nav-link hide-sm" to="/custom">导入</Link>
              <Link className="nav-link hide-sm" to="/square">广场</Link>
              <Link className="nav-link" to="/vocab">生词本</Link>
              <Link className="nav-link" to="/dictionary">词典</Link>
              <Link className="nav-link hide-sm" to="/profile">统计</Link>
              <div className="navbar-avatar" title="学习者">Я</div>
            </div>
          </div>
        </header>
      )}
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/course" element={<CoursePage />} />
        <Route path="/custom" element={<CustomMaterials />} />
        <Route path="/method" element={<ShangMethod />} />
        <Route path="/method/:level" element={<ShangMethod />} />
        <Route path="/square" element={<SquarePage />} />
        <Route path="/square/:videoId" element={<Study />} />
        <Route path="/study/:videoId" element={<Study />} />
        <Route path="/vocab" element={<Vocab />} />
        <Route path="/dictionary" element={<Dictionary />} />
        <Route path="/tutor" element={<TutorChat />} />
        <Route path="/quest" element={<RuQuest />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </>
  )
}
