<script setup lang="ts">
/**
 * Actividades (diseño pág. 12): la agenda del mes en lista o en calendario ocupa la
 * pantalla, y a la derecha «Lo que ya pasó» con su asistencia. Crear o editar una
 * actividad abre una ventana, como «Registrar afiliado». Los borradores no se ven en
 * el sitio; las canceladas se muestran tachadas con su aviso.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { isApiError } from '../../../api/errors'
import type { ScheduleOut } from '../../../api/types'
import ActivityDialog from '../../../components/ops/ActivityDialog.vue'
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
  weekdayShort,
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
const todayIso = today()

/* La ventana de la actividad: null es una nueva */
const dialogOpen = ref(false)
const editing = ref<ScheduleOut | null>(null)
const selectedId = computed(() =>
  dialogOpen.value ? (editing.value?.id ?? null) : null,
)

/* La agenda de la lista: en ventana completa muestra las actividades que entran */
const AGENDA_ROW = 62
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
})

/* El calendario: cada día muestra hasta dos actividades y «+N» si hay más */
const CHIPS_PER_DAY = 2
const weekdays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const days = computed(() => calendarDays(month.value))
const weeks = computed(() => Math.ceil(days.value.length / 7))
const byDay = computed(() => {
  const map = new Map<string, ScheduleOut[]>()
  for (const item of activities.value) {
    const list = map.get(item.date) ?? []
    list.push(item)
    map.set(item.date, list)
  }
  return map
})

/** Solo cuenta lo que se hizo: las canceladas y los borradores no tienen asistencia. */
const pastHeld = computed(() =>
  past.value.filter(
    (item) => item.status === 'publicada' && item.date < todayIso,
  ),
)

let request = 0

async function load() {
  const current = ++request
  loading.value = true
  loadError.value = null
  const { from, to } = monthBounds(month.value)
  try {
    const [inMonth, earlier] = await Promise.all([
      api.schedules.list({ from, to, limit: 100, offset: 0 }),
      // Lo que ya pasó: los cuatro meses anteriores a hoy, el más reciente primero
      api.schedules.list({
        from: daysFromToday(-120),
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
watch(dialogOpen, syncQuery)

function choose(item: ScheduleOut) {
  editing.value = item
  dialogOpen.value = true
}

function startNew() {
  editing.value = null
  dialogOpen.value = true
}

function onSaved() {
  // La vista vuelve a leer la agenda del mes y lo que ya pasó
  void load()
}

/** Un enlace con ?actividad= abre esa actividad, aunque sea de otro mes. */
async function openLinked() {
  const id = route.query.actividad
  if (typeof id !== 'string' || !id) return
  const found =
    activities.value.find((item) => item.id === id) ??
    past.value.find((item) => item.id === id)
  try {
    choose(found ?? (await api.schedules.get(id)))
  } catch {
    syncQuery()
  }
}

const defaultDate = computed(() => {
  const { from } = monthBounds(month.value)
  return todayIso.startsWith(month.value) && todayIso >= from ? todayIso : from
})

onMounted(async () => {
  await load()
  await openLinked()
})

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** «Sáb 31 oct» */
function shortDay(isoDay: string) {
  return `${capitalize(weekdayShort(isoDay))} ${shortDayLabel(isoDay)}`
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
      <section class="card agenda-card" aria-labelledby="agenda-titulo">
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
              {{ monthTitle(month) }}
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

        <template v-else-if="view === 'lista'">
          <div ref="agendaArea" class="agenda-area">
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
                    <strong>{{ item.date.slice(8) }}</strong>
                    <small>{{ weekdayShort(item.date) }}</small>
                  </span>
                  <span
                    class="row__text"
                    :class="{ 'is-struck': item.status === 'cancelada' }"
                  >
                    <strong>{{ item.title }}</strong>
                    <small v-if="item.status === 'cancelada'"
                      >{{ item.categoryLabel }} ·
                      {{ item.cancellationNote || 'Cancelada' }}</small
                    >
                    <small v-else
                      >{{ item.categoryLabel }} ·
                      {{ item.professionalName || 'Sin responsable' }} ·
                      {{ timeRange(item.startTime, item.endTime) }}</small
                    >
                  </span>
                  <span class="row__meta">
                    <small
                      :aria-label="
                        item.spots === null ? 'Sin cupos definidos' : undefined
                      "
                      >{{
                        item.spots === null || item.status === 'cancelada'
                          ? '—'
                          : spotsLabel(item)
                      }}</small
                    >
                    <StatusBadge :tone="SCHEDULE_STATUS_TONES[item.status]">{{
                      SCHEDULE_STATUS_LABELS[item.status]
                    }}</StatusBadge>
                  </span>
                </button>
              </li>
            </ol>
          </div>
          <AppPagination
            v-if="activities.length > agendaSize"
            :total="activities.length"
            :limit="agendaSize"
            :offset="(agendaPage - 1) * agendaSize"
            :count="agendaItems.length"
            label="Páginas de la agenda"
            @change="agendaPage = Math.floor($event / agendaSize) + 1"
          />
        </template>

        <div
          v-else
          class="calendar"
          role="grid"
          :aria-label="`Calendario de ${monthTitle(month)}`"
        >
          <div class="calendar__head" role="row">
            <span v-for="name in weekdays" :key="name" role="columnheader">{{
              name
            }}</span>
          </div>
          <div
            class="calendar__grid"
            :style="{ '--weeks': String(weeks) }"
            role="presentation"
          >
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
                  v-for="item in (byDay.get(day) ?? []).slice(0, CHIPS_PER_DAY)"
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
                <button
                  v-if="(byDay.get(day)?.length ?? 0) > CHIPS_PER_DAY"
                  type="button"
                  class="cell__more"
                  :aria-label="`Ver las ${byDay.get(day)!.length} actividades del ${Number(day.slice(8))} en la lista`"
                  @click="view = 'lista'"
                >
                  +{{ byDay.get(day)!.length - CHIPS_PER_DAY }} más
                </button>
              </div>
            </template>
          </div>
        </div>
      </section>

      <section class="card past-card" aria-labelledby="pasado-titulo">
        <h2 id="pasado-titulo" class="card__title">Lo que ya pasó</h2>
        <p v-if="!loading && !pastHeld.length" class="card__empty">
          Todavía no hay encuentros pasados.
        </p>
        <ol v-else class="past">
          <li v-for="item in pastHeld" :key="item.id">
            <div class="past__text">
              <strong>{{ item.title }}</strong>
              <small
                >{{ shortDay(item.date) }} · {{ item.came }}
                {{ item.came === 1 ? 'vino' : 'vinieron' }}</small
              >
            </div>
            <RouterLink
              :to="{ name: 'asistencia', query: { actividad: item.id } }"
              class="link"
              :aria-label="`Asistencia de ${item.title} del ${shortDay(item.date)}`"
            >
              Asistencia
            </RouterLink>
          </li>
        </ol>
      </section>
    </div>

    <ActivityDialog
      v-model:open="dialogOpen"
      :schedule="editing"
      :default-date="defaultDate"
      @saved="onSaved"
      @cancelled="onSaved"
    />
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

/* La agenda ocupa casi todo el ancho; «Lo que ya pasó» va a la derecha */
.ops__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(16rem, 22rem);
  gap: var(--space-5);
  align-items: start;
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
  padding: var(--space-3);
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

/* Cupos y estado en una fila, alineados (diseño pág. 12) */
.row__meta {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.row__meta small {
  min-width: 6.5rem;
  text-align: right;
}

.is-struck strong {
  text-decoration: line-through;
  color: var(--color-text-muted);
}

/* Calendario: siete columnas; las semanas se reparten el alto disponible */
.calendar {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: var(--space-1);
  min-height: 0;
}

.calendar__head,
.calendar__grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
}

.calendar__grid {
  grid-auto-rows: minmax(4.4rem, auto);
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
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  min-height: 0;
  padding: 4px;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
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
  flex: none;
  overflow: hidden;
  padding: 1px 4px;
  border: 0;
  border-radius: 4px;
  background: var(--verde-100);
  color: var(--verde-900);
  font: inherit;
  font-size: 0.72rem;
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

.cell__more {
  flex: none;
  align-self: flex-start;
  padding: 0 4px;
  border: 0;
  background: transparent;
  color: var(--color-link);
  font: inherit;
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
}

/* Lo que ya pasó: una lista que se desplaza sola si es larga */
.past {
  display: grid;
  align-content: start;
  margin: 0;
  padding: 0;
  list-style: none;
  max-height: 22rem;
  overflow-y: auto;
}

.past li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border);
}

.past__text {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
}

.past__text strong {
  overflow: hidden;
  font-size: var(--text-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.past__text small {
  color: var(--color-text-muted);
  font-size: var(--text-xs);
}

.link {
  flex: none;
  color: var(--color-link);
  font-size: var(--text-sm);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 0.25em;
}

@media (max-width: 1000px) {
  .ops__body {
    grid-template-columns: minmax(0, 1fr);
  }
}

/* Celular: los cupos y el estado bajan debajo del título */
@media (max-width: 520px) {
  .card {
    padding: var(--space-4);
  }

  .row {
    grid-template-columns: 3rem minmax(0, 1fr);
    padding-inline: var(--space-2);
  }

  .row__meta {
    grid-column: 2;
  }

  .row__meta small {
    min-width: 0;
    text-align: left;
  }

  .calendar__head span {
    font-size: 0.6rem;
  }
}

/* Ventana completa: la página no se desplaza; la agenda toma todo el alto */
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
  grid-template-columns: minmax(0, 1fr) clamp(16rem, 24vw, 22rem);
  grid-template-rows: minmax(0, 1fr);
}

.ops--fit .card {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding-block: clamp(var(--space-3), 1.8vh, var(--space-5));
}

.ops--fit .agenda-area {
  /* La base en cero: el alto sale del espacio libre, no del contenido */
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
}

.ops--fit .agenda .row {
  height: 62px;
  padding-block: 0;
}

.ops--fit .calendar {
  flex: 1 1 0;
}

.ops--fit .calendar__grid {
  grid-template-rows: repeat(var(--weeks), minmax(0, 1fr));
  grid-auto-rows: unset;
  min-height: 0;
}

.ops--fit .past {
  flex: 1 1 0;
  min-height: 0;
  max-height: none;
}
</style>
