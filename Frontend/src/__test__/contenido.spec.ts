import { DOMWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SectionOut } from '../api/types'
import { useToast } from '../composables/useToast'
import { ago, changedSegments } from '../utils/content'
import {
  ADMIN_SESSION,
  DASHBOARD,
  VOLUNTEER_SESSION,
  createApiFake,
  mountApp,
  settle,
  type RecordedCall,
} from './apiFake'

const PATH = '/equipo/contenido'
const NOW = new Date('2026-11-06T16:00:00Z')

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

const VISION =
  'Una comunidad donde vivir con una condición de movimiento no signifique vivir sin apoyo.'

function section(overrides: Partial<SectionOut> = {}): SectionOut {
  return {
    key: 'mision_vision',
    title: 'Misión y visión',
    draftContent: {
      titulo: 'Acompañar también es hacer lugar.',
      mision: 'Acompañar a personas con Parkinson.',
      vision: VISION,
    },
    publishedContent: {
      titulo: 'Acompañar también es hacer lugar.',
      mision: 'Acompañar a personas con Parkinson.',
      vision: VISION,
    },
    hasUnpublishedChanges: false,
    draftUpdatedAt: '2026-11-06T13:00:00Z',
    publishedAt: '2026-09-01T13:00:00Z',
    ...overrides,
  }
}

const SECTIONS: SectionOut[] = [
  section({
    key: 'presentacion',
    title: 'Presentación',
    draftContent: { titulo: 'La vida se vive mejor en comunidad.' },
    publishedContent: { titulo: 'La vida se vive mejor en comunidad.' },
  }),
  section(),
  section({
    key: 'preguntas_frecuentes',
    title: 'Preguntas frecuentes',
    draftContent: {
      titulo: 'Preguntas',
      preguntas: [{ pregunta: '¿Cuesta algo?', respuesta: 'No, es gratis.' }],
    },
    publishedContent: null,
    hasUnpublishedChanges: true,
    publishedAt: null,
  }),
  section({
    key: 'redes_contacto',
    title: 'Redes sociales y contacto',
    draftContent: {
      titulo: '',
      facebook: 'https://www.facebook.com/aspar.bo',
      instagram: '',
      tiktok: '',
      whatsapp: '',
      telefono: '',
      correo: '',
      direccion: '',
    },
  }),
]

function fakeApi(session = { body: ADMIN_SESSION }) {
  return createApiFake({
    'GET /auth/me': session,
    'GET /dashboard/summary': { body: DASHBOARD },
    'GET /content/sections': { body: SECTIONS },
  })
}

/** El PUT devuelve la sección con el borrador nuevo. */
function savedDraft(key: string) {
  return (call: RecordedCall) => {
    const base = SECTIONS.find((s) => s.key === key)!
    const content = (call.body as { content: Record<string, unknown> }).content
    return {
      body: {
        ...base,
        draftContent: content,
        hasUnpublishedChanges:
          JSON.stringify(content) !== JSON.stringify(base.publishedContent),
      },
    }
  }
}

function body() {
  return new DOMWrapper(document.body)
}

function field(label: string) {
  const found = body()
    .findAll('.field')
    .find((f) => f.get('label').text().replace('*', '').trim() === label)
  if (!found) throw new Error(`No hay un campo «${label}»`)
  return found.get('input, select, textarea')
}

function button(text: string) {
  const found = body()
    .findAll('button')
    .find((b) => b.text().replace(/\s+/g, ' ').trim() === text)
  if (!found) throw new Error(`No hay un botón «${text}»`)
  return found
}

describe('Contenido del sitio', () => {
  it('lista las secciones con su estado y cuenta los cambios sin publicar', async () => {
    const fake = fakeApi()
    const { wrapper } = await mountApp(PATH, fake)

    expect(wrapper.get('h1').text()).toBe('Contenido del sitio')
    expect(wrapper.text()).toContain('1 cambio sin publicar')
    const items = wrapper.findAll('.nav__item').map((i) => i.text())
    expect(items[1]).toContain('Publicado hace 2 meses')
    expect(items[2]).toContain('Sin publicar · editado hoy')
    // Abre la portada por defecto
    expect(field('Título de la sección').element).toHaveProperty(
      'value',
      'La vida se vive mejor en comunidad.',
    )
  })

  it('la vista previa resalta lo que cambió y «Guardar borrador» no publica', async () => {
    const fake = fakeApi()
    fake.on('PUT /content/sections/mision_vision', savedDraft('mision_vision'))
    const { wrapper } = await mountApp(`${PATH}?seccion=mision_vision`, fake)

    expect(wrapper.find('.preview mark').exists()).toBe(false)
    expect(button('Guardar borrador').attributes('disabled')).toBeDefined()
    await field('Visión').setValue(
      `${VISION} Un espacio propio, y servicios que crecen con la comunidad.`,
    )
    const marks = wrapper.findAll('.preview mark').map((m) => m.text())
    expect(marks).toEqual([
      'Un espacio propio, y servicios que crecen con la comunidad.',
    ])

    await button('Guardar borrador').trigger('click')
    await settle()
    const sent = fake.callsTo('PUT /content/sections/mision_vision')[0]!
      .body as { content: Record<string, string> }
    expect(sent.content.vision).toContain('Un espacio propio')
    expect(
      fake.callsTo('POST /content/sections/mision_vision/publish'),
    ).toHaveLength(0)
    expect(body().text()).toContain('Todavía no se ve en el sitio.')
    expect(wrapper.text()).toContain('2 cambios sin publicar')
  })

  it('«Publicar cambios» guarda lo escrito y lo publica', async () => {
    const fake = fakeApi()
    fake.on('PUT /content/sections/mision_vision', savedDraft('mision_vision'))
    fake.on('POST /content/sections/mision_vision/publish', {
      body: section({ title: 'Misión y visión', hasUnpublishedChanges: false }),
    })
    await mountApp(`${PATH}?seccion=mision_vision`, fake)

    await field('Misión').setValue(
      'Acompañar a personas con Parkinson y sus familias.',
    )
    await button('Publicar cambios').trigger('click')
    await settle()
    expect(fake.callsTo('PUT /content/sections/mision_vision')).toHaveLength(1)
    expect(
      fake.callsTo('POST /content/sections/mision_vision/publish'),
    ).toHaveLength(1)
    expect(body().text()).toContain('Publicamos «Misión y visión».')
  })

  it('valida los campos obligatorios antes de guardar', async () => {
    const fake = fakeApi()
    const { wrapper } = await mountApp(`${PATH}?seccion=mision_vision`, fake)

    await field('Título de la sección').setValue('')
    await field('Misión').setValue('')
    await wrapper.get('form#editar-seccion').trigger('submit')
    await settle()
    expect(body().text()).toContain('Escribe título de la sección.')
    expect(body().text()).toContain('Escribe misión.')
    expect(fake.callsTo('PUT /content/sections/mision_vision')).toHaveLength(0)
  })

  it('al cambiar de sección con cambios sin guardar, pregunta', async () => {
    const fake = fakeApi()
    const { wrapper, router } = await mountApp(
      `${PATH}?seccion=mision_vision`,
      fake,
    )

    await field('Misión').setValue('Otra misión')
    await wrapper.findAll('.nav__item')[0]!.trigger('click')
    await settle()
    expect(body().text()).toContain('Tienes cambios sin guardar')
    await button('Descartar').trigger('click')
    await settle()
    expect(router.currentRoute.value.query.seccion).toBeUndefined()
    expect(field('Título de la sección').element).toHaveProperty(
      'value',
      'La vida se vive mejor en comunidad.',
    )
  })

  it('las preguntas frecuentes se agregan, se quitan y se envían limpias', async () => {
    const fake = fakeApi()
    fake.on(
      'PUT /content/sections/preguntas_frecuentes',
      savedDraft('preguntas_frecuentes'),
    )
    const { wrapper } = await mountApp(
      `${PATH}?seccion=preguntas_frecuentes`,
      fake,
    )
    expect(wrapper.text()).toContain('Esta sección todavía no se publicó')

    await button('+ Agregar pregunta').trigger('click')
    await settle()
    await field('Pregunta 2').setValue('¿Dónde es?')
    await wrapper.get('form#editar-seccion').trigger('submit')
    await settle()
    expect(body().text()).toContain('Escribe la respuesta (al menos 3 letras).')
    await field('Respuesta 2').setValue('En la sede de ASPAR.')
    await button('Quitar la pregunta 1').trigger('click')
    await wrapper.get('form#editar-seccion').trigger('submit')
    await settle()
    expect(
      (
        fake.callsTo('PUT /content/sections/preguntas_frecuentes')[0]!.body as {
          content: Record<string, unknown>
        }
      ).content,
    ).toEqual({
      titulo: 'Preguntas',
      preguntas: [
        { pregunta: '¿Dónde es?', respuesta: 'En la sede de ASPAR.' },
      ],
    })
  })

  it('las redes sociales se guardan aparte y muestran el error de la API', async () => {
    const fake = fakeApi()
    fake.on('PUT /content/social-links', [
      {
        status: 422,
        body: {
          detail:
            'Revisa «instagram»: Pega el enlace oficial de Instagram (https://...).',
        },
      },
      { body: SECTIONS[3] },
    ])
    const { wrapper } = await mountApp(`${PATH}?seccion=redes_contacto`, fake)

    expect(field('Facebook').element).toHaveProperty(
      'value',
      'https://www.facebook.com/aspar.bo',
    )
    await field('Instagram').setValue('https://notinstagram.com/aspar')
    await button('Guardar enlaces').trigger('click')
    await settle()
    expect(wrapper.text()).toContain('Pega el enlace oficial de Instagram')
    await field('Instagram').setValue('https://www.instagram.com/aspar')
    await button('Guardar enlaces').trigger('click')
    await settle()
    expect(fake.callsTo('PUT /content/social-links')[1]!.body).toEqual({
      facebook: 'https://www.facebook.com/aspar.bo',
      instagram: 'https://www.instagram.com/aspar',
      tiktok: '',
    })
    expect(body().text()).toContain('Guardamos los enlaces.')
  })

  it('sin permiso de contenido no entra a la pantalla', async () => {
    const fake = fakeApi({ body: VOLUNTEER_SESSION })
    const { router } = await mountApp(PATH, fake)
    expect(router.currentRoute.value.name).toBe('resumen')
  })
})

describe('Textos del contenido', () => {
  it('cuándo se editó y qué cambió', () => {
    expect(ago('2026-11-06T13:00:00Z', NOW)).toBe('hoy')
    expect(ago('2026-11-05T13:00:00Z', NOW)).toBe('ayer')
    expect(ago('2026-10-23T13:00:00Z', NOW)).toBe('hace 2 semanas')
    expect(ago('2026-09-01T13:00:00Z', NOW)).toBe('hace 2 meses')
    expect(changedSegments('Hola mundo', 'Hola mundo')).toEqual([
      { text: 'Hola mundo', changed: false },
    ])
    expect(changedSegments('Hola mundo', 'Hola gran mundo')).toEqual([
      { text: 'Hola ', changed: false },
      { text: 'gran ', changed: true },
      { text: 'mundo', changed: false },
    ])
    expect(changedSegments(undefined, 'Nuevo')).toEqual([
      { text: 'Nuevo', changed: false },
    ])
  })
})
