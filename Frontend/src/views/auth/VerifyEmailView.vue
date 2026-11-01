<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import { isApiError } from '../../api/errors'
import EmailRequestForm from '../../components/auth/EmailRequestForm.vue'
import AppAlert from '../../components/ui/AppAlert.vue'
import AppButton from '../../components/ui/AppButton.vue'
import SkeletonBlock from '../../components/ui/SkeletonBlock.vue'
import { useApi } from '../../composables/useApi'
import AuthLayout from '../../layouts/AuthLayout.vue'

const { api } = useApi()
const route = useRoute()

const token = computed(() =>
  typeof route.query.token === 'string' ? route.query.token : '',
)
const email = computed(() =>
  typeof route.query.correo === 'string' ? route.query.correo : '',
)
// Sin enlace se llega desde el ingreso para pedir uno nuevo
const state = ref<'checking' | 'confirmed' | 'failed' | 'request'>(
  token.value ? 'checking' : 'request',
)
const message = ref('')

function resend(address: string, turnstileToken: string) {
  return api.auth.resendVerification({ email: address, turnstileToken })
}

onMounted(async () => {
  if (!token.value) return
  try {
    message.value = (await api.auth.verifyEmail({ token: token.value })).message
    state.value = 'confirmed'
  } catch (error) {
    message.value = isApiError(error)
      ? error.message
      : 'No pudimos confirmar tu correo. Inténtalo de nuevo.'
    state.value = 'failed'
  }
})
</script>

<template>
  <AuthLayout
    eyebrow="Tu cuenta"
    headline="Un paso más"
    accent="para cuidar tu acceso."
    intro="Confirmar el correo asegura que solo tú puedas entrar a tu cuenta."
    back-label="Volver a ingresar"
    :back-to="{ name: 'ingresar' }"
  >
    <div v-if="state === 'checking'" class="verify__checking" aria-busy="true">
      <h1 class="verify__title">Confirmando tu correo…</h1>
      <SkeletonBlock :lines="2" height="1.1rem" />
    </div>

    <template v-else-if="state === 'confirmed'">
      <header class="verify__header">
        <h1 class="verify__title">¡Correo confirmado!</h1>
        <p class="verify__lead">{{ message }}</p>
      </header>
      <AppAlert tone="info">
        Si te registraste por el sitio, Administración todavía tiene que
        asignarte un rol. Al ingresar verás en qué estado está tu cuenta.
      </AppAlert>
      <AppButton size="lg" :to="{ name: 'ingresar' }">Ingresar</AppButton>
    </template>

    <template v-else>
      <header class="verify__header">
        <h1 class="verify__title">
          {{
            state === 'failed'
              ? 'Este enlace ya no sirve.'
              : 'Confirma tu correo.'
          }}
        </h1>
        <p class="verify__lead">
          {{
            state === 'failed'
              ? message
              : 'Para ingresar, primero confirma tu correo con el enlace que te enviamos.'
          }}
        </p>
      </header>
      <p>
        Pide un enlace nuevo: el anterior deja de funcionar y el nuevo vence en
        24 horas.
      </p>
      <EmailRequestForm
        :initial-email="email"
        submit-label="Enviarme un enlace nuevo"
        loading-label="Enviando…"
        :send="resend"
      />
    </template>
  </AuthLayout>
</template>

<style scoped>
.verify__header,
.verify__checking {
  display: grid;
  gap: var(--space-3);
}

.verify__title {
  font-size: var(--text-4xl);
}

.verify__lead {
  color: var(--color-text-muted);
  font-size: var(--text-lg);
}
</style>
