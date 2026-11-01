<script setup lang="ts">
import { ref } from 'vue'

withDefaults(
  defineProps<{
    id: string
    autocomplete?: 'current-password' | 'new-password'
    invalid?: boolean
    describedBy?: string
    required?: boolean
    placeholder?: string
  }>(),
  {
    autocomplete: 'current-password',
    invalid: false,
    describedBy: undefined,
    required: false,
    placeholder: undefined,
  },
)

const model = defineModel<string>({ required: true })
const emit = defineEmits<{ blur: [] }>()
const visible = ref(false)
</script>

<template>
  <div class="password">
    <input
      :id="id"
      v-model="model"
      class="input password__input"
      :type="visible ? 'text' : 'password'"
      :autocomplete="autocomplete"
      :aria-invalid="invalid || undefined"
      :aria-describedby="describedBy"
      :required="required"
      :placeholder="placeholder"
      spellcheck="false"
      autocapitalize="off"
      @blur="emit('blur')"
    />
    <button
      type="button"
      class="password__toggle"
      :aria-pressed="visible"
      :aria-controls="id"
      :aria-label="visible ? 'Ocultar contraseña' : 'Mostrar contraseña'"
      @click="visible = !visible"
    >
      {{ visible ? 'Ocultar' : 'Mostrar' }}
    </button>
  </div>
</template>

<style scoped>
.password {
  position: relative;
}

.password__input {
  padding-right: 6rem;
}

.password__toggle {
  position: absolute;
  top: 50%;
  right: var(--space-2);
  transform: translateY(-50%);
  min-height: 2.25rem;
  padding: 0 var(--space-3);
  border: 0;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--aspar-guindo);
  font-weight: 600;
  font-size: var(--text-sm);
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-out);
}

.password__toggle:hover {
  background: var(--rosa-100);
}
</style>
