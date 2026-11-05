import { describe, expect, it } from 'vitest'

import {
  calendarDays,
  dayLabel,
  monthBounds,
  monthTitle,
  shiftMonth,
  shortDayLabel,
  spotsLabel,
  timeRange,
  weekdayIndex,
} from '../ops'

describe('calendario del mes', () => {
  it('va de un mes a otro, también al cambiar de año', () => {
    expect(shiftMonth('2026-11', 1)).toBe('2026-12')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2027-01', -1)).toBe('2026-12')
  })

  it('calcula el primer y el último día, también en febrero bisiesto', () => {
    expect(monthBounds('2026-11')).toEqual({
      from: '2026-11-01',
      to: '2026-11-30',
    })
    expect(monthBounds('2028-02')).toEqual({
      from: '2028-02-01',
      to: '2028-02-29',
    })
  })

  it('pone los días desde el lunes, con huecos al inicio', () => {
    // 1 de noviembre de 2026 es domingo: seis huecos antes del día 1 (la semana empieza el lunes)
    expect(weekdayIndex('2026-11-01')).toBe(0)
    const days = calendarDays('2026-11')
    expect(days.slice(0, 7).filter((day) => day === null)).toHaveLength(6)
    expect(days[6]).toBe('2026-11-01')
    expect(days.at(-1)).toBe('2026-11-30')
  })

  it('nombra el mes y el día en español', () => {
    expect(monthTitle('2026-11')).toBe('Noviembre de 2026')
    expect(dayLabel('2026-11-07')).toBe('Sábado, 7 de noviembre')
    expect(shortDayLabel('2026-11-07')).toBe('7 nov')
  })
})

describe('textos de las actividades', () => {
  it('da el horario sin segundos', () => {
    expect(timeRange('10:00:00', '11:30:00')).toBe('10:00 – 11:30')
  })

  it('dice los cupos o que no hay límite', () => {
    expect(spotsLabel({ spots: 30, interested: 27 })).toBe('27 de 30 cupos')
    expect(spotsLabel({ spots: null, interested: 0 })).toBe(
      'Sin cupos definidos',
    )
  })
})
