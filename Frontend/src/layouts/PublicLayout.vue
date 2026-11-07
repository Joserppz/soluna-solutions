<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'

import AsparBrand from '../components/AsparBrand.vue'
import SiteLink from '../components/public/SiteLink.vue'
import AppButton from '../components/ui/AppButton.vue'
import { useApi } from '../composables/useApi'
import { useSiteContent } from '../composables/useSiteContent'
import { useToast } from '../composables/useToast'
import { firstName } from '../utils/format'
import { contactLines, socialLinks } from '../utils/site'

/** Encabezado y pie del sitio público (diseño págs. 2 a 5), en escritorio y celular. */
const { session } = useApi()
const { content, load } = useSiteContent()
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
  { label: 'Nosotros', hash: '#nosotros' },
  { label: 'Actividades', hash: '#actividades' },
  { label: 'Cómo participar', hash: '#participar' },
  { label: 'Comunidad', hash: '#comunidad' },
]

const networks = computed(() => socialLinks(content.value))
const contacts = computed(() => contactLines(content.value))
const year = new Date().getFullYear()

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

onMounted(load)
</script>

<template>
  <div class="public">
    <a class="skip" href="#contenido">Ir al contenido</a>
    <header class="site-header" :class="{ 'is-open': menuOpen }">
      <div class="site-header__inner">
        <SiteLink :to="{ name: 'inicio' }" class="site-header__brand">
          <AsparBrand />
        </SiteLink>

        <button
          type="button"
          class="site-header__toggle"
          aria-controls="menu-sitio"
          :aria-expanded="menuOpen"
          @click="menuOpen = !menuOpen"
        >
          <span aria-hidden="true">{{ menuOpen ? '✕' : '☰' }}</span>
          {{ menuOpen ? 'Cerrar' : 'Menú' }}
        </button>

        <nav id="menu-sitio" class="site-nav" aria-label="Sitio de ASPAR">
          <SiteLink
            v-for="link in links"
            :key="link.hash"
            :to="{ name: 'inicio', hash: link.hash }"
            class="site-nav__link"
          >
            {{ link.label }}
          </SiteLink>
          <AppButton size="sm" :to="{ name: 'apoyar' }" class="site-nav__cta">
            Quiero ayudar
          </AppButton>
        </nav>
      </div>

      <div
        v-if="user"
        class="site-session"
        role="region"
        aria-label="Tu sesión"
      >
        <span>
          Hola, {{ firstName(user.name) }}.
          <template v-if="session.isPendingApproval.value">
            Tu cuenta espera la aprobación de Administración.
          </template>
        </span>
        <span class="site-session__actions">
          <RouterLink :to="accountLink.to">{{ accountLink.label }}</RouterLink>
          <button type="button" @click="logout">Cerrar sesión</button>
        </span>
      </div>
    </header>

    <main id="contenido" class="public-main" tabindex="-1">
      <RouterView />
    </main>

    <footer class="site-footer">
      <div class="site-footer__cols">
        <div class="site-footer__about">
          <AsparBrand tone="dark" />
          <p>Acompañamos. Nos movemos. Seguimos.</p>
          <ul v-if="contacts.length" class="site-footer__contact">
            <li v-for="line in contacts" :key="line.label">
              <span>{{ line.label }}:</span>
              <a
                v-if="line.href"
                :href="line.href"
                :target="line.href.startsWith('https') ? '_blank' : undefined"
                rel="noopener"
                >{{ line.value }}</a
              >
              <template v-else>{{ line.value }}</template>
            </li>
          </ul>
        </div>
        <nav aria-label="Conoce ASPAR">
          <h2>Conoce ASPAR</h2>
          <ul>
            <li v-for="link in links.slice(0, 3)" :key="link.hash">
              <SiteLink :to="{ name: 'inicio', hash: link.hash }">
                {{ link.label }}
              </SiteLink>
            </li>
          </ul>
        </nav>
        <nav aria-label="Apoya">
          <h2>Apoya</h2>
          <ul>
            <li>
              <SiteLink :to="{ name: 'apoyar' }">Donar</SiteLink>
            </li>
            <li>
              <SiteLink
                :to="{
                  name: 'inicio',
                  query: { motivo: 'voluntariado' },
                  hash: '#contacto',
                }"
              >
                Ser voluntario/a
              </SiteLink>
            </li>
            <li>
              <SiteLink
                :to="{
                  name: 'inicio',
                  query: { motivo: 'especie' },
                  hash: '#contacto',
                }"
              >
                Donación en especie
              </SiteLink>
            </li>
          </ul>
        </nav>
        <nav aria-label="Comunidad">
          <h2>Comunidad</h2>
          <ul>
            <li v-for="network in networks" :key="network.key">
              <a :href="network.url" target="_blank" rel="noopener">
                {{ network.label }}
              </a>
            </li>
            <li>
              <SiteLink :to="{ name: 'inicio', hash: '#comunidad' }">
                Galería
              </SiteLink>
            </li>
          </ul>
        </nav>
      </div>
      <div class="site-footer__base">
        <span>
          © {{ year }} Asociación de Parkinson «Mario Lagrava» · Bolivia
        </span>
        <RouterLink v-if="!user" :to="{ name: 'ingresar' }">
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
  background: var(--crema-100);
  --site-gutter: clamp(var(--space-4), 5.5vw, 5rem);
}

.skip {
  position: absolute;
  left: var(--space-4);
  top: -4rem;
  z-index: calc(var(--z-sticky) + 1);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-sm);
  background: var(--aspar-verde);
  color: #fff;
}

.skip:focus {
  top: var(--space-2);
}

.site-header {
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
  background: rgb(255 253 249 / 0.94);
  backdrop-filter: saturate(1.4) blur(8px);
  box-shadow: 0 1px 0 var(--color-border);
}

.site-header::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: -1px;
  width: min(14%, 12rem);
  height: 2px;
  background: var(--aspar-guindo);
}

.site-header__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-6);
  max-width: 90rem;
  margin: 0 auto;
  padding: var(--space-3) var(--site-gutter);
}

.site-header__brand {
  text-decoration: none;
  border-radius: var(--radius-sm);
}

.site-header__toggle {
  display: none;
}

.site-nav {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.site-nav__link {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-weight: 500;
  text-decoration: none;
  transition: background-color var(--duration-fast) var(--ease-out);
}

.site-nav__link:hover {
  background: rgb(7 57 48 / 0.06);
}

.site-nav__cta {
  margin-left: var(--space-3);
}

.site-session {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-2) var(--space-6);
  padding: var(--space-2) var(--space-4);
  background: var(--verde-900);
  color: rgb(255 255 255 / 0.9);
  font-size: var(--text-sm);
}

.site-session__actions {
  display: inline-flex;
  gap: var(--space-4);
}

.site-session a,
.site-session button {
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

.public-main {
  flex: 1;
  outline: none;
}

.site-footer {
  background: var(--aspar-verde);
  color: rgb(255 255 255 / 0.78);
}

.site-footer__cols {
  display: grid;
  grid-template-columns: 1.5fr repeat(3, 1fr);
  gap: var(--space-8);
  max-width: 90rem;
  margin: 0 auto;
  padding: var(--space-12) var(--site-gutter) var(--space-8);
}

.site-footer__about {
  display: grid;
  align-content: start;
  gap: var(--space-3);
}

.site-footer__about p {
  margin: 0;
}

.site-footer h2 {
  margin: 0 0 var(--space-3);
  font-family: inherit;
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: var(--tracking-eyebrow);
  text-transform: uppercase;
  color: #fff;
}

.site-footer ul {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.site-footer__contact {
  font-size: var(--text-sm);
}

.site-footer__contact span {
  margin-right: var(--space-1);
  color: rgb(255 255 255 / 0.6);
}

.site-footer a {
  color: rgb(255 255 255 / 0.86);
  text-decoration: none;
  border-radius: var(--radius-xs);
}

.site-footer a:hover {
  color: #fff;
  text-decoration: underline;
}

.site-footer a:focus-visible {
  box-shadow: var(--focus-ring-on-dark);
}

.site-footer__base {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--space-3);
  max-width: 90rem;
  margin: 0 auto;
  padding: var(--space-5) var(--site-gutter);
  border-top: 1px solid rgb(255 255 255 / 0.12);
  font-size: var(--text-sm);
}

@media (max-width: 960px) {
  .site-header__inner {
    flex-wrap: wrap;
    gap: var(--space-3);
  }

  .site-header__toggle {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 2.75rem;
    padding: 0 var(--space-4);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    color: var(--aspar-verde);
    font-weight: 600;
    cursor: pointer;
  }

  .site-nav {
    display: none;
    width: 100%;
    flex-direction: column;
    align-items: stretch;
    padding-bottom: var(--space-3);
  }

  .is-open .site-nav {
    display: flex;
  }

  .site-nav__link {
    min-height: 2.75rem;
    display: flex;
    align-items: center;
    font-size: var(--text-lg);
  }

  .site-nav__cta {
    margin: var(--space-2) 0 0;
  }

  .site-footer__cols {
    grid-template-columns: 1fr 1fr;
  }

  .site-footer__about {
    grid-column: 1 / -1;
  }
}

@media (max-width: 480px) {
  .site-header :deep(.brand__subtitle) {
    display: none;
  }
}
</style>
