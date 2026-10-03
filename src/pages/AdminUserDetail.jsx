import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAdminStore } from '../store/adminStore'
import { apiFetch, API_BASE } from '../lib/api'

const MODE_LABELS = {
  practice: '连词成句',
  listening: '听力',
  speaking: '口语',
  dictation: '听写',
  chinese_to_english: '中译俄',
  chinese_to_russian: '中译俄',
  english_to_chinese: '俄译中',
  snowball: '滚雪球',
}
const MODE_COLOR = {
  practice: 'badge-primary',
  listening: 'badge-secondary',
  speaking: 'badge-accent',
  dictation: 'badge-info',
  chinese_to_english: 'badge-success',
  english_to_chinese: 'badge-warning',
}
const ROLE_LABELS = { admin: '管理员', editor: '编辑', viewer: '只读', learner: '学习者' }
const LIFETIME_TS = 4102444800000 // 2100-01-01（终身会员）

const fmtDate = (ts) => (ts ? new Date(ts).toLocaleString('zh-CN', { hour12: false }) : '—')
const shortId = (id) => (id ? String(id).replace(/^(course|unit)_/, '').slice(0, 10) : '—')

// ===== 用户详情页（admin 入口，接口后端校验权限）=====
export default function AdminUserDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const authBody = useAdminStore(s => s.authBody)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('info')
  const [busy, setBusy] = useState(false)
  const [courseNames, setCourseNames] = useState({}) // courseId → title（来自 B2 名单）

  const flash = useCallback((text, type = 'info') => {
    setMsg(text); setMsgType(type)
    setTimeout(() => setMsg(''), 5000)
  }, [])

  // 课程名映射：商城名单是公开接口，无需鉴权
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const r = await fetch(`${API_BASE || ''}/api/videos/list`, { timeout: 30000 })
        const j = await r.json()
        if (!alive) return
        const map = {}
        ;(Array.isArray(j.videos) ? j.videos : []).forEach(v => { if (v.id) map[v.id] = v.title || '' })
        setCourseNames(map)
      } catch (e) { /* 名单读不到不阻塞 */ }
    })()
    return () => { alive = false }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await apiFetch('/api/admin/users/detail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authBody({ id })),
        timeout: 90000,
      })
      const j = await r.json()
      if (j.ok) setData(j)
      else flash(j.error || '加载失败', 'error')
    } catch (e) {
      flash('网络错误：无法连接后端', 'error')
    } finally {
      setLoading(false)
    }
  }, [id, authBody, flash])

  useEffect(() => { load() }, [load])

  const toggleStatus = async () => {
    const u = data.user
    if (!window.confirm(u.status === 1 ? `确定禁用用户「${u.username}」？` : `确定启用用户「${u.username}」？`)) return
    setBusy(true)
    try {
      const r = await apiFetch('/api/admin/users/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authBody({ id: u.id, status: u.status === 1 ? 0 : 1 })),
        timeout: 90000,
      })
      const j = await r.json()
      if (j.ok) { flash('状态已更新'); load() }
      else flash(j.error || '更新失败', 'error')
    } catch (e) { flash('网络错误', 'error') } finally { setBusy(false) }
  }

  if (loading) return (
    <div className="max-w-5xl mx-auto p-4 md:p-6">
      <div className="py-14 text-center text-sm text-gray-400"><span className="loading loading-spinner loading-sm" /> 正在加载用户详情…</div>
    </div>
  )

  if (!data || !data.user) return (
    <div className="max-w-5xl mx-auto p-4 md:p-6">
      <div className="py-14 text-center text-gray-400">用户不存在或已被删除
        <div className="mt-3"><button className="btn btn-sm btn-outline" onClick={() => navigate('/admin/users')}>← 返回用户列表</button></div>
      </div>
    </div>
  )

  const u = data.user
  const st = data.stats || {}
  const now = Date.now()
  const isVip = (u.vip_expire_at || 0) > now
  const vipLifetime = u.vip_expire_at >= LIFETIME_TS

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6">
      <div className="flex items-center gap-3 mb-4">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/admin/users')}>← 返回用户列表</button>
        <h1 className="text-xl font-bold">👤 用户详情</h1>
        {u.status === 1
          ? <span className="badge badge-success badge-sm">正常</span>
          : <span className="badge badge-ghost badge-sm text-gray-400">已禁用</span>}
        <span className={`badge badge-sm ${isVip ? 'badge-warning' : 'badge-ghost'}`}>{isVip ? (vipLifetime ? '终身会员' : 'VIP') : '非会员'}</span>
      </div>

      {msg && (
        <div className={`alert alert-${msgType === 'error' ? 'error' : 'info'} shadow-sm mb-4 py-2 text-sm`}>{msg}</div>
      )}

      {/* 学习统计 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        {[
          ['📚', '学过课程', st.courses ?? '—'],
          ['✍️', '学习记录', st.total_records ?? '—'],
          ['✅', '完成课时', st.done_units ?? '—'],
          ['🔥', '活跃天数', st.active_days ?? '—'],
          ['🕐', '最近学习', st.last_ts ? new Date(st.last_ts).toLocaleDateString('zh-CN') : '—'],
        ].map(([icon, label, val]) => (
          <div key={label} className="card border border-gray-200 bg-base-100 shadow-sm" style={{ borderRadius: 16 }}>
            <div className="card-body p-4 text-center">
              <div className="text-xl">{icon}</div>
              <div className="text-xl font-extrabold text-gray-800">{val}</div>
              <div className="text-xs text-gray-400">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* 个人信息 */}
        <div className="card border border-gray-200 bg-base-100 shadow-sm md:col-span-1" style={{ borderRadius: 16 }}>
          <div className="card-body p-5">
            <h2 className="card-title text-base text-gray-900">基本信息</h2>
            <div className="mt-2 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">用户名</span><span className="font-medium">{u.username}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">昵称</span><span>{u.nickname || '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">角色</span><span>{ROLE_LABELS[u.role] || u.role}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">邮箱</span><span className="truncate max-w-[180px]">{u.email || '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">UID</span><span className="font-mono text-xs">{shortId(u.id)}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">注册时间</span><span>{new Date(u.created_at || 0).toLocaleDateString('zh-CN')}</span></div>
              <div className="flex justify-between">
                <span className="text-gray-400">VIP 到期</span>
                <span className={isVip ? 'text-amber-600 font-semibold' : ''}>
                  {vipLifetime ? '终身' : (u.vip_expire_at ? new Date(u.vip_expire_at).toLocaleDateString('zh-CN') : '—')}
                </span>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button className={`btn btn-xs flex-1 ${u.status === 1 ? 'btn-error btn-outline' : 'btn-success btn-outline'}`} disabled={busy} onClick={toggleStatus}>
                {u.status === 1 ? '禁用该用户' : '启用该用户'}
              </button>
            </div>
          </div>
        </div>

        {/* 学习记录 */}
        <div className="card border border-gray-200 bg-base-100 shadow-sm md:col-span-2" style={{ borderRadius: 16 }}>
          <div className="card-body p-5">
            <h2 className="card-title text-base text-gray-900">学习记录（最近 {data.progress.length} 条）</h2>
            {data.progress.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">该用户还没有学习记录</p>
            ) : (
              <div className="max-h-[420px] overflow-y-auto">
                <table className="table table-sm">
                  <thead className="sticky top-0 bg-base-100"><tr className="text-xs text-gray-400">
                    <th>时间</th><th>课程</th><th>课时</th><th>模式</th><th>进度</th><th>状态</th>
                  </tr></thead>
                  <tbody>
                    {data.progress.map((p, i) => (
                      <tr key={i}>
                        <td className="text-xs text-gray-400 whitespace-nowrap">{new Date(p.ts).toLocaleString('zh-CN', { hour12: false })}</td>
                        <td className="text-xs max-w-[140px] truncate" title={courseNames[p.course_id] || p.course_id}>
                          {courseNames[p.course_id] || shortId(p.course_id)}
                        </td>
                        <td className="text-xs font-mono text-gray-400">{shortId(p.unit_id)}</td>
                        <td><span className={`badge badge-xs ${MODE_COLOR[p.mode] || 'badge-ghost'}`}>{MODE_LABELS[p.mode] || p.mode}</span></td>
                        <td className="text-xs text-gray-500">{p.difficulty || '—'}</td>
                        <td>{p.status === 1 ? <span className="badge badge-success badge-xs">已完成</span> : <span className="badge badge-ghost badge-xs text-gray-400">进行中</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 订单记录 */}
      <div className="card border border-gray-200 bg-base-100 shadow-sm mt-4" style={{ borderRadius: 16 }}>
        <div className="card-body p-5">
          <h2 className="card-title text-base text-gray-900">订单记录（最近 {data.orders.length} 条）</h2>
          {data.orders.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">该用户还没有订单</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead><tr className="text-xs text-gray-400">
                  <th>订单号</th><th>套餐</th><th>金额</th><th>渠道</th><th>状态</th><th>创建时间</th>
                </tr></thead>
                <tbody>
                  {data.orders.map(o => (
                    <tr key={o.id}>
                      <td className="font-mono text-xs">{o.order_no}</td>
                      <td className="text-xs">{o.plan_key}</td>
                      <td className="text-xs">¥{(o.amount_cents / 100).toFixed(2)}</td>
                      <td className="text-xs text-gray-500">{o.pay_channel === 'wechat' ? '微信' : o.pay_channel}</td>
                      <td>
                        {o.status === 'paid'
                          ? <span className="badge badge-success badge-xs">已支付</span>
                          : o.status === 'pending'
                            ? <span className="badge badge-warning badge-xs">待支付</span>
                            : <span className="badge badge-ghost badge-xs">{o.status}</span>}
                      </td>
                      <td className="text-xs text-gray-400">{fmtDate(o.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
