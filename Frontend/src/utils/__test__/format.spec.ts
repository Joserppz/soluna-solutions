import { describe, expect, it } from 'vitest'

import {
  firstName,
  greeting,
  initials,
  longDate,
  longDay,
  monthYear,
  shortDay,
  todayIso,
  whenLabel,
} from '../format'

describe('Formatos de ASPAR', () => {
  it('muestra la fecha larga en hora de Bolivia, con mayúscula inicial', () => {
    // 03:30 UTC del jueves 29 de octubre = 23:30 del miércoles 28 en La Paz
    expect(longDate(new Date('2026-10-29T03:30:00Z'))).toBe(
      'Miércoles, 28 de octubre',
    )
  })

  it('saluda según la hora de La Paz', () => {
    expect(greeting(new Date('2026-10-28T12:00:00Z'))).toBe('Buenos días') // 08:00
    expect(greeting(new Date('2026-10-28T19:00:00Z'))).toBe('Buenas tardes') // 15:00
    expect(greeting(new Date('2026-10-29T01:00:00Z'))).toBe('Buenas noches') // 21:00
    expect(greeting(new Date('2026-10-28T07:30:00Z'))).toBe('Buenas noches') // 03:30
  })

  it('toma el primer nombre sin títulos', () => {
    expect(firstName('Lic. Ana Flores')).toBe('Ana')
    expect(firstName('Lucía Choque (demo)')).toBe('Lucía')
    expect(firstName('   ')).toBe('')
  })

  it('arma las iniciales con el primer nombre y el último apellido', () => {
    expect(initials('Lucía Choque')).toBe('LC')
    expect(initials('Lucía Choque (demo)')).toBe('LC')
    expect(initials('Lic. Ana María Flores')).toBe('AF')
    expect(initials('Rosa')).toBe('R')
  })

  it('da la fecha de hoy y el mes en hora de La Paz', () => {
    // 03:30 UTC del 1 de noviembre = 23:30 del 31 de octubre en La Paz
    expect(todayIso(new Date('2026-11-01T03:30:00Z'))).toBe('2026-10-31')
    expect(monthYear('2026-11-01T03:30:00Z')).toBe('octubre 2026')
    expect(monthYear(new Date('2024-03-18T14:00:00Z'))).toBe('marzo 2024')
  })

  it('escribe días del calendario sin correrse por la zona horaria', () => {
    expect(longDay('2024-03-18')).toBe('18 de marzo de 2024')
    expect(shortDay('2026-10-14')).toBe('14 oct 2026')
    // 02:00 UTC del 15 = 22:00 del 14 en La Paz
    expect(shortDay('2026-10-15T02:00:00Z')).toBe('14 oct 2026')
  })

  it('dice cuándo fue el último cambio', () => {
    const now = new Date('2026-10-28T20:00:00Z') // 16:00 en La Paz
    expect(whenLabel('2026-10-28T13:58:00Z', now)).toBe('hoy a las 09:58')
    expect(whenLabel('2026-10-27T22:20:00Z', now)).toBe('ayer a las 18:20')
    expect(whenLabel('2026-10-14T13:58:00Z', now)).toBe(
      '14 oct 2026 a las 09:58',
    )
  })
})
