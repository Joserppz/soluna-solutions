/**
 * Sitio público (diseño págs. 2 a 5): lo que se publica desde «Contenido del sitio»,
 * con un texto de respaldo cuando una sección todavía no se publicó; la agenda, el
 * formulario de contacto y el aporte por QR bancario. Todo el contenido es texto plano.
 */
import type {
  DonationTracking,
  PublicInquiryIn,
  PublicSchedule,
  PublicSection,
} from '../api/types'
import type { Tone } from './ops'

export type SiteContent = Record<string, Record<string, unknown>>

/** Las secciones publicadas, por clave («mision_vision» → su contenido). */
export function contentByKey(sections: PublicSection[]): SiteContent {
  return Object.fromEntries(
    sections.map((section) => [section.key, section.content ?? {}]),
  )
}

/** Un texto publicado, o el de respaldo si la sección o el campo están vacíos. */
export function text(
  content: SiteContent,
  key: string,
  field: string,
  fallback = '',
): string {
  const value = content[key]?.[field]
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

/** Lo que se muestra mientras ASPAR no publique su propio texto. */
export const SITE_DEFAULTS = {
  heroTitle: 'La vida se vive mejor en comunidad.',
  heroLead:
    'Un espacio de encuentro para personas con Parkinson y trastornos del movimiento, sus familias y quienes las cuidan. Compartir, movernos y aprender, a nuestro ritmo y sin caminar a solas.',
  aboutTitle: 'Acompañar también es hacer lugar.',
  aboutLead:
    'En ASPAR, el encuentro es el punto de partida. Queremos que cada persona y su familia encuentren escucha, participación y una red cercana, cada sábado.',
  mission:
    'Acompañar a personas con Parkinson y trastornos del movimiento, fortaleciendo su bienestar y sus vínculos a través de actividades comunitarias.',
  vision:
    'Una comunidad donde vivir con una condición de movimiento no signifique vivir sin apoyo.',
  joinTitle: 'El primer paso es conversar.',
  joinLead:
    'No necesitas una cuenta. Déjanos tus datos y el equipo te orientará para el registro y las actividades.',
  faqTitle: 'Un poco de claridad antes de venir.',
} as const

export interface Step {
  title: string
  text: string
}

/** «Cómo participar» del diseño (pág. 2). */
export const DEFAULT_STEPS: Step[] = [
  {
    title: 'Conversamos',
    text: 'Cuéntanos si buscas apoyo para ti o para una persona de tu familia.',
  },
  {
    title: 'Preparamos tu registro',
    text: 'Copia de carnet y al menos un contacto de un familiar o cuidador.',
  },
  {
    title: 'Revisamos la información',
    text: 'Certificado de un neurólogo o evaluación de síntomas. El equipo te explicará el proceso de forma privada.',
  },
]

/** Los pasos publicados («Conversamos: Cuéntanos…») o los del diseño. */
export function joinSteps(content: SiteContent): Step[] {
  const published = content.como_participar?.pasos
  if (!Array.isArray(published)) return DEFAULT_STEPS
  const steps = published
    .filter((step): step is string => typeof step === 'string' && !!step.trim())
    .map((step) => {
      const [title, ...rest] = step.split(':')
      return rest.length
        ? { title: title!.trim(), text: rest.join(':').trim() }
        : { title: step.trim(), text: '' }
    })
  return steps.length ? steps : DEFAULT_STEPS
}

export interface Question {
  pregunta: string
  respuesta: string
}

/** Preguntas del diseño (pág. 2), mientras no se publiquen las propias. */
export const DEFAULT_QUESTIONS: Question[] = [
  {
    pregunta: '¿Necesito un diagnóstico para preguntar?',
    respuesta:
      'No. Puedes pedir orientación. Para el registro se revisará un diagnóstico de neurólogo o una evaluación de síntomas.',
  },
  {
    pregunta: '¿Puedo ir con un familiar o cuidador?',
    respuesta:
      'Sí. La participación de familiares y personas cuidadoras es parte de nuestra forma de acompañar.',
  },
  {
    pregunta: '¿Tengo que crear una cuenta?',
    respuesta:
      'No. Para pedir orientación o anotarte en una actividad basta con dejarnos tu nombre y tu teléfono.',
  },
  {
    pregunta: '¿Ofrecen consultas médicas o centro de día?',
    respuesta:
      'No. Ofrecemos actividades de apoyo y participación comunitaria, que no reemplazan la atención ni el diagnóstico médico.',
  },
]

export function questions(content: SiteContent): Question[] {
  const published = content.preguntas_frecuentes?.preguntas
  if (!Array.isArray(published)) return DEFAULT_QUESTIONS
  const list = published.filter(
    (item): item is Question =>
      typeof item?.pregunta === 'string' &&
      typeof item?.respuesta === 'string' &&
      !!item.pregunta.trim(),
  )
  return list.length ? list : DEFAULT_QUESTIONS
}

/** «La vida se vive mejor en comunidad.» → la última palabra va en cursiva. */
export function splitTitle(title: string): { start: string; end: string } {
  const trimmed = title.trim()
  const cut = trimmed.lastIndexOf(' ')
  if (cut < 0) return { start: '', end: trimmed }
  return { start: trimmed.slice(0, cut + 1), end: trimmed.slice(cut + 1) }
}

export const AVAILABILITY: Record<string, { label: string; tone: Tone }> = {
  libres: { label: 'Cupos libres', tone: 'success' },
  ultimos: { label: 'Últimos cupos', tone: 'warning' },
  completo: { label: 'Completo', tone: 'neutral' },
}

/** Se puede pedir un lugar: publicada, desde hoy y con cupos. */
export function canJoin(activity: PublicSchedule, today: string): boolean {
  return (
    activity.status === 'publicada' &&
    activity.date >= today &&
    activity.availability !== 'completo'
  )
}

/** El próximo encuentro publicado, desde hoy. */
export function nextActivity(
  activities: PublicSchedule[],
  today: string,
): PublicSchedule | null {
  return (
    [...activities]
      .filter((a) => a.status === 'publicada' && a.date >= today)
      .sort((a, b) =>
        (a.date + a.startTime).localeCompare(b.date + b.startTime),
      )[0] ?? null
  )
}

export type ContactKind = Exclude<PublicInquiryIn['kind'], 'participar'>

export const CONTACT_KINDS: { value: ContactKind; label: string }[] = [
  { value: 'orientacion', label: 'Orientación para participar' },
  { value: 'voluntariado', label: 'Quiero ser voluntario/a' },
  { value: 'especie', label: 'Ofrecer una donación en especie' },
  { value: 'otro', label: 'Otro motivo' },
]

export function isContactKind(value: unknown): value is ContactKind {
  return CONTACT_KINDS.some((kind) => kind.value === value)
}

export interface ContactForm {
  name: string
  phone: string
  message: string
  consent: boolean
}

/** Las mismas reglas que la API, para avisar antes de enviar. */
export function contactErrors(form: ContactForm) {
  const phone = cleanPhone(form.phone)
  return {
    name:
      form.name.trim().length < 3
        ? 'Escribe tu nombre (al menos 3 letras).'
        : null,
    phone: !/^\d{7,12}$/.test(phone)
      ? 'Escribe un teléfono de 7 a 12 dígitos.'
      : null,
    consent: form.consent
      ? null
      : 'Necesitamos tu permiso para llamarte y responderte.',
  }
}

/** Solo los dígitos: «7 012-3456» → «70123456». */
export function cleanPhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

/** Bs. 18.640 */
export function bs(value: number): string {
  return `Bs. ${new Intl.NumberFormat('es-BO', {
    maximumFractionDigits: 2,
  }).format(value)}`
}

export const AMOUNTS = [50, 100, 200] as const

/** Lo que permite cada aporte (diseño pág. 4). */
export const AMOUNT_IMPACT: Record<number, string> = {
  50: 'ayuda a cubrir los materiales de un taller de arteterapia.',
  100: 'podemos comprar una colchoneta nueva para los ejercicios del sábado.',
  200: 'nos acercamos a las barras paralelas para la fisioterapia.',
}

/** «150», «150,50» o «150.50» → 150.5; vacío o inválido → null. */
export function parseAmount(value: string): number | null {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null
  const amount = Number(normalized)
  return amount > 0 && amount <= 100000 ? amount : null
}

/**
 * Enlace para guardar el QR en el teléfono: en Cloudinary se pide como descarga
 * (`fl_attachment`); en otro sitio se abre la imagen para guardarla desde ahí.
 */
export function qrDownloadUrl(url: string): string {
  return url.includes('res.cloudinary.com/') && url.includes('/upload/')
    ? url.replace('/upload/', '/upload/fl_attachment/')
    : url
}

export type TrackStep = 'done' | 'now' | 'todo' | 'cancelled'

/** Recibimos tu aviso → Lo revisamos con el banco → Confirmado (diseño pág. 5). */
export function trackingSteps(
  status: DonationTracking['status'],
): [TrackStep, TrackStep, TrackStep] {
  if (status === 'confirmado' || status === 'recibido')
    return ['done', 'done', 'done']
  if (status === 'anulado') return ['done', 'cancelled', 'todo']
  return ['done', 'now', 'todo']
}

/**
 * Las redes y el correo oficiales de ASPAR. Se muestran mientras «Redes y contacto» no
 * tenga otro valor publicado para ese campo.
 */
export const ASPAR_CONTACT: Record<string, string> = {
  facebook: 'https://www.facebook.com/share/1DKFqHL1TD/',
  tiktok: 'https://www.tiktok.com/@aspar_lapaz_bolivia',
  correo: 'asparlapaz@gmail.com',
}

/** Redes publicadas en «Redes y contacto» (o las oficiales), solo con enlaces https. */
export function socialLinks(content: SiteContent) {
  const networks = [
    { key: 'facebook', label: 'Facebook' },
    { key: 'instagram', label: 'Instagram' },
    { key: 'tiktok', label: 'TikTok' },
  ]
  return networks
    .map((network) => ({
      ...network,
      url: text(
        content,
        'redes_contacto',
        network.key,
        ASPAR_CONTACT[network.key] ?? '',
      ),
    }))
    .filter((network) => network.url.startsWith('https://'))
}

/** WhatsApp, teléfono, correo (o el oficial) y dirección publicados. */
export function contactLines(content: SiteContent) {
  const whatsapp = text(content, 'redes_contacto', 'whatsapp').replace(
    /\D/g,
    '',
  )
  const phone = text(content, 'redes_contacto', 'telefono')
  const email = text(content, 'redes_contacto', 'correo', ASPAR_CONTACT.correo)
  const address = text(content, 'redes_contacto', 'direccion')
  return [
    whatsapp && {
      label: 'WhatsApp',
      value: `+${whatsapp}`,
      href: `https://wa.me/${whatsapp}`,
    },
    phone && {
      label: 'Teléfono',
      value: phone,
      href: `tel:${phone.replace(/\s/g, '')}`,
    },
    email && { label: 'Correo', value: email, href: `mailto:${email}` },
    address && { label: 'Dirección', value: address, href: '' },
  ].filter(Boolean) as { label: string; value: string; href: string }[]
}
