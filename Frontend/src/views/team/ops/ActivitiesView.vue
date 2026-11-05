<script setup lang="ts">
/**
 * Actividades (diseño pág. 3): la agenda del mes en lista o en calendario, lo que ya
 * pasó con su asistencia, y el editor de la actividad elegida. Los borradores no se ven
 * en el sitio; las canceladas se muestran tachadas con su aviso.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { isApiError } from '../../../api/errors'
import type { ScheduleOut } from '../../../api/types'
import ActivityEditor from '../../../components/ops/ActivityEditor.vue'
import AppAlert from '../../../components/ui/AppAlert.vue'
import AppButton from '../../../components/ui/AppButton.vue'
import AppPagination from '../../../components/ui/AppPagination.vue'
import PageHeader from '../../../components/ui/PageHeader.vue'
import SkeletonBlock from '../../../components/ui/SkeletonBlock.vue'
import StatusBadge from '../../../components/ui/StatusBadge.vue'
import { useApi } from '../../../composables/useApi'
import { useFitLayout } from '../../../composables/useFitLayout'
import { useFitRows } from '../../../composables/useFitRows'
import {
  SCHEDULE_STATUS_LABELS,
  SCHEDULE_STATUS_TONES,
  calendarDays,
  daysFromToday,
  monthBounds,
  monthOf,
  monthTitle,
  shiftMonth,
  shortDayLabel,
  spotsLabel,
  today,
  timeRange,
} from '../../../utils/ops'

const { api, session } = useApi()
const route = useRoute()
const router = useRouter()
const fit = useFitLayout()

const canEdit = computed(() => session.can('schedules:manage'))

/** Mes y vista (lista o calendario) quedan en la dirección. */
const month = ref(
  /^\d{4}-\d{2}$/.test(String(route.query.mes ?? ''))
    ? String(route.query.mes)
    : monthOf(today()),
)
const view = ref<'lista' | 'mes'>(route.query.vista === 'mes' ? 'mes' : 'lista')

const activities = ref<ScheduleOut[]>([])
const past = ref<ScheduleOut[]>([])
const loading = ref(true)
const loadError = ref<string | null>(null)

/** La actividad abierta en el editor; null: una nueva. */
const selectedId = ref<string | null>(
  typeof route.query.actividad === 'string' ? route.query.actividad : null,
)
const creating = ref(false)
const selected = computed(
  () =>
    activities.value.find((item) => item.id === selectedId.value) ??
    past.value.find((item) => item.id === selectedId.value) ??
    null,
)

/** Días del calendario con sus actividades. */
const byDay = computed(() => {
  const map = new Map<string, ScheduleOut[]>()
  for (const item of activities.value) {
    const list = map.get(item.date) ?? []
    list.push(item)
    map.set(item.date, list)
  }
  return map
})
const days = computed(() => calendarDays(month.value))

/* La agenda de la lista: en ventana completa muestra las actividades que entran */
const AGENDA_ROW = 62
const PAST_PAGE_SIZE = 3
const agendaArea = ref<HTMLElement | null>(null)
const { pageSize: agendaSize } = useFitRows(agendaArea, {
  rowHeight: AGENDA_ROW,
  fallback: 50,
  headHeight: 0,
  min: 2,
})
const agendaPage = ref(1)
const agendaItems = computed(() =>
  activities.value.slice(
    (agendaPage.value - 1) * agendaSize.value,
    agendaPage.value * agendaSize.value,
  ),
)
watch(agendaSize, () => {
  agendaPage.value = 1
})
watch(month, () => {
  agendaPage.value = 1
  pastPage.value = 1
})

const pastPage = ref(1)
const pastCount = computed(() => pastInMonth.value.length)
const pastVisible = computed(() =>
  pastInMonth.value.slice(
    (pastPage.value - 1) * PAST_PAGE_SIZE,
    pastPage.value * PAST_PAGE_SIZE,
  ),
)
const weekdays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

let request = 0

async function load() {
  const current = ++request
  loading.value = true
  loadError.value = null
  const { from, to } = monthBounds(month.value)
  try {
    const [inMonth, earlier] = await Promise.all([
      api.schedules.list({ from, to, limit: 100, offset: 0 }),
      // Lo que ya pasó: los 60 días anteriores a hoy, el más reciente primero
      api.schedules.list({
        from: daysFromToday(-60),
        to: daysFromToday(-1),
        limit: 100,
        offset: 0,
      }),
    ])
    if (current !== request) return
    activities.value = inMonth.items
    past.value = [...earlier.items].reverse()
  } catch (failure) {
    if (current !== request) return
    loadError.value = isApiError(failure)
      ? failure.message
      : 'No pudimos cargar las actividades. Intenta de nuevo.'
  } finally {
    if (current === request) loading.value = false
  }
}

function syncQuery() {
  const query: Record<string, string> = { mes: month.value }
  if (view.value !== 'lista') query.vista = view.value
  if (selectedId.value) query.actividad = selectedId.value
  void router.replace({ query })
}

watch([month, view], () => {
  syncQuery()
  void load()
})

function choose(item: ScheduleOut) {
  creating.value = false
  selectedId.value = item.id
  syncQuery()
}

function startNew() {
  creating.value = true
  selectedId.value = null
}

function onSaved(item: ScheduleOut) {
  creating.value = false
  selectedId.value = item.id
  // La vista vuelve a leer la agenda del mes y lo que ya pasó
  void load()
  syncQuery()
}

function onCancelled(item: ScheduleOut) {
  void load().then(() => {
    selectedId.value = item.id
  })
}

/** Lo que ya pasó del mes que se ve: el más reciente primero, con su asistencia. */
const pastInMonth = computed(() =>
  past.value.filter((item) => monthOf(item.date) === month.value),
)

const defaultDate = computed(() => {
  const { from } = monthBounds(month.value)
  return today().startsWith(month.value) ? today() : from
})

const todayIso = today()

onMounted(() => {
  void load()
})

function monthLabel() {
  return monthTitle(month.value)
}
</script>

<template>
  <div class="ops" :class="{ 'ops--fit': fit }">
    <PageHeader
      title="Actividades"
      subtitle="Prepara la agenda y decide qué encuentros se ven en el sitio."
    >
      <template v-if="canEdit" #actions>
        <AppButton size="lg" @click="startNew">+ Nueva actividad</AppButton>
      </template>
    </PageHeader>

    <div class="ops__body">
      <div class="ops__left">
        <section class="card" aria-labelledby="agenda-titulo">
          <header class="card__head">
            <div class="month">
              <button
                type="button"
                class="month__step"
                aria-label="Mes anterior"
                @click="month = shiftMonth(month, -1)"
              >
                ‹
              </button>
              <h2 id="agenda-titulo" class="month__title">
                {{ monthLabel() }}
              </h2>
              <button
                type="button"
                class="month__step"
                aria-label="Mes siguiente"
                @click="month = shiftMonth(month, 1)"
              >
                ›
              </button>
            </div>
            <div class="toggle" role="group" aria-label="Vista de la agenda">
              <button
                type="button"
                :aria-pressed="view === 'lista'"
                :class="{ 'is-on': view === 'lista' }"
                @click="view = 'lista'"
              >
                Lista
              </button>
              <button
                type="button"
                :aria-pressed="view === 'mes'"
                :class="{ 'is-on': view === 'mes' }"
                @click="view = 'mes'"
              >
                Mes
              </button>
            </div>
          </header>

          <AppAlert v-if="loadError" tone="error">
            {{ loadError }}
            <AppButton variant="link" size="sm" @click="load"
              >Reintentar</AppButton
            >
          </AppAlert>

          <SkeletonBlock
            v-if="loading && !activities.length"
            :lines="4"
            height="2.75rem"
          />

          <div
            v-else-if="view === 'lista'"
            ref="agendaArea"
            class="agenda-area"
          >
            <ol class="agenda">
              <li v-if="!activities.length" class="agenda__empty">
                Todavía no hay actividades este mes.
              </li>
              <li v-for="item in agendaItems" :key="item.id">
                <button
                  type="button"
                  class="row"
                  :class="{ 'is-selected': item.id === selectedId }"
                  :aria-current="item.id === selectedId || undefined"
                  @click="choose(item)"
                >
                  <span class="row__day">
                    <strong>{{ Number(item.date.slice(8)) }}</strong>
                    <small>{{ shortDayLabel(item.date).split(' ')[1] }}</small>
                  </span>
                  <span
                    class="row__text"
                    :class="{ 'is-struck': item.status === 'cancelada' }"
                  >
                    <strong>{{ item.title }}</strong>
                    <small
                      >{{ item.categoryLabel }} ·
                      {{ item.professionalName || 'Sin responsable' }} ·
                      {{ timeRange(item.startTime, item.endTime) }}</small
                    >
                  </span>
                  <span class="row__meta">
                    <small>{{ spotsLabel(item) }}</small>
                    <StatusBadge :tone="SCHEDULE_STATUS_TONES[item.status]">{{
                      SCHEDULE_STATUS_LABELS[item.status]
                    }}</StatusBadge>
                  </span>
                </button>
              </li>
            </ol>
            <AppPagination
              v-if="activities.length > agendaSize"
              :total="activities.length"
              :limit="agendaSize"
              :offset="(agendaPage - 1) * agendaSize"
              :count="agendaItems.length"
              label="Páginas de la agenda"
              @change="agendaPage = Math.floor($event / agendaSize) + 1"
            />
          </div>

          <div
            v-else
            class="calendar"
            role="grid"
            :aria-label="`Calendario de ${monthLabel()}`"
          >
            <div class="calendar__head" role="row">
              <span v-for="name in weekdays" :key="name" role="columnheader">{{
                name
              }}</span>
            </div>
            <div class="calendar__grid">
              <template
                v-for="(day, index) in days"
                :key="day ?? `vacio-${index}`"
              >
                <div v-if="!day" class="cell cell--empty" aria-hidden="true" />
                <div
                  v-else
                  class="cell"
                  :class="{ 'is-today': day === todayIso }"
                >
                  <span class="cell__num">{{ Number(day.slice(8)) }}</span>
                  <button
                    v-for="item in byDay.get(day) ?? []"
                    :key="item.id"
                    type="button"
                    class="chip"
                    :class="[
                      `chip--${item.status}`,
                      { 'is-selected': item.id === selectedId },
                    ]"
                    :aria-label="`${item.title}, ${SCHEDULE_STATUS_LABELS[item.status]}`"
                    @click="choose(item)"
                  >
                    {{ item.title }}
                  </button>
                </div>
              </template>
            </div>
          </div>

          <p class="card__note">
            Los borradores no aparecen en el sitio. Una actividad cancelada se
            sigue mostrando, tachada, para que nadie llegue en vano.
          </p>
        </section>

        <section class="card card--past" aria-labelledby="pasado-titulo">
          <h2 id="pasado-titulo" class="card__title">
            Lo que ya pasó en {{ monthLabel().split(' ')[0]?.toLowerCase() }}
          </h2>
          <p v-if="!pastCount" class="card__empty">
            Todavía no hay encuentros pasados este mes.
          </p>
          <table v-else class="past">
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Actividad</th>
                <th scope="col" class="num">Vinieron</th>
                <th scope="col">
                  <span class="visually-hidden">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in pastVisible" :key="item.id">
                <td>{{ shortDayLabel(item.date) }}</td>
                <td>{{ item.title }}</td>
                <td class="num">{{ item.came }}</td>
                <td>
                  <RouterLink
                    :to="{ name: 'asistencia', query: { actividad: item.id } }"
                    class="link"
                  >
                    Asistencia
                  </RouterLink>
                </td>
              </tr>
            </tbody>
          </table>
          <AppPagination
            v-if="pastCount > PAST_PAGE_SIZE"
            :total="pastCount"
            :limit="PAST_PAGE_SIZE"
            :offset="(pastPage - 1) * PAST_PAGE_SIZE"
            :count="pastVisible.length"
            label="Páginas de lo que ya pasó"
            @change="pastPage = Math.floor($event / PAST_PAGE_SIZE) + 1"
          />
        </section>
      </div>

      <div class="ops__right">
        <ActivityEditor
          v-if="creating || selected"
          :key="creating ? 'nueva' : selected!.id"
          :schedule="creating ? null : selected"
          :default-date="defaultDate"
          @saved="onSaved"
          @cancelled="onCancelled"
        />
        <section v-else class="card card--hint" aria-labelledby="sin-elegir">
          <h2 id="sin-elegir" class="card__title">Elige una actividad</h2>
          <p>
            Toca una actividad de la agenda para editarla, o crea una nueva con
            «+ Nueva actividad».
          </p>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ops {
  display: grid;
  gap: var(--space-6);
  min-width: 0;
}

.ops :deep(.page-header) {
  margin-bottom: 0;
}

.ops__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(19rem, 25rem);
  gap: var(--space-5);
  align-items: start;
  min-width: 0;
}

.ops__left,
.ops__right {
  display: grid;
  gap: var(--space-5);
  align-content: start;
  min-width: 0;
}

.card {
  display: grid;
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

.card__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.card__title {
  font-family: var(--font-serif);
  font-size: var(--text-xl);
  font-weight: 500;
  color: var(--color-text);
}

.card__note,
.card__empty {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.month {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.month__title {
  font-family: var(--font-serif);
  font-size: var(--text-xl);
  font-weight: 500;
  color: var(--color-text);
  min-width: 11rem;
  text-align: center;
}

.month__step {
  width: 2.2rem;
  height: 2.2rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: var(--text-lg);
  cursor: pointer;
}

.toggle {
  display: inline-flex;
  padding: 0.2rem;
  border-radius: var(--radius-sm);
  background: var(--color-surface-muted);
}

.toggle button {
  min-height: 2.1rem;
  padding: 0 var(--space-4);
  border: 0;
  border-radius: calc(var(--radius-sm) - 2px);
  background: transparent;
  color: var(--color-text-muted);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.toggle button.is-on {
  background: var(--aspar-verde);
  color: #fff;
}

.agenda-area {
  display: grid;
  gap: var(--space-2);
  min-height: 0;
}

.agenda {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.agenda__empty {
  padding: var(--space-4) 0;
  color: var(--color-text-muted);
}

.row {
  display: grid;
  grid-template-columns: 3.25rem minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-3) var(--space-3);
  border: 0;
  border-bottom: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.row:hover {
  background: var(--color-surface-muted);
}

.row.is-selected {
  background: var(--rosa-50);
  box-shadow: inset 3px 0 0 var(--aspar-rojo);
}

.row__day {
  display: grid;
  justify-items: center;
  padding: 0.25rem 0;
  border-radius: var(--radius-sm);
  background: var(--rosa-100);
  color: var(--guindo-700);
  font-family: var(--font-serif);
  line-height: 1.05;
}

.row__day strong {
  font-size: var(--text-xl);
  font-weight: 500;
}

.row__day small {
  font-family: var(--font-sans);
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
}

.row__text {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
}

.row__text strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row__text small,
.row__meta small {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row__meta {
  display: grid;
  justify-items: end;
  gap: 0.2rem;
}

.is-struck strong {
  text-decoration: line-through;
  color: var(--color-text-muted);
}

.calendar {
  display: grid;
  gap: var(--space-1);
}

.calendar__head,
.calendar__grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
}

.calendar__head span {
  color: var(--color-text-subtle);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-align: center;
  text-transform: uppercase;
}

.cell {
  display: grid;
  align-content: start;
  gap: 2px;
  min-height: 4.4rem;
  padding: 4px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  min-width: 0;
}

.cell--empty {
  border-color: transparent;
  background: transparent;
}

.cell.is-today {
  border-color: var(--aspar-guindo);
}

.cell__num {
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  font-variant-numeric: tabular-nums;
}

.chip {
  overflow: hidden;
  padding: 1px 4px;
  border: 0;
  border-radius: 4px;
  background: var(--verde-100);
  color: var(--verde-900);
  font: inherit;
  font-size: 0.68rem;
  font-weight: 700;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.chip--borrador {
  background: var(--tone-warning-bg);
  color: var(--tone-warning-fg);
}

.chip--cancelada {
  background: var(--tone-neutral-bg);
  color: var(--tone-neutral-fg);
  text-decoration: line-through;
}

.chip.is-selected {
  box-shadow: 0 0 0 2px var(--aspar-guindo);
}

.past {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
}

.past th,
.past td {
  padding: var(--space-2) var(--space-2);
  border-bottom: 1px solid var(--color-border);
  text-align: left;
}

.past th {
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.past .num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.link {
  color: var(--color-link);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 0.25em;
}

@media (max-width: 1100px) {
  .ops__body {
    grid-template-columns: minmax(0, 1fr);
  }
}

/* Ventana completa: la página no se desplaza; la agenda y el editor reparten el alto */
.ops--fit {
  display: flex;
  flex-direction: column;
  gap: clamp(var(--space-3), 2.4vh, var(--space-6));
  min-height: 0;
}

.ops--fit :deep(.page-header__title) {
  font-size: clamp(1.9rem, 4.6vh, 3.25rem);
}

.ops--fit .ops__body {
  flex: 1;
  min-height: 0;
  align-items: stretch;
  grid-template-columns: minmax(0, 1fr) clamp(19rem, 27vw, 25rem);
  grid-template-rows: minmax(0, 1fr);
}

.ops--fit .ops__left {
  min-height: 0;
  grid-template-rows: minmax(0, 1fr) auto;
}

.ops--fit .ops__right {
  min-height: 0;
  overflow-y: auto;
}

.ops--fit .card {
  gap: clamp(var(--space-2), 1.4vh, var(--space-3));
  padding: clamp(var(--space-3), 1.8vh, var(--space-5)) var(--space-6);
}

.ops--fit .agenda .row {
  /* La misma altura que calcula la paginación (AGENDA_ROW) */
  height: 62px;
  padding-block: 0;
}

.ops--fit .agenda-area {
  flex: 1 1 0;
  align-content: start;
  overflow: hidden;
}

.ops--fit .card--past .past th,
.ops--fit .card--past .past td {
  padding-block: 0.3rem;
}

.ops--fit .calendar__grid .cell {
  min-height: clamp(3.4rem, 9vh, 5.5rem);
}
</style>
