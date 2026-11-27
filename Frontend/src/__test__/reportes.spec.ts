/**
 * Filtro por rango de fechas y «Descargar» en cada pantalla (evaluación de los Sprints
 * 1 y 2): las fechas van a la API con el resto del filtro, quedan en la dirección, y la
 * descarga pide exactamente el mismo filtro (no solo la página que se ve).
 */
import { DOMWrapper, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import DateRangeFilter from '../components/reports/DateRangeFilter.vue'
import { useToast } from '../composables/useToast'
import {
  ALL_DATES,
  addDays,
  periodLabel,
  presetOf,
  presetRange,
  rangeError,
  rangeQuery,
  readRange,
  writeRange,
} from '../utils/dateRange'
import {
  ADMIN_SESSION,
  DASHBOARD,
  VOLUNTEER_SESSION,
  createApiFake,
  mountApp as mountWholeApp,
  settle,
  type ApiFake,
} from './apiFake'
import { clickDay, downloadAs, exportPanel, pickRange } from './reports'

const NOW = new Date('2026-11-26T16:00:00Z')
const TODAY = '2026-11-26'
const EMPTY_PAGE = { items: [], total: 0, limit: 10, offset: 0 }

function page(total: number) {
  return { body: { ...EMPTY_PAGE, total } }
}

let mounted: Awaited<ReturnType<typeof mountWholeApp>> | null = null
const saved: string[] = []

async function mountApp(path: string, fake: ApiFake) {
  mounted = await mountWholeApp(path, fake)
  return mounted
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  saved.length = 0
  vi.stubGlobal(
    'URL',
    Object.assign(URL, {
      createObjectURL: vi.fn(() => 'blob:reporte'),
      revokeObjectURL: vi.fn(),
    }),
  )
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    saved.push(this.download)
  })
})

afterEach(() => {
  mounted?.wrapper.unmount()
  mounted = null
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
  useToast().clear()
})

function fake(handlers: Parameters<typeof createApiFake>[0] = {}) {
  return createApiFake({
    'GET /auth/me': { body: ADMIN_SESSION },
    'GET /dashboard/summary': { body: DASHBOARD },
    ...handlers,
  })
}

function lastQuery(api: ApiFake, key: string) {
  const calls = api.callsTo(key)
  return Object.fromEntries(calls[calls.length - 1]!.query)
}

function body() {
  return new DOMWrapper(document.body)
}

/** Abre el filtro de fechas (el primero, o el de `label`) y elige un atajo. */
async function choosePreset(label: string, which = 0) {
  await body().findAll('.range__trigger')[which]!.trigger('click')
  await settle()
  await body()
    .findAll('.range__chip')
    .find((chip) => chip.text() === label)!
    .trigger('click')
  await settle()
}

function rangePanel(): HTMLElement {
  const panel = document.body.querySelector<HTMLElement>('.range__panel')
  if (!panel) throw new Error('El filtro de fechas no está abierto')
  return panel
}

async function chooseDates(from: string, to: string, which = 0) {
  await body().findAll('.range__trigger')[which]!.trigger('click')
  await settle()
  await pickRange(rangePanel(), from, to)
  rangePanel().querySelector<HTMLButtonElement>('.range__apply')!.click()
  await settle()
}

describe('Rango de fechas (utils/dateRange)', () => {
  it('atajos contados desde hoy en La Paz', () => {
    expect(presetRange('hoy', TODAY)).toEqual({ from: TODAY, to: TODAY })
    expect(presetRange('ultimos-7', TODAY)).toEqual({
      from: '2026-11-20',
      to: TODAY,
    })
    expect(presetRange('ultimos-30', TODAY)).toEqual({
      from: '2026-10-28',
      to: TODAY,
    })
    expect(presetRange('este-mes', TODAY)).toEqual({
      from: '2026-11-01',
      to: TODAY,
    })
    expect(presetRange('mes-pasado', TODAY)).toEqual({
      from: '2026-10-01',
      to: '2026-10-31',
    })
    expect(presetRange('mes-pasado', '2026-03-10')).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    })
    expect(presetRange('este-anio', TODAY)).toEqual({
      from: '2026-01-01',
      to: TODAY,
    })
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('etiquetas, errores y límites', () => {
    expect(periodLabel(ALL_DATES, TODAY)).toBe('Todas las fechas')
    expect(periodLabel(presetRange('este-mes', TODAY), TODAY)).toBe('Este mes')
    expect(presetOf({ from: '2026-11-01', to: TODAY }, TODAY)).toBe('este-mes')
    expect(
      periodLabel({ from: '2026-01-01', to: '2026-01-31' }, TODAY),
    ).toMatch(/^1 ene 2026 – 31 ene 2026$/)
    expect(periodLabel({ from: '2026-01-05', to: '' }, TODAY)).toMatch(
      /^Desde 5 ene 2026$/,
    )
    expect(periodLabel({ from: '', to: '2026-01-05' }, TODAY)).toMatch(
      /^Hasta 5 ene 2026$/,
    )
    expect(rangeError({ from: '2026-02-01', to: '2026-01-01' })).toBe(
      'La fecha «desde» no puede ser posterior a la fecha «hasta».',
    )
    // El mismo día en los dos extremos es válido
    expect(rangeError({ from: TODAY, to: TODAY })).toBeNull()
    expect(rangeError({ from: '26/11/2026', to: '' })).toBe(
      'Revisa la fecha «desde».',
    )
  })

  it('de y hacia la dirección y la API', () => {
    expect(rangeQuery(ALL_DATES)).toEqual({})
    expect(rangeQuery({ from: '2026-01-01', to: '' })).toEqual({
      from: '2026-01-01',
    })
    expect(readRange({ desde: '2026-01-01', hasta: '2026-01-31' })).toEqual({
      from: '2026-01-01',
      to: '2026-01-31',
    })
    // Una dirección con fechas al revés o mal escritas no filtra
    expect(readRange({ desde: '2026-02-01', hasta: '2026-01-01' })).toEqual(
      ALL_DATES,
    )
    expect(readRange({ desde: 'ayer' })).toEqual(ALL_DATES)
    expect(
      writeRange({ from: '2026-01-01', to: '' }, { buscar: 'ana' }),
    ).toEqual({ buscar: 'ana', desde: '2026-01-01' })
  })
})

describe('Filtro de fechas (componente)', () => {
  function mountFilter(required = false) {
    return mount(DateRangeFilter, {
      props: { modelValue: ALL_DATES, label: 'Fecha de registro', required },
      attachTo: document.body,
    })
  }

  it('dice qué fechas se ven y emite el atajo elegido', async () => {
    const wrapper = mountFilter()
    const trigger = wrapper.get('.range__trigger')
    expect(trigger.text()).toContain('Todas las fechas')
    expect(trigger.attributes('aria-expanded')).toBe('false')

    await trigger.trigger('click')
    await settle()
    expect(trigger.attributes('aria-expanded')).toBe('true')
    // El panel flota en <body>, fuera de la tarjeta que lo contiene
    expect(rangePanel().getAttribute('role')).toBe('dialog')
    expect(rangePanel().getAttribute('aria-label')).toBe('Fecha de registro')
    await body()
      .findAll('.range__chip')
      .find((chip) => chip.text() === 'Últimos 7 días')!
      .trigger('click')

    expect(wrapper.emitted('update:modelValue')![0]).toEqual([
      { from: '2026-11-20', to: TODAY },
    ])
    expect(document.body.querySelector('.range__panel')).toBeNull()
    wrapper.unmount()
  })

  it('en el calendario, un rango al revés se ordena solo; un día suelto vale', async () => {
    const wrapper = mountFilter()
    await wrapper.get('.range__trigger').trigger('click')
    await settle()
    const apply = () =>
      rangePanel().querySelector<HTMLButtonElement>('.range__apply')!

    // Sin días elegidos no hay nada que aplicar
    expect(apply().disabled).toBe(true)
    await clickDay(rangePanel(), '2026-11-20')
    expect(rangePanel().textContent).toContain('Ahora elige el último día')
    await clickDay(rangePanel(), '2026-11-10')
    expect(
      rangePanel().querySelector('[data-day="2026-11-15"]')!.className,
    ).toContain('is-between')
    apply().click()
    await settle()
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([
      { from: '2026-11-10', to: '2026-11-20' },
    ])

    // Un solo día: desde y hasta el mismo
    await wrapper.get('.range__trigger').trigger('click')
    await settle()
    await clickDay(rangePanel(), '2026-11-03')
    await clickDay(rangePanel(), '2026-11-05')
    await clickDay(rangePanel(), '2026-11-03')
    apply().click()
    await settle()
    expect(wrapper.emitted('update:modelValue')![1]).toEqual([
      { from: '2026-11-03', to: '2026-11-03' },
    ])
    wrapper.unmount()
  })

  it('«Todas las fechas» quita el rango; si es obligatorio, no se ofrece', async () => {
    const wrapper = mountFilter()
    await wrapper.get('.range__trigger').trigger('click')
    await settle()
    await body().get('.range__link').trigger('click')
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([ALL_DATES])
    wrapper.unmount()

    const required = mountFilter(true)
    await required.get('.range__trigger').trigger('click')
    await settle()
    expect(body().find('.range__panel').exists()).toBe(true)
    expect(body().find('.range__link').exists()).toBe(false)
    required.unmount()
  })

  it('Esc cierra el panel', async () => {
    const wrapper = mountFilter()
    await wrapper.get('.range__trigger').trigger('click')
    await settle()
    await body().get('.range__panel').trigger('keydown', { key: 'Escape' })
    expect(body().find('.range__panel').exists()).toBe(false)
    expect(document.activeElement).toBe(wrapper.get('.range__trigger').element)
    wrapper.unmount()
  })
})

describe('Afiliados: fechas de registro y descarga', () => {
  function patientsFake(session = ADMIN_SESSION) {
    return fake({
      'GET /auth/me': { body: session },
      'GET /patients': page(37),
      'GET /patients/summary': {
        body: {
          all: 37,
          active: 30,
          consentPending: 2,
          inactive: 7,
          activities: [],
        },
      },
      'GET /patients/export': { body: 'archivo' },
    })
  }

  it('el rango va a la tabla, a las pestañas y a la dirección', async () => {
    const api = patientsFake()
    const { router } = await mountApp('/equipo/afiliados', api)

    await choosePreset('Este mes')

    expect(lastQuery(api, 'GET /patients')).toMatchObject({
      from: '2026-11-01',
      to: TODAY,
    })
    expect(lastQuery(api, 'GET /patients/summary')).toMatchObject({
      from: '2026-11-01',
      to: TODAY,
    })
    expect(router.currentRoute.value.query).toMatchObject({
      desde: '2026-11-01',
      hasta: TODAY,
    })
    expect(body().get('.range__trigger').text()).toContain('Este mes')
  })

  it('«Descargar» pide todas las filas del filtro, no solo la página', async () => {
    const api = patientsFake()
    await mountApp('/equipo/afiliados?pestana=activos&buscar=ana', api)
    await chooseDates('2026-01-01', '2026-06-30')

    await body().get('.export__trigger').trigger('click')
    await settle()
    expect(body().get('.export__summary').text()).toBe(
      '37 filas con el filtro actual',
    )
    await downloadAs(body(), 'Excel')

    const query = lastQuery(api, 'GET /patients/export')
    expect(query).toEqual({
      search: 'ana',
      group: 'active',
      order: 'name',
      from: '2026-01-01',
      to: '2026-06-30',
      format: 'xlsx',
    })
    expect(query).not.toHaveProperty('limit')
    expect(saved).toEqual([`afiliados-${TODAY}.xlsx`])
  })

  it('el rango de la dirección se aplica al abrir', async () => {
    const api = patientsFake()
    await mountApp('/equipo/afiliados?desde=2026-01-01&hasta=2026-01-31', api)

    expect(api.callsTo('GET /patients')[0]!.query.get('from')).toBe(
      '2026-01-01',
    )
    expect(body().get('.range__trigger').text()).toMatch(
      /1 ene 2026 – 31 ene 2026/,
    )
  })

  it('un rol sin «reports:export» no ve «Descargar»', async () => {
    const api = patientsFake(VOLUNTEER_SESSION)
    await mountApp('/equipo/afiliados', api)

    expect(body().find('.range__trigger').exists()).toBe(true)
    expect(body().find('.export').exists()).toBe(false)
  })

  it('si la API rechaza la descarga (demasiadas filas), lo explica', async () => {
    const api = patientsFake()
    api.on('GET /patients/export', {
      status: 422,
      body: {
        detail: 'El filtro tiene 12000 filas. Acota el rango de fechas.',
      },
    })
    await mountApp('/equipo/afiliados', api)

    await downloadAs(body(), 'PDF')

    expect(body().text()).toContain('Acota el rango de fechas.')
    expect(saved).toEqual([])
  })
})

describe('Las demás pantallas', () => {
  it('Inventario: fechas de ingreso en la tabla y en la descarga', async () => {
    const api = fake({
      'GET /inventory': page(4),
      'GET /inventory/summary': {
        body: {
          total: 4,
          alcaldia: 1,
          donado: 2,
          propio: 1,
          damaged: 0,
        },
      },
      'GET /inventory/export': { body: 'archivo' },
    })
    await mountApp('/equipo/inventario', api)

    await choosePreset('Este año')
    await downloadAs(body(), 'PDF')

    expect(lastQuery(api, 'GET /inventory')).toMatchObject({
      from: '2026-01-01',
      to: TODAY,
    })
    expect(lastQuery(api, 'GET /inventory/export')).toEqual({
      from: '2026-01-01',
      to: TODAY,
      format: 'pdf',
    })
  })

  it('Solicitudes: el día en que llegaron', async () => {
    const api = fake({
      'GET /inquiries': page(2),
      'GET /inquiries/summary': {
        body: { all: 2, new: 1, contacted: 1, enrolled: 0, open: 2 },
      },
      'GET /inquiries/export': { body: 'archivo' },
    })
    await mountApp('/equipo/solicitudes?motivo=voluntariado', api)

    await chooseDates('2026-11-01', '2026-11-15')
    await downloadAs(body(), 'Excel')

    expect(lastQuery(api, 'GET /inquiries')).toMatchObject({
      kind: 'voluntariado',
      from: '2026-11-01',
      to: '2026-11-15',
    })
    expect(lastQuery(api, 'GET /inquiries/export')).toEqual({
      kind: 'voluntariado',
      from: '2026-11-01',
      to: '2026-11-15',
      format: 'xlsx',
    })
  })

  it('Donaciones: sin fechas propias la tabla y la descarga usan el mes', async () => {
    const summary = {
      month: '2026-11',
      confirmedBs: 0,
      confirmedCount: 0,
      pendingCount: 0,
      inKindCount: 0,
      cancelledCount: 0,
      byChannel: [],
    }
    const api = fake({
      'GET /donations': page(3),
      'GET /donations/summary': { body: summary },
      'GET /donations/goal': { body: null },
      'GET /donations/export': { body: 'archivo' },
    })
    await mountApp('/equipo/donaciones', api)

    // Un solo «Descargar»: el resumen del mes y el registro con el filtro de la tabla
    await body().get('.export__trigger').trigger('click')
    await settle()
    expect(
      [...exportPanel().querySelectorAll('.export__title')].map(
        (t) => t.textContent,
      ),
    ).toEqual(['Resumen de noviembre', 'Registro de aportes'])
    await downloadAs(body(), 'PDF', 'donaciones', 'Registro de aportes')
    expect(lastQuery(api, 'GET /donations/export')).toEqual({
      from: '2026-11-01',
      to: '2026-11-30',
      format: 'pdf',
    })

    await choosePreset('Mes pasado')
    await downloadAs(body(), 'Excel', 'donaciones', 'Registro de aportes')
    expect(lastQuery(api, 'GET /donations/export')).toEqual({
      from: '2026-10-01',
      to: '2026-10-31',
      format: 'xlsx',
    })
  })

  it('Galería: fecha de creación de los álbumes', async () => {
    const api = fake({
      'GET /media/albums': {
        body: [
          {
            id: 'a-1',
            title: 'Encuentro de familias',
            description: '',
            visibility: 'publico',
            permissionsReviewed: true,
            scheduleId: null,
            assetCount: 3,
            coverUrl: null,
            createdAt: '2026-11-07T15:00:00Z',
          },
        ],
      },
      'GET /media/albums/export': { body: 'archivo' },
    })
    await mountApp('/equipo/galeria?ver=publico', api)

    await choosePreset('Últimos 30 días')
    await downloadAs(body(), 'Excel')

    expect(lastQuery(api, 'GET /media/albums')).toEqual({
      visibility: 'publico',
      from: '2026-10-28',
      to: TODAY,
    })
    expect(lastQuery(api, 'GET /media/albums/export')).toEqual({
      visibility: 'publico',
      from: '2026-10-28',
      to: TODAY,
      format: 'xlsx',
    })
  })

  it('Actividades: el rango se elige en «Descargar» (por defecto, el mes)', async () => {
    const api = fake({
      'GET /schedules': page(0),
      'GET /schedules/export': { body: 'archivo' },
    })
    await mountApp('/equipo/actividades', api)

    await body().get('.export__trigger').trigger('click')
    await settle()
    expect(body().get('.export__summary').text()).toBe(
      '1 nov 2026 – 30 nov 2026',
    )
    await body().get('.export__change').trigger('click')
    await settle()
    await pickRange(exportPanel(), '2026-09-01', '2026-11-30')
    await downloadAs(body(), 'PDF')

    expect(lastQuery(api, 'GET /schedules/export')).toEqual({
      from: '2026-09-01',
      to: '2026-11-30',
      format: 'pdf',
    })
  })

  it('Registro de actividad: un rango propio reemplaza a «Últimos N días»', async () => {
    const api = fake({
      'GET /audit': page(5),
      'GET /audit/summary': { body: { days: 7, areas: [], review: {} } },
      'GET /audit/export': { body: 'archivo' },
    })
    await mountApp('/equipo/administracion/registro', api)
    expect(lastQuery(api, 'GET /audit')).toMatchObject({ days: '7' })

    await chooseDates('2026-11-01', '2026-11-10')

    const query = lastQuery(api, 'GET /audit')
    expect(query).toMatchObject({ from: '2026-11-01', to: '2026-11-10' })
    expect(query).not.toHaveProperty('days')
    expect(body().get('#filtro-dias').attributes('disabled')).toBeDefined()
  })
})
