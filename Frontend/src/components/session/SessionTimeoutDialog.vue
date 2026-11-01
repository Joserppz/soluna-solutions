<script setup lang="ts">
import { computed, ref } from 'vue'

import { formatCountdown } from '../../composables/useIdleSession'
import AppButton from '../ui/AppButton.vue'
import AppModal from '../ui/AppModal.vue'

const props = defineProps<{
  open: boolean
  remainingMs: number
  /** Minutos sin uso que cierran la sesión (para el texto). */
  idleMinutes: number
  keepAlive: () => Promise<void>
}>()
const emit = defineEmits<{ logout: [] }>()

const keeping = ref(false)
const countdown = computed(() => formatCountdown(props.remainingMs))

async function keep() {
  keeping.value = true
  try {
    await props.keepAlive()
  } finally {
    keeping.value = false
  }
}
</script>

<template>
  <AppModal :open="open" title="¿Sigues ahí?" size="sm" :dismissible="false">
    <p class="timeout__lead">
      Tu sesión se cerrará en
      <strong class="timeout__count" role="timer" aria-live="off">{{
        countdown
      }}</strong>
    </p>
    <p class="timeout__text">
      Por tu tranquilidad, la sesión se cierra sola tras {{ idleMinutes }}
      minutos sin uso. Si sigues trabajando, mantenla activa.
    </p>
    <template #actions>
      <AppButton variant="secondary" @click="emit('logout')">
        Cerrar sesión
      </AppButton>
      <AppButton :loading="keeping" autofocus @click="keep">
        Mantener la sesión activa
      </AppButton>
    </template>
  </AppModal>
</template>

<style scoped>
.timeout__lead {
  font-size: var(--text-lg);
}

.timeout__count {
  display: inline-block;
  min-width: 3.5ch;
  font-family: var(--font-serif);
  font-size: var(--text-2xl);
  color: var(--aspar-guindo);
  font-variant-numeric: tabular-nums;
}

.timeout__text {
  margin-top: var(--space-3);
  color: var(--color-text-muted);
}
</style>
