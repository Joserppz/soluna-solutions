import { afterEach, describe, expect, it, vi } from 'vitest'

import { api, http, isApiError, session } from '../index'
import { fakeFetch, sessionOut } from './fakeFetch'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Instancias compartidas de src/api', () => {
  it('un 401 de cualquier vista vence la sesión compartida', async () => {
    vi.stubGlobal(
      'fetch',
      fakeFetch(
        { body: sessionOut() },
        { status: 401, body: { detail: 'La sesión expiró.' } },
      ),
    )

    await session.login('admin@aspar.org', 'Admin2026!')
    expect(session.isAuthenticated.value).toBe(true)

    const error = await api.audit.list().catch((e: unknown) => e)

    expect(isApiError(error) && error.status).toBe(401)
    expect(session.state.status).toBe('expired')
    expect(http).toBeDefined()
  })
})
