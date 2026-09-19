import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useSquareStore } from '../store/squareStore'
import { useShangStore } from '../store/shangStore'
import { useAdminStore } from '../store/adminStore'
import { useCourseStore } from '../store/courseStore'
import { SQUARE_CATEGORIES } from '../data/squareLibrary'
import ContributeModal from '../components/ContributeModal'
import AddMaterialModal from '../components/AddMaterialModal'
import TranscribeModal from '../components/TranscribeModal'
import { generateVideoThumbnail, formatDuration, formatDate } from '../lib/thumbnail'
import { toast } from '../lib/toast'

// 是否具备分句字幕（五步精听的前提）
const hasSubs = (it) => Array.isArray(it?.sentences) && it.sentences.length > 0
// 统一进入学习：Study 已默认五步精听；无字幕素材由 Study 内部展示纯观看视图
const learnPath = (it) => `/square/${it.id}`

export default function SquarePage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'my' ? 'my' : 'square'

  // —— 广场素材（服务端共享 + 内置库） ——
  const items = useSquareStore(s => s.items())
  const submitItem = useSquareStore(s => s.submitItem)
  const deleteItem = useSquareStore(s => s.deleteItem)
  const fetchServer = useSquareStore(s => s.fetchServer)
  // —— 我的素材（本地，仅本设备） ——
  const materials = useCourseStore(s => s.materials)
  const updateMaterial = useCourseStore(s => s.updateMaterial)

  const shang = useShangStore()
  const adminKey = useAdminStore(s => s.adminKey)
  const adminLogin = useAdminStore(s => s.login)
  const adminLogout = useAdminStore(s => s.logout)
  const isAdmin = !!adminKey

  const [selectedCategory, setSelectedCategory] = useState('all')
  const [showContribute, setShowContribute] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)
  const [adminInput, setAdminInput] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [showTranscribe, setShowTranscribe] = useState(false)

  useEffect(() => { fetchServer() }, [fetchServer])

  // 我的素材：占位缩略图自动替换为真实视频画面
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      for (const m of materials) {
        if (cancelled) return
        if (!m.videoUrl) continue
        const isPlaceholder = !m.thumbnail || m.thumbnail.includes('picsum.photos')
        if (!isPlaceholder) continue
        const t = await generateVideoThumbnail(m.videoUrl)
        if (cancelled) return
        if (t) updateMaterial(m.id, { thumbnail: t, posterUrl: t })
      }
    })()
    return () => { cancelled = true }
  }, [materials, updateMaterial])

  const switchTab = (t) => setParams(t === 'square' ? {} : { tab: t }, { replace: true })

  const filtered = selectedCategory === 'all' ? items : items.filter(x => x.category === selectedCategory)

  const doAdminLogin = async () => {
    const ok = await adminLogin(adminInput)
    if (ok) { setShowAdmin(false); setAdminInput(''); toast('已进入管理模式') } else { toast('密钥错误') }
  }
  const doDelete = async (item) => {
    if (!window.confirm(`确定删除「${item.title}」？此操作不可撤销。`)) return
    try { await deleteItem(item.id, adminKey); toast('已删除') }
    catch (e) { toast('删除失败：' + (e.message || '请重试')) }
  }

  // 五步精听完成角标
  const DoneBadge = ({ id }) => (shang.isFinished(id)
    ? <span className="thumb-score" style={{ left: 'auto', right: 8, background: '#4F46E5' }}>五步 ✓</span>
    : null)

  const renderSquareCard = (item) => (
    <div key={item.id} className="video-card" onClick={() => navigate(learnPath(item))}>
      <div className="thumb" style={{ backgroundImage: `url(${item.thumbnail})` }}>
        <span className="thumb-score">{item.level}</span>
        <DoneBadge id={item.id} />
      </div>
      <div className="vc-body">
        <div className="vc-title">{item.title}</div>
        <div className="vc-meta">👁 {item.views ?? 0} · 👤 {item.author || '未知'} · {hasSubs(item) ? `${item.sentences.length} 句字幕` : '无字幕'}</div>
        <div className="vc-info">
          <span className="vc-info-tag">{item.level}</span>
          {(item.tags || []).filter(t => t !== item.level).slice(0, 3).map(t => <span key={t}>{t}</span>)}
        </div>
      </div>
      <div className="vc-actions">
        <button className="btn sm primary" onClick={(e) => { e.stopPropagation(); navigate(learnPath(item)) }}>
          {hasSubs(item) ? '五步精听' : '观看视频'}
        </button>
        {isAdmin && <button className="btn sm" onClick={(e) => { e.stopPropagation(); doDelete(item) }}>删除</button>}
      </div>
    </div>
  )

  const renderMyCard = (m) => (
    <div key={m.id} className="video-card" onClick={() => navigate(learnPath(m))}>
      <div className="thumb" style={{ backgroundImage: `url(${m.thumbnail})` }}>
        <span className="thumb-score">{m.level || '自定义'}</span>
        <DoneBadge id={m.id} />
      </div>
      <div className="vc-body">
        <div className="vc-title">{m.title}</div>
        <div className="vc-meta">{m.sentences?.length || 0} 句 · {m.words ?? 0} 词 · {formatDate(m.createdAt)}</div>
        <div className="vc-info">
          <span className="vc-info-tag">{m.level || '自定义'}</span>
          <span>{formatDuration(m)}</span>
          {(m.tags || []).slice(0, 2).map(t => <span key={t}>{t}</span>)}
        </div>
      </div>
      <div className="vc-actions">
        <button className="btn sm primary" onClick={(e) => { e.stopPropagation(); navigate(learnPath(m)) }}>
          {hasSubs(m) ? '五步精听' : '观看视频'}
        </button>
      </div>
    </div>
  )

  return (
    <div className="db-page">
      <div className="db-container">
        <div className="sq-head">
          <div>
            <h1>精听学习</h1>
            <p className="sq-sub">盲听 · 听写 · 精读 · 跟读 · 复述，五步吃透一段真实俄语视频</p>
          </div>
          <div className="sq-actions">
            {tab === 'square' ? (
              isAdmin ? (
                <>
                  <button className="db-btn db-btn-ghost" onClick={() => { adminLogout(); toast('已退出管理模式') }}>退出管理</button>
                  <button className="db-btn db-btn-primary" onClick={() => setShowContribute(true)}>上传到广场</button>
                </>
              ) : (
                <button className="db-btn db-btn-ghost" onClick={() => setShowAdmin(true)}>管理</button>
              )
            ) : (
              <>
                <button className="db-btn db-btn-ghost" onClick={() => setShowTranscribe(true)}>音频识别</button>
                <button className="db-btn db-btn-primary" onClick={() => setShowAdd(true)}>添加素材</button>
              </>
            )}
          </div>
        </div>

        <div className="sq-tabs">
          <button className={'sq-tab' + (tab === 'square' ? ' active' : '')} onClick={() => switchTab('square')}>🛍️ 广场素材</button>
          <button className={'sq-tab' + (tab === 'my' ? ' active' : '')} onClick={() => switchTab('my')}>📹 我的素材</button>
        </div>

        {tab === 'square' ? (
          <>
            <div className="sq-cats">
              <button className={'sq-cat' + (selectedCategory === 'all' ? ' active' : '')} onClick={() => setSelectedCategory('all')}>全部</button>
              {SQUARE_CATEGORIES.map(c => (
                <button key={c.key} className={'sq-cat' + (selectedCategory === c.key ? ' active' : '')} onClick={() => setSelectedCategory(c.key)}>
                  <span>{c.icon}</span> {c.label}
                </button>
              ))}
            </div>
            {filtered.length === 0 ? (
              <div className="empty">
                <div className="big">🛍️</div>
                <h1>这个分类还没有素材</h1>
                <p>{isAdmin ? '点右上角「上传到广场」发布第一个素材吧！' : '管理员还没有上传素材，敬请期待。'}</p>
                {isAdmin && <div className="cta"><button className="btn primary" onClick={() => setShowContribute(true)}>上传到广场</button></div>}
              </div>
            ) : (
              <div className="videos-grid">{filtered.map(renderSquareCard)}</div>
            )}
          </>
        ) : (
          materials.length === 0 ? (
            <div className="empty">
              <div className="big">📹</div>
              <h1>还没有自己的素材</h1>
              <p>填 mp4 视频地址并粘贴字幕（或自动识别），自动断句后按五步精听学习；素材保存在本设备，任务2 起将支持上传共享到广场。</p>
              <div className="cta"><button className="btn primary" onClick={() => setShowAdd(true)}>添加素材</button></div>
            </div>
          ) : (
            <div className="videos-grid">{materials.map(renderMyCard)}</div>
          )
        )}
      </div>

      {showContribute && (
        <ContributeModal onClose={() => setShowContribute(false)} onSubmit={(data) => submitItem(data, adminKey)} />
      )}
      {showAdd && <AddMaterialModal onClose={() => setShowAdd(false)} />}
      {showTranscribe && <TranscribeModal onClose={() => setShowTranscribe(false)} />}

      {showAdmin && (
        <div className="modal-mask" onClick={() => setShowAdmin(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <h2>管理登录</h2>
            <p className="hint">输入管理员密钥以解锁广场上传 / 删除。</p>
            <div className="field">
              <label>管理员密钥</label>
              <input
                type="password"
                value={adminInput}
                onChange={e => setAdminInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') doAdminLogin() }}
                placeholder="ADMIN_KEY"
                autoFocus
              />
            </div>
            <div className="mfoot">
              <button className="btn" onClick={() => setShowAdmin(false)}>取消</button>
              <button className="btn primary" onClick={doAdminLogin}>登录</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
