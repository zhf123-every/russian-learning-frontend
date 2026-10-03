// ===== P1-D VIP 会员购买弹窗（真实支付骨架：微信支付对接位预留 + 人工确认兜底） =====
import { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '../lib/api'
import { useAdminStore } from '../store/adminStore'

const fmtDay = (ms) => {
  if (!ms) return ''
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function VipModal({ open, onClose }) {
  const authBody = useAdminStore(s => s.authBody)
  const isLoggedIn = useAdminStore(s => !!(s.token && s.user && s.user.id))
  const [plans, setPlans] = useState([])
  const [payReady, setPayReady] = useState(false)
  const [vip, setVip] = useState(null)
  const [selected, setSelected] = useState('month')
  const [order, setOrder] = useState(null) // { order_no, amount_cents, plan_tag }
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [statusTick, setStatusTick] = useState(0)

  const load = useCallback(async () => {
    setMsg('')
    try {
      const r = await apiFetch('/api/vip/plans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(authBody({})), timeout: 30000 })
      const j = await r.json()
      if (j.ok) { setPlans(j.plans || []); setPayReady(!!j.pay_ready) }
    } catch (e) { /* 忽略 */ }
    if (!isLoggedIn) return
    try {
      const r = await apiFetch('/api/vip/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(authBody({})), timeout: 30000 })
      const j = await r.json()
      if (j.ok) setVip(j)
    } catch (e) { /* 忽略 */ }
  }, [authBody, isLoggedIn])

  useEffect(() => { if (open) { setOrder(null); setMsg(''); load() } }, [open, load])

  // 轮询订单状态（支付成功后自动刷新 VIP 状态）
  useEffect(() => {
    if (!order || !isLoggedIn || statusTick === 0) return
    let alive = true
    const t = setTimeout(async () => {
      try {
        const r = await apiFetch('/api/order/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(authBody({ order_no: order.order_no })), timeout: 30000 })
        const j = await r.json()
        if (!alive) return
        if (j.ok && j.order && j.order.status === 'paid') {
          setMsg('✅ 支付成功，会员已生效！')
          setOrder(null); load()
        } else if (j.ok && j.order && j.order.status === 'created') {
          setMsg('⏳ 等待支付确认……（3 秒后自动刷新）')
          setStatusTick(t => t + 1)
        }
      } catch (e) { if (alive) setStatusTick(t => t + 1) }
    }, 3000)
    return () => { alive = false; clearTimeout(t) }
  }, [order, statusTick, isLoggedIn, authBody, load])

  async function createOrder() {
    if (!isLoggedIn) { setMsg('请先注册 / 登录后再开通会员'); return }
    setBusy(true); setMsg('')
    try {
      const r = await apiFetch('/api/order/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(authBody({ plan_key: selected })), timeout: 30000 })
      const j = await r.json()
      if (j.ok) {
        setOrder({ order_no: j.order_no, amount_cents: j.amount_cents, plan_tag: j.plan_tag })
        setMsg('订单已创建，等待支付确认……')
        setStatusTick(1) // 开始轮询
      } else setMsg(j.error || '下单失败，请稍后重试')
    } catch (e) { setMsg('网络错误：无法连接服务器') }
    finally { setBusy(false) }
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="card w-full max-w-md bg-base-100 shadow-2xl border border-gray-200" style={{ borderRadius: 20 }} onClick={e => e.stopPropagation()}>
        <div className="card-body p-5">
          <div className="flex items-center justify-between">
            <h2 className="card-title text-lg">💎 开通 VIP 会员</h2>
            <button className="btn btn-ghost btn-xs btn-circle" onClick={onClose}>✕</button>
          </div>

          {vip?.is_vip ? (
            <div className="alert alert-success shadow-sm py-2 my-2 text-sm">
              {vip.level === 'lifetime' ? '🎉 您已是终身会员' : `🎉 您是会员，剩余 ${vip.days_left} 天（到期 ${fmtDay(vip.vip_expire_at)}）`}
            </div>
          ) : (
            <div className="alert alert-info shadow-sm py-2 my-2 text-sm">当前为游客/非会员状态，开通后解锁全部课程</div>
          )}

          {/* 套餐选择 */}
          <div className="grid grid-cols-2 gap-2 my-3">
            {plans.map(p => (
              <button key={p.key}
                onClick={() => { setSelected(p.key); setOrder(null); setMsg('') }}
                className={`border rounded-xl p-3 text-left transition ${selected === p.key ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-gray-200 hover:border-gray-300'}`}>
                <div className="text-sm font-bold">{p.name}</div>
                <div className="text-lg font-extrabold text-primary">¥{(p.amount_cents / 100).toFixed(0)}</div>
              </button>
            ))}
          </div>

          {msg && <div className={`text-sm rounded-lg px-3 py-2 my-1 ${msg.includes('✅') ? 'bg-green-50 text-green-700' : msg.includes('⏳') ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{msg}</div>}

          {order ? (
            <div className="bg-gray-50 rounded-xl p-3 my-2 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-gray-500">订单号</span><span className="font-mono text-xs break-all text-right">{order.order_no}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">金额</span><span className="font-bold">¥{(order.amount_cents / 100).toFixed(2)}（{order.plan_tag}）</span></div>
              {payReady ? (
                <div className="text-center py-2 text-gray-500 text-xs">微信支付二维码将在此展示（微信支付接入后自动启用）</div>
              ) : (
                <div className="text-center py-1 text-gray-500 text-xs">
                  在线支付尚未开通。<br />请转账后联系管理员确认到账，确认后会员自动生效。
                </div>
              )}
            </div>
          ) : (
            <button className="btn btn-primary w-full my-2" disabled={busy} onClick={createOrder}>
              {busy ? '创建订单中…' : `开通会员（${selected === 'month' ? '月付' : selected === 'quarter' ? '季付' : selected === 'year' ? '年付' : '终身'}）`}
            </button>
          )}

          {!isLoggedIn && <p className="text-xs text-amber-600 text-center">未登录：开通会员需要先注册/登录账号</p>}
          {payReady && <p className="text-xs text-gray-400 text-center mt-1">支付渠道：微信支付（Native 扫码）</p>}
        </div>
      </div>
    </div>
  )
}
