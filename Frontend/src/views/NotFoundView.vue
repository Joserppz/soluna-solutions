<script setup lang="ts">
import AsparBrand from '../components/AsparBrand.vue'
import AppButton from '../components/ui/AppButton.vue'
import { useApi } from '../composables/useApi'

const { session } = useApi()
</script>

<template>
  <main class="not-found">
    <AsparBrand />
    <div class="not-found__body">
      <span class="eyebrow">Error 404</span>
      <h1>No encontramos esta página.</h1>
      <p class="text-muted">
        Puede que el enlace esté incompleto o que la página ya no exista.
      </p>
    </div>
    <div class="not-found__actions">
      <AppButton :to="{ name: 'inicio' }">Ir al sitio de ASPAR</AppButton>
      <AppButton
        v-if="session.isAuthenticated.value"
        variant="secondary"
        :to="{ name: 'resumen' }"
      >
        Volver al espacio del equipo
      </AppButton>
    </div>
  </main>
</template>

<style scoped>
.not-found {
  min-height: 100vh;
  display: grid;
  align-content: center;
  justify-items: start;
  gap: var(--space-8);
  max-width: 40rem;
  margin: 0 auto;
  padding: var(--space-8) var(--space-6);
}

.not-found__body {
  display: grid;
  gap: var(--space-3);
}

.not-found h1 {
  font-size: var(--text-4xl);
}

.not-found__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}
</style>
