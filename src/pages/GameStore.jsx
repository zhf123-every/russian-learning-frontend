import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FEATURED, VIDEOS, GUIDES } from '../data/gameLibrary'
import { isCoursePurchased, savePurchase } from '../lib/courseAccess'
import ModePickerModal, { VIDEO_MODES } from '../components/ModePickerModal'
import { toast } from '../lib/toast'

// 解锁游戏 · 课程包商城（总入口）
// 课程类（kind=cover）：已解锁点卡片 → 课程详情页 /game/:id（学习路线+大纲）
// 视频类（kind=video）：已解锁点卡片 → 直接弹练习模式弹窗（整体盲听/逐段盲听/精听/跟读/口语测评）

const CATS = [
  { label: '推荐', cat: 'both' },
  { label: '基础入门', cat: 'guide' },
  { label: '字母发音', cat: 'guide' },
  { label: '场景对话', cat: 'guide' },
  { label: '语法专练', cat: 'guide' },
  { label: '听力训练', cat: 'guide' },
  { label: '阅读提升', cat: 'guide' },
  { label: '影视音乐', cat: 'video' },
  { label: '考试备考', cat: 'guide' },
  { label: '全部', cat: 'both' },
]

function PlayBadge() {
  return (
    <span className="w-11 h-11 rounded-full bg-white/25 backdrop-blur flex items-center justify-center">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><polygon points="6 4 20 12 6 20 6 4" /></svg>
    </span>
  )
}

function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
  )
}

// 解锁 / 已解锁操作区
function UnlockBar({ game, onVideoStart }) {
  const unlocked = isCoursePurchased(game.id)
  if (unlocked) {
    // 视频类：卡片点击本身弹弹窗，这里不再放“去学习”
    if (game.kind === 'video') {
      return (
        <div className="mt-2.5 flex items-center">
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            已解锁 · 点卡片选模式
          </span>
        </div>
      )
    }
    // 课程类：去学习 → 课程详情页
    return (
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          已解锁
        </span>
        <Link to={`/game/${game.id}`} className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-0.5">
          去学习 <ChevronRight />
        </Link>
      </div>
    )
  }
  return (
    <div className="mt-2.5">
      <button
        type="button"
        onClick={() => savePurchase(game.id, { kind: 'unlock' })}
        className="w-full h-8 rounded-lg bg-primary text-white text-xs font-bold transition hover:brightness-110 active:scale-[.98]"
      >
        🔓 解锁
      </button>
    </div>
  )
}

export default function GameStore() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('all')
  const [menuOpen, setMenuOpen] = useState(false)
  const [, setTick] = useState(0)
  const [videoTarget, setVideoTarget] = useState(null) // 视频类卡片 → 弹窗

  useEffect(() => {
    const sync = () => setTick((t) => t + 1)
    window.addEventListener('rlearn:purchase-changed', sync)
    return () => window.removeEventListener('rlearn:purchase-changed', sync)
  }, [])

  const visibleCats = mode === 'all' ? CATS : CATS.filter(c => c.cat === 'both' || c.cat === mode)
  const modeLabel = mode === 'video' ? ' · 通关视频' : mode === 'guide' ? ' · 通关秘籍' : ''

  const pick = (m) => { setMode(m); setMenuOpen(false) }

  const menuItem = (key, icon, label) => (
    <button
      type="button"
      onClick={() => pick(key)}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer transition ${
        mode === key ? 'bg-base-200 font-semibold text-primary' : 'text-gray-700 hover:bg-base-200'
      }`}
    >
      {icon}{label}
    </button>
  )

  // 课程类已解锁 → 进详情；未解锁 → 不响应点击（只能先解锁）
  const onCoverCardClick = (it) => {
    if (isCoursePurchased(it.id)) navigate(`/game/${it.id}`)
  }
  // 视频类已解锁 → 弹练习模式弹窗
  const onVideoCardClick = (v) => {
    if (isCoursePurchased(v.id)) setVideoTarget(v)
  }

  // 视频弹窗“开始”：演示视频暂无真实素材，提示即将接入
  const onVideoStart = (mode) => {
    setVideoTarget(null)
    toast(`「${mode.name}」已选好，演示视频正式素材即将上线`)
  }

  return (
    <div className="min-h-full bg-base-100">

      {/* ===== 顶部商城导航 ===== */}
      <header className="store-subbar bg-base-100 border-b border-base-200">
        <div className="flex items-center gap-6 px-6 h-16 max-w-[1440px] mx-auto">
          <details open={menuOpen} onToggle={(e) => setMenuOpen(e.currentTarget.open)} className="relative shrink-0 group">
            <summary className="list-none [&::-webkit-details-marker]:hidden flex items-center gap-2 font-extrabold text-lg text-base-content cursor-pointer select-none">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
              </svg>
              解锁游戏<span>{modeLabel}</span>
              <svg className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
            </summary>
            <div className="absolute left-0 top-full mt-2 w-52 bg-base-100 border border-base-200 rounded-2xl shadow-xl overflow-hidden z-30 py-1.5">
              {menuItem('all',
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><path d="M9 22V12h6v10" /></svg>,
                '全部内容')}
              <div className="h-px bg-base-200 my-1" />
              {menuItem('video',
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" /></svg>,
                '通关视频')}
              {menuItem('guide',
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /></svg>,
                '通关秘籍')}
            </div>
          </details>

          <nav className="flex-1 flex items-center gap-6 overflow-x-auto no-scrollbar text-[15px] whitespace-nowrap">
            {visibleCats.map((c, i) => (
              <a key={c.label} className={`py-2 transition cursor-pointer ${
                i === 0 ? 'relative font-semibold text-primary after:absolute after:left-0 after:right-0 after:-bottom-[1px] after:h-[3px] after:rounded-full after:bg-primary'
                : 'text-gray-500 hover:text-primary'
              }`}>{c.label}</a>
            ))}
          </nav>

          <div className="relative hidden lg:block w-64 shrink-0">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
            <input className="w-full h-9 pl-9 pr-3 rounded-full bg-base-200 text-sm outline-none placeholder:text-gray-400" placeholder="大家都在搜：免费" />
          </div>
        </div>
      </header>

      <main className="px-6 py-7 max-w-[1440px] mx-auto">

        {/* ===== 本周精选游戏 ===== */}
        <section>
          <h2 className="text-2xl font-extrabold mb-4">本周精选游戏</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {FEATURED.map((it) => {
              const unlocked = isCoursePurchased(it.id)
              return (
                <div key={it.id} className="group" onClick={() => onCoverCardClick(it)} style={{ cursor: unlocked ? 'pointer' : 'default' }}>
                  <div className={`aspect-[3/2] rounded-xl overflow-hidden mb-2 p-3 flex flex-col justify-end group-hover:shadow-lg transition ${it.cover}`}>
                    <span className={`text-lg font-extrabold leading-tight drop-shadow ${it.ink}`}>{it.big}</span>
                  </div>
                  <div className="text-sm font-bold leading-snug">{it.title}</div>
                  <div className="text-xs text-gray-400 mt-1">{it.meta}</div>
                  <UnlockBar game={it} />
                </div>
              )
            })}
          </div>
        </section>

        {/* ===== 通关视频 ===== */}
        {mode !== 'guide' && (
          <section className="mt-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-extrabold">通关视频</h2>
              <a className="text-sm text-gray-400 hover:text-primary flex items-center gap-1 cursor-pointer">
                更多视频 <ChevronRight />
              </a>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {VIDEOS.map((v) => {
                const unlocked = isCoursePurchased(v.id)
                return (
                  <div key={v.id} className="group" onClick={() => onVideoCardClick(v)} style={{ cursor: unlocked ? 'pointer' : 'default' }}>
                    <div className={`aspect-video rounded-xl overflow-hidden mb-2 bg-gradient-to-br ${v.cover} flex items-center justify-center group-hover:shadow-lg transition relative`}>
                      <span className="w-9 h-9 rounded-full bg-white/25 backdrop-blur flex items-center justify-center">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><polygon points="6 4 20 12 6 20 6 4" /></svg>
                      </span>
                      <span className="absolute bottom-1.5 right-2 text-[11px] text-white bg-black/40 rounded px-1.5 py-0.5">{v.eps}</span>
                    </div>
                    <div className="text-sm font-semibold">{v.title}</div>
                    <UnlockBar game={v} />
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ===== 通关秘籍 ===== */}
        {mode !== 'video' && (
          <section className="mt-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-extrabold">通关秘籍</h2>
              <a className="text-sm text-gray-400 hover:text-primary flex items-center gap-1 cursor-pointer">
                更多课程 <ChevronRight />
              </a>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {GUIDES.map((g) => {
                const unlocked = isCoursePurchased(g.id)
                return (
                  <div key={g.id} className="group" onClick={() => onCoverCardClick(g)} style={{ cursor: unlocked ? 'pointer' : 'default' }}>
                    <div className={`aspect-video rounded-xl overflow-hidden mb-2 bg-gradient-to-br ${g.cover} flex items-center justify-center group-hover:shadow-lg transition`}>
                      <span className={`font-extrabold text-base ${g.ink} ${g.title.startsWith('字母') ? 'tracking-widest' : ''}`}>{g.word}</span>
                    </div>
                    <div className="text-sm font-semibold">{g.title}</div>
                    <UnlockBar game={g} />
                  </div>
                )
              })}
            </div>
          </section>
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
