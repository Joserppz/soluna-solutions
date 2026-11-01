<script setup lang="ts">
/** Ver, registrar o corregir una evaluación de seguimiento. */
import { computed, reactive, ref, watch } from 'vue'

import { isApiError } from '../../../api/errors'
import type {
  EvaluationArea,
  EvaluationOut,
  EvaluationUpdate,
} from '../../../api/types'
import { useApi } from '../../../composables/useApi'
import { longDay, todayIso } from '../../../utils/format'
import { EVALUATION_AREAS, pastDateError } from '../../../utils/patients'
import AppAlert from '../../ui/AppAlert.vue'
import AppButton from '../../ui/AppButton.vue'
import AppModal from '../../ui/AppModal.vue'
import FormField from '../../ui/FormField.vue'

const props = defineProps<{
  patientId: string
  /** null: cerrado · «nueva»: registrar · una evaluación: verla (y corregirla) */
  evaluation: EvaluationOut | 'nueva' | null
  canWrite: boolean
}>()
const emit = defineEmits<{
  close: []
  saved: [evaluation: EvaluationOut]
}>()

const { api, session } = useApi()

const editing = ref(false)
const submitted = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)
const draft = reactive({
  area: 'fisica' as EvaluationArea,
  evaluatedOn: todayIso(),
  professionalName: '',
  notes: '',
})

const current = computed(() =>
  props.evaluation && props.evaluation !== 'nueva' ? props.evaluation : null,
)
const isNew = computed(() => props.evaluation === 'nueva')
const showForm = computed(() => isNew.value || editing.value)
const title = computed(() => {
  if (isNew.value) return 'Nueva evaluación'
  if (!current.value) return ''
  return `Evaluación ${current.value.areaLabel.toLocaleLowerCase('es')}`
})

watch(
  () => props.evaluation,
  (evaluation) => {
    editing.value = false
    submitted.value = false
    error.value = null
    if (evaluation === 'nueva')
      Object.assign(draft, {
        area: 'fisica',
        evaluatedOn: todayIso(),
        professionalName: '',
        notes: '',
      })
  },
)

const errors = computed(() => ({
  evaluatedOn: draft.evaluatedOn
    ? pastDateError(draft.evaluatedOn, todayIso())
    : 'Indica la fecha de la evaluación.',
  professionalName:
    draft.professionalName.trim() && draft.professionalName.trim().length < 3
      ? 'Escribe el nombre completo del profesional.'
      : null,
  notes: draft.notes.trim() ? null : 'Escribe las observaciones.',
}))

function startEdit() {
  const evaluation = current.value!
  Object.assign(draft, {
    area: evaluation.area,
    evaluatedOn: evaluation.evaluatedOn,
    professionalName: evaluation.professionalName,
    notes: evaluation.notes,
  })
  submitted.value = false
  editing.value = true
}

function changes(evaluation: EvaluationOut): EvaluationUpdate {
  const body: EvaluationUpdate = {}
  if (draft.area !== evaluation.area) body.area = draft.area
  if (draft.evaluatedOn !== evaluation.evaluatedOn)
    body.evaluatedOn = draft.evaluatedOn
  if (draft.notes.trim() !== evaluation.notes) body.notes = draft.notes.trim()
  if (draft.professionalName.trim() !== evaluation.professionalName)
    body.professionalName = draft.professionalName.trim()
  return body
}

async function save() {
  submitted.value = true
  error.value = null
  if (Object.values(errors.value).some(Boolean)) return
  saving.value = true
  try {
    const professionalName = draft.professionalName.trim() || null
    const saved = current.value
      ? await api.evaluations.update(
          props.patientId,
          current.value.id,
          changes(current.value),
        )
      : await api.evaluations.create(props.patientId, {
          area: draft.area,
          evaluatedOn: draft.evaluatedOn,
          notes: draft.notes.trim(),
          professionalName,
        })
    emit('saved', saved)
  } catch (failure) {
    error.value = isApiError(failure)
      ? failure.message
      : 'No pudimos guardar la evaluación. Intenta de nuevo.'
  } finally {
    saving.value = false
  }
}

function shown(message: string | null) {
  return submitted.value ? message : null
}
</script>

<template>
  <AppModal
    :open="evaluation !== null"
    :title="title"
    size="md"
    :dismissible="!saving"
    @update:open="emit('close')"
  >
    <dl v-if="current && !showForm" class="details">
      <div>
        <dt>Fecha</dt>
        <dd>{{ longDay(current.evaluatedOn) }}</dd>
      </div>
      <div>
        <dt>Profesional</dt>
        <dd>{{ current.professionalName }}</dd>
      </div>
      <div class="details__notes">
        <dt>Observaciones</dt>
        <dd>{{ current.notes }}</dd>
      </div>
    </dl>

    <form
      v-else
      id="evaluacion"
      class="evaluation-form"
      novalidate
      @submit.prevent="save"
    >
      <AppAlert v-if="error" tone="error">{{ error }}</AppAlert>
      <div class="evaluation-form__grid">
        <FormField v-slot="{ id }" label="Área" required>
          <select :id="id" v-model="draft.area" class="select">
            <option
              v-for="(label, area) in EVALUATION_AREAS"
              :key="area"
              :value="area"
            >
              {{ label }}
            </option>
          </select>
        </FormField>
        <FormField
          v-slot="{ id, describedBy, invalid }"
          label="Fecha"
          required
          :error="shown(errors.evaluatedOn)"
        >
          <input
            :id="id"
            v-model="draft.evaluatedOn"
            class="input"
            type="date"
            :max="todayIso()"
            :aria-describedby="describedBy"
            :aria-invalid="invalid"
          />
        </FormField>
      </div>
      <FormField
        v-slot="{ id, describedBy, invalid }"
        label="Profesional que evaluó"
        :hint="
          isNew
            ? `Si lo dejas vacío, queda a tu nombre (${session.state.user?.name ?? ''}).`
            : undefined
        "
        :error="shown(errors.professionalName)"
      >
        <input
          :id="id"
          v-model="draft.professionalName"
          class="input"
          maxlength="120"
          :aria-describedby="describedBy"
          :aria-invalid="invalid"
        />
      </FormField>
      <FormField
        v-slot="{ id, describedBy, invalid }"
        label="Observaciones"
        required
        :error="shown(errors.notes)"
      >
        <textarea
          :id="id"
          v-model="draft.notes"
          class="textarea"
          rows="5"
          maxlength="4000"
          :aria-describedby="describedBy"
          :aria-invalid="invalid"
        />
      </FormField>
    </form>

    <template #actions>
      <template v-if="showForm">
        <AppButton
          variant="secondary"
          :disabled="saving"
          @click="isNew ? emit('close') : (editing = false)"
        >
          Cancelar
        </AppButton>
        <AppButton
          type="submit"
          form="evaluacion"
          :loading="saving"
          loading-label="Guardando la evaluación…"
        >
          {{ isNew ? 'Registrar evaluación' : 'Guardar cambios' }}
        </AppButton>
      </template>
      <template v-else>
        <AppButton v-if="canWrite" variant="secondary" @click="startEdit">
          Corregir
        </AppButton>
        <AppButton @click="emit('close')">Cerrar</AppButton>
      </template>
    </template>
  </AppModal>
</template>

<style scoped>
.details {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
  margin: 0;
}

.details dt {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  font-weight: 600;
}

.details dd {
  margin: var(--space-1) 0 0;
}

.details__notes {
  grid-column: 1 / -1;
}

.details__notes dd {
  white-space: pre-line;
}

.evaluation-form {
  display: grid;
  gap: var(--space-4);
}

.evaluation-form__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}

@media (max-width: 480px) {
  .details,
  .evaluation-form__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
