/**
 * Bloque F5a (diseño págs. 15 y 16) contra la API de Docker: el registro de aportes
 * sin pasarela, la confirmación con el extracto, lo que llega a la sede (efectivo, QR
 * bancario y en especie) y la meta del sitio. Cada recorrido crea sus propios aportes
 * «… de prueba 123456»; al terminar se borran (global-teardown.ts).
 */
import { expect, test, type Page } from '@playwright/test'

import { ADMIN_STATE, FITS, adminApi, evidence, fitsWindow } from './support'

test.use({ storageState: ADMIN_STATE, viewport: { width: 1366, height: 768 } })

function suffix() {
  return Date.now().toString().slice(-6)
}

/** Un QR bancario recibido en la sede, por la API: queda por confirmar. */
async function newQr(donorName: string, amountBs = 40) {
  const admin = await adminApi()
  const response = await admin.post('/donations', {
    channel: 'qr_bancario',
    donorName,
    amountBs,
    receiptNumber: `C-${suffix()}`,
  })
  expect(response.status()).toBe(201)
  const donation = (await response.json()) as { id: string }
  await admin.dispose()
  return donation
}

async function openDonations(page: Page) {
  await page.goto('/equipo/donaciones')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Donaciones')
}

async function register(page: Page) {
  await page
    .getByRole('button', { name: '+ Registrar aporte recibido' })
    .click()
  const dialog = page.getByRole('dialog')
  await expect(
    dialog.getByRole('heading', { name: 'Registrar un aporte recibido' }),
  ).toBeVisible()
  return dialog
}

/** Busca por donante (como el buscador del registro) y espera la respuesta. */
async function findRow(page: Page, text: string) {
  const searched = page.waitForResponse(
    (response) =>
      response.url().includes('/donations?') &&
      new URL(response.url()).searchParams.get('search') === text,
  )
  await page.getByLabel('Buscar por donante o comprobante').fill(text)
  await searched
  const row = page.locator('tbody tr', { hasText: text })
  await expect(row).toHaveCount(1)
  return row
}

test('el efectivo recibido en la sede entra confirmado', async ({ page }) => {
  const name = `Familia de prueba ${suffix()}`
  await openDonations(page)
  const dialog = await register(page)
  await expect(dialog.getByText('Quedará como')).toContainText('Confirmado')

  // Sin monto no se registra
  await dialog.getByRole('button', { name: 'Registrar aporte' }).click()
  await expect(dialog.getByText(/Escribe el monto en bolivianos/)).toBeVisible()

  await dialog.getByLabel('Quién lo entrega').fill(name)
  await dialog.getByLabel(/^Monto/).fill('25')
  await dialog.getByLabel('Nro. de recibo').fill('0127')
  await dialog.getByRole('button', { name: 'Registrar aporte' }).click()
  await expect(page.getByText('Registramos Bs. 25 en efectivo.')).toBeVisible()
  await expect(dialog).toHaveCount(0)

  const row = await findRow(page, name)
  await expect(row).toContainText('Efectivo · En la sede')
  await expect(row).toContainText('Confirmado')
})

test('un QR recibido en la sede queda por confirmar y se confirma con el extracto', async ({
  page,
}) => {
  const n = suffix()
  const name = `Jorge de prueba ${n}`
  await openDonations(page)
  const dialog = await register(page)
  await dialog.getByText('QR bancario', { exact: true }).click()
  await expect(dialog.getByText('Quedará como')).toContainText('Por confirmar')
  await dialog.getByLabel('Quién lo entrega').fill(name)
  await dialog.getByLabel(/^Monto/).fill('40')
  await dialog.getByLabel('Nro. de comprobante').fill(`C-${n}`)
  await dialog.getByRole('button', { name: 'Registrar aporte' }).click()
  await expect(
    page.getByText(/Confírmalo cuando aparezca en el extracto/),
  ).toBeVisible()

  const row = await findRow(page, name)
  await expect(row).toContainText('QR bancario · En la sede')
  await expect(row).toContainText('Pendiente')
  await row
    .getByRole('button', { name: `Confirmar el aporte de ${name}` })
    .click()

  const panel = page.locator('.don__side')
  await expect(
    panel.getByRole('heading', { name: 'Confirmar aporte' }),
  ).toBeVisible()
  // La referencia propone el comprobante que mostró la persona
  await expect(panel.getByLabel(/^Ref. del extracto/)).toHaveValue(`C-${n}`)
  await panel.getByLabel(/^Ref. del extracto/).fill(`EXT-${n}`)
  await expect.poll(() => fitsWindow(page)).toEqual(FITS)
  await evidence(page, 'F5-02-confirmar-aporte')
  await panel
    .getByRole('button', { name: 'Confirmar ingreso de Bs. 40' })
    .click()
  await expect(page.getByText(/Confirmamos el aporte de Bs. 40/)).toBeVisible()
  await expect(row).toContainText('Confirmado')
  await expect(panel).toContainText(`EXT-${n}`)
})

test('un aviso que no aparece en el banco se anula con su motivo', async ({
  page,
}) => {
  const name = `Rodrigo de prueba ${suffix()}`
  await newQr(name, 1500)
  await openDonations(page)
  const row = await findRow(page, name)
  await row
    .getByRole('button', { name: `Confirmar el aporte de ${name}` })
    .click()
  await page
    .getByRole('button', { name: 'No aparece en el banco · anular con motivo' })
    .click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox').fill('No se encontró en el extracto')
  await dialog.getByRole('button', { name: 'Anular aporte' }).click()
  await expect(page.getByText(/Anulamos el aviso/)).toBeVisible()
  await expect(row).toContainText('Anulado')
  await expect(row).toContainText('No se encontró en el extracto')
})

test('lo que llega en especie queda recibido y se agrega al inventario', async ({
  page,
}) => {
  const n = suffix()
  const what = `Pelotas de prueba ${n}`
  const who = `Grupo de prueba ${n}`
  await openDonations(page)
  const dialog = await register(page)
  await dialog.getByText('En especie', { exact: true }).click()
  await dialog.getByLabel('Quién lo entrega').fill(who)
  await dialog.getByLabel(/^¿Qué se recibió\?/).fill(what)
  await dialog.getByLabel(/^Cantidad/).fill('3')
  await dialog.getByLabel('Categoría').selectOption('fisioterapia')
  await expect(
    dialog.getByText(`«${what} · 3 · Nuevo · Origen: donado»`),
  ).toBeVisible()
  await expect.poll(() => fitsWindow(page)).toEqual(FITS)
  await evidence(page, 'F5-03-registrar-en-especie')
  await dialog.getByRole('button', { name: 'Registrar aporte' }).click()
  await expect(
    page.getByText(
      'Registramos el aporte en especie y lo agregamos al inventario.',
    ),
  ).toBeVisible()

  const row = await findRow(page, who)
  await expect(row).toContainText(what)
  await expect(row).toContainText('Recibido')
  await row.getByRole('button', { name: /^Ver el aporte/ }).click()
  await page
    .getByRole('link', { name: /Ver el material en el inventario/ })
    .click()
  await expect(page).toHaveURL(/\/equipo\/inventario\?material=/)
  await expect(page.locator('#material').getByLabel(/^Nombre/)).toHaveValue(
    what,
  )
})

test('el resumen del mes se descarga en Excel', async ({ page }) => {
  await openDonations(page)
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page
      .getByRole('button', { name: 'Descargar el resumen del mes en Excel' })
      .click(),
  ])
  expect(download.suggestedFilename()).toMatch(/^donaciones-\d{4}-\d{2}\.xlsx$/)
})

for (const size of [
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
]) {
  test(`a ${size.width}×${size.height} donaciones, el aporte, el registro y la meta entran completos`, async ({
    page,
  }) => {
    await page.setViewportSize(size)
    const pending = await newQr(`Marcela de prueba ${suffix()}`, 100)

    await openDonations(page)
    await expect(page.locator('tbody tr').first()).toBeVisible()
    await expect.poll(() => fitsWindow(page)).toEqual(FITS)
    if (size.width === 1366) await evidence(page, 'F5-01-donaciones')

    // El aporte pendiente abierto
    await page.goto(`/equipo/donaciones?aporte=${pending.id}`)
    await expect(
      page.getByRole('heading', { name: 'Confirmar aporte' }),
    ).toBeVisible()
    await expect.poll(() => fitsWindow(page)).toEqual(FITS)

    // La ventana de registro, en sus tres canales
    const dialog = await register(page)
    for (const channel of ['Efectivo', 'QR bancario', 'En especie']) {
      await dialog.getByText(channel, { exact: true }).click()
      await expect.poll(() => fitsWindow(page)).toEqual(FITS)
    }
    await dialog.getByRole('button', { name: 'Cancelar' }).click()

    // La meta: se revisa sin cambiarla
    await page.getByRole('button', { name: /^(Editar|Crear) meta/ }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect.poll(() => fitsWindow(page)).toEqual(FITS)
    if (size.width === 1366) await evidence(page, 'F5-04-meta')
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Cancelar' })
      .click()
  })
}
