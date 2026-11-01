/** Tipos mínimos de los scripts externos que usa el acceso (Turnstile y Google). */
interface TurnstileApi {
  render: (element: HTMLElement, options: Record<string, unknown>) => string
  reset: (widgetId?: string) => void
  remove: (widgetId?: string) => void
}

interface GoogleIdApi {
  initialize: (options: Record<string, unknown>) => void
  renderButton: (element: HTMLElement, options: Record<string, unknown>) => void
}

interface Window {
  turnstile?: TurnstileApi
  google?: { accounts?: { id?: GoogleIdApi } }
}
