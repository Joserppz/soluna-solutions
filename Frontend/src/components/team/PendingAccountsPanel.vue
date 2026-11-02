<script setup lang="ts">
/**
 * Cuentas «Pendientes de aprobación»: personas que se registraron desde el sitio (con
 * correo o con Google) y todavía no tienen rol. Administración les asigna uno de los
 * roles. Si la persona no confirmó su correo, todavía no se puede aprobar.
 */
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'

import { isApiError } from '../../api/errors'
import type { RoleOut, UserOut, UserPage } from '../../api/types'
import { useApi } from '../../composables/useApi'
import { useFitRows } from '../../composables/useFitRows'
import { useToast } from '../../composables/useToast'
import { firstName, shortDay } from '../../utils/format'
import AppAlert from '../ui/AppAlert.vue'
import AppButton from '../ui/AppButton.vue'
import AppPagination from '../ui/AppPagination.vue'
import DataTable, { type Column } from '../ui/DataTable.vue'
import InitialsAvatar from '../ui/InitialsAvatar.vue'
import StatusBadge from '../ui/StatusBadge.vue'

defineProps<{ roles: RoleOut[] }>()
const emit = defineEmits<{ changed: [] }>()

const SCROLL_PAGE_SIZE = 10
const ROW_HEIGHT = 56

const { api } = useApi()
const toast = useToast()

const list = ref<UserPage | null>(null)
const offset = ref(0)
const loading = ref(true)
const loadError = ref<string | null>(null)
const approving = ref<string | null>(null)
/** Rol elegido para cada cuenta (vacío hasta que se elige). */
const chosen = reactive<Record<string, string>>({})

const tableArea = ref<HTMLElement | null>(null)
const { fit, pageSize } = useFitRows(tableArea, {
  rowHeight: ROW_HEIGHT,
  fallback: SCROLL_PAGE_SIZE,
})

const columns: Column[] = [
  { key: 'person', label: 'Persona' },
  { key: 'requested', label: 'Pidió acceso' },
  { key: 'email', label: 'Correo' },
  { key: 'role', label: 'Rol a asignar' },
  { key: 'actions', label: 'Acciones', hideLabel: true, align: 'end' },
]

const rows = computed(() => list.value?.items ?? [])

let request = 0

async function load() {
  const current = ++request
  loading.value = true
  loadError.value = null
  try {
    const result = await api.users.list({
      role: 'pendiente',
      limit: pageSize.value,
      offset: offset.value,
    })
    if (current !== request) return
    if (!result.items.length && offset.value > 0) {
      offset.value = Math.max(0, offset.value - pageSize.value)
      return
    }
    list.value = result
  } catch (failure) {
    if (current !== request) return
    loadError.value = isApiError(failure)
      ? failure.message
      : 'No pudimos cargar las cuentas pendientes. Intenta de nuevo.'
  } finally {
    if (current === request) loading.value = false
  }
}

watch(offset, load)
let ready = false
watch(pageSize, () => {
  if (!ready) return
  if (offset.value === 0) void load()
  else offset.value = 0
})

async function approve(user: UserOut) {
  const role = chosen[user.id]
  if (!role) return
  approving.value = user.id
  try {
    const approved = await api.users.approve(user.id, { role })
    toast.success(
      `Aprobamos a ${firstName(approved.name)} como ${approved.roleName}. Ya puede entrar.`,
    )
    delete chosen[user.id]
    emit('changed')
  } catch (failure) {
    toast.error(
      isApiError(failure)
        ? failure.message
        : 'No pudimos aprobar la cuenta. Intenta de nuevo.',
    )
  } finally {
    approving.value = null
  }
}

onMounted(async () => {
  await nextTick()
  await nextTick()
  ready = true
  void load()
})

defineExpose({ reload: load })
</script>

<template>
  <div class="pending" :class="{ 'pending--fit': fit }">
    <p class="pending__intro">
      Personas que crearon su cuenta desde el sitio. Revisa que sean del equipo
      y asígnales el rol con el acceso justo para su tarea. Solo se aprueba a
      quien ya confirmó su correo.
    </p>

    <AppAlert v-if="loadError" tone="error">
      {{ loadError }}
      <AppButton variant="link" size="sm" @click="load">Reintentar</AppButton>
    </AppAlert>

    <div
      ref="tableArea"
      class="pending__table"
      :class="{ 'is-refreshing': loading && list }"
    >
      <DataTable
        :columns="columns"
        :rows="rows"
        :row-key="(row) => row.id"
        :loading="loading && !list"
        :skeleton-rows="Math.min(pageSize, 4)"
        caption="Cuentas pendientes de aprobación"
        :stack-below="fit ? 560 : 760"
      >
        <template #cell-person="{ row }">
          <span class="person">
            <InitialsAvatar :name="row.name" />
            <span class="person__text">
              <strong>{{ row.name }}</strong>
              <small>{{ row.email }}</small>
            </span>
          </span>
        </template>
        <template #cell-requested="{ row }">
          <span class="nowrap">{{ shortDay(row.createdAt) }}</span>
        </template>
        <template #cell-email="{ row }">
          <StatusBadge :tone="row.emailVerified ? 'success' : 'warning'">
            {{ row.emailVerified ? 'Confirmado' : 'Sin confirmar' }}
          </StatusBadge>
        </template>
        <template #cell-role="{ row }">
          <span v-if="!row.emailVerified" class="choose__note">
            Se aprueba cuando confirme su correo.
          </span>
          <template v-else>
            <label class="visually-hidden" :for="`rol-${row.id}`">
              Rol para {{ row.name }}
            </label>
            <select
              :id="`rol-${row.id}`"
              v-model="chosen[row.id]"
              class="select select--compact"
              :disabled="approving === row.id"
            >
              <option :value="undefined" disabled>Elige un rol</option>
              <option v-for="role in roles" :key="role.key" :value="role.key">
                {{ role.name }}
              </option>
            </select>
          </template>
        </template>
        <template #cell-actions="{ row }">
          <AppButton
            v-if="row.emailVerified"
            size="sm"
            :disabled="!chosen[row.id]"
            :loading="approving === row.id"
            loading-label="Aprobando…"
            :aria-label="`Aprobar a ${row.name}`"
            @click="approve(row)"
          >
            Aprobar
          </AppButton>
        </template>
        <template #empty>
          <p>No hay cuentas esperando aprobación.</p>
        </template>
      </DataTable>
    </div>

    <!-- Lugar reservado: al llegar los datos la tabla no cambia de alto -->
    <div class="pending__pages">
      <AppPagination
        v-if="list && list.total > 0"
        :total="list.total"
        :limit="pageSize"
        :offset="list.offset"
        :count="list.items.length"
        label="Páginas de cuentas pendientes"
        @change="offset = $event"
      />
    </div>
  </div>
</template>

<style scoped>
.pending {
  display: grid;
  gap: var(--space-4);
  min-width: 0;
}

.pending__intro {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.pending__table {
  min-width: 0;
  transition: opacity var(--duration-base) var(--ease-out);
}

.pending__table.is-refreshing {
  opacity: 0.6;
}

.pending__table :deep(th),
.pending__table :deep(td) {
  padding-inline: var(--space-3);
}

.person {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}

.person__text {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
  line-height: var(--leading-snug);
}

.person__text small {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.nowrap {
  white-space: nowrap;
}

.select--compact {
  width: 100%;
  min-width: 9rem;
  min-height: 2.25rem;
  padding-block: 0.3rem;
}

.choose__note {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  line-height: var(--leading-snug);
}

/* Ventana completa: entran las filas que caben */
.pending--fit {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-height: 0;
}

.pending--fit .pending__table {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.pending--fit .pending__pages {
  flex: none;
  height: 2.5rem;
}

.pending--fit .pending__table :deep(.table) {
  table-layout: fixed;
}

.pending--fit .pending__table :deep(td) {
  height: 3.5rem;
  padding-block: 0;
}

.pending--fit .pending__table :deep(th:nth-child(1)) {
  width: 33%;
}
.pending--fit .pending__table :deep(th:nth-child(2)) {
  width: 14%;
}
.pending--fit .pending__table :deep(th:nth-child(3)) {
  width: 15%;
}
.pending--fit .pending__table :deep(th:nth-child(4)) {
  width: 24%;
}
.pending--fit .pending__table :deep(th:nth-child(5)) {
  width: 14%;
}

/* Tabla angosta (con la invitación abierta): sin la fecha */
@container (max-width: 46rem) {
  .pending--fit .pending__table :deep(th:nth-child(2)),
  .pending--fit .pending__table :deep(td:nth-child(2)),
  .pending--fit .pending__table :deep(th:nth-child(3)),
  .pending--fit .pending__table :deep(td:nth-child(3)) {
    display: none;
  }

  .pending--fit .pending__table :deep(th:nth-child(1)) {
    width: 46%;
  }

  .pending--fit .pending__table :deep(th:nth-child(4)) {
    width: 32%;
  }

  .pending--fit .pending__table :deep(th:nth-child(5)) {
    width: 22%;
  }
}

.pending--fit .person__text strong,
.pending--fit .person__text small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
