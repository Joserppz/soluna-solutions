import { vi } from 'vitest'

import type { SessionOut } from '../types'

export interface FakeResponse {
  status?: number
  body?: unknown
  headers?: Record<string, string>
}

/** fetch simulado: responde en orden y guarda cada llamada para revisarla. */
export function fakeFetch(...responses: FakeResponse[]) {
  const queue = [...responses]
  // Los parámetros quedan en mock.calls para revisar url y opciones
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => {
    const next = queue.shift() ?? { status: 200, body: {} }
    const status = next.status ?? 200
    const text =
      next.body === undefined
        ? ''
        : typeof next.body === 'string'
          ? next.body
          : JSON.stringify(next.body)
    return new Response(status === 204 ? null : text, {
      status,
      headers: next.headers,
    })
  })
}

export type FakeFetch = ReturnType<typeof fakeFetch>

export function call(fetchMock: FakeFetch, index = 0) {
  const [url, init] = fetchMock.mock.calls[index]
  return {
    url: String(url),
    init: init as RequestInit,
    headers: (init?.headers ?? {}) as Record<string, string>,
  }
}

export function sessionOut(overrides: Partial<SessionOut> = {}): SessionOut {
  return {
    user: {
      id: 'u-1',
      name: 'Lucía Choque',
      email: 'admin@aspar.org',
      role: 'admin',
      roleName: 'Administración',
      department: 'Dirección',
      active: true,
      emailVerified: true,
      mustChangePassword: false,
      hasPassword: true,
      googleLinked: false,
    },
    permissions: ['patients:read', 'patients:write', 'audit:read'],
    expiresIn: 1800,
    idleTimeout: 900,
    csrfToken: 'csrf-1',
    ...overrides,
  }
}
