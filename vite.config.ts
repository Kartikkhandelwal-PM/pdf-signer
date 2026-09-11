import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/pdf-signer/',
  // 5173 is Vite's default and gets claimed by whatever else is running locally, so this dev
  // server is pinned somewhere quieter.
  server: { port: 5180 },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
