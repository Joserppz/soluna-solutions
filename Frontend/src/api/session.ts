/**
 * Estado de la sesión y permisos del usuario, compartido por toda la aplicación.
 *
 * La API es la fuente de verdad: los permisos llegan en cada respuesta de sesión y la
 * API los vuelve a verificar en cada petición. Aquí solo se usan para decidir qué
 * menús y botones mostrar.
 */
import { computed, reactive, readonly } from 'vue'

import type { HttpClient } from './client'
import type { AsparApi } from './endpoints'
import { isApiError } from './errors'
import type {
  ChangePasswordRequest,
  Permission,
  SessionOut,
  SessionUser,
} from './types'

/**
 * - unknown: todavía no se consultó /auth/me (al cargar la página).
 * - anonymous: no hay sesión.
 * - authenticated: hay sesión activa.
 * - expired: la sesión venció o se cerró en otra pestaña (la API respondió 401).
 */
export type SessionStatus =
  'unknown' | 'anonymous' | 'authenticated' | 'expired'

interface SessionState {
  status: SessionStatus
  user: SessionUser | null
  permissions: Permission[]
  /** Momento (ms) en que vence el token si no se renueva. */
  expiresAt: number | null
  /** Segundos de inactividad que cierran la sesión en el servidor. */
  idleTimeout: number | null
}

export function createSession(
  api: AsparApi,
  http: HttpClient,
  now: () => number = Date.now,
) {
  const state = reactive<SessionState>({
    status: 'unknown',
    user: null,
    permissions: [],
    expiresAt: null,
    idleTimeout: null,
  })

  function apply(session: SessionOut): SessionUser {
    state.status = 'authenticated'
    state.user = session.user
    state.permissions = [...session.permissions]
    state.expiresAt = now() + session.expiresIn * 1000
    state.idleTimeout = session.idleTimeout
    http.setCsrfToken(session.csrfToken)
    return session.user
  }

  function clear(status: SessionStatus): void {
    state.status = status
    state.user = null
    state.permissions = []
    state.expiresAt = null
    state.idleTimeout = null
    http.setCsrfToken(null)
  }

  return {
    state: readonly(state),
    isAuthenticated: computed(() => state.status === 'authenticated'),
    /** Cuenta sin rol: inició sesión pero espera la aprobación de Administración. */
    isPendingApproval: computed(
      () => state.user !== null && state.user.role === null,
    ),
    mustChangePassword: computed(() => state.user?.mustChangePassword === true),

    /** true si el usuario tiene TODOS los permisos indicados. */
    can(...permissions: Permission[]): boolean {
      return permissions.every((permission) =>
        state.permissions.includes(permission),
      )
    },

    /** true si tiene al menos uno de los permisos indicados. */
    canAny(...permissions: Permission[]): boolean {
      return permissions.some((permission) =>
        state.permissions.includes(permission),
      )
    },

    /** Recupera la sesión al cargar la página (la cookie sigue en el navegador). */
    async restore(): Promise<SessionUser | null> {
      try {
        return apply(await api.auth.me())
      } catch (error) {
        if (isApiError(error) && error.status === 401) {
          clear('anonymous')
          return null
        }
        throw error
      }
    },

    async login(email: string, password: string): Promise<SessionUser> {
      return apply(await api.auth.login({ email, password }))
    },

    async loginWithGoogle(credential: string): Promise<SessionUser> {
      return apply(await api.auth.loginWithGoogle({ credential }))
    },

    async refresh(): Promise<SessionUser> {
      return apply(await api.auth.refresh())
    },

    async changePassword(body: ChangePasswordRequest): Promise<SessionUser> {
      return apply(await api.auth.changePassword(body))
    },

    /** Cierra la sesión; aunque la API no responda, el navegador queda sin sesión. */
    async logout(): Promise<void> {
      try {
        await api.auth.logout()
      } catch (error) {
        if (!isApiError(error)) throw error
      } finally {
        clear('anonymous')
      }
    },

    /** La API respondió 401 a una petición con sesión. */
    expire(): void {
      if (state.status === 'authenticated') clear('expired')
    },
  }
}

export type Session = ReturnType<typeof createSession>
