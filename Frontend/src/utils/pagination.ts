/** Números de página a mostrar: «1 2 3 … 14». «gap» es un salto (…). */
export type PageItem = number | 'gap'

export function pageItems(current: number, totalPages: number): PageItem[] {
  if (totalPages <= 7)
    return Array.from({ length: totalPages }, (_, index) => index + 1)

  const pages = new Set([1, totalPages, current - 1, current, current + 1])
  if (current <= 3) [2, 3].forEach((page) => pages.add(page))
  if (current >= totalPages - 2)
    [totalPages - 1, totalPages - 2].forEach((page) => pages.add(page))

  const sorted = [...pages]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b)
  const items: PageItem[] = []
  sorted.forEach((page, index) => {
    const previous = sorted[index - 1]
    if (previous !== undefined && page - previous === 2) items.push(page - 1)
    else if (previous !== undefined && page - previous > 2) items.push('gap')
    items.push(page)
  })
  return items
}

/** «Mostrando 11–20 de 95» */
export function rangeLabel(offset: number, count: number, total: number) {
  if (total === 0 || count === 0) return 'Sin resultados'
  return `Mostrando ${offset + 1}–${offset + count} de ${total}`
}
