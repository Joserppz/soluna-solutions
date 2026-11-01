/**
 * Recorridos de punta a punta (E2E) contra la API real.
 *
 * Requisitos: la API y la base de Docker con los datos de demostración
 *   docker compose up -d && docker compose exec api python -m scripts.seed_demo
 * Luego, desde Frontend/:  npm run e2e
 *
 * El servidor de Vite se levanta solo (o se reutiliza si ya está en el puerto 5173).
 * Con E2E_EVIDENCIAS=<carpeta> se guardan capturas para docs/evidencias.
 */
import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173'

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
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
    command: 'npm run dev -- --port 5173 --strictPort',
    url: baseURL,
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
