import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
    // La primera prueba de cada archivo monta la app completa y transforma todas las
    // vistas: en una PC más lenta (o con Windows) puede pasar los 5 s por defecto
    testTimeout: 20_000,
    // SCRUM-61 / SCRUM-97: cobertura real registrada en cada ejecución del CI
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,vue}'],
      // Las ayudas de prueba (__test__) no son código de la aplicación
      exclude: ['src/**/*.spec.ts', 'src/**/__test__/**', 'src/main.ts'],
      reporter: ['text', 'text-summary', 'json-summary', 'lcovonly'],
      reportsDirectory: 'coverage',
      // Mínimo de RNF-05 (70%); el CI falla si la cobertura baja de este valor
      thresholds: { statements: 70, branches: 70, functions: 70, lines: 70 },
    },
  },
})
