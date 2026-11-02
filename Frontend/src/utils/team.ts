/**
 * Equipo y permisos: orden de los roles, permisos agrupados como en el diseño (pág. 18)
 * y el «último ingreso» de cada persona.
 */
import type { Permission, RoleOut } from '../api/types'
import { BOLIVIA_TIME_ZONE, shortDay, todayIso } from './format'

/** Rol del sistema: tiene todos los permisos y nadie los puede cambiar. */
export const ADMIN_ROLE = 'admin'

/** Orden de las columnas de la tabla de permisos y de las opciones de rol. */
const ROLE_ORDER = [
  'admin',
  'coordination',
  'professional',
  'reception',
  'volunteer',
]

/** Títulos cortos de las columnas («Admin.», «Coord.»), como en el diseño. */
const SHORT_NAMES: Record<string, string> = {
  admin: 'Admin.',
  coordination: 'Coord.',
}

export function sortRoles<T extends Pick<RoleOut, 'key'>>(roles: T[]): T[] {
  const position = (key: string) => {
    const index = ROLE_ORDER.indexOf(key)
    return index === -1 ? ROLE_ORDER.length : index
  }
  return [...roles].sort((a, b) => position(a.key) - position(b.key))
}

export function shortRoleName(role: Pick<RoleOut, 'key' | 'name'>): string {
  return SHORT_NAMES[role.key] ?? role.name
}

export interface PermissionGroup {
  label: string
  permissions: Permission[]
}

/** Los permisos de la API, agrupados por lo que permiten ver o hacer. */
export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    label: 'Afiliados',
    permissions: [
      'patients:read',
      'patients:write',
      'documents:upload',
      'patients:deactivate',
    ],
  },
  {
    label: 'Datos clínicos',
    permissions: [
      'patients:read_clinical',
      'patients:write_clinical',
      'documents:delete',
    ],
  },
  {
    label: 'Asistencia y actividades',
    permissions: ['attendance:write', 'schedules:manage'],
  },
  {
    label: 'Galería y contenido',
    permissions: ['media:manage', 'content:manage'],
  },
  {
    label: 'Donaciones y solicitudes',
    permissions: ['donations:manage', 'inquiries:manage'],
  },
  { label: 'Inventario', permissions: ['inventory:manage'] },
  {
    label: 'Equipo y registro',
    permissions: ['users:manage', 'roles:manage', 'audit:read'],
  },
]

/** Permisos clínicos: el aviso al activarlos es más fuerte (RNF-06). */
export const CLINICAL_PERMISSIONS: Permission[] = [
  'patients:read_clinical',
  'patients:write_clinical',
]

const timeFormat = new Intl.DateTimeFormat('es-BO', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: BOLIVIA_TIME_ZONE,
})
const weekdayFormat = new Intl.DateTimeFormat('es-BO', {
  weekday: 'short',
  timeZone: BOLIVIA_TIME_ZONE,
})

const DAY = 86_400_000

/**
 * Último ingreso: «Hoy, 08:55», «Ayer, 18:20», «Sáb 25 oct» (esta semana), «12 oct»,
 * «Hace 3 meses» o «Todavía no ingresó».
 */
export function lastSeenLabel(
  value: string | null | undefined,
  now: Date = new Date(),
): string {
  if (!value) return 'Todavía no ingresó'
  const date = new Date(value)
  const day = todayIso(date)
  const time = timeFormat.format(date)
  if (day === todayIso(now)) return `Hoy, ${time}`
  if (day === todayIso(new Date(now.getTime() - DAY))) return `Ayer, ${time}`

  const days = Math.floor((now.getTime() - date.getTime()) / DAY)
  const [dayNumber, month] = shortDay(value).split(' ')
  if (days < 7) {
    const weekday = weekdayFormat.format(date).replace('.', '')
    return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${dayNumber} ${month}`
  }
  if (days < 60) return `${dayNumber} ${month}`
  const months = Math.floor(days / 30)
  return months >= 12 ? 'Hace más de un año' : `Hace ${months} meses`
}
