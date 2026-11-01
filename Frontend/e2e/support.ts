/** Ayudas de los recorridos E2E: cuentas de demostración, API directa y capturas. */
import { readFileSync } from 'node:fs'

import { request, type Page } from '@playwright/test'

export const API_URL = process.env.E2E_API_URL ?? 'http://localhost:8000/api/v1'

/** Sesión de Administración guardada por global-setup.ts. */
export const ADMIN_STATE = 'e2e-resultados/.sesion-administracion.json'
export const ADMIN_CSRF = 'e2e-resultados/.csrf-administracion.txt'

/** Cuentas que crea `python -m scripts.seed_demo`. */
export const ACCOUNTS = {
  admin: { email: 'admin@aspar.org', password: 'Admin2026!' },
  volunteer: { email: 'voluntario@aspar.org', password: 'Voluntario2026!' },
  pending: { email: 'pendiente@aspar.org', password: 'Pendiente2026!' },
}

export async function login(page: Page, email: string, password: string) {
  await page.goto('/ingresar')
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByLabel('Contraseña', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Ingresar' }).click()
}

/** Llamadas directas a la API como Administración, para preparar datos. */
export async function adminApi() {
  const context = await request.newContext({ storageState: ADMIN_STATE })
  const csrfToken = readFileSync(ADMIN_CSRF, 'utf8')
  return {
    post: (path: string, data: unknown) =>
      context.post(`${API_URL}${path}`, {
        data,
        headers: { 'X-CSRF-Token': csrfToken },
      }),
    dispose: () => context.dispose(),
  }
}

/** Captura para docs/evidencias, solo si se pide con E2E_EVIDENCIAS. */
export async function evidence(page: Page, name: string) {
  const folder = process.env.E2E_EVIDENCIAS
  if (!folder) return
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(350)
  await page.screenshot({ path: `${folder}/${name}.png` })
}

/**
 * Dobles de los scripts de Cloudflare Turnstile y de Google Identity Services: el
 * navegador de prueba no depende de esos servicios. Las peticiones a la API siguen
 * siendo reales.
 */
export async function fakeExternalWidgets(page: Page) {
  await page.route('**/turnstile/v0/api.js*', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `window.turnstile = {
        render(element, options) {
          const button = document.createElement('button')
          button.type = 'button'
          button.textContent = 'Soy una persona (prueba)'
          button.onclick = () => options.callback('XXXX.DUMMY.TOKEN.XXXX')
          element.appendChild(button)
          return 'prueba'
        },
        reset() {},
        remove() {},
      }`,
    }),
  )
  await page.route('**/gsi/client', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `window.google = { accounts: { id: {
        initialize(options) { window.__googleCallback = options.callback },
        renderButton(element) {
          const button = document.createElement('button')
          button.type = 'button'
          button.textContent = 'Continuar con Google (prueba)'
          button.onclick = () => window.__googleCallback({ credential: 'credencial.e2e.prueba' })
          element.appendChild(button)
        },
      } } }`,
    }),
  )
}
