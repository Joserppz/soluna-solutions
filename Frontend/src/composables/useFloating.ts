import {
  nextTick,
  onBeforeUnmount,
  ref,
  watch,
  type CSSProperties,
  type Ref,
} from 'vue'

/**
 * Panel flotante (menús de «Descargar», filtro de fechas, calendario) que se dibuja sobre
 * la página, fuera de las tarjetas: una tarjeta con su propia barra de desplazamiento ya
 * no lo recorta. Se abre debajo del botón; si no entra, encima. Se alinea al borde del
 * botón que deje más lugar y nunca sale de la ventana.
 *
 * El panel va con <Teleport to="body"> y `:style="floatingStyle"`.
 */
export function useFloating(
  trigger: Ref<HTMLElement | null>,
  panel: Ref<HTMLElement | null>,
  open: Ref<boolean>,
  options: { gap?: number; margin?: number } = {},
) {
  const gap = options.gap ?? 8
  const margin = options.margin ?? 12
  const floatingStyle = ref<CSSProperties>({
    position: 'fixed',
    top: '0px',
    left: '0px',
    visibility: 'hidden',
  })

  function place() {
    const button = trigger.value?.getBoundingClientRect()
    const box = panel.value
    if (!button || !box) return
    const width = box.offsetWidth
    // El alto completo, aunque un máximo anterior lo esté recortando
    const height = Math.max(box.offsetHeight, box.scrollHeight + 2)
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    const below = viewportHeight - button.bottom - gap - margin
    const above = button.top - gap - margin
    let top: number
    let room: number
    if (height <= below) {
      top = button.bottom + gap
      room = below
    } else if (height <= above) {
      top = button.top - gap - height
      room = above
    } else {
      // No entra ni arriba ni abajo: se muestra entero sobre el botón, sin recortarlo
      room = viewportHeight - 2 * margin
      top = Math.max(
        margin,
        Math.min(button.bottom + gap, viewportHeight - margin - height),
      )
    }

    // Alineado al borde derecho del botón si a la derecha falta lugar
    let left = button.left
    if (left + width > viewportWidth - margin) left = button.right - width
    left = Math.min(
      Math.max(margin, left),
      Math.max(margin, viewportWidth - margin - width),
    )

    floatingStyle.value = {
      position: 'fixed',
      top: `${Math.round(top)}px`,
      left: `${Math.round(left)}px`,
      maxHeight: `${Math.round(Math.max(120, room))}px`,
      overflowY: 'auto',
      visibility: 'visible',
    }
  }

  /** Coloca el panel ya (visible) para poder darle el foco. */
  async function ready() {
    await nextTick()
    place()
  }

  function onMove() {
    if (open.value) place()
  }

  watch(open, async (value) => {
    if (value) {
      floatingStyle.value = { ...floatingStyle.value, visibility: 'hidden' }
      await nextTick()
      place()
      window.addEventListener('resize', onMove)
      window.addEventListener('scroll', onMove, true)
    } else {
      window.removeEventListener('resize', onMove)
      window.removeEventListener('scroll', onMove, true)
    }
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', onMove)
    window.removeEventListener('scroll', onMove, true)
  })

  return { floatingStyle, place, ready }
}

/**
 * Cierra el panel con un clic fuera del botón y del panel (que va en <body>) y con Esc,
 * esté donde esté el foco (`onEscape`, que suele devolver el foco al botón).
 */
export function useClickOutside(
  elements: Ref<HTMLElement | null>[],
  open: Ref<boolean>,
  close: () => void,
  onEscape: () => void = close,
) {
  function onDocumentClick(event: MouseEvent) {
    const target = event.target as Node
    if (!open.value) return
    if (elements.some((element) => element.value?.contains(target))) return
    close()
  }
  function onKey(event: KeyboardEvent) {
    if (open.value && event.key === 'Escape') {
      event.stopPropagation()
      onEscape()
    }
  }
  function stop() {
    document.removeEventListener('mousedown', onDocumentClick)
    document.removeEventListener('keydown', onKey)
  }
  watch(open, (value) => {
    if (value) {
      document.addEventListener('mousedown', onDocumentClick)
      document.addEventListener('keydown', onKey)
    } else stop()
  })
  onBeforeUnmount(stop)
}
