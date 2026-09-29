import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import GlobalTheme from './components/GlobalTheme'
import './styles.css'
import './styles/tailwind.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <GlobalTheme />
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
)

// 注册封面离线缓存 Service Worker（仅缓存 B2 封面图片，实现封面永久免加载）
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
