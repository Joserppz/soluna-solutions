/**
 * El calendario propio (CalendarGrid) y el campo de fecha (DatePicker): el mismo en
 * filtros, formularios y Asistencia, en lugar del <input type="date"> de cada navegador.
 */
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import CalendarGrid from '../components/ui/CalendarGrid.vue'
import DatePicker from '../components/ui/DatePicker.vue'
import { settle } from './apiFake'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-26T16:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('CalendarGrid', () => {
  it('semana de lunes a domingo, hoy marcado y fuera de min/max apagado', () => {
    const wrapper = mount(CalendarGrid, {
      props: { value: '', min: '2026-11-10', max: '2026-11-26' },
    })
    expect(wrapper.findAll('.cal__weekday').map((d) => d.text())).toEqual([
      'L',
      'M',
      'M',
      'J',
      'V',
      'S',
      'D',
    ])
    // Noviembre de 2026 empieza en domingo: seis huecos antes del 1
    expect(wrapper.findAll('.cal__grid > *')[7 + 6]!.text()).toBe('1')
    const today = wrapper.get('[data-day="2026-11-26"]')
    expect(today.attributes('aria-current')).toBe('date')
    expect(today.attributes('aria-label')).toBe(
      'jueves 26 de noviembre de 2026',
    )
    expect(
      wrapper.get('[data-day="2026-11-09"]').attributes('disabled'),
    ).toBeDefined()
    expect(
      wrapper.get('[data-day="2026-11-27"]').attributes('disabled'),
    ).toBeDefined()
    expect(
      wrapper.get('[aria-label="Mes anterior"]').attributes('disabled'),
    ).toBe('')
  })

  it('las flechas mueven el foco por días y semanas, y cambian de mes', async () => {
    const wrapper = mount(CalendarGrid, {
      props: { value: '2026-11-30' },
      attachTo: document.body,
    })
    wrapper.vm.focusDay()
    await settle()
    expect(document.activeElement?.getAttribute('data-day')).toBe('2026-11-30')
    await wrapper.get('.cal__grid').trigger('keydown', { key: 'ArrowRight' })
    await settle()
    expect(document.activeElement?.getAttribute('data-day')).toBe('2026-12-01')
    expect(
      (wrapper.findAll('.cal__select')[0]!.element as HTMLSelectElement).value,
    ).toBe('11')
    await wrapper.get('.cal__grid').trigger('keydown', { key: 'PageUp' })
    await settle()
    expect(document.activeElement?.getAttribute('data-day')).toBe('2026-11-01')
    await wrapper.get('.cal__grid').trigger('keydown', { key: 'End' })
    await settle()
    expect(document.activeElement?.getAttribute('data-day')).toBe('2026-11-01')
    await wrapper.get('.cal__grid').trigger('keydown', { key: 'ArrowUp' })
    await settle()
    expect(document.activeElement?.getAttribute('data-day')).toBe('2026-10-25')
    wrapper.unmount()
  })

  it('los días marcados llevan un punto', () => {
    const wrapper = mount(CalendarGrid, {
      props: { value: '', marked: ['2026-11-14'] },
    })
    expect(wrapper.get('[data-day="2026-11-14"]').classes()).toContain(
      'is-marked',
    )
    expect(wrapper.get('[data-day="2026-11-13"]').classes()).not.toContain(
      'is-marked',
    )
  })
})

describe('DatePicker', () => {
  function mountPicker(props: Record<string, unknown> = {}) {
    return mount(DatePicker, {
      props: { modelValue: '', ...props },
      attachTo: document.body,
    })
  }

  function panel() {
    return document.body.querySelector<HTMLElement>('.date-panel')
  }

  it('sin fecha muestra el texto de ayuda y abre el calendario en hoy', async () => {
    const wrapper = mountPicker({ ariaLabel: 'Fecha de nacimiento' })
    const trigger = wrapper.get('button')
    expect(trigger.text()).toBe('Elegir fecha')
    expect(trigger.attributes('aria-label')).toBe(
      'Fecha de nacimiento: Elegir fecha',
    )
    await trigger.trigger('click')
    await settle()
    expect(trigger.attributes('aria-expanded')).toBe('true')
    expect(document.activeElement?.getAttribute('data-day')).toBe('2026-11-26')
    wrapper.unmount()
  })

  it('elegir un día lo emite y cierra; «Hoy» y «Borrar»', async () => {
    const wrapper = mountPicker({ clearable: true, modelValue: '2026-11-02' })
    expect(wrapper.text()).toBe('02/11/2026')

    await wrapper.get('button').trigger('click')
    await settle()
    panel()!
      .querySelector<HTMLButtonElement>('[data-day="2026-11-05"]')!
      .click()
    await settle()
    expect(wrapper.emitted('update:modelValue')![0]).toEqual(['2026-11-05'])
    expect(panel()).toBeNull()
    expect(document.activeElement).toBe(wrapper.get('button').element)

    await wrapper.get('button').trigger('click')
    await settle()
    const links = [
      ...panel()!.querySelectorAll<HTMLButtonElement>('.date-panel__link'),
    ]
    expect(links.map((b) => b.textContent?.trim())).toEqual(['Borrar', 'Hoy'])
    links[0]!.click()
    await settle()
    expect(wrapper.emitted('update:modelValue')![1]).toEqual([''])
    wrapper.unmount()
  })

  it('formato largo; sin «Hoy» si hoy no se permite; Esc cierra', async () => {
    const wrapper = mountPicker({
      modelValue: '2026-11-28',
      format: 'long',
      min: '2026-11-27',
    })
    expect(wrapper.text()).toBe('Sábado, 28 de noviembre de 2026')
    await wrapper.get('button').trigger('click')
    await settle()
    expect(panel()!.textContent).not.toContain('Hoy')
    panel()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await settle()
    expect(panel()).toBeNull()
    wrapper.unmount()
  })

  it('deshabilitado no se abre', async () => {
    const wrapper = mountPicker({ disabled: true })
    await wrapper.get('button').trigger('click')
    await settle()
    expect(panel()).toBeNull()
    wrapper.unmount()
  })
})
