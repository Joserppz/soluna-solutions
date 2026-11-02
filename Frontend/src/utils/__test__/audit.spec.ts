import { describe, expect, it } from 'vitest'

import type { AuditEvent } from '../../api/types'
import {
  actorLabel,
  dayHeading,
  groupByDay,
  readableDetail,
  reviewSentence,
  timeOfDay,
} from '../audit'

// Lunes 2 de noviembre de 2026, 12:00 en La Paz
const NOW = new Date('2026-11-02T16:00:00Z')

describe('dayHeading', () => {
  it('nombra el día en La Paz', () => {
    expect(dayHeading('2026-11-02T12:00:00Z', NOW)).toBe(
      'Hoy, lunes 2 de noviembre',
    )
    // 01:30 UTC del día 2 todavía es domingo 1 en La Paz
    expect(dayHeading('2026-11-02T01:30:00Z', NOW)).toBe(
      'Ayer, domingo 1 de noviembre',
    )
    expect(dayHeading('2026-10-28T15:00:00Z', NOW)).toBe(
      'Miércoles 28 de octubre',
    )
    expect(dayHeading('2025-12-24T15:00:00Z', NOW)).toBe(
      'Miércoles 24 de diciembre de 2025',
    )
  })

  it('da la hora en La Paz', () => {
    expect(timeOfDay('2026-11-02T14:42:00Z')).toBe('10:42')
  })
})

describe('readableDetail', () => {
  it('quita los identificadores internos', () => {
    expect(
      readableDetail(
        'Consultó la anamnesis de Ramiro Prueba (9396d0be-0fd1-43da-a2dc-e50ce83ba0e7)',
      ),
    ).toBe('Consultó la anamnesis de Ramiro Prueba')
    expect(
      readableDetail(
        'Documento 9396d0be-0fd1-43da-a2dc-e50ce83ba0e7 eliminado del afiliado',
      ),
    ).toBe('Documento eliminado del afiliado')
    expect(readableDetail('Sin cambios')).toBe('Sin cambios')
  })
})

describe('actorLabel', () => {
  it('usa el nombre y, si no es del equipo, el correo', () => {
    expect(
      actorLabel({ actor: 'admin@aspar.org', actorName: 'Lucía Choque' }),
    ).toBe('Lucía Choque')
    expect(actorLabel({ actor: 'nadie@aspar.org', actorName: null })).toBe(
      'nadie@aspar.org',
    )
  })
})

describe('groupByDay', () => {
  it('junta los movimientos seguidos del mismo día', () => {
    const at = (id: string, date: string) => ({ id, date }) as AuditEvent
    const groups = groupByDay(
      [
        at('a', '2026-11-02T15:00:00Z'),
        at('b', '2026-11-02T13:00:00Z'),
        at('c', '2026-11-02T02:00:00Z'),
        at('d', '2026-10-30T15:00:00Z'),
      ],
      NOW,
    )
    expect(groups.map((group) => [group.key, group.events.length])).toEqual([
      ['2026-11-02', 2],
      ['2026-11-01', 1],
      ['2026-10-30', 1],
    ])
  })
})

describe('reviewSentence', () => {
  it('cuenta los intentos bloqueados y los aportes anulados', () => {
    expect(
      reviewSentence({ blockedAccess: 1, cancelledDonations: 1, total: 2 }),
    ).toBe('Un intento de acceso bloqueado y un aporte anulado.')
    expect(
      reviewSentence({ blockedAccess: 3, cancelledDonations: 0, total: 3 }),
    ).toBe('3 intentos de acceso bloqueados.')
    expect(
      reviewSentence({ blockedAccess: 0, cancelledDonations: 2, total: 2 }),
    ).toBe('2 aportes anulados.')
  })
})
