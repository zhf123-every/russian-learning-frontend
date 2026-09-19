import { useEffect, useState, useCallback } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://russian-learning-jetq.onrender.com'

// 带超时与重试的 JSON 请求。
// Render 免费版冷启动可能 20s+，单次给 20s 超时；失败重试 3 次（冷启动唤醒后第二次通常很快）。
async function fetchJsonRetry(url, tries = 3) {
  let lastErr
  for (let i = 0; i < tries; i++) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 20000)
    try {
      const res = await fetch(url, { signal: ctrl.signal })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const j = await res.json()
      if (j && j.ok) return j.data
      throw new Error(j && j.error ? j.error : 'bad payload')
    } catch (e) {
      lastErr = e
      await new Promise((r) => setTimeout(r, 600 * (i + 1)))
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastErr
}

// 继续学习卡：拉真实课程包 + 单元状态。
// 其余仪表盘模块（六格/连胜/热力/最近）后端暂无统计 API，仍用静态占位。
export function useDashboardData() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [data, setData] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(false)
    try {
      const packs = await fetchJsonRetry(`${API_BASE}/api/course-packs`)
      const pack = (packs || []).find((p) => p.id === 'privet_rossiya_a1') || (packs || [])[0] || null
      let units = []
      if (pack) {
        const ud = await fetchJsonRetry(`${API_BASE}/api/course-packs/${encodeURIComponent(pack.id)}/units`)
        units = (ud && ud.units) || []
      }
      units.sort((a, b) => (a.order || 0) - (b.order || 0))
      const done = units.filter((u) => u.status === '已完成')
      const inProgress = units.find((u) => u.status === '进行中')
      const next = units.find((u) => u.status !== '已完成')
      const target = inProgress || next || units[units.length - 1] || null
      setData({
        pack,
        units,
        target,
        completed: done.length,
        total: units.length,
      })
    } catch (e) {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { loading, error, retry: load, ...(data || {}) }
}
