<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'

import type { DashboardSummary } from '../api/types'
import AsparBrand from '../components/AsparBrand.vue'
import SessionTimeoutDialog from '../components/session/SessionTimeoutDialog.vue'
import { useApi } from '../composables/useApi'
import { useIdleSession } from '../composables/useIdleSession'
import { pageCrumb } from '../composables/usePageCrumb'
import { patientsListLocation } from '../composables/usePatientsListLocation'
import { useToast } from '../composables/useToast'
import {
  ADMIN_GROUP_TITLE,
  TEAM_SECTIONS,
  type ReviewCounter,
} from '../router/sections'
import { initials, longDate } from '../utils/format'

const { api, session } = useApi()
const route = useRoute()
const router = useRouter()
const toast = useToast()

const user = computed(() => session.state.user)
const today = longDate()
const menuOpen = ref(false)
const sidebar = ref<HTMLElement | null>(null)
const topbar = ref<HTMLElement | null>(null)
/** Alto de la barra superior (solo en pantallas angostas): ahí empiezan los encabezados fijos. */
const topbarHeight = ref(0)
let topbarResize: ResizeObserver | null = null
const counters = ref<DashboardSummary['toReview'] | null>(null)
const loggingOut = ref(false)

const visible = computed(() =>
  TEAM_SECTIONS.filter((section) => session.canAny(...section.permissions)),
)
const mainSections = computed(() => visible.value.filter((s) => !s.group))
const adminSections = computed(() =>
  visible.value.filter((s) => s.group === 'administracion'),
)
const inAdmin = computed(() =>
  adminSections.value.some((section) => section.name === route.name),
)
/** La sección de una página interna; el listado de afiliados vuelve con sus filtros. */
const sectionLocation = computed(() =>
  route.meta.section === 'afiliados'
    ? patientsListLocation()
    : { name: route.meta.section! },
)
const breadcrumb = computed(() => {
  const crumbs = route.meta.breadcrumb ?? []
  return pageCrumb.value ? [...crumbs.slice(0, -1), pageCrumb.value] : crumbs
})
const idleMinutes = computed(() =>
  Math.round((session.state.idleTimeout ?? 900) / 60),
)

function badge(counter?: ReviewCounter): number {
  if (!counter || !counters.value) return 0
  return counters.value[counter] ?? 0
}

/** «1 pendiente», «4 pendientes» (lo lee el lector de pantalla). */
function pendingLabel(count: number): string {
  return `${count} ${count === 1 ? 'pendiente' : 'pendientes'}`
}

async function loadCounters() {
  try {
    counters.value = (await api.dashboard.summary()).toReview
  } catch {
    // Las insignias son una ayuda: si fallan, el menú sigue funcionando
  }
}

async function logout() {
  loggingOut.value = true
  await session.logout()
  loggingOut.value = false
  toast.success('Cerraste sesión. ¡Hasta pronto!')
  await router.push({ name: 'ingresar' })
}

const idle = useIdleSession({
  session,
  onExpired: () => {
    void router.replace({ name: 'ingresar', query: { motivo: 'inactividad' } })
  },
})

async function toggleMenu() {
  menuOpen.value = !menuOpen.value
  if (menuOpen.value) {
    await nextTick()
    sidebar.value?.querySelector<HTMLElement>('a, button')?.focus()
  }
}

watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false
  },
)

function measureTopbar() {
  topbarHeight.value = topbar.value?.offsetHeight ?? 0
}

onMounted(() => {
  void loadCounters()
  measureTopbar()
  if (typeof ResizeObserver !== 'undefined' && topbar.value) {
    topbarResize = new ResizeObserver(measureTopbar)
    topbarResize.observe(topbar.value)
  }
})

onBeforeUnmount(() => topbarResize?.disconnect())
</script>

<template>
  <div
    class="team"
    :class="{ 'menu-open': menuOpen }"
    :style="{ '--team-sticky-top': `${topbarHeight}px` }"
  >
    <a class="skip-link" href="#contenido">Saltar al contenido</a>

    <header ref="topbar" class="team-topbar">
      <RouterLink :to="{ name: 'resumen' }" class="team-topbar__brand">
        <AsparBrand tone="dark" subtitle="Espacio del equipo" />
      </RouterLink>
      <button
        type="button"
        class="team-topbar__menu"
        aria-controls="menu-equipo"
        :aria-expanded="menuOpen"
        @click="toggleMenu"
      >
        <span class="hamburger" aria-hidden="true" />
        {{ menuOpen ? 'Cerrar' : 'Menú' }}
      </button>
    </header>

    <Transition name="scrim">
      <div v-if="menuOpen" class="team-scrim" @click="menuOpen = false" />
    </Transition>

    <aside
      id="menu-equipo"
      ref="sidebar"
      class="sidebar"
      aria-label="Menú del espacio del equipo"
      @keydown.esc="menuOpen = false"
    >
      <RouterLink :to="{ name: 'resumen' }" class="sidebar__brand">
        <AsparBrand tone="dark" subtitle="Espacio del equipo" />
      </RouterLink>
      <div class="sidebar__drawer-head">
        <span>Menú</span>
        <button
          type="button"
          class="sidebar__close"
          aria-label="Cerrar el menú"
          @click="menuOpen = false"
        >
          ×
        </button>
      </div>

      <nav class="sidebar__nav" aria-label="Secciones">
        <ul>
          <li>
            <RouterLink
              :to="{ name: 'resumen' }"
              class="nav-item"
              exact-active-class="is-active"
            >
              Resumen
            </RouterLink>
          </li>
          <li v-for="section in mainSections" :key="section.name">
            <RouterLink
              :to="{ name: section.name }"
              class="nav-item"
              :class="{ 'is-active': route.meta.section === section.name }"
              active-class="is-active"
            >
              <span>{{ section.title }}</span>
              <template v-if="badge(section.badge)">
                <span class="nav-item__badge" aria-hidden="true">
                  {{ badge(section.badge) }}
                </span>
                <span class="visually-hidden">
                  ({{ pendingLabel(badge(section.badge)) }})
                </span>
              </template>
            </RouterLink>
          </li>
          <li v-if="adminSections.length">
            <RouterLink
              :to="{ name: adminSections[0]!.name }"
              class="nav-item"
              :class="{ 'is-active': inAdmin }"
            >
              {{ ADMIN_GROUP_TITLE }}
            </RouterLink>
            <ul v-if="inAdmin" class="nav-sub">
              <li v-for="section in adminSections" :key="section.name">
                <RouterLink
                  :to="{ name: section.name }"
                  class="nav-item nav-item--sub"
                  active-class="is-active"
                >
                  {{ section.title }}
                </RouterLink>
              </li>
            </ul>
          </li>
        </ul>
      </nav>

      <hr class="sidebar__divider" />

      <ul class="sidebar__secondary">
        <li>
          <RouterLink :to="{ name: 'inicio' }" class="nav-link">
            <span aria-hidden="true">↗</span> Ver sitio público
          </RouterLink>
        </li>
        <li>
          <button
            type="button"
            class="nav-link"
            :disabled="loggingOut"
            @click="logout"
          >
            Cerrar sesión
          </button>
        </li>
      </ul>

      <div v-if="user" class="sidebar__user">
        <span class="avatar" aria-hidden="true">{{ initials(user.name) }}</span>
        <span class="sidebar__user-text">
          <strong>{{ user.name }}</strong>
          <small>{{ user.roleName }}</small>
          <RouterLink
            :to="{ name: 'cambiar-contrasena' }"
            class="sidebar__user-link"
          >
            Cambiar contraseña
          </RouterLink>
        </span>
      </div>
    </aside>

    <div class="team-main">
      <div class="team-header">
        <nav aria-label="Estás en">
          <ol class="breadcrumb">
            <li>Espacio del equipo</li>
            <li
              v-for="(crumb, index) in breadcrumb"
              :key="crumb"
              :aria-current="
                index === breadcrumb.length - 1 ? 'page' : undefined
              "
            >
              <!-- En una página interna (una ficha), su sección lleva de vuelta -->
              <RouterLink
                v-if="
                  index === 0 && breadcrumb.length > 1 && route.meta.section
                "
                :to="sectionLocation"
                class="breadcrumb__link"
              >
                {{ crumb }}
              </RouterLink>
              <template v-else>{{ crumb }}</template>
            </li>
          </ol>
        </nav>
        <p class="team-header__date">{{ today }}</p>
      </div>

      <main id="contenido" class="team-content" tabindex="-1">
        <RouterView v-slot="{ Component, route: current }">
          <Transition name="page" mode="out-in">
            <component :is="Component" :key="current.path" />
          </Transition>
        </RouterView>
      </main>
    </div>

    <SessionTimeoutDialog
      :open="idle.warningOpen.value"
      :remaining-ms="idle.remainingMs.value"
      :idle-minutes="idleMinutes"
      :keep-alive="idle.keepAlive"
      @logout="logout"
    />
  </div>
</template>

<style scoped>
.team {
  min-height: 100vh;
  display: grid;
  grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
  align-content: start;
  background: var(--color-bg);
}

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

/* Barra superior: solo en pantallas angostas */
.team-topbar {
  display: none;
}

.sidebar {
  position: sticky;
  top: 0;
  align-self: start;
  height: 100vh;
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding: var(--space-6) var(--space-5);
  overflow-y: auto;
  background:
    radial-gradient(
      120% 60% at 0% 100%,
      rgb(255 255 255 / 0.04),
      transparent 60%
    ),
    var(--verde-900);
  color: #fff;
  box-shadow: inset -1px 0 0 rgb(255 255 255 / 0.04);
}

.sidebar__brand {
  padding: 0 var(--space-2);
  border-radius: var(--radius-sm);
  text-decoration: none;
}

.sidebar a:focus-visible,
.sidebar button:focus-visible {
  box-shadow: var(--focus-ring-on-dark);
}

.sidebar ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--space-1);
}

.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  min-height: 2.75rem;
  padding: 0 var(--space-4);
  border-radius: var(--radius-sm);
  color: rgb(255 255 255 / 0.86);
  font-size: var(--text-lg);
  text-decoration: none;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}

.nav-item:hover {
  background: rgb(255 255 255 / 0.06);
  color: #fff;
}

.nav-item.is-active {
  background: rgb(255 255 255 / 0.1);
  color: #fff;
  font-weight: 600;
}

.nav-item.is-active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.65rem;
  bottom: 0.65rem;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: #e0474a;
}

.nav-item--sub {
  min-height: 2.6rem;
  padding-left: var(--space-8);
  font-size: var(--text-md);
}

.nav-sub {
  margin-top: var(--space-1) !important;
}

.nav-item__badge {
  display: grid;
  place-items: center;
  min-width: 1.5rem;
  height: 1.5rem;
  padding: 0 var(--space-1);
  border-radius: var(--radius-pill);
  background: var(--aspar-rojo);
  color: #fff;
  font-size: var(--text-xs);
  font-weight: 700;
  box-shadow: 0 0 0 2px rgb(7 57 48 / 0.6);
}

.sidebar__drawer-head {
  display: none;
}

.sidebar__divider {
  margin: 0 var(--space-2);
  border: 0;
  border-top: 1px solid rgb(255 255 255 / 0.12);
}

.nav-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: rgb(255 255 255 / 0.82);
  font-size: var(--text-md);
  text-decoration: none;
  cursor: pointer;
}

.nav-link:hover {
  color: #fff;
  background: rgb(255 255 255 / 0.06);
}

.sidebar__user {
  margin-top: auto;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  border-radius: var(--radius-md);
  background: rgb(255 255 255 / 0.07);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.05);
}

.avatar {
  flex: none;
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  background: var(--rosa-100);
  color: var(--guindo-700);
  font-weight: 700;
  font-size: var(--text-sm);
}

.sidebar__user-text {
  display: grid;
  min-width: 0;
  line-height: 1.3;
}

.sidebar__user-text strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar__user-text small {
  color: rgb(255 255 255 / 0.7);
  font-size: var(--text-sm);
}

.sidebar__user-link {
  margin-top: var(--space-1);
  color: var(--rosa-200);
  font-size: var(--text-sm);
}

.team-main {
  min-width: 0;
  padding: var(--space-8) clamp(var(--space-4), 4vw, var(--space-12))
    var(--space-16);
}

.team-header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--space-2) var(--space-6);
  max-width: var(--content-max);
  margin: 0 auto var(--space-6);
  color: var(--color-text-muted);
  font-size: var(--text-md);
}

.breadcrumb {
  display: flex;
  flex-wrap: wrap;
  list-style: none;
  margin: 0;
  padding: 0;
}

.breadcrumb li + li::before {
  content: '/';
  margin: 0 0.4em;
  color: var(--color-text-subtle);
}

.breadcrumb__link {
  color: var(--color-link);
  font-weight: 600;
  text-decoration: underline;
  text-decoration-color: rgb(109 22 25 / 0.3);
  text-underline-offset: 0.2em;
}

.breadcrumb__link:hover {
  text-decoration-color: currentColor;
}

.breadcrumb [aria-current='page'] {
  color: var(--color-text);
}

.team-content {
  max-width: var(--content-max);
  margin: 0 auto;
}

.team-content:focus {
  outline: none;
}

/* Tabletas y celulares: el menú se abre como panel lateral */
/* Ventana completa (escritorio y laptops): la página no se desplaza. Cada vista ocupa
   el alto que queda y reparte su espacio; si algo no entra, solo se desplaza su
   contenido (una sola barra). Mismo criterio que useFitLayout(). */
@media (min-width: 1024px) and (min-height: 560px) {
  .team {
    height: 100dvh;
    min-height: 0;
    overflow: hidden;
  }

  .team-main {
    display: flex;
    flex-direction: column;
    height: 100dvh;
    min-height: 0;
    overflow: hidden;
    padding-block: clamp(var(--space-3), 2.6vh, var(--space-8))
      clamp(var(--space-3), 2.2vh, var(--space-6));
  }

  .team-header {
    flex: none;
    width: 100%;
    margin-bottom: clamp(var(--space-2), 1.6vh, var(--space-5));
  }

  .team-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    width: 100%;
    min-height: 0;
    overflow-y: auto;
  }

  .team-content > :deep(*) {
    flex: 1;
    min-height: 0;
  }
}

/* Laptops (alto útil de ~600 a ~800 px): campos y botones un poco más bajos */
@media (min-width: 1024px) and (min-height: 560px) and (max-height: 860px) {
  .team {
    --control-height: 2.6rem;
    --field-gap: 0.35rem;
    --form-gap: var(--space-3);
  }
}

/* Ventanas bajas (1366×768): el menú entra completo y no tiene su propia barra */
@media (min-width: 1024px) and (max-height: 860px) {
  .sidebar {
    gap: var(--space-3);
    padding-block: var(--space-4);
  }

  .sidebar ul {
    gap: 2px;
  }

  .nav-item {
    min-height: 2.3rem;
    font-size: var(--text-md);
  }

  .nav-item--sub {
    min-height: 2.1rem;
  }

  .nav-link {
    padding-block: var(--space-1);
  }

  .sidebar__user {
    padding: var(--space-3);
  }
}

@media (max-width: 1023px) {
  .team {
    grid-template-columns: minmax(0, 1fr);
  }

  .team-topbar {
    position: sticky;
    top: 0;
    z-index: var(--z-sticky);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-3) var(--space-4);
    background: var(--verde-900);
    box-shadow: var(--shadow-md);
  }

  .team-topbar__brand {
    text-decoration: none;
  }

  .team-topbar__brand :deep(.brand__subtitle) {
    display: none;
  }

  .team-topbar__menu {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 2.75rem;
    padding: 0 var(--space-4);
    border: 1px solid rgb(255 255 255 / 0.3);
    border-radius: var(--radius-sm);
    background: transparent;
    color: #fff;
    font-weight: 600;
    cursor: pointer;
  }

  .team-topbar__menu:focus-visible {
    box-shadow: var(--focus-ring-on-dark);
  }

  .hamburger,
  .hamburger::before,
  .hamburger::after {
    display: block;
    width: 1rem;
    height: 2px;
    border-radius: 2px;
    background: currentColor;
  }

  .hamburger {
    position: relative;
  }

  .hamburger::before,
  .hamburger::after {
    content: '';
    position: absolute;
    left: 0;
  }

  .hamburger::before {
    top: -5px;
  }

  .hamburger::after {
    top: 5px;
  }

  .sidebar {
    position: fixed;
    inset: 0 auto 0 0;
    z-index: var(--z-drawer);
    width: min(var(--sidebar-width), 86vw);
    transform: translateX(-100%);
    visibility: hidden;
    transition:
      transform var(--duration-slow) var(--ease-out),
      visibility var(--duration-slow);
    box-shadow: var(--shadow-lg);
  }

  .menu-open .sidebar {
    transform: none;
    visibility: visible;
  }

  .sidebar__brand {
    display: none;
  }

  .sidebar__drawer-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 var(--space-2) 0 var(--space-4);
    color: rgb(255 255 255 / 0.7);
    font-size: var(--text-sm);
    font-weight: 700;
    letter-spacing: var(--tracking-eyebrow);
    text-transform: uppercase;
  }

  .sidebar__close {
    display: grid;
    place-items: center;
    width: 2.75rem;
    height: 2.75rem;
    border: 0;
    border-radius: var(--radius-sm);
    background: rgb(255 255 255 / 0.08);
    color: #fff;
    font-size: 1.5rem;
    cursor: pointer;
  }

  .team-scrim {
    position: fixed;
    inset: 0;
    z-index: calc(var(--z-drawer) - 1);
    background: var(--color-overlay);
  }

  .team-main {
    padding-top: var(--space-6);
  }
}

.scrim-enter-active,
.scrim-leave-active {
  transition: opacity var(--duration-base) var(--ease-out);
}

.scrim-enter-from,
.scrim-leave-to {
  opacity: 0;
}
</style>
