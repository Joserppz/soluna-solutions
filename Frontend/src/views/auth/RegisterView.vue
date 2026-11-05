<script setup lang="ts">
import { computed, reactive, ref } from 'vue'

import { isApiError } from '../../api/errors'
import PasswordChecklist from '../../components/auth/PasswordChecklist.vue'
import TurnstileWidget from '../../components/auth/TurnstileWidget.vue'
import AppAlert from '../../components/ui/AppAlert.vue'
import AppButton from '../../components/ui/AppButton.vue'
import FormField from '../../components/ui/FormField.vue'
import PasswordInput from '../../components/ui/PasswordInput.vue'
import { useApi } from '../../composables/useApi'
import AuthLayout from '../../layouts/AuthLayout.vue'
import {
  confirmationError,
  emailError,
  nameError,
  newPasswordError,
} from '../../utils/validation'

const { api } = useApi()

const form = reactive({ name: '', email: '', password: '', confirmation: '' })
const touched = reactive({
  name: false,
  email: false,
  password: false,
  confirmation: false,
  captcha: false,
})
const captchaToken = ref<string | null>(null)
const turnstile = ref<InstanceType<typeof TurnstileWidget> | null>(null)
const submitting = ref(false)
const failure = ref<string | null>(null)
const sentTo = ref<string | null>(null)
const sentMessage = ref('')

const errors = computed(() => ({
  name: touched.name ? nameError(form.name) : null,
  email: touched.email ? emailError(form.email) : null,
  password: touched.password ? newPasswordError(form.password) : null,
  confirmation: touched.confirmation
    ? confirmationError(form.password, form.confirmation)
    : null,
  captcha:
    touched.captcha && !captchaToken.value
      ? 'Completa la verificación de seguridad.'
      : null,
}))

async function submit() {
  for (const key of Object.keys(touched) as (keyof typeof touched)[])
    touched[key] = true
  failure.value = null
  if (Object.values(errors.value).some(Boolean)) return

  submitting.value = true
  try {
    const email = form.email.trim()
    const response = await api.auth.register({
      name: form.name.trim(),
      email,
      password: form.password,
      turnstileToken: captchaToken.value!,
    })
    sentMessage.value = response.message
    sentTo.value = email
  } catch (error) {
    failure.value = isApiError(error)
      ? error.message
      : 'Algo salió mal. Inténtalo de nuevo.'
  } finally {
    submitting.value = false
    // El token de verificación sirve una sola vez
    turnstile.value?.reset()
  }
}
</script>

<template>
  <AuthLayout
    eyebrow="Únete al equipo"
    headline="Acompañar"
    accent="también es tu lugar."
    intro="Si colaboras con la asociación, crea tu cuenta. Administración te dará acceso a lo que necesites para acompañar a la comunidad."
  >
    <template v-if="sentTo">
      <header class="register__header">
        <h1 class="register__title">Revisa tu correo.</h1>
        <p class="register__lead">{{ sentMessage }}</p>
      </header>
      <ol class="register__steps">
        <li>
          Abre el enlace que enviamos a <strong>{{ sentTo }}</strong> para
          confirmar que el correo es tuyo. Vence en 24 horas.
        </li>
        <li>
          Administración revisará tu cuenta y te asignará un rol. Mientras tanto
          puedes ingresar y recorrer el sitio.
        </li>
      </ol>
      <p class="text-muted">
        ¿No llegó? Revisa la carpeta de spam o
        <RouterLink
          :to="{ name: 'verificar-correo', query: { correo: sentTo } }"
          >pide un enlace nuevo</RouterLink
        >.
      </p>
      <AppButton size="lg" :to="{ name: 'ingresar' }">Ir a ingresar</AppButton>
    </template>

    <template v-else>
      <header class="register__header">
        <h1 class="register__title">Crea tu cuenta.</h1>
        <p class="register__lead">
          Es para el equipo de la asociación. Las familias y quienes visitan el
          sitio no necesitan una.
        </p>
      </header>

      <form class="form-stack" novalidate @submit.prevent="submit">
        <!-- En escritorio los campos van de a dos para que todo entre sin desplazarse -->
        <div class="register__pair register__pair--short">
          <FormField
            v-slot="field"
            label="Nombre completo"
            :error="errors.name"
            required
          >
            <input
              :id="field.id"
              v-model="form.name"
              class="input"
              :class="{ 'is-valid': touched.name && !errors.name }"
              name="name"
              autocomplete="name"
              :aria-invalid="field.invalid || undefined"
              :aria-describedby="field.describedBy"
              required
              @blur="touched.name = true"
            />
          </FormField>

          <FormField
            v-slot="field"
            label="Correo electrónico"
            hint="Te enviaremos un enlace para confirmarlo."
            :error="errors.email"
            required
          >
            <input
              :id="field.id"
              v-model="form.email"
              class="input"
              :class="{ 'is-valid': touched.email && !errors.email }"
              type="email"
              name="email"
              autocomplete="email"
              inputmode="email"
              autocapitalize="off"
              spellcheck="false"
              :aria-invalid="field.invalid || undefined"
              :aria-describedby="field.describedBy"
              required
              @blur="touched.email = true"
            />
          </FormField>
        </div>

        <div class="register__pair">
          <FormField
            v-slot="field"
            label="Contraseña"
            :error="errors.password"
            required
          >
            <PasswordInput
              :id="field.id"
              v-model="form.password"
              autocomplete="new-password"
              :invalid="field.invalid"
              :described-by="
                `${field.describedBy ?? ''} reglas-registro`.trim()
              "
              required
              @blur="touched.password = true"
            />
          </FormField>

          <FormField
            v-slot="field"
            label="Repite la contraseña"
            :error="errors.confirmation"
            required
          >
            <PasswordInput
              :id="field.id"
              v-model="form.confirmation"
              autocomplete="new-password"
              :invalid="field.invalid"
              :described-by="field.describedBy"
              required
              @blur="touched.confirmation = true"
            />
          </FormField>
        </div>
        <PasswordChecklist id="reglas-registro" :password="form.password" />

        <div class="register__captcha">
          <TurnstileWidget
            ref="turnstile"
            @verified="captchaToken = $event"
            @expired="captchaToken = null"
          />
          <p v-if="errors.captcha" class="register__captcha-error" role="alert">
            {{ errors.captcha }}
          </p>
        </div>

        <AppAlert v-if="failure" tone="error">{{ failure }}</AppAlert>

        <AppButton
          type="submit"
          size="lg"
          block
          :loading="submitting"
          loading-label="Creando tu cuenta…"
        >
          Crear cuenta
        </AppButton>
      </form>

      <p>
        ¿Ya tienes cuenta?
        <RouterLink :to="{ name: 'ingresar' }">Ingresa aquí</RouterLink>
      </p>
    </template>
  </AuthLayout>
</template>

<style scoped>
.register__header {
  display: grid;
  gap: var(--auth-header-gap, var(--space-3));
}

.register__title {
  font-size: var(--auth-title-size, var(--text-4xl));
}

.register__lead {
  color: var(--color-text-muted);
  font-size: var(--auth-lead-size, var(--text-lg));
}

.register__steps {
  display: grid;
  gap: var(--space-3);
  margin: 0;
  padding: var(--space-5) var(--space-5) var(--space-5) var(--space-10);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
}

/* Escritorio: las dos contraseñas lado a lado; en ventanas bajas también el nombre y
   el correo. Así el formulario entra completo, sin barra de desplazamiento */
.register__pair {
  display: grid;
  gap: var(--form-gap, var(--space-4));
}

@media (min-width: 900px) {
  .register__pair {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
    column-gap: var(--space-4);
  }

  .register__pair--short {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (min-width: 900px) and (max-height: 820px) {
  .register__pair--short {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.register__captcha {
  display: grid;
  justify-items: center;
  gap: var(--space-2);
}

.register__captcha-error {
  color: var(--aspar-rojo);
  font-size: var(--text-sm);
  font-weight: 600;
}
</style>
