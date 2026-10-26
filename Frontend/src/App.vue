<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import {
  SESSION_WARNING_THRESHOLD,
  getSession,
  getSessionRemainingMs,
  renewSession,
  signOut,
  touchSession,
  type Session,
} from './services/aspar'

const route = useRoute()
const router = useRouter()
const session = ref<Session | null>(getSession())
const remainingMs = ref<number>(0)
const sessionAlert = ref('')
let expiryTimer = 0

const isAdmin = computed(() => session.value?.role === 'Administrador')
const isExpiringSoon = computed(
  () =>
    Boolean(session.value) &&
    remainingMs.value > 0 &&
    remainingMs.value <= SESSION_WARNING_THRESHOLD,
)

const formattedRemaining = computed(() => {
  const totalSec = Math.max(0, Math.floor(remainingMs.value / 1000))
  const mins = Math.floor(totalSec / 60)
  const secs = String(totalSec % 60).padStart(2, '0')
  return `${mins}:${secs}`
})

function syncSession() {
  const prev = session.value
  const current = getSession()
  session.value = current

  const remaining = getSessionRemainingMs()
  remainingMs.value = remaining ? remaining.effectiveRemainingMs : 0

  if (prev && !current) {
    sessionAlert.value =
      'Tu sesión ha expirado por inactividad o tiempo límite de seguridad (RNF-02).'
  }

  if (!current && route.meta.requiresAuth) {
    router.replace({ name: 'login', query: { expired: '1' } })
  }
}

function registerActivity() {
  if (!session.value) return
  touchSession()
  syncSession()
}

async function handleRenewSession() {
  const renewed = await renewSession()
  if (renewed) {
    session.value = renewed
    sessionAlert.value = ''
    syncSession()
  } else {
    sessionAlert.value =
      'No se pudo renovar la sesión con el servidor. Guarda tu trabajo y vuelve a iniciar sesión.'
  }
}

function logout() {
  signOut('Cierre manual desde barra superior')
  session.value = null
  remainingMs.value = 0
  sessionAlert.value = ''
  router.push({ name: 'login' })
}

watch(() => route.fullPath, syncSession)

onMounted(() => {
  syncSession()
  expiryTimer = window.setInterval(syncSession, 5_000)
  window.addEventListener('pointerdown', registerActivity)
  window.addEventListener('keydown', registerActivity)
})

onUnmounted(() => {
  window.clearInterval(expiryTimer)
  window.removeEventListener('pointerdown', registerActivity)
  window.removeEventListener('keydown', registerActivity)
})
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <RouterLink class="brand" to="/">
        <span class="brand-mark">A</span>
        <span>
          <strong>ASPAR</strong>
          <small>Asociación de Parkinson "Mario Lagrava"</small>
        </span>
      </RouterLink>

      <nav class="nav-links" aria-label="Navegación principal">
        <RouterLink to="/">Portal y Cronograma</RouterLink>
        <RouterLink v-if="session" to="/pacientes">Pacientes</RouterLink>
        <RouterLink v-if="session" to="/asistencia">Asistencia</RouterLink>
        <RouterLink v-if="session" to="/inventario">Inventario</RouterLink>
        <RouterLink v-if="isAdmin" to="/usuarios">Usuarios</RouterLink>
        <RouterLink v-if="isAdmin" to="/bitacora">Bitácora</RouterLink>

        <span
          v-if="session"
          class="session-badge"
          title="Tiempo restante de sesión activa (RNF-02)"
        >
          <strong>{{ session.role }}</strong> · {{ formattedRemaining }}
        </span>

        <button
          v-if="session && isExpiringSoon"
          class="button button-small button-present"
          type="button"
          @click="handleRenewSession"
        >
          Renovar sesión
        </button>

        <button v-if="session" class="link-button" @click="logout">
          Cerrar sesión
        </button>
        <RouterLink v-else to="/login">Iniciar sesión</RouterLink>
      </nav>
    </header>

    <div
      v-if="isExpiringSoon"
      class="session-banner session-banner-warning"
      role="status"
    >
      <span>
        Tu sesión expirará pronto ({{ formattedRemaining }}) por políticas de
        seguridad RNF-02.
      </span>
      <button
        class="button button-small button-primary"
        type="button"
        @click="handleRenewSession"
      >
        Mantener sesión activa
      </button>
    </div>

    <div
      v-if="sessionAlert"
      class="session-banner session-banner-expired"
      role="alert"
    >
      <span>{{ sessionAlert }}</span>
      <button
        class="button button-small button-secondary"
        type="button"
        @click="sessionAlert = ''"
      >
        Entendido
      </button>
    </div>

    <main class="page-container">
      <RouterView />
    </main>

    <footer class="site-footer">
      ASPAR · Asociación de Parkinson "Mario Lagrava" · Soluna Solutions
    </footer>
  </div>
</template>
