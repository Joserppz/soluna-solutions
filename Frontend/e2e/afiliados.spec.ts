/**
 * Bloque F2: listado de afiliados y alta de una ficha, contra la API de Docker.
 */
import { expect, test, type Page } from '@playwright/test'

import { ACCOUNTS, ADMIN_STATE, adminApi, evidence, login } from './support'

const DUPLICATE =
  'El carnet no se puede repetir. Búscalo antes de registrar a alguien nuevo.'

/** Doce fichas fijas para recorrer páginas (se crean una sola vez). */
async function ensurePaginationPatients() {
  const admin = await adminApi()
  for (let n = 1; n <= 12; n += 1) {
    const response = await admin.post('/patients', {
      name: `Prueba Paginación ${String(n).padStart(2, '0')}`,
      ci: String(9900000 + n),
      phone: '70000000',
      contacts: [
        { name: 'Familiar de prueba', relation: 'Hija', phone: '70000001' },
      ],
    })
    expect([201, 409]).toContain(response.status())
  }
  const counts = (await (await admin.get('/patients/summary')).json()) as {
    all: number
    active: number
    consentPending: number
    inactive: number
  }
  await admin.dispose()
  return counts
}

async function tabCount(page: Page, name: string) {
  const tab = page.getByRole('tab', { name: new RegExp(`^${name}`) })
  return Number((await tab.locator('.tabs__count').textContent())?.trim())
}

/** Mide la página: desplazamiento lateral y zonas con su propia barra. */
async function scrollState(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement
    const inner = [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((element) => {
        const style = getComputedStyle(element)
        const scrollsY =
          ['auto', 'scroll'].includes(style.overflowY) &&
          element.scrollHeight > element.clientHeight + 1
        const scrollsX =
          ['auto', 'scroll'].includes(style.overflowX) &&
          element.scrollWidth > element.clientWidth + 1
        return scrollsY || scrollsX
      })
      .map((element) => element.className)
    return { sideways: doc.scrollWidth > doc.clientWidth, inner }
  })
}

test.describe('con la sesión de Administración', () => {
  test.use({ storageState: ADMIN_STATE })

  test('pestañas con los contadores de la API, búsqueda, filtro y páginas', async ({
    page,
  }) => {
    const counts = await ensurePaginationPatients()
    await page.goto('/equipo/afiliados')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Afiliados',
    )

    expect(await tabCount(page, 'Todos')).toBe(counts.all)
    expect(await tabCount(page, 'Activos')).toBe(counts.active)
    expect(await tabCount(page, 'Consentimiento pendiente')).toBe(
      counts.consentPending,
    )
    expect(await tabCount(page, 'Inactivos')).toBe(counts.inactive)
    // En escritorio se muestran las filas que entran en la ventana
    await expect(page.getByText(/^Mostrando 1–\d+ de /)).toBeVisible()
    await evidence(page, 'F2-01-listado')

    // Buscar por carnet, aunque se escriba con espacios
    await page.getByLabel('Buscar por nombre o carnet').fill('1 234 567')
    await expect(page.locator('tbody tr')).toHaveCount(1)
    await expect(page.locator('tbody tr')).toContainText('Elena Rojas')
    await expect(page.locator('tbody tr')).toContainText('Carlos Rojas · hijo')
    expect(await tabCount(page, 'Todos')).toBe(1)
    await expect(page).toHaveURL(/buscar=1234567/)

    // Doce fichas de prueba: dos páginas, ordenadas por nombre
    await page
      .getByLabel('Buscar por nombre o carnet')
      .fill('Prueba Paginación')
    await expect(page.getByText(/^Mostrando 1–\d+ de 12$/)).toBeVisible()
    const perPage = await page.locator('tbody tr').count()
    expect(perPage).toBeLessThan(12)
    await expect(page.locator('tbody tr').first()).toContainText(
      'Prueba Paginación 01',
    )
    await page.getByRole('button', { name: 'Página 2' }).click()
    await expect(
      page.getByText(
        `Mostrando ${perPage + 1}–${Math.min(2 * perPage, 12)} de 12`,
      ),
    ).toBeVisible()
    await expect(page).toHaveURL(/pagina=2/)
    await page.getByLabel('Orden').selectOption('-name')
    await expect(page.getByText(`Mostrando 1–${perPage} de 12`)).toBeVisible()
    await expect(page.locator('tbody tr').first()).toContainText(
      'Prueba Paginación 12',
    )

    // Las fichas recién creadas no tienen consentimiento
    await page.getByRole('tab', { name: /^Consentimiento pendiente/ }).click()
    await expect(page.locator('tbody tr').first()).toContainText('Pendiente')

    // Filtro por actividad: nadie de prueba vino a teatro
    await page.getByLabel('Actividad').selectOption('teatro')
    await expect(
      page.getByText('Nadie con «Prueba Paginación» vino a esa actividad'),
    ).toBeVisible()
    await page
      .getByRole('button', { name: 'Quitar la búsqueda y el filtro' })
      .click()
    await expect(page.getByLabel('Buscar por nombre o carnet')).toHaveValue('')

    // La pestaña Inactivos solo muestra fichas dadas de baja
    await page.getByRole('tab', { name: /^Inactivos/ }).click()
    await expect(page).toHaveURL(/pestana=inactivos/)
    await expect(page.locator('.patients__table.is-refreshing')).toHaveCount(0)
    for (const row of await page.locator('tbody tr').all())
      await expect(row).toContainText('Inactivo')

    // Al volver desde una ficha se recupera la misma pestaña
    await page.getByRole('tab', { name: /^Activos/ }).click()
    await page
      .getByRole('link', { name: /^Abrir la ficha de/ })
      .first()
      .click()
    await expect(page).toHaveURL(/\/equipo\/afiliados\/[0-9a-f-]+$/)
    await expect(
      page.getByRole('navigation', { name: 'Secciones' }).getByRole('link', {
        name: 'Afiliados',
      }),
    ).toHaveClass(/is-active/)
    await page.goBack()
    await expect(page.getByRole('tab', { name: /^Activos/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  for (const size of [
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 },
  ]) {
    test(`a ${size.width}×${size.height} el listado entra completo, sin barra de desplazamiento`, async ({
      page,
    }) => {
      await ensurePaginationPatients()
      await page.setViewportSize(size)
      await page.goto('/equipo/afiliados')
      await expect(page.getByText(/^Mostrando 1–\d+ de /)).toBeVisible()
      expect(await page.locator('tbody tr').count()).toBeGreaterThanOrEqual(5)

      // Ni la página, ni la tabla, ni el menú lateral se desplazan
      expect(await scrollState(page)).toEqual({ sideways: false, inner: [] })
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollHeight <=
            document.documentElement.clientHeight,
        ),
      ).toBe(true)
      await expect(page.locator('.sidebar__user')).toBeInViewport()
      await expect(
        page.getByRole('button', { name: '+ Registrar afiliado' }),
      ).toBeInViewport()
      await expect(
        page.getByRole('navigation', { name: 'Páginas de afiliados' }),
      ).toBeInViewport()
      await expect(page.locator('tbody tr').last()).toBeInViewport()
    })
  }

  test('registrar un afiliado: datos obligatorios, carnet único y contacto', async ({
    page,
  }) => {
    const ci = String(Date.now()).slice(-8)
    await page.goto('/equipo/afiliados')
    await page.getByRole('button', { name: '+ Registrar afiliado' }).click()
    const dialog = page.getByRole('dialog', { name: 'Registrar afiliado' })
    await expect(dialog).toBeVisible()

    await dialog.getByRole('button', { name: 'Registrar afiliado' }).click()
    await expect(
      dialog
        .getByText('Escribe el nombre completo (al menos 3 letras).')
        .first(),
    ).toBeVisible()
    await expect(
      dialog.getByText('Elige la relación con la persona.'),
    ).toBeVisible()
    await evidence(page, 'F2-02-alta-con-errores')

    const person = dialog.getByRole('group', { name: 'Datos de la persona' })
    await person.getByLabel('Nombre completo').fill('Teresa Prueba Alta')
    await person.getByLabel('Carnet').fill(ci)
    await person.getByLabel('Teléfono').fill('7012 3344')
    await person.getByLabel('Zona').fill('Sopocachi')
    await dialog
      .getByLabel(
        'La persona y su familia firmaron el consentimiento informado.',
      )
      .check()
    const contact = dialog.getByRole('group', {
      name: 'Familiar o persona cuidadora',
    })
    await contact.getByLabel('Nombre completo').fill('Marta Prueba')
    await contact.getByLabel('Relación').selectOption('Hija')
    await contact.getByLabel('Teléfono').fill('76559012')
    await evidence(page, 'F2-03-alta-completa')
    await dialog.getByRole('button', { name: 'Registrar afiliado' }).click()

    await expect(page).toHaveURL(/\/equipo\/afiliados\/[0-9a-f-]+$/)
    await expect(
      page.getByText(
        'Registramos a Teresa Prueba Alta. Ya puedes completar su ficha.',
      ),
    ).toBeVisible()

    // El mismo carnet no se puede registrar dos veces
    await page.goto('/equipo/afiliados')
    await page.getByRole('button', { name: '+ Registrar afiliado' }).click()
    await person.getByLabel('Nombre completo').fill('Otra Persona')
    await person.getByLabel('Carnet').fill(ci)
    await person.getByLabel('Teléfono').fill('70123344')
    await contact.getByLabel('Nombre completo').fill('Marta Prueba')
    await contact.getByLabel('Relación').selectOption('Hija')
    await contact.getByLabel('Teléfono').fill('76559012')
    await dialog.getByRole('button', { name: 'Registrar afiliado' }).click()
    await expect(dialog.getByText(DUPLICATE)).toBeVisible()
    await evidence(page, 'F2-04-carnet-repetido')

    await dialog
      .getByRole('button', { name: `Buscar el carnet ${ci} en el listado` })
      .click()
    await expect(dialog).toBeHidden()
    await expect(page.locator('tbody tr')).toHaveCount(1)
    await expect(page.locator('tbody tr')).toContainText('Teresa Prueba Alta')
    await expect(page.locator('tbody tr')).toContainText('Marta Prueba · hija')
    await expect(page.locator('tbody tr')).toContainText('Firmado')
  })
})

test('el Voluntariado consulta el listado, pero no registra fichas', async ({
  page,
}) => {
  await login(page, ACCOUNTS.volunteer.email, ACCOUNTS.volunteer.password)
  await expect(page).toHaveURL(/\/equipo$/)
  await page.goto('/equipo/afiliados')

  await expect(page.locator('tbody tr').first()).toBeVisible()
  await expect(
    page.getByRole('button', { name: '+ Registrar afiliado' }),
  ).toHaveCount(0)
})
