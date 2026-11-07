import { DOMWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { PublicSchedule } from '../api/types'
import { resetSiteContent } from '../composables/useSiteContent'
import { useToast } from '../composables/useToast'
import {
  bs,
  canJoin,
  contactErrors,
  contactLines,
  joinSteps,
  nextActivity,
  qrDownloadUrl,
  questions,
  socialLinks,
  splitTitle,
  trackingSteps,
  parseAmount,
} from '../utils/site'
import {
  NO_SESSION,
  createApiFake,
  mountApp as mountWholeApp,
  settle,
  type ApiFake,
} from './apiFake'
import { clearWidgets, fakeTurnstile } from './widgets'

const NOW = new Date('2026-11-06T16:00:00Z')

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  fakeTurnstile()
})

let mounted: Awaited<ReturnType<typeof mountWholeApp>> | null = null

/** Monta la app y la desmonta al terminar la prueba. */
async function mountApp(path: string, fake: ApiFake) {
  mounted = await mountWholeApp(path, fake)
  return mounted
}

afterEach(() => {
  mounted?.wrapper.unmount()
  mounted = null
  vi.useRealTimers()
  document.body.innerHTML = ''
  useToast().clear()
  clearWidgets()
  resetSiteContent()
})

function activity(overrides: Partial<PublicSchedule> = {}): PublicSchedule {
  return {
    id: 'act-1',
    title: 'Movimiento en compañía',
    description: 'Una sesión de movimiento suave y un momento de conversación.',
    category: 'fisioterapia',
    categoryLabel: 'Fisioterapia',
    date: '2026-11-07',
    startTime: '10:00:00',
    endTime: '11:30:00',
    location: 'Sede ASPAR',
    status: 'publicada',
    availability: 'libres',
    spots: 30,
    cancellationNote: null,
    imageUrl: null,
    ...overrides,
  }
}

const NOVEMBER: PublicSchedule[] = [
  activity({
    id: 'act-28',
    title: 'Encuentro de familias',
    date: '2026-11-28',
  }),
  activity(),
  activity({
    id: 'act-21',
    title: 'Teatro y expresión',
    date: '2026-11-21',
    status: 'cancelada',
    availability: null,
    cancellationNote: 'Se reprogramará en diciembre',
  }),
  activity({
    id: 'act-14',
    title: 'Arteterapia: crear juntos',
    date: '2026-11-14',
    availability: 'ultimos',
  }),
]

const CONTENT = [
  {
    key: 'presentacion',
    title: 'Presentación',
    content: {
      titulo: 'La vida se vive mejor en comunidad.',
      subtitulo: 'Un espacio de encuentro para personas con Parkinson.',
      texto: '',
    },
    publishedAt: '2026-11-01T05:00:00Z',
  },
  {
    key: 'mision_vision',
    title: 'Misión y visión',
    content: {
      titulo: 'Acompañar también es hacer lugar.',
      mision: 'Acompañar a personas con Parkinson y sus familias.',
      vision: 'Una comunidad que no camina a solas.',
    },
    publishedAt: '2026-11-01T05:00:00Z',
  },
  {
    key: 'historia',
    title: 'Nuestra historia',
    content: {
      titulo: 'Cómo empezamos',
      texto: 'Empezamos en 2015.\n\nHoy somos más de cien familias.',
    },
    publishedAt: '2026-11-01T05:00:00Z',
  },
  {
    key: 'redes_contacto',
    title: 'Redes sociales y contacto',
    content: {
      facebook: 'https://www.facebook.com/aspar.bo',
      instagram: '',
      tiktok: 'https://www.tiktok.com/@aspar',
      whatsapp: '59170000000',
      telefono: '',
      correo: 'hola@aspar.org',
      direccion: '',
    },
    publishedAt: '2026-11-01T05:00:00Z',
  },
]

const ALBUMS = [
  {
    id: 'alb-1',
    title: 'Encontrarnos en movimiento',
    description: 'Fisioterapia en grupo',
    assetCount: 2,
    coverUrl: 'https://res.cloudinary.com/demo/image/upload/w_400/a.jpg',
  },
]

function fakeSite(overrides: Record<string, unknown> = {}) {
  return createApiFake({
    'GET /auth/me': NO_SESSION,
    'GET /public/content': { body: CONTENT },
    'GET /public/schedules': (call) => ({
      body: call.query.get('from')
        ? NOVEMBER.filter((a) =>
            a.date.startsWith(call.query.get('from')!.slice(0, 7)),
          )
        : NOVEMBER,
    }),
    'GET /public/media/albums': { body: ALBUMS },
    'GET /public/media/albums/alb-1': {
      body: {
        ...ALBUMS[0],
        assets: [
          {
            id: 'as-1',
            kind: 'image',
            url: 'https://res.cloudinary.com/demo/image/upload/a.jpg',
            thumbnailUrl: null,
            width: 800,
            height: 600,
          },
          {
            id: 'as-2',
            kind: 'video',
            url: 'https://res.cloudinary.com/demo/video/upload/b.mp4',
            thumbnailUrl: null,
            width: 800,
            height: 600,
          },
        ],
      },
    },
    'GET /public/donations/goal': {
      body: {
        title: 'Espacio propio',
        description: 'Soñamos con un espacio propio.',
        targetBs: 60000,
        raisedBs: 18700,
        percent: 31,
        confirmedCount: 5,
        milestones: [],
      },
    },
    'POST /public/inquiries': {
      body: { message: 'Recibimos tu mensaje. Te llamaremos pronto.' },
    },
    ...(overrides as Record<string, never>),
  })
}

function body() {
  return new DOMWrapper(document.body)
}

function button(
  text: string,
  root: Pick<DOMWrapper<Element>, 'findAll'> = body(),
) {
  const found = root
    .findAll('button')
    .find((b) => b.text().replace(/\s+/g, ' ').trim() === text)
  if (!found) throw new Error(`No hay un botón «${text}»`)
  return found
}

function field(
  label: string,
  root: Pick<DOMWrapper<Element>, 'findAll'> = body(),
) {
  const found = root
    .findAll('.field')
    .find((f) => f.get('label').text().replace('*', '').trim() === label)
  if (!found) throw new Error(`No hay un campo «${label}»`)
  return found.get('input, select, textarea')
}

describe('Inicio del sitio público', () => {
  it('muestra lo publicado: portada, misión y visión, próximo encuentro y redes', async () => {
    const fake = fakeSite()
    const { wrapper } = await mountApp('/', fake)

    expect(wrapper.get('h1').text()).toBe('La vida se vive mejor en comunidad.')
    expect(wrapper.get('h1 em').text()).toBe('comunidad.')
    expect(wrapper.text()).toContain(
      'Un espacio de encuentro para personas con Parkinson.',
    )
    expect(wrapper.text()).toContain('Una comunidad que no camina a solas.')
    // La tarjeta del próximo encuentro (el sábado 7)
    expect(wrapper.get('.hero__when').text()).toContain(
      'Movimiento en compañía',
    )
    expect(wrapper.get('.next').text()).toContain('Sábado, 7 de noviembre')
    // Redes publicadas, sin la que está vacía
    const footer = wrapper.get('.site-footer')
    expect(footer.text()).toContain('Facebook')
    expect(footer.text()).toContain('TikTok')
    expect(footer.text()).not.toContain('Instagram')
    expect(footer.text()).toContain('+59170000000')
    expect(footer.find('a[href="mailto:hola@aspar.org"]').exists()).toBe(true)
    // «Cómo participar» y preguntas sin publicar: los textos del diseño
    expect(wrapper.text()).toContain('El primer paso es conversar.')
    expect(wrapper.text()).toContain('¿Tengo que crear una cuenta?')
  })

  it('la agenda del mes ordena las actividades y tacha la cancelada con su aviso', async () => {
    const fake = fakeSite()
    const { wrapper } = await mountApp('/', fake)

    const month = fake
      .callsTo('GET /public/schedules')
      .find((call) => call.query.get('from'))!
    expect(month.query.get('from')).toBe('2026-11-01')
    expect(month.query.get('to')).toBe('2026-11-30')

    const rows = wrapper.findAll('.event')
    expect(rows.map((row) => row.get('h4').text())).toEqual([
      'Movimiento en compañía',
      'Arteterapia: crear juntos',
      'Teatro y expresión',
      'Encuentro de familias',
    ])
    const cancelled = rows[2]!
    expect(cancelled.classes()).toContain('is-cancelled')
    expect(cancelled.text()).toContain('Se reprogramará en diciembre')
    expect(cancelled.text()).toContain('Cancelada')
    expect(cancelled.find('button').exists()).toBe(false)
    expect(rows[1]!.text()).toContain('Últimos cupos')

    // No se va a meses anteriores; el siguiente se pide a la API
    expect(
      wrapper.get('[aria-label="Mes anterior"]').attributes('disabled'),
    ).toBeDefined()
    await wrapper.get('[aria-label="Mes siguiente"]').trigger('click')
    await settle()
    expect(wrapper.text()).toContain('Diciembre de 2026')
    expect(wrapper.text()).toContain(
      'Todavía no hay actividades publicadas para este mes.',
    )
  })

  it('«Quiero participar» pide nombre y teléfono y envía la actividad elegida', async () => {
    const fake = fakeSite()
    const { wrapper } = await mountApp('/', fake)

    await wrapper
      .get('[aria-label="Quiero participar en Arteterapia: crear juntos"]')
      .trigger('click')
    await settle()
    const dialog = body().get('[role="dialog"]')
    expect(dialog.text()).toContain('Quiero participar: Arteterapia')
    expect(dialog.text()).toContain('Sábado, 14 de noviembre')

    await button('Quiero participar', dialog).trigger('click')
    await settle()
    expect(dialog.text()).toContain('Escribe tu nombre (al menos 3 letras).')
    expect(dialog.text()).toContain('Escribe un teléfono de 7 a 12 dígitos.')
    expect(dialog.text()).toContain('Necesitamos tu permiso para llamarte')
    expect(dialog.text()).toContain('Completa la verificación de seguridad.')
    expect(fake.callsTo('POST /public/inquiries')).toHaveLength(0)

    await field('Nombre', dialog).setValue('Marcela Quispe')
    await field('Teléfono', dialog).setValue('7012 3456')
    await field('¿Es para otra persona?', dialog).setValue('Para mi papá')
    await dialog.get('input[type="checkbox"]').setValue(true)
    await dialog.get('.turnstile-falso').trigger('click')
    await button('Quiero participar', dialog).trigger('click')
    await settle()

    expect(fake.callsTo('POST /public/inquiries')[0]!.body).toEqual({
      kind: 'participar',
      name: 'Marcela Quispe',
      phone: '70123456',
      onBehalfOf: 'Para mi papá',
      message: '',
      scheduleId: 'act-14',
      contactConsent: true,
      turnstileToken: 'token-humano',
    })
    expect(dialog.text()).toContain(
      'Recibimos tu mensaje. Te llamaremos pronto.',
    )
    expect(window.turnstile!.reset).toHaveBeenCalled()
  })

  it('el formulario de contacto toma el motivo de la dirección y muestra el error de la API', async () => {
    const fake = fakeSite({
      'POST /public/inquiries': [
        { status: 429, body: { detail: 'Hiciste muchos envíos seguidos.' } },
        { body: { message: 'Recibimos tu mensaje.' } },
      ],
    })
    const { wrapper } = await mountApp('/?motivo=especie#contacto', fake)

    const contact = wrapper.get('#contacto')
    expect(
      (field('¿Para qué nos escribes?', contact).element as HTMLSelectElement)
        .value,
    ).toBe('especie')
    await field('Nombre', contact).setValue('Rosa Mamani')
    await field('Teléfono', contact).setValue('71234567')
    await field('Mensaje', contact).setValue('Tengo dos colchonetas.')
    await contact.get('input[type="checkbox"]').setValue(true)
    await contact.get('.turnstile-falso').trigger('click')
    await contact.get('form').trigger('submit')
    await settle()
    expect(contact.text()).toContain('Hiciste muchos envíos seguidos.')

    await contact.get('.turnstile-falso').trigger('click')
    await contact.get('form').trigger('submit')
    await settle()
    const sent = fake.callsTo('POST /public/inquiries')
    expect(sent).toHaveLength(2)
    expect(sent[1]!.body).toMatchObject({
      kind: 'especie',
      message: 'Tengo dos colchonetas.',
      scheduleId: null,
    })
    expect(contact.text()).toContain('¡Gracias por escribirnos!')
    await button('Enviar otro mensaje', contact).trigger('click')
    expect(contact.find('form').exists()).toBe(true)
  })

  it('los álbumes publicados se abren con sus fotos y la historia en una ventana', async () => {
    const fake = fakeSite()
    const { wrapper } = await mountApp('/', fake)

    expect(wrapper.get('.album').text()).toContain('2 archivos')
    await wrapper
      .get('[aria-label="Ver el álbum «Encontrarnos en movimiento»"]')
      .trigger('click')
    await settle()
    const dialog = body().get('[role="dialog"]')
    expect(dialog.findAll('img')).toHaveLength(1)
    expect(dialog.findAll('video')).toHaveLength(1)
    await dialog.get('img').trigger('error')
    expect((dialog.get('img').element as HTMLElement).style.visibility).toBe(
      'hidden',
    )

    await dialog.get('.modal__close').trigger('click')
    await settle()
    await button('Conoce nuestra historia →').trigger('click')
    await settle()
    const history = body().get('[role="dialog"]')
    expect(history.text()).toContain('Cómo empezamos')
    expect(history.findAll('p')).toHaveLength(2)
  })

  it('sin la API, el sitio muestra sus textos y avisa que la agenda no cargó', async () => {
    const fake = createApiFake({ 'GET /auth/me': NO_SESSION })
    const { wrapper } = await mountApp('/', fake)

    expect(wrapper.get('h1').text()).toBe('La vida se vive mejor en comunidad.')
    expect(wrapper.text()).toContain('Acompañar también es hacer lugar.')
    expect(wrapper.text()).toContain('No pudimos cargar la agenda.')
    expect(wrapper.text()).toContain(
      'Pronto publicaremos el próximo encuentro.',
    )
    expect(wrapper.text()).toContain('Pronto compartiremos fotos')
    expect(wrapper.find('.hero__when').exists()).toBe(false)
  })

  it('en el celular el menú se abre y se cierra al elegir una sección', async () => {
    const fake = fakeSite()
    const { wrapper, router } = await mountApp('/', fake)

    const toggle = wrapper.get('.site-header__toggle')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('.site-header').classes()).toContain('is-open')
    await router.push({ name: 'inicio', hash: '#actividades' })
    await settle()
    expect(wrapper.get('.site-header').classes()).not.toContain('is-open')
  })
})

describe('Textos del sitio', () => {
  it('título, pasos, preguntas, redes y contacto', () => {
    expect(splitTitle('La vida se vive mejor en comunidad.')).toEqual({
      start: 'La vida se vive mejor en ',
      end: 'comunidad.',
    })
    expect(splitTitle('Hola')).toEqual({ start: '', end: 'Hola' })
    expect(
      joinSteps({
        como_participar: { pasos: ['Conversamos: Cuéntanos', 'Venimos', ' '] },
      }),
    ).toEqual([
      { title: 'Conversamos', text: 'Cuéntanos' },
      { title: 'Venimos', text: '' },
    ])
    expect(joinSteps({ como_participar: { pasos: [] } })).toHaveLength(3)
    expect(
      questions({
        preguntas_frecuentes: {
          preguntas: [{ pregunta: '¿Cuesta?', respuesta: 'No.' }],
        },
      }),
    ).toEqual([{ pregunta: '¿Cuesta?', respuesta: 'No.' }])
    expect(questions({})).toHaveLength(4)
    expect(
      socialLinks({
        redes_contacto: { facebook: 'http://inseguro', tiktok: 'https://t' },
      }).map((s) => s.key),
    ).toEqual(['tiktok'])
    expect(contactLines({ redes_contacto: { telefono: '2 222 333' } })).toEqual(
      [
        { label: 'Teléfono', value: '2 222 333', href: 'tel:2222333' },
        // Sin correo publicado, el oficial de ASPAR
        {
          label: 'Correo',
          value: 'asparlapaz@gmail.com',
          href: 'mailto:asparlapaz@gmail.com',
        },
      ],
    )
    // Sin «Redes y contacto» publicado, las redes oficiales de ASPAR
    expect(socialLinks({}).map((s) => [s.key, s.url])).toEqual([
      ['facebook', 'https://www.facebook.com/share/1DKFqHL1TD/'],
      ['tiktok', 'https://www.tiktok.com/@aspar_lapaz_bolivia'],
    ])
    expect(
      contactErrors({
        name: 'Ana',
        phone: '7012-3456',
        message: '',
        consent: true,
      }),
    ).toEqual({ name: null, phone: null, consent: null })
  })

  it('actividades, montos, QR y seguimiento del aporte', () => {
    const today = '2026-11-06'
    expect(canJoin(activity(), today)).toBe(true)
    expect(canJoin(activity({ availability: 'completo' }), today)).toBe(false)
    expect(canJoin(activity({ date: '2026-11-01' }), today)).toBe(false)
    expect(nextActivity(NOVEMBER, today)?.id).toBe('act-1')
    expect(nextActivity([], today)).toBeNull()
    expect(bs(18640)).toBe('Bs. 18.640')
    expect(parseAmount('150,50')).toBe(150.5)
    expect(parseAmount('0')).toBeNull()
    expect(parseAmount('abc')).toBeNull()
    expect(parseAmount('200000')).toBeNull()
    expect(
      qrDownloadUrl('https://res.cloudinary.com/aspar/image/upload/v1/qr.png'),
    ).toBe(
      'https://res.cloudinary.com/aspar/image/upload/fl_attachment/v1/qr.png',
    )
    expect(qrDownloadUrl('https://aspar.org/qr.png')).toBe(
      'https://aspar.org/qr.png',
    )
    expect(trackingSteps('pendiente')).toEqual(['done', 'now', 'todo'])
    expect(trackingSteps('confirmado')).toEqual(['done', 'done', 'done'])
    expect(trackingSteps('anulado')).toEqual(['done', 'cancelled', 'todo'])
  })
})
