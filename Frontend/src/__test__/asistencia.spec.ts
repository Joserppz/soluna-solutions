import { DOMWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AttendanceEntry,
  AttendanceSheet,
  MonthlySummary,
  ScheduleOut,
  SchedulePage,
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

const PATH = '/equipo/asistencia'

// Sábado 7 de noviembre de 2026, 12:00 en La Paz: el día de la actividad
const NOW = new Date('2026-11-07T16:00:00Z')

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
    description: 'Movimiento suave.',
    spots: null,
    interested: 0,
    availability: null,
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
  schedule({
    id: 's-2',
    title: 'Movimiento del 31',
    date: '2026-10-31',
    came: 2,
  }),
  schedule(),
  schedule({
    id: 's-3',
    title: 'Teatro y expresión',
    date: '2026-11-21',
    status: 'cancelada',
    cancellationNote: 'Se reprogramará.',
  }),
]

function entry(
  patientId: string,
  name: string,
  status: AttendanceEntry['status'],
  note = '',
): AttendanceEntry {
  return {
    patientId,
    name,
    status,
    note,
    markedAt: status === 'sin_marcar' ? null : '2026-11-07T14:10:00Z',
  }
}

function sheet(items: AttendanceEntry[], closed = false): AttendanceSheet {
  const came = items.filter((i) => i.status === 'vino').length
  const notCame = items.filter((i) => i.status === 'no_vino').length
  return {
    activity: {
      id: 's-1',
      date: '2026-11-07',
      startTime: '10:00:00',
      endTime: '11:30:00',
      title: 'Movimiento en compañía',
      location: 'Sede ASPAR',
      professionalName: 'Lic. Ana Flores',
      status: 'publicada',
    },
    closed,
    closedAt: closed ? '2026-11-07T15:00:00Z' : null,
    summary: {
      came,
      notCame,
      unmarked: items.length - came - notCame,
      total: items.length,
    },
    items,
  }
}

const PEOPLE = [
  entry('p-1', 'Alba Gutiérrez Mamani', 'sin_marcar', 'Viene con su hija Rosa'),
  entry('p-2', 'Bernardo Mamani Quispe', 'vino', 'Usa bastón'),
  entry('p-3', 'Celia Flores Ticona', 'no_vino', 'Avisó que estaba resfriada'),
]

const MONTHLY: MonthlySummary = {
  month: '2026-11',
  activities: [],
  byCategory: [
    { category: 'fisioterapia', label: 'Fisioterapia', came: 29 },
    { category: 'arteterapia', label: 'Arteterapia', came: 19 },
  ],
  totalCame: 48,
}

function list(call: RecordedCall): { body: SchedulePage } {
  const from = call.query.get('from') ?? ''
  const to = call.query.get('to') ?? ''
  const filtered = ACTIVITIES.filter(
    (item) => item.date >= from && item.date <= to,
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
    'GET /schedules/s-1/attendance': { body: sheet(PEOPLE) },
    'GET /attendance/monthly': { body: MONTHLY },
  })
}

function lastBody(fake: ApiFake, key: string) {
  const calls = fake.callsTo(key)
  return calls[calls.length - 1]!.body
}

function body() {
  return new DOMWrapper(document.body)
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

function personRow(name: string) {
  const row = body()
    .findAll('.person')
    .find((r) => r.text().includes(name))
  if (!row) throw new Error(`No hay una fila de «${name}»`)
  return row
}

describe('Asistencia', () => {
  it('abre la actividad de hoy o la próxima, con su resumen y la lista de personas', async () => {
    const fake = fakeApi()
    const { wrapper } = await mountApp(PATH, fake)

    expect(wrapper.get('h1').text()).toBe('Asistencia')
    expect(fake.callsTo('GET /schedules/s-1/attendance')).toHaveLength(1)
    expect(wrapper.get('.banner__title').text()).toBe('Movimiento en compañía')
    expect(wrapper.get('.banner__count').text()).toContain('de 3 marcados')
    expect(wrapper.get('.tally').text()).toContain('1 vinieron')
    expect(wrapper.get('.tally').text()).toContain('1 no vinieron')
    expect(wrapper.get('.tally').text()).toContain('1 sin marcar')
    expect(wrapper.findAll('.person')).toHaveLength(3)
    expect(wrapper.text()).toContain('Se guarda solo al marcar.')
    expect(wrapper.text()).toContain(
      'El voluntariado puede tomar asistencia y ver datos de contacto. Las historias clínicas solo las ve el personal clínico.',
    )
  })

  it('marcar «Vino» se guarda en ese momento y actualiza el resumen', async () => {
    const fake = fakeApi()
    fake.on('PUT /schedules/s-1/attendance/p-1', {
      body: entry('p-1', 'Alba Gutiérrez Mamani', 'vino'),
    })
    const { wrapper } = await mountApp(PATH, fake)

    const row = personRow('Alba Gutiérrez')
    await row.findAll('button')[0]!.trigger('click')
    await settle()

    expect(lastBody(fake, 'PUT /schedules/s-1/attendance/p-1')).toEqual({
      status: 'vino',
    })
    expect(row.findAll('button')[0]!.attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('.tally').text()).toContain('2 vinieron')
    expect(wrapper.get('.tally').text()).toContain('0 sin marcar')
  })

  it('si no se guarda la marca, vuelve a como estaba y avisa', async () => {
    const fake = fakeApi()
    fake.on('PUT /schedules/s-1/attendance/p-1', {
      status: 500,
      body: { detail: 'Error interno' },
    })
    const { wrapper } = await mountApp(PATH, fake)

    const row = personRow('Alba Gutiérrez')
    await row.findAll('button')[1]!.trigger('click')
    await settle()

    expect(row.findAll('button')[1]!.attributes('aria-pressed')).toBe('false')
    expect(wrapper.get('.tally').text()).toContain('1 sin marcar')
    expect(wrapper.text()).toContain('Error interno')
  })

  it('busca por nombre sin distinguir tildes', async () => {
    vi.useFakeTimers({
      shouldAdvanceTime: true,
      toFake: ['Date', 'setTimeout', 'clearTimeout'],
    })
    vi.setSystemTime(NOW)
    const fake = fakeApi()
    const { wrapper } = await mountApp(PATH, fake)

    await wrapper.get('#buscar-asistencia').setValue('gutierrez')
    await vi.advanceTimersByTimeAsync(300)
    await settle()

    expect(wrapper.findAll('.person')).toHaveLength(1)
    expect(wrapper.get('.person').text()).toContain('Alba Gutiérrez')
    vi.useRealTimers()
  })

  it('«Marcar a todos como presentes» llama a la API y muestra el nuevo estado', async () => {
    const fake = fakeApi()
    fake.on('POST /schedules/s-1/attendance/mark-all-present', {
      body: sheet([
        entry('p-1', 'Alba Gutiérrez Mamani', 'vino'),
        entry('p-2', 'Bernardo Mamani Quispe', 'vino'),
        entry('p-3', 'Celia Flores Ticona', 'vino'),
      ]),
    })
    const { wrapper } = await mountApp(PATH, fake)

    await button('Marcar a todos como presentes', wrapper).trigger('click')
    await settle()

    expect(
      fake.callsTo('POST /schedules/s-1/attendance/mark-all-present'),
    ).toHaveLength(1)
    expect(wrapper.get('.tally').text()).toContain('3 vinieron')
  })

  it('cerrar el día bloquea las marcas; reabrir las vuelve a permitir', async () => {
    const fake = fakeApi()
    fake.on('POST /schedules/s-1/attendance/close', {
      body: sheet(PEOPLE, true),
    })
    fake.on('POST /schedules/s-1/attendance/reopen', {
      body: sheet(PEOPLE, false),
    })
    const { wrapper } = await mountApp(PATH, fake)

    await button('Cerrar asistencia del día', wrapper).trigger('click')
    await settle()

    expect(fake.callsTo('POST /schedules/s-1/attendance/close')).toHaveLength(1)
    expect(wrapper.text()).toContain(
      'Asistencia cerrada. Para cambiarla, reábrela.',
    )
    const pending = personRow('Alba Gutiérrez').findAll('button')[0]!
    expect((pending.element as HTMLButtonElement).disabled).toBe(true)
    expect(
      wrapper
        .findAll('button')
        .some((b) => b.text() === 'Marcar a todos como presentes'),
    ).toBe(false)

    await button('Reabrir', wrapper).trigger('click')
    await settle()

    expect(fake.callsTo('POST /schedules/s-1/attendance/reopen')).toHaveLength(
      1,
    )
    expect(
      (
        personRow('Alba Gutiérrez').findAll('button')[0]!
          .element as HTMLButtonElement
      ).disabled,
    ).toBe(false)
  })

  it('anota a una persona nueva: el nombre y el teléfono son obligatorios', async () => {
    const fake = fakeApi()
    fake.on('POST /schedules/s-1/attendance/newcomers', {
      status: 201,
      body: { inquiryId: 'q-1', message: 'Anotamos a Elena.' },
    })
    const { wrapper } = await mountApp(PATH, fake)

    await button('Anotar persona nueva', wrapper).trigger('click')
    await settle()
    const dialog = body().get('[role="dialog"]')
    await dialog.get('form').trigger('submit')
    await settle()
    expect(dialog.text()).toContain('Escribe el nombre (al menos 3 letras).')
    expect(dialog.text()).toContain('Escribe el teléfono, solo números.')
    expect(
      fake.callsTo('POST /schedules/s-1/attendance/newcomers'),
    ).toHaveLength(0)

    await dialog
      .find('#' + dialog.get('label').attributes('for'))
      .setValue('Elena Quispe')
    await dialog.findAll('input')[1]!.setValue('7 012 3344')
    await dialog.findAll('input')[2]!.setValue('Su hija Rosa')
    await dialog.get('input[type="checkbox"]').setValue(true)
    await dialog.get('form').trigger('submit')
    await settle()

    expect(lastBody(fake, 'POST /schedules/s-1/attendance/newcomers')).toEqual({
      name: 'Elena Quispe',
      phone: '70123344',
      onBehalfOf: 'Su hija Rosa',
      note: '',
      contactConsent: true,
    })
    expect(wrapper.text()).toContain(
      'Anotamos a Elena. Recepción abrirá su ficha.',
    )
  })

  it('descarga el resumen mensual en Excel', async () => {
    const createObjectURL = vi.fn(() => 'blob:asistencia')
    vi.stubGlobal(
      'URL',
      Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }),
    )
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.download).toBe('resumen-mensual-asistencia-2026-11.xlsx')
      })
    const fake = fakeApi()
    fake.on('GET /attendance/monthly', (call) =>
      call.query.get('format') ? { body: 'contenido' } : { body: MONTHLY },
    )
    const { wrapper } = await mountApp(PATH, fake)

    await button('Descargar resumen mensual →', wrapper).trigger('click')
    await settle()

    expect(click).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Fisioterapia')
    expect(wrapper.text()).toContain('Arteterapia')
  })

  it('el voluntariado marca y cierra, pero no ve el resumen del mes', async () => {
    const fake = fakeApi({ body: VOLUNTEER_SESSION })
    const { wrapper } = await mountApp(PATH, fake)

    expect(wrapper.get('.person').text()).toContain('Alba Gutiérrez')
    expect(
      wrapper
        .findAll('button')
        .some((b) => b.text() === 'Cerrar asistencia del día'),
    ).toBe(true)
    expect(wrapper.text()).not.toContain('Descargar resumen mensual')
    expect(fake.callsTo('GET /attendance/monthly')).toHaveLength(0)
  })

  it('sin actividades para marcar lo explica', async () => {
    const fake = fakeApi()
    fake.on('GET /schedules', {
      body: { items: [], total: 0, limit: 100, offset: 0 },
    })
    const { wrapper } = await mountApp(PATH, fake)

    expect(wrapper.text()).toContain('Todavía no hay actividades para marcar.')
    expect(fake.callsTo('GET /schedules/s-1/attendance')).toHaveLength(0)
  })
})
