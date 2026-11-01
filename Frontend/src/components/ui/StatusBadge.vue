<script setup lang="ts">
withDefaults(
  defineProps<{
    tone?: 'success' | 'warning' | 'danger' | 'neutral' | 'info'
    /** Punto de color antes del texto, como en el diseño. */
    dot?: boolean
  }>(),
  { tone: 'neutral', dot: true },
)
</script>

<template>
  <span class="badge" :class="`badge--${tone}`">
    <span v-if="dot" class="badge__dot" aria-hidden="true" />
    <slot />
  </span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  padding: 0.25em 0.75em;
  border-radius: var(--radius-pill);
  font-size: var(--text-sm);
  font-weight: 600;
  line-height: 1.3;
  white-space: nowrap;
  background: var(--badge-bg);
  color: var(--badge-fg);
  box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.03);
}

.badge__dot {
  width: 0.45em;
  height: 0.45em;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.85;
}

.badge--success {
  --badge-bg: var(--tone-success-bg);
  --badge-fg: var(--tone-success-fg);
}

.badge--warning {
  --badge-bg: var(--tone-warning-bg);
  --badge-fg: var(--tone-warning-fg);
}

.badge--danger {
  --badge-bg: var(--tone-danger-bg);
  --badge-fg: var(--tone-danger-fg);
}

.badge--neutral {
  --badge-bg: var(--tone-neutral-bg);
  --badge-fg: var(--tone-neutral-fg);
}

.badge--info {
  --badge-bg: var(--tone-info-bg);
  --badge-fg: var(--tone-info-fg);
}
</style>
