/**
 * Bloque F1: cuentas nuevas, confirmación de correo, recuperación y Google, contra la
 * API de Docker. Solo los widgets de Cloudflare y de Google son dobles.
 */
import { expect, test } from '@playwright/test'

import { evidence, fakeExternalWidgets, login } from './support'

test.beforeEach(async ({ page }) => {
  await fakeExternalWidgets(page)
})

test('una persona del equipo crea su cuenta y, sin confirmar el correo, pide un enlace nuevo', async ({
  page,
}) => {
  const email = `registro.${Date.now()}@aspar.org`
  await page.goto('/ingresar')
  await page.getByRole('link', { name: 'Créala aquí' }).click()
  await expect(page).toHaveURL(/\/crear-cuenta$/)

  await page.getByLabel('Nombre completo').fill('Marina Registro')
  await page.getByLabel('Correo electrónico').fill(email)
  // Los campos obligatorios llevan «*» en la etiqueta
  await page.getByLabel(/^Contraseña/).fill('Marina2026')
  await page.getByLabel('Repite la contraseña').fill('Marina2026')
  await page.getByRole('button', { name: 'Soy una persona (prueba)' }).click()
  await evidence(page, 'F1-08-crear-cuenta')
  await page.getByRole('button', { name: 'Crear cuenta' }).click()

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Revisa tu correo.',
  )
  await expect(page.getByText(email)).toBeVisible()

  // Sin confirmar el correo no entra, pero puede pedir otro enlace
  await login(page, email, 'Marina2026')
  await expect(
    page.getByRole('alert').filter({ hasText: 'Confirma tu correo' }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Enviarme un enlace nuevo' }).click()
  await expect(page).toHaveURL(/\/verificar-correo\?correo=/)
  await expect(page.getByLabel('Correo electrónico')).toHaveValue(email)

  await page.getByRole('button', { name: 'Soy una persona (prueba)' }).click()
  await page.getByRole('button', { name: 'Enviarme un enlace nuevo' }).click()
  await expect(page.getByText('te enviamos un correo')).toBeVisible()
})

test('un enlace de confirmación vencido lo explica y ofrece pedir otro', async ({
  page,
}) => {
  await page.goto('/verificar-correo?token=enlace-que-no-existe-0000000000')

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Este enlace ya no sirve.',
  )
  await expect(
    page.getByText('El enlace no es válido o ya venció'),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Enviarme un enlace nuevo' }),
  ).toBeVisible()
})

test('recuperar la contraseña responde igual exista o no la cuenta', async ({
  page,
}) => {
  await page.goto('/ingresar')
  await page.getByRole('link', { name: '¿Olvidaste tu contraseña?' }).click()
  await expect(page).toHaveURL(/\/recuperar-contrasena$/)

  await page.getByLabel('Correo electrónico').fill('quien.sea@aspar.org')
  await page.getByRole('button', { name: 'Soy una persona (prueba)' }).click()
  await page.getByRole('button', { name: 'Enviarme el enlace' }).click()

  await expect(
    page.getByText('Si los datos son correctos, te enviamos un correo'),
  ).toBeVisible()
  await evidence(page, 'F1-09-recuperar-contrasena')
})

test('un enlace de recuperación inválido no cambia la contraseña', async ({
  page,
}) => {
  await page.goto(
    '/restablecer-contrasena?token=enlace-que-no-existe-0000000000',
  )

  await page.getByLabel('Contraseña nueva', { exact: true }).fill('Nueva2026')
  await page.getByLabel('Repite la contraseña nueva').fill('Nueva2026')
  await page.getByRole('button', { name: 'Guardar contraseña' }).click()

  const alert = page.getByRole('alert').filter({ hasText: 'ya venció' })
  await expect(alert).toBeVisible()
  await expect(
    alert.getByRole('link', { name: 'Pedir un enlace nuevo' }),
  ).toBeVisible()
})

test('«Continuar con Google» llega a la API y muestra su respuesta', async ({
  page,
}) => {
  await page.goto('/ingresar')
  await expect(page.getByText('o con tu correo')).toBeVisible()

  const google = page.waitForResponse('**/auth/google')
  await page
    .getByRole('button', { name: 'Continuar con Google (prueba)' })
    .click()
  const response = await google

  // La API de Docker no tiene GOOGLE_CLIENT_ID: responde 503 con un mensaje claro
  expect(response.status()).toBe(503)
  await expect(
    page.getByRole('alert').filter({ hasText: 'Google no está configurado' }),
  ).toBeVisible()
})
