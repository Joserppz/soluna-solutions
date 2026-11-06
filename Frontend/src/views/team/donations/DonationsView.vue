<script setup lang="ts">
/**
 * Donaciones (diseño pág. 15), sin pasarela de pago: QR bancario, efectivo en la sede y
 * en especie. Arriba el resumen del mes, por dónde llegaron y la meta del sitio; abajo
 * el registro con sus filtros y, al costado, el aporte elegido para confirmarlo con el
 * extracto o anularlo con un motivo. En escritorio todo entra en la ventana.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { isApiError } from '../../../api/errors'
import type {
  DonationListQuery,
  DonationOut,
  DonationSummary,
  GoalOut,
} from '../../../api/types'
import DonationPanel from '../../../components/donations/DonationPanel.vue'
import GoalDialog from '../../../components/donations/GoalDialog.vue'
import RegisterDonationDialog from '../../../components/donations/RegisterDonationDialog.vue'
import AppAlert from '../../../components/ui/AppAlert.vue'
import AppButton from '../../../components/ui/AppButton.vue'
import AppModal from '../../../components/ui/AppModal.vue'
import AppPagination from '../../../components/ui/AppPagination.vue'
import AppTabs, { type TabItem } from '../../../components/ui/AppTabs.vue'
import PageHeader from '../../../components/ui/PageHeader.vue'
import SkeletonBlock from '../../../components/ui/SkeletonBlock.vue'
import StatusBadge from '../../../components/ui/StatusBadge.vue'
import { useApi } from '../../../composables/useApi'
import { useFitLayout, useMediaQuery } from '../../../composables/useFitLayout'
import { useFitRows } from '../../../composables/useFitRows'
import { useToast } from '../../../composables/useToast'
import { refreshTeamCounters } from '../../../utils/counters'
import {
  CHANNELS,
  DONATION_STATUS_TONES,
  DONATION_TABS,
  type DonationTab,
  channelLine,
  formatBs,
  peopleLabel,
  recentMonths,
  referenceLine,
} from '../../../utils/donations'
import { saveBlob } from '../../../utils/download'
import {
  monthBounds,
  monthTitle,
  shortDayLabel,
  today,
} from '../../../utils/ops'
import { normalizeSearch } from '../../../utils/patients'

const ROW_HEIGHT = 56
const SCROLL_PAGE_SIZE = 10

const { api } = useApi()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const fit = useFitLayout()
/** Con lugar al costado, el aporte va en un panel; si no, en una ventana. */
const wide = useMediaQuery('(min-width: 1200px)')

function text(key: string): string {
  const value = route.query[key]
  return typeof value === 'string' ? value : ''
}

const months = recentMonths()
const currentMonth = today().slice(0, 7)
const month = ref(
  /^\d{4}-\d{2}$/.test(text('mes')) ? text('mes') : currentMonth,
)
const tab = ref<DonationTab>(
  DONATION_TABS.some((item) => item.key === text('estado'))
    ? (text('estado') as DonationTab)
    : 'todos',
)
const channel = ref(text('canal'))
const searchInput = ref(text('buscar'))
const search = ref(normalizeSearch(searchInput.value))
const page = ref(Math.max(1, Number(text('pagina')) || 1))

const summary = ref<DonationSummary | null>(null)
const goal = ref<GoalOut | null>(null)
const goalLoaded = ref(false)
const items = ref<DonationOut[]>([])
const total = ref(0)
const loading = ref(true)
const loadError = ref<string | null>(null)
const exporting = ref<'csv' | 'xlsx' | null>(null)
const registerOpen = ref(false)
const goalOpen = ref(false)

/* El aporte abierto al costado: se conserva aunque cambie de página o de pestaña */
const selectedId = ref<string | null>(text('aporte') || null)
const selectedItem = ref<DonationOut | null>(null)
const selected = computed(() =>
  selectedItem.value?.id === selectedId.value
    ? selectedItem.value
    : (items.value.find((item) => item.id === selectedId.value) ?? null),
)

const tableArea = ref<HTMLElement | null>(null)
const { pageSize } = useFitRows(tableArea, {
  rowHeight: ROW_HEIGHT,
  fallback: SCROLL_PAGE_SIZE,
})

/* Pestañas con los números del mes */
const tabs = computed<TabItem<DonationTab>[]>(() => {
  const s = summary.value
  const count: Record<DonationTab, number | null> = s
    ? {
        todos:
          s.confirmedCount + s.pendingCount + s.inKindCount + s.cancelledCount,
        pendiente: s.pendingCount,
        confirmado: s.confirmedCount,
        recibido: s.inKindCount,
        anulado: s.cancelledCount,
      }
    : {
        todos: null,
        pendiente: null,
        confirmado: null,
        recibido: null,
        anulado: null,
      }
  return DONATION_TABS.map((item) => ({ ...item, count: count[item.key] }))
})

/* «Por dónde llegaron»: siempre los tres canales, también los que no tuvieron ingresos */
const channels = computed(() => {
  const s = summary.value
  const confirmed = s?.confirmedBs ?? 0
  return CHANNELS.map((item) => {
    if (item.value === 'especie')
      return {
        ...item,
        value: item.value,
        amount: null as number | null,
        share: 0,
        note: s
          ? `${s.inKindCount} ${s.inKindCount === 1 ? 'aporte' : 'aportes'}`
          : '',
      }
    const amount =
      s?.byChannel.find((row) => row.channel === item.value)?.amountBs ?? 0
    return {
      ...item,
      amount,
      share: confirmed ? (amount / confirmed) * 100 : 0,
      note: formatBs(amount),
    }
  })
})

const monthName = computed(() =>
  monthTitle(month.value).split(' ')[0]!.toLowerCase(),
)
const isCurrentMonth = computed(() => month.value === currentMonth)

let request = 0

async function load() {
  const current = ++request
  loading.value = true
  loadError.value = null
  const { from, to } = monthBounds(month.value)
  const query: DonationListQuery = {
    from,
    to,
    search: search.value || undefined,
    channel: (channel.value || undefined) as DonationListQuery['channel'],
    status:
      tab.value === 'todos'
        ? undefined
        : (tab.value as DonationListQuery['status']),
    limit: pageSize.value,
    offset: (page.value - 1) * pageSize.value,
  }
  try {
    const [list, monthSummary] = await Promise.all([
      api.donations.list(query),
      api.donations.summary(month.value),
    ])
    if (current !== request) return
    const lastPage = Math.max(1, Math.ceil(list.total / pageSize.value))
    if (!list.items.length && page.value > lastPage) {
      page.value = lastPage
      return
    }
    items.value = list.items
    total.value = list.total
    summary.value = monthSummary
  } catch (failure) {
    if (current !== request) return
    loadError.value = isApiError(failure)
      ? failure.message
      : 'No pudimos cargar las donaciones. Intenta de nuevo.'
  } finally {
    if (current === request) loading.value = false
  }
}

async function loadGoal() {
  try {
    goal.value = await api.donations.goal()
  } catch {
    goal.value = null
  } finally {
    goalLoaded.value = true
  }
}

function syncQuery() {
  const query: Record<string, string> = {}
  if (month.value !== currentMonth) query.mes = month.value
  if (tab.value !== 'todos') query.estado = tab.value
  if (channel.value) query.canal = channel.value
  if (search.value) query.buscar = search.value
  if (page.value > 1) query.pagina = String(page.value)
  if (selectedId.value) query.aporte = selectedId.value
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

watch([search, channel, tab, month], () => {
  if (page.value === 1) refresh()
  else page.value = 1
})
watch(page, refresh)
watch(pageSize, () => {
  if (page.value === 1) refresh()
  else page.value = 1
})

function choose(item: DonationOut) {
  selectedItem.value = item
  selectedId.value = item.id
  syncQuery()
}

function closePanel() {
  selectedId.value = null
  selectedItem.value = null
  syncQuery()
}

/** Después de confirmar, anular o registrar: la lista, el resumen, la meta y el menú. */
function afterChange(item: DonationOut) {
  selectedItem.value = item
  selectedId.value = item.id
  const index = items.value.findIndex((row) => row.id === item.id)
  if (index >= 0) items.value[index] = item
  refresh()
  void loadGoal()
  refreshTeamCounters()
}

function onUpdated(item: DonationOut) {
  toast.success(
    item.status === 'confirmado'
      ? `Confirmamos el aporte de ${formatBs(item.amountBs)}. Ya suma a la meta.`
      : 'Anulamos el aviso. Queda en el historial con su motivo.',
  )
  afterChange(item)
}

function onCreated(item: DonationOut) {
  toast.success(
    {
      confirmado: `Registramos ${formatBs(item.amountBs)} en efectivo. Ya suma a la meta.`,
      pendiente: `Registramos el QR de ${formatBs(item.amountBs)}. Confírmalo cuando aparezca en el extracto.`,
      recibido: item.inventoryItemId
        ? 'Registramos el aporte en especie y lo agregamos al inventario.'
        : 'Registramos el aporte en especie.',
      anulado: 'Registramos el aporte.',
    }[item.status],
  )
  // Se muestra en el mes en que llegó
  const arrived = item.date.slice(0, 7)
  if (arrived !== month.value) month.value = arrived
  afterChange(item)
}

function onGoalSaved(saved: GoalOut) {
  goal.value = saved
  toast.success(
    saved.visible
      ? 'Guardamos la meta. Ya se ve así en el sitio.'
      : 'Guardamos la meta. No se muestra en el sitio.',
  )
}

async function download(format: 'csv' | 'xlsx') {
  exporting.value = format
  try {
    const blob = await api.donations.downloadSummary(format, month.value)
    saveBlob(blob, `donaciones-${month.value}.${format}`)
  } catch (failure) {
    toast.error(
      isApiError(failure)
        ? failure.message
        : 'No pudimos descargar el resumen. Intenta de nuevo.',
    )
  } finally {
    exporting.value = null
  }
}

/** Un enlace con ?aporte= abre ese aporte aunque no esté en la página que se ve. */
async function openLinked() {
  const id = selectedId.value
  if (!id || selected.value) return
  try {
    const item = await api.donations.get(id)
    if (selectedId.value === id) selectedItem.value = item
  } catch {
    if (selectedId.value === id) closePanel()
  }
}

function clearFilters() {
  searchInput.value = ''
  search.value = ''
  channel.value = ''
  tab.value = 'todos'
}

const filtered = computed(() =>
  Boolean(search.value || channel.value || tab.value !== 'todos'),
)

onMounted(async () => {
  void loadGoal()
  await load()
  await openLinked()
})
</script>

<template>
  <div class="don" :class="{ 'don--fit': fit }">
    <PageHeader
      title="Donaciones"
      subtitle="Cada aporte queda registrado. Se confirma cuando el ingreso aparece en el banco."
    >
      <template #actions>
        <AppButton size="lg" @click="registerOpen = true">
          + Registrar aporte recibido
        </AppButton>
      </template>
    </PageHeader>

    <section class="band" aria-label="Resumen del mes">
      <div class="band__month">
        <p class="eyebrow">{{ monthTitle(month).replace(' de ', ' ') }}</p>
        <SkeletonBlock v-if="!summary" :lines="2" height="1.25rem" />
        <template v-else>
          <p class="band__headline">
            {{
              isCurrentMonth ? 'Este mes llegaron' : `En ${monthName} llegaron`
            }}
            <strong>{{ formatBs(summary.confirmedBs) }}</strong> confirmados de
            {{ peopleLabel(summary.confirmedCount) }}.
            <template v-if="summary.pendingCount">
              Hay
              <strong
                >{{ summary.pendingCount }}
                {{ summary.pendingCount === 1 ? 'aviso' : 'avisos' }}</strong
              >
              {{ summary.pendingCount === 1 ? 'que espera' : 'que esperan' }}
              revisión con el extracto del banco.
            </template>
            <template v-else>No hay avisos por confirmar.</template>
          </p>
          <p v-if="summary.inKindCount" class="band__note">
            Además ingresaron {{ summary.inKindCount }}
            {{
              summary.inKindCount === 1
                ? 'donación en especie'
                : 'donaciones en especie'
            }}.
          </p>
        </template>
        <p class="downloads" role="group" aria-labelledby="resumen-mes">
          <span id="resumen-mes">Descargar el resumen del mes:</span>
          <button
            type="button"
            class="link"
            aria-label="Descargar el resumen del mes en CSV"
            :disabled="exporting !== null"
            @click="download('csv')"
          >
            {{ exporting === 'csv' ? 'Preparando…' : 'CSV' }}
          </button>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            class="link"
            aria-label="Descargar el resumen del mes en Excel"
            :disabled="exporting !== null"
            @click="download('xlsx')"
          >
            {{ exporting === 'xlsx' ? 'Preparando…' : 'Excel' }}
          </button>
        </p>
      </div>

      <div class="band__channels">
        <h2 class="band__title">Por dónde llegaron</h2>
        <div class="stack" aria-hidden="true">
          <span
            v-for="(item, index) in channels.filter((c) => c.share > 0)"
            :key="item.value"
            :class="`stack__part stack__part--${index}`"
            :style="{ width: `${item.share}%` }"
          />
        </div>
        <ul class="channels">
          <li v-for="(item, index) in channels" :key="item.value">
            <span
              class="channels__dot"
              :class="`channels__dot--${item.value === 'especie' ? 'especie' : index}`"
              aria-hidden="true"
            />
            <span>{{ item.label }}</span>
            <strong>{{ item.note }}</strong>
          </li>
        </ul>
      </div>

      <div class="band__goal">
        <div class="band__goal-head">
          <h2 class="band__title">Meta en el sitio</h2>
          <StatusBadge
            v-if="goal"
            :tone="goal.visible ? 'success' : 'neutral'"
            >{{ goal.visible ? 'Visible' : 'Oculta' }}</StatusBadge
          >
        </div>
        <template v-if="goal">
          <p class="band__goal-title">{{ goal.title }}</p>
          <div
            class="progress"
            role="progressbar"
            :aria-valuenow="goal.percent"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-label="`Avance de la meta: ${goal.percent} %`"
          >
            <span :style="{ width: `${goal.percent}%` }" />
          </div>
          <p class="band__goal-numbers">
            <strong>{{ formatBs(goal.raisedBs) }}</strong>
            <span>de {{ formatBs(goal.targetBs) }}</span>
          </p>
        </template>
        <p v-else-if="goalLoaded" class="band__note">
          Todavía no hay una meta. Créala para mostrarla en el sitio.
        </p>
        <button type="button" class="link" @click="goalOpen = true">
          {{ goal ? 'Editar meta →' : 'Crear meta →' }}
        </button>
      </div>
    </section>

    <div class="don__body">
      <section class="card" aria-labelledby="registro-titulo">
        <h2 id="registro-titulo" class="visually-hidden">
          Registro de aportes
        </h2>
        <AppTabs
          v-model="tab"
          :items="tabs"
          label="Aportes por estado"
          id-prefix="aportes"
        />
        <div
          id="aportes-panel"
          role="tabpanel"
          :aria-labelledby="`aportes-tab-${tab}`"
          class="card__panel"
        >
          <form class="filters" role="search" @submit.prevent>
            <label class="visually-hidden" for="buscar-aporte"
              >Buscar por donante o comprobante</label
            >
            <span class="filters__search">
              <span class="filters__icon" aria-hidden="true">⌕</span>
              <input
                id="buscar-aporte"
                v-model="searchInput"
                class="input"
                type="search"
                placeholder="Donante o comprobante"
                autocomplete="off"
              />
            </span>
            <label class="visually-hidden" for="filtro-canal">Canal</label>
            <select id="filtro-canal" v-model="channel" class="select">
              <option value="">Todos los canales</option>
              <option
                v-for="item in CHANNELS"
                :key="item.value"
                :value="item.value"
              >
                {{ item.label }}
              </option>
            </select>
            <label class="visually-hidden" for="filtro-mes">Mes</label>
            <select id="filtro-mes" v-model="month" class="select">
              <option
                v-for="item in months"
                :key="item.value"
                :value="item.value"
              >
                {{ item.label }}
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
            class="don__table"
            :class="{ 'is-refreshing': loading && items.length }"
          >
            <table class="table">
              <thead>
                <tr>
                  <th scope="col" class="desk-only">Fecha</th>
                  <th scope="col">Donante y canal</th>
                  <th scope="col" class="num">Monto</th>
                  <th scope="col" class="wide-only">Referencia</th>
                  <th scope="col" class="desk-only">Estado</th>
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
                          ? 'Ningún aporte coincide con estos filtros.'
                          : `Todavía no hay aportes en ${monthName}.`
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
                    'is-pending': item.status === 'pendiente',
                    'is-cancelled': item.status === 'anulado',
                  }"
                >
                  <td class="nowrap desk-only">
                    {{ shortDayLabel(item.date) }}
                  </td>
                  <td>
                    <span class="who">
                      <strong>{{ item.donorName ?? 'Anónimo' }}</strong>
                      <small>{{ channelLine(item) }}</small>
                      <small class="phone-only"
                        >{{ shortDayLabel(item.date) }} ·
                        {{ item.statusLabel }}</small
                      >
                    </span>
                  </td>
                  <td class="num nowrap amount">
                    {{
                      item.channel === 'especie' ? '—' : formatBs(item.amountBs)
                    }}
                  </td>
                  <td class="wide-only reference">{{ referenceLine(item) }}</td>
                  <td class="desk-only">
                    <StatusBadge :tone="DONATION_STATUS_TONES[item.status]">{{
                      item.statusLabel
                    }}</StatusBadge>
                  </td>
                  <td class="end">
                    <AppButton
                      v-if="item.status === 'pendiente'"
                      variant="secondary"
                      size="sm"
                      :aria-label="`Confirmar el aporte de ${item.donorName ?? 'Anónimo'}`"
                      @click="choose(item)"
                    >
                      Confirmar
                    </AppButton>
                    <button
                      v-else
                      type="button"
                      class="link"
                      :aria-label="`Ver el aporte de ${item.donorName ?? 'Anónimo'}`"
                      @click="choose(item)"
                    >
                      Ver
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <footer v-if="total > 0" class="don__footer">
            <AppPagination
              :total="total"
              :limit="pageSize"
              :offset="(page - 1) * pageSize"
              :count="items.length"
              label="Páginas de aportes"
              @change="page = Math.floor($event / pageSize) + 1"
            />
          </footer>
        </div>
      </section>

      <aside v-if="wide" class="don__side">
        <DonationPanel
          v-if="selected"
          :key="`${selected.id}-${selected.status}`"
          :donation="selected"
          @updated="onUpdated"
          @close="closePanel"
        />
        <section v-else class="card card--hint" aria-labelledby="sin-aporte">
          <h2 id="sin-aporte" class="card__title">Elige un aporte</h2>
          <p>
            Toca «Confirmar» en un aviso pendiente para buscarlo en el extracto,
            o «Ver» para revisar un aporte. Ningún aporte se borra: si no
            corresponde, se anula con el motivo.
          </p>
          <AppButton
            v-if="summary?.pendingCount && tab !== 'pendiente'"
            variant="secondary"
            size="sm"
            @click="tab = 'pendiente'"
          >
            Ver los {{ summary.pendingCount }} por confirmar
          </AppButton>
        </section>
      </aside>
    </div>

    <!-- Ventanas angostas: el aporte se abre en una ventana y la tabla usa todo el ancho -->
    <AppModal
      v-if="!wide"
      :open="!!selected"
      size="sm"
      title="Aporte"
      labelled-by="aporte-titulo"
      bare
      @update:open="!$event && closePanel()"
    >
      <DonationPanel
        v-if="selected"
        :key="`${selected.id}-${selected.status}`"
        :donation="selected"
        @updated="onUpdated"
        @close="closePanel"
      />
    </AppModal>

    <RegisterDonationDialog v-model:open="registerOpen" @created="onCreated" />
    <GoalDialog v-model:open="goalOpen" :goal="goal" @saved="onGoalSaved" />
  </div>
</template>

<style scoped>
.don {
  display: grid;
  gap: var(--space-5);
  min-width: 0;
}

.don :deep(.page-header) {
  margin-bottom: 0;
}

.downloads {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  margin-top: auto;
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

/* Franja de arriba: el mes, por dónde llegaron y la meta, en una fila */
.band {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr) minmax(0, 1fr);
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
}

.band > * {
  display: grid;
  align-content: start;
  gap: var(--space-2);
  min-width: 0;
  padding: var(--space-4) var(--space-5);
}

.band > * + * {
  border-left: 1px solid var(--color-border);
}

.band__channels,
.band__goal {
  background: var(--color-surface-muted);
}

.eyebrow {
  color: var(--aspar-rojo);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.band__headline {
  font-family: var(--font-serif);
  font-size: clamp(1.1rem, 2.6vh, 1.6rem);
  line-height: 1.3;
  color: var(--color-text);
}

.band__headline strong {
  color: var(--aspar-guindo);
  font-weight: 500;
}

.band__note {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.band__title {
  font-size: var(--text-md);
  font-weight: 700;
}

.stack {
  display: flex;
  height: 0.55rem;
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: var(--color-surface-sunken);
}

.stack__part--0 {
  background: var(--guindo-900);
}

.stack__part--1 {
  background: var(--aspar-rojo);
}

.channels {
  display: grid;
  gap: 0.2rem;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: var(--text-sm);
}

.channels li {
  display: grid;
  grid-template-columns: 0.6rem minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-2);
}

.channels__dot {
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 2px;
}

.channels__dot--0 {
  background: var(--guindo-900);
}

.channels__dot--1 {
  background: var(--aspar-rojo);
}

.channels__dot--especie {
  background: var(--rosa-200);
}

.band__goal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.band__goal-title {
  overflow: hidden;
  font-size: var(--text-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.progress {
  height: 0.55rem;
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: var(--color-surface-sunken);
}

.progress span {
  display: block;
  height: 100%;
  background: var(--aspar-guindo);
}

.band__goal-numbers {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
  font-size: var(--text-sm);
}

.band__goal-numbers span {
  color: var(--color-text-muted);
}

.link {
  justify-self: start;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-link);
  font: inherit;
  font-size: var(--text-sm);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 0.25em;
  cursor: pointer;
}

.don__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(19rem, 23rem);
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
  padding: var(--space-4) var(--space-5) var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
}

.card__panel {
  display: grid;
  gap: var(--space-3);
  min-width: 0;
}

.card--hint {
  color: var(--color-text-muted);
  justify-items: start;
}

.card__title {
  font-family: var(--font-serif);
  font-size: var(--text-xl);
  font-weight: 500;
  color: var(--color-text);
}

.filters {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--space-2);
}

.filters .select,
.filters .input {
  font-size: var(--text-sm);
}

.filters__search {
  position: relative;
}

.filters__search .input {
  padding-left: 2.1rem;
}

.filters__icon {
  position: absolute;
  top: 50%;
  left: var(--space-3);
  transform: translateY(-50%);
  color: var(--color-text-subtle);
  pointer-events: none;
}

.don__table {
  min-width: 0;
  container-type: inline-size;
  transition: opacity var(--duration-base) var(--ease-out);
}

/* Si la tabla es angosta, la referencia se ve en el panel del aporte */
@container (max-width: 720px) {
  .don__table .wide-only {
    display: none;
  }
}

.don__table.is-refreshing {
  opacity: 0.6;
}

.don__table .table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
}

.don__table th,
.don__table td {
  padding: 0.5rem var(--space-2);
  border-bottom: 1px solid var(--color-border);
  text-align: left;
  vertical-align: middle;
}

.don__table th {
  white-space: nowrap;
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.don__table .num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.don__table .end {
  text-align: right;
}

.don__table tr.is-selected td {
  background: var(--rosa-50);
}

.don__table tr.is-pending td:first-child {
  box-shadow: inset 3px 0 0 var(--aspar-rojo);
}

.don__table tr.is-cancelled td {
  color: var(--color-text-muted);
}

.don__table tr.is-cancelled .amount {
  text-decoration: line-through;
}

.who {
  display: grid;
  max-width: 15rem;
  gap: 0.1rem;
  min-width: 0;
}

.who small {
  color: var(--color-text-muted);
  font-size: var(--text-xs);
}

.who strong,
.who small,
.reference {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reference {
  max-width: 14rem;
  color: var(--color-text-muted);
}

.nowrap {
  white-space: nowrap;
}

.phone-only {
  display: none;
}

.empty {
  padding: var(--space-6) 0 !important;
  color: var(--color-text-muted);
}

.don__footer {
  min-width: 0;
}

.don__side {
  min-width: 0;
}

@media (max-width: 1199.98px) {
  .band {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }

  .band__month {
    grid-column: 1 / -1;
  }

  .band > .band__channels {
    border-left: 0;
  }

  .band > .band__month {
    border-bottom: 1px solid var(--color-border);
  }

  .don__body {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 640px) {
  .band {
    grid-template-columns: minmax(0, 1fr);
  }

  .band > * + * {
    border-left: 0;
    border-top: 1px solid var(--color-border);
  }

  .filters {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }

  .filters__search {
    grid-column: 1 / -1;
  }

  .don__table {
    overflow-x: auto;
  }

  /* Celular: donante (con fecha y estado debajo), monto y la acción */
  .don__table .wide-only,
  .don__table .desk-only {
    display: none;
  }

  .don__table .phone-only {
    display: block;
  }

  .don__table th,
  .don__table td {
    padding-inline: 0.35rem;
  }

  .don :deep(.tabs) {
    max-width: 100%;
  }
}

/* Ventanas bajas: la franja se compacta (los aportes en especie ya se cuentan en
   «Por dónde llegaron») */
@media (max-height: 800px) {
  .band__month .band__note {
    display: none;
  }

  .band__headline {
    font-size: clamp(1rem, 2.4vh, 1.25rem);
  }
}

/* Ventana completa: la página no se desplaza; la tabla muestra los aportes que entran */
.don--fit {
  display: flex;
  flex-direction: column;
  gap: clamp(var(--space-3), 2vh, var(--space-5));
  min-height: 0;
}

.don--fit :deep(.page-header__title) {
  font-size: clamp(1.9rem, 4.6vh, 3.25rem);
}

.don--fit .band > * {
  padding-block: clamp(var(--space-2), 1.5vh, var(--space-4));
}

.don--fit .don__body {
  flex: 1;
  min-height: 0;
  align-items: stretch;
  grid-template-columns: minmax(0, 1fr) clamp(18rem, 24vw, 23rem);
  grid-template-rows: minmax(0, 1fr);
}

@media (max-width: 1199.98px) {
  .don--fit .don__body {
    grid-template-columns: minmax(0, 1fr);
  }
}

.don--fit .card {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding-block: clamp(var(--space-2), 1.5vh, var(--space-5));
}

.don--fit .card__panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.don--fit :deep(.tabs) {
  gap: 0;
}

.don--fit :deep(.tabs__tab) {
  gap: 0.35rem;
  min-height: 2.4rem;
  padding-inline: 0.5rem;
  font-size: var(--text-sm);
}

.don--fit :deep(.tabs__count) {
  min-width: 1.3rem;
  padding-inline: 0.3rem;
}

.don--fit .don__side {
  min-height: 0;
  overflow-y: auto;
}

.don--fit .don__table {
  /* La base en cero: el alto sale del espacio libre, no del contenido */
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
}

.don--fit .don__table td {
  height: 3.5rem;
  padding-block: 0;
}
</style>
