<script setup lang="ts">
/**
 * «Personas en esta foto» (diseño pág. 13): etiquetar es opcional, pero si alguien sin
 * «Uso de imagen: autorizado» en su ficha aparece, el álbum no se publica hasta quitar
 * la foto o taparle el rostro. Solo se buscan afiliados por nombre o carnet; la galería
 * nunca guarda datos clínicos.
 */
import { computed, ref, watch } from 'vue'

import { isApiError } from '../../api/errors'
import type { AssetOut, PatientSummary } from '../../api/types'
import { useApi } from '../../composables/useApi'
import AppAlert from '../ui/AppAlert.vue'
import AppButton from '../ui/AppButton.vue'
import AppModal from '../ui/AppModal.vue'
import StatusBadge from '../ui/StatusBadge.vue'

interface Person {
  patientId: string
  name: string
  imageConsent: boolean
}

const props = defineProps<{
  open: boolean
  asset: AssetOut | null
  /** Buscar afiliados necesita «Ver afiliados». */
  canSearch: boolean
}>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  updated: [asset: AssetOut]
  /** «Quitar la foto del álbum…»: quien abrió la ventana pide confirmarlo. */
  remove: [asset: AssetOut]
}>()

const { api } = useApi()
const people = ref<Person[]>([])
const query = ref('')
const results = ref<PatientSummary[]>([])
const searching = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)

watch(
  () => props.open,
  (open) => {
    if (!open || !props.asset) return
    people.value = props.asset.tags.map((tag) => ({ ...tag }))
    query.value = ''
    results.value = []
    error.value = null
  },
)

let searchTimer: ReturnType<typeof setTimeout> | undefined
let request = 0
watch(query, (value) => {
  clearTimeout(searchTimer)
  const term = value.trim()
  if (term.length < 2) {
    results.value = []
    return
  }
  searchTimer = setTimeout(async () => {
    const current = ++request
    searching.value = true
    try {
      const page = await api.patients.list({ search: term, limit: 6 })
      if (current === request) results.value = page.items
    } catch {
      if (current === request) results.value = []
    } finally {
      if (current === request) searching.value = false
    }
  }, 300)
})

const withoutPermission = computed(() =>
  people.value.filter((person) => !person.imageConsent),
)
const changed = computed(() => {
  const before = (props.asset?.tags ?? []).map((t) => t.patientId).sort()
  const after = people.value.map((p) => p.patientId).sort()
  return before.join() !== after.join()
})

function add(patient: PatientSummary) {
  if (people.value.some((person) => person.patientId === patient.id)) return
  people.value.push({
    patientId: patient.id,
    name: patient.name,
    imageConsent: patient.imageConsent,
  })
  query.value = ''
  results.value = []
}

function remove(patientId: string) {
  people.value = people.value.filter((person) => person.patientId !== patientId)
}

async function save() {
  if (!props.asset) return
  saving.value = true
  error.value = null
  try {
    const saved = await api.media.setTags(
      props.asset.id,
      people.value.map((person) => person.patientId),
    )
    emit('updated', saved)
    emit('update:open', false)
  } catch (failure) {
    error.value = isApiError(failure)
      ? failure.message
      : 'No pudimos guardar las personas de la foto. Intenta de nuevo.'
  } finally {
    saving.value = false
  }
}

/** Si una imagen no carga (sin conexión con Cloudinary), queda el fondo y no el ícono roto. */
function hideBroken(event: Event) {
  ;(event.target as HTMLImageElement).style.visibility = 'hidden'
}
</script>

<template>
  <AppModal
    :open="open"
    size="lg"
    title="Personas en esta foto"
    description="Opcional. Sirve para revisar que todas dieron su permiso de imagen."
    :dismissible="!saving"
    @update:open="emit('update:open', $event)"
  >
    <div v-if="asset" class="tags">
      <div class="tags__photo">
        <img
          :src="asset.thumbnailUrl ?? asset.url"
          alt="La foto que se está etiquetando"
          @error="hideBroken"
        />
      </div>
      <div class="tags__side">
        <AppAlert v-if="error" tone="error">{{ error }}</AppAlert>
        <AppAlert v-if="withoutPermission.length" tone="error">
          {{
            withoutPermission.length === 1
              ? `${withoutPermission[0]!.name} no tiene permiso de imagen en su ficha.`
              : `${withoutPermission.length} personas no tienen permiso de imagen en su ficha.`
          }}
          Quita la foto o tápale el rostro antes de publicar.
        </AppAlert>

        <ul
          v-if="people.length"
          class="people"
          aria-label="Personas etiquetadas"
        >
          <li v-for="person in people" :key="person.patientId">
            <span>{{ person.name }}</span>
            <StatusBadge :tone="person.imageConsent ? 'success' : 'danger'">
              {{ person.imageConsent ? 'Con permiso' : 'Sin permiso' }}
            </StatusBadge>
            <button
              type="button"
              class="people__remove"
              :aria-label="`Quitar a ${person.name} de la foto`"
              @click="remove(person.patientId)"
            >
              ×
            </button>
          </li>
        </ul>
        <p v-else class="muted">Nadie etiquetado en esta foto.</p>

        <template v-if="canSearch">
          <label class="search-label" for="buscar-persona">
            Agregar a una persona
          </label>
          <input
            id="buscar-persona"
            v-model="query"
            class="input"
            type="search"
            autocomplete="off"
            placeholder="Nombre o carnet"
          />
          <ul
            v-if="results.length"
            class="results"
            aria-label="Afiliados encontrados"
          >
            <li v-for="patient in results" :key="patient.id">
              <button
                type="button"
                class="result"
                :disabled="people.some((p) => p.patientId === patient.id)"
                @click="add(patient)"
              >
                <span>{{ patient.name }}</span>
                <small>{{
                  patient.imageConsent
                    ? 'Uso de imagen: autorizado'
                    : 'Sin permiso de imagen'
                }}</small>
              </button>
            </li>
          </ul>
          <p v-else-if="query.trim().length >= 2 && !searching" class="muted">
            No encontramos a nadie con «{{ query.trim() }}».
          </p>
        </template>
        <p v-else class="muted">
          Para etiquetar personas hace falta el permiso de ver afiliados.
        </p>
      </div>
    </div>
    <template #actions>
      <button
        v-if="asset"
        type="button"
        class="remove-link"
        :disabled="saving"
        @click="emit('remove', asset)"
      >
        Quitar la foto del álbum…
      </button>
      <AppButton
        variant="secondary"
        :disabled="saving"
        @click="emit('update:open', false)"
      >
        Cancelar
      </AppButton>
      <AppButton
        :disabled="!changed || saving"
        :loading="saving"
        loading-label="Guardando…"
        @click="save"
      >
        Guardar personas
      </AppButton>
    </template>
  </AppModal>
</template>

<style scoped>
.tags {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--space-5);
  align-items: start;
}

.tags__photo {
  overflow: hidden;
  aspect-ratio: 4 / 3;
  max-height: 22rem;
  border-radius: var(--radius-md);
  background: var(--color-surface-sunken);
}

.tags__photo img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.tags__side {
  display: grid;
  gap: var(--space-3);
  min-width: 0;
}

.people,
.results {
  display: grid;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
  list-style: none;
}

.people li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto 2rem;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) 0;
  border-bottom: 1px solid var(--color-border);
  font-size: var(--text-sm);
}

.people__remove {
  width: 2rem;
  height: 2rem;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  font-size: var(--text-lg);
  cursor: pointer;
}

.search-label {
  font-size: var(--text-sm);
  font-weight: 600;
}

.result {
  display: grid;
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.result:hover:not(:disabled) {
  border-color: var(--aspar-verde);
}

.result:disabled {
  opacity: 0.55;
  cursor: default;
}

.remove-link {
  margin-right: auto;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--aspar-rojo);
  font: inherit;
  font-size: var(--text-sm);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 0.25em;
  cursor: pointer;
}

.result small,
.muted {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

@media (max-width: 640px) {
  .tags {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
