import {
  onBeforeUnmount,
  onMounted,
  ref,
  toValue,
  type MaybeRefOrGetter,
} from 'vue'
import { onBeforeRouteLeave } from 'vue-router'

/**
 * Cambios sin guardar: antes de salir de la pantalla (otra sección del menú, otra pestaña
 * de la ficha) se pregunta con UnsavedChangesDialog; al cerrar o recargar la pestaña del
 * navegador avisa el propio navegador. Cerrar sesión o vencer la sesión no pregunta.
 */
export function useUnsavedChanges(dirty: MaybeRefOrGetter<boolean>) {
  const asking = ref(false)
  let answer: ((leave: boolean) => void) | null = null

  /** true si se puede seguir: no había cambios o la persona eligió descartarlos. */
  function confirmLeave(): Promise<boolean> {
    if (!toValue(dirty)) return Promise.resolve(true)
    answer?.(false)
    asking.value = true
    return new Promise((resolve) => {
      answer = resolve
    })
  }

  function respond(leave: boolean) {
    asking.value = false
    answer?.(leave)
    answer = null
  }

  onBeforeRouteLeave((to) => (to.name === 'ingresar' ? true : confirmLeave()))

  function onBeforeUnload(event: BeforeUnloadEvent) {
    if (!toValue(dirty)) return
    event.preventDefault()
    // Navegadores antiguos piden un texto; los actuales muestran el suyo
    event.returnValue = ''
  }

  onMounted(() => window.addEventListener('beforeunload', onBeforeUnload))
  onBeforeUnmount(() => {
    window.removeEventListener('beforeunload', onBeforeUnload)
    respond(false)
  })

  return {
    asking,
    confirmLeave,
    stay: () => respond(false),
    leave: () => respond(true),
  }
}
