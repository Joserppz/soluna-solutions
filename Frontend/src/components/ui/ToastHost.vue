<script setup lang="ts">
import { computed } from 'vue'
import { useToast } from '../../composables/useToast'

const { toasts, dismiss } = useToast()
const errors = computed(() => toasts.value.filter((t) => t.tone === 'error'))
const others = computed(() => toasts.value.filter((t) => t.tone !== 'error'))
const ICON = { success: '✓', info: 'i', error: '!' } as const
</script>

<template>
  <div class="toast-region">
    <!-- Los errores interrumpen al lector de pantalla; el resto se anuncia con calma -->
    <TransitionGroup
      tag="div"
      name="toast"
      class="toast-stack"
      role="alert"
      aria-live="assertive"
    >
      <div v-for="toast in errors" :key="toast.id" class="toast toast--error">
        <span class="toast__icon" aria-hidden="true">{{ ICON.error }}</span>
        <p class="toast__message">{{ toast.message }}</p>
        <button
          type="button"
          class="toast__close"
          aria-label="Cerrar aviso"
          @click="dismiss(toast.id)"
        >
          ×
        </button>
      </div>
    </TransitionGroup>
    <TransitionGroup
      tag="div"
      name="toast"
      class="toast-stack"
      role="status"
      aria-live="polite"
    >
      <div
        v-for="toast in others"
        :key="toast.id"
        class="toast"
        :class="`toast--${toast.tone}`"
      >
        <span class="toast__icon" aria-hidden="true">{{
          ICON[toast.tone]
        }}</span>
        <p class="toast__message">{{ toast.message }}</p>
        <button
          type="button"
          class="toast__close"
          aria-label="Cerrar aviso"
          @click="dismiss(toast.id)"
        >
          ×
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-region {
  position: fixed;
  right: var(--space-6);
  bottom: var(--space-6);
  z-index: var(--z-toast);
  display: grid;
  gap: var(--space-2);
  width: min(24rem, calc(100vw - 2 * var(--space-4)));
  pointer-events: none;
}

.toast-stack {
  display: grid;
  gap: var(--space-2);
}

.toast {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-3) var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  background: var(--verde-900);
  color: #fff;
  box-shadow: var(--shadow-lg);
  pointer-events: auto;
}

.toast--error {
  background: var(--guindo-900);
}

.toast__icon {
  flex: none;
  display: grid;
  place-items: center;
  width: 1.35rem;
  height: 1.35rem;
  margin-top: 0.1rem;
  border-radius: 50%;
  background: rgb(255 255 255 / 0.16);
  font-size: var(--text-xs);
  font-weight: 700;
}

.toast__message {
  flex: 1;
  font-size: var(--text-md);
  line-height: var(--leading-snug);
  padding-top: 0.1rem;
}

.toast__close {
  flex: none;
  width: 1.75rem;
  height: 1.75rem;
  border: 0;
  border-radius: var(--radius-xs);
  background: transparent;
  color: rgb(255 255 255 / 0.75);
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
}

.toast__close:hover {
  background: rgb(255 255 255 / 0.12);
  color: #fff;
}

.toast__close:focus-visible {
  box-shadow: var(--focus-ring-on-dark);
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity var(--duration-base) var(--ease-out),
    transform var(--duration-base) var(--ease-out);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@media (max-width: 480px) {
  .toast-region {
    right: var(--space-4);
    bottom: var(--space-4);
  }
}
</style>

<style>
/* Con una ventana abierta, los avisos esperan detrás: no tapan sus botones ni su
   cierre. La ventana muestra sus propios errores; al cerrarla, el aviso vuelve a verse */
body:has([aria-modal='true']) .toast-region {
  visibility: hidden;
}
</style>
