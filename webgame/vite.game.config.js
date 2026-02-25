import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3005, // Cổng cho Game Server
    strictPort: true,
    fs: {
      allow: ['..'] // Cho phép import file từ thư mục cha (admin-app)
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@game': path.resolve(__dirname, './game'),
      '@components': path.resolve(__dirname, './components')
    }
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
      },
    },
  },
})
