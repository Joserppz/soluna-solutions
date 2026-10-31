import { describe, expect, it } from 'vitest'

import { HttpClient, CSRF_HEADER } from '../client'
import { createEndpoints } from '../endpoints'
import { createSession } from '../session'
import { call, fakeFetch, sessionOut } from './fakeFetch'

function setup(...responses: Parameters<typeof fakeFetch>) {
  const fetchMock = fakeFetch(...responses)
  const http = new HttpClient({
    baseUrl: 'https://api.aspar.test/api/v1',
    fetch: fetchMock,
    onUnauthorized: () => session.expire(),
  })
  const api = createEndpoints(http)
  const session = createSession(api, http, () => 1_000)
  return { fetchMock, api, session }
}

describe('Sesión', () => {
  it('empieza sin saber si hay sesión', () => {
    const { session } = setup()

    expect(session.state.status).toBe('unknown')
    expect(session.isAuthenticated.value).toBe(false)
    expect(session.can('patients:read')).toBe(false)
  })

  it('el login guarda usuario, permisos, vencimiento y token CSRF', async () => {
    const { session, api, fetchMock } = setup({ body: sessionOut() }, {})

    const user = await session.login('admin@aspar.org', 'Admin2026!')
    await api.patients.create({} as never)

    expect(user.email).toBe('admin@aspar.org')
    expect(call(fetchMock, 0).init.body).toBe(
      '{"email":"admin@aspar.org","password":"Admin2026!"}',
    )
    expect(session.state).toMatchObject({
      status: 'authenticated',
      expiresAt: 1_000 + 1800 * 1000,
      idleTimeout: 900,
    })
    expect(session.isAuthenticated.value).toBe(true)
    expect(call(fetchMock, 1).headers[CSRF_HEADER]).toBe('csrf-1')
  })

  it('can exige todos los permisos y canAny al menos uno', async () => {
    const { session } = setup({ body: sessionOut() })
    await session.login('admin@aspar.org', 'x')

    expect(session.can('patients:read', 'patients:write')).toBe(true)
    expect(session.can('patients:read', 'users:manage')).toBe(false)
    expect(session.canAny('users:manage', 'audit:read')).toBe(true)
    expect(session.canAny('users:manage', 'roles:manage')).toBe(false)
  })

  it('reconoce cuentas pendientes y contraseñas temporales', async () => {
    const pending = sessionOut({ permissions: [] })
    pending.user = { ...pending.user, role: null, mustChangePassword: true }
    const { session } = setup({ body: pending })

    await session.loginWithGoogle('id-token-google')

    expect(session.isPendingApproval.value).toBe(true)
    expect(session.mustChangePassword.value).toBe(true)
    expect(session.state.permissions).toEqual([])
  })

  it('restore recupera la sesión de la cookie o queda anónima', async () => {
    const withSession = setup({ body: sessionOut() })
    await withSession.session.restore()
    expect(withSession.session.state.status).toBe('authenticated')
    expect(call(withSession.fetchMock).url).toMatch(/\/auth\/me$/)

    const anonymous = setup({ status: 401, body: { detail: 'Inicia sesión.' } })
    await expect(anonymous.session.restore()).resolves.toBeNull()
    expect(anonymous.session.state.status).toBe('anonymous')
  })

  it('restore no oculta un servidor caído', async () => {
    const { session } = setup({ status: 503, body: { detail: 'Base caída' } })

    await expect(session.restore()).rejects.toMatchObject({ status: 503 })
  })

  it('un 401 en cualquier petición marca la sesión como vencida', async () => {
    const { session, api } = setup(
      { body: sessionOut() },
      { status: 401, body: { detail: 'La sesión expiró por inactividad.' } },
    )
    await session.login('admin@aspar.org', 'x')

    await expect(api.patients.list()).rejects.toMatchObject({ status: 401 })

    expect(session.state.status).toBe('expired')
    expect(session.state.user).toBeNull()
    expect(session.can('patients:read')).toBe(false)
  })

  it('refresh y cambio de contraseña actualizan la sesión', async () => {
    const changed = sessionOut({ csrfToken: 'csrf-2' })
    changed.user = { ...changed.user, mustChangePassword: false }
    const { session, fetchMock } = setup(
      { body: sessionOut() },
      { body: sessionOut({ expiresIn: 60 }) },
      { body: changed },
    )
    await session.login('admin@aspar.org', 'x')

    await session.refresh()
    expect(session.state.expiresAt).toBe(1_000 + 60 * 1000)

    await session.changePassword({
      currentPassword: 'Temporal-1234-Clave',
      newPassword: 'NuevaClave2026',
    })
    expect(call(fetchMock, 2).url).toMatch(/\/auth\/change-password$/)
    expect(call(fetchMock, 2).headers[CSRF_HEADER]).toBe('csrf-1')
  })

  it('logout limpia la sesión aunque la API no responda', async () => {
    const { session } = setup({ body: sessionOut() }, { status: 500 })
    await session.login('admin@aspar.org', 'x')

    await session.logout()

    expect(session.state.status).toBe('anonymous')
    expect(session.state.user).toBeNull()
  })

  it('expire no cambia una sesión que ya no estaba activa', () => {
    const { session } = setup()

    session.expire()

    expect(session.state.status).toBe('unknown')
  })
})
