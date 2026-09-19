import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from '../lib/toast'
import { apiFetch } from '../lib/api'
import { useAdminStore } from '../store/adminStore'

const CATEGORIES = ['shopping', 'daily', 'vlog', 'speech', 'intro', 'campus', 'work', 'transport']
const LEVELS = ['A1', 'A2', 'B1', 'B2']

// 本地视频文件 → 截帧生成封面（video + canvas，复用 thumbnail 思路）
function extractVideoCover(file) {
  return new Promise(resolve => {
    if (!file) { resolve(''); return }
    const objectUrl = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    video.src = objectUrl
    let settled = false
    const finish = (data) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try { video.removeAttribute('src'); video.load() } catch (e) { /* 忽略 */ }
      URL.revokeObjectURL(objectUrl)
      resolve(data)
    }
    const timer = setTimeout(() => finish(''), 8000)
    video.onloadeddata = () => { try { video.currentTime = 1 } catch (e) { finish('') } }
    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 480
        canvas.height = 270
        const ctx = canvas.getContext('2d')
        ctx.drawImage(video, 0, 0, 480, 270)
        finish(canvas.toDataURL('image/jpeg', 0.8))
      } catch (e) { finish('') }
    }
    video.onerror = () => finish('')
    video.load()
  })
}

export default function ContributeModal({ onClose, onSubmit }) {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    title: '',
    category: 'shopping',
    level: 'A1',
    videoUrl: '',
    thumbnail: '',
    posterUrl: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadPct, setUploadPct] = useState(0)
  const [uploadName, setUploadName] = useState('')
  const [uploadOk, setUploadOk] = useState(null)   // true=上传成功 false=上传失败 null=未开始
  const [cover, setCover] = useState('')           // 自动提取的封面 dataURL
  const [coverBusy, setCoverBusy] = useState(false)
  const fileInputRef = useRef(null)
  const adminKey = useAdminStore(s => s.adminKey)

  const handleChange = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }))
  }

  const pickFile = () => fileInputRef.current && fileInputRef.current.click()

  const uploadToB2 = async (file) => {
    if (!adminKey) { toast('请先登录管理员后再上传本地视频'); return }
    setUploading(true); setUploadPct(0); setUploadName(file.name); setUploadOk(null)
    // 并行：上传同时自动提取视频封面
    setCoverBusy(true)
    extractVideoCover(file)
      .then(data => {
        if (data) {
          setCover(data)
          setForm(prev => ({ ...prev, thumbnail: data, posterUrl: data }))
        }
      })
      .finally(() => setCoverBusy(false))
    try {
      const pr = await apiFetch('/api/upload/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, kind: 'video', contentType: file.type || 'video/mp4', adminKey })
      })
      const pj = await pr.json()
      if (!pj.ok) { setUploadOk(false); toast('获取上传授权失败：' + (pj.error || '未知错误')); return }
      const ok = await new Promise((resolve) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', pj.uploadUrl, true)
        xhr.setRequestHeader('Content-Type', pj.contentType)
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) setUploadPct(Math.round(e.loaded / e.total * 100)) }
        xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300)
        xhr.onerror = () => resolve(false)
        xhr.send(file)
      })
      if (!ok) { setUploadOk(false); toast('视频上传失败，请检查网络或桶 CORS 设置'); return }
      setForm(prev => ({ ...prev, videoUrl: pj.objectUrl }))
      setUploadPct(100)
      setUploadOk(true)
      toast('视频已上传云端，封面已自动提取')
    } catch (e) {
      setUploadOk(false)
      toast('上传异常：' + (e.message || '请重试'))
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async () => {
    if (!form.title || !form.videoUrl) {
      toast('请填写标题并上传视频')
      return
    }
    setSubmitting(true)
    try {
      const id = 'square_' + Date.now()
      const payload = {
        id,
        title: form.title,
        category: form.category,
        level: form.level,
        source: 'mp4',
        videoUrl: form.videoUrl,
        description: '',
        thumbnail: cover || `https://picsum.photos/seed/${id}/400/280`,
        posterUrl: cover || `https://picsum.photos/seed/${id}/1280/720`,
        sentences: [],   // 字幕后续通过「音频识别」生成（本弹窗不再手动粘贴）
        author: '管理员',
        views: 0,
        createdAt: Date.now(),
        tags: ['mp4', form.category, form.level]
      }
      await onSubmit(payload)
      toast('投稿成功！素材已发布到广场，可到卡片上「音频识别」生成字幕')
      onClose()
      navigate('/square')
    } catch (e) {
      toast('投稿失败：' + (e.message || '请重试'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <h2>投稿素材</h2>
        <p className="hint">上传本地视频，直传云端永久保存；封面自动从视频画面提取。</p>

        <div className="field">
          <label>标题</label>
          <input value={form.title} onChange={handleChange('title')} placeholder="例如：莫斯科地铁站的美丽" />
        </div>

        <div className="field">
          <label>本地视频文件</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) uploadToB2(f) }}
          />
          <button type="button" className="btn sm" onClick={pickFile} disabled={uploading}>
            {uploading ? ('上传中 ' + uploadPct + '%') : (uploadOk ? '重新选择视频' : '选择本地视频上传')}
          </button>
          {uploadName && (
            <div className="hint" style={{ marginTop: 4, color: uploadOk === false ? '#c0392b' : undefined }}>
              {uploading
                ? ('正在上传：' + uploadName + '（' + uploadPct + '%）')
                : uploadOk === false
                  ? ('上传失败：' + uploadName + '，请重新选择重试')
                  : uploadOk
                    ? ('已上传：' + uploadName)
                    : ''}
            </div>
          )}
          {uploading && (
            <div style={{ height: 6, background: '#eee', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
              <div style={{ width: uploadPct + '%', height: '100%', background: '#9B7B5E', transition: 'width .2s' }} />
            </div>
          )}
          <div className="hint" style={{ marginTop: 4 }}>视频直传 Backblaze B2 云端（免费 10GB），不经过网站服务器。</div>
        </div>

        <div className="field">
          <label>封面（自动从视频提取）</label>
          {cover ? (
            <img src={cover} alt="封面" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 8, marginTop: 4, border: '1px solid var(--border, #eee)' }} />
          ) : (
            <div className="hint" style={{ marginTop: 4 }}>
              {coverBusy ? '正在从视频提取封面…' : '选择视频并上传成功后自动生成'}
            </div>
          )}
        </div>

        <div className="field">
          <label>分类</label>
          <select value={form.category} onChange={handleChange('category')}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="field">
          <label>难度</label>
          <select value={form.level} onChange={handleChange('level')}>
            {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        <div className="mfoot">
          <button className="btn" onClick={onClose} disabled={submitting}>取消</button>
          <button className="btn primary" onClick={handleSubmit} disabled={submitting || uploading || !uploadOk}>
            {uploading ? '上传中…' : (submitting ? '提交中...' : '投稿')}
          </button>
        </div>
      </div>
    </div>
  )
}
