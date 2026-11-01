import { describe, expect, it } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'

import type { Permission } from '../../api/types'
import {
  MUST_CHANGE_NOTICE,
  checkAccess,
  homeFor,
  safeRedirect,
  type AccessSnapshot,
  type RouteAccess,
} from '../guards'

function route(
  name: string,
  access: RouteAccess,
  extra: { permissions?: Permission[]; title?: string } = {},
): RouteLocationNormalized {
  return {
    name,
    fullPath: `/${name}`,
    meta: { access, ...extra },
  } as unknown as RouteLocationNormalized
}

function snapshot(
  overrides: Partial<AccessSnapshot> = {},
  perms: Permission[] = [],
) {
  return {
    status: 'authenticated',
    isPendingApproval: false,
    mustChangePassword: false,
    canAny: (...wanted: Permission[]) => wanted.some((p) => perms.includes(p)),
    ...overrides,
  } as AccessSnapshot
}

const anonymous = snapshot({ status: 'anonymous' })

describe('Reglas de acceso', () => {
  it('el sitio público está abierto para todos', () => {
    expect(checkAccess(route('inicio', 'public'), anonymous)).toEqual({
      allow: true,
    })
    expect(checkAccess(route('inicio', 'public'), snapshot())).toEqual({
      allow: true,
    })
  })

  it('sin sesión, el espacio del equipo pide ingresar y recuerda a dónde iba', () => {
    expect(checkAccess(route('afiliados', 'team'), anonymous)).toEqual({
      allow: false,
      redirect: { name: 'ingresar', query: { redirect: '/afiliados' } },
    })
    expect(
      checkAccess(
        route('cuenta-pendiente', 'account'),
        snapshot({ status: 'expired' }),
      ),
    ).toMatchObject({ allow: false, redirect: { name: 'ingresar' } })
  })

  it('con sesión, la pantalla de ingreso lleva al inicio que corresponde', () => {
    expect(checkAccess(route('ingresar', 'guest'), anonymous)).toEqual({
      allow: true,
    })
    expect(checkAccess(route('ingresar', 'guest'), snapshot())).toEqual({
      allow: false,
      redirect: { name: 'resumen' },
    })
  })

  it('con contraseña temporal solo se puede ir a cambiarla', () => {
    const temporary = snapshot({ mustChangePassword: true }, ['patients:read'])

    expect(checkAccess(route('afiliados', 'team'), temporary)).toEqual({
      allow: false,
      redirect: { name: 'cambiar-contrasena' },
      notice: MUST_CHANGE_NOTICE,
    })
    expect(
      checkAccess(route('cambiar-contrasena', 'account'), temporary),
    ).toEqual({
      allow: true,
    })
    expect(homeFor(temporary)).toEqual({ name: 'cambiar-contrasena' })
  })

  it('una cuenta sin rol espera en su pantalla, sin entrar al equipo', () => {
    const pending = snapshot({ isPendingApproval: true })

    expect(checkAccess(route('resumen', 'team'), pending)).toEqual({
      allow: false,
      redirect: { name: 'cuenta-pendiente' },
    })
    expect(checkAccess(route('cuenta-pendiente', 'account'), pending)).toEqual({
      allow: true,
    })
    expect(homeFor(pending)).toEqual({ name: 'cuenta-pendiente' })
  })

  it('quien ya tiene rol no vuelve a la pantalla de espera', () => {
    expect(
      checkAccess(route('cuenta-pendiente', 'account'), snapshot()),
    ).toEqual({
      allow: false,
      redirect: { name: 'resumen' },
    })
  })

  it('cada sección exige el permiso de la API y avisa si falta', () => {
    const volunteer = snapshot({}, ['patients:read', 'attendance:write'])
    const inventory = route('inventario', 'team', {
      permissions: ['inventory:manage'],
      title: 'Inventario',
    })
    const attendance = route('asistencia', 'team', {
      permissions: ['attendance:write', 'schedules:manage'],
    })

    expect(checkAccess(attendance, volunteer)).toEqual({ allow: true })
    expect(checkAccess(inventory, volunteer)).toEqual({
      allow: false,
      redirect: { name: 'resumen' },
      notice:
        'Tu rol no tiene acceso a Inventario. Si lo necesitas, pídeselo a Administración.',
    })
  })

  it('solo acepta destinos internos después de ingresar', () => {
    expect(safeRedirect('/equipo/afiliados?pagina=2')).toBe(
      '/equipo/afiliados?pagina=2',
    )
    expect(safeRedirect('//malicioso.com')).toBeNull()
    expect(safeRedirect('https://malicioso.com')).toBeNull()
    expect(safeRedirect('/\\malicioso.com')).toBeNull()
    expect(safeRedirect(['/equipo'])).toBeNull()
    expect(safeRedirect(undefined)).toBeNull()
  })
})
