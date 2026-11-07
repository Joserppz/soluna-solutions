<script setup lang="ts">
/**
 * El detalle de una solicitud (diseño pág. 17): quién escribió y para qué, Llamar o
 * Escribir por WhatsApp, la barra de seguimiento, las notas de la llamada con su
 * historial e «Inscribir como afiliado →».
 */
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'

import { isApiError } from '../../api/errors'
import type { InquiryDetail } from '../../api/types'
import { useApi } from '../../composables/useApi'
import { whenLabel } from '../../utils/format'
import {
  FOLLOW_UP,
  SOURCE_LABELS,
  canMove,
  followUpSteps,
  formatPhone,
  historyTime,
  telUrl,
  whatsappUrl,
  type InquiryStatus,
} from '../../utils/inquiries'
import AppAlert from '../ui/AppAlert.vue'
import AppButton from '../ui/AppButton.vue'
import SkeletonBlock from '../ui/SkeletonBlock.vue'

const props = defineProps<{ inquiryId: string; titleId?: string }>()
const emit = defineEmits<{
  close: []
  changed: [inquiry: InquiryDetail, message: string]
  enroll: [inquiry: InquiryDetail]
}>()

const { api } = useApi()

const detail = ref<InquiryDetail | null>(null)
const loadError = ref<string | null>(null)
const note = ref('')
const noteError = ref<string | null>(null)
const saving = ref<'note' | 'contacted' | InquiryStatus | null>(null)
const actionError = ref<string | null>(null)

async function load(id: string) {
  detail.value = null
  loadError.value = null
  actionError.value = null
  note.value = ''
  noteError.value = null
  try {
    detail.value = await api.inquiries.get(id)
  } catch (error) {
    loadError.value = isApiError(error)
      ? error.message
      : 'No pudimos abrir la solicitud. Intenta de nuevo.'
  }
}

watch(() => props.inquiryId, load, { immediate: true })

const steps = computed(() =>
  detail.value ? followUpSteps(detail.value.status) : [],
)
const closed = computed(() => detail.value?.status === 'cerrada')
const enrolled = computed(
  () => detail.value?.status === 'inscrita' || !!detail.value?.patientId,
)
const canContact = computed(
  () =>
    !!detail.value &&
    detail.value.status !== 'contactada' &&
    canMove(detail.value.status, 'contactada'),
)
const whatsapp = computed(() =>
  detail.value
    ? whatsappUrl(
        detail.value.phone,
        `Hola, ${detail.value.name.split(' ')[0]}. Te escribimos de ASPAR por tu mensaje.`,
      )
    : '',
)
const history = computed(() => {
  if (!detail.value) return []
  return [
    {
      id: 'recibida',
      text: `Solicitud recibida · ${SOURCE_LABELS[detail.value.source].toLowerCase()}`,
      when: detail.value.createdAt,
    },
    ...detail.value.notes.map((item) => ({
      id: item.id,
      text: `${item.authorName}: ${item.note}`,
      when: item.createdAt,
    })),
  ].sort((a, b) => b.when.localeCompare(a.when))
})

async function move(status: InquiryStatus) {
  if (!detail.value || !canMove(detail.value.status, status)) return
  saving.value = status
  actionError.value = null
  try {
    const updated = await api.inquiries.update(detail.value.id, { status })
    detail.value = updated
    emit(
      'changed',
      updated,
      status === 'cerrada'
        ? `Cerramos la solicitud de ${updated.name}.`
        : status === 'recibida'
          ? `Reabrimos la solicitud de ${updated.name}.`
          : `La solicitud de ${updated.name} quedó «${updated.statusLabel}».`,
    )
  } catch (error) {
    actionError.value = isApiError(error)
      ? error.message
      : 'No pudimos cambiar el estado. Intenta de nuevo.'
  } finally {
    saving.value = null
  }
}

async function saveNote(markContacted: boolean) {
  if (!detail.value) return
  if (!note.value.trim()) {
    noteError.value = 'Escribe qué conversaron en la llamada.'
    return
  }
  noteError.value = null
  actionError.value = null
  saving.value = markContacted ? 'contacted' : 'note'
  try {
    const updated = await api.inquiries.addNote(detail.value.id, {
      note: note.value.trim(),
      markContacted,
    })
    detail.value = updated
    note.value = ''
    emit(
      'changed',
      updated,
      markContacted
        ? `Guardamos la nota. ${updated.name} quedó como contactada.`
        : 'Guardamos la nota.',
    )
  } catch (error) {
    actionError.value = isApiError(error)
      ? error.message
      : 'No pudimos guardar la nota. Intenta de nuevo.'
  } finally {
    saving.value = null
  }
}
</script>

<template>
  <article class="inquiry" :aria-labelledby="titleId ?? 'solicitud-titulo'">
    <AppAlert v-if="loadError" tone="error">{{ loadError }}</AppAlert>
    <div v-else-if="!detail" class="inquiry__loading" aria-busy="true">
      <SkeletonBlock height="4rem" />
      <SkeletonBlock height="6rem" />
      <SkeletonBlock height="3rem" />
    </div>
    <template v-else>
      <header class="inquiry__head">
        <div class="inquiry__who">
          <span class="eyebrow">{{ detail.kindLabel }}</span>
          <h2 :id="titleId ?? 'solicitud-titulo'">{{ detail.name }}</h2>
          <p class="inquiry__meta">
            Escribió {{ whenLabel(detail.createdAt) }}
            <template v-if="detail.onBehalfOf">
              · Escribe por {{ detail.onBehalfOf }}
            </template>
          </p>
        </div>
        <div class="inquiry__actions">
          <AppButton size="sm" :href="telUrl(detail.phone)">Llamar</AppButton>
          <AppButton
            size="sm"
            variant="secondary"
            :href="whatsapp"
            target="_blank"
            rel="noopener"
          >
            Escribir por WhatsApp
          </AppButton>
          <button
            type="button"
            class="inquiry__close"
            aria-label="Cerrar el detalle"
            @click="emit('close')"
          >
            ×
          </button>
        </div>
      </header>

      <blockquote v-if="detail.message" class="inquiry__quote">
        «{{ detail.message }}»
      </blockquote>
      <p v-else class="inquiry__quote inquiry__quote--empty">
        No dejó un mensaje. Llama para conocer qué necesita.
      </p>

      <dl class="inquiry__facts">
        <div>
          <dt>Teléfono</dt>
          <dd>{{ formatPhone(detail.phone) }}</dd>
        </div>
        <div>
          <dt>Zona</dt>
          <dd>{{ detail.zone || '—' }}</dd>
        </div>
        <div>
          <dt>Prefiere que la llamen</dt>
          <dd>{{ detail.preferredCallTime || 'Cuando puedan' }}</dd>
        </div>
        <div v-if="detail.scheduleTitle">
          <dt>Actividad</dt>
          <dd>{{ detail.scheduleTitle }}</dd>
        </div>
      </dl>

      <section class="inquiry__block" aria-labelledby="seguimiento-titulo">
        <div class="inquiry__label-row">
          <h3 id="seguimiento-titulo" class="inquiry__label">Seguimiento</h3>
          <button
            v-if="closed"
            type="button"
            class="inquiry__link"
            :disabled="saving !== null"
            @click="move('recibida')"
          >
            Reabrir la solicitud
          </button>
          <button
            v-else-if="canMove(detail.status, 'cerrada')"
            type="button"
            class="inquiry__link"
            :disabled="saving !== null"
            @click="move('cerrada')"
          >
            Cerrar sin inscribir
          </button>
        </div>
        <p v-if="closed" class="inquiry__closed">
          Cerrada: no se va a inscribir. Puedes reabrirla si vuelve a escribir.
        </p>
        <ol v-else class="follow" aria-label="Estado de la solicitud">
          <li
            v-for="(step, index) in FOLLOW_UP"
            :key="step.status"
            :class="`is-${steps[index]}`"
            :aria-current="steps[index] === 'now' ? 'step' : undefined"
          >
            <button
              v-if="
                step.status !== 'inscrita' &&
                canMove(detail.status, step.status)
              "
              type="button"
              :disabled="saving !== null"
              :aria-label="`Marcar como «${step.label}»`"
              @click="move(step.status)"
            >
              {{ step.label }}
            </button>
            <span v-else>{{ step.label }}</span>
          </li>
        </ol>
      </section>

      <AppAlert v-if="actionError" tone="error">{{ actionError }}</AppAlert>

      <div class="inquiry__cols">
        <div>
          <label for="nota-llamada" class="inquiry__label inquiry__label--block"
            >Notas de la llamada</label
          >
          <textarea
            id="nota-llamada"
            v-model="note"
            class="textarea"
            rows="3"
            maxlength="2000"
            placeholder="Ej. Se le explicó el horario del sábado; vendrá con su esposo…"
            :aria-invalid="Boolean(noteError)"
            :aria-describedby="noteError ? 'nota-error' : undefined"
          />
          <p v-if="noteError" id="nota-error" class="inquiry__error">
            {{ noteError }}
          </p>
          <div class="inquiry__note-actions">
            <AppButton
              v-if="canContact"
              size="sm"
              :loading="saving === 'contacted'"
              :disabled="saving !== null && saving !== 'contacted'"
              loading-label="Guardando…"
              @click="saveNote(true)"
            >
              Guardar y marcar como contactada
            </AppButton>
            <AppButton
              size="sm"
              :variant="canContact ? 'secondary' : 'primary'"
              :loading="saving === 'note'"
              :disabled="saving !== null && saving !== 'note'"
              loading-label="Guardando…"
              @click="saveNote(false)"
            >
              Guardar nota
            </AppButton>
          </div>
        </div>
        <section aria-labelledby="historial-titulo">
          <h3 id="historial-titulo" class="inquiry__label">Historial</h3>
          <ol class="timeline">
            <li v-for="item in history" :key="item.id">
              <span>{{ item.text }}</span>
              <small>{{ historyTime(item.when) }}</small>
            </li>
          </ol>
        </section>
      </div>

      <div class="inquiry__cols inquiry__notes">
        <div v-if="detail.patientId" class="box box--done">
          <b>{{ detail.name }} ya tiene su ficha de afiliado.</b>
          <RouterLink
            class="inquiry__link"
            :to="{ name: 'afiliado', params: { id: detail.patientId } }"
          >
            Ver la ficha →
          </RouterLink>
        </div>
        <div v-else-if="!closed && !enrolled" class="box box--rose">
          <b>¿Ya vino a su primer sábado?</b>
          <span class="box__text">
            Al inscribirla se abre una ficha de afiliado con su nombre y
            teléfono ya cargados.
          </span>
          <button
            type="button"
            class="inquiry__link"
            @click="emit('enroll', detail)"
          >
            Inscribir como afiliado →
          </button>
        </div>
        <p class="box box--privacy">
          Esta bandeja no guarda diagnósticos ni documentos médicos. Esos datos
          se registran en la ficha, con el consentimiento firmado.
        </p>
      </div>
    </template>
  </article>
</template>

<style scoped>
.inquiry {
  display: grid;
  align-content: start;
  gap: var(--space-5);
}

.inquiry__loading {
  display: grid;
  gap: var(--space-4);
}

.inquiry__head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-3) var(--space-5);
}

.inquiry__who {
  min-width: 0;
}

.inquiry__who h2 {
  margin: var(--space-2) 0 var(--space-1);
  font-size: var(--text-3xl);
  font-weight: 400;
  color: var(--color-heading);
}

.inquiry__meta {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.inquiry__actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.inquiry__close {
  width: 2.25rem;
  height: 2.25rem;
  border: 0;
  border-radius: var(--radius-sm);
  background: none;
  color: var(--color-text-muted);
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
}

.inquiry__close:hover {
  background: var(--color-surface-muted);
}

.inquiry__quote {
  margin: 0;
  padding: var(--space-4) var(--space-5);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  font-family: var(--font-serif);
  font-size: var(--text-lg);
  font-style: italic;
  line-height: 1.5;
  color: var(--color-text);
  overflow-wrap: anywhere;
}

.inquiry__quote--empty {
  font-family: inherit;
  font-size: var(--text-md);
  font-style: normal;
  color: var(--color-text-muted);
}

.inquiry__facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
  gap: var(--space-3) var(--space-5);
  margin: 0;
}

.inquiry__facts dt,
.inquiry__label {
  margin: 0 0 var(--space-1);
  font-family: inherit;
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.inquiry__facts dd {
  margin: 0;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.inquiry__label--block {
  display: block;
}

.inquiry__label-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--space-3);
}

.inquiry__link {
  padding: 0;
  border: 0;
  background: none;
  color: var(--color-link);
  font: inherit;
  font-size: var(--text-sm);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 0.25em;
  cursor: pointer;
}

.inquiry__link:disabled {
  opacity: 0.5;
  cursor: default;
}

.inquiry__closed {
  margin: 0;
  color: var(--color-text-muted);
}

.follow {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  margin: var(--space-2) 0 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.follow li + li {
  border-left: 1px solid var(--color-border-strong);
}

.follow button,
.follow span {
  display: grid;
  place-items: center;
  width: 100%;
  min-height: 2.75rem;
  padding: var(--space-1) var(--space-2);
  border: 0;
  background: var(--color-surface);
  color: var(--color-text-muted);
  font: inherit;
  font-size: var(--text-sm);
  font-weight: 600;
  text-align: center;
}

.follow button {
  cursor: pointer;
}

.follow button:hover:not(:disabled) {
  background: var(--rosa-50);
  color: var(--aspar-guindo);
}

.follow .is-done span,
.follow .is-done button {
  background: var(--tone-success-bg);
  color: var(--tone-success-fg);
}

.follow .is-now span,
.follow .is-now button {
  background: var(--aspar-guindo);
  color: #fff;
}

.inquiry__cols {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-5);
}

.inquiry__error {
  margin: var(--space-1) 0 0;
  font-size: var(--text-sm);
  color: var(--color-danger);
}

.inquiry__note-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.timeline {
  display: grid;
  gap: var(--space-3);
  margin: 0;
  padding: 0 0 0 var(--space-5);
  list-style: none;
  border-left: 2px solid var(--color-border);
}

.timeline li {
  position: relative;
  display: grid;
  gap: 2px;
  font-size: var(--text-sm);
  overflow-wrap: anywhere;
}

.timeline li::before {
  content: '';
  position: absolute;
  left: calc(-1 * var(--space-5) - 7px);
  top: 0.3rem;
  width: 12px;
  height: 12px;
  border: 2px solid var(--tone-success-fg);
  border-radius: 50%;
  background: var(--color-surface);
}

.timeline small {
  color: var(--color-text-muted);
}

.inquiry__notes {
  padding-top: var(--space-5);
  border-top: 1px solid var(--color-border);
}

.box {
  display: grid;
  align-content: start;
  gap: var(--space-2);
  margin: 0;
  padding: var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.box b {
  color: var(--aspar-guindo);
}

.box--rose {
  background: var(--aspar-rosa);
  color: var(--guindo-900);
}

.box--done {
  background: var(--tone-success-bg);
  color: var(--tone-success-fg);
}

.box--done b {
  color: inherit;
}

.box .inquiry__link {
  justify-self: start;
}

@media (max-width: 760px) {
  .inquiry__cols {
    grid-template-columns: 1fr;
  }

  .follow {
    grid-template-columns: repeat(2, 1fr);
  }

  .follow li:nth-child(3) {
    border-left: 0;
  }

  .follow li:nth-child(n + 3) {
    border-top: 1px solid var(--color-border-strong);
  }
}

/* Ventanas bajas (laptops): todo el detalle entra sin desplazar */
@media (min-width: 1100px) and (max-height: 860px) {
  .inquiry {
    gap: var(--space-3);
  }

  .inquiry__who h2 {
    margin-block: var(--space-1) 0;
    font-size: var(--text-2xl);
  }

  .inquiry__quote {
    display: -webkit-box;
    overflow: hidden;
    padding: var(--space-2) var(--space-4);
    font-size: var(--text-md);
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  .follow button,
  .follow span {
    min-height: 2.25rem;
  }

  .inquiry__cols {
    gap: var(--space-4);
  }

  .inquiry__notes {
    padding-top: var(--space-3);
  }

  .box {
    padding: var(--space-3);
  }

  .box--privacy,
  .box__text {
    display: none;
  }

  #nota-llamada {
    min-height: 4.5rem;
  }
}
</style>
