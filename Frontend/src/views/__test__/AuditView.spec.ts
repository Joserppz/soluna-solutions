import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import AuditView from '../AuditView.vue'
import { addAudit, signIn } from '../../services/aspar'

describe('SCRUM-179: AuditView — bitácora solo para Administrador', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
  })

  it('bloquea la consulta a un rol distinto de Administrador', async () => {
    signIn('recepcion@aspar.org', 'Recep2026!')
    const wrapper = mount(AuditView)
    await flushPromises()

    expect(wrapper.find('[role="alert"]').text()).toContain(
      'Acceso restringido',
    )
    expect(wrapper.findAll('.audit-row')).toHaveLength(0)
  })

  it('muestra los eventos al Administrador y los filtra por severidad', async () => {
    signIn('admin@aspar.org', 'Admin2026!')
    addAudit('Desactivación de cuenta', 'Prueba', 'USUARIOS_ROLES', 'CRITICAL')
    const wrapper = mount(AuditView)
    await flushPromises()

    expect(wrapper.findAll('.audit-row').length).toBeGreaterThan(1)

    await wrapper
      .find('select[aria-label="Filtrar bitácora por severidad"]')
      .setValue('CRITICAL')

    const rows = wrapper.findAll('.audit-row')
    expect(rows).toHaveLength(1)
    expect(rows[0]?.text()).toContain('Desactivación de cuenta')
  })

  it('filtra por categoría y por texto de búsqueda', async () => {
    signIn('admin@aspar.org', 'Admin2026!')
    addAudit('Alta de paciente', 'Registró a Rosa Mamani', 'PACIENTES')
    const wrapper = mount(AuditView)
    await flushPromises()

    await wrapper
      .find('select[aria-label="Filtrar bitácora por categoría"]')
      .setValue('PACIENTES')
    expect(wrapper.findAll('.audit-row')).toHaveLength(1)

    await wrapper
      .find('input[aria-label="Buscar en bitácora"]')
      .setValue('no-existe')
    expect(wrapper.find('.empty-state').exists()).toBe(true)
  })
})
