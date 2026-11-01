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

/** Estadios de Hoehn y Yahr que acepta la API. */
export const PARKINSON_STAGES = [
  'Estadio I (Leve unilateral)',
  'Estadio II (Bilateral sin alteración del equilibrio)',
  'Estadio III (Moderado con inestabilidad postural)',
  'Estadio IV (Incapacidad grave pero camina con ayuda)',
  'Estadio V (Dependencia completa)',
  'Otro trastorno del movimiento',
] as const

export const EVALUATION_AREAS = {
  fisica: 'Física',
  fonoaudiologica: 'Fonoaudiológica',
  psicologica: 'Psicológica',
} as const

export const DOCUMENT_TYPES = [
  'CI',
  'Certificado neurológico',
  'Evaluación clínica',
  'Consentimiento informado',
  'Otro',
] as const

/** Lo que muestra la ficha para cada tipo («CI» es la copia del carnet). */
export function documentTypeLabel(type: string): string {
  return type === 'CI' ? 'Copia de carnet' : type
}

export const DOCUMENT_ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp'
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024

export function documentFileError(file: File | null): string | null {
  if (!file) return 'Elige el archivo que quieres subir.'
  if (!DOCUMENT_ACCEPT.split(',').includes(file.type))
    return 'Solo se aceptan archivos PDF, JPG, PNG o WEBP.'
  if (file.size === 0) return 'El archivo está vacío.'
  if (file.size > DOCUMENT_MAX_BYTES)
    return 'El archivo supera el máximo de 10 MB.'
  return null
}

/** «245 KB», «1,2 MB» */
export function fileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toLocaleString('es-BO', { maximumFractionDigits: 1 })} MB`
}

/** Motivo de una baja o una reactivación (la API pide de 3 a 300 letras). */
export function reasonError(value: string): string | null {
  const reason = value.trim()
  if (reason.length < 3) return 'Escribe el motivo (al menos 3 letras).'
  if (reason.length > 300) return 'El motivo no puede superar 300 letras.'
  return null
}

/**
 * Por qué no se ve la historia clínica (RNF-06), igual que la API: primero el permiso
 * del rol y después el consentimiento y el estado del acceso. null si se puede ver.
 */
export function clinicalNotice(
  patient: { consent: boolean; accessStatus: string; clinicalAccess: boolean },
  canReadClinical: boolean,
): string | null {
  if (patient.clinicalAccess) return null
  if (!canReadClinical)
    return 'Solo el personal clínico ve la historia clínica, las evaluaciones y los documentos. Tu rol ve los datos que necesita para acompañar a la persona.'
  if (!patient.consent)
    return 'Falta el consentimiento informado firmado. Mientras tanto, nadie ve su historia clínica, sus evaluaciones ni sus documentos.'
  if (patient.accessStatus === 'Revocado')
    return 'La familia suspendió el acceso a la historia clínica. Mientras siga así, nadie la ve; la información se conserva.'
  return 'El consentimiento está firmado, pero el acceso a la historia clínica todavía no está habilitado. Habilítalo en «Consentimiento informado».'
}
