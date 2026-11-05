/**
 * Operación de la sede (diseño págs. 3, 10, 11 y 12): actividades, asistencia e
 * inventario. Fechas en hora de La Paz, etiquetas y textos que se repiten en las tres
 * pantallas.
 */
import type { AttendanceStatus, ItemOut, ScheduleOut } from '../api/types'
import { BOLIVIA_TIME_ZONE, todayIso } from './format'

export type ScheduleStatus = ScheduleOut['status']
export type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'info'

export const SCHEDULE_STATUS_LABELS: Record<ScheduleStatus, string> = {
  publicada: 'Publicada',
  borrador: 'Borrador',
  cancelada: 'Cancelada',
}

export const SCHEDULE_STATUS_TONES: Record<ScheduleStatus, Tone> = {
  publicada: 'success',
  borrador: 'warning',
  cancelada: 'neutral',
}

export const CONDITION_TONES: Record<string, Tone> = {
  nuevo: 'info',
  bueno: 'success',
  regular: 'warning',
  dañado: 'danger',
}

const monthTitleFormat = new Intl.DateTimeFormat('es-BO', {
  month: 'long',
  year: 'numeric',
  timeZone: BOLIVIA_TIME_ZONE,
})
const dayFormat = new Intl.DateTimeFormat('es-BO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: BOLIVIA_TIME_ZONE,
})
const shortMonthFormat = new Intl.DateTimeFormat('es-BO', {
  month: 'short',
  timeZone: BOLIVIA_TIME_ZONE,
})

const DAY = 86_400_000

/** «2026-11» del mes que contiene la fecha ISO «2026-11-04». */
export function monthOf(isoDay: string): string {
  return isoDay.slice(0, 7)
}

/** «2026-11» → «noviembre 2026» */
export function monthTitle(month: string): string {
  const [year, number] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year!, number! - 1, 15, 12))
  return capitalize(monthTitleFormat.format(date))
}

/** «2026-11» → «2026-11-01» y «2026-11-30» (primer y último día del mes). */
export function monthBounds(month: string): { from: string; to: string } {
  const [year, number] = month.split('-').map(Number)
  const last = new Date(Date.UTC(year!, number!, 0, 12)).getUTCDate()
  return {
    from: `${month}-01`,
    to: `${month}-${String(last).padStart(2, '0')}`,
  }
}

/** Mes siguiente o anterior de «2026-11». */
export function shiftMonth(month: string, by: number): string {
  const [year, number] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year!, number! - 1 + by, 1, 12))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

/** «2026-11-07» → «Sábado 7 de noviembre» */
export function dayLabel(isoDay: string): string {
  return capitalize(dayFormat.format(toNoon(isoDay)))
}

/** «2026-11-07» → «7 nov» (en la cabecera de la lista) */
export function shortDayLabel(isoDay: string): string {
  return `${Number(isoDay.slice(8, 10))} ${shortMonthFormat
    .format(toNoon(isoDay))
    .replace('.', '')}`
}

/** «Sáb» de una fecha ISO */
export function weekdayShort(isoDay: string): string {
  return new Intl.DateTimeFormat('es-BO', {
    weekday: 'short',
    timeZone: BOLIVIA_TIME_ZONE,
  })
    .format(toNoon(isoDay))
    .replace('.', '')
}

/** Día de la semana (0 = domingo) en La Paz. */
export function weekdayIndex(isoDay: string): number {
  return toNoon(isoDay).getUTCDay()
}

/** Días de un mes como «2026-11-01»…; los vacíos al inicio se completan con null. */
export function calendarDays(month: string): (string | null)[] {
  const { from, to } = monthBounds(month)
  const days: (string | null)[] = []
  const lead = (weekdayIndex(from) + 6) % 7 // la semana empieza el lunes
  for (let i = 0; i < lead; i++) days.push(null)
  for (let day = Number(from.slice(8)); day <= Number(to.slice(8)); day++)
    days.push(`${month}-${String(day).padStart(2, '0')}`)
  return days
}

/** Hora «10:00» desde «10:00:00» */
export function clock(time: string): string {
  return time.slice(0, 5)
}

/** «10:00 – 11:30» */
export function timeRange(start: string, end: string): string {
  return `${clock(start)} – ${clock(end)}`
}

/** Hoy en La Paz, como ISO «2026-11-04». */
export function today(): string {
  return todayIso()
}

export function isPast(isoDay: string): boolean {
  return isoDay < today()
}

/** Una fecha ISO relativa a hoy (en días). */
export function daysFromToday(offset: number): string {
  const date = new Date(Date.now() + offset * DAY)
  return todayIso(date)
}

/** «Sábado 25 de octubre · 10:00 – 11:30 · Sede ASPAR» */
export function activityLine(item: ScheduleOut): string {
  return `${dayLabel(item.date)} · ${timeRange(item.startTime, item.endTime)} · ${item.location}`
}

/** Etiqueta corta de cada estado de asistencia. */
export function attendanceLabel(status: AttendanceStatus): string {
  return {
    vino: 'Vino',
    no_vino: 'No vino',
    sin_marcar: 'Sin marcar',
  }[status]
}

/** Cupos del diseño: «27 de 30 cupos» o «Sin cupos definidos». */
export function spotsLabel(item: Pick<ScheduleOut, 'spots' | 'interested'>) {
  if (item.spots === null) return 'Sin cupos definidos'
  return `${item.interested} de ${item.spots} cupos`
}

/** «Fisioterapia · Sede ASPAR» */
export function itemLine(item: Pick<ItemOut, 'categoryLabel' | 'location'>) {
  return item.location
    ? `${item.categoryLabel} · ${item.location}`
    : item.categoryLabel
}

function toNoon(isoDay: string): Date {
  return new Date(`${isoDay}T12:00:00-04:00`)
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
