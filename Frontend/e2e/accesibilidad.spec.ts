/**
 * Bloque F6: revisión final de todas las pantallas, de 360 px a 1920 px, contra la API de
 * Docker. En cada tamaño ninguna pantalla se desplaza de lado ni tiene dos barras de
 * desplazamiento a la vez. En escritorio se revisa además lo básico de accesibilidad
 * (WCAG 2.1 AA) que se puede comprobar sin una persona: un título por página, idioma,
 * imágenes con texto alternativo, campos y botones con nombre, sin id repetidos.
 */
import { expect, request, test, type Page } from '@playwright/test'

import { ADMIN_STATE, API_URL, fakeExternalWidgets } from './support'

const PUBLIC = [
  '/',
  '/apoyar',
  '/ingresar',
  '/crear-cuenta',
  '/recuperar-contrasena',
]
const TEAM = [
  '/equipo',
  '/equipo/afiliados',
  'ficha',
  '/equipo/inventario',
  '/equipo/actividades',
  '/equipo/asistencia',
  '/equipo/galeria',
  '/equipo/contenido',
  '/equipo/donaciones',
  '/equipo/solicitudes',
  '/equipo/administracion/equipo',
  '/equipo/administracion/registro',
]

const SIZES = [
  { width: 360, height: 740 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 720 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
]

/** La ficha de un afiliado de la demostración, para revisar también esa pantalla. */
async function firstPatientPath(): Promise<string> {
  const context = await request.newContext({ storageState: ADMIN_STATE })
  const response = await context.get(`${API_URL}/patients?limit=1`)
  const page = (await response.json()) as { items: { id: string }[] }
  await context.dispose()
  return `/equipo/afiliados/${page.items[0]!.id}`
}

/** Ni de lado, ni dos barras a la vez (la página y una zona interna, o dos zonas). */
async function scrollState(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement
    const scrollers = [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((element) => {
        const style = getComputedStyle(element)
        // Solo cuenta lo que se ve: el menú cerrado del celular queda fuera de la pantalla
        const box = element.getBoundingClientRect()
        const onScreen =
          box.right > 0 &&
          box.left < window.innerWidth &&
          box.bottom > 0 &&
          box.top < window.innerHeight &&
          style.visibility !== 'hidden'
        return (
          onScreen &&
          ['auto', 'scroll'].includes(style.overflowY) &&
          element.scrollHeight > element.clientHeight + 1 &&
          element.clientHeight > 0
        )
      })
      .map((element) => element.className.toString().split(' ')[0])
    const sideways = [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((element) => {
        const style = getComputedStyle(element)
        return (
          ['auto', 'scroll'].includes(style.overflowX) &&
          element.scrollWidth > element.clientWidth + 1
        )
      })
      .map((element) => element.className.toString().split(' ')[0])
    const pageScrolls = doc.scrollHeight > doc.clientHeight
    return {
      sideways: doc.scrollWidth > doc.clientWidth ? ['página'] : sideways,
      bars: (pageScrolls ? 1 : 0) + scrollers.length,
      scrollers,
    }
  })
}

/** Lo que se comprueba sin una persona, según WCAG 2.1 AA. */
async function a11yProblems(page: Page) {
  return page.evaluate(() => {
    const problems: string[] = []
    const visible = (element: Element) => {
      const box = (element as HTMLElement).getBoundingClientRect()
      const style = getComputedStyle(element)
      return (
        box.width > 0 &&
        box.height > 0 &&
        style.visibility !== 'hidden' &&
        !element.closest('[aria-hidden="true"]')
      )
    }
    const named = (element: Element) => {
      const label =
        element.getAttribute('aria-label') ||
        element.getAttribute('title') ||
        (element.getAttribute('aria-labelledby') ?? '')
          .split(' ')
          .map((id) => document.getElementById(id)?.textContent ?? '')
          .join('')
      if (label.trim()) return true
      if (element.id && document.querySelector(`label[for="${element.id}"]`))
        return true
      if (element.closest('label')) return true
      const text =
        element.textContent?.trim() ||
        [...element.querySelectorAll('img')].map((img) => img.alt).join('')
      return Boolean(text)
    }
    if (document.documentElement.lang !== 'es') problems.push('idioma')
    const titles = document.querySelectorAll('h1')
    if (titles.length !== 1) problems.push(`h1 × ${titles.length}`)
    for (const img of document.querySelectorAll('img'))
      if (!img.hasAttribute('alt')) problems.push(`img sin alt: ${img.src}`)
    for (const control of document.querySelectorAll(
      'input:not([type="hidden"]), select, textarea',
    ))
      if (visible(control) && !named(control))
        problems.push(`campo sin nombre: ${control.outerHTML.slice(0, 80)}`)
    for (const control of document.querySelectorAll('button, a[href]'))
      if (visible(control) && !named(control))
        problems.push(`sin nombre: ${control.outerHTML.slice(0, 80)}`)
    const ids = [...document.querySelectorAll('[id]')].map((e) => e.id)
    const repeated = ids.filter((id, i) => ids.indexOf(id) !== i)
    if (repeated.length)
      problems.push(`id repetidos: ${[...new Set(repeated)]}`)
    if (
      !document.querySelector(
        'a[href="#contenido"], .skip-link, [href="#main"]',
      )
    )
      problems.push('sin «Saltar al contenido»')
    return problems
  })
}

async function settle(page: Page) {
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
  // Las listas que se reparten el alto se miden después de pintar
  await page.waitForTimeout(250)
}

test.describe('sitio y acceso, sin sesión', () => {
  test.beforeEach(async ({ page }) => {
    await fakeExternalWidgets(page)
  })

  for (const size of SIZES) {
    test(`a ${size.width}×${size.height} ninguna pantalla se desplaza de lado ni tiene dos barras`, async ({
      page,
    }) => {
      await page.setViewportSize(size)
      for (const path of PUBLIC) {
        await page.goto(path)
        await settle(page)
        const state = await scrollState(page)
        expect(state.sideways, `${path}: de lado`).toEqual([])
        expect(state.bars, `${path}: ${state.scrollers}`).toBeLessThanOrEqual(1)
      }
    })
  }

  test('lo básico de accesibilidad en el sitio y el acceso', async ({
    page,
  }) => {
    for (const path of PUBLIC) {
      await page.goto(path)
      await settle(page)
      expect(await a11yProblems(page), path).toEqual([])
    }
  })
})

test.describe('espacio del equipo, con Administración', () => {
  test.use({ storageState: ADMIN_STATE })

  let paths: string[] = []
  test.beforeAll(async () => {
    const record = await firstPatientPath()
    paths = TEAM.map((path) => (path === 'ficha' ? record : path))
  })

  for (const size of SIZES) {
    test(`a ${size.width}×${size.height} ninguna pantalla se desplaza de lado ni tiene dos barras`, async ({
      page,
    }) => {
      await page.setViewportSize(size)
      for (const path of paths) {
        await page.goto(path)
        await settle(page)
        const state = await scrollState(page)
        expect(state.sideways, `${path}: de lado`).toEqual([])
        expect(state.bars, `${path}: ${state.scrollers}`).toBeLessThanOrEqual(1)
      }
    })
  }

  test('lo básico de accesibilidad en cada sección', async ({ page }) => {
    for (const path of paths) {
      await page.goto(path)
      await settle(page)
      expect(await a11yProblems(page), path).toEqual([])
    }
  })
})
