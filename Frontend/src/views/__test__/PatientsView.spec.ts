import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import PatientsView from '../PatientsView.vue'
import { getPatients, signIn } from '../../services/aspar'

async function mountPatients() {
  const wrapper = mount(PatientsView)
  await flushPromises()
  return wrapper
}

function patientBlock(
  wrapper: Awaited<ReturnType<typeof mountPatients>>,
  name: string,
) {
  const block = wrapper
    .findAll('.patient-item-block')
    .find((item) => item.text().includes(name))
  if (!block) throw new Error(`No se encontró la ficha de ${name}`)
  return block
}

describe('SCRUM-68: PatientsView — listado y formulario de pacientes', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    signIn('admin@aspar.org', 'Admin2026!')
  })

  it('lista los pacientes y filtra por la búsqueda', async () => {
    const wrapper = await mountPatients()
    expect(wrapper.text()).toContain('Elena Rojas')
    expect(wrapper.text()).toContain('Miguel Fernández')

    await wrapper.find('input[aria-label="Buscar paciente"]').setValue('Miguel')

    expect(wrapper.findAll('.patient-item-block')).toHaveLength(1)
    expect(wrapper.text()).not.toContain('Elena Rojas')
  })

  it('registra un paciente desde el formulario y lo muestra en el listado', async () => {
    const wrapper = await mountPatients()

    await wrapper.find('#patient-name').setValue('Rosa Mamani')
    await wrapper.find('#patient-ci').setValue('6849201')
    await wrapper.find('#patient-phone').setValue('70112233')
    await wrapper.find('#patient-emergency').setValue('Pedro Mamani')
    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.find('.success-message').text()).toContain('guardadas')
    expect(patientBlock(wrapper, 'Rosa Mamani').exists()).toBe(true)
    expect(getPatients().some((p) => p.ci === '6849201')).toBe(true)
  })

  it('muestra el error de validación cuando la CI no es válida', async () => {
    const wrapper = await mountPatients()

    await wrapper.find('#patient-name').setValue('Rosa Mamani')
    await wrapper.find('#patient-ci').setValue('12')
    await wrapper.find('#patient-phone').setValue('70112233')
    await wrapper.find('#patient-emergency').setValue('Pedro Mamani')
    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.find('.form-error').text()).toContain('Cédula de Identidad')
  })
})

describe('SCRUM-138: PatientsView — consentimiento y estados de acceso', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    signIn('admin@aspar.org', 'Admin2026!')
  })

  it('muestra la anamnesis solo si hay consentimiento y acceso Activo', async () => {
    const wrapper = await mountPatients()

    const elena = patientBlock(wrapper, 'Elena Rojas')
    await elena.find('button').trigger('click')
    expect(elena.find('.anamnesis-grid').exists()).toBe(true)

    const miguel = patientBlock(wrapper, 'Miguel Fernández')
    await miguel.find('button').trigger('click')
    expect(miguel.find('.anamnesis-grid').exists()).toBe(false)
    expect(miguel.find('.protected-notice').exists()).toBe(true)
  })

  it('impide activar el acceso de un paciente sin consentimiento', async () => {
    const wrapper = await mountPatients()

    const miguel = patientBlock(wrapper, 'Miguel Fernández')
    await miguel.find('.access-control select').setValue('Activo')

    expect(wrapper.find('.form-error').text()).toContain(
      'sin consentimiento informado',
    )
    const stored = getPatients().find((p) => p.name === 'Miguel Fernández')
    expect(stored?.accessStatus).toBe('Pendiente')
  })

  it('oculta la anamnesis al revocar el consentimiento', async () => {
    const wrapper = await mountPatients()

    const elena = patientBlock(wrapper, 'Elena Rojas')
    await elena.find('input[type="checkbox"]').setValue(false)
    await patientBlock(wrapper, 'Elena Rojas').find('button').trigger('click')

    const updated = patientBlock(wrapper, 'Elena Rojas')
    expect(updated.find('.protected-notice').exists()).toBe(true)
  })
})
