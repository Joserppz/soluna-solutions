import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  CSRF_HEADER,
  HttpClient,
  buildQuery,
  getApiBaseUrl,
  readCookie,
} from '../client'
import { ApiError, NETWORK_ERROR_MESSAGE, isApiError } from '../errors'
import { call, fakeFetch } from './fakeFetch'

const BASE = 'https://api.aspar.test/api/v1'

async function failure(request: Promise<unknown>): Promise<ApiError> {
  try {
    await request
  } catch (error) {
    return error as ApiError
  }
  throw new Error('Se esperaba un error de la API')
}

function client(
  fetchMock: ReturnType<typeof fakeFetch>,
  onUnauthorized = vi.fn(),
) {
  return new HttpClient({
    baseUrl: `${BASE}/`,
    fetch: fetchMock,
    onUnauthorized,
  })
}

afterEach(() => {
  document.cookie = 'aspar_csrf=; max-age=0; path=/'
})

describe('HttpClient', () => {
  it('envía siempre las cookies y pide JSON', async () => {
    const fetchMock = fakeFetch({ body: { ok: true } })

    const data = await client(fetchMock).get<{ ok: boolean }>('auth/me')

    expect(data).toEqual({ ok: true })
    const { url, init, headers } = call(fetchMock)
    expect(url).toBe(`${BASE}/auth/me`)
    expect(init.credentials).toBe('include')
    expect(init.method).toBe('GET')
    expect(headers.Accept).toBe('application/json')
    expect(headers[CSRF_HEADER]).toBeUndefined()
  })

  it('repite el token CSRF solo en peticiones que modifican datos', async () => {
    const fetchMock = fakeFetch({}, {}, {})
    const http = client(fetchMock)
    http.setCsrfToken('token-de-sesion')

    await http.get('/patients')
    await http.post('/patients', { body: { name: 'Elena' } })
    await http.delete('/patients/1/documents/2')

    expect(call(fetchMock, 0).headers[CSRF_HEADER]).toBeUndefined()
    expect(call(fetchMock, 1).headers[CSRF_HEADER]).toBe('token-de-sesion')
    expect(call(fetchMock, 1).headers['Content-Type']).toBe('application/json')
    expect(call(fetchMock, 1).init.body).toBe('{"name":"Elena"}')
    expect(call(fetchMock, 2).headers[CSRF_HEADER]).toBe('token-de-sesion')
  })

  it('sin token en memoria usa la cookie legible aspar_csrf', async () => {
    document.cookie = 'aspar_csrf=desde%20cookie; path=/'
    const fetchMock = fakeFetch({})

    await client(fetchMock).patch('/users/1', { body: { active: false } })

    expect(call(fetchMock).headers[CSRF_HEADER]).toBe('desde cookie')
  })

  it('un formulario con archivo va sin Content-Type (lo pone el navegador)', async () => {
    const fetchMock = fakeFetch({ status: 201, body: { id: 'd-1' } })
    const form = new FormData()
    form.append('documentType', 'Consentimiento')

    await client(fetchMock).post('/patients/1/documents', { form })

    expect(call(fetchMock).init.body).toBe(form)
    expect(call(fetchMock).headers['Content-Type']).toBeUndefined()
  })

  it('arma la consulta sin valores vacíos', async () => {
    const fetchMock = fakeFetch({ body: { items: [] } })

    await client(fetchMock).get('/patients', {
      query: { search: 'rojas', status: '', includeInactive: true, offset: 0 },
    })

    expect(call(fetchMock).url).toBe(
      `${BASE}/patients?search=rojas&includeInactive=true&offset=0`,
    )
    expect(buildQuery({ a: undefined, b: null })).toBe('')
  })

  it('una respuesta sin cuerpo devuelve undefined', async () => {
    const fetchMock = fakeFetch({ status: 204 }, { status: 200 })

    await expect(client(fetchMock).delete('/x')).resolves.toBeUndefined()
    await expect(client(fetchMock).get('/y')).resolves.toBeUndefined()
  })
})

describe('Errores', () => {
  it('usa el mensaje "detail" de la API', async () => {
    const fetchMock = fakeFetch({
      status: 409,
      body: { detail: 'Ya existe un afiliado con ese CI.' },
    })

    const error = await failure(
      client(fetchMock).post('/patients', { body: {} }),
    )

    expect(isApiError(error)).toBe(true)
    expect(error).toMatchObject({
      status: 409,
      message: 'Ya existe un afiliado con ese CI.',
      retryAfter: null,
      isNetworkError: false,
    })
  })

  it('sin "detail" usa un mensaje genérico según el código', async () => {
    const cases: [number, string][] = [
      [403, 'No tienes permiso'],
      [404, 'No encontramos'],
      [500, 'problema en el servidor'],
      [418, 'error 418'],
    ]
    for (const [status, text] of cases) {
      const fetchMock = fakeFetch({ status, body: '<html>proxy</html>' })
      const error = await failure(client(fetchMock).get('/x'))
      expect(error.message).toContain(text)
    }
  })

  it('un 429 informa cuántos segundos esperar', async () => {
    const fetchMock = fakeFetch({
      status: 429,
      body: { detail: 'Demasiados intentos.' },
      headers: { 'Retry-After': '120' },
    })

    const error = await failure(
      client(fetchMock).post('/auth/login', { body: {}, anonymous: true }),
    )

    expect(error.retryAfter).toBe(120)
  })

  it('sin conexión responde con un mensaje claro (status 0)', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new TypeError('Failed to fetch'))

    const error = await failure(
      new HttpClient({ baseUrl: BASE, fetch: fetchMock }).get('/patients'),
    )

    expect(error).toBeInstanceOf(ApiError)
    expect(error.isNetworkError).toBe(true)
    expect(error.message).toBe(NETWORK_ERROR_MESSAGE)
  })

  it('una petición cancelada no se disfraza de error de red', async () => {
    const abort = new DOMException('cancelada', 'AbortError')
    const fetchMock = vi.fn().mockRejectedValue(abort)

    await expect(
      new HttpClient({ baseUrl: BASE, fetch: fetchMock }).get('/x'),
    ).rejects.toBe(abort)
  })

  it('un 401 con sesión avisa que venció; en el login no', async () => {
    const onUnauthorized = vi.fn()
    const fetchMock = fakeFetch(
      { status: 401, body: { detail: 'Correo o contraseña incorrectos.' } },
      { status: 401, body: { detail: 'La sesión expiró.' } },
    )
    const http = client(fetchMock, onUnauthorized)

    await http
      .post('/auth/login', { body: {}, anonymous: true })
      .catch(() => {})
    expect(onUnauthorized).not.toHaveBeenCalled()

    await http.get('/patients').catch(() => {})
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })
})

describe('Configuración', () => {
  it('la URL base sale de VITE_API_BASE_URL o usa la local', () => {
    vi.stubEnv('VITE_API_BASE_URL', ' https://api.aspar.com/api/v1 ')
    expect(getApiBaseUrl()).toBe('https://api.aspar.com/api/v1')
    vi.stubEnv('VITE_API_BASE_URL', '')
    expect(getApiBaseUrl()).toBe('http://localhost:8000/api/v1')
    vi.unstubAllEnvs()
  })

  it('lee cookies por nombre exacto', () => {
    document.cookie = 'aspar_csrf=abc=123; path=/'
    expect(readCookie('aspar_csrf')).toBe('abc=123')
    expect(readCookie('aspar')).toBeNull()
  })
})
