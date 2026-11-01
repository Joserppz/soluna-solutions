<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link' | 'on-dark'

const props = withDefaults(
  defineProps<{
    variant?: Variant
    size?: 'sm' | 'md' | 'lg'
    type?: 'button' | 'submit' | 'reset'
    loading?: boolean
    disabled?: boolean
    block?: boolean
    /** Navega con el router en vez de ejecutar una acción. */
    to?: RouteLocationRaw
    href?: string
    /** Texto para lectores de pantalla mientras carga. */
    loadingLabel?: string
  }>(),
  {
    variant: 'primary',
    size: 'md',
    type: 'button',
    loading: false,
    disabled: false,
    block: false,
    to: undefined,
    href: undefined,
    loadingLabel: 'Procesando…',
  },
)

const classes = computed(() => [
  'btn',
  `btn--${props.variant}`,
  `btn--${props.size}`,
  { 'btn--block': props.block, 'is-loading': props.loading },
])
const inactive = computed(() => props.disabled || props.loading)
</script>

<template>
  <RouterLink v-if="to && !inactive" :to="to" :class="classes">
    <slot />
  </RouterLink>
  <a v-else-if="href && !inactive" :href="href" :class="classes">
    <slot />
  </a>
  <button
    v-else
    :type="type"
    :class="classes"
    :disabled="inactive"
    :aria-busy="loading || undefined"
  >
    <span v-if="loading" class="btn__spinner" aria-hidden="true" />
    <span class="btn__label"><slot /></span>
    <span v-if="loading" class="visually-hidden" role="status">
      {{ loadingLabel }}
    </span>
  </button>
</template>

<style scoped>
.btn {
  --btn-bg: transparent;
  --btn-fg: var(--color-text);
  --btn-border: transparent;
  --btn-shadow: none;
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: 2.75rem;
  padding: 0 var(--space-5);
  border: 1px solid var(--btn-border);
  border-radius: var(--radius-sm);
  background: var(--btn-bg);
  color: var(--btn-fg);
  box-shadow: var(--btn-shadow);
  font-weight: 600;
  font-size: var(--text-md);
  line-height: 1;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}

.btn:focus-visible {
  box-shadow: var(--btn-shadow), var(--focus-ring);
  border-radius: var(--radius-sm);
}

.btn:active:not(:disabled) {
  transform: translateY(1px);
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.62;
}

.btn.is-loading {
  cursor: progress;
  opacity: 1;
}

.btn--sm {
  min-height: 2.25rem;
  padding: 0 var(--space-4);
  font-size: var(--text-sm);
}

.btn--lg {
  min-height: 3.25rem;
  padding: 0 var(--space-6);
  font-size: var(--text-lg);
}

.btn--block {
  display: flex;
  width: 100%;
}

.btn--primary {
  --btn-bg: var(--aspar-guindo);
  --btn-fg: #fff;
  --btn-border: var(--guindo-900);
  --btn-shadow:
    0 1px 0 rgb(255 255 255 / 0.12) inset, 0 1px 2px rgb(86 17 20 / 0.28),
    0 4px 10px -4px rgb(86 17 20 / 0.45);
}

.btn--primary:hover:not(:disabled) {
  --btn-bg: var(--guindo-900);
}

.btn--secondary {
  --btn-bg: var(--color-surface);
  --btn-fg: var(--aspar-verde);
  --btn-border: var(--color-border-strong);
  --btn-shadow: var(--shadow-xs);
}

.btn--secondary:hover:not(:disabled) {
  --btn-bg: var(--crema-50);
  --btn-border: rgb(7 57 48 / 0.36);
}

.btn--ghost {
  --btn-fg: var(--aspar-verde);
}

.btn--ghost:hover:not(:disabled) {
  --btn-bg: rgb(7 57 48 / 0.06);
}

.btn--danger {
  --btn-bg: var(--aspar-rojo);
  --btn-fg: #fff;
  --btn-border: var(--guindo-700);
  --btn-shadow: 0 1px 2px rgb(86 17 20 / 0.25);
}

.btn--danger:hover:not(:disabled) {
  --btn-bg: var(--guindo-700);
}

.btn--link {
  min-height: auto;
  padding: 0;
  border: 0;
  border-radius: 0;
  --btn-fg: var(--color-link);
  font-weight: 600;
  text-decoration: underline;
  text-decoration-color: rgb(109 22 25 / 0.35);
  text-underline-offset: 0.25em;
}

.btn--link:hover:not(:disabled) {
  text-decoration-color: currentColor;
}

.btn--on-dark {
  --btn-fg: #fff;
  --btn-border: rgb(255 255 255 / 0.45);
}

.btn--on-dark:hover:not(:disabled) {
  --btn-bg: rgb(255 255 255 / 0.08);
  --btn-border: rgb(255 255 255 / 0.7);
}

.btn--on-dark:focus-visible {
  box-shadow: var(--focus-ring-on-dark);
}

.btn__label {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.is-loading .btn__label {
  opacity: 0.75;
}

.btn__spinner {
  width: 1em;
  height: 1em;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: btn-spin 0.7s linear infinite;
}

@keyframes btn-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
