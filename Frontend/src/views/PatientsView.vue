<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import {
  getPatients,
  savePatient,
  updatePatient,
  type AccessStatus,
  type Patient,
} from '../services/aspar'

const patients = ref<Patient[]>(getPatients())
const search = ref('')
const error = ref('')

const form = reactive({
  name: '',
  ci: '',
  phone: '',
  emergencyContact: '',
  consent: false,
  accessStatus: 'Pendiente' as AccessStatus,
})

const filteredPatients = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return patients.value

  return patients.value.filter((patient) =>
    `${patient.name} ${patient.ci}`.toLowerCase().includes(query),
  )
})

function submitPatient() {
  error.value = ''

  try {
    savePatient({ ...form })
    patients.value = getPatients()
    Object.assign(form, {
      name: '',
      ci: '',
      phone: '',
      emergencyContact: '',
      consent: false,
      accessStatus: 'Pendiente',
    })
  } catch {
    error.value = 'No se pudo guardar el paciente.'
  }
}

function changeConsent(patient: Patient, consent: boolean) {
  updatePatient(patient.id, { consent })
  patients.value = getPatients()
}

function changeAccess(patient: Patient, accessStatus: AccessStatus) {
  updatePatient(patient.id, { accessStatus })
  patients.value = getPatients()
}
</script>

<template>
  <section class="page-heading">
    <span class="eyebrow">Gestión de pacientes</span>
    <h1>Pacientes</h1>
    <p>Registra pacientes y administra su consentimiento y estado de acceso.</p>
  </section>

  <section class="card form-card wide-card">
    <h2>Registrar paciente</h2>

    <form @submit.prevent="submitPatient">
      <div class="form-grid">
        <div class="field">
          <label for="patient-name">Nombre completo</label>
          <input id="patient-name" v-model.trim="form.name" required />
        </div>

        <div class="field">
          <label for="patient-ci">Cédula de identidad</label>
          <input id="patient-ci" v-model.trim="form.ci" required />
        </div>

        <div class="field">
          <label for="patient-phone">Teléfono</label>
          <input id="patient-phone" v-model.trim="form.phone" type="tel" required />
        </div>

        <div class="field">
          <label for="patient-emergency">Contacto de emergencia</label>
          <input
            id="patient-emergency"
            v-model.trim="form.emergencyContact"
            required
          />
        </div>

        <div class="field">
          <label for="patient-access">Estado de acceso</label>
          <select id="patient-access" v-model="form.accessStatus">
            <option>Activo</option>
            <option>Pendiente</option>
            <option>Revocado</option>
          </select>
        </div>

        <label class="checkbox-field">
          <input v-model="form.consent" type="checkbox" />
          Consentimiento informado recibido
        </label>
      </div>

      <p v-if="error" class="form-error" role="alert">{{ error }}</p>

      <div class="form-actions">
        <button class="button button-primary" type="submit">
          Guardar paciente
        </button>
      </div>
    </form>
  </section>

  <section class="card table-card patient-list">
    <div class="section-title table-heading">
      <div>
        <h2>Listado de pacientes</h2>
        <p class="muted">{{ patients.length }} pacientes registrados</p>
      </div>

      <input
        v-model="search"
        class="search-input"
        aria-label="Buscar paciente"
        placeholder="Buscar por nombre o CI"
      />
    </div>

    <div v-if="filteredPatients.length" class="patient-list-content">
      <article
        v-for="patient in filteredPatients"
        :key="patient.id"
        class="patient-row"
      >
        <div class="patient-main">
          <strong>{{ patient.name }}</strong>
          <small>CI: {{ patient.ci }} · Teléfono: {{ patient.phone }}</small>
          <small>Emergencia: {{ patient.emergencyContact }}</small>
        </div>

        <label class="checkbox-field compact">
          <input
            :checked="patient.consent"
            type="checkbox"
            @change="changeConsent(patient, ($event.target as HTMLInputElement).checked)"
          />
          Consentimiento
        </label>

        <label class="access-control">
          Acceso
          <select
            :value="patient.accessStatus"
            @change="changeAccess(patient, ($event.target as HTMLSelectElement).value as AccessStatus)"
          >
            <option>Activo</option>
            <option>Pendiente</option>
            <option>Revocado</option>
          </select>
        </label>
      </article>
    </div>

    <p v-else class="empty-state">No hay pacientes que coincidan.</p>
  </section>
</template>