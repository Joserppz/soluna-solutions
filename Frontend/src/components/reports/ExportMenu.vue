<script setup lang="ts">
/**
 * «Descargar»: el resultado completo del filtro de la pantalla en Excel o CSV (no solo la
 * página que se ve). Dice cuántas filas salen y solo aparece para los roles con
 * «reports:export»; la API vuelve a verificar el permiso y deja la descarga en el
 * registro de actividad.
 *
 * En las pantallas de calendario (Actividades, Asistencia) el rango se elige aquí mismo
 * con `range`.
 */
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'

import { isApiError } from '../../api/errors'
import { useApi } from '../../composables/useApi'
import { useToast } from '../../composables/useToast'
import { rangeError, type DateRangeValue } from '../../utils/dateRange'
import { saveBlob } from '../../utils/download'
import { todayIso } from '../../utils/format'
import AppIcon from '../ui/AppIcon.vue'

export type ExportFormat = 'xlsx' | 'csv'

const props = withDefaults(
  defineProps<{
    /** Pide el archivo a la API con el filtro actual de la pantalla. */
    download: (format: ExportFormat, range?: DateRangeValue) => Promise<Blob>
    /** Prefijo del archivo: «afiliados» → afiliados-2026-11-26.xlsx */
    filename: string
    /** Filas del filtro actual (el total del listado); null si aún no se sabe. */
    total?: number | null
    /** Qué se descarga, para el lector de pantalla: «afiliados», «materiales»… */
    what?: string
    /** Rango para elegir dentro del menú (pantallas sin filtro de fechas propio). */
    range?: DateRangeValue | null
    size?: 'sm' | 'md'
  }>(),
  { total: null, what: 'filas', range: null, size: 'md' },
)

const emit = defineEmits<{ downloaded: [format: ExportFormat] }>()

const { session } = useApi()
const toast = useToast()
const id = useId()
const allowed = computed(() => session.can('reports:export'))
const open = ref(false)
const busy = ref<ExportFormat | null>(null)
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const draft = ref<DateRangeValue | null>(
  props.range ? { ...props.range } : null,
)

watch(
  () => props.range,
  (value) => {
    draft.value = value ? { ...value } : null
  },
)

const draftError = computed(() => {
  if (!draft.value) return null
  if (!draft.value.from || !draft.value.to) return 'Elige desde y hasta.'
  return rangeError(draft.value)
})
const empty = computed(() => props.total === 0 && !draft.value)
const summary = computed(() => {
  if (draft.value) return 'Del rango que elijas aquí.'
  if (props.total === null) return 'Todo lo que cumple el filtro actual.'
  if (props.total === 0) return 'No hay filas con este filtro.'
  return props.total === 1
    ? 'Se descarga 1 fila con el filtro actual.'
    : `Se descargan ${props.total} filas con el filtro actual.`
})

async function toggle() {
  open.value = !open.value
  if (open.value) {
    await nextTick()
    panel.value
      ?.querySelector<HTMLElement>('input, button:not(:disabled)')
      ?.focus()
  }
}

function close(returnFocus = true) {
  if (!open.value) return
  open.value = false
  if (returnFocus) trigger.value?.focus()
}

async function save(format: ExportFormat) {
  if (draftError.value || busy.value) return
  busy.value = format
  try {
    const blob = await props.download(format, draft.value ?? undefined)
    saveBlob(blob, `${props.filename}-${todayIso()}.${format}`)
    toast.success(
      props.total !== null && !draft.value
        ? `Descargamos ${props.total} ${props.total === 1 ? 'fila' : 'filas'}.`
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

function onDocumentClick(event: MouseEvent) {
  if (open.value && !root.value?.contains(event.target as Node)) close(false)
}

watch(open, (value) => {
  if (value) document.addEventListener('mousedown', onDocumentClick)
  else document.removeEventListener('mousedown', onDocumentClick)
})
onBeforeUnmount(() =>
  document.removeEventListener('mousedown', onDocumentClick),
)
</script>

<template>
  <div
    v-if="allowed"
    ref="root"
    class="export"
    :class="`export--${size}`"
    @keydown.esc.stop="close()"
  >
    <button
      ref="trigger"
      type="button"
      class="export__trigger"
      :aria-expanded="open"
      :aria-controls="`${id}-menu`"
      aria-haspopup="true"
      @click="toggle"
    >
      <AppIcon name="download" :size="18" />
      <span>Descargar</span>
      <span class="visually-hidden"> {{ what }}</span>
    </button>

    <div
      v-if="open"
      :id="`${id}-menu`"
      ref="panel"
      class="export__panel"
      role="group"
      :aria-label="`Descargar ${what}`"
    >
      <p class="export__summary">{{ summary }}</p>

      <div v-if="draft" class="export__range">
        <label class="export__field">
          <span>Desde</span>
          <input
            v-model="draft.from"
            class="input"
            type="date"
            :max="draft.to || undefined"
          />
        </label>
        <label class="export__field">
          <span>Hasta</span>
          <input
            v-model="draft.to"
            class="input"
            type="date"
            :min="draft.from || undefined"
          />
        </label>
        <p v-if="draftError" class="export__error" role="alert">
          {{ draftError }}
        </p>
      </div>

      <div class="export__options">
        <button
          type="button"
          class="export__option"
          :disabled="empty || Boolean(draftError) || busy !== null"
          @click="save('xlsx')"
        >
          <strong>{{ busy === 'xlsx' ? 'Preparando…' : 'Excel' }}</strong>
          <small>.xlsx, con formato</small>
        </button>
        <button
          type="button"
          class="export__option"
          :disabled="empty || Boolean(draftError) || busy !== null"
          @click="save('csv')"
        >
          <strong>{{ busy === 'csv' ? 'Preparando…' : 'CSV' }}</strong>
          <small>Para Excel en español</small>
        </button>
      </div>
      <div v-if="$slots.extra" class="export__extra">
        <slot name="extra" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.export {
  position: relative;
  flex: none;
}

.export__trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  width: 100%;
  min-height: var(--control-height, 3rem);
  padding: 0 var(--space-4);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-heading);
  font: inherit;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}

.export--sm .export__trigger {
  min-height: 2.5rem;
  padding: 0 var(--space-3);
  font-size: var(--text-sm);
}

.export__trigger:hover {
  border-color: var(--aspar-verde);
  background: var(--color-surface-sunken, #f3f1ec);
}

.export__panel {
  position: absolute;
  top: calc(100% + var(--space-2));
  right: 0;
  z-index: calc(var(--z-sticky) + 5);
  display: grid;
  gap: var(--space-3);
  width: min(19rem, calc(100vw - 2rem));
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-lg);
}

.export__summary {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.export__range {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
}

.export__field {
  display: grid;
  gap: var(--space-1);
  font-size: var(--text-sm);
  font-weight: 600;
}

.export__field .input {
  min-height: 2.6rem;
  padding: 0 var(--space-2);
}

.export__error {
  grid-column: 1 / -1;
  margin: 0;
  color: var(--color-danger);
  font-size: var(--text-sm);
}

.export__options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
}

.export__option {
  display: grid;
  gap: 2px;
  padding: var(--space-3);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.export__option:hover:not(:disabled) {
  border-color: var(--aspar-verde);
  background: var(--color-surface-sunken, #f3f1ec);
}

.export__option:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.export__extra {
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
  font-size: var(--text-sm);
}

.export__option strong {
  color: var(--color-heading);
}

.export__option small {
  color: var(--color-text-muted);
  font-size: var(--text-xs);
}
</style>
