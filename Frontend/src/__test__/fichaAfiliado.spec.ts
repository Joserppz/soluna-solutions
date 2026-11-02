import { DOMWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  ContactOut,
  EvaluationOut,
  PatientAttendancePage,
  PatientDocument,
  PatientOut,
} from '../api/types'
import { forgetPatientsList } from '../composables/usePatientsListLocation'
import { useToast } from '../composables/useToast'
import { todayIso } from '../utils/format'
import { DUPLICATE_CI_MESSAGE } from '../utils/patients'
import {
  ADMIN_SESSION,
  DASHBOARD,
  VOLUNTEER_SESSION,
  createApiFake,
  mountApp,
  sessionFor,
  settle,
  type ApiFake,
} from './apiFake'

const RECEPTION_SESSION = sessionFor(
  { name: 'Patricia Mendoza', role: 'reception', roleName: 'Recepción' },
  ['patients:read', 'patients:write', 'documents:upload'],
)

const URL = '/equipo/afiliados/p-1'

const CONTACT: ContactOut = {
  id: 'c-1',
  name: 'Rosa Gutiérrez',
  relation: 'Hija',
  phone: '76559012',
  altPhone: null,
  isPrimary: true,
}

function patient(overrides: Partial<PatientOut> = {}): PatientOut {
  return {
    id: 'p-1',
    name: 'Alba Gutiérrez Mamani',
    ci: '4821557',
    birthDate: '1958-05-12',
    phone: '70123344',
    address: 'Calle Díaz Romero 1234',
    zone: 'Miraflores',
    consent: true,
    consentDate: '2024-03-18',
    imageConsent: true,
    accessStatus: 'Activo',
    anamnesis: {
      diagnosis: 'Enfermedad de Parkinson',
      stage: 'Estadio I (Leve unilateral)',
      neurologistCertificate: true,
      symptomNotes: 'Temblor leve en la mano derecha.',
      medications: 'Levodopa 250 mg',
    },
    clinicalAccess: true,
    contacts: [CONTACT],
    active: true,
    deactivationReason: null,
    createdAt: '2024-03-18T14:00:00Z',
    updatedAt: '2026-10-28T13:58:00Z',
    ...overrides,
  }
}

function evaluation(overrides: Partial<EvaluationOut> = {}): EvaluationOut {
  return {
    id: 'e-1',
    patientId: 'p-1',
    area: 'fisica',
    areaLabel: 'Física',
    evaluatedOn: '2026-10-14',
    notes: 'Mejor equilibrio al levantarse de la silla.',
    professionalId: 'u-2',
    professionalName: 'Lic. Ana Flores',
    createdAt: '2026-10-14T14:00:00Z',
    updatedAt: '2026-10-14T14:00:00Z',
    ...overrides,
  }
}

const EVALUATIONS = [
  evaluation({
    id: 'e-2',
    area: 'psicologica',
    areaLabel: 'Psicológica',
    evaluatedOn: '2026-08-20',
    notes: 'Ánimo estable.',
    professionalName: 'Lic. Carmen Ríos',
  }),
  evaluation(),
]

const ATTENDANCE: PatientAttendancePage = {
  items: [
    {
      scheduleId: 's-1',
      title: 'Movimiento en compañía',
      category: 'fisioterapia',
      categoryLabel: 'Fisioterapia',
      date: '2026-10-24',
      status: 'vino',
      note: 'Vino con su hija',
    },
    {
      scheduleId: 's-2',
      title: 'Teatro y expresión',
      category: 'teatro',
      categoryLabel: 'Teatro',
      date: '2026-10-17',
      status: 'no_vino',
      note: '',
    },
  ],
  total: 12,
  limit: 10,
  offset: 0,
  quarterLabel: 'octubre a diciembre de 2026',
  quarterStart: '2026-10-01',
  saturdaysHeld: 12,
  saturdaysAttended: 11,
}

const DOCUMENT: PatientDocument = {
  id: 'd-1',
  patientId: 'p-1',
  documentType: 'CI',
  fileName: 'carnet.pdf',
  contentType: 'application/pdf',
  sizeBytes: 250_000,
  uploadedAt: '2024-03-18T14:00:00Z',
}

function fakeApi(session = ADMIN_SESSION, value: PatientOut = patient()) {
  return createApiFake({
    'GET /auth/me': { body: session },
    'GET /dashboard/summary': { body: DASHBOARD },
    'GET /patients': {
      body: { items: [], total: 0, limit: 10, offset: 0 },
    },
    'GET /patients/summary': {
      body: {
        all: 0,
        active: 0,
        consentPending: 0,
        inactive: 0,
        activities: [],
      },
    },
    'GET /patients/p-1': { body: value },
    'GET /patients/p-1/evaluations': { body: EVALUATIONS },
    'GET /patients/p-1/attendance': { body: ATTENDANCE },
    'GET /patients/p-1/documents': { body: [DOCUMENT] },
    'GET /patients/p-1/contacts': { body: value.contacts },
  })
}

function body() {
  return new DOMWrapper(document.body)
}

function field(
  label: string,
  root: Omit<DOMWrapper<Element>, 'exists'> = body(),
) {
  const found = root
    .findAll('.field')
    .find((f) => f.get('label').text().replace('*', '').trim() === label)
  if (!found) throw new Error(`No hay un campo «${label}»`)
  return found.get('input, select, textarea')
}

function button(
  text: string,
  root: Omit<DOMWrapper<Element>, 'exists'> = body(),
) {
  const found = root
    .findAll('button')
    .find((b) => b.text().replace(/\s+/g, ' ').trim() === text)
  if (!found) throw new Error(`No hay un botón «${text}»`)
  return found
}

function hasButton(
  text: string,
  root: Omit<DOMWrapper<Element>, 'exists'> = body(),
) {
  return root
    .findAll('button')
    .some((b) => b.text().replace(/\s+/g, ' ').trim() === text)
}

async function openTab(name: string) {
  const tab = body()
    .findAll('[role="tab"]')
    .find((t) => t.text().startsWith(name))!
  await tab.trigger('click')
  await settle()
}

function panel() {
  return body().get('[role="tabpanel"]')
}

function toasts() {
  return useToast().toasts.value.map((toast) => toast.message)
}

beforeEach(() => {
  vi.stubGlobal(
    'confirm',
    vi.fn(() => true),
  )
})

afterEach(() => {
  document.body.innerHTML = ''
  document.body.style.overflow = ''
  useToast().clear()
  forgetPatientsList()
  vi.unstubAllGlobals()
})

describe('Encabezado de la ficha', () => {
  it('muestra quién es, su consentimiento y su estado', async () => {
    const fake = fakeApi()
    const { wrapper } = await mountApp(URL, fake)

    expect(wrapper.get('.record h1').text()).toBe('Alba Gutiérrez Mamani')
    const age =
      Number(todayIso().slice(0, 4)) -
      1958 -
      (todayIso().slice(5) < '05-12' ? 1 : 0)
    expect(wrapper.get('.record__meta').text()).toBe(
      `Carnet 4\u202f821\u202f557 · ${age} años · En ASPAR desde marzo 2024`,
    )
    expect(wrapper.get('.record__consent').text()).toBe(
      'Consentimiento firmado el 18 de marzo de 2024 · Uso de imagen: autorizado',
    )
    expect(wrapper.get('.record__badges').text()).toContain('Activo')
    expect(wrapper.get('.record__badges').text()).toContain(
      'Consentimiento firmado',
    )
    // Migas de pan con el nombre y el menú marcando Afiliados
    expect(wrapper.get('.breadcrumb').text()).toContain('Alba Gutiérrez Mamani')
    expect(wrapper.get('.nav-item.is-active').text()).toBe('Afiliados')
    expect(
      wrapper
        .findAll('[role="tab"]')
        .map((tab) => tab.text().replace(/\s+/g, ' ')),
    ).toEqual([
      'Datos',
      'Historia clínica',
      'Evaluaciones 2',
      'Asistencia',
      'Documentos',
    ])
  })

  it('sin consentimiento ni fecha de nacimiento lo dice sin inventar datos', async () => {
    const fake = fakeApi(
      ADMIN_SESSION,
      patient({
        consent: false,
        consentDate: null,
        birthDate: null,
        accessStatus: 'Pendiente',
        clinicalAccess: false,
        imageConsent: false,
      }),
    )
    const { wrapper } = await mountApp(URL, fake)

    expect(wrapper.get('.record__meta').text()).toBe(
      'Carnet 4\u202f821\u202f557 · En ASPAR desde marzo 2024',
    )
    expect(wrapper.get('.record__consent').text()).toBe(
      'Sin consentimiento firmado todavía.',
    )
    expect(wrapper.get('.record__badges').text()).toContain(
      'Consentimiento pendiente',
    )
    // Sin acceso clínico no se piden las evaluaciones
    expect(fake.callsTo('GET /patients/p-1/evaluations')).toHaveLength(0)
  })

  it('si la ficha no existe, lo explica y ofrece volver al listado', async () => {
    const fake = fakeApi()
    fake.on('GET /patients/p-1', {
      status: 404,
      body: { detail: 'Afiliado no encontrado.' },
    })
    const { wrapper, router } = await mountApp(URL, fake)

    expect(wrapper.get('h1').text()).toBe('No encontramos esta ficha.')
    expect(hasButton('Reintentar')).toBe(false)
    await wrapper.get('.record__missing a').trigger('click')
    await settle()
    expect(router.currentRoute.value.name).toBe('afiliados')
  })

  it('si falla la conexión, permite reintentar', async () => {
    const fake = fakeApi()
    fake.on('GET /patients/p-1', [{ status: 0 }, { body: patient() }])
    const { wrapper } = await mountApp(URL, fake)

    expect(wrapper.get('h1').text()).toBe('No pudimos abrir la ficha.')
    expect(wrapper.text()).toContain('No pudimos conectar con el servidor')
    await button('Reintentar').trigger('click')
    await settle()
    expect(wrapper.get('.record h1').text()).toBe('Alba Gutiérrez Mamani')
  })

  it('«Afiliados» vuelve al listado con la misma búsqueda', async () => {
    const fake = fakeApi()
    const { wrapper, router } = await mountApp(
      '/equipo/afiliados?pestana=activos',
      fake,
    )
    await router.push(URL)
    await settle()

    await wrapper.get('.record__back').trigger('click')
    await settle()
    expect(router.currentRoute.value.fullPath).toBe(
      '/equipo/afiliados?pestana=activos',
    )
  })

  it('si se entró directo a la ficha, «Afiliados» abre el listado', async () => {
    const fake = fakeApi()
    const { wrapper, router } = await mountApp(URL, fake)

    await wrapper.get('.record__back').trigger('click')
    await settle()
    expect(router.currentRoute.value.fullPath).toBe('/equipo/afiliados')
  })

  it('cada pestaña queda en la dirección', async () => {
    const fake = fakeApi()
    const { router } = await mountApp(`${URL}?seccion=asistencia`, fake)

    expect(panel().text()).toContain('Este trimestre')
    await openTab('Documentos')
    expect(router.currentRoute.value.query).toEqual({ seccion: 'documentos' })
    await openTab('Datos')
    expect(router.currentRoute.value.query).toEqual({})
  })
})

describe('Pestaña Datos', () => {
  it('guarda los datos personales y el consentimiento juntos', async () => {
    const fake = fakeApi()
    fake.on('PATCH /patients/p-1', (call) => ({
      body: patient({ ...(call.body as Partial<PatientOut>) }),
    }))
    const { wrapper } = await mountApp(URL, fake)

    expect(wrapper.get('.savebar').text()).toContain('Último cambio:')
    expect(button('Guardar ficha').attributes('disabled')).toBeDefined()
    await field('Teléfono').setValue('7012 9988')
    await field('Zona').setValue(' Sopocachi ')
    await body().findAll('.consent .checkbox input')[1]!.setValue(false)
    expect(wrapper.get('.savebar').text()).toContain('Hay cambios sin guardar.')
    await wrapper.get('#ficha-datos').trigger('submit')
    await settle()

    expect(fake.callsTo('PATCH /patients/p-1')[0]!.body).toEqual({
      name: 'Alba Gutiérrez Mamani',
      ci: '4821557',
      birthDate: '1958-05-12',
      phone: '70129988',
      zone: 'Sopocachi',
      address: 'Calle Díaz Romero 1234',
      consent: true,
      consentDate: '2024-03-18',
      imageConsent: false,
      accessStatus: 'Activo',
    })
    expect(toasts()).toContain('Guardamos los cambios de la ficha.')
    expect(wrapper.get('.savebar').text()).toContain('Último cambio:')
  })

  it('una fecha ya guardada no impide guardar otros cambios', async () => {
    // La API guardó la firma con la fecha de mañana (de noche en Bolivia ya es otro día en UTC)
    const fake = fakeApi(ADMIN_SESSION, patient({ consentDate: '2999-01-01' }))
    fake.on('PATCH /patients/p-1', { body: patient() })
    const { wrapper } = await mountApp(URL, fake)

    await field('Zona').setValue('Obrajes')
    await wrapper.get('#ficha-datos').trigger('submit')
    await settle()
    expect(fake.callsTo('PATCH /patients/p-1')).toHaveLength(1)

    // Pero si la persona escribe una fecha futura, se le avisa
    await field('Fecha de la firma').setValue('2999-02-01')
    await wrapper.get('#ficha-datos').trigger('submit')
    await settle()
    expect(panel().text()).toContain('La fecha no puede ser posterior a hoy.')
    expect(fake.callsTo('PATCH /patients/p-1')).toHaveLength(1)
  })

  it('cancelar vuelve a lo guardado', async () => {
    const fake = fakeApi()
    const { wrapper } = await mountApp(URL, fake)

    await field('Zona').setValue('Obrajes')
    await button('Cancelar', wrapper.find('.savebar')).trigger('click')

    expect((field('Zona').element as HTMLInputElement).value).toBe('Miraflores')
    expect(fake.callsTo('PATCH /patients/p-1')).toHaveLength(0)
  })

  it('valida antes de guardar y explica el carnet repetido', async () => {
    const fake = fakeApi()
    fake.on('PATCH /patients/p-1', {
      status: 409,
      body: {
        detail: 'Ya existe un afiliado registrado con esa Cédula de Identidad.',
      },
    })
    const { wrapper } = await mountApp(URL, fake)

    await field('Nombre completo').setValue('Al')
    await field('Carnet').setValue('12')
    await wrapper.get('#ficha-datos').trigger('submit')
    await settle()
    expect(panel().text()).toContain('al menos 3 letras')
    expect(panel().text()).toContain('El carnet lleva de 5 a 10 números')
    expect(document.activeElement).toBe(field('Nombre completo').element)
    expect(fake.callsTo('PATCH /patients/p-1')).toHaveLength(0)

    await field('Nombre completo').setValue('Alba Gutiérrez')
    await field('Carnet').setValue('5208773')
    await wrapper.get('#ficha-datos').trigger('submit')
    await settle()
    expect(panel().text()).toContain(DUPLICATE_CI_MESSAGE)
  })

  it('otros errores de la API aparecen arriba del formulario', async () => {
    const fake = fakeApi()
    fake.on('PATCH /patients/p-1', {
      status: 422,
      body: {
        detail: 'El teléfono debe contener entre 7 y 12 dígitos numéricos.',
      },
    })
    const { wrapper } = await mountApp(URL, fake)

    await field('Zona').setValue('Obrajes')
    await wrapper.get('#ficha-datos').trigger('submit')
    await settle()
    expect(panel().get('[role="alert"]').text()).toContain(
      'entre 7 y 12 dígitos',
    )
  })

  it('al quitar la firma, la historia clínica deja de estar habilitada', async () => {
    const fake = fakeApi()
    fake.on('PATCH /patients/p-1', { body: patient() })
    const { wrapper } = await mountApp(URL, fake)

    await body().findAll('.consent .checkbox input')[0]!.setValue(false)
    expect(panel().text()).toContain(
      'Sin la firma nadie ve su historia clínica',
    )
    await wrapper.get('#ficha-datos').trigger('submit')
    await settle()

    expect(fake.callsTo('PATCH /patients/p-1')[0]!.body).toMatchObject({
      consent: false,
      consentDate: null,
      imageConsent: false,
      accessStatus: 'Pendiente',
    })
  })

  it('al marcar la firma, habilita la historia clínica con la fecha de hoy', async () => {
    const fake = fakeApi(
      ADMIN_SESSION,
      patient({
        consent: false,
        consentDate: null,
        imageConsent: false,
        accessStatus: 'Pendiente',
        clinicalAccess: false,
      }),
    )
    fake.on('PATCH /patients/p-1', { body: patient() })
    const { wrapper } = await mountApp(URL, fake)

    expect(wrapper.find('.card--pending').exists()).toBe(true)
    await body().findAll('.consent .checkbox input')[0]!.setValue(true)
    expect((field('Historia clínica').element as HTMLSelectElement).value).toBe(
      'Activo',
    )
    await field('Fecha de la firma').setValue('')
    await wrapper.get('#ficha-datos').trigger('submit')
    await settle()
    expect(panel().text()).toContain('Indica la fecha en que se firmó.')

    await field('Fecha de la firma').setValue(todayIso())
    await field('Historia clínica').setValue('Revocado')
    await wrapper.get('#ficha-datos').trigger('submit')
    await settle()
    expect(fake.callsTo('PATCH /patients/p-1')[0]!.body).toMatchObject({
      consent: true,
      consentDate: todayIso(),
      accessStatus: 'Revocado',
    })
    // Ahora la ficha tiene acceso clínico: se cargan sus evaluaciones
    expect(fake.callsTo('GET /patients/p-1/evaluations')).toHaveLength(1)
  })

  it('muestra la asistencia del trimestre y lleva al historial', async () => {
    const fake = fakeApi()
    const { router } = await mountApp(URL, fake)

    expect(panel().text()).toContain('11 de 12 sábados este trimestre')
    await button('Ver el historial').trigger('click')
    await settle()
    expect(router.currentRoute.value.query).toEqual({ seccion: 'asistencia' })
  })

  it('el Voluntariado ve los datos sin poder editarlos', async () => {
    const fake = fakeApi(VOLUNTEER_SESSION, patient({ clinicalAccess: false }))
    const { wrapper } = await mountApp(URL, fake)

    expect(field('Nombre completo').attributes('disabled')).toBeUndefined()
    expect(
      wrapper
        .findAll('.data fieldset')
        .every((f) => f.attributes('disabled') !== undefined),
    ).toBe(true)
    expect(wrapper.find('.savebar').exists()).toBe(false)
    expect(hasButton('+ Añadir otro')).toBe(false)
    expect(hasButton('Marcar como inactiva…')).toBe(false)
  })

  it('pregunta antes de salir con cambios sin guardar', async () => {
    const fake = fakeApi()
    const { router } = await mountApp(URL, fake)
    const confirm = vi.fn(() => false)
    vi.stubGlobal('confirm', confirm)

    await field('Zona').setValue('Obrajes')
    await router.push('/equipo')
    await settle()
    expect(confirm).toHaveBeenCalledOnce()
    expect(router.currentRoute.value.fullPath).toBe(URL)

    confirm.mockReturnValue(true)
    await router.push('/equipo')
    await settle()
    expect(router.currentRoute.value.fullPath).toBe('/equipo')
  })

  it('pregunta antes de cambiar de pestaña con cambios sin guardar', async () => {
    const fake = fakeApi()
    const { router } = await mountApp(URL, fake)
    const confirm = vi.fn(() => false)
    vi.stubGlobal('confirm', confirm)

    await field('Zona').setValue('Obrajes')
    await openTab('Asistencia')
    expect(confirm).toHaveBeenCalledOnce()
    expect(panel().text()).toContain('Datos personales')

    confirm.mockReturnValue(true)
    await openTab('Asistencia')
    expect(router.currentRoute.value.query).toEqual({ seccion: 'asistencia' })
    // Los cambios se descartaron: salir ya no pregunta
    await router.push('/equipo')
    await settle()
    expect(confirm).toHaveBeenCalledTimes(2)
    expect(router.currentRoute.value.fullPath).toBe('/equipo')
  })
})

describe('Familiares o personas cuidadoras', () => {
  const OTHER: ContactOut = {
    id: 'c-2',
    name: 'Mario Gutiérrez',
    relation: 'Hijo',
    phone: '70011223',
    altPhone: null,
    isPrimary: false,
  }

  it('agrega un contacto y vuelve a leer la lista', async () => {
    const fake = fakeApi()
    fake.on('POST /patients/p-1/contacts', { status: 201, body: OTHER })
    fake.on('GET /patients/p-1/contacts', { body: [CONTACT, OTHER] })
    const { wrapper } = await mountApp(URL, fake)
    const card = () => wrapper.get('.contacts')

    expect(hasButton('Quitar', card())).toBe(false)
    await button('+ Añadir otro').trigger('click')
    await settle()
    expect(document.activeElement).toBe(
      field('Nombre completo', card()).element,
    )
    await button('Agregar contacto').trigger('click')
    expect(card().text()).toContain('Elige la relación con la persona.')

    await field('Nombre completo', card()).setValue(' Mario Gutiérrez ')
    await field('Relación', card()).setValue('Hijo')
    await field('Teléfono', card()).setValue('7001 1223')
    await button('Agregar contacto').trigger('click')
    await settle()

    expect(fake.callsTo('POST /patients/p-1/contacts')[0]!.body).toEqual({
      name: 'Mario Gutiérrez',
      relation: 'Hijo',
      phone: '70011223',
    })
    expect(card().text()).toContain('Mario Gutiérrez')
    expect(toasts()).toContain('Agregamos a Mario Gutiérrez como contacto.')
    expect(hasButton('Quitar', card())).toBe(true)
  })

  it('edita, cambia el principal y quita con confirmación', async () => {
    const fake = fakeApi(ADMIN_SESSION, patient({ contacts: [CONTACT, OTHER] }))
    fake.on('PATCH /patients/p-1/contacts/c-2', { body: OTHER })
    fake.on('DELETE /patients/p-1/contacts/c-2', {
      body: { message: 'Contacto quitado.' },
    })
    const { wrapper } = await mountApp(URL, fake)
    const card = () => wrapper.get('.contacts')

    await card().get('[aria-label="Editar a Mario Gutiérrez"]').trigger('click')
    await field('Teléfono', card()).setValue('71234567')
    await button('Guardar contacto').trigger('click')
    await settle()
    expect(fake.callsTo('PATCH /patients/p-1/contacts/c-2')[0]!.body).toEqual({
      name: 'Mario Gutiérrez',
      relation: 'Hijo',
      phone: '71234567',
    })

    await button('Hacer principal').trigger('click')
    await settle()
    expect(fake.callsTo('PATCH /patients/p-1/contacts/c-2')[1]!.body).toEqual({
      isPrimary: true,
    })
    expect(toasts()).toContain(
      'Mario Gutiérrez es ahora el contacto principal.',
    )

    await card().get('[aria-label="Quitar a Mario Gutiérrez"]').trigger('click')
    await settle()
    expect(body().get('[role="dialog"]').text()).toContain(
      '¿Quitar este contacto?',
    )
    await button('Quitar contacto').trigger('click')
    await settle()
    expect(fake.callsTo('DELETE /patients/p-1/contacts/c-2')).toHaveLength(1)
  })

  it('si la API rechaza el cambio, lo explica y se puede cancelar', async () => {
    const fake = fakeApi(ADMIN_SESSION, patient({ contacts: [CONTACT, OTHER] }))
    fake.on('DELETE /patients/p-1/contacts/c-2', {
      status: 409,
      body: { detail: 'Toda ficha necesita al menos un contacto de apoyo.' },
    })
    const { wrapper } = await mountApp(URL, fake)
    const card = () => wrapper.get('.contacts')

    await card().get('[aria-label="Quitar a Mario Gutiérrez"]').trigger('click')
    await settle()
    await button('Quitar contacto').trigger('click')
    await settle()
    expect(card().get('[role="alert"]').text()).toContain(
      'al menos un contacto de apoyo',
    )

    await card().get('[aria-label="Editar a Rosa Gutiérrez"]').trigger('click')
    await button('Cancelar', card()).trigger('click')
    expect(card().find('.contact-edit').exists()).toBe(false)
  })
})

describe('Historia clínica (RNF-06)', () => {
  it('el personal clínico edita diagnóstico, síntomas y medicación', async () => {
    const fake = fakeApi()
    fake.on('PATCH /patients/p-1', (call) => ({
      body: patient({
        anamnesis: {
          ...patient().anamnesis,
          ...(call.body as { anamnesis: object }).anamnesis,
        },
      }),
    }))
    await mountApp(`${URL}?seccion=historia`, fake)

    expect((field('Medicación').element as HTMLTextAreaElement).value).toBe(
      'Levodopa 250 mg',
    )
    await field('Diagnóstico').setValue('Enfermedad de Parkinson idiopática')
    await field('Medicación').setValue('Levodopa 250 mg cada 8 horas')
    await body().get('.history__certificate input').setValue(false)
    await body().get('.history').trigger('submit')
    await settle()

    expect(fake.callsTo('PATCH /patients/p-1')[0]!.body).toEqual({
      anamnesis: {
        diagnosis: 'Enfermedad de Parkinson idiopática',
        neurologistCertificate: false,
        medications: 'Levodopa 250 mg cada 8 horas',
      },
    })
    expect(toasts()).toContain('Guardamos la historia clínica.')
  })

  it('quien no es personal clínico no puede tocar síntomas ni medicación', async () => {
    const coordinator = sessionFor({ role: 'coordination' }, [
      'patients:read',
      'patients:write',
      'patients:read_clinical',
    ])
    const fake = fakeApi(coordinator)
    fake.on('PATCH /patients/p-1', { status: 500, body: { detail: 'Falló.' } })
    await mountApp(`${URL}?seccion=historia`, fake)

    expect(panel().text()).toContain('Solo los registra el personal clínico.')
    expect(field('Medicación').element.closest('fieldset')!.disabled).toBe(true)
    await field('Diagnóstico').setValue('Parkinsonismo')
    await button('Cancelar', panel()).trigger('click')
    expect((field('Diagnóstico').element as HTMLInputElement).value).toBe(
      'Enfermedad de Parkinson',
    )
    await field('Diagnóstico').setValue('Parkinsonismo')
    await body().get('.history').trigger('submit')
    await settle()
    expect(panel().get('[role="alert"]').text()).toContain('Falló.')
  })

  it.each([
    [VOLUNTEER_SESSION, {}, 'Solo el personal clínico ve la historia clínica'],
    [
      ADMIN_SESSION,
      { consent: false },
      'Falta el consentimiento informado firmado',
    ],
    [
      ADMIN_SESSION,
      { accessStatus: 'Revocado' },
      'La familia suspendió el acceso',
    ],
    [
      ADMIN_SESSION,
      { accessStatus: 'Pendiente' },
      'todavía no está habilitado',
    ],
  ])(
    'sin acceso explica el motivo real (%#)',
    async (session, change, message) => {
      const fake = fakeApi(
        session,
        patient({ ...change, clinicalAccess: false }),
      )
      await mountApp(URL, fake)

      for (const tab of ['Historia clínica', 'Evaluaciones', 'Documentos']) {
        await openTab(tab)
        expect(panel().text()).toContain('Información protegida')
        expect(panel().text()).toContain(message)
      }
      expect(fake.callsTo('GET /patients/p-1/evaluations')).toHaveLength(0)
      expect(fake.callsTo('GET /patients/p-1/documents')).toHaveLength(0)
    },
  )
})

describe('Evaluaciones de seguimiento', () => {
  it('lista de la más reciente a la más antigua y filtra por área', async () => {
    const fake = fakeApi()
    await mountApp(`${URL}?seccion=evaluaciones`, fake)

    const rows = panel().findAll('.evaluation')
    expect(rows.map((row) => row.get('strong').text())).toEqual([
      'Física',
      'Psicológica',
    ])
    expect(rows[0]!.text()).toContain('14 oct 2026')
    expect(rows[0]!.text()).toContain('Lic. Ana Flores')

    await button('Psicológica 1').trigger('click')
    expect(panel().findAll('.evaluation')).toHaveLength(1)
    await button('Fonoaudiológica 0').trigger('click')
    expect(panel().text()).toContain(
      'Todavía no hay evaluaciones fonoaudiológicas.',
    )
  })

  it('registra una evaluación nueva desde el modal', async () => {
    const fake = fakeApi()
    const created = evaluation({
      id: 'e-3',
      area: 'fonoaudiologica',
      areaLabel: 'Fonoaudiológica',
      evaluatedOn: todayIso(),
      notes: 'Voz con buen volumen.',
    })
    fake.on('POST /patients/p-1/evaluations', { status: 201, body: created })
    const { wrapper } = await mountApp(`${URL}?seccion=evaluaciones`, fake)

    await button('+ Nueva evaluación').trigger('click')
    await settle()
    const dialog = () => body().get('[role="dialog"]')
    expect(dialog().text()).toContain('Nueva evaluación')
    expect(dialog().text()).toContain('queda a tu nombre (Lucía Choque)')
    await field('Fecha', dialog()).setValue('2999-01-01')
    await field('Profesional que evaluó', dialog()).setValue('Li')
    await body().get('#evaluacion').trigger('submit')
    await settle()
    expect(dialog().text()).toContain('La fecha no puede ser posterior a hoy.')
    expect(dialog().text()).toContain(
      'Escribe el nombre completo del profesional.',
    )
    expect(dialog().text()).toContain('Escribe las observaciones.')

    await field('Área', dialog()).setValue('fonoaudiologica')
    await field('Fecha', dialog()).setValue(todayIso())
    await field('Profesional que evaluó', dialog()).setValue('')
    await field('Observaciones', dialog()).setValue(' Voz con buen volumen. ')
    await body().get('#evaluacion').trigger('submit')
    await settle()

    expect(fake.callsTo('POST /patients/p-1/evaluations')[0]!.body).toEqual({
      area: 'fonoaudiologica',
      evaluatedOn: todayIso(),
      notes: 'Voz con buen volumen.',
      professionalName: null,
    })
    expect(body().find('[role="dialog"]').exists()).toBe(false)
    expect(panel().findAll('.evaluation')).toHaveLength(3)
    expect(wrapper.findAll('[role="tab"]')[2]!.text()).toContain('3')
    expect(toasts()).toContain('Registramos la evaluación.')
  })

  it('«Ver» muestra el detalle y el personal clínico puede corregirlo', async () => {
    const fake = fakeApi()
    fake.on('PATCH /patients/p-1/evaluations/e-1', {
      body: evaluation({ notes: 'Equilibrio mucho mejor.' }),
    })
    await mountApp(`${URL}?seccion=evaluaciones`, fake)

    await body()
      .get('[aria-label="Ver la evaluación física del 14 oct 2026"]')
      .trigger('click')
    await settle()
    const dialog = () => body().get('[role="dialog"]')
    expect(dialog().text()).toContain('Evaluación física')
    expect(dialog().text()).toContain('14 de octubre de 2026')
    expect(dialog().text()).toContain('Mejor equilibrio al levantarse')

    await button('Corregir').trigger('click')
    await field('Observaciones', dialog()).setValue('Equilibrio mucho mejor.')
    await body().get('#evaluacion').trigger('submit')
    await settle()
    expect(
      fake.callsTo('PATCH /patients/p-1/evaluations/e-1')[0]!.body,
    ).toEqual({
      notes: 'Equilibrio mucho mejor.',
    })
    expect(dialog().text()).toContain('Equilibrio mucho mejor.')
    expect(toasts()).toContain('Guardamos la corrección.')
    await button('Cerrar').trigger('click')
    expect(body().find('[role="dialog"]').exists()).toBe(false)
  })

  it('sin permiso clínico de escritura solo se consultan', async () => {
    const reader = sessionFor({ role: 'coordination' }, [
      'patients:read',
      'patients:read_clinical',
    ])
    const fake = fakeApi(reader)
    fake.on('POST /patients/p-1/evaluations', {
      status: 500,
      body: { detail: 'x' },
    })
    await mountApp(`${URL}?seccion=evaluaciones`, fake)

    expect(hasButton('+ Nueva evaluación')).toBe(false)
    await button('Ver', panel()).trigger('click')
    await settle()
    expect(hasButton('Corregir')).toBe(false)
  })

  it('si no cargan, permite reintentar', async () => {
    const fake = fakeApi()
    fake.on('GET /patients/p-1/evaluations', [
      { status: 500, body: { detail: 'Servidor caído.' } },
      { status: 500, body: { detail: 'Servidor caído.' } },
      { body: EVALUATIONS },
    ])
    await mountApp(`${URL}?seccion=evaluaciones`, fake)

    expect(panel().get('[role="alert"]').text()).toContain('Servidor caído.')
    await button('Reintentar', panel()).trigger('click')
    await settle()
    expect(panel().findAll('.evaluation')).toHaveLength(2)
  })

  it('un error al guardar queda en el modal', async () => {
    const fake = fakeApi()
    fake.on('POST /patients/p-1/evaluations', {
      status: 403,
      body: { detail: 'Las evaluaciones de esta ficha no están disponibles.' },
    })
    await mountApp(`${URL}?seccion=evaluaciones`, fake)

    await button('+ Nueva evaluación').trigger('click')
    await settle()
    await field('Observaciones', body().get('[role="dialog"]')).setValue(
      'Notas',
    )
    await body().get('#evaluacion').trigger('submit')
    await settle()
    expect(body().get('[role="dialog"] [role="alert"]').text()).toContain(
      'no están disponibles',
    )
    await button('Cancelar', body().get('[role="dialog"]')).trigger('click')
    expect(body().find('[role="dialog"]').exists()).toBe(false)
  })
})

describe('Asistencia del afiliado', () => {
  it('muestra los sábados del trimestre y el historial paginado', async () => {
    const fake = fakeApi()
    await mountApp(`${URL}?seccion=asistencia`, fake)

    expect(panel().text()).toContain('11 de 12 sábados')
    expect(panel().text()).toContain(
      'Sábados con actividades publicadas de octubre a diciembre de 2026.',
    )
    const rows = panel().findAll('tbody tr')
    expect(rows[0]!.text()).toContain('24 oct 2026')
    expect(rows[0]!.text()).toContain('Movimiento en compañía')
    expect(rows[0]!.text()).toContain('Vino')
    expect(rows[0]!.text()).toContain('Vino con su hija')
    expect(rows[1]!.text()).toContain('No vino')

    await button('2', panel()).trigger('click')
    await settle()
    expect(
      fake.callsTo('GET /patients/p-1/attendance').at(-1)!.query.get('offset'),
    ).toBe('10')
  })

  it('sin asistencias lo dice, y un error se puede reintentar', async () => {
    const fake = fakeApi()
    fake.on('GET /patients/p-1/attendance', [
      { status: 500, body: { detail: 'Servidor caído.' } },
      {
        body: {
          ...ATTENDANCE,
          items: [],
          total: 0,
          saturdaysAttended: 0,
          saturdaysHeld: 1,
        },
      },
    ])
    await mountApp(`${URL}?seccion=asistencia`, fake)

    expect(panel().get('[role="alert"]').text()).toContain('Servidor caído.')
    await button('Reintentar', panel()).trigger('click')
    await settle()
    expect(panel().text()).toContain('0 de 1 sábado')
    expect(panel().text()).toContain('Todavía no hay asistencias registradas')
  })
})

describe('Documentos privados', () => {
  async function chooseFile(file: File) {
    const input = body().get('input[type="file"]')
    Object.defineProperty(input.element, 'files', {
      value: [file],
      configurable: true,
    })
    await input.trigger('change')
  }

  it('lista los documentos y los abre con un enlace temporal', async () => {
    const fake = fakeApi()
    fake.on('GET /patients/p-1/documents/d-1/url', {
      body: { url: 'https://almacen.test/firmado', expiresIn: 300 },
    })
    const tab = { opener: {}, location: { href: '' }, close: vi.fn() }
    const open = vi.fn(() => tab)
    vi.stubGlobal('open', open)
    await mountApp(`${URL}?seccion=documentos`, fake)

    expect(panel().text()).toContain('Copia de carnet')
    expect(panel().text()).toContain(
      'carnet.pdf · Subido el 18 mar 2024 · 244 KB',
    )
    expect(panel().text()).toContain('vence en 5 minutos')
    await button('Abrir', panel()).trigger('click')
    await settle()

    expect(open).toHaveBeenCalledWith('', '_blank')
    expect(tab.opener).toBeNull()
    expect(tab.location.href).toBe('https://almacen.test/firmado')
  })

  it('si el enlace falla, cierra la pestaña y lo explica', async () => {
    const fake = fakeApi()
    fake.on('GET /patients/p-1/documents/d-1/url', {
      status: 503,
      body: { detail: 'El almacenamiento de documentos no está configurado.' },
    })
    const tab = { opener: {}, location: { href: '' }, close: vi.fn() }
    vi.stubGlobal(
      'open',
      vi.fn(() => tab),
    )
    await mountApp(`${URL}?seccion=documentos`, fake)

    await button('Abrir', panel()).trigger('click')
    await settle()
    expect(tab.close).toHaveBeenCalled()
    expect(panel().get('[role="alert"]').text()).toContain(
      'no está configurado',
    )
  })

  it('sube un documento después de revisar el archivo', async () => {
    const fake = fakeApi()
    fake.on('POST /patients/p-1/documents', {
      status: 201,
      body: { ...DOCUMENT, id: 'd-2', documentType: 'Certificado neurológico' },
    })
    await mountApp(`${URL}?seccion=documentos`, fake)

    await button('Subir documento').trigger('click')
    await settle()
    expect(panel().text()).toContain('Elige el archivo que quieres subir.')
    await chooseFile(new File(['x'], 'nota.txt', { type: 'text/plain' }))
    expect(panel().text()).toContain('Solo se aceptan archivos PDF')
    await chooseFile(
      new File([new Uint8Array(11 * 1024 * 1024)], 'grande.pdf', {
        type: 'application/pdf',
      }),
    )
    expect(panel().text()).toContain('supera el máximo de 10 MB')
    await chooseFile(new File([], 'vacio.pdf', { type: 'application/pdf' }))
    expect(panel().text()).toContain('El archivo está vacío.')

    await field('Tipo de documento').setValue('Certificado neurológico')
    await chooseFile(
      new File(['%PDF'], 'certificado.pdf', { type: 'application/pdf' }),
    )
    await button('Subir documento').trigger('click')
    await settle()

    const sent = fake.callsTo('POST /patients/p-1/documents')[0]!
      .body as FormData
    expect(sent.get('documentType')).toBe('Certificado neurológico')
    expect((sent.get('file') as File).name).toBe('certificado.pdf')
    expect(panel().findAll('.document')).toHaveLength(2)
    expect(toasts()).toContain('Subimos «Certificado neurológico» a la ficha.')
  })

  it('un error al subir se muestra en el formulario', async () => {
    const fake = fakeApi()
    fake.on('POST /patients/p-1/documents', {
      status: 503,
      body: { detail: 'El almacenamiento de documentos no está configurado.' },
    })
    await mountApp(`${URL}?seccion=documentos`, fake)

    await chooseFile(new File(['%PDF'], 'c.pdf', { type: 'application/pdf' }))
    await button('Subir documento').trigger('click')
    await settle()
    expect(panel().get('.documents__upload [role="alert"]').text()).toContain(
      'no está configurado',
    )
  })

  it('quita un documento con confirmación', async () => {
    const fake = fakeApi()
    fake.on('DELETE /patients/p-1/documents/d-1', {
      body: { message: 'Documento eliminado.' },
    })
    await mountApp(`${URL}?seccion=documentos`, fake)

    await body().get('[aria-label="Quitar Copia de carnet"]').trigger('click')
    await settle()
    await button('Quitar documento').trigger('click')
    await settle()
    expect(fake.callsTo('DELETE /patients/p-1/documents/d-1')).toHaveLength(1)
    expect(panel().text()).toContain('Todavía no hay documentos en esta ficha.')
  })

  it('Recepción sube documentos aunque no los vea', async () => {
    const fake = fakeApi(RECEPTION_SESSION, patient({ clinicalAccess: false }))
    await mountApp(`${URL}?seccion=documentos`, fake)

    expect(panel().text()).toContain('Información protegida')
    expect(panel().text()).toContain('Puedes subirlo aunque no lo veas')
    expect(hasButton('Subir documento')).toBe(true)
    expect(fake.callsTo('GET /patients/p-1/documents')).toHaveLength(0)
  })

  it('si la lista no carga, lo explica', async () => {
    const fake = fakeApi()
    fake.on('GET /patients/p-1/documents', {
      status: 500,
      body: { detail: 'Servidor caído.' },
    })
    await mountApp(`${URL}?seccion=documentos`, fake)
    expect(panel().get('[role="alert"]').text()).toContain('Servidor caído.')
  })
})

describe('Baja lógica y reactivación', () => {
  async function deactivate(fake: ApiFake) {
    const mounted = await mountApp(URL, fake)
    await button('Marcar como inactiva…').trigger('click')
    await settle()
    return mounted
  }

  it('dar de baja pide el motivo y no borra nada', async () => {
    const fake = fakeApi()
    fake.on('POST /patients/p-1/deactivate', {
      body: patient({
        active: false,
        deactivationReason: 'Se mudó a Cochabamba',
      }),
    })
    const { wrapper } = await deactivate(fake)
    const dialog = () => body().get('[role="dialog"]')

    expect(dialog().text()).toContain(
      'Sus datos, evaluaciones y documentos se conservan.',
    )
    await body().get('#estado-ficha').trigger('submit')
    await settle()
    expect(dialog().text()).toContain('Escribe el motivo (al menos 3 letras).')
    expect(fake.callsTo('POST /patients/p-1/deactivate')).toHaveLength(0)

    await field('Motivo', dialog()).setValue('  Se mudó a Cochabamba ')
    await body().get('#estado-ficha').trigger('submit')
    await settle()

    expect(fake.callsTo('POST /patients/p-1/deactivate')[0]!.body).toEqual({
      reason: 'Se mudó a Cochabamba',
    })
    expect(wrapper.get('.record__inactive').text()).toContain(
      'Motivo: Se mudó a Cochabamba.',
    )
    expect(wrapper.get('.record__badges').text()).toContain('Inactivo')
    // Una ficha inactiva no se edita hasta reactivarla
    expect(wrapper.find('.savebar').exists()).toBe(false)
    expect(toasts()).toContain(
      'La ficha de Alba Gutiérrez Mamani quedó inactiva. Nada se borró.',
    )
  })

  it('reactivar también pide el motivo', async () => {
    const fake = fakeApi(
      ADMIN_SESSION,
      patient({ active: false, deactivationReason: 'Se mudó' }),
    )
    fake.on('POST /patients/p-1/reactivate', [
      { status: 409, body: { detail: 'La ficha ya está activa.' } },
      { body: patient() },
    ])
    const { wrapper } = await mountApp(URL, fake)

    expect(hasButton('Marcar como inactiva…')).toBe(false)
    await button('Reactivar ficha…').trigger('click')
    await settle()
    const dialog = () => body().get('[role="dialog"]')
    await field('Motivo', dialog()).setValue('Volvió a los talleres')
    await body().get('#estado-ficha').trigger('submit')
    await settle()
    expect(dialog().get('[role="alert"]').text()).toContain('ya está activa')

    await body().get('#estado-ficha').trigger('submit')
    await settle()
    expect(fake.callsTo('POST /patients/p-1/reactivate')[1]!.body).toEqual({
      reason: 'Volvió a los talleres',
    })
    expect(wrapper.find('.record__inactive').exists()).toBe(false)
    expect(wrapper.find('.savebar').exists()).toBe(true)
  })

  it('cancelar no cambia nada', async () => {
    const fake = fakeApi()
    await deactivate(fake)
    await button('Cancelar', body().get('[role="dialog"]')).trigger('click')
    expect(body().find('[role="dialog"]').exists()).toBe(false)
    expect(fake.callsTo('POST /patients/p-1/deactivate')).toHaveLength(0)
  })
})
