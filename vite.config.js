import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',  // 用相对路径，静态托管在任意路径（含 SPA 子路由）都能正确加载资源
  server: {
    host: '0.0.0.0',  // 监听所有网络接口，允许局域网访问
    port: 5173,
    strictPort: false,  // 端口被占用时自动选择下一个可用端口
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
  },
})