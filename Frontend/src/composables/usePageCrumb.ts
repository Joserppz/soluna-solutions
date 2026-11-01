/**
 * Última miga de pan con un dato que solo conoce la vista (por ejemplo, el nombre del
 * afiliado en su ficha: «Espacio del equipo / Afiliados / Alba Gutiérrez»).
 */
import { onBeforeUnmount, readonly, ref } from 'vue'

const crumb = ref<string | null>(null)

export function usePageCrumb() {
  onBeforeUnmount(() => {
    crumb.value = null
  })
  return {
    set(text: string | null) {
      crumb.value = text
    },
  }
}

/** Lo lee el layout del equipo. */
export const pageCrumb = readonly(crumb)
