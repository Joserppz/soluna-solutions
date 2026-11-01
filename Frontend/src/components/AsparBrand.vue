<script setup lang="ts">
import markOnDark from '../assets/brand/marca-fondo-oscuro.webp'
import markOnLight from '../assets/brand/marca-fondo-claro.webp'

withDefaults(
  defineProps<{
    /** Fondo sobre el que se muestra: cambia el color de la curva del logo. */
    tone?: 'dark' | 'light'
    subtitle?: string
  }>(),
  { tone: 'light', subtitle: 'Asociación de Parkinson «Mario Lagrava»' },
)
</script>

<template>
  <span class="brand" :class="`brand--${tone}`">
    <img
      class="brand__mark"
      :src="tone === 'dark' ? markOnDark : markOnLight"
      alt=""
      width="28"
      height="40"
    />
    <span class="brand__text">
      <strong class="brand__name">ASPAR</strong>
      <small class="brand__subtitle">{{ subtitle }}</small>
    </span>
  </span>
</template>

<style scoped>
.brand {
  display: inline-flex;
  align-items: center;
  gap: var(--space-3);
  text-decoration: none;
}

.brand__mark {
  width: auto;
  height: 2.5rem;
  object-fit: contain;
}

.brand__text {
  display: grid;
  line-height: 1.15;
}

.brand__name {
  font-weight: 700;
  font-size: var(--text-xl);
  letter-spacing: 0.06em;
}

.brand__subtitle {
  font-size: var(--text-sm);
}

.brand--dark .brand__name {
  color: #fff;
}

.brand--dark .brand__subtitle {
  color: rgb(255 255 255 / 0.72);
}

.brand--light .brand__name {
  color: var(--aspar-verde);
}

.brand--light .brand__subtitle {
  color: var(--color-text-muted);
}
</style>
