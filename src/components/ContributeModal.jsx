import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from '../lib/toast'

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

  const handleChange = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }))
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
          <button className="btn primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? '提交中...' : '投稿'}
          </button>
        </div>
      </div>
    </div>
  )
}
