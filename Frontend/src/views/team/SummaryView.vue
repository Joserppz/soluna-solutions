<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import AppAlert from '../../components/ui/AppAlert.vue'
import PageHeader from '../../components/ui/PageHeader.vue'
import { useApi } from '../../composables/useApi'
import { TEAM_SECTIONS } from '../../router/sections'
import { firstName, greeting } from '../../utils/format'

const { session } = useApi()

const title = computed(() => {
  const user = session.state.user
  return user ? `${greeting()}, ${firstName(user.name)}.` : `${greeting()}.`
})
const sections = computed(() =>
  TEAM_SECTIONS.filter((section) => session.canAny(...section.permissions)),
)
const seesClinical = computed(() => session.can('patients:read_clinical'))
</script>

<template>
  <div class="summary">
    <PageHeader
      :title="title"
      subtitle="Desde aquí llegas a todo lo que tu rol permite."
    />

    <AppAlert v-if="!sections.length" tone="neutral">
      Tu rol todavía no tiene secciones asignadas. Pídele a Administración que
      revise tus permisos.
    </AppAlert>

    <ul v-else class="summary__grid">
      <li v-for="section in sections" :key="section.name">
        <RouterLink :to="{ name: section.name }" class="section-card">
          <span class="section-card__title">{{ section.title }}</span>
          <span class="section-card__text">{{ section.description }}</span>
          <span class="section-card__go" aria-hidden="true">→</span>
        </RouterLink>
      </li>
    </ul>

    <p class="summary__privacy">
      <template v-if="seesClinical">
        Tu rol puede ver historias clínicas. Cada consulta queda en el registro
        de actividad, para cuidar a las familias.
      </template>
      <template v-else>
        Solo el personal clínico ve historias y evaluaciones. Tu rol ve los
        datos que necesita para acompañar a la comunidad.
      </template>
    </p>
  </div>
</template>

<style scoped>
.summary__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
  gap: var(--space-4);
  margin: 0;
  padding: 0;
  list-style: none;
}

.section-card {
  position: relative;
  display: grid;
  gap: var(--space-2);
  height: 100%;
  padding: var(--space-6) var(--space-6) var(--space-8);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
  color: var(--color-text);
  text-decoration: none;
  transition:
    transform var(--duration-base) var(--ease-out),
    box-shadow var(--duration-base) var(--ease-out),
    border-color var(--duration-base) var(--ease-out);
}

.section-card:hover {
  transform: translateY(-2px);
  border-color: var(--color-border-strong);
  box-shadow: var(--shadow-md);
}

.section-card:focus-visible {
  box-shadow: var(--shadow-md), var(--focus-ring);
  border-radius: var(--radius-lg);
}

.section-card__title {
  font-family: var(--font-serif);
  font-size: var(--text-xl);
  color: var(--color-heading);
}

.section-card__text {
  color: var(--color-text-muted);
}

.section-card__go {
  position: absolute;
  right: var(--space-5);
  bottom: var(--space-4);
  color: var(--aspar-guindo);
  font-size: var(--text-lg);
  transition: transform var(--duration-base) var(--ease-out);
}

.section-card:hover .section-card__go {
  transform: translateX(3px);
}

.summary__privacy {
  max-width: 44rem;
  margin-top: var(--space-8);
  padding: var(--space-4) var(--space-5);
  border-radius: var(--radius-md);
  background: var(--color-surface-sunken);
}
</style>
