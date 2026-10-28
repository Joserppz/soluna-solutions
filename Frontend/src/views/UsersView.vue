<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  USER_ROLES,
  createUserWithApi,
  getUsers,
  resetUserPassword,
  syncUsersFromApi,
  updateUser,
  type User,
  type UserRole,
} from '../services/aspar'

const users = ref<User[]>(getUsers())
const name = ref('')
const email = ref('')
const role = ref<UserRole>('Profesional')
const department = ref('Fisioterapia y Rehabilitación')
const roleFilter = ref<'Todos' | UserRole>('Todos')
const error = ref('')
const successMsg = ref('')
const isSubmitting = ref(false)
// Contraseña temporal que se muestra una sola vez (SCRUM-161)
const credential = ref<{ email: string; password: string } | null>(null)
const copied = ref(false)

const filteredUsers = computed(() => {
  if (roleFilter.value === 'Todos') return users.value
  return users.value.filter((u) => u.role === roleFilter.value)
})

function showCredential(userEmail: string, password: string | null) {
  copied.value = false
  credential.value = password ? { email: userEmail, password } : null
}

async function submitUser() {
  error.value = ''
  successMsg.value = ''
  isSubmitting.value = true

  try {
    const { user, temporaryPassword } = await createUserWithApi(
      name.value,
      email.value,
      role.value,
      department.value,
    )
    users.value = getUsers()
    successMsg.value = `Usuario ${user.email} creado con rol ${user.role}.`
    showCredential(user.email, temporaryPassword)
    name.value = ''
    email.value = ''
    role.value = 'Profesional'
    department.value = 'Fisioterapia y Rehabilitación'
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'No se pudo crear el usuario.'
  } finally {
    isSubmitting.value = false
  }
}

async function resetPassword(user: User) {
  error.value = ''
  successMsg.value = ''
  const confirmed = window.confirm(
    `¿Restablecer la contraseña de ${user.email}? Se cerrarán sus sesiones activas.`,
  )
  if (!confirmed) return

  try {
    const temporaryPassword = await resetUserPassword(user)
    successMsg.value = `Se restableció la contraseña de ${user.email}.`
    showCredential(user.email, temporaryPassword)
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : 'No se pudo restablecer la contraseña.'
  }
}

async function copyCredential() {
  if (!credential.value) return
  try {
    await navigator.clipboard.writeText(credential.value.password)
    copied.value = true
  } catch {
    copied.value = false
  }
}

function changeRole(user: User, newRole: UserRole) {
  updateUser(user.id, { role: newRole })
  users.value = getUsers()
}

function toggleActive(user: User) {
  updateUser(user.id, { active: !user.active })
  users.value = getUsers()
}

onMounted(async () => {
  users.value = await syncUsersFromApi()
})
</script>

<template>
  <section class="page-heading">
    <span class="eyebrow">Administración · RF-11 (SCRUM-129 / SCRUM-161)</span>
    <h1>Usuarios y roles</h1>
    <p>
      Administra el directorio del personal ASPAR, asigna los roles definidos en
      Jira (Administrador, Coordinador, Profesional, Recepción, Voluntario) y
      controla la vigencia de sus cuentas.
    </p>
  </section>

  <form
    class="card form-card wide-card"
    novalidate
    @submit.prevent="submitUser"
  >
    <h2>Crear usuario</h2>

    <div class="form-grid">
      <div class="field">
        <label for="user-name">Nombre</label>
        <input
          id="user-name"
          v-model.trim="name"
          placeholder="Ej. Dra. Sofía Morales"
          required
        />
      </div>

      <div class="field">
        <label for="user-email">Correo</label>
        <input
          id="user-email"
          v-model.trim="email"
          type="email"
          placeholder="sofia.morales@aspar.org"
          required
        />
      </div>

      <div class="field">
        <label for="user-role">Rol</label>
        <select id="user-role" v-model="role">
          <option
            v-for="itemRole in USER_ROLES"
            :key="itemRole"
            :value="itemRole"
          >
            {{ itemRole }}
          </option>
        </select>
      </div>

      <div class="field">
        <label for="user-department">Área o unidad en ASPAR</label>
        <input
          id="user-department"
          v-model.trim="department"
          placeholder="Dirección, Fisioterapia, Fonoaudiología, Apoyo"
        />
      </div>
    </div>

    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <p v-if="successMsg" class="success-message" role="status">
      {{ successMsg }}
    </p>

    <div class="form-actions">
      <button
        class="button button-primary"
        type="submit"
        :disabled="isSubmitting"
      >
        {{ isSubmitting ? 'Creando usuario...' : 'Crear usuario' }}
      </button>
    </div>
  </form>

  <section
    v-if="credential"
    class="card credential-card"
    role="status"
    aria-live="polite"
  >
    <h2>Contraseña temporal</h2>
    <p>
      Entrega esta contraseña a <strong>{{ credential.email }}</strong> por un
      canal privado. <strong>Se muestra una sola vez</strong>: al cerrar este
      aviso ya no se puede volver a consultar.
    </p>
    <code class="credential-password">{{ credential.password }}</code>
    <div class="form-actions">
      <button
        class="button button-small button-secondary"
        type="button"
        @click="copyCredential"
      >
        {{ copied ? 'Copiada' : 'Copiar' }}
      </button>
      <button
        class="button button-small button-primary"
        type="button"
        @click="credential = null"
      >
        Ya la entregué
      </button>
    </div>
  </section>

  <section class="card table-card patient-list">
    <div class="section-title table-heading">
      <div>
        <h2>Usuarios registrados</h2>
        <p class="muted">{{ filteredUsers.length }} usuarios</p>
      </div>

      <select v-model="roleFilter" aria-label="Filtrar usuarios por rol">
        <option value="Todos">Todos los roles</option>
        <option
          v-for="itemRole in USER_ROLES"
          :key="itemRole"
          :value="itemRole"
        >
          {{ itemRole }}
        </option>
      </select>
    </div>

    <article v-for="user in filteredUsers" :key="user.id" class="patient-row">
      <div class="patient-main">
        <strong>{{ user.name }}</strong>
        <small>
          {{ user.email }} · Área: {{ user.department || 'General' }}
        </small>
      </div>

      <label class="access-control">
        Rol
        <select
          :value="user.role"
          @change="
            changeRole(
              user,
              ($event.target as HTMLSelectElement).value as UserRole,
            )
          "
        >
          <option
            v-for="itemRole in USER_ROLES"
            :key="itemRole"
            :value="itemRole"
          >
            {{ itemRole }}
          </option>
        </select>
      </label>

      <button
        class="button button-small button-secondary"
        type="button"
        @click="resetPassword(user)"
      >
        Restablecer contraseña
      </button>

      <button
        class="button button-small"
        :class="user.active ? 'button-absent' : 'button-present'"
        type="button"
        @click="toggleActive(user)"
      >
        {{ user.active ? 'Desactivar' : 'Activar' }}
      </button>
    </article>
  </section>
</template>
