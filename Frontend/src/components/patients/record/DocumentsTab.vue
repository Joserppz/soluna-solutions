<script setup lang="ts">
/**
 * Documentos privados: se abren con un enlace firmado que vence en 5 minutos y nunca
 * se publican. Verlos sigue la misma regla que la historia clínica (RNF-06); subir uno
 * solo pide el permiso de subir documentos.
 */
import { computed, ref } from 'vue'

import { isApiError } from '../../../api/errors'
import type { PatientDocument, PatientOut } from '../../../api/types'
import { useApi } from '../../../composables/useApi'
import { useToast } from '../../../composables/useToast'
import { shortDay } from '../../../utils/format'
import {
  DOCUMENT_ACCEPT,
  DOCUMENT_TYPES,
  documentFileError,
  documentTypeLabel,
  fileSize,
} from '../../../utils/patients'
import AppAlert from '../../ui/AppAlert.vue'
import AppButton from '../../ui/AppButton.vue'
import AppModal from '../../ui/AppModal.vue'
import FormField from '../../ui/FormField.vue'
import SkeletonBlock from '../../ui/SkeletonBlock.vue'
import PrivacyNotice from './PrivacyNotice.vue'

const props = defineProps<{ patient: PatientOut; notice: string | null }>()

const { api, session } = useApi()
const toast = useToast()

const documents = ref<PatientDocument[] | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const opening = ref<string | null>(null)
const removing = ref<PatientDocument | null>(null)
const busy = ref(false)

const documentType = ref<string>('CI')
const file = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const uploadTried = ref(false)
const uploading = ref(false)
const uploadError = ref<string | null>(null)

const canUpload = computed(() => session.can('documents:upload'))
const canDelete = computed(() => session.can('documents:delete'))
const fileError = computed(() =>
  uploadTried.value ? documentFileError(file.value) : null,
)

async function load() {
  if (props.notice) return
  loading.value = true
  error.value = null
  try {
    documents.value = await api.documents.list(props.patient.id)
  } catch (failure) {
    error.value = isApiError(failure)
      ? failure.message
      : 'No pudimos cargar los documentos.'
  } finally {
    loading.value = false
  }
}

function onFile(event: Event) {
  file.value = (event.target as HTMLInputElement).files?.[0] ?? null
}

async function upload() {
  uploadTried.value = true
  uploadError.value = null
  if (fileError.value || !file.value) return
  uploading.value = true
  try {
    const uploaded = await api.documents.upload(
      props.patient.id,
      documentType.value,
      file.value,
      file.value.name,
    )
    toast.success(
      `Subimos «${documentTypeLabel(uploaded.documentType)}» a la ficha.`,
    )
    file.value = null
    uploadTried.value = false
    if (fileInput.value) fileInput.value.value = ''
    if (documents.value) documents.value = [uploaded, ...documents.value]
  } catch (failure) {
    uploadError.value = isApiError(failure)
      ? failure.message
      : 'No pudimos subir el documento. Intenta de nuevo.'
  } finally {
    uploading.value = false
  }
}

/**
 * La pestaña se abre antes de pedir el enlace: así el navegador no la bloquea por no
 * venir directo de un clic.
 */
async function open(document: PatientDocument) {
  const tab = window.open('', '_blank')
  opening.value = document.id
  error.value = null
  try {
    const { url } = await api.documents.signedUrl(props.patient.id, document.id)
    if (tab) {
      tab.opener = null
      tab.location.href = url
    } else window.location.assign(url)
  } catch (failure) {
    tab?.close()
    error.value = isApiError(failure)
      ? failure.message
      : 'No pudimos abrir el documento.'
  } finally {
    opening.value = null
  }
}

async function confirmRemove() {
  const target = removing.value
  if (!target) return
  busy.value = true
  try {
    await api.documents.remove(props.patient.id, target.id)
    documents.value = (documents.value ?? []).filter(
      (item) => item.id !== target.id,
    )
    toast.success(`Quitamos «${documentTypeLabel(target.documentType)}».`)
  } catch (failure) {
    error.value = isApiError(failure)
      ? failure.message
      : 'No pudimos quitar el documento.'
  } finally {
    busy.value = false
    removing.value = null
  }
}

function kind(document: PatientDocument) {
  return document.contentType === 'application/pdf' ? 'PDF' : 'IMG'
}

void load()
</script>

<template>
  <div class="documents">
    <PrivacyNotice v-if="notice" :message="notice" />

    <section
      v-else
      class="documents__card surface-card"
      aria-labelledby="documentos-titulo"
    >
      <h2 id="documentos-titulo">Documentos privados</h2>
      <AppAlert v-if="error" tone="error">{{ error }}</AppAlert>
      <SkeletonBlock v-if="loading" :lines="2" height="3rem" />
      <ul v-else-if="documents?.length" class="documents__list">
        <li v-for="item in documents" :key="item.id" class="document">
          <span class="document__kind" aria-hidden="true">{{
            kind(item)
          }}</span>
          <span class="document__text">
            <strong>{{ documentTypeLabel(item.documentType) }}</strong>
            <small>
              {{ item.fileName }} · Subido el {{ shortDay(item.uploadedAt) }} ·
              {{ fileSize(item.sizeBytes) }}
            </small>
          </span>
          <span class="document__actions">
            <AppButton
              variant="secondary"
              size="sm"
              :loading="opening === item.id"
              loading-label="Abriendo el documento…"
              :aria-label="`Abrir ${documentTypeLabel(item.documentType)}`"
              @click="open(item)"
            >
              Abrir
            </AppButton>
            <AppButton
              v-if="canDelete && patient.active"
              variant="link"
              size="sm"
              :aria-label="`Quitar ${documentTypeLabel(item.documentType)}`"
              @click="removing = item"
            >
              Quitar
            </AppButton>
          </span>
        </li>
      </ul>
      <p v-else-if="documents" class="documents__empty">
        Todavía no hay documentos en esta ficha.
      </p>
      <p class="documents__note">
        Se abren con un enlace que vence en 5 minutos. Nunca se publican.
      </p>
    </section>

    <form
      v-if="canUpload && patient.active"
      class="documents__upload surface-card"
      novalidate
      aria-labelledby="subir-titulo"
      @submit.prevent="upload"
    >
      <h2 id="subir-titulo">Subir un documento</h2>
      <p v-if="notice" class="documents__note">
        Puedes subirlo aunque no lo veas: queda guardado para el personal
        clínico.
      </p>
      <AppAlert v-if="uploadError" tone="error">{{ uploadError }}</AppAlert>
      <FormField v-slot="{ id }" label="Tipo de documento" required>
        <select :id="id" v-model="documentType" class="select">
          <option v-for="type in DOCUMENT_TYPES" :key="type" :value="type">
            {{ documentTypeLabel(type) }}
          </option>
        </select>
      </FormField>
      <FormField
        v-slot="{ id, describedBy, invalid }"
        label="Archivo"
        required
        hint="PDF, JPG, PNG o WEBP, hasta 10 MB."
        :error="fileError"
      >
        <input
          :id="id"
          ref="fileInput"
          class="input documents__file"
          type="file"
          :accept="DOCUMENT_ACCEPT"
          :aria-describedby="describedBy"
          :aria-invalid="invalid"
          @change="onFile"
        />
      </FormField>
      <AppButton
        type="submit"
        :loading="uploading"
        loading-label="Subiendo el documento…"
      >
        Subir documento
      </AppButton>
    </form>

    <AppModal
      :open="removing !== null"
      size="sm"
      title="¿Quitar este documento?"
      description="Deja de estar disponible en la ficha. Esta acción queda en el registro de actividad."
      @update:open="removing = null"
    >
      <template #actions>
        <AppButton variant="secondary" @click="removing = null">
          Cancelar
        </AppButton>
        <AppButton variant="danger" :loading="busy" @click="confirmRemove">
          Quitar documento
        </AppButton>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.documents {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(16rem, 22rem);
  gap: var(--space-5);
  align-items: start;
}

.documents__card,
.documents__upload {
  display: grid;
  gap: var(--space-4);
  min-width: 0;
  padding: var(--space-5) var(--space-6);
}

.documents__upload {
  justify-items: start;
}

.documents__upload > :deep(.field) {
  width: 100%;
}

.documents h2 {
  font-family: var(--font-sans);
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--color-text);
}

.documents__list {
  display: grid;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.document {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3) var(--space-4);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.document__kind {
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: var(--radius-sm);
  background: var(--rosa-100);
  color: var(--aspar-guindo);
  font-size: var(--text-xs);
  font-weight: 700;
}

.document__text {
  flex: 1 1 14rem;
  display: grid;
  min-width: 0;
}

.document__text small {
  overflow: hidden;
  color: var(--color-text-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.document__actions {
  display: flex;
  gap: var(--space-2);
}

.documents__empty {
  padding: var(--space-4) 0;
  color: var(--color-text-muted);
}

.documents__note {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.documents__file {
  padding-block: var(--space-2);
}

@media (max-width: 1100px) {
  .documents {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
