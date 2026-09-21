import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GAME_CATALOG, findGameById } from '../data/gameLibrary'
import { getPurchasedMap } from '../lib/courseAccess'
import ModePickerModal, { VIDEO_MODES } from '../components/ModePickerModal'
import { toast } from '../lib/toast'

// 我的游戏：展示已解锁课程
// 课程类（kind=cover）：点卡片 → 课程详情页 /game/:id
// 视频类（kind=video）：点卡片 → 直接弹练习模式弹窗

const GROUPS = [
  { name: '入门俄语', count: '2 个游戏' },
  { name: '听力专项', count: '1 个游戏' },
]

function FolderMark({ size = 44, strokeWidth = 1.6 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className="text-primary">
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
    </svg>
  )
}

function PlayBadge() {
  return (
    <span className="w-11 h-11 rounded-full bg-white/25 backdrop-blur flex items-center justify-center">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><polygon points="6 4 20 12 6 20 6 4" /></svg>
    </span>
  )
}

function ChevronRight() {
  return (
    <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
  )
}

function GameCard({ g, onVideoClick }) {
  const coverCls = `bg-gradient-to-br ${g.cover}`
  const bigText = g.big || g.word
  const ink = g.ink || 'text-white'

  // 视频类：点卡片弹模式弹窗
  if (g.kind === 'video') {
    return (
      <div className="cursor-pointer group block" onClick={() => onVideoClick(g)}>
        <div className={`aspect-[4/3] rounded-xl overflow-hidden mb-2.5 p-4 flex items-center justify-center group-hover:shadow-lg transition relative ${coverCls}`}>
          <PlayBadge />
        </div>
        <div className="text-sm font-bold leading-snug">{g.title}</div>
        <div className="text-xs text-gray-400 mt-1 leading-relaxed line-clamp-2">{g.desc}</div>
      </div>
    )
  }

  // 课程类：点卡片进课程详情页
  return (
    <Link to={`/game/${g.id}`} className="cursor-pointer group block">
      <div className={`aspect-[4/3] rounded-xl overflow-hidden mb-2.5 p-4 flex items-center justify-center group-hover:shadow-lg transition relative ${coverCls}`}>
        <div className="w-full h-full flex flex-col justify-end">
          <span className={`text-lg font-extrabold leading-tight drop-shadow ${ink}`}>{bigText}</span>
        </div>
      </div>
      <div className="text-sm font-bold leading-snug">{g.title}</div>
      <div className="text-xs text-gray-400 mt-1 leading-relaxed line-clamp-2">{g.desc}</div>
    </Link>
  )
}

export default function MyGames() {
  const navigate = useNavigate()
  const [tick, setTick] = useState(0)
  const [query, setQuery] = useState('')
  const [videoTarget, setVideoTarget] = useState(null)

  useEffect(() => {
    const sync = () => setTick((t) => t + 1)
    window.addEventListener('rlearn:purchase-changed', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('rlearn:purchase-changed', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const unlockedIds = useMemo(() => Object.keys(getPurchasedMap() || {}), [tick])
  const unlockedGames = useMemo(
    () => unlockedIds.map((id) => findGameById(id)).filter(Boolean),
    [unlockedIds],
  )
  const games = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return unlockedGames
    return unlockedGames.filter((g) => g.title.toLowerCase().includes(q))
  }, [unlockedGames, query])

  const onVideoStart = (mode) => {
    setVideoTarget(null)
    toast(`「${mode.name}」已选好，演示视频正式素材即将上线`)
  }

  return (
    <div className="min-h-full bg-base-100">

      {/* ===== 顶部栏 ===== */}
      <header className="px-6 pt-6 max-w-[1440px] mx-auto">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 font-extrabold text-2xl text-base-content">
            <FolderMark size={24} strokeWidth={2} />
            我的游戏
          </div>
          <span className="text-sm text-gray-400">共 <span className="text-primary font-bold">{unlockedGames.length}</span> 个游戏</span>

          <div className="ml-auto flex items-center gap-3">
            <div className="relative w-64">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
              <input
                className="w-full h-9 pl-9 pr-10 rounded-full bg-base-200 text-sm outline-none placeholder:text-gray-400"
                placeholder="搜索我的游戏"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 bg-white rounded px-1.5 py-0.5 border border-base-300">Ctrl K</kbd>
            </div>
            <button type="button" disabled title="即将上线" className="h-9 px-4 inline-flex items-center gap-1.5 rounded-full bg-base-100 border border-base-300 text-sm text-gray-400 opacity-60 cursor-not-allowed">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
              筛选 · 即将上线
            </button>
          </div>
        </div>
      </header>

      <main className="px-6 py-6 max-w-[1440px] mx-auto">

        <Link to="/unlocked-games" className="mb-7 flex items-center gap-3 rounded-2xl bg-base-200 px-5 py-3.5 cursor-pointer hover:bg-base-300/60 transition">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-primary">
            <path d="M6 11h4M8 9v4M15 12h.01M18 10h.01M2 16a2 2 0 002 2h16a2 2 0 002-2V10a2 2 0 00-2-2H4a2 2 0 00-2 2z" />
          </svg>
          <span className="text-sm text-gray-700">想添加新游戏？去<span className="text-primary font-semibold">解锁游戏</span>商城挑选课程包</span>
          <span className="ml-auto"><ChevronRight /></span>
        </Link>

        {/* ===== 游戏组（占位） ===== */}
        <div className="text-sm font-semibold text-gray-500 mb-3">游戏组</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-10">
          {GROUPS.map((grp) => (
            <div key={grp.name} className="cursor-pointer group">
              <div className="aspect-[4/3] rounded-xl overflow-hidden mb-2.5 bg-primary/5 flex items-center justify-center group-hover:shadow-lg transition">
                <FolderMark />
              </div>
              <div className="text-sm font-bold">{grp.name}</div>
              <div className="text-xs text-gray-400 mt-0.5">{grp.count}</div>
            </div>
          ))}
          <button type="button" disabled title="即将上线" className="cursor-not-allowed aspect-[4/3] rounded-xl border-2 border-dashed border-base-300 flex flex-col items-center justify-center gap-2 text-gray-400 opacity-60 bg-transparent">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
              <line x1="12" y1="11" x2="12" y2="17" /><line x1="9" y1="14" x2="15" y2="14" />
            </svg>
            <span className="text-sm font-medium">新建游戏组 · 即将上线</span>
          </button>
        </div>

        {/* ===== 全部游戏 ===== */}
        <div className="text-sm font-semibold text-gray-500 mb-3">全部游戏</div>
        {games.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-base-300 py-16 px-6 text-center">
            <div className="text-4xl mb-3">🎮</div>
            <div className="text-base font-bold text-base-content">
              {unlockedGames.length === 0 ? '还没有解锁任何游戏' : '没有找到匹配的游戏'}
            </div>
            <p className="text-sm text-gray-400 mt-1.5 max-w-md mx-auto leading-relaxed">
              {unlockedGames.length === 0
                ? '去「解锁游戏」商城挑选课程包，解锁后会同步显示在这里'
                : '换个关键词试试'}
            </p>
            <Link to="/unlocked-games" className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-primary text-white text-sm font-bold px-6 py-2.5 hover:brightness-110 transition">
              去商城解锁
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {games.map((g) => <GameCard key={g.id} g={g} onVideoClick={setVideoTarget} />)}
          </div>
        )}

      </main>

      {/* ===== 视频类 · 练习模式弹窗 ===== */}
      {videoTarget && (
        <ModePickerModal
          title={videoTarget.title}
          modes={VIDEO_MODES}
          onClose={() => setVideoTarget(null)}
          onStart={onVideoStart}
        />
      )}
    </div>
  )
}
