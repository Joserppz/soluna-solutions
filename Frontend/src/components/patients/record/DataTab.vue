<script setup lang="ts">
/**
 * Pestaña Datos: datos personales y consentimiento (se guardan juntos con «Guardar
 * ficha»), familiares o cuidadores (cada cambio se guarda al momento), el resumen de
 * asistencia y la baja lógica.
 */
import { computed, nextTick, reactive, ref, watch } from 'vue'

import { isApiError } from '../../../api/errors'
import type {
  PatientAttendancePage,
  PatientOut,
  PatientUpdate,
} from '../../../api/types'
import { useApi } from '../../../composables/useApi'
import { useToast } from '../../../composables/useToast'
import {
  firstName as firstNameOf,
  todayIso,
  whenLabel,
} from '../../../utils/format'
import {
  DUPLICATE_CI_MESSAGE,
  ciError,
  cleanCi,
  cleanPhone,
  pastDateError,
  personNameError,
  phoneError,
} from '../../../utils/patients'
import AppAlert from '../../ui/AppAlert.vue'
import AppButton from '../../ui/AppButton.vue'
import FormField from '../../ui/FormField.vue'
import ContactsCard from './ContactsCard.vue'

const props = defineProps<{ patient: PatientOut }>()
const emit = defineEmits<{
  updated: [patient: PatientOut]
  dirty: [value: boolean]
  deactivate: []
  showAttendance: []
}>()

const { api, session } = useApi()
const toast = useToast()

const ACCESS_OPTIONS = [
  { value: 'Activo', label: 'Habilitado para el personal clínico' },
  { value: 'Pendiente', label: 'Todavía no habilitado' },
  { value: 'Revocado', label: 'Suspendido a pedido de la familia' },
]

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
  accessStatus: string
}

function fromPatient(patient: PatientOut): Draft {
  return {
    name: patient.name,
    ci: patient.ci,
    birthDate: patient.birthDate ?? '',
    phone: patient.phone,
    zone: patient.zone,
    address: patient.address,
    consent: patient.consent,
    consentDate: patient.consentDate ?? todayIso(),
    imageConsent: patient.imageConsent,
    accessStatus: patient.accessStatus,
  }
}

const draft = reactive<Draft>(fromPatient(props.patient))
const saved = ref<Draft>(fromPatient(props.patient))
const submitted = ref(false)
const saving = ref(false)
const formError = ref<string | null>(null)
const duplicateCi = ref<string | null>(null)
const root = ref<HTMLElement | null>(null)
const attendance = ref<PatientAttendancePage | null>(null)
const today = todayIso()

const canEdit = computed(
  () => session.can('patients:write') && props.patient.active,
)
const canDeactivate = computed(
  () => session.can('patients:deactivate') && props.patient.active,
)
const firstName = computed(() => firstNameOf(props.patient.name))

const dirty = computed(
  () => JSON.stringify(draft) !== JSON.stringify(saved.value),
)
watch(dirty, (value) => emit('dirty', value), { immediate: true })

watch(
  () => draft.consent,
  (consent, before) => {
    // Al marcar la firma, el acceso clínico queda habilitado salvo que se elija otra cosa
    if (consent && !before && draft.accessStatus === 'Pendiente')
      draft.accessStatus = 'Activo'
  },
)

/**
 * Una fecha ya guardada no se vuelve a revisar: si la API la guardó con otro «hoy»
 * (por ejemplo, de noche en Bolivia), no debe impedir guardar otros cambios.
 */
function newDateError(field: 'birthDate' | 'consentDate'): string | null {
  return draft[field] === saved.value[field]
    ? null
    : pastDateError(draft[field], today)
}

const errors = computed(() => ({
  name: personNameError(draft.name),
  ci:
    duplicateCi.value && cleanCi(draft.ci) === duplicateCi.value
      ? DUPLICATE_CI_MESSAGE
      : ciError(draft.ci),
  birthDate: newDateError('birthDate'),
  phone: phoneError(draft.phone),
  consentDate:
    draft.consent && !draft.consentDate
      ? 'Indica la fecha en que se firmó.'
      : draft.consent
        ? newDateError('consentDate')
        : null,
}))

function shown(error: string | null): string | null {
  return submitted.value || error === DUPLICATE_CI_MESSAGE ? error : null
}

function payload(): PatientUpdate {
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
    accessStatus: draft.consent ? draft.accessStatus : 'Pendiente',
  }
}

function reset() {
  Object.assign(draft, saved.value)
  submitted.value = false
  formError.value = null
  duplicateCi.value = null
}

async function save() {
  submitted.value = true
  formError.value = null
  if (Object.values(errors.value).some(Boolean)) {
    await nextTick()
    root.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
    return
  }
  saving.value = true
  try {
    const updated = await api.patients.update(props.patient.id, payload())
    saved.value = fromPatient(updated)
    Object.assign(draft, saved.value)
    submitted.value = false
    emit('updated', updated)
    toast.success('Guardamos los cambios de la ficha.')
  } catch (error) {
    if (isApiError(error) && error.status === 409) {
      duplicateCi.value = cleanCi(draft.ci)
      await nextTick()
      root.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
    } else
      formError.value = isApiError(error)
        ? error.message
        : 'No pudimos guardar la ficha. Intenta de nuevo.'
  } finally {
    saving.value = false
  }
}

// Si la ficha cambia desde afuera (por ejemplo, una reactivación), el formulario se
// actualiza, salvo lo que la persona está escribiendo
watch(
  () => props.patient,
  (patient) => {
    const fresh = fromPatient(patient)
    if (!dirty.value) Object.assign(draft, fresh)
    saved.value = fresh
  },
)

async function loadAttendance() {
  try {
    attendance.value = await api.patients.attendance(props.patient.id, {
      limit: 1,
    })
  } catch {
    // El resumen es una ayuda; la pestaña Asistencia muestra el detalle o el error
  }
}

void loadAttendance()
</script>

<template>
  <div ref="root" class="data">
    <div class="data__main">
      <form
        id="ficha-datos"
        class="data__form"
        novalidate
        @submit.prevent="save"
      >
        <AppAlert v-if="formError" tone="error">{{ formError }}</AppAlert>

        <section class="card surface-card" aria-labelledby="datos-personales">
          <h2 id="datos-personales">Datos personales</h2>
          <fieldset :disabled="!canEdit" class="card__grid">
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
                autocomplete="off"
                :aria-describedby="describedBy"
                :aria-invalid="invalid"
              />
            </FormField>
            <FormField
              v-slot="{ id, describedBy, invalid }"
              label="Carnet"
              required
              :error="shown(errors.ci)"
            >
              <input
                :id="id"
                v-model="draft.ci"
                class="input"
                inputmode="numeric"
                maxlength="16"
                autocomplete="off"
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
                maxlength="16"
                autocomplete="off"
                :aria-describedby="describedBy"
                :aria-invalid="invalid"
              />
            </FormField>
            <FormField v-slot="{ id }" label="Zona">
              <input
                :id="id"
                v-model="draft.zone"
                class="input"
                maxlength="80"
                autocomplete="off"
              />
            </FormField>
            <FormField v-slot="{ id }" class="span-2" label="Dirección">
              <input
                :id="id"
                v-model="draft.address"
                class="input"
                maxlength="200"
                autocomplete="off"
              />
            </FormField>
          </fieldset>
        </section>
      </form>

      <ContactsCard
        :patient="patient"
        :can-edit="canEdit"
        @updated="emit('updated', $event)"
      />
    </div>

    <aside class="data__side">
      <section
        class="card card--consent"
        :class="{ 'card--pending': !draft.consent }"
        aria-labelledby="consentimiento"
      >
        <h2 id="consentimiento">Consentimiento informado</h2>
        <fieldset :disabled="!canEdit" class="consent">
          <label class="checkbox">
            <input v-model="draft.consent" form="ficha-datos" type="checkbox" />
            <span>
              Se explicó a {{ firstName }} y a su familia cómo cuidamos sus
              datos, y lo firmaron.
            </span>
          </label>
          <template v-if="draft.consent">
            <FormField
              v-slot="{ id, describedBy, invalid }"
              label="Fecha de la firma"
              required
              :error="shown(errors.consentDate)"
            >
              <input
                :id="id"
                v-model="draft.consentDate"
                form="ficha-datos"
                class="input"
                type="date"
                :max="today"
                :aria-describedby="describedBy"
                :aria-invalid="invalid"
              />
            </FormField>
            <label class="checkbox">
              <input
                v-model="draft.imageConsent"
                form="ficha-datos"
                type="checkbox"
              />
              <span>Autoriza el uso de su imagen en fotos y videos.</span>
            </label>
            <FormField v-slot="{ id }" label="Historia clínica">
              <select
                :id="id"
                v-model="draft.accessStatus"
                form="ficha-datos"
                class="select"
              >
                <option
                  v-for="option in ACCESS_OPTIONS"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </FormField>
          </template>
          <p v-else class="card__note">
            Sin la firma nadie ve su historia clínica, sus evaluaciones ni sus
            documentos.
          </p>
        </fieldset>
      </section>

      <section class="card surface-card" aria-labelledby="asistencia-resumen">
        <h2 id="asistencia-resumen">Asistencia</h2>
        <!-- Mientras llega el dato ocupa el mismo alto: la página no salta -->
        <p v-if="attendance" class="attendance">
          <strong>{{ attendance.saturdaysAttended }}</strong>
          de {{ attendance.saturdaysHeld }}
          {{ attendance.saturdaysHeld === 1 ? 'sábado' : 'sábados' }} este
          trimestre
        </p>
        <p v-else class="attendance" aria-busy="true">
          <strong aria-hidden="true">–</strong>
          Calculando los sábados del trimestre…
        </p>
        <AppButton variant="link" size="sm" @click="emit('showAttendance')">
          Ver el historial
        </AppButton>
      </section>

      <section
        v-if="canDeactivate"
        class="card card--quiet"
        aria-label="Marcar como inactiva"
      >
        <p>
          Si {{ firstName }} deja de venir, marca la ficha como inactiva e
          indica el motivo. Nada se borra.
        </p>
        <AppButton variant="link" size="sm" @click="emit('deactivate')">
          Marcar como inactiva…
        </AppButton>
      </section>
    </aside>

    <div v-if="canEdit" class="savebar surface-card">
      <p class="savebar__status" aria-live="polite">
        <template v-if="dirty">Hay cambios sin guardar.</template>
        <template v-else>
          Último cambio: {{ whenLabel(patient.updatedAt) }}
        </template>
      </p>
      <div class="savebar__actions">
        <AppButton
          variant="secondary"
          :disabled="!dirty || saving"
          @click="reset"
        >
          Cancelar
        </AppButton>
        <AppButton
          type="submit"
          form="ficha-datos"
          :disabled="!dirty"
          :loading="saving"
          loading-label="Guardando la ficha…"
        >
          Guardar ficha
        </AppButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.data {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(17rem, 22rem);
  gap: var(--space-5);
  align-items: start;
}

.data__main,
.data__form,
.data__side {
  display: grid;
  gap: var(--space-5);
  min-width: 0;
}

.card {
  display: grid;
  gap: var(--space-4);
  padding: var(--space-5) var(--space-6);
}

.card h2 {
  font-family: var(--font-sans);
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--color-text);
}

.card__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.span-2 {
  grid-column: span 2;
}

.card__note {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.card--consent {
  border: 1px solid rgb(27 92 79 / 0.18);
  border-radius: var(--radius-lg);
  background: var(--verde-50);
}

.card--pending {
  border-color: rgb(132 86 14 / 0.22);
  background: #fdf6e8;
}

.card--quiet {
  border-radius: var(--radius-lg);
  background: var(--color-surface-sunken);
  color: var(--color-text-muted);
}

.card--quiet,
.card--consent {
  justify-items: start;
}

.consent {
  display: grid;
  gap: var(--space-4);
  width: 100%;
  margin: 0;
  padding: 0;
  border: 0;
}

.attendance {
  color: var(--color-text-muted);
  font-size: var(--text-lg);
}

.attendance strong {
  margin-right: var(--space-1);
  color: var(--aspar-verde);
  font-family: var(--font-serif);
  font-size: var(--text-3xl);
  font-weight: 500;
}

.savebar {
  position: sticky;
  bottom: var(--space-4);
  z-index: var(--z-sticky);
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3) var(--space-6);
  padding: var(--space-3) var(--space-5);
  box-shadow: var(--shadow-md);
}

.savebar__status {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.savebar__actions {
  display: flex;
  gap: var(--space-3);
}

@media (max-width: 1100px) {
  .data {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 640px) {
  .card {
    padding: var(--space-4);
  }

  .card__grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .span-2 {
    grid-column: auto;
  }
}
</style>
