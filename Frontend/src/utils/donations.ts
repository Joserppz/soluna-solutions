/**
 * Textos de Donaciones (diseño págs. 15 y 16): montos en bolivianos, estados, canales y
 * lo que va en cada fila del registro. Sin pasarela de pago: QR bancario, efectivo en la
 * sede y en especie.
 */
import type { DonationOut } from '../api/types'
import { BOLIVIA_TIME_ZONE } from './format'
import { monthTitle, shiftMonth, today, type Tone } from './ops'

type DonationStatus = DonationOut['status']
type DonationChannel = DonationOut['channel']

export const DONATION_STATUS_TONES: Record<DonationStatus, Tone> = {
  pendiente: 'warning',
  confirmado: 'success',
  recibido: 'info',
  anulado: 'neutral',
}

export const CHANNELS: { value: DonationChannel; label: string }[] = [
  { value: 'qr_bancario', label: 'QR bancario' },
  { value: 'efectivo', label: 'Efectivo en la sede' },
  { value: 'especie', label: 'En especie' },
]

/** Pestañas del registro: «En especie» son los aportes recibidos en materiales. */
export type DonationTab =
  'todos' | 'pendiente' | 'confirmado' | 'recibido' | 'anulado'

export const DONATION_TABS: { key: DonationTab; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'pendiente', label: 'Por confirmar' },
  { key: 'confirmado', label: 'Confirmados' },
  { key: 'recibido', label: 'En especie' },
  { key: 'anulado', label: 'Anulados' },
]

const amountFormat = new Intl.NumberFormat('es-BO', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

/** 4380 → «Bs. 4.380»; 12.5 → «Bs. 12,5» */
export function formatBs(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—'
  return `Bs. ${amountFormat.format(amount)}`
}

/** «QR bancario · Sitio web», «Efectivo · En la sede», «En especie · En la sede» */
export function channelLine(donation: Pick<DonationOut, 'channel' | 'source'>) {
  const channel = {
    qr_bancario: 'QR bancario',
    efectivo: 'Efectivo',
    especie: 'En especie',
  }[donation.channel]
  return `${channel} · ${donation.source === 'sitio' ? 'Sitio web' : 'En la sede'}`
}

/** Lo que va en la columna «Referencia» de cada aporte. */
export function referenceLine(donation: DonationOut): string {
  if (donation.status === 'anulado')
    return donation.cancellationReason ?? 'Anulado'
  if (donation.channel === 'especie')
    return donation.inventoryItemId
      ? `${donation.inKindDescription} → Inventario`
      : (donation.inKindDescription ?? '')
  if (donation.bankReference) return `Extracto ${donation.bankReference}`
  if (donation.declaredReference)
    return donation.channel === 'efectivo'
      ? `Recibo ${donation.declaredReference}`
      : `Comprobante ${donation.declaredReference}`
  return donation.channel === 'efectivo' ? 'Sin recibo' : 'Sin comprobante'
}

/** «Pendiente desde hoy, 09:14» o «Pendiente desde el 27 oct, 18:02». */
export function pendingSince(
  createdAt: string,
  now: Date = new Date(),
): string {
  const date = new Date(createdAt)
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: BOLIVIA_TIME_ZONE,
  }).format(date)
  const time = new Intl.DateTimeFormat('es-BO', {
    timeZone: BOLIVIA_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
  const todayDay = new Intl.DateTimeFormat('en-CA', {
    timeZone: BOLIVIA_TIME_ZONE,
  }).format(now)
  if (day === todayDay) return `Pendiente desde hoy, ${time}`
  const short = new Intl.DateTimeFormat('es-BO', {
    timeZone: BOLIVIA_TIME_ZONE,
    day: 'numeric',
    month: 'short',
  })
    .format(date)
    .replace('.', '')
  return `Pendiente desde el ${short}, ${time}`
}

/** Los últimos doce meses para el selector, el actual primero. */
export function recentMonths(count = 12): { value: string; label: string }[] {
  const current = today().slice(0, 7)
  return Array.from({ length: count }, (_, index) => {
    const value = shiftMonth(current, -index)
    return { value, label: monthTitle(value).replace(' de ', ' ') }
  })
}

/** «23 personas y grupos» / «1 persona» */
export function peopleLabel(count: number): string {
  return count === 1 ? '1 persona' : `${count} personas y grupos`
}
