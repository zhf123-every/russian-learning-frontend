// 封面图片永久缓存 Service Worker
// 背景：B2 预签名 URL 每次刷新都会变（X-Amz-Signature 等参数不同），导致浏览器缓存永远不命中、
// 每次打开网站都要重新下载封面。这里按「域名 + 路径」做缓存 key（路径不变），命中后直接返回缓存，
// 封面从此免加载。新上传的封面 B2 key 是随机哈希 → 路径不同 → 缓存 miss → 自动下载新图。
//
// v2 修复（2026-10-20）：
//   v1 会把「状态 < 400 但内容无法解码」的响应（如 504 空响应、非图片错误页）也写进缓存，
//   导致封面 <img> 拿到坏缓存、naturalWidth=0、被 onError 隐藏 → 列表封面空白/显示占位图。
//   v2 只缓存「200 且 Content-Type 为 image/*」的真实图片；命中缓存时同样校验类型，
//   损坏的旧缓存自动删除并重新下载；网络失败时不返回空 504（那会再次污染 img），改为穿透回源。
const CACHE_NAME = 'rlearn-covers-v2'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  // 清理所有旧版本封面缓存（v1 中可能含损坏响应），避免坏缓存继续命中
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('rlearn-covers-') && k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  // 仅拦截 B2 媒体（封面/缩略图），其余请求一律不干预
  if (!url.hostname.includes('backblazeb2.com')) return

  // 缓存 key = 去掉签名查询参数的路径
  const key = url.origin + url.pathname

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME)
      // 命中缓存 → 校验是真实图片后才返回；损坏的缓存删除并重建
      try {
        const hit = await cache.match(key)
        if (hit) {
          const ct = (hit.headers && hit.headers.get('content-type')) || ''
          if (hit.status === 200 && /image\//.test(ct)) return hit
          await cache.delete(key)
        }
      } catch (e) { /* 忽略 */ }
      // 未命中 → 下载；仅缓存「200 且确实是图片」的响应
      try {
        const resp = await fetch(event.request)
        if (resp && resp.status === 200) {
          const ct = resp.headers.get('content-type') || ''
          if (/image\//.test(ct)) {
            try { await cache.put(key, resp.clone()) } catch (e) { /* 存失败忽略 */ }
          }
        }
        return resp
      } catch (e) {
        // 离线兜底：返回缓存（若有）；无缓存时直接放行原始请求（由浏览器/网络自行决定结果），
        // 不构造空响应，避免把无法解码的响应交给 <img> 造成封面空白
        try {
          const fallback = await cache.match(key)
          if (fallback) return fallback
        } catch (e2) { /* 忽略 */ }
        return fetch(event.request).catch(() => new Response('', { status: 502 }))
      }
    })()
  )
})
