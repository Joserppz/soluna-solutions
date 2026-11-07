<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'

import { isApiError } from '../../api/errors'
import type { PublicInquiryIn } from '../../api/types'
import { useApi } from '../../composables/useApi'
import {
  CONTACT_KINDS,
  cleanPhone,
  contactErrors,
  type ContactKind,
} from '../../utils/site'
import TurnstileWidget from '../auth/TurnstileWidget.vue'
import AppAlert from '../ui/AppAlert.vue'
import AppButton from '../ui/AppButton.vue'
import FormField from '../ui/FormField.vue'

/**
 * «No tienes que saber por dónde empezar» (pág. 2) y «Quiero participar» en una
 * actividad: nombre, teléfono, motivo y permiso para llamar (`POST /public/inquiries`).
 * Con `scheduleId` el motivo es «participar» en esa actividad.
 */
const props = withDefaults(
  defineProps<{
    scheduleId?: string | null
    /** Motivo elegido al abrir (por ejemplo, desde «Donar en especie →»). */
    initialKind?: ContactKind
    submitLabel?: string
    idPrefix?: string
  }>(),
  {
    scheduleId: null,
    initialKind: 'orientacion',
    submitLabel: 'Enviar mensaje',
    idPrefix: 'contacto',
  },
)

const emit = defineEmits<{ sent: [message: string] }>()

const { api } = useApi()

const form = reactive({
  name: '',
  phone: '',
  kind: props.initialKind as ContactKind,
  onBehalfOf: '',
  message: '',
  consent: false,
})
const touched = ref(false)
const token = ref<string | null>(null)
const turnstile = ref<InstanceType<typeof TurnstileWidget> | null>(null)
const sending = ref(false)
const failure = ref<string | null>(null)

watch(
  () => props.initialKind,
  (kind) => {
    form.kind = kind
  },
)

const participating = computed(() => Boolean(props.scheduleId))
const errors = computed(() => {
  if (!touched.value)
    return { name: null, phone: null, consent: null, captcha: null }
  return {
    ...contactErrors(form),
    captcha: token.value ? null : 'Completa la verificación de seguridad.',
  }
})

function field(name: string) {
  return `${props.idPrefix}-${name}`
}

async function submit() {
  touched.value = true
  failure.value = null
  if (Object.values(errors.value).some(Boolean)) return

  const body: PublicInquiryIn = {
    kind: participating.value ? 'participar' : form.kind,
    name: form.name.trim(),
    phone: cleanPhone(form.phone),
    onBehalfOf: form.onBehalfOf.trim(),
    message: form.message.trim(),
    scheduleId: props.scheduleId,
    contactConsent: form.consent,
    turnstileToken: token.value!,
  }
  sending.value = true
  try {
    const response = await api.public.sendInquiry(body)
    emit('sent', response.message)
  } catch (error) {
    failure.value = isApiError(error)
      ? error.message
      : 'No pudimos enviar tu mensaje. Revisa tu conexión e inténtalo de nuevo.'
  } finally {
    sending.value = false
    // El token de verificación sirve una sola vez
    turnstile.value?.reset()
  }
}
</script>

<template>
  <form class="inquiry" novalidate @submit.prevent="submit">
    <div class="inquiry__two">
      <FormField
        :id="field('nombre')"
        v-slot="{ id, describedBy, invalid }"
        label="Nombre"
        required
        :error="errors.name"
      >
        <input
          :id="id"
          v-model="form.name"
          class="input"
          autocomplete="name"
          maxlength="120"
          placeholder="¿Cómo te llamas?"
          :aria-describedby="describedBy"
          :aria-invalid="invalid"
        />
      </FormField>
      <FormField
        :id="field('telefono')"
        v-slot="{ id, describedBy, invalid }"
        label="Teléfono"
        required
        :error="errors.phone"
      >
        <input
          :id="id"
          v-model="form.phone"
          class="input"
          type="tel"
          inputmode="tel"
          autocomplete="tel"
          maxlength="16"
          placeholder="Para poder llamarte"
          :aria-describedby="describedBy"
          :aria-invalid="invalid"
        />
      </FormField>
    </div>

    <FormField
      v-if="participating"
      :id="field('para')"
      v-slot="{ id }"
      label="¿Es para otra persona?"
    >
      <input
        :id="id"
        v-model="form.onBehalfOf"
        class="input"
        maxlength="120"
        placeholder="Opcional. Por ejemplo: «para mi papá, Julio»"
      />
    </FormField>
    <FormField
      v-else
      :id="field('motivo')"
      v-slot="{ id }"
      label="¿Para qué nos escribes?"
      required
    >
      <select :id="id" v-model="form.kind" class="select">
        <option
          v-for="kind in CONTACT_KINDS"
          :key="kind.value"
          :value="kind.value"
        >
          {{ kind.label }}
        </option>
      </select>
    </FormField>

    <FormField :id="field('mensaje')" v-slot="{ id }" label="Mensaje">
      <textarea
        :id="id"
        v-model="form.message"
        class="textarea"
        :rows="participating ? 2 : 3"
        maxlength="1000"
        placeholder="Cuéntanos brevemente cómo podemos ayudarte. No incluyas datos médicos."
      />
    </FormField>

    <div class="inquiry__consent">
      <label class="checkbox">
        <input
          v-model="form.consent"
          type="checkbox"
          :aria-invalid="Boolean(errors.consent)"
          :aria-describedby="errors.consent ? field('permiso') : undefined"
        />
        <span
          >Autorizo a ASPAR a contactarme para responder a esta solicitud.</span
        >
      </label>
      <p v-if="errors.consent" :id="field('permiso')" class="inquiry__error">
        {{ errors.consent }}
      </p>
    </div>

    <div class="inquiry__captcha">
      <TurnstileWidget
        ref="turnstile"
        @verified="token = $event"
        @expired="token = null"
      />
      <p v-if="errors.captcha" class="inquiry__error">{{ errors.captcha }}</p>
    </div>

    <AppAlert v-if="failure" tone="error">{{ failure }}</AppAlert>

    <div class="inquiry__actions">
      <AppButton type="submit" :loading="sending" loading-label="Enviando…">
        {{ submitLabel }}
      </AppButton>
    </div>
  </form>
</template>

<style scoped>
.inquiry {
  display: grid;
  gap: var(--space-4);
}

.inquiry__two {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
  gap: var(--space-4);
}

.inquiry__consent,
.inquiry__captcha {
  display: grid;
  gap: var(--space-2);
}

.inquiry__captcha :deep(.turnstile) {
  justify-items: start;
}

.inquiry__error {
  margin: 0;
  color: var(--color-danger);
  font-size: var(--text-sm);
}

.inquiry__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
}
</style>
