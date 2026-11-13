<script setup lang="ts">
/**
 * Íconos de línea del espacio del equipo (menú, listas vacías, imprimir). Toman el color
 * del texto y son decorativos: el botón o enlace que los lleva tiene su nombre escrito.
 */
import { ICON_PATHS, type IconName } from '../../utils/icons'

defineProps<{ name: IconName; size?: number }>()
</script>

<template>
  <svg
    class="app-icon"
    :width="size ?? 20"
    :height="size ?? 20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path v-for="d in ICON_PATHS[name]" :key="d" :d="d" />
  </svg>
</template>

<style scoped>
.app-icon {
  flex: none;
  display: inline-block;
  vertical-align: middle;
}
</style>
