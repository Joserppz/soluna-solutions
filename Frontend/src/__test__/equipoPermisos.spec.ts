import { DOMWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { RoleMatrix, UserOut, UserPage } from '../api/types'
import { useToast } from '../composables/useToast'
import {
  ADMIN_SESSION,
  ALL_PERMISSIONS,
  DASHBOARD,
  VOLUNTEER_SESSION,
  createApiFake,
  mountApp,
  sessionFor,
  settle,
  type ApiFake,
  type FakeReply,
  type RecordedCall,
} from './apiFake'

const PATH = '/equipo/administracion/equipo'

afterEach(() => {
  document.body.innerHTML = ''
  document.body.style.overflow = ''
  useToast().clear()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function member(overrides: Partial<UserOut> = {}): UserOut {
  return {
    id: 'u-2',
    name: 'René Vargas',
    email: 'coordinacion@aspar.org',
    role: 'coordination',
    roleName: 'Coordinación',
    department: 'General',
    active: true,
    emailVerified: true,
    mustChangePassword: false,
    lastLoginAt: null,
    createdAt: '2026-10-01T14:00:00Z',
    ...overrides,
  }
}

const ADMIN = member({
  id: 'u-1',
  name: 'Lucía Choque',
  email: 'lucia@aspar.org',
  role: 'admin',
  roleName: 'Administración',
  department: 'Dirección',
})
const PROFESSIONAL = member({
  id: 'u-3',
  name: 'Lic. Ana Flores',
  email: 'ana.flores@aspar.org',
  role: 'professional',
  roleName: 'Profesional',
  department: 'Fisioterapia',
})
const INACTIVE = member({
  id: 'u-4',
  name: 'Carla Torrico',
  email: 'carla@aspar.org',
  role: 'volunteer',
  roleName: 'Voluntariado',
  active: false,
})
const PENDING = member({
  id: 'u-5',
  name: 'Gabriela Rocha',
  email: 'gabriela@gmail.com',
  role: null,
  roleName: 'Pendiente de aprobación',
})
const UNVERIFIED = member({
  id: 'u-6',
  name: 'Marina Registro',
  email: 'marina@gmail.com',
  role: null,
  roleName: 'Pendiente de aprobación',
  emailVerified: false,
})

const TEAM = [ADMIN, member(), PROFESSIONAL, INACTIVE, PENDING]

function page(items: UserOut[], call?: RecordedCall): { body: UserPage } {
  const limit = Number(call?.query.get('limit') ?? 50)
  const offset = Number(call?.query.get('offset') ?? 0)
  return {
    body: {
      items: items.slice(offset, offset + limit),
      total: items.length,
      limit,
      offset,
    },
  }
}

const PERMISSIONS: RoleMatrix['permissions'] = [
  [
    'attendance:write',
    'Tomar y cerrar la asistencia de las actividades',
    false,
  ],
  ['audit:read', 'Consultar el registro de actividad', true],
  ['content:manage', 'Editar y publicar el contenido del sitio', false],
  ['documents:delete', 'Eliminar documentos privados', true],
  ['documents:upload', 'Subir documentos privados a una ficha', false],
  ['patients:read', 'Ver afiliados y sus datos de contacto', false],
  [
    'patients:read_clinical',
    'Ver historia clínica, evaluaciones y documentos privados',
    true,
  ],
  [
    'patients:write',
    'Registrar y editar fichas (filiación y consentimiento)',
    false,
  ],
  [
    'users:manage',
    'Gestionar el equipo, aprobar cuentas y asignar roles',
    true,
  ],
].map(([key, description, isSensitive]) => ({
  key: key as RoleMatrix['permissions'][number]['key'],
  description: description as string,
  isSensitive: isSensitive as boolean,
}))

function matrix(adminMembers = 2): RoleMatrix {
  const role = (
    key: string,
    name: string,
    permissions: RoleMatrix['roles'][number]['permissions'],
    members: number,
  ) => ({
    key,
    name,
    description: `Descripción de ${name}`,
    isSystem: key === 'admin',
    permissions,
    members,
  })
  // Desordenados a propósito: la vista los ordena como el diseño
  return {
    permissions: PERMISSIONS,
    roles: [
      role(
        'volunteer',
        'Voluntariado',
        ['patients:read', 'attendance:write'],
        7,
      ),
      role(
        'admin',
        'Administración',
        PERMISSIONS.map((item) => item.key),
        adminMembers,
      ),
      role(
        'coordination',
        'Coordinación',
        ['patients:read', 'patients:write', 'content:manage'],
        1,
      ),
      role(
        'professional',
        'Profesional',
        ['patients:read', 'patients:read_clinical'],
        3,
      ),
      role('reception', 'Recepción', ['patients:read', 'patients:write'], 2),
    ],
  }
}

function fakeApi(
  options: {
    session?: FakeReply
    roles?: RoleMatrix
  } = {},
) {
  return createApiFake({
    'GET /auth/me': options.session ?? { body: ADMIN_SESSION },
    'GET /dashboard/summary': { body: DASHBOARD },
    'GET /users': (call) =>
      call.query.get('role') === 'pendiente'
        ? page([PENDING, UNVERIFIED], call)
        : page(TEAM, call),
    'GET /roles': { body: options.roles ?? matrix() },
  })
}

function lastQuery(fake: ApiFake, key: string) {
  const calls = fake.callsTo(key)
  return Object.fromEntries(calls[calls.length - 1]!.query)
}

function teamQueries(fake: ApiFake) {
  return fake
    .callsTo('GET /users')
    .filter((call) => call.query.get('role') !== 'pendiente')
    .map((call) => Object.fromEntries(call.query))
}

/** Los modales se dibujan en <body> (Teleport). */
function body() {
  return new DOMWrapper(document.body)
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

function field(
  label: string,
  root: Omit<DOMWrapper<Element>, 'exists'> = body(),
) {
  const found = root
    .findAll('.field')
    .find((f) => f.get('label').text().replace('*', '').trim() === label)
  if (!found) throw new Error(`No hay un campo «${label}»`)
  return found.get('input, select')
}

function rowOf(name: string) {
  const row = body()
    .findAll('tbody tr')
    .find((r) => r.text().includes(name))
  if (!row) throw new Error(`No hay una fila de «${name}»`)
  return row
}

function modal() {
  return body().get('[role="dialog"]')
}

function cell(roleName: string, description: string) {
  return body().get<HTMLInputElement>(
    `input[aria-label="${roleName}: ${description}"]`,
  )
}

describe('Equipo', () => {
  it('lista a cada persona con su rol, último ingreso, estado y acción', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-28T16:00:00Z'))
    const fake = fakeApi()
    fake.on('GET /users', (call) =>
      call.query.get('role') === 'pendiente'
        ? page([PENDING, UNVERIFIED], call)
        : page(
            [
              { ...ADMIN, lastLoginAt: '2026-10-28T12:55:00Z' },
              ...TEAM.slice(1),
            ],
            call,
          ),
    )
    const { wrapper } = await mountApp(PATH, fake)
    vi.useRealTimers()

    expect(wrapper.get('h1').text()).toBe('Equipo y permisos')
    expect(
      wrapper.findAll('[role="tab"]').map((t) => t.text().replace(/\s+/g, ' ')),
    ).toEqual([
      'Equipo',
      'Pendientes de aprobación 2',
      'Qué puede ver cada rol',
    ])
    expect(teamQueries(fake)).toEqual([{ limit: '10', offset: '0' }])

    const admin = rowOf('Lucía Choque')
    expect(admin.text()).toContain('lucia@aspar.org')
    expect(admin.text()).toContain('Administración')
    expect(admin.text()).toContain('Dirección')
    expect(admin.text()).toContain('Hoy, 08:55')
    expect(admin.text()).toContain('Activa')
    expect(admin.get('button').attributes('aria-label')).toBe(
      'Gestionar a Lucía Choque',
    )
    // «General» no suma nada: no se muestra
    expect(rowOf('René Vargas').text()).not.toContain('General')
    expect(rowOf('René Vargas').text()).toContain('Todavía no ingresó')
    expect(rowOf('Lic. Ana Flores').text()).toContain('Fisioterapia')
    expect(rowOf('Carla Torrico').text()).toContain('Desactivada')
    expect(rowOf('Carla Torrico').get('button').text()).toBe('Reactivar')
    expect(rowOf('Gabriela Rocha').text()).toContain('Sin rol todavía')
    expect(rowOf('Gabriela Rocha').text()).toContain('Pendiente')
    expect(wrapper.text()).toContain(
      'Siempre queda al menos una persona con rol de Administración. Las cuentas se desactivan, no se borran.',
    )
    expect(wrapper.text()).toContain('Mostrando 1–5 de 5')
    // Las opciones de rol, en el orden del diseño
    expect(wrapper.findAll('#filtro-rol option').map((o) => o.text())).toEqual([
      'Todos los roles',
      'Administración',
      'Coordinación',
      'Profesional',
      'Recepción',
      'Voluntariado',
    ])
  })

  it('busca por nombre o correo y filtra por rol, y lo deja en la dirección', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const fake = fakeApi()
    const { wrapper, router } = await mountApp(PATH, fake)

    await wrapper.get('#buscar-persona-equipo').setValue('  ana   flores ')
    await vi.advanceTimersByTimeAsync(350)
    await settle()
    expect(lastQuery(fake, 'GET /users')).toMatchObject({
      search: 'ana flores',
    })
    expect(router.currentRoute.value.query.buscar).toBe('ana flores')

    await wrapper.get('#filtro-rol').setValue('professional')
    await settle()
    expect(lastQuery(fake, 'GET /users')).toEqual({
      search: 'ana flores',
      role: 'professional',
      limit: '10',
      offset: '0',
    })
    expect(router.currentRoute.value.query).toMatchObject({
      buscar: 'ana flores',
      rol: 'professional',
    })
    vi.useRealTimers()
  })

  it('explica una búsqueda sin resultados y permite quitarla', async () => {
    const fake = fakeApi()
    fake.on('GET /users', (call) =>
      call.query.get('role') === 'pendiente'
        ? page([], call)
        : page(call.query.get('search') ? [] : TEAM, call),
    )
    const { wrapper } = await mountApp(
      `${PATH}?buscar=nadie&rol=reception`,
      fake,
    )

    expect(lastQuery(fake, 'GET /users')).toMatchObject({
      search: 'nadie',
      role: 'reception',
    })
    expect(wrapper.text()).toContain(
      'Nadie con rol Recepción coincide con «nadie».',
    )
    await button('Quitar la búsqueda y el filtro').trigger('click')
    await settle()
    expect(lastQuery(fake, 'GET /users')).toEqual({ limit: '10', offset: '0' })
    expect(wrapper.text()).toContain('Mostrando 1–5 de 5')
  })

  it('reactiva una cuenta desactivada', async () => {
    const fake = fakeApi()
    fake.on('PATCH /users/u-4', { body: { ...INACTIVE, active: true } })
    const { wrapper } = await mountApp(PATH, fake)

    await rowOf('Carla Torrico').get('button').trigger('click')
    await settle()

    expect(fake.callsTo('PATCH /users/u-4')[0]!.body).toEqual({ active: true })
    expect(wrapper.text()).toContain('Reactivamos la cuenta de Carla.')
    // Vuelve a leer la lista, los pendientes y los miembros de cada rol
    expect(teamQueries(fake)).toHaveLength(2)
    expect(fake.callsTo('GET /roles')).toHaveLength(2)
  })

  it('«Aprobar» en una cuenta pendiente lleva a la bandeja', async () => {
    const fake = fakeApi()
    const { wrapper, router } = await mountApp(PATH, fake)

    await rowOf('Gabriela Rocha').get('button').trigger('click')
    await settle()

    expect(router.currentRoute.value.query.pestana).toBe('pendientes')
    expect(wrapper.text()).toContain(
      'Personas que crearon su cuenta desde el sitio',
    )
  })

  it('el Voluntariado no entra a Equipo y permisos', async () => {
    const fake = fakeApi({ session: { body: VOLUNTEER_SESSION } })
    const { wrapper, router } = await mountApp(PATH, fake)

    expect(router.currentRoute.value.name).toBe('resumen')
    expect(wrapper.text()).not.toContain('Qué puede ver cada rol')
    expect(fake.callsTo('GET /users')).toHaveLength(0)
  })
})

describe('Invitar a una persona', () => {
  it('se abre con el botón, valida y entrega la contraseña temporal una sola vez', async () => {
    const fake = fakeApi()
    fake.on('POST /users', {
      status: 201,
      body: {
        ...member({
          id: 'u-9',
          name: 'Gabriela Rocha',
          email: 'gabriela.rocha@aspar.org',
          role: 'volunteer',
          roleName: 'Voluntariado',
          mustChangePassword: true,
        }),
        temporaryPassword: 'Ceibo-4821-Sol',
      },
    })
    const { wrapper } = await mountApp(PATH, fake)

    // En una ventana común la invitación se abre a pedido
    expect(wrapper.find('[data-testid="panel-invitar"]').exists()).toBe(false)
    await button('+ Invitar a una persona').trigger('click')
    await settle()
    const panel = wrapper.get('[data-testid="panel-invitar"]')
    expect(document.activeElement).toBe(field('Nombre completo', panel).element)
    expect(panel.findAll('.role-choice strong').map((r) => r.text())).toEqual([
      'Administración',
      'Coordinación',
      'Profesional',
      'Recepción',
      'Voluntariado',
    ])
    // Se propone el rol con menos acceso
    expect(
      panel.get<HTMLInputElement>('input[value="volunteer"]').element.checked,
    ).toBe(true)

    await panel.get('form').trigger('submit')
    await settle()
    expect(panel.text()).toContain(
      'Escribe el nombre completo (al menos 3 letras).',
    )
    expect(panel.text()).toContain('Escribe el correo de la persona.')
    expect(fake.callsTo('POST /users')).toHaveLength(0)

    await field('Nombre completo', panel).setValue('  Gabriela Rocha ')
    await field('Correo', panel).setValue('gabriela.rocha@')
    await panel.get('form').trigger('submit')
    expect(panel.text()).toContain(
      'Revisa el correo: debe tener la forma nombre@dominio.com.',
    )

    await field('Correo', panel).setValue('Gabriela.Rocha@aspar.org')
    await panel.get('form').trigger('submit')
    await settle()

    expect(fake.callsTo('POST /users')[0]!.body).toEqual({
      name: 'Gabriela Rocha',
      email: 'gabriela.rocha@aspar.org',
      role: 'volunteer',
    })
    expect(panel.text()).toContain('Acceso listo para Gabriela')
    expect(panel.text()).toContain('se muestra solo esta vez')
    expect(panel.get('[data-testid="contrasena-temporal"]').text()).toBe(
      'Ceibo-4821-Sol',
    )
    expect(panel.text()).toContain(
      'Entrégala en persona y pídele que la cambie al ingresar.',
    )
    // La lista del equipo y los miembros por rol se actualizan
    expect(teamQueries(fake)).toHaveLength(2)

    // «Invitar a otra persona» borra la contraseña y deja el formulario vacío
    await button('Invitar a otra persona', panel).trigger('click')
    await settle()
    expect(panel.find('[data-testid="contrasena-temporal"]').exists()).toBe(
      false,
    )
    expect(
      (field('Nombre completo', panel).element as HTMLInputElement).value,
    ).toBe('')

    await panel.get('[aria-label="Cerrar la invitación"]').trigger('click')
    await settle()
    expect(wrapper.find('[data-testid="panel-invitar"]').exists()).toBe(false)
  })

  it('copia la contraseña y muestra el error de la API (correo repetido)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    const fake = fakeApi()
    fake.on('POST /users', [
      { status: 409, body: { detail: 'Ya existe un usuario con ese correo.' } },
      {
        status: 201,
        body: {
          ...member({ id: 'u-9', name: 'Ana Pérez', role: 'reception' }),
          temporaryPassword: 'Tarco-1180-Rio',
        },
      },
    ])
    const { wrapper } = await mountApp(PATH, fake)
    await button('+ Invitar a una persona').trigger('click')
    await settle()
    const panel = wrapper.get('[data-testid="panel-invitar"]')

    await field('Nombre completo', panel).setValue('Ana Pérez')
    await field('Correo', panel).setValue('ana@aspar.org')
    await panel.get('input[value="reception"]').setValue(true)
    await panel.get('form').trigger('submit')
    await settle()
    expect(panel.get('[role="alert"]').text()).toContain(
      'Ya existe un usuario con ese correo.',
    )

    await panel.get('form').trigger('submit')
    await settle()
    expect(fake.callsTo('POST /users')[1]!.body).toMatchObject({
      role: 'reception',
    })
    await button('Copiar', panel).trigger('click')
    await settle()
    expect(writeText).toHaveBeenCalledWith('Tarco-1180-Rio')
    expect(button('Copiada', panel).attributes('aria-label')).toBe(
      'Contraseña copiada',
    )
  })

  it('desde «Qué puede ver cada rol» vuelve al equipo para invitar', async () => {
    const fake = fakeApi()
    const { wrapper, router } = await mountApp(`${PATH}?pestana=permisos`, fake)
    expect(wrapper.find('[data-testid="tabla-permisos"]').exists()).toBe(true)

    await button('+ Invitar a una persona').trigger('click')
    await settle()

    expect(router.currentRoute.value.query.pestana).toBeUndefined()
    expect(wrapper.find('[data-testid="panel-invitar"]').exists()).toBe(true)
  })
})

describe('Gestionar a una persona', () => {
  it('cambia el rol y el área', async () => {
    const fake = fakeApi()
    fake.on('PATCH /users/u-3', {
      body: { ...PROFESSIONAL, role: 'reception', roleName: 'Recepción' },
    })
    await mountApp(PATH, fake)

    await rowOf('Lic. Ana Flores').get('button').trigger('click')
    await settle()
    expect(modal().text()).toContain('Gestionar a Lic. Ana Flores')
    expect(
      button('Guardar cambios', modal()).attributes('disabled'),
    ).toBeDefined()

    await field('Rol', modal()).setValue('reception')
    await field('Área', modal()).setValue('  Recepción de sede ')
    await modal().get('form').trigger('submit')
    await settle()

    expect(fake.callsTo('PATCH /users/u-3')[0]!.body).toEqual({
      role: 'reception',
      department: 'Recepción de sede',
    })
    expect(body().find('[role="dialog"]').exists()).toBe(false)
    expect(body().text()).toContain('Guardamos los cambios de Ana.')
  })

  it('restablece la contraseña y la muestra una sola vez', async () => {
    const fake = fakeApi()
    fake.on('POST /users/u-2/reset-password', {
      body: { message: 'ok', temporaryPassword: 'Molle-7731-Luz' },
    })
    await mountApp(PATH, fake)

    await rowOf('René Vargas').get('button').trigger('click')
    await settle()
    await button('Restablecer contraseña', modal()).trigger('click')
    await settle()

    expect(fake.callsTo('POST /users/u-2/reset-password')).toHaveLength(1)
    expect(modal().text()).toContain('Nueva contraseña para René')
    expect(modal().get('[data-testid="contrasena-temporal"]').text()).toBe(
      'Molle-7731-Luz',
    )
  })

  it('desactiva una cuenta después de confirmarlo', async () => {
    const fake = fakeApi()
    fake.on('PATCH /users/u-2', { body: { ...member(), active: false } })
    await mountApp(PATH, fake)

    await rowOf('René Vargas').get('button').trigger('click')
    await settle()
    await button('Desactivar cuenta…', modal()).trigger('click')
    expect(modal().text()).toContain('¿Desactivar a René Vargas?')
    await button('No, mantenerla', modal()).trigger('click')
    expect(fake.callsTo('PATCH /users/u-2')).toHaveLength(0)

    await button('Desactivar cuenta…', modal()).trigger('click')
    await button('Sí, desactivar', modal()).trigger('click')
    await settle()

    expect(fake.callsTo('PATCH /users/u-2')[0]!.body).toEqual({ active: false })
    expect(body().text()).toContain(
      'Desactivamos la cuenta de René. Sus sesiones se cerraron.',
    )
  })

  it('protege a la última persona de Administración activa', async () => {
    const fake = fakeApi({ roles: matrix(1) })
    await mountApp(PATH, fake)
    const other = member({
      id: 'u-7',
      name: 'Rosa Admin',
      role: 'admin',
      roleName: 'Administración',
    })
    fake.on('GET /users', (call) => page([other], call))
    await body().get('#filtro-rol').setValue('admin')
    await settle()

    await rowOf('Rosa Admin').get('button').trigger('click')
    await settle()

    const lock =
      'Es la única persona con rol de Administración activa. Debe quedar al menos una.'
    expect(modal().text()).toContain(lock)
    expect(field('Rol', modal()).attributes('disabled')).toBeDefined()
    expect(modal().text()).not.toContain('Desactivar cuenta…')
  })

  it('no deja quitarse Administración a uno mismo', async () => {
    const fake = fakeApi()
    await mountApp(PATH, fake)

    await rowOf('Lucía Choque').get('button').trigger('click')
    await settle()

    expect(modal().text()).toContain(
      'No puedes quitarte el rol de Administración ni desactivar tu propia cuenta.',
    )
    expect(field('Rol', modal()).attributes('disabled')).toBeDefined()
  })

  it('muestra la respuesta de la API si la desactivación no se puede hacer', async () => {
    const fake = fakeApi()
    fake.on('PATCH /users/u-2', {
      status: 409,
      body: {
        detail:
          'Debe quedar al menos una persona con rol de Administración activa.',
      },
    })
    await mountApp(PATH, fake)

    await rowOf('René Vargas').get('button').trigger('click')
    await settle()
    await button('Desactivar cuenta…', modal()).trigger('click')
    await button('Sí, desactivar', modal()).trigger('click')
    await settle()

    expect(modal().get('[role="alert"]').text()).toContain(
      'Debe quedar al menos una persona con rol de Administración activa.',
    )
  })
})

describe('Pendientes de aprobación', () => {
  it('aprueba una cuenta con el rol elegido y explica las que no confirmaron su correo', async () => {
    const fake = fakeApi()
    fake.on('POST /users/u-5/approve', {
      body: { ...PENDING, role: 'reception', roleName: 'Recepción' },
    })
    const { wrapper } = await mountApp(`${PATH}?pestana=pendientes`, fake)

    expect(lastQuery(fake, 'GET /users')).toEqual({
      role: 'pendiente',
      limit: '10',
      offset: '0',
    })
    const unverified = rowOf('Marina Registro')
    expect(unverified.text()).toContain('Sin confirmar')
    expect(unverified.text()).toContain('Se aprueba cuando confirme su correo.')
    expect(unverified.find('button').exists()).toBe(false)

    const pending = rowOf('Gabriela Rocha')
    expect(pending.text()).toContain('Confirmado')
    const approve = pending.get('button')
    expect(approve.attributes('disabled')).toBeDefined()
    expect(pending.findAll('option').map((o) => o.text())).toEqual([
      'Elige un rol',
      'Administración',
      'Coordinación',
      'Profesional',
      'Recepción',
      'Voluntariado',
    ])

    await pending.get('select').setValue('reception')
    await approve.trigger('click')
    await settle()

    expect(fake.callsTo('POST /users/u-5/approve')[0]!.body).toEqual({
      role: 'reception',
    })
    expect(wrapper.text()).toContain(
      'Aprobamos a Gabriela como Recepción. Ya puede entrar.',
    )
    // Se actualizan la bandeja, el contador y los miembros de cada rol
    expect(
      fake
        .callsTo('GET /users')
        .filter((c) => c.query.get('role') === 'pendiente'),
    ).toHaveLength(4)
    expect(fake.callsTo('GET /roles')).toHaveLength(2)
  })

  it('muestra el motivo si la API no la aprueba', async () => {
    const fake = fakeApi()
    fake.on('POST /users/u-5/approve', {
      status: 409,
      body: {
        detail: 'La cuenta está desactivada. Reactívala antes de aprobarla.',
      },
    })
    const { wrapper } = await mountApp(`${PATH}?pestana=pendientes`, fake)

    const pending = rowOf('Gabriela Rocha')
    await pending.get('select').setValue('volunteer')
    await pending.get('button').trigger('click')
    await settle()

    expect(wrapper.text()).toContain(
      'La cuenta está desactivada. Reactívala antes de aprobarla.',
    )
  })

  it('dice cuando no hay cuentas esperando', async () => {
    const fake = fakeApi()
    fake.on('GET /users', (call) => page([], call))
    const { wrapper } = await mountApp(`${PATH}?pestana=pendientes`, fake)

    expect(wrapper.text()).toContain('No hay cuentas esperando aprobación.')
  })
})

describe('Qué puede ver cada rol', () => {
  it('muestra los permisos agrupados, con Administración fija', async () => {
    const fake = fakeApi()
    const { wrapper } = await mountApp(`${PATH}?pestana=permisos`, fake)

    const heads = wrapper.findAll('thead th').map((th) => th.text())
    expect(heads[0]).toBe('Área')
    expect(heads.slice(2).map((h) => h.split(/\s+/)[0])).toEqual([
      'Admin.',
      'Coord.',
      'Profesional',
      'Recepción',
      'Voluntariado',
    ])
    expect(heads[2]).toContain('2 personas')
    expect(heads[3]).toContain('1 persona')
    expect(
      wrapper.findAll('.matrix__group').map((group) => group.text()),
    ).toEqual([
      'Afiliados',
      'Datos clínicos',
      'Asistencia y actividades',
      'Galería y contenido',
      'Equipo y registro',
    ])

    const admin = cell('Administración', 'Consultar el registro de actividad')
    expect(admin.element.checked).toBe(true)
    expect(admin.element.disabled).toBe(true)
    expect(
      cell('Voluntariado', 'Ver afiliados y sus datos de contacto').element
        .checked,
    ).toBe(true)
    expect(
      cell(
        'Voluntariado',
        'Registrar y editar fichas (filiación y consentimiento)',
      ).element.checked,
    ).toBe(false)
    expect(wrapper.text()).toContain(
      'Administración tiene todos los permisos y no se edita.',
    )
  })

  it('guarda un permiso común sin pedir confirmación', async () => {
    const fake = fakeApi()
    fake.on('PUT /roles/volunteer/permissions', { body: matrix().roles[0] })
    const { wrapper } = await mountApp(`${PATH}?pestana=permisos`, fake)

    await cell(
      'Voluntariado',
      'Registrar y editar fichas (filiación y consentimiento)',
    ).setValue(true)
    expect(wrapper.text()).toContain('1 cambio sin guardar')

    await button('Guardar permisos').trigger('click')
    await settle()

    expect(fake.callsTo('PUT /roles/volunteer/permissions')[0]!.body).toEqual({
      // En el orden del catálogo de la API
      permissions: ['attendance:write', 'patients:read', 'patients:write'],
      confirmSensitive: false,
    })
    expect(wrapper.text()).toContain('Guardamos los permisos de Voluntariado.')
    expect(fake.callsTo('GET /roles')).toHaveLength(2)
  })

  it('pide confirmar antes de dar datos clínicos y lo envía confirmado', async () => {
    const fake = fakeApi()
    fake.on('PUT /roles/reception/permissions', { body: matrix().roles[4] })
    fake.on('PUT /roles/volunteer/permissions', { body: matrix().roles[0] })
    const { wrapper } = await mountApp(`${PATH}?pestana=permisos`, fake)

    await cell(
      'Recepción',
      'Ver historia clínica, evaluaciones y documentos privados',
    ).setValue(true)
    await cell(
      'Voluntariado',
      'Ver afiliados y sus datos de contacto',
    ).setValue(false)
    expect(wrapper.get('.matrix__status').text().replace(/\s+/g, ' ')).toBe(
      '2 cambios sin guardar · incluye acceso sensible: te pediremos confirmarlo.',
    )

    await button('Guardar permisos').trigger('click')
    await settle()
    expect(fake.callsTo('PUT /roles/reception/permissions')).toHaveLength(0)
    expect(modal().text()).toContain('Confirmar acceso sensible')
    expect(modal().text()).toContain('Datos clínicos')
    expect(modal().text()).toContain(
      'Recepción: Ver historia clínica, evaluaciones y documentos privados.',
    )

    // «Revisar de nuevo» no guarda nada
    await button('Revisar de nuevo', modal()).trigger('click')
    await settle()
    expect(body().find('[role="dialog"]').exists()).toBe(false)

    await button('Guardar permisos').trigger('click')
    await settle()
    await button('Sí, dar acceso', modal()).trigger('click')
    await settle()

    expect(fake.callsTo('PUT /roles/reception/permissions')[0]!.body).toEqual({
      permissions: [
        'patients:read',
        'patients:read_clinical',
        'patients:write',
      ],
      confirmSensitive: true,
    })
    expect(fake.callsTo('PUT /roles/volunteer/permissions')[0]!.body).toEqual({
      permissions: ['attendance:write'],
      confirmSensitive: true,
    })
    expect(wrapper.text()).toContain(
      'Guardamos los permisos de Recepción, Voluntariado.',
    )
  })

  it('si la API pide confirmar algo sensible, muestra su aviso y reenvía', async () => {
    const fake = fakeApi()
    fake.on('PUT /roles/coordination/permissions', [
      {
        status: 409,
        body: {
          detail:
            'Vas a dar al rol Coordinación acceso sensible: x. Confírmalo para continuar.',
        },
      },
      { body: matrix().roles[2] },
    ])
    await mountApp(`${PATH}?pestana=permisos`, fake)

    await cell(
      'Coordinación',
      'Tomar y cerrar la asistencia de las actividades',
    ).setValue(true)
    await button('Guardar permisos').trigger('click')
    await settle()

    expect(modal().text()).toContain(
      'Vas a dar al rol Coordinación acceso sensible: x. Confírmalo para continuar.',
    )
    await button('Sí, dar acceso', modal()).trigger('click')
    await settle()
    const calls = fake.callsTo('PUT /roles/coordination/permissions')
    expect(
      calls.map(
        (call) => (call.body as { confirmSensitive: boolean }).confirmSensitive,
      ),
    ).toEqual([false, true])
  })

  it('muestra el error de la API y «Descartar» vuelve a lo guardado', async () => {
    const fake = fakeApi()
    fake.on('PUT /roles/volunteer/permissions', {
      status: 500,
      body: { detail: 'Error interno' },
    })
    const { wrapper } = await mountApp(`${PATH}?pestana=permisos`, fake)
    const checkbox = cell(
      'Voluntariado',
      'Editar y publicar el contenido del sitio',
    )

    await checkbox.setValue(true)
    await button('Guardar permisos').trigger('click')
    await settle()
    expect(wrapper.find('.matrix [role="alert"]').exists()).toBe(true)

    await button('Descartar').trigger('click')
    expect(checkbox.element.checked).toBe(false)
    expect(wrapper.text()).not.toContain('cambio sin guardar')
  })

  it('sin permiso para cambiar roles, la tabla solo se consulta', async () => {
    const fake = fakeApi({
      session: {
        body: sessionFor(
          {},
          ALL_PERMISSIONS.filter((key) => key !== 'roles:manage'),
        ),
      },
    })
    const { wrapper } = await mountApp(`${PATH}?pestana=permisos`, fake)

    expect(
      cell('Voluntariado', 'Ver afiliados y sus datos de contacto').element
        .disabled,
    ).toBe(true)
    expect(wrapper.text()).toContain(
      'Solo quien puede cambiar los permisos de los roles los edita.',
    )
    expect(wrapper.text()).not.toContain('Guardar permisos')
  })
})

describe('Equipo en ventana completa (escritorio)', () => {
  it('pide tantas filas como entran y deja la invitación fija al costado', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    )
    vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(
      function (this: Element) {
        return this.classList.contains('members__table') ? 380 : 0
      },
    )
    const fake = fakeApi()
    const { wrapper } = await mountApp(PATH, fake)

    // 380 px sin títulos de columna: 6 filas de 56 px
    expect(teamQueries(fake)).toEqual([{ limit: '6', offset: '0' }])
    expect(wrapper.find('.access--fit').exists()).toBe(true)
    const panel = wrapper.get('[data-testid="panel-invitar"]')
    expect(panel.find('[aria-label="Cerrar la invitación"]').exists()).toBe(
      false,
    )
  })
})
