import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    // En Docker Desktop (Windows) los cambios de archivos no llegan al contenedor:
    // docker-compose.yml activa el sondeo con WATCH_POLLING=true.
    watch: { usePolling: process.env.WATCH_POLLING === 'true' },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
  },
})
