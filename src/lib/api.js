// API 地址管理：开发环境指向 localhost，生产环境指向 Render 后端域名
// 用法：把原来写死的 fetch('/api/xxx', ...) 改成 apiFetch('/api/xxx', ...)
//
// 生产环境用 Netlify 环境变量 VITE_API_BASE 区分：
//   VITE_API_BASE = https://你的后端.onrender.com   （末尾不要带斜杠）
// 开发环境不设置该变量，会自动回退到同域（本地 python server.py 的 :8000）。

const API_BASE = (import.meta.env && import.meta.env.VITE_API_BASE) || ''

export { API_BASE }

// 统一的 fetch 封装：自动给相对路径 /api/xxx 拼上后端域名前缀
export function apiFetch(path, options = {}) {
  const url = API_BASE ? (API_BASE + path) : path
  return fetch(url, options)
}

// 生成媒体资源地址（用于 <video src> / <img src> 等），同样带前缀
export function apiUrl(path) {
  return API_BASE ? (API_BASE + path) : path
}
