<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { getSession, signOut, touchSession, type Session } from './services/aspar'

const route = useRoute()
const router = useRouter()
const session = ref<Session | null>(getSession())
let expiryTimer = 0

const isAdmin = computed(() => session.value?.role === 'Administrador')

function syncSession() {
  session.value = getSession()

  if (!session.value && route.meta.requiresAuth) {
    router.replace({ name: 'login' })
  }
}

function registerActivity() {
  if (!session.value) return
  touchSession()
  session.value = getSession()
}

function logout() {
  signOut()
  session.value = null
  router.push({ name: 'login' })
}

watch(() => route.fullPath, syncSession)

onMounted(() => {
  expiryTimer = window.setInterval(syncSession, 10_000)
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
        <span><strong>ASPAR</strong><small>Fundación de apoyo</small></span>
      </RouterLink>

      <nav class="nav-links" aria-label="Navegación principal">
        <RouterLink to="/">Cronograma</RouterLink>
        <RouterLink v-if="session" to="/pacientes">Pacientes</RouterLink>
        <RouterLink v-if="session" to="/asistencia">Asistencia</RouterLink>
        <RouterLink v-if="isAdmin" to="/usuarios">Usuarios</RouterLink>
        <RouterLink v-if="isAdmin" to="/bitacora">Bitácora</RouterLink>
        <button v-if="session" class="link-button" @click="logout">
          Cerrar sesión
        </button>
        <RouterLink v-else to="/login">Iniciar sesión</RouterLink>
      </nav>
    </header>

    <main class="page-container">
      <RouterView />
    </main>

    <footer class="site-footer">
      ASPAR · Fundación de apoyo a personas con Parkinson
    </footer>
  </div>
</template>