<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import AppButton from '../../components/ui/AppButton.vue'
import { useApi } from '../../composables/useApi'
import { useToast } from '../../composables/useToast'
import AuthLayout from '../../layouts/AuthLayout.vue'
import { homeFor, snapshotOf } from '../../router/guards'
import { firstName } from '../../utils/format'

const { session } = useApi()
const router = useRouter()
const toast = useToast()
const checking = ref(false)

const user = computed(() => session.state.user)

async function checkAgain() {
  checking.value = true
  try {
    await session.restore()
    if (session.isPendingApproval.value) {
      toast.info(
        'Todavía no tienes un rol asignado. Te avisaremos cuando Administración lo haga.',
      )
      return
    }
    toast.success('¡Listo! Ya tienes acceso al espacio del equipo.')
    await router.replace(homeFor(snapshotOf(session)))
  } catch {
    toast.error('No pudimos revisar tu cuenta. Inténtalo en un momento.')
  } finally {
    checking.value = false
  }
}

async function logout() {
  await session.logout()
  await router.push({ name: 'inicio' })
}
</script>

<template>
  <AuthLayout
    eyebrow="Tu cuenta"
    headline="Gracias por"
    accent="sumarte a ASPAR."
    intro="Cada persona del equipo ve solo lo que necesita para acompañar a la comunidad."
  >
    <header class="pending__header">
      <h1 class="pending__title">
        Tu cuenta está lista{{ user ? `, ${firstName(user.name)}` : '' }}.
      </h1>
      <p class="pending__lead">
        Administración revisará tu solicitud y te asignará un rol. Cuando lo
        haga, vas a entrar al espacio del equipo con este mismo correo.
      </p>
    </header>

    <ol class="steps" aria-label="Estado de tu cuenta">
      <li class="steps__item is-done">
        <span class="steps__mark" aria-hidden="true">✓</span>
        <span>
          <strong>Cuenta creada</strong>
          <small>{{ user?.email }}</small>
        </span>
        <span class="visually-hidden">Completado.</span>
      </li>
      <li class="steps__item is-done">
        <span class="steps__mark" aria-hidden="true">✓</span>
        <span>
          <strong>Correo confirmado</strong>
          <small>Ya sabemos que el correo es tuyo.</small>
        </span>
        <span class="visually-hidden">Completado.</span>
      </li>
      <li class="steps__item is-waiting" aria-current="step">
        <span class="steps__mark" aria-hidden="true" />
        <span>
          <strong>Administración asigna tu rol</strong>
          <small>En espera. Mientras tanto, puedes recorrer el sitio.</small>
        </span>
      </li>
    </ol>

    <div class="pending__actions">
      <AppButton size="lg" :to="{ name: 'inicio' }">
        Volver al sitio público
      </AppButton>
      <AppButton
        size="lg"
        variant="secondary"
        :loading="checking"
        loading-label="Revisando…"
        @click="checkAgain"
      >
        Ya me aprobaron: revisar
      </AppButton>
    </div>

    <p class="pending__logout">
      ¿Entraste con otra cuenta?
      <AppButton variant="link" @click="logout">Cerrar sesión</AppButton>
    </p>
  </AuthLayout>
</template>

<style scoped>
.pending__header {
  display: grid;
  gap: var(--space-3);
}

.pending__title {
  font-size: var(--text-4xl);
}

.pending__lead {
  color: var(--color-text-muted);
  font-size: var(--text-lg);
}

.steps {
  display: grid;
  gap: 0;
  margin: 0;
  padding: var(--space-5);
  list-style: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
}

.steps__item {
  position: relative;
  display: flex;
  gap: var(--space-4);
  padding: var(--space-3) 0;
}

.steps__item + .steps__item::before {
  content: '';
  position: absolute;
  left: 0.85rem;
  top: -0.75rem;
  height: 1.5rem;
  border-left: 2px solid var(--color-border-strong);
}

.steps__item span:not(.steps__mark) {
  display: grid;
  line-height: 1.35;
}

.steps__item small {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.steps__mark {
  flex: none;
  display: grid;
  place-items: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  font-size: var(--text-sm);
  font-weight: 700;
}

.is-done .steps__mark {
  background: var(--tone-success-fg);
  color: #fff;
}

.is-waiting .steps__mark {
  border: 2px solid var(--aspar-guindo);
  background: var(--rosa-100);
  animation: pending-pulse 2s ease-in-out infinite;
}

.pending__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.pending__logout {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  color: var(--color-text-muted);
}

@keyframes pending-pulse {
  50% {
    box-shadow: 0 0 0 6px rgb(109 22 25 / 0.08);
  }
}
</style>
