import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import AttendanceView from '../AttendanceView.vue'
import InventoryView from '../InventoryView.vue'
import RegisterPatientView from '../RegisterPatientView.vue'
import ScheduleView from '../ScheduleView.vue'
import {
  getAttendance,
  getDonations,
  getInventory,
  getPatients,
  institutionalInfo,
  signIn,
} from '../../services/aspar'

// SCRUM-191 / SCRUM-196: cada pantalla del wireframe cumple el requisito que declara
function testRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/pacientes', component: { template: '<div />' } },
    ],
  })
}

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
})

describe('Registrar paciente (/pacientes/nuevo) — RF-02, RNF-06', () => {
  it('rechaza activar el acceso sin consentimiento informado', async () => {
    signIn('recepcion@aspar.org', 'Recep2026!')
    const router = testRouter()
    const wrapper = mount(RegisterPatientView, {
      global: { plugins: [router] },
    })

    await wrapper.find('#name').setValue('Lucía Choque')
    await wrapper.find('#ci').setValue('7123456')
    await wrapper.find('#phone').setValue('71122334')
    await wrapper.find('#emergency').setValue('Juan Choque')
    await wrapper.find('#accessStatus').setValue('Activo')
    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.find('[role="alert"]').text()).toContain(
      'sin consentimiento informado',
    )
    expect(getPatients().some((p) => p.ci === '7123456')).toBe(false)
  })

  it('guarda la ficha válida y vuelve al listado', async () => {
    vi.useFakeTimers()
    signIn('recepcion@aspar.org', 'Recep2026!')
    const router = testRouter()
    await router.push('/')
    const wrapper = mount(RegisterPatientView, {
      global: { plugins: [router] },
    })

    await wrapper.find('#name').setValue('Lucía Choque')
    await wrapper.find('#ci').setValue('7123456')
    await wrapper.find('#phone').setValue('71122334')
    await wrapper.find('#emergency').setValue('Juan Choque')
    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.find('[role="status"]').exists()).toBe(true)
    expect(getPatients().find((p) => p.ci === '7123456')?.accessStatus).toBe(
      'Pendiente',
    )
    vi.runAllTimers()
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/pacientes')
    vi.useRealTimers()
  })
})

describe('Asistencia (/asistencia) — RNF-06', () => {
  it('no permite marcar Presente a un paciente sin consentimiento', async () => {
    signIn('voluntario@aspar.org', 'Voluntario2026!')
    const wrapper = mount(AttendanceView)

    const miguel = wrapper
      .findAll('.attendance-row')
      .find((row) => row.text().includes('Miguel Fernández'))!
    await miguel.find('.button-present').trigger('click')

    expect(wrapper.find('[role="alert"]').text()).toContain('RNF-06')
    const entry = getAttendance().find(
      (e) => e.patientName === 'Miguel Fernández',
    )
    expect(entry?.status).toBe('Pendiente')
  })

  it('marca la asistencia de un paciente con consentimiento activo', async () => {
    signIn('voluntario@aspar.org', 'Voluntario2026!')
    const wrapper = mount(AttendanceView)

    const elena = wrapper
      .findAll('.attendance-row')
      .find((row) => row.text().includes('Elena Rojas'))!
    await elena.find('.button-present').trigger('click')

    const entry = getAttendance().find((e) => e.patientName === 'Elena Rojas')
    expect(entry?.status).toBe('Presente')
  })
})

describe('Inventario (/inventario) — RF-03, RF-09', () => {
  it('registra un material y lo filtra por origen', async () => {
    signIn('coordinacion@aspar.org', 'Coord2026!')
    const wrapper = mount(InventoryView)

    await wrapper.find('#inv-code').setValue('FIS-900')
    await wrapper.find('#inv-name').setValue('Banda elástica de resistencia')
    await wrapper.find('#inv-origin').setValue('Donación')
    await wrapper.find('form').trigger('submit.prevent')

    expect(getInventory().some((item) => item.code === 'FIS-900')).toBe(true)

    await wrapper
      .find('select[aria-label="Filtrar por origen"]')
      .setValue('Donación')
    const rows = wrapper.findAll('article.patient-row')
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((row) => row.text().includes('Donación'))).toBe(true)
  })

  it('exporta el reporte CSV para la Alcaldía (RF-09)', async () => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:reporte'),
      revokeObjectURL: vi.fn(),
    })
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined)
    signIn('coordinacion@aspar.org', 'Coord2026!')
    const wrapper = mount(InventoryView)

    const csvButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('CSV'))!
    await csvButton.trigger('click')

    expect(click).toHaveBeenCalled()
    expect(wrapper.find('[role="status"]').text()).toContain('formato CSV')
    click.mockRestore()
  })
})
