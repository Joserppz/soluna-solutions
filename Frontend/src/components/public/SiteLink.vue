<script setup lang="ts">
import { RouterLink, type RouteLocationRaw } from 'vue-router'

/**
 * Enlace del sitio a una sección de la portada («/#actividades») o a otra página. A
 * diferencia de RouterLink, no se marca como «página actual» solo porque la ruta es
 * la misma: todas las secciones de la portada comparten «/».
 */
defineProps<{ to: RouteLocationRaw }>()
</script>

<template>
  <RouterLink v-slot="{ href, navigate }" :to="to" custom>
    <a :href="href" v-bind="$attrs" @click="navigate"><slot /></a>
  </RouterLink>
</template>
