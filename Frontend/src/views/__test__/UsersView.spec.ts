import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import UsersView from '../UsersView.vue'
import { getUsers, signIn } from '../../services/aspar'

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

    expect(wrapper.text()).toContain('Ya existe un usuario con ese correo.')
  })

  it('desactiva una cuenta y permite reactivarla', async () => {
    const wrapper = mount(UsersView)
    await flushPromises()

    const row = () =>
      wrapper
        .findAll('article')
        .find((item) => item.text().includes('recepcion@aspar.org'))!

    await row().find('button').trigger('click')
    expect(
      getUsers().find((u) => u.email === 'recepcion@aspar.org')?.active,
    ).toBe(false)
    expect(row().find('button').text()).toBe('Activar')

    await row().find('button').trigger('click')
    expect(
      getUsers().find((u) => u.email === 'recepcion@aspar.org')?.active,
    ).toBe(true)
  })
})
