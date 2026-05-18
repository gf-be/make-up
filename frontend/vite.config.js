import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      resolvers: [ElementPlusResolver()],
      dts: false
    }),
    Components({
      resolvers: [ElementPlusResolver({ importStyle: 'css' })],
      dts: false
    })
  ],
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
  },
  build: {
    /** echarts / element-plus / exceljs 等单包仍可 >900kB；已拆成独立 vendor chunk，阈值略放宽以免误报 */
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('echarts') || id.includes('zrender')) {
            return 'vendor-echarts'
          }
          if (id.includes('element-plus') || id.includes('@element-plus/icons-vue')) {
            return 'vendor-element-plus'
          }
          if (id.includes('exceljs')) return 'vendor-exceljs'
          if (id.includes('jszip')) return 'vendor-jszip'
          if (id.includes('xlsx')) return 'vendor-sheetjs'
          if (id.includes('vue-router')) return 'vendor-vue-router'
          if (id.includes('@vue')) return 'vendor-vue'
          if (id.includes('node_modules/vue/') || id.includes('node_modules\\vue\\')) {
            return 'vendor-vue'
          }
          if (id.includes('axios')) return 'vendor-axios'
          if (id.includes('dayjs')) return 'vendor-dayjs'
        }
      }
    }
  }
})
