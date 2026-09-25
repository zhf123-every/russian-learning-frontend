// 课时完成进度：本地记录 unitId → 完成时间戳，两个课程详情页（CourseDetail / GameDetail）共享同一份数据
const LS_DONE = 'rlearn_unit_done'

export function markUnitDone(unitId) {
  if (!unitId) return
  try {
    const all = JSON.parse(localStorage.getItem(LS_DONE) || '{}')
    all[unitId] = Date.now()
    localStorage.setItem(LS_DONE, JSON.stringify(all))
  } catch (e) { /* 忽略 */ }
}

export function getUnitDoneMap() {
  try { return JSON.parse(localStorage.getItem(LS_DONE) || '{}') } catch (e) { return {} }
}

export function isUnitDone(unitId) {
  return Boolean(getUnitDoneMap()[unitId])
}
