// ========== 课程定时上架/下架（读时过滤，零后端改动） ==========
// 课程条目可带两个可选字段（毫秒时间戳）：
//   scheduledPublishAt   —— 定时上架：此时间之前商城/详情不可见（管理端仍可见可编辑）
//   scheduledUnpublishAt —— 定时下架：此时间之后商城/详情不可见
// 无这两个字段 = 发布即永不过期（向后兼容旧数据）。
// 商城/详情页统一走本模块过滤 + 每分钟 tick，到点自动出现/消失，无需刷新。

/**
 * 课程当前是否对访客可见。
 * @param {object} course 课程条目
 * @param {number} now    当前时间戳（ms），默认 Date.now()
 */
export function isCourseVisible(course, now = Date.now()) {
  if (!course) return false
  // 草稿从未同步云端，天然不可见（防御：云端名单理论上没有 draft）
  if (course.status === 'draft') return false
  const t = Number(now) || Date.now()
  const pub = Number(course.scheduledPublishAt)
  const unpub = Number(course.scheduledUnpublishAt)
  if (pub > 0 && t < pub) return false      // 定时上架未到点
  if (unpub > 0 && t >= unpub) return false // 已到定时下架时间
  return true
}

/**
 * 课程状态（管理端徽章用）：draft 草稿 | scheduled 定时中 | published 已发布 | expired 已下架
 * @param {object} course
 * @param {number} now
 */
export function courseStatus(course, now = Date.now()) {
  if (!course) return 'draft'
  if (course.status === 'draft') return 'draft'
  const t = Number(now) || Date.now()
  const pub = Number(course.scheduledPublishAt)
  const unpub = Number(course.scheduledUnpublishAt)
  if (unpub > 0 && t >= unpub) return 'expired'
  if (pub > 0 && t < pub) return 'scheduled'
  return 'published'
}

/** 毫秒时间戳 → 'YYYY-MM-DD HH:mm'（本地时区）；无效返回 '' */
export function fmtSchedule(ts) {
  const t = Number(ts)
  if (!(t > 0)) return ''
  const d = new Date(t)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** 状态文案（管理端徽章/提示用） */
export function statusLabel(course, now = Date.now()) {
  const s = courseStatus(course, now)
  if (s === 'draft') return '草稿'
  if (s === 'scheduled') return '定时中 ' + fmtSchedule(course.scheduledPublishAt)
  if (s === 'expired') return '已下架 ' + fmtSchedule(course.scheduledUnpublishAt)
  return '已发布'
}

/** 管理端表单：ms ↔ datetime-local 字符串（本地时区） */
export function tsToLocalInput(ts) {
  const t = Number(ts)
  if (!(t > 0)) return ''
  const d = new Date(t)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export function localInputToTs(str) {
  if (!str) return undefined
  const t = new Date(str).getTime()
  return Number.isFinite(t) && t > 0 ? t : undefined
}
