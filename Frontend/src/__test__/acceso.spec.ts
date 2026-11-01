import { afterEach, describe, expect, it } from 'vitest'

import { useToast } from '../composables/useToast'
import {
  ADMIN_SESSION,
  DASHBOARD,
  NO_SESSION,
  PENDING_SESSION,
  VOLUNTEER_SESSION,
  createApiFake,
  mountApp,
  sessionFor,
  settle,
} from './apiFake'

const LOGOUT = { body: { message: 'Sesión cerrada correctamente' } }

afterEach(() => {
  document.body.innerHTML = ''
  useToast().clear()
})

function toastTexts() {
  return useToast().toasts.value.map((toast) => toast.message)
}

async function fillLogin(
  wrapper: Awaited<ReturnType<typeof mountApp>>['wrapper'],
) {
  await wrapper.get('input[type="email"]').setValue('lucia@aspar.org')
  await wrapper
    .get('input[autocomplete="current-password"]')
    .setValue('Ceibo4821')
  await wrapper.get('form').trigger('submit')
  await settle()
}

describe('Ingreso al espacio del equipo', () => {
  it('sin sesión pide ingresar y, al hacerlo, vuelve a donde iba', async () => {
    const fake = createApiFake({
      'GET /auth/me': NO_SESSION,
      'POST /auth/login': { body: ADMIN_SESSION },
      'GET /dashboard/summary': { body: DASHBOARD },
    })
    const { wrapper, router } = await mountApp('/equipo/inventario', fake)

    expect(router.currentRoute.value.name).toBe('ingresar')
    expect(router.currentRoute.value.query.redirect).toBe('/equipo/inventario')
    expect(wrapper.get('h1').text()).toBe('Hola de nuevo.')
    expect(document.title).toBe('Acceso del equipo · ASPAR')

    await fillLogin(wrapper)

    expect(fake.callsTo('POST /auth/login')[0]!.body).toEqual({
      email: 'lucia@aspar.org',
      password: 'Ceibo4821',
    })
    expect(router.currentRoute.value.fullPath).toBe('/equipo/inventario')
    expect(wrapper.text()).toContain('Estamos preparando esta sección.')
  })

  it('valida el formulario antes de llamar a la API', async () => {
    const fake = createApiFake({ 'GET /auth/me': NO_SESSION })
    const { wrapper } = await mountApp('/ingresar', fake)

    await wrapper.get('input[type="email"]').setValue('lucia@')
    await wrapper.get('form').trigger('submit')
    await settle()

    expect(wrapper.text()).toContain('Revisa el correo')
    expect(wrapper.text()).toContain('Escribe tu contraseña.')
    expect(wrapper.get('input[type="email"]').attributes('aria-invalid')).toBe(
      'true',
    )
    expect(fake.callsTo('POST /auth/login')).toHaveLength(0)
  })

  it('si los datos no coinciden muestra el mensaje seguro de la API y borra la contraseña', async () => {
    const message =
      'No pudimos iniciar sesión. Revisa tu correo y contraseña. Tras 5 intentos fallidos el acceso se pausa 15 minutos.'
    const fake = createApiFake({
      'GET /auth/me': NO_SESSION,
      'POST /auth/login': { status: 401, body: { detail: message } },
    })
    const { wrapper, router } = await mountApp('/ingresar', fake)

    await fillLogin(wrapper)

    expect(wrapper.get('[role="alert"] .alert__text').text()).toBe(message)
    expect(
      (
        wrapper.get('input[autocomplete="current-password"]')
          .element as HTMLInputElement
      ).value,
    ).toBe('')
    expect(router.currentRoute.value.name).toBe('ingresar')
  })

  it('explica por qué se cerró la sesión', async () => {
    const fake = createApiFake({ 'GET /auth/me': NO_SESSION })
    const { wrapper } = await mountApp('/ingresar?motivo=inactividad', fake)

    expect(wrapper.text()).toContain(
      'Cerramos tu sesión tras 15 minutos sin uso',
    )
  })

  it('sin conexión con el servidor lo dice en vez de mostrar el equipo', async () => {
    const fake = createApiFake({ 'GET /auth/me': { status: 0 } })
    const { wrapper, router } = await mountApp('/equipo', fake)

    expect(router.currentRoute.value.query.motivo).toBe('sin-conexion')
    expect(wrapper.text()).toContain('No pudimos conectar con el servidor')
  })

  it('con sesión, la pantalla de ingreso lleva directo al resumen', async () => {
    const fake = createApiFake({
      'GET /auth/me': { body: ADMIN_SESSION },
      'GET /dashboard/summary': { body: DASHBOARD },
    })
    const { router } = await mountApp('/ingresar', fake)

    expect(router.currentRoute.value.name).toBe('resumen')
  })

  it('/login sigue funcionando como acceso directo', async () => {
    const fake = createApiFake({ 'GET /auth/me': NO_SESSION })
    const { router } = await mountApp('/login', fake)

    expect(router.currentRoute.value.name).toBe('ingresar')
  })
})

describe('Espacio del equipo según el rol', () => {
  it('Administración ve todas las secciones, con insignias de lo pendiente', async () => {
    const fake = createApiFake({
      'GET /auth/me': { body: ADMIN_SESSION },
      'GET /dashboard/summary': { body: DASHBOARD },
    })
    const { wrapper } = await mountApp('/equipo', fake)
    const menu = wrapper.get('nav[aria-label="Secciones"]')

    expect(
      menu
        .findAll('a')
        .map((a) =>
          a.find('span').exists() ? a.get('span').text() : a.text(),
        ),
    ).toEqual([
      'Resumen',
      'Afiliados',
      'Inventario',
      'Actividades',
      'Asistencia',
      'Galería',
      'Contenido',
      'Donaciones',
      'Solicitudes',
      'Administración',
    ])
    expect(
      menu.get('a[href="/equipo/donaciones"] .nav-item__badge').text(),
    ).toBe('5')
    expect(
      menu.get('a[href="/equipo/solicitudes"] .nav-item__badge').text(),
    ).toBe('4')
    expect(
      menu.get('a[href="/equipo/solicitudes"] .visually-hidden').text(),
    ).toBe('(4 pendientes)')
    expect(wrapper.get('.sidebar__user').text()).toContain('Lucía Choque')
    expect(wrapper.get('.sidebar__user .avatar').text()).toBe('LC')
    expect(wrapper.get('h1').text()).toMatch(
      /^(Buenos días|Buenas tardes|Buenas noches), Lucía\.$/,
    )
    expect(wrapper.findAll('.section-card')).toHaveLength(10)
    expect(wrapper.text()).toContain('Tu rol puede ver historias clínicas')
  })

  it('una sola cosa pendiente se anuncia en singular', async () => {
    const fake = createApiFake({
      'GET /auth/me': { body: ADMIN_SESSION },
      'GET /dashboard/summary': {
        body: {
          ...DASHBOARD,
          toReview: { ...DASHBOARD.toReview, donationsToConfirm: 1 },
        },
      },
    })
    const { wrapper } = await mountApp('/equipo', fake)

    expect(
      wrapper.get('a[href="/equipo/donaciones"] .visually-hidden').text(),
    ).toBe('(1 pendiente)')
  })

  it('Administración se abre con sus subsecciones y migas de pan', async () => {
    const fake = createApiFake({
      'GET /auth/me': { body: ADMIN_SESSION },
      'GET /dashboard/summary': { body: DASHBOARD },
    })
    const { wrapper } = await mountApp('/equipo/administracion/registro', fake)

    expect(wrapper.get('.nav-sub').text()).toContain('Equipo y permisos')
    expect(wrapper.get('.nav-sub .is-active').text()).toBe(
      'Registro de actividad',
    )
    expect(wrapper.get('.breadcrumb').text()).toBe(
      'Espacio del equipoAdministraciónRegistro de actividad',
    )
    expect(wrapper.get('.breadcrumb [aria-current="page"]').text()).toBe(
      'Registro de actividad',
    )
    expect(document.title).toBe('Registro de actividad · ASPAR')
  })

  it('Voluntariado solo ve lo suyo y no entra por la dirección a otras secciones', async () => {
    const fake = createApiFake({
      'GET /auth/me': { body: VOLUNTEER_SESSION },
      'GET /dashboard/summary': {
        body: {
          ...DASHBOARD,
          toReview: { ...DASHBOARD.toReview, newInquiries: null },
        },
      },
    })
    const { wrapper, router } = await mountApp('/equipo', fake)

    expect(
      wrapper
        .get('nav[aria-label="Secciones"]')
        .findAll('a')
        .map((a) => a.text()),
    ).toEqual(['Resumen', 'Afiliados', 'Asistencia'])
    expect(wrapper.text()).toContain('Solo el personal clínico ve historias')

    await router.push('/equipo/inventario')
    await settle()

    expect(router.currentRoute.value.name).toBe('resumen')
    expect(toastTexts()).toContain(
      'Tu rol no tiene acceso a Inventario. Si lo necesitas, pídeselo a Administración.',
    )
  })

  it('un rol sin secciones lo explica', async () => {
    const fake = createApiFake({
      'GET /auth/me': {
        body: sessionFor({ role: 'nuevo', roleName: 'Nuevo' }, []),
      },
      'GET /dashboard/summary': {
        status: 403,
        body: { detail: 'Sin permiso' },
      },
    })
    const { wrapper } = await mountApp('/equipo', fake)

    expect(wrapper.text()).toContain(
      'Tu rol todavía no tiene secciones asignadas',
    )
  })

  it('cerrar sesión avisa a la API y vuelve al ingreso', async () => {
    const fake = createApiFake({
      'GET /auth/me': { body: ADMIN_SESSION },
      'GET /dashboard/summary': { body: DASHBOARD },
      'POST /auth/logout': LOGOUT,
    })
    const { wrapper, router } = await mountApp('/equipo', fake)

    const logout = wrapper
      .findAll('.sidebar__secondary button')
      .find((button) => button.text() === 'Cerrar sesión')!
    await logout.trigger('click')
    await settle()

    expect(fake.callsTo('POST /auth/logout')).toHaveLength(1)
    expect(fake.callsTo('POST /auth/logout')[0]!.headers['X-CSRF-Token']).toBe(
      'csrf-prueba',
    )
    expect(router.currentRoute.value.name).toBe('ingresar')
    expect(toastTexts()).toContain('Cerraste sesión. ¡Hasta pronto!')
  })

  it('si la sesión vence en el servidor, vuelve al ingreso recordando la página', async () => {
    const fake = createApiFake({
      'GET /auth/me': { body: ADMIN_SESSION },
      'GET /dashboard/summary': {
        status: 401,
        body: {
          detail: 'Sesión inválida o expirada. Inicia sesión nuevamente.',
        },
      },
    })
    const { wrapper, router } = await mountApp('/equipo/galeria', fake)
    await settle()

    expect(router.currentRoute.value.name).toBe('ingresar')
    expect(router.currentRoute.value.query).toMatchObject({
      motivo: 'expirada',
      redirect: '/equipo/galeria',
    })
    expect(wrapper.text()).toContain('Tu sesión terminó')
  })

  it('en el celular el menú se abre y se cierra como panel', async () => {
    const fake = createApiFake({
      'GET /auth/me': { body: ADMIN_SESSION },
      'GET /dashboard/summary': { body: DASHBOARD },
    })
    const { wrapper, router } = await mountApp('/equipo', fake)
    const toggle = wrapper.get('.team-topbar__menu')

    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('.team').classes()).toContain('menu-open')

    await wrapper.get('.sidebar__close').trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('false')

    await toggle.trigger('click')
    await router.push('/equipo/afiliados')
    await settle()
    expect(wrapper.get('.team').classes()).not.toContain('menu-open')
  })
})

describe('Cuentas pendientes y contraseñas temporales', () => {
  it('una cuenta sin rol ve una espera cálida y puede volver a revisar', async () => {
    const fake = createApiFake({
      'GET /auth/me': [
        { body: PENDING_SESSION },
        { body: PENDING_SESSION },
        { body: ADMIN_SESSION },
      ],
      'GET /dashboard/summary': { body: DASHBOARD },
    })
    const { wrapper, router } = await mountApp('/equipo', fake)

    expect(router.currentRoute.value.name).toBe('cuenta-pendiente')
    expect(wrapper.get('h1').text()).toBe('Tu cuenta está lista, Gabriela.')
    expect(wrapper.text()).toContain('gabriela@gmail.com')
    expect(wrapper.get('[aria-current="step"]').text()).toContain(
      'Administración asigna tu rol',
    )

    const check = () =>
      wrapper
        .findAll('button')
        .find((b) => b.text().includes('Ya me aprobaron'))!
    await check().trigger('click')
    await settle()
    expect(router.currentRoute.value.name).toBe('cuenta-pendiente')
    expect(toastTexts()[0]).toContain('Todavía no tienes un rol asignado')

    await check().trigger('click')
    await settle()
    expect(router.currentRoute.value.name).toBe('resumen')
    expect(toastTexts()).toContain(
      '¡Listo! Ya tienes acceso al espacio del equipo.',
    )
  })

  it('quien ya tiene rol no ve la pantalla de espera', async () => {
    const fake = createApiFake({
      'GET /auth/me': { body: ADMIN_SESSION },
      'GET /dashboard/summary': { body: DASHBOARD },
    })
    const { router } = await mountApp('/cuenta-pendiente', fake)

    expect(router.currentRoute.value.name).toBe('resumen')
  })

  it('con contraseña temporal pide crear una propia antes de seguir', async () => {
    const temporary = sessionFor({ mustChangePassword: true }, [
      'patients:read',
    ])
    const fake = createApiFake({
      'GET /auth/me': { body: temporary },
      'POST /auth/change-password': [
        {
          status: 422,
          body: { detail: 'La contraseña actual no es correcta.' },
        },
        { body: sessionFor({}, ['patients:read']) },
      ],
      'GET /dashboard/summary': { body: DASHBOARD },
    })
    const { wrapper, router } = await mountApp('/equipo/afiliados', fake)

    expect(router.currentRoute.value.name).toBe('cambiar-contrasena')
    expect(wrapper.get('h1').text()).toBe('Crea tu contraseña.')
    expect(toastTexts()[0]).toContain('crea una contraseña propia')

    await wrapper.get('form').trigger('submit')
    await settle()
    expect(wrapper.text()).toContain(
      'Escribe la contraseña temporal que te dieron.',
    )
    expect(fake.callsTo('POST /auth/change-password')).toHaveLength(0)

    const [current, password, confirmation] = wrapper.findAll('input')
    await current!.setValue('Ceibo-4821-Sol')
    await password!.setValue('Nueva2026')
    await confirmation!.setValue('Nueva2026')
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(wrapper.get('[role="alert"] .alert__text').text()).toBe(
      'La contraseña actual no es correcta.',
    )

    await wrapper.get('form').trigger('submit')
    await settle()
    expect(fake.callsTo('POST /auth/change-password')[1]!.body).toEqual({
      currentPassword: 'Ceibo-4821-Sol',
      newPassword: 'Nueva2026',
    })
    expect(router.currentRoute.value.name).toBe('resumen')
    expect(toastTexts()).toContain('Tu contraseña quedó guardada.')
  })

  it('quien ingresa con Google puede crear su primera contraseña sin la actual', async () => {
    const google = sessionFor({ hasPassword: false, googleLinked: true }, [
      'patients:read',
    ])
    const fake = createApiFake({
      'GET /auth/me': { body: google },
      'POST /auth/change-password': { body: google },
      'GET /dashboard/summary': { body: DASHBOARD },
    })
    const { wrapper } = await mountApp('/cambiar-contrasena', fake)

    expect(wrapper.get('h1').text()).toBe('Cambia tu contraseña.')
    expect(wrapper.text()).toContain('Ingresas con Google')
    const inputs = wrapper.findAll('input')
    expect(inputs).toHaveLength(2)

    await inputs[0]!.setValue('Nueva2026')
    await inputs[1]!.setValue('Otra2026')
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(wrapper.text()).toContain('Las contraseñas no coinciden.')

    await inputs[1]!.setValue('Nueva2026')
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(fake.callsTo('POST /auth/change-password')[0]!.body).toEqual({
      currentPassword: null,
      newPassword: 'Nueva2026',
    })
  })
})

describe('Sitio público con y sin sesión', () => {
  it('sin sesión ofrece el acceso del equipo al pie', async () => {
    const fake = createApiFake({ 'GET /auth/me': NO_SESSION })
    const { wrapper } = await mountApp('/', fake)

    expect(wrapper.find('.public-session').exists()).toBe(false)
    expect(wrapper.get('.public-footer__team').text()).toBe('Acceso del equipo')
    expect(wrapper.find('#cronograma').exists()).toBe(true)
  })

  it('una cuenta pendiente navega el sitio con su sesión y puede salir', async () => {
    const fake = createApiFake({
      'GET /auth/me': { body: PENDING_SESSION },
      'POST /auth/logout': LOGOUT,
    })
    const { wrapper } = await mountApp('/', fake)
    const bar = wrapper.get('.public-session')

    expect(bar.text()).toContain('Hola, Gabriela.')
    expect(bar.text()).toContain(
      'Tu cuenta espera la aprobación de Administración.',
    )
    expect(bar.get('a').text()).toBe('Mi cuenta')

    await bar.get('button').trigger('click')
    await settle()
    expect(fake.callsTo('POST /auth/logout')).toHaveLength(1)
    expect(wrapper.find('.public-session').exists()).toBe(false)
  })

  it('el equipo tiene un atajo a su espacio', async () => {
    const fake = createApiFake({ 'GET /auth/me': { body: ADMIN_SESSION } })
    const { wrapper } = await mountApp('/', fake)

    expect(wrapper.get('.public-session a').text()).toBe('Espacio del equipo')
  })

  it('una dirección que no existe muestra una página amable', async () => {
    const fake = createApiFake({ 'GET /auth/me': NO_SESSION })
    const { wrapper } = await mountApp('/no-existe', fake)

    expect(wrapper.get('h1').text()).toBe('No encontramos esta página.')
    expect(wrapper.text()).not.toContain('Volver al espacio del equipo')
  })
})
