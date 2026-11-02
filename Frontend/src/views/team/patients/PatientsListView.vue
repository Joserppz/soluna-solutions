<script setup lang="ts">
/**
 * Afiliados (diseño pág. 8): pestañas con contadores, búsqueda por nombre o carnet,
 * filtro por actividad, orden y paginación real. Pestaña, filtros y página viven en la
 * dirección, así que «Atrás» y recargar no pierden la búsqueda.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter, type LocationQuery } from 'vue-router'

import { isApiError } from '../../../api/errors'
import type {
  ActivityTag,
  PatientCounts,
  PatientGroup,
  PatientOrder,
  PatientOut,
  PatientPage,
  PatientSummary,
} from '../../../api/types'
import RegisterPatientDialog from '../../../components/patients/RegisterPatientDialog.vue'
import AppAlert from '../../../components/ui/AppAlert.vue'
import AppButton from '../../../components/ui/AppButton.vue'
import AppPagination from '../../../components/ui/AppPagination.vue'
import AppTabs, { type TabItem } from '../../../components/ui/AppTabs.vue'
import DataTable, { type Column } from '../../../components/ui/DataTable.vue'
import InitialsAvatar from '../../../components/ui/InitialsAvatar.vue'
import PageHeader from '../../../components/ui/PageHeader.vue'
import StatusBadge from '../../../components/ui/StatusBadge.vue'
import StickyHeader from '../../../components/ui/StickyHeader.vue'
import { useApi } from '../../../composables/useApi'
import { rememberPatientsList } from '../../../composables/usePatientsListLocation'
import { useToast } from '../../../composables/useToast'
import {
  activitiesLabel,
  formatCi,
  normalizeSearch,
  sinceLabel,
} from '../../../utils/patients'

type Category = ActivityTag['category']

const PAGE_SIZE = 10
const SEARCH_DELAY = 300

const { api, session } = useApi()
const route = useRoute()
const router = useRouter()
const toast = useToast()

// Nombres en la dirección (en castellano) ↔ valores de la API
const GROUPS: Record<string, PatientGroup> = {
  todos: 'all',
  activos: 'active',
  'consentimiento-pendiente': 'consent_pending',
  inactivos: 'inactive',
}
const ORDERS: Record<string, PatientOrder> = {
  'nombre-az': 'name',
  'nombre-za': '-name',
  recientes: 'recent',
  antiguos: 'oldest',
}
const ORDER_LABELS: Record<PatientOrder, string> = {
  name: 'Orden: nombre A–Z',
  '-name': 'Orden: nombre Z–A',
  recent: 'Orden: registro más reciente',
  oldest: 'Orden: registro más antiguo',
}

function keyOf<T>(map: Record<string, T>, value: T): string {
  return Object.keys(map).find((key) => map[key] === value)!
}

function text(query: LocationQuery, key: string): string {
  const value = query[key]
  return typeof value === 'string' ? value : ''
}

const group = ref<PatientGroup>(GROUPS[text(route.query, 'pestana')] ?? 'all')
const order = ref<PatientOrder>(ORDERS[text(route.query, 'orden')] ?? 'name')
const activity = ref<Category | ''>(
  text(route.query, 'actividad') as Category | '',
)
const searchInput = ref(text(route.query, 'buscar'))
const search = ref(normalizeSearch(searchInput.value))
const page = ref(Math.max(1, Number(text(route.query, 'pagina')) || 1))

const list = ref<PatientPage | null>(null)
const counts = ref<PatientCounts | null>(null)
const loading = ref(true)
const loadError = ref<string | null>(null)
const registerOpen = ref(false)

const canRegister = computed(() => session.can('patients:write'))

const tabs = computed<TabItem<PatientGroup>[]>(() => [
  { key: 'all', label: 'Todos', count: counts.value?.all },
  { key: 'active', label: 'Activos', count: counts.value?.active },
  {
    key: 'consent_pending',
    label: 'Consentimiento pendiente',
    count: counts.value?.consentPending,
  },
  { key: 'inactive', label: 'Inactivos', count: counts.value?.inactive },
])

const columns: Column[] = [
  { key: 'person', label: 'Persona' },
  { key: 'ci', label: 'Carnet' },
  { key: 'contact', label: 'Familiar o cuidador' },
  { key: 'activities', label: 'Actividades' },
  { key: 'status', label: 'Estado' },
  { key: 'consent', label: 'Consentimiento' },
  { key: 'open', label: 'Acciones', hideLabel: true, align: 'end' },
]

const rows = computed(() => list.value?.items ?? [])
const filtered = computed(() => Boolean(search.value || activity.value))

const emptyMessage = computed(() => {
  if (search.value && activity.value)
    return `Nadie con «${search.value}» vino a esa actividad en los últimos seis meses.`
  if (search.value)
    return `No encontramos afiliados con «${search.value}». Revisa el nombre o el carnet.`
  if (activity.value)
    return 'Nadie de esta pestaña vino a esa actividad en los últimos seis meses.'
  return {
    all: 'Todavía no hay afiliados registrados.',
    active: 'No hay fichas activas.',
    consent_pending:
      'Todas las fichas activas tienen el consentimiento firmado.',
    inactive: 'Ninguna ficha está inactiva.',
  }[group.value]
})

// Cada carga lleva un número: si llega tarde una respuesta vieja, se descarta
let request = 0

async function load() {
  const current = ++request
  loading.value = true
  loadError.value = null
  const filters = {
    search: search.value || undefined,
    activity: activity.value || undefined,
  }
  try {
    const [pageResult, countResult] = await Promise.all([
      api.patients.list({
        ...filters,
        group: group.value,
        order: order.value,
        limit: PAGE_SIZE,
        offset: (page.value - 1) * PAGE_SIZE,
      }),
      api.patients.summary(filters),
    ])
    if (current !== request) return
    // Si la página pedida quedó vacía (por ejemplo, tras una baja), vuelve a la última
    const lastPage = Math.max(1, Math.ceil(pageResult.total / PAGE_SIZE))
    if (!pageResult.items.length && page.value > lastPage) {
      page.value = lastPage
      return
    }
    list.value = pageResult
    counts.value = countResult
  } catch (error) {
    if (current !== request) return
    loadError.value = isApiError(error)
      ? error.message
      : 'No pudimos cargar los afiliados. Intenta de nuevo.'
  } finally {
    if (current === request) loading.value = false
  }
}

function syncQuery() {
  const query: Record<string, string> = {}
  if (group.value !== 'all') query.pestana = keyOf(GROUPS, group.value)
  if (search.value) query.buscar = search.value
  if (activity.value) query.actividad = activity.value
  if (order.value !== 'name') query.orden = keyOf(ORDERS, order.value)
  if (page.value > 1) query.pagina = String(page.value)
  void router
    .replace({ query })
    .then(() => rememberPatientsList(route.fullPath))
}

const sticky = ref<InstanceType<typeof StickyHeader> | null>(null)

function refresh() {
  syncQuery()
  void load()
  // Otra pestaña, filtro o página: la lista empieza de nuevo justo bajo el encabezado
  sticky.value?.scrollToStart()
}

// Un filtro nuevo vuelve a la primera página (y esa carga es la única)
watch([group, search, activity, order], () => {
  if (page.value === 1) refresh()
  else page.value = 1
})
watch(page, refresh)

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(searchInput, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    search.value = normalizeSearch(value)
  }, SEARCH_DELAY)
})
onBeforeUnmount(() => clearTimeout(searchTimer))

function searchNow() {
  clearTimeout(searchTimer)
  search.value = normalizeSearch(searchInput.value)
}

function clearFilters() {
  clearTimeout(searchTimer)
  searchInput.value = ''
  search.value = ''
  activity.value = ''
}

function showCi(ci: string) {
  clearTimeout(searchTimer)
  group.value = 'all'
  activity.value = ''
  searchInput.value = ci
  search.value = ci
}

async function onCreated(patient: PatientOut) {
  toast.success(`Registramos a ${patient.name}. Ya puedes completar su ficha.`)
  await router.push({ name: 'afiliado', params: { id: patient.id } })
}

function contactLabel(row: PatientSummary): string | null {
  const contact = row.primaryContact
  return contact
    ? `${contact.name} · ${contact.relation.toLocaleLowerCase('es')}`
    : null
}

rememberPatientsList(route.fullPath)
void load()
</script>

<template>
  <div class="patients">
    <!-- Título, pestañas y filtros quedan fijos; las filas pasan por debajo -->
    <StickyHeader ref="sticky" v-slot="{ stuck }">
      <div class="patients__head" :class="{ 'is-stuck': stuck }">
        <PageHeader
          title="Afiliados"
          subtitle="Las personas que acompañamos y quienes las cuidan."
        >
          <template v-if="canRegister" #actions>
            <AppButton :size="stuck ? 'md' : 'lg'" @click="registerOpen = true">
              + Registrar afiliado
            </AppButton>
          </template>
        </PageHeader>

        <div class="patients__card-top">
          <AppTabs
            v-model="group"
            :items="tabs"
            label="Fichas por estado"
            id-prefix="afiliados"
          />
          <form class="toolbar" role="search" @submit.prevent="searchNow">
            <label class="visually-hidden" for="buscar-afiliado">
              Buscar por nombre o carnet
            </label>
            <span class="toolbar__search">
              <span class="toolbar__icon" aria-hidden="true">⌕</span>
              <input
                id="buscar-afiliado"
                v-model="searchInput"
                class="input"
                type="search"
                placeholder="Buscar por nombre o carnet"
                autocomplete="off"
              />
            </span>
            <label class="visually-hidden" for="filtro-actividad">
              Actividad
            </label>
            <select id="filtro-actividad" v-model="activity" class="select">
              <option value="">Todas las actividades</option>
              <option
                v-for="option in counts?.activities ?? []"
                :key="option.category"
                :value="option.category"
              >
                {{ option.label }} ({{ option.patients }})
              </option>
            </select>
            <label class="visually-hidden" for="orden-afiliados">Orden</label>
            <select id="orden-afiliados" v-model="order" class="select">
              <option
                v-for="(label, value) in ORDER_LABELS"
                :key="value"
                :value="value"
              >
                {{ label }}
              </option>
            </select>
          </form>
        </div>
      </div>
    </StickyHeader>

    <section class="patients__card" aria-label="Listado de afiliados">
      <div
        id="afiliados-panel"
        role="tabpanel"
        :aria-labelledby="`afiliados-tab-${group}`"
        class="patients__panel"
      >
        <p v-if="activity" class="patients__hint">
          Personas que vinieron al menos una vez en los últimos seis meses.
        </p>

        <AppAlert v-if="loadError" tone="error" class="patients__error">
          {{ loadError }}
          <AppButton variant="link" size="sm" @click="load">
            Reintentar
          </AppButton>
        </AppAlert>

        <div class="patients__table" :class="{ 'is-refreshing': loading }">
          <DataTable
            :columns="columns"
            :rows="rows"
            :row-key="(row) => row.id"
            :loading="loading && !list"
            :skeleton-rows="PAGE_SIZE"
            caption="Afiliados de ASPAR"
            sticky-head
          >
            <template #cell-person="{ row }">
              <span class="person">
                <InitialsAvatar :name="row.name" :muted="!row.active" />
                <span class="person__text">
                  <strong>{{ row.name }}</strong>
                  <small>{{ sinceLabel(row.createdAt) }}</small>
                </span>
              </span>
            </template>
            <template #cell-ci="{ row }">
              <span class="ci">{{ formatCi(row.ci) }}</span>
            </template>
            <template #cell-contact="{ row }">
              <span v-if="contactLabel(row)">{{ contactLabel(row) }}</span>
              <span v-else class="muted">Sin contacto</span>
            </template>
            <template #cell-activities="{ row }">
              <span v-if="row.activities.length">
                {{ activitiesLabel(row.activities.map((tag) => tag.label)) }}
              </span>
              <span v-else class="muted">Sin asistencias recientes</span>
            </template>
            <template #cell-status="{ row }">
              <StatusBadge :tone="row.active ? 'success' : 'neutral'">
                {{ row.active ? 'Activo' : 'Inactivo' }}
              </StatusBadge>
            </template>
            <template #cell-consent="{ row }">
              <StatusBadge
                :tone="row.consent ? 'success' : 'warning'"
                :dot="false"
              >
                {{ row.consent ? 'Firmado' : 'Pendiente' }}
              </StatusBadge>
            </template>
            <template #cell-open="{ row }">
              <RouterLink
                class="open-link"
                :to="{ name: 'afiliado', params: { id: row.id } }"
                :aria-label="`Abrir la ficha de ${row.name}`"
              >
                Abrir ficha
              </RouterLink>
            </template>
            <template #empty>
              <p>{{ emptyMessage }}</p>
              <AppButton
                v-if="filtered"
                variant="link"
                size="sm"
                class="patients__clear"
                @click="clearFilters"
              >
                Quitar la búsqueda y el filtro
              </AppButton>
            </template>
          </DataTable>
        </div>

        <AppPagination
          v-if="list"
          :total="list.total"
          :limit="PAGE_SIZE"
          :offset="list.offset"
          :count="list.items.length"
          label="Páginas de afiliados"
          @change="page = $event / PAGE_SIZE + 1"
        />
      </div>
    </section>

    <ol class="principles">
      <li class="principles__item surface-card">
        <span class="principles__number" aria-hidden="true">1</span>
        <div>
          <h2>Una persona, una ficha</h2>
          <p>
            El carnet no se puede repetir. Búscalo antes de registrar a alguien
            nuevo.
          </p>
        </div>
      </li>
      <li class="principles__item surface-card">
        <span class="principles__number" aria-hidden="true">2</span>
        <div>
          <h2>Nada se borra</h2>
          <p>
            Si alguien deja de venir, la ficha se marca como inactiva con el
            motivo. Sus evaluaciones se conservan.
          </p>
        </div>
      </li>
    </ol>

    <RegisterPatientDialog
      v-if="canRegister"
      v-model:open="registerOpen"
      @created="onCreated"
      @search="showCi"
    />
  </div>
</template>

<style scoped>
.patients {
  min-width: 0;
}

.patients :deep(.page-header) {
  margin-bottom: 0;
}

/* Encabezado fijo: título, pestañas y filtros. Al quedar fijo se achica */
.patients__head {
  display: grid;
  gap: var(--space-6);
}

.patients__head.is-stuck {
  gap: var(--space-3);
  padding-top: var(--space-3);
}

.patients__head.is-stuck :deep(.page-header__subtitle) {
  display: none;
}

.patients__head.is-stuck :deep(.page-header__title) {
  font-size: var(--text-2xl);
}

/* La tarjeta del diseño, partida en dos: arriba (fija) y las filas */
.patients__card-top {
  display: grid;
  gap: var(--space-4);
  padding: var(--space-5) var(--space-6) var(--space-4);
  border: 1px solid var(--color-border);
  border-bottom: 0;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  background: var(--color-surface);
}

.patients__card {
  display: grid;
  gap: var(--space-4);
  min-width: 0;
  padding: 0 var(--space-6) var(--space-6);
  border: 1px solid var(--color-border);
  border-top: 0;
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
}

.patients__panel {
  display: grid;
  gap: var(--space-4);
  min-width: 0;
}

.toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--space-3);
}

.toolbar__search {
  position: relative;
}

.toolbar__search .input {
  padding-left: 2.4rem;
}

.toolbar__icon {
  position: absolute;
  top: 50%;
  left: var(--space-4);
  transform: translateY(-50%);
  color: var(--color-text-subtle);
  font-size: var(--text-lg);
  pointer-events: none;
}

.patients__hint {
  margin-top: calc(-1 * var(--space-2));
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.patients__table {
  min-width: 0;
  transition: opacity var(--duration-base) var(--ease-out);
}

.patients__table.is-refreshing {
  opacity: 0.6;
}

/* Filas compactas: diez afiliados y la paginación entran en una pantalla grande */
.patients__table :deep(th),
.patients__table :deep(td) {
  padding-inline: var(--space-3);
}

.patients__table :deep(td) {
  padding-block: 0.6rem;
}

.patients__table :deep(th) {
  white-space: normal;
}

.person {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 9.5rem;
}

.person__text {
  display: grid;
  gap: 0.1rem;
  line-height: var(--leading-snug);
}

.person__text small {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.ci {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.muted {
  color: var(--color-text-subtle);
}

.open-link {
  color: var(--color-link);
  font-weight: 600;
  text-decoration: underline;
  text-decoration-color: rgb(109 22 25 / 0.3);
  text-underline-offset: 0.25em;
  white-space: nowrap;
}

.open-link:hover {
  text-decoration-color: currentColor;
}

.patients__clear {
  margin-top: var(--space-2);
}

.principles {
  margin-top: var(--space-6);
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-5);
  margin: 0;
  padding: 0;
  list-style: none;
}

.principles__item {
  display: flex;
  gap: var(--space-4);
  padding: var(--space-5) var(--space-6);
}

.principles__number {
  color: var(--aspar-rojo);
  font-family: var(--font-serif);
  font-size: var(--text-3xl);
  line-height: 1;
}

.principles h2 {
  margin-bottom: var(--space-1);
  font-family: var(--font-sans);
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--color-text);
}

.principles p {
  color: var(--color-text-muted);
}

@media (max-width: 1180px) {
  .toolbar {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }

  .toolbar__search {
    grid-column: span 2;
  }
}

@media (max-width: 640px) {
  .patients__card-top {
    padding: var(--space-4) var(--space-4) var(--space-3);
  }

  .patients__card {
    padding: 0 var(--space-4) var(--space-4);
  }

  /* En el celular, al quedar fijo solo se ven las pestañas (salvo mientras se escribe) */
  .patients__head.is-stuck:not(:focus-within) :deep(.page-header),
  .patients__head.is-stuck:not(:focus-within) .toolbar {
    display: none;
  }

  .toolbar,
  .principles {
    grid-template-columns: minmax(0, 1fr);
  }

  .toolbar__search {
    grid-column: auto;
  }
}

@container (max-width: 50rem) {
  .person {
    min-width: 0;
    text-align: left;
  }
}
</style>
