<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  PARKINSON_STAGES,
  canEditPatients,
  canRegisterClinicalNotes,
  canViewClinicalRecord,
  clinicalAccessNotice,
  getSession,
  getPatients,
  savePatient,
  syncPatientsFromApi,
  updatePatient,
  type AccessStatus,
  type ParkinsonStage,
  type Patient,
} from '../services/aspar'

const patients = ref<Patient[]>(getPatients())
const search = ref('')
const statusFilter = ref<'Todos' | AccessStatus>('Todos')
const error = ref('')
const successMsg = ref('')
const selectedPatientId = ref<string | null>(null)
// Permisos por rol, iguales a los del Backend (RNF-06)
const currentRole = getSession()?.role
const canEdit = canEditPatients()
const canClinical = canRegisterClinicalNotes()

const form = reactive({
  name: '',
  ci: '',
  phone: '',
  address: '',
  emergencyContact: '',
  caregiverRelation: 'Familiar / Cuidador',
  consent: false,
  accessStatus: 'Pendiente' as AccessStatus,
  diagnosis: 'Enfermedad de Parkinson idiopática',
  stage: 'Estadio I (Leve unilateral)' as ParkinsonStage,
  neurologistCertificate: false,
  symptomNotes: '',
  physicalEvaluation: '',
  speechEvaluation: '',
  psychologicalEvaluation: '',
  medications: '',
})

const filteredPatients = computed(() => {
  const query = search.value.trim().toLowerCase()
  return patients.value.filter((patient) => {
    const matchesStatus =
      statusFilter.value === 'Todos' ||
      patient.accessStatus === statusFilter.value
    if (!matchesStatus) return false
    if (!query) return true
    return `${patient.name} ${patient.ci} ${patient.emergencyContact} ${patient.anamnesis?.diagnosis ?? ''}`
      .toLowerCase()
      .includes(query)
  })
})

function submitPatient() {
  error.value = ''
  successMsg.value = ''

  try {
    savePatient({
      name: form.name,
      ci: form.ci,
      phone: form.phone,
      address: form.address || 'La Paz, Bolivia',
      emergencyContact: form.emergencyContact,
      caregiverRelation: form.caregiverRelation,
      consent: form.consent,
      accessStatus: form.accessStatus,
      anamnesis: {
        diagnosis: form.diagnosis,
        stage: form.stage,
        neurologistCertificate: form.neurologistCertificate,
        symptomNotes: form.symptomNotes,
        physicalEvaluation: form.physicalEvaluation,
        speechEvaluation: form.speechEvaluation,
        psychologicalEvaluation: form.psychologicalEvaluation,
        medications: form.medications,
      },
    })
    patients.value = getPatients()
    successMsg.value =
      'Ficha de paciente y anamnesis digital guardadas y sincronizadas.'
    Object.assign(form, {
      name: '',
      ci: '',
      phone: '',
      address: '',
      emergencyContact: '',
      caregiverRelation: 'Familiar / Cuidador',
      consent: false,
      accessStatus: 'Pendiente',
      diagnosis: 'Enfermedad de Parkinson idiopática',
      stage: 'Estadio I (Leve unilateral)',
      neurologistCertificate: false,
      symptomNotes: '',
      physicalEvaluation: '',
      speechEvaluation: '',
      psychologicalEvaluation: '',
      medications: '',
    })
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'No se pudo guardar el paciente.'
  }
}

function changeConsent(patient: Patient, consent: boolean) {
  updatePatient(patient.id, { consent })
  patients.value = getPatients()
}

function changeAccess(patient: Patient, accessStatus: AccessStatus) {
  error.value = ''
  if (accessStatus === 'Activo' && !patient.consent) {
    error.value = `No se puede activar el expediente de ${patient.name} sin consentimiento informado firmado (RNF-06).`
    patients.value = getPatients()
    return
  }
  updatePatient(patient.id, { accessStatus })
  patients.value = getPatients()
}

function toggleAnamnesis(patientId: string) {
  selectedPatientId.value =
    selectedPatientId.value === patientId ? null : patientId
}

onMounted(async () => {
  patients.value = await syncPatientsFromApi()
})
</script>

<template>
  <section class="page-heading">
    <span class="eyebrow"
      >Gestión de pacientes y anamnesis · RF-02 / RNF-06</span
    >
    <h1>Fichas de pacientes y anamnesis digital</h1>
    <p>
      Registra pacientes, datos de familiares/cuidadores, evaluaciones clínicas
      multidisciplinarias y administra el consentimiento informado.
    </p>
  </section>

  <section v-if="!canEdit" class="card notice-card" role="status">
    Tu rol ({{ currentRole }}) puede consultar el listado de pacientes, pero no
    registrar ni editar fichas.
  </section>

  <section v-else class="card form-card wide-card">
    <h2>Registrar paciente y anamnesis</h2>

    <form novalidate @submit.prevent="submitPatient">
      <div class="form-grid">
        <div class="field">
          <label for="patient-name">Nombre completo</label>
          <input
            id="patient-name"
            v-model.trim="form.name"
            placeholder="Nombre y apellidos"
            required
          />
        </div>

        <div class="field">
          <label for="patient-ci">Cédula de identidad</label>
          <input
            id="patient-ci"
            v-model.trim="form.ci"
            placeholder="Ej. 4819203"
            required
          />
        </div>

        <div class="field">
          <label for="patient-phone">Teléfono</label>
          <input
            id="patient-phone"
            v-model.trim="form.phone"
            type="tel"
            placeholder="Ej. 70012345"
            required
          />
        </div>

        <div class="field">
          <label for="patient-address">Dirección de domicilio</label>
          <input
            id="patient-address"
            v-model.trim="form.address"
            placeholder="Zona y calle en La Paz"
          />
        </div>

        <div class="field">
          <label for="patient-emergency"
            >Contacto de emergencia / Cuidador</label
          >
          <input
            id="patient-emergency"
            v-model.trim="form.emergencyContact"
            placeholder="Nombre y celular del familiar"
            required
          />
        </div>

        <div class="field">
          <label for="patient-relation">Vínculo del familiar o cuidador</label>
          <input
            id="patient-relation"
            v-model.trim="form.caregiverRelation"
            placeholder="Hijo/a, Esposo/a, Cuidador"
          />
        </div>

        <div class="field">
          <label for="patient-diagnosis"
            >Diagnóstico neurológico (Anamnesis)</label
          >
          <input
            id="patient-diagnosis"
            v-model.trim="form.diagnosis"
            placeholder="Enfermedad de Parkinson"
          />
        </div>

        <div class="field">
          <label for="patient-stage">Estadio clínico</label>
          <select id="patient-stage" v-model="form.stage">
            <option v-for="st in PARKINSON_STAGES" :key="st" :value="st">
              {{ st }}
            </option>
          </select>
        </div>

        <p v-if="!canClinical" class="muted field-note">
          Las evaluaciones clínicas las registra el personal clínico
          (Administrador, Coordinador o Profesional).
        </p>

        <div v-if="canClinical" class="field">
          <label for="patient-phys">Evaluación física / fisioterapia</label>
          <input
            id="patient-phys"
            v-model.trim="form.physicalEvaluation"
            placeholder="Estado de movilidad, postura y marcha"
          />
        </div>

        <div v-if="canClinical" class="field">
          <label for="patient-speech">Evaluación fonoaudiológica</label>
          <input
            id="patient-speech"
            v-model.trim="form.speechEvaluation"
            placeholder="Voz, deglución y articulación"
          />
        </div>

        <div v-if="canClinical" class="field">
          <label for="patient-psych">Evaluación psicológica</label>
          <input
            id="patient-psych"
            v-model.trim="form.psychologicalEvaluation"
            placeholder="Estado emocional y apoyo familiar"
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

        <label class="checkbox-field">
          <input v-model="form.neurologistCertificate" type="checkbox" />
          Certificado neurológico adjunto
        </label>
      </div>

      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <p v-if="successMsg" class="success-message" role="status">
        {{ successMsg }}
      </p>

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
        <p class="muted">{{ filteredPatients.length }} pacientes registrados</p>
      </div>

      <div class="filter-bar">
        <select
          v-model="statusFilter"
          aria-label="Filtrar por estado de acceso"
        >
          <option value="Todos">Todos los estados</option>
          <option value="Activo">Activo</option>
          <option value="Pendiente">Pendiente</option>
          <option value="Revocado">Revocado</option>
        </select>

        <input
          v-model="search"
          class="search-input"
          aria-label="Buscar paciente"
          placeholder="Buscar por nombre, CI o diagnóstico"
        />
      </div>
    </div>

    <div v-if="filteredPatients.length" class="patient-list-content">
      <article
        v-for="patient in filteredPatients"
        :key="patient.id"
        class="patient-item-block"
      >
        <div class="patient-row">
          <div class="patient-main">
            <strong>{{ patient.name }}</strong>
            <small>
              CI: {{ patient.ci }} · Teléfono: {{ patient.phone }} · Domicilio:
              {{ patient.address }}
            </small>
            <small>
              Emergencia ({{ patient.caregiverRelation }}):
              {{ patient.emergencyContact }}
            </small>
          </div>

          <label class="checkbox-field compact">
            <input
              :checked="patient.consent"
              :disabled="!canEdit"
              type="checkbox"
              @change="
                changeConsent(
                  patient,
                  ($event.target as HTMLInputElement).checked,
                )
              "
            />
            Consentimiento
          </label>

          <label class="access-control">
            Acceso
            <select
              :value="patient.accessStatus"
              :disabled="!canEdit"
              @change="
                changeAccess(
                  patient,
                  ($event.target as HTMLSelectElement).value as AccessStatus,
                )
              "
            >
              <option>Activo</option>
              <option>Pendiente</option>
              <option>Revocado</option>
            </select>
          </label>

          <button
            class="button button-small button-secondary"
            type="button"
            @click="toggleAnamnesis(patient.id)"
          >
            {{
              selectedPatientId === patient.id
                ? 'Ocultar anamnesis'
                : 'Ver anamnesis'
            }}
          </button>
        </div>

        <div v-if="selectedPatientId === patient.id" class="anamnesis-panel">
          <template v-if="canViewClinicalRecord(patient)">
            <div class="anamnesis-grid">
              <div>
                <strong>Diagnóstico:</strong>
                <span>{{ patient.anamnesis.diagnosis }}</span>
              </div>
              <div>
                <strong>Estadio:</strong>
                <span>{{ patient.anamnesis.stage }}</span>
              </div>
              <div>
                <strong>Fisioterapia:</strong>
                <span>{{
                  patient.anamnesis.physicalEvaluation || 'En evaluación'
                }}</span>
              </div>
              <div>
                <strong>Fonoaudiología:</strong>
                <span>{{
                  patient.anamnesis.speechEvaluation || 'En evaluación'
                }}</span>
              </div>
              <div>
                <strong>Psicología:</strong>
                <span>{{
                  patient.anamnesis.psychologicalEvaluation || 'En evaluación'
                }}</span>
              </div>
              <div>
                <strong>Medicación:</strong>
                <span>{{
                  patient.anamnesis.medications || 'Sin registro'
                }}</span>
              </div>
            </div>
          </template>
          <p v-else class="protected-notice" role="status">
            🔒 {{ clinicalAccessNotice(patient) }}
          </p>
        </div>
      </article>
    </div>

    <p v-else class="empty-state">No hay pacientes que coincidan.</p>
  </section>
</template>
