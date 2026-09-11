import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCourseStore } from '../store/courseStore'
import AddMaterialModal from '../components/AddMaterialModal'
import TranscribeModal from '../components/TranscribeModal'
import { generateVideoThumbnail, formatDuration, formatDate } from '../lib/thumbnail'

export default function CustomMaterials() {
  const navigate = useNavigate()
  const materials = useCourseStore(s => s.materials)
  const updateMaterial = useCourseStore(s => s.updateMaterial)
  const [showAdd, setShowAdd] = useState(false)
  const [showTranscribe, setShowTranscribe] = useState(false)

  // 已有素材如果还是 picsum 占位图（或空），自动用真实视频画面重新生成缩略图
  useEffect(() => {
    let cancelled = false
    const refresh = async () => {
      for (const m of materials) {
        if (cancelled) return
        if (!m.videoUrl) continue
        const isPlaceholder = !m.thumbnail || m.thumbnail.includes('picsum.photos')
        if (!isPlaceholder) continue
        const t = await generateVideoThumbnail(m.videoUrl)
        if (cancelled) return
        if (t) updateMaterial(m.id, { thumbnail: t, posterUrl: t })
      }
    }
    refresh()
    return () => { cancelled = true }
  }, [materials, updateMaterial])

  return (
    <div className="course">
      <div className="row" style={{ marginBottom: 16, justifyContent: 'space-between' }}>
        <button className="btn sm" onClick={() => navigate('/')}>返回首页</button>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn sm" onClick={() => setShowTranscribe(true)}>音频识别</button>
          <button className="btn primary" onClick={() => setShowAdd(true)}>添加素材</button>
        </div>
      </div>
      <h2>自定义素材</h2>
      <p className="hint">填 mp4 视频地址 + 粘贴字幕，自动断句后逐句学习。</p>

      {materials.length === 0 ? (
        <div className="empty">
          <div className="big">📹</div>
          <h1>还没有素材</h1>
          <p>填 mp4 视频地址（直连播放，不经过后端），开始你的第一课。</p>
          <div className="cta">
            <button className="btn primary" onClick={() => setShowAdd(true)}>添加素材</button>
          </div>
        </div>
      ) : (
        <div className="videos-grid v2">
          {materials.map(m => (
            <div key={m.id} className="video-card" onClick={() => navigate('/study/' + m.id)}>
              <div className="thumb" style={{ backgroundImage: `url(${m.thumbnail})` }}>
                <span className="thumb-score">{m.level || '自定义'}</span>
              </div>
              <div className="vc-body">
                <div className="vc-title">{m.title}</div>
                <div className="vc-meta">{m.sentences?.length || 0} 句 · {m.words ?? 0} 词</div>
                <div className="vc-info">
                  <span className="vc-info-tag">{m.level || '自定义'}</span>
                  <span>{m.sentences?.length || 0}句</span>
                  <span>{m.words ?? 0}词</span>
                  <span>{(m.tags || []).join(' ')}</span>
                  <span>{formatDuration(m)}</span>
                  <span>{formatDate(m.createdAt)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && <AddMaterialModal onClose={() => setShowAdd(false)} />}
      {showTranscribe && <TranscribeModal onClose={() => setShowTranscribe(false)} />}
    </div>
  )
}
