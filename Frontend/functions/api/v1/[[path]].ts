/**
 * Cloudflare Pages Function: reenvía /api/v1/* a la API en Cloud Run.
 *
 * El sitio (aspar.pages.dev) llama a la API en su mismo sitio, así las cookies de sesión
 * (SameSite=Lax, ADR-012) funcionan sin dominio propio. La dirección de Cloud Run va en la
 * variable API_ORIGIN del proyecto de Pages. Ver docs/despliegue/DESPLIEGUE_SIN_DOMINIO.md.
 *
 * X-Forwarded-For lleva solo la IP real de quien navega (la da Cloudflare); Google agrega
 * la de Cloudflare al final. Por eso la API usa PROXY_TRUSTED_HOPS=2.
 */
const METHODS_WITHOUT_BODY = ['GET', 'HEAD']

export interface ProxyContext {
  request: Request
  env: { API_ORIGIN?: string }
}

export async function onRequest({
  request,
  env,
}: ProxyContext): Promise<Response> {
  const origin = String(env.API_ORIGIN ?? '').replace(/\/+$/, '')
  if (!/^https?:\/\/[^/]+$/.test(origin)) {
    return Response.json(
      { detail: 'Falta configurar API_ORIGIN en Cloudflare Pages.' },
      { status: 503 },
    )
  }

  const url = new URL(request.url)
  const headers = new Headers(request.headers)
  headers.delete('host')
  const client = request.headers.get('cf-connecting-ip')
  if (client) headers.set('x-forwarded-for', client)
  else headers.delete('x-forwarded-for')

  return fetch(`${origin}${url.pathname}${url.search}`, {
    method: request.method,
    headers,
    body: METHODS_WITHOUT_BODY.includes(request.method)
      ? undefined
      : request.body,
    redirect: 'manual',
  })
}
