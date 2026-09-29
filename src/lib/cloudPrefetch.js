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
