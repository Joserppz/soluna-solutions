import { describe, expect, it } from 'vitest'

import { firstName, greeting, initials, longDate } from '../format'

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
})
