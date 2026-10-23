// b2:// 媒体地址 → 可被浏览器加载的代理地址（封面/缩略图）
// 浏览器不认识 b2:// 协议，img/poster 必须用 http 代理地址
const BACKEND =
  (typeof location !== 'undefined' && location.hostname && location.hostname.indexOf('localhost') === 0)
    ? 'http://localhost:8000'
    : 'https://russian-learning-jetq.onrender.com'

export function thumbUrl(url) {
  if (!url) return ''
  const s = String(url)
  if (s.startsWith('b2://')) return BACKEND + '/api/videos/thumb?u=' + encodeURIComponent(s)
  return s
}
