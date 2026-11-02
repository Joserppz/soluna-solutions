/**
 * Ajuste de F2: al desplazar la página, el encabezado de cada pantalla queda fijo
 * (título, pestañas y filtros del listado; nombre, estados y pestañas de la ficha) y
 * solo pasan por debajo las listas. Sigue habiendo una sola barra de desplazamiento.
 */
import { expect, test, type Page } from '@playwright/test'

import { ADMIN_STATE, adminApi } from './support'

test.use({ storageState: ADMIN_STATE })

const SIZES = [
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
]

async function newPatient() {
  const admin = await adminApi()
  const response = await admin.post('/patients', {
    name: 'Ramiro Prueba Encabezado',
    ci: String(Date.now()).slice(-8),
    phone: '70123344',
    consent: true,
    accessStatus: 'Activo',
    contacts: [{ name: 'Rosa Prueba', relation: 'Hija', phone: '70345678' }],
  })
  expect(response.status()).toBe(201)
  const { id } = (await response.json()) as { id: string }
  await admin.dispose()
  return id
}

/**
 * Espera a que la ficha termine de cargar (resumen de asistencia y contador de
 * evaluaciones): así la página ya tiene su alto final antes de medir.
 */
async function waitForRecord(page: Page) {
  await expect(page.getByText(/sábados? este trimestre/)).toBeVisible()
  await expect(
    page.getByRole('tab', { name: /^Evaluaciones \d/ }),
  ).toBeVisible()
  await page.waitForLoadState('networkidle')
}

/** Baja hasta el final y devuelve cómo quedó la página. */
async function scrollToEnd(page: Page) {
  const before = await page.evaluate(
    () => document.documentElement.scrollHeight,
  )
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  )
  await page.waitForTimeout(300)
  return page.evaluate((before) => {
    const doc = document.documentElement
    const header = document
      .querySelector('.sticky-header')!
      .getBoundingClientRect()
    const th = document.querySelector('thead th')?.getBoundingClientRect()
    const inner = [...document.querySelectorAll<HTMLElement>('body *')].filter(
      (element) => {
        const style = getComputedStyle(element)
        return (
          (['auto', 'scroll'].includes(style.overflowY) &&
            element.scrollHeight > element.clientHeight + 1) ||
          (['auto', 'scroll'].includes(style.overflowX) &&
            element.scrollWidth > element.clientWidth + 1)
        )
      },
    )
    return {
      // Al achicarse, el encabezado deja su margen: la página no cambia de alto
      sameHeight: Math.abs(doc.scrollHeight - before) <= 2,
      sideways: doc.scrollWidth > doc.clientWidth,
      innerScrollbars: inner.length,
      headerBottom: Math.round(header.bottom),
      tableHeadTop: th ? Math.round(th.top) : null,
    }
  }, before)
}

for (const size of SIZES) {
  test(`listado a ${size.width}×${size.height}: título, pestañas, filtros y columnas quedan fijos`, async ({
    page,
  }) => {
    await page.setViewportSize(size)
    await page.goto('/equipo/afiliados')
    await expect(page.locator('tbody tr')).toHaveCount(10)

    const state = await scrollToEnd(page)
    expect(state).toMatchObject({
      sameHeight: true,
      sideways: false,
      innerScrollbars: 0,
    })
    await expect(
      page.getByRole('heading', { level: 1, name: 'Afiliados' }),
    ).toBeInViewport()
    await expect(page.getByRole('tab', { name: /^Todos/ })).toBeInViewport()
    await expect(page.getByLabel('Buscar por nombre o carnet')).toBeInViewport()
    // Los títulos de las columnas quedan justo debajo del encabezado fijo
    expect(
      Math.abs(state.tableHeadTop! - state.headerBottom),
    ).toBeLessThanOrEqual(1)

    // Otra página empieza justo bajo el encabezado, sin volver al inicio de la pantalla
    await page.getByRole('button', { name: 'Página 2' }).click()
    await expect(page.getByText(/^Mostrando 11–/)).toBeVisible()
    await expect(
      page.getByRole('heading', { level: 1, name: 'Afiliados' }),
    ).toBeInViewport()
    const firstRow = await page.locator('tbody tr').first().boundingBox()
    const header = await page.locator('.sticky-header').boundingBox()
    expect(firstRow!.y).toBeGreaterThanOrEqual(header!.y + header!.height - 1)
  })

  test(`ficha a ${size.width}×${size.height}: el nombre y las pestañas quedan fijos`, async ({
    page,
  }) => {
    const id = await newPatient()
    await page.setViewportSize(size)
    await page.route('**/attendance?*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500))
      await route.continue()
    })
    await page.goto(`/equipo/afiliados/${id}`)
    await expect(
      page.getByRole('button', { name: 'Guardar ficha' }),
    ).toBeVisible()
    await waitForRecord(page)

    const state = await scrollToEnd(page)
    expect(state).toMatchObject({
      sameHeight: true,
      sideways: false,
      innerScrollbars: 0,
    })
    await expect(
      page.getByRole('heading', { level: 1, name: 'Ramiro Prueba Encabezado' }),
    ).toBeInViewport()
    await expect(
      page.getByRole('tab', { name: 'Historia clínica' }),
    ).toBeInViewport()
    await expect(
      page.getByRole('button', { name: 'Guardar ficha' }),
    ).toBeInViewport()

    // Cambiar de pestaña muestra la nueva desde arriba, bajo el encabezado
    await page.getByRole('tab', { name: 'Historia clínica' }).click()
    await expect(
      page.getByRole('heading', { name: 'Diagnóstico' }),
    ).toBeInViewport()
    const panel = await page.getByRole('tabpanel').boundingBox()
    const header = await page.locator('.sticky-header').boundingBox()
    expect(panel!.y).toBeGreaterThanOrEqual(header!.y + header!.height - 1)
  })
}

test('en el celular, al bajar en la ficha solo quedan fijas las pestañas', async ({
  page,
}) => {
  const id = await newPatient()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`/equipo/afiliados/${id}`)
  await expect(
    page.getByRole('button', { name: 'Guardar ficha' }),
  ).toBeVisible()
  await waitForRecord(page)

  const state = await scrollToEnd(page)
  expect(state).toMatchObject({ sameHeight: true, sideways: false })
  await expect(page.getByRole('tab', { name: 'Datos' })).toBeInViewport()
  await expect(page.getByRole('button', { name: 'Menú' })).toBeInViewport()
  await expect(
    page.getByRole('heading', { level: 1, name: 'Ramiro Prueba Encabezado' }),
  ).toBeHidden()
})
