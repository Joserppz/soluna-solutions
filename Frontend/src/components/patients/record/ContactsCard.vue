<script setup lang="ts">
/**
 * Familiares o personas cuidadoras de la ficha: de uno a cinco, uno es el principal.
 * Cada cambio se guarda al momento; quitar uno es una baja lógica en la API.
 */
import { computed, nextTick, ref } from 'vue'

import { isApiError } from '../../../api/errors'
import type { ContactOut, PatientOut } from '../../../api/types'
import { useApi } from '../../../composables/useApi'
import { useToast } from '../../../composables/useToast'
import {
  MAX_CONTACTS,
  cleanPhone,
  personNameError,
  phoneError,
} from '../../../utils/patients'
import AppAlert from '../../ui/AppAlert.vue'
import AppButton from '../../ui/AppButton.vue'
import AppModal from '../../ui/AppModal.vue'
import StatusBadge from '../../ui/StatusBadge.vue'
import ContactFields, {
  type ContactDraft,
  type ContactErrors,
} from '../ContactFields.vue'

const props = defineProps<{ patient: PatientOut; canEdit: boolean }>()
const emit = defineEmits<{ updated: [patient: PatientOut] }>()

const { api } = useApi()
const toast = useToast()

/** id del contacto que se edita, «nuevo» para agregar uno, o null. */
const editing = ref<string | null>(null)
const draft = ref<ContactDraft>({ name: '', relation: '', phone: '' })
const submitted = ref(false)
const busy = ref(false)
const error = ref<string | null>(null)
const removing = ref<ContactOut | null>(null)
const card = ref<HTMLElement | null>(null)

const contacts = computed(() => props.patient.contacts)

const errors = computed<ContactErrors>(() =>
  submitted.value
    ? {
        name: personNameError(draft.value.name),
        relation: draft.value.relation
          ? null
          : 'Elige la relación con la persona.',
        phone: phoneError(draft.value.phone),
      }
    : {},
)

async function focusFirstField() {
  await nextTick()
  card.value?.querySelector<HTMLElement>('.contact-edit input')?.focus()
}

function startEdit(contact: ContactOut) {
  editing.value = contact.id
  draft.value = {
    name: contact.name,
    relation: contact.relation,
    phone: contact.phone,
  }
  submitted.value = false
  error.value = null
  void focusFirstField()
}

function startNew() {
  editing.value = 'nuevo'
  draft.value = { name: '', relation: '', phone: '' }
  submitted.value = false
  error.value = null
  void focusFirstField()
}

function cancel() {
  editing.value = null
  error.value = null
}

async function refresh(message: string) {
  const fresh = await api.contacts.list(props.patient.id)
  emit('updated', { ...props.patient, contacts: fresh })
  toast.success(message)
}

async function run(action: () => Promise<unknown>, message: string) {
  busy.value = true
  error.value = null
  try {
    await action()
    editing.value = null
    removing.value = null
    await refresh(message)
  } catch (failure) {
    error.value = isApiError(failure)
      ? failure.message
      : 'No pudimos guardar el contacto. Intenta de nuevo.'
    removing.value = null
  } finally {
    busy.value = false
  }
}

async function save() {
  submitted.value = true
  if (Object.values(errors.value).some(Boolean)) return focusInvalid()
  const body = {
    name: draft.value.name.trim(),
    relation: draft.value.relation,
    phone: cleanPhone(draft.value.phone),
  }
  const id = editing.value
  if (id === 'nuevo')
    await run(
      () => api.contacts.add(props.patient.id, body),
      `Agregamos a ${body.name} como contacto.`,
    )
  else if (id)
    await run(
      () => api.contacts.update(props.patient.id, id, body),
      'Guardamos los datos del contacto.',
    )
}

async function focusInvalid() {
  await nextTick()
  card.value
    ?.querySelector<HTMLElement>('.contact-edit [aria-invalid="true"]')
    ?.focus()
}

function makePrimary(contact: ContactOut) {
  void run(
    () =>
      api.contacts.update(props.patient.id, contact.id, { isPrimary: true }),
    `${contact.name} es ahora el contacto principal.`,
  )
}

function confirmRemove() {
  const contact = removing.value
  if (!contact) return
  void run(
    () => api.contacts.remove(props.patient.id, contact.id),
    `Quitamos a ${contact.name} de los contactos.`,
  )
}
</script>

<template>
  <section
    ref="card"
    class="contacts surface-card"
    aria-labelledby="familiares"
  >
    <div class="contacts__head">
      <h2 id="familiares">Familiar o persona cuidadora</h2>
      <AppButton
        v-if="canEdit && !editing && contacts.length < MAX_CONTACTS"
        variant="link"
        size="sm"
        @click="startNew"
      >
        + Añadir otro
      </AppButton>
    </div>

    <AppAlert v-if="error" tone="error">{{ error }}</AppAlert>

    <ul class="contacts__list">
      <li v-for="contact in contacts" :key="contact.id" class="contact">
        <div
          v-if="editing === contact.id"
          class="contact-edit"
          @keydown.enter.prevent="save"
        >
          <ContactFields
            v-model="draft"
            :id-prefix="`contacto-${contact.id}`"
            :errors="errors"
            :disabled="busy"
          />
          <div class="contact-edit__actions">
            <AppButton variant="secondary" size="sm" @click="cancel">
              Cancelar
            </AppButton>
            <AppButton size="sm" :loading="busy" @click="save">
              Guardar contacto
            </AppButton>
          </div>
        </div>
        <template v-else>
          <div class="contact__text">
            <strong>{{ contact.name }}</strong>
            <span>
              {{ contact.relation }} · {{ contact.phone }}
              <template v-if="contact.altPhone">
                · {{ contact.altPhone }}
              </template>
            </span>
          </div>
          <StatusBadge v-if="contact.isPrimary" tone="info" :dot="false">
            Principal
          </StatusBadge>
          <div v-if="canEdit && !editing" class="contact__actions">
            <AppButton
              v-if="!contact.isPrimary"
              variant="link"
              size="sm"
              :disabled="busy"
              @click="makePrimary(contact)"
            >
              Hacer principal
            </AppButton>
            <AppButton
              variant="link"
              size="sm"
              :aria-label="`Editar a ${contact.name}`"
              @click="startEdit(contact)"
            >
              Editar
            </AppButton>
            <AppButton
              v-if="contacts.length > 1"
              variant="link"
              size="sm"
              :aria-label="`Quitar a ${contact.name}`"
              @click="removing = contact"
            >
              Quitar
            </AppButton>
          </div>
        </template>
      </li>
      <li v-if="editing === 'nuevo'" class="contact">
        <div class="contact-edit" @keydown.enter.prevent="save">
          <ContactFields
            v-model="draft"
            id-prefix="contacto-nuevo"
            :errors="errors"
            :disabled="busy"
          />
          <div class="contact-edit__actions">
            <AppButton variant="secondary" size="sm" @click="cancel">
              Cancelar
            </AppButton>
            <AppButton size="sm" :loading="busy" @click="save">
              Agregar contacto
            </AppButton>
          </div>
        </div>
      </li>
    </ul>

    <p class="contacts__note">
      Toda ficha necesita al menos un contacto de apoyo<template
        v-if="contacts.length >= MAX_CONTACTS"
        >; admite hasta {{ MAX_CONTACTS }}</template
      >.
    </p>

    <AppModal
      :open="removing !== null"
      size="sm"
      title="¿Quitar este contacto?"
      :description="
        removing
          ? `${removing.name} deja de aparecer en la ficha. El registro se conserva.`
          : undefined
      "
      @update:open="removing = null"
    >
      <template #actions>
        <AppButton variant="secondary" @click="removing = null">
          Cancelar
        </AppButton>
        <AppButton variant="danger" :loading="busy" @click="confirmRemove">
          Quitar contacto
        </AppButton>
      </template>
    </AppModal>
  </section>
</template>

<style scoped>
.contacts {
  display: grid;
  gap: var(--space-4);
  padding: var(--space-5) var(--space-6);
}

.contacts__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.contacts h2 {
  font-family: var(--font-sans);
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--color-text);
}

.contacts__list {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.contact {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2) var(--space-4);
  padding: var(--space-3) 0;
  border-top: 1px solid var(--color-border);
}

.contact:first-child {
  border-top: 0;
}

.contact__text {
  flex: 1 1 14rem;
  display: grid;
  gap: 0.1rem;
}

.contact__text span {
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.contact__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.contact-edit {
  display: grid;
  flex: 1 1 100%;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--crema-50);
}

.contact-edit__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
}

.contacts__note {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

@media (max-width: 640px) {
  .contacts {
    padding: var(--space-4);
  }
}
</style>
