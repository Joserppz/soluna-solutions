<script setup lang="ts">
/**
 * «Gestionar» a una persona del equipo: cambiar su rol o su área, restablecer su
 * contraseña (temporal, se muestra una vez) y desactivar la cuenta. Nunca se borra.
 *
 * Siempre queda al menos una persona con rol de Administración activa: la API lo
 * exige y aquí se explica antes de intentarlo.
 */
import { computed, reactive, ref, watch } from 'vue'

import { isApiError } from '../../api/errors'
import type { RoleOut, UserOut } from '../../api/types'
import { useApi } from '../../composables/useApi'
import { useToast } from '../../composables/useToast'
import { firstName } from '../../utils/format'
import { ADMIN_ROLE } from '../../utils/team'
import AppAlert from '../ui/AppAlert.vue'
import AppButton from '../ui/AppButton.vue'
import AppModal from '../ui/AppModal.vue'
import FormField from '../ui/FormField.vue'
import TemporaryPassword from './TemporaryPassword.vue'

const props = defineProps<{
  member: UserOut | null
  roles: RoleOut[]
  /** Personas con rol de Administración activas (de la tabla de roles). */
  activeAdmins: number
}>()
const emit = defineEmits<{ close: []; updated: [user: UserOut] }>()

const { api, session } = useApi()
const toast = useToast()

const draft = reactive({ role: '', department: '' })
const busy = ref<'save' | 'reset' | 'deactivate' | null>(null)
const error = ref<string | null>(null)
const confirmingDeactivate = ref(false)
const password = ref<string | null>(null)

watch(
  () => props.member,
  (member) => {
    if (!member) return
    draft.role = member.role ?? ''
    draft.department = member.department
    error.value = null
    confirmingDeactivate.value = false
    password.value = null
  },
  { immediate: true },
)

const isSelf = computed(() => props.member?.id === session.state.user?.id)
const isLastAdmin = computed(
  () =>
    props.member?.role === ADMIN_ROLE &&
    props.member.active &&
    props.activeAdmins <= 1,
)

/** Por qué no se le puede quitar Administración ni desactivar (o null si se puede). */
const adminLock = computed(() => {
  if (props.member?.role !== ADMIN_ROLE) return null
  if (isSelf.value)
    return 'No puedes quitarte el rol de Administración ni desactivar tu propia cuenta.'
  if (isLastAdmin.value)
    return 'Es la única persona con rol de Administración activa. Debe quedar al menos una.'
  return null
})

const changes = computed(() => {
  const member = props.member
  if (!member) return {}
  const changed: { role?: string; department?: string } = {}
  if (draft.role && draft.role !== member.role) changed.role = draft.role
  const department = draft.department.trim()
  if (department && department !== member.department)
    changed.department = department
  return changed
})
const dirty = computed(() => Object.keys(changes.value).length > 0)

function fail(failure: unknown, fallback: string) {
  error.value = isApiError(failure) ? failure.message : fallback
}

async function save() {
  const member = props.member
  if (!member || !dirty.value) return
  busy.value = 'save'
  error.value = null
  try {
    const updated = await api.users.update(member.id, changes.value)
    emit('updated', updated)
    toast.success(`Guardamos los cambios de ${firstName(updated.name)}.`)
    emit('close')
  } catch (failure) {
    fail(failure, 'No pudimos guardar los cambios. Intenta de nuevo.')
  } finally {
    busy.value = null
  }
}

async function resetPassword() {
  const member = props.member
  if (!member) return
  busy.value = 'reset'
  error.value = null
  try {
    const result = await api.users.resetPassword(member.id)
    password.value = result.temporaryPassword
  } catch (failure) {
    fail(failure, 'No pudimos restablecer la contraseña. Intenta de nuevo.')
  } finally {
    busy.value = null
  }
}

async function deactivate() {
  const member = props.member
  if (!member) return
  busy.value = 'deactivate'
  error.value = null
  try {
    const updated = await api.users.update(member.id, { active: false })
    emit('updated', updated)
    toast.success(
      `Desactivamos la cuenta de ${firstName(updated.name)}. Sus sesiones se cerraron.`,
    )
    emit('close')
  } catch (failure) {
    confirmingDeactivate.value = false
    fail(failure, 'No pudimos desactivar la cuenta. Intenta de nuevo.')
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <AppModal
    :open="member !== null"
    :title="member ? `Gestionar a ${member.name}` : ''"
    :description="member?.email"
    :dismissible="busy === null"
    @update:open="emit('close')"
  >
    <div v-if="member" class="manage">
      <AppAlert v-if="error" tone="error">{{ error }}</AppAlert>

      <form
        id="gestionar-persona"
        class="manage__section"
        novalidate
        @submit.prevent="save"
      >
        <h3>Rol y área</h3>
        <div class="manage__grid">
          <FormField
            v-slot="{ id, describedBy }"
            label="Rol"
            :hint="adminLock ?? undefined"
          >
            <select
              :id="id"
              v-model="draft.role"
              class="select"
              :disabled="!member.active || adminLock !== null"
              :aria-describedby="describedBy"
            >
              <option v-if="!member.role" value="" disabled>
                Pendiente de aprobación
              </option>
              <option v-for="role in roles" :key="role.key" :value="role.key">
                {{ role.name }}
              </option>
            </select>
          </FormField>
          <FormField
            v-slot="{ id }"
            label="Área"
            hint="Por ejemplo: Fisioterapia."
          >
            <input
              :id="id"
              v-model="draft.department"
              class="input"
              maxlength="80"
              :disabled="!member.active"
            />
          </FormField>
        </div>
      </form>

      <section class="manage__section">
        <h3>Contraseña</h3>
        <TemporaryPassword
          v-if="password"
          :title="`Nueva contraseña para ${firstName(member.name)}`"
          :password="password"
        />
        <template v-else>
          <p>
            Genera una contraseña temporal y cierra las sesiones abiertas de
            {{ firstName(member.name) }}.
          </p>
          <AppButton
            variant="secondary"
            size="sm"
            :disabled="!member.active || busy !== null"
            :loading="busy === 'reset'"
            loading-label="Restableciendo…"
            @click="resetPassword"
          >
            Restablecer contraseña
          </AppButton>
        </template>
      </section>

      <section v-if="member.active" class="manage__section manage__danger">
        <h3>Cuenta</h3>
        <p v-if="adminLock">{{ adminLock }}</p>
        <template v-else-if="!confirmingDeactivate">
          <p>
            No podrá entrar al espacio del equipo. Lo que hizo queda en el
            registro de actividad y la cuenta se puede reactivar.
          </p>
          <AppButton
            variant="secondary"
            size="sm"
            :disabled="busy !== null"
            @click="confirmingDeactivate = true"
          >
            Desactivar cuenta…
          </AppButton>
        </template>
        <div v-else class="manage__confirm" role="group" aria-label="Confirmar">
          <p>
            <strong>¿Desactivar a {{ member.name }}?</strong> Se cerrarán sus
            sesiones abiertas.
          </p>
          <div class="manage__confirm-actions">
            <AppButton
              variant="secondary"
              size="sm"
              :disabled="busy !== null"
              @click="confirmingDeactivate = false"
            >
              No, mantenerla
            </AppButton>
            <AppButton
              variant="danger"
              size="sm"
              :loading="busy === 'deactivate'"
              loading-label="Desactivando…"
              @click="deactivate"
            >
              Sí, desactivar
            </AppButton>
          </div>
        </div>
      </section>
    </div>

    <template #actions>
      <AppButton
        variant="secondary"
        :disabled="busy !== null"
        @click="emit('close')"
      >
        Cerrar
      </AppButton>
      <AppButton
        type="submit"
        form="gestionar-persona"
        :disabled="!dirty || (busy !== null && busy !== 'save')"
        :loading="busy === 'save'"
        loading-label="Guardando…"
      >
        Guardar cambios
      </AppButton>
    </template>
  </AppModal>
</template>

<style scoped>
.manage {
  display: grid;
  gap: var(--space-5);
}

.manage__section {
  display: grid;
  gap: var(--space-3);
  justify-items: start;
}

.manage__section > * {
  max-width: 100%;
}

.manage__section h3 {
  font-family: var(--font-sans);
  font-size: var(--text-md);
  font-weight: 700;
  color: var(--color-text);
}

.manage__section p {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.manage__section .temporary {
  justify-self: stretch;
}

.manage__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
  gap: var(--space-4);
  justify-self: stretch;
}

.manage__danger {
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}

.manage__confirm {
  display: grid;
  gap: var(--space-3);
  justify-self: stretch;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-sm);
  background: var(--rosa-50);
}

.manage__confirm p {
  color: var(--color-text);
}

.manage__confirm-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

@media (max-width: 640px) {
  .manage__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
