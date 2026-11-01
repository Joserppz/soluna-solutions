/**
 * Reglas de acceso a las rutas. Es una función pura para probarla sin navegador; el
 * router la llama antes de cada navegación (router/index.ts).
 *
 * Tipos de ruta (meta.access):
 * - public: el sitio público, para todos.
 * - guest: ingresar (y las demás pantallas de acceso); con sesión se va al inicio.
 * - account: necesita sesión, aunque la cuenta no tenga rol todavía.
 * - team: Espacio del equipo; necesita un rol y, si la ruta lo pide, un permiso.
 *
 * La API vuelve a verificar cada permiso: esto solo decide qué pantalla mostrar.
 */
import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router'

import type { Session, SessionStatus } from '../api/session'
import type { Permission } from '../api/types'

export type RouteAccess = 'public' | 'guest' | 'account' | 'team'

export interface AccessSnapshot {
  status: SessionStatus
  isPendingApproval: boolean
  mustChangePassword: boolean
  canAny: (...permissions: Permission[]) => boolean
}

export type AccessDecision =
  | { allow: true }
  | { allow: false; redirect: RouteLocationRaw; notice?: string }

export const MUST_CHANGE_NOTICE =
  'Antes de continuar, crea una contraseña propia en lugar de la temporal.'

export function snapshotOf(session: Session): AccessSnapshot {
  return {
    status: session.state.status,
    isPendingApproval: session.isPendingApproval.value,
    mustChangePassword: session.mustChangePassword.value,
    canAny: session.canAny,
  }
}

/**
 * Destino seguro después de ingresar: solo rutas internas de la aplicación
 * (nunca «//otro-sitio.com» ni direcciones completas).
 */
export function safeRedirect(value: unknown): string | null {
  if (typeof value !== 'string') return null
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\'))
    return null
  return value
}

/** Primera pantalla después de ingresar. */
export function homeFor(session: AccessSnapshot): RouteLocationRaw {
  if (session.mustChangePassword) return { name: 'cambiar-contrasena' }
  if (session.isPendingApproval) return { name: 'cuenta-pendiente' }
  return { name: 'resumen' }
}

export function checkAccess(
  to: RouteLocationNormalized,
  session: AccessSnapshot,
): AccessDecision {
  const access = (to.meta.access as RouteAccess | undefined) ?? 'public'
  const authenticated = session.status === 'authenticated'

  if (access === 'public') return { allow: true }

  if (access === 'guest')
    return authenticated
      ? { allow: false, redirect: homeFor(session) }
      : { allow: true }

  if (!authenticated)
    return {
      allow: false,
      redirect: { name: 'ingresar', query: { redirect: to.fullPath } },
    }

  // Con contraseña temporal solo se puede ir a cambiarla
  if (session.mustChangePassword && to.name !== 'cambiar-contrasena')
    return {
      allow: false,
      redirect: { name: 'cambiar-contrasena' },
      notice: MUST_CHANGE_NOTICE,
    }

  if (to.name === 'cuenta-pendiente' && !session.isPendingApproval)
    return { allow: false, redirect: homeFor(session) }

  if (access === 'account') return { allow: true }

  if (session.isPendingApproval)
    return { allow: false, redirect: { name: 'cuenta-pendiente' } }

  const permissions = (to.meta.permissions as Permission[] | undefined) ?? []
  if (permissions.length && !session.canAny(...permissions)) {
    const title = (to.meta.title as string | undefined) ?? 'esa sección'
    return {
      allow: false,
      redirect: { name: 'resumen' },
      notice: `Tu rol no tiene acceso a ${title}. Si lo necesitas, pídeselo a Administración.`,
    }
  }
  return { allow: true }
}
