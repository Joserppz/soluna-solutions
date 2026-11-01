/**
 * Acceso a la API y a la sesión desde los componentes.
 *
 * La aplicación entrega sus instancias con provide (main.ts); las pruebas entregan
 * instancias nuevas con un fetch simulado. Sin provide se usan las compartidas.
 */
import { inject, type InjectionKey } from 'vue'

import { api, http, session } from '../api'
import type { HttpClient } from '../api/client'
import type { AsparApi } from '../api/endpoints'
import type { Session } from '../api/session'

export interface ApiContext {
  api: AsparApi
  session: Session
  http: HttpClient
}

export const API_CONTEXT: InjectionKey<ApiContext> = Symbol('aspar-api')

export const defaultApiContext: ApiContext = { api, session, http }

export function useApi(): ApiContext {
  return inject(API_CONTEXT, defaultApiContext)
}
