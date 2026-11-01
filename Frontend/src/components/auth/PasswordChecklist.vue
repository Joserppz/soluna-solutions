<script setup lang="ts">
import { computed } from 'vue'

import { passwordRules } from '../../utils/validation'

const props = defineProps<{ password: string; id?: string }>()
const rules = computed(() => passwordRules(props.password))
</script>

<template>
  <ul :id="id" class="checklist" aria-label="Requisitos de la contraseña">
    <li
      v-for="rule in rules"
      :key="rule.id"
      class="checklist__item"
      :class="{ 'is-ok': rule.ok && password }"
    >
      <span class="checklist__mark" aria-hidden="true">{{
        rule.ok && password ? '✓' : '•'
      }}</span>
      {{ rule.label }}
      <span class="visually-hidden">{{
        rule.ok && password ? '(cumplido)' : '(pendiente)'
      }}</span>
    </li>
  </ul>
</template>

<style scoped>
.checklist {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-5);
  margin: calc(var(--space-2) * -1) 0 0;
  padding: 0;
  list-style: none;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.checklist__item {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  transition: color var(--duration-base) var(--ease-out);
}

.checklist__mark {
  display: grid;
  place-items: center;
  width: 1.1rem;
  height: 1.1rem;
  border-radius: 50%;
  background: var(--color-surface-sunken);
  font-size: 0.7rem;
  font-weight: 700;
  transition: background-color var(--duration-base) var(--ease-out);
}

.checklist__item.is-ok {
  color: var(--tone-success-fg);
}

.checklist__item.is-ok .checklist__mark {
  background: var(--tone-success-fg);
  color: #fff;
}
</style>
