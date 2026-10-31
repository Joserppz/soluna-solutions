/**
 * Cliente HTTP hacia la API FastAPI.
 *
 * - La sesión viaja en la cookie HttpOnly aspar_session: el navegador la envía sola
 *   (credentials: 'include') y JavaScript nunca ve el token.
 * - En POST/PUT/PATCH/DELETE se repite el token CSRF en el encabezado X-CSRF-Token.
 *   El token llega en cada respuesta de sesión (login, /auth/me, refresh) y además en
 *   la cookie legible aspar_csrf.
 * - Todo error se convierte en ApiError con el mensaje "detail" de la API.
 */
import { ApiError, NETWORK_ERROR_MESSAGE, defaultMessage } from './errors'

export const CSRF_HEADER = 'X-CSRF-Token'
export const CSRF_COOKIE = 'aspar_csrf'
const DEFAULT_API_BASE_URL = 'http://localhost:8000/api/v1'
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
export type QueryValue = string | number | boolean | null | undefined
export type Query = Record<string, QueryValue>

export interface RequestOptions {
  query?: Query
  /** Objeto que se envía como JSON. */
  body?: unknown
  /** Formulario con archivos (multipart): el navegador pone el Content-Type. */
  form?: FormData
  /**
   * Petición sin sesión (login, registro, recuperación...): un 401 aquí significa
   * "datos incorrectos", no "la sesión venció".
   */
  anonymous?: boolean
  /** Devuelve el archivo (Blob) en vez de leer JSON: descargas CSV o Excel. */
  blob?: boolean
  signal?: AbortSignal
}

export interface HttpClientOptions {
  baseUrl?: string
  fetch?: typeof fetch
  /** Se llama cuando una petición con sesión recibe 401 (sesión vencida o cerrada). */
  onUnauthorized?: () => void
}

export function getApiBaseUrl(): string {
  const value = import.meta.env?.VITE_API_BASE_URL
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : DEFAULT_API_BASE_URL
}

export function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  for (const part of document.cookie.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return null
}

export function buildQuery(query: Query = {}): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    params.set(key, String(value))
  }
  const text = params.toString()
  return text ? `?${text}` : ''
}

export class HttpClient {
  private readonly baseUrl: string
  private readonly fetchImpl: typeof fetch
  private readonly onUnauthorized: (() => void) | undefined
  private csrfToken: string | null = null

  constructor(options: HttpClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? getApiBaseUrl()).replace(/\/+$/, '')
    this.fetchImpl = options.fetch ?? ((...args) => globalThis.fetch(...args))
    this.onUnauthorized = options.onUnauthorized
  }

  setCsrfToken(token: string | null): void {
    this.csrfToken = token
  }

  get<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('GET', path, options)
  }

  post<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('POST', path, options)
  }

  put<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('PUT', path, options)
  }

  patch<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('PATCH', path, options)
  }

  delete<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('DELETE', path, options)
  }

  async request<T>(
    method: HttpMethod,
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' }
    let body: BodyInit | undefined
    if (options.form) {
      body = options.form
    } else if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json'
      body = JSON.stringify(options.body)
    }
    if (UNSAFE_METHODS.has(method)) {
      const csrf = this.csrfToken ?? readCookie(CSRF_COOKIE)
      if (csrf) headers[CSRF_HEADER] = csrf
    }

    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}${buildQuery(options.query)}`
    let response: Response
    try {
      response = await this.fetchImpl(url, {
        method,
        headers,
        body,
        credentials: 'include',
        signal: options.signal,
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError')
        throw error
      throw new ApiError(0, NETWORK_ERROR_MESSAGE)
    }

    if (!response.ok) {
      if (response.status === 401 && !options.anonymous) this.onUnauthorized?.()
      throw await toApiError(response)
    }
    if (options.blob) return (await response.blob()) as T
    if (response.status === 204) return undefined as T
    const text = await response.text()
    return (text ? JSON.parse(text) : undefined) as T
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  let message = defaultMessage(response.status)
  try {
    const data = (await response.json()) as { detail?: unknown }
    if (typeof data?.detail === 'string' && data.detail.trim())
      message = data.detail
  } catch {
    // Respuesta sin JSON (por ejemplo, un proxy): queda el mensaje genérico
  }
  const retryAfter = Number(response.headers.get('Retry-After'))
  return new ApiError(
    response.status,
    message,
    Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
  )
}
