import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    cssTarget: ['chrome107', 'edge107', 'firefox103', 'safari16'],
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8180',
        changeOrigin: true,
        secure: false,
        timeout: 600000,
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            if (req.headers.cookie) {
              proxyReq.setHeader('cookie', req.headers.cookie)
            }
          })
          proxy.on('error', (err, _req, _res) => {
            console.log('Proxy error:', err)
          })
        },
      },
      '/download': {
        target: 'http://127.0.0.1:8180',
        changeOrigin: true,
        secure: false,
      },
      '/dlink': {
        target: 'http://127.0.0.1:8180',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
