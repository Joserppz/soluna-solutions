/**
 * Bloque F2: ficha del afiliado (diseño pág. 9) contra la API de Docker. Cada prueba
 * crea su propia ficha para no depender de los datos de demostración.
 */
import { expect, test, type Page } from '@playwright/test'

import { ACCOUNTS, ADMIN_STATE, adminApi, evidence, login } from './support'

async function newPatient(consent = true) {
  const admin = await adminApi()
  const ci = String(Date.now()).slice(-8)
  const response = await admin.post('/patients', {
    name: 'Hortensia Prueba Ficha',
    ci,
    birthDate: '1955-06-12',
    phone: '70123344',
    zone: 'Sopocachi',
    address: 'Calle 1, Sopocachi',
    consent,
    accessStatus: consent ? 'Activo' : 'Pendiente',
    imageConsent: consent,
    contacts: [{ name: 'Jorge Prueba', relation: 'Hijo', phone: '70345678' }],
  })
  expect(response.status()).toBe(201)
  const { id } = (await response.json()) as { id: string }
  await admin.dispose()
  return { id, ci }
}

function tab(page: Page, name: string) {
  return page.getByRole('tab', { name: new RegExp(`^${name}`) })
}

function panel(page: Page) {
  return page.getByRole('tabpanel')
}

test.describe('con la sesión de Administración', () => {
  test.use({ storageState: ADMIN_STATE })

  test('datos, contactos, historia clínica y evaluaciones', async ({
    page,
  }) => {
    const { ci } = await newPatient()
    await page.goto(`/equipo/afiliados?buscar=${ci}`)
    await page
      .getByRole('link', { name: /^Abrir la ficha de Hortensia/ })
      .click()

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Hortensia Prueba Ficha',
    )
    await expect(
      page.getByText(/^Carnet .* años · En ASPAR desde/),
    ).toBeVisible()
    await expect(page.getByText('Uso de imagen: autorizado')).toBeVisible()
    await expect(
      page.getByRole('navigation', { name: 'Estás en' }),
    ).toContainText('Hortensia Prueba Ficha')
    await evidence(page, 'F2-05-ficha-datos')

    // Datos personales
    await panel(page).getByLabel('Zona').fill('Miraflores')
    await expect(page.getByText('Hay cambios sin guardar.')).toBeVisible()
    await page.getByRole('button', { name: 'Guardar ficha' }).click()
    await expect(
      page.getByText('Guardamos los cambios de la ficha.'),
    ).toBeVisible()

    // Familiares: agregar, hacer principal y quitar
    const contacts = page.getByRole('region', {
      name: 'Familiar o persona cuidadora',
    })
    await contacts.getByRole('button', { name: '+ Añadir otro' }).click()
    await contacts.getByLabel('Nombre completo').fill('Marta Prueba')
    await contacts.getByLabel('Relación').selectOption('Hija')
    await contacts.getByLabel('Teléfono').fill('76559012')
    await contacts.getByRole('button', { name: 'Agregar contacto' }).click()
    await expect(contacts).toContainText('Marta Prueba')
    await contacts.getByRole('button', { name: 'Hacer principal' }).click()
    await expect(
      page.getByText('Marta Prueba es ahora el contacto principal.'),
    ).toBeVisible()
    await contacts
      .getByRole('button', { name: 'Quitar a Jorge Prueba' })
      .click()
    await page.getByRole('button', { name: 'Quitar contacto' }).click()
    await expect(contacts).not.toContainText('Jorge Prueba')
    await expect(
      contacts.getByRole('button', { name: /^Quitar a/ }),
    ).toHaveCount(0)

    // Historia clínica: se guarda y queda al volver a abrir la ficha
    await tab(page, 'Historia clínica').click()
    await panel(page)
      .getByLabel('Diagnóstico')
      .fill('Enfermedad de Parkinson idiopática')
    await panel(page)
      .getByLabel('Medicación')
      .fill('Levodopa 250 mg cada 8 horas')
    await page.getByRole('button', { name: 'Guardar historia clínica' }).click()
    await expect(page.getByText('Guardamos la historia clínica.')).toBeVisible()
    await page.reload()
    await expect(panel(page).getByLabel('Medicación')).toHaveValue(
      'Levodopa 250 mg cada 8 horas',
    )
    await evidence(page, 'F2-06-historia-clinica')

    // Evaluaciones
    await tab(page, 'Evaluaciones').click()
    await expect(panel(page)).toContainText(
      'Todavía no hay evaluaciones registradas.',
    )
    await page.getByRole('button', { name: '+ Nueva evaluación' }).click()
    const dialog = page.getByRole('dialog', { name: 'Nueva evaluación' })
    await dialog.getByLabel('Área').selectOption('fisica')
    await dialog
      .getByLabel('Observaciones')
      .fill('Mejor equilibrio al levantarse de la silla.')
    await dialog.getByRole('button', { name: 'Registrar evaluación' }).click()
    await expect(dialog).toBeHidden()
    await expect(panel(page)).toContainText('Mejor equilibrio al levantarse')
    await expect(panel(page)).toContainText('Lucía Choque')
    await expect(tab(page, 'Evaluaciones')).toContainText('1')
    await evidence(page, 'F2-07-evaluaciones')

    // Una evaluación cargada por error se quita con su motivo
    await page
      .getByRole('button', { name: /^Ver la evaluación física/ })
      .click()
    const view = page.getByRole('dialog', { name: 'Evaluación física' })
    await view.getByRole('button', { name: 'Quitar…' }).click()
    const remove = page.getByRole('dialog', {
      name: '¿Quitar esta evaluación?',
    })
    await remove
      .getByLabel('Motivo')
      .fill('Se registró en la ficha de otra persona')
    await remove.getByRole('button', { name: 'Quitar evaluación' }).click()
    await expect(remove).toBeHidden()
    await expect(
      page.getByText('Quitamos la evaluación. Queda guardada con su motivo.'),
    ).toBeVisible()
    await expect(panel(page)).toContainText(
      'Todavía no hay evaluaciones registradas.',
    )

    // Asistencia y documentos
    await tab(page, 'Asistencia').click()
    await expect(panel(page)).toContainText(/\d+ de \d+ sábados?/)
    await expect(panel(page)).toContainText(
      'Todavía no hay asistencias registradas',
    )
    await tab(page, 'Documentos').click()
    await expect(panel(page)).toContainText(
      'Todavía no hay documentos en esta ficha.',
    )
    await panel(page)
      .getByLabel('Archivo')
      .setInputFiles({
        name: 'carnet.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4\n%prueba\n'),
      })
    await page.getByRole('button', { name: 'Subir documento' }).click()
    // Con Supabase configurado se sube; sin él, la API lo dice y la ficha lo muestra
    await expect(
      page
        .getByText('Subimos «Copia de carnet» a la ficha.')
        .or(
          page.getByText('El almacenamiento de documentos no está configurado'),
        ),
    ).toBeVisible()
    await evidence(page, 'F2-08-documentos')
  })

  test('baja lógica y reactivación, siempre con motivo', async ({ page }) => {
    const { id, ci } = await newPatient(false)
    await page.goto(`/equipo/afiliados/${id}`)

    await page.getByRole('button', { name: 'Marcar como inactiva…' }).click()
    const dialog = page.getByRole('dialog', { name: 'Marcar como inactiva' })
    await dialog.getByRole('button', { name: 'Marcar como inactiva' }).click()
    await expect(
      dialog.getByText('Escribe el motivo (al menos 3 letras).'),
    ).toBeVisible()
    await dialog.getByLabel('Motivo').fill('Se mudó a Cochabamba')
    await dialog.getByRole('button', { name: 'Marcar como inactiva' }).click()
    await expect(page.getByText('Motivo: Se mudó a Cochabamba.')).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Guardar ficha' }),
    ).toHaveCount(0)
    await evidence(page, 'F2-09-ficha-inactiva')

    await page.goto(`/equipo/afiliados?pestana=inactivos&buscar=${ci}`)
    await expect(page.locator('tbody tr')).toHaveCount(1)
    await expect(page.locator('tbody tr')).toContainText('Inactivo')

    await page.getByRole('link', { name: /^Abrir la ficha de/ }).click()
    await page.getByRole('button', { name: 'Reactivar ficha…' }).click()
    const again = page.getByRole('dialog', { name: 'Reactivar la ficha' })
    await again.getByLabel('Motivo').fill('Volvió a los talleres')
    await again.getByRole('button', { name: 'Reactivar ficha' }).click()
    await expect(page.getByText('está activa de nuevo')).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Guardar ficha' }),
    ).toBeVisible()
  })

  for (const size of [
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 },
  ]) {
    test(`a ${size.width}×${size.height} la ficha tiene una sola barra de desplazamiento`, async ({
      page,
    }) => {
      const { id } = await newPatient()
      await page.setViewportSize(size)
      await page.goto(`/equipo/afiliados/${id}`)
      await expect(
        page.getByRole('button', { name: 'Guardar ficha' }),
      ).toBeVisible()

      for (const name of [
        'Datos',
        'Historia clínica',
        'Evaluaciones',
        'Asistencia',
        'Documentos',
      ]) {
        await tab(page, name).click()
        const state = await page.evaluate(() => {
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
          return { sideways: doc.scrollWidth > doc.clientWidth, inner }
        })
        expect(state, name).toEqual({ sideways: false, inner: [] })
      }
    })
  }
})

test('el Voluntariado ve la ficha sin datos clínicos ni edición', async ({
  page,
}) => {
  const { id } = await newPatient()
  await login(page, ACCOUNTS.volunteer.email, ACCOUNTS.volunteer.password)
  await expect(page).toHaveURL(/\/equipo$/)
  await page.goto(`/equipo/afiliados/${id}`)

  await expect(panel(page).getByLabel('Nombre completo')).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Guardar ficha' })).toHaveCount(
    0,
  )
  for (const name of ['Historia clínica', 'Evaluaciones', 'Documentos']) {
    await tab(page, name).click()
    await expect(panel(page)).toContainText('Información protegida')
    await expect(panel(page)).toContainText('Solo el personal clínico')
  }
  await evidence(page, 'F2-10-privacidad-voluntariado')
})

test('Recepción sube documentos de una ficha sin poder verlos', async ({
  page,
}) => {
  const { id } = await newPatient()
  await login(page, ACCOUNTS.reception.email, ACCOUNTS.reception.password)
  await expect(page).toHaveURL(/\/equipo$/)
  await page.goto(`/equipo/afiliados/${id}?seccion=documentos`)

  await expect(panel(page)).toContainText('Información protegida')
  await expect(panel(page)).toContainText('Puedes subirlo aunque no lo veas')
  await expect(
    page.getByRole('button', { name: 'Subir documento' }),
  ).toBeVisible()
})
