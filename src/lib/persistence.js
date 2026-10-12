export const LS = {
  progress: 'rlearn_v1_progress',
  vocab: 'rlearn_v1_vocab',
  recent: 'rlearn_v1_recent',
  materials: 'rlearn_v1_materials',
  settings: 'rlearn_v1_settings',
}

export function loadLS(key, def) {
  try { const v = localStorage.getItem(key); return v == null ? def : JSON.parse(v) }
  catch (e) { return def }
}

export function saveLS(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val))
    return true
  } catch (e) {
    // localStorage 配额超限时，静默失败，不打印错误，设置仍然保存在内存里
    console.warn('[persistence] save failed (quota exceeded, still in memory):', key)
    return false
  }
}
