/**
 * Notificaciones breves («toasts») compartidas por toda la aplicación.
 *
 *   const toast = useToast()
 *   toast.success('Cambios guardados')
 */
import { readonly, ref } from 'vue'

export type ToastTone = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  tone: ToastTone
  message: string
  /** Milisegundos visibles; 0 = hasta que la persona lo cierre. */
  duration: number
}

const toasts = ref<Toast[]>([])
const timers = new Map<number, ReturnType<typeof setTimeout>>()
let nextId = 1

const DEFAULT_DURATION: Record<ToastTone, number> = {
  success: 4000,
  info: 5000,
  // Los errores quedan más tiempo para que se alcancen a leer
  error: 8000,
}

function dismiss(id: number): void {
  toasts.value = toasts.value.filter((toast) => toast.id !== id)
  const timer = timers.get(id)
  if (timer) clearTimeout(timer)
  timers.delete(id)
}

function show(tone: ToastTone, message: string, duration?: number): number {
  const id = nextId++
  const toast: Toast = {
    id,
    tone,
    message,
    duration: duration ?? DEFAULT_DURATION[tone],
  }
  // Como máximo 4 a la vez: se descarta el más antiguo
  toasts.value = [...toasts.value.slice(-3), toast]
  if (toast.duration > 0)
    timers.set(
      id,
      setTimeout(() => dismiss(id), toast.duration),
    )
  return id
}

function clear(): void {
  for (const timer of timers.values()) clearTimeout(timer)
  timers.clear()
  toasts.value = []
}

export function useToast() {
  return {
    toasts: readonly(toasts),
    success: (message: string, duration?: number) =>
      show('success', message, duration),
    error: (message: string, duration?: number) =>
      show('error', message, duration),
    info: (message: string, duration?: number) =>
      show('info', message, duration),
    dismiss,
    clear,
  }
}
