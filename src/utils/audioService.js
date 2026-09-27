/**
 * audioService.js —— 全局唯一音频控制器（工业级）
 *
 * 1. 同一时刻只有一个音频在发声（stopGlobalAudio 停掉当前发声实例后再播新的）。
 * 2. 播放生命周期严格固定：暂停旧 → 复位进度 → 加载新 → 播放。
 * 3. 自动播放策略（Autoplay Policy）拦截时通过 onBlocked 回调通知前端点亮提示，
 *    绝不抛错、绝不卡死。
 * 4. preloadGlobalAudio(url) 用独立隐藏 Audio 提前缓冲内容，正式播放时秒开。
 * 5. 支持直接播已就绪的 Audio 实例（el 参数）：Preloader/答题页已 canplay 的
 *    预载 Audio 直接 play，跳过 src=/load/ 的重新加载开销 → 真正零延迟。
 *
 * 所有答题页面（中译俄 / 听写 / 听力 / 口语 / 答对面板 / 听写考试）统一走这里，
 * 不要再在组件内 new Audio() 播放。
 */

// —— 兜底发声实例（未传入预载实例时使用）——
export const globalAudio = new Audio()
globalAudio.preload = 'auto'
globalAudio.volume = 1

let _playToken = 0        // 播放代次：新的 play / stop 使旧代次的所有回调（含重播循环）作废
let _currentUrl = ''      // 当前发音 URL（供 isGlobalAudioPlaying 判断）
let _currentEl = null     // 当前发声元素（globalAudio 或传入的预载实例）

/** 立即停止并复位（切题 / 暂停 / 组件卸载必调） */
export function stopGlobalAudio() {
  _playToken += 1
  _currentUrl = ''
  try {
    const el = _currentEl || globalAudio
    if (!el.paused) el.pause()
    el.currentTime = 0
    el.onended = null
    el.onerror = null
  } catch (e) { /* ignore */ }
  _currentEl = null
}

/**
 * 播放：严格 停旧 → 复位 → 加载新 → 播放。
 * @param {string} url 音频地址；传 el 时可为空串（用 el.src）
 * @param {object} opts
 *   el          已内容就绪的 Audio 实例（Preloader/预载缓存命中时传入 → 直接播，零延迟）
 *   times       播放次数（默认 1；>1 时播完自动重播，切题立即作废）
 *   rate        播放速率（默认 1）
 *   gap         重播间隔 ms（默认 600）
 *   onFinished  全部播完回调
 *   onBlocked   被自动播放策略拦截回调（前端点亮"播放"提示，提示用户点击屏幕激活）
 * @returns {{ token: number, url: string }}
 */
export function playGlobalAudio(url, opts = {}) {
  const { times = 1, rate = 1, gap = 600, onFinished, onBlocked, el: elOpt } = opts
  if (!url && !elOpt) return { token: 0, url: '' }

  stopGlobalAudio()                    // 1) 先停旧、复位（任何时候只有一个音频在发声）
  const token = _playToken

  const el = (elOpt && typeof elOpt.play === 'function') ? elOpt : globalAudio
  _currentEl = el

  if (el === globalAudio) {
    globalAudio.preload = 'auto'       // 2) 预加载策略
    globalAudio.playbackRate = Number(rate) || 1
    globalAudio.src = url              // 3) 赋新源
    globalAudio.load()
  } else {
    // 已就绪实例：内容已在缓冲区 → 直接播（跳过重新加载，零延迟）
    try { el.playbackRate = Number(rate) || 1 } catch (e) { /* ignore */ }
  }
  _currentUrl = url || el.src || ''

  let played = 0
  el.onerror = () => { if (token === _playToken) _currentUrl = '' }

  const tryPlay = () => {
    const p = el.play()
    if (p && typeof p.catch === 'function') {
      p.catch(() => {
        if (token !== _playToken) return  // 已被切题打断，静默放弃
        _currentUrl = ''
        if (onBlocked) onBlocked()        // 自动播放策略拦截 → 提示用户点击激活
      })
    }
  }

  tryPlay()

  el.onended = () => {
    if (token !== _playToken) return      // 已被切题打断 → 绝对不再续播
    played += 1
    if (played < times) {
      el.currentTime = 0
      tryPlay()
    } else {
      _currentUrl = ''
      if (onFinished) onFinished()
    }
  }

  return { token, url }
}

// —— 预加载：不发声，仅缓冲内容（独立隐藏 Audio 池，与播放实例互不干扰）——
const _preloadPool = new Map()  // url -> Audio
export function preloadGlobalAudio(url) {
  if (!url || _preloadPool.has(url)) return
  try {
    const a = new Audio()
    a.preload = 'auto'
    a.src = url
    a.load()
    _preloadPool.set(url, a)
  } catch (e) { /* 预加载失败不阻塞 */ }
}

/** 是否正在播放指定 URL（供 UI 显示播放状态） */
export function isGlobalAudioPlaying(url) {
  return !!url && url === _currentUrl && !(_currentEl || globalAudio).paused
}
