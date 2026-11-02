<script setup lang="ts">
/** Evaluaciones de seguimiento: física, fonoaudiológica y psicológica. */
import { computed, ref } from 'vue'

import { isApiError } from '../../../api/errors'
import type {
  EvaluationArea,
  EvaluationOut,
  PatientOut,
} from '../../../api/types'
import { useApi } from '../../../composables/useApi'
import { useToast } from '../../../composables/useToast'
import { shortDay } from '../../../utils/format'
import { EVALUATION_AREAS } from '../../../utils/patients'
import AppAlert from '../../ui/AppAlert.vue'
import AppButton from '../../ui/AppButton.vue'
import SkeletonBlock from '../../ui/SkeletonBlock.vue'
import EvaluationDialog from './EvaluationDialog.vue'
import PrivacyNotice from './PrivacyNotice.vue'

const props = defineProps<{
  patient: PatientOut
  notice: string | null
  /** Las carga la ficha (para el contador de la pestaña); null si aún no llegaron. */
  evaluations: EvaluationOut[] | null
}>()
const emit = defineEmits<{ 'update:evaluations': [value: EvaluationOut[]] }>()

const { api, session } = useApi()
const toast = useToast()

const area = ref<EvaluationArea | 'todas'>('todas')
const opened = ref<EvaluationOut | 'nueva' | null>(null)
const error = ref<string | null>(null)
const loading = ref(false)

const canWrite = computed(
  () => session.can('patients:write_clinical') && props.patient.active,
)

const sorted = computed(() =>
  [...(props.evaluations ?? [])].sort((a, b) =>
    b.evaluatedOn.localeCompare(a.evaluatedOn),
  ),
)
const shown = computed(() =>
  area.value === 'todas'
    ? sorted.value
    : sorted.value.filter((item) => item.area === area.value),
)
const filters = computed(() => [
  { key: 'todas' as const, label: 'Todas', count: sorted.value.length },
  ...(Object.keys(EVALUATION_AREAS) as EvaluationArea[]).map((key) => ({
    key,
    label: EVALUATION_AREAS[key],
    count: sorted.value.filter((item) => item.area === key).length,
  })),
])

async function load() {
  loading.value = true
  error.value = null
  try {
    emit('update:evaluations', await api.evaluations.list(props.patient.id))
  } catch (failure) {
    error.value = isApiError(failure)
      ? failure.message
      : 'No pudimos cargar las evaluaciones.'
  } finally {
    loading.value = false
  }
}

function onSaved(saved: EvaluationOut) {
  const isNew = opened.value === 'nueva'
  const others = (props.evaluations ?? []).filter(
    (item) => item.id !== saved.id,
  )
  emit('update:evaluations', [saved, ...others])
  opened.value = isNew ? null : saved
  toast.success(
    isNew ? 'Registramos la evaluación.' : 'Guardamos la corrección.',
  )
}

function onRemoved(evaluationId: string) {
  emit(
    'update:evaluations',
    (props.evaluations ?? []).filter((item) => item.id !== evaluationId),
  )
  opened.value = null
  toast.success('Quitamos la evaluación. Queda guardada con su motivo.')
}

if (!props.notice && props.evaluations === null) void load()
</script>

<template>
  <PrivacyNotice v-if="notice" :message="notice" />

  <section
    v-else
    class="evaluations surface-card"
    aria-labelledby="evaluaciones-titulo"
  >
    <div class="evaluations__head">
      <h2 id="evaluaciones-titulo">Evaluaciones de seguimiento</h2>
      <AppButton
        v-if="canWrite"
        variant="secondary"
        size="sm"
        @click="opened = 'nueva'"
      >
        + Nueva evaluación
      </AppButton>
    </div>

    <div class="chips" role="group" aria-label="Filtrar por área">
      <button
        v-for="filter in filters"
        :key="filter.key"
        type="button"
        class="chip"
        :aria-pressed="area === filter.key"
        @click="area = filter.key"
      >
        {{ filter.label }} <span class="chip__count">{{ filter.count }}</span>
      </button>
    </div>

    <AppAlert v-if="error" tone="error">
      {{ error }}
      <AppButton variant="link" size="sm" @click="load">Reintentar</AppButton>
    </AppAlert>

    <div v-if="loading" aria-busy="true">
      <SkeletonBlock :lines="3" />
    </div>
    <ul v-else-if="shown.length" class="evaluations__list">
      <li v-for="item in shown" :key="item.id" class="evaluation">
        <div class="evaluation__when">
          <strong>{{ item.areaLabel }}</strong>
          <span>{{ shortDay(item.evaluatedOn) }}</span>
        </div>
        <div class="evaluation__text">
          <p>{{ item.notes }}</p>
          <span>{{ item.professionalName }}</span>
        </div>
        <AppButton
          variant="link"
          size="sm"
          :aria-label="`Ver la evaluación ${item.areaLabel.toLocaleLowerCase('es')} del ${shortDay(item.evaluatedOn)}`"
          @click="opened = item"
        >
          Ver
        </AppButton>
      </li>
    </ul>
    <p v-else-if="!error" class="evaluations__empty">
      {{
        area === 'todas'
          ? 'Todavía no hay evaluaciones registradas.'
          : `Todavía no hay evaluaciones ${EVALUATION_AREAS[area].toLocaleLowerCase('es')}s.`
      }}
    </p>

    <EvaluationDialog
      :patient-id="patient.id"
      :evaluation="opened"
      :can-write="canWrite"
      @close="opened = null"
      @saved="onSaved"
      @removed="onRemoved"
    />
  </section>
</template>

<style scoped>
.evaluations {
  display: grid;
  gap: var(--space-4);
  padding: var(--space-5) var(--space-6);
}

.evaluations__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.evaluations__head h2 {
  font-family: var(--font-sans);
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--color-text);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 2.25rem;
  padding: 0 var(--space-4);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
}

.chip[aria-pressed='true'] {
  border-color: var(--aspar-guindo);
  background: var(--rosa-100);
  color: var(--aspar-guindo);
}

.chip:focus-visible {
  box-shadow: var(--focus-ring);
}

.chip__count {
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.evaluations__list {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.evaluation {
  display: grid;
  grid-template-columns: 10rem minmax(0, 1fr) auto;
  gap: var(--space-4);
  align-items: start;
  padding: var(--space-4) 0;
  border-top: 1px solid var(--color-border);
}

.evaluation__when,
.evaluation__text {
  display: grid;
  gap: var(--space-1);
}

.evaluation__when span,
.evaluation__text span {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.evaluation__text p {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.evaluations__empty {
  padding: var(--space-6) 0;
  color: var(--color-text-muted);
  text-align: center;
}

@media (max-width: 640px) {
  .evaluations {
    padding: var(--space-4);
  }

  .evaluation {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .evaluation__text {
    grid-column: 1 / -1;
    grid-row: 2;
  }
}
</style>
