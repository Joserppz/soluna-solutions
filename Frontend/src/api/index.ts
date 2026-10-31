/**
 * Capa de datos nueva del frontend: cliente HTTP con cookies y CSRF, un método por
 * endpoint (tipado desde OpenAPI) y el estado de sesión y permisos.
 *
 *   import { api, session } from '../api'
 *   await session.login(email, password)
 *   if (session.can('patients:read')) await api.patients.list({ search: 'rojas' })
 *
 * Convive con src/services/ (modo demo) hasta que las vistas se migren.
 */
import { HttpClient } from './client'
import { createEndpoints } from './endpoints'
import { createSession } from './session'

export { ApiError, isApiError } from './errors'
export { HttpClient, getApiBaseUrl } from './client'
export { createEndpoints } from './endpoints'
export type { AsparApi } from './endpoints'
export { createSession } from './session'
export type { Session, SessionStatus } from './session'
export type * from './types'

// Un 401 en cualquier petición con sesión marca la sesión como vencida
export const http = new HttpClient({ onUnauthorized: () => session.expire() })
export const api = createEndpoints(http)
export const session = createSession(api, http)
