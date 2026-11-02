<script setup lang="ts">
/**
 * Encabezado que queda fijo arriba mientras la página se desplaza. La página sigue
 * con una sola barra de desplazamiento: solo pasa por debajo lo que viene después
 * (listas, formularios, tablas).
 *
 * - Al quedar fijo recibe la clase `is-stuck` (y el slot, `stuck`): cada vista decide
 *   qué esconder para que ocupe menos alto.
 * - Cuando se achica, deja un margen igual a lo que perdió: el contenido de abajo no
 *   salta ni la página cambia de alto.
 * - Publica en `--sticky-header-bottom` dónde termina, para que los títulos de una
 *   tabla (DataTable con `sticky-head`) se queden justo debajo.
 *
 * Debe ser hijo directo del contenedor de toda la vista: solo se queda fijo mientras
 * su contenedor sigue en pantalla.
 */
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

const root = ref<HTMLElement | null>(null)
const stuck = ref(false)
const compensation = ref(0)

/** Alto completo (sin achicar) y posición en la página cuando no está fijo. */
let fullHeight = 0
let naturalTop = 0
let frame = 0
let resize: ResizeObserver | null = null

/** Distancia desde arriba a la que se fija (alto de la barra superior del celular). */
function stickyTop(): number {
  return root.value ? parseFloat(getComputedStyle(root.value).top) || 0 : 0
}

async function update() {
  frame = 0
  const element = root.value
  if (!element) return
  const top = stickyTop()
  const rect = element.getBoundingClientRect()
  const nowStuck = window.scrollY > 0 && rect.top <= top + 0.5
  if (!nowStuck) naturalTop = rect.top + window.scrollY
  if (nowStuck !== stuck.value) {
    stuck.value = nowStuck
    // Se mide con la vista ya achicada (o agrandada), antes de que se pinte
    await nextTick()
  }

  // Con decimales: así no se acumulan redondeos al compensar
  const height = element.getBoundingClientRect().height
  if (!nowStuck) fullHeight = height
  compensation.value = nowStuck ? Math.max(0, fullHeight - height) : 0
  document.documentElement.style.setProperty(
    '--sticky-header-bottom',
    `${top + height}px`,
  )
}

function schedule() {
  if (!frame) frame = requestAnimationFrame(() => void update())
}

/**
 * Si el encabezado está fijo, lleva la página al punto donde el contenido empieza
 * justo debajo de él (por ejemplo, al cambiar de pestaña o de página).
 */
function scrollToStart() {
  if (!stuck.value) return
  window.scrollTo({
    top: Math.max(0, naturalTop - stickyTop() + compensation.value),
  })
}

onMounted(() => {
  // Recién montado nunca está achicado: este es su alto completo, aunque la página
  // llegue ya desplazada
  fullHeight = root.value?.getBoundingClientRect().height ?? 0
  void update()
  window.addEventListener('scroll', schedule, { passive: true })
  window.addEventListener('resize', schedule)
  if (typeof ResizeObserver !== 'undefined' && root.value) {
    resize = new ResizeObserver(schedule)
    resize.observe(root.value)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', schedule)
  window.removeEventListener('resize', schedule)
  resize?.disconnect()
  if (frame) cancelAnimationFrame(frame)
  document.documentElement.style.removeProperty('--sticky-header-bottom')
})

defineExpose({ scrollToStart, stuck })
</script>

<template>
  <div
    ref="root"
    class="sticky-header"
    :class="{ 'is-stuck': stuck }"
    :style="compensation ? { marginBottom: `${compensation}px` } : undefined"
  >
    <slot :stuck="stuck" />
  </div>
</template>

<style scoped>
.sticky-header {
  position: sticky;
  top: var(--team-sticky-top, 0px);
  z-index: var(--z-sticky);
  background: var(--color-bg);
}

.sticky-header.is-stuck {
  box-shadow: 0 10px 12px -12px rgb(7 57 48 / 0.35);
}
</style>
