// 视频播放地址解析：b2://key → B2 预签名可播链接；http(s) 原样返回
import { apiFetch } from './api'

export async function resolvePlayUrl(url) {
  if (!url) return ''
  if (url.startsWith('b2://')) {
    try {
      const r = await apiFetch('/api/videos/resolve?url=' + encodeURIComponent(url))
      const j = await r.json()
      if (j.ok && j.url) return j.url
    } catch (e) { /* 后端不可用时返回原地址，让播放器报错提示 */ }
  }
  return url
}
