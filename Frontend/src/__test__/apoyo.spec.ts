import { DOMWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { resetSiteContent } from '../composables/useSiteContent'
import { useToast } from '../composables/useToast'
import {
  NO_SESSION,
  createApiFake,
  mountApp as mountWholeApp,
  settle,
  type ApiFake,
} from './apiFake'
import { clearWidgets, fakeTurnstile } from './widgets'

const NOW = new Date('2026-11-06T16:00:00Z')
const QR = 'https://res.cloudinary.com/aspar/image/upload/v1/qr.png'

let mounted: Awaited<ReturnType<typeof mountWholeApp>> | null = null

async function mountApp(path: string, fake: ApiFake) {
  mounted = await mountWholeApp(path, fake)
  return mounted
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  fakeTurnstile()
})

afterEach(() => {
  mounted?.wrapper.unmount()
  mounted = null
  vi.useRealTimers()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
  useToast().clear()
  clearWidgets()
  resetSiteContent()
})

const GOAL = {
  title: 'Espacio propio y equipos de fisioterapia',
  description: 'Soñamos con un espacio propio.',
  targetBs: 60000,
  raisedBs: 18700,
  percent: 31,
  confirmedCount: 5,
  milestones: [
    { label: 'Colchonetas y bandas', status: 'cubierto' },
    { label: 'Barras paralelas', status: 'en_camino' },
    { label: 'Espacio propio', status: 'pendiente' },
  ],
}

const DONATION_CONTENT = {
  key: 'donaciones',
  title: 'Datos para donar',
  content: {
    titulo: '',
    texto: '',
    titular: 'Asociación de Parkinson «Mario Lagrava»',
    banco: 'Banco Unión',
    cuenta: '1-0000000',
    qrUrl: QR,
  },
  publishedAt: '2026-11-01T05:00:00Z',
}

function tracking(status = 'pendiente', statusLabel = 'Pendiente') {
  return {
    id: 'aviso-1',
    status,
    statusLabel,
    amountBs: 150,
    createdAt: '2026-11-06T13:14:00Z',
  }
}

function fakeSupport(overrides: Record<string, unknown> = {}) {
  return createApiFake({
    'GET /auth/me': NO_SESSION,
    'GET /public/content': { body: [DONATION_CONTENT] },
    'GET /public/donations/goal': { body: GOAL },
    'POST /public/donations/notice': { status: 201, body: tracking() },
    'GET /public/donations/notice/aviso-1': {
      body: tracking('confirmado', 'Confirmado'),
    },
    ...(overrides as Record<string, never>),
  })
}

function body() {
  return new DOMWrapper(document.body)
}

function button(text: string) {
  const found = body()
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

describe('Apoya a ASPAR', () => {
  it('muestra la meta en vivo, sus hitos y el QR bancario para guardarlo', async () => {
    const fake = fakeSupport()
    const { wrapper } = await mountApp('/apoyar', fake)

    expect(wrapper.get('h1').text()).toBe(
      'Ayúdanos a hacer lugar para más encuentros.',
    )
    const goal = wrapper.get('.goal')
    expect(goal.text()).toContain('Espacio propio y equipos de fisioterapia')
    expect(goal.get('.goal__amount').text()).toBe('Bs. 18.700')
    expect(goal.text()).toContain('31% de Bs. 60.000')
    expect(goal.text()).toContain('5 aportes confirmados')
    expect(goal.get('[role="progressbar"]').attributes('aria-valuenow')).toBe(
      '31',
    )
    expect(goal.findAll('.goal__milestones li').map((li) => li.text())).toEqual(
      [
        'Colchonetas y bandas✓ cubierto',
        'Barras paralelasen camino',
        'Espacio propiopendiente',
      ],
    )
    expect(wrapper.get('.hero__stamp').text()).toContain('Bs. 18.700')

    // Solo QR bancario: nada de pasarelas
    expect(wrapper.text()).not.toMatch(/Libélula|tarjeta o QR/i)
    expect(wrapper.get('.qr__code img').attributes('src')).toBe(QR)
    expect(button('Guardar el QR en mi teléfono').attributes('href')).toBe(
      'https://res.cloudinary.com/aspar/image/upload/fl_attachment/v1/qr.png',
    )
    expect(wrapper.text()).toContain('Banco Unión · Nro. 1-0000000')
    expect(button('Ofrecer una donación en especie →').attributes('href')).toBe(
      '/?motivo=especie#contacto',
    )
  })

  it('el monto elegido se lleva al QR y al aviso; «Otro monto» se escribe', async () => {
    const fake = fakeSupport()
    const { wrapper } = await mountApp('/apoyar', fake)

    expect(wrapper.get('[aria-checked="true"]').text()).toBe('Bs. 100')
    expect(wrapper.get('.impact').text()).toContain('colchoneta nueva')
    await button('Bs. 200').trigger('click')
    expect(wrapper.get('.impact').text()).toContain('Con Bs. 200')
    expect(wrapper.get('.qr ol').text()).toContain('ingresa Bs. 200')
    expect((field('Monto (Bs.)').element as HTMLInputElement).value).toBe('200')
    expect(wrapper.get('.sticky-cta').text()).toContain('Donar Bs. 200 con QR')

    await button('Otro monto').trigger('click')
    expect(wrapper.find('.impact').exists()).toBe(false)
    await field('¿Cuánto quieres aportar? (Bs.)').setValue('150,50')
    expect((field('Monto (Bs.)').element as HTMLInputElement).value).toBe(
      '150.5',
    )
    // El destino ofrece la meta publicada
    const options = field('¿Para qué es tu aporte?')
      .findAll('option')
      .map((o) => o.text())
    expect(options).toContain('Espacio propio y equipos de fisioterapia')
  })

  it('«Ya hice mi aporte» valida, avisa y muestra el seguimiento en tres pasos', async () => {
    const fake = fakeSupport()
    const { wrapper, router } = await mountApp('/apoyar', fake)

    await field('Monto (Bs.)').setValue('cien')
    await wrapper.get('form.notice').trigger('submit')
    await settle()
    expect(wrapper.text()).toContain('Escribe el monto que transferiste')
    expect(wrapper.text()).toContain('Completa la verificación de seguridad.')
    expect(fake.callsTo('POST /public/donations/notice')).toHaveLength(0)

    await field('Monto (Bs.)').setValue('150')
    await field('Tu nombre').setValue('Marcela Quispe')
    await field('Nro. de comprobante').setValue('C-1234')
    await field('Teléfono o correo').setValue('70123456')
    await wrapper.get('.turnstile-falso').trigger('click')
    await wrapper.get('form.notice').trigger('submit')
    await settle()

    expect(fake.callsTo('POST /public/donations/notice')[0]!.body).toEqual({
      donorName: 'Marcela Quispe',
      donorContact: '70123456',
      amountBs: 150,
      declaredReference: 'C-1234',
      purpose: 'Donde más se necesite',
      turnstileToken: 'token-humano',
    })
    expect(router.currentRoute.value.query.aviso).toBe('aviso-1')
    const thanks = wrapper.get('.thanks')
    expect(thanks.get('h2').text()).toBe('¡Gracias, Marcela!')
    expect(thanks.text()).toContain('Registramos tu aporte de Bs. 150')
    const steps = thanks.findAll('.track li')
    expect(
      steps.map((s) => s.classes().find((c) => c.startsWith('is-'))),
    ).toEqual(['is-done', 'is-now', 'is-todo'])
    expect(steps[0]!.text()).toContain('hoy a las 09:14')
    expect(wrapper.find('.sticky-cta').exists()).toBe(false)
    // El formulario (y su verificación) ya no está: se quitó el widget
    expect(window.turnstile!.remove).toHaveBeenCalled()

    // «Ver cómo va» pregunta de nuevo a la API
    await button('Ver cómo va').trigger('click')
    await settle()
    expect(fake.callsTo('GET /public/donations/notice/aviso-1')).toHaveLength(1)
    expect(thanks.text()).toContain(
      'ya está en nuestra cuenta y suma a la meta',
    )
    expect(
      thanks.findAll('.track li').every((li) => li.classes('is-done')),
    ).toBe(true)

    await button('Hacer otro aporte').trigger('click')
    await settle()
    expect(router.currentRoute.value.query.aviso).toBeUndefined()
    expect(wrapper.find('form.notice').exists()).toBe(true)
  })

  it('con el enlace del aviso se ve su estado; un aviso anulado lo explica', async () => {
    const fake = fakeSupport({
      'GET /public/donations/notice/aviso-1': {
        body: tracking('anulado', 'Anulado'),
      },
    })
    const { wrapper } = await mountApp('/apoyar?aviso=aviso-1', fake)

    const thanks = wrapper.get('.thanks')
    expect(thanks.get('h2').text()).toBe('¡Gracias!')
    expect(thanks.text()).toContain('no lo encontramos en nuestra cuenta')
    expect(thanks.text()).toContain('No apareció en nuestra cuenta')
    expect(wrapper.find('form.notice').exists()).toBe(false)
  })

  it('un aviso que no existe ofrece volver a avisar', async () => {
    const fake = fakeSupport()
    const { wrapper, router } = await mountApp('/apoyar?aviso=otro', fake)

    expect(wrapper.text()).toContain('No encontramos ese aviso.')
    await button('avísanos de tu aporte otra vez').trigger('click')
    await settle()
    expect(router.currentRoute.value.query.aviso).toBeUndefined()
    expect(wrapper.find('form.notice').exists()).toBe(true)
  })

  it('sin QR ni meta publicados, lo dice y ofrece pedir los datos de la cuenta', async () => {
    const fake = fakeSupport({
      'GET /public/content': { body: [] },
      'GET /public/donations/goal': { body: null },
    })
    const { wrapper } = await mountApp('/apoyar', fake)

    expect(wrapper.text()).toContain('El código QR se publica en unos días.')
    expect(button('pedirnos los datos de la cuenta').attributes('href')).toBe(
      '/?motivo=otro#contacto',
    )
    expect(wrapper.find('.goal').exists()).toBe(false)
    expect(wrapper.find('.hero__stamp').exists()).toBe(false)
    expect(wrapper.text()).toContain(
      'Cuenta a nombre de Asociación de Parkinson «Mario Lagrava»',
    )
  })

  it('muestra el error de la API y comparte el enlace de la página', async () => {
    const fake = fakeSupport({
      'POST /public/donations/notice': {
        status: 429,
        body: { detail: 'Hiciste muchos avisos seguidos.' },
      },
    })
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', {
      ...navigator,
      share: undefined,
      clipboard: { writeText },
    })
    const { wrapper } = await mountApp('/apoyar', fake)

    await wrapper.get('.turnstile-falso').trigger('click')
    await wrapper.get('form.notice').trigger('submit')
    await settle()
    expect(wrapper.get('.notice').text()).toContain(
      'Hiciste muchos avisos seguidos.',
    )

    // Desde el seguimiento se comparte el enlace (sin menú del sistema, se copia)
    fake.on('POST /public/donations/notice', { status: 201, body: tracking() })
    await wrapper.get('.turnstile-falso').trigger('click')
    await wrapper.get('form.notice').trigger('submit')
    await settle()
    await button('Compartir con alguien').trigger('click')
    await settle()
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/apoyar`)
    expect(body().text()).toContain('Copiamos el enlace')
  })
})
