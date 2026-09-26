// bkrs.js —— БКРС 大俄汉词典（25 万词条）懒加载 + 查询
// 词条结构: { "词": { "translation": "中文释义" } }
// 1. 本地离线 bkrs.json（权威中文释义，覆盖全词库）
// 2. 后端 /api/dict 增强（Natasha 词形还原 + MyMemory + AI 兜底，用于本地未命中的变格/变位形式）

let cache = null
let loading = null

function norm(word) {
  return (word || '')
    .replace(/'/g, '')
    .replace(/^[«"'(]+|[»"').,;:!?…]+$/g, '')
    .toLowerCase()
    .trim()
}

/** 懒加载 bkrs.json（22MB，首次打开学习内容弹窗时加载一次，之后缓存） */
export function ensureBkrs() {
  if (cache) return Promise.resolve(true)
  if (loading) return loading
  if (typeof window === 'undefined') return Promise.resolve(false)
  loading = fetch('/dict/bkrs.json')
    .then((r) => {
      if (!r.ok) throw new Error('HTTP ' + r.status)
      return r.json()
    })
    .then((raw) => {
      const map = new Map()
      for (const k in raw) {
        map.set(norm(k), (raw[k] && raw[k].translation) || '')
      }
      cache = { map }
      return true
    })
    .catch(() => {
      loading = null
      return false
    })
  return loading
}

/** 本地 БКРС 查询（精确匹配归一化词形） */
export function bkrsLookup(word) {
  if (!cache) return ''
  return cache.map.get(norm(word)) || ''
}

/** 后端 /api/dict 增强查询（Natasha 词形还原 → БКРС → MyMemory → AI） */
export async function bkrsRemote(word) {
  try {
    const r = await fetch('/api/dict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word }),
    })
    if (!r.ok) return ''
    const j = await r.json()
    if (!j.ok) return ''
    const t = (j.translation || '').trim()
    if (!t || t.startsWith('【')) return ''
    return t
  } catch (e) {
    return ''
  }
}

/** 组合查询：先本地 БКРС → 未命中再远程（返回 {local, remote}） */
export async function bkrsResolve(word) {
  const local = bkrsLookup(word)
  if (local) return { local, remote: '' }
  const remote = await bkrsRemote(word)
  return { local, remote }
}
