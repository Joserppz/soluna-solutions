import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
    // SCRUM-61 / SCRUM-97: cobertura real registrada en cada ejecución del CI
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,vue}'],
      exclude: ['src/**/*.spec.ts', 'src/main.ts'],
      reporter: ['text', 'text-summary', 'json-summary', 'lcovonly'],
      reportsDirectory: 'coverage',
      // Mínimo de RNF-05 (70%); el CI falla si la cobertura baja de este valor
      thresholds: { statements: 70, branches: 70, functions: 70, lines: 70 },
    },
  },
})
