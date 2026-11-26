<script setup lang="ts">
/**
 * Filtro por rango de fechas, igual en todas las pantallas: un botón compacto que dice
 * qué fechas se ven («Todas las fechas», «Este mes», «1 nov 2026 – 15 nov 2026») y abre
 * atajos y un rango propio. Ocupa lo mismo que un campo, así entra en cada barra de
 * filtros sin agregar barras de desplazamiento.
 */
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'

import {
  ALL_DATES,
  PRESETS,
  isActive,
  periodLabel,
  presetOf,
  presetRange,
  rangeError,
  type DateRangeValue,
  type PresetKey,
} from '../../utils/dateRange'
import { todayIso } from '../../utils/format'
import AppIcon from '../ui/AppIcon.vue'

const props = withDefaults(
  defineProps<{
    modelValue: DateRangeValue
    /** Qué fecha se filtra: «Fecha de registro», «Fecha de ingreso»… */
    label?: string
    /** Sin la opción «Todas las fechas» (por ejemplo, la asistencia siempre va por rango). */
    required?: boolean
  }>(),
  { label: 'Fechas', required: false },
)

const emit = defineEmits<{ 'update:modelValue': [value: DateRangeValue] }>()

const id = useId()
const open = ref(false)
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const draft = ref<DateRangeValue>({ ...props.modelValue })
const today = computed(() => todayIso())
const error = computed(() => rangeError(draft.value))
const current = computed(() => presetOf(props.modelValue, today.value))
const text = computed(() => periodLabel(props.modelValue, today.value))

watch(
  () => props.modelValue,
  (value) => {
    draft.value = { ...value }
  },
)

async function toggle() {
  open.value = !open.value
  if (open.value) {
    draft.value = { ...props.modelValue }
    await nextTick()
    panel.value?.querySelector<HTMLElement>('button, input')?.focus()
  }
}

function close(returnFocus = true) {
  if (!open.value) return
  open.value = false
  if (returnFocus) trigger.value?.focus()
}

function choose(key: PresetKey) {
  emit('update:modelValue', presetRange(key, today.value))
  close()
}

function apply() {
  if (error.value) return
  if (props.required && (!draft.value.from || !draft.value.to)) return
  emit('update:modelValue', { ...draft.value })
  close()
}

function clear() {
  emit('update:modelValue', { ...ALL_DATES })
  close()
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
  <div ref="root" class="range" @keydown.esc.stop="close()">
    <button
      ref="trigger"
      type="button"
      class="range__trigger"
      :class="{ 'is-set': isActive(modelValue) }"
      :aria-expanded="open"
      :aria-controls="`${id}-panel`"
      aria-haspopup="dialog"
      @click="toggle"
    >
      <AppIcon name="calendar" :size="18" />
      <span class="range__text">
        <span class="visually-hidden">{{ label }}: </span>{{ text }}
      </span>
      <span class="range__caret" aria-hidden="true">▾</span>
    </button>

    <div
      v-if="open"
      :id="`${id}-panel`"
      ref="panel"
      class="range__panel"
      role="dialog"
      :aria-label="label"
    >
      <p class="range__title">{{ label }}</p>
      <div class="range__presets">
        <button
          v-for="preset in PRESETS"
          :key="preset.key"
          type="button"
          class="range__chip"
          :aria-pressed="current === preset.key"
          @click="choose(preset.key)"
        >
          {{ preset.label }}
        </button>
      </div>

      <form class="range__custom" novalidate @submit.prevent="apply">
        <label class="range__field">
          <span>Desde</span>
          <input
            v-model="draft.from"
            class="input"
            type="date"
            :max="draft.to || undefined"
            :required="required"
          />
        </label>
        <label class="range__field">
          <span>Hasta</span>
          <input
            v-model="draft.to"
            class="input"
            type="date"
            :min="draft.from || undefined"
            :required="required"
          />
        </label>
        <p v-if="error" class="range__error" role="alert">{{ error }}</p>
        <div class="range__actions">
          <button
            v-if="!required"
            type="button"
            class="range__link"
            @click="clear"
          >
            Todas las fechas
          </button>
          <button
            type="submit"
            class="range__apply"
            :disabled="
              Boolean(error) || (required && (!draft.from || !draft.to))
            "
          >
            Aplicar
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.range {
  position: relative;
  min-width: 0;
}

.range__trigger {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  min-height: var(--control-height, 3rem);
  padding: 0 var(--space-3);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  box-shadow: var(--shadow-inset);
  color: var(--color-text);
  font: inherit;
  font-size: var(--text-md);
  text-align: left;
  cursor: pointer;
}

.range__trigger:hover {
  border-color: var(--color-text-subtle);
}

.range__trigger.is-set {
  border-color: var(--aspar-guindo);
  background: var(--rosa-100);
  color: var(--aspar-guindo);
  font-weight: 600;
}

.range__text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.range__caret {
  color: var(--color-text-subtle);
  font-size: var(--text-sm);
}

.range__panel {
  position: absolute;
  top: calc(100% + var(--space-2));
  right: 0;
  z-index: calc(var(--z-sticky) + 5);
  display: grid;
  gap: var(--space-3);
  width: min(22rem, calc(100vw - 2rem));
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-lg);
}

.range__title {
  margin: 0;
  font-weight: 600;
  color: var(--color-heading);
}

.range__presets {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.range__chip {
  min-height: 2.25rem;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-size: var(--text-sm);
  cursor: pointer;
}

.range__chip:hover,
.range__chip[aria-pressed='true'] {
  border-color: var(--aspar-guindo);
  background: var(--rosa-100);
  color: var(--aspar-guindo);
  font-weight: 600;
}

.range__custom {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
}

.range__field {
  display: grid;
  gap: var(--space-1);
  font-size: var(--text-sm);
  font-weight: 600;
}

.range__field .input {
  min-height: 2.6rem;
  padding: 0 var(--space-2);
}

.range__error {
  grid-column: 1 / -1;
  margin: 0;
  color: var(--color-danger);
  font-size: var(--text-sm);
}

.range__actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: var(--space-3);
}

.range__link {
  margin-right: auto;
  padding: 0;
  border: 0;
  background: none;
  color: var(--color-link);
  font: inherit;
  font-size: var(--text-sm);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 0.2em;
  cursor: pointer;
}

.range__apply {
  min-height: 2.5rem;
  padding: 0 var(--space-5);
  border: 0;
  border-radius: var(--radius-sm);
  background: var(--aspar-guindo);
  color: #fff;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.range__apply:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
