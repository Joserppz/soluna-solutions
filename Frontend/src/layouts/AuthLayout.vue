<script setup lang="ts">
import { RouterLink } from 'vue-router'

import photo from '../assets/acceso-equipo.webp'
import AsparBrand from '../components/AsparBrand.vue'

withDefaults(
  defineProps<{
    eyebrow?: string
    /** Primera parte del titular, en recto. */
    headline?: string
    /** Final del titular, en cursiva rosa. */
    accent?: string
    intro?: string
    /** Enlace «Volver»: al sitio (por defecto) o a otra pantalla. */
    backLabel?: string
    backTo?: string | { name: string }
  }>(),
  {
    eyebrow: 'Espacio del equipo',
    headline: 'Cuidar también es',
    accent: 'proteger la información.',
    intro:
      'Un espacio de trabajo para quienes acompañan a la comunidad cada sábado.',
    backLabel: 'Volver al sitio',
    backTo: () => ({ name: 'inicio' }),
  },
)
</script>

<template>
  <div class="auth">
    <aside class="auth__panel">
      <RouterLink :to="{ name: 'inicio' }" class="auth__brand">
        <AsparBrand tone="dark" />
      </RouterLink>
      <div class="auth__message">
        <span class="eyebrow auth__eyebrow">{{ eyebrow }}</span>
        <p class="auth__headline">
          {{ headline }}
          <em>{{ accent }}</em>
        </p>
        <p class="auth__intro">{{ intro }}</p>
      </div>
      <img
        class="auth__photo"
        :src="photo"
        alt="Personas de la asociación pintando juntas en un taller de arteterapia."
        width="900"
        height="517"
      />
    </aside>

    <main class="auth__main">
      <div class="auth__card">
        <RouterLink :to="backTo" class="auth__back">
          <span aria-hidden="true">←</span> {{ backLabel }}
        </RouterLink>
        <slot />
      </div>
    </main>
  </div>
</template>

<style scoped>
.auth {
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  background: var(--crema-50);
}

.auth__panel {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-10);
  padding: var(--space-12) clamp(var(--space-6), 5vw, var(--space-16));
  overflow: hidden;
  background:
    radial-gradient(
      80% 50% at 85% 95%,
      rgb(255 255 255 / 0.05),
      transparent 70%
    ),
    var(--verde-900);
  color: #fff;
}

.auth__brand {
  align-self: flex-start;
  text-decoration: none;
  border-radius: var(--radius-sm);
}

.auth__brand:focus-visible {
  box-shadow: var(--focus-ring-on-dark);
}

.auth__message {
  display: grid;
  gap: var(--space-4);
  margin-top: var(--space-8);
}

.auth__eyebrow {
  color: var(--rosa-200);
}

.auth__headline {
  font-family: var(--font-serif);
  font-size: clamp(2.25rem, 1.5rem + 2.4vw, 3.75rem);
  line-height: 1.08;
  letter-spacing: -0.01em;
}

.auth__headline em {
  display: block;
  color: #e8b7aa;
}

.auth__intro {
  max-width: 34rem;
  color: rgb(255 255 255 / 0.85);
  font-size: var(--text-lg);
}

.auth__photo {
  width: 100%;
  max-width: 36rem;
  aspect-ratio: 900 / 517;
  object-fit: cover;
  border-radius: var(--radius-xl) 6rem var(--radius-xl) var(--radius-xl);
  box-shadow: 0 24px 48px -24px rgb(0 0 0 / 0.55);
}

.auth__main {
  display: grid;
  place-items: center;
  padding: var(--space-12) var(--space-6);
}

.auth__card {
  width: 100%;
  max-width: 34rem;
  display: grid;
  gap: var(--space-6);
  animation: auth-in var(--duration-slow) var(--ease-out);
}

.auth__back {
  justify-self: start;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding-bottom: var(--space-1);
  border-bottom: 1px solid var(--color-border-strong);
  color: var(--color-text);
  font-weight: 600;
  text-decoration: none;
}

.auth__back:hover {
  border-bottom-color: currentColor;
}

@keyframes auth-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}

@media (max-width: 960px) {
  .auth {
    grid-template-columns: minmax(0, 1fr);
  }

  .auth__panel {
    gap: var(--space-6);
    padding: var(--space-6);
  }

  .auth__message {
    margin-top: 0;
  }

  .auth__headline {
    font-size: var(--text-3xl);
  }

  .auth__photo,
  .auth__intro {
    display: none;
  }

  .auth__main {
    place-items: start center;
    padding: var(--space-8) var(--space-4) var(--space-12);
  }
}
</style>
