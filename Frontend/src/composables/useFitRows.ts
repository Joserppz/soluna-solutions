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
  options: { rowHeight: number; fallback: number; min?: number },
) {
  const fit = useFitLayout()
  const rows = ref(options.fallback)
  const pageSize = computed(() => (fit.value ? rows.value : options.fallback))

  function measure() {
    const element = area.value
    if (!fit.value || !element || !element.clientHeight) return
    const head =
      element.querySelector('thead')?.getBoundingClientRect().height ?? 44
    const row =
      element.querySelector('tbody tr')?.getBoundingClientRect().height ||
      options.rowHeight
    rows.value = rowsThatFit(element.clientHeight - head, row, options.min)
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
