<script setup lang="ts">
/**
 * «+ Registrar afiliado»: datos de la persona, consentimiento y al menos un familiar o
 * persona cuidadora. La historia clínica se completa después, en la ficha.
 */
import { computed, nextTick, reactive, ref, watch } from 'vue'

import { isApiError } from '../../api/errors'
import type { PatientIn, PatientOut } from '../../api/types'
import { useApi } from '../../composables/useApi'
import { todayIso } from '../../utils/format'
import {
  DUPLICATE_CI_MESSAGE,
  MAX_CONTACTS,
  ciError,
  cleanCi,
  cleanPhone,
  pastDateError,
  personNameError,
  phoneError,
} from '../../utils/patients'
import AppAlert from '../ui/AppAlert.vue'
import AppButton from '../ui/AppButton.vue'
import AppModal from '../ui/AppModal.vue'
import FormField from '../ui/FormField.vue'
import ContactFields, {
  type ContactDraft,
  type ContactErrors,
} from './ContactFields.vue'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  created: [patient: PatientOut]
  /** La persona pidió buscar en el listado el carnet repetido. */
  search: [ci: string]
}>()

const { api } = useApi()

interface Draft {
  name: string
  ci: string
  birthDate: string
  phone: string
  zone: string
  address: string
  consent: boolean
  consentDate: string
  imageConsent: boolean
  contacts: (ContactDraft & { key: number })[]
}

let nextKey = 1
const emptyContact = () => ({
  key: nextKey++,
  name: '',
  relation: '',
  phone: '',
})

function emptyDraft(): Draft {
  return {
    name: '',
    ci: '',
    birthDate: '',
    phone: '',
    zone: '',
    address: '',
    consent: false,
    consentDate: todayIso(),
    imageConsent: false,
    contacts: [emptyContact()],
  }
}

const draft = reactive<Draft>(emptyDraft())
const submitted = ref(false)
const saving = ref(false)
const formError = ref<string | null>(null)
const duplicateCi = ref<string | null>(null)
const form = ref<HTMLFormElement | null>(null)
const today = computed(() => todayIso())

const errors = computed(() => ({
  name: personNameError(draft.name),
  ci:
    duplicateCi.value && cleanCi(draft.ci) === duplicateCi.value
      ? DUPLICATE_CI_MESSAGE
      : ciError(draft.ci),
  birthDate: pastDateError(draft.birthDate, today.value),
  phone: phoneError(draft.phone),
  consentDate: draft.consent
    ? draft.consentDate
      ? pastDateError(draft.consentDate, today.value)
      : 'Indica la fecha en que se firmó.'
    : null,
  contacts: draft.contacts.map((contact): ContactErrors => ({
    name: personNameError(contact.name),
    relation: contact.relation ? null : 'Elige la relación con la persona.',
    phone: phoneError(contact.phone),
  })),
}))

const valid = computed(() => {
  const { contacts, ...fields } = errors.value
  return (
    Object.values(fields).every((error) => !error) &&
    contacts.every((contact) => Object.values(contact).every((e) => !e))
  )
})

/** Los errores se muestran recién al intentar guardar (y luego en vivo). */
function shown<T>(error: T): T | null {
  return submitted.value ? error : null
}

watch(
  () => props.open,
  (open) => {
    if (!open) return
    Object.assign(draft, emptyDraft())
    submitted.value = false
    formError.value = null
    duplicateCi.value = null
  },
)

function addContact() {
  if (draft.contacts.length < MAX_CONTACTS) draft.contacts.push(emptyContact())
}

function removeContact(index: number) {
  if (draft.contacts.length > 1) draft.contacts.splice(index, 1)
}

function payload(): PatientIn {
  return {
    name: draft.name.trim(),
    ci: cleanCi(draft.ci),
    birthDate: draft.birthDate || null,
    phone: cleanPhone(draft.phone),
    zone: draft.zone.trim(),
    address: draft.address.trim(),
    consent: draft.consent,
    consentDate: draft.consent ? draft.consentDate : null,
    imageConsent: draft.consent && draft.imageConsent,
    // Sin consentimiento firmado nadie ve la historia clínica (RNF-06)
    accessStatus: draft.consent ? 'Activo' : 'Pendiente',
    contacts: draft.contacts.map((contact, index) => ({
      name: contact.name.trim(),
      relation: contact.relation,
      phone: cleanPhone(contact.phone),
      isPrimary: index === 0,
    })),
  }
}

async function focusFirstError() {
  await nextTick()
  form.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
}

async function submit() {
  submitted.value = true
  formError.value = null
  if (!valid.value) return focusFirstError()

  saving.value = true
  try {
    const patient = await api.patients.create(payload())
    emit('created', patient)
    emit('update:open', false)
  } catch (error) {
    if (isApiError(error) && error.status === 409) {
      duplicateCi.value = cleanCi(draft.ci)
      await focusFirstError()
    } else {
      formError.value = isApiError(error)
        ? error.message
        : 'No pudimos registrar la ficha. Intenta de nuevo.'
    }
  } finally {
    saving.value = false
  }
}

function searchDuplicate() {
  emit('search', cleanCi(draft.ci))
  emit('update:open', false)
}
</script>

<template>
  <AppModal
    :open="open"
    size="lg"
    title="Registrar afiliado"
    description="Una persona, una ficha. Los campos con * son obligatorios."
    :dismissible="!saving"
    @update:open="emit('update:open', $event)"
  >
    <form
      id="registrar-afiliado"
      ref="form"
      class="register"
      novalidate
      @submit.prevent="submit"
    >
      <AppAlert v-if="formError" tone="error">{{ formError }}</AppAlert>

      <fieldset class="register__group">
        <legend>Datos de la persona</legend>
        <div class="register__grid">
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
              autocomplete="off"
              maxlength="120"
              autofocus
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
              autocomplete="off"
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
              :max="today"
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
              type="tel"
              inputmode="tel"
              autocomplete="off"
              maxlength="16"
              :aria-describedby="describedBy"
              :aria-invalid="invalid"
            />
          </FormField>
          <FormField v-slot="{ id }" label="Zona">
            <input
              :id="id"
              v-model="draft.zone"
              class="input"
              autocomplete="off"
              maxlength="80"
            />
          </FormField>
          <FormField v-slot="{ id }" class="span-2" label="Dirección">
            <input
              :id="id"
              v-model="draft.address"
              class="input"
              autocomplete="off"
              maxlength="200"
            />
          </FormField>
        </div>
        <div v-if="duplicateCi" class="register__duplicate">
          <AppButton variant="link" size="sm" @click="searchDuplicate">
            Buscar el carnet {{ duplicateCi }} en el listado
          </AppButton>
        </div>
      </fieldset>

      <fieldset class="register__group">
        <legend>Consentimiento informado</legend>
        <label class="checkbox">
          <input v-model="draft.consent" type="checkbox" />
          <span>
            La persona y su familia firmaron el consentimiento informado.
          </span>
        </label>
        <div v-if="draft.consent" class="register__grid register__consent">
          <FormField
            v-slot="{ id, describedBy, invalid }"
            label="Fecha de la firma"
            required
            :error="shown(errors.consentDate)"
          >
            <input
              :id="id"
              v-model="draft.consentDate"
              class="input"
              type="date"
              :max="today"
              :aria-describedby="describedBy"
              :aria-invalid="invalid"
            />
          </FormField>
          <label class="checkbox register__image">
            <input v-model="draft.imageConsent" type="checkbox" />
            <span>También autorizó el uso de su imagen en fotos y videos.</span>
          </label>
        </div>
        <p v-else class="register__note">
          Puedes registrar la ficha ahora y marcar el consentimiento cuando lo
          firmen. Mientras tanto, nadie ve su historia clínica.
        </p>
      </fieldset>

      <fieldset class="register__group">
        <legend>Familiar o persona cuidadora</legend>
        <div
          v-for="(contact, index) in draft.contacts"
          :key="contact.key"
          class="register__contact"
        >
          <div class="register__contact-head">
            <span>
              {{ index === 0 ? 'Contacto principal' : `Contacto ${index + 1}` }}
            </span>
            <AppButton
              v-if="draft.contacts.length > 1"
              variant="link"
              size="sm"
              @click="removeContact(index)"
            >
              Quitar
            </AppButton>
          </div>
          <ContactFields
            :model-value="contact"
            :id-prefix="`alta-contacto-${contact.key}`"
            :errors="submitted ? errors.contacts[index] : {}"
            @update:model-value="Object.assign(contact, $event)"
          />
        </div>
        <div class="register__contact-foot">
          <p class="register__note">
            Toda ficha necesita al menos un contacto de apoyo.
          </p>
          <AppButton
            v-if="draft.contacts.length < MAX_CONTACTS"
            variant="link"
            size="sm"
            @click="addContact"
          >
            + Añadir otro
          </AppButton>
        </div>
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
        form="registrar-afiliado"
        :loading="saving"
        loading-label="Registrando la ficha…"
      >
        Registrar afiliado
      </AppButton>
    </template>
  </AppModal>
</template>

<style scoped>
.register {
  display: grid;
  gap: var(--space-6);
}

.register__group {
  display: grid;
  gap: var(--space-4);
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.register__group legend {
  margin-bottom: var(--space-3);
  padding: 0;
  color: var(--color-heading);
  font-family: var(--font-serif);
  font-size: var(--text-lg);
  font-weight: 600;
}

.register__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
  align-items: start;
}

.span-2 {
  grid-column: span 2;
}

.register__consent {
  align-items: end;
}

.register__image {
  padding-bottom: var(--space-3);
}

.register__note {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.register__duplicate {
  margin-top: calc(-1 * var(--space-2));
}

.register__contact {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--crema-50);
}

.register__contact-head,
.register__contact-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.register__contact-head span {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  font-weight: 600;
}

@media (max-width: 640px) {
  .register__grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .span-2 {
    grid-column: auto;
  }
}
</style>
