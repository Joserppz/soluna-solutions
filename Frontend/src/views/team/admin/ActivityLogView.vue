<script setup lang="ts">
/**
 * Registro de actividad (diseño pág. 19): lo que pasa en el espacio del equipo, quién
 * lo hizo y cuándo, agrupado por día. Filtros por área, persona o afiliado, situaciones
 * para revisar y días; resumen de la semana por área y descarga del registro. Nada se
 * edita ni se borra. Los filtros quedan en la dirección.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { isApiError } from '../../../api/errors'
import type { AuditArea, AuditPage, AuditSummary } from '../../../api/types'
import AppAlert from '../../../components/ui/AppAlert.vue'
import AppButton from '../../../components/ui/AppButton.vue'
import PageHeader from '../../../components/ui/PageHeader.vue'
import SkeletonBlock from '../../../components/ui/SkeletonBlock.vue'
import { useApi } from '../../../composables/useApi'
import { useFitLayout } from '../../../composables/useFitLayout'
import { useToast } from '../../../composables/useToast'
import {
  AUDIT_AREAS,
  DAY_OPTIONS,
  SUMMARY_AREAS,
  actorLabel,
  dayKey,
  groupByDay,
  readableDetail,
  reviewSentence,
  timeOfDay,
} from '../../../utils/audit'
import { saveBlob } from '../../../utils/download'
import { todayIso } from '../../../utils/format'
import { rangeLabel, rowsThatFit } from '../../../utils/pagination'
import { normalizeSearch } from '../../../utils/patients'

/** Movimientos por página cuando la página se desplaza (celular). */
const SCROLL_PAGE_SIZE = 25
/** Alto de cada movimiento y de cada encabezado de día en «ventana completa» (px). */
const ENTRY_HEIGHT = 52
const DAY_HEIGHT = 40
const SEARCH_DELAY = 300
const DEFAULT_DAYS = 7

const { api } = useApi()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const fit = useFitLayout()

function text(key: string): string {
  const value = route.query[key]
  return typeof value === 'string' ? value : ''
}

const searchInput = ref(text('buscar'))
const search = ref(normalizeSearch(searchInput.value))
const area = ref<AuditArea | ''>(
  AUDIT_AREAS.some((item) => item.key === text('area'))
    ? (text('area') as AuditArea)
    : '',
)
const review = ref(text('revisar') === '1')
const days = ref(
  DAY_OPTIONS.some((option) => String(option.days) === text('dias'))
    ? Number(text('dias'))
    : DEFAULT_DAYS,
)

const page = ref<AuditPage | null>(null)
const loading = ref(true)
const loadError = ref<string | null>(null)
const offset = ref(0)
/** Dónde empezaba cada página anterior, para volver con «Más recientes». */
const previous = ref<number[]>([])
const summary = ref<AuditSummary | null>(null)
const downloading = ref(false)

// En escritorio la página no se desplaza: entran los movimientos que caben
const listArea = ref<HTMLElement | null>(null)
const areaHeight = ref(0)

const capacity = computed(() =>
  fit.value && areaHeight.value
    ? rowsThatFit(areaHeight.value - DAY_HEIGHT, ENTRY_HEIGHT)
    : SCROLL_PAGE_SIZE,
)

/** Cuántos de los movimientos que llegaron entran, contando sus encabezados de día. */
const shownCount = computed(() => {
  const items = page.value?.items ?? []
  if (!fit.value || !areaHeight.value) return items.length
  let used = 0
  let lastDay = ''
  let shown = 0
  for (const event of items) {
    const day = dayKey(event.date)
    const extra = (day !== lastDay ? DAY_HEIGHT : 0) + ENTRY_HEIGHT
    if (used + extra > areaHeight.value) break
    used += extra
    lastDay = day
    shown += 1
  }
  return Math.max(1, shown)
})

const groups = computed(() =>
  groupByDay((page.value?.items ?? []).slice(0, shownCount.value)),
)
const total = computed(() => page.value?.total ?? 0)
const hasOlder = computed(() => offset.value + shownCount.value < total.value)
const filtered = computed(() =>
  Boolean(search.value || area.value || review.value),
)

const emptyMessage = computed(() => {
  const period =
    DAY_OPTIONS.find((option) => option.days === days.value)?.label ?? ''
  if (review.value)
    return `No hubo situaciones para revisar (${period.toLocaleLowerCase('es')}).`
  if (search.value)
    return `No hay actividad de «${search.value}» con estos filtros (${period.toLocaleLowerCase('es')}).`
  return `No hay actividad con estos filtros (${period.toLocaleLowerCase('es')}).`
})

/** La semana, por área: las del diseño y el resto juntas en «Otras áreas». */
const weekRows = computed(() => {
  const areas = summary.value?.areas ?? []
  const main = SUMMARY_AREAS.map((key) =>
    areas.find((item) => item.area === key),
  )
    .filter((item) => item !== undefined)
    .map((item) => ({
      key: item.area as AuditArea,
      label: item.label,
      count: item.count,
    }))
  const others = areas
    .filter((item) => !SUMMARY_AREAS.includes(item.area as AuditArea))
    .reduce((sum, item) => sum + item.count, 0)
  return { main, others }
})
const weekMax = computed(() =>
  Math.max(1, ...weekRows.value.main.map((row) => row.count)),
)

function filters() {
  return {
    search: search.value || undefined,
    area: area.value || undefined,
    review: review.value || undefined,
    days: days.value,
  }
}

let request = 0

async function load() {
  const current = ++request
  loading.value = true
  loadError.value = null
  try {
    const result = await api.audit.list({
      ...filters(),
      limit: capacity.value,
      offset: offset.value,
    })
    if (current !== request) return
    page.value = result
  } catch (failure) {
    if (current !== request) return
    loadError.value = isApiError(failure)
      ? failure.message
      : 'No pudimos cargar el registro. Intenta de nuevo.'
  } finally {
    if (current === request) loading.value = false
  }
}

async function loadSummary() {
  try {
    summary.value = await api.audit.summary(7)
  } catch {
    summary.value = null
  }
}

function syncQuery() {
  const query: Record<string, string> = {}
  if (search.value) query.buscar = search.value
  if (area.value) query.area = area.value
  if (review.value) query.revisar = '1'
  if (days.value !== DEFAULT_DAYS) query.dias = String(days.value)
  void router.replace({ query })
}

/** Un filtro nuevo vuelve a los movimientos más recientes. */
function restart() {
  offset.value = 0
  previous.value = []
  syncQuery()
  void load()
}

watch([search, area, review, days], restart)

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(searchInput, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    search.value = normalizeSearch(value)
  }, SEARCH_DELAY)
})

function searchNow() {
  clearTimeout(searchTimer)
  search.value = normalizeSearch(searchInput.value)
}

function clearFilters() {
  clearTimeout(searchTimer)
  searchInput.value = ''
  search.value = ''
  area.value = ''
  review.value = false
}

function older() {
  previous.value = [...previous.value, offset.value]
  offset.value += shownCount.value
  void load()
}

function newer() {
  offset.value = previous.value[previous.value.length - 1] ?? 0
  previous.value = previous.value.slice(0, -1)
  void load()
}

function showReview() {
  review.value = true
  if (days.value < 7) days.value = 7
}

function showArea(key: AuditArea) {
  area.value = area.value === key ? '' : key
}

async function download() {
  downloading.value = true
  try {
    const blob = await api.audit.download({ ...filters(), format: 'xlsx' })
    saveBlob(blob, `registro-de-actividad-${todayIso()}.xlsx`)
    toast.success('Descargamos el registro. La descarga también quedó anotada.')
    // La descarga queda en el propio registro
    void load()
    void loadSummary()
  } catch (failure) {
    toast.error(
      isApiError(failure)
        ? failure.message
        : 'No pudimos descargar el registro. Intenta de nuevo.',
    )
  } finally {
    downloading.value = false
  }
}

function measure() {
  areaHeight.value = listArea.value?.clientHeight ?? 0
}

// Si cambia cuántos movimientos entran (ventana más alta o más baja), se vuelve a
// pedir la misma página con el nuevo tamaño
let ready = false
watch(capacity, () => {
  if (ready) void load()
})

let resizeTimer: ReturnType<typeof setTimeout> | undefined
let resize: ResizeObserver | null = null

onMounted(async () => {
  await nextTick()
  measure()
  if (typeof ResizeObserver !== 'undefined' && listArea.value) {
    resize = new ResizeObserver(() => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(measure, 120)
    })
    resize.observe(listArea.value)
  }
  await nextTick()
  ready = true
  void load()
  void loadSummary()
})

onBeforeUnmount(() => {
  resize?.disconnect()
  clearTimeout(resizeTimer)
  clearTimeout(searchTimer)
})
</script>

<template>
  <div class="log" :class="{ 'log--fit': fit }">
    <PageHeader
      title="Registro de actividad"
      subtitle="Lo que pasa en el espacio del equipo, quién lo hizo y cuándo."
    >
      <template #actions>
        <AppButton
          variant="secondary"
          size="lg"
          :loading="downloading"
          loading-label="Preparando la descarga…"
          @click="download"
        >
          Descargar registro
        </AppButton>
      </template>
    </PageHeader>

    <div class="log__body">
      <section class="log__card surface-card" aria-label="Movimientos">
        <form class="toolbar" role="search" @submit.prevent="searchNow">
          <label class="visually-hidden" for="buscar-registro">
            Buscar persona o afiliado
          </label>
          <span class="toolbar__search">
            <span class="toolbar__icon" aria-hidden="true">⌕</span>
            <input
              id="buscar-registro"
              v-model="searchInput"
              class="input"
              type="search"
              placeholder="Buscar persona o afiliado"
              autocomplete="off"
            />
          </span>
          <label class="visually-hidden" for="filtro-area">Área</label>
          <select id="filtro-area" v-model="area" class="select">
            <option value="">Todas las áreas</option>
            <option
              v-for="item in AUDIT_AREAS"
              :key="item.key"
              :value="item.key"
            >
              {{ item.label }}
            </option>
          </select>
          <label class="visually-hidden" for="filtro-revisar"
            >Qué mostrar</label
          >
          <select id="filtro-revisar" v-model="review" class="select">
            <option :value="false">Todo</option>
            <option :value="true">Solo para revisar</option>
          </select>
          <label class="visually-hidden" for="filtro-dias">Período</label>
          <select id="filtro-dias" v-model="days" class="select">
            <option
              v-for="option in DAY_OPTIONS"
              :key="option.days"
              :value="option.days"
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
          ref="listArea"
          class="log__list"
          :class="{ 'is-refreshing': loading && page }"
          aria-live="polite"
          :aria-busy="loading"
        >
          <div v-if="loading && !page" class="log__skeleton">
            <SkeletonBlock width="14rem" height="1.25rem" />
            <SkeletonBlock v-for="n in 5" :key="n" height="2.5rem" />
          </div>

          <div v-else-if="page && !page.items.length" class="log__empty">
            <p>{{ emptyMessage }}</p>
            <AppButton
              v-if="filtered"
              variant="link"
              size="sm"
              @click="clearFilters"
            >
              Quitar la búsqueda y los filtros
            </AppButton>
          </div>

          <template v-else>
            <section
              v-for="group in groups"
              :key="group.key"
              class="day"
              :aria-labelledby="`dia-${group.key}`"
            >
              <h2 :id="`dia-${group.key}`" class="day__title">
                {{ group.heading }}
              </h2>
              <ol class="day__events">
                <li
                  v-for="event in group.events"
                  :key="event.id"
                  class="entry"
                  :class="{ 'is-review': event.review }"
                >
                  <time class="entry__time" :datetime="event.date">
                    {{ timeOfDay(event.date) }}
                  </time>
                  <div class="entry__text">
                    <p class="entry__line">
                      <strong>{{ actorLabel(event) }}</strong>
                      <span class="entry__sep" aria-hidden="true"> · </span>
                      <span>{{ event.action }}</span>
                    </p>
                    <p
                      class="entry__detail"
                      :title="readableDetail(event.detail)"
                    >
                      {{ readableDetail(event.detail) }}
                      <template v-if="event.occurrences > 1">
                        · {{ event.occurrences }} veces
                      </template>
                    </p>
                  </div>
                  <span class="entry__tags">
                    <span v-if="event.review" class="entry__review">
                      Para revisar
                    </span>
                    <span class="entry__area">
                      {{ event.areaLabel ?? event.category }}
                    </span>
                  </span>
                </li>
              </ol>
            </section>
          </template>
        </div>

        <footer class="log__footer">
          <p class="log__range" aria-live="polite">
            <template v-if="page">
              {{ rangeLabel(offset, shownCount, total) }}
            </template>
          </p>
          <div class="log__pages">
            <AppButton
              v-if="previous.length"
              variant="link"
              size="sm"
              @click="newer"
            >
              ← Más recientes
            </AppButton>
            <AppButton v-if="hasOlder" variant="link" size="sm" @click="older">
              Ver días anteriores →
            </AppButton>
          </div>
        </footer>
      </section>

      <aside class="log__side" aria-label="Resumen del registro">
        <section class="side-card side-card--lock">
          <span class="side-card__icon" aria-hidden="true">
            <svg viewBox="0 0 16 16">
              <path
                d="M4.5 7V5a3.5 3.5 0 0 1 7 0v2h.5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h.5Zm1.5 0h4V5a2 2 0 1 0-4 0v2Z"
              />
            </svg>
          </span>
          <div>
            <h2>Nada se puede editar ni borrar</h2>
            <p>
              Este registro protege a las personas que acompañamos y al equipo.
              Solo Administración puede consultarlo.
            </p>
          </div>
        </section>

        <section class="side-card" aria-labelledby="esta-semana">
          <h2 id="esta-semana">Esta semana</h2>
          <SkeletonBlock v-if="!summary" :lines="5" />
          <ul v-else class="week">
            <li v-for="row in weekRows.main" :key="row.key">
              <button
                type="button"
                class="week__row"
                :class="{ 'is-active': area === row.key }"
                :aria-pressed="area === row.key"
                :aria-label="`${row.label}: ${row.count} movimientos. Ver solo esta área`"
                @click="showArea(row.key)"
              >
                <span class="week__label">{{ row.label }}</span>
                <span class="week__track" aria-hidden="true">
                  <span
                    class="week__bar"
                    :style="{
                      width: `${Math.max(3, (row.count / weekMax) * 100)}%`,
                    }"
                  />
                </span>
                <span class="week__count">{{ row.count }}</span>
              </button>
            </li>
            <li v-if="weekRows.others" class="week__others">
              Otras áreas: {{ weekRows.others }}
            </li>
          </ul>
        </section>

        <section
          v-if="summary && summary.review.total"
          class="review-alert"
          role="status"
          data-testid="situaciones-para-revisar"
        >
          <strong>
            {{
              summary.review.total === 1
                ? '1 situación para revisar'
                : `${summary.review.total} situaciones para revisar`
            }}
          </strong>
          <p>{{ reviewSentence(summary.review) }} Se resaltan en la lista.</p>
          <AppButton
            v-if="!review"
            variant="link"
            size="sm"
            @click="showReview"
          >
            Ver solo estas
          </AppButton>
        </section>
        <p v-else-if="summary" class="review-calm">
          Sin situaciones para revisar esta semana.
        </p>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.log {
  display: grid;
  gap: var(--space-6);
  min-width: 0;
}

.log :deep(.page-header) {
  margin-bottom: 0;
}

.log__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(16rem, 20rem);
  gap: var(--space-5);
  align-items: start;
  min-width: 0;
}

.log__card {
  display: grid;
  gap: var(--space-4);
  min-width: 0;
  padding: var(--space-5) var(--space-6);
  container-type: inline-size;
}

.toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) repeat(3, minmax(0, 1fr));
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

.log__list {
  display: grid;
  align-content: start;
  min-width: 0;
  transition: opacity var(--duration-base) var(--ease-out);
}

.log__list.is-refreshing {
  opacity: 0.6;
}

.log__skeleton {
  display: grid;
  gap: var(--space-3);
}

.log__empty {
  display: grid;
  justify-items: start;
  gap: var(--space-2);
  padding: var(--space-6) 0;
  color: var(--color-text-muted);
}

.day__title {
  display: flex;
  align-items: flex-end;
  height: 2.5rem;
  padding-bottom: var(--space-1);
  color: var(--color-heading);
  font-family: var(--font-serif);
  font-size: var(--text-lg);
  font-weight: 500;
}

.day__events {
  margin: 0;
  padding: 0;
  list-style: none;
}

.entry {
  display: grid;
  grid-template-columns: 3.5rem minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  min-height: 3.25rem;
  padding: 0.35rem var(--space-3);
  border-bottom: 1px solid var(--color-border);
}

.entry.is-review {
  border-radius: var(--radius-sm);
  background: var(--rosa-50);
  box-shadow: inset 3px 0 0 var(--aspar-rojo);
}

.entry__time {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  font-variant-numeric: tabular-nums;
}

.entry__text {
  display: grid;
  min-width: 0;
  line-height: var(--leading-snug);
}

.entry__line,
.entry__detail {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entry__line {
  font-size: var(--text-sm);
}

.entry__line strong {
  font-weight: 700;
}

.entry__detail {
  color: var(--color-text-muted);
  font-size: var(--text-xs);
}

.entry__tags {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.entry__area {
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
}

.entry__review {
  padding: 0.05rem 0.5rem;
  border-radius: var(--radius-pill);
  background: var(--tone-danger-bg);
  color: var(--tone-danger-fg);
  font-size: var(--text-xs);
  font-weight: 700;
  white-space: nowrap;
}

.log__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2) var(--space-4);
  min-height: 2.25rem;
}

.log__range {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.log__pages {
  display: flex;
  gap: var(--space-4);
}

.log__pages :deep(.btn) {
  font-weight: 700;
}

.log__side {
  display: grid;
  gap: var(--space-4);
  min-width: 0;
}

.side-card {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
}

.side-card h2 {
  font-family: var(--font-sans);
  font-size: var(--text-md);
  font-weight: 700;
  color: var(--color-text);
}

.side-card p {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.side-card--lock {
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
}

.side-card--lock > div {
  display: grid;
  gap: var(--space-1);
}

.side-card__icon {
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: var(--radius-sm);
  background: var(--rosa-100);
  color: var(--aspar-rojo);
}

.side-card__icon svg {
  width: 1.1rem;
  height: 1.1rem;
  fill: currentColor;
}

.week {
  display: grid;
  gap: 0.15rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.week__row {
  display: grid;
  grid-template-columns: 6.5rem minmax(0, 1fr) 2.75rem;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: 0.3rem var(--space-2);
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text);
  font: inherit;
  font-size: var(--text-sm);
  text-align: left;
  cursor: pointer;
}

.week__row:hover,
.week__row.is-active {
  background: var(--color-surface-muted);
}

.week__row.is-active .week__label {
  font-weight: 700;
}

.week__track {
  height: 0.45rem;
  border-radius: var(--radius-pill);
  background: var(--color-surface-sunken);
  overflow: hidden;
}

.week__bar {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--aspar-verde);
}

.week__count {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.week__others {
  padding: 0.3rem var(--space-2) 0;
  color: var(--color-text-muted);
  font-size: var(--text-xs);
}

.review-alert {
  display: grid;
  justify-items: start;
  gap: var(--space-1);
  padding: var(--space-4) var(--space-5);
  border-radius: var(--radius-lg);
  background: var(--rosa-100);
  color: var(--guindo-700);
}

.review-alert p {
  font-size: var(--text-sm);
}

.review-calm {
  padding: 0 var(--space-2);
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

/* Tarjeta angosta (1366×768): el buscador arriba y los tres filtros debajo */
@container (max-width: 46rem) {
  .toolbar {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .toolbar__search {
    grid-column: 1 / -1;
  }
}

@container (max-width: 28rem) {
  .toolbar {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 1100px) {
  .log__body {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 640px) {
  .log__card {
    padding: var(--space-4);
  }

  .entry {
    grid-template-columns: 3rem minmax(0, 1fr);
  }

  .entry__tags {
    grid-column: 2;
  }
}

/* Ventana completa: la página no se desplaza. La lista ocupa el alto que queda y
   muestra los movimientos que entran; «Ver días anteriores» trae los siguientes */
.log--fit {
  display: flex;
  flex-direction: column;
  gap: clamp(var(--space-3), 2.4vh, var(--space-6));
  min-height: 0;
}

.log--fit :deep(.page-header__title) {
  font-size: clamp(1.9rem, 4.6vh, 3.25rem);
}

.log--fit :deep(.page-header__subtitle) {
  font-size: var(--text-md);
}

.log--fit .log__body {
  flex: 1;
  grid-template-columns: minmax(0, 1fr) clamp(16rem, 23vw, 21rem);
  grid-template-rows: minmax(0, 1fr);
  align-items: stretch;
  min-height: 0;
}

.log--fit .log__card {
  display: flex;
  flex-direction: column;
  gap: clamp(var(--space-2), 1.6vh, var(--space-4));
  min-height: 0;
  padding: clamp(var(--space-3), 2vh, var(--space-5)) var(--space-6);
}

.log--fit .log__list {
  flex: 1;
  display: block;
  min-height: 0;
  overflow: hidden;
}

/* Altos fijos: así se sabe cuántos movimientos entran */
.log--fit .day__title {
  height: 40px;
}

.log--fit .entry {
  height: 52px;
  min-height: 0;
  padding-block: 0;
}

.log--fit .log__footer {
  flex: none;
  flex-wrap: nowrap;
  height: 2.25rem;
}

.log--fit .log__side {
  align-content: start;
  min-height: 0;
  overflow-y: auto;
}

@media (max-height: 860px) {
  .log--fit .side-card {
    gap: var(--space-2);
    padding: var(--space-4);
  }
}
</style>
