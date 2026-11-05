<script setup lang="ts">
/**
 * Panel lateral del inventario (diseño pág. 11): alta de un material o edición con su
 * motivo, historial de movimientos y baja lógica con motivo. Cambiar la cantidad deja un
 * movimiento de ajuste, y por eso pide el motivo del cambio.
 */
import { computed, reactive, ref, watch } from 'vue'

import { isApiError } from '../../api/errors'
import type { ItemIn, ItemOut, MovementOut, ItemUpdate } from '../../api/types'
import { useApi } from '../../composables/useApi'
import { useToast } from '../../composables/useToast'
import { todayIso } from '../../utils/format'
import { dayLabel } from '../../utils/ops'
import { useFitLayout } from '../../composables/useFitLayout'
import { useFitRows } from '../../composables/useFitRows'
import AppAlert from '../ui/AppAlert.vue'
import AppTabs, { type TabItem } from '../ui/AppTabs.vue'
import AppButton from '../ui/AppButton.vue'
import AppModal from '../ui/AppModal.vue'
import FormField from '../ui/FormField.vue'
import StatusBadge from '../ui/StatusBadge.vue'

const CATEGORIES: { value: ItemIn['category']; label: string }[] = [
  { value: 'fisioterapia', label: 'Fisioterapia' },
  { value: 'movilidad', label: 'Apoyo a la movilidad' },
  { value: 'mobiliario', label: 'Mobiliario' },
  { value: 'papeleria', label: 'Papelería' },
  { value: 'otro', label: 'Otro' },
]
const CONDITIONS: { value: ItemIn['condition']; label: string }[] = [
  { value: 'nuevo', label: 'Nuevo' },
  { value: 'bueno', label: 'Bueno' },
  { value: 'regular', label: 'Regular' },
  { value: 'dañado', label: 'Dañado' },
]
const ORIGINS: { value: ItemIn['origin']; label: string }[] = [
  { value: 'propio', label: 'Propio' },
  { value: 'donado', label: 'Donado' },
  { value: 'alcaldia', label: 'Alcaldía' },
]
const MOVEMENTS: {
  value: 'ingreso' | 'prestamo' | 'devolucion' | 'ajuste'
  label: string
}[] = [
  { value: 'ingreso', label: 'Ingreso' },
  { value: 'prestamo', label: 'Préstamo' },
  { value: 'devolucion', label: 'Devolución' },
  { value: 'ajuste', label: 'Ajuste (corrige el conteo)' },
]

const fit = useFitLayout()
/** Datos y historial en pestañas: cada una cabe en el panel, sin desplazarse. */
type Tab = 'datos' | 'historial'
const TABS: TabItem<Tab>[] = [
  { key: 'datos', label: 'Datos' },
  { key: 'historial', label: 'Historial' },
]

const props = defineProps<{
  /** null: un material nuevo. */
  item: ItemOut | null
  /** La pestaña que estaba abierta (se conserva al guardar). */
  initialTab?: Tab
  /** Dentro de una ventana («+ Añadir material»): con su título y botón de cerrar. */
  dialog?: boolean
}>()
const emit = defineEmits<{
  saved: [item: ItemOut]
  deactivated: [item: ItemOut]
  tab: [tab: Tab]
  close: []
}>()
const tab = ref<Tab>(props.initialTab ?? 'datos')
watch(tab, (value) => emit('tab', value))

const { api, session } = useApi()
const toast = useToast()
const canManage = computed(() => session.can('inventory:manage'))

type Draft = {
  name: string
  code: string
  category: ItemIn['category']
  quantity: string
  condition: ItemIn['condition']
  origin: ItemIn['origin']
  donorOrInstitution: string
  entryDate: string
  location: string
  reason: string
}

function draftFrom(item: ItemOut | null): Draft {
  if (!item)
    return {
      name: '',
      code: '',
      category: 'fisioterapia',
      quantity: '1',
      condition: 'nuevo',
      origin: 'propio',
      donorOrInstitution: '',
      entryDate: todayIso(),
      location: '',
      reason: '',
    }
  return {
    name: item.name,
    code: item.code ?? '',
    category: item.category,
    quantity: String(item.quantity),
    condition: item.condition,
    origin: item.origin,
    donorOrInstitution: item.donorOrInstitution,
    entryDate: item.entryDate ?? '',
    location: item.location,
    reason: '',
  }
}

const draft = reactive<Draft>(draftFrom(props.item))
const saved = ref<Draft>(draftFrom(props.item))
const submitted = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)
const movements = ref<MovementOut[]>([])
const movementsError = ref<string | null>(null)
const deactivateOpen = ref(false)
const deactivateReason = ref('')
const deactivating = ref(false)
const deactivateError = ref<string | null>(null)
const movement = reactive({
  type: 'ingreso' as 'ingreso' | 'prestamo' | 'devolucion' | 'ajuste',
  quantity: '1',
  reason: '',
})
const movementError = ref<string | null>(null)
const movementSaving = ref(false)

/* En ventana completa el historial muestra los movimientos que entran, por páginas:
   así el formulario de abajo queda siempre a la vista */
const HISTORY_ROW = 52
const historyArea = ref<HTMLElement | null>(null)
const { pageSize: historySize } = useFitRows(historyArea, {
  rowHeight: HISTORY_ROW,
  fallback: 500,
  headHeight: 0,
  min: 1,
})
const historyPage = ref(1)
const historyPages = computed(() =>
  Math.max(1, Math.ceil(movements.value.length / historySize.value)),
)
const historyItems = computed(() =>
  movements.value.slice(
    (historyPage.value - 1) * historySize.value,
    historyPage.value * historySize.value,
  ),
)
const historyRange = computed(() => {
  const from = (historyPage.value - 1) * historySize.value + 1
  const to = from + historyItems.value.length - 1
  return `${from}–${to} de ${movements.value.length}`
})
watch(historySize, () => {
  historyPage.value = 1
})

watch(
  () => props.item?.id ?? 'nuevo',
  () => {
    Object.assign(draft, draftFrom(props.item))
    saved.value = draftFrom(props.item)
    submitted.value = false
    error.value = null
    void loadMovements()
  },
  { immediate: true },
)

const isNew = computed(() => props.item === null)
const quantityChanged = computed(
  () => !isNew.value && draft.quantity !== saved.value.quantity,
)
const dirty = computed(
  () =>
    isNew.value ||
    (Object.keys(draft) as (keyof Draft)[]).some(
      (key) => key !== 'reason' && draft[key] !== saved.value[key],
    ),
)

const errors = computed(() => {
  const list: Partial<Record<keyof Draft, string>> = {}
  if (draft.name.trim().length < 3)
    list.name = 'Escribe el nombre del material (al menos 3 letras).'
  if (!/^\d+$/.test(draft.quantity) || Number(draft.quantity) > 100000)
    list.quantity = 'La cantidad es un número entero.'
  if (draft.origin !== 'propio' && !draft.donorOrInstitution.trim())
    list.donorOrInstitution =
      draft.origin === 'alcaldia'
        ? 'Escribe la institución que lo entregó.'
        : 'Escribe quién lo donó.'
  if (quantityChanged.value && draft.reason.trim().length < 3)
    list.reason =
      'Cambiar la cantidad necesita un motivo, para la rendición de cuentas.'
  return list
})

function changes(): ItemUpdate {
  const next: ItemUpdate = {}
  if (draft.name.trim() !== saved.value.name) next.name = draft.name.trim()
  if (draft.code.trim() !== saved.value.code)
    next.code = draft.code.trim() || null
  if (draft.category !== saved.value.category) next.category = draft.category
  if (draft.condition !== saved.value.condition)
    next.condition = draft.condition
  if (draft.origin !== saved.value.origin) next.origin = draft.origin
  if (draft.donorOrInstitution.trim() !== saved.value.donorOrInstitution)
    next.donorOrInstitution = draft.donorOrInstitution.trim()
  if (draft.entryDate !== saved.value.entryDate)
    next.entryDate = draft.entryDate || null
  if (draft.location.trim() !== saved.value.location)
    next.location = draft.location.trim()
  if (quantityChanged.value) {
    next.quantity = Number(draft.quantity)
    next.reason = draft.reason.trim()
  }
  return next
}

async function save() {
  submitted.value = true
  error.value = null
  if (Object.keys(errors.value).length || !canManage.value || !dirty.value)
    return
  saving.value = true
  try {
    const result = isNew.value
      ? await api.inventory.create(toIn())
      : await api.inventory.update(props.item!.id, changes())
    toast.success(
      isNew.value
        ? `Añadimos ${result.name} al inventario.`
        : `Guardamos los cambios de ${result.name}.`,
    )
    emit('saved', result)
  } catch (failure) {
    error.value = isApiError(failure)
      ? failure.message
      : 'No pudimos guardar el material. Intenta de nuevo.'
  } finally {
    saving.value = false
  }
}

function toIn(): ItemIn {
  return {
    name: draft.name.trim(),
    code: draft.code.trim() || null,
    category: draft.category,
    quantity: Number(draft.quantity),
    condition: draft.condition,
    origin: draft.origin,
    donorOrInstitution:
      draft.origin === 'propio' ? '' : draft.donorOrInstitution.trim(),
    entryDate: draft.entryDate || null,
    location: draft.location.trim(),
  }
}

async function loadMovements() {
  movements.value = []
  movementsError.value = null
  historyPage.value = 1
  if (!props.item) return
  try {
    movements.value = await api.inventory.movements(props.item.id)
  } catch (failure) {
    movementsError.value = isApiError(failure)
      ? failure.message
      : 'No pudimos cargar el historial.'
  }
}

function signed(value: number) {
  return value > 0 ? `+${value}` : `${value}`
}

async function addMovement() {
  if (!props.item) return
  const quantity = Number(movement.quantity)
  if (!Number.isInteger(quantity) || quantity === 0) {
    movementError.value = 'Escribe una cantidad distinta de cero.'
    return
  }
  if (movement.type !== 'ajuste' && quantity < 0) {
    movementError.value =
      'En un ingreso, préstamo o devolución la cantidad es positiva.'
    return
  }
  // En un préstamo o una devolución el campo es la persona o familia; en lo demás, el motivo
  const text = movement.reason.trim()
  const toPerson =
    movement.type === 'prestamo' || movement.type === 'devolucion'
  if (movement.type === 'prestamo' && !text) {
    movementError.value = 'Indica a quién se presta el material.'
    return
  }
  if (movement.type === 'ajuste' && text.length < 3) {
    movementError.value = 'Un ajuste necesita el motivo.'
    return
  }
  movementSaving.value = true
  movementError.value = null
  try {
    await api.inventory.addMovement(props.item.id, {
      movementType: movement.type,
      quantity,
      reason: toPerson ? '' : text,
      counterpart: toPerson ? text : '',
    })
    toast.success('Anotamos el movimiento.')
    movement.quantity = '1'
    movement.reason = ''
    emit('saved', await api.inventory.get(props.item.id))
    await loadMovements()
  } catch (failure) {
    movementError.value = isApiError(failure)
      ? failure.message
      : 'No pudimos anotar el movimiento.'
  } finally {
    movementSaving.value = false
  }
}

async function deactivate() {
  if (!props.item) return
  if (deactivateReason.value.trim().length < 3) {
    deactivateError.value = 'Escribe el motivo de la baja (al menos 3 letras).'
    return
  }
  deactivating.value = true
  deactivateError.value = null
  try {
    const result = await api.inventory.deactivate(props.item.id, {
      reason: deactivateReason.value.trim(),
    })
    deactivateOpen.value = false
    toast.success(`Dimos de baja ${result.name}. Queda en el historial.`)
    emit('deactivated', result)
  } catch (failure) {
    deactivateError.value = isApiError(failure)
      ? failure.message
      : 'No pudimos dar de baja el material.'
  } finally {
    deactivating.value = false
  }
}

const categoryLabel = computed(
  () => CATEGORIES.find((c) => c.value === saved.value.category)?.label ?? '',
)
</script>

<template>
  <section
    class="panel surface-card"
    :class="{ 'panel--fit': fit && !dialog, 'panel--dialog': dialog }"
    aria-labelledby="panel-titulo"
  >
    <header class="panel__head">
      <p class="panel__eyebrow">{{ isNew ? 'Nuevo' : 'Editando' }}</p>
      <h2 id="panel-titulo">{{ isNew ? 'Añadir material' : item!.name }}</h2>
      <StatusBadge v-if="!isNew && item!.condition === 'dañado'" tone="danger"
        >Dañado</StatusBadge
      >
      <button
        v-if="dialog"
        type="button"
        class="panel__close"
        aria-label="Cerrar"
        @click="emit('close')"
      >
        ×
      </button>
    </header>

    <AppAlert v-if="error" tone="error">{{ error }}</AppAlert>

    <AppTabs
      v-if="!isNew"
      v-model="tab"
      :items="TABS"
      label="Datos e historial del material"
      id-prefix="material"
    />

    <div
      class="panel__tab"
      :class="{ 'panel__tab--history': !isNew && tab === 'historial' }"
      v-bind="
        isNew
          ? {}
          : {
              id: 'material-panel',
              role: 'tabpanel',
              'aria-labelledby': `material-tab-${tab}`,
            }
      "
    >
      <template v-if="isNew || tab === 'datos'">
        <form
          id="material"
          class="panel__form"
          novalidate
          @submit.prevent="save"
        >
          <FormField
            v-slot="{ id, describedBy, invalid }"
            label="Nombre"
            required
            :error="submitted ? errors.name : undefined"
          >
            <input
              :id="id"
              v-model="draft.name"
              class="input"
              maxlength="120"
              :disabled="!canManage"
              :aria-describedby="describedBy"
              :aria-invalid="invalid"
            />
          </FormField>

          <div class="panel__row">
            <FormField
              v-slot="{ id, describedBy, invalid }"
              label="Cantidad"
              required
              :error="submitted ? errors.quantity : undefined"
            >
              <input
                :id="id"
                v-model="draft.quantity"
                class="input"
                inputmode="numeric"
                :disabled="!canManage"
                :aria-describedby="describedBy"
                :aria-invalid="invalid"
              />
            </FormField>
            <FormField v-slot="{ id }" label="Condición" required>
              <select
                :id="id"
                v-model="draft.condition"
                class="select"
                :disabled="!canManage"
              >
                <option
                  v-for="option in CONDITIONS"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </FormField>
          </div>

          <div class="panel__row">
            <FormField v-slot="{ id }" label="Origen" required>
              <select
                :id="id"
                v-model="draft.origin"
                class="select"
                :disabled="!canManage"
              >
                <option
                  v-for="option in ORIGINS"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </FormField>
            <FormField v-slot="{ id }" label="Ingreso">
              <input
                :id="id"
                v-model="draft.entryDate"
                class="input"
                type="date"
                :disabled="!canManage"
              />
            </FormField>
          </div>

          <FormField
            v-if="draft.origin !== 'propio'"
            v-slot="{ id, describedBy, invalid }"
            :label="
              draft.origin === 'alcaldia' ? 'Institución' : 'Quién lo donó'
            "
            required
            :error="submitted ? errors.donorOrInstitution : undefined"
          >
            <input
              :id="id"
              v-model="draft.donorOrInstitution"
              class="input"
              maxlength="120"
              :disabled="!canManage"
              :aria-describedby="describedBy"
              :aria-invalid="invalid"
            />
          </FormField>

          <div class="panel__row">
            <FormField v-slot="{ id }" label="Categoría" required>
              <select
                :id="id"
                v-model="draft.category"
                class="select"
                :disabled="!canManage"
              >
                <option
                  v-for="option in CATEGORIES"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </FormField>
            <FormField v-slot="{ id }" label="Dónde está">
              <input
                :id="id"
                v-model="draft.location"
                class="input"
                maxlength="120"
                :disabled="!canManage"
                :placeholder="categoryLabel"
              />
            </FormField>
          </div>

          <!-- La API guarda el motivo solo cuando cambia la cantidad (queda como ajuste):
               el campo aparece entonces, para no pedir algo que no se guarda -->
          <FormField
            v-if="quantityChanged"
            v-slot="{ id, describedBy, invalid }"
            label="Motivo del cambio"
            :hint="
              fit
                ? undefined
                : 'Obligatorio al cambiar la cantidad. Por ejemplo: se compraron 2 más.'
            "
            :error="submitted ? errors.reason : undefined"
          >
            <input
              :id="id"
              v-model="draft.reason"
              class="input"
              maxlength="300"
              :disabled="!canManage"
              :aria-describedby="describedBy"
              :aria-invalid="invalid"
            />
          </FormField>
        </form>

        <footer class="panel__actions">
          <AppButton
            v-if="canManage"
            type="submit"
            form="material"
            block
            :disabled="!dirty || saving"
            :loading="saving"
            loading-label="Guardando el material…"
            @click="submitted = true"
          >
            {{ isNew ? 'Añadir material' : 'Guardar cambios' }}
          </AppButton>
          <button
            v-if="!isNew && canManage && item!.active"
            type="button"
            class="link"
            @click="deactivateOpen = true"
          >
            Dar de baja con motivo…
          </button>
        </footer>
      </template>

      <section
        v-else-if="!isNew && tab === 'historial'"
        class="history"
        aria-labelledby="historial-titulo"
      >
        <h3 id="historial-titulo" class="history__title">
          Historial de este material
        </h3>
        <AppAlert v-if="movementsError" tone="error">{{
          movementsError
        }}</AppAlert>
        <p v-else-if="!movements.length" class="muted">
          Todavía no hay movimientos.
        </p>
        <div v-else ref="historyArea" class="history__area">
          <ol class="history__list">
            <li v-for="row in historyItems" :key="row.id">
              <div>
                <strong
                  >{{ row.movementLabel
                  }}{{ row.counterpart ? ` · ${row.counterpart}` : '' }}</strong
                >
                <small
                  >{{ row.reason ? `${row.reason} · ` : ''
                  }}{{ row.userName }} ·
                  {{
                    dayLabel(row.createdAt.slice(0, 10)).replace(/^[^,]+, /, '')
                  }}</small
                >
              </div>
              <span
                class="delta"
                :class="{ 'is-minus': row.quantityDelta < 0 }"
                >{{ signed(row.quantityDelta) }}</span
              >
            </li>
          </ol>
        </div>
        <nav
          v-if="historyPages > 1"
          class="history__pager"
          aria-label="Páginas del historial"
        >
          <button
            type="button"
            class="history__step"
            aria-label="Movimientos más recientes"
            :disabled="historyPage === 1"
            @click="historyPage -= 1"
          >
            ‹
          </button>
          <span aria-live="polite">{{ historyRange }}</span>
          <button
            type="button"
            class="history__step"
            aria-label="Movimientos anteriores"
            :disabled="historyPage === historyPages"
            @click="historyPage += 1"
          >
            ›
          </button>
        </nav>

        <form
          v-if="canManage && item!.active"
          class="movement"
          novalidate
          @submit.prevent="addMovement"
        >
          <h4>Registrar movimiento</h4>
          <div class="panel__row">
            <FormField v-slot="{ id }" label="Tipo">
              <select :id="id" v-model="movement.type" class="select">
                <option
                  v-for="option in MOVEMENTS"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </FormField>
            <FormField v-slot="{ id }" label="Unidades">
              <input
                :id="id"
                v-model="movement.quantity"
                class="input"
                inputmode="numeric"
              />
            </FormField>
          </div>
          <FormField
            v-slot="{ id }"
            :label="
              movement.type === 'prestamo' || movement.type === 'devolucion'
                ? 'Persona o familia'
                : 'Motivo'
            "
            :hint="
              fit
                ? undefined
                : movement.type === 'prestamo'
                  ? 'Obligatorio en un préstamo.'
                  : movement.type === 'ajuste'
                    ? 'Obligatorio en un ajuste.'
                    : undefined
            "
          >
            <input
              :id="id"
              v-model="movement.reason"
              class="input"
              maxlength="300"
            />
          </FormField>
          <AppAlert v-if="movementError" tone="error">{{
            movementError
          }}</AppAlert>
          <AppButton
            variant="secondary"
            size="sm"
            type="submit"
            :loading="movementSaving"
            loading-label="Anotando…"
          >
            Anotar movimiento
          </AppButton>
        </form>
      </section>
    </div>

    <AppModal
      v-model:open="deactivateOpen"
      size="sm"
      title="Dar de baja el material"
      description="Queda en el historial con el motivo. La cantidad pasa a cero."
      :dismissible="!deactivating"
    >
      <form
        id="baja-material"
        class="deactivate"
        novalidate
        @submit.prevent="deactivate"
      >
        <AppAlert v-if="deactivateError" tone="error">{{
          deactivateError
        }}</AppAlert>
        <FormField
          v-slot="{ id, describedBy, invalid }"
          label="Motivo de la baja"
          required
        >
          <textarea
            :id="id"
            v-model="deactivateReason"
            class="textarea"
            rows="3"
            maxlength="300"
            :aria-describedby="describedBy"
            :aria-invalid="invalid"
          />
        </FormField>
      </form>
      <template #actions>
        <AppButton
          variant="secondary"
          :disabled="deactivating"
          @click="deactivateOpen = false"
          >Volver</AppButton
        >
        <AppButton
          type="submit"
          form="baja-material"
          variant="danger"
          :loading="deactivating"
          loading-label="Dando de baja…"
          >Dar de baja</AppButton
        >
      </template>
    </AppModal>
  </section>
</template>

<style scoped>
.panel {
  display: grid;
  align-content: start;
  gap: var(--space-4);
  min-width: 0;
  padding: var(--space-5) var(--space-6);
}

/* El contenido de la pestaña abierta: conserva el espaciado del panel */
.panel__tab {
  display: grid;
  gap: inherit;
  min-width: 0;
}

.panel__head {
  position: relative;
  display: grid;
  gap: var(--space-1);
  justify-items: start;
}

.panel__close {
  position: absolute;
  top: 0;
  right: 0;
  width: 2.25rem;
  height: 2.25rem;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
}

.panel__close:hover {
  background: var(--color-surface-muted);
  color: var(--color-text);
}

.panel--dialog {
  padding: var(--space-6);
}

.panel__eyebrow {
  color: var(--aspar-rojo);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.panel__head h2 {
  font-family: var(--font-serif);
  font-size: var(--text-xl);
  font-weight: 500;
  color: var(--color-text);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel__form,
.movement {
  display: grid;
  gap: clamp(var(--space-2), 1.4vh, var(--space-3));
  min-width: 0;
}

.panel__row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}

/* Las fechas del navegador no empujan su columna */
.panel :deep(.input),
.panel :deep(.select) {
  width: 100%;
  min-width: 0;
}

.panel__actions {
  display: grid;
  gap: var(--space-2);
  justify-items: center;
}

.link {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-link);
  font: inherit;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 0.25em;
  cursor: pointer;
}

.history {
  display: grid;
  gap: var(--space-2);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}

.history__title {
  font-family: var(--font-serif);
  font-size: var(--text-lg);
  font-weight: 500;
  color: var(--color-text);
}

.history__list {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.history__list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border);
  font-size: var(--text-sm);
}

.history__list li div {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
}

.history__list small,
.muted {
  color: var(--color-text-muted);
  font-size: var(--text-xs);
}

.delta {
  font-weight: 700;
  color: var(--verde-700);
  font-variant-numeric: tabular-nums;
}

.delta.is-minus {
  color: var(--aspar-rojo);
}

.history__pager {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  font-variant-numeric: tabular-nums;
}

.history__step {
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.history__step:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.movement h4 {
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--color-text);
}

.deactivate {
  display: grid;
  gap: var(--space-3);
}

@media (max-width: 640px) {
  .panel {
    padding: var(--space-4);
  }
}

/* Ventana completa: el panel entra en el alto de la columna, sin desplazarse */
.panel--fit {
  gap: 0.6rem;
  padding: 0.85rem 1rem;
}
/* El nombre ya está resaltado en la tabla: el encabezado queda solo para lectores */
.panel--fit .panel__head {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.panel--fit .panel__form,
.panel--fit .movement {
  gap: 0.4rem;
}
.panel--fit .panel__row {
  gap: 0.5rem;
}
.panel--fit :deep(.field) {
  gap: 0.15rem;
}
.panel--fit :deep(.input),
.panel--fit :deep(.select) {
  min-height: 2.2rem;
  height: 2.2rem;
  padding-block: 0.2rem;
}
.panel--fit .panel__actions {
  gap: 0.25rem;
}
.panel--fit .history {
  gap: 0.4rem;
  padding-top: 0.5rem;
}
/* El historial ocupa el alto que queda: la lista se pagina y el formulario no se mueve */
.panel--fit {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* Encabezado, pestañas y datos guardan su alto; solo el historial toma el que queda */
.panel--fit > * {
  flex: none;
}

.panel--fit .panel__tab {
  min-height: 0;
}

.panel--fit :deep(.tabs__tab) {
  min-height: 2.3rem;
}

.panel--fit .panel__tab--history {
  flex: 1 1 0;
}

.panel--fit .history {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.panel--fit .history__area {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
}

.panel--fit .history__list li {
  height: 52px;
  padding-block: 0;
}

.panel--fit .history__list strong,
.panel--fit .history__list small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Ventanas bajas (1280×720): campos más juntos y «Dar de baja» junto a «Guardar»,
   para que los datos de un bien donado o de la Alcaldía también entren */
@media (max-height: 760px) {
  .panel--fit {
    gap: 0.45rem;
    padding-block: 0.65rem;
  }

  .panel--fit .panel__form {
    gap: 0.3rem;
  }

  .panel--fit :deep(.field) {
    gap: 0.1rem;
  }

  .panel--fit :deep(.field__label) {
    font-size: var(--text-xs);
  }

  .panel--fit :deep(.input),
  .panel--fit :deep(.select) {
    min-height: 2rem;
    height: 2rem;
  }

  .panel--fit .panel__actions {
    gap: 0.15rem;
  }
}
</style>
