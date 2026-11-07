/**
 * El modo demo se retiró (ADR-008): cada sección del menú tiene su vista conectada a la
 * API y ningún dato del sistema se guarda en el navegador. Esta prueba evita que vuelva.
 */
import { describe, expect, it } from 'vitest'

import { SECTION_VIEWS } from '../router'
import { TEAM_SECTIONS } from '../router/sections'

// Todo el código de la aplicación (sin las pruebas)
const SOURCES = import.meta.glob<string>(
  ['../**/*.{ts,vue}', '!../**/__test__/**', '!../**/*.spec.ts'],
  { query: '?raw', import: 'default', eager: true },
)

/** Lo único que se guarda en el navegador: la hora del último uso (aviso de inactividad). */
const STORAGE_ALLOWED = ['../composables/useIdleSession.ts']

describe('Sin modo demo', () => {
  it('cada sección del menú tiene su vista', () => {
    for (const section of TEAM_SECTIONS)
      expect(SECTION_VIEWS[section.name], section.name).toBeTypeOf('function')
  })

  it('no queda código del modo demo ni datos del sistema en el navegador', () => {
    const files = Object.keys(SOURCES)
    expect(files.length).toBeGreaterThan(50)
    for (const [file, code] of Object.entries(SOURCES)) {
      expect(code, file).not.toMatch(/services\/(aspar|api)|types\/aspar/)
      expect(code, file).not.toMatch(/VITE_DEMO_MODE|SectionPreparing/)
      if (!STORAGE_ALLOWED.includes(file))
        expect(code, file).not.toMatch(/localStorage|sessionStorage|indexedDB/)
    }
  })
})
