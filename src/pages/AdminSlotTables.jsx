// AdminSlotTables.jsx —— P2：6 列表格校对页（只读 + 补跑 + 状态筛选，不做人工编辑）。
//
// 数据源（降级）：localStorage(rb_admin_courses) 秒开 → 异步 GET /api/videos/list 合并去重
// （同 courseId 以 local 为准）；云端加载失败 → 仅显示本机 + toast。
// 句子主轴 = 课时 sentences（本地/云端课程自带）；表格状态从 GET /api/slot-tables
// ?include_pending=1 按 (sentence_hash, difficulty) 填充（ok / pending / 未生成）。
// 状态徽章只映射后端 review_status 的 ok / pending（不造第三套命名）；
// 无任何记录的 (句, 档) 显示「未生成」（缺失提示，不是 review_status 值）。
// 补跑 = 整课时重跑（triggerUnitSlotTables：后端 table-fill 幂等缓存，已 ok 句零 LLM 成本）。
// 只读展示：不做人工编辑（表格行编辑留后续；本次范围 = 只读 + 补跑 + 筛选）。
import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getCourses } from '../utils/storage'
import { apiFetch } from '../lib/api'
import { useAdminStore } from '../store/adminStore'
import { withRetry403, sentenceHash, normalizeSentence } from '../lib/segmentEngine'
import { triggerUnitSlotTables } from '../lib/slotTablesTrigger'
import { collectUnitSentenceObjs, countUnitSentences } from '../lib/unitSentences'

const DIFFS = ['easy', 'medium', 'hard']
const DIFF_LABELS = { easy: '初级', medium: '中级', hard: '高级' }
// 徽章只映射后端 review_status 值；'未生成' 是缺失提示（无记录），不属于 review_status
const STATUS_META = {
  ok: { label: 'ok', cls: 'badge-success', tip: '表格已生成（学生端可用）' },
  pending: { label: 'pending', cls: 'badge-warning', tip: '机械兜底，待校对（学生端自动降级）' },
}

const sentText = (s) => String((s && (s.ru || s.russian || s.text)) || '').trim()

export default function AdminSlotTables() {
  const navigate = useNavigate()
  const [sp] = useSearchParams()
  const authBody = useAdminStore((s) => s.authBody)

  // 课程/课时选择：query 优先，未带则手动选
  const [courses, setCourses] = useState([])          // 合并后的课程列表（local 优先）
  const [cloudNote, setCloudNote] = useState('')      // 云端加载失败提示
  const [courseId, setCourseId] = useState(sp.get('course') || '')
  const [unitId, setUnitId] = useState(sp.get('unit') || '')

  const [diff, setDiff] = useState('medium')          // 难度 tab，默认 medium（与语块校对页一致）
  const [statusFilter, setStatusFilter] = useState('all')
  const [rows, setRows] = useState([])                // 句子行：{ ru, zh, hash, byDiff: {easy:{status,table}, ...} }
  const [loadingItems, setLoadingItems] = useState(false)
  const [runBusy, setRunBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [expanded, setExpanded] = useState(null)      // 展开预览的 {hash, diff} | null

  const segHttpPost = withRetry403((path, body) =>
    apiFetch(path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(authBody(body)) })
  )

  const course = courses.find((c) => c.id === courseId) || null
  const unit = course ? (course.units || []).find((u) => u.id === unitId) || null : null

  // 1) localStorage 秒开 + 异步合并云端（同 courseId 以 local 为准；云端失败仅提示）
  useEffect(() => {
    const locals = getCourses()
    setCourses(locals)
    let cancelled = false
    ;(async () => {
      try {
        const r = await apiFetch('/api/videos/list', { timeout: 60000 })
        const j = await r.json()
        if (!cancelled && j.ok && Array.isArray(j.videos)) {
          const cloud = j.videos.filter((v) => v.kind === 'course' && Array.isArray(v.units))
          const localIds = new Set(locals.map((c) => c.id))
          const merged = [...locals, ...cloud.filter((c) => !localIds.has(c.id))]
          setCourses(merged)
          if (!localIds.size) setCloudNote('') // 本机无课程，云端列表正常加载
        }
      } catch (e) {
        if (!cancelled) setCloudNote('云端课程加载失败，仅显示本机')
      }
    })()
    return () => { cancelled = true }
  }, [])

  // 2) 读课时表格状态（include_pending=1：ok/pending 都回，无记录 = 未生成）
  const loadItems = useCallback(async () => {
    if (!courseId || !unitId) { setRows([]); return }
    setLoadingItems(true)
    try {
      const r = await apiFetch(`/api/slot-tables?course_id=${encodeURIComponent(courseId)}&unit_id=${encodeURIComponent(unitId)}&include_pending=1`, { timeout: 60000 })
      const j = await r.json()
      if (j.ok && Array.isArray(j.items)) {
        const map = new Map()
        for (const it of j.items) map.set(`${it.sentence_hash}::${it.difficulty}`, it)
        const u = (course && (course.units || []).find((x) => x.id === unitId)) || {}
        const list = collectUnitSentenceObjs(u).map((s) => {
          const ru = sentText(s)
          const hash = sentenceHash(ru, 'easy')
          const byDiff = {}
          for (const d of DIFFS) {
            const it = map.get(`${hash}::${d}`)
            byDiff[d] = it
              ? { status: it.status, table: it.rows || [] }
              : { status: '未生成', table: [] }
          }
          return { ru, zh: String((s && (s.zh || s.chinese)) || '').trim(), hash, byDiff }
        }).filter((x) => x.ru)
        setRows(list)
      } else {
        setMsg(j.error || '读取表格失败')
      }
    } catch (e) {
      setMsg('读取表格失败：' + (e.message || '网络错误'))
    } finally {
      setLoadingItems(false)
    }
  }, [courseId, unitId, course])

  useEffect(() => { loadItems() }, [loadItems])

  // 3) 补跑：整课时重跑（幂等；已 ok 句后端缓存零 LLM 成本）
  const runFill = async () => {
    if (!unit || runBusy) return
    setRunBusy(true)
    setMsg('')
    try {
      const r = await triggerUnitSlotTables({ courseId, unitId, sentences: collectUnitSentenceObjs(unit), deps: { httpPost: segHttpPost } })
      if (r && r.skipped) {
        setMsg(r.skipped === 'in_flight' ? '本课时正在生成中，稍等再试' : '本课时没有句子')
      } else {
        setMsg(`补跑完成：成功 ${(r.done || []).length} 项${(r.failed || []).length ? `，失败 ${r.failed.length} 项（下次打开自动重试）` : ''}${(r.pending || []).length ? `，机械兜底 ${r.pending.length} 项待校对` : ''}`)
      }
    } catch (e) {
      setMsg('补跑失败：' + (e.message || '网络错误'))
    } finally {
      setRunBusy(false)
      loadItems()
    }
  }

  // 4) 统计与筛选
  const counts = { pending: 0, missing: 0, ok: 0 }
  for (const row of rows) {
    for (const d of DIFFS) {
      const st = row.byDiff[d].status
      if (st === 'pending') counts.pending++
      else if (st === 'ok') counts.ok++
      else counts.missing++
    }
  }
  const todoCount = counts.pending + counts.missing
  const filteredRows = rows.filter((row) => {
    if (statusFilter === 'all') return true
    return DIFFS.some((d) => row.byDiff[d].status === statusFilter)
  })

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/admin')}>← 返回后台</button>
        <h1 className="text-xl font-bold">🗂 表格管理（6列表格）</h1>
        <span className="badge badge-ghost badge-sm">仅管理员可见 · 只读 + 补跑</span>
        {cloudNote && <span className="badge badge-warning badge-sm">{cloudNote}</span>}
      </div>

      {/* 课程 / 课时选择 */}
      <div className="card border border-gray-200 bg-base-100 shadow-sm mb-4" style={{ borderRadius: 16 }}>
        <div className="card-body p-4 flex flex-wrap items-center gap-3">
          <select className="select select-sm select-bordered" value={courseId} onChange={(e) => { setCourseId(e.target.value); setUnitId('') }}>
            <option value="">选择课程…</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.title || c.name || c.id}</option>)}
          </select>
          <select className="select select-sm select-bordered" value={unitId} onChange={(e) => setUnitId(e.target.value)} disabled={!course}>
            <option value="">选择课时…</option>
            {(course ? (course.units || []) : []).map((u) => <option key={u.id} value={u.id}>{u.title || u.id}</option>)}
          </select>
          {unit && <span className="text-xs text-gray-400">课时共 {countUnitSentences(unit)} 句（例句+路径末步） · 三档 × 每句</span>}
        </div>
      </div>

      {/* 难度 tab + 状态筛选 + 补跑 */}
      <div className="card border border-gray-200 bg-base-100 shadow-sm mb-4" style={{ borderRadius: 16 }}>
        <div className="card-body p-4 flex flex-wrap items-center gap-3">
          <div className="btn-group btn-group-sm">
            {DIFFS.map((d) => (
              <button key={d} className={`btn btn-sm ${diff === d ? 'btn-active btn-primary' : 'btn-ghost'}`} onClick={() => setDiff(d)}>
                {DIFF_LABELS[d]}
              </button>
            ))}
          </div>
          <div className="btn-group btn-group-sm">
            {['all', 'ok', 'pending', '未生成'].map((s) => (
              <button key={s} className={`btn btn-sm ${statusFilter === s ? 'btn-active' : 'btn-ghost'}`} onClick={() => setStatusFilter(s)}>
                {s === 'all' ? '全部' : (STATUS_META[s] ? STATUS_META[s].label : s)}
              </button>
            ))}
          </div>
          <button className="btn btn-primary btn-sm ml-auto" onClick={runFill} disabled={!unit || runBusy}>
            {runBusy ? '生成中…' : `🔄 补跑${todoCount ? `（${todoCount} 项待生成）` : ''}`}
          </button>
        </div>
      </div>

      {msg && <div className="alert alert-info mb-4 py-2 text-sm">{msg}</div>}

      {/* 句子 × 三档状态表 */}
      {loadingItems ? (
        <div className="text-center py-10 text-gray-400">加载中…</div>
      ) : filteredRows.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          {courseId && unitId ? '本课时没有可生成的句子（请先在课程管理录入例句）' : '请先选择课程和课时'}
        </div>
      ) : (
        <div className="card border border-gray-200 bg-base-100 shadow-sm" style={{ borderRadius: 16 }}>
          <div className="card-body p-2 md:p-4">
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr className="text-xs text-gray-400">
                    <th>俄语句子</th>
                    <th>中文</th>
                    {DIFFS.map((d) => <th key={d} className="text-center">{DIFF_LABELS[d]}（{counts[d === 'easy' ? 'ok' : d]}）</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.hash} className="border-b border-gray-100">
                      <td className="font-medium">{row.ru}</td>
                      <td className="text-gray-500 text-sm">{row.zh}</td>
                      {DIFFS.map((d) => {
                        const st = row.byDiff[d].status
                        const meta = STATUS_META[st]
                        const tbl = row.byDiff[d].table || []
                        const isExpanded = expanded && expanded.hash === row.hash && expanded.diff === d
                        return (
                          <td key={d} className="text-center align-top">
                            <span className={`badge badge-sm ${meta ? meta.cls : 'badge-ghost'}`} title={meta ? meta.tip : '该句该档无任何生成记录，可点补跑'}>
                              {meta ? meta.label : '未生成'}
                            </span>
                            {st === 'ok' && (
                              <span className="ml-1 text-xs text-gray-400">{tbl.length} 行</span>
                            )}
                            {st === 'ok' && (
                              <button className="btn btn-ghost btn-xs ml-1" onClick={() => setExpanded(isExpanded ? null : { hash: row.hash, diff: d })}>
                                {isExpanded ? '收起' : '预览'}
                              </button>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 表格预览（展开） */}
            {expanded && (
              <div className="mt-3 border-t border-gray-200 pt-3">
                {(() => {
                  const row = rows.find((x) => x.hash === expanded.hash)
                  if (!row) return null
                  const tbl = row.byDiff[expanded.diff].table || []
                  return (
                    <div className="overflow-x-auto">
                      <table className="table table-sm">
                        <thead>
                          <tr className="text-xs text-gray-400">
                            <th>序号</th><th>卡片类型</th><th>俄语内容</th><th>中文翻译</th><th>语法标签</th><th>组ID</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tbl.map((t) => (
                            <tr key={`${t.seq}-${t.ru}`}>
                              <td className="text-gray-400">{t.seq}</td>
                              <td><span className={`badge badge-sm ${t.cardType === '完整句' ? 'badge-primary' : 'badge-ghost'}`}>{t.cardType}</span></td>
                              <td className="font-medium">{t.ru}</td>
                              <td className="text-gray-500 text-sm">{t.zh}</td>
                              <td className="text-gray-500 text-sm">{t.tag}</td>
                              <td className="text-gray-400 text-xs">{t.groupId}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
