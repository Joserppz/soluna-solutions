<script setup lang="ts">
/**
 * «Registrar un aporte recibido» (diseño pág. 16): lo que llega en mano a la sede.
 *
 * - Efectivo: queda confirmado y suma a la meta.
 * - QR bancario: la persona transfiere en la sede; queda por confirmar con el extracto,
 *   igual que un aviso del sitio.
 * - En especie: queda recibido y, si se marca, se crea el material en el inventario.
 */
import { computed, reactive, ref, watch } from 'vue'

import { isApiError } from '../../api/errors'
import type { DonationManualIn, DonationOut } from '../../api/types'
import { useApi } from '../../composables/useApi'
import { todayIso } from '../../utils/format'
import { DONATION_STATUS_TONES } from '../../utils/donations'
import AppAlert from '../ui/AppAlert.vue'
import AppButton from '../ui/AppButton.vue'
import AppModal from '../ui/AppModal.vue'
import FormField from '../ui/FormField.vue'
import StatusBadge from '../ui/StatusBadge.vue'

type Channel = DonationManualIn['channel']

const CHANNEL_CARDS: { value: Channel; label: string; hint: string }[] = [
  { value: 'efectivo', label: 'Efectivo', hint: 'En la sede' },
  { value: 'qr_bancario', label: 'QR bancario', hint: 'Transferencia' },
  { value: 'especie', label: 'En especie', hint: 'Materiales o equipos' },
]

const CONDITIONS: {
  value: NonNullable<DonationManualIn['condition']>
  label: string
}[] = [
  { value: 'nuevo', label: 'Nuevo' },
  { value: 'bueno', label: 'Bueno' },
  { value: 'regular', label: 'Regular' },
  { value: 'dañado', label: 'Dañado' },
]

const CATEGORIES: {
  value: NonNullable<DonationManualIn['category']>
  label: string
}[] = [
  { value: 'fisioterapia', label: 'Fisioterapia' },
  { value: 'movilidad', label: 'Apoyo a la movilidad' },
  { value: 'mobiliario', label: 'Mobiliario' },
  { value: 'papeleria', label: 'Papelería' },
  { value: 'otro', label: 'Otro' },
]

/** Cómo queda el aporte al registrarlo (el pie de la ventana lo dice). */
const RESULT: Record<
  Channel,
  { status: DonationOut['status']; label: string }
> = {
  efectivo: { status: 'confirmado', label: 'Confirmado' },
  qr_bancario: { status: 'pendiente', label: 'Por confirmar' },
  especie: { status: 'recibido', label: 'Recibido' },
}

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  created: [donation: DonationOut]
}>()

const { api } = useApi()

function emptyForm() {
  return {
    channel: 'efectivo' as Channel,
    donorName: '',
    donorContact: '',
    amount: '',
    receiptNumber: '',
    date: todayIso(),
    description: '',
    quantity: '1',
    condition: 'nuevo' as NonNullable<DonationManualIn['condition']>,
    category: 'otro' as NonNullable<DonationManualIn['category']>,
    estimatedValue: '',
    addToInventory: true,
  }
}

const form = reactive(emptyForm())
const submitted = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    Object.assign(form, emptyForm())
    submitted.value = false
    error.value = null
  },
)

const inKind = computed(() => form.channel === 'especie')
const result = computed(() => RESULT[form.channel])

function parseAmount(value: string): number | null {
  const clean = value.replace(/\s/g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null
  return Number(clean)
}

const errors = computed(() => {
  const list: Partial<Record<string, string>> = {}
  const name = form.donorName.trim()
  if (name && name.length < 2)
    list.donorName = 'Escribe el nombre o déjalo vacío si es anónimo.'
  if (!form.date) list.date = 'Elige la fecha en que llegó.'
  else if (form.date > todayIso())
    list.date = 'La fecha de recepción no puede ser futura.'
  if (inKind.value) {
    if (form.description.trim().length < 3)
      list.description = 'Describe qué se recibió (al menos 3 letras).'
    const quantity = Number(form.quantity)
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000)
      list.quantity = 'La cantidad es un número entero desde 1.'
    if (form.estimatedValue.trim()) {
      const value = parseAmount(form.estimatedValue)
      if (value === null || value <= 0)
        list.estimatedValue = 'Escribe el valor en bolivianos o déjalo vacío.'
    }
  } else {
    const amount = parseAmount(form.amount)
    if (amount === null || amount <= 0 || amount > 100000)
      list.amount = 'Escribe el monto en bolivianos, hasta Bs. 100.000.'
  }
  return list
})

/** «Pelotas de terapia · 6 · Nuevo · Origen: donado» */
const inventoryLine = computed(() => {
  const condition =
    CONDITIONS.find((item) => item.value === form.condition)?.label ?? ''
  const what = form.description.trim() || 'El material'
  return `«${what} · ${form.quantity || 1} · ${condition} · Origen: donado»`
})

function payload(): DonationManualIn {
  const base = {
    channel: form.channel,
    donorName: form.donorName.trim() || null,
    donorContact: form.donorContact.trim() || null,
    date: form.date,
  }
  if (inKind.value)
    return {
      ...base,
      inKindDescription: form.description.trim(),
      quantity: Number(form.quantity),
      condition: form.condition,
      category: form.category,
      estimatedValueBs: form.estimatedValue.trim()
        ? parseAmount(form.estimatedValue)
        : null,
      addToInventory: form.addToInventory,
    }
  return {
    ...base,
    amountBs: parseAmount(form.amount),
    receiptNumber: form.receiptNumber.trim() || null,
  }
}

async function save() {
  submitted.value = true
  error.value = null
  if (Object.keys(errors.value).length) return
  saving.value = true
  try {
    const created = await api.donations.registerReceived(payload())
    emit('created', created)
    emit('update:open', false)
  } catch (failure) {
    error.value = isApiError(failure)
      ? failure.message
      : 'No pudimos registrar el aporte. Intenta de nuevo.'
  } finally {
    saving.value = false
  }
}

function shown(key: string) {
  return submitted.value ? errors.value[key] : undefined
}
</script>

<template>
  <AppModal
    :open="open"
    size="lg"
    title="Registrar un aporte recibido"
    description="Para lo que llega en mano, por transferencia o como material."
    :dismissible="!saving"
    @update:open="emit('update:open', $event)"
  >
    <form
      id="registrar-aporte"
      class="register"
      novalidate
      @submit.prevent="save"
    >
      <AppAlert v-if="error" tone="error">{{ error }}</AppAlert>

      <fieldset class="channels">
        <legend>¿Cómo llegó?</legend>
        <label
          v-for="card in CHANNEL_CARDS"
          :key="card.value"
          class="channel"
          :class="{ 'is-selected': form.channel === card.value }"
        >
          <input
            v-model="form.channel"
            type="radio"
            name="canal"
            :value="card.value"
            class="visually-hidden"
          />
          <strong>{{ card.label }}</strong>
          <small>{{ card.hint }}</small>
        </label>
      </fieldset>

      <div class="register__row">
        <FormField
          v-slot="{ id, describedBy, invalid }"
          label="Quién lo entrega"
          :error="shown('donorName')"
        >
          <input
            :id="id"
            v-model="form.donorName"
            class="input"
            maxlength="120"
            placeholder="Vacío si es anónimo"
            :aria-describedby="describedBy"
            :aria-invalid="invalid"
          />
        </FormField>
        <FormField v-slot="{ id }" label="Teléfono de contacto">
          <input
            :id="id"
            v-model="form.donorContact"
            class="input"
            maxlength="120"
            inputmode="tel"
            placeholder="Opcional · para agradecer"
          />
        </FormField>
      </div>

      <template v-if="inKind">
        <div class="register__row register__row--thing">
          <FormField
            v-slot="{ id, describedBy, invalid }"
            label="¿Qué se recibió?"
            required
            :error="shown('description')"
          >
            <input
              :id="id"
              v-model="form.description"
              class="input"
              maxlength="300"
              :aria-describedby="describedBy"
              :aria-invalid="invalid"
            />
          </FormField>
          <FormField
            v-slot="{ id, describedBy, invalid }"
            label="Cantidad"
            required
            :error="shown('quantity')"
          >
            <input
              :id="id"
              v-model="form.quantity"
              class="input"
              inputmode="numeric"
              :aria-describedby="describedBy"
              :aria-invalid="invalid"
            />
          </FormField>
          <FormField v-slot="{ id }" label="Condición" required>
            <select :id="id" v-model="form.condition" class="select">
              <option
                v-for="item in CONDITIONS"
                :key="item.value"
                :value="item.value"
              >
                {{ item.label }}
              </option>
            </select>
          </FormField>
        </div>
        <div class="register__row register__row--three">
          <FormField
            v-slot="{ id, describedBy, invalid }"
            label="Fecha de recepción"
            required
            :error="shown('date')"
          >
            <input
              :id="id"
              v-model="form.date"
              class="input"
              type="date"
              :max="todayIso()"
              :aria-describedby="describedBy"
              :aria-invalid="invalid"
            />
          </FormField>
          <FormField
            v-slot="{ id, describedBy, invalid }"
            label="Valor estimado (Bs.)"
            :error="shown('estimatedValue')"
          >
            <input
              :id="id"
              v-model="form.estimatedValue"
              class="input"
              inputmode="decimal"
              placeholder="Opcional · no suma a la meta"
              :aria-describedby="describedBy"
              :aria-invalid="invalid"
            />
          </FormField>
          <FormField v-slot="{ id }" label="Categoría">
            <select
              :id="id"
              v-model="form.category"
              class="select"
              :disabled="!form.addToInventory"
            >
              <option
                v-for="item in CATEGORIES"
                :key="item.value"
                :value="item.value"
              >
                {{ item.label }}
              </option>
            </select>
          </FormField>
        </div>
        <label class="inventory" :class="{ 'is-on': form.addToInventory }">
          <input v-model="form.addToInventory" type="checkbox" />
          <span>
            <strong>Agregar al inventario como material donado</strong>
            <small v-if="form.addToInventory"
              >Se crea el registro {{ inventoryLine }}, con el nombre de quien
              lo entregó.</small
            >
            <small v-else>Queda solo en el registro de aportes.</small>
          </span>
        </label>
      </template>

      <div v-else class="register__row register__row--three">
        <FormField
          v-slot="{ id, describedBy, invalid }"
          label="Monto (Bs.)"
          required
          :error="shown('amount')"
        >
          <input
            :id="id"
            v-model="form.amount"
            class="input"
            inputmode="decimal"
            :aria-describedby="describedBy"
            :aria-invalid="invalid"
          />
        </FormField>
        <FormField
          v-slot="{ id }"
          :label="
            form.channel === 'efectivo'
              ? 'Nro. de recibo'
              : 'Nro. de comprobante'
          "
        >
          <input
            :id="id"
            v-model="form.receiptNumber"
            class="input"
            maxlength="60"
            placeholder="Opcional"
          />
        </FormField>
        <FormField
          v-slot="{ id, describedBy, invalid }"
          label="Fecha de recepción"
          required
          :error="shown('date')"
        >
          <input
            :id="id"
            v-model="form.date"
            class="input"
            type="date"
            :max="todayIso()"
            :aria-describedby="describedBy"
            :aria-invalid="invalid"
          />
        </FormField>
      </div>

      <p v-if="form.channel === 'qr_bancario'" class="register__note">
        Se confirma después, cuando el ingreso aparezca en el extracto del
        banco.
      </p>
    </form>

    <template #actions>
      <p class="result">
        Quedará como
        <StatusBadge :tone="DONATION_STATUS_TONES[result.status]">{{
          result.label
        }}</StatusBadge>
        con tu nombre y la hora.
      </p>
      <AppButton
        variant="secondary"
        :disabled="saving"
        @click="emit('update:open', false)"
      >
        Cancelar
      </AppButton>
      <AppButton
        type="submit"
        form="registrar-aporte"
        :loading="saving"
        loading-label="Registrando…"
      >
        Registrar aporte
      </AppButton>
    </template>
  </AppModal>
</template>

<style scoped>
.register {
  display: grid;
  gap: var(--space-4);
}

.channels {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  border: 0;
}

.channels legend {
  margin-bottom: var(--space-2);
  font-size: var(--text-sm);
  font-weight: 600;
}

.channel {
  display: grid;
  gap: 0.1rem;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  cursor: pointer;
}

.channel small {
  color: var(--color-text-muted);
  font-size: var(--text-xs);
}

.channel.is-selected {
  border: 2px solid var(--aspar-guindo);
  background: var(--rosa-50);
  padding: calc(var(--space-3) - 1px) calc(var(--space-4) - 1px);
}

.channel:has(input:focus-visible) {
  box-shadow: var(--focus-ring);
}

.register__row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}

.register__row--three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.register__row--thing {
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr);
}

.register :deep(.input),
.register :deep(.select) {
  width: 100%;
  min-width: 0;
}

.inventory {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  cursor: pointer;
}

.inventory.is-on {
  background: var(--verde-50);
}

.inventory input {
  margin-top: 0.2rem;
}

.inventory span {
  display: grid;
  gap: 0.15rem;
}

.inventory small,
.register__note {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.result {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  margin-right: auto;
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

/* Ventanas bajas: campos más juntos para que todo entre sin desplazarse */
@media (max-height: 800px) {
  .register {
    gap: var(--space-3);
  }

  .register :deep(.field) {
    gap: 0.15rem;
  }

  .register :deep(.input),
  .register :deep(.select) {
    min-height: 2.4rem;
    height: 2.4rem;
  }
}

@media (max-width: 640px) {
  .channels,
  .register__row,
  .register__row--three,
  .register__row--thing {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
