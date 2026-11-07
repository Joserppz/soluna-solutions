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
    <a class="skip-link" href="#contenido">Saltar al contenido</a>
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

    <main id="contenido" class="auth__main" tabindex="-1">
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
.skip-link {
  position: absolute;
  left: var(--space-4);
  top: -4rem;
  z-index: var(--z-toast);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  box-shadow: var(--shadow-md);
  font-weight: 600;
}

.skip-link:focus {
  top: var(--space-4);
}

.auth__main:focus {
  outline: none;
}

/*
 * Escritorio y laptops (>= 900 px): la pantalla de acceso ocupa exactamente la
 * ventana, sin barra de desplazamiento. Los tamaños usan clamp(…vh…) para que el
 * formulario entre completo desde unos 680 px de alto útil; la foto de la columna
 * verde se estira o se achica con el alto disponible. Si una vista larga (crear
 * cuenta) no entra, solo se desplaza la columna del formulario.
 */
.auth {
  --auth-title-size: clamp(1.75rem, 4.6vh, 3.25rem);
  --auth-lead-size: clamp(0.95rem, 2.1vh, 1.125rem);
  --auth-header-gap: clamp(0.25rem, 1vh, 0.75rem);
  --control-height: clamp(2.5rem, 5.6vh, 3rem);
  --button-height-lg: clamp(2.6rem, 5.8vh, 3.25rem);
  --form-gap: clamp(0.6rem, 1.8vh, 1.25rem);
  --field-gap: clamp(0.3rem, 0.8vh, 0.5rem);

  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  height: 100vh;
  height: 100dvh;
  max-height: 100vh;
  max-height: 100dvh;
  overflow: hidden;
  background: var(--crema-50);
}

.auth__panel {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: clamp(1rem, 3.5vh, 2.5rem);
  min-height: 0;
  padding: clamp(1.25rem, 5vh, 3rem) clamp(var(--space-6), 5vw, var(--space-16));
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
  flex: none;
  align-self: flex-start;
  text-decoration: none;
  border-radius: var(--radius-sm);
}

.auth__brand:focus-visible {
  box-shadow: var(--focus-ring-on-dark);
}

.auth__message {
  flex: none;
  display: grid;
  gap: clamp(0.5rem, 1.6vh, 1rem);
  margin-top: clamp(0rem, 3vh, 2rem);
}

.auth__eyebrow {
  color: var(--rosa-200);
}

.auth__headline {
  font-family: var(--font-serif);
  font-size: clamp(2rem, min(1.5rem + 2.4vw, 6.2vh), 3.75rem);
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
  font-size: clamp(0.95rem, 2.2vh, 1.125rem);
}

/* La foto toma el alto que sobra: nunca empuja la página ni queda cortada */
.auth__photo {
  flex: 1 1 0;
  min-height: 0;
  width: 100%;
  max-width: 36rem;
  height: auto;
  object-fit: cover;
  border-radius: var(--radius-xl) clamp(2.5rem, 9vh, 6rem) var(--radius-xl)
    var(--radius-xl);
  box-shadow: 0 24px 48px -24px rgb(0 0 0 / 0.55);
}

/* Columna del formulario: centrada; si no entra, se desplaza solo ella */
.auth__main {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scroll-behavior: smooth;
  padding: clamp(1rem, 4vh, 3rem) clamp(var(--space-6), 4vw, var(--space-16));
}

.auth__card {
  width: 100%;
  max-width: 34rem;
  margin: auto;
  display: grid;
  gap: clamp(0.65rem, 2.1vh, 1.5rem);
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

/* Celulares y ventanas angostas: una columna con el desplazamiento natural del
   navegador, para que el teclado virtual no tape los campos */
@media (max-width: 899.98px) {
  .auth {
    --auth-title-size: var(--text-3xl);
    --auth-lead-size: var(--text-lg);
    --control-height: 3rem;
    --button-height-lg: 3.25rem;
    --form-gap: var(--space-5);

    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto auto;
    height: auto;
    max-height: none;
    min-height: 100vh;
    min-height: 100dvh;
    overflow-y: auto;
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
    overflow: visible;
    padding: var(--space-8) var(--space-4) var(--space-12);
  }

  .auth__card {
    margin: 0 auto;
  }
}

/* Tabletas y ventanas angostas pero altas (600 px de ancho o más, 640 px de alto o
   más): la pantalla también entra completa, sin barra de desplazamiento de la página.
   Solo se achica el encabezado de marca; el formulario se reparte el alto que queda.
   Celulares y ventanas más bajas siguen desplazándose con normalidad. */
@media (max-width: 899.98px) and (min-width: 600px) and (min-height: 640px) {
  .auth {
    --form-gap: clamp(0.45rem, 1.4vh, 1rem);
    --field-gap: clamp(0.25rem, 0.6vh, 0.4rem);
    --control-height: clamp(2.25rem, 4.6vh, 2.75rem);
    --button-height-lg: clamp(2.4rem, 5vh, 2.9rem);
    --auth-title-size: clamp(1.6rem, 4.2vh, 2.25rem);
    --auth-lead-size: clamp(0.9rem, 2vh, 1rem);
    --auth-header-gap: clamp(0.2rem, 0.8vh, 0.5rem);

    grid-template-rows: auto minmax(0, 1fr);
    height: 100vh;
    height: 100dvh;
    max-height: 100vh;
    max-height: 100dvh;
    min-height: 0;
    overflow: hidden;
  }

  .auth__panel {
    gap: 0;
    padding: clamp(0.75rem, 2.4vh, 1.5rem) var(--space-6);
  }

  /* Solo queda la marca: el título ya lo dice cada pantalla */
  .auth__message {
    display: none;
  }

  .auth__main {
    min-height: 0;
    overflow-y: auto;
    padding: clamp(0.4rem, 1.5vh, 1.25rem) var(--space-6);
  }

  .auth__card {
    gap: clamp(0.4rem, 1.3vh, 0.9rem);
    margin: auto;
  }
}
</style>
