import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 3000,
    host: true,
    open: true,
    watch: {
      usePolling: false,
      interval: 100
    },
    proxy: {
      '/api': {
        // target: 'https://match-completed-ruled-grip.trycloudflare.com/',
        // 后端端口号
        target: 'http://localhost:3003',
        changeOrigin: true
      },
      '/upload': {
        target: 'http://localhost:3003',
        changeOrigin: true
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  }
})
