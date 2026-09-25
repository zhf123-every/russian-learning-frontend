import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from '../lib/toast'
import { apiFetch } from '../lib/api'
import { useAdminStore } from '../store/adminStore'
import { useGameCourseStore } from '../store/gameCourseStore'
import { useGameVideoStore } from '../store/gameVideoStore'
import { parseAIJSON } from '../lib/ai'

// ===== 投稿分类（对标句乐部：主分类 + 子分类两层） =====
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
// 学历向学段（方案B）
const STAGES = ['零基础', '初中', '高中', '大学', '成人', '留学']
// AI 自动打标可选项（年级 + 教材版本）
const TAG_GRADES = ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '七年级', '八年级', '九年级', '高中', '通用']
const TAG_TEXTBOOKS = ['走遍俄罗斯', '大学俄语', '东方俄语', '新概念俄语', '黑大俄语', '北外俄语', '人教版初中', '人教版高中', '自编课']

// 把课程+视频合并名单里的大 base64 字段清掉，保证 sync body 小且干净
const sanitizeForCloud = (list) => list.map(v => {
  const c = { ...v }
  if (c.thumbnail && String(c.thumbnail).startsWith('data:')) c.thumbnail = ''
  if (c.posterUrl && String(c.posterUrl).startsWith('data:')) c.posterUrl = ''
  return c
})

export default function CourseContributeModal({ onClose }) {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    title: '',
    cat: '基础入门',
    subcat: '全部',
    level: 'A1',
    stage: '零基础',
    bulkText: '',
    wordsText: '',   // 生词表（每行：词 | 释义）→ AI 渐进生成一课内容
    cover: '',
    lessons: [],
    grade: '',     // AI 自动打标：年级（投稿时 AI 生成，可改）
    textbook: '',  // AI 自动打标：教材版本（投稿时 AI 生成，可改）
  })
  const [submitting, setSubmitting] = useState(false)
  const adminKey = useAdminStore(s => s.adminKey)

  const setField = (field, val) => setForm(prev => ({ ...prev, [field]: val }))
  const setCat = (val) => setForm(prev => ({ ...prev, cat: val, subcat: (SUBCATS[val] || ['全部'])[0] || '全部' }))
  const setLesson = (i, field, val) => setForm(prev => {
    const lessons = prev.lessons.map((l, idx) => (idx === i ? { ...l, [field]: val } : l))
    return { ...prev, lessons }
  })

  // 粘贴俄中对照文本 → 一键生成关卡：每行 "俄语 | 中文"，一行一关
  const genFromText = () => {
    const lines = (form.bulkText || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    if (!lines.length) { toast('请先粘贴俄中对照文本（每行一句，用 | 分隔）'); return }
    // ⚠️ 生词表格式检测：整段都是「单词 | 短中文释义」→ 引导用方式一（合成一课），避免每词拆成一关
    const vocabLike = lines.length > 2 && lines.every(l => /^[а-яёА-ЯЁa-zA-Z][а-яёА-ЯЁa-zA-Z\-']*\s*[|｜]\s*[\u4e00-\u9fa5]{1,8}$/.test(l))
    if (vocabLike) {
      toast('⚠️ 检测到这是「生词表」（词 | 释义）。生词表请用上方「方式一 ✨ AI 渐进生成」——会把全部单词合成 1 课；这里按行拆课会导致每词一关')
      return
    }
    const lessons = lines.map((line, i) => {
      const [ru = '', zh = ''] = line.split(/\s*[|｜]\s*/)
      return { name: (ru || line).slice(0, 24), desc: (zh || '').slice(0, 40) }
    })
    setForm(prev => ({
      ...prev,
      lessons,
      title: prev.title.trim() || ((lines[0].split(/\s*[|｜]\s*/)[0] || '新课程').slice(0, 18) + ' · 共 ' + lines.length + ' 关'),
    }))
    toast('已从文本生成 ' + lines.length + ' 个关卡，可继续手动调整')
  }

  // ✨ AI 渐进生成：粘贴生词表 → AI 生成一课（单词 + 按难度渐进排列的例句）
  // 教学法：先学单词 → 每个单词配例句 → 例句由短到长、由易到难渐进学习
  const [aiGen, setAiGen] = useState(false)

  // ===== 方式三 · AI 自动切课：整本书/多课连续文本 → 按课标题切分，每课一关 =====
  const [splitText, setSplitText] = useState('')
  const [splitting, setSplitting] = useState(false)
  const [appendMode, setAppendMode] = useState(false) // true=追加到已有关卡（分批切课合并成一个大课程包）
  const splitCourse = async () => {
    if (splitting) return
    const text = (splitText || '').trim()
    if (!text) { toast('请先粘贴整本书或连续多课的文本（每课以「Урок N」或课标题开头）'); return }
    if (form.lessons.length && !appendMode && !window.confirm('当前已有 ' + form.lessons.length + ' 个关卡，切课将覆盖它们，继续？')) return
    setSplitting(true)
    try {
      const res = await apiFetch('/api/course-split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: form.title.trim(), category: form.cat, level: form.level, text }),
      })
      const jj = await res.json()
      if (!jj.ok) throw new Error(jj.error || '切课失败')
      const r = parseAIJSON(jj.content)
      if (!r || !Array.isArray(r.lessons) || !r.lessons.length) { toast('切课失败：未能识别出课，请检查文本是否包含课标题（如 Урок 1）'); return }
      const fresh = r.lessons.map(l => ({
        name: (l.name || ('第 ' + (l.num || 0) + ' 课')).slice(0, 30),
        desc: (l.desc || '').slice(0, 60),
        vocab: (l.vocab || '').trim(),
        words: [],
        sentences: [],
      }))
      setForm(prev => {
        const lessons = appendMode ? [...prev.lessons, ...fresh] : fresh
        return { ...prev, lessons, title: prev.title.trim() || (r.bookTitle || '走遍俄罗斯') }
      })
      toast('✅ 自动切课完成：识别出 ' + fresh.length + ' 课' + (appendMode ? '，已追加到现有 ' + form.lessons.length + ' 关之后' : '') + '。可点每关「✨例句」或「⚡ 批量生成」补内容')
    } catch (e) {
      toast('自动切课失败：' + (e.message || '请稍后重试'))
    } finally {
      setSplitting(false)
    }
  }

  // 为指定关卡调用 AI 生成例句（用该关的生词表）
  const [genIdx, setGenIdx] = useState(-1) // -1=空闲；>=0 表示正在生成第几关
  const genLessonFor = async (i) => {
    const l = form.lessons[i]
    if (!l || !(l.vocab || '').trim()) { toast('该关没有生词表，无法生成例句（可手动填写）'); return }
    if (genIdx >= 0) return
    setGenIdx(i)
    try {
      const res = await apiFetch('/api/course-lesson-gen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: l.name || ('第 ' + (i + 1) + ' 课'), category: form.cat, level: form.level, words: l.vocab }),
      })
      const jj = await res.json()
      if (!jj.ok) throw new Error(jj.error || '生成失败')
      const r = parseAIJSON(jj.content)
      if (!r || !Array.isArray(r.words) || !Array.isArray(r.sentences) || !r.sentences.length) {
        toast('第 ' + (i + 1) + ' 关生成失败：未能解析出句子，请重试'); return
      }
      setForm(prev => {
        const lessons = prev.lessons.map((ll, idx) => idx === i ? {
          ...ll,
          name: ll.name || (r.title || '').slice(0, 30),
          desc: ll.desc || (r.description || '').slice(0, 60),
          words: r.words,
          sentences: r.sentences,
        } : ll)
        return { ...prev, lessons }
      })
      toast('✅ 第 ' + (i + 1) + ' 关已生成：' + r.words.length + ' 词 · ' + r.sentences.length + ' 句')
    } catch (e) {
      toast('第 ' + (i + 1) + ' 关生成失败：' + (e.message || '请稍后重试'))
    } finally {
      setGenIdx(-1)
    }
  }

  // 批量生成：逐关串行调用 AI 生成例句
  const [genAllBusy, setGenAllBusy] = useState(false)
  const genAllLessons = async () => {
    if (genAllBusy) return
    const need = form.lessons.filter(l => (l.vocab || '').trim() && !l.sentences.length).length
    if (!need) { toast('没有需要生成的关卡（每关都要有生词表）'); return }
    if (!window.confirm('将为 ' + need + ' 个关卡逐个生成例句（每关约 10-20 秒），预计 ' + Math.ceil(need * 15 / 60) + ' 分钟，期间请勿关闭页面。继续？')) return
    setGenAllBusy(true)
    let okCnt = 0, failCnt = 0
    for (let i = 0; i < form.lessons.length; i++) {
      const l = form.lessons[i]
      if (!(l.vocab || '').trim() || l.sentences.length) continue
      setGenIdx(i)
      try {
        const res = await apiFetch('/api/course-lesson-gen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: l.name || ('第 ' + (i + 1) + ' 课'), category: form.cat, level: form.level, words: l.vocab }),
        })
        const jj = await res.json()
        if (!jj.ok) throw new Error(jj.error || '生成失败')
        const r = parseAIJSON(jj.content)
        if (!r || !Array.isArray(r.words) || !Array.isArray(r.sentences) || !r.sentences.length) { failCnt++; continue }
        okCnt++
        setForm(prev => {
          const lessons = prev.lessons.map((ll, idx) => idx === i ? {
            ...ll,
            name: ll.name || (r.title || '').slice(0, 30),
            desc: ll.desc || (r.description || '').slice(0, 60),
            words: r.words.slice(0, 40),
            sentences: r.sentences.slice(0, 30),
          } : ll)
          return { ...prev, lessons }
        })
      } catch (e) { failCnt++ }
    }
    setGenIdx(-1); setGenAllBusy(false)
    toast('批量生成完成：成功 ' + okCnt + ' 关' + (failCnt ? '，失败 ' + failCnt + ' 关（可逐个重试）' : ''))
  }
  const aiGenLesson = async () => {
    if (aiGen) return
    const words = (form.wordsText || '').trim()
    if (!words) { toast('请先粘贴本课生词表（每行：词 | 释义）'); return }
    setAiGen(true)
    try {
      const res = await apiFetch('/api/course-lesson-gen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: form.title.trim(), category: form.cat, level: form.level, words }),
      })
      const jj = await res.json()
      if (!jj.ok) throw new Error(jj.error || 'AI 生成失败')
      const r = parseAIJSON(jj.content)
      if (!r || !Array.isArray(r.words) || !Array.isArray(r.sentences) || !r.sentences.length) {
        toast('AI 生成失败：未能解析出句子，请重试'); return
      }
      const lesson = {
        name: (r.title || (form.title.trim() || '第 1 课')).slice(0, 30),
        desc: (r.description || '').slice(0, 60),
        words: r.words,
        sentences: r.sentences,
      }
      setForm(prev => ({
        ...prev,
        lessons: [lesson],
        title: prev.title.trim() || (r.title || '第 1 课'),
      }))
      toast('✨ AI 已生成 1 课：' + lesson.words.length + ' 个单词 · ' + lesson.sentences.length + ' 句渐进例句')
    } catch (e) {
      toast('AI 渐进生成失败：' + (e.message || '请稍后重试'))
    } finally {
      setAiGen(false)
    }
  }

  // 🤖 AI 自动打标：根据标题/文本/分类/难度，自动生成年级 + 教材版本
  const [autoTagging, setAutoTagging] = useState(false)
  const autoTag = async () => {
    if (autoTagging) return
    setAutoTagging(true)
    try {
      const title = (form.title || '').trim() || '(未填写标题，将根据分类和文本判断)'
      const sample = (form.bulkText || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean).slice(0, 5).join(' | ')
      // System Prompt 在后端 server.py（COURSE_TAG_SYSTEM_PROMPT），此处只传 一级分类 + OCR文本
      const text = '课程标题：' + title +
        '\n主分类：' + form.cat +
        '\n子分类：' + (form.subcat || '无') +
        '\n难度：' + form.level +
        '\n学段：' + form.stage +
        '\nOCR文本：' + (sample || '无')
      const res = await apiFetch('/api/course-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: form.cat, text }),
      })
      const jj = await res.json()
      if (!jj.ok) throw new Error(jj.error || 'AI 打标失败')
      const r = parseAIJSON(jj.content)
      if (!r || (!r.grade && !r.textbook)) { toast('AI 打标失败：未能解析结果，请重试'); return }
      setForm(prev => ({
        ...prev,
        grade: TAG_GRADES.includes(r.grade) ? r.grade : prev.grade,
        textbook: TAG_TEXTBOOKS.includes(r.textbook) ? r.textbook : prev.textbook,
        // 二级筛选标签：AI 按主分类标签池精准判断；教材同步允许 AI 给出新教材名
        subcat: (r.subcat && r.subcat !== '全部') ? r.subcat : prev.subcat,
      }))
      const parts = []
      if (r.grade && TAG_GRADES.includes(r.grade)) parts.push(r.grade)
      if (r.textbook && TAG_TEXTBOOKS.includes(r.textbook)) parts.push(r.textbook)
      if (r.subcat && r.subcat !== '全部') parts.push(r.subcat)
      const conf = typeof r.confidence === 'number' ? Math.round(r.confidence * 100) + '%' : ''
      const tip = conf ? ' · 置信度 ' + conf : ''
      const why = r.reason ? '（' + r.reason + '）' : ''
      toast('AI 打标完成：' + (parts.join(' · ') || '未识别，请手动选择') + tip + why)
    } catch (e) {
      toast('AI 打标失败：' + (e.message || '请稍后重试'))
    } finally {
      setAutoTagging(false)
    }
  }

  // 封面上传 B2（kind=image）→ b2:// URL；失败返回空（页面用 picsum 兜底）
  const uploadCoverToB2 = async (dataUrl) => {
    try {
      const pr = await apiFetch('/api/upload/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: 'cover.jpg', kind: 'image', contentType: 'image/jpeg', adminKey })
      })
      const pj = await pr.json()
      if (!pj.ok || !pj.uploadUrl) return ''
      const blob = await (await fetch(dataUrl)).blob()
      const res = await new Promise((resolve) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', pj.uploadUrl, true)
        xhr.setRequestHeader('Content-Type', 'image/jpeg')
        xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300)
        xhr.onerror = () => resolve(false)
        xhr.send(blob)
      })
      return res ? pj.objectUrl : ''
    } catch (e) { return '' }
  }

  const onPickCover = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async (e) => {
      const f = e.target.files && e.target.files[0]
      if (!f) return
      const dataUrl = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f) })
      setForm(prev => ({ ...prev, cover: dataUrl }))
      toast('封面已选择，投稿时自动上传云端')
    }
    input.click()
  }

  const handleSubmit = async () => {
    const title = form.title.trim()
    const lessons = form.lessons.filter(l => l.name.trim()).map((l, i) => ({
      id: i + 1, title: l.name.trim(), description: (l.desc || '').trim(),
      words: Array.isArray(l.words) ? l.words.filter(w => w && w.ru) : [],   // 本课单词表
      sentences: Array.isArray(l.sentences) ? l.sentences.filter(x => x && x.ru) : [], // 本课渐进例句
      status: i === 0 ? '进行中' : '未开始', difficulty: 'easy',
    }))
    if (!title) { toast('请填写课程标题'); return }
    if (!lessons.length) { toast('请至少填写一个关卡（课程大纲）'); return }
    setSubmitting(true)
    try {
      const id = 'game_course_' + Date.now()
      let cover = form.cover || `https://picsum.photos/seed/${id}/400/280`
      if (String(form.cover).startsWith('data:')) {
        const up = await uploadCoverToB2(form.cover)
        if (up) cover = up
      }
      const payload = {
        id,
        section: 'guide', kind: 'course', // 课程：显示在通关秘籍区
        cat: form.cat,
        subcat: form.subcat,
        category: form.cat,
        level: form.level,
        stage: form.stage,
        grade: form.grade || '',   // AI 自动打标：年级（游戏商城筛选/展示用）
        textbook: form.textbook || '', // AI 自动打标：教材版本
        title,
        desc: (form.subcat && form.subcat !== '全部' ? form.subcat + ' · ' : '') + form.cat + ' · ' + form.level + ' · 共 ' + lessons.length + ' 关',
        cover: 'bg-gradient-to-br from-violet-100 to-purple-300', ink: 'text-purple-900',
        word: form.subcat === '字母发音' || form.cat === '基础入门' ? 'А Б В Г Д' : (title.slice(0, 2) || 'Курс'),
        total: lessons.length,
        eps: lessons.length + ' 关',
        lessons,
        thumbnail: cover,
        posterUrl: cover,
        author: '管理员',
        views: 0,
        createdAt: Date.now(),
        tags: ['course', form.cat, form.subcat, form.level, form.stage],
      }
      const saved = useGameCourseStore.getState().submit(payload)

      // 云端同步：视频+课程合并名单整体写入 B2（课程 kind='course' 与视频区分）
      let cloudOk = true
      try {
        const videos = useGameVideoStore.getState().videos
        const courses = useGameCourseStore.getState().courses
        const sr = await apiFetch('/api/videos/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videos: sanitizeForCloud([...videos, ...courses]), adminKey })
        })
        const sj = await sr.json()
        if (!sj.ok) { cloudOk = false; console.warn('云端名单同步失败:', sj.error) }
      } catch (e) { cloudOk = false; console.warn('云端名单同步异常:', e.message) }

      if (!saved) {
        toast('⚠️ 课程已记录但本地保存失败（浏览器存储不可用），换设备后看不到')
      } else if (!cloudOk) {
        toast('⚠️ 课程已发布到本机，但云端共享失败（可能是管理员密钥失效）。请退出后重新登录管理员，再投稿一次即可让所有人看到')
      } else {
        toast('课程投稿成功！已发布到游戏商城 · ' + form.cat + (form.subcat && form.subcat !== '全部' ? ' / ' + form.subcat : ''))
      }
      onClose()
      navigate('/unlocked-games')
    } catch (e) {
      toast('课程投稿失败：' + (e.message || '请重试'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560, maxHeight: '88vh', overflowY: 'auto' }}>
        <h2>投稿课程</h2>
        <p className="hint">创建真实课程：填写标题、分类、难度和关卡大纲，投稿后出现在「游戏商城」页，点卡片进入游戏详情学习。</p>

        <div className="field">
          <label>课程标题（粘贴文本后自动生成，可改）</label>
          <input value={form.title} onChange={e => setField('title', e.target.value)} placeholder="例如：走遍俄罗斯 · 第1课" />
        </div>

        {/* 方式一（推荐）：粘贴本课生词表 → AI 渐进生成（先学单词，再逐句渐进） */}
        <div className="field" style={{ border: '1px dashed #ddd', borderRadius: 10, padding: 12 }}>
          <label>方式一 · 粘贴本课生词表 → ✨ AI 渐进生成（推荐，整课=1 关）</label>
          <textarea
            value={form.wordsText}
            onChange={e => setField('wordsText', e.target.value)}
            rows={4}
            placeholder={"слово | 单词\nдом | 房子\nкнига | 书\nчитать | 阅读"}
            style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
            <button type="button" className="btn sm primary" onClick={aiGenLesson} disabled={aiGen} style={{ flexShrink: 0 }}>
              {aiGen ? 'AI 生成中…' : '✨ AI 渐进生成一课'}
            </button>
            <span className="hint" style={{ margin: 0 }}>无论多少生词，都合成 <b>1 关（1 课）</b>：全部单词 + 渐进例句都在这一课里</span>
          </div>
        </div>

        {/* 方式二：粘贴俄中对照文本 → 按行拆课（每行一句，一行一关，适合已有成句内容） */}
        <div className="field">
          <label>方式二 · 粘贴俄中对照文本（仅限「一句一行」的成句内容；生词表请用方式一）</label>
          <textarea
            value={form.bulkText}
            onChange={e => setField('bulkText', e.target.value)}
            rows={3}
            placeholder={"Привет! | 你好！\nМеня зовут Анна. | 我叫安娜。"}
            style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }}
          />
          <button type="button" className="btn sm" onClick={genFromText} style={{ marginTop: 6 }}>✨ 一键生成关卡（{form.lessons.length ? '已生成 ' + form.lessons.length + ' 关' : '当前 0 关'}）</button>
        </div>

        {/* 方式三：粘贴整本书/多课文本 → AI 自动切课（每课一关） */}
        <div className="field" style={{ border: '1px dashed #ddd', borderRadius: 10, padding: 12 }}>
          <label>方式三 · 粘贴整本书/连续多课文本 → ✨ AI 自动切课（每课一关）</label>
          <textarea
            value={splitText}
            onChange={e => setSplitText(e.target.value)}
            rows={5}
            placeholder={"Урок 1 · 字母与问候\nэто | 这是\nдом | 房子\n…\nУрок 2 · 这是谁\nкто | 谁\n…\n（每课以「Урок N」或课标题开头，AI 自动识别边界，一次最多约 5 课）"}
            style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="btn sm primary" onClick={splitCourse} disabled={splitting} style={{ flexShrink: 0 }}>
              {splitting ? 'AI 切课中…' : '✨ AI 自动切课'}
            </button>
            {form.lessons.some(l => (l.vocab || '').trim() && !l.sentences.length) && (
              <button type="button" className="btn sm" onClick={genAllLessons} disabled={genAllBusy} style={{ flexShrink: 0 }}>
                {genAllBusy ? '批量生成中…' : '⚡ 批量生成全部例句'}
              </button>
            )}
            <span className="hint" style={{ margin: 0 }}>AI 按「Урок N」识别每课边界 → 每课 1 关；切完可逐关/批量生成例句</span>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12.5, color: '#555' }}>
            <input type="checkbox" checked={appendMode} onChange={e => setAppendMode(e.target.checked)} />
            追加到已有关卡（不覆盖）—— 分 3 批切课时勾选，合并成 1 个课程包（共 13 关）
          </label>
        </div>

        <div className="field">
          <label>主分类</label>
          <select value={form.cat} onChange={e => setCat(e.target.value)}>
            {MAIN_CATS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="field">
          <label>二级筛选标签（AI 自动判断，可手动修改）</label>
          <input
            list="rb-subcats"
            value={form.subcat}
            onChange={e => setField('subcat', e.target.value)}
            placeholder={form.cat === '教材同步' ? '选择或输入教材，如：走遍俄罗斯' : '选择子分类'}
          />
          <datalist id="rb-subcats">
            {(SUBCATS[form.cat] || ['全部']).map(c => <option key={c} value={c} />)}
          </datalist>
          <div className="hint" style={{ marginTop: 4 }}>点上方「✨ AI 自动打标」会根据内容自动判断二级标签；教材同步会识别教材名并自动生成筛选标签。</div>
        </div>

        <div className="field">
          <label>难度</label>
          <select value={form.level} onChange={e => setField('level', e.target.value)}>
            {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        <div className="field">
          <label>学段（学历方向）</label>
          <select value={form.stage} onChange={e => setField('stage', e.target.value)}>
            {STAGES.map(st => <option key={st} value={st}>{st}</option>)}
          </select>
        </div>

        {/* AI 自动打标：年级 + 教材版本 */}
        <div className="field" style={{ border: '1px dashed #ddd', borderRadius: 10, padding: 12, marginTop: 4 }}>
          <label>🤖 AI 自动打标（年级 + 教材版本）</label>
          <p className="hint" style={{ marginTop: 0 }}>点击后 AI 根据标题、文本、分类与难度自动判断年级和教材版本，可手动修改。</p>
          <button type="button" className="btn sm" onClick={autoTag} disabled={autoTagging} style={{ marginTop: 6 }}>
            {autoTagging ? 'AI 分析中…' : '✨ AI 自动打标'}
          </button>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <select
              value={form.grade || ''}
              onChange={e => setField('grade', e.target.value)}
              style={{ flex: 1, minWidth: 140 }}
            >
              <option value="">年级（待打标）</option>
              {TAG_GRADES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <select
              value={form.textbook || ''}
              onChange={e => setField('textbook', e.target.value)}
              style={{ flex: 1, minWidth: 140 }}
            >
              <option value="">教材版本（待打标）</option>
              {TAG_TEXTBOOKS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="field">
          <label>封面（可选，不选自动生成）</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="button" className="btn sm" onClick={onPickCover}>{form.cover ? '重新选择封面' : '选择封面图片'}</button>
            {form.cover && <img src={form.cover} alt="封面" style={{ width: 80, height: 52, objectFit: 'cover', borderRadius: 8, border: '1px solid #eee' }} />}
          </div>
          <div className="hint" style={{ marginTop: 4 }}>封面直传 B2 云端，所有人可见。</div>
        </div>

        <div className="field">
          <label>关卡大纲（已生成 {form.lessons.length} 关，可手动增删改）</label>
          {form.lessons.map((l, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <span style={{ flexShrink: 0, fontSize: 12, color: '#999', width: 44 }}>第 {i + 1} 关</span>
              <input
                value={l.name}
                onChange={e => setLesson(i, 'name', e.target.value)}
                placeholder="课名，如：第1课·问候与初识"
                style={{ flex: 1, minWidth: 0 }}
              />
              {Array.isArray(l.sentences) && l.sentences.length > 0 && (
                <span style={{ flexShrink: 0, fontSize: 11.5, color: '#7c3aed', background: '#EDE9FE', borderRadius: 999, padding: '2px 8px' }}>
                  {(Array.isArray(l.words) ? l.words.length : 0) + ' 词 · ' + l.sentences.length + ' 句'}
                </span>
              )}
              {(l.vocab || '').trim() && !(Array.isArray(l.sentences) && l.sentences.length) && (
                <button type="button" className="btn sm" disabled={genIdx >= 0} onClick={() => genLessonFor(i)} style={{ flexShrink: 0 }}>
                  {genIdx === i ? '生成中…' : '✨例句'}
                </button>
              )}
              <input
                value={l.desc}
                onChange={e => setLesson(i, 'desc', e.target.value)}
                placeholder="中文释义（可选）"
                style={{ flex: 1, minWidth: 0 }}
              />
              {form.lessons.length > 1 && (
                <button type="button" className="btn sm" onClick={() => setForm(prev => ({ ...prev, lessons: prev.lessons.filter((_, idx) => idx !== i) }))} style={{ flexShrink: 0 }}>删</button>
              )}
            </div>
          ))}
          <button type="button" className="btn sm" onClick={() => setForm(prev => ({ ...prev, lessons: [...prev.lessons, { name: '', desc: '' }] }))}>＋ 添加关卡</button>
        </div>

        <div className="mfoot">
          <button className="btn" onClick={onClose} disabled={submitting}>取消</button>
          <button className="btn primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? '提交中…' : '投稿课程'}
          </button>
        </div>
      </div>
    </div>
  )
}
