import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from '../lib/toast'
import { apiFetch } from '../lib/api'
import { parseAIJSON } from '../lib/ai'
import { useAdminStore } from '../store/adminStore'
import { useGameVideoStore } from '../store/gameVideoStore'

// ===== 投稿分类（对标句乐部：主分类 + 子分类两层，与课程投稿一致） =====
const MAIN_CATS = ['教材同步', '考试备考', '少儿俄语', '基础俄语', '场景俄语', '阅读听力', '影视俄语', '音乐俄语']
const SUBCATS = {
  '推荐': ['全部'],
  '教材同步': ['全部', '走遍俄罗斯', '新概念俄语', '大学俄语', '东方俄语', '黑大俄语', '北外俄语', '人教版初中', '人教版高中', '自编课'],
  '考试备考': ['全部', '中高考', '专四专八', '考研', 'ТРКИ等级', '留学预科', 'CATTI', '职业俄语'],
  '少儿俄语': ['全部', '少儿启蒙', '动画分级', '分级阅读', '动画绘本', '儿歌童谣', '字母拼读', '少儿词汇'],
  '基础俄语': ['全部', '零基础路线', '字母发音', '基础语法', '基础词汇', '核心句型', '经典教材', '综合提升'],
  '场景俄语': ['全部', '日常对话', '商务职场', '外贸商务', '旅游出行', '面试校园', '社交口语', '写作邮件'],
  '阅读听力': ['全部', '短文精读', '俄语故事', '名著简写', '新闻短文', '文化科普', '专业阅读'],
  '影视俄语': ['全部', '情景剧', '影视台词', '电影片段', '动画片段', '经典教材剧'],
  '音乐俄语': ['全部', '俄语歌曲'],
  '全部': ['全部'],
}
const LEVELS = ['A1', 'A2', 'B1', 'B2']
// 学历向学段（方案B）：投稿视频/课程都归入一个学段，前端按学段筛选
const STAGES = ['零基础', '初中', '高中', '大学', '成人', '留学']

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
    cat: '影视俄语',
    subcat: '全部',
    level: 'A1',
    stage: '零基础',
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
  const [subsOpen, setSubsOpen] = useState(false)  // 手动粘贴字幕：点击后才展开
  const [manualSubs, setManualSubs] = useState('')
  const fileInputRef = useRef(null)
  const adminKey = useAdminStore(s => s.adminKey)

  const handleChange = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }))
  }
  const setCat = (val) => setForm(prev => ({ ...prev, cat: val, subcat: (SUBCATS[val] || ['全部'])[0] || '全部' }))

  // 🤖 AI 自动打标二级筛选标签：根据主分类 + 标题/内容，后端 /api/course-tag 精准判断
  const [autoTagging, setAutoTagging] = useState(false)
  const autoTag = async () => {
    if (autoTagging) return
    setAutoTagging(true)
    try {
      const title = (form.title || '').trim()
      if (!title) { toast('请先填写视频标题，AI 才能判断二级标签'); return }
      const res = await apiFetch('/api/course-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: form.cat,
          text: '视频标题：' + title + '\n主分类：' + form.cat + '\n难度：' + form.level,
        }),
      })
      const j = await res.json()
      if (!j.ok) throw new Error(j.error || 'AI 打标失败')
      const r = parseAIJSON(j.content)
      if (!r || !r.subcat) { toast('AI 未能判断出二级标签，请重试或手动选择'); return }
      setForm(prev => ({ ...prev, subcat: r.subcat === '全部' ? '全部' : r.subcat }))
      const conf = typeof r.confidence === 'number' ? Math.round(r.confidence * 100) + '%' : ''
      toast('AI 打标完成：' + r.subcat + (conf ? ' · 置信度 ' + conf : '') + (r.reason ? '（' + r.reason + '）' : ''))
    } catch (e) {
      toast('AI 打标失败：' + (e.message || '请稍后重试'))
    } finally {
      setAutoTagging(false)
    }
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
      const res = await new Promise((resolve) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', pj.uploadUrl, true)
        xhr.setRequestHeader('Content-Type', pj.contentType)
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) setUploadPct(Math.round(e.loaded / e.total * 100)) }
        xhr.onload = () => resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, body: (xhr.responseText || '').slice(0, 200) })
        xhr.onerror = () => resolve({ ok: false, status: 0, body: '' })
        xhr.send(file)
      })
      if (!res.ok) {
        setUploadOk(false)
        const why = res.status === 0
          ? '浏览器拦截（多为 B2 桶未配置 CORS）或网络异常'
          : 'B2 返回 HTTP ' + res.status + (res.body ? '：' + res.body.replace(/\s+/g, ' ').slice(0, 120) : '')
        toast('视频上传失败（' + why + '）')
        return
      }
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

  // 封面 dataURL → 上传 B2（thumbs 目录）→ 返回 b2:// URL（避免把 base64 大图塞进云端名单）
  const uploadCoverToB2 = async (dataUrl, fallbackUrl) => {
    try {
      const pr = await apiFetch('/api/upload/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: 'cover.jpg', kind: 'image', contentType: 'image/jpeg', adminKey })
      })
      const pj = await pr.json()
      if (!pj.ok || !pj.uploadUrl) return fallbackUrl
      const blob = await (await fetch(dataUrl)).blob()
      const res = await new Promise((resolve) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', pj.uploadUrl, true)
        xhr.setRequestHeader('Content-Type', 'image/jpeg')
        xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300)
        xhr.onerror = () => resolve(false)
        xhr.send(blob)
      })
      return res ? pj.objectUrl : fallbackUrl
    } catch (e) { return fallbackUrl }
  }

  // 云端名单清洗：去掉 dataURL 大字段，保证 sync body 小且干净
  const sanitizeForCloud = (list) => list.map(v => {
    const c = { ...v }
    if (c.thumbnail && String(c.thumbnail).startsWith('data:')) c.thumbnail = ''
    if (c.posterUrl && String(c.posterUrl).startsWith('data:')) c.posterUrl = ''
    return c
  })

  const handleSubmit = async () => {
    if (!form.title || !form.videoUrl) {
      toast('请填写标题并上传视频')
      return
    }
    setSubmitting(true)
    try {
      const id = 'game_video_' + Date.now()

      // 手动粘贴字幕（兜底）：点击展开后粘贴 SRT/VTT/纯文本，逐行断句
      let sentences = []
      if (manualSubs.trim()) {
        const { parseTextToSentences } = await import('../lib/srt')
        const { sentences: parsed } = parseTextToSentences(manualSubs)
        sentences = parsed.map((s, i) => ({ id: i + 1, russian: s.text, chinese: '' }))
      }

      // 封面若是本地提取的 base64，先传到 B2 拿云端地址，避免名单体积过大
      let thumbUrl = cover || `https://picsum.photos/seed/${id}/400/280`
      let posterUrl = cover || `https://picsum.photos/seed/${id}/1280/720`
      if (cover && String(cover).startsWith('data:')) {
        const up = await uploadCoverToB2(cover, thumbUrl)
        if (up) { thumbUrl = up; posterUrl = up }
      }
      const payload = {
        id,
        section: 'video', // 通关视频区
        kind: 'video',
        cat: form.cat,
        subcat: form.subcat,
        category: form.cat, // 兼容旧字段
        title: form.title,
        level: form.level,
        stage: form.stage,
        textbook: form.cat === '教材同步' && form.subcat !== '全部' ? form.subcat : '',
        source: 'mp4',
        videoUrl: form.videoUrl,
        desc: '',
        eps: '1 集',
        total: 1,
        thumbnail: thumbUrl,
        posterUrl,
        sentences,
        author: '管理员',
        views: 0,
        createdAt: Date.now(),
        tags: ['mp4', form.cat, form.subcat, form.level, form.stage]
      }
      const saved = useGameVideoStore.getState().submit(payload)
      // 同步到云端：清洗后的完整名单写入 B2，所有访客都能看到；失败必须让用户知道
      let cloudOk = true
      try {
        const latest = useGameVideoStore.getState().videos
        const sr = await apiFetch('/api/videos/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videos: sanitizeForCloud(latest), adminKey })
        })
        const sj = await sr.json()
        if (!sj.ok) { cloudOk = false; console.warn('云端名单同步失败:', sj.error) }
      } catch (e) { cloudOk = false; console.warn('云端名单同步异常:', e.message) }
      if (!cloudOk) {
        toast('⚠️ 视频已保存到本机，但云端共享失败（可能是管理员密钥失效或后端异常）。请退出后重新登录管理员，再投稿一次即可让所有人看到。')
      }
      if (!saved) {
        toast('⚠️ 投稿已记录但本地保存失败（浏览器存储不可用），换设备后看不到。请检查浏览器是否隐私模式或禁用了存储')
        onClose()
        navigate('/unlocked-games')
        return
      }
      if (sentences.length) {
        toast('投稿成功！已发布到解锁游戏·通关视频，含 ' + sentences.length + ' 句字幕')
      } else {
        toast('投稿成功！已发布到解锁游戏·通关视频·' + form.cat + (form.subcat && form.subcat !== '全部' ? ' / ' + form.subcat : ''))
      }
      onClose()
      navigate('/unlocked-games')
    } catch (e) {
      toast('投稿失败：' + (e.message || '请重试'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520, maxHeight: '88vh', overflowY: 'auto' }}>
        <h2>投稿到通关视频</h2>
        <p className="hint">上传本地视频，直传云端永久保存；发布后出现在「解锁游戏 → 通关视频」分类中。</p>

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
          <label>主分类</label>
          <select value={form.cat} onChange={e => setCat(e.target.value)}>
            {MAIN_CATS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="field">
          <label>二级筛选标签（AI 自动判断，可手动修改）</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              list="rb-subcats"
              value={form.subcat}
              onChange={handleChange('subcat')}
              placeholder={form.cat === '教材同步' ? 'AI 识别教材名，如：走遍俄罗斯' : 'AI 判断二级标签，可手动修改'}
              style={{ flex: 1, minWidth: 0 }}
            />
            <button type="button" className="btn sm" onClick={autoTag} disabled={autoTagging} style={{ flexShrink: 0 }}>
              {autoTagging ? 'AI 分析中…' : '✨ AI 打标'}
            </button>
          </div>
          <datalist id="rb-subcats">
            {(SUBCATS[form.cat] || ['全部']).map(c => <option key={c} value={c} />)}
          </datalist>
          <div className="hint" style={{ marginTop: 4 }}>AI 根据标题与内容自动判断二级标签；教材同步会识别教材名并自动生成筛选标签。</div>
        </div>

        <div className="field">
          <label>难度</label>
          <select value={form.level} onChange={handleChange('level')}>
            {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>

          <label>学段（学历方向）</label>
          <select value={form.stage} onChange={handleChange('stage')}>
            {STAGES.map(st => <option key={st} value={st}>{st}</option>)}
          </select>
        </div>

        <div className="field">
          {!subsOpen ? (
            <button type="button" className="btn sm" onClick={() => setSubsOpen(true)}>＋ 手动粘贴字幕（可选）</button>
          ) : (
            <>
              <label>手动粘贴字幕（兜底，SRT / VTT / 纯文本）</label>
              <textarea
                rows={4}
                value={manualSubs}
                onChange={e => setManualSubs(e.target.value)}
                placeholder={'没有字幕时兜底用：\n\nSRT 例子：\n1\n00:00:01,000 --> 00:00:04,000\nПривет, как дела?'}
              />
              <div className="hint" style={{ marginTop: 4 }}>
                不贴也可以：投稿后到解锁游戏视频卡点「生成字幕」，自动转写 B2 视频。
              </div>
            </>
          )}
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
