<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { signIn } from '../services/aspar'

const email = ref('')
const password = ref('')
const error = ref('')
const router = useRouter()
const route = useRoute()

function submitLogin() {
  error.value = ''

  if (!email.value.trim() || !password.value) {
    error.value = 'Completa el correo y la contraseña.'
    return
  }

  if (!signIn(email.value, password.value)) {
    error.value = 'Correo o contraseña incorrectos, o usuario inactivo.'
    return
  }

  const redirect =
    typeof route.query.redirect === 'string' ? route.query.redirect : '/'

  router.push(redirect)
}
</script>

<template>
  <section class="auth-layout">
    <div class="auth-intro">
      <span class="eyebrow">Bienvenido a ASPAR</span>
      <h1>Un espacio para acompañar cada paso.</h1>
      <p>Ingresa para gestionar las actividades de la fundación.</p>
    </div>

    <form class="card form-card" @submit.prevent="submitLogin">
      <h2>Iniciar sesión</h2>
      <p class="muted">Usa las credenciales de tu cuenta.</p>

      <label for="email">Correo electrónico</label>
      <input
        id="email"
        v-model.trim="email"
        type="email"
        autocomplete="username"
        required
      />

      <label for="password">Contraseña</label>
      <input
        id="password"
        v-model="password"
        type="password"
        autocomplete="current-password"
        minlength="8"
        required
      />

      <p v-if="error" class="form-error" role="alert">{{ error }}</p>

      <button class="button button-primary full-width" type="submit">
        Ingresar
      </button>

      <p class="demo-hint">
        Admin: <strong>admin@aspar.org</strong> / <strong>Admin2026!</strong>
        <br />
        Usuario: <strong>demo@aspar.org</strong> /
        <strong>Aspar2026!</strong>
      </p>
    </form>
  </section>
</template>