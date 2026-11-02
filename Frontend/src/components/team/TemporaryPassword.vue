<script setup lang="ts">
/**
 * Contraseña temporal que generó el servidor. Se muestra una sola vez: se entrega en
 * persona y la persona la cambia al ingresar.
 */
import { ref } from 'vue'

defineProps<{ title: string; password: string }>()

const copied = ref(false)

async function copy(password: string) {
  try {
    await navigator.clipboard.writeText(password)
    copied.value = true
  } catch {
    copied.value = false
  }
}
</script>

<template>
  <section class="temporary" aria-live="polite">
    <h3 class="temporary__title">{{ title }}</h3>
    <p class="temporary__hint">
      Contraseña temporal · se muestra solo esta vez
    </p>
    <div class="temporary__box">
      <code class="temporary__password" data-testid="contrasena-temporal">{{
        password
      }}</code>
      <button
        type="button"
        class="temporary__copy"
        :aria-label="copied ? 'Contraseña copiada' : 'Copiar la contraseña'"
        @click="copy(password)"
      >
        {{ copied ? 'Copiada' : 'Copiar' }}
      </button>
    </div>
    <p class="temporary__note">
      Entrégala en persona y pídele que la cambie al ingresar.
    </p>
    <slot />
  </section>
</template>

<style scoped>
.temporary {
  display: grid;
  gap: var(--space-2);
  padding: clamp(var(--space-4), 2.4vh, var(--space-6));
  border-radius: var(--radius-lg);
  background: var(--aspar-verde);
  color: #f4efe6;
}

.temporary__title {
  font-family: var(--font-sans);
  font-size: var(--text-md);
  font-weight: 700;
  color: inherit;
}

.temporary__hint,
.temporary__note {
  font-size: var(--text-sm);
  color: rgb(244 239 230 / 0.82);
}

.temporary__box {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-block: var(--space-1);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  background: rgb(255 255 255 / 0.08);
}

.temporary__password {
  /* En una sola línea: se dicta o se copia tal cual */
  font-family: var(--font-mono);
  font-size: clamp(1.05rem, 2.4vh, 1.4rem);
  letter-spacing: 0.04em;
  white-space: nowrap;
  color: #fff;
}

.temporary__copy {
  flex-shrink: 0;
  padding: var(--space-1) var(--space-3);
  border: 1px solid rgb(244 239 230 / 0.5);
  border-radius: var(--radius-sm);
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
}

.temporary__copy:hover {
  background: rgb(255 255 255 / 0.1);
}

.temporary__copy:focus-visible {
  box-shadow: 0 0 0 3px rgb(244 239 230 / 0.7);
}
</style>
