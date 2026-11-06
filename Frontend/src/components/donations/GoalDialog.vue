<script setup lang="ts">
/**
 * «Editar meta» (diseño pág. 15): la meta que se ve en el sitio, su monto, los hitos y
 * si está visible. El avance suma solo lo confirmado; el ajuste manual sirve para lo
 * que llegó antes de usar este sistema y queda en el registro de actividad.
 */
import { computed, reactive, ref, watch } from 'vue'

import { isApiError } from '../../api/errors'
import type { GoalIn, GoalOut } from '../../api/types'
import { useApi } from '../../composables/useApi'
import { formatBs } from '../../utils/donations'
import AppAlert from '../ui/AppAlert.vue'
import AppButton from '../ui/AppButton.vue'
import AppModal from '../ui/AppModal.vue'
import FormField from '../ui/FormField.vue'

type MilestoneStatus = NonNullable<GoalIn['milestones']>[number]['status']

const MILESTONE_STATUSES: {
  value: NonNullable<MilestoneStatus>
  label: string
}[] = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'en_camino', label: 'En camino' },
  { value: 'cubierto', label: 'Cubierto' },
]
const MAX_MILESTONES = 10

const props = defineProps<{ open: boolean; goal: GoalOut | null }>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  saved: [goal: GoalOut]
}>()

const { api } = useApi()

let nextKey = 1
const draft = reactive({
  title: '',
  description: '',
  target: '',
  adjustment: '0',
  visible: true,
  milestones: [] as {
    key: number
    label: string
    status: NonNullable<MilestoneStatus>
  }[],
})
const submitted = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    const goal = props.goal
    Object.assign(draft, {
      title: goal?.title ?? '',
      description: goal?.description ?? '',
      target: goal ? String(goal.targetBs) : '',
      adjustment: goal ? String(goal.manualAdjustmentBs) : '0',
      visible: goal?.visible ?? true,
      milestones: (goal?.milestones ?? []).map((m) => ({
        key: nextKey++,
        label: m.label,
        status: m.status,
      })),
    })
    submitted.value = false
    error.value = null
  },
)

function number(value: string): number | null {
  const clean = value.replace(/\s/g, '').replace(',', '.')
  return /^-?\d+(\.\d{1,2})?$/.test(clean) ? Number(clean) : null
}

const errors = computed(() => {
  const list: Record<string, string> = {}
  if (draft.title.trim().length < 3)
    list.title = 'Escribe el título de la meta (al menos 3 letras).'
  const target = number(draft.target)
  if (target === null || target <= 0)
    list.target = 'Escribe el monto de la meta en bolivianos.'
  if (number(draft.adjustment) === null)
    list.adjustment = 'Escribe un número, por ejemplo 0 o 1500.'
  draft.milestones.forEach((m, index) => {
    if (m.label.trim().length < 3)
      list[`milestone-${index}`] = 'Escribe el hito (al menos 3 letras).'
  })
  return list
})

const preview = computed(() => {
  const confirmed = props.goal?.confirmedBs ?? 0
  const adjustment = number(draft.adjustment) ?? 0
  const target = number(draft.target) ?? 0
  const raised = Math.max(0, confirmed + adjustment)
  return {
    raised,
    target,
    percent: target ? Math.min(100, Math.round((raised / target) * 100)) : 0,
  }
})

function addMilestone() {
  if (draft.milestones.length >= MAX_MILESTONES) return
  draft.milestones.push({ key: nextKey++, label: '', status: 'pendiente' })
}

function removeMilestone(key: number) {
  draft.milestones = draft.milestones.filter((m) => m.key !== key)
}

async function save() {
  submitted.value = true
  error.value = null
  if (Object.keys(errors.value).length) return
  saving.value = true
  try {
    const saved = await api.donations.saveGoal({
      title: draft.title.trim(),
      description: draft.description.trim(),
      targetBs: number(draft.target)!,
      manualAdjustmentBs: number(draft.adjustment)!,
      visible: draft.visible,
      milestones: draft.milestones.map((m) => ({
        label: m.label.trim(),
        status: m.status,
      })),
    })
    emit('saved', saved)
    emit('update:open', false)
  } catch (failure) {
    error.value = isApiError(failure)
      ? failure.message
      : 'No pudimos guardar la meta. Intenta de nuevo.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppModal
    :open="open"
    size="xl"
    title="Meta en el sitio"
    description="Solo suma lo confirmado. Al confirmar un aporte, la meta pública se actualiza sola."
    :dismissible="!saving"
    @update:open="emit('update:open', $event)"
  >
    <form id="editar-meta" class="goal" novalidate @submit.prevent="save">
      <AppAlert v-if="error" tone="error">{{ error }}</AppAlert>
      <div class="goal__grid">
        <div class="goal__col">
          <div class="goal__row goal__row--title">
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
                :aria-describedby="describedBy"
                :aria-invalid="invalid"
              />
            </FormField>
            <label class="visible">
              <span>Visible en el sitio</span>
              <input
                v-model="draft.visible"
                type="checkbox"
                role="switch"
                class="switch"
                :aria-checked="draft.visible"
              />
            </label>
          </div>
          <FormField v-slot="{ id }" label="Para qué es">
            <input
              :id="id"
              v-model="draft.description"
              class="input"
              maxlength="300"
              placeholder="Por ejemplo: espacio propio y equipos de fisioterapia"
            />
          </FormField>
          <div class="goal__row">
            <FormField
              v-slot="{ id, describedBy, invalid }"
              label="Meta (Bs.)"
              required
              :error="submitted ? errors.target : undefined"
            >
              <input
                :id="id"
                v-model="draft.target"
                class="input"
                inputmode="decimal"
                :aria-describedby="describedBy"
                :aria-invalid="invalid"
              />
            </FormField>
            <FormField
              v-slot="{ id, describedBy, invalid }"
              label="Ajuste manual (Bs.)"
              hint="Lo que llegó antes de este sistema."
              :error="submitted ? errors.adjustment : undefined"
            >
              <input
                :id="id"
                v-model="draft.adjustment"
                class="input"
                inputmode="decimal"
                :aria-describedby="describedBy"
                :aria-invalid="invalid"
              />
            </FormField>
          </div>

          <div class="progress" aria-hidden="true">
            <span :style="{ width: `${preview.percent}%` }" />
          </div>
          <p class="progress__text">
            <strong>{{ formatBs(preview.raised) }}</strong> de
            {{ formatBs(preview.target) }} · {{ preview.percent }} %
          </p>
        </div>
        <fieldset class="milestones">
          <legend>Hitos</legend>
          <p v-if="!draft.milestones.length" class="milestones__empty">
            Sin hitos. Por ejemplo: «Colchonetas nuevas».
          </p>
          <div
            v-for="(milestone, index) in draft.milestones"
            :key="milestone.key"
            class="milestone"
          >
            <FormField
              v-slot="{ id, describedBy, invalid }"
              :label="`Hito ${index + 1}`"
              :error="submitted ? errors[`milestone-${index}`] : undefined"
            >
              <input
                :id="id"
                v-model="milestone.label"
                class="input"
                maxlength="80"
                :aria-describedby="describedBy"
                :aria-invalid="invalid"
              />
            </FormField>
            <FormField v-slot="{ id }" :label="`Estado del hito ${index + 1}`">
              <select :id="id" v-model="milestone.status" class="select">
                <option
                  v-for="option in MILESTONE_STATUSES"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </FormField>
            <button
              type="button"
              class="milestone__remove"
              :aria-label="`Quitar el hito ${index + 1}`"
              @click="removeMilestone(milestone.key)"
            >
              ×
            </button>
          </div>
          <AppButton
            v-if="draft.milestones.length < MAX_MILESTONES"
            variant="secondary"
            size="sm"
            @click="addMilestone"
          >
            + Agregar hito
          </AppButton>
        </fieldset>
      </div>
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
        form="editar-meta"
        :loading="saving"
        loading-label="Guardando…"
      >
        Guardar meta
      </AppButton>
    </template>
  </AppModal>
</template>

<style scoped>
.goal {
  display: grid;
  gap: var(--space-3);
}

/* La meta a la izquierda y sus hitos a la derecha: entra sin desplazarse */
.goal__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--space-6);
  align-items: start;
}

.goal__col {
  display: grid;
  gap: var(--space-3);
  min-width: 0;
}

.goal__row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
  align-items: start;
}

.goal__row--title {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
}

.goal :deep(.input),
.goal :deep(.select) {
  width: 100%;
  min-width: 0;
}

.visible {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 2.75rem;
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
}

.switch {
  appearance: none;
  position: relative;
  width: 2.75rem;
  height: 1.5rem;
  border-radius: var(--radius-pill);
  background: var(--color-border-strong);
  cursor: pointer;
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

.progress {
  height: 0.55rem;
  border-radius: var(--radius-pill);
  background: var(--color-surface-sunken);
  overflow: hidden;
}

.progress span {
  display: block;
  height: 100%;
  background: var(--aspar-guindo);
}

.progress__text {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.milestones {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
  max-height: min(26rem, calc(100dvh - 18rem));
  margin: 0;
  padding: 0 0.25rem 0 0;
  overflow-y: auto;
  border: 0;
  justify-items: start;
}

.milestones legend {
  margin-bottom: var(--space-1);
  font-size: var(--text-sm);
  font-weight: 600;
}

.milestones__empty {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.milestone {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 10rem 2.25rem;
  align-items: end;
  gap: var(--space-2);
  width: 100%;
}

/* La etiqueta de cada hito la leen los lectores de pantalla; a la vista basta el campo */
.milestone :deep(.field__label) {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.milestone__remove {
  width: 2.25rem;
  height: 2.5rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: var(--text-lg);
  cursor: pointer;
}

@media (max-width: 760px) {
  .goal__grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .milestones {
    max-height: none;
  }
}

@media (max-width: 640px) {
  .goal__row,
  .goal__row--title {
    grid-template-columns: minmax(0, 1fr);
  }

  .milestone {
    grid-template-columns: minmax(0, 1fr) 2.25rem;
  }

  .milestone > :nth-child(2) {
    grid-column: 1;
  }
}
</style>
