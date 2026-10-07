import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

declare const process: { env: Record<string, string | undefined> }

export default defineConfig({
  plugins: [react()],
  server: {
    // L'aperçu de Claude peut imposer un autre port (PORT) quand 5173 est déjà pris
    port: Number(process.env.PORT) || 5173,
    // L'API tourne dans le Worker local (wrangler dev)
    proxy: { '/api': 'http://127.0.0.1:8787' },
  },
  test: { include: ['shared/**/*.test.ts', 'worker/**/*.test.ts', 'src/**/*.test.ts'] },
})
