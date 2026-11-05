<script setup lang="ts">
/**
 * Equipo (diseño pág. 18): búsqueda por nombre o correo, filtro por rol y la tabla con
 * rol, último ingreso y estado. Las cuentas se desactivan y se reactivan; no se borran.
 * La búsqueda, el rol y la página quedan en la dirección.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { isApiError } from '../../api/errors'
import type { RoleOut, UserOut, UserPage } from '../../api/types'
import { useApi } from '../../composables/useApi'
import { useFitRows } from '../../composables/useFitRows'
import { useToast } from '../../composables/useToast'
import { firstName } from '../../utils/format'
import { normalizeSearch } from '../../utils/patients'
import { lastSeenLabel } from '../../utils/team'
import AppAlert from '../ui/AppAlert.vue'
import AppButton from '../ui/AppButton.vue'
import AppPagination from '../ui/AppPagination.vue'
import DataTable, { type Column } from '../ui/DataTable.vue'
import InitialsAvatar from '../ui/InitialsAvatar.vue'
import StatusBadge from '../ui/StatusBadge.vue'

const props = defineProps<{ roles: RoleOut[] }>()
const emit = defineEmits<{
  manage: [user: UserOut]
  approve: []
  changed: []
}>()

const SCROLL_PAGE_SIZE = 10
const ROW_HEIGHT = 56
const SEARCH_DELAY = 300

const { api } = useApi()
const route = useRoute()
const router = useRouter()
const toast = useToast()

function text(key: string): string {
  const value = route.query[key]
  return typeof value === 'string' ? value : ''
}

const searchInput = ref(text('buscar'))
const search = ref(normalizeSearch(searchInput.value))
const role = ref(text('rol'))
const page = ref(Math.max(1, Number(text('pagina')) || 1))

const list = ref<UserPage | null>(null)
const loading = ref(true)
const loadError = ref<string | null>(null)
const reactivating = ref<string | null>(null)

const tableArea = ref<HTMLElement | null>(null)
const { fit, pageSize } = useFitRows(tableArea, {
  rowHeight: ROW_HEIGHT,
  fallback: SCROLL_PAGE_SIZE,
})

const columns: Column[] = [
  { key: 'person', label: 'Persona' },
  { key: 'role', label: 'Rol' },
  { key: 'lastLogin', label: 'Último ingreso' },
  { key: 'status', label: 'Estado' },
  { key: 'actions', label: 'Acciones', hideLabel: true, align: 'end' },
]

const rows = computed(() => list.value?.items ?? [])
const filtered = computed(() => Boolean(search.value || role.value))

const emptyMessage = computed(() => {
  const roleName = props.roles.find((item) => item.key === role.value)?.name
  if (search.value && roleName)
    return `Nadie con rol ${roleName} coincide con «${search.value}».`
  if (search.value)
    return `No encontramos a nadie con «${search.value}». Revisa el nombre o el correo.`
  if (roleName) return `Todavía nadie tiene el rol ${roleName}.`
  return 'Todavía no hay personas en el equipo.'
})

let request = 0

async function load() {
  const current = ++request
  loading.value = true
  loadError.value = null
  try {
    const result = await api.users.list({
      search: search.value || undefined,
      role: role.value || undefined,
      limit: pageSize.value,
      offset: (page.value - 1) * pageSize.value,
    })
    if (current !== request) return
    const lastPage = Math.max(1, Math.ceil(result.total / pageSize.value))
    if (!result.items.length && page.value > lastPage) {
      page.value = lastPage
      return
    }
    list.value = result
  } catch (failure) {
    if (current !== request) return
    loadError.value = isApiError(failure)
      ? failure.message
      : 'No pudimos cargar el equipo. Intenta de nuevo.'
  } finally {
    if (current === request) loading.value = false
  }
}

function syncQuery() {
  const query = { ...route.query }
  delete query.buscar
  delete query.rol
  delete query.pagina
  if (search.value) query.buscar = search.value
  if (role.value) query.rol = role.value
  if (page.value > 1) query.pagina = String(page.value)
  void router.replace({ query })
}

function refresh() {
  syncQuery()
  void load()
}

watch([search, role], () => {
  if (page.value === 1) refresh()
  else page.value = 1
})
watch(page, refresh)

let ready = false
watch(pageSize, (size, before) => {
  if (!ready) return
  const next = Math.floor(((page.value - 1) * before) / size) + 1
  if (next !== page.value) page.value = next
  else refresh()
})

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(searchInput, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    search.value = normalizeSearch(value)
  }, SEARCH_DELAY)
})

function searchNow() {
  clearTimeout(searchTimer)
  search.value = normalizeSearch(searchInput.value)
}

function clearFilters() {
  clearTimeout(searchTimer)
  searchInput.value = ''
  search.value = ''
  role.value = ''
}

async function reactivate(user: UserOut) {
  reactivating.value = user.id
  try {
    await api.users.update(user.id, { active: true })
    toast.success(`Reactivamos la cuenta de ${firstName(user.name)}.`)
    // La vista vuelve a leer esta lista, los pendientes y los miembros de cada rol
    emit('changed')
  } catch (failure) {
    toast.error(
      isApiError(failure)
        ? failure.message
        : 'No pudimos reactivar la cuenta. Intenta de nuevo.',
    )
  } finally {
    reactivating.value = null
  }
}

function roleDetail(user: UserOut): string | null {
  const department = user.department.trim()
  return user.role && department && department !== 'General' ? department : null
}

onMounted(async () => {
  // Primero mide cuántas filas entran (useFitRows): así se carga una sola vez
  await nextTick()
  await nextTick()
  ready = true
  void load()
})
onBeforeUnmount(() => clearTimeout(searchTimer))

defineExpose({ reload: load })
</script>

<template>
  <div class="members" :class="{ 'members--fit': fit }">
    <form class="toolbar" role="search" @submit.prevent="searchNow">
      <label class="visually-hidden" for="buscar-persona-equipo">
        Buscar por nombre o correo
      </label>
      <span class="toolbar__search">
        <span class="toolbar__icon" aria-hidden="true">⌕</span>
        <input
          id="buscar-persona-equipo"
          v-model="searchInput"
          class="input"
          type="search"
          placeholder="Buscar por nombre o correo"
          autocomplete="off"
        />
      </span>
      <label class="visually-hidden" for="filtro-rol">Rol</label>
      <select id="filtro-rol" v-model="role" class="select">
        <option value="">Todos los roles</option>
        <option v-for="item in roles" :key="item.key" :value="item.key">
          {{ item.name }}
        </option>
      </select>
    </form>

    <AppAlert v-if="loadError" tone="error">
      {{ loadError }}
      <AppButton variant="link" size="sm" @click="load">Reintentar</AppButton>
    </AppAlert>

    <p class="members__note">
      Siempre queda al menos una persona con rol de Administración. Las cuentas
      se desactivan, no se borran.
    </p>

    <div
      ref="tableArea"
      class="members__table"
      :class="{ 'is-refreshing': loading && list }"
    >
      <DataTable
        :columns="columns"
        :rows="rows"
        :row-key="(row) => row.id"
        :loading="loading && !list"
        :skeleton-rows="pageSize"
        caption="Personas del equipo"
        :stack-below="fit ? 520 : 720"
      >
        <template #cell-person="{ row }">
          <span class="person">
            <InitialsAvatar :name="row.name" :muted="!row.active" />
            <span class="person__text">
              <strong>{{ row.name }}</strong>
              <small>{{ row.email }}</small>
            </span>
          </span>
        </template>
        <template #cell-role="{ row }">
          <span class="role" :class="{ 'is-pending': !row.role }">
            <span>{{ row.role ? row.roleName : 'Sin rol todavía' }}</span>
            <small v-if="roleDetail(row)">{{ roleDetail(row) }}</small>
          </span>
        </template>
        <template #cell-lastLogin="{ row }">
          <span class="last-login">{{ lastSeenLabel(row.lastLoginAt) }}</span>
        </template>
        <template #cell-status="{ row }">
          <StatusBadge
            :tone="!row.active ? 'neutral' : row.role ? 'success' : 'warning'"
          >
            {{
              !row.active ? 'Desactivada' : row.role ? 'Activa' : 'Pendiente'
            }}
          </StatusBadge>
        </template>
        <template #cell-actions="{ row }">
          <AppButton
            v-if="!row.active"
            variant="link"
            size="sm"
            :loading="reactivating === row.id"
            loading-label="Reactivando…"
            :aria-label="`Reactivar la cuenta de ${row.name}`"
            @click="reactivate(row)"
          >
            Reactivar
          </AppButton>
          <AppButton
            v-else-if="!row.role"
            variant="link"
            size="sm"
            :aria-label="`Aprobar la cuenta de ${row.name}`"
            @click="emit('approve')"
          >
            Aprobar
          </AppButton>
          <AppButton
            v-else
            variant="link"
            size="sm"
            :aria-label="`Gestionar a ${row.name}`"
            @click="emit('manage', row)"
          >
            Gestionar
          </AppButton>
        </template>
        <template #empty>
          <p>{{ emptyMessage }}</p>
          <AppButton
            v-if="filtered"
            variant="link"
            size="sm"
            @click="clearFilters"
          >
            Quitar la búsqueda y el filtro
          </AppButton>
        </template>
      </DataTable>
    </div>

    <footer class="members__footer">
      <AppPagination
        v-if="list"
        :total="list.total"
        :limit="pageSize"
        :offset="list.offset"
        :count="list.items.length"
        label="Páginas del equipo"
        @change="page = Math.floor($event / pageSize) + 1"
      />
    </footer>
  </div>
</template>

<style scoped>
.members {
  display: grid;
  gap: var(--space-4);
  min-width: 0;
}

.toolbar {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: var(--space-3);
}

.toolbar__search {
  position: relative;
}

.toolbar__search .input {
  padding-left: 2.4rem;
}

.toolbar__icon {
  position: absolute;
  top: 50%;
  left: var(--space-4);
  transform: translateY(-50%);
  color: var(--color-text-subtle);
  font-size: var(--text-lg);
  pointer-events: none;
}

.members__table {
  min-width: 0;
  transition: opacity var(--duration-base) var(--ease-out);
}

.members__table.is-refreshing {
  opacity: 0.6;
}

.members__table :deep(th),
.members__table :deep(td) {
  padding-inline: var(--space-3);
}

.members__table :deep(td) {
  padding-block: 0.6rem;
}

.person {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}

.person__text,
.role {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
  line-height: var(--leading-snug);
}

.person__text small,
.role small {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.role.is-pending {
  color: var(--tone-warning-fg);
}

.last-login {
  white-space: nowrap;
}

.members__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2) var(--space-4);
}

.members__note {
  flex: 1 1 18rem;
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

@media (max-width: 640px) {
  .toolbar {
    grid-template-columns: minmax(0, 1fr);
  }
}

/* Ventana completa: la tabla ocupa el alto que queda y muestra las filas que entran */
.members--fit {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-height: 0;
}

.members--fit .members__table {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* Las filas reparten el alto sobrante: no queda un hueco antes de la paginación */
.members--fit .members__table :deep(.table-wrap),
.members--fit .members__table :deep(.table) {
  height: 100%;
}

.members--fit .members__table :deep(.table) {
  table-layout: fixed;
}

.members--fit .members__table :deep(td) {
  height: 3.5rem;
  padding-block: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.members--fit .members__table :deep(th:nth-child(1)) {
  width: 34%;
}
.members--fit .members__table :deep(th:nth-child(2)) {
  width: 17%;
}
.members--fit .members__table :deep(th:nth-child(3)) {
  width: 16%;
}
.members--fit .members__table :deep(th:nth-child(4)) {
  width: 17%;
}
.members--fit .members__table :deep(th:nth-child(5)) {
  width: 16%;
}

.members--fit .person__text strong,
.members--fit .person__text small,
.members--fit .role span,
.members--fit .role small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.members--fit {
  container-type: inline-size;
}

/* Alto fijo: al llegar los datos (y la paginación) la tabla no cambia de alto */
.members--fit .members__footer {
  flex: none;
  height: 2.5rem;
}

.members--fit .members__note {
  flex: none;
  display: block;
  overflow: hidden;
  font-size: var(--text-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.members--fit .members__table :deep(td:last-child) {
  text-overflow: clip;
}

/* Tabla angosta (con la invitación abierta en una laptop): sin «Último ingreso» */
@container (max-width: 44rem) {
  .members--fit .members__table :deep(th:nth-child(3)),
  .members--fit .members__table :deep(td:nth-child(3)) {
    display: none;
  }

  .members--fit .members__table :deep(th:nth-child(1)) {
    width: 43%;
  }

  .members--fit .members__table :deep(th:nth-child(4)) {
    width: 18%;
  }
}

.members__table :deep(.is-stacked) .person {
  text-align: left;
}
</style>
