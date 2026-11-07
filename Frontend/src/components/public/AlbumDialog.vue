<script setup lang="ts">
import { ref, watch } from 'vue'

import type { PublicAlbum, PublicAlbumSummary } from '../../api/types'
import { useApi } from '../../composables/useApi'
import AppAlert from '../ui/AppAlert.vue'
import AppModal from '../ui/AppModal.vue'
import SkeletonBlock from '../ui/SkeletonBlock.vue'

/** Las fotos y videos de un álbum publicado (`GET /public/media/albums/{id}`). */
const props = defineProps<{
  open: boolean
  album: PublicAlbumSummary | null
}>()

const emit = defineEmits<{ 'update:open': [open: boolean] }>()

const { api } = useApi()
const detail = ref<PublicAlbum | null>(null)
const failed = ref(false)

watch(
  () => [props.open, props.album?.id] as const,
  async ([open, id]) => {
    if (!open || !id) return
    detail.value = null
    failed.value = false
    try {
      detail.value = await api.public.album(id)
    } catch {
      failed.value = true
    }
  },
  { immediate: true },
)

/** Si una imagen no carga, queda el fondo y no el ícono roto. */
function hideBroken(event: Event) {
  ;(event.target as HTMLElement).style.visibility = 'hidden'
}
</script>

<template>
  <AppModal
    :open="open"
    :title="album?.title ?? 'Álbum'"
    :description="album?.description || undefined"
    size="lg"
    @update:open="emit('update:open', $event)"
  >
    <AppAlert v-if="failed" tone="warning">
      No pudimos abrir este álbum. Inténtalo de nuevo en un momento.
    </AppAlert>
    <div v-else-if="!detail" class="grid" aria-busy="true">
      <SkeletonBlock v-for="n in 6" :key="n" height="8rem" />
    </div>
    <ul v-else class="grid" aria-label="Fotos y videos del álbum">
      <li v-for="asset in detail.assets" :key="asset.id" class="item">
        <video
          v-if="asset.kind === 'video'"
          :src="asset.url"
          :poster="asset.thumbnailUrl ?? undefined"
          controls
          preload="none"
        />
        <a v-else :href="asset.url" target="_blank" rel="noopener">
          <img
            :src="asset.thumbnailUrl ?? asset.url"
            :alt="`Foto del álbum «${detail.title}»`"
            loading="lazy"
            @error="hideBroken"
          />
        </a>
      </li>
    </ul>
    <p class="note">
      Solo publicamos imágenes de quienes nos dieron su permiso.
    </p>
  </AppModal>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.item {
  overflow: hidden;
  aspect-ratio: 4 / 3;
  border-radius: var(--radius-md);
  background: var(--color-surface-sunken);
}

.item a,
.item img,
.item video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.note {
  margin: var(--space-4) 0 0;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
</style>
