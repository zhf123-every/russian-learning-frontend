// ===== 学习者整包云端同步 =====
// 覆盖：总体进度、复习卡片、生词本、最近学习、资料、设置、错题本、掌握标记、统计等本地键。
// 仅登录用户（含 learner）上报/拉取；未登录纯本地，行为与之前一致。
// 冲突合并：逐键比较时间戳 ts，云端更新才覆盖本地；本地更新则保留本地。
import { apiFetch } from './api'
import { useAdminStore } from '../store/adminStore'

// 需要云端同步的本地键（用户学习数据）。
// 排除：登录态 token/user/adminKey、后台课程草稿 rb_admin_courses、云端列表缓存、错误上报队列。
const SYNC_KEYS = [
  'rlearn_v1_progress',        // 总体进度（courseStore）
  'rlearn_v1_vocab',          // FSRS 复习卡片（vocabStore）
  'rlearn_v1_recent',         // 最近学习
  'rlearn_v1_materials',      // 自定义资料
  'rlearn_v1_settings',       // 通用设置
  'rlearn_vocab_book',        // 答题页收藏生词本（vocabBook）
  'rlearn_quest_progress',    // RuQuest 答题断点
  'rlearn_quest_mastered',    // 已掌握
  'rlearn_quest_vocab',       // 词汇笔记
  'rlearn_quest_wrongbook',   // 错题本
  'rlearn_quest_review',      // 复习队列
  'rlearn_quest_stats',       // 学习统计
  'rlearn_quiz_results',      // AI 测验结果
  'rlearn_quest_ui',          // UI 偏好（宠物/结构显示等）
  'rlearn_quest_sfx',         // 音效设置
  'rlearn_quest_mode',        // 当前练习模式偏好
  'rlearn_unit_done',         // 课时完成标记
  'rlearn_dash_week',         // 主页周视图选择
]

const SYNC_SET = new Set(SYNC_KEYS)

function syncUser() {
  const s = useAdminStore.getState()
  if (s.token && s.user && s.user.id && ['admin', 'editor', 'viewer', 'learner'].includes(s.user.role)) {
    return s.user
  }
  return null
}

// 从解析值里递归提取时间戳（ms），取候选字段最大值；找不到返回 0
function extractTs(value) {
  let best = 0
  const walk = (v, depth) => {
    if (depth > 4 || v == null) return
    if (typeof v === 'object') {
      if (!Array.isArray(v)) {
        for (const k of ['updatedAt', 'createdAt', 'ts', 'lastPracticedAt', 'lastModifiedAt', 'updated_at']) {
          const n = Number(v[k])
          if (Number.isFinite(n) && n > best) best = n
        }
      }
      for (const k in v) walk(v[k], depth + 1)
    }
  }
  walk(value, 0)
  return best
}

function readLocal(key) {
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return null
    return JSON.parse(raw)
  } catch (e) { return null }
}

// 扫描本地白名单键，组装 { key: { value, ts } }
export function collectPack() {
  const pack = {}
  for (const key of SYNC_KEYS) {
    const value = readLocal(key)
    if (value == null) continue
    const ts = extractTs(value) || Date.now()
    pack[key] = { value, ts }
  }
  return pack
}

let dirtyTimer = null
let pendingPack = null

// 立即上报整包（beforeunload / 手动触发 / 登录后兜底）
export function flushUserData() {
  const u = syncUser()
  if (!u) return
  if (dirtyTimer) { clearTimeout(dirtyTimer); dirtyTimer = null }
  const pack = pendingPack || collectPack()
  pendingPack = null
  if (!Object.keys(pack).length) return
  apiFetch('/api/user-data/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: useAdminStore.getState().token, pack }),
    timeout: 60000,
  }).then(r => r.json()).then(j => {
    if (!j.ok) console.warn('[userSync] 上报失败:', j.error)
  }).catch(e => console.warn('[userSync] 上报异常:', e))
}

// 防抖触发：本地数据变更后调用一次即可
export function touchUserDataSync() {
  if (!syncUser()) return
  pendingPack = collectPack()
  if (dirtyTimer) clearTimeout(dirtyTimer)
  dirtyTimer = setTimeout(() => flushUserData(), 2500)
}

// 拉取云端整包，按 ts 逐键合并回本地；返回 { changed, keys }
export async function pullUserData() {
  const u = syncUser()
  if (!u) return { changed: false, keys: [] }
  try {
    const r = await apiFetch('/api/user-data/pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: useAdminStore.getState().token }),
      timeout: 60000,
    })
    const j = await r.json()
    if (!j.ok || !j.pack || typeof j.pack !== 'object') return { changed: false, keys: [] }
    const changed = []
    for (const key of Object.keys(j.pack)) {
      if (!SYNC_SET.has(key)) continue
      const entry = j.pack[key]
      if (!entry || typeof entry !== 'object') continue
      const cloudTs = Number(entry.ts) || 0
      const local = readLocal(key)
      const localTs = local == null ? 0 : (extractTs(local) || 0)
      if (local != null && localTs >= cloudTs) continue // 本地更新，保留
      try {
        localStorage.setItem(key, JSON.stringify(entry.value))
        changed.push(key)
      } catch (e) { /* 配额超限忽略 */ }
    }
    return { changed: changed.length > 0, keys: changed }
  } catch (e) {
    console.warn('[userSync] 拉取失败:', e)
    return { changed: false, keys: [] }
  }
}

// 登录后第一步：先拉云端合并回本地，再把本地整包推上去（首次登录本地数据上云）
export async function syncOnLogin() {
  await pullUserData()
  flushUserData()
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => flushUserData())
}
