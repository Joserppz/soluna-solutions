/**
 * Bloque F3, pág. 18: Equipo y permisos contra la API de Docker. Invitar a una
 * persona (contraseña temporal del servidor), gestionarla, la bandeja de cuentas
 * pendientes y la tabla «Qué puede ver cada rol».
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

const PATH = '/equipo/administracion/equipo'
const NO_SESSION = { cookies: [], origins: [] }

function row(page: Page, text: string) {
  return page.getByRole('row').filter({ hasText: text })
}

async function openTeam(page: Page, query = '') {
  await page.goto(`${PATH}${query}`)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Equipo y permisos',
  )
}

test('invitar a una persona: la contraseña temporal sirve una vez y obliga a cambiarla', async ({
  page,
  browser,
}) => {
  const email = `invitada.f3.${Date.now()}@aspar.org`
  await openTeam(page)
  // «+ Nuevo rol» abre la invitación en una ventana
  await page.getByRole('button', { name: '+ Nuevo rol' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()

  const panel = page.getByTestId('panel-invitar')
  await expect(panel.getByLabel(/^Nombre completo/)).toBeFocused()
  await panel.getByRole('button', { name: 'Crear acceso' }).click()
  await expect(
    panel.getByText('Escribe el nombre completo (al menos 3 letras).'),
  ).toBeVisible()

  await panel.getByLabel(/^Nombre completo/).fill('Gabriela Invitada F3')
  await panel.getByLabel(/^Correo/).fill(email)
  await panel.getByRole('radio', { name: /^Recepción/ }).check()
  await evidence(page, 'F3-02-invitar')
  await panel.getByRole('button', { name: 'Crear acceso' }).click()

  await expect(panel.getByText('Acceso listo para Gabriela')).toBeVisible()
  await expect(panel.getByText('se muestra solo esta vez')).toBeVisible()
  const password = (
    await panel.getByTestId('contrasena-temporal').textContent()
  )?.trim()
  expect(password).toBeTruthy()
  await evidence(page, 'F3-03-contrasena-temporal')

  // La nueva persona aparece en el equipo con su rol
  await page.getByLabel('Buscar por nombre o correo').fill(email)
  await expect(row(page, email)).toContainText('Recepción')
  await expect(row(page, email)).toContainText('Todavía no ingresó')

  // Entra con la contraseña temporal y tiene que cambiarla
  // Sin la sesión de Administración que usan los demás recorridos
  const context = await browser.newContext({ storageState: NO_SESSION })
  const guest = await context.newPage()
  await login(guest, email, password!)
  await expect(guest).toHaveURL(/\/cambiar-contrasena/)
  await context.close()
})

test('gestionar: restablecer la contraseña, desactivar y reactivar', async ({
  page,
}) => {
  const email = `gestionar.f3.${Date.now()}@aspar.org`
  const admin = await adminApi()
  const created = await admin.post('/users', {
    name: 'Mario Gestión F3',
    email,
    role: 'volunteer',
  })
  expect(created.status()).toBe(201)
  await admin.dispose()

  await openTeam(page, `?buscar=${encodeURIComponent(email)}`)
  await row(page, email)
    .getByRole('button', { name: 'Gestionar a Mario Gestión F3' })
    .click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Gestionar a Mario Gestión F3')

  await dialog.getByRole('button', { name: 'Restablecer contraseña' }).click()
  await expect(dialog.getByText('Nueva contraseña para Mario')).toBeVisible()
  await expect(dialog.getByTestId('contrasena-temporal')).not.toBeEmpty()

  await dialog.getByRole('button', { name: 'Desactivar cuenta…' }).click()
  await expect(dialog).toContainText('¿Desactivar a Mario Gestión F3?')
  await evidence(page, 'F3-04-gestionar-desactivar')
  await dialog.getByRole('button', { name: 'Sí, desactivar' }).click()
  await expect(dialog).toBeHidden()
  await expect(row(page, email)).toContainText('Desactivada')

  await row(page, email)
    .getByRole('button', { name: 'Reactivar la cuenta de Mario Gestión F3' })
    .click()
  await expect(page.getByText('Reactivamos la cuenta de Mario.')).toBeVisible()
  await expect(row(page, email)).toContainText('Activa')
})

test('nadie se quita a sí mismo el rol de Administración', async ({ page }) => {
  await openTeam(page, `?buscar=${ACCOUNTS.admin.email}`)
  await row(page, ACCOUNTS.admin.email)
    .getByRole('button', { name: /^Gestionar a/ })
    .click()
  const dialog = page.getByRole('dialog')

  await expect(dialog).toContainText(
    'No puedes quitarte el rol de Administración ni desactivar tu propia cuenta.',
  )
  await expect(dialog.getByLabel('Rol')).toBeDisabled()
  await expect(
    dialog.getByRole('button', { name: 'Desactivar cuenta…' }),
  ).toHaveCount(0)
})

test('pendientes de aprobación: se elige el rol y se espera la confirmación del correo', async ({
  page,
}) => {
  // Una cuenta nueva desde el sitio, todavía sin confirmar el correo
  const email = `pendiente.f3.${Date.now()}@aspar.org`
  const visitor = await request.newContext()
  const registered = await visitor.post(`${API_URL}/auth/register`, {
    data: {
      name: 'Marina Pendiente F3',
      email,
      password: 'Marina2026',
      turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX',
    },
  })
  expect(registered.ok()).toBe(true)
  await visitor.dispose()

  await openTeam(page)
  await page.getByRole('tab', { name: /^Pendientes de aprobación/ }).click()
  await expect(page).toHaveURL(/pestana=pendientes/)

  // La cuenta de demostración confirmó su correo: se puede aprobar con un rol
  const verified = row(page, ACCOUNTS.pending.email)
  await expect(verified).toContainText('Confirmado')
  const approve = verified.getByRole('button', { name: /^Aprobar a/ })
  await expect(approve).toBeDisabled()
  await verified.getByRole('combobox').selectOption('volunteer')
  await expect(approve).toBeEnabled()
  await evidence(page, 'F3-05-pendientes')

  // Hasta que confirme su correo, la cuenta nueva no se puede aprobar (es la más
  // reciente: queda en la última página)
  const pages = page.getByRole('navigation', {
    name: 'Páginas de cuentas pendientes',
  })
  if (await pages.count())
    await pages
      .getByRole('button', { name: /^Página \d+$/ })
      .last()
      .click()
  const fresh = row(page, email)
  await expect(fresh).toContainText('Sin confirmar')
  await expect(fresh).toContainText('Se aprueba cuando confirme su correo.')
  await expect(fresh.getByRole('button')).toHaveCount(0)
})

test('«Qué puede ver cada rol»: guarda un permiso y pide confirmar los datos clínicos', async ({
  page,
}) => {
  const content = 'Recepción: Editar y publicar el contenido del sitio'
  const clinical =
    'Voluntariado: Ver historia clínica, evaluaciones y documentos privados'
  await openTeam(page, '?pestana=permisos')
  const table = page.getByTestId('tabla-permisos')

  // Administración tiene todo y no se edita
  await expect(
    table.getByLabel('Administración: Consultar el registro de actividad'),
  ).toBeChecked()
  await expect(
    table.getByLabel('Administración: Consultar el registro de actividad'),
  ).toBeDisabled()

  // Un permiso común se guarda directo y queda al recargar
  await expect(table.getByLabel(content)).not.toBeChecked()
  await table.getByLabel(content).check()
  await expect(table.getByText('1 cambio sin guardar')).toBeVisible()
  await table.getByRole('button', { name: 'Guardar permisos' }).click()
  await expect(
    page.getByText('Guardamos los permisos de Recepción.'),
  ).toBeVisible()
  await page.reload()
  await expect(table.getByLabel(content)).toBeChecked()

  // Lo deja como estaba
  await table.getByLabel(content).uncheck()
  await table.getByRole('button', { name: 'Guardar permisos' }).click()
  await expect(
    page.getByText('Guardamos los permisos de Recepción.'),
  ).toBeVisible()

  // Dar datos clínicos pide confirmación; «Revisar de nuevo» y «Descartar» no guardan
  await table.getByLabel(clinical).check()
  await table.getByRole('button', { name: 'Guardar permisos' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Confirmar acceso sensible')
  await expect(dialog).toContainText('Datos clínicos')
  await expect(dialog).toContainText(
    'Voluntariado: Ver historia clínica, evaluaciones y documentos privados.',
  )
  await evidence(page, 'F3-07-confirmar-datos-clinicos')
  await dialog.getByRole('button', { name: 'Revisar de nuevo' }).click()
  await table.getByRole('button', { name: 'Descartar' }).click()
  await expect(table.getByLabel(clinical)).not.toBeChecked()

  const admin = await adminApi()
  const roles = (await (await admin.get('/roles')).json()) as {
    roles: { key: string; permissions: string[] }[]
  }
  await admin.dispose()
  const volunteer = roles.roles.find((role) => role.key === 'volunteer')!
  expect(volunteer.permissions).not.toContain('patients:read_clinical')
  const reception = roles.roles.find((role) => role.key === 'reception')!
  expect(reception.permissions).not.toContain('content:manage')
})

test('el Voluntariado no entra a Equipo y permisos', async ({ browser }) => {
  // Sin la sesión de Administración que usan los demás recorridos
  const context = await browser.newContext({ storageState: NO_SESSION })
  const page = await context.newPage()
  await login(page, ACCOUNTS.volunteer.email, ACCOUNTS.volunteer.password)
  await expect(page).toHaveURL(/\/equipo$/)
  await expect(
    page.getByRole('link', { name: 'Equipo y permisos' }),
  ).toHaveCount(0)

  await page.goto(PATH)
  await expect(page).toHaveURL(/\/equipo$/)
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(
    'Equipo y permisos',
  )
  await context.close()
})

for (const size of [
  { width: 1366, height: 768 },
  // La ventana de la captura del equipo (1567×907)
  { width: 1567, height: 907 },
  { width: 1920, height: 1080 },
]) {
  test(`a ${size.width}×${size.height} las tres pestañas entran completas`, async ({
    page,
  }) => {
    await page.setViewportSize(size)
    await openTeam(page)
    await expect(
      page.getByRole('button', { name: /^Gestionar a/ }).first(),
    ).toBeVisible()
    await expect.poll(() => fitsWindow(page)).toEqual(FITS)
    if (size.width === 1366) await evidence(page, 'F3-01-equipo')
    // La lista usa todo el ancho; la invitación se abre en una ventana que entra completa
    await expect(page.getByTestId('panel-invitar')).toHaveCount(0)
    await page.getByRole('button', { name: '+ Nuevo rol' }).click()
    await expect(page.getByTestId('panel-invitar')).toBeVisible()
    await expect.poll(() => fitsWindow(page)).toEqual(FITS)
    await page.getByRole('button', { name: 'Cerrar la invitación' }).click()
    await expect(page.getByTestId('panel-invitar')).toHaveCount(0)

    await page.getByRole('tab', { name: /^Pendientes de aprobación/ }).click()
    await expect(page.getByRole('row').nth(1)).toBeVisible()
    await expect.poll(() => fitsWindow(page)).toEqual(FITS)

    await page.getByRole('tab', { name: 'Qué puede ver cada rol' }).click()
    const last = page.getByLabel(
      'Voluntariado: Consultar el registro de actividad',
    )
    await expect(last).toBeInViewport()
    await expect.poll(() => fitsWindow(page)).toEqual(FITS)
    if (size.width === 1366) await evidence(page, 'F3-06-permisos-por-rol')
  })
}
