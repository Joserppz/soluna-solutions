<script setup lang="ts">
/**
 * «Inscribir como afiliado →» (diseño pág. 17): la ficha nueva se abre con el nombre, el
 * teléfono y la zona de la solicitud (`GET /inquiries/{id}/patient-draft`). Falta el
 * carnet y, si escribió por sí misma, un familiar o persona cuidadora. La ficha queda
 * sin consentimiento: se firma en la sede (`POST /inquiries/{id}/convert-to-patient`).
 */
import { computed, nextTick, reactive, ref, watch } from 'vue'

import { isApiError } from '../../api/errors'
import type { InquiryOut, PatientOut } from '../../api/types'
import { useApi } from '../../composables/useApi'
import { todayIso } from '../../utils/format'
import {
  DUPLICATE_CI_MESSAGE,
  ciError,
  cleanCi,
  cleanPhone,
  pastDateError,
  personNameError,
  phoneError,
} from '../../utils/patients'
import ContactFields, {
  type ContactDraft,
  type ContactErrors,
} from '../patients/ContactFields.vue'
import AppAlert from '../ui/AppAlert.vue'
import AppButton from '../ui/AppButton.vue'
import AppModal from '../ui/AppModal.vue'
import FormField from '../ui/FormField.vue'
import SkeletonBlock from '../ui/SkeletonBlock.vue'

const props = defineProps<{ open: boolean; inquiry: InquiryOut | null }>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  enrolled: [patient: PatientOut]
}>()

const { api } = useApi()

const draft = reactive({
  name: '',
  ci: '',
  birthDate: '',
  phone: '',
  zone: '',
  address: '',
})
const contact = ref<ContactDraft>({ name: '', relation: '', phone: '' })
/** La solicitud ya trae a quien escribió como contacto (escribió por otra persona). */
const draftContacts = ref<ContactDraft[]>([])
const loading = ref(false)
const submitted = ref(false)
const saving = ref(false)
const failure = ref<string | null>(null)
const duplicateCi = ref<string | null>(null)
const form = ref<HTMLFormElement | null>(null)

const needsContact = computed(() => !draftContacts.value.length)
const errors = computed(() => ({
  name: personNameError(draft.name),
  ci:
    duplicateCi.value && cleanCi(draft.ci) === duplicateCi.value
      ? DUPLICATE_CI_MESSAGE
      : ciError(draft.ci),
  birthDate: pastDateError(draft.birthDate, todayIso()),
  phone: phoneError(draft.phone),
  contact: needsContact.value
    ? ({
        name: personNameError(contact.value.name),
        relation: contact.value.relation
          ? null
          : 'Elige la relación con la persona.',
        phone: phoneError(contact.value.phone),
      } as ContactErrors)
    : ({} as ContactErrors),
}))
const valid = computed(() => {
  const { contact: contactErrors, ...fields } = errors.value
  return (
    Object.values(fields).every((e) => !e) &&
    Object.values(contactErrors).every((e) => !e)
  )
})

function shown<T>(error: T): T | null {
  return submitted.value ? error : null
}

watch(
  () => [props.open, props.inquiry?.id] as const,
  async ([open, id]) => {
    if (!open || !id) return
    submitted.value = false
    failure.value = null
    duplicateCi.value = null
    Object.assign(draft, {
      name: '',
      ci: '',
      birthDate: '',
      phone: '',
      zone: '',
      address: '',
    })
    contact.value = { name: '', relation: '', phone: '' }
    draftContacts.value = []
    loading.value = true
    try {
      const data = await api.inquiries.patientDraft(id)
      Object.assign(draft, {
        name: data.name,
        phone: data.phone,
        zone: data.zone,
      })
      draftContacts.value = data.contacts.map((c) => ({
        name: c.name,
        relation: c.relation,
        phone: c.phone,
      }))
    } catch (error) {
      failure.value = isApiError(error)
        ? error.message
        : 'No pudimos traer los datos de la solicitud.'
    } finally {
      loading.value = false
    }
  },
  { immediate: true },
)

async function submit() {
  submitted.value = true
  failure.value = null
  if (!valid.value || !props.inquiry) {
    await nextTick()
    form.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
    return
  }
  saving.value = true
  try {
    const patient = await api.inquiries.convertToPatient(props.inquiry.id, {
      name: draft.name.trim(),
      ci: cleanCi(draft.ci),
      birthDate: draft.birthDate || null,
      phone: cleanPhone(draft.phone),
      zone: draft.zone.trim(),
      address: draft.address.trim(),
      contacts: needsContact.value
        ? [
            {
              name: contact.value.name.trim(),
              relation: contact.value.relation,
              phone: cleanPhone(contact.value.phone),
              isPrimary: true,
            },
          ]
        : [],
    })
    emit('enrolled', patient)
    emit('update:open', false)
  } catch (error) {
    // 409 también es «la solicitud ya tiene ficha»: el carnet repetido se reconoce por el texto
    if (
      isApiError(error) &&
      error.status === 409 &&
      /c[ée]dula|carnet/i.test(error.message)
    )
      duplicateCi.value = cleanCi(draft.ci)
    else
      failure.value = isApiError(error)
        ? error.message
        : 'No pudimos abrir la ficha. Intenta de nuevo.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppModal
    :open="open"
    size="lg"
    title="Inscribir como afiliado"
    description="Revisa los datos de la solicitud y completa el carnet. El consentimiento se firma en la sede."
    :dismissible="!saving"
    @update:open="emit('update:open', $event)"
  >
    <div v-if="loading" class="enroll" aria-busy="true">
      <SkeletonBlock v-for="n in 4" :key="n" height="3.25rem" />
    </div>
    <form
      v-else
      id="inscribir-afiliado"
      ref="form"
      class="enroll"
      novalidate
      @submit.prevent="submit"
    >
      <AppAlert v-if="failure" tone="error">{{ failure }}</AppAlert>
      <div class="enroll__grid">
        <FormField
          v-slot="{ id, describedBy, invalid }"
          class="span-2"
          label="Nombre completo"
          required
          :error="shown(errors.name)"
        >
          <input
            :id="id"
            v-model="draft.name"
            class="input"
            maxlength="120"
            :aria-describedby="describedBy"
            :aria-invalid="invalid"
          />
        </FormField>
        <FormField
          v-slot="{ id, describedBy, invalid }"
          label="Carnet"
          required
          hint="Solo números. El complemento va después de un guion."
          :error="
            errors.ci === DUPLICATE_CI_MESSAGE ? errors.ci : shown(errors.ci)
          "
        >
          <input
            :id="id"
            v-model="draft.ci"
            class="input"
            inputmode="numeric"
            maxlength="16"
            :aria-describedby="describedBy"
            :aria-invalid="invalid"
          />
        </FormField>
        <FormField
          v-slot="{ id, describedBy, invalid }"
          label="Fecha de nacimiento"
          :error="shown(errors.birthDate)"
        >
          <input
            :id="id"
            v-model="draft.birthDate"
            class="input"
            type="date"
            :max="todayIso()"
            :aria-describedby="describedBy"
            :aria-invalid="invalid"
          />
        </FormField>
        <FormField
          v-slot="{ id, describedBy, invalid }"
          label="Teléfono"
          required
          :error="shown(errors.phone)"
        >
          <input
            :id="id"
            v-model="draft.phone"
            class="input"
            inputmode="tel"
            maxlength="16"
            :aria-describedby="describedBy"
            :aria-invalid="invalid"
          />
        </FormField>
        <FormField v-slot="{ id }" label="Zona">
          <input :id="id" v-model="draft.zone" class="input" maxlength="80" />
        </FormField>
        <FormField v-slot="{ id }" class="span-all" label="Dirección">
          <input
            :id="id"
            v-model="draft.address"
            class="input"
            maxlength="200"
          />
        </FormField>
      </div>

      <fieldset class="enroll__contact">
        <legend>Familiar o persona cuidadora</legend>
        <p v-if="!needsContact" class="enroll__note">
          {{ draftContacts[0]!.name }} ({{ draftContacts[0]!.relation }}) ·
          {{ draftContacts[0]!.phone }}. Escribió la solicitud y queda como
          contacto principal.
        </p>
        <ContactFields
          v-else
          v-model="contact"
          id-prefix="inscribir-contacto"
          :errors="submitted ? errors.contact : {}"
        />
      </fieldset>
    </form>

    <template #actions>
      <AppButton
        variant="secondary"
        :disabled="saving"
        @click="emit('update:open', false)"
      >
        Cancelar
      </AppButton>
      <AppButton
        type="submit"
        form="inscribir-afiliado"
        :loading="saving"
        :disabled="loading"
        loading-label="Abriendo la ficha…"
      >
        Abrir la ficha
      </AppButton>
    </template>
  </AppModal>
</template>

<style scoped>
.enroll {
  display: grid;
  gap: var(--space-5);
}

.enroll__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-4) var(--space-5);
}

.span-2 {
  grid-column: span 2;
}

.span-all {
  grid-column: 1 / -1;
}

.enroll__contact {
  margin: 0;
  padding: 0;
  border: 0;
}

.enroll__contact legend {
  margin-bottom: var(--space-3);
  font-weight: 700;
  color: var(--color-heading);
}

.enroll__note {
  margin: 0;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  color: var(--color-text-muted);
}

@media (max-width: 640px) {
  .enroll__grid {
    grid-template-columns: 1fr;
  }

  .span-2,
  .span-all {
    grid-column: auto;
  }
}
</style>
