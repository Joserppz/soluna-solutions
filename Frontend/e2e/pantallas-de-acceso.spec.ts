/**
 * Las pantallas de acceso entran completas en la ventana, sin barra de
 * desplazamiento, desde 1366×768 hasta 1920×1080 (alto útil del navegador de
 * ~680 a ~900 px, con la barra de tareas y las pestañas visibles). En el celular
 * la página se desplaza con normalidad.
 */
import { expect, test, type Page } from '@playwright/test'

import { ACCOUNTS, adminApi, fakeExternalWidgets, login } from './support'

const DESKTOP = [
  { width: 1366, height: 680 },
  { width: 1366, height: 900 },
  { width: 1536, height: 730 }, // 1920×1080 con zoom de Windows al 125 %
  { width: 1920, height: 680 },
  { width: 1920, height: 900 },
]

async function pageScrolls(page: Page) {
  return page.evaluate(
    () =>
      document.documentElement.scrollHeight >
      document.documentElement.clientHeight,
  )
}

/** true si la columna del formulario necesita desplazarse por dentro. */
async function formColumnScrolls(page: Page) {
  return page.evaluate(() => {
    const column = document.querySelector('.auth__main') as HTMLElement
    return column.scrollHeight > column.clientHeight + 1
  })
}

test.beforeEach(async ({ page }) => {
  await fakeExternalWidgets(page)
})

for (const size of DESKTOP) {
  test(`ingreso a ${size.width}×${size.height}: todo a la vista y sin barra de desplazamiento`, async ({
    page,
  }) => {
    await page.setViewportSize(size)
    await page.goto('/ingresar')
    await expect(
      page.getByRole('button', { name: 'Continuar con Google (prueba)' }),
    ).toBeVisible()

    expect(await pageScrolls(page)).toBe(false)
    expect(await formColumnScrolls(page)).toBe(false)
    for (const element of [
      page.getByRole('link', { name: 'Volver al sitio' }),
      page.getByRole('heading', { name: 'Hola de nuevo.' }),
      page.getByText('Ingresa con la cuenta que te dio la asociación.'),
      page.getByRole('button', { name: 'Continuar con Google (prueba)' }),
      page.getByLabel('Correo electrónico'),
      page.getByLabel('Contraseña', { exact: true }),
      page.getByRole('button', { name: 'Ingresar' }),
      page.getByRole('link', { name: '¿Olvidaste tu contraseña?' }),
      page.getByRole('link', { name: 'Créala aquí' }),
      page.getByText('La sesión se cierra sola tras 15 minutos sin uso.'),
    ])
      await expect(element).toBeInViewport({ ratio: 1 })

    // La foto de la columna verde termina dentro de la ventana
    const photo = await page.locator('.auth__photo').boundingBox()
    expect(photo!.height).toBeGreaterThan(60)
    expect(photo!.y + photo!.height).toBeLessThanOrEqual(size.height)
  })
}

test('con un error de ingreso a 1366×680 la página sigue sin barra de desplazamiento', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 680 })
  await login(page, 'nadie@aspar.org', 'NoExiste2026')
  await expect(
    page.getByRole('alert').filter({ hasText: 'Tras 5 intentos fallidos' }),
  ).toBeVisible()

  expect(await pageScrolls(page)).toBe(false)
  await expect(page.getByRole('button', { name: 'Ingresar' })).toBeInViewport()
})

test('recuperar la contraseña a 1366×680 entra sin barra de desplazamiento', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 680 })
  await page.goto('/recuperar-contrasena')
  await expect(
    page.getByRole('button', { name: 'Enviarme el enlace' }),
  ).toBeVisible()

  expect(await pageScrolls(page)).toBe(false)
  await expect(
    page.getByRole('button', { name: 'Enviarme el enlace' }),
  ).toBeInViewport({ ratio: 1 })
})

test('la cuenta pendiente a 1366×680 entra sin barra de desplazamiento', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 680 })
  await login(page, ACCOUNTS.pending.email, ACCOUNTS.pending.password)
  await expect(page).toHaveURL(/\/cuenta-pendiente$/)

  expect(await pageScrolls(page)).toBe(false)
  await expect(
    page.getByRole('link', { name: 'Volver al sitio público' }),
  ).toBeInViewport({ ratio: 1 })
})

test('cambiar la contraseña temporal a 1366×680 entra sin barra de desplazamiento', async ({
  page,
}) => {
  const admin = await adminApi()
  const email = `pantalla.${Date.now()}@aspar.org`
  const created = await admin.post('/users', {
    name: 'Prueba Pantalla',
    email,
    role: 'volunteer',
  })
  const { temporaryPassword } = (await created.json()) as {
    temporaryPassword: string
  }
  await admin.dispose()

  await page.setViewportSize({ width: 1366, height: 680 })
  await login(page, email, temporaryPassword)
  await expect(page).toHaveURL(/\/cambiar-contrasena$/)

  expect(await pageScrolls(page)).toBe(false)
  await expect(
    page.getByRole('button', { name: 'Guardar contraseña' }),
  ).toBeInViewport({ ratio: 1 })
})

test('crear cuenta en una ventana baja: solo se desplaza la columna del formulario', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 680 })
  await page.goto('/crear-cuenta')
  await expect(
    page.getByRole('button', { name: 'Crear cuenta' }),
  ).toBeAttached()

  expect(await pageScrolls(page)).toBe(false)
  const brand = page.locator('.auth__brand')
  const before = await brand.boundingBox()
  await page.locator('.auth__main').evaluate((column) => {
    column.scrollTop = column.scrollHeight
  })
  await expect(
    page.getByRole('button', { name: 'Crear cuenta' }),
  ).toBeInViewport()
  // La columna verde queda fija
  expect(await brand.boundingBox()).toEqual(before)
})

test('en el celular la página se desplaza con normalidad', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/crear-cuenta')
  await expect(
    page.getByRole('button', { name: 'Crear cuenta' }),
  ).toBeAttached()

  expect(await pageScrolls(page)).toBe(true)
  await page
    .getByRole('button', { name: 'Crear cuenta' })
    .scrollIntoViewIfNeeded()
  await expect(
    page.getByRole('button', { name: 'Crear cuenta' }),
  ).toBeInViewport()
})
