/**
 * Bloque F1: acceso, sesión real y espacio del equipo, contra la API de Docker.
 */
import { expect, test } from '@playwright/test'

import { ACCOUNTS, ADMIN_STATE, adminApi, evidence, login } from './support'

test('el ingreso rechaza datos incorrectos con el mensaje seguro de la API', async ({
  page,
}) => {
  await login(page, 'nadie@aspar.org', 'NoExiste2026')

  await expect(
    page.getByRole('alert').filter({ hasText: 'Tras 5 intentos fallidos' }),
  ).toBeVisible()
  await expect(page.getByLabel('Contraseña', { exact: true })).toHaveValue('')
  await expect(page).toHaveURL(/\/ingresar/)
  await evidence(page, 'F1-01-ingreso-con-error')
})

test('Administración ingresa, ve todo el espacio del equipo y cierra sesión', async ({
  page,
}) => {
  await page.goto('/equipo/afiliados')
  await expect(page).toHaveURL(/\/ingresar\?redirect=/)

  await page.getByLabel('Correo electrónico').fill(ACCOUNTS.admin.email)
  await page
    .getByLabel('Contraseña', { exact: true })
    .fill(ACCOUNTS.admin.password)
  await page.getByRole('button', { name: 'Mostrar contraseña' }).click()
  await expect(page.getByLabel('Contraseña', { exact: true })).toHaveAttribute(
    'type',
    'text',
  )
  await page.getByRole('button', { name: 'Ingresar' }).click()

  // Vuelve a la sección que pidió antes de ingresar
  await expect(page).toHaveURL(/\/equipo\/afiliados$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Afiliados')

  const menu = page.getByRole('navigation', { name: 'Secciones' })
  await expect(menu.getByRole('link')).toHaveCount(10)
  await menu.getByRole('link', { name: 'Resumen' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Lucía')
  await expect(page.locator('.section-card')).toHaveCount(10)
  await evidence(page, 'F1-02-resumen-administracion')

  await menu.getByRole('link', { name: 'Administración' }).click()
  await expect(
    page.getByRole('navigation', { name: 'Estás en' }),
  ).toContainText('Administración')
  await expect(
    menu.getByRole('link', { name: 'Registro de actividad' }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/ingresar$/)
  await expect(page.getByText('Cerraste sesión. ¡Hasta pronto!')).toBeVisible()

  // La cookie ya no sirve: el espacio del equipo vuelve a pedir ingresar
  await page.goto('/equipo')
  await expect(page).toHaveURL(/\/ingresar/)
})

test('Voluntariado ve solo lo suyo y la dirección no le abre otras secciones', async ({
  page,
}) => {
  await login(page, ACCOUNTS.volunteer.email, ACCOUNTS.volunteer.password)
  await expect(page).toHaveURL(/\/equipo$/)

  const menu = page.getByRole('navigation', { name: 'Secciones' })
  await expect(menu.getByRole('link')).toHaveText([
    'Resumen',
    'Afiliados',
    'Asistencia',
  ])
  await expect(
    page.getByText('Solo el personal clínico ve historias'),
  ).toBeVisible()
  await evidence(page, 'F1-03-resumen-voluntariado')

  await page.goto('/equipo/inventario')
  await expect(page).toHaveURL(/\/equipo$/)
  await expect(
    page.getByText('Tu rol no tiene acceso a Inventario'),
  ).toBeVisible()
})

test('una cuenta pendiente espera su rol y puede recorrer el sitio público', async ({
  page,
}) => {
  await login(page, ACCOUNTS.pending.email, ACCOUNTS.pending.password)

  await expect(page).toHaveURL(/\/cuenta-pendiente$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Tu cuenta está lista, Gabriela.',
  )
  await expect(page.getByText(ACCOUNTS.pending.email)).toBeVisible()
  await evidence(page, 'F1-04-cuenta-pendiente')

  await page.getByRole('button', { name: 'Ya me aprobaron: revisar' }).click()
  await expect(
    page.getByText('Todavía no tienes un rol asignado'),
  ).toBeVisible()

  await page.goto('/equipo')
  await expect(page).toHaveURL(/\/cuenta-pendiente$/)

  await page.getByRole('link', { name: 'Volver al sitio público' }).click()
  const bar = page.getByRole('region', { name: 'Tu sesión' })
  await expect(bar).toContainText(
    'Tu cuenta espera la aprobación de Administración.',
  )
  await bar.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(bar).toBeHidden()
})

test('una persona invitada crea su propia contraseña al primer ingreso', async ({
  page,
}) => {
  const admin = await adminApi()
  const email = `invitada.${Date.now()}@aspar.org`
  const created = await admin.post('/users', {
    name: 'Gabriela Invitada',
    email,
    role: 'reception',
  })
  expect(created.status()).toBe(201)
  const { temporaryPassword } = (await created.json()) as {
    temporaryPassword: string
  }
  await admin.dispose()

  await login(page, email, temporaryPassword)
  await expect(page).toHaveURL(/\/cambiar-contrasena$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Crea tu contraseña.',
  )

  await page.getByLabel('Contraseña temporal').fill(temporaryPassword)
  await page
    .getByLabel('Contraseña nueva', { exact: true })
    .fill('Recepcion2026')
  await expect(page.locator('.checklist .is-ok')).toHaveCount(3)
  await page.getByLabel('Repite la contraseña nueva').fill('Recepcion2026')
  await evidence(page, 'F1-05-cambio-de-contrasena-temporal')
  await page.getByRole('button', { name: 'Guardar contraseña' }).click()

  await expect(page).toHaveURL(/\/equipo$/)
  await expect(page.getByText('Tu contraseña quedó guardada.')).toBeVisible()
  await expect(
    page.getByRole('navigation', { name: 'Secciones' }).getByRole('link'),
    // Donaciones y Solicitudes pueden llevar la insignia de pendientes, que depende
    // de los datos de cada base: solo se compara el nombre de la sección
  ).toHaveText([
    'Resumen',
    'Afiliados',
    'Asistencia',
    /^\s*Donaciones/,
    /^\s*Solicitudes/,
  ])
})

test('tras 13 minutos sin uso avisa; se puede mantener la sesión o se cierra sola', async ({
  page,
}) => {
  await page.clock.install()
  await login(page, ACCOUNTS.volunteer.email, ACCOUNTS.volunteer.password)
  await expect(page).toHaveURL(/\/equipo$/)

  await page.clock.fastForward('13:01')
  const dialog = page.getByRole('dialog', { name: '¿Sigues ahí?' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('timer')).toHaveText(/^1:5\d$/)
  await evidence(page, 'F1-06-aviso-de-inactividad')

  const refresh = page.waitForResponse('**/auth/refresh')
  await dialog
    .getByRole('button', { name: 'Mantener la sesión activa' })
    .click()
  expect((await refresh).status()).toBe(200)
  await expect(dialog).toBeHidden()

  await page.clock.fastForward('15:02')
  await expect(page).toHaveURL(/\/ingresar\?motivo=inactividad$/)
  await expect(
    page.getByText('Cerramos tu sesión tras 15 minutos sin uso'),
  ).toBeVisible()
})

test.describe('con la sesión guardada de Administración', () => {
  test.use({ storageState: ADMIN_STATE })

  test('en el celular el menú del equipo se abre como panel', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/equipo')
    await expect(page).toHaveURL(/\/equipo$/)

    const toggle = page.getByRole('button', { name: 'Menú' })
    await toggle.click()
    const menu = page.getByRole('navigation', { name: 'Secciones' })
    await expect(menu).toBeInViewport()
    await evidence(page, 'F1-07-menu-en-celular')

    await menu.getByRole('link', { name: 'Afiliados' }).click()
    await expect(page).toHaveURL(/\/equipo\/afiliados$/)
    await expect(menu).not.toBeInViewport()
  })
})
