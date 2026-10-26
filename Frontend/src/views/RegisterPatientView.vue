<script setup lang="ts">
import { reactive, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import {
  PARKINSON_STAGES,
  savePatient,
  type AccessStatus,
  type ParkinsonStage,
} from '../services/aspar'

const router = useRouter()
const guardado = ref(false)
const error = ref('')

const form = reactive({
  name: '',
  ci: '',
  phone: '',
  address: '',
  emergencyContact: '',
  caregiverRelation: 'Familiar directo',
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

function submitForm() {
  error.value = ''
  guardado.value = false

  try {
    savePatient({
      name: form.name,
      ci: form.ci,
      phone: form.phone,
      address: form.address,
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
    guardado.value = true

    window.setTimeout(() => {
      router.push('/pacientes')
    }, 900)
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : 'No se pudo registrar la ficha del paciente.'
  }
}
</script>

<template>
  <section class="page-heading">
    <span class="eyebrow">Gestión de afiliados · RF-02</span>
    <h1>Registrar paciente y anamnesis digital</h1>
    <p>
      Completa los datos personales, del familiar/cuidador y las evaluaciones
      clínicas (física, fonoaudiológica y psicológica).
    </p>
  </section>

  <form class="card form-card wide-card" @submit.prevent="submitForm">
    <h2>1. Datos de filiación y cuidador</h2>
    <div class="form-grid">
      <div class="field">
        <label for="name">Nombre completo del paciente</label>
        <input
          id="name"
          v-model.trim="form.name"
          placeholder="Ej. Elena Rojas"
          required
        />
      </div>

      <div class="field">
        <label for="ci">Cédula de identidad (CI)</label>
        <input
          id="ci"
          v-model.trim="form.ci"
          placeholder="Ej. 4829104"
          required
        />
      </div>

      <div class="field">
        <label for="phone">Teléfono de contacto</label>
        <input
          id="phone"
          v-model.trim="form.phone"
          type="tel"
          placeholder="Ej. 71500011"
          required
        />
      </div>

      <div class="field">
        <label for="address">Dirección de domicilio</label>
        <input
          id="address"
          v-model.trim="form.address"
          placeholder="Zona, calle y número (La Paz)"
          required
        />
      </div>

      <div class="field">
        <label for="emergency">Familiar o cuidador de emergencia</label>
        <input
          id="emergency"
          v-model.trim="form.emergencyContact"
          placeholder="Nombre y teléfono del familiar"
          required
        />
      </div>

      <div class="field">
        <label for="caregiverRelation">Parentesco / Vínculo del cuidador</label>
        <input
          id="caregiverRelation"
          v-model.trim="form.caregiverRelation"
          placeholder="Hijo/a, Cónyuge, Cuidador"
          required
        />
      </div>
    </div>

    <h2 class="subsection-heading">2. Anamnesis clínica y evaluaciones</h2>
    <div class="form-grid">
      <div class="field">
        <label for="diagnosis">Diagnóstico neurológico</label>
        <input id="diagnosis" v-model.trim="form.diagnosis" required />
      </div>

      <div class="field">
        <label for="stage">Estadio Hoehn y Yahr / Clasificación</label>
        <select id="stage" v-model="form.stage">
          <option v-for="st in PARKINSON_STAGES" :key="st" :value="st">
            {{ st }}
          </option>
        </select>
      </div>

      <div class="field">
        <label for="physicalEval">Evaluación fisioterapéutica / motora</label>
        <input
          id="physicalEval"
          v-model.trim="form.physicalEvaluation"
          placeholder="Marcha, postura, equilibrio, rigidez"
        />
      </div>

      <div class="field">
        <label for="speechEval">Evaluación de fonoaudiología</label>
        <input
          id="speechEval"
          v-model.trim="form.speechEvaluation"
          placeholder="Proyección vocal, articulación, deglución"
        />
      </div>

      <div class="field">
        <label for="psychEval">Evaluación psicológica y cognitiva</label>
        <input
          id="psychEval"
          v-model.trim="form.psychologicalEvaluation"
          placeholder="Estado de ánimo, adaptación familiar"
        />
      </div>

      <div class="field">
        <label for="medications">Esquema de medicación actual</label>
        <input
          id="medications"
          v-model.trim="form.medications"
          placeholder="Ej. Levodopa/Carbidopa horarios"
        />
      </div>

      <div class="field">
        <label for="accessStatus">Estado de acceso inicial (RNF-06)</label>
        <select id="accessStatus" v-model="form.accessStatus">
          <option value="Activo">Activo</option>
          <option value="Pendiente">Pendiente</option>
          <option value="Revocado">Revocado</option>
        </select>
      </div>

      <div class="field">
        <label class="checkbox-field">
          <input v-model="form.neurologistCertificate" type="checkbox" />
          Cuenta con certificado médico neurológico
        </label>
        <label class="checkbox-field">
          <input v-model="form.consent" type="checkbox" />
          Consentimiento informado firmado y verificado
        </label>
      </div>
    </div>

    <p v-if="error" class="form-error" role="alert">{{ error }}</p>

    <p v-if="guardado" class="success-message" role="status">
      Paciente y ficha de anamnesis registrados. Redirigiendo…
    </p>

    <div class="form-actions">
      <RouterLink class="button button-secondary" to="/pacientes">
        Cancelar
      </RouterLink>

      <button class="button button-primary" type="submit">
        Guardar paciente
      </button>
    </div>
  </form>
</template>
