<script setup lang="ts">
/**
 * Panel de un aporte (diseño pág. 15). Un QR bancario pendiente se confirma con la
 * referencia del extracto y la fecha de acreditación, o se anula con un motivo si no
 * aparece en el banco. Los demás muestran su detalle. Nada se borra.
 */
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'

import { isApiError } from '../../api/errors'
import type { DonationOut } from '../../api/types'
import { useApi } from '../../composables/useApi'
import { todayIso } from '../../utils/format'
import {
  DONATION_STATUS_TONES,
  formatBs,
  pendingSince,
} from '../../utils/donations'
import { shortDayLabel } from '../../utils/ops'
import AppAlert from '../ui/AppAlert.vue'
import AppButton from '../ui/AppButton.vue'
import AppModal from '../ui/AppModal.vue'
import FormField from '../ui/FormField.vue'
import StatusBadge from '../ui/StatusBadge.vue'

const props = defineProps<{ donation: DonationOut }>()
const emit = defineEmits<{
  updated: [donation: DonationOut]
  close: []
}>()

const { api } = useApi()

const reference = ref('')
const creditedOn = ref(todayIso())
const submitted = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)

const cancelOpen = ref(false)
const cancelReason = ref('')
const cancelling = ref(false)
const cancelError = ref<string | null>(null)

watch(
  () => props.donation.id,
  () => {
    reference.value = props.donation.declaredReference ?? ''
    creditedOn.value = todayIso()
    submitted.value = false
    error.value = null
  },
  { immediate: true },
)

const pending = computed(() => props.donation.status === 'pendiente')

const referenceError = computed(() =>
  reference.value.trim().length < 3
    ? 'Escribe la referencia que aparece en el extracto.'
    : null,
)
const dateError = computed(() => {
  if (!creditedOn.value) return 'Elige la fecha de acreditación.'
  if (creditedOn.value > todayIso())
    return 'La fecha de acreditación no puede ser futura.'
  return null
})

/** Las filas del cuadro de datos, según el canal y el estado. */
const details = computed(() => {
  const d = props.donation
  const rows: { label: string; value: string }[] = [
    { label: 'Donante', value: d.donorName ?? 'Anónimo' },
  ]
  if (d.donorContact) rows.push({ label: 'Contacto', value: d.donorContact })
  if (d.channel === 'especie') {
    rows.push({ label: 'Qué llegó', value: d.inKindDescription ?? '' })
    if (d.estimatedValueBs !== null)
      rows.push({
        label: 'Valor estimado',
        value: `${formatBs(d.estimatedValueBs)} (no suma a la meta)`,
      })
  } else {
    rows.push({
      label: pending.value ? 'Monto avisado' : 'Monto',
      value: formatBs(d.amountBs),
    })
  }
  rows.push({
    label: 'Canal',
    value: `${d.channelLabel} · ${d.source === 'sitio' ? 'Sitio web' : 'En la sede'}`,
  })
  if (d.declaredReference)
    rows.push({
      label: d.channel === 'efectivo' ? 'Recibo' : 'Comprobante',
      value: d.declaredReference,
    })
  if (d.bankReference) rows.push({ label: 'Extracto', value: d.bankReference })
  if (d.creditedOn)
    rows.push({ label: 'Acreditado', value: shortDayLabel(d.creditedOn) })
  // La fecha ya está en la tabla; en el detalle se muestra
  if (!pending.value)
    rows.push({ label: 'Recibido', value: shortDayLabel(d.date) })
  if (d.channel !== 'especie') rows.push({ label: 'Destino', value: d.purpose })
  return rows
})

const headline = computed(() => {
  if (pending.value) return 'Confirmar aporte'
  if (props.donation.status === 'anulado') return 'Aporte anulado'
  return 'Detalle del aporte'
})

async function confirm() {
  submitted.value = true
  error.value = null
  if (referenceError.value || dateError.value) return
  saving.value = true
  try {
    const saved = await api.donations.confirm(props.donation.id, {
      bankReference: reference.value.trim(),
      creditedOn: creditedOn.value,
    })
    emit('updated', saved)
  } catch (failure) {
    error.value = isApiError(failure)
      ? failure.message
      : 'No pudimos confirmar el aporte. Intenta de nuevo.'
  } finally {
    saving.value = false
  }
}

function openCancel() {
  cancelReason.value = 'No se encontró en el extracto.'
  cancelError.value = null
  cancelOpen.value = true
}

async function cancel() {
  if (cancelReason.value.trim().length < 3) {
    cancelError.value = 'Escribe el motivo (al menos 3 letras).'
    return
  }
  cancelling.value = true
  cancelError.value = null
  try {
    const saved = await api.donations.cancel(props.donation.id, {
      reason: cancelReason.value.trim(),
    })
    cancelOpen.value = false
    emit('updated', saved)
  } catch (failure) {
    cancelError.value = isApiError(failure)
      ? failure.message
      : 'No pudimos anular el aporte. Intenta de nuevo.'
  } finally {
    cancelling.value = false
  }
}
</script>

<template>
  <section class="panel surface-card" aria-labelledby="aporte-titulo">
    <header class="panel__head">
      <StatusBadge :tone="DONATION_STATUS_TONES[donation.status]">
        {{ pending ? pendingSince(donation.createdAt) : donation.statusLabel }}
      </StatusBadge>
      <button
        type="button"
        class="panel__close"
        aria-label="Cerrar el aporte"
        @click="emit('close')"
      >
        ×
      </button>
    </header>
    <div class="panel__title">
      <h2 id="aporte-titulo">{{ headline }}</h2>
      <p v-if="pending" class="panel__help">
        Busca el ingreso en el extracto antes de confirmarlo.
      </p>
    </div>

    <dl class="facts">
      <div v-for="row in details" :key="row.label">
        <dt>{{ row.label }}</dt>
        <dd :title="row.value">{{ row.value }}</dd>
      </div>
    </dl>

    <AppAlert v-if="donation.status === 'anulado'" tone="neutral">
      Motivo: {{ donation.cancellationReason }}
    </AppAlert>
    <RouterLink
      v-if="donation.inventoryItemId"
      class="link"
      :to="{
        name: 'inventario',
        query: { material: donation.inventoryItemId },
      }"
    >
      Ver el material en el inventario →
    </RouterLink>

    <form v-if="pending" class="confirm" novalidate @submit.prevent="confirm">
      <AppAlert v-if="error" tone="error">{{ error }}</AppAlert>
      <div class="confirm__row">
        <FormField
          v-slot="{ id, describedBy, invalid }"
          label="Ref. del extracto"
          required
          :error="submitted ? (referenceError ?? undefined) : undefined"
        >
          <input
            :id="id"
            v-model="reference"
            class="input"
            maxlength="60"
            autocomplete="off"
            :aria-describedby="describedBy"
            :aria-invalid="invalid"
          />
        </FormField>
        <FormField
          v-slot="{ id, describedBy, invalid }"
          label="Acreditado el"
          required
          :error="submitted ? (dateError ?? undefined) : undefined"
        >
          <input
            :id="id"
            v-model="creditedOn"
            class="input"
            type="date"
            :max="todayIso()"
            :aria-describedby="describedBy"
            :aria-invalid="invalid"
          />
        </FormField>
      </div>
      <AppButton
        type="submit"
        class="confirm__button"
        block
        :loading="saving"
        loading-label="Confirmando…"
      >
        Confirmar ingreso de {{ formatBs(donation.amountBs) }}
      </AppButton>
      <button type="button" class="link link--center" @click="openCancel">
        No aparece en el banco · anular con motivo
      </button>
    </form>

    <AppModal
      v-model:open="cancelOpen"
      size="sm"
      title="Anular el aporte"
      description="Queda en el historial con el motivo. No suma a la meta."
      :dismissible="!cancelling"
    >
      <div class="cancel">
        <AppAlert v-if="cancelError" tone="error">{{ cancelError }}</AppAlert>
        <FormField
          v-slot="{ id, describedBy, invalid }"
          label="Motivo"
          required
        >
          <textarea
            :id="id"
            v-model="cancelReason"
            class="textarea"
            rows="3"
            maxlength="300"
            :aria-describedby="describedBy"
            :aria-invalid="invalid"
          />
        </FormField>
      </div>
      <template #actions>
        <AppButton
          variant="secondary"
          :disabled="cancelling"
          @click="cancelOpen = false"
        >
          Volver
        </AppButton>
        <AppButton
          variant="danger"
          :loading="cancelling"
          loading-label="Anulando…"
          @click="cancel"
        >
          Anular aporte
        </AppButton>
      </template>
    </AppModal>
  </section>
</template>

<style scoped>
.panel {
  display: grid;
  align-content: start;
  gap: var(--space-3);
  min-width: 0;
  padding: var(--space-5);
}

.panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.panel__close {
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

.panel__close:hover {
  background: var(--color-surface-muted);
  color: var(--color-text);
}

.panel__title h2 {
  font-family: var(--font-serif);
  font-size: var(--text-xl);
  font-weight: 500;
}

.panel__title p {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.facts {
  display: grid;
  gap: 0.35rem;
  margin: 0;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  font-size: var(--text-sm);
}

.facts {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: var(--space-3);
}

/* Cada dato con su etiqueta arriba: dos por fila, para que el panel entre */
.facts div {
  display: grid;
  gap: 0;
  min-width: 0;
}

.facts dt {
  font-size: var(--text-xs);
}

.confirm__row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
  align-items: start;
}

.facts dt {
  color: var(--color-text-muted);
}

.facts dd {
  margin: 0;
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.confirm,
.cancel {
  display: grid;
  gap: var(--space-3);
}

.confirm :deep(.input) {
  width: 100%;
  min-width: 0;
}

/* El botón de confirmar va en verde, como en el diseño: suma a la meta */
.confirm .confirm__button {
  --btn-bg: var(--aspar-verde);
  --btn-border: var(--verde-950);
}

.confirm .confirm__button:hover:not(:disabled) {
  --btn-bg: var(--verde-950);
}

.link {
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

.link--center {
  justify-self: center;
}

/* Ventanas bajas: más junto, para que el panel entre sin desplazarse */
@media (max-height: 820px) {
  .panel {
    gap: var(--space-2);
    padding: var(--space-4);
  }

  .facts {
    gap: 0.2rem;
    padding: var(--space-2) var(--space-3);
  }

  .panel__help {
    display: none;
  }

  .panel__title h2 {
    font-size: var(--text-lg);
  }

  .panel {
    padding: var(--space-3) var(--space-4);
  }

  .facts dd {
    line-height: 1.25;
  }
}

/* Ventanas muy bajas (1280×720): los datos en letra más chica */
@media (max-height: 760px) {
  .facts {
    font-size: var(--text-xs);
  }

  .panel__head :deep(.badge) {
    font-size: var(--text-xs);
  }

  .confirm {
    gap: var(--space-2);
  }

  .confirm :deep(.field) {
    gap: 0.15rem;
  }

  .confirm :deep(.input) {
    min-height: 2.3rem;
    height: 2.3rem;
  }
}
</style>
