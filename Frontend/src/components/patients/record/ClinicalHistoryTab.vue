<script setup lang="ts">
/**
 * Historia clínica: diagnóstico, estadio y certificado del neurólogo (los edita quien
 * edita fichas) y síntomas y medicación (solo el personal clínico). Sin acceso clínico
 * (RNF-06) la API no envía nada y aquí solo se explica por qué.
 */
import { computed, reactive, ref, watch } from 'vue'

import { isApiError } from '../../../api/errors'
import type { PatientOut } from '../../../api/types'
import { useApi } from '../../../composables/useApi'
import { useFitLayout } from '../../../composables/useFitLayout'
import { useToast } from '../../../composables/useToast'
import { PARKINSON_STAGES } from '../../../utils/patients'
import AppAlert from '../../ui/AppAlert.vue'
import AppButton from '../../ui/AppButton.vue'
import FormField from '../../ui/FormField.vue'
import PrivacyNotice from './PrivacyNotice.vue'

const props = defineProps<{ patient: PatientOut; notice: string | null }>()
const emit = defineEmits<{
  updated: [patient: PatientOut]
  dirty: [value: boolean]
}>()

const { api, session } = useApi()
const fit = useFitLayout()
const toast = useToast()

type Anamnesis = PatientOut['anamnesis']

const draft = reactive<Anamnesis>({ ...props.patient.anamnesis })
const saved = ref<Anamnesis>({ ...props.patient.anamnesis })
const saving = ref(false)
const error = ref<string | null>(null)

const canEditBase = computed(
  () => session.can('patients:write') && props.patient.active,
)
const canEditClinical = computed(
  () => session.can('patients:write_clinical') && props.patient.active,
)
const canSave = computed(() => canEditBase.value || canEditClinical.value)

const changes = computed(() => {
  const changed: Partial<Anamnesis> = {}
  for (const key of Object.keys(draft) as (keyof Anamnesis)[]) {
    if (draft[key] === saved.value[key]) continue
    const clinical = key === 'symptomNotes' || key === 'medications'
    if (clinical ? canEditClinical.value : canEditBase.value)
      Object.assign(changed, { [key]: draft[key] })
  }
  return changed
})
const dirty = computed(() => Object.keys(changes.value).length > 0)
watch(dirty, (value) => emit('dirty', value), { immediate: true })

function reset() {
  Object.assign(draft, saved.value)
  error.value = null
}

async function save() {
  if (!dirty.value) return
  saving.value = true
  error.value = null
  try {
    const updated = await api.patients.update(props.patient.id, {
      anamnesis: changes.value,
    })
    saved.value = { ...updated.anamnesis }
    Object.assign(draft, saved.value)
    emit('updated', updated)
    toast.success('Guardamos la historia clínica.')
  } catch (failure) {
    error.value = isApiError(failure)
      ? failure.message
      : 'No pudimos guardar la historia clínica. Intenta de nuevo.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <PrivacyNotice v-if="notice" :message="notice" />

  <form
    v-else
    class="history surface-card"
    :class="{ 'history--fit': fit }"
    novalidate
    @submit.prevent="save"
  >
    <div class="history__head">
      <h2 id="historia-titulo">Diagnóstico</h2>
      <p>
        Cada consulta de la historia clínica queda en el registro de actividad.
      </p>
      <AppAlert v-if="error" tone="error">{{ error }}</AppAlert>
    </div>

    <fieldset :disabled="!canEditBase" class="history__grid">
      <FormField
        v-slot="{ id, describedBy, invalid }"
        class="span-2"
        label="Diagnóstico"
        hint="Por ejemplo: Enfermedad de Parkinson idiopática."
      >
        <input
          :id="id"
          v-model="draft.diagnosis"
          class="input"
          maxlength="200"
          :aria-describedby="describedBy"
          :aria-invalid="invalid"
        />
      </FormField>
      <FormField v-slot="{ id }" label="Estadio (Hoehn y Yahr)">
        <select :id="id" v-model="draft.stage" class="select">
          <option v-for="stage in PARKINSON_STAGES" :key="stage" :value="stage">
            {{ stage }}
          </option>
        </select>
      </FormField>
      <label class="checkbox history__certificate">
        <input v-model="draft.neurologistCertificate" type="checkbox" />
        <span>Presentó el certificado del neurólogo.</span>
      </label>
    </fieldset>

    <fieldset :disabled="!canEditClinical" class="history__grid">
      <legend class="history__legend">
        Síntomas y medicación
        <small v-if="!canEditClinical"
          >Solo los registra el personal clínico.</small
        >
      </legend>
      <FormField
        v-slot="{ id }"
        class="span-2"
        label="Síntomas y observaciones"
      >
        <textarea
          :id="id"
          v-model="draft.symptomNotes"
          class="textarea"
          rows="4"
          maxlength="4000"
        />
      </FormField>
      <FormField v-slot="{ id }" class="span-2" label="Medicación">
        <textarea
          :id="id"
          v-model="draft.medications"
          class="textarea"
          rows="3"
          maxlength="2000"
        />
      </FormField>
    </fieldset>

    <div v-if="canSave" class="history__actions">
      <AppButton
        variant="secondary"
        :disabled="!dirty || saving"
        @click="reset"
      >
        Cancelar
      </AppButton>
      <AppButton
        type="submit"
        :disabled="!dirty"
        :loading="saving"
        loading-label="Guardando la historia clínica…"
      >
        Guardar historia clínica
      </AppButton>
    </div>
  </form>
</template>

<style scoped>
.history {
  display: grid;
  gap: var(--space-5);
  max-width: 56rem;
  padding: var(--space-5) var(--space-6) var(--space-6);
}

.history__head {
  display: grid;
  gap: var(--space-1);
}

.history__head h2 {
  font-family: var(--font-sans);
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--color-text);
}

.history__head p {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.history__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
  align-items: end;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.history__legend {
  display: grid;
  gap: var(--space-1);
  margin-bottom: var(--space-2);
  padding: 0;
  font-weight: 700;
}

.history__legend small {
  color: var(--color-text-muted);
  font-weight: 400;
}

.history__certificate {
  padding-bottom: var(--space-3);
}

.span-2 {
  grid-column: span 2;
}

.history__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
}

@media (max-width: 640px) {
  .history {
    padding: var(--space-4);
  }

  .history__grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .span-2 {
    grid-column: auto;
  }
}

/* Ventana completa en pantallas anchas: diagnóstico a la izquierda, síntomas y
   medicación a la derecha, para que todo entre sin desplazar */
.history--fit {
  gap: clamp(var(--space-3), 2vh, var(--space-5));
  padding: clamp(var(--space-3), 2vh, var(--space-5)) var(--space-6);
}

@media (min-width: 1280px) {
  .history--fit {
    max-width: none;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: var(--space-8);
    align-items: start;
  }

  .history--fit .history__head {
    grid-column: 1 / -1;
  }

  /* Los botones quedan bajo el diagnóstico: no suman una fila más */
  .history--fit .history__grid:first-of-type {
    grid-column: 1;
    grid-row: 2;
  }

  .history--fit .history__grid:last-of-type {
    grid-column: 2;
    grid-row: 2 / span 2;
  }

  .history--fit .history__actions {
    grid-column: 1;
    grid-row: 3;
    align-self: end;
  }

  .history--fit .history__grid:first-of-type > :deep(.field) {
    grid-column: 1 / -1;
  }

  .history--fit .textarea {
    min-height: 0;
    height: clamp(4.5rem, 13vh, 8rem);
  }
}
</style>
