// ===== P1-B 学习记录上云：统一同步模块 =====
// 现状：答题断点存 localStorage（qs_progress_<mode>_<unitId>），完成标记存 rlearn_unit_done。
// 本模块：登录用户把这些数据防抖批量上报云端；进页面时拉取云端并按 ts 合并回本地（新者优先）。
// 未登录用户：本模块自动跳过（本地照旧），登录后自动开始同步。
import { apiFetch } from './api'
import { useAdminStore } from '../store/adminStore'

const MODES = ['practice', 'listening', 'speaking', 'dictation']
const LS_DONE = 'rlearn_unit_done'
let dirtyTimer = null
let pendingItems = null // 防抖期间缓存本次条目，beforeunload 立即发送

function loggedInUser() {
  const s = useAdminStore.getState()
  const u = s.user
  if (s.token && u && u.id && ['admin', 'editor', 'viewer', 'learner'].includes(u.role)) return u
  return null
}

// 从当前页面 URL 提取课程包 id（&courseId=course_xxx 或 /game/course_xxx），拿不到返回 ''
function courseIdFromUrl() {
  try {
    const p = new URLSearchParams(location.search)
    const c = p.get('courseId')
    if (c) return c
    const m = location.pathname.match(/\/game\/(course_[^/]+)/)
    return m ? m[1] : ''
  } catch (e) { return '' }
}

// 扫描 localStorage，组装上报条目
function collectItems() {
  const items = []
  const courseId = courseIdFromUrl()
  for (const mode of MODES) {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key || !key.startsWith(`qs_progress_${mode}_`)) continue
      const unitId = key.slice(`qs_progress_${mode}_`.length)
      if (!unitId) continue
      try {
        const v = JSON.parse(localStorage.getItem(key) || 'null')
        if (!v || typeof v.ts !== 'number') continue
        items.push({
          course_id: courseId || (v.course_id || ''),
          unit_id: unitId,
          mode,
          seq_index: v.seqIndex !== undefined ? v.seqIndex : (v.idx || 0), // Practice 用 seqIndex，其余 3 模式用 idx
          unit_index: v.unitIndex || 0,
          difficulty: v.difficulty || '',
          status: v.status === 1 ? 1 : 0,
          ts: v.ts,
        })
      } catch (e) { /* 跳过损坏条目 */ }
    }
  }
  // 完成标记（课时完成）
  try {
    const done = JSON.parse(localStorage.getItem(LS_DONE) || '{}') || {}
    for (const unitId of Object.keys(done)) {
      const ts = Number(done[unitId]) || 0
      if (!ts) continue
      // 若已有同 unit 的答题断点，补 status=1；否则生成一条完成标记
      const hit = items.find(it => it.unit_id === unitId)
      if (hit) { hit.status = 1; hit.ts = Math.max(hit.ts, ts) }
      else items.push({ course_id: courseId, unit_id: unitId, mode: 'practice', seq_index: 0, unit_index: 0, difficulty: '', status: 1, ts })
    }
  } catch (e) { /* 忽略 */ }
  return items
}

// 立即上报（beforeunload / 手动触发）
export function flushProgress() {
  if (dirtyTimer) { clearTimeout(dirtyTimer); dirtyTimer = null }
  const u = loggedInUser()
  const items = pendingItems || collectItems()
  pendingItems = null
  if (!u || !items.length) return
  apiFetch('/api/learning/progress/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: useAdminStore.getState().token, items }),
    timeout: 60000,
  }).then(r => r.json()).then(j => {
    if (!j.ok) console.warn('[cloudProgress] 上报失败:', j.error)
  }).catch(e => console.warn('[cloudProgress] 上报异常:', e))
}

// 防抖触发：答题页写入本地进度后调用一次即可
export function touchSync() {
  if (!loggedInUser()) return // 未登录纯本地
  pendingItems = collectItems()
  if (dirtyTimer) clearTimeout(dirtyTimer)
  dirtyTimer = setTimeout(() => { flushProgress() }, 2500)
}

// 进页面时拉取云端进度 → 按 ts 合并回本地（新者优先），返回条目列表
export async function pullCloudProgress(courseId) {
  const u = loggedInUser()
  if (!u) return []
  try {
    const r = await apiFetch('/api/learning/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: useAdminStore.getState().token, course_id: courseId || '' }),
      timeout: 60000,
    })
    const j = await r.json()
    if (!j.ok || !Array.isArray(j.items)) return []
    mergeCloudIntoLocal(j.items)
    return j.items
  } catch (e) {
    console.warn('[cloudProgress] 拉取失败:', e)
    return []
  }
}

// 云端 → 本地合并（云端 ts 更新才覆盖；status=1 同时写完成标记）
function mergeCloudIntoLocal(items) {
  for (const it of items) {
    if (!it.unit_id || !it.mode) continue
    const key = `qs_progress_${it.mode}_${it.unit_id}`
    let local = null
    try { local = JSON.parse(localStorage.getItem(key) || 'null') } catch (e) { /* 忽略 */ }
    const cloudTs = Number(it.ts) || 0
    if (local && typeof local.ts === 'number' && local.ts >= cloudTs) continue // 本地更新，保留
    const merged = {
      seqIndex: it.seq_index || 0,
      unitIndex: it.unit_index || 0,
      difficulty: it.difficulty || (local && local.difficulty) || '',
      custom: (local && local.custom) || undefined,
      status: it.status === 1 ? 1 : (local && local.status) || 0,
      ts: cloudTs,
    }
    if (merged.custom === undefined) delete merged.custom
    try { localStorage.setItem(key, JSON.stringify(merged)) } catch (e) { /* 忽略 */ }
    if (it.status === 1) {
      try {
        const done = JSON.parse(localStorage.getItem(LS_DONE) || '{}') || {}
        const oldTs = Number(done[it.unit_id]) || 0
        if (cloudTs > oldTs) { done[it.unit_id] = cloudTs; localStorage.setItem(LS_DONE, JSON.stringify(done)) }
      } catch (e) { /* 忽略 */ }
    }
  }
}

// 页面卸载前兜底：立即发送未上报的条目
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => { flushProgress() })
}
