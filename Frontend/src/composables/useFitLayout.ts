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
  return useMediaQuery(FIT_LAYOUT_QUERY)
}

/** Si la ventana cumple una media query, y se actualiza cuando cambia de tamaño. */
export function useMediaQuery(media: string): Ref<boolean> {
  const matches = ref(false)
  if (typeof window === 'undefined' || !window.matchMedia) return matches

  const query = window.matchMedia(media)
  matches.value = query.matches
  const onChange = (event: MediaQueryListEvent) => {
    matches.value = event.matches
  }
  query.addEventListener('change', onChange)
  onBeforeUnmount(() => query.removeEventListener('change', onChange))
  return matches
}
