<script setup lang="ts">
/**
 * Asistencia (diseño págs. 10 y 12): se marca quién vino al encuentro con dos botones
 * grandes, y cada marca se guarda al instante. En escritorio la lista entra en la
 * ventana; en el celular (360 px) la página se desplaza y los botones siguen grandes.
 */
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { isApiError } from '../../../api/errors'
import type {
  AttendanceEntry,
  AttendanceSheet,
  MonthlySummary,
  NewcomerIn,
  ScheduleOut,
} from '../../../api/types'
import AppAlert from '../../../components/ui/AppAlert.vue'
import AppButton from '../../../components/ui/AppButton.vue'
import AppModal from '../../../components/ui/AppModal.vue'
import AppPagination from '../../../components/ui/AppPagination.vue'
import FormField from '../../../components/ui/FormField.vue'
import InitialsAvatar from '../../../components/ui/InitialsAvatar.vue'
import PageHeader from '../../../components/ui/PageHeader.vue'
import SkeletonBlock from '../../../components/ui/SkeletonBlock.vue'
import { useApi } from '../../../composables/useApi'
import { useFitLayout } from '../../../composables/useFitLayout'
import { useFitRows } from '../../../composables/useFitRows'
import { useToast } from '../../../composables/useToast'
import { saveBlob } from '../../../utils/download'
import { firstName } from '../../../utils/format'
import {
  dayLabel,
  daysFromToday,
  monthOf,
  monthTitle,
  timeRange,
  today,
} from '../../../utils/ops'

/** Para buscar sin importar tildes ni mayúsculas: «gutierrez» encuentra «Gutiérrez». */
function foldText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

/** Alto de cada persona en la lista de «ventana completa» (px). */
const ROW_HEIGHT = 60
const SCROLL_PAGE_SIZE = 12

const { api, session } = useApi()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const fit = useFitLayout()

const canMark = computed(() =>
  session.canAny('attendance:write', 'schedules:manage'),
)
const canClose = computed(() =>
  session.canAny('schedules:manage', 'attendance:write'),
)
const canDownload = computed(() => session.can('schedules:manage'))

/* Actividad elegida: se toma de la dirección, o la de hoy, o la más reciente */
const activities = ref<ScheduleOut[]>([])
const activityId = ref<string | null>(
  typeof route.query.actividad === 'string' ? route.query.actividad : null,
)
const loadingActivities = ref(true)

const activity = computed(
  () => activities.value.find((item) => item.id === activityId.value) ?? null,
)

const sheet = ref<AttendanceSheet | null>(null)
const loadingSheet = ref(false)
const sheetError = ref<string | null>(null)
const busy = ref<string | null>(null)
const closing = ref(false)

const search = ref('')
const searchInput = ref('')
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(searchInput, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    search.value = foldText(value)
    page.value = 1
  }, 250)
})

const page = ref(1)
const listArea = ref<HTMLElement | null>(null)
const { pageSize } = useFitRows(listArea, {
  rowHeight: ROW_HEIGHT,
  fallback: SCROLL_PAGE_SIZE,
  headHeight: 0,
  min: 4,
})

const counts = computed(() => {
  const items = sheet.value?.items ?? []
  let came = 0
  let notCame = 0
  for (const item of items) {
    if (item.status === 'vino') came += 1
    if (item.status === 'no_vino') notCame += 1
  }
  return {
    came,
    notCame,
    unmarked: items.length - came - notCame,
    total: items.length,
  }
})

const filtered = computed(() => {
  const items = sheet.value?.items ?? []
  if (!search.value) return items
  return items.filter((item) => foldText(item.name).includes(search.value))
})
const pageItems = computed(() =>
  filtered.value.slice(
    (page.value - 1) * pageSize.value,
    page.value * pageSize.value,
  ),
)
watch(pageSize, () => {
  page.value = 1
})

const closed = computed(() => sheet.value?.closed === true)
/* La asistencia se toma el día de la actividad */
const isActivityDay = computed(() => activity.value?.date === today())
const canMarkNow = computed(
  () => canMark.value && !closed.value && !!sheet.value && isActivityDay.value,
)

/* Resumen mensual para la tarjeta de la derecha */
const month = ref(monthOf(today()))
const monthly = ref<MonthlySummary | null>(null)

async function loadActivities() {
  loadingActivities.value = true
  try {
    const result = await api.schedules.list({
      from: daysFromToday(-45),
      to: daysFromToday(14),
      limit: 100,
      offset: 0,
    })
    // Sin borradores ni canceladas: la lista de asistencia es de lo que se hace
    activities.value = result.items.filter(
      (item) => item.status !== 'cancelada',
    )
    if (
      !activityId.value ||
      !activities.value.some((item) => item.id === activityId.value)
    )
      activityId.value = defaultActivity(activities.value)
  } catch {
    activities.value = []
  } finally {
    loadingActivities.value = false
  }
}

/** Hoy, o la siguiente, o la más reciente. */
function defaultActivity(items: ScheduleOut[]): string | null {
  const day = today()
  const todayItem = items.find((item) => item.date === day)
  if (todayItem) return todayItem.id
  const upcoming = items.find((item) => item.date > day)
  if (upcoming) return upcoming.id
  return items.length ? items[items.length - 1]!.id : null
}

let request = 0

async function loadSheet() {
  const current = ++request
  if (!activityId.value) {
    sheet.value = null
    return
  }
  loadingSheet.value = true
  sheetError.value = null
  try {
    const result = await api.attendance.sheet(activityId.value)
    if (current !== request) return
    sheet.value = result
    page.value = 1
  } catch (failure) {
    if (current !== request) return
    sheet.value = null
    sheetError.value = isApiError(failure)
      ? failure.message
      : 'No pudimos cargar la lista. Intenta de nuevo.'
  } finally {
    if (current === request) loadingSheet.value = false
  }
}

async function loadMonthly() {
  if (!canDownload.value) return
  try {
    monthly.value = await api.attendance.monthly(month.value)
  } catch {
    monthly.value = null
  }
}

/** Solo cuando la persona elige otra actividad (la carga inicial lo hace onMounted). */
function pick(value: string | null) {
  activityId.value = value
  const query = { ...route.query }
  if (value) query.actividad = value
  else delete query.actividad
  void router.replace({ query })
  void loadSheet()
}

/** Marca una persona: se guarda en ese momento. */
async function mark(entry: AttendanceEntry, status: 'vino' | 'no_vino') {
  if (!sheet.value || !canMarkNow.value || busy.value) return
  const item = sheet.value.items.find(
    (row) => row.patientId === entry.patientId,
  )
  if (!item || item.status === status) return
  const previous = item.status
  item.status = status
  busy.value = item.patientId
  try {
    const saved = await api.attendance.mark(activityId.value!, item.patientId, {
      status,
    })
    Object.assign(item, {
      status: saved.status,
      markedAt: saved.markedAt,
      note: saved.note,
    })
  } catch (failure) {
    item.status = previous
    toast.error(
      isApiError(failure)
        ? failure.message
        : `No guardamos la marca de ${firstName(item.name)}. Intenta de nuevo.`,
    )
  } finally {
    busy.value = null
  }
}

async function markAll() {
  if (!activityId.value || !canMarkNow.value) return
  busy.value = 'todos'
  try {
    sheet.value = await api.attendance.markAllPresent(activityId.value)
    toast.success('Marcamos a todas las personas como presentes.')
  } catch (failure) {
    toast.error(
      isApiError(failure)
        ? failure.message
        : 'No pudimos marcar a todas. Intenta de nuevo.',
    )
  } finally {
    busy.value = null
  }
}

async function closeDay() {
  if (!activityId.value) return
  closing.value = true
  try {
    sheet.value = await api.attendance.close(activityId.value)
    toast.success(
      'Cerramos la asistencia. Ya no se puede cambiar sin reabrirla.',
    )
    void loadMonthly()
  } catch (failure) {
    toast.error(
      isApiError(failure)
        ? failure.message
        : 'No pudimos cerrar la asistencia.',
    )
  } finally {
    closing.value = false
  }
}

async function reopen() {
  if (!activityId.value) return
  try {
    sheet.value = await api.attendance.reopen(activityId.value)
    toast.success('Reabrimos la asistencia.')
  } catch (failure) {
    toast.error(
      isApiError(failure)
        ? failure.message
        : 'No pudimos reabrir la asistencia.',
    )
  }
}

/* Persona nueva */
const newcomerOpen = ref(false)
const newcomerSaving = ref(false)
const newcomerError = ref<string | null>(null)
const newcomer = reactive({
  name: '',
  phone: '',
  onBehalfOf: '',
  note: '',
  contactConsent: false,
})
const newcomerSubmitted = ref(false)
const newcomerErrors = computed(() => ({
  name:
    newcomer.name.trim().length < 3
      ? 'Escribe el nombre (al menos 3 letras).'
      : null,
  phone: /^\d{7,12}$/.test(newcomer.phone.replace(/\s/g, ''))
    ? null
    : 'Escribe el teléfono, solo números.',
}))

function openNewcomer() {
  Object.assign(newcomer, {
    name: '',
    phone: '',
    onBehalfOf: '',
    note: '',
    contactConsent: false,
  })
  newcomerSubmitted.value = false
  newcomerError.value = null
  newcomerOpen.value = true
}

async function saveNewcomer() {
  newcomerSubmitted.value = true
  if (
    newcomerErrors.value.name ||
    newcomerErrors.value.phone ||
    !activityId.value
  )
    return
  newcomerSaving.value = true
  newcomerError.value = null
  const payload: NewcomerIn = {
    name: newcomer.name.trim(),
    phone: newcomer.phone.replace(/\s/g, ''),
    onBehalfOf: newcomer.onBehalfOf.trim(),
    note: newcomer.note.trim(),
    contactConsent: newcomer.contactConsent,
  }
  try {
    const result = await api.attendance.addNewcomer(activityId.value, payload)
    newcomerOpen.value = false
    toast.success(`${result.message} Recepción abrirá su ficha.`)
  } catch (failure) {
    newcomerError.value = isApiError(failure)
      ? failure.message
      : 'No pudimos anotar a la persona. Intenta de nuevo.'
  } finally {
    newcomerSaving.value = false
  }
}

async function download() {
  try {
    const blob = await api.attendance.downloadMonthly('xlsx', month.value)
    saveBlob(blob, `resumen-mensual-asistencia-${month.value}.xlsx`)
  } catch (failure) {
    toast.error(
      isApiError(failure)
        ? failure.message
        : 'No pudimos descargar el resumen.',
    )
  }
}

function activityLabel(item: ScheduleOut) {
  return `${dayLabel(item.date)} · ${item.title}`
}

const shownOptions = computed(() => activities.value)
const headerDate = computed(() =>
  activity.value ? dayLabel(activity.value.date) : '',
)

onMounted(async () => {
  await loadActivities()
  await loadSheet()
  void loadMonthly()
})
</script>

<template>
  <div class="att" :class="{ 'att--fit': fit }">
    <PageHeader
      title="Asistencia"
      subtitle="Marca quién vino al encuentro. Toma menos de dos minutos."
    >
      <template #actions>
        <label class="visually-hidden" for="actividad-asistencia"
          >Actividad</label
        >
        <select
          id="actividad-asistencia"
          :value="activityId"
          class="select att__pick"
          :disabled="loadingActivities || !shownOptions.length"
          @change="pick(($event.target as HTMLSelectElement).value || null)"
        >
          <option v-if="!shownOptions.length" :value="null">
            Sin actividades para marcar
          </option>
          <option v-for="item in shownOptions" :key="item.id" :value="item.id">
            {{ activityLabel(item) }}
          </option>
        </select>
      </template>
    </PageHeader>

    <div class="att__body">
      <section class="card att__main" aria-label="Lista de asistencia">
        <AppAlert v-if="sheetError" tone="error">
          {{ sheetError }}
          <AppButton variant="link" size="sm" @click="loadSheet"
            >Reintentar</AppButton
          >
        </AppAlert>

        <p v-if="!activity && !loadingActivities && !sheetError" class="empty">
          Todavía no hay actividades para marcar. Cuando haya una publicada o en
          borrador de estas fechas, aparecerá aquí.
        </p>

        <template v-else-if="activity">
          <header class="banner">
            <div class="banner__text">
              <p class="banner__day">{{ headerDate }}</p>
              <h2 class="banner__title">{{ activity.title }}</h2>
              <p class="banner__meta">
                {{ timeRange(activity.startTime, activity.endTime) }} ·
                {{ activity.location }}
                <template v-if="activity.professionalName">
                  · {{ activity.professionalName }}</template
                >
              </p>
            </div>
            <p v-if="sheet" class="banner__count">
              <strong>{{ counts.came + counts.notCame }}</strong>
              <span>de {{ counts.total }} marcados</span>
            </p>
          </header>

          <SkeletonBlock
            v-if="loadingSheet && !sheet"
            :lines="4"
            height="3.25rem"
          />

          <template v-else-if="sheet">
            <div class="toolbar">
              <label class="visually-hidden" for="buscar-asistencia"
                >Buscar por nombre</label
              >
              <span class="toolbar__search">
                <span class="toolbar__icon" aria-hidden="true">⌕</span>
                <input
                  id="buscar-asistencia"
                  v-model="searchInput"
                  class="input"
                  type="search"
                  placeholder="Buscar por nombre"
                  autocomplete="off"
                />
              </span>
              <AppButton
                v-if="canMarkNow"
                variant="secondary"
                size="md"
                :disabled="!counts.unmarked || busy !== null"
                :loading="busy === 'todos'"
                loading-label="Marcando a todas…"
                @click="markAll"
              >
                Marcar a todos como presentes
              </AppButton>
            </div>

            <p class="tally" aria-live="polite">
              <span>{{ counts.came }} vinieron</span>
              <span>{{ counts.notCame }} no vinieron</span>
              <span>{{ counts.unmarked }} sin marcar</span>
            </p>

            <div ref="listArea" class="list-area">
              <ol class="people">
                <li
                  v-for="item in pageItems"
                  :key="item.patientId"
                  class="person"
                  :class="{ 'is-busy': busy === item.patientId }"
                >
                  <InitialsAvatar :name="item.name" size="md" />
                  <div class="person__text">
                    <strong>{{ item.name }}</strong>
                    <small>{{
                      item.note ||
                      (item.status === 'sin_marcar'
                        ? 'Sin marcar'
                        : item.status === 'vino'
                          ? 'Vino'
                          : 'No vino')
                    }}</small>
                  </div>
                  <div
                    class="choice"
                    role="group"
                    :aria-label="`Asistencia de ${item.name}`"
                  >
                    <button
                      type="button"
                      class="choice__btn"
                      :class="{ 'is-on': item.status === 'vino' }"
                      :aria-pressed="item.status === 'vino'"
                      :disabled="!canMarkNow || busy === item.patientId"
                      @click="mark(item, 'vino')"
                    >
                      Vino
                    </button>
                    <button
                      type="button"
                      class="choice__btn choice__btn--no"
                      :class="{ 'is-on': item.status === 'no_vino' }"
                      :aria-pressed="item.status === 'no_vino'"
                      :disabled="!canMarkNow || busy === item.patientId"
                      @click="mark(item, 'no_vino')"
                    >
                      No vino
                    </button>
                  </div>
                </li>
                <li
                  v-if="!pageItems.length && !loadingSheet"
                  class="people__empty"
                >
                  Nadie con «{{ search }}» en esta lista.
                </li>
              </ol>
            </div>

            <AppPagination
              v-if="filtered.length > pageSize"
              :total="filtered.length"
              :limit="pageSize"
              :offset="(page - 1) * pageSize"
              :count="pageItems.length"
              label="Páginas de la asistencia"
              @change="page = Math.floor($event / pageSize) + 1"
            />

            <footer class="foot">
              <p
                v-if="!closed && !isActivityDay && activity"
                class="foot__note"
              >
                Se marca el día de la actividad: {{ dayLabel(activity.date) }}.
              </p>
              <p v-else-if="!closed" class="foot__note">
                Se guarda solo al marcar.
              </p>
              <p v-else class="foot__note">
                Asistencia cerrada. Para cambiarla, reábrela.
              </p>
              <div class="foot__actions">
                <button
                  v-if="closed && canClose"
                  type="button"
                  class="link"
                  @click="reopen"
                >
                  Reabrir
                </button>
                <AppButton
                  v-if="!closed && canClose"
                  :loading="closing"
                  loading-label="Cerrando la asistencia…"
                  @click="closeDay"
                >
                  Cerrar asistencia del día
                </AppButton>
              </div>
            </footer>
          </template>
        </template>
      </section>

      <aside class="att__side">
        <section class="card" aria-labelledby="nuevo-titulo">
          <h2 id="nuevo-titulo" class="card__title">¿Llegó alguien nuevo?</h2>
          <p class="card__text">
            Si es su primera vez y no tiene ficha, anota su nombre y teléfono.
            Recepción abrirá su ficha y aparecerá en esta lista.
          </p>
          <AppButton
            variant="secondary"
            :disabled="!activity || !canMark"
            @click="openNewcomer"
          >
            Anotar persona nueva
          </AppButton>
        </section>

        <section v-if="canDownload" class="card" aria-labelledby="mes-titulo">
          <h2 id="mes-titulo" class="card__title">{{ monthTitle(month) }}</h2>
          <p class="card__text">Personas por actividad</p>
          <ul v-if="monthly?.byCategory?.length" class="bars">
            <li v-for="row in monthly.byCategory" :key="row.category">
              <span class="bars__label">{{ row.label }}</span>
              <span class="bars__track" aria-hidden="true">
                <span
                  class="bars__bar"
                  :style="{
                    width: `${Math.max(4, (row.came / Math.max(1, ...monthly.byCategory.map((r) => r.came))) * 100)}%`,
                  }"
                />
              </span>
              <span class="bars__count">{{ row.came }}</span>
            </li>
          </ul>
          <p v-else class="card__text">Todavía no hay asistencias este mes.</p>
          <button type="button" class="link" @click="download">
            Descargar resumen mensual →
          </button>
        </section>

        <p class="volunteer-note">
          El voluntariado puede tomar asistencia y ver datos de contacto. Las
          historias clínicas solo las ve el personal clínico.
        </p>
      </aside>
    </div>

    <AppModal
      v-model:open="newcomerOpen"
      size="sm"
      title="Anotar persona nueva"
      description="Recepción abrirá su ficha. No hace falta que tenga carnet."
      :dismissible="!newcomerSaving"
    >
      <form
        id="nueva-persona"
        class="newcomer"
        novalidate
        @submit.prevent="saveNewcomer"
      >
        <AppAlert v-if="newcomerError" tone="error">{{
          newcomerError
        }}</AppAlert>
        <FormField
          v-slot="{ id, describedBy, invalid }"
          label="Nombre completo"
          required
          :error="newcomerSubmitted ? newcomerErrors.name : undefined"
        >
          <input
            :id="id"
            v-model="newcomer.name"
            class="input"
            maxlength="120"
            :aria-describedby="describedBy"
            :aria-invalid="invalid"
          />
        </FormField>
        <FormField
          v-slot="{ id, describedBy, invalid }"
          label="Teléfono"
          required
          :error="newcomerSubmitted ? newcomerErrors.phone : undefined"
        >
          <input
            :id="id"
            v-model="newcomer.phone"
            class="input"
            inputmode="tel"
            maxlength="14"
            :aria-describedby="describedBy"
            :aria-invalid="invalid"
          />
        </FormField>
        <FormField
          v-slot="{ id }"
          label="Vino por otra persona"
          hint="Por ejemplo: la hija de quien tiene Parkinson."
        >
          <input
            :id="id"
            v-model="newcomer.onBehalfOf"
            class="input"
            maxlength="120"
          />
        </FormField>
        <FormField v-slot="{ id }" label="Nota">
          <textarea
            :id="id"
            v-model="newcomer.note"
            class="textarea"
            rows="2"
            maxlength="1000"
          />
        </FormField>
        <label class="checkbox">
          <input v-model="newcomer.contactConsent" type="checkbox" />
          <span>Aceptó que el equipo la llame para abrir su ficha.</span>
        </label>
      </form>
      <template #actions>
        <AppButton
          variant="secondary"
          :disabled="newcomerSaving"
          @click="newcomerOpen = false"
          >Cancelar</AppButton
        >
        <AppButton
          type="submit"
          form="nueva-persona"
          :loading="newcomerSaving"
          loading-label="Anotando…"
          >Anotar persona</AppButton
        >
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.att {
  display: grid;
  gap: var(--space-6);
  min-width: 0;
}

.att :deep(.page-header) {
  margin-bottom: 0;
}

.att__pick {
  min-width: 18rem;
  max-width: 26rem;
}

.att__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(16rem, 21rem);
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

.att__main {
  padding: var(--space-5) var(--space-6);
}

.att__side {
  display: grid;
  gap: var(--space-4);
  min-width: 0;
}

.card__title {
  font-family: var(--font-serif);
  font-size: var(--text-xl);
  font-weight: 500;
  color: var(--color-text);
}

.card__text,
.volunteer-note,
.empty,
.foot__note {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.volunteer-note {
  padding: var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-surface-sunken);
}

.banner {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-5);
  border-radius: var(--radius-md);
  background: var(--aspar-verde);
  color: #fff;
}

.banner__day {
  color: var(--rosa-200);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.banner__title {
  color: #fff;
  font-family: var(--font-serif);
  font-size: var(--text-xl);
  font-weight: 500;
  line-height: 1.15;
}

.banner__meta {
  color: rgb(255 255 255 / 0.8);
  font-size: var(--text-sm);
}

.banner__count {
  display: grid;
  justify-items: end;
  line-height: 1;
}

.banner__count strong {
  font-family: var(--font-serif);
  font-size: clamp(2rem, 4.5vh, 2.75rem);
  font-weight: 500;
}

.banner__count span {
  color: rgb(255 255 255 / 0.8);
  font-size: var(--text-sm);
}

.toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
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
  pointer-events: none;
}

.tally {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  font-variant-numeric: tabular-nums;
}

.list-area {
  min-height: 0;
}

.people {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.person {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  min-height: 60px;
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border);
  transition: opacity var(--duration-fast) var(--ease-out);
}

.person.is-busy {
  opacity: 0.6;
}

.person__text {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
  line-height: var(--leading-snug);
}

.person__text strong,
.person__text small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.person__text small {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.people__empty {
  padding: var(--space-4) 0;
  color: var(--color-text-muted);
}

/* Dos botones grandes: se marcan con el dedo, también en el celular */
.choice {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  width: min(16rem, 46vw);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.choice__btn {
  min-height: 2.75rem;
  padding: 0 var(--space-3);
  border: 0;
  background: var(--color-surface);
  color: var(--color-text-muted);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.choice__btn + .choice__btn {
  border-left: 1px solid var(--color-border-strong);
}

.choice__btn.is-on {
  background: var(--aspar-verde);
  color: #fff;
}

.choice__btn--no.is-on {
  background: var(--rosa-200);
  color: var(--guindo-900);
}

.choice__btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.foot__actions {
  display: flex;
  align-items: center;
  gap: var(--space-4);
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

.bars {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.bars li {
  display: grid;
  grid-template-columns: 7.5rem minmax(0, 1fr) 2.5rem;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
}

.bars__track {
  height: 0.45rem;
  border-radius: var(--radius-pill);
  background: var(--color-surface-sunken);
  overflow: hidden;
}

.bars__bar {
  display: block;
  height: 100%;
  background: var(--aspar-guindo);
}

.bars__count {
  text-align: right;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.newcomer {
  display: grid;
  gap: var(--space-3);
}

.checkbox {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  font-size: var(--text-sm);
}

/* Celular (360 px): todo en una columna; los botones siguen siendo grandes */
@media (max-width: 899px) {
  .att__body {
    grid-template-columns: minmax(0, 1fr);
  }

  .att__pick {
    min-width: 0;
    width: 100%;
  }
}

@media (max-width: 520px) {
  .att__main {
    padding: var(--space-4);
  }

  .banner {
    flex-direction: column;
    align-items: flex-start;
  }

  .banner__count {
    justify-items: start;
  }

  .toolbar {
    grid-template-columns: minmax(0, 1fr);
  }

  .person {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .choice {
    grid-column: 1 / -1;
    width: 100%;
  }
}

/* Ventana completa: sin desplazamiento de la página; la lista muestra las personas que entran */
.att--fit {
  display: flex;
  flex-direction: column;
  gap: clamp(var(--space-3), 2.4vh, var(--space-6));
  min-height: 0;
}

.att--fit :deep(.page-header__title) {
  font-size: clamp(1.9rem, 4.6vh, 3.25rem);
}

.att--fit .att__body {
  flex: 1;
  min-height: 0;
  align-items: stretch;
  grid-template-columns: minmax(0, 1fr) clamp(16rem, 23vw, 21rem);
  grid-template-rows: minmax(0, 1fr);
}

.att--fit .att__main {
  display: flex;
  flex-direction: column;
  gap: clamp(var(--space-2), 1.4vh, var(--space-3));
  min-height: 0;
  padding-block: clamp(var(--space-3), 1.8vh, var(--space-5));
}

.att--fit .list-area {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
}

.att--fit .person {
  height: 60px;
  min-height: 0;
  padding-block: 0;
}

.att--fit .att__side {
  min-height: 0;
  overflow-y: auto;
  align-content: start;
}
</style>
