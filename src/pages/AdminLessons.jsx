// ===== 站长后台 · 课时大纲管理 =====
// 路由：/admin/lessons/:id —— 管理某门课程的 lessonsList（大纲 + 试学标记）
// 行内编辑，支持：添加 / 编辑 / 删除 / 上移 / 下移；保存后写 localStorage 并同步云端
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getCourses, saveCourses } from '../utils/storage'
import { apiFetch } from '../lib/api'
import { useAdminStore } from '../store/adminStore'

const TYPES = ['单词', '例句', '单词 · 例句']

export default function AdminLessons() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { adminKey } = useAdminStore()
  const [course, setCourse] = useState(null)
  const [rows, setRows] = useState([])
  const [toast, setToast] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    const c = getCourses().find(x => x.id === id) || null
    setCourse(c)
    if (!c) return
    if (Array.isArray(c.lessonsList) && c.lessonsList.length) {
      setRows(c.lessonsList.map(r => ({ ...r })))
    } else if (Array.isArray(c.units) && c.units.length) {
      const ft = Number(c.freeTrialCount) || 0
      setRows(c.units.map((u, i) => ({
        lessonId: 'lesson_' + String(i + 1).padStart(2, '0'),
        title: u.title || ('第 ' + (i + 1) + ' 课'),
        subtitle: u.title || '',
        type: '单词 · 例句',
        isFree: i < ft,
      })))
    } else {
      setRows([])
    }
  }, [id])

  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 2500) }

  const update = (i, patch) => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r))

  const add = () => setRows(prev => [...prev, {
    lessonId: 'lesson_' + String(prev.length + 1).padStart(2, '0'),
    title: '第 ' + (prev.length + 1) + ' 课',
    subtitle: '',
    type: '单词 · 例句',
    isFree: false,
  }])

  const remove = (i) => setRows(prev => prev.filter((_, idx) => idx !== i))

  const move = (i, dir) => {
    const j = i + dir
    if (j < 0 || j >= rows.length) return
    setRows(prev => { const next = [...prev]; [next[i], next[j]] = [next[j], next[i]]; return next })
  }

  // 保存大纲：写 localStorage（更新课程），并同步云端（前台可读）
  const save = async () => {
    if (!course) return
    const list = getCourses()
    const idx = list.findIndex(x => x.id === course.id)
    if (idx < 0) { flash('课程不存在'); return }
    const finalRows = rows.map((r, i) => ({
      ...r,
      lessonId: r.lessonId || 'lesson_' + String(i + 1).padStart(2, '0'),
      title: (r.title || '').trim() || ('第 ' + (i + 1) + ' 课'),
    }))
    const freeCount = finalRows.filter(r => r.isFree).length
    list[idx] = { ...list[idx], lessonsList: finalRows, freeTrialCount: freeCount, isVipOnly: true }
    saveCourses(list)
    setCourse(list[idx])
    flash('大纲已保存（' + finalRows.length + ' 课，试学 ' + freeCount + ' 课）')

    if (!adminKey) { setMsg('已保存到本地（未登录管理员，未同步云端）'); return }
    setSaving(true)
    try {
      const cur = await apiFetch('/api/videos/list').then(r => r.json())
      const cloud = (cur.ok && Array.isArray(cur.videos)) ? cur.videos : []
      const c = list[idx]
      const obj = {
        ...c, kind: 'course', section: 'guide',
        cat: c.category, category: c.category,
        level: c.difficulty, stage: c.grade, grade: c.grade, textbook: c.textbook,
        eps: (Array.isArray(c.units) ? c.units.length : (c.lessons || 1)) + ' 关',
        total: Array.isArray(c.units) ? c.units.length : (c.lessons || 1),
        thumbnail: c.cover, posterUrl: c.cover,
        views: c.students || 0,
        tags: ['course', c.category, c.grade, c.textbook],
      }
      const mine = new Set([obj.id])
      const merged = [...cloud.filter(v => !(v.kind === 'course' && mine.has(v.id))), obj]
      const sr = await apiFetch('/api/videos/sync', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videos: merged, adminKey }),
      })
      const sj = await sr.json()
      setMsg(sj.ok ? '✅ 大纲已保存并同步到云端，前台可读' : '⚠️ 同步失败：' + (sj.error || '未知错误'))
    } catch (e) {
      setMsg('⚠️ 同步异常：' + (e.message || '网络错误'))
    }
    setSaving(false)
  }

  if (!course) {
    return (
      <div className="min-h-full bg-base-100 flex items-center justify-center" style={{ padding: 60 }}>
        <div className="text-center">
          <div style={{ fontSize: 40 }}>📋</div>
          <h2 className="text-lg font-bold mt-3">课程不存在</h2>
          <button className="btn btn-primary mt-4" onClick={() => navigate('/admin')}>返回后台</button>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-full bg-base-100 p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        {/* 头部 */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-gray-900">课时大纲管理</h1>
            <p className="mt-1 text-sm text-gray-400 line-clamp-1">课程：{course.title}</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/admin')}>← 返回后台</button>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
              {saving ? '保存中…' : '💾 保存大纲'}
            </button>
          </div>
        </div>

        {msg && <div className="mt-3 alert alert-info py-2 text-sm" style={{ borderRadius: 12 }}>{msg}</div>}
        {toast && <div className="toast toast-top toast-end z-50"><div className="alert alert-success py-2 text-sm">{toast}</div></div>}

        {/* 大纲表格 */}
        <div className="card mt-4 border border-gray-200 bg-base-100 shadow-sm" style={{ borderRadius: 16 }}>
          <div className="card-body p-4 md:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-gray-800">
                课时列表（{rows.length} 课 · 免费试学 {rows.filter(r => r.isFree).length} 课）
              </h2>
              <button className="btn btn-outline btn-xs" onClick={add}>＋ 添加课时</button>
            </div>

            {rows.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">还没有课时，点「＋ 添加课时」开始录入</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table table-sm">
                  <thead>
                    <tr className="text-xs text-gray-400">
                      <th style={{ width: 44 }}>#</th>
                      <th>主标题</th>
                      <th>副标题</th>
                      <th style={{ width: 110 }}>类型</th>
                      <th style={{ width: 86 }}>免费试学</th>
                      <th style={{ width: 130 }}>排序</th>
                      <th style={{ width: 56 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.lessonId || i}>
                        <td className="text-xs text-gray-400 font-mono">{String(i + 1).padStart(2, '0')}</td>
                        <td>
                          <input
                            className="input input-sm input-bordered w-full min-w-[150px]"
                            value={r.title || ''}
                            placeholder="课时主标题"
                            onChange={e => update(i, { title: e.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            className="input input-sm input-bordered w-full min-w-[150px]"
                            value={r.subtitle || ''}
                            placeholder="课时副标题（可留空）"
                            onChange={e => update(i, { subtitle: e.target.value })}
                          />
                        </td>
                        <td>
                          <select
                            className="select select-sm select-bordered w-full"
                            value={r.type || '单词 · 例句'}
                            onChange={e => update(i, { type: e.target.value })}
                          >
                            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </td>
                        <td className="text-center">
                          <input
                            type="checkbox"
                            className="checkbox checkbox-sm checkbox-warning"
                            checked={Boolean(r.isFree)}
                            onChange={e => update(i, { isFree: e.target.checked })}
                          />
                        </td>
                        <td>
                          <div className="flex gap-1">
                            <button className="btn btn-ghost btn-xs" disabled={i === 0} onClick={() => move(i, -1)} title="上移">↑</button>
                            <button className="btn btn-ghost btn-xs" disabled={i === rows.length - 1} onClick={() => move(i, 1)} title="下移">↓</button>
                          </div>
                        </td>
                        <td className="text-center">
                          <button className="btn btn-error btn-xs btn-outline" onClick={() => remove(i)}>删</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3 text-xs text-gray-400">
              <span>💡 勾选「免费试学」的课时，前台大纲页显示橙色「可试学」并可点击进入；未勾选显示 🔒 锁定。</span>
              <span>试学课时数：<b className="text-gray-600">{rows.filter(r => r.isFree).length}</b></span>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}