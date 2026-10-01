import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/',
  // 显式预构建 three 主包 + examples 子模块为单一共享实例，
  // 避免 dev 模式下双实例循环引用导致 TDZ 报错（Cannot access 'X' before initialization）
  optimizeDeps: {
    include: [
      'three',
      'three/examples/jsm/environments/RoomEnvironment.js',
    ],
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': { target: 'https://russian-learning-jetq.onrender.com', changeOrigin: true, timeout: 180000, proxyTimeout: 180000 },
      '/audio_cache': { target: 'https://russian-learning-jetq.onrender.com', changeOrigin: true, timeout: 180000, proxyTimeout: 180000 },
    },
  },
  preview: {
    port: 4173,
    strictPort: true,
    proxy: {
      '/api': { target: 'https://russian-learning-jetq.onrender.com', changeOrigin: true, timeout: 180000, proxyTimeout: 180000 },
      '/audio_cache': { target: 'https://russian-learning-jetq.onrender.com', changeOrigin: true, timeout: 180000, proxyTimeout: 180000 },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
  },
})
