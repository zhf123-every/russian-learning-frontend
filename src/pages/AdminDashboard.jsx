import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCourses, saveCourses, deleteCourse } from '../utils/storage'
import { GRADES, TEXTBOOKS } from '../data/gameMallData'
import { API_BASE, apiFetch } from '../lib/api'
import { parseAIJSON, chat } from '../lib/ai'
import { useAdminStore } from '../store/adminStore'

// ===== 站长专属后台 · 课程包管理（第三步：课程档案 + 课程序 + 课时内容） =====

// 一级分类（与商城/投稿分类体系一致）
const CATS = ['教材同步', '考试备考', '少儿俄语', '基础俄语', '语法专项', '场景俄语', '阅读听力', '影视俄语', '音乐俄语']
// 角标选项
const BADGES = ['', '精选', '热销', '新', '备考', '衔接']
// 难度
const DIFFS = ['入门', '初级', '中级', '高级']
// 二级标签池（按一级分类联动；年级/教材版本已单列）
const TAG_POOL = {
  '教材同步': ['走遍俄罗斯', '大学俄语', '东方俄语', '新概念俄语', '黑大俄语', '北外俄语', '人教版初中', '人教版高中', '自编课'],
  '考试备考': ['中高考', '专四专八', '考研', 'ТРКИ等级', '留学预科', 'CATTI', '职业俄语'],
  '少儿俄语': ['少儿启蒙', '动画分级', '分级阅读', '动画绘本', '儿歌童谣', '字母拼读', '少儿词汇'],
  '基础俄语': ['零基础路线', '字母发音', '基础语法', '基础词汇', '核心句型', '经典教材', '综合提升'],
  '语法专项': ['主格', '属格', '与格', '宾格', '工具格', '前置格'],
  '场景俄语': ['日常对话', '商务职场', '外贸商务', '旅游出行', '面试校园', '社交口语', '写作邮件'],
  '阅读听力': ['短文精读', '俄语故事', '名著简写', '新闻短文', '文化科普', '专业阅读'],
  '影视俄语': ['情景剧', '影视台词', '电影片段', '动画片段', '经典教材剧'],
  '音乐俄语': ['俄语歌曲'],
}

const emptyForm = () => ({
  title: '',
  subtitle: '',
  category: '教材同步',
  grade: '通用',
  textbook: '走遍俄罗斯',
  difficulty: '入门',
  badge: '',
  lessons: 12,
  students: 0,
  tags: [],
  coverUrl: '',
  coverName: '',
  materials: [], // { name, type, url }
})

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [view, setView] = useState('list')          // list=档案列表 | units=课程序 | unit=课时内容
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState('')    // 非空 = 正在编辑某条档案
  const [courses, setCourses] = useState([])
  const [toast, setToast] = useState('')
  // —— 云端同步状态 ——
  const { adminKey, login, logout } = useAdminStore()
  const [adminInput, setAdminInput] = useState(adminKey || '')
  const [cloudBusy, setCloudBusy] = useState(false)
  const [cloudMsg, setCloudMsg] = useState('')
  const [cloudCount, setCloudCount] = useState(-1)

  // —— 课程序管理状态 ——
  const [active, setActive] = useState(null)        // 当前管理课程序的课程
  const [units, setUnits] = useState([])            // 该课程的课时
  const [newUnitTitle, setNewUnitTitle] = useState('')
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)

  // —— 课时内容管理状态 ——
  const [activeUnit, setActiveUnit] = useState(null) // 当前编辑内容的课时
  const [genning, setGenning] = useState(false)
  const [newSentRu, setNewSentRu] = useState('')
  const [newSentZh, setNewSentZh] = useState('')
  const [editSentIdx, setEditSentIdx] = useState(-1)      // 正在行内编辑的例句下标（-1=未编辑）
  const [editSent, setEditSent] = useState({ ru: '', zh: '', chunks: '' })
  const [jsonText, setJsonText] = useState('')            // 批量导入 JSON（句子）粘贴区
  const [jsonBusy, setJsonBusy] = useState(false)
  const [aiDescBusy, setAiDescBusy] = useState(false)     // AI 自动生成课程简介中

  // —— AI 自动生成课程简介（【课程介绍】【学习目标】【适合谁学】）——
  const aiGenDesc = async () => {
    const title = form.title.trim()
    if (!title) { flash('请先填写课程标题，再生成简介'); return }
    setAiDescBusy(true)
    try {
      const ctx = [
        title && `课程标题：${title}`,
        form.category && `分类：${form.category}`,
        form.textbook && `教材：${form.textbook}`,
        form.grade && `年级：${form.grade}`,
        form.difficulty && `难度：${form.difficulty}`,
        form.lessons && `课时数：${form.lessons}`,
        form.tags && form.tags.length && `标签：${form.tags.join('、')}`,
      ].filter(Boolean).join('\n')
      const content = await chat({
        messages: [
          { role: 'system', content: '你是俄语课程运营编辑，擅长为俄语学习课程撰写专业、有吸引力、分三段的介绍文案，全部使用简体中文。' },
          { role: 'user', content:
            `请根据以下课程信息，撰写三段式课程简介：\n${ctx}\n\n` +
            '要求：\n1. 第一段以【课程介绍】开头：说明课程内容、学习范围和亮点（100字左右）；\n' +
            '2. 第二段以【学习目标】开头：写3-5条可衡量的学习目标（80字左右）；\n' +
            '3. 第三段以【适合谁学】开头：列出适合的学习人群（60字左右）；\n' +
            '直接输出三段文字，每段以对应方括号标题起行，不要额外解释。' },
        ],
      })
      const text = String(content || '').trim()
      if (!text || !text.includes('【')) { flash('⚠️ AI 生成结果异常，请重试'); return }
      setField('subtitle', text)
      flash('✅ 已用 AI 生成课程简介，可再手动微调')
    } catch (e) {
      flash('⚠️ AI 接口暂不可用：' + (e.message || '请稍后重试'))
    } finally {
      setAiDescBusy(false)
    }
  }


  // 刷新课程列表
  const refresh = () => setCourses(getCourses())
  useEffect(() => { refresh() }, [])

  const setField = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  // 提示（2.5 秒自动消失）
  const flash = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  // 封面图：文件 → objectURL 本地预览
  const onPickCover = (e) => {
    const f = e.target.files && e.target.files[0]
    if (!f) return
    setForm(prev => ({ ...prev, coverUrl: URL.createObjectURL(f), coverName: f.name }))
  }

  // 课件上传：多选（PDF/Word/MP3/MP4）→ 本地 URL 模拟
  const onPickMaterials = (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const items = files.map(f => ({ name: f.name, type: f.type || f.name.split('.').pop(), url: URL.createObjectURL(f) }))
    setForm(prev => ({ ...prev, materials: [...prev.materials, ...items] }))
    e.target.value = ''
  }

  const toggleTag = (t) => {
    setForm(prev => ({
      ...prev,
      tags: prev.tags.includes(t) ? prev.tags.filter(x => x !== t) : [...prev.tags, t],
    }))
  }

  // 组装课程档案对象
  const buildCourse = (status) => {
    const title = form.title.trim()
    if (!title) { flash('请先填写课程标题'); return null }
    const now = Date.now()
    const base = {
      title,
      subtitle: form.subtitle.trim(),
      category: form.category,
      grade: form.grade || '通用',
      textbook: form.textbook || '自编课',
      difficulty: form.difficulty,
      badge: form.badge,
      author: '管理员',
      lessons: Number(form.lessons) || 1,
      students: Number(form.students) || 0,
      tags: form.tags,
      cover: form.coverUrl || 'https://picsum.photos/seed/course_' + now + '/400/280',
      materials: form.materials,
      isGrammar: form.category === '语法专项', // 一级分类为「语法专项」即语法课程（点亮变格天赋树）
      units: [], // 第二步「课程序」填充
      status,
      updatedAt: now,
    }
    return base
  }

  // 保存草稿
  const saveDraft = () => {
    const base = buildCourse('draft')
    if (!base) return
    const list = getCourses()
    if (editingId) {
      const i = list.findIndex(c => c.id === editingId)
      if (i >= 0) list[i] = { ...list[i], ...base, id: editingId }
      flash('草稿已更新')
    } else {
      base.id = 'course_' + Date.now()
      base.createdAt = Date.now()
      list.push(base)
      flash('课程档案已保存（草稿），下一步搭课程序')
    }
    if (!saveCourses(list)) { flash('保存失败：浏览器存储不可用'); return }
    setForm(emptyForm())
    setEditingId('')
    refresh()
  }

  // 直接发布上架（发布后自动同步到云端，全网可见，游戏商城页/商城立即可见）
  const publish = async () => {
    const base = buildCourse('published')
    if (!base) return
    const list = getCourses()
    if (editingId) {
      const i = list.findIndex(c => c.id === editingId)
      if (i >= 0) list[i] = { ...list[i], ...base, id: editingId }
      flash('已更新并发布上架！')
    } else {
      base.id = 'course_' + Date.now()
      base.createdAt = Date.now()
      list.push(base)
      flash('已发布上架！共 ' + list.length + ' 个课程')
    }
    if (!saveCourses(list)) { flash('保存失败：浏览器存储不可用'); return }
    setForm(emptyForm())
    setEditingId('')
    refresh()
    // 发布即全网可见：自动同步到云端（需已登录管理员）
    await syncToCloud()
  }

  // 继续编辑（把档案填回表单）
  const edit = (c) => {
    setForm({
      title: c.title || '',
      subtitle: c.subtitle || '',
      category: c.category || '教材同步',
      grade: c.grade || '通用',
      textbook: c.textbook || '自编课',
      difficulty: c.difficulty || '入门',
      badge: c.badge || '',
      lessons: c.lessons || 12,
      students: c.students || 0,
      tags: c.tags || [],
      coverUrl: c.cover || '',
      coverName: '',
      materials: c.materials || [],
    })
    setEditingId(c.id)
    setView('list')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // 删除课程
  const remove = (id) => {
    deleteCourse(id)
    refresh()
  }

  // ========== 课程数据跨浏览器迁移（导出 / 导入） ==========
  const exportCourses = () => {
    const raw = localStorage.getItem('rb_admin_courses') || '[]'
    const blob = new Blob([raw], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'rb_admin_courses_backup.json'
    a.click()
    URL.revokeObjectURL(url)
  }
  const importCoursesFile = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text = String(reader.result || '')
        const arr = JSON.parse(text)
        if (!Array.isArray(arr)) throw new Error('格式不是数组')
        localStorage.setItem('rb_admin_courses', JSON.stringify(arr))
        setCourses(getCourses())
        setCloudMsg(`已导入 ${arr.length} 门课程，请刷新页面确认后再同步`)
      } catch (e) {
        setCloudMsg('导入失败：' + e.message)
      }
    }
    reader.readAsText(file)
  }
  // ========== 全网可见：后台课程同步到云端（B2 videos/index.json，访客 GET /api/videos/list 可读） ==========
  const syncToCloud = async () => {
    if (cloudBusy) return
    if (!adminKey) { setCloudMsg('请先输入管理员密钥并登录'); return }
    const localPub = getCourses().filter(c => c.status !== 'draft')
    if (!localPub.length) { setCloudMsg('没有已发布的课程可同步'); return }
    setCloudBusy(true)
    setCloudMsg('同步中…')
    try {
      // 1) 现有云端名单（含投稿视频/投稿课程）
      let cloud = []
      try {
        const r = await apiFetch('/api/videos/list')
        const j = await r.json()
        if (j.ok && Array.isArray(j.videos)) cloud = j.videos
      } catch (e) { /* 读不到就当空 */ }
      // 2) 后台已发布课程 → 云端对象（带 units 课时内容），与投稿课程同结构（kind='course'）
      const localObj = localPub.map(c => ({
        ...c,
        kind: 'course',
        section: 'guide',
        cat: c.category,
        category: c.category,
        level: c.difficulty,
        stage: c.grade,
        grade: c.grade,
        textbook: c.textbook,
        eps: (Array.isArray(c.units) ? c.units.length : (c.lessons || 1)) + ' 关',
        total: Array.isArray(c.units) ? c.units.length : (c.lessons || 1),
        thumbnail: c.cover,
        posterUrl: c.cover,
        views: c.students || 0,
        tags: ['course', c.category, c.grade, c.textbook],
      }))
      // 3) 合并：保留云端非本地上传的项，本地上传的同 id 覆盖
      const mineIds = new Set(localObj.map(x => x.id))
      const keep = cloud.filter(v => !(v.kind === 'course' && mineIds.has(v.id)))
      const merged = [...keep, ...localObj]
      // 4) 全量写回 B2
      const sr = await apiFetch('/api/videos/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videos: merged, adminKey }),
      })
      const sj = await sr.json()
      if (sj.ok) {
        setCloudCount(merged.length)
        setCloudMsg('✅ 已同步 ' + localObj.length + ' 门课程到云端，访客可公开访问（名单共 ' + merged.length + ' 项）')
        // 打标 cloudSynced
        const list = getCourses().map(c => localObj.some(x => x.id === c.id) ? { ...c, cloudSynced: true } : c)
        saveCourses(list)
        refresh()
      } else {
        setCloudMsg('同步失败：' + (sj.error || '未知错误'))
      }
    } catch (e) {
      setCloudMsg('同步失败：' + (e.message || '网络错误'))
    }
    setCloudBusy(false)
  }

  const doAdminLogin = async () => {
    const ok = await login(adminInput)
    setCloudMsg(ok ? '✅ 管理员已登录，可以同步到云端' : '密钥无效，请检查')
  }

  // ========== 第二步：课程序管理 ==========

  // 进入课程序管理
  const manageUnits = (c) => {
    setActive(c)
    setUnits(c.units || [])
    setNewUnitTitle('')
    setImportText('')
    setView('units')
    window.scrollTo({ top: 0 })
  }

  // 持久化课时列表并同步 active
  const persistUnits = (next) => {
    setUnits(next)
    const list = getCourses()
    const i = list.findIndex(x => x.id === active.id)
    if (i >= 0) {
      const updated = { ...list[i], units: next, lessons: next.length || list[i].lessons, updatedAt: Date.now() }
      list[i] = updated
      saveCourses(list)
      setActive(updated)
      refresh()
    }
  }

  // 手动添加课时
  const addUnit = () => {
    const t = newUnitTitle.trim() || ('第 ' + (units.length + 1) + ' 课')
    persistUnits([...units, { id: 'unit_' + Date.now(), title: t, desc: '', vocab: '', imported: false }])
    setNewUnitTitle('')
  }

  // 上移 / 下移
  const moveUnit = (idx, dir) => {
    const to = idx + dir
    if (to < 0 || to >= units.length) return
    const next = [...units]
    ;[next[idx], next[to]] = [next[to], next[idx]]
    persistUnits(next)
  }

  // 删除课时
  const removeUnit = (idx) => {
    persistUnits(units.filter((_, i) => i !== idx))
  }

  // AI 切课导入：粘贴整书文本 → 后端切课 → 追加为课时
  const doImport = async () => {
    const text = importText.trim()
    if (!text) { flash('请先粘贴要切课的文本'); return }
    setImporting(true)
    try {
      const isLocal = /^localhost|^127\./.test(location.hostname)
      const base = isLocal ? '' : (API_BASE || '')
      const res = await fetch(`${base}/api/course-split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: active.title, category: active.category, level: active.difficulty || 'A1', text }),
      })
      const r = await res.json()
      let lessons = Array.isArray(r.lessons) ? r.lessons : null
      if (!lessons && r.content) {
        try { lessons = JSON.parse(r.content).lessons } catch (e) { /* ignore */ }
      }
      if (!Array.isArray(lessons) || !lessons.length) {
        flash('切课失败：' + (r.error || '未能识别出课，请确认文本包含「Урок N」标题行'))
        setImporting(false)
        return
      }
      const added = lessons.map((l, idx) => ({
        id: 'unit_' + Date.now() + '_' + idx,
        title: l.name || ('第 ' + (l.num || idx + 1) + ' 课'),
        desc: l.desc || '',
        vocab: l.vocab || '',
        imported: true,
      }))
      persistUnits([...units, ...added])
      flash(`已导入 ${added.length} 个课时（追加）`)
    } catch (e) {
      flash('切课请求失败：' + (e.message || '网络错误'))
    }
    setImporting(false)
  }

  // ========== 第三步：课时内容管理 ==========

  // 进入课时内容
  const openUnit = (u) => {
    setActiveUnit({ ...u })
    setNewSentRu('')
    setNewSentZh('')
    setView('unit')
    window.scrollTo({ top: 0 })
  }

  // 更新 activeUnit 副本
  const patchUnit = (patch) => setActiveUnit(prev => ({ ...prev, ...patch }))

  // 保存课时内容（写回课程 units）
  const saveUnit = () => {
    if (!activeUnit) return
    const nextUnits = units.map(u => (u.id === activeUnit.id ? activeUnit : u))
    persistUnits(nextUnits)
    flash('课时内容已保存')
    setView('units')
  }

  // ✨ AI 生成渐进例句：生词表 → 每词至少 1 句长句
  const genSentences = async () => {
    const vocab = (activeUnit.vocab || '').trim()
    if (!vocab) { flash('请先填写本课生词表（每行：词 | 释义）'); return }
    if (genning) return
    setGenning(true)
    try {
      const isLocal = /^localhost|^127\./.test(location.hostname)
      const base = isLocal ? '' : (API_BASE || '')
      const res = await fetch(`${base}/api/course-lesson-gen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: active.title, category: active.category, level: active.difficulty || 'A1', words: vocab }),
      })
      const jj = await res.json()
      if (!jj.ok) throw new Error(jj.error || 'AI 生成失败')
      const r = parseAIJSON(jj.content)
      if (!r || !Array.isArray(r.words) || !Array.isArray(r.sentences) || !r.sentences.length) {
        throw new Error('未能解析出句子，请重试')
      }
      patchUnit({ words: r.words, sentences: r.sentences })
      flash(`✨ 已生成 ${r.words.length} 个单词 · ${r.sentences.length} 句渐进例句（记得点「保存课时内容」）`)
    } catch (e) {
      flash('AI 生成失败：' + (e.message || '请稍后重试'))
    }
    setGenning(false)
  }

  // 手动添加例句
  const addSentence = () => {
    const ru = newSentRu.trim()
    const zh = newSentZh.trim()
    if (!ru || !zh) { flash('例句需同时填写俄语和中文'); return }
    patchUnit({ sentences: [...(activeUnit.sentences || []), { ru, zh }] })
    setNewSentRu('')
    setNewSentZh('')
  }

  // 删除例句
  const removeSentence = (idx) => {
    patchUnit({ sentences: (activeUnit.sentences || []).filter((_, i) => i !== idx) })
  }

  // ========== AI 前置数据入库：批量导入 JSON 句子 + 修复中文（缺失/逐词硬拼），前端只渲染固定数据 ==========
  // 检测某句中文是否需要 AI 修复：缺失 / 俄语残留 / 明显逐词硬拼（如「谁这是？」）
  const needsZhFix = (s) => {
    const zh = String(s.chinese || s.zh || '').trim()
    if (!zh) return true
    if (/[а-яё]/i.test(zh)) return true
    if (/^(谁|什么|哪儿|哪里|怎么|为什么|多少|几)[^。！？]*?(这|那)是/.test(zh)) return true
    return false
  }
  // AI 不可用时的本地兜底修复（仅处理典型「疑问词前置 + 这是」语序错位）
  const localFixZh = (zh) => {
    let t = String(zh || '').trim()
    const m = t.match(/^(谁|什么|哪儿|哪里|怎么|为什么|多少|几)([^。！？]*?)(这|那)是/)
    if (m) t = m[3] + '是' + m[2] + m[1] + t.slice(m[0].length)
    return t
  }
  // 批量调用后端 AI（密钥在服务端）：整句地道中文 + 意群块 chunks
  const aiFixSentences = async (sentences) => {
    const items = sentences.map((s) => String(s.ru || s.russian || '').trim()).filter(Boolean)
    if (!items.length) return {}
    const content = await chat({
      messages: [
        { role: 'system', content: '你是资深俄语→中文翻译，擅长合并意群、调整语序，输出地道中文。' },
        { role: 'user', content:
          '请将以下俄语句子翻译成地道的中文，并自动合并意群，避免逐词硬拼（例如 "Кто это?" 应译为 "这是谁？" 而不是 "谁这是？"）。\n' +
          '返回 JSON 格式：{"items":[{"ru":"原句","chinese":"地道整句中文","chunks":["意群块1","意群块2"]}]}，只输出 JSON。\n句子列表：\n' + JSON.stringify(items) },
      ],
    })
    const r = parseAIJSON(content)
    const map = {}
    ;(Array.isArray(r && r.items) ? r.items : []).forEach((it) => {
      const ru = String(it && it.ru || '').trim()
      if (ru) map[ru] = { chinese: String(it.chinese || '').trim(), chunks: Array.isArray(it.chunks) ? it.chunks.filter(Boolean) : [] }
    })
    return map
  }
  // 粘贴句子 JSON 数组 [{ru, zh}] → 检测异常 → AI 修复 → 去重追加（前端此后直接读 chinese）
  // —— 兼容三类导入：句子数组 / 滚动学习路径 {pathId,steps} / 对话 dialogues ——
  const normalizeImportData = (data) => {
    const out = { sentences: [], paths: [], dialogues: [] }
    const items = Array.isArray(data) ? data : [data]
    items.forEach((it) => {
      if (!it || typeof it !== 'object') return
      // ① 滚动学习路径：{ pathId, steps: [...] }（连词成句「滚雪球」步骤）
      if (Array.isArray(it.steps) && (it.pathId || it.steps.length)) {
        out.paths.push({
          pathId: String(it.pathId || 'path_' + Date.now()),
          steps: it.steps.map((st, i) => ({
            stepIndex: Number(st.stepIndex) || i + 1,
            russian: String(st.russian || st.ru || '').trim(),
            chinese: String(st.chinese || st.zh || '').trim(),
            audioUrl: String(st.audioUrl || st.audio || '').trim(),
            newChunks: Array.isArray(st.newChunks) ? st.newChunks : [],
            allChunks: Array.isArray(st.allChunks) ? st.allChunks : [],
          })).filter((st) => st.russian),
        })
        return
      }
      // ② 混合对象 / 对话：{ sentences:[...] } / { dialogues:[...] } / { dialogue:[...] }
      if (Array.isArray(it.sentences) || Array.isArray(it.dialogues) || Array.isArray(it.dialogue)) {
        if (Array.isArray(it.sentences)) out.sentences.push(...it.sentences)
        if (Array.isArray(it.dialogues)) out.dialogues.push(...it.dialogues)
        if (Array.isArray(it.dialogue)) out.dialogues.push(...it.dialogue)
        return
      }
      // ③ 单句（数组元素）：{ ru / russian / text }
      if (it.ru || it.russian || it.text) out.sentences.push(it)
    })
    return out
  }
  const importSentencesJson = async () => {
    const text = (jsonText || '').trim()
    if (!text) { flash('请先粘贴 JSON'); return }
    let data
    try { data = JSON.parse(text) }
    catch (e) { flash('JSON 解析失败：' + e.message); return }
    const { sentences, paths, dialogues } = normalizeImportData(data)
    // 1) 句子：AI 修复中文 + 去重追加（老逻辑，兼容老数据）
    if (sentences.length) {
      const list = sentences.map((s) => ({
        ru: String(s.ru || s.russian || s.text || '').trim(),
        zh: String(s.zh || '').trim(),
        chinese: String(s.chinese || s.zh || '').trim(),
      })).filter((s) => s.ru)
      if (list.length) {
        const need = list.filter((s) => needsZhFix(s))
        let fixed = list
        if (need.length) {
          setJsonBusy(true)
          try {
            const aiMap = await aiFixSentences(need)
            fixed = list.map((s) => (aiMap[s.ru] ? { ...s, chinese: aiMap[s.ru].chinese || s.chinese, chunks: aiMap[s.ru].chunks } : s))
            flash(`✅ AI 已修复 ${Object.keys(aiMap).length} 句中文（语序/意群）`)
          } catch (e) {
            fixed = list.map((s) => (needsZhFix(s) ? { ...s, chinese: localFixZh(s.chinese || s.zh) } : s))
            flash('⚠️ AI 接口暂不可用：已用本地规则修复典型逐词句，其余请人工复核后保存')
          }
          setJsonBusy(false)
        }
        const merged = [...(activeUnit.sentences || [])]
        const existIdx = new Map()
        merged.forEach((x, i) => { const k = String(x.ru || '').trim().toLowerCase(); if (k && !existIdx.has(k)) existIdx.set(k, i) })
        fixed.forEach((s) => {
          const k = String(s.ru).trim().toLowerCase()
          const i = existIdx.get(k)
          if (i >= 0) {
            const cur = merged[i].chinese || merged[i].zh || ''
            if (s.chinese && s.chinese !== cur) {
              merged[i] = { ...merged[i], chinese: s.chinese, chunks: s.chunks || merged[i].chunks }
            }
          } else {
            merged.push(s)
            existIdx.set(k, merged.length - 1)
          }
        })
        patchUnit({ sentences: merged })
      }
    }
    // 2) 滚动学习路径：按 pathId 去重合并（同 pathId 用新 steps 覆盖）
    if (paths.length) {
      const prev = [...(activeUnit.scaffoldingPaths || [])]
      const pathIds = new Set(prev.map((p) => p.pathId))
      paths.forEach((p) => {
        if (pathIds.has(p.pathId)) {
          const i = prev.findIndex((x) => x.pathId === p.pathId)
          prev[i] = p
        } else {
          prev.push(p)
          pathIds.add(p.pathId)
        }
      })
      patchUnit({ scaffoldingPaths: prev })
    }
    // 3) 对话：透传保存（按 JSON 去重）
    if (dialogues.length) {
      const prev = [...(activeUnit.dialogues || [])]
      const seen = new Set(prev.map((d) => JSON.stringify(d)))
      dialogues.forEach((d) => { const k = JSON.stringify(d); if (!seen.has(k)) { prev.push(d); seen.add(k) } })
      patchUnit({ dialogues: prev })
    }
    if (!sentences.length && !paths.length && !dialogues.length) {
      flash('未识别到可导入内容：需要 句子数组 / {pathId,steps} 滚动路径 / dialogues')
      return
    }
    flash(`✅ 导入完成：句子 ${sentences.length} 条、滚动路径 ${paths.length} 条、对话 ${dialogues.length} 条（点「保存课时内容」固定入库）`)
    setJsonText('')
  }
  // —— 手动修正（后台保留）：行内编辑 sentence 的 ru / chinese / chunks ——
  const startEditSent = (i) => {
    const s = (activeUnit.sentences || [])[i]
    setEditSentIdx(i)
    setEditSent({ ru: s.ru || '', zh: s.chinese || s.zh || '', chunks: Array.isArray(s.chunks) ? JSON.stringify(s.chunks) : '' })
  }
  const saveEditSent = () => {
    const ru = editSent.ru.trim()
    if (!ru) { flash('俄语不能为空'); return }
    let chunks
    try { chunks = editSent.chunks.trim() ? JSON.parse(editSent.chunks) : undefined }
    catch (e) { flash('chunks 不是合法 JSON 数组'); return }
    if (chunks !== undefined && !Array.isArray(chunks)) { flash('chunks 必须是数组'); return }
    const sentences = [...(activeUnit.sentences || [])]
    sentences[editSentIdx] = { ...sentences[editSentIdx], ru, zh: editSent.zh.trim(), chinese: editSent.zh.trim(), chunks }
    patchUnit({ sentences })
    setEditSentIdx(-1)
  }
  const cancelEditSent = () => setEditSentIdx(-1)
  // 课时素材上传（视频/音频/PDF）
  const onPickUnitMaterial = (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const items = files.map(f => ({ name: f.name, type: f.type || f.name.split('.').pop(), url: URL.createObjectURL(f) }))
    patchUnit({ materials: [...(activeUnit.materials || []), ...items] })
    e.target.value = ''
  }

  // ========== 渲染 ==========

  // —— 视图三：课时内容管理 ——
  if (view === 'unit' && activeUnit) {
    return (
      <main className="min-h-full bg-base-100 px-6 py-7">
        <div className="mx-auto max-w-[1000px]">
          {toast && (
            <div className="alert alert-success mb-4 shadow-lg" style={{ padding: '10px 16px' }}>
              <span>✅ {toast}</span>
            </div>
          )}

          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <button className="btn btn-ghost btn-sm -ml-2 text-gray-500" onClick={() => setView('units')}>← 返回课程序</button>
              <h1 className="text-xl font-extrabold text-gray-900 mt-1">{active.title} · {activeUnit.title}</h1>
              <p className="text-xs text-gray-400 mt-0.5">第三步 · 挂内容：生词表 + 渐进例句 + 素材</p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={saveUnit}>💾 保存课时内容</button>
          </div>

          {/* ① 生词表 */}
          <div className="card mt-4 border border-gray-200 bg-base-100 shadow-sm" style={{ borderRadius: 16 }}>
            <div className="card-body p-5">
              <h2 className="card-title text-base text-gray-900">① 本课生词表（每行：词 | 释义）</h2>
              <p className="text-xs text-gray-400 mt-0.5">AI 导入课时时已自动填入；可手动增删。</p>
              <textarea
                className="textarea textarea-bordered mt-3 w-full font-mono"
                rows={6}
                value={activeUnit.vocab || ''}
                onChange={e => patchUnit({ vocab: e.target.value })}
                placeholder={'дом | 房子\nмама | 妈妈\n...'}
              />
              <div className="mt-2 text-xs text-gray-400">已填 {((activeUnit.vocab || '').trim().split(/\r?\n/).filter(Boolean)).length} 个词条</div>
            </div>
          </div>

          {/* ② AI 生成渐进例句 */}
          <div className="card mt-4 border border-gray-200 bg-base-100 shadow-sm" style={{ borderRadius: 16 }}>
            <div className="card-body p-5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="card-title text-base text-gray-900">② 渐进例句（AI 生成）</h2>
                <button className="btn btn-primary btn-sm" onClick={genSentences} disabled={genning}>
                  {genning ? '生成中…' : '✨ AI 生成渐进例句'}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                每个生词至少 1 句、完整成分的长句（主谓宾+情景状语+时态），按句型家族渐进梯度生成，句数 = 词数 × 1.2（上限 120 句）。
              </p>

              {(!activeUnit.sentences || !activeUnit.sentences.length) ? (
                <p className="py-8 text-center text-sm text-gray-400">还没有例句。填好词表后点「✨ AI 生成渐进例句」。</p>
              ) : (
                <>
                  <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                    <span className="badge badge-success badge-sm">{activeUnit.sentences.length} 句</span>
                    <span className="badge badge-ghost badge-sm">{((activeUnit.words || []).length) || '-'} 词</span>
                  </div>
                  <div className="mt-3 space-y-2 max-h-[420px] overflow-y-auto pr-1">
                    {(activeUnit.sentences || []).map((s, i) => (
                      editSentIdx === i ? (
                        <div key={i} className="rounded-xl border border-primary/40 bg-primary/5 px-3 py-2">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-primary w-6 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                            <span className="text-xs font-semibold text-gray-600">编辑例句（手动修正中文 / 意群块）</span>
                          </div>
                          <input className="input input-bordered input-sm w-full text-sm mb-1.5" placeholder="俄语（ru）" value={editSent.ru} onChange={e => setEditSent({ ...editSent, ru: e.target.value })} />
                          <input className="input input-bordered input-sm w-full text-sm mb-1.5" placeholder="地道中文（chinese）" value={editSent.zh} onChange={e => setEditSent({ ...editSent, zh: e.target.value })} />
                          <input className="input input-bordered input-sm w-full font-mono text-xs mb-2" placeholder={'chunks JSON 数组，如 ["Кто это?"]（可留空 = 前端按本地规则切块）'} value={editSent.chunks} onChange={e => setEditSent({ ...editSent, chunks: e.target.value })} />
                          <div className="flex gap-2">
                            <button className="btn btn-primary btn-xs" onClick={saveEditSent}>保存</button>
                            <button className="btn btn-ghost btn-xs" onClick={cancelEditSent}>取消</button>
                          </div>
                        </div>
                      ) : (
                        <div key={i} className="flex items-start gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                          <span className="text-xs font-bold text-gray-400 w-6 shrink-0 pt-0.5">{String(i + 1).padStart(2, '0')}</span>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm text-gray-900">{s.ru}</div>
                            <div className="text-xs text-gray-400 mt-0.5">{s.chinese || s.zh || <span className="text-amber-600">（缺中文，请编辑或用 AI 修复）</span>}</div>
                            {Array.isArray(s.chunks) && s.chunks.length > 0 && (
                              <div className="text-[10px] text-gray-300 mt-0.5 font-mono">意群块：{s.chunks.join(' | ')}</div>
                            )}
                          </div>
                          <button className="btn btn-ghost btn-xs text-gray-500 shrink-0" onClick={() => startEditSent(i)}>编</button>
                          <button className="btn btn-error btn-xs btn-outline shrink-0" onClick={() => removeSentence(i)}>删</button>
                        </div>
                      )
                    ))}
                  </div>
                </>
              )}

              {/* 手动添加例句 */}
              <div className="mt-4 flex flex-col sm:flex-row gap-2">
                <input className="input input-bordered flex-1 text-sm" placeholder="俄语例句" value={newSentRu} onChange={e => setNewSentRu(e.target.value)} />
                <input className="input input-bordered flex-1 text-sm" placeholder="中文翻译" value={newSentZh} onChange={e => setNewSentZh(e.target.value)} />
                <button className="btn btn-outline btn-sm" onClick={addSentence}>+ 添加</button>
              </div>

              {/* 批量导入 JSON（AI 前置修复中文，前端只渲染固定数据） */}
              <div className="mt-4 rounded-xl border border-dashed border-gray-300 p-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-semibold text-gray-600">📋 批量导入 JSON（句子数组 / 滚动学习路径 / 对话）+ AI 修复中文（缺失/逐词硬拼）</span>
                  <button className="btn btn-outline btn-xs" onClick={importSentencesJson} disabled={jsonBusy}>
                    {jsonBusy ? 'AI 修复中…' : '导入并 AI 修复'}
                  </button>
                </div>
                <textarea
                  className="textarea textarea-bordered mt-2 w-full font-mono text-xs"
                  rows={3}
                  placeholder={'[{ "ru": "Кто это?", "zh": "谁这是？" }, { "ru": "Это дом.", "zh": "这是房子。" }]\n或滚动路径：{ "pathId": "path_01", "steps": [{ "stepIndex": 1, "russian": "Это", "chinese": "这", "newChunks": [{ "word": "Это", "translation": "这", "role": "主语" }], "allChunks": [] }] }\n说明：缺失中文 / 含俄语 / 明显逐词硬拼的句子自动交 AI 重译；滚动路径（连词成句滚雪球）与对话数据按原结构透传保存。'}
                  value={jsonText}
                  onChange={e => setJsonText(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* ③ 课时素材 */}
          <div className="card mt-4 border border-gray-200 bg-base-100 shadow-sm" style={{ borderRadius: 16 }}>
            <div className="card-body p-5">
              <h2 className="card-title text-base text-gray-900">③ 课时素材（视频 / 音频 / PDF）</h2>
              <input type="file" multiple accept=".pdf,.doc,.docx,.mp3,.mp4,audio/*,video/*" className="file-input file-input-bordered file-input-sm mt-2" onChange={onPickUnitMaterial} />
              {(activeUnit.materials || []).length === 0 ? (
                <p className="mt-3 text-sm text-gray-400">还没有素材。可挂本课的视频、音频、课件 PDF。</p>
              ) : (
                <ul className="mt-3 space-y-1">
                  {(activeUnit.materials || []).map((m, i) => (
                    <li key={i} className="flex items-center gap-2 rounded-lg bg-gray-50 px-2 py-1 text-xs text-gray-600">
                      <span className="badge badge-ghost badge-xs">{String(m.type).split('/').pop()}</span>
                      <span className="truncate flex-1">{m.name}</span>
                      <a href={m.url} target="_blank" rel="noreferrer" className="link link-primary">预览</a>
                      <button className="btn btn-ghost btn-xs text-gray-400" onClick={() => patchUnit({ materials: (activeUnit.materials || []).filter((_, j) => j !== i) })}>✕</button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4">
                <button className="btn btn-primary" onClick={saveUnit}>💾 保存课时内容</button>
              </div>
            </div>
          </div>
        </div>
      </main>
    )
  }

  // —— 视图二：课程序管理 ——
  if (view === 'units' && active) {
    return (
      <main className="min-h-full bg-base-100 px-6 py-7">
        <div className="mx-auto max-w-[1000px]">
          {toast && (
            <div className="alert alert-success mb-4 shadow-lg" style={{ padding: '10px 16px' }}>
              <span>✅ {toast}</span>
            </div>
          )}

          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <button className="btn btn-ghost btn-sm -ml-2 text-gray-500" onClick={() => setView('list')}>← 返回课程列表</button>
              <h1 className="text-xl font-extrabold text-gray-900 mt-1">{active.title}</h1>
              <p className="text-xs text-gray-400 mt-0.5">第二步 · 搭课程序：共 {units.length} 个课时</p>
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/game-mall')}>去商城查看 →</button>
          </div>

          {/* 课时列表 */}
          <div className="card mt-4 border border-gray-200 bg-base-100 shadow-sm" style={{ borderRadius: 16 }}>
            <div className="card-body p-5">
              <h2 className="card-title text-base text-gray-900">课时列表</h2>
              {units.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">还没有课时。手动添加，或用下方「AI 导入」把整本书切成课时。</p>
              ) : (
                <div className="space-y-2">
                  {units.map((u, i) => {
                    const hasContent = (u.sentences && u.sentences.length) || (u.materials && u.materials.length)
                    return (
                      <div key={u.id} className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
                        <span className="text-xs font-bold text-gray-400 w-6 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-800 truncate">{u.title}</span>
                            {u.imported && <span className="badge badge-info badge-xs shrink-0">AI导入</span>}
                            {hasContent && <span className="badge badge-success badge-xs shrink-0">已挂内容</span>}
                          </div>
                          {u.desc && <div className="text-xs text-gray-400 mt-0.5 truncate">{u.desc}</div>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button className="btn btn-primary btn-xs" onClick={() => openUnit(u)}>内容</button>
                          <button className="btn btn-ghost btn-xs" disabled={i === 0} onClick={() => moveUnit(i, -1)}>↑</button>
                          <button className="btn btn-ghost btn-xs" disabled={i === units.length - 1} onClick={() => moveUnit(i, 1)}>↓</button>
                          <button className="btn btn-error btn-xs btn-outline" onClick={() => removeUnit(i)}>删除</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 手动添加 */}
          <div className="card mt-4 border border-gray-200 bg-base-100 shadow-sm" style={{ borderRadius: 16 }}>
            <div className="card-body p-5">
              <h2 className="card-title text-base text-gray-900">手动添加课时</h2>
              <div className="flex gap-2 mt-2">
                <input
                  className="input input-bordered flex-1"
                  value={newUnitTitle}
                  onChange={e => setNewUnitTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addUnit() }}
                  placeholder={'课时标题，留空自动命名「第 ' + (units.length + 1) + ' 课」'}
                />
                <button className="btn btn-primary" onClick={addUnit}>+ 添加</button>
              </div>
            </div>
          </div>

          {/* AI 导入 */}
          <div className="card mt-4 border border-gray-200 bg-base-100 shadow-sm" style={{ borderRadius: 16 }}>
            <div className="card-body p-5">
              <h2 className="card-title text-base text-gray-900">✨ AI 导入课时（按「Урок N」自动切课）</h2>
              <p className="text-xs text-gray-400 mt-1">粘贴整本书/多课文本，后端按「Урок N · 课名」标题行切分，每课变成一个课时（追加到列表）。</p>
              <textarea
                className="textarea textarea-bordered mt-3 w-full"
                rows={4}
                value={importText}
                onChange={e => setImportText(e.target.value)}
                placeholder={'粘贴文本，例如：\nУрок 1 · 字母与问候\nдом | 房子\nмама | 妈妈\n...'}
              />
              <div className="mt-3 flex items-center gap-2">
                <button className="btn btn-primary" onClick={doImport} disabled={importing}>
                  {importing ? '切课中…' : '✨ 切课并导入'}
                </button>
                <span className="text-xs text-gray-400">导入后点课时行「内容」可编辑词表、AI 生成渐进例句、挂素材。</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    )
  }

  // —— 视图一：档案表单 + 课程列表 ——
  return (
    <main className="min-h-full bg-base-100 px-6 py-7">
      <div className="mx-auto max-w-[1100px]">
        <h1 className="text-2xl font-extrabold text-gray-900">课程包管理后台</h1>
        <p className="mt-1 text-sm text-gray-400">第一步：建课程档案 → 第二步：搭课程序 → 第三步：挂内容 → 第四步：发布</p>

        {toast && (
          <div className="alert alert-success mt-4 shadow-lg" style={{ padding: '10px 16px' }}>
            <span>✅ {toast}</span>
          </div>
        )}

        {/* ===== ① 课程档案表单 ===== */}
        <div className="card mt-5 border border-gray-200 bg-base-100 shadow-sm" style={{ borderRadius: 16 }}>
          <div className="card-body p-6">
            <h2 className="card-title text-base text-gray-900">
              {editingId ? '编辑课程档案' : '① 新建课程档案'}
              {editingId && <span className="badge badge-warning badge-sm ml-1">编辑中</span>}
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="form-control sm:col-span-2">
                <label className="label"><span className="label-text">课程标题 *</span></label>
                <input className="input input-bordered" value={form.title} onChange={e => setField('title', e.target.value)} placeholder="例如：走遍俄罗斯 · 第1课《字母与问候》" />
              </div>

              <div className="form-control sm:col-span-2">
                <label className="label">
                  <span className="label-text">课程简介</span>
                  <button type="button" className="btn btn-primary btn-xs" onClick={aiGenDesc} disabled={aiDescBusy}>
                    {aiDescBusy ? '生成中…' : '✨ AI 自动生成'}
                  </button>
                </label>
                <textarea className="textarea textarea-bordered" rows={5} value={form.subtitle} onChange={e => setField('subtitle', e.target.value)} placeholder="可手动填写一句话简介，或点击右上角「✨ AI 自动生成」生成：课程介绍 / 学习目标 / 适合谁学" />
              </div>

              <div className="form-control">
                <label className="label"><span className="label-text">封面图（本地预览）</span></label>
                <input type="file" accept="image/*" className="file-input file-input-bordered file-input-sm" onChange={onPickCover} />
                {form.coverUrl ? (
                  <img src={form.coverUrl} alt="封面预览" className="mt-2 h-32 w-full rounded-lg border border-gray-200 object-cover" />
                ) : (
                  <div className="mt-2 flex h-32 items-center justify-center rounded-lg border border-dashed border-gray-300 text-xs text-gray-400">未选择封面（发布后自动生成占位图）</div>
                )}
              </div>

              <div className="form-control">
                <label className="label"><span className="label-text">课件上传（PDF/Word/MP3/MP4）</span></label>
                <input type="file" multiple accept=".pdf,.doc,.docx,.mp3,.mp4,audio/*,video/*" className="file-input file-input-bordered file-input-sm" onChange={onPickMaterials} />
                {form.materials.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {form.materials.map((m, i) => (
                      <li key={i} className="flex items-center gap-2 rounded-lg bg-gray-50 px-2 py-1 text-xs text-gray-600">
                        <span className="badge badge-ghost badge-xs">{String(m.type).split('/').pop()}</span>
                        <span className="truncate flex-1">{m.name}</span>
                        <a href={m.url} target="_blank" rel="noreferrer" className="link link-primary">预览</a>
                        <button className="btn btn-ghost btn-xs text-gray-400" onClick={() => setForm(prev => ({ ...prev, materials: prev.materials.filter((_, j) => j !== i) }))}>✕</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="form-control">
                <label className="label"><span className="label-text">一级分类</span></label>
                <select className="select select-bordered" value={form.category} onChange={e => setField('category', e.target.value)}>
                  {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="form-control">
                <label className="label"><span className="label-text">难度</span></label>
                <select className="select select-bordered" value={form.difficulty} onChange={e => setField('difficulty', e.target.value)}>
                  {DIFFS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div className="form-control">
                <label className="label"><span className="label-text">年级</span></label>
                <select className="select select-bordered" value={form.grade} onChange={e => setField('grade', e.target.value)}>
                  {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>

              <div className="form-control">
                <label className="label"><span className="label-text">教材版本</span></label>
                <select className="select select-bordered" value={form.textbook} onChange={e => setField('textbook', e.target.value)}>
                  {TEXTBOOKS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div className="form-control">
                <label className="label"><span className="label-text">角标</span></label>
                <select className="select select-bordered" value={form.badge} onChange={e => setField('badge', e.target.value)}>
                  {BADGES.map(b => <option key={b} value={b}>{b === '' ? '无' : b}</option>)}
                </select>
              </div>

              <div className="form-control">
                <label className="label"><span className="label-text">课时数</span></label>
                <input type="number" min={1} className="input input-bordered" value={form.lessons} onChange={e => setField('lessons', e.target.value)} />
              </div>

              <div className="form-control">
                <label className="label"><span className="label-text">学习人数</span></label>
                <input type="number" min={0} className="input input-bordered" value={form.students} onChange={e => setField('students', e.target.value)} placeholder="默认 0" />
              </div>
            </div>

            {/* 二级标签多选（按一级分类联动） */}
            <div className="form-control mt-3">
              <label className="label"><span className="label-text">二级标签（{form.category}）：{TAG_POOL[form.category]?.length || 0} 个可选，多选</span></label>
              <div className="flex flex-wrap gap-2">
                {(TAG_POOL[form.category] || []).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTag(t)}
                    className={`badge badge-lg cursor-pointer transition-colors ${form.tags.includes(t) ? 'badge-primary' : 'badge-ghost'}`}
                    style={{ padding: '8px 12px' }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3 flex-wrap">
              <button className="btn btn-primary" onClick={saveDraft}>💾 保存草稿</button>
              <button className="btn btn-outline" onClick={publish}>🚀 发布上架</button>
              <button className="btn btn-ghost" onClick={() => { setForm(emptyForm()); setEditingId(''); flash('表单已清空') }}>清空表单</button>
              <button className="btn btn-outline btn-sm ml-auto" onClick={() => navigate('/game-mall')}>去商城查看 →</button>
            </div>
            <div className="mt-3 text-xs text-gray-400">
              💡 第一步只建「课程档案」：保存草稿后不会出现在商城；保存后点下方列表的「搭课程序」进入第二步。
            </div>
          </div>
        </div>

        {/* ===== ①.5 全网可见 · 云端同步 ===== */}
        <div className="card mt-6 border border-gray-200 bg-base-100 shadow-sm" style={{ borderRadius: 16 }}>
          <div className="card-body p-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="card-title text-base text-gray-900">🌐 全网可见 · 同步到云端</h2>
              <span className="text-xs text-gray-400">后台课程目前只存在你的浏览器；同步后所有访客可见、可学</span>
            </div>
            <div className="mt-3 flex flex-col sm:flex-row items-center gap-2">
              <input
                type="password"
                className="input input-bordered input-sm flex-1"
                placeholder="管理员密钥（与投稿弹窗同一把密钥）"
                value={adminInput}
                onChange={e => setAdminInput(e.target.value)}
              />
              <div className="flex gap-2">
                <button className="btn btn-sm btn-outline" onClick={doAdminLogin} disabled={cloudBusy}>{adminKey ? '已登录 ✓' : '登录'}</button>
                <button className="btn btn-sm btn-primary" onClick={syncToCloud} disabled={cloudBusy || !adminKey}>
                  {cloudBusy ? '同步中…' : '🚀 同步到云端'}
                </button>
                {adminKey && <button className="btn btn-sm btn-ghost" onClick={() => { logout(); setAdminInput(''); setCloudMsg('已退出管理员') }}>退出</button>}
              </div>
            </div>
            {cloudMsg && <div className="mt-3 text-sm text-gray-600">{cloudMsg}</div>}
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
              <span className="text-xs text-gray-500">课程数据迁移（换浏览器/正式站时使用）：</span>
              <button className="btn btn-xs btn-outline" onClick={exportCourses}>📤 导出课程数据</button>
              <label className="btn btn-xs btn-outline cursor-pointer">
                📥 导入课程数据
                <input type="file" accept=".json,application/json" className="hidden" onChange={e => { importCoursesFile(e.target.files && e.target.files[0]); e.target.value = '' }} />
              </label>
            </div>
            {cloudCount >= 0 && <div className="mt-2 text-xs text-gray-400">云端名单共 {cloudCount} 项（视频 + 课程）</div>}
            <div className="mt-3 text-xs text-gray-400">
              提示：只有「已发布」状态的课程会同步；草稿不会上云。同步前请确保密钥与后端 ADMIN_KEY 一致。
            </div>
          </div>
        </div>

        {/* ===== ② 已有课程列表 ===== */}
        <div className="card mt-6 border border-gray-200 bg-base-100 shadow-sm" style={{ borderRadius: 16 }}>
          <div className="card-body p-6">
            <h2 className="card-title text-base text-gray-900">已有课程（{courses.length}）</h2>
            {courses.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">还没有课程，先填上面表单保存一个草稿试试。</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table table-zebra table-sm">
                  <thead>
                    <tr className="text-xs text-gray-400">
                      <th>状态</th><th>封面</th><th>标题</th><th>分类</th><th>课时</th><th>大纲</th><th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courses.map(c => (
                      <tr key={c.id}>
                        <td>
                          {c.status === 'published' || !c.status
                            ? <span className="badge badge-success badge-sm">已发布</span>
                            : <span className="badge badge-warning badge-sm">草稿</span>}
                          {c.cloudSynced && <span className="badge badge-info badge-sm ml-1">云端</span>}
                        </td>
                        <td>
                          <img src={c.cover} alt="" className="h-10 w-16 rounded object-cover"
                            onError={e => { e.currentTarget.style.visibility = 'hidden' }} />
                        </td>
                        <td className="font-medium text-gray-800">
                          <div className="line-clamp-1">{c.title}</div>
                          <div className="text-[11px] text-gray-400">{c.subtitle || '—'}</div>
                        </td>
                        <td className="text-xs">{c.category}</td>
                        <td className="text-xs">{Array.isArray(c.units) && c.units.length ? c.units.length + ' 课' : (c.lessons || 0) + ' 课'}</td>
                        <td className="text-xs">
                          {Array.isArray(c.units) && c.units.length
                            ? <span className="badge badge-success badge-sm">已搭大纲</span>
                            : <span className="badge badge-ghost badge-sm">未搭</span>}
                        </td>
                        <td>
                          <div className="flex gap-1">
                            <button className="btn btn-primary btn-xs" onClick={() => manageUnits(c)}>搭课程序</button>
                            <button className="btn btn-outline btn-xs" onClick={() => navigate(`/admin/lessons/${c.id}`)}>管理大纲</button>
                            <button className="btn btn-ghost btn-xs" onClick={() => edit(c)}>编辑</button>
                            <button className="btn btn-error btn-xs btn-outline" onClick={() => remove(c.id)}>删除</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
