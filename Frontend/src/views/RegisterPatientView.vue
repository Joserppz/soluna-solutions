<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { savePatient } from '../services/aspar'

const router = useRouter()
const guardado = ref(false)

const form = reactive({
  name: '',
  ci: '',
  phone: '',
  emergencyContact: '',
})

function submitForm() {
  savePatient({ ...form })
  guardado.value = true

  window.setTimeout(() => {
    router.push('/asistencia')
  }, 900)
}
</script>

<template>
  <section class="page-heading">
    <span class="eyebrow">Gestión de pacientes</span>
    <h1>Registrar paciente</h1>
    <p>Completa los datos básicos para agregar a una persona al registro.</p>
  </section>

  <form class="card form-card wide-card" @submit.prevent="submitForm">
    <div class="form-grid">
      <div class="field">
        <label for="name">Nombre completo</label>
        <input id="name" v-model.trim="form.name" required />
      </div>

      <div class="field">
        <label for="ci">Cédula de identidad</label>
        <input id="ci" v-model.trim="form.ci" required />
      </div>

      <div class="field">
        <label for="phone">Teléfono</label>
        <input id="phone" v-model.trim="form.phone" type="tel" required />
      </div>

      <div class="field">
        <label for="emergency">Contacto de emergencia</label>
        <input id="emergency" v-model.trim="form.emergencyContact" required />
      </div>
    </div>

    <p v-if="guardado" class="success-message" role="status">
      Paciente registrado. Abriendo asistencia…
    </p>

    <div class="form-actions">
      <RouterLink class="button button-secondary" to="/">Cancelar</RouterLink>
      <button class="button button-primary" type="submit">
        Guardar paciente
      </button>
    </div>
  </form>
</template>