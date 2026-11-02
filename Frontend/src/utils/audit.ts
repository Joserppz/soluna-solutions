/**
 * Registro de actividad (diseño pág. 19): áreas, días, encabezados por fecha (hora de
 * La Paz) y los textos de las situaciones para revisar.
 */
import type { AuditArea, AuditEvent, AuditSummary } from '../api/types'
import { BOLIVIA_TIME_ZONE, todayIso } from './format'

/** Las áreas de la API, en el orden del filtro. */
export const AUDIT_AREAS: { key: AuditArea; label: string }[] = [
  { key: 'afiliados', label: 'Afiliados' },
  { key: 'accesos', label: 'Accesos' },
  { key: 'donaciones', label: 'Donaciones' },
  { key: 'solicitudes', label: 'Solicitudes' },
  { key: 'equipo', label: 'Equipo' },
  { key: 'actividades', label: 'Actividades y asistencia' },
  { key: 'inventario', label: 'Inventario' },
  { key: 'sitio', label: 'Galería y contenido' },
]

/** Las del resumen semanal del diseño; el resto se suma en «Otras áreas». */
export const SUMMARY_AREAS: AuditArea[] = [
  'afiliados',
  'accesos',
  'donaciones',
  'solicitudes',
  'equipo',
]

export const DAY_OPTIONS = [
  { days: 7, label: 'Últimos 7 días' },
  { days: 30, label: 'Últimos 30 días' },
  { days: 90, label: 'Últimos 90 días' },
  { days: 365, label: 'Último año' },
]

const dayFormat = new Intl.DateTimeFormat('es-BO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: BOLIVIA_TIME_ZONE,
})
const dayWithYearFormat = new Intl.DateTimeFormat('es-BO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: BOLIVIA_TIME_ZONE,
})
const timeFormat = new Intl.DateTimeFormat('es-BO', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: BOLIVIA_TIME_ZONE,
})

/** «2026-10-28»: el día en La Paz, para agrupar. */
export function dayKey(value: string): string {
  return todayIso(new Date(value))
}

/** «Hoy, martes 28 de octubre», «Ayer, lunes 27 de octubre» o «Viernes 24 de octubre». */
export function dayHeading(value: string, now: Date = new Date()): string {
  const date = new Date(value)
  const day = todayIso(date)
  const sameYear = day.slice(0, 4) === todayIso(now).slice(0, 4)
  const text = (sameYear ? dayFormat : dayWithYearFormat)
    .format(date)
    .replace(',', '')
  if (day === todayIso(now)) return `Hoy, ${text}`
  if (day === todayIso(new Date(now.getTime() - 86_400_000)))
    return `Ayer, ${text}`
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** «08:55» */
export function timeOfDay(value: string): string {
  return timeFormat.format(new Date(value))
}

const UUID =
  /\s*\(?\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b\)?/gi

/** El detalle sin los identificadores internos, que no le dicen nada a una persona. */
export function readableDetail(detail: string): string {
  return detail
    .replace(UUID, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** Quién lo hizo: su nombre, o el correo con que se intentó (si no es del equipo). */
export function actorLabel(event: Pick<AuditEvent, 'actor' | 'actorName'>) {
  return event.actorName ?? event.actor
}

export interface DayGroup {
  key: string
  heading: string
  events: AuditEvent[]
}

/** Eventos agrupados por día (en el orden en que llegan: el más reciente primero). */
export function groupByDay(
  events: AuditEvent[],
  now: Date = new Date(),
): DayGroup[] {
  const groups: DayGroup[] = []
  for (const event of events) {
    const key = dayKey(event.date)
    let group = groups[groups.length - 1]
    if (!group || group.key !== key) {
      group = { key, heading: dayHeading(event.date, now), events: [] }
      groups.push(group)
    }
    group.events.push(event)
  }
  return groups
}

function count(n: number, one: string, many: string): string {
  if (n === 1) return one
  return `${n} ${many}`
}

/** «Un intento de acceso bloqueado y un aporte anulado.» */
export function reviewSentence(review: AuditSummary['review']): string {
  const parts: string[] = []
  if (review.blockedAccess)
    parts.push(
      count(
        review.blockedAccess,
        'Un intento de acceso bloqueado',
        'intentos de acceso bloqueados',
      ),
    )
  if (review.cancelledDonations)
    parts.push(
      count(review.cancelledDonations, 'un aporte anulado', 'aportes anulados'),
    )
  const sentence = parts.join(' y ')
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`
}
