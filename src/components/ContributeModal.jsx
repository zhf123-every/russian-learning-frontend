import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from '../lib/toast'
import { apiFetch } from '../lib/api'
import { useAdminStore } from '../store/adminStore'

const CATEGORIES = ['shopping', 'daily', 'vlog', 'speech', 'intro', 'campus', 'work', 'transport']
const LEVELS = ['A1', 'A2', 'B1', 'B2']

export default function ContributeModal({ onClose, onSubmit }) {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    title: '',
    category: 'shopping',
    level: 'A1',
    videoUrl: '',
    description: ''
  })
  const [manualSubs, setManualSubs] = useState('')   // 手动粘贴字幕（可选）
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadPct, setUploadPct] = useState(0)
  const [uploadName, setUploadName] = useState('')
  const fileInputRef = useRef(null)
  const adminKey = useAdminStore(s => s.adminKey)

  const handleChange = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }))
  }

  const pickFile = () => fileInputRef.current && fileInputRef.current.click()

  const uploadToB2 = async (file) => {
    if (!adminKey) { toast('请先登录管理员后再上传本地视频'); return }
    setUploading(true); setUploadPct(0); setUploadName(file.name)
    try {
      const pr = await apiFetch('/api/upload/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, kind: 'video', contentType: file.type || 'video/mp4', adminKey })
      })
      const pj = await pr.json()
      if (!pj.ok) { toast('获取上传授权失败：' + (pj.error || '未知错误')); return }
      const ok = await new Promise((resolve) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', pj.uploadUrl, true)
        xhr.setRequestHeader('Content-Type', pj.contentType)
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) setUploadPct(Math.round(e.loaded / e.total * 100)) }
        xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300)
        xhr.onerror = () => resolve(false)
        xhr.send(file)
      })
      if (!ok) { toast('视频上传失败，请检查网络或桶 CORS 设置'); return }
      setForm(prev => ({ ...prev, videoUrl: pj.objectUrl }))
      setUploadPct(100)
      toast('视频已上传云端，地址已自动填好')
    } catch (e) {
      toast('上传异常：' + (e.message || '请重试'))
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async () => {
    if (!form.title || !form.videoUrl) {
      toast('请填写标题和视频链接/地址')
      return
    }
    setSubmitting(true)
    try {
      let sentences = []

      // 字幕：手动粘贴（可选）
      if (manualSubs.trim()) {
        const { parseTextToSentences } = await import('../lib/srt')
        const { sentences: parsed } = parseTextToSentences(manualSubs)
        sentences = parsed.map((s, i) => ({ id: i + 1, russian: s.text, chinese: '' }))
      }

      const id = 'square_' + Date.now()
      const payload = {
        id,
        title: form.title,
        category: form.category,
        level: form.level,
        source: 'mp4',
        videoUrl: form.videoUrl,
        description: form.description,
        thumbnail: `https://picsum.photos/seed/${id}/400/280`,
        posterUrl: `https://picsum.photos/seed/${id}/1280/720`,
        sentences,
        author: '管理员',
        views: 0,
        createdAt: Date.now(),
        tags: ['mp4', form.category, form.level]
      }

      await onSubmit(payload)
      if (sentences.length) {
        toast('投稿成功！已含 ' + sentences.length + ' 句字幕')
      } else {
        toast('投稿成功（纯视频，暂无字幕）')
      }
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
        <p className="hint">填 YouTube/B站 链接或 mp4 地址即可播放（不经过后端）；字幕手动粘贴（可选），没有也可以先发纯视频。</p>

        <div className="field">
          <label>标题</label>
          <input value={form.title} onChange={handleChange('title')} placeholder="例如：莫斯科地铁站的美丽" />
        </div>

        <div className="field">
          <label>本地视频文件（可选，直传云端永久保存）</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) uploadToB2(f) }}
          />
          <button type="button" className="btn sm" onClick={pickFile} disabled={uploading}>
            {uploading ? ('上传中 ' + uploadPct + '%') : '选择本地视频上传'}
          </button>
          {uploadName && (
            <div className="hint" style={{ marginTop: 4 }}>
              {uploading ? ('正在上传：' + uploadName + '（' + uploadPct + '%）') : ('已上传：' + uploadName + '，地址已填入下方')}
            </div>
          )}
          {uploading && (
            <div style={{ height: 6, background: '#eee', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
              <div style={{ width: uploadPct + '%', height: '100%', background: '#9B7B5E', transition: 'width .2s' }} />
            </div>
          )}
          <div className="hint" style={{ marginTop: 4 }}>视频直传 Backblaze B2 云端（免费 10GB），不经过网站服务器；也可以不上传、直接在下方贴链接。</div>
        </div>

        <div className="field">
          <label>视频链接 / mp4 地址</label>
          <input
            value={form.videoUrl}
            onChange={handleChange('videoUrl')}
            placeholder="YouTube/B站链接，或 /videos/xxx.mp4，或 mp4 直链"
          />
          <div className="hint" style={{ marginTop: 4 }}>
            YouTube/B站链接用原站播放器嵌入播放（走原站流量）；mp4 直链 / 仓库路径（public/videos/）直连播放。
          </div>
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

        <div className="field">
          <label>手动粘贴字幕（可选，SRT / VTT / 纯文本）</label>
          <textarea
            rows={4}
            value={manualSubs}
            onChange={e => setManualSubs(e.target.value)}
            placeholder={'视频没有俄语字幕时，可在这里粘贴字幕。\n\nSRT 例子：\n1\n00:00:01,000 --> 00:00:04,000\nПривет, как дела?'}
          />
        </div>

        <div className="field">
          <label>描述（可选）</label>
          <textarea
            value={form.description}
            onChange={handleChange('description')}
            placeholder="补充说明，比如场景、学习目标等"
            rows={2}
          />
        </div>

        <div className="mfoot">
          <button className="btn" onClick={onClose} disabled={submitting}>取消</button>
          <button className="btn primary" onClick={handleSubmit} disabled={submitting || uploading}>
            {uploading ? '上传中…' : (submitting ? '提交中...' : '投稿')}
          </button>
        </div>
      </div>
    </div>
  )
}
