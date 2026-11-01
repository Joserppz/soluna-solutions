<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    tone?: 'error' | 'warning' | 'success' | 'info' | 'neutral'
    title?: string
  }>(),
  { tone: 'info', title: undefined },
)

// Los errores se anuncian de inmediato; el resto, sin interrumpir la lectura
const role = computed(() => (props.tone === 'error' ? 'alert' : 'status'))
const icon = computed(
  () =>
    ({ error: '!', warning: '!', success: '✓', info: 'i', neutral: 'i' })[
      props.tone
    ],
)
</script>

<template>
  <div class="alert" :class="`alert--${tone}`" :role="role">
    <span class="alert__icon" aria-hidden="true">{{ icon }}</span>
    <div class="alert__body">
      <p v-if="title" class="alert__title">{{ title }}</p>
      <div class="alert__text"><slot /></div>
    </div>
  </div>
</template>

<style scoped>
.alert {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
  padding: var(--space-4) var(--space-5);
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  font-size: var(--text-md);
  line-height: var(--leading-normal);
  animation: alert-in var(--duration-slow) var(--ease-out);
}

.alert__icon {
  flex: none;
  display: grid;
  place-items: center;
  width: 1.4rem;
  height: 1.4rem;
  margin-top: 0.1rem;
  border-radius: 50%;
  font-size: var(--text-sm);
  font-weight: 700;
  color: #fff;
}

.alert__title {
  font-weight: 700;
  margin-bottom: var(--space-1);
}

.alert--error {
  background: var(--tone-danger-bg);
  border-color: rgb(171 26 28 / 0.14);
  color: var(--guindo-900);
}

.alert--error .alert__icon {
  background: var(--aspar-rojo);
}

.alert--warning {
  background: var(--tone-warning-bg);
  border-color: rgb(132 86 14 / 0.16);
  color: #5d3c08;
}

.alert--warning .alert__icon {
  background: #b7791f;
}

.alert--success {
  background: var(--tone-success-bg);
  border-color: rgb(28 92 76 / 0.16);
  color: var(--verde-900);
}

.alert--success .alert__icon {
  background: var(--verde-700);
}

.alert--info {
  background: var(--verde-50);
  border-color: rgb(7 57 48 / 0.1);
  color: var(--verde-900);
}

.alert--info .alert__icon {
  background: var(--verde-700);
}

.alert--neutral {
  background: var(--color-surface-sunken);
  color: var(--color-text);
}

.alert--neutral .alert__icon {
  background: var(--color-text-subtle);
}

@keyframes alert-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
}
</style>
