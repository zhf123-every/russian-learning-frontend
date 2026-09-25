// ========== 课程服务 · 前台读取课程完整数据（含大纲 lessonsList / 试学配置） ==========
// 数据源优先级：云端（全网共享，含大纲）→ 本地投稿课程（gameCourseStore）→ 后台发布课程（rb_admin_courses）
import { apiFetch } from '../lib/api'
import { getCourses } from './storage'
import { useGameCourseStore } from '../store/gameCourseStore'

/**
 * 根据课程 ID 读取完整课程数据（包括 lessonsList / freeTrialCount / isVipOnly）
 * @param {string} courseId 课程 ID
 * @returns {Promise<object|null>} 课程对象（找不到返回 null）
 */
export async function getCourseById(courseId) {
  if (!courseId) return null
  // 1) 云端共享名单（管理员投稿/后台发布的课程都在这里，含大纲结构）
  try {
    const r = await apiFetch('/api/videos/list')
    const j = await r.json()
    if (j.ok && Array.isArray(j.videos)) {
      const hit = j.videos.find(v => v.kind === 'course' && v.id === courseId)
      if (hit) return hit
    }
  } catch (e) { /* 云端不可用时继续查本地 */ }

  // 2) 本地投稿课程（gameCourseStore）
  try {
    const local = useGameCourseStore.getState().find(courseId)
    if (local) return local
  } catch (e) { /* 忽略 */ }

  // 3) 后台发布课程（rb_admin_courses）
  try {
    const adminCourses = getCourses()
    const hit = adminCourses.find(c => c.id === courseId)
    if (hit) return hit
  } catch (e) { /* 忽略 */ }

  return null
}

/**
 * 取课程的试学配置（无配置时的默认值）
 * @param {object} course 课程对象
 */
export function getTrialConfig(course) {
  if (!course) return { freeTrialCount: 0, isVipOnly: false }
  const freeTrialCount = Number(course.freeTrialCount) || 0
  const isVipOnly = Boolean(course.isVipOnly)
  return { freeTrialCount, isVipOnly }
}

/**
 * 取课程课时大纲（优先 lessonsList，没有则从 lessons/units 推导）
 * @param {object} course 课程对象
 */
export function getLessonsList(course) {
  if (!course) return []
  if (Array.isArray(course.lessonsList) && course.lessonsList.length) return course.lessonsList
  // 旧数据兼容：从 lessons/units 推导
  const src = Array.isArray(course.lessons) && course.lessons.length ? course.lessons
    : (Array.isArray(course.units) ? course.units : [])
  return src.map((u, i) => ({
    lessonId: u.lessonId || 'lesson_' + String(i + 1).padStart(2, '0'),
    title: u.title || ('第 ' + (i + 1) + ' 课'),
    subtitle: u.subtitle || u.title || u.description || '',
    type: (u.words && u.words.length) || (u.wordsCount) ? '单词 · 例句' : '例句',
    isFree: i < (Number(course.freeTrialCount) || 0),
  }))
}
