/**
 * Carga un script externo una sola vez (Google Identity Services, Cloudflare
 * Turnstile). Si falla, la próxima llamada vuelve a intentarlo.
 */
const pending = new Map<string, Promise<void>>()

export function loadScript(src: string): Promise<void> {
  const existing = pending.get(src)
  if (existing) return existing

  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.defer = true
    script.addEventListener('load', () => resolve())
    script.addEventListener('error', () => {
      pending.delete(src)
      script.remove()
      reject(new Error(`No se pudo cargar ${src}`))
    })
    document.head.appendChild(script)
  })
  pending.set(src, promise)
  return promise
}
