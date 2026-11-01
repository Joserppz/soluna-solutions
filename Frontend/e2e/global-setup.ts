/**
 * Ingresa una sola vez como Administración por la API y guarda la sesión. Así el
 * recorrido no gasta los intentos de ingreso que limita la API (10 por cuenta cada
 * 15 minutos, RNF-02).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

import { request } from '@playwright/test'

import { ACCOUNTS, ADMIN_CSRF, ADMIN_STATE, API_URL } from './support'

export default async function globalSetup() {
  const context = await request.newContext()
  const response = await context.post(`${API_URL}/auth/login`, {
    data: ACCOUNTS.admin,
  })
  if (!response.ok())
    throw new Error(
      `No se pudo ingresar como Administración (¿corre la API con seed_demo?): ${await response.text()}`,
    )
  const { csrfToken } = (await response.json()) as { csrfToken: string }
  mkdirSync(dirname(ADMIN_STATE), { recursive: true })
  await context.storageState({ path: ADMIN_STATE })
  writeFileSync(ADMIN_CSRF, csrfToken)
  await context.dispose()
}
