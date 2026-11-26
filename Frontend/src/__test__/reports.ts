import type { DOMWrapper, VueWrapper } from '@vue/test-utils'

import { settle } from './apiFake'

type Root = VueWrapper | DOMWrapper<Element>

/** Abre «Descargar» (el primero, o el de `what`) y elige Excel o CSV. */
export async function downloadAs(
  root: Root,
  format: 'Excel' | 'CSV',
  what?: string,
) {
  const menus = root.findAll('.export')
  const menu = what
    ? menus.find((m) => m.get('.export__trigger').text().includes(what))
    : menus[0]
  if (!menu) throw new Error(`No hay un botón «Descargar» ${what ?? ''}`)
  await menu.get('.export__trigger').trigger('click')
  await settle()
  const option = menu
    .findAll('.export__option')
    .find((button) => button.get('strong').text() === format)
  if (!option) throw new Error(`No hay la opción ${format}`)
  await option.trigger('click')
  await settle()
}
