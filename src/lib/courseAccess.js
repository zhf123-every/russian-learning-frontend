/**
 * courseAccess.js —— 课程付费模型与权限工具（前端配置层）
 *
 * 设计说明：
 *  - 课程元数据（类型 / 价格 / 免费试学单元数）目前以前端配置为准；
 *    后端 /api/course-packs 若下发 type / price / free_units / is_pro 字段，
 *    会自动覆盖本地配置（getCourseMeta 已做兼容），未来接后端零改动。
 *  - 购买权限先落 localStorage（模拟支付闭环），后续接真实支付 / 后端权限校验时，
 *    只需替换 isCoursePurchased / savePurchase 两个函数。
 *
 * 字段：
 *  - type:      'video' 视频课 | 'sentence' 句子课
 *  - price:     单课买断价（元）；0 = 完全免费
 *  - freeUnits: 免费试学单元数（按单元顺序，前 N 个开放，unitIndex 从 0 开始）
 *  - isPro:     true = 全站会员专享
 *  - highlights: 购买弹窗展示的课程亮点
 */

const PURCHASE_KEY = 'rlearn_purchased_courses'

// 按课程包 id 配置；未配置的课程使用 DEFAULT_META
export const COURSE_META = {
  privet_rossiya_a1: {
    type: 'sentence',
    price: 19.9,
    freeUnits: 3,
    isPro: false,
    highlights: [
      '12 个单元 · 87 步句型家族渐进构建',
      '中译俄闯关 + 听写双模式',
      '逐词词性 / 重音 / 句法成分标注',
      '连击评分、错题沉淀与结算报告',
    ],
  },
}

export const DEFAULT_META = {
  type: 'sentence',
  price: 19.9,
  freeUnits: 1,
  isPro: false,
  highlights: ['系统化单元设计', '闯关式句子练习', '即时反馈与语法解析'],
}

/** 合并后端字段与本地配置，得到课程付费元数据 */
export function getCourseMeta(pack) {
  const id = pack && pack.id
  const local = (id && COURSE_META[id]) || DEFAULT_META
  return {
    ...local,
    type: (pack && (pack.course_type || pack.type)) || local.type,
    price: pack && pack.price != null ? Number(pack.price) : local.price,
    freeUnits:
      pack && pack.free_units != null ? Number(pack.free_units) : local.freeUnits,
    isPro: pack && pack.is_pro != null ? !!pack.is_pro : local.isPro,
  }
}

export function isFreeCourse(meta) {
  return !meta.isPro && Number(meta.price) <= 0
}

/** 完全开放：免费课 或 已购买 */
export function isCourseFullyOpen(pack, purchasedMap) {
  const meta = getCourseMeta(pack)
  if (isFreeCourse(meta)) return true
  return !!(purchasedMap && purchasedMap[pack.id])
}

function safeParse(raw, fallback) {
  try {
    return JSON.parse(raw) || fallback
  } catch (e) {
    return fallback
  }
}

export function getPurchasedMap() {
  if (typeof window === 'undefined') return {}
  return safeParse(window.localStorage.getItem(PURCHASE_KEY) || '{}', {})
}

export function isCoursePurchased(packId) {
  const m = getPurchasedMap()
  return !!(m && m[packId])
}

/** 模拟购买成功后写入权限；真实支付接入时替换本函数即可 */
export function savePurchase(packId, info = {}) {
  if (typeof window === 'undefined') return
  const m = getPurchasedMap()
  m[packId] = { at: Date.now(), kind: 'buy', ...info }
  try {
    window.localStorage.setItem(PURCHASE_KEY, JSON.stringify(m))
  } catch (e) {
    /* 存储不可用时静默 */
  }
  try {
    window.dispatchEvent(new CustomEvent('rlearn:purchase-changed'))
  } catch (e) {
    /* 忽略 */
  }
}

/**
 * 单元是否解锁。unitIndex 从 0 开始，按课程单元顺序。
 * 规则：免费课全开；已购买全开；否则前 freeUnits 个单元开放。
 */
export function isUnitUnlocked({ pack, unitIndex, purchasedMap }) {
  if (!pack) return true
  const meta = getCourseMeta(pack)
  if (isFreeCourse(meta)) return true
  if (purchasedMap && purchasedMap[pack.id]) return true
  return unitIndex >= 0 && unitIndex < meta.freeUnits
}

/** 课程卡片 / 详情用的价格文案 */
export function priceLabel(meta) {
  if (meta.isPro) return '会员专享'
  if (Number(meta.price) <= 0) return '免费'
  const p = Number(meta.price)
  return '¥' + (p % 1 === 0 ? p.toFixed(0) : p.toFixed(1))
}

export function typeLabel(type) {
  return type === 'video' ? '视频课' : '句子课'
}

/**
 * 学习页直链守卫：根据 packId + unitId 判断是否可进入。
 * 返回 { allowed: true } 或 { allowed:false, packId, unitId }。
 * 无 packId（旧链接 / 无法判定归属）时放行，避免误伤。
 */
export async function checkUnitAccess(apiBase, packId, unitId, fetchImpl) {
  if (!packId || !unitId) return { allowed: true }
  const fetcher = fetchImpl || fetch
  try {
    const [packsRes, unitsRes] = await Promise.all([
      fetcher(`${apiBase}/api/course-packs`),
      fetcher(`${apiBase}/api/course-packs/${encodeURIComponent(packId)}/units`),
    ])
    const packsJson = await packsRes.json()
    const unitsJson = await unitsRes.json()
    const pack = (packsJson.data || []).find((p) => p.id === packId)
    const units = (unitsJson.data && unitsJson.data.units) || []
    const idx = units.findIndex((u) => u.id === unitId)
    if (!pack || idx < 0) return { allowed: true }
    const unlocked = isUnitUnlocked({
      pack,
      unitIndex: idx,
      purchasedMap: getPurchasedMap(),
    })
    return { allowed: unlocked, pack, unitIndex: idx }
  } catch (e) {
    // 网络异常不拦截学习（避免后端抖动把用户挡在门外）
    return { allowed: true }
  }
}
