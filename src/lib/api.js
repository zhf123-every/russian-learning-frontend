// API 地址管理：开发环境指向 localhost，生产环境指向 Render 后端域名
// 用法：把原来写死的 fetch('/api/xxx', ...) 改成 apiFetch('/api/xxx', ...)
//
// 生产环境用 Netlify 环境变量 VITE_API_BASE 区分：
//   VITE_API_BASE = https://你的后端.onrender.com   （末尾不要带斜杠）
// 开发环境不设置该变量，会自动回退到同域（本地 python server.py 的 :8000）。

const API_BASE = ((import.meta.env && import.meta.env.VITE_API_BASE) || '').trim().replace(/\/+$/, '')

export { API_BASE }

// 统一的 fetch 封装：自动给相对路径 /api/xxx 拼上后端域名前缀
// 默认 12 秒超时（后端 Render 免费层冷启动时会很久没响应，超时抛错避免无限 loading）；
// 调用方已传 signal 时（自行控制超时）不做默认超时覆盖
export function apiFetch(path, options = {}) {
  const url = API_BASE ? (API_BASE + path) : path
  const { timeout = 12000, ...rest } = options
  if (rest.signal) return fetch(url, rest)
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeout)
  return fetch(url, { ...rest, signal: ctrl.signal }).finally(() => clearTimeout(timer))
}

// 生成媒体资源地址（用于 <video src> / <img src> 等），同样带前缀
export function apiUrl(path) {
  return API_BASE ? (API_BASE + path) : path
}
