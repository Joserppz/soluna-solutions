/**
 * Bloque F4 (diseño págs. 3, 10, 11 y 12) contra la API de Docker: actividades,
 * asistencia (también en el celular de 360 px) e inventario. Cada recorrido crea sus
 * propios datos y no depende de los de demostración; al terminar se borran
 * (global-teardown.ts).
 */
import { expect, test } from '@playwright/test'

import {
  ACCOUNTS,
  ADMIN_STATE,
  FITS,
  adminApi,
  evidence,
  fakeExternalWidgets,
  fitsWindow,
  login,
} from './support'

test.use({ storageState: ADMIN_STATE, viewport: { width: 1366, height: 768 } })

const NO_SESSION = { cookies: [], origins: [] }

/** Hoy en La Paz: la asistencia se toma el día de la actividad. */
function todayInLaPaz(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/La_Paz',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

async function newActivity(title: string, publish: boolean) {
  const admin = await adminApi()
  const date = todayInLaPaz()
  const response = await admin.post('/schedules', {
    title,
    category: 'arteterapia',
    date,
    startTime: '10:00',
    endTime: '11:30',
    location: 'Sede ASPAR',
    professionalName: 'Lic. Prueba',
    description: 'Actividad creada por el recorrido de pruebas.',
    spots: null,
    publish,
  })
  expect(response.status()).toBe(201)
  const schedule = (await response.json()) as { id: string; date: string }
  await admin.dispose()
  return schedule
}

test('una actividad se crea como borrador, se publica y se cancela con un aviso', async ({
  page,
}) => {
  const title = `Arteterapia de prueba ${Date.now().toString().slice(-6)}`
  await page.goto('/equipo/actividades')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Actividades',
  )

  // «+ Nueva actividad» abre una ventana, como «Registrar afiliado»
  await page.getByRole('button', { name: '+ Nueva actividad' }).click()
  const dialog = page.getByRole('dialog')
  await expect(
    dialog.getByRole('heading', { name: 'Nueva actividad' }),
  ).toBeVisible()
  await dialog.getByLabel(/^Título/).fill(title)
  await dialog.getByLabel(/^Tipo/).selectOption('arteterapia')
  await dialog
    .getByLabel(/^Descripción para el sitio/)
    .fill('Pintamos juntos con colores de otoño.')
  const created = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith('/schedules'),
  )
  await dialog.getByRole('button', { name: 'Crear actividad' }).click()
  const { id } = (await (await created).json()) as { id: string }
  await expect(
    page.getByText('Guardamos la actividad como borrador.'),
  ).toBeVisible()
  await expect(dialog).toHaveCount(0)

  // Un enlace con ?actividad= la abre (la agenda de hoy puede estar paginada)
  await page.goto(`/equipo/actividades?actividad=${id}`)
  await expect(dialog.getByRole('heading', { name: title })).toBeVisible()
  await expect(dialog.getByText('Borrador', { exact: true })).toBeVisible()

  // Publicar: el interruptor y «Guardar cambios»
  await dialog.getByRole('switch', { name: /Publicada en el sitio/ }).check()
  await dialog.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(
    page.getByText('Guardamos los cambios de la actividad.'),
  ).toBeVisible()
  await page.goto(`/equipo/actividades?actividad=${id}`)
  await expect(dialog.getByText('Publicada', { exact: true })).toBeVisible()

  // Cancelar con el aviso que ven las familias, en la misma ventana
  await dialog
    .getByRole('button', { name: 'Cancelar la actividad con un aviso…' })
    .click()
  await expect(dialog.getByRole('textbox')).toHaveValue(/Se reprogramará en/)
  await evidence(page, 'F4-01-cancelar-actividad')
  await dialog
    .getByRole('button', { name: 'Sí, cancelar la actividad' })
    .click()
  await expect(
    page.getByText('Cancelamos la actividad. Se verá tachada, con el aviso.'),
  ).toBeVisible()
  await page.goto(`/equipo/actividades?actividad=${id}`)
  await expect(dialog.getByText('Cancelada', { exact: true })).toBeVisible()
})

test('la asistencia se guarda al marcar, se cierra y se puede reabrir', async ({
  page,
}) => {
  const activity = await newActivity(
    `Movimiento de prueba ${Date.now().toString().slice(-6)}`,
    true,
  )
  await page.goto(`/equipo/asistencia?actividad=${activity.id}`)
  await expect(page.locator('.banner__title')).toBeVisible()

  const first = page.locator('.person').first()
  const name = (await first.locator('strong').textContent())?.trim() ?? ''
  // La pantalla marca al instante y guarda por detrás: se espera la respuesta
  // de la API antes de recargar, o la recarga corta el guardado en equipos lentos.
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' &&
      response.url().includes(`/schedules/${activity.id}/attendance/`),
  )
  await first.getByRole('button', { name: 'Vino', exact: true }).click()
  expect((await saved).ok()).toBe(true)
  await expect(
    first.getByRole('button', { name: 'Vino', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.tally')).toContainText('1 vino')

  // Se recarga: la marca quedó guardada en la API
  await page.reload()
  await expect(
    page
      .locator('.person', { hasText: name })
      .getByRole('button', { name: 'Vino', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')

  await page.getByRole('button', { name: 'Cerrar asistencia del día' }).click()
  await expect(
    page.getByText('Asistencia cerrada. Para cambiarla, reábrela.'),
  ).toBeVisible()
  await expect(
    first.getByRole('button', { name: 'Vino', exact: true }),
  ).toBeDisabled()
  await evidence(page, 'F4-02-asistencia-cerrada')
  await page.getByRole('button', { name: 'Reabrir' }).click()
  await expect(
    first.getByRole('button', { name: 'Vino', exact: true }),
  ).toBeEnabled()
})

test('anotar a una persona nueva crea la solicitud de asistencia', async ({
  page,
}) => {
  const activity = await newActivity(
    `Encuentro de prueba ${Date.now().toString().slice(-6)}`,
    true,
  )
  await page.goto(`/equipo/asistencia?actividad=${activity.id}`)
  await page.getByRole('button', { name: 'Anotar persona nueva' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel(/^Nombre completo/).fill('Marina Asistencia Prueba')
  await dialog.getByLabel(/^Teléfono/).fill('70123344')
  await dialog.getByRole('button', { name: 'Anotar persona' }).click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Recepción abrirá su ficha' }),
  ).toBeVisible()
})

test('en el celular (360 px) la asistencia se marca con botones grandes y sin desplazamiento lateral', async ({
  page,
}) => {
  const activity = await newActivity(
    `Celular de prueba ${Date.now().toString().slice(-6)}`,
    true,
  )
  await page.setViewportSize({ width: 360, height: 740 })
  await page.goto(`/equipo/asistencia?actividad=${activity.id}`)
  const vino = page
    .locator('.person')
    .first()
    .getByRole('button', { name: 'Vino', exact: true })
  await expect(vino).toBeVisible()
  const box = await vino.boundingBox()
  expect(box!.height).toBeGreaterThanOrEqual(44)
  expect(box!.width).toBeGreaterThanOrEqual(44)
  // Nombre y botones en la misma fila, y «Cerrar asistencia» siempre a mano al pie
  const name = await page
    .locator('.person')
    .first()
    .locator('strong')
    .boundingBox()
  expect(
    Math.abs(name!.y + name!.height / 2 - (box!.y + box!.height / 2)),
  ).toBeLessThan(20)
  await expect(
    page.getByRole('button', { name: 'Cerrar asistencia del día' }),
  ).toBeInViewport()
  const sideways = () =>
    page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    )
  expect(await sideways()).toBe(false)
  await evidence(page, 'F4-03-asistencia-celular')

  // El inventario tampoco se desplaza de lado en el celular
  await page.goto('/equipo/inventario')
  await expect(page.locator('.inv__table tbody tr').first()).toBeVisible()
  expect(await sideways()).toBe(false)
})

test('el voluntariado marca asistencia, pero no ve el resumen del mes', async ({
  browser,
}) => {
  const context = await browser.newContext({ storageState: NO_SESSION })
  const page = await context.newPage()
  await login(page, ACCOUNTS.volunteer.email, ACCOUNTS.volunteer.password)
  await expect(page).toHaveURL(/\/equipo$/)
  await page.goto('/equipo/asistencia')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Asistencia')
  await expect(page.getByText('Descargar resumen mensual')).toHaveCount(0)
  await expect(
    page.getByText('Las historias clínicas solo las ve el personal clínico.'),
  ).toBeVisible()
  await context.close()
})

test('inventario: alta, cambio de cantidad con motivo, movimiento, baja y exportación', async ({
  page,
}) => {
  const name = `Silla de prueba ${Date.now().toString().slice(-6)}`
  await page.goto('/equipo/inventario')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Inventario')

  // «+ Añadir material» abre una ventana
  await page.getByRole('button', { name: '+ Añadir material' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page
    .locator('#material')
    .getByLabel(/^Nombre/)
    .fill(name)
  await page
    .locator('#material')
    .getByLabel(/^Cantidad/)
    .fill('4')
  await page
    .locator('#material')
    .getByLabel(/^Origen/)
    .selectOption('donado')
  await page
    .locator('#material')
    .getByLabel(/^Quién lo donó/)
    .fill('Grupo de exalumnos')
  await page
    .getByRole('button', { name: 'Añadir material', exact: true })
    .click()
  // Al guardarlo se cierra la ventana y el panel muestra el material
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('#material').getByLabel(/^Nombre/)).toHaveValue(
    name,
  )

  // La lista está paginada: se busca el material por su nombre
  await page.getByLabel('Nombre del material').fill(name)
  const row = page.locator('tbody tr', { hasText: name })
  await expect(row).toContainText('Donado')
  await expect(row).toContainText('Grupo de exalumnos')
  await row.getByRole('button', { name: `Editar ${name}` }).click()

  // Cambiar la cantidad sin motivo no se guarda
  await page
    .locator('#material')
    .getByLabel(/^Cantidad/)
    .fill('6')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(
    page.getByText(/Cambiar la cantidad necesita un motivo/),
  ).toBeVisible()
  await page.getByLabel('Motivo del cambio').fill('Se compraron 2 más')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(
    page.getByText(`Guardamos los cambios de ${name}.`),
  ).toBeVisible()
  await expect(page.locator('tbody tr', { hasText: name })).toContainText('6')

  // Un préstamo queda en el historial (pestaña Historial)
  await page.getByRole('tab', { name: 'Historial' }).click()
  await page
    .locator('form.movement')
    .getByLabel(/^Tipo/)
    .selectOption('prestamo')
  await page
    .locator('form.movement')
    .getByLabel(/^Unidades/)
    .fill('2')
  await page
    .locator('form.movement')
    .getByLabel(/^Persona o familia/)
    .fill('Familia Apaza')
  await page.getByRole('button', { name: 'Anotar movimiento' }).click()
  await expect(page.getByText('Anotamos el movimiento.')).toBeVisible()
  await expect(page.locator('.history')).toContainText('Familia Apaza')
  await evidence(page, 'F4-04-inventario-historial')

  // Baja lógica con motivo (en la pestaña Datos)
  await page.getByRole('tab', { name: 'Datos' }).click()
  await page.getByRole('button', { name: 'Dar de baja con motivo…' }).click()
  await page
    .getByRole('dialog')
    .getByRole('textbox')
    .fill('Se llevó la familia')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Dar de baja' })
    .click()
  await expect(page.getByText(/Dimos de baja/)).toBeVisible()

  // La exportación arranca una descarga de Excel con la Alcaldía aparte
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exportar Excel' }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(
    /^inventario-\d{4}-\d{2}-\d{2}\.xlsx$/,
  )
})

for (const size of [
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
]) {
  test(`a ${size.width}×${size.height} actividades, asistencia e inventario entran completos`, async ({
    page,
  }) => {
    await page.setViewportSize(size)
    const activity = await newActivity(
      `Ventana de prueba ${Date.now().toString().slice(-6)}`,
      true,
    )
    // La agenda en lista, en mes y con la ventana de la actividad abierta
    const shots = [
      'F4-06-actividades',
      'F4-09-actividades-mes',
      'F4-10-actividad-ventana',
      'F4-07-asistencia',
      'F4-08-inventario',
    ]
    let index = 0
    for (const path of [
      '/equipo/actividades',
      '/equipo/actividades?vista=mes',
      `/equipo/actividades?actividad=${activity.id}`,
      `/equipo/asistencia?actividad=${activity.id}`,
      '/equipo/inventario',
    ]) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expect.poll(() => fitsWindow(page)).toEqual(FITS)
      const shot = shots[index]
      if (size.width === 1366 && shot) await evidence(page, shot)
      index += 1
    }
  })
}

test('la pantalla de registro entra completa en una ventana angosta y alta, con el captcha centrado', async ({
  browser,
}) => {
  // Pantalla pública: sin sesión, con los widgets de prueba de Cloudflare
  const context = await browser.newContext({
    storageState: NO_SESSION,
    viewport: { width: 880, height: 900 },
  })
  const page = await context.newPage()
  await fakeExternalWidgets(page)
  await page.goto('/crear-cuenta')
  await expect(page.getByRole('button', { name: 'Crear cuenta' })).toBeVisible()
  await expect.poll(() => fitsWindow(page)).toEqual(FITS)
  const captcha = await page.locator('.turnstile__box').boundingBox()
  const form = await page.locator('form.form-stack').boundingBox()
  if (captcha && form) {
    const center = captcha.x + captcha.width / 2
    expect(Math.abs(center - (form.x + form.width / 2))).toBeLessThan(4)
  }
  await evidence(page, 'F4-05-crear-cuenta')
  await context.close()
})
