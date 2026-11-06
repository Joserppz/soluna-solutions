<script setup lang="ts">
/**
 * El álbum elegido (diseño pág. 13): sus fotos, el aviso si alguien sin permiso de imagen
 * aparece, la descripción y la publicación. Publicar pide marcar «Revisé que todas las
 * personas que se reconocen dieron su permiso» y que no quede ningún aviso.
 */
import { computed, ref, watch } from 'vue'

import { isApiError } from '../../api/errors'
import type { AlbumOut, AssetOut } from '../../api/types'
import { useApi } from '../../composables/useApi'
import { useToast } from '../../composables/useToast'
import { assetCountLabel } from '../../utils/media'
import AppAlert from '../ui/AppAlert.vue'
import AppButton from '../ui/AppButton.vue'
import AppModal from '../ui/AppModal.vue'
import TagDialog from './TagDialog.vue'

/** En la ventana completa se ven dos filas de fotos; «Ver todas» muestra el resto. */
const PREVIEW_COUNT = 6

const props = defineProps<{ album: AlbumOut; canSearch: boolean }>()
const emit = defineEmits<{
  changed: [album: AlbumOut]
  deleted: [albumId: string]
  close: []
}>()

const { api } = useApi()
const toast = useToast()

const description = ref('')
const reviewed = ref(false)
const showAll = ref(false)
const publishing = ref(false)
const error = ref<string | null>(null)
const tagging = ref<AssetOut | null>(null)
const tagOpen = ref(false)
const removing = ref<AssetOut | null>(null)
const removeBusy = ref(false)
const deleteOpen = ref(false)
const deleting = ref(false)

watch(
  () => props.album.id,
  () => {
    description.value = props.album.description
    reviewed.value = false
    showAll.value = false
    error.value = null
  },
  { immediate: true },
)

const published = computed(() => props.album.visibility === 'publico')
const blocked = computed(
  () => new Set(props.album.warnings.map((w) => w.assetId)),
)
const warningPhotos = computed(() => blocked.value.size)
const shownAssets = computed(() =>
  showAll.value
    ? props.album.assets
    : props.album.assets.slice(0, PREVIEW_COUNT),
)
const hiddenCount = computed(
  () => props.album.assets.length - shownAssets.value.length,
)
const counts = computed(() =>
  assetCountLabel(
    props.album.assets.filter((a) => a.kind === 'imagen').length,
    props.album.assets.filter((a) => a.kind === 'video').length,
  ),
)

/** Por qué todavía no se puede publicar (o null). */
const publishBlock = computed(() => {
  if (!props.album.assets.length) return 'Sube fotos o videos para publicarlo.'
  if (warningPhotos.value)
    return 'Primero quita o tapa a quien no tiene permiso de imagen.'
  if (!reviewed.value) return 'Se habilita cuando confirmes los permisos.'
  return null
})

function openTags(asset: AssetOut) {
  tagging.value = asset
  tagOpen.value = true
}

async function refresh() {
  emit('changed', await api.media.album(props.album.id))
}

async function onTagged() {
  toast.success('Guardamos las personas de la foto.')
  await refresh()
}

async function saveDescription() {
  const value = description.value.trim()
  if (value === props.album.description) return
  try {
    emit(
      'changed',
      await api.media.updateAlbum(props.album.id, { description: value }),
    )
    toast.success('Guardamos la descripción.')
  } catch (failure) {
    toast.error(
      isApiError(failure)
        ? failure.message
        : 'No pudimos guardar la descripción.',
    )
  }
}

async function publish() {
  if (publishBlock.value) return
  publishing.value = true
  error.value = null
  try {
    const saved = await api.media.publish(props.album.id, {
      permissionsReviewed: true,
    })
    toast.success(`Publicamos «${saved.title}». Ya se ve en el sitio.`)
    emit('changed', saved)
  } catch (failure) {
    error.value = isApiError(failure)
      ? failure.message
      : 'No pudimos publicar el álbum. Intenta de nuevo.'
  } finally {
    publishing.value = false
  }
}

async function unpublish() {
  publishing.value = true
  error.value = null
  try {
    const saved = await api.media.unpublish(props.album.id)
    toast.success(`Quitamos «${saved.title}» del sitio. Queda privado.`)
    emit('changed', saved)
  } catch (failure) {
    error.value = isApiError(failure)
      ? failure.message
      : 'No pudimos quitar el álbum del sitio.'
  } finally {
    publishing.value = false
  }
}

function askRemove(asset: AssetOut) {
  tagOpen.value = false
  removing.value = asset
}

async function removeAsset() {
  if (!removing.value) return
  removeBusy.value = true
  try {
    await api.media.removeAsset(removing.value.id)
    removing.value = null
    toast.success('Quitamos la foto del álbum.')
    await refresh()
  } catch (failure) {
    toast.error(
      isApiError(failure) ? failure.message : 'No pudimos quitar la foto.',
    )
  } finally {
    removeBusy.value = false
  }
}

async function deleteAlbum() {
  deleting.value = true
  try {
    await api.media.deleteAlbum(props.album.id)
    deleteOpen.value = false
    toast.success(`Eliminamos el álbum «${props.album.title}».`)
    emit('deleted', props.album.id)
  } catch (failure) {
    toast.error(
      isApiError(failure) ? failure.message : 'No pudimos eliminar el álbum.',
    )
  } finally {
    deleting.value = false
  }
}

/** Si una imagen no carga (sin conexión con Cloudinary), queda el fondo y no el ícono roto. */
function hideBroken(event: Event) {
  ;(event.target as HTMLImageElement).style.visibility = 'hidden'
}
</script>

<template>
  <section class="album surface-card" aria-labelledby="album-titulo">
    <header class="album__head">
      <div>
        <p class="album__eyebrow">
          {{ published ? 'Publicado' : 'Revisando' }}
        </p>
        <h2 id="album-titulo">{{ album.title }}</h2>
        <p class="album__count">{{ counts }}</p>
      </div>
      <button
        type="button"
        class="album__close"
        aria-label="Cerrar el álbum"
        @click="emit('close')"
      >
        ×
      </button>
    </header>

    <ul v-if="album.assets.length" class="thumbs" aria-label="Fotos y videos">
      <li v-for="asset in shownAssets" :key="asset.id">
        <button
          type="button"
          class="thumb"
          :class="{ 'is-blocked': blocked.has(asset.id) }"
          :aria-label="`${asset.kind === 'video' ? 'Video' : 'Foto'}${
            asset.tags.length ? ` con ${asset.tags.length} persona(s)` : ''
          }${blocked.has(asset.id) ? ', alguien sin permiso de imagen' : ''}. Etiquetar o quitar`"
          @click="openTags(asset)"
        >
          <img
            :src="asset.thumbnailUrl ?? asset.url"
            alt=""
            loading="lazy"
            @error="hideBroken"
          />
          <span
            v-if="asset.kind === 'video'"
            class="thumb__video"
            aria-hidden="true"
            >▶</span
          >
          <span
            v-if="asset.tags.length"
            class="thumb__tags"
            aria-hidden="true"
            >{{ asset.tags.length }}</span
          >
        </button>
      </li>
      <li v-if="hiddenCount > 0">
        <button type="button" class="thumb thumb--more" @click="showAll = true">
          +{{ hiddenCount }}
        </button>
      </li>
    </ul>
    <p v-else class="muted">
      Todavía no hay fotos. Arrástralas a la caja de subida o elige los
      archivos.
    </p>

    <AppAlert v-if="warningPhotos" tone="error">
      En {{ warningPhotos }}
      {{ warningPhotos === 1 ? 'foto' : 'fotos' }} aparece una persona sin
      permiso de imagen en su ficha. Quítala o tápale el rostro antes de
      publicar.
    </AppAlert>
    <AppAlert v-if="error" tone="error">{{ error }}</AppAlert>

    <div class="field-like">
      <label for="album-descripcion">Descripción</label>
      <textarea
        id="album-descripcion"
        v-model="description"
        class="textarea"
        rows="2"
        maxlength="500"
        @blur="saveDescription"
      />
    </div>

    <template v-if="!published">
      <label class="review">
        <input v-model="reviewed" type="checkbox" />
        <span
          >Revisé que todas las personas que se reconocen dieron su
          permiso.</span
        >
      </label>
      <AppButton
        block
        :disabled="publishBlock !== null || publishing"
        :loading="publishing"
        loading-label="Publicando…"
        @click="publish"
      >
        Publicar en el sitio
      </AppButton>
      <p v-if="publishBlock" class="hint">{{ publishBlock }}</p>
      <button type="button" class="link" @click="deleteOpen = true">
        Eliminar el álbum…
      </button>
    </template>
    <template v-else>
      <p class="hint">
        Si cambian las fotos o las personas etiquetadas, vuelve a revisión.
      </p>
      <AppButton
        variant="secondary"
        block
        :loading="publishing"
        loading-label="Quitando…"
        @click="unpublish"
      >
        Quitar del sitio
      </AppButton>
    </template>

    <p class="privacy">
      La galería nunca guarda carnets, certificados ni evaluaciones. Eso vive
      solo en las fichas.
    </p>

    <TagDialog
      v-model:open="tagOpen"
      :asset="tagging"
      :can-search="canSearch"
      @updated="onTagged"
      @remove="askRemove"
    />
    <AppModal
      :open="removing !== null"
      size="sm"
      title="Quitar la foto del álbum"
      description="También se borra de Cloudinary. No se puede deshacer."
      :dismissible="!removeBusy"
      @update:open="!$event && (removing = null)"
    >
      <img
        v-if="removing"
        class="remove__photo"
        :src="removing.thumbnailUrl ?? removing.url"
        alt="La foto que se va a quitar"
        @error="hideBroken"
      />
      <template #actions>
        <AppButton
          variant="secondary"
          :disabled="removeBusy"
          @click="removing = null"
          >Volver</AppButton
        >
        <AppButton
          variant="danger"
          :loading="removeBusy"
          loading-label="Quitando…"
          @click="removeAsset"
          >Quitar la foto</AppButton
        >
      </template>
    </AppModal>
    <AppModal
      v-model:open="deleteOpen"
      size="sm"
      title="Eliminar el álbum"
      description="Se borran el álbum y sus fotos, también de Cloudinary. No se puede deshacer."
      :dismissible="!deleting"
    >
      <template #actions>
        <AppButton
          variant="secondary"
          :disabled="deleting"
          @click="deleteOpen = false"
          >Volver</AppButton
        >
        <AppButton
          variant="danger"
          :loading="deleting"
          loading-label="Eliminando…"
          @click="deleteAlbum"
          >Eliminar el álbum</AppButton
        >
      </template>
    </AppModal>
  </section>
</template>

<style scoped>
.album {
  display: grid;
  align-content: start;
  gap: var(--space-3);
  min-width: 0;
  padding: var(--space-5);
}

.album__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
}

.album__eyebrow {
  color: var(--aspar-rojo);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.album__head h2 {
  font-family: var(--font-serif);
  font-size: var(--text-xl);
  font-weight: 500;
}

.album__count,
.muted,
.hint {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.hint {
  text-align: center;
}

.album__close {
  width: 2rem;
  height: 2rem;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  font-size: var(--text-xl);
  line-height: 1;
  cursor: pointer;
}

.thumbs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.thumb {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 4 / 3;
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: var(--radius-sm);
  background: var(--color-surface-sunken);
  cursor: pointer;
}

.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumb.is-blocked {
  box-shadow: 0 0 0 3px var(--aspar-rojo);
}

.thumb:focus-visible {
  box-shadow: var(--focus-ring);
}

.thumb__video,
.thumb__tags {
  position: absolute;
  display: grid;
  place-items: center;
  min-width: 1.4rem;
  height: 1.4rem;
  padding: 0 0.3rem;
  border-radius: var(--radius-pill);
  background: rgb(0 0 0 / 0.6);
  color: #fff;
  font-size: var(--text-xs);
  font-weight: 700;
}

.thumb__video {
  top: 0.3rem;
  left: 0.3rem;
}

.thumb__tags {
  right: 0.3rem;
  bottom: 0.3rem;
}

.thumb--more {
  display: grid;
  place-items: center;
  color: var(--color-text);
  font-weight: 700;
}

.field-like {
  display: grid;
  gap: var(--space-1);
}

.field-like label {
  font-size: var(--text-sm);
  font-weight: 600;
}

.review {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  font-size: var(--text-sm);
  cursor: pointer;
}

.review input {
  margin-top: 0.2rem;
}

.link {
  justify-self: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-link);
  font: inherit;
  font-size: var(--text-sm);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 0.25em;
  cursor: pointer;
}

.privacy {
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-surface-sunken);
  color: var(--color-text-muted);
  font-size: var(--text-xs);
}

.remove__photo {
  width: 100%;
  max-height: 14rem;
  object-fit: cover;
  border-radius: var(--radius-md);
}

/* Ventanas bajas: más junto, para que el panel entre sin desplazarse */
@media (max-height: 820px) {
  .album {
    gap: var(--space-2);
    padding: var(--space-4);
  }

  .privacy {
    display: none;
  }

  .album :deep(.textarea) {
    height: 4.75rem;
    min-height: 0;
    resize: none;
  }

  .album :deep(.alert) {
    padding-block: var(--space-2);
    font-size: var(--text-sm);
  }

  .album__head h2 {
    font-size: var(--text-lg);
  }
}

@media (max-height: 760px) {
  .album {
    gap: 0.4rem;
    padding-block: var(--space-3);
  }

  .hint {
    font-size: var(--text-xs);
  }
}
</style>
