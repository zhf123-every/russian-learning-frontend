import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getCourses, saveCourses, deleteCourse } from '../utils/storage'
import { API_BASE, apiFetch } from '../lib/api'
import { courseStatus, statusLabel, fmtSchedule } from '../utils/courseSchedule'
import { saveCourseVersion, listCourseVersions, getCourseVersion, clearCourseVersions, rollbackCourse } from '../utils/courseVersions'
import { parseAIJSON, chat } from '../lib/ai'
import { generateKnowledge } from '../lib/knowledge'
import { withRetry403 } from '../lib/segmentEngine'
import { resolvePlayUrl } from '../lib/playUrl'
import { collectUnitSentenceObjs } from '../lib/unitSentences'
import { triggerUnitSegments, retryPendingSegments } from '../lib/segmentTrigger'
import { triggerUnitSlotTables, retryPendingSlotTables } from '../lib/slotTablesTrigger'
import { useAdminStore } from '../store/adminStore'

// ===== 站长专属后台 · 课程包管理（第三步：课程档案 + 课程序 + 课时内容） =====

// —— 后台课程封面：b2:// 云端封面异步解析为预签名可显示链接（<img> 不认 b2:// 协议） ——
function AdminCourseCover({ src, className }) {
  const [url, setUrl] = useState(() => (src && !String(src).startsWith("b2://") ? src : ""));
  useEffect(() => {
    let alive = true;
    const s = String(src || "");
    if (s.startsWith("b2://")) {
      resolvePlayUrl(s).then((u) => { if (alive && u && u !== s) setUrl(u); }).catch(() => { /* 解析失败留空，不显示 */ });
    } else {
      setUrl(s);
    }
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);
  if (!url) return null;
  return <img src={url} alt="" className={className} onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />;
}

// —— P0 登录门禁：未登录（无账号 token、无旧密钥）时显示登录/注册卡片 ——
function AdminLoginGate() {
  const { loginPassword, register, login } = useAdminStore()
  const [tab, setTab] = useState('login')        // login | register
  const [showKey, setShowKey] = useState(false)  // 折叠区：旧密钥登录
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [key, setKey] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (busy) return
    setBusy(true)
    setMsg('')
    const res = tab === 'login'
      ? await loginPassword(username, password)
      : await register(username, password, nickname)
    setBusy(false)
    if (!res.ok) { setMsg(res.error || '操作失败'); return }
    if (res.isFirstAdmin) setMsg('🎉 你是第一个注册的用户，已自动设为管理员！')
    // 成功后 isLoggedIn 变 true，父组件自动进入后台
  }

  const submitKey = async () => {
    if (busy) return
    setBusy(true)
    setMsg('')
    const ok = await login(key)
    setBusy(false)
    if (!ok) setMsg('密钥无效，请检查')
  }

  return (
    <main className="min-h-full bg-base-100 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-[420px]">
        <div className="card border border-gray-200 bg-base-100 shadow-sm" style={{ borderRadius: 20 }}>
          <div className="card-body p-8">
            <h1 className="text-xl font-extrabold text-gray-900">课程包管理后台</h1>
            <p className="mt-1 text-sm text-gray-400">登录后管理课程档案、课时内容与云端发布</p>

            <div className="mt-5 tabs tabs-boxed justify-start">
              <button className={`tab ${tab === 'login' ? 'tab-active' : ''}`} onClick={() => { setTab('login'); setMsg('') }}>登录</button>
              <button className={`tab ${tab === 'register' ? 'tab-active' : ''}`} onClick={() => { setTab('register'); setMsg('') }}>注册</button>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              <input
                className="input input-bordered"
                placeholder="用户名"
                value={username}
                onChange={e => setUsername(e.target.value)}
              />
              <input
                type="password"
                className="input input-bordered"
                placeholder="密码（至少 6 位）"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              {tab === 'register' && (
                <input
                  className="input input-bordered"
                  placeholder="昵称（可选）"
                  value={nickname}
                  onChange={e => setNickname(e.target.value)}
                />
              )}
              <button className="btn btn-primary" onClick={submit} disabled={busy}>
                {busy ? '处理中…' : (tab === 'login' ? '登录' : '注册并登录')}
              </button>
              {msg && <div className="text-sm text-gray-600">{msg}</div>}
            </div>

            <div className="mt-5 border-t border-gray-100 pt-4">
              <button className="text-xs text-gray-400 underline" onClick={() => setShowKey(v => !v)}>
                {showKey ? '收起' : '使用旧管理员密钥登录'}
              </button>
              {showKey && (
                <div className="mt-3 flex flex-col gap-2">
                  <input
                    type="password"
                    className="input input-bordered input-sm"
                    placeholder="管理员密钥（ADMIN_KEY）"
                    value={key}
                    onChange={e => setKey(e.target.value)}
                  />
                  <button className="btn btn-sm btn-outline" onClick={submitKey} disabled={busy}>密钥登录</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

// 课程档案表单（新建/编辑）已拆分为独立页：/admin/courses/new（见 src/pages/AdminCourseNew.jsx）
// 本页只保留课程列表 + 课程序 + 课时内容管理。

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  // 全局搜索（顶部栏传入 ?q=）与「同步云端」提示（?sync=1）
  const q = (searchParams.get('q') || '').trim().toLowerCase()
  const syncFlag = searchParams.get('sync')
  const [view, setView] = useState('list')          // list=档案列表 | units=课程序 | unit=课时内容
  const [courses, setCourses] = useState([])
  const [toast, setToast] = useState('')
  const [saveBanner, setSaveBanner] = useState(null) // 保存课时后的成功横幅 + 下一步引导
  const [kpState, setKpState] = useState(null)       // 一键生成本课知识点进度 { done, total, cur }
  const [newGenTaskId, setNewGenTaskId] = useState(null)  // 新引擎生成任务ID
  const [newGenBusy, setNewGenBusy] = useState(false)    // 新引擎生成中
  const [newGenMsg, setNewGenMsg] = useState('')         // 新引擎提示信息
  // —— 唯一上传入口：批量粘贴句子（每行：俄语 || 中文）——
  const [batchSentText, setBatchSentText] = useState('')

  // —— 云端同步状态 ——
  const { adminKey, token, user, loginPassword, register, logout, authBody } = useAdminStore()
  // isLoggedIn 每次渲染实时计算（不能用 store 对象 getter：zustand set 会用 Object.assign 合并，
  // 把 getter 求值一次后固化成旧布尔值，登录后不会更新导致永远停在登录卡片）
  const isLoggedIn = !!((token && user && (user.role === 'admin' || user.role === 'editor' || user.role === 'viewer')) || adminKey)
  const [cloudBusy, setCloudBusy] = useState(false)
  const [cloudMsg, setCloudMsg] = useState('')
  const [cloudCount, setCloudCount] = useState(-1)

  // 顶部栏「同步云端」跳转入口：带 ?sync=1 → 提示在下方同步区操作，并清除参数
  useEffect(() => {
    if (syncFlag) {
      setCloudMsg('请在下方「同步到云端」区域点击「🚀 同步到云端」按钮')
      setSearchParams({}, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncFlag])

  // P2-A：语块生成请求器——403（TiDB 冷启动）自动重试 1 次；POST 带 authBody 鉴权，GET 不带 body
  // 超时放宽到 120s：plan/词池/llm-segment 都要调 AI（glm-4-plus 慢 + Render 冷启动），默认 12s 会被 abort
  const segHttpPost = withRetry403((path, body) =>
    apiFetch(path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(authBody(body)), timeout: 120000 })
  )

  // —— 课程序管理状态 ——
  const [active, setActive] = useState(null)        // 当前管理课程序的课程
  const [units, setUnits] = useState([])            // 该课程的课时
  const [newUnitTitle, setNewUnitTitle] = useState('')

  // —— 课时内容管理状态 ——
  const [activeUnit, setActiveUnit] = useState(null) // 当前编辑内容的课时
  const [newSentRu, setNewSentRu] = useState('')
  const [newSentZh, setNewSentZh] = useState('')
  const [editSentIdx, setEditSentIdx] = useState(-1)      // 正在行内编辑的例句下标（-1=未编辑）
  const [editSent, setEditSent] = useState({ ru: '', zh: '', chunks: '' })
  const [aiUnitTitleBusy, setAiUnitTitleBusy] = useState(false) // AI 生成课时名（手动添加表单）
  const [aiRenameBusy, setAiRenameBusy] = useState(null)  // AI 重命名课时列表中的行 index

  // —— AI 生成课时标题（手动添加课时表单：基于课程标题推导主题名）——
  const aiGenUnitTitle = async () => {
    const courseTitle = (active && active.title || '').trim()
    if (!courseTitle) { flash('请先进入课程序，再生成课时名'); return }
    setAiUnitTitleBusy(true)
    try {
      const content = await chat({
        messages: [
          { role: 'system', content: '你是俄语教学课程设计师，擅长为课时起简洁贴切的中文主题名。' },
          { role: 'user', content:
            `请为课程「${courseTitle}」的第 ${units.length + 1} 课生成一个课时标题（中文）。\n\n` +
            '要求：\n1. 标题体现本课学习主题（如“基础俄语句子学习”“介绍我的家人”“认识新朋友”“我的房间”），不要使用“第X课”编号；\n' +
            '2. 长度 6-10 个汉字；\n3. 面向零基础俄语学习者，积极、易懂、口语化；\n4. 只输出标题文本本身，不要任何解释、引号或多余内容。' },
        ],
      })
      const text = String(content || '').trim().replace(/^["「『]|["」』]$/g, '')
      if (!text) { flash('⚠️ AI 生成结果异常，请重试'); return }
      setNewUnitTitle(text)
      flash('✅ 已生成课时名，可微调后点击「+ 添加」')
    } catch (e) {
      flash('⚠️ AI 接口暂不可用：' + (e.message || '请稍后重试'))
    } finally {
      setAiUnitTitleBusy(false)
    }
  }

  // —— AI 根据课时内容重命名（课时列表每行：读取本课句子/词汇/路径概要）——
  const aiRenameUnit = async (idx) => {
    const u = units[idx]
    if (!u) return
    setAiRenameBusy(idx)
    try {
      const parts = []
      if (Array.isArray(u.sentences) && u.sentences.length) {
        parts.push('例句：' + u.sentences.slice(0, 5).map(s => (s.ru || '') + (s.zh ? '(' + s.zh + ')' : '')).join('；'))
      }
      if (Array.isArray(u.words) && u.words.length) {
        parts.push('词汇：' + u.words.slice(0, 10).map(w => w.ru || w.word || '').join('、'))
      }
      const summary = parts.join('\n') || '（本课时暂无内容）'
      const content = await chat({
        messages: [
          { role: 'system', content: '你是俄语教学课程设计师，擅长为课时起简洁贴切的中文主题名。' },
          { role: 'user', content:
            '根据本课的内容概要，为本课生成一个简洁贴切的课程标题（中文）。\n\n' +
            '要求：\n1. 标题体现本课学习主题（如“基础俄语句子学习”“介绍我的家人”“认识新朋友”“我的房间”），不要使用“第X课”编号；\n' +
            '2. 长度 6-10 个汉字；\n3. 面向零基础俄语学习者，积极、易懂、口语化；\n4. 只输出标题文本本身，不要任何解释、引号或多余内容。\n\n' +
            `本课内容概要：\n${summary}` },
        ],
      })
      const text = String(content || '').trim().replace(/^["「『]|["」』]$/g, '')
      if (!text) { flash('⚠️ AI 生成结果异常，请重试'); return }
      const next = [...units]
      next[idx] = { ...u, title: text }
      persistUnits(next)
      flash(`✅ 已将本课重命名为《${text}》`)
    } catch (e) {
      flash('⚠️ AI 接口暂不可用：' + (e.message || '请稍后重试'))
    } finally {
      setAiRenameBusy(null)
    }
  }



  // 刷新课程列表
  const refresh = () => setCourses(getCourses())
  useEffect(() => { refresh() }, [])

  // 全局搜索过滤（顶部栏 ?q=）：匹配课程标题或简介
  const filteredCourses = q
    ? courses.filter(c => ((c.title || '') + ' ' + (c.subtitle || '')).toLowerCase().includes(q))
    : courses

  // 提示（2.5 秒自动消失）
  const flash = (msg) => {
    setToast(msg)
    window.setTimeout(() => setToast(''), 3000)
  }

  // 从云端删除该课程（商城/前端读云端名单，删除必须同步云端才会生效）
  const removeFromCloud = async (id) => {
    if (!isLoggedIn) { flash('请先登录后台，才能删除云端课程'); return false }
    setCloudBusy(true)
    setCloudMsg('正在从云端删除…')
    try {
      const r = await apiFetch('/api/videos/list')
      const j = await r.json()
      if (!j.ok || !Array.isArray(j.videos)) { setCloudMsg('读取云端列表失败，请重试'); setCloudBusy(false); return false }
      const next = j.videos.filter(v => !(v.kind === 'course' && v.id === id))
      const sr = await apiFetch('/api/videos/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authBody({ videos: next })),
      })
      const sj = await sr.json()
      if (sj.ok) {
        setCloudCount(next.length)
        setCloudMsg('✅ 已从云端删除该课程，商城已同步')
        setCloudBusy(false)
        return true
      }
      setCloudMsg('云端删除失败：' + (sj.error || '未知错误'))
      setCloudBusy(false)
      return false
    } catch (e) {
      setCloudMsg('云端删除失败：' + (e.message || '网络错误'))
      setCloudBusy(false)
      return false
    }
  }

  // 删除课程：已发布课程需先删云端（保证商城同步），再删本地
  const remove = async (id) => {
    const c = getCourses().find(x => x.id === id)
    if (!c) return
    const cloudNote = c.status !== 'draft' ? '（已发布课程会同时从云端/商城移除）' : ''
    if (!window.confirm(`确定删除课程《${c.title}》吗？${cloudNote}此操作不可恢复。`)) return
    if (c.status !== 'draft') {
      if (!isLoggedIn) {
        flash('⚠️ 该课程已发布到云端：请先登录后台，删除后商城才会同步')
        return
      }
      const ok = await removeFromCloud(id)
      if (!ok) return // 云端删除失败则中止，避免本地删了商城还显示
    }
    deleteCourse(id)
    clearCourseVersions(id) // 清掉该课程的版本历史
    refresh()
    flash('课程已删除（本地 + 云端）')
  }

  // 清空商城课程：移除云端名单中所有 kind='course'（投稿视频等非课程项保留）
  const clearStoreCourses = async () => {
    if (!isLoggedIn) { setCloudMsg('请先登录后台'); return }
    if (!window.confirm('确定清空游戏商城里的所有课程吗？\n云端课程将全部移除（投稿视频/非课程内容保留），此操作不可恢复。')) return
    setCloudBusy(true)
    setCloudMsg('正在清空商城课程…')
    try {
      const r = await apiFetch('/api/videos/list')
      const j = await r.json()
      if (!j.ok || !Array.isArray(j.videos)) { setCloudMsg('读取云端列表失败，请重试'); setCloudBusy(false); return }
      const keep = j.videos.filter(v => v.kind !== 'course')
      const sr = await apiFetch('/api/videos/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authBody({ videos: keep })),
      })
      const sj = await sr.json()
      if (sj.ok) {
        setCloudCount(keep.length)
        setCloudMsg('✅ 商城课程已清空，访客商城立即同步')
        const list = getCourses().map(c => ({ ...c, cloudSynced: false }))
        saveCourses(list)
        refresh()
      } else {
        setCloudMsg('清空失败：' + (sj.error || '未知错误'))
      }
    } catch (e) {
      setCloudMsg('清空失败：' + (e.message || '网络错误'))
    }
    setCloudBusy(false)
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
    if (!isLoggedIn) { setCloudMsg('请先登录后台'); return }
    const localPub = getCourses().filter(c => c.status !== 'draft')
    if (!localPub.length) { setCloudMsg('没有已发布的课程可同步'); return }
    setCloudBusy(true)
    setCloudMsg('同步中…')
    try {
      // 1) 现有云端名单（含投稿视频/投稿课程）
      let cloud = []
      try {
        // 读名单放宽到 60s（后端 Render 免费实例冷启动可能 30-60s）
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
      if (e && e.name === 'AbortError') {
        setCloudMsg('⚠️ 同步超时被中止：后端冷启动或数据量较大，请稍等 1 分钟后重试')
      } else {
        setCloudMsg('同步失败：' + ((e && e.message) || '网络错误'))
      }
    }
    setCloudBusy(false)
  }

  // ========== 第二步：课程序管理 ==========

  // ---- 版本历史（本地快照 + 一键回滚） ----
  const [verModal, setVerModal] = useState(null) // { course, versions: [] }
  const openVersions = (c) => setVerModal({ course: c, versions: listCourseVersions(c.id) })
  const closeVersions = () => setVerModal(null)

  const doRollback = async (ts) => {
    if (!verModal) return
    const ver = getCourseVersion(verModal.course.id, ts)
    if (!ver) { flash('该版本不存在或已被清理', 'error'); return }
    if (!window.confirm(`确定回滚到 ${new Date(ts).toLocaleString()} 的版本吗？\n（共 ${ver.unitCount} 个课时。当前内容将被替换，可在版本历史中再次回滚。）`)) return
    const updated = rollbackCourse(verModal.course.id, ts)
    if (!updated) { flash('回滚失败：未找到课程', 'error'); return }
    // 若正在课程序/课时内容视图编辑该课程，同步 UI
    if (active && active.id === updated.id) { setActive(updated); setUnits(updated.units || []) }
    refresh()
    flash('✅ 已回滚到历史版本')
    // 已发布课程：自动重新同步云端，商城立即回滚
    if (updated.status !== 'draft') {
      if (isLoggedIn) {
        setCloudMsg('版本已回滚，正在重新同步云端…')
        await syncToCloud()
      } else {
        flash('⚠️ 已回滚到历史版本，但课程已发布：请登录后台重新同步云端，商城才会更新')
      }
    }
    closeVersions()
  }

  // 进入课程序管理
  const manageUnits = (c) => {
    setActive(c)
    setUnits(c.units || [])
    setNewUnitTitle('')
    setView('units')
    window.scrollTo({ top: 0 })
  }

  // 持久化课时列表并同步 active（自动留一个版本快照，可随时回滚）
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
      saveCourseVersion(updated, '课时内容保存') // 版本快照（内容未变则不重复存）
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

  // ========== 第三步：课时内容管理 ==========

  // 进入课时内容
  const openUnit = (u) => {
    setActiveUnit({ ...u })
    setNewSentRu('')
    setNewSentZh('')
    setView('unit')
    window.scrollTo({ top: 0 })
    // P2-A：打开课时自动补跑上次失败的语块（本机增强；无记录 / 失败静默，不打扰）
    const uTexts = collectUnitSentenceObjs(u)
    if (active && uTexts.length) {
      retryPendingSegments({ courseId: active.id, unitId: u.id, sentences: u.sentences, deps: { httpPost: segHttpPost } })
        .then((r) => { if (r && !r.skipped && (r.done || []).length) flash(`语块补跑完成：${r.done.length} 项`) })
        .catch((e) => console.warn('[segments] 打开课时补跑失败：', e && e.message))
      // P2：6 列表格补跑（失败进本机待重试，下次打开自动补跑）
      retryPendingSlotTables({ courseId: active.id, unitId: u.id, sentences: uTexts, deps: { httpPost: segHttpPost } })
        .then((r) => { if (r && !r.skipped && (r.done || []).length) flash(`表格补跑完成：${r.done.length} 项`) })
        .catch((e) => console.warn('[slot-tables] 打开课时补跑失败：', e && e.message))
    }
  }

  // 更新 activeUnit 副本
  const patchUnit = (patch) => setActiveUnit(prev => ({ ...prev, ...patch }))

  // 课时是否已挂内容（例句/素材任一非空）
  const unitHasContent = (u) =>
    (u.sentences && u.sentences.length) ||
    (u.materials && u.materials.length)

  // ✨ 一键生成本课知识点：收集本课所有句子 → AI 逐句生成 → 内嵌 unit.knowledge
  // 内嵌后随课时保存/同步云端 → 前端学习内容弹窗 100% 命中、零请求、永久缓存（后端再休眠也不失败）
  const collectUnitSentences = (u) => {
    const seen = new Set()
    const out = []
    const push = (ru) => {
      if (!ru) return
      const k = String(ru).trim()
      if (!k || seen.has(k)) return
      seen.add(k)
      out.push(k)
    }
    ;(u.sentences || []).forEach((s) => push(s && (s.ru || s.russian || s.text)))
    return out
  }

  // 课时句子收集器已提取到 src/lib/unitSentences.js 统一维护，
  // 与本页 collectUnitSentenceObjs 调用点、校对页 AdminSegments 共用同一数据源。

  const genUnitKnowledge = async () => {
    if (!activeUnit) return
    const sents = collectUnitSentences(activeUnit)
    if (!sents.length) { flash('本课时还没有例句，先挂内容再生成知识点'); return }
    const existing = (activeUnit.knowledge && typeof activeUnit.knowledge === 'object') ? activeUnit.knowledge : {}
    const todo = sents.filter((ru) => !(existing[ru] && existing[ru]._ru))
    if (!todo.length) { flash('本课所有句子都已有知识点，无需再生成'); return }
    setKpState({ done: 0, total: todo.length, cur: '' })
    let done = 0
    const errors = []
    for (const ru of todo) {
      setKpState({ done, total: todo.length, cur: ru })
      try {
        const k = await generateKnowledge(ru)
        if (k && k._ru) existing[ru] = k
      } catch (e) { errors.push(ru) }
      done++
      setKpState({ done, total: todo.length, cur: ru })
    }
    patchUnit({ knowledge: existing })
    setKpState(null)
    if (errors.length) {
      flash(`⚠️ 生成 ${todo.length - errors.length}/${todo.length} 句，失败 ${errors.length} 句（如「${errors[0]?.slice(0, 30)}…」）可再点重试；已成功的知识点已内嵌课时，点「保存课时内容」固定入库`)
    } else {
      flash(`✅ 已为 ${todo.length} 句生成知识点并内嵌课时（前端 100% 命中、永久秒开），点「保存课时内容」固定入库`)
    }
  }

  // P2-C：批量回填语块（老课时一次性补全；600ms 间隔 + 单次 ≤10 课时；中断恢复=幂等重跑，从第 1 课重新遍历）
  const [fillBusy, setFillBusy] = useState(false)
  const [fillProgress, setFillProgress] = useState(null) // {done, total, okUnits, failUnits, cur}
  const batchFillSegments = async () => {
    if (fillBusy || !active) return
    const withSent = units.filter(u => collectUnitSentenceObjs(u).length)
    if (!withSent.length) { flash('本课程没有含句子的课时，无需回填语块'); return }
    const total = Math.min(withSent.length, 10)
    if (withSent.length > 10 && !window.confirm(`共 ${withSent.length} 个课时含句子，单次最多回填 ${total} 个，完成后可再次点击继续回填。继续？`)) return
    setFillBusy(true)
    setFillProgress({ done: 0, total, okUnits: 0, failUnits: 0, cur: '' })
    let okUnits = 0, failUnits = 0
    for (let i = 0; i < total; i++) {
      const u = withSent[i]
      setFillProgress({ done: i + 1, total, okUnits, failUnits, cur: u.title })
      try {
        const r = await triggerUnitSegments({ courseId: active.id, unitId: u.id, sentences: collectUnitSentenceObjs(u), deps: { httpPost: segHttpPost } })
        if (r && (r.skipped || (r.failed || []).length)) failUnits++
        else okUnits++
      } catch (e) {
        failUnits++
        console.warn('[segments] 回填失败：', u.title, e && e.message)
      }
      if (i < total - 1) await new Promise(res => setTimeout(res, 600))
    }
    setFillBusy(false)
    setFillProgress(null)
    flash(`批量回填完成：成功 ${okUnits} 课，失败 ${failUnits} 课（失败已记录，打开对应课时自动重试）`)
  }

  // 保存课时内容（写回课程 units）
  const saveUnit = () => {
    if (!activeUnit) return
    const nextUnits = units.map(u => (u.id === activeUnit.id ? activeUnit : u))
    persistUnits(nextUnits)
    const sent = (activeUnit.sentences || []).length
    const words = (activeUnit.words || []).length
    const stats = [words ? words + ' 词' : '', sent ? sent + ' 句' : ''].filter(Boolean).join(' · ')
    const left = nextUnits.filter(u => !unitHasContent(u)).length
    setSaveBanner({ title: activeUnit.title, stats: stats || '（暂无内容）', left })
    flash(`已保存《${activeUnit.title}》` + (stats ? '：' + stats : '') + (left ? `，还有 ${left} 个课时未挂内容` : '，所有课时已就绪'))
    // P2-A：保存后异步触发语块生成（不 await；关页不保证完成，下次打开课时自动补跑）
    const segSentences = collectUnitSentenceObjs(activeUnit)
    if (active && segSentences.length) {
      triggerUnitSegments({ courseId: active.id, unitId: activeUnit.id, sentences: segSentences, deps: { httpPost: segHttpPost } })
        .then((r) => { if (r && !r.skipped) flash('已触发语块生成，完成后下次打开可见') })
        .catch((e) => console.warn('[segments] 语块生成触发失败（下次打开自动补跑）：', e && e.message))
      // P2：6 列表格生成（第 1 句核心长链 + 其余短链 + 三档难度；异步触发，失败下次打开补跑）
      triggerUnitSlotTables({ courseId: active.id, unitId: activeUnit.id, sentences: segSentences, deps: { httpPost: segHttpPost } })
        .then((r) => {
          if (!r || r.skipped) return
          const ok = (r.done || []).length
          const fail = (r.failed || []).length
          flash(ok ? `已触发表格生成：${ok} 项入库${fail ? `，${fail} 项待补跑` : ''}` : (fail ? `表格生成失败 ${fail} 项，下次打开自动补跑` : ''))
        })
        .catch((e) => console.warn('[slot-tables] 表格生成触发失败（下次打开自动补跑）：', e && e.message))
    }
    setView('units')
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

  // 批量粘贴添加（唯一上传入口主路径）：每行 "俄语 || 中文"（支持 || ｜ | Tab）
  const addSentencesBatch = () => {
    const lines = String(batchSentText || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    if (!lines.length) { flash('请先粘贴句子（每行一句：俄语 || 中文）'); return }
    const added = []
    const skipped = []
    for (const line of lines) {
      const parts = line.split(/\s*\|\|\s*|\s*[｜]\s*|\s*\|\s*|\t+/).map(s => s.trim())
      const ru = parts[0] || ''
      const zh = parts[1] || ''
      if (!ru) { skipped.push(line); continue }
      added.push({ ru, zh })
    }
    if (!added.length) { flash('没有解析到有效句子：每行需以俄语开头，格式「俄语 || 中文」'); return }
    patchUnit({ sentences: [...(activeUnit.sentences || []), ...added] })
    const noZh = added.filter(s => !s.zh).length
    flash(`已批量添加 ${added.length} 句` + (noZh ? `（其中 ${noZh} 句缺中文，可逐句点「编」补齐）` : ''))
    setBatchSentText('')
  }

  // 删除例句
  const removeSentence = (idx) => {
    patchUnit({ sentences: (activeUnit.sentences || []).filter((_, i) => i !== idx) })
  }

  // ========== 一键生成三档 6 列表格（唯一上传入口闭环：粘贴 → 点生成 → 本页完成，无需再去表格管理页） ==========
  const [genBusy, setGenBusy] = useState(false)
  const [genProgress, setGenProgress] = useState(null) // {done, total}
  const generateTablesNow = async () => {
    if (genBusy || !activeUnit) return
    // ① 粘贴区还有未添加的句子 → 先并入（解析规则与「批量添加」一致）
    let unit = activeUnit
    const paste = String(batchSentText || '').trim()
    if (paste) {
      const added = []
      for (const line of paste.split(/\r?\n/).map(l => l.trim()).filter(Boolean)) {
        const parts = line.split(/\s*\|\|\s*|\s*[｜]\s*|\s*\|\s*|\t+/).map(s => s.trim())
        if (parts[0]) added.push({ ru: parts[0], zh: parts[1] || '' })
      }
      if (added.length) {
        unit = { ...unit, sentences: [...(unit.sentences || []), ...added] }
        setBatchSentText('')
      }
    }
    const sentences = collectUnitSentenceObjs(unit)
    if (!sentences.length) { flash('先粘贴句子（每行：俄语 || 中文）再点生成'); return }
    // ② 落盘课时（保证句子入库；activeUnit 状态同步）
    patchUnit(unit)
    const nextUnits = units.map(u => (u.id === activeUnit.id ? unit : u))
    persistUnits(nextUnits)
    // ③ 同步等待三档表格生成（串行、带进度；失败项下次打开自动补跑）
    setGenBusy(true)
    setGenProgress({ done: 0, total: sentences.length })
    try {
      const r = await triggerUnitSlotTables({
        courseId: active.id,
        unitId: activeUnit.id,
        sentences,
        deps: {
          httpPost: segHttpPost,
          onProgress: (p) => setGenProgress({ done: p.done, total: p.total }),
        },
      })
      if (r && r.skipped) { flash('表格生成已在运行中，稍候刷新查看结果'); return }
      const ok = (r.done || []).length
      const fail = (r.failed || []).length
      const pend = (r.pending || []).length
      if (ok) {
        flash(`✅ 表格已生成：${ok} 项入库${fail ? `，${fail} 项失败（下次打开自动补跑）` : ''}${pend ? `，${pend} 项待校对` : ''}——本页即完成，无需再去表格管理页`)
      } else if (pend) {
        flash(`⚠️ ${pend} 项待校对（已入库），${fail} 项失败——可再点一次重试`)
      } else {
        flash(`⚠️ 生成失败 ${fail} 项，可再点一次重试`)
      }
    } catch (e) {
      flash('生成出错：' + String(e && e.message || e))
    } finally {
      setGenBusy(false)
      setGenProgress(null)
    }
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

  // 🚀 一键生成新课程（新引擎）：调后端异步接口
  const handleNewGenerate = async () => {
    if (!active || !activeUnit) return
    setNewGenBusy(true)
    setNewGenMsg('正在创建生成任务...')
    
    try {
      // 收集当前课时的所有句子
      const sentences = (activeUnit.sentences || []).map(s => ({
        ru: s.ru || '',
        zh: s.chinese || s.zh || ''
      })).filter(s => s.ru.trim())
      
      if (sentences.length === 0) {
        setNewGenMsg('⚠️ 没有句子，请先添加课时内容')
        setNewGenBusy(false)
        return
      }
      
      console.log('[debug] 新引擎：发送生成请求，句子数:', sentences.length)
      
      const resp = await fetch('/api/admin/course/generate-async', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_id: active.id,
          unit_id: activeUnit.id || 'unit_01',
          sentences: sentences
        })
      })
      const data = await resp.json()
      
      if (data.task_id) {
        console.log('[debug] 新引擎：task_id 拿到:', data.task_id)
        setNewGenTaskId(data.task_id)
        setNewGenMsg(`✅ 任务已创建，task_id = ${data.task_id}`)
      } else {
        setNewGenMsg('⚠️ 创建任务失败: ' + (data.error || '未知错误'))
      }
    } catch (e) {
      setNewGenMsg('⚠️ 创建任务异常: ' + ((e && e.message) || '网络错误'))
    }
    setNewGenBusy(false)
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
              <p className="text-xs text-gray-400 mt-0.5">第三步 · 挂内容：例句 + 素材</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex flex-col items-end gap-1">
                <button
                  className="btn btn-secondary btn-sm whitespace-nowrap"
                  onClick={genUnitKnowledge}
                  disabled={!!kpState}
                  title="为本课所有句子批量生成 AI 知识点并内嵌课时：前端学习内容弹窗 100% 命中、零请求、永久缓存"
                >
                  {kpState ? `✨ 生成中 ${kpState.done}/${kpState.total}` : '✨ 生成本课知识点'}
                </button>
                {kpState && kpState.cur && (
                  <span className="text-[11px] text-gray-400 max-w-[260px] truncate">正在解析：{kpState.cur}</span>
                )}
              </div>
              <button className="btn btn-primary btn-sm" onClick={saveUnit}>💾 保存课时内容</button>
              <button
                className="btn btn-primary btn-sm"
                onClick={generateTablesNow}
                disabled={genBusy}
                title="一键：并入粘贴区句子 + 保存课时 + 三档 6 列表格本页生成完毕"
              >
                {genBusy ? `🚀 生成中 ${genProgress ? `${genProgress.done}/${genProgress.total}` : '…'}` : '🚀 生成表格'}
              </button>
              <button
                className="btn btn-success btn-sm"
                onClick={handleNewGenerate}
                disabled={newGenBusy}
                title="新引擎：整课分层编排，一键生成课程步骤"
              >
                {newGenBusy ? '创建中…' : '🚀 新引擎生成'}
              </button>
              {newGenMsg && (
                <span className="text-[11px] text-gray-400 max-w-[300px] truncate">{newGenMsg}</span>
              )}
              {active && (
                <button className="btn btn-outline btn-sm" onClick={() => navigate(`/admin/segments?course=${encodeURIComponent(active.id)}&unit=${encodeURIComponent(activeUnit.id)}`)}>
                  📑 语块管理
                </button>
              )}
            </div>
          </div>

          {/* 📤 唯一上传入口 · 三步引导 */}
          <div className="card mt-4 border border-primary/30 bg-primary/5 shadow-sm" style={{ borderRadius: 16 }}>
            <div className="card-body p-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-sm font-bold text-gray-900">📤 上传课程 = 三步</span>
                <span className="text-[11px] text-gray-400">本课时内容只有一个入口：贴句子 → 点生成 → 表格本页生成完毕</span>
              </div>
              <ol className="mt-2 grid gap-1.5 text-xs text-gray-700 sm:grid-cols-3">
                <li className="rounded-lg bg-white/70 px-3 py-2">
                  <b className="text-primary">① 粘贴句子</b><br />
                  在下方「① 例句」粘贴完整句子（每行：俄语 || 中文），点「批量添加」
                </li>
                <li className="rounded-lg bg-white/70 px-3 py-2">
                  <b className="text-primary">② 生成表格</b><br />
                  点「🚀 生成表格」，自动为每句生成 初级/中级/高级 三档 6 列表格（同步等待，带进度）
                </li>
                <li className="rounded-lg bg-white/70 px-3 py-2">
                  <b className="text-primary">③ 完成</b><br />
                  生成即入库，学生端四模式即可学习；无需再去表格管理页
                </li>
              </ol>
            </div>
          </div>

          {/* ① 例句 */}
          <div className="card mt-4 border border-gray-200 bg-base-100 shadow-sm" style={{ borderRadius: 16 }}>
            <div className="card-body p-5">
              <h2 className="card-title text-base text-gray-900">① 例句（可手动添加 / 编辑）</h2>

              {(!activeUnit.sentences || !activeUnit.sentences.length) ? (
                <p className="py-8 text-center text-sm text-gray-400">还没有句子，用下方「📥 批量粘贴句子」添加完整句子（俄语 || 中文）。</p>
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
                            <div className="text-xs text-gray-400 mt-0.5">{s.chinese || s.zh || <span className="text-amber-600">（缺中文，点「编」手动补齐）</span>}</div>
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

              {/* 📥 批量粘贴（唯一上传入口主路径） */}
              <div className="mt-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-semibold text-gray-700">📥 批量粘贴句子（每行一句：俄语 || 中文）</span>
                  <div className="flex items-center gap-2">
                    <button className="btn btn-primary btn-xs" onClick={addSentencesBatch} disabled={genBusy}>批量添加</button>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={generateTablesNow}
                      disabled={genBusy}
                      title="粘贴后一键完成：并入句子 + 保存课时 + 三档表格本页生成完毕"
                    >
                      {genBusy ? `🚀 生成中 ${genProgress ? `${genProgress.done}/${genProgress.total}` : '…'}` : '🚀 生成表格'}
                    </button>
                  </div>
                </div>
                <textarea
                  className="textarea textarea-bordered mt-2 w-full font-mono text-xs"
                  rows={5}
                  placeholder={'Улица Чистые пруды — это старая улица в центре Москвы. || 清水池街是莫斯科市中心的一条老街。\nЭта улица небольшая, но известная. || 这条街不大，但很有名。'}
                  value={batchSentText}
                  onChange={e => setBatchSentText(e.target.value)}
                />
                <p className="mt-1 text-[11px] text-gray-400">支持分隔符：|| ｜ | Tab；建议中文必填（俄语 || 中文），缺中文可事后点例句「编」手动补齐</p>
              </div>

              {/* ② 生成表格（一键：粘贴 → 生成 → 本页完成） */}
              {genProgress && genProgress.total > 0 && (
                <div className="card mt-4 border border-primary/20 bg-base-100 shadow-sm" style={{ borderRadius: 16 }}>
                  <div className="card-body p-5">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>三档表格生成中（{genProgress.done}/{genProgress.total} 句）…</span>
                      <span className="text-primary">{Math.round((genProgress.done / genProgress.total) * 100)}%</span>
                    </div>
                    <progress className="progress progress-primary w-full" value={genProgress.done} max={genProgress.total} />
                    <p className="mt-2 text-[11px] text-gray-400">生成完成后可直接查看学生端；失败项下次打开本课时自动补跑</p>
                  </div>
                </div>
              )}

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

          {saveBanner && (
            <div className="alert alert-success mb-4 shadow-lg border-2 border-success/60" style={{ padding: '12px 16px' }}>
              <div className="flex-1">
                <div className="text-sm font-bold">✅ 已保存《{saveBanner.title}》{saveBanner.stats}</div>
                <div className="text-xs mt-1 opacity-80">
                  {saveBanner.left > 0
                    ? `还有 ${saveBanner.left} 个课时未挂内容，建议逐课保存后再发布。`
                    : '本课程所有课时都已挂内容，可以发布上架了！'}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {saveBanner.left > 0 ? (
                  <button
                    className="btn btn-primary btn-xs"
                    onClick={() => {
                      const n = units.findIndex(u => !unitHasContent(u))
                      if (n >= 0) openUnit(units[n])
                    }}
                  >继续编辑下一课</button>
                ) : (
                  <button className="btn btn-primary btn-xs" onClick={() => { setSaveBanner(null); publish() }}>🚀 发布上架</button>
                )}
                <button className="btn btn-ghost btn-xs" onClick={() => setSaveBanner(null)}>知道了</button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <button className="btn btn-ghost btn-sm -ml-2 text-gray-500" onClick={() => setView('list')}>← 返回课程列表</button>
              <h1 className="text-xl font-extrabold text-gray-900 mt-1">{active.title}</h1>
              <p className="text-xs text-gray-400 mt-0.5">第二步 · 搭课程序：共 {units.length} 个课时</p>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn btn-outline btn-sm" onClick={() => openVersions(active)}>🕘 版本历史</button>
              <button className="btn btn-outline btn-sm" onClick={() => navigate('/game-mall')}>去商城查看 →</button>
              <button className="btn btn-sm" onClick={batchFillSegments} disabled={fillBusy}>
                {fillBusy ? `回填中 ${fillProgress.done}/${fillProgress.total}…` : '⟳ 批量回填语块'}
              </button>
            </div>
          </div>

          {/* 课时列表 */}
          <div className="card mt-4 border border-gray-200 bg-base-100 shadow-sm" style={{ borderRadius: 16 }}>
            <div className="card-body p-5">
              <h2 className="card-title text-base text-gray-900">课时列表</h2>
              {units.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">还没有课时，点右上角「手动添加课时」创建第一课。</p>
              ) : (
                <div className="space-y-2">
                  {units.map((u, i) => {
                    const hasContent = unitHasContent(u)
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
                          <button className="btn btn-ghost btn-xs" title="AI 根据本课内容生成课时名" disabled={aiRenameBusy !== null} onClick={() => aiRenameUnit(i)}>
                            {aiRenameBusy === i ? '…' : '🤖 改名'}
                          </button>
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
                <button type="button" className="btn btn-outline btn-primary" onClick={aiGenUnitTitle} disabled={aiUnitTitleBusy}>
                  {aiUnitTitleBusy ? '生成中…' : '🤖 AI 生成课时名'}
                </button>
                <button className="btn btn-primary" onClick={addUnit}>+ 添加</button>
              </div>
            </div>
          </div>

        </div>

        {/* 版本历史弹窗 */}
        {verModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeVersions}>
            <div className="w-full max-w-2xl rounded-2xl bg-base-100 p-5 shadow-xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold">🕘 版本历史 · {verModal.course.title}</h3>
                <button className="btn btn-ghost btn-sm btn-circle" onClick={closeVersions}>✕</button>
              </div>
              <p className="text-xs text-gray-400 mb-3">
                每次课时内容保存自动留档（最多 20 版）。回滚后当前内容被替换；若课程已发布，会自动重新同步云端。
              </p>
              {verModal.versions.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">还没有版本记录 —— 保存一次课时内容后自动生成。</p>
              ) : (
                <div className="max-h-96 space-y-2 overflow-y-auto">
                  {verModal.versions.map((v) => (
                    <div key={v.ts} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-gray-800">
                          {new Date(v.ts).toLocaleString()}
                          <span className="ml-2 badge badge-ghost badge-xs">{v.reason}</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">{v.unitCount} 个课时{v.title ? ' · ' + v.title : ''}</div>
                      </div>
                      <button className="btn btn-outline btn-xs shrink-0" onClick={() => doRollback(v.ts)}>回滚到此版</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    )
  }

  // —— 视图一：档案表单 + 课程列表 ——
  if (!isLoggedIn) return <AdminLoginGate />

  return (
    <main className="min-h-full bg-base-100 px-6 py-7">
      <div className="mx-auto max-w-[1100px]">
        <h1 className="text-2xl font-extrabold text-gray-900">📚 课程管理</h1>
        <p className="mt-1 text-sm text-gray-400">第一步：建课程档案 → 第二步：搭课程序 → 第三步：挂内容 → 第四步：发布</p>

        {toast && (
          <div className="alert alert-success mt-4 shadow-lg" style={{ padding: '10px 16px' }}>
            <span>✅ {toast}</span>
          </div>
        )}

        {/* ===== ①.5 全网可见 · 云端同步 ===== */}
        <div className="card mt-6 border border-gray-200 bg-base-100 shadow-sm" style={{ borderRadius: 16 }}>
          <div className="card-body p-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="card-title text-base text-gray-900">🌐 全网可见 · 同步到云端</h2>
              <span className="text-xs text-gray-400">后台课程目前只存在你的浏览器；同步后所有访客可见、可学</span>
            </div>
            {cloudMsg && <div className="mt-3 text-sm text-gray-600">{cloudMsg}</div>}
            <div className="mt-3">
              <button className="btn btn-sm btn-primary" onClick={syncToCloud} disabled={cloudBusy || !isLoggedIn}>
                {cloudBusy ? '同步中…' : '🚀 同步到云端'}
              </button>
              {syncFlag && <span className="ml-2 text-xs text-gray-400">已为你定位：点此按钮即可将已发布课程同步到云端</span>}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
              <span className="text-xs text-gray-500">课程数据迁移（换浏览器/正式站时使用）：</span>
              <button className="btn btn-xs btn-outline" onClick={exportCourses}>📤 导出课程数据</button>
              <label className="btn btn-xs btn-outline cursor-pointer">
                📥 导入课程数据
                <input type="file" accept=".json,application/json" className="hidden" onChange={e => { importCoursesFile(e.target.files && e.target.files[0]); e.target.value = '' }} />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
              <span className="text-xs text-gray-500 text-error">危险操作：</span>
              <button className="btn btn-xs btn-error btn-outline" onClick={clearStoreCourses} disabled={cloudBusy || !isLoggedIn}>
                🗑️ 清空商城课程
              </button>
            </div>
            {cloudCount >= 0 && <div className="mt-2 text-xs text-gray-400">云端名单共 {cloudCount} 项（视频 + 课程）</div>}
            <div className="mt-3 text-xs text-gray-400">
              提示：只有「已发布」状态的课程会同步；草稿不会上云。同步后所有访客可见、可学。
            </div>
          </div>
        </div>

        {/* ===== ② 已有课程列表 ===== */}
        <div className="card mt-6 border border-gray-200 bg-base-100 shadow-sm" style={{ borderRadius: 16 }}>
          <div className="card-body p-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="card-title text-base text-gray-900">
                已有课程（{q ? `${filteredCourses.length} / ${courses.length} 匹配「${q}」` : courses.length}）
              </h2>
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/admin/courses/new')}>＋ 新建课程</button>
            </div>
            {filteredCourses.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">
                {courses.length === 0 ? '还没有课程，先填上面表单保存一个草稿试试。' : `没有标题或简介包含「${q}」的课程，换个关键词试试。`}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table table-zebra table-sm">
                  <thead>
                    <tr className="text-xs text-gray-400">
                      <th>状态</th><th>封面</th><th>标题</th><th>分类</th><th>课时</th><th>大纲</th><th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCourses.map(c => (
                      <tr key={c.id}>
                        <td>
                          {(() => {
                            const st = courseStatus(c)
                            if (st === 'published') return <span className="badge badge-success badge-sm">已发布</span>
                            if (st === 'scheduled') return <span className="badge badge-info badge-sm" title={'将于 ' + statusLabel(c) + ' 自动上架'}>定时中 {fmtSchedule(c.scheduledPublishAt)}</span>
                            if (st === 'expired') return <span className="badge badge-warning badge-sm" title={'已于 ' + statusLabel(c) + ' 下架'}>已下架</span>
                            return <span className="badge badge-warning badge-sm">草稿</span>
                          })()}
                          {c.cloudSynced && <span className="badge badge-info badge-sm ml-1">云端</span>}
                        </td>
                        <td>
                          <AdminCourseCover src={c.cover} className="h-10 w-16 rounded object-cover" />
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
                            <button className="btn btn-ghost btn-xs" onClick={() => navigate('/admin/courses/new?edit=' + c.id)}>编辑</button>
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
