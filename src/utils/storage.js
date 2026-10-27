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
// 修复：封面 dataURL（base64 大图）曾因上传失败「兜底」写入本地，一门课可吃掉数 MB，
// 超 Chrome 约 5MB 配额后所有保存都报「浏览器储存不可用」。
// 1) 保存前先把 dataURL 封面降级为占位图（封面已上传成功的 b2:// 或 http 不受影响）；
// 2) 写入失败自动重试一次，仍失败返回 false（调用方提示导出备份）。
export function saveCourses(list) {
  // 防御性深拷贝一份，避免直接改调用方引用
  const safe = Array.isArray(list) ? list.map(c => ({ ...c })) : []
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safe))
    return true
  } catch (e) {
    // 常见原因：QuotaExceededError（本地存储已满）。降级所有 dataURL 封面 → 占位图，再试一次
    const cleaned = safe.map(c => {
      if (c && typeof c.cover === 'string' && c.cover.startsWith('data:')) {
        return { ...c, cover: 'https://picsum.photos/seed/' + (c.id || Math.random().toString(36).slice(2)) + '/400/280' }
      }
      return c
    })
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned))
      console.warn('[storage] 本地存储已满，已自动将 dataURL 封面降级为占位图后保存成功')
      return true
    } catch (e2) {
      // 自愈：课程历史版本快照（rlearn_v1_course_versions）每版≈该课全部课时，9 门课可积压数 MB 撑爆配额。
      // 原先「每门课保留 1 版」仍可能不够（9 门=9 份全量）；改为直接清空版本快照腾出最大空间，
      // 版本快照只是回滚冗余，课程本体保存在 rb_admin_courses，清空不影响课程数据。
      try {
        const VER_KEY = 'rlearn_v1_course_versions'
        localStorage.removeItem(VER_KEY)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned))
        console.warn('[storage] 本地存储已满，已自动清空课程历史版本后保存成功')
        return true
      } catch (e3) {
        const sizeKB = Math.round((JSON.stringify(cleaned).length || 0) / 1024)
        console.error('[storage] 保存失败（存储不可用）: ', e3 && e3.message, '约', sizeKB, 'KB')
        return false
      }
    }
  }
}

// 删除单条课程
export function deleteCourse(id) {
  const list = getCourses().filter(c => c.id !== id)
  return saveCourses(list)
}

// 按课时 id 在本地课程库中查找课时（学习页本地模式兜底，不依赖 sessionStorage）
export function findLocalUnitById(unitId) {
  if (!unitId) return null
  const list = getCourses()
  for (const c of list) {
    if (Array.isArray(c.units)) {
      const u = c.units.find(x => x.id === unitId)
      if (u) return u
    }
  }
  return null
}

export { STORAGE_KEY }
