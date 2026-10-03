import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminStore } from '../store/adminStore'
import { apiFetch } from '../lib/api'

const PLAN_KEYS = [
  { key: 'month', label: '月付', def: { amount_cents: 2900, months: 1 } },
  { key: 'quarter', label: '季付', def: { amount_cents: 8500, months: 3 } },
  { key: 'year', label: '年付', def: { amount_cents: 34500, months: 12 } },
  { key: 'lifetime', label: '终身', def: { amount_cents: 108800, months: null } },
]

// ===== P1-F 系统设置（仅 admin）：站点信息 + VIP 套餐价格（保存即生效，商城/VIP 弹窗价格自动跟随） =====
export default function AdminSettings() {
  const navigate = useNavigate()
  const authBody = useAdminStore(s => s.authBody)

  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('info')
  const [busy, setBusy] = useState(false)
  // 表单
  const [site, setSite] = useState({ site_name: '', site_subtitle: '', announcement: '' })
  const [plans, setPlans] = useState({}) // key -> { priceYuan, months, lifetime }

  const flash = useCallback((text, type = 'info') => {
    setMsg(text)
    setMsgType(type)
    setTimeout(() => setMsg(''), 5000)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await apiFetch('/api/admin/settings/get', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authBody({})),
        timeout: 90000,
      })
      const j = await r.json()
      if (j.ok) {
        setSite({ site_name: j.site?.site_name || '', site_subtitle: j.site?.site_subtitle || '', announcement: j.site?.announcement || '' })
        const p = {}
        for (const k of PLAN_KEYS) {
          const v = j.vip_plans?.[k.key]
          p[k.key] = {
            priceYuan: v ? (v.amount_cents / 100) : (k.def.amount_cents / 100),
            months: v ? (v.months ?? '') : (k.def.months ?? ''),
            name: v?.name || k.label,
          }
        }
        setPlans(p)
      } else {
        flash(j.error || '加载失败', 'error')
      }
    } catch (e) {
      flash('网络错误：无法连接后端', 'error')
    } finally {
      setLoading(false)
    }
  }, [authBody, flash])

  useEffect(() => { load() }, [load])

  const doSave = async () => {
    if (!site.site_name.trim()) { flash('站点名称不能为空', 'error'); return }
    for (const k of PLAN_KEYS) {
      const p = plans[k.key]
      if (!p) continue
      const price = Number(p.priceYuan)
      if (!Number.isFinite(price) || price < 0) { flash(`「${k.label}」价格必须为 ≥0 的数字`, 'error'); return }
    }
    const vip_plans = {}
    for (const k of PLAN_KEYS) {
      const p = plans[k.key]
      const months = k.key === 'lifetime' ? null : (Number(p.months) || null)
      const amount_cents = Math.round(Number(p.priceYuan) * 100)
      const name = (p.name || '').trim() || k.label
      vip_plans[k.key] = {
        name, amount_cents, months,
        tag: `${name} ${amount_cents / 100} 元`,
      }
    }
    setBusy(true)
    try {
      const r = await apiFetch('/api/admin/settings/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authBody({ site, vip_plans })),
        timeout: 90000,
      })
      const j = await r.json()
      if (j.ok) {
        flash('设置已保存并生效（商城/VIP 弹窗价格已更新）')
        load()
      } else {
        flash(j.error || '保存失败', 'error')
      }
    } catch (e) {
      flash('网络错误：无法连接后端', 'error')
    } finally {
      setBusy(false)
    }
  }

  const doReset = async () => {
    if (!window.confirm('确定恢复默认设置？套餐价格将还原为 月付29 / 季付85 / 年付345 / 终身1088。')) return
    setBusy(true)
    try {
      const r = await apiFetch('/api/admin/settings/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authBody({
          site: { site_name: '看视频学俄语', site_subtitle: 'Russian Learning', announcement: '' },
          vip_plans: {
            month: { name: '月付', amount_cents: 2900, months: 1, tag: '月付 29 元' },
            quarter: { name: '季付', amount_cents: 8500, months: 3, tag: '季付 85 元' },
            year: { name: '年付', amount_cents: 34500, months: 12, tag: '年付 345 元' },
            lifetime: { name: '终身', amount_cents: 108800, months: null, tag: '终身 1088 元' },
          },
        })),
        timeout: 90000,
      })
      const j = await r.json()
      if (j.ok) { flash('已恢复默认设置'); load() }
      else flash(j.error || '恢复失败', 'error')
    } catch (e) {
      flash('网络错误：无法连接后端', 'error')
    } finally {
      setBusy(false)
    }
  }

  const setPlanField = (key, field, value) => setPlans(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }))

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6">
      <div className="flex items-center gap-3 mb-4">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/admin')}>← 返回后台</button>
        <h1 className="text-xl font-bold">⚙️ 系统设置</h1>
        <span className="badge badge-ghost badge-sm">仅管理员可用</span>
      </div>

      {msg && (
        <div className={`alert alert-${msgType === 'error' ? 'error' : 'info'} shadow-sm mb-4 py-2 text-sm`}>
          {msg}
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-sm text-gray-400"><span className="loading loading-spinner loading-sm" /> 加载中…</div>
      ) : (
        <>
          {/* 站点信息 */}
          <div className="card border border-gray-200 bg-base-100 shadow-sm mb-4" style={{ borderRadius: 16 }}>
            <div className="card-body p-5">
              <h2 className="text-sm font-semibold mb-3">🌐 站点信息</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="form-control">
                  <label className="label"><span className="label-text">站点名称</span></label>
                  <input className="input input-bordered" value={site.site_name} onChange={e => setSite(s => ({ ...s, site_name: e.target.value }))} placeholder="看视频学俄语" />
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">副标题</span></label>
                  <input className="input input-bordered" value={site.site_subtitle} onChange={e => setSite(s => ({ ...s, site_subtitle: e.target.value }))} placeholder="Russian Learning" />
                </div>
              </div>
              <div className="form-control mt-3">
                <label className="label"><span className="label-text">公告（可留空）</span></label>
                <textarea className="textarea textarea-bordered" rows="2" value={site.announcement} onChange={e => setSite(s => ({ ...s, announcement: e.target.value }))} placeholder="站点公告内容…" />
              </div>
            </div>
          </div>

          {/* VIP 套餐价格 */}
          <div className="card border border-gray-200 bg-base-100 shadow-sm mb-4" style={{ borderRadius: 16 }}>
            <div className="card-body p-5">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-sm font-semibold">💎 VIP 套餐价格</h2>
                <span className="badge badge-ghost badge-xs">保存后商城 / VIP 弹窗立即生效</span>
              </div>
              <p className="text-xs text-gray-400 mb-3">金额单位：元（保存时自动换算为分）。终身套餐时长固定为终身，无需填月数。</p>
              <div className="overflow-x-auto">
                <table className="table table-sm">
                  <thead>
                    <tr className="text-xs text-gray-400">
                      <th>套餐</th><th>名称</th><th>价格（元）</th><th>时长（月 / 终身）</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PLAN_KEYS.map(k => (
                      <tr key={k.key}>
                        <td className="font-medium">{k.label}</td>
                        <td>
                          <input className="input input-sm input-bordered w-28" value={plans[k.key]?.name || ''} onChange={e => setPlanField(k.key, 'name', e.target.value)} />
                        </td>
                        <td>
                          <input className="input input-sm input-bordered w-28" type="number" min="0" step="1" value={plans[k.key]?.priceYuan ?? ''} onChange={e => setPlanField(k.key, 'priceYuan', e.target.value)} />
                        </td>
                        <td>
                          {k.key === 'lifetime' ? (
                            <span className="badge badge-outline">终身</span>
                          ) : (
                            <input className="input input-sm input-bordered w-24" type="number" min="1" step="1" value={plans[k.key]?.months ?? ''} onChange={e => setPlanField(k.key, 'months', e.target.value)} />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="btn btn-primary" onClick={doSave} disabled={busy}>{busy ? '保存中…' : '💾 保存设置'}</button>
            <button className="btn btn-outline" onClick={doReset} disabled={busy}>恢复默认</button>
          </div>
        </>
      )}
    </div>
  )
}
