/**
 * «Ventana completa»: en escritorio y laptops cada pantalla del equipo entra entera en
 * la ventana, sin barra de desplazamiento de la página. Las listas eligen cuántas filas
 * mostrar según el alto disponible. En el celular, en tabletas verticales o en
 * ventanas muy bajas, la página se desplaza con normalidad.
 *
 * El mismo criterio está en TeamLayout.vue (CSS): si cambia, cambia en los dos lados.
 */
import { onBeforeUnmount, ref, type Ref } from 'vue'

export const FIT_LAYOUT_QUERY = '(min-width: 1024px) and (min-height: 560px)'

export function useFitLayout(): Ref<boolean> {
  const fit = ref(false)
  if (typeof window === 'undefined' || !window.matchMedia) return fit

  const query = window.matchMedia(FIT_LAYOUT_QUERY)
  fit.value = query.matches
  const onChange = (event: MediaQueryListEvent) => {
    fit.value = event.matches
  }
  query.addEventListener('change', onChange)
  onBeforeUnmount(() => query.removeEventListener('change', onChange))
  return fit
}
