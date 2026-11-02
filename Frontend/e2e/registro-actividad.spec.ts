/**
 * Bloque F3, pág. 19: Registro de actividad contra la API de Docker. Búsqueda por
 * afiliado, situaciones para revisar (un intento de acceso bloqueado de verdad),
 * resumen de la semana y descarga del registro.
 */
import { expect, request, test, type Page } from '@playwright/test'

import {
  ACCOUNTS,
  ADMIN_STATE,
  API_URL,
  FITS,
  adminApi,
  evidence,
  fitsWindow,
  login,
} from './support'

test.use({ storageState: ADMIN_STATE, viewport: { width: 1366, height: 768 } })

const PATH = '/equipo/administracion/registro'
const NO_SESSION = { cookies: [], origins: [] }

async function openLog(page: Page, query = '') {
  await page.goto(`${PATH}${query}`)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Registro de actividad',
  )
}

/** El Voluntariado intenta ver el equipo: la API lo bloquea y lo anota. */
async function blockedAttempt() {
  const volunteer = await request.newContext()
  const login = await volunteer.post(`${API_URL}/auth/login`, {
    data: ACCOUNTS.volunteer,
  })
  expect(login.ok()).toBe(true)
  const denied = await volunteer.get(`${API_URL}/users`)
  expect(denied.status()).toBe(403)
  await volunteer.dispose()
}

test('agrupa por día y busca lo que pasó con un afiliado', async ({ page }) => {
  // Un apellido único hecho de letras (los nombres no llevan números)
  const unique = [...Date.now().toString().slice(-6)]
    .map((digit) => 'abcdefghij'[Number(digit)])
    .join('')
  const name = `Teodora Bitácora ${unique.charAt(0).toUpperCase()}${unique.slice(1)}`
  const admin = await adminApi()
  const created = await admin.post('/patients', {
    name,
    ci: String(Date.now()).slice(-8),
    birthDate: '1952-04-09',
    phone: '70123344',
    zone: 'Sopocachi',
    address: 'Calle 5, Sopocachi',
    consent: true,
    accessStatus: 'Activo',
    imageConsent: false,
    contacts: [{ name: 'Rosa Bitácora', relation: 'Hija', phone: '70345678' }],
  })
  expect(created.status()).toBe(201)
  await admin.dispose()

  await openLog(page)
  await expect(page.locator('.day__title').first()).toHaveText(/^Hoy, /)
  await expect(page.locator('.entry').first()).toBeVisible()
  await expect(page.getByText('Nada se puede editar ni borrar')).toBeVisible()
  await expect(
    page.getByRole('button', { name: /^Afiliados: \d+ movimientos/ }),
  ).toBeVisible()

  await page.getByLabel('Buscar persona o afiliado').fill(name)
  const entry = page.locator('.entry').filter({ hasText: name })
  await expect(entry).toHaveCount(1)
  await expect(entry).toContainText('Lucía Choque')
  await expect(entry).toContainText('Registro de ficha y anamnesis de afiliado')
  await expect(entry).toContainText('Afiliados')
  // El detalle no muestra identificadores internos
  await expect(entry).not.toContainText(/[0-9a-f]{8}-[0-9a-f]{4}-/)
  await expect(page).toHaveURL(/buscar=/)

  await page.getByLabel('Área', { exact: true }).selectOption('donaciones')
  await expect(page.getByText(/No hay actividad de «Teodora/)).toBeVisible()
  await page
    .getByRole('button', { name: 'Quitar la búsqueda y los filtros' })
    .click()
  await expect(page.getByLabel('Buscar persona o afiliado')).toHaveValue('')
  await expect(page.locator('.entry').first()).toBeVisible()
})

test('un intento de acceso bloqueado aparece como situación para revisar', async ({
  page,
}) => {
  await blockedAttempt()
  await openLog(page)

  const alert = page.getByTestId('situaciones-para-revisar')
  await expect(alert).toContainText(/situaci(ón|ones) para revisar/)
  await expect(alert).toContainText(/intentos? de acceso bloqueados?/)
  await evidence(page, 'F3-08-registro-de-actividad')

  await alert.getByRole('button', { name: 'Ver solo estas' }).click()
  await expect(page).toHaveURL(/revisar=1/)
  // Solo quedan las situaciones para revisar, todas resaltadas
  await expect(page.locator('.entry').first()).toBeVisible()
  await expect(page.locator('.entry:not(.is-review)')).toHaveCount(0)
  const blocked = page
    .locator('.entry')
    .filter({ hasText: 'Intento de acceso restringido bloqueado' })
    .first()
  await expect(blocked).toContainText('Para revisar')
  await expect(blocked).toContainText('Daniel Quispe')
  await evidence(page, 'F3-09-situaciones-para-revisar')
})

test('«Ver días anteriores» y «Más recientes» recorren el registro sin desplazar la página', async ({
  page,
}) => {
  await openLog(page, '?dias=30')
  const range = page.locator('.log__range')
  await expect(range).toHaveText(/^Mostrando 1–\d+ de \d+/)
  const firstRange = await range.textContent()
  const shown = Number(firstRange!.match(/1–(\d+)/)![1])

  await page.getByRole('button', { name: 'Ver días anteriores →' }).click()
  await expect(range).toHaveText(new RegExp(`^Mostrando ${shown + 1}–`))
  await expect.poll(() => fitsWindow(page)).toEqual(FITS)

  await page.getByRole('button', { name: '← Más recientes' }).click()
  await expect(range).toHaveText(firstRange!)
})

test('descarga el registro en Excel y la descarga queda anotada', async ({
  page,
}) => {
  await openLog(page, '?area=accesos')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Descargar registro' }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(
    /^registro-de-actividad-\d{4}-\d{2}-\d{2}\.xlsx$/,
  )
  await expect(
    page.getByText(
      'Descargamos el registro. La descarga también quedó anotada.',
    ),
  ).toBeVisible()

  // Es lo más reciente del área Accesos
  await expect(page.locator('.entry').first()).toContainText(
    'Descarga del registro de actividad',
  )
})

test('el Voluntariado no entra al registro', async ({ browser }) => {
  const context = await browser.newContext({ storageState: NO_SESSION })
  const page = await context.newPage()
  await login(page, ACCOUNTS.volunteer.email, ACCOUNTS.volunteer.password)
  await expect(page).toHaveURL(/\/equipo$/)
  await expect(
    page.getByRole('link', { name: 'Registro de actividad' }),
  ).toHaveCount(0)

  await page.goto(PATH)
  await expect(page).toHaveURL(/\/equipo$/)
  await context.close()
})

for (const size of [
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
]) {
  test(`a ${size.width}×${size.height} el registro entra completo`, async ({
    page,
  }) => {
    await page.setViewportSize(size)
    await openLog(page, '?dias=30')
    await expect(page.locator('.entry').first()).toBeVisible()
    await expect.poll(() => fitsWindow(page)).toEqual(FITS)
    // La última fila y la navegación quedan a la vista
    await expect(page.locator('.entry').last()).toBeInViewport()
    await expect(
      page.getByRole('button', { name: 'Ver días anteriores →' }),
    ).toBeInViewport()
  })
}
