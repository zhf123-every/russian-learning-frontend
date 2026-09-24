import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCourses, saveCourses, deleteCourse } from '../utils/storage'
import { GRADES, TEXTBOOKS } from '../data/gameMallData'

// ===== 站长专属后台 · 课程包管理（第一步：课程档案 · 草稿/已发布） =====

// 一级分类（与商城/投稿分类体系一致）
const CATS = ['教材同步', '考试备考', '少儿俄语', '基础俄语', '场景俄语', '阅读听力', '影视俄语', '音乐俄语']
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
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState('')       // 非空 = 正在编辑某条档案
  const [courses, setCourses] = useState([])
  const [toast, setToast] = useState('')

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
      units: [], // 第二步「课程序」再填充
      status,
      updatedAt: now,
    }
    return base
  }

  // 保存草稿（第一步核心：先建档案，不上架）
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

  // 直接发布上架（第四步会改成「审核发布」流程）
  const publish = () => {
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
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // 删除课程
  const remove = (id) => {
    deleteCourse(id)
    refresh()
  }

  return (
    <main className="min-h-full bg-base-100 px-6 py-7">
      <div className="mx-auto max-w-[1100px]">
        <h1 className="text-2xl font-extrabold text-gray-900">课程包管理后台</h1>
        <p className="mt-1 text-sm text-gray-400">第一步：建课程档案（草稿）→ 第二步搭课程序 → 第三步挂内容 → 第四步发布</p>

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
                <label className="label"><span className="label-text">课程简介</span></label>
                <textarea className="textarea textarea-bordered" rows={2} value={form.subtitle} onChange={e => setField('subtitle', e.target.value)} placeholder="一句话简介，如：第1-15课 · 语音基础与日常会话" />
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
              💡 第一步只建「课程档案」：保存草稿后不会出现在商城，可随时回来「编辑」继续完善；搭课程序在下一步做。
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
                      <th>状态</th><th>封面</th><th>标题</th><th>分类</th><th>年级</th><th>教材</th><th>课时</th><th>标签</th><th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courses.map(c => (
                      <tr key={c.id}>
                        <td>
                          {c.status === 'published' || !c.status
                            ? <span className="badge badge-success badge-sm">已发布</span>
                            : <span className="badge badge-warning badge-sm">草稿</span>}
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
                        <td className="text-xs">{c.grade}</td>
                        <td className="text-xs">{c.textbook}</td>
                        <td className="text-xs">{c.lessons} 课</td>
                        <td className="text-xs">
                          <div className="flex max-w-[160px] flex-wrap gap-1">
                            {(c.tags || []).map(t => <span key={t} className="badge badge-outline badge-xs">{t}</span>)}
                          </div>
                        </td>
                        <td>
                          <div className="flex gap-1">
                            <button className="btn btn-primary btn-xs btn-outline" onClick={() => edit(c)}>编辑</button>
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
