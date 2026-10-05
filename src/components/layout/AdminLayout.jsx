// AdminLayout.jsx —— 后台统一布局外壳（对标"课程包管理后台"布局图）：
// 顶部栏（标题 + 全局课程搜索 + 用户信息 + 退出）
// 左侧导航（数据看板 / 课程管理 / 语块管理 / 用户管理 / 订单管理 / 分类管理 / 系统设置
//           + 分隔线 + 同步云端 / 退出）
// 内容区 = <Outlet />（各 Admin 页面原样嵌套，页内已有标题/操作按钮/列表，不做整页重写）
//
// 登录门禁：未登录 → 统一登录卡片（账号密码 + 旧密钥双轨，复用 adminStore）；
//           登录后渲染 Outlet。所有 /admin/* 页面都走这层，避免各页重复写门禁。
// 角色控制：admin 显示全部 7 项；editor/viewer 仅课程管理 + 语块管理（与旧入口逻辑一致）。
import { useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAdminStore } from '../../store/adminStore'

const NAV_ITEMS = [
  { to: '/admin/stats', icon: '📊', title: '数据看板', roles: ['admin'] },
  { to: '/admin', icon: '📚', title: '课程管理', roles: ['admin', 'editor', 'viewer'], end: true },
  { to: '/admin/segments', icon: '🧩', title: '语块管理', roles: ['admin', 'editor', 'viewer'] },
  { to: '/admin/slot-tables', icon: '🗂', title: '表格管理', roles: ['admin', 'editor', 'viewer'] },
  { to: '/admin/users', icon: '👥', title: '用户管理', roles: ['admin'] },
  { to: '/admin/orders', icon: '💰', title: '订单管理', roles: ['admin'] },
  { to: '/admin/categories', icon: '🏷️', title: '分类管理', roles: ['admin'] },
  { to: '/admin/settings', icon: '⚙️', title: '系统设置', roles: ['admin'] },
]

function LoginGate() {
  const navigate = useNavigate()
  const { loginPassword, login } = useAdminStore()
  const [tab, setTab] = useState('login') // login | legacy
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [legacyKey, setLegacyKey] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const doLogin = async () => {
    setMsg('')
    setBusy(true)
    if (tab === 'login') {
      const r = await loginPassword(username, password)
      if (r.ok) { navigate('/admin') }
      else { setMsg(r.error || '登录失败'); setBusy(false) }
    } else {
      const ok = await login(legacyKey)
      if (ok) { navigate('/admin') }
      else { setMsg('密钥不正确或后端不可用'); setBusy(false) }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-bold text-gray-900">📚 课程包管理后台</h1>
        <p className="mt-1 text-xs text-gray-400">登录后管理课程档案、课时内容与云端发布</p>
        <div className="mt-4 flex gap-1">
          <button className={`tab ${tab === 'login' ? 'tab-active' : ''}`} onClick={() => { setTab('login'); setMsg('') }}>账号登录</button>
          <button className={`tab ${tab === 'legacy' ? 'tab-active' : ''}`} onClick={() => { setTab('legacy'); setMsg('') }}>密钥登录</button>
        </div>
        {tab === 'login' ? (
          <div className="mt-4 space-y-3">
            <input className="input input-bordered w-full" placeholder="用户名" value={username} onChange={e => setUsername(e.target.value)} />
            <input className="input input-bordered w-full" type="password" placeholder="密码" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && doLogin()} />
          </div>
        ) : (
          <div className="mt-4">
            <input className="input input-bordered w-full" placeholder="管理员密钥" value={legacyKey} onChange={e => setLegacyKey(e.target.value)} onKeyDown={e => e.key === 'Enter' && doLogin()} />
          </div>
        )}
        {msg && <div className="mt-3 text-sm text-error">{msg}</div>}
        <button className="btn btn-primary mt-5 w-full" onClick={doLogin} disabled={busy}>{busy ? '处理中…' : '登录'}</button>
      </div>
    </div>
  )
}

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { token, user, adminKey, logout } = useAdminStore()
  // isLoggedIn 实时计算（zustand getter 在 set 时会被 Object.assign 合并，不能依赖 store getter）
  const isLoggedIn = !!((token && user && (user.role === 'admin' || user.role === 'editor' || user.role === 'viewer')) || adminKey)
  const [kw, setKw] = useState('')

  if (!isLoggedIn) return <LoginGate />

  const role = user?.role || (adminKey ? 'legacy' : '')
  // 当前角色是否在菜单白名单中（旧密钥模式视为全权限 admin）
  const canSee = (roles) => role === 'legacy' || roles.includes(role)

  const doSearch = () => {
    const q = kw.trim()
    navigate(q ? `/admin?q=${encodeURIComponent(q)}` : '/admin')
  }

  const goSync = () => {
    navigate('/admin?sync=1')
  }

  const doLogout = () => {
    logout()
    navigate('/admin')
  }

  const activeTitle = NAV_ITEMS.find(n => {
    if (n.end) return location.pathname === n.to
    return location.pathname.startsWith(n.to)
  })?.title || '课程管理'

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* ===== 顶部栏 ===== */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-gray-200 bg-white px-4 shadow-sm">
        <NavLink to="/admin" className="flex items-center gap-2 font-bold text-gray-900">
          <span className="text-lg">📚</span> 课程包管理后台
        </NavLink>
        {/* 顶部搜索：任何宽度都显示 */}
        <div className="ml-auto flex-1 max-w-md items-center gap-1 px-2">
          <input
            className="input input-bordered input-sm w-full"
            placeholder="搜索课程标题…（回车跳转）"
            value={kw}
            onChange={e => setKw(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch()}
          />
          <button className="btn btn-ghost btn-sm" onClick={doSearch}>搜索</button>
        </div>
        <div className="ml-auto sm:ml-2 flex items-center gap-2">
          <span className="text-sm text-gray-600">{user?.username || '旧密钥模式'}</span>
          <span className="badge badge-ghost badge-sm">
            {role === 'admin' ? '管理员' : role === 'editor' ? '编辑' : role === 'viewer' ? '只读' : '旧密钥'}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={doLogout}>退出</button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* ===== 左侧导航：任何宽度都显示（窄屏缩窄，内容区自适应） ===== */}
        <aside className="flex w-44 lg:w-52 shrink-0 flex-col border-r border-gray-200 bg-white">
          <nav className="flex-1 space-y-1 p-3">
            {NAV_ITEMS.filter(n => canSee(n.roles)).map(n => (
              <NavLink
                key={n.to}
                to={n.to}
                end={!!n.end}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                    isActive ? 'bg-primary/10 font-semibold text-primary' : 'text-gray-600 hover:bg-gray-100'
                  }`
                }
              >
                <span>{n.icon}</span> {n.title}
              </NavLink>
            ))}
          </nav>
          <div className="border-t border-gray-100 p-3 space-y-1">
            <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100" onClick={goSync}>
              <span>☁️</span> 同步云端
            </button>
            <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-error hover:bg-red-50" onClick={doLogout}>
              <span>🚪</span> 退出
            </button>
          </div>
        </aside>

        {/* ===== 内容区 ===== */}
        <main className="min-w-0 flex-1">
          {/* 页面内容：各 Admin 页面自带标题/操作/列表 */}
          <div className="p-4 md:p-5" key={location.pathname}>
            <div className="mb-3 text-sm font-semibold text-gray-800">📚 {activeTitle}</div>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
