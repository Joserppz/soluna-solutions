<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { PublicSchedule } from '../../api/types'
import { dayLabel, timeRange } from '../../utils/ops'
import AppButton from '../ui/AppButton.vue'
import AppModal from '../ui/AppModal.vue'
import InquiryForm from './InquiryForm.vue'

/** «Quiero participar» en una actividad de la agenda: el equipo llama para confirmar. */
const props = defineProps<{
  open: boolean
  activity: PublicSchedule | null
}>()

const emit = defineEmits<{ 'update:open': [open: boolean] }>()

const sentMessage = ref<string | null>(null)

watch(
  () => props.open,
  (open) => {
    if (open) sentMessage.value = null
  },
)

const description = computed(() =>
  props.activity
    ? `${dayLabel(props.activity.date)} · ${timeRange(props.activity.startTime, props.activity.endTime)} · ${props.activity.location}`
    : undefined,
)
</script>

<template>
  <AppModal
    :open="open"
    :title="
      activity ? `Quiero participar: ${activity.title}` : 'Quiero participar'
    "
    :description="description"
    size="md"
    @update:open="emit('update:open', $event)"
  >
    <div v-if="sentMessage" class="sent" role="status">
      <p class="sent__title">¡Gracias! Ya tenemos tus datos.</p>
      <p>{{ sentMessage }}</p>
      <p class="text-muted">
        El equipo te llamará para confirmar tu lugar. Puedes venir con un
        familiar o cuidador.
      </p>
      <AppButton @click="emit('update:open', false)">Listo</AppButton>
    </div>
    <template v-else-if="activity">
      <p class="intro">
        Déjanos tu nombre y tu teléfono. No hace falta crear una cuenta.
      </p>
      <InquiryForm
        :schedule-id="activity.id"
        id-prefix="participar"
        submit-label="Quiero participar"
        @sent="sentMessage = $event"
      />
    </template>
  </AppModal>
</template>

<style scoped>
.intro {
  margin: 0 0 var(--space-4);
  color: var(--color-text-muted);
}

/* Ventanas bajas: el formulario entra completo, sin barra */
@media (max-height: 760px) {
  .intro {
    display: none;
  }
}

.sent {
  display: grid;
  gap: var(--space-3);
  justify-items: start;
}

.sent p {
  margin: 0;
}

.sent__title {
  font-family: var(--font-serif);
  font-size: var(--text-xl);
  color: var(--color-heading);
}
</style>
