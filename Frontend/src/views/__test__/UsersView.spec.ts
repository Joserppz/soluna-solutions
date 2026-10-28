import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import UsersView from '../UsersView.vue'
import { getUsers, signIn, signOut } from '../../services/aspar'

describe('SCRUM-161: UsersView — gestión de usuarios y roles', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    signIn('admin@aspar.org', 'Admin2026!')
  })

  it('crea un usuario con el rol elegido', async () => {
    const wrapper = mount(UsersView)
    await flushPromises()

    await wrapper.find('#user-name').setValue('Dr. Roberto Siles')
    await wrapper.find('#user-email').setValue('roberto.siles@aspar.org')
    await wrapper.find('#user-role').setValue('Coordinador')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.find('.success-message').text()).toContain('Coordinador')
    const created = getUsers().find(
      (u) => u.email === 'roberto.siles@aspar.org',
    )
    expect(created?.role).toBe('Coordinador')
  })

  it('rechaza un correo duplicado', async () => {
    const wrapper = mount(UsersView)
    await flushPromises()

    await wrapper.find('#user-name').setValue('Otra Persona')
    await wrapper.find('#user-email').setValue('admin@aspar.org')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.text()).toContain('Ya existe un usuario con ese correo.')
  })

  it('desactiva una cuenta y permite reactivarla', async () => {
    const wrapper = mount(UsersView)
    await flushPromises()

    const row = () =>
      wrapper
        .findAll('article')
        .find((item) => item.text().includes('recepcion@aspar.org'))!

    const toggle = () =>
      row()
        .findAll('button')
        .find((button) => /^(Activar|Desactivar)$/.test(button.text()))!

    await toggle().trigger('click')
    expect(
      getUsers().find((u) => u.email === 'recepcion@aspar.org')?.active,
    ).toBe(false)
    expect(toggle().text()).toBe('Activar')

    await toggle().trigger('click')
    expect(
      getUsers().find((u) => u.email === 'recepcion@aspar.org')?.active,
    ).toBe(true)
  })
})

// Respuestas simuladas de la API según método y ruta
function apiRespondiendo(
  routes: Record<string, { status?: number; body: unknown }>,
) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = url.replace(/^.*\/api\/v1/, '')
      const route = routes[`${init?.method ?? 'GET'} ${path}`]
      if (!route) throw new Error(`Sin respuesta simulada para ${path}`)
      const status = route.status ?? 200
      return { ok: status < 400, status, json: async () => route.body }
    }),
  )
}

describe('SCRUM-161: contraseña temporal de usuarios nuevos o restablecidos', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    signIn('admin@aspar.org', 'Admin2026!')
  })

  async function crearUsuario(wrapper: ReturnType<typeof mount>) {
    await wrapper.find('#user-name').setValue('Lic. Sofía Morales')
    await wrapper.find('#user-email').setValue('sofia.morales@aspar.org')
    await wrapper.find('#user-role').setValue('Profesional')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()
  }

  it('muestra una vez la contraseña temporal que genera la API', async () => {
    const wrapper = mount(UsersView)
    await flushPromises()
    apiRespondiendo({
      'POST /users': {
        status: 201,
        body: {
          id: 'u-sofia',
          name: 'Lic. Sofía Morales',
          email: 'sofia.morales@aspar.org',
          role: 'Profesional',
          department: 'General',
          active: true,
          createdAt: '2026-10-28T12:00:00Z',
          temporaryPassword: 'Aspar-Xy12Zq7',
        },
      },
    })

    await crearUsuario(wrapper)

    expect(wrapper.find('.credential-password').text()).toBe('Aspar-Xy12Zq7')
    expect(getUsers().some((u) => u.id === 'u-sofia')).toBe(true)

    const cerrar = wrapper
      .findAll('button')
      .find((button) => button.text() === 'Ya la entregué')!
    await cerrar.trigger('click')
    expect(wrapper.find('.credential-card').exists()).toBe(false)
  })

  it('si la API rechaza el alta muestra su mensaje y no muestra contraseña', async () => {
    const wrapper = mount(UsersView)
    await flushPromises()
    apiRespondiendo({
      'POST /users': {
        status: 409,
        body: { detail: 'Ya existe un usuario con ese correo.' },
      },
    })

    await crearUsuario(wrapper)

    expect(wrapper.find('.form-error').text()).toContain(
      'Ya existe un usuario con ese correo.',
    )
    expect(wrapper.find('.credential-card').exists()).toBe(false)
  })

  it('sin API, en desarrollo, crea el usuario local con una contraseña que permite entrar', async () => {
    const wrapper = mount(UsersView)
    await flushPromises()

    await crearUsuario(wrapper)

    const password = wrapper.find('.credential-password').text()
    expect(password.length).toBeGreaterThanOrEqual(8)
    signOut()
    expect(signIn('sofia.morales@aspar.org', password)).toBe(true)
  })

  it('en producción, sin API, no crea el usuario', async () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_DEMO_MODE', '')
    try {
      const wrapper = mount(UsersView)
      await flushPromises()

      await crearUsuario(wrapper)

      expect(wrapper.find('.form-error').text()).toContain(
        'No se pudo conectar con el servidor',
      )
      expect(
        getUsers().some((u) => u.email === 'sofia.morales@aspar.org'),
      ).toBe(false)
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('restablece la contraseña de un usuario y la muestra una vez', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const wrapper = mount(UsersView)
    await flushPromises()
    const recepcion = getUsers().find((u) => u.email === 'recepcion@aspar.org')!
    apiRespondiendo({
      [`POST /users/${recepcion.id}/reset-password`]: {
        body: { message: 'ok', temporaryPassword: 'Aspar-Reset99a7' },
      },
    })

    const fila = wrapper
      .findAll('article')
      .find((item) => item.text().includes('recepcion@aspar.org'))!
    await fila
      .findAll('button')
      .find((button) => button.text() === 'Restablecer contraseña')!
      .trigger('click')
    await flushPromises()

    expect(window.confirm).toHaveBeenCalled()
    expect(wrapper.find('.credential-password').text()).toBe('Aspar-Reset99a7')
  })
})
