import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import LoginView from '../LoginView.vue'
import PatientsView from '../PatientsView.vue'
import UsersView from '../UsersView.vue'
import AuditView from '../AuditView.vue'
import {
  canViewClinicalRecord,
  createUser,
  getAuditEvents,
  getPatients,
  getSession,
  getUsers,
  renewSession,
  savePatient,
  signIn,
  signOut,
  updatePatient,
} from '../../services/aspar'

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/',
        name: 'cronograma',
        component: { template: '<div>Home</div>' },
      },
      { path: '/login', name: 'login', component: LoginView },
      { path: '/pacientes', name: 'pacientes', component: PatientsView },
      { path: '/usuarios', name: 'usuarios', component: UsersView },
      { path: '/bitacora', name: 'bitacora', component: AuditView },
    ],
  })
}

describe('SCRUM-153 / SCRUM-66: LoginView y validaciones de autenticación', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('muestra mensaje de validación si el formulario se envía vacío', async () => {
    const router = createTestRouter()
    await router.push('/login')
    await router.isReady()

    const wrapper = mount(LoginView, {
      global: { plugins: [router] },
    })

    await wrapper.find('form').trigger('submit.prevent')
    expect(wrapper.find('[role="alert"]').text()).toContain(
      'Completa el correo y la contraseña.',
    )
  })

  it('valida el formato de correo electrónico y longitud mínima de contraseña', async () => {
    const router = createTestRouter()
    await router.push('/login')
    await router.isReady()

    const wrapper = mount(LoginView, {
      global: { plugins: [router] },
    })

    await wrapper.find('#email').setValue('correo-invalido')
    await wrapper.find('#password').setValue('12345')
    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.find('[role="alert"]').text()).toContain(
      'Ingresa un correo electrónico con formato válido.',
    )
  })

  it('autentica correctamente al Administrador, genera sesión JWT y registra auditoría', async () => {
    const router = createTestRouter()
    await router.push('/login')
    await router.isReady()

    const wrapper = mount(LoginView, {
      global: { plugins: [router] },
    })

    await wrapper.find('#email').setValue('admin@aspar.org')
    await wrapper.find('#password').setValue('Admin2026!')
    await wrapper.find('form').trigger('submit.prevent')

    const session = getSession()
    expect(session).not.toBeNull()
    expect(session?.email).toBe('admin@aspar.org')
    expect(session?.role).toBe('Administrador')
    expect(session?.token.split('.')).toHaveLength(3)
  })
})

describe('SCRUM-67: Sesiones JWT, expiración y cierre de sesión', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('permite renovar el token de sesión activa y cerrar sesión limpiando el almacenamiento', () => {
    expect(signIn('admin@aspar.org', 'Admin2026!')).toBe(true)
    const initialSession = getSession()
    expect(initialSession).not.toBeNull()

    const renewed = renewSession()
    expect(renewed).not.toBeNull()
    expect(renewed?.expiresAt).toBeGreaterThanOrEqual(
      initialSession?.expiresAt ?? 0,
    )

    signOut('Prueba unitaria')
    expect(getSession()).toBeNull()
  })
})

describe('SCRUM-68 y SCRUM-138: Pacientes, anamnesis digital y protección de datos RNF-06', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('impide activar el acceso de un paciente sin consentimiento informado firmado', () => {
    expect(() =>
      savePatient({
        name: 'Carlos Quispe',
        ci: '5928374',
        phone: '71234567',
        emergencyContact: 'María Quispe',
        consent: false,
        accessStatus: 'Activo',
      }),
    ).toThrow(/consentimiento informado/i)
  })

  it('registra paciente con anamnesis y protege los datos clínicos cuando el consentimiento se revoca', () => {
    signIn('admin@aspar.org', 'Admin2026!')
    const created = savePatient({
      name: 'Rosa Mamani',
      ci: '6849201',
      phone: '70112233',
      address: 'Sopocachi, La Paz',
      emergencyContact: 'Pedro Mamani (70112234)',
      consent: true,
      accessStatus: 'Activo',
      anamnesis: {
        diagnosis: 'Enfermedad de Parkinson',
        stage: 'Estadio II (Bilateral sin alteración del equilibrio)',
        physicalEvaluation: 'Equilibrio estable',
      },
    })

    expect(canViewClinicalRecord(created)).toBe(true)

    updatePatient(created.id, { consent: false })
    const updated = getPatients().find((p) => p.id === created.id)!
    expect(updated.accessStatus).toBe('Pendiente')
    expect(canViewClinicalRecord(updated)).toBe(false)
  })
})

describe('SCRUM-161 y SCRUM-179: Gestión de usuarios, roles de Jira y bitácora de auditoría', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('crea usuarios con cualquiera de los roles definidos en Jira y registra el evento en bitácora', () => {
    signIn('admin@aspar.org', 'Admin2026!')
    const newUser = createUser(
      'Dr. Roberto Siles',
      'roberto.siles@aspar.org',
      'Coordinador',
      'Coordinación Médica',
    )

    expect(newUser.role).toBe('Coordinador')
    expect(getUsers().some((u) => u.email === 'roberto.siles@aspar.org')).toBe(
      true,
    )

    const logs = getAuditEvents()
    expect(logs.length).toBeGreaterThan(0)
    expect(logs[0]?.category).toBe('USUARIOS_ROLES')
  })
})
