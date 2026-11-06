import { DOMWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  DonationOut,
  DonationPage,
  DonationSummary,
  GoalOut,
} from '../api/types'
import { useToast } from '../composables/useToast'
import { COUNTERS_EVENT } from '../utils/counters'
import {
  channelLine,
  formatBs,
  pendingSince,
  referenceLine,
} from '../utils/donations'
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

const PATH = '/equipo/donaciones'

// Viernes 6 de noviembre de 2026, 12:00 en La Paz
const NOW = new Date('2026-11-06T16:00:00Z')

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

function donation(overrides: Partial<DonationOut> = {}): DonationOut {
  return {
    id: 'd-1',
    donorName: 'Marcela Quispe',
    donorContact: null,
    channel: 'qr_bancario',
    channelLabel: 'QR bancario',
    source: 'sitio',
    amountBs: 100,
    inKindDescription: null,
    estimatedValueBs: null,
    purpose: 'Donde más se necesite',
    status: 'pendiente',
    statusLabel: 'Pendiente',
    declaredReference: '48213907',
    bankReference: null,
    creditedOn: null,
    cancellationReason: null,
    inventoryItemId: null,
    date: '2026-11-06',
    reviewedAt: null,
    createdAt: '2026-11-06T13:14:00Z',
    ...overrides,
  }
}

const DONATIONS: DonationOut[] = [
  donation(),
  donation({
    id: 'd-2',
    donorName: 'Jorge Arce Vargas',
    status: 'confirmado',
    statusLabel: 'Confirmado',
    amountBs: 200,
    declaredReference: null,
    bankReference: 'EXT-0193',
    creditedOn: '2026-11-05',
    date: '2026-11-05',
  }),
  donation({
    id: 'd-3',
    donorName: 'Grupo de exalumnos',
    channel: 'especie',
    channelLabel: 'En especie',
    source: 'sede',
    amountBs: null,
    inKindDescription: '6 pelotas de terapia',
    status: 'recibido',
    statusLabel: 'Recibido',
    declaredReference: null,
    inventoryItemId: 'i-9',
    date: '2026-11-04',
  }),
  donation({
    id: 'd-4',
    donorName: 'Rodrigo Salazar',
    amountBs: 1500,
    status: 'anulado',
    statusLabel: 'Anulado',
    declaredReference: null,
    cancellationReason: 'No se encontró en el extracto',
    date: '2026-11-03',
  }),
]

const SUMMARY: DonationSummary = {
  month: '2026-11',
  confirmedBs: 4380,
  confirmedCount: 23,
  pendingCount: 5,
  inKindCount: 3,
  cancelledCount: 1,
  byChannel: [
    { channel: 'qr_bancario', label: 'QR bancario', amountBs: 3370 },
    { channel: 'efectivo', label: 'Efectivo en la sede', amountBs: 1010 },
  ],
}

const GOAL: GoalOut = {
  id: 'g-1',
  title: 'Espacio propio y equipos de fisioterapia',
  description: '',
  targetBs: 60000,
  raisedBs: 18640,
  percent: 31,
  confirmedCount: 30,
  confirmedBs: 640,
  manualAdjustmentBs: 18000,
  visible: true,
  milestones: [{ label: 'Colchonetas', status: 'cubierto' }],
}

function page(call: RecordedCall): { body: DonationPage } {
  const status = call.query.get('status')
  const items = DONATIONS.filter((d) => !status || d.status === status)
  return {
    body: { items, total: items.length, limit: 10, offset: 0 },
  }
}

function fakeApi(session = { body: ADMIN_SESSION }) {
  return createApiFake({
    'GET /auth/me': session,
    'GET /dashboard/summary': { body: DASHBOARD },
    'GET /donations': (call) => page(call),
    'GET /donations/summary': (call) =>
      call.query.get('format') ? { body: 'archivo' } : { body: SUMMARY },
    'GET /donations/goal': { body: GOAL },
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

function wideWindow() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
}

describe('Donaciones', () => {
  it('muestra el resumen del mes, los tres canales, la meta y el registro', async () => {
    const fake = fakeApi()
    const { wrapper } = await mountApp(PATH, fake)

    expect(wrapper.get('h1').text()).toBe('Donaciones')
    const band = wrapper.get('.band').text()
    expect(band).toContain('Este mes llegaron Bs. 4.380 confirmados')
    expect(band).toContain('de 23 personas y grupos')
    expect(band).toContain('Hay 5 avisos que esperan revisión')
    // Los tres canales, sin Libélula
    expect(band).toContain('QR bancario')
    expect(band).toContain('Efectivo en la sede')
    expect(band).toContain('En especie')
    expect(band).not.toContain('Libélula')
    expect(band).toContain('Bs. 18.640')
    expect(band).toContain('de Bs. 60.000')
    // Las pestañas con los números del mes
    const tabs = wrapper.findAll('[role="tab"]').map((t) => t.text())
    expect(tabs).toEqual([
      'Todos 32',
      'Por confirmar 5',
      'Confirmados 23',
      'En especie 3',
      'Anulados 1',
    ])
    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(4)
    expect(rows[0]!.text()).toContain('QR bancario · Sitio web')
    expect(rows[0]!.text()).toContain('Comprobante 48213907')
    expect(rows[2]!.text()).toContain('6 pelotas de terapia → Inventario')
    expect(rows[3]!.text()).toContain('No se encontró en el extracto')
    // Del mes que se ve
    expect(lastQuery(fake, 'GET /donations')).toMatchObject({
      from: '2026-11-01',
      to: '2026-11-30',
    })
  })

  it('las pestañas, el canal y el mes van a la API y quedan en la dirección', async () => {
    const fake = fakeApi()
    const { wrapper, router } = await mountApp(PATH, fake)

    await wrapper.get('#aportes-tab-pendiente').trigger('click')
    await settle()
    expect(lastQuery(fake, 'GET /donations')).toMatchObject({
      status: 'pendiente',
    })
    expect(router.currentRoute.value.query.estado).toBe('pendiente')

    await wrapper.get('#filtro-canal').setValue('efectivo')
    await settle()
    expect(lastQuery(fake, 'GET /donations')).toMatchObject({
      channel: 'efectivo',
    })

    await wrapper.get('#filtro-mes').setValue('2026-10')
    await settle()
    expect(lastQuery(fake, 'GET /donations')).toMatchObject({
      from: '2026-10-01',
      to: '2026-10-31',
    })
    expect(lastQuery(fake, 'GET /donations/summary')).toMatchObject({
      month: '2026-10',
    })
    expect(router.currentRoute.value.query.mes).toBe('2026-10')
    expect(wrapper.get('.band').text()).toContain('En octubre llegaron')
  })

  it('confirma un aviso con la referencia del extracto y avisa al menú', async () => {
    wideWindow()
    const fake = fakeApi()
    fake.on('POST /donations/d-1/confirm', {
      body: donation({
        status: 'confirmado',
        statusLabel: 'Confirmado',
        bankReference: '48213907',
        creditedOn: '2026-11-06',
      }),
    })
    const counters = vi.fn()
    window.addEventListener(COUNTERS_EVENT, counters)
    const { wrapper } = await mountApp(PATH, fake)

    await wrapper
      .get('[aria-label="Confirmar el aporte de Marcela Quispe"]')
      .trigger('click')
    await settle()
    const panel = wrapper.get('.don__side')
    expect(panel.text()).toContain('Confirmar aporte')
    expect(panel.text()).toContain('Pendiente desde hoy, 09:14')
    // La referencia propone el comprobante que avisó la persona
    expect(field('Ref. del extracto', panel).element).toHaveProperty(
      'value',
      '48213907',
    )
    expect(field('Acreditado el', panel).element).toHaveProperty(
      'value',
      '2026-11-06',
    )

    await field('Ref. del extracto', panel).setValue('x')
    await panel.get('form.confirm').trigger('submit')
    await settle()
    expect(panel.text()).toContain(
      'Escribe la referencia que aparece en el extracto.',
    )
    expect(fake.callsTo('POST /donations/d-1/confirm')).toHaveLength(0)

    await field('Ref. del extracto', panel).setValue('48213907')
    await button('Confirmar ingreso de Bs. 100', panel).trigger('click')
    await settle()
    expect(fake.callsTo('POST /donations/d-1/confirm')[0]!.body).toEqual({
      bankReference: '48213907',
      creditedOn: '2026-11-06',
    })
    expect(body().text()).toContain(
      'Confirmamos el aporte de Bs. 100. Ya suma a la meta.',
    )
    expect(counters).toHaveBeenCalled()
    // Se vuelven a leer el resumen y la meta
    expect(fake.callsTo('GET /donations/goal').length).toBeGreaterThan(1)
    window.removeEventListener(COUNTERS_EVENT, counters)
  })

  it('anula un aviso que no aparece en el banco, con su motivo', async () => {
    const fake = fakeApi()
    fake.on('POST /donations/d-1/cancel', {
      body: donation({
        status: 'anulado',
        statusLabel: 'Anulado',
        cancellationReason: 'No está en el extracto',
      }),
    })
    // En una ventana angosta el aporte se abre en una ventana
    const { wrapper } = await mountApp(`${PATH}?aporte=d-1`, fake)
    expect(wrapper.find('.don__side').exists()).toBe(false)
    expect(body().find('[role="dialog"] .panel').exists()).toBe(true)

    await button('No aparece en el banco · anular con motivo').trigger('click')
    await settle()
    const dialog = body().findAll('[role="dialog"]').at(-1)!
    await dialog.get('textarea').setValue('')
    await button('Anular aporte').trigger('click')
    await settle()
    expect(body().text()).toContain('Escribe el motivo (al menos 3 letras).')

    await dialog.get('textarea').setValue('No está en el extracto')
    await button('Anular aporte').trigger('click')
    await settle()
    expect(fake.callsTo('POST /donations/d-1/cancel')[0]!.body).toEqual({
      reason: 'No está en el extracto',
    })
    expect(body().text()).toContain('Anulamos el aviso.')
  })

  it('un aporte confirmado o en especie muestra su detalle y el enlace al inventario', async () => {
    wideWindow()
    const fake = fakeApi()
    const { wrapper } = await mountApp(PATH, fake)

    await wrapper
      .get('[aria-label="Ver el aporte de Grupo de exalumnos"]')
      .trigger('click')
    await settle()
    const panel = wrapper.get('.don__side')
    expect(panel.text()).toContain('Detalle del aporte')
    expect(panel.text()).toContain('6 pelotas de terapia')
    expect(panel.find('form.confirm').exists()).toBe(false)
    expect(panel.get('a').attributes('href')).toBe(
      '/equipo/inventario?material=i-9',
    )
  })

  it('descarga el resumen del mes en CSV o Excel', async () => {
    vi.stubGlobal(
      'URL',
      Object.assign(URL, {
        createObjectURL: vi.fn(() => 'blob:aportes'),
        revokeObjectURL: vi.fn(),
      }),
    )
    const names: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      names.push(this.download)
    })
    const fake = fakeApi()
    const { wrapper } = await mountApp(PATH, fake)

    await wrapper
      .get('[aria-label="Descargar el resumen del mes en CSV"]')
      .trigger('click')
    await settle()
    await wrapper
      .get('[aria-label="Descargar el resumen del mes en Excel"]')
      .trigger('click')
    await settle()
    expect(names).toEqual(['donaciones-2026-11.csv', 'donaciones-2026-11.xlsx'])
  })

  it('registra efectivo, QR bancario y en especie desde la sede', async () => {
    const fake = fakeApi()
    fake.on('POST /donations', (call) => ({
      status: 201,
      body: donation({
        id: 'd-9',
        channel: (call.body as { channel: DonationOut['channel'] }).channel,
        source: 'sede',
        status: {
          efectivo: 'confirmado',
          qr_bancario: 'pendiente',
          especie: 'recibido',
        }[
          (call.body as { channel: DonationOut['channel'] }).channel
        ] as DonationOut['status'],
        amountBs: 250,
      }),
    }))
    const { wrapper } = await mountApp(PATH, fake)

    // Efectivo: el monto es obligatorio
    await button('+ Registrar aporte recibido', wrapper).trigger('click')
    await settle()
    expect(body().text()).toContain('Quedará como Confirmado')
    await button('Registrar aporte').trigger('click')
    await settle()
    expect(body().text()).toContain('Escribe el monto en bolivianos')
    await field('Quién lo entrega').setValue('Familia Rojas Mendoza')
    await field('Monto (Bs.)').setValue('250')
    await field('Nro. de recibo').setValue('0127')
    await button('Registrar aporte').trigger('click')
    await settle()
    expect(fake.callsTo('POST /donations')[0]!.body).toEqual({
      channel: 'efectivo',
      donorName: 'Familia Rojas Mendoza',
      donorContact: null,
      date: '2026-11-06',
      amountBs: 250,
      receiptNumber: '0127',
    })
    expect(body().text()).toContain('Registramos Bs. 250 en efectivo.')

    // QR bancario: queda por confirmar con el extracto
    await button('+ Registrar aporte recibido', wrapper).trigger('click')
    await settle()
    await body().get('input[value="qr_bancario"]').setValue(true)
    await settle()
    expect(body().text()).toContain('Quedará como Por confirmar')
    await field('Monto (Bs.)').setValue('150,50')
    await field('Nro. de comprobante').setValue('48213999')
    await button('Registrar aporte').trigger('click')
    await settle()
    expect(fake.callsTo('POST /donations')[1]!.body).toMatchObject({
      channel: 'qr_bancario',
      amountBs: 150.5,
      receiptNumber: '48213999',
      donorName: null,
    })
    expect(body().text()).toContain(
      'Confírmalo cuando aparezca en el extracto.',
    )

    // En especie: qué llegó, cantidad y el check del inventario
    await button('+ Registrar aporte recibido', wrapper).trigger('click')
    await settle()
    await body().get('input[value="especie"]').setValue(true)
    await settle()
    expect(body().text()).toContain('Quedará como Recibido')
    await field('¿Qué se recibió?').setValue('Pelotas de terapia de 65 cm')
    await field('Cantidad').setValue('6')
    await field('Valor estimado (Bs.)').setValue('600')
    await field('Categoría').setValue('fisioterapia')
    expect(body().text()).toContain(
      '«Pelotas de terapia de 65 cm · 6 · Nuevo · Origen: donado»',
    )
    await button('Registrar aporte').trigger('click')
    await settle()
    expect(fake.callsTo('POST /donations')[2]!.body).toEqual({
      channel: 'especie',
      donorName: null,
      donorContact: null,
      date: '2026-11-06',
      inKindDescription: 'Pelotas de terapia de 65 cm',
      quantity: 6,
      condition: 'nuevo',
      category: 'fisioterapia',
      estimatedValueBs: 600,
      addToInventory: true,
    })
  })

  it('no deja registrar con una fecha futura', async () => {
    const fake = fakeApi()
    const { wrapper } = await mountApp(PATH, fake)

    await button('+ Registrar aporte recibido', wrapper).trigger('click')
    await settle()
    await field('Monto (Bs.)').setValue('50')
    await field('Fecha de recepción').setValue('2026-12-01')
    await button('Registrar aporte').trigger('click')
    await settle()
    expect(body().text()).toContain(
      'La fecha de recepción no puede ser futura.',
    )
    expect(fake.callsTo('POST /donations')).toHaveLength(0)
  })

  it('edita la meta: monto, ajuste, visibilidad e hitos', async () => {
    const fake = fakeApi()
    fake.on('PUT /donations/goal', (call) => ({
      body: { ...GOAL, ...(call.body as object), visible: false },
    }))
    const { wrapper } = await mountApp(PATH, fake)

    await button('Editar meta →', wrapper).trigger('click')
    await settle()
    expect(field('Título').element).toHaveProperty('value', GOAL.title)
    await field('Meta (Bs.)').setValue('80000')
    await body().get('.visible input').setValue(false)
    await button('+ Agregar hito').trigger('click')
    await settle()
    await button('Guardar meta').trigger('click')
    await settle()
    // Un hito vacío no se guarda
    expect(body().text()).toContain('Escribe el hito (al menos 3 letras).')
    await field('Hito 2').setValue('Barras paralelas')
    await field('Estado del hito 2').setValue('en_camino')
    await button('Guardar meta').trigger('click')
    await settle()
    expect(fake.callsTo('PUT /donations/goal')[0]!.body).toEqual({
      title: GOAL.title,
      description: '',
      targetBs: 80000,
      manualAdjustmentBs: 18000,
      visible: false,
      milestones: [
        { label: 'Colchonetas', status: 'cubierto' },
        { label: 'Barras paralelas', status: 'en_camino' },
      ],
    })
    expect(body().text()).toContain('No se muestra en el sitio.')
  })

  it('sin permiso de donaciones no entra a la pantalla', async () => {
    const fake = fakeApi({ body: VOLUNTEER_SESSION })
    const { router } = await mountApp(PATH, fake)

    expect(router.currentRoute.value.name).toBe('resumen')
    expect(fake.callsTo('GET /donations')).toHaveLength(0)
  })
})

describe('Textos de donaciones', () => {
  it('montos, canales y referencias como en el diseño', () => {
    expect(formatBs(4380)).toBe('Bs. 4.380')
    expect(formatBs(12.5)).toBe('Bs. 12,5')
    expect(formatBs(null)).toBe('—')
    expect(channelLine(DONATIONS[0]!)).toBe('QR bancario · Sitio web')
    expect(channelLine(donation({ channel: 'efectivo', source: 'sede' }))).toBe(
      'Efectivo · En la sede',
    )
    expect(referenceLine(donation({ declaredReference: null }))).toBe(
      'Sin comprobante',
    )
    expect(
      referenceLine(
        donation({ channel: 'efectivo', declaredReference: '0127' }),
      ),
    ).toBe('Recibo 0127')
    expect(referenceLine(DONATIONS[1]!)).toBe('Extracto EXT-0193')
    expect(
      pendingSince('2026-11-04T22:02:00Z', new Date('2026-11-06T16:00:00Z')),
    ).toBe('Pendiente desde el 4 nov, 18:02')
  })
})
