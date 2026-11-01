import { describe, expect, it } from 'vitest'

import { pageItems, rangeLabel } from '../pagination'
import {
  activitiesLabel,
  ageOn,
  ciError,
  clinicalNotice,
  documentFileError,
  documentTypeLabel,
  fileSize,
  reasonError,
  cleanCi,
  cleanPhone,
  formatCi,
  normalizeSearch,
  pastDateError,
  personNameError,
  phoneError,
  sinceLabel,
} from '../patients'

describe('Datos de una ficha', () => {
  it('limpia el carnet y el teléfono como se dictan o se copian', () => {
    expect(cleanCi(' 4.821.557 ')).toBe('4821557')
    expect(cleanCi('4 821 557-1B')).toBe('4821557-1B')
    expect(cleanPhone('7012 3344')).toBe('70123344')
    expect(cleanPhone('7012-3344')).toBe('70123344')
  })

  it('valida el carnet como la API: de 5 a 10 números y un complemento opcional', () => {
    expect(ciError('')).toBe('Escribe el número de carnet.')
    expect(ciError('1234')).toContain('de 5 a 10 números')
    expect(ciError('12345678901')).toContain('de 5 a 10 números')
    expect(ciError('4821557-ABCD')).toContain('de 5 a 10 números')
    expect(ciError('4.821.557')).toBeNull()
    expect(ciError('4821557-1B')).toBeNull()
  })

  it('valida el teléfono y el nombre', () => {
    expect(phoneError(' ')).toBe('Escribe un número de teléfono.')
    expect(phoneError('701234')).toContain('de 7 a 12 números')
    expect(phoneError('7012abcd')).toContain('de 7 a 12 números')
    expect(phoneError('7012 3344')).toBeNull()
    expect(personNameError('Al')).toContain('al menos 3 letras')
    expect(personNameError(' Ana ')).toBeNull()
  })

  it('no acepta fechas futuras', () => {
    expect(pastDateError('2026-11-02', '2026-11-01')).toContain(
      'posterior a hoy',
    )
    expect(pastDateError('2026-11-01', '2026-11-01')).toBeNull()
    expect(pastDateError('', '2026-11-01')).toBeNull()
  })

  it('muestra el carnet en grupos de tres, con el complemento', () => {
    expect(formatCi('4821557')).toBe('4 821 557')
    expect(formatCi('4821557-1B')).toBe('4 821 557-1B')
    expect(formatCi('99999')).toBe('99 999')
  })

  it('un carnet escrito con espacios se busca solo con sus números', () => {
    expect(normalizeSearch('  4 821 557 ')).toBe('4821557')
    expect(normalizeSearch('4.821.557')).toBe('4821557')
    expect(normalizeSearch('  Alba   Gutiérrez ')).toBe('Alba Gutiérrez')
  })

  it('arma «Desde mes año», la edad y la lista de actividades', () => {
    expect(sinceLabel('2024-03-18T14:00:00Z')).toBe('Desde marzo 2024')
    // 1 de enero a las 02:00 UTC todavía es 31 de diciembre en La Paz
    expect(sinceLabel('2025-01-01T02:00:00Z')).toBe('Desde diciembre 2024')
    expect(ageOn('1958-05-12', '2026-10-28')).toBe(68)
    expect(ageOn('1958-10-29', '2026-10-28')).toBe(67)
    expect(ageOn('1958-10-28', '2026-10-28')).toBe(68)
    expect(activitiesLabel([])).toBe('')
    expect(activitiesLabel(['Teatro', 'Arteterapia'])).toBe(
      'Teatro, Arteterapia',
    )
    expect(activitiesLabel(['A', 'B', 'C', 'D'])).toBe('A, B y 2 más')
  })
})

describe('Paginación', () => {
  it('muestra todas las páginas si son pocas', () => {
    expect(pageItems(1, 1)).toEqual([1])
    expect(pageItems(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('con muchas páginas, salta con «…» como en el diseño', () => {
    expect(pageItems(1, 14)).toEqual([1, 2, 3, 'gap', 14])
    expect(pageItems(3, 14)).toEqual([1, 2, 3, 4, 'gap', 14])
    expect(pageItems(4, 14)).toEqual([1, 2, 3, 4, 5, 'gap', 14])
    expect(pageItems(8, 14)).toEqual([1, 'gap', 7, 8, 9, 'gap', 14])
    expect(pageItems(13, 14)).toEqual([1, 'gap', 12, 13, 14])
    expect(pageItems(14, 14)).toEqual([1, 'gap', 12, 13, 14])
  })

  it('dice qué filas se ven', () => {
    expect(rangeLabel(0, 7, 95)).toBe('Mostrando 1–7 de 95')
    expect(rangeLabel(90, 5, 95)).toBe('Mostrando 91–95 de 95')
    expect(rangeLabel(0, 0, 0)).toBe('Sin resultados')
  })
})

describe('Ficha: privacidad, documentos y motivos', () => {
  const ok = { consent: true, accessStatus: 'Activo', clinicalAccess: true }

  it('explica por qué no se ve la historia clínica, en el orden de la API', () => {
    expect(clinicalNotice(ok, true)).toBeNull()
    const closed = { ...ok, clinicalAccess: false }
    expect(clinicalNotice(closed, false)).toContain('Solo el personal clínico')
    expect(clinicalNotice({ ...closed, consent: false }, true)).toContain(
      'Falta el consentimiento',
    )
    expect(
      clinicalNotice({ ...closed, accessStatus: 'Revocado' }, true),
    ).toContain('La familia suspendió el acceso')
    expect(
      clinicalNotice({ ...closed, accessStatus: 'Pendiente' }, true),
    ).toContain('todavía no está habilitado')
  })

  it('revisa el archivo antes de subirlo', () => {
    const pdf = (size: number) =>
      new File([new Uint8Array(size)], 'a.pdf', { type: 'application/pdf' })
    expect(documentFileError(null)).toContain('Elige el archivo')
    expect(
      documentFileError(new File(['x'], 'a.gif', { type: 'image/gif' })),
    ).toContain('Solo se aceptan')
    expect(documentFileError(pdf(0))).toBe('El archivo está vacío.')
    expect(documentFileError(pdf(10 * 1024 * 1024 + 1))).toContain('10 MB')
    expect(documentFileError(pdf(1024))).toBeNull()
  })

  it('nombra los documentos y su tamaño como se leen', () => {
    expect(documentTypeLabel('CI')).toBe('Copia de carnet')
    expect(documentTypeLabel('Certificado neurológico')).toBe(
      'Certificado neurológico',
    )
    expect(fileSize(200)).toBe('1 KB')
    expect(fileSize(250_000)).toBe('244 KB')
    expect(fileSize(1_300_000)).toBe('1,2 MB')
  })

  it('pide un motivo de 3 a 300 letras', () => {
    expect(reasonError('  ')).toContain('al menos 3 letras')
    expect(reasonError('x'.repeat(301))).toContain('300')
    expect(reasonError(' Se mudó ')).toBeNull()
  })
})
