/**
 * Cierre de sesión por inactividad (RNF-02: 15 minutos sin uso).
 *
 * - La API cierra la sesión si no recibe peticiones en `idleTimeout` segundos. Mientras
 *   la persona usa la pantalla (aunque no guarde nada), se renueva la sesión cada
 *   pocos minutos para que el servidor sepa que sigue ahí.
 * - Dos minutos antes del cierre se muestra un aviso con «Mantener la sesión activa».
 * - La última actividad se comparte entre pestañas (solo una marca de tiempo): una
 *   pestaña olvidada no cierra la sesión que se usa en otra.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import type { Session } from '../api/session'

export const LAST_ACTIVITY_KEY = 'aspar:ultima-actividad'
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart']

export interface IdleSessionOptions {
  session: Session
  /** Se llama después de cerrar la sesión por inactividad. */
  onExpired: () => void
  now?: () => number
  /** Antelación del aviso (por defecto, 2 minutos). */
  warningMs?: number
  /** Cada cuánto se avisa al servidor mientras hay actividad (por defecto, 5 minutos). */
  keepAliveEveryMs?: number
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null
}

function defaultStorage(): IdleSessionOptions['storage'] {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function useIdleSession(options: IdleSessionOptions) {
  const {
    session,
    onExpired,
    now = () => Date.now(),
    warningMs = 2 * 60_000,
    keepAliveEveryMs = 5 * 60_000,
    storage = defaultStorage(),
  } = options

  const clock = ref(now())
  const lastActivity = ref(now())
  let lastKeepAlive = now()
  let lastShared = 0
  let refreshing = false
  let expiring = false
  let timer: ReturnType<typeof setInterval> | undefined

  const idleMs = computed(() => (session.state.idleTimeout ?? 900) * 1000)

  function sharedActivity(): number {
    try {
      return Number(storage?.getItem(LAST_ACTIVITY_KEY)) || 0
    } catch {
      return 0
    }
  }

  function shareActivity(at: number): void {
    // Como máximo una escritura cada 5 segundos
    if (at - lastShared < 5_000) return
    lastShared = at
    try {
      storage?.setItem(LAST_ACTIVITY_KEY, String(at))
    } catch {
      // Sin almacenamiento (modo privado): cada pestaña cuenta por su cuenta
    }
  }

  const lastSeen = computed(() => {
    // Se recalcula en cada tic del reloj: la otra pestaña pudo haber escrito
    void clock.value
    return Math.max(lastActivity.value, sharedActivity())
  })
  const remainingMs = computed(() =>
    Math.max(0, lastSeen.value + idleMs.value - clock.value),
  )
  const warningOpen = computed(
    () =>
      session.isAuthenticated.value &&
      remainingMs.value > 0 &&
      remainingMs.value <= warningMs,
  )

  function registerActivity(): void {
    // Con el aviso abierto hay que elegir una opción: mover el ratón no basta
    if (warningOpen.value) return
    const at = now()
    lastActivity.value = at
    shareActivity(at)
  }

  async function keepAlive(): Promise<void> {
    if (refreshing || !session.isAuthenticated.value) return
    refreshing = true
    try {
      await session.refresh()
      const at = now()
      lastKeepAlive = at
      lastActivity.value = at
      clock.value = at
      lastShared = 0
      shareActivity(at)
    } catch {
      // Un 401 ya marcó la sesión como vencida (la app vuelve al ingreso);
      // sin conexión se reintenta en el próximo ciclo
    } finally {
      refreshing = false
    }
  }

  async function expire(): Promise<void> {
    if (expiring) return
    expiring = true
    stop()
    await session.logout()
    onExpired()
  }

  function tick(): void {
    clock.value = now()
    if (!session.isAuthenticated.value) return
    if (remainingMs.value <= 0) {
      void expire()
      return
    }
    const recentlyActive = clock.value - lastSeen.value < 60_000
    if (
      !warningOpen.value &&
      recentlyActive &&
      clock.value - lastKeepAlive >= keepAliveEveryMs
    )
      void keepAlive()
  }

  function stop(): void {
    if (timer) clearInterval(timer)
    timer = undefined
    for (const event of ACTIVITY_EVENTS)
      window.removeEventListener(event, registerActivity)
  }

  onMounted(() => {
    registerActivity()
    for (const event of ACTIVITY_EVENTS)
      window.addEventListener(event, registerActivity, { passive: true })
    timer = setInterval(tick, 1_000)
  })

  onBeforeUnmount(stop)

  return {
    remainingMs,
    warningOpen,
    /** «Mantener la sesión activa». */
    keepAlive,
  }
}

/** 105 000 ms → «1:45» */
export function formatCountdown(ms: number): string {
  const total = Math.ceil(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
