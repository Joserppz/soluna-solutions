<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
  eyebrow?: string
}>()
</script>

<template>
  <header class="page-header">
    <div class="page-header__text">
      <span v-if="eyebrow" class="eyebrow">{{ eyebrow }}</span>
      <h1 class="page-header__title">{{ title }}</h1>
      <p v-if="subtitle" class="page-header__subtitle">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.actions" class="page-header__actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.page-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-4) var(--space-6);
  margin-bottom: var(--space-8);
}

.page-header__text {
  display: grid;
  gap: var(--space-2);
}

.page-header__title {
  font-size: var(--text-4xl);
}

.page-header__subtitle {
  font-size: var(--text-lg);
  color: var(--color-text-muted);
}

.page-header__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}
</style>
