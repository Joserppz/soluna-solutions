import { DOMWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'

import type {
  PatientCounts,
  PatientOut,
  PatientPage,
  PatientSummary,
} from '../api/types'
import { useToast } from '../composables/useToast'
import { todayIso } from '../utils/format'
import { DUPLICATE_CI_MESSAGE } from '../utils/patients'
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

afterEach(() => {
  document.body.innerHTML = ''
  document.body.style.overflow = ''
  useToast().clear()
})

function summary(overrides: Partial<PatientSummary> = {}): PatientSummary {
  return {
    id: 'p-1',
    name: 'Alba Gutiérrez Mamani',
    ci: '4821557',
    phone: '70123344',
    zone: 'Miraflores',
    consent: true,
    imageConsent: true,
    accessStatus: 'Activo',
    primaryContact: {
      id: 'c-1',
      name: 'Rosa Gutiérrez',
      relation: 'Hija',
      phone: '76559012',
      altPhone: null,
      isPrimary: true,
    },
    activities: [
      { category: 'fisioterapia', label: 'Fisioterapia' },
      { category: 'arteterapia', label: 'Arteterapia' },
      { category: 'teatro', label: 'Teatro' },
    ],
    active: true,
    createdAt: '2024-03-18T14:00:00Z',
    updatedAt: '2026-10-14T14:00:00Z',
    ...overrides,
  }
}

const COUNTS: PatientCounts = {
  all: 25,
  active: 22,
  consentPending: 2,
  inactive: 3,
  activities: [
    { category: 'fisioterapia', label: 'Fisioterapia', patients: 14 },
    { category: 'teatro', label: 'Teatro', patients: 6 },
  ],
}

/** Listado de 25 fichas, paginado según limit y offset. */
function pageFor(call: RecordedCall): { body: PatientPage } {
  const limit = Number(call.query.get('limit') ?? 50)
  const offset = Number(call.query.get('offset') ?? 0)
  const all = Array.from({ length: 25 }, (_, index) =>
    index === 0
      ? summary()
      : summary({
          id: `p-${index + 1}`,
          name: `Afiliado Número ${index + 1}`,
          ci: String(5000000 + index),
          activities: [],
        }),
  )
  return {
    body: {
      items: all.slice(offset, offset + limit),
      total: 25,
      limit,
      offset,
    },
  }
}

function fakeApi(session = ADMIN_SESSION) {
  return createApiFake({
    'GET /auth/me': { body: session },
    'GET /dashboard/summary': { body: DASHBOARD },
    'GET /patients': pageFor,
    'GET /patients/summary': { body: COUNTS },
  })
}

function lastQuery(fake: ApiFake, key: string) {
  const calls = fake.callsTo(key)
  return Object.fromEntries(calls[calls.length - 1]!.query)
}

/** El modal se dibuja en <body> (Teleport). */
function body() {
  return new DOMWrapper(document.body)
}

function field(label: string, root: DOMWrapper<Element> = body()) {
  const found = root
    .findAll('.field')
    .find((f) => f.get('label').text().replace('*', '').trim() === label)
  if (!found) throw new Error(`No hay un campo «${label}»`)
  return found.get('input, select')
}

function button(text: string, root: DOMWrapper<Element> = body()) {
  const found = root
    .findAll('button')
    .find((b) => b.text().replace(/\s+/g, ' ').trim() === text)
  if (!found) throw new Error(`No hay un botón «${text}»`)
  return found
}

describe('Listado de afiliados', () => {
  it('muestra los contadores y cada ficha con su contacto, actividades y estados', async () => {
    const fake = fakeApi()
    const { wrapper } = await mountApp('/equipo/afiliados', fake)

    expect(wrapper.get('h1').text()).toBe('Afiliados')
    const tabs = wrapper.findAll('[role="tab"]')
    expect(tabs.map((tab) => tab.text().replace(/\s+/g, ' '))).toEqual([
      'Todos 25',
      'Activos 22',
      'Consentimiento pendiente 2',
      'Inactivos 3',
    ])
    expect(tabs[0]!.attributes('aria-selected')).toBe('true')

    const first = wrapper.findAll('tbody tr')[0]!
    expect(first.text()).toContain('AM')
    expect(first.text()).toContain('Desde marzo 2024')
    expect(first.text()).toContain('4 821 557')
    expect(first.text()).toContain('Rosa Gutiérrez · hija')
    expect(first.text()).toContain('Fisioterapia, Arteterapia y 1 más')
    expect(first.text()).toContain('Activo')
    expect(first.text()).toContain('Firmado')
    expect(first.get('a').attributes('href')).toBe('/equipo/afiliados/p-1')
    expect(first.get('a').attributes('aria-label')).toBe(
      'Abrir la ficha de Alba Gutiérrez Mamani',
    )
    expect(wrapper.findAll('tbody tr')[1]!.text()).toContain(
      'Sin asistencias recientes',
    )
    expect(wrapper.text()).toContain('Mostrando 1–10 de 25')
    expect(lastQuery(fake, 'GET /patients')).toEqual({
      group: 'all',
      order: 'name',
      limit: '10',
      offset: '0',
    })
    expect(
      wrapper.findAll('#filtro-actividad option').map((o) => o.text()),
    ).toEqual(['Todas las actividades', 'Fisioterapia (14)', 'Teatro (6)'])
  })

  it('muestra fichas inactivas y sin consentimiento con sus etiquetas', async () => {
    const fake = fakeApi()
    fake.on('GET /patients', {
      body: {
        items: [
          summary({ active: false, consent: false, primaryContact: null }),
        ],
        total: 1,
        limit: 10,
        offset: 0,
      },
    })
    const { wrapper } = await mountApp('/equipo/afiliados', fake)

    const row = wrapper.get('tbody tr')
    expect(row.text()).toContain('Inactivo')
    expect(row.text()).toContain('Pendiente')
    expect(row.text()).toContain('Sin contacto')
    expect(wrapper.text()).toContain('Mostrando 1–1 de 1')
    expect(
      wrapper.find('nav[aria-label="Páginas de afiliados"]').exists(),
    ).toBe(false)
  })

  it('cada pestaña pide su grupo, vuelve a la página 1 y queda en la dirección', async () => {
    const fake = fakeApi()
    const { wrapper, router } = await mountApp('/equipo/afiliados', fake)

    await wrapper.get('[aria-label="Página 2"]').trigger('click')
    await settle()
    expect(lastQuery(fake, 'GET /patients').offset).toBe('10')
    expect(router.currentRoute.value.query).toEqual({ pagina: '2' })

    const before = fake.callsTo('GET /patients').length
    await wrapper.findAll('[role="tab"]')[3]!.trigger('click')
    await settle()

    expect(fake.callsTo('GET /patients')).toHaveLength(before + 1)
    expect(lastQuery(fake, 'GET /patients')).toMatchObject({
      group: 'inactive',
      offset: '0',
    })
    expect(router.currentRoute.value.query).toEqual({ pestana: 'inactivos' })
    expect(wrapper.get('[role="tabpanel"]').attributes('aria-labelledby')).toBe(
      'afiliados-tab-inactive',
    )
  })

  it('las flechas del teclado cambian de pestaña', async () => {
    const fake = fakeApi()
    const { wrapper } = await mountApp('/equipo/afiliados', fake)
    const list = wrapper.get('[role="tablist"]')

    await list.trigger('keydown', { key: 'ArrowLeft' })
    await settle()
    expect(lastQuery(fake, 'GET /patients').group).toBe('inactive')
    expect(document.activeElement?.id).toBe('afiliados-tab-inactive')

    await list.trigger('keydown', { key: 'ArrowRight' })
    await settle()
    expect(lastQuery(fake, 'GET /patients').group).toBe('all')

    await list.trigger('keydown', { key: 'End' })
    await list.trigger('keydown', { key: 'Home' })
    await list.trigger('keydown', { key: 'Enter' })
    await settle()
    expect(lastQuery(fake, 'GET /patients').group).toBe('all')
  })

  it('busca por nombre o carnet, filtra por actividad y ordena', async () => {
    const fake = fakeApi()
    const { wrapper, router } = await mountApp('/equipo/afiliados', fake)

    // Un carnet copiado con espacios se busca solo con sus números
    await wrapper.get('#buscar-afiliado').setValue(' 4 821 557 ')
    await wrapper.get('form[role="search"]').trigger('submit')
    await settle()
    expect(lastQuery(fake, 'GET /patients').search).toBe('4821557')
    expect(lastQuery(fake, 'GET /patients/summary')).toEqual({
      search: '4821557',
    })

    await wrapper.get('#filtro-actividad').setValue('teatro')
    await settle()
    expect(lastQuery(fake, 'GET /patients').activity).toBe('teatro')
    expect(lastQuery(fake, 'GET /patients/summary').activity).toBe('teatro')
    expect(wrapper.text()).toContain(
      'al menos una vez en los últimos seis meses',
    )

    await wrapper.get('#orden-afiliados').setValue('recent')
    await settle()
    expect(lastQuery(fake, 'GET /patients').order).toBe('recent')
    expect(router.currentRoute.value.query).toEqual({
      buscar: '4821557',
      actividad: 'teatro',
      orden: 'recientes',
    })
  })

  it('espera a que se termine de escribir para buscar', async () => {
    const fake = fakeApi()
    const { wrapper } = await mountApp('/equipo/afiliados', fake)
    const before = fake.callsTo('GET /patients').length

    await wrapper.get('#buscar-afiliado').setValue('Alb')
    await wrapper.get('#buscar-afiliado').setValue('Alba')
    await settle()
    expect(fake.callsTo('GET /patients')).toHaveLength(before)

    await new Promise((resolve) => setTimeout(resolve, 350))
    await settle()
    expect(fake.callsTo('GET /patients')).toHaveLength(before + 1)
    expect(lastQuery(fake, 'GET /patients').search).toBe('Alba')
  })

  it('al volver a la página se recuperan la pestaña, la búsqueda y la página', async () => {
    const fake = fakeApi()
    const { wrapper } = await mountApp(
      '/equipo/afiliados?pestana=consentimiento-pendiente&buscar=Ana&actividad=teatro&orden=nombre-za&pagina=2',
      fake,
    )

    expect(fake.callsTo('GET /patients')).toHaveLength(1)
    expect(lastQuery(fake, 'GET /patients')).toEqual({
      search: 'Ana',
      activity: 'teatro',
      group: 'consent_pending',
      order: '-name',
      limit: '10',
      offset: '10',
    })
    expect(
      (wrapper.get('#buscar-afiliado').element as HTMLInputElement).value,
    ).toBe('Ana')
    expect(wrapper.get('.page[aria-current="page"]').text()).toBe('2')
  })

  it('si la página pedida ya no existe, muestra la última', async () => {
    const fake = fakeApi()
    const { wrapper } = await mountApp('/equipo/afiliados?pagina=9', fake)

    expect(
      fake.callsTo('GET /patients').map((c) => c.query.get('offset')),
    ).toEqual(['80', '20'])
    expect(wrapper.text()).toContain('Mostrando 21–25 de 25')
    await wrapper.get('[aria-label="Página siguiente"]').trigger('click')
    await wrapper.get('[aria-label="Página anterior"]').trigger('click')
    await settle()
    expect(lastQuery(fake, 'GET /patients').offset).toBe('10')
  })

  it('sin resultados lo explica y permite quitar la búsqueda', async () => {
    const fake = fakeApi()
    fake.on('GET /patients', (call) =>
      call.query.get('search')
        ? { body: { items: [], total: 0, limit: 10, offset: 0 } }
        : pageFor(call),
    )
    const { wrapper } = await mountApp('/equipo/afiliados?buscar=Zoila', fake)

    expect(wrapper.text()).toContain(
      'No encontramos afiliados con «Zoila». Revisa el nombre o el carnet.',
    )
    expect(wrapper.text()).toContain('Sin resultados')
    await button(
      'Quitar la búsqueda y el filtro',
      wrapper.find('.patients'),
    ).trigger('click')
    await settle()

    expect(lastQuery(fake, 'GET /patients').search).toBeUndefined()
    expect(wrapper.findAll('tbody tr')).toHaveLength(10)
  })

  it.each([
    ['inactivos', 'Ninguna ficha está inactiva.'],
    ['activos', 'No hay fichas activas.'],
    [
      'consentimiento-pendiente',
      'Todas las fichas activas tienen el consentimiento firmado.',
    ],
    ['todos', 'Todavía no hay afiliados registrados.'],
  ])('la pestaña %s vacía lo dice con sus palabras', async (tab, message) => {
    const fake = fakeApi()
    fake.on('GET /patients', {
      body: { items: [], total: 0, limit: 10, offset: 0 },
    })
    const { wrapper } = await mountApp(`/equipo/afiliados?pestana=${tab}`, fake)

    expect(wrapper.get('tbody').text()).toBe(message)
  })

  it('con un filtro de actividad vacío, explica el período', async () => {
    const fake = fakeApi()
    fake.on('GET /patients', {
      body: { items: [], total: 0, limit: 10, offset: 0 },
    })
    const { wrapper } = await mountApp(
      '/equipo/afiliados?actividad=teatro',
      fake,
    )

    expect(wrapper.get('tbody').text()).toContain(
      'Nadie de esta pestaña vino a esa actividad en los últimos seis meses.',
    )

    await wrapper.get('#buscar-afiliado').setValue('Ana')
    await wrapper.get('form[role="search"]').trigger('submit')
    await settle()
    expect(wrapper.get('tbody').text()).toContain(
      'Nadie con «Ana» vino a esa actividad en los últimos seis meses.',
    )
  })

  it('si la API falla, lo dice y permite reintentar', async () => {
    const fake = fakeApi()
    fake.on('GET /patients', [
      { status: 500, body: { detail: 'Ocurrió un problema en el servidor.' } },
      { status: 0 },
      { body: { items: [summary()], total: 1, limit: 10, offset: 0 } },
    ])
    const { wrapper } = await mountApp('/equipo/afiliados', fake)

    expect(wrapper.get('.patients [role="alert"]').text()).toContain(
      'Ocurrió un problema en el servidor.',
    )
    await button('Reintentar', wrapper.find('.patients')).trigger('click')
    await settle()
    expect(wrapper.get('.patients [role="alert"]').text()).toContain(
      'No pudimos conectar con el servidor',
    )
    await button('Reintentar', wrapper.find('.patients')).trigger('click')
    await settle()

    expect(wrapper.find('.patients [role="alert"]').exists()).toBe(false)
    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
  })

  it('una respuesta que llega tarde no pisa la búsqueda más nueva', async () => {
    const fake = fakeApi()
    let release: () => void = () => {}
    fake.on('GET /patients', async (call) => {
      if (call.query.get('search') === 'lenta')
        await new Promise<void>((resolve) => (release = resolve))
      return {
        body: {
          items: [summary({ name: `Resultado ${call.query.get('search')}` })],
          total: 1,
          limit: 10,
          offset: 0,
        },
      }
    })
    const { wrapper } = await mountApp('/equipo/afiliados', fake)

    await wrapper.get('#buscar-afiliado').setValue('lenta')
    await wrapper.get('form[role="search"]').trigger('submit')
    await settle()
    await wrapper.get('#buscar-afiliado').setValue('rápida')
    await wrapper.get('form[role="search"]').trigger('submit')
    await settle()
    release()
    await settle()

    expect(wrapper.get('tbody').text()).toContain('Resultado rápida')
  })

  it('el Voluntariado consulta el listado, pero no registra fichas', async () => {
    const fake = fakeApi(VOLUNTEER_SESSION)
    const { wrapper } = await mountApp('/equipo/afiliados', fake)

    expect(wrapper.findAll('tbody tr')).toHaveLength(10)
    expect(wrapper.text()).not.toContain('Registrar afiliado')
  })

  it('«Abrir ficha» lleva a la ficha y el menú sigue marcando Afiliados', async () => {
    const fake = fakeApi()
    const { wrapper, router } = await mountApp('/equipo/afiliados', fake)

    await wrapper.get('tbody a').trigger('click')
    await settle()

    expect(router.currentRoute.value.name).toBe('afiliado')
    expect(router.currentRoute.value.params.id).toBe('p-1')
    expect(wrapper.get('.nav-item.is-active').text()).toBe('Afiliados')
  })
})

describe('Registrar afiliado', () => {
  const created: PatientOut = {
    id: 'nuevo-1',
    name: 'Fausto Rojas Calle',
    ci: '5208773',
    birthDate: '1955-06-12',
    phone: '77712345',
    address: 'Calle 3, San Pedro',
    zone: 'San Pedro',
    consent: true,
    consentDate: todayIso(),
    imageConsent: true,
    accessStatus: 'Activo',
    anamnesis: {
      diagnosis: '',
      stage: '',
      neurologistCertificate: false,
      symptomNotes: '',
      medications: '',
    },
    clinicalAccess: false,
    contacts: [],
    active: true,
    deactivationReason: null,
    createdAt: '2026-11-01T14:00:00Z',
    updatedAt: '2026-11-01T14:00:00Z',
  }

  async function openForm(fake: ApiFake) {
    const mounted = await mountApp('/equipo/afiliados', fake)
    await button('+ Registrar afiliado').trigger('click')
    await settle()
    return mounted
  }

  async function submit() {
    await body().get('#registrar-afiliado').trigger('submit')
    await settle()
  }

  async function fillPerson() {
    await field('Nombre completo').setValue('Fausto Rojas Calle')
    await field('Carnet').setValue('5.208.773')
    await field('Fecha de nacimiento').setValue('1955-06-12')
    await field('Teléfono').setValue('7771 2345')
    await field('Zona').setValue('San Pedro')
    await field('Dirección').setValue(' Calle 3, San Pedro ')
  }

  async function fillContact(index: number, name: string, relation: string) {
    const contact = body().findAll('.register__contact')[index]!
    await field('Nombre completo', contact).setValue(name)
    await field('Relación', contact).setValue(relation)
    await field('Teléfono', contact).setValue('70011223')
  }

  it('sin datos no envía nada y marca cada campo obligatorio', async () => {
    const fake = fakeApi()
    fake.on('POST /patients', { status: 201, body: created })
    await openForm(fake)

    expect(body().get('[role="dialog"]').text()).toContain('Registrar afiliado')
    await submit()

    const text = body().get('[role="dialog"]').text()
    expect(text).toContain('Escribe el nombre completo (al menos 3 letras).')
    expect(text).toContain('Escribe el número de carnet.')
    expect(text).toContain('Escribe un número de teléfono.')
    expect(text).toContain('Elige la relación con la persona.')
    expect(fake.callsTo('POST /patients')).toHaveLength(0)
    expect(document.activeElement).toBe(field('Nombre completo').element)
  })

  it('revisa el formato del carnet, el teléfono y que las fechas no sean futuras', async () => {
    const fake = fakeApi()
    await openForm(fake)

    await field('Carnet').setValue('12AB')
    await field('Teléfono').setValue('70-12')
    await field('Fecha de nacimiento').setValue('2999-01-01')
    await body().findAll('.checkbox input')[0]!.setValue(true)
    await field('Fecha de la firma').setValue('')
    await submit()

    const text = body().get('[role="dialog"]').text()
    expect(text).toContain('El carnet lleva de 5 a 10 números')
    expect(text).toContain('El teléfono lleva de 7 a 12 números')
    expect(text).toContain('La fecha no puede ser posterior a hoy.')
    expect(text).toContain('Indica la fecha en que se firmó.')
  })

  it('registra la ficha con el consentimiento y sus contactos, y abre la ficha', async () => {
    const fake = fakeApi()
    fake.on('POST /patients', { status: 201, body: created })
    const { router } = await openForm(fake)

    await fillPerson()
    await body().findAll('.checkbox input')[0]!.setValue(true)
    await body().findAll('.checkbox input')[1]!.setValue(true)
    await fillContact(0, 'Ana Rojas', 'Nieta')
    await button('+ Añadir otro').trigger('click')
    await fillContact(1, 'Luis Rojas', 'Hijo')
    await submit()

    expect(fake.callsTo('POST /patients')[0]!.body).toEqual({
      name: 'Fausto Rojas Calle',
      ci: '5208773',
      birthDate: '1955-06-12',
      phone: '77712345',
      zone: 'San Pedro',
      address: 'Calle 3, San Pedro',
      consent: true,
      consentDate: todayIso(),
      imageConsent: true,
      accessStatus: 'Activo',
      contacts: [
        {
          name: 'Ana Rojas',
          relation: 'Nieta',
          phone: '70011223',
          isPrimary: true,
        },
        {
          name: 'Luis Rojas',
          relation: 'Hijo',
          phone: '70011223',
          isPrimary: false,
        },
      ],
    })
    expect(router.currentRoute.value.fullPath).toBe('/equipo/afiliados/nuevo-1')
    expect(useToast().toasts.value[0]?.message).toBe(
      'Registramos a Fausto Rojas Calle. Ya puedes completar su ficha.',
    )
    expect(body().find('[role="dialog"]').exists()).toBe(false)
  })

  it('sin consentimiento, la ficha queda pendiente y sin uso de imagen', async () => {
    const fake = fakeApi()
    fake.on('POST /patients', { status: 201, body: created })
    await openForm(fake)

    await fillPerson()
    await field('Fecha de nacimiento').setValue('')
    expect(body().text()).toContain('nadie ve su historia clínica')
    await fillContact(0, 'Ana Rojas', 'Nieta')
    await submit()

    expect(fake.callsTo('POST /patients')[0]!.body).toMatchObject({
      birthDate: null,
      consent: false,
      consentDate: null,
      imageConsent: false,
      accessStatus: 'Pendiente',
    })
  })

  it('admite hasta cinco contactos y siempre deja al menos uno', async () => {
    const fake = fakeApi()
    await openForm(fake)

    expect(body().findAll('.register__contact')).toHaveLength(1)
    expect(body().text()).not.toContain('Quitar')
    for (let i = 0; i < 4; i += 1)
      await button('+ Añadir otro').trigger('click')

    expect(body().findAll('.register__contact')).toHaveLength(5)
    expect(body().text()).not.toContain('+ Añadir otro')
    expect(body().text()).toContain('Contacto 5')
    await body()
      .findAll('.register__contact')[0]!
      .get('button')
      .trigger('click')
    expect(body().findAll('.register__contact')).toHaveLength(4)
    expect(body().findAll('.register__contact')[0]!.text()).toContain(
      'Contacto principal',
    )
  })

  it('si el carnet ya existe lo explica y permite buscarlo en el listado', async () => {
    const fake = fakeApi()
    fake.on('POST /patients', {
      status: 409,
      body: {
        detail: 'Ya existe un afiliado registrado con esa Cédula de Identidad.',
      },
    })
    await openForm(fake)

    await fillPerson()
    await fillContact(0, 'Ana Rojas', 'Nieta')
    await submit()

    expect(body().get('[role="dialog"]').text()).toContain(DUPLICATE_CI_MESSAGE)
    expect(document.activeElement).toBe(field('Carnet').element)
    // Si se corrige el carnet, el aviso se va
    await field('Carnet').setValue('5208774')
    expect(body().get('[role="dialog"]').text()).not.toContain(
      DUPLICATE_CI_MESSAGE,
    )
    await field('Carnet').setValue('5208773')

    await button('Buscar el carnet 5208773 en el listado').trigger('click')
    await settle()

    expect(body().find('[role="dialog"]').exists()).toBe(false)
    expect(lastQuery(fake, 'GET /patients')).toMatchObject({
      search: '5208773',
      group: 'all',
    })
  })

  it('otros errores de la API se muestran arriba del formulario', async () => {
    const fake = fakeApi()
    fake.on('POST /patients', [
      {
        status: 422,
        body: {
          detail: 'El teléfono debe contener entre 7 y 12 dígitos numéricos.',
        },
      },
    ])
    await openForm(fake)
    await fillPerson()
    await fillContact(0, 'Ana Rojas', 'Nieta')
    await submit()

    expect(body().get('[role="dialog"] [role="alert"]').text()).toContain(
      'El teléfono debe contener entre 7 y 12 dígitos numéricos.',
    )
    await button('Cancelar').trigger('click')
    await settle()
    expect(body().find('[role="dialog"]').exists()).toBe(false)

    // Al abrirlo de nuevo, el formulario empieza vacío
    await button('+ Registrar afiliado').trigger('click')
    await settle()
    expect((field('Nombre completo').element as HTMLInputElement).value).toBe(
      '',
    )
    expect(body().find('[role="dialog"] [role="alert"]').exists()).toBe(false)
  })

  it('sin conexión pide intentar de nuevo', async () => {
    const fake = fakeApi()
    fake.on('POST /patients', { status: 0 })
    await openForm(fake)
    await fillPerson()
    await fillContact(0, 'Ana Rojas', 'Nieta')
    await submit()

    expect(body().get('[role="dialog"] [role="alert"]').text()).toContain(
      'No pudimos conectar con el servidor',
    )
  })
})
