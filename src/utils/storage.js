// ========== 站长后台 · 本地课程库（localStorage 临时数据库） ==========
// getCourses() / saveCourses()：后台发布的新课程存这里；商城页读取时优先用本地的，没有才用硬编码 COURSES。

const STORAGE_KEY = 'rb_admin_courses'

// 读取本地课程列表（异常返回空数组）
export function getCourses() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) return arr
    }
  } catch (e) { /* 忽略解析错误 */ }
  return []
}

// 保存课程列表（覆盖写入）
export function saveCourses(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
    return true
  } catch (e) {
    return false
  }
}

// 删除单条课程
export function deleteCourse(id) {
  const list = getCourses().filter(c => c.id !== id)
  return saveCourses(list)
}

export { STORAGE_KEY }
