/**
 * Bandeja de solicitudes (diseño pág. 17): pestañas, el seguimiento de cada solicitud
 * (Recibida → Por contactar → Contactada → Inscrita) y los enlaces para llamar o
 * escribir por WhatsApp.
 */
import type { InquiryOut, InquirySummary } from '../api/types'
import { BOLIVIA_TIME_ZONE, todayIso } from './format'
import type { Tone } from './ops'

export type InquiryStatus = InquiryOut['status']
export type InquiryKind = InquiryOut['kind']
export type InquiryTab = 'todas' | 'recibida' | 'contactada' | 'inscrita'

export const INQUIRY_TABS: {
  key: InquiryTab
  label: string
  count: (summary: InquirySummary) => number
}[] = [
  { key: 'todas', label: 'Todas', count: (s) => s.total },
  { key: 'recibida', label: 'Nuevas', count: (s) => s.recibida },
  { key: 'contactada', label: 'Contactadas', count: (s) => s.contactada },
  { key: 'inscrita', label: 'Inscritas', count: (s) => s.inscrita },
]

export const INQUIRY_KINDS: { value: InquiryKind; label: string }[] = [
  { value: 'orientacion', label: 'Orientación para participar' },
  { value: 'participar', label: 'Quiere participar en una actividad' },
  { value: 'voluntariado', label: 'Quiere ser voluntario/a' },
  { value: 'especie', label: 'Ofrece una donación en especie' },
  { value: 'asistencia', label: 'Llegó a una actividad por primera vez' },
  { value: 'otro', label: 'Otro motivo' },
]

export const STATUS_LABELS: Record<InquiryStatus, string> = {
  recibida: 'Nueva',
  por_contactar: 'Por contactar',
  contactada: 'Contactada',
  inscrita: 'Inscrita',
  cerrada: 'Cerrada',
}

export const STATUS_TONES: Record<InquiryStatus, Tone> = {
  recibida: 'danger',
  por_contactar: 'warning',
  contactada: 'warning',
  inscrita: 'success',
  cerrada: 'neutral',
}

/** Los pasos de la barra de seguimiento, en orden. */
export const FOLLOW_UP: { status: InquiryStatus; label: string }[] = [
  { status: 'recibida', label: 'Recibida' },
  { status: 'por_contactar', label: 'Por contactar' },
  { status: 'contactada', label: 'Contactada' },
  { status: 'inscrita', label: 'Inscrita' },
]

/** Los mismos cambios que acepta la API (TRANSITIONS en inquiries/models.py). */
export const TRANSITIONS: Record<InquiryStatus, InquiryStatus[]> = {
  recibida: ['por_contactar', 'contactada', 'cerrada'],
  por_contactar: ['contactada', 'cerrada'],
  contactada: ['por_contactar', 'cerrada'],
  inscrita: [],
  cerrada: ['recibida'],
}

export type StepState = 'done' | 'now' | 'todo'

/** Cada paso de la barra: hecho, el actual o pendiente. */
export function followUpSteps(status: InquiryStatus): StepState[] {
  const index = FOLLOW_UP.findIndex((step) => step.status === status)
  return FOLLOW_UP.map((_, i) =>
    index < 0 ? 'todo' : i < index ? 'done' : i === index ? 'now' : 'todo',
  )
}

export function canMove(from: InquiryStatus, to: InquiryStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

/** «Orientación para participar · por su esposo, Julio» */
export function inquiryLine(item: InquiryOut): string {
  const parts = [item.kindLabel]
  if (item.scheduleTitle) parts.push(item.scheduleTitle)
  if (item.onBehalfOf) parts.push(`por ${item.onBehalfOf}`)
  return parts.join(' · ')
}

/** Solo dígitos; los números bolivianos de 8 dígitos llevan el 591 para WhatsApp. */
export function whatsappUrl(phone: string, text = ''): string {
  const digits = phone.replace(/\D/g, '')
  const number = digits.length === 8 ? `591${digits}` : digits
  const query = text ? `?text=${encodeURIComponent(text)}` : ''
  return `https://wa.me/${number}${query}`
}

export function telUrl(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`
}

/** «7154 8214» para leerlo mejor; si no son 8 dígitos, queda como está. */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.length === 8
    ? `${digits.slice(0, 4)} ${digits.slice(4)}`
    : phone
}

const timeFormat = new Intl.DateTimeFormat('es-BO', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: BOLIVIA_TIME_ZONE,
})
const dayFormat = new Intl.DateTimeFormat('es-BO', {
  day: 'numeric',
  month: 'short',
  timeZone: BOLIVIA_TIME_ZONE,
})

/** En la lista: «hace 5 min», «hace 2 h», «ayer» o «26 oct». */
export function receivedAgo(value: string, now: Date = new Date()): string {
  const minutes = Math.floor(
    (now.getTime() - new Date(value).getTime()) / 60000,
  )
  const day = todayIso(new Date(value))
  if (day === todayIso(now)) {
    if (minutes < 1) return 'recién'
    if (minutes < 60) return `hace ${minutes} min`
    return `hace ${Math.floor(minutes / 60)} h`
  }
  if (day === todayIso(new Date(now.getTime() - 86_400_000))) return 'ayer'
  return dayFormat.format(new Date(value)).replace('.', '')
}

/** En el historial: «Hoy, 08:47», «Ayer, 18:20» o «26 oct, 09:58». */
export function historyTime(value: string, now: Date = new Date()): string {
  const day = todayIso(new Date(value))
  const time = timeFormat.format(new Date(value))
  if (day === todayIso(now)) return `Hoy, ${time}`
  if (day === todayIso(new Date(now.getTime() - 86_400_000)))
    return `Ayer, ${time}`
  return `${dayFormat.format(new Date(value)).replace('.', '')}, ${time}`
}

export const SOURCE_LABELS: Record<InquiryOut['source'], string> = {
  sitio: 'Desde el sitio',
  asistencia: 'Anotada en la asistencia',
  sede: 'En la sede',
}
