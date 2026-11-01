<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'

import AsparBrand from '../components/AsparBrand.vue'
import AppButton from '../components/ui/AppButton.vue'
import { useApi } from '../composables/useApi'
import { useToast } from '../composables/useToast'
import { firstName } from '../utils/format'

const { session } = useApi()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const menuOpen = ref(false)

const user = computed(() => session.state.user)
const accountLink = computed(() =>
  session.isPendingApproval.value
    ? { label: 'Mi cuenta', to: { name: 'cuenta-pendiente' } }
    : { label: 'Espacio del equipo', to: { name: 'resumen' } },
)

const links = [
  { label: 'Nosotros', hash: '' },
  { label: 'Actividades', hash: '#cronograma' },
  { label: 'Comunidad', hash: '#galeria' },
]

async function logout() {
  await session.logout()
  toast.success('Cerraste sesión. ¡Hasta pronto!')
  await router.push({ name: 'inicio' })
}

watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false
  },
)
</script>

<template>
  <div class="public">
    <header class="public-header">
      <div class="public-header__inner">
        <RouterLink :to="{ name: 'inicio' }" class="public-header__brand">
          <AsparBrand />
        </RouterLink>

        <button
          type="button"
          class="public-header__toggle"
          aria-controls="menu-sitio"
          :aria-expanded="menuOpen"
          @click="menuOpen = !menuOpen"
        >
          {{ menuOpen ? 'Cerrar' : 'Menú' }}
        </button>

        <nav
          id="menu-sitio"
          class="public-nav"
          :class="{ 'is-open': menuOpen }"
          aria-label="Sitio de ASPAR"
        >
          <RouterLink
            v-for="link in links"
            :key="link.label"
            :to="{ name: 'inicio', hash: link.hash }"
            class="public-nav__link"
          >
            {{ link.label }}
          </RouterLink>
          <AppButton
            size="sm"
            :to="{ name: 'inicio', hash: '#donar' }"
            class="public-nav__cta"
          >
            Quiero ayudar
          </AppButton>
        </nav>
      </div>

      <div
        v-if="user"
        class="public-session"
        role="region"
        aria-label="Tu sesión"
      >
        <span>
          Hola, {{ firstName(user.name) }}.
          <template v-if="session.isPendingApproval.value">
            Tu cuenta espera la aprobación de Administración.
          </template>
        </span>
        <span class="public-session__actions">
          <RouterLink :to="accountLink.to">{{ accountLink.label }}</RouterLink>
          <button type="button" @click="logout">Cerrar sesión</button>
        </span>
      </div>
    </header>

    <!-- La portada actual conserva sus estilos hasta que se rehaga con el diseño (F5b) -->
    <div class="legacy-scope public-content">
      <main class="page-container">
        <RouterView />
      </main>
    </div>

    <footer class="public-footer">
      <div class="public-footer__inner">
        <div class="public-footer__about">
          <AsparBrand tone="dark" />
          <p>Acompañamos. Nos movemos. Seguimos.</p>
        </div>
        <p class="public-footer__legal">
          © {{ new Date().getFullYear() }} Asociación de Parkinson «Mario
          Lagrava» · Bolivia
        </p>
        <RouterLink
          v-if="!user"
          :to="{ name: 'ingresar' }"
          class="public-footer__team"
        >
          Acceso del equipo
        </RouterLink>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.public {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--crema-50);
}

.public-header {
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
  background: rgb(250 248 243 / 0.92);
  backdrop-filter: saturate(1.4) blur(8px);
  box-shadow: 0 1px 0 var(--color-border);
}

.public-header__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-6);
  max-width: var(--content-max);
  margin: 0 auto;
  padding: var(--space-3) clamp(var(--space-4), 4vw, var(--space-12));
}

.public-header__brand {
  text-decoration: none;
  border-radius: var(--radius-sm);
}

.public-header__toggle {
  display: none;
}

.public-nav {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.public-nav__link {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-weight: 500;
  text-decoration: none;
  transition: background-color var(--duration-fast) var(--ease-out);
}

.public-nav__link:hover {
  background: rgb(7 57 48 / 0.06);
}

.public-nav__cta {
  margin-left: var(--space-2);
}

.public-session {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-2) var(--space-6);
  padding: var(--space-2) var(--space-4);
  background: var(--verde-900);
  color: rgb(255 255 255 / 0.9);
  font-size: var(--text-sm);
}

.public-session__actions {
  display: inline-flex;
  gap: var(--space-4);
}

.public-session a,
.public-session button {
  border: 0;
  background: none;
  padding: 0;
  color: #fff;
  font-weight: 600;
  font-size: inherit;
  text-decoration: underline;
  text-underline-offset: 0.2em;
  cursor: pointer;
}

.public-content {
  flex: 1;
}

.public-footer {
  background: var(--verde-900);
  color: rgb(255 255 255 / 0.82);
}

.public-footer__inner {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-6);
  max-width: var(--content-max);
  margin: 0 auto;
  padding: var(--space-10) clamp(var(--space-4), 4vw, var(--space-12));
}

.public-footer__about {
  display: grid;
  gap: var(--space-3);
}

.public-footer__legal {
  font-size: var(--text-sm);
}

.public-footer__team {
  color: #fff;
  font-size: var(--text-sm);
  font-weight: 600;
}

.public-footer a:focus-visible {
  box-shadow: var(--focus-ring-on-dark);
}

@media (max-width: 760px) {
  .public-header__inner {
    flex-wrap: wrap;
  }

  .public-header__toggle {
    display: inline-flex;
    align-items: center;
    min-height: 2.75rem;
    padding: 0 var(--space-4);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    font-weight: 600;
    cursor: pointer;
  }

  .public-nav {
    display: none;
    width: 100%;
    flex-direction: column;
    align-items: stretch;
    padding-bottom: var(--space-3);
  }

  .public-nav.is-open {
    display: flex;
  }

  .public-nav__cta {
    margin: var(--space-2) 0 0;
  }
}
</style>
