<script setup lang="ts">
import EmailRequestForm from '../../components/auth/EmailRequestForm.vue'
import { useApi } from '../../composables/useApi'
import AuthLayout from '../../layouts/AuthLayout.vue'

const { api } = useApi()

function send(email: string, turnstileToken: string) {
  return api.auth.forgotPassword({ email, turnstileToken })
}
</script>

<template>
  <AuthLayout
    eyebrow="Recuperar el acceso"
    headline="Una contraseña nueva,"
    accent="sin perder lo tuyo."
    intro="Tu cuenta y tu información quedan igual: solo cambia la forma de entrar."
    back-label="Volver a ingresar"
    :back-to="{ name: 'ingresar' }"
  >
    <header class="forgot__header">
      <h1 class="forgot__title">¿Olvidaste tu contraseña?</h1>
      <p class="forgot__lead">
        Escribe el correo de tu cuenta y te enviaremos un enlace para crear una
        nueva. El enlace vence en 60 minutos.
      </p>
    </header>

    <EmailRequestForm
      submit-label="Enviarme el enlace"
      loading-label="Enviando…"
      :send="send"
    />

    <p class="forgot__note">
      ¿No te llega el correo? También puedes pedirle a Administración una
      contraseña temporal.
    </p>
  </AuthLayout>
</template>

<style scoped>
.forgot__header {
  display: grid;
  gap: var(--auth-header-gap, var(--space-3));
}

.forgot__title {
  font-size: var(--auth-title-size, var(--text-4xl));
}

.forgot__lead {
  color: var(--color-text-muted);
  font-size: var(--auth-lead-size, var(--text-lg));
}

.forgot__note {
  padding: var(--space-4) var(--space-5);
  border-radius: var(--radius-md);
  background: var(--color-surface-sunken);
}
</style>
