<script setup lang="ts">
/** Baja lógica o reactivación de una ficha, siempre con el motivo. Nada se borra. */
import { computed, nextTick, ref, watch } from 'vue'

import { isApiError } from '../../../api/errors'
import type { PatientOut } from '../../../api/types'
import { useApi } from '../../../composables/useApi'
import { useToast } from '../../../composables/useToast'
import { firstName } from '../../../utils/format'
import { reasonError } from '../../../utils/patients'
import AppAlert from '../../ui/AppAlert.vue'
import AppButton from '../../ui/AppButton.vue'
import AppModal from '../../ui/AppModal.vue'
import FormField from '../../ui/FormField.vue'

const props = defineProps<{
  mode: 'deactivate' | 'reactivate' | null
  patient: PatientOut
}>()
const emit = defineEmits<{ close: []; updated: [patient: PatientOut] }>()

const { api } = useApi()
const toast = useToast()

const reason = ref('')
const tried = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)
const field = ref<HTMLTextAreaElement | null>(null)

const deactivating = computed(() => props.mode === 'deactivate')
const reasonMessage = computed(() =>
  tried.value ? reasonError(reason.value) : null,
)

watch(
  () => props.mode,
  () => {
    reason.value = ''
    tried.value = false
    error.value = null
  },
)

async function confirm() {
  tried.value = true
  error.value = null
  if (reasonError(reason.value)) {
    await nextTick()
    field.value?.focus()
    return
  }
  saving.value = true
  try {
    const body = { reason: reason.value.trim() }
    const updated = deactivating.value
      ? await api.patients.deactivate(props.patient.id, body)
      : await api.patients.reactivate(props.patient.id, body)
    emit('updated', updated)
    emit('close')
    toast.success(
      deactivating.value
        ? `La ficha de ${props.patient.name} quedó inactiva. Nada se borró.`
        : `La ficha de ${props.patient.name} está activa de nuevo.`,
    )
  } catch (failure) {
    error.value = isApiError(failure)
      ? failure.message
      : 'No pudimos guardar el cambio. Intenta de nuevo.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppModal
    :open="mode !== null"
    size="sm"
    :title="deactivating ? 'Marcar como inactiva' : 'Reactivar la ficha'"
    :description="
      deactivating
        ? `Si ${firstName(patient.name)} deja de venir, la ficha sale de los activos. Sus datos, evaluaciones y documentos se conservan.`
        : `${firstName(patient.name)} vuelve a aparecer entre los activos y se puede editar su ficha.`
    "
    :dismissible="!saving"
    @update:open="emit('close')"
  >
    <form id="estado-ficha" novalidate @submit.prevent="confirm">
      <AppAlert v-if="error" tone="error">{{ error }}</AppAlert>
      <FormField
        v-slot="{ id, describedBy, invalid }"
        label="Motivo"
        required
        :hint="
          deactivating
            ? 'Por ejemplo: se mudó a otra ciudad.'
            : 'Por ejemplo: volvió a los talleres.'
        "
        :error="reasonMessage"
      >
        <textarea
          :id="id"
          ref="field"
          v-model="reason"
          class="textarea"
          rows="3"
          maxlength="300"
          autofocus
          :aria-describedby="describedBy"
          :aria-invalid="invalid"
        />
      </FormField>
    </form>
    <template #actions>
      <AppButton variant="secondary" :disabled="saving" @click="emit('close')">
        Cancelar
      </AppButton>
      <AppButton
        type="submit"
        form="estado-ficha"
        :variant="deactivating ? 'danger' : 'primary'"
        :loading="saving"
      >
        {{ deactivating ? 'Marcar como inactiva' : 'Reactivar ficha' }}
      </AppButton>
    </template>
  </AppModal>
</template>
