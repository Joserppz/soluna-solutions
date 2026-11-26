type Field = { trigger(event: string): Promise<void> }

import { addDays } from '../utils/dateRange'
import { todayIso } from '../utils/format'
import { settle } from './apiFake'
import { clickDay } from './reports'

/** El calendario del campo de fecha (DatePicker) va en <body>. */
function openPanel(): HTMLElement {
  const panel = document.body.querySelector<HTMLElement>('.date-panel')
  if (!panel) throw new Error('El calendario no está abierto')
  return panel
}

/** Elige `day` en un campo de fecha; '' lo deja vacío con «Borrar». */
export async function setDate(field: Field, day: string) {
  await field.trigger('click')
  await settle()
  const panel = openPanel()
  if (!day) {
    const clear = [...panel.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Borrar',
    )
    if (!clear) throw new Error('Este campo de fecha no se puede borrar')
    clear.click()
    await settle()
    return
  }
  await clickDay(panel, day)
}

/** En el calendario del campo, los días después de hoy no se pueden elegir. */
export async function futureIsBlocked(field: Field): Promise<boolean> {
  await field.trigger('click')
  await settle()
  const panel = openPanel()
  const tomorrow = addDays(todayIso(), 1)
  const [month, year] =
    panel.querySelectorAll<HTMLSelectElement>('.cal__select')
  year!.value = String(Number(tomorrow.slice(0, 4)))
  year!.dispatchEvent(new Event('change'))
  month!.value = String(Number(tomorrow.slice(5, 7)) - 1)
  month!.dispatchEvent(new Event('change'))
  await settle()
  const blocked =
    panel.querySelector<HTMLButtonElement>(`[data-day="${tomorrow}"]`)
      ?.disabled ?? false
  panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
  await settle()
  return blocked
}
