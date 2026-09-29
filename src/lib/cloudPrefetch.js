// 云端课程名单预拉：应用启动时就在后台拉取一次云端名单（含 https 封面），
// 用户进入商城页时直接读内存缓存，封面秒出，无需再等待网络请求。
// 商城页仍会后台静默刷新一次，保证新发布的课程可见。
import { apiFetch } from './api'

let cached = null      // 内存缓存：后端 /api/videos/list 的原始响应
let inflight = null    // 进行中的预拉 promise

export function prefetchCloudList() {
  if (cached) return Promise.resolve(cached)
  if (inflight) return inflight
  inflight = apiFetch('/api/videos/list')
    .then((r) => r.json())
    .then((j) => {
      cached = j
      inflight = null
      // 顺手预载所有课程封面：触发下载 + 写入 Service Worker 缓存，用户看到封面时无需等待
      try {
        const courses = (j.videos || []).filter((v) => v && v.kind === 'course')
        const urls = courses
          .map((c) => c.thumbnail || c.posterUrl || c.cover)
          .filter((u) => u && String(u).startsWith('http'))
        urls.forEach((u) => {
          const img = new Image()
          img.src = u
        })
      } catch (e) { /* 预载失败不影响主流程 */ }
      return j
    })
    .catch((e) => {
      inflight = null
      throw e
    })
  return inflight
}

export function getCloudCache() {
  return cached
}
