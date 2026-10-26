<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  getAuditEvents,
  getSession,
  syncAuditFromApi,
  type AuditCategory,
  type AuditEvent,
  type AuditSeverity,
} from '../services/aspar'

const search = ref('')
const categoryFilter = ref<'TODAS' | AuditCategory>('TODAS')
const severityFilter = ref<'TODAS' | AuditSeverity>('TODAS')
const events = ref<AuditEvent[]>(getAuditEvents())
const currentSession = ref(getSession())

const isAuthorizedAdmin = computed(
  () => currentSession.value?.role === 'Administrador',
)

const filteredEvents = computed(() => {
  if (!isAuthorizedAdmin.value) return []

  const query = search.value.trim().toLowerCase()
  return events.value.filter((event) => {
    const matchesCategory =
      categoryFilter.value === 'TODAS' ||
      event.category === categoryFilter.value
    const matchesSeverity =
      severityFilter.value === 'TODAS' ||
      event.severity === severityFilter.value
    if (!matchesCategory || !matchesSeverity) return false
    if (!query) return true

    return `${event.actor} ${event.actorRole} ${event.action} ${event.detail} ${event.category}`
      .toLowerCase()
      .includes(query)
  })
})

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('es-BO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date))
}

onMounted(async () => {
  currentSession.value = getSession()
  if (isAuthorizedAdmin.value) {
    events.value = await syncAuditFromApi()
  }
})
</script>

<template>
  <section class="page-heading">
    <span class="eyebrow"
      >Solo administradores · RF-17 (SCRUM-135 / SCRUM-179)</span
    >
    <h1>Bitácora de auditoría de operaciones sensibles</h1>
    <p>
      Supervisa inicios de sesión, cambios de consentimiento informado, altas de
      pacientes, asignaciones de roles y eventos críticos del sistema.
    </p>
  </section>

  <section v-if="!isAuthorizedAdmin" class="card form-card" role="alert">
    <h2>Acceso restringido</h2>
    <p class="form-error">
      Esta vista está reservada exclusivamente para usuarios con rol
      <strong>Administrador</strong> (RF-17).
    </p>
  </section>

  <section v-else class="card table-card">
    <div class="section-title table-heading">
      <div>
        <h2>Eventos registrados</h2>
        <p class="muted">{{ filteredEvents.length }} resultados</p>
      </div>

      <div class="filter-bar">
        <select
          v-model="categoryFilter"
          aria-label="Filtrar bitácora por categoría"
        >
          <option value="TODAS">Todas las categorías</option>
          <option value="AUTENTICACION">Autenticación</option>
          <option value="PACIENTES">Pacientes</option>
          <option value="CONSENTIMIENTO">Consentimiento</option>
          <option value="USUARIOS_ROLES">Usuarios y Roles</option>
          <option value="INVENTARIO">Inventario</option>
          <option value="CRONOGRAMA">Cronograma</option>
          <option value="DONACIONES">Donaciones</option>
          <option value="SISTEMA">Sistema</option>
        </select>

        <select
          v-model="severityFilter"
          aria-label="Filtrar bitácora por severidad"
        >
          <option value="TODAS">Todas las severidades</option>
          <option value="INFO">INFO</option>
          <option value="WARNING">WARNING</option>
          <option value="CRITICAL">CRITICAL</option>
        </select>

        <input
          v-model="search"
          class="search-input"
          aria-label="Buscar en bitácora"
          placeholder="Buscar actividad o actor"
        />
      </div>
    </div>

    <article v-for="event in filteredEvents" :key="event.id" class="audit-row">
      <div>
        <div class="audit-meta-badges">
          <span
            class="consent-pill"
            :class="
              event.severity === 'CRITICAL' || event.severity === 'WARNING'
                ? 'consent-blocked'
                : 'consent-ok'
            "
          >
            {{ event.severity }}
          </span>
          <small class="muted">{{ event.category }}</small>
        </div>
        <strong>{{ event.action }}</strong>
        <p>{{ event.detail }}</p>
      </div>
      <span>{{ event.actor }} ({{ event.actorRole }})</span>
      <time :datetime="event.date">{{ formatDate(event.date) }}</time>
    </article>

    <p v-if="filteredEvents.length === 0" class="empty-state">
      No hay eventos para mostrar.
    </p>
  </section>
</template>
