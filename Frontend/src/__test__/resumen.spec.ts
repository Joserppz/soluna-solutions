import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { DashboardSummary } from '../api/types'
import { useToast } from '../composables/useToast'
import {
  ADMIN_SESSION,
  DASHBOARD,
  VOLUNTEER_SESSION,
  createApiFake,
  mountApp as mountWholeApp,
  settle,
  type ApiFake,
} from './apiFake'

// Viernes 6 de noviembre de 2026, 12:00 en La Paz
const NOW = new Date('2026-11-06T16:00:00Z')
let mounted: Awaited<ReturnType<typeof mountWholeApp>> | null = null

async function mountApp(path: string, fake: ApiFake) {
  mounted = await mountWholeApp(path, fake)
  return mounted
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  mounted?.wrapper.unmount()
  mounted = null
  vi.useRealTimers()
  document.body.innerHTML = ''
  useToast().clear()
})

const FULL: DashboardSummary = {
  toReview: DASHBOARD.toReview,
  nextActivity: {
    id: 'act-7',
    title: 'Movimiento en compañía',
    date: '2026-11-07',
    startTime: '10:00:00',
    endTime: '11:30:00',
    location: 'Sede ASPAR',
    professionalName: 'Lic. Ana Flores',
    usualAttendance: 27,
    newSignups: 3,
  },
  upcoming: [
    {
      id: 'act-7',
      title: 'Movimiento en compañía',
      date: '2026-11-07',
      startTime: '10:00:00',
      endTime: '11:30:00',
      location: 'Sede',
      status: 'publicada',
      cancellationNote: null,
    },
    {
      id: 'act-21',
      title: 'Teatro y expresión',
      date: '2026-11-21',
      startTime: '10:00:00',
      endTime: '11:30:00',
      location: 'Sede',
      status: 'cancelada',
      cancellationNote: 'Reprogramar en diciembre',
    },
    {
      id: 'act-dic',
      title: 'Preparación de diciembre',
      date: '2026-12-05',
      startTime: '10:00:00',
      endTime: '12:00:00',
      location: 'Sede',
      status: 'borrador',
      cancellationNote: null,
    },
  ],
  attendanceLastSaturdays: [20, 22, 21, 25, 24, 26, 28, 29].map((came, i) => ({
    date: new Date(Date.UTC(2026, 8, 12 + i * 7)).toISOString().slice(0, 10),
    came,
  })),
  patients: { active: 84, joinedThisMonth: 6, withoutConsent: 2 },
}

describe('Resumen del espacio del equipo', () => {
  it('muestra este sábado, lo que hay para revisar, la agenda, la asistencia y la comunidad', async () => {
    const fake = createApiFake({
      'GET /auth/me': { body: ADMIN_SESSION },
      'GET /dashboard/summary': { body: FULL },
    })
    const { wrapper } = await mountApp('/equipo', fake)

    expect(wrapper.get('h1').text()).toMatch(/, Lucía\.$/)
    const today = wrapper.get('.today')
    expect(today.text()).toContain('Este sábado · 7 de noviembre')
    expect(today.get('h2').text()).toBe('Movimiento en compañía')
    expect(today.text()).toContain(
      '10:00 – 11:30 · Sede ASPAR · Lic. Ana Flores',
    )
    expect(today.text()).toContain(
      '27 personas suelen venir. Hay 3 inscripciones nuevas desde la semana pasada.',
    )
    const take = today
      .findAll('a')
      .find((a) => a.text() === 'Tomar asistencia')!
    expect(take.attributes('href')).toBe(
      '/equipo/asistencia?dia=2026-11-07&actividad=act-7',
    )

    const pending = wrapper.findAll('.pending a')
    expect(pending.map((a) => a.attributes('href'))).toEqual([
      '/equipo/solicitudes?estado=recibida',
      '/equipo/donaciones?estado=pendiente',
      '/equipo/afiliados?pestana=consentimiento-pendiente',
      '/equipo/inventario?condicion=da%C3%B1ado',
    ])

    const events = wrapper.findAll('.events li')
    expect(events).toHaveLength(3)
    expect(events[0]!.text()).toContain('07NOV')
    expect(events[1]!.text()).toContain('Reprogramar en diciembre')
    expect(events[1]!.text()).toContain('Cancelada')
    expect(events[2]!.text()).toContain('Sin publicar')

    expect(wrapper.findAll('.spark li')).toHaveLength(8)
    expect(wrapper.get('.spark li.is-last').attributes('style')).toContain(
      'height: 100%',
    )
    expect(wrapper.text()).toMatch(/29\s*personas el sábado pasado/)
    expect(wrapper.text()).toContain('El promedio de estos sábados fue 24.')

    expect(wrapper.text()).toMatch(/84\s*afiliados activos/)
    expect(wrapper.text()).toContain(
      '6 se sumaron este mes; 2 fichas esperan su consentimiento firmado.',
    )
    expect(
      wrapper
        .findAll('a')
        .find((a) => a.text() === '+ Registrar afiliado')!
        .attributes('href'),
    ).toBe('/equipo/afiliados?nuevo=1')
  })

  it('el voluntariado ve solo sus bloques: sin agenda ni comunidad', async () => {
    const fake = createApiFake({
      'GET /auth/me': { body: VOLUNTEER_SESSION },
      'GET /dashboard/summary': {
        body: {
          ...FULL,
          toReview: {
            newInquiries: null,
            donationsToConfirm: null,
            patientsWithoutConsent: null,
            damagedItems: null,
          },
          upcoming: null,
          patients: null,
        },
      },
    })
    const { wrapper } = await mountApp('/equipo', fake)

    expect(wrapper.find('.pending').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Próximas actividades')
    expect(wrapper.text()).not.toContain('afiliados activos')
    // Toma asistencia, pero no edita la actividad
    expect(wrapper.get('.today').text()).toContain('Tomar asistencia')
    expect(wrapper.get('.today').text()).not.toContain('Ver actividad')
    expect(wrapper.get('.privacy').text()).toContain(
      'Solo el personal clínico ve historias',
    )
  })

  it('sin actividad publicada lo dice, y si el resumen falla se puede reintentar', async () => {
    const fake = createApiFake({
      'GET /auth/me': { body: ADMIN_SESSION },
      'GET /dashboard/summary': [
        { status: 500, body: { detail: 'No pudimos calcular el resumen.' } },
        {
          body: {
            ...FULL,
            nextActivity: null,
            upcoming: [],
            attendanceLastSaturdays: [],
          },
        },
      ],
    })
    const { wrapper } = await mountApp('/equipo', fake)

    expect(wrapper.text()).toContain('No pudimos calcular el resumen.')
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Intentar de nuevo')!
      .trigger('click')
    await settle()
    expect(wrapper.get('.today').text()).toContain(
      'Todavía no hay una actividad publicada.',
    )
    expect(wrapper.text()).toContain(
      'No hay actividades en las próximas semanas.',
    )
    expect(wrapper.text()).toContain(
      'Todavía no hay asistencia cerrada de los sábados anteriores.',
    )
  })

  it('el próximo encuentro de otra semana muestra su fecha', async () => {
    const fake = createApiFake({
      'GET /auth/me': { body: ADMIN_SESSION },
      'GET /dashboard/summary': {
        body: {
          ...FULL,
          nextActivity: {
            ...FULL.nextActivity!,
            date: '2026-11-14',
            usualAttendance: null,
            newSignups: 1,
          },
        },
      },
    })
    const { wrapper } = await mountApp('/equipo', fake)

    expect(wrapper.get('.today').text()).toContain(
      'Próximo encuentro · Sábado, 14 de noviembre',
    )
    expect(wrapper.get('.today').text()).toContain(
      'Hay 1 inscripción nueva desde la semana pasada.',
    )
  })
})
