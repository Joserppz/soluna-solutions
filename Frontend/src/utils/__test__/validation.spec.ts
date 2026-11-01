import { describe, expect, it } from 'vitest'

import {
  confirmationError,
  emailError,
  nameError,
  newPasswordError,
  passwordRules,
} from '../validation'

describe('Validaciones de formulario', () => {
  it('revisa el correo', () => {
    expect(emailError('')).toBe('Escribe tu correo electrónico.')
    expect(emailError('rosa@')).toContain('nombre@dominio.com')
    expect(emailError('  rosa@aspar.org ')).toBeNull()
  })

  it('revisa el nombre', () => {
    expect(nameError('Al')).toContain('al menos 3 letras')
    expect(nameError('Rosa Vásquez')).toBeNull()
  })

  it('las reglas de contraseña son las mismas de la API', () => {
    expect(passwordRules('abc').map((rule) => rule.ok)).toEqual([
      false,
      false,
      true,
    ])
    expect(passwordRules('Ceibo-4821-Sol').every((rule) => rule.ok)).toBe(true)
    // 72 bytes: «ñ» ocupa 2
    expect(
      passwordRules(`a1${'ñ'.repeat(36)}`).find((r) => r.id === 'max')?.ok,
    ).toBe(false)
  })

  it('explica la primera regla que falta', () => {
    expect(newPasswordError('')).toBe('Crea una contraseña.')
    expect(newPasswordError('abc1')).toContain('8 caracteres')
    expect(newPasswordError('solo-letras')).toBe('Combina letras y números.')
    expect(newPasswordError(`a1${'x'.repeat(80)}`)).toContain('72')
    expect(newPasswordError('Ceibo4821')).toBeNull()
  })

  it('revisa que la confirmación coincida', () => {
    expect(confirmationError('Ceibo4821', '')).toBe('Repite la contraseña.')
    expect(confirmationError('Ceibo4821', 'Ceibo4822')).toBe(
      'Las contraseñas no coinciden.',
    )
    expect(confirmationError('Ceibo4821', 'Ceibo4821')).toBeNull()
  })
})
