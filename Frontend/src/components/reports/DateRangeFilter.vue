<script setup lang="ts">
/**
 * Filtro por rango de fechas, igual en todas las pantallas: un botón compacto que dice
 * qué fechas se ven («Todas las fechas», «Este mes», «1 nov 2026 – 15 nov 2026») y abre
 * atajos y el calendario del sistema para un rango propio. El panel flota sobre la
 * página: ninguna tarjeta lo recorta.
 */
import { computed, ref, useId, watch } from 'vue'

import { useClickOutside, useFloating } from '../../composables/useFloating'
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
import CalendarGrid from '../ui/CalendarGrid.vue'

const props = withDefaults(
  defineProps<{
    modelValue: DateRangeValue
    /** Qué fecha se filtra: «Fecha de registro», «Fecha de ingreso»… */
    label?: string
    /** Sin la opción «Todas las fechas» */
    required?: boolean
    /** Qué se ve sin rango propio (Donaciones: «Todo noviembre», el mes de arriba) */
    emptyLabel?: string
    size?: 'sm' | 'md'
  }>(),
  {
    label: 'Fechas',
    required: false,
    emptyLabel: 'Todas las fechas',
    size: 'md',
  },
)

const emit = defineEmits<{ 'update:modelValue': [value: DateRangeValue] }>()

const id = useId()
const open = ref(false)
const trigger = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const draft = ref<DateRangeValue>({ ...props.modelValue })
const today = computed(() => todayIso())
const error = computed(() => rangeError(draft.value))
const current = computed(() => presetOf(props.modelValue, today.value))
const text = computed(() =>
  isActive(props.modelValue)
    ? periodLabel(props.modelValue, today.value)
    : props.emptyLabel,
)
const draftText = computed(() => {
  if (!draft.value.from) return 'Elige el primer día'
  if (!draft.value.to) return 'Ahora elige el último día'
  return periodLabel(draft.value, today.value)
})
const { floatingStyle, ready } = useFloating(trigger, panel, open)
useClickOutside(
  [trigger, panel],
  open,
  () => close(false),
  () => close(),
)

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
    await ready()
    panel.value?.querySelector<HTMLElement>('button')?.focus()
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
  if (error.value || !draft.value.from) return
  const range = {
    from: draft.value.from,
    to: draft.value.to || draft.value.from,
  }
  emit('update:modelValue', range)
  close()
}

function clear() {
  emit('update:modelValue', { ...ALL_DATES })
  close()
}
</script>

<template>
  <div class="range" :class="`range--${size}`">
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
      <AppIcon name="chevron" :size="14" class="range__caret" />
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        :id="`${id}-panel`"
        ref="panel"
        class="range__panel"
        role="dialog"
        :aria-label="label"
        :style="floatingStyle"
        @keydown.esc.stop="close()"
      >
        <p class="range__title">{{ label }}</p>
        <div class="range__layout">
          <div class="range__presets" role="group" aria-label="Atajos">
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

          <div class="range__custom">
            <p class="range__hint" aria-live="polite">{{ draftText }}</p>
            <CalendarGrid
              mode="range"
              :range="draft"
              label="Rango propio"
              @update:range="draft = $event"
            />
            <p v-if="error" class="range__error" role="alert">{{ error }}</p>
          </div>
        </div>
        <div class="range__actions">
          <button
            v-if="!required"
            type="button"
            class="range__link"
            @click="clear"
          >
            {{ emptyLabel }}
          </button>
          <button
            type="button"
            class="range__apply"
            :disabled="Boolean(error) || !draft.from"
            @click="apply"
          >
            Aplicar
          </button>
        </div>
      </div>
    </Teleport>
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

.range--sm .range__trigger {
  min-height: 2.5rem;
  font-size: var(--text-sm);
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
}
</style>

<style>
/* El panel va en <body>: estilos sin «scoped» */
.range__panel {
  z-index: calc(var(--z-sticky) + 5);
  display: grid;
  gap: var(--space-3);
  width: min(31rem, calc(100vw - 1.5rem));
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-lg);
}

.range__title {
  margin: 0;
  color: var(--color-heading);
  font-weight: 600;
}

/* Atajos en una columna a la izquierda y el calendario a la derecha: el panel es bajo y
   entra sin barras de desplazamiento */
.range__layout {
  display: grid;
  grid-template-columns: 9.5rem minmax(0, 1fr);
  gap: var(--space-4);
}

.range__presets {
  display: grid;
  align-content: start;
  gap: var(--space-1);
  padding-right: var(--space-4);
  border-right: 1px solid var(--color-border);
}

.range__chip {
  min-height: 2.1rem;
  padding: 0 var(--space-3);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text);
  font: inherit;
  font-size: var(--text-sm);
  text-align: left;
  cursor: pointer;
}

.range__chip:hover {
  background: var(--color-surface-sunken, #f3f1ec);
}

.range__chip[aria-pressed='true'] {
  border-color: var(--aspar-guindo);
  background: var(--rosa-100);
  color: var(--aspar-guindo);
  font-weight: 600;
}

.range__custom {
  display: grid;
  justify-items: center;
  align-content: start;
  gap: var(--space-2);
}

.range__hint {
  justify-self: start;
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.range__error {
  justify-self: start;
  margin: 0;
  color: var(--color-danger);
  font-size: var(--text-sm);
}

.range__actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
}

/* Celular: los atajos arriba, en fila, y el calendario debajo */
@media (max-width: 560px) {
  .range__layout {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-3);
  }

  .range__presets {
    display: flex;
    flex-wrap: wrap;
    padding: 0 0 var(--space-3);
    border-right: 0;
    border-bottom: 1px solid var(--color-border);
  }

  .range__chip {
    border-color: var(--color-border-strong);
    border-radius: var(--radius-pill);
  }
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
  min-height: 2.25rem;
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
