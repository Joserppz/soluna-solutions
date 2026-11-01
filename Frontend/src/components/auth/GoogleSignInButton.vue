<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { loadScript } from '../../utils/loadScript'

/**
 * Botón oficial «Continuar con Google» (Google Identity Services). Entrega el ID
 * token a quien lo use (la API lo verifica en POST /auth/google). Si el sitio no
 * tiene VITE_GOOGLE_CLIENT_ID, el botón no aparece.
 */
const GOOGLE_SCRIPT = 'https://accounts.google.com/gsi/client'

const emit = defineEmits<{ credential: [credential: string] }>()

const clientId = computed(() => {
  const value = import.meta.env.VITE_GOOGLE_CLIENT_ID
  return typeof value === 'string' ? value.trim() : ''
})
const container = ref<HTMLElement | null>(null)
const failed = ref(false)

onMounted(async () => {
  if (!clientId.value) return
  try {
    if (!window.google?.accounts?.id) await loadScript(GOOGLE_SCRIPT)
    const google = window.google?.accounts?.id
    if (!google || !container.value) throw new Error('Sin Google')
    google.initialize({
      client_id: clientId.value,
      callback: (response: { credential?: string }) => {
        if (response.credential) emit('credential', response.credential)
      },
      ux_mode: 'popup',
      cancel_on_tap_outside: true,
    })
    google.renderButton(container.value, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
      logo_alignment: 'center',
      locale: 'es',
      width: Math.min(container.value.clientWidth || 400, 400),
    })
  } catch {
    failed.value = true
  }
})
</script>

<template>
  <div v-if="clientId" class="google">
    <div ref="container" class="google__button" />
    <p v-if="failed" class="google__failed">
      No pudimos cargar «Continuar con Google». Ingresa con tu correo o recarga
      la página.
    </p>
  </div>
</template>

<style scoped>
.google {
  display: grid;
  justify-items: center;
  gap: var(--space-2);
  min-height: 2.75rem;
}

.google__button {
  width: 100%;
  display: flex;
  justify-content: center;
}

.google__failed {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  text-align: center;
}
</style>
