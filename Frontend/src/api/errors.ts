/** Errores de la API con un mensaje listo para mostrar a la persona. */

export const NETWORK_ERROR_MESSAGE =
  'No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.'

export class ApiError extends Error {
  /** Código HTTP; 0 si no hubo respuesta (sin conexión o servidor caído). */
  readonly status: number
  /** Segundos que pide esperar la API tras un 429 (encabezado Retry-After). */
  readonly retryAfter: number | null

  constructor(
    status: number,
    message: string,
    retryAfter: number | null = null,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.retryAfter = retryAfter
  }

  get isNetworkError(): boolean {
    return this.status === 0
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

/** Mensaje genérico por código, para cuando la respuesta no trae "detail". */
export function defaultMessage(status: number): string {
  if (status === 401) return 'Tu sesión terminó. Vuelve a iniciar sesión.'
  if (status === 403) return 'No tienes permiso para realizar esta acción.'
  if (status === 404) return 'No encontramos lo que buscabas.'
  if (status === 429) return 'Demasiados intentos. Espera un momento.'
  if (status >= 500)
    return 'Ocurrió un problema en el servidor. Intenta de nuevo.'
  return `No se pudo completar la solicitud (error ${status}).`
}
