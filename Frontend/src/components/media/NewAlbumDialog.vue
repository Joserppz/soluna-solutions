<script setup lang="ts">
/** «+ Nuevo álbum» (diseño pág. 13): nace privado; se publica cuando se revisan los permisos. */
import { computed, reactive, ref, watch } from 'vue'

import { isApiError } from '../../api/errors'
import type { AlbumOut } from '../../api/types'
import { useApi } from '../../composables/useApi'
import AppAlert from '../ui/AppAlert.vue'
import AppButton from '../ui/AppButton.vue'
import AppModal from '../ui/AppModal.vue'
import FormField from '../ui/FormField.vue'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  created: [album: AlbumOut]
}>()

const { api } = useApi()
const form = reactive({ title: '', description: '' })
const submitted = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    Object.assign(form, { title: '', description: '' })
    submitted.value = false
    error.value = null
  },
)

const titleError = computed(() =>
  form.title.trim().length < 3
    ? 'Escribe el nombre del álbum (al menos 3 letras).'
    : null,
)

async function save() {
  submitted.value = true
  error.value = null
  if (titleError.value) return
  saving.value = true
  try {
    const album = await api.media.createAlbum({
      title: form.title.trim(),
      description: form.description.trim(),
    })
    emit('created', album)
    emit('update:open', false)
  } catch (failure) {
    error.value = isApiError(failure)
      ? failure.message
      : 'No pudimos crear el álbum. Intenta de nuevo.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppModal
    :open="open"
    size="md"
    title="Nuevo álbum"
    description="Queda privado hasta que revises los permisos de imagen y lo publiques."
    :dismissible="!saving"
    @update:open="emit('update:open', $event)"
  >
    <form id="nuevo-album" class="album-form" novalidate @submit.prevent="save">
      <AppAlert v-if="error" tone="error">{{ error }}</AppAlert>
      <FormField
        v-slot="{ id, describedBy, invalid }"
        label="Nombre del álbum"
        required
        :error="submitted ? (titleError ?? undefined) : undefined"
      >
        <input
          :id="id"
          v-model="form.title"
          class="input"
          maxlength="120"
          placeholder="Por ejemplo: Crear con las manos"
          :aria-describedby="describedBy"
          :aria-invalid="invalid"
        />
      </FormField>
      <FormField v-slot="{ id }" label="Descripción">
        <textarea
          :id="id"
          v-model="form.description"
          class="textarea"
          rows="3"
          maxlength="500"
          placeholder="Qué pasó en el encuentro, en una o dos frases."
        />
      </FormField>
    </form>
    <template #actions>
      <AppButton
        variant="secondary"
        :disabled="saving"
        @click="emit('update:open', false)"
      >
        Cancelar
      </AppButton>
      <AppButton
        type="submit"
        form="nuevo-album"
        :loading="saving"
        loading-label="Creando…"
      >
        Crear álbum
      </AppButton>
    </template>
  </AppModal>
</template>

<style scoped>
.album-form {
  display: grid;
  gap: var(--space-4);
}
</style>
