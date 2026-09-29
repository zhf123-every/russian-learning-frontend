// 封面图片永久缓存 Service Worker
// 背景：B2 预签名 URL 每次刷新都会变（X-Amz-Signature 等参数不同），导致浏览器缓存永远不命中、
// 每次打开网站都要重新下载封面。这里按「域名 + 路径」做缓存 key（路径不变），命中后直接返回缓存，
// 封面从此免加载。新上传的封面 B2 key 是随机哈希 → 路径不同 → 缓存 miss → 自动下载新图。
const CACHE_NAME = 'rlearn-covers-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  // 仅拦截 B2 媒体（封面/缩略图），其余请求一律不干预
  if (!url.hostname.includes('backblazeb2.com')) return

  // 缓存 key = 去掉签名查询参数的路径
  const key = url.origin + url.pathname

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      // 命中缓存 → 直接返回（免加载）
      try {
        const hit = await cache.match(key)
        if (hit) return hit
      } catch (e) { /* 忽略 */ }
      // 未命中 → 下载并写入缓存
      try {
        const resp = await fetch(event.request)
        if (resp && resp.status < 400) {
          try { await cache.put(key, resp.clone()) } catch (e) { /* 存失败忽略 */ }
        }
        return resp
      } catch (e) {
        // 离线兜底：返回缓存（若有）
        try {
          const fallback = await cache.match(key)
          if (fallback) return fallback
        } catch (e2) { /* 忽略 */ }
        return new Response('', { status: 504 })
      }
    })
  )
})
