<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'

import { isApiError } from '../../api/errors'
import PasswordChecklist from '../../components/auth/PasswordChecklist.vue'
import AppAlert from '../../components/ui/AppAlert.vue'
import AppButton from '../../components/ui/AppButton.vue'
import FormField from '../../components/ui/FormField.vue'
import PasswordInput from '../../components/ui/PasswordInput.vue'
import { useApi } from '../../composables/useApi'
import AuthLayout from '../../layouts/AuthLayout.vue'
import { confirmationError, newPasswordError } from '../../utils/validation'

const { api } = useApi()
const route = useRoute()

const token = computed(() =>
  typeof route.query.token === 'string' ? route.query.token : '',
)
const form = reactive({ password: '', confirmation: '' })
const touched = reactive({ password: false, confirmation: false })
const submitting = ref(false)
const failure = ref<string | null>(null)
const done = ref<string | null>(null)

const errors = computed(() => ({
  password: touched.password ? newPasswordError(form.password) : null,
  confirmation: touched.confirmation
    ? confirmationError(form.password, form.confirmation)
    : null,
}))

async function submit() {
  touched.password = touched.confirmation = true
  failure.value = null
  if (errors.value.password || errors.value.confirmation) return

  submitting.value = true
  try {
    done.value = (
      await api.auth.resetPassword({
        token: token.value,
        password: form.password,
      })
    ).message
  } catch (error) {
    failure.value = isApiError(error)
      ? error.message
      : 'Algo salió mal. Inténtalo de nuevo.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AuthLayout
    eyebrow="Recuperar el acceso"
    headline="Una contraseña nueva,"
    accent="sin perder lo tuyo."
    intro="Al guardarla se cierran tus sesiones abiertas en otros equipos."
    back-label="Volver a ingresar"
    :back-to="{ name: 'ingresar' }"
  >
    <template v-if="done">
      <header class="reset__header">
        <h1 class="reset__title">Contraseña actualizada.</h1>
        <p class="reset__lead">{{ done }}</p>
      </header>
      <AppButton size="lg" :to="{ name: 'ingresar' }">Ingresar</AppButton>
    </template>

    <template v-else-if="!token">
      <header class="reset__header">
        <h1 class="reset__title">Este enlace está incompleto.</h1>
        <p class="reset__lead">
          Abre el enlace completo del correo o pide uno nuevo.
        </p>
      </header>
      <AppButton size="lg" :to="{ name: 'recuperar-contrasena' }">
        Pedir un enlace nuevo
      </AppButton>
    </template>

    <template v-else>
      <header class="reset__header">
        <h1 class="reset__title">Crea tu contraseña nueva.</h1>
        <p class="reset__lead">Elige una que no uses en otros sitios.</p>
      </header>
      <form class="form-stack" novalidate @submit.prevent="submit">
        <FormField
          v-slot="field"
          label="Contraseña nueva"
          :error="errors.password"
        >
          <PasswordInput
            :id="field.id"
            v-model="form.password"
            autocomplete="new-password"
            :invalid="field.invalid"
            :described-by="
              `${field.describedBy ?? ''} reglas-restablecer`.trim()
            "
            @blur="touched.password = true"
          />
        </FormField>
        <PasswordChecklist id="reglas-restablecer" :password="form.password" />
        <FormField
          v-slot="field"
          label="Repite la contraseña nueva"
          :error="errors.confirmation"
        >
          <PasswordInput
            :id="field.id"
            v-model="form.confirmation"
            autocomplete="new-password"
            :invalid="field.invalid"
            :described-by="field.describedBy"
            @blur="touched.confirmation = true"
          />
        </FormField>

        <AppAlert v-if="failure" tone="error">
          {{ failure }}
          <RouterLink :to="{ name: 'recuperar-contrasena' }">
            Pedir un enlace nuevo
          </RouterLink>
        </AppAlert>

        <AppButton
          type="submit"
          size="lg"
          block
          :loading="submitting"
          loading-label="Guardando…"
        >
          Guardar contraseña
        </AppButton>
      </form>
    </template>
  </AuthLayout>
</template>

<style scoped>
.reset__header {
  display: grid;
  gap: var(--auth-header-gap, var(--space-3));
}

.reset__title {
  font-size: var(--auth-title-size, var(--text-4xl));
}

.reset__lead {
  color: var(--color-text-muted);
  font-size: var(--auth-lead-size, var(--text-lg));
}
</style>
