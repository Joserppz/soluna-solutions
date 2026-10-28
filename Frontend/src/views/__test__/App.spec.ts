import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from '../../App.vue'
import {
  SESSION_IDLE_LIMIT,
  getSession,
  signIn,
  type Session,
} from '../../services/aspar'

// SCRUM-12 / SCRUM-67: barra superior, contador, renovación y cierre de sesión
function testRouter() {
  const page = { template: '<div class="page" />' }
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'cronograma', component: page },
      { path: '/login', name: 'login', component: page },
      {
        path: '/pacientes',
        name: 'pacientes',
        component: page,
        meta: { requiresAuth: true },
      },
    ],
  })
}

async function mountApp(path = '/') {
  const router = testRouter()
  await router.push(path)
  await router.isReady()
  const wrapper = mount(App, { global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

// Deja la sesión actual con `segundos` de margen antes del límite de inactividad
function idleUntilSecondsLeft(seconds: number) {
  const session = getSession() as Session
  localStorage.setItem(
    'aspar_session',
    JSON.stringify({
      ...session,
      lastActivityAt: Date.now() - SESSION_IDLE_LIMIT + seconds * 1000,
    }),
  )
}

function button(
  wrapper: Awaited<ReturnType<typeof mountApp>>['wrapper'],
  text: string,
) {
  return wrapper.findAll('button').find((item) => item.text() === text)
}

describe('SCRUM-67: App.vue — sesión en la barra superior', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('sin sesión muestra solo el portal y el acceso al login', async () => {
    const { wrapper } = await mountApp()

    expect(wrapper.text()).toContain('Iniciar sesión')
    expect(wrapper.find('.session-badge').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Pacientes')
  })

  it('la cabecera enlaza a las secciones del portal como en el wireframe', async () => {
    const { wrapper } = await mountApp()
    const hrefs = wrapper
      .findAll('nav a')
      .map((link) => link.attributes('href'))

    expect(hrefs).toEqual(
      expect.arrayContaining([
        '/',
        '/#cronograma',
        '/#galeria',
        '/#donar',
        '/login',
      ]),
    )
  })

  it('muestra el rol y el menú que corresponde a cada rol', async () => {
    signIn('admin@aspar.org', 'Admin2026!')
    let { wrapper } = await mountApp()
    expect(wrapper.find('.session-badge').text()).toContain('Administrador')
    expect(wrapper.text()).toContain('Usuarios')
    expect(wrapper.text()).toContain('Bitácora')
    wrapper.unmount()

    signIn('voluntario@aspar.org', 'Voluntario2026!')
    ;({ wrapper } = await mountApp())
    expect(wrapper.find('.session-badge').text()).toContain('Voluntario')
    expect(wrapper.text()).toContain('Pacientes')
    expect(wrapper.text()).not.toContain('Usuarios')
    expect(wrapper.text()).not.toContain('Bitácora')
  })

  it('cerrar sesión borra la sesión y lleva al login', async () => {
    signIn('admin@aspar.org', 'Admin2026!')
    const { wrapper, router } = await mountApp('/pacientes')

    await button(wrapper, 'Cerrar sesión')!.trigger('click')
    await flushPromises()

    expect(getSession()).toBeNull()
    expect(router.currentRoute.value.name).toBe('login')
    expect(wrapper.find('.session-badge').exists()).toBe(false)
  })

  it('avisa cuando faltan menos de 2 minutos y permite mantener la sesión', async () => {
    signIn('admin@aspar.org', 'Admin2026!')
    idleUntilSecondsLeft(60)
    const { wrapper } = await mountApp('/pacientes')

    expect(wrapper.find('.session-banner-warning').text()).toContain(
      'Tu sesión expirará pronto',
    )

    await button(wrapper, 'Mantener sesión activa')!.trigger('click')
    await flushPromises()

    expect(wrapper.find('.session-banner-warning').exists()).toBe(false)
    const remainingMs =
      SESSION_IDLE_LIMIT -
      (Date.now() - (getSession() as Session).lastActivityAt)
    expect(remainingMs).toBeGreaterThan(SESSION_IDLE_LIMIT - 5_000)
  })

  it('si el Backend no renueva la sesión lo informa al usuario', async () => {
    signIn('admin@aspar.org', 'Admin2026!')
    const session = getSession() as Session
    localStorage.setItem(
      'aspar_session',
      JSON.stringify({ ...session, source: 'api' }),
    )
    idleUntilSecondsLeft(60)
    const { wrapper } = await mountApp('/pacientes')

    await button(wrapper, 'Mantener sesión activa')!.trigger('click')
    await flushPromises()

    expect(wrapper.find('.session-banner-expired').text()).toContain(
      'No se pudo renovar la sesión',
    )
  })

  it('al vencer por inactividad cierra la sesión y vuelve al login', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
    signIn('admin@aspar.org', 'Admin2026!')
    idleUntilSecondsLeft(3)
    const { wrapper, router } = await mountApp('/pacientes')
    expect(wrapper.find('.session-badge').exists()).toBe(true)

    await vi.advanceTimersByTimeAsync(5_000)
    await flushPromises()

    expect(getSession()).toBeNull()
    expect(wrapper.find('.session-banner-expired').text()).toContain(
      'Tu sesión ha expirado',
    )
    expect(router.currentRoute.value.name).toBe('login')
  })
})
