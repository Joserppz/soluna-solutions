<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import AppButton from '../../components/ui/AppButton.vue'
import PageHeader from '../../components/ui/PageHeader.vue'

// Secciones cuya pantalla todavía no se conectó a la API: se muestra este aviso en
// lugar de datos de ejemplo. Cada bloque del frontend la reemplaza por la vista real.
const route = useRoute()
const title = computed(() => route.meta.title ?? 'Sección')
</script>

<template>
  <div>
    <PageHeader :title="title" :subtitle="route.meta.description" />
    <section class="preparing surface-card" aria-labelledby="preparando-titulo">
      <span class="preparing__icon" aria-hidden="true" />
      <div class="preparing__text">
        <h2 id="preparando-titulo">Estamos preparando esta sección.</h2>
        <p>
          Muy pronto vas a trabajar aquí con los datos reales de la asociación.
          La información ya está guardada y protegida en el sistema.
        </p>
      </div>
      <AppButton variant="secondary" :to="{ name: 'resumen' }">
        Volver al resumen
      </AppButton>
    </section>
  </div>
</template>

<style scoped>
.preparing {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-6);
  padding: var(--space-8);
}

.preparing__icon {
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 50%;
  background:
    radial-gradient(
      circle at 50% 50%,
      var(--aspar-guindo) 0 22%,
      transparent 23%
    ),
    var(--rosa-100);
  box-shadow: inset 0 0 0 6px rgb(255 255 255 / 0.6);
}

.preparing__text {
  display: grid;
  gap: var(--space-2);
}

.preparing h2 {
  font-size: var(--text-2xl);
}

.preparing p {
  color: var(--color-text-muted);
}

@media (max-width: 720px) {
  .preparing {
    grid-template-columns: minmax(0, 1fr);
    padding: var(--space-6);
  }
}
</style>
