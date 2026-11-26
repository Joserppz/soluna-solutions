/**
 * Filtro por rango de fechas y «Descargar» contra la API de Docker (evaluación de los
 * Sprints 1 y 2): el archivo trae exactamente las filas del filtro que muestra la
 * pantalla, no solo la página que se ve.
 */
import { readFile } from 'node:fs/promises'

import { expect, test, type Page } from '@playwright/test'

import { ADMIN_STATE, downloadReport } from './support'

test.use({ storageState: ADMIN_STATE, viewport: { width: 1366, height: 768 } })

/** «Mostrando 1–6 de 23» → 23 */
async function totalShown(page: Page): Promise<number> {
  const text = await page
    .getByText(/^Mostrando \d+–\d+ de \d+$/)
    .first()
    .textContent()
  return Number(text!.match(/de (\d+)$/)![1])
}

async function csvRows(download: Awaited<ReturnType<typeof downloadReport>>) {
  const content = await readFile((await download.path())!, 'utf-8')
  return content
    .replace(/^\uFEFF/, '')
    .split('\r\n')
    .filter((line) => line.trim())
}

/** Elige un atajo y espera a que la lista llegue con esas fechas (no la de antes). */
async function choosePreset(page: Page, label: string) {
  await page.locator('.range__trigger').first().click()
  await Promise.all([
    page.waitForResponse(
      (response) =>
        /\/api\/v1\/[a-z]+\?.*from=/.test(response.url()) && response.ok(),
    ),
    page.getByRole('button', { name: label, exact: true }).click(),
  ])
  await expect(page.locator('.range__trigger').first()).toContainText(label)
}

test('Afiliados: el CSV trae todas las fichas del filtro (todas las páginas)', async ({
  page,
}) => {
  await page.goto('/equipo/afiliados')
  await choosePreset(page, 'Este año')
  await expect(page).toHaveURL(/desde=\d{4}-01-01/)
  const total = await totalShown(page)
  const visible = await page.locator('tbody tr').count()
  expect(visible).toBeLessThan(total)

  const download = await downloadReport(page, 'CSV')

  expect(download.suggestedFilename()).toMatch(/^afiliados-.*\.csv$/)
  const rows = await csvRows(download)
  expect(rows[0]).toContain('Nombre;Carnet')
  expect(rows.length - 1).toBe(total)
})

test('Solicitudes: un rango sin solicitudes deja la bandeja vacía y no descarga', async ({
  page,
}) => {
  await page.goto('/equipo/solicitudes')
  await page.locator('.range__trigger').click()
  // El calendario propio: mes y año, luego el primer y el último día
  const panel = page.locator('.range__panel')
  await panel.getByLabel('Año', { exact: true }).selectOption('2020')
  await panel
    .getByLabel('Mes', { exact: true })
    .selectOption({ label: 'enero' })
  await panel.locator('[data-day="2020-01-01"]').click()
  await panel.locator('[data-day="2020-01-31"]').click()
  await panel.getByRole('button', { name: 'Aplicar' }).click()

  await expect(
    page.getByText('No hay solicitudes con estos filtros.'),
  ).toBeVisible()
  await page.locator('.export__trigger').click()
  await expect(page.getByText('No hay filas con este filtro')).toBeVisible()
  await expect(page.locator('.export__option').first()).toBeDisabled()
})

test('Registro de actividad: la descarga queda anotada con su filtro y sus filas', async ({
  page,
}) => {
  await page.goto('/equipo/inventario')
  await choosePreset(page, 'Este año')
  const total = await totalShown(page)
  await downloadReport(page, 'Excel')

  await page.goto('/equipo/administracion/registro?area=inventario')
  const entry = page.locator('.entry').first()
  await expect(entry).toContainText('Descarga de reporte')
  await expect(entry).toContainText(`Inventario: ${total} filas en XLSX`)
  await expect(entry).toContainText('Fechas: del 01/01/')
})
