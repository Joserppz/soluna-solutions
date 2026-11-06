<script setup lang="ts">
/**
 * Contenido del sitio (diseño pág. 14): las secciones a la izquierda, el editor en el
 * centro y, a la derecha, cómo se verá en el sitio con lo que cambió resaltado. «Guardar
 * borrador» no cambia el sitio; «Publicar cambios» sí. Las redes sociales se guardan
 * aparte, en «Redes y contacto», y se ven al instante.
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { isApiError } from '../../../api/errors'
import type { SectionOut } from '../../../api/types'
import AppAlert from '../../../components/ui/AppAlert.vue'
import AppButton from '../../../components/ui/AppButton.vue'
import AppModal from '../../../components/ui/AppModal.vue'
import FormField from '../../../components/ui/FormField.vue'
import PageHeader from '../../../components/ui/PageHeader.vue'
import SkeletonBlock from '../../../components/ui/SkeletonBlock.vue'
import StatusBadge from '../../../components/ui/StatusBadge.vue'
import { useApi } from '../../../composables/useApi'
import { useFitLayout } from '../../../composables/useFitLayout'
import { useToast } from '../../../composables/useToast'
import {
  SECTION_FIELDS,
  SECTION_HINTS,
  SOCIAL_NETWORKS,
  ago,
  changedSegments,
  type FieldDef,
} from '../../../utils/content'

type Faq = { pregunta: string; respuesta: string }
type Draft = Record<string, string | string[] | Faq[]>

/** Rótulos que se ven en el sitio para algunos campos. */
const PREVIEW_LABELS: Record<string, string> = {
  mision: 'Nuestra misión',
  vision: 'Nuestra visión',
  titular: 'Titular',
  banco: 'Banco',
  cuenta: 'Cuenta',
  whatsapp: 'WhatsApp',
  telefono: 'Teléfono',
  correo: 'Correo',
  direccion: 'Dirección',
}

const { api } = useApi()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const fit = useFitLayout()

const sections = ref<SectionOut[]>([])
const loading = ref(true)
const loadError = ref<string | null>(null)
const selectedKey = ref<string>(
  typeof route.query.seccion === 'string'
    ? route.query.seccion
    : 'presentacion',
)
const draft = reactive<Draft>({})
const submitted = ref(false)
const saving = ref<'borrador' | 'publicar' | null>(null)
const error = ref<string | null>(null)
const pendingKey = ref<string | null>(null)

const social = reactive({ facebook: '', instagram: '', tiktok: '' })
const savingSocial = ref(false)
const socialError = ref<string | null>(null)

const section = computed(
  () => sections.value.find((item) => item.key === selectedKey.value) ?? null,
)
const fields = computed<FieldDef[]>(
  () => SECTION_FIELDS[selectedKey.value] ?? [],
)
const unpublishedCount = computed(
  () => sections.value.filter((item) => item.hasUnpublishedChanges).length,
)

function copy(content: Record<string, unknown>): Draft {
  const next: Draft = {}
  for (const field of SECTION_FIELDS[selectedKey.value] ?? []) {
    const value = content[field.key]
    if (field.kind === 'list')
      next[field.key] = Array.isArray(value) ? [...(value as string[])] : []
    else if (field.kind === 'faq')
      next[field.key] = Array.isArray(value)
        ? (value as Faq[]).map((item) => ({ ...item }))
        : []
    else next[field.key] = typeof value === 'string' ? value : ''
  }
  return next
}

function resetDraft() {
  for (const key of Object.keys(draft)) delete draft[key]
  Object.assign(draft, copy(section.value?.draftContent ?? {}))
  submitted.value = false
  error.value = null
  if (selectedKey.value === 'redes_contacto') {
    const saved = section.value?.draftContent ?? {}
    for (const network of SOCIAL_NETWORKS)
      social[network.key] =
        typeof saved[network.key] === 'string'
          ? (saved[network.key] as string)
          : ''
    socialError.value = null
  }
}

/** Lo que se envía: el contenido de la sección (las redes se guardan aparte). */
function payload(): Record<string, unknown> {
  const content: Record<string, unknown> = {}
  for (const field of fields.value) {
    const value = draft[field.key]
    if (field.kind === 'list')
      content[field.key] = (value as string[])
        .map((item) => item.trim())
        .filter(Boolean)
    else if (field.kind === 'faq')
      content[field.key] = (value as Faq[])
        .map((item) => ({
          pregunta: item.pregunta.trim(),
          respuesta: item.respuesta.trim(),
        }))
        .filter((item) => item.pregunta || item.respuesta)
    else content[field.key] = String(value ?? '').trim()
  }
  if (selectedKey.value === 'redes_contacto') {
    const saved = section.value?.draftContent ?? {}
    for (const network of SOCIAL_NETWORKS)
      content[network.key] = saved[network.key] ?? ''
  }
  return content
}

const dirty = computed(() => {
  if (!section.value) return false
  const saved = copy(section.value.draftContent)
  return JSON.stringify(saved) !== JSON.stringify(copy(payloadAsDraft()))
})

function payloadAsDraft(): Record<string, unknown> {
  return payload()
}

const errors = computed(() => {
  const list: Record<string, string> = {}
  for (const field of fields.value) {
    const value = draft[field.key]
    if (field.kind === 'faq') {
      ;(value as Faq[]).forEach((item, index) => {
        const any = item.pregunta.trim() || item.respuesta.trim()
        if (any && item.pregunta.trim().length < 3)
          list[`${field.key}.${index}.pregunta`] =
            'Escribe la pregunta (al menos 3 letras).'
        if (any && item.respuesta.trim().length < 3)
          list[`${field.key}.${index}.respuesta`] =
            'Escribe la respuesta (al menos 3 letras).'
      })
      continue
    }
    if (field.kind === 'list') continue
    const text = String(value ?? '').trim()
    if (field.required && !text)
      list[field.key] = `Escribe ${field.label.toLowerCase()}.`
    if (text.length > field.max)
      list[field.key] = `Hasta ${field.max} caracteres (tiene ${text.length}).`
    if (field.kind === 'url' && text && !text.startsWith('https://'))
      list[field.key] = 'El enlace debe empezar con https://.'
  }
  return list
})

function shown(key: string) {
  return submitted.value ? errors.value[key] : undefined
}

function replace(updated: SectionOut) {
  const index = sections.value.findIndex((item) => item.key === updated.key)
  if (index >= 0) sections.value[index] = updated
}

async function saveDraft(): Promise<boolean> {
  submitted.value = true
  error.value = null
  if (Object.keys(errors.value).length) return false
  const updated = await api.content.saveDraft(selectedKey.value, {
    content: payload(),
  })
  replace(updated)
  resetDraft()
  return true
}

async function onSaveDraft() {
  saving.value = 'borrador'
  try {
    if (await saveDraft())
      toast.success('Guardamos el borrador. Todavía no se ve en el sitio.')
  } catch (failure) {
    error.value = isApiError(failure)
      ? failure.message
      : 'No pudimos guardar el borrador. Intenta de nuevo.'
  } finally {
    saving.value = null
  }
}

async function onPublish() {
  saving.value = 'publicar'
  try {
    if (dirty.value && !(await saveDraft())) return
    const updated = await api.content.publish(selectedKey.value)
    replace(updated)
    resetDraft()
    toast.success(`Publicamos «${updated.title}». Ya se ve en el sitio.`)
  } catch (failure) {
    error.value = isApiError(failure)
      ? failure.message
      : 'No pudimos publicar los cambios. Intenta de nuevo.'
  } finally {
    saving.value = null
  }
}

const canPublish = computed(
  () => dirty.value || section.value?.hasUnpublishedChanges === true,
)

async function saveSocial() {
  savingSocial.value = true
  socialError.value = null
  try {
    const updated = await api.content.saveSocialLinks({
      facebook: social.facebook.trim(),
      instagram: social.instagram.trim(),
      tiktok: social.tiktok.trim(),
    })
    replace(updated)
    toast.success('Guardamos los enlaces. Ya se ven en el sitio.')
  } catch (failure) {
    socialError.value = isApiError(failure)
      ? failure.message
      : 'No pudimos guardar los enlaces. Intenta de nuevo.'
  } finally {
    savingSocial.value = false
  }
}

/** Cambiar de sección con cambios sin guardar pregunta antes. */
function choose(key: string) {
  if (key === selectedKey.value) return
  if (dirty.value) {
    pendingKey.value = key
    return
  }
  go(key)
}

function go(key: string) {
  pendingKey.value = null
  selectedKey.value = key
  void router.replace({ query: key === 'presentacion' ? {} : { seccion: key } })
  resetDraft()
}

async function saveAndGo() {
  const key = pendingKey.value
  if (!key) return
  saving.value = 'borrador'
  try {
    if (await saveDraft()) {
      toast.success('Guardamos el borrador.')
      go(key)
    } else pendingKey.value = null
  } catch (failure) {
    pendingKey.value = null
    error.value = isApiError(failure)
      ? failure.message
      : 'No pudimos guardar el borrador.'
  } finally {
    saving.value = null
  }
}

function sectionLine(item: SectionOut): string {
  if (item.hasUnpublishedChanges)
    return item.draftUpdatedAt
      ? `Sin publicar · editado ${ago(item.draftUpdatedAt)}`
      : 'Sin publicar'
  if (item.publishedAt) {
    const when = ago(item.publishedAt)
    return SECTION_HINTS[item.key] && when === 'hoy'
      ? SECTION_HINTS[item.key]!
      : `Publicado ${when}`
  }
  return 'Todavía sin contenido'
}

/* Vista previa: lo publicado contra el borrador que se está editando */
const published = computed(
  () =>
    (section.value?.publishedContent ?? undefined) as
      Record<string, unknown> | undefined,
)

function textSegments(key: string) {
  const before = published.value?.[key]
  return changedSegments(
    typeof before === 'string' ? before : published.value ? '' : undefined,
    String(draft[key] ?? ''),
  )
}

function listChanged(key: string, index: number): boolean {
  if (!published.value) return false
  const before = published.value[key]
  const now = (draft[key] as string[])[index]
  return !Array.isArray(before) || before[index] !== now
}

function faqChanged(key: string, index: number): boolean {
  if (!published.value) return false
  const before = published.value[key] as Faq[] | undefined
  const now = (draft[key] as Faq[])[index]!
  return (
    !before?.[index] ||
    before[index]!.pregunta !== now.pregunta ||
    before[index]!.respuesta !== now.respuesta
  )
}

const socialPreview = computed(() =>
  SOCIAL_NETWORKS.filter((network) => social[network.key].trim()),
)

function addItem(field: FieldDef) {
  const value = draft[field.key]
  if (field.kind === 'list' && (value as string[]).length < field.max)
    (value as string[]).push('')
  if (field.kind === 'faq' && (value as Faq[]).length < field.max)
    (value as Faq[]).push({ pregunta: '', respuesta: '' })
}

function removeItem(field: FieldDef, index: number) {
  ;(draft[field.key] as unknown[]).splice(index, 1)
}

onMounted(async () => {
  try {
    sections.value = await api.content.sections()
    if (!sections.value.some((item) => item.key === selectedKey.value))
      selectedKey.value = sections.value[0]?.key ?? 'presentacion'
    resetDraft()
  } catch (failure) {
    loadError.value = isApiError(failure)
      ? failure.message
      : 'No pudimos cargar el contenido. Intenta de nuevo.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="cms" :class="{ 'cms--fit': fit }">
    <PageHeader
      title="Contenido del sitio"
      subtitle="Lo que las personas leen sobre ASPAR. Revisa la vista previa antes de publicar."
    >
      <template v-if="sections.length" #actions>
        <StatusBadge :tone="unpublishedCount ? 'warning' : 'success'">
          {{
            unpublishedCount === 0
              ? 'Todo publicado'
              : unpublishedCount === 1
                ? '1 cambio sin publicar'
                : `${unpublishedCount} cambios sin publicar`
          }}
        </StatusBadge>
      </template>
    </PageHeader>

    <AppAlert v-if="loadError" tone="error">{{ loadError }}</AppAlert>
    <SkeletonBlock v-else-if="loading" :lines="3" height="4rem" />

    <div v-else class="cms__body">
      <nav class="card nav" aria-label="Secciones del sitio">
        <ul>
          <li v-for="item in sections" :key="item.key">
            <button
              type="button"
              class="nav__item"
              :class="{ 'is-current': item.key === selectedKey }"
              :aria-current="item.key === selectedKey || undefined"
              @click="choose(item.key)"
            >
              <strong>{{ item.title }}</strong>
              <small>
                <span
                  v-if="item.hasUnpublishedChanges"
                  class="nav__dot"
                  aria-hidden="true"
                />{{ sectionLine(item) }}</small
              >
            </button>
          </li>
        </ul>
      </nav>

      <section
        v-if="section"
        class="card editor"
        aria-labelledby="seccion-titulo"
      >
        <h2 id="seccion-titulo" class="card__title">{{ section.title }}</h2>
        <form
          id="editar-seccion"
          class="editor__fields"
          novalidate
          @submit.prevent="onSaveDraft"
        >
          <AppAlert v-if="error" tone="error">{{ error }}</AppAlert>
          <template v-for="field in fields" :key="field.key">
            <FormField
              v-if="field.kind === 'text' || field.kind === 'url'"
              v-slot="{ id, describedBy, invalid }"
              :class="{ 'is-half': field.half }"
              :label="field.label"
              :required="field.required"
              :error="shown(field.key)"
            >
              <input
                :id="id"
                v-model="draft[field.key] as string"
                class="input"
                :type="field.kind === 'url' ? 'url' : 'text'"
                :maxlength="field.max"
                :placeholder="field.placeholder"
                :aria-describedby="describedBy"
                :aria-invalid="invalid"
              />
            </FormField>
            <FormField
              v-else-if="field.kind === 'textarea'"
              v-slot="{ id, describedBy, invalid }"
              :label="field.label"
              :required="field.required"
              :error="shown(field.key)"
            >
              <textarea
                :id="id"
                v-model="draft[field.key] as string"
                class="textarea"
                :rows="field.rows ?? 3"
                :maxlength="field.max"
                :aria-describedby="describedBy"
                :aria-invalid="invalid"
              />
            </FormField>
            <fieldset v-else-if="field.kind === 'list'" class="items">
              <legend>{{ field.label }}</legend>
              <div
                v-for="(_, index) in draft[field.key] as string[]"
                :key="index"
                class="item"
              >
                <label class="visually-hidden" :for="`paso-${index}`"
                  >Paso {{ index + 1 }}</label
                >
                <input
                  :id="`paso-${index}`"
                  v-model="(draft[field.key] as string[])[index]"
                  class="input"
                  maxlength="200"
                />
                <button
                  type="button"
                  class="item__remove"
                  :aria-label="`Quitar el paso ${index + 1}`"
                  @click="removeItem(field, index)"
                >
                  ×
                </button>
              </div>
              <AppButton
                v-if="(draft[field.key] as string[]).length < field.max"
                variant="secondary"
                size="sm"
                @click="addItem(field)"
              >
                + Agregar paso
              </AppButton>
            </fieldset>
            <fieldset v-else class="items">
              <legend>{{ field.label }}</legend>
              <div
                v-for="(item, index) in draft[field.key] as Faq[]"
                :key="index"
                class="faq"
              >
                <FormField
                  v-slot="{ id, describedBy, invalid }"
                  :label="`Pregunta ${index + 1}`"
                  :error="shown(`${field.key}.${index}.pregunta`)"
                >
                  <input
                    :id="id"
                    v-model="item.pregunta"
                    class="input"
                    maxlength="200"
                    :aria-describedby="describedBy"
                    :aria-invalid="invalid"
                  />
                </FormField>
                <FormField
                  v-slot="{ id, describedBy, invalid }"
                  :label="`Respuesta ${index + 1}`"
                  :error="shown(`${field.key}.${index}.respuesta`)"
                >
                  <textarea
                    :id="id"
                    v-model="item.respuesta"
                    class="textarea"
                    rows="2"
                    maxlength="1500"
                    :aria-describedby="describedBy"
                    :aria-invalid="invalid"
                  />
                </FormField>
                <button
                  type="button"
                  class="link link--danger"
                  @click="removeItem(field, index)"
                >
                  Quitar la pregunta {{ index + 1 }}
                </button>
              </div>
              <AppButton
                v-if="(draft[field.key] as Faq[]).length < field.max"
                variant="secondary"
                size="sm"
                @click="addItem(field)"
              >
                + Agregar pregunta
              </AppButton>
            </fieldset>
          </template>

          <fieldset v-if="selectedKey === 'redes_contacto'" class="social">
            <legend>Redes sociales</legend>
            <p class="muted">
              Solo enlaces oficiales. Si un campo queda vacío, ese ícono no
              aparece en el sitio. Se guardan aparte y se ven al instante.
            </p>
            <AppAlert v-if="socialError" tone="error">{{
              socialError
            }}</AppAlert>
            <div class="social__row">
              <FormField
                v-for="network in SOCIAL_NETWORKS"
                :key="network.key"
                v-slot="{ id }"
                :label="network.label"
              >
                <input
                  :id="id"
                  v-model="social[network.key]"
                  class="input"
                  type="url"
                  maxlength="300"
                  :placeholder="
                    network.key === 'facebook'
                      ? 'Pega el enlace oficial'
                      : 'Sin configurar'
                  "
                />
              </FormField>
            </div>
            <AppButton
              variant="secondary"
              size="sm"
              :loading="savingSocial"
              loading-label="Guardando…"
              @click="saveSocial"
            >
              Guardar enlaces
            </AppButton>
          </fieldset>
        </form>
        <footer class="editor__actions">
          <p class="muted">
            Usa un lenguaje claro y cercano. Lo que todavía es un sueño,
            cuéntalo como un sueño.
          </p>
          <AppButton
            variant="secondary"
            type="submit"
            form="editar-seccion"
            :disabled="!dirty || saving !== null"
            :loading="saving === 'borrador'"
            loading-label="Guardando…"
          >
            Guardar borrador
          </AppButton>
          <AppButton
            :disabled="!canPublish || saving !== null"
            :loading="saving === 'publicar'"
            loading-label="Publicando…"
            @click="onPublish"
          >
            Publicar cambios
          </AppButton>
        </footer>
      </section>

      <aside v-if="section" class="preview" aria-labelledby="vista-previa">
        <h2 id="vista-previa" class="preview__label">
          Vista previa en el sitio
        </h2>
        <article class="preview__page">
          <p class="preview__eyebrow">{{ section.title }}</p>
          <template v-for="field in fields" :key="field.key">
            <h3 v-if="field.key === 'titulo'" class="preview__title">
              <template
                v-for="(segment, index) in textSegments('titulo')"
                :key="index"
              >
                <mark v-if="segment.changed">{{ segment.text }}</mark>
                <template v-else>{{ segment.text }}</template>
              </template>
            </h3>
            <div
              v-else-if="
                (field.kind === 'text' ||
                  field.kind === 'textarea' ||
                  field.kind === 'url') &&
                String(draft[field.key] ?? '').trim()
              "
              class="preview__block"
              :class="{
                'preview__block--quote':
                  PREVIEW_LABELS[field.key] && field.kind === 'textarea',
              }"
            >
              <h4 v-if="PREVIEW_LABELS[field.key]">
                {{ PREVIEW_LABELS[field.key] }}
              </h4>
              <img
                v-if="field.kind === 'url'"
                class="preview__qr"
                :src="String(draft[field.key])"
                alt="QR bancario de ASPAR"
              />
              <p v-else>
                <template
                  v-for="(segment, index) in textSegments(field.key)"
                  :key="index"
                >
                  <mark v-if="segment.changed">{{ segment.text }}</mark>
                  <template v-else>{{ segment.text }}</template>
                </template>
              </p>
            </div>
            <ol
              v-else-if="
                field.kind === 'list' && (draft[field.key] as string[]).length
              "
              class="preview__steps"
            >
              <li
                v-for="(step, index) in draft[field.key] as string[]"
                :key="index"
              >
                <mark v-if="listChanged(field.key, index)">{{ step }}</mark>
                <template v-else>{{ step }}</template>
              </li>
            </ol>
            <dl
              v-else-if="
                field.kind === 'faq' && (draft[field.key] as Faq[]).length
              "
              class="preview__faq"
            >
              <div
                v-for="(item, index) in draft[field.key] as Faq[]"
                :key="index"
                :class="{ 'is-changed': faqChanged(field.key, index) }"
              >
                <dt>{{ item.pregunta }}</dt>
                <dd>{{ item.respuesta }}</dd>
              </div>
            </dl>
          </template>
          <p v-if="socialPreview.length" class="preview__social">
            Síguenos:
            <span v-for="network in socialPreview" :key="network.key">{{
              network.label
            }}</span>
          </p>
        </article>
        <p class="muted">
          {{
            section.publishedContent
              ? 'Lo resaltado es lo que cambió desde la última publicación.'
              : 'Esta sección todavía no se publicó: no se ve en el sitio.'
          }}
        </p>
      </aside>
    </div>

    <AppModal
      :open="pendingKey !== null"
      size="sm"
      title="Tienes cambios sin guardar"
      description="Guarda el borrador para no perderlos, o descártalos."
      :dismissible="saving === null"
      @update:open="!$event && (pendingKey = null)"
    >
      <template #actions>
        <AppButton
          variant="secondary"
          :disabled="saving !== null"
          @click="pendingKey && go(pendingKey)"
        >
          Descartar
        </AppButton>
        <AppButton
          :loading="saving === 'borrador'"
          loading-label="Guardando…"
          @click="saveAndGo"
        >
          Guardar borrador
        </AppButton>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.cms {
  display: grid;
  gap: var(--space-5);
  min-width: 0;
}

.cms :deep(.page-header) {
  margin-bottom: 0;
}

.cms__body {
  display: grid;
  grid-template-columns: minmax(10.5rem, 12.5rem) minmax(0, 1.15fr) minmax(
      0,
      0.9fr
    );
  gap: var(--space-5);
  align-items: start;
  min-width: 0;
}

.card {
  min-width: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
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

.nav {
  padding: var(--space-3);
}

.nav ul {
  display: grid;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
  list-style: none;
}

.nav__item {
  display: grid;
  gap: 0.1rem;
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.nav__item strong {
  font-size: var(--text-sm);
  font-weight: 600;
}

.nav__item small {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--color-text-muted);
  font-size: var(--text-xs);
}

.nav__item:hover {
  background: var(--color-surface-muted);
}

.nav__item.is-current {
  background: var(--rosa-50);
}

.nav__item.is-current strong {
  color: var(--aspar-guindo);
}

.nav__dot {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
  background: var(--tone-warning-fg);
}

.editor {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-5);
}

.editor__fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
  min-width: 0;
}

/* Cada campo usa el ancho completo; los cortos van de a dos */
.editor__fields > * {
  grid-column: 1 / -1;
}

.editor__fields > .is-half {
  grid-column: auto;
}

/* Las cajas de texto crecen con lo que se escribe: no se desplazan por dentro */
.editor__fields :deep(.textarea) {
  field-sizing: content;
  min-height: 4.5rem;
  max-height: 16rem;
  resize: none;
}

.editor__fields :deep(.input),
.editor__fields :deep(.textarea) {
  width: 100%;
  min-width: 0;
}

.editor__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-3);
}

.editor__actions .muted {
  flex: 1 1 14rem;
}

.editor__actions :deep(.btn) {
  flex: none;
}

.items,
.social {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  border: 0;
  justify-items: start;
}

.items legend,
.social legend {
  margin-bottom: var(--space-1);
  font-size: var(--text-sm);
  font-weight: 600;
}

.item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 2.25rem;
  gap: var(--space-2);
  width: 100%;
}

.item__remove {
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: var(--text-lg);
  cursor: pointer;
}

.faq {
  display: grid;
  gap: var(--space-2);
  width: 100%;
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--color-border);
}

.social {
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
}

.social__row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-2);
  width: 100%;
}

.link {
  justify-self: start;
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

.link--danger {
  color: var(--aspar-rojo);
}

.preview {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
}

.preview__label {
  font-size: var(--text-sm);
  font-weight: 600;
}

.preview__page {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-5) var(--space-6);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.preview__eyebrow {
  color: var(--aspar-rojo);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.preview__title {
  font-family: var(--font-serif);
  font-size: clamp(1.4rem, 3.4vh, 2.2rem);
  font-weight: 500;
  line-height: 1.15;
  color: var(--aspar-verde);
}

.preview__block {
  display: grid;
  gap: var(--space-1);
}

.preview__block--quote {
  padding-left: var(--space-4);
  border-left: 3px solid var(--aspar-guindo);
}

.preview__block h4 {
  color: var(--aspar-guindo);
  font-size: var(--text-md);
  font-weight: 700;
}

.preview__block p,
.preview__steps,
.preview__faq {
  color: var(--color-text);
  font-size: var(--text-sm);
  line-height: 1.6;
  white-space: pre-line;
}

.preview__steps {
  margin: 0;
  padding-left: var(--space-5);
}

.preview__faq {
  display: grid;
  gap: var(--space-2);
  margin: 0;
}

.preview__faq dt {
  font-weight: 700;
}

.preview__faq dd {
  margin: 0;
  color: var(--color-text-muted);
}

.preview__faq .is-changed {
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  background: #fff3c4;
}

.preview__qr {
  width: 8rem;
  height: 8rem;
  object-fit: contain;
}

.preview__social span + span::before {
  content: ' · ';
}

.preview mark {
  padding: 0 0.1em;
  border-radius: 2px;
  background: #fff3c4;
  color: inherit;
}

@media (max-width: 1100px) {
  .cms__body {
    grid-template-columns: minmax(0, 1fr);
  }

  .nav ul {
    grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
  }
}

@media (max-width: 640px) {
  .social__row {
    grid-template-columns: minmax(0, 1fr);
  }
}

/* Ventana completa: la página no se desplaza. Si una sección es larga (por ejemplo,
   muchas preguntas), solo se desplazan sus campos; los botones quedan a la vista */
.cms--fit {
  display: flex;
  flex-direction: column;
  gap: clamp(var(--space-3), 2vh, var(--space-5));
  min-height: 0;
}

.cms--fit :deep(.page-header__title) {
  font-size: clamp(1.9rem, 4.6vh, 3.25rem);
}

.cms--fit .cms__body {
  flex: 1;
  min-height: 0;
  align-items: stretch;
  grid-template-rows: minmax(0, 1fr);
}

.cms--fit .nav {
  min-height: 0;
  overflow-y: auto;
}

.cms--fit .editor {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding-block: clamp(var(--space-3), 2vh, var(--space-5));
}

.cms--fit .editor__fields {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  align-content: start;
  padding-right: 0.25rem;
}

.cms--fit .preview {
  min-height: 0;
  overflow-y: auto;
  align-content: start;
}

@media (max-height: 820px) {
  .cms--fit .editor__actions .muted {
    display: none;
  }

  .cms--fit .editor__fields :deep(.field) {
    gap: 0.15rem;
  }
}

/* Ventanas muy bajas (1280×720): campos más bajos y sin la ayuda de las redes */
@media (max-height: 760px) {
  .cms--fit .editor__fields {
    gap: var(--space-2);
  }

  .cms--fit .editor__fields :deep(.input) {
    min-height: 2.3rem;
    height: 2.3rem;
  }

  .cms--fit .editor__fields :deep(.textarea) {
    min-height: 3.5rem;
  }

  .cms--fit .social .muted {
    display: none;
  }
}
</style>
