import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import PatientsView from '../PatientsView.vue'
import { getPatients, savePatient, signIn } from '../../services/aspar'

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

describe('SCRUM-138: campos y acciones de pacientes según el rol (RNF-06)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
  })

  it('Recepción registra la filiación sin ver los campos clínicos', async () => {
    signIn('recepcion@aspar.org', 'Recep2026!')
    const wrapper = await mountPatients()

    expect(wrapper.find('#patient-phys').exists()).toBe(false)
    expect(wrapper.find('#patient-speech').exists()).toBe(false)
    expect(wrapper.find('#patient-psych').exists()).toBe(false)
    expect(wrapper.find('.field-note').text()).toContain('personal clínico')

    await wrapper.find('#patient-name').setValue('Rosa Mamani')
    await wrapper.find('#patient-ci').setValue('6849201')
    await wrapper.find('#patient-phone').setValue('70112233')
    await wrapper.find('#patient-emergency').setValue('Pedro Mamani')
    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.find('.success-message').exists()).toBe(true)
  })

  it('el Profesional ve y registra las evaluaciones clínicas', async () => {
    signIn('demo@aspar.org', 'Aspar2026!')
    const wrapper = await mountPatients()

    expect(wrapper.find('#patient-phys').exists()).toBe(true)
    expect(wrapper.find('.field-note').exists()).toBe(false)
  })

  it('el Voluntario consulta el listado pero no registra ni edita', async () => {
    signIn('voluntario@aspar.org', 'Voluntario2026!')
    const wrapper = await mountPatients()

    expect(wrapper.find('#patient-name').exists()).toBe(false)
    expect(wrapper.find('.notice-card').text()).toContain('Voluntario')
    const elena = patientBlock(wrapper, 'Elena Rojas')
    expect(
      elena.find('input[type="checkbox"]').attributes('disabled'),
    ).toBeDefined()
    expect(
      elena.find('.access-control select').attributes('disabled'),
    ).toBeDefined()
  })

  it('el aviso 🔒 indica el motivo real: el rol o el consentimiento', async () => {
    signIn('voluntario@aspar.org', 'Voluntario2026!')
    let wrapper = await mountPatients()
    let elena = patientBlock(wrapper, 'Elena Rojas')
    await elena.find('button').trigger('click')
    expect(elena.find('.protected-notice').text()).toContain(
      'Tu rol (Voluntario) no tiene acceso',
    )

    signIn('admin@aspar.org', 'Admin2026!')
    wrapper = await mountPatients()
    const miguel = patientBlock(wrapper, 'Miguel Fernández')
    await miguel.find('button').trigger('click')
    expect(miguel.find('.protected-notice').text()).toContain(
      'no tiene consentimiento informado firmado',
    )
    elena = patientBlock(wrapper, 'Elena Rojas')
    await elena.find('button').trigger('click')
    expect(elena.find('.anamnesis-grid').exists()).toBe(true)
  })

  it('el servicio descarta las evaluaciones que envía un rol no clínico', () => {
    signIn('recepcion@aspar.org', 'Recep2026!')

    const created = savePatient({
      name: 'Luis Condori',
      ci: '5512345',
      phone: '71234567',
      emergencyContact: 'Ana Condori',
      consent: false,
      accessStatus: 'Pendiente',
      anamnesis: {
        diagnosis: 'Enfermedad de Parkinson',
        physicalEvaluation: 'No debería guardarse',
        medications: 'No debería guardarse',
      },
    })

    expect(created.anamnesis.diagnosis).toBe('Enfermedad de Parkinson')
    expect(created.anamnesis.physicalEvaluation).toBe('')
    expect(created.anamnesis.medications).toBe('')
  })
})
