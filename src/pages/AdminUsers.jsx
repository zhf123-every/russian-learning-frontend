import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminStore } from '../store/adminStore'
import { apiFetch } from '../lib/api'

const ROLE_LABELS = {
  admin: '管理员',
  editor: '编辑',
  viewer: '只读',
  learner: '学习者',
}
const ROLE_BADGE = {
  admin: 'badge-primary',
  editor: 'badge-secondary',
  viewer: 'badge-ghost',
  learner: 'badge-outline',
}

// ===== P1-A 用户管理（仅 admin 可见入口，接口后端校验 admin 权限） =====
export default function AdminUsers() {
  const navigate = useNavigate()
  const authBody = useAdminStore(s => s.authBody)

  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')           // 顶部提示（成功/失败）
  const [msgType, setMsgType] = useState('info')
  const [busyId, setBusyId] = useState('')     // 正在操作的用户 id
  // 重置密码弹窗
  const [resetTarget, setResetTarget] = useState(null)
  const [resetPass, setResetPass] = useState('')
  const [resetResult, setResetResult] = useState('')

  const PAGE_SIZE = 10

  const flash = useCallback((text, type = 'info') => {
    setMsg(text)
    setMsgType(type)
    setTimeout(() => setMsg(''), 5000)
  }, [])

  const load = useCallback(async (pg, kw) => {
    setLoading(true)
    try {
      const r = await apiFetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authBody({ page: pg, size: PAGE_SIZE, q: kw })),
        timeout: 90000,
      })
      const j = await r.json()
      if (j.ok) {
        setRows(j.rows || [])
        setTotal(j.total || 0)
      } else {
        flash(j.error || '加载失败', 'error')
      }
    } catch (e) {
      flash('网络错误：无法连接后端', 'error')
    } finally {
      setLoading(false)
    }
  }, [authBody, flash])

  useEffect(() => { load(page, q) }, [page, q, load])

  const act = async (path, body) => {
    const r = await apiFetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(authBody(body)),
      timeout: 90000,
    })
    return r.json()
  }

  const changeRole = async (id, role) => {
    setBusyId(id)
    const j = await act('/api/admin/users/role', { id, role })
    setBusyId('')
    if (j.ok) { flash('角色已更新'); load(page, q) }
    else flash(j.error || '更新失败', 'error')
  }

  const toggleStatus = async (u) => {
    if (!window.confirm(u.status === 1
      ? `确定禁用用户「${u.username}」？被禁用后将无法登录。`
      : `确定启用用户「${u.username}」？`)) return
    setBusyId(u.id)
    const j = await act('/api/admin/users/status', { id: u.id, status: u.status === 1 ? 0 : 1 })
    setBusyId('')
    if (j.ok) { flash('状态已更新'); load(page, q) }
    else flash(j.error || '更新失败', 'error')
  }

  const doReset = async () => {
    if (!resetTarget) return
    setBusyId(resetTarget.id)
    const j = await act('/api/admin/users/reset-password', {
      id: resetTarget.id,
      new_password: resetPass.trim() || '',
    })
    setBusyId('')
    if (j.ok) {
      setResetResult(j.new_password || '')
      flash('密码已重置，请复制并告知该用户')
    } else {
      flash(j.error || '重置失败', 'error')
      setResetTarget(null)
      setResetPass('')
      setResetResult('')
    }
  }

  const closeReset = () => {
    setResetTarget(null)
    setResetPass('')
    setResetResult('')
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6">
      <div className="flex items-center gap-3 mb-4">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/admin')}>← 返回后台</button>
        <h1 className="text-xl font-bold">👥 用户管理</h1>
        <span className="badge badge-ghost badge-sm">仅管理员可用</span>
      </div>

      {msg && (
        <div className={`alert alert-${msgType === 'error' ? 'error' : 'info'} shadow-sm mb-4 py-2 text-sm`}>
          {msg}
        </div>
      )}

      <div className="card border border-gray-200 bg-base-100 shadow-sm" style={{ borderRadius: 16 }}>
        <div className="card-body p-5">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <input
              className="input input-sm input-bordered flex-1 min-w-[200px]"
              placeholder="搜索用户名 / 昵称…"
              value={q}
              onChange={e => { setQ(e.target.value); setPage(1) }}
            />
            <span className="text-xs text-gray-400">共 {total} 名用户</span>
          </div>

          {loading ? (
            <div className="py-10 text-center text-sm text-gray-400"><span className="loading loading-spinner loading-sm" /> 加载中…</div>
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">暂无用户</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr className="text-xs text-gray-400">
                    <th>用户名</th><th>昵称</th><th>角色</th><th>状态</th><th>邮箱</th><th>注册时间</th><th className="text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(u => (
                    <tr key={u.id}>
                      <td className="font-medium">{u.username}</td>
                      <td className="text-gray-500">{u.nickname || '—'}</td>
                      <td>
                        <select
                          className={`select select-xs select-bordered ${ROLE_BADGE[u.role] || 'badge-outline'}`}
                          value={u.role}
                          disabled={busyId === u.id}
                          onChange={e => { const v = e.target.value; if (v !== u.role && window.confirm(`将「${u.username}」角色改为「${ROLE_LABELS[v]}」？`)) changeRole(u.id, v); else e.target.value = u.role }}
                        >
                          {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </td>
                      <td>
                        {u.status === 1
                          ? <span className="badge badge-success badge-sm">正常</span>
                          : <span className="badge badge-ghost badge-sm text-gray-400">已禁用</span>}
                      </td>
                      <td className="text-gray-500 text-xs">{u.email || '—'}</td>
                      <td className="text-gray-400 text-xs">{new Date(u.created_at || 0).toLocaleDateString('zh-CN')}</td>
                      <td className="text-right">
                        <div className="flex gap-1 justify-end">
                          <button className="btn btn-xs btn-outline" onClick={() => navigate('/admin/users/' + u.id)}>详情</button>
                          <button className="btn btn-xs btn-outline" disabled={busyId === u.id} onClick={() => { setResetTarget(u); setResetResult('') }}>重置密码</button>
                          <button className={`btn btn-xs ${u.status === 1 ? 'btn-error btn-outline' : 'btn-success btn-outline'}`} disabled={busyId === u.id} onClick={() => toggleStatus(u)}>
                            {u.status === 1 ? '禁用' : '启用'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between mt-4">
            <button className="btn btn-sm btn-outline" disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}>上一页</button>
            <span className="text-xs text-gray-400">第 {page} / {totalPages} 页</span>
            <button className="btn btn-sm btn-outline" disabled={page >= totalPages || loading} onClick={() => setPage(p => p + 1)}>下一页</button>
          </div>
        </div>
      </div>

      {/* 重置密码弹窗 */}
      {resetTarget && (
        <div className="modal modal-open">
          <div className="modal-box" style={{ borderRadius: 16 }}>
            <h3 className="font-bold text-lg">重置「{resetTarget.username}」的密码</h3>
            {!resetResult ? (
              <>
                <p className="text-sm text-gray-500 mt-2">留空则自动生成随机密码（仅此弹窗显示一次，请复制保存后告知用户）。</p>
                <input
                  className="input input-bordered w-full mt-3"
                  type="text"
                  placeholder="输入新密码（至少 6 位），或留空自动生成"
                  value={resetPass}
                  onChange={e => setResetPass(e.target.value)}
                />
                <div className="modal-action">
                  <button className="btn" onClick={closeReset}>取消</button>
                  <button className="btn btn-primary" disabled={busyId === resetTarget.id} onClick={doReset}>
                    {busyId === resetTarget.id ? '重置中…' : '确认重置'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="alert alert-success mt-3 text-sm">密码已重置！</div>
                <div className="mt-3">
                  <p className="text-xs text-gray-400 mb-1">新密码（仅显示这一次，请立即复制）：</p>
                  <div className="flex items-center gap-2">
                    <code className="px-3 py-2 bg-base-200 rounded-lg font-mono text-lg select-all">{resetResult}</code>
                    <button className="btn btn-xs btn-outline" onClick={() => { navigator.clipboard?.writeText(resetResult); flash('已复制到剪贴板') }}>复制</button>
                  </div>
                </div>
                <div className="modal-action">
                  <button className="btn btn-primary" onClick={closeReset}>完成</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
