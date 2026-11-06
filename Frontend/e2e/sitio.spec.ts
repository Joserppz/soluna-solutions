/**
 * Bloque F5a (diseño págs. 13 y 14) contra la API de Docker: la galería y el contenido
 * del sitio. La subida a Cloudinary se simula en el navegador (como el captcha): si la
 * API local no tiene claves de Cloudinary, se comprueba el aviso que ve el equipo. Los
 * álbumes «… de prueba 123456» se borran al terminar; el contenido vuelve a como estaba.
 */
import { expect, test, type Page } from '@playwright/test'

import { ADMIN_STATE, FITS, evidence, fitsWindow } from './support'

test.use({ storageState: ADMIN_STATE, viewport: { width: 1366, height: 768 } })

function suffix() {
  return Date.now().toString().slice(-6)
}

async function openGallery(page: Page) {
  await page.goto('/equipo/galeria')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Galería')
}

/** Cloudinary simulado: responde con la carpeta y la cuenta que vienen en la subida. */
async function fakeCloudinary(page: Page) {
  await page.route('https://api.cloudinary.com/**', (route) => {
    const request = route.request()
    const cloudName = new URL(request.url()).pathname.split('/')[2]
    const folder =
      /name="folder"\r\n\r\n([^\r]+)/.exec(request.postData() ?? '')?.[1] ?? ''
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        public_id: `${folder}/e2e-${suffix()}`,
        secure_url: `https://res.cloudinary.com/${cloudName}/image/upload/v1/e2e.jpg`,
        resource_type: 'image',
        width: 800,
        height: 600,
        bytes: 2048,
      }),
    })
  })
}

test('un álbum nuevo nace privado, recibe fotos, no se publica sin revisar y se elimina', async ({
  page,
}) => {
  const title = `Álbum de prueba ${suffix()}`
  await fakeCloudinary(page)
  await openGallery(page)

  await page.getByRole('button', { name: '+ Nuevo álbum' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel(/^Nombre del álbum/).fill(title)
  await dialog.getByRole('button', { name: 'Crear álbum' }).click()
  await expect(page.getByText(`Creamos el álbum «${title}».`)).toBeVisible()

  const panel = page.locator('.album')
  await expect(panel.getByRole('heading', { name: title })).toBeVisible()
  await expect(
    panel.getByText('Sube fotos o videos para publicarlo.'),
  ).toBeVisible()
  await expect(
    panel.getByRole('button', { name: 'Publicar en el sitio' }),
  ).toBeDisabled()

  // Subir una foto (Cloudinary simulado); sin claves, el equipo ve el aviso
  const signature = page.waitForResponse((r) =>
    r.url().includes('/upload-signature'),
  )
  await page.locator('input[type="file"]').setInputFiles({
    name: 'taller.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from('foto de prueba'),
  })
  if ((await signature).status() === 503) {
    await expect(
      page.getByText(/La subida de fotos y videos no está configurada/),
    ).toBeVisible()
  } else {
    await expect(
      page.getByText(`Subimos 1 archivo a «${title}».`),
    ).toBeVisible()
    await expect(panel.locator('.thumb')).toHaveCount(1)
    // Con fotos, publicar pide marcar la revisión de permisos
    await expect(
      panel.getByText('Se habilita cuando confirmes los permisos.'),
    ).toBeVisible()
    await panel.getByLabel(/^Revisé que todas las personas/).check()
    await expect(
      panel.getByRole('button', { name: 'Publicar en el sitio' }),
    ).toBeEnabled()
  }

  await panel.getByRole('button', { name: 'Eliminar el álbum…' }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Eliminar el álbum' })
    .click()
  await expect(page.getByText(`Eliminamos el álbum «${title}».`)).toBeVisible()
  await expect(page.locator('.album-card', { hasText: title })).toHaveCount(0)
})

test('el álbum en revisión avisa de quien no tiene permiso de imagen y no se publica', async ({
  page,
}) => {
  await openGallery(page)
  await page.locator('.album-card', { hasText: 'Crear con las manos' }).click()
  const panel = page.locator('.album')
  await expect(
    panel.getByText(/aparece una persona sin permiso de imagen en su ficha/),
  ).toBeVisible()
  await panel.getByLabel(/^Revisé que todas las personas/).check()
  await expect(
    panel.getByRole('button', { name: 'Publicar en el sitio' }),
  ).toBeDisabled()
  await expect.poll(() => fitsWindow(page)).toEqual(FITS)
  await evidence(page, 'F5-05-galeria')

  // La foto marcada muestra a quién falta el permiso
  await panel.locator('.thumb.is-blocked').first().click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Sin permiso')).toBeVisible()
  await expect(
    dialog.getByText(/no tiene permiso de imagen en su ficha/),
  ).toBeVisible()
  await expect.poll(() => fitsWindow(page)).toEqual(FITS)
  await evidence(page, 'F5-06-personas-en-la-foto')
  await dialog.getByRole('button', { name: 'Cancelar' }).click()
})

test('un cambio en el contenido se resalta en la vista previa y queda como borrador', async ({
  page,
}) => {
  await page.goto('/equipo/contenido?seccion=mision_vision')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Contenido del sitio',
  )
  const vision = page.getByLabel(/^Visión/)
  const original = await vision.inputValue()
  const added = `Prueba E2E ${suffix()}.`

  await vision.fill(`${original} ${added}`)
  await expect(page.locator('.preview mark')).toHaveText(added)
  await expect.poll(() => fitsWindow(page)).toEqual(FITS)
  await evidence(page, 'F5-07-contenido')
  await page.getByRole('button', { name: 'Guardar borrador' }).click()
  await expect(
    page.getByText('Guardamos el borrador. Todavía no se ve en el sitio.'),
  ).toBeVisible()
  await expect(
    page.locator('.nav__item', { hasText: 'Misión y visión' }),
  ).toContainText('Sin publicar')

  // Se vuelve al texto publicado: la sección queda sin cambios pendientes
  await vision.fill(original)
  await page.getByRole('button', { name: 'Guardar borrador' }).click()
  await expect(
    page.locator('.nav__item', { hasText: 'Misión y visión' }),
  ).not.toContainText('Sin publicar')
})

test('una red social que no es el enlace oficial no se guarda', async ({
  page,
}) => {
  await page.goto('/equipo/contenido?seccion=redes_contacto')
  await page.getByLabel('Instagram').fill('https://notinstagram.com/aspar')
  await page.getByRole('button', { name: 'Guardar enlaces' }).click()
  await expect(
    page.getByText(/Pega el enlace oficial de Instagram/),
  ).toBeVisible()
})

for (const size of [
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
]) {
  test(`a ${size.width}×${size.height} la galería y cada sección del contenido entran completas`, async ({
    page,
  }) => {
    await page.setViewportSize(size)
    await openGallery(page)
    await expect(page.locator('.album-card').first()).toBeVisible()
    await expect.poll(() => fitsWindow(page)).toEqual(FITS)
    await page.getByRole('button', { name: '+ Nuevo álbum' }).click()
    await expect.poll(() => fitsWindow(page)).toEqual(FITS)
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Cancelar' })
      .click()

    for (const key of [
      'presentacion',
      'mision_vision',
      'historia',
      'como_participar',
      'donaciones',
      'redes_contacto',
    ]) {
      await page.goto(`/equipo/contenido?seccion=${key}`)
      await expect(page.locator('#editar-seccion')).toBeVisible()
      await expect.poll(() => fitsWindow(page)).toEqual(FITS)
    }
  })
}
