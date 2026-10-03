// ===== P1-D 订单管理（admin）：列表/搜索/手动确认收款 =====
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminStore } from '../store/adminStore'
import { apiFetch } from '../lib/api'

const STATUS_META = {
  created: { label: '待支付', cls: 'badge-warning' },
  paid: { label: '已支付', cls: 'badge-success' },
  failed: { label: '失败', cls: 'badge-error' },
  cancelled: { label: '已取消', cls: 'badge-ghost' },
}
const PLAN_NAMES = { month: '月付', quarter: '季付', year: '年付', lifetime: '终身' }
const fmtTime = (ms) => {
  if (!ms) return '-'
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function AdminOrders() {
  const navigate = useNavigate()
  const authBody = useAdminStore(s => s.authBody)
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  const load = useCallback(async (p = page, query = q, st = status) => {
    setLoading(true)
    try {
      const r = await apiFetch('/api/admin/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authBody({ page: p, size: 10, q: query, status: st })),
        timeout: 60000,
      })
      const j = await r.json()
      if (j.ok) { setRows(j.rows || []); setTotal(j.total || 0) }
      else setMsg(j.error || '加载失败')
    } catch (e) { setMsg('网络错误：无法连接后端') }
    finally { setLoading(false) }
  }, [authBody, page, q, status])

  useEffect(() => { load() }, [load])

  async function confirmPaid(orderNo) {
    if (!orderNo) return
    setMsg('')
    try {
      const r = await apiFetch('/api/order/manual-pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authBody({ order_no: orderNo })),
        timeout: 60000,
      })
      const j = await r.json()
      if (j.ok) { setMsg('✅ 已确认收款，会员已发放'); load(page, q, status) }
      else setMsg(j.error || '确认失败')
    } catch (e) { setMsg('网络错误') }
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6">
      <div className="flex items-center gap-3 mb-4">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/admin')}>← 返回后台</button>
        <h1 className="text-xl font-bold">🧾 订单管理</h1>
        <span className="badge badge-ghost badge-sm">仅管理员可见</span>
        <button className="btn btn-outline btn-xs ml-auto" onClick={() => load(page, q, status)} disabled={loading}>{loading ? '刷新中…' : '↻ 刷新'}</button>
      </div>

      {msg && <div className="alert alert-info shadow-sm mb-3 py-2 text-sm">{msg}</div>}

      <div className="flex gap-2 mb-3">
        <input className="input input-sm input-bordered w-52" placeholder="搜订单号 / 用户名" value={q}
          onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { setPage(1); load(1, q, status) } }} />
        <select className="select select-sm select-bordered" value={status} onChange={e => { setStatus(e.target.value); setPage(1); load(1, q, e.target.value) }}>
          <option value="">全部状态</option>
          <option value="created">待支付</option>
          <option value="paid">已支付</option>
          <option value="failed">失败</option>
          <option value="cancelled">已取消</option>
        </select>
        <button className="btn btn-sm btn-outline" onClick={() => { setPage(1); load(1, q, status) }}>搜索</button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-gray-400"><span className="loading loading-spinner loading-sm" /> 加载中…</div>
      ) : (
        <div className="card border border-gray-200 bg-base-100 shadow-sm" style={{ borderRadius: 16 }}>
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr className="text-gray-500">
                  <th>订单号</th><th>用户</th><th>套餐</th><th>金额</th><th>状态</th><th>渠道</th><th>创建时间</th><th>支付时间</th><th>操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(o => (
                  <tr key={o.order_no} className="text-sm">
                    <td className="font-mono text-xs break-all max-w-40">{o.order_no}</td>
                    <td>{o.username || o.user_id}</td>
                    <td>{PLAN_NAMES[o.plan_key] || o.plan_key}</td>
                    <td className="font-bold">¥{(o.amount_cents / 100).toFixed(2)}</td>
                    <td><span className={`badge badge-sm ${STATUS_META[o.status]?.cls || 'badge-ghost'}`}>{STATUS_META[o.status]?.label || o.status}</span></td>
                    <td>{o.pay_channel === 'wechat' ? '微信' : o.pay_channel}</td>
                    <td className="text-xs text-gray-500">{fmtTime(o.created_at)}</td>
                    <td className="text-xs text-gray-500">{fmtTime(o.paid_at)}</td>
                    <td>
                      {o.status === 'created' ? (
                        <button className="btn btn-xs btn-success" onClick={() => confirmPaid(o.order_no)}>确认已收款</button>
                      ) : <span className="text-xs text-gray-400">-</span>}
                    </td>
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan={9} className="text-center text-gray-400 py-8">暂无订单</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="card-body py-3 flex flex-row items-center justify-between">
            <span className="text-xs text-gray-500">共 {total} 条</span>
            <div className="btn-group">
              <button className="btn btn-xs btn-outline" disabled={page <= 1} onClick={() => { setPage(page - 1); load(page - 1, q, status) }}>上一页</button>
              <span className="btn btn-xs btn-ghost no-animation">第 {page} 页</span>
              <button className="btn btn-xs btn-outline" disabled={page * 10 >= total} onClick={() => { setPage(page + 1); load(page + 1, q, status) }}>下一页</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
