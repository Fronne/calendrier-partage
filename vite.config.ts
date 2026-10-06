import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // L'API tourne dans le Worker local (wrangler dev)
    proxy: { '/api': 'http://127.0.0.1:8787' },
  },
  test: { include: ['shared/**/*.test.ts', 'worker/**/*.test.ts'] },
})
