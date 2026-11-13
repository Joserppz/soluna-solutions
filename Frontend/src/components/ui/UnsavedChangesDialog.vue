<script setup lang="ts">
import AppButton from './AppButton.vue'
import AppModal from './AppModal.vue'

/** Pregunta antes de perder cambios (ver composables/useUnsavedChanges.ts). */
withDefaults(
  defineProps<{
    open: boolean
    /** Qué se perdería, por ejemplo «en la ficha». */
    where?: string
  }>(),
  { where: '' },
)

defineEmits<{ stay: []; leave: [] }>()
</script>

<template>
  <AppModal
    :open="open"
    size="sm"
    title="Tienes cambios sin guardar"
    :description="`Si sales ahora, se pierden los cambios${where ? ` ${where}` : ''}.`"
    @update:open="!$event && $emit('stay')"
  >
    <template #actions>
      <AppButton variant="secondary" @click="$emit('leave')">
        Salir sin guardar
      </AppButton>
      <AppButton @click="$emit('stay')">Seguir editando</AppButton>
    </template>
  </AppModal>
</template>
