<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  USER_ROLES,
  createUser,
  getUsers,
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

const filteredUsers = computed(() => {
  if (roleFilter.value === 'Todos') return users.value
  return users.value.filter((u) => u.role === roleFilter.value)
})

function submitUser() {
  error.value = ''
  successMsg.value = ''

  try {
    createUser(name.value, email.value, role.value, department.value)
    users.value = getUsers()
    successMsg.value = `Usuario ${email.value.trim()} creado y sincronizado con rol ${role.value}.`
    name.value = ''
    email.value = ''
    role.value = 'Profesional'
    department.value = 'Fisioterapia y Rehabilitación'
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'No se pudo crear el usuario.'
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

  <form class="card form-card wide-card" novalidate @submit.prevent="submitUser">
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
          <option v-for="itemRole in USER_ROLES" :key="itemRole" :value="itemRole">
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
      <button class="button button-primary" type="submit">Crear usuario</button>
    </div>
  </form>

  <section class="card table-card patient-list">
    <div class="section-title table-heading">
      <div>
        <h2>Usuarios registrados</h2>
        <p class="muted">{{ filteredUsers.length }} usuarios</p>
      </div>

      <select v-model="roleFilter" aria-label="Filtrar usuarios por rol">
        <option value="Todos">Todos los roles</option>
        <option v-for="itemRole in USER_ROLES" :key="itemRole" :value="itemRole">
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
          <option v-for="itemRole in USER_ROLES" :key="itemRole" :value="itemRole">
            {{ itemRole }}
          </option>
        </select>
      </label>

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
