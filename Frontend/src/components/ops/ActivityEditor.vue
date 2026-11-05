<script setup lang="ts">
/**
 * Editor de una actividad (diseño pág. 3): datos, publicación y una vista previa de
 * cómo se verá en el sitio. Una actividad cancelada no se edita: se muestra con su
 * aviso. Cancelar pide un aviso para las familias, por ejemplo «Se reprogramará».
 */
import { computed, reactive, ref, watch } from 'vue'

import { isApiError } from '../../api/errors'
import type { ScheduleIn, ScheduleOut } from '../../api/types'
import { useApi } from '../../composables/useApi'
import { useToast } from '../../composables/useToast'
import { clock, dayLabel, timeRange } from '../../utils/ops'
import AppAlert from '../ui/AppAlert.vue'
import AppButton from '../ui/AppButton.vue'
import AppModal from '../ui/AppModal.vue'
import FormField from '../ui/FormField.vue'
import StatusBadge from '../ui/StatusBadge.vue'
import { SCHEDULE_STATUS_LABELS, SCHEDULE_STATUS_TONES } from '../../utils/ops'

/** Categorías de la API (las mismas que la agenda pública). */
const CATEGORIES: { value: ScheduleIn['category']; label: string }[] = [
  { value: 'fisioterapia', label: 'Fisioterapia' },
  { value: 'arteterapia', label: 'Arteterapia' },
  { value: 'fonoaudiologia', label: 'Fonoaudiología' },
  { value: 'psicologia', label: 'Psicología' },
  { value: 'teatro', label: 'Teatro' },
  { value: 'familias', label: 'Familias' },
  { value: 'comunitario', label: 'Encuentro comunitario' },
]

const props = defineProps<{
  /** null: una actividad nueva. */
  schedule: ScheduleOut | null
  /** Día sugerido para una actividad nueva. */
  defaultDate: string
}>()
const emit = defineEmits<{
  saved: [schedule: ScheduleOut]
  cancelled: [schedule: ScheduleOut]
}>()

const { api, session } = useApi()
const toast = useToast()

const canEdit = computed(() => session.can('schedules:manage'))

type Draft = {
  title: string
  category: ScheduleIn['category']
  date: string
  startTime: string
  endTime: string
  professionalName: string
  location: string
  spots: string
  description: string
  publish: boolean
}

function draftFrom(schedule: ScheduleOut | null, date: string): Draft {
  if (!schedule)
    return {
      title: '',
      category: 'fisioterapia',
      date,
      startTime: '10:00',
      endTime: '11:30',
      professionalName: '',
      location: 'Sede ASPAR',
      spots: '',
      description: '',
      publish: false,
    }
  return {
    title: schedule.title,
    category: schedule.category,
    date: schedule.date,
    startTime: clock(schedule.startTime),
    endTime: clock(schedule.endTime),
    professionalName: schedule.professionalName,
    location: schedule.location,
    spots: schedule.spots === null ? '' : String(schedule.spots),
    description: schedule.description,
    publish: schedule.status === 'publicada',
  }
}

const draft = reactive<Draft>(draftFrom(props.schedule, props.defaultDate))
const submitted = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)
const cancelOpen = ref(false)
const cancelNote = ref('')
const cancelling = ref(false)
const cancelError = ref<string | null>(null)

watch(
  () => [props.schedule?.id, props.defaultDate],
  () => {
    Object.assign(draft, draftFrom(props.schedule, props.defaultDate))
    submitted.value = false
    error.value = null
  },
)

const isNew = computed(() => props.schedule === null)
const locked = computed(
  () => !canEdit.value || props.schedule?.status === 'cancelada',
)

const errors = computed(() => {
  const list: Partial<Record<keyof Draft, string>> = {}
  if (draft.title.trim().length < 3)
    list.title = 'Escribe un título de al menos 3 letras.'
  if (!draft.date) list.date = 'Elige el día.'
  if (!draft.startTime) list.startTime = 'Elige la hora de inicio.'
  if (!draft.endTime) list.endTime = 'Elige la hora de fin.'
  if (draft.startTime && draft.endTime && draft.endTime <= draft.startTime)
    list.endTime = 'La hora de fin debe ser después de la de inicio.'
  if (!draft.location.trim()) list.location = 'Escribe el lugar.'
  if (draft.description.trim().length < 10)
    list.description =
      'Describe la actividad en al menos 10 letras: es lo que ve la familia.'
  if (
    draft.spots !== '' &&
    (!/^\d+$/.test(draft.spots) || Number(draft.spots) > 500)
  )
    list.spots = 'Los cupos son un número entre 0 y 500, o déjalo vacío.'
  return list
})
const valid = computed(() => Object.keys(errors.value).length === 0)

const categoryLabel = computed(
  () => CATEGORIES.find((item) => item.value === draft.category)?.label ?? '',
)
const previewTime = computed(() =>
  draft.startTime && draft.endTime
    ? timeRange(draft.startTime, draft.endTime)
    : '',
)

/** Lo que cambió respecto a lo guardado (sin publicar, que tiene su propia acción). */
function changes(): Partial<ScheduleIn> {
  const schedule = props.schedule!
  const next: Partial<ScheduleIn> = {}
  if (draft.title.trim() !== schedule.title) next.title = draft.title.trim()
  if (draft.category !== schedule.category) next.category = draft.category
  if (draft.date !== schedule.date) next.date = draft.date
  if (draft.startTime !== clock(schedule.startTime))
    next.startTime = draft.startTime
  if (draft.endTime !== clock(schedule.endTime)) next.endTime = draft.endTime
  if (draft.location.trim() !== schedule.location)
    next.location = draft.location.trim()
  if (draft.professionalName.trim() !== schedule.professionalName)
    next.professionalName = draft.professionalName.trim()
  if (draft.description.trim() !== schedule.description)
    next.description = draft.description.trim()
  const spots = draft.spots === '' ? null : Number(draft.spots)
  if (spots !== schedule.spots) next.spots = spots
  return next
}

const dirty = computed(() => {
  if (isNew.value) return true
  return (
    Object.keys(changes()).length > 0 ||
    draft.publish !== (props.schedule!.status === 'publicada')
  )
})

async function save() {
  submitted.value = true
  error.value = null
  if (!valid.value || locked.value || !dirty.value) return
  saving.value = true
  try {
    let saved: ScheduleOut
    if (isNew.value) {
      saved = await api.schedules.create(toIn())
    } else {
      const patch = changes()
      saved = Object.keys(patch).length
        ? await api.schedules.update(props.schedule!.id, patch)
        : props.schedule!
      if (draft.publish !== (saved.status === 'publicada'))
        saved = draft.publish
          ? await api.schedules.publish(saved.id)
          : await api.schedules.unpublish(saved.id)
    }
    toast.success(
      isNew.value
        ? draft.publish
          ? 'Creamos la actividad y ya se ve en el sitio.'
          : 'Guardamos la actividad como borrador.'
        : 'Guardamos los cambios de la actividad.',
    )
    emit('saved', saved)
  } catch (failure) {
    error.value = isApiError(failure)
      ? failure.message
      : 'No pudimos guardar la actividad. Intenta de nuevo.'
  } finally {
    saving.value = false
  }
}

function toIn(): ScheduleIn {
  return {
    title: draft.title.trim(),
    category: draft.category,
    date: draft.date,
    startTime: draft.startTime,
    endTime: draft.endTime,
    location: draft.location.trim(),
    professionalName: draft.professionalName.trim(),
    description: draft.description.trim(),
    spots: draft.spots === '' ? null : Number(draft.spots),
    publish: draft.publish,
  }
}

function openCancel() {
  cancelNote.value = `Se reprogramará en ${monthAfter(props.schedule!.date)}.`
  cancelError.value = null
  cancelOpen.value = true
}

function monthAfter(isoDay: string): string {
  const date = new Date(`${isoDay}T12:00:00-04:00`)
  date.setMonth(date.getMonth() + 1)
  return new Intl.DateTimeFormat('es-BO', {
    month: 'long',
    timeZone: 'America/La_Paz',
  }).format(date)
}

async function cancel() {
  if (cancelNote.value.trim().length < 3) {
    cancelError.value =
      'Escribe el aviso para las familias (al menos 3 letras).'
    return
  }
  cancelling.value = true
  cancelError.value = null
  try {
    const saved = await api.schedules.cancel(props.schedule!.id, {
      note: cancelNote.value.trim(),
    })
    cancelOpen.value = false
    toast.success('Cancelamos la actividad. Se verá tachada, con el aviso.')
    emit('cancelled', saved)
  } catch (failure) {
    cancelError.value = isApiError(failure)
      ? failure.message
      : 'No pudimos cancelar la actividad. Intenta de nuevo.'
  } finally {
    cancelling.value = false
  }
}
</script>

<template>
  <section class="editor surface-card" aria-labelledby="editor-titulo">
    <header class="editor__head">
      <p class="editor__eyebrow">{{ isNew ? 'Nueva' : 'Editando' }}</p>
      <h2 id="editor-titulo">
        {{ isNew ? 'Nueva actividad' : schedule!.title }}
      </h2>
      <StatusBadge
        v-if="!isNew"
        :tone="SCHEDULE_STATUS_TONES[schedule!.status]"
      >
        {{ SCHEDULE_STATUS_LABELS[schedule!.status] }}
      </StatusBadge>
    </header>

    <AppAlert v-if="error" tone="error">{{ error }}</AppAlert>
    <AppAlert v-if="schedule?.status === 'cancelada'" tone="neutral">
      Esta actividad está cancelada. El aviso que ven las familias es: «{{
        schedule.cancellationNote
      }}»
    </AppAlert>

    <form
      id="editor-actividad"
      class="editor__form"
      novalidate
      @submit.prevent="save"
    >
      <FormField
        v-slot="{ id, describedBy, invalid }"
        label="Título"
        required
        :error="submitted ? errors.title : undefined"
      >
        <input
          :id="id"
          v-model="draft.title"
          class="input"
          maxlength="120"
          :disabled="locked"
          :aria-describedby="describedBy"
          :aria-invalid="invalid"
        />
      </FormField>

      <div class="editor__row">
        <FormField v-slot="{ id }" label="Tipo" required>
          <select
            :id="id"
            v-model="draft.category"
            class="select"
            :disabled="locked"
          >
            <option
              v-for="item in CATEGORIES"
              :key="item.value"
              :value="item.value"
            >
              {{ item.label }}
            </option>
          </select>
        </FormField>
        <FormField
          v-slot="{ id, describedBy, invalid }"
          label="Fecha"
          required
          :error="submitted ? errors.date : undefined"
        >
          <input
            :id="id"
            v-model="draft.date"
            class="input"
            type="date"
            :disabled="locked"
            :aria-describedby="describedBy"
            :aria-invalid="invalid"
          />
        </FormField>
      </div>

      <div class="editor__row">
        <FormField
          v-slot="{ id, describedBy, invalid }"
          label="Desde"
          required
          :error="submitted ? errors.startTime : undefined"
        >
          <input
            :id="id"
            v-model="draft.startTime"
            class="input"
            type="time"
            :disabled="locked"
            :aria-describedby="describedBy"
            :aria-invalid="invalid"
          />
        </FormField>
        <FormField
          v-slot="{ id, describedBy, invalid }"
          label="Hasta"
          required
          :error="submitted ? errors.endTime : undefined"
        >
          <input
            :id="id"
            v-model="draft.endTime"
            class="input"
            type="time"
            :disabled="locked"
            :aria-describedby="describedBy"
            :aria-invalid="invalid"
          />
        </FormField>
      </div>

      <div class="editor__row">
        <FormField v-slot="{ id }" label="A cargo">
          <input
            :id="id"
            v-model="draft.professionalName"
            class="input"
            maxlength="120"
            :disabled="locked"
          />
        </FormField>
        <FormField
          v-slot="{ id, describedBy, invalid }"
          label="Cupos"
          :error="submitted ? errors.spots : undefined"
        >
          <input
            :id="id"
            v-model="draft.spots"
            class="input"
            inputmode="numeric"
            placeholder="Sin límite"
            :disabled="locked"
            :aria-describedby="describedBy"
            :aria-invalid="invalid"
          />
        </FormField>
      </div>

      <FormField
        v-slot="{ id, describedBy, invalid }"
        label="Lugar"
        required
        :error="submitted ? errors.location : undefined"
      >
        <input
          :id="id"
          v-model="draft.location"
          class="input"
          maxlength="120"
          :disabled="locked"
          :aria-describedby="describedBy"
          :aria-invalid="invalid"
        />
      </FormField>

      <FormField
        v-slot="{ id, describedBy, invalid }"
        label="Descripción para el sitio"
        required
        :error="submitted ? errors.description : undefined"
      >
        <textarea
          :id="id"
          v-model="draft.description"
          class="textarea"
          rows="3"
          maxlength="1000"
          :disabled="locked"
          :aria-describedby="describedBy"
          :aria-invalid="invalid"
        />
      </FormField>

      <section class="preview" aria-labelledby="vista-previa">
        <h3 id="vista-previa" class="preview__label">
          Así se verá en el sitio
        </h3>
        <article class="preview__card">
          <div class="preview__image" aria-hidden="true">
            {{ categoryLabel }}
          </div>
          <div class="preview__body">
            <strong>{{
              draft.title.trim() || 'Título de la actividad'
            }}</strong>
            <span v-if="draft.date"
              >{{ dayLabel(draft.date)
              }}<template v-if="previewTime">
                · {{ previewTime }}</template
              ></span
            >
            <span>{{ draft.location || 'Lugar' }}</span>
          </div>
        </article>
      </section>

      <label class="publish">
        <span>
          <strong>Publicada en el sitio</strong>
          <small>{{
            draft.publish
              ? 'Las familias la ven.'
              : 'Queda como borrador: nadie la ve todavía.'
          }}</small>
        </span>
        <input
          v-model="draft.publish"
          type="checkbox"
          class="switch"
          role="switch"
          :disabled="locked"
          :aria-checked="draft.publish"
        />
      </label>
    </form>

    <footer class="editor__actions">
      <AppButton
        v-if="!locked"
        type="submit"
        form="editor-actividad"
        block
        :disabled="!dirty || saving"
        :loading="saving"
        loading-label="Guardando la actividad…"
        @click="submitted = true"
      >
        {{ isNew ? 'Crear actividad' : 'Guardar cambios' }}
      </AppButton>
      <button
        v-if="!isNew && schedule!.status !== 'cancelada' && canEdit"
        type="button"
        class="cancel-link"
        @click="openCancel"
      >
        Cancelar la actividad con un aviso…
      </button>
    </footer>

    <AppModal
      v-model:open="cancelOpen"
      size="sm"
      title="Cancelar la actividad"
      :dismissible="!cancelling"
    >
      <div class="cancel">
        <p>
          Se verá tachada en el sitio, con este aviso. Ninguna familia se va a
          quedar sin saberlo.
        </p>
        <AppAlert v-if="cancelError" tone="error">{{ cancelError }}</AppAlert>
        <FormField
          v-slot="{ id, describedBy, invalid }"
          label="Aviso para las familias"
          required
        >
          <textarea
            :id="id"
            v-model="cancelNote"
            class="textarea"
            rows="3"
            maxlength="300"
            :aria-describedby="describedBy"
            :aria-invalid="invalid"
          />
        </FormField>
      </div>
      <template #actions>
        <AppButton
          variant="secondary"
          :disabled="cancelling"
          @click="cancelOpen = false"
        >
          Volver
        </AppButton>
        <AppButton
          variant="danger"
          :loading="cancelling"
          loading-label="Cancelando…"
          @click="cancel"
        >
          Sí, cancelar la actividad
        </AppButton>
      </template>
    </AppModal>
  </section>
</template>

<style scoped>
.editor {
  display: grid;
  align-content: start;
  gap: var(--space-4);
  min-width: 0;
  padding: var(--space-5) var(--space-6);
}

.editor__head {
  display: grid;
  gap: var(--space-1);
  justify-items: start;
}

.editor__eyebrow {
  color: var(--aspar-rojo);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.editor__head h2 {
  font-family: var(--font-serif);
  font-size: var(--text-xl);
  font-weight: 500;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.editor__form {
  display: grid;
  gap: clamp(var(--space-2), 1.4vh, var(--space-3));
  min-width: 0;
}

.editor__form fieldset {
  min-width: 0;
}

.editor__row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}

.preview {
  display: grid;
  gap: var(--space-2);
}

.preview__label {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  font-weight: 600;
}

.preview__card {
  display: grid;
  grid-template-columns: minmax(0, 7rem) minmax(0, 1fr);
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
}

.preview__image {
  display: grid;
  place-items: center;
  padding: var(--space-2);
  background: linear-gradient(135deg, var(--verde-800), var(--verde-700));
  color: #fff;
  font-size: var(--text-sm);
  font-weight: 700;
  text-align: center;
}

.preview__body {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.preview__body strong {
  color: var(--color-text);
  font-size: var(--text-md);
}

.publish {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  cursor: pointer;
}

.publish span {
  display: grid;
  gap: 0.1rem;
}

.publish small {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.switch {
  appearance: none;
  flex: none;
  width: 2.75rem;
  height: 1.5rem;
  border-radius: var(--radius-pill);
  background: var(--color-border-strong);
  position: relative;
  cursor: pointer;
  transition: background var(--duration-base) var(--ease-out);
}

.switch::after {
  content: '';
  position: absolute;
  top: 0.2rem;
  left: 0.2rem;
  width: 1.1rem;
  height: 1.1rem;
  border-radius: 50%;
  background: #fff;
  transition: transform var(--duration-base) var(--ease-out);
}

.switch:checked {
  background: var(--aspar-verde);
}

.switch:checked::after {
  transform: translateX(1.25rem);
}

.switch:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.editor__actions {
  display: grid;
  gap: var(--space-2);
  justify-items: center;
}

.cancel-link {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-link);
  font: inherit;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 0.25em;
  cursor: pointer;
}

.cancel {
  display: grid;
  gap: var(--space-3);
}

.cancel p {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

@media (max-width: 640px) {
  .editor {
    padding: var(--space-4);
  }

  .editor__row {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
