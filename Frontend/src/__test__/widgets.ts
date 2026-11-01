/** Dobles de los widgets externos (Cloudflare Turnstile y Google) para las pruebas. */
import { vi } from 'vitest'

type Callback = (value: unknown) => void

/** Turnstile simulado: un botón «Soy una persona» que entrega un token. */
export function fakeTurnstile(token = 'token-humano') {
  let issued = 0
  const api = {
    render: vi.fn((element: HTMLElement, options: Record<string, unknown>) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'turnstile-falso'
      button.textContent = 'Soy una persona'
      button.addEventListener('click', () => {
        issued += 1
        ;(options.callback as Callback)(
          issued > 1 ? `${token}-${issued}` : token,
        )
      })
      element.appendChild(button)
      return `widget-${api.render.mock.calls.length}`
    }),
    reset: vi.fn(),
    remove: vi.fn(),
  }
  window.turnstile = api
  return api
}

/** Google Identity Services simulado: el botón entrega una credencial. */
export function fakeGoogle(credential = 'credencial-de-google') {
  let callback: Callback = () => undefined
  const api = {
    initialize: vi.fn((options: Record<string, unknown>) => {
      callback = options.callback as Callback
    }),
    renderButton: vi.fn(
      (element: HTMLElement, options: Record<string, unknown> = {}) => {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'google-falso'
        button.dataset.texto = String(options.text ?? '')
        button.textContent = 'Continuar con Google'
        button.addEventListener('click', () => callback({ credential }))
        element.appendChild(button)
      },
    ),
  }
  window.google = { accounts: { id: api } }
  return api
}

export function clearWidgets() {
  delete window.turnstile
  delete window.google
}
