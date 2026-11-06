/**
 * Contenido del sitio (diseño pág. 14): los campos de cada sección, cuándo se editó y
 * qué cambió desde la última publicación (para resaltarlo en la vista previa). Todo es
 * texto plano: el sitio lo muestra escapado.
 */

export type FieldKind = 'text' | 'textarea' | 'url' | 'list' | 'faq'

export interface FieldDef {
  key: string
  label: string
  kind: FieldKind
  max: number
  required?: boolean
  rows?: number
  placeholder?: string
  /** Campo corto: va de a dos por fila. */
  half?: boolean
}

const TITLE: FieldDef = {
  key: 'titulo',
  label: 'Título de la sección',
  kind: 'text',
  max: 150,
  required: true,
}

/** Los campos de cada sección, en el orden en que se muestran. */
export const SECTION_FIELDS: Record<string, FieldDef[]> = {
  presentacion: [
    TITLE,
    {
      key: 'subtitulo',
      label: 'Subtítulo',
      kind: 'textarea',
      max: 300,
      rows: 2,
    },
    { key: 'texto', label: 'Texto', kind: 'textarea', max: 2000, rows: 4 },
  ],
  mision_vision: [
    TITLE,
    {
      key: 'mision',
      label: 'Misión',
      kind: 'textarea',
      max: 1500,
      rows: 3,
      required: true,
    },
    {
      key: 'vision',
      label: 'Visión',
      kind: 'textarea',
      max: 1500,
      rows: 3,
      required: true,
    },
  ],
  historia: [
    TITLE,
    {
      key: 'texto',
      label: 'Nuestra historia',
      kind: 'textarea',
      max: 5000,
      rows: 8,
    },
  ],
  como_participar: [
    TITLE,
    { key: 'texto', label: 'Texto', kind: 'textarea', max: 2000, rows: 3 },
    { key: 'pasos', label: 'Pasos', kind: 'list', max: 6 },
  ],
  preguntas_frecuentes: [
    TITLE,
    { key: 'preguntas', label: 'Preguntas', kind: 'faq', max: 20 },
  ],
  donaciones: [
    TITLE,
    { key: 'texto', label: 'Texto', kind: 'textarea', max: 1000, rows: 3 },
    { key: 'titular', label: 'Titular de la cuenta', kind: 'text', max: 150 },
    { key: 'banco', label: 'Banco', kind: 'text', max: 80, half: true },
    {
      key: 'cuenta',
      label: 'Número de cuenta',
      kind: 'text',
      max: 40,
      half: true,
    },
    {
      key: 'qrUrl',
      label: 'Imagen del QR (enlace https)',
      kind: 'url',
      max: 500,
      placeholder: 'https://…',
    },
  ],
  redes_contacto: [
    { ...TITLE, required: false },
    {
      key: 'whatsapp',
      label: 'WhatsApp',
      kind: 'text',
      max: 15,
      placeholder: 'Solo dígitos, con 591',
      half: true,
    },
    { key: 'telefono', label: 'Teléfono', kind: 'text', max: 20, half: true },
    { key: 'correo', label: 'Correo', kind: 'text', max: 150, half: true },
    {
      key: 'direccion',
      label: 'Dirección',
      kind: 'text',
      max: 300,
      half: true,
    },
  ],
}

/** Las redes se guardan aparte y se publican al instante («Guardar enlaces»). */
export const SOCIAL_NETWORKS = [
  { key: 'facebook', label: 'Facebook' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'tiktok', label: 'TikTok' },
] as const

/** Qué dice la sección en el menú: «Portada del sitio», «Editado hoy», «Hace 2 meses». */
export const SECTION_HINTS: Record<string, string> = {
  presentacion: 'Portada del sitio',
}

/** «hoy», «ayer», «hace 3 días», «hace 2 semanas», «hace 2 meses» */
export function ago(value: string, now: Date = new Date()): string {
  const days = Math.floor(
    (startOfDay(now).getTime() - startOfDay(new Date(value)).getTime()) /
      86_400_000,
  )
  if (days <= 0) return 'hoy'
  if (days === 1) return 'ayer'
  if (days < 7) return `hace ${days} días`
  if (days < 30) {
    const weeks = Math.floor(days / 7)
    return weeks === 1 ? 'hace 1 semana' : `hace ${weeks} semanas`
  }
  if (days < 365) {
    const months = Math.floor(days / 30)
    return months === 1 ? 'hace 1 mes' : `hace ${months} meses`
  }
  const years = Math.floor(days / 365)
  return years === 1 ? 'hace 1 año' : `hace ${years} años`
}

function startOfDay(date: Date): Date {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export interface Segment {
  text: string
  changed: boolean
}

/**
 * Lo que cambió en un texto desde la última publicación: se conservan el principio y el
 * final iguales, y se resalta lo del medio. Si no había nada publicado, nada se resalta.
 */
export function changedSegments(
  published: string | undefined,
  draft: string,
): Segment[] {
  if (published === undefined || published === draft)
    return draft ? [{ text: draft, changed: false }] : []
  let start = 0
  while (
    start < published.length &&
    start < draft.length &&
    published[start] === draft[start]
  )
    start += 1
  let end = 0
  while (
    end < published.length - start &&
    end < draft.length - start &&
    published[published.length - 1 - end] === draft[draft.length - 1 - end]
  )
    end += 1
  // Se resalta por palabras enteras, para que se lea bien
  const inWord = (index: number) =>
    index > 0 &&
    index < draft.length &&
    !/\s/.test(draft[index - 1]!) &&
    !/\s/.test(draft[index]!)
  while (inWord(start)) start -= 1
  let cut = draft.length - end
  while (inWord(cut)) cut += 1
  // El espacio antes de lo nuevo no se resalta
  while (start < cut && /\s/.test(draft[start]!)) start += 1
  end = draft.length - cut
  const middle = draft.slice(start, draft.length - end)
  return [
    { text: draft.slice(0, start), changed: false },
    { text: middle, changed: middle.trim().length > 0 },
    { text: draft.slice(draft.length - end), changed: false },
  ].filter((segment) => segment.text)
}
