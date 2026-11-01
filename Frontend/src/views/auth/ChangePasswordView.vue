<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { isApiError } from '../../api/errors'
import PasswordChecklist from '../../components/auth/PasswordChecklist.vue'
import AppAlert from '../../components/ui/AppAlert.vue'
import AppButton from '../../components/ui/AppButton.vue'
import FormField from '../../components/ui/FormField.vue'
import PasswordInput from '../../components/ui/PasswordInput.vue'
import { useApi } from '../../composables/useApi'
import { useToast } from '../../composables/useToast'
import AuthLayout from '../../layouts/AuthLayout.vue'
import { homeFor, snapshotOf } from '../../router/guards'
import { confirmationError, newPasswordError } from '../../utils/validation'

const { session } = useApi()
const router = useRouter()
const toast = useToast()

const forced = computed(() => session.mustChangePassword.value)
const hasPassword = computed(() => session.state.user?.hasPassword !== false)

const form = reactive({ current: '', password: '', confirmation: '' })
const touched = reactive({
  current: false,
  password: false,
  confirmation: false,
})
const submitting = ref(false)
const failure = ref<string | null>(null)

const errors = computed(() => ({
  current:
    hasPassword.value && touched.current && !form.current
      ? forced.value
        ? 'Escribe la contraseña temporal que te dieron.'
        : 'Escribe tu contraseña actual.'
      : null,
  password: touched.password ? newPasswordError(form.password) : null,
  confirmation: touched.confirmation
    ? confirmationError(form.password, form.confirmation)
    : null,
}))

async function submit() {
  touched.current = touched.password = touched.confirmation = true
  failure.value = null
  if (Object.values(errors.value).some(Boolean)) return

  submitting.value = true
  try {
    await session.changePassword({
      currentPassword: hasPassword.value ? form.current : null,
      newPassword: form.password,
    })
    toast.success('Tu contraseña quedó guardada.')
    await router.replace(homeFor(snapshotOf(session)))
  } catch (error) {
    failure.value = isApiError(error)
      ? error.message
      : 'Algo salió mal. Inténtalo de nuevo.'
  } finally {
    submitting.value = false
  }
}

async function logout() {
  await session.logout()
  await router.push({ name: 'ingresar' })
}
</script>

<template>
  <AuthLayout
    eyebrow="Tu cuenta"
    headline="Una contraseña"
    accent="que solo tú conoces."
    intro="Con ella cuidas la información de las familias que confían en la asociación."
    :back-label="forced ? 'Volver al sitio' : 'Volver al espacio del equipo'"
    :back-to="forced ? { name: 'inicio' } : { name: 'resumen' }"
  >
    <header class="change__header">
      <h1 class="change__title">
        {{ forced ? 'Crea tu contraseña.' : 'Cambia tu contraseña.' }}
      </h1>
      <p class="change__lead">
        <template v-if="forced">
          Administración te dio una contraseña temporal para entrar la primera
          vez. Para seguir, crea una propia.
        </template>
        <template v-else-if="!hasPassword">
          Ingresas con Google. Si quieres, crea también una contraseña para
          entrar con tu correo.
        </template>
        <template v-else>
          Al guardarla se cierran tus sesiones abiertas en otros equipos.
        </template>
      </p>
    </header>

    <form class="form-stack" novalidate @submit.prevent="submit">
      <FormField
        v-if="hasPassword"
        v-slot="field"
        :label="forced ? 'Contraseña temporal' : 'Contraseña actual'"
        :error="errors.current"
      >
        <PasswordInput
          :id="field.id"
          v-model="form.current"
          :invalid="field.invalid"
          :described-by="field.describedBy"
          @blur="touched.current = true"
        />
      </FormField>

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
          :described-by="`${field.describedBy ?? ''} reglas-contrasena`.trim()"
          @blur="touched.password = true"
        />
      </FormField>
      <PasswordChecklist id="reglas-contrasena" :password="form.password" />

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

      <AppAlert v-if="failure" tone="error">{{ failure }}</AppAlert>

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

    <p v-if="forced" class="change__logout">
      ¿No eres tú?
      <AppButton variant="link" @click="logout">Cerrar sesión</AppButton>
    </p>
  </AuthLayout>
</template>

<style scoped>
.change__header {
  display: grid;
  gap: var(--auth-header-gap, var(--space-3));
}

.change__title {
  font-size: var(--auth-title-size, var(--text-4xl));
}

.change__lead {
  color: var(--color-text-muted);
  font-size: var(--auth-lead-size, var(--text-lg));
}

.change__logout {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}
</style>
