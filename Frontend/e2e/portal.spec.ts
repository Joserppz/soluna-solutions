/**
 * Bloque F5b (diseño págs. 2 y 3) contra la API de Docker: el inicio del sitio público en
 * escritorio y en el celular. Turnstile se reemplaza por un doble en el navegador; las
 * solicitudes «… de prueba 123456» se borran al terminar (global-teardown.ts).
 */
import { expect, test, type Page } from '@playwright/test'

import { evidence, fakeExternalWidgets } from './support'

function suffix() {
  return Date.now().toString().slice(-6)
}

test.beforeEach(async ({ page }) => {
  await fakeExternalWidgets(page)
})

/** La portada y la franja de caminos entran en la primera vista, sin desplazar de lado. */
async function firstView(page: Page) {
  return page.evaluate(() => ({
    pathsInView:
      document.querySelector('.paths')!.getBoundingClientRect().bottom <=
      window.innerHeight,
    sideways: document.documentElement.scrollWidth > window.innerWidth,
  }))
}

async function openHome(page: Page, path = '/') {
  await page.goto(path)
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'La vida se vive mejor en',
  )
  await expect(page.locator('.event').first()).toBeVisible()
}

for (const size of [
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
]) {
  test(`a ${size.width}×${size.height} la portada y los tres caminos se ven de entrada`, async ({
    page,
  }) => {
    await page.setViewportSize(size)
    await openHome(page)
    await expect(page.locator('.hero__when')).toBeVisible()
    expect(await firstView(page)).toEqual({
      pathsInView: true,
      sideways: false,
    })
    if (size.width === 1366) await evidence(page, 'F5-08-inicio')
  })
}

test('la agenda muestra el próximo encuentro y tacha la actividad cancelada', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await openHome(page, '/#actividades')
  const next = page.locator('.next')
  await expect(next.getByRole('heading', { level: 3 })).not.toBeEmpty()
  await expect(
    next.getByRole('button', { name: 'Quiero participar' }),
  ).toBeVisible()

  const cancelled = page.locator('.event.is-cancelled').first()
  await expect(cancelled).toContainText('Cancelada')
  await expect(cancelled.locator('h4')).toHaveCSS(
    'text-decoration-line',
    'line-through',
  )
  await expect(cancelled.getByRole('button')).toHaveCount(0)

  // El mes siguiente se pide a la API; el anterior no se ofrece
  await expect(
    page.getByRole('button', { name: 'Mes anterior' }),
  ).toBeDisabled()
  const title = page.locator('.calendar__head h3')
  const month = await title.textContent()
  await page.getByRole('button', { name: 'Mes siguiente' }).click()
  await expect(title).not.toHaveText(month!)
})

test('«Quiero participar» deja los datos para que el equipo llame', async ({
  page,
}) => {
  await openHome(page, '/#actividades')
  await page
    .locator('.next')
    .getByRole('button', { name: 'Quiero participar' })
    .click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Quiero participar:')

  await dialog.getByLabel(/^Nombre/).fill(`Marcela de prueba ${suffix()}`)
  await dialog.getByLabel(/^Teléfono/).fill('70123456')
  await dialog.getByLabel('¿Es para otra persona?').fill('Para mi papá')
  await dialog
    .getByLabel(
      'Autorizo a ASPAR a contactarme para responder a esta solicitud.',
    )
    .check()
  await dialog.getByRole('button', { name: 'Soy una persona (prueba)' }).click()
  const sent = page.waitForResponse(
    (r) =>
      r.url().includes('/public/inquiries') && r.request().method() === 'POST',
  )
  await dialog.getByRole('button', { name: 'Quiero participar' }).click()
  expect((await sent).ok()).toBe(true)
  await expect(dialog).toContainText('¡Gracias! Ya tenemos tus datos.')
  await dialog.getByRole('button', { name: 'Listo' }).click()
  await expect(dialog).toBeHidden()
})

test('«Ser voluntario/a» lleva al formulario con el motivo elegido y se envía', async ({
  page,
}) => {
  await openHome(page)
  await page
    .locator('.site-footer')
    .getByRole('link', { name: 'Ser voluntario/a' })
    .click()
  const contact = page.locator('#contacto')
  await expect(contact.getByLabel(/^¿Para qué nos escribes\?/)).toHaveValue(
    'voluntariado',
  )
  await expect(contact).toBeInViewport()

  // Sin datos no se envía
  await contact.getByRole('button', { name: 'Enviar mensaje' }).click()
  await expect(contact).toContainText('Escribe tu nombre (al menos 3 letras).')

  await contact.getByLabel(/^Nombre/).fill(`Rodrigo de prueba ${suffix()}`)
  await contact.getByLabel(/^Teléfono/).fill('71234567')
  await contact.getByLabel('Mensaje').fill('Puedo acompañar los sábados.')
  await contact
    .getByLabel(
      'Autorizo a ASPAR a contactarme para responder a esta solicitud.',
    )
    .check()
  await contact
    .getByRole('button', { name: 'Soy una persona (prueba)' })
    .click()
  await contact.getByRole('button', { name: 'Enviar mensaje' }).click()
  await expect(contact).toContainText('¡Gracias por escribirnos!')
})

test('en el celular el menú se abre, lleva a la sección y no hay desplazamiento lateral', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openHome(page)
  const menu = page.getByRole('button', { name: 'Menú' })
  await expect(menu).toBeVisible()
  await expect(
    page
      .getByRole('navigation', { name: 'Sitio de ASPAR' })
      .getByRole('link', { name: 'Actividades' }),
  ).toBeHidden()
  await evidence(page, 'F5-09-inicio-celular')

  await menu.click()
  const nav = page.getByRole('navigation', { name: 'Sitio de ASPAR' })
  await nav.getByRole('link', { name: 'Actividades' }).click()
  await expect(nav.getByRole('link', { name: 'Actividades' })).toBeHidden()
  await expect(page.locator('#actividades h2')).toBeInViewport()

  // Los botones de la agenda se tocan con el dedo (44 px o más)
  const join = page.locator('.event').getByRole('button').first()
  expect((await join.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
  ).toBe(false)
})
