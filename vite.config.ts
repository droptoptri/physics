import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { env } from 'node:process'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'pages' ? (env.SITE_BASE_PATH || '/physics/') : '/',
  define: { 'import.meta.env.VITE_SITE_PREVIEW': JSON.stringify(mode === 'pages' ? 'true' : 'false') },
  build: { sourcemap: false, outDir: mode === 'pages' ? 'dist-pages' : 'dist' },
  server: { host: '0.0.0.0' },
}))
