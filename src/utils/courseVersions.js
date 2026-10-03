// ========== 课程版本管理（本地历史快照 + 一键回滚） ==========
// 每次课时内容保存自动留一个版本快照（含完整 units + 档案关键字段）；
// 集中存在 localStorage（独立 key，不污染云端名单 —— 云端只放当前版）。
// 回滚 = 取历史版本 → 写回当前课程 → 重新同步云端。
import { getCourses, saveCourses } from './storage.js'

const VERSION_KEY = 'rlearn_v1_course_versions'
const MAX_VERSIONS = 20 // 每门课最多保留 20 个历史版本，超出丢最旧

function readAll() {
  try {
    const raw = localStorage.getItem(VERSION_KEY)
    if (raw) {
      const o = JSON.parse(raw)
      if (o && typeof o === 'object') return o
    }
  } catch (e) { /* 损坏忽略 */ }
  return {}
}

function writeAll(all) {
  try {
    localStorage.setItem(VERSION_KEY, JSON.stringify(all))
    return true
  } catch (e) {
    return false
  }
}

/** 课时内容指纹：units 的稳定序列化（忽略字段顺序差异） */
function unitsFingerprint(units) {
  try {
    return JSON.stringify(units || [])
  } catch (e) {
    return String(Math.random())
  }
}

/**
 * 保存一个版本快照。与最近一版内容完全相同则跳过（避免移动/空保存刷版本）。
 * @param {object} course 课程对象（含 units）
 * @param {string} reason 来源说明，如 '课时内容保存' / '回滚'
 * @returns {boolean} 是否真的存了新版本
 */
export function saveCourseVersion(course, reason = '课时内容保存') {
  if (!course || !course.id) return false
  const all = readAll()
  const list = Array.isArray(all[course.id]) ? all[course.id] : []
  const units = Array.isArray(course.units) ? course.units : []
  const fp = unitsFingerprint(units)
  const last = list[list.length - 1]
  if (last && last.fp === fp) return false // 与最新版相同 → 不存

  list.push({
    ts: Date.now(),
    reason: reason || '保存',
    title: course.title || '',
    unitCount: units.length,
    fp,
    units, // 完整快照（回滚时直接用）
  })
  // 截断：保留最近 MAX_VERSIONS 条
  const trimmed = list.length > MAX_VERSIONS ? list.slice(list.length - MAX_VERSIONS) : list
  all[course.id] = trimmed
  writeAll(all)
  return true
}

/**
 * 版本列表（弹窗展示用；不含完整 units，只含摘要）
 * @returns {Array<{ts, reason, title, unitCount}>} 新 → 旧
 */
export function listCourseVersions(courseId) {
  if (!courseId) return []
  const all = readAll()
  const list = Array.isArray(all[courseId]) ? all[courseId] : []
  return list
    .map(({ ts, reason, title, unitCount }) => ({ ts, reason, title, unitCount }))
    .reverse() // 最新在前
}

/** 取某个版本的完整数据（回滚用）；不存在返回 null */
export function getCourseVersion(courseId, ts) {
  if (!courseId || !ts) return null
  const all = readAll()
  const list = Array.isArray(all[courseId]) ? all[courseId] : []
  return list.find((v) => v.ts === ts) || null
}

/** 删除课程时清空其全部版本 */
export function clearCourseVersions(courseId) {
  if (!courseId) return
  const all = readAll()
  if (all[courseId]) {
    delete all[courseId]
    writeAll(all)
  }
}

/**
 * 回滚：把指定版本的 units 写回当前课程并保存。
 * @returns {object|null} 回滚后的课程对象（含 units）；失败返回 null
 */
export function rollbackCourse(courseId, ts) {
  const ver = getCourseVersion(courseId, ts)
  if (!ver || !Array.isArray(ver.units)) return null
  const list = getCourses()
  const i = list.findIndex((c) => c.id === courseId)
  if (i < 0) return null
  const updated = {
    ...list[i],
    units: ver.units,
    lessons: ver.units.length || list[i].lessons,
    updatedAt: Date.now(),
  }
  list[i] = updated
  saveCourses(list)
  // 回滚本身也留一个版本（reason 标记），可继续回滚
  saveCourseVersion(updated, '回滚到 ' + new Date(ts).toLocaleString())
  return updated
}
