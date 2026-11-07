import { DOMWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { InquiryDetail, InquiryOut } from '../api/types'
import { useToast } from '../composables/useToast'
import {
  canMove,
  followUpSteps,
  formatPhone,
  historyTime,
  inquiryLine,
  receivedAgo,
  whatsappUrl,
} from '../utils/inquiries'
import {
  ADMIN_SESSION,
  DASHBOARD,
  createApiFake,
  mountApp as mountWholeApp,
  settle,
  type ApiFake,
  type RecordedCall,
} from './apiFake'

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

function inquiry(overrides: Partial<InquiryOut> = {}): InquiryOut {
  return {
    id: 'inq-1',
    kind: 'orientacion',
    kindLabel: 'Orientación para participar',
    source: 'sitio',
    name: 'Rosa Mamani',
    phone: '71548214',
    onBehalfOf: 'su esposo, Julio',
    zone: 'Villa Fátima',
    preferredCallTime: 'Por la tarde',
    message: '¿Podemos ir los dos el sábado?',
    scheduleId: null,
    scheduleTitle: null,
    status: 'recibida',
    statusLabel: 'Nueva',
    assignedTo: null,
    assignedToName: null,
    patientId: null,
    contactConsent: true,
    createdAt: '2026-11-06T14:00:00Z',
    updatedAt: '2026-11-06T14:00:00Z',
    ...overrides,
  }
}

function detail(overrides: Partial<InquiryDetail> = {}): InquiryDetail {
  return { ...inquiry(), notes: [], ...overrides } as InquiryDetail
}

const LIST = [
  inquiry(),
  inquiry({
    id: 'inq-2',
    name: 'Hugo Torrez',
    kind: 'participar',
    kindLabel: 'Quiere participar en una actividad',
    scheduleTitle: 'Arteterapia: crear juntos',
    onBehalfOf: '',
    status: 'contactada',
    statusLabel: 'Contactada',
    createdAt: '2026-10-26T14:00:00Z',
  }),
]

const SUMMARY = {
  recibida: 4,
  porContactar: 1,
  contactada: 6,
  inscrita: 12,
  cerrada: 2,
  total: 25,
}

function fakeInbox(overrides: Record<string, unknown> = {}) {
  return createApiFake({
    'GET /auth/me': { body: ADMIN_SESSION },
    'GET /dashboard/summary': { body: DASHBOARD },
    'GET /inquiries': (call: RecordedCall) => ({
      body: {
        items: call.query.get('status')
          ? LIST.filter((i) => i.status === call.query.get('status'))
          : LIST,
        total: 2,
        limit: 10,
        offset: 0,
      },
    }),
    'GET /inquiries/summary': { body: SUMMARY },
    'GET /inquiries/inq-1': { body: detail() },
    ...(overrides as Record<string, never>),
  })
}

function body() {
  return new DOMWrapper(document.body)
}

/** La ventana de arriba (la de inscribir se abre sobre la de la solicitud). */
function topDialog() {
  return body().findAll('[role="dialog"]').at(-1)!
}

function button(
  text: string,
  root: Pick<DOMWrapper<Element>, 'findAll'> = body(),
) {
  const found = root
    .findAll('button, a')
    .find((b) => b.text().replace(/\s+/g, ' ').trim() === text)
  if (!found) throw new Error(`No hay un botón «${text}»`)
  return found
}

function field(label: string) {
  const found = body()
    .findAll('.field')
    .find((f) => f.get('label').text().replace('*', '').trim() === label)
  if (!found) throw new Error(`No hay un campo «${label}»`)
  return found.get('input, select, textarea')
}

describe('Solicitudes', () => {
  it('la bandeja muestra las pestañas con sus números y filtra por motivo', async () => {
    const fake = fakeInbox()
    const { wrapper, router } = await mountApp('/equipo/solicitudes', fake)

    expect(wrapper.get('h1').text()).toBe('Solicitudes')
    expect(
      wrapper.findAll('[role="tab"]').map((t) => t.text().replace(/\s+/g, ' ')),
    ).toEqual(['Todas 25', 'Nuevas 4', 'Contactadas 6', 'Inscritas 12'])
    const rows = wrapper.findAll('.item')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain(
      'Orientación para participar · por su esposo, Julio',
    )
    expect(rows[0]!.text()).toContain('hace 2 h')
    expect(rows[0]!.find('.item__dot').exists()).toBe(true)
    expect(rows[1]!.text()).toContain('Arteterapia: crear juntos')
    expect(rows[1]!.text()).toContain('26 oct')

    await wrapper.get('[role="tab"]:nth-child(2)').trigger('click')
    await settle()
    expect(fake.callsTo('GET /inquiries').at(-1)!.query.get('status')).toBe(
      'recibida',
    )
    await wrapper.get('#filtro-motivo').setValue('voluntariado')
    await settle()
    expect(fake.callsTo('GET /inquiries').at(-1)!.query.get('kind')).toBe(
      'voluntariado',
    )
    expect(router.currentRoute.value.query).toMatchObject({
      estado: 'recibida',
      motivo: 'voluntariado',
    })
  })

  it('el detalle ofrece llamar, escribir por WhatsApp y muestra el seguimiento', async () => {
    const fake = fakeInbox()
    const { wrapper, router } = await mountApp('/equipo/solicitudes', fake)

    await wrapper.findAll('.item')[0]!.trigger('click')
    await settle()
    expect(router.currentRoute.value.query.solicitud).toBe('inq-1')
    const panel = body().get('.inquiry')
    expect(panel.get('h2').text()).toBe('Rosa Mamani')
    expect(panel.text()).toContain('Escribe por su esposo, Julio')
    expect(panel.text()).toContain('«¿Podemos ir los dos el sábado?»')
    expect(button('Llamar', panel).attributes('href')).toBe('tel:71548214')
    expect(button('Escribir por WhatsApp', panel).attributes('href')).toMatch(
      /^https:\/\/wa\.me\/59171548214\?text=Hola%2C%20Rosa/,
    )
    expect(panel.text()).toContain('7154 8214')
    expect(panel.text()).toContain('Villa Fátima')
    expect(
      panel
        .findAll('.follow li')
        .map((li) => li.classes().find((c) => c.startsWith('is-'))),
    ).toEqual(['is-now', 'is-todo', 'is-todo', 'is-todo'])
    expect(panel.get('[aria-current="step"]').text()).toBe('Recibida')
    // «Inscrita» no se marca a mano: se llega con «Inscribir como afiliado»
    expect(panel.find('[aria-label="Marcar como «Inscrita»"]').exists()).toBe(
      false,
    )
  })

  it('cambiar el estado y guardar la nota de la llamada actualiza la bandeja', async () => {
    const fake = fakeInbox({
      'PATCH /inquiries/inq-1': {
        body: detail({ status: 'por_contactar', statusLabel: 'Por contactar' }),
      },
      'POST /inquiries/inq-1/notes': {
        body: detail({
          status: 'contactada',
          statusLabel: 'Contactada',
          notes: [
            {
              id: 'n-1',
              authorName: 'Lucía Choque',
              note: 'Vendrá el sábado con su esposo.',
              createdAt: '2026-11-06T15:30:00Z',
            },
          ],
        }),
      },
    })
    await mountApp('/equipo/solicitudes?solicitud=inq-1', fake)

    const panel = body().get('.inquiry')
    await panel
      .get('[aria-label="Marcar como «Por contactar»"]')
      .trigger('click')
    await settle()
    expect(fake.callsTo('PATCH /inquiries/inq-1')[0]!.body).toEqual({
      status: 'por_contactar',
    })
    expect(body().text()).toContain('quedó «Por contactar»')

    await button('Guardar y marcar como contactada', panel).trigger('click')
    expect(panel.text()).toContain('Escribe qué conversaron en la llamada.')
    await panel.get('#nota-llamada').setValue('Vendrá el sábado con su esposo.')
    await button('Guardar y marcar como contactada', panel).trigger('click')
    await settle()
    expect(fake.callsTo('POST /inquiries/inq-1/notes')[0]!.body).toEqual({
      note: 'Vendrá el sábado con su esposo.',
      markContacted: true,
    })
    expect(panel.get('.timeline').text()).toContain(
      'Lucía Choque: Vendrá el sábado con su esposo.',
    )
    expect(panel.get('.timeline').text()).toContain('Hoy, 11:30')
    // La bandeja y el menú se vuelven a pedir
    expect(fake.callsTo('GET /inquiries/summary').length).toBeGreaterThan(1)
  })

  it('«Inscribir como afiliado» abre la ficha con los datos de la solicitud', async () => {
    const fake = fakeInbox({
      'GET /inquiries/inq-1/patient-draft': {
        body: {
          name: 'su esposo, Julio',
          phone: '71548214',
          zone: 'Villa Fátima',
          contacts: [
            {
              name: 'Rosa Mamani',
              relation: 'Familiar',
              phone: '71548214',
              isPrimary: true,
            },
          ],
        },
      },
      'POST /inquiries/inq-1/convert-to-patient': [
        {
          status: 409,
          body: {
            detail:
              'Ya existe un afiliado registrado con esa Cédula de Identidad.',
          },
        },
        { body: { id: 'pac-9', name: 'Julio Mamani' } },
      ],
      'GET /patients/pac-9': { status: 404, body: { detail: 'No' } },
    })
    const { router } = await mountApp(
      '/equipo/solicitudes?solicitud=inq-1',
      fake,
    )

    await button('Inscribir como afiliado →').trigger('click')
    await settle()
    const dialog = topDialog()
    expect(dialog.text()).toContain('Inscribir como afiliado')
    expect((field('Teléfono').element as HTMLInputElement).value).toBe(
      '71548214',
    )
    expect(dialog.text()).toContain('Rosa Mamani (Familiar)')

    await field('Nombre completo').setValue('Julio Mamani')
    await button('Abrir la ficha', dialog).trigger('click')
    await settle()
    expect(dialog.text()).toContain('Escribe el número de carnet.')
    expect(
      fake.callsTo('POST /inquiries/inq-1/convert-to-patient'),
    ).toHaveLength(0)

    await field('Carnet').setValue('4567891')
    await button('Abrir la ficha', dialog).trigger('click')
    await settle()
    expect(dialog.text()).toContain('El carnet no se puede repetir')

    await field('Carnet').setValue('4567892')
    await button('Abrir la ficha', dialog).trigger('click')
    await settle()
    expect(
      fake.callsTo('POST /inquiries/inq-1/convert-to-patient')[1]!.body,
    ).toEqual({
      name: 'Julio Mamani',
      ci: '4567892',
      birthDate: null,
      phone: '71548214',
      zone: 'Villa Fátima',
      address: '',
      contacts: [],
    })
    expect(router.currentRoute.value.fullPath).toBe('/equipo/afiliados/pac-9')
    expect(body().text()).toContain('Abrimos la ficha de Julio Mamani')
  })

  it('sin quien escribió por otra persona, pide un familiar o persona cuidadora', async () => {
    const fake = fakeInbox({
      'GET /inquiries/inq-1': { body: detail({ onBehalfOf: '' }) },
      'GET /inquiries/inq-1/patient-draft': {
        body: {
          name: 'Rosa Mamani',
          phone: '71548214',
          zone: '',
          contacts: [],
        },
      },
      'POST /inquiries/inq-1/convert-to-patient': {
        body: { id: 'pac-10', name: 'Rosa Mamani' },
      },
      'GET /patients/pac-10': { status: 404, body: { detail: 'No' } },
    })
    await mountApp('/equipo/solicitudes?solicitud=inq-1', fake)

    await button('Inscribir como afiliado →').trigger('click')
    await settle()
    const dialog = topDialog()
    await field('Carnet').setValue('1234567')
    await button('Abrir la ficha', dialog).trigger('click')
    await settle()
    expect(
      fake.callsTo('POST /inquiries/inq-1/convert-to-patient'),
    ).toHaveLength(0)
    await dialog.get('#inscribir-contacto-nombre').setValue('Pedro Mamani')
    await dialog.get('#inscribir-contacto-relacion').setValue('Hijo')
    await dialog.get('#inscribir-contacto-telefono').setValue('70011223')
    await button('Abrir la ficha', dialog).trigger('click')
    await settle()
    expect(
      (
        fake.callsTo('POST /inquiries/inq-1/convert-to-patient')[0]!.body as {
          contacts: unknown[]
        }
      ).contacts,
    ).toEqual([
      {
        name: 'Pedro Mamani',
        relation: 'Hijo',
        phone: '70011223',
        isPrimary: true,
      },
    ])
  })

  it('una solicitud se cierra sin inscribir, se reabre y una inscrita enlaza a su ficha', async () => {
    const fake = fakeInbox({
      'PATCH /inquiries/inq-1': [
        { body: detail({ status: 'cerrada', statusLabel: 'Cerrada' }) },
        { body: detail() },
      ],
      'GET /inquiries/inq-2': {
        body: detail({
          id: 'inq-2',
          status: 'inscrita',
          statusLabel: 'Inscrita',
          patientId: 'pac-3',
        }),
      },
    })
    const { router } = await mountApp(
      '/equipo/solicitudes?solicitud=inq-1',
      fake,
    )

    await button('Cerrar sin inscribir').trigger('click')
    await settle()
    expect(body().text()).toContain('Cerrada: no se va a inscribir.')
    expect(body().find('.follow').exists()).toBe(false)
    await button('Reabrir la solicitud').trigger('click')
    await settle()
    expect(fake.callsTo('PATCH /inquiries/inq-1').map((c) => c.body)).toEqual([
      { status: 'cerrada' },
      { status: 'recibida' },
    ])

    await router.push('/equipo/solicitudes?solicitud=inq-2')
    await settle()
    expect(button('Ver la ficha →').attributes('href')).toBe(
      '/equipo/afiliados/pac-3',
    )
    expect(body().text()).not.toContain('Inscribir como afiliado')
  })

  it('si la bandeja no carga, lo dice y se puede reintentar', async () => {
    const fake = fakeInbox({
      'GET /inquiries': [
        { status: 500, body: { detail: 'Error del servidor' } },
        { body: { items: [], total: 0, limit: 10, offset: 0 } },
      ],
    })
    const { wrapper } = await mountApp('/equipo/solicitudes', fake)

    expect(wrapper.text()).toContain('Error del servidor')
    await button('Intentar de nuevo').trigger('click')
    await settle()
    expect(wrapper.text()).toContain('Todavía no llegaron solicitudes.')
  })
})

describe('Textos de las solicitudes', () => {
  it('seguimiento, enlaces y fechas', () => {
    expect(followUpSteps('contactada')).toEqual(['done', 'done', 'now', 'todo'])
    expect(followUpSteps('cerrada')).toEqual(['todo', 'todo', 'todo', 'todo'])
    expect(canMove('recibida', 'contactada')).toBe(true)
    expect(canMove('inscrita', 'cerrada')).toBe(false)
    expect(canMove('cerrada', 'recibida')).toBe(true)
    expect(inquiryLine(LIST[1]!)).toBe(
      'Quiere participar en una actividad · Arteterapia: crear juntos',
    )
    expect(whatsappUrl('7154-8214')).toBe('https://wa.me/59171548214')
    expect(whatsappUrl('59171548214')).toBe('https://wa.me/59171548214')
    expect(formatPhone('71548214')).toBe('7154 8214')
    expect(formatPhone('2222333')).toBe('2222333')
    expect(receivedAgo('2026-11-06T15:59:40Z', NOW)).toBe('recién')
    expect(receivedAgo('2026-11-06T15:40:00Z', NOW)).toBe('hace 20 min')
    expect(receivedAgo('2026-11-05T15:00:00Z', NOW)).toBe('ayer')
    expect(historyTime('2026-11-05T22:20:00Z', NOW)).toBe('Ayer, 18:20')
    expect(historyTime('2026-10-26T13:58:00Z', NOW)).toBe('26 oct, 09:58')
  })
})
