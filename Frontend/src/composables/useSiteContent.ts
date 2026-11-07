import { computed, ref } from 'vue'

import { contentByKey, type SiteContent } from '../utils/site'
import { useApi } from './useApi'

/**
 * Lo publicado en «Contenido del sitio» (`GET /public/content`). Se pide una sola vez y
 * lo comparten el encabezado, el pie y cada página. Si la API no responde, el sitio
 * muestra sus textos de respaldo.
 */
const sections = ref<SiteContent>({})
const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
let pending: Promise<void> | null = null

export function useSiteContent() {
  const { api } = useApi()

  function load(): Promise<void> {
    if (status.value === 'ready') return Promise.resolve()
    if (pending) return pending
    status.value = 'loading'
    pending = api.public
      .content()
      .then((list) => {
        sections.value = contentByKey(list)
        status.value = 'ready'
      })
      .catch(() => {
        status.value = 'error'
      })
      .finally(() => {
        pending = null
      })
    return pending
  }

  return {
    content: computed(() => sections.value),
    ready: computed(() => status.value === 'ready' || status.value === 'error'),
    load,
  }
}

/** Solo para las pruebas: vuelve a pedir el contenido en el próximo montaje. */
export function resetSiteContent() {
  sections.value = {}
  status.value = 'idle'
  pending = null
}
