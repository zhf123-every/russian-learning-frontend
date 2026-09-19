import { useState } from 'react'
import { useCourseStore } from '../store/courseStore'
import { useSettingsStore } from '../store/settingsStore'
import { useSquareStore } from '../store/squareStore'
import { useAdminStore } from '../store/adminStore'
import { useNavigate } from 'react-router-dom'
import { toast } from '../lib/toast'
import { apiFetch } from '../lib/api'

export default function TranscribeModal({ onClose, item }) {
  const navigate = useNavigate()
  const addMaterial = useCourseStore(s => s.addMaterial)
  const settings = useSettingsStore(s => s.settings)
  const submitItem = useSquareStore(s => s.submitItem)
  const adminKey = useAdminStore(s => s.adminKey)
  const isSquareItem = !!(item && item.id)
  const [url, setUrl] = useState(isSquareItem ? (item.videoUrl || '') : '')
  const [title, setTitle] = useState(isSquareItem ? (item.title || '') : '')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [segs, setSegs] = useState([])
  const [showPreview, setShowPreview] = useState(false)

  const start = async () => {
    if (!url.trim()) { toast('请先粘贴视频链接'); return }
    setBusy(true)
    setStatus('正在下载音频并识别（可能要几分钟）…')
    try {
      const model = settings.whisperModel || 'tiny'
      const r = await apiFetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), model })
      })
      const j = await r.json()
      if (!j.ok) { alert('识别失败：\n\n' + (j.error || '')); return }
      if (!j.segments || !j.segments.length) { alert('没有识别出任何句子。'); return }
      setSegs(j.segments)
      setStatus('识别完成，共 ' + j.segments.length + ' 句')
      setShowPreview(true)
    } catch (e) {
      alert('请求失败：' + e.message)
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    if (!segs.length) { toast('请先完成识别'); return }
    const sentences = segs.map((s, i) => ({ ...s, id: i + 1 }))

    // 广场素材：字幕写回服务端（同 id 更新），无需新建素材
    if (isSquareItem) {
      if (!adminKey) { toast('请先进入管理模式（右上角「管理」）'); return }
      setBusy(true)
      try {
        await submitItem({
          ...item,
          title: title.trim() || item.title,
          sentences,
          tags: Array.from(new Set([...(item.tags || []), '转写'])),
        }, adminKey)
        toast('字幕已写回素材：' + sentences.length + ' 句')
        onClose()
        navigate('/square')
      } catch (e) {
        alert('保存失败：' + (e.message || '请重试'))
      } finally {
        setBusy(false)
      }
      return
    }

    // 我的素材：本地保存（原有逻辑）
    const id2 = 'custom_' + Date.now().toString(36)
    addMaterial({
      id: id2,
      title: title.trim() || '材料 ' + segs.length,
      videoUrl: url.trim(),
      sentences,
      createdAt: Date.now(),
      thumbnail: 'https://picsum.photos/seed/' + id2 + '/400/280',
      posterUrl: 'https://picsum.photos/seed/' + id2 + '/1280/720',
      tags: ['转写'],
      duration: '—',
      words: segs.reduce((n, s) => n + s.text.trim().split(/\s+/).length, 0),
      level: '自定义',
    })
    toast('已导入 ' + segs.length + ' 句，开始学习吧')
    navigate('/study/' + id2)
  }

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>{isSquareItem ? '生成字幕' : '音频识别'}</h2>
        <p className="hint">
          {isSquareItem
            ? '为广场素材自动生成字幕：后端转写 B2 云端视频为带时间戳的俄语句子，写回该素材，之后即可五步精听。'
            : '粘贴视频链接（YouTube/B站 或 mp4 直链），后端用 faster-whisper 将音频转写为带时间戳的俄语句子。'}
          {' '}模型：{settings.whisperModel || 'tiny'}
        </p>

        <div className="field">
          <label>视频链接</label>
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            readOnly={isSquareItem}
            placeholder="https://www.youtube.com/watch?v=... 或 b2:// 素材地址"
          />
          {isSquareItem && (
            <div className="hint" style={{ marginTop: 4 }}>已自动填入该素材的云端地址，直接点「开始识别」。</div>
          )}
        </div>

        <div className="field">
          <label>标题（可选）</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="例如：俄语日常对话第 1 集" />
        </div>

        {status && (
          <div className="hint" style={{ margin: 0 }}>{status}</div>
        )}

        {showPreview && (
          <div className="field">
            <label>识别结果（可直接保存）</label>
            <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
              {segs.map((s, i) => (
                <div key={i} className="sent" style={{ marginBottom: 6 }}>
                  <span className="idx">{i + 1}</span>
                  <span className="ru" style={{ flex: 1 }}>{s.text}</span>
                  <span className="idx">⏱ {s.start.toFixed(1)}s–{s.end.toFixed(1)}s</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mfoot">
          <button className="btn" onClick={onClose}>关闭</button>
          {!isSquareItem && (
            <button className="btn" disabled={busy} onClick={() => { setUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'); setTitle('示例：俄语自我介绍'); toast('已填入示例链接') }}>用示例试试</button>
          )}
          <button className="btn primary" disabled={busy} onClick={busy ? undefined : start}>
            {busy ? '转写中…' : '开始识别'}
          </button>
          {showPreview && (
            <button className="btn primary" onClick={save} disabled={busy}>
              {isSquareItem ? '保存字幕到素材' : '保存并开始学习'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
