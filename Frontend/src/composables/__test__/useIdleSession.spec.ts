import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { ADMIN_SESSION, createApiFake } from '../../__test__/apiFake'
import {
  LAST_ACTIVITY_KEY,
  formatCountdown,
  useIdleSession,
} from '../useIdleSession'

const MINUTE = 60_000

function memoryStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  }
}

async function setup() {
  const fake = createApiFake({
    'GET /auth/me': { body: ADMIN_SESSION },
    'POST /auth/refresh': { body: ADMIN_SESSION },
    'POST /auth/logout': { body: { message: 'Sesión cerrada correctamente' } },
  })
  await fake.context.session.restore()
  const onExpired = vi.fn()
  const storage = memoryStorage()
  let idle!: ReturnType<typeof useIdleSession>
  const Host = defineComponent({
    setup() {
      idle = useIdleSession({
        session: fake.context.session,
        onExpired,
        storage,
      })
      return () => h('div')
    },
  })
  const wrapper = mount(Host, { attachTo: document.body })
  return { fake, idle, onExpired, storage, wrapper }
}

async function wait(ms: number) {
  await vi.advanceTimersByTimeAsync(ms)
  await flushPromises()
}

describe('Cierre de sesión por inactividad (RNF-02)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('avisa dos minutos antes de cerrar la sesión', async () => {
    const { idle, wrapper } = await setup()

    await wait(12 * MINUTE + 59_000)
    expect(idle.warningOpen.value).toBe(false)

    await wait(1_000)
    expect(idle.warningOpen.value).toBe(true)
    expect(formatCountdown(idle.remainingMs.value)).toBe('2:00')
    wrapper.unmount()
  })

  it('«Mantener la sesión activa» renueva la sesión en el servidor', async () => {
    const { idle, fake, wrapper } = await setup()
    await wait(14 * MINUTE)

    await idle.keepAlive()

    expect(fake.callsTo('POST /auth/refresh')).toHaveLength(1)
    expect(idle.warningOpen.value).toBe(false)
    expect(idle.remainingMs.value).toBe(15 * MINUTE)
    wrapper.unmount()
  })

  it('a los 15 minutos sin uso cierra la sesión y avisa a la app', async () => {
    const { fake, onExpired, wrapper } = await setup()

    await wait(15 * MINUTE + 1_000)

    expect(fake.callsTo('POST /auth/logout')).toHaveLength(1)
    expect(fake.context.session.state.status).toBe('anonymous')
    expect(onExpired).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('mientras la persona trabaja, avisa al servidor cada pocos minutos', async () => {
    const { fake, idle, onExpired, wrapper } = await setup()

    for (let minute = 0; minute < 20; minute += 1) {
      window.dispatchEvent(new Event('keydown'))
      await wait(MINUTE)
    }

    expect(fake.callsTo('POST /auth/refresh').length).toBeGreaterThanOrEqual(3)
    expect(idle.warningOpen.value).toBe(false)
    expect(onExpired).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('con el aviso abierto, mover el ratón no basta: hay que elegir', async () => {
    const { idle, wrapper } = await setup()
    await wait(13 * MINUTE + 30_000)

    window.dispatchEvent(new Event('pointerdown'))
    await wait(1_000)

    expect(idle.warningOpen.value).toBe(true)
    wrapper.unmount()
  })

  it('la actividad en otra pestaña mantiene viva esta', async () => {
    const { idle, onExpired, storage, wrapper } = await setup()
    await wait(14 * MINUTE)
    expect(idle.warningOpen.value).toBe(true)

    storage.setItem(LAST_ACTIVITY_KEY, String(Date.now()))
    await wait(2_000)
    expect(idle.warningOpen.value).toBe(false)

    await wait(3 * MINUTE)
    expect(onExpired).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('formatea la cuenta regresiva', () => {
    expect(formatCountdown(105_000)).toBe('1:45')
    expect(formatCountdown(59_100)).toBe('1:00')
    expect(formatCountdown(0)).toBe('0:00')
  })
})
