<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    description?: string
    size?: 'sm' | 'md' | 'lg'
    /** false: solo se cierra con los botones del propio modal (decisiones importantes). */
    dismissible?: boolean
  }>(),
  { description: undefined, size: 'md', dismissible: true },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  close: []
}>()

const titleId = useId()
const descriptionId = useId()
const dialog = ref<HTMLElement | null>(null)
let previouslyFocused: HTMLElement | null = null

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function focusables(): HTMLElement[] {
  return dialog.value
    ? Array.from(dialog.value.querySelectorAll<HTMLElement>(FOCUSABLE))
    : []
}

function close() {
  emit('update:open', false)
  emit('close')
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.dismissible) {
    event.stopPropagation()
    close()
    return
  }
  if (event.key !== 'Tab') return
  // Mantiene el foco dentro del modal
  const items = focusables()
  if (items.length === 0) {
    event.preventDefault()
    return
  }
  const first = items[0]!
  const last = items[items.length - 1]!
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

function onBackdrop() {
  if (props.dismissible) close()
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      previouslyFocused = document.activeElement as HTMLElement | null
      document.body.style.overflow = 'hidden'
      await nextTick()
      const autofocus = dialog.value?.querySelector<HTMLElement>('[autofocus]')
      ;(autofocus ?? focusables()[0] ?? dialog.value)?.focus()
    } else {
      document.body.style.overflow = ''
      previouslyFocused?.focus?.()
      previouslyFocused = null
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="modal-backdrop" @mousedown.self="onBackdrop">
        <div
          ref="dialog"
          class="modal"
          :class="`modal--${size}`"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          :aria-describedby="description ? descriptionId : undefined"
          tabindex="-1"
          @keydown="onKeydown"
        >
          <header class="modal__header">
            <div>
              <h2 :id="titleId" class="modal__title">{{ title }}</h2>
              <p
                v-if="description"
                :id="descriptionId"
                class="modal__description"
              >
                {{ description }}
              </p>
            </div>
            <button
              v-if="dismissible"
              type="button"
              class="modal__close"
              aria-label="Cerrar"
              @click="close"
            >
              ×
            </button>
          </header>
          <div class="modal__body"><slot /></div>
          <footer v-if="$slots.actions" class="modal__actions">
            <slot name="actions" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: grid;
  place-items: center;
  padding: var(--space-4);
  background: var(--color-overlay);
  backdrop-filter: blur(2px);
}

.modal {
  width: 100%;
  max-height: calc(100vh - 2 * var(--space-4));
  overflow: auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
}

.modal:focus-visible {
  box-shadow: var(--shadow-lg), var(--focus-ring);
}

.modal--sm {
  max-width: 26rem;
}

.modal--md {
  max-width: 34rem;
}

.modal--lg {
  max-width: 46rem;
}

.modal__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-6) var(--space-6) var(--space-2);
}

.modal__title {
  font-size: var(--text-2xl);
}

.modal__description {
  margin-top: var(--space-2);
  color: var(--color-text-muted);
}

.modal__close {
  flex: none;
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-out);
}

.modal__close:hover {
  background: var(--color-surface-muted);
  color: var(--color-text);
}

.modal__body {
  padding: var(--space-4) var(--space-6);
}

.modal__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-6) var(--space-6);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity var(--duration-base) var(--ease-out);
}

.modal-enter-active .modal,
.modal-leave-active .modal {
  transition: transform var(--duration-base) var(--ease-out);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal,
.modal-leave-to .modal {
  transform: translateY(8px) scale(0.98);
}

@media (max-width: 480px) {
  .modal-backdrop {
    place-items: end center;
    padding: 0;
  }

  .modal {
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    max-height: 92vh;
  }
}
</style>
