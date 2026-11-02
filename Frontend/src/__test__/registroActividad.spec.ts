import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AuditEvent, AuditPage, AuditSummary } from '../api/types'
import { useToast } from '../composables/useToast'
import {
  ADMIN_SESSION,
  DASHBOARD,
  VOLUNTEER_SESSION,
  createApiFake,
  mountApp,
  settle,
  type ApiFake,
  type FakeReply,
  type RecordedCall,
} from './apiFake'

const PATH = '/equipo/administracion/registro'

// Lunes 2 de noviembre de 2026, 12:00 en La Paz
const NOW = new Date('2026-11-02T16:00:00Z')

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
  useToast().clear()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function event(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: 'e-1',
    date: '2026-11-02T14:42:00Z',
    actor: 'coordinacion@aspar.org',
    actorName: 'René Vargas',
    actorRole: 'Coordinación',
    category: 'DONACIONES',
    area: 'donaciones',
    areaLabel: 'Donaciones',
    severity: 'INFO',
    action: 'Confirmación de aporte',
    detail:
      'Jorge Arce Vargas · QR bancario · Bs. 200.00, extracto LIB-0193 (3f2b8c1e-6a8d-4f5e-9c1b-2d7e4a9b0c11)',
    ipAddress: null,
    occurrences: 1,
    lastOccurredAt: '2026-11-02T14:42:00Z',
    review: null,
    ...overrides,
  }
}

const EVENTS: AuditEvent[] = [
  event(),
  event({
    id: 'e-2',
    date: '2026-11-02T14:15:00Z',
    actor: 'voluntario@aspar.org',
    actorName: 'Daniel Quispe',
    actorRole: 'Voluntariado',
    category: 'SISTEMA',
    area: 'accesos',
    areaLabel: 'Accesos',
    severity: 'CRITICAL',
    action: 'Intento de acceso restringido bloqueado',
    detail: 'El rol Voluntariado intentó GET /api/v1/users sin el permiso',
    occurrences: 3,
    review: 'acceso_bloqueado',
  }),
  event({
    id: 'e-3',
    date: '2026-11-01T22:30:00Z',
    actor: 'admin@aspar.org',
    actorName: 'Lucía Choque',
    action: 'Anulación de aviso de aporte',
    detail: 'Motivo: no se encontró en el extracto del banco',
    review: 'aporte_anulado',
  }),
  event({
    id: 'e-4',
    date: '2026-10-30T15:12:00Z',
    actor: 'nadie@aspar.org',
    actorName: null,
    actorRole: 'Sistema',
    category: 'AUTENTICACION',
    area: 'accesos',
    areaLabel: 'Accesos',
    action: 'Intento fallido de inicio de sesión',
    detail: 'Correo no registrado',
  }),
]

/** El registro paginado según limit y offset (60 movimientos de los 4 de arriba). */
function pageFor(call: RecordedCall, items = EVENTS): { body: AuditPage } {
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

function summary(review = { blockedAccess: 1, cancelledDonations: 1 }) {
  const body: AuditSummary = {
    days: 7,
    dateFrom: '2026-10-26T16:00:00Z',
    areas: [
      { area: 'afiliados', label: 'Afiliados', count: 46 },
      { area: 'accesos', label: 'Accesos', count: 35 },
      { area: 'donaciones', label: 'Donaciones', count: 18 },
      { area: 'solicitudes', label: 'Solicitudes', count: 11 },
      { area: 'equipo', label: 'Equipo', count: 3 },
      { area: 'actividades', label: 'Actividades y asistencia', count: 4 },
      { area: 'inventario', label: 'Inventario', count: 2 },
      { area: 'sitio', label: 'Galería y contenido', count: 0 },
    ],
    review: {
      ...review,
      total: review.blockedAccess + review.cancelledDonations,
    },
  }
  return { body }
}

function fakeApi(session: FakeReply = { body: ADMIN_SESSION }) {
  return createApiFake({
    'GET /auth/me': session,
    'GET /dashboard/summary': { body: DASHBOARD },
    'GET /audit': (call) => pageFor(call),
    'GET /audit/summary': summary(),
  })
}

function lastQuery(fake: ApiFake, key: string) {
  const calls = fake.callsTo(key)
  return Object.fromEntries(calls[calls.length - 1]!.query)
}

function clean(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

describe('Registro de actividad', () => {
  it('agrupa por día y muestra quién, qué, cuándo y el área', async () => {
    const fake = fakeApi()
    const { wrapper } = await mountApp(PATH, fake)

    expect(wrapper.get('h1').text()).toBe('Registro de actividad')
    expect(lastQuery(fake, 'GET /audit')).toEqual({
      days: '7',
      limit: '25',
      offset: '0',
    })
    expect(wrapper.findAll('.day__title').map((h) => h.text())).toEqual([
      'Hoy, lunes 2 de noviembre',
      'Ayer, domingo 1 de noviembre',
      'Viernes 30 de octubre',
    ])

    const entries = wrapper.findAll('.entry')
    expect(entries).toHaveLength(4)
    const first = entries[0]!
    expect(first.get('time').text()).toBe('10:42')
    expect(first.get('time').attributes('datetime')).toBe(
      '2026-11-02T14:42:00Z',
    )
    expect(clean(first.get('.entry__line').text())).toBe(
      'René Vargas · Confirmación de aporte',
    )
    // Sin los identificadores internos
    expect(clean(first.get('.entry__detail').text())).toBe(
      'Jorge Arce Vargas · QR bancario · Bs. 200.00, extracto LIB-0193',
    )
    expect(first.get('.entry__area').text()).toBe('Donaciones')
    expect(first.classes()).not.toContain('is-review')

    // Situaciones para revisar, resaltadas; las repetidas dicen cuántas veces
    const blocked = entries[1]!
    expect(blocked.classes()).toContain('is-review')
    expect(blocked.text()).toContain('Para revisar')
    expect(blocked.text()).toContain('· 3 veces')
    expect(entries[2]!.classes()).toContain('is-review')
    // Si no es alguien del equipo, se ve el correo con que se intentó
    expect(entries[3]!.text()).toContain('nadie@aspar.org')

    expect(wrapper.text()).toContain('Mostrando 1–4 de 4')
    expect(wrapper.text()).not.toContain('Ver días anteriores')
  })

  it('filtra por área, situaciones para revisar, días y persona o afiliado', async () => {
    vi.useFakeTimers({
      shouldAdvanceTime: true,
      toFake: ['Date', 'setTimeout', 'clearTimeout'],
    })
    vi.setSystemTime(NOW)
    const fake = fakeApi()
    const { wrapper, router } = await mountApp(PATH, fake)

    await wrapper.get('#filtro-area').setValue('donaciones')
    await settle()
    expect(lastQuery(fake, 'GET /audit')).toMatchObject({ area: 'donaciones' })

    await wrapper.get('#filtro-revisar').setValue('true')
    await settle()
    expect(lastQuery(fake, 'GET /audit')).toMatchObject({ review: 'true' })

    await wrapper.get('#filtro-dias').setValue('30')
    await settle()
    expect(lastQuery(fake, 'GET /audit')).toMatchObject({ days: '30' })

    await wrapper.get('#buscar-registro').setValue('  alba   gutiérrez ')
    await vi.advanceTimersByTimeAsync(350)
    await settle()
    expect(lastQuery(fake, 'GET /audit')).toEqual({
      search: 'alba gutiérrez',
      area: 'donaciones',
      review: 'true',
      days: '30',
      limit: '25',
      offset: '0',
    })
    expect(router.currentRoute.value.query).toEqual({
      buscar: 'alba gutiérrez',
      area: 'donaciones',
      revisar: '1',
      dias: '30',
    })
  })

  it('recupera los filtros de la dirección y explica cuando no hay nada', async () => {
    const fake = fakeApi()
    fake.on('GET /audit', (call) =>
      pageFor(call, call.query.get('search') ? [] : EVENTS),
    )
    const { wrapper } = await mountApp(
      `${PATH}?buscar=nadie&area=equipo&dias=90`,
      fake,
    )

    expect(lastQuery(fake, 'GET /audit')).toMatchObject({
      search: 'nadie',
      area: 'equipo',
      days: '90',
    })
    expect(wrapper.text()).toContain(
      'No hay actividad de «nadie» con estos filtros (últimos 90 días).',
    )
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Quitar la búsqueda y los filtros')!
      .trigger('click')
    await settle()
    expect(lastQuery(fake, 'GET /audit')).toEqual({
      days: '90',
      limit: '25',
      offset: '0',
    })
    expect(wrapper.findAll('.entry')).toHaveLength(4)
  })

  it('«Ver días anteriores» trae los siguientes y «Más recientes» vuelve', async () => {
    const many = Array.from({ length: 30 }, (_, index) =>
      event({
        id: `m-${index}`,
        date: new Date(NOW.getTime() - index * 3_600_000).toISOString(),
      }),
    )
    const fake = fakeApi()
    fake.on('GET /audit', (call) => pageFor(call, many))
    const { wrapper } = await mountApp(PATH, fake)

    expect(wrapper.text()).toContain('Mostrando 1–25 de 30')
    expect(wrapper.text()).not.toContain('Más recientes')
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Ver días anteriores'))!
      .trigger('click')
    await settle()
    expect(lastQuery(fake, 'GET /audit')).toMatchObject({ offset: '25' })
    expect(wrapper.text()).toContain('Mostrando 26–30 de 30')
    expect(wrapper.text()).not.toContain('Ver días anteriores')

    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Más recientes'))!
      .trigger('click')
    await settle()
    expect(lastQuery(fake, 'GET /audit')).toMatchObject({ offset: '0' })
    expect(wrapper.text()).toContain('Mostrando 1–25 de 30')
  })

  it('muestra un error de la API y permite reintentar', async () => {
    const fake = fakeApi()
    fake.on('GET /audit', [
      { status: 500, body: { detail: 'Error interno' } },
      { body: pageFor({ query: new URLSearchParams() } as RecordedCall).body },
    ])
    const { wrapper } = await mountApp(PATH, fake)

    expect(wrapper.get('[role="alert"]').text()).toContain('Reintentar')
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Reintentar')!
      .trigger('click')
    await settle()
    expect(wrapper.findAll('.entry')).toHaveLength(4)
  })

  it('el Voluntariado no entra al registro', async () => {
    const fake = fakeApi({ body: VOLUNTEER_SESSION })
    const { router } = await mountApp(PATH, fake)

    expect(router.currentRoute.value.name).toBe('resumen')
    expect(fake.callsTo('GET /audit')).toHaveLength(0)
  })
})

describe('Resumen de la semana', () => {
  it('muestra los movimientos por área y filtra al tocar una', async () => {
    const fake = fakeApi()
    const { wrapper } = await mountApp(PATH, fake)

    expect(fake.callsTo('GET /audit/summary')[0]!.query.get('days')).toBe('7')
    expect(wrapper.text()).toContain('Nada se puede editar ni borrar')
    const rows = wrapper.findAll('.week__row')
    expect(
      rows.map((row) => [
        row.get('.week__label').text(),
        row.get('.week__count').text(),
      ]),
    ).toEqual([
      ['Afiliados', '46'],
      ['Accesos', '35'],
      ['Donaciones', '18'],
      ['Solicitudes', '11'],
      ['Equipo', '3'],
    ])
    expect(wrapper.get('.week__others').text()).toBe('Otras áreas: 6')
    // La barra más larga es la del área con más movimientos
    expect(rows[0]!.get('.week__bar').attributes('style')).toContain(
      'width: 100%',
    )

    await rows[2]!.trigger('click')
    await settle()
    expect(lastQuery(fake, 'GET /audit')).toMatchObject({ area: 'donaciones' })
    expect(rows[2]!.attributes('aria-pressed')).toBe('true')
    // Tocarla de nuevo quita el filtro
    await rows[2]!.trigger('click')
    await settle()
    expect(lastQuery(fake, 'GET /audit').area).toBeUndefined()
  })

  it('avisa las situaciones para revisar y las muestra solas', async () => {
    const fake = fakeApi()
    const { wrapper } = await mountApp(`${PATH}?dias=7`, fake)

    const alert = wrapper.get('[data-testid="situaciones-para-revisar"]')
    expect(alert.get('strong').text()).toBe('2 situaciones para revisar')
    expect(alert.get('p').text()).toBe(
      'Un intento de acceso bloqueado y un aporte anulado. Se resaltan en la lista.',
    )
    await alert.get('button').trigger('click')
    await settle()
    expect(lastQuery(fake, 'GET /audit')).toMatchObject({ review: 'true' })
    expect(
      wrapper.find('[data-testid="situaciones-para-revisar"] button').exists(),
    ).toBe(false)
  })

  it('sin situaciones para revisar lo dice con calma', async () => {
    const fake = fakeApi()
    fake.on(
      'GET /audit/summary',
      summary({ blockedAccess: 0, cancelledDonations: 0 }),
    )
    const { wrapper } = await mountApp(PATH, fake)

    expect(
      wrapper.find('[data-testid="situaciones-para-revisar"]').exists(),
    ).toBe(false)
    expect(wrapper.text()).toContain(
      'Sin situaciones para revisar esta semana.',
    )
  })
})

describe('Descargar registro', () => {
  it('descarga lo filtrado en Excel y la descarga queda en el registro', async () => {
    const createObjectURL = vi.fn(() => 'blob:registro')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal(
      'URL',
      Object.assign(URL, { createObjectURL, revokeObjectURL }),
    )
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.download).toBe('registro-de-actividad-2026-11-02.xlsx')
        expect(this.href).toBe('blob:registro')
      })
    const fake = fakeApi()
    fake.on('GET /audit/export', { body: 'contenido' })
    const { wrapper } = await mountApp(`${PATH}?area=equipo`, fake)

    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Descargar registro')!
      .trigger('click')
    await settle()

    expect(lastQuery(fake, 'GET /audit/export')).toEqual({
      area: 'equipo',
      days: '7',
      format: 'xlsx',
    })
    expect(click).toHaveBeenCalledTimes(1)
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain(
      'Descargamos el registro. La descarga también quedó anotada.',
    )
    // Se vuelve a leer la lista y el resumen: la descarga aparece en el registro
    expect(fake.callsTo('GET /audit')).toHaveLength(2)
    expect(fake.callsTo('GET /audit/summary')).toHaveLength(2)
  })

  it('si la API no la permite, lo explica', async () => {
    const fake = fakeApi()
    fake.on('GET /audit/export', {
      status: 403,
      body: { detail: 'No tienes permiso para realizar esta acción.' },
    })
    const { wrapper } = await mountApp(PATH, fake)

    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Descargar registro')!
      .trigger('click')
    await settle()

    expect(wrapper.text()).toContain(
      'No tienes permiso para realizar esta acción.',
    )
  })
})

describe('Registro en ventana completa (escritorio)', () => {
  function fitWindow(listHeight: number) {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    )
    vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(
      function (this: Element) {
        return this.classList.contains('log__list') ? listHeight : 0
      },
    )
  }

  it('pide los movimientos que entran y muestra los que caben con sus días', async () => {
    // 420 px: un encabezado de 40 y siete movimientos de 52
    fitWindow(420)
    const fake = fakeApi()
    const { wrapper } = await mountApp(PATH, fake)

    expect(lastQuery(fake, 'GET /audit')).toEqual({
      days: '7',
      limit: '7',
      offset: '0',
    })
    expect(fake.callsTo('GET /audit')).toHaveLength(1)
    expect(wrapper.find('.log--fit').exists()).toBe(true)
    // Tres días (120 px) y cuatro movimientos (208 px) entran en 420
    expect(wrapper.findAll('.entry')).toHaveLength(4)
  })

  it('si los encabezados de día no dejan lugar, muestra menos y sigue desde ahí', async () => {
    // 260 px: pide 4; con tres días solo entran tres movimientos (3·40 + 3·52 = 276 no;
    // 2·40 + 3·52 = 236 sí)
    fitWindow(260)
    const fake = fakeApi()
    const { wrapper } = await mountApp(PATH, fake)

    expect(lastQuery(fake, 'GET /audit')).toMatchObject({ limit: '4' })
    expect(wrapper.findAll('.entry')).toHaveLength(3)
    expect(wrapper.findAll('.day__title')).toHaveLength(2)
    expect(wrapper.text()).toContain('Mostrando 1–3 de 4')

    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Ver días anteriores'))!
      .trigger('click')
    await settle()
    expect(lastQuery(fake, 'GET /audit')).toMatchObject({ offset: '3' })
    expect(wrapper.text()).toContain('Mostrando 4–4 de 4')
  })
})
