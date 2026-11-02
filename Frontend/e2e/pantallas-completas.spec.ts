/**
 * En escritorio y laptops cada pantalla del equipo entra completa en la ventana: no
 * hay barra de desplazamiento de la página ni zonas con su propia barra. El listado
 * muestra tantas filas como entran. En el celular la página se desplaza y las
 * pestañas de la ficha quedan fijas arriba.
 */
import { expect, test, type Page } from '@playwright/test'

import { ADMIN_STATE, adminApi } from './support'

test.use({ storageState: ADMIN_STATE })

const SIZES = [
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
]

async function newPatient() {
  const admin = await adminApi()
  const response = await admin.post('/patients', {
    name: 'Ramiro Prueba Pantalla',
    ci: String(Date.now()).slice(-8),
    birthDate: '1957-03-02',
    phone: '70123344',
    zone: 'Miraflores',
    address: 'Calle 2, Miraflores',
    consent: true,
    accessStatus: 'Activo',
    imageConsent: true,
    contacts: [{ name: 'Rosa Prueba', relation: 'Hija', phone: '70345678' }],
  })
  expect(response.status()).toBe(201)
  const { id } = (await response.json()) as { id: string }
  await admin.dispose()
  return id
}

/** Nada se desplaza: ni la página, ni una zona interna, ni a los costados. */
async function fitsWindow(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement
    const inner = [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((element) => {
        const style = getComputedStyle(element)
        return (
          (['auto', 'scroll'].includes(style.overflowY) &&
            element.scrollHeight > element.clientHeight + 1) ||
          (['auto', 'scroll'].includes(style.overflowX) &&
            element.scrollWidth > element.clientWidth + 1)
        )
      })
      .map((element) => element.className)
    return {
      pageScrolls: doc.scrollHeight > doc.clientHeight,
      sideways: doc.scrollWidth > doc.clientWidth,
      inner,
    }
  })
}

const FITS = { pageScrolls: false, sideways: false, inner: [] }

for (const size of SIZES) {
  test(`a ${size.width}×${size.height} el resumen y el listado entran completos`, async ({
    page,
  }) => {
    await page.setViewportSize(size)
    await page.goto('/equipo')
    await expect(
      page.getByRole('link', { name: /Registro de actividad/ }),
    ).toBeInViewport()
    await expect(
      page.getByText('Tu rol puede ver historias clínicas'),
    ).toBeInViewport()
    expect(await fitsWindow(page)).toEqual(FITS)

    await page.goto('/equipo/afiliados')
    await expect(page.getByText(/^Mostrando 1–\d+ de /)).toBeVisible()
    expect(await fitsWindow(page)).toEqual(FITS)
    await expect(page.locator('tbody tr').last()).toBeInViewport()
    await expect(
      page.getByRole('navigation', { name: 'Páginas de afiliados' }),
    ).toBeInViewport()
  })

  test(`a ${size.width}×${size.height} cada pestaña de la ficha entra completa`, async ({
    page,
  }) => {
    const id = await newPatient()
    await page.setViewportSize(size)
    await page.goto(`/equipo/afiliados/${id}`)
    await expect(page.getByText(/sábados? este trimestre/)).toBeVisible()
    await expect(
      page.getByRole('tab', { name: /^Evaluaciones \d/ }),
    ).toBeVisible()

    for (const name of [
      'Datos',
      'Historia clínica',
      'Evaluaciones',
      'Asistencia',
      'Documentos',
    ]) {
      await page.getByRole('tab', { name: new RegExp(`^${name}`) }).click()
      await page.waitForLoadState('networkidle')
      expect(await fitsWindow(page), name).toEqual(FITS)
      await expect(
        page.getByRole('heading', { level: 1, name: 'Ramiro Prueba Pantalla' }),
      ).toBeInViewport()
    }
    await page.getByRole('tab', { name: 'Datos' }).click()
    await expect(
      page.getByRole('button', { name: 'Guardar ficha' }),
    ).toBeInViewport()
    await expect(
      page.getByRole('button', { name: 'Marcar como inactiva…' }),
    ).toBeInViewport()

    // Desde las migas de pan se vuelve al listado
    await page
      .getByRole('navigation', { name: 'Estás en' })
      .getByRole('link', { name: 'Afiliados' })
      .click()
    await expect(page).toHaveURL(/\/equipo\/afiliados$/)
  })
}

test('en el celular la página se desplaza y las pestañas de la ficha quedan fijas', async ({
  page,
}) => {
  const id = await newPatient()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`/equipo/afiliados/${id}`)
  await expect(page.getByText(/sábados? este trimestre/)).toBeVisible()
  await page.waitForLoadState('networkidle')

  const before = await page.evaluate(
    () => document.documentElement.scrollHeight,
  )
  expect(before).toBeGreaterThan(844)
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  )
  await page.waitForTimeout(300)

  // Al achicarse, el encabezado deja su margen: la página no cambia de alto
  const after = await page.evaluate(() => document.documentElement.scrollHeight)
  expect(Math.abs(after - before)).toBeLessThanOrEqual(2)
  await expect(page.getByRole('tab', { name: 'Datos' })).toBeInViewport()
  await expect(page.getByRole('button', { name: 'Menú' })).toBeInViewport()
  await expect(
    page.getByRole('heading', { level: 1, name: 'Ramiro Prueba Pantalla' }),
  ).toBeHidden()
})
