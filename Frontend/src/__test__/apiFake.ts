/**
 * API simulada para las pruebas de vistas: responde según «MÉTODO /ruta» y guarda cada
 * llamada. Una ruta puede tener una respuesta fija, una lista (una por llamada; la
 * última se repite) o una función.
 */
import { flushPromises, mount } from '@vue/test-utils'
import { vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import type { Component } from 'vue'

import App from '../App.vue'
import { HttpClient } from '../api/client'
import { createEndpoints } from '../api/endpoints'
import { createSession } from '../api/session'
import type { SessionOut } from '../api/types'
import { API_CONTEXT, type ApiContext } from '../composables/useApi'
import { useToast } from '../composables/useToast'
import { createAppRouter } from '../router'

export interface FakeReply {
  status?: number
  body?: unknown
}

type Handler =
  | FakeReply
  | FakeReply[]
  | ((request: RecordedCall) => FakeReply | Promise<FakeReply>)

export interface RecordedCall {
  method: string
  path: string
  query: URLSearchParams
  body: unknown
  headers: Record<string, string>
}

const BASE = 'https://api.aspar.test/api/v1'

export function createApiFake(handlers: Record<string, Handler> = {}) {
  const routes = new Map(Object.entries(handlers))
  const counters = new Map<string, number>()
  const calls: RecordedCall[] = []

  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input))
      const method = (init?.method ?? 'GET').toUpperCase()
      const path = url.pathname.replace('/api/v1', '')
      const body =
        typeof init?.body === 'string'
          ? JSON.parse(init.body)
          : (init?.body ?? null)
      const call: RecordedCall = {
        method,
        path,
        query: url.searchParams,
        body,
        headers: (init?.headers ?? {}) as Record<string, string>,
      }
      calls.push(call)

      const key = `${method} ${path}`
      const handler = routes.get(key)
      let reply: FakeReply
      if (!handler)
        reply = { status: 404, body: { detail: `Sin respuesta para ${key}` } }
      else if (typeof handler === 'function') reply = await handler(call)
      else if (Array.isArray(handler)) {
        const index = counters.get(key) ?? 0
        counters.set(key, index + 1)
        reply = handler[Math.min(index, handler.length - 1)]!
      } else reply = handler

      // status 0 = sin conexión (fetch no llega al servidor)
      if (reply.status === 0) throw new TypeError('Failed to fetch')
      const status = reply.status ?? 200
      return new Response(
        status === 204 || reply.body === undefined
          ? null
          : JSON.stringify(reply.body),
        { status, headers: { 'Content-Type': 'application/json' } },
      )
    },
  )

  const http = new HttpClient({
    baseUrl: BASE,
    fetch: fetchMock as unknown as typeof fetch,
    onUnauthorized: () => session.expire(),
  })
  const api = createEndpoints(http)
  const session = createSession(api, http)
  const context: ApiContext = { api, session, http }

  return {
    context,
    calls,
    fetchMock,
    /** Cambia o agrega una respuesta durante la prueba. */
    on(key: string, handler: Handler) {
      routes.set(key, handler)
      counters.delete(key)
    },
    callsTo(key: string) {
      return calls.filter((call) => `${call.method} ${call.path}` === key)
    },
  }
}

export type ApiFake = ReturnType<typeof createApiFake>

export const NO_SESSION: FakeReply = {
  status: 401,
  body: { detail: 'Inicia sesión para continuar.' },
}

export function sessionFor(
  overrides: Partial<SessionOut['user']> = {},
  permissions: SessionOut['permissions'] = [],
): SessionOut {
  return {
    user: {
      id: 'u-1',
      name: 'Lucía Choque',
      email: 'lucia@aspar.org',
      role: 'admin',
      roleName: 'Administración',
      department: 'Dirección',
      active: true,
      emailVerified: true,
      mustChangePassword: false,
      hasPassword: true,
      googleLinked: false,
      ...overrides,
    },
    permissions,
    expiresIn: 1800,
    idleTimeout: 900,
    csrfToken: 'csrf-prueba',
  }
}

export const ALL_PERMISSIONS: SessionOut['permissions'] = [
  'patients:read',
  'patients:write',
  'patients:read_clinical',
  'patients:write_clinical',
  'patients:deactivate',
  'documents:upload',
  'documents:delete',
  'attendance:write',
  'schedules:manage',
  'inventory:manage',
  'donations:manage',
  'inquiries:manage',
  'media:manage',
  'content:manage',
  'users:manage',
  'roles:manage',
  'audit:read',
]

export const ADMIN_SESSION = sessionFor({}, ALL_PERMISSIONS)

export const VOLUNTEER_SESSION = sessionFor(
  {
    name: 'Daniel Quispe',
    email: 'voluntario@aspar.org',
    role: 'volunteer',
    roleName: 'Voluntariado',
  },
  ['patients:read', 'attendance:write'],
)

export const PENDING_SESSION = sessionFor({
  name: 'Gabriela Rocha',
  email: 'gabriela@gmail.com',
  role: null,
  roleName: 'Pendiente de aprobación',
})

export const DASHBOARD = {
  toReview: {
    newInquiries: 4,
    donationsToConfirm: 5,
    patientsWithoutConsent: 2,
    damagedItems: 1,
  },
  nextActivity: null,
  upcoming: null,
  attendanceLastSaturdays: null,
  patients: null,
}

/** Monta la aplicación completa (App + router real) en la ruta indicada. */
export async function mountApp(path: string, fake: ApiFake) {
  useToast().clear()
  const router = createAppRouter(fake.context, createMemoryHistory())
  // Las vistas se cargan bajo demanda: se precargan para que cada navegación de la
  // prueba se resuelva sin esperar a que se transformen los módulos
  await Promise.all(
    router
      .getRoutes()
      .map((record) => record.components?.default)
      .filter(
        (view): view is () => Promise<unknown> => typeof view === 'function',
      )
      .map((load) => load()),
  )
  await router.push(path)
  await router.isReady()
  const wrapper = mount(App as Component, {
    attachTo: document.body,
    global: {
      plugins: [router],
      provide: { [API_CONTEXT as symbol]: fake.context },
    },
  })
  await settle()
  return { wrapper, router }
}

/**
 * Espera a que terminen las peticiones y las transiciones de ruta (las vistas se
 * cargan bajo demanda, así que hacen falta varias vueltas del ciclo de eventos).
 */
export async function settle() {
  for (let i = 0; i < 8; i += 1) {
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}
