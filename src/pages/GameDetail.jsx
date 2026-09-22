// 课程详情页（课程类：学习路线 + 大纲）
// /game/:id  —— 课程类（kind=cover）进来；视频类不走这里，直接弹模式弹窗
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { findGameById } from '../data/gameLibrary'
import { API_BASE } from '../lib/api'
import ModePickerModal, { COURSE_MODES } from '../components/ModePickerModal'

// 难度 / 状态 样式（与 RuQuest 对齐）
const DIFF_META = {
  easy: { label: '简单', color: '#16a34a', bg: '#DCFCE7' },
  medium: { label: '中等', color: '#d97706', bg: '#FEF3C7' },
  hard: { label: '困难', color: '#dc2626', bg: '#FEE2E2' },
}
const STATUS_META = {
  '未开始': { label: '未开始', color: '#9ca3af', bg: '#F3F4F6' },
  '进行中': { label: '进行中', color: '#7c3aed', bg: '#EDE9FE' },
  '已完成': { label: '已完成 ✓', color: '#16a34a', bg: '#DCFCE7' },
}

// 演示课程：没有后端大纲时，生成示例单元（标“演示”）
function makeDemoUnits(game) {
  const total = game.total || 10
  return Array.from({ length: total }, (_, i) => ({
    id: 'demo-' + (game.id) + '-' + (i + 1),
    title: `第 ${i + 1} 课`,
    description: game.title,
    status: i === 0 ? '进行中' : '未开始',
    difficulty: i % 3 === 0 ? 'medium' : 'easy',
    demo: true,
  }))
}

export default function GameDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const game = findGameById(id)

  const [units, setUnits] = useState([])
  const [loading, setLoading] = useState(true)
  const [isDemo, setIsDemo] = useState(false)
  const [pickedUnit, setPickedUnit] = useState(null)

  useEffect(() => {
    if (!game) { setLoading(false); return }
    if (game.packId) {
      // 本地预览（localhost）走相对路径，由 vite proxy 转发避免跨域；线上 Netlify 用 API_BASE 完整地址
      const isLocal = /^localhost|^127\./.test(location.hostname)
      const base = isLocal ? '' : (API_BASE || '')
      fetch(`${base}/api/course-packs/${game.packId}/units`)
        .then((r) => r.json())
        .then((data) => {
          // 后端返回 {ok, data:{pack, units:[...]}}；兼容直接数组 / {units} / {items}
          const list = (data && data.data && data.data.units) || (data && data.units) || (Array.isArray(data) ? data : [])
          setUnits(list.length ? list : makeDemoUnits(game))
          setIsDemo(!list.length)
          setLoading(false)
        })
        .catch(() => { setUnits(makeDemoUnits(game)); setIsDemo(true); setLoading(false) })
    } else {
      setUnits(makeDemoUnits(game)); setIsDemo(true); setLoading(false)
    }
  }, [game])

  if (!game) {
    return (
      <div className="db-page"><div className="db-container" style={{ padding: 60, textAlign: 'center' }}>
        <div style={{ fontSize: 40 }}>🕹️</div>
        <h2>课程不存在或已下线</h2>
        <button className="btn sm primary" onClick={() => navigate('/unlocked-games')}>回商城看看</button>
      </div></div>
    )
  }

  const doneCount = units.filter((u) => u.status === '已完成').length
  const doingCount = units.filter((u) => u.status === '进行中').length
  const progress = units.length ? Math.round((doneCount / units.length) * 100) : 0

  // 弹窗点“开始”：按模式跳对应学习页
  const handleStart = (mode) => {
    const u = pickedUnit
    setPickedUnit(null)
    if (!u) return
    const packQ = game.packId ? `?pack=${game.packId}` : ''
    if (mode.key === 'chinese_to_english') navigate(`/quest-practice/${u.id}${packQ}`)
    else if (mode.key === 'dictation') navigate(`/quest-dictation/${u.id}${packQ}`)
    else if (mode.key === 'speaking') navigate(`/quest/${game.packId || ''}?mode=speaking`)
    else if (mode.key === 'reading') navigate(`/quest/${game.packId || ''}?mode=reading`)
  }

  // 学习路线：抽首尾几个节点展示（完整路线见大纲）
  const routeNodes = units.length > 8 ? [units[0], units[1], units[2], null /* … */, units[units.length - 2], units[units.length - 1]] : units

  return (
    <div className="db-page">
      <div className="db-container" style={{ maxWidth: 880 }}>
        {/* ===== 头部 ===== */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button className="db-btn db-btn-ghost" onClick={() => navigate(-1)}>← 返回</button>
        </div>

        <div style={{ background: 'linear-gradient(135deg,#4f46e5 0%,#7c3aed 60%,#9333ea 100%)', borderRadius: 16, padding: 24, marginBottom: 20, color: '#fff' }}>
          <div style={{ fontSize: 30, fontWeight: 900 }}>{game.big || game.title}</div>
          <div style={{ fontSize: 15, opacity: 0.9, marginTop: 8 }}>{game.desc}</div>
          <div style={{ fontSize: 14, opacity: 0.85, marginTop: 10 }}>{game.meta || `${units.length} 课`}</div>
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
              <span>总进度</span><span>{doneCount}/{units.length} 课 · {progress}%</span>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: progress + '%', background: '#fff', borderRadius: 999, transition: 'width .4s' }} />
            </div>
            <div style={{ fontSize: 12, marginTop: 6, opacity: 0.85 }}>✅ {doneCount} 已完成 · 🔵 {doingCount} 进行中</div>
          </div>
        </div>

        {/* ===== 学习路线 ===== */}
        <div className="card" style={{ padding: 20, borderRadius: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>学习路线</div>
          <div style={{ fontSize: 13.5, color: '#9ca3af', marginBottom: 16 }}>按顺序学习效果最佳，绿色=已完成，紫色=正在学</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto', paddingBottom: 6 }}>
            {routeNodes.map((u, i) => {
              if (!u) return <div key={'e' + i} style={{ flex: '0 0 28px', textAlign: 'center', color: '#c0c4cc', fontWeight: 800 }}>…</div>
              const st = STATUS_META[u.status] || STATUS_META['未开始']
              const done = u.status === '已完成'
              return (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ textAlign: 'center', flexShrink: 0 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%', margin: '0 auto',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800,
                      background: done ? '#16a34a' : (u.status === '进行中' ? '#7c3aed' : '#e5e7eb'),
                      color: done || u.status === '进行中' ? '#fff' : '#9ca3af',
                    }}>{done ? '✓' : (i + 1)}</div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4, whiteSpace: 'nowrap' }}>{u.title}</div>
                  </div>
                  {i < routeNodes.length - 1 && <div style={{ flex: 1, minWidth: 18, height: 2, background: '#e5e7eb', margin: '0 4px' }} />}
                </div>
              )
            })}
          </div>
        </div>

        {/* ===== 大纲 ===== */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>课程大纲</div>
          {isDemo && <span style={{ fontSize: 11.5, color: '#b45309', background: '#FEF3C7', borderRadius: 6, padding: '3px 10px' }}>示例大纲 · 演示</span>}
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>加载大纲…</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 14, marginBottom: 40 }}>
            {units.map((u) => {
              const dm = DIFF_META[u.difficulty] || DIFF_META.easy
              const sm = STATUS_META[u.status] || STATUS_META['未开始']
              return (
                <div key={u.id} className="card" onClick={() => setPickedUnit(u)}
                  style={{ padding: 16, borderRadius: 14, cursor: 'pointer', transition: 'transform .15s, box-shadow .15s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.08)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 15, fontWeight: 800 }}>{u.title}</span>
                    <span style={{ fontSize: 11, color: dm.color, background: dm.bg, borderRadius: 6, padding: '2px 8px' }}>{dm.label}</span>
                  </div>
                  {(u.subtitle || u.description) && <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 6 }}>{u.subtitle || u.description}</div>}
                  <div style={{ marginTop: 10 }}>
                    <span style={{ fontSize: 11.5, color: sm.color, background: sm.bg, borderRadius: 6, padding: '2px 8px' }}>{sm.label}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ===== 练习模式弹窗 ===== */}
      {pickedUnit && (
        <ModePickerModal
          title={pickedUnit.title}
          modes={COURSE_MODES}
          onClose={() => setPickedUnit(null)}
          onStart={handleStart}
        />
      )}
    </div>
  )
}
