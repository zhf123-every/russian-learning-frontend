import { useEffect, useRef, useState } from 'react'
import { useVocabStore } from '../store/vocabStore'
import { apiFetch } from '../lib/api'

export default function WordPop({ word, x, y, onClose }) {
  const ref = useRef(null)
  const addWord = useVocabStore(s => s.addWord)
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

  const add = () => {
    addWord({ word, lemma: word.replace(/[́̀]/g, ''), chinese: chinese || '（待释义）', source: 'sentence' })
    onClose()
  }

  return (
    <div className="word-pop" ref={ref} style={{ left: x, top: y }}>
      <div className="w-head ru">{word}</div>
      <div className="w-body">
        <input
          placeholder={loading ? '翻译中…' : (chinese || '翻译失败，可手动输入释义')}
          value={chinese}
          onChange={e => setChinese(e.target.value)}
          style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border2)', borderRadius: 6 }}
        />
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn sm primary" onClick={add}>加入生词</button>
      </div>
    </div>
  )
}
