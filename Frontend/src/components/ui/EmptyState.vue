<script setup lang="ts">
import type { IconName } from '../../utils/icons'
import AppIcon from './AppIcon.vue'

/**
 * Lista vacía: un dibujo simple, qué pasa y, si corresponde, el botón para crear lo
 * primero (slot «actions»). `compact` es para cuadros chicos o tablas en ventana completa.
 */
withDefaults(
  defineProps<{
    icon: IconName
    title: string
    text?: string
    compact?: boolean
  }>(),
  { text: undefined, compact: false },
)
</script>

<template>
  <div class="empty-state" :class="{ 'empty-state--compact': compact }">
    <span class="empty-state__art" aria-hidden="true">
      <AppIcon :name="icon" :size="compact ? 26 : 32" />
    </span>
    <p class="empty-state__title">{{ title }}</p>
    <p v-if="text" class="empty-state__text">{{ text }}</p>
    <div v-if="$slots.actions" class="empty-state__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.empty-state {
  display: grid;
  justify-items: center;
  gap: var(--space-2);
  padding: var(--space-8) var(--space-4);
  text-align: center;
  white-space: normal;
}

.empty-state__art {
  position: relative;
  display: grid;
  place-items: center;
  width: 4.5rem;
  height: 4.5rem;
  margin-bottom: var(--space-2);
  border-radius: 50%;
  background: var(--rosa-100);
  color: var(--aspar-guindo);
}

/* Un anillo punteado alrededor: «aquí irá lo primero» */
.empty-state__art::after {
  content: '';
  position: absolute;
  inset: -0.45rem;
  border: 1.5px dashed rgb(109 22 25 / 0.28);
  border-radius: 50%;
}

.empty-state__title {
  max-width: 32rem;
  margin: 0;
  color: var(--color-heading);
  font-weight: 600;
  font-size: var(--text-lg);
}

.empty-state__text {
  max-width: 32rem;
  margin: 0;
  color: var(--color-text-muted);
}

.empty-state__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.empty-state--compact {
  padding: var(--space-5) var(--space-3);
}

.empty-state--compact .empty-state__art {
  width: 3.5rem;
  height: 3.5rem;
  margin-bottom: var(--space-1);
}

.empty-state--compact .empty-state__title {
  font-size: var(--text-md);
}
</style>
