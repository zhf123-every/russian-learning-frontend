import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCourseStore } from '../store/courseStore'
import { useSettingsStore } from '../store/settingsStore'
import { toast } from '../lib/toast'
import { apiFetch } from '../lib/api'
import { generateVideoThumbnail } from '../lib/thumbnail'
import SegPreviewModal from './SegPreviewModal'

const DEMO_TEXT = `Привет, меня зовут Иван. Я живу в Москве.
Каждый день я встаю в шесть утра и иду на работу.
Моя работа очень интересная, я работаю программистом.
В свободное время я люблю читать книги и слушать музыку.
По вечерам я обычно готовлю ужин и смотрю фильмы.
Мой любимый фильм — это «Сталкер» Андрея Тарковского.
Я думаю, что жизнь прекрасна, и я хочу путешествовать по миру.`

function formatSrtTime(t) {
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = Math.floor(t % 60)
  const ms = Math.floor((t % 1) * 1000)
  const pad = (n, w = 2) => String(n).padStart(w, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`
}

function segmentsToSrt(segments) {
  return segments.map((s, i) =>
    `${i + 1}\n${formatSrtTime(s.start)} --> ${formatSrtTime(s.end)}\n${s.text}`
  ).join('\n\n')
}

export default function AddMaterialModal({ onClose }) {
  const navigate = useNavigate()
  const addMaterial = useCourseStore(s => s.addMaterial)
  const settings = useSettingsStore(s => s.settings)
  const [videoUrl, setVideoUrl] = useState('')
  const [subs, setSubs] = useState('')
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [recognizing, setRecognizing] = useState(false)
  const [preview, setPreview] = useState(null) // { sentences, cues, hasTimestamps }

  const loadDemo = () => {
    setSubs(DEMO_TEXT)
    if (!title) setTitle('示例数据：俄语自我介绍')
    toast('已加载示例文本')
  }

  const autoTranscribe = async () => {
    if (!videoUrl.trim()) { toast('请先填写视频链接'); return }
    setRecognizing(true)
    try {
      const model = settings.whisperModel || 'tiny'
      const r = await apiFetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: videoUrl.trim(), model })
      })
      const j = await r.json()
      if (!j.ok) { toast('识别失败：' + (j.error || '未知错误')); return }
      if (!j.segments || !j.segments.length) { toast('没有识别出任何句子'); return }
      setSubs(segmentsToSrt(j.segments))
      toast('已识别 ' + j.segments.length + ' 句字幕')
    } catch (e) {
      toast('识别失败：' + e.message)
    } finally {
      setRecognizing(false)
    }
  }

  const save = async () => {
    setBusy(true)

    // 本地解析（无需网络）
    const { parseTextToSentences } = await import('../lib/srt')
    const { sentences, hasTimestamps } = parseTextToSentences(subs.trim())

    // 有 API Key 且无时间戳且确实有句子 走 AI 断句预览
    if (settings.apiKey && !hasTimestamps && sentences.length > 0) {
      setBusy(false)
      setPreview({ sentences, cues: null, hasTimestamps })
      return
    }

    finishImport(sentences, [])
  }

  const finishImport = async (sentences, translations) => {
    const hasVideo = videoUrl.trim()
    if (!sentences.length && !hasVideo) {
      setBusy(false)
      toast('请粘贴字幕，或填写 mp4 视频地址')
      return
    }
    const id = 'custom_' + Date.now().toString(36)
    const wordCount = sentences.reduce((n, s) => n + s.text.trim().split(/\s+/).length, 0)
    const enriched = sentences.map((s, i) => ({
      ...s,
      id: i + 1,
      tr: translations[i] || ''
    }))
    // 生成真实视频缩略图（YouTube 官方图 / mp4 截帧），失败则退回占位图
    let thumb = 'https://picsum.photos/seed/' + id + '/480/270'
    if (hasVideo) {
      const t = await generateVideoThumbnail(videoUrl.trim())
      if (t) thumb = t
    }
    addMaterial({
      id,
      title: title.trim() || (hasVideo ? '视频素材' : '自定义文本'),
      sentences: enriched,
      createdAt: Date.now(),
      thumbnail: thumb,
      posterUrl: thumb,
      tags: ['mp4'],
      duration: '—',
      words: wordCount,
      level: '自定义',
      ...(hasVideo ? { videoUrl: videoUrl.trim() } : {}),
    })
    toast(sentences.length ? '已保存，开始学习' : '已保存视频（暂无字幕，仅可观看）')
    navigate('/study/' + id)
  }

  return (
    <>
      <div className="modal-mask" onClick={onClose}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <h2>导入材料</h2>
          <p className="hint">
            一个「材料」= 视频 + 字幕。填 YouTube/B站 链接或 mp4 地址即可播放（不经过后端）；字幕手动粘贴（可选），没有也能先看纯视频。<br />
            📌 有 API Key 且字幕无时间戳时，会用 AI 智能断句并弹出预览；否则用规则断句后直接保存。
          </p>

          <div className="field">
            <label>① 视频链接 / mp4 地址（可选）</label>
            <input
              value={videoUrl}
              onChange={e => setVideoUrl(e.target.value)}
              placeholder="YouTube/B站链接，或 /videos/xxx.mp4，或 mp4 直链"
            />
            <div className="hint" style={{ marginTop: 4 }}>
              YouTube/B站链接用原站播放器嵌入播放（走原站流量）；mp4 直链 / 仓库路径（public/videos/）直连播放。均不经过后端。
            </div>
          </div>

          <div className="field">
            <label>② 字幕（SRT / VTT / 纯文本，可选）</label>
            <textarea
              rows={8}
              value={subs}
              onChange={e => setSubs(e.target.value)}
              placeholder={'粘贴 SRT/VTT 字幕，或纯俄语文本。没有字幕可留空（仅观看视频）。\n\nSRT 例子：\n1\n00:00:01,000 --> 00:00:04,000\nПривет, как дела?'}
            />
            <div className="row" style={{ marginTop: 6 }}>
              <button className="btn sm" disabled={recognizing} onClick={autoTranscribe}>
                {recognizing ? '识别中…' : '自动识别字幕'}
              </button>
              <button className="btn sm" onClick={loadDemo}>用示例数据试试</button>
            </div>
          </div>

          <div className="field">
            <label>标题（可选）</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="例如：俄语日常对话第 1 集" />
          </div>

          <div className="mfoot">
            <button className="btn" onClick={onClose}>取消</button>
            <button className="btn primary" disabled={busy} onClick={save}>
              {busy ? '处理中…' : '保存并开始学习'}
            </button>
          </div>
        </div>
      </div>

      {preview && (
        <SegPreviewModal
          sentences={preview.sentences}
          cues={preview.cues}
          settings={settings}
          onAccept={(sents, translations) => {
            setPreview(null)
            finishImport(sents, translations)
          }}
          onClose={() => {
            // 取消预览时直接用规则断句结果继续
            setPreview(null)
            const { sentences } = preview
            finishImport(sentences, [])
          }}
        />
      )}
    </>
  )
}
