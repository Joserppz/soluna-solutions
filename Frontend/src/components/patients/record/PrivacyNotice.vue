<script setup lang="ts">
/** Aviso de privacidad (RNF-06) en lugar de los datos clínicos. */
defineProps<{ message: string }>()
</script>

<template>
  <section class="privacy surface-card" aria-label="Información protegida">
    <span class="privacy__icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="22" height="22">
        <path
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          d="M7 10V7a5 5 0 0 1 10 0v3M5.5 10h13v10h-13z"
        />
      </svg>
    </span>
    <div>
      <h2>Información protegida</h2>
      <p>{{ message }}</p>
    </div>
  </section>
</template>

<style scoped>
.privacy {
  display: flex;
  gap: var(--space-4);
  max-width: 46rem;
  padding: var(--space-6);
}

.privacy__icon {
  flex: none;
  display: grid;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 50%;
  background: var(--rosa-100);
  color: var(--aspar-guindo);
}

.privacy h2 {
  margin-bottom: var(--space-1);
  font-family: var(--font-sans);
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--color-text);
}

.privacy p {
  color: var(--color-text-muted);
}
</style>
