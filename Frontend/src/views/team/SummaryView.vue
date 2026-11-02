<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import AppAlert from '../../components/ui/AppAlert.vue'
import PageHeader from '../../components/ui/PageHeader.vue'
import StickyHeader from '../../components/ui/StickyHeader.vue'
import { useApi } from '../../composables/useApi'
import { useFitLayout } from '../../composables/useFitLayout'
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
// En escritorio todo el resumen entra en la ventana: las tarjetas se reparten el alto
const fit = useFitLayout()
</script>

<template>
  <div class="summary" :class="{ 'summary--fit': fit }">
    <StickyHeader v-slot="{ stuck }" :disabled="fit">
      <div class="summary__head" :class="{ 'is-stuck': stuck }">
        <PageHeader
          :title="title"
          subtitle="Desde aquí llegas a todo lo que tu rol permite."
        />
      </div>
    </StickyHeader>

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
/* El saludo queda fijo y se achica; las secciones pasan por debajo */
.summary__head {
  /* El margen del título queda dentro: así se mide el alto completo */
  display: flow-root;
}

.summary__head :deep(.page-header) {
  margin-bottom: var(--space-8);
}

.summary__head.is-stuck {
  padding-top: var(--space-3);
}

.summary__head.is-stuck :deep(.page-header) {
  margin-bottom: var(--space-4);
}

.summary__head.is-stuck :deep(.page-header__title) {
  font-size: var(--text-2xl);
}

.summary__head.is-stuck :deep(.page-header__subtitle) {
  display: none;
}

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

/* Ventana completa: saludo, tarjetas y nota entran sin desplazar la página. Las
   filas de tarjetas se reparten el alto que queda */
.summary--fit {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.summary--fit .summary__head :deep(.page-header) {
  margin-bottom: clamp(var(--space-3), 2.4vh, var(--space-8));
}

.summary--fit .summary__head :deep(.page-header__title) {
  font-size: clamp(2rem, 5vh, 3.25rem);
}

.summary--fit .summary__grid {
  flex: 1;
  min-height: 0;
  grid-template-columns: repeat(auto-fill, minmax(14.5rem, 1fr));
  grid-auto-rows: minmax(0, 1fr);
  gap: clamp(var(--space-2), 1.6vh, var(--space-4));
}

.summary--fit .summary__grid > li {
  min-height: 0;
}

.summary--fit .section-card {
  align-content: start;
  gap: clamp(0.15rem, 0.6vh, var(--space-2));
  overflow: hidden;
  padding: clamp(var(--space-3), 2.2vh, var(--space-6))
    clamp(var(--space-4), 1.6vw, var(--space-6));
}

.summary--fit .section-card__title {
  font-size: clamp(1.1rem, 2.6vh, var(--text-xl));
}

.summary--fit .section-card__text {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  font-size: clamp(0.875rem, 1.9vh, 1rem);
  line-height: var(--leading-snug);
}

.summary--fit .section-card__go {
  bottom: clamp(var(--space-2), 1.4vh, var(--space-4));
}

.summary--fit .summary__privacy {
  flex: none;
  max-width: none;
  margin-top: clamp(var(--space-2), 1.8vh, var(--space-8));
  padding: clamp(var(--space-2), 1.2vh, var(--space-4)) var(--space-5);
  font-size: var(--text-sm);
}
</style>
