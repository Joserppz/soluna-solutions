<script setup lang="ts">
/**
 * Solicitudes (diseño pág. 17): las personas que escribieron desde el sitio, las que se
 * anotaron en la asistencia y las que llegaron a la sede. A la izquierda la bandeja con
 * sus pestañas y el filtro por motivo; al costado, la solicitud abierta con su
 * seguimiento, las notas de la llamada e «Inscribir como afiliado →». En escritorio
 * todo entra en la ventana.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { isApiError } from '../../../api/errors'
import type {
  InquiryDetail,
  InquiryListQuery,
  InquiryOut,
  InquirySummary,
  PatientOut,
} from '../../../api/types'
import EnrollDialog from '../../../components/inquiries/EnrollDialog.vue'
import InquiryPanel from '../../../components/inquiries/InquiryPanel.vue'
import AppAlert from '../../../components/ui/AppAlert.vue'
import AppButton from '../../../components/ui/AppButton.vue'
import AppModal from '../../../components/ui/AppModal.vue'
import AppPagination from '../../../components/ui/AppPagination.vue'
import AppTabs, { type TabItem } from '../../../components/ui/AppTabs.vue'
import InitialsAvatar from '../../../components/ui/InitialsAvatar.vue'
import PageHeader from '../../../components/ui/PageHeader.vue'
import SkeletonBlock from '../../../components/ui/SkeletonBlock.vue'
import StatusBadge from '../../../components/ui/StatusBadge.vue'
import { useApi } from '../../../composables/useApi'
import { useFitLayout, useMediaQuery } from '../../../composables/useFitLayout'
import { useFitRows } from '../../../composables/useFitRows'
import { useToast } from '../../../composables/useToast'
import { refreshTeamCounters } from '../../../utils/counters'
import {
  INQUIRY_KINDS,
  INQUIRY_TABS,
  STATUS_LABELS,
  STATUS_TONES,
  inquiryLine,
  receivedAgo,
  type InquiryKind,
  type InquiryTab,
} from '../../../utils/inquiries'
import { normalizeSearch } from '../../../utils/patients'

const ROW_HEIGHT = 72
const SCROLL_PAGE_SIZE = 10

const { api } = useApi()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const fit = useFitLayout()
/** Con lugar al costado, la solicitud va en un panel; si no, en una ventana. */
const wide = useMediaQuery('(min-width: 1100px)')

function text(key: string): string {
  const value = route.query[key]
  return typeof value === 'string' ? value : ''
}

const tab = ref<InquiryTab>(
  INQUIRY_TABS.some((item) => item.key === text('estado'))
    ? (text('estado') as InquiryTab)
    : 'todas',
)
const kind = ref<InquiryKind | ''>(
  INQUIRY_KINDS.some((item) => item.value === text('motivo'))
    ? (text('motivo') as InquiryKind)
    : '',
)
const searchInput = ref(text('buscar'))
const search = ref(normalizeSearch(searchInput.value))
const page = ref(Math.max(1, Number(text('pagina')) || 1))
const selectedId = ref<string | null>(text('solicitud') || null)

const items = ref<InquiryOut[]>([])
const total = ref(0)
const summary = ref<InquirySummary | null>(null)
const loading = ref(true)
const loadError = ref<string | null>(null)
const enrolling = ref<InquiryOut | null>(null)
const enrollOpen = ref(false)

const listArea = ref<HTMLElement | null>(null)
const { pageSize } = useFitRows(listArea, {
  rowHeight: ROW_HEIGHT,
  fallback: SCROLL_PAGE_SIZE,
  headHeight: 0,
})

const tabs = computed<TabItem<InquiryTab>[]>(() =>
  INQUIRY_TABS.map((item) => ({
    key: item.key,
    label: item.label,
    count: summary.value ? item.count(summary.value) : null,
  })),
)

let request = 0

async function load() {
  const current = ++request
  loading.value = true
  loadError.value = null
  const query: InquiryListQuery = {
    status:
      tab.value === 'todas'
        ? undefined
        : (tab.value as InquiryListQuery['status']),
    kind: kind.value || undefined,
    search: search.value || undefined,
    limit: pageSize.value,
    offset: (page.value - 1) * pageSize.value,
  }
  try {
    const [list, counts] = await Promise.all([
      api.inquiries.list(query),
      api.inquiries.summary(),
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
      : 'No pudimos cargar las solicitudes. Intenta de nuevo.'
  } finally {
    if (current === request) loading.value = false
  }
}

function syncQuery() {
  const query: Record<string, string> = {}
  if (tab.value !== 'todas') query.estado = tab.value
  if (kind.value) query.motivo = kind.value
  if (search.value) query.buscar = search.value
  if (page.value > 1) query.pagina = String(page.value)
  if (selectedId.value) query.solicitud = selectedId.value
  void router.replace({ query })
}

function refresh() {
  syncQuery()
  void load()
}

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(searchInput, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    search.value = normalizeSearch(value)
  }, 300)
})

watch([tab, kind, search], () => {
  if (page.value === 1) refresh()
  else page.value = 1
})
watch(page, refresh)
watch(pageSize, () => {
  if (page.value === 1) refresh()
  else page.value = 1
})

// Un enlace con otra ?solicitud= (por ejemplo, desde el resumen) abre esa
watch(
  () => route.query.solicitud,
  (value) => {
    const id = typeof value === 'string' && value ? value : null
    if (id !== selectedId.value) selectedId.value = id
  },
)

function choose(item: InquiryOut) {
  selectedId.value = item.id
  syncQuery()
}

function closePanel() {
  selectedId.value = null
  syncQuery()
}

/** Después de cambiar el estado o guardar una nota: la fila, las pestañas y el menú. */
function onChanged(updated: InquiryDetail, message: string) {
  const index = items.value.findIndex((row) => row.id === updated.id)
  if (index >= 0) items.value[index] = { ...items.value[index]!, ...updated }
  toast.success(message)
  refresh()
  refreshTeamCounters()
}

function startEnroll(inquiry: InquiryDetail) {
  enrolling.value = inquiry
  enrollOpen.value = true
}

async function onEnrolled(patient: PatientOut) {
  toast.success(
    `Abrimos la ficha de ${patient.name}. Falta el consentimiento firmado.`,
  )
  refreshTeamCounters()
  await router.push({ name: 'afiliado', params: { id: patient.id } })
}

function clearFilters() {
  searchInput.value = ''
  search.value = ''
  kind.value = ''
  tab.value = 'todas'
}

const filtered = computed(() =>
  Boolean(search.value || kind.value || tab.value !== 'todas'),
)

onMounted(load)
</script>

<template>
  <div class="inq" :class="{ 'inq--fit': fit }">
    <PageHeader
      title="Solicitudes"
      subtitle="Personas que nos escribieron. Llamar a tiempo es parte del acompañamiento."
    >
      <template #actions>
        <label class="visually-hidden" for="filtro-motivo">Motivo</label>
        <select id="filtro-motivo" v-model="kind" class="select inq__kind">
          <option value="">Todos los motivos</option>
          <option
            v-for="item in INQUIRY_KINDS"
            :key="item.value"
            :value="item.value"
          >
            {{ item.label }}
          </option>
        </select>
      </template>
    </PageHeader>

    <div class="inq__body">
      <section class="card inbox" aria-labelledby="bandeja-titulo">
        <h2 id="bandeja-titulo" class="visually-hidden">
          Bandeja de solicitudes
        </h2>
        <AppTabs
          v-model="tab"
          :items="tabs"
          label="Solicitudes por estado"
          id-prefix="solicitudes"
        />
        <div
          id="solicitudes-panel"
          role="tabpanel"
          :aria-labelledby="`solicitudes-tab-${tab}`"
          class="inbox__panel"
        >
          <form class="inbox__search" role="search" @submit.prevent>
            <label class="visually-hidden" for="buscar-solicitud"
              >Buscar por nombre o teléfono</label
            >
            <input
              id="buscar-solicitud"
              v-model="searchInput"
              class="input"
              type="search"
              placeholder="Nombre o teléfono"
              autocomplete="off"
            />
          </form>

          <AppAlert v-if="loadError" tone="error">
            {{ loadError }}
            <AppButton size="sm" variant="secondary" @click="load">
              Intentar de nuevo
            </AppButton>
          </AppAlert>

          <div ref="listArea" class="inbox__list">
            <div v-if="loading && !items.length" aria-busy="true">
              <SkeletonBlock
                v-for="n in 4"
                :key="n"
                height="4.5rem"
                class="inbox__skeleton"
              />
            </div>
            <div v-else-if="!items.length && !loadError" class="inbox__empty">
              <p v-if="filtered">No hay solicitudes con estos filtros.</p>
              <p v-else>
                Todavía no llegaron solicitudes. Aparecen aquí cuando alguien
                escribe desde el sitio.
              </p>
              <AppButton
                v-if="filtered"
                size="sm"
                variant="secondary"
                @click="clearFilters"
              >
                Ver todas
              </AppButton>
            </div>
            <ul v-else class="items" aria-label="Solicitudes">
              <li v-for="item in items" :key="item.id">
                <button
                  type="button"
                  class="item"
                  :class="{
                    'is-selected': item.id === selectedId,
                    'is-new': item.status === 'recibida',
                  }"
                  :aria-current="item.id === selectedId ? 'true' : undefined"
                  @click="choose(item)"
                >
                  <InitialsAvatar :name="item.name" />
                  <span class="item__body">
                    <span class="item__name">
                      {{ item.name }}
                      <span
                        v-if="item.status === 'recibida'"
                        class="item__dot"
                        aria-label="sin abrir"
                      />
                    </span>
                    <span class="item__line">{{ inquiryLine(item) }}</span>
                  </span>
                  <span class="item__side">
                    <time class="item__time" :datetime="item.createdAt">
                      {{ receivedAgo(item.createdAt) }}
                    </time>
                    <StatusBadge :tone="STATUS_TONES[item.status]">
                      {{ STATUS_LABELS[item.status] }}
                    </StatusBadge>
                  </span>
                </button>
              </li>
            </ul>
          </div>

          <!-- Siempre que haya solicitudes: así el lugar de la paginación no cambia el alto -->
          <footer v-if="total > 0" class="inbox__footer">
            <AppPagination
              :total="total"
              :limit="pageSize"
              :offset="(page - 1) * pageSize"
              :count="items.length"
              label="Páginas de solicitudes"
              @change="page = Math.floor($event / pageSize) + 1"
            />
          </footer>
        </div>
      </section>

      <aside v-if="wide" class="card inq__side">
        <InquiryPanel
          v-if="selectedId"
          :key="selectedId"
          :inquiry-id="selectedId"
          @close="closePanel"
          @changed="onChanged"
          @enroll="startEnroll"
        />
        <div v-else class="inq__hint">
          <h2 class="inq__hint-title">Elige una solicitud</h2>
          <p>
            Las nuevas tienen un punto rojo. Llama, anota lo que conversaron y,
            cuando venga a su primer sábado, inscríbela como afiliada.
          </p>
          <AppButton
            v-if="summary?.recibida && tab !== 'recibida'"
            size="sm"
            variant="secondary"
            @click="tab = 'recibida'"
          >
            Ver las {{ summary.recibida }} nuevas
          </AppButton>
        </div>
      </aside>
    </div>

    <!-- Ventanas angostas: la solicitud se abre en una ventana y la bandeja usa todo el ancho -->
    <AppModal
      v-if="!wide"
      :open="!!selectedId"
      size="lg"
      title="Solicitud"
      labelled-by="solicitud-titulo"
      bare
      @update:open="!$event && closePanel()"
    >
      <div class="inq__modal">
        <InquiryPanel
          v-if="selectedId"
          :key="selectedId"
          :inquiry-id="selectedId"
          @close="closePanel"
          @changed="onChanged"
          @enroll="startEnroll"
        />
      </div>
    </AppModal>

    <EnrollDialog
      v-model:open="enrollOpen"
      :inquiry="enrolling"
      @enrolled="onEnrolled"
    />
  </div>
</template>

<style scoped>
.inq {
  display: grid;
  gap: var(--space-5);
  min-width: 0;
}

.inq :deep(.page-header) {
  margin-bottom: 0;
}

.inq__kind {
  width: min(16rem, 100%);
}

.inq__body {
  display: grid;
  grid-template-columns: minmax(25rem, 0.9fr) minmax(0, 1.1fr);
  align-items: start;
  gap: var(--space-5);
  min-width: 0;
}

.card {
  min-width: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
}

.inbox {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  padding: var(--space-3) 0 0;
}

.inbox :deep(.tabs) {
  padding-inline: var(--space-2);
}

.inbox__panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
}

.inbox__search {
  padding: var(--space-3) var(--space-4);
}

.inbox__skeleton {
  margin: var(--space-2) var(--space-4);
}

.inbox__empty {
  display: grid;
  justify-items: start;
  gap: var(--space-3);
  padding: var(--space-6) var(--space-5);
  color: var(--color-text-muted);
}

.inbox__empty p {
  margin: 0;
}

.items {
  margin: 0;
  padding: 0;
  list-style: none;
}

.item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: start;
  gap: var(--space-3);
  width: 100%;
  height: 4.5rem;
  padding: var(--space-3) var(--space-4);
  border: 0;
  border-top: 1px solid var(--color-border);
  border-left: 3px solid transparent;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.item:hover {
  background: var(--crema-50);
}

.item.is-selected {
  border-left-color: var(--aspar-rojo);
  background: var(--rosa-50);
}

.item:focus-visible {
  box-shadow: inset var(--focus-ring);
}

.item__body {
  display: grid;
  justify-items: start;
  gap: 2px;
  min-width: 0;
}

.item__name {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  max-width: 100%;
  font-weight: 700;
}

.item__dot {
  flex: none;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: var(--aspar-rojo);
}

.item__line {
  max-width: 100%;
  overflow: hidden;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item__side {
  display: grid;
  justify-items: end;
  gap: var(--space-1);
}

.item__time {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  white-space: nowrap;
}

.inbox__footer {
  padding: var(--space-2) var(--space-4);
  border-top: 1px solid var(--color-border);
}

.inq__side {
  padding: var(--space-5) var(--space-6);
}

.inq__hint {
  display: grid;
  justify-items: start;
  gap: var(--space-3);
  color: var(--color-text-muted);
}

.inq__hint p {
  margin: 0;
}

.inq__hint-title {
  font-family: var(--font-serif);
  font-size: var(--text-xl);
  font-weight: 500;
  color: var(--color-text);
}

.inq__modal {
  padding: var(--space-5);
}

@media (max-width: 1099.98px) {
  .inq__body {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 640px) {
  .inq :deep(.page-header__actions),
  .inq__kind {
    width: 100%;
  }

  .item {
    height: auto;
    min-height: 4.5rem;
  }
}

/* Ventana completa: la página no se desplaza; la bandeja muestra las que entran */
.inq--fit {
  display: flex;
  flex-direction: column;
  gap: clamp(var(--space-3), 2vh, var(--space-5));
  min-height: 0;
}

.inq--fit :deep(.page-header__title) {
  font-size: clamp(1.9rem, 4.6vh, 3.25rem);
}

.inq--fit .inq__body {
  flex: 1;
  min-height: 0;
  align-items: stretch;
  grid-template-rows: minmax(0, 1fr);
}

.inq--fit .inbox {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.inq--fit .inbox__panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.inq--fit .inbox__list {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
}

/* Pestañas compactas: las cuatro entran en la bandeja */
.inbox :deep(.tabs) {
  gap: 0;
}

.inbox :deep(.tabs__tab) {
  gap: 0.35rem;
  padding-inline: 0.5rem;
  font-size: var(--text-sm);
}

.inbox :deep(.tabs__count) {
  min-width: 1.3rem;
  padding-inline: 0.3rem;
}

/* El detalle es largo: si no entra, solo él se desplaza */
.inq--fit .inq__side {
  min-height: 0;
  overflow-y: auto;
}
</style>
