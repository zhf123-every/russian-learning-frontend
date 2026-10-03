// AdminSegments.jsx —— P2-B：语块校对页（只读 + 补跑 + 筛选；不做人工编辑，留 P3）。
//
// 数据源（降级）：localStorage(rb_admin_courses) 秒开 → 异步 GET /api/videos/list 合并去重
// （同 courseId 以 local 为准）；云端加载失败 → 仅显示本机 + toast。
// 句子主轴 = 课时 sentences（本地/云端课程自带）；语块状态从 GET /api/segments 按
// (sentence_hash, difficulty) 填充。
// 状态徽章只映射后端 review_status 的 ok / pending / generating（不造第三套命名）；
// 无任何记录的 (句, 档) 显示「未生成」（缺失提示，不是 review_status 值）。
// 补跑 = 整课时重跑（triggerUnitSegments：后端 llm-segment 幂等，已 ok 句零 LLM 成本）。
// 置灰条件：pending + generating + 未生成句子数 全部为 0 → disabled + tooltip。
import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getCourses } from '../utils/storage'
import { apiFetch } from '../lib/api'
import { useAdminStore } from '../store/adminStore'
import { withRetry403, sentenceHash } from '../lib/segmentEngine'
import { triggerUnitSegments } from '../lib/segmentTrigger'

const DIFFS = ['easy', 'medium', 'hard']
const DIFF_LABELS = { easy: '初级', medium: '中级', hard: '高级' }
// 徽章只映射后端 review_status 三值；'未生成' 是缺失提示（无记录），不属于 review_status
const STATUS_META = {
  ok: { label: 'ok', cls: 'badge-success', tip: 'AI 切块通过' },
  pending: { label: 'pending', cls: 'badge-warning', tip: '机械兜底，待人工校对' },
  generating: { label: 'generating', cls: 'badge-info', tip: '生成中，稍后自动完成' },
}

const sentText = (s) => String((s && (s.ru || s.russian || s.text)) || '').trim()

export default function AdminSegments() {
  const navigate = useNavigate()
  const [sp] = useSearchParams()
  const authBody = useAdminStore((s) => s.authBody)

  // 课程/课时选择：query 优先，未带则手动选
  const [courses, setCourses] = useState([])          // 合并后的课程列表（local 优先）
  const [cloudNote, setCloudNote] = useState('')      // 云端加载失败提示
  const [courseId, setCourseId] = useState(sp.get('course') || '')
  const [unitId, setUnitId] = useState(sp.get('unit') || '')

  const [diff, setDiff] = useState('medium')          // 难度 tab，默认 medium（已确认）
  const [statusFilter, setStatusFilter] = useState('all')
  const [rows, setRows] = useState([])                // 句子行：{ ru, zh, hash, byDiff: {easy:{status,segments,translation}, ...} }
  const [loadingItems, setLoadingItems] = useState(false)
  const [runBusy, setRunBusy] = useState(false)
  const [msg, setMsg] = useState('')

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

  // 2) 读课时语块状态
  const loadItems = useCallback(async () => {
    if (!courseId || !unitId) { setRows([]); return }
    setLoadingItems(true)
    try {
      const r = await apiFetch(`/api/segments?course_id=${encodeURIComponent(courseId)}&unit_id=${encodeURIComponent(unitId)}`, { timeout: 60000 })
      const j = await r.json()
      if (j.ok && Array.isArray(j.items)) {
        const map = new Map()
        for (const it of j.items) map.set(`${it.sentence_hash}::${it.difficulty}`, it)
        const u = (course && (course.units || []).find((x) => x.id === unitId)) || {}
        const list = (u.sentences || []).map((s) => {
          const ru = sentText(s)
          const hash = sentenceHash(ru, 'easy')
          const byDiff = {}
          for (const d of DIFFS) {
            const it = map.get(`${hash}::${d}`)
            byDiff[d] = it
              ? { status: it.status, segments: it.segments || [], translation: it.translation || '' }
              : { status: '未生成', segments: [], translation: '' }
          }
          return { ru, zh: String((s && (s.zh || s.chinese)) || '').trim(), hash, byDiff }
        }).filter((x) => x.ru)
        setRows(list)
      } else {
        setMsg(j.error || '读取语块失败')
      }
    } catch (e) {
      setMsg('读取语块失败：' + (e.message || '网络错误'))
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
      const r = await triggerUnitSegments({ courseId, unitId, sentences: unit.sentences || [], deps: { httpPost: segHttpPost } })
      if (r && r.skipped) {
        setMsg(r.skipped === 'in_flight' ? '本课时正在生成中，稍等再试' : '本课时没有句子')
      } else {
        setMsg(`补跑完成：成功 ${(r.done || []).length} 项${(r.failed || []).length ? `，失败 ${r.failed.length} 项（下次打开自动重试）` : ''}`)
      }
    } catch (e) {
      setMsg('补跑失败：' + (e.message || '网络错误'))
    } finally {
      setRunBusy(false)
      loadItems()
    }
  }

  // 4) 统计与筛选
  const counts = { pending: 0, generating: 0, missing: 0, ok: 0 }
  for (const row of rows) {
    for (const d of DIFFS) {
      const st = row.byDiff[d].status
      if (st === 'pending') counts.pending++
      else if (st === 'generating') counts.generating++
      else if (st === 'ok') counts.ok++
      else counts.missing++
    }
  }
  const todoCount = counts.pending + counts.generating + counts.missing
  const filteredRows = rows.filter((row) => {
    if (statusFilter === 'all') return true
    return DIFFS.some((d) => row.byDiff[d].status === statusFilter)
  })

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/admin')}>← 返回后台</button>
        <h1 className="text-xl font-bold">📑 语块管理</h1>
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
          {unit && <span className="text-xs text-gray-400">课时共 {(unit.sentences || []).length} 句 · 三档 × 每句</span>}
        </div>
      </div>

      {!unit ? (
        <div className="py-16 text-center text-sm text-gray-400">
          {courseId && !unitId ? '请选择课时' : '请选择课程与课时，查看该课时的语块生成状态'}
        </div>
      ) : (
        <>
          {/* 工具条：难度 tab + 状态筛选 + 统计 + 补跑 */}
          <div className="card border border-gray-200 bg-base-100 shadow-sm mb-4" style={{ borderRadius: 16 }}>
            <div className="card-body p-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="tabs tabs-boxed tabs-sm">
                  {DIFFS.map((d) => (
                    <button key={d} className={`tab ${diff === d ? 'tab-active' : ''}`} onClick={() => setDiff(d)}>{DIFF_LABELS[d]}</button>
                  ))}
                </div>
                <select className="select select-sm select-bordered ml-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">全部状态</option>
                  <option value="ok">ok</option>
                  <option value="pending">pending</option>
                  <option value="generating">generating</option>
                  <option value="未生成">未生成</option>
                </select>
                <div className="tooltip tooltip-bottom" data-tip={todoCount === 0 ? '本课时语块已全部生成' : `待处理 ${todoCount} 项（pending ${counts.pending} / generating ${counts.generating} / 未生成 ${counts.missing}）`}>
                  <button className="btn btn-sm btn-primary" onClick={runFill} disabled={runBusy || todoCount === 0}>
                    {runBusy ? '补跑中…' : '⟳ 补跑待生成'}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
                <span className="badge badge-success badge-sm">ok {counts.ok}</span>
                <span className="badge badge-warning badge-sm">pending {counts.pending}</span>
                <span className="badge badge-info badge-sm">generating {counts.generating}</span>
                <span className="badge badge-ghost badge-sm">未生成 {counts.missing}</span>
                <span className="text-gray-400">（ok=AI 切块通过 · pending=机械兜底待校对 · generating=在途）</span>
              </div>
              {msg && <div className="alert alert-info shadow-sm mt-3 py-2 text-sm">{msg}</div>}
            </div>
          </div>

          {/* 句子列表：句子主轴 → 当前难度档的语块 + 状态 */}
          {loadingItems ? (
            <div className="py-16 text-center text-sm text-gray-400"><span className="loading loading-spinner loading-sm" /> 读取中…</div>
          ) : !filteredRows.length ? (
            <div className="py-16 text-center text-sm text-gray-400">{rows.length ? '没有符合筛选状态的句子' : '本课时没有句子（语块以句子为数据源）'}</div>
          ) : (
            <div className="space-y-3">
              {filteredRows.map((row, ri) => {
                const cur = row.byDiff[diff]
                const meta = STATUS_META[cur.status] || { label: '未生成', cls: 'badge-ghost', tip: '尚无任何生成记录，补跑可生成' }
                return (
                  <div key={row.hash + '_' + ri} className="card border border-gray-200 bg-base-100 shadow-sm" style={{ borderRadius: 16 }}>
                    <div className="card-body p-4">
                      <div className="flex items-start gap-3 flex-wrap">
                        <span className="text-xs text-gray-400 mt-1">#{ri + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-base font-semibold">{row.ru}</div>
                          {row.zh && <div className="text-sm text-gray-500 mt-0.5">{row.zh}</div>}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className={`badge badge-sm ${meta.cls}`} title={meta.tip}>{meta.label}</span>
                            <span className="text-xs text-gray-400">{DIFF_LABELS[diff]}档{cur.translation ? ` · 译文：${cur.translation}` : ''}</span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {cur.segments.length ? cur.segments.map((seg, si) => (
                              <span key={si} className="badge badge-outline badge-sm px-2 py-2 h-auto whitespace-normal font-normal"
                                title={`${seg.type || 'chunk'}`}>
                                <span className="text-gray-800">{seg.text}</span>
                                {seg.chinese ? <span className="ml-1 text-gray-400">（{seg.chinese}）</span> : null}
                              </span>
                            )) : (
                              <span className="text-xs text-gray-400">{cur.status === 'generating' ? '正在生成…' : '暂无语块（点击「补跑待生成」）'}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
