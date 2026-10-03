import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminStore } from '../store/adminStore'
import { apiFetch } from '../lib/api'

// ===== P1-C 课程分类管理（仅 admin；商城标签栏与后台课程表单的数据源） =====
// 结构：主分类 -> 子分类。种子与商城/后台既有体系对齐；此处可增删改、启停、排序。
export default function AdminCategories() {
  const navigate = useNavigate()
  const authBody = useAdminStore(s => s.authBody)

  const [rows, setRows] = useState([])        // 全量行（含停用）
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('info')
  const [busy, setBusy] = useState('')        // 操作中的行 id（或 'new'）
  // 新增表单
  const [fName, setFName] = useState('')
  const [fSub, setFSub] = useState('')
  const [fSort, setFSort] = useState('0')

  const flash = useCallback((text, type = 'info') => {
    setMsg(text)
    setMsgType(type)
    setTimeout(() => setMsg(''), 5000)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await apiFetch('/api/admin/categories/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authBody({})),
        timeout: 90000,
      })
      const j = await r.json()
      if (j.ok) setRows(j.rows || [])
      else flash(j.error || '加载失败', 'error')
    } catch (e) {
      flash('网络错误：无法连接后端', 'error')
    } finally {
      setLoading(false)
    }
  }, [authBody, flash])

  useEffect(() => { load() }, [load])

  const act = async (path, body) => {
    const r = await apiFetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(authBody(body)),
      timeout: 90000,
    })
    return r.json()
  }

  const doSave = async () => {
    const name = fName.trim()
    const sub = fSub.trim()
    if (!name) { flash('请填写主分类名称', 'error'); return }
    if (!sub) { flash('请填写子分类名称（如“全部”）', 'error'); return }
    let sort = parseInt(fSort, 10)
    if (Number.isNaN(sort)) sort = 0
    setBusy('new')
    const j = await act('/api/admin/categories/save', { name, sub_name: sub, sort_order: sort })
    setBusy('')
    if (j.ok) {
      flash(`已新增「${name} / ${sub}」`)
      setFSub(''); setFSort('0')
      load()
    } else {
      flash(j.error || '保存失败', 'error')
    }
  }

  const toggleActive = async (row) => {
    setBusy(row.id)
    const j = await act('/api/admin/categories/save', {
      id: row.id, name: row.name, sub_name: row.sub_name, sort_order: row.sort_order,
      is_active: row.is_active === 1 ? 0 : 1,
    })
    setBusy('')
    if (j.ok) { flash(row.is_active === 1 ? `已停用「${row.sub_name}」` : `已启用「${row.sub_name}」`); load() }
    else flash(j.error || '操作失败', 'error')
  }

  const delRow = async (row) => {
    if (!window.confirm(`确定删除「${row.name} / ${row.sub_name}」？商城将不再展示该分类。`)) return
    setBusy(row.id)
    const j = await act('/api/admin/categories/delete', { id: row.id })
    setBusy('')
    if (j.ok) { flash('已删除'); load() }
    else flash(j.error || '删除失败', 'error')
  }

  const delGroup = async (name) => {
    if (!window.confirm(`确定删除整个主分类「${name}」及其全部子分类？商城将不再展示该分类。`)) return
    setBusy(name)
    const j = await act('/api/admin/categories/delete', { name })
    setBusy('')
    if (j.ok) { flash(`已删除主分类「${name}」`); load() }
    else flash(j.error || '删除失败', 'error')
  }

  // 按主分类分组（保持 sort_order 顺序）
  const groups = []
  const seen = new Set()
  for (const r of rows) {
    if (!seen.has(r.name)) {
      seen.add(r.name)
      groups.push({ name: r.name, subs: rows.filter(x => x.name === r.name) })
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6">
      <div className="flex items-center gap-3 mb-4">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/admin')}>← 返回后台</button>
        <h1 className="text-xl font-bold">🏷️ 课程分类管理</h1>
        <span className="badge badge-ghost badge-sm">仅管理员可用 · 商城标签栏与课程表单数据源</span>
      </div>

      {msg && (
        <div className={`alert alert-${msgType === 'error' ? 'error' : 'info'} shadow-sm mb-4 py-2 text-sm`}>
          {msg}
        </div>
      )}

      {/* 新增表单 */}
      <div className="card border border-gray-200 bg-base-100 shadow-sm mb-4" style={{ borderRadius: 16 }}>
        <div className="card-body p-5">
          <h2 className="text-sm font-semibold mb-3">➕ 新增分类</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <input className="input input-sm input-bordered" placeholder="主分类（新分类名）" value={fName} onChange={e => setFName(e.target.value)} />
            <input className="input input-sm input-bordered" placeholder="子分类（如：全部 / 专项名称）" value={fSub} onChange={e => setFSub(e.target.value)} />
            <input className="input input-sm input-bordered" placeholder="排序（数字，越小越靠前）" value={fSort} onChange={e => setFSort(e.target.value)} />
            <button className="btn btn-primary btn-sm" onClick={doSave} disabled={busy === 'new'}>
              {busy === 'new' ? '保存中…' : '保存'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            已有主分类下加子分类：主分类填现有名称即可。每个主分类建议保留「全部」作为默认子项。
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-gray-400"><span className="loading loading-spinner loading-sm" /> 加载中…</div>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-400">暂无分类数据（后端不可用或未初始化）</p>
      ) : (
        <div className="card border border-gray-200 bg-base-100 shadow-sm" style={{ borderRadius: 16 }}>
          <div className="card-body p-5">
            <div className="text-xs text-gray-400 mb-3">共 {rows.length} 条分类记录 · {groups.length} 个主分类</div>
            {groups.map(g => (
              <div key={g.name} className="mb-4 border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold text-sm">{g.name}</span>
                  <span className="badge badge-ghost badge-xs">{g.subs.length} 个子分类</span>
                  <button className="btn btn-ghost btn-xs text-error ml-auto" onClick={() => delGroup(g.name)} disabled={busy === g.name}>
                    整组删除
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {g.subs.map(r => (
                    <span
                      key={r.id}
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs border ${
                        r.is_active === 1 ? 'border-gray-300 bg-base-100 text-gray-700' : 'border-dashed border-gray-200 bg-gray-50 text-gray-400 line-through'
                      }`}
                    >
                      {r.sub_name || '全部'}
                      <button className="text-gray-400 hover:text-primary cursor-pointer" title="启用/停用" disabled={busy === r.id} onClick={() => toggleActive(r)}>
                        {r.is_active === 1 ? '✓' : '○'}
                      </button>
                      <button className="text-gray-300 hover:text-error cursor-pointer" title="删除" disabled={busy === r.id} onClick={() => delRow(r)}>✕</button>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
