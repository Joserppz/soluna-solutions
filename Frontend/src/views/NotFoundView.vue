<script setup lang="ts">
import { RouterLink } from 'vue-router'

import AsparBrand from '../components/AsparBrand.vue'
import AppButton from '../components/ui/AppButton.vue'
import { useApi } from '../composables/useApi'

/** Página 404 con los colores del sitio: un camino que se perdió y la vuelta a casa. */
const { session } = useApi()
</script>

<template>
  <div class="lost">
    <a class="lost__skip" href="#contenido">Saltar al contenido</a>
    <header class="lost__top">
      <RouterLink :to="{ name: 'inicio' }" class="lost__brand">
        <AsparBrand />
      </RouterLink>
    </header>

    <main id="contenido" class="lost__main" tabindex="-1">
      <svg
        class="lost__art"
        viewBox="0 0 320 170"
        aria-hidden="true"
        focusable="false"
      >
        <path
          class="lost__trail"
          d="M14 150c40-6 62-34 92-34s38 26 70 22 40-46 70-62 52-8 60-18"
        />
        <circle class="lost__start" cx="14" cy="150" r="7" />
        <g class="lost__pin" transform="translate(286 18)">
          <path
            d="M18 0C8 0 0 8 0 18c0 13 18 30 18 30s18-17 18-30C36 8 28 0 18 0z"
          />
          <text x="18" y="25" text-anchor="middle">?</text>
        </g>
      </svg>

      <span class="eyebrow">Error 404</span>
      <h1>Esta página se nos <em>perdió en el camino.</em></h1>
      <p class="lost__lead">
        Puede que el enlace esté incompleto o que la página ya no exista. Te
        ayudamos a volver.
      </p>

      <div class="lost__actions">
        <AppButton :to="{ name: 'inicio' }">Ir al inicio</AppButton>
        <AppButton
          v-if="session.isAuthenticated.value"
          variant="secondary"
          :to="{ name: 'resumen' }"
        >
          Volver al espacio del equipo
        </AppButton>
        <AppButton v-else variant="secondary" :to="{ name: 'apoyar' }">
          Apoya a ASPAR
        </AppButton>
      </div>

      <p class="lost__help">
        ¿Buscabas algo en particular?
        <RouterLink :to="{ name: 'inicio', hash: '#contacto' }"
          >Escríbenos</RouterLink
        >
        y te respondemos.
      </p>
    </main>
  </div>
</template>

<style scoped>
.lost {
  min-height: 100vh;
  display: grid;
  grid-template-rows: auto 1fr;
  background:
    radial-gradient(60% 50% at 100% 0%, rgb(246 231 227 / 0.9), transparent),
    radial-gradient(50% 45% at 0% 100%, rgb(7 57 48 / 0.06), transparent),
    var(--color-bg);
}

.lost__skip {
  position: absolute;
  left: var(--space-4);
  top: -4rem;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  box-shadow: var(--shadow-md);
  font-weight: 600;
}

.lost__skip:focus {
  top: var(--space-4);
}

.lost__top {
  padding: var(--space-5) clamp(var(--space-4), 5.5vw, 5rem);
}

.lost__brand {
  display: inline-block;
  border-radius: var(--radius-sm);
  text-decoration: none;
}

.lost__main {
  display: grid;
  align-content: center;
  justify-items: center;
  gap: var(--space-4);
  max-width: 44rem;
  margin: 0 auto;
  padding: var(--space-6) var(--space-4) var(--space-16);
  text-align: center;
  outline: none;
}

.lost__art {
  width: min(20rem, 80vw);
  height: auto;
  margin-bottom: var(--space-2);
}

.lost__trail {
  fill: none;
  stroke: var(--aspar-verde);
  stroke-width: 4;
  stroke-linecap: round;
  stroke-dasharray: 2 12;
  opacity: 0.55;
}

.lost__start {
  fill: var(--aspar-verde);
}

.lost__pin path {
  fill: var(--aspar-guindo);
}

.lost__pin text {
  fill: #fff;
  font-size: 20px;
  font-weight: 700;
  font-family: inherit;
}

.lost h1 {
  margin: 0;
  font-size: clamp(2rem, 1rem + 2.8vw, 3.2rem);
  font-weight: 400;
  line-height: 1.1;
  color: var(--color-heading);
}

.lost h1 em {
  color: var(--aspar-guindo);
}

.lost__lead {
  max-width: 34rem;
  margin: 0;
  font-size: var(--text-lg);
  color: var(--color-text-muted);
}

.lost__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-3);
  margin-top: var(--space-3);
}

.lost__help {
  margin: var(--space-2) 0 0;
  color: var(--color-text-muted);
}
</style>
