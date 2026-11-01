/**
 * Reglas y formatos de las fichas de afiliados. Las validaciones repiten las de la API
 * (patients/service.py) para avisar mientras se escribe; la API vuelve a validar todo.
 */
import { monthYear } from './format'

const CI_PATTERN = /^\d{5,10}(-[0-9A-Za-z]{1,3})?$/
const PHONE_PATTERN = /^\d{7,12}$/
const NARROW_SPACE = '\u202f'

/** Respuesta 409 al registrar o editar: el carnet ya pertenece a otra ficha. */
export const DUPLICATE_CI_MESSAGE =
  'El carnet no se puede repetir. Búscalo antes de registrar a alguien nuevo.'

/** Toda ficha necesita al menos un contacto y admite hasta cinco. */
export const MAX_CONTACTS = 5

export const RELATIONS = [
  'Hija',
  'Hijo',
  'Esposa',
  'Esposo',
  'Pareja',
  'Hermana',
  'Hermano',
  'Nieta',
  'Nieto',
  'Madre',
  'Padre',
  'Sobrina',
  'Sobrino',
  'Cuidadora',
  'Cuidador',
  'Amiga',
  'Amigo',
  'Otra persona',
] as const

/** «4.821.557» o «4 821 557» → «4821557»; el complemento («-1B») se conserva. */
export function cleanCi(value: string): string {
  return value.trim().replace(/[\s.\u202f]/g, '')
}

/** «7012 3344» o «7012-3344» → «70123344» */
export function cleanPhone(value: string): string {
  return value.trim().replace(/[\s.\-\u202f]/g, '')
}

export function personNameError(value: string): string | null {
  return value.trim().length < 3
    ? 'Escribe el nombre completo (al menos 3 letras).'
    : null
}

export function ciError(value: string): string | null {
  const ci = cleanCi(value)
  if (!ci) return 'Escribe el número de carnet.'
  if (!CI_PATTERN.test(ci))
    return 'El carnet lleva de 5 a 10 números; el complemento va después de un guion (4821557-1B).'
  return null
}

export function phoneError(value: string): string | null {
  const phone = cleanPhone(value)
  if (!phone) return 'Escribe un número de teléfono.'
  if (!PHONE_PATTERN.test(phone))
    return 'El teléfono lleva de 7 a 12 números, sin letras.'
  return null
}

/** Las fechas de nacimiento y de firma no pueden estar en el futuro. */
export function pastDateError(value: string, today: string): string | null {
  return value && value > today
    ? 'La fecha no puede ser posterior a hoy.'
    : null
}

/** «4821557-1B» → «4 821 557-1B», más fácil de leer y dictar. */
export function formatCi(ci: string): string {
  const [digits = '', ...rest] = ci.split('-')
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, NARROW_SPACE)
  return [grouped, ...rest].join('-')
}

/** Un carnet copiado con espacios o puntos se busca solo con sus números. */
export function normalizeSearch(text: string): string {
  const value = text.trim().replace(/\s+/g, ' ')
  return /^[\d\s.\u202f-]+$/.test(value) ? cleanCi(value) : value
}

/** «Desde marzo 2024» */
export function sinceLabel(createdAt: string): string {
  return `Desde ${monthYear(createdAt)}`
}

/** Edad cumplida en una fecha («today» en formato 2026-10-28). */
export function ageOn(birthDate: string, today: string): number {
  const [by, bm, bd] = birthDate.split('-').map(Number) as [
    number,
    number,
    number,
  ]
  const [ty, tm, td] = today.split('-').map(Number) as [number, number, number]
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0)
}

/** «Fisioterapia, Arteterapia y 2 más» */
export function activitiesLabel(labels: string[], shown = 2): string {
  if (labels.length <= shown) return labels.join(', ')
  return `${labels.slice(0, shown).join(', ')} y ${labels.length - shown} más`
}
