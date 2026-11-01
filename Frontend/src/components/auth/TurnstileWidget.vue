<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import { loadScript } from '../../utils/loadScript'
import AppAlert from '../ui/AppAlert.vue'
import SkeletonBlock from '../ui/SkeletonBlock.vue'

/**
 * Verificación de Cloudflare Turnstile («¿Eres una persona?») para los formularios
 * de registro y recuperación. El token es de un solo uso: después de cada envío
 * hay que llamar a reset().
 */
const TURNSTILE_SCRIPT =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
/** Clave de prueba de Cloudflare: siempre aprueba. Solo en desarrollo. */
const TEST_SITE_KEY = '1x00000000000000000000AA'

const emit = defineEmits<{
  verified: [token: string]
  expired: []
}>()

const container = ref<HTMLElement | null>(null)
const status = ref<'loading' | 'ready' | 'error' | 'missing'>('loading')
let widgetId: string | undefined

function siteKey(): string {
  const configured = import.meta.env.VITE_TURNSTILE_SITE_KEY
  if (typeof configured === 'string' && configured.trim())
    return configured.trim()
  return import.meta.env.DEV ? TEST_SITE_KEY : ''
}

async function render() {
  const key = siteKey()
  if (!key) {
    status.value = 'missing'
    return
  }
  try {
    if (!window.turnstile) await loadScript(TURNSTILE_SCRIPT)
    if (!window.turnstile || !container.value) throw new Error('Sin Turnstile')
    widgetId = window.turnstile.render(container.value, {
      sitekey: key,
      language: 'es',
      theme: 'light',
      callback: (token: string) => emit('verified', token),
      'expired-callback': () => emit('expired'),
      'error-callback': () => emit('expired'),
    })
    status.value = 'ready'
  } catch {
    status.value = 'error'
  }
}

function reset() {
  window.turnstile?.reset(widgetId)
  emit('expired')
}

defineExpose({ reset })

onMounted(render)
onBeforeUnmount(() => {
  if (widgetId) window.turnstile?.remove(widgetId)
})
</script>

<template>
  <div class="turnstile">
    <SkeletonBlock
      v-if="status === 'loading'"
      width="18.75rem"
      height="4.1rem"
      radius="var(--radius-sm)"
    />
    <div v-show="status === 'ready'" ref="container" class="turnstile__box" />
    <AppAlert v-if="status === 'error'" tone="warning">
      No pudimos cargar la verificación de seguridad. Revisa tu conexión y
      recarga la página.
    </AppAlert>
    <AppAlert v-if="status === 'missing'" tone="warning">
      La verificación de seguridad no está configurada en este sitio. Avísale a
      Administración.
    </AppAlert>
  </div>
</template>

<style scoped>
.turnstile {
  min-height: 4.1rem;
}
</style>
