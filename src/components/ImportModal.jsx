import { useState } from 'react'
import { useSquareStore } from '../store/squareStore'
import { SQUARE_CATEGORIES } from '../data/squareLibrary'
import { parseTextToSentences } from '../lib/srt'
import { toast } from '../lib/toast'

const LS_WORKER = 'rlearn_worker_url'

export default function ImportModal({ onClose }) {
  const addItem = useSquareStore(s => s.addItem)
  const [workerUrl, setWorkerUrl] = useState(() => localStorage.getItem(LS_WORKER) || '')
  const [link, setLink] = useState('')
  const [title, setTitle] = useState('')
  const [level, setLevel] = useState('A1')
  const [category, setCategory] = useState('daily')
  const [subtitleText, setSubtitleText] = useState('')
  const [parsed, setParsed] = useState(null)   // { title, videoUrl(代理相对), sentences[], hint }
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)

  const saveWorker = (v) => {
    setWorkerUrl(v)
    if (v) localStorage.setItem(LS_WORKER, v)
    else localStorage.removeItem(LS_WORKER)
  }

  const parseLink = async () => {
    const w = (workerUrl || '').trim().replace(/\/+$/, '')
    const lk = (link || '').trim()
    if (!lk) return toast('请先粘贴视频链接')
    setLoading(true)
    try {
      const r = await fetch(`${w}/parse?url=${encodeURIComponent(lk)}`)
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || '解析失败')
      setParsed(j)
      if (j.title && !title) setTitle(j.title)
      if (j.sentences && j.sentences.length) {
        toast(`解析成功：已获取 ${j.sentences.length} 句字幕`)
      } else {
        toast('视频地址已获取，该视频无官方字幕，请在下方粘贴 SRT 字幕文本')
      }
    } catch (e) {
      toast('解析失败：' + (e.message || '请检查代理地址是否填写正确'))
    } finally {
      setLoading(false)
    }
  }

  const doImport = () => {
    const w = (workerUrl || '').trim().replace(/\/+$/, '')
    if (!parsed || !parsed.videoUrl) return toast('请先点击「解析链接」获取视频地址，或直接粘贴 MP4 直链')

    // 1. 字幕来源：解析字幕 或 用户粘贴 SRT
    let sentences = []
    const subTrim = (subtitleText || '').trim()
    if (subTrim) {
      const r = parseTextToSentences(subTrim)
      if (!r.sentences.length) return toast('字幕文本解析失败，请检查 SRT 格式')
      sentences = r.sentences.map((s, i) => ({
        id: i + 1, russian: s.text, chinese: '', start: s.start, end: s.end,
      }))
    } else if (parsed.sentences && parsed.sentences.length) {
      sentences = parsed.sentences.map((s, i) => ({
        id: i + 1, russian: s.text, chinese: '', start: s.start, end: s.end,
      }))
    } else {
      return toast('没有可用字幕：请粘贴 SRT 字幕文本后再导入')
    }

    // 2. 组装素材
    const id = 'ext_' + Date.now()
    const seed = 'ru_' + id
    const item = {
      id,
      title: (title || '').trim() || '未命名视频',
      category,
      level,
      author: '我',
      views: 0,
      description: '通过链接导入',
      thumbnail: `https://picsum.photos/seed/${seed}/400/280`,
      posterUrl: `https://picsum.photos/seed/${seed}/1280/720`,
      tags: [level, '导入'],
      source: 'external',
      videoUrl: (w ? w : '') + parsed.videoUrl,
      sentences,
    }
    addItem(item)
    toast(`已导入学习广场：${item.title}（${sentences.length} 句）`)
    onClose()
  }

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560, maxHeight: '86vh', overflowY: 'auto' }}>
        <h2>从链接导入视频素材</h2>
        <p className="hint">
          粘贴 B站 / YouTube 链接或 MP4 直链，自动获取视频地址与字幕；没有官方字幕时可自行粘贴 SRT 文本。
          代理已内置（functions/ 目录随网站自动部署），通常无需填写代理地址。
        </p>

        <div className="field">
          <label>代理地址（可选）</label>
          <input
            placeholder="留空 = 使用本站自带代理（推荐，无需额外部署）"
            value={workerUrl}
            onChange={e => saveWorker(e.target.value)}
          />
          <span className="hint">本项目已内置 functions/proxy + functions/parse 代理，随网站一起部署</span>
        </div>

        <div className="field">
          <label>视频链接（B站 / YouTube / MP4 直链）</label>
          <input
            placeholder="https://www.bilibili.com/video/BVxxxx 或 https://.../xx.mp4"
            value={link}
            onChange={e => setLink(e.target.value)}
          />
        </div>

        <div className="field">
          <button className="btn primary" onClick={parseLink} disabled={loading}>
            {loading ? '解析中…' : '解析链接'}
          </button>
        </div>

        {parsed && parsed.title && (
          <div className="field">
            <label>标题（解析自动填充，可修改）</label>
            <input value={title} onChange={e => setTitle(e.target.value)} />
          </div>
        )}

        <div className="field" style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label>难度</label>
            <select value={level} onChange={e => setLevel(e.target.value)} style={{ width: '100%', padding: 8 }}>
              {['A1', 'A2', 'B1', 'B2'].map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label>分类</label>
            <select value={category} onChange={e => setCategory(e.target.value)} style={{ width: '100%', padding: 8 }}>
              {SQUARE_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
            </select>
          </div>
        </div>

        <div className="field">
          <label>
            字幕文本（SRT）
            {parsed && parsed.sentences && parsed.sentences.length > 0
              ? ` — 已从视频自动获取 ${parsed.sentences.length} 句，留空则使用它；填写则优先用你粘贴的`
              : ' — 视频无官方字幕，请粘贴 SRT 后导入'}
          </label>
          <textarea
            rows={6}
            style={{ width: '100%', fontFamily: 'monospace', fontSize: 12 }}
            placeholder={'1\n00:00:00,000 --> 00:00:02,000\nПривет!\n\n2\n00:00:02,000 --> 00:00:05,000\nКак дела?\n'}
            value={subtitleText}
            onChange={e => setSubtitleText(e.target.value)}
          />
        </div>

        {parsed && parsed.sentences && parsed.sentences.length > 0 && (
          <p className="hint" style={{ color: '#5C8A6B' }}>
            ✓ 已获取 {parsed.sentences.length} 句字幕（{parsed.hint === 'subs' ? '官方字幕' : '自动字幕'}）
          </p>
        )}

        <div className="cta">
          <button className="btn" onClick={onClose}>取消</button>
          <button className="btn primary" onClick={doImport} disabled={importing}>
            {importing ? '导入中…' : '导入学习广场'}
          </button>
        </div>
      </div>
    </div>
  )
}
