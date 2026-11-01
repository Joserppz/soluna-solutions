<script setup lang="ts">
import { watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'

import ToastHost from './components/ui/ToastHost.vue'
import { useApi } from './composables/useApi'

const { session } = useApi()
const route = useRoute()
const router = useRouter()

// La API respondió 401 a una petición: la sesión venció o se cerró en otra pestaña
watch(
  () => session.state.status,
  (status) => {
    const access = route.meta.access
    if (status === 'expired' && (access === 'team' || access === 'account'))
      void router.replace({
        name: 'ingresar',
        query: { motivo: 'expirada', redirect: route.fullPath },
      })
  },
)
</script>

<template>
  <RouterView />
  <ToastHost />
</template>
