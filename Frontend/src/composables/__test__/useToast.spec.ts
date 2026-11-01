import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import ToastHost from '../../components/ui/ToastHost.vue'
import { useToast } from '../useToast'

describe('Notificaciones (toasts)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useToast().clear()
  })

  afterEach(() => {
    useToast().clear()
    vi.useRealTimers()
  })

  it('se muestran y se cierran solas', () => {
    const toast = useToast()

    toast.success('Cambios guardados')
    expect(toast.toasts.value.map((t) => t.message)).toEqual([
      'Cambios guardados',
    ])

    vi.advanceTimersByTime(4000)
    expect(toast.toasts.value).toEqual([])
  })

  it('los errores duran más y se pueden cerrar a mano', () => {
    const toast = useToast()
    const id = toast.error('No se pudo guardar')

    vi.advanceTimersByTime(5000)
    expect(toast.toasts.value).toHaveLength(1)

    toast.dismiss(id)
    expect(toast.toasts.value).toEqual([])
  })

  it('muestra como máximo cuatro a la vez', () => {
    const toast = useToast()
    for (const n of [1, 2, 3, 4, 5]) toast.info(`Aviso ${n}`, 0)

    expect(toast.toasts.value.map((t) => t.message)).toEqual([
      'Aviso 2',
      'Aviso 3',
      'Aviso 4',
      'Aviso 5',
    ])
  })

  it('los errores se anuncian de inmediato y el resto con calma', async () => {
    const wrapper = mount(ToastHost)
    const toast = useToast()

    toast.error('Sin conexión')
    toast.success('Guardado')
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[role="alert"]').text()).toContain('Sin conexión')
    expect(wrapper.get('[role="status"]').text()).toContain('Guardado')

    await wrapper.get('[role="status"] button').trigger('click')
    expect(toast.toasts.value.map((t) => t.message)).toEqual(['Sin conexión'])
  })
})
