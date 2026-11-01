<script setup lang="ts">
import { computed } from 'vue'

import { initials } from '../../utils/format'

const props = withDefaults(
  defineProps<{ name: string; size?: 'md' | 'xl'; muted?: boolean }>(),
  { size: 'md', muted: false },
)

const letters = computed(() => initials(props.name))
</script>

<template>
  <span
    class="avatar"
    :class="[`avatar--${size}`, { 'avatar--muted': muted }]"
    aria-hidden="true"
  >
    {{ letters }}
  </span>
</template>

<style scoped>
.avatar {
  flex: none;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--crema-100);
  box-shadow: inset 0 0 0 1px var(--color-border);
  color: var(--aspar-verde);
  font-weight: 700;
  letter-spacing: 0.02em;
}

.avatar--md {
  width: 2.4rem;
  height: 2.4rem;
  font-size: var(--text-sm);
}

.avatar--xl {
  width: 4.75rem;
  height: 4.75rem;
  background: var(--rosa-100);
  box-shadow: none;
  color: var(--aspar-guindo);
  font-family: var(--font-serif);
  font-size: var(--text-2xl);
  font-weight: 500;
}

.avatar--muted {
  color: var(--color-text-subtle);
}
</style>
