/**
 * Validaciones de formulario en el navegador. Repiten las reglas de la API para avisar
 * mientras la persona escribe; la API vuelve a validar todo.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const textEncoder = new TextEncoder()

export function emailError(value: string): string | null {
  const email = value.trim()
  if (!email) return 'Escribe tu correo electrónico.'
  if (!EMAIL_PATTERN.test(email))
    return 'Revisa el correo: debe tener la forma nombre@dominio.com.'
  return null
}

export function nameError(value: string): string | null {
  if (value.trim().length < 3)
    return 'Escribe tu nombre completo (al menos 3 letras).'
  return null
}

export interface PasswordRule {
  id: 'length' | 'mix' | 'max'
  label: string
  ok: boolean
}

/** Reglas de contraseña de la API: 8 caracteres, letras y números, hasta 72 bytes. */
export function passwordRules(password: string): PasswordRule[] {
  return [
    { id: 'length', label: 'Al menos 8 caracteres', ok: password.length >= 8 },
    {
      id: 'mix',
      label: 'Letras y números',
      ok: /[A-Za-z]/.test(password) && /\d/.test(password),
    },
    {
      id: 'max',
      label: 'No más de 72 caracteres',
      ok: textEncoder.encode(password).length <= 72,
    },
  ]
}

export function newPasswordError(password: string): string | null {
  if (!password) return 'Crea una contraseña.'
  const failing = passwordRules(password).find((rule) => !rule.ok)
  if (!failing) return null
  if (failing.id === 'length')
    return 'La contraseña debe tener al menos 8 caracteres.'
  if (failing.id === 'mix') return 'Combina letras y números.'
  return 'La contraseña no puede superar 72 caracteres.'
}

export function confirmationError(
  password: string,
  confirmation: string,
): string | null {
  if (!confirmation) return 'Repite la contraseña.'
  return password === confirmation ? null : 'Las contraseñas no coinciden.'
}
