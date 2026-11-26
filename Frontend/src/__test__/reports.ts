import type { DOMWrapper } from '@vue/test-utils'

import { settle } from './apiFake'

type Root = { findAll(selector: string): DOMWrapper<Element>[] }

/** El panel de «Descargar» va en <body>: se busca ahí, no dentro de la pantalla. */
export function exportPanel(): HTMLElement {
  const panel = document.body.querySelector<HTMLElement>('.export__panel')
  if (!panel) throw new Error('El menú «Descargar» no está abierto')
  return panel
}

/** Abre «Descargar» (el primero, o el de `what`) y elige Excel o CSV de la opción `item`. */
export async function downloadAs(
  root: Root,
  format: 'Excel' | 'CSV',
  what?: string,
  item?: string,
) {
  const triggers = root.findAll('.export__trigger')
  const trigger = what
    ? triggers.find((t) => t.attributes('aria-label')?.includes(what))
    : triggers[0]
  if (!trigger) throw new Error(`No hay un botón «Descargar» ${what ?? ''}`)
  if (trigger.attributes('aria-expanded') !== 'true') {
    await trigger.trigger('click')
    await settle()
  }
  const sections = [...exportPanel().querySelectorAll('.export__item')]
  const section = item
    ? sections.find((s) => s.getAttribute('aria-label') === item)
    : sections[0]
  if (!section) throw new Error(`No hay la opción «${item}»`)
  const option = [
    ...section.querySelectorAll<HTMLButtonElement>('.export__option'),
  ].find((button) => button.textContent?.trim() === format)
  if (!option) throw new Error(`No hay el formato ${format}`)
  option.click()
  await settle()
}

/** Lleva el calendario (CalendarGrid) dentro de `panel` al mes de `day` y lo elige. */
export async function clickDay(panel: Element, day: string) {
  const [month, year] =
    panel.querySelectorAll<HTMLSelectElement>('.cal__select')
  year!.value = String(Number(day.slice(0, 4)))
  year!.dispatchEvent(new Event('change'))
  month!.value = String(Number(day.slice(5, 7)) - 1)
  month!.dispatchEvent(new Event('change'))
  await settle()
  const button = panel.querySelector<HTMLButtonElement>(`[data-day="${day}"]`)
  if (!button) throw new Error(`No está el día ${day} en el calendario`)
  button.click()
  await settle()
}

/** Elige un rango en el calendario de `panel`: primer clic «desde», segundo «hasta». */
export async function pickRange(panel: Element, from: string, to: string) {
  await clickDay(panel, from)
  await clickDay(panel, to)
}
