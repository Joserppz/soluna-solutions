<script setup lang="ts">
withDefaults(
  defineProps<{
    width?: string
    height?: string
    radius?: string
    /** Repite el bloque como líneas de texto. */
    lines?: number
  }>(),
  { width: '100%', height: '1rem', radius: 'var(--radius-xs)', lines: 1 },
)
</script>

<template>
  <span class="skeleton-group" aria-hidden="true">
    <span
      v-for="line in lines"
      :key="line"
      class="skeleton"
      :style="{
        width: lines > 1 && line === lines ? '62%' : width,
        height,
        borderRadius: radius,
      }"
    />
  </span>
</template>

<style scoped>
.skeleton-group {
  display: grid;
  gap: var(--space-2);
  width: 100%;
}

.skeleton {
  display: block;
  background: linear-gradient(
    90deg,
    rgb(7 57 48 / 0.06) 0%,
    rgb(7 57 48 / 0.11) 40%,
    rgb(7 57 48 / 0.06) 80%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.4s ease-in-out infinite;
}

@keyframes skeleton-shimmer {
  from {
    background-position: 100% 0;
  }
  to {
    background-position: -100% 0;
  }
}
</style>
