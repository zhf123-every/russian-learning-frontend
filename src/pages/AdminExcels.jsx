// AdminExcels.jsx —— Excel 管理：后台所有已上传课时的原始 Excel 自动归档于此
// 列表展示（课程/课时/文件名/更新时间）→ 下载 / 在线编辑 →
// 保存 = 覆盖云端原始 Excel + 更新本地课程句子 + 已发布课程同步云端（学习页自动跟随）
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { apiFetch } from '../lib/api'
import { useAdminStore } from '../store/adminStore'
import { getCourses, saveCourses } from '../utils/storage'

const isRuHead = (h) => h === 'ru' || h === 'russian' || h.includes('俄')
const isZhHead = (h) => h === 'zh' || h === 'chinese' || h.includes('中')

export default function AdminExcels() {
  const navigate = useNavigate()
  const { token, authBody } = useAdminStore()
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [titleMap, setTitleMap] = useState({}) // course_id -> { course: title, unit: title }
  // 编辑态
  const [editing, setEditing] = useState(null) // { course_id, unit_id, file_name }
  const [aoa, setAoa] = useState([])          // 完整二维数组（含表头）
  const [ruIdx, setRuIdx] = useState(1)
  const [zhIdx, setZhIdx] = useState(2)
  const [saving, setSaving] = useState(false)

  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(''), 2600) }

  // 标题映射：本地课程 + 云端课程（kind=course）合并
  const loadTitleMap = async () => {
    const map = {}
    const add = (c) => {
      const units = (c.units || []).reduce((m, u) => { m[u.id] = u.title || ''; return m }, {})
      map[c.id] = { course: c.title || c.subtitle || '未命名课程', units }
    }
    getCourses().forEach(add)
    try {
      const r = await apiFetch('/api/videos/list')
      const j = await r.json()
      if (j.ok && Array.isArray(j.videos)) {
        j.videos.filter(v => v && v.kind === 'course').forEach(add)
      }
    } catch (e) { /* 云端不可用仅用本地标题 */ }
    setTitleMap(map)
  }

  const loadFiles = async () => {
    setLoading(true)
    try {
      const r = await apiFetch(`/api/admin/units/source-files?token=${encodeURIComponent(token || '')}`, { timeout: 30000 })
      const j = await r.json()
      if (j.ok && Array.isArray(j.files)) setFiles(j.files)
      else flash('读取列表失败：' + (j.error || r.status))
    } catch (e) {
      flash('读取列表失败：' + (e.message || '网络错误'))
    }
    setLoading(false)
  }

  useEffect(() => {
    loadTitleMap()
    loadFiles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // 打开编辑：下载原始 Excel → 解析为二维数组（保留表头与全部列）
  const openEdit = async (f) => {
    setMsg('')
    try {
      const r = await apiFetch(`/api/admin/units/source-file?course_id=${encodeURIComponent(f.course_id)}&unit_id=${encodeURIComponent(f.unit_id)}&token=${encodeURIComponent(token || '')}`, { timeout: 60000 })
      if (!r.ok) { flash('下载失败：' + r.status); return }
      const buf = await r.arrayBuffer()
      const wb = XLSX.read(new Uint8Array(buf), { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      if (!ws) { flash('文件里没有工作表'); return }
      const a = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
      if (!a.length) { flash('文件是空的'); return }
      const head = (a[0] || []).map(h => String(h || '').trim().toLowerCase())
      const rI = head.findIndex(isRuHead)
      const zI = head.findIndex(isZhHead)
      if (rI === -1) { flash('表头需含俄语列（ru/俄语），无法编辑'); return }
      setAoa(a)
      setRuIdx(rI)
      setZhIdx(zI >= 0 ? zI : -1)
      setEditing(f)
    } catch (e) {
      flash('打开失败：' + (e.message || '网络错误'))
    }
  }

  // 单元格编辑
  const patchCell = (row, col, val) => {
    setAoa(prev => prev.map((r, i) => i === row ? r.map((c, j) => j === col ? val : c) : r))
  }
  const addRow = () => setAoa(prev => [...prev, []])
  const delRow = (row) => setAoa(prev => prev.filter((_, i) => i !== row))

  // 从二维数组提取句子行（保序、过滤空 ru）
  const extractRows = (arr) => {
    const out = []
    for (let i = 1; i < arr.length; i++) {
      const ru = String(arr[i][ruIdx] ?? '').trim()
      if (!ru) continue
      const zh = zhIdx >= 0 ? String(arr[i][zhIdx] ?? '').trim() : ''
      out.push({ ru, zh })
    }
    return out
  }

  // 同步云端：把更新后的本地课程对象写回 B2 videos/index.json（同 id 替换）
  const syncCloudCourse = async (course) => {
    try {
      const r = await apiFetch('/api/videos/list')
      const j = await r.json()
      if (!j.ok || !Array.isArray(j.videos)) return false
      const cloud = j.videos.map(v => (v && v.id === course.id) ? { ...v, ...course, units: course.units, kind: 'course', src: 'admin' } : v)
      const sr = await apiFetch('/api/videos/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authBody({ videos: cloud })),
        timeout: 60000,
      })
      const sj = await sr.json()
      return !!(sj && sj.ok)
    } catch (e) {
      console.warn('[excel] 云端同步失败：', e && e.message)
      return false
    }
  }

  const saveEdit = async () => {
    if (!editing || saving) return
    const rows = extractRows(aoa)
    if (!rows.length) { flash('没有有效句子（俄语列至少一行）'); return }
    setSaving(true)
    try {
      // 1. 生成新 xlsx（保留表头与列结构）→ 覆盖云端原始 Excel
      const ws = XLSX.utils.aoa_to_sheet(aoa)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
      const b64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' })
      const sr = await apiFetch('/api/admin/units/source-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authBody({ course_id: editing.course_id, unit_id: editing.unit_id, file_name: editing.file_name, file_base64: b64 })),
        timeout: 60000,
      })
      const sj = await sr.json()
      const cloudSaved = !!(sj && sj.ok)

      // 2. 更新本地课程该课时 sentences（顺序 = 行顺序）
      let updated = null
      const list = getCourses()
      const course = list.find(c => c.id === editing.course_id)
      if (course) {
        const unit = (course.units || []).find(u => u.id === editing.unit_id)
        if (unit) {
          unit.sentences = rows
          saveCourses(list)
          updated = course
        }
      }
      // 3. 已发布课程 → 同步云端（学习页跟随）
      let synced = false
      if (updated && updated.status === 'published') {
        synced = await syncCloudCourse(updated)
      }
      flash(`✅ 已保存 ${rows.length} 句` + (cloudSaved ? '，Excel 已覆盖' : '，Excel 覆盖失败') + (synced ? '，已同步云端，学习页自动跟随' : (updated && updated.status === 'published' ? '，⚠️ 云端同步失败，可稍后重试' : '')))
      if (cloudSaved || updated) {
        setEditing(null)
        setAoa([])
        loadFiles()
        loadTitleMap()
      }
    } catch (e) {
      flash('保存失败：' + (e.message || '网络错误'))
    }
    setSaving(false)
  }

  const fmtTime = (t) => {
    if (!t) return ''
    const d = new Date(Number(t))
    if (isNaN(d.getTime())) return String(t)
    const p = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
  }

  // 编辑视图
  if (editing) {
    const tm = titleMap[editing.course_id] || {}
    return (
      <div className="mx-auto max-w-[1100px]">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <button className="btn btn-ghost btn-sm -ml-2 text-gray-500" onClick={() => { setEditing(null); setAoa([]) }}>← 返回列表</button>
            <h1 className="text-xl font-extrabold text-gray-900 mt-1">📗 编辑 Excel · {tm.course || '课程'} / {tm.units?.[editing.unit_id] || '课时'}</h1>
            <p className="text-xs text-gray-400 mt-0.5">修改单元格后点「保存」：Excel 覆盖 + 课时句子更新 + 已发布课程同步云端，学习页自动跟随</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(null); setAoa([]) }} disabled={saving}>取消</button>
            <button className="btn btn-primary btn-sm" onClick={saveEdit} disabled={saving}>{saving ? '保存中…' : '💾 保存'}</button>
          </div>
        </div>
        {msg && <div className="alert alert-success mt-3 shadow-lg" style={{ padding: '10px 16px' }}><span>✅ {msg}</span></div>}

        <div className="card mt-4 border border-gray-200 bg-base-100 shadow-sm" style={{ borderRadius: 14, overflow: 'hidden' }}>
          <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' }}>
            <table className="table table-zebra table-xs">
              <thead className="sticky top-0 bg-base-200">
                <tr>
                  <th className="w-10">#</th>
                  {aoa[0]?.map((h, j) => (
                    <th key={j} className={j === ruIdx ? 'bg-primary/10' : ''}>
                      {h || (j === ruIdx ? '俄语' : j === zhIdx ? '中文' : `列${j + 1}`)}
                    </th>
                  ))}
                  <th className="w-14"></th>
                </tr>
              </thead>
              <tbody>
                {aoa.slice(1).map((row, i) => (
                  <tr key={i}>
                    <td className="text-gray-400">{i + 1}</td>
                    {aoa[0].map((_, j) => (
                      <td key={j}>
                        <input
                          className="input input-bordered input-xs w-full"
                          value={String(row[j] ?? '')}
                          onChange={e => patchCell(i + 1, j, e.target.value)}
                          style={{ minWidth: j === ruIdx ? 180 : j === zhIdx ? 180 : 100 }}
                        />
                      </td>
                    ))}
                    <td><button className="btn btn-ghost btn-xs text-error" onClick={() => delRow(i + 1)}>删</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-2 p-3 border-t border-gray-100">
            <button className="btn btn-outline btn-xs" onClick={addRow}>＋ 添加一行</button>
            <span className="text-xs text-gray-400">俄语列高亮；空俄语行保存时自动忽略</span>
          </div>
        </div>
      </div>
    )
  }

  // 列表视图
  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">📗 Excel 管理</h1>
          <p className="text-xs text-gray-400 mt-0.5">后台上传课程时自动保存的原始 Excel 都在这里 · 可下载或在线编辑，保存后学习页自动跟随</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => { loadFiles(); loadTitleMap() }}>⟳ 刷新</button>
      </div>
      {msg && <div className="alert alert-success mt-3 shadow-lg" style={{ padding: '10px 16px' }}><span>✅ {msg}</span></div>}

      <div className="card mt-4 border border-gray-200 bg-base-100 shadow-sm" style={{ borderRadius: 14, overflow: 'hidden' }}>
        <div className="overflow-x-auto">
          <table className="table table-zebra table-sm">
            <thead className="bg-base-200">
              <tr>
                <th>课程</th>
                <th>课时</th>
                <th>文件名</th>
                <th>更新时间</th>
                <th className="w-40 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center text-gray-400 py-6">加载中…</td></tr>
              ) : files.length === 0 ? (
                <tr><td colSpan={5} className="text-center text-gray-400 py-6">还没有保存的 Excel——后台上传课程（CSV/Excel）时会自动归档到这里</td></tr>
              ) : files.map((f, i) => {
                const tm = titleMap[f.course_id] || {}
                return (
                  <tr key={i}>
                    <td className="font-medium">{tm.course || f.course_id}</td>
                    <td>{tm.units?.[f.unit_id] || f.unit_id}</td>
                    <td className="text-gray-500">{f.file_name || 'lesson.xlsx'}</td>
                    <td className="text-gray-400">{fmtTime(f.updated_at)}</td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1">
                        <button className="btn btn-outline btn-xs" onClick={() => {
                          window.open(`/api/admin/units/source-file?course_id=${encodeURIComponent(f.course_id)}&unit_id=${encodeURIComponent(f.unit_id)}&token=${encodeURIComponent(token || '')}`, '_blank')
                        }}>⬇ 下载</button>
                        <button className="btn btn-primary btn-xs" onClick={() => openEdit(f)}>✏ 编辑</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
