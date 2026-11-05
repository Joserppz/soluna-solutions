<script setup lang="ts">
/**
 * Inventario (diseño pág. 11): cuántos materiales hay, en qué estado y de dónde vinieron.
 * Los bienes de la Alcaldía se cuentan aparte, para la rendición de cuentas. Los filtros
 * quedan en la dirección y el listado entra en la ventana.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { isApiError } from '../../../api/errors'
import type {
  InventorySummary,
  ItemListQuery,
  ItemOut,
} from '../../../api/types'
import ItemPanel from '../../../components/ops/ItemPanel.vue'
import AppAlert from '../../../components/ui/AppAlert.vue'
import AppButton from '../../../components/ui/AppButton.vue'
import AppModal from '../../../components/ui/AppModal.vue'
import AppPagination from '../../../components/ui/AppPagination.vue'
import PageHeader from '../../../components/ui/PageHeader.vue'
import SkeletonBlock from '../../../components/ui/SkeletonBlock.vue'
import StatusBadge from '../../../components/ui/StatusBadge.vue'
import { useApi } from '../../../composables/useApi'
import { useFitLayout } from '../../../composables/useFitLayout'
import { useFitRows } from '../../../composables/useFitRows'
import { useToast } from '../../../composables/useToast'
import { saveBlob } from '../../../utils/download'
import { todayIso } from '../../../utils/format'
import { CONDITION_TONES, itemLine } from '../../../utils/ops'
import { normalizeSearch } from '../../../utils/patients'

const ROW_HEIGHT = 56
const SCROLL_PAGE_SIZE = 10

const { api, session } = useApi()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const fit = useFitLayout()
const canManage = computed(() => session.can('inventory:manage'))

const ORIGINS = [
  { value: 'propio', label: 'Propio' },
  { value: 'donado', label: 'Donado' },
  { value: 'alcaldia', label: 'Alcaldía' },
] as const
const CATEGORIES = [
  { value: 'fisioterapia', label: 'Fisioterapia' },
  { value: 'movilidad', label: 'Apoyo a la movilidad' },
  { value: 'mobiliario', label: 'Mobiliario' },
  { value: 'papeleria', label: 'Papelería' },
  { value: 'otro', label: 'Otro' },
] as const
const CONDITIONS = [
  { value: 'nuevo', label: 'Nuevo' },
  { value: 'bueno', label: 'Bueno' },
  { value: 'regular', label: 'Regular' },
  { value: 'dañado', label: 'Dañado' },
] as const

function text(key: string): string {
  const value = route.query[key]
  return typeof value === 'string' ? value : ''
}

const origin = ref(text('origen'))
const category = ref(text('categoria'))
const condition = ref(text('condicion'))
const searchInput = ref(text('buscar'))
const search = ref(normalizeSearch(searchInput.value))
const page = ref(Math.max(1, Number(text('pagina')) || 1))

const summary = ref<InventorySummary | null>(null)
const items = ref<ItemOut[]>([])
const total = ref(0)
const loading = ref(true)
const loadError = ref<string | null>(null)
const selectedId = ref<string | null>(text('material') || null)
const creating = ref(false)
const exporting = ref<'csv' | 'xlsx' | null>(null)

const tableArea = ref<HTMLElement | null>(null)
const { pageSize } = useFitRows(tableArea, {
  rowHeight: ROW_HEIGHT,
  fallback: SCROLL_PAGE_SIZE,
})

/** El material abierto: el que devolvió la API al guardarlo (aunque no esté en esta página). */
const selectedItem = ref<ItemOut | null>(null)
/** Sube al guardar: el panel se vuelve a montar con los datos nuevos. */
const panelVersion = ref(0)
const selected = computed(() =>
  selectedItem.value?.id === selectedId.value
    ? selectedItem.value
    : (items.value.find((item) => item.id === selectedId.value) ?? null),
)
const filtered = computed(() =>
  Boolean(search.value || origin.value || category.value || condition.value),
)

let request = 0

async function load() {
  const current = ++request
  loading.value = true
  loadError.value = null
  try {
    const [list, counts] = await Promise.all([
      api.inventory.list({
        search: search.value || undefined,
        origin: (origin.value || undefined) as ItemListQuery['origin'],
        category: (category.value || undefined) as ItemListQuery['category'],
        condition: (condition.value || undefined) as ItemListQuery['condition'],
        limit: pageSize.value,
        offset: (page.value - 1) * pageSize.value,
      }),
      api.inventory.summary(),
    ])
    if (current !== request) return
    const lastPage = Math.max(1, Math.ceil(list.total / pageSize.value))
    if (!list.items.length && page.value > lastPage) {
      page.value = lastPage
      return
    }
    items.value = list.items
    total.value = list.total
    summary.value = counts
  } catch (failure) {
    if (current !== request) return
    loadError.value = isApiError(failure)
      ? failure.message
      : 'No pudimos cargar el inventario. Intenta de nuevo.'
  } finally {
    if (current === request) loading.value = false
  }
}

function syncQuery() {
  const query: Record<string, string> = {}
  if (search.value) query.buscar = search.value
  if (origin.value) query.origen = origin.value
  if (category.value) query.categoria = category.value
  if (condition.value) query.condicion = condition.value
  if (page.value > 1) query.pagina = String(page.value)
  if (selectedId.value) query.material = selectedId.value
  void router.replace({ query })
}

function refresh() {
  syncQuery()
  void load()
}

watch([search, origin, category, condition], () => {
  if (page.value === 1) refresh()
  else page.value = 1
})
watch(page, refresh)
// Cuando cambia cuántas filas entran (al medir), se vuelve a pedir desde la primera
watch(pageSize, () => {
  if (page.value === 1) refresh()
  else page.value = 1
})

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(searchInput, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    search.value = normalizeSearch(value)
  }, 300)
})

function open(item: ItemOut) {
  creating.value = false
  selectedItem.value = item
  selectedId.value = item.id
  panelVersion.value += 1
  syncQuery()
}

/** La pestaña del panel (Datos o Historial): se conserva al guardar un movimiento. */
const panelTab = ref<'datos' | 'historial'>('datos')

function choose(item: ItemOut) {
  if (item.id !== selectedId.value) panelTab.value = 'datos'
  open(item)
}

function startNew() {
  creating.value = true
}

/** El material nuevo queda abierto en el panel, con su historial. */
function onCreated(item: ItemOut) {
  creating.value = false
  panelTab.value = 'datos'
  onSaved(item)
}

function onSaved(item: ItemOut) {
  open(item)
  void load()
}

function onDeactivated(item: ItemOut) {
  open(item)
  void load()
}

function clearFilters() {
  clearTimeout(searchTimer)
  searchInput.value = ''
  search.value = ''
  origin.value = ''
  category.value = ''
  condition.value = ''
}

async function exportAs(format: 'csv' | 'xlsx') {
  exporting.value = format
  try {
    const blob = await api.inventory.export(format)
    saveBlob(blob, `inventario-${todayIso()}.${format}`)
    toast.success(
      format === 'xlsx'
        ? 'Descargamos el inventario. Los bienes de la Alcaldía van en su propia hoja.'
        : 'Descargamos el inventario. Los bienes de la Alcaldía van en un archivo aparte.',
    )
  } catch (failure) {
    toast.error(
      isApiError(failure)
        ? failure.message
        : 'No pudimos exportar el inventario.',
    )
  } finally {
    exporting.value = null
  }
}

function dateLabel(value: string | null): string {
  if (!value) return '—'
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

const showingFrom = computed(() => (page.value - 1) * pageSize.value)

/** Un enlace con ?material= abre ese material aunque no esté en la página que se ve. */
async function openLinked() {
  const id = selectedId.value
  if (!id || selected.value) return
  try {
    const item = await api.inventory.get(id)
    if (selectedId.value === id) selectedItem.value = item
  } catch {
    if (selectedId.value === id) {
      selectedId.value = null
      syncQuery()
    }
  }
}

onMounted(async () => {
  await load()
  await openLinked()
})
</script>

<template>
  <div class="inv" :class="{ 'inv--fit': fit }">
    <PageHeader
      title="Inventario"
      subtitle="Materiales y equipos de la asociación: cuántos hay, en qué estado y de dónde vinieron."
    >
      <template v-if="canManage" #actions>
        <AppButton size="lg" @click="startNew">+ Añadir material</AppButton>
      </template>
    </PageHeader>

    <section class="counts" aria-label="Resumen del inventario">
      <SkeletonBlock v-if="!summary" :lines="1" height="3rem" />
      <template v-else>
        <p class="count">
          <strong>{{ summary.total }}</strong
          ><span>materiales registrados</span>
        </p>
        <p class="count">
          <strong>{{ summary.alcaldia }}</strong
          ><span>vinieron de la Alcaldía</span>
        </p>
        <p class="count">
          <strong>{{ summary.donado }}</strong
          ><span>fueron donados</span>
        </p>
        <p v-if="summary.damaged" class="damaged" role="status">
          <span class="damaged__dot" aria-hidden="true" />
          {{
            summary.damaged === 1
              ? '1 material dañado por revisar'
              : `${summary.damaged} materiales dañados por revisar`
          }}
        </p>
      </template>
      <div class="exports" role="group" aria-labelledby="exportar-titulo">
        <span id="exportar-titulo" class="exports__label">Exportar</span>
        <AppButton
          variant="secondary"
          size="sm"
          aria-label="Exportar CSV"
          :loading="exporting === 'csv'"
          loading-label="Preparando…"
          @click="exportAs('csv')"
        >
          CSV
        </AppButton>
        <AppButton
          variant="secondary"
          size="sm"
          aria-label="Exportar Excel"
          :loading="exporting === 'xlsx'"
          loading-label="Preparando…"
          @click="exportAs('xlsx')"
        >
          Excel
        </AppButton>
      </div>
    </section>

    <div class="inv__body">
      <section class="card" aria-labelledby="lista-titulo">
        <h2 id="lista-titulo" class="visually-hidden">Materiales</h2>
        <form class="filters" role="search" @submit.prevent>
          <label class="visually-hidden" for="buscar-material"
            >Nombre del material</label
          >
          <span class="filters__search">
            <span class="filters__icon" aria-hidden="true">⌕</span>
            <input
              id="buscar-material"
              v-model="searchInput"
              class="input"
              type="search"
              placeholder="Buscar material"
              autocomplete="off"
            />
          </span>
          <label class="visually-hidden" for="filtro-origen">Origen</label>
          <select id="filtro-origen" v-model="origin" class="select">
            <option value="">Origen</option>
            <option
              v-for="option in ORIGINS"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
          <label class="visually-hidden" for="filtro-categoria"
            >Categoría</label
          >
          <select id="filtro-categoria" v-model="category" class="select">
            <option value="">Categoría</option>
            <option
              v-for="option in CATEGORIES"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
          <label class="visually-hidden" for="filtro-condicion"
            >Condición</label
          >
          <select id="filtro-condicion" v-model="condition" class="select">
            <option value="">Condición</option>
            <option
              v-for="option in CONDITIONS"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </form>

        <AppAlert v-if="loadError" tone="error">
          {{ loadError }}
          <AppButton variant="link" size="sm" @click="load"
            >Reintentar</AppButton
          >
        </AppAlert>

        <div
          ref="tableArea"
          class="inv__table"
          :class="{ 'is-refreshing': loading && items.length }"
        >
          <table class="table">
            <thead>
              <tr>
                <th scope="col">Material</th>
                <th scope="col" class="num">Cantidad</th>
                <th scope="col">Condición</th>
                <th scope="col" class="wide-only">Origen</th>
                <th scope="col" class="wide-only">Ingreso</th>
                <th scope="col">
                  <span class="visually-hidden">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading && !items.length">
                <td colspan="6">
                  <SkeletonBlock :lines="1" height="1rem" />
                </td>
              </tr>
              <tr v-else-if="!items.length">
                <td colspan="6" class="empty">
                  <p>
                    {{
                      filtered
                        ? 'Ningún material coincide con estos filtros.'
                        : 'Todavía no hay materiales registrados.'
                    }}
                  </p>
                  <AppButton
                    v-if="filtered"
                    variant="link"
                    size="sm"
                    @click="clearFilters"
                    >Quitar los filtros</AppButton
                  >
                </td>
              </tr>
              <tr
                v-for="item in items"
                v-else
                :key="item.id"
                :class="{
                  'is-selected': item.id === selectedId,
                  'is-damaged': item.condition === 'dañado',
                }"
              >
                <td>
                  <span class="name">
                    <strong>{{ item.name }}</strong>
                    <small>{{ itemLine(item) }}</small>
                  </span>
                </td>
                <td class="num">{{ item.quantity }}</td>
                <td>
                  <StatusBadge
                    :tone="CONDITION_TONES[item.condition] ?? 'neutral'"
                    >{{ item.conditionLabel }}</StatusBadge
                  >
                </td>
                <td class="wide-only">
                  <span class="origin">
                    <strong>{{ item.originLabel }}</strong>
                    <small v-if="item.donorOrInstitution">{{
                      item.donorOrInstitution
                    }}</small>
                  </span>
                </td>
                <td class="nowrap wide-only">
                  {{ dateLabel(item.entryDate) }}
                </td>
                <td class="end">
                  <button
                    type="button"
                    class="link"
                    :aria-label="`Editar ${item.name}`"
                    @click="choose(item)"
                  >
                    Editar
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <footer v-if="total > 0" class="inv__footer">
          <AppPagination
            :total="total"
            :limit="pageSize"
            :offset="showingFrom"
            :count="items.length"
            label="Páginas del inventario"
            @change="page = Math.floor($event / pageSize) + 1"
          />
        </footer>
      </section>

      <aside class="inv__side">
        <ItemPanel
          v-if="selected"
          :key="`${selected.id}-${panelVersion}`"
          :item="selected"
          :initial-tab="panelTab"
          @saved="onSaved"
          @deactivated="onDeactivated"
          @tab="panelTab = $event"
        />
        <section v-else class="card card--hint" aria-labelledby="sin-material">
          <h2 id="sin-material" class="card__title">Elige un material</h2>
          <p>
            Toca «Editar» en un material para cambiar su cantidad, su estado o
            su historial.
          </p>
        </section>
      </aside>
    </div>

    <!-- «+ Añadir material» se abre en una ventana, como «Registrar afiliado» -->
    <AppModal
      v-model:open="creating"
      title="Añadir material"
      labelled-by="panel-titulo"
      size="md"
      bare
    >
      <ItemPanel
        :item="null"
        dialog
        @saved="onCreated"
        @close="creating = false"
      />
    </AppModal>
  </div>
</template>

<style scoped>
.inv {
  display: grid;
  gap: var(--space-5);
  min-width: 0;
}

.inv :deep(.page-header) {
  margin-bottom: 0;
}

.counts {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-6);
  padding: var(--space-4) var(--space-6);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.count {
  display: grid;
  gap: 0.1rem;
}

.count strong {
  font-family: var(--font-serif);
  font-size: clamp(1.9rem, 4vh, 2.5rem);
  font-weight: 500;
  line-height: 1;
  color: var(--color-text);
}

.count span {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.exports {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  margin-left: auto;
}

.exports__label {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.damaged {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-pill);
  background: var(--tone-danger-bg);
  color: var(--tone-danger-fg);
  font-size: var(--text-sm);
  font-weight: 600;
}

.damaged__dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: var(--aspar-rojo);
}

.inv__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(19rem, 24rem);
  gap: var(--space-5);
  align-items: start;
  min-width: 0;
}

.card {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-content: start;
  gap: var(--space-3);
  min-width: 0;
  padding: var(--space-5) var(--space-6);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
}

.card--hint {
  color: var(--color-text-muted);
}

.card__title {
  font-family: var(--font-serif);
  font-size: var(--text-xl);
  font-weight: 500;
  color: var(--color-text);
}

.filters {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) repeat(3, minmax(0, 1fr));
  gap: var(--space-2);
}

.filters .select {
  padding-inline: var(--space-3) var(--space-8);
  font-size: var(--text-sm);
}

.filters__search {
  position: relative;
}

.filters__search .input {
  padding-left: 2.1rem;
  font-size: var(--text-sm);
}

.filters__icon {
  position: absolute;
  top: 50%;
  left: var(--space-3);
  transform: translateY(-50%);
  color: var(--color-text-subtle);
  pointer-events: none;
}

.inv__table {
  min-width: 0;
  transition: opacity var(--duration-base) var(--ease-out);
}

.inv__table.is-refreshing {
  opacity: 0.6;
}

.inv__table .table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
}

.inv__table th,
.inv__table td {
  padding: 0.5rem var(--space-2);
  border-bottom: 1px solid var(--color-border);
  text-align: left;
  vertical-align: middle;
}

.inv__table th {
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.inv__table .num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.inv__table .end {
  text-align: right;
}

.inv__table tr.is-selected td {
  background: var(--rosa-50);
}

.inv__table tr.is-damaged td:first-child {
  box-shadow: inset 3px 0 0 var(--aspar-rojo);
}

.name,
.origin {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
}

.name small,
.origin small {
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nowrap {
  white-space: nowrap;
}

.empty {
  padding: var(--space-6) 0 !important;
  color: var(--color-text-muted);
  text-align: left !important;
}

.link {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-link);
  font: inherit;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 0.25em;
  cursor: pointer;
}

.inv__footer {
  min-width: 0;
}

.inv__side {
  min-width: 0;
}

@media (max-width: 1000px) {
  .inv__body {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 640px) {
  .filters {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }

  .filters__search {
    grid-column: 1 / -1;
  }

  /* En el celular la tabla muestra lo esencial; origen e ingreso están en el panel */
  .inv__table {
    overflow-x: auto;
  }

  .inv__table .wide-only {
    display: none;
  }

  .inv__table th,
  .inv__table td {
    padding-inline: 0.35rem;
  }

  /* Los tres contadores en una fila; el aviso y la exportación debajo */
  .counts {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-3);
    padding: var(--space-4);
  }

  .count strong {
    font-size: var(--text-2xl);
  }

  .count span {
    font-size: var(--text-xs);
  }

  .damaged,
  .exports {
    grid-column: 1 / -1;
    justify-self: start;
  }

  .exports {
    margin-left: 0;
  }
}

/* Ventana completa: la página no se desplaza; la tabla muestra los materiales que entran */
.inv--fit {
  display: flex;
  flex-direction: column;
  gap: clamp(var(--space-3), 2.2vh, var(--space-5));
  min-height: 0;
}

.inv--fit :deep(.page-header__title) {
  font-size: clamp(1.9rem, 4.6vh, 3.25rem);
}

.inv--fit .counts {
  gap: clamp(var(--space-4), 1.6vw, var(--space-6));
  padding-block: clamp(var(--space-1), 0.9vh, var(--space-2));
}

.inv--fit .inv__body {
  flex: 1;
  min-height: 0;
  align-items: stretch;
  grid-template-columns: minmax(0, 1fr) clamp(18rem, 24vw, 23rem);
  grid-template-rows: minmax(0, 1fr);
}

.inv--fit .card {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding-block: clamp(var(--space-3), 1.8vh, var(--space-5));
}

.inv--fit .inv__side {
  min-height: 0;
  overflow-y: auto;
}

.inv--fit .inv__table {
  /* La base en cero: el alto sale del espacio libre, no del contenido */
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
}

.inv--fit .inv__table td {
  height: 3.5rem;
  padding-block: 0;
}
</style>
