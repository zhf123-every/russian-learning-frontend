import { create } from 'zustand'
import { loadLS, saveLS } from '../lib/persistence'
import { apiFetch } from '../lib/api'

const LS_ADMIN = 'rlearn_v1_admin'      // 旧：管理员密钥（兼容保留）
const LS_TOKEN = 'rlearn_v1_token'      // 新：JWT 通行证
const LS_USER = 'rlearn_v1_user'        // 新：当前用户（id/username/role/nickname）

const BACKEND_ROLES = ['admin', 'editor', 'viewer']

function loadUser() {
  try {
    const u = loadLS(LS_USER, null)
    return (u && typeof u === 'object' && u.id) ? u : null
  } catch (e) { return null }
}

// 管理员模式（P0 起双轨）：
// - 新：token + user（账号密码登录，后端 /api/auth/login 发 JWT）
// - 旧：adminKey 存在即视为已登录（密钥在 login() 时已通过后端 /api/admin/check 校验）
// 两者任一存在都视为"已登录后台"，保证老前端/老入口不破坏。
export const useAdminStore = create((set, get) => ({
  adminKey: loadLS(LS_ADMIN, ''),
  token: loadLS(LS_TOKEN, ''),
  user: loadUser(),

  // 是否具备后台访问资格（admin/editor/viewer 或旧密钥）
  get isLoggedIn() {
    const s = get()
    if (s.token && s.user && BACKEND_ROLES.includes(s.user.role)) return true
    if (s.adminKey) return true
    return false
  },

  // —— 新：账号密码登录（POST /api/auth/login）——
  async loginPassword(username, password) {
    const u = (username || '').trim()
    if (!u || !password) return { ok: false, error: '请输入用户名和密码' }
    try {
      const r = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password }),
        timeout: 90000, // 云端库(如 TiDB)公网链路较慢且可能休眠唤醒，放宽到 90s，避免误报"后端不可用"
      })
      const j = await r.json()
      if (j.ok && j.token) {
        saveLS(LS_TOKEN, j.token)
        saveLS(LS_USER, j.user)
        set({ token: j.token, user: j.user })
        return { ok: true, user: j.user, isFirstAdmin: !!j.user.isFirstAdmin }
      }
      return { ok: false, error: j.error || '登录失败' }
    } catch (e) {
      return { ok: false, error: '网络错误：后端不可用' }
    }
  },

  // —— 新：注册（POST /api/auth/register）——
  async register(username, password, nickname) {
    const u = (username || '').trim()
    if (!u || !password) return { ok: false, error: '请输入用户名和密码' }
    try {
      const r = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password, nickname: nickname || '' }),
        timeout: 90000, // 云端库(如 TiDB)公网链路较慢且可能休眠唤醒，放宽到 90s，避免误报"后端不可用"
      })
      const j = await r.json()
      if (j.ok && j.token) {
        saveLS(LS_TOKEN, j.token)
        saveLS(LS_USER, j.user)
        set({ token: j.token, user: j.user })
        return { ok: true, user: j.user, isFirstAdmin: !!j.user.isFirstAdmin }
      }
      return { ok: false, error: j.error || '注册失败' }
    } catch (e) {
      return { ok: false, error: '网络错误：后端不可用' }
    }
  },

  // —— 旧：密钥登录（兼容保留，POST /api/admin/check）——
  async login(key) {
    const k = (key || '').trim()
    if (!k) return false
    try {
      const r = await apiFetch('/api/admin/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminKey: k }),
      })
      const j = await r.json()
      if (j.ok) {
        saveLS(LS_ADMIN, k)
        set({ adminKey: k })
        return true
      }
    } catch (e) { /* 后端不可用则失败 */ }
    return false
  },

  // —— 统一鉴权字段：给请求体带上 token（新）与 adminKey（旧兼容），后端双轨任一通过 ——
  authBody(extra) {
    const s = get()
    const body = { ...(extra || {}) }
    if (s.token) body.token = s.token
    if (s.adminKey) body.adminKey = s.adminKey
    return body
  },

  logout() {
    saveLS(LS_ADMIN, '')
    saveLS(LS_TOKEN, '')
    saveLS(LS_USER, '')
    set({ adminKey: '', token: '', user: null })
  },
}))
