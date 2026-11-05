import { DOMWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type {
  InventorySummary,
  ItemOut,
  ItemPage,
  MovementOut,
} from '../api/types'
import { useToast } from '../composables/useToast'
import {
  ADMIN_SESSION,
  DASHBOARD,
  VOLUNTEER_SESSION,
  createApiFake,
  mountApp,
  settle,
  type ApiFake,
  type RecordedCall,
} from './apiFake'

const PATH = '/equipo/inventario'

afterEach(() => {
  document.body.innerHTML = ''
  useToast().clear()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function item(overrides: Partial<ItemOut> = {}): ItemOut {
  return {
    id: 'i-1',
    code: null,
    name: 'Banda elástica',
    category: 'fisioterapia',
    categoryLabel: 'Fisioterapia',
    quantity: 2,
    condition: 'dañado',
    conditionLabel: 'Dañado',
    origin: 'propio',
    originLabel: 'Propio',
    donorOrInstitution: '',
    entryDate: '2026-11-01',
    location: 'Sede ASPAR',
    active: true,
    deactivationReason: null,
    createdAt: '2026-11-01T12:00:00Z',
    updatedAt: '2026-11-01T12:00:00Z',
    ...overrides,
  }
}

const ITEMS: ItemOut[] = [
  item(),
  item({
    id: 'i-2',
    name: 'Barras paralelas',
    quantity: 1,
    condition: 'nuevo',
    conditionLabel: 'Nuevo',
    origin: 'alcaldia',
    originLabel: 'Alcaldía',
    donorOrInstitution: 'Gobierno Municipal',
  }),
  item({
    id: 'i-3',
    name: 'Bastones',
    category: 'movilidad',
    categoryLabel: 'Apoyo a la movilidad',
    quantity: 8,
    condition: 'nuevo',
    conditionLabel: 'Nuevo',
    origin: 'donado',
    originLabel: 'Donado',
    donorOrInstitution: 'Familia Rojas',
  }),
]

const SUMMARY: InventorySummary = {
  total: 8,
  alcaldia: 3,
  donado: 3,
  propio: 2,
  damaged: 1,
}

function page(
  call: RecordedCall,
  items: ItemOut[] = ITEMS,
): { body: ItemPage } {
  const limit = Number(call.query.get('limit') ?? 50)
  const offset = Number(call.query.get('offset') ?? 0)
  return {
    body: {
      items: items.slice(offset, offset + limit),
      total: items.length,
      limit,
      offset,
    },
  }
}

const MOVEMENTS: MovementOut[] = [
  {
    id: 'm-1',
    counterpart: '',
    createdAt: '2026-10-20T14:00:00Z',
    movementLabel: 'Ingreso',
    movementType: 'ingreso',
    quantityDelta: 12,
    reason: 'Ingreso de 12 unidades',
    userName: 'René Vargas',
  },
  {
    id: 'm-2',
    counterpart: 'Familia Apaza',
    createdAt: '2026-10-23T14:00:00Z',
    movementLabel: 'Préstamo',
    movementType: 'prestamo',
    quantityDelta: -2,
    reason: '',
    userName: 'Patricia Mendoza',
  },
]

function fakeApi(session = { body: ADMIN_SESSION }) {
  return createApiFake({
    'GET /auth/me': session,
    'GET /dashboard/summary': { body: DASHBOARD },
    'GET /inventory': (call) => page(call),
    'GET /inventory/summary': { body: SUMMARY },
    'GET /inventory/i-1/movements': { body: MOVEMENTS },
    'GET /inventory/i-2/movements': { body: [] },
  })
}

function lastQuery(fake: ApiFake, key: string) {
  const calls = fake.callsTo(key)
  return Object.fromEntries(calls[calls.length - 1]!.query)
}

function body() {
  return new DOMWrapper(document.body)
}

function field(
  label: string,
  root: { findAll(selector: string): DOMWrapper<Element>[] } = body(),
) {
  const found = root
    .findAll('.field')
    .find((f) => f.get('label').text().replace('*', '').trim() === label)
  if (!found) throw new Error(`No hay un campo «${label}»`)
  return found.get('input, select, textarea')
}

function button(
  text: string,
  root: { findAll(selector: string): DOMWrapper<Element>[] } = body(),
) {
  const found = root
    .findAll('button')
    .find((b) => b.text().replace(/\s+/g, ' ').trim() === text)
  if (!found) throw new Error(`No hay un botón «${text}»`)
  return found
}

function tab(text: string) {
  const found = body()
    .findAll('[role="tab"]')
    .find((t) => t.text().trim() === text)
  if (!found) throw new Error(`No hay una pestaña «${text}»`)
  return found.trigger('click').then(settle)
}

describe('Inventario', () => {
  it('muestra los contadores, el aviso de dañados y cada material con su origen', async () => {
    const fake = fakeApi()
    const { wrapper } = await mountApp(PATH, fake)

    expect(wrapper.get('h1').text()).toBe('Inventario')
    expect(wrapper.text()).toContain('8materiales registrados')
    expect(wrapper.text()).toContain('3vinieron de la Alcaldía')
    expect(wrapper.text()).toContain('3fueron donados')
    expect(wrapper.text()).toContain('1 material dañado por revisar')

    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(3)
    expect(rows[0]!.text()).toContain('Banda elástica')
    expect(rows[0]!.text()).toContain('Dañado')
    expect(rows[1]!.text()).toContain('Alcaldía')
    expect(rows[1]!.text()).toContain('Gobierno Municipal')
    expect(rows[2]!.text()).toContain('Familia Rojas')
    // Sin notas al pie: la tabla usa todo el alto
    expect(wrapper.text()).not.toContain(
      'Los bienes de la Alcaldía se muestran',
    )
    expect(wrapper.find('.counts .damaged').exists()).toBe(true)
  })

  it('sin materiales dañados no muestra el aviso', async () => {
    const fake = fakeApi()
    fake.on('GET /inventory/summary', { body: { ...SUMMARY, damaged: 0 } })
    const { wrapper } = await mountApp(PATH, fake)

    expect(wrapper.text()).not.toContain('dañado por revisar')
  })

  it('los filtros van a la API y quedan en la dirección', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const fake = fakeApi()
    const { wrapper, router } = await mountApp(PATH, fake)

    await wrapper.get('#filtro-origen').setValue('alcaldia')
    await settle()
    expect(lastQuery(fake, 'GET /inventory')).toMatchObject({
      origin: 'alcaldia',
    })
    expect(router.currentRoute.value.query.origen).toBe('alcaldia')

    await wrapper.get('#filtro-categoria').setValue('movilidad')
    await wrapper.get('#filtro-condicion').setValue('dañado')
    await settle()
    expect(lastQuery(fake, 'GET /inventory')).toMatchObject({
      origin: 'alcaldia',
      category: 'movilidad',
      condition: 'dañado',
    })

    await wrapper.get('#buscar-material').setValue('  bastones ')
    await vi.advanceTimersByTimeAsync(350)
    await settle()
    expect(lastQuery(fake, 'GET /inventory')).toMatchObject({
      search: 'bastones',
    })
    vi.useRealTimers()
  })

  it('exporta CSV o Excel con los bienes de la Alcaldía aparte', async () => {
    const createObjectURL = vi.fn(() => 'blob:inventario')
    vi.stubGlobal(
      'URL',
      Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }),
    )
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.download).toMatch(/^inventario-\d{4}-\d{2}-\d{2}\.csv$/)
      })
    const fake = fakeApi()
    fake.on('GET /inventory/export', { body: 'contenido' })
    const { wrapper } = await mountApp(PATH, fake)

    await wrapper.get('button[aria-label="Exportar CSV"]').trigger('click')
    await settle()

    expect(lastQuery(fake, 'GET /inventory/export')).toEqual({ format: 'csv' })
    expect(click).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain(
      'Los bienes de la Alcaldía van en un archivo aparte.',
    )
  })

  it('cambiar la cantidad pide el motivo; sin cambiarla, el motivo no hace falta', async () => {
    const fake = fakeApi()
    fake.on('PATCH /inventory/i-1', { body: item({ quantity: 5 }) })
    const { wrapper } = await mountApp(PATH, fake)

    await wrapper.get('[aria-label="Editar Banda elástica"]').trigger('click')
    await settle()
    // El historial está en su propia pestaña
    await tab('Historial')
    expect(body().text()).toContain('Historial de este material')
    expect(body().text()).toContain('Ingreso')
    expect(body().text()).toContain('René Vargas')
    expect(body().text()).toContain('-2')
    await tab('Datos')

    // El motivo solo se pide (y se guarda) cuando cambia la cantidad
    expect(() => field('Motivo del cambio')).toThrow()
    await field('Cantidad').setValue('5')
    await button('Guardar cambios').trigger('click')
    await settle()
    expect(body().text()).toContain(
      'Cambiar la cantidad necesita un motivo, para la rendición de cuentas.',
    )
    expect(fake.callsTo('PATCH /inventory/i-1')).toHaveLength(0)

    await field('Motivo del cambio').setValue(
      'Se encontraron 3 más en el depósito',
    )
    await button('Guardar cambios').trigger('click')
    await settle()
    expect(fake.callsTo('PATCH /inventory/i-1')[0]!.body).toEqual({
      quantity: 5,
      reason: 'Se encontraron 3 más en el depósito',
    })
  })

  it('guardar un cambio de condición no envía cantidad ni motivo', async () => {
    const fake = fakeApi()
    fake.on('PATCH /inventory/i-1', {
      body: item({ condition: 'regular', conditionLabel: 'Regular' }),
    })
    const { wrapper } = await mountApp(PATH, fake)

    await wrapper.get('[aria-label="Editar Banda elástica"]').trigger('click')
    await settle()
    await field('Condición').setValue('regular')
    await button('Guardar cambios').trigger('click')
    await settle()

    expect(fake.callsTo('PATCH /inventory/i-1')[0]!.body).toEqual({
      condition: 'regular',
    })
  })

  it('anota un movimiento: un préstamo va en positivo y un ajuste pide motivo', async () => {
    const fake = fakeApi()
    fake.on('POST /inventory/i-1/movements', { body: MOVEMENTS[0] })
    const { wrapper } = await mountApp(PATH, fake)

    await wrapper.get('[aria-label="Editar Banda elástica"]').trigger('click')
    await settle()
    await tab('Historial')

    await field('Tipo', body()).setValue('prestamo')
    await field('Unidades').setValue('-2')
    await body().get('form.movement').trigger('submit')
    await settle()
    expect(body().text()).toContain(
      'En un ingreso, préstamo o devolución la cantidad es positiva.',
    )

    await field('Unidades').setValue('2')
    await field('Persona o familia').setValue('Familia Apaza')
    await body().get('form.movement').trigger('submit')
    await settle()
    expect(fake.callsTo('POST /inventory/i-1/movements')[0]!.body).toEqual({
      movementType: 'prestamo',
      quantity: 2,
      reason: '',
      counterpart: 'Familia Apaza',
    })

    await field('Tipo', body()).setValue('ajuste')
    await field('Unidades').setValue('-1')
    await field('Motivo').setValue('')
    await body().get('form.movement').trigger('submit')
    await settle()
    expect(body().text()).toContain('Un ajuste necesita el motivo.')
  })

  it('un enlace con ?material= abre ese material aunque no esté en la página', async () => {
    const fake = fakeApi()
    const hidden = item({ id: 'i-9', name: 'Colchonetas', condition: 'bueno' })
    fake.on('GET /inventory/i-9', { body: hidden })
    fake.on('GET /inventory/i-9/movements', { body: [] })
    await mountApp(`${PATH}?material=i-9`, fake)

    expect(fake.callsTo('GET /inventory/i-9')).toHaveLength(1)
    expect(field('Nombre').element).toHaveProperty('value', 'Colchonetas')
  })

  it('en ventana completa el historial se pagina y el formulario queda a la vista', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    )
    // Entran dos movimientos de 52 px en el historial
    vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(
      function (this: Element) {
        return this.classList.contains('history__area') ? 110 : 0
      },
    )
    const many: MovementOut[] = [0, 1, 2, 3, 4].map((n) => ({
      ...MOVEMENTS[0]!,
      id: `m-${n}`,
      reason: `Movimiento ${n + 1}`,
    }))
    const fake = fakeApi()
    fake.on('GET /inventory/i-1/movements', { body: many })
    const { wrapper } = await mountApp(PATH, fake)

    await wrapper.get('[aria-label="Editar Banda elástica"]').trigger('click')
    await settle()
    await tab('Historial')
    await settle()

    expect(body().findAll('.history__list li')).toHaveLength(2)
    expect(body().get('.history__pager').text()).toContain('1–2 de 5')
    await body().get('[aria-label="Movimientos anteriores"]').trigger('click')
    await settle()
    expect(body().get('.history__pager').text()).toContain('3–4 de 5')
    expect(body().text()).toContain('Movimiento 3')
    expect(body().find('form.movement').exists()).toBe(true)
  })

  it('dar de baja exige un motivo y lo envía', async () => {
    const fake = fakeApi()
    fake.on('POST /inventory/i-1/deactivate', {
      body: item({
        active: false,
        quantity: 0,
        deactivationReason: 'Se rompió',
      }),
    })
    const { wrapper } = await mountApp(PATH, fake)

    await wrapper.get('[aria-label="Editar Banda elástica"]').trigger('click')
    await settle()
    await button('Dar de baja con motivo…').trigger('click')
    await settle()
    await button('Dar de baja', body()).trigger('click')
    await settle()
    expect(body().text()).toContain(
      'Escribe el motivo de la baja (al menos 3 letras).',
    )
    expect(fake.callsTo('POST /inventory/i-1/deactivate')).toHaveLength(0)

    await field('Motivo de la baja', body()).setValue('Se rompió')
    await button('Dar de baja', body()).trigger('click')
    await settle()
    expect(fake.callsTo('POST /inventory/i-1/deactivate')[0]!.body).toEqual({
      reason: 'Se rompió',
    })
  })

  it('añadir un material pide el donante cuando no es propio', async () => {
    const fake = fakeApi()
    fake.on('POST /inventory', {
      status: 201,
      body: item({
        id: 'i-9',
        name: 'Sillas plegables',
        origin: 'alcaldia',
        originLabel: 'Alcaldía',
        donorOrInstitution: 'Gobierno Municipal',
      }),
    })
    const { wrapper } = await mountApp(PATH, fake)

    await button('+ Añadir material', wrapper).trigger('click')
    await settle()
    // Se abre una ventana, como «Registrar afiliado»
    expect(body().get('[role="dialog"]').attributes('aria-labelledby')).toBe(
      'panel-titulo',
    )
    await field('Nombre', body()).setValue('Sillas plegables')
    await field('Origen', body()).setValue('alcaldia')
    await button('Añadir material', body()).trigger('click')
    await settle()
    expect(body().text()).toContain('Escribe la institución que lo entregó.')

    await field('Institución', body()).setValue('Gobierno Municipal')
    await button('Añadir material', body()).trigger('click')
    await settle()

    expect(fake.callsTo('POST /inventory')[0]!.body).toMatchObject({
      name: 'Sillas plegables',
      origin: 'alcaldia',
      donorOrInstitution: 'Gobierno Municipal',
      quantity: 1,
      condition: 'nuevo',
    })
    // La ventana se cierra y el material nuevo queda abierto en el panel
    expect(body().find('[role="dialog"]').exists()).toBe(false)
    expect(field('Nombre').element).toHaveProperty('value', 'Sillas plegables')
  })

  it('sin permiso de inventario no ofrece añadir ni editar', async () => {
    const fake = fakeApi({ body: VOLUNTEER_SESSION })
    const { router } = await mountApp(PATH, fake)

    expect(router.currentRoute.value.name).toBe('resumen')
    expect(fake.callsTo('GET /inventory')).toHaveLength(0)
  })
})
