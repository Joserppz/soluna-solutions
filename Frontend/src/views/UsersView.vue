<script setup lang="ts">
import { ref } from 'vue'
import {
  createUser,
  getUsers,
  updateUser,
  type User,
  type UserRole,
} from '../services/aspar'

const users = ref<User[]>(getUsers())
const name = ref('')
const email = ref('')
const role = ref<UserRole>('Profesional')
const error = ref('')

function submitUser() {
  error.value = ''

  try {
    createUser(name.value, email.value, role.value)
    users.value = getUsers()
    name.value = ''
    email.value = ''
    role.value = 'Profesional'
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
</script>

<template>
  <section class="page-heading">
    <span class="eyebrow">Administración</span>
    <h1>Usuarios y roles</h1>
    <p>Crea usuarios, asigna roles y activa o desactiva su acceso.</p>
  </section>

  <form class="card form-card wide-card" @submit.prevent="submitUser">
    <h2>Crear usuario</h2>

    <div class="form-grid">
      <div class="field">
        <label for="user-name">Nombre</label>
        <input id="user-name" v-model.trim="name" required />
      </div>

      <div class="field">
        <label for="user-email">Correo</label>
        <input id="user-email" v-model.trim="email" type="email" required />
      </div>

      <div class="field">
        <label for="user-role">Rol</label>
        <select id="user-role" v-model="role">
          <option>Administrador</option>
          <option>Profesional</option>
          <option>Recepción</option>
        </select>
      </div>
    </div>

    <p v-if="error" class="form-error" role="alert">{{ error }}</p>

    <div class="form-actions">
      <button class="button button-primary" type="submit">Crear usuario</button>
    </div>
  </form>

  <section class="card table-card patient-list">
    <div class="section-title table-heading">
      <div>
        <h2>Usuarios registrados</h2>
        <p class="muted">{{ users.length }} usuarios</p>
      </div>
    </div>

    <article v-for="user in users" :key="user.id" class="patient-row">
      <div class="patient-main">
        <strong>{{ user.name }}</strong>
        <small>{{ user.email }}</small>
      </div>

      <label class="access-control">
        Rol
        <select
          :value="user.role"
          @change="changeRole(user, ($event.target as HTMLSelectElement).value as UserRole)"
        >
          <option>Administrador</option>
          <option>Profesional</option>
          <option>Recepción</option>
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