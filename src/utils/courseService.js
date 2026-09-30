// ========== 课程服务 · 前台读取课程完整数据（含大纲 lessonsList / 试学配置） ==========
// 数据源优先级：云端（全网共享，含大纲）→ 本地投稿课程（gameCourseStore）→ 后台发布课程（rb_admin_courses）
import { apiFetch } from '../lib/api'
import { resolvePlayUrl } from '../lib/playUrl'
import { getCourses } from './storage'
import { useGameCourseStore } from '../store/gameCourseStore'

// b2:// 云端封面（后台发布/投稿课程）→ 预签名可显示链接；http/https/data 原样
async function resolveCourseCover(course) {
  if (!course) return null
  const src = course.posterUrl || course.thumbnail || course.cover
  if (!src || !String(src).startsWith('b2://')) return course
  const u = await resolvePlayUrl(src)
  if (!u || u === src) return course
  const pick = (v) => (v && String(v).startsWith('b2://')) ? u : v
  return { ...course, posterUrl: pick(course.posterUrl), thumbnail: pick(course.thumbnail), cover: pick(course.cover) }
}

// 会话内课程内存缓存（30 秒时效）：详情页/大纲页来回跳转秒回，避免每次重新拉云端全量列表
const _courseMemo = new Map()

/**
 * 根据课程 ID 读取完整课程数据（包括 lessonsList / freeTrialCount / isVipOnly）
 * @param {string} courseId 课程 ID
 * @returns {Promise<object|null>} 课程对象（找不到返回 null）
 */
export async function getCourseById(courseId) {
  if (!courseId) return null
  // 0.5) 会话内内存缓存（30 秒内重复进入秒回）
  const m = _courseMemo.get(courseId)
  if (m && Date.now() - m.t < 30e3) return m.v
  // 0) 本地缓存优先（商城页已把云端名单缓存到 localStorage，二次访问即时）
  try {
    const cached = localStorage.getItem('rlearn_cloud_list_cache')
    if (cached) {
      const j = JSON.parse(cached)
      if (j && Array.isArray(j.list)) {
        const hit = j.list.find(v => v.kind === 'course' && v.id === courseId)
        if (hit) {
          const resolved = await resolveCourseCover(hit)
          _courseMemo.set(courseId, { v: resolved, t: Date.now() })
          return resolved
        }
      }
    }
  } catch (e) { /* 缓存损坏忽略 */ }
  // 1) 云端共享名单（管理员投稿/后台发布的课程都在这里，含大纲结构）
  try {
    const r = await apiFetch('/api/videos/list')
    const j = await r.json()
    if (j.ok && Array.isArray(j.videos)) {
      const hit = j.videos.find(v => v.kind === 'course' && v.id === courseId)
      if (hit) {
        const resolved = await resolveCourseCover(hit)
        _courseMemo.set(courseId, { v: resolved, t: Date.now() })
        // 顺手合并写回本地缓存，下次进入（含刷新页面）直接命中
        try {
          const cj = JSON.parse(localStorage.getItem('rlearn_cloud_list_cache') || '{"list":[]}')
          if (!Array.isArray(cj.list)) cj.list = []
          const idx = cj.list.findIndex(v => v.id === hit.id)
          if (idx >= 0) cj.list[idx] = hit; else cj.list.push(hit)
          localStorage.setItem('rlearn_cloud_list_cache', JSON.stringify(cj))
        } catch (e2) { /* ignore */ }
        return resolved
      }
    }
  } catch (e) { /* 云端不可用时继续查本地 */ }

  // 2) 本地投稿课程（gameCourseStore）
  try {
    const local = useGameCourseStore.getState().find(courseId)
    if (local) {
      const resolved = await resolveCourseCover(local)
      _courseMemo.set(courseId, { v: resolved, t: Date.now() })
      return resolved
    }
  } catch (e) { /* 忽略 */ }

  // 3) 后台发布课程（rb_admin_courses）
  try {
    const adminCourses = getCourses()
    const hit = adminCourses.find(c => c.id === courseId)
    if (hit) {
      const resolved = await resolveCourseCover(hit)
      _courseMemo.set(courseId, { v: resolved, t: Date.now() })
      return resolved
    }
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
