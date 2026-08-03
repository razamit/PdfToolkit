import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { pdfjsWasmPlugin } from './vite/pdfjsWasmPlugin.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), pdfjsWasmPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // The service worker reads this to precache every hashed app/worker chunk,
    // including dynamic OCR and font chunks, without hard-coding Vite filenames.
    manifest: 'vite-manifest.json',
  },
})
