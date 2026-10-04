// AdminCourseNew.jsx —— 新建/编辑课程档案页（/admin/courses/new）
// 从 AdminDashboard 拆出的独立表单页：字段、保存/发布逻辑与原版完全一致。
// 保存/发布/取消 → 返回课程管理列表页（/admin）。
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getCourses, saveCourses } from '../utils/storage'
import { GRADES, TEXTBOOKS } from '../data/gameMallData'
import { apiFetch } from '../lib/api'
import { localInputToTs, tsToLocalInput } from '../utils/courseSchedule'
import { chat } from '../lib/ai'
import { useAdminStore } from '../store/adminStore'

// —— 与原 AdminDashboard 相同的常量 ——
const CATS = ['教材同步', '考试备考', '少儿俄语', '基础俄语', '语法专项', '场景俄语', '阅读听力', '影视俄语', '音乐俄语']
const BADGES = ['', '精选', '热销', '新', '备考', '衔接']
const DIFFS = ['入门', '初级', '中级', '高级']
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
  textbook: '', // 教材版本：默认不选，避免未选时被 AI 误当事实引用
  difficulty: '入门',
  badge: '',
  lessons: 0,
  students: 0,
  tags: [],
  coverUrl: '',
  cover: '', // 封面上传 B2 后的持久地址（b2:// 或 dataURL 待上传）
  coverName: '',
  materials: [], // { name, type, url }
  scheduledPublishAt: '', // 定时上架（datetime-local 字符串，空=立即上架）
  scheduledUnpublishAt: '', // 定时下架（datetime-local 字符串，空=永不下架）
})

export default function AdminCourseNew() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isLoggedIn, authBody } = useAdminStore()
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState('')    // 非空 = 编辑模式（?edit=id 进入）
  const [toast, setToast] = useState('')
  const [aiDescBusy, setAiDescBusy] = useState(false)
  const [cloudBusy, setCloudBusy] = useState(false)

  // 编辑模式：按 ?edit=id 读取课程档案预填表单
  useEffect(() => {
    const id = searchParams.get('edit')
    if (!id) return
    const c = getCourses().find(x => x.id === id)
    if (!c) return
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
      cover: c.cover || '',
      coverName: '',
      materials: c.materials || [],
      scheduledPublishAt: tsToLocalInput(c.scheduledPublishAt),
      scheduledUnpublishAt: tsToLocalInput(c.scheduledUnpublishAt),
    })
    setEditingId(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // P1-C：后端分类树（一级分类/二级标签动态化；失败回退静态 CATS/TAG_POOL）
  const [dbCats, setDbCats] = useState(null)
  useEffect(() => {
    let alive = true
    apiFetch('/api/categories/tree', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      timeout: 15000,
    }).then(r => r.json()).then(j => {
      if (!alive) return
      if (j.ok && Array.isArray(j.tree) && j.tree.length) setDbCats(j.tree)
    }).catch(() => { /* 后端不可用：保持静态分类 */ })
    return () => { alive = false }
  }, [])
  const catOptions = dbCats ? dbCats.map(c => c.name) : CATS
  const tagPoolFor = (cat) => (dbCats ? (dbCats.find(c => c.name === cat) || {}).subs || [] : (TAG_POOL[cat] || [])).filter(t => t !== '全部')

  const setField = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  // 提示（2.5 秒自动消失）
  const flash = (msg) => {
    setToast(msg)
    window.setTimeout(() => setToast(''), 3000)
  }

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
            '4. 教材信息仅供你参考，是否提及由你判断：只有当它与课程标题明显一致时才可提及教材名；\n' +
            '   绝对禁止编造、臆测或沿用与课程标题无关的教材名（如标题是"东方俄语"，简介里不得出现"走遍俄罗斯"）。\n' +
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

  // 封面图：文件 → dataURL（本地预览 + 待保存/发布时上传 B2 持久化，避免 blob 临时链接刷新失效）
  const applyCoverFile = async (f) => {
    if (!f) return
    const dataUrl = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f) })
    setForm(prev => ({ ...prev, coverUrl: dataUrl, cover: dataUrl, coverName: f.name }))
    flash('封面已选择：保存或发布时自动上传云端（全网可见）')
  }
  const onPickCover = (e) => { applyCoverFile(e.target.files && e.target.files[0]) }
  const onCoverDrop = (e) => { e.preventDefault(); e.stopPropagation(); applyCoverFile(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) }

  // 封面 dataURL → 上传 B2（thumbs 目录）→ 返回 b2:// URL；失败返回 ''（用占位图兜底）
  const uploadCoverToB2 = async (dataUrl) => {
    try {
      if (!isLoggedIn) return ''
      const pr = await apiFetch('/api/upload/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authBody({ filename: 'cover_' + Date.now() + '.jpg', kind: 'image', contentType: 'image/jpeg' }))
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

  // 保存/发布前解析封面：dataURL → 上传 B2 拿持久地址；已持久化（b2:// 或 http）原样返回
  const resolveCover = async () => {
    const raw = form.cover || form.coverUrl || ''
    if (String(raw).startsWith('data:')) {
      const b2 = await uploadCoverToB2(raw)
      return b2 || raw
    }
    return raw
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
  const buildCourse = (status, coverOverride) => {
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
      cover: coverOverride || form.coverUrl || 'https://picsum.photos/seed/course_' + now + '/400/280',
      materials: form.materials,
      isGrammar: form.category === '语法专项', // 一级分类为「语法专项」即语法课程（点亮变格天赋树）
      units: [], // 第二步「课程序」填充
      status,
      scheduledPublishAt: localInputToTs(form.scheduledPublishAt), // 定时上架（undefined=立即）
      scheduledUnpublishAt: localInputToTs(form.scheduledUnpublishAt), // 定时下架（undefined=永不下架）
      updatedAt: now,
    }
    return base
  }

  // ========== 全网可见：后台课程同步到云端（B2 videos/index.json，访客 GET /api/videos/list 可读） ==========
  // （从 AdminDashboard 原样迁移；发布后自动同步，保证商城立即可见）
  const syncToCloud = async () => {
    if (cloudBusy) return
    if (!isLoggedIn) { flash('请先登录后台'); return }
    const localPub = getCourses().filter(c => c.status !== 'draft')
    if (!localPub.length) { flash('没有已发布的课程可同步'); return }
    setCloudBusy(true)
    flash('同步中…')
    try {
      // 1) 现有云端名单（含投稿视频/投稿课程）
      let cloud = []
      try {
        const r = await apiFetch('/api/videos/list', { timeout: 60000 })
        const j = await r.json()
        if (j.ok && Array.isArray(j.videos)) cloud = j.videos
      } catch (e) { /* 读不到就当空 */ }
      // 2) 后台已发布课程 → 云端对象（带 units 课时内容），与投稿课程同结构（kind='course'）
      const localObj = localPub.map(c => ({
        ...c,
        kind: 'course',
        src: 'admin', // 后台发布课程标记：商城仅展示 src=admin 的课程（投稿课程不展示）
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
      // 4) 全量写回 B2（数据量大 + 冷启动，放宽到 120s，避免 12s 默认超时被 abort）
      const sr = await apiFetch('/api/videos/sync', {
        method: 'POST',
        timeout: 120000,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authBody({ videos: merged })),
      })
      const sj = await sr.json()
      if (sj.ok) {
        // 打标 cloudSynced
        const list = getCourses().map(c => localObj.some(x => x.id === c.id) ? { ...c, cloudSynced: true } : c)
        saveCourses(list)
        flash('✅ 已同步 ' + localObj.length + ' 门课程到云端，访客可公开访问（名单共 ' + merged.length + ' 项）')
      } else {
        flash('同步失败：' + (sj.error || '未知错误'))
      }
    } catch (e) {
      if (e && e.name === 'AbortError') {
        flash('⚠️ 同步超时被中止：后端冷启动或数据量较大，请稍等 1 分钟后重试')
      } else {
        flash('同步失败：' + ((e && e.message) || '网络错误'))
      }
    }
    setCloudBusy(false)
  }

  // 保存草稿
  const saveDraft = async () => {
    const coverResolved = await resolveCover()
    const base = buildCourse('draft', coverResolved)
    if (!base) return
    const list = getCourses()
    if (editingId) {
      const i = list.findIndex(c => c.id === editingId)
      if (i >= 0) list[i] = { ...list[i], ...base, units: Array.isArray(list[i].units) ? list[i].units : [], id: editingId }
      flash('草稿已更新')
    } else {
      base.id = 'course_' + Date.now()
      base.createdAt = Date.now()
      list.push(base)
      flash('课程档案已保存（草稿），下一步搭课程序')
    }
    if (!saveCourses(list)) { flash('保存失败：浏览器存储不可用'); return }
    navigate('/admin') // 保存成功 → 回课程列表页
  }

  // 直接发布上架（发布后自动同步到云端，全网可见，游戏商城页/商城立即可见）
  const publish = async () => {
    const coverResolved = await resolveCover()
    const base = buildCourse('published', coverResolved)
    if (!base) return
    const list = getCourses()
    if (editingId) {
      const i = list.findIndex(c => c.id === editingId)
      if (i >= 0) list[i] = { ...list[i], ...base, units: Array.isArray(list[i].units) ? list[i].units : [], id: editingId }
      flash('已更新并发布上架！')
    } else {
      base.id = 'course_' + Date.now()
      base.createdAt = Date.now()
      list.push(base)
      flash('已发布上架！共 ' + list.length + ' 个课程')
    }
    if (!saveCourses(list)) { flash('保存失败：浏览器存储不可用'); return }
    // 发布即全网可见：自动同步到云端（需已登录管理员）
    await syncToCloud()
    navigate('/admin') // 发布成功 → 回课程列表页
  }

  return (
    <div className="mx-auto max-w-[900px]">
      <h1 className="text-2xl font-extrabold text-gray-900">📚 {editingId ? '编辑课程档案' : '新建课程档案'}</h1>
      <p className="mt-1 text-sm text-gray-400">第一步：建课程档案 → 第二步：搭课程序 → 第三步：挂内容 → 第四步：发布</p>

      {toast && (
        <div className="alert alert-success mt-4 shadow-lg" style={{ padding: '10px 16px' }}>
          <span>✅ {toast}</span>
        </div>
      )}

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
              <label className="label"><span className="label-text">封面图（可点击选择或拖拽图片到下方区域）</span></label>
              <input type="file" accept="image/*" className="file-input file-input-bordered file-input-sm" onChange={onPickCover} />
              <div
                className="group mt-2 h-32 w-full cursor-pointer overflow-hidden rounded-lg border border-gray-200 transition-colors hover:border-primary"
                onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
                onDrop={onCoverDrop}
                onClick={() => document.querySelector('#admin-cover-picker')?.click()}
              >
                <input id="admin-cover-picker" type="file" accept="image/*" className="hidden" onChange={onPickCover} />
                {form.coverUrl ? (
                  <img src={form.coverUrl} alt="封面预览" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center border border-dashed border-gray-300 text-xs text-gray-400 group-hover:border-primary group-hover:text-primary">点击选择 或 拖拽图片到此处</div>
                )}
              </div>
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
                {catOptions.map(c => <option key={c} value={c}>{c}</option>)}
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
                <option value="">（未选择）</option>
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
              <label className="label"><span className="label-text">定时上架（留空 = 保存/发布后立即上架）</span></label>
              <input type="datetime-local" className="input input-bordered" value={form.scheduledPublishAt} onChange={e => setField('scheduledPublishAt', e.target.value)} />
            </div>

            <div className="form-control">
              <label className="label"><span className="label-text">定时下架（留空 = 永不下架）</span></label>
              <input type="datetime-local" className="input input-bordered" value={form.scheduledUnpublishAt} onChange={e => setField('scheduledUnpublishAt', e.target.value)} />
            </div>

          </div>

          {/* 二级标签多选（按一级分类联动；动态分类树优先） */}
          <div className="form-control mt-3">
            <label className="label"><span className="label-text">二级标签（{form.category}）：{tagPoolFor(form.category).length} 个可选，多选</span></label>
            <div className="flex flex-wrap gap-2">
              {tagPoolFor(form.category).map(t => (
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
            <button className="btn btn-outline btn-sm ml-auto" onClick={() => navigate('/admin')}>← 取消，返回列表</button>
          </div>
          <div className="mt-3 text-xs text-gray-400">
            💡 第一步只建「课程档案」：保存草稿后不会出现在商城；保存后回列表点「搭课程序」进入第二步。
          </div>
        </div>
      </div>
    </div>
  )
}
