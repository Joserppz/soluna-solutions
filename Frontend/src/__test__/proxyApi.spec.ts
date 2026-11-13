import { afterEach, describe, expect, it, vi } from 'vitest'

import { onRequest } from '../../functions/api/v1/[[path]]'

/** La Pages Function que reenvía /api/v1 a Cloud Run (sitio sin dominio propio). */
describe('Reenvío de /api/v1 en Cloudflare Pages', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function stubFetch() {
    const upstream = vi.fn<
      (url: string, init: RequestInit) => Promise<Response>
    >(
      async () =>
        new Response('{"ok":true}', {
          status: 200,
          headers: { 'set-cookie': 'aspar_session=abc; HttpOnly; Secure' },
        }),
    )
    vi.stubGlobal('fetch', upstream)
    return upstream
  }

  it('lleva la ruta y la búsqueda a la API, con la IP real de quien navega', async () => {
    const upstream = stubFetch()
    const request = new Request(
      'https://aspar.pages.dev/api/v1/patients?search=ana&limit=10',
      {
        headers: {
          'cf-connecting-ip': '198.51.100.23',
          'x-forwarded-for': '6.6.6.6',
          cookie: 'aspar_session=abc',
        },
      },
    )

    const response = await onRequest({
      request,
      env: { API_ORIGIN: 'https://aspar-api-123.southamerica-east1.run.app/' },
    })

    const [url, init] = upstream.mock.calls[0]!
    expect(url).toBe(
      'https://aspar-api-123.southamerica-east1.run.app/api/v1/patients?search=ana&limit=10',
    )
    const headers = new Headers(init.headers)
    // Un X-Forwarded-For inventado por el navegador no llega a la API
    expect(headers.get('x-forwarded-for')).toBe('198.51.100.23')
    expect(headers.get('cookie')).toBe('aspar_session=abc')
    expect(headers.has('host')).toBe(false)
    expect(init.method).toBe('GET')
    expect(init.body).toBeUndefined()
    expect(init.redirect).toBe('manual')
    // La respuesta vuelve tal cual, con la cookie de sesión
    expect(response.headers.get('set-cookie')).toContain('aspar_session=abc')
  })

  it('reenvía el cuerpo de un POST y quita X-Forwarded-For si no hay IP', async () => {
    const upstream = stubFetch()
    const request = new Request('https://aspar.pages.dev/api/v1/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '6.6.6.6',
      },
      body: '{"email":"a@b.c"}',
    })

    await onRequest({
      request,
      env: { API_ORIGIN: 'https://api.example.run.app' },
    })

    const [, init] = upstream.mock.calls[0]!
    expect(init.method).toBe('POST')
    expect(init.body).toBe(request.body)
    expect(new Headers(init.headers).has('x-forwarded-for')).toBe(false)
  })

  it('sin API_ORIGIN responde 503 y no llama a nadie', async () => {
    const upstream = stubFetch()
    const response = await onRequest({
      request: new Request('https://aspar.pages.dev/api/v1/health'),
      env: {},
    })

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({
      detail: 'Falta configurar API_ORIGIN en Cloudflare Pages.',
    })
    expect(upstream).not.toHaveBeenCalled()
  })
})
