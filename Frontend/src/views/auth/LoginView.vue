<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { isApiError } from '../../api/errors'
import AppAlert from '../../components/ui/AppAlert.vue'
import AppButton from '../../components/ui/AppButton.vue'
import FormField from '../../components/ui/FormField.vue'
import PasswordInput from '../../components/ui/PasswordInput.vue'
import { useApi } from '../../composables/useApi'
import AuthLayout from '../../layouts/AuthLayout.vue'
import { homeFor, safeRedirect, snapshotOf } from '../../router/guards'
import { emailError } from '../../utils/validation'

const { session } = useApi()
const route = useRoute()
const router = useRouter()

const form = reactive({ email: '', password: '' })
const touched = reactive({ email: false, password: false })
const submitting = ref(false)
const failure = ref<string | null>(null)

const NOTICES: Record<string, { tone: 'info' | 'warning'; text: string }> = {
  inactividad: {
    tone: 'info',
    text: 'Cerramos tu sesión tras 15 minutos sin uso, para cuidar la información. Vuelve a ingresar para continuar.',
  },
  expirada: {
    tone: 'info',
    text: 'Tu sesión terminó. Vuelve a ingresar para continuar donde estabas.',
  },
  'sin-conexion': {
    tone: 'warning',
    text: 'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
  },
}
const notice = computed(() => {
  const reason = route.query.motivo
  return typeof reason === 'string' ? (NOTICES[reason] ?? null) : null
})

const errors = computed(() => ({
  email: touched.email ? emailError(form.email) : null,
  password:
    touched.password && !form.password ? 'Escribe tu contraseña.' : null,
}))

async function submit() {
  touched.email = true
  touched.password = true
  failure.value = null
  if (errors.value.email || errors.value.password) return

  submitting.value = true
  try {
    await session.login(form.email.trim(), form.password)
    const target = safeRedirect(route.query.redirect)
    await router.replace(target ?? homeFor(snapshotOf(session)))
  } catch (error) {
    // La API responde igual exista o no la cuenta (RNF-02): se muestra su mensaje
    failure.value = isApiError(error)
      ? error.message
      : 'Algo salió mal. Inténtalo de nuevo.'
    form.password = ''
    touched.password = false
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AuthLayout>
    <header class="login__header">
      <h1 class="login__title">Hola de nuevo.</h1>
      <p class="login__lead">
        Ingresa con la cuenta que te dio la asociación. Quienes visitan el sitio
        no necesitan una.
      </p>
    </header>

    <AppAlert v-if="notice && !failure" :tone="notice.tone">
      {{ notice.text }}
    </AppAlert>

    <form class="form-stack" novalidate @submit.prevent="submit">
      <FormField
        v-slot="field"
        label="Correo electrónico"
        :error="errors.email"
      >
        <input
          :id="field.id"
          v-model="form.email"
          class="input"
          :class="{ 'is-valid': touched.email && !errors.email }"
          type="email"
          name="email"
          autocomplete="username"
          inputmode="email"
          autocapitalize="off"
          spellcheck="false"
          :aria-invalid="field.invalid || undefined"
          :aria-describedby="field.describedBy"
          @blur="touched.email = true"
        />
      </FormField>

      <FormField v-slot="field" label="Contraseña" :error="errors.password">
        <PasswordInput
          :id="field.id"
          v-model="form.password"
          :invalid="field.invalid"
          :described-by="field.describedBy"
          @blur="touched.password = true"
        />
      </FormField>

      <AppAlert v-if="failure" tone="error">{{ failure }}</AppAlert>

      <AppButton
        type="submit"
        size="lg"
        block
        :loading="submitting"
        loading-label="Ingresando…"
      >
        Ingresar
      </AppButton>
    </form>

    <p class="login__help">
      ¿Olvidaste tu contraseña?
      <span class="text-muted"
        >Pídele a Administración que te dé una nueva.</span
      >
    </p>

    <p class="login__note">
      Usa un equipo de confianza y cierra sesión al terminar. Por tu
      tranquilidad, la sesión se cierra sola tras 15 minutos sin uso.
    </p>
  </AuthLayout>
</template>

<style scoped>
.login__header {
  display: grid;
  gap: var(--space-3);
}

.login__title {
  font-size: var(--text-4xl);
}

.login__lead {
  color: var(--color-text-muted);
  font-size: var(--text-lg);
}

.login__help {
  font-size: var(--text-md);
}

.login__note {
  padding: var(--space-4) var(--space-5);
  border-radius: var(--radius-md);
  background: var(--color-surface-sunken);
  color: var(--color-text);
  font-size: var(--text-md);
}
</style>
