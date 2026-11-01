import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useToast } from '../composables/useToast'
import {
  ADMIN_SESSION,
  DASHBOARD,
  NO_SESSION,
  createApiFake,
  mountApp,
  settle,
} from './apiFake'
import { clearWidgets, fakeGoogle, fakeTurnstile } from './widgets'

const CHECK_INBOX =
  'Si los datos son correctos, te enviamos un correo con los pasos a seguir.'

beforeEach(() => {
  fakeTurnstile()
})

afterEach(() => {
  document.body.innerHTML = ''
  useToast().clear()
  clearWidgets()
  vi.unstubAllEnvs()
})

type Wrapper = Awaited<ReturnType<typeof mountApp>>['wrapper']

async function fill(wrapper: Wrapper, label: string, value: string) {
  const field = wrapper
    .findAll('.field')
    .find((f) => f.get('label').text().replace('*', '').trim() === label)
  if (!field) throw new Error(`No hay un campo «${label}»`)
  await field.get('input').setValue(value)
}

async function submit(wrapper: Wrapper) {
  await wrapper.get('form').trigger('submit')
  await settle()
}

describe('Crear una cuenta (registro abierto)', () => {
  it('valida en vivo y pide la verificación de seguridad', async () => {
    const fake = createApiFake({ 'GET /auth/me': NO_SESSION })
    const { wrapper } = await mountApp('/crear-cuenta', fake)

    expect(wrapper.get('h1').text()).toBe('Crea tu cuenta.')
    await fill(wrapper, 'Contraseña', 'abc')
    expect(wrapper.findAll('.checklist .is-ok')).toHaveLength(1)

    await submit(wrapper)

    expect(wrapper.text()).toContain('Escribe tu nombre completo')
    expect(wrapper.text()).toContain('Escribe tu correo electrónico.')
    expect(wrapper.text()).toContain('al menos 8 caracteres')
    expect(wrapper.text()).toContain('Completa la verificación de seguridad.')
    expect(fake.callsTo('POST /auth/register')).toHaveLength(0)
  })

  it('envía el registro con el token de Turnstile y explica los pasos siguientes', async () => {
    const fake = createApiFake({
      'GET /auth/me': NO_SESSION,
      'POST /auth/register': { status: 202, body: { message: CHECK_INBOX } },
    })
    const { wrapper } = await mountApp('/crear-cuenta', fake)

    await fill(wrapper, 'Nombre completo', 'Gabriela Rocha')
    await fill(wrapper, 'Correo electrónico', ' gabriela@gmail.com ')
    await fill(wrapper, 'Contraseña', 'Ceibo4821')
    await fill(wrapper, 'Repite la contraseña', 'Ceibo4821')
    await wrapper.get('.turnstile-falso').trigger('click')
    await submit(wrapper)

    expect(fake.callsTo('POST /auth/register')[0]!.body).toEqual({
      name: 'Gabriela Rocha',
      email: 'gabriela@gmail.com',
      password: 'Ceibo4821',
      turnstileToken: 'token-humano',
    })
    expect(wrapper.get('h1').text()).toBe('Revisa tu correo.')
    expect(wrapper.text()).toContain(CHECK_INBOX)
    expect(wrapper.text()).toContain('gabriela@gmail.com')
    expect(window.turnstile!.reset).toHaveBeenCalled()
  })

  it('si la verificación falla, muestra el mensaje y pide verificar de nuevo', async () => {
    const fake = createApiFake({
      'GET /auth/me': NO_SESSION,
      'POST /auth/register': {
        status: 400,
        body: {
          detail:
            'No pudimos comprobar que eres una persona. Recarga la página e intenta de nuevo.',
        },
      },
    })
    const { wrapper } = await mountApp('/crear-cuenta', fake)

    await fill(wrapper, 'Nombre completo', 'Gabriela Rocha')
    await fill(wrapper, 'Correo electrónico', 'gabriela@gmail.com')
    await fill(wrapper, 'Contraseña', 'Ceibo4821')
    await fill(wrapper, 'Repite la contraseña', 'Ceibo4821')
    await wrapper.get('.turnstile-falso').trigger('click')
    await submit(wrapper)

    expect(wrapper.get('.alert--error').text()).toContain(
      'No pudimos comprobar que eres una persona',
    )
    // El token ya se usó: el siguiente envío vuelve a pedir la verificación
    await submit(wrapper)
    expect(wrapper.text()).toContain('Completa la verificación de seguridad.')
    expect(fake.callsTo('POST /auth/register')).toHaveLength(1)
  })

  it('con sesión iniciada, crear cuenta lleva al espacio del equipo', async () => {
    const fake = createApiFake({
      'GET /auth/me': { body: ADMIN_SESSION },
      'GET /dashboard/summary': { body: DASHBOARD },
    })
    const { router } = await mountApp('/crear-cuenta', fake)

    expect(router.currentRoute.value.name).toBe('resumen')
  })
})

describe('Confirmar el correo', () => {
  it('confirma con el enlace del correo', async () => {
    const fake = createApiFake({
      'GET /auth/me': NO_SESSION,
      'POST /auth/verify-email': {
        body: { message: 'Tu correo quedó confirmado. Ya puedes ingresar.' },
      },
    })
    const { wrapper } = await mountApp(
      '/verificar-correo?token=enlace-de-prueba-123456',
      fake,
    )

    expect(fake.callsTo('POST /auth/verify-email')[0]!.body).toEqual({
      token: 'enlace-de-prueba-123456',
    })
    expect(wrapper.get('h1').text()).toBe('¡Correo confirmado!')
    expect(wrapper.text()).toContain('Tu correo quedó confirmado.')
  })

  it('si el enlace venció, deja pedir uno nuevo', async () => {
    const fake = createApiFake({
      'GET /auth/me': NO_SESSION,
      'POST /auth/verify-email': {
        status: 400,
        body: { detail: 'El enlace no es válido o ya venció. Pide uno nuevo.' },
      },
      'POST /auth/resend-verification': {
        status: 202,
        body: { message: CHECK_INBOX },
      },
    })
    const { wrapper } = await mountApp(
      '/verificar-correo?token=enlace-vencido-1234567',
      fake,
    )

    expect(wrapper.get('h1').text()).toBe('Este enlace ya no sirve.')
    expect(wrapper.text()).toContain('El enlace no es válido o ya venció.')

    await fill(wrapper, 'Correo electrónico', 'gabriela@gmail.com')
    await wrapper.get('.turnstile-falso').trigger('click')
    await submit(wrapper)

    expect(fake.callsTo('POST /auth/resend-verification')[0]!.body).toEqual({
      email: 'gabriela@gmail.com',
      turnstileToken: 'token-humano',
    })
    expect(wrapper.get('.alert--success').text()).toContain(CHECK_INBOX)
  })

  it('desde el ingreso llega con el correo ya escrito', async () => {
    const fake = createApiFake({ 'GET /auth/me': NO_SESSION })
    const { wrapper } = await mountApp(
      '/verificar-correo?correo=gabriela@gmail.com',
      fake,
    )

    expect(wrapper.get('h1').text()).toBe('Confirma tu correo.')
    expect(
      (wrapper.get('input[type="email"]').element as HTMLInputElement).value,
    ).toBe('gabriela@gmail.com')
    expect(fake.callsTo('POST /auth/verify-email')).toHaveLength(0)
  })
})

describe('Recuperar la contraseña', () => {
  it('pide el enlace por correo con la verificación de seguridad', async () => {
    const fake = createApiFake({
      'GET /auth/me': NO_SESSION,
      'POST /auth/forgot-password': {
        status: 202,
        body: { message: CHECK_INBOX },
      },
    })
    const { wrapper } = await mountApp('/recuperar-contrasena', fake)

    await submit(wrapper)
    expect(wrapper.text()).toContain('Escribe tu correo electrónico.')
    expect(wrapper.text()).toContain('Completa la verificación de seguridad.')

    await fill(wrapper, 'Correo electrónico', 'lucia@aspar.org')
    await wrapper.get('.turnstile-falso').trigger('click')
    await submit(wrapper)

    expect(fake.callsTo('POST /auth/forgot-password')[0]!.body).toEqual({
      email: 'lucia@aspar.org',
      turnstileToken: 'token-humano',
    })
    expect(wrapper.get('.alert--success').text()).toContain(CHECK_INBOX)
  })

  it('respeta el límite de intentos de la API', async () => {
    const fake = createApiFake({
      'GET /auth/me': NO_SESSION,
      'POST /auth/forgot-password': {
        status: 429,
        body: {
          detail:
            'Demasiados intentos. Espera 60 minutos y vuelve a intentarlo.',
        },
      },
    })
    const { wrapper } = await mountApp('/recuperar-contrasena', fake)

    await fill(wrapper, 'Correo electrónico', 'lucia@aspar.org')
    await wrapper.get('.turnstile-falso').trigger('click')
    await submit(wrapper)

    expect(wrapper.get('.alert--error').text()).toContain(
      'Demasiados intentos.',
    )
  })

  it('crea la contraseña nueva con el enlace del correo', async () => {
    const fake = createApiFake({
      'GET /auth/me': NO_SESSION,
      'POST /auth/reset-password': [
        {
          status: 400,
          body: {
            detail: 'El enlace no es válido o ya venció. Pide uno nuevo.',
          },
        },
        {
          body: { message: 'Tu contraseña se actualizó. Ya puedes ingresar.' },
        },
      ],
    })
    const { wrapper } = await mountApp(
      '/restablecer-contrasena?token=enlace-de-prueba-123456',
      fake,
    )

    await fill(wrapper, 'Contraseña nueva', 'Nueva2026')
    await fill(wrapper, 'Repite la contraseña nueva', 'Nueva2025')
    await submit(wrapper)
    expect(wrapper.text()).toContain('Las contraseñas no coinciden.')

    await fill(wrapper, 'Repite la contraseña nueva', 'Nueva2026')
    await submit(wrapper)
    expect(wrapper.get('.alert--error').text()).toContain('ya venció')
    expect(wrapper.get('.alert--error a').attributes('href')).toBe(
      '/recuperar-contrasena',
    )

    await submit(wrapper)
    expect(fake.callsTo('POST /auth/reset-password')[1]!.body).toEqual({
      token: 'enlace-de-prueba-123456',
      password: 'Nueva2026',
    })
    expect(wrapper.get('h1').text()).toBe('Contraseña actualizada.')
  })

  it('sin el enlace completo ofrece pedir uno nuevo', async () => {
    const fake = createApiFake({ 'GET /auth/me': NO_SESSION })
    const { wrapper } = await mountApp('/restablecer-contrasena', fake)

    expect(wrapper.get('h1').text()).toBe('Este enlace está incompleto.')
  })
})

describe('Ingreso con Google y enlaces del acceso', () => {
  it('«Continuar con Google» envía la credencial a la API', async () => {
    vi.stubEnv(
      'VITE_GOOGLE_CLIENT_ID',
      'cliente-prueba.apps.googleusercontent.com',
    )
    const google = fakeGoogle()
    const fake = createApiFake({
      'GET /auth/me': NO_SESSION,
      'POST /auth/google': { body: ADMIN_SESSION },
      'GET /dashboard/summary': { body: DASHBOARD },
    })
    const { wrapper, router } = await mountApp('/ingresar', fake)

    expect(google.initialize.mock.calls[0]![0]).toMatchObject({
      client_id: 'cliente-prueba.apps.googleusercontent.com',
    })
    expect(wrapper.text()).toContain('o con tu correo')

    await wrapper.get('.google-falso').trigger('click')
    await settle()

    expect(fake.callsTo('POST /auth/google')[0]!.body).toEqual({
      credential: 'credencial-de-google',
    })
    expect(router.currentRoute.value.name).toBe('resumen')
  })

  it('si Google no está disponible, lo explica', async () => {
    vi.stubEnv(
      'VITE_GOOGLE_CLIENT_ID',
      'cliente-prueba.apps.googleusercontent.com',
    )
    fakeGoogle()
    const fake = createApiFake({
      'GET /auth/me': NO_SESSION,
      'POST /auth/google': {
        status: 503,
        body: { detail: 'El inicio de sesión con Google no está configurado.' },
      },
    })
    const { wrapper } = await mountApp('/ingresar', fake)

    await wrapper.get('.google-falso').trigger('click')
    await settle()

    expect(wrapper.get('.alert--error').text()).toContain(
      'El inicio de sesión con Google no está configurado.',
    )
  })

  it('sin Google configurado no muestra el botón ni el separador', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '')
    const fake = createApiFake({ 'GET /auth/me': NO_SESSION })
    const { wrapper } = await mountApp('/ingresar', fake)

    expect(wrapper.find('.google').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('o con tu correo')
  })

  it('si el correo no está confirmado, ofrece un enlace nuevo', async () => {
    const fake = createApiFake({
      'GET /auth/me': NO_SESSION,
      'POST /auth/login': {
        status: 403,
        body: {
          detail:
            'Confirma tu correo antes de ingresar: revisa tu bandeja o pide un enlace nuevo.',
        },
      },
    })
    const { wrapper } = await mountApp('/ingresar', fake)

    await fill(wrapper, 'Correo electrónico', 'gabriela@gmail.com')
    await fill(wrapper, 'Contraseña', 'Ceibo4821')
    await submit(wrapper)

    const link = wrapper.get('.login__resend')
    expect(link.text()).toBe('Enviarme un enlace nuevo')
    expect(link.attributes('href')).toBe(
      '/verificar-correo?correo=gabriela@gmail.com',
    )
  })

  it('enlaza la recuperación y el registro', async () => {
    const fake = createApiFake({ 'GET /auth/me': NO_SESSION })
    const { wrapper } = await mountApp('/ingresar', fake)
    const links = wrapper.get('.login__links').findAll('a')

    expect(links.map((a) => a.attributes('href'))).toEqual([
      '/recuperar-contrasena',
      '/crear-cuenta',
    ])
  })
})
