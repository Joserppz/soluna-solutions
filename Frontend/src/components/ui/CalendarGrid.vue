<script setup lang="ts">
/**
 * Calendario del sistema (el mismo en filtros, formularios y asistencia): un mes con la
 * semana de lunes a domingo, mes y año para saltar lejos (fechas de nacimiento), hoy
 * marcado y los días fuera de `min`/`max` apagados. Elige un día o un rango.
 *
 * Teclado: flechas (día y semana), Inicio/Fin (semana), Re Pág/Av Pág (mes), Intro elige.
 */
import { computed, nextTick, ref, useId, watch } from 'vue'

import type { DateRangeValue } from '../../utils/dateRange'
import { todayIso } from '../../utils/format'

const props = withDefaults(
  defineProps<{
    mode?: 'single' | 'range'
    /** Día elegido (modo single) */
    value?: string
    /** Rango elegido (modo range) */
    range?: DateRangeValue
    min?: string
    max?: string
    /** Días con algo (por ejemplo, actividades): llevan un punto */
    marked?: string[]
    label?: string
  }>(),
  {
    mode: 'single',
    value: '',
    range: () => ({ from: '', to: '' }),
    min: '',
    max: '',
    marked: () => [],
    label: 'Calendario',
  },
)

const emit = defineEmits<{
  pick: [day: string]
  'update:range': [range: DateRangeValue]
}>()

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]
const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const WEEKDAY_NAMES = [
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
  'domingo',
]

const today = todayIso()
const uid = useId()

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function parts(day: string): [number, number, number] {
  const [y, m, d] = day.split('-').map(Number)
  return [y!, m! - 1, d!]
}

function shift(day: string, days: number): string {
  const [y, m, d] = parts(day)
  const date = new Date(Date.UTC(y, m, d + days, 12))
  return iso(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

function clamp(day: string): string {
  if (props.min && day < props.min) return props.min
  if (props.max && day > props.max) return props.max
  return day
}

const start = props.mode === 'range' ? props.range.from : props.value
const initial = clamp(start || today)
const view = ref<{ year: number; month: number }>({
  year: parts(initial)[0],
  month: parts(initial)[1],
})
const focused = ref(initial)
const grid = ref<HTMLElement | null>(null)

watch(
  () => (props.mode === 'range' ? props.range.from : props.value),
  (day) => {
    if (!day) return
    const [y, m] = parts(day)
    view.value = { year: y, month: m }
    focused.value = day
  },
)

const years = computed(() => {
  const first = props.min ? parts(props.min)[0] : parts(today)[0] - 100
  const last = props.max ? parts(props.max)[0] : parts(today)[0] + 5
  return Array.from({ length: last - first + 1 }, (_, i) => last - i)
})

const weeks = computed(() => {
  const { year, month } = view.value
  const first = new Date(Date.UTC(year, month, 1, 12))
  // Lunes = 0
  const offset = (first.getUTCDay() + 6) % 7
  const days = new Date(Date.UTC(year, month + 1, 0, 12)).getUTCDate()
  const cells: (string | null)[] = [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: days }, (_, i) => iso(year, month, i + 1)),
  ]
  while (cells.length % 7) cells.push(null)
  const rows: (string | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
  return rows
})

const marked = computed(() => new Set(props.marked))

function disabled(day: string): boolean {
  return Boolean(
    (props.min && day < props.min) || (props.max && day > props.max),
  )
}

function selected(day: string): boolean {
  if (props.mode === 'single') return day === props.value
  return day === props.range.from || day === props.range.to
}

function inRange(day: string): boolean {
  const { from, to } = props.range
  return props.mode === 'range' && Boolean(from && to) && day > from && day < to
}

function dayLabel(day: string): string {
  const [y, m, d] = parts(day)
  const weekday =
    WEEKDAY_NAMES[(new Date(Date.UTC(y, m, d, 12)).getUTCDay() + 6) % 7]
  return `${weekday} ${d} de ${MONTHS[m]} de ${y}`
}

function choose(day: string) {
  if (disabled(day)) return
  focused.value = day
  if (props.mode === 'single') {
    emit('pick', day)
    return
  }
  const { from, to } = props.range
  // Primer clic: desde. Segundo: hasta (si es anterior, se ordenan solos)
  if (!from || (from && to)) emit('update:range', { from: day, to: '' })
  else if (day < from) emit('update:range', { from: day, to: from })
  else emit('update:range', { from, to: day })
}

function goMonth(delta: number) {
  const date = new Date(
    Date.UTC(view.value.year, view.value.month + delta, 1, 12),
  )
  view.value = { year: date.getUTCFullYear(), month: date.getUTCMonth() }
}

const canPrev = computed(
  () => !props.min || iso(view.value.year, view.value.month, 1) > props.min,
)
const canNext = computed(() => {
  if (!props.max) return true
  const next = new Date(Date.UTC(view.value.year, view.value.month + 1, 1, 12))
  return iso(next.getUTCFullYear(), next.getUTCMonth(), 1) <= props.max
})

async function moveFocus(day: string) {
  const target = clamp(day)
  focused.value = target
  const [y, m] = parts(target)
  if (y !== view.value.year || m !== view.value.month)
    view.value = { year: y, month: m }
  await nextTick()
  grid.value
    ?.querySelector<HTMLButtonElement>(`[data-day="${target}"]`)
    ?.focus()
}

function onKey(event: KeyboardEvent) {
  const moves: Record<string, number> = {
    ArrowLeft: -1,
    ArrowRight: 1,
    ArrowUp: -7,
    ArrowDown: 7,
  }
  if (event.key in moves) {
    event.preventDefault()
    void moveFocus(shift(focused.value, moves[event.key]!))
  } else if (event.key === 'PageUp' || event.key === 'PageDown') {
    event.preventDefault()
    const [y, m, d] = parts(focused.value)
    const date = new Date(
      Date.UTC(y, m + (event.key === 'PageUp' ? -1 : 1), 1, 12),
    )
    const last = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 12),
    ).getUTCDate()
    void moveFocus(
      iso(date.getUTCFullYear(), date.getUTCMonth(), Math.min(d, last)),
    )
  } else if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault()
    const [y, m, d] = parts(focused.value)
    const weekday = (new Date(Date.UTC(y, m, d, 12)).getUTCDay() + 6) % 7
    void moveFocus(
      shift(focused.value, event.key === 'Home' ? -weekday : 6 - weekday),
    )
  }
}

/** Lleva el foco al día elegido (o a hoy) al abrir el calendario. */
function focusDay() {
  void moveFocus(focused.value)
}

defineExpose({ focusDay })
</script>

<template>
  <div class="cal" :aria-label="label" role="group">
    <div class="cal__head">
      <button
        type="button"
        class="cal__nav"
        aria-label="Mes anterior"
        :disabled="!canPrev"
        @click="goMonth(-1)"
      >
        ‹
      </button>
      <div class="cal__title">
        <label class="visually-hidden" :for="`${uid}-mes`">Mes</label>
        <select
          :id="`${uid}-mes`"
          v-model.number="view.month"
          class="cal__select"
        >
          <option v-for="(name, index) in MONTHS" :key="name" :value="index">
            {{ name }}
          </option>
        </select>
        <label class="visually-hidden" :for="`${uid}-anio`">Año</label>
        <select
          :id="`${uid}-anio`"
          v-model.number="view.year"
          class="cal__select"
        >
          <option v-for="year in years" :key="year" :value="year">
            {{ year }}
          </option>
        </select>
      </div>
      <button
        type="button"
        class="cal__nav"
        aria-label="Mes siguiente"
        :disabled="!canNext"
        @click="goMonth(1)"
      >
        ›
      </button>
    </div>

    <div ref="grid" class="cal__grid" @keydown="onKey">
      <span
        v-for="(weekday, index) in WEEKDAYS"
        :key="index"
        class="cal__weekday"
        aria-hidden="true"
        >{{ weekday }}</span
      >
      <template v-for="(week, w) in weeks" :key="w">
        <template v-for="(day, d) in week" :key="`${w}-${d}`">
          <span v-if="!day" class="cal__empty" aria-hidden="true" />
          <button
            v-else
            type="button"
            class="cal__day"
            :class="{
              'is-selected': selected(day),
              'is-between': inRange(day),
              'is-today': day === today,
              'is-marked': marked.has(day),
            }"
            :data-day="day"
            :tabindex="day === focused ? 0 : -1"
            :disabled="disabled(day)"
            :aria-pressed="selected(day)"
            :aria-current="day === today ? 'date' : undefined"
            :aria-label="dayLabel(day)"
            @click="choose(day)"
          >
            {{ Number(day.slice(8)) }}
          </button>
        </template>
      </template>
    </div>
  </div>
</template>

<style scoped>
.cal {
  display: grid;
  gap: var(--space-2);
  width: 17.5rem;
  max-width: 100%;
}

.cal__head {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.cal__title {
  flex: 1;
  display: flex;
  justify-content: center;
  gap: var(--space-1);
}

.cal__select {
  min-height: 2rem;
  padding: 0 var(--space-2);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-heading);
  font: inherit;
  font-weight: 600;
  text-transform: capitalize;
  cursor: pointer;
}

.cal__select:hover,
.cal__select:focus-visible {
  border-color: var(--color-border-strong);
}

.cal__nav {
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-heading);
  font-size: var(--text-lg);
  cursor: pointer;
}

.cal__nav:hover:not(:disabled) {
  background: var(--color-surface-sunken, #f3f1ec);
}

.cal__nav:disabled {
  opacity: 0.3;
  cursor: default;
}

.cal__grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.cal__weekday {
  padding: var(--space-1) 0;
  color: var(--color-text-subtle);
  font-size: var(--text-xs);
  font-weight: 600;
  text-align: center;
}

.cal__day {
  position: relative;
  height: 2.25rem;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text);
  font: inherit;
  font-size: var(--text-sm);
  font-variant-numeric: tabular-nums;
  cursor: pointer;
}

.cal__day:hover:not(:disabled) {
  background: var(--rosa-100);
}

.cal__day.is-today {
  box-shadow: inset 0 0 0 1px var(--aspar-guindo);
}

.cal__day.is-between {
  border-radius: 0;
  background: var(--rosa-100);
}

.cal__day.is-selected {
  background: var(--aspar-guindo);
  color: #fff;
  font-weight: 700;
}

.cal__day.is-marked::after {
  content: '';
  position: absolute;
  bottom: 4px;
  left: 50%;
  width: 4px;
  height: 4px;
  margin-left: -2px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.6;
}

.cal__day:disabled {
  color: var(--color-text-subtle);
  opacity: 0.4;
  cursor: not-allowed;
}

.cal__day:focus-visible {
  outline: 2px solid var(--aspar-verde);
  outline-offset: 1px;
}
</style>
