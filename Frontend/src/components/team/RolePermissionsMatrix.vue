<script setup lang="ts">
/**
 * «Qué puede ver cada rol» (diseño pág. 18): los permisos de cada rol, agrupados por
 * área. Administración es del sistema: tiene todo y no se edita. Dar un permiso
 * sensible (datos clínicos, borrar documentos, el equipo o el registro) pide
 * confirmación, igual que la API.
 */
import { computed, reactive, ref, watch } from 'vue'

import { isApiError } from '../../api/errors'
import type { Permission, PermissionInfo, RoleMatrix } from '../../api/types'
import { useToast } from '../../composables/useToast'
import { useApi } from '../../composables/useApi'
import {
  ADMIN_ROLE,
  CLINICAL_PERMISSIONS,
  PERMISSION_GROUPS,
  shortRoleName,
  sortRoles,
} from '../../utils/team'
import AppAlert from '../ui/AppAlert.vue'
import AppButton from '../ui/AppButton.vue'
import AppModal from '../ui/AppModal.vue'

const props = defineProps<{ matrix: RoleMatrix; canEdit: boolean }>()
const emit = defineEmits<{ saved: [] }>()

const { api } = useApi()
const toast = useToast()

const roles = computed(() => sortRoles(props.matrix.roles))
const catalog = computed(
  () => new Map(props.matrix.permissions.map((item) => [item.key, item])),
)

/** Grupos del diseño con los permisos que existen; lo que no tenga grupo, al final. */
const groups = computed(() => {
  const known = new Set<string>()
  const result = PERMISSION_GROUPS.map((group) => {
    const items = group.permissions
      .map((key) => catalog.value.get(key))
      .filter((item): item is PermissionInfo => Boolean(item))
    items.forEach((item) => known.add(item.key))
    return { label: group.label, items }
  }).filter((group) => group.items.length > 0)
  const others = props.matrix.permissions.filter((item) => !known.has(item.key))
  if (others.length) result.push({ label: 'Otros', items: others })
  return result
})

const draft = reactive<Record<string, Permission[]>>({})

function resetDraft() {
  for (const key of Object.keys(draft)) delete draft[key]
  for (const role of props.matrix.roles) draft[role.key] = [...role.permissions]
}
watch(() => props.matrix, resetDraft, { immediate: true })

function original(roleKey: string): Permission[] {
  return (
    props.matrix.roles.find((role) => role.key === roleKey)?.permissions ?? []
  )
}

function has(roleKey: string, permission: Permission): boolean {
  return roleKey === ADMIN_ROLE || (draft[roleKey] ?? []).includes(permission)
}

function toggle(roleKey: string, permission: Permission, on: boolean) {
  const current = draft[roleKey] ?? []
  draft[roleKey] = on
    ? [...current, permission]
    : current.filter((key) => key !== permission)
}

/** Permiso que se está agregando ahora y que todavía no se guardó. */
function isAdding(roleKey: string, permission: Permission): boolean {
  return has(roleKey, permission) && !original(roleKey).includes(permission)
}

const changedRoles = computed(() =>
  roles.value.filter((role) => {
    if (role.key === ADMIN_ROLE) return false
    const before = new Set(original(role.key))
    const after = new Set(draft[role.key] ?? [])
    return (
      before.size !== after.size || [...after].some((key) => !before.has(key))
    )
  }),
)
const changeCount = computed(() =>
  changedRoles.value.reduce((total, role) => {
    const before = new Set(original(role.key))
    const after = new Set(draft[role.key] ?? [])
    const added = [...after].filter((key) => !before.has(key)).length
    const removed = [...before].filter((key) => !after.has(key)).length
    return total + added + removed
  }, 0),
)

/** Lo sensible que se va a dar, rol por rol (para el aviso de confirmación). */
const sensitiveAdds = computed(() =>
  changedRoles.value
    .map((role) => ({
      role,
      items: (draft[role.key] ?? [])
        .filter((key) => !original(role.key).includes(key))
        .map((key) => catalog.value.get(key))
        .filter((item): item is PermissionInfo => Boolean(item?.isSensitive)),
    }))
    .filter((entry) => entry.items.length > 0),
)
const addsClinical = computed(() =>
  sensitiveAdds.value.some((entry) =>
    entry.items.some((item) => CLINICAL_PERMISSIONS.includes(item.key)),
  ),
)

const saving = ref(false)
const error = ref<string | null>(null)
const confirmOpen = ref(false)
const serverWarning = ref<string | null>(null)

function save() {
  if (!changedRoles.value.length) return
  error.value = null
  serverWarning.value = null
  if (sensitiveAdds.value.length) confirmOpen.value = true
  else void persist(false)
}

async function persist(confirmSensitive: boolean) {
  saving.value = true
  error.value = null
  const saved: string[] = []
  try {
    for (const role of changedRoles.value) {
      // Mismo orden que el catálogo de la API
      const permissions = props.matrix.permissions
        .map((item) => item.key)
        .filter((key) => (draft[role.key] ?? []).includes(key))
      await api.roles.updatePermissions(role.key, {
        permissions,
        confirmSensitive,
      })
      saved.push(role.name)
    }
    confirmOpen.value = false
    toast.success(
      saved.length === 1
        ? `Guardamos los permisos de ${saved[0]}.`
        : `Guardamos los permisos de ${saved.join(', ')}.`,
    )
    emit('saved')
  } catch (failure) {
    if (isApiError(failure) && failure.status === 409 && !confirmSensitive) {
      // La API pide confirmar algo sensible que aquí no se marcó como tal
      serverWarning.value = failure.message
      confirmOpen.value = true
    } else {
      confirmOpen.value = false
      error.value = isApiError(failure)
        ? failure.message
        : 'No pudimos guardar los permisos. Intenta de nuevo.'
    }
    // Lo que sí se guardó ya está en la API: se vuelve a leer la tabla
    if (saved.length) emit('saved')
  } finally {
    saving.value = false
  }
}

function cellLabel(roleName: string, item: PermissionInfo): string {
  return `${roleName}: ${item.description}`
}
</script>

<template>
  <div class="matrix" data-testid="tabla-permisos">
    <AppAlert v-if="error" tone="error" class="matrix__alert">
      {{ error }}
    </AppAlert>

    <div class="matrix__scroll">
      <table class="matrix__table">
        <caption class="visually-hidden">
          Qué puede ver y hacer cada rol
        </caption>
        <thead>
          <tr>
            <th scope="col" class="matrix__group-head">Área</th>
            <th scope="col" class="matrix__perm-head">Permiso</th>
            <th
              v-for="role in roles"
              :key="role.key"
              scope="col"
              class="matrix__role"
              :abbr="role.name"
            >
              <span class="matrix__role-name" :title="role.name">
                {{ shortRoleName(role) }}
                <svg
                  v-if="role.key === ADMIN_ROLE"
                  class="matrix__lock"
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                >
                  <path
                    d="M4.5 7V5a3.5 3.5 0 0 1 7 0v2h.5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h.5Zm1.5 0h4V5a2 2 0 1 0-4 0v2Z"
                  />
                </svg>
              </span>
              <small>
                {{ role.members }}
                {{ role.members === 1 ? 'persona' : 'personas' }}
              </small>
            </th>
          </tr>
        </thead>
        <tbody v-for="group in groups" :key="group.label">
          <tr v-for="(item, index) in group.items" :key="item.key">
            <th
              v-if="index === 0"
              scope="rowgroup"
              :rowspan="group.items.length"
              class="matrix__group"
            >
              {{ group.label }}
            </th>
            <th scope="row" class="matrix__perm">
              <span class="matrix__perm-text" :title="item.description">{{
                item.description
              }}</span>
              <span
                v-if="item.isSensitive"
                class="matrix__sensitive"
                title="Sensible: pide confirmación al darlo"
              >
                <span aria-hidden="true">!</span>
                <span class="visually-hidden">(sensible)</span>
              </span>
            </th>
            <td
              v-for="role in roles"
              :key="role.key"
              class="matrix__cell"
              :class="{
                'is-adding': isAdding(role.key, item.key),
                'is-adding-sensitive':
                  item.isSensitive && isAdding(role.key, item.key),
              }"
            >
              <input
                type="checkbox"
                class="matrix__check"
                :checked="has(role.key, item.key)"
                :disabled="role.key === ADMIN_ROLE || !canEdit || saving"
                :aria-label="cellLabel(role.name, item)"
                :title="
                  role.key === ADMIN_ROLE
                    ? 'Administración tiene siempre todos los permisos'
                    : undefined
                "
                @change="
                  toggle(
                    role.key,
                    item.key,
                    ($event.target as HTMLInputElement).checked,
                  )
                "
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <footer class="matrix__footer">
      <p v-if="!canEdit" class="matrix__status">
        Solo quien puede cambiar los permisos de los roles los edita.
      </p>
      <p v-else-if="changeCount" class="matrix__status is-dirty" role="status">
        {{ changeCount }}
        {{ changeCount === 1 ? 'cambio sin guardar' : 'cambios sin guardar' }}
        <template v-if="sensitiveAdds.length">
          · incluye acceso sensible: te pediremos confirmarlo.
        </template>
      </p>
      <p v-else class="matrix__status">
        <span class="matrix__sensitive matrix__legend-mark" aria-hidden="true"
          >!</span
        >Sensible: pide confirmación al darlo. Administración tiene todos los
        permisos y no se edita.
      </p>
      <div v-if="canEdit" class="matrix__actions">
        <AppButton
          variant="secondary"
          size="sm"
          :disabled="!changeCount || saving"
          @click="resetDraft"
        >
          Descartar
        </AppButton>
        <AppButton
          size="sm"
          :disabled="!changeCount"
          :loading="saving && !confirmOpen"
          loading-label="Guardando los permisos…"
          @click="save"
        >
          Guardar permisos
        </AppButton>
      </div>
    </footer>

    <AppModal
      v-model:open="confirmOpen"
      size="sm"
      title="Confirmar acceso sensible"
      :dismissible="!saving"
    >
      <div class="confirm">
        <AppAlert v-if="addsClinical" tone="warning" title="Datos clínicos">
          Quien tenga este rol verá o registrará la historia clínica y las
          evaluaciones de los afiliados. Hazlo solo con personal clínico.
        </AppAlert>
        <p v-if="serverWarning">{{ serverWarning }}</p>
        <template v-else>
          <p>Vas a dar acceso sensible:</p>
          <ul class="confirm__list">
            <li v-for="entry in sensitiveAdds" :key="entry.role.key">
              <strong>{{ entry.role.name }}:</strong>
              {{ entry.items.map((item) => item.description).join('; ') }}.
            </li>
          </ul>
        </template>
        <p class="confirm__note">
          El cambio vale para todas las personas con ese rol y queda en el
          registro de actividad.
        </p>
      </div>
      <template #actions>
        <AppButton
          variant="secondary"
          :disabled="saving"
          @click="confirmOpen = false"
        >
          Revisar de nuevo
        </AppButton>
        <AppButton
          variant="danger"
          :loading="saving"
          loading-label="Guardando los permisos…"
          @click="persist(true)"
        >
          Sí, dar acceso
        </AppButton>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.matrix {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-height: 0;
}

.matrix__scroll {
  /* Contiene a los textos ocultos (solo para lectores) y no alargan la página */
  position: relative;
  min-height: 0;
  overflow: auto;
}

.matrix__table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: var(--text-sm);
}

.matrix__table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: var(--space-2) var(--space-2);
  border-bottom: 1px solid var(--color-border-strong);
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-align: left;
  text-transform: uppercase;
  vertical-align: bottom;
}

.matrix__group-head {
  width: 8.5rem;
}

.matrix__role {
  width: 6.1rem;
  letter-spacing: 0.03em !important;
  text-align: center !important;
}

.matrix__role-name {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.matrix__role small {
  display: block;
  color: var(--color-text-subtle);
  font-weight: 400;
  letter-spacing: 0;
  text-transform: none;
}

.matrix__lock {
  width: 0.8rem;
  height: 0.8rem;
  fill: currentColor;
}

.matrix__table tbody {
  border-bottom: 1px solid var(--color-border);
}

.matrix__table tbody th,
.matrix__table tbody td {
  height: clamp(1.75rem, 3.4vh, 2.4rem);
  padding: 0 var(--space-2);
}

.matrix__group {
  color: var(--color-heading);
  font-weight: 700;
  text-align: left;
  vertical-align: top;
  padding-top: 0.45rem !important;
}

.matrix__perm {
  font-weight: 400;
  text-align: left;
  line-height: var(--leading-snug);
}

.matrix__perm-text {
  display: inline;
}

/* Laptops (1366×768): filas densas y cada permiso en una línea, para que la tabla
   entre completa sin su propia barra */
@media (min-width: 1024px) and (max-height: 940px) {
  .matrix__table {
    font-size: 0.8125rem;
  }

  .matrix__table thead th {
    padding-block: var(--space-1);
  }

  .matrix__table tbody th,
  .matrix__table tbody td {
    height: clamp(1.25rem, 3vh, 2.4rem);
  }

  .matrix__group {
    padding-top: 0.25rem !important;
  }

  .matrix__perm {
    white-space: nowrap;
  }

  .matrix__perm-text {
    display: inline-block;
    max-width: calc(100% - 1.6rem);
    overflow: hidden;
    text-overflow: ellipsis;
    vertical-align: middle;
  }

  .matrix__sensitive {
    width: 1rem;
    height: 1rem;
  }
}

.matrix__sensitive {
  display: inline-grid;
  place-items: center;
  width: 1.1rem;
  height: 1.1rem;
  margin-left: var(--space-2);
  border-radius: 50%;
  background: var(--tone-warning-bg);
  color: var(--tone-warning-fg);
  font-size: var(--text-xs);
  font-weight: 800;
  vertical-align: 0.05em;
}

.matrix__legend-mark {
  margin-left: 0;
  margin-right: 0.3rem;
}

.matrix__table tbody tr:hover {
  background: var(--color-surface-muted);
}

.matrix__cell {
  text-align: center;
}

.matrix__cell.is-adding {
  background: var(--verde-50);
}

.matrix__cell.is-adding-sensitive {
  background: var(--tone-warning-bg);
}

.matrix__check {
  width: 1.05rem;
  height: 1.05rem;
  margin: 0;
  vertical-align: middle;
  accent-color: var(--aspar-verde);
  cursor: pointer;
}

.matrix__check:disabled {
  cursor: not-allowed;
}

.matrix__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.matrix__status {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.matrix__status.is-dirty {
  color: var(--tone-warning-fg);
  font-weight: 600;
}

.matrix__actions {
  display: flex;
  gap: var(--space-2);
}

.confirm {
  display: grid;
  gap: var(--space-3);
}

.confirm__list {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding-left: var(--space-5);
}

.confirm__note {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

/* En pantallas angostas la tabla se desplaza de lado dentro de su tarjeta */
@media (max-width: 760px) {
  .matrix__table {
    min-width: 44rem;
  }
}
</style>
