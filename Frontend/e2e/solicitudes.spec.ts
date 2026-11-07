/**
 * Bloque F6 (diseño págs. 7 y 17) contra la API de Docker: la bandeja de solicitudes, del
 * mensaje del sitio a la ficha de afiliado, y el resumen del espacio del equipo. Las
 * solicitudes y afiliados «… de prueba 123456» se borran al terminar (global-teardown.ts).
 */
import { expect, request, test, type Page } from '@playwright/test'

import { ADMIN_STATE, API_URL, FITS, evidence, fitsWindow } from './support'

test.use({ storageState: ADMIN_STATE, viewport: { width: 1366, height: 768 } })

function suffix() {
  return Date.now().toString().slice(-6)
}

/** Una persona escribe desde el sitio por su esposo (sin sesión, como en el inicio). */
async function inquiryFromSite(name: string, onBehalfOf: string) {
  const context = await request.newContext()
  const response = await context.post(`${API_URL}/public/inquiries`, {
    data: {
      kind: 'orientacion',
      name,
      phone: '71548214',
      onBehalfOf,
      zone: 'Villa Fátima',
      preferredCallTime: 'Por la tarde',
      message: 'Nos dijeron que los sábados hacen ejercicios en grupo.',
      contactConsent: true,
      turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX',
    },
  })
  expect(response.ok()).toBe(true)
  await context.dispose()
}

/** Lo único que puede desplazarse es el detalle de la solicitud, si es largo. */
async function fitsWithDetail(page: Page) {
  const result = await fitsWindow(page)
  return {
    ...result,
    inner: result.inner.filter((name) => !name.includes('inq__side')),
  }
}

test('del mensaje del sitio a la ficha: seguimiento, nota de la llamada e inscripción', async ({
  page,
}) => {
  const id = suffix()
  const name = `Rosa de prueba ${id}`
  const husband = `Julio de prueba ${id}`
  await inquiryFromSite(name, husband)

  await page.goto(`/equipo/solicitudes?buscar=${encodeURIComponent(name)}`)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Solicitudes',
  )
  const row = page.locator('.item', { hasText: name })
  await expect(row).toContainText('Nueva')
  await row.click()

  const panel = page.locator('.inquiry')
  await expect(panel.getByRole('heading', { level: 2 })).toHaveText(name)
  await expect(panel).toContainText(`Escribe por ${husband}`)
  await expect(panel.getByRole('link', { name: 'Llamar' })).toHaveAttribute(
    'href',
    'tel:71548214',
  )
  await expect(
    panel.getByRole('link', { name: 'Escribir por WhatsApp' }),
  ).toHaveAttribute('href', /^https:\/\/wa\.me\/59171548214/)
  await expect.poll(() => fitsWithDetail(page)).toEqual(FITS)
  await evidence(page, 'F6-01-solicitudes')

  // Seguimiento: por contactar y luego la nota de la llamada la marca como contactada
  await panel
    .getByRole('button', { name: 'Marcar como «Por contactar»' })
    .click()
  await expect(panel.locator('[aria-current="step"]')).toHaveText(
    'Por contactar',
  )
  await panel
    .getByLabel('Notas de la llamada')
    .fill('Se le explicó el horario; vendrá el sábado con su esposo.')
  await panel
    .getByRole('button', { name: 'Guardar y marcar como contactada' })
    .click()
  await expect(panel.locator('[aria-current="step"]')).toHaveText('Contactada')
  await expect(panel.locator('.timeline')).toContainText(
    'Se le explicó el horario; vendrá el sábado con su esposo.',
  )
  await expect(row).toContainText('Contactada')

  // Inscribir: la ficha es del esposo y quien escribió queda como su contacto
  await panel.getByRole('button', { name: 'Inscribir como afiliado →' }).click()
  const dialog = page.getByRole('dialog', { name: 'Inscribir como afiliado' })
  await expect(dialog.getByLabel(/^Nombre completo/)).toHaveValue(husband)
  await expect(dialog).toContainText(`${name} (Familiar)`)
  await dialog.getByLabel(/^Carnet/).fill(`9${id}`)
  await evidence(page, 'F6-02-inscribir')
  await dialog.getByRole('button', { name: 'Abrir la ficha' }).click()

  await expect(page).toHaveURL(/\/equipo\/afiliados\/[0-9a-f-]+$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(husband)
  await expect(
    page.getByText(
      `Abrimos la ficha de ${husband}. Falta el consentimiento firmado.`,
    ),
  ).toBeVisible()

  // La solicitud quedó inscrita y enlaza a la ficha
  await page.goto(
    `/equipo/solicitudes?estado=inscrita&buscar=${encodeURIComponent(name)}`,
  )
  await page.locator('.item', { hasText: name }).click()
  await expect(page.locator('.inquiry')).toContainText(
    `${name} ya tiene su ficha de afiliado.`,
  )
})

test('el resumen muestra lo que hay para revisar y lleva a cada lista', async ({
  page,
}) => {
  await page.goto('/equipo')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Lucía')
  const review = page.locator('.pending')
  await expect(review.getByRole('link')).toHaveCount(4)
  await expect(page.locator('.spark li')).toHaveCount(8)
  await expect(page.getByRole('heading', { name: 'Comunidad' })).toBeVisible()
  await expect.poll(() => fitsWindow(page)).toEqual(FITS)
  await evidence(page, 'F6-03-resumen')

  await review
    .getByRole('link', { name: /Solicitudes nuevas sin llamar/ })
    .click()
  await expect(page).toHaveURL(/\/equipo\/solicitudes\?estado=recibida$/)
  await expect(page.getByRole('tab', { name: /Nuevas/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
})

test('«Tomar asistencia» del resumen abre el día del próximo encuentro', async ({
  page,
}) => {
  await page.goto('/equipo')
  await expect(page.locator('.today h2')).toBeVisible()
  const take = page.getByRole('link', { name: 'Tomar asistencia' })
  // Si no hay una actividad publicada próxima, el resumen ofrece ir a Actividades
  if ((await take.count()) === 0) {
    await expect(page.locator('.today')).toContainText('Todavía no hay')
    return
  }
  const href = await take.getAttribute('href')
  const day = new URLSearchParams(href!.split('?')[1]).get('dia')
  await take.click()
  await expect(page).toHaveURL(new RegExp(`/equipo/asistencia\\?dia=${day}`))
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Asistencia')
})

for (const size of [
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
]) {
  test(`a ${size.width}×${size.height} el resumen y la bandeja entran completos`, async ({
    page,
  }) => {
    await page.setViewportSize(size)
    await page.goto('/equipo')
    await expect(page.locator('.pending a').first()).toBeVisible()
    await expect.poll(() => fitsWindow(page)).toEqual(FITS)

    await page.goto('/equipo/solicitudes')
    await expect(page.locator('.item').first()).toBeVisible()
    await expect(page.getByRole('tab', { name: /Inscritas/ })).toBeInViewport({
      ratio: 1,
    })
    await expect.poll(() => fitsWindow(page)).toEqual(FITS)
    await page.locator('.item').first().click()
    await expect(page.locator('.inquiry h2')).toBeVisible()
    await expect.poll(() => fitsWithDetail(page)).toEqual(FITS)
  })
}
