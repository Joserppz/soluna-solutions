<script setup lang="ts">
/**
 * Resumen del espacio del equipo (diseño pág. 7), con `GET /dashboard/summary`: el
 * saludo, el próximo encuentro con el acceso a la asistencia, lo que hay para revisar,
 * las próximas actividades, la asistencia de los últimos 8 sábados y los afiliados
 * activos. Cada bloque aparece solo si el rol tiene ese permiso (la API manda null).
 */
import { computed, onMounted, ref } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'

import { isApiError } from '../../api/errors'
import type { DashboardSummary } from '../../api/types'
import movementPhoto from '../../assets/sitio/movimiento.webp'
import AppAlert from '../../components/ui/AppAlert.vue'
import AppButton from '../../components/ui/AppButton.vue'
import PageHeader from '../../components/ui/PageHeader.vue'
import SkeletonBlock from '../../components/ui/SkeletonBlock.vue'
import StatusBadge from '../../components/ui/StatusBadge.vue'
import { useApi } from '../../composables/useApi'
import { useFitLayout } from '../../composables/useFitLayout'
import { useFitRows } from '../../composables/useFitRows'
import { TEAM_SECTIONS } from '../../router/sections'
import { firstName, greeting } from '../../utils/format'
import {
  SCHEDULE_STATUS_LABELS,
  SCHEDULE_STATUS_TONES,
  dayLabel,
  timeRange,
  today,
  type ScheduleStatus,
} from '../../utils/ops'

const { api, session } = useApi()
const fit = useFitLayout()

/* En ventana completa, la lista de actividades muestra las que entran */
const EVENT_ROW = 56
const eventsArea = ref<HTMLElement | null>(null)
const { pageSize: eventRows } = useFitRows(eventsArea, {
  rowHeight: EVENT_ROW,
  fallback: 4,
  headHeight: 0,
  min: 1,
})
const upcoming = computed(() =>
  (data.value?.upcoming ?? []).slice(0, eventRows.value),
)

const data = ref<DashboardSummary | null>(null)
const loadError = ref<string | null>(null)

const title = computed(() => {
  const user = session.state.user
  return user ? `${greeting()}, ${firstName(user.name)}.` : `${greeting()}.`
})
const sections = computed(() =>
  TEAM_SECTIONS.filter((section) => session.canAny(...section.permissions)),
)
const seesClinical = computed(() => session.can('patients:read_clinical'))
const canAttendance = computed(() =>
  session.canAny('attendance:write', 'schedules:manage'),
)
const canSchedules = computed(() => session.can('schedules:manage'))
const canPatients = computed(() => session.can('patients:write'))

interface ReviewItem {
  label: string
  count: number
  to: RouteLocationRaw
}

/** «Para revisar»: solo lo que el rol puede ver, cada uno con su lista filtrada. */
const review = computed<ReviewItem[]>(() => {
  const r = data.value?.toReview
  if (!r) return []
  return [
    r.newInquiries !== null && {
      label: 'Solicitudes nuevas sin llamar',
      count: r.newInquiries,
      to: { name: 'solicitudes', query: { estado: 'recibida' } },
    },
    r.donationsToConfirm !== null && {
      label: 'Aportes por confirmar con el banco',
      count: r.donationsToConfirm,
      to: { name: 'donaciones', query: { estado: 'pendiente' } },
    },
    r.patientsWithoutConsent !== null && {
      label: 'Fichas sin consentimiento firmado',
      count: r.patientsWithoutConsent,
      to: { name: 'afiliados', query: { pestana: 'consentimiento-pendiente' } },
    },
    r.damagedItems !== null && {
      label: 'Materiales en estado dañado',
      count: r.damagedItems,
      to: { name: 'inventario', query: { condicion: 'dañado' } },
    },
  ].filter(Boolean) as ReviewItem[]
})

const next = computed(() => data.value?.nextActivity ?? null)
/** «Este sábado» si el próximo encuentro es esta semana; si no, su fecha. */
const nextEyebrow = computed(() => {
  if (!next.value) return ''
  const days = Math.round(
    (Date.parse(`${next.value.date}T12:00:00`) -
      Date.parse(`${today()}T12:00:00`)) /
      86_400_000,
  )
  const day = dayLabel(next.value.date)
  if (days === 0) return `Hoy · ${day}`
  if (days < 7 && day.startsWith('Sábado'))
    return `Este sábado · ${day.slice(8)}`
  return `Próximo encuentro · ${day}`
})
const nextLine = computed(() => {
  const activity = next.value
  if (!activity) return ''
  const parts: string[] = []
  if (activity.usualAttendance)
    parts.push(
      `${activity.usualAttendance} ${activity.usualAttendance === 1 ? 'persona suele' : 'personas suelen'} venir.`,
    )
  parts.push(
    activity.newSignups
      ? `Hay ${activity.newSignups} ${activity.newSignups === 1 ? 'inscripción nueva' : 'inscripciones nuevas'} desde la semana pasada.`
      : 'No hay inscripciones nuevas desde la semana pasada.',
  )
  return parts.join(' ')
})

const attendance = computed(() => data.value?.attendanceLastSaturdays ?? null)
const bars = computed(() => {
  const list = attendance.value ?? []
  const max = Math.max(1, ...list.map((point) => point.came))
  return list.map((point) => ({
    ...point,
    height: Math.max(6, Math.round((point.came / max) * 100)),
  }))
})
const lastSaturday = computed(() => attendance.value?.at(-1) ?? null)
const average = computed(() => {
  const list = (attendance.value ?? []).filter((point) => point.came > 0)
  return list.length
    ? Math.round(list.reduce((sum, point) => sum + point.came, 0) / list.length)
    : null
})

const patients = computed(() => data.value?.patients ?? null)

function day(date: string) {
  return date.slice(8, 10)
}

function monthShort(date: string) {
  return new Intl.DateTimeFormat('es-BO', { month: 'short', timeZone: 'UTC' })
    .format(new Date(`${date}T12:00:00Z`))
    .replace('.', '')
    .toUpperCase()
}

async function load() {
  loadError.value = null
  try {
    data.value = await api.dashboard.summary()
  } catch (error) {
    loadError.value = isApiError(error)
      ? error.message
      : 'No pudimos cargar el resumen. Intenta de nuevo.'
  }
}

onMounted(load)
</script>

<template>
  <div class="summary" :class="{ 'summary--fit': fit }">
    <PageHeader
      :title="title"
      subtitle="Esto es lo que necesita atención esta semana."
    />

    <AppAlert v-if="!sections.length" tone="neutral">
      Tu rol todavía no tiene secciones asignadas. Pídele a Administración que
      revise tus permisos.
    </AppAlert>

    <AppAlert v-else-if="loadError" tone="error">
      {{ loadError }}
      <AppButton size="sm" variant="secondary" @click="load">
        Intentar de nuevo
      </AppButton>
    </AppAlert>

    <template v-else>
      <div class="summary__top">
        <!-- Este sábado -->
        <section
          v-if="!data || next || canSchedules"
          class="card today"
          aria-labelledby="sabado-titulo"
        >
          <div class="today__text">
            <template v-if="!data">
              <SkeletonBlock :lines="3" height="1.25rem" />
            </template>
            <template v-else-if="next">
              <span class="eyebrow">{{ nextEyebrow }}</span>
              <h2 id="sabado-titulo">{{ next.title }}</h2>
              <p class="today__when">
                {{ timeRange(next.startTime, next.endTime) }} ·
                {{ next.location
                }}<template v-if="next.professionalName">
                  · {{ next.professionalName }}</template
                >
              </p>
              <p class="today__line">{{ nextLine }}</p>
              <div class="today__actions">
                <AppButton
                  v-if="canAttendance"
                  size="sm"
                  :to="{
                    name: 'asistencia',
                    query: { dia: next.date, actividad: next.id },
                  }"
                >
                  Tomar asistencia
                </AppButton>
                <AppButton
                  v-if="canSchedules"
                  size="sm"
                  variant="on-dark"
                  :to="{ name: 'actividades', query: { actividad: next.id } }"
                >
                  Ver actividad
                </AppButton>
              </div>
            </template>
            <template v-else>
              <span class="eyebrow">Próximo encuentro</span>
              <h2 id="sabado-titulo">
                Todavía no hay una actividad publicada.
              </h2>
              <p class="today__line">
                Publica la del sábado para que las familias la vean en el sitio.
              </p>
              <div class="today__actions">
                <AppButton size="sm" :to="{ name: 'actividades' }">
                  Ir a Actividades
                </AppButton>
              </div>
            </template>
          </div>
          <img :src="movementPhoto" alt="" class="today__photo" />
        </section>

        <!-- Para revisar -->
        <section
          v-if="!data || review.length"
          class="card"
          aria-labelledby="revisar-titulo"
        >
          <h2 id="revisar-titulo" class="card__title">Para revisar</h2>
          <SkeletonBlock v-if="!data" :lines="4" height="1.5rem" />
          <ul v-else class="pending">
            <li v-for="item in review" :key="item.label">
              <RouterLink :to="item.to" :class="{ 'is-zero': !item.count }">
                <span>{{ item.label }}</span>
                <b>{{ item.count }}</b>
              </RouterLink>
            </li>
          </ul>
        </section>
      </div>

      <div class="summary__grid">
        <!-- Próximas actividades -->
        <section
          v-if="!data || data.upcoming"
          class="card"
          aria-labelledby="proximas-titulo"
        >
          <div class="card__head">
            <h2 id="proximas-titulo" class="card__title">
              Próximas actividades
            </h2>
            <RouterLink
              v-if="canSchedules"
              class="card__link"
              :to="{ name: 'actividades' }"
            >
              Ver agenda
            </RouterLink>
          </div>
          <SkeletonBlock v-if="!data" :lines="4" height="2.5rem" />
          <p v-else-if="!data.upcoming!.length" class="card__empty">
            No hay actividades en las próximas semanas.
          </p>
          <ul v-else ref="eventsArea" class="events">
            <li v-for="activity in upcoming" :key="activity.id">
              <span class="events__day">
                <b>{{ day(activity.date) }}</b>
                <small>{{ monthShort(activity.date) }}</small>
              </span>
              <span class="events__body">
                <span class="events__title">{{ activity.title }}</span>
                <span class="events__line">
                  {{
                    activity.status === 'cancelada'
                      ? activity.cancellationNote || 'Cancelada'
                      : activity.status === 'borrador'
                        ? 'Borrador: todavía no se ve en el sitio'
                        : `${timeRange(activity.startTime, activity.endTime)} · ${activity.location}`
                  }}
                </span>
              </span>
              <StatusBadge
                :tone="SCHEDULE_STATUS_TONES[activity.status as ScheduleStatus]"
              >
                {{
                  activity.status === 'borrador'
                    ? 'Sin publicar'
                    : SCHEDULE_STATUS_LABELS[activity.status as ScheduleStatus]
                }}
              </StatusBadge>
            </li>
          </ul>
        </section>

        <!-- Asistencia -->
        <section
          v-if="!data || attendance"
          class="card"
          aria-labelledby="asistencia-titulo"
        >
          <h2 id="asistencia-titulo" class="card__title">Asistencia</h2>
          <p class="card__hint">Personas por sábado, últimos 8</p>
          <SkeletonBlock v-if="!data" height="5rem" />
          <template v-else-if="attendance!.length">
            <ol
              class="spark"
              :aria-label="`Asistencia de los últimos ${attendance!.length} sábados`"
            >
              <li
                v-for="(point, index) in bars"
                :key="point.date"
                :class="{ 'is-last': index === bars.length - 1 }"
                :style="{ height: `${point.height}%` }"
                :title="`${dayLabel(point.date)}: ${point.came}`"
              >
                <span class="visually-hidden">
                  {{ dayLabel(point.date) }}: {{ point.came }}
                  {{ point.came === 1 ? 'persona' : 'personas' }}
                </span>
              </li>
            </ol>
            <p class="big-line">
              <span class="big">{{ lastSaturday!.came }}</span>
              <span class="text-muted">
                {{ lastSaturday!.came === 1 ? 'persona' : 'personas' }} el
                sábado pasado
              </span>
            </p>
            <p v-if="average !== null" class="card__hint">
              El promedio de estos sábados fue {{ average }}.
            </p>
          </template>
          <p v-else class="card__empty">
            Todavía no hay asistencia cerrada de los sábados anteriores.
          </p>
        </section>

        <!-- Comunidad -->
        <section
          v-if="!data || patients"
          class="card"
          aria-labelledby="comunidad-titulo"
        >
          <h2 id="comunidad-titulo" class="card__title">Comunidad</h2>
          <SkeletonBlock v-if="!data" :lines="2" height="2rem" />
          <template v-else>
            <p class="big-line">
              <span class="big">{{ patients!.active }}</span>
              <span class="text-muted">
                {{
                  patients!.active === 1
                    ? 'afiliado activo'
                    : 'afiliados activos'
                }}
              </span>
            </p>
            <p class="community__line">
              {{ patients!.joinedThisMonth }}
              {{
                patients!.joinedThisMonth === 1
                  ? 'se sumó este mes'
                  : 'se sumaron este mes'
              }}<template v-if="patients!.withoutConsent"
                >; {{ patients!.withoutConsent }}
                {{
                  patients!.withoutConsent === 1
                    ? 'ficha espera su consentimiento firmado'
                    : 'fichas esperan su consentimiento firmado'
                }}</template
              >.
            </p>
            <AppButton
              v-if="canPatients"
              size="sm"
              variant="secondary"
              :to="{ name: 'afiliados', query: { nuevo: '1' } }"
            >
              + Registrar afiliado
            </AppButton>
          </template>
          <p class="privacy">
            <template v-if="seesClinical">
              Tu rol puede ver historias clínicas. Cada consulta queda en el
              registro de actividad.
            </template>
            <template v-else>
              Solo el personal clínico ve historias y evaluaciones. Tu rol ve
              los datos que necesita para acompañar.
            </template>
          </p>
        </section>
      </div>

      <p v-if="data && !patients" class="privacy">
        <template v-if="seesClinical">
          Tu rol puede ver historias clínicas. Cada consulta queda en el
          registro de actividad.
        </template>
        <template v-else>
          Solo el personal clínico ve historias y evaluaciones. Tu rol ve los
          datos que necesita para acompañar.
        </template>
      </p>
    </template>
  </div>
</template>

<style scoped>
.summary {
  display: grid;
  gap: var(--space-5);
  min-width: 0;
}

.summary :deep(.page-header) {
  margin-bottom: 0;
}

.summary__top {
  display: grid;
  grid-template-columns: minmax(0, 1.65fr) minmax(0, 1fr);
  gap: var(--space-5);
}

.summary__grid {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--space-5);
}

.card {
  display: grid;
  align-content: start;
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
  justify-content: space-between;
  align-items: baseline;
  gap: var(--space-3);
}

.card__title {
  margin: 0;
  font-family: var(--font-serif);
  font-size: var(--text-xl);
  font-weight: 500;
  color: var(--color-text);
}

.card__link {
  color: var(--color-link);
  font-size: var(--text-sm);
  font-weight: 600;
}

.card__hint,
.card__empty {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

/* Este sábado */
.today {
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
  align-content: stretch;
  gap: 0;
  overflow: hidden;
  padding: 0;
  border: 0;
  background: var(--aspar-verde);
  color: #dfe9e3;
}

.today__text {
  display: grid;
  align-content: center;
  gap: var(--space-2);
  padding: var(--space-6);
}

.today .eyebrow {
  color: #f0b9b1;
}

.today h2 {
  margin: 0;
  font-size: clamp(1.5rem, 1.1rem + 1.2vw, 2.1rem);
  font-weight: 400;
  line-height: 1.15;
  color: #fff;
}

.today__when,
.today__line {
  margin: 0;
}

.today__line {
  color: #fff;
}

.today__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-top: var(--space-3);
}

.today__photo {
  width: 100%;
  height: 100%;
  min-height: 12rem;
  object-fit: cover;
}

/* Para revisar */
.pending {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.pending a {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
  min-height: 2.75rem;
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text);
  text-decoration: none;
}

.pending li:last-child a {
  border-bottom: 0;
}

.pending a:hover span {
  color: var(--aspar-guindo);
  text-decoration: underline;
}

.pending b {
  font-family: var(--font-serif);
  font-size: var(--text-2xl);
  font-weight: 500;
  color: var(--aspar-rojo);
}

.pending .is-zero b {
  color: var(--color-text-subtle);
}

/* Próximas actividades */
.events {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.events li {
  display: grid;
  grid-template-columns: 3rem minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--color-border);
}

.events li:last-child {
  border-bottom: 0;
}

.events__day {
  display: grid;
  justify-items: center;
  padding: var(--space-1) 0;
  border-radius: var(--radius-sm);
  background: var(--color-surface-muted);
}

.events__day b {
  font-family: var(--font-serif);
  font-size: var(--text-xl);
  font-weight: 500;
  line-height: 1;
  color: var(--aspar-guindo);
}

.events__day small {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
}

.events__body {
  display: grid;
  min-width: 0;
}

.events__title {
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.events__line {
  overflow: hidden;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Asistencia */
.spark {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  align-items: end;
  gap: var(--space-2);
  height: 5rem;
  margin: var(--space-2) 0 0;
  padding: 0;
  list-style: none;
}

.spark li {
  border-radius: var(--radius-xs) var(--radius-xs) 0 0;
  background: var(--verde-100);
}

.spark li.is-last {
  background: var(--aspar-guindo);
}

.big-line {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-2);
  margin: 0;
}

.big {
  font-family: var(--font-serif);
  font-size: 2.6rem;
  font-weight: 500;
  line-height: 1;
  color: var(--color-heading);
}

.community__line {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.card :deep(.btn) {
  justify-self: start;
}

.privacy {
  margin: var(--space-2) 0 0;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

@media (max-width: 1100px) {
  .summary__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 860px) {
  .summary__top,
  .summary__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 560px) {
  .today {
    grid-template-columns: minmax(0, 1fr);
  }

  .today__photo {
    display: none;
  }
}

/* Ventana completa: el resumen entra en la ventana, sin desplazar la página */
.summary--fit {
  display: flex;
  flex-direction: column;
  gap: clamp(var(--space-3), 2vh, var(--space-5));
  min-height: 0;
}

.summary--fit :deep(.page-header__title) {
  font-size: clamp(1.9rem, 4.6vh, 3.25rem);
}

.summary--fit .card {
  padding-block: clamp(var(--space-3), 2vh, var(--space-5));
}

.summary--fit .today {
  padding: 0;
}

.summary--fit .today__text {
  padding: clamp(var(--space-4), 2.6vh, var(--space-6));
}

.summary--fit .today__photo {
  min-height: 0;
  max-height: 32vh;
}

.summary--fit .summary__grid {
  flex: 1;
  min-height: 0;
  grid-template-rows: minmax(0, 1fr);
}

.summary--fit .summary__grid .card {
  min-height: 0;
  overflow: hidden;
}

/* La lista ocupa lo que queda de su tarjeta; cada fila tiene alto fijo */
.summary--fit .summary__grid .card:has(.events) {
  display: flex;
  flex-direction: column;
}

.summary--fit .events {
  flex: 1 1 0;
  min-height: 0;
  align-content: start;
}

.summary--fit .events li {
  height: 3.5rem;
  padding-block: 0;
}

.summary--fit .today h2 {
  font-size: clamp(1.35rem, 3.4vh, 2.1rem);
}

.summary--fit .today__text {
  gap: var(--space-1);
}

.summary--fit .pending a {
  min-height: 0;
  padding-block: clamp(var(--space-1), 0.9vh, var(--space-2));
}

.summary--fit .spark {
  height: clamp(3rem, 9vh, 5rem);
}

@media (max-height: 800px) {
  .summary--fit .privacy {
    display: none;
  }

  .summary--fit .big {
    font-size: 2rem;
  }
}
</style>
