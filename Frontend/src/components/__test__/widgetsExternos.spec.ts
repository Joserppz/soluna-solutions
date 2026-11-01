import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { clearWidgets, fakeGoogle, fakeTurnstile } from '../../__test__/widgets'
import { loadScript } from '../../utils/loadScript'
import GoogleSignInButton from '../auth/GoogleSignInButton.vue'
import TurnstileWidget from '../auth/TurnstileWidget.vue'

afterEach(() => {
  clearWidgets()
  vi.unstubAllEnvs()
  document.head.querySelectorAll('script').forEach((script) => script.remove())
})

function lastScript(): HTMLScriptElement {
  const scripts = document.head.querySelectorAll('script')
  return scripts[scripts.length - 1]!
}

describe('Carga de scripts externos', () => {
  it('carga cada script una sola vez', async () => {
    const first = loadScript('https://ejemplo.test/una.js')
    const second = loadScript('https://ejemplo.test/una.js')

    expect(first).toBe(second)
    expect(document.head.querySelectorAll('script')).toHaveLength(1)
    expect(lastScript().async).toBe(true)

    lastScript().dispatchEvent(new Event('load'))
    await expect(first).resolves.toBeUndefined()
  })

  it('si falla, avisa y permite reintentar', async () => {
    const attempt = loadScript('https://ejemplo.test/falla.js')
    lastScript().dispatchEvent(new Event('error'))

    await expect(attempt).rejects.toThrow('No se pudo cargar')
    expect(document.head.querySelectorAll('script')).toHaveLength(0)

    void loadScript('https://ejemplo.test/falla.js')
    expect(document.head.querySelectorAll('script')).toHaveLength(1)
  })
})

describe('Verificación Turnstile', () => {
  it('usa la clave pública configurada y entrega el token', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '0x4AAA-clave-publica')
    const turnstile = fakeTurnstile()
    const wrapper = mount(TurnstileWidget, { attachTo: document.body })
    await flushPromises()

    expect(turnstile.render.mock.calls[0]![1]).toMatchObject({
      sitekey: '0x4AAA-clave-publica',
      language: 'es',
    })
    await wrapper.get('.turnstile-falso').trigger('click')
    expect(wrapper.emitted('verified')).toEqual([['token-humano']])

    ;(wrapper.vm as unknown as { reset: () => void }).reset()
    expect(turnstile.reset).toHaveBeenCalledWith('widget-1')
    expect(wrapper.emitted('expired')).toHaveLength(1)

    wrapper.unmount()
    expect(turnstile.remove).toHaveBeenCalledWith('widget-1')
  })

  it('sin la clave en producción lo dice en vez de fallar en silencio', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '')
    vi.stubEnv('DEV', false)
    const wrapper = mount(TurnstileWidget)
    await flushPromises()

    expect(wrapper.text()).toContain('no está configurada')
  })

  it('si el script de Cloudflare no carga, pide recargar', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '0x4AAA-clave-publica')
    const wrapper = mount(TurnstileWidget)
    lastScript().dispatchEvent(new Event('error'))
    await flushPromises()

    expect(wrapper.text()).toContain('No pudimos cargar la verificación')
  })
})

describe('Botón de Google', () => {
  it('no aparece si el sitio no tiene el ID de cliente', () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '')
    const wrapper = mount(GoogleSignInButton)

    expect(wrapper.find('.google').exists()).toBe(false)
  })

  it('dibuja el botón oficial y entrega la credencial', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'cliente.apps.googleusercontent.com')
    const google = fakeGoogle('credencial-1')
    const wrapper = mount(GoogleSignInButton)
    await flushPromises()

    expect(google.renderButton.mock.calls[0]![1]).toMatchObject({
      text: 'continue_with',
      locale: 'es',
    })
    await wrapper.get('.google-falso').trigger('click')
    expect(wrapper.emitted('credential')).toEqual([['credencial-1']])
  })

  it('si el script de Google no carga, sugiere ingresar con el correo', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'cliente.apps.googleusercontent.com')
    const wrapper = mount(GoogleSignInButton)
    lastScript().dispatchEvent(new Event('error'))
    await flushPromises()

    expect(wrapper.text()).toContain('Ingresa con tu correo')
  })
})
