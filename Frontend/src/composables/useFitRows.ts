/**
 * Cuántas filas de una tabla entran en su espacio en «ventana completa». Mide el alto
 * del contenedor (sin los títulos de las columnas) y vuelve a medir cuando cambia el
 * tamaño de la ventana. Fuera de ese modo la página se desplaza y se usa `fallback`.
 */
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type Ref,
} from 'vue'

import { rowsThatFit } from '../utils/pagination'
import { useFitLayout } from './useFitLayout'

export function useFitRows(
  area: Ref<HTMLElement | null>,
  options: {
    rowHeight: number
    fallback: number
    min?: number
    /** Alto fijo de los títulos (sin `thead`, como en una lista). */
    headHeight?: number
  },
) {
  const fit = useFitLayout()
  const rows = ref(options.fallback)
  const pageSize = computed(() => (fit.value ? rows.value : options.fallback))

  function measure() {
    const element = area.value
    if (!fit.value || !element || !element.clientHeight) return
    const head =
      options.headHeight ??
      element.querySelector('thead')?.getBoundingClientRect().height ??
      44
    // La altura de cada fila es fija (la misma que en el CSS): medir las filas no sirve,
    // porque la tabla las estira para llenar el espacio y el cálculo se volvería a sí mismo
    rows.value = rowsThatFit(
      element.clientHeight - head,
      options.rowHeight,
      options.min,
    )
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  let observer: ResizeObserver | null = null

  function observe(element: HTMLElement | null) {
    observer?.disconnect()
    if (!element || typeof ResizeObserver === 'undefined') return
    observer = new ResizeObserver(() => {
      clearTimeout(timer)
      timer = setTimeout(measure, 120)
    })
    observer.observe(element)
  }

  watch(area, (element) => {
    observe(element)
    measure()
  })
  watch(fit, () => nextTick(measure))

  onMounted(async () => {
    await nextTick()
    measure()
    observe(area.value)
  })

  onBeforeUnmount(() => {
    observer?.disconnect()
    clearTimeout(timer)
  })

  return { fit, pageSize, measure }
}
