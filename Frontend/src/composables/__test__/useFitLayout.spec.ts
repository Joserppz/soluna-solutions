import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'

import { FIT_LAYOUT_QUERY, useFitLayout } from '../useFitLayout'

function fakeMatchMedia(matches: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>()
  const query = {
    matches,
    addEventListener: vi.fn((_: string, listener) => listeners.add(listener)),
    removeEventListener: vi.fn((_: string, listener) =>
      listeners.delete(listener),
    ),
  }
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => query),
  )
  return {
    query,
    change(next: boolean) {
      listeners.forEach((listener) =>
        listener({ matches: next } as MediaQueryListEvent),
      )
    },
  }
}

/** Muestra lo que decide useFitLayout(). */
const Probe = defineComponent({
  setup() {
    const fit = useFitLayout()
    return () => h('p', fit.value ? 'completa' : 'desplaza')
  },
})

afterEach(() => vi.unstubAllGlobals())

describe('Ventana completa', () => {
  it('sigue al tamaño de la ventana y deja de escuchar al salir', async () => {
    const media = fakeMatchMedia(true)
    const wrapper = mount(Probe)

    expect(window.matchMedia).toHaveBeenCalledWith(FIT_LAYOUT_QUERY)
    expect(wrapper.text()).toBe('completa')
    media.change(false)
    await nextTick()
    expect(wrapper.text()).toBe('desplaza')

    wrapper.unmount()
    expect(media.query.removeEventListener).toHaveBeenCalled()
  })

  it('sin matchMedia (pruebas, navegadores viejos) la página se desplaza', () => {
    vi.stubGlobal('matchMedia', undefined)
    const wrapper = mount(Probe)
    expect(wrapper.text()).toBe('desplaza')
  })
})
