<script setup lang="ts">
/**
 * Equipo y permisos (diseño pág. 18): quién entra al espacio del equipo, las cuentas
 * que esperan aprobación, la invitación de personas nuevas (con contraseña temporal
 * generada por el servidor) y qué puede ver cada rol.
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { isApiError } from '../../../api/errors'
import type { RoleMatrix, UserOut } from '../../../api/types'
import InvitePanel from '../../../components/team/InvitePanel.vue'
import ManageMemberDialog from '../../../components/team/ManageMemberDialog.vue'
import PendingAccountsPanel from '../../../components/team/PendingAccountsPanel.vue'
import RolePermissionsMatrix from '../../../components/team/RolePermissionsMatrix.vue'
import TeamMembersPanel from '../../../components/team/TeamMembersPanel.vue'
import AppAlert from '../../../components/ui/AppAlert.vue'
import AppButton from '../../../components/ui/AppButton.vue'
import AppModal from '../../../components/ui/AppModal.vue'
import AppTabs, { type TabItem } from '../../../components/ui/AppTabs.vue'
import PageHeader from '../../../components/ui/PageHeader.vue'
import SkeletonBlock from '../../../components/ui/SkeletonBlock.vue'
import { useApi } from '../../../composables/useApi'
import { useFitLayout } from '../../../composables/useFitLayout'
import { ADMIN_ROLE, sortRoles } from '../../../utils/team'

type Tab = 'equipo' | 'pendientes' | 'permisos'
const TABS: Tab[] = ['equipo', 'pendientes', 'permisos']

const { api, session } = useApi()
const route = useRoute()
const router = useRouter()
const fit = useFitLayout()
/** Con ancho de sobra la invitación queda fija al costado, como en el diseño. */
const inviteOpen = ref(false)

const canManageUsers = computed(() => session.can('users:manage'))
const canEditRoles = computed(() => session.can('roles:manage'))

const initialTab = route.query.pestana
const tab = ref<Tab>(
  TABS.includes(initialTab as Tab) ? (initialTab as Tab) : 'equipo',
)

const matrix = ref<RoleMatrix | null>(null)
const matrixError = ref<string | null>(null)
const pendingCount = ref<number | null>(null)
const managing = ref<UserOut | null>(null)

const members = ref<InstanceType<typeof TeamMembersPanel> | null>(null)
const pending = ref<InstanceType<typeof PendingAccountsPanel> | null>(null)
const invite = ref<InstanceType<typeof InvitePanel> | null>(null)

const roles = computed(() => sortRoles(matrix.value?.roles ?? []))
const activeAdmins = computed(
  () => roles.value.find((role) => role.key === ADMIN_ROLE)?.members ?? 0,
)

const tabs = computed<TabItem<Tab>[]>(() => [
  { key: 'equipo', label: 'Equipo' },
  {
    key: 'pendientes',
    label: 'Pendientes de aprobación',
    count: pendingCount.value,
  },
  { key: 'permisos', label: 'Qué puede ver cada rol' },
])

async function loadMatrix() {
  matrixError.value = null
  try {
    matrix.value = await api.roles.matrix()
  } catch (failure) {
    matrixError.value = isApiError(failure)
      ? failure.message
      : 'No pudimos cargar los roles. Intenta de nuevo.'
  }
}

async function loadPendingCount() {
  try {
    const result = await api.users.list({ role: 'pendiente', limit: 1 })
    pendingCount.value = result.total
  } catch {
    pendingCount.value = null
  }
}

/** Algo cambió en el equipo: listas, contador de pendientes y miembros por rol. */
function onChanged() {
  void members.value?.reload()
  void pending.value?.reload()
  void loadPendingCount()
  void loadMatrix()
}

watch(tab, (value) => {
  // Cada pestaña empieza sin búsqueda ni página
  const query: Record<string, string> = {}
  if (value !== 'equipo') query.pestana = value
  void router.replace({ query })
})

/** «+ Nuevo rol» abre la invitación en una ventana: las listas usan todo el ancho. */
async function startInvite() {
  inviteOpen.value = true
  await nextTick()
  await invite.value?.focus()
}

onMounted(() => {
  if (!canManageUsers.value) return
  void loadMatrix()
  void loadPendingCount()
})
</script>

<template>
  <div class="access" :class="{ 'access--fit': fit }">
    <PageHeader
      title="Equipo y permisos"
      subtitle="Quién entra al espacio del equipo y qué puede ver cada persona."
    >
      <template v-if="canManageUsers" #actions>
        <AppButton size="lg" @click="startInvite"> + Nuevo rol </AppButton>
      </template>
    </PageHeader>

    <AppAlert v-if="!canManageUsers" tone="info">
      Para ver el equipo y los permisos de cada rol hace falta el permiso de
      gestionar el equipo. Pídeselo a Administración.
    </AppAlert>

    <div v-else class="access__body">
      <section class="access__card surface-card" aria-label="Equipo">
        <AppTabs
          v-model="tab"
          :items="tabs"
          label="Equipo y permisos"
          id-prefix="equipo"
        />
        <AppAlert v-if="matrixError" tone="error">
          {{ matrixError }}
          <AppButton variant="link" size="sm" @click="loadMatrix">
            Reintentar
          </AppButton>
        </AppAlert>
        <div
          id="equipo-panel"
          role="tabpanel"
          :aria-labelledby="`equipo-tab-${tab}`"
          class="access__panel"
        >
          <TeamMembersPanel
            v-if="tab === 'equipo'"
            ref="members"
            :roles="roles"
            @manage="managing = $event"
            @approve="tab = 'pendientes'"
            @changed="onChanged"
          />
          <PendingAccountsPanel
            v-else-if="tab === 'pendientes'"
            ref="pending"
            :roles="roles"
            @changed="onChanged"
          />
          <template v-else>
            <RolePermissionsMatrix
              v-if="matrix"
              :matrix="matrix"
              :can-edit="canEditRoles"
              @saved="loadMatrix"
            />
            <SkeletonBlock v-else-if="!matrixError" height="16rem" />
          </template>
        </div>
      </section>
    </div>

    <AppModal
      v-if="canManageUsers"
      v-model:open="inviteOpen"
      title="Invitar a una persona"
      labelled-by="invitar-titulo"
      bare
    >
      <InvitePanel
        ref="invite"
        :roles="roles"
        closable
        @created="onChanged"
        @close="inviteOpen = false"
      />
    </AppModal>

    <ManageMemberDialog
      :member="managing"
      :roles="roles"
      :active-admins="activeAdmins"
      @close="managing = null"
      @updated="onChanged"
    />
  </div>
</template>

<style scoped>
.access {
  display: grid;
  gap: var(--space-6);
  min-width: 0;
}

.access :deep(.page-header) {
  margin-bottom: 0;
}

.access__body {
  display: grid;
  gap: var(--space-5);
  min-width: 0;
}

.access__card {
  display: grid;
  gap: var(--space-4);
  min-width: 0;
  padding: var(--space-5) var(--space-6) var(--space-6);
}

.access__panel {
  min-width: 0;
}

@media (max-width: 640px) {
  .access__card {
    padding: var(--space-4);
  }
}

/* Ventana completa: la página no se desplaza. La tarjeta ocupa el alto que queda y
   cada lista muestra las filas que entran */
.access--fit {
  display: flex;
  flex-direction: column;
  gap: clamp(var(--space-3), 2.4vh, var(--space-6));
  min-height: 0;
}

.access--fit :deep(.page-header__title) {
  font-size: clamp(1.9rem, 4.6vh, 3.25rem);
}

.access--fit :deep(.page-header__subtitle) {
  font-size: var(--text-md);
}

.access--fit .access__body {
  flex: 1;
  grid-template-rows: minmax(0, 1fr);
  min-height: 0;
}

/* Pestañas más juntas en ventanas bajas */
.access--fit .access__card :deep(.tabs__tab) {
  padding-inline: var(--space-3);
}

@media (max-height: 860px) {
  .access--fit .access__card :deep(.tabs__tab) {
    min-height: 2.5rem;
  }
}

.access--fit .access__card {
  display: flex;
  flex-direction: column;
  gap: clamp(var(--space-2), 1.6vh, var(--space-4));
  min-height: 0;
  padding: clamp(var(--space-3), 2vh, var(--space-5)) var(--space-6)
    clamp(var(--space-3), 2vh, var(--space-6));
}

.access--fit .access__panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.access--fit .access__panel > * {
  flex: 1;
  min-height: 0;
}
</style>
