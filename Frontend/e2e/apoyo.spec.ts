/**
 * Bloque F5b (diseño págs. 4 y 5) contra la API de Docker: «Apoya a ASPAR» en tres pasos,
 * solo con el QR bancario, en escritorio y en el celular. Turnstile y la imagen del QR
 * se reemplazan en el navegador (la base local no tiene publicado el QR de ASPAR). Los
 * avisos «… de prueba 123456» se borran al terminar (global-teardown.ts).
 */
import { expect, test, type Page } from '@playwright/test'

import { adminApi, evidence, fakeExternalWidgets } from './support'

const QR_URL = 'https://res.cloudinary.com/aspar-e2e/image/upload/v1/qr.png'
// Un PNG de 1×1: basta para que la tarjeta muestre una imagen
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

function suffix() {
  return Date.now().toString().slice(-6)
}

/** Como si ASPAR hubiera publicado su QR en «Datos para donar». */
async function publishedQr(page: Page) {
  await page.route('**/api/v1/public/content', async (route) => {
    const response = await route.fetch()
    const sections = (await response.json()) as { key: string }[]
    sections.push({
      key: 'donaciones',
      title: 'Datos para donar',
      content: {
        titulo: '',
        texto: '',
        titular: 'Asociación de Parkinson «Mario Lagrava»',
        banco: 'Banco de prueba',
        cuenta: '1-0000000',
        qrUrl: QR_URL,
      },
      publishedAt: null,
    } as never)
    await route.fulfill({ response, json: sections })
  })
  await page.route('https://res.cloudinary.com/aspar-e2e/**', (route) =>
    route.fulfill({ contentType: 'image/png', body: PIXEL }),
  )
}

test.beforeEach(async ({ page }) => {
  await fakeExternalWidgets(page)
  await publishedQr(page)
})

async function openSupport(page: Page, path = '/apoyar') {
  await page.goto(path)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Ayúdanos a hacer lugar para más encuentros.',
  )
}

test('se elige el monto, se paga solo con QR bancario y la meta se ve en vivo', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  const goal = page.waitForResponse((r) =>
    r.url().endsWith('/public/donations/goal'),
  )
  await openSupport(page)
  const data = (await (await goal).json()) as {
    raisedBs: number
    confirmedCount: number
  } | null

  // Sin pasarelas: ni Libélula ni tarjeta
  await expect(page.locator('body')).not.toContainText(/Libélula/i)
  await expect(page.getByRole('radio', { name: 'Bs. 100' })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await page.getByRole('radio', { name: 'Bs. 200' }).click()
  await expect(page.locator('.impact')).toContainText('Con Bs. 200')
  await expect(page.getByLabel(/^Monto \(Bs\.\)/)).toHaveValue('200')

  await expect(
    page.getByRole('img', { name: 'Código QR de la cuenta bancaria de ASPAR' }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Guardar el QR en mi teléfono' }),
  ).toHaveAttribute('href', /\/upload\/fl_attachment\//)

  if (data) {
    const card = page.locator('.goal')
    await expect(card).toContainText(`${data.confirmedCount} aporte`)
    await expect(card.getByRole('progressbar')).toBeVisible()
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
  ).toBe(false)
  await evidence(page, 'F5-10-apoya')
})

test('el aviso queda pendiente, se sigue con su enlace y se confirma con el banco', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openSupport(page)
  const name = `Marcela de prueba ${suffix()}`

  await page.getByLabel('Tu nombre').fill(name)
  await page.getByLabel('Nro. de comprobante').fill(`C-${suffix()}`)
  await page.getByRole('button', { name: 'Soy una persona (prueba)' }).click()
  await page.getByRole('button', { name: 'Ya hice mi aporte' }).click()

  const thanks = page.locator('.thanks')
  await expect(thanks.getByRole('heading', { level: 2 })).toHaveText(
    '¡Gracias, Marcela!',
  )
  await expect(thanks).toBeInViewport()
  await expect(thanks.locator('.track li').nth(1)).toHaveClass(/is-now/)
  await evidence(page, 'F5-11-aviso-celular')

  // El enlace del aviso sigue mostrando su estado
  const id = new URL(page.url()).searchParams.get('aviso')!
  expect(id).toBeTruthy()
  await page.reload()
  await expect(page.locator('.thanks')).toContainText('Pendiente')

  // El equipo lo confirma con el extracto y la persona lo ve al actualizar
  const api = await adminApi()
  const confirmed = await api.post(`/donations/${id}/confirm`, {
    bankReference: `EXT-${suffix()}`,
    // Fecha de La Paz: en UTC ya puede ser el día siguiente
    creditedOn: new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/La_Paz',
    }).format(new Date()),
  })
  expect(confirmed.ok()).toBe(true)
  await api.dispose()
  await page.getByRole('button', { name: 'Ver cómo va' }).click()
  await expect(page.locator('.thanks')).toContainText(
    'ya está en nuestra cuenta y suma a la meta',
  )
  await expect(page.locator('.track li.is-done')).toHaveCount(3)
})

test('en el celular los montos van de a dos y el botón para donar queda a la vista', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openSupport(page)
  const amounts = page.getByRole('radio')
  const first = (await amounts.nth(0).boundingBox())!
  const second = (await amounts.nth(1).boundingBox())!
  const third = (await amounts.nth(2).boundingBox())!
  expect(second.y).toBe(first.y)
  expect(third.y).toBeGreaterThan(first.y)
  expect(first.height).toBeGreaterThanOrEqual(44)

  const cta = page.getByRole('button', { name: 'Donar Bs. 100 con QR' })
  await expect(cta).toBeInViewport()
  await evidence(page, 'F5-12-apoya-celular')
  await cta.click()
  await expect(page.locator('#paso-2')).toBeInViewport()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
  ).toBe(false)
})

test('«Ofrecer una donación en especie» lleva al formulario del inicio', async ({
  page,
}) => {
  await openSupport(page)
  await page
    .getByRole('link', { name: 'Ofrecer una donación en especie →' })
    .click()
  await expect(page).toHaveURL(/\/\?motivo=especie#contacto$/)
  await expect(
    page.locator('#contacto').getByLabel(/^¿Para qué nos escribes\?/),
  ).toHaveValue('especie')
})

test('«Quiero ayudar» del encabezado abre la página para apoyar', async ({
  page,
}) => {
  await page.goto('/')
  await page
    .getByRole('navigation', { name: 'Sitio de ASPAR' })
    .getByRole('link', { name: 'Quiero ayudar' })
    .click()
  await expect(page).toHaveURL(/\/apoyar$/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'más encuentros',
  )
})
