<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  getAttendance,
  getPatients,
  updateAttendance,
  type AttendanceEntry,
  type AttendanceStatus,
  type Patient,
} from '../services/aspar'

const entries = ref(getAttendance())
const patients = ref<Patient[]>(getPatients())
const accessNotice = ref('')

const patientByName = computed(() => {
  const map = new Map<string, Patient>()
  for (const p of patients.value) {
    map.set(p.name.toLowerCase(), p)
  }
  return map
})

function getEntryPatient(entry: AttendanceEntry): Patient | undefined {
  return patientByName.value.get(entry.patientName.toLowerCase())
}

function isAttendanceBlocked(entry: AttendanceEntry): boolean {
  const patient = getEntryPatient(entry)
  if (!patient) return false
  return !patient.consent || patient.accessStatus === 'Revocado'
}

function mark(entry: AttendanceEntry, status: AttendanceStatus) {
  accessNotice.value = ''
  if (isAttendanceBlocked(entry) && status === 'Presente') {
    accessNotice.value = `Protección de datos (RNF-06): ${entry.patientName} no cuenta con consentimiento informado activo o tiene el acceso revocado.`
    return
  }
  updateAttendance(entry.id, status)
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
    <span class="eyebrow">Control de actividades · RNF-06</span>
    <h1>Marcación de asistencia</h1>
    <p>
      Registra la participación de los pacientes verificando su estado de
      consentimiento informado y acceso.
    </p>
  </section>

  <p v-if="accessNotice" class="form-error card notice-card" role="alert">
    {{ accessNotice }}
  </p>

  <section class="card table-card">
    <div class="section-title table-heading">
      <div>
        <h2>Participantes</h2>
        <p class="muted">Selecciona presente o ausente para cada registro.</p>
      </div>

      <span class="count-pill">{{ entries.length }} registros</span>
    </div>

    <div v-if="entries.length > 0" class="attendance-list">
      <article v-for="entry in entries" :key="entry.id" class="attendance-row">
        <div class="attendance-person">
          <span class="avatar">{{ entry.patientName.charAt(0) }}</span>

          <div>
            <strong>{{ entry.patientName }}</strong>
            <small>{{ entry.activity }}</small>
            <small
              v-if="getEntryPatient(entry)"
              :class="
                isAttendanceBlocked(entry)
                  ? 'consent-pill consent-blocked'
                  : 'consent-pill consent-ok'
              "
            >
              {{
                isAttendanceBlocked(entry)
                  ? 'Sin consentimiento / Acceso restringido'
                  : 'Consentimiento vigente'
              }}
            </small>
          </div>
        </div>

        <div class="attendance-time">
          {{ formatDate(entry.date) }} · {{ entry.time }}
        </div>

        <div class="attendance-actions">
          <span class="status" :class="`status-${entry.status.toLowerCase()}`">
            {{ entry.status }}
          </span>

          <button
            class="button button-small button-present"
            type="button"
            @click="mark(entry, 'Presente')"
          >
            Presente
          </button>

          <button
            class="button button-small button-absent"
            type="button"
            @click="mark(entry, 'Ausente')"
          >
            Ausente
          </button>
        </div>
      </article>
    </div>

    <div v-else class="empty-state">No hay registros de asistencia.</div>
  </section>
</template>
