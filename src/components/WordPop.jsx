import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '../lib/api'

// 点词看释义弹窗（手动生词本已移除，仅保留即时翻译展示）
export default function WordPop({ word, x, y, onClose }) {
  const ref = useRef(null)
  const [chinese, setChinese] = useState('')
  const [loading, setLoading] = useState(false)

  // 自动翻译：调后端 /api/dict（MyMemory 俄→中，无需 key）
  useEffect(() => {
    if (!word) return
    let cancelled = false
    setLoading(true)
    apiFetch('/api/dict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word }),
    })
      .then(r => r.json())
      .then(j => {
        if (cancelled) return
        if (j && j.ok && j.translation) setChinese(j.translation)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [word])

  useEffect(() => {
    const onDoc = e => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [onClose])

  return (
    <div className="word-pop" ref={ref} style={{ left: x, top: y }}>
      <div className="w-head ru">{word}</div>
      <div className="w-body">
        {loading ? <span style={{ color: '#999' }}>翻译中…</span> : (chinese || '暂无释义')}
      </div>
    </div>
  )
}
