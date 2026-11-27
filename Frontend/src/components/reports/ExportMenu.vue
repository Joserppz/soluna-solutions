<script setup lang="ts">
/**
 * «Descargar»: un solo botón por pantalla, cuadrado y con el ícono, que abre lo que se
 * puede bajar ahí. Cada opción trae el resultado completo de su filtro en Excel o CSV (no
 * solo la página que se ve) y dice cuántas filas salen. Solo aparece para los roles con
 * «reports:export»; la API vuelve a verificar el permiso y deja la descarga en el
 * registro de actividad.
 *
 * Una opción simple va con `download`/`filename`/`total`; varias, con `items`. Una opción
 * con `range` elige sus fechas en el mismo menú (Actividades, Asistencia). El panel flota
 * sobre la página, así ninguna tarjeta lo recorta.
 */
import { computed, nextTick, reactive, ref, useId, watch } from 'vue'

import { isApiError } from '../../api/errors'
import { useApi } from '../../composables/useApi'
import { useClickOutside, useFloating } from '../../composables/useFloating'
import { useToast } from '../../composables/useToast'
import {
  periodLabel,
  rangeError,
  type DateRangeValue,
} from '../../utils/dateRange'
import { saveBlob } from '../../utils/download'
import { todayIso } from '../../utils/format'
import AppIcon from '../ui/AppIcon.vue'
import CalendarGrid from '../ui/CalendarGrid.vue'

export type ExportFormat = 'xlsx' | 'pdf'

export interface ExportItem {
  /** «Registro de aportes», «Resumen de noviembre»… */
  title: string
  /** Prefijo del archivo: «afiliados» → afiliados-2026-11-26.xlsx */
  filename: string
  /** Pide el archivo a la API con el filtro de la pantalla (y el rango, si tiene). */
  download: (format: ExportFormat, range?: DateRangeValue) => Promise<Blob>
  /** Filas del filtro actual; null si no se sabe o no aplica. */
  total?: number | null
  /** Texto propio en lugar de «N filas con el filtro actual». */
  detail?: string
  /** Fechas que se eligen dentro del menú. */
  range?: DateRangeValue | null
  /** Lo que va después del prefijo en el archivo; por defecto, la fecha de hoy. */
  stamp?: string
}

const props = withDefaults(
  defineProps<{
    /** Varias cosas para descargar desde el mismo botón. */
    items?: ExportItem[]
    download?: ExportItem['download']
    filename?: string
    total?: number | null
    range?: DateRangeValue | null
    /** Título de la opción simple */
    title?: string
    /** Qué se descarga, para el lector de pantalla: «afiliados», «aportes»… */
    what?: string
    size?: 'sm' | 'md'
  }>(),
  {
    items: undefined,
    download: undefined,
    filename: 'reporte',
    total: null,
    range: null,
    title: '',
    what: 'filas',
    size: 'md',
  },
)

const emit = defineEmits<{ downloaded: [format: ExportFormat] }>()

const { session } = useApi()
const toast = useToast()
const id = useId()
const allowed = computed(() => session.can('reports:export'))
const open = ref(false)
const busy = ref<string | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const { floatingStyle, place, ready } = useFloating(trigger, panel, open)
useClickOutside(
  [trigger, panel],
  open,
  () => close(false),
  () => close(),
)

const options = computed<ExportItem[]>(() => {
  if (props.items) return props.items
  if (!props.download) return []
  return [
    {
      title: props.title || `Listado de ${props.what}`,
      filename: props.filename,
      download: props.download,
      total: props.total,
      range: props.range,
    },
  ]
})

/** Rango elegido en el menú, por opción */
const ranges = reactive<Record<number, DateRangeValue>>({})
const editing = ref<number | null>(null)

function syncRanges() {
  for (const key of Object.keys(ranges)) delete ranges[Number(key)]
  options.value.forEach((item, index) => {
    if (item.range) ranges[index] = { ...item.range }
  })
}
syncRanges()
watch(() => options.value.map((item) => item.range), syncRanges, {
  deep: true,
})

function withEnd(range: DateRangeValue): DateRangeValue {
  return { from: range.from, to: range.to || range.from }
}

function problem(index: number): string | null {
  const range = ranges[index]
  if (!range) return null
  if (!range.from) return 'Elige desde qué día.'
  return rangeError(withEnd(range))
}

function summary(item: ExportItem, index: number): string {
  const range = ranges[index]
  if (range) return range.from ? periodLabel(withEnd(range)) : 'Sin fechas'
  if (item.detail) return item.detail
  if (item.total === null || item.total === undefined)
    return 'Todo lo del filtro actual'
  if (item.total === 0) return 'No hay filas con este filtro'
  return item.total === 1
    ? '1 fila con el filtro actual'
    : `${item.total} filas con el filtro actual`
}

function blocked(item: ExportItem, index: number): boolean {
  return (
    (item.total === 0 && !ranges[index]) ||
    Boolean(problem(index)) ||
    busy.value !== null
  )
}

async function toggle() {
  open.value = !open.value
  editing.value = null
  if (open.value) {
    syncRanges()
    await ready()
    panel.value
      ?.querySelector<HTMLElement>('.export__option:not(:disabled), button')
      ?.focus()
  }
}

function close(returnFocus = true) {
  if (!open.value) return
  open.value = false
  if (returnFocus) trigger.value?.focus()
}

async function editRange(index: number) {
  editing.value = editing.value === index ? null : index
  await nextTick()
  place()
}

async function save(item: ExportItem, index: number, format: ExportFormat) {
  if (blocked(item, index)) return
  busy.value = `${index}-${format}`
  try {
    const range = ranges[index] ? withEnd(ranges[index]!) : undefined
    const blob = await item.download(format, range)
    saveBlob(blob, `${item.filename}-${item.stamp ?? todayIso()}.${format}`)
    toast.success(
      typeof item.total === 'number' && !range
        ? `Descargamos ${item.total} ${item.total === 1 ? 'fila' : 'filas'}.`
        : 'Descargamos el reporte.',
    )
    emit('downloaded', format)
    close()
  } catch (failure) {
    toast.error(
      isApiError(failure)
        ? failure.message
        : 'No pudimos descargar el reporte. Intenta de nuevo.',
    )
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <div
    v-if="allowed && options.length"
    class="export"
    :class="`export--${size}`"
  >
    <button
      ref="trigger"
      type="button"
      class="export__trigger"
      :aria-expanded="open"
      :aria-controls="`${id}-menu`"
      aria-haspopup="true"
      :aria-label="`Descargar ${what}`"
      title="Descargar"
      @click="toggle"
    >
      <AppIcon name="download" :size="size === 'sm' ? 17 : 19" />
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        :id="`${id}-menu`"
        ref="panel"
        class="export__panel"
        role="group"
        :aria-label="`Descargar ${what}`"
        :style="floatingStyle"
        @keydown.esc.stop="close()"
      >
        <p class="export__heading">Descargar</p>
        <section
          v-for="(item, index) in options"
          :key="item.title"
          class="export__item"
          :aria-label="item.title"
        >
          <div class="export__info">
            <strong class="export__title">{{ item.title }}</strong>
            <span class="export__summary">{{ summary(item, index) }}</span>
            <button
              v-if="ranges[index]"
              type="button"
              class="export__change"
              :aria-expanded="editing === index"
              @click="editRange(index)"
            >
              {{ editing === index ? 'Listo' : 'Cambiar fechas' }}
            </button>
          </div>
          <div v-if="ranges[index] && editing === index" class="export__range">
            <CalendarGrid
              mode="range"
              :range="ranges[index]!"
              :label="`Fechas de ${item.title}`"
              @update:range="ranges[index] = $event"
            />
          </div>
          <p v-if="problem(index)" class="export__error" role="alert">
            {{ problem(index) }}
          </p>
          <div class="export__formats">
            <button
              type="button"
              class="export__option"
              :disabled="blocked(item, index)"
              :aria-label="`Descargar ${item.title.toLowerCase()} en Excel`"
              @click="save(item, index, 'xlsx')"
            >
              {{ busy === `${index}-xlsx` ? 'Preparando…' : 'Excel' }}
            </button>
            <button
              type="button"
              class="export__option"
              :disabled="blocked(item, index)"
              :aria-label="`Descargar ${item.title.toLowerCase()} en PDF`"
              @click="save(item, index, 'pdf')"
            >
              {{ busy === `${index}-pdf` ? 'Preparando…' : 'PDF' }}
            </button>
          </div>
        </section>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.export {
  flex: none;
}

.export__trigger {
  display: grid;
  place-items: center;
  width: var(--control-height, 3rem);
  height: var(--control-height, 3rem);
  padding: 0;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-heading);
  cursor: pointer;
  transition:
    background-color var(--duration-fast, 120ms) ease,
    border-color var(--duration-fast, 120ms) ease;
}

.export--sm .export__trigger {
  width: 2.5rem;
  height: 2.5rem;
}

.export__trigger:hover,
.export__trigger[aria-expanded='true'] {
  border-color: var(--aspar-verde);
  background: var(--color-surface-sunken, #f3f1ec);
}
</style>

<style>
/* El panel va en <body>: estilos sin «scoped» */
.export__panel {
  z-index: calc(var(--z-sticky) + 5);
  display: grid;
  gap: var(--space-2);
  width: min(20rem, calc(100vw - 1.5rem));
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-lg);
}

.export__heading {
  margin: 0 var(--space-1);
  color: var(--color-text-subtle);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.export__item {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.export__info {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  column-gap: var(--space-2);
}

.export__title {
  color: var(--color-heading);
  font-size: var(--text-md);
}

.export__summary {
  grid-column: 1;
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.export__change {
  grid-column: 2;
  grid-row: 1 / span 2;
  align-self: center;
  padding: var(--space-1) var(--space-2);
  border: 0;
  border-radius: var(--radius-sm);
  background: none;
  color: var(--color-link);
  font: inherit;
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
}

.export__change:hover {
  background: var(--rosa-100);
}

.export__range {
  display: grid;
  justify-items: center;
}

.export__error {
  margin: 0;
  color: var(--color-danger);
  font-size: var(--text-sm);
}

.export__formats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
}

.export__option {
  min-height: 2.25rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-heading);
  font: inherit;
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
}

.export__option:hover:not(:disabled) {
  border-color: var(--aspar-verde);
  background: var(--color-surface-sunken, #f3f1ec);
}

.export__option:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
