<script setup lang="ts">
/**
 * Íconos del sitio público (redes, WhatsApp y correo), en SVG y del color del texto.
 * Son decorativos: el enlace que los lleva siempre tiene su nombre escrito o un
 * aria-label.
 */
defineProps<{
  name: 'facebook' | 'instagram' | 'tiktok' | 'whatsapp' | 'mail'
  size?: number
}>()
</script>

<template>
  <svg
    class="site-icon"
    :width="size ?? 18"
    :height="size ?? 18"
    viewBox="0 0 16 16"
    aria-hidden="true"
    focusable="false"
  >
    <path
      v-if="name === 'facebook'"
      fill="currentColor"
      d="M16 8.05C16 3.6 12.42 0 8 0S0 3.6 0 8.05c0 4.02 2.93 7.35 6.75 7.95v-5.62H4.72V8.05h2.03V6.28c0-2.02 1.2-3.13 3.02-3.13.88 0 1.8.16 1.8.16v1.98h-1.01c-1 0-1.31.62-1.31 1.26v1.5h2.22l-.35 2.33H9.25V16C13.07 15.4 16 12.07 16 8.05z"
    />
    <path
      v-else-if="name === 'tiktok'"
      fill="currentColor"
      d="M9 0h1.98c.14.72.54 1.62 1.24 2.51C12.9 3.39 13.8 4 15 4v2c-1.75 0-3.07-.81-4-1.83V11a5 5 0 1 1-5-5v2a3 3 0 1 0 3 3z"
    />
    <g v-else-if="name === 'instagram'" fill="none" stroke="currentColor">
      <rect
        x="1.5"
        y="1.5"
        width="13"
        height="13"
        rx="3.8"
        stroke-width="1.4"
      />
      <circle cx="8" cy="8" r="3.1" stroke-width="1.4" />
      <circle cx="12" cy="4" r="0.6" fill="currentColor" stroke="none" />
    </g>
    <g v-else-if="name === 'whatsapp'">
      <path
        fill="none"
        stroke="currentColor"
        stroke-width="1.35"
        stroke-linejoin="round"
        d="M8 1.2a6.8 6.8 0 0 0-5.88 10.2L1.2 14.8l3.48-.9A6.8 6.8 0 1 0 8 1.2z"
      />
      <path
        fill="currentColor"
        d="M5.7 4.5c.18-.3.36-.32.55-.32h.36c.12 0 .28.03.4.32l.55 1.3c.08.2.03.36-.07.48l-.38.47c.42.82 1.08 1.47 1.9 1.9l.47-.38c.13-.1.3-.15.48-.07l1.3.55c.3.13.32.28.32.4v.36c0 .2-.03.38-.32.56-.48.3-1.35.43-2.55-.18a6.6 6.6 0 0 1-2.9-2.9c-.6-1.2-.47-2.06-.11-2.49z"
      />
    </g>
    <g v-else-if="name === 'mail'" fill="none" stroke="currentColor">
      <rect
        x="1.3"
        y="3"
        width="13.4"
        height="10"
        rx="1.6"
        stroke-width="1.4"
      />
      <path
        d="m1.8 4 6.2 4.7L14.2 4"
        stroke-width="1.4"
        stroke-linejoin="round"
      />
    </g>
  </svg>
</template>

<style scoped>
.site-icon {
  flex: none;
  display: inline-block;
  vertical-align: middle;
}
</style>
