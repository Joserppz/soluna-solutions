import { describe, expect, it } from 'vitest'

import {
  PERMISSION_GROUPS,
  lastSeenLabel,
  shortRoleName,
  sortRoles,
} from '../team'

// Miércoles 28 de octubre de 2026, 12:00 en La Paz
const NOW = new Date('2026-10-28T16:00:00Z')

describe('lastSeenLabel', () => {
  it('dice cuándo fue el último ingreso, en hora de La Paz', () => {
    expect(lastSeenLabel('2026-10-28T12:55:00Z', NOW)).toBe('Hoy, 08:55')
    expect(lastSeenLabel('2026-10-27T22:20:00Z', NOW)).toBe('Ayer, 18:20')
    // Pasada la medianoche en UTC sigue siendo «ayer» en La Paz
    expect(lastSeenLabel('2026-10-28T03:30:00Z', NOW)).toBe('Ayer, 23:30')
    expect(lastSeenLabel('2026-10-24T15:00:00Z', NOW)).toBe('Sáb 24 oct')
    expect(lastSeenLabel('2026-10-12T15:00:00Z', NOW)).toBe('12 oct')
    expect(lastSeenLabel('2026-07-20T15:00:00Z', NOW)).toBe('Hace 3 meses')
    expect(lastSeenLabel('2025-08-01T15:00:00Z', NOW)).toBe(
      'Hace más de un año',
    )
  })

  it('sin ingresos todavía', () => {
    expect(lastSeenLabel(null, NOW)).toBe('Todavía no ingresó')
    expect(lastSeenLabel(undefined, NOW)).toBe('Todavía no ingresó')
  })
})

describe('roles', () => {
  it('se ordenan como en el diseño; los nuevos van al final', () => {
    const roles = [
      'nuevo',
      'volunteer',
      'reception',
      'admin',
      'professional',
      'coordination',
    ].map((key) => ({ key }))
    expect(sortRoles(roles).map((role) => role.key)).toEqual([
      'admin',
      'coordination',
      'professional',
      'reception',
      'volunteer',
      'nuevo',
    ])
  })

  it('usan el título corto del diseño en las columnas', () => {
    expect(shortRoleName({ key: 'admin', name: 'Administración' })).toBe(
      'Admin.',
    )
    expect(shortRoleName({ key: 'coordination', name: 'Coordinación' })).toBe(
      'Coord.',
    )
    expect(shortRoleName({ key: 'reception', name: 'Recepción' })).toBe(
      'Recepción',
    )
  })

  it('cada permiso de la API está en un solo grupo', () => {
    const keys = PERMISSION_GROUPS.flatMap((group) => group.permissions)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys).toHaveLength(17)
  })
})
