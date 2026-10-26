<script setup lang="ts">
import { ref } from 'vue'
import {
  getAttendance,
  updateAttendance,
  type AttendanceStatus,
} from '../services/aspar'

const entries = ref(getAttendance())

function mark(id: string, status: AttendanceStatus) {
  updateAttendance(id, status)
  entries.value = getAttendance()
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('es-BO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${date}T12:00:00`))
}
</script>

<template>
  <section class="page-heading">
    <span class="eyebrow">Control de actividades</span>
    <h1>Marcación de asistencia</h1>
    <p>Registra la participación de los pacientes en cada actividad.</p>
  </section>

  <section class="card table-card">
    <div class="section-title table-heading">
      <div>
        <h2>Participantes</h2>
        <p class="muted">Selecciona presente o ausente para cada registro.</p>
      </div>

      <span class="count-pill">{{ entries.length }} registros</span>
    </div>

    <div v-if="entries.length > 0" class="attendance-list">
      <article
        v-for="entry in entries"
        :key="entry.id"
        class="attendance-row"
      >
        <div class="attendance-person">
          <span class="avatar">{{ entry.patientName.charAt(0) }}</span>

          <div>
            <strong>{{ entry.patientName }}</strong>
            <small>{{ entry.activity }}</small>
          </div>
        </div>

        <div class="attendance-time">
          {{ formatDate(entry.date) }} · {{ entry.time }}
        </div>

        <div class="attendance-actions">
          <span
            class="status"
            :class="`status-${entry.status.toLowerCase()}`"
          >
            {{ entry.status }}
          </span>

          <button
            class="button button-small button-present"
            type="button"
            @click="mark(entry.id, 'Presente')"
          >
            Presente
          </button>

          <button
            class="button button-small button-absent"
            type="button"
            @click="mark(entry.id, 'Ausente')"
          >
            Ausente
          </button>
        </div>
      </article>
    </div>

    <div v-else class="empty-state">
      No hay registros de asistencia.
    </div>
  </section>
</template>