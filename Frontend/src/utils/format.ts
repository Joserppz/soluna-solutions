/** Fechas, saludos y nombres con el formato que usa ASPAR (hora de Bolivia). */

export const BOLIVIA_TIME_ZONE = 'America/La_Paz'

const longDateFormat = new Intl.DateTimeFormat('es-BO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: BOLIVIA_TIME_ZONE,
})

const hourFormat = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  hourCycle: 'h23',
  timeZone: BOLIVIA_TIME_ZONE,
})

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** «Martes, 28 de octubre» */
export function longDate(date: Date = new Date()): string {
  return capitalize(longDateFormat.format(date))
}

/** Saludo según la hora en La Paz. */
export function greeting(date: Date = new Date()): string {
  const hour = Number(hourFormat.format(date))
  if (hour >= 5 && hour < 12) return 'Buenos días'
  if (hour >= 12 && hour < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

const TITLES = new Set(['lic.', 'dr.', 'dra.', 'ing.', 'prof.', 'sr.', 'sra.'])

function significantWords(fullName: string): string[] {
  return (
    fullName
      .trim()
      .split(/\s+/)
      // Sin títulos («Lic.») ni agregados entre paréntesis («(demo)»)
      .filter((word) => /^\p{L}/u.test(word) && !TITLES.has(word.toLowerCase()))
  )
}

/** «Lic. Ana Flores» → «Ana» */
export function firstName(fullName: string): string {
  return significantWords(fullName)[0] ?? fullName.trim()
}

/** «Lucía Choque» → «LC» */
export function initials(fullName: string): string {
  const words = significantWords(fullName)
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : words
  return letters
    .map((word) => word!.charAt(0).toUpperCase())
    .join('')
    .slice(0, 2)
}

const isoDayFormat = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: BOLIVIA_TIME_ZONE,
})

/** Fecha de hoy en La Paz como «2026-10-28» (valor de un <input type="date">). */
export function todayIso(date: Date = new Date()): string {
  return isoDayFormat.format(date)
}

const monthYearFormat = new Intl.DateTimeFormat('es-BO', {
  month: 'long',
  year: 'numeric',
  timeZone: BOLIVIA_TIME_ZONE,
})

/** «2024-03-18T14:00:00Z» → «marzo 2024» */
export function monthYear(value: string | Date): string {
  const parts = monthYearFormat.formatToParts(new Date(value))
  const part = (type: string) => parts.find((p) => p.type === type)?.value
  return `${part('month')} ${part('year')}`
}
