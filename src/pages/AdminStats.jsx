import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminStore } from '../store/adminStore'
import { apiFetch } from '../lib/api'

// ===== P1-E 数据看板（仅 admin 可见入口，接口后端校验 admin 权限） =====
const RATING_COLORS = { SSS: '#7c3aed', SS: '#8b5cf6', S: '#818cf8', A: '#16a34a', B: '#d97706', C: '#9ca3af' }

export default function AdminStats() {
  const navigate = useNavigate()
  const authBody = useAdminStore(s => s.authBody)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await apiFetch('/api/admin/dashboard/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authBody({})),
        timeout: 90000,
      })
      const j = await r.json()
      if (j.ok) setStats(j.stats)
      else setErr(j.error || '加载失败')
    } catch (e) { setErr('网络错误：无法连接后端') }
    finally { setLoading(false) }
  }, [authBody])

  useEffect(() => { load() }, [load])

  // ---- 近 14 天注册趋势：SVG 折线 ----
  function TrendChart({ trend }) {
    const days = Object.keys(trend || {}).sort()
    if (!days.length) return <p className="text-xs text-gray-400 py-6 text-center">近 14 天暂无新注册</p>
    const vals = days.map(d => trend[d])
    const max = Math.max(1, ...vals)
    const W = 600, H = 140, P = 24
    const x = (i) => P + i * (W - P * 2) / Math.max(1, days.length - 1)
    const y = (v) => H - P - (v / max) * (H - P * 2)
    const pts = vals.map((v, i) => `${x(i)},${y(v)}`).join(' ')
    return (
      <div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-36">
          <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="#e5e7eb" strokeWidth="1" />
          {vals.map((v, i) => (
            <circle key={i} cx={x(i)} cy={y(v)} r="3" fill="#7c3aed" />
          ))}
          <polyline points={pts} fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
        <div className="flex justify-between text-[10px] text-gray-400 px-1">
          <span>{days[0]}</span><span>{days[Math.floor(days.length / 2)]}</span><span>{days[days.length - 1]}</span>
        </div>
      </div>
    )
  }

  // ---- 横向条形 ----
  function Bars({ data, color = '#7c3aed' }) {
    const entries = Object.entries(data || {})
    if (!entries.length) return <p className="text-xs text-gray-400 py-4 text-center">暂无数据</p>
    const max = Math.max(1, ...entries.map(([, v]) => v))
    return (
      <div className="space-y-2">
        {entries.map(([k, v]) => (
          <div key={k} className="flex items-center gap-2 text-xs">
            <span className="w-16 text-gray-500">{k}</span>
            <div className="flex-1 h-4 bg-base-200 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${(v / max) * 100}%`, background: color }} />
            </div>
            <span className="w-10 text-right font-medium">{v}</span>
          </div>
        ))}
      </div>
    )
  }

  const u = stats?.users || {}
  const c = stats?.courses || {}
  const l = stats?.learning || {}
  const roles = { 管理员: u.roles?.admin || 0, 编辑: u.roles?.editor || 0, 只读: u.roles?.viewer || 0, 学习者: u.roles?.learner || 0 }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6">
      <div className="flex items-center gap-3 mb-4">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/admin')}>← 返回后台</button>
        <h1 className="text-xl font-bold">📊 数据看板</h1>
        <span className="badge badge-ghost badge-sm">仅管理员可见</span>
        <button className="btn btn-outline btn-xs ml-auto" onClick={load} disabled={loading}>{loading ? '刷新中…' : '↻ 刷新'}</button>
      </div>

      {err && <div className="alert alert-error shadow-sm mb-4 py-2 text-sm">{err}</div>}

      {loading ? (
        <div className="py-16 text-center text-sm text-gray-400"><span className="loading loading-spinner loading-sm" /> 统计中…</div>
      ) : !stats ? null : (
        <>
          {/* 概览卡片 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: '总用户', value: u.total ?? 0, icon: '👥', sub: `近 7 天 +${u.new_7d ?? 0}` },
              { label: '课程包', value: c.packs ?? 0, icon: '📦', sub: `共 ${c.units ?? 0} 课时` },
              { label: '完成记录', value: l.records ?? 0, icon: '🏆', sub: `近 7 天 ${l.records_7d ?? 0} 次` },
              { label: '近 7 天活跃用户', value: l.active_users_7d ?? 0, icon: '🔥', sub: `平均正确率 ${l.avg_accuracy ?? 0}%` },
            ].map(k => (
              <div key={k.label} className="card border border-gray-200 bg-base-100 shadow-sm" style={{ borderRadius: 16 }}>
                <div className="card-body p-4">
                  <div className="text-2xl">{k.icon}</div>
                  <div className="text-2xl font-bold mt-1">{k.value}</div>
                  <div className="text-xs text-gray-500">{k.label}</div>
                  <div className="text-[11px] text-gray-400">{k.sub}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-4 mt-4">
            {/* 注册趋势 */}
            <div className="card border border-gray-200 bg-base-100 shadow-sm" style={{ borderRadius: 16 }}>
              <div className="card-body p-5">
                <h3 className="card-title text-sm text-gray-700">近 14 天注册趋势</h3>
                <TrendChart trend={u.trend} />
              </div>
            </div>
            {/* 角色分布 */}
            <div className="card border border-gray-200 bg-base-100 shadow-sm" style={{ borderRadius: 16 }}>
              <div className="card-body p-5">
                <h3 className="card-title text-sm text-gray-700 mb-2">用户角色分布</h3>
                <Bars data={roles} />
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mt-4">
            {/* 评级分布 */}
            <div className="card border border-gray-200 bg-base-100 shadow-sm" style={{ borderRadius: 16 }}>
              <div className="card-body p-5">
                <h3 className="card-title text-sm text-gray-700 mb-2">通关评级分布</h3>
                <Bars data={stats.ratings || {}} color="#16a34a" />
              </div>
            </div>
            {/* Top 课时 */}
            <div className="card border border-gray-200 bg-base-100 shadow-sm" style={{ borderRadius: 16 }}>
              <div className="card-body p-5">
                <h3 className="card-title text-sm text-gray-700 mb-2">完成次数 Top 课时</h3>
                {stats.top_courses?.length ? (
                  <div className="space-y-2">
                    {stats.top_courses.map((t, i) => (
                      <div key={t.course_id} className="flex items-center gap-3 text-sm">
                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: i < 3 ? '#7c3aed' : '#9ca3af' }}>{i + 1}</span>
                        <span className="flex-1 truncate text-gray-700">{t.title}</span>
                        <span className="badge badge-ghost badge-sm">{t.count} 次</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-xs text-gray-400 py-4 text-center">暂无完成记录</p>}
              </div>
            </div>
          </div>

          <p className="text-[11px] text-gray-400 mt-4">
            口径说明：完成记录包含匿名用户（未登录试学）；活跃用户按近 7 天有记名学习记录去重计算；平均正确率 = 全部记录正确数/总题数均值。
          </p>
        </>
      )}
    </div>
  )
}
