import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'

import DataTable from '../ui/DataTable.vue'
import StickyHeader from '../ui/StickyHeader.vue'

/** Simula dónde está el encabezado en la pantalla y su alto (jsdom no hace diseño). */
function place(element: Element, top: number, height: number) {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    top,
    height,
    bottom: top + height,
  } as DOMRect)
}

async function scrollTo(y: number) {
  Object.defineProperty(window, 'scrollY', { configurable: true, value: y })
  window.dispatchEvent(new Event('scroll'))
  await flushPromises()
}

function host() {
  return defineComponent({
    setup(_, { expose }) {
      const sticky = ref<InstanceType<typeof StickyHeader> | null>(null)
      expose({ sticky })
      return () =>
        h(
          StickyHeader,
          { ref: sticky },
          {
            default: ({ stuck }: { stuck: boolean }) =>
              h('h1', { class: { compacto: stuck } }, 'Afiliados'),
          },
        )
    },
  })
}

beforeEach(() => {
  // Cada cuadro de animación se ejecuta apenas termina la tarea actual
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    queueMicrotask(() => callback(0))
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('Encabezado fijo', () => {
  it('se queda arriba al bajar, se achica sin mover el contenido y lo publica', async () => {
    const wrapper = mount(host(), { attachTo: document.body })
    const header = wrapper.get('.sticky-header').element as HTMLElement
    place(header, 80, 270)
    await scrollTo(0)
    expect(wrapper.find('.is-stuck').exists()).toBe(false)
    expect(
      document.documentElement.style.getPropertyValue('--sticky-header-bottom'),
    ).toBe('270px')

    // Al bajar queda pegado arriba; la vista lo achica y deja el margen que perdió
    place(header, 0, 270)
    await scrollTo(400)
    expect(wrapper.get('.sticky-header').classes()).toContain('is-stuck')
    expect(wrapper.get('h1').classes()).toContain('compacto')
    place(header, 0, 120)
    window.dispatchEvent(new Event('resize'))
    await flushPromises()
    expect(header.style.marginBottom).toBe('150px')
    expect(
      document.documentElement.style.getPropertyValue('--sticky-header-bottom'),
    ).toBe('120px')

    // Volver al inicio de la lista: justo bajo el encabezado achicado
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    ;(
      wrapper.vm as unknown as { sticky: { scrollToStart(): void } }
    ).sticky.scrollToStart()
    expect(scroll).toHaveBeenCalledWith({ top: 230 })

    // Al subir vuelve a su tamaño
    place(header, 80, 270)
    await scrollTo(0)
    expect(wrapper.find('.is-stuck').exists()).toBe(false)
    expect(header.style.marginBottom).toBe('')

    wrapper.unmount()
    expect(
      document.documentElement.style.getPropertyValue('--sticky-header-bottom'),
    ).toBe('')
  })

  it('apagado (ventana completa) es un encabezado común', async () => {
    const wrapper = mount(StickyHeader, {
      props: { disabled: true },
      slots: { default: '<h1>Afiliados</h1>' },
      attachTo: document.body,
    })
    const header = wrapper.get('.sticky-header').element as HTMLElement
    place(header, 0, 200)
    await scrollTo(500)

    expect(wrapper.get('.sticky-header').classes()).toEqual([
      'sticky-header',
      'is-disabled',
    ])
    expect(
      document.documentElement.style.getPropertyValue('--sticky-header-bottom'),
    ).toBe('')

    // Si la ventana pasa al tamaño del celular, vuelve a fijarse al bajar
    await wrapper.setProps({ disabled: false })
    await scrollTo(600)
    expect(wrapper.get('.sticky-header').classes()).toContain('is-stuck')
  })

  it('la tabla pasa a tarjetas solo si su propio ancho no alcanza', async () => {
    const width = vi
      .spyOn(Element.prototype, 'clientWidth', 'get')
      .mockReturnValue(600)
    const props = {
      columns: [{ key: 'id', label: 'Número' }],
      rows: [{ id: 1 }],
      rowKey: (row: { id: number }) => row.id,
      caption: 'Prueba',
    }

    const narrow = mount(DataTable<{ id: number }>, { props })
    const roomy = mount(DataTable<{ id: number }>, {
      props: { ...props, stackBelow: 520 },
    })

    await flushPromises()
    expect(narrow.get('.table-wrap').classes()).toContain('is-stacked')
    expect(roomy.get('.table-wrap').classes()).not.toContain('is-stacked')
    width.mockRestore()
  })

  it('sin estar fijo, «volver al inicio» no mueve la página', async () => {
    const wrapper = mount(host(), { attachTo: document.body })
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})

    ;(
      wrapper.vm as unknown as { sticky: { scrollToStart(): void } }
    ).sticky.scrollToStart()
    expect(scroll).not.toHaveBeenCalled()
  })

  it('la tabla puede dejar fijos los títulos de las columnas', () => {
    const wrapper = mount(DataTable<{ id: number }>, {
      props: {
        columns: [{ key: 'id', label: 'Número' }],
        rows: [{ id: 1 }],
        rowKey: (row) => row.id,
        caption: 'Prueba',
        stickyHead: true,
      },
    })

    expect(wrapper.get('.table-wrap').classes()).toContain('table-wrap--sticky')
  })
})
