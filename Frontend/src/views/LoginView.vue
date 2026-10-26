<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { signInWithApi } from '../services/aspar'
import { getApiBaseUrl } from '../services/api'

const email = ref('')
const password = ref('')
const error = ref('')
const isSubmitting = ref(false)
const failedAttempts = ref(0)
const lockedUntil = ref(0)

const router = useRouter()
const route = useRoute()
const apiBaseUrl = getApiBaseUrl()
// Las cuentas de prueba solo se muestran en desarrollo, nunca en el build de producción
const showDemoAccounts = import.meta.env.DEV

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const emailValidationMessage = computed(() => {
  if (!email.value) return ''
  if (!emailPattern.test(email.value.trim())) {
    return 'Ingresa un correo electrónico con formato válido (ej. usuario@aspar.org).'
  }
  return ''
})

const passwordValidationMessage = computed(() => {
  if (!password.value) return ''
  if (password.value.length < 8) {
    return 'La contraseña debe tener un mínimo de 8 caracteres.'
  }
  return ''
})

function validateCredentials(): string | null {
  if (lockedUntil.value > Date.now()) {
    const remainingSec = Math.ceil((lockedUntil.value - Date.now()) / 1000)
    return `Demasiados intentos fallidos. Espera ${remainingSec} segundos antes de volver a intentar.`
  }

  const trimmedEmail = email.value.trim()
  if (!trimmedEmail || !password.value) {
    return 'Completa el correo y la contraseña.'
  }

  if (!emailPattern.test(trimmedEmail)) {
    return 'Ingresa un correo electrónico con formato válido.'
  }

  if (password.value.length < 8) {
    return 'La contraseña debe contener al menos 8 caracteres.'
  }

  return null
}

async function submitLogin() {
  error.value = ''

  const validationError = validateCredentials()
  if (validationError) {
    error.value = validationError
    return
  }

  isSubmitting.value = true
  try {
    // Intenta el Backend y, si no responde, usa el modo local (un solo registro por intento)
    const { ok: authenticated } = await signInWithApi(
      email.value,
      password.value,
    )

    if (!authenticated) {
      failedAttempts.value += 1
      if (failedAttempts.value >= 5) {
        lockedUntil.value = Date.now() + 30_000
        error.value =
          'Cuenta bloqueada temporalmente por 30 segundos tras 5 intentos fallidos (RNF-02).'
      } else {
        error.value = 'Correo o contraseña incorrectos, o usuario inactivo.'
      }
      return
    }

    failedAttempts.value = 0
    const redirect =
      typeof route.query.redirect === 'string' ? route.query.redirect : '/'

    await router.push(redirect)
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <section class="auth-layout">
    <div class="auth-intro">
      <span class="eyebrow">Bienvenido a ASPAR · RF-01</span>
      <h1>Acceso administrativo y clínico seguro.</h1>
      <p>
        Ingresa con tus credenciales institucionales para gestionar fichas de
        pacientes, anamnesis, inventario, cronogramas y auditoría de la
        Asociación de Parkinson "Mario Lagrava".
      </p>
      <p class="muted">
        Endpoint autenticado: <code>{{ apiBaseUrl }}/auth/login</code> (JWT +
        bcrypt RNF-02)
      </p>
    </div>

    <form
      class="card form-card"
      novalidate
      aria-label="Formulario de inicio de sesión administrativo"
      @submit.prevent="submitLogin"
    >
      <h2>Iniciar sesión</h2>
      <p class="muted">Usa las credenciales asignadas a tu rol en ASPAR.</p>

      <label for="email">Correo electrónico institucional</label>
      <input
        id="email"
        v-model.trim="email"
        type="email"
        autocomplete="username"
        placeholder="admin@aspar.org"
        :aria-invalid="Boolean(emailValidationMessage)"
        required
      />
      <small v-if="emailValidationMessage" class="field-hint-error">
        {{ emailValidationMessage }}
      </small>

      <label for="password">Contraseña segura</label>
      <input
        id="password"
        v-model="password"
        type="password"
        autocomplete="current-password"
        placeholder="Mínimo 8 caracteres"
        minlength="8"
        :aria-invalid="Boolean(passwordValidationMessage)"
        required
      />
      <small v-if="passwordValidationMessage" class="field-hint-error">
        {{ passwordValidationMessage }}
      </small>

      <p v-if="error" class="form-error" role="alert">{{ error }}</p>

      <button
        class="button button-primary full-width"
        type="submit"
        :disabled="isSubmitting"
      >
        {{ isSubmitting ? 'Verificando credenciales...' : 'Ingresar' }}
      </button>

      <div v-if="showDemoAccounts" class="demo-hint">
        <strong>Cuentas de verificación por rol (Jira / SRS):</strong>
        <br />
        Admin (Greta): <strong>admin@aspar.org</strong> /
        <strong>Admin2026!</strong>
        <br />
        Coordinador (Junior): <strong>coordinacion@aspar.org</strong> /
        <strong>Coord2026!</strong>
        <br />
        Profesional: <strong>demo@aspar.org</strong> /
        <strong>Aspar2026!</strong>
        <br />
        Recepción: <strong>recepcion@aspar.org</strong> /
        <strong>Recep2026!</strong>
      </div>
    </form>
  </section>
</template>
