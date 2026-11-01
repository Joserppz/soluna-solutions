<script setup lang="ts">
import { computed, useId } from 'vue'

const props = withDefaults(
  defineProps<{
    label: string
    hint?: string
    /** Mensaje de error ya validado; si hay error, reemplaza a la ayuda. */
    error?: string | null
    required?: boolean
    id?: string
  }>(),
  { hint: undefined, error: null, required: false, id: undefined },
)

const generatedId = useId()
const inputId = computed(() => props.id ?? `campo-${generatedId}`)
const messageId = computed(() => `${inputId.value}-mensaje`)
const describedBy = computed(() =>
  props.error || props.hint ? messageId.value : undefined,
)
</script>

<template>
  <div class="field" :class="{ 'field--error': error }">
    <label class="field__label" :for="inputId">
      {{ label }}
      <span v-if="required" class="field__required" aria-hidden="true">*</span>
    </label>
    <slot :id="inputId" :described-by="describedBy" :invalid="Boolean(error)" />
    <Transition name="field-message" mode="out-in">
      <p v-if="error" :id="messageId" :key="'e'" class="field__error">
        {{ error }}
      </p>
      <p v-else-if="hint" :id="messageId" :key="'h'" class="field__hint">
        {{ hint }}
      </p>
    </Transition>
  </div>
</template>

<style scoped>
.field {
  display: grid;
  gap: var(--space-2);
}

.field__label {
  font-weight: 600;
  font-size: var(--text-md);
  color: var(--color-text);
}

.field__required {
  margin-left: 0.15em;
  color: var(--aspar-rojo);
}

.field__hint,
.field__error {
  font-size: var(--text-sm);
  line-height: var(--leading-snug);
}

.field__hint {
  color: var(--color-text-muted);
}

.field__error {
  color: var(--aspar-rojo);
  font-weight: 600;
}

.field-message-enter-active,
.field-message-leave-active {
  transition:
    opacity var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

.field-message-enter-from,
.field-message-leave-to {
  opacity: 0;
  transform: translateY(-2px);
}
</style>
