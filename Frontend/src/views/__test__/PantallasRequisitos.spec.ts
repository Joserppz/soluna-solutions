import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ScheduleView from '../ScheduleView.vue'
import {
  getDonationSummary,
  getDonations,
  institutionalInfo,
  signIn,
} from '../../services/aspar'

// SCRUM-191 / SCRUM-196: cada pantalla del wireframe cumple el requisito que declara
beforeEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
})

describe('Portal público (/) — RF-04, RF-06, RF-07, RF-08, RF-10', () => {
  it('muestra el cronograma ordenado y los enlaces oficiales sin iniciar sesión', () => {
    const wrapper = mount(ScheduleView)
    const hrefs = wrapper.findAll('a').map((link) => link.attributes('href'))

    expect(hrefs).toContain(institutionalInfo.socialLinks.facebook)
    expect(hrefs).toContain(institutionalInfo.socialLinks.instagram)
    expect(hrefs).toContain(institutionalInfo.socialLinks.tiktok)
    for (const requisito of institutionalInfo.enrollmentRequirements) {
      expect(wrapper.text()).toContain(requisito)
    }
  })

  it('el público ve la galería, pero solo el personal con sesión puede subir archivos (RF-05)', () => {
    const publico = mount(ScheduleView)
    expect(publico.find('#media-title').exists()).toBe(false)
    expect(publico.find('#donor-name').exists()).toBe(true)

    signIn('coordinacion@aspar.org', 'Coord2026!')
    const personal = mount(ScheduleView)
    expect(personal.find('#media-title').exists()).toBe(true)
  })

  it('registra una donación por QR bancario (RF-06)', async () => {
    const before = getDonations().length
    const wrapper = mount(ScheduleView)

    await wrapper.find('#donor-name').setValue('Donante de prueba')
    await wrapper.find('#donor-amount').setValue(150)
    await wrapper.find('#donor-method').setValue('QR Bancario')
    await wrapper.findAll('form').at(-1)!.trigger('submit.prevent')

    expect(getDonations()).toHaveLength(before + 1)
    expect(wrapper.text()).toContain('Bs. 150 vía QR Bancario')
  })

  it('el aporte declarado queda pendiente y no suma al contador público hasta confirmarse', async () => {
    const wrapper = mount(ScheduleView)
    const contadorAntes = wrapper.find('.donation-counter').text()

    await wrapper.find('#donor-name').setValue('Donante de prueba')
    await wrapper.find('#donor-amount').setValue(200)
    await wrapper.find('#donor-reference').setValue('TRX-000123')
    await wrapper.findAll('form').at(-1)!.trigger('submit.prevent')

    const registrado = getDonations()[0]!
    expect(registrado.status).toBe('Pendiente')
    expect(registrado.reference).toBe('TRX-000123')
    expect(wrapper.find('.donation-counter').text()).toBe(contadorAntes)
    expect(getDonationSummary().pendingCount).toBe(1)
    expect(wrapper.find('.success-message').text()).toContain(
      'Quedará confirmado',
    )
  })

  it('rechaza un monto inválido sin registrar el aporte', async () => {
    const before = getDonations().length
    const wrapper = mount(ScheduleView)

    await wrapper.find('#donor-amount').setValue(0)
    await wrapper.findAll('form').at(-1)!.trigger('submit.prevent')

    expect(wrapper.find('.form-error').text()).toContain('mayor a 0')
    expect(getDonations()).toHaveLength(before)
  })

  it('el contador público suma solo los aportes confirmados', () => {
    const summary = getDonationSummary()
    const confirmados = getDonations().filter((d) => d.status === 'Verificado')

    expect(summary.confirmedCount).toBe(confirmados.length)
    expect(summary.confirmedTotalBs).toBe(
      confirmados.reduce((total, d) => total + d.amountBs, 0),
    )
    expect(mount(ScheduleView).find('.donation-counter').text()).toContain(
      `${summary.confirmedCount} aportes confirmados`,
    )
  })
})
