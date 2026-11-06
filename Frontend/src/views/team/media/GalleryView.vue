<script setup lang="ts">
/**
 * Galería (diseño pág. 13): los álbumes (Todos, Publicados, Privados), la subida a
 * Cloudinary del álbum elegido y su revisión. Las fotos se suben directo a Cloudinary con
 * la firma de la API; publicar pide revisar los permisos de imagen de quien aparece.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { isApiError } from '../../../api/errors'
import type {
  AlbumOut,
  AlbumSummary,
  UploadSignature,
} from '../../../api/types'
import AlbumPanel from '../../../components/media/AlbumPanel.vue'
import NewAlbumDialog from '../../../components/media/NewAlbumDialog.vue'
import AppAlert from '../../../components/ui/AppAlert.vue'
import AppButton from '../../../components/ui/AppButton.vue'
import AppTabs, { type TabItem } from '../../../components/ui/AppTabs.vue'
import PageHeader from '../../../components/ui/PageHeader.vue'
import SkeletonBlock from '../../../components/ui/SkeletonBlock.vue'
import StatusBadge from '../../../components/ui/StatusBadge.vue'
import { useApi } from '../../../composables/useApi'
import { useFitLayout } from '../../../composables/useFitLayout'
import { useToast } from '../../../composables/useToast'
import {
  ACCEPT_ATTRIBUTE,
  MAX_FILES,
  UploadError,
  fileProblem,
  uploadToCloudinary,
} from '../../../utils/media'

type Tab = 'todos' | 'publico' | 'privado'
const TABS: TabItem<Tab>[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'publico', label: 'Publicados' },
  { key: 'privado', label: 'Privados' },
]

const { api, session } = useApi()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const fit = useFitLayout()
const canSearch = computed(() => session.can('patients:read'))

const tab = ref<Tab>(
  ['publico', 'privado'].includes(String(route.query.ver))
    ? (route.query.ver as Tab)
    : 'todos',
)
const albums = ref<AlbumSummary[]>([])
const loading = ref(true)
const loadError = ref<string | null>(null)
const selected = ref<AlbumOut | null>(null)
const selectedId = ref<string | null>(
  typeof route.query.album === 'string' ? route.query.album : null,
)
const newOpen = ref(false)

/* Subida */
const fileInput = ref<HTMLInputElement | null>(null)
const dragging = ref(false)
const uploading = ref(false)
const uploadTotal = ref(0)
const uploadDone = ref(0)
const uploadProblems = ref<string[]>([])
/** Si la API responde que Cloudinary no está configurado, se dice y no se ofrece subir. */
const uploadUnavailable = ref<string | null>(null)
const progress = computed(() =>
  uploadTotal.value
    ? Math.round((uploadDone.value / uploadTotal.value) * 100)
    : 0,
)

function syncQuery() {
  const query: Record<string, string> = {}
  if (tab.value !== 'todos') query.ver = tab.value
  if (selectedId.value) query.album = selectedId.value
  void router.replace({ query })
}

let request = 0
async function loadAlbums() {
  const current = ++request
  loading.value = true
  loadError.value = null
  try {
    const list = await api.media.albums(
      tab.value === 'todos' ? undefined : tab.value,
    )
    if (current === request) albums.value = list
  } catch (failure) {
    if (current !== request) return
    loadError.value = isApiError(failure)
      ? failure.message
      : 'No pudimos cargar los álbumes. Intenta de nuevo.'
  } finally {
    if (current === request) loading.value = false
  }
}

async function openAlbum(albumId: string) {
  selectedId.value = albumId
  syncQuery()
  try {
    const album = await api.media.album(albumId)
    if (selectedId.value === albumId) selected.value = album
  } catch (failure) {
    if (selectedId.value !== albumId) return
    selectedId.value = null
    selected.value = null
    syncQuery()
    toast.error(
      isApiError(failure) ? failure.message : 'No pudimos abrir el álbum.',
    )
  }
}

function closeAlbum() {
  selectedId.value = null
  selected.value = null
  uploadProblems.value = []
  syncQuery()
}

watch(tab, () => {
  syncQuery()
  void loadAlbums()
})

/** El álbum cambió (fotos, etiquetas, descripción o publicación): panel y lista. */
function onChanged(album: AlbumOut) {
  selected.value = album
  void loadAlbums()
}

function onDeleted(albumId: string) {
  albums.value = albums.value.filter((album) => album.id !== albumId)
  closeAlbum()
}

function onCreated(album: AlbumOut) {
  toast.success(`Creamos el álbum «${album.title}». Ya puedes subir fotos.`)
  selected.value = album
  selectedId.value = album.id
  if (tab.value === 'publico') tab.value = 'todos'
  else void loadAlbums()
  syncQuery()
}

function statusOf(album: AlbumSummary): {
  label: string
  tone: 'success' | 'warning' | 'neutral'
} {
  if (album.visibility === 'publico')
    return { label: 'Publicado', tone: 'success' }
  if (album.assetCount) return { label: 'En revisión', tone: 'warning' }
  return { label: 'Sin fotos', tone: 'neutral' }
}

function countLabel(count: number) {
  return `${count} ${count === 1 ? 'archivo' : 'archivos'}`
}

function chooseFiles() {
  fileInput.value?.click()
}

function onPicked(event: Event) {
  const input = event.target as HTMLInputElement
  void upload(Array.from(input.files ?? []))
  input.value = ''
}

function onDrop(event: DragEvent) {
  dragging.value = false
  void upload(Array.from(event.dataTransfer?.files ?? []))
}

async function upload(files: File[]) {
  const album = selected.value
  if (!album || uploading.value || !files.length) return
  uploadProblems.value = []
  if (files.length > MAX_FILES) {
    uploadProblems.value = [
      `Elegiste ${files.length} archivos: sube hasta ${MAX_FILES} por vez.`,
    ]
    return
  }
  const valid = files.filter((file) => {
    const problem = fileProblem(file)
    if (problem) uploadProblems.value.push(problem)
    return !problem
  })
  if (!valid.length) return

  let signed: UploadSignature
  try {
    signed = await api.media.uploadSignature(album.id)
  } catch (failure) {
    if (isApiError(failure) && failure.status === 503)
      uploadUnavailable.value = failure.message
    else
      uploadProblems.value.push(
        isApiError(failure)
          ? failure.message
          : 'No pudimos preparar la subida. Intenta de nuevo.',
      )
    return
  }

  uploading.value = true
  uploadTotal.value = valid.length
  uploadDone.value = 0
  let added = 0
  for (const file of valid) {
    try {
      const asset = await uploadToCloudinary(file, signed)
      await api.media.addAsset(album.id, asset)
      added += 1
    } catch (failure) {
      uploadProblems.value.push(
        failure instanceof UploadError
          ? failure.message
          : isApiError(failure)
            ? `«${file.name}»: ${failure.message}`
            : `No pudimos registrar «${file.name}».`,
      )
    } finally {
      uploadDone.value += 1
    }
  }
  uploading.value = false
  if (added)
    toast.success(
      added === 1
        ? `Subimos 1 archivo a «${album.title}».`
        : `Subimos ${added} archivos a «${album.title}».`,
    )
  if (selectedId.value === album.id) await openAlbum(album.id)
  void loadAlbums()
}

onMounted(async () => {
  await loadAlbums()
  if (selectedId.value) await openAlbum(selectedId.value)
})

/** Si una imagen no carga (sin conexión con Cloudinary), queda el fondo y no el ícono roto. */
function hideBroken(event: Event) {
  ;(event.target as HTMLImageElement).style.visibility = 'hidden'
}
</script>

<template>
  <div class="gal" :class="{ 'gal--fit': fit }">
    <PageHeader
      title="Galería"
      subtitle="Fotos y videos de los encuentros. Solo se publica lo que tiene permiso."
    >
      <template #actions>
        <AppButton size="lg" @click="newOpen = true">+ Nuevo álbum</AppButton>
      </template>
    </PageHeader>

    <div class="gal__body">
      <div class="gal__main">
        <section class="card upload" aria-labelledby="subida-titulo">
          <h2 id="subida-titulo" class="visually-hidden">
            Subir fotos y videos
          </h2>
          <AppAlert v-if="uploadUnavailable" tone="warning">
            {{ uploadUnavailable }} Pide a Administración que configure las
            claves de Cloudinary.
          </AppAlert>
          <div
            v-else
            class="drop"
            :class="{ 'is-dragging': dragging, 'is-disabled': !selected }"
            @dragover.prevent="dragging = !!selected"
            @dragleave="dragging = false"
            @drop.prevent="onDrop"
          >
            <span class="drop__icon" aria-hidden="true">↑</span>
            <div class="drop__text">
              <strong>Arrastra aquí las fotos o videos</strong>
              <small v-if="selected"
                >A «{{ selected.title }}» · JPG, PNG, WEBP o MP4 · hasta
                {{ MAX_FILES }} archivos por vez</small
              >
              <small v-else>Elige un álbum para subirle fotos.</small>
            </div>
            <AppButton
              variant="secondary"
              size="sm"
              :disabled="!selected || uploading"
              @click="chooseFiles"
            >
              Elegir archivos
            </AppButton>
            <input
              ref="fileInput"
              class="visually-hidden"
              type="file"
              multiple
              :accept="ACCEPT_ATTRIBUTE"
              tabindex="-1"
              aria-label="Elegir fotos o videos"
              @change="onPicked"
            />
          </div>
          <div v-if="uploading || uploadTotal" class="progress-line">
            <p>
              <span v-if="uploading"
                >Subiendo a «{{ selected?.title }}» · {{ uploadDone }} de
                {{ uploadTotal }}</span
              >
              <span v-else
                >Listo: {{ uploadDone }} de {{ uploadTotal }} archivos</span
              >
              <strong>{{ progress }} %</strong>
            </p>
            <div
              class="progress"
              role="progressbar"
              :aria-valuenow="progress"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-label="Avance de la subida"
            >
              <span :style="{ width: `${progress}%` }" />
            </div>
          </div>
          <AppAlert v-if="uploadProblems.length" tone="error">
            <ul class="problems">
              <li v-for="problem in uploadProblems" :key="problem">
                {{ problem }}
              </li>
            </ul>
          </AppAlert>
        </section>

        <section class="card albums" aria-labelledby="albumes-titulo">
          <header class="albums__head">
            <h2 id="albumes-titulo" class="card__title">Álbumes</h2>
            <AppTabs
              v-model="tab"
              :items="TABS"
              label="Álbumes por estado"
              id-prefix="albumes"
            />
          </header>
          <div
            id="albumes-panel"
            role="tabpanel"
            :aria-labelledby="`albumes-tab-${tab}`"
            class="albums__panel"
          >
            <AppAlert v-if="loadError" tone="error">
              {{ loadError }}
              <AppButton variant="link" size="sm" @click="loadAlbums"
                >Reintentar</AppButton
              >
            </AppAlert>
            <SkeletonBlock
              v-if="loading && !albums.length"
              :lines="2"
              height="6rem"
            />
            <p v-else-if="!albums.length" class="muted">
              {{
                tab === 'publico'
                  ? 'Todavía no hay álbumes publicados.'
                  : tab === 'privado'
                    ? 'No hay álbumes privados.'
                    : 'Todavía no hay álbumes. Crea uno con «+ Nuevo álbum».'
              }}
            </p>
            <ul v-else class="grid">
              <li v-for="album in albums" :key="album.id">
                <button
                  type="button"
                  class="album-card"
                  :class="{ 'is-selected': album.id === selectedId }"
                  :aria-current="album.id === selectedId || undefined"
                  @click="openAlbum(album.id)"
                >
                  <span class="album-card__cover">
                    <img
                      v-if="album.coverUrl"
                      :src="album.coverUrl"
                      alt=""
                      loading="lazy"
                      @error="hideBroken"
                    />
                    <span v-else aria-hidden="true">Sin fotos</span>
                  </span>
                  <strong>{{ album.title }}</strong>
                  <span class="album-card__meta">
                    <StatusBadge :tone="statusOf(album).tone">{{
                      statusOf(album).label
                    }}</StatusBadge>
                    <small>{{ countLabel(album.assetCount) }}</small>
                  </span>
                </button>
              </li>
            </ul>
          </div>
        </section>
      </div>

      <aside class="gal__side">
        <AlbumPanel
          v-if="selected"
          :key="selected.id"
          :album="selected"
          :can-search="canSearch"
          @changed="onChanged"
          @deleted="onDeleted"
          @close="closeAlbum"
        />
        <section v-else class="card card--hint" aria-labelledby="sin-album">
          <h2 id="sin-album" class="card__title">Elige un álbum</h2>
          <p>
            Toca un álbum para ver sus fotos, etiquetar a quienes aparecen y
            publicarlo cuando todas hayan dado su permiso.
          </p>
        </section>
      </aside>
    </div>

    <NewAlbumDialog v-model:open="newOpen" @created="onCreated" />
  </div>
</template>

<style scoped>
.gal {
  display: grid;
  gap: var(--space-5);
  min-width: 0;
}

.gal :deep(.page-header) {
  margin-bottom: 0;
}

.gal__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(19rem, 24rem);
  gap: var(--space-5);
  align-items: start;
  min-width: 0;
}

.gal__main {
  display: grid;
  gap: var(--space-4);
  min-width: 0;
}

.card {
  display: grid;
  gap: var(--space-3);
  min-width: 0;
  padding: var(--space-4) var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
}

.card--hint {
  color: var(--color-text-muted);
}

.card__title {
  font-family: var(--font-serif);
  font-size: var(--text-xl);
  font-weight: 500;
  color: var(--color-text);
}

.muted {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.drop {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-5);
  border: 2px dashed var(--color-border-strong);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
}

.drop.is-dragging {
  border-color: var(--aspar-guindo);
  background: var(--rosa-50);
}

.drop.is-disabled .drop__icon {
  opacity: 0.5;
}

.drop__icon {
  display: grid;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 50%;
  background: var(--rosa-100);
  color: var(--aspar-guindo);
  font-weight: 700;
}

.drop__text {
  display: grid;
  gap: 0.1rem;
}

.drop__text small {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.progress-line p {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
  margin-bottom: var(--space-1);
  font-size: var(--text-sm);
}

.progress {
  height: 0.45rem;
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: var(--color-surface-sunken);
}

.progress span {
  display: block;
  height: 100%;
  background: var(--aspar-guindo);
  transition: width var(--duration-base) var(--ease-out);
}

.problems {
  margin: 0;
  padding-left: var(--space-4);
}

.albums__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-3);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
  gap: var(--space-4);
  margin: 0;
  padding: 0;
  list-style: none;
}

.album-card {
  display: grid;
  gap: var(--space-2);
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.album-card strong {
  font-family: var(--font-serif);
  font-size: var(--text-lg);
  font-weight: 500;
  color: var(--aspar-verde);
}

.album-card__cover {
  display: grid;
  place-items: center;
  aspect-ratio: 16 / 10;
  overflow: hidden;
  border-radius: var(--radius-lg);
  background: var(--color-surface-sunken);
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.album-card__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.album-card.is-selected .album-card__cover {
  box-shadow: 0 0 0 3px var(--aspar-guindo);
}

.album-card:focus-visible .album-card__cover {
  box-shadow: var(--focus-ring);
}

.album-card__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.album-card__meta small {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.gal__side {
  min-width: 0;
}

@media (max-width: 1100px) {
  .gal__body {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 640px) {
  .drop {
    grid-template-columns: minmax(0, 1fr);
    justify-items: start;
  }

  .drop__icon {
    display: none;
  }
}

/* Ventana completa: la página no se desplaza. Si hay muchos álbumes, solo se
   desplaza su lista; el álbum abierto queda al costado */
.gal--fit {
  display: flex;
  flex-direction: column;
  gap: clamp(var(--space-3), 2vh, var(--space-5));
  min-height: 0;
}

.gal--fit :deep(.page-header__title) {
  font-size: clamp(1.9rem, 4.6vh, 3.25rem);
}

.gal--fit .gal__body {
  flex: 1;
  min-height: 0;
  align-items: stretch;
  grid-template-columns: minmax(0, 1fr) clamp(19rem, 26vw, 24rem);
  grid-template-rows: minmax(0, 1fr);
}

.gal--fit .gal__main {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.gal--fit .albums {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.gal--fit .albums__panel {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  padding-right: 0.25rem;
}

.gal--fit .album-card__cover {
  aspect-ratio: auto;
  height: clamp(6rem, 20vh, 13rem);
}

.gal--fit .gal__side {
  min-height: 0;
  overflow-y: auto;
}

@media (max-height: 820px) {
  .gal--fit .drop {
    padding-block: var(--space-2);
  }
}
</style>
