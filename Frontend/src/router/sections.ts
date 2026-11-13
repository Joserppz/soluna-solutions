/**
 * Secciones del Espacio del equipo: rutas, menú lateral, migas de pan y tarjetas del
 * resumen salen de esta lista. El permiso de cada una es el mismo que exige la API.
 */
import type { Permission } from '../api/types'
import type { IconName } from '../utils/icons'

export type ReviewCounter = 'newInquiries' | 'donationsToConfirm'

export interface TeamSection {
  /** Nombre de la ruta. */
  name: string
  /** Ruta relativa a /equipo. */
  path: string
  title: string
  /** Ícono del menú lateral. */
  icon: IconName
  /** Frase corta para el resumen y la página de la sección. */
  description: string
  /** Basta con uno de estos permisos (igual que require_permission(any_of=True)). */
  permissions: Permission[]
  /** Grupo del menú (Administración). */
  group?: 'administracion'
  /** Contador de «Para revisar» que se muestra como insignia en el menú. */
  badge?: ReviewCounter
}

export const TEAM_SECTIONS: TeamSection[] = [
  {
    name: 'afiliados',
    path: 'afiliados',
    title: 'Afiliados',
    icon: 'patients',
    description: 'Fichas, familiares y consentimientos de cada persona.',
    permissions: ['patients:read'],
  },
  {
    name: 'inventario',
    path: 'inventario',
    title: 'Inventario',
    icon: 'inventory',
    description: 'Materiales, préstamos, devoluciones y bajas.',
    permissions: ['inventory:manage'],
  },
  {
    name: 'actividades',
    path: 'actividades',
    title: 'Actividades',
    icon: 'activities',
    description: 'Los encuentros de cada sábado y la agenda del sitio.',
    permissions: ['schedules:manage'],
  },
  {
    name: 'asistencia',
    path: 'asistencia',
    title: 'Asistencia',
    icon: 'attendance',
    description: 'Quién vino a cada encuentro y el resumen del mes.',
    permissions: ['attendance:write', 'schedules:manage'],
  },
  {
    name: 'galeria',
    path: 'galeria',
    title: 'Galería',
    icon: 'gallery',
    description: 'Álbumes de fotos y videos de la comunidad.',
    permissions: ['media:manage'],
  },
  {
    name: 'contenido',
    path: 'contenido',
    title: 'Contenido',
    icon: 'content',
    description: 'Los textos que ven las familias en el sitio.',
    permissions: ['content:manage'],
  },
  {
    name: 'donaciones',
    path: 'donaciones',
    title: 'Donaciones',
    icon: 'donations',
    description: 'Aportes por confirmar, la meta y el resumen del mes.',
    permissions: ['donations:manage'],
    badge: 'donationsToConfirm',
  },
  {
    name: 'solicitudes',
    path: 'solicitudes',
    title: 'Solicitudes',
    icon: 'inquiries',
    description:
      'Personas que escribieron desde el sitio y esperan una llamada.',
    permissions: ['inquiries:manage'],
    badge: 'newInquiries',
  },
  {
    name: 'equipo-permisos',
    path: 'administracion/equipo',
    title: 'Equipo y permisos',
    icon: 'team',
    description: 'Quién entra al espacio del equipo y qué puede ver cada rol.',
    permissions: ['users:manage', 'roles:manage'],
    group: 'administracion',
  },
  {
    name: 'registro-actividad',
    path: 'administracion/registro',
    title: 'Registro de actividad',
    icon: 'log',
    description: 'Todo lo que pasó con la información sensible, en orden.',
    permissions: ['audit:read'],
    group: 'administracion',
  },
]

export const ADMIN_GROUP_TITLE = 'Administración'
