<script setup lang="ts">
import { computed, ref } from 'vue'
import { getAuditEvents } from '../services/aspar'

const search = ref('')
const events = ref(getAuditEvents())

const filteredEvents = computed(() => {
  const query = search.value.trim().toLowerCase()

  if (!query) return events.value

  return events.value.filter((event) =>
    `${event.actor} ${event.action} ${event.detail}`
      .toLowerCase()
      .includes(query),
  )
})

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('es-BO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date))
}
</script>

<template>
  <section class="page-heading">
    <span class="eyebrow">Solo administradores</span>
    <h1>Bitácora de actividad</h1>
    <p>Consulta los eventos registrados en la interfaz.</p>
  </section>

  <section class="card table-card">
    <div class="section-title table-heading">
      <div>
        <h2>Eventos</h2>
        <p class="muted">{{ filteredEvents.length }} resultados</p>
      </div>

      <input
        v-model="search"
        class="search-input"
        aria-label="Buscar en bitácora"
        placeholder="Buscar actividad"
      />
    </div>

    <article v-for="event in filteredEvents" :key="event.id" class="audit-row">
      <div>
        <strong>{{ event.action }}</strong>
        <p>{{ event.detail }}</p>
      </div>
      <span>{{ event.actor }}</span>
      <time :datetime="event.date">{{ formatDate(event.date) }}</time>
    </article>

    <p v-if="filteredEvents.length === 0" class="empty-state">
      No hay eventos para mostrar.
    </p>
  </section>
</template>