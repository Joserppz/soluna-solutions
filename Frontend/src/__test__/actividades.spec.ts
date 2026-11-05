import { DOMWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ScheduleOut, SchedulePage } from '../api/types'
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

const PATH = '/equipo/actividades'

// Miércoles 4 de noviembre de 2026, 12:00 en La Paz
const NOW = new Date('2026-11-04T16:00:00Z')

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
  useToast().clear()
  vi.restoreAllMocks()
})

function schedule(overrides: Partial<ScheduleOut> = {}): ScheduleOut {
  return {
    id: 's-1',
    title: 'Movimiento en compañía',
    category: 'fisioterapia',
    categoryLabel: 'Fisioterapia',
    date: '2026-11-07',
    startTime: '10:00:00',
    endTime: '11:30:00',
    location: 'Sede ASPAR',
    professionalId: null,
    professionalName: 'Lic. Ana Flores',
    description: 'Una sesión de movimiento suave y un momento para conversar.',
    spots: 30,
    interested: 27,
    availability: 'ultimos',
    status: 'publicada',
    cancellationNote: null,
    imageUrl: null,
    attendanceClosedAt: null,
    came: 0,
    createdAt: '2026-10-20T12:00:00Z',
    updatedAt: '2026-10-20T12:00:00Z',
    ...overrides,
  }
}

const ACTIVITIES: ScheduleOut[] = [
  schedule(),
  schedule({
    id: 's-2',
    title: 'Teatro y expresión',
    category: 'teatro',
    categoryLabel: 'Teatro',
    date: '2026-11-21',
    status: 'cancelada',
    cancellationNote: 'Se reprogramará en diciembre.',
    spots: null,
  }),
  schedule({
    id: 's-3',
    title: 'Preparación de diciembre',
    category: 'comunitario',
    categoryLabel: 'Encuentro comunitario',
    date: '2026-11-28',
    status: 'borrador',
    spots: null,
  }),
  schedule({
    id: 's-4',
    title: 'Movimiento del 30 de octubre',
    date: '2026-10-30',
    came: 29,
  }),
]

function list(
  call: RecordedCall,
  items: ScheduleOut[] = ACTIVITIES,
): { body: SchedulePage } {
  const from = call.query.get('from') ?? ''
  const to = call.query.get('to') ?? ''
  const filtered = items.filter(
    (item) => (!from || item.date >= from) && (!to || item.date <= to),
  )
  return {
    body: { items: filtered, total: filtered.length, limit: 100, offset: 0 },
  }
}

function fakeApi(session = { body: ADMIN_SESSION }) {
  return createApiFake({
    'GET /auth/me': session,
    'GET /dashboard/summary': { body: DASHBOARD },
    'GET /schedules': (call) => list(call),
  })
}

function lastBody(fake: ApiFake, key: string) {
  const calls = fake.callsTo(key)
  return calls[calls.length - 1]!.body
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

describe('Actividades', () => {
  it('muestra la agenda del mes con sus estados y las canceladas tachadas', async () => {
    const fake = fakeApi()
    const { wrapper } = await mountApp(PATH, fake)

    expect(wrapper.get('h1').text()).toBe('Actividades')
    expect(wrapper.findAll('.row')).toHaveLength(3)
    expect(wrapper.text()).toContain('Noviembre de 2026')
    expect(wrapper.get('.row').text()).toContain('Movimiento en compañía')
    expect(wrapper.get('.row').text()).toContain('27 de 30 cupos')
    expect(wrapper.get('.row').text()).toContain('Publicada')
    expect(wrapper.findAll('.row').map((row) => row.text())[1]).toContain(
      'Cancelada',
    )
    expect(wrapper.find('.is-struck strong').text()).toBe('Teatro y expresión')
    expect(wrapper.text()).toContain(
      'Los borradores no aparecen en el sitio. Una actividad cancelada se sigue mostrando, tachada, para que nadie llegue en vano.',
    )
    // El mes pasado queda en «Lo que ya pasó» con su asistencia
    expect(wrapper.text()).not.toContain('Movimiento del 30 de octubre')
  })

  it('«Lo que ya pasó» lista los encuentros del mes con su asistencia y el enlace', async () => {
    vi.setSystemTime(new Date('2026-10-31T20:00:00Z'))
    const fake = fakeApi()
    const { wrapper } = await mountApp(`${PATH}?mes=2026-10`, fake)

    const row = wrapper.get('.past tbody tr')
    expect(row.text()).toContain('30 oct')
    expect(row.text()).toContain('Movimiento del 30 de octubre')
    expect(row.text()).toContain('29')
    expect(row.get('a').attributes('href')).toBe(
      '/equipo/asistencia?actividad=s-4',
    )
  })

  it('la vista Mes ubica cada actividad en su día', async () => {
    const fake = fakeApi()
    const { wrapper, router } = await mountApp(PATH, fake)

    await wrapper.get('[aria-pressed="false"]').trigger('click')
    await settle()

    expect(router.currentRoute.value.query.vista).toBe('mes')
    expect(wrapper.find('.calendar').exists()).toBe(true)
    expect(
      wrapper.find('[aria-label="Movimiento en compañía, Publicada"]').exists(),
    ).toBe(true)
    expect(
      wrapper.find('[aria-label="Teatro y expresión, Cancelada"]').exists(),
    ).toBe(true)
    expect(wrapper.find('.cell.is-today').exists()).toBe(true)
  })

  it('al elegir una actividad muestra sus datos y la vista previa del sitio', async () => {
    const fake = fakeApi()
    const { wrapper, router } = await mountApp(PATH, fake)

    await wrapper.findAll('.row')[0]!.trigger('click')
    await settle()

    expect(router.currentRoute.value.query.actividad).toBe('s-1')
    expect(field('Título').element).toHaveProperty(
      'value',
      'Movimiento en compañía',
    )
    expect(field('Desde').element).toHaveProperty('value', '10:00')
    expect(field('Hasta').element).toHaveProperty('value', '11:30')
    expect(body().text()).toContain('Así se verá en el sitio')
    expect(body().text()).toContain('Sábado, 7 de noviembre · 10:00 – 11:30')
    expect(body().text()).toContain('Publicada en el sitio')
  })

  it('valida antes de guardar: título, horas y descripción', async () => {
    const fake = fakeApi()
    const { wrapper } = await mountApp(PATH, fake)
    await wrapper.findAll('.row')[0]!.trigger('click')
    await settle()

    await field('Título').setValue('')
    await field('Hasta').setValue('09:00')
    await field('Descripción para el sitio').setValue('corta')
    await body().get('form#editor-actividad').trigger('submit')
    await settle()

    expect(body().text()).toContain('Escribe un título de al menos 3 letras.')
    expect(body().text()).toContain(
      'La hora de fin debe ser después de la de inicio.',
    )
    expect(body().text()).toContain(
      'Describe la actividad en al menos 10 letras',
    )
    expect(fake.callsTo('PATCH /schedules/s-1')).toHaveLength(0)
  })

  it('guarda solo lo que cambió y publica o despublica con su propia acción', async () => {
    const fake = fakeApi()
    fake.on('PATCH /schedules/s-1', {
      body: schedule({ title: 'Movimiento de noviembre' }),
    })
    fake.on('POST /schedules/s-1/unpublish', {
      body: schedule({ status: 'borrador' }),
    })
    const { wrapper } = await mountApp(PATH, fake)
    await wrapper.findAll('.row')[0]!.trigger('click')
    await settle()

    await field('Título').setValue('Movimiento de noviembre')
    await body().get('form#editor-actividad').trigger('submit')
    await settle()
    expect(lastBody(fake, 'PATCH /schedules/s-1')).toEqual({
      title: 'Movimiento de noviembre',
    })

    await body().get('.switch').setValue(false)
    await body().get('form#editor-actividad').trigger('submit')
    await settle()
    expect(fake.callsTo('POST /schedules/s-1/unpublish')).toHaveLength(1)
    expect(wrapper.text()).toContain('Guardamos los cambios de la actividad.')
  })

  it('crea una actividad nueva como borrador por defecto', async () => {
    const fake = fakeApi()
    fake.on('POST /schedules', {
      status: 201,
      body: schedule({
        id: 's-9',
        title: 'Arteterapia: colores',
        status: 'borrador',
      }),
    })
    const { wrapper } = await mountApp(PATH, fake)

    await button('+ Nueva actividad', wrapper).trigger('click')
    await settle()
    await field('Título').setValue('Arteterapia: colores')
    await field('Tipo').setValue('arteterapia')
    await field('Descripción para el sitio').setValue(
      'Pintamos juntos con colores de otoño.',
    )
    await body().get('form#editor-actividad').trigger('submit')
    await settle()

    expect(lastBody(fake, 'POST /schedules')).toMatchObject({
      title: 'Arteterapia: colores',
      category: 'arteterapia',
      publish: false,
      location: 'Sede ASPAR',
      startTime: '10:00',
      endTime: '11:30',
    })
    expect(fake.callsTo('POST /schedules/s-9/publish')).toHaveLength(0)
  })

  it('cancelar pide el aviso para las familias y lo envía', async () => {
    const fake = fakeApi()
    fake.on('POST /schedules/s-1/cancel', {
      body: schedule({
        status: 'cancelada',
        cancellationNote: 'Se reprogramará en diciembre.',
      }),
    })
    const { wrapper } = await mountApp(PATH, fake)
    await wrapper.findAll('.row')[0]!.trigger('click')
    await settle()

    await button('Cancelar la actividad con un aviso…', body()).trigger('click')
    await settle()
    const dialog = body().get('[role="dialog"]')
    expect(dialog.get('textarea').element).toHaveProperty(
      'value',
      'Se reprogramará en diciembre.',
    )

    await dialog.get('textarea').setValue('')
    await button('Sí, cancelar la actividad', body()).trigger('click')
    await settle()
    expect(body().text()).toContain('Escribe el aviso para las familias')

    await dialog.get('textarea').setValue('Se reprogramará en diciembre.')
    await button('Sí, cancelar la actividad', body()).trigger('click')
    await settle()
    expect(lastBody(fake, 'POST /schedules/s-1/cancel')).toEqual({
      note: 'Se reprogramará en diciembre.',
    })
    expect(wrapper.text()).toContain(
      'Cancelamos la actividad. Se verá tachada, con el aviso.',
    )
  })

  it('una actividad cancelada no se edita y muestra su aviso', async () => {
    const fake = fakeApi()
    const { wrapper } = await mountApp(`${PATH}?actividad=s-2`, fake)

    expect((field('Título').element as HTMLInputElement).disabled).toBe(true)
    expect(body().text()).toContain('«Se reprogramará en diciembre.»')
    expect(
      body()
        .findAll('button')
        .some((b) => b.text() === 'Guardar cambios'),
    ).toBe(false)
    expect(wrapper.find('.cancel-link').exists()).toBe(false)
  })

  it('sin permiso de actividades no entra a la pantalla', async () => {
    const fake = fakeApi({ body: VOLUNTEER_SESSION })
    const { router } = await mountApp(PATH, fake)

    expect(router.currentRoute.value.name).toBe('resumen')
    expect(fake.callsTo('GET /schedules')).toHaveLength(0)
  })
})
