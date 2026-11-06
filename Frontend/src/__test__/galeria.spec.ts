import { DOMWrapper, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type {
  AlbumOut,
  AlbumSummary,
  AssetOut,
  PatientSummary,
} from '../api/types'
import { useToast } from '../composables/useToast'
import { assetCountLabel, fileProblem, thumbnailUrl } from '../utils/media'
import {
  ADMIN_SESSION,
  DASHBOARD,
  VOLUNTEER_SESSION,
  createApiFake,
  mountApp,
  settle,
} from './apiFake'

const PATH = '/equipo/galeria'

afterEach(() => {
  document.body.innerHTML = ''
  useToast().clear()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const SUMMARIES: AlbumSummary[] = [
  {
    id: 'a-1',
    title: 'Crear con las manos',
    description: 'Taller de arteterapia.',
    visibility: 'privado',
    permissionsReviewed: false,
    scheduleId: null,
    assetCount: 2,
    coverUrl: 'https://res.cloudinary.com/demo/image/upload/w_400/dog.jpg',
    createdAt: '2026-10-25T12:00:00Z',
  },
  {
    id: 'a-2',
    title: 'Encontrarnos en movimiento',
    description: '',
    visibility: 'publico',
    permissionsReviewed: true,
    scheduleId: null,
    assetCount: 1,
    coverUrl: null,
    createdAt: '2026-10-18T12:00:00Z',
  },
]

function asset(overrides: Partial<AssetOut> = {}): AssetOut {
  return {
    id: 'as-1',
    kind: 'imagen',
    url: 'https://res.cloudinary.com/demo/image/upload/dog.jpg',
    thumbnailUrl: 'https://res.cloudinary.com/demo/image/upload/w_400/dog.jpg',
    width: 1200,
    height: 800,
    sizeBytes: 250000,
    uploadedAt: '2026-10-25T12:00:00Z',
    tags: [],
    ...overrides,
  }
}

function album(overrides: Partial<AlbumOut> = {}): AlbumOut {
  return {
    ...SUMMARIES[0]!,
    reviewedAt: null,
    assets: [
      asset({
        tags: [
          { patientId: 'p-1', name: 'Elena Quisbert', imageConsent: true },
          { patientId: 'p-2', name: 'Miguel Rojas', imageConsent: false },
        ],
      }),
      asset({ id: 'as-2', tags: [] }),
    ],
    warnings: [{ assetId: 'as-1', patientId: 'p-2', name: 'Miguel Rojas' }],
    ...overrides,
  }
}

function fakeApi(session = { body: ADMIN_SESSION }) {
  return createApiFake({
    'GET /auth/me': session,
    'GET /dashboard/summary': { body: DASHBOARD },
    'GET /media/albums': (call) => {
      const visibility = call.query.get('visibility')
      return {
        body: SUMMARIES.filter(
          (a) => !visibility || a.visibility === visibility,
        ),
      }
    },
    'GET /media/albums/a-1': { body: album() },
  })
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

function file(name: string, type: string, size = 1000) {
  const f = new File(['x'], name, { type })
  Object.defineProperty(f, 'size', { value: size })
  return f
}

async function pickFiles(wrapper: VueWrapper, files: File[]) {
  const input = wrapper.get('input[type="file"]')
  Object.defineProperty(input.element, 'files', {
    value: files,
    configurable: true,
  })
  await input.trigger('change')
  await settle()
}

describe('Galería', () => {
  it('muestra los álbumes con su estado y filtra por publicados o privados', async () => {
    const fake = fakeApi()
    const { wrapper, router } = await mountApp(PATH, fake)

    expect(wrapper.get('h1').text()).toBe('Galería')
    const cards = wrapper.findAll('.album-card')
    expect(cards).toHaveLength(2)
    expect(cards[0]!.text()).toContain('Crear con las manos')
    expect(cards[0]!.text()).toContain('En revisión')
    expect(cards[1]!.text()).toContain('Publicado')
    // Sin álbum elegido no se puede subir
    expect(
      button('Elegir archivos', wrapper).attributes('disabled'),
    ).toBeDefined()

    await wrapper.get('#albumes-tab-publico').trigger('click')
    await settle()
    expect(
      fake.callsTo('GET /media/albums').at(-1)!.query.get('visibility'),
    ).toBe('publico')
    expect(wrapper.findAll('.album-card')).toHaveLength(1)
    expect(router.currentRoute.value.query.ver).toBe('publico')
  })

  it('con alguien sin permiso de imagen avisa y no deja publicar aunque se marque la revisión', async () => {
    const fake = fakeApi()
    const { wrapper } = await mountApp(`${PATH}?album=a-1`, fake)

    const panel = wrapper.get('.album')
    expect(panel.text()).toContain('Revisando')
    expect(panel.text()).toContain('En 1 foto aparece una persona sin permiso')
    expect(panel.findAll('.thumb.is-blocked')).toHaveLength(1)
    await panel.get('.review input').setValue(true)
    expect(
      button('Publicar en el sitio', panel).attributes('disabled'),
    ).toBeDefined()
    expect(panel.text()).toContain(
      'Primero quita o tapa a quien no tiene permiso de imagen.',
    )
  })

  it('publica solo con la revisión marcada cuando no hay avisos', async () => {
    const fake = fakeApi()
    fake.on('GET /media/albums/a-1', { body: album({ warnings: [] }) })
    fake.on('POST /media/albums/a-1/publish', {
      body: album({ warnings: [], visibility: 'publico' }),
    })
    const { wrapper } = await mountApp(`${PATH}?album=a-1`, fake)

    const panel = wrapper.get('.album')
    const publish = button('Publicar en el sitio', panel)
    expect(publish.attributes('disabled')).toBeDefined()
    expect(panel.text()).toContain('Se habilita cuando confirmes los permisos.')
    await panel.get('.review input').setValue(true)
    expect(publish.attributes('disabled')).toBeUndefined()
    await publish.trigger('click')
    await settle()
    expect(fake.callsTo('POST /media/albums/a-1/publish')[0]!.body).toEqual({
      permissionsReviewed: true,
    })
    expect(body().text()).toContain('Ya se ve en el sitio.')
    expect(wrapper.get('.album').text()).toContain('Quitar del sitio')
  })

  it('sube fotos a Cloudinary con la firma y las registra en el álbum', async () => {
    const fake = fakeApi()
    fake.on('POST /media/albums/a-1/upload-signature', {
      body: {
        uploadUrl: 'https://api.aspar.test/api/v1/cloudinary/upload',
        cloudName: 'demo',
        apiKey: 'clave',
        folder: 'aspar/albums/a-1',
        timestamp: 1700000000,
        allowedFormats: 'jpg,jpeg,png,webp,mp4',
        signature: 'firma',
      },
    })
    fake.on('POST /cloudinary/upload', {
      body: {
        public_id: 'aspar/albums/a-1/nueva',
        secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/nueva.jpg',
        resource_type: 'image',
        width: 800,
        height: 600,
        bytes: 1000,
      },
    })
    fake.on('POST /media/albums/a-1/assets', { status: 201, body: asset() })
    // El navegador sube directo a Cloudinary (aquí, a la misma API simulada)
    vi.stubGlobal('fetch', fake.fetchMock)
    const { wrapper } = await mountApp(`${PATH}?album=a-1`, fake)

    await pickFiles(wrapper, [
      file('taller.jpg', 'image/jpeg'),
      file('notas.pdf', 'application/pdf'),
    ])

    expect(body().text()).toContain('«notas.pdf» no es JPG, PNG, WEBP ni MP4.')
    expect(fake.callsTo('POST /cloudinary/upload')).toHaveLength(1)
    expect(fake.callsTo('POST /media/albums/a-1/assets')[0]!.body).toEqual({
      publicId: 'aspar/albums/a-1/nueva',
      url: 'https://res.cloudinary.com/demo/image/upload/v1/nueva.jpg',
      thumbnailUrl:
        'https://res.cloudinary.com/demo/image/upload/w_400/v1/nueva.jpg',
      kind: 'imagen',
      width: 800,
      height: 600,
      sizeBytes: 1000,
    })
    expect(body().text()).toContain(
      'Subimos 1 archivo a «Crear con las manos».',
    )
    expect(wrapper.text()).toContain('Listo: 1 de 1 archivos')
  })

  it('si Cloudinary no está configurado lo dice en lugar de ofrecer la subida', async () => {
    const fake = fakeApi()
    fake.on('POST /media/albums/a-1/upload-signature', {
      status: 503,
      body: {
        detail: 'La subida de fotos y videos no está configurada (Cloudinary).',
      },
    })
    const { wrapper } = await mountApp(`${PATH}?album=a-1`, fake)

    await pickFiles(wrapper, [file('taller.jpg', 'image/jpeg')])
    expect(wrapper.text()).toContain(
      'La subida de fotos y videos no está configurada (Cloudinary).',
    )
    expect(wrapper.find('.drop').exists()).toBe(false)
  })

  it('no sube más de 10 archivos por vez', async () => {
    const fake = fakeApi()
    const { wrapper } = await mountApp(`${PATH}?album=a-1`, fake)

    await pickFiles(
      wrapper,
      Array.from({ length: 11 }, (_, i) => file(`f${i}.jpg`, 'image/jpeg')),
    )
    expect(wrapper.text()).toContain(
      'Elegiste 11 archivos: sube hasta 10 por vez.',
    )
    expect(
      fake.callsTo('POST /media/albums/a-1/upload-signature'),
    ).toHaveLength(0)
  })

  it('crea un álbum nuevo, privado, y lo deja abierto para subir', async () => {
    const fake = fakeApi()
    const created = album({
      id: 'a-9',
      title: 'Teatro de noviembre',
      assets: [],
      warnings: [],
      assetCount: 0,
    })
    fake.on('POST /media/albums', { status: 201, body: created })
    const { wrapper } = await mountApp(PATH, fake)

    await button('+ Nuevo álbum', wrapper).trigger('click')
    await settle()
    await button('Crear álbum').trigger('click')
    await settle()
    expect(body().text()).toContain('Escribe el nombre del álbum')
    await body().get('[role="dialog"] input').setValue('Teatro de noviembre')
    await button('Crear álbum').trigger('click')
    await settle()
    expect(fake.callsTo('POST /media/albums')[0]!.body).toEqual({
      title: 'Teatro de noviembre',
      description: '',
    })
    expect(wrapper.get('.album').text()).toContain('Teatro de noviembre')
    expect(wrapper.get('.album').text()).toContain(
      'Sube fotos o videos para publicarlo.',
    )
  })

  it('etiqueta a una persona de la foto y avisa si no tiene permiso de imagen', async () => {
    const fake = fakeApi()
    const patient = {
      id: 'p-7',
      name: 'Celia Flores',
      imageConsent: false,
    } as PatientSummary
    fake.on('GET /patients', {
      body: { items: [patient], total: 1, limit: 6, offset: 0 },
    })
    fake.on('PUT /media/assets/as-2/tags', {
      body: asset({
        id: 'as-2',
        tags: [{ patientId: 'p-7', name: 'Celia Flores', imageConsent: false }],
      }),
    })
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { wrapper } = await mountApp(`${PATH}?album=a-1`, fake)

    await wrapper.findAll('.thumb')[1]!.trigger('click')
    await settle()
    await body().get('#buscar-persona').setValue('celia')
    await vi.advanceTimersByTimeAsync(350)
    await settle()
    expect(fake.callsTo('GET /patients')[0]!.query.get('search')).toBe('celia')
    await body().get('.result').trigger('click')
    await settle()
    expect(body().text()).toContain(
      'Celia Flores no tiene permiso de imagen en su ficha.',
    )
    await button('Guardar personas').trigger('click')
    await settle()
    expect(fake.callsTo('PUT /media/assets/as-2/tags')[0]!.body).toEqual({
      patientIds: ['p-7'],
    })
    vi.useRealTimers()
  })

  it('quita una foto del álbum y elimina un álbum privado, con confirmación', async () => {
    const fake = fakeApi()
    fake.on('DELETE /media/assets/as-2', { body: { message: 'ok' } })
    fake.on('DELETE /media/albums/a-1', { body: { message: 'ok' } })
    const { wrapper } = await mountApp(`${PATH}?album=a-1`, fake)

    await wrapper.findAll('.thumb')[1]!.trigger('click')
    await settle()
    await button('Quitar la foto del álbum…').trigger('click')
    await settle()
    await button('Quitar la foto').trigger('click')
    await settle()
    expect(fake.callsTo('DELETE /media/assets/as-2')).toHaveLength(1)

    await button('Eliminar el álbum…', wrapper.get('.album')).trigger('click')
    await settle()
    await button('Eliminar el álbum').trigger('click')
    await settle()
    expect(fake.callsTo('DELETE /media/albums/a-1')).toHaveLength(1)
    expect(wrapper.find('.album').exists()).toBe(false)
  })

  it('sin permiso de galería no entra a la pantalla', async () => {
    const fake = fakeApi({ body: VOLUNTEER_SESSION })
    const { router } = await mountApp(PATH, fake)
    expect(router.currentRoute.value.name).toBe('resumen')
  })
})

describe('Textos y archivos de la galería', () => {
  it('formatos, tamaños, miniaturas y cantidades', () => {
    expect(fileProblem(file('a.jpg', 'image/jpeg'))).toBeNull()
    expect(fileProblem(file('a.gif', 'image/gif'))).toContain('no es JPG')
    expect(fileProblem(file('a.png', 'image/png', 11 * 1024 * 1024))).toContain(
      'pesa más de 10 MB',
    )
    expect(fileProblem(file('a.mp4', 'video/mp4', 50 * 1024 * 1024))).toBeNull()
    expect(
      thumbnailUrl(
        'https://res.cloudinary.com/d/video/upload/v1/a.mp4',
        'video',
      ),
    ).toBe('https://res.cloudinary.com/d/video/upload/so_0,w_400/v1/a.jpg')
    expect(assetCountLabel(24, 0)).toBe('24 fotos')
    expect(assetCountLabel(3, 1)).toBe('3 fotos y 1 video')
    expect(assetCountLabel(0, 0)).toBe('Sin fotos todavía')
  })
})
