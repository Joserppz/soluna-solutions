<script setup lang="ts">
/** Nombre, relación y teléfono de un familiar o persona cuidadora. */
import { computed } from 'vue'

import { RELATIONS } from '../../utils/patients'
import FormField from '../ui/FormField.vue'

export interface ContactDraft {
  name: string
  relation: string
  phone: string
}

export type ContactErrors = Partial<Record<keyof ContactDraft, string | null>>

const props = withDefaults(
  defineProps<{
    modelValue: ContactDraft
    errors?: ContactErrors
    /** Prefijo único para los id de los campos. */
    idPrefix: string
    disabled?: boolean
  }>(),
  { errors: () => ({}), disabled: false },
)

const emit = defineEmits<{ 'update:modelValue': [value: ContactDraft] }>()

// Una relación escrita antes con otras palabras sigue apareciendo como opción
const relations = computed(() => {
  const current = props.modelValue.relation
  return current && !(RELATIONS as readonly string[]).includes(current)
    ? [current, ...RELATIONS]
    : [...RELATIONS]
})

function update(field: keyof ContactDraft, value: string) {
  emit('update:modelValue', { ...props.modelValue, [field]: value })
}
</script>

<template>
  <div class="contact-fields">
    <FormField
      :id="`${idPrefix}-nombre`"
      v-slot="{ id, describedBy, invalid }"
      label="Nombre completo"
      required
      :error="errors.name"
    >
      <input
        :id="id"
        class="input"
        autocomplete="off"
        maxlength="120"
        :value="modelValue.name"
        :disabled="disabled"
        :aria-describedby="describedBy"
        :aria-invalid="invalid"
        @input="update('name', ($event.target as HTMLInputElement).value)"
      />
    </FormField>
    <FormField
      :id="`${idPrefix}-relacion`"
      v-slot="{ id, describedBy, invalid }"
      label="Relación"
      required
      :error="errors.relation"
    >
      <select
        :id="id"
        class="select"
        :value="modelValue.relation"
        :disabled="disabled"
        :aria-describedby="describedBy"
        :aria-invalid="invalid"
        @change="update('relation', ($event.target as HTMLSelectElement).value)"
      >
        <option value="" disabled>Elige una opción</option>
        <option v-for="relation in relations" :key="relation" :value="relation">
          {{ relation }}
        </option>
      </select>
    </FormField>
    <FormField
      :id="`${idPrefix}-telefono`"
      v-slot="{ id, describedBy, invalid }"
      label="Teléfono"
      required
      :error="errors.phone"
    >
      <input
        :id="id"
        class="input"
        type="tel"
        inputmode="tel"
        autocomplete="off"
        maxlength="16"
        :value="modelValue.phone"
        :disabled="disabled"
        :aria-describedby="describedBy"
        :aria-invalid="invalid"
        @input="update('phone', ($event.target as HTMLInputElement).value)"
      />
    </FormField>
  </div>
</template>

<style scoped>
.contact-fields {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--space-4);
  align-items: start;
}

@media (max-width: 640px) {
  .contact-fields {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
