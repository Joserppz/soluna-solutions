<script setup lang="ts">
/**
 * «Nueva persona en el equipo» (diseño pág. 18): Administración crea el acceso con un
 * rol y el servidor genera una contraseña temporal aleatoria, que se muestra una sola
 * vez para entregarla en persona.
 */
import { computed, nextTick, reactive, ref } from 'vue'

import { isApiError } from '../../api/errors'
import type { RoleOut, UserCreated } from '../../api/types'
import { useApi } from '../../composables/useApi'
import { firstName } from '../../utils/format'
import AppAlert from '../ui/AppAlert.vue'
import AppButton from '../ui/AppButton.vue'
import FormField from '../ui/FormField.vue'
import TemporaryPassword from './TemporaryPassword.vue'

const props = withDefaults(
  defineProps<{
    roles: RoleOut[]
    /** Se puede cerrar (en pantallas donde no queda fijo al costado). */
    closable?: boolean
    /** Ventana completa: cada rol en una sola línea, para que nada se desplace. */
    compact?: boolean
  }>(),
  { closable: false, compact: false },
)
const emit = defineEmits<{ created: [user: UserCreated]; close: [] }>()

const { api } = useApi()

/** Se propone el rol con menos acceso: el resto se elige a propósito. */
const DEFAULT_ROLE = 'volunteer'
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const form = reactive({ name: '', email: '', role: DEFAULT_ROLE })
const submitted = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)
const created = ref<UserCreated | null>(null)
const nameInput = ref<HTMLInputElement | null>(null)

const nameMessage = computed(() =>
  submitted.value && form.name.trim().length < 3
    ? 'Escribe el nombre completo (al menos 3 letras).'
    : null,
)
const emailMessage = computed(() => {
  if (!submitted.value) return null
  if (!form.email.trim()) return 'Escribe el correo de la persona.'
  if (!EMAIL_PATTERN.test(form.email.trim()))
    return 'Revisa el correo: debe tener la forma nombre@dominio.com.'
  return null
})
const roleMessage = computed(() =>
  submitted.value && !props.roles.some((role) => role.key === form.role)
    ? 'Elige un rol.'
    : null,
)

async function submit() {
  submitted.value = true
  error.value = null
  if (nameMessage.value || emailMessage.value || roleMessage.value) return
  saving.value = true
  try {
    const user = await api.users.create({
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      role: form.role,
    })
    created.value = user
    emit('created', user)
  } catch (failure) {
    error.value = isApiError(failure)
      ? failure.message
      : 'No pudimos crear el acceso. Intenta de nuevo.'
  } finally {
    saving.value = false
  }
}

async function inviteAnother() {
  created.value = null
  Object.assign(form, { name: '', email: '', role: DEFAULT_ROLE })
  submitted.value = false
  error.value = null
  await focus()
}

async function focus() {
  if (created.value) {
    await inviteAnother()
    return
  }
  await nextTick()
  nameInput.value?.focus()
}

defineExpose({ focus })
</script>

<template>
  <section
    class="invite surface-card"
    :class="{ 'invite--compact': compact }"
    aria-labelledby="invitar-titulo"
    data-testid="panel-invitar"
  >
    <template v-if="!created">
      <header class="invite__head">
        <div>
          <p class="invite__eyebrow">Invitar</p>
          <h2 id="invitar-titulo">Nueva persona en el equipo</h2>
        </div>
        <button
          v-if="closable"
          type="button"
          class="invite__close"
          aria-label="Cerrar la invitación"
          @click="emit('close')"
        >
          ×
        </button>
      </header>

      <form class="invite__form" novalidate @submit.prevent="submit">
        <AppAlert v-if="error" tone="error">{{ error }}</AppAlert>
        <FormField
          v-slot="{ id, describedBy, invalid }"
          label="Nombre completo"
          required
          :error="nameMessage"
        >
          <input
            :id="id"
            ref="nameInput"
            v-model="form.name"
            class="input"
            maxlength="120"
            autocomplete="off"
            :aria-describedby="describedBy"
            :aria-invalid="invalid"
          />
        </FormField>
        <FormField
          v-slot="{ id, describedBy, invalid }"
          label="Correo"
          required
          :error="emailMessage"
        >
          <input
            :id="id"
            v-model="form.email"
            class="input"
            type="email"
            maxlength="150"
            autocomplete="off"
            :aria-describedby="describedBy"
            :aria-invalid="invalid"
          />
        </FormField>

        <fieldset class="invite__roles">
          <legend>Rol <span aria-hidden="true">*</span></legend>
          <p v-if="roleMessage" class="invite__error" role="alert">
            {{ roleMessage }}
          </p>
          <label
            v-for="role in roles"
            :key="role.key"
            class="role-choice"
            :class="{ 'is-selected': form.role === role.key }"
          >
            <input v-model="form.role" type="radio" :value="role.key" />
            <span class="role-choice__text">
              <strong>{{ role.name }}</strong>
              <small :title="role.description">{{ role.description }}</small>
            </span>
          </label>
        </fieldset>

        <AppButton
          type="submit"
          block
          :loading="saving"
          loading-label="Creando el acceso…"
        >
          Crear acceso
        </AppButton>
      </form>
    </template>

    <TemporaryPassword
      v-else
      :title="`Acceso listo para ${firstName(created.name)}`"
      :password="created.temporaryPassword"
    >
      <p class="invite__summary">
        {{ created.email }} · {{ created.roleName }}
      </p>
      <div class="invite__next">
        <AppButton variant="on-dark" size="sm" @click="inviteAnother">
          Invitar a otra persona
        </AppButton>
        <AppButton
          v-if="closable"
          variant="on-dark"
          size="sm"
          @click="emit('close')"
        >
          Listo
        </AppButton>
      </div>
    </TemporaryPassword>
  </section>
</template>

<style scoped>
.invite {
  display: grid;
  align-content: start;
  gap: clamp(var(--space-3), 2vh, var(--space-5));
  padding: clamp(var(--space-4), 2.4vh, var(--space-6));
}

.invite:has(.temporary) {
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
}

.invite__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

.invite__close {
  flex: none;
  width: 2rem;
  height: 2rem;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  font-size: var(--text-xl);
  line-height: 1;
  cursor: pointer;
}

.invite__close:hover {
  background: var(--color-surface-muted);
  color: var(--color-text);
}

.invite__eyebrow {
  color: var(--aspar-rojo);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.invite__head h2 {
  font-family: var(--font-sans);
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--color-text);
}

.invite__form {
  display: grid;
  gap: clamp(var(--space-2), 1.6vh, var(--space-4));
}

.invite__roles {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.invite__roles legend {
  margin-bottom: var(--space-2);
  padding: 0;
  font-weight: 600;
}

.invite__error {
  color: var(--aspar-rojo);
  font-size: var(--text-sm);
}

.role-choice {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: clamp(0.4rem, 1vh, var(--space-3)) var(--space-3);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition:
    border-color var(--duration-base) var(--ease-out),
    background var(--duration-base) var(--ease-out);
}

.role-choice:hover {
  border-color: var(--aspar-guindo);
}

.role-choice.is-selected {
  border-color: var(--aspar-guindo);
  background: var(--rosa-50);
}

.role-choice:has(input:focus-visible) {
  box-shadow: var(--focus-ring);
}

.role-choice input {
  flex: none;
  width: 1.05rem;
  height: 1.05rem;
  margin-top: 0.2rem;
  accent-color: var(--aspar-guindo);
}

.role-choice__text {
  display: grid;
  min-width: 0;
  line-height: var(--leading-snug);
}

.role-choice__text small {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.invite--compact {
  gap: clamp(0.5rem, 1.6vh, 1rem);
  padding: clamp(0.75rem, 2vh, 1.5rem);
}

.invite--compact .invite__roles {
  gap: 0.3rem;
}

.invite--compact .invite__roles legend {
  margin-bottom: 0.2rem;
}

.invite--compact .role-choice {
  padding: 0.3rem 0.6rem;
}

.invite--compact .role-choice__text small {
  overflow: hidden;
  font-size: var(--text-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.invite__summary {
  font-size: var(--text-sm);
  color: rgb(244 239 230 / 0.82);
  overflow-wrap: anywhere;
}

.invite__next {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-2);
}
</style>
