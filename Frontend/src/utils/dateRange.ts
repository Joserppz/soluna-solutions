/**
 * Rango de fechas de los filtros (evaluación de los Sprints 1 y 2): «desde» y «hasta»,
 * los dos días incluidos, en hora de La Paz. Va a la API como `from` y `to`, y a la
 * dirección como `desde` y `hasta` para que recargar o volver atrás no lo pierda.
 */
import type { LocationQuery } from 'vue-router'

import { todayIso } from './format'

export interface DateRangeValue {
  /** «2026-11-01» o '' (sin límite) */
  from: string
  to: string
}

export const ALL_DATES: DateRangeValue = { from: '', to: '' }

export type PresetKey =
  'hoy' | 'ultimos-7' | 'ultimos-30' | 'este-mes' | 'mes-pasado' | 'este-anio'

export const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'hoy', label: 'Hoy' },
  { key: 'ultimos-7', label: 'Últimos 7 días' },
  { key: 'ultimos-30', label: 'Últimos 30 días' },
  { key: 'este-mes', label: 'Este mes' },
  { key: 'mes-pasado', label: 'Mes pasado' },
  { key: 'este-anio', label: 'Este año' },
]

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

/** «2026-11-26» → Date a mediodía (sin sorpresas de zona horaria al sumar días). */
function noon(iso: string): Date {
  return new Date(`${iso}T12:00:00`)
}

function iso(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function addDays(day: string, days: number): string {
  const date = noon(day)
  date.setDate(date.getDate() + days)
  return iso(date)
}

/** El rango de un atajo, contado desde hoy en La Paz. */
export function presetRange(
  key: PresetKey,
  today: string = todayIso(),
): DateRangeValue {
  const year = today.slice(0, 4)
  const firstOfMonth = `${today.slice(0, 7)}-01`
  switch (key) {
    case 'hoy':
      return { from: today, to: today }
    case 'ultimos-7':
      return { from: addDays(today, -6), to: today }
    case 'ultimos-30':
      return { from: addDays(today, -29), to: today }
    case 'este-mes':
      return { from: firstOfMonth, to: today }
    case 'mes-pasado': {
      const last = addDays(firstOfMonth, -1)
      return { from: `${last.slice(0, 7)}-01`, to: last }
    }
    case 'este-anio':
      return { from: `${year}-01-01`, to: today }
    default:
      return { from: firstOfMonth, to: today }
  }
}

/** El atajo que corresponde a un rango, si hay uno. */
export function presetOf(
  range: DateRangeValue,
  today: string = todayIso(),
): PresetKey | null {
  return (
    PRESETS.find(({ key }) => sameRange(presetRange(key, today), range))?.key ??
    null
  )
}

export function sameRange(a: DateRangeValue, b: DateRangeValue): boolean {
  return a.from === b.from && a.to === b.to
}

export function isActive(range: DateRangeValue): boolean {
  return Boolean(range.from || range.to)
}

/** Mensaje si el rango no sirve (o null). */
export function rangeError(range: DateRangeValue): string | null {
  if (range.from && !ISO_DAY.test(range.from)) return 'Revisa la fecha «desde».'
  if (range.to && !ISO_DAY.test(range.to)) return 'Revisa la fecha «hasta».'
  if (range.from && range.to && range.from > range.to)
    return 'La fecha «desde» no puede ser posterior a la fecha «hasta».'
  return null
}

const dayFormat = new Intl.DateTimeFormat('es-BO', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

function short(day: string): string {
  return dayFormat.format(noon(day)).replace('.', '')
}

/** «Todas las fechas», «Este mes», «1 nov 2026 – 15 nov 2026», «Desde 1 nov 2026». */
export function periodLabel(
  range: DateRangeValue,
  today: string = todayIso(),
): string {
  if (!isActive(range)) return 'Todas las fechas'
  const preset = presetOf(range, today)
  if (preset) return PRESETS.find((p) => p.key === preset)!.label
  if (range.from && range.to)
    return range.from === range.to
      ? short(range.from)
      : `${short(range.from)} – ${short(range.to)}`
  return range.from ? `Desde ${short(range.from)}` : `Hasta ${short(range.to)}`
}

/** Lo que va a la API: `from` y `to` solo si tienen valor. */
export function rangeQuery(range: DateRangeValue): {
  from?: string
  to?: string
} {
  return {
    ...(range.from ? { from: range.from } : {}),
    ...(range.to ? { to: range.to } : {}),
  }
}

function text(query: LocationQuery, key: string): string {
  const value = query[key]
  return typeof value === 'string' && ISO_DAY.test(value) ? value : ''
}

/** El rango guardado en la dirección (`?desde=…&hasta=…`). */
export function readRange(
  query: LocationQuery,
  fallback: DateRangeValue = ALL_DATES,
): DateRangeValue {
  const range = { from: text(query, 'desde'), to: text(query, 'hasta') }
  if (!isActive(range)) return { ...fallback }
  return rangeError(range) ? { ...fallback } : range
}

/** Agrega el rango a la dirección de la pantalla. */
export function writeRange(
  range: DateRangeValue,
  query: Record<string, string>,
): Record<string, string> {
  if (range.from) query.desde = range.from
  if (range.to) query.hasta = range.to
  return query
}
