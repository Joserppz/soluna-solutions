<script setup lang="ts">
import { computed, ref } from 'vue'

import { isApiError } from '../../api/errors'
import { emailError } from '../../utils/validation'
import AppAlert from '../ui/AppAlert.vue'
import AppButton from '../ui/AppButton.vue'
import FormField from '../ui/FormField.vue'
import TurnstileWidget from './TurnstileWidget.vue'

/**
 * Formulario de un correo + verificación Turnstile, compartido por «reenviar
 * confirmación» y «recuperar contraseña». La API responde siempre lo mismo para no
 * revelar qué correos tienen cuenta.
 */
const props = defineProps<{
  submitLabel: string
  loadingLabel: string
  initialEmail?: string
  send: (email: string, turnstileToken: string) => Promise<{ message: string }>
}>()

const email = ref(props.initialEmail ?? '')
const touched = ref(false)
const captchaToken = ref<string | null>(null)
const captchaTouched = ref(false)
const turnstile = ref<InstanceType<typeof TurnstileWidget> | null>(null)
const submitting = ref(false)
const failure = ref<string | null>(null)
const sent = ref<string | null>(null)

const error = computed(() => (touched.value ? emailError(email.value) : null))
const captchaError = computed(() =>
  captchaTouched.value && !captchaToken.value
    ? 'Completa la verificación de seguridad.'
    : null,
)

async function submit() {
  touched.value = true
  captchaTouched.value = true
  failure.value = null
  if (error.value || captchaError.value) return

  submitting.value = true
  try {
    sent.value = (
      await props.send(email.value.trim(), captchaToken.value!)
    ).message
  } catch (problem) {
    failure.value = isApiError(problem)
      ? problem.message
      : 'Algo salió mal. Inténtalo de nuevo.'
  } finally {
    submitting.value = false
    turnstile.value?.reset()
  }
}
</script>

<template>
  <AppAlert v-if="sent" tone="success" title="Listo">{{ sent }}</AppAlert>
  <form v-else class="form-stack" novalidate @submit.prevent="submit">
    <FormField v-slot="field" label="Correo electrónico" :error="error">
      <input
        :id="field.id"
        v-model="email"
        class="input"
        type="email"
        name="email"
        autocomplete="email"
        inputmode="email"
        autocapitalize="off"
        spellcheck="false"
        :aria-invalid="field.invalid || undefined"
        :aria-describedby="field.describedBy"
        @blur="touched = true"
      />
    </FormField>
    <div class="captcha">
      <TurnstileWidget
        ref="turnstile"
        @verified="captchaToken = $event"
        @expired="captchaToken = null"
      />
      <p v-if="captchaError" class="captcha__error" role="alert">
        {{ captchaError }}
      </p>
    </div>
    <AppAlert v-if="failure" tone="error">{{ failure }}</AppAlert>
    <AppButton
      type="submit"
      size="lg"
      block
      :loading="submitting"
      :loading-label="loadingLabel"
    >
      {{ submitLabel }}
    </AppButton>
  </form>
</template>

<style scoped>
.captcha {
  display: grid;
  justify-items: center;
  gap: var(--space-2);
  text-align: center;
}

.captcha__error {
  color: var(--aspar-rojo);
  font-size: var(--text-sm);
  font-weight: 600;
}
</style>
