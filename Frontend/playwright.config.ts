/**
 * Recorridos de punta a punta (E2E) contra la API real.
 *
 * Requisitos: la API y la base de Docker con los datos de demostración
 *   docker compose up -d && docker compose exec api python -m scripts.seed_demo
 * Luego, desde Frontend/:  npm run e2e
 *
 * Se prueba el build de producción: Playwright lo construye y lo sirve con
 * `vite preview` en el puerto 4173 (origen permitido por la API de docker compose).
 * Los scripts de Google y de Cloudflare se reemplazan por dobles en el navegador;
 * todo lo demás va contra la API real.
 * Con E2E_EVIDENCIAS=<carpeta> se guardan capturas para docs/evidencias.
 * Al terminar se borran las actividades y materiales «de prueba» (E2E_LIMPIAR=0 lo evita).
 */
import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:4173'

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  outputDir: './e2e-resultados',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [['list']],
  use: {
    baseURL,
    locale: 'es-BO',
    timezoneId: 'America/La_Paz',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: process.env.PW_CHROMIUM_PATH
      ? { executablePath: process.env.PW_CHROMIUM_PATH }
      : {},
  },
  projects: [
    {
      name: 'escritorio',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  webServer: {
    command:
      'npx vite build --outDir dist-e2e --emptyOutDir && npx vite preview --outDir dist-e2e --port 4173 --strictPort',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_API_BASE_URL:
        process.env.E2E_API_URL ?? 'http://localhost:8000/api/v1',
      VITE_GOOGLE_CLIENT_ID: 'e2e-prueba.apps.googleusercontent.com',
      // Clave pública de prueba de Cloudflare (siempre aprueba)
      VITE_TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
    },
  },
})
