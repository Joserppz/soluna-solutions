import { beforeEach, describe, expect, it, vi } from 'vitest'
import router from '../../router'
import {
  canViewClinicalRecord,
  getAuditEvents,
  getPatients,
  signIn,
  signOut,
} from '../../services/aspar'

// SCRUM-129 / SCRUM-162: permisos de Administrador y Voluntario en las rutas del panel
async function goTo(path: string) {
  await router.push(path)
  return router.currentRoute.value
}

describe('SCRUM-162: permisos por rol en el router', () => {
  beforeEach(async () => {
    localStorage.clear()
    vi.unstubAllGlobals()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    signOut()
    await router.push('/')
  })

  it('sin sesión redirige las rutas protegidas al login conservando el destino', async () => {
    const route = await goTo('/pacientes')

    expect(route.name).toBe('login')
    expect(route.query.redirect).toBe('/pacientes')
  })

  it.each(['/usuarios', '/bitacora'])(
    'el Voluntario no entra a %s y el intento queda en la bitácora',
    async (path) => {
      signIn('voluntario@aspar.org', 'Voluntario2026!')

      const route = await goTo(path)

      expect(route.name).toBe('asistencia')
      const blocked = getAuditEvents().find(
        (event) => event.action === 'Intento de acceso restringido bloqueado',
      )
      expect(blocked?.actorRole).toBe('Voluntario')
      expect(blocked?.detail).toContain(path)
    },
  )

  it('el Voluntario accede a pacientes y asistencia, pero no a la anamnesis', async () => {
    signIn('voluntario@aspar.org', 'Voluntario2026!')

    expect((await goTo('/pacientes')).name).toBe('pacientes')
    expect((await goTo('/asistencia')).name).toBe('asistencia')

    const conConsentimiento = getPatients().find(
      (patient) => patient.consent && patient.accessStatus === 'Activo',
    )!
    expect(canViewClinicalRecord(conConsentimiento)).toBe(false)
  })

  it('el Administrador accede a usuarios, bitácora y anamnesis', async () => {
    signIn('admin@aspar.org', 'Admin2026!')

    expect((await goTo('/usuarios')).name).toBe('usuarios')
    expect((await goTo('/bitacora')).name).toBe('bitacora')

    const conConsentimiento = getPatients().find(
      (patient) => patient.consent && patient.accessStatus === 'Activo',
    )!
    expect(canViewClinicalRecord(conConsentimiento)).toBe(true)
  })

  it('solo el Administrador y el Coordinador gestionan el cronograma (RF-04)', async () => {
    signIn('demo@aspar.org', 'Aspar2026!')
    expect((await goTo('/cronograma/gestion')).name).toBe('pacientes')

    signIn('coordinacion@aspar.org', 'Coord2026!')
    expect((await goTo('/cronograma/gestion')).name).toBe('gestion-cronograma')
  })

  it('con sesión activa, volver al login lleva a la pantalla de trabajo del rol', async () => {
    signIn('admin@aspar.org', 'Admin2026!')
    expect((await goTo('/login')).name).toBe('pacientes')

    signIn('voluntario@aspar.org', 'Voluntario2026!')
    expect((await goTo('/login')).name).toBe('asistencia')
  })
})
