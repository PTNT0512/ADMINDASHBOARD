import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const projectRoot = process.cwd()
const appMode = String(process.env.VITE_APP_MODE || 'dashboard').trim() || 'dashboard'
const isCenterMode = appMode === 'center'
const viteCacheDir = isCenterMode ? '.vite-center' : '.vite-dashboard'
const appEntry = isCenterMode
  ? path.resolve(projectRoot, 'src', 'App.center.jsx')
  : path.resolve(projectRoot, 'src', 'App.dashboard.jsx')
const normalizePath = (value) => String(value || '').replace(/\\/g, '/')

const shouldIgnoreWatchPath = (filePath) => {
  const relativePath = normalizePath(path.relative(projectRoot, filePath))

  if (!relativePath || relativePath === '.' || relativePath === '') return false
  if (relativePath.startsWith('..')) return true

  if (
    relativePath === 'index.html'
    || relativePath === 'package.json'
    || relativePath === 'vite.config.js'
    || relativePath === 'src'
    || relativePath.startsWith('src/')
    || relativePath === 'public'
    || relativePath.startsWith('public/')
  ) {
    return false
  }

  return true
}

export default defineConfig(({ command }) => ({
  base: command === 'build' ? './' : '/',
  cacheDir: viteCacheDir,
  plugins: [react()],
  resolve: {
    alias: {
      '@app-root': appEntry,
    },
  },
  optimizeDeps: {
    entries: ['index.html'],
  },
  build: {
    target: 'es2019',
    sourcemap: false,
    minify: isCenterMode ? false : 'esbuild',
    cssMinify: isCenterMode ? false : 'esbuild',
    reportCompressedSize: !isCenterMode,
    chunkSizeWarningLimit: 1500,
  },
  server: {
    fs: {
      strict: true,
      allow: [
        projectRoot,
        path.resolve(projectRoot, 'src'),
        path.resolve(projectRoot, 'public'),
      ],
    },
    watch: {
      ignored: shouldIgnoreWatchPath,
    },
  },
}))