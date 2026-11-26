<script setup lang="ts">
/**
 * Campo de fecha del sistema: se ve como los demás campos y abre el calendario propio
 * (el mismo de los filtros) en un panel flotante. Reemplaza al <input type="date"> del
 * navegador, que cambia de aspecto en cada equipo. Funciona con FormField (`id`).
 */
import { computed, ref } from 'vue'

import { useClickOutside, useFloating } from '../../composables/useFloating'
import { todayIso } from '../../utils/format'
import AppIcon from './AppIcon.vue'
import CalendarGrid from './CalendarGrid.vue'

// El panel va en <body>: la clase y demás atributos van al campo, no a la raíz doble
defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    modelValue: string
    id?: string
    min?: string
    max?: string
    marked?: string[]
    placeholder?: string
    /** «long»: «sábado, 28 de noviembre de 2026» · «short»: «28/11/2026» */
    format?: 'long' | 'short'
    clearable?: boolean
    disabled?: boolean
    invalid?: boolean
    describedby?: string
    /** Nombre para el lector de pantalla cuando no hay <label> */
    ariaLabel?: string
  }>(),
  {
    id: undefined,
    min: '',
    max: '',
    marked: () => [],
    placeholder: 'Elegir fecha',
    format: 'short',
    clearable: false,
    disabled: false,
    invalid: false,
    describedby: undefined,
    ariaLabel: undefined,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: [value: string]
}>()

const open = ref(false)
const trigger = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const calendar = ref<InstanceType<typeof CalendarGrid> | null>(null)
const { floatingStyle, ready } = useFloating(trigger, panel, open)
useClickOutside(
  [trigger, panel],
  open,
  () => (open.value = false),
  () => close(),
)

const longFormat = new Intl.DateTimeFormat('es-BO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const text = computed(() => {
  const value = props.modelValue
  if (!value) return ''
  if (props.format === 'short')
    return `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`
  const label = longFormat.format(new Date(`${value}T12:00:00`))
  return label.charAt(0).toUpperCase() + label.slice(1)
})

const today = todayIso()
const todayAllowed = computed(
  () =>
    (!props.min || today >= props.min) && (!props.max || today <= props.max),
)

async function toggle() {
  if (props.disabled) return
  open.value = !open.value
  if (open.value) {
    await ready()
    calendar.value?.focusDay()
  }
}

function close() {
  open.value = false
  trigger.value?.focus()
}

function pick(day: string) {
  emit('update:modelValue', day)
  emit('change', day)
  close()
}
</script>

<template>
  <button
    v-bind="$attrs"
    :id="id"
    ref="trigger"
    type="button"
    class="input date-field"
    :class="{ 'is-empty': !modelValue }"
    :disabled="disabled"
    :aria-expanded="open"
    aria-haspopup="dialog"
    :aria-invalid="invalid || undefined"
    :aria-describedby="describedby"
    :aria-label="ariaLabel ? `${ariaLabel}: ${text || placeholder}` : undefined"
    @click="toggle"
  >
    <span class="date-field__text">{{ text || placeholder }}</span>
    <AppIcon name="calendar" :size="18" />
  </button>
  <Teleport to="body">
    <div
      v-if="open"
      ref="panel"
      class="date-panel"
      role="dialog"
      aria-label="Elegir fecha"
      :style="floatingStyle"
      @keydown.esc.stop="close"
    >
      <CalendarGrid
        ref="calendar"
        :value="modelValue"
        :min="min"
        :max="max"
        :marked="marked"
        @pick="pick"
      />
      <div class="date-panel__foot">
        <button
          v-if="clearable && modelValue"
          type="button"
          class="date-panel__link"
          @click="pick('')"
        >
          Borrar
        </button>
        <button
          v-if="todayAllowed"
          type="button"
          class="date-panel__link date-panel__today"
          @click="pick(today)"
        >
          Hoy
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.date-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  text-align: left;
  cursor: pointer;
  font-variant-numeric: tabular-nums;
}

.date-field.is-empty .date-field__text {
  color: var(--color-text-subtle);
}

.date-field__text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.date-field :deep(.app-icon) {
  color: var(--color-text-muted);
}

.date-field:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
</style>

<style>
/* El panel va en <body>: estilos sin «scoped» */
.date-panel {
  z-index: calc(var(--z-modal) + 5);
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-lg);
}

.date-panel__foot {
  display: flex;
  justify-content: space-between;
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border);
}

.date-panel__today {
  margin-left: auto;
}

.date-panel__link {
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

.date-panel__link:hover {
  background: var(--rosa-100);
}
</style>
